from datetime import datetime, timezone
from decimal import Decimal

import pytest
from pydantic import ValidationError

from arvo_risk_engine.models import RiskReport

# Keep in lockstep with app/src/types/schema.ts CreateRiskReportRequest.
EXPECTED_FIELDS = {
    "intentId", "riskScore", "premium", "coverage", "coverageDuration",
    "signature", "assessedAt", "expiresAt", "assessmentHash",
}


def report(**overrides):
    data = dict(intentId="11111111-1111-1111-1111-111111111111", riskScore=23, premium=16_500,
                coverage=Decimal("78.5"), coverageDuration=86_400, signature="0x" + "11" * 65,
                assessedAt=datetime.now(timezone.utc), expiresAt=datetime.now(timezone.utc),
                assessmentHash="0x" + "22" * 32)
    data.update(overrides)
    return RiskReport(**data)


def test_risk_report_fields_match_backend_create_risk_report_request():
    assert set(RiskReport.model_fields.keys()) == EXPECTED_FIELDS


def test_risk_report_rejects_fields_outside_the_backend_schema():
    with pytest.raises(ValidationError):
        report(canBeInsured=True)
    with pytest.raises(ValidationError):
        report(tradeAllowed=True)
    with pytest.raises(ValidationError):
        report(coverageAmount=1_000)


def test_risk_report_round_trips_through_json():
    dumped = report().model_dump(mode="json")
    assert set(dumped.keys()) == EXPECTED_FIELDS
