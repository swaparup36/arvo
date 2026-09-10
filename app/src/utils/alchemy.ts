import { env } from "@/lib/env";

const chainIdToNetwork: Record<number, string> = {
    11155111: "eth-sepolia"
}

export async function getAllTokensHeldByTheVault(vaultAddress: string, chainId: number): Promise<string[]> {
    const ALCHEMY_URL = `https://${chainIdToNetwork[chainId]}.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;

    const response = await fetch(ALCHEMY_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "alchemy_getTokenBalances",
            params: [vaultAddress],
            id: 1,
        }),
    });

    if (!response.ok) {
        throw new Error(`Alchemy request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    return data.result.tokenBalances.map((token: { contractAddress: string }) => token.contractAddress);
}