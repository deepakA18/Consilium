/**
 * Feed smoke (CONSOLIUM_BUILD.MD §4, §11 step 3).
 *
 * Proves the market's RESOLUTION inputs are live on the demo chain: the Chainlink ETH/USD feed
 * (the price the contract reads in `_readPrice`) and the L2 sequencer-uptime feed config (skipped
 * via address(0) on Base Sepolia, enforced on Base mainnet). Mirrors the contract's freshness
 * guard (price > 0, age ≤ 24h). No funds needed.
 *
 *   bun run feed:smoke
 */
import { ethPrice } from "../rpc.ts";
import { env, requireEnv } from "@consilium/shared";

requireEnv(["PRICE_FEED_ADDRESS"]);

const MAX_PRICE_DELAY = 24 * 3600; // matches ConsiliumMarket.MAX_PRICE_DELAY
const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

console.log("Feed smoke — Chainlink resolution inputs on the demo chain\n");
console.log(`price feed : ${env.PRICE_FEED_ADDRESS}`);
console.log(`demo RPC   : ${env.DEMO_CHAIN_RPC_URL}`);
console.log(
  `sequencer  : ${env.SEQUENCER_UPTIME_FEED ?? "(none — guard skipped via address(0), Base Sepolia has no feed)"}\n`,
);

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const { price, updatedAt } = await ethPrice();
// `bun` has no Date.now restriction at runtime; use it only for human-readable age display.
const ageSec = Math.floor(Date.now() / 1000) - updatedAt;

console.log(`ETH/USD = ${usd(price)}   updatedAt ${new Date(updatedAt * 1000).toISOString()} (${ageSec}s ago)\n`);

check("feed price is positive (contract: StalePrice if ≤ 0)", price > 0, usd(price));
check(`feed is fresh (≤ ${MAX_PRICE_DELAY}s)`, ageSec <= MAX_PRICE_DELAY, `${ageSec}s old`);

if (failures > 0) {
  console.error(`\n${failures} feed check(s) failed.`);
  process.exit(1);
}
console.log("\nResolution feed live ✓  — the contract can read a fresh price to resolve against");
