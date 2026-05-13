"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { WebcamFeed } from "@/components/WebcamFeed";
import { PoseOverlay } from "@/components/PoseOverlay";
import { Countdown } from "@/components/Countdown";
import { SwimMeter } from "@/components/SwimMeter";
import { ProgressBar } from "@/components/ProgressBar";
import { RaceTimer } from "@/components/RaceTimer";
import { WinScreen } from "@/components/WinScreen";
import { ArmWarning } from "@/components/ArmWarning";
import { useWebcam } from "@/hooks/useWebcam";
import { usePoseDetector } from "@/hooks/usePoseDetector";
import { useSwimTracker } from "@/hooks/useSwimTracker";
import { useRace } from "@/hooks/useRace";

const ARM_WARNING_DELAY_MS = 3000;
const ARM_VISIBILITY_THRESHOLD = 0.5;

export default function PlayPage() {
  const { videoRef, status, error } = useWebcam();
  const { landmarks, detectorStatus, detectorError } = usePoseDetector(videoRef);
  const { onLandmarks, swimSpeed } = useSwimTracker();
  const { state, countdown, distanceRef, elapsedMsRef, result, start, playAgain } =
    useRace(swimSpeed.speed);

  const [showArmWarning, setShowArmWarning] = useState(false);
  const armsMissingSinceRef = useRef<number | null>(null);

  // Feed landmarks into swim tracker every frame
  useEffect(() => {
    if (landmarks) onLandmarks(landmarks);
  }, [landmarks, onLandmarks]);

  // Arm visibility warning — only active during racing
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

  // Space bar to start
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && state === "idle") {
        e.preventDefault();
        start();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, start]);

  const handleTap = useCallback(() => {
    if (state === "idle") start();
  }, [state, start]);

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center p-4 gap-4 ${
        state === "idle" ? "cursor-pointer" : ""
      }`}
      onClick={handleTap}
    >
      <div className="w-full max-w-2xl flex flex-col gap-3">

        {/* Webcam + overlays */}
        <WebcamFeed
          videoRef={videoRef}
          status={status}
          error={error}
          overlay={
            <>
              <PoseOverlay landmarks={landmarks} videoRef={videoRef} />
              {state === "countdown" && <Countdown countdown={countdown} />}
              {state === "racing" && showArmWarning && <ArmWarning />}
              {state === "finished" && result && (
                <WinScreen result={result} onPlayAgain={playAgain} />
              )}
            </>
          }
        />

        {/* Racing HUD */}
        {state === "racing" && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs text-neutral-500">
              <span>
                {detectorStatus === "ready" && landmarks ? "tracking" : "no pose"}
              </span>
              <RaceTimer elapsedMsRef={elapsedMsRef} />
            </div>
            <ProgressBar distanceRef={distanceRef} />
            <SwimMeter speed={swimSpeed.speed} />
          </div>
        )}

        {/* Idle prompt */}
        {state === "idle" && status === "active" && detectorStatus === "ready" && (
          <p className="text-center text-neutral-400 text-sm select-none">
            Press{" "}
            <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-300 text-xs">
              Space
            </kbd>{" "}
            or tap to start
          </p>
        )}

        {/* Loading / error states */}
        {detectorStatus === "loading" && status === "active" && (
          <p className="text-center text-sm text-neutral-500 animate-pulse">
            Loading motion tracker…
          </p>
        )}
        {detectorStatus === "error" && detectorError && (
          <p className="text-center text-xs text-red-400">{detectorError}</p>
        )}

      </div>
    </main>
  );
}
