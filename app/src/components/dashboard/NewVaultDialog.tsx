"use client";

import { useEffect, useRef } from "react";

export function NewVaultDialog({
  isOpen,
  chainLabel,
  name,
  onNameChange,
  onCancel,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  chainLabel: string;
  name: string;
  onNameChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Name your vault"
        className="w-full max-w-sm rounded-[28px] border border-[#99e836]/20 bg-[#0b120f] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-[clamp(1.4rem,2vw,1.8rem)] font-medium leading-tight text-[#99e836]">
          Name your vault
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Deploying on {chainLabel}. You won&apos;t be able to rename it after
          it&apos;s created.
        </p>

        <input
          ref={inputRef}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !isSubmitting) {
              onSubmit();
            }
          }}
          placeholder={`${chainLabel} Strategy Vault`}
          className="mt-4 w-full rounded-xl border border-white/10 bg-[#101915] px-3 py-2.5 text-[#edf5ee] outline-none focus:border-[#99e836]/40"
        />

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-white/10 bg-[#101915] px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-[#edf5ee] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-[#99e836] px-4 py-3 text-sm font-semibold text-[#05110b] shadow-[0_12px_20px_rgba(153,232,54,0.18)] transition hover:bg-[#b5ef64] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Deploying..." : "Create vault"}
          </button>
        </div>
      </div>
    </div>
  );
}
