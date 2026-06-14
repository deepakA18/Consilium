"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NebulaCanvas } from "@/components/visual/NebulaCanvas";

/**
 * Full-viewport animated hero. A WebGL nebula that fades to near-black at the edges and melts into
 * the page background — a clean, oversized display headline over it. No clutter.
 */
export function Hero() {
  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: "100svh" }}>
      {/* nebula + CSS fallback */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_35%,oklch(0.20_0_0)_0%,oklch(0.08_0_0)_66%)]" />
      <NebulaCanvas className="absolute inset-0 h-full w-full" />
      {/* legibility: gentle center darken behind the headline */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(72%_58%_at_50%_48%,transparent_0%,oklch(0.08_0_0/0.5)_100%)]" />
      {/* blend: melt the bottom of the nebula into the page background */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col px-6">
        {/* nav */}
        <nav className="flex items-center justify-between py-5">
          <span className="font-display text-sm font-bold tracking-[0.2em]">CONSILIUM</span>
        </nav>

        {/* centerpiece */}
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <h1
            className="rise-in max-w-5xl text-balance font-display text-4xl font-bold leading-[0.96] tracking-[-0.03em] sm:text-6xl lg:text-8xl sm:leading-[0.92]"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="text-shimmer">Liquidation risk,</span>
            <br />
            priced by adversarial agents.
          </h1>

          <p
            className="rise-in mt-7 max-w-2xl text-base leading-relaxed text-foreground/65 sm:text-lg"
            style={{ animationDelay: "0.2s" }}
          >
            Two agents stake USDC on whether a live Aave position gets liquidated, and the pot split is the price.
          </p>

          <div className="rise-in mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.3s" }}>
            <Link
              href="/market"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              <span className="aura absolute -inset-2 -z-10 rounded-full bg-white/40 blur-xl" />
              Enter Market
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
