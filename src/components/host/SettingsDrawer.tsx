import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { IconBed, IconBell, IconClose, IconCopy, IconDice, IconSun } from '../Icons';
import { TheoryCard } from '../TheoryCard';
import { GameModeSwitch } from './GameModeSwitch';
import { modeLabel } from '../../lib/format';
import { play } from '../../lib/sound';
import type { DealMode, GameMode, HostState, Mode, Settings, TheoryDisplay } from '../../lib/types';

const MODE_OPTIONS: Array<{ id: Mode; name: string; icon: typeof IconBell; sub: string }> = [
  { id: 'must', name: '必点', icon: IconBell, sub: '100% 点名' },
  { id: 'never', name: '必不点', icon: IconBed, sub: '0% 点名' },
  { id: 'prob', name: '概率点名', icon: IconDice, sub: '点名率 = 翘课率' },
  { id: 'threshold', name: '阈值点名', icon: IconSun, sub: '跌破警戒线才点' },
];

const MOODS = [
  { value: 90, label: '心情极佳', q: '10%' },
  { value: 70, label: '心情一般', q: '30%' },
  { value: 50, label: '气压极低', q: '50%' },
];

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  state: HostState;
  onChange: (patch: Partial<Settings>) => Promise<unknown>;
  onChangeGameMode: (gameMode: GameMode) => Promise<unknown>;
  onResetScores: () => Promise<unknown>;
  onAddBots: (count: number) => Promise<unknown>;
  onRemoveBots: () => Promise<unknown>;
  teachingEnabled: boolean;
  onToggleTeaching: (enabled: boolean) => void;
  push: (message: string, tone?: 'info' | 'good' | 'error') => void;
}

export function SettingsDrawer({
  open,
  onClose,
  state,
  onChange,
  onChangeGameMode,
  onResetScores,
  onAddBots,
  onRemoveBots,
  teachingEnabled,
  onToggleTeaching,
  push,
}: SettingsDrawerProps) {
  const [draft, setDraft] = useState<Settings>(state.settings);
  const [showPin, setShowPin] = useState(false);
  const [botInput, setBotInput] = useState(6);
  const locked = !['lobby', 'settlement', 'final'].includes(state.status);
  const botCount = state.players.filter((player) => player.bot).length;
  const activeGameMode = state.nextGameMode ?? state.gameMode;
  const rollcall = activeGameMode === 'rollcall';
  const canSwitchGameMode = !locked;

  useEffect(() => {
    setDraft(state.settings);
  }, [
    state.settings.mode,
    state.settings.h,
    state.settings.dealMode,
    state.settings.tau,
    state.settings.mood,
    state.settings.duration,
    state.settings.theoryDisplay,
    state.settings.skipPass,
  ]);

  const set = (patch: Partial<Settings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(patch).catch((err: unknown) => {
      setDraft(state.settings);
      push(err instanceof Error ? err.message : String(err), 'error');
    });
  };

  const copyPin = () => {
    navigator.clipboard?.writeText(state.pin);
    push('PIN 已复制', 'good');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="drawer-backdrop"
            aria-label="关闭设置"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="settings-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            aria-label="主持人设置"
          >
            <header className="drawer-head">
              <div>
                <p className="stage-kicker">讲台控制台</p>
                <h2 className="display">调整规则</h2>
              </div>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭设置">
                <IconClose />
              </button>
            </header>

            {locked && (
              <div className="drawer-lock">
                这局正在进行中，规则已锁定。
              </div>
            )}

            <div className={`drawer-body ${locked ? 'is-locked' : ''}`}>
              <fieldset className="setting-block">
                <legend>教学模式</legend>
                <label className="switch-row">
                  <span>
                    <b>展示课堂 PPT</b>
                  </span>
                  <input
                    type="checkbox"
                    checked={teachingEnabled}
                    onChange={(e) => onToggleTeaching(e.target.checked)}
                  />
                </label>
              </fieldset>

              <fieldset className="setting-block" disabled={!canSwitchGameMode}>
                <legend>{state.status === 'lobby' ? '本局玩法' : '下一局玩法'}</legend>
                <GameModeSwitch
                  current={state.gameMode}
                  pending={state.nextGameMode}
                  onChange={(gameMode) => {
                    play('click');
                    onChangeGameMode(gameMode).catch((err: unknown) => {
                      push(err instanceof Error ? err.message : String(err), 'error');
                    });
                  }}
                  disabled={!canSwitchGameMode}
                />
                <p className="setting-hint">
                  {state.status === 'lobby'
                    ? '开局前先选玩法；开跑后本局锁定，结算后能换。'
                    : canSwitchGameMode
                      ? '本局账单不变；点“再来一局”后按新玩法发牌。'
                      : '每局结算后可以换玩法，本局进行中先锁定。'}
                </p>
              </fieldset>

              <fieldset className="setting-block" disabled={locked}>
                <legend>点名模式</legend>
                <div className="mode-options">
                  {MODE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const name =
                      rollcall && option.id === 'must'
                        ? '首轮必点'
                        : rollcall && option.id === 'never'
                          ? '首轮不点'
                          : option.name;
                    const sub =
                      rollcall && option.id === 'must'
                        ? '第一堂必点，第二堂看情况'
                        : rollcall && option.id === 'never'
                          ? '第一堂放行，第二堂再算账'
                          : option.sub;
                    return (
                      <button
                        type="button"
                        key={option.id}
                        className={`mode-option ${draft.mode === option.id ? 'is-active' : ''}`}
                        onClick={() => {
                          play('click');
                          set({ mode: option.id });
                        }}
                        aria-pressed={draft.mode === option.id}
                      >
                        <Icon />
                        <span>
                          <b>{name}</b>
                          <small>{sub}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="setting-block" disabled={locked}>
                <legend>
                  困难户比例
                  <b className="num">{draft.h}%</b>
                </legend>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={draft.h}
                  onChange={(e) => set({ h: Number(e.target.value) })}
                  className="range"
                  aria-label="困难户比例"
                />
                <div className="range-scale"><span>全员自律</span><span>全员困难</span></div>
                <p className="setting-hint">
                  {(draft.dealMode ?? 'fixed') === 'fixed'
                    ? `固定牌库：按当前在线 ${state.onlineCount} 人，恰好发出 ${Math.round((state.onlineCount * draft.h) / 100)} 位困难户、${state.onlineCount - Math.round((state.onlineCount * draft.h) / 100)} 位自律人。`
                    : `独立抽取：每人独立以 ${draft.h}% 概率抽到困难户，按当前在线 ${state.onlineCount} 人预计约 ${Math.round((state.onlineCount * draft.h) / 100)} 位困难户。`}
                </p>
              </fieldset>

              <fieldset className="setting-block" disabled={locked}>
                <legend>发牌方式</legend>
                <div className="segmented">
                  {([
                    ['fixed', '固定牌库'],
                    ['independent', '独立抽取'],
                  ] as Array<[DealMode, string]>).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={(draft.dealMode ?? 'fixed') === value ? 'is-active' : ''}
                      onClick={() => {
                        play('click');
                        set({ dealMode: value });
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="setting-hint">
                  {(draft.dealMode ?? 'fixed') === 'fixed'
                    ? '先按比例配好固定数量身份牌再洗牌发放，两类身份人数精确可控。'
                    : '每位同学独立按比例掷骰子抽身份，小样本下实际困难户人数会有随机波动。'}
                </p>
              </fieldset>

              {draft.mode === 'threshold' && (
                <>
                  <fieldset className="setting-block" disabled={locked}>
                    <legend>
                      出勤率警戒线
                      <b className="num">{draft.tau}%</b>
                    </legend>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={draft.tau}
                      onChange={(e) => set({ tau: Number(e.target.value) })}
                      className="range"
                      aria-label="出勤率阈值"
                    />
                    <div className="range-scale"><span>宽松（容易过关）</span><span>严苛（极易触发）</span></div>
                  </fieldset>

                  <fieldset className="setting-block" disabled={locked}>
                    <legend>老师心情</legend>
                    <div className="mood-options">
                      {MOODS.map((mood) => (
                        <button
                          type="button"
                          key={mood.value}
                          className={`mood-option ${draft.mood === mood.value ? 'is-active' : ''}`}
                          onClick={() => {
                            play('click');
                            set({ mood: mood.value });
                          }}
                          aria-pressed={draft.mood === mood.value}
                        >
                          <b className="num">{mood.value}</b>
                          <span>{mood.label}</span>
                          <small>点名概率 {mood.q}</small>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}

              <fieldset className="setting-block" disabled={locked}>
                <legend>
                  每轮时长
                  <b className="num">{draft.duration}s</b>
                </legend>
                <input
                  type="range"
                  min="15"
                  max="180"
                  step="5"
                  value={draft.duration}
                  onChange={(e) => set({ duration: Number(e.target.value) })}
                  className="range"
                  aria-label="每轮时长"
                />
              </fieldset>

              {activeGameMode === 'base' && (
                <>
                  <fieldset className="setting-block" disabled={locked}>
                    <legend>教师参考 · 理论卡</legend>
                    <div className="segmented">
                      {([
                        ['off', '先藏着'],
                        ['status', '只看结论'],
                        ['full', '完整推演'],
                      ] as Array<[TheoryDisplay, string]>).map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={draft.theoryDisplay === value ? 'is-active' : ''}
                          onClick={() => set({ theoryDisplay: value })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {state.theory && draft.theoryDisplay !== 'off' && (
                    <div className="drawer-theory">
                      <TheoryCard theory={state.theory} level={draft.theoryDisplay} compact />
                    </div>
                  )}
                </>
              )}

              {activeGameMode === 'base' && (draft.mode === 'prob' || draft.mode === 'threshold') && (
                <fieldset className="setting-block" disabled={locked}>
                  <legend>随缘翘课签</legend>
                  <label className="switch-row">
                    <span>
                      <b>允许纠结党按均衡概率摇签</b>
                      <small>仅对需要打混合策略的身份开放。按当前班级的理论均衡概率摇签，结果仅自己可见。</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.skipPass}
                      onChange={(e) => set({ skipPass: e.target.checked })}
                    />
                  </label>
                </fieldset>
              )}

              <div className="drawer-divider" />

              <div className="host-credentials">
                <div>
                  <span className="fine">房间码</span>
                  <b className="mono">{state.code}</b>
                </div>
                <div>
                  <span className="fine">主持人 PIN</span>
                  <span className="pin-row">
                    <b className="mono">{showPin ? state.pin : '••••'}</b>
                    <button type="button" className="text-btn" onClick={() => setShowPin((v) => !v)}>
                      {showPin ? '藏起来' : '显示'}
                    </button>
                    <button type="button" className="text-btn" onClick={copyPin}>
                      <IconCopy /> 复制
                    </button>
                  </span>
                </div>
              </div>
              <p className="setting-hint warning">提示：投影到大屏时建议先收起此面板，免得把主持人 PIN 现场直播给全班。</p>

              <button
                type="button"
                className="btn btn-ghost reset-scores"
                disabled={locked}
                onClick={() => {
                  if (window.confirm('确定要把全班同学的累计积分清零吗？房间和已玩局数会保留。')) {
                    onResetScores().then(() => push('积分已清零', 'good')).catch((err: unknown) => push(err instanceof Error ? err.message : String(err), 'error'));
                  }
                }}
              >
                清空全班累计积分
              </button>

              <details className="test-tools">
                <summary>
                  <span>测试工具</span>
                  <span className="test-tools-meta">彩排用</span>
                </summary>
                <div className="test-tools-body">
                  <p className="setting-hint">机器人会按当前规则自动行动，只用来彩排大屏流程。</p>
                  <div className="bot-control">
                    <label className="bot-amount" htmlFor="bot-count">
                      <span>数量</span>
                      <span className="bot-input-wrap">
                        <input
                          id="bot-count"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          value={botInput}
                          onChange={(e) => setBotInput(Math.max(1, Math.min(50, Number(e.target.value.replace(/\D/g, '')) || 1)))}
                        />
                      </span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-sun btn-small"
                      onClick={() => {
                        onAddBots(botInput)
                          .then((res) => {
                            const count = (res as { count?: number } | null)?.count ?? botInput;
                            push(`已加入 ${count} 个机器人`, 'good');
                          })
                          .catch((err: unknown) => push(err instanceof Error ? err.message : String(err), 'error'));
                      }}
                    >
                      加入
                    </button>
                  </div>
                  <div className="bot-foot">
                    <span className="fine">{botCount > 0 ? `房间里已有 ${botCount} 个` : '还没有机器人'}</span>
                    {botCount > 0 && (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => {
                          onRemoveBots()
                            .then((res) => {
                              const count = (res as { count?: number } | null)?.count ?? botCount;
                              push(`已移除 ${count} 个机器人`, 'good');
                            })
                            .catch((err: unknown) => push(err instanceof Error ? err.message : String(err), 'error'));
                        }}
                      >
                        清空机器人
                      </button>
                    )}
                  </div>
                </div>
              </details>
            </div>

            <footer className="drawer-foot">
              <span>当前：{modeLabel(draft.mode)} · 困难户 {draft.h}%</span>
              <button type="button" className="btn btn-sun btn-small" onClick={onClose}>收起</button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
