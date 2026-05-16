import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@flags/shared";

/** In dev, Vite proxies /socket.io. On Vercel, set VITE_SOCKET_URL to your Render/Railway backend. */
const url = import.meta.env.DEV
  ? undefined
  : import.meta.env.VITE_SOCKET_URL || undefined;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
