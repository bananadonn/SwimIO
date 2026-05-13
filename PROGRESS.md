# Progress Log

## Phase 1 — Complete (2026-05-13)

### What got built

**Infrastructure**
- Next.js 16 (App Router, TypeScript, TailwindCSS, ESLint, src/ dir)
- COOP/COEP headers in `next.config.ts` — required for MediaPipe WASM SharedArrayBuffer
- Landing page `/` with Start → `/play`

**Camera**
- `useWebcam` — permission request, stream lifecycle, all error states, track cleanup on unmount
- `WebcamFeed` — mirrored video (`scale-x-[-1]`), status overlays (requesting/denied/unavailable/error), retry button, overlay slot for game layers

**Motion tracking**
- `usePoseDetector` — MediaPipe Tasks Vision (`@mediapipe/tasks-vision@0.10.35`), lazy-loaded, GPU delegate with CPU fallback, rAF loop throttled to 30fps, extracts only the 6 arm landmarks (indices 11–16)
- `PoseOverlay` — canvas dots + skeleton lines; x-coordinate flipped to match CSS-mirrored video
- `src/types/pose.ts` — `ArmLandmarks` type + `LANDMARK_IDX` constants

**Swim speed formula** (`src/lib/swimSpeed.ts`)
- Pure function, no React
- Inputs: sliding window of 20 `ArmLandmarks` snapshots
- Components: motion intensity + arc bonus + alternating bonus − spam penalty
- All distances normalized by shoulder width (camera-distance-independent)
- `WEIGHTS` object at top of file — all tunable constants in one place
- Tuned values: `minVelocity: 0.005`, `alternatingBonus: 1.8`, `noiseFloor: 0.004`
- `useSwimTracker` — maintains the 20-frame sliding window, wraps `calcSwimSpeed`

**Race loop** (`useRace`)
- State machine: idle → countdown → racing → finished
- Speed acceleration: raw swim speed smoothed into `effectiveSpeed` via per-frame exponential filter (accel 0.025, decel 0.06) — prevents instant top speed
- Distance accumulates from `effectiveSpeed × METERS_PER_SPEED_PER_SECOND × deltaSeconds`
- Win condition: 100m reached OR 60s time cap
- Progress bar and timer bypass React state entirely — read from refs via their own rAF loops to avoid React scheduler lag at high update rates

**UI components**
- `Countdown` — 3/2/1/GO overlay, pop-in animation
- `SwimMeter` — horizontal speed bar, blue→cyan→white color ramp
- `ProgressBar` — 🏊──●──── Finish, direct DOM mutation via ref
- `RaceTimer` — countdown from 60s, turns red at 10s, direct DOM mutation via ref
- `WinScreen` — finish time or distance result + Play Again

**Tuned race feel**
- Max effort: ~19s finish
- Medium effort: ~23s finish
- Low effort: ~37s finish

---

### Deviations from claude.md

| Spec | Deviation | Why |
|---|---|---|
| "30-60 strokes" to finish | Distance accumulates from wrist speed × time, not discrete stroke count | Continuous accumulation is smoother and easier to tune; stroke counting would require peak detection |
| Win condition "first to 100m OR leader after 30s" | Max time extended to 60s | 30s was too short for lower-effort play; 60s gives a real fallback without feeling punishing |
| Progress bar renders via React state | Progress bar and timer use direct DOM mutation (refs + rAF) | React 18 concurrent scheduler deprioritized rapid setState calls at high swim speed, causing visible lag |

---

### Known issues / rough edges

- **Debug panel removed but speed sub-scores are gone** — `motionIntensity`, `arcBonus` etc. were shown during tuning but aren't accessible without re-adding the panel
- **No loading indicator during MediaPipe model download** — "Loading motion tracker…" message only shows if cam is already active; if cam permission is slow, there's a brief gap
- **`animate-ping-once` is a custom CSS class** — not a Tailwind utility, lives in `globals.css`; easy to miss if someone scans for Tailwind usage
- **No mobile testing done** — `facingMode: "user"` should work on phones but layout hasn't been tested on small screens
- **Race starts immediately after GO!** — there's no grace period; a player still recovering their position at GO gets penalized
- **Speed stays in window after you leave frame** — if arms go out of frame, landmarks return null, speed decays via noiseFloor but doesn't hard-reset

---

### Open tuning questions

- `WEIGHTS.spamThreshold: 0.3` — not battle-tested against many players; could be too strict or too lenient depending on arm length / camera distance
- `WEIGHTS.alternatingBonus: 1.8` — scaled for ~0.6 realistic alternation ceiling; a player with very large arm movements might exceed this ceiling and need a higher weight
- `RACE_CONFIG.ACCEL_FACTOR: 0.025` / `DECEL_FACTOR: 0.06` — feel good for single player but may need adjustment in multiplayer where watching opponents adds competitive pressure
- `WINDOW_SIZE: 20` in `useSwimTracker` — ~0.66s at 30fps; longer window = smoother but more latency, shorter = more responsive but noisier
- Arc bonus uses raw vertical range — a player who naturally swims with more horizontal than vertical motion (e.g. leaning sideways) may be unfairly penalized

---

## Phase 2 — Not started
