import { ethers } from "ethers";

const providers: Record<number, ethers.JsonRpcProvider> = {
    1: new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL),
    137: new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL),
    42161: new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL),
    10: new ethers.JsonRpcProvider(process.env.OPTIMISM_RPC_URL),
    8453: new ethers.JsonRpcProvider(process.env.BASE_RPC_URL),
};

// get the number of decimals for a given ERC20 token on a specific chain
export async function getTokenDecimals(tokenAddress: string, chainId: number): Promise<number> {
    const provider = providers[chainId];

    if (!provider) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    const erc20Abi = [
        "function decimals() view returns (uint8)"
    ];

    const tokenContract = new ethers.Contract(
        tokenAddress,
        erc20Abi,
        provider
    );

    return Number(await tokenContract.decimals());
}