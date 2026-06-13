import { SectionLabel, AddrLink, Stat } from "@/components/ui/bits";
import type { RoundVM } from "@/lib/round-data";

/** x402 evidence marketplace — visualizes "agents paying agents". Most teams don't show this. */
export function EvidenceMarket({ round }: { round: RoundVM }) {
  const { evidence } = round;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionLabel>Evidence market · x402</SectionLabel>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Price / call" value={`$${evidence.priceUsdc.toFixed(2)}`} />
        <Stat label="Requests" value={evidence.requests} />
        <Stat label="Revenue" value={`${evidence.revenueUsdc.toFixed(2)} USDC`} />
      </div>

      <div className="mt-5 space-y-3">
        {round.agents.map((a) => (
          <Flow key={a.role} from={a.label.replace(" AGENT", "")} amount={evidence.priceUsdc} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span>Research agent (seller)</span>
        <AddrLink address={evidence.researchAddress} />
      </div>
    </section>
  );
}

function Flow({ from, amount }: { from: string; amount: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-12 shrink-0 font-semibold">{from}</span>
      {/* animated payment line */}
      <div className="relative h-px flex-1 bg-border">
        <span className="consilium-flow absolute -top-[3px] size-1.5 rounded-full bg-yes" />
      </div>
      <span className="shrink-0 font-mono text-xs text-yes">{amount.toFixed(2)} USDC →</span>
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">Research</span>
    </div>
  );
}
