"""Shared, idempotent assessment orchestration for HTTP and queue consumers."""
from __future__ import annotations

from .client import submit_report
from .config import Settings
from .models import RiskReport, TradeIntent
from .policy import assess
from .providers import collect_market_snapshot
from .signer import sign


async def assess_and_submit(intent: TradeIntent, settings: Settings) -> RiskReport:
    market = await collect_market_snapshot(intent, settings)
    profile = settings.chain_profile(intent.chainId)
    report = sign(intent.intentId, assess(intent, market), settings.risk_engine_private_key,
                  intent.chainId, profile.verifying_contract)
    # Backend must de-duplicate POST /api/risk-report by intentId/assessmentHash.
    # Queue delivery is at-least-once, so a network failure after POST can be retried.
    await submit_report(report, settings.backend_url, settings.report_path)
    return report
