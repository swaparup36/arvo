import dotenv from "dotenv";
dotenv.config();

declare const process: { 
    env: {
        REDIS_URL?: string,
        ARVO_BACKEND_URL?: string,
        ETH_RPC_URL?: string,
        EXECUTOR_PRIVATE_KEY?: string,
        TRADE_CONFIRMATION_SECRET?: string,
        NODE_ENV?: string,
        UNISWAP_API_KEY?: string,
        MOCK_USDC_ADDRESS?: string,
    }
};


export const UNISWAP_API_KEY = process.env.UNISWAP_API_KEY!;
export const UNISWAP_API_URL = "https://trade-api.gateway.uniswap.org/v1";
export const REIDIS_URL = process.env.REDIS_URL!;
export const ARVO_BACKEND_URL = process.env.ARVO_BACKEND_URL!;
export const ETH_RPC_URL = process.env.ETH_RPC_URL!;
export const EXECUTOR_PRIVATE_KEY = process.env.EXECUTOR_PRIVATE_KEY!;
export const TRADE_CONFIRMATION_SECRET = process.env.TRADE_CONFIRMATION_SECRET!;
export const NODE_ENV = process.env.NODE_ENV || "development";
export const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!;