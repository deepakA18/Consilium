/**
 * Round view-model for the command center. Seeded with REAL data from a live Base Sepolia solvency
 * round (market 0x0854…a864) so every tx link resolves on Basescan. In phase (B) this is replaced
 * by the live RoundEvent stream (SSE) + the 1Shot webhook. Types are local so the client bundle
 * never pulls the server-side shared env.
 *
 * The question: will real Aave position P's collateral (ETH) cross its liquidation level within the
 * window? YES = LIQUIDATABLE, NO = SAFE. Resolved trustlessly from a Chainlink feed (§4).
 */

export type Side = "YES" | "NO";
export type AgentRole = "bull" | "bear";
export type EventStatus = "ok" | "pending" | "reverted" | "info";
export type SignalTier = "health" | "headroom" | "liquidity";

/** YES = LIQUIDATABLE, NO = SAFE — the human-facing labels for each side. */
export const SIDE_LABEL: Record<Side, string> = { YES: "LIQUIDATABLE", NO: "SAFE" };

export interface EvidenceBuyVM {
  tier: SignalTier;
  priceUsdc: number;
  summary: string; // short human read of the bought signal
  txHash: string;
}

export interface AgentDeskVM {
  role: AgentRole;
  label: string;
  address: string;
  side: Side;
  capUsdc: number;
  /** Signal tiers this agent bought (the costly-signal trail). */
  buys: EvidenceBuyVM[];
  thesis: string;
  /** 0–100; the costly signal — stake/cap. */
  confidence: number;
  stakeUsdc: number;
  stakeTx: string;
}

export interface TimelineEventVM {
  time: string; // HH:MM:SS
  actor: string;
  text: string;
  amountUsdc?: number;
  status: EventStatus;
  txHash?: string;
}

export interface RoundVM {
  roundId: string;
  market: string;
  factory: string;
  question: {
    position: string;
    collateral: string;
    collateralSymbol: string;
    currentPriceUsd: number; // live feed price at open
    strikePriceUsd: number; // market liquidation strike (what resolves)
    realLiquidationPriceUsd: number; // P's TRUE liquidation price (the real risk)
    healthFactor: number;
    headroomPct: number;
    deadlineLabel: string;
  };
  /** parimutuel implied probabilities from the pot (YES total / pot) — the PUBLISHED probability. */
  yesPct: number;
  noPct: number;
  state: "live" | "resolved";
  agents: AgentDeskVM[];
  timeline: TimelineEventVM[];
  evidence: { tiers: { tier: SignalTier; label: string; priceUsdc: number }[]; requests: number; revenueUsdc: number; researchAddress: string };
  reject: {
    attemptedUsdc: number;
    allowedUsdc: number;
    enforcer: string;
    reason: string;
    txHash: string;
  };
  resolution: {
    observedPriceUsd: number;
    strikePriceUsd: number;
    outcome: Side;
    txHash: string;
    pnl: { role: AgentRole; label: string; deltaUsdc: number; claimTx?: string }[];
  };
}

const BULL_HEALTH_TX = "0x9c61bde71cb2003906f52b7d1064d87e5f627ff7b1c3b2447a6949795fcca9d6";
const BULL_HEADROOM_TX = "0xa8516ba958ff32bd9166526df6e7ffbd299bf992e9e74d8a0c1e8d29f7890d3c";
const BULL_LIQUIDITY_TX = "0xd03852f6512677727b6c3e6a11612f645225d6f868f9bad234e5ad5074c8da02";
const BEAR_HEALTH_TX = "0x3221b787c899ec149dc6f4dbb9113ef7107cc1893b7ec1c23f3902b531bf469e";
const BEAR_HEADROOM_TX = "0x1a8359711501ab74520941f70027e8615453a415a1bc034323f005a4cf51f411";
const BEAR_LIQUIDITY_TX = "0x9fc09e67c6bc733b20c110d3854ee1e73432b88e0a2dd438487497989e15125b";
const BULL_STAKE_TX = "0x9e4276ce1b3cfae947e63542ebd72953f8a33b33742c1b73823775bd52fa00da";
const BEAR_STAKE_TX = "0x5693e0b7e531ff014b5a9f6345e67999da4f06e5ac66817039310eea95e682b3";
const POKE_TX = "0x3ce717526d7f508e039a72383197098711f3aacb284f2d900eab614ca78b81c8";
const RESOLVE_TX = "0xe0884c3124d697430a766b8c5bd2afa9a40dafc779d99c6d9de05acb70d1c2e6";
const CLAIM_TX = "0xd7187204691a99c39349344d6c7d46db6545755d8236eb2be9803b1d7512474e";

export const DEMO_ROUND: RoundVM = {
  roundId: "0x0854786C4B0EbE3e91562333FEe08ab86029a864",
  market: "0x0854786C4B0EbE3e91562333FEe08ab86029a864",
  factory: "0xE3A30B3DCD1B46b58968bf9Ba2c2c9cDd8E50E4a",
  question: {
    position: "0x32A7DEaEb6CA5bd8Cc44cB577CeE1e3C3a4292D5",
    collateral: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    collateralSymbol: "ETH",
    currentPriceUsd: 1676.08,
    strikePriceUsd: 1679.43,
    realLiquidationPriceUsd: 1244.1,
    healthFactor: 1.3472,
    headroomPct: 25.77,
    deadlineLabel: "2-min demo window",
  },
  yesPct: 55, // YES 18 / pot 33
  noPct: 45, // NO 15 / pot 33
  state: "resolved",
  agents: [
    {
      role: "bull",
      label: "BULL AGENT",
      address: "0x56cf2608ad3c863A60e67470876aE365c2341369",
      side: "YES",
      capUsdc: 20,
      buys: [
        { tier: "health", priceUsdc: 0.02, summary: "HF 1.347 · col $13.81M / debt $8.51M", txHash: BULL_HEALTH_TX },
        { tier: "headroom", priceUsdc: 0.05, summary: "liq $1,244 · headroom 25.8%", txHash: BULL_HEADROOM_TX },
        { tier: "liquidity", priceUsdc: 0.1, summary: "38,674 WETH / $21.2M USDC depth", txHash: BULL_LIQUIDITY_TX },
      ],
      thesis: "Live ETH $1,676.08 is already below the liquidation strike $1,679.43. Price has breached, liquidatable now.",
      confidence: 90, // 18 / 20
      stakeUsdc: 18,
      stakeTx: BULL_STAKE_TX,
    },
    {
      role: "bear",
      label: "BEAR AGENT",
      address: "0x9cbB1E770b189C6CBeE32FCA40Ceb46ba6a214AF",
      side: "NO",
      capUsdc: 20,
      buys: [
        { tier: "health", priceUsdc: 0.02, summary: "HF 1.347 · col $13.81M / debt $8.51M", txHash: BEAR_HEALTH_TX },
        { tier: "headroom", priceUsdc: 0.05, summary: "liq $1,244 · headroom 25.8%", txHash: BEAR_HEADROOM_TX },
        { tier: "liquidity", priceUsdc: 0.1, summary: "38,674 WETH / $21.2M USDC depth", txHash: BEAR_LIQUIDITY_TX },
      ],
      thesis: "HF 1.347 is strong and the true liq price is $1,244, a 25.8% drop away. Deep exit liquidity. Position is safe.",
      confidence: 75, // 15 / 20
      stakeUsdc: 15,
      stakeTx: BEAR_STAKE_TX,
    },
  ],
  timeline: [
    { time: "10:53:51", actor: "Fund Manager", text: "redelegated 20 USDC → Bull", amountUsdc: 20, status: "info" },
    { time: "10:53:53", actor: "Fund Manager", text: "redelegated 20 USDC → Bear", amountUsdc: 20, status: "info" },
    { time: "10:54:02", actor: "Bull", text: "bought health signal (x402)", amountUsdc: 0.02, status: "ok", txHash: BULL_HEALTH_TX },
    { time: "10:54:09", actor: "Bull", text: "bought headroom signal (x402)", amountUsdc: 0.05, status: "ok", txHash: BULL_HEADROOM_TX },
    { time: "10:54:16", actor: "Bull", text: "bought liquidity signal (x402)", amountUsdc: 0.1, status: "ok", txHash: BULL_LIQUIDITY_TX },
    { time: "10:54:31", actor: "Bull", text: "staked LIQUIDATABLE (YES)", amountUsdc: 18, status: "ok", txHash: BULL_STAKE_TX },
    { time: "10:54:44", actor: "Bear", text: "bought health signal (x402)", amountUsdc: 0.02, status: "ok", txHash: BEAR_HEALTH_TX },
    { time: "10:54:51", actor: "Bear", text: "bought headroom signal (x402)", amountUsdc: 0.05, status: "ok", txHash: BEAR_HEADROOM_TX },
    { time: "10:54:58", actor: "Bear", text: "bought liquidity signal (x402)", amountUsdc: 0.1, status: "ok", txHash: BEAR_LIQUIDITY_TX },
    { time: "10:55:12", actor: "Bear", text: "staked SAFE (NO)", amountUsdc: 15, status: "ok", txHash: BEAR_STAKE_TX },
    { time: "10:55:30", actor: "Anyone", text: "poke · ETH $1,676.08 ≤ strike $1,679.43, crossed", status: "ok", txHash: POKE_TX },
    { time: "10:55:48", actor: "Anyone", text: "resolved · price crossed liquidation level, LIQUIDATABLE", status: "ok", txHash: RESOLVE_TX },
    { time: "10:56:03", actor: "Bull", text: "claimed winnings", amountUsdc: 33, status: "ok", txHash: CLAIM_TX },
  ],
  evidence: {
    tiers: [
      { tier: "health", label: "Health factor", priceUsdc: 0.02 },
      { tier: "headroom", label: "Price headroom", priceUsdc: 0.05 },
      { tier: "liquidity", label: "Exit liquidity", priceUsdc: 0.1 },
    ],
    requests: 6,
    revenueUsdc: 0.34,
    researchAddress: "0x27Bf0985E2c572cCb926ccC951426aCA562122B7",
  },
  reject: {
    attemptedUsdc: 10,
    allowedUsdc: 5,
    enforcer: "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3",
    reason: "ERC20TransferAmountEnforcer:allowance-exceeded",
    txHash: "0xe7c09b291b0d47f74ef3cb6bcad635f9e048e226568109abfaf11392b42f8511",
  },
  resolution: {
    observedPriceUsd: 1676.08,
    strikePriceUsd: 1679.43,
    outcome: "YES",
    txHash: RESOLVE_TX,
    pnl: [
      { role: "bull", label: "Bull", deltaUsdc: 15, claimTx: CLAIM_TX }, // claimed 33, staked 18 → +15
      { role: "bear", label: "Bear", deltaUsdc: -15 },
    ],
  },
};
