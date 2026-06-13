import { createDelegation, ScopeType, type Delegation } from "@metamask/smart-accounts-kit";
import { hashDelegation } from "@metamask/smart-accounts-kit/utils";
import { parseUnits, type Address, type Hex } from "viem";
import { USDC_DECIMALS } from "@consilium/shared";
import type { ConsiliumSmartAccount } from "./smartAccount.ts";

/**
 * Delegation builders (CONSOLIUM_BUILD.MD §5.2–§5.4).
 *
 * The 3-level A2A chain: Human → fund-manager (root) → trader (redelegation) → executor (3rd hop).
 * Each hop is an `Erc20TransferAmount`-scoped USDC delegation that can only NARROW the parent's
 * cap. `parentDelegation` cryptographically chains each child to its parent via `authority`.
 */

/** Convert whole USDC to 6-decimal base units. */
export function usdc(whole: number | string): bigint {
  return parseUnits(String(whole), USDC_DECIMALS);
}

interface DelegationArgs {
  /** The delegator smart account (supplies `from` address + environment + signing). */
  from: ConsiliumSmartAccount;
  /** The delegate address (next hop). */
  to: Address;
  tokenAddress: Address;
  maxAmount: bigint;
  /** Signed parent delegation — present for redelegations (hops 2 and 3), absent for the root. */
  parentDelegation?: Delegation;
}

/** Build an ERC-20-transfer-amount delegation (root if no parent, redelegation otherwise). */
export function buildErc20Delegation(args: DelegationArgs): Delegation {
  const scope = {
    type: ScopeType.Erc20TransferAmount,
    tokenAddress: args.tokenAddress,
    maxAmount: args.maxAmount,
  } as const;

  return args.parentDelegation
    ? createDelegation({
        to: args.to,
        from: args.from.address,
        environment: args.from.environment,
        scope,
        parentDelegation: args.parentDelegation,
      })
    : createDelegation({
        to: args.to,
        from: args.from.address,
        environment: args.from.environment,
        scope,
      });
}

/** Sign a delegation with its delegator account, returning the fully-signed delegation. */
export async function signDelegation(
  account: ConsiliumSmartAccount,
  delegation: Delegation,
): Promise<Delegation> {
  const signature = await account.signDelegation({ delegation });
  return { ...delegation, signature };
}

/**
 * Decode the `maxAmount` from an ERC20-transfer-amount delegation's caveats. The enforcer terms
 * pack the token (20 bytes) followed by the amount (32 bytes); we locate the caveat that embeds
 * `tokenAddress` and read the trailing uint256.
 */
export function extractErc20MaxAmount(delegation: Delegation, tokenAddress: Address): bigint {
  const want = tokenAddress.slice(2).toLowerCase();
  for (const caveat of delegation.caveats) {
    const hex = caveat.terms.slice(2);
    if (hex.length >= 104 && hex.slice(0, 40).toLowerCase() === want) {
      return BigInt(`0x${hex.slice(40, 104)}`);
    }
  }
  throw new Error("no ERC20TransferAmount caveat found for token");
}

/** True if `child.authority` correctly chains to `parent` (authority == hashDelegation(parent)). */
export function isChainedTo(child: Delegation, parent: Delegation): boolean {
  return child.authority.toLowerCase() === (hashDelegation(parent) as Hex).toLowerCase();
}
