/**
 * Upgrade each funded EOA in place to a MetaMask 7702 smart account (CONSOLIUM_BUILD.MD §5.1).
 * Self-sponsored (each EOA pays its own gas). Idempotent. Required before any ERC-7710 redemption
 * or x402 payment. Skips roles with no key set.
 *
 *   bun run accounts:upgrade
 */
import { env, txUrl } from "@consilium/shared";
import { upgradeTo7702, delegatorImplementation } from "../smartAccount.ts";

const roles: [string, string | undefined][] = [
  ["deployer/human", env.DEPLOYER_PRIVATE_KEY],
  ["fundManager", env.FUND_MANAGER_PRIVATE_KEY],
  ["bull", env.BULL_PRIVATE_KEY],
  ["bear", env.BEAR_PRIVATE_KEY],
  ["research", env.RESEARCH_PRIVATE_KEY],
];

console.log(`Upgrading EOAs to 7702 delegator ${delegatorImplementation()}\n`);

let failures = 0;
for (const [name, pk] of roles) {
  if (!pk) {
    console.log(`${name.padEnd(15)} (key unset — skipped)`);
    continue;
  }
  try {
    const r = await upgradeTo7702(pk as `0x${string}`);
    if (r.alreadyUpgraded) {
      console.log(`${name.padEnd(15)} ${r.address}  already upgraded ✓`);
    } else {
      console.log(`${name.padEnd(15)} ${r.address}  upgraded ✓  ${r.txHash}`);
      console.log(`${"".padEnd(15)} ${txUrl(r.txHash!)}`);
    }
  } catch (err) {
    failures++;
    console.log(`${name.padEnd(15)} ✗ ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} upgrade(s) failed.`);
  process.exit(1);
}
console.log("\nAll accounts upgraded ✓  (run `bun run keys:status` to confirm)");
