import type { Agent } from "@/types/dashboard";

export function AgentsPanel({
  agents,
  agentPage,
  agentTotalPages,
  onPrev,
  onNext,
}: {
  agents: Agent[];
  agentPage: number;
  agentTotalPages: number;
  onPrev: () => void;
  onNext: () => void;
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
      </div>

      <div className="mt-5 space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className="group rounded-2xl border border-[#99e836]/8 bg-transparent p-3 transition hover:-translate-y-0.5 hover:border-[#99e836]/20"
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
                    {agent.strategy}
                  </p>
                </div>
              </div>

              <span
                className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                  agent.status === "Active"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : agent.status === "Review"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-slate-700 text-slate-300"
                }`}
              >
                {agent.status}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-[0.7rem] uppercase text-slate-300">
              <span>{agent.risk}</span>
              <span>{agent.pnl}</span>
            </div>
          </div>
        ))}
      </div>

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
