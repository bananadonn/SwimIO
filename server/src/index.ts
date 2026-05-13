import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import {
  EVENTS,
  type QueueJoinPayload,
  type RaceSpeedPayload,
} from "../../shared/protocol";
import { Matchmaker } from "./matchmaker";
import { ANTI_CHEAT } from "./config";

const PORT = Number(process.env.PORT ?? 3001);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") ?? [
  "http://localhost:3000",
];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
});

const matchmaker = new Matchmaker(io);

io.on("connection", (socket) => {
  socket.on(EVENTS.QUEUE_JOIN, (payload: QueueJoinPayload) => {
    if (typeof payload?.guestName !== "string") return;
    const name = payload.guestName.trim().slice(0, ANTI_CHEAT.MAX_NAME_LENGTH);
    if (!name) return;
    const mode = payload.mode === "ranked" ? "ranked" : "guest";
    matchmaker.join(socket, name, mode, payload.authToken).catch(console.error);
  });

  socket.on(EVENTS.QUEUE_LEAVE, () => {
    matchmaker.leave(socket);
  });

  socket.on(EVENTS.RACE_SPEED, (payload: RaceSpeedPayload) => {
    if (typeof payload?.speed !== "number" || typeof payload?.seq !== "number") return;
    matchmaker.onSpeed(socket, payload.speed, payload.seq);
  });

  socket.on(EVENTS.RACE_LEAVE, () => {
    matchmaker.leave(socket);
  });

  socket.on("disconnect", () => {
    matchmaker.leave(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`SwimIO server listening on :${PORT}`);
});
