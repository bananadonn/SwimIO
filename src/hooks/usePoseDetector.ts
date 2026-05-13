"use client";

import { useEffect, useRef, useState } from "react";
import type { ArmLandmarks } from "@/types/pose";
import { LANDMARK_IDX } from "@/types/pose";

export type DetectorStatus = "loading" | "ready" | "error";

export interface UsePoseDetectorResult {
  landmarks: ArmLandmarks | null;
  detectorStatus: DetectorStatus;
  detectorError: string | null;
}

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

// Target ~30fps — skip frames that arrive faster than this
const FRAME_INTERVAL_MS = 1000 / 30;

export function usePoseDetector(
  videoRef: React.RefObject<HTMLVideoElement | null>
): UsePoseDetectorResult {
  const [detectorStatus, setDetectorStatus] = useState<DetectorStatus>("loading");
  const [detectorError, setDetectorError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<ArmLandmarks | null>(null);

  const detectorRef = useRef<import("@mediapipe/tasks-vision").PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { FilesetResolver, PoseLandmarker } = await import(
          "@mediapipe/tasks-vision"
        );
        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

        // Try GPU first, fall back to CPU if the delegate fails
        let detector: import("@mediapipe/tasks-vision").PoseLandmarker;
        try {
          detector = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        } catch {
          detector = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        }

        if (cancelled) {
          detector.close();
          return;
        }

        detectorRef.current = detector;
        setDetectorStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setDetectorStatus("error");
          setDetectorError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, []);

  // Start the rAF loop once detector is ready and video is playing
  useEffect(() => {
    if (detectorStatus !== "ready") return;

    function loop(timestamp: number) {
      rafRef.current = requestAnimationFrame(loop);

      const video = videoRef.current;
      if (!video || video.readyState < 2) return; // HAVE_CURRENT_DATA

      if (timestamp - lastFrameTimeRef.current < FRAME_INTERVAL_MS) return;
      lastFrameTimeRef.current = timestamp;

      const detector = detectorRef.current;
      if (!detector) return;

      const result = detector.detectForVideo(video, timestamp);
      const pose = result.landmarks[0];

      if (!pose) {
        setLandmarks(null);
        return;
      }

      setLandmarks({
        leftShoulder: pose[LANDMARK_IDX.LEFT_SHOULDER],
        rightShoulder: pose[LANDMARK_IDX.RIGHT_SHOULDER],
        leftElbow: pose[LANDMARK_IDX.LEFT_ELBOW],
        rightElbow: pose[LANDMARK_IDX.RIGHT_ELBOW],
        leftWrist: pose[LANDMARK_IDX.LEFT_WRIST],
        rightWrist: pose[LANDMARK_IDX.RIGHT_WRIST],
      });
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [detectorStatus, videoRef]);

  return { landmarks, detectorStatus, detectorError };
}
