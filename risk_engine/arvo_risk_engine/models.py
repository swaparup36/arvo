from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TradeIntent(Model):
    # Prisma TradeIntent.id (UUID), supplied by Backend/Redis after persistence.
    intentId: str
    userAddress: str
    agentAddress: str
    vaultAddress: str
    chainId: int = Field(gt=0)
    tokenIn: str
    tokenOut: str
    amountIn: int = Field(gt=0)
    minAmountOut: int = Field(ge=0)
    deadline: datetime
    maxPremium: int = Field(ge=0)
    minCoverage: Decimal = Field(ge=0, le=100, description="minimum insured notional percentage")
    minCoverageDuration: int = Field(gt=0, description="minimum coverage duration in seconds")
    signature: str

    @field_validator("intentId")
    @classmethod
    def intent_id_is_uuid(cls, value: str) -> str:
        return str(UUID(value))


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
    """Mirrors Backend's CreateRiskReportRequest (app/src/types/schema.ts) field-for-field."""
    intentId: str
    riskScore: int = Field(ge=0, le=100)
    premium: int = Field(ge=0)
    coverage: Decimal = Field(ge=0, le=100, description="insured notional percentage")
    coverageDuration: int = Field(ge=0)
    signature: str
    assessedAt: datetime
    expiresAt: datetime
    assessmentHash: str
