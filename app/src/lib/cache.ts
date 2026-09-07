import { env } from "@/lib/env";
import { redis } from "@/lib/redis";

type CacheOptions = {
  /** Time-to-live in seconds. Defaults to CACHE_TTL_SECONDS. */
  ttl?: number;
};

/**
 * Read-through cache. Returns the cached value when present, otherwise runs
 * `fetcher`, stores the result and returns it.
 *
 * Redis being unavailable is never fatal here — we log and fall through to the
 * source of truth so a cache outage degrades latency, not availability.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  { ttl = env.CACHE_TTL_SECONDS }: CacheOptions = {},
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    console.error(`[cache] read failed for "${key}":`, err);
  }

  const value = await fetcher();

  // Don't cache empty results — a 404 shouldn't stay a 404 for a whole TTL.
  if (value === null || value === undefined) return value;

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch (err) {
    console.error(`[cache] write failed for "${key}":`, err);
  }

  return value;
}

/** Drop one or more exact keys. */
export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.error(`[cache] invalidate failed for ${keys.join(", ")}:`, err);
  }
}

/**
 * Drop every key matching a glob pattern (e.g. `users:*`).
 * Uses SCAN rather than KEYS so it never blocks the Redis event loop.
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    console.error(`[cache] invalidatePattern failed for "${pattern}":`, err);
  }
}

export const cacheKeys = {
  users: () => "users:all",
  user: (id: string) => `users:${id}`,
} as const;
