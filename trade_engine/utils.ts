import axios from "axios";
import { ONE_INCH_API_KEY, ONE_INCH_BASE_URL } from "./constants.js";
import type { GetAllowanceRequest, GetApproveDataRequest, GetSwapCallDataRequest } from "./types.js";

// get call data for swap on 1inch
export async function getSwapCallData(request: GetSwapCallDataRequest) {
    try {
        const { chainId, tokenIn, tokenOut, amountIn, from, origin, minAmountOut } = request;

        const url = `${ONE_INCH_BASE_URL}/${chainId}/swap`;

        const config = {
            headers: {
                Authorization: `Bearer ${ONE_INCH_API_KEY}`,
            },
            params: {
                src: tokenIn,
                dst: tokenOut,
                amount: amountIn,
                minReturn: minAmountOut,
            },
            paramsSerializer: {
                indexes: null,
            },
        };

        const response = await axios.get(url, config);
        console.log(response.data);

        return response.data;
    } catch (error) {
        console.error("Error getting swap call data:", error);
        throw new Error("Failed to get swap call data");
    }
}

// get address of the 1inch Router that is trusted to spend funds for the swap
export async function getRouterAddress(chainId: number) {
    try{
        const url = `${ONE_INCH_BASE_URL}/${chainId}/approve/spender`;

        const config = {
            headers: {
            Authorization: `Bearer ${ONE_INCH_API_KEY}`,
            },
            params: {},
                paramsSerializer: {
                indexes: null,
            },
        };
        const response = await axios.get(url, config);
        return response.data;
    } catch (error) {
        console.error("Error getting router address:", error);
        throw new Error("Failed to get router address");
    }
}

// get the number of tokens that the 1inch Router is allowed to swap
export async function getAllowance(request: GetAllowanceRequest) {
    try {
        const { chainId, tokenAddress, walletAddress } = request;

        const url = `${ONE_INCH_BASE_URL}/${chainId}/approve/allowance`;
        const config = {
            headers: {
                Authorization: `Bearer ${ONE_INCH_API_KEY}`,
            },
            params: {
                tokenAddress: tokenAddress,
                walletAddress: walletAddress,
                chainId: chainId,
            },
            paramsSerializer: {
                indexes: null,
            },
        };

        const response = await axios.get(url, config);
        console.log(response.data);

        return response.data;
    } catch (error) {
        console.error("Error getting allowance:", error);
        throw new Error("Failed to get allowance");
    }
}

// get approve calldata to allow 1inch Router to perform a swap
export async function getApproveCallData(request: GetApproveDataRequest) {
    try {
        const { chainId, tokenAddress, amount } = request;
        
        const url = `${ONE_INCH_BASE_URL}/${chainId}/approve/transaction`;
        const config = {
            headers: {
                Authorization: `Bearer ${ONE_INCH_API_KEY}`,
            },
            params: {
                tokenAddress: tokenAddress,
                amount: amount,
            },
            paramsSerializer: {
                indexes: null,
            },
        };

        const response = await axios.get(url, config);
        console.log(response.data);

        return response.data;
    } catch (error) {
        console.error("Error generating approve call data:", error);
        throw new Error("Failed to generate approve call data");
    }
}