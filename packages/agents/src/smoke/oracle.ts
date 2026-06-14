/**
 * Oracle consumer smoke (CONSOLIUM_BUILD.MD §6.5) — the revenue loop.
 *
 * Phase 1 (handshake): GET the oracle read with no payment → assert a 402 whose challenge advertises
 * ERC-7710. Phase 2 (live settle): a "liquidator bot" smart account pays the micropayment via an
 * ERC-7710 delegation and reads the live liquidation probability. A failed settle is the expected
 * funding gate, reported honestly (doesn't fail the smoke on its own).
 *
 *   MARKET=0x… bun run oracle:smoke   (defaults to the deployed demo market)
 */
import { generatePrivateKey } from "viem/accounts";
import { getAddress } from "viem";
import { env } from "@consilium/shared";
import { buildOracleApp, type OracleReading } from "../oracleServer.ts";
import { makeSmartAccount } from "../smartAccount.ts";
import { makeBuyerFetch } from "../buyerClient.ts";

const PORT = 4600;
const dep = (await Bun.file(`${import.meta.dir}/../../../contracts/deployments/84532.json`).json()) as { market: string };
const market = getAddress(process.env.MARKET ?? dep.market);
const URL = `http://localhost:${PORT}/oracle/${market}`;

let failures = 0;
let settled = false;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

function decodeChallenge(header: string | null): { accepts?: { extra?: { assetTransferMethod?: string }; network?: string }[] } | null {
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, "base64").toString());
  } catch {
    return null;
  }
}

console.log(`oracle smoke — consumer read of market ${market}\n`);

const { app, payTo, price } = buildOracleApp();
console.log(`oracle seller: payTo=${payTo}  price=${price}\n`);

const httpServer = app.listen(PORT);
await new Promise<void>((resolve) => httpServer.once("listening", () => resolve()));

try {
  // --- Phase 1: unpaid GET → 402 challenge advertising erc7710 ---
  console.log("Phase 1 — handshake");
  const res = await fetch(URL);
  check("unpaid GET returns 402", res.status === 402, `got ${res.status}`);
  const accepted = decodeChallenge(res.headers.get("PAYMENT-REQUIRED"))?.accepts?.[0];
  check("402 advertises assetTransferMethod=erc7710", accepted?.extra?.assetTransferMethod === "erc7710", accepted?.extra?.assetTransferMethod ?? "(absent)");

  // --- Phase 2: paid read via an ERC-7710 delegation (the liquidator bot) ---
  console.log("\nPhase 2 — paid read (needs a funded + deployed consumer smart account)");
  const consumerPk = (env.BULL_PRIVATE_KEY ?? generatePrivateKey()) as `0x${string}`;
  const consumer = await makeSmartAccount(consumerPk);
  console.log(`consumer smart account: ${consumer.address}`);
  const fetchWithPayment = makeBuyerFetch(consumer);

  try {
    const paid = await fetchWithPayment(URL, { method: "GET" });
    if (paid.status === 200) {
      settled = true;
      const reading = (await paid.json()) as OracleReading;
      console.log("✓ paid read settled — oracle output:");
      console.log(`   p(liquidation) = ${reading.pLiquidation ?? "n/a"}  ·  pot ${reading.potUsdc} USDC  ·  ${reading.resolved ? `resolved ${reading.outcome}` : "live"}`);
      console.log("   PAYMENT-RESPONSE:", paid.headers.get("PAYMENT-RESPONSE") ?? "(none)");
    } else {
      console.log(`⚠ settle not completed (status ${paid.status}) — expected without a funded/deployed consumer`);
      console.log(`   ${(await paid.text()).slice(0, 200)}`);
    }
  } catch (err) {
    console.log("⚠ settle not completed (expected without a funded/deployed consumer):");
    console.log(`   ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`);
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
    ? "\noracle read verified ✓  — a consumer paid USDC (ERC-7710) and read the live probability"
    : "\noracle handshake verified ✓  (paid-read gate pending consumer funding)",
);
