import { TrendingUp, TrendingDown, Search, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoundVM } from "@/lib/round-data";

/** "Agents" card — participants as avatars, evenly spaced in a 3-col grid. */
export function AgentsCard({ round }: { round: RoundVM }) {
  const bull = round.agents.find((a) => a.role === "bull");
  const bear = round.agents.find((a) => a.role === "bear");
  return (
    <div className="card-soft p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Agents</h3>
        <MoreHorizontal className="size-4 text-muted-foreground/60" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Avatar icon={<TrendingUp className="size-5" />} tone="yes" name="Bull" sub={`${bull?.stakeUsdc} USDC`} />
        <Avatar icon={<TrendingDown className="size-5" />} tone="no" name="Bear" sub={`${bear?.stakeUsdc} USDC`} />
        <Avatar icon={<Search className="size-5" />} tone="neutral" name="Research" sub={`$${round.evidence.revenueUsdc.toFixed(2)} earned`} />
      </div>
    </div>
  );
}

function Avatar({ icon, tone, name, sub }: { icon: React.ReactNode; tone: "yes" | "no" | "neutral"; name: string; sub: string }) {
  const ring = tone === "yes" ? "border-yes/40 text-yes" : tone === "no" ? "border-no/40 text-no" : "border-border text-foreground/70";
  return (
    <div className="flex flex-col items-center text-center">
      <div className={cn("grid size-12 place-items-center rounded-full border bg-background/40", ring)}>{icon}</div>
      <div className="mt-2.5 text-[13px] font-medium">{name}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

/** "Evidence" card — tiered x402 signals; prices bottom-aligned so labels of any height stay tidy. */
export function EvidenceCard({ round }: { round: RoundVM }) {
  const { evidence } = round;
  return (
    <div className="card-soft p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Evidence</h3>
        <span className="text-[11px] text-muted-foreground">
          {evidence.requests} paid · ${evidence.revenueUsdc.toFixed(2)}
        </span>
      </div>
      <div className="mt-6 grid grid-cols-3 items-stretch gap-2.5">
        {evidence.tiers.map((t) => (
          <div key={t.tier} className="flex flex-col rounded-xl border border-border bg-muted/40 p-3">
            <div className="text-[11px] leading-tight text-muted-foreground">{t.label}</div>
            <div className="mt-auto pt-3 text-sm font-medium">${t.priceUsdc.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
