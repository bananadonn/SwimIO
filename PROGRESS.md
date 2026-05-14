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

## Phase 2 — In progress (2026-05-13)

### What got built

**Swim speed formula refinements** (`src/lib/swimSpeed.ts`)
- Added `arcRatio`, `alternationRatio`, `bilateralBalance` raw ratios to `SwimSpeedResult` for UI display
- Stroke rate cap: if an arm's zero-crossing count exceeds 8 in the 20-frame window, its delta is zeroed — kills speed from wrist-flicking, leaves real strokes untouched
- Bilateral balance penalty: if one arm dominates >80% of motion over the last 60 frames, motionIntensity is multiplied linearly from 1.0 → 0.5 — penalizes single-arm spamming sustainably
- `useSwimTracker` now maintains a separate 60-frame bilateral window alongside the existing 20-frame window

**FormFeedback component** (`src/components/FormFeedback.tsx`)
- Three metric rows: ARC, RHYTHM, BALANCE — each with a fill bar (green/amber) and a hint
- Thresholds: arc < 0.4, alternation < 0.3, balance < 0.4 → amber + hint text
- Always-on during racing; hint column stays invisible when form is good (no layout shift)

**ArmWarning component** (`src/components/ArmWarning.tsx`)
- Shows a yellow warning banner after 3s of arms out of frame — only active during racing

**Calibration hook** (`src/hooks/useCalibration.ts`)
- Full state machine: camera → mic → upper_body → both_arms → motion_test → complete
- Each step runs its own rAF loop reading from latest-value refs (no stale closures)
- Camera hard-fails on denied/unavailable/error
- Mic soft-fails — `skipMic()` advances without mic
- Body steps time out after 8s; motion test times out after 12s
- 600ms pass-flash before advancing to next step
- Exposes `holdProgress`, `motionProgress`, `timeoutProgress` (all 0–1) for UI bars

**Calibration UI** (`src/app/calibrate/page.tsx`, `src/components/calibration/StepIndicator.tsx`)
- `/calibrate` route: mounts webcam + pose detector + swim tracker + calibration hook
- `StepIndicator`: horizontal row of 5 dots (camera/mic/upper body/both arms/motion) — green=done, blue=active, red=fail, grey=pending
- Step-specific content: instructions, hold progress bar, timeout bar (turns red at 70%), fail card with Try Again
- Motion test step shows live `FormFeedback` so player can see their form quality
- Redirects to `/play` via `router.replace` when step reaches "complete"
- 3s grace period on `/play` mount (unchanged from Phase 1 landing grace period)

**Navigation**
- Landing page "Start" button now routes to `/calibrate` instead of `/play`
- `/play` "Play Again" flow bypasses calibration (hits `/play` directly)

### Decisions made
- No per-player formula calibration — genetic advantages stay in game (by design)
- No stroke detection / stroke counter
- Bilateral threshold at 80% dominance with linear 0.5× ramp — not a hard cutoff
- Stroke rate cap only fires at physically impossible rates (8 zero-crossings / 20 frames ≈ 12 direction changes/second)
- FormFeedback always visible during racing (not togglable)

### What's next
- Mobile layout review
- Multiplayer (Phase 3)

---

## Phase 3 — Complete (2026-05-13)

### What got built

**Shared types** (`shared/protocol.ts`)
- Single source of truth for all Socket.IO event names and payload types
- Imported by both `server/` and `src/` — TypeScript enforces no client/server drift

**Socket.IO game server** (`server/`)
- Standalone Node.js process (port 3001), separate `package.json` from Next.js
- `Matchmaker` — FIFO queue, instant 2-player pairing, socket→room mapping
- `Room` — server-authoritative race loop at 20Hz (`setInterval` 50ms), anti-cheat, disconnect handling
- Anti-cheat: max speed clamp (15), sequence number deduplication, rate limit (15 packets/sec)
- Disconnect: remaining player wins instantly, `race:finish` sent with survivor as winner
- `config.ts` centralizes all tunable constants

**Client multiplayer hook** (`src/hooks/useMultiplayerRace.ts`)
- Socket.IO connection lifecycle (created on mount, auto-reconnect)
- Full phase state machine: idle → queuing → countdown → racing → finished
- Sends `race:speed` at 10Hz during racing via `setInterval`
- Countdown: derived from server-sent `startsAt` timestamp, counted down locally
- Socket disconnect mid-race resets phase to idle

**UI components**
- `MultiProgressBar` — two-lane progress bar (YOU in blue, OPP in rose), 10Hz React state updates
- `/race/page.tsx` — name input, queuing state, dual progress HUD, result overlay

**Navigation**
- Landing page: "Race Online" → `/calibrate?next=/race` → `/race`, "Solo Training" → `/calibrate` → `/play`
- Calibrate server wrapper reads `?next=` param, passes to `CalibrateClient`

### Decisions made
- No rematch flow — "Race Again" returns to name entry idle state
- Server-authoritative distances only (no client-side prediction)
- Win condition on server: first to 100m, or leader when 60s expire

---

## Phase 4 — Complete (2026-05-13)

### What got built

**LiveKit Cloud integration** (`src/hooks/useLiveKit.ts`)
- Token received via Socket.IO `queue:matched` event (no separate HTTP endpoint)
- Connects during 3-second countdown; race proceeds regardless of LiveKit status
- Camera: 480p at 24fps; Mic: starts live, player can mute
- `RoomEvent.TrackMuted/Unmuted` keeps mute state in sync
- Token set to null via `leaveRace()` → React effect cleanup → `room.disconnect()`

**Token generation** (`server/src/matchmaker.ts`)
- `livekit-server-sdk` generates JWT tokens on match creation
- Both tokens generated in parallel (`Promise.all`), included in `queue:matched` payload
- Graceful fallback: `livekitToken: null` if credentials missing or SDK error
- `dotenv/config` loaded as first import in `server/src/index.ts`

**Dual video layout** (`src/app/race/page.tsx`)
- Side-by-side on `sm:` (≥640px), stacked on mobile — single Tailwind `flex flex-col sm:flex-row`
- Local camera: existing `WebcamFeed` component (no pose overlay during races)
- Opponent video: `RemoteVideo` component, LiveKit `track.attach(videoElement)`
- Countdown and result overlays span both feeds via absolute positioning on wrapper div
- `RemoteAudio`: hidden `<audio>` element for voice chat

**Safety controls**
- Mute button: disabled when LiveKit not connected, shows live mic / muted state
- Voice status indicator: green "● Voice" / yellow "○ Connecting…" / red "⚠ Voice unavailable"
- Leave match button: disconnects LiveKit (via token null) + Socket.IO + returns to idle

**COOP/COEP compatibility**
- No header changes needed: LiveKit transport (WebSocket signaling + WebRTC media) is exempt from COEP per spec
- MediaPipe WASM (jsdelivr CDN) already working with `require-corp` from Phase 1

### Decisions made
- No pose overlay during races (calibration only) — data still computed, just not displayed
- LiveKit failure never blocks races — treated as enhancement, not requirement
- Local video uses `useWebcam` stream (MediaPipe); LiveKit captures its own camera stream separately
- No separate token HTTP endpoint — tokens delivered through authenticated Socket.IO channel

---

## Phase 5 — Complete (2026-05-13)

### What got built

**Supabase Auth** (`src/lib/supabase/`, `src/middleware.ts`)
- `@supabase/ssr` browser client + server client (cookie-based session)
- Middleware at `src/middleware.ts` refreshes session on every request
- `/login` page: email+password sign-in/sign-up, Google OAuth button
- `/auth/callback` route: exchanges OAuth code for session
- `/auth/signout` route: signs out + redirects to home
- `useAuth` hook: browser-side session state + `getAccessToken()` helper

**Database schema** (run in Supabase SQL editor)
- `profiles` — UUID PK → auth.users, username (unique), avatar_url, created_at
- `player_stats` — elo (default 1000), wins, losses, fastest_time_ms, total_races, games_for_calibration
- `ranked_matches` — full match history with ELO snapshots
- `handle_new_user` trigger — auto-creates profile + stats on auth.users insert
- `record_ranked_match` SECURITY DEFINER function — atomic ELO update, called by server
- RLS: profiles/stats public-readable; own-row inserts; matches public-readable

**ELO system** (`server/src/elo.ts`)
- Variable K-factor: 60 (calibration, first 5 games), 40 (<1400), 20 (1400–2000), 10 (≥2000)
- Floor at 100; minimum +1 delta per match
- Applied at race finish, written via `record_ranked_match` RPC (async, non-blocking)

**Server Supabase integration** (`server/src/supabase.ts`)
- Service-role admin client for Supabase RPC writes
- `verifySupabaseJwt()` — validates token locally with `SUPABASE_JWT_SECRET` (no API round-trip)
- `fetchPlayerStats()` — loads elo, games_for_calibration, username for matched player
- `recordRankedMatch()` — calls `record_ranked_match` RPC

**Ranked matchmaking** (`server/src/matchmaker.ts`, `server/src/room.ts`)
- Two separate queues: `guest` (no auth) and `ranked` (JWT required)
- JWT verified and stats fetched before player enters ranked queue
- `queue:matched` payload now includes `mode` and `opponentElo`
- `race:finish` payload now includes `eloDelta` and `newElo` (null for guest mode)

**UI updates**
- Home page is now a server component — shows signed-in username + ELO, Sign in / Sign out links
- `/profile` page — server-rendered stats grid (ELO, wins, losses, win rate, best time)
- `/race` page — detects `?mode=ranked`, shows "Ranked Race" badge, ELO delta on result overlay
- `RankedReadyForm` — shows authenticated player name, yellow "Find Ranked Match" button

### Decisions made
- No ranked rematch — "Race Again" returns to idle, player re-queues
- Guest races never affect ELO — mode enforced server-side
- Server verifies JWT locally (no Supabase API call) for low-latency queue join
- Profile auto-created on sign-up via database trigger (no extra API call from client)
- Google OAuth only — no GitHub or other providers (can add later via Supabase dashboard)

### Setup required (one-time)
1. Run SQL schema in Supabase SQL editor
2. Configure Google OAuth in Google Cloud Console → Supabase dashboard
3. Copy JWT secret from Supabase Settings → API → paste into `server/.env`

### What's next
- Username conflict handling on sign-up (trigger uses email prefix as fallback; could collide)
- Leaderboard page
- Profile username editing
