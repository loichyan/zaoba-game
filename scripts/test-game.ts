import assert from 'node:assert/strict';
import { difficult, disciplined } from '../server/content.js';
import {
  cachedTheoryFor,
  createCoverState,
  createPlayer,
  createRoomSnapshot,
  DEFAULT_SETTINGS,
  hostRoom,
  privatePlayer,
  publicRoom,
  rankPlayers,
  reputationBoard,
  reputationTier,
  resolveCover,
  reviewProbability,
  roleInfo,
  settleRound,
  startLecture2,
  startRound,
  theoryFor,
} from '../server/game.js';
import type { GameMode, RoleType, Room, Settings } from '../server/types.js';
import {
  PROB_EX_EQ_P,
  THRESHOLD_EX_EQ_P,
  compareRoundWithTheory,
  probExamplePayoffs,
  solveBNE,
  thresholdExamplePayoffs,
} from '../src/lib/teaching.js';

const base: Settings = { ...DEFAULT_SETTINGS };

// Pure theory states
assert.equal(theoryFor({ ...base, mode: 'must' }).state, 'ALL_ATTEND');
assert.equal(theoryFor({ ...base, mode: 'never' }).state, 'ALL_SKIP');
assert.equal(theoryFor({ ...base, mode: 'threshold', mood: 90 }).state, 'ALL_SKIP');
assert.equal(theoryFor({ ...base, mode: 'threshold', mood: 70 }).state, 'L_ATTEND_H_SKIP');
assert.equal(theoryFor({ ...base, mode: 'threshold', mood: 50 }).state, 'NO_PURE');
assert.equal(theoryFor({ ...base, mode: 'prob', h: 10 }).state, 'MIXED_L');
assert.equal(theoryFor({ ...base, mode: 'prob', h: 25 }).state, 'L_ATTEND_H_SKIP');
assert.equal(theoryFor({ ...base, mode: 'prob', h: 40 }).state, 'MIXED_H');
assert.equal(theoryFor({ ...base, mode: 'prob', h: 60 }).state, 'MIXED_H');
const mixed = theoryFor({ ...base, mode: 'prob', h: 40 }).mixing;
assert.ok(mixed);
assert.ok(Math.abs(mixed.H.skip - 5 / 14 / 0.4) < 1e-9);

function roomWith(types: RoleType[], settings: Partial<Settings> = {}, gameMode: GameMode = 'base'): Room {
  const room = {
    code: 'TEST',
    pin: '0000',
    hostToken: 'test',
    gameMode,
    nextGameMode: null,
    status: 'action',
    round: 1,
    lecture: 1,
    lectureResults: [],
    teams: new Map(),
    cover: null,
    settings: { ...base, ...settings },
    createdAt: Date.now(),
    startedAt: Date.now(),
    endsAt: Date.now() + 60000,
    players: new Map(),
    history: [],
    result: null,
    participants: [],
    timer: null,
    coverEndsAt: null,
    coverTimer: null,
    hostSockets: new Set(),
    lastActive: Date.now(),
    autoLocked: false,
  } as unknown as Room;
  types.forEach((type, i) => {
    const p = createPlayer(`p${i}`, `P${i}`, 1);
    p.token = `t${i}`;
    p.role = roleInfo(type);
    p.round = 1;
    room.players.set(p.id, p);
  });
  return room;
}

function player(room: Room, id: string) {
  const p = room.players.get(id);
  assert.ok(p);
  return p;
}

// Must call: everyone attends, payoff 10-c / 4 / 7
{
  const room = roomWith(['L', 'H'], { mode: 'must' });
  for (const p of room.players.values()) p.action = 'attend';
  const r = settleRound(room);
  assert.equal(r.called, true);
  assert.equal(r.q, 1);
  assert.equal(player(room, 'p0').score, 7);
  assert.equal(player(room, 'p1').score, 4);
  assert.equal(room.status, 'reveal');
}
// Never call: skips get +5
{
  const room = roomWith(['L', 'H'], { mode: 'never' });
  for (const p of room.players.values()) p.action = 'skip';
  const r = settleRound(room);
  assert.equal(r.called, false);
  assert.equal(r.q, 0);
  assert.equal(player(room, 'p0').score, 5);
  assert.equal(player(room, 'p1').score, 5);
}
// Probability: q = skip rate, H skip, L attend -> q=0.5
{
  const room = roomWith(['L', 'H'], { mode: 'prob', h: 50 });
  player(room, 'p0').action = 'attend';
  player(room, 'p1').action = 'skip';
  const r = settleRound(room);
  assert.equal(r.q, 0.5);
  assert.ok(r.roll !== null);
  assert.equal(r.called, r.roll < 0.5);
  assert.ok(player(room, 'p0').lastResult);
  assert.ok(player(room, 'p1').lastResult);
  assert.equal(player(room, 'p0').lastResult?.payoff, r.called ? 7 : 3);
  assert.equal(player(room, 'p1').lastResult?.payoff, r.called ? -5 : 5);
}
// Threshold: attendance 50% < 70%, qHigh 30%; call is random but q is right
{
  const room = roomWith(['L', 'H'], { mode: 'threshold', h: 50, tau: 70, mood: 70 });
  player(room, 'p0').action = 'attend';
  player(room, 'p1').action = 'skip';
  const r = settleRound(room);
  assert.equal(r.attendanceRate, 0.5);
  assert.ok(Math.abs(r.q - 0.3) < 1e-9);
  assert.equal(typeof r.called, 'boolean');
}
// Missing actions default to skip and must not count as attendance
{
  const room = roomWith(['L', 'H'], { mode: 'threshold', h: 50, tau: 70, mood: 70 });
  const r = settleRound(room);
  assert.equal(r.attendance, 0);
  assert.equal(r.skip, 2);
  assert.equal(r.attendanceRate, 0);
  assert.equal(r.actionCounts.L.skip, 1);
  assert.equal(r.actionCounts.H.skip, 1);
  assert.equal(player(room, 'p0').lastResult?.action, 'skip');
}
// Threshold at/above tau -> q 0
{
  const room = roomWith(['L', 'H'], { mode: 'threshold', h: 50, tau: 50, mood: 70 });
  player(room, 'p0').action = 'attend';
  player(room, 'p1').action = 'skip';
  const r = settleRound(room);
  assert.equal(r.q, 0);
  assert.equal(r.called, false);
}
// Late join waiting: startRound assigns only connected players active this round
{
  const room = roomWith([], { mode: 'threshold' });
  room.status = 'settlement';
  room.round = 0;
  const p1 = createPlayer('a', 'A', 1);
  const p2 = createPlayer('b', 'B', 2);
  p1.token = 'ta';
  p2.token = 'tb';
  p1.connected = true;
  room.players.set('a', p1);
  room.players.set('b', p2);
  startRound(room);
  assert.equal(room.round, 1);
  assert.ok(p1.role);
  assert.equal(p2.role, null);
  assert.equal(p1.round, 1);
  assert.equal(p2.round, null);
}
// A pending game mode selected between rounds is applied by the next startRound.
{
  const room = roomWith([], { mode: 'threshold' }, 'base');
  room.status = 'settlement';
  room.round = 0;
  room.nextGameMode = 'cover';
  const a = createPlayer('a', 'A', 1);
  const b = createPlayer('b', 'B', 1);
  a.token = 'ta';
  b.token = 'tb';
  a.connected = true;
  b.connected = true;
  room.players.set('a', a);
  room.players.set('b', b);
  startRound(room);
  assert.equal(room.gameMode, 'cover');
  assert.equal(room.nextGameMode, null);
  assert.equal(room.teams.size, 1);
}
console.log('game tests passed');

// Rollcall: same role across two lectures, q2 uses first-round state, scores accumulate.
{
  const room = roomWith(['L', 'H'], { mode: 'must' }, 'rollcall');
  for (const p of room.players.values()) p.action = 'attend';
  const first = settleRound(room);
  assert.equal(first.lecture, 1);
  assert.equal(first.called, true);
  assert.equal(first.qBase, 1);
  assert.equal(room.lectureResults.length, 1);
  const roles = [...room.players.values()].map((p) => p.role?.type);
  assert.equal(startLecture2(room), true);
  assert.deepEqual([...room.players.values()].map((p) => p.role?.type), roles);
  for (const p of room.players.values()) p.action = 'skip';
  const second = settleRound(room);
  assert.equal(second.lecture, 2);
  assert.equal(second.firstCalled, true);
  assert.ok(Math.abs(second.q - 0.8) < 1e-9);
  assert.equal(room.lectureResults.length, 2);
  assert.equal(room.history.length, 1);
  assert.equal(room.history[0].lecture, 2);
}
// Rollcall: first not called, second q is lifted.
{
  const room = roomWith(['L', 'H'], { mode: 'never' }, 'rollcall');
  for (const p of room.players.values()) p.action = 'attend';
  const first = settleRound(room);
  assert.equal(first.called, false);
  startLecture2(room);
  for (const p of room.players.values()) p.action = 'attend';
  const second = settleRound(room);
  assert.equal(second.firstCalled, false);
  assert.ok(second.q > 0);
  assert.ok(second.q > second.qBase);
}
// Cover: one helper, one absentee, review uses helper/absentee reputation and settles.
{
  const room = roomWith(['L', 'H'], { mode: 'must' }, 'cover');
  const [a, b] = [...room.players.values()];
  a.action = 'skip';
  b.action = 'attend';
  a.connected = true;
  b.connected = true;
  room.teams.set('team-test', { id: 'team-test', memberIds: [a.id, b.id] });
  const point = { q: 1, qHigh: null, calledBy: 'fixed' as const, qBase: 1, firstCalled: null };
  room.cover = createCoverState(room, point, true, null);
  assert.equal(room.cover.eligible.length, 1);
  const helper = room.players.get(room.cover.eligible[0].helperId)!;
  const absentee = room.players.get(room.cover.eligible[0].absenteeId)!;
  room.cover.choices[helper.id] = 'help';
  const helperBefore = helper.reputation;
  const absenteeBefore = absentee.reputation;
  const random = Math.random;
  Math.random = () => 0;
  try {
    resolveCover(room);
  } finally {
    Math.random = random;
  }
  const result = settleRound(room, false, 'review');
  assert.equal(result.cover?.reviews.length, 1);
  assert.notEqual(helper.reputation, helperBefore);
  assert.equal(absentee.reputation, absenteeBefore - 3);
  assert.equal(privatePlayer(room, absentee).cover?.reputationDelta, -3);
  assert.equal(room.status, 'review');
  assert.ok(helper.score !== 0 || absentee.score !== 0);
}
// Cover: no eligible pair when both choose the same action.
{
  const room = roomWith(['L', 'H'], { mode: 'must' }, 'cover');
  const [a, b] = [...room.players.values()];
  a.action = 'skip';
  b.action = 'skip';
  room.teams.set('team-test', { id: 'team-test', memberIds: [a.id, b.id] });
  const point = { q: 1, qHigh: null, calledBy: 'fixed' as const, qBase: 1, firstCalled: null };
  room.cover = createCoverState(room, point, true, null);
  assert.equal(room.cover.eligible.length, 0);
}
assert.deepEqual([reputationTier(0), reputationTier(35), reputationTier(65), reputationTier(66), reputationTier(100)], ['low', 'mid', 'mid', 'high', 'high']);
assert.ok(reviewProbability(0) > reviewProbability(50));

// Cover team setup: pairs even players, leaves odd player solo, rerolls roles each round.
{
  const room = roomWith(['L', 'H', 'L'], {}, 'cover');
  room.status = 'settlement';
  room.round = 0;
  room.players.forEach((p) => { p.connected = true; });
  startRound(room);
  assert.equal(room.teams.size, 1);
  const team = [...room.teams.values()][0];
  assert.equal(team.memberIds.length, 2);
  assert.equal([...room.players.values()].filter((p) => p.teamId === null).length, 1);
  assert.equal(room.lecture, 1);
}

// Tied ranks (competition ranking 1, 1, 3) and cached broadcast snapshot match uncached output.
{
  const room = roomWith(['L', 'H', 'L'], { mode: 'prob', h: 40, skipPass: true }, 'cover');
  const [p0, p1, p2] = [...room.players.values()];
  p0.score = 10;
  p1.score = 10;
  p2.score = 4;
  p0.reputation = 70;
  p1.reputation = 70;
  p2.reputation = 40;
  p0.connected = true;
  p1.connected = true;
  p2.connected = true;
  room.teams.set('team-1', { id: 'team-1', memberIds: [p0.id, p1.id] });
  p0.teamId = 'team-1';
  p1.teamId = 'team-1';
  const { ranks } = rankPlayers(room);
  assert.equal(ranks.get(p0.id), 1);
  assert.equal(ranks.get(p1.id), 1);
  assert.equal(ranks.get(p2.id), 3);
  const repBoard = reputationBoard(room);
  assert.deepEqual(repBoard.map((r) => r.rank), [1, 1, 3]);
  const snap = createRoomSnapshot(room);
  assert.deepEqual(
    hostRoom(room, snap).leaderboardAll,
    hostRoom(room).leaderboardAll,
  );
  assert.deepEqual(privatePlayer(room, p0, snap), privatePlayer(room, p0));
  // During review, publicRoom hides the leaderboard just like reveal.
  room.status = 'review';
  assert.equal(publicRoom(room).leaderboard, null);
}

// Teaching deck finite-class math matches 30-student class exact derivations, and role pools load from data/.
{
  assert.equal(difficult.length, 85);
  assert.equal(disciplined.length, 83);
  const probEq = probExamplePayoffs(PROB_EX_EQ_P);
  assert.ok(Math.abs(probEq.uHAttend - probEq.uHSkip) < 1e-9);
  assert.ok(Math.abs(probEq.uLAttend - 49 / 11) < 1e-9);
  assert.ok(Math.abs(probEq.uLSkip - 1.0303030303) < 1e-4);

  const thEq = thresholdExamplePayoffs(THRESHOLD_EX_EQ_P);
  assert.ok(Math.abs(thEq.uHAttend - thEq.uHSkip) < 1e-3);
  assert.ok(Math.abs(thEq.uLAttend - 4.508) < 1e-2);
  assert.ok(Math.abs(thEq.uLSkip - 0.414) < 1e-2);
}

// Finite-N exact BNE solver (prob, threshold, fixed deck vs independent draw, low-H separating & MIXED_L)
{
  const prob30 = solveBNE({ n: 30, h: 40, mode: 'prob', tau: 70, mood: 50, dealMode: 'fixed' });
  assert.equal(prob30.state, 'MIXED_H');
  assert.equal(prob30.nH, 12);
  assert.equal(prob30.nL, 18);
  assert.ok(Math.abs(prob30.pH - 1 / 11) < 1e-9);
  assert.ok(Math.abs(prob30.uHAttend - 4 / 3) < 1e-9);
  assert.ok(Math.abs(prob30.uLAttend - 49 / 11) < 1e-9);
  assert.equal(prob30.isLVerified, true);

  const th30 = solveBNE({ n: 30, h: 40, mode: 'threshold', tau: 70, mood: 50, dealMode: 'fixed' });
  assert.equal(th30.state, 'MIXED_H');
  assert.ok(Math.abs(th30.pH - 0.14465) < 1e-4);
  assert.ok(Math.abs(th30.uHAttend - th30.uHSkip) < 1e-6);
  assert.equal(th30.isLVerified, true);

  // Low NH = 5 (h ≈ 17%) collapses to pure separating equilibrium (pL=1, pH=0)
  const sep = solveBNE({ n: 30, h: 17, mode: 'prob', tau: 70, mood: 50, dealMode: 'fixed' });
  assert.equal(sep.nH, 5);
  assert.equal(sep.state, 'L_ATTEND_H_SKIP');
  assert.equal(sep.pL, 1);
  assert.equal(sep.pH, 0);

  // Very low H (10%) yields MIXED_L
  const mixL = solveBNE({ n: 30, h: 10, mode: 'prob', tau: 70, mood: 50, dealMode: 'fixed' });
  assert.equal(mixL.state, 'MIXED_L');
  assert.ok(mixL.pL > 0 && mixL.pL < 1);
  assert.equal(mixL.pH, 0);

  // Independent draw finite-N solver works and produces MIXED_H for default threshold
  const thInd = solveBNE({ n: 30, h: 40, mode: 'threshold', tau: 70, mood: 50, dealMode: 'independent' });
  assert.equal(thInd.state, 'MIXED_H');
  assert.ok(thInd.pH > 0 && thInd.pH < 1);

  // theoryFor(settings, 30) solves threshold mixed equilibrium and exposes exact sampleSize
  const thTheory = theoryFor({ ...base, mode: 'threshold', h: 40, tau: 70, mood: 50, dealMode: 'fixed' }, 30);
  assert.equal(thTheory.state, 'MIXED_H');
  assert.equal(thTheory.sampleSize, 30);
  assert.ok(thTheory.mixing && Math.abs(thTheory.mixing.H.attend - 0.14465) < 1e-4);
}

// Fixed-deck dealing guarantees exact quota (12 H / 18 L for 30 players at 40%), and history stores per-type action counts
{
  const room = roomWith([], { mode: 'threshold', h: 40, tau: 70, mood: 50, dealMode: 'fixed', skipPass: true }, 'base');
  room.status = 'lobby';
  room.round = 0;
  for (let i = 0; i < 30; i += 1) {
    const p = createPlayer(`u${i}`, `U${i}`, 1);
    p.token = `tok${i}`;
    p.connected = true;
    room.players.set(p.id, p);
  }
  startRound(room);
  const hPlayers = [...room.players.values()].filter((p) => p.role?.type === 'H');
  const lPlayers = [...room.players.values()].filter((p) => p.role?.type === 'L');
  assert.equal(hPlayers.length, 12);
  assert.equal(lPlayers.length, 18);

  // Threshold skipPass should be allowed for H (mixed) and null for L (pure attend)
  assert.ok(privatePlayer(room, hPlayers[0]).pass?.allowed);
  assert.equal(privatePlayer(room, lPlayers[0]).pass, null);

  // Settle round and check history carries typeCounts/actionCounts & compareRoundWithTheory
  lPlayers.forEach((p) => { p.action = 'attend'; });
  hPlayers.forEach((p, i) => { p.action = i < 2 ? 'attend' : 'skip'; });
  settleRound(room);
  const entry = room.history[room.history.length - 1];
  assert.equal(entry.typeCounts?.H, 12);
  assert.equal(entry.actionCounts?.H.attend, 2);
  assert.equal(entry.dealMode, 'fixed');
  const cmp = compareRoundWithTheory(entry);
  assert.equal(cmp.hAttend, 2);
  assert.equal(cmp.hTotal, 12);
  assert.ok(Math.abs(cmp.theoryPH - 0.14465) < 1e-4);

  // cachedTheoryFor reuses cached Theory object when key matches and invalidates on settings/count change
  const t1 = cachedTheoryFor(room);
  const t2 = cachedTheoryFor(room);
  assert.equal(t1, t2);
  room.settings = { ...room.settings, h: 20 };
  const t3 = cachedTheoryFor(room);
  assert.notEqual(t3, t1);
  assert.equal(t3.h, 0.2);
}
