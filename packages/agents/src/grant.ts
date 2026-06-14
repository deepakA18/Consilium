import { createDelegation, ScopeType, type Delegation } from "@metamask/smart-accounts-kit";
import { getAddress, type Address, type Hex } from "viem";
import { requireEnv, activeChain } from "@consilium/shared";
import { usdc as usdcUnits } from "./delegation.ts";
import { makeSmartAccount } from "./smartAccount.ts";

/**
 * Human grant, prepared server-side (CONSOLIUM_BUILD.MD §5.2). The connected wallet (the judge) is
 * the root delegator. We build the root `Erc20TransferAmount` delegation here — where the kit lives
 * with a single viem — and return the exact EIP-712 typed data. The browser signs it with wagmi
 * (no kit in the client → no viem conflict), then submits the signature; the next round roots its
 * delegation chain at that signature.
 */

const DEFAULT_BUDGET = Number(process.env.HUMAN_BUDGET ?? 100); // whole USDC, default when none specified
const MIN_BUDGET = 10; // the round scales each trader's cap to the budget, so small grants are fine
const MAX_BUDGET = 1000;

const clampBudget = (n: number) => Math.min(MAX_BUDGET, Math.max(MIN_BUDGET, Math.round(Number.isFinite(n) ? n : DEFAULT_BUDGET)));

// The DelegationManager EIP-712 struct types (stable). hashDelegation hashes exactly these fields.
const DELEGATION_EIP712_TYPES = {
  Caveat: [
    { name: "enforcer", type: "address" },
    { name: "terms", type: "bytes" },
  ],
  Delegation: [
    { name: "delegate", type: "address" },
    { name: "delegator", type: "address" },
    { name: "authority", type: "bytes32" },
    { name: "caveats", type: "Caveat[]" },
    { name: "salt", type: "uint256" },
  ],
} as const;

export interface GrantMessage {
  delegate: Hex;
  delegator: Hex;
  authority: Hex;
  caveats: { enforcer: Hex; terms: Hex }[];
  salt: Hex;
}

export interface PreparedGrant {
  message: GrantMessage;
  typedData: {
    domain: { name: string; version: string; chainId: number; verifyingContract: Hex };
    types: typeof DELEGATION_EIP712_TYPES;
    primaryType: "Delegation";
    message: GrantMessage;
  };
  budgetUsdc: number;
  fundManager: Hex;
}

/** Build the root grant + its EIP-712 typed data for a connected human, capped at `budgetUsdc`. */
export async function prepareHumanGrant(human: Address, budgetUsdc = DEFAULT_BUDGET): Promise<PreparedGrant> {
  const { FUND_MANAGER_PRIVATE_KEY, USDC_ADDRESS } = requireEnv(["FUND_MANAGER_PRIVATE_KEY", "USDC_ADDRESS"]);
  const fundManager = await makeSmartAccount(FUND_MANAGER_PRIVATE_KEY as `0x${string}`);
  const budget = clampBudget(budgetUsdc);

  const delegation = createDelegation({
    to: fundManager.address,
    from: getAddress(human),
    environment: fundManager.environment,
    scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: getAddress(USDC_ADDRESS), maxAmount: usdcUnits(budget) },
  });

  // The exact EIP-712 Delegation message (no `signature` field; caveats trimmed to {enforcer,terms}).
  const message: GrantMessage = {
    delegate: delegation.delegate,
    delegator: delegation.delegator,
    authority: delegation.authority,
    caveats: delegation.caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms })),
    salt: delegation.salt,
  };

  return {
    message,
    typedData: {
      domain: { name: "DelegationManager", version: "1", chainId: activeChain.chainId, verifyingContract: fundManager.environment.DelegationManager },
      types: DELEGATION_EIP712_TYPES,
      primaryType: "Delegation",
      message,
    },
    budgetUsdc: budget,
    fundManager: fundManager.address,
  };
}

/** Reassemble a fully-signed root delegation from the wallet's signature. `args` ("0x") is off-chain
 *  metadata not part of the EIP-712 hash, so adding it doesn't change what was signed. */
export function assembleGrant(message: GrantMessage, signature: Hex): Delegation {
  return {
    ...message,
    caveats: message.caveats.map((c) => ({ ...c, args: "0x" as Hex })),
    signature,
  };
}
