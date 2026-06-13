import { ArrowUpRight, ShieldX } from "lucide-react";
import { txUrl, shortHash } from "@/lib/explorer";
import type { RoundVM } from "@/lib/round-data";

/** THE money-moment. Bright red, animated entrance. The chain rejected an over-cap redemption —
 *  no app-code guard. */
export function RejectCard({ round }: { round: RoundVM }) {
  const { reject } = round;
  return (
    <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 rounded-xl border border-no/50 bg-no/10 p-5">
      <div className="flex items-center gap-2 text-no">
        <ShieldX className="size-5" />
        <h2 className="text-sm font-bold uppercase tracking-[0.15em]">Rejected by caveat enforcer</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-no/80">Attempted</div>
          <div className="font-mono text-2xl font-bold tabular-nums text-no">{reject.attemptedUsdc} USDC</div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Allowed (cap)</div>
          <div className="font-mono text-2xl font-bold tabular-nums text-foreground/80">{reject.allowedUsdc} USDC</div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-no/30 bg-background/40 p-2.5 font-mono text-xs text-foreground/90">
        {reject.reason}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        No app-code guard rejected this — the <span className="text-foreground/90">ERC20TransferAmount</span> enforcer did,
        three hops from the human signature. The cap is structural.
      </p>

      <a
        href={txUrl(reject.txHash)}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-no/40 px-3 py-1.5 text-xs font-semibold text-no transition-colors hover:bg-no/10"
      >
        View failed transaction <span className="font-mono opacity-70">{shortHash(reject.txHash)}</span>
        <ArrowUpRight className="size-3.5" />
      </a>
    </section>
  );
}
