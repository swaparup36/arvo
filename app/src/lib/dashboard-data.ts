import type {
  Agent,
  InsuranceItem,
  Position,
  TradeIntent,
  Vault,
} from "@/types/dashboard";

export const chainOptions = [
  "Ethereum",
  "Sepolia",
  "Base",
  "Arbitrum",
  "Optimism",
];

export const chainIdMap: Record<string, string> = {
  Ethereum: "1",
  Sepolia: "11155111",
  Base: "8453",
  Arbitrum: "42161",
  Optimism: "10",
};

export const tokenDecimals: Record<string, number> = {
  ETH: 18,
  USDC: 6,
  WBTC: 8,
  ARB: 18,
  SOL: 18,
};

export const tokenAddressesByChain: Record<string, Record<string, string>> = {
  Ethereum: {
    ETH: "0x0000000000000000000000000000000000000000",
    USDC: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    ARB: "0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1",
  },
  Sepolia: {
    ETH: "0x0000000000000000000000000000000000000000",
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    WBTC: "0x0000000000000000000000000000000000000000",
    ARB: "0x0000000000000000000000000000000000000000",
  },
  Base: {
    ETH: "0x0000000000000000000000000000000000000000",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WBTC: "0xCbb7C0000dB88B473b1fC8f7f5Ac3Eb2f7db7E0F",
    ARB: "0x0Ff5a0037279b79B7d5174Ef7cF4B5130A2E5AeA",
  },
  Arbitrum: {
    ETH: "0x0000000000000000000000000000000000000000",
    USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
  },
  Optimism: {
    ETH: "0x0000000000000000000000000000000000000000",
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    WBTC: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
    ARB: "0x0507A7AB9cBf1be6a2758238D9d3A5CA60D8415D",
  },
};

export const defaultAgents: Agent[] = [
  {
    name: "Alpha Core",
    strategy: "Momentum long",
    status: "Active",
    pnl: "+$48.2K",
    risk: "Low",
    wallet: "0xA1C...4D3F",
  },
  {
    name: "Delta Hedge",
    strategy: "Cross-market hedge",
    status: "Review",
    pnl: "+$31.7K",
    risk: "Medium",
    wallet: "0xD9E...1A7B",
  },
  {
    name: "Yield Nest",
    strategy: "Stable yield",
    status: "Active",
    pnl: "+$22.4K",
    risk: "Low",
    wallet: "0x7F4...75A1",
  },
];

export const defaultTradeIntents: TradeIntent[] = [
  {
    pair: "ETH / USDC",
    side: "Buy",
    amount: "$210K",
    status: "Queued",
    eta: "2m ago",
    agent: "Alpha Core",
  },
  {
    pair: "ARB / USDC",
    side: "Sell",
    amount: "$84K",
    status: "Review",
    eta: "11m ago",
    agent: "Delta Hedge",
  },
  {
    pair: "WBTC / ETH",
    side: "Swap",
    amount: "$146K",
    status: "Approved",
    eta: "21m ago",
    agent: "Yield Nest",
  },
  {
    pair: "SOL / USDC",
    side: "Buy",
    amount: "$96K",
    status: "Executed",
    eta: "48m ago",
    agent: "Alpha Core",
  },
];

export const defaultPositions: Position[] = [
  {
    asset: "ETH",
    size: "4.83",
    value: "$16.2K",
    pnl: "+8.3%",
    status: "Locked",
  },
  {
    asset: "USDC",
    size: "88,420",
    value: "$88.4K",
    pnl: "+1.1%",
    status: "Available",
  },
  {
    asset: "WBTC",
    size: "0.42",
    value: "$28.4K",
    pnl: "+4.9%",
    status: "Expiring",
  },
  {
    asset: "ARB",
    size: "12,480",
    value: "$7.6K",
    pnl: "+3.2%",
    status: "Locked",
  },
];

export const defaultInsurance: InsuranceItem[] = [
  {
    label: "Protection pool",
    value: "$2.1M",
    change: "+$120K",
    tone: "emerald",
  },
  {
    label: "Claims pending",
    value: "$194K",
    change: "3 active",
    tone: "amber",
  },
  { label: "Coverage ratio", value: "96.4%", change: "+2.7%", tone: "cyan" },
];

export const defaultVaults: Vault[] = [
  {
    id: "vault-01",
    name: "Primary Strategy Vault",
    chain: "Base",
    address: "0x0000000000000000000000000000000000000001",
    totalValue: "$2.85M",
    health: "Healthy",
    assets: [
      { token: "USDC", balance: "1.2M", apy: "5.1%", locked: "$480K" },
      { token: "ETH", balance: "416", apy: "3.4%", locked: "$232K" },
      { token: "ARB", balance: "82K", apy: "7.8%", locked: "$140K" },
    ],
  },
  {
    id: "vault-02",
    name: "Low Vol Vault",
    chain: "Arbitrum",
    address: "0x0000000000000000000000000000000000000002",
    totalValue: "$1.63M",
    health: "Monitoring",
    assets: [
      { token: "USDC", balance: "620K", apy: "4.8%", locked: "$210K" },
      { token: "WBTC", balance: "14.2", apy: "2.9%", locked: "$170K" },
      { token: "ETH", balance: "180", apy: "3.2%", locked: "$95K" },
    ],
  },
  {
    id: "vault-03",
    name: "Cross-Market Vault",
    chain: "Optimism",
    address: "0x0000000000000000000000000000000000000003",
    totalValue: "$1.12M",
    health: "At risk",
    assets: [
      { token: "USDC", balance: "380K", apy: "5.5%", locked: "$160K" },
      { token: "SOL", balance: "12.8K", apy: "6.1%", locked: "$120K" },
      { token: "ETH", balance: "92", apy: "3.7%", locked: "$75K" },
    ],
  },
];
