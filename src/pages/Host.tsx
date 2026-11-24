import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { IconExpand, IconQr, IconSettings, IconWifi } from '../components/Icons';
import { SoundToggle } from '../components/SoundToggle';
import { ToastStack, useToasts } from '../components/Toast';
import { HostAction } from '../components/host/HostAction';
import { HostCover } from '../components/host/HostCover';
import { HostFinal } from '../components/host/HostFinal';
import { HostLobby } from '../components/host/HostLobby';
import { HostReveal } from '../components/host/HostReveal';
import { HostReview } from '../components/host/HostReview';
import { HostSettlement } from '../components/host/HostSettlement';
import { JoinQrModal } from '../components/host/JoinQrModal';
import { SettingsDrawer } from '../components/host/SettingsDrawer';
import { TeachingBreadcrumb } from '../components/host/TeachingBreadcrumb';
import { TeachingDeck } from '../components/host/slides/TeachingDeck';
import { useHostRoom } from '../lib/useHostRoom';
import { useJoinUrl } from '../lib/useJoinUrl';
import { loadTeachingState, saveTeachingState, SLIDES, type TeachingState } from '../lib/teaching';
import type { RoomStatus, ToastItem } from '../lib/types';
import { gameModeLabel } from '../lib/format';
import { play } from '../lib/sound';

export default function Host() {
  const { code = '' } = useParams();
  const roomCode = code.toUpperCase();
  const host = useHostRoom(roomCode);
  const { toasts, push, dismiss } = useToasts();
  const [drawer, setDrawer] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [teaching, setTeaching] = useState<TeachingState>(() => loadTeachingState(roomCode));
  const { joinUrl, displayUrl, isLocal, lan } = useJoinUrl(roomCode);
  const state = host.state;

  useEffect(() => {
    setTeaching(loadTeachingState(roomCode));
  }, [roomCode]);

  useEffect(() => {
    saveTeachingState(roomCode, teaching);
  }, [roomCode, teaching]);

  useEffect(() => {
    if (state?.status === 'final' || (state?.status === 'lobby' && !teaching.open)) {
      setQrModal(false);
    }
  }, [state?.status, teaching.open]);

  const openSlide = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, index));
    setTeaching((prev) => ({
      ...prev,
      enabled: true,
      open: true,
      currentIndex: clamped,
      nextIndex: (clamped + 1) % SLIDES.length,
      visited: prev.visited.includes(clamped) ? prev.visited : [...prev.visited, clamped],
    }));
  }, []);

  const openNextSlide = useCallback(() => {
    play('click');
    setTeaching((prev) => {
      const target = Math.max(0, Math.min(SLIDES.length - 1, prev.nextIndex));
      return {
        ...prev,
        enabled: true,
        open: true,
        currentIndex: target,
        nextIndex: (target + 1) % SLIDES.length,
        visited: prev.visited.includes(target) ? prev.visited : [...prev.visited, target],
      };
    });
  }, []);

  const closeDeck = useCallback(() => {
    play('click');
    setTeaching((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);

  const toggleTeaching = useCallback(
    (enabled: boolean) => {
      play('click');
      setTeaching((prev) => ({
        ...prev,
        enabled,
        open: enabled ? prev.open : false,
      }));
      push(enabled ? '教学模式已开启，顶部栏可随时切进课堂 PPT' : '已关闭教学模式', 'good');
    },
    [push],
  );

  useEffect(() => {
    if (!teaching.enabled || !state) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'g' || event.key === 'G') {
        event.preventDefault();
        if (teaching.open) closeDeck();
        else openNextSlide();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [teaching.enabled, teaching.open, state, closeDeck, openNextSlide]);

  useEffect(() => {
    document.title = state ? `主持台 · 房间 ${state.code} · 早八生存局` : '主持台 · 早八生存局';
  }, [state]);

  useEffect(() => {
    if (host.error) push(host.error, 'error');
  }, [host.error, push]);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) push(success, 'good');
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (host.status === 'auth' || !host.token) {
    return <HostLogin code={code.toUpperCase()} onLogin={host.login} push={push} toasts={toasts} dismiss={dismiss} />;
  }

  if (!state) {
    return (
      <div className="host-loading">
        <div className="app-bg" />
        <div className="grain" />
        <Brand />
        <div className="loading-card">
          <span className="loading-spinner" />
          <p>{host.status === 'offline' ? '信号断了，正在重连讲台…' : '正在布置讲台大屏…'}</p>
          <Link className="btn btn-ghost btn-small" to="/">回首页</Link>
        </div>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      push('浏览器不让全屏，按 F11 也行', 'error');
    }
  };

  const statusLabel: Record<RoomStatus, string> = {
    lobby: '候场',
    action: '抉择中',
    reveal: '开奖',
    cover: '代勤中',
    review: '复查',
    settlement: '算账',
    final: '下课',
  };
  const label = statusLabel[state.status];
  const deckOpen = teaching.enabled && teaching.open;
  const showTopbarQr = state.status !== 'final' && (state.status !== 'lobby' || deckOpen);
  const openQrModal = () => {
    play('click');
    setQrModal(true);
  };
  const urgentGameHint =
    (state.status === 'action' && state.participantCount > 0 && state.submittedCount >= state.participantCount) ||
    (state.status === 'cover' && Boolean(state.cover && state.cover.eligibleCount > 0 && state.cover.decidedCount >= state.cover.eligibleCount));

  return (
    <div className={`host-page host-status-${state.status} ${deckOpen ? 'is-deck-open' : ''}`}>
      <div className="app-bg" />
      <div className="vignette" />
      <div className="grain" />
      {host.status === 'offline' && <div className="connection-bar">连接断了，正在重连…</div>}

      <header className={`host-bar ${teaching.enabled ? 'has-deck-bar' : ''}`}>
        <div className="host-bar-left">
          <Brand compact />
          {showTopbarQr && (
            <button
              type="button"
              className="host-qr-trigger"
              onClick={openQrModal}
              aria-label="展示加入二维码"
              title="展示加入二维码（中途加人 / 掉线重连）"
            >
              <IconQr />
              <span>扫码</span>
              <b className="mono">{state.code}</b>
            </button>
          )}
          <span className={`status-pill status-${state.status}`}><i />{label}</span>
        </div>

        {teaching.enabled && (
          <TeachingBreadcrumb
            open={deckOpen}
            currentIndex={teaching.currentIndex}
            nextIndex={teaching.nextIndex}
            visited={teaching.visited}
            roomStatus={state.status}
            roomLabel={label}
            urgentGameHint={urgentGameHint}
            onOpenNext={openNextSlide}
            onSelectSlide={(idx) => {
              play('click');
              openSlide(idx);
            }}
            onClose={closeDeck}
          />
        )}

        <div className="host-bar-actions">
          <span className="host-online"><IconWifi /> {state.onlineCount}</span>
          <SoundToggle />
          <button type="button" className="icon-btn" onClick={toggleFullscreen} aria-label="全屏" title="全屏">
            <IconExpand />
          </button>
          <button type="button" className="icon-btn" onClick={() => setDrawer(true)} aria-label="主持人设置" title="主持人设置">
            <IconSettings />
          </button>
        </div>
      </header>

      <main className="host-main">
        <AnimatePresence mode="wait">
          {deckOpen ? (
            <motion.div
              key="teaching-deck"
              className="host-stage-motion"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <TeachingDeck
                slideIndex={teaching.currentIndex}
                onSelectSlide={openSlide}
                onClose={closeDeck}
                roomState={state}
              />
            </motion.div>
          ) : (
            <motion.div
              key={state.status}
              className="host-stage-motion"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {state.status === 'lobby' && (
                <HostLobby
                  state={state}
                  busy={busy}
                  onOpenSettings={() => setDrawer(true)}
                  onStart={() => run(host.startRound, '发牌完毕，早八生存战开始！')}
                  push={push}
                />
              )}
              {state.status === 'action' && (
                <HostAction
                  state={state}
                  busy={busy}
                  onLock={() => run(host.lock)}
                />
              )}
              {state.status === 'cover' && (
                <HostCover
                  state={state}
                  busy={busy}
                  onLock={() => run(host.lock)}
                />
              )}
              {state.status === 'review' && (
                <HostReview
                  state={state}
                  busy={busy}
                  onSettle={() => run(host.revealScores)}
                />
              )}
              {state.status === 'reveal' && (
                <HostReveal
                  state={state}
                  busy={busy}
                  onSettle={() => {
                    if (state.gameMode === 'rollcall' && state.lecture === 1) {
                      run(host.nextLecture, '第一堂散场，回笼觉环节开始！');
                    } else {
                      run(host.revealScores);
                    }
                  }}
                />
              )}
              {state.status === 'settlement' && (
                <HostSettlement
                  state={state}
                  busy={busy}
                  onNext={() => run(host.startRound, '新的一天，闹钟又响了！')}
                  onFinal={() => run(host.final, '今日早八到此为止，准备放榜！')}
                  onOpenSettings={() => setDrawer(true)}
                  onChangeGameMode={(gameMode) => {
                    void run(() => host.setGameMode(gameMode), `下一局切换为${gameModeLabel(gameMode)}`);
                  }}
                />
              )}
              {state.status === 'final' && (
                <HostFinal
                  state={state}
                  busy={busy}
                  onNext={() => run(host.startRound, '加赛一局，闹钟重新响起！')}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SettingsDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        state={state}
        onChange={host.updateSettings}
        onChangeGameMode={host.setGameMode}
        onResetScores={host.resetScores}
        onAddBots={host.addBots}
        onRemoveBots={host.removeBots}
        teachingEnabled={teaching.enabled}
        onToggleTeaching={toggleTeaching}
        push={push}
      />
      <JoinQrModal
        open={qrModal && state.status !== 'final'}
        onClose={() => setQrModal(false)}
        code={state.code}
        joinUrl={joinUrl}
        displayUrl={displayUrl}
        isLocal={isLocal}
        lan={lan}
        push={push}
      />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

interface HostLoginProps {
  code: string;
  onLogin: (pin: string) => Promise<unknown>;
  push: (message: string, tone?: 'info' | 'good' | 'error') => void;
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}

function HostLogin({ code, onLogin, push, toasts, dismiss }: HostLoginProps) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pin.trim()) return;
    setBusy(true);
    try {
      await onLogin(pin.trim());
      play('join');
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="host-login">
      <div className="app-bg" />
      <div className="vignette" />
      <div className="grain" />
      <header className="login-nav">
        <Brand />
        <SoundToggle />
      </header>
      <main className="login-main">
        <div className="login-card ticket">
          <p className="stage-kicker">讲台控制台 · 房间 {code || '——'}</p>
          <h1 className="display">老师好，<br />请对一下暗号</h1>
          <p className="login-lede">输入创建房间时的 4 位主持人 PIN，即可接管讲台大屏，控制发牌、收卷和放榜。</p>
          <form onSubmit={submit} className="pin-form">
            <label htmlFor="host-pin" className="sr-only">主持人 PIN</label>
            <div className="pin-field">
              <input
                id="host-pin"
                className="pin-input mono"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={4}
                autoFocus
              />
              {!pin && <span className="pin-placeholder" aria-hidden="true">••••</span>}
            </div>
            <button className="btn btn-sun" type="submit" disabled={busy || pin.length < 4}>
              {busy ? '核对中…' : '进主持台'}
            </button>
          </form>
          <p className="fine">忘了 PIN？回首页重新开一间教室就行，新房间会自动生成新 PIN。</p>
        </div>
      </main>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
