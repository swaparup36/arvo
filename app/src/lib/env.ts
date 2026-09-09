import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  BASE_MCP_URL: z.string().url().default("http://localhost:3000/mcp"),
  BASE_URL: z.string().url().default("http://localhost:3000"),
  ARVO_MAIN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  OWNER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  SEPOLIA_RPC_URL: z.string().url(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
