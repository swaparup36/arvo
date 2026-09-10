from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TradeIntent(Model):
    intentId: str
    user: str
    agent: str
    vault: str
    tokenIn: str
    tokenOut: str
    amountIn: int = Field(gt=0)
    minAmountOut: int = Field(ge=0)
    deadline: int = Field(gt=0)
    maxPremium: int = Field(ge=0)
    maxCoverage: int = Field(ge=0)
    requestedCoverageDuration: int = Field(gt=0)
    nonce: int = Field(ge=0)
    signature: str

    @field_validator("intentId")
    @classmethod
    def intent_id_is_bytes32(cls, value: str) -> str:
        if not value.startswith("0x") or len(value) != 66:
            raise ValueError("intentId must be a 0x-prefixed bytes32")
        int(value[2:], 16)
        return value.lower()


class MarketSnapshot(Model):
    tokenInDecimals: int = Field(ge=0, le=36)
    usdcDecimals: int = Field(default=6, ge=0, le=18)
    tokenInUsd: Decimal = Field(gt=0)
    tokenOutUsd: Decimal = Field(gt=0)
    liquidityUsd: Decimal = Field(ge=0)
    volatility30d: Decimal = Field(ge=0, le=5, description="decimal, e.g. .20")
    priceImpact: Decimal = Field(ge=0, le=1, description="decimal, e.g. .02")
    tokenAgeDays: int = Field(ge=0)
    oracleObservedAt: datetime


class AssessmentRequest(Model):
    intent: TradeIntent


class RiskReport(Model):
    intentId: str
    canBeInsured: bool
    tradeAllowed: bool
    riskScore: int = Field(ge=0, le=100)
    premium: int = Field(ge=0)
    coverageAmount: int = Field(ge=0)
    coverageDuration: int = Field(ge=0)
    signature: str
    assessedAt: datetime
    expiresAt: datetime
    assessmentHash: str
