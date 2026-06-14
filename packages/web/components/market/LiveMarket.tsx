"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ExternalLink, Boxes, Play, Loader2, PenLine, WifiOff, Inbox } from "lucide-react";
import { useAccount } from "wagmi";
import { Logo } from "@/components/Logo";
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
import { SIDE_LABEL, type RoundVM } from "@/lib/round-data";
import { useLiveRound, runLiveRound, type LiveStatus } from "@/lib/use-live-round";

export function LiveMarket() {
  const { round: live, status, running } = useLiveRound();
  const { isConnected } = useAccount();
  const { grant, granting, granted, error: grantError, reset: resetGrant } = useGrant();
  const [starting, setStarting] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  async function handleRun() {
    setStarting(true);
    const ok = await runLiveRound();
    // The hub consumes the grant for this round; require a fresh signature before the next one.
    if (ok) resetGrant();
    setTimeout(() => setStarting(false), 4000); // events take over from here
  }

  const runControls = (
    <RunControls
      round={live}
      running={running}
      isConnected={isConnected}
      granted={granted}
      status={status}
      starting={starting}
      onRun={handleRun}
      onGrant={() => setGrantOpen(true)}
    />
  );
  const grantDialog = (
    <GrantDialog open={grantOpen} onClose={() => setGrantOpen(false)} onConfirm={grant} granting={granting} error={grantError} />
  );

  // No round to show yet: the hub serves the last completed round over SSE, so this only appears
  // while connecting, when the hub is offline, or before any round has run. Never fabricated data.
  if (!live) {
    return (
      <>
        <EmptyMarket status={status} controls={runControls} />
        {grantDialog}
      </>
    );
  }

  const round: RoundVM = live;
  const resolved = round.state === "resolved";
  const won = (side: string) => resolved && side === round.resolution.outcome;

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
              {runControls}
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
                <SectionHead title="Key metrics" selector={running ? "Live" : "Final"} />
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

      {grantDialog}
    </div>
  );
}

/** Connect → grant → run cluster, plus the LIVE / Resolved badge once a round exists. Shared by the
 *  topbar and the empty state so the run flow is identical in both. */
function RunControls({
  round,
  running,
  isConnected,
  granted,
  status,
  starting,
  onRun,
  onGrant,
}: {
  round: RoundVM | null;
  running: boolean;
  isConnected: boolean;
  granted: boolean;
  status: LiveStatus;
  starting: boolean;
  onRun: () => void;
  onGrant: () => void;
}) {
  // A round is in flight — nothing to do but watch.
  if (running) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-pending/15 px-3 py-1.5 text-[11px] font-semibold text-pending">
        <span className="size-1.5 animate-pulse rounded-full bg-pending" />
        LIVE
      </span>
    );
  }

  const resolved = round?.state === "resolved";
  const btn =
    "inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

  // The grant is consumed per round, so after one resolves `granted` is reset and the flow returns to
  // Grant → Run for the next round. `starting` bridges the gap between firing a run and the first
  // event arriving, so the button doesn't flicker back to "Grant budget" mid-launch.
  let action: React.ReactNode;
  if (starting) {
    action = (
      <button disabled className={cn(btn, "opacity-70")}>
        <Loader2 className="size-3.5 animate-spin" /> Starting…
      </button>
    );
  } else if (!isConnected) {
    action = (
      <button disabled title="Connect a wallet to grant the budget and run a round" className={cn(btn, "opacity-50")}>
        <Play className="size-3.5" /> Connect wallet to run
      </button>
    );
  } else if (!granted) {
    action = (
      <button onClick={onGrant} disabled={status !== "connected"} title="Delegate a USDC budget to the fund-manager" className={btn}>
        <PenLine className="size-3.5" /> {resolved ? "Grant to run again" : "Grant budget"}
      </button>
    );
  } else {
    action = (
      <button onClick={onRun} disabled={status !== "connected"} className={btn}>
        <Play className="size-3.5" />
        {status === "connected" ? (resolved ? "Run another round" : "Run live round") : status === "connecting" ? "Connecting…" : "Hub offline"}
      </button>
    );
  }

  return (
    <>
      {resolved && round && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-yes/15 px-3 py-1.5 text-[11px] font-semibold text-yes">
          <span className="size-1.5 rounded-full bg-yes" />
          Resolved · {SIDE_LABEL[round.resolution.outcome]}
        </span>
      )}
      {action}
    </>
  );
}

/** Shown when the hub has no round to serve yet (connecting, offline, or none has run). The hub
 *  replays the last completed round over SSE, so a populated dashboard means real data — and this
 *  screen means there genuinely isn't a round to show, rather than a fabricated placeholder. */
function EmptyMarket({ status, controls }: { status: LiveStatus; controls: React.ReactNode }) {
  const copy =
    status === "connecting"
      ? { icon: <Loader2 className="size-6 animate-spin" />, title: "Connecting to the hub…", body: "Subscribing to the live event stream." }
      : status === "offline"
        ? { icon: <WifiOff className="size-6" />, title: "Hub offline", body: "The last completed round will appear here once the event hub is reachable." }
        : { icon: <Inbox className="size-6" />, title: "No round yet", body: "No round has run on this hub. Grant a budget and run one to see it here." };

  return (
    <div className="theme-light flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-foreground">
            <Logo className="size-6 text-foreground" />
            <span className="font-display text-base font-semibold tracking-tight">Liquidation-risk oracle</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {controls}
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="card-soft flex max-w-md flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted/70 text-muted-foreground">{copy.icon}</span>
          <h2 className="text-lg font-semibold">{copy.title}</h2>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </div>
      </div>
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
