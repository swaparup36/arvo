import { ethers } from "ethers";
import { env } from "../lib/env";
import { ARVO_MAIN_ABI, ERC20_ABI } from "./abi";


const RPC_URLS: { [chainId: number]: string } = {
    11155111: env.SEPOLIA_RPC_URL,
};

// singleton pattern to ensure only one instance of the contract is created
const arvoMainInstances: { [chainId: number]: ethers.Contract } = {};

export function getArvoMain(chainId: number): ethers.Contract {
  if (!arvoMainInstances[chainId]) {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
    const wallet = new ethers.Wallet(env.OWNER_PRIVATE_KEY, provider);
    arvoMainInstances[chainId] = new ethers.Contract(
      env.ARVO_MAIN_ADDRESS,
      ARVO_MAIN_ABI,
      wallet
    );
  }
  return arvoMainInstances[chainId];
}

const erc20Instances: { [chainId: number]: { [tokenAddress: string]: ethers.Contract } } = {};

export function getERC20Contract(tokenAddress: string, chainId: number): ethers.Contract {
  if (!erc20Instances[chainId]) {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
    const wallet = new ethers.Wallet(env.OWNER_PRIVATE_KEY, provider);

    if (!erc20Instances[chainId]) {
      erc20Instances[chainId] = {};
    }

    erc20Instances[chainId][tokenAddress] = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      wallet
    );
  }
  return erc20Instances[chainId][tokenAddress];
}