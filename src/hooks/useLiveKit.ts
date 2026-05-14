"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteVideoTrack,
  type RemoteAudioTrack,
} from "livekit-client";

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "";

export type LiveKitStatus = "idle" | "connecting" | "connected" | "error";

export interface UseLiveKitResult {
  status: LiveKitStatus;
  remoteVideoTrack: RemoteVideoTrack | null;
  remoteAudioTrack: RemoteAudioTrack | null;
  isMuted: boolean;
  toggleMute: () => void;
}

export function useLiveKit(token: string | null): UseLiveKitResult {
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<LiveKitStatus>("idle");
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<RemoteVideoTrack | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<RemoteAudioTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!token || !LIVEKIT_URL) return;

    const room = new Room({
      videoCaptureDefaults: {
        resolution: { width: 854, height: 480, frameRate: 24 },
      },
    });
    roomRef.current = room;
    setStatus("connecting");

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video) {
        setRemoteVideoTrack(track as RemoteVideoTrack);
      } else if (track.kind === Track.Kind.Audio) {
        setRemoteAudioTrack(track as RemoteAudioTrack);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Video) setRemoteVideoTrack(null);
      if (track.kind === Track.Kind.Audio) setRemoteAudioTrack(null);
    });

    // TrackMuted/TrackUnmuted fire for all participants — filter to local mic
    room.on(RoomEvent.TrackMuted, (pub, participant) => {
      if (
        participant === room.localParticipant &&
        pub.kind === Track.Kind.Audio
      ) {
        setIsMuted(true);
      }
    });

    room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
      if (
        participant === room.localParticipant &&
        pub.kind === Track.Kind.Audio
      ) {
        setIsMuted(false);
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      setStatus("idle");
      setRemoteVideoTrack(null);
      setRemoteAudioTrack(null);
    });

    (async () => {
      try {
        await room.connect(LIVEKIT_URL, token);
        // Enable camera and mic in parallel — start with mic live per spec
        await Promise.all([
          room.localParticipant.setCameraEnabled(true),
          room.localParticipant.setMicrophoneEnabled(true),
        ]);
        setStatus("connected");
        setIsMuted(false);
      } catch (err) {
        console.error("LiveKit connection error:", err);
        setStatus("error");
      }
    })();

    return () => {
      room.disconnect();
      roomRef.current = null;
      setStatus("idle");
      setRemoteVideoTrack(null);
      setRemoteAudioTrack(null);
      setIsMuted(false);
    };
  }, [token]);

  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const willEnable = !room.localParticipant.isMicrophoneEnabled;
    // Fire-and-forget — state updates via TrackMuted/TrackUnmuted events above
    room.localParticipant.setMicrophoneEnabled(willEnable).catch(console.error);
  }, []);

  return { status, remoteVideoTrack, remoteAudioTrack, isMuted, toggleMute };
}
