import express, { type Request, type Response } from "express";
import cors from "cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { x402ExactEvmErc7710ServerScheme } from "@metamask/x402";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import type { Address } from "viem";
import { env, activeChain } from "@consilium/shared";
import { aaveAccountData, priceHeadroom, dexDepth } from "./rpc.ts";

/**
 * x402 research SELLER (CONSOLIUM_BUILD.MD §6.1, §7.2).
 *
 * Sells THREE tiered risk signals about position P — each a real onchain read (rpc.ts) behind an
 * x402-priced route that advertises ERC-7710 as the asset transfer method, so buyers pay by
 * redeeming a delegation. Settlement runs through MetaMask's facilitator (env.X402_FACILITATOR_URL).
 *
 *   /research/health    $0.02  Aave v3 health factor + collateral/debt composition (headline)
 *   /research/headroom   $0.05  liquidation price + % the collateral must fall (dynamic)
 *   /research/liquidity  $0.10  exit-liquidity depth in the deepest ETH/USD venue (deepest)
 *
 * Tiered pricing is what the per-agent cap gates: a Bull/Bear with a tight budget can't buy every
 * tier, so the over-cap revert (§6.4) is the manipulation-resistance proof.
 */

/** The signal catalogue — single source of truth for prices, descriptions, and handlers. */
export const SIGNALS = {
  health: {
    path: "/research/health",
    price: "$0.02",
    description: "Aave v3 health factor + collateral/debt composition for position P (onchain read)",
    handler: () => aaveAccountData(),
  },
  headroom: {
    path: "/research/headroom",
    price: "$0.05",
    description: "Liquidation price + price headroom % for position P (Aave + Chainlink feed read)",
    handler: () => priceHeadroom(),
  },
  liquidity: {
    path: "/research/liquidity",
    price: "$0.10",
    description: "Exit-liquidity depth in the deepest ETH/USD venue (onchain pool balances)",
    handler: () => dexDepth(),
  },
} as const;

export type SignalTier = keyof typeof SIGNALS;

export interface ResearchServerConfig {
  /** Who receives payment. Defaults to RESEARCH_PRIVATE_KEY's address, else an ephemeral one. */
  payTo?: Address;
}

export function resolvePayTo(): Address {
  const pk = (env.RESEARCH_PRIVATE_KEY ?? generatePrivateKey()) as `0x${string}`;
  return privateKeyToAccount(pk).address;
}

export function buildResearchApp(config: ResearchServerConfig = {}) {
  const payTo = config.payTo ?? resolvePayTo();

  const facilitatorClient = new HTTPFacilitatorClient({ url: env.X402_FACILITATOR_URL });
  const server = new x402ResourceServer(facilitatorClient).register(
    activeChain.caip2,
    new x402ExactEvmErc7710ServerScheme(),
  );

  // Build the paymentMiddleware route table from the catalogue: one priced GET per tier, each
  // advertising ERC-7710 settlement.
  const routes: Parameters<typeof paymentMiddleware>[0] = {};
  for (const sig of Object.values(SIGNALS)) {
    routes[`GET ${sig.path}`] = {
      accepts: [
        {
          scheme: "exact",
          price: sig.price,
          network: activeChain.caip2,
          payTo,
          extra: { assetTransferMethod: "erc7710" },
        },
      ],
      description: sig.description,
      mimeType: "application/json",
    };
  }

  const app = express();
  app.use(cors({ exposedHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"] }));
  app.use(paymentMiddleware(routes, server));

  // The premium data products — only reached after payment is verified by the middleware.
  for (const [tier, sig] of Object.entries(SIGNALS)) {
    app.get(sig.path, async (_req: Request, res: Response) => {
      try {
        const data = await sig.handler();
        res.json({ tier, data, ts: Date.now() });
      } catch (err) {
        res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  return { app, payTo, signals: SIGNALS };
}
