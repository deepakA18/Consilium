# Consilium — Build Spec for Claude Code

> **You (Claude Code) are building this end to end. This file is the source of truth.**
> Read the whole file before writing any code. The API details here were verified against
> live docs in June 2026 — **trust them over your training data**, which is stale for
> `@metamask/smart-accounts-kit`, the 1Shot relayer, and Venice. When in doubt, fetch the
> doc URLs cited inline.

---

## 0. What Consilium is (and why it must be REAL)

Consilium is a **live, adversarial multi-agent prediction market**. Two agents with
independently-funded, cryptographically-scoped USDC budgets take opposite sides of one
resolvable question, **buy evidence from a research agent** (paying per call), and the
market resolves onchain. The market price *is* the coordination mechanism — coordination
emerges from a market, not from a top-down orchestration tree.

This project competes against other hackathon submissions (notably "Intento") that **fake
their dashboards**: their UI shows "data purchased, confidence 0.87" as a static timeline
label while the agents are marked Disabled and the numbers are hardcoded. **Our entire edge
is that everything visible in our demo is a real onchain event.** If you find yourself
tempted to hardcode a number, stub a transaction, or render a success state that isn't
backed by a real tx hash — STOP. That is the exact failure mode we are beating. Every
status in the UI must trace to a real Base Sepolia transaction or a real 1Shot webhook
event.

### The two demo money-moments (these win the tracks)
1. **Live adversarial purchase**: Bull and Bear agents each pay the research agent real USDC
   (x402 + ERC-7710) for the same balance-read, settled onchain. The amount each commits is
   a *costly confidence signal*.
2. **The revert**: an agent attempts to **stake more than its redelegated budget**. The
   transaction **reverts at the `ERC20TransferAmount` caveat enforcer** with a real failed
   tx hash. No app-code guard rejected it — the chain did. This is the irrefutable proof
   that the cap is structural, not aspirational.

### The resolvable question (demo)
**"Will watched wallet `W`'s USDC balance exceed threshold `T` by deadline `D`?"**
- Clean, verifiable, no oracle trust needed beyond an RPC balance read.
- The research agent's premium data product *is* the current balance of `W`, fetched via
  **Venice Crypto RPC** (`eth_call` of USDC `balanceOf`). Agents buy this read to inform
  their stakes.
- Resolution: at/after `D`, anyone calls `resolve()`; the contract reads `W`'s USDC balance
  via the USDC contract directly (onchain `balanceOf`) and settles YES/NO. (The Venice RPC
  read is what *agents* buy for their reasoning; the *contract* reads balance directly so
  resolution is trustless.)

---

## 1. Tracks targeted & how each is satisfied (keep this map true as you build)

| Track | Requirement | How Consilium satisfies it |
|---|---|---|
| **Best A2A coordination** | redelegation | Human → fund-manager root delegation; fund-manager **redelegates** scoped caps to Bull & Bear via `createDelegation({ parentDelegation })`. Bidirectional value flow: agents pay the research agent. |
| **Best x402 + ERC-7710** | x402 calls using 7710 | Research agent is a real x402 seller using ERC-7710 `assetTransferMethod`. Bull/Bear are x402 buyers using `createOpenDelegation` + `Redeemer` caveat. |
| **Best Agent** | Smart Accounts in main flow | Fund-manager agent operates on the human's behalf via MetaMask Smart Accounts; main flow is the agent running a market round. |
| **Best Use of Venice AI** | Venice core + multimodal | Three endpoints, all load-bearing: `chat/completions` (agent reasoning), `crypto/rpc` (the data agents buy), `image/generations` (resolution card). Nobody else used multimodal Venice. |
| **Best 1Shot Permissionless Relayer** | relay 7710 via 1Shot mainnet + 7702 upgrade + webhooks | Every 7710 redemption goes through `relayer_send7710Transaction`; 7702 upgrade via stateless delegator; **webhook `destinationUrl` is the UI's status source** (explicit scoring multiplier). |

> Note the 1Shot track requires **mainnet** relay + 7702 upgrade. Build the relayer path to
> be network-configurable. Do the core market on Base Sepolia for cheap iteration, but make
> the 1Shot relay flow runnable on a mainnet config for the track submission (small amounts).
> Capabilities (`relayer_getCapabilities`) tells you which chains/tokens are live — **do not
> hardcode**.

---

## 2. Monorepo layout

```
consilium/
├── README.md                      # quickstart + demo script (you write this last)
├── .env.example                   # every key/var, documented
├── package.json                   # workspaces: contracts is foundry (separate), rest pnpm
├── pnpm-workspace.yaml
├── packages/
│   ├── contracts/                 # Foundry
│   │   ├── foundry.toml
│   │   ├── src/
│   │   │   ├── ConsiliumMarket.sol
│   │   │   └── MockUSDC.sol        # only for local Anvil; on Sepolia use real test USDC
│   │   ├── test/
│   │   │   ├── ConsiliumMarket.t.sol
│   │   │   └── Revert.t.sol        # proves over-cap stake reverts
│   │   ├── script/
│   │   │   └── Deploy.s.sol
│   │   └── deployments/            # written addresses per chain (json)
│   ├── shared/                    # TS types + config shared by agents & web
│   │   ├── src/
│   │   │   ├── env.ts              # zod-validated env loader
│   │   │   ├── chains.ts          # chain + token config, NO hardcoded relayer tokens
│   │   │   ├── abis.ts            # generated/typed ABIs
│   │   │   └── types.ts
│   ├── agents/                    # the autonomous actors + servers
│   │   ├── src/
│   │   │   ├── smartAccount.ts     # toMetaMaskSmartAccount helpers
│   │   │   ├── delegation.ts       # root + redelegation builders
│   │   │   ├── venice.ts           # chat / rpc / image clients
│   │   │   ├── oneshot.ts          # 1Shot JSON-RPC client + webhook verify
│   │   │   ├── researchServer.ts   # x402 SELLER (Express) — sells balance reads
│   │   │   ├── buyerClient.ts      # x402 BUYER (7710 delegation payload)
│   │   │   ├── fundManager.ts      # orchestrator: redelegates, runs a round
│   │   │   ├── traderAgent.ts      # Bull/Bear: reason (Venice) → buy data → stake
│   │   │   └── roundRunner.ts      # ties one full round together; emits events to web
│   │   └── webhook/
│   │       └── server.ts           # receives 1Shot webhooks, verifies Ed25519, broadcasts (SSE/WS)
│   └── web/                        # Next.js dashboard (App Router)
│       ├── app/
│       │   ├── page.tsx            # landing
│       │   ├── market/page.tsx     # live market view (SSE-driven, real tx links)
│       │   └── api/                # SSE relay if needed
│       └── components/
└── docs/
    └── DEMO.md                     # exact 3-minute video script
```

Use **pnpm workspaces** for `shared`, `agents`, `web`. Keep `contracts` as a standalone
Foundry project (don't fight node tooling into it). A root `package.json` script can shell
out to `forge`.

---

## 3. Environment & prerequisites

`.env.example` (document every line; never commit real `.env`):

```bash
# --- Chains ---
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_MAINNET_RPC_URL=https://mainnet.base.org
CHAIN_ID=84532                      # 84532 Base Sepolia for core; 8453 for 1Shot mainnet track run

# --- Test USDC on Base Sepolia (verify current address from Circle faucet docs at build time) ---
USDC_ADDRESS=                        # set after confirming the Base Sepolia USDC test token

# --- Keys (use fresh throwaway keys; fund with test USDC + a little ETH) ---
DEPLOYER_PRIVATE_KEY=
FUND_MANAGER_PRIVATE_KEY=
BULL_PRIVATE_KEY=
BEAR_PRIVATE_KEY=
RESEARCH_PRIVATE_KEY=                # research agent's payTo / smart account signer

# --- Venice (https://venice.ai/settings/api) ---
VENICE_API_KEY=
VENICE_BASE_URL=https://api.venice.ai/api/v1

# --- 1Shot public relayer (no signup needed) ---
ONESHOT_RELAYER_URL=https://relayer.1shotapi.com/relayers
WEBHOOK_PUBLIC_URL=                  # public https URL (ngrok/cloudflared) for 1Shot to POST to

# --- x402 ---
X402_FACILITATOR_URL=https://x402.org/facilitator   # testnet facilitator
```

Prereqs to install/verify in your environment:
- Foundry (`forge`, `cast`, `anvil`) — `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Node 20+ and pnpm
- A tunnel (`cloudflared` or `ngrok`) so 1Shot webhooks can reach your local `webhook/server.ts`
- Test funds: Base Sepolia ETH (faucet) + Base Sepolia test USDC (Circle faucet). Confirm the
  **current** test USDC address at build time from `https://faucet.circle.com` / Circle docs —
  do not trust a memorized address.

**Recommended:** install the official sponsor skills into Claude Code before you start — they
encode the exact payload/flow details:
```bash
npx skills add 1Shot-API/skills/public-relayer
# Venice skills: https://github.com/veniceai/skills
```

---

## 4. Smart contract — `ConsiliumMarket.sol`

**Purpose:** a minimal binary prediction market that (a) accepts YES/NO USDC stakes pulled
via ERC-7710 delegation redemption (i.e. the staker is a smart account redeeming a
delegation that transfers USDC into the market), (b) resolves against a watched wallet's
real USDC balance, (c) pays out winners. The contract itself does **not** enforce the
per-agent cap — **the caveat enforcer in the delegation does.** That separation is the whole
point: the contract is permissionless; the *budget* lives in MetaMask's DelegationManager.

### State / behavior
- `constructor(IERC20 usdc, address watchedWallet, uint256 threshold, uint64 deadline)`
- Stakes tracked per side: `mapping(uint8 side => uint256 total)` and per staker
  `mapping(address => Position)` where `Position { uint8 side; uint256 amount; }`.
- `stake(uint8 side, uint256 amount)`: `usdc.transferFrom(msg.sender, address(this), amount)`
  then record. **`msg.sender` is the agent's smart account**, which is moving funds it
  obtained by redeeming its delegation. (The over-cap revert happens *before* this, during
  delegation redemption — see §6.4. The contract stays simple.)
  - Use a custom error `MarketClosed()` if `block.timestamp >= deadline`.
- `resolve()`: require `block.timestamp >= deadline`, read
  `usdc.balanceOf(watchedWallet) >= threshold` → outcome YES else NO. Store `resolved` +
  `outcome`. Emit `Resolved(outcome, observedBalance)`.
- `claim()`: winners withdraw pro-rata share of the total pot (winning side splits the
  full pot proportionally to their stake). Standard parimutuel math; guard against
  double-claim; use checks-effects-interactions.
- Events for everything the UI shows: `Staked(address agent, uint8 side, uint256 amount)`,
  `Resolved(...)`, `Claimed(...)`.

### Solidity conventions (from foundry skill)
- `pragma solidity ^0.8.30;`, custom errors, `evm_version = "prague"`, optimizer on.
- Use OpenZeppelin `IERC20` + `SafeERC20`. Install via `forge install OpenZeppelin/openzeppelin-contracts`.
- ReentrancyGuard on `claim()`.

### `MockUSDC.sol`
6-decimal ERC20 with public `mint` — **local Anvil only**. On Sepolia use real test USDC so
the demo is legitimately onchain.

### Tests (`forge test -vvv` must pass)
`ConsiliumMarket.t.sol`:
- `test_StakeBothSides` — both agents stake, totals update.
- `test_ResolveYes_whenBalanceAboveThreshold` — `deal` watched wallet above `T`, warp past
  `D`, resolve → YES.
- `test_ResolveNo_whenBelowThreshold`.
- `test_ClaimPaysWinnersProRata` — winners get pot, losers get nothing, sums conserve.
- `test_RevertWhen_StakeAfterDeadline` — `vm.expectRevert(MarketClosed.selector)`.
- `testFuzz_ClaimNeverExceedsPot(uint256[] stakes)` — invariant: total claimed ≤ pot.

`Revert.t.sol` — the money-moment, tested at contract level as a backstop (the *real* enforcer
revert is exercised by the integration script at the **trader→executor hop**, §5.4 + §6.4, but
prove the math here too):
- Simulate a redemption that would transfer more than an agent's cap and assert the
  delegation-redemption path reverts. (If you can integrate the MetaMask DelegationManager +
  `ERC20TransferAmountEnforcer` in a fork test, do it — fork Base Sepolia with
  `--fork-url $BASE_SEPOLIA_RPC_URL`. Otherwise assert the enforcer contract's behavior in a
  focused unit test using its deployed address from the toolkit `environment`.)

Deliver a `Deploy.s.sol` that deploys `ConsiliumMarket` (and `MockUSDC` only on chainid
31337), writes addresses to `deployments/<chainId>.json`, and `console.log`s them.

---

## 5. MetaMask Smart Accounts Kit — delegation layer

> Package: `@metamask/smart-accounts-kit` (v1.6.x). Verified imports & call shapes below.
> Docs: redelegation https://docs.metamask.io/smart-accounts-kit/guides/delegation/create-redelegation/
> x402 buyer https://docs.metamask.io/smart-accounts-kit/guides/x402/buyer/delegations/

### 5.1 Smart accounts (`smartAccount.ts`)
Every actor (fund-manager, bull, bear, research) is a MetaMask smart account:

```ts
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

export const publicClient = createPublicClient({ chain: baseSepolia, transport: http(process.env.BASE_SEPOLIA_RPC_URL) })

export async function makeSmartAccount(pk: `0x${string}`) {
  const owner = privateKeyToAccount(pk)
  return toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [owner.address, [], [], []],
    deploySalt: '0x',
    signer: { account: owner },
  })
}
```
- **Deploy each smart account before it redeems anything** (the buyer guide warns: undeployed
  delegator → redemption fails). Deploy by sending its first user op, or via the toolkit's
  deployment path. Fund each with test USDC (+ tiny ETH if any path needs it; 1Shot covers gas
  for the relayed legs).

### 5.2 Root delegation: human → fund-manager
Use a real MetaMask browser signer for the human in the UI (ERC-7715 advanced-permissions
flow is the polished version). For headless agent runs, the human can be a smart account too.
Root delegation grants the fund-manager an `Erc20TransferAmount` scope (total market budget).

### 5.3 Redelegation: fund-manager → Bull / Bear  (THE A2A REQUIREMENT)
This is the verified pattern — narrow the scope, pass `parentDelegation`:

```ts
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseUnits } from 'viem'

const redelegation = createDelegation({
  scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: USDC, maxAmount: parseUnits('20', 6) },
  to: bullSmartAccount.address,
  from: fundManagerSmartAccount.address,
  parentDelegation: signedRootDelegation,   // <-- links the chain; without this, no A2A
  environment: fundManagerSmartAccount.environment,
})
const signedRedelegation = await fundManagerSmartAccount.signDelegation({ delegation: redelegation })
```
- Bull gets a `maxAmount` cap (e.g. 20 USDC); Bear likewise. **A child delegation can only
  narrow, never expand** — rely on that.
- To further constrain (e.g. single use), add caveats with `createCaveatBuilder` +
  `CaveatType.LimitedCalls`, set `authority = hashDelegation(parent)` (see redelegation doc's
  "Limit redelegation using caveats").

### 5.4 Third hop: trader → execution key  (DEEPER A2A THAN THE FIELD)
Make the delegation chain **3 levels deep**: `Human → fund-manager → trader → executor`.
Each trader redelegates a *narrower sliver* of its budget to a disposable per-round
**execution smart account** that actually submits the stake. This mirrors how real agent
systems isolate the hot signing key from the budget-holding identity, so it's principled, not
decorative — and it makes Consilium's A2A chain deeper than DelegAI's (master→worker) and
everyone else's two-level trees.

```ts
// trader (Bull) redelegates only what it intends to stake this round to a throwaway executor
const execDelegation = createDelegation({
  scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: USDC, maxAmount: stakeThisRound },
  to: bullExecutorSmartAccount.address,
  from: bullSmartAccount.address,
  parentDelegation: signedRedelegation,     // <-- chains to the fund-manager's grant, which chains to the human
  environment: bullSmartAccount.environment,
})
const signedExec = await bullSmartAccount.signDelegation({ delegation: execDelegation })
```
- The executor is the account whose delegation the 1Shot relayer redeems (§8). Its `to` for
  the *relayed* leg must equal the relayer `targetAddress` (capabilities); here the
  redelegation hop is trader→executor, and the executor then grants the relayer-scoped
  delegation. Keep the attenuation strict at every hop: `stakeThisRound ≤ trader cap ≤ manager
  cap ≤ human budget`.
- **This is also where the over-cap revert lives most naturally** (§6.4): have the executor
  attempt to redeem for more than `stakeThisRound` — the `ERC20TransferAmount` enforcer at the
  trader→executor hop rejects it. The deeper chain makes the revert *more* convincing: it proves
  attenuation holds even three hops from the human.
- Smoke assertion (`pnpm delegation:smoke`): print all three signed delegations, verify each
  child's `maxAmount ≤` its parent's, and verify `parentDelegation`/`authority` linkage via
  `hashDelegation`.

---

## 6. x402 + ERC-7710 — the inter-agent commerce rail

> x402 packages: `@x402/express`, `@x402/core`, `@x402/evm`, `@x402/fetch`.
> Network CAIP-2: Base Sepolia = `eip155:84532`. Testnet facilitator `https://x402.org/facilitator`.

### 6.1 Research agent = x402 SELLER (`researchServer.ts`)
Express server selling the premium data product: **the current USDC balance of watched
wallet `W`**, fetched via Venice Crypto RPC. Protect the route with x402 priced per call, and
**advertise ERC-7710 as the asset transfer method** so buyers pay via delegation.

```ts
import express from 'express'
import { paymentMiddleware } from '@x402/express'
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server'
import { registerExactEvmScheme } from '@x402/evm/exact/server'

const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: process.env.X402_FACILITATOR_URL }))
registerExactEvmScheme(server)

app.use(paymentMiddleware({
  'GET /research/balance': {
    accepts: [{ scheme: 'exact', price: '$0.05', network: 'eip155:84532', payTo: RESEARCH_ADDRESS }],
    description: 'Current USDC balance of the watched wallet (Venice RPC sourced)',
    mimeType: 'application/json',
  },
}, server))

app.get('/research/balance', async (_req, res) => {
  const balance = await veniceRpcBalanceOf(USDC, WATCHED_WALLET)  // §7.2
  res.json({ wallet: WATCHED_WALLET, usdc: balance, ts: Date.now() })
})
```
- **Dynamic pricing (the costly-signal twist):** vary `price` based on how "informative" the
  read is or how many times an agent has bought this round (e.g. price rises as deadline
  nears or as the same buyer re-queries). Implement as a small pricing function that sets the
  `accepts[].price` per request. Keep it real and explainable in the demo.
- The seller must declare `extra.assetTransferMethod = 'erc7710'` and supply
  `extra.facilitators` (facilitator addresses) in the 402 `PAYMENT-REQUIRED` challenge so the
  buyer can scope the `Redeemer` caveat. Confirm the exact field path the installed `@x402/evm`
  server scheme emits; the buyer guide consumes `accepted.extra.assetTransferMethod` and
  `accepted.extra.facilitators`.

> **v2 seam — custom 1Shot-routed facilitator (architect now, build later).** The hackathon
> invites "build your own x402 7710 facilitator on top of the 1Shot public relayer." We do NOT
> build it for v1 — the stock `HTTPFacilitatorClient` satisfies every requirement and a custom
> `/verify`+`/settle` is a multi-day effort with real failure surface. But keep the seam clean:
> the facilitator is injected via `HTTPFacilitatorClient({ url })`, so a future
> `ConsiliumFacilitator` that simulates the delegation redemption and routes `/settle` through
> `relayer_send7710Transaction` is a drop-in swap. Say exactly this in the README under "Future
> work" — it signals depth without the build cost.

### 6.2 Trader agents = x402 BUYER (`buyerClient.ts`)
Verified buyer flow (open delegation + Redeemer caveat → encode → PAYMENT-SIGNATURE):

```ts
import { CaveatType, createOpenDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { encodeDelegations } from '@metamask/smart-accounts-kit/utils'

// 1. GET the route with no PAYMENT-SIGNATURE → expect 402
const challenge = await fetch(url)                       // status 402
const pr = JSON.parse(Buffer.from(challenge.headers.get('PAYMENT-REQUIRED')!, 'base64').toString())
const accepted = pr.accepts[0]
if (accepted.extra.assetTransferMethod !== 'erc7710') throw new Error('need 7710 seller')

// 2. open root delegation from buyer smart account, restricted to facilitator(s)
const delegation = createOpenDelegation({
  from: buyerSmartAccount.address,
  environment: buyerSmartAccount.environment,
  scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: accepted.asset, maxAmount: BigInt(accepted.amount) },
  caveats: [{ type: CaveatType.Redeemer, redeemers: accepted.extra.facilitators }],
})
const signature = await buyerSmartAccount.signDelegation({ delegation })
const signed = { ...delegation, signature }

// 3. build x402 payload
const permissionContext = encodeDelegations([signed])
const paymentPayload = {
  x402Version: 2,
  accepted,
  payload: {
    delegationManager: buyerSmartAccount.environment.DelegationManager,
    permissionContext,
    delegator: buyerSmartAccount.address,
  },
}
const encodedPayment = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')

// 4. retry with PAYMENT-SIGNATURE
const res = await fetch(url, { headers: { 'PAYMENT-SIGNATURE': encodedPayment } })
const data = await res.json()       // the balance read
```
- The buyer's delegation here is funded from its **redelegated budget** from the fund-manager,
  so the cap chains all the way back to the human. Keep the data-purchase amounts well under
  the agent's cap (those succeed); the over-cap event is reserved for the staking step (§6.4).

### 6.3 Staking via the market (the work transaction)
After buying enough data, each agent stakes on the market. The stake moves USDC from the
agent's smart account into `ConsiliumMarket.stake(side, amount)`. Route this **through the
1Shot relayer** (§8) so gas is paid in USDC and the human/agents never need ETH — and so the
relayer webhook gives the UI its status.

### 6.4 THE REVERT money-moment
Deliberately have one agent attempt to stake **more than its redelegated cap**. Because the
stake pulls funds via a delegation scoped by `ERC20TransferAmount`, redemption reverts at the
enforcer:
```
ERC20TransferAmountEnforcer: allowance-exceeded   (or the current message — capture the real revert string)
```
- Implement `roundRunner.ts` with a flag `--demo-overcap` (or a UI button) that makes the
  losing agent request a stake above its cap. Capture the **real failed tx hash** (the relayer
  will report a terminal Reverted/Rejected status via webhook). Surface it in the UI as a red
  "rejected by enforcer" card linking to the explorer.
- Do NOT add an app-side check that pre-empts this. The point is the chain rejects it. Your
  code may *predict* it will fail (for UX copy) but must still submit it so the revert is real.

---

## 7. Venice — multimodal, all load-bearing (`venice.ts`)

> Base: `https://api.venice.ai/api/v1`, OpenAI-compatible. Auth: `Authorization: Bearer $VENICE_API_KEY`.
> Docs: https://docs.venice.ai/overview/about-venice  (index at https://docs.venice.ai/llms.txt)

### 7.1 Chat — agent reasoning
Each trader uses Venice chat to decide its stance & size given the data it bought. Use a
current text model id (verify available ids at build time via the models endpoint; the docs
show ids like `openai-gpt-55`, `kimi-k2-6` — **fetch the live list, don't hardcode a guess**).
Optionally enable web search with `venice_parameters: { enable_web_search: "auto" }` for
richer reasoning. Demand structured JSON output (stance, sizeUSDC, rationale) and parse it
defensively.

### 7.2 Crypto RPC — the data the agents buy
The research agent fetches the watched wallet's USDC balance through Venice's RPC proxy:
```ts
// POST https://api.venice.ai/api/v1/crypto/rpc/base-mainnet  (or base-sepolia if supported; verify chain slug)
// eth_call balanceOf(address) on the USDC contract, decode the uint256, divide by 1e6
```
Verify the exact chain slug for Base from `https://docs.venice.ai/api-reference/endpoint/crypto/rpc`
(it lists supported chains/methods). If Venice RPC doesn't expose the target testnet, fetch
mainnet USDC balance of a real wallet for the read product and keep the *market resolution*
on the chain where the contract lives — document this split clearly; it's still legitimate
(the purchased datum is a real onchain read via Venice; the settlement is a real onchain read
via the contract).

### 7.3 Image — the resolution card
On `resolve()`, generate a shareable "verdict card" image via Venice image generation
summarizing: the question, outcome (YES/NO), observed balance vs threshold, and how much each
agent committed to evidence (the costly-signal payoff). Save the PNG and show it in the UI +
make it downloadable. This is the multimodal differentiator — **nobody else used Venice
image generation as part of the core flow.**

Build `venice.ts` with three exported clients: `veniceChat()`, `veniceRpc(chainSlug, jsonRpcBody)`,
`veniceImage(prompt) -> Buffer`. Each with try/catch and clear errors (no silent fallbacks
that would let the demo show fake data).

---

## 8. 1Shot permissionless relayer (`oneshot.ts`)

> JSON-RPC endpoint: `https://relayer.1shotapi.com/relayers`. No signup.
> Docs: https://1shotapi.com/docs/quickstarts/gas-sponsorship-eip7710
> Skill: `npx skills add 1Shot-API/skills/public-relayer`

### Methods (verified)
- `relayer_getCapabilities` — params `["<chainId>"]`. **Source of truth** for supported
  chains, accepted payment tokens, `feeCollector`, and **`targetAddress`**. The delegation's
  `to` (delegate) MUST equal the returned `targetAddress` or redemption fails. **Never
  hardcode payment tokens or targetAddress** — read them here, cache per session.
- `relayer_getFeeData` — params `{ chainId, token }` → `{ gasPrice, rate, minFee, expiry, context }`.
  Use for a pre-bundle rough fee quote. `feeAmount = max(convertedFee, minFee)`.
- `relayer_estimate7710Transaction` (single chain) / `relayer_estimate7710TransactionMultichain`
  — call immediately before send with the assembled bundle (omit `context`). Returns
  `success`, `requiredPaymentAmount`, `gasUsed`, and a signed `context` to lock the quote
  (~45s). Prefer this `context` over `getFeeData` when the bundle exists.
- `relayer_send7710Transaction` / `..Multichain` — submit. Include the signed `context`. For
  **local/script signers**, include one `authorizationList` entry (the EIP-7702 authorization)
  on first use to upgrade the EOA to a `7702StatelessDelegator` smart account. For the **browser
  EIP-7715 flow**, the wallet handles 7702 — do NOT add `authorizationList`. Set
  `destinationUrl` to your webhook URL.
- `relayer_getStatus` — poll fallback. Non-terminal: Pending/Submitted. Terminal:
  Confirmed/Rejected/Reverted.

### Build order for the relayed stake
1. `relayer_getCapabilities(chainId)` → pick payment token + read `targetAddress`.
2. Build the delegation for the stake with `to = targetAddress`, scoped to (a) the USDC fee
   transfer to `feeCollector` and (b) the stake call to `ConsiliumMarket`. Sign it.
   For local signers, produce the EIP-7702 authorization (one-time upgrade).
3. `relayer_estimate7710Transaction` with the bundle → get `requiredPaymentAmount` + `context`.
   If `requiredPaymentAmount` ≠ your mocked fee, update the fee execution amount + delegation
   scope, re-sign, re-estimate.
4. `relayer_send7710Transaction` with `context` + `destinationUrl` → returns `TaskId`.
5. Track via webhook (preferred) and `relayer_getStatus` (fallback) to terminal state.

### Implementation notes
- Fresh delegation `salt` every time (avoid replay collisions).
- Serialize all bigint/bytes to hex before JSON-RPC.
- Scope permissions narrowly (token, amount, target function) — no broad allowances.

### Webhook server (`webhook/server.ts`)
- Public HTTPS endpoint (tunnel) set as `destinationUrl`.
- **Verify Ed25519 signatures against the relayer JWKS** before accepting any state
  transition. Reject unverified events. (Fetch JWKS per the 1Shot webhook docs:
  https://1shotapi.com/docs/dev-platform/get-started/error-handling — confirm JWKS URL.)
- On a verified terminal event, broadcast to the web UI over SSE/WebSocket so the dashboard
  flips from Pending → Confirmed/Reverted **driven by the real relayer**, not a timer.

---

## 9. Round orchestration (`fundManager.ts` + `roundRunner.ts`)

One full round, all real:
1. **Setup**: deploy/ensure all 4 smart accounts; fund Bull/Bear with test USDC. Create root
   delegation (human → fund-manager). Fund-manager **redelegates** capped budgets to Bull & Bear.
2. **Research market opens**: research x402 seller is up. Bull & Bear each, driven by Venice
   chat reasoning, **buy** the balance read (x402 + 7710). Pricing is dynamic; the amount each
   commits is logged as its confidence signal. Multiple buys allowed until an agent's
   evidence is "sufficient" or it nears its self-imposed research budget (a fraction of its cap).
3. **Stake**: each agent stakes YES/NO on `ConsiliumMarket` via the **1Shot-relayed** 7710
   transaction (gas in USDC). UI shows pending → confirmed from the webhook.
4. **Over-cap demo** (on flag): the designated agent attempts an over-cap stake → enforcer
   revert → red card with real failed tx hash.
5. **Resolve**: after deadline, call `resolve()` (can be relayed too). Contract reads watched
   wallet balance, settles outcome.
6. **Card**: generate Venice image verdict card; winners `claim()`.
7. Every step emits a typed event consumed by the UI with the real tx hash / explorer link.

`roundRunner.ts` exposes a CLI (`pnpm round:run`, `pnpm round:run --demo-overcap`) and an
HTTP trigger the UI can call. It must be idempotent enough to re-run for the video.

---

## 10. Web dashboard (`packages/web`, Next.js App Router)

> Read the frontend-design skill conventions if available. Keep it clean, flat, dark-mode safe.

- **`/market`** is the star. It subscribes (SSE/WS) to round events and renders, in real time:
  - The question (wallet `W`, threshold `T`, deadline `D`) + a live countdown.
  - Two agent columns (Bull/Bear) showing: redelegated cap, USDC committed to evidence so far,
    number of data buys, current stance & size, each with the **real tx hash** linking to
    `sepolia.basescan.org`.
  - A "data price" ticker that rises as agents buy (the costly-signal visual — this is the
    moment that out-stories Intento's static "confidence: 0.87" label).
  - The stake transactions with live Pending→Confirmed status **driven by the 1Shot webhook**.
  - The over-cap attempt as a red "Rejected by caveat enforcer" card with the failed tx hash.
  - On resolution: the Venice-generated verdict card image, plus claim buttons.
- **Wallet connect** via MetaMask for the human's root grant (ERC-7715 advanced permissions
  is the polished path; a smart-account signer is the headless fallback).
- **No hardcoded state.** If an event hasn't happened, show an empty/pending state — never a
  pre-filled number. Every figure on screen must come from a real event with a tx hash. This
  is the explicit anti-Intento rule: a judge clicking any number should reach a real explorer
  page.

---

## 11. Build order (do it in this sequence; commit at each step)

1. **Repo + tooling**: pnpm workspaces, foundry project, `.env.example`, shared `env.ts`/`chains.ts`.
2. **Contracts**: `ConsiliumMarket.sol` + `MockUSDC.sol`, full test suite green
   (`forge test -vvv`), `Deploy.s.sol`, deploy to Base Sepolia, write `deployments/84532.json`.
3. **Venice client**: `venice.ts` with chat/rpc/image, each verified against a live call
   (write a `pnpm venice:smoke` script that hits all three and prints results).
4. **Smart accounts + delegation**: create/deploy the 4 smart accounts; root delegation +
   redelegation; a `pnpm delegation:smoke` that signs a redelegation and prints the chain.
5. **x402 seller + buyer**: stand up `researchServer.ts`; `buyerClient.ts` completes a real
   paid call end-to-end on Base Sepolia (`pnpm x402:smoke`). Confirm a settled USDC payment.
6. **1Shot relayer**: `oneshot.ts` — capabilities → estimate → send a relayed stake; webhook
   server verifying Ed25519. `pnpm oneshot:smoke` relays one stake and shows webhook status.
7. **Round runner**: wire 4–9 together; run a full round headless; verify every tx onchain.
8. **Over-cap revert**: implement the flag; capture the real revert; assert it in `Revert.t.sol`
   too.
9. **Web dashboard**: SSE from the round runner + webhook server; render real state.
10. **README + DEMO.md**: quickstart and the exact 3-minute video script (below).

Acceptance gate per step: a smoke script that proves the step works against the live
testnet/relayer/Venice — no mocks in the acceptance path.

---

## 12. Demo video script (`docs/DEMO.md`) — what wins

~3 minutes, every claim backed by a visible tx:
1. **(20s) Frame the anti-pattern**: "Most agent demos sign a delegation tree and show a
   dashboard of numbers that aren't real. Watch every number here resolve to an onchain tx."
2. **(30s) Human grants once**: MetaMask popup, human → fund-manager root delegation
   (ERC-7715). Show the fund-manager **redelegating** capped budgets to Bull & Bear — point at
   the `parentDelegation` chain.
3. **(40s) Live adversarial market**: Bull and Bear reason (Venice), then **buy the same
   balance read** from the research agent. Show the x402 402-challenge → PAYMENT-SIGNATURE →
   settled USDC. Show the **data-price ticker rising** as they compete for evidence — narrate
   "confidence is now a costly signal: the bluffing agent can't afford to look sure."
4. **(30s) Relayed stakes**: both stake via 1Shot, **gas paid in USDC**, UI flips
   Pending→Confirmed from the **webhook**. Click a hash → Basescan.
5. **(20s) THE REVERT**: the over-cap agent tries to stake past its budget → red "Rejected by
   caveat enforcer" card, real failed tx hash on Basescan. "No app code rejected this. The
   chain did. The cap is structural."
6. **(20s) Resolve + card**: deadline passes, `resolve()` reads the watched wallet's real USDC
   balance, outcome settles, **Venice generates the verdict card** showing who was right and
   how much each committed. Winners claim.
7. **(10s) Close**: one human signature → a bounded, adversarial, multi-agent onchain market.
   Four sponsors, each load-bearing.

---

## 12b. Primitive-coverage table (put this in the README — make the rigor legible)

Rival "DelegAI" wins points by *enumerating* "10+ Smart Accounts Kit APIs" so judges can check
boxes. We use the same breadth — advertise it. Maintain this table in the README and keep it
true; every row must point at a real file/usage, no aspirational entries.

| Primitive / API | Package | Where used in Consilium |
|---|---|---|
| `toMetaMaskSmartAccount` (Hybrid) | smart-accounts-kit | `smartAccount.ts` — all 4 actors + executors |
| `Implementation.Hybrid` | smart-accounts-kit | smart account creation |
| `createDelegation` + `parentDelegation` | smart-accounts-kit | `delegation.ts` — manager→trader redelegation (§5.3) |
| 3rd-hop `createDelegation` | smart-accounts-kit | `delegation.ts` — trader→executor (§5.4) |
| `createOpenDelegation` | smart-accounts-kit | `buyerClient.ts` — x402 buyer open delegation (§6.2) |
| `signDelegation` | smart-accounts-kit | every hop signs its delegation |
| `hashDelegation` | smart-accounts-kit/utils | linking child `authority` to parent; smoke assertions (§5.4) |
| `createCaveatBuilder` | smart-accounts-kit/utils | `LimitedCalls` / scope-narrowing caveats |
| `CaveatType.Redeemer` | smart-accounts-kit | restrict buyer delegation to facilitator (§6.2) |
| `CaveatType.LimitedCalls` | smart-accounts-kit | single-use redelegation constraint |
| `ScopeType.Erc20TransferAmount` | smart-accounts-kit | every USDC-scoped delegation |
| `encodeDelegations` | smart-accounts-kit/utils | building x402 `permissionContext` (§6.2) |
| `DelegationManager` (env) | smart-accounts-kit | x402 payload `delegationManager` field |
| `ERC20TransferAmountEnforcer` | toolkit deployment | the over-cap revert money-moment (§6.4) |
| x402 `exact` EVM scheme (seller+buyer) | @x402/evm | research seller + trader buyers (§6) |
| ERC-7710 `assetTransferMethod` | x402 + toolkit | delegation-based payment settlement (§6) |
| EIP-7702 stateless-delegator upgrade | 1Shot relayer | `oneshot.ts` first-use `authorizationList` (§8) |
| `relayer_getCapabilities/getFeeData/estimate7710/send7710/getStatus` | 1Shot | `oneshot.ts` full relay lifecycle (§8) |
| 1Shot webhook + Ed25519/JWKS verify | 1Shot | `webhook/server.ts` — UI status source (§8) |
| Venice `chat/completions` | Venice | agent reasoning (§7.1) |
| Venice `crypto/rpc` | Venice | the data agents buy (§7.2) |
| Venice `image/generations` | Venice | resolution verdict card (§7.3) |

## 12c. Competitive positioning (why Consilium beats the strong field, not just Intento)

Internalize these so the README/demo emphasize the right contrasts. Do not name rivals in the
submission — just make sure Consilium visibly out-does each one's strength:

- **vs DelegAI (rigor / primitive count):** match its breadth via §12b, then go *deeper* — a
  **3-level** chain (Human→manager→trader→executor) vs its master→worker. Same primitives,
  deeper attenuation story.
- **vs SwifterAI (full-stack polish + custom facilitator):** equal the multi-agent + 1Shot
  routing; concede the custom facilitator as documented v2 (the seam is built, §6.1 note). Win
  back on the *legible live demo* (every number → real tx) and multimodal Venice.
- **vs Clawmes (raw capability):** don't try to out-tool a 53-tool product. Win on **sharpness
  and verifiability** — one resolvable question, one market, every event provable onchain in 3
  minutes. Breadth loses to a crisp, judge-verifiable thesis.
- **vs r402 (clean "no self-reported claims" idea):** adopt its spirit — our costly-signal
  mechanic *is* "confidence you can't fake," and the enforcer revert *is* "the chain says no."
  We have its philosophical cleanliness **plus** a full four-sponsor flow.
- **vs VVVKernel / Artisan (focused Venice/x402 products):** we beat the Venice track outright
  with **three load-bearing Venice endpoints incl. image** — none of them use multimodal.
- **The field-wide gaps we occupy:** (1) only project using Venice multimodal; (2) only true
  *peer* A2A market (not a fan-out tree); (3) only demo where a judge can click any figure and
  hit a real explorer page.

---

## 13. Guardrails (re-read before you ship)
- **Never fake state.** Every UI figure ← a real event + tx hash. No timers standing in for
  webhooks. No hardcoded balances. This is the whole competitive thesis.
- **Don't pre-empt the enforcer revert in app code** — submit the over-cap tx for real.
- **Don't hardcode** relayer payment tokens, `targetAddress`, Venice model ids, or the USDC
  test address — discover each from its source at runtime/build time.
- **Verify webhook signatures** before trusting any status.
- Use fresh throwaway keys; small amounts; never commit secrets.
- If a sponsor API shape differs from this doc, **fetch the cited doc URL and follow the live
  version** — then update this file's note so we stay honest.
```