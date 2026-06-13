import { AddrLink } from "@/components/ui/bits";
import { SIDE_LABEL, type RoundVM } from "@/lib/round-data";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function QuestionHero({ round }: { round: RoundVM }) {
  const { question, yesPct, noPct, state, resolution } = round;
  const breached = question.currentPriceUsd <= question.strikePriceUsd;
  return (
    <section className="rounded-xl border border-border bg-card p-8 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Liquidation-risk oracle
      </div>

      <h1 className="mx-auto mt-3 max-w-3xl text-balance font-display text-3xl font-bold leading-tight tracking-[-0.02em]">
        Will position <AddrLink address={question.position} className="text-3xl" />’s {question.collateralSymbol}{" "}
        collateral cross its liquidation strike{" "}
        <span className="text-no">{usd(question.strikePriceUsd)}</span> within the window?
      </h1>

      {/* Live price vs strike — the resolution input. */}
      <div className="mx-auto mt-6 grid max-w-2xl grid-cols-3 gap-3 text-left">
        <PriceStat label="Live price" value={usd(question.currentPriceUsd)} tone={breached ? "no" : "fg"} />
        <PriceStat label="Liquidation strike" value={usd(question.strikePriceUsd)} tone="no" />
        <PriceStat label="Health factor" value={question.healthFactor.toFixed(3)} tone="fg" sub={`${question.headroomPct.toFixed(1)}% headroom`} />
      </div>

      {/* Published probability — the oracle's output. */}
      <div className="mx-auto mt-7 max-w-xl">
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Prob side="YES" label={SIDE_LABEL.YES} pct={yesPct} won={state === "resolved" && resolution.outcome === "YES"} />
          <Prob side="NO" label={SIDE_LABEL.NO} pct={noPct} won={state === "resolved" && resolution.outcome === "NO"} />
        </div>
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-yes" style={{ width: `${yesPct}%` }} />
          <div className="bg-no" style={{ width: `${noPct}%` }} />
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          Capital-weighted from the live pot. The priced signal a liquidator bot would pay x402 to read.
        </div>
      </div>

      <div className="mt-6 inline-flex items-center gap-2 text-xs">
        {state === "resolved" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-yes/15 px-3 py-1 font-semibold uppercase tracking-wider text-yes">
            <span className="size-1.5 rounded-full bg-yes" /> Resolved · {SIDE_LABEL[resolution.outcome]}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-pending/15 px-3 py-1 font-semibold uppercase tracking-wider text-pending">
            <span className="size-1.5 animate-pulse rounded-full bg-pending" /> Live
          </span>
        )}
      </div>

      {/* Demo seam, stated openly (§0/§13). */}
      <p className="mx-auto mt-4 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
        Demo seam, stated openly: the window is tightened to {question.deadlineLabel.toLowerCase()} and the strike set
        near-the-money so a live {question.collateralSymbol} price tick resolves it on camera. In production the window is
        hours and the strike is P’s true liquidation price{" "}
        <span className="">{usd(question.realLiquidationPriceUsd)}</span> ({question.headroomPct.toFixed(1)}% away).
        Only the window and strike are tightened, never the price.
      </p>
    </section>
  );
}

function PriceStat({ label, value, tone, sub }: { label: string; value: string; tone: "no" | "fg"; sub?: string }) {
  const color = tone === "no" ? "text-no" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Prob({ side, label, pct, won }: { side: "YES" | "NO"; label: string; pct: number; won: boolean }) {
  const color = side === "YES" ? "text-yes" : "text-no";
  return (
    <div className={`rounded-lg border border-border bg-background/40 p-5 ${won ? "ring-1 ring-inset ring-current " + color : ""}`}>
      <div className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</div>
      <div className={`mt-1 text-5xl font-bold tabular-nums ${color}`}>{pct}%</div>
    </div>
  );
}
