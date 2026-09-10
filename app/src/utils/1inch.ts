import { env } from "@/lib/env";
import { getSwapQuoteRequest } from "@/types/schema";

// get quote for swap on 1inch
export async function getSwapQuote(request: getSwapQuoteRequest) {
    try {
        const { chainId, tokenIn, tokenOut, amountIn } = request;

        const url = `${env.ONE_INCH_BASE_URL}/${chainId}/swap`;

        const config = {
            headers: {
                Authorization: `Bearer ${env.ONE_INCH_API_KEY}`,
            },
            params: {
                src: tokenIn,
                dst: tokenOut,
                amount: amountIn,
            },
            paramsSerializer: {
                indexes: null,
            },
        };

        const response = await fetch(url, config);
        const data = await response.json();
        console.log(data);

        return data;
    } catch (error) {
        console.error("Error getting swap call data:", error);
        throw new Error("Failed to get swap call data");
    }
}