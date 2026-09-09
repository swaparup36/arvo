declare const process: { 
    env: { 
        ONE_INCH_API_KEY?: string,
        REDIS_URL?: string,
        ARVO_BACKEND_URL?: string,
        SEPOLIA_RPC_URL?: string,
        EXECUTOR_PRIVATE_KEY?: string,
        TRADE_CONFIRMATION_SECRET?: string,
    }
};


export const ONE_INCH_BASE_URL = "https://api.1inch.com/swap/v6.1";
export const ONE_INCH_API_KEY = process.env.ONE_INCH_API_KEY!;
export const REIDIS_URL = process.env.REDIS_URL!;
export const ARVO_BACKEND_URL = process.env.ARVO_BACKEND_URL!;
export const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL!;
export const EXECUTOR_PRIVATE_KEY = process.env.EXECUTOR_PRIVATE_KEY!;
export const TRADE_CONFIRMATION_SECRET = process.env.TRADE_CONFIRMATION_SECRET!;
