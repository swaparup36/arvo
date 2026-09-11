import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import type { TradeIntent } from "../types.js";

// ponytail: vault is not deployed yet — swap this for the real address when it is.
const PLACEHOLDER_VAULT = "0x000000000000000000000000000000000000dEaD";

const ROUTER = "0x1111111254eeb25477b68fb85ed929f73a960582";
const SWAP_CALLDATA = "0x0502b1c5deadbeef";
const DST_AMOUNT = "62131879850006790961";
// trimmed 1inch /swap response — only the fields the pipeline reads
const SWAP_RESPONSE = {
    dstAmount: DST_AMOUNT,
    tx: {
        from: "0x1111111111111111111111111111111111111111",
        to: ROUTER,
        data: SWAP_CALLDATA,
        value: "0",
        gas: 121363,
    },
};

const mockIntent: TradeIntent = {
    id: "intent-1",
    userAddress: "0x00000000000000000000000000000000000000A1",
    agentAddress: "0x00000000000000000000000000000000000000A2",
    vaultAddress: PLACEHOLDER_VAULT,
    chainId: 11155111,
    tokenIn: "0x00000000000000000000000000000000000000B1",
    tokenOut: "0x00000000000000000000000000000000000000B2",
    amountIn: 1_000_000n,
    minAmountOut: 980_000n,
    deadline: new Date("2030-01-01T00:00:00Z"),
    maxPremium: 0n,
    minCoverage: 0,
    minCoverageDuration: 0n,
    signature: "0xsignature",
    status: "PENDING",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
};

// call log + per-test knobs
let calls: { name: string; args: any[] }[] = [];
const record = (name: string, args: any[]) => { calls.push({ name, args }); };

let approveHashes: (string | null)[] = [];
let executeHashes: (string | null)[] = [];
let fetchOk = true;
let fetchInit: any;

mock.module("../utils.js", {
    namedExports: {
        getSwapCallData: async (...a: any[]) => { record("getSwapCallData", a); return SWAP_RESPONSE; },
        // the pipeline takes the router off swapCallData.tx.to and approves through the
        // vault, so these three are unused — blow up if that ever changes silently
        getRouterAddress: async () => { throw new Error("not used by the pipeline"); },
        getApproveCallData: async () => { throw new Error("not used by the pipeline"); },
        getAllowance: async () => { throw new Error("not used by the pipeline"); },
    },
});

mock.module("../onchain-utils/vault.js", {
    namedExports: {
        approveTokenOnVault: async (...a: any[]) => {
            record("approveTokenOnVault", a);
            return { txHash: approveHashes.shift() ?? null, receipt: null };
        },
        executeOnVault: async (...a: any[]) => {
            record("executeOnVault", a);
            return { txHash: executeHashes.shift() ?? null, receipt: null };
        },
    },
});

// index.ts opens a redis client at import time; keep it out of the test
mock.module("../redis.js", { namedExports: { redis: { rpop: async () => null } } });

const { pipeLine } = await import("../index.js");

beforeEach(() => {
    calls = [];
    approveHashes = ["0xzero", "0xapprove"];
    executeHashes = ["0xswap"];
    fetchOk = true;
    fetchInit = undefined;
    globalThis.fetch = (async (url: any, init: any) => {
        record("fetch", [url, init]);
        fetchInit = init;
        return { ok: fetchOk } as any;
    }) as any;
});

const names = () => calls.map(c => c.name);

test("happy path: reset allowance -> approve -> swap -> confirm", async () => {
    await pipeLine(mockIntent);

    assert.deepEqual(names(), [
        "getSwapCallData",
        "approveTokenOnVault",
        "approveTokenOnVault",
        "executeOnVault",
        "fetch",
    ]);

    // quote is requested for the user's funds, originated by the agent
    assert.deepEqual(calls[0]!.args[0], {
        chainId: mockIntent.chainId,
        tokenIn: mockIntent.tokenIn,
        tokenOut: mockIntent.tokenOut,
        amountIn: "1000000",
        from: mockIntent.userAddress,
        origin: mockIntent.agentAddress,
        minAmountOut: "980000",
    });

    // allowance is reset to zero against the router before it is set to amountIn
    assert.deepEqual(calls[1]!.args, [PLACEHOLDER_VAULT, mockIntent.tokenIn, ROUTER, 0n, mockIntent.chainId]);
    assert.deepEqual(calls[2]!.args, [PLACEHOLDER_VAULT, mockIntent.tokenIn, ROUTER, 1_000_000n, mockIntent.chainId]);

    // the swap executes 1inch's own calldata at 1inch's own tx.to, with zero value
    assert.deepEqual(calls[3]!.args, [PLACEHOLDER_VAULT, ROUTER, 0n, SWAP_CALLDATA, mockIntent.chainId]);

    assert.match(fetchInit.headers.Authorization, /^Bearer /);
    const body = JSON.parse(fetchInit.body);
    assert.equal(body.intentId, mockIntent.id);
    assert.equal(body.transactionHash, "0xswap");   // the swap hash, not the approve hash
    assert.equal(body.amountIn, "1000000");
    assert.equal(body.amountOut, DST_AMOUNT);
    assert.equal(body.signature, mockIntent.signature);
});

test("stops when the allowance reset fails", async () => {
    approveHashes = [null];

    await pipeLine(mockIntent);

    assert.deepEqual(names(), ["getSwapCallData", "approveTokenOnVault"]);
});

test("stops when the approve tx fails, leaving no allowance behind", async () => {
    approveHashes = ["0xzero", null];

    await pipeLine(mockIntent);

    assert.deepEqual(names(), ["getSwapCallData", "approveTokenOnVault", "approveTokenOnVault"]);
});

test("no confirmation is sent when the swap fails", async () => {
    executeHashes = [null];

    await pipeLine(mockIntent);

    assert.equal(names().filter(n => n === "executeOnVault").length, 1);
    assert.equal(names().includes("fetch"), false);
});
