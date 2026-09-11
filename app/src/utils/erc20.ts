import { env } from "@/lib/env";
import { getERC20Contract } from "./onChainConfig";

export const CHAIN_TO_USDC_ADDRESS: Record<number, string> = {
    11155111: env.USDC_SEPOLIA_ADDRESS,
};

// get the number of decimals for a given ERC20 token on a specific chain
export async function getTokenDecimals(tokenAddress: string, chainId: number): Promise<number> {
    const tokenContract = getERC20Contract(tokenAddress, chainId);
    return Number(await tokenContract.decimals());
}

export async function getTokenBalance(tokenAddress: string, walletAddress: string, chainId: number): Promise<string | null> {
    try {
        const tokenContract = getERC20Contract(tokenAddress, chainId);
        const balance = await tokenContract.balanceOf(walletAddress);
        return balance.toString();
    } catch (error) {
        console.error("Error in getTokenBalance:", error);
        return null;
    }
}

export async function setTokenAllowance(tokenAddress: string, spenderAddress: string, amount: bigint, chainId: number) {
    try {
        const tokenContract = getERC20Contract(tokenAddress, chainId);
        const tx = await tokenContract.approve(spenderAddress, amount);
        const receipt = await tx.wait();
        return {
            txHash: receipt.hash,
            receipt
        };
    } catch (error) {
        console.error("Error in setTokenAllowance:", error);
        return {
            txHash: null,
            receipt: null
        };
    }
}

export async function transferToken(tokenAddress: string, toAddress: string, amount: bigint, chainId: number) {
    try {
        const tokenContract = getERC20Contract(tokenAddress, chainId);
        const tx = await tokenContract.transfer(toAddress, amount);
        const receipt = await tx.wait();
        return {
            txHash: receipt.hash,
            receipt
        };
    } catch (error) {
        console.error("Error in transferToken:", error);
        return {
            txHash: null,
            receipt: null
        };
    }
}