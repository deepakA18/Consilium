"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { AddrLink, TxLink } from "@/components/ui/bits";
import { cn } from "@/lib/utils";
import { txUrl, shortHash } from "@/lib/explorer";
import { DEMO_ROUND, SIDE_LABEL } from "@/lib/round-data";
import { useLiveRound } from "@/lib/use-live-round";

const TIER_LABEL: Record<string, string> = { health: "Health factor", headroom: "Price headroom", liquidity: "Exit liquidity" };

export default function AgentPage() {
  const role = String(useParams().role);
  const { round: live } = useLiveRound();
  const round = live ?? DEMO_ROUND; // live round, else the persisted last round (never hardcoded when the hub has run)
  const agent = round.agents.find((a) => a.role === role);

  if (!agent) {
    return (
      <div className="theme-light flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No such agent.</p>
          <Link href="/market" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
            <ArrowLeft className="size-4" /> Back to market
          </Link>
        </div>
      </div>
    );
  }

  const yes = agent.side === "YES";
  const accent = yes ? "text-yes" : "text-no";
  const resolved = round.state === "resolved";
  const won = resolved && agent.side === round.resolution.outcome;
  const pnl = round.resolution.pnl.find((p) => p.role === agent.role);

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-4">
          <Link href="/market" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" /> Market
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium">{agent.label}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{agent.label}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <span className={cn("font-medium", accent)}>{SIDE_LABEL[agent.side]}</span>
              {won && <span className={cn("font-medium", accent)}>· Won</span>}
              <span className="text-muted-foreground">·</span>
              <AddrLink address={agent.address} className="text-[13px]" />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] text-muted-foreground">Staked</div>
            <div className={cn("text-3xl font-semibold tabular-nums leading-none", accent)}>{agent.stakeUsdc} USDC</div>
          </div>
        </div>

        <section className="card-soft p-7">
          <h2 className="text-sm font-semibold">Reasoning · LLM</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">{agent.thesis || "—"}</p>
        </section>

        <section className="card-soft p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Signals bought</h2>
            <span className="text-[13px] text-muted-foreground">
              {agent.buys.length} signals · ${agent.buys.reduce((s, b) => s + b.priceUsdc, 0).toFixed(2)}
            </span>
          </div>
          <div className="mt-4 divide-y divide-border/60">
            {agent.buys.map((b) => (
              <div key={b.tier} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {TIER_LABEL[b.tier]} <span className="ml-1 text-[13px] font-normal text-muted-foreground">${b.priceUsdc.toFixed(2)}</span>
                  </div>
                  <div className="truncate text-[13px] text-muted-foreground">{b.summary}</div>
                </div>
                {b.txHash && (
                  <a href={txUrl(b.txHash)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                    {shortHash(b.txHash)} <ArrowUpRight className="size-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="card-soft p-7">
          <h2 className="text-sm font-semibold">Position & outcome</h2>
          <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Budget cap" value={`${agent.capUsdc} USDC`} />
            <Stat label="Confidence" value={`${agent.confidence}%`} valueClass={accent} />
            <Stat label="Stake" value={`${agent.stakeUsdc} USDC`} />
            {pnl && (
              <Stat
                label={pnl.deltaUsdc >= 0 ? "Profit" : "Loss"}
                value={`${pnl.deltaUsdc >= 0 ? "+" : ""}${pnl.deltaUsdc} USDC`}
                valueClass={pnl.deltaUsdc >= 0 ? "text-yes" : "text-no"}
              />
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4">
            {agent.stakeTx && <TxLink hash={agent.stakeTx} label="stake tx" />}
            {pnl?.claimTx && <TxLink hash={pnl.claimTx} label="claim tx" />}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums", valueClass)}>{value}</div>
    </div>
  );
}
