import type { Position } from "@/types/dashboard";

export function PortfolioPanel({ positions }: { positions: Position[] }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
          Portfolio
        </h2>
      </div>
      <div className="space-y-4">
        {positions.map((position) => (
          <div
            key={`${position.asset}-${position.size}`}
            className="rounded-2xl border border-[#99e836]/10 bg-transparent p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#edf5ee]">
                  {position.asset}
                </p>
                <p className="text-xs text-slate-400">{position.size}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-[#edf5ee]">{position.value}</p>
                <p
                  className={`text-xs ${
                    position.status === "Locked"
                      ? "text-amber-300"
                      : position.status === "Expiring"
                        ? "text-red-300"
                        : "text-emerald-300"
                  }`}
                >
                  {position.status}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
