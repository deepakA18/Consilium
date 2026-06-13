/**
 * Delegation smoke (CONSOLIUM_BUILD.MD §5.4, §11 step 4).
 *
 * Builds and signs the full 3-level A2A chain — Human → fund-manager → trader → executor — and
 * asserts (a) each child's cap ≤ its parent's (decoded from the signed delegations, not just the
 * values we passed in), and (b) each child is cryptographically chained to its parent via
 * `authority == hashDelegation(parent)`. Pure offline crypto: no deployment, no funds, no gas.
 *
 *   bun run delegation:smoke
 *
 * Uses configured keys when present (FUND_MANAGER/BULL/DEPLOYER private keys) and generates
 * ephemeral keys for anything unset, so it runs green immediately. The executor is always a
 * fresh per-round key.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { formatUnits, type Address } from "viem";
import { env, requireEnv, USDC_DECIMALS } from "@consilium/shared";
import { makeSmartAccount } from "../smartAccount.ts";
import { buildErc20Delegation, signDelegation, extractErc20MaxAmount, isChainedTo, usdc } from "../delegation.ts";

const { USDC_ADDRESS } = requireEnv(["USDC_ADDRESS"]);
const token = USDC_ADDRESS as Address;

const keyOrEphemeral = (k?: string) => (k ?? generatePrivateKey()) as `0x${string}`;
const fmt = (n: bigint) => `${formatUnits(n, USDC_DECIMALS)} USDC`;

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

console.log("Delegation smoke — 3-level chain Human → fund-manager → trader → executor\n");

// Actors. Human/manager/trader use configured keys if set; executor is always ephemeral.
const human = await makeSmartAccount(keyOrEphemeral(env.DEPLOYER_PRIVATE_KEY));
const manager = await makeSmartAccount(keyOrEphemeral(env.FUND_MANAGER_PRIVATE_KEY));
const trader = await makeSmartAccount(keyOrEphemeral(env.BULL_PRIVATE_KEY));
const executor = await makeSmartAccount(generatePrivateKey());

for (const [name, acct] of [
  ["human", human],
  ["manager", manager],
  ["trader(bull)", trader],
  ["executor", executor],
] as const) {
  console.log(`  ${name.padEnd(13)} ${acct.address}`);
}
console.log();

// Caps must strictly attenuate down the chain.
const humanBudget = usdc(100);
const traderCap = usdc(20);
const stakeThisRound = usdc(5);

// Hop 1 — root: human → fund-manager (full budget).
const root = buildErc20Delegation({ from: human, to: manager.address, tokenAddress: token, maxAmount: humanBudget });
const signedRoot = await signDelegation(human, root);

// Hop 2 — redelegation: fund-manager → trader (narrowed).
const redel = buildErc20Delegation({
  from: manager,
  to: trader.address,
  tokenAddress: token,
  maxAmount: traderCap,
  parentDelegation: signedRoot,
});
const signedRedel = await signDelegation(manager, redel);

// Hop 3 — redelegation: trader → executor (narrowed to this round's stake).
const exec = buildErc20Delegation({
  from: trader,
  to: executor.address,
  tokenAddress: token,
  maxAmount: stakeThisRound,
  parentDelegation: signedRedel,
});
const signedExec = await signDelegation(trader, exec);

// Decode caps back out of the signed delegations.
const rootMax = extractErc20MaxAmount(signedRoot, token);
const redelMax = extractErc20MaxAmount(signedRedel, token);
const execMax = extractErc20MaxAmount(signedExec, token);

console.log("decoded caps:");
console.log(`  root  (human→manager):   ${fmt(rootMax)}`);
console.log(`  redel (manager→trader):  ${fmt(redelMax)}`);
console.log(`  exec  (trader→executor): ${fmt(execMax)}\n`);

// Each hop is signed.
check("all three delegations signed", [signedRoot, signedRedel, signedExec].every((d) => d.signature && d.signature !== "0x"));

// Caps decode to the configured values.
check("root cap decodes correctly", rootMax === humanBudget, fmt(rootMax));
check("trader cap decodes correctly", redelMax === traderCap, fmt(redelMax));
check("executor cap decodes correctly", execMax === stakeThisRound, fmt(execMax));

// Attenuation: stakeThisRound ≤ trader cap ≤ manager/human budget.
check("attenuation: trader ≤ human", redelMax <= rootMax, `${fmt(redelMax)} ≤ ${fmt(rootMax)}`);
check("attenuation: executor ≤ trader", execMax <= redelMax, `${fmt(execMax)} ≤ ${fmt(redelMax)}`);

// Cryptographic linkage: authority == hashDelegation(parent).
check("redel chains to root (authority == hashDelegation(root))", isChainedTo(signedRedel, signedRoot));
check("exec chains to redel (authority == hashDelegation(redel))", isChainedTo(signedExec, signedRedel));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\n3-level delegation chain valid ✓");
