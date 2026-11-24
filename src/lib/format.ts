import type { GameMode, Mode, ReputationTier, RoleType, Settings } from './types';

export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

export function modeLabel(mode: Mode): string {
  return {
    must: '必点',
    never: '必不点',
    threshold: '阈值点名',
    prob: '概率点名',
  }[mode];
}

export function gameModeLabel(mode: GameMode): string {
  return {
    base: '起床战争',
    rollcall: '点名风云',
    cover: '代勤者联盟',
  }[mode];
}

export function lectureLabel(gameMode: GameMode, lecture: number): string {
  if (gameMode === 'rollcall') return lecture === 2 ? '回笼觉' : '第 1 堂';
  return gameMode === 'cover' ? '代勤局' : '本局';
}

export function modeRule(mode: Mode, settings: Settings): string {
  if (mode === 'must') return '老师今天铁了心必点名——来上课稳拿分，敢翘课直接扣 5 分。';
  if (mode === 'never') return '老师今天明牌不点名——去教室纯属用爱发电，躺被窝稳拿 5 分。';
  if (mode === 'threshold') {
    return `出勤率只要守住 ${settings.tau}% 就全员安全；一旦跌破 ${settings.tau}%，老师有 ${100 - settings.mood}% 的概率翻脸点名。`;
  }
  return '点名概率 = 本局全班翘课率。翘课的同学越多，老师掏点名册的手就越痒。';
}

export function roleLabel(type: RoleType): string {
  return type === 'H' ? '起床困难户' : '早起自律人';
}

export function reputationTierLabel(tier: ReputationTier): string {
  return { low: '低', mid: '中', high: '高' }[tier];
}

export function reviewRange(tier: ReputationTier): { min: number; max: number } {
  return {
    low: { min: 38, max: 55 },
    mid: { min: 23, max: 38 },
    high: { min: 5, max: 23 },
  }[tier];
}

