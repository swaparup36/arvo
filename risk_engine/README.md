# Arvo Risk Engine

This service accepts a `TradeIntent` event from Arvo Backend, evaluates insurance eligibility, produces a signed `RiskAssessment`, and submits it to `POST /api/risk-report`. It deliberately does **not** execute swaps, lock vault balances, or issue insurance: those remain backend/contract responsibilities.

## Run

```powershell
cd risk_engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env
uvicorn arvo_risk_engine.api:app --reload
```

The Backend posts a private event to `POST /v1/assessments`. It must include `X-Arvo-Callback-Secret`; only the intent is accepted. The engine independently obtains 1inch execution quotes, DEX Screener pool data, and configured Chainlink feed rounds via your RPC endpoint. Re-sending the same `intentId` is idempotent: the engine returns the original assessment and does not submit a second report.

It fails closed (HTTP 503) if a quote, pool-age datum, configured Chainlink price, or required provider response is unavailable or stale. Configure the API credentials and chain addresses in `.env`; never accept market data from an agent.

## Scalable intent delivery

Arvo Backend should publish a validated trade intent to Redis Streams, not call the risk engine synchronously:

```text
XADD arvo:trade-intents * intent '<serialized TradeIntent JSON>'
```

Run one or more consumers with `python -m arvo_risk_engine.worker`. They share the `ARVO_REDIS_CONSUMER_GROUP` group, so each message is handled by one worker. A message is acknowledged only after the risk report POST succeeds. Stopped-worker messages are reclaimed after 60 seconds. Delivery is at-least-once, so Backend must make `/api/risk-report` idempotent on `intentId` and/or `assessmentHash`.

## Denomination decision

`maxPremium` and `premium` are **USDC atomic units** (normally six decimals). The engine prices the policy from the USD value of `amountIn`, then returns a USDC premium capped by the agent's `maxPremium`. Arvo Backend/ArvoMain must check the vault's free USDC balance and atomically collect the premium when issuing the policy; the risk engine must never move vault funds.

The supplied contracts still do not identify the coverage currency. This implementation treats `maxCoverage` and `coverageAmount` as **USDC atomic units** too, so claims are settled in USDC. Add `premiumToken` and `coverageToken` to the contract/API (or formally retain the USDC-only convention) before supporting another settlement asset.

## Signing

`assessmentHash` is the EIP-712 `RiskAssessment` struct hash without `signature` or `assessmentHash`; `signature` signs the complete EIP-712 typed-data message under the configured `chainId` and ArvoMain verifying contract. Contract code must recover the configured risk-engine signer and independently enforce `assessedAt`, `expiresAt`, and the binding to `intentId`.

## Production adapters still required

Add a durable idempotency store (Postgres/Redis), use an event bus consumer (SQS/Kafka/etc.), store the private key in KMS/HSM, and configure mTLS or request signatures between Backend and this service. Replace the temporary 24-hour price-change volatility proxy with 30-day realized volatility computed from your own persisted price candles. The deterministic policy here is an auditable starting policy, not actuarial advice.
