import { getVault } from "./onChainConfig";

export async function availableBalance(vaultAddress: string, asset: string, chainId: number) {
  const vault = getVault(vaultAddress, chainId);
  const balance = await vault.availableBalance(asset);

  return balance;
}

export async function lockedBalance(vaultAddress: string, asset: string, chainId: number) {
  const vault = getVault(vaultAddress, chainId);
  const locked = await vault.lockedAmount(asset);

  return locked;
}