import Link from "next/link";

import type { Agent } from "@/types/dashboard";

export function AgentsPanel({
  agents,
  agentPage,
  agentTotalPages,
  onPrev,
  onNext,
  selectedAgentAddress,
  onAgentSelect,
}: {
  agents: Agent[];
  agentPage: number;
  agentTotalPages: number;
  onPrev: () => void;
  onNext: () => void;
  selectedAgentAddress: string | null;
  onAgentSelect: (address: string) => void;
}) {
  return (
    <div className="rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase text-[#afc4b3]">Agents</p>
          <h2 className="mt-2 text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
            Active agents
          </h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/docs/connect-agents"
            className="rounded-full bg-[#99e836] px-3 py-2 text-[10px] font-semibold text-[#05110b] shadow-[0_12px_20px_rgba(153,232,54,0.18)] transition hover:bg-[#b5ef64]"
          >
            + Add Agent
          </Link>
          <p className="max-w-[10rem] text-right text-[10px] leading-snug text-slate-400">
            {selectedAgentAddress
              ? "Trade intents filtered to this agent. Click again to clear."
              : "Select an agent to filter trade intents."}
          </p>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#99e836]/15 bg-transparent p-6 text-center text-sm text-slate-400">
          No agents registered for this vault yet. Bind one from{" "}
          <a href="/docs/connect-agents" className="text-[#99e836] hover:underline">
            connect agents
          </a>
          .
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {agents.map((agent) => (
            <button
              type="button"
              key={agent.address}
              onClick={() => onAgentSelect(agent.address)}
              aria-pressed={selectedAgentAddress === agent.address}
              className={`group w-full rounded-2xl border border-[#99e836]/8 bg-transparent p-3 text-left transition hover:-translate-y-0.5 hover:border-[#99e836]/20 ${
                selectedAgentAddress === agent.address
                  ? "ring-1 ring-[#99e836]/50"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#99e836]/20 bg-[#99e836]/10 text-xs font-medium text-[#c4f57a]">
                    {agent.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[1.1rem] font-medium leading-none text-[#edf5ee]">
                      {agent.name}
                    </p>
                    <p className="mt-1 text-[0.95rem] leading-relaxed text-slate-300">
                      {agent.address.length > 10
                        ? `${agent.address.slice(0, 6)}...${agent.address.slice(-4)}`
                        : agent.address}
                    </p>
                  </div>
                </div>

                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                    agent.vaultAddress
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {agent.vaultAddress ? "Bound" : "Unbound"}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-[0.7rem] uppercase text-slate-300">
                <span>
                  {agent.vaultAddress
                    ? `Vault ${agent.vaultAddress.slice(0, 6)}...${agent.vaultAddress.slice(-4)}`
                    : "No vault bound"}
                </span>
                <span>{agent.createdAt}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-[#99e836]/10 pt-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={agentPage === 1}
          className="rounded-full border border-[#99e836]/15 bg-[#111915] px-3 py-2 text-xs font-medium uppercase text-[#c4f57a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-xs uppercase text-slate-400">
          Page {agentPage} / {agentTotalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={agentPage === agentTotalPages}
          className="rounded-full border border-[#99e836]/15 bg-[#111915] px-3 py-2 text-xs font-medium uppercase text-[#c4f57a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
