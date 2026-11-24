import { binomCdf, binomPmf, nCr, solveBNE } from '../../server/bne.js';
import { read, write } from './storage.js';
import type { HistoryEntry } from './types.js';

export { binomCdf, binomPmf, nCr, solveBNE };

export interface SlideMeta {
  index: number;
  num: string;
  short: string;
  title: string;
  subtitle: string;
  tag: string;
  steps: number;
}

export const SLIDES: SlideMeta[] = [
  {
    index: 0,
    num: '01',
    short: '定义拆解',
    title: '什么是不完全信息静态博弈？',
    subtitle: '不知道谁爱赖床，还得同时交卷',
    tag: '概念入门',
    steps: 1,
  },
  {
    index: 1,
    num: '02',
    short: '海萨尼转换',
    title: '海萨尼转换：请出虚拟发牌员「自然」',
    subtitle: '把猜身份的无限套娃，画成一棵博弈树',
    tag: '1994 诺奖妙招',
    steps: 5,
  },
  {
    index: 2,
    num: '03',
    short: '贝叶斯均衡',
    title: '贝叶斯纳什均衡：谁拿什么牌，都不想反悔',
    subtitle: '策略不是单个动作，而是“看牌出招表”',
    tag: '均衡核心',
    steps: 1,
  },
  {
    index: 3,
    num: '04',
    short: '概率点名例',
    title: '例子一：点名概率 = 全班翘课率',
    subtitle: '30 人小班精确推导：为什么困难户只有 9.1% 会起床？',
    tag: '算账实战 1',
    steps: 4,
  },
  {
    index: 4,
    num: '05',
    short: '阈值点名例',
    title: '例子二：出勤低于 70% 才抽查',
    subtitle: '卡在 21 人悬崖边，自己就是那张关键一票',
    tag: '算账实战 2',
    steps: 4,
  },
];

export interface TeachingState {
  enabled: boolean;
  open: boolean;
  currentIndex: number;
  nextIndex: number;
  visited: number[];
}

function teachingKey(code: string): string {
  return `zaoba:teaching:${code || 'global'}`;
}

export function loadTeachingState(code: string): TeachingState {
  const fallback: TeachingState = {
    enabled: true,
    open: false,
    currentIndex: 0,
    nextIndex: 0,
    visited: [],
  };
  try {
    const raw = read(teachingKey(code));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<TeachingState>;
    const clampIdx = (n: unknown) => {
      const v = Number(n);
      if (!Number.isInteger(v)) return 0;
      return Math.max(0, Math.min(SLIDES.length - 1, v));
    };
    const visited = Array.isArray(parsed.visited)
      ? parsed.visited.filter((v): v is number => Number.isInteger(v) && v >= 0 && v < SLIDES.length)
      : [];
    return {
      enabled: parsed.enabled === undefined ? true : Boolean(parsed.enabled),
      open: false,
      currentIndex: clampIdx(parsed.currentIndex),
      nextIndex: clampIdx(parsed.nextIndex),
      visited: [...new Set(visited)],
    };
  } catch {
    return fallback;
  }
}

export function saveTeachingState(code: string, state: TeachingState): void {
  write(
    teachingKey(code),
    JSON.stringify({
      enabled: state.enabled,
      currentIndex: state.currentIndex,
      nextIndex: state.nextIndex,
      visited: state.visited,
    }),
  );
}

// ---------- Exact finite-class math for Slides 04 & 05 ----------

/**
 * Slide 04: 30 students (12 H, 18 L), q = skipCount / 30.
 * L all attend; each H attends with probability p_H.
 */
export const PROB_EX_EQ_P = 1 / 11; // ≈ 0.090909

export function probExamplePayoffs(p: number) {
  const clamped = Math.max(0, Math.min(1, p));
  const eqAttendH = (11 * (1 - clamped)) / 30;
  const eqSkipH = (12 - 11 * clamped) / 30;
  const uHAttend = 4 * eqAttendH;
  const uHSkip = 5 - 10 * eqSkipH;

  const expectedY = 12 * clamped;
  const eqAttendL = (12 - expectedY) / 30;
  const eqSkipL = (13 - expectedY) / 30;
  const uLAttend = 7 * eqAttendL + 3 * (1 - eqAttendL);
  const uLSkip = -5 * eqSkipL + 5 * (1 - eqSkipL);

  return {
    p: clamped,
    eqAttendH,
    eqSkipH,
    uHAttend,
    uHSkip,
    eqAttendL,
    eqSkipL,
    uLAttend,
    uLSkip,
  };
}

/**
 * Slide 05: 30 students (12 H, 18 L), tau = 70% (21 people), q_0 = 0.5.
 * L all attend; each H attends with probability p_H.
 */
export const THRESHOLD_EX_EQ_P = 0.14465;

export function thresholdExamplePayoffs(p: number) {
  const clamped = Math.max(0, Math.min(1, p));
  const pXLe1 = binomCdf(11, 1, clamped);
  const pXLe2 = binomCdf(11, 2, clamped);
  const pXEq2 = binomPmf(11, 2, clamped);

  const qAttendH = 0.5 * pXLe1;
  const qSkipH = 0.5 * pXLe2;
  const uHAttend = 4 * qAttendH; // = 2 * P(X <= 1)
  const uHSkip = 5 * (1 - pXLe2); // = -5 * 0.5 P(X<=2) + 5 * (1 - 0.5 P(X<=2))

  const pYLe2 = binomCdf(12, 2, clamped);
  const pYLe3 = binomCdf(12, 3, clamped);
  const qAttendL = 0.5 * pYLe2;
  const qSkipL = 0.5 * pYLe3;
  const uLAttend = 7 * qAttendL + 3 * (1 - qAttendL);
  const uLSkip = -5 * qSkipL + 5 * (1 - qSkipL);

  return {
    p: clamped,
    pXLe1,
    pXLe2,
    pXEq2,
    qAttendH,
    qSkipH,
    uHAttend,
    uHSkip,
    pYLe2,
    pYLe3,
    qAttendL,
    qSkipL,
    uLAttend,
    uLSkip,
  };
}

export interface RoundComparison {
  round: number;
  n: number;
  attendanceRate: number;
  q: number;
  hTotal: number;
  hAttend: number;
  hAttendRate: number | null;
  lTotal: number;
  lAttend: number;
  lAttendRate: number | null;
  theoryPH: number;
  theoryPL: number;
  dealMode: 'fixed' | 'independent';
}

export function compareRoundWithTheory(entry: HistoryEntry): RoundComparison {
  const dealMode = entry.dealMode ?? 'fixed';
  const n = Math.max(1, entry.participantCount);
  const sol = solveBNE({
    n,
    h: entry.h,
    mode: entry.mode,
    tau: entry.tau,
    mood: entry.mood,
    dealMode,
  });
  const hTotal = entry.typeCounts?.H ?? 0;
  const hAttend = entry.actionCounts?.H?.attend ?? 0;
  const lTotal = entry.typeCounts?.L ?? 0;
  const lAttend = entry.actionCounts?.L?.attend ?? 0;
  return {
    round: entry.round,
    n,
    attendanceRate: entry.attendanceRate,
    q: entry.q,
    hTotal,
    hAttend,
    hAttendRate: hTotal > 0 ? hAttend / hTotal : null,
    lTotal,
    lAttend,
    lAttendRate: lTotal > 0 ? lAttend / lTotal : null,
    theoryPH: sol.pH,
    theoryPL: sol.pL,
    dealMode,
  };
}
