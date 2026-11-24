import { useEffect, useRef, useState } from 'react';

interface Countdown {
  ms: number;
  seconds: number;
  progress: number;
}

export function useCountdown(endsAt: number | null, serverNow?: number): Countdown {
  const offset = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof serverNow === 'number') offset.current = serverNow - Date.now();
  }, [serverNow]);

  useEffect(() => {
    if (!endsAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 180);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return { ms: 0, seconds: 0, progress: 0 };
  const ms = Math.max(0, endsAt - (now + offset.current));
  return { ms, seconds: Math.ceil(ms / 1000), progress: ms };
}

export function useCountUp(value: number, duration = 650, startAtZero = false): number {
  const [display, setDisplay] = useState(startAtZero ? 0 : value);
  const previous = useRef(startAtZero ? 0 : value);

  useEffect(() => {
    const from = previous.current;
    const to = value;
    previous.current = value;
    if (from === to) {
      setDisplay(to);
      return undefined;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(to);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (time: number) => {
      const t = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}
