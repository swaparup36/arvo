"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

import { useUserVaults } from "@/hooks/useUserVaults";
import { chainOptions } from "@/lib/dashboard-data";
import { buildSignInMessage } from "@/lib/siwe";

function ConsentForm() {
  const pendingKey = useSearchParams().get("key") ?? "";
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { signMessageAsync } = useSignMessage();

  const [selectedChain, setSelectedChain] = useState<string>(chainOptions[1]);
  const [selectedVaultId, setSelectedVaultId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDenied, setIsDenied] = useState<boolean>(false);

  const walletAddress = address ?? "";
  const { vaults: realVaults, isLoading, error } = useUserVaults(
    selectedChain,
    walletAddress,
  );

  const selectedVault =
    realVaults.find((vault) => vault.id === selectedVaultId) ?? realVaults[0];

  const handleApprove = async () => {
    if (!pendingKey) {
      setStatus("Missing authorization key. Restart the flow from your client.");
      return;
    }
    if (!walletAddress) {
      openConnectModal?.();
      return;
    }
    if (!selectedVault) {
      setStatus("Select a vault to continue.");
      return;
    }

    setIsSubmitting(true);
    setStatus("");

    try {
      const normalized = walletAddress.toLowerCase();

      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: normalized }),
      });
      const noncePayload = await nonceRes.json();
      if (!nonceRes.ok)
        throw new Error(noncePayload.message ?? "Failed to get nonce");

      const signature = await signMessageAsync({
        message: buildSignInMessage(normalized, noncePayload.nonce),
      });

      const approveRes = await fetch("/api/mcp/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: pendingKey,
          address: normalized,
          vaultAddress: selectedVault.address,
          signature,
        }),
      });

      const payload = await approveRes.json().catch(() => null);
      if (!payload?.redirectUrl) {
        throw new Error(payload?.message ?? payload?.error ?? "Approval failed");
      }

      window.location.href = payload.redirectUrl;
    } catch (caughtError) {
      setStatus(
        caughtError instanceof Error ? caughtError.message : "Approval failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!pendingKey) {
      setStatus("Missing authorization key. Restart the flow from your client.");
      return;
    }

    setIsSubmitting(true);
    setStatus("");

    try {
      const denyRes = await fetch("/api/mcp/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: pendingKey }),
      });
      const payload = await denyRes.json().catch(() => null);
      if (!payload?.redirectUrl) {
        throw new Error(payload?.error ?? "Deny failed");
      }

      setIsDenied(true);
      window.location.href = payload.redirectUrl;
    } catch (caughtError) {
      setStatus(caughtError instanceof Error ? caughtError.message : "Deny failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const vaultHint = !walletAddress
    ? "Connect a wallet to load your vaults."
    : isLoading
      ? "Loading vaults..."
      : error
        ? error
        : realVaults.length === 0
          ? `No vaults found on ${selectedChain}.`
          : "";

  return (
    <main className="min-h-screen bg-[#050806] text-[#edf5ee]">
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-[28px] border border-[#99e836]/20 bg-[#0b120f] p-6">
          <h1 className="text-[clamp(1.6rem,2.2vw,2.2rem)] font-medium leading-[1] text-[#99e836]">
            Authorize agent
          </h1>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            An MCP client is requesting an agent wallet on your behalf. Pick the
            vault it may trade for, then sign to approve.
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] text-slate-400">
                Wallet
              </label>
              <button
                type="button"
                onClick={() => openConnectModal?.()}
                disabled={Boolean(walletAddress)}
                className="w-full rounded-xl border border-white/10 bg-[#101915] px-3 py-2.5 text-left text-[#edf5ee] outline-none transition hover:border-[#99e836]/30 disabled:cursor-default disabled:hover:border-white/10"
              >
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : "Connect wallet"}
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] text-slate-400">
                Chain
              </label>
              <select
                value={selectedChain}
                onChange={(event) => {
                  setSelectedChain(event.target.value);
                  setSelectedVaultId("");
                }}
                className="w-full rounded-xl border border-white/10 bg-[#101915] px-3 py-2.5 text-[#edf5ee] outline-none"
              >
                {chainOptions.map((chain) => (
                  <option key={chain} value={chain}>
                    {chain}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] text-slate-400">
                Vault
              </label>
              <select
                value={selectedVault?.id ?? ""}
                onChange={(event) => setSelectedVaultId(event.target.value)}
                disabled={realVaults.length === 0}
                className="w-full rounded-xl border border-white/10 bg-[#101915] px-3 py-2.5 text-[#edf5ee] outline-none disabled:opacity-60"
              >
                {realVaults.length === 0 ? (
                  <option value="">No vaults available</option>
                ) : (
                  realVaults.map((vault) => (
                    <option key={vault.id} value={vault.id}>
                      {vault.name} - {vault.address.slice(0, 6)}...
                      {vault.address.slice(-4)}
                    </option>
                  ))
                )}
              </select>
              {vaultHint ? (
                <p className="mt-1.5 text-[11px] text-slate-500">{vaultHint}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={handleDeny}
              disabled={isSubmitting || isDenied}
              className="rounded-xl border border-white/10 bg-[#101915] px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-[#edf5ee] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Deny
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isSubmitting || isDenied}
              className="flex-1 rounded-xl bg-[#99e836] px-4 py-3 font-semibold text-[#05110b] shadow-[0_12px_20px_rgba(153,232,54,0.18)] transition hover:bg-[#b5ef64] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Approving..."
                : walletAddress
                  ? "Approve and sign"
                  : "Connect wallet"}
            </button>
          </div>

          {status ? (
            <p className="mt-3 text-xs text-slate-300">{status}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function ConsentPage() {
  return (
    <Suspense
      fallback={<main className="min-h-screen bg-[#050806] text-[#edf5ee]" />}
    >
      <ConsentForm />
    </Suspense>
  );
}
