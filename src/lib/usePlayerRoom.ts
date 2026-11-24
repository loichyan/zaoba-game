import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { joinRoom } from './api';
import { playerKey, read, remove, write } from './storage';
import { connectSocket } from './socket';
import type { Action, PlayerState } from './types';

interface PlayerAck {
  ok: boolean;
  error?: string;
  state?: PlayerState;
  action?: Action;
  p?: number;
  reused?: boolean;
}

export type PlayerConnection = 'join' | 'connecting' | 'ready' | 'offline';

export function usePlayerRoom(code: string) {
  const [auth, setAuth] = useState(() => ({ code, token: code ? read(playerKey(code)) : '' }));
  const token = auth.code === code ? auth.token : code ? read(playerKey(code)) : '';
  const [data, setData] = useState<PlayerState | null>(null);
  const [status, setStatus] = useState<PlayerConnection>(code && token ? 'connecting' : 'join');
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef(token);
  const statusRef = useRef<PlayerConnection>(status);
  const rejoinRef = useRef<() => void>(() => {});

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (auth.code !== code) {
      setAuth({ code, token: code ? read(playerKey(code)) : '' });
      setData(null);
      setError('');
    }
  }, [auth.code, code]);

  useEffect(() => {
    if (!code || !token) {
      setStatus('join');
      setData(null);
      rejoinRef.current = () => {};
      return undefined;
    }
    setStatus('connecting');
    const socket = connectSocket();
    socketRef.current = socket;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let hiddenAt = 0;

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const join = () => {
      clearRetry();
      if (cancelled || !socket.connected) return;
      socket.timeout(6000).emit('player:join', { code, token }, (err: Error | null, res: PlayerAck) => {
        if (cancelled) return;
        if (err) {
          attempt += 1;
          setStatus('offline');
          if (attempt === 1) setError('教室信号有点堵，正在自动重连…');
          if (socket.connected) {
            retryTimer = setTimeout(join, Math.min(4000, 1200 + attempt * 600));
          }
          return;
        }
        if (res?.ok && res.state) {
          attempt = 0;
          setData(res.state);
          setStatus('ready');
          setError('');
        } else {
          remove(playerKey(code));
          setAuth({ code, token: '' });
          setData(null);
          setStatus('join');
          setError(res?.error || '座位凭证过期了，重新输代号进一下教室吧');
        }
      });
    };

    rejoinRef.current = () => {
      if (cancelled) return;
      setStatus('connecting');
      if (!socket.connected) socket.connect();
      else join();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (cancelled) return;
      const sleptLong = hiddenAt > 0 && Date.now() - hiddenAt > 12_000;
      if (!socket.connected) socket.connect();
      else if (statusRef.current !== 'ready' || sleptLong) join();
    };

    const onOnline = () => {
      if (cancelled) return;
      if (!socket.connected) socket.connect();
      else join();
    };

    socket.on('connect', join);
    socket.on('player:state', (next: PlayerState) => {
      attempt = 0;
      clearRetry();
      setData(next);
      setStatus('ready');
    });
    socket.on('disconnect', () => {
      clearRetry();
      setStatus('offline');
    });
    socket.on('connect_error', () => setStatus('offline'));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      clearRetry();
      rejoinRef.current = () => {};
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, token]);

  const call = useCallback(
    (event: string, payload: Record<string, unknown> = {}): Promise<PlayerAck> =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          reject(new Error('信号开小差了，正在重连教室…'));
          return;
        }
        socket.timeout(6000).emit(event, { code, token: tokenRef.current, ...payload }, (err: Error | null, res: PlayerAck) => {
          if (err) reject(new Error('服务器打了个盹，再点一次试试'));
          else if (!res?.ok) reject(new Error(res?.error || '操作没成功'));
          else resolve(res);
        });
      }),
    [code],
  );

  const join = useCallback(
    async (name: string, reclaim = false) => {
      const res = await joinRoom(code, name, reclaim);
      write(playerKey(code), res.token);
      setAuth({ code, token: res.token });
      setError('');
      return res;
    },
    [code],
  );

  const reconnect = useCallback(() => {
    rejoinRef.current();
  }, []);

  const leaveSeat = useCallback(() => {
    if (code) remove(playerKey(code));
    setAuth({ code, token: '' });
    setData(null);
    setStatus('join');
    setError('');
  }, [code]);

  return {
    token,
    data,
    status,
    error,
    join,
    reconnect,
    leaveSeat,
    act: (action: Action) => call('player:action', { action }),
    cover: (choice: 'help' | 'decline') => call('player:cover', { choice }),
    drawPass: () => call('player:drawPass'),
  };
}
