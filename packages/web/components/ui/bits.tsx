import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { txUrl, addressUrl, shortHash, shortAddr } from "@/lib/explorer";
import type { Side, EventStatus } from "@/lib/round-data";

/** A tx-hash chip that links to Basescan. Verification-first: every figure with a tx
 *  gets one of these. */
export function TxLink({ hash, label, className }: { hash: string; label?: string; className?: string }) {
  return (
    <a
      href={txUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {label ?? shortHash(hash)}
      <ArrowUpRight className="size-3 opacity-60" />
    </a>
  );
}

export function AddrLink({ address, className }: { address: string; className?: string }) {
  return (
    <a
      href={addressUrl(address)}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center gap-1 text-foreground/80 hover:text-foreground", className)}
    >
      {shortAddr(address)}
      <ArrowUpRight className="size-3 opacity-50" />
    </a>
  );
}

const statusStyle: Record<EventStatus, string> = {
  ok: "bg-yes/15 text-yes",
  pending: "bg-pending/15 text-pending",
  reverted: "bg-no/15 text-no",
  info: "bg-muted text-muted-foreground",
};

export function StatusPill({ status, children }: { status: EventStatus; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        statusStyle[status],
      )}
    >
      {children}
    </span>
  );
}

export function SideTag({ side, label, className }: { side: Side; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-bold tracking-wide",
        side === "YES" ? "bg-yes/15 text-yes" : "bg-no/15 text-no",
        className,
      )}
    >
      {label ?? side}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{children}</h2>
  );
}

export function Stat({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm text-foreground", valueClass)}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
