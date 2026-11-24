import type { Theory } from '../lib/types';
import { IconDice, IconSpark } from './Icons';
import { MathTex } from './MathTex';
import { pct } from '../lib/format';

interface TheoryCardProps {
  theory: Theory | null;
  level?: 'off' | 'status' | 'full';
  compact?: boolean;
}

export function TheoryCard({ theory, level = 'status', compact = false }: TheoryCardProps) {
  if (!theory || level === 'off') return null;
  const full = level === 'full';
  const sourceLabel =
    theory.sampleSize && theory.sampleSize >= 2
      ? `按当前 ${theory.sampleSize} 人精确推算 · ${theory.dealMode === 'independent' ? '独立抽取' : '固定牌库'}`
      : '按大班比例推算';
  return (
    <section className={`theory-card tone-${tone(theory.state)} ${compact ? 'is-compact' : ''}`}>
      <header className="theory-head">
        <span className="theory-icon">{theory.mixing ? <IconDice /> : <IconSpark />}</span>
        <span>博弈推演</span>
        <span className="theory-source">{sourceLabel}</span>
      </header>
      <h3>{theory.label}</h3>
      {full && <p className="theory-detail">{theory.detail}</p>}
      {full && theory.pure.length > 0 && (
        <div className="theory-pure">
          {theory.pure.map((p, i) => (
            <span key={i}>
              {p.L === 'attend' ? '自律人去' : '自律人翘'} · {p.H === 'attend' ? '困难户去' : '困难户翘'}
              <b> <MathTex tex="q" /> ≈ {pct(p.q, 1)}</b>
            </span>
          ))}
        </div>
      )}
      {full && theory.mixing && (
        <div className="theory-mix">
          <div>
            <span>自律人上课率 <MathTex tex="p_L" /></span>
            <b className="num">{pct(theory.mixing.L.attend, 1)}</b>
          </div>
          <div>
            <span>困难户上课率 <MathTex tex="p_H" /></span>
            <b className="num">{pct(theory.mixing.H.attend, 1)}</b>
          </div>
          <div>
            <span>期望点名率 <MathTex tex="\bar{q}" /></span>
            <b className="num">{pct(theory.mixing.q, 1)}</b>
          </div>
        </div>
      )}
      <footer className="theory-foot">
        <span>自律人心理防线 {pct(theory.thresholds.L, 1)}</span>
        <span>困难户心理防线 {pct(theory.thresholds.H, 1)}</span>
      </footer>
    </section>
  );
}

function tone(state: Theory['state']): string {
  if (state === 'ALL_ATTEND') return 'mint';
  if (state === 'ALL_SKIP') return 'flame';
  if (state === 'NO_PURE') return 'sky';
  if (state === 'MULTIPLE') return 'paper';
  return 'sun';
}
