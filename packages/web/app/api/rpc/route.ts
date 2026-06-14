import { NextResponse } from "next/server";

/**
 * Same-origin JSON-RPC proxy. The browser calls `/api/rpc`; this server route forwards to the
 * PRIVATE keyed RPC (`BASE_SEPOLIA_RPC_URL`, deliberately NOT a `NEXT_PUBLIC_` alias), so the keyed
 * URL never reaches the client bundle or the network tab. Falls back to the public endpoint when no
 * private RPC is configured.
 *
 * A read-only method allowlist keeps this from being abused as an open write/relay endpoint that
 * would burn your provider quota. Wallets still send signed transactions through the user's own
 * wallet RPC, not this proxy.
 */

export const runtime = "nodejs"; // keep the keyed URL on the server; never edge-bundled to the client
export const dynamic = "force-dynamic";

const UPSTREAM = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";

const ALLOWED = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_call",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getTransactionCount",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getLogs",
  "net_version",
]);

function allowed(body: unknown): boolean {
  const ok = (m: unknown) =>
    typeof m === "object" && m !== null && ALLOWED.has((m as { method?: string }).method ?? "");
  if (Array.isArray(body)) return body.length > 0 && body.every(ok); // batched requests
  return ok(body);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!allowed(body)) {
    return NextResponse.json({ error: "method not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "upstream RPC unreachable" }, { status: 502 });
  }
}
