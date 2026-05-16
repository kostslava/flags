import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import type { ClientToServerEvents, ServerToClientEvents } from "@flags/shared";
import * as game from "./game.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === "production";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: true },
});

function emitRoom(code: string) {
  const state = game.getRoomState(code);
  if (state) io.to(code).emit("roomState", state);
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, lang }, cb) => {
    const { state } = game.createRoom(socket.id, name, lang);
    socket.join(state.code);
    cb({ ok: true, state });
    emitRoom(state.code);
  });

  socket.on("joinRoom", ({ code, name, lang }, cb) => {
    const result = game.joinRoom(socket.id, code, name, lang);
    if (!result.ok) {
      cb(result);
      return;
    }
    socket.join(result.state.code);
    cb(result);
    emitRoom(result.state.code);
  });

  socket.on("setLang", (lang) => {
    game.setLang(socket.id, lang);
  });

  socket.on("setDifficulty", (difficulty) => {
    const state = game.setDifficulty(socket.id, difficulty);
    if (state) emitRoom(state.code);
  });

  socket.on("startGame", () => {
    const state = game.startGame(socket.id);
    if (state) emitRoom(state.code);
  });

  socket.on("answer", (label) => {
    const state = game.submitAnswer(socket.id, label);
    if (state) emitRoom(state.code);
  });

  socket.on("nextRound", () => {
    const state = game.nextRound(socket.id);
    if (state) emitRoom(state.code);
  });

  socket.on("resetLobby", () => {
    const state = game.resetToLobby(socket.id);
    if (state) emitRoom(state.code);
  });

  socket.on("leaveRoom", () => {
    const code = game.leaveRoom(socket.id);
    if (code) {
      socket.leave(code);
      emitRoom(code);
    }
  });

  socket.on("disconnect", () => {
    const code = game.leaveRoom(socket.id);
    if (code) emitRoom(code);
  });
});

if (isProd) {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.use((_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

httpServer.listen(PORT, () => {
  console.log(`Flags server on http://localhost:${PORT}`);
});
