import Link from "next/link";
import { AddrLink } from "@/components/ui/bits";
import { QuestionHero } from "@/components/market/QuestionHero";
import { AgentDesk } from "@/components/market/AgentDesk";
import { EventTimeline } from "@/components/market/EventTimeline";
import { EvidenceMarket } from "@/components/market/EvidenceMarket";
import { RejectCard } from "@/components/market/RejectCard";
import { ResolutionCard } from "@/components/market/ResolutionCard";
import { DEMO_ROUND as round } from "@/lib/round-data";

export default function MarketPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      {/* command bar */}
      <header className="flex items-center justify-between border-b border-border pb-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="size-2 animate-pulse rounded-full bg-yes" />
          <span className="text-sm font-bold tracking-[0.18em]">CONSILIUM</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-yes">● live</span>
        </Link>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>Live Adversarial Agent Market</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            market <AddrLink address={round.market} />
          </span>
        </div>
      </header>

      <div className="mt-6 space-y-6">
        <QuestionHero round={round} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="grid gap-6 sm:grid-cols-2">
              {round.agents.map((a) => (
                <AgentDesk key={a.role} agent={a} />
              ))}
            </div>
            <EvidenceMarket round={round} />
            <RejectCard round={round} />
          </div>

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <EventTimeline events={round.timeline} />
            </div>
          </div>
        </div>

        <ResolutionCard round={round} />
      </div>

      <footer className="mt-10 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground">
        Every figure ↗ resolves to a real Base Sepolia transaction · MetaMask Smart Accounts · x402 + ERC-7710 · 1Shot
        relayer
      </footer>
    </main>
  );
}
