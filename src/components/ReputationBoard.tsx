import { motion } from 'motion/react';
import { IconSpark, IconTrophy } from './Icons';
import type { ReputationEntry, ReputationTier } from '../lib/types';

const TIER_LABEL: Record<ReputationTier, string> = {
  low: '低',
  mid: '中',
  high: '高',
};

const TIER_TONE: Record<ReputationTier, string> = {
  low: 'flame',
  mid: 'sun',
  high: 'mint',
};

function ReputationRow({
  entry,
  meId,
  index,
  showValues,
}: {
  entry: ReputationEntry;
  meId?: string;
  index: number;
  showValues: boolean;
}) {
  return (
    <motion.div
      className={`reputation-row ${entry.id === meId ? 'is-me' : ''} ${showValues ? '' : 'is-private'}`}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.035, duration: 0.25 }}
    >
      <span className={`reputation-rank ${entry.rank <= 3 ? 'is-top' : ''}`}>
        {entry.rank === 1 ? <IconTrophy /> : entry.rank}
      </span>
      <span className="reputation-name">
        {entry.name}
        {entry.id === meId && <span className="me-tag">你</span>}
      </span>
      <span className={`reputation-tier tone-${TIER_TONE[entry.tier]}`}>
        {TIER_LABEL[entry.tier]}
      </span>
      {showValues && <b className="num">{entry.reputation}</b>}
    </motion.div>
  );
}

interface ReputationBoardProps {
  entries: ReputationEntry[] | null;
  meId?: string;
  limit?: number;
  title?: string;
  compact?: boolean;
  showValues?: boolean;
}

export function ReputationBoard({
  entries,
  meId,
  limit = 8,
  title = '江湖声誉榜',
  compact = false,
  showValues = true,
}: ReputationBoardProps) {
  if (!entries?.length) {
    return (
      <section className={`reputation-board panel ${compact ? 'is-compact' : ''}`}>
        <div className="panel-title">
          <h2><IconSpark /> {title}</h2>
          <span className="fine">还没有人积攒口碑</span>
        </div>
      </section>
    );
  }

  const visible = entries.slice(0, limit);
  const self = meId ? entries.find((entry) => entry.id === meId) : undefined;
  const selfOutside = self && !visible.some((entry) => entry.id === self.id) ? self : null;

  return (
    <section className={`reputation-board panel ${compact ? 'is-compact' : ''}`}>
      <div className="panel-title">
        <h2><IconSpark /> {title}</h2>
        <span className="fine">演技大比拼</span>
      </div>
      <div className="reputation-list">
        {visible.map((entry, index) => (
          <ReputationRow key={entry.id} entry={entry} meId={meId} index={index} showValues={showValues} />
        ))}
        {selfOutside && (
          <ReputationRow
            key={selfOutside.id}
            entry={selfOutside}
            meId={meId}
            index={visible.length}
            showValues={showValues}
          />
        )}
      </div>
    </section>
  );
}
