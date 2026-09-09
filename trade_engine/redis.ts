import { Redis } from "ioredis";
import { REIDIS_URL } from "./constants.js";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createClient() {
  const client = new Redis(REIDIS_URL, {
    lazyConnect: true,
    connectTimeout: 5_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: 2,
    retryStrategy: (attempt: number) => Math.min(attempt * 200, 2_000),
  });

  client.on("error", (err: any) => {
    console.error("[redis] connection error:", err.message || err);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
