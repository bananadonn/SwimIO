"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { WebcamFeed } from "@/components/WebcamFeed";
import { PoseOverlay } from "@/components/PoseOverlay";
import { Countdown } from "@/components/Countdown";
import { SwimMeter } from "@/components/SwimMeter";
import { ProgressBar } from "@/components/ProgressBar";
import { RaceTimer } from "@/components/RaceTimer";
import { WinScreen } from "@/components/WinScreen";
import { ArmWarning } from "@/components/ArmWarning";
import { FormFeedback } from "@/components/FormFeedback";
import { useWebcam } from "@/hooks/useWebcam";
import { usePoseDetector } from "@/hooks/usePoseDetector";
import { useSwimTracker } from "@/hooks/useSwimTracker";
import { useRace } from "@/hooks/useRace";

const ARM_WARNING_DELAY_MS = 3000;
const ARM_VISIBILITY_THRESHOLD = 0.5;
const READY_DELAY_MS = 3000;

export default function PlayPage() {
  const { videoRef, status, error } = useWebcam();
  const { landmarks, detectorStatus, detectorError } = usePoseDetector(videoRef);
  const { onLandmarks, swimSpeed } = useSwimTracker();
  const { state, countdown, distanceRef, elapsedMsRef, result, start, playAgain } =
    useRace(swimSpeed.speed);

  const [showArmWarning, setShowArmWarning] = useState(false);
  const armsMissingSinceRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), READY_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (landmarks) onLandmarks(landmarks);
  }, [landmarks, onLandmarks]);

  useEffect(() => {
    if (state !== "racing") {
      armsMissingSinceRef.current = null;
      setShowArmWarning(false);
      return;
    }
    const bothVisible =
      landmarks !== null &&
      (landmarks.leftWrist.visibility ?? 0) >= ARM_VISIBILITY_THRESHOLD &&
      (landmarks.rightWrist.visibility ?? 0) >= ARM_VISIBILITY_THRESHOLD;
    if (bothVisible) {
      armsMissingSinceRef.current = null;
      setShowArmWarning(false);
    } else {
      if (armsMissingSinceRef.current === null) {
        armsMissingSinceRef.current = Date.now();
      } else if (Date.now() - armsMissingSinceRef.current >= ARM_WARNING_DELAY_MS) {
        setShowArmWarning(true);
      }
    }
  }, [landmarks, state]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && state === "idle" && ready) {
        e.preventDefault();
        start();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, start, ready]);

  const handleTap = useCallback(() => {
    if (state === "idle" && ready) start();
  }, [state, start, ready]);

  const canStart = state === "idle" && status === "active" && detectorStatus === "ready" && ready;

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center p-4 gap-4 bg-base ${
        canStart ? "cursor-pointer" : ""
      }`}
      onClick={handleTap}
    >
      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-muted hover:text-text transition-colors duration-150">
            ← Home
          </Link>
          <span className="font-display text-sm text-muted tracking-widest">SOLO TRAINING</span>
          <div className="w-10" />
        </div>

        {/* Webcam */}
        <WebcamFeed
          videoRef={videoRef}
          status={status}
          error={error}
          overlay={
            <>
              <PoseOverlay landmarks={landmarks} videoRef={videoRef} />
              {state === "countdown" && <Countdown countdown={countdown} />}
              {state === "racing"    && showArmWarning && <ArmWarning />}
              {state === "finished"  && result && (
                <WinScreen result={result} onPlayAgain={playAgain} />
              )}
            </>
          }
        />

        {/* Racing HUD */}
        {state === "racing" && (
          <div className="flex flex-col gap-3 bg-surface rounded-xl p-4 border border-surface-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] tracking-[0.15em] uppercase text-muted">
                {detectorStatus === "ready" && landmarks ? "Tracking" : "No pose"}
              </span>
              <RaceTimer elapsedMsRef={elapsedMsRef} />
            </div>
            <ProgressBar distanceRef={distanceRef} />
            <SwimMeter speed={swimSpeed.speed} />
            <FormFeedback swimSpeed={swimSpeed} />
          </div>
        )}

        {/* Idle prompt */}
        {canStart && (
          <p className="text-center text-muted text-sm select-none">
            Press{" "}
            <kbd className="px-1.5 py-0.5 bg-surface-2 border border-surface-3 rounded text-text text-xs font-mono">
              Space
            </kbd>
            {" "}or tap to start
          </p>
        )}

        {state === "idle" && status === "active" && detectorStatus === "ready" && !ready && (
          <p className="text-center text-muted/50 text-sm select-none animate-pulse">
            Get into position…
          </p>
        )}

        {detectorStatus === "loading" && status === "active" && (
          <p className="text-center text-sm text-muted/50 animate-pulse">Loading motion tracker…</p>
        )}
        {detectorStatus === "error" && detectorError && (
          <p className="text-center text-xs text-coral">{detectorError}</p>
        )}

      </div>
    </main>
  );
}
