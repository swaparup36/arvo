"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { BrowserProvider, Contract, ethers } from "ethers";
import { useAccount, useDisconnect } from "wagmi";
import { useEffect, useMemo, useState } from "react";

import { AgentsPanel } from "@/components/dashboard/AgentsPanel";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PositionsPanel } from "@/components/dashboard/PortfolioPanel";
import { RiskMonitor } from "@/components/dashboard/RiskMonitor";
import { ScrollReveal } from "@/components/dashboard/ScrollReveal";
import { StatCard, type StatTone } from "@/components/dashboard/StatCard";
import { TradeIntentsPanel } from "@/components/dashboard/TradeIntentsPanel";
import { VaultOverview } from "@/components/dashboard/VaultOverview";
import { useUserVaults } from "@/hooks/useUserVaults";
import {
  chainOptions,
  defaultAgents,
  defaultInsurance,
  defaultPositions,
  defaultTradeIntents,
  defaultVaults,
  tokenAddressesByChain,
  tokenDecimals,
} from "@/lib/dashboard-data";
import {
  createVaultOnFactory,
  executeVaultAction,
  getWalletProvider,
} from "@/lib/wallet";
import type {
  Agent,
  InsuranceItem,
  Position,
  TradeIntent,
  Vault,
} from "@/types/dashboard";

export default function Home() {
  const [selectedChain, setSelectedChain] = useState<string>(chainOptions[1]);
  const [vaults, setVaults] = useState<Vault[]>(defaultVaults);
  const [agents, setAgents] = useState<Agent[]>(defaultAgents);
  const [tradeIntents, setTradeIntents] =
    useState<TradeIntent[]>(defaultTradeIntents);
  const [positions, setPositions] = useState<Position[]>(defaultPositions);
  const [insurance, setInsurance] = useState<InsuranceItem[]>(defaultInsurance);
  const [vaultAction, setVaultAction] = useState<"deposit" | "withdraw">(
    "deposit",
  );
  const [selectedAsset, setSelectedAsset] = useState<string>("USDC");
  const [amount, setAmount] = useState<string>("1000");
  const [walletTokenBalance, setWalletTokenBalance] = useState<string>("0");
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const walletAddress = address ?? "";
  const fallbackAgentAddress = "0x742d35Cc6634C0532925a3b844Bc454e4604e";
  const activeAgentAddress = walletAddress || fallbackAgentAddress;
  const { vaults: userVaults } = useUserVaults(selectedChain, walletAddress);
  const chainIdMap: Record<string, string> = {
    Ethereum: "1",
    Sepolia: "11155111",
    Base: "8453",
    Arbitrum: "42161",
    Optimism: "10",
  };
  const selectedChainId = chainIdMap[selectedChain] ?? "8453";
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState<boolean>(false);
  const [agentPage, setAgentPage] = useState<number>(1);
  const [intentPage, setIntentPage] = useState<number>(1);
  const [vaultPage, setVaultPage] = useState<number>(1);
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);

  const AGENT_PAGE_SIZE = 4;
  const INTENT_PAGE_SIZE = 4;
  const VAULT_PAGE_SIZE = 4;

  const agentTotalPages = Math.max(
    1,
    Math.ceil(agents.length / AGENT_PAGE_SIZE),
  );
  const intentTotalPages = Math.max(
    1,
    Math.ceil(tradeIntents.length / INTENT_PAGE_SIZE),
  );
  const vaultTotalPages = Math.max(
    1,
    Math.ceil(vaults.length / VAULT_PAGE_SIZE),
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
    setVaults(userVaults);
    setVaultPage(1);
  }, [userVaults]);

  useEffect(() => {
    if (vaults.length === 0) {
      setSelectedVaultId(null);
      return;
    }

    setSelectedVaultId((current) => {
      if (current && vaults.some((vault) => vault.id === current)) {
        return current;
      }

      return vaults[0].id;
    });
  }, [vaults]);

  useEffect(() => {
    const loadWalletTokenBalance = async () => {
      if (!walletAddress) {
        setWalletTokenBalance("0");
        return;
      }

      try {
        const provider = new BrowserProvider(getWalletProvider());

        if (selectedAsset === "ETH") {
          const balance = await provider.getBalance(walletAddress);
          setWalletTokenBalance(ethers.formatUnits(balance, 18));
          return;
        }

        const tokenAddress =
          tokenAddressesByChain[selectedChain]?.[selectedAsset];

        if (
          !tokenAddress ||
          tokenAddress === "0x0000000000000000000000000000000000000000"
        ) {
          setWalletTokenBalance("0");
          return;
        }

        const erc20 = new Contract(
          tokenAddress,
          ["function balanceOf(address) view returns(uint256)"],
          provider,
        );

        const balance = await erc20.balanceOf(walletAddress);
        const decimals = tokenDecimals[selectedAsset] ?? 18;
        setWalletTokenBalance(ethers.formatUnits(balance, decimals));
      } catch (error) {
        console.error("Failed to load wallet token balance", error);
        setWalletTokenBalance("0");
      }
    };

    void loadWalletTokenBalance();
  }, [selectedAsset, selectedChain, walletAddress]);

  useEffect(() => {
    const fetchAgents = async () => {
      const userAddress = walletAddress || fallbackAgentAddress;

      try {
        const response = await fetch("/api/agents", {
          headers: {
            userAddress,
          },
        });

        if (!response.ok) {
          setAgents(defaultAgents);
          return;
        }

        const data = (await response.json()) as Array<{
          id?: string;
          address?: string;
          vaultAddress?: string;
          privateKey?: string;
          createdAt?: string;
        }>;

        if (!Array.isArray(data) || data.length === 0) {
          setAgents(defaultAgents);
          return;
        }

        const vaultAddressesForChain = new Set(
          userVaults
            .filter((vault) => vault.chain === selectedChain)
            .map((vault) => vault.address.toLowerCase()),
        );

        const filteredData =
          vaultAddressesForChain.size > 0
            ? data.filter(
                (agent) =>
                  !!agent.vaultAddress &&
                  vaultAddressesForChain.has(agent.vaultAddress.toLowerCase()),
              )
            : data;

        const mappedAgents = (
          filteredData.length > 0 ? filteredData : data
        ).map((agent, index) => {
          const wallet =
            agent.address ?? `0x${index.toString(16).padStart(40, "0")}`;
          const shortWallet =
            wallet.length > 10
              ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
              : wallet;

          return {
            name: `Agent ${index + 1}`,
            strategy: agent.vaultAddress
              ? `Vault ${agent.vaultAddress.slice(0, 6)}...${agent.vaultAddress.slice(-4)}`
              : "On-chain strategy",
            status: "Active",
            pnl: "+$0",
            risk: "Low",
            wallet: shortWallet,
          } satisfies Agent;
        });

        setAgents(mappedAgents);
      } catch (error) {
        console.warn("Failed to load DB agents, using demo data:", error);
        setAgents(defaultAgents);
      }
    };

    void fetchAgents();
  }, [fallbackAgentAddress, selectedChain, userVaults, walletAddress]);

  const paginatedVaults = useMemo(
    () =>
      vaults.slice(
        (vaultPage - 1) * VAULT_PAGE_SIZE,
        vaultPage * VAULT_PAGE_SIZE,
      ),
    [vaultPage, vaults],
  );

  const selectedVault = useMemo(
    () =>
      vaults.find((vault) => vault.id === selectedVaultId) ??
      vaults.find((vault) => vault.chain === selectedChain) ??
      vaults[0] ??
      null,
    [selectedChain, selectedVaultId, vaults],
  );

  useEffect(() => {
    const userAddress = walletAddress || fallbackAgentAddress;
    const agentAddress = activeAgentAddress;
    const activeVaultAddress = selectedVault?.address ?? "";

    const fetchDashboardData = async () => {
      try {
        const [vaultRes, tradeRes, positionRes, insuranceRes] =
          await Promise.allSettled([
            fetch(
              `/api/vault/get-all-vaults?userAddress=${userAddress}&chainId=${selectedChainId}`,
            ),
            fetch(
              `/api/trade-intent/agent/${agentAddress}?chainId=${selectedChainId}`,
            ),
            activeVaultAddress
              ? fetch(
                  `/api/positions?vaultAddress=${activeVaultAddress}&chainId=${selectedChainId}`,
                )
              : Promise.resolve(
                  new Response(JSON.stringify({ positions: [] })),
                ),
            activeVaultAddress
              ? fetch(
                  `/api/insurances?vaultAddress=${activeVaultAddress}&chainId=${selectedChainId}`,
                )
              : Promise.resolve(
                  new Response(JSON.stringify({ insurances: [] })),
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
              id?: string;
              agentAddress?: string;
              tokenIn?: string;
              tokenOut?: string;
              amountIn?: bigint | string | number;
              status?: string;
              createdAt?: string | Date;
            }>;
          };

          if (
            Array.isArray(data?.tradeIntents) &&
            data.tradeIntents.length > 0
          ) {
            const mappedTradeIntents = data.tradeIntents.map((item) => {
              const pair =
                item.tokenIn && item.tokenOut
                  ? `${item.tokenIn.slice(0, 4)} / ${item.tokenOut.slice(0, 4)}`
                  : "ETH / USDC";

              const rawStatus = String(item.status ?? "PENDING").toUpperCase();
              const mappedStatus: TradeIntent["status"] =
                rawStatus === "APPROVED"
                  ? "Approved"
                  : rawStatus === "REJECTED"
                    ? "Review"
                    : "Queued";

              const normalizedAmount =
                typeof item.amountIn === "bigint"
                  ? item.amountIn.toString()
                  : String(item.amountIn ?? "0");

              const amount =
                normalizedAmount && normalizedAmount !== "0"
                  ? `$${normalizedAmount.slice(0, 8)}`
                  : "$0";

              return {
                pair,
                side: item.tokenIn ? "Swap" : "Buy",
                amount,
                status: mappedStatus,
                eta: item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString()
                  : "just now",
                agent:
                  item.agentAddress && item.agentAddress.length > 10
                    ? `${item.agentAddress.slice(0, 6)}...${item.agentAddress.slice(-4)}`
                    : "Agent",
              } satisfies TradeIntent;
            });

            setTradeIntents(mappedTradeIntents);
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
  }, [
    activeAgentAddress,
    fallbackAgentAddress,
    selectedChain,
    selectedChainId,
    selectedVault,
    walletAddress,
  ]);

  const handleChainChange = (nextChain: string) => {
    setSelectedChain(nextChain);
    setSelectedVaultId(null);
    setVaultPage(1);
  };

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
    if (!selectedVault) {
      setTransactionStatus("Select a vault to continue.");
      return;
    }

    setIsSubmitting(true);
    setTransactionStatus("");

    try {
      await executeVaultAction(
        vaultAction,
        selectedAsset,
        amount,
        selectedVault.address,
        selectedChain,
      );

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
    if (!walletAddress) {
      await handleWalletConnect();
      if (!walletAddress) {
        return;
      }
    }

    setIsSubmitting(true);
    setTransactionStatus("");

    try {
      const result = await createVaultOnFactory(
        `${selectedChain} Strategy Vault`,
        selectedChain,
      );

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

  const stats: Array<{
    label: string;
    value: string;
    change: string;
    tone: StatTone;
  }> = [
    {
      label: "TVL",
      value: selectedVault?.totalValue ?? "$0",
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
        <DashboardHeader
          selectedChain={selectedChain}
          onChainChange={handleChainChange}
          walletAddress={walletAddress}
          isWalletMenuOpen={isWalletMenuOpen}
          onWalletConnect={() => {
            setIsWalletMenuOpen(false);
            handleWalletConnect();
          }}
          onWalletDisconnect={handleWalletDisconnect}
        />

        <ScrollReveal id="overview" className="scroll-mt-24">
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                change={stat.change}
                tone={stat.tone}
              />
            ))}
          </div>

          <div className="mb-6 grid gap-5 xl:grid-cols-2">
            <AgentsPanel
              agents={paginatedAgents}
              agentPage={agentPage}
              agentTotalPages={agentTotalPages}
              onPrev={() => setAgentPage((page) => Math.max(1, page - 1))}
              onNext={() =>
                setAgentPage((page) => Math.min(agentTotalPages, page + 1))
              }
            />

            <TradeIntentsPanel
              intents={paginatedTradeIntents}
              intentPage={intentPage}
              intentTotalPages={intentTotalPages}
              onPrev={() => setIntentPage((page) => Math.max(1, page - 1))}
              onNext={() =>
                setIntentPage((page) => Math.min(intentTotalPages, page + 1))
              }
            />
          </div>
        </ScrollReveal>

        <ScrollReveal id="vaults" className="scroll-mt-24">
          <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <VaultOverview
              vaults={paginatedVaults}
              totalPages={vaultTotalPages}
              currentPage={vaultPage}
              onPageChange={setVaultPage}
              selectedChain={selectedChain}
              selectedVaultId={selectedVaultId}
              onVaultSelect={setSelectedVaultId}
              onCreateVault={handleCreateVault}
              isSubmitting={isSubmitting}
            />

            <PositionsPanel positions={positions} />
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

              <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_180px]">
                <select
                  value={selectedVaultId ?? ""}
                  onChange={(event) => setSelectedVaultId(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#101915] px-3 py-2.5 text-[#edf5ee] outline-none"
                >
                  {vaults.length === 0 ? (
                    <option value="">No vaults available</option>
                  ) : (
                    vaults.map((vault) => (
                      <option key={vault.id} value={vault.id}>
                        {vault.name} - {vault.address.slice(0, 6)}...
                        {vault.address.slice(-4)}
                      </option>
                    ))
                  )}
                </select>

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
            <RiskMonitor insurance={insurance} />
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
