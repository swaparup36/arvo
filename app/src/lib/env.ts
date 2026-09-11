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
  ARVO_MAIN_ADDRESS: z
    .string()
    .default("0x0000000000000000000000000000000000000000"),
  VAULT_FACTORY_ADDRESS: z
    .string()
    .default("0x0000000000000000000000000000000000000000"),
  OWNER_PRIVATE_KEY: z.string().default(""),
  SEPOLIA_RPC_URL: z
    .string()
    .url()
    .default("https://ethereum-sepolia-rpc.publicnode.com"),
  ALCHEMY_API_KEY: z.string().default(""),
  ONE_INCH_BASE_URL: z.string().default("https://api.1inch.dev"),
  ONE_INCH_API_KEY: z.string().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
