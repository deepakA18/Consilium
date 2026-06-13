import { bytesToHex, type Address, type Hex } from "viem";
import { activeChain, env } from "@consilium/shared";

/**
 * 1Shot public relayer JSON-RPC client (CONSOLIUM_BUILD.MD §8).
 *
 * Submits gas-abstracted ERC-7710 delegated transactions: the relayer redeems a signed delegation
 * from a 7702 smart account and is paid in USDC (no ETH needed by the agent). Endpoint is
 * network-split — testnets on .dev, mainnets on .com.
 */

/** Pick the relayer endpoint for a chain (testnets on .dev, mainnets on .com). */
export function relayerUrlForChain(chainId: number): string {
  return chainId === 84532 || chainId === 11155111
    ? "https://relayer.1shotapi.dev/relayers"
    : "https://relayer.1shotapi.com/relayers";
}

/** Host base of the active relayer, for deriving the JWKS URL. */
export function relayerHost(chainId: number = activeChain.chainId): string {
  return new URL(relayerUrlForChain(chainId)).origin;
}

const RELAYER_URL = relayerUrlForChain(activeChain.chainId);

type JsonRpcResponse<T> =
  | { jsonrpc: "2.0"; id: number | string; result: T }
  | { jsonrpc: "2.0"; id: number | string; error: { code: number; message: string; data?: unknown } };

export async function rpc<T>(method: string, params: unknown, id = 1, relayerUrl = RELAYER_URL): Promise<T> {
  const res = await fetch(relayerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const json = (await res.json()) as JsonRpcResponse<T>;
  if (!res.ok) throw new Error(`1Shot HTTP ${res.status}: ${JSON.stringify(json)}`);
  if ("error" in json) {
    throw new Error(`1Shot [${json.error.code}] ${json.error.message} ${JSON.stringify(json.error.data ?? "")}`);
  }
  return json.result;
}

/** Recursively convert bigints → 0x-hex and Uint8Array → hex so a delegation is JSON-RPC-safe. */
export function toRelayerJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (value instanceof Uint8Array) return bytesToHex(value);
  if (Array.isArray(value)) return value.map(toRelayerJson);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toRelayerJson(v);
    return out;
  }
  return value;
}

// --- Types ---

export interface ChainCapabilities {
  feeCollector: Address;
  targetAddress: Address;
  tokens: { address: Address; symbol?: string; name?: string; decimals: number | string }[];
}

export interface FeeData {
  chainId: string;
  token: { address: Address; decimals: number; symbol?: string };
  rate: number;
  minFee: string;
  expiry: number;
  gasPrice: Hex;
  feeCollector: Address;
  targetAddress?: Address;
  context?: string;
}

export interface Estimate7710Result {
  success: boolean;
  paymentTokenAddress?: Address;
  paymentChain?: number;
  gasUsed: Record<string, string>;
  requiredPaymentAmount?: string;
  context?: string;
  contextByChainId?: Record<string, string>;
  error?: string;
}

export interface Execution7710 {
  target: Address;
  value: string;
  data: Hex;
}

export interface DelegatedTransaction7710 {
  permissionContext: unknown[];
  executions: Execution7710[];
}

export interface Send7710Params {
  chainId: string;
  transactions: DelegatedTransaction7710[];
  authorizationList?: unknown[];
  context?: string;
  taskId?: Hex;
  destinationUrl?: string;
  memo?: string;
}

export type TaskStatus = 100 | 110 | 200 | 400 | 500;
export interface StatusResult {
  id: Hex;
  chainId: string;
  status: TaskStatus;
  hash?: Hex;
  receipt?: { transactionHash: Hex; blockNumber: number | string; gasUsed: string };
  message?: string;
  data?: unknown;
  memo?: string;
}

export const TERMINAL_STATUS: TaskStatus[] = [200, 400, 500];
export const STATUS_LABEL: Record<TaskStatus, string> = {
  100: "Pending",
  110: "Submitted",
  200: "Confirmed",
  400: "Rejected",
  500: "Reverted",
};

// --- Methods ---

export function getCapabilities(chainIds: string[] = [String(activeChain.chainId)]): Promise<Record<string, ChainCapabilities>> {
  return rpc("relayer_getCapabilities", chainIds);
}

export function getFeeData(token: Address, chainId: string = String(activeChain.chainId)): Promise<FeeData> {
  return rpc("relayer_getFeeData", { chainId, token });
}

export function estimate7710(params: Send7710Params): Promise<Estimate7710Result> {
  // id 0 per the skill's estimate convention; context omitted by callers.
  return rpc("relayer_estimate7710Transaction", params, 0);
}

export function send7710(params: Send7710Params): Promise<Hex> {
  return rpc("relayer_send7710Transaction", params);
}

export function getStatus(taskId: Hex, logs = true): Promise<StatusResult> {
  return rpc("relayer_getStatus", { id: taskId, logs });
}

/** Poll a task to a terminal status (200/400/500). Webhook is preferred; this is the fallback. */
export async function pollUntilTerminal(taskId: Hex, intervalMs = 3000, timeoutMs = 5 * 60_000): Promise<StatusResult> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const s = await getStatus(taskId);
    if (TERMINAL_STATUS.includes(s.status)) return s;
    if (Date.now() > deadline) throw new Error(`1Shot task ${taskId} timed out (last status ${s.status})`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

void env; // reserved: env.ONESHOT_RELAYER_URL override hook if ever needed
