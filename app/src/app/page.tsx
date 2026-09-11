"use client";

import { useEffect, useMemo, useState } from "react";

import {
  chainOptions,
  defaultAgents,
  defaultInsurance,
  defaultPositions,
  defaultTradeIntents,
  defaultVaults,
  tokenDecimals,
} from "@/lib/dashboard-data";
import {
  connectWallet,
  createVaultOnFactory,
  executeVaultAction,
} from "@/lib/wallet";
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
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.025)] backdrop-blur-sm sm:p-5 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-200">{title}</h2>
        <button className="rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300">
          View
        </button>
      </div>
      {children}
    </section>
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
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  const handleWalletConnect = async () => {
    try {
      const { accounts } = await connectWallet();
      setWalletAddress(accounts[0]);
      setTransactionStatus("Wallet connected.");
    } catch (error) {
      setTransactionStatus(
        error instanceof Error ? error.message : "Wallet connection failed.",
      );
    }
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

  return (
    <main className="min-h-screen bg-[#050816] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),linear-gradient(135deg,#0c1220,#0a1120_35%,#07101c)] p-4 shadow-2xl shadow-sky-950/30 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-sky-300/80">
                Arvo protocol
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Vault dashboard
              </h1>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 p-1.5">
                {chainOptions.map((chain) => (
                  <button
                    key={chain}
                    onClick={() => setSelectedChain(chain)}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${
                      selectedChain === chain
                        ? "bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {chain}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCreateVault}
                disabled={isSubmitting}
                className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Deploying..." : "+ New vault"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
              >
                <div className="flex items-center justify-between text-slate-300">
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
                <div className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </header>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-sky-200/80">
                  Flow
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  User journey
                </h2>
              </div>
              <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-sky-200">
                {selectedChain} network
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                "Select chain",
                "Deploy funded vaults",
                "Agents submit intent",
              ].map((step, index) => (
                <div
                  key={step}
                  className="rounded-xl border border-white/10 bg-slate-950/35 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                      Step {index + 1}
                    </span>
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                  </div>
                  <p className="text-sm font-medium text-white">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
              Vault status
            </p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold text-white">
                  {activeVault?.totalValue ?? "$0"}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {activeVault?.name ?? "No vault"}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                  activeVault?.health === "Healthy"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : activeVault?.health === "Monitoring"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-red-500/15 text-red-300"
                }`}
              >
                {activeVault?.health ?? "Unknown"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-5">
            <DashboardCard title="Vaults" className="overflow-hidden">
              <div className="space-y-3">
                {vaults.map((vault) => (
                  <div
                    key={vault.id}
                    className={`rounded-2xl border p-4 transition ${
                      vault.chain === selectedChain
                        ? "border-sky-400/40 bg-sky-500/5"
                        : "border-white/10 bg-slate-950/40"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">
                            {vault.name}
                          </p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                            {vault.chain}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {vault.id}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold text-white">
                          {vault.totalValue}
                        </span>
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
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {vault.assets.map((asset) => (
                        <div
                          key={`${vault.id}-${asset.token}`}
                          className="rounded-xl border border-white/10 bg-slate-950/45 p-3"
                        >
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{asset.token}</span>
                            <span>APY {asset.apy}</span>
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {asset.balance}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            Locked: {asset.locked}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard title="Trading agents">
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div
                    key={agent.name}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{agent.name}</p>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                              agent.status === "Active"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : agent.status === "Review"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-slate-700 text-slate-200"
                            }`}
                          >
                            {agent.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          {agent.strategy}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {agent.wallet}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-emerald-300">
                          {agent.pnl}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                            agent.risk === "Low"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : agent.risk === "Medium"
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {agent.risk}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>
          </div>

          <div className="space-y-5">
            <DashboardCard title="Trade intents">
              <div className="space-y-3">
                {tradeIntents.map((intent) => (
                  <div
                    key={`${intent.pair}-${intent.eta}`}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{intent.pair}</p>
                        <p className="text-[11px] text-slate-400">
                          {intent.agent}
                        </p>
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

                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-slate-300">{intent.side}</span>
                      <span className="font-medium text-white">
                        {intent.amount}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                      <span>ETA</span>
                      <span>{intent.eta}</span>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard title="Positions & insurance">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    Position lock state
                  </p>
                  <div className="space-y-3">
                    {positions.map((position) => (
                      <div
                        key={`${position.asset}-${position.size}`}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 p-3"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {position.asset}
                          </p>
                          <p className="text-xs text-slate-400">
                            {position.size}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-white">
                            {position.value}
                          </p>
                          <p
                            className={`text-xs ${position.status === "Locked" ? "text-amber-300" : position.status === "Expiring" ? "text-red-300" : "text-emerald-300"}`}
                          >
                            {position.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    Coverage
                  </p>
                  <div className="space-y-3">
                    {insurance.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 p-3"
                      >
                        <div>
                          <p className="text-sm text-slate-300">{item.label}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-white">{item.value}</p>
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
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <DashboardCard title="Deposit & withdraw">
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
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 p-3"
                >
                  <div>
                    <p className="font-medium text-white">{token.token}</p>
                    <p className="text-xs text-slate-400">
                      Locked: {token.locked}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{token.balance}</p>
                    <p className="text-xs text-emerald-300">APY {token.apy}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 p-2">
                <button
                  type="button"
                  onClick={() => setVaultAction("deposit")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    vaultAction === "deposit"
                      ? "bg-emerald-400 text-slate-950"
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
                      ? "bg-sky-400 text-slate-950"
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
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-slate-500"
                />
                <select
                  value={selectedAsset}
                  onChange={(event) => setSelectedAsset(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-white outline-none"
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
                  className="flex-1 rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <div className="flex min-w-0 flex-1 items-center justify-center rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-xs text-slate-300">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </div>
                ) : null}
              </div>

              {transactionStatus ? (
                <p className="text-xs text-slate-300">{transactionStatus}</p>
              ) : null}
            </div>
          </DashboardCard>

          <DashboardCard title="Vault activity">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Automation mode</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-300">
                  Active
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Rebalance threshold</span>
                  <span className="text-white">5%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last rebalance</span>
                  <span className="text-white">2h ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Risk engine</span>
                  <span className="text-emerald-300">Healthy</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Locked assets</span>
                  <span className="text-white">$1.82M</span>
                </div>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>
    </main>
  );
}
