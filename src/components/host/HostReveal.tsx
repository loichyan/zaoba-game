import confetti from 'canvas-confetti';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ProbabilityMeter } from './widgets';
import { IconArrow, IconBell, IconSpark } from '../Icons';
import { modeLabel, pct, roleLabel } from '../../lib/format';
import { play } from '../../lib/sound';
import type { HostState, RoleType } from '../../lib/types';

interface HostRevealProps {
  state: HostState;
  onSettle: () => void;
  busy: boolean;
}

export function HostReveal({ state, onSettle, busy }: HostRevealProps) {
  const result = state.result;
  const revealKey = result ? `${result.round}-${result.lecture}-${result.lockedAt}` : null;
  const called = Boolean(result?.called);
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const timers = useRef<number[]>([]);
  const soundRef = useRef<string | null>(null);

  const clear = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  useEffect(() => {
    clear();
    setStep(0);
    soundRef.current = null;
    if (reduce || !revealKey) {
      setStep(4);
      return clear;
    }
    [450, 1150, 1950, 2750].forEach((delay, index) => {
      timers.current.push(window.setTimeout(() => setStep(index + 1), delay));
    });
    return clear;
  }, [clear, reduce, revealKey]);

  useEffect(() => {
    if (!revealKey || step < 3) return;
    if (soundRef.current === revealKey) return;
    soundRef.current = revealKey;
    play(called ? 'called' : 'safe');
    if (called) {
      confetti({
        particleCount: 110,
        spread: 82,
        startVelocity: 42,
        gravity: 0.9,
        scalar: 1.1,
        origin: { y: 0.64 },
        colors: ['#ff5a3c', '#ff9a2e', '#fff2d2', '#d93826'],
        disableForReducedMotion: true,
      });
    } else {
      confetti({
        particleCount: 140,
        spread: 95,
        startVelocity: 36,
        gravity: 0.75,
        scalar: 1.05,
        origin: { y: 0.62 },
        colors: ['#ffbe3d', '#8be6c6', '#fff2d2', '#7cc8ff'],
        disableForReducedMotion: true,
      });
    }
  }, [step, revealKey, called]);

  if (!result) return null;
  const { actionCounts, typeCounts } = result;
  const callWord = called ? '点名' : '没点';
  const subWord = result.calledBy === 'fixed' ? (called ? '铁面必点' : '佛系放行') : result.calledBy === 'threshold' ? '警戒线判定' : '概率摇号';
  const typeRows: RoleType[] = ['L', 'H'];
  const rollcall = state.gameMode === 'rollcall';
  const firstLecture = rollcall && state.lecture === 1;

  return (
    <section className={`host-reveal ${called && step >= 3 ? 'is-called' : ''} ${!called && step >= 3 ? 'is-safe' : ''}`}>
      <div className="reveal-flash" aria-hidden="true" />
      <header className="reveal-head">
        <div>
          <p className="stage-kicker">
            第 {state.round} 局 · {rollcall ? (state.lecture === 2 ? '回笼觉' : '第 1 堂') : modeLabel(result.mode)}
          </p>
          <h1 className="display">{rollcall ? (firstLecture ? '第一堂散场' : '回笼觉开奖') : '命运揭晓时刻'}</h1>
        </div>
        <div className="reveal-head-actions">
          {step < 4 && <button type="button" className="btn btn-ghost btn-small" onClick={() => setStep(4)}>直接看结果</button>}
        </div>
      </header>

      <div className="reveal-grid">
        <motion.div
          className="reveal-stat reveal-attendance"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: step >= 1 ? 1 : 0, y: step >= 1 ? 0 : 18 }}
          transition={{ type: 'spring', stiffness: 230, damping: 24 }}
        >
          <span className="stage-kicker">本局出勤率</span>
          <div className="attendance-gauge" style={{ '--a': `${result.attendanceRate * 100}%` } as CSSProperties}>
            <div>
              <b className="num">{pct(result.attendanceRate, 0)}</b>
              <span>{result.attendance} / {result.participantCount} 人出现在教室</span>
            </div>
          </div>
          <div className="reveal-mini-stats">
            <div><span>翘课</span><b className="num">{result.skip}</b></div>
            <div><span>到场</span><b className="num">{result.attendance}</b></div>
            <div><span>人均得分</span><b className="num">{result.avgPayoff > 0 ? '+' : ''}{result.avgPayoff.toFixed(1)}</b></div>
          </div>
        </motion.div>

        <div className={`reveal-stamp-wrap ${called ? 'stamp-called' : 'stamp-safe'} ${step < 3 ? 'is-pending' : ''}`}>
          {step < 3 && (
            <div className="reveal-wait">
              <span className="reveal-wait-ring" aria-hidden="true" />
              <b>{step === 0 ? '锁定底牌' : step === 1 ? '清点人头' : '摇生死签'}</b>
              <span>{step === 0 ? '正在收走全班同学的选择…' : step === 1 ? '看看教室坐了几个人、被窝留了几个人…' : '正在按本局出勤情况计算点名概率…'}</span>
            </div>
          )}
          <motion.div
            className="reveal-stamp"
            initial={{ opacity: 0, scale: 0.7, rotate: -16 }}
            animate={{ opacity: step >= 3 ? 1 : 0, scale: step >= 3 ? 1 : 0.7, rotate: step >= 3 ? -7 : -16 }}
            transition={{ type: 'spring', stiffness: 230, damping: 15 }}
          >
            <span className="reveal-stamp-sub">{subWord}</span>
            <b>{callWord}</b>
            <span className="reveal-stamp-foot">
              {called ? '翘课党全员暴击 -5 分' : result.calledBy === 'fixed' ? '老师今天压根没带花名册' : '逃过一劫，被窝党狂喜 +5 分'}
            </span>
          </motion.div>
          <motion.div
            className="stamp-rays"
            animate={step >= 3 ? { rotate: 360 } : {}}
            transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            aria-hidden="true"
          />
        </div>

        <motion.div
          className="reveal-prob-card panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: step >= 2 ? 1 : 0, y: step >= 2 ? 0 : 18 }}
          transition={{ type: 'spring', stiffness: 230, damping: 24 }}
        >
          <div className="panel-title">
            <h2>{result.calledBy === 'prob' ? '全班翘课率 → 老师点名率' : result.calledBy === 'threshold' ? '教室出勤率 → 老师点名率' : '本局点名规则'}</h2>
            <span className={`call-pill ${step >= 3 ? (called ? 'is-called' : 'is-safe') : ''}`}>{step >= 3 ? (called ? '点名触发' : '平安放行') : '悬念揭晓中'}</span>
          </div>
          <ProbabilityMeter q={result.q} roll={result.roll} reveal={step >= 3} />
          {result.calledBy === 'threshold' && (
            <p className="prob-note">
              本局出勤率 {pct(result.attendanceRate, 0)}，
              {result.attendanceRate < result.settings.tau / 100
                ? `跌破了 ${result.settings.tau}% 警戒线！老师心情指数 ${result.settings.mood}，按 ${pct(1 - result.settings.mood / 100, 0)} 的概率摇号抓人。`
                : `稳稳守住 ${result.settings.tau}% 警戒线，老师看着教室挺满，直接合上了花名册。`}
            </p>
          )}
          {result.calledBy === 'fixed' && (
            <p className="prob-note">
              {called ? '必点局没有任何侥幸：来教室的稳拿分，赖在被窝的统统扣 5 分。' : '必不点局老师彻底放养：来上课属于情怀满分，躺被窝白捡 5 分。'}
            </p>
          )}
          {result.calledBy === 'prob' && (
            <p className="prob-note">
              本局有 {pct(result.skipRate, 1)} 的同学选了翘课，直接把老师点名率抬到了 {pct(result.q, 1)}——这波纯粹是全班自己凑出来的局。
            </p>
          )}
          {rollcall && state.lecture === 2 && (
            <p className="prob-note">
              首轮{result.firstCalled ? '已点' : '未点'} · 本轮基础点名率 {pct(result.qBase, 0)}，
              回笼觉修正后 {pct(result.q, 1)}。
            </p>
          )}
          {result.autoLocked && <p className="prob-note warn">倒计时归零自动收卷，没来得及选的同学已按睡过头翘课处理。</p>}
        </motion.div>
      </div>

      <motion.div
        className="reveal-types panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: step >= 4 ? 1 : 0, y: step >= 4 ? 0 : 18 }}
      >
        {typeRows.map((type) => {
          const total = typeCounts[type] || 0;
          const attend = actionCounts[type]?.attend || 0;
          const skip = actionCounts[type]?.skip || 0;
          const ratio = total ? attend / total : 0;
          return (
            <div className={`type-row type-${type}`} key={type}>
              <div className="type-name">
                <span className={`type-dot dot-${type === 'H' ? 'flame' : 'mint'}`} />
                <b>{roleLabel(type)}</b>
                <span>{total} 人</span>
              </div>
              <div className="type-bar"><span style={{ width: `${ratio * 100}%` }} /></div>
              <div className="type-counts">
                <span>去 <b className="num">{attend}</b></span>
                <span>翘 <b className="num">{skip}</b></span>
              </div>
            </div>
          );
        })}
        <div className="reveal-foot-actions">
          <button
            type="button"
            className={`btn ${called ? 'btn-flame' : 'btn-mint'}`}
            onClick={onSettle}
            disabled={busy || step < 3}
          >
            {rollcall ? (firstLecture ? '开启第二堂' : '看积分榜') : '看积分榜'} <IconArrow />
          </button>
          <span className="fine">{step < 3 ? '屏住呼吸，马上开奖…' : called ? '今天被抓的同学，下局记得定三个闹钟。' : '这局逃过一劫，别高兴得太早。'}</span>
        </div>
      </motion.div>

      {step >= 3 && (
        <div className="reveal-corner-note">
          {result.called ? <IconBell /> : <IconSpark />}
          <span>{called ? '点名生效：翘课全员 -5 分，到场同学喜提点名加分' : '平安放行：翘课党笑纳 +5 分，到场同学按不点名计分'}</span>
        </div>
      )}
    </section>
  );
}
