// node --experimental-strip-types src/lib/siwe.check.ts
import assert from "node:assert";
import { Wallet, verifyMessage } from "ethers";
import { buildSignInMessage } from "./siwe.ts";

const wallet = Wallet.createRandom();
const nonce = "deadbeef";

assert.strictEqual(
  buildSignInMessage(wallet.address, nonce),
  `Sign in to Arvo\n\nWallet: ${wallet.address.toLowerCase()}\nNonce: ${nonce}`,
);

// Client signs with the checksummed address, server verifies with the lowercased
// one - both must hit the same bytes or verifyMessage recovers a stranger
const signature = await wallet.signMessage(buildSignInMessage(wallet.address, nonce));
assert.strictEqual(
  verifyMessage(buildSignInMessage(wallet.address.toLowerCase(), nonce), signature).toLowerCase(),
  wallet.address.toLowerCase(),
);

console.log("siwe ok");
