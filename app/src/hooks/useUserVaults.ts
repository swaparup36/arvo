"use client";

import { BrowserProvider, Contract } from "ethers";
import { useEffect, useState } from "react";

import { chainIdMap } from "@/lib/dashboard-data";
import { CHAIN_TO_VAULT_FACTORY_PUBLIC_ADDRESS, getWalletProvider } from "@/lib/wallet";
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
        const expectedChainId =
          chainIdMap[selectedChain];

        if (Number(chainId).toString() !== expectedChainId) {
          if (isMounted) {
            setVaults([]);
          }
          return;
        }

        const factoryAddress = CHAIN_TO_VAULT_FACTORY_PUBLIC_ADDRESS[Number(expectedChainId)];

        if (!factoryAddress) {
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
              totalValue: "0 ETH",
              native: {
                token: "ETH",
                totalDeposited: "0",
                availableBalance: "0",
                lockedPercent: 0,
              },
              health: "Healthy" as const,
              assets: [],
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
