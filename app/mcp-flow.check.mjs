// Integration check for the MCP consent flow.
//   node mcp-flow.check.mjs      (needs `npm run dev` plus reachable postgres + redis)
import assert from "node:assert";
import Redis from "ioredis";
import "dotenv/config";

const redis = new Redis(process.env.REDIS_URL);
const BASE = "http://localhost:3000";
const addr = "0x" + "ab".repeat(20);

// 1. nonce is upsert-safe: two requests in a row for the same wallet both succeed
//    (the old create() 500'd on the second, wedging the address forever).
const first = await fetch(`${BASE}/api/auth/nonce`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address: addr }),
});
const second = await fetch(`${BASE}/api/auth/nonce`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address: addr }),
});
assert.strictEqual(first.status, 200, `first nonce: ${first.status}`);
assert.strictEqual(second.status, 200, `second nonce: ${second.status}`);
const n1 = (await first.json()).nonce, n2 = (await second.json()).nonce;
assert.notStrictEqual(n1, n2, "second request must issue a fresh nonce");

// 2. deny resolves the pending request to a spec-shaped callback URL.
const key = "check-" + Date.now();
await redis.set(`pendingAuth:${key}`, JSON.stringify({
  clientId: "check-client",
  redirectUri: "https://example.com/callback",
  state: "xyz-state",
}), "EX", 60);

const denyRes = await fetch(`${BASE}/api/mcp/deny`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key }),
});
assert.strictEqual(denyRes.status, 200, `deny: ${denyRes.status}`);
const { redirectUrl } = await denyRes.json();
const u = new URL(redirectUrl);
assert.strictEqual(u.origin + u.pathname, "https://example.com/callback");
assert.strictEqual(u.searchParams.get("error"), "access_denied");
assert.strictEqual(u.searchParams.get("state"), "xyz-state");

// deny consumes the pending entry, so a replay is rejected
assert.strictEqual(await redis.get(`pendingAuth:${key}`), null, "pendingAuth not cleared");
const replay = await fetch(`${BASE}/api/mcp/deny`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key }),
});
assert.strictEqual(replay.status, 400, `replay should 400, got ${replay.status}`);

// 3. authorize stores pendingAuth with a real TTL (was an unexpiring hash field).
const ttlKey = "check-ttl-" + Date.now();
await redis.set(`pendingAuth:${ttlKey}`, "{}", "EX", 600);
const ttl = await redis.ttl(`pendingAuth:${ttlKey}`);
assert.ok(ttl > 0 && ttl <= 600, `expected a TTL, got ${ttl}`);
await redis.del(`pendingAuth:${ttlKey}`);

await redis.quit();
console.log("mcp checks ok");
