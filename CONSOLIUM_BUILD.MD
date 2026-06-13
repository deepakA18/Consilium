# Consilium — Build Spec for Claude Code

> **You (Claude Code) are building this end to end. This file is the source of truth.**
> Read the whole file before writing any code. The API details here were verified against
> live docs in June 2026 — **trust them over your training data**, which is stale for
> `@metamask/smart-accounts-kit` and the 1Shot relayer. When in doubt, fetch the doc URLs cited inline.
>
> **Tooling note (as built):** this repo uses **bun** (workspaces + scripts + TS runtime), not pnpm.
> The local mock token is **`CUSDC` (Consilium USDC)**, not `MockUSDC`. Markets are created through a
> permissionless **`ConsiliumMarketFactory`**. Smart accounts use **EIP-7702** (`Stateless7702`, EOA
> upgraded in place — address == EOA), not Hybrid. x402 ERC-7710 settlement runs through **MetaMask's
> facilitator** (tx-sentinel), not x402.org. RPC config is split into a PRIVATE server endpoint and a
> PUBLIC browser-safe one (§3). Agent reasoning runs on **Venice** (bonus, not pillar). These
> reconciliations are reflected throughout.
>
> **PIVOT status (read this).** v1 was built and proven live against a "watched-wallet USDC balance ≥
> threshold" question. We are pivoting the **question + resolution** to a **solvency/liquidation-risk
> oracle** (§0). What **carries over unchanged** (built + verified live): the delegation chain (3-level,
> 7702), x402 evidence settlement, the 1Shot relayed stake, the over-cap enforcer revert, the push-model
> market + factory, the dashboard shell. What **changes**: the market's *resolution* (Chainlink price
> feed + L2 sequencer guard + `poke()` instead of `balanceOf`), the sold *signals* (Aave HF / price
> headroom / DEX depth instead of a balance read), the round question, and UI copy. Sections below state
> "as built" vs "to rework" per area.

---

## 0. What Consilium is (and why it must be REAL)

Consilium is a **live, agent-run solvency-risk oracle** built as an adversarial prediction market. For a
real onchain lending position, two agents with independently-funded, cryptographically-scoped USDC
budgets take opposite sides of "will this position become liquidatable within window `W`," each **buying
real onchain risk signals** to back its view (paying per call). The market price they produce is a **live,
money-backed probability of liquidation** — a priced information good that downstream consumers (liquidator
bots, risk dashboards, leveraged treasuries, other agents) can pay to read over x402.

**Why this is a real product, not a toy market.** "Will *this specific* borrower position get liquidated in
the next hour" is a narrow, per-position, fast-moving question that no liquid human market ever forms around
— there are millions of such positions. Only cheap, autonomous, capped agents can stand up a liquid
micro-market per position. The cap is *load-bearing for the usefulness*: it bounds how much any single agent
can skew the published number, so confidence is manipulation-resistant up to the agents' bonded stakes. Risk
monitoring is a real line-item protocols pay for; Consilium produces that signal in an agent-native way.

**Why the produced number means something (not confident nonsense).** Agents read genuine, interacting
risk-engine signals from a **real mainnet position** — not vibes:
- current **health factor** + collateral/debt composition (Aave v3 `getUserAccountData`),
- **price headroom**: how far the collateral must fall to hit the liquidation level (liquidation threshold + current price),
- **exit liquidity**: DEX depth for the collateral (can a liquidation clear cleanly or cascade).
Judgment over the *interaction* of these is where an agent adds value — which is exactly why a market
(costly signals) beats a single model's claimed number.

**Competitive principle: radical verifiability.** Everything visible in the demo is a real onchain event a
judge can click through to an explorer. Many submissions describe rich flows but show UI numbers that don't
trace to a transaction; some lean on simulated or "feasibility-probe" integrations. We are the opposite. If
you are ever tempted to hardcode a number, stub a transaction, or render a success state not backed by a real
tx hash — STOP. Every status in the UI must trace to a real Base Sepolia transaction, a real Chainlink feed
read, or a real 1Shot webhook event.

### The two demo money-moments (these win the tracks)
1. **Live adversarial research purchase**: the two agents each pay the research agent real USDC (x402 +
   ERC-7710) for real risk signals on the position. The amount each commits is a *costly confidence signal* —
   a bluffing agent can't afford to look sure. *(As built: x402 settlement is DONE/verified live — §6.2.)*
2. **The revert**: an agent attempts to **stake more than its redelegated budget**. The transaction
   **reverts at the `ERC20TransferAmount` caveat enforcer** with a real failed tx hash — three hops from the
   human signature. No app-code guard rejected it; the chain did. This is the irrefutable proof that the cap
   (and thus the oracle's manipulation-resistance) is structural, not aspirational. *(As built: DONE — §6.4,
   real reverted tx `ERC20TransferAmountEnforcer:allowance-exceeded`.)*

### The resolvable question (THE PIVOT — to rework)
**"Will real position `P`'s collateral price cross its liquidation level within window `W`?"**
(Equivalently: does `P` become liquidatable. A softer variant — "is HF below threshold `H` at deadline `D`"
— is config; the demo uses the liquidation/price-cross form.)
- **Signals (what agents research):** read from `P` on **mainnet** — real HF, collateral/debt, price
  headroom, DEX liquidity. The research agent sells these over x402 (§6.1, §7.2).
- **Resolution (trustless, no oracle ownership):** liquidation is fundamentally a price event. At market open,
  compute `P`'s **liquidation price** once (collateral price at which HF=1, from its liquidation threshold).
  The resolution contract reads the collateral's **Chainlink price feed** (`AggregatorV3Interface.latestRoundData()`)
  and settles YES if it crosses the liquidation level within `W`, else NO. On Base (an L2) the contract **must
  check the L2 Sequencer Uptime feed** before trusting the price (Chainlink requirement). No Aave deploy, no
  oracle puppeteering, real price movement, judge-clickable feed contract.
- **The demo seam, stated openly (do not hide it):** a real mainnet position won't cross its true liquidation
  price during a 3-minute demo. So for the demo round we **tighten `W` and set a near-the-money strike** (a
  level the live collateral price is hovering just above/below) so a *real, naturally-occurring* price tick
  resolves it on camera. Narrate exactly this: "in production, `W` is hours/days and the strike is the
  position's real liquidation price; for this demo we use a tight window and near-the-money strike so you can
  watch it resolve against a real feed." Nothing is puppeteered — the price is real, only the window/strike are
  tightened.

### Downstream consumer (DESIGNED, not built in v1)
The priced probability is meant to be sold over x402 to consumers (liquidator bots, risk dashboards). **We do
not build the consumer in v1** — we specify the read endpoint shape and document the loop (§6.5), same posture
as the custom facilitator. Shows the product loop without doubling x402 surface area.

---

## 1. Tracks targeted & how each is satisfied (keep this map true as you build)

| Track | Requirement | How Consilium satisfies it |
|---|---|---|
| **Best A2A coordination** | redelegation | Human → fund-manager root delegation; fund-manager **redelegates** scoped caps to Bull & Bear via `createDelegation({ parentDelegation })`; traders redelegate again to executor keys (3 levels). Bidirectional value flow: agents pay the research agent. |
| **Best x402 + ERC-7710** | x402 calls using 7710 | Research agent is a real x402 seller using ERC-7710 `assetTransferMethod` (MetaMask facilitator). Bull/Bear are x402 buyers via the kit's `createx402DelegationProvider`. |
| **Best Agent** | Smart Accounts in main flow | Fund-manager agent operates on the human's behalf via MetaMask Smart Accounts (7702); main flow is the agent running a market round. |
| **Best 1Shot Permissionless Relayer** | relay 7710 via 1Shot mainnet + 7702 upgrade + webhooks | Every relayed stake goes through `relayer_send7710Transaction`; 7702 in-place upgrade; **webhook `destinationUrl` is the UI's status source** (explicit scoring multiplier). |

> **Venice: a bonus, not a pillar (as built).** The three infra rails (Smart Accounts, x402, 1Shot) are the
> thesis. Venice is added only where an LLM/image is the *natural* component: (1) **agent reasoning runs on
> Venice** via the `LLM_PROVIDER` toggle (`qwen3-235b-a22b-instruct-2507`; Groq stays a one-line fallback) —
> reasoning quality isn't track-scored, but it's a real, honest use; (2) the **resolution verdict card is a
> Venice image** (multimodal — the one distinctive use; §10). We do **not** route the sold risk signals through
> Venice — those are real onchain reads over a public RPC. Funded by the hackathon's $25 Venice credits.

> Note the 1Shot track favors **mainnet** relay + 7702. The relayer is network-split — testnets on
> `relayer.1shotapi.dev`, mainnets on `relayer.1shotapi.com` (§8). Base Sepolia (84532) IS supported on `.dev`,
> so the full relayed flow runs on testnet; keep it network-configurable for a mainnet submission run.
> Capabilities (`relayer_getCapabilities`) tells you which chains/tokens are live — **do not hardcode**.

---

## 2. Monorepo layout

```
consilium/
├── README.md                      # quickstart + demo script (you write this last)
├── .env.example                   # every key/var, documented
├── package.json                   # bun workspaces (shared/agents/web); contracts is foundry (separate)
├── packages/
│   ├── contracts/                 # Foundry
│   │   ├── foundry.toml
│   │   ├── src/
│   │   │   ├── ConsiliumMarket.sol            # price-cross/liquidation resolution (PIVOT)
│   │   │   ├── ConsiliumMarketFactory.sol     # permissionless: createMarket() deploys+indexes markets
│   │   │   └── CUSDC.sol                       # Consilium USDC: local Anvil only; on Sepolia use real test USDC
│   │   │   # (tests use Chainlink's MockV3Aggregator from chainlink-brownie-contracts — no custom mock)
│   │   ├── test/
│   │   │   ├── ConsiliumMarket.t.sol
│   │   │   ├── ConsiliumMarketFactory.t.sol
│   │   │   └── Revert.t.sol                    # proves over-cap stake reverts
│   │   ├── script/Deploy.s.sol
│   │   └── deployments/                        # written addresses per chain (json)
│   ├── shared/src/                 # env.ts (zod) · chains.ts (priv/pub RPC split) · abis.ts · types.ts
│   ├── agents/
│   │   ├── src/
│   │   │   ├── smartAccount.ts     # 7702 toMetaMaskSmartAccount + upgrade helpers
│   │   │   ├── delegation.ts       # root + redelegation builders
│   │   │   ├── llm.ts              # reasoning client (OpenAI-compatible; Venice/Groq toggle)
│   │   │   ├── rpc.ts             # real onchain risk reads: Aave HF, price headroom, DEX depth (PIVOT)
│   │   │   ├── oneshot.ts          # 1Shot JSON-RPC client (.dev/.com) + webhook verify
│   │   │   ├── relayStake.ts       # build+sign+estimate+send the relayed stake bundle
│   │   │   ├── overcap.ts          # the over-cap revert (direct redemption → real reverted tx)
│   │   │   ├── researchServer.ts   # x402 SELLER — sells tiered Aave risk signals (PIVOT)
│   │   │   ├── buyerClient.ts      # x402 BUYER (createx402DelegationProvider)
│   │   │   ├── roundRunner.ts      # ties one full round together; emits RoundEvents to web
│   │   │   └── smoke/              # reasoning · signals · feed · delegation · x402 · oneshot · relay · keys
│   │   └── webhook/server.ts       # receives 1Shot webhooks, verifies Ed25519, broadcasts (SSE/WS)
│   └── web/                        # Next.js App Router dashboard (shadcn/ui + Tailwind v4, Mono Terminal)
│       ├── app/{page.tsx, market/page.tsx, api/}
│       └── components/  · lib/  · brand.md (root)
└── docs/DEMO.md                    # exact 3-minute video script
```

Use **bun workspaces** (the `workspaces` field in the root `package.json`) for `shared`/`agents`/`web`. Keep
`contracts` a standalone Foundry project. Run everything with `bun` / `bun run`.

---

## 3. Environment & prerequisites

`.env.example` (document every line; never commit real `.env`):

```bash
# --- Chains ---
# PRIVATE, server-side only (may carry an API key, e.g. QuickNode). NEVER expose to the browser; no
# NEXT_PUBLIC_ alias. Server code reads it via getServerRpcUrl() (throws in-browser).
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_PUBLIC_RPC_URL=https://sepolia.base.org   # PUBLIC, browser-safe (no key)
BASE_MAINNET_RPC_URL=https://mainnet.base.org
BASE_MAINNET_PUBLIC_RPC_URL=https://mainnet.base.org
CHAIN_ID=84532                      # 84532 Base Sepolia (core); 8453 for a 1Shot mainnet run

# --- Test USDC on Base Sepolia (Circle test token, confirmed from the faucet list) ---
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# --- Keys (fresh throwaway keys; fund with test USDC + a little ETH) ---
DEPLOYER_PRIVATE_KEY=
FUND_MANAGER_PRIVATE_KEY=
BULL_PRIVATE_KEY=
BEAR_PRIVATE_KEY=
RESEARCH_PRIVATE_KEY=                # research agent's payTo / smart account signer

# --- Reasoning LLM (NOT track-scored). Any OpenAI-compatible endpoint. Currently Venice; Groq fallback. ---
LLM_PROVIDER=venice                  # venice | groq | openai-compatible — agent reasoning only
LLM_BASE_URL=https://api.venice.ai/api/v1
LLM_API_KEY=                         # Venice key (METAAGENTS credits), or a free Groq key
LLM_MODEL=qwen3-235b-a22b-instruct-2507   # non-reasoning instruct model; verify a current id at build time

# --- RPCs for the sold risk signals (PIVOT) ---
SIGNAL_RPC_URL=                      # MAINNET RPC to read position P's real Aave signals (Alchemy/Infura free tier)
DEMO_CHAIN_RPC_URL=https://sepolia.base.org   # chain where the market contract + Chainlink feed are read

# --- The forecasted position + resolution feed (PIVOT — verify ALL at build time, don't hardcode) ---
POSITION_ADDRESS=                    # real mainnet Aave v3 borrower address P
AAVE_POOL_ADDRESS=                   # Aave v3 Pool on the chain where P lives
COLLATERAL_TOKEN=                    # P's collateral asset (whose price triggers liquidation)
PRICE_FEED_ADDRESS=                  # Chainlink collateral/USD feed on the demo chain (AggregatorV3Interface)
SEQUENCER_UPTIME_FEED=               # Chainlink L2 Sequencer Uptime feed on Base (REQUIRED on L2)

# --- 1Shot public relayer (no signup; endpoint auto-selected by chain in code: .dev testnet / .com mainnet) ---
ONESHOT_RELAYER_URL=                 # optional override; code picks .dev for 84532/11155111, .com otherwise
WEBHOOK_PUBLIC_URL=                  # public https URL (ngrok/cloudflared) for 1Shot to POST to
WEBHOOK_PORT=8787

# --- x402 (ERC-7710 settlement via MetaMask facilitator, not x402.org) ---
X402_FACILITATOR_URL=https://tx-sentinel-base-sepolia.api.cx.metamask.io/platform/v2/x402
```

Prereqs:
- Foundry (`forge`/`cast`/`anvil`) — `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Bun 1.3+ (package manager, workspace runner, TS runtime). Node 20+ optional.
- A tunnel (`cloudflared`/`ngrok`) so 1Shot webhooks reach the local webhook server.
- Test funds: Base Sepolia ETH (faucet) + test USDC (Circle faucet, **Base Sepolia network** — confirm the
  current address at build time).
- A free **mainnet** RPC (Alchemy/Infura) for `SIGNAL_RPC_URL` to read the real Aave position.

**Recommended:** `npx skills add 1Shot-API/skills/public-relayer` (exact relayer payloads).

---

## 4. Smart contract — `ConsiliumMarket.sol` (PIVOT: price-cross resolution)

**Purpose:** a minimal binary prediction market that (a) accepts YES/NO USDC stakes (push model — see below),
(b) resolves a *liquidation/price-cross* outcome by reading a real **Chainlink feed** with the **L2 sequencer
guard**, (c) pays out winners parimutuel. The contract does **not** enforce the per-agent cap — **the caveat
enforcer in the delegation does.** The contract is permissionless; the *budget* lives in MetaMask's
DelegationManager.

### Market parameters (a round forecasts a price-cross within a window)
- `priceFeed` — Chainlink `AggregatorV3Interface` for the collateral asset (e.g. ETH/USD on Base).
- `sequencerUptimeFeed` — Chainlink L2 Sequencer Uptime feed for Base (REQUIRED on L2).
- `liquidationPrice` — collateral price (feed decimals) at/below which `P` becomes liquidatable. Computed
  off-chain once at open from `P`'s liquidation threshold + debt/collateral; passed to the constructor; stored
  as the strike.
- `direction` — whether YES means "price ≤ liquidationPrice" (normal: collateral falling triggers liquidation).
- `deadline` (window `W`), `openTime`.
- `positionRef` — mainnet `P` address + collateral/debt metadata, stored for display/audit (not used in
  resolution math; anchors the question to a real position).

### State / behavior
- `constructor(IERC20 usdc, AggregatorV3Interface priceFeed, AggregatorV3Interface sequencerFeed,
  int256 liquidationPrice, uint8 direction, uint64 deadline, PositionRef positionRef)`.
- Stakes per side: `mapping(uint8 side => uint256 total)` + per staker `mapping(address => Position){ uint8 side; uint256 amount; }`.
- **Stake (PUSH MODEL — as built, keep).** `stake(uint8 side, uint256 amount)` credits USDC **already
  transferred into** the market: it checks `usdc.balanceOf(address(this)) - pot() >= amount` (else `Unfunded()`),
  records, and accumulates. This decouples staking from `transferFrom`/allowances so the 1Shot bundle can move
  USDC via a top-level `transfer` the `ERC20TransferAmount` enforcer gates (that's what makes the over-cap revert
  fire at the enforcer, §6.4). A staker accumulates on one side only (`SideMismatch()` on switch); `MarketClosed()`
  if `block.timestamp >= deadline`. Checks order: closed → invalid side → zero → side-mismatch → funded.
- `_readPrice()` (internal, Chainlink L2 pattern — implement, don't skip; it's a credibility signal): read
  `sequencerFeed.latestRoundData()`, require sequencer up (`answer == 0`) and past grace
  (`block.timestamp - startedAt > GRACE_PERIOD`) else `SequencerDown()` / `GracePeriodNotOver()`. Then
  `priceFeed.latestRoundData()`, require fresh (`updatedAt` recent, `answer > 0`), return price.
- **`poke()`** — anyone (the round runner) can call while open; reads the price, and if the liquidation
  condition is met (`direction==DOWN ? price <= liquidationPrice : price >= liquidationPrice`) latches
  `crossed = true` + records `observedPrice`. Captures an intra-window cross even if price later recovers
  (liquidation is one-way — once liquidatable, outcome is YES).
- `resolve()`: require `block.timestamp >= deadline OR crossed`. Outcome YES if `crossed` (or a final
  `_readPrice()` meets the condition), else NO. Store `resolved` + `outcome` + `observedPrice`. Emit
  `Resolved(outcome, observedPrice, liquidationPrice)`.
- `claim()`: winning side splits the full pot pro-rata; parimutuel; `nonReentrant`; CEI; guard double-claim.
  *As built:* if a side has zero stake, refund stakes (no stuck funds / div-by-zero); integer-division dust
  stays in the contract, preserving `total claimed ≤ pot`.
- Events: `Staked(agent, side, amount)`, `Poked(price, crossed)`, `Resolved(outcome, observedPrice, liquidationPrice)`, `Claimed(agent, amount)`.

### `ConsiliumMarketFactory.sol` (permissionless creation — as built, keep)
`createMarket(...)` (new param set above) deploys a `ConsiliumMarket`, indexes it (`allMarkets`,
`marketsOf(creator)`), emits `MarketCreated(...)`, guards `deadline > block.timestamp`. Market creation is
itself a real onchain event. `Deploy.s.sol` deploys the factory and creates the demo market through it.

### Conventions + mocks
- `pragma solidity ^0.8.30;`, custom errors, `evm_version="prague"`, optimizer on. OZ `IERC20`/`SafeERC20`/
  `ReentrancyGuard`; Chainlink `AggregatorV3Interface` from `@chainlink/contracts`. Install:
  `forge install OpenZeppelin/openzeppelin-contracts smartcontractkit/chainlink-brownie-contracts`.
- `CUSDC.sol`: 6-dp ERC20 + public `mint` — local Anvil only; on Base Sepolia use real test USDC.
- **No custom price mock.** The contract codes against `AggregatorV3Interface`; the implementation behind it
  changes by environment. **Production** (Base Sepolia / mainnet): `priceFeed` = the real Chainlink feed,
  `sequencerFeed` = the real sequencer uptime feed (or `address(0)` on Base Sepolia, which has none — guard
  skipped, §4 `_readPrice`). **Tests**: Chainlink's audited **`MockV3Aggregator`** (from
  `chainlink-brownie-contracts`) — `updateAnswer(price)` drives the price across the strike; `updateRoundData(...)`
  sets the sequencer answer (0=up/1=down) + `startedAt` to exercise down + grace-period. Same interface both
  ways, so production code is identical. No mock ever ships to the demo chain.

### Tests (`forge test -vvv` must pass) — to rework for price resolution
`ConsiliumMarket.t.sol` (use `MockAggregator`): `test_StakeBothSides`; `test_ResolveYes_whenPriceCrossesDown`
(price ≤ strike → poke → resolve YES); `test_ResolveNo_whenPriceStaysAbove`; `test_PokeLatchesCrossEvenIfPriceRecovers`;
`test_RevertWhen_SequencerDown`; `test_RevertWhen_GracePeriodNotOver`; `test_ClaimPaysWinnersProRata` +
`testFuzz_ClaimNeverExceedsPot`; `test_RevertWhen_StakeAfterDeadline`; plus the push-model funding tests
(`Unfunded`, `SideMismatch`).
`ConsiliumMarketFactory.t.sol`: correct params on created market, indexing, `MarketCreated`, distinct/segregated,
past-deadline revert, fully-functional created market.
`Revert.t.sol` — over-cap backstop: assert a redemption over an agent's cap reverts at the
`ERC20TransferAmountEnforcer` (fork Base Sepolia if feasible; else unit-test at the toolkit env address). The
contract-level backstop also proves the push-model math: staking more than was transferred in reverts `Unfunded`.

`Deploy.s.sol` deploys `ConsiliumMarketFactory` (and `CUSDC` only on chainid 31337), creates the demo market
through the factory pointing at the **real Chainlink feed + sequencer feed**, writes `deployments/<chainId>.json`.

---

## 5. MetaMask Smart Accounts Kit — delegation layer (as built: EIP-7702)

> Package: `@metamask/smart-accounts-kit` (v1.6.x). Docs: redelegation
> docs.metamask.io/smart-accounts-kit/guides/delegation/create-redelegation/ · x402 buyer
> docs.metamask.io/smart-accounts-kit/guides/x402/buyer/delegations/

### 5.1 Smart accounts (`smartAccount.ts`) — EIP-7702 (as built)
Each actor's funded EOA is upgraded **in place** via EIP-7702 (`Implementation.Stateless7702`): the
smart-account address **is** the EOA address — USDC on the EOA is on the operational account, no separate
counterfactual address, and it matches the 1Shot 7702 path (§8).

```ts
import { Implementation, toMetaMaskSmartAccount, getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { activeChain, getServerRpcUrl } from '@consilium/shared'

export const publicClient = createPublicClient({ chain: activeChain.chain, transport: http(getServerRpcUrl()) })

export async function makeSmartAccount(pk: `0x${string}`) {
  const owner = privateKeyToAccount(pk)
  return toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address: owner.address,            // 7702: account address == EOA address
    signer: { account: owner },
  })
}
```
- **Upgrade each EOA once before it redeems anything.** Self-sponsored EIP-7702 authorization setting code to
  `EIP7702StatelessDeleGatorImpl` (from `getSmartAccountsEnvironment(chainId).implementations`):
  `wallet.signAuthorization({ account, contractAddress: impl, executor: 'self' })` →
  `wallet.sendTransaction({ authorizationList: [auth], to: account.address })`. `bun run accounts:upgrade` does
  this for every funded role; `bun run keys:status` shows the ✓.
- Fund each EOA with a little Base Sepolia ETH (one-time upgrade + any self-paid gas); traders also hold test
  USDC. 1Shot covers gas for the relayed stake legs.

### 5.2 Root delegation: human → fund-manager
Real MetaMask browser signer for the human (ERC-7715 advanced-permissions is the polished path; headless = a
smart account). Root grants the fund-manager an `Erc20TransferAmount` scope (total market budget).

### 5.3 Redelegation: fund-manager → Bull / Bear (THE A2A REQUIREMENT)
Narrow the scope, pass `parentDelegation`:
```ts
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
const redelegation = createDelegation({
  scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: USDC, maxAmount: parseUnits('20', 6) },
  to: bullSmartAccount.address, from: fundManagerSmartAccount.address,
  parentDelegation: signedRootDelegation, environment: fundManagerSmartAccount.environment,
})
const signed = await fundManagerSmartAccount.signDelegation({ delegation: redelegation })
```
A child can only **narrow**. Add `createCaveatBuilder` + `CaveatType.LimitedCalls` for single-use; link
`authority = hashDelegation(parent)`.

### 5.4 Third hop: trader → executor (DEEPER A2A THAN THE FIELD)
3-level chain `Human → fund-manager → trader → executor`; each trader redelegates a narrower sliver to a
disposable per-round executor that submits the stake. Attenuation strict at every hop:
`stakeThisRound ≤ trader cap ≤ manager cap ≤ human budget`. This is where the over-cap revert lives most
naturally (§6.4). `bun run delegation:smoke` (as built): signs the full 3-level chain, decodes each cap from
the signed delegation, asserts `child ≤ parent`, and verifies `authority == hashDelegation(parent)`.

---

## 6. x402 + ERC-7710 — the inter-agent commerce rail

> x402 packages: `@x402/express`, `@x402/core`, `@x402/fetch`, plus **`@metamask/x402`** for the ERC-7710 scheme.
> **Facilitator (as built):** ERC-7710 settlement runs through **MetaMask's facilitator**
> (`https://tx-sentinel-base-sepolia.api.cx.metamask.io/platform/v2/x402`), NOT x402.org — the stock `@x402/evm`
> exact scheme only does EIP-3009/permit2. Seller uses `@metamask/x402` `x402ExactEvmErc7710ServerScheme`; buyer
> uses the kit's `createx402DelegationProvider`.

### 6.1 Research agent = x402 SELLER (`researchServer.ts`) — PIVOT: tiered risk signals
Express server selling **real onchain risk signals** about position `P`, as separately-priced products. Each
route is x402-gated and advertises `extra.assetTransferMethod: 'erc7710'`. Tiered products make
evidence-gathering a *costly signal*: a more confident agent buys deeper, costlier signals.

```ts
app.use(paymentMiddleware({
  'GET /research/health':    { accepts:[{ scheme:'exact', price:'$0.02', network:'eip155:84532', payTo: RESEARCH_ADDRESS, extra:{ assetTransferMethod:'erc7710' } }], description:'Aave v3 health factor + collateral/debt for P' },
  'GET /research/headroom':  { accepts:[{ scheme:'exact', price:'$0.05', network:'eip155:84532', payTo: RESEARCH_ADDRESS, extra:{ assetTransferMethod:'erc7710' } }], description:'Price headroom: % drop to liquidation + liquidation price' },
  'GET /research/liquidity': { accepts:[{ scheme:'exact', price:'$0.10', network:'eip155:84532', payTo: RESEARCH_ADDRESS, extra:{ assetTransferMethod:'erc7710' } }], description:'DEX depth for collateral: clean liquidation or cascade' },
}, server))
app.get('/research/health',    async (_q,res)=>res.json(await aaveAccountData(POSITION)))   // §7.2
app.get('/research/headroom',  async (_q,res)=>res.json(await priceHeadroom(POSITION)))      // §7.2
app.get('/research/liquidity', async (_q,res)=>res.json(await dexDepth(COLLATERAL_TOKEN)))   // §7.2
```
- All three are **real reads** (Aave v3 `getUserAccountData` on mainnet; headroom from liq-threshold + Chainlink
  price; DEX depth from an onchain quoter/pool). Source from any RPC — value is metering + settlement.
- **Costly-signal twist:** deeper signals cost more; you may raise price as the window nears close. Keep it
  explainable: "the Bull paid for all three tiers — it's putting money behind its conviction."
- *As built (v1 wiring, carries over):* the server scheme, `cors` exposing `PAYMENT-REQUIRED`/`PAYMENT-RESPONSE`,
  and the 402 challenge emitting `extra.assetTransferMethod === 'erc7710'` are verified. Swap the single balance
  route for the three tiered routes.

> **v2 seam — custom 1Shot-routed facilitator (architect now, build later).** Stock `HTTPFacilitatorClient`
> satisfies v1; a future `ConsiliumFacilitator` routing `/settle` through `relayer_send7710Transaction` is a
> drop-in (injected via `HTTPFacilitatorClient({ url })`). Say this in the README "Future work."

### 6.2 Trader agents = x402 BUYER (`buyerClient.ts`) — as built (DONE, settled live)
The buyer side is the kit's `createx402DelegationProvider` + `@metamask/x402` — auto-creates, signs, and
ABI-encodes an open delegation (redeemer / allowedTargets / timestamp caveats) on a 402, giving a
`fetch`-compatible function that pays + retries:
```ts
import { createx402DelegationProvider } from '@metamask/smart-accounts-kit/experimental'
import { x402Erc7710Client } from '@metamask/x402'
import { x402Client, x402HTTPClient } from '@x402/core/client'
import { wrapFetchWithPayment } from '@x402/fetch'
export function makeBuyerFetch(buyerSmartAccount) {
  const erc7710 = new x402Erc7710Client({ delegationProvider: createx402DelegationProvider({ account: buyerSmartAccount }) })
  return wrapFetchWithPayment(fetch, new x402HTTPClient(new x402Client().register('eip155:*', erc7710)))
}
```
- Buyer smart account must be deployed (7702-upgraded) and hold USDC; the cap chains back to the human. Keep
  data-purchase amounts under the agent's cap; the over-cap event is reserved for staking (§6.4).
- **Acceptance: DONE (settled live).** `bun run x402:smoke` settled a real USDC payment on Base Sepolia (bull
  paid the research agent via ERC-7710 delegation; `PAYMENT-RESPONSE` carries the real tx hash). A confident
  agent buys multiple tiers; a hesitant one buys only the cheap tier — total spent is the costly signal.

### 6.3 Staking via the market (the work transaction) — as built
After buying signals, each agent stakes LIQUIDATABLE/SAFE via the **1Shot relayer** (§8) — gas in USDC, no ETH.
*As built (`relayStake.ts`):* two delegations per stake — `ERC20TransferAmount`-capped
`[USDC.transfer(feeCollector,fee), USDC.transfer(market,stake)]` + `FunctionCall(market.stake)` — redeemed
atomically; the push-model market credits the transferred USDC.

### 6.4 THE REVERT money-moment — as built (DONE)
An agent attempts to stake **more than its redelegated cap**; the `ERC20TransferAmount` enforcer reverts.
*As built (approach B — direct redemption):* `overcap.ts` signs an `ERC20TransferAmount(cap)` delegation, calls
`DelegationManager.redeemDelegations` directly with an over-cap execution, submitted with an explicit gas limit
(skips estimation) so it mines and reverts → a **real clickable failed-tx hash**:
`ERC20TransferAmountEnforcer:allowance-exceeded`. `bun run demo:overcap`. (Through the relayer it rejects at
estimate/simulation with no on-chain tx — that's why we redeem directly.) **Product meaning:** this revert is
*why the oracle is manipulation-resistant* — an agent can't skew the published probability beyond its bonded,
chain-enforced stake. Do NOT add an app-side pre-empt; submit it for real.

### 6.5 Consumer-side read endpoint (DESIGNED, not built in v1)
Specify but don't build: a `GET /oracle/:marketId` route, x402-gated like the research routes, returning the
current market-implied liquidation probability (YES pot / total pot, capital-weighted) + the resolved outcome.
Consumers (liquidator bots, risk dashboards) pay a micropayment to read it. Document the endpoint + an example
consumer call in the README "Future work / product loop." Same posture as the custom facilitator: real design,
deferred build.

---

## 7. Reasoning LLM + risk-signal reads

### 7.1 Agent reasoning (`llm.ts`) — as built (Venice; Groq fallback)
Each trader calls an OpenAI-compatible LLM to decide stance & size given the **purchased risk signals**. Thin
wrapper behind `LLM_PROVIDER`/`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` — currently **Venice**
(`qwen3-235b-a22b-instruct-2507`, $25 credits), Groq free Llama a one-line fallback. Prompt gets the *real*
signals (HF, headroom %, liquidation price, DEX depth); return structured JSON
`{ stance:'LIQUIDATABLE'|'SAFE', sizeUsdc:number, confidence:number, rationale:string }` via `json_object` mode,
parsed defensively (strip fences). *As built lesson:* prefer a **non-reasoning** instruct model — thinking
models burn the token budget on hidden reasoning and truncate the JSON. The reasoning is real because the
*inputs* are real onchain risk data — that's what keeps the number from being confident nonsense.

### 7.2 The sold risk signals (`rpc.ts`) — real onchain reads (PIVOT: replaces the balance read)
Three real reads, sold as tiered x402 products (§6.1). Read the **mainnet** position for genuine signals.
```ts
// (a) Aave v3 HF + composition (headline). Pool.getUserAccountData(P) → { totalCollateralBase, totalDebtBase,
//     availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor }. Verify the Aave v3 Pool address.
export async function aaveAccountData(P) { /* readContract getUserAccountData on SIGNAL_RPC_URL */ }
// (b) Price headroom (dynamic). liquidationPrice from liq-threshold + debt/collateral (single-collateral
//     first-order is fine for the demo — show the formula in the UI). headroomPct = (price - liqPrice)/price.
export async function priceHeadroom(P) { /* compute from (a) + Chainlink latestRoundData */ }
// (c) Exit liquidity (deepest). Uniswap v3 quoter out-amount for a liquidation-sized swap and/or pool liquidity.
export async function dexDepth(token) { /* onchain quoter/pool read */ }
```
- Each is a genuine onchain read sold over a genuine x402 call. **Document the chain split openly:** signals
  read mainnet `P`; settlement reads the collateral's Chainlink feed on the demo chain (§4). Neither is faked.
- Keep the liquidation-price math honest and simple; don't overclaim a full multi-collateral risk engine.

### 7.3 Resolution card — Venice image (the one multimodal use), SVG fallback
On `resolve()`, generate a shareable verdict card via **Venice image generation** (§10): the question
(position `P`, liquidation price, window `W`), outcome (**LIQUIDATABLE / SAFE**), observed price vs liquidation
price, and how much each agent committed to evidence (the costly-signal payoff). Keep a plain **SVG/HTML
fallback** so the demo never blocks on the image API (the fallback is clearly a fallback — no silent fake).

> Smoke scripts (hit live endpoints): `bun run reasoning:smoke` (one structured LLM call); `bun run
> signals:smoke` (the three real reads against mainnet `P` — prints HF/headroom/depth); `bun run feed:smoke`
> (reads the collateral Chainlink feed `latestRoundData` + sequencer status on the demo chain).

---

## 8. 1Shot permissionless relayer (`oneshot.ts`) — as built

> **Endpoint is network-split (verified):** testnets (Base Sepolia 84532, Sepolia 11155111) on
> `https://relayer.1shotapi.dev/relayers`; mainnets on `https://relayer.1shotapi.com/relayers`. Using the wrong
> one returns empty `{}` capabilities. Base Sepolia IS supported on `.dev` — full relayed flow runs on testnet.
> JWKS for webhook verify: `<relayer-host>/.well-known/jwks.json`. Skill: `npx skills add 1Shot-API/skills/public-relayer`.
> Verified Base Sepolia caps: `targetAddress 0xf1ef956eff4181Ce913b664713515996858B9Ca9`,
> `feeCollector 0xE936e8FAf4A5655469182A49a505055B71C17604`, payment token = our USDC.

### Methods (verified)
- `relayer_getCapabilities([chainId])` — source of truth for chains, payment tokens, `feeCollector`,
  **`targetAddress`** (the delegation's `to` MUST equal it). Never hardcode; cache per session.
- `relayer_getFeeData({ chainId, token })` → `{ gasPrice, rate, minFee, expiry, context }`.
- `relayer_estimate7710Transaction` — assemble bundle (omit `context`); returns `success`,
  `requiredPaymentAmount`, `gasUsed`, signed `context` (~45s lock). Validates + simulates; check
  `result.success` before send.
- `relayer_send7710Transaction` — include the signed `context`; for local signers include one
  `authorizationList` entry (7702 upgrade) on first use; set `destinationUrl`. Returns a `TaskId`.
- `relayer_getStatus({ id, logs })` — poll fallback. Terminal: 200 Confirmed / 400 Rejected / 500 Reverted.

### Build order for the relayed stake (as built in `relayStake.ts`)
1. `getCapabilities` → token + `targetAddress`. 2. Build the two-delegation bundle (§6.3), sign. 3. estimate →
adjust fee to `requiredPaymentAmount`, re-sign, re-estimate. 4. send with `context` (+ `destinationUrl`). 5.
track via webhook (preferred) + `getStatus` (fallback). Fresh `salt` each time; serialize bigints to hex.

### Webhook server (`webhook/server.ts`) — as built
Public HTTPS endpoint (tunnel) set as `destinationUrl`. **Verify Ed25519 signatures against the relayer JWKS**
(canonical JSON sans `signature`, `safe-stable-stringify`) before trusting any event; reject unverified. On a
verified terminal event, broadcast over SSE/WS so the dashboard flips Pending→Confirmed/Reverted from the real
relayer. *As built:* verify path + JWKS import tested; live delivery needs a tunnel (polling proven as fallback).

---

## 9. Round orchestration (`roundRunner.ts`) — to rework for the solvency round

One full round, all real:
1. **Setup**: ensure the 4 smart accounts (7702-upgraded); fund traders with test USDC. Root delegation (human
   → fund-manager) → redelegate capped budgets to Bull & Bear → each redelegates to an executor (3-level chain,
   signed + emitted). Compute position `P`'s liquidation price; create `ConsiliumMarket` via the factory with
   the collateral Chainlink feed, sequencer feed, liquidation price, direction, and a **tight, near-the-money
   window `W`** (demo seam, §0).
2. **Research opens**: research x402 seller up. Bull (LIQUIDATABLE) & Bear (SAFE) each, driven by LLM reasoning
   over **purchased tiered signals** (health → headroom → liquidity, x402 + 7710). Deeper signals cost more;
   total committed per agent = its costly confidence signal.
3. **Stake**: each agent stakes via the **1Shot-relayed** 7710 tx (gas in USDC). UI flips Pending→Confirmed from
   the webhook. The YES/NO pot split *is* the published liquidation probability.
4. **Over-cap demo** (flag): designated agent attempts an over-cap stake → enforcer revert at the
   trader→executor hop → red card with real failed tx hash.
5. **Resolve**: `roundRunner` calls `poke()` periodically while open; if the Chainlink price crosses the
   liquidation level within `W` it latches. After deadline-or-cross, `resolve()` settles LIQUIDATABLE/SAFE from
   the real feed (with the L2 sequencer guard). *As built:* poll `resolved()` before reading outcome
   (RPC read-after-write lag).
6. **Card**: render the verdict card (Venice image, SVG fallback); winners `claim()`.
7. Every step emits a typed `RoundEvent` (in `@consilium/shared` `types.ts`) with the real tx hash / feed read /
   explorer link — the UI subscribes (§10).

`roundRunner.ts` exposes a CLI (`bun run round:run`, `bun run round:run --demo-overcap`) + an HTTP trigger;
idempotent enough to re-run for the video. *As built (pre-pivot):* `runRound(onEvent)` is wired end-to-end for
the balance question (create→redelegate→buy→reason→stake→resolve→claim, verified live) — the rework swaps the
question/signals/resolution per the above; the orchestration shape stays.

---

## 10. Web dashboard (`packages/web`, Next.js App Router) — as built shell; rework copy for solvency

> Brand: **Mono Terminal** (`brand.md`) — near-black neutral, color = signal only (YES/LIQUIDATABLE green or
> red per framing, pending amber, reject red), JetBrains Mono on every number/hash, Inter for text, shadcn/ui +
> Tailwind v4, dark. It's a **live command center, not a dashboard.**

- **`/market`** subscribes (SSE/WS) to `RoundEvent`s + the 1Shot webhook and renders, in real time:
  - The question: position `P`, **current price vs liquidation price**, window `W` + countdown, live collateral
    price ticking toward/away from the strike.
  - Two agent trading-desk columns (Bull=LIQUIDATABLE / Bear=SAFE): redelegated cap, USDC committed to evidence,
    **which signal tiers each bought**, stance & size, each with the real tx hash ↗.
  - A **"published probability"** readout = YES pot / total pot, updating live as agents stake — the oracle's
    output, the thing a consumer would buy.
  - An **evidence-spend meter** per agent rising as it buys deeper tiers (the costly-signal visual).
  - Stake txs with live Pending→Confirmed from the **webhook**; the over-cap **red "Rejected by enforcer"** card
    with the failed tx hash; on resolution the verdict card + claim.
- Browser viem clients use the **public** RPC; the keyed server RPC stays server-side (§3). Wallet connect via
  MetaMask for the human's root grant.
- **No hardcoded state.** Every figure ← a real event: a tx hash, a Chainlink feed read, or a webhook. A judge
  clicking any number reaches a real explorer page.

*As built:* the command-center shell, landing page, all six sections (question hero, agent desks, event
timeline, x402 evidence panel, reject card, resolution+Venice-card slot) are built static against real
last-round data. Rework: re-point copy/data from "balance ≥ threshold" to "price vs liquidation price /
LIQUIDATABLE-SAFE / published probability," then wire live (SSE + webhook).

---

## 11. Build order (commit at each step) — pivot deltas marked
1. **Repo + tooling** — ✅ done (bun workspaces, foundry, `.env.example`, shared `env.ts`/`chains.ts`).
2. **Contracts** — ✅ v1 done; **rework**: add `MockAggregator.sol`, change `ConsiliumMarket` resolution to
   Chainlink price-cross + sequencer guard + `poke()` (keep push-model stake + factory), update tests
   (sequencer-guard + price-cross), redeploy to Base Sepolia pointing at a **real Chainlink feed**.
3. **Reasoning + risk signals** — ✅ reasoning done (Venice); **rework** `rpc.ts` to Aave HF / headroom / DEX
   depth; add `bun run signals:smoke` + `feed:smoke` (reasoning:smoke stays).
4. **Smart accounts + delegation** — ✅ done (7702, 3-level chain, `delegation:smoke`).
5. **x402 seller + buyer** — ✅ settlement done; **rework** seller to the three tiered routes.
6. **1Shot relayer** — ✅ done (`oneshot.ts`, relayed stake live, webhook verify); wire live webhook via tunnel.
7. **Round runner** — ✅ v1 done; **rework** to the solvency round (poke/resolve from feed, tiered buys).
8. **Over-cap revert** — ✅ done (`overcap.ts`, real reverted tx).
9. **Web dashboard** — ✅ shell + landing done; **rework** copy + wire SSE/webhook live.
10. **README + DEMO.md** — quickstart, primitive table, 3-min script, "Deploy your own agent" + "Future work."

Acceptance gate per step: a smoke script proving it against the live testnet/relayer/feed — no mocks in the
acceptance path.

---

## 12. Demo video script (`docs/DEMO.md`) — what wins (~3 min, every claim a visible tx/feed read)
1. **(25s) Frame the real problem**: "Millions of lending positions, no liquid market tells you which are about
   to get liquidated in the next hour — human markets can't form that granularly. Consilium spins up an
   agent-run risk oracle per position. And unlike demos showing numbers that aren't real, watch every number
   here resolve to an onchain event."
2. **(30s) Human grants once, three-level chain**: MetaMask popup, human → fund-manager → Bull & Bear →
   executor keys; point at the `parentDelegation` chain three levels deep. "One signature, fanned into a
   cryptographically bounded agent hierarchy."
3. **(45s) Live adversarial research**: show real position `P` — live Aave HF + how far collateral must fall to
   liquidate. Bull (LIQUIDATABLE) and Bear (SAFE) reason, then **buy real risk signals** (health → headroom →
   liquidity); show the x402 402-challenge → settled USDC and the **evidence-spend meter** rising — "confidence
   is a costly signal; the bluffer can't afford the deep data. Peers paying peers for real onchain intelligence."
4. **(30s) Relayed stakes → a published probability**: both stake via 1Shot, **gas in USDC**, UI flips
   Pending→Confirmed from the **webhook**. The pot split updates the **live liquidation probability** — "that
   number is the product; a liquidator bot would pay x402 to read it."
5. **(25s) THE REVERT (money-moment)**: over-cap agent → reverts at the `ERC20TransferAmount` enforcer, real
   failed tx on Basescan. "No app code rejected this — the chain did, three hops from the human. That's *why*
   the oracle can't be manipulated past an agent's bonded stake. Structural, not aspirational."
6. **(15s) Resolve against a real feed**: collateral's Chainlink price crosses (tight demo window), `resolve()`
   settles LIQUIDATABLE/SAFE from `latestRoundData` with the L2 sequencer guard; verdict card; winners claim.
   Say openly: "production window is hours; we tightened it so it resolves on camera."
7. **(10s) Close**: one human signature → an autonomous, bounded, adversarial risk oracle producing a sellable
   signal. Three sponsors (MetaMask Smart Accounts, x402, 1Shot), each load-bearing.

---

## 12b. Primitive-coverage table (README) — keep true, no aspirational entries

| Primitive / API | Package | Where used |
|---|---|---|
| `toMetaMaskSmartAccount` (`Stateless7702`) | smart-accounts-kit | `smartAccount.ts` — all 4 actors + executors (7702 in-place) |
| `Implementation.Stateless7702` + 7702 `signAuthorization` | smart-accounts-kit + viem | `smartAccount.ts` upgrade; `accounts:upgrade` |
| `createDelegation` + `parentDelegation` | smart-accounts-kit | `delegation.ts` — manager→trader redelegation (§5.3) |
| 3rd-hop `createDelegation` | smart-accounts-kit | `delegation.ts` — trader→executor (§5.4) |
| `signDelegation` / `hashDelegation` | smart-accounts-kit(/utils) | every hop signs; cap/authority assertions (`delegation:smoke`) |
| `ScopeType.Erc20TransferAmount` / `ScopeType.FunctionCall` | smart-accounts-kit | capped transfers + `market.stake` in the relayed bundle (§6.3) |
| `createx402DelegationProvider` + `x402Erc7710Client` | smart-accounts-kit/experimental + @metamask/x402 | buyer auto-pays (§6.2) |
| `x402ExactEvmErc7710ServerScheme` | @metamask/x402 | research seller scheme (§6.1) |
| ERC-7710 `assetTransferMethod` (MetaMask facilitator) | @metamask/x402 + tx-sentinel | settled USDC payment (§6) |
| `DelegationManager.redeemDelegations` | smart-accounts-kit/contracts | over-cap direct redemption (§6.4) |
| `ERC20TransferAmountEnforcer` | toolkit deployment | the over-cap revert money-moment (§6.4) |
| `relayer_getCapabilities/getFeeData/estimate7710/send7710/getStatus` | 1Shot | `oneshot.ts` full relay lifecycle (§8) |
| 1Shot webhook + Ed25519/JWKS verify | 1Shot | `webhook/server.ts` — UI status source (§8) |
| `AggregatorV3Interface` + L2 Sequencer Uptime feed | @chainlink/contracts | `ConsiliumMarket` resolution + guard (§4) |
| Aave v3 `getUserAccountData` | onchain read | `rpc.ts` health-factor signal (§7.2) |

## 12c. Competitive positioning (do not name rivals in the submission)
- **vs DelegAI (rigor):** match its primitive breadth (§12b), then go *deeper* — a 3-level chain vs master→worker;
  the revert proves enforcement three hops out.
- **vs SwifterAI (polish / custom facilitator):** equal the multi-agent + 1Shot routing; concede the custom
  facilitator as documented v2 (seam built, §6.1). Win on the *legible live demo* — every number → real tx.
- **vs Clawmes (raw capability):** win on **sharpness + a real product** — an agent-run risk oracle per position,
  every event provable onchain in 3 minutes.
- **vs r402 ("no self-reported claims"):** our costly-signal mechanic *is* "confidence you can't fake," the
  enforcer revert *is* "the chain says no" — plus a full three-sponsor settled flow producing a sellable signal.
- **Field-wide gaps we occupy:** (1) the only *true peer* A2A market producing a **priced, money-backed
  signal**, not a fan-out tree; (2) the only demo where any figure clicks through to a real explorer / Chainlink
  feed; (3) 1Shot webhooks driving live UI status.
- **Note on Venice:** a **bonus, not a pillar** — reasoning on Venice + the verdict card, both natural
  components (honest, not bolt-on). The thesis stays the three infra rails; Venice is upside picked up ~free.

---

## 13. Guardrails (re-read before you ship)
- **Never fake state.** Every UI figure ← a real event + tx hash / Chainlink feed read / webhook. No timers
  standing in for webhooks. This is the whole competitive thesis.
- **Don't pre-empt the enforcer revert in app code** — submit the over-cap tx for real.
- **Check the L2 sequencer feed before trusting a Chainlink price** (`SequencerDown`/`GracePeriodNotOver`) — it's
  correct *and* a credibility signal.
- **State the demo seam openly** — tight window + near-the-money strike; the price is real, only `W`/strike are
  tightened. Never imply the position truly liquidated if it didn't.
- **Don't hardcode** relayer tokens/`targetAddress`, the relayer endpoint (pick by chain), LLM model ids, the
  USDC address, the Aave pool, the Chainlink feed, or the sequencer feed — discover each at runtime/build time.
- **Verify webhook signatures** before trusting any status.
- **Never expose the private RPC** (or any keyed secret) to the browser; agents/server use `getServerRpcUrl()`,
  the client uses the public RPC.
- Use fresh throwaway keys; small amounts; never commit secrets.
- If a sponsor API shape differs from this doc, **fetch the cited doc URL and follow the live version** — then
  update this file's note so we stay honest.
