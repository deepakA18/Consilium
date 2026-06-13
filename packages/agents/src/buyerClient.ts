import { createx402DelegationProvider } from "@metamask/smart-accounts-kit/experimental";
import { x402Erc7710Client } from "@metamask/x402";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { ConsiliumSmartAccount } from "./smartAccount.ts";

/**
 * x402 BUYER via ERC-7710 delegation (CONSOLIUM_BUILD.MD §6.2).
 *
 * `createx402DelegationProvider` auto-creates, signs, and ABI-encodes an open delegation
 * (with redeemer / allowedTargets / timestamp caveats) whenever the x402 client needs to pay —
 * so the trader's funds move by delegation redemption, scoped back through the chain to the human.
 *
 * Returns a `fetch`-compatible function: GET a 402-gated URL and it transparently pays and retries.
 */
export function makeBuyerFetch(buyer: ConsiliumSmartAccount) {
  const erc7710Client = new x402Erc7710Client({
    delegationProvider: createx402DelegationProvider({ account: buyer }),
  });

  const coreClient = new x402Client().register("eip155:*", erc7710Client);
  const httpClient = new x402HTTPClient(coreClient);

  return wrapFetchWithPayment(fetch, httpClient);
}
