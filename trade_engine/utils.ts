import { UNISWAP_API_URL, UNISWAP_API_KEY  } from "./constants.js";
import type { GetQuoteParams, getSwapApprovalReq, SwapApprovalResponse, UniswapQuoteResponse, UniswapSwapResponse, UniswapSwapTransaction } from "./types.js";

const UNISWAP_ROUTER_VERSION = "2.0";

export const CHAIN_TO_UNISWAP_PROXY: Record<number, string> = {
    1: "0x0000000085E102724e78eCd2F45DC9cA239Affad"
}


export async function getSwapApprovalData(request: getSwapApprovalReq): Promise<SwapApprovalResponse | null> {
    try {
        const { chainId, tokenIn, tokenOut, amountIn, vaultAddress } = request;
        const response = await fetch(
            `${UNISWAP_API_URL}/check_approval`,
            {
                method: "POST",
                headers: {
                    "x-api-key": UNISWAP_API_KEY,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "x-permit2-disabled": "true",
                },

                body: JSON.stringify({
                    walletAddress: vaultAddress,
                    token: tokenIn,
                    amount: amountIn,
                    chainId,
                    tokenOut,
                    tokenOutChainId: chainId,
                }),
            }
        );

        if (!response.ok) {
            console.error("Failed to get swap approval data from Uniswap API");
            return null;
        }

        const result = (await response.json()) as SwapApprovalResponse;

        return result;
    } catch (error) {
        console.error("Error occurred while fetching swap approval data from Uniswap API", error);
        return null;
    }
}

export async function getSwapCallData(quote: any): Promise<UniswapSwapTransaction | null> {
    try {
        const response = await fetch(
            `${UNISWAP_API_URL}/swap`,
            {
                method: "POST",
                headers: {
                    "x-api-key": UNISWAP_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "x-universal-router-version": UNISWAP_ROUTER_VERSION,
                    "x-permit2-disabled": "true",
                },
                body: JSON.stringify({
                    quote,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error(`Uniswap /swap failed: ${error}`);
            return null;
        }

        const result = (await response.json()) as UniswapSwapResponse;

        if (!result.swap) {
            console.error("Uniswap /swap returned no swap data");
            return null;
        }

        if (!result.swap.to) {
            console.error("Uniswap /swap returned no 'to' address");
            return null;
        }

        if (!result.swap.data) {
            console.error("Uniswap /swap returned no 'data' field");
            return null;
        }

        return result.swap;
    } catch (error) {
        console.error("Error occurred while fetching swap call data from Uniswap API", error);
        return null;
    }
}

export async function getQuote(params: GetQuoteParams): Promise<UniswapQuoteResponse | null> {
    try {
        const response = await fetch(
            `${UNISWAP_API_URL}/quote`,
            {
                method: "POST",
                headers: {
                    "x-api-key": UNISWAP_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "x-universal-router-version": UNISWAP_ROUTER_VERSION,
                    "x-permit2-disabled": "true",
                },
                body: JSON.stringify({
                    "type": "EXACT_INPUT",
                    "amount": params.amountIn,
                    "tokenInChainId": params.chainId,
                    "tokenOutChainId": params.chainId,
                    "tokenIn": params.tokenIn,
                    "tokenOut": params.tokenOut,
                    "swapper": params.vaultAddress,
                    "protocols": [
                        "V2",
                        "V3",
                        "V4",
                    ]
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error(`Uniswap /quote failed: ${error}`);
            return null;
        }

        const result = (await response.json()) as UniswapQuoteResponse;

        if (!result.quote) {
            console.error("Uniswap /quote returned no quote data");
            return null;
        }

        return result;
    } catch (error) {
        console.error("Error occurred while fetching quote from Uniswap API", error);
        return null;
    }
}