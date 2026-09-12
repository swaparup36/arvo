import type { TradeIntent } from "@/types/dashboard";

export function TradeIntentsPanel({
  intents,
  intentPage,
  intentTotalPages,
  onPrev,
  onNext,
}: {
  intents: TradeIntent[];
  intentPage: number;
  intentTotalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      id="intents"
      className="rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase text-[#afc4b3]">Queue</p>
          <h2 className="mt-2 text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
            Trade intents
          </h2>
        </div>
      </div>

      {intents.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#99e836]/15 bg-transparent p-6 text-center text-sm text-slate-400">
          No trade intents submitted for this agent yet.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {intents.map((intent, index) => (
            <article
              key={`${intent.pair}-${intent.eta}-${index}`}
              className="group rounded-[22px] border border-[#99e836]/8 bg-transparent p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[#99e836]/20"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-[#afc4b3]">
                    {intent.agent}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[#edf5ee]">
                    {intent.pair}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                    intent.status === "Queued"
                      ? "bg-slate-700 text-slate-200"
                      : intent.status === "Review"
                        ? "bg-amber-500/15 text-amber-300"
                        : intent.status === "Approved"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-sky-500/15 text-sky-300"
                  }`}
                >
                  {intent.status}
                </span>
              </div>

              <div className="mt-5 flex items-center justify-between text-[0.95rem] text-slate-200">
                <span>Swap</span>
                <span className="text-[1.15rem] font-semibold text-[#edf5ee]">
                  {intent.amount}
                </span>
              </div>

              <div className="mt-4 border-t border-[#99e836]/8 pt-3 text-[0.7rem] uppercase text-slate-300">
                <div className="flex items-center justify-between">
                  <span>ETA</span>
                  <span>{intent.eta}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-[#99e836]/10 pt-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={intentPage === 1}
          className="rounded-full border border-[#99e836]/15 bg-[#111915] px-3 py-2 text-xs font-medium uppercase text-[#c4f57a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-xs uppercase text-slate-400">
          Page {intentPage} / {intentTotalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={intentPage === intentTotalPages}
          className="rounded-full border border-[#99e836]/15 bg-[#111915] px-3 py-2 text-xs font-medium uppercase text-[#c4f57a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
