import { ethers } from "ethers";
import { env } from "../lib/env";
import { ARVO_MAIN_ABI, ERC20_ABI, VAULT_CONTRACT_ABI } from "./abi";
import { CHAIN_TO_ARVO_MAIN_ADDRESS } from "./arvoMain";


const RPC_URLS: { [chainId: number]: string } = {
  1: env.ETHEREUM_RPC_URL,
  11155111: env.SEPOLIA_RPC_URL,
};

// singleton pattern to ensure only one instance of the contract is created
const arvoMainInstances: { [chainId: number]: ethers.Contract } = {};

export function getArvoMain(chainId: number): ethers.Contract {
  if (!arvoMainInstances[chainId]) {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
    const wallet = new ethers.Wallet(env.OWNER_PRIVATE_KEY, provider);
    console.log("public address: ", wallet.address);
    arvoMainInstances[chainId] = new ethers.Contract(
      CHAIN_TO_ARVO_MAIN_ADDRESS[chainId],
      ARVO_MAIN_ABI,
      wallet
    );
  }
  return arvoMainInstances[chainId];
}

const erc20Instances: { [key: string]: ethers.Contract } = {};

export function getERC20Contract(tokenAddress: string, chainId: number): ethers.Contract {
  const key = `${chainId}:${tokenAddress}`;
  if (!erc20Instances[key]) {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
    const wallet = new ethers.Wallet(env.OWNER_PRIVATE_KEY, provider);
    erc20Instances[key] = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  }
  return erc20Instances[key];
}

export function getVault(vaultAddress: string, chainId: number): ethers.Contract {
  const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
  const wallet = new ethers.Wallet(env.OWNER_PRIVATE_KEY, provider);
  return new ethers.Contract(vaultAddress, VAULT_CONTRACT_ABI, wallet);
}

export function getSigner(chainId: number): ethers.Wallet {
  const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
  return new ethers.Wallet(env.OWNER_PRIVATE_KEY, provider);
}