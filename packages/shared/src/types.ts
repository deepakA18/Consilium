/**
 * Shared types for round events consumed by the web dashboard.
 *
 * Every event that drives a UI figure carries a real tx hash / task id — there is no event for
 * "fake" or "predicted" state (CONSOLIUM_BUILD.MD §13).
 */

export type Side = "YES" | "NO";

export type AgentRole = "fundManager" | "bull" | "bear" | "research";

/** Terminal/non-terminal status as reported by the 1Shot relayer. */
export type RelayStatus = "Pending" | "Submitted" | "Confirmed" | "Rejected" | "Reverted";

/** The market question: will position P's collateral price cross its liquidation level by the deadline? */
export interface RoundQuestion {
  position: string; // mainnet Aave borrower P
  collateral: string; // P's collateral asset (its price triggers liquidation)
  currentPriceUsd: string; // live feed price at round start
  strikePriceUsd: string; // the market's liquidation strike (what the contract resolves against)
  realLiquidationPriceUsd: string; // P's TRUE liquidation price (display — the real risk)
  healthFactor: string; // P's live Aave health factor
  headroomPct: string; // % the collateral must fall for P to be liquidatable
  direction: "DOWN" | "UP"; // DOWN: YES when price ≤ strike
  deadlineUnix: number;
}

/** Discriminated union of everything the round emits. `kind` is the discriminator. */
export type RoundEvent =
  | { kind: "round:start"; roundId: string; market: string; factory: string; question: RoundQuestion; ts: number }
  | { kind: "delegation:granted"; from: AgentRole; to: AgentRole; capUsdc: string; authorityChained: boolean; ts: number }
  | { kind: "evidence:purchased"; agent: AgentRole; tier: string; priceUsdc: string; summary: string; cumulativeUsdc: string; txHash?: string; ts: number }
  | { kind: "agent:decision"; agent: AgentRole; stance: Side; sizeUsdc: string; rationale: string; ts: number }
  | { kind: "stake:submitted"; agent: AgentRole; side: Side; amountUsdc: string; taskId: string; ts: number }
  | { kind: "stake:confirmed"; agent: AgentRole; side: Side; amountUsdc: string; txHash: string; ts: number }
  | { kind: "stake:reverted"; agent: AgentRole; reason: string; ts: number }
  | { kind: "price:poked"; priceUsd: string; crossed: boolean; txHash: string; ts: number }
  | { kind: "resolved"; outcome: Side; observedPriceUsd: string; strikePriceUsd: string; txHash: string; ts: number }
  | { kind: "claimed"; agent: AgentRole; amountUsdc: string; txHash: string; ts: number }
  | { kind: "round:end"; roundId: string; ts: number };

export type RoundEventHandler = (event: RoundEvent) => void;
