# from __future__ import annotations

# from dataclasses import dataclass
# from decimal import Decimal, ROUND_CEILING
# import time

# from .models import MarketSnapshot, TradeIntent


# @dataclass(frozen=True)
# class UnsignedDecision:
#     can_be_insured: bool
#     risk_score: int
#     premium: int
#     coverage: Decimal
#     coverage_duration: int


# def assess(intent: TradeIntent, market: MarketSnapshot) -> UnsignedDecision:
#     """Insurance underwriting only.

#     This never advises on or blocks the agent's trade.
#     `can_be_insured` only decides whether Arvo bears the loss.
#     """

#     # -------------------------
#     # Risk score
#     # -------------------------

#     volatility_score = market.volatility30d * Decimal(100)

#     price_impact_score = market.priceImpact * Decimal(300)

#     age_score = (
#         Decimal(30)
#         if market.tokenAgeDays < 30
#         else Decimal(0)
#     )

#     raw_score = (
#         volatility_score
#         + price_impact_score
#         + age_score
#     )

#     score = min(100, int(raw_score))

#     print(
#         "RISK INPUTS:",
#         f"volatility30d={market.volatility30d}",
#         f"priceImpact={market.priceImpact}",
#         f"tokenAgeDays={market.tokenAgeDays}",
#     )

#     print(
#         "RISK SCORE:",
#         f"volatility={volatility_score}",
#         f"priceImpact={price_impact_score}",
#         f"age={age_score}",
#         f"raw={raw_score}",
#         f"final={score}",
#     )

#     # -------------------------
#     # Hard underwriting checks
#     # -------------------------

#     amount_usd = (
#         Decimal(intent.amountIn)
#         / (Decimal(10) ** market.tokenInDecimals)
#         * market.tokenInUsd
#     )

#     stale = (
#         market.oracleObservedAt.timestamp() + 60
#     ) < time.time()

#     liquidity_known = market.liquidityUsd > 0

#     hard_reject = (
#         stale
#         or (
#             liquidity_known
#             and market.liquidityUsd < amount_usd * 5
#         )
#         or market.priceImpact > Decimal("0.10")
#     )

#     # -------------------------
#     # Coverage / eligibility
#     # -------------------------

#     offered_coverage = max(
#         Decimal("25"),
#         Decimal("90") - Decimal(score) / 2,
#     )

#     supported_duration = 7 * 24 * 60 * 60

#     print(
#         "UNDERWRITING:",
#         f"amount_usd={amount_usd}",
#         f"liquidity_usd={market.liquidityUsd}",
#         f"stale={stale}",
#         f"hard_reject={hard_reject}",
#         f"maxPremium={intent.maxPremium}",
#         f"score={score}",
#         f"offeredCoverage={offered_coverage}",
#         f"minCoverage={intent.minCoverage}",
#         f"minCoverageDuration={intent.minCoverageDuration}",
#         f"supportedDuration={supported_duration}",
#     )

#     insured = (
#         not hard_reject
#         and intent.maxPremium > 0
#         and score < 75
#         and offered_coverage >= intent.minCoverage
#         and intent.minCoverageDuration <= supported_duration
#     )

#     if not insured:
#         return UnsignedDecision(
#             False,
#             score,
#             0,
#             Decimal(0),
#             0,
#         )

#     # -------------------------
#     # Premium
#     # -------------------------

#     # 0.5% base premium + risk surcharge.
#     premium_rate = (
#         Decimal("0.005")
#         + Decimal(score) / Decimal(2000)
#     )

#     usdc_units = Decimal(10) ** market.usdcDecimals

#     premium = min(
#         intent.maxPremium,
#         int(
#             (
#                 amount_usd
#                 * premium_rate
#                 * usdc_units
#             ).to_integral_value(ROUND_CEILING)
#         ),
#     )

#     return UnsignedDecision(
#         True,
#         score,
#         premium,
#         offered_coverage,
#         intent.minCoverageDuration,
#     )

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING
import random
import time

from .models import MarketSnapshot, TradeIntent


@dataclass(frozen=True)
class UnsignedDecision:
    can_be_insured: bool
    risk_score: int
    premium: int
    coverage: Decimal
    coverage_duration: int


def assess(intent: TradeIntent, market: MarketSnapshot) -> UnsignedDecision:
    """Insurance underwriting only.

    Demo mode currently uses a randomized risk score.
    The actual market-based risk calculator is preserved below and commented.
    """

    # ============================================================
    # DEMO RISK SCORE
    # ============================================================

    # Generate a plausible risk score for demonstration purposes.
    # Keep it below 75 so the demo can exercise the insurance path.
    score = random.randint(15, 70)

    print(
        "DEMO RISK SCORE:",
        f"generated={score}",
    )

    # ============================================================
    # ACTUAL RISK CALCULATOR — DISABLED FOR DEMO
    # ============================================================

    # volatility_score = market.volatility30d * Decimal(100)

    # price_impact_score = market.priceImpact * Decimal(300)

    # age_score = (
    #     Decimal(30)
    #     if market.tokenAgeDays < 30
    #     else Decimal(0)
    # )

    # raw_score = (
    #     volatility_score
    #     + price_impact_score
    #     + age_score
    # )

    # score = min(100, int(raw_score))

    # print(
    #     "RISK INPUTS:",
    #     f"volatility30d={market.volatility30d}",
    #     f"priceImpact={market.priceImpact}",
    #     f"tokenAgeDays={market.tokenAgeDays}",
    # )

    # print(
    #     "RISK SCORE:",
    #     f"volatility={volatility_score}",
    #     f"priceImpact={price_impact_score}",
    #     f"age={age_score}",
    #     f"raw={raw_score}",
    #     f"final={score}",
    # )

    # ============================================================
    # UNDERWRITING CHECKS
    # ============================================================

    amount_usd = (
        Decimal(intent.amountIn)
        / (Decimal(10) ** market.tokenInDecimals)
        * market.tokenInUsd
    )

    stale = (
        market.oracleObservedAt.timestamp() + 60
    ) < time.time()

    liquidity_known = market.liquidityUsd > 0

    hard_reject = (
        stale
        or (
            liquidity_known
            and market.liquidityUsd < amount_usd * 5
        )
        or market.priceImpact > Decimal("0.10")
    )

    offered_coverage = max(
        Decimal("25"),
        Decimal("90") - Decimal(score) / 2,
    )

    supported_duration = 7 * 24 * 60 * 60

    insured = (
        not hard_reject
        and intent.maxPremium > 0
        and score < 75
        and offered_coverage >= intent.minCoverage
        and intent.minCoverageDuration <= supported_duration
    )

    print(
        "UNDERWRITING:",
        f"amount_usd={amount_usd}",
        f"liquidity_usd={market.liquidityUsd}",
        f"liquidity_known={liquidity_known}",
        f"stale={stale}",
        f"hard_reject={hard_reject}",
        f"maxPremium={intent.maxPremium}",
        f"score={score}",
        f"offeredCoverage={offered_coverage}",
        f"minCoverage={intent.minCoverage}",
        f"minCoverageDuration={intent.minCoverageDuration}",
        f"supportedDuration={supported_duration}",
        f"insured={insured}",
    )

    if not insured:
        return UnsignedDecision(
            False,
            score,
            0,
            Decimal(0),
            0,
        )

    # ============================================================
    # PREMIUM
    # ============================================================

    # 0.5% base premium + risk surcharge.
    premium_rate = (
        Decimal("0.005")
        + Decimal(score) / Decimal(2000)
    )

    usdc_units = Decimal(10) ** market.usdcDecimals

    premium = min(
        intent.maxPremium,
        int(
            (
                amount_usd
                * premium_rate
                * usdc_units
            ).to_integral_value(ROUND_CEILING)
        ),
    )

    return UnsignedDecision(
        True,
        score,
        premium,
        offered_coverage,
        intent.minCoverageDuration,
    )