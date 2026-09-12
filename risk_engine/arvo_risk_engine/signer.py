from __future__ import annotations

from datetime import datetime, timezone
from eth_account import Account
from eth_account.messages import encode_typed_data
from eth_utils import keccak
from .models import RiskReport
from .policy import UnsignedDecision

TYPES = {
    "RiskAssessment": [
        {"name": "intentId", "type": "bytes32"}, {"name": "riskScore", "type": "uint256"},
        {"name": "premium", "type": "uint256"}, {"name": "coverage", "type": "uint256"},
        {"name": "coverageDuration", "type": "uint256"}, {"name": "assessedAt", "type": "uint256"},
        {"name": "expiresAt", "type": "uint256"},
    ]
}


def sign(intent_id: str, decision: UnsignedDecision, private_key: str, chain_id: int, verifying_contract: str) -> RiskReport:
    assessed_at = datetime.now(timezone.utc).replace(microsecond=0)
    expires_at = datetime.fromtimestamp(assessed_at.timestamp() + decision.coverage_duration, timezone.utc)
    # Prisma IDs are UUIDs while the Solidity assessment expects bytes32. Both
    # Backend and contract must use this deterministic keccak(UUID string) bridge.
    onchain_intent_id = "0x" + keccak(text=intent_id).hex()
    message = {"intentId": onchain_intent_id, "riskScore": decision.risk_score, "premium": decision.premium,
               "coverage": int(decision.coverage), "coverageDuration": decision.coverage_duration,
               "assessedAt": int(assessed_at.timestamp()), "expiresAt": int(expires_at.timestamp())}
    domain = {"name": "ArvoRiskEngine", "version": "1", "chainId": chain_id, "verifyingContract": verifying_contract}
    typed = {"types": {"EIP712Domain": [{"name": "name", "type": "string"}, {"name": "version", "type": "string"}, {"name": "chainId", "type": "uint256"}, {"name": "verifyingContract", "type": "address"}], **TYPES}, "primaryType": "RiskAssessment", "domain": domain, "message": message}
    signable = encode_typed_data(full_message=typed)
    signed = Account.sign_message(signable, private_key)
    # The struct hash is useful for database indexing; signature is over domain-separated typed data.
    assessment_hash = "0x" + keccak(signable.body).hex()
    return RiskReport(intentId=intent_id, riskScore=decision.risk_score, premium=decision.premium,
                      coverage=decision.coverage, coverageDuration=decision.coverage_duration,
                      signature=signed.signature.hex(), assessedAt=assessed_at,
                      expiresAt=expires_at, assessmentHash=assessment_hash)
