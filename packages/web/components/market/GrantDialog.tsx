"use client";

import { useEffect, useState } from "react";
import { Loader2, PenLine, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN = 10;
const MAX = 1000;
const PRESETS = [50, 100, 250];

/** Modal for granting the agent budget: pick an amount, sign the ERC-7710 delegation in your wallet. */
export function GrantDialog({
  open,
  onClose,
  onConfirm,
  granting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (budgetUsdc: number) => Promise<boolean>;
  granting: boolean;
  error: string | null;
}) {
  const [budget, setBudget] = useState(100);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !granting && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, granting, onClose]);

  if (!open) return null;

  const clamped = Math.min(MAX, Math.max(MIN, Math.round(Number.isFinite(budget) ? budget : MIN)));

  async function confirm() {
    const ok = await onConfirm(clamped);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !granting && onClose()} />

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_24px_60px_-20px_oklch(0_0_0/0.5)]">
        <button
          onClick={() => !granting && onClose()}
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <h2 className="text-base font-semibold">Grant agent budget</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Delegate up to this much USDC to the fund-manager. The agents can spend only within this cap — you sign once,
          and the chain enforces the limit. Min {MIN}, max {MAX} USDC.
        </p>

        <div className="mt-5">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Budget</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background/50 px-4 py-3">
            <input
              type="number"
              min={MIN}
              max={MAX}
              step={10}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              autoFocus
              className="w-full bg-transparent text-2xl font-semibold tabular-nums outline-none"
            />
            <span className="text-sm font-medium text-muted-foreground">USDC</span>
          </div>
          <div className="mt-2.5 flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setBudget(p)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                  clamped === p ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-4 text-[13px] text-no">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            onClick={() => !granting && onClose()}
            disabled={granting}
            className="rounded-full px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={granting}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {granting ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
            {granting ? "Signing…" : `Grant ${clamped} USDC`}
          </button>
        </div>
      </div>
    </div>
  );
}
