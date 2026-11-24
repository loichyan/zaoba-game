import { AnimatePresence, motion } from 'motion/react';
import type { LeaderboardEntry } from '../lib/types';
import { IconTrophy, IconWifi } from './Icons';

interface LeaderboardProps {
  entries: LeaderboardEntry[] | null;
  meId?: string;
  limit?: number;
  title?: string;
  compact?: boolean;
}

function LeaderRow({ entry, meId }: { entry: LeaderboardEntry; meId?: string }) {
  return (
    <motion.li
      layout
      className={`leader-row ${entry.id === meId ? 'is-me' : ''} ${entry.rank <= 3 ? `rank-${entry.rank}` : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
    >
      <span className={`rank-badge rank-badge-${Math.min(entry.rank, 4)}`}>{entry.rank}</span>
      <span className="leader-name">
        {entry.name}
        {entry.id === meId && <span className="me-tag">你</span>}
        {entry.bot && <span className="bot-tag">BOT</span>}
      </span>
      {!entry.connected && <IconWifi className="offline-dot" />}
      <span className="leader-score num">{entry.score > 0 ? `+${entry.score}` : entry.score}</span>
    </motion.li>
  );
}

export function Leaderboard({ entries, meId, limit = 10, title = '生存积分榜', compact = false }: LeaderboardProps) {
  const list = (entries || []).slice(0, limit);
  const self = meId ? (entries || []).find((entry) => entry.id === meId) : undefined;
  const selfOutside = self && !list.some((entry) => entry.id === self.id) ? self : null;
  return (
    <section className={`leaderboard ${compact ? 'is-compact' : ''}`} aria-label={title}>
      <header className="leaderboard-head">
        <h3><IconTrophy /> {title}</h3>
        <span className="fine">翘课小能手</span>
      </header>
      {list.length === 0 ? (
        <p className="empty-note">虚位以待，还没人上榜。</p>
      ) : (
        <ol className="leaderboard-list">
          <AnimatePresence initial={false}>
            {list.map((entry) => (
              <LeaderRow key={entry.id} entry={entry} meId={meId} />
            ))}
            {selfOutside && <LeaderRow key={selfOutside.id} entry={selfOutside} meId={meId} />}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}
