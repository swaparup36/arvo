"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Heading = { id: string; text: string; level: number };

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function DocsToc() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    // ponytail: headings are read out of the rendered DOM, so a page needs no
    // TOC wiring of its own. Move to per-page metadata if content ever renders
    // after mount.
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("article h2, article h3"),
    );

    setHeadings(
      nodes
        .map((node) => {
          const text = node.textContent?.trim() ?? "";
          if (!node.id) node.id = slugify(text);
          return { id: node.id, text, level: node.tagName === "H3" ? 3 : 2 };
        })
        .filter((heading) => heading.id && heading.text),
    );
  }, [pathname]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav aria-label="On this page" className="text-[13px]">
      <p className="mb-3 font-semibold text-[#edf5ee]">On this page</p>
      <ul className="space-y-2.5">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? "pl-4" : ""}>
            <a
              href={`#${heading.id}`}
              className="block leading-snug text-slate-400 transition hover:text-[#c4f57a]"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
