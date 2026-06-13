# Consilium — Brand

> **Consilium** — a live, adversarial multi-agent prediction market on Base. Every figure traces
> to a real onchain transaction. The UI is a **live command center, not a dashboard.**

## Palette — "Mono Terminal"

Near-black neutral base; **color is used only as signal**. Controls are white-on-black (Nexa-style).
This makes the money-moments — the big YES/NO and the red enforcer-revert — pop hardest against an
otherwise chromeless surface. Dark is the primary mode (it's a war room); light is a sane fallback.

**Seeds (dark):** `bg-base oklch(0.12 0 0)` · `bg-elevated oklch(0.15 0 0)` · `primary oklch(0.97 0 0)` (near-white) · `fg-base oklch(0.96 0 0)`

### Signal colors (semantic — meaning, not decoration)
| Token | OKLCH | Use |
|---|---|---|
| `--yes` | `oklch(0.72 0.17 155)` | YES side, confirmed, profit (green) |
| `--no` | `oklch(0.64 0.20 22)` | NO side, loss (red) |
| `--pending` | `oklch(0.80 0.14 75)` | pending / submitted (amber) |
| `--reject` / `--destructive` | `oklch(0.62 0.21 22)` | enforcer revert, failed tx (bright red) |

### shadcn tokens (dark)
`--background 0.12 0 0` · `--card 0.15 0 0` · `--popover 0.17 0 0` · `--foreground 0.96 0 0` ·
`--muted-foreground 0.62 0 0` · `--border 0.24 0 0` · `--primary 0.97 0 0` / `--primary-foreground 0.15 0 0` ·
`--ring 0.55 0 0` · `--radius 0.5rem`. Full set in `packages/web/app/globals.css`.

## Typography
- **Sans:** Inter (Linear-crisp) — UI text, labels.
- **Mono:** JetBrains Mono — **every number, USDC amount, tx hash, countdown, address**. Mono is
  load-bearing here: it signals "this is real onchain data."
- Wired via `next/font/google` in `app/layout.tsx` → `--font-sans` / `--font-mono`.

## Tone / voice
Terse, precise, evidentiary. State facts with their proof: "bull staked 20 USDC ↗", not "bull is
confident." Numbers over adjectives. The chain is the authority — "rejected by the enforcer," not
"we blocked it."

## Dos / don'ts
- **Do** put an explorer ↗ on every figure that has a tx. Verification is the thesis.
- **Do** use mono for all onchain data; size YES/NO large (Polymarket-large).
- **Do** reserve color for meaning (green/red/amber). Everything else is neutral.
- **Don't** add gradients, glows, or brand color for decoration — it's a terminal.
- **Don't** show a number that can't be clicked through to a real tx.
