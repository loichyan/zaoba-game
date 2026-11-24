import { motion } from 'motion/react';
import { useCountdown } from '../../lib/useCountdown';
import { clock, pct } from '../../lib/format';
import { IconBell, IconCheck, IconLock, IconSpark, IconUsers } from '../Icons';
import { ProbabilityMeter } from './widgets';
import type { HostState, ReputationTier } from '../../lib/types';

const TIER_LABEL: Record<ReputationTier, string> = { low: '低', mid: '中', high: '高' };

interface HostCoverProps {
  state: HostState;
  onLock: () => void;
  busy: boolean;
}

export function HostCover({ state, onLock, busy }: HostCoverProps) {
  const cover = state.cover;
  const { ms, seconds } = useCountdown(cover?.endsAt ?? null, state.serverNow);
  if (!cover) return null;
  const allDecided = cover.eligibleCount > 0 && cover.decidedCount >= cover.eligibleCount;
  const urgent = seconds <= 8;

  return (
    <section className="host-cover">
      <header className="cover-head">
        <div>
          <p className="stage-kicker">第 {state.round} 局 · 代勤阶段</p>
          <h1 className="display">演技大考</h1>
          <p className="cover-lede">
            老师点到了 {cover.eligibleCount} 位同学。教室里的同桌正在决定：帮，还是不帮。
          </p>
        </div>
        <div className={`cover-clock ${urgent ? 'is-urgent' : ''}`}>
          <span>统一亮牌倒计时</span>
          <b className="num">{clock(ms)}</b>
          <small>{urgent ? '倒计时归零就算见死不救' : '先别偷看，全班一起亮牌'}</small>
        </div>
      </header>

      <div className="cover-grid">
        <motion.div
          className="cover-call panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 25 }}
        >
          <div className="panel-title">
            <h2><IconBell /> 点名已经落定</h2>
            <span className="call-pill is-called">代勤中</span>
          </div>
          <ProbabilityMeter q={cover.q} roll={cover.roll} reveal />
          <div className="cover-call-stats">
            <div><span>被点同学</span><b className="num">{cover.eligibleCount}</b></div>
            <div><span>已经表态</span><b className="num">{cover.decidedCount}</b></div>
            <div><span>还在纠结</span><b className="num">{cover.eligibleCount - cover.decidedCount}</b></div>
          </div>
          <p className="cover-note">
            <IconSpark /> 现在只显示「已做出决定」，谁帮谁不帮，等全班一起亮牌。
          </p>
        </motion.div>

        <motion.div
          className="cover-roster panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 220, damping: 25 }}
        >
          <div className="panel-title">
            <h2><IconUsers /> 本局同桌名单</h2>
            <span className="fine">{cover.decidedCount} / {cover.eligibleCount} 组已表态</span>
          </div>
          <div className="cover-list">
            {cover.entries.map((entry, index) => (
              <motion.div
                className={`cover-pair ${entry.decided ? 'is-decided' : ''}`}
                key={entry.teamId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="cover-pair-names">
                  <span className="cover-helper">{entry.helperName}</span>
                  <span className="cover-arrow">替</span>
                  <span className="cover-absentee">{entry.absenteeName}</span>
                </div>
                <div className="cover-pair-meta">
                  <span className={`reputation-tier tier-${entry.helperTier}`}>声誉 {TIER_LABEL[entry.helperTier]}</span>
                  <span className={`reputation-tier tier-${entry.absenteeTier}`}>被点 · {TIER_LABEL[entry.absenteeTier]}</span>
                </div>
                <span className={`cover-state ${entry.decided ? 'is-in' : ''}`}>
                  {entry.decided ? <><IconCheck /> 已决定</> : '还在纠结…'}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="cover-actions">
        <p className="fine">
          {allDecided ? '全班都交卷了。亮牌之后，老师会挨个复查。' : `已经 ${cover.decidedCount} / ${cover.eligibleCount} 组表态，剩下 ${cover.eligibleCount - cover.decidedCount} 组还在演。`}
        </p>
        <button
          type="button"
          className={`btn ${allDecided ? 'btn-flame' : 'btn-sun'}`}
          onClick={onLock}
          disabled={busy}
        >
          <IconLock />
          {busy ? '正在亮牌…' : allDecided ? '全员到齐，立即亮牌' : '不等了，提前结束'}
        </button>
        <span className="cover-prob-note">老师复查概率按被点同学的声誉算 · {pct(cover.q, 0)} 是点名概率</span>
      </div>
    </section>
  );
}
