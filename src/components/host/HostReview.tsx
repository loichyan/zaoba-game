import { motion } from 'motion/react';
import { IconArrow, IconCheck, IconClose, IconSpark } from '../Icons';
import { signed } from '../../lib/format';
import type { HostState } from '../../lib/types';

interface HostReviewProps {
  state: HostState;
  onSettle: () => void;
  busy: boolean;
}

export function HostReview({ state, onSettle, busy }: HostReviewProps) {
  const cover = state.cover;
  if (!cover?.revealed) return null;
  const caught = cover.reviews.filter((review) => review.caught).length;
  const helped = cover.reviews.filter((review) => review.choice === 'help' && !review.caught).length;
  const declined = cover.reviews.filter((review) => review.choice === 'decline').length;

  return (
    <section className="host-review">
      <header className="review-head">
        <div>
          <p className="stage-kicker">第 {state.round} 局 · 全班亮牌</p>
          <h1 className="display">老师推了推眼镜</h1>
          <p className="review-lede">几张嘴替人答了“到”，几颗心选择了沉默。复查结果，全班一起看。</p>
        </div>
        <div className="review-tally">
          <div><span>演技过关</span><b className="num">{helped}</b></div>
          <div className="is-danger"><span>当场抓包</span><b className="num">{caught}</b></div>
          <div><span>见死不救</span><b className="num">{declined}</b></div>
        </div>
      </header>

      <div className="review-grid">
        <div className="review-list panel">
          <div className="panel-title">
            <h2><IconSpark /> 逐组开奖</h2>
            <span className="fine">选择已经不重要了，老师看的是结果</span>
          </div>
          {cover.reviews.map((review, index) => {
            const outcome = review.choice === 'decline' ? 'declined' : review.caught ? 'caught' : 'success';
            return (
              <motion.div
                className={`review-row is-${outcome}`}
                key={review.teamId}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08, type: 'spring', stiffness: 240, damping: 24 }}
              >
                <span className={`review-mark ${outcome === 'success' ? 'is-good' : outcome === 'caught' ? 'is-bad' : 'is-neutral'}`}>
                  {outcome === 'success' ? <IconCheck /> : outcome === 'caught' ? <IconClose /> : '—'}
                </span>
                <div className="review-main">
                  <b>{review.helperName} <span className="review-for">替</span> {review.absenteeName}</b>
                  <span>{review.choice === 'help' ? (review.caught ? '帮了，但没藏住' : '帮了，演技在线') : '低头装没听见'}</span>
                </div>
                <div className="review-deltas">
                  <span className={review.helperDelta >= 0 ? 'is-plus' : 'is-minus'}>
                    代勤者声誉 {signed(review.helperDelta)}
                  </span>
                  <span className={review.absenteeDelta >= 0 ? 'is-plus' : 'is-minus'}>
                    被点者声誉 {signed(review.absenteeDelta)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <aside className="review-side">
          <div className="review-note panel">
            <span className="stage-kicker">课堂观察</span>
            <h2>高声誉求稳，低声誉敢赌？</h2>
            <p>这一轮谁最敢替人喊“到”，谁又把手缩回去了？看看大屏上的选择分布，答案比公式好玩。</p>
            <div className="review-tier-note">
              <span>被点者声誉档位决定老师复查概率</span>
              <span>代勤者自己的声誉决定这把赌注大小</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="review-actions">
        <button type="button" className="btn btn-sun" onClick={onSettle} disabled={busy}>
          看本局账单 <IconArrow />
        </button>
        <span className="fine">下一局重新抽角色、重新分队，声誉继续带着走。</span>
      </div>
    </section>
  );
}
