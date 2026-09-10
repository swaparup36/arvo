import httpx
from fastapi import FastAPI, Header, HTTPException
from .client import submit_report
from .config import Settings
from .models import AssessmentRequest, RiskReport
from .policy import assess
from .providers import MarketDataUnavailable, collect_market_snapshot
from .signer import sign

app = FastAPI(title="Arvo Risk Engine", version="0.1.0")
settings = Settings()
_reports: dict[str, RiskReport] = {}  # Replace with a unique intent_id row in Postgres.


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/assessments", response_model=RiskReport)
async def create_assessment(request: AssessmentRequest, x_arvo_callback_secret: str = Header(default="")) -> RiskReport:
    if x_arvo_callback_secret != settings.callback_shared_secret:
        raise HTTPException(status_code=401, detail="invalid callback credential")
    existing = _reports.get(request.intent.intentId)
    if existing:
        return existing
    try:
        market = await collect_market_snapshot(request.intent, settings)
    except (httpx.HTTPError, KeyError, ValueError, MarketDataUnavailable) as exc:
        raise HTTPException(status_code=503, detail=f"risk data unavailable: {exc}") from exc
    report = sign(request.intent.intentId, assess(request.intent, market), settings.risk_engine_private_key,
                  settings.chain_id, settings.verifying_contract)
    await submit_report(report, settings.backend_url, settings.report_path)
    _reports[request.intent.intentId] = report
    return report
