/**
 * Over-cap revert smoke (CONSOLIUM_BUILD.MD §6.4, §11 step 8).
 * bull signs a 5-USDC-capped delegation; the redeemer tries to move 10 USDC → the
 * ERC20TransferAmount enforcer reverts on-chain. Captures the real failed-tx hash.
 *
 *   bun run demo:overcap
 */
import { formatUnits, type Address } from "viem";
import { requireEnv, txUrl, USDC_DECIMALS } from "@consilium/shared";
import { demoOverCapRevert } from "../overcap.ts";

const keys = requireEnv(["BULL_PRIVATE_KEY", "DEPLOYER_PRIVATE_KEY", "USDC_ADDRESS"]);
const market = (await Bun.file(`${import.meta.dir}/../../../contracts/deployments/84532.json`).json()).market as Address;

console.log("Over-cap revert — bull cap 5 USDC, redemption attempts 10 USDC into the market\n");

const r = await demoOverCapRevert({
  traderPk: keys.BULL_PRIVATE_KEY as `0x${string}`,
  redeemerPk: keys.DEPLOYER_PRIVATE_KEY as `0x${string}`,
  recipient: market,
  capWholeUsdc: 5,
  attemptWholeUsdc: 10,
});

console.log(`cap:      ${formatUnits(r.cap, USDC_DECIMALS)} USDC`);
console.log(`attempt:  ${formatUnits(r.attempt, USDC_DECIMALS)} USDC`);
console.log(`enforcer: ${r.delegationManager}`);
console.log(`revert reason (simulated): ${r.reason}`);
console.log(`failed tx: ${txUrl(r.txHash)}`);
console.log(`on-chain status reverted: ${r.reverted ? "✓" : "✗"}`);

if (!r.reverted) {
  console.error("\nEXPECTED a reverted tx — the over-cap redemption should fail at the enforcer.");
  process.exit(1);
}
console.log("\nTHE REVERT ✓ — the chain rejected the over-cap redemption at the ERC20TransferAmount enforcer.");
console.log("No app-code guard rejected this. The cap is structural.");
