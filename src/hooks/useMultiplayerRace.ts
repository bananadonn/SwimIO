"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  EVENTS,
  type RaceMode,
  type QueueMatchedPayload,
  type RaceCountdownPayload,
  type RaceFinishPayload,
  type RaceStatePayload,
} from "@shared/protocol";

export type RacePhase = "idle" | "queuing" | "countdown" | "racing" | "finished";

export interface UseMultiplayerRaceResult {
  phase: RacePhase;
  opponentName: string | null;
  opponentElo: number | null;
  mySlot: 0 | 1 | null;
  countdownSeconds: number;
  myDistance: number;
  opponentDistance: number;
  elapsedMs: number;
  result: RaceFinishPayload | null;
  socketConnected: boolean;
  livekitToken: string | null;
  raceMode: RaceMode | null;
  queueError: string | null;
  joinQueue: (guestName: string, mode: RaceMode, authToken?: string) => void;
  leaveQueue: () => void;
  leaveRace: () => void;
}

const SERVER_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SERVER_URL) ||
  "http://localhost:3001";

export function useMultiplayerRace(swimSpeed: number): UseMultiplayerRaceResult {
  const socketRef = useRef<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [phase, setPhase] = useState<RacePhase>("idle");
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [opponentElo, setOpponentElo] = useState<number | null>(null);
  const [mySlot, setMySlot] = useState<0 | 1 | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [myDistance, setMyDistance] = useState(0);
  const [opponentDistance, setOpponentDistance] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<RaceFinishPayload | null>(null);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [raceMode, setRaceMode] = useState<RaceMode | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  const mySlotRef = useRef<0 | 1 | null>(null);
  const swimSpeedRef = useRef(swimSpeed);
  useEffect(() => { swimSpeedRef.current = swimSpeed; }, [swimSpeed]);

  const seqRef = useRef(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = () => {
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ["websocket"], autoConnect: true });
    socketRef.current = socket;

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => {
      setSocketConnected(false);
      setPhase(p => (p !== "finished" ? "idle" : p));
      clearCountdown();
    });

    socket.on(EVENTS.QUEUE_MATCHED, (data: QueueMatchedPayload) => {
      setOpponentName(data.opponentName);
      setOpponentElo(data.opponentElo);
      setMySlot(data.yourSlot);
      mySlotRef.current = data.yourSlot;
      setLivekitToken(data.livekitToken ?? null);
      setRaceMode(data.mode);
    });

    socket.on(EVENTS.RACE_COUNTDOWN, (data: RaceCountdownPayload) => {
      clearCountdown();
      setPhase("countdown");
      const update = () => {
        const remaining = Math.ceil((data.startsAt - Date.now()) / 1000);
        setCountdownSeconds(Math.max(0, remaining));
        if (remaining <= 0) { clearCountdown(); setPhase("racing"); }
      };
      update();
      countdownTimerRef.current = setInterval(update, 200);
    });

    socket.on(EVENTS.RACE_STATE, (data: RaceStatePayload) => {
      const slot = mySlotRef.current;
      if (slot === null) return;
      setMyDistance(data.distances[slot]);
      setOpponentDistance(data.distances[(1 - slot) as 0 | 1]);
      setElapsedMs(data.elapsedMs);
    });

    socket.on(EVENTS.RACE_FINISH, (data: RaceFinishPayload) => {
      const slot = mySlotRef.current;
      if (slot === null) return;
      setMyDistance(data.distances[slot]);
      setOpponentDistance(data.distances[(1 - slot) as 0 | 1]);
      setResult(data);
      clearCountdown();
      setPhase("finished");
    });

    socket.on(EVENTS.RACE_OPPONENT_DISCONNECT, () => { /* race:finish follows */ });

    socket.on(EVENTS.ERROR, (data: { code: string; message: string }) => {
      setQueueError(data.message);
      setPhase("idle");
      clearCountdown();
    });

    return () => {
      clearCountdown();
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "racing") return;
    const interval = setInterval(() => {
      socketRef.current?.emit(EVENTS.RACE_SPEED, {
        speed: swimSpeedRef.current,
        seq: ++seqRef.current,
      });
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  const joinQueue = useCallback((guestName: string, mode: RaceMode, authToken?: string) => {
    setQueueError(null);
    setPhase("queuing");
    setMyDistance(0);
    setOpponentDistance(0);
    setElapsedMs(0);
    setResult(null);
    setOpponentName(null);
    setOpponentElo(null);
    setMySlot(null);
    mySlotRef.current = null;
    seqRef.current = 0;
    socketRef.current?.emit(EVENTS.QUEUE_JOIN, { guestName, mode, authToken });
  }, []);

  const leaveQueue = useCallback(() => {
    setPhase("idle");
    socketRef.current?.emit(EVENTS.QUEUE_LEAVE);
  }, []);

  const leaveRace = useCallback(() => {
    clearCountdown();
    setPhase("idle");
    setMyDistance(0);
    setOpponentDistance(0);
    setElapsedMs(0);
    setResult(null);
    setOpponentName(null);
    setOpponentElo(null);
    setMySlot(null);
    mySlotRef.current = null;
    setLivekitToken(null);
    setRaceMode(null);
    socketRef.current?.emit(EVENTS.RACE_LEAVE);
  }, []);

  return {
    phase, opponentName, opponentElo, mySlot, countdownSeconds,
    myDistance, opponentDistance, elapsedMs, result,
    socketConnected, livekitToken, raceMode, queueError,
    joinQueue, leaveQueue, leaveRace,
  };
}
