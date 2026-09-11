"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  chainOptions,
  defaultAgents,
  defaultInsurance,
  defaultPositions,
  defaultTradeIntents,
  defaultVaults,
  tokenDecimals,
} from "@/lib/dashboard-data";
import { createVaultOnFactory, executeVaultAction } from "@/lib/wallet";
import type {
  Agent,
  InsuranceItem,
  Position,
  TradeIntent,
  Vault,
} from "@/types/dashboard";

function DashboardCard({
  title,
  children,
  className = "",
  titleClassName = "",
}: {
  title: string;
  children: React.ReactNode;
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

function ScrollReveal({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            node.classList.add("is-visible");
            observer.unobserve(node);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div id={id} ref={ref} className={`reveal-section ${className}`}>
      {children}
    </div>
  );
}

export default function Home() {
  const [selectedChain, setSelectedChain] = useState<string>(chainOptions[1]);
  const [vaults, setVaults] = useState<Vault[]>(defaultVaults);
  const [agents] = useState<Agent[]>(defaultAgents);
  const [tradeIntents, setTradeIntents] =
    useState<TradeIntent[]>(defaultTradeIntents);
  const [positions, setPositions] = useState<Position[]>(defaultPositions);
  const [insurance, setInsurance] = useState<InsuranceItem[]>(defaultInsurance);
  const [vaultAction, setVaultAction] = useState<"deposit" | "withdraw">(
    "deposit",
  );
  const [selectedAsset, setSelectedAsset] = useState<string>("USDC");
  const [amount, setAmount] = useState<string>("1000");
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const walletAddress = address ?? "";
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState<boolean>(false);
  const [agentPage, setAgentPage] = useState<number>(1);
  const [intentPage, setIntentPage] = useState<number>(1);

  const AGENT_PAGE_SIZE = 4;
  const INTENT_PAGE_SIZE = 4;

  const agentTotalPages = Math.max(
    1,
    Math.ceil(agents.length / AGENT_PAGE_SIZE),
  );
  const intentTotalPages = Math.max(
    1,
    Math.ceil(tradeIntents.length / INTENT_PAGE_SIZE),
  );

  const paginatedAgents = useMemo(
    () =>
      agents.slice(
        (agentPage - 1) * AGENT_PAGE_SIZE,
        agentPage * AGENT_PAGE_SIZE,
      ),
    [agentPage, agents],
  );

  const paginatedTradeIntents = useMemo(
    () =>
      tradeIntents.slice(
        (intentPage - 1) * INTENT_PAGE_SIZE,
        intentPage * INTENT_PAGE_SIZE,
      ),
    [intentPage, tradeIntents],
  );

  useEffect(() => {
    const userAddress = "0x742d35Cc6634C0532925a3b844Bc454e4604e";
    const chainId = (() => {
      const map: Record<string, string> = {
        Ethereum: "1",
        Base: "8453",
        Arbitrum: "42161",
        Optimism: "10",
      };

      return map[selectedChain] ?? "8453";
    })();
    const vaultAddress = "0x8d7d5E1E7ad990485d8E1b1A66D3A4FD5C9f0733";

    const fetchDashboardData = async () => {
      try {
        const [vaultRes, tradeRes, positionRes, insuranceRes] =
          await Promise.allSettled([
            fetch(`/api/vault/get-all-vaults?userAddress=${userAddress}`),
            fetch(`/api/trade-intent/user/${userAddress}`),
            fetch(
              `/api/positions?vaultAddress=${vaultAddress}&chainId=${chainId}`,
            ),
            fetch(
              `/api/insurances?vaultAddress=${vaultAddress}&chainId=${chainId}`,
            ),
          ]);

        if (vaultRes.status === "fulfilled" && vaultRes.value.ok) {
          const data = await vaultRes.value.json();
          if (Array.isArray(data?.vaults) && data.vaults.length > 0) {
            setVaults(data.vaults);
          }
        }

        if (tradeRes.status === "fulfilled" && tradeRes.value.ok) {
          const data = (await tradeRes.value.json()) as {
            tradeIntents?: Array<{
              pair?: string;
              side?: TradeIntent["side"];
              amount?: string;
              status?: TradeIntent["status"];
              eta?: string;
              agent?: string;
            }>;
          };

          if (
            Array.isArray(data?.tradeIntents) &&
            data.tradeIntents.length > 0
          ) {
            setTradeIntents(
              data.tradeIntents.map((item) => ({
                pair: item.pair || "ETH / USDC",
                side: item.side || "Buy",
                amount: item.amount || "$0",
                status: item.status || "Queued",
                eta: item.eta || "just now",
                agent: item.agent || "Agent",
              })),
            );
          }
        }

        if (positionRes.status === "fulfilled" && positionRes.value.ok) {
          const data = (await positionRes.value.json()) as {
            positions?: Array<{
              asset?: string;
              size?: string;
              value?: string;
              pnl?: string;
              status?: Position["status"];
            }>;
          };

          if (Array.isArray(data?.positions) && data.positions.length > 0) {
            setPositions(
              data.positions.map((item) => ({
                asset: item.asset || "ETH",
                size: item.size || "0",
                value: item.value || "$0",
                pnl: item.pnl || "+0%",
                status: item.status || "Locked",
              })),
            );
          }
        }

        if (insuranceRes.status === "fulfilled" && insuranceRes.value.ok) {
          const data = await insuranceRes.value.json();
          if (Array.isArray(data?.insurances) && data.insurances.length > 0) {
            setInsurance([
              {
                label: "Protection pool",
                value: data.insurances.length ? "$2.1M" : "$0",
                change: "+$120K",
                tone: "emerald",
              },
              {
                label: "Claims pending",
                value: data.insurances.length ? "$194K" : "$0",
                change: `${data.insurances.length} active`,
                tone: "amber",
              },
              {
                label: "Coverage ratio",
                value: data.insurances.length ? "96.4%" : "0%",
                change: "+2.7%",
                tone: "cyan",
              },
            ]);
          }
        }
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      }
    };

    fetchDashboardData();
  }, [selectedChain]);

  const activeVault = useMemo(
    () => vaults.find((vault) => vault.chain === selectedChain) ?? vaults[0],
    [selectedChain, vaults],
  );

  const handleWalletDisconnect = () => {
    disconnect();
    setTransactionStatus("Wallet disconnected.");
    setIsWalletMenuOpen(false);
  };

  const handleWalletConnect = () => {
    if (walletAddress) {
      setIsWalletMenuOpen((open) => !open);
      return;
    }

    if (!openConnectModal) {
      setTransactionStatus("Wallet connection is unavailable.");
      return;
    }

    openConnectModal();
  };

  const handleVaultAction = async () => {
    if (!activeVault) {
      setTransactionStatus("Select a vault to continue.");
      return;
    }

    setIsSubmitting(true);
    setTransactionStatus("");

    try {
      const result = await executeVaultAction(
        vaultAction,
        selectedAsset,
        amount,
        activeVault.address,
        selectedChain,
      );

      setWalletAddress(result.signerAddress);
      setTransactionStatus(
        `${vaultAction === "deposit" ? "Deposit" : "Withdraw"} executed successfully.`,
      );
    } catch (error) {
      setTransactionStatus(
        error instanceof Error ? error.message : "Vault transaction failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateVault = async () => {
    setIsSubmitting(true);
    setTransactionStatus("");

    try {
      const result = await createVaultOnFactory(
        `${selectedChain} Strategy Vault`,
        selectedChain,
      );

      setWalletAddress(result.signerAddress);
      setTransactionStatus(
        result.vaultAddress !== "0x0000000000000000000000000000000000000000"
          ? `Vault created successfully: ${result.vaultAddress.slice(0, 6)}...${result.vaultAddress.slice(-4)}`
          : "Vault created successfully.",
      );

      if (
        result.vaultAddress !== "0x0000000000000000000000000000000000000000"
      ) {
        const nextVault: Vault = {
          id: `vault-${Date.now()}`,
          name: `${selectedChain} Strategy Vault`,
          chain: selectedChain,
          address: result.vaultAddress,
          totalValue: "$0",
          health: "Healthy",
          assets: [
            { token: "USDC", balance: "0", apy: "0%", locked: "$0" },
            { token: "ETH", balance: "0", apy: "0%", locked: "$0" },
          ],
        };

        setVaults((currentVaults) => [nextVault, ...currentVaults]);
      }
    } catch (error) {
      setTransactionStatus(
        error instanceof Error ? error.message : "Vault creation failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = [
    {
      label: "TVL",
      value: activeVault?.totalValue ?? "$0",
      change: "+12.4%",
      tone: "emerald",
    },
    { label: "Locked value", value: "$1.82M", change: "+6.9%", tone: "cyan" },
    {
      label: "Active agents",
      value: `${agents.length}`,
      change: "+3",
      tone: "violet",
    },
    { label: "Insurance", value: "96.4%", change: "+2.7%", tone: "amber" },
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
                <div className="text-[10px] uppercase text-[#99e836]">Arvo</div>
                <div className="text-sm text-slate-300">Protocol</div>
              </div>
            </div>

            <div className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
              <a href="#overview" className="transition hover:text-[#c4f57a]">
                Overview
              </a>
              <a href="#agents" className="transition hover:text-[#c4f57a]">
                Agents
              </a>
              <a href="#intents" className="transition hover:text-[#c4f57a]">
                Intents
              </a>
              <a href="#vaults" className="transition hover:text-[#c4f57a]">
                Vaults
              </a>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedChain}
                onChange={(event) => setSelectedChain(event.target.value)}
                className="rounded-full border border-[#99e836]/12 bg-[#101915] px-3 py-2.5 pr-8 text-sm text-[#edf5ee] outline-none transition focus:border-[#99e836]/50"
                aria-label="Select chain"
              >
                {chainOptions.map((chain) => (
                  <option key={chain} value={chain}>
                    {chain}
                  </option>
                ))}
              </select>

              <div className="relative">
                <button
                  type="button"
                  onClick={handleWalletConnect}
                  className="rounded-full border border-[#99e836]/25 bg-[#99e836]/10 px-4 py-2.5 text-sm font-medium text-[#c4f57a] transition hover:border-[#99e836]/55 hover:bg-[#99e836]/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {walletAddress
                    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                    : "Connect wallet"}
                </button>

                {walletAddress && isWalletMenuOpen ? (
                  <div className="absolute right-0 z-20 mt-2 min-w-[180px] rounded-2xl border border-[#99e836]/15 bg-[#0f1714] p-2 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setIsWalletMenuOpen(false);
                        handleWalletConnect();
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5"
                    >
                      Connect wallet
                    </button>
                    <button
                      type="button"
                      onClick={handleWalletDisconnect}
                      className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </nav>
        </header>

        <ScrollReveal id="overview" className="scroll-mt-24">
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[22px] border border-[#99e836]/8 bg-transparent p-4 shadow-none"
              >
                <div className="flex items-center justify-between text-[#dfece2]">
                  <span className="text-sm">{stat.label}</span>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                      stat.tone === "emerald"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : stat.tone === "cyan"
                          ? "bg-cyan-500/15 text-cyan-300"
                          : stat.tone === "violet"
                            ? "bg-violet-500/15 text-violet-300"
                            : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {stat.change}
                  </span>
                </div>
                <div className="mt-4 text-[2.2rem] font-semibold leading-none text-[#edf5ee] sm:text-[2.8rem]">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6 grid gap-5 xl:grid-cols-2">
            <div className="rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase text-[#afc4b3]">Agents</p>
                  <h2 className="mt-2 text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
                    Active agents
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {paginatedAgents.map((agent) => (
                  <div
                    key={agent.name}
                    className="group rounded-2xl border border-[#99e836]/8 bg-transparent p-3 transition hover:-translate-y-0.5 hover:border-[#99e836]/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#99e836]/20 bg-[#99e836]/10 text-xs font-medium text-[#c4f57a]">
                          {agent.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[1.1rem] font-medium leading-none text-[#edf5ee]">
                            {agent.name}
                          </p>
                          <p className="mt-1 text-[0.95rem] leading-relaxed text-slate-300">
                            {agent.strategy}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                          agent.status === "Active"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : agent.status === "Review"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[0.7rem] uppercase text-slate-300">
                      <span>{agent.risk}</span>
                      <span>{agent.pnl}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#99e836]/10 pt-4">
                <button
                  type="button"
                  onClick={() => setAgentPage((page) => Math.max(1, page - 1))}
                  disabled={agentPage === 1}
                  className="rounded-full border border-[#99e836]/15 bg-[#111915] px-3 py-2 text-xs font-medium uppercase text-[#c4f57a] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs uppercase text-slate-400">
                  Page {agentPage} / {agentTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAgentPage((page) => Math.min(agentTotalPages, page + 1))
                  }
                  disabled={agentPage === agentTotalPages}
                  className="rounded-full border border-[#99e836]/15 bg-[#111915] px-3 py-2 text-xs font-medium uppercase text-[#c4f57a] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>

            <div
              id="intents"
              className="rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase text-[#afc4b3]">Queue</p>
                  <h2 className="mt-2 text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
                    Trade intents
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {paginatedTradeIntents.map((intent) => (
                  <article
                    key={`${intent.pair}-${intent.eta}`}
                    className="group rounded-[22px] border border-[#99e836]/8 bg-transparent p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[#99e836]/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase text-[#afc4b3]">
                          {intent.agent}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-[#edf5ee]">
                          {intent.pair}
                        </h3>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                          intent.status === "Queued"
                            ? "bg-slate-700 text-slate-200"
                            : intent.status === "Review"
                              ? "bg-amber-500/15 text-amber-300"
                              : intent.status === "Approved"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-sky-500/15 text-sky-300"
                        }`}
                      >
                        {intent.status}
                      </span>
                    </div>

                    <div className="mt-5 flex items-center justify-between text-[0.95rem] text-slate-200">
                      <span>{intent.side}</span>
                      <span className="text-[1.15rem] font-semibold text-[#edf5ee]">
                        {intent.amount}
                      </span>
                    </div>

                    <div className="mt-4 border-t border-[#99e836]/8 pt-3 text-[0.7rem] uppercase text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>ETA</span>
                        <span>{intent.eta}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#99e836]/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIntentPage((page) => Math.max(1, page - 1))}
                  disabled={intentPage === 1}
                  className="rounded-full border border-[#99e836]/15 bg-[#111915] px-3 py-2 text-xs font-medium uppercase text-[#c4f57a] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs uppercase text-slate-400">
                  Page {intentPage} / {intentTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setIntentPage((page) =>
                      Math.min(intentTotalPages, page + 1),
                    )
                  }
                  disabled={intentPage === intentTotalPages}
                  className="rounded-full border border-[#99e836]/15 bg-[#111915] px-3 py-2 text-xs font-medium uppercase text-[#c4f57a] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal id="vaults" className="scroll-mt-24">
          <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="overflow-hidden rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none">
              <div className="mb-4 flex items-end justify-between gap-3">
                <h2 className="text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
                  Vault overview
                </h2>
                <button
                  type="button"
                  onClick={handleCreateVault}
                  disabled={isSubmitting}
                  className="rounded-full bg-[#99e836] px-3 py-2 text-[10px] font-semibold text-[#05110b] shadow-[0_12px_20px_rgba(153,232,54,0.18)] transition hover:bg-[#b5ef64] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Deploying..." : "+ New Vault"}
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {vaults.map((vault) => (
                  <div
                    key={vault.id}
                    className={`rounded-2xl border p-4 transition hover:border-[#78f7b8]/20 ${
                      vault.chain === selectedChain
                        ? "border-[#99e836]/20 bg-transparent"
                        : "border-[#99e836]/10 bg-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#edf5ee]">
                          {vault.name}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {vault.chain}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                          vault.health === "Healthy"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : vault.health === "Monitoring"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {vault.health}
                      </span>
                    </div>

                    <div className="mt-4 text-2xl font-semibold text-[#edf5ee]">
                      {vault.totalValue}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {vault.assets.map((asset) => (
                        <div
                          key={`${vault.id}-${asset.token}`}
                          className="rounded-xl border border-[#99e836]/10 bg-transparent p-2.5"
                        >
                          <div className="flex items-center justify-between text-[10px] uppercase text-slate-400">
                            <span>{asset.token}</span>
                            <span>{asset.apy}</span>
                          </div>
                          <div className="mt-2 text-base font-medium text-[#edf5ee]">
                            {asset.balance}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none">
              <div className="mb-4 flex items-end justify-between gap-3">
                <h2 className="text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
                  Portfolio
                </h2>
              </div>
              <div className="space-y-4">
                {positions.map((position) => (
                  <div
                    key={`${position.asset}-${position.size}`}
                    className="rounded-2xl border border-[#99e836]/10 bg-transparent p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#edf5ee]">
                          {position.asset}
                        </p>
                        <p className="text-xs text-slate-400">
                          {position.size}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-[#edf5ee]">
                          {position.value}
                        </p>
                        <p
                          className={`text-xs ${
                            position.status === "Locked"
                              ? "text-amber-300"
                              : position.status === "Expiring"
                                ? "text-red-300"
                                : "text-emerald-300"
                          }`}
                        >
                          {position.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <DashboardCard
            title="Deposit & withdraw"
            className="scroll-mt-24"
            titleClassName="text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]"
          >
            <div className="space-y-3">
              {[
                {
                  token: "USDC",
                  balance: "86,420",
                  apy: "5.1%",
                  locked: "$480K",
                },
                { token: "ETH", balance: "12.8", apy: "3.4%", locked: "$232K" },
                {
                  token: "ARB",
                  balance: "18,640",
                  apy: "7.8%",
                  locked: "$140K",
                },
              ].map((token) => (
                <div
                  key={token.token}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b120f] p-3"
                >
                  <div>
                    <p className="font-medium text-[#edf5ee]">{token.token}</p>
                    <p className="text-xs text-slate-400">
                      Locked: {token.locked}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[#edf5ee]">
                      {token.balance}
                    </p>
                    <p className="text-xs text-emerald-300">APY {token.apy}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3 rounded-[22px] border border-white/10 bg-[#0b120f] p-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#101915] p-2">
                <button
                  type="button"
                  onClick={() => setVaultAction("deposit")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    vaultAction === "deposit"
                      ? "bg-[#99e836] text-[#05110b]"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={() => setVaultAction("withdraw")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    vaultAction === "withdraw"
                      ? "bg-[#99e836] text-[#05110b]"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  Withdraw
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Amount"
                  type="number"
                  min="0"
                  step="0.000001"
                  className="w-full rounded-xl border border-white/10 bg-[#101915] px-3 py-2.5 text-[#edf5ee] outline-none placeholder:text-slate-500"
                />
                <select
                  value={selectedAsset}
                  onChange={(event) => setSelectedAsset(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#101915] px-3 py-2.5 text-[#edf5ee] outline-none"
                >
                  {Object.keys(tokenDecimals).map((token) => (
                    <option key={token} value={token}>
                      {token}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={
                    walletAddress ? handleVaultAction : handleWalletConnect
                  }
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-[#99e836] px-4 py-3 font-semibold text-[#05110b] shadow-[0_12px_20px_rgba(153,232,54,0.18)] transition hover:bg-[#b5ef64] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Processing..."
                    : walletAddress
                      ? vaultAction === "deposit"
                        ? "Deposit to vault"
                        : "Withdraw from vault"
                      : "Connect wallet"}
                </button>

                {walletAddress ? (
                  <div className="flex min-w-0 flex-1 items-center justify-center rounded-xl border border-white/10 bg-[#101915] px-3 py-3 text-xs text-slate-300">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </div>
                ) : null}
              </div>

              {transactionStatus ? (
                <p className="text-xs text-slate-300">{transactionStatus}</p>
              ) : null}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Risk monitor"
            className="scroll-mt-24"
            titleClassName="text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]"
          >
            <div className="space-y-4 rounded-[22px] border border-white/10 bg-[#0b120f] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Automation mode</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-medium uppercase text-emerald-300">
                  Active
                </span>
              </div>

              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Rebalance threshold</span>
                  <span className="text-[#edf5ee]">5%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last rebalance</span>
                  <span className="text-[#edf5ee]">2h ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Risk engine</span>
                  <span className="text-emerald-300">Healthy</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Locked assets</span>
                  <span className="text-[#edf5ee]">$1.82M</span>
                </div>
              </div>

              <div className="pt-3">
                <p className="mb-2 text-[10px] uppercase text-slate-400">
                  Coverage
                </p>
                <div className="space-y-3">
                  {insurance.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0c140f] p-3"
                    >
                      <span className="text-sm text-slate-300">
                        {item.label}
                      </span>
                      <div className="text-right">
                        <p className="font-medium text-[#edf5ee]">
                          {item.value}
                        </p>
                        <p
                          className={`text-xs ${
                            item.tone === "emerald"
                              ? "text-emerald-300"
                              : item.tone === "amber"
                                ? "text-amber-300"
                                : "text-cyan-300"
                          }`}
                        >
                          {item.change}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DashboardCard>
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
