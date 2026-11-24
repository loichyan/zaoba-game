import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { modeLabel } from '../lib/format';
import type { Mode, Role } from '../lib/types';

interface RoleTicketProps {
  role: Role | null;
  mode?: Mode;
  animate?: boolean;
  compact?: boolean;
  children?: ReactNode;
}

export function RoleTicket({ role, mode, animate = true, compact = false, children }: RoleTicketProps) {
  if (!role) return null;
  const isDifficult = role.type === 'H';
  return (
    <motion.article
      className={`role-ticket ${isDifficult ? 'is-difficult' : 'is-disciplined'} ${compact ? 'is-compact' : ''}`}
      initial={animate ? { rotateY: -92, opacity: 0 } : false}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 210, damping: 20 }}
      style={{ transformPerspective: 900 }}
    >
      <div className="role-ticket-top">
        <span className="role-kicker">{mode ? `本局 · ${modeLabel(mode)}` : '本局身份卡'}</span>
        <span className="role-cost">上课成本 {role.cost}</span>
      </div>
      <div className="role-character" aria-hidden="true">{role.character}</div>
      <div className="role-main">
        <h2>{role.label}</h2>
        <p className="role-reason">{role.reason}</p>
      </div>
      <div className="role-payoff">
        <div>
          <span>老实去上课</span>
          <b>点名 {role.attend.called > 0 ? `+${role.attend.called}` : role.attend.called} / 不点 {role.attend.safe > 0 ? `+${role.attend.safe}` : role.attend.safe}</b>
        </div>
        <div>
          <span>躺平翘课</span>
          <b>点名 {role.skip.called} / 不点 +{role.skip.safe}</b>
        </div>
      </div>
      {children}
      <span className="ticket-barcode" aria-hidden="true" />
    </motion.article>
  );
}
