export function Spinner({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-[#99e836]/15 bg-transparent p-6 text-sm text-slate-400"
    >
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-[#99e836]/25 border-t-[#99e836]"
      />
      {label}
    </div>
  );
}
