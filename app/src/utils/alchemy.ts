import { env } from "@/lib/env";

const chainIdToNetwork: Record<number, string> = {
    1: "eth-mainnet",
    11155111: "eth-sepolia",
}

export type VaultToken = {
    address: string;
    symbol: string;
    decimals: number;
    balance: string; // raw, base units
};

export type VaultTokens = {
    native: { symbol: string; decimals: number; balance: string };
    tokens: VaultToken[];
};

type RpcCall = { method: string; params: unknown[] };

async function rpc(chainId: number, calls: RpcCall[]) {
    const network = chainIdToNetwork[chainId];

    if (!network) {
        throw new Error(`Unsupported chainId: ${chainId}`);
    }

    const response = await fetch(
        `https://${network}.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
                calls.map((call, id) => ({ jsonrpc: "2.0", id, ...call })),
            ),
        },
    );

    if (!response.ok) {
        throw new Error(`Alchemy request failed: ${response.status}`);
    }

    const batch = (await response.json()) as Array<{
        id: number;
        result?: unknown;
        error?: { message: string };
    }>;

    // batched responses may come back out of order
    return calls.map((_, id) => {
        const entry = batch.find((item) => item.id === id);
        if (entry?.error) throw new Error(entry.error.message);
        return entry?.result;
    });
}

export async function getAllTokensHeldByTheVault(
    vaultAddress: string,
    chainId: number,
): Promise<VaultTokens> {
    const [nativeBalance, tokenBalances] = await rpc(chainId, [
        { method: "eth_getBalance", params: [vaultAddress, "latest"] },
        { method: "alchemy_getTokenBalances", params: [vaultAddress] },
    ]);

    const held = (
        (tokenBalances as { tokenBalances?: Array<{ contractAddress: string; tokenBalance: string }> })
            ?.tokenBalances ?? []
    ).filter((token) => BigInt(token.tokenBalance || "0") > BigInt(0));

    const metadata = held.length
        ? await rpc(
              chainId,
              held.map((token) => ({
                  method: "alchemy_getTokenMetadata",
                  params: [token.contractAddress],
              })),
          )
        : [];

    return {
        native: {
            symbol: "ETH",
            decimals: 18,
            balance: BigInt((nativeBalance as string) ?? "0x0").toString(),
        },
        tokens: held.map((token, index) => {
            const meta = metadata[index] as
                | { symbol?: string; decimals?: number }
                | undefined;

            return {
                address: token.contractAddress,
                symbol: meta?.symbol || token.contractAddress.slice(0, 6),
                decimals: meta?.decimals ?? 18,
                balance: BigInt(token.tokenBalance).toString(),
            };
        }),
    };
}
