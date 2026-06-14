import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { getAddress } from "viem";
import { type Delegation } from "@metamask/smart-accounts-kit";
import { env, type RoundEvent } from "@consilium/shared";
import { runRound } from "./roundRunner.ts";
import { buildOracleApp } from "./oracleServer.ts";
import { prepareHumanGrant, assembleGrant } from "./grant.ts";

/**
 * Live event hub (CONSOLIUM_BUILD.MD §9/§10) — the bridge between the agent round and the dashboard:
 *  - GET  /events        Server-Sent Events: replays the current round's log, then streams new events.
 *  - POST /round/run     kicks off one real round; every RoundEvent is broadcast to all SSE clients.
 *  - POST /webhook/1shot  1Shot relayer webhook sink (status is already live via the runner's poll).
 *  - GET  /healthz
 *
 * Manual trigger only — one round per request. (An autonomous round loop is future scope.)
 * No state is faked: every streamed event carries a real tx hash / task id from the round.
 */

const PORT = Number(process.env.PORT ?? process.env.EVENT_PORT ?? env.WEBHOOK_PORT ?? 8787);
const DATA_DIR = `${import.meta.dir}/../.data`;
const LAST_ROUND_FILE = `${DATA_DIR}/last-round.json`;

// Abuse guards for a public, always-on hub (each round spends real testnet funds):
//  - REQUIRE_GRANT: only run after a wallet has signed a budget grant this round.
//  - MIN_ROUND_INTERVAL_MS: cooldown between rounds.
const REQUIRE_GRANT = process.env.REQUIRE_GRANT === "true";
const MIN_ROUND_INTERVAL_MS = Number(process.env.MIN_ROUND_INTERVAL_MS ?? 0);
let lastRoundAt = 0;

// Seed the log with the last completed round (persisted to disk) so a freshly-started hub still
// serves real last-round data to the dashboard — never a hardcoded placeholder.
function loadLastRound(): RoundEvent[] {
  try {
    if (existsSync(LAST_ROUND_FILE)) return JSON.parse(readFileSync(LAST_ROUND_FILE, "utf8")) as RoundEvent[];
  } catch {
    /* no/invalid cache — fall back to empty */
  }
  return [];
}
function saveLastRound(events: RoundEvent[]) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(LAST_ROUND_FILE, JSON.stringify(events));
  } catch (err) {
    console.error("could not persist last round:", err);
  }
}

let log: RoundEvent[] = loadLastRound(); // current/last round's events (replayed to new subscribers)
const clients = new Set<Response>();
let running = false;
let pendingGrant: Delegation | null = null; // a wallet-signed root grant, consumed by the next round

function send(res: Response, event: RoundEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
function broadcast(e: RoundEvent) {
  log.push(e);
  for (const res of clients) send(res, e);
}

const app = express();
app.use(cors());
// Consumer read endpoint (x402-gated) mounted alongside the live stream — the product's revenue surface.
app.use(buildOracleApp().app);
app.use(express.json());

app.get("/healthz", (_req, res) => res.json({ ok: true, running, events: log.length, clients: clients.size }));

app.get("/events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("retry: 3000\n\n");
  for (const e of log) send(res, e); // replay the current round so a late tab catches up
  clients.add(res);

  const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
  });
});

// Step 1: prepare the root grant's EIP-712 typed data for the connected human to sign in their wallet.
app.post("/grant/prepare", async (req: Request, res: Response) => {
  try {
    const human = getAddress(String(req.body?.human));
    res.json(await prepareHumanGrant(human, Number(req.body?.budgetUsdc)));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Step 2: receive the wallet's signature (or a fully-signed root); the next round roots its chain here.
app.post("/grant", (req: Request, res: Response) => {
  const body = req.body ?? {};
  const grant: Delegation | null = body.humanRoot
    ? (body.humanRoot as Delegation)
    : body.message && body.signature
      ? assembleGrant(body.message, body.signature)
      : null;
  if (!grant?.signature || !grant?.delegate) {
    res.status(400).json({ error: "expected { message, signature } or { humanRoot }" });
    return;
  }
  pendingGrant = grant;
  res.json({ ok: true, delegator: grant.delegator, delegate: grant.delegate });
});

app.post("/round/run", (_req: Request, res: Response) => {
  if (running) {
    res.status(409).json({ error: "a round is already running" });
    return;
  }
  if (REQUIRE_GRANT && !pendingGrant) {
    res.status(403).json({ error: "connect a wallet and grant a budget first" });
    return;
  }
  const sinceLast = Date.now() - lastRoundAt;
  if (MIN_ROUND_INTERVAL_MS && sinceLast < MIN_ROUND_INTERVAL_MS) {
    res.status(429).json({ error: "cooldown", retryAfterMs: MIN_ROUND_INTERVAL_MS - sinceLast });
    return;
  }
  running = true;
  lastRoundAt = Date.now();
  log = []; // fresh round → new subscribers replay only this round
  const grant = pendingGrant; // consume the wallet grant (if any) for this round
  pendingGrant = null;
  res.status(202).json({ ok: true, rootedByWallet: grant != null });

  runRound(broadcast, grant ? { humanRoot: grant } : {})
    .catch((err) => {
      console.error("round failed:", err);
      broadcast({ kind: "round:end", roundId: "error", ts: Math.floor(Date.now() / 1000) } as RoundEvent);
    })
    .finally(() => {
      running = false;
      saveLastRound(log); // serve this real round to the dashboard until the next one runs
    });
});

// 1Shot relayer webhook sink (destinationUrl) — documented hook; live status already comes via poll.
app.post("/webhook/1shot", (req: Request, res: Response) => {
  console.log("1shot webhook:", JSON.stringify(req.body).slice(0, 200));
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Consilium event hub → http://localhost:${PORT}  (GET /events · POST /round/run)`));
