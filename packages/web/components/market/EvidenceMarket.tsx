import { SectionLabel, AddrLink, Stat } from "@/components/ui/bits";
import type { RoundVM } from "@/lib/round-data";

/** x402 evidence marketplace — visualizes "agents paying agents" for tiered risk signals. */
export function EvidenceMarket({ round }: { round: RoundVM }) {
  const { evidence } = round;
  const maxSpend = Math.max(...round.agents.map((a) => a.buys.reduce((s, b) => s + b.priceUsdc, 0)), 0.01);
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionLabel>Evidence market · x402 + ERC-7710</SectionLabel>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Signal tiers" value={evidence.tiers.length} />
        <Stat label="Paid requests" value={evidence.requests} />
        <Stat label="Seller revenue" value={`$${evidence.revenueUsdc.toFixed(2)}`} />
      </div>

      {/* The tiered catalogue. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {evidence.tiers.map((t) => (
          <span key={t.tier} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1 text-xs">
            <span className="font-semibold">{t.label}</span>
            <span className="text-[10px] text-muted-foreground">${t.priceUsdc.toFixed(2)}</span>
          </span>
        ))}
      </div>

      {/* Evidence-spend meter per agent (the costly-signal visual). */}
      <div className="mt-5 space-y-3">
        {round.agents.map((a) => {
          const spend = a.buys.reduce((s, b) => s + b.priceUsdc, 0);
          const tone = a.side === "YES" ? "bg-yes" : "bg-no";
          return (
            <div key={a.role}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{a.label.replace(" AGENT", "")}</span>
                <span className="text-yes">${spend.toFixed(2)} → Research</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={tone} style={{ width: `${(spend / maxSpend) * 100}%`, height: "100%" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span>Research agent (seller)</span>
        <AddrLink address={evidence.researchAddress} />
      </div>
    </section>
  );
}
