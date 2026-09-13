"use client";

import { useEffect } from "react";

export type ToastMessage = { tone: "success" | "error"; message: string };

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(onDismiss, 8000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-[min(22rem,calc(100vw-3rem))]"
    >
      <div
        className={`flex items-start gap-3 rounded-xl border bg-[#0c140f] p-3 shadow-lg ${
          toast.tone === "success"
            ? "border-[#99e836]/40 text-[#99e836]"
            : "border-red-400/40 text-red-300"
        }`}
      >
        <p className="flex-1 break-words text-xs leading-relaxed">
          {toast.message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 text-slate-500 transition hover:text-slate-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
