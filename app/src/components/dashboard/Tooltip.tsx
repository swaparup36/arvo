import type { ReactNode } from "react";

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group/tooltip relative inline-flex items-center">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[200px] -translate-x-1/2 rounded-lg border border-[#99e836]/20 bg-[#0f1714] px-2.5 py-1.5 text-center text-[11px] font-normal leading-snug text-slate-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover/tooltip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
