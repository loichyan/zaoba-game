import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { IconBell, IconDice, IconEye, IconPlay, IconSpark, IconSun } from '../../Icons';
import { MathTex } from '../../MathTex';
import { play } from '../../../lib/sound';
import type { RoleType } from '../../../lib/types';

type DemoRule = 'prob' | 'threshold' | 'fixed';

interface Seat {
  id: number;
  label: string;
  type: RoleType;
  action: 'attend' | 'skip';
  isMe?: boolean;
}

const NAMES = ['你', '诸葛亮', '貂蝉', '张飞', '周瑜', '大乔', '曹操', '郭嘉', '赵云', '甄姬', '吕布', '小乔'];
const FIXED_TYPES: RoleType[] = ['H', 'L', 'H', 'H', 'L', 'L', 'H', 'L', 'L', 'H', 'L', 'L'];

export function Slide01Intro() {
  const [myType, setMyType] = useState<RoleType>('H');
  const [myAction, setMyAction] = useState<'attend' | 'skip'>('skip');
  const [godView, setGodView] = useState(false);
  const [rule, setRule] = useState<DemoRule>('fixed');
  const [settled, setSettled] = useState(false);
  const [called, setCalled] = useState(false);
  const [roundTick, setRoundTick] = useState(0);

  const seats: Seat[] = useMemo(() => {
    return NAMES.map((label, idx) => {
      const type: RoleType = idx === 0 ? myType : FIXED_TYPES[idx];
      // Deterministic yet varied classmate choices based on roundTick so re-running feels alive
      const seed = (idx * 7 + roundTick * 3) % 10;
      const action: 'attend' | 'skip' =
        idx === 0
          ? myAction
          : type === 'L'
            ? seed < 8
              ? 'attend'
              : 'skip'
            : seed < 2
              ? 'attend'
              : 'skip';
      return { id: idx, label, type, action, isMe: idx === 0 };
    });
  }, [myType, myAction, roundTick]);

  const skipCount = seats.filter((s) => s.action === 'skip').length;
  const attendCount = seats.length - skipCount;
  const attendRate = attendCount / seats.length;
  const skipRate = skipCount / seats.length;

  const q =
    rule === 'fixed'
      ? 0.3
      : rule === 'prob'
        ? skipRate
        : attendRate < 0.7
          ? 0.5
          : 0;

  const myPayoff =
    myAction === 'attend'
      ? myType === 'H'
        ? called
          ? 4
          : 0
        : called
          ? 7
          : 3
      : called
        ? -5
        : 5;

  const runSimulation = () => {
    const nextTick = roundTick + 1;
    setRoundTick(nextTick);
    const nextCalled = Math.random() < q;
    setCalled(nextCalled);
    setSettled(true);
    play(nextCalled ? 'called' : 'safe');
  };

  const switchRule = (next: DemoRule) => {
    setRule(next);
    setSettled(false);
    play('click');
  };

  return (
    <div className="slide-body slide-01">
      <div className="slide-col slide-01-left">
        <div className="slide-duo-cards">
          <article className="slide-concept-card tone-sky">
            <div className="concept-head">
              <span className="concept-badge">特征 1</span>
              <h3>不完全信息</h3>
            </div>
            <p>
              <b>知己不知彼</b>：知道自己是 <MathTex tex="H" /> 还是 <MathTex tex="L" />，不知他人底牌，故也不知其收益函数。
            </p>
          </article>

          <article className="slide-concept-card tone-sun">
            <div className="concept-head">
              <span className="concept-badge">特征 2</span>
              <h3>静态（同时交卷）</h3>
            </div>
            <p>
              <b>同时落子</b>：做决定前互不可见；倒计时结束，按公开规则统一结算。
            </p>
          </article>
        </div>

        <div className="slide-mapping panel">
          <div className="slide-panel-head">
            <h3>早八生存局里的博弈要素</h3>
            <span className="fine">一一对应</span>
          </div>
          <div className="mapping-grid">
            <div><span>玩家</span><b>全班 <MathTex tex="N" /> 位学生</b></div>
            <div><span>私人类型</span><b><span className="tone-flame">困难户 <MathTex tex="H" /></span> <i className="vs-sep">/</i> <span className="tone-mint">自律人 <MathTex tex="L" /></span></b></div>
            <div><span>可选行动</span><b><span className="tone-mint">去上课</span> <i className="vs-sep">/</i> <span className="tone-flame">翘课</span></b></div>
            <div><span>先验分布</span><b><MathTex tex="P(H),\ P(L)" /></b></div>
            <div><span>公共规则</span><b>点名概率 <MathTex tex="q(K)" /></b></div>
            <div><span>老师角色</span><b>规则执行机（非玩家）</b></div>
          </div>
          <p className="mapping-footnote">
            <IconBell />
            <span>
              <b>老师 = 规则执行机</b>：规则提前写死，不临时变卦，因此是<b>静态博弈</b>。
            </span>
          </p>
        </div>

        <div className="slide-takeaway ticket">
          <span className="takeaway-tag">核心定义</span>
          <p>有私密底牌、不知他人底牌；全员同时出招，按公开规则算账。</p>
        </div>
      </div>

      <div className="slide-col slide-01-right panel">
        <div className="slide-panel-head">
          <h3>早八教室透视镜</h3>
          <button
            type="button"
            className={`slide-pill-toggle ${godView ? 'is-on' : ''}`}
            onClick={() => {
              setGodView((v) => !v);
              play('click');
            }}
          >
            <IconEye />
            <span>{godView ? '上帝视角（全亮牌）' : '学生视角（盲盒）'}</span>
          </button>
        </div>

        <div className="sim-toolbar">
          <div className="sim-group">
            <span className="sim-label">你的底牌</span>
            <div className="sim-segmented">
              <button
                type="button"
                className={myType === 'H' ? 'is-active tone-flame' : ''}
                onClick={() => {
                  setMyType('H');
                  setSettled(false);
                  play('click');
                }}
              >
                困 · 困难户
              </button>
              <button
                type="button"
                className={myType === 'L' ? 'is-active tone-mint' : ''}
                onClick={() => {
                  setMyType('L');
                  setSettled(false);
                  play('click');
                }}
              >
                醒 · 自律人
              </button>
            </div>
          </div>

          <div className="sim-group">
            <span className="sim-label">你的选择</span>
            <div className="sim-segmented">
              <button
                type="button"
                className={myAction === 'attend' ? 'is-active tone-mint' : ''}
                onClick={() => {
                  setMyAction('attend');
                  setSettled(false);
                  play('click');
                }}
              >
                去上课
              </button>
              <button
                type="button"
                className={myAction === 'skip' ? 'is-active tone-flame' : ''}
                onClick={() => {
                  setMyAction('skip');
                  setSettled(false);
                  play('click');
                }}
              >
                翘课
              </button>
            </div>
          </div>
        </div>

        <div className={`seat-grid ${rule === 'fixed' ? 'is-decoupled' : ''}`}>
          {seats.map((seat) => {
            const revealRole = seat.isMe || godView;
            const revealAction = seat.isMe || settled;
            return (
              <motion.div
                key={seat.id}
                layout
                className={[
                  'seat-card',
                  seat.isMe ? 'is-me' : '',
                  revealRole ? (seat.type === 'H' ? 'is-h' : 'is-l') : 'is-hidden',
                  revealAction ? `act-${seat.action}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                initial={false}
                animate={{
                  opacity: rule === 'fixed' && !seat.isMe ? 0.36 : 1,
                  scale: seat.isMe ? 1.02 : 1,
                }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              >
                <span className="seat-name">{seat.label}</span>
                <strong className="seat-badge">
                  {revealRole ? (seat.type === 'H' ? '困 H' : '醒 L') : '？'}
                </strong>
                <span className="seat-act">
                  {revealAction ? (seat.action === 'attend' ? '去上课' : '翘课') : '暗中抉择'}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="rule-machine">
          <div className="rule-tabs" role="tablist" aria-label="点名规则演示">
            <button type="button" className={rule === 'fixed' ? 'is-active is-warn' : ''} onClick={() => switchRule('fixed')}>
              <IconBell /> 固定点名 (<MathTex tex="q_0=30\%" />)
            </button>
            <button type="button" className={rule === 'prob' ? 'is-active' : ''} onClick={() => switchRule('prob')}>
              <IconDice /> 概率点名 (<MathTex tex="q=\text{翘课率}" />)
            </button>
            <button type="button" className={rule === 'threshold' ? 'is-active' : ''} onClick={() => switchRule('threshold')}>
              <IconSun /> 阈值点名 (<MathTex tex="K/N<70\%" />)
            </button>
          </div>

          <div className="rule-readout">
            {rule === 'fixed' ? (
              <div className="rule-non-game">
                <IconSpark />
                <span>
                  <b>非博弈：</b>他人去不去都不影响 <MathTex tex="q_0=30\%" />，退化为单人期望题。
                </span>
              </div>
            ) : (
              <div className="rule-metrics">
                <div>
                  <span>当前出勤 <MathTex tex="K" /></span>
                  <b className="num">{settled ? `${attendCount}/12 (${Math.round(attendRate * 100)}%)` : '等待同时亮牌'}</b>
                </div>
                <div>
                  <span>规则算出 <MathTex tex="q(K)" /></span>
                  <b className="num">{settled ? `${Math.round(q * 100)}%` : '由全班共同决定'}</b>
                </div>
              </div>
            )}

            <button type="button" className="btn btn-sun btn-small" onClick={runSimulation}>
              <IconPlay /> {settled ? '再演一轮' : '全班同时落子'}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {settled && (
              <motion.div
                key={`${roundTick}-${called}`}
                className={`sim-verdict ${called ? 'is-called' : 'is-safe'}`}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              >
                <span className="sim-verdict-stamp">{called ? '点名' : '没点'}</span>
                <span>
                  你（{myType === 'H' ? '困难户' : '自律人'}）选了<b>{myAction === 'attend' ? '去上课' : '翘课'}</b>，本轮收益{' '}
                  <b className="num">{myPayoff > 0 ? `+${myPayoff}` : myPayoff}</b> 分。
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
