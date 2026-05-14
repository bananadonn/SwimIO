"use client";

import type { WebcamStatus } from "@/hooks/useWebcam";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: WebcamStatus;
  error: string | null;
  overlay?: React.ReactNode;
  playerName?: string;
}

export function WebcamFeed({ videoRef, status, error, overlay, playerName }: Props) {
  return (
    <div className="relative w-full aspect-video bg-surface rounded-xl overflow-hidden flex items-center justify-center">
      {/* Video — always mounted so ref is stable */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
          status === "active" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Pose / game overlay slot */}
      {status === "active" && overlay}

      {/* Sports-broadcast lower-third */}
      {status === "active" && playerName && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-base/80 to-transparent pt-8 pb-2.5 px-3 pointer-events-none">
          <span className="font-display text-base leading-none tracking-wide text-text uppercase">
            {playerName}
          </span>
        </div>
      )}

      {/* Status overlays */}
      {status === "requesting" && (
        <p className="text-muted text-sm animate-pulse">Requesting camera…</p>
      )}

      {status === "denied" && (
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-text font-semibold">Camera access denied</p>
          <p className="text-muted text-sm">Allow camera access in your browser settings, then try again.</p>
          <RetryButton />
        </div>
      )}

      {status === "unavailable" && (
        <div className="flex flex-col items-center gap-2 text-center px-6">
          <p className="text-text font-semibold">No camera found</p>
          <p className="text-muted text-sm">Plug in a webcam and refresh.</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-text font-semibold">Camera error</p>
          {error && <p className="text-muted text-sm">{error}</p>}
          <RetryButton />
        </div>
      )}
    </div>
  );
}

function RetryButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="rounded-lg bg-pool hover:bg-[#1ABEF5] px-5 py-2 text-sm font-semibold text-base transition-colors duration-150"
    >
      Try again
    </button>
  );
}
