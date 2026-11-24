import { io, type Socket } from 'socket.io-client';

export function connectSocket(): Socket {
  return io({
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 700,
    reconnectionDelayMax: 3000,
    transports: ['websocket', 'polling'],
  });
}
