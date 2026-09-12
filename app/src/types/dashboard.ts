export type Agent = {
  name: string;
  address: string;
  vaultAddress: string;
  createdAt: string;
};

export type TradeIntent = {
  pair: string;
  amount: string;
  status: "Queued" | "Review" | "Approved" | "Executed";
  eta: string;
  agent: string;
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
  health: "Healthy" | "Monitoring" | "At risk";
  assets: VaultAsset[];
};
