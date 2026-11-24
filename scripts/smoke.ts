import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { io, type Socket } from 'socket.io-client';
import type { HostState, PlayerState, RoleType } from '../server/types.js';

const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;
const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: { ...process.env, PORT: String(PORT), DISCONNECT_GRACE_MS: '450' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
child.stdout.on('data', (d: Buffer) => {
  serverLog += d.toString();
});
child.stderr.on('data', (d: Buffer) => {
  serverLog += d.toString();
});

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
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

function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { transports: ['websocket'], forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

type Ack = { ok: boolean; error?: string; state?: unknown; p?: number; [key: string]: unknown };

function emit(socket: Socket, event: string, payload: Record<string, unknown>): Promise<Ack> {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, payload, (err: Error | null, res: Ack) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

interface TestPlayer {
  playerId: string;
  token: string;
  socket: Socket;
}

try {
  await waitForServer();
  const room = (await (await fetch(`${BASE}/api/rooms`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: '0420' }) })).json()) as {
    code: string;
    pin: string;
    hostToken: string;
  };
  assert.equal(room.pin, '0420');
  const hostLogin = await fetch(`${BASE}/api/rooms/${room.code}/host-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '0420' }),
  });
  assert.equal(hostLogin.status, 200);
  const host = await connect();
  assert.equal((await emit(host, 'host:join', { code: room.code, token: room.hostToken })).ok, true);
  assert.equal((await emit(host, 'host:setGameMode', { code: room.code, token: room.hostToken, gameMode: 'cover' })).ok, true);
  const lobbyMode = (await emit(host, 'host:join', { code: room.code, token: room.hostToken })).state as HostState;
  assert.equal(lobbyMode.gameMode, 'cover');
  assert.equal(lobbyMode.nextGameMode, null);
  assert.equal((await emit(host, 'host:setGameMode', { code: room.code, token: room.hostToken, gameMode: 'base' })).ok, true);
  assert.equal((await emit(host, 'host:updateSettings', { code: room.code, token: room.hostToken, patch: { mode: 'prob', h: 40, skipPass: true } })).ok, true);

  const players: TestPlayer[] = [];
  for (let i = 0; i < 20; i += 1) {
    const p = (await (await fetch(`${BASE}/api/rooms/${room.code}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `测试玩家${i}` }),
    })).json()) as { playerId: string; token: string };
    players.push({ ...p, socket: await connect() });
  }
  const roles = new Map<string, RoleType>();
  for (const p of players) {
    const res = await emit(p.socket, 'player:join', { code: room.code, token: p.token });
    assert.equal(res.ok, true);
    p.socket.on('player:state', ({ room: state, me }: PlayerState) => {
      if (state.status === 'action' && me.role) roles.set(p.playerId, me.role.type);
    });
  }
  assert.equal((await emit(host, 'host:startRound', { code: room.code, token: room.hostToken })).ok, true);
  await sleep(400);
  assert.equal(roles.size, 20);
  // Default fixed deck at 40% of 20 players deals exactly 8 H and 12 L
  assert.equal([...roles.values()].filter((r) => r === 'H').length, 8);
  assert.equal([...roles.values()].filter((r) => r === 'L').length, 12);

  const h = players.find((p) => roles.get(p.playerId) === 'H');
  assert.ok(h);
  const draw = await emit(h.socket, 'player:drawPass', { code: room.code, token: h.token });
  assert.equal(draw.ok, true);
  assert.ok((draw.p ?? 0) > 0 && (draw.p ?? 0) < 1);

  for (const p of players) {
    const action = roles.get(p.playerId) === 'H' ? 'skip' : 'attend';
    assert.equal((await emit(p.socket, 'player:action', { code: room.code, token: p.token, action })).ok, true);
  }
  assert.equal((await emit(host, 'host:lock', { code: room.code, token: room.hostToken })).ok, true);
  await sleep(200);
  const state = await emit(host, 'host:join', { code: room.code, token: room.hostToken });
  assert.equal(state.ok, true);
  const hostState = state.state as HostState;
  assert.equal(hostState.status, 'reveal');
  assert.ok(hostState.result);
  assert.ok(Math.abs(hostState.result.q - hostState.result.skipRate) < 1e-9);
  assert.equal((await emit(host, 'host:revealScores', { code: room.code, token: room.hostToken })).ok, true);

  // Disconnect grace period: brief drop stays eligible for startRound and restores without spectator mode
  const scoreBeforeDrop = ((await emit(host, 'host:join', { code: room.code, token: room.hostToken })).state as HostState)
    .players.find((p) => p.id === players[0].playerId)?.score ?? 0;
  players[0].socket.disconnect();
  await sleep(120);
  assert.equal((await emit(host, 'host:startRound', { code: room.code, token: room.hostToken })).ok, true);
  players[0].socket = await connect();
  const rejoinedInRound = await emit(players[0].socket, 'player:join', { code: room.code, token: players[0].token });
  assert.equal(rejoinedInRound.ok, true);
  const rejoinedState = rejoinedInRound.state as PlayerState;
  assert.equal(rejoinedState.me.waiting, false);
  assert.ok(rejoinedState.me.role);
  assert.equal((await emit(host, 'host:lock', { code: room.code, token: room.hostToken })).ok, true);
  assert.equal((await emit(host, 'host:revealScores', { code: room.code, token: room.hostToken })).ok, true);
  const scoreAfterExtra = ((await emit(host, 'host:join', { code: room.code, token: room.hostToken })).state as HostState)
    .players.find((p) => p.id === players[0].playerId)?.score ?? 0;
  assert.ok(Number.isFinite(scoreBeforeDrop) && Number.isFinite(scoreAfterExtra));

  // After grace period expires, disconnected student goes offline and can reclaim exact seat & score
  players[0].socket.disconnect();
  await sleep(600);
  const afterGrace = (await emit(host, 'host:join', { code: room.code, token: room.hostToken })).state as HostState;
  assert.equal(afterGrace.onlineCount, 19);
  assert.equal(afterGrace.players.find((p) => p.id === players[0].playerId)?.connected, false);

  const onlineDup = await fetch(`${BASE}/api/rooms/${room.code}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '测试玩家1' }),
  });
  assert.equal(onlineDup.status, 409);

  const offlineHintRes = await fetch(`${BASE}/api/rooms/${room.code}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '测试玩家0' }),
  });
  assert.equal(offlineHintRes.status, 409);
  const offlineHint = (await offlineHintRes.json()) as { code?: string; offlineName?: string };
  assert.equal(offlineHint.code, 'OFFLINE_SEAT_EXISTS');
  assert.equal(offlineHint.offlineName, '测试玩家0');

  const reclaimRes = await fetch(`${BASE}/api/rooms/${room.code}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '测试玩家0', reclaim: true }),
  });
  assert.equal(reclaimRes.status, 200);
  const reclaimed = (await reclaimRes.json()) as { playerId: string; token: string; reclaimed?: boolean };
  assert.equal(reclaimed.reclaimed, true);
  assert.equal(reclaimed.playerId, players[0].playerId);
  assert.notEqual(reclaimed.token, players[0].token);
  players[0].token = reclaimed.token;
  players[0].socket = await connect();
  const reclaimedJoin = await emit(players[0].socket, 'player:join', { code: room.code, token: reclaimed.token });
  assert.equal(reclaimedJoin.ok, true);
  assert.equal((reclaimedJoin.state as PlayerState).me.score, scoreAfterExtra);

  assert.equal((await emit(host, 'host:final', { code: room.code, token: room.hostToken })).ok, true);

  // Blank names get a generated nickname, and test bots can be added/removed.
  const blank = (await (await fetch(`${BASE}/api/rooms/${room.code}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '   ' }),
  })).json()) as { name: string };
  assert.ok(blank.name.length > 0);

  const beforeBots = (await emit(host, 'host:join', { code: room.code, token: room.hostToken })).state as HostState;
  const added = await emit(host, 'host:addBots', { code: room.code, token: room.hostToken, count: 3 });
  assert.equal(added.ok, true);
  assert.equal(added.count, 3);
  const withBots = (await emit(host, 'host:join', { code: room.code, token: room.hostToken })).state as HostState;
  assert.equal(withBots.playerCount, beforeBots.playerCount + 3);
  const removed = await emit(host, 'host:removeBots', { code: room.code, token: room.hostToken });
  assert.equal(removed.ok, true);
  assert.equal(removed.count, 3);

  // The host can queue another game mode only between rounds; it applies on the next start.
  assert.equal((await emit(host, 'host:setGameMode', { code: room.code, token: room.hostToken, gameMode: 'cover' })).ok, true);
  const pending = (await emit(host, 'host:join', { code: room.code, token: room.hostToken })).state as HostState;
  assert.equal(pending.gameMode, 'base');
  assert.equal(pending.nextGameMode, 'cover');
  assert.equal((await emit(host, 'host:startRound', { code: room.code, token: room.hostToken })).ok, true);
  const next = (await emit(host, 'host:join', { code: room.code, token: room.hostToken })).state as HostState;
  assert.equal(next.gameMode, 'cover');
  assert.equal(next.nextGameMode, null);
  assert.equal(next.status, 'action');
  assert.equal((await emit(host, 'host:setGameMode', { code: room.code, token: room.hostToken, gameMode: 'base' })).ok, false);

  host.disconnect();
  for (const p of players) p.socket.disconnect();
  console.log('smoke passed');
} finally {
  child.kill('SIGTERM');
  await sleep(150);
}
