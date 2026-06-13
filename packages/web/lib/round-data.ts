/**
 * Round view-model for the command center. Seeded with REAL data from a live Base Sepolia round
 * (round 0x6215…1AE2) so every tx link resolves on Basescan. In phase (B) this is replaced by the
 * live RoundEvent stream (SSE) + the 1Shot webhook. Types are local so the client bundle never
 * pulls the server-side shared env.
 */

export type Side = "YES" | "NO";
export type AgentRole = "bull" | "bear";
export type EventStatus = "ok" | "pending" | "reverted" | "info";

export interface AgentDeskVM {
  role: AgentRole;
  label: string;
  address: string;
  side: Side;
  capUsdc: number;
  evidenceUsdc: number;
  buys: number;
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
  question: { watchedWallet: string; thresholdUsdc: number; deadlineLabel: string };
  /** parimutuel implied probabilities from the pot (YES total / pot). */
  yesPct: number;
  noPct: number;
  state: "live" | "resolved";
  agents: AgentDeskVM[];
  timeline: TimelineEventVM[];
  evidence: { priceUsdc: number; requests: number; revenueUsdc: number; researchAddress: string };
  reject: {
    attemptedUsdc: number;
    allowedUsdc: number;
    enforcer: string;
    reason: string;
    txHash: string;
  };
  resolution: {
    observedUsdc: number;
    thresholdUsdc: number;
    outcome: Side;
    txHash: string;
    pnl: { role: AgentRole; label: string; deltaUsdc: number; claimTx?: string }[];
  };
}

export const DEMO_ROUND: RoundVM = {
  roundId: "0x6215bBD4277B444Ff3E34350373a541D5F671AE2",
  market: "0x6215bBD4277B444Ff3E34350373a541D5F671AE2",
  factory: "0x37e77F0A4e5128956186b2a8bDeE9f6AA4c9eC12",
  question: {
    watchedWallet: "0x6B8b3d260dB69b9AE2e93a4f9f3F514a539cA79e",
    thresholdUsdc: 250,
    deadlineLabel: "15:30 UTC",
  },
  yesPct: 95, // YES 20 / pot 21
  noPct: 5,
  state: "resolved",
  agents: [
    {
      role: "bull",
      label: "BULL AGENT",
      address: "0x56cf2608ad3c863A60e67470876aE365c2341369",
      side: "YES",
      capUsdc: 20,
      evidenceUsdc: 0.05,
      buys: 1,
      thesis: "Wallet already holds 500 USDC — well above the 250 threshold.",
      confidence: 92,
      stakeUsdc: 20,
      stakeTx: "0xd8fb9ccd5684e836c4baa63f38acaf562df5a27f08c7ae4e98acf54fca3b3860",
    },
    {
      role: "bear",
      label: "BEAR AGENT",
      address: "0x9cbB1E770b189C6CBeE32FCA40Ceb46ba6a214AF",
      side: "NO",
      capUsdc: 20,
      evidenceUsdc: 0.05,
      buys: 1,
      thesis: "Threshold may not hold — but the read says otherwise. Low conviction.",
      confidence: 18,
      stakeUsdc: 1,
      stakeTx: "0xbafb80b4c5a58b4d9a605874b00907013952bfba917f5a57a2efbb37ae37f9dc",
    },
  ],
  timeline: [
    { time: "12:01:04", actor: "Fund Manager", text: "redelegated 20 USDC → Bull", amountUsdc: 20, status: "info" },
    { time: "12:01:06", actor: "Fund Manager", text: "redelegated 20 USDC → Bear", amountUsdc: 20, status: "info" },
    { time: "12:04:11", actor: "Bull", text: "bought balance read (x402)", amountUsdc: 0.05, status: "ok", txHash: "0x2a2da24ebd86b58bf9f4b939e396bc7668776c3f77dd89dc03e4ede7a98b4a4d" },
    { time: "12:04:33", actor: "Bull", text: "staked YES", amountUsdc: 20, status: "ok", txHash: "0xd8fb9ccd5684e836c4baa63f38acaf562df5a27f08c7ae4e98acf54fca3b3860" },
    { time: "12:07:02", actor: "Bear", text: "bought balance read (x402)", amountUsdc: 0.05, status: "ok", txHash: "0x7981b8ae23960a8f1176c55dcd960c0c2441815c24952ca3ee24315ab11ed3b1" },
    { time: "12:07:25", actor: "Bear", text: "staked NO", amountUsdc: 1, status: "ok", txHash: "0xbafb80b4c5a58b4d9a605874b00907013952bfba917f5a57a2efbb37ae37f9dc" },
    { time: "12:09:48", actor: "Bull", text: "attempted 10 USDC over its 5 USDC cap → REVERTED at enforcer", amountUsdc: 10, status: "reverted", txHash: "0xe7c09b291b0d47f74ef3cb6bcad635f9e048e226568109abfaf11392b42f8511" },
    { time: "12:14:00", actor: "Anyone", text: "resolved — observed 500 USDC ≥ 250 → YES", status: "ok", txHash: "0xfa48a29c600f451c82417082a0ae565b48b1b97232d0d52033ca8ee95fba2bb4" },
    { time: "12:14:18", actor: "Bull", text: "claimed winnings", amountUsdc: 21, status: "ok", txHash: "0x039f578e5164157bcccea6ab4844fe0a677fa40cad761b21294f6df6609c99cd" },
  ],
  evidence: {
    priceUsdc: 0.05,
    requests: 2,
    revenueUsdc: 0.1,
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
    observedUsdc: 500,
    thresholdUsdc: 250,
    outcome: "YES",
    txHash: "0xfa48a29c600f451c82417082a0ae565b48b1b97232d0d52033ca8ee95fba2bb4",
    pnl: [
      { role: "bull", label: "Bull", deltaUsdc: 1, claimTx: "0x039f578e5164157bcccea6ab4844fe0a677fa40cad761b21294f6df6609c99cd" },
      { role: "bear", label: "Bear", deltaUsdc: -1 },
    ],
  },
};
