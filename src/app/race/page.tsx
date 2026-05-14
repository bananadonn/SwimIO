"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WebcamFeed } from "@/components/WebcamFeed";
import { Countdown } from "@/components/Countdown";
import { SwimMeter } from "@/components/SwimMeter";
import { FormFeedback } from "@/components/FormFeedback";
import { MultiProgressBar } from "@/components/MultiProgressBar";
import { RemoteVideo, RemoteAudio } from "@/components/RemoteVideo";
import { useWebcam } from "@/hooks/useWebcam";
import { usePoseDetector } from "@/hooks/usePoseDetector";
import { useSwimTracker } from "@/hooks/useSwimTracker";
import { useMultiplayerRace } from "@/hooks/useMultiplayerRace";
import { useLiveKit } from "@/hooks/useLiveKit";
import { useAuth } from "@/hooks/useAuth";
import type { SwimSpeedResult } from "@/lib/swimSpeed";
import type { ArmLandmarks } from "@/types/pose";
import type { RaceFinishPayload } from "@shared/protocol";

const FINISH_LINE_M = 100;

export default function RacePage() {
  return (
    <Suspense>
      <RacePageInner />
    </Suspense>
  );
}

function RacePageInner() {
  const { videoRef, status, error } = useWebcam();
  const { landmarks, detectorStatus } = usePoseDetector(videoRef);
  const { onLandmarks, swimSpeed } = useSwimTracker();
  const { user, session } = useAuth();
  const searchParams = useSearchParams();
  const isRankedParam = searchParams.get("mode") === "ranked";

  const [guestName, setGuestName] = useState("");
  const guestNameRef = useRef(guestName);
  useEffect(() => { guestNameRef.current = guestName; }, [guestName]);

  const {
    phase, opponentName, opponentElo, mySlot, countdownSeconds,
    myDistance, opponentDistance, elapsedMs, result,
    socketConnected, livekitToken, raceMode, queueError,
    joinQueue, leaveQueue, leaveRace,
  } = useMultiplayerRace(swimSpeed.speed);

  const { status: lkStatus, remoteVideoTrack, remoteAudioTrack, isMuted, toggleMute } =
    useLiveKit(livekitToken);

  useEffect(() => {
    if (landmarks) onLandmarks(landmarks);
  }, [landmarks, onLandmarks]);

  const handleJoin = useCallback(() => {
    if (!socketConnected) return;
    if (isRankedParam && user && session) {
      const displayName = user.user_metadata?.username ?? user.email?.split("@")[0] ?? "Player";
      joinQueue(displayName, "ranked", session.access_token);
    } else {
      const name = guestName.trim();
      if (!name) return;
      joinQueue(name, "guest");
    }
  }, [guestName, socketConnected, isRankedParam, user, session, joinQueue]);

  const remainingSec = Math.max(0, Math.ceil((60_000 - elapsedMs) / 1000));
  const didIWin = result !== null && mySlot !== null && result.winner === mySlot;
  const inMatch = phase === "countdown" || phase === "racing" || phase === "finished";

  const displayName = isRankedParam && user
    ? (user.user_metadata?.username ?? user.email?.split("@")[0] ?? "You")
    : guestName || "You";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 gap-4 bg-base">
      <div className="w-full max-w-4xl flex flex-col gap-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-muted hover:text-text transition-colors duration-150">
            ← Home
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-display text-sm tracking-widest text-muted">
              {isRankedParam ? "RANKED" : "RACE"}
            </span>
            {raceMode === "ranked" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-energy/10 text-energy border border-energy/20 font-semibold tracking-wider uppercase">
                Ranked
              </span>
            )}
          </div>
          <div className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase ${
            socketConnected
              ? "bg-green-900/20 text-green-400 border border-green-900/30"
              : "bg-surface text-muted border border-surface-2"
          }`}>
            {socketConnected ? "Online" : "Connecting…"}
          </div>
        </div>

        {/* Video section */}
        <div className="relative">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 min-w-0">
              <WebcamFeed
                videoRef={videoRef}
                status={status}
                error={error}
                playerName={inMatch ? displayName : undefined}
              />
            </div>

            {inMatch && (
              <div className="flex-1 min-w-0 aspect-video sm:aspect-auto">
                <RemoteVideo
                  track={remoteVideoTrack}
                  name={opponentName ?? "Opponent"}
                  className="w-full h-full"
                />
              </div>
            )}
          </div>

          {/* Overlays spanning both feeds */}
          {phase === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Countdown countdown={countdownSeconds} />
            </div>
          )}

          {phase === "finished" && result && (
            <ResultOverlay
              result={result}
              didIWin={didIWin}
              myName={displayName}
              opponentName={opponentName ?? "Opponent"}
              mySlot={mySlot ?? 0}
              isRanked={raceMode === "ranked"}
              onRaceAgain={leaveRace}
            />
          )}
        </div>

        <RemoteAudio track={remoteAudioTrack} />

        {/* Voice controls */}
        {inMatch && phase !== "finished" && (
          <VoiceBar
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onLeave={leaveRace}
            lkStatus={lkStatus}
          />
        )}

        {/* Phase HUD */}
        {queueError && phase === "idle" && (
          <p className="text-sm text-coral bg-coral/10 border border-coral/20 rounded-xl px-4 py-3">
            {queueError}
          </p>
        )}

        {phase === "idle" && (
          isRankedParam && user ? (
            <RankedReadyForm
              displayName={displayName}
              onSubmit={handleJoin}
              canSubmit={socketConnected}
              detectorReady={detectorStatus === "ready"}
            />
          ) : (
            <NameForm
              name={guestName}
              onChange={setGuestName}
              onSubmit={handleJoin}
              canSubmit={socketConnected && guestName.trim().length > 0}
              detectorReady={detectorStatus === "ready"}
            />
          )
        )}

        {phase === "queuing" && (
          <QueuingState opponentName={opponentName} onCancel={leaveQueue} />
        )}

        {(phase === "countdown" || phase === "racing") && (
          <RacingHUD
            myName={displayName}
            opponentName={opponentName ?? "Opponent"}
            opponentElo={opponentElo}
            myDistance={myDistance}
            opponentDistance={opponentDistance}
            remainingSec={remainingSec}
            swimSpeed={swimSpeed}
            detectorStatus={detectorStatus}
            landmarks={landmarks}
          />
        )}

      </div>
    </main>
  );
}

// ── Voice controls ─────────────────────────────────────────────────────────────

import type { LiveKitStatus } from "@/hooks/useLiveKit";

function VoiceBar({
  isMuted, onToggleMute, onLeave, lkStatus,
}: {
  isMuted: boolean; onToggleMute: () => void;
  onLeave: () => void; lkStatus: LiveKitStatus;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <button
        onClick={onToggleMute}
        disabled={lkStatus !== "connected"}
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
          lkStatus !== "connected"
            ? "opacity-30 cursor-not-allowed bg-surface text-muted"
            : isMuted
            ? "bg-coral/20 text-coral border border-coral/20 hover:bg-coral/30"
            : "bg-surface text-muted hover:text-text border border-surface-2"
        }`}
      >
        <span>{isMuted ? "🔇" : "🎙️"}</span>
        <span>{isMuted ? "Unmute" : "Mute"}</span>
      </button>

      <span className={`text-[10px] tracking-[0.12em] font-semibold uppercase ${
        lkStatus === "connected"   ? "text-green-400" :
        lkStatus === "connecting"  ? "text-energy animate-pulse" :
        lkStatus === "error"       ? "text-coral" :
        "text-transparent"
      }`}>
        {lkStatus === "connected"  ? "● Voice" :
         lkStatus === "connecting" ? "○ Connecting" :
         lkStatus === "error"      ? "⚠ Voice unavailable" : "·"}
      </span>

      <button
        onClick={onLeave}
        className="rounded-lg bg-surface hover:bg-surface-2 text-muted hover:text-text px-3 py-1.5 text-xs font-medium border border-surface-2 transition-colors duration-150"
      >
        Leave
      </button>
    </div>
  );
}

// ── Name entry (guest) ─────────────────────────────────────────────────────────

function NameForm({
  name, onChange, onSubmit, canSubmit, detectorReady,
}: {
  name: string; onChange: (v: string) => void;
  onSubmit: () => void; canSubmit: boolean; detectorReady: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSubmit(); }}
          placeholder="Your name"
          maxLength={24}
          className="flex-1 rounded-xl bg-surface border border-surface-2 px-4 py-3 text-sm text-text placeholder-muted outline-none focus:border-pool/50 transition-colors duration-150"
        />
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-xl bg-pool hover:bg-[#1ABEF5] disabled:opacity-30 disabled:cursor-not-allowed px-5 py-3 font-display text-base tracking-wide text-base transition-colors duration-150"
        >
          FIND MATCH
        </button>
      </div>
      {!detectorReady && (
        <p className="text-xs text-muted/50 text-center animate-pulse">Loading motion tracker…</p>
      )}
    </div>
  );
}

// ── Ranked ready (authenticated) ───────────────────────────────────────────────

function RankedReadyForm({
  displayName, onSubmit, canSubmit, detectorReady,
}: {
  displayName: string; onSubmit: () => void;
  canSubmit: boolean; detectorReady: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between bg-surface border border-surface-2 rounded-xl px-5 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] tracking-[0.15em] text-muted uppercase">Playing as</span>
          <span className="font-display text-xl text-text tracking-wide uppercase">{displayName}</span>
        </div>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-xl bg-energy hover:bg-[#FFE033] disabled:opacity-30 disabled:cursor-not-allowed px-5 py-2.5 font-display text-base tracking-wide text-base transition-colors duration-150"
        >
          FIND RANKED MATCH
        </button>
      </div>
      {!detectorReady && (
        <p className="text-xs text-muted/50 text-center animate-pulse">Loading motion tracker…</p>
      )}
    </div>
  );
}

// ── Queuing ────────────────────────────────────────────────────────────────────

function QueuingState({ opponentName, onCancel }: { opponentName: string | null; onCancel: () => void }) {
  if (opponentName) {
    return (
      <div className="text-center py-2">
        <p className="font-display text-xl text-pool tracking-wide animate-pulse">
          FOUND {opponentName.toUpperCase()} — GET READY
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between bg-surface border border-surface-2 rounded-xl px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-pool animate-pulse" />
        <span className="text-sm text-muted">Looking for an opponent…</span>
      </div>
      <button onClick={onCancel} className="text-xs text-muted/50 hover:text-muted transition-colors duration-150">
        Cancel
      </button>
    </div>
  );
}

// ── Racing HUD ─────────────────────────────────────────────────────────────────

function RacingHUD({
  myName, opponentName, opponentElo, myDistance, opponentDistance,
  remainingSec, swimSpeed, detectorStatus, landmarks,
}: {
  myName: string; opponentName: string; opponentElo: number | null;
  myDistance: number; opponentDistance: number; remainingSec: number;
  swimSpeed: SwimSpeedResult; detectorStatus: string; landmarks: ArmLandmarks | null;
}) {
  return (
    <div className="flex flex-col gap-3 bg-surface border border-surface-2 rounded-xl p-4">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.15em] uppercase text-muted">
          {detectorStatus === "ready" && landmarks ? "Tracking" : "No pose"}
          {opponentElo != null && (
            <span className="ml-3 text-energy/60">{opponentElo} ELO</span>
          )}
        </span>
        <span className={`font-mono font-bold text-xl tabular-nums ${remainingSec <= 10 ? "text-coral" : "text-text"}`}>
          {remainingSec}s
        </span>
      </div>

      <MultiProgressBar
        myDistance={myDistance}
        opponentDistance={opponentDistance}
        myName={myName}
        opponentName={opponentName}
        finishLine={FINISH_LINE_M}
      />

      <SwimMeter speed={swimSpeed.speed} />
      <FormFeedback swimSpeed={swimSpeed} />
    </div>
  );
}

// ── Result overlay ─────────────────────────────────────────────────────────────

function ResultOverlay({
  result, didIWin, myName, opponentName, mySlot, isRanked, onRaceAgain,
}: {
  result: RaceFinishPayload; didIWin: boolean; myName: string;
  opponentName: string; mySlot: 0 | 1; isRanked: boolean; onRaceAgain: () => void;
}) {
  const oppSlot: 0 | 1 = mySlot === 0 ? 1 : 0;
  const myFinalDist  = result.distances[mySlot].toFixed(1);
  const oppFinalDist = result.distances[oppSlot].toFixed(1);
  const elapsedSec   = (result.elapsedMs / 1000).toFixed(1);
  const eloChange    = isRanked && result.eloDelta != null
    ? didIWin ? `+${result.eloDelta}` : `-${result.eloDelta}`
    : null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-base/90 z-20 animate-victory-in px-6 rounded-xl">

      {/* Win / loss badge */}
      <p className={`text-[10px] tracking-[0.4em] font-semibold uppercase mb-2 ${didIWin ? "text-energy" : "text-muted"}`}>
        {didIWin ? "● WINNER" : "● RACE OVER"}
      </p>

      {/* Headline */}
      <h2 className={`font-display leading-none mb-3 text-center ${
        didIWin
          ? "text-[clamp(4rem,14vw,8rem)] text-energy"
          : "text-[clamp(3rem,10vw,5rem)] text-text"
      }`}>
        {didIWin ? "YOU WIN" : "YOU LOST"}
      </h2>

      {/* ELO delta */}
      {eloChange && (
        <p className={`font-display text-3xl mb-4 ${didIWin ? "text-pool" : "text-coral"}`}>
          {eloChange} ELO
        </p>
      )}

      {/* Distance comparison */}
      <div className="flex gap-10 mb-3">
        <ResultStat label={myName || "You"} value={`${myFinalDist}m`} highlight={didIWin} />
        <ResultStat label={opponentName} value={`${oppFinalDist}m`} highlight={!didIWin} />
      </div>

      <p className="text-muted text-xs mb-7">{elapsedSec}s elapsed</p>

      <div className="flex gap-3">
        <button
          onClick={onRaceAgain}
          className="rounded-xl bg-pool hover:bg-[#1ABEF5] px-6 py-2.5 font-display text-base tracking-wide transition-colors duration-150"
        >
          RACE AGAIN
        </button>
        <Link
          href="/"
          className="rounded-xl bg-surface hover:bg-surface-2 border border-surface-2 px-6 py-2.5 text-sm font-medium text-muted hover:text-text transition-colors duration-150"
        >
          Home
        </Link>
      </div>
    </div>
  );
}

function ResultStat({ label, value, highlight }: { label: string; value: string; highlight: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`font-display text-2xl leading-none ${highlight ? "text-text" : "text-muted"}`}>
        {value}
      </span>
      <span className="text-[10px] tracking-[0.1em] text-muted uppercase">{label}</span>
    </div>
  );
}
