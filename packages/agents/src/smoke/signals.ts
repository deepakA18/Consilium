/**
 * Signals smoke (CONSOLIUM_BUILD.MD §7.2, §11 step 3).
 *
 * Reads all three sold risk signals about position P live — the same functions the x402 seller
 * vends. Every number here is a real onchain read (Aave v3 on mainnet + the Chainlink ETH/USD feed
 * the market resolves against + the deepest ETH/USD pool). No funds needed.
 *
 *   bun run signals:smoke
 */
import { aaveAccountData, priceHeadroom, dexDepth, ethPrice } from "../rpc.ts";
import { env, requireEnv } from "@consilium/shared";

requireEnv(["POSITION_ADDRESS", "AAVE_POOL_ADDRESS", "PRICE_FEED_ADDRESS"]);

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

console.log("Signals smoke — real onchain risk signals for position P\n");
console.log(`position   : ${env.POSITION_ADDRESS}`);
console.log(`aave pool  : ${env.AAVE_POOL_ADDRESS}  (signal RPC: ${env.SIGNAL_RPC_URL})`);
console.log(`price feed : ${env.PRICE_FEED_ADDRESS}  (demo RPC: ${env.DEMO_CHAIN_RPC_URL})\n`);

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// (a) health
const health = await aaveAccountData();
console.log("\n[health $0.02] Aave v3 account data");
console.log(`   healthFactor = ${health.healthFactor.toFixed(4)}`);
console.log(`   collateral   = ${usd(health.collateralUsd)}   debt = ${usd(health.debtUsd)}`);
console.log(`   liqThreshold = ${health.liqThresholdPct}%   ltv = ${health.ltvPct}%`);
check("health factor is positive", health.healthFactor > 0, health.healthFactor.toFixed(4));
check("position carries collateral", health.collateralUsd > 0, usd(health.collateralUsd));

// price feed
const p = await ethPrice();
console.log(`\n[feed] ETH/USD = ${usd(p.price)}  (updatedAt ${new Date(p.updatedAt * 1000).toISOString()})`);
check("feed price is positive", p.price > 0, usd(p.price));

// (b) headroom
const hr = await priceHeadroom();
console.log("\n[headroom $0.05] price-to-liquidation");
console.log(`   liquidationPrice = ${usd(hr.liquidationPrice)}`);
console.log(`   headroom         = ${hr.headroomPct.toFixed(2)}%  (collateral must fall this far)`);
check("liquidation price below current", hr.liquidationPrice < hr.currentEthPrice, `${usd(hr.liquidationPrice)} < ${usd(hr.currentEthPrice)}`);

// (c) liquidity
const liq = await dexDepth();
console.log("\n[liquidity $0.10] exit depth");
console.log(`   pool = ${liq.pool}`);
console.log(`   ${liq.wethDepth.toFixed(2)} WETH  +  ${usd(liq.usdcDepth)} USDC`);
check("pool has WETH depth", liq.wethDepth > 0, `${liq.wethDepth.toFixed(2)} WETH`);

if (failures > 0) {
  console.error(`\n${failures} signal check(s) failed.`);
  process.exit(1);
}
console.log("\nSignals live ✓  — every figure is a real onchain read");
