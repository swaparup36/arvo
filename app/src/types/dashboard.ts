export type Agent = {
  name: string;
  address: string;
  vaultAddress: string;
  createdAt: string;
};

export type TradeConfirmationDetails = {
  transactionHash: string;
  amountIn: string;
  amountOut: string;
  executedAt: string;
};

export type RiskAssessmentDetails = {
  riskScore: number;
  premium: string;
  coverage: number;
  coverageDuration: string;
  assessedAt: string;
  expiresAt: string;
};

export type TradeIntent = {
  id: string;
  pair: string;
  amount: string;
  status: "Queued" | "Review" | "Approved" | "Executed";
  eta: string;
  agent: string;
  tradeConfirmed: boolean;
  risk: number | null;
  confirmation: TradeConfirmationDetails | null;
  assessment: RiskAssessmentDetails | null;
};

export type Position = {
  id: string;
  pair: string;
  amountIn: string;
  amountOut: string;
  status: "Active" | "Closed";
  openedAt: string;
};

export type InsuranceItem = {
  id: string;
  premium: string;
  coverage: string;
  duration: string;
  valid: boolean;
  createdAt: string;
};

export type VaultAsset = {
  token: string;
  totalDeposited: string;
  availableBalance: string;
  lockedPercent: number;
};

export type Vault = {
  id: string;
  name: string;
  chain: string;
  address: string;
  totalValue: string;
  native: VaultAsset;
  health: "Healthy" | "Monitoring" | "At risk";
  assets: VaultAsset[];
};
