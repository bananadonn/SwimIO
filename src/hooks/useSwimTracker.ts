"use client";

import { useCallback, useRef, useState } from "react";
import type { ArmLandmarks } from "@/types/pose";
import { calcSwimSpeed } from "@/lib/swimSpeed";
import type { SwimSpeedResult } from "@/lib/swimSpeed";

// ~0.66s of history at 30fps — enough to measure one full stroke cycle
const WINDOW_SIZE = 20;

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
};

export function useSwimTracker(): UseSwimTrackerResult {
  const windowRef = useRef<ArmLandmarks[]>([]);
  const [swimSpeed, setSwimSpeed] = useState<SwimSpeedResult>(ZERO);

  // Called by the pose detector on each frame that has a valid pose.
  // Stable reference (useCallback + ref) so it won't cause re-renders in callers.
  const onLandmarks = useCallback((landmarks: ArmLandmarks) => {
    const w = windowRef.current;
    w.push(landmarks);
    if (w.length > WINDOW_SIZE) w.shift();
    setSwimSpeed(calcSwimSpeed(w));
  }, []);

  return { onLandmarks, swimSpeed };
}
