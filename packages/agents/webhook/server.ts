import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import stringify from "safe-stable-stringify";
import { relayerHost } from "../src/oneshot.ts";
import type { StatusResult } from "../src/oneshot.ts";

/**
 * 1Shot webhook receiver (CONSOLIUM_BUILD.MD §8).
 *
 * The relayer POSTs Ed25519-signed status events to `destinationUrl`. We MUST verify each event
 * against the relayer JWKS before trusting it (§13 guardrail), then broadcast verified events so
 * the UI flips Pending→Confirmed/Reverted driven by the real relayer, not a timer.
 */

export interface RelayerWebhook {
  apiVersion: 0;
  type: 0 | 1 | 4; // 4=Submitted, 0=Confirmed, 1=Reverted
  data: StatusResult;
  timestamp: number;
  keyId: string;
  signature: string; // base64 Ed25519 over the body sans `signature`
}

interface Jwk {
  kty: "OKP";
  crv: "Ed25519";
  kid: string;
  x: string;
}

const JWKS_TTL_MS = 10 * 60_000;
let jwksCache: { fetchedAt: number; keys: Map<string, Jwk> } | null = null;

function jwksUrl(): string {
  return `${relayerHost()}/.well-known/jwks.json`;
}

async function getJwks(force = false): Promise<Map<string, Jwk>> {
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(jwksUrl());
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  const map = new Map<string, Jwk>();
  for (const k of keys) if (k.kty === "OKP" && k.crv === "Ed25519") map.set(k.kid, k);
  jwksCache = { fetchedAt: Date.now(), keys: map };
  return map;
}

/** Verify a relayer webhook's Ed25519 signature over the canonical body (sans `signature`). */
export async function verifyRelayerWebhook(body: Record<string, unknown>): Promise<boolean> {
  const sigB64 = body.signature as string | undefined;
  const keyId = body.keyId as string | undefined;
  if (!sigB64 || !keyId) return false;

  let keys = await getJwks();
  let jwk = keys.get(keyId);
  if (!jwk) {
    keys = await getJwks(true); // force refresh on miss (key rotation)
    jwk = keys.get(keyId);
    if (!jwk) return false;
  }

  const { signature: _omit, ...rest } = body;
  const message = Buffer.from(stringify(rest) as string, "utf8");
  try {
    const key = createPublicKey({ key: jwk as object, format: "jwk" });
    return cryptoVerify(null, message, key, Buffer.from(sigB64, "base64"));
  } catch {
    return false;
  }
}

// --- In-process broadcast (the round runner / SSE layer subscribes) ---

type Listener = (event: RelayerWebhook) => void;
const listeners = new Set<Listener>();
export function onRelayerEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const seen = new Set<string>(); // idempotency on (data.id, type)

export interface WebhookServerOptions {
  port?: number;
  path?: string;
}

/** Start the webhook HTTP server. Verified, de-duped events are broadcast via onRelayerEvent. */
export function startWebhookServer(opts: WebhookServerOptions = {}) {
  const path = opts.path ?? "/relayer-webhook";
  const port = opts.port ?? 8787;

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      if (req.method !== "POST" || url.pathname !== path) return new Response("not found", { status: 404 });

      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return new Response("bad request", { status: 400 });

      if (!(await verifyRelayerWebhook(body))) {
        return new Response("invalid signature", { status: 401 });
      }

      const event = body as unknown as RelayerWebhook;
      const dedupeKey = `${event.data?.id}:${event.type}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        for (const fn of listeners) {
          try {
            fn(event);
          } catch {
            /* a listener throwing must not break delivery */
          }
        }
      }
      return new Response("ok", { status: 200 }); // ack fast so the relayer doesn't retry
    },
  });

  return { server, url: `http://localhost:${port}${path}`, stop: () => server.stop() };
}
