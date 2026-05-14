"use client";

import { useCallback, useRef, useState } from "react";
import type { ArmLandmarks } from "@/types/pose";
import { calcSwimSpeed } from "@/lib/swimSpeed";
import type { SwimSpeedResult } from "@/lib/swimSpeed";

// ~0.66s at 30fps — main window for per-frame metrics
const WINDOW_SIZE = 20;

// ~2s at 30fps — longer window for bilateral balance check
const BILATERAL_WINDOW_SIZE = 60;

export interface UseSwimTrackerResult {
  onLandmarks: (landmarks: ArmLandmarks) => void;
  swimSpeed: SwimSpeedResult;
}

const ZERO: SwimSpeedResult = {
  speed: 0,
  motionIntensity: 0,
  arcBonus: 0,
  alternatingBonus: 0,
  spamPenalty: 0,
  arcRatio: 0,
  alternationRatio: 0,
  bilateralBalance: 0.5,
};

export function useSwimTracker(): UseSwimTrackerResult {
  const windowRef = useRef<ArmLandmarks[]>([]);
  const bilateralWindowRef = useRef<ArmLandmarks[]>([]);
  const [swimSpeed, setSwimSpeed] = useState<SwimSpeedResult>(ZERO);

  const onLandmarks = useCallback((landmarks: ArmLandmarks) => {
    const w = windowRef.current;
    w.push(landmarks);
    if (w.length > WINDOW_SIZE) w.shift();

    const bw = bilateralWindowRef.current;
    bw.push(landmarks);
    if (bw.length > BILATERAL_WINDOW_SIZE) bw.shift();

    setSwimSpeed(calcSwimSpeed(w, bw));
  }, []);

  return { onLandmarks, swimSpeed };
}
