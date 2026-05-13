import type { Server } from "socket.io";
import {
  EVENTS,
  type RaceMode,
  type QueueMatchedPayload,
  type RaceCountdownPayload,
  type RaceStatePayload,
  type RaceFinishPayload,
} from "../../shared/protocol";
import { RACE_CONFIG, ANTI_CHEAT } from "./config";
import { calcEloDelta } from "./elo";
import { recordRankedMatch } from "./supabase";

export interface Player {
  socketId: string;
  name: string;
  livekitToken: string | null;
  userId?: string;
  elo?: number;
  gamesForCalibration?: number;
}

interface PlayerState extends Player {
  distance: number;
  lastSpeed: number;
  lastSeq: number;
  recentPacketTimes: number[];
}

export class Room {
  readonly id: string;
  private players: [PlayerState, PlayerState];
  private io: Server;
  private mode: RaceMode;
  private phase: "countdown" | "racing" | "finished" = "countdown";
  private raceStartMs = 0;
  private lastTickMs = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private readonly onFinished: () => void;

  constructor(
    id: string,
    p0: Player,
    p1: Player,
    io: Server,
    mode: RaceMode,
    onFinished: () => void,
  ) {
    this.id = id;
    this.io = io;
    this.mode = mode;
    this.onFinished = onFinished;
    this.players = [
      { ...p0, distance: 0, lastSpeed: 0, lastSeq: -1, recentPacketTimes: [] },
      { ...p1, distance: 0, lastSpeed: 0, lastSeq: -1, recentPacketTimes: [] },
    ];

    const s0 = io.sockets.sockets.get(p0.socketId);
    const s1 = io.sockets.sockets.get(p1.socketId);
    s0?.join(id);
    s1?.join(id);

    const matched0: QueueMatchedPayload = {
      roomId: id, opponentName: p1.name, yourSlot: 0,
      livekitToken: p0.livekitToken, mode,
      opponentElo: mode === "ranked" ? (p1.elo ?? null) : null,
    };
    const matched1: QueueMatchedPayload = {
      roomId: id, opponentName: p0.name, yourSlot: 1,
      livekitToken: p1.livekitToken, mode,
      opponentElo: mode === "ranked" ? (p0.elo ?? null) : null,
    };
    s0?.emit(EVENTS.QUEUE_MATCHED, matched0);
    s1?.emit(EVENTS.QUEUE_MATCHED, matched1);

    const startsAt = Date.now() + RACE_CONFIG.COUNTDOWN_MS;
    const countdown: RaceCountdownPayload = { startsAt };
    s0?.emit(EVENTS.RACE_COUNTDOWN, countdown);
    s1?.emit(EVENTS.RACE_COUNTDOWN, countdown);

    setTimeout(() => this.startRacing(), RACE_CONFIG.COUNTDOWN_MS);
  }

  private startRacing() {
    if (this.phase === "finished") return;
    this.phase = "racing";
    this.raceStartMs = Date.now();
    this.lastTickMs = Date.now();
    this.tickInterval = setInterval(() => this.tick(), RACE_CONFIG.TICK_INTERVAL_MS);
  }

  private tick() {
    const now = Date.now();
    const delta = (now - this.lastTickMs) / 1000;
    this.lastTickMs = now;
    const elapsedMs = now - this.raceStartMs;

    for (const p of this.players) {
      p.distance = Math.min(
        p.distance + p.lastSpeed * RACE_CONFIG.METERS_PER_SPEED_PER_SECOND * delta,
        RACE_CONFIG.FINISH_LINE_M,
      );
    }

    const distances: [number, number] = [this.players[0].distance, this.players[1].distance];
    const timeUp = elapsedMs >= RACE_CONFIG.RACE_DURATION_MS;
    const p0Done = distances[0] >= RACE_CONFIG.FINISH_LINE_M;
    const p1Done = distances[1] >= RACE_CONFIG.FINISH_LINE_M;

    if (p0Done || p1Done || timeUp) {
      let winner: 0 | 1;
      if (p0Done && !p1Done) winner = 0;
      else if (p1Done && !p0Done) winner = 1;
      else winner = distances[0] >= distances[1] ? 0 : 1;
      this.finish(winner, distances, elapsedMs);
      return;
    }

    const state: RaceStatePayload = { distances, elapsedMs };
    this.io.to(this.id).emit(EVENTS.RACE_STATE, state);
  }

  onSpeed(socketId: string, speed: number, seq: number) {
    if (this.phase !== "racing") return;
    const slot: 0 | 1 | null =
      this.players[0].socketId === socketId ? 0 :
      this.players[1].socketId === socketId ? 1 : null;
    if (slot === null) return;
    const player = this.players[slot];
    if (seq <= player.lastSeq) return;
    player.lastSeq = seq;
    const now = Date.now();
    player.recentPacketTimes = player.recentPacketTimes.filter(t => now - t < 1000);
    if (player.recentPacketTimes.length >= ANTI_CHEAT.MAX_PACKETS_PER_SEC) return;
    player.recentPacketTimes.push(now);
    player.lastSpeed = Math.max(0, Math.min(speed, ANTI_CHEAT.MAX_SPEED));
  }

  onDisconnect(socketId: string) {
    if (this.phase === "finished") return;
    const disconnectedSlot: 0 | 1 = this.players[0].socketId === socketId ? 0 : 1;
    const survivorSlot: 0 | 1 = disconnectedSlot === 0 ? 1 : 0;
    const survivorSocket = this.io.sockets.sockets.get(this.players[survivorSlot].socketId);
    survivorSocket?.emit(EVENTS.RACE_OPPONENT_DISCONNECT);
    const distances: [number, number] = [this.players[0].distance, this.players[1].distance];
    const elapsedMs = this.phase === "racing" ? Date.now() - this.raceStartMs : 0;
    this.finish(survivorSlot, distances, elapsedMs);
  }

  private finish(winner: 0 | 1, distances: [number, number], elapsedMs: number) {
    if (this.phase === "finished") return;
    this.phase = "finished";
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    let eloDelta: number | null = null;
    const newElo: [number | null, number | null] = [null, null];

    if (this.mode === "ranked") {
      const loser: 0 | 1 = winner === 0 ? 1 : 0;
      const wp = this.players[winner];
      const lp = this.players[loser];
      if (
        wp.elo != null && lp.elo != null &&
        wp.gamesForCalibration != null && lp.gamesForCalibration != null &&
        wp.userId && lp.userId
      ) {
        eloDelta = calcEloDelta(wp.elo, lp.elo, wp.gamesForCalibration, lp.gamesForCalibration);
        newElo[winner] = wp.elo + eloDelta;
        newElo[loser] = Math.max(100, lp.elo - eloDelta);

        recordRankedMatch({
          winnerId: wp.userId,
          loserId: lp.userId,
          winnerEloBefore: wp.elo,
          loserEloBefore: lp.elo,
          eloDelta,
          winnerDistanceM: distances[winner],
          loserDistanceM: distances[loser],
          raceDurationMs: elapsedMs,
        }).catch(console.error);
      }
    }

    const payload: RaceFinishPayload = { winner, distances, elapsedMs, eloDelta, newElo };
    this.io.to(this.id).emit(EVENTS.RACE_FINISH, payload);
    setTimeout(() => this.onFinished(), 5_000);
  }
}
