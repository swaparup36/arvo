"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

import { buildSignInMessage } from "@/lib/siwe";

const TOKEN_KEY = "arvo.auth";

type StoredAuth = { address: string; token: string };

function readStoredAuth(): StoredAuth | null {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function getAuthToken(address?: string) {
  const stored = readStoredAuth();
  if (!stored) return null;
  if (address && stored.address !== address.toLowerCase()) return null;
  return stored.token;
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

type AuthState = { address: string; token: string | null; error: string | null };

// Signs the user in as soon as a wallet connects, unless a token for that same
// address is already cached. Token is a 1h JWT from /api/auth/validate.
export function useWalletAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [auth, setAuth] = useState<AuthState | null>(null);

  const normalized = address?.toLowerCase() ?? null;

  useEffect(() => {
    if (!normalized) return;

    let isMounted = true;
    const commit = (next: AuthState) => {
      if (isMounted) setAuth(next);
    };

    const signIn = async () => {
      const cached = getAuthToken(normalized);
      if (cached) {
        commit({ address: normalized, token: cached, error: null });
        return;
      }

      try {
        const nonceRes = await fetch("/api/auth/nonce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: normalized }),
        });
        const noncePayload = await nonceRes.json();
        if (!nonceRes.ok) throw new Error(noncePayload.message ?? "Failed to get nonce");

        const signature = await signMessageAsync({
          message: buildSignInMessage(normalized, noncePayload.nonce),
        });

        const validateRes = await fetch("/api/auth/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: normalized, signature }),
        });
        const validatePayload = await validateRes.json();
        if (!validateRes.ok) throw new Error(validatePayload.message ?? "Failed to validate signature");

        localStorage.setItem(
          TOKEN_KEY,
          JSON.stringify({ address: normalized, token: validatePayload.token }),
        );
        commit({ address: normalized, token: validatePayload.token, error: null });
      } catch (err) {
        commit({
          address: normalized,
          token: null,
          error: err instanceof Error ? err.message : "Sign-in failed",
        });
      }
    };

    void signIn();

    return () => {
      isMounted = false;
    };
  }, [normalized, signMessageAsync]);

  // Derived, not reset in an effect: a stale address's result never leaks
  // into the next wallet's session.
  const active = normalized && auth?.address === normalized ? auth : null;

  return { token: active?.token ?? null, error: active?.error ?? null };
}
