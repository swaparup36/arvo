import json
from decimal import Decimal

import httpx
import pytest

from arvo_risk_engine.config import ChainProfile
from arvo_risk_engine.providers import (
    MarketDataUnavailable, _best_pair, _bridge_candidates, _encode_v3_path, _onchain_pool_liquidity_usd,
    _pool_address, _token_balance, _uniswap_quote,
)

TOKEN_IN = "0x" + "11" * 20
TOKEN_OUT = "0x" + "22" * 20
FACTORY = "0x" + "33" * 20
POOL_500 = "0x" + "aa" * 20
POOL_3000 = "0x" + "bb" * 20
USDC = "0x" + "55" * 20
WETH = "0x" + "66" * 20
GET_POOL_SELECTOR = "1698ee82"
BALANCE_OF_SELECTOR = "70a08231"
QUOTE_SINGLE_SELECTOR = "c6a5026a"
QUOTE_MULTI_SELECTOR = "cdca1753"


def profile(**overrides):
    data = dict(rpc_url="https://rpc.example", verifying_contract="0x" + "00" * 20, usdc_address="0x" + "00" * 20,
                uniswap_quoter_v2_address="0x" + "00" * 20, uniswap_factory_v3_address=FACTORY,
                uniswap_fee_tiers=[500, 3000])
    data.update(overrides)
    return ChainProfile(**data)


def _hex_word(value: int) -> str:
    return "0x" + hex(value)[2:].rjust(64, "0")


def _mock_client(pool_by_fee: dict[int, str | None], balances: dict[tuple[str, str], int]) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        call = body["params"][0]
        to, data = call["to"].lower(), call["data"]
        selector = data[2:10]
        if selector == GET_POOL_SELECTOR:
            fee = int(data[-64:], 16)
            pool = pool_by_fee.get(fee)
            result = _hex_word(int(pool, 16) if pool else 0)
        elif selector == BALANCE_OF_SELECTOR:
            holder = "0x" + data[-40:]
            result = _hex_word(balances[(to, holder)])
        else:
            raise AssertionError(f"unexpected selector {selector}")
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "result": result})

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_pool_address_returns_none_when_factory_has_no_pool():
    async with _mock_client(pool_by_fee={500: None}, balances={}) as client:
        assert await _pool_address(client, profile(), TOKEN_IN, TOKEN_OUT, 500) is None


async def test_pool_address_returns_the_pool_when_present():
    async with _mock_client(pool_by_fee={500: POOL_500}, balances={}) as client:
        assert await _pool_address(client, profile(), TOKEN_IN, TOKEN_OUT, 500) == POOL_500.lower()


async def test_token_balance_decodes_the_rpc_result():
    async with _mock_client(pool_by_fee={}, balances={(TOKEN_IN.lower(), POOL_500.lower()): 5_000_000}) as client:
        assert await _token_balance(client, profile(), TOKEN_IN, POOL_500) == 5_000_000


async def test_onchain_pool_liquidity_usd_picks_the_deepest_configured_fee_tier():
    balances = {
        (TOKEN_IN.lower(), POOL_500.lower()): 1_000 * 10**6, (TOKEN_OUT.lower(), POOL_500.lower()): 1_000 * 10**6,
        (TOKEN_IN.lower(), POOL_3000.lower()): 50_000 * 10**6, (TOKEN_OUT.lower(), POOL_3000.lower()): 50_000 * 10**6,
    }
    async with _mock_client(pool_by_fee={500: POOL_500, 3000: POOL_3000}, balances=balances) as client:
        liquidity = await _onchain_pool_liquidity_usd(client, profile(), TOKEN_IN, TOKEN_OUT,
                                                        in_price=Decimal("1"), out_price=Decimal("1"),
                                                        in_decimals=6, out_decimals=6)
    assert liquidity == Decimal(100_000)  # deepest pool (3000) wins, not the shallow 500 pool


async def test_onchain_pool_liquidity_usd_raises_when_no_pool_exists_for_any_fee_tier():
    async with _mock_client(pool_by_fee={500: None, 3000: None}, balances={}) as client:
        with pytest.raises(MarketDataUnavailable):
            await _onchain_pool_liquidity_usd(client, profile(), TOKEN_IN, TOKEN_OUT,
                                               in_price=Decimal("1"), out_price=Decimal("1"),
                                               in_decimals=6, out_decimals=6)


def test_best_pair_returns_none_when_no_pair_has_indexed_liquidity():
    assert _best_pair([]) is None
    assert _best_pair([{"liquidity": {}}, {"liquidity": {"usd": 0}}]) is None


def test_best_pair_returns_the_highest_liquidity_pair():
    low, high = {"liquidity": {"usd": 100}}, {"liquidity": {"usd": 900}}
    assert _best_pair([low, high]) is high


def test_encode_v3_path_packs_token_fee_token():
    path = _encode_v3_path([TOKEN_IN, WETH, TOKEN_OUT], [500, 3000])
    assert path == bytes.fromhex(TOKEN_IN[2:]) + (500).to_bytes(3, "big") + bytes.fromhex(WETH[2:]) + (3000).to_bytes(3, "big") + bytes.fromhex(TOKEN_OUT[2:])
    assert len(path) == 20 + 3 + 20 + 3 + 20


def test_bridge_candidates_includes_usdc_and_configured_bridges_excluding_src_dst():
    p = profile(usdc_address=USDC, uniswap_bridge_tokens=[WETH])
    assert set(_bridge_candidates(p, TOKEN_IN, TOKEN_OUT)) == {USDC.lower(), WETH.lower()}
    # A bridge that equals src or dst is not a useful hop and must be excluded.
    assert USDC.lower() not in _bridge_candidates(p, USDC, TOKEN_OUT)
    assert WETH.lower() not in _bridge_candidates(p, TOKEN_IN, WETH)


def _decode_quote_single(data: str) -> tuple[str, str, int, int]:
    body = data[10:]
    token_in, token_out = "0x" + body[0:64][-40:], "0x" + body[64:128][-40:]
    amount, fee = int(body[128:192], 16), int(body[192:256], 16)
    return token_in, token_out, fee, amount


def _decode_quote_multi(data: str) -> tuple[list[str], list[int]]:
    body = data[10:]
    path_len = int(body[128:192], 16)
    path = bytes.fromhex(body[192:192 + path_len * 2])
    tokens, fees, i = [], [], 0
    while i < len(path):
        tokens.append("0x" + path[i:i + 20].hex())
        i += 20
        if i < len(path):
            fees.append(int.from_bytes(path[i:i + 3], "big"))
            i += 3
    return tokens, fees


def _mock_quoter(direct: dict[tuple[str, str, int], int], hops: dict[tuple[tuple[str, ...], tuple[int, ...]], int]) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        data = body["params"][0]["data"]
        selector = data[2:10]
        if selector == QUOTE_SINGLE_SELECTOR:
            token_in, token_out, fee, _amount = _decode_quote_single(data)
            key = (token_in.lower(), token_out.lower(), fee)
            amount_out = direct.get(key)
        elif selector == QUOTE_MULTI_SELECTOR:
            tokens, fees = _decode_quote_multi(data)
            key = (tuple(t.lower() for t in tokens), tuple(fees))
            amount_out = hops.get(key)
        else:
            raise AssertionError(f"unexpected selector {selector}")
        if amount_out is None:
            return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "error": {"code": -32000, "message": "execution reverted"}})
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "result": _hex_word(amount_out)})

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_uniswap_quote_prefers_the_best_direct_fee_tier_when_no_bridge_beats_it():
    direct = {(TOKEN_IN.lower(), TOKEN_OUT.lower(), 500): 100, (TOKEN_IN.lower(), TOKEN_OUT.lower(), 3000): 120}
    async with _mock_quoter(direct=direct, hops={}) as client:
        amount = await _uniswap_quote(client, profile(usdc_address=USDC), TOKEN_IN, TOKEN_OUT, 1_000)
    assert amount == 120


async def test_uniswap_quote_takes_a_bridged_route_when_it_beats_every_direct_pool():
    # Thin direct pool (10 out) but a deep USDC-bridged route (500 out): the bridge must win.
    direct = {(TOKEN_IN.lower(), TOKEN_OUT.lower(), 500): 10}
    hops = {((TOKEN_IN.lower(), USDC.lower(), TOKEN_OUT.lower()), (500, 500)): 500}
    async with _mock_quoter(direct=direct, hops=hops) as client:
        amount = await _uniswap_quote(client, profile(uniswap_fee_tiers=[500], usdc_address=USDC), TOKEN_IN, TOKEN_OUT, 1_000)
    assert amount == 500


async def test_uniswap_quote_raises_when_no_direct_or_bridged_route_exists():
    async with _mock_quoter(direct={}, hops={}) as client:
        with pytest.raises(MarketDataUnavailable):
            await _uniswap_quote(client, profile(usdc_address=USDC), TOKEN_IN, TOKEN_OUT, 1_000)
