import { ScrollReveal } from "@/components/dashboard/ScrollReveal";

const features = [
  {
    title: "Cross-chain vaults",
    description:
      "Deploy a vault on Ethereum, Sepolia, Base, Arbitrum or Optimism and keep custody of your assets on-chain at all times.",
  },
  {
    title: "Agent-driven trading",
    description:
      "Bind dedicated agent wallets to a vault over MCP so an AI agent can submit signed trade intents on your behalf, never your private key.",
  },
  {
    title: "Risk-assessed intents",
    description:
      "Every trade intent is scored before execution, with a premium and coverage window attached so exposure is bounded up front.",
  },
  {
    title: "On-chain insurance",
    description:
      "Approved intents are backed by an on-chain insurance policy, so a bad fill can be claimed against instead of absorbed in full.",
  },
];

const steps = [
  {
    index: 1,
    title: "Connect a wallet",
    description: "Sign in with the wallet that will own your vaults.",
  },
  {
    index: 2,
    title: "Deploy a vault",
    description: "Choose a chain and deploy a vault from the dashboard.",
  },
  {
    index: 3,
    title: "Bind an agent",
    description:
      "Connect an MCP client and approve an agent wallet for that vault.",
  },
  {
    index: 4,
    title: "Watch it trade",
    description:
      "Track intents, positions and insurance coverage live from the dashboard.",
  },
];

const socialLinks = [
  {
    name: "X",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M18.901 2h3.68l-8.04 9.19L22.5 22h-7.29l-5.7-7.79L3.22 22H-0.46l8.6-9.83L1.5 2h7.46l5.16 7.01L18.9 2Zm-1.29 18h2.03L7.5 3.9H5.35L17.61 20Z" />
      </svg>
    ),
  },
  {
    name: "Discord",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M20.317 4.369A18.79 18.79 0 0 0 16.7 3.3a.13.13 0 0 0-.14.07c-.2.36-.42.83-.57 1.2a17.34 17.34 0 0 0-10.1 0c-.14-.36-.36-.84-.58-1.2a.13.13 0 0 0-.14-.07A18.7 18.7 0 0 0 3.68 4.37a.11.11 0 0 0-.06.05C1.41 9.06.74 13.6 1.09 18.1a.14.14 0 0 0 .05.09c1.98 1.46 3.9 2.35 5.8 2.94a.13.13 0 0 0 .16-.06c.44-.6.84-1.24 1.18-1.91a.13.13 0 0 0-.07-.18c-.31-.12-.61-.28-.9-.44a.13.13 0 0 1-.02-.22c.06-.04.12-.09.18-.13a12.8 12.8 0 0 0 10.53 0c.06.04.12.09.18.13a.13.13 0 0 1-.02.22c-.29.16-.59.32-.9.44a.13.13 0 0 0-.07.18c.34.67.74 1.31 1.18 1.91a.13.13 0 0 0 .16.06c1.9-.59 3.82-1.48 5.8-2.94a.14.14 0 0 0 .05-.09c.42-5.18-.7-9.67-2.96-13.66a.1.1 0 0 0-.05-.05ZM9.4 15.5c-1.13 0-2.06-1.04-2.06-2.31s.9-2.31 2.06-2.31c1.17 0 2.1 1.06 2.06 2.31 0 1.27-.9 2.31-2.06 2.31Zm5.2 0c-1.13 0-2.06-1.04-2.06-2.31s.9-2.31 2.06-2.31c1.17 0 2.1 1.06 2.06 2.31 0 1.27-.9 2.31-2.06 2.31Z" />
      </svg>
    ),
  },
  {
    name: "Telegram",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M21.4 4.82c.28-1.05-.84-1.93-1.82-1.43L3.38 10.9c-1.12.46-1.1 1.94.02 2.36l4.23 1.41 1.82 5.86c.24.78 1.25.98 1.78.35l2.52-3.04 4.62 3.29c.85.61 2.08-.14 1.89-1.1l-1.9-9.82Zm-12.5 8.2 7.54-4.85c.33-.22.68.26-.1.45l-6.18 5.56-1.26.91Z" />
      </svg>
    ),
  },
  {
    name: "GitHub",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M12 .5A12 12 0 0 0 8.21 23.4c.6.11.82-.26.82-.58v-2.14c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.35-1.77-1.35-1.77-1.1-.75.08-.74.08-.74 1.22.09 1.86 1.25 1.86 1.25 1.08 1.85 2.84 1.31 3.53 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.46 11.46 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.82 5.62-5.49 5.92.43.37.81 1.1.81 2.23v3.3c0 .32.21.7.83.58A12 12 0 0 0 12 .5Z" />
      </svg>
    ),
  },
];

export function HomePage({ onConnect }: { onConnect: () => void }) {
  return (
    <main className="min-h-screen bg-[#050806] text-[#edf5ee]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 mb-6 rounded-3xl border border-[#99e836]/10 bg-[#0a120d]/60 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-md sm:px-6">
          <nav className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#99e836]/30 bg-[#99e836]/10 text-xs font-semibold text-[#c4f57a]">
                AR
              </div>
              <div>
                <div className="text-[10px] uppercase text-[#99e836]">
                  Arvo
                </div>
                <div className="text-sm text-slate-300">Protocol</div>
              </div>
            </div>

            <div className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
              <a href="#features" className="transition hover:text-[#c4f57a]">
                Features
              </a>
              <a href="#how-it-works" className="transition hover:text-[#c4f57a]">
                How it works
              </a>
              <a
                href="/connect-agents"
                className="transition hover:text-[#c4f57a]"
              >
                Connect agents
              </a>
            </div>

            <button
              type="button"
              onClick={onConnect}
              className="rounded-full border border-[#99e836]/25 bg-[#99e836]/10 px-4 py-2.5 text-sm font-medium text-[#c4f57a] transition hover:border-[#99e836]/55 hover:bg-[#99e836]/15"
            >
              Connect wallet
            </button>
          </nav>
        </header>

        <ScrollReveal className="scroll-mt-24">
          <section className="rounded-[28px] border border-[#99e836]/10 bg-transparent px-6 py-16 text-center sm:px-10">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#afc4b3]">
              Agent-driven, insured, on-chain
            </p>
            <h1 className="mx-auto mt-4 max-w-3xl text-[clamp(2.4rem,5vw,4rem)] font-medium leading-[1.02] text-[#edf5ee]">
              Vaults your agents can trade,{" "}
              <span className="text-[#99e836]">without your keys.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-slate-300">
              Arvo lets you deploy a vault, bind an AI agent to it over MCP,
              and have every trade risk-assessed and insured before it
              executes — across Ethereum, Base, Arbitrum, Optimism and
              Sepolia.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onConnect}
                className="rounded-xl bg-[#99e836] px-6 py-3 font-semibold text-[#05110b] shadow-[0_12px_20px_rgba(153,232,54,0.18)] transition hover:bg-[#b5ef64]"
              >
                Connect wallet to enter dashboard
              </button>
              <a
                href="/connect-agents"
                className="rounded-xl border border-white/10 bg-[#101915] px-6 py-3 text-sm font-medium text-slate-300 transition hover:border-[#99e836]/30 hover:text-[#edf5ee]"
              >
                Connect an agent instead
              </a>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal id="features" className="mt-6 scroll-mt-24">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[22px] border border-[#99e836]/8 bg-transparent p-5 transition hover:-translate-y-0.5 hover:border-[#99e836]/20"
              >
                <h3 className="text-[1.05rem] font-medium text-[#99e836]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal id="how-it-works" className="mt-6 scroll-mt-24">
          <div className="rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none">
            <p className="text-[10px] uppercase text-[#afc4b3]">Onboarding</p>
            <h2 className="mt-2 text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
              How it works
            </h2>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((step) => (
                <div
                  key={step.index}
                  className="rounded-2xl border border-[#99e836]/8 bg-transparent p-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#99e836]/30 bg-[#99e836]/10 text-xs font-semibold text-[#c4f57a]">
                    {step.index}
                  </div>
                  <p className="mt-3 text-sm font-medium text-[#edf5ee]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <footer className="mt-10 border-t border-[#99e836]/10 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">© 2026 Arvo Protocol</p>

            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  aria-label={social.name}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#99e836]/20 bg-[#99e836]/5 text-[#99e836] transition hover:border-[#99e836]/40 hover:bg-[#99e836]/10"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
