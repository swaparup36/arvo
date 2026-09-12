import type { Position } from "@/types/dashboard";

export function PositionsPanel({ positions }: { positions: Position[] }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
          Positions
        </h2>
      </div>

      {positions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#99e836]/15 bg-transparent p-6 text-center text-sm text-slate-400">
          No open positions for this vault yet.
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map((position) => (
            <div
              key={position.id}
              className="rounded-2xl border border-[#99e836]/10 bg-transparent p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#edf5ee]">
                    {position.pair}
                  </p>
                  <p className="text-xs text-slate-400">
                    In {position.amountIn} · Out {position.amountOut}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xs ${
                      position.status === "Active"
                        ? "text-emerald-300"
                        : "text-slate-400"
                    }`}
                  >
                    {position.status}
                  </p>
                  <p className="text-xs text-slate-500">{position.openedAt}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
