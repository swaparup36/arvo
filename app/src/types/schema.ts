export type CreateTradeIntentRequest = {
    userAddress: string;
    agentAddress: string;
    vaultAddress: string;
    chainId: number;

    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    minAmountOut: number;
    deadline: string;

    maxPremium: number;
    maxCoverage: number;
    requestedCoverageDuration: bigint;

    signature: string;
}

export type CreateRiskReportRequest = {
    intentId: string;

    canBeInsured: boolean;
    tradeAllowed: boolean;

    riskScore: number;
    premium: number;
    coverageAmount: number;
    coverageDuration: bigint;

    signature: string;
    assessedAt: Date;
    expiresAt: Date;

    assessmentHash: string;
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

export type VerifyWalletRequest = {
    address: string;
    signature: string;
}