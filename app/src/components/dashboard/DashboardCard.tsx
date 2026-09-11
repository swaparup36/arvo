import type { ReactNode } from "react";

export function DashboardCard({
  title,
  children,
  className = "",
  titleClassName = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <section
      className={`rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          className={`text-[0.96rem] font-medium text-[#99e836] ${titleClassName}`}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
