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
    // display only: kept out of tokenDecimals so it stays off the
    // deposit/withdraw asset list, which is keyed by that map.
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
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


// Formats a numeric string for display, using significant digits for dust and
export function formatAmountForDisplay(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  // use 4 decimal places for whole numbers, 6 significant digits for dust
  return parsed.toLocaleString(
    "en-US",
    Math.abs(parsed) >= 1
      ? { maximumFractionDigits: 4 }
      : { maximumSignificantDigits: 6 },
  );
}
