import Link from "next/link";

import { Code, Step } from "@/components/docs/Step";

const rejections = [
  ["Risk assessment has expired", "the assessment's expiresAt is in the past"],
  ["Coverage duration is zero", "the assessment offered no coverage window"],
  [
    "Premium exceeds maximum",
    "the quoted premium is above the maxPremium in the intent",
  ],
  [
    "Coverage is below minimum",
    "the offered coverage is under the intent's minCoverage",
  ],
  [
    "Coverage duration is below minimum",
    "the window is shorter than minCoverageDuration",
  ],
  ["Risk score is too high", "the score is above 70"],
];

export default function HowItWorksPage() {
  return (
    <>
      <div className="pb-12">
        <h1 className="text-[clamp(2.2rem,3.4vw,3rem)] font-semibold leading-[1.05] tracking-tight text-[#edf5ee]">
          How it works
        </h1>
        <p className="mt-5 text-[17px] leading-8 text-slate-400">
          Arvo lets an agent trade from a vault you own without ever holding
          your funds. Every trade is executed and independently risk-assessed in
          parallel, and the contract only insures the result if both halves
          agree on terms you set up front. This is the whole path, from landing
          on the site to getting your balance back.
        </p>
      </div>

      <Step index={1} title="Connect your wallet">
        You arrive at the dashboard and connect a wallet. Arvo signs you in with
        a message you sign in your own wallet — there is no password and no
        custody. Your address becomes your account; everything below hangs off
        it.
      </Step>

      <Step index={2} title="Create a vault">
        A vault is a contract that holds your funds and only takes orders from
        you and from the Arvo protocol contract. Deploying one calls{" "}
        <Code>createVault</Code> on the vault factory for the chain you picked,
        and you become its owner. You can deploy as many as you like — the
        factory keeps the list under <Code>getUserVaults</Code>, which is what
        the dashboard reads.
      </Step>

      <Step index={3} title="Deposit tokens">
        Fund the vault with <Code>depositETH</Code> or{" "}
        <Code>depositToken</Code>. Only the owner can deposit or withdraw, and
        withdrawals are limited to the vault&apos;s{" "}
        <em className="not-italic text-[#edf5ee]">available</em> balance — the
        total minus anything locked behind an open position. The dashboard shows
        both numbers per token.
      </Step>

      <Step index={4} title="Connect an agent to the vault">
        An agent connects over Arvo&apos;s MCP server using OAuth 2.1 with PKCE.
        At approval time you choose which vault the agent is bound to, and Arvo
        mints the agent its own wallet. That binding is fixed: none of the
        agent&apos;s tools take a vault parameter, so it can only ever move funds
        from the vault you handed it.{" "}
        <Link
          href="/docs/connect-agents"
          className="text-[#99e836] hover:underline"
        >
          Connecting an agent
        </Link>{" "}
        walks through it.
      </Step>

      <Step index={5} title="The agent posts a trade intent">
        When the agent wants to trade, it calls <Code>post-trade-intent</Code>{" "}
        with the pair, the amount, a deadline, and the terms it will accept: a
        maximum premium, a minimum coverage percentage, and a minimum coverage
        duration. The agent&apos;s wallet signs the payload as EIP-712 typed
        data, so the request cannot be forged on its behalf. Arvo records the
        intent and submits it on-chain with <Code>submitTradeIntent</Code>,
        where it sits in <Code>PENDING</Code>. If the chain submission fails the
        intent is rolled back and nothing is queued.
      </Step>

      <Step index={6} title="The intent fans out to two engines">
        The stored intent goes onto two Redis channels at once — a{" "}
        <Code>trade_execution_queue</Code> list for the trade engine and an{" "}
        <Code>arvo:trade-intents</Code> stream for the risk engine. The two run
        independently and neither waits on the other. That is the point: the
        party executing the trade is not the party pricing its risk.
      </Step>

      <Step index={7} title="The trade engine executes the swap">
        The trade engine picks the intent off the queue, routes the swap, and
        executes it against your vault, respecting the{" "}
        <Code>minAmountOut</Code> floor in the intent. When it settles, the
        engine posts a signed trade confirmation back to Arvo — the transaction
        hash, the tokens, and the exact amounts in and out — which Arvo forwards
        on-chain via <Code>submitTradeConfirmation</Code>.
      </Step>

      <Step index={8} title="The risk engine prepares an assessment">
        In parallel the risk engine reads the same intent and produces a risk
        report: a risk score from 0 to 100, the premium it would charge, the
        coverage percentage it would issue, and how long that coverage holds. It
        signs the report and posts it to Arvo, which lands it on-chain with{" "}
        <Code>submitRiskAssessment</Code>. Each assessment carries an expiry, so
        a stale quote cannot be redeemed later.
      </Step>

      <Step index={9} title="The contract decides whether to insure">
        A trade intent becomes evaluatable once the intent, the confirmation and
        the assessment are all on-chain — so whichever of the two engines
        reports second triggers <Code>evaluateTradeIntent</Code> automatically.
        The contract then checks the assessment against the terms the agent
        committed to in the intent, and rejects the trade if any of these hold:
        <dl className="mt-4 divide-y divide-white/10 border-y border-white/10">
          {rejections.map(([reason, detail]) => (
            <div key={reason} className="py-2.5">
              <dt className="text-[15px] text-[#edf5ee]">{reason}</dt>
              <dd className="mt-0.5 text-[14px] leading-6 text-slate-400">
                {detail}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4">
          A rejected intent is marked <Code>REJECTED</Code> and stops there — the
          swap may already have happened, but it carries no coverage. Nothing is
          locked and no premium is taken.
        </p>
      </Step>

      <Step index={10} title="Insurance is issued and a position opens">
        If every check passes the contract issues an insurance record against the
        intent and opens a position holding the tokens and amounts from the trade
        confirmation. Two things then happen inside your vault: the output
        amount is locked with <Code>lockAsset</Code>, and the premium is pulled
        with <Code>deductPremium</Code>. The intent flips to{" "}
        <Code>APPROVED</Code>.
      </Step>

      <Step index={11} title="Locked balance, and how to get it back">
        Locked funds stay yours — they sit in your vault and show up in the
        dashboard as the locked share of that token — but they cannot be
        withdrawn while the position is open, because they are the collateral
        the coverage is written against.
        <p className="mt-4">
          To free them, invalidate the insurance. Only you or the protocol owner
          can call <Code>invalidateInsurance</Code>. It marks the insurance
          invalid, deactivates the position, and calls{" "}
          <Code>unlockAsset</Code> on your vault, returning the locked amount to
          your available balance. From that point the trade is uninsured and the
          funds are withdrawable again.
        </p>
      </Step>

      <p className="mt-10 border-t border-white/10 pt-6 text-[15px] leading-7 text-slate-400">
        The shape of the whole thing: you hold the keys, the agent holds a
        scoped binding, the two engines never trust each other, and the contract
        is the only thing that can move funds between them.
      </p>
    </>
  );
}
