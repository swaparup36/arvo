import { Spinner } from "@/components/dashboard/Spinner";
import type { Position } from "@/types/dashboard";

export function PositionsPanel({
  positions,
  selectedInsuranceId,
  onSelect,
  isLoading,
}: {
  positions: Position[];
  selectedInsuranceId: string | null;
  onSelect: (insuranceId: string | null) => void;
  isLoading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
          Positions
        </h2>
      </div>

      {isLoading ? (
        <Spinner label="Loading positions..." />
      ) : positions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#99e836]/15 bg-transparent p-6 text-center text-sm text-slate-400">
          No open positions for this vault yet.
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map((position) => {
            const selected =
              position.insuranceId !== null &&
              position.insuranceId === selectedInsuranceId;

            return (
            <button
              key={position.id}
              type="button"
              onClick={() =>
                onSelect(selected ? null : position.insuranceId)
              }
              className={`w-full rounded-2xl border bg-transparent p-3 text-left transition ${
                selected
                  ? "border-[#99e836]/60 bg-[#99e836]/5"
                  : "border-[#99e836]/10 hover:border-[#99e836]/30"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#edf5ee]">
                    {position.pair}
                  </p>
                  <p className="text-xs text-slate-400">
                    In {position.amountIn} · Out {position.amountOut}
                  </p>
                  <p className="mt-1 text-xs">
                    <span className="text-slate-500">P/L </span>
                    {position.pnl === null ? (
                      <span className="text-slate-500" title="No routable liquidity to price this pair">
                        unpriced
                      </span>
                    ) : (
                      <span
                        className={
                          (position.pnlPercent ?? 0) < 0
                            ? "text-red-300"
                            : "text-emerald-300"
                        }
                      >
                        {position.pnl}
                        {position.pnlPercent === null
                          ? ""
                          : ` (${position.pnlPercent > 0 ? "+" : ""}${position.pnlPercent.toFixed(2)}%)`}
                      </span>
                    )}
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
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
