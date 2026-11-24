import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { IconDice, IconSpark } from '../../Icons';
import { MathTex } from '../../MathTex';
import { play } from '../../../lib/sound';
import type { RoleType } from '../../../lib/types';

const NESTED_THOUGHTS = [
  '1 阶：我猜同桌 60% 是困难户',
  '2 阶：他以为我猜的是 80%',
  '3 阶：我还要猜“他以为我以为…”',
  '4 阶：无限套娃，写不出方程！',
];

interface DealtHand {
  me: RoleType;
  other: RoleType;
  branch: 'HH' | 'HL' | 'LH' | 'LL';
  id: number;
}

interface Slide02Props {
  step: number;
  onStep: (next: number) => void;
}

export function Slide02Harsanyi({ step, onStep }: Slide02Props) {
  const stage: 'before' | 'after' = step >= 5 ? 'after' : 'before';
  const nestLevel = Math.max(1, Math.min(NESTED_THOUGHTS.length, step));
  const lastBeforeRef = useRef(1);
  const prevStepRef = useRef(step);
  const [pH, setPH] = useState(40);
  const [focusRole, setFocusRole] = useState<RoleType>('H');
  const [dealt, setDealt] = useState<DealtHand | null>(null);

  useEffect(() => {
    if (step <= 4) lastBeforeRef.current = step;
    if (prevStepRef.current !== step) {
      if (step === 4 && prevStepRef.current < 4) play('called');
      else if (step === 5 && prevStepRef.current < 5) play('safe');
      prevStepRef.current = step;
    }
  }, [step]);

  const h = pH / 100;
  const l = 1 - h;
  const branches: Array<{ key: 'HH' | 'HL' | 'LH' | 'LL'; me: RoleType; other: RoleType; prob: number; x: number }> = [
    { key: 'HH', me: 'H', other: 'H', prob: h * h, x: 90 },
    { key: 'HL', me: 'H', other: 'L', prob: h * l, x: 225 },
    { key: 'LH', me: 'L', other: 'H', prob: l * h, x: 375 },
    { key: 'LL', me: 'L', other: 'L', prob: l * l, x: 510 },
  ];

  const dealCards = () => {
    const me: RoleType = Math.random() < h ? 'H' : 'L';
    const other: RoleType = Math.random() < h ? 'H' : 'L';
    const branch = `${me}${other}` as DealtHand['branch'];
    setFocusRole(me);
    setDealt({ me, other, branch, id: Date.now() });
    play('pass');
  };

  return (
    <div className="slide-body slide-02">
      <div className="slide-02-top">
        <div className="stage-switch" role="tablist" aria-label="海萨尼转换前后对比">
          <button
            type="button"
            className={stage === 'before' ? 'is-active' : ''}
            onClick={() => {
              onStep(lastBeforeRef.current);
              play('click');
            }}
          >
            转换前 · 猜疑链套娃
          </button>
          <button
            type="button"
            className={stage === 'after' ? 'is-active' : ''}
            onClick={() => {
              onStep(5);
            }}
          >
            转换后 · 请出「自然」发牌树
          </button>
        </div>

        {stage === 'after' && (
          <div className="harsanyi-controls">
            <label className="inline-slider">
              <span>共同先验 <MathTex tex="P(H)" /></span>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={pH}
                onChange={(e) => setPH(Number(e.target.value))}
              />
              <b className="num">{pH}%</b>
            </label>
            <button type="button" className="btn btn-sun btn-small" onClick={dealCards}>
              <IconDice /> 让「自然」发一轮牌
            </button>
          </div>
        )}
      </div>

      <div className="slide-02-grid">
        <div className="slide-02-stage panel">
          <AnimatePresence mode="wait">
            {stage === 'before' ? (
              <motion.div
                key="before"
                className="nest-arena"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="nest-head">
                  <h3>没有「自然」：各自瞎猜，没有共同起点</h3>
                </div>

                <div className="nest-stack">
                  {NESTED_THOUGHTS.slice(0, nestLevel).map((line, idx) => (
                    <motion.div
                      key={line}
                      className={`nest-bubble level-${idx + 1}`}
                      initial={{ opacity: 0, scale: 0.92, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                    >
                      {line}
                    </motion.div>
                  ))}
                  {nestLevel >= NESTED_THOUGHTS.length && (
                    <motion.div
                      className="nest-stamp stamp"
                      initial={{ scale: 2, opacity: 0, rotate: -14 }}
                      animate={{ scale: 1, opacity: 1, rotate: -6 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                    >
                      数学无解
                    </motion.div>
                  )}
                </div>

                <div className="nest-actions">
                  {nestLevel < NESTED_THOUGHTS.length ? (
                    <button
                      type="button"
                      className="btn btn-flame btn-small"
                      onClick={() => {
                        const next = Math.min(NESTED_THOUGHTS.length, nestLevel + 1);
                        onStep(next);
                        if (next < NESTED_THOUGHTS.length) play('click');
                      }}
                    >
                      再往深猜一层 ({nestLevel}/{NESTED_THOUGHTS.length})
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sun btn-small"
                      onClick={() => {
                        onStep(5);
                      }}
                    >
                      打破死循环 → 请出海萨尼「自然」
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="after"
                className="tree-arena"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="tree-toolbar">
                  <span className="fine">虚线框 = 信息集（只知自己底牌）</span>
                  <div className="sim-segmented">
                    <button
                      type="button"
                      className={focusRole === 'H' ? 'is-active tone-flame' : ''}
                      onClick={() => {
                        setFocusRole('H');
                        play('click');
                      }}
                    >
                      我拿到 困 (<MathTex tex="H" />)
                    </button>
                    <button
                      type="button"
                      className={focusRole === 'L' ? 'is-active tone-mint' : ''}
                      onClick={() => {
                        setFocusRole('L');
                        play('click');
                      }}
                    >
                      我拿到 醒 (<MathTex tex="L" />)
                    </button>
                  </div>
                </div>

                <svg className="harsanyi-svg" viewBox="0 0 600 250" role="img" aria-label="海萨尼转换博弈树">
                  {/* Information Set dashed ellipses */}
                  <motion.rect
                    x="32"
                    y="152"
                    width="250"
                    height="78"
                    rx="38"
                    className={`infoset-ring is-h ${focusRole === 'H' ? 'is-focus' : ''}`}
                    animate={{ opacity: focusRole === 'H' ? 1 : 0.25 }}
                  />
                  <motion.rect
                    x="318"
                    y="152"
                    width="250"
                    height="78"
                    rx="38"
                    className={`infoset-ring is-l ${focusRole === 'L' ? 'is-focus' : ''}`}
                    animate={{ opacity: focusRole === 'L' ? 1 : 0.25 }}
                  />

                  <text x="157" y="244" textAnchor="middle" className={`infoset-caption ${focusRole === 'H' ? 'is-focus-h' : ''}`}>
                    H 型信息集：知道自己是困，分不清同桌是困还是醒
                  </text>
                  <text x="443" y="244" textAnchor="middle" className={`infoset-caption ${focusRole === 'L' ? 'is-focus-l' : ''}`}>
                    L 型信息集：知道自己是醒，分不清同桌是困还是醒
                  </text>

                  {/* Branches from Nature */}
                  {branches.map((b) => {
                    const active = dealt?.branch === b.key;
                    const inFocus = b.me === focusRole;
                    return (
                      <g key={b.key}>
                        <motion.line
                          x1={300}
                          y1={56}
                          x2={b.x}
                          y2={176}
                          className={`tree-edge ${active ? 'is-dealt' : ''} ${inFocus ? 'is-focus' : ''}`}
                          animate={{
                            strokeOpacity: active ? 1 : inFocus ? 0.72 : 0.22,
                            strokeWidth: active ? 3.5 : inFocus ? 2 : 1.4,
                          }}
                        />
                        <rect
                          x={(300 + b.x) / 2 - 24}
                          y={104}
                          width={48}
                          height={22}
                          rx={11}
                          className={`prob-pill-bg ${active ? 'is-dealt' : ''}`}
                        />
                        <text x={(300 + b.x) / 2} y={119} textAnchor="middle" className="prob-pill-text">
                          {Math.round(b.prob * 100)}%
                        </text>

                        <motion.g
                          animate={{ scale: active ? 1.1 : 1 }}
                          style={{ transformOrigin: `${b.x}px 190px` }}
                        >
                          <circle
                            cx={b.x}
                            cy={190}
                            r={26}
                            className={`tree-node node-${b.me.toLowerCase()} ${active ? 'is-dealt' : ''}`}
                          />
                          <text x={b.x} y={187} textAnchor="middle" className="node-code">
                            ({b.me},{b.other})
                          </text>
                          <text x={b.x} y={203} textAnchor="middle" className="node-sub">
                            {b.me === 'H' ? '困' : '醒'}·{b.other === 'H' ? '困' : '醒'}
                          </text>
                        </motion.g>
                      </g>
                    );
                  })}

                  {/* Nature root node */}
                  <g>
                    <circle cx={300} cy={38} r={30} className="tree-root" />
                    <text x={300} y={36} textAnchor="middle" className="tree-root-title">自然</text>
                    <text x={300} y={50} textAnchor="middle" className="tree-root-sub">第 0 步发牌</text>
                  </g>
                </svg>

                <div className="poker-desk">
                  <div className="poker-card is-mine">
                    <span>你的底牌（可见）</span>
                    <b className={focusRole === 'H' ? 'tone-flame' : 'tone-mint'}>
                      {dealt ? (dealt.me === 'H' ? '困 · 困难户' : '醒 · 自律人') : focusRole === 'H' ? '困 · 困难户' : '醒 · 自律人'}
                    </b>
                  </div>
                  <div className="poker-vs">同桌手里</div>
                  <motion.div
                    key={dealt?.id ?? 'idle'}
                    className="poker-card is-other"
                    initial={dealt ? { rotateY: 90, opacity: 0.4 } : false}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <span>对手底牌（盖着）</span>
                    <b>
                      ？ 未知（<span className="tone-flame">{pH}% 困</span>
                      <i className="vs-sep">/</i>
                      <span className="tone-mint">{100 - pH}% 醒</span>）
                    </b>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="slide-02-side">
          <div className="compare-box panel">
            <span className="compare-kicker">核心区分</span>
            <h3>完全 vs 不完美</h3>
            <div className="compare-item is-complete">
              <b>完全信息（规则透明）</b>
              <p>比例（{pH}%/{100 - pH}%）、收益表、点名规则全透明 → <b>同玩一场游戏</b>。</p>
            </div>
            <div className="compare-item is-imperfect">
              <b>不完美信息（动作不可见）</b>
              <p>看不见「自然」发给别人的牌，也看不见他人同时的动作。</p>
            </div>
          </div>

          <div className="slide-takeaway ticket">
            <span className="takeaway-tag"><IconSpark /> 本质</span>
            <p>
              <b>主观猜测 → 客观共识</b>：没有消除未知，而是用公开先验把“各自瞎猜”变成全班公认的共同基准。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
