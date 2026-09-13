"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { BrowserProvider, Contract, ethers } from "ethers";
import { useAccount, useDisconnect } from "wagmi";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AgentsPanel } from "@/components/dashboard/AgentsPanel";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { NewVaultDialog } from "@/components/dashboard/NewVaultDialog";
import { PositionsPanel } from "@/components/dashboard/PortfolioPanel";
import { Tooltip } from "@/components/dashboard/Tooltip";
import { RiskMonitor } from "@/components/dashboard/RiskMonitor";
import { ScrollReveal } from "@/components/dashboard/ScrollReveal";
import { Toast, type ToastMessage } from "@/components/dashboard/Toast";
import { StatCard, type StatTone } from "@/components/dashboard/StatCard";
import { TradeIntentsPanel } from "@/components/dashboard/TradeIntentsPanel";
import { VaultOverview } from "@/components/dashboard/VaultOverview";
import { HomePage } from "@/components/home/HomePage";
import { useUserVaults } from "@/hooks/useUserVaults";
import {
  clearAuthToken,
  getAuthToken,
  useWalletAuth,
} from "@/hooks/useWalletAuth";
import {
  chainIdMap,
  chainOptions,
  formatAmountForDisplay,
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
  VaultAsset,
} from "@/types/dashboard";

const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

type VaultHoldings = Pick<Vault, "native" | "assets" | "totalValue">;

const emptyAsset = (token: string): VaultAsset => ({
  token,
  totalDeposited: "0",
  availableBalance: "0",
  lockedPercent: 0,
});

// on-chain balance is the source of truth; the vault contract only tells us how
// much of it is locked in open positions
async function toVaultAsset(
  vaultAddress: string,
  chainId: string,
  symbol: string,
  address: string,
  decimals: number,
  balance: bigint,
): Promise<VaultAsset> {
  const zero = BigInt(0);
  let locked = zero;

  try {
    const response = await fetch(
      `/api/vault/get-vault-balance?vaultAddress=${vaultAddress}&asset=${address}&chainId=${chainId}`,
    );

    if (response.ok) {
      const data = (await response.json()) as { locked?: string };
      locked = BigInt(data.locked ?? "0");
    }
  } catch (error) {
    console.warn(`Failed to load locked ${symbol} balance for vault`, error);
  }

  if (locked > balance) {
    locked = balance;
  }

  return {
    token: symbol,
    totalDeposited: ethers.formatUnits(balance, decimals),
    availableBalance: ethers.formatUnits(balance - locked, decimals),
    lockedPercent:
      balance > zero ? Number((locked * BigInt(10000)) / balance) / 100 : 0,
  };
}

async function fetchVaultHoldings(
  vaultAddress: string,
  chainId: string,
): Promise<VaultHoldings> {
  try {
    const response = await fetch(
      `/api/vault/get-all-tokens?vaultAddress=${vaultAddress}&chainId=${chainId}`,
    );

    if (!response.ok) {
      throw new Error(`get-all-tokens returned ${response.status}`);
    }

    const data = (await response.json()) as {
      native?: { symbol: string; decimals: number; balance: string };
      tokens?: Array<{
        address: string;
        symbol: string;
        decimals: number;
        balance: string;
      }>;
    };

    const nativeSymbol = data.native?.symbol ?? "ETH";
    const [native, ...assets] = await Promise.all([
      toVaultAsset(
        vaultAddress,
        chainId,
        nativeSymbol,
        ETH_ADDRESS,
        data.native?.decimals ?? 18,
        BigInt(data.native?.balance ?? "0"),
      ),
      ...(data.tokens ?? []).map((token) =>
        toVaultAsset(
          vaultAddress,
          chainId,
          token.symbol,
          token.address,
          token.decimals,
          BigInt(token.balance),
        ),
      ),
    ]);

    return {
      native,
      assets,
      totalValue: `${native.totalDeposited} ${native.token}`,
    };
  } catch (error) {
    console.warn("Failed to load vault holdings", error);
    return {
      native: emptyAsset("ETH"),
      assets: [],
      totalValue: "0 ETH",
    };
  }
}

function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const err = error as { reason?: unknown; shortMessage?: unknown; message?: unknown };

    if (typeof err.reason === "string" && err.reason) {
      return err.reason;
    }

    if (typeof err.shortMessage === "string" && err.shortMessage) {
      return err.shortMessage;
    }

    if (typeof err.message === "string") {
      const revertMatch =
        err.message.match(/reason="([^"]+)"/) ??
        err.message.match(/execution reverted: "([^"]+)"/);
      if (revertMatch) {
        return revertMatch[1];
      }
    }
  }

  if (error instanceof Error) {
    return error.message.length > 160
      ? `${error.message.slice(0, 160)}…`
      : error.message;
  }

  return fallback;
}

function resolveTokenSymbol(chain: string, address?: string): string {
  if (!address) return "Unknown";

  const lower = address.toLowerCase();
  if (lower === "0x0000000000000000000000000000000000000000") return "ETH";

  const chainTokens = tokenAddressesByChain[chain] ?? {};
  const match = Object.entries(chainTokens).find(
    ([, tokenAddress]) => tokenAddress.toLowerCase() === lower,
  );

  return match ? match[0] : `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getSupportedAssetsForChain(chain: string): string[] {
  const chainTokens = tokenAddressesByChain[chain] ?? {};

  return Object.keys(tokenDecimals).filter(
    (token) =>
      token === "ETH" ||
      (chainTokens[token] && chainTokens[token] !== ETH_ADDRESS),
  );
}

function toBigInt(rawAmount: unknown): bigint {
  try {
    return typeof rawAmount === "bigint" ? rawAmount : BigInt(String(rawAmount));
  } catch {
    return BigInt(0);
  }
}

function formatTokenAmount(rawAmount: unknown, symbol: string): string {
  try {
    const decimals = tokenDecimals[symbol] ?? 18;
    const value =
      typeof rawAmount === "bigint" ? rawAmount : BigInt(String(rawAmount));
    return `${ethers.formatUnits(value, decimals)} ${symbol}`;
  } catch {
    return `${String(rawAmount ?? "0")} ${symbol}`;
  }
}

function formatOnChainTimestamp(rawTimestamp: unknown): string {
  const seconds = Number(rawTimestamp ?? 0);
  if (!seconds) return "unknown";
  return new Date(seconds * 1000).toLocaleString();
}

function formatDurationSeconds(rawSeconds: unknown): string {
  const seconds = Number(rawSeconds ?? 0);
  if (!seconds) return "0d";
  const days = seconds / 86400;
  return days >= 1 ? `${days.toFixed(1)}d` : `${Math.round(seconds / 3600)}h`;
}

export default function Home() {
  const [selectedChain, setSelectedChain] = useState<string>(chainOptions[1]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentAddress, setSelectedAgentAddress] = useState<string | null>(
    null,
  );
  const [tradeIntents, setTradeIntents] = useState<TradeIntent[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [insurance, setInsurance] = useState<InsuranceItem[]>([]);
  // insurance id links a policy to its position; one id highlights both panels
  const [selectedInsuranceId, setSelectedInsuranceId] = useState<string | null>(
    null,
  );
  const [pendingInsuranceId, setPendingInsuranceId] = useState<string | null>(
    null,
  );
  // bumped after an on-chain action so the dashboard refetches
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState<boolean>(false);
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
  const { vaults: userVaults } = useUserVaults(selectedChain, walletAddress);
  const { error: authError } = useWalletAuth();
  const selectedChainId = chainIdMap[selectedChain];
  const supportedAssets = useMemo(
    () => getSupportedAssetsForChain(selectedChain),
    [selectedChain],
  );
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const statusMessage = authError
    ? `Sign-in failed: ${authError}`
    : transactionStatus;
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState<boolean>(false);
  const [agentPage, setAgentPage] = useState<number>(1);
  const [intentPage, setIntentPage] = useState<number>(1);
  const [vaultPage, setVaultPage] = useState<number>(1);
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [isNewVaultDialogOpen, setIsNewVaultDialogOpen] = useState<boolean>(false);
  const [newVaultName, setNewVaultName] = useState<string>("");

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

    if (userVaults.length === 0) {
      return;
    }

    let isCancelled = false;

    const enrichVaultAssets = async () => {
      const enrichedVaults = await Promise.all(
        userVaults.map(async (vault) => ({
          ...vault,
          ...(await fetchVaultHoldings(
            vault.address,
            chainIdMap[vault.chain] ?? selectedChainId,
          )),
        })),
      );

      if (!isCancelled) {
        setVaults(enrichedVaults);
      }
    };

    void enrichVaultAssets();

    return () => {
      isCancelled = true;
    };
  }, [userVaults, selectedChainId]);

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
    if (!supportedAssets.includes(selectedAsset)) {
      setSelectedAsset(supportedAssets[0] ?? "ETH");
    }
  }, [selectedAsset, supportedAssets]);

  const loadWalletTokenBalance = useCallback(async () => {
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

      const tokenAddress = tokenAddressesByChain[selectedChain]?.[selectedAsset];

      if (!tokenAddress || tokenAddress === ETH_ADDRESS) {
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
  }, [selectedAsset, selectedChain, walletAddress]);

  useEffect(() => {
    void loadWalletTokenBalance();
  }, [loadWalletTokenBalance]);

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

  const selectedVaultAddress = selectedVault?.address ?? "";

  // agents belong to a vault, so the selected vault scopes the list
  useEffect(() => {
    if (!walletAddress || !selectedVaultAddress) {
      setAgents([]);
      setSelectedAgentAddress(null);
      return;
    }

    const fetchAgents = async () => {
      try {
        const response = await fetch("/api/agents", {
          headers: {
            userAddress: walletAddress,
          },
        });

        const data = response.ok ? await response.json() : null;

        if (!Array.isArray(data)) {
          setAgents([]);
          setSelectedAgentAddress(null);
          return;
        }

        const mappedAgents = (
          data as Array<{
            id?: string;
            address?: string;
            vaultAddress?: string;
            createdAt?: string;
          }>
        )
          .filter(
            (agent) =>
              agent.vaultAddress?.toLowerCase() ===
              selectedVaultAddress.toLowerCase(),
          )
          .map((agent, index) => ({
            name: `Agent ${index + 1}`,
            address: agent.address ?? "",
            vaultAddress: agent.vaultAddress ?? "",
            createdAt: agent.createdAt
              ? new Date(agent.createdAt).toLocaleDateString()
              : "",
          } satisfies Agent));

        setAgents(mappedAgents);
        setSelectedAgentAddress((current) =>
          current && mappedAgents.some((agent) => agent.address === current)
            ? current
            : null,
        );
      } catch (error) {
        console.warn("Failed to load agents:", error);
        setAgents([]);
        setSelectedAgentAddress(null);
      }
    };

    void fetchAgents();
  }, [selectedVaultAddress, walletAddress]);

  useEffect(() => {
    if (!walletAddress) {
      setTradeIntents([]);
      setPositions([]);
      setInsurance([]);
      return;
    }

    const activeVaultAddress = selectedVault?.address ?? "";
    const activeAgentAddress = agents[0]?.address ?? "";

    const fetchDashboardData = async () => {
      let mappedPositions: Position[] = [];
      let insuranceItems: InsuranceItem[] = [];

      setIsDashboardLoading(true);

      try {
        const [tradeRes, positionRes, insuranceRes] =
          await Promise.allSettled([
            activeVaultAddress
              ? fetch(
                  selectedAgentAddress
                    ? `/api/trade-intent/agent/${selectedAgentAddress}?chainId=${selectedChainId}`
                    : `/api/trade-intent/user/${walletAddress}?chainId=${selectedChainId}&vaultAddress=${activeVaultAddress}`,
                )
              : Promise.resolve(
                  new Response(JSON.stringify({ tradeIntents: [] })),
                ),
            activeVaultAddress
              ? fetch(
                  `/api/positions?vaultAddress=${activeVaultAddress}&chainId=${selectedChainId}`,
                )
              : Promise.resolve(
                  new Response(JSON.stringify({ positions: [] })),
                ),
            activeAgentAddress
              ? fetch(
                  `/api/insurances?agentAddress=${activeAgentAddress}&chainId=${selectedChainId}`,
                )
              : Promise.resolve(
                  new Response(JSON.stringify({ insurances: [] })),
                ),
          ]);

        if (tradeRes.status === "fulfilled" && tradeRes.value.ok) {
          const data = (await tradeRes.value.json()) as {
            tradeIntents?: Array<{
              id?: string;
              agentAddress?: string;
              tokenIn?: string;
              tokenOut?: string;
              amountIn?: string | number;
              status?: string;
              createdAt?: string | Date;
              tradeConfirmed?: boolean;
              risk?: number | null;
              confirmation?: Record<string, unknown> | null;
              assessment?: Record<string, unknown> | null;
            }>;
          };

          const mappedTradeIntents = (data.tradeIntents ?? []).map((item) => {
            const tokenInSymbol = resolveTokenSymbol(
              selectedChain,
              item.tokenIn,
            );
            const tokenOutSymbol = resolveTokenSymbol(
              selectedChain,
              item.tokenOut,
            );

            const rawStatus = String(item.status ?? "PENDING").toUpperCase();
            // an on-chain confirmation outranks whatever the intent row says
            const mappedStatus: TradeIntent["status"] = item.tradeConfirmed
              ? "Executed"
              : rawStatus === "APPROVED"
                ? "Approved"
                : rawStatus === "REJECTED"
                  ? "Review"
                  : "Queued";

            const { assessment, confirmation } = item;

            return {
              id: item.id ?? `${item.agentAddress}-${String(item.createdAt)}`,
              pair: `${tokenInSymbol} / ${tokenOutSymbol}`,
              amount: formatTokenAmount(item.amountIn, tokenInSymbol),
              status: mappedStatus,
              eta: item.createdAt
                ? new Date(item.createdAt).toLocaleDateString()
                : "just now",
              agent:
                item.agentAddress && item.agentAddress.length > 10
                  ? `${item.agentAddress.slice(0, 6)}...${item.agentAddress.slice(-4)}`
                  : "Agent",
              tradeConfirmed: Boolean(item.tradeConfirmed),
              risk: typeof item.risk === "number" ? item.risk : null,
              confirmation: confirmation
                ? {
                    transactionHash: String(confirmation.transactionHash ?? ""),
                    amountIn: formatTokenAmount(
                      confirmation.amountIn,
                      tokenInSymbol,
                    ),
                    amountOut: formatTokenAmount(
                      confirmation.amountOut,
                      tokenOutSymbol,
                    ),
                    executedAt: confirmation.executedAt
                      ? new Date(
                          String(confirmation.executedAt),
                        ).toLocaleString()
                      : "unknown",
                  }
                : null,
              assessment: assessment
                ? {
                    riskScore: Number(assessment.riskScore ?? 0),
                    premium: formatTokenAmount(assessment.premium, "USDC"),
                    coverage: Number(assessment.coverage ?? 0),
                    coverageDuration: formatDurationSeconds(
                      assessment.coverageDuration,
                    ),
                    assessedAt: assessment.assessedAt
                      ? new Date(String(assessment.assessedAt)).toLocaleString()
                      : "unknown",
                    expiresAt: assessment.expiresAt
                      ? new Date(String(assessment.expiresAt)).toLocaleString()
                      : "unknown",
                  }
                : null,
            } satisfies TradeIntent;
          });

          setTradeIntents(mappedTradeIntents);
        } else {
          setTradeIntents([]);
        }

        if (positionRes.status === "fulfilled" && positionRes.value.ok) {
          const data = (await positionRes.value.json()) as {
            positions?: Array<{
              id?: string;
              insuranceId?: string | null;
              tokenInAddress?: string;
              tokenOutAddress?: string;
              amountIn?: string | number;
              amountOut?: string | number;
              isActive?: boolean;
              createdAt?: string | number;
              currentValue?: string | null;
            }>;
          };

          mappedPositions = (data.positions ?? []).map((item) => {
              const tokenInSymbol = resolveTokenSymbol(
                selectedChain,
                item.tokenInAddress,
              );
              const tokenOutSymbol = resolveTokenSymbol(
                selectedChain,
                item.tokenOutAddress,
              );

              // both sides are tokenIn units, so the difference is the P/L
              const spent = toBigInt(item.amountIn);
              const worth =
                item.currentValue == null ? null : toBigInt(item.currentValue);
              const change = worth === null ? null : worth - spent;

              return {
                id: item.id ?? `${item.tokenInAddress}-${item.createdAt}`,
                insuranceId: item.insuranceId ?? null,
                pair: `${tokenInSymbol} → ${tokenOutSymbol}`,
                amountIn: formatTokenAmount(item.amountIn, tokenInSymbol),
                amountOut: formatTokenAmount(item.amountOut, tokenOutSymbol),
                status: item.isActive ? "Active" : "Closed",
                openedAt: formatOnChainTimestamp(item.createdAt),
                pnl:
                  change === null
                    ? null
                    : `${change > BigInt(0) ? "+" : ""}${formatTokenAmount(change, tokenInSymbol)}`,
                pnlPercent:
                  change === null || spent === BigInt(0)
                    ? null
                    : Number((change * BigInt(10000)) / spent) / 100,
              } satisfies Position;
          });
        }

        if (insuranceRes.status === "fulfilled" && insuranceRes.value.ok) {
          const data = (await insuranceRes.value.json()) as {
            insurances?: Array<{
              id?: string;
              tradeIntentId?: string;
              positionId?: string | null;
              premium?: string | number;
              coverage?: string | number;
              coverageDuration?: string | number;
              valid?: boolean;
              createdAt?: string | number;
            }>;
          };

          insuranceItems = (data.insurances ?? []).map((item) => ({
              id: item.id ?? String(item.createdAt ?? Math.random()),
              tradeIntentId: item.tradeIntentId ?? "",
              positionId: item.positionId ?? null,
              premium: formatTokenAmount(item.premium, "USDC"),
              coverage: `${item.coverage ?? "0"}%`,
              duration: formatDurationSeconds(item.coverageDuration),
              valid: Boolean(item.valid),
              createdAt: formatOnChainTimestamp(item.createdAt),
          }));
        }

        // spent and expired policies, and the positions behind them, are
        // already filtered out server side
        setInsurance(insuranceItems);
        setPositions(mappedPositions);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setIsDashboardLoading(false);
      }
    };

    fetchDashboardData();
  }, [
    agents,
    dashboardRefreshKey,
    selectedAgentAddress,
    selectedChain,
    selectedChainId,
    selectedVault,
    walletAddress,
  ]);

  const handleInsuranceAction = async (
    item: InsuranceItem,
    action: "claim" | "invalidate",
  ) => {
    const token = getAuthToken(walletAddress);

    if (!token) {
      setToast({
        tone: "error",
        message: "Connect and sign in with your wallet first.",
      });
      return;
    }

    setPendingInsuranceId(item.id);
    setToast(null);

    try {
      const response = await fetch(
        `/api/insurances/${action}/${encodeURIComponent(item.id)}?chainId=${selectedChainId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = (await response.json()) as {
        txHash?: string;
        error?: string;
      };

      if (response.status === 401) {
        // cached JWT went stale; drop it so the next wallet action re-signs
        clearAuthToken();
        setToast({
          tone: "error",
          message: "Session expired — reconnect your wallet to sign in again.",
        });
        return;
      }

      if (!response.ok) {
        setToast({
          tone: "error",
          message: data.error ?? `Failed to ${action} insurance.`,
        });
        return;
      }

      setToast({
        tone: "success",
        message: `Insurance ${action === "claim" ? "claimed" : "invalidated"} (tx ${data.txHash}).`,
      });

      // remove the insurance and its position from the dashboard, and bump the refresh key so the server refetches
      setInsurance((current) => current.filter((entry) => entry.id !== item.id));
      setPositions((current) =>
        current.filter((position) => position.insuranceId !== item.id),
      );
      setSelectedInsuranceId((current) =>
        current === item.id ? null : current,
      );
      setDashboardRefreshKey((key) => key + 1);
    } catch (error) {
      console.error(`Failed to ${action} insurance`, error);
      setToast({ tone: "error", message: `Failed to ${action} insurance.` });
    } finally {
      setPendingInsuranceId(null);
    }
  };

  const handleChainChange = (nextChain: string) => {
    setSelectedChain(nextChain);
    setSelectedVaultId(null);
    setVaultPage(1);
  };

  // vault flows keep their inline status line and also raise a toast
  const notify = (tone: ToastMessage["tone"], message: string) => {
    setTransactionStatus(message);
    setToast({ tone, message });
  };

  const handleWalletDisconnect = () => {
    clearAuthToken();
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
      notify("error", "Wallet connection is unavailable.");
      return;
    }

    openConnectModal();
  };

  const refreshVaultAssets = async (vaultAddress: string) => {
    const holdings = await fetchVaultHoldings(vaultAddress, selectedChainId);

    setVaults((currentVaults) =>
      currentVaults.map((vault) =>
        vault.address === vaultAddress ? { ...vault, ...holdings } : vault,
      ),
    );
  };

  const handleVaultAction = async () => {
    if (!selectedVault) {
      notify("error", "Select a vault to continue.");
      return;
    }

    const requestedAmount = Number(amount);

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      notify("error", "Enter a valid amount.");
      return;
    }

    if (vaultAction === "withdraw") {
      const vaultAsset = [selectedVault.native, ...selectedVault.assets].find(
        (asset) => asset.token === selectedAsset,
      );
      const availableInVault = Number(vaultAsset?.availableBalance ?? "0");

      if (!vaultAsset || requestedAmount > availableInVault) {
        notify(
          "error",
          `Insufficient ${selectedAsset} balance in this vault (available: ${availableInVault}).`,
        );
        return;
      }
    } else if (requestedAmount > Number(walletTokenBalance)) {
      notify(
        "error",
        `Insufficient ${selectedAsset} balance in your wallet (available: ${walletTokenBalance}).`,
      );
      return;
    }

    setIsSubmitting(true);
    setTransactionStatus("");
    setToast(null);

    try {
      await executeVaultAction(
        vaultAction,
        selectedAsset,
        amount,
        selectedVault.address,
        selectedChain,
      );

      await Promise.all([
        refreshVaultAssets(selectedVault.address),
        loadWalletTokenBalance(),
      ]);

      notify(
        "success",
        `${vaultAction === "deposit" ? "Deposit" : "Withdraw"} executed successfully.`,
      );
    } catch (error) {
      notify("error", getFriendlyErrorMessage(error, "Vault transaction failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateVault = async (vaultName: string) => {
    if (!walletAddress) {
      await handleWalletConnect();
      if (!walletAddress) {
        return;
      }
    }

    const trimmedName = vaultName.trim() || `${selectedChain} Strategy Vault`;

    setIsSubmitting(true);
    setTransactionStatus("");
    setToast(null);

    try {
      const result = await createVaultOnFactory(trimmedName, selectedChain);

      notify(
        "success",
        result.vaultAddress !== "0x0000000000000000000000000000000000000000"
          ? `Vault created successfully: ${result.vaultAddress.slice(0, 6)}...${result.vaultAddress.slice(-4)}`
          : "Vault created successfully.",
      );

      if (
        result.vaultAddress !== "0x0000000000000000000000000000000000000000"
      ) {
        const nextVault: Vault = {
          id: `${result.vaultAddress}-${selectedChain}`,
          name: trimmedName,
          chain: selectedChain,
          address: result.vaultAddress,
          totalValue: "0 ETH",
          native: emptyAsset("ETH"),
          health: "Healthy",
          assets: [],
        };

        setVaults((currentVaults) => [nextVault, ...currentVaults]);
      }
    } catch (error) {
      notify("error", getFriendlyErrorMessage(error, "Vault creation failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenNewVaultDialog = () => {
    setNewVaultName(`${selectedChain} Strategy Vault`);
    setIsNewVaultDialogOpen(true);
  };

  const handleConfirmCreateVault = async () => {
    const vaultName = newVaultName;
    setIsNewVaultDialogOpen(false);
    await handleCreateVault(vaultName);
  };

  const validInsuranceCount = insurance.filter((item) => item.valid).length;

  const stats: Array<{
    label: string;
    value: string;
    change: string;
    tone: StatTone;
  }> = [
    {
      label: "TVL",
      value: selectedVault?.totalValue ?? "0 ETH",
      change: "Selected vault",
      tone: "emerald",
    },
    {
      label: "Vaults deployed",
      value: `${vaults.length}`,
      change: selectedChain,
      tone: "cyan",
    },
    {
      label: "Active agents",
      value: `${agents.length}`,
      change: "Registered",
      tone: "violet",
    },
    {
      label: "Insurance policies",
      value: `${insurance.length}`,
      change: `${validInsuranceCount} active`,
      tone: "amber",
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

  if (!walletAddress) {
    return (
      <HomePage
        onConnect={() => {
          setIsWalletMenuOpen(false);
          handleWalletConnect();
        }}
      />
    );
  }

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
              selectedAgentAddress={selectedAgentAddress}
              onAgentSelect={(address) => {
                setSelectedAgentAddress((current) =>
                  current === address ? null : address,
                );
                setIntentPage(1);
              }}
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
              onCreateVault={handleOpenNewVaultDialog}
              isSubmitting={isSubmitting}
            />

            <PositionsPanel
              positions={positions}
              selectedInsuranceId={selectedInsuranceId}
              onSelect={setSelectedInsuranceId}
              isLoading={isDashboardLoading}
            />
          </div>
        </ScrollReveal>

        <ScrollReveal className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <DashboardCard
            title="Deposit & withdraw"
            className="scroll-mt-24"
            titleClassName="text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]"
          >
            <div className="space-y-3">
              {!selectedVault ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b120f] p-4 text-center text-sm text-slate-400">
                  Select a vault to see its assets.
                </div>
              ) : (
                [selectedVault.native, ...selectedVault.assets].map((token) => (
                  <div
                    key={token.token}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b120f] p-3"
                  >
                    <div>
                      <p className="font-medium text-[#edf5ee]">
                        {token.token}
                      </p>
                      <Tooltip
                        label={`${token.lockedPercent.toFixed(1)}% of this vault's ${token.token} is locked in active positions`}
                      >
                        <p
                          className={`text-xs ${
                            token.lockedPercent > 0
                              ? "text-amber-300"
                              : "text-slate-400"
                          }`}
                        >
                          {token.lockedPercent.toFixed(1)}% locked
                        </p>
                      </Tooltip>
                    </div>
                    <Tooltip
                      label={`${token.totalDeposited} ${token.token} held by this vault (available + locked)`}
                    >
                      <p className="truncate font-medium text-[#edf5ee]">
                        {formatAmountForDisplay(token.totalDeposited)}
                      </p>
                    </Tooltip>
                  </div>
                ))
              )}
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
                  {supportedAssets.map((token) => (
                    <option key={token} value={token}>
                      {token}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-500">
                Wallet balance: {walletTokenBalance} {selectedAsset}
              </p>

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

              {statusMessage ? (
                <p className="max-h-24 overflow-y-auto break-words text-xs text-slate-300">
                  {statusMessage}
                </p>
              ) : null}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Trade insurances"
            className="scroll-mt-24"
            titleClassName="text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]"
          >
            <RiskMonitor
              insurance={insurance}
              selectedInsuranceId={selectedInsuranceId}
              onSelect={setSelectedInsuranceId}
              onAction={handleInsuranceAction}
              pendingInsuranceId={pendingInsuranceId}
              isLoading={isDashboardLoading}
            />
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

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <NewVaultDialog
        isOpen={isNewVaultDialogOpen}
        chainLabel={selectedChain}
        name={newVaultName}
        onNameChange={setNewVaultName}
        onCancel={() => setIsNewVaultDialogOpen(false)}
        onSubmit={handleConfirmCreateVault}
        isSubmitting={isSubmitting}
      />
    </main>
  );
}
