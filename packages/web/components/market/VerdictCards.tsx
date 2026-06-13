import { ArrowUpRight } from "lucide-react";
import { txUrl, shortHash } from "@/lib/explorer";
import { SIDE_LABEL, type RoundVM } from "@/lib/round-data";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Resolution summary (iBanKo "Available Card" analog) — the verdict + the payout, as card tiles. */
export function VerdictCards({ round }: { round: RoundVM }) {
  const res = round.resolution;
  const pot = round.agents.reduce((s, a) => s + a.stakeUsdc, 0);
  const winner = round.agents.find((a) => a.side === res.outcome);

  return (
    <div id="resolution" className="card-soft p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Resolution</h3>
        <a href={txUrl(res.txHash)} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-muted-foreground hover:text-foreground">
          View tx
        </a>
      </div>

      <div className="mt-4 space-y-3">
        {/* verdict tile */}
        <div className="rounded-2xl border border-yes/20 bg-yes/[0.1] p-5">
          <div className="flex items-start justify-between">
            <div className="text-lg font-semibold tracking-tight text-yes">{SIDE_LABEL[res.outcome]}</div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-[12px] text-muted-foreground">Observed</div>
              <div className="text-sm">{usd(res.observedPriceUsd)} ≤ {usd(res.strikePriceUsd)}</div>
            </div>
            <a href={txUrl(res.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
              {shortHash(res.txHash)} <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>

        {/* payout tile */}
        <div className="rounded-2xl border border-border bg-muted/50 p-5">
          <div className="flex items-start justify-between">
            <div className="text-lg font-semibold tracking-tight">{pot} USDC</div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-[12px] text-muted-foreground">Pot → winner</div>
              <div className="text-sm">{winner?.label.replace(" AGENT", "") ?? "Bull"} claimed</div>
            </div>
            {res.pnl.find((p) => p.claimTx)?.claimTx && (
              <a
                href={txUrl(res.pnl.find((p) => p.claimTx)!.claimTx!)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                {shortHash(res.pnl.find((p) => p.claimTx)!.claimTx!)} <ArrowUpRight className="size-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
