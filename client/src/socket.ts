import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@flags/shared";

const url =
  import.meta.env.DEV ? undefined : window.location.origin;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
