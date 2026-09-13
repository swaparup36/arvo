import { Spinner } from "@/components/dashboard/Spinner";
import type { InsuranceItem } from "@/types/dashboard";

function shorten(value: string) {
  return value.length > 14 ? `${value.slice(0, 10)}...${value.slice(-4)}` : value;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="truncate text-slate-300">{value}</span>
    </div>
  );
}

export function RiskMonitor({
  insurance,
  selectedInsuranceId,
  onSelect,
  onAction,
  pendingInsuranceId,
  isLoading,
}: {
  insurance: InsuranceItem[];
  selectedInsuranceId: string | null;
  onSelect: (insuranceId: string | null) => void;
  onAction: (item: InsuranceItem, action: "claim" | "invalidate") => void;
  pendingInsuranceId: string | null;
  isLoading: boolean;
}) {
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

      {isLoading ? (
        <Spinner label="Loading insurances..." />
      ) : insurance.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#0c140f] p-4 text-center text-sm text-slate-400">
          No insured trade intents submitted by your agent yet.
        </div>
      ) : (
        <div className="space-y-3">
          {insurance.map((item) => {
            const selected = item.id === selectedInsuranceId;

            const pending = pendingInsuranceId === item.id;

            return (
            <div
              key={item.id}
              className={`rounded-xl border bg-[#0c140f] transition ${
                selected
                  ? "border-[#99e836]/60 bg-[#99e836]/5"
                  : "border-white/10 hover:border-[#99e836]/30"
              }`}
            >
            <button
              type="button"
              onClick={() => onSelect(selected ? null : item.id)}
              className="w-full p-3 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-slate-300" title={item.id}>
                  Policy {shorten(item.id)}
                </span>
                <span
                  className={`shrink-0 text-xs ${
                    item.valid ? "text-emerald-300" : "text-slate-500"
                  }`}
                >
                  {item.valid ? "Active" : "Invalidated"}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <Row label="Premium" value={item.premium} />
                <Row label="Coverage" value={item.coverage} />
                <Row label="Coverage duration" value={item.duration} />
                <Row
                  label="Position"
                  value={item.positionId ? shorten(item.positionId) : "—"}
                />
              </div>
            </button>

            {selected ? (
              <div className="flex gap-2 border-t border-white/10 px-3 py-2">
                <button
                  type="button"
                  disabled={pending || !item.valid}
                  onClick={() => onAction(item, "claim")}
                  className="flex-1 rounded-lg bg-[#99e836]/15 px-3 py-2 text-xs font-medium text-[#99e836] transition hover:bg-[#99e836]/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending ? "Working..." : "Claim"}
                </button>
                <button
                  type="button"
                  disabled={pending || !item.valid}
                  onClick={() => onAction(item, "invalidate")}
                  className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-red-400/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending ? "Working..." : "Invalidate"}
                </button>
              </div>
            ) : null}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
