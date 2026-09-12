import Link from "next/link";

import { env } from "@/lib/env";

type Param = {
  name: string;
  type: string;
  description: string;
};

type Tool = {
  name: string;
  summary: string;
  params: Param[];
  returns: string;
  notes: string[];
};

// Mirrors the registrations in src/app/api/mcp/resources/route.ts. Every field is
// required: none of the tool schemas declare optionals.
const tools: Tool[] = [
  {
    name: "post-trade-intent",
    summary:
      "Submits a trade for execution. The agent signs the trade with its own wallet, Arvo records the intent, submits it on-chain and queues it for risk assessment and insurance.",
    params: [
      { name: "chainId", type: "number", description: "Chain the trade runs on." },
      { name: "tokenIn", type: "string", description: "Address of the token being sold." },
      { name: "tokenOut", type: "string", description: "Address of the token being bought." },
      { name: "amountIn", type: "number", description: "Amount of tokenIn to swap, in whole units — Arvo converts to the token's decimals." },
      { name: "minAmountOut", type: "number", description: "Slippage floor: the trade must return at least this much tokenOut." },
      { name: "deadline", type: "string", description: "ISO 8601 timestamp after which the intent is no longer valid." },
      { name: "maxPremium", type: "number", description: "Most the agent will pay for insurance, in USDC." },
      { name: "minCoverage", type: "number", description: "Share of the trade that must be covered, 1-100." },
      { name: "minCoverageDuration", type: "number", description: "How long the coverage must hold, in seconds." },
    ],
    returns:
      "The stored trade intent and the on-chain transaction hash. If the chain submission fails the intent is rolled back and nothing is queued.",
    notes: [
      "The vault is not a parameter — the trade always runs against the vault bound at approval time.",
      "The agent's key signs the payload, so a trade cannot be forged on its behalf.",
    ],
  },
  {
    name: "get-token-balance",
    summary: "Reads how much of one token the bound vault currently holds.",
    params: [
      { name: "chainId", type: "number", description: "Chain to read the balance on." },
      { name: "tokenAddress", type: "string", description: "Address of the token to check." },
    ],
    returns: "The vault's balance of that token.",
    notes: ["Uses the bound vault; there is no vault parameter to override it."],
  },
  {
    name: "get-all-tokens",
    summary: "Lists every token a vault holds, for surveying a portfolio before trading.",
    params: [
      { name: "chainId", type: "number", description: "Chain to read the vault on." },
      { name: "vaultAddress", type: "string", description: "Vault to inspect — pass the vault bound to the agent." },
    ],
    returns: "The token addresses held by that vault.",
    notes: [
      "Unlike the other tools this one reads whichever vault address you pass, so pass your own.",
    ],
  },
  {
    name: "get-quote",
    summary:
      "Prices a swap through Uniswap before committing to it. Use it to fill in minAmountOut on post-trade-intent.",
    params: [
      { name: "chainId", type: "number", description: "Chain to price the swap on." },
      { name: "tokenIn", type: "string", description: "Address of the token being sold." },
      { name: "tokenOut", type: "string", description: "Address of the token being bought." },
      { name: "amountIn", type: "number", description: "Amount of tokenIn to price." },
    ],
    returns: "The Uniswap quote for the pair, quoted for the bound vault.",
    notes: ["Read-only: quoting costs nothing and moves no funds."],
  },
];

const chains = [
  { name: "Ethereum", id: "1" },
  { name: "Sepolia", id: "11155111" },
  { name: "Base", id: "8453" },
  { name: "Arbitrum", id: "42161" },
  { name: "Optimism", id: "10" },
];

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <section
      id={tool.name}
      className="scroll-mt-24 rounded-[28px] border border-[#99e836]/20 bg-[#0b120f] p-5 sm:p-6"
    >
      <h3 className="font-mono text-[0.96rem] font-medium text-[#99e836]">
        {tool.name}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        {tool.summary}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/10 text-[11px] text-slate-400">
              <th className="py-2 pr-3 font-normal">Parameter</th>
              <th className="py-2 pr-3 font-normal">Type</th>
              <th className="py-2 font-normal">Description</th>
            </tr>
          </thead>
          <tbody>
            {tool.params.map((param) => (
              <tr
                key={param.name}
                className="border-b border-white/5 align-top last:border-0"
              >
                <td className="py-2 pr-3 font-mono text-[12px] text-[#c4f57a]">
                  {param.name}
                </td>
                <td className="py-2 pr-3 font-mono text-[11px] text-slate-400">
                  {param.type}
                </td>
                <td className="py-2 text-[11px] leading-relaxed text-slate-300">
                  {param.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-[#101915] px-3 py-2.5">
        <div className="text-[11px] text-slate-400">Returns</div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
          {tool.returns}
        </p>
      </div>

      <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-400">
        {tool.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

export default function McpServerDocsPage() {
  const mcpUrl = `${env.BASE_MCP_URL}/resources`;

  return (
    <main className="min-h-screen bg-[#050806] text-[#edf5ee]">
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 mb-6 rounded-3xl border border-[#99e836]/10 bg-[#0a120d]/60 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-md sm:px-6">
          <nav className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#99e836]/30 bg-[#99e836]/10 text-xs font-semibold text-[#c4f57a]">
                AR
              </div>
              <div>
                <div className="text-[10px] uppercase text-[#99e836]">Arvo</div>
                <div className="text-sm text-slate-300">MCP server</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/connect-agents"
                className="rounded-full border border-[#99e836]/12 bg-[#101915] px-3 py-2.5 text-sm text-slate-300 transition hover:border-[#99e836]/50 hover:text-[#c4f57a]"
              >
                Connect
              </Link>
              <Link
                href="/"
                className="rounded-full border border-[#99e836]/12 bg-[#101915] px-3 py-2.5 text-sm text-slate-300 transition hover:border-[#99e836]/50 hover:text-[#c4f57a]"
              >
                Dashboard
              </Link>
            </div>
          </nav>
        </header>

        <div className="rounded-[28px] border border-[#99e836]/20 bg-[#0b120f] p-6">
          <h1 className="text-[clamp(1.6rem,2.2vw,2.2rem)] font-medium leading-[1] text-[#99e836]">
            MCP server reference
          </h1>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            Arvo&apos;s MCP server gives an agent four tools: one to price a
            swap, two to read the vault, and one to trade. Every call is scoped
            to the vault you bound at approval time, so an agent can only move
            funds you explicitly handed it.
          </p>

          <div className="mt-4 rounded-xl border border-white/10 bg-[#101915] px-3 py-2.5">
            <div className="text-[11px] text-slate-400">Endpoint</div>
            <pre className="mt-1 overflow-x-auto font-mono text-[12px] text-[#edf5ee]">
              {mcpUrl}
            </pre>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Streamable HTTP, OAuth 2.1 with PKCE.{" "}
            <Link
              href="/connect-agents"
              className="text-[#99e836] hover:underline"
            >
              Connecting an agent
            </Link>{" "}
            walks through the handshake.
          </p>
        </div>

        <div className="mt-5 rounded-[28px] border border-[#99e836]/20 bg-[#0b120f] p-5 sm:p-6">
          <h2 className="text-[0.96rem] font-medium text-[#99e836]">
            The tools
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {tools.map((tool) => (
              <a
                key={tool.name}
                href={`#${tool.name}`}
                className="rounded-xl border border-white/10 bg-[#101915] px-3 py-2 font-mono text-[12px] text-[#c4f57a] transition hover:border-[#99e836]/50"
              >
                {tool.name}
              </a>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            All parameters are required — none of the schemas declare optionals.
            Token amounts are whole units (1.5 USDC, not 1500000); Arvo applies
            each token&apos;s decimals server-side.
          </p>
        </div>

        <div className="mt-5 space-y-5">
          {tools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>

        <section className="mt-5 rounded-[28px] border border-[#99e836]/20 bg-[#0b120f] p-5 sm:p-6">
          <h2 className="text-[0.96rem] font-medium text-[#99e836]">
            Chain IDs
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {chains.map((chain) => (
              <div
                key={chain.id}
                className="rounded-xl border border-white/10 bg-[#101915] px-3 py-2 text-[11px] text-slate-300"
              >
                {chain.name}{" "}
                <span className="font-mono text-[#c4f57a]">{chain.id}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#99e836]/20 bg-[#0b120f] p-5 sm:p-6">
          <h2 className="text-[0.96rem] font-medium text-[#99e836]">
            A typical run
          </h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-300">
            <li>
              <span className="font-mono text-[12px] text-[#c4f57a]">
                get-all-tokens
              </span>{" "}
              to see what the vault holds.
            </li>
            <li>
              <span className="font-mono text-[12px] text-[#c4f57a]">
                get-token-balance
              </span>{" "}
              to size the trade against one token.
            </li>
            <li>
              <span className="font-mono text-[12px] text-[#c4f57a]">
                get-quote
              </span>{" "}
              to price the swap and derive a sane{" "}
              <span className="font-mono text-[12px] text-[#c4f57a]">
                minAmountOut
              </span>
              .
            </li>
            <li>
              <span className="font-mono text-[12px] text-[#c4f57a]">
                post-trade-intent
              </span>{" "}
              to sign and submit it with the coverage terms you want.
            </li>
          </ol>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#99e836]/20 bg-[#0b120f] p-5 sm:p-6">
          <h2 className="text-[0.96rem] font-medium text-[#99e836]">Errors</h2>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-400">
            <li>
              <span className="text-slate-300">
                Agent not found for the provided userId and agentId
              </span>{" "}
              — the approval behind this token is gone. Reconnect the server and
              approve again.
            </li>
            <li>
              <span className="text-slate-300">API returned 4xx / 5xx</span> —
              the call reached Arvo but the vault or trade request was rejected;
              the message carries the status.
            </li>
            <li>
              <span className="text-slate-300">401 on every tool</span> — the
              access token expired. Tokens last an hour; reconnecting mints a new
              one.
            </li>
          </ul>
        </section>

        <p className="mt-6 pb-10 text-center text-[11px] text-slate-500">
          Tools are scoped to one vault per agent, and every trade is signed by
          the agent&apos;s own wallet before it is insured and executed.
        </p>
      </div>
    </main>
  );
}
