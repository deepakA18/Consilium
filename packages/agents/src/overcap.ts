import { randomBytes } from "node:crypto";
import { encodeFunctionData, erc20Abi, parseUnits, bytesToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createDelegation, ScopeType, createExecution, ExecutionMode } from "@metamask/smart-accounts-kit";
import { DelegationManager } from "@metamask/smart-accounts-kit/contracts";
import { env, USDC_DECIMALS } from "@consilium/shared";
import { makeSmartAccount, makeWalletClient, publicClient } from "./smartAccount.ts";

/**
 * THE REVERT money-moment (CONSOLIUM_BUILD.MD §6.4), approach B — a real on-chain failed tx.
 *
 * A trader signs a delegation scoped `ERC20TransferAmount(cap)`. A redeemer then calls the
 * DelegationManager directly, attempting to move MORE than `cap`. The `ERC20TransferAmountEnforcer`
 * caveat reverts the redemption — no app-code guard, the chain rejects it. We submit it with an
 * explicit gas limit (skipping estimation, which would pre-empt it) so it mines and reverts,
 * yielding a clickable failed-tx hash on Basescan.
 */

export interface OverCapResult {
  cap: bigint;
  attempt: bigint;
  delegationManager: Address;
  /** The on-chain failed tx (status "reverted"). */
  txHash: Hex;
  reverted: boolean;
  /** Revert reason captured from a pre-flight simulation (the enforcer's message). */
  reason: string;
}

export interface OverCapParams {
  traderPk: `0x${string}`; // delegator (e.g. bull)
  redeemerPk: `0x${string}`; // delegate that submits + pays gas (e.g. deployer)
  recipient: Address; // where the over-cap transfer would send USDC (e.g. the market)
  capWholeUsdc: number; // delegated cap
  attemptWholeUsdc: number; // amount the redemption attempts (> cap)
}

export async function demoOverCapRevert(p: OverCapParams): Promise<OverCapResult> {
  const trader = await makeSmartAccount(p.traderPk);
  const redeemer = privateKeyToAccount(p.redeemerPk);
  const usdc = env.USDC_ADDRESS as Address;
  const cap = parseUnits(String(p.capWholeUsdc), USDC_DECIMALS);
  const attempt = parseUnits(String(p.attemptWholeUsdc), USDC_DECIMALS);

  // Delegation: trader → redeemer, capped by the ERC20TransferAmount enforcer.
  const delegation = createDelegation({
    to: redeemer.address,
    from: trader.address,
    environment: trader.environment,
    salt: bytesToHex(Uint8Array.from(randomBytes(32))) as Hex,
    scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: usdc, maxAmount: cap },
  });
  const signature = await trader.signDelegation({ delegation });
  const signed = { ...delegation, signature };

  // Execution that EXCEEDS the cap.
  const execution = createExecution({
    target: usdc,
    value: 0n,
    callData: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [p.recipient, attempt] }),
  });

  const calldata = DelegationManager.encode.redeemDelegations({
    delegations: [[signed]],
    modes: [ExecutionMode.SingleDefault],
    executions: [[execution]],
  });

  const delegationManager = trader.environment.DelegationManager as Address;

  // Pre-flight simulation to capture the enforcer's revert reason (no tx submitted).
  let reason = "(no reason captured)";
  try {
    await publicClient.call({ account: redeemer.address, to: delegationManager, data: calldata });
    reason = "UNEXPECTED: simulation did not revert";
  } catch (err) {
    reason = err instanceof Error ? err.message.split("\n")[0]! : String(err);
  }

  // Submit for real with an explicit gas limit so it bypasses estimation, mines, and reverts.
  const wallet = makeWalletClient(p.redeemerPk);
  const txHash = await wallet.sendTransaction({ to: delegationManager, data: calldata, gas: 600_000n });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { cap, attempt, delegationManager, txHash, reverted: receipt.status === "reverted", reason };
}
