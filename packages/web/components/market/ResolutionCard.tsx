import { SectionLabel, TxLink, Stat } from "@/components/ui/bits";
import { cn } from "@/lib/utils";
import type { RoundVM } from "@/lib/round-data";

export function ResolutionCard({ round }: { round: RoundVM }) {
  const { resolution } = round;
  const outcomeColor = resolution.outcome === "YES" ? "text-yes" : "text-no";
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <SectionLabel>Market resolved</SectionLabel>

      <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="grid grid-cols-2 gap-4 self-center">
          <Stat label="Observed balance" value={`${resolution.observedUsdc} USDC`} valueClass="text-lg" />
          <Stat label="Threshold" value={`${resolution.thresholdUsdc} USDC`} valueClass="text-lg" />
          <div className="col-span-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Outcome</div>
            <div className={cn("font-mono text-4xl font-bold", outcomeColor)}>{resolution.outcome}</div>
            <TxLink hash={resolution.txHash} label="resolve tx" className="mt-1" />
          </div>
          <div className="col-span-2 flex gap-6 border-t border-border pt-3">
            {resolution.pnl.map((p) => (
              <div key={p.role}>
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {p.label} {p.deltaUsdc >= 0 ? "profit" : "loss"}
                </div>
                <div className={cn("font-mono text-lg font-bold", p.deltaUsdc >= 0 ? "text-yes" : "text-no")}>
                  {p.deltaUsdc >= 0 ? "+" : ""}
                  {p.deltaUsdc} USDC
                </div>
                {p.claimTx && <TxLink hash={p.claimTx} label="claim tx" />}
              </div>
            ))}
          </div>
        </div>

        {/* Venice-generated verdict card (wired in Step 10). */}
        <div className="hidden w-px bg-border md:block" />
        <div className="flex flex-col">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Verdict card · Venice</div>
          <div className="mt-2 flex aspect-[1200/630] w-full items-center justify-center rounded-lg border border-dashed border-border bg-background/40 text-center text-xs text-muted-foreground">
            Venice-generated verdict image
            <br />
            (multimodal — wired in Step 10)
          </div>
        </div>
      </div>
    </section>
  );
}
