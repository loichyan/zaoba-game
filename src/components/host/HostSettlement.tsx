import { motion } from 'motion/react';
import { Leaderboard } from '../Leaderboard';
import { ReputationBoard } from '../ReputationBoard';
import { GameModeSwitch } from './GameModeSwitch';
import { ModeSummary, StatBlock } from './widgets';
import { IconArrow, IconBell, IconSettings, IconSpark, IconTrophy, IconUsers } from '../Icons';
import { gameModeLabel, modeLabel, pct, roleLabel, signed } from '../../lib/format';
import type { GameMode, HostState, Result, RoleType } from '../../lib/types';

interface HostSettlementProps {
  state: HostState;
  onNext: () => void;
  onFinal: () => void;
  onOpenSettings: () => void;
  onChangeGameMode: (gameMode: GameMode) => void;
  busy: boolean;
}

function LectureLine({ result, index }: { result: Result; index: number }) {
  return (
    <div className={`lecture-line ${result.called ? 'is-called' : 'is-safe'}`}>
      <span className="lecture-index">第 {index + 1} 堂</span>
      <span>{modeLabel(result.mode)}</span>
      <span>出勤 {pct(result.attendanceRate, 0)}</span>
      <span>{result.called ? '点名' : '没点'}</span>
      <b className="num">{result.avgPayoff > 0 ? '+' : ''}{result.avgPayoff.toFixed(1)}</b>
    </div>
  );
}

export function HostSettlement({
  state,
  onNext,
  onFinal,
  onOpenSettings,
  onChangeGameMode,
  busy,
}: HostSettlementProps) {
  const result = state.result;
  if (!result) return null;
  const { actionCounts, typeCounts } = result;
  const called = result.called;
  const rows: RoleType[] = ['L', 'H'];
  const rollcall = state.gameMode === 'rollcall';
  const coverMode = state.gameMode === 'cover';
  const lectures = state.lectureResults;
  const rollcallAvgAttendance = lectures.length
    ? lectures.reduce((sum, item) => sum + item.attendanceRate, 0) / lectures.length
    : result.attendanceRate;
  const rollcallTotalAvgPayoff = lectures.length
    ? lectures.reduce((sum, item) => sum + item.avgPayoff, 0)
    : result.avgPayoff;
  const cover = result.cover;
  const caught = cover?.reviews.filter((review) => review.caught).length ?? 0;
  const helped = cover?.reviews.filter((review) => review.choice === 'help' && !review.caught).length ?? 0;
  const declined = cover?.reviews.filter((review) => review.choice === 'decline').length ?? 0;

  return (
    <section className="host-settlement">
      <header className="settlement-head">
        <div>
          <p className="stage-kicker">第 {state.round} 局 · 战况复盘</p>
          <h1 className="display">{rollcall ? '两堂账单' : '本局账单'}</h1>
        </div>
        <div className="settlement-actions">
          <button type="button" className="btn btn-ghost btn-small" onClick={onOpenSettings}>
            <IconSettings /> 改规则
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={onFinal} disabled={busy}>下课放榜</button>
          <button type="button" className="btn btn-sun" onClick={onNext} disabled={busy}>
            再来一局 <IconArrow />
          </button>
        </div>
      </header>

      <div className="settlement-grid">
        <div className="settlement-main">
          <div className={`settlement-hero panel ${called ? 'is-called' : 'is-safe'}`}>
            <div className="settlement-hero-mark">
              {called ? <IconBell /> : <IconTrophy />}
              <span>{called ? '点名了' : '没点名'}</span>
            </div>
            <div className="settlement-hero-copy">
              <h2>
                {rollcall
                  ? `第一堂${lectures[0]?.called ? '点了' : '放了'}，第二堂${lectures[1]?.called ? '点了' : '放了'}。`
                  : called
                    ? '花名册一掀，几家欢喜几家愁。'
                    : result.skip === 0
                      ? '全员满勤，老师却没点名——早起的人相视苦笑。'
                      : '老师没点名，被窝党躺赢的一天！'}
              </h2>
              <p>
                {rollcall
                  ? `两堂平均出勤 ${pct(rollcallAvgAttendance, 0)} · 第二堂点名概率 ${pct(result.q, 1)} · 两堂人均合计 ${rollcallTotalAvgPayoff > 0 ? '+' : ''}${rollcallTotalAvgPayoff.toFixed(1)} 分`
                  : `出勤率 ${pct(result.attendanceRate, 0)} · 点名概率 ${pct(result.q, 1)} · 全班人均 ${result.avgPayoff > 0 ? '+' : ''}${result.avgPayoff.toFixed(1)} 分`}
              </p>
            </div>
          </div>

          {rollcall && (
            <div className="lecture-board panel">
              <div className="panel-title">
                <h2><IconSpark /> 两堂流水账</h2>
                <span className="fine">首轮状态决定第二轮点名率</span>
              </div>
              {lectures.map((lecture, index) => <LectureLine key={lecture.lecture} result={lecture} index={index} />)}
            </div>
          )}

          <div className="settlement-stats">
            <StatBlock label={rollcall ? '第二堂到场' : '到场上课'} value={result.attendance} sub={`共 ${result.participantCount} 人参战`} tone="mint" />
            <StatBlock label={rollcall ? '第二堂翘课' : '赖床翘课'} value={result.skip} sub={`翘课率 ${pct(result.skipRate, 0)}`} tone="flame" />
            <StatBlock label={rollcall ? '第二堂点名率' : '点名概率'} value={pct(result.q, 0)} sub={called ? '最终触发点名' : '最终平安放行'} tone="sun" />
          </div>

          {coverMode && cover && (
            <div className="cover-report panel">
              <div className="panel-title">
                <h2><IconUsers /> 代勤战报</h2>
                <span className="fine">点名声落定后，同桌之间的选择题</span>
              </div>
              <div className="cover-report-stats">
                <div><span>演技过关</span><b className="num is-mint">{helped}</b></div>
                <div><span>当场抓包</span><b className="num is-flame">{caught}</b></div>
                <div><span>见死不救</span><b className="num">{declined}</b></div>
              </div>
              <div className="cover-report-list">
                {cover.reviews.map((review) => (
                  <div className="cover-report-row" key={review.teamId}>
                    <span>{review.helperName} <i>替</i> {review.absenteeName}</span>
                    <b className={review.choice === 'help' ? (review.caught ? 'is-flame' : 'is-mint') : 'is-muted'}>
                      {review.choice === 'help' ? (review.caught ? '当场抓包' : '演技过关') : '见死不救'}
                    </b>
                    <span className="num">{signed(review.helperDelta)} / {signed(review.absenteeDelta)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="type-card panel">
            <div className="panel-title">
              <h2>{rollcall ? '第二堂两类人怎么选？' : '两类人分别怎么选？'}</h2>
              <span className="fine">哪怕拿到同一张身份牌，每个人心里的小算盘也不一样</span>
            </div>
            {rows.map((type) => {
              const total = typeCounts[type] || 0;
              const attend = actionCounts[type]?.attend || 0;
              const skip = actionCounts[type]?.skip || 0;
              const ratio = total ? attend / total : 0;
              return (
                <div className={`type-detail type-${type}`} key={type}>
                  <div className="type-detail-head">
                    <span className={`type-dot dot-${type === 'H' ? 'flame' : 'mint'}`} />
                    <b>{roleLabel(type)}</b>
                    <span>{total} 人 · 去 {attend} / 翘 {skip}</span>
                  </div>
                  <div className="type-bar big"><motion.span initial={{ width: 0 }} animate={{ width: `${ratio * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} /></div>
                  <div className="type-detail-foot">
                    {total ? (
                      <>
                        <span>出勤率 {pct(ratio, 0)}</span>
                        <span>翘课率 {pct(1 - ratio, 0)}</span>
                      </>
                    ) : (
                      <span>本局没人抽到这个身份</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="history-panel panel">
            <div className="panel-title">
              <h2>各局走势</h2>
              <span className="fine">最近 6 局记录</span>
            </div>
            <div className="history-table">
              {state.history.slice(-6).reverse().map((item) => (
                <div className="history-row" key={`${item.round}-${item.lecture ?? 0}`}>
                  <span>第 {item.round} 局{item.lecture ? ` · 第 ${item.lecture} 堂` : ''}</span>
                  <span>{modeLabel(item.mode)}</span>
                  <span>出勤 {pct(item.attendanceRate, 0)}</span>
                  <span className={item.called ? 'is-called' : 'is-safe'}>{item.called ? '点名' : '没点'}</span>
                  <b className="num">{item.avgPayoff > 0 ? '+' : ''}{item.avgPayoff.toFixed(1)}</b>
                </div>
              ))}
              {state.history.length === 0 && <p className="empty-note">还没有历史。刚开锅。</p>}
            </div>
          </div>
        </div>

        <aside className="settlement-side">
          <div className="next-game-mode panel">
            <div className="panel-title">
              <h2>下一局玩法</h2>
              <span className="fine">
                {state.nextGameMode ? `已切换为${gameModeLabel(state.nextGameMode)}` : '本局结算后可换'}
              </span>
            </div>
            <GameModeSwitch
              current={state.gameMode}
              pending={state.nextGameMode}
              onChange={onChangeGameMode}
              compact
            />
            <p className="fine next-game-mode-note">
              {state.nextGameMode
                ? '本局账单不变，下一局按新玩法发牌。'
                : '想换玩法，点一下；不换就沿用到下一局。'}
            </p>
          </div>
          <ModeSummary settings={result.settings} compact />
          {coverMode && (
            <ReputationBoard
              entries={state.reputationBoard}
              title="江湖声誉榜"
              limit={10}
              compact
              showValues={false}
            />
          )}
          <div className="settlement-leader panel">
            <Leaderboard entries={state.leaderboard} limit={10} title="生存积分榜" />
          </div>
        </aside>
      </div>
    </section>
  );
}
