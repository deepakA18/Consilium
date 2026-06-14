"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ExternalLink, Boxes, Play, Loader2, PenLine } from "lucide-react";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/WalletButton";
import { GrantDialog } from "@/components/market/GrantDialog";
import { useGrant } from "@/lib/use-grant";
import { addressUrl, shortAddr } from "@/lib/explorer";
import { cn } from "@/lib/utils";
import { MarketSidebar } from "@/components/market/MarketSidebar";
import { ProbabilityHero } from "@/components/market/ProbabilityHero";
import { MetricCards } from "@/components/market/MetricCards";
import { PriceChart } from "@/components/market/PriceChart";
import { AgentDesk } from "@/components/market/AgentDesk";
import { AgentsCard, EvidenceCard } from "@/components/market/BottomCards";
import { RejectCard } from "@/components/market/RejectCard";
import { ActivityList } from "@/components/market/ActivityList";
import { VerdictCards } from "@/components/market/VerdictCards";
import { DEMO_ROUND, SIDE_LABEL } from "@/lib/round-data";
import { useLiveRound, runLiveRound } from "@/lib/use-live-round";

export function LiveMarket() {
  const { round: live, status, running } = useLiveRound();
  const { isConnected } = useAccount();
  const { grant, granting, granted, error: grantError } = useGrant();
  const [starting, setStarting] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const round = live ?? DEMO_ROUND;
  const isLive = live != null;
  const resolved = round.state === "resolved";
  const won = (side: string) => resolved && side === round.resolution.outcome;

  async function handleRun() {
    setStarting(true);
    await runLiveRound();
    setTimeout(() => setStarting(false), 4000); // events take over from here
  }

  return (
    <div className="theme-light flex min-h-screen bg-background text-foreground">
      <MarketSidebar round={round} />

      <main className="min-w-0 flex-1 overflow-x-hidden">
        {/* topbar */}
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <Link href="/" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground lg:hidden">
                <ArrowLeft className="size-4" />
              </Link>
              <h1 className="truncate font-display text-base font-semibold tracking-tight sm:text-lg">Liquidation-risk oracle</h1>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {/* live status / run control */}
              {isLive ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold",
                    running ? "bg-pending/15 text-pending" : "bg-yes/15 text-yes",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", running ? "animate-pulse bg-pending" : "bg-yes")} />
                  {running ? "LIVE" : `Resolved · ${SIDE_LABEL[round.resolution.outcome]}`}
                </span>
              ) : (
                !isConnected ? (
                  <button
                    disabled
                    title="Connect a wallet to grant the budget and run a round"
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground opacity-50"
                  >
                    <Play className="size-3.5" /> Connect wallet to run
                  </button>
                ) : !granted ? (
                  <button
                    onClick={() => setGrantOpen(true)}
                    disabled={status !== "connected"}
                    title="Delegate a USDC budget to the fund-manager"
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <PenLine className="size-3.5" /> Grant budget
                  </button>
                ) : (
                  <button
                    onClick={handleRun}
                    disabled={starting || status !== "connected"}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {starting ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                    {status === "connected" ? (starting ? "Starting…" : "Run live round") : status === "connecting" ? "Connecting…" : "Hub offline"}
                  </button>
                )
              )}
              <span className="pill-soft hidden sm:inline-flex">
                <Boxes className="size-3.5" /> {shortAddr(round.market)} <ChevronDown className="size-3" />
              </span>
              <a
                href={addressUrl(round.market)}
                target="_blank"
                rel="noreferrer"
                className="grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </a>
              <WalletButton />
            </div>
          </div>
        </header>

        <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
            <div className="min-w-0 space-y-8">
              <div className="rise-in">
                <ProbabilityHero round={round} />
              </div>

              <section className="rise-in" style={{ animationDelay: "0.06s" }}>
                <SectionHead title="Key metrics" selector={isLive && running ? "Live" : isLive ? "Final" : "Demo"} />
                <MetricCards round={round} />
              </section>

              <div className="rise-in" style={{ animationDelay: "0.12s" }}>
                <PriceChart round={round} />
              </div>

              <section id="agents" className="rise-in" style={{ animationDelay: "0.16s" }}>
                <div className="grid items-stretch gap-6 sm:grid-cols-2">
                  {round.agents.map((a) => (
                    <AgentDesk key={a.role} agent={a} won={won(a.side)} />
                  ))}
                </div>
              </section>

              <div className="rise-in grid gap-6 sm:grid-cols-2" style={{ animationDelay: "0.2s" }} id="evidence">
                <AgentsCard round={round} />
                <EvidenceCard round={round} />
              </div>

              <div className="rise-in" style={{ animationDelay: "0.24s" }}>
                <RejectCard round={round} />
              </div>
            </div>

            <div className="min-w-0 space-y-8">
              <div className="rise-in" style={{ animationDelay: "0.1s" }}>
                <ActivityList events={round.timeline} />
              </div>
              <div className="rise-in" style={{ animationDelay: "0.18s" }}>
                <VerdictCards round={round} />
              </div>
            </div>
          </div>

          <footer className="mt-12 border-t border-border pt-4 text-[11px] text-muted-foreground">
            Consilium · agent-run liquidation-risk oracle
          </footer>
        </div>
      </main>

      <GrantDialog open={grantOpen} onClose={() => setGrantOpen(false)} onConfirm={grant} granting={granting} error={grantError} />
    </div>
  );
}

function SectionHead({ title, selector }: { title: string; selector?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      {selector && (
        <span className="pill-soft">
          {selector} <ChevronDown className="size-3" />
        </span>
      )}
    </div>
  );
}
