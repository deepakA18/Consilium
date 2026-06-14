"use client";

import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";

const HUB = process.env.NEXT_PUBLIC_EVENTS_URL ?? "http://localhost:8787";

interface GrantMessage {
  delegate: `0x${string}`;
  delegator: `0x${string}`;
  authority: `0x${string}`;
  caveats: { enforcer: `0x${string}`; terms: `0x${string}` }[];
  salt: `0x${string}`;
}
interface Prepared {
  message: GrantMessage;
  typedData: {
    domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
    types: Record<string, { name: string; type: string }[]>;
    primaryType: "Delegation";
    message: GrantMessage;
  };
  budgetUsdc: number;
}

/**
 * The human grant: ask the hub to prepare the root delegation's EIP-712 typed data for the connected
 * wallet, sign it in the wallet (gasless), and submit the signature. The next round roots its
 * delegation chain at this signature. Needs a 7702-upgraded, funded account to be redeemable on-chain.
 */
export function useGrant() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [granting, setGranting] = useState(false);
  const [grantedBy, setGrantedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function grant(budgetUsdc: number): Promise<boolean> {
    if (!address) return false;
    setGranting(true);
    setError(null);
    try {
      const prep = await fetch(`${HUB}/grant/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ human: address, budgetUsdc }),
      });
      if (!prep.ok) throw new Error("could not prepare grant");
      const { typedData, message } = (await prep.json()) as Prepared;

      const signature = await signTypedDataAsync({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: { ...message, salt: BigInt(message.salt) },
      });

      const submit = await fetch(`${HUB}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      if (!submit.ok) throw new Error("could not submit grant");
      setGrantedBy(address);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 120) : String(e));
      return false;
    } finally {
      setGranting(false);
    }
  }

  return { grant, granting, granted: grantedBy != null && grantedBy === address, error };
}
