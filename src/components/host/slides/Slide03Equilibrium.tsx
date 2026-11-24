import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { IconScale, IconSpark } from '../../Icons';
import { MathTex } from '../../MathTex';
import { play } from '../../../lib/sound';
import type { Action } from '../../../lib/types';

export function Slide03Equilibrium() {
  const [stratL, setStratL] = useState<Action>('attend');
  const [stratH, setStratH] = useState<Action | 'mixed'>('skip');
  const [qSlider, setQSlider] = useState(0.4);
  const [showPurify, setShowPurify] = useState(false);

  // Large-class intuition at P(H) = 40%, q = skipRate
  const hFrac = 0.4;
  const simQ =
    stratH === 'mixed'
      ? 5 / 14
      : (stratL === 'skip' ? 1 - hFrac : 0) + (stratH === 'skip' ? hFrac : 0);

  const lAttend = 7 * simQ + 3 * (1 - simQ);
  const lSkip = -5 * simQ + 5 * (1 - simQ);
  const hAttend = 4 * simQ;
  const hSkip = -5 * simQ + 5 * (1 - simQ);

  const lWantsDeviate = stratL === 'attend' ? lSkip > lAttend + 1e-6 : lAttend > lSkip + 1e-6;
  const hWantsDeviate =
    stratH === 'mixed'
      ? false
      : stratH === 'attend'
        ? hSkip > hAttend + 1e-6
        : hAttend > hSkip + 1e-6;

  const isEq = !lWantsDeviate && !hWantsDeviate;

  const verdict = isEq ? (
    <>
      <MathTex tex="L" /> 稳去（<MathTex tex="p_L=1" />）、<MathTex tex="H" /> 两边扯平 → 无人愿单方面偏离
    </>
  ) : stratL === 'attend' && stratH === 'attend' ? (
    <>
      <MathTex tex="\bar{q}=0\%" /> 不点名 → 翘课 +5 更赚 → 全员反悔
    </>
  ) : stratL === 'skip' && stratH === 'skip' ? (
    <>
      <MathTex tex="\bar{q}=100\%" /> 必点名 → 翘课 -5 血亏 → 全员反悔
    </>
  ) : stratL === 'attend' && stratH === 'skip' ? (
    <>
      <MathTex tex="\bar{q}=40\% > 35.7\%" /> → <MathTex tex="H" /> 上课 +1.6 &gt; 翘课 +1.0 → <MathTex tex="H" /> 反悔
    </>
  ) : (
    <>
      <MathTex tex="L" /> 成本更低却翘课 → <MathTex tex="L" /> 立刻反悔去上课
    </>
  );

  // Interactive scale (indifference principle for H)
  const scaleAttend = 4 * qSlider;
  const scaleSkip = 5 - 10 * qSlider;
  const diff = scaleSkip - scaleAttend; // positive -> skip heavier (tilts right)
  const tiltDeg = Math.max(-14, Math.min(14, diff * 4.5));
  const balanced = Math.abs(diff) < 0.08;

  const snapBalance = () => {
    setQSlider(5 / 14);
    play('safe');
  };

  return (
    <div className="slide-body slide-03">
      <div className="slide-03-left panel">
        <div className="slide-panel-head">
          <h3>策略装配台 · <MathTex tex="s(\text{类型}) \to \text{行动}" /></h3>
          <span className="fine"><MathTex tex="P(H)=40\%,\ q=\text{翘课率}" /></span>
        </div>

        <div className="strategy-switches">
          <div className="strat-card is-l">
            <div className="strat-who">
              <span className="strat-char">醒</span>
              <div>
                <b>如果抽到自律人 (<MathTex tex="L" />)</b>
                <small>上课 +7 / +3 · 翘课 -5 / +5</small>
              </div>
            </div>
            <div className="sim-segmented">
              <button
                type="button"
                className={stratL === 'attend' ? 'is-active tone-mint' : ''}
                onClick={() => {
                  setStratL('attend');
                  play('click');
                }}
              >
                <MathTex tex="s(L)=\text{上课}" />
              </button>
              <button
                type="button"
                className={stratL === 'skip' ? 'is-active tone-flame' : ''}
                onClick={() => {
                  setStratL('skip');
                  if (stratH === 'mixed') setStratH('skip');
                  play('click');
                }}
              >
                <MathTex tex="s(L)=\text{翘课}" />
              </button>
            </div>
          </div>

          <div className="strat-card is-h">
            <div className="strat-who">
              <span className="strat-char">困</span>
              <div>
                <b>如果抽到困难户 (<MathTex tex="H" />)</b>
                <small>上课 +4 / 0 · 翘课 -5 / +5</small>
              </div>
            </div>
            <div className="sim-segmented">
              <button
                type="button"
                className={stratH === 'attend' ? 'is-active tone-mint' : ''}
                onClick={() => {
                  setStratH('attend');
                  play('click');
                }}
              >
                <MathTex tex="s(H)=\text{上课}" />
              </button>
              <button
                type="button"
                className={stratH === 'skip' ? 'is-active tone-flame' : ''}
                onClick={() => {
                  setStratH('skip');
                  play('click');
                }}
              >
                <MathTex tex="s(H)=\text{翘课}" />
              </button>
              <button
                type="button"
                className={stratH === 'mixed' ? 'is-active tone-sun' : ''}
                onClick={() => {
                  setStratL('attend');
                  setStratH('mixed');
                  setQSlider(5 / 14);
                  play('safe');
                }}
              >
                随机混合 (<MathTex tex="p_H" />)
              </button>
            </div>
          </div>
        </div>

        <motion.div
          key={`${stratL}-${stratH}`}
          className={`deviation-box ${isEq ? 'is-eq' : 'is-unstable'}`}
          initial={{ opacity: 0.75, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="deviation-top">
            <span>全班按此策略运行 → 预期点名率 <MathTex tex="\bar{q} =" /> <b className="num">{(simQ * 100).toFixed(1)}%</b></span>
            <span className={`deviation-stamp ${isEq ? 'is-eq' : ''}`}>
              {isEq ? '均衡锁死' : '有人想反悔'}
            </span>
          </div>

          <div className="deviation-bars">
            <div className={lWantsDeviate ? 'is-warn' : ''}>
              <span>自律人 <MathTex tex="L" /></span>
              <b>
                <span className="tone-mint"><MathTex tex={`U_L(\\text{上课}) = ${lAttend.toFixed(2)}`} /></span>
                <i className="vs-sep">vs</i>
                <span className="tone-flame"><MathTex tex={`U_L(\\text{翘课}) = ${lSkip.toFixed(2)}`} /></span>
              </b>
              <em>{lWantsDeviate ? '会反悔' : '稳住'}</em>
            </div>
            <div className={hWantsDeviate ? 'is-warn' : ''}>
              <span>困难户 <MathTex tex="H" /></span>
              <b>
                <span className="tone-mint"><MathTex tex={`U_H(\\text{上课}) = ${hAttend.toFixed(2)}`} /></span>
                <i className="vs-sep">vs</i>
                <span className="tone-flame"><MathTex tex={`U_H(\\text{翘课}) = ${hSkip.toFixed(2)}`} /></span>
              </b>
              <em>{stratH === 'mixed' ? '两边扯平' : hWantsDeviate ? '会反悔' : '稳住'}</em>
            </div>
          </div>

          <p className="deviation-note">{verdict}</p>
        </motion.div>

        <div className="slide-takeaway ticket">
          <span className="takeaway-tag">均衡三条铁律</span>
          <p>按各自底牌算期望 → 每种类型选最优招 → <b>任何类型都不想单方面改主意</b>。</p>
        </div>
      </div>

      <div className="slide-03-right panel">
        <div className="slide-panel-head">
          <h3><IconScale /> 混合策略：无差异天平</h3>
          <button type="button" className="btn btn-sun btn-small" onClick={snapBalance}>
            压平天平 (35.7%)
          </button>
        </div>

        <div className="scale-stage">
          <svg viewBox="0 0 420 185" className="scale-svg" role="img" aria-label="混合策略无差异天平">
            {/* Pillar & Base */}
            <path d="M165 168h90M210 52v116" className="scale-pillar" />
            <circle cx={210} cy={52} r={8} className={`scale-pivot ${balanced ? 'is-balanced' : ''}`} />

            {/* Rotating Beam */}
            <motion.g
              animate={{ rotate: tiltDeg }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              style={{ transformOrigin: '210px 52px' }}
            >
              <line x1={85} y1={52} x2={335} y2={52} className={`scale-beam ${balanced ? 'is-balanced' : ''}`} />
              {/* Left pan: Attend */}
              <line x1={92} y1={52} x2={92} y2={106} className="scale-rope" />
              <rect x={42} y={106} width={100} height={46} rx={12} className="scale-pan pan-attend" />
              <text x={92} y={125} textAnchor="middle" className="pan-label">H 上课期望</text>
              <text x={92} y={143} textAnchor="middle" className="pan-val">{scaleAttend.toFixed(2)} 分</text>

              {/* Right pan: Skip */}
              <line x1={328} y1={52} x2={328} y2={106} className="scale-rope" />
              <rect x={278} y={106} width={100} height={46} rx={12} className="scale-pan pan-skip" />
              <text x={328} y={125} textAnchor="middle" className="pan-label">H 翘课期望</text>
              <text x={328} y={143} textAnchor="middle" className="pan-val">{scaleSkip.toFixed(2)} 分</text>
            </motion.g>
          </svg>

          <label className="scale-slider">
            <span>试调点名概率 <MathTex tex="\bar{q}" /></span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={Number((qSlider * 100).toFixed(1))}
              onChange={(e) => setQSlider(Number(e.target.value) / 100)}
            />
            <b className="num">{(qSlider * 100).toFixed(1)}%</b>
          </label>

          <p className={`scale-status ${balanced ? 'is-balanced' : ''}`}>
            {balanced ? (
              <>
                天平水平（大班近似）：<MathTex tex="U_H(\text{上课}) = U_H(\text{翘课}) \approx 1.43" /> 分 → 愿意随机
              </>
            ) : diff > 0 ? (
              <>翘课更赚 → <MathTex tex="H" /> 直接 100% 翘课</>
            ) : (
              <>上课更赚 → <MathTex tex="H" /> 直接 100% 上课</>
            )}
          </p>
        </div>

        <div className="myth-box">
          <b>常见误区：什么相等？</b>
          <div className="myth-pair">
            <span>不是：人与人平均分相等（<MathTex tex="L" /> 仍高于 <MathTex tex="H" />）</span>
            <span><b>而是：同一人「<span className="tone-mint">去</span>」与「<span className="tone-flame">翘</span>」的期望相等</b></span>
          </div>
        </div>

        <div className="purify-drawer">
          <button
            type="button"
            className="purify-toggle"
            onClick={() => {
              setShowPurify((v) => !v);
              play('click');
            }}
          >
            <IconSpark />
            <span>{showPurify ? '收起 · 海萨尼净化定理' : '现实里没人掷骰子，怎么理解随机？'}</span>
          </button>
          <AnimatePresence>
            {showPurify && (
              <motion.p
                className="purify-body"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <b>海萨尼净化定理</b>：个人按微小私人状态打纯策略，在外人眼里统计等价于混合概率。
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
