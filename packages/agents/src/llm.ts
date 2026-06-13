import { env, requireEnv } from "@consilium/shared";

/**
 * Reasoning LLM client (CONSOLIUM_BUILD.MD §7.1).
 *
 * Free/cheap and NOT track-scored — agent reasoning only. Any OpenAI-compatible endpoint works
 * (Groq free Llama by default) via LLM_PROVIDER / LLM_BASE_URL / LLM_API_KEY / LLM_MODEL. The
 * agent's *output* drives real onchain stakes; which model produced it doesn't matter.
 *
 * No silent fallbacks: a non-2xx surfaces as an LLMError with status + body. Transient
 * 429/5xx are retried with backoff; auth/bad-request errors fail immediately.
 */

const BASE_URL = env.LLM_BASE_URL;

export class LLMError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    const hint = status === 401 ? " (check LLM_API_KEY)" : status === 429 ? " (rate limited)" : "";
    super(`LLM (${env.LLM_PROVIDER}) -> HTTP ${status}${hint}: ${body.slice(0, 300)}`);
    this.name = "LLMError";
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;

async function chatFetch(body: Record<string, unknown>, attempt = 0): Promise<Response> {
  const { LLM_API_KEY } = requireEnv(["LLM_API_KEY"]);
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return res;

  if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const backoff = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, backoff + Math.random() * 200));
    return chatFetch(body, attempt + 1);
  }
  throw new LLMError(res.status, await res.text());
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMChatOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ask the endpoint for a JSON object response (OpenAI-compatible json_object mode). */
  json?: boolean;
}

/** Raw chat completion → assistant text. */
export async function llmChat(opts: LLMChatOptions): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model ?? env.LLM_MODEL,
    messages: opts.messages,
  };
  if (opts.temperature != null) body.temperature = opts.temperature;
  if (opts.maxTokens != null) body.max_tokens = opts.maxTokens;
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await chatFetch(body);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (content == null) throw new Error("LLM: no content in response");
  return content;
}

/** Strip ```json fences some models wrap JSON in, then parse defensively. */
function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`LLM: expected JSON, got: ${raw.slice(0, 200)}`);
  }
}

/**
 * Reason and return a parsed JSON object. Requests json_object mode and parses defensively.
 * Describe the required shape in your system/user prompt — portable across OpenAI-compatible
 * providers that don't all support full json_schema.
 */
export async function llmJSON<T>(opts: LLMChatOptions): Promise<T> {
  const content = await llmChat({ ...opts, json: true });
  return parseJson<T>(content);
}

/** A trader's decision — the structured output that drives a real onchain stake (§7.1). */
export interface TraderDecision {
  stance: "YES" | "NO";
  sizeUSDC: number;
  rationale: string;
}
