from datetime import datetime, timezone
from decimal import Decimal
from arvo_risk_engine.models import MarketSnapshot, TradeIntent
from arvo_risk_engine.policy import assess


def intent(**overrides):
    data = dict(intentId="0x" + "11" * 32, user="0x1", agent="0x2", vault="0x3", tokenIn="0x4", tokenOut="0x5",
                amountIn=1_000_000, minAmountOut=1, deadline=2_000_000_000, maxPremium=100_000, maxCoverage=900_000,
                requestedCoverageDuration=86_400, nonce=1, signature="0x")
    data.update(overrides)
    return TradeIntent(**data)


def market(**overrides):
    data = dict(tokenInDecimals=6, tokenInUsd=Decimal("1"), tokenOutUsd=Decimal("2"), liquidityUsd=Decimal("100000"),
                volatility30d=Decimal("0.2"), priceImpact=Decimal("0.01"), tokenAgeDays=100, oracleObservedAt=datetime.now(timezone.utc))
    data.update(overrides)
    return MarketSnapshot(**data)


def test_safe_trade_is_insured_within_agent_limits():
    decision = assess(intent(), market())
    assert decision.can_be_insured and decision.trade_allowed
    assert 0 < decision.premium <= 100_000
    assert 0 < decision.coverage_amount <= 900_000


def test_high_price_impact_blocks_trade():
    decision = assess(intent(), market(priceImpact=Decimal("0.20")))
    assert not decision.trade_allowed
    assert not decision.can_be_insured
