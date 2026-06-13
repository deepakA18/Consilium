import Link from "next/link";
import { ArrowLeft, ChevronDown, ExternalLink, Boxes } from "lucide-react";
import { addressUrl, shortAddr } from "@/lib/explorer";
import { MarketSidebar } from "@/components/market/MarketSidebar";
import { ProbabilityHero } from "@/components/market/ProbabilityHero";
import { MetricCards } from "@/components/market/MetricCards";
import { PriceChart } from "@/components/market/PriceChart";
import { AgentDesk } from "@/components/market/AgentDesk";
import { AgentsCard, EvidenceCard } from "@/components/market/BottomCards";
import { RejectCard } from "@/components/market/RejectCard";
import { ActivityList } from "@/components/market/ActivityList";
import { VerdictCards } from "@/components/market/VerdictCards";
import { DEMO_ROUND as round } from "@/lib/round-data";

export default function MarketPage() {
  const resolved = round.state === "resolved";
  const won = (side: string) => resolved && side === round.resolution.outcome;

  return (
    <div className="theme-light flex min-h-screen bg-background text-foreground">
      <MarketSidebar round={round} />

      <main className="min-w-0 flex-1">
        {/* topbar */}
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4 px-6 py-4 lg:px-8">
            <div className="flex items-center gap-2.5">
              <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground lg:hidden">
                <ArrowLeft className="size-4" />
              </Link>
              <h1 className="font-display text-lg font-semibold tracking-tight">Liquidation-risk oracle</h1>
            </div>

            <div className="flex items-center gap-2.5">
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
            </div>
          </div>
        </header>

        <div className="px-6 py-6 lg:px-8">
          <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
            {/* primary column */}
            <div className="min-w-0 space-y-8">
              <div className="rise-in">
                <ProbabilityHero round={round} />
              </div>

              {/* key metrics (Financial Record analog) */}
              <section className="rise-in" style={{ animationDelay: "0.06s" }}>
                <SectionHead title="Key metrics" selector="Live" />
                <MetricCards round={round} />
              </section>

              {/* price chart (Money Flow analog) */}
              <div className="rise-in" style={{ animationDelay: "0.12s" }}>
                <PriceChart round={round} />
              </div>

              {/* bottom row */}
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

              {/* enforcement money-moment */}
              <div className="rise-in" style={{ animationDelay: "0.24s" }}>
                <RejectCard round={round} />
              </div>
            </div>

            {/* right rail */}
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
