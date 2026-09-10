import httpx
from .models import RiskReport


async def submit_report(report: RiskReport, backend_url: str, report_path: str) -> None:
    async with httpx.AsyncClient(base_url=backend_url, timeout=10.0) as client:
        response = await client.post(report_path, json=report.model_dump(mode="json"))
        response.raise_for_status()
