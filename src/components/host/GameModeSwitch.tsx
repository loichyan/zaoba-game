import { gameModeLabel } from '../../lib/format';
import { IconAlarm, IconBell, IconUsers } from '../Icons';
import type { GameMode } from '../../lib/types';

const OPTIONS: Array<{
  id: GameMode;
  icon: typeof IconBell;
  sub: string;
}> = [
  { id: 'base', icon: IconAlarm, sub: '单堂决胜' },
  { id: 'rollcall', icon: IconBell, sub: '两堂连战' },
  { id: 'cover', icon: IconUsers, sub: '双人组队' },
];

interface GameModeSwitchProps {
  current: GameMode;
  pending: GameMode | null;
  onChange: (mode: GameMode) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function GameModeSwitch({
  current,
  pending,
  onChange,
  disabled = false,
  compact = false,
}: GameModeSwitchProps) {
  const selected = pending ?? current;
  return (
    <div
      className={`game-mode-switch ${compact ? 'is-compact' : ''}`}
      role="radiogroup"
      aria-label="选择玩法"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = selected === option.id;
        return (
          <button
            type="button"
            key={option.id}
            className={`game-mode-choice ${active ? 'is-active' : ''}`}
            onClick={() => onChange(option.id)}
            disabled={disabled}
            aria-pressed={active}
          >
            <Icon />
            <span>
              <b>{gameModeLabel(option.id)}</b>
              {!compact && <small>{option.sub}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
