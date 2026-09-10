import { getVault } from "./onChainConfig";

export async function availableBalance(vaultAddress: string, asset: string, chainId: number) {
  const vault = getVault(vaultAddress, chainId);
  const balance = await vault.availableBalance(asset);

  return balance;
}