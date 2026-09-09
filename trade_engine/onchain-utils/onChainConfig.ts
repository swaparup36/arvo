import { ethers } from "ethers";
import { VAULT_ABI } from "./abi.js";
import { EXECUTOR_PRIVATE_KEY, SEPOLIA_RPC_URL } from "../constants.js";


const RPC_URLS: { [chainId: number]: string } = {
    11155111: SEPOLIA_RPC_URL,
};

// singleton pattern to ensure only one instance of the contract is created
const vaultInstances: { [chainId: number]: { [vaultAddress: string]: ethers.Contract } } = {};

export function getVaultContract(vaultAddress: string, chainId: number): ethers.Contract {
  if (!vaultInstances[chainId]) {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
    const wallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

    if (!vaultInstances[chainId]) {
      vaultInstances[chainId] = {};
    }

    vaultInstances[chainId][vaultAddress] = new ethers.Contract(
      vaultAddress,
      VAULT_ABI,
      wallet
    );
  }
  return vaultInstances[chainId][vaultAddress]!;
}