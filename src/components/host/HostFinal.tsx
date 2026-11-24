import confetti from 'canvas-confetti';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Leaderboard } from '../Leaderboard';
import { ReputationBoard } from '../ReputationBoard';
import { IconArrow, IconTrophy } from '../Icons';
import { play } from '../../lib/sound';
import type { HostState } from '../../lib/types';

interface HostFinalProps {
  state: HostState;
  onNext: () => void;
  busy: boolean;
}

export function HostFinal({ state, onNext, busy }: HostFinalProps) {
  const reduce = useReducedMotion();
  const top = (state.leaderboard || []).slice(0, 3);
  const rest = (state.leaderboard || []).slice(8, 20);
  const ordered = [top[1], top[0], top[2]].filter(Boolean);
  const podium = ordered.map((entry, index) => ({
    ...entry,
    podiumPlace: ordered.length === 1 ? 1 : ordered.length === 2 ? (index === 0 ? 2 : 1) : index === 1 ? 1 : index === 0 ? 2 : 3,
  }));

  useEffect(() => {
    if (!reduce) {
      play('win');
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.58 }, colors: ['#ffbe3d', '#ff5a3c', '#8be6c6', '#fff2d2'], disableForReducedMotion: true });
    }
  }, [reduce]);

  return (
    <section className="host-final">
      <header className="final-head">
        <div>
          <p className="stage-kicker">共战 {state.round} 局 · {state.playerCount} 位同学参战</p>
          <h1 className="display">早八封神榜</h1>
        </div>
        <div className="final-head-actions">
          <button type="button" className="btn btn-sun" onClick={onNext} disabled={busy}>加赛一局 <IconArrow /></button>
          <Link className="btn btn-ghost" to="/">回首页</Link>
        </div>
      </header>

      <div className="podium">
        {podium.map((entry) => {
          const place = entry.podiumPlace;
          const tied = (state.leaderboard || []).filter((e) => e.rank === entry.rank).length > 1;
          return (
            <motion.div
              key={entry.id}
              className={`podium-item place-${place}`}
              initial={reduce ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 190, damping: 20, delay: place === 1 ? 0.2 : place === 2 ? 0.35 : 0.5 }}
            >
              <div className="podium-person">
                {place === 1 && <IconTrophy />}
                <b>{entry.name}</b>
                <span className="num">{entry.score > 0 ? `+${entry.score}` : entry.score}</span>
                {tied && <small className="podium-tie">并列第 {entry.rank}</small>}
              </div>
              <div className="podium-block">
                <span className="num">{place}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className={`final-bottom ${state.gameMode === 'cover' ? 'has-reputation' : ''}`}>
        <Leaderboard entries={state.leaderboard} limit={8} title="最终积分榜" />
        {state.gameMode === 'cover' && (
          <ReputationBoard entries={state.reputationBoard} title="江湖声誉榜" limit={8} />
        )}
        <div className="final-note panel">
          {state.gameMode === 'base' ? (
            <>
              <p className="stage-kicker">课后复盘 · 博弈论时间</p>
              <h2>赢的不一定是早起的人，但一定是会算账的人。</h2>
              <p>
                回顾这几局：班里有多少困难户、老师定什么规矩、今天心情如何，再加上每个人心里的小九九，共同织成了那张看不见的点名网。
                所谓“贝叶斯纳什均衡”，从来不是靠玄学押中老师点不点名——而是无论你抽到自律人还是困难户，根据手里的信息算完期望收益后，都做出了当下最不后悔的选择。
              </p>
            </>
          ) : (
            <>
              <p className="stage-kicker">下课复盘 · 今天谁最会演</p>
              <h2>{state.gameMode === 'rollcall' ? '首轮躲过不算赢，第二堂还活着才算。' : '积分是本事，声誉是人品。'}</h2>
              <p>
                {state.gameMode === 'rollcall'
                  ? '第一堂的点名声会改变第二堂的风险：没点过名的老师更想补点，出勤率越低补得越狠。今天你是靠算账活下来的，还是靠回笼觉？'
                  : '高声誉的人更容易被老师信任，但一旦代勤翻车，金字招牌也摔得更响；低声誉的人敢赌，但老师复查时也更容易被盯上。今天谁最会演？'}
              </p>
            </>
          )}
          {rest.length > 0 && (
          <div className="final-rest">
            <span className="final-rest-label">第 9 名之后</span>
            {rest.map((entry) => (
              <span key={entry.id}><b>{entry.rank}</b> {entry.name} <i className="num">{entry.score}</i></span>
            ))}
          </div>
          )}
        </div>
      </div>
    </section>
  );
}
