export type TradeIntent = {
    userAddress: string;
    agentAddress: string;
    vaultAddress: string;
    chainId: number;
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    minAmountOut: bigint;
    deadline: Date;
    maxPremium: bigint;
    maxCoverage: number; // in percentage
    requestedCoverageDuration: bigint; // in seconds
    signature: string;
    status: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

export type GetSwapCallDataRequest = {
    chainId: number;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    from: string;
    origin: string;
    minAmountOut: string;
}

export type GetAllowanceRequest = {
    chainId: number;
    tokenAddress: string;
    walletAddress: string;
}

export type GetApproveDataRequest = {
    chainId: number;
    tokenAddress: string;
    amount: string;
}