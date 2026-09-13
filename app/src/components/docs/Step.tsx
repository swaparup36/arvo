import type { ReactNode } from "react";

export function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-white/10 pt-10">
      <div className="flex items-baseline gap-2.5">
        <span aria-hidden className="font-mono text-[13px] text-[#99e836]">
          {index}.
        </span>
        <h2 className="scroll-mt-20 text-[1.35rem] font-semibold tracking-tight text-[#edf5ee]">
          {title}
        </h2>
      </div>
      <div className="mt-4 text-[15px] leading-7 text-slate-300">{children}</div>
    </section>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[13px] text-[#c4f57a]">
      {children}
    </code>
  );
}
