import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/landing/Hero";
import { FeatureBento } from "@/components/landing/Bento";
import { NebulaCanvas } from "@/components/visual/NebulaCanvas";

export default function Home() {
  return (
    <main>
      <Hero />

      <div className="mx-auto max-w-6xl px-6">
        <FeatureBento />
      </div>

      {/* final CTA — full-bleed, with a nebula dome rising from the page floor (echoes the hero) */}
      <section className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[150%] [-webkit-mask-image:radial-gradient(62%_60%_at_50%_100%,#000_18%,transparent_72%)] [mask-image:radial-gradient(62%_60%_at_50%_100%,#000_18%,transparent_72%)]">
          <NebulaCanvas edgeFade={false} className="absolute inset-0 h-full w-full opacity-[0.45]" />
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="py-28 text-center">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              One human signature → a bounded, adversarial, multi-agent risk oracle.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
              Watch two agents reason, bid, and settle a live market against each other.
            </p>
            <Link
              href="/market"
              className="group relative mt-8 inline-flex items-center gap-2 overflow-hidden rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              <span className="aura absolute -inset-2 -z-10 rounded-full bg-white/30 blur-xl" />
              Enter Market
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <footer className="border-t border-border py-6 text-[11px] text-muted-foreground">
            Consilium · every figure ↗ resolves to an onchain transaction
          </footer>
        </div>
      </section>
    </main>
  );
}
