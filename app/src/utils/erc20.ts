import { getERC20Contract } from "./onChainConfig";

// get the number of decimals for a given ERC20 token on a specific chain
export async function getTokenDecimals(tokenAddress: string, chainId: number): Promise<number> {
    const tokenContract = getERC20Contract(tokenAddress, chainId);
    return Number(await tokenContract.decimals());
}