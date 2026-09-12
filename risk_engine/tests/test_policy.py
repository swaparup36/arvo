from datetime import datetime, timezone
from decimal import Decimal
from arvo_risk_engine.models import MarketSnapshot, TradeIntent
from arvo_risk_engine.policy import assess


def intent(**overrides):
    data = dict(intentId="11111111-1111-1111-1111-111111111111", userAddress="0x1", agentAddress="0x2", vaultAddress="0x3",
                chainId=11155111, tokenIn="0x4", tokenOut="0x5", amountIn=1_000_000, minAmountOut=1,
                deadline=datetime(2030, 1, 1, tzinfo=timezone.utc), maxPremium=100_000, minCoverage=Decimal("75"),
                minCoverageDuration=86_400, signature="0x")
    data.update(overrides)
    return TradeIntent(**data)


def market(**overrides):
    data = dict(tokenInDecimals=6, usdcDecimals=6, tokenInUsd=Decimal("1"), tokenOutUsd=Decimal("2"), liquidityUsd=Decimal("100000"),
                volatility30d=Decimal("0.2"), priceImpact=Decimal("0.01"), tokenAgeDays=100, oracleObservedAt=datetime.now(timezone.utc))
    data.update(overrides)
    return MarketSnapshot(**data)


def test_safe_trade_is_insured_within_agent_limits():
    decision = assess(intent(), market())
    assert decision.can_be_insured
    assert 0 < decision.premium <= 100_000
    assert decision.coverage >= Decimal("75")
    assert decision.coverage_duration == 86_400


def test_premium_is_quoted_in_usdc_atomic_units():
    decision = assess(intent(), market())
    # $1 notional; score is 23, so rate is 1.65% = 0.0165 USDC = 16,500 units.
    assert decision.premium == 16_500


def test_high_price_impact_declines_coverage():
    decision = assess(intent(), market(priceImpact=Decimal("0.20")))
    assert not decision.can_be_insured
    assert decision.premium == 0
    assert decision.coverage == Decimal(0)
    assert decision.coverage_duration == 0


def test_stale_oracle_declines_coverage():
    stale_time = datetime.now(timezone.utc).timestamp() - 120
    decision = assess(intent(), market(oracleObservedAt=datetime.fromtimestamp(stale_time, timezone.utc)))
    assert not decision.can_be_insured


def test_premium_is_capped_at_agent_max_premium():
    decision = assess(intent(maxPremium=1_000), market())
    assert decision.can_be_insured
    assert decision.premium == 1_000


def test_requested_duration_beyond_supported_window_declines_coverage():
    decision = assess(intent(minCoverageDuration=8 * 24 * 60 * 60), market())
    assert not decision.can_be_insured
