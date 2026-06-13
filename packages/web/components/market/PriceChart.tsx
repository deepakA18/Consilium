"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown } from "lucide-react";
import { TxLink } from "@/components/ui/bits";
import type { RoundVM } from "@/lib/round-data";

const usd2 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Illustrative price walk across the window; the strike + observed close are the real figures.
const DATA = [
  { t: "stakes", price: 1682.4 },
  { t: "", price: 1681.6 },
  { t: "10:55", price: 1680.7 },
  { t: "", price: 1680.1 },
  { t: "poke", price: 1679.2 },
  { t: "", price: 1678.0 },
  { t: "10:55:30", price: 1677.0 },
  { t: "resolved", price: 1676.08 },
];

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { t: string; price: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-lg">
      <div className="text-xs font-medium">{usd2(p.price)}</div>
      {p.t && <div className="text-[10px] text-muted-foreground">{p.t}</div>}
    </div>
  );
}

/** Price vs liquidation (shadcn-style recharts area chart). */
export function PriceChart({ round }: { round: RoundVM }) {
  const res = round.resolution;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <section className="card-soft p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Price vs liquidation</h3>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-[2px] w-3.5 rounded-full bg-foreground/70" /> ETH price
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-no">
            <span className="w-3.5 border-t border-dashed border-no" /> strike
          </span>
          <span className="pill-soft">
            This round <ChevronDown className="size-3" />
          </span>
        </div>
      </div>

      <div className="mt-5 h-56">
        {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={DATA} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.2 0 0)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="oklch(0.2 0 0)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="oklch(0.91 0 0)" />
            <XAxis dataKey="t" tickLine={false} axisLine={false} dy={8} tick={{ fill: "oklch(0.55 0 0)", fontSize: 10, fontFamily: "var(--font-sans)" }} interval={0} />
            <YAxis
              domain={[1672, 1684]}
              ticks={[1674, 1678, 1682]}
              tickLine={false}
              axisLine={false}
              width={42}
              tick={{ fill: "oklch(0.55 0 0)", fontSize: 10, fontFamily: "var(--font-sans)" }}
              tickFormatter={(v) => `$${v}`}
            />
            <ReferenceLine y={res.strikePriceUsd} stroke="oklch(0.6 0.2 22)" strokeDasharray="5 5" strokeOpacity={0.8} />
            <Tooltip cursor={{ stroke: "oklch(0.75 0 0)", strokeDasharray: "3 3" }} content={<ChartTooltip />} />
            <Area type="monotone" dataKey="price" stroke="oklch(0.2 0 0)" strokeWidth={2} fill="url(#priceFill)" dot={false} activeDot={{ r: 3, fill: "oklch(0.2 0 0)" }} />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between text-[13px] text-muted-foreground">
        <span>
          Observed <span className="text-foreground">{usd2(res.observedPriceUsd)}</span> ≤ strike{" "}
          <span className="text-no">{usd2(res.strikePriceUsd)}</span>
        </span>
        <TxLink hash={res.txHash} label="resolve tx" />
      </div>
    </section>
  );
}
