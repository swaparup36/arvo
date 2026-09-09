export type TradeIntent = {
    id: string;
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
    minCoverage: number; // in percentage
    minCoverageDuration: bigint; // in seconds
    signature: string;
    status: string;
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

export type CreateTradeConfirmationRequest = {
    intentId: string;

    transactionHash: string;
    chainId: number;

    tokenIn: string;
    tokenOut: string;

    amountIn: bigint;
    amountOut: bigint;

    signature: string;
    executedAt: Date;
}