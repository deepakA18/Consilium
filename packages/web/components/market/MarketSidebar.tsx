import Link from "next/link";
import { LayoutGrid, TrendingUp, TrendingDown, Receipt, Flag, ExternalLink, LogOut, Boxes } from "lucide-react";
import { addressUrl, positionUrl, positionTxUrl, shortAddr } from "@/lib/explorer";
import type { RoundVM } from "@/lib/round-data";

// The position's real Aave v3 Borrow on Ethereum mainnet (block 25,303,986) — proof it's a live borrower.
const POSITION_AAVE_BORROW_TX = "0x61909c68c51d73581b59960e70677eb06a036214b4bb57cba0fa49770ab7b27d";

/** Left rail, iBanKo-style: brand → identity → primary nav → secondary links → exit. */
export function MarketSidebar({ round }: { round: RoundVM }) {
  const q = round.question;
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card px-6 py-7 lg:flex">
      {/* brand */}
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-lg bg-foreground text-background">
          <Boxes className="size-4" />
        </span>
        <span className="font-display text-base font-bold tracking-[0.16em]">CONSILIUM</span>
      </div>

      {/* identity (profile analog) */}
      <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-foreground/10 text-foreground/80">
          <Boxes className="size-5" />
        </div>
        <div className="min-w-0">
          <Link href={positionUrl(q.position)} target="_blank" className="block truncate text-sm font-semibold hover:underline">
            Position {shortAddr(q.position)}
          </Link>
          <div className="text-xs text-muted-foreground">Aave v3 · {q.collateralSymbol}</div>
        </div>
      </div>

      <div className="my-6 h-px bg-border" />

      {/* primary nav */}
      <nav className="space-y-1">
        <NavItem href="#overview" icon={<LayoutGrid className="size-[18px]" />} label="Overview" active />
        <NavItem href="/market/agent/bull" icon={<TrendingUp className="size-[18px]" />} label="Bull agent" route />
        <NavItem href="/market/agent/bear" icon={<TrendingDown className="size-[18px]" />} label="Bear agent" route />
        <NavItem href="#evidence" icon={<Receipt className="size-[18px]" />} label="Evidence" />
        <NavItem href="#resolution" icon={<Flag className="size-[18px]" />} label="Resolution" />
      </nav>

      {/* secondary */}
      <div className="mt-8 space-y-1 border-t border-border pt-6">
        <NavItem href={addressUrl(round.market)} icon={<ExternalLink className="size-[18px]" />} label="Market contract" external />
        <NavItem href={positionUrl(q.position)} icon={<ExternalLink className="size-[18px]" />} label="Position" external />
        <NavItem href={positionTxUrl(POSITION_AAVE_BORROW_TX)} icon={<ExternalLink className="size-[18px]" />} label="Aave borrow tx" external />
      </div>

      {/* exit (sign-out analog) */}
      <Link
        href="/"
        className="mt-auto inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="size-[18px]" /> Back to home
      </Link>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
  external,
  route,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  external?: boolean;
  route?: boolean;
}) {
  const cls = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    active ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
  }`;
  if (route) {
    return (
      <Link href={href} className={cls}>
        {icon}
        {label}
      </Link>
    );
  }
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {icon}
      {label}
    </a>
  ) : (
    <a href={href} className={cls}>
      {icon}
      {label}
    </a>
  );
}
