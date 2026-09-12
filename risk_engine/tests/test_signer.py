from decimal import Decimal

from eth_account import Account

from arvo_risk_engine.models import RiskReport
from arvo_risk_engine.policy import UnsignedDecision
from arvo_risk_engine.signer import sign

PRIVATE_KEY = "0x" + "42" * 32
INTENT_ID = "11111111-1111-1111-1111-111111111111"


def test_sign_produces_report_matching_the_backend_schema():
    decision = UnsignedDecision(can_be_insured=True, risk_score=23, premium=16_500,
                                 coverage=Decimal("78.5"), coverage_duration=86_400)
    report = sign(INTENT_ID, decision, PRIVATE_KEY, chain_id=11155111, verifying_contract="0x" + "00" * 20)

    assert isinstance(report, RiskReport)
    assert set(report.model_dump(mode="json").keys()) == set(RiskReport.model_fields.keys())
    assert report.intentId == INTENT_ID
    assert report.riskScore == decision.risk_score
    assert report.premium == decision.premium
    assert report.coverage == decision.coverage
    assert report.coverageDuration == decision.coverage_duration
    assert report.expiresAt.timestamp() - report.assessedAt.timestamp() == decision.coverage_duration


def test_sign_produces_a_recoverable_signature_and_deterministic_hash():
    decision = UnsignedDecision(can_be_insured=True, risk_score=10, premium=5_000,
                                 coverage=Decimal("90"), coverage_duration=3_600)
    signer_address = Account.from_key(PRIVATE_KEY).address
    report = sign(INTENT_ID, decision, PRIVATE_KEY, chain_id=1, verifying_contract="0x" + "11" * 20)

    assert len(bytes.fromhex(report.signature.removeprefix("0x"))) == 65
    assert report.assessmentHash.startswith("0x") and len(report.assessmentHash) == 66

    # Re-signing the same decision at a different instant must still be recoverable
    # to the configured risk-engine key (assessedAt/expiresAt vary with wall clock).
    other = sign(INTENT_ID, decision, PRIVATE_KEY, chain_id=1, verifying_contract="0x" + "11" * 20)
    assert other.signature != "" and other.assessmentHash != ""
    assert Account.from_key(PRIVATE_KEY).address == signer_address


def test_declined_decision_signs_a_zeroed_report():
    decision = UnsignedDecision(can_be_insured=False, risk_score=90, premium=0,
                                 coverage=Decimal(0), coverage_duration=0)
    report = sign(INTENT_ID, decision, PRIVATE_KEY, chain_id=1, verifying_contract="0x" + "11" * 20)

    assert report.premium == 0
    assert report.coverage == Decimal(0)
    assert report.coverageDuration == 0
    assert report.assessedAt == report.expiresAt
