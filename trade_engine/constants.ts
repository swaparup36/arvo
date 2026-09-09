declare const process: { 
    env: { 
        ONE_INCH_API_KEY?: string,
        REDIS_URL?: string,
    } 
};


export const ONE_INCH_BASE_URL = "https://api.1inch.com/swap/v6.1";
export const ONE_INCH_API_KEY = process.env.ONE_INCH_API_KEY!;
export const REIDIS_URL = process.env.REDIS_URL!;
