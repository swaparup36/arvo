import type { InsuranceItem } from "@/types/dashboard";

export function RiskMonitor({ insurance }: { insurance: InsuranceItem[] }) {
  const activeCount = insurance.filter((item) => item.valid).length;

  return (
    <div className="space-y-4 rounded-[22px] border border-white/10 bg-[#0b120f] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">
          Agent&apos;s insured trade intents
        </span>
        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-medium uppercase text-emerald-300">
          {activeCount} / {insurance.length} active
        </span>
      </div>

      {insurance.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#0c140f] p-4 text-center text-sm text-slate-400">
          No insured trade intents submitted by your agent yet.
        </div>
      ) : (
        <div className="space-y-3">
          {insurance.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 bg-[#0c140f] p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Policy {item.id.slice(0, 8)}...
                </span>
                <span
                  className={`text-xs ${
                    item.valid ? "text-emerald-300" : "text-slate-500"
                  }`}
                >
                  {item.valid ? "Active" : "Invalidated"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Coverage {item.coverage}</span>
                <span>Premium {item.premium}</span>
                <span>{item.duration}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
