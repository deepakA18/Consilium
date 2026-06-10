/**
 * Agents package entry. Actors and servers are added per CONSOLIUM_BUILD.MD §5–§9.
 * For now this re-exports shared config so cross-package resolution is verified in Step 1.
 */
export { env, activeChain, getChainConfig } from "@consilium/shared";
