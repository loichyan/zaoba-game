const KEY = 'zb-sound-muted';
let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem(KEY) === '1';
} catch {
  muted = false;
}

type AudioContextCtor = typeof AudioContext;
type WebkitWindow = Window & { webkitAudioContext?: AudioContextCtor };

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctx = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 0.06, slide = 0): void {
  const ac = ensure();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ac.currentTime + start + duration);
  g.gain.setValueAtTime(0.0001, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.03);
}

function noise(duration = 0.18, gain = 0.04, low = 300): void {
  const ac = ensure();
  if (!ac) return;
  const buffer = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * duration)), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = low;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
}

export type SoundName = 'click' | 'join' | 'tick' | 'lock' | 'called' | 'safe' | 'coin' | 'lose' | 'pass' | 'win';

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = Boolean(next);
  try {
    localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('zb-sound-change'));
}

export function play(name: SoundName): void {
  if (muted) return;
  switch (name) {
    case 'click':
      tone(520, 0, 0.05, 'square', 0.025);
      break;
    case 'join':
      tone(420, 0, 0.08, 'triangle', 0.04);
      tone(620, 0.07, 0.1, 'triangle', 0.035);
      break;
    case 'tick':
      tone(880, 0, 0.035, 'square', 0.02);
      break;
    case 'lock':
      tone(180, 0, 0.12, 'sawtooth', 0.05);
      noise(0.18, 0.03, 800);
      break;
    case 'called':
      tone(300, 0, 0.25, 'sawtooth', 0.055, -140);
      tone(240, 0.22, 0.36, 'sawtooth', 0.05, -80);
      noise(0.35, 0.03, 500);
      break;
    case 'safe':
      tone(523, 0, 0.12, 'sine', 0.05);
      tone(659, 0.1, 0.14, 'sine', 0.05);
      tone(784, 0.21, 0.22, 'sine', 0.055);
      break;
    case 'coin':
      tone(880, 0, 0.08, 'triangle', 0.04);
      tone(1320, 0.07, 0.14, 'triangle', 0.035);
      break;
    case 'lose':
      tone(220, 0, 0.16, 'triangle', 0.045);
      tone(164, 0.12, 0.24, 'triangle', 0.045);
      break;
    case 'pass':
      tone(660, 0, 0.06, 'square', 0.025);
      tone(990, 0.08, 0.08, 'square', 0.022);
      break;
    case 'win':
      tone(523, 0, 0.12, 'triangle', 0.05);
      tone(659, 0.1, 0.12, 'triangle', 0.05);
      tone(784, 0.2, 0.12, 'triangle', 0.05);
      tone(1046, 0.3, 0.4, 'triangle', 0.06);
      break;
    default:
      break;
  }
}
