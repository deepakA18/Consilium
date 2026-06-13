import { z } from "zod";

/**
 * Zod-validated environment loader.
 *
 * Every field that isn't always needed is optional, so importing `env` never throws in a
 * context that only uses a subset (e.g. `forge build` doesn't need keys). Malformed *present*
 * values DO throw — a bad private key or non-URL fails fast rather than at the RPC call.
 *
 * Scripts that genuinely require a field assert it via `requireEnv([...])`.
 */

const hexAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 20-byte address");

const privateKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte private key");

const envSchema = z.object({
  // --- Chains ---
  // PRIVATE, server-side only. May contain an API key (e.g. QuickNode). Must NEVER be exposed
  // to the browser — do not give it a NEXT_PUBLIC_ alias. Read it via getServerRpcUrl().
  BASE_SEPOLIA_RPC_URL: z.string().url().default("https://sepolia.base.org"),
  // PUBLIC, browser-safe (no key). Used by client-side viem clients; safe in the network tab.
  BASE_SEPOLIA_PUBLIC_RPC_URL: z.string().url().default("https://sepolia.base.org"),
  BASE_MAINNET_RPC_URL: z.string().url().default("https://mainnet.base.org"),
  BASE_MAINNET_PUBLIC_RPC_URL: z.string().url().default("https://mainnet.base.org"),
  CHAIN_ID: z.coerce.number().int().refine((n) => n === 84532 || n === 8453, {
    message: "CHAIN_ID must be 84532 (Base Sepolia) or 8453 (Base mainnet)",
  }).default(84532),

  // --- Test USDC (discover the current Base Sepolia test token at build time) ---
  USDC_ADDRESS: hexAddress.optional(),

  // --- Market question: will WATCHED_WALLET's USDC balance exceed THRESHOLD by DEADLINE? ---
  WATCHED_WALLET: hexAddress.optional(),
  THRESHOLD_USDC: z.coerce.number().positive().optional(),
  DEADLINE_UNIX: z.coerce.number().int().positive().optional(),

  // --- Keys (fresh throwaway keys) ---
  DEPLOYER_PRIVATE_KEY: privateKey.optional(),
  FUND_MANAGER_PRIVATE_KEY: privateKey.optional(),
  BULL_PRIVATE_KEY: privateKey.optional(),
  BEAR_PRIVATE_KEY: privateKey.optional(),
  RESEARCH_PRIVATE_KEY: privateKey.optional(),

  // --- Reasoning LLM (free / cheap, OpenAI-compatible — NOT track-scored) ---
  LLM_PROVIDER: z.string().default("groq"),
  LLM_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  LLM_API_KEY: z.string().min(1).optional(),
  LLM_MODEL: z.string().default("llama-3.3-70b-versatile"),

  // --- PIVOT: solvency/liquidation-risk oracle — position + signal/resolution config ---
  // SIGNAL_RPC_URL reads position P's real Aave signals on mainnet; DEMO_CHAIN_RPC_URL reads the
  // Chainlink feed + market on the demo chain (Base Sepolia).
  SIGNAL_RPC_URL: z.string().url().default("https://ethereum-rpc.publicnode.com"),
  DEMO_CHAIN_RPC_URL: z.string().url().default("https://sepolia.base.org"),
  POSITION_ADDRESS: hexAddress.optional(), // mainnet Aave v3 borrower P
  AAVE_POOL_ADDRESS: hexAddress.optional(), // Aave v3 Pool on P's chain
  COLLATERAL_TOKEN: hexAddress.optional(), // P's collateral (its price triggers liquidation)
  PRICE_FEED_ADDRESS: hexAddress.optional(), // Chainlink collateral/USD feed on the demo chain
  SEQUENCER_UPTIME_FEED: hexAddress.optional(), // Chainlink L2 sequencer feed (none on Base Sepolia)

  // --- 1Shot relayer ---
  ONESHOT_RELAYER_URL: z.string().url().default("https://relayer.1shotapi.com/relayers"),
  WEBHOOK_PUBLIC_URL: z.string().url().optional(),
  WEBHOOK_PORT: z.coerce.number().int().positive().default(8787),

  // --- x402 ---
  // ERC-7710 delegation settlement runs through MetaMask's facilitator (tx-sentinel), NOT the
  // stock x402.org facilitator (which only does EIP-3009/permit2). Network-specific URL.
  X402_FACILITATOR_URL: z
    .string()
    .url()
    .default("https://tx-sentinel-base-sepolia.api.cx.metamask.io/platform/v2/x402"),

  // --- Deployed contract ---
  MARKET_ADDRESS: hexAddress.optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Treat empty-string env vars (e.g. `WATCHED_WALLET=` in .env) as absent, so `.optional()`
  // fields fall through to undefined / their default instead of failing format validation.
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value !== "") cleaned[key] = value;
  }
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

/**
 * Assert that the given env keys are present (non-undefined). Use at the top of a script that
 * needs specific secrets, so it fails with a clear message instead of a downstream null deref.
 */
export function requireEnv<K extends keyof Env>(keys: readonly K[]): {
  [P in K]: NonNullable<Env[P]>;
} {
  const missing = keys.filter((k) => env[k] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Copy .env.example to .env and fill them in.`,
    );
  }
  return env as { [P in K]: NonNullable<Env[P]> };
}
