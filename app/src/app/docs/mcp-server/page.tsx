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
    <section className="border-t border-white/10 pt-10">
      <h3
        id={tool.name}
        className="scroll-mt-20 font-mono text-[1.15rem] font-semibold text-[#c4f57a]"
      >
        {tool.name}
      </h3>
      <p className="mt-2 text-[15px] leading-7 text-slate-300">
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
                <td className="py-2 text-[15px] leading-7 text-slate-300">
                  {param.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[15px] leading-7 text-slate-300">
        <span className="font-medium text-[#edf5ee]">Returns —</span>{" "}
        {tool.returns}
      </p>

      <ul className="mt-3 list-disc space-y-1 pl-4 text-[15px] leading-7 text-slate-400">
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
    <>
      <div className="pb-12">
          <h1 className="text-[clamp(2.2rem,3.4vw,3rem)] font-semibold leading-[1.05] tracking-tight text-[#edf5ee]">
            MCP server reference
          </h1>
          <p className="mt-5 text-[17px] leading-8 text-slate-400">
            Arvo&apos;s MCP server gives an agent four tools: one to price a
            swap, two to read the vault, and one to trade. Every call is scoped
            to the vault you bound at approval time, so an agent can only move
            funds you explicitly handed it.
          </p>

          <pre className="mt-5 overflow-x-auto rounded-lg border border-white/10 bg-[#0d1411] px-4 py-3 font-mono text-[13px] text-[#edf5ee]">
            {mcpUrl}
          </pre>

          <p className="mt-3 text-[15px] leading-7 text-slate-400">
            Streamable HTTP, OAuth 2.1 with PKCE.{" "}
            <Link
              href="/docs/connect-agents"
              className="text-[#99e836] hover:underline"
            >
              Connecting an agent
            </Link>{" "}
            walks through the handshake.
          </p>
        </div>

        <div className="mt-10 border-t border-white/10 pt-8">
          <h2 className="text-[1.05rem] font-semibold text-[#edf5ee]">
            The tools
          </h2>
          <ul className="mt-4 space-y-1.5">
            {tools.map((tool) => (
              <li key={tool.name}>
                <a
                  href={`#${tool.name}`}
                  className="font-mono text-[14px] text-[#c4f57a] hover:underline"
                >
                  {tool.name}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[15px] leading-7 text-slate-400">
            All parameters are required — none of the schemas declare optionals.
            Token amounts are whole units (1.5 USDC, not 1500000); Arvo applies
            each token&apos;s decimals server-side.
          </p>
        </div>

        <div className="mt-10 space-y-10">
          {tools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>

        <section className="mt-10 border-t border-white/10 pt-8">
          <h2 className="text-[1.05rem] font-semibold text-[#edf5ee]">
            Chain IDs
          </h2>
          <dl className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {chains.map((chain) => (
              <div
                key={chain.id}
                className="flex items-center justify-between py-2.5 text-[15px]"
              >
                <dt className="text-slate-300">{chain.name}</dt>
                <dd className="font-mono text-[13px] text-[#c4f57a]">
                  {chain.id}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10 border-t border-white/10 pt-8">
          <h2 className="text-[1.05rem] font-semibold text-[#edf5ee]">
            A typical run
          </h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[15px] leading-7 text-slate-300">
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

        <section className="mt-10 border-t border-white/10 pt-8">
          <h2 className="text-[1.05rem] font-semibold text-[#edf5ee]">Errors</h2>
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
    </>
  );
}
