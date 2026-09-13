import httpx

from .models import RiskReport


async def submit_report(
    report: RiskReport,
    backend_url: str,
    report_path: str,
    callback_shared_secret: str,
) -> httpx.Response:
    payload = {
        "id": report.id,
        "intentId": report.intentId,
        "riskScore": int(report.riskScore),
        "premium": str(report.premium),
        "coverage": int(report.coverage),
        "coverageDuration": str(report.coverageDuration),
        "signature": report.signature,
        "assessedAt": int(report.assessedAt.timestamp()),
        "expiresAt": int(report.expiresAt.timestamp()),
        "assessmentHash": report.assessmentHash,
    }

    print("RISK REPORT PAYLOAD:")
    print(payload)

    async with httpx.AsyncClient(
        base_url=backend_url,
        timeout=60.0,
    ) as client:
        return await client.post(
            report_path,
            json=payload,
            headers={
                "Authorization": f"Bearer {callback_shared_secret}",
            },
        )