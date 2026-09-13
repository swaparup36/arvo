"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { TradeIntent } from "@/types/dashboard";

const statusStyles: Record<TradeIntent["status"], string> = {
  Queued: "bg-slate-700 text-slate-200",
  Review: "bg-amber-500/15 text-amber-300",
  Approved: "bg-emerald-500/15 text-emerald-300",
  Executed: "bg-sky-500/15 text-sky-300",
};

function riskColor(risk: number | null) {
  if (risk === null) return "text-slate-500";
  return risk >= 66
    ? "text-red-300"
    : risk >= 33
      ? "text-amber-300"
      : "text-emerald-300";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[0.65rem] uppercase text-slate-400">{label}</span>
      <span className="max-w-[60%] break-all text-right text-xs text-[#edf5ee]">
        {value}
      </span>
    </div>
  );
}

function IntentDetailsDrawer({
  intent,
  onClose,
}: {
  intent: TradeIntent;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Trade intent details for ${intent.pair}`}
        className="no-scrollbar relative flex h-full w-full max-w-sm flex-col overflow-y-auto border-r border-[#99e836]/15 bg-[#080f0c] p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase text-[#afc4b3]">
              {intent.agent}
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold text-[#edf5ee]">
              {intent.pair}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-[#99e836]/20 px-2.5 py-1 text-xs text-[#c4f57a] hover:bg-[#99e836]/10"
          >
            Close
          </button>
        </div>

        <span
          className={`mt-3 self-start rounded-full px-2 py-1 text-[10px] font-medium ${statusStyles[intent.status]}`}
        >
          {intent.status}
        </span>

        <section className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#99e836]">
            Trade confirmation
          </p>
          <div className="mt-2 divide-y divide-[#99e836]/8 rounded-2xl border border-[#99e836]/10 px-3 py-1">
            {intent.confirmation ? (
              <>
                <Row label="Executed" value="Yes" />
                <Row label="Amount in" value={intent.confirmation.amountIn} />
                <Row label="Amount out" value={intent.confirmation.amountOut} />
                <Row
                  label="Executed at"
                  value={intent.confirmation.executedAt}
                />
                <Row
                  label="Tx hash"
                  value={intent.confirmation.transactionHash}
                />
              </>
            ) : (
              <Row label="Executed" value="Not executed yet" />
            )}
          </div>
        </section>

        <section className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#99e836]">
            Risk assessment
          </p>
          <div className="mt-2 divide-y divide-[#99e836]/8 rounded-2xl border border-[#99e836]/10 px-3 py-1">
            {intent.assessment ? (
              <>
                <Row
                  label="Risk score"
                  value={`${intent.assessment.riskScore.toFixed(1)}%`}
                />
                <Row label="Premium" value={intent.assessment.premium} />
                <Row label="Coverage" value={`${intent.assessment.coverage}%`} />
                <Row
                  label="Coverage duration"
                  value={intent.assessment.coverageDuration}
                />
                <Row label="Assessed at" value={intent.assessment.assessedAt} />
                <Row label="Expires at" value={intent.assessment.expiresAt} />
              </>
            ) : (
              <Row label="Risk score" value="Not assessed" />
            )}
          </div>
        </section>

        <div className="mt-5 border-t border-[#99e836]/10 pt-3">
          <Row label="Submitted" value={intent.eta} />
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export function TradeIntentsPanel({
  intents,
  intentPage,
  intentTotalPages,
  onPrev,
  onNext,
}: {
  intents: TradeIntent[];
  intentPage: number;
  intentTotalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [openIntentId, setOpenIntentId] = useState<string | null>(null);
  const openIntent = intents.find((intent) => intent.id === openIntentId);

  return (
    <div
      id="intents"
      className="rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase text-[#afc4b3]">Queue</p>
          <h2 className="mt-2 text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
            Trade intents
          </h2>
        </div>
      </div>

      {intents.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#99e836]/15 bg-transparent p-6 text-center text-sm text-slate-400">
          No trade intents submitted for this agent yet.
        </div>
      ) : (
        <div className="no-scrollbar mt-5 max-h-[22rem] space-y-2 overflow-y-auto">
          {intents.map((intent) => (
            <button
              type="button"
              key={intent.id}
              onClick={() => setOpenIntentId(intent.id)}
              className="w-full rounded-2xl border border-[#99e836]/8 bg-transparent p-3 text-left transition hover:border-[#99e836]/20"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#edf5ee]">
                    {intent.pair}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] uppercase text-[#afc4b3]">
                    {intent.agent} · {intent.eta}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`text-[11px] ${riskColor(intent.risk)}`}>
                    {intent.risk === null
                      ? "No risk"
                      : `${intent.risk.toFixed(0)}%`}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyles[intent.status]}`}
                  >
                    {intent.status}
                  </span>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-slate-300">{intent.amount}</p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-[#99e836]/10 pt-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={intentPage === 1}
          className="rounded-full border border-[#99e836]/15 bg-[#111915] px-3 py-2 text-xs font-medium uppercase text-[#c4f57a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-xs uppercase text-slate-400">
          Page {intentPage} / {intentTotalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={intentPage === intentTotalPages}
          className="rounded-full border border-[#99e836]/15 bg-[#111915] px-3 py-2 text-xs font-medium uppercase text-[#c4f57a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {openIntent ? (
        <IntentDetailsDrawer
          intent={openIntent}
          onClose={() => setOpenIntentId(null)}
        />
      ) : null}
    </div>
  );
}
