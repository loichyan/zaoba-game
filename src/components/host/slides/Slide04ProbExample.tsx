import confetti from 'canvas-confetti';
import { motion, useReducedMotion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { IconCheck, IconSpark } from '../../Icons';
import { MathTex } from '../../MathTex';
import { compareRoundWithTheory, PROB_EX_EQ_P, probExamplePayoffs } from '../../../lib/teaching';
import { play } from '../../../lib/sound';
import type { HostState } from '../../../lib/types';

interface Slide04Props {
  step: number;
  onStep: (next: number) => void;
  roomState?: HostState | null;
}

const STEP_ITEMS: Array<{ key: string; label: ReactNode }> = [
  { key: '1', label: '1. 设候选策略' },
  { key: '2', label: <>2. 算 <MathTex tex="H" /> 的两笔账</> },
  { key: '3', label: <>3. 压平天平求 <MathTex tex="p_H" /></> },
  { key: '4', label: <>4. 反向验算 <MathTex tex="L" /></> },
];

export function Slide04ProbExample({ step, onStep, roomState }: Slide04Props) {
  const [pPct, setPPct] = useState(9.09);
  const reduce = useReducedMotion();
  const p = pPct / 100;
  const stats = probExamplePayoffs(p);
  const atEq = Math.abs(p - PROB_EX_EQ_P) < 0.008;

  // Map (p in [0, 1], u in [-0.2, 5.2]) to SVG coords
  const W = 440;
  const H = 210;
  const pad = { l: 44, r: 18, t: 18, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const xOf = (val: number) => pad.l + val * plotW;
  const yOf = (val: number) => pad.t + ((5.2 - val) / 5.4) * plotH;

  const eqStats = probExamplePayoffs(PROB_EX_EQ_P);
  const eqX = xOf(PROB_EX_EQ_P);
  const eqY = yOf(eqStats.uHAttend);
  const curX = xOf(p);
  const curYAttend = yOf(stats.uHAttend);
  const curYSkip = yOf(stats.uHSkip);

  const probHistory = (roomState?.history ?? []).filter((h) => h.mode === 'prob');
  const latestProb = probHistory.length ? probHistory[probHistory.length - 1] : null;
  const probCompare = latestProb ? compareRoundWithTheory(latestProb) : null;

  const snapToEq = () => {
    setPPct(Number((PROB_EX_EQ_P * 100).toFixed(2)));
    if (step < 3) onStep(3);
    play('safe');
    if (!reduce) {
      confetti({
        particleCount: 45,
        spread: 55,
        startVelocity: 24,
        origin: { x: 0.72, y: 0.55 },
        colors: ['#ffbe3d', '#8be6c6', '#fff2d2'],
        disableForReducedMotion: true,
      });
    }
  };

  return (
    <div className="slide-body slide-04">
      <div className="slide-math-left">
        <div className="setup-strip panel">
          <div className="setup-facts">
            <span>总人数 <b><MathTex tex="N=30" /></b></span>
            <span>固定牌库 <b><MathTex tex="N_H=12,\ N_L=18" /></b></span>
            <span>规则 <b><MathTex tex="q(K) = \frac{N-K}{N}" /></b></span>
          </div>
          <table className="mini-payoff-table" aria-label="两类角色收益表">
            <thead>
              <tr>
                <th>类型</th>
                <th>点名·上课</th>
                <th>不点·上课</th>
                <th>点名·翘课</th>
                <th>不点·翘课</th>
              </tr>
            </thead>
            <tbody>
              <tr className="row-l">
                <td>自律人 <MathTex tex="L" /></td>
                <td className="num">+7</td>
                <td className="num">+3</td>
                <td className="num">-5</td>
                <td className="num">+5</td>
              </tr>
              <tr className="row-h">
                <td>困难户 <MathTex tex="H" /></td>
                <td className="num">+4</td>
                <td className="num">0</td>
                <td className="num">-5</td>
                <td className="num">+5</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="step-tabs" role="tablist" aria-label="推导步骤">
          {STEP_ITEMS.map((item, idx) => {
            const s = idx + 1;
            return (
              <button
                key={item.key}
                type="button"
                className={`step-tab ${step === s ? 'is-active' : ''} ${step > s ? 'is-done' : ''}`}
                onClick={() => {
                  onStep(s);
                  play('click');
                }}
              >
                {step > s && <IconCheck />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="derivation-cards">
          <motion.div
            className={`deriv-card ${step === 1 ? 'is-focus' : ''}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="deriv-num">Step 1</span>
            <div className="deriv-content">
              <b>候选策略：<MathTex tex="L" /> 全去（<MathTex tex="p_L=1" />）· <MathTex tex="H" /> 以 <MathTex tex="p_H" /> 上课</b>
              <p>
                固定牌库下其余 11 名 <MathTex tex="H" /> 上课人数 <MathTex tex="X \sim B(11, p_H)" />，<MathTex tex="\mathbb{E}[X] = 11p_H" />（<MathTex tex="p_H" /> 待求）。
              </p>
            </div>
          </motion.div>

          {step >= 2 && (
            <motion.div
              className={`deriv-card ${step === 2 ? 'is-focus' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="deriv-num">Step 2</span>
              <div className="deriv-content">
                <b>算 <MathTex tex="H" /> 两笔账（自己翘课会推高 <MathTex tex="q" />）</b>
                <div className="formula-pair">
                  <div className="formula-chip is-mint">
                    <span>上课：<MathTex tex="K=19+X,\ \bar{q}_H(\text{上课})=\frac{11-11p_H}{30}" /></span>
                    <MathTex display tex="U_H(\text{上课}) = \frac{44(1-p_H)}{30}" />
                  </div>
                  <div className="formula-chip is-flame">
                    <span>翘课：<MathTex tex="K=18+X,\ \bar{q}_H(\text{翘课})=\frac{12-11p_H}{30}" /></span>
                    <MathTex display tex="U_H(\text{翘课}) = \frac{30+110p_H}{30}" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step >= 3 && (
            <motion.div
              className={`deriv-card ${step === 3 ? 'is-focus' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="deriv-num">Step 3</span>
              <div className="deriv-content">
                <b>无差异条件：<MathTex tex="U_H(\text{上课}) = U_H(\text{翘课})" /></b>
                <p>
                  <MathTex tex="44(1-p_H) = 30+110p_H \;\Rightarrow\; 14 = 154p_H \;\Rightarrow\;" />{' '}
                  <b className="highlight-sun"><MathTex tex="p_H = \frac{1}{11} \approx 9.1\%" /></b>（翘课 <b>90.9%</b>，<MathTex tex="U_H=\tfrac{4}{3}\approx 1.33" />）
                </p>
              </div>
            </motion.div>
          )}

          {step >= 4 && (
            <motion.div
              className={`deriv-card is-verified ${step === 4 ? 'is-focus' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="deriv-num">Step 4</span>
              <div className="deriv-content">
                <b>反向验证 <MathTex tex="L" /> 型（最佳反应）</b>
                <p>
                  <MathTex tex="Y \sim B(12,\tfrac{1}{11}),\ \mathbb{E}[Y]=\tfrac{12}{11}" />；由{' '}
                  <b className="tone-mint">4.45</b> &gt; <b className="tone-flame">1.03</b> 知 <MathTex tex="p_L=1" /> 成立。
                </p>
                <div className="formula-pair">
                  <div className="formula-chip is-mint">
                    <span>上课：<MathTex tex="\bar{q}=\tfrac{12-12/11}{30}=\tfrac{4}{11}" /></span>
                    <MathTex display tex="U_L(\text{上课})=7\bar{q}+3(1-\bar{q})=\tfrac{49}{11}\approx 4.45" />
                  </div>
                  <div className="formula-chip is-flame">
                    <span>翘课：<MathTex tex="\bar{q}=\tfrac{13-12/11}{30}=\tfrac{131}{330}" /></span>
                    <MathTex display tex="U_L(\text{翘课})=-5\bar{q}+5(1-\bar{q})\approx 1.03" />
                  </div>
                </div>
              </div>
              <span className="verified-stamp">均衡成立</span>
            </motion.div>
          )}
        </div>
      </div>

      <div className="slide-math-right panel">
        <div className="slide-panel-head">
          <h3>H 型期望收益交点图</h3>
          <button type="button" className="btn btn-sun btn-small" onClick={snapToEq}>
            <IconSpark /> 吸附均衡点 9.1%
          </button>
        </div>

        <div className="chart-stage">
          <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="H 型上课与翘课期望收益曲线">
            {/* Grid lines */}
            {[0, 1, 2, 3, 4, 5].map((v) => (
              <g key={v}>
                <line x1={pad.l} y1={yOf(v)} x2={W - pad.r} y2={yOf(v)} className={`chart-grid ${v === 0 ? 'is-zero' : ''}`} />
                <text x={pad.l - 8} y={yOf(v) + 4} textAnchor="end" className="chart-axis">{v}</text>
              </g>
            ))}
            {[0, 25, 50, 75, 100].map((v) => (
              <text key={v} x={xOf(v / 100)} y={H - 8} textAnchor="middle" className="chart-axis">{v}%</text>
            ))}

            {/* Curves */}
            <line
              x1={xOf(0)}
              y1={yOf(44 / 30)}
              x2={xOf(1)}
              y2={yOf(0)}
              className="chart-line is-mint"
            />
            <line
              x1={xOf(0)}
              y1={yOf(1)}
              x2={xOf(1)}
              y2={yOf(140 / 30)}
              className="chart-line is-flame"
            />

            {/* Equilibrium point */}
            <circle cx={eqX} cy={eqY} r={atEq ? 9 : 5} className={`chart-eq-halo ${atEq ? 'is-hit' : ''}`} />
            <circle cx={eqX} cy={eqY} r={4} className="chart-eq-dot" />

            {/* Current cursor vertical */}
            <line x1={curX} y1={pad.t} x2={curX} y2={H - pad.b} className="chart-cursor" />
            <circle cx={curX} cy={curYAttend} r={5} className="chart-dot is-mint" />
            <circle cx={curX} cy={curYSkip} r={5} className="chart-dot is-flame" />
          </svg>

          <span
            className="chart-tex-label tone-flame"
            style={{ left: `${(xOf(0.68) / W) * 100}%`, top: `${(yOf(4.55) / H) * 100}%` }}
          >
            <MathTex tex="U_H(\text{翘课})" />
          </span>
          <span
            className="chart-tex-label tone-mint"
            style={{ left: `${(xOf(0.74) / W) * 100}%`, top: `${(yOf(1.12) / H) * 100}%` }}
          >
            <MathTex tex="U_H(\text{上课})" />
          </span>
        </div>

        <label className="scale-slider">
          <span><MathTex tex="H" /> 型上课概率 <MathTex tex="p_H" /></span>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pPct}
            onChange={(e) => setPPct(Number(e.target.value))}
          />
          <b className="num">{pPct.toFixed(1)}%</b>
        </label>

        <div className="live-payoff-readout">
          <div className={stats.uHAttend >= stats.uHSkip - 0.02 ? 'is-win' : ''}>
            <span><MathTex tex="U_H(\text{上课})" /></span>
            <b className="num tone-mint">{stats.uHAttend.toFixed(2)}</b>
            <small><MathTex tex="\bar{q}_H(\text{上课})" /> = {(stats.eqAttendH * 100).toFixed(1)}%</small>
          </div>
          <div className={stats.uHSkip >= stats.uHAttend - 0.02 ? 'is-win' : ''}>
            <span><MathTex tex="U_H(\text{翘课})" /></span>
            <b className="num tone-flame">{stats.uHSkip.toFixed(2)}</b>
            <small><MathTex tex="\bar{q}_H(\text{翘课})" /> = {(stats.eqSkipH * 100).toFixed(1)}%</small>
          </div>
          <div>
            <span><MathTex tex="L" /> 验算（<span className="tone-mint">去</span> <i className="vs-sep">vs</i> <span className="tone-flame">翘</span>）</span>
            <b className="num">
              <span className="tone-mint">{stats.uLAttend.toFixed(2)}</span>
              <i className="vs-sep">vs</i>
              <span className="tone-flame">{stats.uLSkip.toFixed(2)}</span>
            </b>
            <small>{stats.uLAttend > stats.uLSkip ? <><MathTex tex="L" /> 稳去上课</> : <><MathTex tex="L" /> 会动摇</>}</small>
          </div>
        </div>

        <p className={`chart-hint ${atEq ? 'is-eq' : ''}`}>
          {atEq ? (
            <>
              均衡点 <MathTex tex="p_H=\tfrac{1}{11}\approx 9.1\%" />：<MathTex tex="H" /> 去 / 翘同为 <b>1.33</b> 分（30 人小班下个人翘课会推高 <MathTex tex="q" />，均衡收益略低于大班近似）。
            </>
          ) : p < PROB_EX_EQ_P ? (
            <>
              <MathTex tex="p_H" /> 偏低 → <MathTex tex="q" /> 偏高 → <MathTex tex="H" /> 上课更赚，<MathTex tex="p_H" /> 上移
            </>
          ) : (
            <>
              <MathTex tex="p_H" /> 偏高 → <MathTex tex="q" /> 偏低 → <MathTex tex="H" /> 翘课更香，<MathTex tex="p_H" /> 下移
            </>
          )}
        </p>

        {probCompare && (
          <div className="room-compare-strip">
            <span>
              本教室第 {probCompare.round} 局概率点名（<MathTex tex={`N=${probCompare.n}`} />）
            </span>
            <b className="num">
              {probCompare.hAttendRate !== null && (
                <>
                  <MathTex tex="H" /> 实测去课 {(probCompare.hAttendRate * 100).toFixed(1)}% ({probCompare.hAttend}/{probCompare.hTotal}) vs 本班理论 <MathTex tex="p_H" /> {(probCompare.theoryPH * 100).toFixed(1)}% ·{' '}
                </>
              )}
              点名率 {(probCompare.q * 100).toFixed(0)}%
            </b>
          </div>
        )}
      </div>
    </div>
  );
}
