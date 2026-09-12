from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING
from .models import MarketSnapshot, TradeIntent


@dataclass(frozen=True)
class UnsignedDecision:
    can_be_insured: bool
    risk_score: int
    premium: int
    coverage: Decimal
    coverage_duration: int


def assess(intent: TradeIntent, market: MarketSnapshot) -> UnsignedDecision:
    """Insurance underwriting only. This never advises on or blocks the agent's trade.

    The service does not gate execution: an agent may trade regardless of this
    decision. `can_be_insured` only decides whether Arvo bears the loss, and is
    not itself part of the signed/persisted report.
    """
    amount_usd = Decimal(intent.amountIn) / (Decimal(10) ** market.tokenInDecimals) * market.tokenInUsd
    stale = (market.oracleObservedAt.timestamp() + 60) < __import__("time").time()
    hard_reject = stale or market.liquidityUsd < amount_usd * 5 or market.priceImpact > Decimal("0.10")
    score = min(100, int((market.volatility30d * 100) + (market.priceImpact * 300) + (Decimal(30) if market.tokenAgeDays < 30 else 0)))
    offered_coverage = max(Decimal("25"), Decimal("90") - Decimal(score) / 2)
    supported_duration = 7 * 24 * 60 * 60
    insured = (not hard_reject and intent.maxPremium > 0 and score < 75
               and offered_coverage >= intent.minCoverage
               and intent.minCoverageDuration <= supported_duration)
    if not insured:
        return UnsignedDecision(False, score, 0, Decimal(0), 0)

    # 0.5% base premium + risk surcharge; loss cover declines with risk.
    premium_rate = Decimal("0.005") + Decimal(score) / Decimal(2000)
    usdc_units = Decimal(10) ** market.usdcDecimals
    premium = min(intent.maxPremium, int((amount_usd * premium_rate * usdc_units).to_integral_value(ROUND_CEILING)))
    return UnsignedDecision(True, score, premium, offered_coverage, intent.minCoverageDuration)
