/**
 * Relayed-stake smoke (CONSOLIUM_BUILD.MD §6.3, §8, §11 step 6).
 * bull stakes 1 USDC YES into the deployed market via the 1Shot relayer — gas paid in USDC, no ETH.
 * Estimate → send → poll to terminal, then verify the stake landed on-chain.
 *
 *   bun run relay:stake
 */
import { erc20Abi, type Address } from "viem";
import { requireEnv, txUrl, consiliumMarketAbi } from "@consilium/shared";
import { makeSmartAccount, publicClient } from "../smartAccount.ts";
import { relayStake } from "../relayStake.ts";
import { getStatus, pollUntilTerminal, STATUS_LABEL } from "../oneshot.ts";

const { BULL_PRIVATE_KEY, USDC_ADDRESS } = requireEnv(["BULL_PRIVATE_KEY", "USDC_ADDRESS"]);
const usdc = USDC_ADDRESS as Address;

const deployment = (await Bun.file(`${import.meta.dir}/../../../contracts/deployments/84532.json`).json()) as {
  market: Address;
};
const market = deployment.market;

const SIDE_YES = 1;
const STAKE = 1_000_000n; // 1 USDC

const bull = await makeSmartAccount(BULL_PRIVATE_KEY as `0x${string}`);
console.log(`Relayed stake — bull ${bull.address} stakes 1 USDC YES into ${market}\n`);

const readPot = () => publicClient.readContract({ address: market, abi: consiliumMarketAbi, functionName: "pot" });
const readUsdc = (a: Address) => publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [a] });

const [potBefore, bullBefore] = await Promise.all([readPot(), readUsdc(bull.address)]);
console.log(`before: pot=${potBefore} bullUSDC=${bullBefore}`);

const { taskId, feeAmount } = await relayStake({ trader: bull, market, side: SIDE_YES, stakeAmount: STAKE });
console.log(`submitted task ${taskId} (fee ${feeAmount} atoms)`);

const final = await pollUntilTerminal(taskId);
console.log(`status: ${final.status} (${STATUS_LABEL[final.status]})`);

if (final.status !== 200) {
  console.error(`relayed stake did not confirm: ${final.message ?? JSON.stringify(final.data ?? {})}`);
  process.exit(1);
}

const hash = final.receipt?.transactionHash ?? final.hash;
console.log(`relayed tx: ${hash ? txUrl(hash) : "(no hash)"}`);

const [potAfter, bullAfter] = await Promise.all([readPot(), readUsdc(bull.address)]);
console.log(`after:  pot=${potAfter} bullUSDC=${bullAfter}`);
console.log(`pot delta: +${potAfter - potBefore}  bull spent: ${bullBefore - bullAfter} (stake + fee, gas in USDC)`);

if (potAfter - potBefore !== STAKE) {
  console.error(`expected pot +${STAKE}, got +${potAfter - potBefore}`);
  process.exit(1);
}
console.log("\nRelayed stake confirmed on-chain ✓ — gas paid in USDC, no ETH spent by bull");
