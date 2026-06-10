import { baseSepolia, base } from "viem/chains";
import type { Chain } from "viem";
import { env } from "./env.ts";

/**
 * Chain + token configuration.
 *
 * IMPORTANT: this file deliberately does NOT contain 1Shot relayer payment tokens, the
 * `feeCollector`, or `targetAddress`. Those are discovered at runtime from
 * `relayer_getCapabilities` (see CONSOLIUM_BUILD.MD §8) and must never be hardcoded.
 * The same goes for Venice model ids — fetch the live list. The only token address here is
 * USDC, supplied via env after confirming the current test token from Circle's faucet.
 */

export const SUPPORTED_CHAIN_IDS = [84532, 8453] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

interface ChainConfig {
  readonly chainId: SupportedChainId;
  readonly chain: Chain;
  /** RPC endpoint for viem clients. */
  readonly rpcUrl: string;
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
    caip2: "eip155:84532",
    explorerUrl: "https://sepolia.basescan.org",
    isTestnet: true,
  },
  8453: {
    chainId: 8453,
    chain: base,
    rpcUrl: env.BASE_MAINNET_RPC_URL,
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
