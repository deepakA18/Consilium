/**
 * One-off: resolve + claim an orphaned market left unresolved by an interrupted round.
 *   bun run src/smoke/resolve-orphan.ts <marketAddress>
 */
import { formatUnits, type Address } from "viem";
import { requireEnv, consiliumMarketAbi, USDC_DECIMALS, txUrl } from "@consilium/shared";
import { makeWalletClient, publicClient } from "../smartAccount.ts";

const market = process.argv[2] as Address;
if (!market) throw new Error("usage: resolve-orphan.ts <marketAddress>");

const keys = requireEnv(["DEPLOYER_PRIVATE_KEY", "BULL_PRIVATE_KEY", "BEAR_PRIVATE_KEY"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const resolved0 = (await publicClient.readContract({ address: market, abi: consiliumMarketAbi, functionName: "resolved" })) as boolean;
console.log(`market ${market}  resolved=${resolved0}`);

if (!resolved0) {
  const deployer = makeWalletClient(keys.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  let hash: `0x${string}` | undefined;
  for (let i = 0; i < 6; i++) {
    try {
      hash = await deployer.writeContract({ address: market, abi: consiliumMarketAbi, functionName: "resolve" });
      break;
    } catch (err) {
      if (i === 5) throw err;
      await sleep(2500);
    }
  }
  await publicClient.waitForTransactionReceipt({ hash: hash! });
  console.log(`resolved ✓  ${txUrl(hash!)}`);
}

const outcome = (await publicClient.readContract({ address: market, abi: consiliumMarketAbi, functionName: "outcome" })) as number;
const observed = (await publicClient.readContract({ address: market, abi: consiliumMarketAbi, functionName: "observedPrice" })) as bigint;
console.log(`outcome=${outcome === 1 ? "YES (LIQUIDATABLE)" : "NO (SAFE)"}  observedPrice=$${(Number(observed) / 1e8).toFixed(2)}`);

for (const [role, pk] of [
  ["bull", keys.BULL_PRIVATE_KEY],
  ["bear", keys.BEAR_PRIVATE_KEY],
] as const) {
  const wallet = makeWalletClient(pk as `0x${string}`);
  const claimable = (await publicClient.readContract({ address: market, abi: consiliumMarketAbi, functionName: "claimable", args: [wallet.account.address] })) as bigint;
  if (claimable === 0n) {
    console.log(`${role}: nothing to claim`);
    continue;
  }
  const hash = await wallet.writeContract({ address: market, abi: consiliumMarketAbi, functionName: "claim" });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`${role} claimed ${formatUnits(claimable, USDC_DECIMALS)} USDC ✓  ${txUrl(hash)}`);
}
