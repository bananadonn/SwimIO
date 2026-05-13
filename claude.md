# Project: Webcam Freestyle Racing Game

Browser-based multiplayer webcam racing game. Players compete by performing freestyle swimming arm motions in real life using their webcam. Intentionally chaotic, exhausting, funny, and socially interactive.

The webcam footage is the entertainment. Graphics stay minimal.

Reference vibe: Wii Sports, webcam party games, social challenge games.
NOT: simulation games, esports, realistic sports titles.

---

# 🎯 CURRENT PHASE: Phase 1 — Single-player Prototype

**Building right now:**
- Webcam feed with permission handling
- MediaPipe Pose integration (shoulders, elbows, wrists only)
- Local swim speed calculation
- Swim meter UI
- Progress bar toward 100m finish line
- Basic countdown + win condition

**DO NOT BUILD YET:**
- Multiplayer / Socket.IO
- LiveKit / WebRTC / voice chat
- Authentication / Supabase
- Matchmaking / lobbies / room codes
- Ranking / ELO
- Backend server
- Anti-cheat validation
- Reporting / moderation

When Phase 1 is working and tuned, we move to Phase 2 (motion tuning + calibration), then phases 3–6 as listed at the bottom.

---

# 🤝 How I Work

- Explain decisions before writing code. I want to understand what's being built, not just get outputs.
- One step at a time. Wait for confirmation before moving to the next chunk.
- Ask before making architectural choices that aren't already specified in this doc.
- Casual tone, not formal. Talk to me like a collaborator, not a documentation generator.
- When something is ambiguous, surface it as a question rather than picking silently.
- Prefer small, reviewable diffs. Avoid touching unrelated files.
- Update `PROGRESS.md` at the end of each working session with what changed, what's next, and any decisions made.

---

# 🔧 Locked-In Technical Decisions

**Framework:** Next.js (App Router), React, TypeScript, TailwindCSS
**Motion tracking:** MediaPipe Tasks Vision API (the current one, not the legacy `@mediapipe/pose` package)
**Future video/voice:** LiveKit (Phase 4)
**Future networking:** Socket.IO (Phase 3)
**Future backend:** Node.js
**Future database/auth:** Supabase (Phase 5)

**Deployment targets:**
- Frontend → Vercel
- Backend → Railway or Fly.io (decide in Phase 3)
- WebRTC → LiveKit Cloud (Phase 4)

---

# ❓ Decisions to Confirm Before Coding

Ask me these before starting Phase 1 work if they're not obvious from context:
- Distance units: is "100m" an arbitrary in-game unit, tied to stroke count, or tied to wrist travel distance in pixels? My current guess: arbitrary unit, ~30–60 strokes worth of travel.
- Where does motion math live: dedicated `useSwimTracker` hook + pure `swimSpeed.ts` util? Yes by default — confirm.
- Pose detector lifecycle: instantiate once, reuse across frames. Confirm.
- Frame loop: `requestAnimationFrame` driving pose detection, or fixed-interval (e.g. 30 Hz)? Default to `requestAnimationFrame` with internal throttling.

---

# 🎮 Core Gameplay Loop (Full Vision)

1. Open site → choose Guest / Login / Private Lobby
2. Grant webcam + mic permissions
3. Calibration check (camera, mic, upper body, both arms, motion test)
4. Matchmaking queue
5. Match found → WebRTC connection
6. Countdown → race starts
7. Players flail arms freestyle-style
8. Motion tracked locally, metrics sent via WebSockets
9. First to 100m OR leader after 30s wins
10. Victory screen → rematch / requeue / leave

Phase 1 only covers steps 2, 6, 7, 9 — for a single local player.

---

# 🏛️ Architectural Rules (Apply From Day One)

**NEVER:**
- Stream webcam video through the game server
- Send raw pose landmarks or webcam frames to the server
- Run motion detection on the server
- Trust client calculations as final truth (in multiplayer phases)

**ALWAYS:**
- Motion analysis happens locally in the browser
- WebRTC (LiveKit) handles webcam + mic peer-to-peer (Phase 4+)
- Socket.IO handles only gameplay metrics + state sync (Phase 3+)
- Server is the authority on race outcomes (Phase 3+)

---

# 🏊 Motion Tracking System

Track only:
- shoulders
- elbows
- wrists

Ignore legs, hips, feet. Support both standing and seated play. Only requirement: full arm movement visible on camera.

**Philosophy — reward:**
- intensity
- large arm arcs
- energetic flailing
- sustained motion
- alternating left/right rhythm

**Philosophy — do NOT reward:**
- realistic swim form
- precise technique
- micro-movements / wrist flicks
- shaking arms in place

This is not a swim simulator. Chaos > correctness.

---

# 📊 Swim Speed Formula (Starting Point)