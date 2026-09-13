"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const docsNav = [
  {
    section: "Getting started",
    items: [
      { href: "/docs/how-it-works", title: "How it works" },
      { href: "/docs/connect-agents", title: "Connect agents" },
      { href: "/docs/mcp-server", title: "MCP server" },
    ],
  },
] as const;

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Docs" className="text-sm">
      {docsNav.map((group) => (
        <div key={group.section} className="mb-6">
          <p className="mb-2 font-semibold text-[#edf5ee]">{group.section}</p>
          <ul className="border-l border-white/10">
            {group.items.map((item) => {
              const isActive = pathname === item.href;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`-ml-px block border-l py-1.5 pl-4 transition ${
                      isActive
                        ? "border-[#99e836] text-[#c4f57a]"
                        : "border-transparent text-slate-400 hover:border-white/30 hover:text-slate-200"
                    }`}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
