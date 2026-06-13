import { randomBytes } from "node:crypto";
import { encodeFunctionData, erc20Abi, parseUnits, bytesToHex, type Address, type Hex } from "viem";
import { createDelegation, ScopeType } from "@metamask/smart-accounts-kit";
import { activeChain } from "@consilium/shared";
import {
  getCapabilities,
  estimate7710,
  send7710,
  toRelayerJson,
  type Send7710Params,
} from "./oneshot.ts";
import type { ConsiliumSmartAccount } from "./smartAccount.ts";

/**
 * Relay a market stake through the 1Shot relayer (CONSOLIUM_BUILD.MD §6.3, §8).
 *
 * The agent pays no ETH: the relayer redeems two ERC-7710 delegations atomically as the agent —
 *   A) ERC20TransferAmount-capped → [USDC.transfer(feeCollector, fee), USDC.transfer(market, stake)]
 *   B) FunctionCall(market.stake) → [market.stake(side, stake)]
 * The cap on (A) is what reverts an over-cap stake at the enforcer (the money-moment). The market
 * credits the just-transferred USDC (push model).
 */

const STAKE_ABI = [
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [
      { name: "side", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const freshSalt = (): Hex => bytesToHex(Uint8Array.from(randomBytes(32)));

export interface RelayStakeParams {
  trader: ConsiliumSmartAccount;
  market: Address;
  side: number; // 0 = NO, 1 = YES
  stakeAmount: bigint; // USDC atoms (6dp)
  /** ERC20TransferAmount cap on (A). Defaults to fee + stake. Set BELOW stake to force the
   *  over-cap enforcer revert (§6.4 money-moment). */
  cap?: bigint;
  destinationUrl?: string;
}

export interface RelayStakeResult {
  taskId: Hex;
  feeAmount: bigint;
  stakeAmount: bigint;
}

export async function relayStake(p: RelayStakeParams): Promise<RelayStakeResult> {
  const chainId = String(activeChain.chainId);
  const caps = (await getCapabilities([chainId]))[chainId];
  if (!caps) throw new Error(`1Shot relayer has no capabilities for chain ${chainId} (wrong endpoint?)`);

  const usdc = (caps.tokens.find((t) => t.symbol === "USDC") ?? caps.tokens[0])?.address as Address;
  const decimals = Number(caps.tokens.find((t) => t.address === usdc)?.decimals ?? 6);
  const { targetAddress, feeCollector } = caps;

  // Build a fully-signed bundle for a given fee. Fresh salts each time so re-signing is replay-safe.
  const build = async (feeAmount: bigint): Promise<Send7710Params> => {
    const transferCap = p.cap ?? feeAmount + p.stakeAmount;

    const delA = createDelegation({
      to: targetAddress,
      from: p.trader.address,
      environment: p.trader.environment,
      salt: freshSalt(),
      scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: usdc, maxAmount: transferCap },
    });
    const sigA = await p.trader.signDelegation({ delegation: delA });

    const delB = createDelegation({
      to: targetAddress,
      from: p.trader.address,
      environment: p.trader.environment,
      salt: freshSalt(),
      scope: { type: ScopeType.FunctionCall, targets: [p.market], selectors: ["stake(uint8,uint256)"] },
    });
    const sigB = await p.trader.signDelegation({ delegation: delB });

    const feeTransfer = {
      target: usdc,
      value: "0",
      data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [feeCollector, feeAmount] }),
    };
    const stakeTransfer = {
      target: usdc,
      value: "0",
      data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [p.market, p.stakeAmount] }),
    };
    const stakeCall = {
      target: p.market,
      value: "0",
      data: encodeFunctionData({ abi: STAKE_ABI, functionName: "stake", args: [p.side, p.stakeAmount] }),
    };

    return {
      chainId,
      transactions: [
        { permissionContext: [toRelayerJson({ ...delA, signature: sigA })], executions: [feeTransfer, stakeTransfer] },
        { permissionContext: [toRelayerJson({ ...delB, signature: sigB })], executions: [stakeCall] },
      ],
    };
  };

  // Estimate-first: start with a mock fee of 0.01 USDC (skill's safe floor), adjust to the
  // relayer's requiredPaymentAmount, re-sign, then send with the locked price context.
  let feeAmount = parseUnits("0.01", decimals);
  let params = await build(feeAmount);
  let est = await estimate7710(params);
  if (!est.success) throw new Error(`1Shot estimate failed: ${est.error}`);

  const required = BigInt(est.requiredPaymentAmount ?? "0");
  if (required > 0n && required !== feeAmount && p.cap === undefined) {
    feeAmount = required;
    params = await build(feeAmount);
    est = await estimate7710(params);
    if (!est.success) throw new Error(`1Shot re-estimate failed: ${est.error}`);
  }

  const taskId = await send7710({
    ...params,
    context: est.context,
    ...(p.destinationUrl ? { destinationUrl: p.destinationUrl } : {}),
  });

  return { taskId, feeAmount, stakeAmount: p.stakeAmount };
}
