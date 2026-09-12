import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/app?schema=public"),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  BASE_MCP_URL: z.string().url().default("http://localhost:3000/mcp"),
  BASE_URL: z.string().url().default("http://localhost:3000"),
  ARVO_MAIN_ETH_ADDRESS: z
    .string()
    .default("0x0000000000000000000000000000000000000000"),
  ARVO_MAIN_SEPOLIA_ADDRESS: z
    .string()
    .default("0x0000000000000000000000000000000000000000"),
  VAULT_FACTORY_ADDRESS: z
    .string()
    .default("0x0000000000000000000000000000000000000000"),
  OWNER_PRIVATE_KEY: z.string().default(""),
  ETHEREUM_RPC_URL: z
    .string()
    .url()
    .default("https://ethereum-rpc.publicnode.com"),
  ALCHEMY_API_KEY: z.string().default(""),
  UNISWAP_API_BASE_URL: z
    .string()
    .default("https://trade-api.gateway.uniswap.org/v1"),
  UNISWAP_API_KEY: z.string().default(""),
  OWNER_ADDRESS: z
    .string()
    .default("0x0000000000000000000000000000000000000000"),
  USDC_ETH_ADDRESS: z
    .string()
    .default("0x0000000000000000000000000000000000000000"),
  SEPOLIA_RPC_URL: z
    .string()
    .url()
    .default("https://ethereum-sepolia-rpc.publicnode.com"),
  USDC_SEPOLIA_ADDRESS: z
    .string()
    .default("0x0000000000000000000000000000000000000000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
