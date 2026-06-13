import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoundVM } from "@/lib/round-data";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Tone = "yes" | "no" | "pending";

/** Three tinted metric cards (iBanKo "Financial Record" analog) — the resolution inputs. */
export function MetricCards({ round }: { round: RoundVM }) {
  const q = round.question;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric tone="yes" label="Live price" value={usd(q.currentPriceUsd)} chip="ETH/USD · Chainlink" trend="down" />
      <Metric tone="no" label="Liquidation strike" value={usd(q.strikePriceUsd)} chip="near-money" />
      <Metric tone="pending" label="Health factor" value={q.healthFactor.toFixed(3)} chip={`${q.headroomPct.toFixed(1)}% headroom`} trend="up" />
    </div>
  );
}

const TINT: Record<Tone, string> = {
  yes: "bg-yes/[0.13]",
  no: "bg-no/[0.10]",
  pending: "bg-pending/[0.16]",
};
const STROKE: Record<Tone, string> = {
  yes: "oklch(0.55 0.15 155)",
  no: "oklch(0.55 0.22 22)",
  pending: "oklch(0.6 0.13 75)",
};
const CHIP: Record<Tone, string> = {
  yes: "text-yes",
  no: "text-no",
  pending: "text-pending",
};

function Metric({ tone, label, value, chip, trend }: { tone: Tone; label: string; value: string; chip: string; trend?: "up" | "down" }) {
  return (
    <div className={cn("relative flex flex-col rounded-3xl p-6 shadow-[0_1px_2px_oklch(0_0_0/0.04),0_14px_30px_-20px_oklch(0_0_0/0.16)]", TINT[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-foreground/75">{label}</span>
        <MoreHorizontal className="size-4 text-muted-foreground/50" />
      </div>

      <svg viewBox="0 0 120 28" className="my-3 h-7 w-24">
        <polyline
          points={trend === "down" ? "0,8 18,10 36,9 54,14 72,13 90,18 120,20" : "0,20 18,17 36,18 54,11 72,13 90,7 120,5"}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-auto">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className={cn("mt-1 text-[11px] font-medium", CHIP[tone])}>{chip}</div>
      </div>
    </div>
  );
}
