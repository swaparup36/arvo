import Image from "next/image";
import Link from "next/link";

import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsToc } from "@/components/docs/DocsToc";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="min-h-screen bg-[#050806] text-[#edf5ee]">
      <header className="sticky top-0 z-30 h-14 border-b border-white/10 bg-[#050806]/85 backdrop-blur-md">
        <nav className="flex h-full items-center justify-between gap-6 px-5 lg:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/arvo-logo-no-bg.png"
                alt="Arvo"
                width={40}
                height={40}
                priority
                className="h-10 w-10"
              />
              <span className="text-sm text-slate-400">
                Arvo <span className="text-slate-700">/</span>{" "}
                <span className="font-medium text-[#edf5ee]">Docs</span>
              </span>
            </Link>
          </div>
          <Link
            href="/"
            className="rounded-full bg-[#99e836] px-3.5 py-1.5 text-[13px] font-semibold text-[#05110b] transition hover:bg-[#b5ef64]"
          >
            Dashboard
          </Link>
        </nav>
      </header>

      <div className="flex">
        <aside className="no-scrollbar sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-white/10 px-6 py-8 lg:block">
          <DocsSidebar />
        </aside>

        <main className="min-w-0 flex-1 px-5 py-10 lg:px-12">
          <article className="mx-auto max-w-[48rem]">{children}</article>

          <div className="mx-auto mt-10 max-w-[48rem] border-t border-white/10 pt-6 lg:hidden">
            <DocsSidebar />
          </div>
        </main>

        <aside className="no-scrollbar sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto py-10 pr-6 xl:block">
          <DocsToc />
        </aside>
      </div>
    </div>
  );
}
