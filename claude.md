@AGENTS.md

# Visual Direction

The UI should feel like a collision of three things:
1. Premium athleticwear brand campaign (Nike swim, sport editorial photography)
2. Shonen manga / sports anime energy (bold framing, dramatic crops, "main character" presentation of players)
3. Modern gaming storefront polish (Nintendo Switch card-style layouts, dark mode confidence)

This is NOT: cute, retro, corporate SaaS, brutalist, cyberpunk, or generic AI-gradient.

## Color Palette

Primary mode: dark
- Background base: near-black, slight cool tint (`#0A0E14`) → Tailwind: `bg-base`
- Surface: elevated near-black (`#141A22`) → `bg-surface`
- Surface elevated: (`#1C2433`) → `bg-surface-2`
- Primary text: clean off-white (`#F5F7FA`) → `text-text`
- Muted text: cool gray (`#8B95A5`) → `text-muted`

Accent colors:
- Pool blue: `#00B4F0` → `bg-pool` / `text-pool` — primary accent, CTAs, progress fills
- Alert/energy: coral `#FF4D4D` → `text-coral` — loss states, timer warnings
- Win/ranked: electric yellow `#FFD600` → `text-energy` — win states, ranked badge, GO! countdown

Use color with restraint. Pool blue should "pop out of the water" — high saturation against dark UI.

## Typography

- Display font: **Anton** (Google Font) — used for player names, timers, distance counters, CTAs, victory screen. Always paired with `uppercase tracking-tight`. Loaded as `--font-anton`, exposed as `font-display` Tailwind utility.
- Body font: **Geist** — all other UI text.
- Numbers (timer, distance, speed): `font-mono tabular-nums font-bold`, large.

## Layout & Composition

- Editorial spacing — generous negative space, like a magazine spread
- Confident asymmetry over rigid grids
- Cards: `bg-surface` background, `rounded-xl`, subtle `border border-surface-2`
- Lots of negative space; webcam footage is the loudest element on screen

## Player Presentation

- Videos get sports-broadcast **lower-thirds**: player name overlaid bottom-left of webcam feed, Anton font, semi-transparent dark gradient behind
- Player names in racing HUD: Anton, large, uppercase — fighter-select energy

## Motion & Animation

- Animations: athletic and punchy, not floaty
- Transitions: 150–250ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-expo feel)
- Countdown numbers **slam in** from large scale — use `.animate-slam` keyframe
- GO! uses `.animate-go-slam` — expands from small + wide tracking to normal
- Progress bars fill with `transition-all duration-100`
- Victory: hard cut, dramatic — `YOU WIN` in massive Anton + energy yellow

## In-Game HUD

- Minimal but bold
- Timer: large, monospace, top-right, turns `text-coral` at 10s
- Race progress: two lanes, player name in Anton, distance in large mono
- Speed meter: pool-blue fill, thin, labeled `SPEED` in small caps tracking
- Form feedback: same minimal rows but styled to palette

## North Star

Loading screen of a fighting game built by Nike, art-directed by a shonen anime studio, with the UX restraint of a Nintendo first-party title.
