from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR
from .models import MarketSnapshot, TradeIntent


@dataclass(frozen=True)
class UnsignedDecision:
    can_be_insured: bool
    trade_allowed: bool
    risk_score: int
    premium: int
    coverage_amount: int
    coverage_duration: int


def assess(intent: TradeIntent, market: MarketSnapshot) -> UnsignedDecision:
    """Deterministic baseline policy. Premium and coverage outputs are USDC atomic units."""
    amount_usd = Decimal(intent.amountIn) / (Decimal(10) ** market.tokenInDecimals) * market.tokenInUsd
    stale = (market.oracleObservedAt.timestamp() + 60) < __import__("time").time()
    hard_reject = stale or market.liquidityUsd < amount_usd * 5 or market.priceImpact > Decimal("0.10")
    score = min(100, int((market.volatility30d * 100) + (market.priceImpact * 300) + (Decimal(30) if market.tokenAgeDays < 30 else 0)))
    allowed = not hard_reject and score < 90
    insured = allowed and intent.maxPremium > 0 and intent.maxCoverage > 0 and score < 75
    if not insured:
        return UnsignedDecision(False, allowed, score, 0, 0, 0)

    # 0.5% base premium + risk surcharge; loss cover declines with risk.
    premium_rate = Decimal("0.005") + Decimal(score) / Decimal(2000)
    usdc_units = Decimal(10) ** market.usdcDecimals
    premium = min(intent.maxPremium, int((amount_usd * premium_rate * usdc_units).to_integral_value(ROUND_CEILING)))
    cover_ratio = max(Decimal("0.25"), Decimal("0.90") - Decimal(score) / 200)
    coverage = min(intent.maxCoverage, int((amount_usd * cover_ratio * usdc_units).to_integral_value(ROUND_FLOOR)))
    duration = min(intent.requestedCoverageDuration, 7 * 24 * 60 * 60)
    return UnsignedDecision(True, True, score, premium, coverage, duration)
