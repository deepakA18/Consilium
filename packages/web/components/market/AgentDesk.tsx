import { AddrLink, SideTag, TxLink, Stat } from "@/components/ui/bits";
import { cn } from "@/lib/utils";
import type { AgentDeskVM } from "@/lib/round-data";

/** A trading desk, not a generic card. Stake size visually = confidence (the costly signal). */
export function AgentDesk({ agent }: { agent: AgentDeskVM }) {
  const accent = agent.side === "YES" ? "text-yes" : "text-no";
  const bar = agent.side === "YES" ? "bg-yes" : "bg-no";
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-widest">{agent.label}</span>
          <SideTag side={agent.side} />
        </div>
        <AddrLink address={agent.address} className="text-[11px]" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Budget cap" value={`${agent.capUsdc} USDC`} />
        <Stat label="Evidence" value={`${agent.evidenceUsdc.toFixed(2)} USDC`} sub={`${agent.buys} buy${agent.buys === 1 ? "" : "s"}`} />
        <Stat label="Position" value={<span className={cn("font-bold", accent)}>{agent.side}</span>} />
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Current thesis</div>
        <p className="mt-1 text-sm leading-snug text-foreground/90">{agent.thesis}</p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>Confidence</span>
          <span className={cn("font-mono", accent)}>{agent.confidence}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full", bar)} style={{ width: `${agent.confidence}%` }} />
        </div>
      </div>

      {/* Stake — large; the size IS the costly signal. */}
      <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Stake</div>
          <div className={cn("font-mono text-3xl font-bold tabular-nums", accent)}>{agent.stakeUsdc} USDC</div>
        </div>
        <TxLink hash={agent.stakeTx} label="stake tx" />
      </div>
    </div>
  );
}
