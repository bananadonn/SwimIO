// Shared between frontend (src/) and server (server/src/).
// No Node-specific or browser-specific imports allowed here.

export const EVENTS = {
  // Client → Server
  QUEUE_JOIN:               "queue:join",
  QUEUE_LEAVE:              "queue:leave",
  RACE_SPEED:               "race:speed",
  RACE_LEAVE:               "race:leave",
  // Server → Client
  QUEUE_WAITING:            "queue:waiting",
  QUEUE_MATCHED:            "queue:matched",
  RACE_COUNTDOWN:           "race:countdown",
  RACE_STATE:               "race:state",
  RACE_FINISH:              "race:finish",
  RACE_OPPONENT_DISCONNECT: "race:opponent_disconnect",
  ERROR:                    "error",
} as const;

export type RaceMode = "guest" | "ranked";

// Client → Server payloads
export interface QueueJoinPayload {
  guestName: string;
  mode: RaceMode;
  authToken?: string;  // JWT from Supabase — required for ranked
}
export interface RaceSpeedPayload  { speed: number; seq: number }

// Server → Client payloads
export interface QueueWaitingPayload { position: number }
export interface QueueMatchedPayload {
  roomId: string;
  opponentName: string;
  yourSlot: 0 | 1;
  livekitToken: string | null;
  mode: RaceMode;
  opponentElo: number | null;  // null for guest mode
}
export interface RaceCountdownPayload { startsAt: number }
export interface RaceStatePayload  { distances: [number, number]; elapsedMs: number }
export interface RaceFinishPayload {
  winner: 0 | 1;
  distances: [number, number];
  elapsedMs: number;
  eloDelta: number | null;   // null for guest mode; positive = points gained for winner
  newElo: [number | null, number | null];
}
export interface ErrorPayload      { code: string; message: string }
