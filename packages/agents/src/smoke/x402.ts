/**
 * x402 smoke (CONSOLIUM_BUILD.MD §6, §11 step 5).
 *
 * Phase 1 (handshake — no funds needed): stand up the research seller, GET the gated route with
 * no payment, assert a 402 whose challenge advertises ERC-7710. Required to pass.
 * Phase 2 (live settle — needs a funded+deployed buyer smart account): attempt a real paid GET
 * via the ERC-7710 delegation buyer. Reported honestly; a failure here is the expected funding
 * gate, not a code defect, so it doesn't fail the smoke on its own.
 *
 *   bun run x402:smoke
 */
import { generatePrivateKey } from "viem/accounts";
import { env } from "@consilium/shared";
import { buildResearchApp } from "../researchServer.ts";
import { makeSmartAccount } from "../smartAccount.ts";
import { makeBuyerFetch } from "../buyerClient.ts";

const PORT = 4402;
const URL = `http://localhost:${PORT}/research/health`;

let failures = 0;
let settled = false;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

function decodeChallenge(header: string | null): { accepts?: { extra?: { assetTransferMethod?: string }; network?: string; payTo?: string }[] } | null {
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, "base64").toString());
  } catch {
    return null;
  }
}

console.log("x402 smoke — research seller + ERC-7710 buyer\n");

const { app, payTo, signals } = buildResearchApp();
console.log(`seller: payTo=${payTo}  health-tier price=${signals.health.price}\n`);

const httpServer = app.listen(PORT);
await new Promise<void>((resolve) => httpServer.once("listening", () => resolve()));

try {
  // --- Phase 1: unpaid GET → 402 challenge advertising erc7710 ---
  console.log("Phase 1 — handshake");
  const res = await fetch(URL);
  check("unpaid GET returns 402", res.status === 402, `got ${res.status}`);

  const challenge = decodeChallenge(res.headers.get("PAYMENT-REQUIRED"));
  const accepted = challenge?.accepts?.[0];
  check("402 carries a PAYMENT-REQUIRED challenge", !!accepted);
  check(
    "challenge advertises assetTransferMethod=erc7710",
    accepted?.extra?.assetTransferMethod === "erc7710",
    accepted?.extra?.assetTransferMethod ?? "(absent)",
  );
  check("challenge network matches active chain", accepted?.network === env.CHAIN_ID + "" || accepted?.network?.endsWith(String(env.CHAIN_ID)) === true, accepted?.network ?? "?");

  // --- Phase 2: live paid GET via ERC-7710 delegation (needs funded+deployed buyer) ---
  console.log("\nPhase 2 — live settle (needs a funded + deployed buyer smart account)");
  const buyerPk = (env.BULL_PRIVATE_KEY ?? generatePrivateKey()) as `0x${string}`;
  const buyer = await makeSmartAccount(buyerPk);
  console.log(`buyer smart account: ${buyer.address}`);
  const fetchWithPayment = makeBuyerFetch(buyer);

  // The settle is the expected funding gate, not a code defect, so it does NOT affect exit code.
  try {
    const paid = await fetchWithPayment(URL, { method: "GET" });
    if (paid.status === 200) {
      settled = true;
      console.log("✓ paid GET settled and returned the data:", await paid.json());
      console.log("   PAYMENT-RESPONSE:", paid.headers.get("PAYMENT-RESPONSE") ?? "(none)");
    } else {
      console.log(`⚠ settle not completed (status ${paid.status}) — expected without a funded/deployed buyer`);
      console.log(`   ${(await paid.text()).slice(0, 240)}`);
      console.log("   → fund + deploy the buyer smart account (USDC) to close this live gate.");
    }
  } catch (err) {
    console.log("⚠ settle not completed (expected without a funded/deployed buyer):");
    console.log(`   ${err instanceof Error ? err.message.slice(0, 240) : String(err)}`);
    console.log("   → fund + deploy the buyer smart account (USDC) to close this live gate.");
  }
} finally {
  httpServer.close();
}

if (failures > 0) {
  console.error(`\n${failures} handshake check(s) failed.`);
  process.exit(1);
}
console.log(
  settled
    ? "\nx402 verified ✓  — real USDC settled on-chain via ERC-7710 delegation"
    : "\nx402 handshake verified ✓  (settlement gate pending buyer funding)",
);
