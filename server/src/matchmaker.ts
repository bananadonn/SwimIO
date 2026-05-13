import { randomUUID } from "crypto";
import { AccessToken } from "livekit-server-sdk";
import type { Server, Socket } from "socket.io";
import { EVENTS, type RaceMode } from "../../shared/protocol";
import { ANTI_CHEAT } from "./config";
import { Room, type Player } from "./room";
import { verifySupabaseJwt, fetchPlayerStats } from "./supabase";

interface QueueEntry {
  socket: Socket;
  player: Player;
}

export class Matchmaker {
  private guestQueue: QueueEntry[] = [];
  private rankedQueue: QueueEntry[] = [];
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>();
  private readonly io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  async join(socket: Socket, rawName: string, mode: RaceMode, authToken?: string) {
    if (this.socketToRoom.has(socket.id)) return;

    this.removeFromQueues(socket.id);

    const name = rawName.trim().slice(0, ANTI_CHEAT.MAX_NAME_LENGTH) || "Guest";

    let player: Player = { socketId: socket.id, name, livekitToken: null };

    if (mode === "ranked") {
      if (!authToken) {
        socket.emit(EVENTS.ERROR, { code: "AUTH_REQUIRED", message: "Ranked mode requires authentication." });
        return;
      }
      const verified = await verifySupabaseJwt(authToken);
      if (!verified) {
        socket.emit(EVENTS.ERROR, { code: "AUTH_INVALID", message: "Invalid or expired session." });
        return;
      }
      const stats = await fetchPlayerStats(verified.sub);
      if (!stats) {
        socket.emit(EVENTS.ERROR, { code: "PROFILE_NOT_FOUND", message: "Profile not found. Try signing in again." });
        return;
      }
      player = {
        ...player,
        name: stats.username,
        userId: verified.sub,
        elo: stats.elo,
        gamesForCalibration: stats.gamesForCalibration,
      };
    }

    const queue = mode === "ranked" ? this.rankedQueue : this.guestQueue;
    queue.push({ socket, player });
    socket.emit(EVENTS.QUEUE_WAITING, { position: queue.length });

    if (queue.length >= 2) {
      const [e0, e1] = queue.splice(0, 2);
      await this.createRoom(e0, e1, mode);
    }
  }

  leave(socket: Socket) {
    this.removeFromQueues(socket.id);
    const roomId = this.socketToRoom.get(socket.id);
    if (roomId) {
      this.rooms.get(roomId)?.onDisconnect(socket.id);
    }
  }

  onSpeed(socket: Socket, speed: number, seq: number) {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;
    this.rooms.get(roomId)?.onSpeed(socket.id, speed, seq);
  }

  private removeFromQueues(socketId: string) {
    for (const queue of [this.guestQueue, this.rankedQueue]) {
      const idx = queue.findIndex(q => q.socket.id === socketId);
      if (idx !== -1) { queue.splice(idx, 1); break; }
    }
  }

  private async generateLiveKitToken(identity: string, roomName: string): Promise<string | null> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) return null;
    try {
      const at = new AccessToken(apiKey, apiSecret, { identity, ttl: "10m" });
      at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
      return await at.toJwt();
    } catch (err) {
      console.error("LiveKit token generation failed:", err);
      return null;
    }
  }

  private async createRoom(e0: QueueEntry, e1: QueueEntry, mode: RaceMode) {
    const roomId = randomUUID();
    const [token0, token1] = await Promise.all([
      this.generateLiveKitToken(e0.player.name, roomId),
      this.generateLiveKitToken(e1.player.name, roomId),
    ]);

    const p0: Player = { ...e0.player, livekitToken: token0 };
    const p1: Player = { ...e1.player, livekitToken: token1 };

    const room = new Room(roomId, p0, p1, this.io, mode, () => {
      this.rooms.delete(roomId);
      this.socketToRoom.delete(p0.socketId);
      this.socketToRoom.delete(p1.socketId);
    });

    this.rooms.set(roomId, room);
    this.socketToRoom.set(p0.socketId, roomId);
    this.socketToRoom.set(p1.socketId, roomId);
  }
}
