"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const RACE_CONFIG = {
  // Tune to adjust race duration. At sustained effective speed ~2.5 → ~40s to finish.
  METERS_PER_SPEED_PER_SECOND: 0.8,
  FINISH_LINE_M: 100,
  RACE_DURATION_MS: 60_000,

  // Acceleration smoothing factors (per rAF frame at ~60fps).
  // Lower = slower ramp-up / decay.
  // ACCEL: reaches ~80% of target speed in ~1s
  // DECEL: drops ~80% in ~0.4s when effort stops
  ACCEL_FACTOR: 0.025,
  DECEL_FACTOR: 0.06,
} as const;

export type RaceState = "idle" | "countdown" | "racing" | "finished";

export interface RaceResult {
  finishTimeMs: number | null; // set if player crossed finish line; null if time ran out
  finalDistance: number;
}

export interface UseRaceResult {
  state: RaceState;
  countdown: number | null;      // 3 | 2 | 1 | 0 ("GO!") | null
  distanceRef: React.MutableRefObject<number>;
  elapsedMsRef: React.MutableRefObject<number>;
  result: RaceResult | null;
  start: () => void;
  playAgain: () => void;
}

export function useRace(swimSpeed: number): UseRaceResult {
  const [state, setState] = useState<RaceState>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [result, setResult] = useState<RaceResult | null>(null);

  // Refs that the rAF loop mutates directly — read by display components via their own rAF loops
  const distanceRef = useRef(0);
  const elapsedMsRef = useRef(0);

  // Raw swim speed — updated each render via effect so the rAF loop sees latest value
  const swimSpeedRef = useRef(swimSpeed);
  useEffect(() => { swimSpeedRef.current = swimSpeed; }, [swimSpeed]);

  // Smoothed "effective" speed — what actually drives distance accumulation
  const effectiveSpeedRef = useRef(0);

  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const timerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timerIdsRef.current.forEach(clearTimeout);
    timerIdsRef.current = [];
  }, []);

  // rAF loop — runs only during "racing"
  useEffect(() => {
    if (state !== "racing") return;

    lastTimestampRef.current = null;
    effectiveSpeedRef.current = 0; // reset momentum at race start

    function loop(ts: number) {
      // First frame: establish baseline timestamp only
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = ts;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Cap delta to 100ms so a backgrounded tab doesn't teleport the player
      const deltaMs = Math.min(ts - lastTimestampRef.current, 100);
      lastTimestampRef.current = ts;

      // Smooth raw speed into effective speed
      const raw = swimSpeedRef.current;
      const curr = effectiveSpeedRef.current;
      const factor = raw > curr ? RACE_CONFIG.ACCEL_FACTOR : RACE_CONFIG.DECEL_FACTOR;
      effectiveSpeedRef.current = curr + (raw - curr) * factor;

      // Accumulate distance from effective speed
      const newDist = Math.min(
        distanceRef.current +
          effectiveSpeedRef.current *
            RACE_CONFIG.METERS_PER_SPEED_PER_SECOND *
            (deltaMs / 1000),
        RACE_CONFIG.FINISH_LINE_M
      );
      const newElapsed = elapsedMsRef.current + deltaMs;

      distanceRef.current = newDist;
      elapsedMsRef.current = newElapsed;

      // Win conditions — React state only updated here, not every frame
      if (newDist >= RACE_CONFIG.FINISH_LINE_M) {
        setResult({ finishTimeMs: newElapsed, finalDistance: RACE_CONFIG.FINISH_LINE_M });
        setState("finished");
        return;
      }
      if (newElapsed >= RACE_CONFIG.RACE_DURATION_MS) {
        setResult({ finishTimeMs: null, finalDistance: Math.round(newDist) });
        setState("finished");
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [state]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [clearTimers]);

  const start = useCallback(() => {
    setCountdown(3);
    setState("countdown");

    timerIdsRef.current = [
      setTimeout(() => setCountdown(2), 1000),
      setTimeout(() => setCountdown(1), 2000),
      setTimeout(() => setCountdown(0), 3000),
      setTimeout(() => {
        distanceRef.current = 0;
        elapsedMsRef.current = 0;
        setCountdown(null);
        setState("racing");
      }, 3800),
    ];
  }, []);

  const playAgain = useCallback(() => {
    clearTimers();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    distanceRef.current = 0;
    elapsedMsRef.current = 0;
    effectiveSpeedRef.current = 0;
    setCountdown(null);
    setResult(null);
    setState("idle");
  }, [clearTimers]);

  return { state, countdown, distanceRef, elapsedMsRef, result, start, playAgain };
}
