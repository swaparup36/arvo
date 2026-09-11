export type Agent = {
  name: string;
  strategy: string;
  status: "Active" | "Review" | "Paused";
  pnl: string;
  risk: "Low" | "Medium" | "High";
  wallet: string;
};

export type TradeIntent = {
  pair: string;
  side: "Buy" | "Sell" | "Swap";
  amount: string;
  status: "Queued" | "Review" | "Approved" | "Executed";
  eta: string;
  agent: string;
};

export type Position = {
  asset: string;
  size: string;
  value: string;
  pnl: string;
  status: "Locked" | "Available" | "Expiring";
};

export type InsuranceItem = {
  label: string;
  value: string;
  change: string;
  tone: "emerald" | "amber" | "cyan";
};

export type VaultAsset = {
  token: string;
  balance: string;
  apy: string;
  locked: string;
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
