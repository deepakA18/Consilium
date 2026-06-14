import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AddrLink } from "@/components/ui/bits";
import { cn } from "@/lib/utils";
import { SIDE_LABEL, type AgentDeskVM } from "@/lib/round-data";

/** A position card. One focal number (the stake), the thesis, and a quiet footer. The signal/tx
 *  detail lives in the Evidence card and the Activity feed — kept off this card on purpose. */
export function AgentDesk({ agent, won }: { agent: AgentDeskVM; won?: boolean }) {
  const yes = agent.side === "YES";
  const accent = yes ? "text-yes" : "text-no";
  const evidenceUsdc = agent.buys.reduce((s, b) => s + b.priceUsdc, 0);

  return (
    <div
      className={cn(
        "card-soft relative flex h-full flex-col overflow-hidden p-7",
        won && (yes ? "ring-1 ring-yes/40" : "ring-1 ring-no/40"),
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <span className="text-sm font-semibold tracking-wide">{agent.label}</span>
          <span className={cn("text-[13px] font-medium", accent)}>{SIDE_LABEL[agent.side]}</span>
        </div>
        {won ? (
          <span className={cn("text-[13px] font-medium", accent)}>Won</span>
        ) : (
          <AddrLink address={agent.address} className="text-xs" />
        )}
      </div>

      {/* focal: stake */}
      <div className="mt-8">
        <div className="text-[13px] text-muted-foreground">Staked</div>
        <div className={cn("mt-1 text-5xl font-semibold tabular-nums leading-none", accent)}>
          {agent.stakeUsdc}
          <span className="ml-2 text-base font-medium text-muted-foreground">USDC</span>
        </div>
      </div>

      {/* quiet footer */}
      <div className="mt-auto flex items-center justify-between pt-8 text-[13px]">
        <span className="text-muted-foreground">
          <span className={cn("font-medium", accent)}>{agent.confidence}%</span> confidence · ${evidenceUsdc.toFixed(2)} evidence
        </span>
        <Link href={`/market/agent/${agent.role}`} className="inline-flex items-center gap-1 font-medium text-foreground/70 transition-colors hover:text-foreground">
          View reasoning <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
