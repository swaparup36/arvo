export function buildSignInMessage(address: string, nonce: string) {
  return `Sign in to Arvo\n\nWallet: ${address.toLowerCase()}\nNonce: ${nonce}`;
}
