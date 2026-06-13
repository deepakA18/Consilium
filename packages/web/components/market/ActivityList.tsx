import { ArrowUpRight, ChevronDown } from "lucide-react";
import { txUrl } from "@/lib/explorer";
import { cn } from "@/lib/utils";
import type { TimelineEventVM } from "@/lib/round-data";

/** Icon tint by event kind: stake/claim → green, evidence buys → amber, reverts → red, else neutral. */
function iconColor(e: TimelineEventVM): string {
  if (e.status === "reverted") return "text-no";
  const t = e.text.toLowerCase();
  if (t.includes("staked") || t.includes("claimed")) return "text-yes";
  if (t.includes("bought")) return "text-pending";
  return "text-muted-foreground/70";
}

/** Receipt/ledger glyph used as the activity row marker. */
function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" className={className} aria-hidden>
      <path d="M21.276 2.876a3.001 3.001 0 0 0-2.116-.873H8a3 3 0 0 0-3 3v20.341a3 3 0 0 0 4.878 2.339l.496-.398a1.002 1.002 0 0 1 1.252 0l2.498 2.006a3 3 0 0 0 3.753.003l2.5-2a.998.998 0 0 1 1.248-.001l.518.413a3 3 0 0 0 4.871-2.345V9.831c0-.798-.318-1.563-.884-2.126zM18 4.003H8a1 1 0 0 0-1 1v20.341a1.001 1.001 0 0 0 1.626.78l.496-.398a3 3 0 0 1 3.756 0l2.498 2.006c.365.293.885.293 1.251.001l2.5-2.001a3.001 3.001 0 0 1 3.746-.003l.518.413a1 1 0 0 0 1.623-.781V11H21a2.996 2.996 0 0 1-2.121-.879A2.996 2.996 0 0 1 18 8zm.741 19.67 2.966-2.966A1 1 0 0 0 21 19H11a1 1 0 0 0 0 2h7.586l-1.259 1.259a.999.999 0 1 0 1.414 1.414zm-5.482-11.346-2.966 2.966A1 1 0 0 0 11 17h10a1 1 0 0 0 0-2h-7.586l1.259-1.259a.999.999 0 1 0-1.414-1.414zM20 4.427V8a.997.997 0 0 0 1 1h3.596z" />
    </svg>
  );
}

/** Activity feed — a clean, quiet list. A small dot carries status; the revert is the only one that
 *  stands out. No repeating icon tiles. */
export function ActivityList({ events }: { events: TimelineEventVM[] }) {
  return (
    <div className="card-soft p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Activity</h3>
        <span className="pill-soft">
          This round <ChevronDown className="size-3" />
        </span>
      </div>

      <ul className="mt-3 max-h-[64vh] divide-y divide-border/50 overflow-y-auto pr-1">
        {events
          .slice()
          .reverse()
          .map((e, i) => (
            <li key={i} className="flex items-center gap-3 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted/70">
                <ReceiptIcon className={cn("size-[18px]", iconColor(e))} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">
                  <span className="font-medium">{e.actor}</span>{" "}
                  <span className={cn(e.status === "reverted" ? "text-no" : "text-muted-foreground")}>{e.text}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground/70">{e.time}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {e.amountUsdc != null && <span className="text-sm font-medium tabular-nums">{e.amountUsdc}</span>}
                {e.txHash && (
                  <a href={txUrl(e.txHash)} target="_blank" rel="noreferrer" className="text-muted-foreground/60 transition-colors hover:text-foreground">
                    <ArrowUpRight className="size-3.5" />
                  </a>
                )}
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}
