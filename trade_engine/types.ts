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