export type StatTone = "emerald" | "cyan" | "violet" | "amber";

export function StatCard({
  label,
  value,
  change,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  tone: StatTone;
}) {
  return (
    <div className="rounded-[22px] border border-[#99e836]/8 bg-transparent p-4 shadow-none">
      <div className="flex items-center justify-between text-[#dfece2]">
        <span className="text-sm">{label}</span>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-medium ${
            tone === "emerald"
              ? "bg-emerald-500/15 text-emerald-300"
              : tone === "cyan"
                ? "bg-cyan-400/10 text-cyan-300"
                : tone === "violet"
                  ? "bg-violet-500/10 text-violet-300"
                  : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {change}
        </span>
      </div>
      <div className="mt-4 text-2xl font-semibold text-[#edf5ee]">{value}</div>
    </div>
  );
}
