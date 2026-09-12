"""Independent market-data adapters. Provider failures deliberately fail assessments closed."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from math import sqrt

import httpx

from .config import ChainProfile, Settings
from .models import MarketSnapshot, TradeIntent


class MarketDataUnavailable(Exception):
    pass


def _address_bytes(address: str) -> bytes:
    if not address.startswith("0x") or len(address) != 42:
        raise MarketDataUnavailable(f"invalid EVM address: {address}")
    return bytes.fromhex(address[2:])


def _address_word(address: str) -> str:
    return _address_bytes(address).hex().zfill(64)


def _uint_word(value: int) -> str:
    return value.to_bytes(32, "big").hex()


def _encode_v3_path(tokens: list[str], fees: list[int]) -> bytes:
    """Packed Uniswap V3 path: token(20B) + fee(3B) + token(20B) + fee(3B) + ... + token(20B)."""
    parts = []
    for token, fee in zip(tokens, fees):
        parts.append(_address_bytes(token))
        parts.append(fee.to_bytes(3, "big"))
    parts.append(_address_bytes(tokens[-1]))
    return b"".join(parts)


async def _quote_direct(client: httpx.AsyncClient, profile: ChainProfile, src: str, dst: str, fee: int, amount: int) -> str:
    # quoteExactInputSingle((address,address,uint256,uint24,uint160)); tuple is static ABI encoded.
    selector = "c6a5026a"
    base = _address_word(src) + _address_word(dst) + _uint_word(amount)
    return await _rpc_call(client, profile.rpc_url, profile.uniswap_quoter_v2_address,
                            "0x" + selector + base + _uint_word(fee) + "00" * 32)


async def _quote_multi_hop(client: httpx.AsyncClient, profile: ChainProfile, tokens: list[str], fees: list[int], amount: int) -> str:
    selector = "cdca1753"  # quoteExactInput(bytes,uint256)
    path = _encode_v3_path(tokens, fees)
    padded_len = -(-len(path) // 32) * 32
    calldata = "0x" + selector + _uint_word(0x40) + _uint_word(amount) + _uint_word(len(path)) + path.hex().ljust(padded_len * 2, "0")
    return await _rpc_call(client, profile.rpc_url, profile.uniswap_quoter_v2_address, calldata)


def _bridge_candidates(profile: ChainProfile, src: str, dst: str) -> list[str]:
    excluded = {src.lower(), dst.lower()}
    candidates = {profile.usdc_address.lower(), *(token.lower() for token in profile.uniswap_bridge_tokens)}
    return [token for token in candidates if token not in excluded]


async def _uniswap_quote(client: httpx.AsyncClient, profile: ChainProfile, src: str, dst: str, amount: int) -> int:
    """Quote the exact input as the best of every configured Uniswap V3 fee tier via
    QuoterV2, both direct (single-pool) and 2-hop through a bridge token (USDC and any
    configured `uniswap_bridge_tokens`, e.g. WETH). This is bounded to one intermediate
    hop — it is not a general path finder or a split-route optimizer."""
    direct_calls = [_quote_direct(client, profile, src, dst, fee, amount) for fee in profile.uniswap_fee_tiers]
    hop_calls = [
        _quote_multi_hop(client, profile, [src, bridge, dst], [fee_in, fee_out], amount)
        for bridge in _bridge_candidates(profile, src, dst)
        for fee_in in profile.uniswap_fee_tiers
        for fee_out in profile.uniswap_fee_tiers
    ]
    results = await asyncio.gather(*direct_calls, *hop_calls, return_exceptions=True)
    outputs = [int(value[2:66], 16) for value in results if isinstance(value, str) and len(value) >= 66]
    if not outputs or max(outputs) <= 0:
        raise MarketDataUnavailable("no Uniswap V3 route (direct or bridged) for configured fee tiers")
    return max(outputs)


async def _dex_pairs(client: httpx.AsyncClient, profile: ChainProfile, token: str) -> list[dict]:
    response = await client.get(f"https://api.dexscreener.com/token-pairs/v1/{profile.dexscreener_chain}/{token}")
    response.raise_for_status()
    return response.json() or []


async def _pool_address(client: httpx.AsyncClient, profile: ChainProfile, token_a: str, token_b: str, fee: int) -> str | None:
    # IUniswapV3Factory.getPool(address,address,uint24); returns the zero address if no pool exists.
    selector = "1698ee82"
    data = "0x" + selector + _address_word(token_a) + _address_word(token_b) + fee.to_bytes(32, "big").hex()
    result = await _rpc_call(client, profile.rpc_url, profile.uniswap_factory_v3_address, data)
    address = "0x" + result[-40:]
    return address if int(address, 16) != 0 else None


async def _token_balance(client: httpx.AsyncClient, profile: ChainProfile, token: str, holder: str) -> int:
    # IERC20.balanceOf(address)
    selector = "70a08231"
    data = "0x" + selector + _address_word(holder)
    return int(await _rpc_call(client, profile.rpc_url, token, data), 16)


async def _onchain_pool_liquidity_usd(
    client: httpx.AsyncClient, profile: ChainProfile, token_in: str, token_out: str,
    in_price: Decimal, out_price: Decimal, in_decimals: int, out_decimals: int,
) -> Decimal:
    """USD-valued reserves of the deepest configured-fee-tier pool for this exact pair, read
    directly from chain. This is the liquidity source of record (see hard_reject in policy.py):
    unlike a third-party indexer, it cannot lag or skip a pool that genuinely exists on-chain,
    which is what causes sparsely-indexed testnets to fail closed despite valid liquidity.
    """
    addresses = await asyncio.gather(*(_pool_address(client, profile, token_in, token_out, fee) for fee in profile.uniswap_fee_tiers))
    pools = [address for address in addresses if address]
    if not pools:
        raise MarketDataUnavailable("no Uniswap V3 pool deployed for configured fee tiers")
    balances = await asyncio.gather(*(
        asyncio.gather(_token_balance(client, profile, token_in, pool), _token_balance(client, profile, token_out, pool))
        for pool in pools
    ))
    reserves_usd = [
        Decimal(in_balance) / (Decimal(10) ** in_decimals) * in_price + Decimal(out_balance) / (Decimal(10) ** out_decimals) * out_price
        for in_balance, out_balance in balances
    ]
    return max(reserves_usd)


async def _rpc_call(client: httpx.AsyncClient, rpc_url: str, to: str, data: str) -> str:
    response = await client.post(rpc_url, json={"jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [{"to": to, "data": data}, "latest"]})
    response.raise_for_status()
    result = response.json()
    if result.get("error") or not result.get("result"):
        raise MarketDataUnavailable(f"RPC call failed for feed {to}")
    return result["result"]


async def _token_decimals(client: httpx.AsyncClient, profile: ChainProfile, token: str) -> int:
    return int(await _rpc_call(client, profile.rpc_url, token, "0x313ce567"), 16)


async def _chainlink_price(client: httpx.AsyncClient, settings: Settings, profile: ChainProfile, token: str) -> tuple[Decimal, datetime] | None:
    feed = profile.chainlink_feeds.get(token.lower())
    if not feed:
        return None
    # AggregatorV3Interface: latestRoundData() and decimals().
    round_data, decimals_data = await asyncio.gather(
        _rpc_call(client, profile.rpc_url, feed, "0xfeaf968c"),
        _rpc_call(client, profile.rpc_url, feed, "0x313ce567"),
    )
    words = [int(round_data[2 + 64 * i:2 + 64 * (i + 1)], 16) for i in range(5)]
    answer, updated_at, decimals = words[1], words[3], int(decimals_data, 16)
    observed = datetime.fromtimestamp(updated_at, timezone.utc)
    if answer <= 0 or (datetime.now(timezone.utc) - observed).total_seconds() > settings.max_oracle_age_seconds:
        raise MarketDataUnavailable("Chainlink price is invalid or stale")
    return Decimal(answer) / (Decimal(10) ** decimals), observed


def _best_pair(pairs: list[dict]) -> dict | None:
    """Best-effort pair for pool-age/volatility metadata only. DEX Screener does not gate the
    liquidity check (see _onchain_pool_liquidity_usd): its testnet coverage is too sparse to be
    used as a source of truth for whether a pool has liquidity."""
    valid = [pair for pair in pairs if pair.get("liquidity", {}).get("usd")]
    return max(valid, key=lambda pair: Decimal(str(pair["liquidity"]["usd"]))) if valid else None


async def collect_market_snapshot(intent: TradeIntent, settings: Settings) -> MarketSnapshot:
    """Create a snapshot from third parties; caller-provided market values are never accepted."""
    profile = settings.chain_profile(intent.chainId)
    async with httpx.AsyncClient(timeout=8.0) as client:
        trade_out, in_pairs, out_pairs, in_feed, out_feed, in_decimals, out_decimals = await asyncio.gather(
            _uniswap_quote(client, profile, intent.tokenIn, intent.tokenOut, intent.amountIn),
            _dex_pairs(client, profile, intent.tokenIn), _dex_pairs(client, profile, intent.tokenOut),
            _chainlink_price(client, settings, profile, intent.tokenIn), _chainlink_price(client, settings, profile, intent.tokenOut),
            _token_decimals(client, profile, intent.tokenIn), _token_decimals(client, profile, intent.tokenOut),
        )
        # Quote one whole input/output token to USDC. This is the fallback price for long-tail assets.
        in_usdc_quote, out_usdc_quote = await asyncio.gather(
            _uniswap_quote(client, profile, intent.tokenIn, profile.usdc_address, 10 ** in_decimals),
            _uniswap_quote(client, profile, intent.tokenOut, profile.usdc_address, 10 ** out_decimals),
        )
        now = datetime.now(timezone.utc)
        usdc_units = Decimal(10) ** 6
        in_fallback = Decimal(in_usdc_quote) / usdc_units
        out_fallback = Decimal(out_usdc_quote) / usdc_units
        in_price = in_feed[0] if in_feed else in_fallback
        out_price = out_feed[0] if out_feed else out_fallback
        liquidity = await _onchain_pool_liquidity_usd(client, profile, intent.tokenIn, intent.tokenOut,
                                                       in_price, out_price, in_decimals, out_decimals)
    observed_at = min((x[1] for x in (in_feed, out_feed) if x), default=now)
    amount_usd = Decimal(intent.amountIn) / (Decimal(10) ** in_decimals) * in_price
    quoted_out = Decimal(trade_out) / (Decimal(10) ** out_decimals)
    fair_out = amount_usd / out_price
    price_impact = max(Decimal(0), Decimal(1) - quoted_out / fair_out)
    in_pair, out_pair = _best_pair(in_pairs), _best_pair(out_pairs)
    pair_created_ms = [int(pair.get("pairCreatedAt") or 0) for pair in (in_pair, out_pair) if pair]
    newest_pair_ms = max(pair_created_ms, default=0)
    # DEX Screener has no indexed pair for this token on this chain; common on sparse testnets.
    # Assume the newest/riskiest age rather than failing an otherwise-valid on-chain pool closed.
    market_age_days = max(0, int((now.timestamp() * 1000 - newest_pair_ms) / 86_400_000)) if newest_pair_ms else 0
    price_changes_24h = [abs(Decimal(str(pair.get("priceChange", {}).get("h24", 0)))) for pair in (in_pair, out_pair) if pair]
    if price_changes_24h:
        # Temporary conservative proxy. Replace with 30-day realized volatility from stored price candles.
        volatility_proxy = min(Decimal(5), (max(price_changes_24h) / 100) * Decimal(str(sqrt(30))))
    else:
        # No DEX Screener data to proxy from either; assume a cautious default instead of
        # treating an unindexed pool as risk-free.
        volatility_proxy = Decimal("1")
    return MarketSnapshot(tokenInDecimals=in_decimals, tokenInUsd=in_price, tokenOutUsd=out_price,
                          liquidityUsd=liquidity, volatility30d=volatility_proxy, priceImpact=price_impact,
                          tokenAgeDays=market_age_days, oracleObservedAt=observed_at)
