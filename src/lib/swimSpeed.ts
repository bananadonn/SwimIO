import type { ArmLandmarks } from "@/types/pose";

export interface SwimSpeedResult {
  speed: number;
  // Weighted sub-scores (for debugging / tuning)
  motionIntensity: number;
  arcBonus: number;
  alternatingBonus: number;
  spamPenalty: number;
  // Raw ratios 0–1 (for FormFeedback display, before weighting)
  arcRatio: number;          // avg vertical arc vs shoulder width, clamped to 0–1
  alternationRatio: number;  // fraction of frames with opposing arm directions
  bilateralBalance: number;  // 1 = perfectly balanced, 0 = all one arm
}

// All tunable numbers live here — nowhere else
export const WEIGHTS = {
  motionIntensity: 2.0,
  arcBonus: 1.5,
  // ~0.6 is the realistic ceiling for good freestyle (direction-change dead zone
  // at each stroke peak). Weight scaled so 0.6 ratio gives a meaningful contribution.
  alternatingBonus: 1.8,
  spamPenalty: 2.0,
  spamThreshold: 0.3,
  // Minimum per-frame vertical velocity (raw normalized coords) to count as
  // intentional motion. Real strokes ~0.005–0.015/frame; camera jitter ~0.001–0.003.
  minVelocity: 0.005,
  // Dead zone: if avg combined delta stays below this the player is still.
  noiseFloor: 0.004,
  // Stroke rate cap: max zero-crossings per arm in the 20-frame window.
  // 8 crossings / 0.66s ≈ 12/s ≈ 6 full cycles/second — physically impossible.
  maxCrossingsPerWindow: 8,
  // Bilateral: if the dominant arm exceeds this share of total motion, a
  // halving penalty ramps in linearly up to full 0.5× at 100% dominance.
  bilateralThreshold: 0.8,
} as const;

// Arc size (shoulder-widths) mapped to 1.0 on the display meter.
// Tune alongside FormFeedback if the meter feels too easy/hard to fill.
const ARC_DISPLAY_MAX = 1.5;

function dist2D(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Count sign changes in a velocity array, ignoring values below minMagnitude
// so camera noise doesn't add phantom crossings.
function countZeroCrossings(velocities: number[]): number {
  let count = 0;
  for (let i = 1; i < velocities.length; i++) {
    const prev = velocities[i - 1];
    const curr = velocities[i];
    if (
      Math.abs(prev) >= WEIGHTS.minVelocity &&
      Math.abs(curr) >= WEIGHTS.minVelocity &&
      prev > 0 !== curr > 0
    ) {
      count++;
    }
  }
  return count;
}

const ZERO_RESULT: SwimSpeedResult = {
  speed: 0,
  motionIntensity: 0,
  arcBonus: 0,
  alternatingBonus: 0,
  spamPenalty: 0,
  arcRatio: 0,
  alternationRatio: 0,
  bilateralBalance: 0.5,
};

/**
 * Pure function — no React, no side effects.
 *
 * window         — 20-frame sliding window (~0.66s) for per-frame metrics.
 * bilateralWindow — 60-frame sliding window (~2s) for bilateral balance.
 *                  Optional; if omitted the bilateral check is skipped.
 */
export function calcSwimSpeed(
  window: ArmLandmarks[],
  bilateralWindow: ArmLandmarks[] = []
): SwimSpeedResult {
  if (window.length < 2) return ZERO_RESULT;

  const n = window.length;

  // ── 1. Shoulder width ──────────────────────────────────────────────────────
  let totalShoulderWidth = 0;
  for (const frame of window) {
    totalShoulderWidth += dist2D(frame.leftShoulder, frame.rightShoulder);
  }
  const avgShoulderWidth = totalShoulderWidth / n;
  if (avgShoulderWidth < 0.01) return ZERO_RESULT;

  // ── 2. Per-frame wrist deltas and vertical velocities ─────────────────────
  const leftDeltas: number[] = [];
  const rightDeltas: number[] = [];
  const leftVY: number[] = [];
  const rightVY: number[] = [];

  for (let i = 1; i < n; i++) {
    const prev = window[i - 1];
    const curr = window[i];
    const sw =
      dist2D(curr.leftShoulder, curr.rightShoulder) || avgShoulderWidth;

    leftDeltas.push(dist2D(curr.leftWrist, prev.leftWrist) / sw);
    rightDeltas.push(dist2D(curr.rightWrist, prev.rightWrist) / sw);
    leftVY.push(curr.leftWrist.y - prev.leftWrist.y);
    rightVY.push(curr.rightWrist.y - prev.rightWrist.y);
  }

  const frameCount = leftDeltas.length;

  // ── 3. Dead zone ──────────────────────────────────────────────────────────
  const avgLeft = leftDeltas.reduce((a, b) => a + b, 0) / frameCount;
  const avgRight = rightDeltas.reduce((a, b) => a + b, 0) / frameCount;
  if ((avgLeft + avgRight) / 2 < WEIGHTS.noiseFloor) return ZERO_RESULT;

  // ── 4. Stroke rate cap ────────────────────────────────────────────────────
  // If an arm's zero-crossing count exceeds the threshold its delta is zeroed.
  // This kills speed from pure wrist-flicking while leaving real strokes untouched.
  const leftCrossings = countZeroCrossings(leftVY);
  const rightCrossings = countZeroCrossings(rightVY);
  const effectiveLeft = leftCrossings > WEIGHTS.maxCrossingsPerWindow ? 0 : avgLeft;
  const effectiveRight = rightCrossings > WEIGHTS.maxCrossingsPerWindow ? 0 : avgRight;

  // ── 5. Bilateral balance (60-frame window) ────────────────────────────────
  // If one arm dominates for ~2s, ramp in a 0.5× penalty on motionIntensity.
  let bilateralBalance = 0.5;
  let bilateralMultiplier = 1;

  if (bilateralWindow.length >= 2) {
    let bwLeft = 0;
    let bwRight = 0;
    for (let i = 1; i < bilateralWindow.length; i++) {
      const prev = bilateralWindow[i - 1];
      const curr = bilateralWindow[i];
      const sw =
        dist2D(curr.leftShoulder, curr.rightShoulder) || avgShoulderWidth;
      bwLeft += dist2D(curr.leftWrist, prev.leftWrist) / sw;
      bwRight += dist2D(curr.rightWrist, prev.rightWrist) / sw;
    }
    const bwTotal = bwLeft + bwRight;
    if (bwTotal > 0.01) {
      const leftShare = bwLeft / bwTotal;
      const rightShare = bwRight / bwTotal;
      // 1 = perfectly balanced, 0 = all one arm
      bilateralBalance = 2 * Math.min(leftShare, rightShare);

      const dominant = Math.max(leftShare, rightShare);
      if (dominant > WEIGHTS.bilateralThreshold) {
        // Linear ramp: 1.0 at threshold → 0.5 at 100% dominance
        bilateralMultiplier =
          1 -
          0.5 *
            ((dominant - WEIGHTS.bilateralThreshold) /
              (1 - WEIGHTS.bilateralThreshold));
      }
    }
  }

  // ── 6. Motion intensity ───────────────────────────────────────────────────
  const motionIntensity =
    (effectiveLeft + effectiveRight) *
    WEIGHTS.motionIntensity *
    bilateralMultiplier;

  // ── 7. Arc size ───────────────────────────────────────────────────────────
  const leftYs = window.map((f) => f.leftWrist.y);
  const rightYs = window.map((f) => f.rightWrist.y);
  const leftArc =
    (Math.max(...leftYs) - Math.min(...leftYs)) / avgShoulderWidth;
  const rightArc =
    (Math.max(...rightYs) - Math.min(...rightYs)) / avgShoulderWidth;
  const avgArc = (leftArc + rightArc) / 2;
  const arcBonus = avgArc * WEIGHTS.arcBonus;
  const arcRatio = Math.min(avgArc / ARC_DISPLAY_MAX, 1);

  // ── 8. Alternating rhythm ─────────────────────────────────────────────────
  let alternatingFrames = 0;
  for (let i = 0; i < frameCount; i++) {
    const lv = leftVY[i];
    const rv = rightVY[i];
    if (
      Math.abs(lv) > WEIGHTS.minVelocity &&
      Math.abs(rv) > WEIGHTS.minVelocity &&
      lv > 0 !== rv > 0
    ) {
      alternatingFrames++;
    }
  }
  const alternationRatio = alternatingFrames / frameCount;
  const alternatingBonus = alternationRatio * WEIGHTS.alternatingBonus;

  // ── 9. Spam penalty ───────────────────────────────────────────────────────
  const minArc = Math.min(leftArc, rightArc);
  const spamPenalty =
    minArc < WEIGHTS.spamThreshold
      ? (WEIGHTS.spamThreshold - minArc) * WEIGHTS.spamPenalty
      : 0;

  // ── 10. Final score ───────────────────────────────────────────────────────
  const speed = Math.max(
    0,
    motionIntensity + arcBonus + alternatingBonus - spamPenalty
  );

  return {
    speed,
    motionIntensity,
    arcBonus,
    alternatingBonus,
    spamPenalty,
    arcRatio,
    alternationRatio,
    bilateralBalance,
  };
}
