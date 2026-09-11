import { getVaultContract } from "./onChainConfig.js";

export async function approveTokenOnVault(vaultAddress: string, token: string, spender: string, amount: bigint, chainId: number) {
  const vault = getVaultContract(vaultAddress, chainId);

  if (!vault.approveToken) {
    console.error("approveToken function is not available on the vault contract");
    return {
      txHash: null,
      receipt: null
    };
  }

  const tx = await vault.approveToken(token, spender, amount);

  const receipt = await tx.wait();

  return {
    txHash: receipt!.hash,
    receipt
  };
}

export async function executeOnVault(vaultAddress: string, target: string, value: bigint, data: string, chainId: number) {
  const vault = getVaultContract(vaultAddress, chainId);

  if (!vault.execute) {
    console.error("execute function is not available on the vault contract");
    return {
      txHash: null,
      receipt: null
    };
  }

  const tx = await vault.execute(target, value, data);
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    receipt
  };
}