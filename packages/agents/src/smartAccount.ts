import { Implementation, toMetaMaskSmartAccount, getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { activeChain, getServerRpcUrl } from "@consilium/shared";

/**
 * MetaMask smart-account helpers — EIP-7702 model (CONSOLIUM_BUILD.MD §5.1).
 *
 * Each actor's funded EOA is upgraded *in place* to a MetaMask smart account via an EIP-7702
 * authorization (Implementation.Stateless7702): the smart-account address IS the EOA address, so
 * the USDC already sitting on the EOA is on the operational account — no separate address, no
 * sweep. This also matches the 1Shot relayer's 7702 path (§8).
 *
 * Server-side only — uses the PRIVATE keyed RPC via getServerRpcUrl() (throws in a browser).
 */

export const publicClient = createPublicClient({
  chain: activeChain.chain,
  transport: http(getServerRpcUrl()),
});

/** The EIP-7702 stateless-delegator implementation the EOA delegates its code to. */
export function delegatorImplementation(): Address {
  return getSmartAccountsEnvironment(activeChain.chainId).implementations.EIP7702StatelessDeleGatorImpl as Address;
}

/** A viem wallet client for sending plain txs from a key (resolve/claim, etc.). */
export function makeWalletClient(privateKey: `0x${string}`) {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: activeChain.chain,
    transport: http(getServerRpcUrl()),
  });
}

/** Create the MetaMask smart account for an EOA private key (address == the EOA address). */
export async function makeSmartAccount(privateKey: `0x${string}`) {
  const owner = privateKeyToAccount(privateKey);
  return toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address: owner.address,
    signer: { account: owner },
  });
}

export type ConsiliumSmartAccount = Awaited<ReturnType<typeof makeSmartAccount>>;

/** The on-chain code a 7702-upgraded EOA carries: 0xef0100 ‖ implementation address. */
function expected7702Code(impl: Address): Hex {
  return `0xef0100${impl.slice(2)}`.toLowerCase() as Hex;
}

/** Whether `address` has already been upgraded to our 7702 delegator implementation. */
export async function is7702Upgraded(address: Address): Promise<boolean> {
  const code = await publicClient.getCode({ address });
  return !!code && code.toLowerCase() === expected7702Code(delegatorImplementation());
}

export interface UpgradeResult {
  address: Address;
  alreadyUpgraded: boolean;
  txHash?: Hex;
}

/**
 * Upgrade an EOA in place to the 7702 stateless delegator (self-sponsored — the EOA pays its own
 * gas). Idempotent: a no-op if already upgraded. Required before the account can redeem an
 * ERC-7710 delegation or pay via x402.
 */
export async function upgradeTo7702(privateKey: `0x${string}`): Promise<UpgradeResult> {
  const owner = privateKeyToAccount(privateKey);
  if (await is7702Upgraded(owner.address)) {
    return { address: owner.address, alreadyUpgraded: true };
  }

  const wallet = createWalletClient({
    account: owner,
    chain: activeChain.chain,
    transport: http(getServerRpcUrl()),
  });

  // executor: 'self' → the EOA is also the tx sender, so viem sets the authorization nonce to
  // account.nonce + 1 (the send consumes the current nonce first).
  const authorization = await wallet.signAuthorization({
    account: owner,
    contractAddress: delegatorImplementation(),
    executor: "self",
  });

  const txHash = await wallet.sendTransaction({
    authorizationList: [authorization],
    to: owner.address,
    value: 0n,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { address: owner.address, alreadyUpgraded: false, txHash };
}
