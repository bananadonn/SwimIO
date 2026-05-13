import type { ArmLandmarks } from "@/types/pose";

export interface SwimSpeedResult {
  speed: number;
  // Sub-scores exposed so we can debug and tune weights in the UI
  motionIntensity: number;
  arcBonus: number;
  alternatingBonus: number;
  spamPenalty: number;
}

// All tunable numbers live here — nowhere else
export const WEIGHTS = {
  // How much raw wrist speed contributes to the final score
  motionIntensity: 2.0,

  // Bonus for sweeping through a large vertical arc
  arcBonus: 1.5,

  // Bonus for alternating L/R rhythm.
  // ~0.6 is the realistic ceiling for good freestyle (wrists change direction at stroke peaks,
  // producing a dead zone each cycle). Weight scaled so 0.6 ratio = meaningful contribution.
  alternatingBonus: 1.8,

  // How hard we penalize arcs below the spam threshold
  spamPenalty: 2.0,

  // Minimum arc size (in shoulder-widths) before the spam penalty kicks in.
  // Real strokes clear this easily; wrist flicks do not.
  spamThreshold: 0.3,

  // Minimum per-frame vertical velocity (raw normalized coords, NOT shoulder-width-scaled)
  // to count as intentional motion for the alternating detector.
  // Real strokes at 30fps produce ~0.005–0.015 per frame; camera jitter is ~0.001–0.003.
  minVelocity: 0.005,

  // If combined average wrist delta (shoulder-width-normalized) stays below this,
  // the player is still — return zero before anything else accumulates.
  noiseFloor: 0.004,
} as const;

function dist2D(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const ZERO_RESULT: SwimSpeedResult = {
  speed: 0,
  motionIntensity: 0,
  arcBonus: 0,
  alternatingBonus: 0,
  spamPenalty: 0,
};

/**
 * Pure function — no React, no side effects.
 * Takes a sliding window of recent pose snapshots, returns a swim speed scalar.
 * Caller is responsible for maintaining the window (append latest, drop oldest).
 */
export function calcSwimSpeed(window: ArmLandmarks[]): SwimSpeedResult {
  if (window.length < 2) return ZERO_RESULT;

  const n = window.length;

  // ── 1. Shoulder width ──────────────────────────────────────────────────────
  // Average across the window so a single noisy frame doesn't skew everything.
  // All distances below divide by this to be camera-distance-independent.
  let totalShoulderWidth = 0;
  for (const frame of window) {
    totalShoulderWidth += dist2D(frame.leftShoulder, frame.rightShoulder);
  }
  const avgShoulderWidth = totalShoulderWidth / n;
  if (avgShoulderWidth < 0.01) return ZERO_RESULT; // pose is degenerate / off-screen

  // ── 2. Per-frame wrist deltas and vertical velocities ─────────────────────
  // We compute these for every consecutive pair, then aggregate below.
  const leftDeltas: number[] = [];
  const rightDeltas: number[] = [];
  const leftVY: number[] = []; // positive = wrist moving downward (y increases downward)
  const rightVY: number[] = [];

  for (let i = 1; i < n; i++) {
    const prev = window[i - 1];
    const curr = window[i];

    // Use per-frame shoulder width for the delta normalisation so a sudden
    // zoom/step-back doesn't register as a huge "movement" spike.
    const sw =
      dist2D(curr.leftShoulder, curr.rightShoulder) || avgShoulderWidth;

    leftDeltas.push(dist2D(curr.leftWrist, prev.leftWrist) / sw);
    rightDeltas.push(dist2D(curr.rightWrist, prev.rightWrist) / sw);

    leftVY.push(curr.leftWrist.y - prev.leftWrist.y);
    rightVY.push(curr.rightWrist.y - prev.rightWrist.y);
  }

  const frameCount = leftDeltas.length; // = n - 1

  // ── 3. Motion intensity ───────────────────────────────────────────────────
  // Mean combined wrist speed across the window.
  // Both arms contribute equally — you can't coast on one arm.
  const avgLeft = leftDeltas.reduce((a, b) => a + b, 0) / frameCount;
  const avgRight = rightDeltas.reduce((a, b) => a + b, 0) / frameCount;

  // Dead zone: landmark jitter at rest produces a small non-zero delta.
  // If neither arm is moving meaningfully, return zero before anything accumulates.
  if ((avgLeft + avgRight) / 2 < WEIGHTS.noiseFloor) return ZERO_RESULT;

  const motionIntensity = (avgLeft + avgRight) * WEIGHTS.motionIntensity;

  // ── 4. Arc size ───────────────────────────────────────────────────────────
  // Vertical range each wrist covers over the whole window, normalised by
  // shoulder width. A sweeping freestyle stroke = large range. Flicking = tiny.
  const leftYs = window.map((f) => f.leftWrist.y);
  const rightYs = window.map((f) => f.rightWrist.y);
  const leftArc =
    (Math.max(...leftYs) - Math.min(...leftYs)) / avgShoulderWidth;
  const rightArc =
    (Math.max(...rightYs) - Math.min(...rightYs)) / avgShoulderWidth;
  const arcBonus = ((leftArc + rightArc) / 2) * WEIGHTS.arcBonus;

  // ── 5. Alternating rhythm ─────────────────────────────────────────────────
  // Count frames where left and right wrists are moving in opposite vertical
  // directions and both exceed the noise floor.
  // Rewards the natural L/R freestyle pattern; doesn't punish breaststroke-style
  // — it just doesn't bonus it.
  let alternatingFrames = 0;
  for (let i = 0; i < frameCount; i++) {
    const lv = leftVY[i];
    const rv = rightVY[i];
    const bothIntentional =
      Math.abs(lv) > WEIGHTS.minVelocity &&
      Math.abs(rv) > WEIGHTS.minVelocity;
    const oppositeDirections = lv > 0 !== rv > 0;
    if (bothIntentional && oppositeDirections) alternatingFrames++;
  }
  const alternationRatio = alternatingFrames / frameCount;
  const alternatingBonus = alternationRatio * WEIGHTS.alternatingBonus;

  // ── 6. Spam penalty ───────────────────────────────────────────────────────
  // If the smaller of the two arcs is below the threshold, the player is
  // spamming one arm (or both). Penalty scales linearly with how far below
  // the threshold they are, so it fades naturally as strokes improve.
  const minArc = Math.min(leftArc, rightArc);
  const spamPenalty =
    minArc < WEIGHTS.spamThreshold
      ? (WEIGHTS.spamThreshold - minArc) * WEIGHTS.spamPenalty
      : 0;

  // ── 7. Final score ────────────────────────────────────────────────────────
  const speed = Math.max(
    0,
    motionIntensity + arcBonus + alternatingBonus - spamPenalty
  );

  return { speed, motionIntensity, arcBonus, alternatingBonus, spamPenalty };
}
