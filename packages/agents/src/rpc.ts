import { createPublicClient, http, formatUnits, getAddress, type Address } from "viem";
import { mainnet, baseSepolia } from "viem/chains";
import { env, requireEnv } from "@consilium/shared";

/**
 * The sold risk signals (CONSOLIUM_BUILD.MD §7.2) — real onchain reads about position P, the
 * research agent's tiered x402 products. Signals read MAINNET P; the ETH price comes from the same
 * Chainlink feed the market resolves against (demo chain). Both are genuine onchain reads.
 */

// Reads P's Aave signals on mainnet.
const signalClient = createPublicClient({ chain: mainnet, transport: http(env.SIGNAL_RPC_URL) });
// Reads the Chainlink ETH/USD feed on the demo chain (same feed the contract resolves against).
const demoClient = createPublicClient({ chain: baseSepolia, transport: http(env.DEMO_CHAIN_RPC_URL) });

const POOL_ABI = [
  {
    type: "function",
    name: "getUserAccountData",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;

const AGG_ABI = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

const ERC20_BAL = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// Mainnet exit-liquidity venue: Uniswap v3 WETH/USDC 0.05% pool (deepest ETH/USD venue).
const UNIV3_WETH_USDC = getAddress("0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640");
const MAINNET_WETH = getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
const MAINNET_USDC = getAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");

export interface HealthSignal {
  position: Address;
  healthFactor: number;
  collateralUsd: number;
  debtUsd: number;
  availableBorrowsUsd: number;
  liqThresholdPct: number; // e.g. 83
  ltvPct: number;
}

export interface HeadroomSignal {
  currentEthPrice: number;
  liquidationPrice: number; // ETH price at which P becomes liquidatable
  headroomPct: number; // % the collateral must fall to liquidate
  healthFactor: number;
  feedUpdatedAt: number;
}

export interface LiquiditySignal {
  pool: Address;
  wethDepth: number;
  usdcDepth: number;
  note: string;
}

function position(p?: Address): Address {
  const P = p ?? env.POSITION_ADDRESS;
  if (!P) throw new Error("POSITION_ADDRESS not set");
  return getAddress(P);
}

/** (a) Aave v3 health factor + composition — the headline signal. */
export async function aaveAccountData(p?: Address): Promise<HealthSignal> {
  const { AAVE_POOL_ADDRESS } = requireEnv(["AAVE_POOL_ADDRESS"]);
  const P = position(p);
  const d = await signalClient.readContract({
    address: getAddress(AAVE_POOL_ADDRESS),
    abi: POOL_ABI,
    functionName: "getUserAccountData",
    args: [P],
  });
  return {
    position: P,
    healthFactor: Number(d[5]) / 1e18,
    collateralUsd: Number(d[0]) / 1e8,
    debtUsd: Number(d[1]) / 1e8,
    availableBorrowsUsd: Number(d[2]) / 1e8,
    liqThresholdPct: Number(d[3]) / 100,
    ltvPct: Number(d[4]) / 100,
  };
}

/** Current ETH/USD from the Chainlink feed the market resolves against. */
export async function ethPrice(): Promise<{ price: number; updatedAt: number }> {
  const { PRICE_FEED_ADDRESS } = requireEnv(["PRICE_FEED_ADDRESS"]);
  const d = await demoClient.readContract({
    address: getAddress(PRICE_FEED_ADDRESS),
    abi: AGG_ABI,
    functionName: "latestRoundData",
  });
  return { price: Number(d[1]) / 1e8, updatedAt: Number(d[3]) };
}

/**
 * (b) Price headroom — the dynamic risk signal. For a single-collateral (WETH) position the
 * first-order liquidation price is `currentPrice / HF` (HF = collateral·liqThr/debt; at HF=1 the
 * collateral USD must fall by exactly the current HF factor). Honest + simple; shown in the UI.
 */
export async function priceHeadroom(p?: Address): Promise<HeadroomSignal> {
  const h = await aaveAccountData(p);
  const { price, updatedAt } = await ethPrice();
  const liquidationPrice = h.healthFactor > 0 ? price / h.healthFactor : 0;
  const headroomPct = h.healthFactor > 0 ? (1 - 1 / h.healthFactor) * 100 : 0;
  return { currentEthPrice: price, liquidationPrice, headroomPct, healthFactor: h.healthFactor, feedUpdatedAt: updatedAt };
}

/** (c) Exit liquidity — deepest signal. Balances in the deepest ETH/USD venue (can a liquidation clear?). */
export async function dexDepth(): Promise<LiquiditySignal> {
  const [weth, usdc] = await Promise.all([
    signalClient.readContract({ address: MAINNET_WETH, abi: ERC20_BAL, functionName: "balanceOf", args: [UNIV3_WETH_USDC] }),
    signalClient.readContract({ address: MAINNET_USDC, abi: ERC20_BAL, functionName: "balanceOf", args: [UNIV3_WETH_USDC] }),
  ]);
  return {
    pool: UNIV3_WETH_USDC,
    wethDepth: Number(formatUnits(weth, 18)),
    usdcDepth: Number(formatUnits(usdc, 6)),
    note: "Uniswap v3 WETH/USDC 0.05% pool balances (exit-liquidity proxy)",
  };
}
