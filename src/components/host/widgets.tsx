import { motion } from 'motion/react';
import { IconAlarm, IconBell, IconDice, IconSun, IconUsers } from '../Icons';
import { modeLabel, pct } from '../../lib/format';
import type { Mode, PlayerPublic, RoomStatus, Settings } from '../../lib/types';

export function ModeGlyph({ mode }: { mode: Mode }) {
  if (mode === 'must') return <IconBell />;
  if (mode === 'never') return <IconSun />;
  if (mode === 'prob') return <IconDice />;
  return <IconAlarm />;
}

export function ModeSummary({ settings, compact = false }: { settings: Settings; compact?: boolean }) {
  return (
    <div className={`mode-summary ${compact ? 'is-compact' : ''}`}>
      <span className="mode-summary-icon"><ModeGlyph mode={settings.mode} /></span>
      <span>
        <b>{modeLabel(settings.mode)}</b>
        <small>
          {settings.mode === 'threshold'
            ? `困难户 ${settings.h}% · 警戒线 ${settings.tau}% · 心情 ${settings.mood}`
            : settings.mode === 'prob'
              ? `困难户 ${settings.h}% · 点名率 = 翘课率`
              : settings.mode === 'must'
                ? `困难户 ${settings.h}% · 100% 点名`
                : `困难户 ${settings.h}% · 0% 点名`}
        </small>
      </span>
    </div>
  );
}

interface PlayerGridProps {
  players: PlayerPublic[];
  status: RoomStatus;
  empty?: string;
}

export function PlayerGrid({ players, status, empty = '教室里还空荡荡的' }: PlayerGridProps) {
  if (!players.length) {
    return (
      <div className="player-empty">
        <IconUsers />
        <b>{empty}</b>
        <span>把二维码投上大屏，看看谁第一个进教室。</span>
      </div>
    );
  }
  return (
    <div className={`player-grid ${status === 'action' ? 'is-action' : ''}`}>
      {players.map((player, index) => (
        <motion.div
          layout
          key={player.id}
          className={`player-chip ${player.submitted && status === 'action' ? 'is-in' : ''} ${player.waiting ? 'is-waiting' : ''} ${!player.connected ? 'is-offline' : ''}`}
          initial={{ opacity: 0, scale: 0.8, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30, delay: Math.min(index * 0.015, 0.4) }}
        >
          <span className="player-lamp" aria-hidden="true" />
          <span className="player-name">{player.name}</span>
          {player.bot ? (
            <span className="player-tag is-bot" title="机器人（测试）">BOT</span>
          ) : !player.connected ? (
            <span className="player-tag">掉线</span>
          ) : player.waiting ? (
            <span className="player-tag">吃瓜</span>
          ) : player.submitted && status === 'action' ? (
            <span className="player-tag is-good">已选</span>
          ) : (
            <span className="player-tag">{status === 'action' ? '纠结中' : '就位'}</span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export function StatBlock({ label, value, sub, tone = 'paper' }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className={`stat-block tone-${tone}`}>
      <span>{label}</span>
      <b className="num">{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function ProbabilityMeter({ q, roll, reveal = true }: { q: number; roll: number | null; reveal?: boolean }) {
  return (
    <div className="probability-meter">
      <div className="prob-labels">
        <span>点名概率</span>
        <b className="num">{pct(q, 1)}</b>
      </div>
      <div className="prob-track">
        <motion.span
          className="prob-fill"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, q * 100))}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        {reveal && roll != null && <span className="prob-roll" style={{ left: `${Math.min(99, roll * 100)}%` }} title={`抽签 ${roll.toFixed(3)}`} />}
      </div>
      <div className="prob-foot">
        <span>{q >= 1 ? '铁定要抓 (100%)' : q <= 0 ? '绝对安全 (0%)' : reveal && roll != null ? `摇出点数 ${(roll * 100).toFixed(1)}%` : '正在摇号…'}</span>
        <span>{q > 0 && q < 1 ? (reveal ? (roll != null && roll < q ? '撞枪口上了！' : '成功躲过一劫！') : '等待开奖') : '固定规则，无需摇号'}</span>
      </div>
    </div>
  );
}
