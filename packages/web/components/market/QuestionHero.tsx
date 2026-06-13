import { AddrLink } from "@/components/ui/bits";
import type { RoundVM } from "@/lib/round-data";

export function QuestionHero({ round }: { round: RoundVM }) {
  const { question, yesPct, noPct, state, resolution } = round;
  return (
    <section className="rounded-xl border border-border bg-card p-8 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Market</div>

      <h1 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight">
        Will wallet <AddrLink address={question.watchedWallet} className="text-3xl" /> hold more than{" "}
        <span className="font-mono">{question.thresholdUsdc} USDC</span> by {question.deadlineLabel}?
      </h1>

      {/* Big YES/NO — Polymarket-large. */}
      <div className="mx-auto mt-7 grid max-w-xl grid-cols-2 gap-4">
        <Prob side="YES" pct={yesPct} won={state === "resolved" && resolution.outcome === "YES"} />
        <Prob side="NO" pct={noPct} won={state === "resolved" && resolution.outcome === "NO"} />
      </div>
      <div className="mx-auto mt-3 flex h-1.5 max-w-xl overflow-hidden rounded-full bg-muted">
        <div className="bg-yes" style={{ width: `${yesPct}%` }} />
        <div className="bg-no" style={{ width: `${noPct}%` }} />
      </div>

      <div className="mt-6 inline-flex items-center gap-2 text-xs">
        {state === "resolved" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-yes/15 px-3 py-1 font-semibold uppercase tracking-wider text-yes">
            <span className="size-1.5 rounded-full bg-yes" /> Resolved · {resolution.outcome}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-pending/15 px-3 py-1 font-semibold uppercase tracking-wider text-pending">
            <span className="size-1.5 animate-pulse rounded-full bg-pending" /> Live
          </span>
        )}
      </div>
    </section>
  );
}

function Prob({ side, pct, won }: { side: "YES" | "NO"; pct: number; won: boolean }) {
  const color = side === "YES" ? "text-yes" : "text-no";
  return (
    <div className={`rounded-lg border border-border bg-background/40 p-5 ${won ? "ring-1 ring-inset ring-current " + color : ""}`}>
      <div className={`text-xs font-bold uppercase tracking-widest ${color}`}>{side}</div>
      <div className={`mt-1 font-mono text-5xl font-bold tabular-nums ${color}`}>{pct}%</div>
    </div>
  );
}
