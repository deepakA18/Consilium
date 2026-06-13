import { ArrowUpRight } from "lucide-react";
import { txUrl, addressUrl } from "@/lib/explorer";
import { SIDE_LABEL, type RoundVM } from "@/lib/round-data";

/** The headline metric — the one black card (iBanKo "My Card"). Always dark, so colors are explicit
 *  (light text + bright signal greens/reds) rather than theme tokens. */
const GREEN = "oklch(0.78 0.16 155)";
const RED = "oklch(0.7 0.19 22)";

const SEGMENTS = 28;

/** Proportional segmented meter — pips fill green up to yesPct, the rest red. */
function SegmentMeter({ yesPct }: { yesPct: number }) {
  const green = Math.round((yesPct / 100) * SEGMENTS);
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: SEGMENTS }).map((_, i) => (
        <span
          key={i}
          className="h-5 flex-1 rounded-[2px]"
          style={{ background: i < green ? GREEN : RED, opacity: i < green ? 1 : 0.45 }}
        />
      ))}
    </div>
  );
}

export function ProbabilityHero({ round }: { round: RoundVM }) {
  const { yesPct, noPct } = round;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[radial-gradient(130%_150%_at_85%_-30%,oklch(0.24_0_0)_0%,oklch(0.11_0_0)_60%)] p-8 text-white shadow-[0_20px_50px_-24px_oklch(0_0_0/0.6)]">
      <div className="relative flex items-start justify-between">
        <div className="text-[13px] font-medium text-white/55">Published probability</div>
        <svg viewBox="0 0 80 28" className="h-7 w-20">
          <polyline points="0,20 12,16 24,18 36,10 48,13 60,6 72,9 80,4" fill="none" stroke={GREEN} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-4">
        <div className="flex items-end gap-3">
          <div className="text-5xl font-bold tabular-nums leading-none tracking-tight" style={{ color: GREEN }}>
            {yesPct}%
          </div>
          <div className="mb-1">
            <div className="text-xs font-semibold" style={{ color: GREEN }}>{SIDE_LABEL.YES}</div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2.5">
          <a
            href={txUrl(round.resolution.txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            Resolve tx <ArrowUpRight className="size-3.5" />
          </a>
          <a
            href={addressUrl(round.market)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/10"
          >
            Market <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>

      <div className="relative mt-7">
        <div className="mb-2 flex justify-between text-[11px] text-white/45">
          <span>{SIDE_LABEL.YES}</span>
          <span>{SIDE_LABEL.NO}</span>
        </div>
        <SegmentMeter yesPct={yesPct} />
        <div className="mt-2 flex justify-between text-[11px]">
          <span style={{ color: GREEN }}>{yesPct}%</span>
          <span style={{ color: RED }}>{noPct}%</span>
        </div>
      </div>
    </section>
  );
}
