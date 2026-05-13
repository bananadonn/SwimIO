"use client";

import { useEffect, useRef } from "react";
import type { ArmLandmarks } from "@/types/pose";

interface Props {
  landmarks: ArmLandmarks | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const CONNECTIONS: [keyof ArmLandmarks, keyof ArmLandmarks][] = [
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["leftShoulder", "rightShoulder"],
];

const DOT_COLOR = "#22d3ee";   // cyan
const LINE_COLOR = "#0891b2";  // darker cyan

export function PoseOverlay({ landmarks, videoRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const video = videoRef.current;
    if (video) {
      canvas.width = video.videoWidth || canvas.offsetWidth;
      canvas.height = video.videoHeight || canvas.offsetHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;

    const w = canvas.width;
    const h = canvas.height;

    // Landmarks use normalized [0,1] coords. The video is CSS-mirrored (scaleX(-1)),
    // so we flip x here to match: drawn_x = (1 - lm.x) * w
    function px(lm: { x: number; y: number }) {
      return { x: (1 - lm.x) * w, y: lm.y * h };
    }

    // Skeleton lines
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 3;
    for (const [a, b] of CONNECTIONS) {
      const p1 = px(landmarks[a]);
      const p2 = px(landmarks[b]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Dots
    ctx.fillStyle = DOT_COLOR;
    for (const key of Object.keys(landmarks) as (keyof ArmLandmarks)[]) {
      const { x, y } = px(landmarks[key]);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [landmarks, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
