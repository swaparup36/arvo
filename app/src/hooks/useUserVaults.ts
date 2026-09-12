"use client";

import { BrowserProvider, Contract } from "ethers";
import { useEffect, useState } from "react";

import { getWalletProvider } from "@/lib/wallet";
import type { Vault } from "@/types/dashboard";

const FACTORY_ABI = [
  "function getUserVaults(address user) view returns(address[])",
];

const VAULT_ABI = ["function vaultName() view returns(string)"];

export function useUserVaults(selectedChain: string, walletAddress?: string) {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadVaults = async () => {
      if (!walletAddress) {
        if (isMounted) {
          setVaults([]);
          setError(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const provider = new BrowserProvider(getWalletProvider());
        const chainId = (await provider.send("eth_chainId", [])) as string;
        const expectedChainId = (() => {
          const map: Record<string, string> = {
            Ethereum: "1",
            Sepolia: "11155111",
            Base: "8453",
            Arbitrum: "42161",
            Optimism: "10",
          };

          return map[selectedChain] ?? map.Base;
        })();

        if (Number(chainId).toString() !== expectedChainId) {
          if (isMounted) {
            setVaults([]);
          }
          return;
        }

        const factoryAddress =
          process.env.NEXT_PUBLIC_VAULT_FACTORY_ADDRESS ??
          process.env.VAULT_FACTORY_ADDRESS ??
          "0x5eE27A4EE0D186309615d799F20c1f45CC4E350D";

        if (
          !factoryAddress ||
          factoryAddress === "0x0000000000000000000000000000000000000000"
        ) {
          if (isMounted) {
            setVaults([]);
          }
          return;
        }

        const factoryContract = new Contract(
          factoryAddress,
          FACTORY_ABI,
          provider,
        );

        const userVaultAddresses =
          await factoryContract.getUserVaults(walletAddress);
        const normalizedAddresses = (userVaultAddresses ?? []).filter(Boolean);

        const vaultRecords = await Promise.all(
          normalizedAddresses.map(async (vaultAddress: string) => {
            const vaultContract = new Contract(
              vaultAddress,
              VAULT_ABI,
              provider,
            );
            const vaultName = await vaultContract.vaultName();

            return {
              id: `${vaultAddress}-${selectedChain}`,
              name: vaultName || `${selectedChain} Strategy Vault`,
              chain: selectedChain,
              address: vaultAddress,
              totalValue: "$0",
              health: "Healthy" as const,
              assets: [
                {
                  token: "USDC",
                  totalDeposited: "0",
                  availableBalance: "0",
                  lockedPercent: 0,
                },
                {
                  token: "ETH",
                  totalDeposited: "0",
                  availableBalance: "0",
                  lockedPercent: 0,
                },
              ],
            } satisfies Vault;
          }),
        );

        if (isMounted) {
          setVaults(vaultRecords);
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load user vaults.",
          );
          setVaults([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadVaults();

    return () => {
      isMounted = false;
    };
  }, [selectedChain, walletAddress]);

  return {
    vaults,
    isLoading,
    error,
  };
}
