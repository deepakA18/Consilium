import { SectionLabel, StatusPill, TxLink } from "@/components/ui/bits";
import { cn } from "@/lib/utils";
import type { TimelineEventVM } from "@/lib/round-data";

const statusLabel: Record<TimelineEventVM["status"], string> = {
  ok: "confirmed",
  pending: "pending",
  reverted: "reverted",
  info: "signed",
};

/** GitHub activity feed meets Basescan. Every row: time · actor · what · amount · status · tx. */
export function EventTimeline({ events }: { events: TimelineEventVM[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionLabel>Event timeline</SectionLabel>
      <ol className="relative">
        {events.map((e, i) => {
          const reverted = e.status === "reverted";
          return (
            <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
              {/* rail */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "mt-1 size-2 rounded-full",
                    reverted ? "bg-no" : e.status === "ok" ? "bg-yes" : "bg-muted-foreground",
                  )}
                />
                {i < events.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{e.time}</span>
                  <StatusPill status={e.status}>{statusLabel[e.status]}</StatusPill>
                </div>
                <div className={cn("mt-0.5 text-sm leading-snug", reverted && "text-no")}>
                  <span className="font-semibold">{e.actor}</span>{" "}
                  <span className={cn(!reverted && "text-foreground/85")}>{e.text}</span>
                  {e.amountUsdc != null && (
                    <span className="ml-1 font-mono text-foreground">· {e.amountUsdc} USDC</span>
                  )}
                </div>
                {e.txHash && <TxLink hash={e.txHash} className="mt-1" />}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
