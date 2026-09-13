# Arvo

## Decentralized Agentic Trade Insurance Protocol

Arvo is a decentralized trade insurance protocol designed to protect users from risks associated with autonomous AI trading agents.

As AI agents become increasingly capable of independently managing portfolios and executing on-chain trades, users need a way to protect their capital without restricting or interfering with an agent's trading strategy. Arvo introduces an insurance layer that assesses individual trades for risk and provides coverage based on real-time market conditions.

---

## Overview

Arvo allows users to connect their wallets, deploy vaults across supported blockchain networks, and allow their trading agents to execute trades using assets stored in those vaults.

When an agent submits a trade, Arvo operates through two independent systems:

- **Trade Engine** — Executes the agent's submitted trade intent.
- **Risk Engine** — Independently evaluates the trade to determine whether it qualifies for insurance coverage.

The trade execution process is intentionally independent from the insurance assessment process. Arvo does not interfere with or modify an agent's trading strategy.

> **The agent decides how to trade. Arvo evaluates whether that trade can be insured.**

---

## Key Features

- Insurance for autonomous trading agents
- Multi-chain vault infrastructure
- User-controlled smart contract vaults
- Independent trade execution
- Real-time trade risk assessment
- Trade-level insurance coverage
- Premium calculation in USDC
- Risk scoring from 1–100
- Asset locking during coverage periods
- Chain-specific smart contracts
- Non-intrusive agent trading architecture

---

# Architecture

```text
                        ┌───────────────────┐
                        │       User        │
                        │                   │
                        │  Connect Wallet   │
                        └─────────┬─────────┘
                                  │
                                  ▼
                        ┌───────────────────┐
                        │   Arvo Platform   │
                        │                   │
                        │ Select Blockchain │
                        │ Create Vault      │
                        │ Deposit Assets    │
                        └─────────┬─────────┘
                                  │
                                  ▼
                   ┌──────────────────────────┐
                   │   Chain-Specific Vault   │
                   │      Smart Contract      │
                   └────────────┬─────────────┘
                                │
                    Agent submits Trade Intent
                                │
                                ▼
                 ┌────────────────────────────┐
                 │         Arvo Core          │
                 └─────────────┬──────────────┘
                               │
                   ┌───────────┴───────────┐
                   │                       │
                   ▼                       ▼
          ┌────────────────┐      ┌────────────────┐
          │  Trade Engine  │      │  Risk Engine   │
          │                │      │                │
          │ Execute Trade  │      │ Assess Risk    │
          └───────┬────────┘      └───────┬────────┘
                  │                       │
                  ▼                       ▼
           Trade Executed           Risk Report
                                          │
                                          ▼
                               ┌────────────────────┐
                               │    Arvo Backend    │
                               │                    │
                               │ Validate Coverage  │
                               │ Calculate Terms    │
                               └─────────┬──────────┘
                                         │
                                         ▼
                              ┌──────────────────┐
                              │ Smart Contract   │
                              │                  │
                              │ Deduct Premium   │
                              │ Apply Coverage   │
                              │ Lock Assets      │
                              └──────────────────┘
