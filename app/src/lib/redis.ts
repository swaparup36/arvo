import Redis from "ioredis";

import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createClient() {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 5_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: 2,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  });

  client.on("error", (err) => {
    console.error("[redis] connection error:", err.message || err);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createClient();

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
