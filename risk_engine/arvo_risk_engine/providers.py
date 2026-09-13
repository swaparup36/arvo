"""Independent market-data adapters.

Provider failures deliberately fail assessments closed.

Data sources:

- Uniswap Trading API:
    Executable trade quote / route discovery.

- Chainlink:
    Preferred USD oracle price when a feed is configured.

- DexScreener:
    USD price fallback, liquidity, market age, and
    24h price movement.

- RPC:
    Authoritative ERC20 token decimals.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
from math import sqrt

import httpx

from .config import ChainProfile, Settings
from .models import MarketSnapshot, TradeIntent



log = logging.getLogger(__name__)


class MarketDataUnavailable(Exception):
    """Raised when required external market data is unavailable."""

    pass


UNISWAP_QUOTE_URL = (
    "https://trade-api.gateway.uniswap.org/v1/quote"
)

DEXSCREENER_TOKEN_PAIRS_URL = (
    "https://api.dexscreener.com/token-pairs/v1"
)


# ---------------------------------------------------------------------------
# DexScreener
# ---------------------------------------------------------------------------


async def _dex_pairs(
    client: httpx.AsyncClient,
    profile: ChainProfile,
    token: str,
) -> list[dict]:
    """Fetch DexScreener pairs for a token.

    A successful HTTP response is not enough to guarantee that the
    response contains usable market data, so the caller must still
    validate the returned list.
    """

    try:
        response = await client.get(
            f"{DEXSCREENER_TOKEN_PAIRS_URL}/"
            f"{profile.dexscreener_chain}/{token}"
        )
        response.raise_for_status()

    except httpx.HTTPError as exc:
        raise MarketDataUnavailable(
            f"DexScreener request failed for {token}: {exc}"
        ) from exc

    try:
        data = response.json()

    except ValueError as exc:
        raise MarketDataUnavailable(
            f"DexScreener returned invalid JSON for {token}"
        ) from exc

    if not isinstance(data, list):
        raise MarketDataUnavailable(
            f"DexScreener returned unexpected data for "
            f"{token}: {data}"
        )

    return data


def _best_pair(
    pairs: list[dict],
) -> dict | None:
    """Return the highest-liquidity DexScreener pair.

    This is used for market metadata and USD-price fallback.
    """

    valid: list[dict] = []

    for pair in pairs:
        liquidity = pair.get("liquidity", {})

        if not isinstance(liquidity, dict):
            continue

        liquidity_usd = liquidity.get("usd")

        if liquidity_usd is None:
            continue

        try:
            value = Decimal(str(liquidity_usd))

        except (TypeError, ValueError):
            continue

        if value > 0:
            valid.append(pair)

    if not valid:
        return None

    return max(
        valid,
        key=lambda pair: Decimal(
            str(
                pair.get(
                    "liquidity",
                    {},
                ).get("usd", 0)
            )
        ),
    )


def _dexscreener_price(
    pair: dict | None,
) -> Decimal | None:
    """Extract a positive USD price from a DexScreener pair."""

    if not pair:
        return None

    price = pair.get("priceUsd")

    if price is None:
        return None

    try:
        value = Decimal(str(price))

    except (TypeError, ValueError):
        return None

    if value <= 0:
        return None

    return value


# ---------------------------------------------------------------------------
# ERC20 decimals
# ---------------------------------------------------------------------------


async def _token_decimals(
    client: httpx.AsyncClient,
    profile: ChainProfile,
    token: str,
) -> int:
    """Read ERC20 decimals directly from the configured RPC."""

    # bytes4(keccak256("decimals()"))
    selector = "313ce567"

    try:
        response = await client.post(
            profile.rpc_url,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_call",
                "params": [
                    {
                        "to": token,
                        "data": f"0x{selector}",
                    },
                    "latest",
                ],
            },
        )

        response.raise_for_status()

    except httpx.HTTPError as exc:
        raise MarketDataUnavailable(
            f"RPC decimals request failed for {token}: {exc}"
        ) from exc

    try:
        result = response.json()

    except ValueError as exc:
        raise MarketDataUnavailable(
            f"RPC returned invalid JSON while reading "
            f"decimals for {token}"
        ) from exc

    if result.get("error") or not result.get("result"):
        raise MarketDataUnavailable(
            f"could not read decimals for {token}: "
            f"{result}"
        )

    try:
        decimals = int(
            result["result"],
            16,
        )

    except (KeyError, TypeError, ValueError) as exc:
        raise MarketDataUnavailable(
            f"invalid decimals response for {token}: "
            f"{result}"
        ) from exc

    if decimals < 0 or decimals > 36:
        raise MarketDataUnavailable(
            f"invalid ERC20 decimals for {token}: "
            f"{decimals}"
        )

    return decimals


# ---------------------------------------------------------------------------
# Chainlink
# ---------------------------------------------------------------------------


async def _chainlink_price(
    client: httpx.AsyncClient,
    settings: Settings,
    profile: ChainProfile,
    token: str,
) -> tuple[Decimal, datetime] | None:
    """Read a Chainlink AggregatorV3 price if configured.

    Returns:
        (USD price, observation timestamp)

    Returns None when no feed is configured.

    Raises:
        MarketDataUnavailable when a configured feed is invalid,
        stale, or unavailable.
    """

    feed = profile.chainlink_feeds.get(
        token.lower()
    )

    if not feed:
        return None

    round_data, decimals_data = await _rpc_call_pair(
        client,
        profile.rpc_url,
        feed,
    )

    # latestRoundData() ABI return values:
    #
    # 0: roundId
    # 1: answer
    # 2: startedAt
    # 3: updatedAt
    # 4: answeredInRound
    #
    # Each ABI word is 32 bytes = 64 hex characters.
    if not isinstance(round_data, str):
        raise MarketDataUnavailable(
            f"invalid Chainlink roundData for {feed}"
        )

    if not round_data.startswith("0x"):
        raise MarketDataUnavailable(
            f"invalid Chainlink roundData encoding "
            f"for {feed}"
        )

    if len(round_data) < 2 + (64 * 5):
        raise MarketDataUnavailable(
            f"incomplete Chainlink roundData for {feed}"
        )

    words = [
        int(
            round_data[
                2 + 64 * i :
                2 + 64 * (i + 1)
            ],
            16,
        )
        for i in range(5)
    ]

    answer = words[1]
    updated_at = words[3]

    try:
        decimals = int(
            decimals_data,
            16,
        )

    except (TypeError, ValueError) as exc:
        raise MarketDataUnavailable(
            f"invalid Chainlink decimals for {feed}"
        ) from exc

    if updated_at <= 0:
        raise MarketDataUnavailable(
            f"Chainlink timestamp is invalid for {feed}"
        )

    observed = datetime.fromtimestamp(
        updated_at,
        timezone.utc,
    )

    age = (
        datetime.now(timezone.utc) - observed
    ).total_seconds()

    if answer <= 0:
        raise MarketDataUnavailable(
            f"Chainlink price is non-positive for "
            f"{token}: {answer}"
        )

    if age > settings.max_oracle_age_seconds:
        raise MarketDataUnavailable(
            f"Chainlink price is stale for {token}: "
            f"age={age:.1f}s"
        )

    price = (
        Decimal(answer)
        / (Decimal(10) ** decimals)
    )

    if price <= 0:
        raise MarketDataUnavailable(
            f"Chainlink price is non-positive for "
            f"{token}: {price}"
        )

    return price, observed


async def _rpc_call_pair(
    client: httpx.AsyncClient,
    rpc_url: str,
    feed: str,
) -> tuple[str, str]:
    """Read latestRoundData() and decimals() from Chainlink."""

    # bytes4(keccak256("latestRoundData()"))
    latest_round_data = "feaf968c"

    # bytes4(keccak256("decimals()"))
    decimals_selector = "313ce567"

    try:
        round_response = await client.post(
            rpc_url,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_call",
                "params": [
                    {
                        "to": feed,
                        "data": f"0x{latest_round_data}",
                    },
                    "latest",
                ],
            },
        )

        round_response.raise_for_status()

    except httpx.HTTPError as exc:
        raise MarketDataUnavailable(
            f"Chainlink roundData RPC request failed "
            f"for {feed}: {exc}"
        ) from exc

    try:
        round_result = round_response.json()

    except ValueError as exc:
        raise MarketDataUnavailable(
            f"Chainlink roundData returned invalid JSON "
            f"for {feed}"
        ) from exc

    if (
        round_result.get("error")
        or not round_result.get("result")
    ):
        raise MarketDataUnavailable(
            f"Chainlink roundData call failed for {feed}: "
            f"{round_result}"
        )

    try:
        decimals_response = await client.post(
            rpc_url,
            json={
                "jsonrpc": "2.0",
                "id": 2,
                "method": "eth_call",
                "params": [
                    {
                        "to": feed,
                        "data": f"0x{decimals_selector}",
                    },
                    "latest",
                ],
            },
        )

        decimals_response.raise_for_status()

    except httpx.HTTPError as exc:
        raise MarketDataUnavailable(
            f"Chainlink decimals RPC request failed "
            f"for {feed}: {exc}"
        ) from exc

    try:
        decimals_result = decimals_response.json()

    except ValueError as exc:
        raise MarketDataUnavailable(
            f"Chainlink decimals returned invalid JSON "
            f"for {feed}"
        ) from exc

    if (
        decimals_result.get("error")
        or not decimals_result.get("result")
    ):
        raise MarketDataUnavailable(
            f"Chainlink decimals call failed for {feed}: "
            f"{decimals_result}"
        )

    return (
        round_result["result"],
        decimals_result["result"],
    )


# ---------------------------------------------------------------------------
# Uniswap Trading API
# ---------------------------------------------------------------------------


async def _uniswap_trade_quote(
    client: httpx.AsyncClient,
    settings: Settings,
    chain_id: int,
    src: str,
    dst: str,
    amount: int,
    swapper: str,
) -> int:
    """Get an exact-input quote from the Uniswap Trading API.

    Uniswap performs route discovery. We do not manually inspect
    V3 factories, fee tiers, pool addresses, bridge tokens, etc.
    """

    if not settings.uniswap_api_key:
        raise MarketDataUnavailable(
            "ARVO_UNISWAP_API_KEY is not configured"
        )

    payload = {
        "type": "EXACT_INPUT",
        "amount": str(amount),
        "tokenIn": src,
        "tokenOut": dst,
        "tokenInChainId": chain_id,
        "tokenOutChainId": chain_id,
        "swapper": swapper,
    }

    headers = {
        "x-api-key": settings.uniswap_api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        response = await client.post(
            UNISWAP_QUOTE_URL,
            headers=headers,
            json=payload,
        )

    except httpx.HTTPError as exc:
        raise MarketDataUnavailable(
            f"Uniswap API request failed: {exc}"
        ) from exc

    if response.status_code >= 400:
        log.warning(
            "Uniswap quote failed: "
            "status=%s src=%s dst=%s body=%s",
            response.status_code,
            src,
            dst,
            response.text[:1000],
        )

        raise MarketDataUnavailable(
            f"Uniswap API returned HTTP "
            f"{response.status_code}: "
            f"{response.text[:500]}"
        )

    try:
        data = response.json()

    except ValueError as exc:
        raise MarketDataUnavailable(
            "Uniswap API returned invalid JSON"
        ) from exc

    quote = data.get("quote")

    if not isinstance(quote, dict):
        raise MarketDataUnavailable(
            f"Uniswap response missing quote: {data}"
        )

    output = quote.get("output")

    if not isinstance(output, dict):
        raise MarketDataUnavailable(
            f"Uniswap response missing "
            f"quote.output: {data}"
        )

    amount_out = output.get("amount")

    if amount_out is None:
        raise MarketDataUnavailable(
            "Uniswap response missing "
            "quote.output.amount"
        )

    try:
        output_amount = int(amount_out)

    except (TypeError, ValueError) as exc:
        raise MarketDataUnavailable(
            f"invalid Uniswap output amount: "
            f"{amount_out!r}"
        ) from exc

    if output_amount <= 0:
        raise MarketDataUnavailable(
            f"Uniswap returned non-positive output: "
            f"{output_amount}"
        )

    log.info(
        "Uniswap quote: "
        "chain=%s src=%s dst=%s amount=%s output=%s",
        chain_id,
        src,
        dst,
        amount,
        output_amount,
    )

    return output_amount


# ---------------------------------------------------------------------------
# Primary market-data collection
# ---------------------------------------------------------------------------


async def _collect_primary_market_data(
    client: httpx.AsyncClient,
    settings: Settings,
    profile: ChainProfile,
    chain_id: int,
    intent: TradeIntent,
):
    """Collect the executable trade quote and market metadata."""

    trade_quote_task = _uniswap_trade_quote(
        client=client,
        settings=settings,
        chain_id=chain_id,
        src=intent.tokenIn,
        dst=intent.tokenOut,
        amount=intent.amountIn,
        swapper=intent.userAddress,
    )

    in_pairs_task = _dex_pairs(
        client,
        profile,
        intent.tokenIn,
    )

    out_pairs_task = _dex_pairs(
        client,
        profile,
        intent.tokenOut,
    )

    in_feed_task = _chainlink_price(
        client,
        settings,
        profile,
        intent.tokenIn,
    )

    out_feed_task = _chainlink_price(
        client,
        settings,
        profile,
        intent.tokenOut,
    )

    in_decimals_task = _token_decimals(
        client,
        profile,
        intent.tokenIn,
    )

    out_decimals_task = _token_decimals(
        client,
        profile,
        intent.tokenOut,
    )

    return await asyncio.gather(
        trade_quote_task,
        in_pairs_task,
        out_pairs_task,
        in_feed_task,
        out_feed_task,
        in_decimals_task,
        out_decimals_task,
    )


# ---------------------------------------------------------------------------
# Market snapshot
# ---------------------------------------------------------------------------


async def collect_market_snapshot(
    intent: TradeIntent,
    settings: Settings,
) -> MarketSnapshot:
    """Create a market snapshot from external market data.

    Provider responsibilities:

    Uniswap:
        executable trade quote

    Chainlink:
        preferred USD oracle price

    DexScreener:
        USD price fallback
        liquidity
        market age
        24h price movement

    RPC:
        ERC20 decimals

    The engine never accepts caller-provided market values.
    """

    profile = settings.chain_profile(
        intent.chainId
    )

    async with httpx.AsyncClient(
        timeout=10.0
    ) as client:

        (
            trade_out,
            in_pairs,
            out_pairs,
            in_feed,
            out_feed,
            in_decimals,
            out_decimals,
        ) = await _collect_primary_market_data(
            client=client,
            settings=settings,
            profile=profile,
            chain_id=intent.chainId,
            intent=intent,
        )

        now = datetime.now(timezone.utc)

        # ------------------------------------------------------------
        # Select highest-liquidity market pairs.
        # ------------------------------------------------------------

        in_pair = _best_pair(in_pairs)
        out_pair = _best_pair(out_pairs)

        print("DEX IN PAIR:", in_pair)
        print("DEX OUT PAIR:", out_pair)

        # ------------------------------------------------------------
        # USD prices
        #
        # Priority:
        #
        # 1. Chainlink
        # 2. DexScreener
        # 3. Trusted USDC anchor + executable Uniswap quote
        #
        # We deliberately do NOT make additional token -> USDC
        # Uniswap requests here. Those can legitimately return
        # "No quotes available" even when the requested trade itself
        # has a valid route.
        # ------------------------------------------------------------

        in_dex_price = _dexscreener_price(
            in_pair
        )

        out_dex_price = _dexscreener_price(
            out_pair
        )

        in_price = (
            in_feed[0]
            if in_feed is not None
            else in_dex_price
        )

        out_price = (
            out_feed[0]
            if out_feed is not None
            else out_dex_price
        )

        # ------------------------------------------------------------
        # Trusted USDC anchor.
        #
        # The configured USDC token is treated as $1 for this
        # hackathon/testnet risk model.
        # ------------------------------------------------------------

        usdc_address = (
            profile.usdc_address.lower()
        )

        if (
            in_price is None
            and intent.tokenIn.lower() == usdc_address
        ):
            in_price = Decimal("1")

        if (
            out_price is None
            and intent.tokenOut.lower() == usdc_address
        ):
            out_price = Decimal("1")

        # ------------------------------------------------------------
        # Convert raw token amounts to human-readable units.
        # ------------------------------------------------------------

        input_tokens = (
            Decimal(intent.amountIn)
            / (Decimal(10) ** in_decimals)
        )

        quoted_tokens = (
            Decimal(trade_out)
            / (Decimal(10) ** out_decimals)
        )

        if input_tokens <= 0:
            raise MarketDataUnavailable(
                "input token amount is non-positive"
            )

        if quoted_tokens <= 0:
            raise MarketDataUnavailable(
                "quoted output token amount is non-positive"
            )

        # ------------------------------------------------------------
        # Derive missing USD price from the executable Uniswap
        # quote when one side has a trusted/reference USD price.
        #
        # Example:
        #
        # USDC = $1
        # 5 USDC -> 0.000206 WETH
        #
        # implied WETH price:
        #
        # 5 / 0.000206 = approximately $24,232
        #
        # This is only used when exactly one side is missing.
        # ------------------------------------------------------------

        if (
            in_price is not None
            and out_price is None
        ):
            input_usd = (
                input_tokens * in_price
            )

            if input_usd <= 0:
                raise MarketDataUnavailable(
                    "cannot derive tokenOut USD price: "
                    "input USD value is non-positive"
                )

            out_price = (
                input_usd / quoted_tokens
            )

            log.info(
                "Derived tokenOut USD price from "
                "Uniswap executable quote: "
                "token=%s price=%s",
                intent.tokenOut,
                out_price,
            )

        elif (
            out_price is not None
            and in_price is None
        ):
            output_usd = (
                quoted_tokens * out_price
            )

            if output_usd <= 0:
                raise MarketDataUnavailable(
                    "cannot derive tokenIn USD price: "
                    "output USD value is non-positive"
                )

            in_price = (
                output_usd / input_tokens
            )

            log.info(
                "Derived tokenIn USD price from "
                "Uniswap executable quote: "
                "token=%s price=%s",
                intent.tokenIn,
                in_price,
            )

        # ------------------------------------------------------------
        # If neither provider nor stablecoin anchor can give us a
        # price, fail closed.
        # ------------------------------------------------------------

        if (
            in_price is None
            or out_price is None
        ):
            raise MarketDataUnavailable(
                "unable to determine USD price for "
                "tokenIn/tokenOut: "
                f"tokenIn={intent.tokenIn} "
                f"price={in_price}, "
                f"tokenOut={intent.tokenOut} "
                f"price={out_price}"
            )

        if in_price <= 0 or out_price <= 0:
            raise MarketDataUnavailable(
                "market price is non-positive: "
                f"in_price={in_price}, "
                f"out_price={out_price}"
            )

        # ------------------------------------------------------------
        # Trade notional in USD.
        # ------------------------------------------------------------

        amount_usd = (
            input_tokens * in_price
        )

        if amount_usd <= 0:
            raise MarketDataUnavailable(
                "trade notional is non-positive"
            )

        # ------------------------------------------------------------
        # Fair output based on independent/reference USD prices.
        # ------------------------------------------------------------

        fair_out = (
            amount_usd / out_price
        )

        if fair_out <= 0:
            raise MarketDataUnavailable(
                "fair output amount is non-positive"
            )

        # ------------------------------------------------------------
        # Price impact.
        #
        # Example:
        #
        # fair output = 100 tokens
        # quoted output = 97 tokens
        #
        # impact = 1 - 97/100
        #        = 0.03
        #        = 3%
        #
        # MarketSnapshot expects the decimal representation [0, 1].
        # ------------------------------------------------------------

        price_impact = max(
            Decimal(0),
            Decimal(1)
            - quoted_tokens / fair_out,
        )

        price_impact = min(
            Decimal(1),
            price_impact,
        )

        # ------------------------------------------------------------
        # Market age.
        # ------------------------------------------------------------

        pair_created_ms = [
            int(
                pair.get("pairCreatedAt") or 0
            )
            for pair in (
                in_pair,
                out_pair,
            )
            if pair
        ]

        newest_pair_ms = max(
            pair_created_ms,
            default=0,
        )

        if newest_pair_ms:
            market_age_days = max(
                0,
                int(
                    (
                        now.timestamp() * 1000
                        - newest_pair_ms
                    )
                    / 86_400_000
                ),
            )
        else:
            # DexScreener did not provide pair age.
            # Unknown age must not be treated as "brand new".
            market_age_days = 30

        # ------------------------------------------------------------
        # 24h volatility proxy.
        #
        # DexScreener gives h24 percentage movement.
        # We turn that into a rough 30-day volatility proxy.
        #
        # This is intentionally a proxy rather than a statistical
        # realized-volatility calculation.
        # ------------------------------------------------------------

        price_changes_24h: list[Decimal] = []

        for pair in (
            in_pair,
            out_pair,
        ):
            if not pair:
                continue

            price_change = pair.get(
                "priceChange",
                {},
            )

            if not isinstance(
                price_change,
                dict,
            ):
                continue

            h24 = price_change.get(
                "h24",
                0,
            )

            try:
                value = abs(
                    Decimal(str(h24))
                )
            except (TypeError, ValueError):
                continue

            price_changes_24h.append(
                value
            )

        if price_changes_24h:
            volatility_proxy = min(
                Decimal(5),
                (
                    max(price_changes_24h)
                    / Decimal(100)
                )
                * Decimal(str(sqrt(30))),
            )
        else:
            # DexScreener did not provide 24h price movement.
            # Unknown volatility must not be treated as 100% volatility.
            volatility_proxy = Decimal("0")
        # ------------------------------------------------------------
        # Liquidity.
        #
        # DexScreener gives liquidity in USD.
        #
        # We use the highest-liquidity observed pair between tokenIn
        # and tokenOut as the market-liquidity signal.
        # ------------------------------------------------------------

        liquidity_values: list[Decimal] = []

        for pair in (
            in_pair,
            out_pair,
        ):
            if not pair:
                continue

            liquidity = pair.get(
                "liquidity",
                {},
            )

            if not isinstance(
                liquidity,
                dict,
            ):
                continue

            liquidity_usd = liquidity.get(
                "usd"
            )

            if liquidity_usd is None:
                continue

            try:
                value = Decimal(
                    str(liquidity_usd)
                )
            except (TypeError, ValueError):
                continue

            if value > 0:
                liquidity_values.append(
                    value
                )

        liquidity = (
            max(liquidity_values)
            if liquidity_values
            else Decimal("0")
        )

        # ------------------------------------------------------------
        # Observation timestamp.
        #
        # Chainlink provides an actual oracle observation timestamp.
        # DexScreener does not provide an equivalent timestamp for
        # this snapshot, so if Chainlink wasn't used we use now.
        # ------------------------------------------------------------

        oracle_timestamps = [
            feed[1]
            for feed in (
                in_feed,
                out_feed,
            )
            if feed is not None
        ]

        observed_at = min(
            oracle_timestamps,
            default=now,
        )

        # ------------------------------------------------------------
        # Final market snapshot.
        #
        # Keep this aligned with the existing MarketSnapshot model.
        # ------------------------------------------------------------

        return MarketSnapshot(
            tokenInDecimals=in_decimals,
            usdcDecimals=6,
            tokenInUsd=in_price,
            tokenOutUsd=out_price,
            liquidityUsd=liquidity,
            volatility30d=volatility_proxy,
            priceImpact=price_impact,
            tokenAgeDays=market_age_days,
            oracleObservedAt=observed_at,
        )

async def get_latest_block_timestamp(
    settings: Settings,
    chain_id: int,
) -> int:
    profile = settings.chain_profile(chain_id)

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_getBlockByNumber",
        "params": ["latest", False],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                profile.rpc_url,
                json=payload,
            )
            response.raise_for_status()

        except httpx.HTTPError as exc:
            raise MarketDataUnavailable(
                f"RPC latest block request failed: {exc}"
            ) from exc

    try:
        data = response.json()

    except ValueError as exc:
        raise MarketDataUnavailable(
            "RPC latest block returned invalid JSON"
        ) from exc

    if data.get("error"):
        raise MarketDataUnavailable(
            f"RPC latest block call failed: {data['error']}"
        )

    block = data.get("result")

    if not isinstance(block, dict):
        raise MarketDataUnavailable(
            f"RPC latest block returned invalid result: {data}"
        )

    timestamp_hex = block.get("timestamp")

    if not timestamp_hex:
        raise MarketDataUnavailable(
            "Latest block does not contain a timestamp"
        )

    try:
        return int(timestamp_hex, 16)

    except (TypeError, ValueError) as exc:
        raise MarketDataUnavailable(
            f"Invalid block timestamp: {timestamp_hex}"
        ) from exc