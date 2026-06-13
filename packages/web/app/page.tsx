import Link from "next/link";
import { ArrowRight, ArrowUpRight, ShieldX } from "lucide-react";
import { TxLink } from "@/components/ui/bits";
import { txUrl, shortHash } from "@/lib/explorer";
import { DEMO_ROUND as r } from "@/lib/round-data";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6">
      {/* nav */}
      <nav className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5">
          <span className="size-2 animate-pulse rounded-full bg-yes" />
          <span className="text-sm font-bold tracking-[0.18em]">CONSILIUM</span>
        </div>
        <Link
          href="/market"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
        >
          Enter market <ArrowRight className="size-3.5" />
        </Link>
      </nav>

      {/* hero */}
      <section className="border-b border-border py-20">
        <div className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-yes">
          <span className="size-1.5 rounded-full bg-yes" /> Live · Base Sepolia
        </div>
        <h1 className="mt-5 max-w-3xl text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Autonomous agents, spending real money, on a leash the chain enforces.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          A live war room where two adversarial agents take opposite sides of one resolvable question, buy evidence from
          a research agent, stake real USDC — and get <span className="text-no">cryptographically rejected</span> when
          they exceed their delegated authority. Every figure on screen traces to a real onchain transaction.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/market"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Enter the command center <ArrowRight className="size-4" />
          </Link>
          <a
            href="#how"
            className="inline-flex items-center rounded-md border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            How it works
          </a>
        </div>
      </section>

      {/* three questions */}
      <section className="grid gap-px border-b border-border bg-border sm:grid-cols-3">
        {[
          { k: "What is the market?", v: "One resolvable question — will a watched wallet's USDC balance clear a threshold by a deadline. Settled trustlessly onchain." },
          { k: "What are the agents doing?", v: "Reasoning, buying evidence, and staking against each other in real time. The market price is the coordination mechanism." },
          { k: "Can I verify it?", v: "Every number is a link. Click any figure and land on a real Base Sepolia transaction. Nothing is mocked." },
        ].map((c) => (
          <div key={c.k} className="bg-background p-6">
            <div className="text-sm font-semibold">{c.k}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.v}</p>
          </div>
        ))}
      </section>

      {/* how a round works */}
      <section id="how" className="border-b border-border py-16">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Anatomy of a round</h2>
        <ol className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {[
            ["01", "One signature", "A human grants a budget once. It fans out through a 3-level delegation chain: human → fund-manager → traders → executors, each hop strictly narrowing the cap."],
            ["02", "Buy evidence (x402)", "Each agent pays the research agent real USDC per call (x402 + ERC-7710) for the same balance read. Peers paying peers — not a fan-out tree."],
            ["03", "Reason & stake (1Shot)", "Agents reason, then stake YES/NO via the 1Shot relayer — gas paid in USDC, no ETH. Stake size is a costly confidence signal."],
            ["04", "Resolve & claim", "After the deadline anyone resolves against the wallet's real balance; winners claim pro-rata. A Venice-generated verdict card seals it."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-4">
              <span className="font-mono text-sm font-bold text-muted-foreground">{n}</span>
              <div>
                <div className="text-sm font-semibold">{t}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* two money-moments */}
      <section className="grid gap-6 border-b border-border py-16 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Costly signal
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">
            Confidence you can't fake. An agent's stake size <em>is</em> its conviction — the bluffing agent can't afford
            to look sure. In our last round the confident agent staked{" "}
            <span className="font-mono text-yes">20 USDC</span>; the doubter,{" "}
            <span className="font-mono text-no">1 USDC</span>.
          </p>
          <div className="mt-4 flex items-end gap-4">
            <Bar label="BULL · YES" pct={100} amount="20 USDC" tone="yes" tx={r.agents[0].stakeTx} />
            <Bar label="BEAR · NO" pct={8} amount="1 USDC" tone="no" tx={r.agents[1].stakeTx} />
          </div>
        </div>

        <div className="rounded-xl border border-no/40 bg-no/5 p-6">
          <div className="flex items-center gap-2 text-no">
            <ShieldX className="size-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">The revert</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">
            An agent tried to stake past its delegated cap. No app-code guard rejected it — the{" "}
            <span className="text-foreground">ERC20TransferAmount</span> enforcer did, on-chain, three hops from the human
            signature. The cap is structural, not aspirational.
          </p>
          <div className="mt-4 rounded-md border border-no/30 bg-background/50 p-2.5 font-mono text-xs text-foreground/90">
            {r.reject.reason}
          </div>
          <a
            href={txUrl(r.reject.txHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-no hover:underline"
          >
            View the failed transaction <span className="font-mono opacity-70">{shortHash(r.reject.txHash)}</span>
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </section>

      {/* stack */}
      <section className="border-b border-border py-12">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Four primitives, each load-bearing
        </h2>
        <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["MetaMask Smart Accounts", "7702 accounts + a 3-level redelegation chain"],
            ["x402 + ERC-7710", "agents pay agents per call, settled in USDC"],
            ["1Shot relayer", "gas paid in USDC; webhooks drive live status"],
            ["Venice", "agent reasoning + the multimodal verdict card"],
          ].map(([t, d]) => (
            <div key={t}>
              <div className="text-sm font-semibold">{t}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* final cta */}
      <section className="py-20 text-center">
        <h2 className="mx-auto max-w-xl text-balance text-2xl font-semibold tracking-tight">
          One human signature → a bounded, adversarial, multi-agent onchain market.
        </h2>
        <Link
          href="/market"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Enter the command center <ArrowRight className="size-4" />
        </Link>
      </section>

      <footer className="border-t border-border py-6 font-mono text-[11px] text-muted-foreground">
        Consilium · Base Sepolia · every figure ↗ resolves to a real transaction
      </footer>
    </main>
  );
}

function Bar({ label, pct, amount, tone, tx }: { label: string; pct: number; amount: string; tone: "yes" | "no"; tx: string }) {
  const color = tone === "yes" ? "bg-yes" : "bg-no";
  const text = tone === "yes" ? "text-yes" : "text-no";
  return (
    <div className="flex-1">
      <div className="flex h-28 items-end">
        <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(pct, 6)}%` }} />
      </div>
      <div className="mt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-bold ${text}`}>{amount}</div>
      <TxLink hash={tx} className="mt-0.5" />
    </div>
  );
}
