"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Code, Step } from "@/components/docs/Step";

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
          className="absolute right-2 top-2 rounded-lg border border-white/10 bg-[#0b120f] px-2.5 py-1 text-[11px] text-[#99e836] transition hover:border-white/25"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function ConnectAgentsPage() {
  const [origin, setOrigin] = useState("https://your-arvo-deployment");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const mcpUrl = `${origin}/api/mcp/resources`;

  return (
    <>
      <div className="pb-12">
          <h1 className="text-[clamp(2.2rem,3.4vw,3rem)] font-semibold leading-[1.05] tracking-tight text-[#edf5ee]">
            Connect your agent to Arvo
          </h1>
          <p className="mt-5 text-[17px] leading-8 text-slate-400">
            Arvo exposes an MCP server over HTTP. Any MCP client - Claude Code,
            Claude Desktop, Cursor, or your own agent - can connect to it, sign
            in with your wallet, and trade from a vault you choose. The handshake
            is OAuth 2.1 with PKCE, so your private key never leaves your wallet.
          </p>
        </div>

        <div className="mt-10 space-y-10">
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
            <dl className="mt-4 space-y-3">
              {tools.map((tool) => (
                <div key={tool.name}>
                  <dt className="font-mono text-[14px] text-[#c4f57a]">
                    {tool.name}
                  </dt>
                  <dd className="mt-0.5 text-[14px] leading-6 text-slate-400">
                    {tool.description}
                  </dd>
                </div>
              ))}
            </dl>
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
    </>
  );
}
