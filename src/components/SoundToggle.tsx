import { useEffect, useState } from 'react';
import { isMuted, play, setMuted } from '../lib/sound';
import { IconVolume, IconVolumeOff } from './Icons';

export function SoundToggle({ className = '' }: { className?: string }) {
  const [muted, setLocal] = useState(isMuted());
  useEffect(() => {
    const onChange = () => setLocal(isMuted());
    window.addEventListener('zb-sound-change', onChange);
    return () => window.removeEventListener('zb-sound-change', onChange);
  }, []);
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-label={muted ? '打开声音' : '静音'}
      title={muted ? '打开声音' : '静音'}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        if (!next) play('click');
      }}
    >
      {muted ? <IconVolumeOff /> : <IconVolume />}
    </button>
  );
}
