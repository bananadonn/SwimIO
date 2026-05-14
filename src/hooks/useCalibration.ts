"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArmLandmarks } from "@/types/pose";
import type { WebcamStatus } from "@/hooks/useWebcam";
import type { DetectorStatus } from "@/hooks/usePoseDetector";

export const CALIBRATION_CONFIG = {
  VISIBILITY_THRESHOLD: 0.5,
  // How long the body/arm condition must be held to pass
  HOLD_DURATION_MS: 2000,
  // Time before an upper_body or both_arms step times out
  BODY_TIMEOUT_MS: 8000,
  // Total window to achieve the motion hold
  MOTION_TIMEOUT_MS: 12000,
  MOTION_SPEED_THRESHOLD: 1.5,
  // Brief "pass" flash before advancing to next step
  PASS_ANIMATION_MS: 600,
} as const;

export type CalibrationStep =
  | "camera"
  | "mic"
  | "upper_body"
  | "both_arms"
  | "motion_test"
  | "complete";

export type CalibrationStepStatus = "checking" | "pass" | "fail";

export interface UseCalibrationResult {
  step: CalibrationStep;
  stepStatus: CalibrationStepStatus;
  micGranted: boolean | null; // null = not yet checked
  holdProgress: number;       // 0–1: how long condition has been continuously met
  motionProgress: number;     // 0–1: motion_test only
  timeoutProgress: number;    // 0–1: how much of the step timeout has elapsed
  retry: () => void;
  skipMic: () => void;        // advances past mic step without mic
}

interface CalibrationParams {
  webcamStatus: WebcamStatus;
  detectorStatus: DetectorStatus;
  landmarks: ArmLandmarks | null;
  swimSpeed: number;
}

export function useCalibration({
  webcamStatus,
  detectorStatus,
  landmarks,
  swimSpeed,
}: CalibrationParams): UseCalibrationResult {
  const [step, setStep] = useState<CalibrationStep>("camera");
  const [stepStatus, setStepStatus] = useState<CalibrationStepStatus>("checking");
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [motionProgress, setMotionProgress] = useState(0);
  const [timeoutProgress, setTimeoutProgress] = useState(0);

  // Latest-value refs — rAF loops read from these so they never need
  // to be recreated just because landmarks/swimSpeed changed.
  const landmarksRef = useRef(landmarks);
  useEffect(() => { landmarksRef.current = landmarks; }, [landmarks]);

  const swimSpeedRef = useRef(swimSpeed);
  useEffect(() => { swimSpeedRef.current = swimSpeed; }, [swimSpeed]);

  // Tracks when the current condition was first continuously met
  const conditionStartRef = useRef<number | null>(null);

  // Advance to next step with a brief pass-flash
  const advance = useCallback((nextStep: CalibrationStep) => {
    setStepStatus("pass");
    setTimeout(() => {
      conditionStartRef.current = null;
      setStep(nextStep);
      setStepStatus("checking");
      setHoldProgress(0);
      setMotionProgress(0);
      setTimeoutProgress(0);
    }, CALIBRATION_CONFIG.PASS_ANIMATION_MS);
  }, []);

  // ── Camera ─────────────────────────────────────────────────────────────────
  // Auto-advances once webcam stream is live and MediaPipe is loaded.
  // Hard-fails on denied / unavailable.
  useEffect(() => {
    if (step !== "camera" || stepStatus !== "checking") return;

    if (
      webcamStatus === "denied" ||
      webcamStatus === "unavailable" ||
      webcamStatus === "error"
    ) {
      setStepStatus("fail");
      return;
    }

    if (webcamStatus === "active" && detectorStatus === "ready") {
      advance("mic");
    }
  }, [step, stepStatus, webcamStatus, detectorStatus, advance]);

  // ── Mic ────────────────────────────────────────────────────────────────────
  // Requests mic permission once. Soft-fails on denial — user can skip.
  useEffect(() => {
    if (step !== "mic" || stepStatus !== "checking") return;

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (cancelled) return;
        // Stop immediately — we only needed the permission grant
        stream.getTracks().forEach((t) => t.stop());
        setMicGranted(true);
        advance("upper_body");
      })
      .catch(() => {
        if (cancelled) return;
        setMicGranted(false);
        setStepStatus("fail");
      });

    return () => { cancelled = true; };
  }, [step, stepStatus, advance]);

  // ── Upper body ─────────────────────────────────────────────────────────────
  // Passes when both shoulders are visible for HOLD_DURATION_MS.
  // Times out after BODY_TIMEOUT_MS.
  useEffect(() => {
    if (step !== "upper_body" || stepStatus !== "checking") return;

    conditionStartRef.current = null;
    const stepStart = Date.now();
    let raf: number;

    function tick() {
      const now = Date.now();
      const elapsed = now - stepStart;

      setTimeoutProgress(
        Math.min(elapsed / CALIBRATION_CONFIG.BODY_TIMEOUT_MS, 1)
      );

      if (elapsed >= CALIBRATION_CONFIG.BODY_TIMEOUT_MS) {
        setStepStatus("fail");
        return;
      }

      const lm = landmarksRef.current;
      const VIS = CALIBRATION_CONFIG.VISIBILITY_THRESHOLD;
      const condMet =
        lm !== null &&
        (lm.leftShoulder.visibility ?? 0) >= VIS &&
        (lm.rightShoulder.visibility ?? 0) >= VIS;

      if (condMet) {
        if (conditionStartRef.current === null) conditionStartRef.current = now;
        const held = now - conditionStartRef.current;
        setHoldProgress(Math.min(held / CALIBRATION_CONFIG.HOLD_DURATION_MS, 1));
        if (held >= CALIBRATION_CONFIG.HOLD_DURATION_MS) {
          advance("both_arms");
          return;
        }
      } else {
        conditionStartRef.current = null;
        setHoldProgress(0);
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, stepStatus, advance]);

  // ── Both arms ──────────────────────────────────────────────────────────────
  // Passes when all 6 arm landmarks are visible for HOLD_DURATION_MS.
  useEffect(() => {
    if (step !== "both_arms" || stepStatus !== "checking") return;

    conditionStartRef.current = null;
    const stepStart = Date.now();
    let raf: number;

    function tick() {
      const now = Date.now();
      const elapsed = now - stepStart;

      setTimeoutProgress(
        Math.min(elapsed / CALIBRATION_CONFIG.BODY_TIMEOUT_MS, 1)
      );

      if (elapsed >= CALIBRATION_CONFIG.BODY_TIMEOUT_MS) {
        setStepStatus("fail");
        return;
      }

      const lm = landmarksRef.current;
      const VIS = CALIBRATION_CONFIG.VISIBILITY_THRESHOLD;
      const condMet =
        lm !== null &&
        (lm.leftShoulder.visibility ?? 0) >= VIS &&
        (lm.rightShoulder.visibility ?? 0) >= VIS &&
        (lm.leftElbow.visibility ?? 0) >= VIS &&
        (lm.rightElbow.visibility ?? 0) >= VIS &&
        (lm.leftWrist.visibility ?? 0) >= VIS &&
        (lm.rightWrist.visibility ?? 0) >= VIS;

      if (condMet) {
        if (conditionStartRef.current === null) conditionStartRef.current = now;
        const held = now - conditionStartRef.current;
        setHoldProgress(Math.min(held / CALIBRATION_CONFIG.HOLD_DURATION_MS, 1));
        if (held >= CALIBRATION_CONFIG.HOLD_DURATION_MS) {
          advance("motion_test");
          return;
        }
      } else {
        conditionStartRef.current = null;
        setHoldProgress(0);
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, stepStatus, advance]);

  // ── Motion test ────────────────────────────────────────────────────────────
  // Passes when swimSpeed exceeds threshold for HOLD_DURATION_MS.
  // Player has MOTION_TIMEOUT_MS total; the hold resets if speed drops below
  // threshold but the total timer keeps counting.
  useEffect(() => {
    if (step !== "motion_test" || stepStatus !== "checking") return;

    conditionStartRef.current = null;
    const stepStart = Date.now();
    let raf: number;

    function tick() {
      const now = Date.now();
      const elapsed = now - stepStart;

      setTimeoutProgress(
        Math.min(elapsed / CALIBRATION_CONFIG.MOTION_TIMEOUT_MS, 1)
      );

      if (elapsed >= CALIBRATION_CONFIG.MOTION_TIMEOUT_MS) {
        setStepStatus("fail");
        return;
      }

      const speed = swimSpeedRef.current;

      if (speed >= CALIBRATION_CONFIG.MOTION_SPEED_THRESHOLD) {
        if (conditionStartRef.current === null) conditionStartRef.current = now;
        const held = now - conditionStartRef.current;
        setMotionProgress(Math.min(held / CALIBRATION_CONFIG.HOLD_DURATION_MS, 1));
        if (held >= CALIBRATION_CONFIG.HOLD_DURATION_MS) {
          advance("complete");
          return;
        }
      } else {
        conditionStartRef.current = null;
        setMotionProgress(0);
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, stepStatus, advance]);

  // ── Controls ───────────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    conditionStartRef.current = null;
    setStepStatus("checking");
    setHoldProgress(0);
    setMotionProgress(0);
    setTimeoutProgress(0);
  }, []);

  const skipMic = useCallback(() => {
    if (step === "mic") advance("upper_body");
  }, [step, advance]);

  return {
    step,
    stepStatus,
    micGranted,
    holdProgress,
    motionProgress,
    timeoutProgress,
    retry,
    skipMic,
  };
}
