export type BneMode = 'must' | 'never' | 'prob' | 'threshold';
export type BneDealMode = 'fixed' | 'independent';

export interface BneParams {
  n: number;
  h: number;
  mode: BneMode;
  tau: number;
  mood: number;
  dealMode: BneDealMode;
}

export type BneState =
  | 'ALL_ATTEND'
  | 'ALL_SKIP'
  | 'L_ATTEND_H_SKIP'
  | 'MIXED_L'
  | 'MIXED_H';

export interface BneSolution {
  state: BneState;
  n: number;
  nH: number;
  nL: number;
  dealMode: BneDealMode;
  pL: number;
  pH: number;
  qAttendL: number;
  qSkipL: number;
  qAttendH: number;
  qSkipH: number;
  uLAttend: number;
  uLSkip: number;
  uHAttend: number;
  uHSkip: number;
  expectedQ: number;
  isLVerified: boolean;
}

const EPS = 1e-9;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function nCr(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const m = Math.min(k, n - k);
  let res = 1;
  for (let i = 1; i <= m; i += 1) {
    res = (res * (n - m + i)) / i;
  }
  return res;
}

export function binomPmf(n: number, k: number, p: number): number {
  if (k < 0 || k > n) return 0;
  const prob = clamp01(p);
  if (prob === 0) return k === 0 ? 1 : 0;
  if (prob === 1) return k === n ? 1 : 0;
  if (n <= 30) {
    return nCr(n, k) * Math.pow(prob, k) * Math.pow(1 - prob, n - k);
  }
  return binomialPmfArray(n, prob)[k] ?? 0;
}

export function binomCdf(n: number, kMax: number, p: number): number {
  if (kMax < 0) return 0;
  if (kMax >= n) return 1;
  const pmf = binomialPmfArray(n, p);
  let sum = 0;
  const limit = Math.min(n, Math.floor(kMax));
  for (let k = 0; k <= limit; k += 1) {
    sum += pmf[k];
  }
  return sum;
}

export function binomialPmfArray(n: number, p: number): number[] {
  const count = Math.max(0, Math.floor(n));
  const pmf = new Array<number>(count + 1).fill(0);
  if (count === 0) {
    pmf[0] = 1;
    return pmf;
  }
  const prob = clamp01(p);
  if (prob <= 0) {
    pmf[0] = 1;
    return pmf;
  }
  if (prob >= 1) {
    pmf[count] = 1;
    return pmf;
  }

  const logP = Math.log(prob);
  const log1mP = Math.log(1 - prob);
  const logFact = new Array<number>(count + 1).fill(0);
  for (let i = 1; i <= count; i += 1) {
    logFact[i] = logFact[i - 1] + Math.log(i);
  }
  for (let k = 0; k <= count; k += 1) {
    const logComb = logFact[count] - logFact[k] - logFact[count - k];
    pmf[k] = Math.exp(logComb + k * logP + (count - k) * log1mP);
  }
  return pmf;
}

export function evalRollCallProb(
  k: number,
  n: number,
  mode: BneMode,
  tau: number,
  mood: number,
): number {
  if (mode === 'must') return 1;
  if (mode === 'never') return 0;
  if (n <= 0) return 0;
  if (mode === 'prob') return clamp01((n - k) / n);
  const qHigh = clamp01(1 - mood / 100);
  return k * 100 < n * tau - EPS ? qHigh : 0;
}

function expectedQBinom(
  baseK: number,
  trials: number,
  p: number,
  params: BneParams,
): number {
  const { n, mode, tau, mood } = params;
  if (mode === 'must') return 1;
  if (mode === 'never') return 0;
  if (mode === 'prob') {
    const expectedK = baseK + Math.max(0, trials) * clamp01(p);
    return clamp01((n - expectedK) / n);
  }
  const pmf = binomialPmfArray(trials, p);
  let sum = 0;
  for (let x = 0; x < pmf.length; x += 1) {
    if (pmf[x] > 0) {
      sum += pmf[x] * evalRollCallProb(baseK + x, n, mode, tau, mood);
    }
  }
  return sum;
}

function uLAttendOf(q: number): number {
  return 3 + 4 * q;
}

function uHAttendOf(q: number): number {
  return 4 * q;
}

function uSkipOf(q: number): number {
  return 5 - 10 * q;
}

interface ProfileMetrics {
  qAttendL: number;
  qSkipL: number;
  qAttendH: number;
  qSkipH: number;
  uLAttend: number;
  uLSkip: number;
  uHAttend: number;
  uHSkip: number;
  expectedQ: number;
}

function evaluateProfile(params: BneParams, pL: number, pH: number, nH: number, nL: number): ProfileMetrics {
  const { n, h, dealMode } = params;
  const alpha = clamp01(h / 100);

  let qAttendL: number;
  let qSkipL: number;
  let qAttendH: number;
  let qSkipH: number;
  let expectedQ: number;

  if (dealMode === 'independent') {
    const rOther = (1 - alpha) * clamp01(pL) + alpha * clamp01(pH);
    const qA = expectedQBinom(1, Math.max(0, n - 1), rOther, params);
    const qS = expectedQBinom(0, Math.max(0, n - 1), rOther, params);
    qAttendL = qA;
    qSkipL = qS;
    qAttendH = qA;
    qSkipH = qS;
    expectedQ = expectedQBinom(0, n, rOther, params);
  } else if (pH <= EPS) {
    // Segment 1 (pH = 0, L attends with pL)
    qAttendL = expectedQBinom(1, Math.max(0, nL - 1), pL, params);
    qSkipL = expectedQBinom(0, Math.max(0, nL - 1), pL, params);
    qAttendH = expectedQBinom(1, nL, pL, params);
    qSkipH = expectedQBinom(0, nL, pL, params);
    expectedQ = expectedQBinom(0, nL, pL, params);
  } else {
    // Segment 2 (pL = 1, H attends with pH)
    qAttendL = expectedQBinom(nL, nH, pH, params);
    qSkipL = expectedQBinom(Math.max(0, nL - 1), nH, pH, params);
    qAttendH = expectedQBinom(nL + 1, Math.max(0, nH - 1), pH, params);
    qSkipH = expectedQBinom(nL, Math.max(0, nH - 1), pH, params);
    expectedQ = expectedQBinom(nL, nH, pH, params);
  }

  return {
    qAttendL,
    qSkipL,
    qAttendH,
    qSkipH,
    uLAttend: uLAttendOf(qAttendL),
    uLSkip: uSkipOf(qSkipL),
    uHAttend: uHAttendOf(qAttendH),
    uHSkip: uSkipOf(qSkipH),
    expectedQ,
  };
}

function bisect(fn: (p: number) => number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (fn(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Exact symmetric Bayesian Nash Equilibrium solver for finite class size N.
 * Supports fixed-deck and independent draws across must / never / prob / threshold modes.
 */
export function solveBNE(params: BneParams): BneSolution {
  const n = Math.max(1, Math.round(params.n));
  const h = Math.max(0, Math.min(100, params.h));
  const normalized: BneParams = { ...params, n, h };
  const nH = Math.round((n * h) / 100);
  const nL = n - nH;

  const finish = (state: BneState, pL: number, pH: number): BneSolution => {
    const m = evaluateProfile(normalized, pL, pH, nH, nL);
    return {
      state,
      n,
      nH,
      nL,
      dealMode: normalized.dealMode,
      pL,
      pH,
      ...m,
      isLVerified: m.uLAttend >= m.uLSkip - 1e-6,
    };
  };

  if (normalized.mode === 'must') return finish('ALL_ATTEND', 1, 1);
  if (normalized.mode === 'never') return finish('ALL_SKIP', 0, 0);

  const hasH = normalized.dealMode === 'fixed' ? nH > 0 : h > 0;
  const hasL = normalized.dealMode === 'fixed' ? nL > 0 : h < 100;

  if (!hasH) {
    const at0 = evaluateProfile(normalized, 0, 0, nH, nL);
    if (at0.uLAttend <= at0.uLSkip + EPS) return finish('ALL_SKIP', 0, 0);
    const at1 = evaluateProfile(normalized, 1, 0, nH, nL);
    if (at1.uLAttend >= at1.uLSkip - EPS) return finish('ALL_ATTEND', 1, 1);
    const pL = bisect((p) => {
      const m = evaluateProfile(normalized, p, 0, nH, nL);
      return m.uLAttend - m.uLSkip;
    });
    return finish('MIXED_L', pL, 0);
  }

  if (!hasL) {
    const at0 = evaluateProfile(normalized, 1, 0, nH, nL);
    if (at0.uHAttend <= at0.uHSkip + EPS) return finish('ALL_SKIP', 0, 0);
    const at1 = evaluateProfile(normalized, 1, 1, nH, nL);
    if (at1.uHAttend >= at1.uHSkip - EPS) return finish('ALL_ATTEND', 1, 1);
    const pH = bisect((p) => {
      const m = evaluateProfile(normalized, 1, p, nH, nL);
      return m.uHAttend - m.uHSkip;
    });
    return finish('MIXED_H', 1, pH);
  }

  // General case: both L and H present.
  // Segment 1: (pL in [0, 1], pH = 0)
  const at00 = evaluateProfile(normalized, 0, 0, nH, nL);
  if (at00.uLAttend <= at00.uLSkip + EPS) {
    return finish('ALL_SKIP', 0, 0);
  }

  const at10 = evaluateProfile(normalized, 1, 0, nH, nL);
  if (at10.uLAttend < at10.uLSkip - EPS) {
    const pL = bisect((p) => {
      const m = evaluateProfile(normalized, p, 0, nH, nL);
      return m.uLAttend - m.uLSkip;
    });
    return finish('MIXED_L', pL, 0);
  }

  // Boundary (pL = 1, pH = 0)
  if (at10.uHAttend <= at10.uHSkip + EPS) {
    return finish('L_ATTEND_H_SKIP', 1, 0);
  }

  // Segment 2: (pL = 1, pH in [0, 1])
  const at11 = evaluateProfile(normalized, 1, 1, nH, nL);
  if (at11.uHAttend >= at11.uHSkip - EPS) {
    return finish('ALL_ATTEND', 1, 1);
  }

  const pH = bisect((p) => {
    const m = evaluateProfile(normalized, 1, p, nH, nL);
    return m.uHAttend - m.uHSkip;
  });
  return finish('MIXED_H', 1, pH);
}
