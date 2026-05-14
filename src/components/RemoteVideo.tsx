"use client";

import { useEffect, useRef } from "react";
import type { RemoteVideoTrack, RemoteAudioTrack } from "livekit-client";

interface RemoteVideoProps {
  track: RemoteVideoTrack | null;
  name: string;
  className?: string;
}

export function RemoteVideo({ track, name, className }: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [track]);

  return (
    <div className={`relative bg-surface rounded-xl overflow-hidden ${className ?? ""}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${!track ? "invisible" : ""}`}
      />

      {/* Placeholder when no video yet */}
      {!track && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center">
            <span className="font-display text-xl text-muted">{name[0]?.toUpperCase() ?? "?"}</span>
          </div>
          <p className="font-display text-base text-muted tracking-wide uppercase text-sm">{name}</p>
          <p className="text-xs text-muted/40">Connecting…</p>
        </div>
      )}

      {/* Lower-third — always shown when connected */}
      {track && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-base/80 to-transparent pt-8 pb-2.5 px-3 pointer-events-none">
          <span className="font-display text-base leading-none tracking-wide text-text uppercase">
            {name}
          </span>
        </div>
      )}
    </div>
  );
}

interface RemoteAudioProps {
  track: RemoteAudioTrack | null;
}

export function RemoteAudio({ track }: RemoteAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [track]);

  return <audio ref={audioRef} autoPlay className="hidden" />;
}
