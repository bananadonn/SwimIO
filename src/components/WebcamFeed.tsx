"use client";

import type { WebcamStatus } from "@/hooks/useWebcam";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: WebcamStatus;
  error: string | null;
  overlay?: React.ReactNode;
}

export function WebcamFeed({ videoRef, status, error, overlay }: Props) {
  return (
    <div className="relative w-full aspect-video bg-neutral-900 rounded-xl overflow-hidden flex items-center justify-center">
      {/* Video — always mounted so the ref is stable; hidden until active */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${
          status === "active" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Pose overlay slot */}
      {status === "active" && overlay}

      {/* Status states */}
      {status === "idle" && null}

      {status === "requesting" && (
        <StatusMessage>Requesting camera access…</StatusMessage>
      )}

      {status === "denied" && (
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-white font-semibold text-lg">Camera access denied</p>
          <p className="text-neutral-400 text-sm">
            Allow camera access in your browser settings, then try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold hover:bg-blue-500 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {status === "unavailable" && (
        <div className="flex flex-col items-center gap-2 text-center px-6">
          <p className="text-white font-semibold text-lg">No camera found</p>
          <p className="text-neutral-400 text-sm">
            Plug in a webcam and refresh the page.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-white font-semibold text-lg">Camera error</p>
          {error && (
            <p className="text-neutral-400 text-sm">{error}</p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold hover:bg-blue-500 transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-neutral-400 text-sm animate-pulse">{children}</p>
  );
}
