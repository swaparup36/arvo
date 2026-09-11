import { ethers } from "ethers";
import { VAULT_ABI } from "./abi.js";
import { EXECUTOR_PRIVATE_KEY, ETH_RPC_URL, SEPOLIA_RPC_URL } from "../constants.js";


const RPC_URLS: { [chainId: number]: string } = {
    1: ETH_RPC_URL,
    11155111: SEPOLIA_RPC_URL,
};

// singleton pattern to ensure only one instance of the contract is created
const vaultInstances: { [chainId: number]: { [vaultAddress: string]: ethers.Contract } } = {};

// one signer per chain, shared by every vault
const signers: { [chainId: number]: ethers.NonceManager } = {};

function getSigner(chainId: number): ethers.NonceManager {
  if (!signers[chainId]) {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
    signers[chainId] = new ethers.NonceManager(new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider));
  }

  return signers[chainId]!;
}

export function resetNonce(chainId: number) {
  signers[chainId]?.reset();
}

export function getVaultContract(vaultAddress: string, chainId: number): ethers.Contract {
  if (!vaultInstances[chainId]) {
    vaultInstances[chainId] = {};
  }

  if (!vaultInstances[chainId][vaultAddress]) {
    vaultInstances[chainId][vaultAddress] = new ethers.Contract(
      vaultAddress,
      VAULT_ABI,
      getSigner(chainId)
    );
  }

  return vaultInstances[chainId][vaultAddress];
}
