import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { play } from '../lib/sound';
import { SleepMarks } from './SleepMarks';

const RING_LINES = [
  '叮铃铃——07:59 了！',
  '别按了，再按也是早八',
  '闹钟已经尽力了，剩下的看你',
];

const SNOOZE_LINES = [
  '成功向被窝续费 5 分钟',
  '又续 5 分钟，食堂包子要凉了',
  '再睡 5 分钟，这节直接改上早九',
  '第 4 次续费，老师已经翻开点名册了',
  '别按了，干脆明年重修见吧',
];

export function HeroClock() {
  const [ringing, setRinging] = useState(false);
  const [snoozes, setSnoozes] = useState(0);
  const [rings, setRings] = useState(0);
  const [bubble, setBubble] = useState('');
  const timer = useRef<number | null>(null);

  const ring = (message?: string) => {
    const text = message || RING_LINES[rings % RING_LINES.length];
    if (!message) setRings((n) => n + 1);
    setRinging(true);
    setBubble(text);
    play('tick');
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRinging(false), 900);
    window.setTimeout(() => setBubble(''), 1600);
  };

  return (
    <div className={`hero-clock-scene ${ringing ? 'is-ringing' : ''}`}>
      <div className="hero-sun" aria-hidden="true" />
      <div className="hero-orbit hero-orbit-a" aria-hidden="true" />
      <div className="hero-orbit hero-orbit-b" aria-hidden="true" />
      <div className="hero-skyline" aria-hidden="true">
        <span /><span /><span /><span /><span /><span /><span />
      </div>
      <SleepMarks className="hero-zzz" />
      <AnimatePresence>
        {bubble && (
          <motion.div
            className="clock-bubble"
            initial={{ opacity: 0, y: 10, rotate: -4 }}
            animate={{ opacity: 1, y: 0, rotate: -4 }}
            exit={{ opacity: 0, y: -6 }}
          >
            {bubble}
          </motion.div>
        )}
      </AnimatePresence>
      <button type="button" className="alarm-clock" onClick={() => ring()} aria-label="按响闹钟">
        <span className="ring-wave ring-wave-a" aria-hidden="true" />
        <span className="ring-wave ring-wave-b" aria-hidden="true" />
        <svg viewBox="0 0 320 320" role="img" aria-hidden="true">
          <path d="M78 54 40 24M242 54l38-30" stroke="currentColor" strokeWidth="12" strokeLinecap="round" opacity=".7" />
          <circle cx="86" cy="84" r="30" fill="currentColor" opacity=".85" />
          <circle cx="234" cy="84" r="30" fill="currentColor" opacity=".85" />
          <path d="M80 262 56 296M240 262l24 34" stroke="currentColor" strokeWidth="12" strokeLinecap="round" opacity=".7" />
          <circle cx="160" cy="172" r="125" fill="var(--paper)" />
          <circle cx="160" cy="172" r="105" fill="var(--ink)" />
          <circle cx="160" cy="172" r="100" fill="none" stroke="var(--sun)" strokeWidth="3" opacity=".6" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const x1 = 160 + Math.cos(angle) * 88;
            const y1 = 172 + Math.sin(angle) * 88;
            const x2 = 160 + Math.cos(angle) * (i % 3 === 0 ? 72 : 79);
            const y2 = 172 + Math.sin(angle) * (i % 3 === 0 ? 72 : 79);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--paper)" strokeWidth={i % 3 === 0 ? 5 : 2} opacity={i % 3 === 0 ? 0.9 : 0.45} strokeLinecap="round" />;
          })}
          <line x1="160" y1="172" x2="160" y2="102" stroke="var(--sun)" strokeWidth="8" strokeLinecap="round" />
          <line x1="160" y1="172" x2="103" y2="192" stroke="var(--flame)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="160" cy="172" r="11" fill="var(--sun)" />
          <circle cx="160" cy="172" r="4" fill="var(--ink)" />
          <path d="M120 228c14 8 66 8 80 0" stroke="var(--paper)" strokeWidth="4" strokeLinecap="round" opacity=".28" fill="none" />
        </svg>
        <span className="clock-hands" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="snooze-btn"
        onClick={() => {
          const next = snoozes + 1;
          setSnoozes(next);
          ring(SNOOZE_LINES[Math.min(next - 1, SNOOZE_LINES.length - 1)]);
        }}
      >
        <span>再睡五分钟</span>
        <span className="snooze-count num">{String(snoozes).padStart(2, '0')}</span>
      </button>
    </div>
  );
}
