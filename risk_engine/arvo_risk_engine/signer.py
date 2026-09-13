from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from eth_account import Account
from eth_account.messages import encode_typed_data
from eth_utils import keccak

from .models import RiskReport
from .policy import UnsignedDecision


# MUST match ArvoMain.RISK_ASSESSMENT_TYPEHASH exactly — field names, types and order.
# "RiskAssessment(string id,string intentId,uint256 riskScore,uint256 premium,
#  uint256 coverage,uint256 coverageDuration,uint256 assessedAt,uint256 expiresAt,
#  string assessmentHash)"
TYPES = {
    "RiskAssessment": [
        {"name": "id", "type": "string"},
        {"name": "intentId", "type": "string"},
        {"name": "riskScore", "type": "uint256"},
        {"name": "premium", "type": "uint256"},
        {"name": "coverage", "type": "uint256"},
        {"name": "coverageDuration", "type": "uint256"},
        {"name": "assessedAt", "type": "uint256"},
        {"name": "expiresAt", "type": "uint256"},
        {"name": "assessmentHash", "type": "string"},
    ]
}

EIP712_DOMAIN = [
    {"name": "name", "type": "string"},
    {"name": "version", "type": "string"},
    {"name": "chainId", "type": "uint256"},
    {"name": "verifyingContract", "type": "address"},
]


def sign(
    intent_id: str,
    decision: UnsignedDecision,
    private_key: str,
    chain_id: int,
    verifying_contract: str,
    block_timestamp: int,
) -> RiskReport:
    report_id = str(uuid4())

    risk_score = int(decision.risk_score)
    premium = int(decision.premium)
    coverage = int(decision.coverage)
    coverage_duration = int(decision.coverage_duration)

    assessed_timestamp = block_timestamp
    expires_timestamp = block_timestamp + coverage_duration

    # Must be computed BEFORE signing: the contract includes it in the struct hash.
    assessment_hash = "0x" + keccak(
        text="|".join(
            str(v)
            for v in (
                report_id,
                intent_id,
                risk_score,
                premium,
                coverage,
                coverage_duration,
                assessed_timestamp,
                expires_timestamp,
            )
        )
    ).hex()

    # intentId goes in as the raw UUID string. EIP-712 encodes a string as
    # keccak(utf8), which is exactly what ArvoMain does with keccak256(bytes(intentId)).
    # Do NOT pre-hash it here.
    message = {
        "id": report_id,
        "intentId": intent_id,
        "riskScore": risk_score,
        "premium": premium,
        "coverage": coverage,
        "coverageDuration": coverage_duration,
        "assessedAt": assessed_timestamp,
        "expiresAt": expires_timestamp,
        "assessmentHash": assessment_hash,
    }

    typed = {
        "types": {"EIP712Domain": EIP712_DOMAIN, **TYPES},
        "primaryType": "RiskAssessment",
        # ArvoMain is constructed with EIP712("ArvoMain", "1") and verifies against
        # address(this) — verifying_contract must be the ArvoMain deployment.
        "domain": {
            "name": "ArvoMain",
            "version": "1",
            "chainId": chain_id,
            "verifyingContract": verifying_contract,
        },
        "message": message,
    }

    signed = Account.sign_message(
        encode_typed_data(full_message=typed),
        private_key,
    )

    return RiskReport(
        id=report_id,
        intentId=intent_id,
        riskScore=risk_score,
        premium=premium,
        coverage=coverage,
        coverageDuration=coverage_duration,
        signature="0x" + signed.signature.hex(),
        assessedAt=datetime.fromtimestamp(assessed_timestamp, timezone.utc),
        expiresAt=datetime.fromtimestamp(expires_timestamp, timezone.utc),
        assessmentHash=assessment_hash,
    )
