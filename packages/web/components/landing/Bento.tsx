import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { txUrl, shortHash } from "@/lib/explorer";
import { DEMO_ROUND as r } from "@/lib/round-data";

/**
 * Illustrated bento grid for the landing page — each card pairs a tiny live-feeling visual with one
 * line of copy, so the page sells the product through pictures, not paragraphs. Monochrome glass;
 * color only where it's signal (the YES/NO split, the revert red). Figures trace to the seeded round.
 */
export function FeatureBento() {
  return (
    <section className="py-20">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yes">Inside a round</div>
      <h2 className="mt-3 max-w-3xl text-balance font-display text-4xl font-bold leading-[1.02] tracking-[-0.025em] sm:text-5xl">
        One signature, fanned into a bounded, self-pricing market.
      </h2>

      <div className="mt-10 grid auto-rows-[1fr] gap-4 lg:grid-cols-6">
        <Card className="lg:col-span-3" kicker="Delegation" title="A bounded hierarchy" sub="Human → fund-manager → traders → executors. Each hop can only narrow the cap.">
          <DelegationGraph />
        </Card>

        <Card className="lg:col-span-3" kicker="x402 evidence" title="Agents pay agents" sub="Tiered onchain risk signals, settled per call over x402 + ERC-7710.">
          <EvidenceStack />
        </Card>

        <Card className="lg:col-span-2" kicker="Output" accent="yes" title="A priced probability" sub="Capital-weighted pot split, the signal a liquidator bot pays to read.">
          <ProbabilityGauge />
        </Card>

        <Card className="lg:col-span-2" kicker="Resolution" title="Settled by a price feed" sub="Chainlink price + L2 sequencer guard decides LIQUIDATABLE / SAFE.">
          <PriceCross />
        </Card>

        <Card className="lg:col-span-2 border-no/25 bg-no/[0.035]" kicker="Enforcement" accent="no" title="The chain says no" sub="Over-cap stake reverts at the enforcer, three hops from the human.">
          <RevertViz />
        </Card>
      </div>
    </section>
  );
}

function Card({
  className,
  kicker,
  title,
  sub,
  accent,
  children,
}: {
  className?: string;
  kicker: string;
  title: string;
  sub: string;
  accent?: "yes" | "no";
  children: React.ReactNode;
}) {
  const kickerColor = accent === "yes" ? "text-yes" : accent === "no" ? "text-no" : "text-muted-foreground";
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-colors duration-300 hover:bg-white/[0.045]",
        className,
      )}
    >
      {/* illustration — flush to the top edge, divider below */}
      <div className="relative h-40 shrink-0 overflow-hidden border-b border-white/[0.07] bg-[radial-gradient(130%_130%_at_50%_-10%,oklch(0.17_0_0)_0%,oklch(0.10_0_0)_100%)]">
        {children}
      </div>
      {/* text block — consistent rhythm so every card aligns */}
      <div className="flex flex-1 flex-col p-5">
        <div className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", kickerColor)}>{kicker}</div>
        <h3 className="mt-1.5 font-display text-xl font-bold tracking-[-0.01em]">{title}</h3>
        <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "float-card absolute z-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-medium backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---- card 1: delegation chain ---- */
function DelegationGraph() {
  return (
    <>
      <svg viewBox="0 0 300 176" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <g fill="none" stroke="oklch(0.55 0 0)" strokeWidth="1.25" className="dash-flow">
          <path d="M150 34 L150 60" />
          <path d="M150 90 L150 104 L75 104 L75 122" />
          <path d="M150 104 L225 104 L225 122" />
          <path d="M75 152 L75 162" />
          <path d="M225 152 L225 162" />
        </g>
        <GNode x={108} y={12} w={84} label="Human" mono="root" />
        <GNode x={96} y={62} w={108} label="Fund-manager" mono="100" />
        <GNode x={32} y={124} w={86} label="Bull" mono="20" tone="yes" />
        <GNode x={182} y={124} w={86} label="Bear" mono="20" tone="no" />
        <GNode x={42} y={163} w={66} label="exec" tiny />
        <GNode x={192} y={163} w={66} label="exec" tiny />
      </svg>
    </>
  );
}

function GNode({
  x,
  y,
  w,
  label,
  mono,
  tone,
  tiny,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  mono?: string;
  tone?: "yes" | "no";
  tiny?: boolean;
}) {
  const h = tiny ? 14 : 22;
  const stroke = tone === "yes" ? "oklch(0.72 0.17 155)" : tone === "no" ? "oklch(0.64 0.20 22)" : "oklch(0.4 0 0)";
  const text = tone === "yes" ? "oklch(0.78 0.15 155)" : tone === "no" ? "oklch(0.72 0.18 22)" : "oklch(0.85 0 0)";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="oklch(0.16 0 0)" stroke={stroke} strokeWidth="1" />
      <text x={x + (mono ? 10 : w / 2)} y={y + h / 2 + 3} textAnchor={mono ? "start" : "middle"} fontSize={tiny ? 8 : 9.5} fontWeight="600" fill={text} fontFamily="var(--font-sans)">
        {label}
      </text>
      {mono && (
        <text x={x + w - 8} y={y + h / 2 + 3} textAnchor="end" fontSize="9" fill="oklch(0.6 0 0)" fontFamily="var(--font-sans)">
          {mono}
        </text>
      )}
    </g>
  );
}

/* ---- card 2: x402 evidence market ---- */
function EvidenceStack() {
  const tiers = [
    { k: "Health factor", v: "$0.02" },
    { k: "Price headroom", v: "$0.05" },
    { k: "Exit liquidity", v: "$0.10" },
  ];
  return (
    <>
      <div className="flex h-full flex-col justify-center gap-2 px-5">
        {tiers.map((t, i) => (
          <div
            key={t.k}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur-sm"
            style={{ marginLeft: `${i * 14}px`, marginRight: `${(2 - i) * 14}px` }}
          >
            <span className="text-xs font-medium text-foreground/85">{t.k}</span>
            <span className="text-xs text-foreground/60">{t.v}</span>
          </div>
        ))}
        <div className="relative mt-1 h-px bg-white/10">
          <span className="consilium-flow absolute -top-[3px] size-1.5 rounded-full bg-white/80" />
        </div>
      </div>
    </>
  );
}

/* ---- card 3: published probability gauge ---- */
function ProbabilityGauge() {
  const { yesPct, noPct } = r;
  return (
    <div className="flex h-full flex-col items-center justify-center px-5">
      <svg viewBox="0 0 120 64" className="w-40">
        <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="oklch(0.25 0 0)" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M10 60 A50 50 0 0 1 110 60"
          fill="none"
          stroke="oklch(0.72 0.17 155)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(yesPct / 100) * 157} 157`}
        />
      </svg>
      <div className="-mt-6 text-center">
        <div className="text-3xl font-bold tabular-nums text-yes">{yesPct}%</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">P(liquidation)</div>
      </div>
      <div className="mt-2 flex w-full items-center justify-between text-[10px]">
        <span className="text-yes">LIQUIDATABLE {yesPct}</span>
        <span className="text-no">{noPct} SAFE</span>
      </div>
    </div>
  );
}

/* ---- card 4: trustless price-cross resolution ---- */
function PriceCross() {
  return (
    <>
      <svg viewBox="0 0 300 176" className="h-full w-full" preserveAspectRatio="none">
        {/* strike line */}
        <line x1="0" y1="92" x2="300" y2="92" stroke="oklch(0.64 0.20 22)" strokeWidth="1" strokeDasharray="5 5" opacity="0.7" />
        {/* price path descending across the strike */}
        <path
          d="M0 40 C 50 48, 70 60, 110 64 S 170 84, 210 104 S 270 132, 300 140"
          fill="none"
          stroke="oklch(0.92 0 0)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="186" cy="92" r="4" fill="oklch(0.64 0.20 22)" />
        <circle cx="186" cy="92" r="9" fill="none" stroke="oklch(0.64 0.20 22)" strokeWidth="1" opacity="0.5" />
      </svg>
      <div className="absolute bottom-2 left-3 text-[9px] text-no/80">strike</div>
    </>
  );
}

/* ---- card 5: the revert (money-moment) ---- */
function RevertViz() {
  const { reject } = r;
  return (
    <>
      <div className="flex h-full flex-col justify-center gap-3 px-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-no/70">attempted</div>
            <div className="text-xl font-bold text-no">{reject.attemptedUsdc} USDC</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">cap</div>
            <div className="text-xl font-bold text-foreground/70">{reject.allowedUsdc} USDC</div>
          </div>
        </div>
        <div className="truncate rounded-md border border-no/25 bg-no/[0.06] px-2 py-1.5 text-[10px] text-foreground/80">
          {reject.reason}
        </div>
        <a
          href={txUrl(reject.txHash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-no transition-colors hover:text-foreground"
        >
          failed tx {shortHash(reject.txHash)} <ArrowUpRight className="size-3" />
        </a>
      </div>
    </>
  );
}
