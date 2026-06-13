/**
 * Key funding + 7702 upgrade status. Under EIP-7702 the smart-account address IS the EOA address,
 * so there's one address per role. Prints ETH + USDC balances and whether the EOA is upgraded to
 * the 7702 delegator. Never prints private keys.
 *
 *   bun run keys:status
 */
import { erc20Abi, formatEther, formatUnits, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env, activeChain, USDC_DECIMALS } from "@consilium/shared";
import { publicClient, is7702Upgraded } from "../smartAccount.ts";

const usdc = env.USDC_ADDRESS as Address | undefined;

const roles: [string, string | undefined][] = [
  ["deployer/human", env.DEPLOYER_PRIVATE_KEY],
  ["fundManager", env.FUND_MANAGER_PRIVATE_KEY],
  ["bull", env.BULL_PRIVATE_KEY],
  ["bear", env.BEAR_PRIVATE_KEY],
  ["research", env.RESEARCH_PRIVATE_KEY],
];

console.log(`Funding + 7702 status — ${activeChain.chain.name} (${activeChain.caip2})\n`);
console.log("role             address                                       ETH        USDC      7702");

for (const [name, pk] of roles) {
  if (!pk) {
    console.log(`${name.padEnd(16)} (key unset)`);
    continue;
  }
  const address = privateKeyToAccount(pk as `0x${string}`).address;
  const [eth, bal, upgraded] = await Promise.all([
    publicClient.getBalance({ address }),
    usdc
      ? publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [address] }).catch(() => 0n)
      : Promise.resolve(0n),
    is7702Upgraded(address),
  ]);
  console.log(
    `${name.padEnd(16)} ${address}  ${formatEther(eth).slice(0, 8).padStart(8)}  ${formatUnits(bal, USDC_DECIMALS).padStart(8)}  ${upgraded ? "✓" : "—"}`,
  );
}
