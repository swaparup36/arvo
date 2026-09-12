import httpx
from fastapi import FastAPI, Header, HTTPException
from .assessment import assess_and_submit
from .config import Settings
from .models import AssessmentRequest, RiskReport
from .providers import MarketDataUnavailable

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
        report = await assess_and_submit(request.intent, settings)
    except (httpx.HTTPError, KeyError, ValueError, MarketDataUnavailable) as exc:
        raise HTTPException(status_code=503, detail=f"risk data unavailable: {exc}") from exc
    _reports[request.intent.intentId] = report
    return report
