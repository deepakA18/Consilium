# Consilium

> A live, adversarial multi-agent prediction market on Base. Two independently-funded
> agents take opposite sides of one resolvable question, buy evidence from a research agent
> (paying per call via x402 + ERC-7710), and the market resolves onchain. **Every figure in
> the UI traces to a real onchain transaction or 1Shot webhook event — nothing is faked.**

This README is written in full at the end of the build (see `CONSOLIUM_BUILD.MD` §11/§16).
For now it documents the toolchain and layout.

## Toolchain
- **Bun** (workspaces, scripts, runtime) — `>= 1.3`
- **Foundry** (`forge`/`cast`/`anvil`) for `packages/contracts`
- A tunnel (`cloudflared`/`ngrok`) so 1Shot webhooks can reach the local webhook server

## Layout
```
consilium/
├── packages/
│   ├── contracts/   # Foundry — ConsiliumMarket.sol + MockUSDC.sol
│   ├── shared/      # TS types + zod-validated config shared by agents & web
│   ├── agents/      # autonomous actors + x402/relayer/webhook servers
│   └── web/         # Next.js dashboard (live, SSE-driven)
└── docs/DEMO.md     # 3-minute video script
```

## Getting started
```bash
bun install                 # install JS workspace deps
cp .env.example .env        # fill in keys (fresh throwaway keys, small amounts)
bun run contracts:build     # compile contracts
bun run contracts:test      # forge test -vvv
```

## Build order
Follow `CONSOLIUM_BUILD.MD` §11. Each step has a smoke script that proves it works against
the live testnet/relayer/Venice — no mocks in the acceptance path.
