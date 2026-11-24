import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { io, type Socket } from 'socket.io-client';
import type { HostState, PlayerState, RoleType } from '../server/types.js';

const PORT = Number(process.env.LOAD_PORT || 3121);
const BASE = `http://127.0.0.1:${PORT}`;
const N = Math.max(1, Math.min(200, Number(process.env.LOAD_PLAYERS || 40)));

const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const sockets: Socket[] = [];
let serverLog = '';
child.stdout.on('data', (d: Buffer) => {
  serverLog += d.toString();
});
child.stderr.on('data', (d: Buffer) => {
  serverLog += d.toString();
});

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  throw new Error(`server did not start\n${serverLog}`);
}

async function waitUntil(check: () => boolean, timeout = 10_000): Promise<void> {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > timeout) throw new Error('waitUntil timed out');
    await sleep(5);
  }
}

function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { transports: ['websocket'], forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

type Ack = { ok: boolean; error?: string; [key: string]: unknown };

function emit(socket: Socket, event: string, payload: Record<string, unknown>): Promise<Ack> {
  return new Promise((resolve, reject) => {
    socket.timeout(10_000).emit(event, payload, (err: Error | null, res: Ack) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

interface TestPlayer {
  playerId: string;
  token: string;
  socket: Socket;
  role: RoleType | null;
  ackMs: number | null;
  maxSubmitted: number;
  status: string | null;
  stateBytes: number;
  stateCount: number;
}

type Phase = 'join' | 'start' | 'action' | 'lock';
const phaseBytes: Record<Phase, number> = { join: 0, start: 0, action: 0, lock: 0 };
const phaseMessages: Record<Phase, number> = { join: 0, start: 0, action: 0, lock: 0 };
let phase: Phase = 'join';

function countState(bytes: number): void {
  phaseBytes[phase] += bytes;
  phaseMessages[phase] += 1;
}

function pct(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface ProcUsage {
  rssKb: number;
  cpuTicks: number;
}

function readProc(pid: number): ProcUsage {
  const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
  const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
  const rss = Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] || 0);
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  // Fields after comm: state(0), ..., utime(11), stime(12).
  const ticks = Number(fields[11] || 0) + Number(fields[12] || 0);
  return { rssKb: rss, cpuTicks: ticks };
}

try {
  await waitForServer();
  const room = (await (await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '0420' }),
  })).json()) as { code: string; hostToken: string };

  const host = await connect();
  sockets.push(host);
  let hostBytes = 0;
  let hostStateCount = 0;
  let hostMaxPayload = 0;
  let hostStatus: string | null = null;
  host.on('host:state', (state: HostState) => {
    const bytes = Buffer.byteLength(JSON.stringify(state));
    countState(bytes);
    hostBytes += bytes;
    hostStateCount += 1;
    hostMaxPayload = Math.max(hostMaxPayload, bytes);
    hostStatus = state.status;
  });
  const hostJoin = await emit(host, 'host:join', { code: room.code, token: room.hostToken });
  if (!hostJoin.ok) throw new Error(`host:join failed: ${hostJoin.error}`);

  const joinStart = performance.now();
  const joined = await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const res = await fetch(`${BASE}/api/rooms/${room.code}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: `压测玩家${String(i + 1).padStart(3, '0')}` }),
      });
      if (!res.ok) throw new Error(`join ${i} failed: ${res.status}`);
      return (await res.json()) as { playerId: string; token: string };
    }),
  );
  const restJoinMs = performance.now() - joinStart;

  const connectStart = performance.now();
  const players: TestPlayer[] = await Promise.all(
    joined.map(async (entry) => {
      const socket = await connect();
      sockets.push(socket);
      const player: TestPlayer = {
        ...entry,
        socket,
        role: null,
        ackMs: null,
        maxSubmitted: 0,
        status: null,
        stateBytes: 0,
        stateCount: 0,
      };
      socket.on('player:state', ({ room: state, me }: PlayerState) => {
        const bytes = Buffer.byteLength(JSON.stringify({ room: state, me }));
        countState(bytes);
        player.stateBytes += bytes;
        player.stateCount += 1;
        player.maxSubmitted = Math.max(player.maxSubmitted, state.submittedCount);
        player.status = state.status;
        if (state.status === 'action' && me.role) player.role = me.role.type;
      });
      const ack = await emit(socket, 'player:join', { code: room.code, token: entry.token });
      if (!ack.ok) throw new Error(`player:join ${entry.playerId} failed: ${ack.error}`);
      return player;
    }),
  );
  const connectMs = performance.now() - connectStart;

  const start = performance.now();
  phase = 'start';
  const started = await emit(host, 'host:startRound', { code: room.code, token: room.hostToken });
  if (!started.ok) throw new Error(`host:startRound failed: ${started.error}`);
  await waitUntil(() => players.every((p) => p.role !== null));
  const startFanoutMs = performance.now() - start;

  const usageBefore = readProc(child.pid as number);
  phase = 'action';
  const actionStart = performance.now();
  await Promise.all(
    players.map(async (player) => {
      const t0 = performance.now();
      const ack = await emit(player.socket, 'player:action', {
        code: room.code,
        token: player.token,
        action: player.role === 'H' ? 'skip' : 'attend',
      });
      player.ackMs = performance.now() - t0;
      if (!ack.ok) throw new Error(`player:action ${player.playerId} failed: ${ack.error}`);
    }),
  );
  await waitUntil(() => players.every((p) => p.maxSubmitted >= N));
  const actionFanoutMs = performance.now() - actionStart;

  phase = 'lock';
  const lockStart = performance.now();
  const locked = await emit(host, 'host:lock', { code: room.code, token: room.hostToken });
  if (!locked.ok) throw new Error(`host:lock failed: ${locked.error}`);
  await waitUntil(() => hostStatus === 'reveal' && players.every((p) => p.status === 'reveal'));
  const lockFanoutMs = performance.now() - lockStart;
  const usageAfterLock = readProc(child.pid as number);

  const acks = players.map((p) => p.ackMs ?? 0);
  const playerStateBytes = players.reduce((sum, p) => sum + p.stateBytes, 0);
  const totalSocketBytes = playerStateBytes + hostBytes;
  const elapsedCpu = (usageAfterLock.cpuTicks - usageBefore.cpuTicks) / 100;
  const elapsedSec = (performance.now() - actionStart) / 1000;

  console.log(`\nzaoba load test · ${N} players · ${BASE}`);
  console.log(`REST join (${N} concurrent):        ${roundMs(restJoinMs)} ms`);
  console.log(`WS connect + player:join:          ${roundMs(connectMs)} ms`);
  console.log(`start round → all roles:           ${roundMs(startFanoutMs)} ms`);
  console.log(`action ack p50 / p95 / max:        ${roundMs(pct(acks, 0.5))} / ${roundMs(pct(acks, 0.95))} / ${roundMs(Math.max(...acks))} ms`);
  console.log(`last action → all submitted state: ${roundMs(actionFanoutMs)} ms`);
  console.log(`lock → clients settled:            ${roundMs(lockFanoutMs)} ms`);
  console.log(`player state payload avg / max:    ${formatBytes(playerStateBytes / Math.max(1, players.reduce((s, p) => s + p.stateCount, 0)))} / ${formatBytes(Math.max(...players.map((p) => p.stateBytes / Math.max(1, p.stateCount))))}`);
  console.log(`host state payload max:            ${formatBytes(hostMaxPayload)}`);
  console.log(`socket bytes by phase:             join ${formatBytes(phaseBytes.join)} / start ${formatBytes(phaseBytes.start)} / action ${formatBytes(phaseBytes.action)} / lock ${formatBytes(phaseBytes.lock)}`);
  console.log(`messages by phase:                 join ${phaseMessages.join} / start ${phaseMessages.start} / action ${phaseMessages.action} / lock ${phaseMessages.lock}`);
  console.log(`server→clients in test:            ${formatBytes(totalSocketBytes)} (${players.reduce((s, p) => s + p.stateCount, 0) + hostStateCount} messages)`);
  console.log(`server CPU during action:          ${elapsedCpu.toFixed(2)} s / ${roundMs(elapsedSec * 1000)} ms (${Math.round((elapsedCpu / elapsedSec) * 100)}% of one core)`);
  console.log(`server RSS before / after lock:    ${(usageBefore.rssKb / 1024).toFixed(1)} / ${(usageAfterLock.rssKb / 1024).toFixed(1)} MB`);
} finally {
  for (const socket of sockets) socket.disconnect();
  child.kill('SIGTERM');
  await sleep(300);
}
