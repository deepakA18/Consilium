import express, { type Request, type Response } from "express";
import cors from "cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { x402ExactEvmErc7710ServerScheme } from "@metamask/x402";
import { formatUnits, getAddress, type Address } from "viem";
import { env, activeChain, consiliumMarketAbi, USDC_DECIMALS } from "@consilium/shared";
import { publicClient } from "./smartAccount.ts";
import { resolvePayTo } from "./researchServer.ts";

/**
 * Consumer read endpoint (CONSOLIUM_BUILD.MD §6.5) — the product's revenue surface.
 *
 * A liquidator bot / risk dashboard pays a micropayment (x402 + ERC-7710) to read the oracle's live
 * output for a market: the capital-weighted probability of liquidation, and (once settled) the
 * outcome. Every field is a real on-chain read of the ConsiliumMarket contract — the same number the
 * dashboard publishes, sold as a priced information good.
 *
 *   GET /oracle/:marketId   $0.01 per read, settled to the oracle operator
 */

const ORACLE_PRICE = process.env.ORACLE_PRICE ?? "$0.01";

export interface OracleReading {
  market: Address;
  pLiquidation: number | null; // capital-weighted YES / (YES+NO); null if no stake yet
  yesPotUsdc: number;
  noPotUsdc: number;
  potUsdc: number;
  resolved: boolean;
  outcome: "LIQUIDATABLE" | "SAFE" | null;
  observedPriceUsd: number | null;
  strikePriceUsd: number;
  deadlineUnix: number;
  asOf: string;
}

/** Read the live oracle output for a market straight from the contract. */
export async function readOracle(market: Address): Promise<OracleReading> {
  const m = { address: market, abi: consiliumMarketAbi } as const;
  const [yes, no, resolved, outcome, observed, strike, deadline] = await Promise.all([
    publicClient.readContract({ ...m, functionName: "totalStaked", args: [1] }),
    publicClient.readContract({ ...m, functionName: "totalStaked", args: [0] }),
    publicClient.readContract({ ...m, functionName: "resolved" }),
    publicClient.readContract({ ...m, functionName: "outcome" }),
    publicClient.readContract({ ...m, functionName: "observedPrice" }),
    publicClient.readContract({ ...m, functionName: "liquidationPrice" }),
    publicClient.readContract({ ...m, functionName: "deadline" }),
  ]);

  const yesPotUsdc = Number(formatUnits(yes, USDC_DECIMALS));
  const noPotUsdc = Number(formatUnits(no, USDC_DECIMALS));
  const pot = yes + no;

  return {
    market,
    pLiquidation: pot > 0n ? Number((Number(yes) / Number(pot)).toFixed(4)) : null,
    yesPotUsdc,
    noPotUsdc,
    potUsdc: yesPotUsdc + noPotUsdc,
    resolved,
    outcome: resolved ? (outcome === 1 ? "LIQUIDATABLE" : "SAFE") : null,
    observedPriceUsd: observed > 0n ? Number(observed) / 1e8 : null,
    strikePriceUsd: Number(strike) / 1e8,
    deadlineUnix: Number(deadline),
    asOf: new Date().toISOString(),
  };
}

export interface OracleServerConfig {
  /** Who receives the read fee. Defaults to RESEARCH_PRIVATE_KEY's address (the oracle operator). */
  payTo?: Address;
  price?: string;
}

/** Build the x402-gated oracle read app (mountable on the hub or run standalone). */
export function buildOracleApp(config: OracleServerConfig = {}) {
  const payTo = config.payTo ?? resolvePayTo();
  const price = config.price ?? ORACLE_PRICE;

  const facilitatorClient = new HTTPFacilitatorClient({ url: env.X402_FACILITATOR_URL });
  const server = new x402ResourceServer(facilitatorClient).register(activeChain.caip2, new x402ExactEvmErc7710ServerScheme());

  const app = express();
  app.use(cors({ exposedHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"] }));
  app.use(
    paymentMiddleware(
      {
        "GET /oracle/:marketId": {
          accepts: [{ scheme: "exact", price, network: activeChain.caip2, payTo, extra: { assetTransferMethod: "erc7710" } }],
          description: "Live liquidation probability for a Consilium market (on-chain read)",
          mimeType: "application/json",
        },
      },
      server,
    ),
  );

  // Premium product — only reached after payment is verified by the middleware.
  app.get("/oracle/:marketId", async (req: Request, res: Response) => {
    try {
      const reading = await readOracle(getAddress(String(req.params.marketId)));
      res.json(reading);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return { app, payTo, price };
}
