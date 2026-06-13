import { ArrowUpRight, X } from "lucide-react";
import { txUrl, shortHash } from "@/lib/explorer";
import type { RoundVM } from "@/lib/round-data";

/** The over-cap money-moment. Neutral surface; red is an accent only. Spare on purpose. */
export function RejectCard({ round }: { round: RoundVM }) {
  const { reject } = round;
  return (
    <section className="card-soft relative overflow-hidden p-7">
      <div className="pointer-events-none absolute -right-8 -top-16 size-44 rounded-full bg-no/[0.07] blur-3xl" />

      <div className="relative flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-lg border border-no/30 bg-no/10 text-no">
          <X className="size-4" strokeWidth={2.5} />
        </span>
        <h2 className="text-sm font-semibold">Rejected by caveat enforcer</h2>
      </div>

      <div className="relative mt-7 flex items-end gap-10">
        <div>
          <div className="text-[13px] text-muted-foreground">Attempted</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-no">{reject.attemptedUsdc} USDC</div>
        </div>
        <div>
          <div className="text-[13px] text-muted-foreground">Cap</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-foreground/60">{reject.allowedUsdc} USDC</div>
        </div>
      </div>

      <div className="relative mt-7 flex items-center justify-between">
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
          ERC20TransferAmountEnforcer:allowance-exceeded
        </span>
        <a
          href={txUrl(reject.txHash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          failed tx <span className="">{shortHash(reject.txHash)}</span>
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </section>
  );
}
