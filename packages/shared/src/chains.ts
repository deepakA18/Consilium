import { baseSepolia, base } from "viem/chains";
import type { Chain } from "viem";
import { env } from "./env.ts";

/**
 * Chain + token configuration.
 *
 * IMPORTANT: this file deliberately does NOT contain 1Shot relayer payment tokens, the
 * `feeCollector`, or `targetAddress`. Those are discovered at runtime from
 * `relayer_getCapabilities` (see CONSOLIUM_BUILD.MD §8) and must never be hardcoded.
 * The same goes for the reasoning LLM model id — keep it in env, verify a current one at build
 * time. The only token address here is USDC, supplied via env after confirming the current test
 * token from Circle's faucet.
 */

export const SUPPORTED_CHAIN_IDS = [84532, 8453] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

interface ChainConfig {
  readonly chainId: SupportedChainId;
  readonly chain: Chain;
  /**
   * PRIVATE server-side RPC (may carry an API key). NEVER read this from browser code —
   * use `publicRpcUrl`, or call `getServerRpcUrl()` which throws if invoked in a browser.
   */
  readonly rpcUrl: string;
  /** PUBLIC, browser-safe RPC (no key). Safe to use client-side / show in the network tab. */
  readonly publicRpcUrl: string;
  /** CAIP-2 network id used by x402 (e.g. "eip155:84532"). */
  readonly caip2: `eip155:${number}`;
  /** Block explorer base for building tx links in the UI. */
  readonly explorerUrl: string;
  /** Whether this is a testnet (core dev) or the mainnet (1Shot track run). */
  readonly isTestnet: boolean;
}

const CHAINS: Record<SupportedChainId, ChainConfig> = {
  84532: {
    chainId: 84532,
    chain: baseSepolia,
    rpcUrl: env.BASE_SEPOLIA_RPC_URL,
    publicRpcUrl: env.BASE_SEPOLIA_PUBLIC_RPC_URL,
    caip2: "eip155:84532",
    explorerUrl: "https://sepolia.basescan.org",
    isTestnet: true,
  },
  8453: {
    chainId: 8453,
    chain: base,
    rpcUrl: env.BASE_MAINNET_RPC_URL,
    publicRpcUrl: env.BASE_MAINNET_PUBLIC_RPC_URL,
    caip2: "eip155:8453",
    explorerUrl: "https://basescan.org",
    isTestnet: false,
  },
};

export function getChainConfig(chainId: SupportedChainId = env.CHAIN_ID as SupportedChainId): ChainConfig {
  const cfg = CHAINS[chainId];
  if (!cfg) {
    throw new Error(`Unsupported chain id ${chainId}. Supported: ${SUPPORTED_CHAIN_IDS.join(", ")}`);
  }
  return cfg;
}

/** The chain selected by CHAIN_ID in the environment. */
export const activeChain: ChainConfig = getChainConfig();

/**
 * Return the PRIVATE server RPC URL, throwing if called in a browser context. This is the
 * structural guard against leaking a keyed RPC into the client bundle / network tab / console:
 * server code (agents, webhook server, Next.js route handlers & server components) calls this;
 * client code physically cannot (it throws), and must use `publicRpcUrl` instead.
 */
export function getServerRpcUrl(
  chainId: SupportedChainId = env.CHAIN_ID as SupportedChainId,
): string {
  if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
    throw new Error(
      "getServerRpcUrl() was called in a browser context. The private (keyed) RPC must never " +
        "reach the client. Use activeChain.publicRpcUrl or proxy reads through a server route.",
    );
  }
  return getChainConfig(chainId).rpcUrl;
}

/** USDC decimals — Circle USDC is always 6 decimals on Base. */
export const USDC_DECIMALS = 6 as const;

/** Build an explorer link for a tx hash on the active (or given) chain. */
export function txUrl(hash: string, chainId: SupportedChainId = env.CHAIN_ID as SupportedChainId): string {
  return `${getChainConfig(chainId).explorerUrl}/tx/${hash}`;
}

/** Build an explorer link for an address on the active (or given) chain. */
export function addressUrl(address: string, chainId: SupportedChainId = env.CHAIN_ID as SupportedChainId): string {
  return `${getChainConfig(chainId).explorerUrl}/address/${address}`;
}
