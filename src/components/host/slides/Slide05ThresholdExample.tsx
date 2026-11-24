import confetti from 'canvas-confetti';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { IconCheck, IconSpark } from '../../Icons';
import { MathTex } from '../../MathTex';
import {
  binomPmf,
  compareRoundWithTheory,
  SLIDES,
  THRESHOLD_EX_EQ_P,
  thresholdExamplePayoffs,
} from '../../../lib/teaching';
import { play } from '../../../lib/sound';
import type { HostState } from '../../../lib/types';

interface Slide05Props {
  step: number;
  onStep: (next: number) => void;
  onJumpSlide: (index: number) => void;
  roomState?: HostState | null;
}

const STEP_ITEMS: Array<{ key: string; label: ReactNode }> = [
  { key: '1', label: '1. 21 人悬崖线' },
  { key: '2', label: <>2. 关键一票 <MathTex tex="X=2" /></> },
  { key: '3', label: '3. 数值解 14.5%' },
  { key: '4', label: <>4. 验算 <MathTex tex="L" /> &amp; 总结</> },
];

export function Slide05ThresholdExample({ step, onStep, onJumpSlide, roomState }: Slide05Props) {
  const [pPct, setPPct] = useState(14.465);
  const [showThink, setShowThink] = useState(false);
  const reduce = useReducedMotion();
  const p = pPct / 100;
  const stats = thresholdExamplePayoffs(p);
  const atEq = Math.abs(p - THRESHOLD_EX_EQ_P) < 0.008;

  const thresholdHistory = (roomState?.history ?? []).filter((h) => h.mode === 'threshold');
  const latestThreshold = thresholdHistory.length ? thresholdHistory[thresholdHistory.length - 1] : null;
  const thresholdCompare = latestThreshold ? compareRoundWithTheory(latestThreshold) : null;

  // Binomial(11, p) buckets: 0, 1, 2, 3, 4, 5+
  const buckets = [0, 1, 2, 3, 4].map((k) => ({
    key: String(k),
    tex: `X=${k}`,
    prob: binomPmf(11, k, p),
    zone: k <= 1 ? 'danger' : k === 2 ? 'pivot' : 'safe',
  }));
  const tailProb = Math.max(0, 1 - buckets.reduce((sum, b) => sum + b.prob, 0));
  buckets.push({ key: '5+', tex: 'X\\ge 5', prob: tailProb, zone: 'safe' });

  const maxProb = Math.max(0.42, ...buckets.map((b) => b.prob));

  const snapToEq = () => {
    setPPct(14.465);
    if (step < 3) onStep(3);
    play('safe');
    if (!reduce) {
      confetti({
        particleCount: 55,
        spread: 65,
        startVelocity: 26,
        origin: { x: 0.72, y: 0.55 },
        colors: ['#ffbe3d', '#8be6c6', '#ff5a3c', '#fff2d2'],
        disableForReducedMotion: true,
      });
    }
  };

  return (
    <div className="slide-body slide-05">
      <div className="slide-05-main">
        <div className="slide-math-left">
          <div className="setup-strip panel">
            <div className="setup-facts">
              <span>固定牌库 <b><MathTex tex="N=30\ (N_H=12,\ N_L=18)" /></b></span>
              <span>警戒线 <b><MathTex tex="K < 21\ (70\%)" /></b></span>
              <span>规则 <b><MathTex tex="q(K)=0.5\ (K<21),\ 0\ (K\ge 21)" /></b></span>
            </div>
          </div>

          <div className="step-tabs" role="tablist" aria-label="阈值推导步骤">
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
                <b>18 位 <MathTex tex="L" /> 全到，还差 3 人达 21 人线</b>
                <p>
                  候选策略：<b><MathTex tex="L" /> 全去（<MathTex tex="p_L=1" />）· <MathTex tex="H" /> 以 <MathTex tex="p_H" /> 上课</b>，其余 11 名 <MathTex tex="H" />：<MathTex tex="X \sim B(11, p_H)" />。
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
                  <b>关键一票：<MathTex tex="X = 2" /> 时由你决定踩不踩线</b>
                  <div className="formula-pair is-stacked">
                    <div className="formula-chip is-mint">
                      <span>你上课：<MathTex tex="K = 19 + X < 21 \;\Rightarrow\; X \le 1" /></span>
                      <MathTex display tex="U_H(\text{上课}) = 4 \cdot 0.5\,P(X \le 1) = 2P(X \le 1)" />
                    </div>
                    <div className="formula-chip is-flame">
                      <span>你翘课：<MathTex tex="K = 18 + X < 21 \;\Rightarrow\; X \le 2" /></span>
                      <MathTex
                        display
                        tex="U_H(\text{翘课}) = (-5)\cdot 0.5P(X \le 2) + 5\big[1 - 0.5P(X \le 2)\big] = 5\big[1 - P(X \le 2)\big]"
                      />
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
                  <b>二项分布无差异方程（数值解）</b>
                  <p>
                    <MathTex tex="2P(X \le 1) = 5\big[1 - P(X \le 2)\big] \;\Rightarrow\;" />{' '}
                    <b className="highlight-sun"><MathTex tex="p_H \approx 14.5\%\ (0.14465)" /></b>（翘课 <b>85.5%</b>，<MathTex tex="U_H\approx 1.03" />）
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
                    <MathTex tex="Y \sim B(12, 0.14465)" />；由{' '}
                    <b className="tone-mint">4.51</b> &gt; <b className="tone-flame">0.41</b> 知 <MathTex tex="p_L=1" /> 成立。
                  </p>
                  <div className="formula-pair">
                    <div className="formula-chip is-mint">
                      <span>上课：<MathTex tex="Y\le 2,\ \bar{q}=0.5P(Y\le 2)\approx 0.377" /></span>
                      <MathTex display tex="U_L(\text{上课})=7\bar{q}+3(1-\bar{q})\approx 4.51" />
                    </div>
                    <div className="formula-chip is-flame">
                      <span>翘课：<MathTex tex="Y\le 3,\ \bar{q}=0.5P(Y\le 3)\approx 0.459" /></span>
                      <MathTex display tex="U_L(\text{翘课})=-5\bar{q}+5(1-\bar{q})\approx 0.41" />
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
            <h3>二项分布悬崖沙盘 · <MathTex tex="X \sim B(11, p_H)" /></h3>
            <button type="button" className="btn btn-sun btn-small" onClick={snapToEq}>
              <IconSpark /> 吸附数值解 14.5%
            </button>
          </div>

          <div className="binom-legend">
            <span><i className="dot-danger" /> <MathTex tex="X \le 1" /> 必踩线</span>
            <span><i className="dot-pivot" /> <MathTex tex="X = 2" /> 关键一票（你是第 21 人）</span>
            <span><i className="dot-safe" /> <MathTex tex="X \ge 3" /> 已满 21 人</span>
          </div>

          <div className="binom-bars" role="img" aria-label="其他11位困难户上课人数的二项分布柱状图">
            {buckets.map((b) => {
              const heightPct = Math.max(4, (b.prob / maxProb) * 100);
              return (
                <div className={`binom-col zone-${b.zone}`} key={b.key}>
                  <span className="binom-val num">{(b.prob * 100).toFixed(1)}%</span>
                  <div className="binom-track">
                    <motion.div
                      className="binom-fill"
                      animate={{ height: `${heightPct}%` }}
                      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    />
                  </div>
                  <span className="binom-lbl"><MathTex tex={b.tex} /></span>
                  {b.zone === 'pivot' && <span className="pivot-tag">关键票</span>}
                </div>
              );
            })}
          </div>

          <label className="scale-slider">
            <span><MathTex tex="H" /> 型上课概率 <MathTex tex="p_H" /></span>
            <input
              type="range"
              min={0}
              max={60}
              step={0.1}
              value={pPct}
              onChange={(e) => setPPct(Number(e.target.value))}
            />
            <b className="num">{pPct.toFixed(1)}%</b>
          </label>

          <div className="live-payoff-readout">
            <div className={stats.uHAttend >= stats.uHSkip - 0.03 ? 'is-win' : ''}>
              <span><MathTex tex="U_H(\text{上课})" /></span>
              <b className="num tone-mint">{stats.uHAttend.toFixed(2)}</b>
              <small><MathTex tex="P(X\le 1)" /> = {(stats.pXLe1 * 100).toFixed(1)}%</small>
            </div>
            <div className={stats.uHSkip >= stats.uHAttend - 0.03 ? 'is-win' : ''}>
              <span><MathTex tex="U_H(\text{翘课})" /></span>
              <b className="num tone-flame">{stats.uHSkip.toFixed(2)}</b>
              <small><MathTex tex="P(X\le 2)" /> = {(stats.pXLe2 * 100).toFixed(1)}%</small>
            </div>
            <div>
              <span><MathTex tex="L" /> 验算（<span className="tone-mint">去</span> <i className="vs-sep">vs</i> <span className="tone-flame">翘</span>）</span>
              <b className="num">
                <span className="tone-mint">{stats.uLAttend.toFixed(2)}</span>
                <i className="vs-sep">vs</i>
                <span className="tone-flame">{stats.uLSkip.toFixed(2)}</span>
              </b>
              <small>关键票概率 {(stats.pXEq2 * 100).toFixed(1)}%</small>
            </div>
          </div>

          <p className={`chart-hint ${atEq ? 'is-eq' : ''}`}>
            {atEq ? (
              <>
                均衡解 <MathTex tex="p_H \approx 14.5\%" />：<MathTex tex="H" /> 去 / 翘同为 <b>{stats.uHAttend.toFixed(2)}</b> 分（高于概率点名的 9.1%）。
              </>
            ) : p < THRESHOLD_EX_EQ_P ? (
              <>
                <MathTex tex="p_H" /> 偏低 → 踩线概率高 → <MathTex tex="H" /> 上课更赚
              </>
            ) : (
              <>
                <MathTex tex="p_H" /> 偏高 → 大概率满 21 人 → <MathTex tex="H" /> 更想搭便车翘课
              </>
            )}
          </p>

          <div className="think-drawer">
            <button
              type="button"
              className="purify-toggle"
              onClick={() => {
                setShowThink((v) => !v);
                play('click');
              }}
            >
              <IconSpark />
              <span>
                {showThink ? (
                  '收起 · 纯策略分离均衡'
                ) : (
                  <>如果班里只有 <MathTex tex="N_H=5" /> 位困难户，还会出现混合策略吗？</>
                )}
              </span>
            </button>
            <AnimatePresence>
              {showThink && (
                <motion.p
                  className="purify-body"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <b>不会</b>：即使 5 位 <MathTex tex="H" /> 全翘，概率点名下 <MathTex tex="q=\tfrac{5}{30}\approx 16.7\%" />，仍有 <MathTex tex="U_H(\text{翘课})\approx 3.33 > U_H(\text{上课})\approx 0.67" />，退化为<b>纯策略分离均衡</b>（<MathTex tex="p_L=1,\ p_H=0" />）。
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {thresholdCompare && (
            <div className="room-compare-strip">
              <span>
                本教室第 {thresholdCompare.round} 局阈值点名（<MathTex tex={`N=${thresholdCompare.n}`} />）
              </span>
              <b className="num">
                {thresholdCompare.hAttendRate !== null && (
                  <>
                    <MathTex tex="H" /> 实测去课 {(thresholdCompare.hAttendRate * 100).toFixed(1)}% ({thresholdCompare.hAttend}/{thresholdCompare.hTotal}) vs 本班理论 <MathTex tex="p_H" /> {(thresholdCompare.theoryPH * 100).toFixed(1)}% ·{' '}
                  </>
                )}
                点名率 {(thresholdCompare.q * 100).toFixed(0)}%
              </b>
            </div>
          )}
        </div>
      </div>

      <footer className="logic-arc panel" aria-label="五页完整逻辑脉络">
        <span className="logic-arc-title">五页逻辑闭环</span>
        <div className="logic-arc-steps">
          {SLIDES.map((s, idx) => (
            <button
              key={s.num}
              type="button"
              className={`logic-arc-node ${idx === 4 ? 'is-current' : ''}`}
              onClick={() => {
                onJumpSlide(idx);
                play('click');
              }}
            >
              <b className="mono">{s.num}</b>
              <span>{s.short}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
