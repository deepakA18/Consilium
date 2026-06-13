/**
 * 1Shot relayer smoke (CONSOLIUM_BUILD.MD §8, §11 step 6) — decision-independent parts.
 * Verifies the relayer is reachable for our chain, quotes a fee, and confirms the webhook JWKS
 * verification path works. The relayed STAKE itself depends on the contract-model decision +
 * a deployed market, handled separately.
 *
 *   bun run oneshot:smoke
 */
import { createPublicKey } from "node:crypto";
import type { Address } from "viem";
import { env, activeChain } from "@consilium/shared";
import { getCapabilities, getFeeData, relayerUrlForChain, relayerHost } from "../oneshot.ts";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const chainId = String(activeChain.chainId);
console.log(`1Shot smoke — ${activeChain.chain.name} via ${relayerUrlForChain(activeChain.chainId)}\n`);

// --- capabilities ---
const caps = await getCapabilities([chainId]);
const c = caps[chainId];
check("relayer supports our chain", !!c, c ? "yes" : "EMPTY — wrong endpoint?");
if (c) {
  console.log(`   targetAddress: ${c.targetAddress}`);
  console.log(`   feeCollector:  ${c.feeCollector}`);
  const usdc = c.tokens.find((t) => t.symbol === "USDC");
  check("USDC is an accepted payment token", !!usdc, usdc?.address ?? "(none)");
  check(
    "accepted USDC matches our USDC_ADDRESS",
    !!usdc && !!env.USDC_ADDRESS && usdc.address.toLowerCase() === env.USDC_ADDRESS.toLowerCase(),
    `${usdc?.address} vs ${env.USDC_ADDRESS}`,
  );

  // --- fee quote ---
  if (usdc) {
    const fee = await getFeeData(usdc.address as Address, chainId);
    check("getFeeData returns a quote", !!fee.minFee && !!fee.gasPrice);
    console.log(`   minFee: ${fee.minFee} atoms (≈ $0.01)  rate: ${fee.rate}  expiry: ${fee.expiry}  context: ${fee.context ? "present" : "none"}`);
  }
}

// --- webhook JWKS / Ed25519 verify path ---
const jwksUrl = `${relayerHost()}/.well-known/jwks.json`;
const jwks = (await (await fetch(jwksUrl)).json()) as { keys?: { kty: string; crv: string; kid: string; x: string }[] };
const edKeys = (jwks.keys ?? []).filter((k) => k.kty === "OKP" && k.crv === "Ed25519");
check("JWKS exposes Ed25519 key(s)", edKeys.length > 0, `${edKeys.length} key(s) @ ${jwksUrl}`);
if (edKeys[0]) {
  try {
    createPublicKey({ key: edKeys[0] as object, format: "jwk" });
    check("first JWKS key imports for Ed25519 verify", true, `kid=${edKeys[0].kid}`);
  } catch (e) {
    check("first JWKS key imports for Ed25519 verify", false, String(e));
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\n1Shot relayer reachable + fee quote + webhook-verify path OK ✓");
console.log("(relayed STAKE pending the contract-model decision + a deployed market)");
