import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@flags/shared";

const serverUrl = import.meta.env.VITE_SOCKET_URL?.trim() || undefined;

/** True when the client knows where the game server is (dev proxy or VITE_SOCKET_URL). */
export const isBackendConfigured = import.meta.env.DEV || Boolean(serverUrl);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  import.meta.env.DEV ? undefined : serverUrl,
  {
    autoConnect: isBackendConfigured,
    transports: ["websocket", "polling"],
  },
);
