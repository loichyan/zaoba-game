import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { CountdownRing } from '../CountdownRing';
import { Leaderboard } from '../Leaderboard';
import { ModeSummary, PlayerGrid } from './widgets';
import { IconAlarm, IconCheck, IconLock } from '../Icons';
import { gameModeLabel, modeLabel, modeRule, pct } from '../../lib/format';
import { useCountdown } from '../../lib/useCountdown';
import type { HostState } from '../../lib/types';
import { play } from '../../lib/sound';

interface HostActionProps {
  state: HostState;
  onLock: () => void;
  busy: boolean;
}

export function HostAction({ state, onLock, busy }: HostActionProps) {
  const totalMs = state.settings.duration * 1000;
  const { ms, seconds } = useCountdown(state.endsAt, state.serverNow);
  const lastTick = useRef<number | null>(null);
  const players = state.players.filter((p) => !p.waiting);
  const waiting = state.players.filter((p) => p.waiting);
  const ratio = state.participantCount ? state.submittedCount / state.participantCount : 0;
  const allIn = state.participantCount > 0 && state.submittedCount >= state.participantCount;
  const rollcall = state.gameMode === 'rollcall';
  const secondLecture = rollcall && state.lecture === 2;
  const firstResult = state.lectureResults[0];

  useEffect(() => {
    if (seconds <= 5 && seconds > 0 && lastTick.current !== seconds) {
      lastTick.current = seconds;
      play('tick');
    }
  }, [seconds]);

  return (
    <section className="host-action">
      <div className="action-main">
        <div className="action-heading">
          <p className="stage-kicker">
            第 {state.round} 局 · {gameModeLabel(state.gameMode)} · {rollcall ? (secondLecture ? '回笼觉' : '第 1 堂') : modeLabel(state.settings.mode)}
          </p>
          <h1 className="display">{rollcall ? (secondLecture ? '回笼觉' : '第一堂课') : state.gameMode === 'cover' ? '代勤者联盟' : modeLabel(state.settings.mode)}</h1>
          <p className="action-rule">{modeRule(state.settings.mode, state.settings)}</p>
          {secondLecture && (
            <p className={`first-call-state ${firstResult?.called ? 'is-called' : 'is-safe'}`}>
              <b>{firstResult?.called ? '首轮已点' : '首轮未点'}</b>
              <span>
                第一堂出勤率 {pct(firstResult?.attendanceRate ?? 0, 0)} · 第二堂点名率会据此修正
              </span>
            </p>
          )}
        </div>

        <div className="action-clock-row">
          <CountdownRing ms={ms} totalMs={totalMs} seconds={seconds} size={250} />
          <div className="action-progress">
            <div className="progress-head">
              <span>已表态</span>
              <b className="num">{state.submittedCount}<i>/{state.participantCount}</i></b>
            </div>
            <div className="progress-track">
              <motion.span animate={{ width: `${ratio * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
            </div>
            <p className="fine">
              {allIn ? '全员表态完毕！随时可以开奖揭晓。' : seconds <= 10 ? '最后十秒！还在犹豫的同学就要算睡过头翘课了。' : '大家在手机上暗中做决定，讲台大屏只显示谁选好了，绝不剧透选了啥。'}
            </p>
            {waiting.length > 0 && <p className="waiting-note">场边吃瓜（下局参战）：{waiting.map((p) => p.name).join('、')}</p>}
            <button
              type="button"
              className={`btn ${allIn ? 'btn-flame' : 'btn-sun'} lock-btn`}
              onClick={() => {
                play('lock');
                onLock();
              }}
              disabled={busy}
            >
              <IconLock />
              {busy ? '正在收卷…' : allIn ? '全员到齐，立即开奖' : '不等了，提前收卷'}
            </button>
          </div>
        </div>

        <div className="action-roster panel">
          <div className="panel-title">
            <h2><IconAlarm /> 谁还在被窝里挣扎？</h2>
            <span className="fine">{state.onlineCount} 人在线 · 超时未选算翘课</span>
          </div>
          <PlayerGrid players={players} status="action" />
        </div>
      </div>

      <aside className="action-side">
        <ModeSummary settings={state.settings} compact />
        <div className="payoff-mini panel">
          <div className="panel-title"><h3>早八盈亏价目表</h3></div>
          <div className="payoff-row"><span>自律人上课</span><b>点名 +7 / 不点 +3</b></div>
          <div className="payoff-row"><span>困难户上课</span><b>点名 +4 / 不点 0</b></div>
          <div className="payoff-row"><span>躺平翘课</span><b>点名 -5 / 不点 +5</b></div>
        </div>
        <Leaderboard entries={state.leaderboard} limit={6} title="上场积分" compact />
        {state.settings.mode === 'prob' && (
          <p className="side-note">
            概率点名：翘课率就是点名率。没人提前知道概率是多少，全看大家猜同学有多敢翘。
          </p>
        )}
        {state.settings.mode === 'threshold' && (
          <p className="side-note">
            阈值点名：到场人数守住 {state.settings.tau}% 就平安无事；一旦失守，老师有 {100 - state.settings.mood}% 概率开抓。
          </p>
        )}
        {state.gameMode === 'cover' && (
          <p className="side-note">
            代勤者联盟：点名后，教室里的一翘一去组合会进入代勤阶段。全班统一亮牌，老师再复查。
          </p>
        )}
        {allIn && (
          <motion.div className="all-in-badge" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <IconCheck /> 全员已表态
          </motion.div>
        )}
      </aside>
    </section>
  );
}
