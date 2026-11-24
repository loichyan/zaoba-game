import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import {
  DEFAULT_SETTINGS,
  GAME_MODES,
  cachedTheoryFor,
  coverEligiblePlayers,
  createCoverState,
  createPlayer,
  createRoomSnapshot,
  hostRoom,
  privatePlayer,
  publicRoom,
  pointForRoom,
  rankPlayers,
  resolveCover,
  rollPoint,
  sanitizeName,
  sanitizeSettings,
  settleRound,
  startLecture2,
  startRound,
  theoryFor,
  theoryPlayerCount,
} from './game.js';
import { randomGeneralName } from './nicknames.js';
import type { Action, CoverChoice, GameMode, Player, RoleType, Room, Settings } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
  maxHttpBufferSize: 1e6,
  // 20s heartbeat stays safely below typical 60s reverse-proxy idle read timeouts.
  pingInterval: 20_000,
  pingTimeout: 20_000,
});

app.use(express.json({ limit: '64kb' }));

const rooms = new Map<string, Room>();
const rawGrace = Number(process.env.DISCONNECT_GRACE_MS);
const DISCONNECT_GRACE_MS = Number.isFinite(rawGrace) && rawGrace >= 0 ? rawGrace : 25_000;
const playerDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

function disconnectTimerKey(code: string, playerId: string): string {
  return `${code}:${playerId}`;
}

function clearPlayerDisconnectTimer(code: string, playerId: string): void {
  const key = disconnectTimerKey(code, playerId);
  const timer = playerDisconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    playerDisconnectTimers.delete(key);
  }
}

function clearRoomDisconnectTimers(code: string): void {
  const prefix = `${code}:`;
  for (const [key, timer] of playerDisconnectTimers) {
    if (key.startsWith(prefix)) {
      clearTimeout(timer);
      playerDisconnectTimers.delete(key);
    }
  }
}

function schedulePlayerOffline(room: Room, player: Player): void {
  const key = disconnectTimerKey(room.code, player.id);
  clearPlayerDisconnectTimer(room.code, player.id);
  if (DISCONNECT_GRACE_MS === 0) {
    player.connected = false;
    broadcast(room);
    return;
  }
  const timer = setTimeout(() => {
    playerDisconnectTimers.delete(key);
    if (rooms.get(room.code) !== room) return;
    const current = room.players.get(player.id);
    if (!current || current !== player || current.socketIds.size > 0) return;
    current.connected = false;
    broadcast(room);
  }, DISCONNECT_GRACE_MS);
  timer.unref?.();
  playerDisconnectTimers.set(key, timer);
}

type Ack = (data: unknown) => void;

interface AuthPayload {
  code?: unknown;
  token?: unknown;
  [key: string]: unknown;
}

type HostResult = { room: Room; error: null } | { room: null; error: string };
type PlayerResult = { room: Room; player: Player; error: null } | { room: null; player: null; error: string };

function randomCode(): string {
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function randomToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function randomPin(): string {
  return String(crypto.randomInt(1000, 10000));
}

function createRoom(pin?: string): Room {
  const room: Room = {
    code: randomCode(),
    pin: pin || randomPin(),
    hostToken: randomToken(),
    gameMode: 'base',
    nextGameMode: null,
    players: new Map(),
    status: 'lobby',
    round: 0,
    lecture: 1,
    lectureResults: [],
    teams: new Map(),
    cover: null,
    settings: { ...DEFAULT_SETTINGS },
    createdAt: Date.now(),
    startedAt: null,
    endsAt: null,
    result: null,
    history: [],
    participants: [],
    timer: null,
    coverEndsAt: null,
    coverTimer: null,
    hostSockets: new Set(),
    lastActive: Date.now(),
    autoLocked: false,
  };
  rooms.set(room.code, room);
  return room;
}

function getRoom(code: unknown): Room | undefined {
  return rooms.get(String(code || '').toUpperCase());
}

function clearTimer(room: Room): void {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function clearCoverTimer(room: Room): void {
  if (room.coverTimer) {
    clearTimeout(room.coverTimer);
    room.coverTimer = null;
  }
}

function broadcast(room: Room): void {
  room.lastActive = Date.now();
  if (process.env.DEBUG_SOCKET) console.log('broadcast', room.code, room.status, room.players.size);
  const snapshot = createRoomSnapshot(room);
  io.to(`host:${room.code}`).emit('host:state', hostRoom(room, snapshot));
  for (const player of room.players.values()) {
    io.to(`player:${room.code}:${player.id}`).emit('player:state', {
      room: snapshot.pub,
      me: privatePlayer(room, player, snapshot),
    });
  }
}

function hostAuth(payload: AuthPayload | undefined): HostResult {
  const room = getRoom(payload?.code);
  if (!room) return { room: null, error: '找不到这间教室，核对一下四位房间码？' };
  if (!payload?.token || payload.token !== room.hostToken) return { room: null, error: '主持人凭证已过期，请重新输入 PIN' };
  return { room, error: null };
}

function playerAuth(payload: AuthPayload | undefined): PlayerResult {
  const room = getRoom(payload?.code);
  if (!room) return { room: null, player: null, error: '找不到这间教室，核对一下四位房间码？' };
  const player = [...room.players.values()].find((p) => p.token === payload?.token);
  if (!player) return { room: null, player: null, error: '座位凭证过期了，重新输个代号进教室吧' };
  return { room, player, error: null };
}

function reply(ack: Ack | undefined, data: unknown): void {
  if (typeof ack === 'function') ack(data);
}

function findPlayerByName(room: Room, name: string): Player | undefined {
  for (const player of room.players.values()) {
    if (player.name === name) return player;
  }
  return undefined;
}

function nameTaken(room: Room, name: string): boolean {
  return Boolean(findPlayerByName(room, name));
}

function uniqueGeneratedName(room: Room): string {
  for (let i = 0; i < 80; i += 1) {
    const name = randomGeneralName();
    if (!nameTaken(room, name)) return name;
  }
  const base = randomGeneralName();
  let unique = base;
  let suffix = 2;
  while (nameTaken(room, unique)) {
    const tail = `·${suffix}`;
    unique = `${base.slice(0, Math.max(1, 12 - tail.length))}${tail}`;
    suffix += 1;
  }
  return unique;
}

function sanitizeNewName(room: Room, raw: unknown): { name: string; error: null } | { name: null; error: string } {
  const requested = sanitizeName(raw);
  if (requested) {
    if (nameTaken(room, requested)) return { name: null, error: '这个昵称已经有人用了，换一个吧' };
    return { name: requested, error: null };
  }
  return { name: uniqueGeneratedName(room), error: null };
}

function botAction(settings: Settings, type: RoleType, participantCount: number): Action {
  if (settings.mode === 'must') return 'attend';
  if (settings.mode === 'never') return 'skip';
  if (settings.mode === 'prob' || settings.mode === 'threshold') {
    const theory = theoryFor(settings, participantCount);
    if (theory.mixing) {
      const p = theory.mixing[type].skip;
      return Math.random() < p ? 'skip' : 'attend';
    }
    const pure = theory.pure[0];
    if (pure) return pure[type];
  }
  return type === 'H' ? 'skip' : 'attend';
}

// Bots answer a little after the round starts so the host sees the roster fill up.
function scheduleBots(room: Room): void {
  const round = room.round;
  const lecture = room.lecture;
  const count = theoryPlayerCount(room);
  for (const player of room.players.values()) {
    if (!player.bot || player.round !== round || !player.role) continue;
    const delay = 350 + Math.random() * 1200;
    setTimeout(() => {
      if (room.status !== 'action' || room.round !== round || room.lecture !== lecture) return;
      if (!room.players.has(player.id) || player.action || !player.role) return;
      player.action = botAction(room.settings, player.role.type, count);
      player.submittedAt = Date.now();
      broadcast(room);
    }, delay).unref();
  }
}

function finishCover(room: Room, autoLocked: boolean): void {
  if (room.status !== 'cover' || !room.cover) return;
  clearCoverTimer(room);
  resolveCover(room);
  settleRound(room, autoLocked, 'review');
  broadcast(room);
}

function scheduleCoverBots(room: Room): void {
  const cover = room.cover;
  if (!cover) return;
  for (const entry of cover.eligible) {
    const helper = room.players.get(entry.helperId);
    if (!helper?.bot || cover.choices[helper.id]) continue;
    const delay = 450 + Math.random() * 1000;
    setTimeout(() => {
      if (room.status !== 'cover' || room.cover !== cover || cover.revealed) return;
      if (cover.choices[helper.id]) return;
      const choice: CoverChoice = Math.random() < 0.65 ? 'help' : 'decline';
      cover.choices[helper.id] = choice;
      helper.coverChoice = choice;
      broadcast(room);
      if (Object.keys(cover.choices).length >= cover.eligible.length) {
        finishCover(room, false);
      }
    }, delay).unref();
  }
}

function finishAction(room: Room, autoLocked: boolean): void {
  clearTimer(room);
  if (room.gameMode === 'cover') {
    const participants = [...room.players.values()].filter((p) => p.round === room.round);
    const attendance = participants.filter((p) => p.action === 'attend').length;
    const attendanceRate = participants.length ? attendance / participants.length : 0;
    const facts = rollPoint(pointForRoom(room, attendanceRate));
    const eligible = coverEligiblePlayers(room);
    if (facts.called && eligible.length > 0) {
      const cover = createCoverState(room, facts.point, facts.called, facts.roll);
      room.cover = cover;
      room.status = 'cover';
      room.endsAt = null;
      room.coverEndsAt = cover.endsAt;
      broadcast(room);
      scheduleCoverBots(room);
      room.coverTimer = setTimeout(() => {
        if (room.status === 'cover' && room.cover === cover) finishCover(room, true);
      }, room.settings.duration * 1000);
      return;
    }
    settleRound(room, autoLocked, 'reveal', facts);
  } else {
    settleRound(room, autoLocked);
  }
  broadcast(room);
}

function startRoomRound(room: Room): { ok: boolean; error?: string } {
  if (!['lobby', 'settlement', 'final'].includes(room.status)) {
    return { ok: false, error: '当前这局还没收尾，不能直接开新局' };
  }
  const nextRound = room.round + 1;
  const active = [...room.players.values()].filter((p) => p.activeFrom <= nextRound && p.connected);
  if (!active.length) return { ok: false, error: '教室里还没有在线同学，先让大家扫码进场吧' };
  clearTimer(room);
  clearCoverTimer(room);
  startRound(room);
  broadcast(room);
  scheduleBots(room);
  const round = room.round;
  const lecture = room.lecture;
  room.timer = setTimeout(() => {
    if (room.status === 'action' && room.round === round && room.lecture === lecture) {
      finishAction(room, true);
    }
  }, room.settings.duration * 1000);
  return { ok: true };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, now: Date.now() });
});

app.get('/api/network', (_req, res) => {
  const addresses: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) addresses.push(item.address);
    }
  }
  res.json({ addresses, port: PORT });
});

app.post('/api/rooms', (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  if (pin && !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN 要四位数字，或者留空自动生成' });
  }
  const room = createRoom(pin || undefined);
  res.json({ code: room.code, pin: room.pin, hostToken: room.hostToken });
});

app.post('/api/rooms/:code/host-login', (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: '找不到这间教室，核对一下房间码？' });
  if (String(req.body?.pin || '') !== room.pin) return res.status(403).json({ error: 'PIN 码不对，再核对一下四位数字' });
  res.json({ hostToken: room.hostToken, pin: room.pin, code: room.code });
});

app.get('/api/rooms/:code/nickname', (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: '找不到这间教室，核对一下四位房间码？' });
  res.set('Cache-Control', 'no-store');
  res.json({ name: uniqueGeneratedName(room) });
});

app.post('/api/rooms/:code/join', (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: '找不到这间教室，核对一下四位房间码？' });
  const requested = sanitizeName(req.body?.name);
  const existing = requested ? findPlayerByName(room, requested) : undefined;
  if (existing) {
    if (existing.bot) {
      return res.status(409).json({ error: '这个昵称已经有人用了，换一个吧' });
    }
    if (existing.socketIds.size > 0) {
      return res.status(409).json({ error: '这个代号当前在线；如果是你本人刚切走，切回原页面就行，否则换个代号吧' });
    }
    if (req.body?.reclaim !== true) {
      return res.status(409).json({
        error: `「${existing.name}」之前已入座目前离线，如果是你本人重连，可点「回到原座位」找回积分`,
        code: 'OFFLINE_SEAT_EXISTS',
        offlineName: existing.name,
      });
    }
    clearPlayerDisconnectTimer(room.code, existing.id);
    existing.token = randomToken();
    return res.json({
      playerId: existing.id,
      token: existing.token,
      code: room.code,
      name: existing.name,
      activeFrom: existing.activeFrom,
      reclaimed: true,
    });
  }
  if (room.players.size >= 200) return res.status(409).json({ error: '这间教室已经塞满 200 人了' });
  const picked = sanitizeNewName(room, req.body?.name);
  if (!picked.name) return res.status(409).json({ error: picked.error });
  const id = crypto.randomBytes(8).toString('hex');
  const player = createPlayer(id, picked.name, room.round + 1);
  player.token = randomToken();
  room.players.set(id, player);
  broadcast(room);
  res.json({
    playerId: player.id,
    token: player.token,
    code: room.code,
    name: player.name,
    activeFrom: player.activeFrom,
  });
});

io.on('connection', (socket) => {
  socket.on('host:join', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    if (socket.data.hostCode) socket.leave(`host:${socket.data.hostCode}`);
    socket.data.hostCode = room.code;
    room.hostSockets.add(socket.id);
    socket.join(`host:${room.code}`);
    reply(ack, { ok: true, state: hostRoom(room) });
    broadcast(room);
  });

  socket.on('player:join', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = playerAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    const player = auth.player as Player;
    clearPlayerDisconnectTimer(room.code, player.id);
    if (socket.data.playerRoom && socket.data.playerId) {
      socket.leave(`player:${socket.data.playerRoom}:${socket.data.playerId}`);
    }
    const wasConnected = player.connected;
    socket.data.playerRoom = room.code;
    socket.data.playerId = player.id;
    player.socketIds.add(socket.id);
    player.connected = true;
    socket.join(`player:${room.code}:${player.id}`);
    reply(ack, {
      ok: true,
      state: {
        room: publicRoom(room),
        me: privatePlayer(room, player, { theory: cachedTheoryFor(room) }),
      },
    });
    if (!wasConnected) broadcast(room);
  });

  socket.on('host:updateSettings', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    if (!['lobby', 'settlement', 'final'].includes(room.status)) {
      return reply(ack, { ok: false, error: '这局已经开跑，等本局结算后再改规则吧' });
    }
    const next = sanitizeSettings(payload?.patch, room.settings);
    if (next.mode !== 'prob' && next.mode !== 'threshold') next.skipPass = false;
    room.settings = next;
    reply(ack, { ok: true, settings: room.settings, theory: theoryFor(room.settings, theoryPlayerCount(room)) });
    broadcast(room);
  });

  socket.on('host:setGameMode', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    if (!['lobby', 'settlement', 'final'].includes(room.status)) {
      return reply(ack, { ok: false, error: '这局还没结束，等结算后再换玩法吧' });
    }
    const gameMode = payload?.gameMode as GameMode;
    if (!GAME_MODES.includes(gameMode)) {
      return reply(ack, { ok: false, error: '没有这个玩法模式' });
    }
    if (room.status === 'lobby') {
      room.gameMode = gameMode;
      room.nextGameMode = null;
    } else {
      room.nextGameMode = gameMode === room.gameMode ? null : gameMode;
    }
    reply(ack, { ok: true, nextGameMode: room.nextGameMode });
    broadcast(room);
  });

  socket.on('host:startRound', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    reply(ack, startRoomRound(room));
  });

  socket.on('host:nextLecture', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    if (!startLecture2(room)) return reply(ack, { ok: false, error: '现在还不能进入第二堂' });
    clearTimer(room);
    reply(ack, { ok: true });
    broadcast(room);
    scheduleBots(room);
    const round = room.round;
    const lecture = room.lecture;
    room.timer = setTimeout(() => {
      if (room.status === 'action' && room.round === round && room.lecture === lecture) finishAction(room, true);
    }, room.settings.duration * 1000);
  });

  socket.on('host:lock', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    if (room.status === 'cover') {
      reply(ack, { ok: true });
      finishCover(room, false);
      return;
    }
    if (room.status !== 'action') return reply(ack, { ok: false, error: '现在不在收卷阶段' });
    reply(ack, { ok: true });
    try {
      finishAction(room, false);
    } catch (err) {
      console.error('finishAction failed', err);
    }
  });

  socket.on('host:revealScores', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    if (room.status !== 'reveal' && room.status !== 'review') return reply(ack, { ok: false, error: '还没到公布积分榜的阶段' });
    if (room.gameMode === 'rollcall' && room.lecture === 1) {
      return reply(ack, { ok: false, error: '第二堂还没上，先把回笼觉环节打完' });
    }
    room.status = 'settlement';
    reply(ack, { ok: true });
    broadcast(room);
  });

  socket.on('host:final', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    if (['action', 'cover', 'review'].includes(room.status)) return reply(ack, { ok: false, error: '这局还在进行中，先收卷揭晓再下课吧' });
    if (room.gameMode === 'rollcall' && room.status === 'reveal' && room.lecture === 1) {
      return reply(ack, { ok: false, error: '第二堂还没上，先把回笼觉环节打完' });
    }
    clearTimer(room);
    clearCoverTimer(room);
    room.status = 'final';
    room.endsAt = null;
    reply(ack, { ok: true });
    broadcast(room);
  });

  socket.on('host:resetScores', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    if (!['lobby', 'settlement', 'final'].includes(room.status)) {
      return reply(ack, { ok: false, error: '这局还没打完，等结算后再清零积分吧' });
    }
    for (const player of room.players.values()) {
      player.score = 0;
      if (player.lastResult) {
        player.lastResult.scoreAfter = 0;
        player.lastResult.rankAfter = 1;
      }
      for (const item of player.lectureResults) {
        if (item.scoreAfter !== undefined) item.scoreAfter = 0;
        if (item.rankAfter !== undefined) item.rankAfter = 1;
      }
    }
    if (room.result) {
      const { sorted } = rankPlayers(room);
      room.result.top = sorted.slice(0, 3).map((p) => ({ name: p.name, score: p.score }));
    }
    reply(ack, { ok: true });
    broadcast(room);
  });

  socket.on('host:addBots', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    const count = Math.max(1, Math.min(50, Math.floor(Number(payload?.count) || 1)));
    const available = 200 - room.players.size;
    const toAdd = Math.min(count, available);
    if (toAdd <= 0) return reply(ack, { ok: false, error: '这间教室已经塞满 200 人了' });
    const activeFrom = room.status === 'lobby' ? 1 : room.round + 1;
    for (let i = 0; i < toAdd; i += 1) {
      const id = crypto.randomBytes(8).toString('hex');
      const player = createPlayer(id, uniqueGeneratedName(room), activeFrom, true);
      player.token = randomToken();
      player.connected = true;
      room.players.set(id, player);
    }
    reply(ack, { ok: true, count: toAdd });
    broadcast(room);
  });

  socket.on('host:removeBots', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = hostAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    if (['action', 'cover', 'review'].includes(room.status)) return reply(ack, { ok: false, error: '本局进行中，收卷后再移除机器人' });
    let removed = 0;
    for (const [id, player] of room.players) {
      if (player.bot) {
        room.players.delete(id);
        removed += 1;
      }
    }
    reply(ack, { ok: true, count: removed });
    broadcast(room);
  });

  socket.on('player:action', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = playerAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    const player = auth.player as Player;
    if (room.status !== 'action') return reply(ack, { ok: false, error: '手慢一步，这局已经收卷锁定了' });
    if (player.round !== room.round || !player.role) {
      return reply(ack, { ok: false, error: '这局你在场边吃瓜观战，下一局马上给你发牌' });
    }
    const action = payload?.action;
    if (action !== 'attend' && action !== 'skip') {
      return reply(ack, { ok: false, error: '只能选去上课或翘课' });
    }
    if (player.action === action) {
      return reply(ack, { ok: true });
    }
    player.action = action as Action;
    player.submittedAt = Date.now();
    reply(ack, { ok: true });
    broadcast(room);
  });

  socket.on('player:cover', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = playerAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    const player = auth.player as Player;
    if (room.status !== 'cover' || !room.cover) {
      return reply(ack, { ok: false, error: '现在不在代勤抉择阶段' });
    }
    if (room.cover.revealed) return reply(ack, { ok: false, error: '全班已经亮牌了，手速慢了一步' });
    const entry = room.cover.eligible.find((item) => item.helperId === player.id);
    if (!entry) return reply(ack, { ok: false, error: '这一轮你没有代勤机会' });
    const choice = payload?.choice;
    if (choice !== 'help' && choice !== 'decline') {
      return reply(ack, { ok: false, error: '只能选择帮或不帮' });
    }
    room.cover.choices[player.id] = choice as CoverChoice;
    player.coverChoice = choice as CoverChoice;
    reply(ack, { ok: true });
    broadcast(room);
    if (Object.keys(room.cover.choices).length >= room.cover.eligible.length) {
      finishCover(room, false);
    }
  });

  socket.on('player:drawPass', (payload: AuthPayload | undefined, ack?: Ack) => {
    const auth = playerAuth(payload);
    if (auth.error) return reply(ack, { ok: false, error: auth.error });
    const room = auth.room as Room;
    const player = auth.player as Player;
    if (room.status !== 'action') return reply(ack, { ok: false, error: '现在不在摇签时间' });
    const passMode = room.settings.mode === 'prob' || room.settings.mode === 'threshold';
    if (room.gameMode !== 'base' || !passMode || !room.settings.skipPass) {
      return reply(ack, { ok: false, error: '老师这局没开“随缘翘课签”' });
    }
    if (player.round !== room.round || !player.role) {
      return reply(ack, { ok: false, error: '这局你在场边观战，下一局再摇签吧' });
    }
    if (player.passDraw?.round === room.round) {
      return reply(ack, { ok: true, ...player.passDraw, reused: true });
    }
    const theory = cachedTheoryFor(room);
    const mix = theory.mixing;
    const p = mix?.[player.role.type].skip ?? 0;
    if (!(p > 0.0001 && p < 0.9999)) {
      return reply(ack, { ok: false, error: '你这个身份本局策略很明确，不用摇签纠结啦' });
    }
    const action: Action = Math.random() < p ? 'skip' : 'attend';
    player.passDraw = { round: room.round, action, p };
    reply(ack, { ok: true, action, p });
  });

  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      if (room.hostSockets.delete(socket.id)) {
        // Host presence does not change the game; state is still broadcast to the host room.
      }
      for (const player of room.players.values()) {
        if (player.socketIds.delete(socket.id) && player.socketIds.size === 0 && player.connected) {
          schedulePlayerOffline(room, player);
        }
      }
    }
  });
});

// Periodic cleanup: keep rooms for a day of class use, drop idle lobbies after 12 h.
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyConnected = room.hostSockets.size > 0 || [...room.players.values()].some((p) => p.connected);
    if (!anyConnected && now - room.lastActive > 12 * 60 * 60 * 1000) {
      clearTimer(room);
      clearCoverTimer(room);
      clearRoomDisconnectTimers(code);
      rooms.delete(code);
    }
  }
}, 60 * 60 * 1000);
cleanupInterval.unref();

const serveStatic = process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === '1';
if (serveStatic) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/index.html 不存在，先跑 npm run build');
    process.exit(1);
  }
  app.use(express.static(DIST, { maxAge: '1h', index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('text/plain').send('早八生存局 API 在跑。开发页面请打开 Vite 的地址（默认 http://localhost:5173）。');
  });
}

server.listen(PORT, HOST, () => {
  console.log(`早八生存局 server: http://localhost:${PORT} (listening on ${HOST}:${PORT})`);
  if (serveStatic) console.log(`serving dist from ${DIST}`);
});

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`收到 ${signal}，正在优雅关闭服务…`);
  clearInterval(cleanupInterval);
  for (const room of rooms.values()) {
    clearTimer(room);
    clearCoverTimer(room);
    clearRoomDisconnectTimers(room.code);
  }
  const forceExit = setTimeout(() => process.exit(0), 3000);
  forceExit.unref();
  io.close(() => {
    clearTimeout(forceExit);
    process.exit(0);
  });
  server.closeIdleConnections?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
