import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { clock } from '../lib/format';

interface CountdownRingProps {
  ms: number;
  totalMs: number;
  seconds: number;
  size?: number;
  label?: string;
}

export function CountdownRing({ ms, totalMs, seconds, size = 220, label = '抉择倒计时' }: CountdownRingProps) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, ms / totalMs)) : 0;
  const urgent = seconds <= 10;
  return (
    <div className={`countdown ${urgent ? 'is-urgent' : ''}`} style={{ '--count-size': `${size}px` } as CSSProperties}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="countdown-track" cx="60" cy="60" r={r} />
        <motion.circle
          className="countdown-progress"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - progress) }}
          transition={{ duration: 0.2, ease: 'linear' }}
        />
      </svg>
      <div className="countdown-inner">
        <span className="countdown-label">{label}</span>
        <span className="countdown-time num">{clock(ms)}</span>
        <span className="countdown-sub">{urgent ? '马上锁死！' : '天人交战中'}</span>
      </div>
    </div>
  );
}
