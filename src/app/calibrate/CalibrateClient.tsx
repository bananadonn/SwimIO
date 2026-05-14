"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WebcamFeed } from "@/components/WebcamFeed";
import { PoseOverlay } from "@/components/PoseOverlay";
import { FormFeedback } from "@/components/FormFeedback";
import { StepIndicator } from "@/components/calibration/StepIndicator";
import { useWebcam } from "@/hooks/useWebcam";
import { usePoseDetector } from "@/hooks/usePoseDetector";
import { useSwimTracker } from "@/hooks/useSwimTracker";
import { useCalibration, CALIBRATION_CONFIG } from "@/hooks/useCalibration";

export function CalibrateClient({ nextRoute }: { nextRoute: string }) {
  const router = useRouter();
  const { videoRef, status: webcamStatus, error: webcamError } = useWebcam();
  const { landmarks, detectorStatus } = usePoseDetector(videoRef);
  const { onLandmarks, swimSpeed } = useSwimTracker();
  const { step, stepStatus, micGranted, holdProgress, motionProgress, timeoutProgress, retry, skipMic } =
    useCalibration({ webcamStatus, detectorStatus, landmarks, swimSpeed: swimSpeed.speed });

  useEffect(() => {
    if (landmarks) onLandmarks(landmarks);
  }, [landmarks, onLandmarks]);

  useEffect(() => {
    if (step === "complete") router.replace(nextRoute);
  }, [step, router, nextRoute]);

  const showPassFlash = stepStatus === "pass";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 gap-5 bg-base">
      <div className="w-full max-w-2xl flex flex-col gap-5">

        {/* Header */}
        <div className="text-center flex flex-col gap-1">
          <h1 className="font-display text-2xl text-text tracking-wide">SETUP CHECK</h1>
          <p className="text-xs text-muted tracking-[0.15em] uppercase">Takes about 30 seconds</p>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center">
          <StepIndicator step={step} stepStatus={stepStatus} />
        </div>

        {/* Webcam */}
        <WebcamFeed
          videoRef={videoRef}
          status={webcamStatus}
          error={webcamError}
          overlay={
            <>
              <PoseOverlay landmarks={landmarks} videoRef={videoRef} />
              {showPassFlash && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="font-display text-6xl text-pool animate-slam">✓</span>
                </div>
              )}
            </>
          }
        />

        {/* Step content */}
        <StepContent
          step={step}
          stepStatus={stepStatus}
          micGranted={micGranted}
          holdProgress={holdProgress}
          motionProgress={motionProgress}
          timeoutProgress={timeoutProgress}
          swimSpeed={swimSpeed}
          retry={retry}
          skipMic={skipMic}
        />

      </div>
    </main>
  );
}

// ── Step content ────────────────────────────────────────────────────────────────

import type { SwimSpeedResult } from "@/lib/swimSpeed";
import type { CalibrationStep, CalibrationStepStatus } from "@/hooks/useCalibration";

interface StepContentProps {
  step: CalibrationStep;
  stepStatus: CalibrationStepStatus;
  micGranted: boolean | null;
  holdProgress: number;
  motionProgress: number;
  timeoutProgress: number;
  swimSpeed: SwimSpeedResult;
  retry: () => void;
  skipMic: () => void;
}

function StepContent(props: StepContentProps) {
  const { step, stepStatus, micGranted, holdProgress, motionProgress, timeoutProgress, swimSpeed, retry, skipMic } = props;

  switch (step) {
    case "camera":
      return <CameraStep stepStatus={stepStatus} retry={retry} />;
    case "mic":
      return <MicStep stepStatus={stepStatus} micGranted={micGranted} skipMic={skipMic} retry={retry} />;
    case "upper_body":
      return (
        <BodyStep
          title="Show your upper body"
          instruction="Step back until both shoulders are visible in the frame."
          holdProgress={holdProgress}
          timeoutProgress={timeoutProgress}
          stepStatus={stepStatus}
          retry={retry}
        />
      );
    case "both_arms":
      return (
        <BodyStep
          title="Raise both arms"
          instruction="Extend your arms so elbows and wrists are visible."
          holdProgress={holdProgress}
          timeoutProgress={timeoutProgress}
          stepStatus={stepStatus}
          retry={retry}
        />
      );
    case "motion_test":
      return (
        <MotionStep
          motionProgress={motionProgress}
          timeoutProgress={timeoutProgress}
          stepStatus={stepStatus}
          swimSpeed={swimSpeed}
          retry={retry}
        />
      );
    case "complete":
      return (
        <div className="text-center">
          <span className="font-display text-pool text-xl tracking-wide">LAUNCHING…</span>
        </div>
      );
  }
}

// ── Camera step ──────────────────────────────────────────────────────────────────

function CameraStep({ stepStatus, retry }: { stepStatus: CalibrationStepStatus; retry: () => void }) {
  if (stepStatus === "checking") {
    return <StatusRow text="Checking camera access…" />;
  }
  if (stepStatus === "fail") {
    return (
      <FailCard
        message="Camera access required"
        detail="Allow camera access in your browser settings, then try again."
        onRetry={retry}
      />
    );
  }
  return null;
}

// ── Mic step ─────────────────────────────────────────────────────────────────────

function MicStep({
  stepStatus, micGranted, skipMic, retry,
}: {
  stepStatus: CalibrationStepStatus; micGranted: boolean | null;
  skipMic: () => void; retry: () => void;
}) {
  if (stepStatus === "checking") return <StatusRow text="Requesting microphone…" />;
  if (stepStatus === "fail") {
    return (
      <div className="bg-surface border border-surface-2 rounded-xl p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-text mb-1">Microphone not granted</p>
          <p className="text-xs text-muted">Used for voice reactions in multiplayer. Not required to play solo.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={retry} className="flex-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-text text-sm py-2 transition-colors duration-150">
            Try again
          </button>
          <button onClick={skipMic} className="flex-1 rounded-lg bg-pool/20 hover:bg-pool/30 text-pool text-sm py-2 border border-pool/20 transition-colors duration-150">
            Skip mic
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// ── Body / arms step ─────────────────────────────────────────────────────────────

function BodyStep({
  title, instruction, holdProgress, timeoutProgress, stepStatus, retry,
}: {
  title: string; instruction: string; holdProgress: number;
  timeoutProgress: number; stepStatus: CalibrationStepStatus; retry: () => void;
}) {
  if (stepStatus === "fail") {
    return (
      <FailCard message={`Couldn't detect: ${title.toLowerCase()}`} detail={instruction} onRetry={retry} />
    );
  }
  return (
    <div className="bg-surface border border-surface-2 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-text mb-0.5">{title}</p>
        <p className="text-xs text-muted">{instruction}</p>
      </div>
      <ProgressRow label="Hold" progress={holdProgress} color="#00B4F0" />
      <TimeoutBar progress={timeoutProgress} />
    </div>
  );
}

// ── Motion test step ──────────────────────────────────────────────────────────────

function MotionStep({
  motionProgress, timeoutProgress, stepStatus, swimSpeed, retry,
}: {
  motionProgress: number; timeoutProgress: number;
  stepStatus: CalibrationStepStatus; swimSpeed: SwimSpeedResult; retry: () => void;
}) {
  if (stepStatus === "fail") {
    return (
      <FailCard
        message="Motion test failed"
        detail={`Swing both arms big and fast. Need to sustain speed ≥ ${CALIBRATION_CONFIG.MOTION_SPEED_THRESHOLD} for ${CALIBRATION_CONFIG.HOLD_DURATION_MS / 1000}s.`}
        onRetry={retry}
      />
    );
  }
  return (
    <div className="bg-surface border border-surface-2 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-text mb-0.5">Motion test</p>
        <p className="text-xs text-muted">Swing both arms big and fast — like a freestyle stroke. Hold it for 2 seconds.</p>
      </div>
      <ProgressRow label="Speed hold" progress={motionProgress} color="#22C55E" />
      <TimeoutBar progress={timeoutProgress} />
      <div className="pt-1">
        <p className="text-[10px] text-muted/50 tracking-[0.12em] uppercase mb-1.5">Form quality</p>
        <FormFeedback swimSpeed={swimSpeed} />
      </div>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────────

function StatusRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted animate-pulse">
      <span className="w-1.5 h-1.5 rounded-full bg-pool animate-pulse" />
      {text}
    </div>
  );
}

function ProgressRow({ label, progress, color }: { label: string; progress: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold text-muted tracking-[0.1em] uppercase w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{ width: `${Math.min(progress * 100, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function TimeoutBar({ progress }: { progress: number }) {
  const isLow = progress > 0.7;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold text-muted/40 tracking-[0.1em] uppercase w-16 shrink-0">Time left</span>
      <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${Math.min((1 - progress) * 100, 100)}%`,
            backgroundColor: isLow ? "#FF4D4D" : "#8B95A5",
          }}
        />
      </div>
    </div>
  );
}

function FailCard({ message, detail, onRetry }: { message: string; detail: string; onRetry: () => void }) {
  return (
    <div className="bg-surface border border-coral/20 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-coral mb-0.5">{message}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-lg bg-coral/20 hover:bg-coral/30 text-coral text-sm py-2 border border-coral/20 transition-colors duration-150"
      >
        Try again
      </button>
    </div>
  );
}
