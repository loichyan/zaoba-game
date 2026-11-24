import { solveBNE } from './bne.js';
import { difficult, disciplined } from './content.js';
import type {
  Action,
  CoverChoice,
  CoverOutcome,
  CoverPersonal,
  CoverReview,
  CoverState,
  CoverSummary,
  DealMode,
  GameMode,
  HostRoom,
  LastResult,
  Mixing,
  Mode,
  Player,
  Point,
  PrivatePlayer,
  PublicRoom,
  PureProfile,
  ReputationEntry,
  ReputationTier,
  Result,
  Role,
  RoleType,
  Room,
  RoomStatus,
  Settings,
  Team,
  TeamPublic,
  Theory,
} from './types.js';

export const COSTS: Record<RoleType, number> = { H: 6, L: 3 };
export const THRESHOLDS: Record<RoleType, number> = { L: 1 / 7, H: 5 / 14 };
export const MODES: Mode[] = ['must', 'never', 'prob', 'threshold'];
export const DEAL_MODES: DealMode[] = ['fixed', 'independent'];
export const MOODS = [90, 70, 50];
export const GAME_MODES: GameMode[] = ['base', 'rollcall', 'cover'];
export const ROLLCALL_ALPHA = 0.10;
export const ROLLCALL_BETA = 0.20;
export const ROLLCALL_GAMMA = 0.15;
export const COVER_F = 6;
export const COVER_REVIEW_MIN = 0.05;
export const COVER_REVIEW_MAX = 0.55;

export const DEFAULT_SETTINGS: Settings = {
  mode: 'must',
  h: 40,
  dealMode: 'fixed',
  tau: 70,
  mood: 50,
  duration: 120,
  theoryDisplay: 'off',
  skipPass: false,
};

const EPS = 1e-9;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(n)));
}

export function reputationTier(value: number): ReputationTier {
  if (value < 35) return 'low';
  if (value <= 65) return 'mid';
  return 'high';
}

export function reviewProbability(value: number): number {
  return clamp(COVER_REVIEW_MAX - 0.005 * value, COVER_REVIEW_MIN, COVER_REVIEW_MAX);
}

export function reputationGain(value: number): number {
  return clamp(12 - 0.10 * value, 2, 12);
}

export function reputationLoss(value: number): number {
  return clamp(2 + 0.18 * value, 2, 20);
}

export function reputationDecline(value: number): number {
  return clamp(1.5 + 0.012 * value, 1.5, 2.7);
}

export function roundReputation(value: number): number {
  return clamp(Math.round(value), 0, 100);
}

export function sanitizeSettings(input: unknown = {}, base: Settings = DEFAULT_SETTINGS): Settings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<Settings>;
  const next: Settings = { ...base };
  if (MODES.includes(raw.mode as Mode)) next.mode = raw.mode as Mode;
  if (raw.h !== undefined) next.h = Math.round(clamp(raw.h, 0, 100));
  if (DEAL_MODES.includes(raw.dealMode as DealMode)) next.dealMode = raw.dealMode as DealMode;
  if (raw.tau !== undefined) next.tau = Math.round(clamp(raw.tau, 0, 100));
  if (raw.mood !== undefined && MOODS.includes(Number(raw.mood))) next.mood = Number(raw.mood);
  if (raw.duration !== undefined) next.duration = Math.round(clamp(raw.duration, 15, 300));
  if (['off', 'status', 'full'].includes(raw.theoryDisplay as string)) next.theoryDisplay = raw.theoryDisplay as Settings['theoryDisplay'];
  if (raw.skipPass !== undefined) next.skipPass = Boolean(raw.skipPass);
  return next;
}

export function sanitizeName(raw: unknown): string {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
  return name || '';
}

export function pickReason(type: RoleType, avoid: string | null): string {
  const pool = type === 'H' ? difficult : disciplined;
  const choices = pool.length > 1 && avoid ? pool.filter((r) => r !== avoid) : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function roleInfo(type: RoleType): Role {
  return type === 'H'
    ? {
        type,
        label: '起床困难户',
        short: '困难户',
        cost: COSTS.H,
        attend: { called: 10 - COSTS.H, safe: 6 - COSTS.H },
        skip: { called: -5, safe: 5 },
        character: '困',
      }
    : {
        type,
        label: '早起自律人',
        short: '自律人',
        cost: COSTS.L,
        attend: { called: 10 - COSTS.L, safe: 6 - COSTS.L },
        skip: { called: -5, safe: 5 },
        character: '醒',
      };
}

export function pointOf(settings: Settings, attendanceRate: number): Point {
  const qHigh = 1 - settings.mood / 100;
  if (settings.mode === 'must') return { q: 1, qHigh: null, calledBy: 'fixed' };
  if (settings.mode === 'never') return { q: 0, qHigh: null, calledBy: 'fixed' };
  if (settings.mode === 'threshold') {
    return {
      q: attendanceRate < settings.tau / 100 ? qHigh : 0,
      qHigh,
      calledBy: 'threshold',
    };
  }
  return { q: 1 - attendanceRate, qHigh: null, calledBy: 'prob' };
}

export function pointForRoom(room: Room, attendanceRate: number): Point {
  const base = pointOf(room.settings, attendanceRate);
  if (room.gameMode !== 'rollcall' || room.lecture !== 2) {
    return { ...base, qBase: base.q, firstCalled: null };
  }
  const first = room.lectureResults[0];
  const firstCalled = Boolean(first?.called);
  const d1 = firstCalled ? 1 : 0;
  const a1 = first?.attendanceRate ?? 0;
  const q = clamp(
    base.q + ROLLCALL_ALPHA * (1 - d1) - ROLLCALL_BETA * d1 + ROLLCALL_GAMMA * (1 - a1),
    0,
    1,
  );
  return { ...base, q, qBase: base.q, firstCalled };
}

export interface PointFacts {
  point: Point;
  called: boolean;
  roll: number | null;
}

export function rollPoint(point: Point): PointFacts {
  const roll = point.q > 0 && point.q < 1 ? Math.random() : null;
  const called = point.q >= 1 ? true : point.q <= 0 ? false : roll !== null && roll < point.q;
  return { point, called, roll };
}

function profileKey(l: Action, h: Action): string {
  return `${l}/${h}`;
}

function pureTheory(settings: Settings): PureProfile[] {
  const hFrac = settings.h / 100;
  const profiles: PureProfile[] = [];
  for (const L of ['attend', 'skip'] as Action[]) {
    for (const H of ['attend', 'skip'] as Action[]) {
      const attendL = L === 'attend' ? 1 : 0;
      const attendH = H === 'attend' ? 1 : 0;
      const attendance = (1 - hFrac) * attendL + hFrac * attendH;
      const { q } = pointOf(settings, attendance);
      const lOk = L === 'attend' ? q >= THRESHOLDS.L - EPS : q <= THRESHOLDS.L + EPS;
      const hOk = H === 'attend' ? q >= THRESHOLDS.H - EPS : q <= THRESHOLDS.H + EPS;
      if (lOk && hOk) profiles.push({ L, H, q, attendance, key: profileKey(L, H) });
    }
  }
  const unique: PureProfile[] = [];
  const seen = new Set<string>();
  for (const p of profiles) {
    if (!seen.has(p.key)) {
      seen.add(p.key);
      unique.push(p);
    }
  }
  return unique;
}

function mixedProb(settings: Settings): Mixing | null {
  const hFrac = settings.h / 100;
  const l = THRESHOLDS.L;
  const u = THRESHOLDS.H;
  if (hFrac >= l - EPS && hFrac <= u + EPS) return null;
  if (hFrac < l) {
    const skip = (l - hFrac) / (1 - hFrac);
    return {
      L: { skip, attend: 1 - skip },
      H: { skip: 1, attend: 0 },
      q: l,
    };
  }
  return {
    L: { skip: 0, attend: 1 },
    H: { skip: u / hFrac, attend: 1 - u / hFrac },
    q: u,
  };
}

const theoryCache = new WeakMap<Room, { key: string; value: Theory }>();

export function theoryPlayerCount(room: Room): number {
  if (['action', 'reveal', 'cover', 'review'].includes(room.status)) {
    return participantPlayers(room).length;
  }
  return [...room.players.values()].filter((p) => p.connected).length;
}

export function cachedTheoryFor(room: Room): Theory {
  const count = theoryPlayerCount(room);
  const s = room.settings;
  const key = `${s.mode}|${s.h}|${s.dealMode ?? 'fixed'}|${s.tau}|${s.mood}|${s.skipPass ? 1 : 0}|${count}`;
  const hit = theoryCache.get(room);
  if (hit && hit.key === key) return hit.value;
  const value = theoryFor(s, count);
  theoryCache.set(room, { key, value });
  return value;
}

export function theoryFor(settings: Settings, participantCount?: number): Theory {
  const hFrac = settings.h / 100;
  const l = THRESHOLDS.L;
  const u = THRESHOLDS.H;
  const qHigh = settings.mode === 'threshold' ? 1 - settings.mood / 100 : null;

  if (participantCount !== undefined && participantCount >= 2) {
    const dealMode = settings.dealMode ?? 'fixed';
    const sol = solveBNE({
      n: participantCount,
      h: settings.h,
      mode: settings.mode,
      tau: settings.tau,
      mood: settings.mood,
      dealMode,
    });
    const pure: PureProfile[] = [];
    let mixing: Mixing | null = null;
    let label = '';
    let detail = '';
    const deckText = dealMode === 'fixed' ? `固定牌库（${sol.nH} 困 / ${sol.nL} 醒）` : `独立抽取（${settings.h}% 困难户）`;

    if (sol.state === 'ALL_ATTEND') {
      pure.push({ L: 'attend', H: 'attend', q: sol.expectedQ, attendance: 1, key: profileKey('attend', 'attend') });
      label = '全员老实上课';
      detail = `${sol.n} 人${deckText}下，点名威慑力足够强，自律人与困难户都以去上课为最佳反应。`;
    } else if (sol.state === 'ALL_SKIP') {
      pure.push({ L: 'skip', H: 'skip', q: sol.expectedQ, attendance: 0, key: profileKey('skip', 'skip') });
      label = '全班集体躺平';
      detail = `${sol.n} 人${deckText}下，点名风险过低，连早起自律人也宁愿翘课拿 +5 分。`;
    } else if (sol.state === 'L_ATTEND_H_SKIP') {
      const att = dealMode === 'fixed' ? sol.nL / sol.n : 1 - hFrac;
      pure.push({ L: 'attend', H: 'skip', q: sol.expectedQ, attendance: att, key: profileKey('attend', 'skip') });
      label = '自律人上课，困难户躺平';
      detail = `${sol.n} 人${deckText}下，点名压力刚好把自律人留在教室，但不足以叫醒困难户（纯策略分离均衡）。`;
    } else if (sol.state === 'MIXED_L') {
      mixing = {
        L: { attend: sol.pL, skip: 1 - sol.pL },
        H: { attend: 0, skip: 1 },
        q: sol.expectedQ,
      };
      label = '自律人开始纠结（混合策略）';
      detail = `${sol.n} 人${deckText}下，困难户全翘仍压不住出勤，自律人以约 ${(sol.pL * 100).toFixed(1)}% 概率上课（翘课 ${((1 - sol.pL) * 100).toFixed(1)}%），使期望点名率落在 ${(sol.expectedQ * 100).toFixed(1)}%。`;
    } else {
      mixing = {
        L: { attend: 1, skip: 0 },
        H: { attend: sol.pH, skip: 1 - sol.pH },
        q: sol.expectedQ,
      };
      label = '困难户开始纠结（混合策略）';
      detail = `${sol.n} 人${deckText}下，自律人稳去上课，困难户以约 ${(sol.pH * 100).toFixed(1)}% 概率上课（翘课 ${((1 - sol.pH) * 100).toFixed(1)}%），期望点名率约 ${(sol.expectedQ * 100).toFixed(1)}%。`;
    }

    const profileText = pure.map((p) => `${p.L === 'attend' ? '自律人去' : '自律人翘'} / ${p.H === 'attend' ? '困难户去' : '困难户翘'}`);
    return {
      state: sol.state,
      label,
      detail,
      pure,
      profileText,
      mixing,
      qHigh,
      thresholds: { L: l, H: u },
      h: hFrac,
      sampleSize: sol.n,
      dealMode: sol.dealMode,
      nH: sol.nH,
      nL: sol.nL,
    };
  }

  const pure = pureTheory(settings);

  let state: Theory['state'] = 'NO_PURE';
  let label = '谁都坐不住（无纯策略均衡）';
  let detail = '';
  let mixing: Mixing | null = null;

  if (pure.length === 1) {
    const p = pure[0];
    if (p.L === 'attend' && p.H === 'attend') {
      state = 'ALL_ATTEND';
      label = '全员老实上课';
      detail = '点名威慑力拉满（超过 35.7%），哪怕是重度起床困难户，算完账也得含泪爬起来去教室。';
    } else if (p.L === 'skip' && p.H === 'skip') {
      state = 'ALL_SKIP';
      label = '全班集体躺平';
      detail = '点名风险太低（不到 14.3%），连早起自律人都觉得早起血亏，全班心照不宣一起睡回笼觉。';
    } else if (p.L === 'attend' && p.H === 'skip') {
      state = 'L_ATTEND_H_SKIP';
      label = '自律人上课，困难户躺平';
      detail = '点名率刚好卡在 14.3%～35.7% 之间：够把自律人吓进教室，但还叫不醒装睡的困难户。';
    } else {
      state = 'L_SKIP_H_ATTEND';
      label = '自律人翘课，困难户上课';
      detail = '极其罕见的反转局面，通常只在特殊参数边界上才会出现。';
    }
  } else if (pure.length > 1) {
    state = 'MULTIPLE';
    label = '不止一种稳定局面';
    detail = '当前参数刚好踩在临界点上，大伙儿往哪边扎堆都有可能形成均衡。';
  } else if (settings.mode === 'prob') {
    mixing = mixedProb(settings);
    if (mixing) {
      state = mixing.L.skip > 0 && mixing.L.skip < 1 ? 'MIXED_L' : 'MIXED_H';
      label = state === 'MIXED_L' ? '自律人开始纠结（混合策略）' : '困难户开始纠结（混合策略）';
      detail =
        state === 'MIXED_L'
          ? `班里困难户太少，全翘了也凑不够点名威慑。于是困难户全员躺平，自律人也有约 ${(mixing.L.skip * 100).toFixed(1)}% 的概率跟着翘课，刚好把点名率卡在 ${(mixing.q * 100).toFixed(1)}% 的临界线。`
          : `要是困难户全翘，点名率就爆表了；可要是全去，点名率一降大家又想翘。最终自律人全员上课，困难户以约 ${(mixing.H.skip * 100).toFixed(1)}% 的概率翘课，把点名率死死卡在 ${(mixing.q * 100).toFixed(1)}%。`;
    } else {
      label = '正好卡在临界线';
      detail = '困难户比例刚好踩在阈值边界上，课堂演示建议换一档比例。';
    }
  } else if (settings.mode === 'threshold') {
    detail = '经典拉锯战：大伙儿都去上课，出勤达标不点名，就有人后悔白起；可一旦大家都想翘，出勤跌破警戒线，老师重拳点名又会抓个正着。怎么选都有人想反悔！';
  }

  const profileText = pure.map((p) => `${p.L === 'attend' ? '自律人去' : '自律人翘'} / ${p.H === 'attend' ? '困难户去' : '困难户翘'}`);

  return {
    state,
    label,
    detail,
    pure,
    profileText,
    mixing,
    qHigh,
    thresholds: { L: l, H: u },
    h: hFrac,
  };
}

export function assignRole(type: RoleType, player: Player): Role {
  const reason = pickReason(type, player.lastReason);
  player.lastReason = reason;
  return { ...roleInfo(type), reason };
}

export function drawRole(settings: Settings, player: Player): Role {
  const type: RoleType = Math.random() * 100 < settings.h ? 'H' : 'L';
  return assignRole(type, player);
}

function buildFixedDeck(count: number, hPct: number): RoleType[] {
  const nH = Math.round((count * clamp(hPct, 0, 100)) / 100);
  const deck: RoleType[] = [];
  for (let i = 0; i < count; i += 1) {
    deck.push(i < nH ? 'H' : 'L');
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function createPlayer(id: string, name: string, activeFrom: number, bot = false): Player {
  return {
    id,
    name,
    token: null,
    bot,
    score: 0,
    socketIds: new Set<string>(),
    activeFrom,
    round: null,
    role: null,
    action: null,
    submittedAt: null,
    lastResult: null,
    lastReason: null,
    passDraw: null,
    connected: false,
    joinedAt: Date.now(),
    reputation: 50,
    teamId: null,
    coverRole: null,
    coverChoice: null,
    coverOutcome: null,
    coverSuccessCount: 0,
    lectureResults: [],
    coverPersonal: null,
  };
}

export function rankPlayers(room: Room): { sorted: Player[]; ranks: Map<string, number> } {
  const sorted = [...room.players.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'));
  const ranks = new Map<string, number>();
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i - 1].score > sorted[i].score + EPS) {
      currentRank = i + 1;
    }
    ranks.set(sorted[i].id, currentRank);
  }
  return { sorted, ranks };
}

export function startRound(room: Room): string[] {
  if (room.nextGameMode) {
    room.gameMode = room.nextGameMode;
    room.nextGameMode = null;
  }
  room.round += 1;
  room.status = 'action';
  room.lecture = 1;
  room.lectureResults = [];
  room.teams.clear();
  room.cover = null;
  room.coverEndsAt = null;
  room.startedAt = Date.now();
  room.endsAt = room.startedAt + room.settings.duration * 1000;
  room.result = null;
  room.autoLocked = false;
  const eligible: Player[] = [];
  for (const p of room.players.values()) {
    p.round = null;
    p.role = null;
    p.action = null;
    p.submittedAt = null;
    p.lastResult = null;
    p.passDraw = null;
    p.teamId = null;
    p.coverRole = null;
    p.coverChoice = null;
    p.coverOutcome = null;
    p.lectureResults = [];
    p.coverPersonal = null;
    if (p.activeFrom <= room.round && p.connected) {
      eligible.push(p);
    }
  }
  const fixedDeck = room.settings.dealMode === 'fixed' ? buildFixedDeck(eligible.length, room.settings.h) : null;
  const participants: string[] = [];
  eligible.forEach((p, idx) => {
    p.round = room.round;
    p.role = fixedDeck ? assignRole(fixedDeck[idx], p) : drawRole(room.settings, p);
    participants.push(p.id);
  });
  room.participants = participants;
  if (room.gameMode === 'cover') makeTeams(room);
  return participants;
}

export function makeTeams(room: Room): void {
  room.teams.clear();
  const players = participantPlayers(room).filter((p) => p.connected);
  for (let i = players.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  for (let i = 0; i < players.length; i += 2) {
    const pair = players.slice(i, i + 2);
    if (pair.length < 2) {
      pair[0].teamId = null;
      continue;
    }
    const team: Team = {
      id: `team-${room.round}-${i / 2 + 1}`,
      memberIds: pair.map((p) => p.id),
    };
    room.teams.set(team.id, team);
    for (const p of pair) p.teamId = team.id;
  }
}

export function startLecture2(room: Room): boolean {
  if (room.gameMode !== 'rollcall' || room.status !== 'reveal' || room.lecture !== 1) return false;
  room.lecture = 2;
  room.status = 'action';
  room.startedAt = Date.now();
  room.endsAt = room.startedAt + room.settings.duration * 1000;
  room.result = null;
  room.autoLocked = false;
  for (const p of participantPlayers(room)) {
    p.action = null;
    p.submittedAt = null;
    p.lastResult = null;
    p.passDraw = null;
  }
  return true;
}

export function participantPlayers(room: Room): Player[] {
  return [...room.players.values()].filter((p) => p.round === room.round);
}

export function publicTeams(room: Room): TeamPublic[] {
  return [...room.teams.values()].map((team) => ({
    id: team.id,
    members: team.memberIds
      .map((id) => room.players.get(id))
      .filter((p): p is Player => Boolean(p))
      .map((p) => ({
        id: p.id,
        name: p.name,
        tier: reputationTier(p.reputation),
        connected: p.connected,
        bot: p.bot,
      })),
  }));
}

export function coverEligiblePlayers(room: Room): Array<{ teamId: string; helper: Player; absentee: Player }> {
  const entries: Array<{ teamId: string; helper: Player; absentee: Player }> = [];
  for (const team of room.teams.values()) {
    if (team.memberIds.length !== 2) continue;
    const [a, b] = team.memberIds.map((id) => room.players.get(id));
    if (!a || !b) continue;
    const aAction: Action = a.action === 'attend' ? 'attend' : 'skip';
    const bAction: Action = b.action === 'attend' ? 'attend' : 'skip';
    if (aAction === bAction) continue;
    const helper = aAction === 'attend' ? a : b;
    const absentee = aAction === 'skip' ? a : b;
    if (!helper.connected || !absentee.connected) continue;
    entries.push({ teamId: team.id, helper, absentee });
  }
  return entries;
}

export function createCoverState(room: Room, point: Point, called: boolean, roll: number | null): CoverState {
  const now = Date.now();
  return {
    point,
    called,
    roll,
    eligible: coverEligiblePlayers(room).map(({ teamId, helper, absentee }) => ({
      teamId,
      helperId: helper.id,
      absenteeId: absentee.id,
    })),
    choices: {},
    revealed: false,
    reviews: [],
    startedAt: now,
    endsAt: now + room.settings.duration * 1000,
  };
}

function playerTier(room: Room, id: string): ReputationTier {
  return reputationTier(room.players.get(id)?.reputation ?? 50);
}

export function coverSummary(room: Room): CoverSummary | null {
  const cover = room.cover;
  if (!cover) return null;
  const entries = cover.eligible.map((entry) => {
    const helper = room.players.get(entry.helperId);
    const absentee = room.players.get(entry.absenteeId);
    return {
      teamId: entry.teamId,
      helperId: entry.helperId,
      helperName: helper?.name ?? '神秘同学',
      helperTier: playerTier(room, entry.helperId),
      absenteeId: entry.absenteeId,
      absenteeName: absentee?.name ?? '神秘同学',
      absenteeTier: playerTier(room, entry.absenteeId),
      decided: Boolean(cover.choices[entry.helperId]),
      choice: cover.revealed ? cover.choices[entry.helperId] : undefined,
    };
  });
  return {
    q: cover.point.q,
    qBase: cover.point.qBase ?? cover.point.q,
    called: cover.called,
    calledBy: cover.point.calledBy,
    roll: cover.roll,
    eligibleCount: entries.length,
    decidedCount: entries.filter((entry) => entry.decided).length,
    revealed: cover.revealed,
    entries,
    reviews: cover.revealed ? cover.reviews : [],
    endsAt: cover.revealed ? null : cover.endsAt,
  };
}

function personalCover(room: Room, player: Player): CoverPersonal | null {
  if (player.coverPersonal) return player.coverPersonal;
  const cover = room.cover;
  if (!cover) return null;
  const entry = cover.eligible.find((item) => item.helperId === player.id || item.absenteeId === player.id);
  if (!entry) return null;
  const isHelper = entry.helperId === player.id;
  const partnerId = isHelper ? entry.absenteeId : entry.helperId;
  const partner = room.players.get(partnerId);
  if (!partner) return null;
  return {
    teamId: entry.teamId,
    role: isHelper ? 'helper' : 'absentee',
    partnerId,
    partnerName: partner.name,
    partnerTier: reputationTier(partner.reputation),
    submitted: isHelper ? Boolean(cover.choices[player.id]) : Boolean(cover.choices[partnerId]),
    revealed: cover.revealed,
    choice: isHelper ? cover.choices[player.id] : undefined,
    partnerChoice: cover.revealed ? cover.choices[partnerId] : undefined,
    outcome: player.coverOutcome ?? undefined,
    reputationAfter: player.reputation,
    coverSuccessCount: player.coverSuccessCount,
  };
}

export function resolveCover(room: Room): void {
  const cover = room.cover;
  if (!cover || cover.revealed) return;
  for (const entry of cover.eligible) {
    const helper = room.players.get(entry.helperId);
    const absentee = room.players.get(entry.absenteeId);
    if (!helper || !absentee) continue;
    const choice = cover.choices[helper.id] ?? 'decline';
    const helperBefore = helper.reputation;
    const absenteeBefore = absentee.reputation;
    let helperOutcome: CoverOutcome;
    let absenteeOutcome: CoverOutcome;
    let caught = false;
    if (choice === 'help') {
      caught = Math.random() < reviewProbability(absentee.reputation);
      helperOutcome = caught ? 'caught' : 'success';
      absenteeOutcome = caught ? 'caught' : 'success';
      if (caught) {
        helper.reputation = roundReputation(helper.reputation - reputationLoss(helper.reputation));
        absentee.reputation = roundReputation(absentee.reputation - 3);
      } else {
        helper.reputation = roundReputation(helper.reputation + reputationGain(helper.reputation));
        helper.coverSuccessCount += 1;
      }
    } else {
      helperOutcome = 'declined';
      absenteeOutcome = 'no_help';
      helper.reputation = roundReputation(helper.reputation - reputationDecline(helper.reputation));
    }
    const helperDelta = helper.reputation - helperBefore;
    const absenteeDelta = absentee.reputation - absenteeBefore;
    const helperTier = reputationTier(helper.reputation);
    const absenteeTier = reputationTier(absentee.reputation);
    helper.coverRole = 'helper';
    helper.coverChoice = choice;
    helper.coverOutcome = helperOutcome;
    helper.coverPersonal = {
      teamId: entry.teamId,
      role: 'helper',
      partnerId: absentee.id,
      partnerName: absentee.name,
      partnerTier: absenteeTier,
      submitted: true,
      revealed: true,
      choice,
      outcome: helperOutcome,
      reputationDelta: helperDelta,
      partnerReputationDelta: absenteeDelta,
      reputationAfter: helper.reputation,
      coverSuccessCount: helper.coverSuccessCount,
    };
    absentee.coverRole = 'absentee';
    absentee.coverChoice = null;
    absentee.coverOutcome = absenteeOutcome;
    absentee.coverPersonal = {
      teamId: entry.teamId,
      role: 'absentee',
      partnerId: helper.id,
      partnerName: helper.name,
      partnerTier: helperTier,
      submitted: true,
      revealed: true,
      partnerChoice: choice,
      outcome: absenteeOutcome,
      reputationDelta: absenteeDelta,
      partnerReputationDelta: helperDelta,
      reputationAfter: absentee.reputation,
      coverSuccessCount: absentee.coverSuccessCount,
    };
    cover.reviews.push({
      teamId: entry.teamId,
      helperId: helper.id,
      helperName: helper.name,
      absenteeId: absentee.id,
      absenteeName: absentee.name,
      choice,
      caught,
      helperDelta,
      absenteeDelta,
      helperAfter: helper.reputation,
      absenteeAfter: absentee.reputation,
    });
  }
  cover.revealed = true;
  cover.endsAt = Date.now();
}

export function reputationBoard(room: Room): ReputationEntry[] {
  const sorted = [...room.players.values()].sort(
    (a, b) => b.reputation - a.reputation || b.coverSuccessCount - a.coverSuccessCount || a.name.localeCompare(b.name, 'zh-CN'),
  );
  let currentRank = 1;
  return sorted.map((p, i) => {
    if (i > 0 && sorted[i - 1].reputation > p.reputation) {
      currentRank = i + 1;
    }
    return {
      id: p.id,
      name: p.name,
      reputation: p.reputation,
      tier: reputationTier(p.reputation),
      rank: currentRank,
      coverSuccessCount: p.coverSuccessCount,
      bot: p.bot,
      connected: p.connected,
    };
  });
}

function inRoundStatus(status: RoomStatus): boolean {
  return status === 'action' || status === 'reveal' || status === 'cover' || status === 'review';
}

function teamForPlayer(room: Room, player: Player, teamsById?: Map<string, TeamPublic>): TeamPublic | null {
  if (!player.teamId) return null;
  if (teamsById) return teamsById.get(player.teamId) ?? null;
  return publicTeams(room).find((team) => team.id === player.teamId) ?? null;
}

export function settleRound(
  room: Room,
  autoLocked = false,
  statusAfter: RoomStatus = 'reveal',
  precomputed?: PointFacts,
): Result {
  const participants = participantPlayers(room);
  const total = participants.length;
  const attendance = participants.filter((p) => p.action === 'attend').length;
  const skip = total - attendance;
  const attendanceRate = total ? attendance / total : 0;
  const skipRate = total ? skip / total : 0;
  const point = precomputed?.point ?? (room.gameMode === 'cover' && room.cover ? room.cover.point : pointForRoom(room, attendanceRate));
  const roll =
    precomputed?.roll ??
    (room.gameMode === 'cover' && room.cover
      ? room.cover.roll
      : point.q > 0 && point.q < 1
        ? Math.random()
        : null);
  const called =
    precomputed?.called ??
    (room.gameMode === 'cover' && room.cover
      ? room.cover.called
      : point.q >= 1 ? true : point.q <= 0 ? false : roll !== null && roll < point.q);
  const typeCounts: Record<RoleType, number> = { H: 0, L: 0 };
  const actionCounts: Record<RoleType, Record<Action, number>> = {
    H: { attend: 0, skip: 0 },
    L: { attend: 0, skip: 0 },
  };
  let payoffSum = 0;

  for (const p of participants) {
    const action: Action = p.action === 'attend' ? 'attend' : 'skip';
    const role = p.role;
    if (!role) continue;
    p.action = action;
    const cost = COSTS[role.type];
    let payoff = action === 'attend' ? (called ? 10 - cost : 6 - cost) : called ? -5 : 5;
    if (room.gameMode === 'cover' && p.coverPersonal) {
      if (p.coverPersonal.role === 'absentee' && p.coverPersonal.outcome === 'success') {
        payoff = 0;
      }
      if (p.coverPersonal.role === 'helper' && p.coverPersonal.outcome === 'caught') {
        payoff -= COVER_F;
      }
    }
    p.score += payoff;
    const lastResult: LastResult = {
      round: room.round,
      lecture: room.lecture,
      action,
      called,
      payoff,
      q: point.q,
      attendanceRate,
      skipRate,
      mode: room.settings.mode,
      cover: p.coverPersonal ?? undefined,
    };
    p.lastResult = lastResult;
    p.lectureResults.push(lastResult);
    typeCounts[role.type] += 1;
    actionCounts[role.type][action] += 1;
    payoffSum += payoff;
  }

  const { sorted, ranks } = rankPlayers(room);
  for (const p of participants) {
    if (p.lastResult) {
      p.lastResult.rankAfter = ranks.get(p.id) ?? 0;
      p.lastResult.scoreAfter = p.score;
    }
  }

  const result: Result = {
    round: room.round,
    gameMode: room.gameMode,
    lecture: room.lecture,
    mode: room.settings.mode,
    settings: { ...room.settings },
    participantCount: total,
    attendance,
    skip,
    attendanceRate,
    skipRate,
    q: point.q,
    qHigh: point.qHigh,
    calledBy: point.calledBy,
    called,
    roll,
    autoLocked,
    qBase: point.qBase ?? point.q,
    firstCalled: point.firstCalled ?? null,
    cover: coverSummary(room),
    typeCounts,
    actionCounts,
    avgPayoff: total ? payoffSum / total : 0,
    theory: theoryFor(room.settings, total),
    lockedAt: Date.now(),
    startedAt: room.startedAt,
    endedAt: room.endsAt,
    top: sorted.slice(0, 3).map((p) => ({ name: p.name, score: p.score })),
  };

  room.status = statusAfter;
  room.endsAt = null;
  room.coverEndsAt = null;
  room.result = result;
  if (room.gameMode === 'rollcall') room.lectureResults.push(result);
  const skipHistory = room.gameMode === 'rollcall' && room.lecture === 1;
  if (!skipHistory) room.history.push({
    round: result.round,
    gameMode: result.gameMode,
    lecture: room.gameMode === 'rollcall' ? result.lecture : undefined,
    mode: result.mode,
    dealMode: result.settings.dealMode,
    participantCount: result.participantCount,
    attendanceRate: result.attendanceRate,
    skipRate: result.skipRate,
    q: result.q,
    called: result.called,
    avgPayoff: result.avgPayoff,
    h: result.settings.h,
    tau: result.settings.tau,
    mood: result.settings.mood,
    typeCounts: { ...result.typeCounts },
    actionCounts: {
      H: { ...result.actionCounts.H },
      L: { ...result.actionCounts.L },
    },
  });
  return result;
}

export interface RoomSnapshot {
  ranked: { sorted: Player[]; ranks: Map<string, number> };
  teams: TeamPublic[];
  teamsById: Map<string, TeamPublic>;
  theory: Theory;
  pub: PublicRoom;
}

export function createRoomSnapshot(room: Room): RoomSnapshot {
  const ranked = rankPlayers(room);
  const teams = room.gameMode === 'cover' ? publicTeams(room) : [];
  const teamsById = new Map<string, TeamPublic>(teams.map((team) => [team.id, team]));
  const theory = cachedTheoryFor(room);
  const pub = publicRoom(room, { ranked, teams });
  return { ranked, teams, teamsById, theory, pub };
}

export function publicRoom(
  room: Room,
  cache?: { ranked?: { sorted: Player[]; ranks: Map<string, number> }; teams?: TeamPublic[] },
): PublicRoom {
  const { sorted, ranks } = cache?.ranked ?? rankPlayers(room);
  const participants = participantPlayers(room);
  const inRound = ['action', 'reveal', 'cover', 'review'].includes(room.status);
  const waiting = inRound ? [...room.players.values()].filter((p) => p.round !== room.round) : [];
  const showScores = room.status !== 'reveal' && room.status !== 'review';
  const cover = coverSummary(room);
  const teams = cache?.teams ?? (room.gameMode === 'cover' ? publicTeams(room) : []);
  return {
    code: room.code,
    gameMode: room.gameMode,
    nextGameMode: room.nextGameMode,
    status: room.status,
    round: room.round,
    lecture: room.lecture,
    settings: { ...room.settings },
    createdAt: room.createdAt,
    serverNow: Date.now(),
    startedAt: room.startedAt,
    endsAt: room.endsAt,
    playerCount: room.players.size,
    onlineCount: [...room.players.values()].filter((p) => p.connected).length,
    participantCount: participants.length,
    waitingCount: inRound ? waiting.length : 0,
    submittedCount: participants.filter((p) => p.action).length,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      bot: p.bot,
      connected: p.connected,
      waiting: inRound && p.round !== room.round,
      submitted: room.status === 'action' && Boolean(p.round === room.round && p.action),
      rank: ranks.get(p.id) ?? 0,
      reputationTier: room.gameMode === 'cover' ? reputationTier(p.reputation) : undefined,
      teamId: room.gameMode === 'cover' ? p.teamId : undefined,
    })),
    teams,
    cover,
    lectureResults: room.lectureResults,
    reputationBoard:
      room.gameMode === 'cover' && (room.status === 'settlement' || room.status === 'final')
        ? reputationBoard(room)
        : null,
    leaderboard: showScores
      ? sorted.map((p) => ({ id: p.id, name: p.name, score: p.score, rank: ranks.get(p.id) ?? 0, bot: p.bot, connected: p.connected }))
      : null,
    result: ['reveal', 'review', 'settlement'].includes(room.status) ? room.result : null,
    history: room.history,
    final: room.status === 'final',
  };
}

export function privatePlayer(
  room: Room,
  player: Player,
  cache?: Partial<Pick<RoomSnapshot, 'ranked' | 'teamsById' | 'theory'>>,
): PrivatePlayer {
  const { ranks } = cache?.ranked ?? rankPlayers(room);
  const active = player.round === room.round && room.round > 0 && room.status !== 'lobby' && room.status !== 'final';
  let pass: { allowed: boolean; p: number } | null = null;
  const passMode = room.settings.mode === 'prob' || room.settings.mode === 'threshold';
  if (room.gameMode === 'base' && room.status === 'action' && passMode && room.settings.skipPass && active && player.role) {
    const theory = cache?.theory ?? theoryFor(room.settings, theoryPlayerCount(room));
    const mix = theory.mixing;
    if (mix) {
      const p = mix[player.role.type].skip;
      if (p > EPS && p < 1 - EPS) pass = { allowed: true, p };
    }
  }
  return {
    id: player.id,
    name: player.name,
    score: player.score,
    rank: ranks.get(player.id) ?? 0,
    connected: player.connected,
    active,
    waiting: inRoundStatus(room.status) && player.round !== room.round,
    role: active ? player.role : null,
    action: active ? player.action : null,
    submitted: active ? Boolean(player.action) : false,
    reputation: player.reputation,
    reputationTier: reputationTier(player.reputation),
    team: room.gameMode === 'cover' ? teamForPlayer(room, player, cache?.teamsById) : null,
    lectureResults: player.lectureResults,
    cover: room.gameMode === 'cover' ? personalCover(room, player) : null,
    lastResult: active && room.status !== 'action' ? player.lastResult : null,
    pass,
    passDraw: active && room.status === 'action' ? player.passDraw : null,
  };
}

export function hostRoom(room: Room, cache?: RoomSnapshot): HostRoom {
  const snapshot = cache ?? createRoomSnapshot(room);
  const { sorted, ranks } = snapshot.ranked;
  return {
    ...snapshot.pub,
    pin: room.pin,
    theory: snapshot.theory,
    leaderboardAll: sorted.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      rank: ranks.get(p.id) ?? 0,
      bot: p.bot,
      connected: p.connected,
    })),
  };
}
