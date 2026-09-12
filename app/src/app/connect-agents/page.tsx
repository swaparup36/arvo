"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

const tools = [
  {
    name: "post-trade-intent",
    description:
      "Signs a trade intent with the agent wallet and submits it for insurance and execution.",
  },
  {
    name: "get-token-balance",
    description: "Reads the balance of one token held by the bound vault.",
  },
  {
    name: "get-all-tokens",
    description: "Lists every token the bound vault currently holds.",
  },
];

function CopyBlock({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-3">
      {label ? (
        <div className="mb-1.5 text-[11px] text-slate-400">{label}</div>
      ) : null}
      <div className="relative rounded-xl border border-white/10 bg-[#101915]">
        <pre className="overflow-x-auto px-3 py-2.5 pr-20 font-mono text-[12px] leading-relaxed text-[#edf5ee]">
          {value}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-2 top-2 rounded-lg border border-[#99e836]/20 bg-[#0b120f] px-2.5 py-1 text-[11px] text-[#99e836] transition hover:border-[#99e836]/50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#99e836]/20 bg-[#0b120f] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#99e836]/30 bg-[#99e836]/10 text-xs font-semibold text-[#c4f57a]">
          {index}
        </div>
        <h2 className="text-[0.96rem] font-medium text-[#99e836]">{title}</h2>
      </div>
      <div className="mt-3 text-xs leading-relaxed text-slate-300">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-[#101915] px-1 py-0.5 font-mono text-[11px] text-[#c4f57a]">
      {children}
    </code>
  );
}

export default function ConnectAgentsPage() {
  const [origin, setOrigin] = useState("https://your-arvo-deployment");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const mcpUrl = `${origin}/api/mcp/resources`;

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
                <div className="text-sm text-slate-300">Connect agents</div>
              </div>
            </div>
            <Link
              href="/"
              className="rounded-full border border-[#99e836]/12 bg-[#101915] px-3 py-2.5 text-sm text-slate-300 transition hover:border-[#99e836]/50 hover:text-[#c4f57a]"
            >
              Dashboard
            </Link>
          </nav>
        </header>

        <div className="rounded-[28px] border border-[#99e836]/20 bg-[#0b120f] p-6">
          <h1 className="text-[clamp(1.6rem,2.2vw,2.2rem)] font-medium leading-[1] text-[#99e836]">
            Connect your agent to Arvo
          </h1>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            Arvo exposes an MCP server over HTTP. Any MCP client - Claude Code,
            Claude Desktop, Cursor, or your own agent - can connect to it, sign
            in with your wallet, and trade from a vault you choose. The handshake
            is OAuth 2.1 with PKCE, so your private key never leaves your wallet.
          </p>
        </div>

        <div className="mt-5 space-y-5">
          <Step index={1} title="Create a vault first">
            An agent can only be bound to a vault you already own. Open the{" "}
            <Link href="/#vaults" className="text-[#99e836] hover:underline">
              dashboard
            </Link>
            , connect your wallet, pick a chain and deploy a vault. Without one,
            the approval screen will have nothing to select.
          </Step>

          <Step index={2} title="Copy the MCP server URL">
            This is the only endpoint your client needs. Discovery, authorization
            and token endpoints are advertised from it automatically.
            <CopyBlock value={mcpUrl} />
          </Step>

          <Step index={3} title="Add the server to your client">
            Transport is streamable HTTP, not stdio, so there is nothing to
            install locally.
            <CopyBlock
              label="Claude Code (CLI)"
              value={`claude mcp add --transport http arvo ${mcpUrl}`}
            />
            <CopyBlock
              label="Claude Desktop / Cursor / any JSON config"
              value={`{
  "mcpServers": {
    "arvo": {
      "type": "http",
      "url": "${mcpUrl}"
    }
  }
}`}
            />
          </Step>

          <Step index={4} title="Approve the agent in your browser">
            On the first call your client receives a <Code>401</Code> pointing at
            Arvo&apos;s OAuth metadata, registers itself, and opens the Arvo
            consent screen. There you:
            <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-400">
              <li>connect the wallet that owns the vault,</li>
              <li>choose the chain and the vault the agent may trade for,</li>
              <li>
                sign a plain message - no gas, no transaction - to prove
                ownership.
              </li>
            </ul>
            <p className="mt-2">
              Approving creates a dedicated agent wallet bound to that vault and
              hands your client a short-lived access token. Denying sends the
              client back with an <Code>access_denied</Code> error and nothing is
              created.
            </p>
          </Step>

          <Step index={5} title="Check the tools are live">
            Ask your agent to list its tools. You should see three:
            <div className="mt-3 space-y-2">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="rounded-xl border border-white/10 bg-[#101915] px-3 py-2.5"
                >
                  <div className="font-mono text-[12px] text-[#c4f57a]">
                    {tool.name}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {tool.description}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3">
              Start with something read-only, for example: &quot;list every token
              in my Arvo vault on Sepolia&quot;.
            </p>
          </Step>

          <Step index={6} title="If something goes wrong">
            <ul className="list-disc space-y-1 pl-4 text-slate-400">
              <li>
                <span className="text-slate-300">No vaults to select</span> -
                your wallet owns none on the chosen chain. Deploy one from the
                dashboard, then reopen the consent screen.
              </li>
              <li>
                <span className="text-slate-300">Missing authorization key</span>{" "}
                - the pending request expired after 10 minutes. Restart the
                connection from your client.
              </li>
              <li>
                <span className="text-slate-300">Tools stop working later</span>{" "}
                - access tokens expire. Reconnect the server and approve again.
              </li>
              <li>
                <span className="text-slate-300">Wrong wallet connected</span> -
                only the vault owner can approve. Disconnect and reconnect with
                the owning wallet.
              </li>
            </ul>
          </Step>
        </div>

        <p className="mt-6 pb-10 text-center text-[11px] text-slate-500">
          Agents trade only from the vault you bind them to, and every intent is
          signed and insured before execution.
        </p>
      </div>
    </main>
  );
}
