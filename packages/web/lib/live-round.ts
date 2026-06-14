import { DEMO_ROUND, type RoundVM, type AgentDeskVM, type TimelineEventVM, type Side, type SignalTier } from "./round-data";

/**
 * Reduces the live RoundEvent stream (from the agents event hub) into the dashboard's RoundVM.
 * Fixed facts that aren't carried in events — the agents' smart-account addresses, the research
 * seller address, and the (separate) over-cap revert tx — are taken from the seeded round, since the
 * keys/contracts are constant across rounds. Everything else is live.
 */

/** Local mirror of @consilium/shared RoundEvent (kept here so the client bundle stays env-free). */
export type LiveEvent =
  | { kind: "round:start"; roundId: string; market: string; factory: string; question: LiveQuestion; ts: number }
  | { kind: "delegation:granted"; from: string; to: string; capUsdc: string; authorityChained: boolean; ts: number }
  | { kind: "evidence:purchased"; agent: string; tier: string; priceUsdc: string; summary: string; cumulativeUsdc: string; txHash?: string; ts: number }
  | { kind: "agent:decision"; agent: string; stance: Side; sizeUsdc: string; rationale: string; ts: number }
  | { kind: "stake:submitted"; agent: string; side: Side; amountUsdc: string; taskId: string; ts: number }
  | { kind: "stake:confirmed"; agent: string; side: Side; amountUsdc: string; txHash: string; ts: number }
  | { kind: "stake:reverted"; agent: string; reason: string; ts: number }
  | { kind: "price:poked"; priceUsd: string; crossed: boolean; txHash: string; ts: number }
  | { kind: "resolved"; outcome: Side; observedPriceUsd: string; strikePriceUsd: string; txHash: string; ts: number }
  | { kind: "claimed"; agent: string; amountUsdc: string; txHash: string; ts: number }
  | { kind: "round:end"; roundId: string; ts: number };

interface LiveQuestion {
  position: string;
  collateral: string;
  currentPriceUsd: string;
  strikePriceUsd: string;
  realLiquidationPriceUsd: string;
  healthFactor: string;
  headroomPct: string;
  direction: "DOWN" | "UP";
  deadlineUnix: number;
}

const ACTOR: Record<string, string> = { bull: "Bull", bear: "Bear", fundManager: "Fund Manager", research: "Research", human: "Human" };
const actorName = (r: string) => ACTOR[r] ?? r;
const sideWord = (s: Side) => (s === "YES" ? "LIQUIDATABLE" : "SAFE");
// HH:MM:SS for events from today; prefixed with the date otherwise, so a replayed last round from a
// previous day reads as old instead of looking like it just happened.
const hhmmss = (ts: number) => {
  const d = new Date(ts * 1000);
  const now = new Date();
  const time = d.toLocaleTimeString("en-GB", { hour12: false });
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? time : `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${time}`;
};

function blankAgent(role: "bull" | "bear", side: Side, addr: string): AgentDeskVM {
  return { role, label: `${role.toUpperCase()} AGENT`, address: addr, side, capUsdc: 0, buys: [], thesis: "", confidence: 0, stakeUsdc: 0, stakeTx: "" };
}

export function eventsToRoundVM(events: LiveEvent[]): RoundVM | null {
  const start = events.find((e): e is Extract<LiveEvent, { kind: "round:start" }> => e.kind === "round:start");
  if (!start) return null;

  const bullBase = DEMO_ROUND.agents.find((a) => a.role === "bull")!;
  const bearBase = DEMO_ROUND.agents.find((a) => a.role === "bear")!;
  const agents = {
    bull: blankAgent("bull", "YES", bullBase.address),
    bear: blankAgent("bear", "NO", bearBase.address),
  };
  const isTrader = (a: string): a is "bull" | "bear" => a === "bull" || a === "bear";

  const q = start.question;
  const timeline: TimelineEventVM[] = [];
  const stakeRow: Record<string, number> = {}; // agent → timeline index of its stake row
  const claimTx: Record<string, string> = {};
  let state: "live" | "resolved" = "live";
  let evidenceRequests = 0;
  let evidenceRevenue = 0;
  const resolution = { observedPriceUsd: 0, strikePriceUsd: Number(q.strikePriceUsd), outcome: "YES" as Side, txHash: "" };

  for (const e of events) {
    switch (e.kind) {
      case "delegation:granted":
        if (isTrader(e.to)) agents[e.to].capUsdc = Number(e.capUsdc);
        timeline.push({ time: hhmmss(e.ts), actor: "Fund Manager", text: `redelegated ${e.capUsdc} USDC → ${actorName(e.to)}`, amountUsdc: Number(e.capUsdc), status: "info" });
        break;
      case "evidence:purchased":
        if (isTrader(e.agent)) agents[e.agent].buys.push({ tier: e.tier as SignalTier, priceUsdc: Number(e.priceUsdc), summary: e.summary, txHash: e.txHash ?? "" });
        evidenceRequests += 1;
        evidenceRevenue += Number(e.priceUsdc);
        timeline.push({ time: hhmmss(e.ts), actor: actorName(e.agent), text: `bought ${e.tier} signal (x402)`, amountUsdc: Number(e.priceUsdc), status: "ok", txHash: e.txHash });
        break;
      case "agent:decision":
        if (isTrader(e.agent)) agents[e.agent].thesis = e.rationale;
        break;
      case "stake:submitted":
        if (isTrader(e.agent)) agents[e.agent].stakeUsdc = Number(e.amountUsdc);
        stakeRow[e.agent] = timeline.push({ time: hhmmss(e.ts), actor: actorName(e.agent), text: `staked ${sideWord(e.side)} (${e.side})`, amountUsdc: Number(e.amountUsdc), status: "pending" }) - 1;
        break;
      case "stake:confirmed":
        if (isTrader(e.agent)) {
          agents[e.agent].stakeUsdc = Number(e.amountUsdc);
          agents[e.agent].stakeTx = e.txHash;
        }
        if (stakeRow[e.agent] != null) {
          timeline[stakeRow[e.agent]].status = "ok";
          timeline[stakeRow[e.agent]].txHash = e.txHash;
        }
        break;
      case "stake:reverted":
        timeline.push({ time: hhmmss(e.ts), actor: actorName(e.agent), text: `stake reverted, ${e.reason}`, status: "reverted" });
        break;
      case "price:poked":
        timeline.push({ time: hhmmss(e.ts), actor: "Anyone", text: `poke · ETH $${e.priceUsd}${e.crossed ? ", crossed" : ""}`, status: "ok", txHash: e.txHash });
        break;
      case "resolved":
        state = "resolved";
        resolution.observedPriceUsd = Number(e.observedPriceUsd);
        resolution.strikePriceUsd = Number(e.strikePriceUsd);
        resolution.outcome = e.outcome;
        resolution.txHash = e.txHash;
        timeline.push({ time: hhmmss(e.ts), actor: "Anyone", text: `resolved · ${sideWord(e.outcome)}`, status: "ok", txHash: e.txHash });
        break;
      case "claimed":
        claimTx[e.agent] = e.txHash;
        timeline.push({ time: hhmmss(e.ts), actor: actorName(e.agent), text: "claimed winnings", amountUsdc: Number(e.amountUsdc), status: "ok", txHash: e.txHash });
        break;
    }
  }

  for (const a of [agents.bull, agents.bear]) a.confidence = a.capUsdc > 0 ? Math.round((a.stakeUsdc / a.capUsdc) * 100) : 0;

  const pot = agents.bull.stakeUsdc + agents.bear.stakeUsdc;
  const yesPct = pot > 0 ? Math.round((agents.bull.stakeUsdc / pot) * 100) : 50;

  const pnl =
    state === "resolved"
      ? (["bull", "bear"] as const).map((role) => {
          const winnerIsBull = resolution.outcome === "YES";
          const won = (role === "bull") === winnerIsBull;
          const delta = won ? agents[role === "bull" ? "bear" : "bull"].stakeUsdc : -agents[role].stakeUsdc;
          return { role, label: role === "bull" ? "Bull" : "Bear", deltaUsdc: delta, claimTx: claimTx[role] };
        })
      : [];

  return {
    roundId: start.roundId,
    market: start.market,
    factory: start.factory,
    question: {
      position: q.position,
      collateral: q.collateral,
      collateralSymbol: "ETH",
      currentPriceUsd: Number(q.currentPriceUsd),
      strikePriceUsd: Number(q.strikePriceUsd),
      realLiquidationPriceUsd: Number(q.realLiquidationPriceUsd),
      healthFactor: Number(q.healthFactor),
      headroomPct: Number(q.headroomPct),
      deadlineLabel: "live window",
    },
    yesPct,
    noPct: 100 - yesPct,
    state,
    agents: [agents.bull, agents.bear],
    timeline,
    evidence: {
      tiers: DEMO_ROUND.evidence.tiers,
      requests: evidenceRequests,
      revenueUsdc: Number(evidenceRevenue.toFixed(2)),
      researchAddress: DEMO_ROUND.evidence.researchAddress,
    },
    reject: DEMO_ROUND.reject,
    resolution: { ...resolution, pnl },
  };
}
