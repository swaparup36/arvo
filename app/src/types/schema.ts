import { Address } from "viem";

export type CreateTradeIntentRequest = {
    id: string;
    userAddress: string;
    agentAddress: string;
    vaultAddress: string;
    chainId: number;

    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    minAmountOut: string;
    deadline: number;

    maxPremium: string;
    minCoverage: number;
    minCoverageDuration: number;

    signature: string;
}

export type OnChainSubmitTradeIntentStruct = {
    id: string;
    userAddress: Address;
    agentAddress: Address;
    vaultAddress: Address;
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    minAmountOut: bigint;
    deadline: bigint;
    maxPremium: bigint;
    minCoverage: number;
    minCoverageDuration: bigint;
    signature: string;
    status: number;
    createdAt: bigint;
}

export type CreateRiskReportRequest = {
    id: string; // uuid minted and signed by the risk engine

    intentId: string;

    riskScore: number; // integer 0-100
    premium: string; // premium token base units
    coverage: number; // integer 0-100
    coverageDuration: string; // seconds

    signature: string;
    assessedAt: number; // unix seconds
    expiresAt: number; // unix seconds

    assessmentHash: string;
}

export type OnChainSubmitRiskAssessmentStruct = {
    id: string;
    intentId: string;
    riskScore: number; // the risk score of the trade, in percentage (0-100)
    premium: bigint; // the premium that needs to be paid for the coverage, in wei
    coverage: number; // the amount of coverage that can be issued for the trade, in percentage (0-100)
    coverageDuration: bigint; // duration for which the issued coverage can be valid, in seconds
    signature: string; // signature of the risk assessment, signed by the risk engine's private key
    assessedAt: bigint;
    expiresAt: bigint;
    assessmentHash: string;
}

export type CreateTradeConfirmationRequest = {
    id: string;
    intentId: string;

    transactionHash: string;
    chainId: number;

    tokenIn: string;
    tokenOut: string;

    amountIn: string;
    amountOut: string;

    signature: string;
    executedAt: Date;
}

export type OnChainSubmitTradeConfirmationStruct = {
  id: string;
  intentId: string;
  transactionHash: string;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  signature: string;
  executedAt: bigint;
  createdAt: bigint;
};

export type VerifyWalletRequest = {
    address: string;
    signature: string;
}

export type getSwapApprovalReq = {
    chainId: number; 
    tokenIn: string; 
    tokenOut: string; 
    amountIn: string; 
    vaultAddress: string
}

export type SwapApprovalData = {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
}

export type SwapApprovalResponse = {
  requestId: string;
  approval: SwapApprovalData | null;
  cancel: SwapApprovalData | null;
  gasFee?: string;
  cancelGasFee?: string;
}

export type UniswapSwapTransaction = {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
}

export type UniswapSwapResponse = {
  requestId: string;
  swap: UniswapSwapTransaction;
  gasFee?: string;
}

export type GetQuoteParams = {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  vaultAddress: string;
}

export type UniswapQuoteResponse = {
  requestId: string;
  quote: any;
  routing: string;
  isTokenApprovalApplicable?: boolean;
  permitData?: any;
}