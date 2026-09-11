import type { InsuranceItem } from "@/types/dashboard";

export function RiskMonitor({ insurance }: { insurance: InsuranceItem[] }) {
  return (
    <div className="space-y-4 rounded-[22px] border border-white/10 bg-[#0b120f] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">Automation mode</span>
        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-medium uppercase text-emerald-300">
          Active
        </span>
      </div>

      <div className="space-y-3 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>Rebalance threshold</span>
          <span className="text-[#edf5ee]">5%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Last rebalance</span>
          <span className="text-[#edf5ee]">2h ago</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Risk engine</span>
          <span className="text-emerald-300">Healthy</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Locked assets</span>
          <span className="text-[#edf5ee]">$1.82M</span>
        </div>
      </div>

      <div className="pt-3">
        <p className="mb-2 text-[10px] uppercase text-slate-400">Coverage</p>
        <div className="space-y-3">
          {insurance.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0c140f] p-3"
            >
              <span className="text-sm text-slate-300">{item.label}</span>
              <div className="text-right">
                <p className="font-medium text-[#edf5ee]">{item.value}</p>
                <p
                  className={`text-xs ${
                    item.tone === "emerald"
                      ? "text-emerald-300"
                      : item.tone === "amber"
                        ? "text-amber-300"
                        : "text-cyan-300"
                  }`}
                >
                  {item.change}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
