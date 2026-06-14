import { parseUnits, formatUnits, decodeEventLog, getAddress, zeroAddress, type Address } from "viem";
import {
  env,
  requireEnv,
  txUrl,
  USDC_DECIMALS,
  consiliumMarketAbi,
  consiliumMarketFactoryAbi,
  type RoundEvent,
  type RoundEventHandler,
  type Side,
} from "@consilium/shared";
import { type Delegation } from "@metamask/smart-accounts-kit";
import { makeSmartAccount, makeWalletClient, publicClient, type ConsiliumSmartAccount } from "./smartAccount.ts";
import { buildErc20Delegation, signDelegation, isChainedTo, extractErc20MaxAmount, usdc as usdcUnits } from "./delegation.ts";
import { llmJSON } from "./llm.ts";
import { buildResearchApp, SIGNALS, type SignalTier } from "./researchServer.ts";
import { aaveAccountData, priceHeadroom } from "./rpc.ts";
import { makeBuyerFetch } from "./buyerClient.ts";
import { relayStake } from "./relayStake.ts";
import { pollUntilTerminal, STATUS_LABEL } from "./oneshot.ts";

/**
 * Round orchestrator (CONSOLIUM_BUILD.MD §9). One full, all-real solvency round:
 *  1. read position P's live risk (Aave HF + headroom) and the live Chainlink price
 *  2. create a fresh price-cross market via the factory (short deadline so it resolves on camera)
 *  3. human → fund-manager → bull/bear redelegation (A2A; signed, cap-attenuated)
 *  4. each trader buys the 3 tiered P-risk signals via x402 (real USDC), reasons via LLM, stakes via 1Shot
 *  5. poke the market against the live feed, then resolve(); winners claim()
 * Every step emits a typed RoundEvent carrying a real tx hash / task id.
 *
 * The demo seam is stated openly (§0): for a live round we set a NEAR-MONEY strike off the live
 * price so a real ETH tick resolves within the window. In production the strike is P's TRUE
 * liquidation price (~25% away) — emitted as `realLiquidationPriceUsd` so the UI shows the real risk.
 *   STRIKE_MODE = demo-liquidatable (default) | demo-safe | real
 */

/** Distributive Omit so each union member keeps its own keys (plain Omit collapses to common keys). */
type EventInput = RoundEvent extends infer E ? (E extends RoundEvent ? Omit<E, "ts"> : never) : never;

const ROUND_SECONDS = Number(process.env.ROUND_SECONDS ?? 120);
const POKE_INTERVAL_MS = Number(process.env.POKE_INTERVAL_MS ?? 25_000);
const STRIKE_MODE = (process.env.STRIKE_MODE ?? "demo-liquidatable") as "demo-liquidatable" | "demo-safe" | "real";
const RESEARCH_PORT = 4500;
const HUMAN_BUDGET = 100; // whole USDC, root grant
const TRADER_CAP = 20; // whole USDC, per trader
const DOWN = 0; // price ≤ strike → LIQUIDATABLE (YES)

const fmtUsdc = (atoms: bigint) => formatUnits(atoms, USDC_DECIMALS);
const fmtPrice = (atoms8: bigint) => (Number(atoms8) / 1e8).toFixed(2); // 8-dp Chainlink → USD string
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Trader {
  role: "bull" | "bear";
  side: Side;
  sideNum: number; // 1 YES, 0 NO
  account: ConsiliumSmartAccount;
  pk: `0x${string}`;
}

/** Short human summary of a freshly-bought signal payload, for the evidence timeline. */
function summarizeSignal(tier: SignalTier, data: Record<string, unknown>): string {
  switch (tier) {
    case "health":
      return `HF ${Number(data.healthFactor).toFixed(3)} · col $${Math.round(Number(data.collateralUsd)).toLocaleString()} / debt $${Math.round(Number(data.debtUsd)).toLocaleString()}`;
    case "headroom":
      return `liq $${Number(data.liquidationPrice).toFixed(0)} · headroom ${Number(data.headroomPct).toFixed(1)}%`;
    case "liquidity":
      return `${Number(data.wethDepth).toFixed(0)} WETH / $${Math.round(Number(data.usdcDepth)).toLocaleString()}`;
  }
}

/** The market's liquidation strike (8-dp int256), derived from the live price per STRIKE_MODE. */
function computeStrike(liveAtoms8: bigint, realLiqUsd: number): bigint {
  switch (STRIKE_MODE) {
    case "demo-liquidatable":
      return (liveAtoms8 * 10_020n) / 10_000n; // 0.2% ABOVE live → price already ≤ strike → resolves YES on a real read
    case "demo-safe":
      return (liveAtoms8 * 9_500n) / 10_000n; // 5% below live → won't cross in window → resolves NO
    case "real":
      return BigInt(Math.round(realLiqUsd * 1e8)); // P's true liquidation price (~25% away)
  }
}

/** Optional inputs for a round. `humanRoot` is a wallet-signed root grant (the connected judge);
 *  when absent, the demo human (DEPLOYER) signs the root so the round still runs unattended. */
export interface RoundOptions {
  humanRoot?: Delegation;
}

export async function runRound(onEvent: RoundEventHandler, opts: RoundOptions = {}): Promise<void> {
  const keys = requireEnv([
    "DEPLOYER_PRIVATE_KEY",
    "FUND_MANAGER_PRIVATE_KEY",
    "BULL_PRIVATE_KEY",
    "BEAR_PRIVATE_KEY",
    "RESEARCH_PRIVATE_KEY",
    "USDC_ADDRESS",
    "POSITION_ADDRESS",
    "COLLATERAL_TOKEN",
    "PRICE_FEED_ADDRESS",
  ]);
  const usdc = getAddress(keys.USDC_ADDRESS);
  const now = () => Math.floor(Date.now() / 1000);
  const emit = (e: EventInput) => onEvent({ ...e, ts: now() } as RoundEvent);

  // Actors
  const fundManager = await makeSmartAccount(keys.FUND_MANAGER_PRIVATE_KEY as `0x${string}`);
  const bull = await makeSmartAccount(keys.BULL_PRIVATE_KEY as `0x${string}`);
  const bear = await makeSmartAccount(keys.BEAR_PRIVATE_KEY as `0x${string}`);

  const deployerWallet = makeWalletClient(keys.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const factory = (await Bun.file(`${import.meta.dir}/../../contracts/deployments/84532.json`).json()).factory as Address;

  // --- 1. Read P's live risk + the live price; derive the market strike ---
  const health = await aaveAccountData();
  const headroom = await priceHeadroom();
  const liveAtoms8 = BigInt(Math.round(headroom.currentEthPrice * 1e8));
  const strike = computeStrike(liveAtoms8, headroom.liquidationPrice);
  const deadline = now() + ROUND_SECONDS;

  const priceFeed = getAddress(keys.PRICE_FEED_ADDRESS);
  const sequencerFeed = env.SEQUENCER_UPTIME_FEED ? getAddress(env.SEQUENCER_UPTIME_FEED) : zeroAddress;
  const positionRef = {
    position: getAddress(keys.POSITION_ADDRESS),
    collateral: getAddress(keys.COLLATERAL_TOKEN),
    liqThresholdBps: Math.round(health.liqThresholdPct * 100),
    sourceChainId: 1n,
  } as const;

  // --- 2. Fresh price-cross market via the factory ---
  const createHash = await deployerWallet.writeContract({
    address: factory,
    abi: consiliumMarketFactoryAbi,
    functionName: "createMarket",
    args: [usdc, priceFeed, sequencerFeed, strike, DOWN, BigInt(deadline), positionRef],
  });
  const createRcpt = await publicClient.waitForTransactionReceipt({ hash: createHash });
  let market: Address | undefined;
  for (const log of createRcpt.logs) {
    try {
      const ev = decodeEventLog({ abi: consiliumMarketFactoryAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "MarketCreated") market = (ev.args as { market: Address }).market;
    } catch {
      /* not our event */
    }
  }
  if (!market) throw new Error("could not find MarketCreated in factory receipt");
  const roundId = market;

  emit({
    kind: "round:start",
    roundId,
    market,
    factory,
    question: {
      position: positionRef.position,
      collateral: positionRef.collateral,
      currentPriceUsd: headroom.currentEthPrice.toFixed(2),
      strikePriceUsd: fmtPrice(strike),
      realLiquidationPriceUsd: headroom.liquidationPrice.toFixed(2),
      healthFactor: health.healthFactor.toFixed(4),
      headroomPct: headroom.headroomPct.toFixed(2),
      direction: "DOWN",
      deadlineUnix: deadline,
    },
  });

  // --- 3. Redelegation chain: human → fund-manager → bull/bear (A2A, cap-attenuated) ---
  // The root grant is signed by the connected wallet (the judge) when supplied; otherwise the demo
  // human (DEPLOYER) signs it so the round still runs unattended.
  let root: Delegation;
  if (opts.humanRoot) {
    root = opts.humanRoot;
  } else {
    const human = await makeSmartAccount(keys.DEPLOYER_PRIVATE_KEY as `0x${string}`);
    root = await signDelegation(
      human,
      buildErc20Delegation({ from: human, to: fundManager.address, tokenAddress: usdc, maxAmount: usdcUnits(HUMAN_BUDGET) }),
    );
  }

  // Scale each trader's cap to the granted budget (split across the 2 traders, capped at TRADER_CAP),
  // so the redelegations always attenuate correctly even for a small grant.
  const budgetWhole = (() => {
    try {
      return Number(extractErc20MaxAmount(root, usdc)) / 1e6;
    } catch {
      return HUMAN_BUDGET;
    }
  })();
  const traderCap = Math.max(1, Math.min(TRADER_CAP, Math.floor(budgetWhole / 2)));

  for (const [role, to] of [
    ["bull", bull.address],
    ["bear", bear.address],
  ] as const) {
    const redel = await signDelegation(
      fundManager,
      buildErc20Delegation({
        from: fundManager,
        to,
        tokenAddress: usdc,
        maxAmount: usdcUnits(traderCap),
        parentDelegation: root,
      }),
    );
    emit({
      kind: "delegation:granted",
      from: "fundManager",
      to: role,
      capUsdc: String(traderCap),
      authorityChained: isChainedTo(redel, root),
    });
  }

  // --- 4. Research seller up; traders buy the 3 tiered signals, reason, and stake ---
  const { app } = buildResearchApp();
  const server = app.listen(RESEARCH_PORT);
  await new Promise<void>((res) => server.once("listening", () => res()));

  const traders: Trader[] = [
    { role: "bull", side: "YES", sideNum: 1, account: bull, pk: keys.BULL_PRIVATE_KEY as `0x${string}` },
    { role: "bear", side: "NO", sideNum: 0, account: bear, pk: keys.BEAR_PRIVATE_KEY as `0x${string}` },
  ];

  let evidenceCumulative = 0;
  try {
    for (const t of traders) {
      const fetchWithPayment = makeBuyerFetch(t.account);
      const signals: Record<string, Record<string, unknown>> = {};

      // Buy one tiered signal via x402 (real settled USDC) and emit it.
      const buySignal = async (tier: SignalTier) => {
        const sig = SIGNALS[tier];
        const res = await fetchWithPayment(`http://localhost:${RESEARCH_PORT}${sig.path}`, { method: "GET" });
        const body = (await res.json()) as { tier: string; data: Record<string, unknown> };
        signals[tier] = body.data;
        evidenceCumulative += Number(sig.price.replace("$", ""));
        let evTxHash: string | undefined;
        try {
          const pr = res.headers.get("PAYMENT-RESPONSE");
          if (pr) evTxHash = (JSON.parse(Buffer.from(pr, "base64").toString()) as { transaction?: string }).transaction;
        } catch {
          /* header optional */
        }
        emit({
          kind: "evidence:purchased",
          agent: t.role,
          tier,
          priceUsdc: sig.price.replace("$", ""),
          summary: summarizeSignal(tier, body.data),
          cumulativeUsdc: evidenceCumulative.toFixed(2),
          txHash: evTxHash,
        });
      };

      // 4a. Always buy the cheapest base signal (health).
      await buySignal("health");

      // 4b. Triage on the cheap signal: the agent itself decides how much MORE paid evidence to buy
      //     and its stake size. Buying deeper, costlier signals AND a larger stake is the costly
      //     confidence signal (§6.1) — a hesitant agent saves the money and stakes small.
      let buyHeadroom = true;
      let buyLiquidity = false;
      let sizeWhole = 5;
      let rationale = "default size (LLM unavailable)";
      try {
        const d = await llmJSON<{ buyHeadroom: boolean; buyLiquidity: boolean; sizeUsdc: number; rationale: string }>({
          messages: [
            {
              role: "system",
              content:
                "You are an adversarial DeFi liquidation-risk trader on a limited budget. You already bought the cheap " +
                "health signal. Decide how much MORE paid evidence to buy (headroom $0.05, liquidity $0.10) and your stake. " +
                `Reply ONLY as JSON {"buyHeadroom":boolean,"buyLiquidity":boolean,"sizeUsdc":number,"rationale":string}. ` +
                `sizeUsdc is a whole number 1..${traderCap}. Buying deeper evidence and staking more signals higher ` +
                "conviction; if your view is already clear from the health signal, save the money and stake small.",
            },
            {
              role: "user",
              content:
                `Question: will Aave position P become LIQUIDATABLE by the deadline — collateral price crosses the liquidation strike $${fmtPrice(strike)} (DOWN)? ` +
                `Live price $${headroom.currentEthPrice.toFixed(2)}. Health signal you bought: ${JSON.stringify(signals.health)}. ` +
                `Your assigned stance is ${t.side === "YES" ? "YES (LIQUIDATABLE)" : "NO (SAFE)"}.`,
            },
          ],
          temperature: 0.6,
          maxTokens: 240,
        });
        buyHeadroom = !!d.buyHeadroom;
        buyLiquidity = !!d.buyLiquidity;
        sizeWhole = Math.max(1, Math.min(traderCap, Math.round(d.sizeUsdc)));
        rationale = d.rationale;
      } catch {
        /* keep defaults */
      }

      // 4c. Buy the escalated tiers the agent chose to pay for.
      if (buyHeadroom) await buySignal("headroom");
      if (buyLiquidity) await buySignal("liquidity");

      emit({ kind: "agent:decision", agent: t.role, stance: t.side, sizeUsdc: String(sizeWhole), rationale });

      // 4c. Stake via the 1Shot relayer (gas in USDC, no ETH).
      const amountAtoms = parseUnits(String(sizeWhole), USDC_DECIMALS);
      const { taskId } = await relayStake({ trader: t.account, market, side: t.sideNum, stakeAmount: amountAtoms });
      emit({ kind: "stake:submitted", agent: t.role, side: t.side, amountUsdc: String(sizeWhole), taskId });

      const final = await pollUntilTerminal(taskId);
      if (final.status === 200) {
        const hash = final.receipt?.transactionHash ?? final.hash!;
        emit({ kind: "stake:confirmed", agent: t.role, side: t.side, amountUsdc: String(sizeWhole), txHash: hash });
      } else {
        emit({ kind: "stake:reverted", agent: t.role, reason: `${STATUS_LABEL[final.status]}: ${final.message ?? ""}` });
      }
    }
  } finally {
    server.close();
  }

  // --- 5. Poke the market against the live feed; latch a cross, then resolve ---
  let crossed = false;
  for (let i = 0; i < 8 && now() < deadline && !crossed; i++) {
    try {
      const pokeHash = await deployerWallet.writeContract({ address: market, abi: consiliumMarketAbi, functionName: "poke" });
      const rcpt = await publicClient.waitForTransactionReceipt({ hash: pokeHash });
      let priceRead = 0n;
      for (const log of rcpt.logs) {
        try {
          const ev = decodeEventLog({ abi: consiliumMarketAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "Poked") {
            priceRead = (ev.args as { price: bigint }).price;
            crossed = (ev.args as { crossed: boolean }).crossed;
          }
        } catch {
          /* not the Poked event */
        }
      }
      emit({ kind: "price:poked", priceUsd: fmtPrice(priceRead), crossed, txHash: pokeHash });
    } catch {
      break; // poke reverts once the deadline passes (MarketClosed) — fall through to resolve
    }
    if (!crossed && now() < deadline) await sleep(POKE_INTERVAL_MS);
  }

  // resolve() needs (deadline passed || crossed). A load-balanced RPC can simulate the resolve
  // against a replica that hasn't yet seen the latching poke (read-after-write lag) → spurious
  // MarketNotClosed. So first confirm the precondition is visible on this RPC, then retry the send.
  if (crossed) {
    for (let i = 0; i < 12; i++) {
      const c = (await publicClient.readContract({ address: market, abi: consiliumMarketAbi, functionName: "crossed" })) as boolean;
      if (c) break;
      await sleep(1500);
    }
  } else {
    await sleep(Math.max(0, (deadline - now()) * 1000) + 3000);
  }

  let resolveHash: `0x${string}` | undefined;
  for (let i = 0; i < 6; i++) {
    try {
      resolveHash = await deployerWallet.writeContract({ address: market, abi: consiliumMarketAbi, functionName: "resolve" });
      break;
    } catch (err) {
      if (i === 5) throw err;
      await sleep(2500); // replica catching up to the latched poke / deadline
    }
  }
  await publicClient.waitForTransactionReceipt({ hash: resolveHash! });

  // A load-balanced RPC can serve a stale replica right after the tx mines (read-after-write
  // lag), so poll resolved() before trusting outcome/observedPrice.
  let resolved = false;
  for (let i = 0; i < 12 && !resolved; i++) {
    resolved = (await publicClient.readContract({ address: market, abi: consiliumMarketAbi, functionName: "resolved" })) as boolean;
    if (!resolved) await sleep(1500);
  }
  const [outcomeNum, observed] = (await Promise.all([
    publicClient.readContract({ address: market, abi: consiliumMarketAbi, functionName: "outcome" }),
    publicClient.readContract({ address: market, abi: consiliumMarketAbi, functionName: "observedPrice" }),
  ])) as [number, bigint];
  const outcome: Side = outcomeNum === 1 ? "YES" : "NO";
  emit({
    kind: "resolved",
    outcome,
    observedPriceUsd: fmtPrice(observed),
    strikePriceUsd: fmtPrice(strike),
    txHash: resolveHash!,
  });

  // --- 6. Winners claim ---
  for (const t of traders) {
    if (t.side !== outcome) continue;
    const claimable = (await publicClient.readContract({
      address: market,
      abi: consiliumMarketAbi,
      functionName: "claimable",
      args: [t.account.address],
    })) as bigint;
    if (claimable === 0n) continue;
    const claimHash = await makeWalletClient(t.pk).writeContract({
      address: market,
      abi: consiliumMarketAbi,
      functionName: "claim",
    });
    await publicClient.waitForTransactionReceipt({ hash: claimHash });
    emit({ kind: "claimed", agent: t.role, amountUsdc: fmtUsdc(claimable), txHash: claimHash });
  }

  emit({ kind: "round:end", roundId });
}

// --- CLI ---
if (import.meta.main) {
  const label: Record<RoundEvent["kind"], string> = {
    "round:start": "🟢 round start",
    "delegation:granted": "🔗 delegation",
    "evidence:purchased": "🔍 evidence",
    "agent:decision": "🧠 decision",
    "stake:submitted": "📤 stake submitted",
    "stake:confirmed": "✅ stake confirmed",
    "stake:reverted": "⛔ stake reverted",
    "price:poked": "📈 price poked",
    resolved: "⚖️  resolved",
    claimed: "💰 claimed",
    "round:end": "🏁 round end",
  };
  await runRound((e) => {
    const detail = JSON.stringify(
      Object.fromEntries(Object.entries(e).filter(([k]) => !["kind", "ts"].includes(k))),
    );
    const hash = "txHash" in e && e.txHash ? `\n     ${txUrl(e.txHash)}` : "";
    console.log(`${label[e.kind].padEnd(20)} ${detail}${hash}`);
  });
  void env;
}
