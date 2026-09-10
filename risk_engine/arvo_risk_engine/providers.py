"""Independent market-data adapters. Provider failures deliberately fail assessments closed."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from math import sqrt

import httpx

from .config import Settings
from .models import MarketSnapshot, TradeIntent


class MarketDataUnavailable(Exception):
    pass


async def _get_quote(client: httpx.AsyncClient, settings: Settings, src: str, dst: str, amount: int) -> dict:
    response = await client.get(
        f"https://api.1inch.com/swap/v6.1/{settings.chain_id}/quote",
        headers={"Authorization": f"Bearer {settings.oneinch_api_key}"},
        params={"src": src, "dst": dst, "amount": str(amount), "includeTokensInfo": "true", "includeProtocols": "true"},
    )
    response.raise_for_status()
    return response.json()


async def _dex_pairs(client: httpx.AsyncClient, settings: Settings, token: str) -> list[dict]:
    response = await client.get(f"https://api.dexscreener.com/token-pairs/v1/{settings.dexscreener_chain}/{token}")
    response.raise_for_status()
    return response.json() or []


async def _rpc_call(client: httpx.AsyncClient, rpc_url: str, to: str, data: str) -> str:
    response = await client.post(rpc_url, json={"jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [{"to": to, "data": data}, "latest"]})
    response.raise_for_status()
    result = response.json()
    if result.get("error") or not result.get("result"):
        raise MarketDataUnavailable(f"RPC call failed for feed {to}")
    return result["result"]


async def _chainlink_price(client: httpx.AsyncClient, settings: Settings, token: str) -> tuple[Decimal, datetime] | None:
    feed = settings.chainlink_feeds.get(token.lower())
    if not feed:
        return None
    # AggregatorV3Interface: latestRoundData() and decimals().
    round_data, decimals_data = await asyncio.gather(
        _rpc_call(client, settings.rpc_url, feed, "0xfeaf968c"),
        _rpc_call(client, settings.rpc_url, feed, "0x313ce567"),
    )
    words = [int(round_data[2 + 64 * i:2 + 64 * (i + 1)], 16) for i in range(5)]
    answer, updated_at, decimals = words[1], words[3], int(decimals_data, 16)
    observed = datetime.fromtimestamp(updated_at, timezone.utc)
    if answer <= 0 or (datetime.now(timezone.utc) - observed).total_seconds() > settings.max_oracle_age_seconds:
        raise MarketDataUnavailable("Chainlink price is invalid or stale")
    return Decimal(answer) / (Decimal(10) ** decimals), observed


def _best_pair(pairs: list[dict]) -> dict:
    valid = [pair for pair in pairs if pair.get("liquidity", {}).get("usd")]
    if not valid:
        raise MarketDataUnavailable("no indexed DEX liquidity")
    return max(valid, key=lambda pair: Decimal(str(pair["liquidity"]["usd"])))


async def collect_market_snapshot(intent: TradeIntent, settings: Settings) -> MarketSnapshot:
    """Create a snapshot from third parties; caller-provided market values are never accepted."""
    async with httpx.AsyncClient(timeout=8.0) as client:
        trade_quote, in_pairs, out_pairs, in_feed, out_feed = await asyncio.gather(
            _get_quote(client, settings, intent.tokenIn, intent.tokenOut, intent.amountIn),
            _dex_pairs(client, settings, intent.tokenIn), _dex_pairs(client, settings, intent.tokenOut),
            _chainlink_price(client, settings, intent.tokenIn), _chainlink_price(client, settings, intent.tokenOut),
        )
        in_decimals = int(trade_quote["srcToken"]["decimals"])
        out_decimals = int(trade_quote["dstToken"]["decimals"])
        # Quote one whole input/output token to USDC. This is the fallback price for long-tail assets.
        in_usdc_quote, out_usdc_quote = await asyncio.gather(
            _get_quote(client, settings, intent.tokenIn, settings.usdc_address, 10 ** in_decimals),
            _get_quote(client, settings, intent.tokenOut, settings.usdc_address, 10 ** out_decimals),
        )
    now = datetime.now(timezone.utc)
    usdc_units = Decimal(10) ** 6
    in_fallback = Decimal(in_usdc_quote["dstAmount"]) / usdc_units
    out_fallback = Decimal(out_usdc_quote["dstAmount"]) / usdc_units
    in_price = in_feed[0] if in_feed else in_fallback
    out_price = out_feed[0] if out_feed else out_fallback
    observed_at = min((x[1] for x in (in_feed, out_feed) if x), default=now)
    amount_usd = Decimal(intent.amountIn) / (Decimal(10) ** in_decimals) * in_price
    quoted_out = Decimal(trade_quote["dstAmount"]) / (Decimal(10) ** out_decimals)
    fair_out = amount_usd / out_price
    price_impact = max(Decimal(0), Decimal(1) - quoted_out / fair_out)
    in_pair, out_pair = _best_pair(in_pairs), _best_pair(out_pairs)
    liquidity = min(Decimal(str(in_pair["liquidity"]["usd"])), Decimal(str(out_pair["liquidity"]["usd"])))
    newest_pair_ms = max(int(in_pair.get("pairCreatedAt") or 0), int(out_pair.get("pairCreatedAt") or 0))
    if not newest_pair_ms:
        raise MarketDataUnavailable("pool age unavailable")
    market_age_days = max(0, int((now.timestamp() * 1000 - newest_pair_ms) / 86_400_000))
    # Temporary conservative proxy. Replace with 30-day realized volatility from stored price candles.
    change_24h = max(
        abs(Decimal(str(in_pair.get("priceChange", {}).get("h24", 0)))),
        abs(Decimal(str(out_pair.get("priceChange", {}).get("h24", 0)))),
    ) / 100
    volatility_proxy = min(Decimal(5), change_24h * Decimal(str(sqrt(30))))
    return MarketSnapshot(tokenInDecimals=in_decimals, tokenInUsd=in_price, tokenOutUsd=out_price,
                          liquidityUsd=liquidity, volatility30d=volatility_proxy, priceImpact=price_impact,
                          tokenAgeDays=market_age_days, oracleObservedAt=observed_at)
