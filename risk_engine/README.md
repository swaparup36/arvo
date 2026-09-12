# Arvo Risk Engine

This service accepts a `TradeIntent` event from Arvo Backend, evaluates insurance eligibility, produces a signed `RiskAssessment`, and submits it to `POST /api/risk-report`. It deliberately does **not** execute swaps, lock vault balances, or issue insurance: those remain backend/contract responsibilities.

It is an insurance-underwriting service, not a trading adviser: agents can execute risky trades regardless of the assessment, since this service never gates execution. Internally the policy decides whether Arvo will insure the resulting position (`can_be_insured`), but that decision is not itself part of the report sent to Backend — a decline is expressed as `coverage`/`premium`/`coverageDuration` all zero, matching `CreateRiskReportRequest`. It consumes the Prisma-created UUID as `intentId`, `minCoverage` as a percentage, and `minCoverageDuration` as seconds.

## Run

```powershell
cd risk_engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env
uvicorn arvo_risk_engine.api:app --reload
```

The Backend posts a private event to `POST /v1/assessments`. It must include `X-Arvo-Callback-Secret`; only the intent is accepted. The engine independently obtains Uniswap V3 QuoterV2 execution quotes and pool liquidity through your RPC endpoint, DEX Screener pair metadata, and configured Chainlink feed rounds. Re-sending the same `intentId` is idempotent: the engine returns the original assessment and does not submit a second report.

It fails closed (HTTP 503) if a quote, on-chain pool liquidity, a configured Chainlink price, or the RPC itself is unavailable or stale. Configure the RPC URL, Uniswap QuoterV2/Factory addresses, and chain addresses in `.env`; never accept market data from an agent.

The included Uniswap adapter (`_uniswap_quote` in [providers.py](arvo_risk_engine/providers.py)) queries every configured V3 fee tier both directly and 2-hop through a bridge token (USDC, plus any chain's `uniswap_bridge_tokens`, e.g. WETH), and takes the best output via QuoterV2's `quoteExactInputSingle`/`quoteExactInput`. This is deterministic, RPC-only, and works for testnets with no third-party routing dependency. It is still **not** a general router: it is bounded to a single intermediate hop (no 3+ hop paths), does not split size across multiple routes, and does not support V2/V4 pools or native-token wrapping. For mainnet best-route execution beyond one bridge hop, or split routing, replace it with Uniswap's Trading API or Smart Order Router, then ensure execution uses the exact same route the quote assumed.

**Known limitation:** `MarketSnapshot.liquidityUsd` (the `hard_reject` gate in [policy.py](arvo_risk_engine/policy.py)) is still read from the *direct* tokenIn/tokenOut pool's on-chain reserves only, even when the winning quote came from a bridged 2-hop route. A pair with a thin or nonexistent direct pool but deep bridged liquidity will report low `liquidityUsd` and can be hard-rejected despite the trade being genuinely executable. Extending the liquidity gate to reflect whichever route the quote actually used (e.g. the minimum reserve across both hops) is a natural follow-up, not yet implemented.

### Liquidity source: on-chain reserves, not DEX Screener

`liquidityUsd` (the figure `hard_reject` gates on in [policy.py](arvo_risk_engine/policy.py)) is read directly from the Uniswap V3 pool contract — `Factory.getPool()` for each configured fee tier, then each pool's token balances via `balanceOf`, priced with the same feeds used elsewhere in the snapshot — and takes the deepest configured-fee-tier pool (`_onchain_pool_liquidity_usd` in [providers.py](arvo_risk_engine/providers.py)). It no longer comes from DEX Screener.

This replaces DEX Screener as the liquidity gate because DEX Screener's testnet coverage is an indexer with its own lag and gaps: a pool can be live and quotable on Sepolia (the QuoterV2 call already succeeds) while DEX Screener has not indexed it yet, which previously caused the engine to fail closed on a genuinely valid pool. Reading reserves straight from the pool contract removes that failure mode for any chain your RPC can reach, testnet or mainnet, at the cost of two extra `eth_call`s per fee tier (`getPool` + two `balanceOf`s) versus one HTTP request — negligible next to the QuoterV2/Chainlink calls already made per assessment.

DEX Screener is now used only for two soft, best-effort metadata inputs it cannot get wrong the same way: pool age (`pairCreatedAt`) and the temporary 24h-change volatility proxy. If DEX Screener has no indexed pair at all for a token (again, common on sparse testnets), the engine no longer fails the whole assessment closed for that reason alone — it falls back to a conservative default (age = 0 days, i.e. "assume newest/riskiest"; volatility = a fixed cautious value) rather than treating an unindexed pool as risk-free. A subgraph (The Graph / Uniswap's hosted or decentralized subgraph) has the same fundamental limitation as DEX Screener for a niche testnet — it is still a downstream indexer, not the source of truth — so it was not substituted in as a replacement for the liquidity gate itself, only considered and rejected for that role.

## Scalable intent delivery

Arvo Backend should publish a validated trade intent to Redis Streams, not call the risk engine synchronously:

```text
XADD arvo:trade-intents * intent '<serialized TradeIntent JSON>'
```

Run one or more consumers with `python -m arvo_risk_engine.worker`. They share the `ARVO_REDIS_CONSUMER_GROUP` group, so each message is handled by one worker. A message is acknowledged only after the risk report POST succeeds. Stopped-worker messages are reclaimed after 60 seconds. Delivery is at-least-once, so Backend must make `/api/risk-report` idempotent on `intentId` and/or `assessmentHash`.

## Denomination decision

`maxPremium` and `premium` are **USDC atomic units** (normally six decimals). `minCoverage` is the minimum percentage of trade notional the agent will accept; the report returns the offered `coverage` percentage only — Backend/ArvoMain derive any absolute coverage amount from `coverage` and the trade notional at claim time. Arvo Backend/ArvoMain must check the vault's free USDC balance and atomically collect the premium when issuing the policy; the risk engine must never move vault funds.

`chainId` from every intent selects a profile in `ARVO_CHAIN_PROFILES`: RPC, ArvoMain verifying contract, USDC, Uniswap QuoterV2, Uniswap V3 Factory, DEX Screener slug, and optional Chainlink feeds. The same chain ID is included in the EIP-712 domain, preventing a report from one chain being used on another.

The supplied contracts still do not identify the coverage currency. This implementation assumes claims are settled in USDC. Add `premiumToken` and `coverageToken` to the contract/API (or formally retain the USDC-only convention) before supporting another settlement asset.

## Signing

`assessmentHash` is the EIP-712 `RiskAssessment` struct hash without `signature` or `assessmentHash`; `signature` signs the complete EIP-712 typed-data message under the configured `chainId` and ArvoMain verifying contract. Contract code must recover the configured risk-engine signer and independently enforce `assessedAt`, `expiresAt`, and the binding to `intentId`.

## Backend persistence contract

`RiskReport` (`arvo_risk_engine/models.py`) mirrors Backend's `CreateRiskReportRequest` (`app/src/types/schema.ts`) and the Prisma `RiskAssessment` model field-for-field: `intentId`, `riskScore`, `premium`, `coverage`, `coverageDuration`, `signature`, `assessedAt`, `expiresAt`, `assessmentHash`. No other field is sent to `POST /api/risk-report`. Publish the Prisma-created UUID as `intentId` in the Redis event, converting every `BigInt` and `Decimal` to a string and `deadline` to ISO-8601. Use a transactional outbox: write the intent and outbox row in one PostgreSQL transaction, then publish the outbox event to Redis.

Solidity uses `bytes32` while Prisma uses UUID strings. The signer deterministically maps this with `keccak256(UTF-8 UUID)` for the signed typed-data field. ArvoMain must apply exactly the same mapping before validating a report, or the backend must add a separately generated `onchainIntentId bytes32` field and pass it to the engine.

**Known gap:** ArvoMain's on-chain `RiskAssessment` struct and `RISK_ASSESSMENT_TYPEHASH` (`contracts/src/ArvoMain.sol`) hash `id` (the Prisma-generated row id, as a `string`) and `intentId` as a `string` via `keccak256(bytes(...))`, not as a `bytes32`. This engine cannot know `id` before Backend creates the row, and its EIP-712 `TYPES` currently sign `intentId` as `bytes32`. A signature produced today will **not** recover against the deployed contract's `_verifyRiskAssessment`. Resolving this needs a decision on where `id` is minted (engine-generated UUID passed through `CreateRiskReportRequest`, vs. Backend assigning it before calling the engine) before the signer can be fixed — flagging here rather than guessing.

## Production adapters still required

Add a durable idempotency store (Postgres/Redis), use an event bus consumer (SQS/Kafka/etc.), store the private key in KMS/HSM, and configure mTLS or request signatures between Backend and this service. Replace the temporary 24-hour price-change volatility proxy with 30-day realized volatility computed from your own persisted price candles. The deterministic policy here is an auditable starting policy, not actuarial advice.
