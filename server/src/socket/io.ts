import type { Server as IOServer } from 'socket.io';

let io: IOServer | null = null;

export function setSocketServer(s: IOServer): void {
  io = s;
}

export function getSocketServer(): IOServer | null {
  return io;
}
