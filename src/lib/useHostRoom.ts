import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { hostLogin } from './api';
import { hostKey, read, remove, write } from './storage';
import { connectSocket } from './socket';
import type { GameMode, HostState, Settings, Theory } from './types';

interface HostAck {
  ok: boolean;
  error?: string;
  state?: HostState;
  settings?: Settings;
  theory?: Theory;
}

export type HostConnection = 'auth' | 'connecting' | 'ready' | 'offline';

export function useHostRoom(code: string) {
  const [auth, setAuth] = useState(() => ({ code, token: read(hostKey(code)) }));
  const token = auth.code === code ? auth.token : read(hostKey(code));
  const [state, setState] = useState<HostState | null>(null);
  const [status, setStatus] = useState<HostConnection>(token ? 'connecting' : 'auth');
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (auth.code !== code) {
      setAuth({ code, token: read(hostKey(code)) });
      setState(null);
      setError('');
    }
  }, [auth.code, code]);

  useEffect(() => {
    if (!token) {
      setStatus('auth');
      setState(null);
      return undefined;
    }
    setStatus('connecting');
    const socket = connectSocket();
    socketRef.current = socket;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const join = () => {
      clearRetry();
      if (cancelled || !socket.connected) return;
      socket.timeout(6000).emit('host:join', { code, token }, (err: Error | null, res: HostAck) => {
        if (cancelled) return;
        if (err) {
          attempt += 1;
          setStatus('offline');
          if (socket.connected) {
            retryTimer = setTimeout(join, Math.min(4000, 1200 + attempt * 600));
          }
          return;
        }
        if (res?.ok && res.state) {
          attempt = 0;
          setState(res.state);
          setStatus('ready');
          setError('');
        } else {
          remove(hostKey(code));
          setAuth({ code, token: '' });
          setStatus('auth');
          setError(res?.error || '主持人登录已过期，请重新输入 PIN');
        }
      });
    };

    socket.on('connect', join);
    socket.on('host:state', (next: HostState) => {
      attempt = 0;
      clearRetry();
      setState(next);
      setStatus('ready');
    });
    socket.on('disconnect', () => {
      clearRetry();
      setStatus('offline');
    });
    socket.on('connect_error', () => setStatus('offline'));

    return () => {
      cancelled = true;
      clearRetry();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, token]);

  const call = useCallback(
    (event: string, payload: Record<string, unknown> = {}): Promise<HostAck> =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          reject(new Error('信号断了，正在重连讲台…'));
          return;
        }
        socket.timeout(6000).emit(event, { code, token: tokenRef.current, ...payload }, (err: Error | null, res: HostAck) => {
          if (err) reject(new Error('服务器打了个盹，再点一次试试'));
          else if (!res?.ok) reject(new Error(res?.error || '操作没成功'));
          else resolve(res);
        });
      }),
    [code],
  );

  const login = useCallback(
    async (pin: string) => {
      const res = await hostLogin(code, pin);
      write(hostKey(code), res.hostToken);
      setAuth({ code, token: res.hostToken });
      setError('');
      return res;
    },
    [code],
  );

  return {
    token,
    state,
    status,
    error,
    login,
    updateSettings: (patch: Partial<Settings>) => call('host:updateSettings', { patch }),
    setGameMode: (gameMode: GameMode) => call('host:setGameMode', { gameMode }),
    startRound: () => call('host:startRound'),
    nextLecture: () => call('host:nextLecture'),
    lock: () => call('host:lock'),
    revealScores: () => call('host:revealScores'),
    final: () => call('host:final'),
    resetScores: () => call('host:resetScores'),
    addBots: (count: number) => call('host:addBots', { count }),
    removeBots: () => call('host:removeBots'),
  };
}
