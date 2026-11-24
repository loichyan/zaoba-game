import confetti from 'canvas-confetti';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { CountdownRing } from '../components/CountdownRing';
import { IconArrow, IconBed, IconBell, IconCheck, IconCopy, IconDice, IconSpark, IconSun } from '../components/Icons';
import { Leaderboard } from '../components/Leaderboard';
import { ReputationBoard } from '../components/ReputationBoard';
import { RoleTicket } from '../components/RoleTicket';
import { SoundToggle } from '../components/SoundToggle';
import { SleepMarks } from '../components/SleepMarks';
import { StudentBoards } from '../components/StudentBoards';
import { ToastStack, useToasts } from '../components/Toast';
import {
  clock,
  gameModeLabel,
  modeLabel,
  modeRule,
  pct,
  reputationTierLabel,
  reviewRange,
  signed,
} from '../lib/format';
import { playerName, savePlayerName } from '../lib/storage';
import { ApiError } from '../lib/api';
import { useCountdown, useCountUp } from '../lib/useCountdown';
import { usePlayerRoom } from '../lib/usePlayerRoom';
import { play } from '../lib/sound';
import type {
  Action,
  CoverChoice,
  GameMode,
  LastResult,
  PassDraw,
  PlayerPrivate,
  PublicRoom,
  ReputationTier,
  Role,
  ToastItem,
} from '../lib/types';

type PassView = {
  p: number;
  action?: Action;
  allowed?: boolean;
  drawn?: boolean;
};

export default function Play() {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const code = String(params.code || search.get('room') || '').toUpperCase();
  const player = usePlayerRoom(code);
  const { toasts, push, dismiss } = useToasts();
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState(playerName());
  const [reclaimName, setReclaimName] = useState<string | null>(null);
  const [picked, setPicked] = useState<Action | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [covering, setCovering] = useState(false);
  const [pass, setPass] = useState<PassView | null>(null);
  const [drawing, setDrawing] = useState(false);
  const data = player.data;
  const room = data?.room;
  const me = data?.me;

  useEffect(() => {
    document.title = room ? `房间 ${room.code} · 早八生存局` : '早八生存局 · 入局';
  }, [room]);

  useEffect(() => {
    if (player.error) push(player.error, 'error');
  }, [player.error, push]);

  useEffect(() => {
    setPicked(null);
    setPass(null);
    setSubmitting(false);
  }, [room?.round, room?.lecture, room?.status]);

  const submitJoin = async (targetName: string, reclaim = false) => {
    if (!code) return;
    setJoining(true);
    try {
      const res = await player.join(targetName.trim(), reclaim);
      savePlayerName(res.name);
      setReclaimName(null);
      play('join');
      if (res.reclaimed) push(`欢迎回来，已找回「${res.name}」的座位与积分`, 'good');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'OFFLINE_SEAT_EXISTS' && err.offlineName) {
        setReclaimName(err.offlineName);
      } else {
        setReclaimName(null);
        push(err instanceof Error ? err.message : String(err), 'error');
      }
    } finally {
      setJoining(false);
    }
  };

  const join = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitJoin(name);
  };

  const act = async (action: Action) => {
    setPicked(action);
    setSubmitting(true);
    try {
      await player.act(action);
      play('click');
      navigator.vibrate?.(35);
    } catch (err: unknown) {
      setPicked(me?.action ?? null);
      push(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const draw = async () => {
    if (!me) return;
    setDrawing(true);
    try {
      const res = await player.drawPass();
      if (!res.action || res.p == null) throw new Error('签筒卡住了，再摇一次');
      setPass({ p: res.p, action: res.action, allowed: true, drawn: true });
      play('pass');
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setDrawing(false);
    }
  };

  const cover = async (choice: CoverChoice) => {
    setCovering(true);
    try {
      await player.cover(choice);
      play(choice === 'help' ? 'join' : 'click');
      navigator.vibrate?.(choice === 'help' ? [20, 30, 20] : 15);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setCovering(false);
    }
  };

  if (!code) {
    return <NeedCode toasts={toasts} dismiss={dismiss} />;
  }

  if (player.status === 'join' || !player.token) {
    return (
      <JoinScreen
        code={code}
        name={name}
        setName={(next) => {
          setReclaimName(null);
          setName(next);
        }}
        joining={joining}
        onJoin={join}
        reclaimName={reclaimName}
        onReclaim={() => {
          if (reclaimName) void submitJoin(reclaimName, true);
        }}
        toasts={toasts}
        dismiss={dismiss}
        push={push}
        loading={joining}
      />
    );
  }

  if (!room || !me) {
    return (
      <div className="student-page student-loading">
        <div className="app-bg" />
        <div className="grain" />
        <Brand />
        <div className="loading-card">
          <span className="loading-spinner" />
          <p>{player.status === 'offline' ? '信号开小差了，正在重连教室…' : '正在接回你的座位…'}</p>
          <div className="loading-actions">
            <button type="button" className="btn btn-sun btn-small" onClick={player.reconnect}>立即重试</button>
            <button type="button" className="btn btn-ghost btn-small" onClick={player.leaveSeat}>换个身份重进</button>
            <Link className="btn btn-ghost btn-small" to="/">回首页</Link>
          </div>
        </div>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  const effectiveAction: Action | null = picked || me.action;
  const drawnPass: PassView | null = pass || me.passDraw || me.pass;
  const currentView = room.status;
  const viewMotion = currentView === 'action'
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };

  return (
    <div className="student-page">
      <div className="app-bg" />
      <div className="vignette" />
      <div className="grain" />
      {player.status === 'offline' && <div className="connection-bar">连接断了，正在重连…</div>}

      <header className="student-top">
        <div className="student-top-left">
          <Brand compact />
          <span className="student-name" title={me.name}>{me.name}</span>
        </div>
        <div className="student-top-right">
          <span className="student-room">房间 <b className="mono">{room.code}</b></span>
          {room.round > 0 && (
            <span className="student-round">
              第 <b className="num">{room.round}</b> 局
              {room.gameMode === 'rollcall' && <i> · {room.lecture === 2 ? '回笼觉' : '第 1 堂'}</i>}
              {room.gameMode === 'cover' && <i> · {gameModeLabel(room.gameMode)}</i>}
            </span>
          )}
          <SoundToggle />
        </div>
      </header>

      <main className="student-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentView === 'reveal' || currentView === 'review' || currentView === 'settlement' ? 'result' : currentView}-${room.round}-${room.lecture}`}
            {...viewMotion}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {currentView === 'lobby' && (
              <WaitingScreen room={room} me={me} />
            )}
            {currentView === 'action' && (
              me.waiting ? (
                <SpectatorScreen room={room} me={me} />
              ) : (
                <ActionScreen
                  room={room}
                  me={me}
                  picked={effectiveAction}
                  onAct={act}
                  submitting={submitting}
                  pass={drawnPass}
                  onDraw={draw}
                  drawing={drawing}
                />
              )
            )}
            {currentView === 'cover' && (
              <CoverScreen
                room={room}
                me={me}
                onCover={cover}
                covering={covering}
              />
            )}
            {currentView === 'review' && (
              <CoverResultScreen room={room} me={me} settled={false} />
            )}
            {(currentView === 'reveal' || currentView === 'settlement') && (
              room.gameMode === 'rollcall' ? (
                <RollcallResultScreen room={room} me={me} settled={currentView === 'settlement'} />
              ) : room.gameMode === 'cover' ? (
                <CoverResultScreen room={room} me={me} settled={currentView === 'settlement'} />
              ) : (
              <ResultScreen room={room} me={me} settled={currentView === 'settlement'} />
              )
            )}
            {currentView === 'final' && (
              <FinalScreen room={room} me={me} push={push} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function NeedCode({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  return (
    <div className="join-page">
      <div className="app-bg" />
      <div className="vignette" />
      <div className="grain" />
      <header className="join-nav"><Brand /><SoundToggle /></header>
      <main className="join-main">
        <div className="join-card ticket">
          <p className="stage-kicker">走错片场？</p>
          <h1 className="display">先对房间号</h1>
          <p className="join-lede">抬头看一眼讲台大屏，输入四位房间码就能进教室。</p>
          <form
            className="join-fields"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) navigate(`/play?room=${encodeURIComponent(code.trim().toUpperCase())}`);
            }}
          >
            <input
              className="pin-input mono"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="房间码"
              maxLength={4}
              autoFocus
            />
            <button className="btn btn-sun" type="submit">进教室</button>
          </form>
        </div>
      </main>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

interface JoinScreenProps {
  code: string;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  joining: boolean;
  onJoin: (event: FormEvent<HTMLFormElement>) => void;
  reclaimName: string | null;
  onReclaim: () => void;
  toasts: ToastItem[];
  dismiss: (id: number) => void;
  push: (message: string, tone?: 'info' | 'good' | 'error') => void;
  loading: boolean;
}

function JoinScreen({
  code,
  name,
  setName,
  joining,
  onJoin,
  reclaimName,
  onReclaim,
  toasts,
  dismiss,
  push,
  loading,
}: JoinScreenProps) {
  const suggested = useRef(Boolean(name));
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (name || suggested.current) return;
    suggested.current = true;
    fetch(`/api/rooms/${encodeURIComponent(code)}/nickname`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { name?: string } | null) => {
        const next = data?.name;
        if (next) setName((current) => current || next);
      })
      .catch(() => {});
  }, [code, name, setName]);

  const reroll = async () => {
    setRolling(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/nickname`);
      const data = (await res.json().catch(() => ({}))) as { name?: string; error?: string };
      if (!res.ok || !data.name) throw new Error(data.error || '换名字失败了，再试一次');
      setName(data.name);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setRolling(false);
    }
  };

  return (
    <div className="join-page">
      <div className="app-bg" />
      <div className="vignette" />
      <div className="grain" />
      <header className="join-nav">
        <Brand />
        <SoundToggle />
      </header>
      <main className="join-main">
        <div className="join-card ticket">
          <div className="join-card-top">
            <span className="stage-kicker">房间 {code}</span>
            <span className="join-stamp">报到</span>
          </div>
          <h1 className="display">留个代号</h1>
          <p className="join-lede">真名留给教务处点名册，这里填个响亮的名号，一会儿好上大屏封神榜。</p>
          <form onSubmit={onJoin} className="join-fields">
            <div className="name-row">
              <label htmlFor="player-name" className="sr-only">你的代号</label>
              <input
                id="player-name"
                className="name-input"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 12))}
                placeholder="比如：诸葛亮"
                maxLength={12}
                autoComplete="nickname"
                autoFocus
              />
              <button
                type="button"
                className="name-reroll"
                onClick={reroll}
                disabled={rolling || joining || loading}
                aria-label="换一个随机昵称"
                title="换一个随机昵称"
              >
                <IconDice />
                <span>换一个</span>
              </button>
            </div>
            <button className="btn btn-sun" type="submit" disabled={joining || loading}>
              {joining || loading ? '正在入座…' : '入座领身份'}
              <IconArrow />
            </button>
          </form>
          {reclaimName && (
            <div className="reclaim-banner" role="status">
              <p>
                <b>「{reclaimName}」</b> 之前已入座目前离线。如果是你本人重连，可直接找回原座位和积分；否则请改一个代号。
              </p>
              <button type="button" className="btn btn-flame btn-small" onClick={onReclaim} disabled={joining}>
                {joining ? '正在找回…' : '回到原座位'}
              </button>
            </div>
          )}
          <div className="join-fine">
            <span>每局随机抽身份</span>
            <span>底牌仅自己可见</span>
            <span>超时未选算翘课</span>
          </div>
        </div>
        <p className="join-bottom-note">友情提示：这是课堂博弈实验，游戏里随便翘，现实里千万别拿平时分试探老师。</p>
      </main>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function WaitingScreen({ room, me }: { room: PublicRoom; me: PlayerPrivate }) {
  return (
    <div className="waiting-screen">
      <div className="waiting-stamp"><span>已入座</span></div>
      <p className="stage-kicker">房间 {room.code} · 第 {room.round + 1} 局准备中</p>
      <h1 className="display">{me.name}</h1>
      <p className="waiting-lede">已经在后排蹲好了！等老师一发牌，你的本局身份就会在手机上翻开。</p>
      <div className="waiting-art" aria-hidden="true">
        <span className="waiting-bed"><IconBed /></span>
        <SleepMarks className="waiting-zzz" />
      </div>
      <div className="waiting-stats">
        <div><span>已入座</span><b className="num">{room.playerCount}</b></div>
        <div><span>在线</span><b className="num">{room.onlineCount}</b></div>
        <div><span>你的积分</span><b className="num">{me.score}</b></div>
      </div>
      <p className="fine">
        {(room.settings.dealMode ?? 'fixed') === 'fixed'
          ? `本局固定牌库：困难户比例 ${room.settings.h}%（已公开）；具体底牌只有自己看得到。保持屏幕亮着别切走。`
          : `本局独立抽取：每人独立以 ${room.settings.h}% 概率抽到困难户；具体底牌只有自己看得到。保持屏幕亮着别切走。`}
      </p>
    </div>
  );
}

function SpectatorScreen({ room, me }: { room: PublicRoom; me: PlayerPrivate }) {
  return (
    <div className="spectator-screen">
      <div className="spectator-stamp">吃瓜中</div>
      <p className="stage-kicker">第 {room.round} 局进行中 · 下局轮到你</p>
      <h1 className="display">前排吃瓜</h1>
      <p className="waiting-lede">这局发牌时你还没进门，先在场边看看同学们怎么跟老师斗智斗勇，下一局马上给你发牌！</p>
      <div className="spectator-summary panel">
        <div><span>已表态</span><b className="num">{room.submittedCount}/{room.participantCount}</b></div>
        <div><span>你的积分</span><b className="num">{me.score}</b></div>
      </div>
      {room.leaderboard && <Leaderboard entries={room.leaderboard} meId={me.id} limit={5} title="当前积分" compact />}
    </div>
  );
}

interface ActionScreenProps {
  room: PublicRoom;
  me: PlayerPrivate;
  picked: Action | null;
  onAct: (action: Action) => void;
  submitting: boolean;
  pass: PassView | null;
  onDraw: () => void;
  drawing: boolean;
}

function ActionScreen({ room, me, picked, onAct, submitting, pass, onDraw, drawing }: ActionScreenProps) {
  const { ms, seconds } = useCountdown(room.endsAt, room.serverNow);
  const lastTick = useRef<number | null>(null);
  const urgent = seconds <= 10;
  const role = me.role;
  const rollcall = room.gameMode === 'rollcall';
  const secondLecture = rollcall && room.lecture === 2;
  const firstResult = room.lectureResults[0];
  const firstAction = me.lectureResults[0]?.action;
  const coverMode = room.gameMode === 'cover';

  useEffect(() => {
    if (seconds <= 10 && seconds > 0 && lastTick.current !== seconds) {
      lastTick.current = seconds;
      play('tick');
      if (seconds <= 3) navigator.vibrate?.(20);
    }
  }, [seconds]);

  if (!role) return <WaitingScreen room={room} me={me} />;

  const attend = role.attend;
  const skip = role.skip;

  return (
    <div className="action-screen">
      <h1 className="sr-only">第 {room.round} 局：{role.label}，选择去上课还是翘课</h1>
      <div className="action-topline">
        <span className="stage-kicker">
          第 {room.round} 局 · {rollcall ? (secondLecture ? '回笼觉' : '第 1 堂') : modeLabel(room.settings.mode)}
        </span>
        <span className={`mini-timer ${urgent ? 'is-urgent' : ''}`}><b className="num">{clock(ms)}</b><span>{urgent ? '快选！' : '倒计时'}</span></span>
      </div>

      <RoleTicket role={role} mode={room.settings.mode} compact>
        <div className="role-rule-line">{modeRule(room.settings.mode, room.settings)}</div>
        {secondLecture && (
          <div className={`student-first-state ${firstResult?.called ? 'is-called' : 'is-safe'}`}>
            <b>{firstResult?.called ? '首轮已点' : '首轮未点'}</b>
            <span>第一堂出勤 {pct(firstResult?.attendanceRate ?? 0, 0)}</span>
          </div>
        )}
      </RoleTicket>

      {coverMode && <CoverTeamCard room={room} me={me} />}

      <div className="student-params">
        <span>困难户 {room.settings.h}%</span>
        {room.settings.mode === 'threshold' && <span>警戒线 {room.settings.tau}%</span>}
        {room.settings.mode === 'threshold' && <span>心情 {room.settings.mood}</span>}
        {room.settings.mode === 'prob' && <span>点名率 = 翘课率</span>}
        <span>{room.participantCount} 人同局</span>
      </div>

      <div className="student-live-panel">
        <span className="live-dot" />
        <span>全班已表态</span>
        <b className="num">{room.submittedCount}<i>/{room.participantCount}</i></b>
        <span className="student-live-note">只知几人选，不知选了啥</span>
      </div>

      {(pass?.p != null || me.pass?.allowed) && (room.settings.mode === 'prob' || room.settings.mode === 'threshold') && (
        <div className="pass-panel">
          <div className="pass-head">
            <span><IconDice /> 随缘翘课签</span>
            <span className="fine">均衡翘课率 {pct(pass?.p ?? me.pass?.p ?? 0, 1)}</span>
          </div>
          {pass?.action ? (
            <div className="pass-result">
              <span className="pass-slip">签文：宜{pass.action === 'skip' ? '回笼觉（翘课）' : '奔教室（上课）'}</span>
              <button type="button" className="btn btn-sun btn-small" onClick={() => onAct(pass.action!)}>
                听签的，就选它
              </button>
            </div>
          ) : (
            <>
              <p>拿不准主意？你这个身份在本局正好处在纠结区（混合策略）。不妨按理论均衡概率摇一支签，结果只有你自己看得到。</p>
              <button type="button" className="btn btn-ghost btn-small" onClick={onDraw} disabled={drawing}>
                <IconDice /> {drawing ? '正在摇签筒…' : '摇一支签'}
              </button>
            </>
          )}
        </div>
      )}

      <div className="vote-bar">
        <button
          type="button"
          className={`vote-btn vote-attend ${picked === 'attend' ? 'is-selected' : ''}`}
          onClick={() => onAct('attend')}
          disabled={submitting}
          aria-pressed={picked === 'attend'}
        >
          <span className="vote-icon"><IconSun /></span>
          <span className="vote-copy">
            <b>
              {secondLecture
                ? firstAction === 'skip'
                  ? '爬起来去补课'
                  : '留在教室硬撑'
                : '爬起来去上课'}
            </b>
            <small>点名 {signed(attend.called)} · 不点 {signed(attend.safe)}</small>
          </span>
          {picked === 'attend' && <span className="vote-check"><IconCheck /></span>}
        </button>
        <button
          type="button"
          className={`vote-btn vote-skip ${picked === 'skip' ? 'is-selected' : ''}`}
          onClick={() => onAct('skip')}
          disabled={submitting}
          aria-pressed={picked === 'skip'}
        >
          <span className="vote-icon"><IconBed /></span>
          <span className="vote-copy">
            <b>
              {secondLecture
                ? firstAction === 'skip'
                  ? '钻回被窝回笼'
                  : '溜回宿舍补觉'
                : '钻回被窝翘课'}
            </b>
            <small>点名 {signed(skip.called)} · 不点 {signed(skip.safe)}</small>
          </span>
          {picked === 'skip' && <span className="vote-check"><IconCheck /></span>}
        </button>
      </div>

      <div className={`submit-state ${picked ? 'is-in' : ''}`}>
        {picked ? (
          <>
            <IconCheck />
            <span>已选定「{picked === 'attend' ? '去上课' : '翘课'}」，倒计时结束前随时能改主意。</span>
          </>
        ) : (
          <span>{urgent ? '最后几秒！再不选就默认算你睡过头翘课了！' : '去教室还是留被窝？全班都在等你的决定。'}</span>
        )}
      </div>
    </div>
  );
}

function CoverTeamCard({ room, me }: { room: PublicRoom; me: PlayerPrivate }) {
  const partner = me.team?.members.find((member) => member.id !== me.id);
  return (
    <div className="cover-team-card panel">
      <div className="cover-team-head">
        <span className="stage-kicker">本局同桌</span>
        <span className="cover-team-code mono">{room.code}</span>
      </div>
      <div className="cover-team-main">
        <div className="cover-me">
          <span>你的靠谱值</span>
          <b className="num">{me.reputation}</b>
          <span className={`reputation-tier tier-${me.reputationTier}`}>声誉 · {reputationTierLabel(me.reputationTier)}</span>
        </div>
        <div className={`cover-partner ${partner ? '' : 'is-solo'}`}>
          {partner ? (
            <>
              <span>同桌</span>
              <b>{partner.name}</b>
              <span className={`reputation-tier tier-${partner.tier}`}>声誉 · {reputationTierLabel(partner.tier)}</span>
            </>
          ) : (
            <>
              <span>本局单飞</span>
              <b>没有同桌</b>
              <small>这局点名只能自己硬扛</small>
            </>
          )}
        </div>
      </div>
      <p className="cover-team-note">
        {partner
          ? `老师复查看被点者的风评。同桌现在是「${reputationTierLabel(partner.tier)}」档，帮不帮，先看这一眼。`
          : '奇数玩家局，本局没有代勤机会。别慌，至少不用替人背锅。'}
      </p>
    </div>
  );
}

function CoverScreen({
  room,
  me,
  onCover,
  covering,
}: {
  room: PublicRoom;
  me: PlayerPrivate;
  onCover: (choice: CoverChoice) => void;
  covering: boolean;
}) {
  const cover = me.cover;
  const { ms, seconds } = useCountdown(room.cover?.endsAt ?? null, room.serverNow);
  const urgent = seconds <= 8;

  if (me.waiting) return <SpectatorScreen room={room} me={me} />;

  if (!cover) {
    return (
      <div className="cover-student is-empty">
        <p className="stage-kicker">第 {room.round} 局 · 代勤阶段</p>
        <div className="cover-empty-card ticket">
          <span className="cover-empty-mark">安</span>
          <h1 className="display">这局没有你的代勤戏份</h1>
          <p>你的同桌没有翘课，或者你俩一起选择了同一边。没有需要替人喊“到”的场面，坐好等开奖。</p>
          <p className="fine">代勤者的选择会统一亮牌，老师随后复查。</p>
        </div>
      </div>
    );
  }

  const helper = cover.role === 'helper';
  const range = reviewRange(cover.partnerTier);
  const decided = cover.submitted;

  return (
    <div className={`cover-student ${helper ? 'is-helper' : 'is-absentee'} ${decided ? 'is-decided' : ''}`}>
      <div className="cover-student-top">
        <span className="stage-kicker">第 {room.round} 局 · 代勤阶段</span>
        <span className={`mini-timer ${urgent ? 'is-urgent' : ''}`}>
          <b className="num">{clock(ms)}</b>
          <span>{urgent ? '快决定！' : '统一亮牌倒计时'}</span>
        </span>
      </div>

      <div className="cover-student-card ticket">
        <div className="cover-student-card-top">
          <span>{helper ? '演技大考' : '被点现场'}</span>
          <span className="mono">{room.code}</span>
        </div>
        <span className="cover-student-stamp">{helper ? '替' : '到'}</span>
        <h1 className="display">
          {helper ? '帮不帮他喊这一声？' : '你被点到了'}
        </h1>
        <div className="cover-pair-student">
          <div>
            <span>{helper ? '你要替的人' : '你的同桌'}</span>
            <b>{cover.partnerName}</b>
            <span className={`reputation-tier tier-${cover.partnerTier}`}>声誉 · {reputationTierLabel(cover.partnerTier)}</span>
          </div>
          <div className="cover-risk">
            <span>老师复查风险</span>
            <b className="num">{range.min}%–{range.max}%</b>
            <small>按对方档位估算，具体数值保密</small>
          </div>
        </div>
        <p className="cover-own-line">
          你的靠谱值 <b>{me.reputation}</b> · 声誉 {reputationTierLabel(me.reputationTier)}
        </p>

        {helper ? (
          decided ? (
            <div className="cover-waiting">
              <span className="cover-waiting-mark"><IconCheck /></span>
              <b>已经做出决定</b>
              <p>现在只等全班一起亮牌。先别偷看别人，演技要稳。</p>
              <span className="cover-progress">
                已表态 <b>{room.cover?.decidedCount ?? 0}</b> / {room.cover?.eligibleCount ?? 0} 组
              </span>
            </div>
          ) : (
            <>
              <p className="cover-choice-lede">
                你如果帮：躲过复查就涨声誉；翻车要扣 <b>6 分</b>，声誉也要挨一刀。你如果不帮：保住主积分，但声誉会掉一截。
              </p>
              <div className="cover-choice-bar">
                <button
                  type="button"
                  className="cover-choice is-help"
                  onClick={() => onCover('help')}
                  disabled={covering}
                >
                  <span><IconSpark /></span>
                  <b>替他喊一声“到”</b>
                  <small>赌一把演技，赢了涨声誉</small>
                </button>
                <button
                  type="button"
                  className="cover-choice is-decline"
                  onClick={() => onCover('decline')}
                  disabled={covering}
                >
                  <span><IconBed /></span>
                  <b>低头装没听见</b>
                  <small>主积分不扣，声誉掉一截</small>
                </button>
              </div>
            </>
          )
        ) : (
          <div className="cover-absentee-wait">
            <span className="cover-absentee-mark"><IconBell /></span>
            <b>{decided ? '同桌已经做出决定' : '同桌还在纠结'}</b>
            <p>现在只显示他有没有表态，不告诉你他到底帮不帮。等全班统一亮牌。</p>
            <span className="cover-progress">
              已表态 <b>{room.cover?.decidedCount ?? 0}</b> / {room.cover?.eligibleCount ?? 0} 组
            </span>
          </div>
        )}

        <div className="cover-student-tip">
          <IconSpark />
          <span>被点者的声誉越高，老师越信任；但翻车时，金字招牌也摔得更响。</span>
        </div>
      </div>
    </div>
  );
}

function RollcallResultScreen({ room, me, settled }: { room: PublicRoom; me: PlayerPrivate; settled: boolean }) {
  const results = me.lectureResults;
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const [showBoard, setShowBoard] = useState(settled);
  const played = useRef<string | null>(null);
  const total = results.reduce((sum, item) => sum + item.payoff, 0);
  const last = results[results.length - 1];
  const first = results[0];
  const danger = results.some((item) => item.action === 'skip' && item.called);

  useEffect(() => {
    setShowBoard(settled);
  }, [settled]);

  useEffect(() => {
    if (!results.length) return undefined;
    if (reduce) {
      setRevealed(true);
      return undefined;
    }
    setRevealed(false);
    const timer = window.setTimeout(() => setRevealed(true), 2850);
    return () => window.clearTimeout(timer);
  }, [results.length, room.lecture, reduce]);

  useEffect(() => {
    const playKey = `${room.round}-${room.lecture}`;
    if (!last || !revealed || played.current === playKey) return;
    played.current = playKey;
    if (last.payoff > 0) {
      play(last.action === 'skip' && !last.called ? 'coin' : 'safe');
      if (!reduce) {
        confetti({
          particleCount: 65,
          spread: 62,
          startVelocity: 28,
          origin: { y: 0.7 },
          colors: last.action === 'skip' ? ['#ffbe3d', '#8be6c6', '#fff2d2'] : ['#ffbe3d', '#7cc8ff', '#fff2d2'],
          disableForReducedMotion: true,
        });
      }
    } else {
      play('lose');
    }
  }, [last, revealed, room.round, room.lecture, reduce]);

  if (!results.length || !last) {
    return <SpectatorScreen room={room} me={me} />;
  }

  const firstTitle = first.action === 'skip'
    ? first.called ? '首堂翘课，被点了' : '首堂翘课，躲过一劫'
    : first.called ? '首堂到课，稳住' : '首堂到课，老师没点';
  const finalTitle = results.length === 1
    ? firstTitle
    : total >= 0
      ? '两堂连战，活着下课'
      : '两堂连战，血亏收场';

  return (
    <div className={`rollcall-result ${danger ? 'is-called' : 'is-safe'} ${total >= 0 ? 'is-plus' : 'is-minus'}`}>
      <div className="result-top">
        <span className="stage-kicker">第 {room.round} 局 · 点名风云</span>
        <span className={`result-call-pill ${last.called ? 'is-called' : 'is-safe'}`}>
          {results.length === 1 ? '第一堂' : '两堂合计'}
        </span>
      </div>
      {!revealed ? (
        <div className="result-pending">
          <div className="pending-card">
            <span className="pending-mark"><IconBell /></span>
            <h1 className="display">{results.length === 1 ? '翻花名册' : '老师在算总账'}</h1>
            <p>{results.length === 1 ? '老师翻开了花名册，正在名单里找你的名字。' : '两堂的点名声都落定了，正在把分数加在一起。'}</p>
            <span className="pending-track" aria-hidden="true"><i /></span>
          </div>
        </div>
      ) : (
        <>
          <div className="result-ticket ticket rollcall-ticket">
            <div className="result-ticket-head">
              <span>{results.length === 1 ? '第一堂账单' : '两堂连战账单'}</span>
              <span className="mono">{room.code}</span>
            </div>
            <h1 className="display">{finalTitle}</h1>
            <div className={`result-stamp ${danger ? 'stamp-flame' : 'stamp-mint'}`}>
              {danger ? '危' : '安'}
            </div>
            <div className="result-delta">
              <span>{results.length === 1 ? '第一堂' : '两堂合计'}</span>
              <b className="num">{signed(Math.round(total))}</b>
              <span>分</span>
            </div>
            <div className="lecture-result-list">
              {results.map((item, index) => (
                <div className={`lecture-result-row ${item.called ? 'is-called' : 'is-safe'}`} key={item.lecture ?? index}>
                  <span>第 {index + 1} 堂</span>
                  <span>{item.action === 'attend' ? '去上课' : '翘课'}</span>
                  <span>{item.called ? '被点' : '没点'}</span>
                  <b className="num">{signed(item.payoff)}</b>
                </div>
              ))}
            </div>
            <div className="result-meta">
              <div><span>累计积分</span><b className="num">{me.score}</b></div>
              <div><span>本局名次</span><b className="num">#{me.rank}</b></div>
              <div><span>角色</span><b>{me.role?.label ?? '—'}</b></div>
            </div>
            <p className="result-note">
              {results.length === 1
                ? first.action === 'skip'
                  ? `第一堂翘课${first.called ? '被抓' : '躲过'}，回笼觉马上开始。首轮结果会改变第二堂的点名率，别急着庆祝。`
                  : `第一堂到课${first.called ? '拿到点名分' : '虽然没点名'}，回笼觉马上开始。首轮结果会改变第二堂的点名率，第二堂别把优势睡没了。`
                : first.action === 'skip'
                  ? '两堂连战到此为止。首轮被扣的分，第二堂还能补一点；但如果两堂都被抓，那就只能认命了。'
                  : '两堂连战到此为止。第一堂已经坐稳，第二堂无论补不补，至少有一堂对得起闹钟了。'}
            </p>
          </div>
          {settled ? (
            <StudentBoards
              leaderboard={room.leaderboard}
              reputationBoard={room.reputationBoard}
              meId={me.id}
              open={showBoard}
              onToggle={() => setShowBoard((value) => !value)}
              note="等老师开启下一局，身份牌会重新洗牌抽取。"
            />
          ) : (
            <p className="fine center">等老师开第二堂，或者等总榜放出来。</p>
          )}
        </>
      )}
    </div>
  );
}

function CoverResultScreen({ room, me, settled }: { room: PublicRoom; me: PlayerPrivate; settled: boolean }) {
  const cover = me.cover ?? me.lastResult?.cover ?? null;
  const [showBoard, setShowBoard] = useState(settled);
  const played = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    setShowBoard(settled);
  }, [settled]);

  useEffect(() => {
    if (!settled || !cover || played.current === room.round) return;
    played.current = room.round;
    const good = cover.outcome === 'success';
    play(good ? 'safe' : cover.outcome === 'caught' ? 'lose' : 'click');
    if (good && !reduce) {
      confetti({
        particleCount: 55,
        spread: 60,
        startVelocity: 26,
        origin: { y: 0.7 },
        colors: ['#8be6c6', '#ffbe3d', '#fff2d2'],
        disableForReducedMotion: true,
      });
    }
  }, [settled, cover, room.round, reduce]);

  if (!cover) return <ResultScreen room={room} me={me} settled={settled} />;

  const helper = cover.role === 'helper';
  const outcome = cover.outcome;
  const absentCaught = !helper && outcome === 'no_help' && Boolean(me.lastResult?.called);
  const danger = outcome === 'caught' || absentCaught;
  const kicker =
    helper
      ? outcome === 'success'
        ? '代勤者 · 演技满级'
        : outcome === 'caught'
          ? '代勤者 · 人设翻车'
          : '代勤者 · 明哲保身'
      : outcome === 'success'
        ? '被代勤者 · 同桌救命'
        : outcome === 'caught'
          ? '被代勤者 · 连环翻车'
          : '被代勤者 · 被卖了';
  const title =
    helper
      ? outcome === 'success'
        ? '演技满级，成功过关'
        : outcome === 'caught'
          ? '当场抓包，人设翻车'
          : '低头写字，明哲保身'
      : outcome === 'success'
        ? '同桌救命，惊险保底'
        : outcome === 'caught'
          ? '同桌尽力了，还是被抓'
          : me.lastResult?.called
            ? '同桌装没听见，被点了'
            : '同桌装没听见，白捡';
  const note =
    helper
      ? outcome === 'success'
        ? '你压低嗓门替同桌答了声“到”，老师点点头翻过去了。主积分照拿，声誉暴涨！'
        : outcome === 'caught'
          ? '你刚喊完“到”，老师抬头盯住了空座位——代勤翻车！主积分扣 6 分，声誉也狠狠掉了一大截。'
          : '点名声响起时你把头埋进书里，保住了自己的分，但同桌回头的那一眼把你的声誉扣掉了。'
      : outcome === 'success'
        ? '你在被窝里差点凉透，幸好同桌在教室替你扛了一枪。这局不扣分，记 0 分，赶紧请人家喝奶茶。'
        : outcome === 'caught'
          ? '同桌替你喊了“到”，结果被老师当场抓包。你按翘课扣 5 分，声誉也顺带掉了 3 点。'
          : me.lastResult?.called
            ? '同桌坐在教室里沉默如石，老师点名时你还在被窝里，名字直接进了缺勤栏。'
            : '同桌坐在教室里沉默如石，但老师今天没点名，你白捡 5 分，运气比演技更管用。';
  const payoff = me.lastResult?.payoff ?? 0;
  const reputationDelta = cover.reputationDelta ?? 0;

  return (
    <div className={`cover-result ${danger ? 'is-called' : outcome === 'success' ? 'is-safe' : 'is-neutral'}`}>
      <div className="result-top">
        <span className="stage-kicker">第 {room.round} 局 · 代勤者联盟</span>
        <span className={`result-call-pill ${danger ? 'is-called' : 'is-safe'}`}>
          {outcome === 'success' ? '过关' : danger ? '被抓' : '没帮'}
        </span>
      </div>
      <div className="result-ticket ticket cover-result-ticket">
        <div className="result-ticket-head">
          <span>{kicker}</span>
          <span className="mono">{room.code}</span>
        </div>
        <h1 className="display">{title}</h1>
        <div className={`result-stamp ${danger ? 'stamp-flame' : 'stamp-mint'}`}>{danger ? '危' : '安'}</div>
        <div className="result-delta">
          <span>{settled ? '本局主积分' : '主积分待结算'}</span>
          <b className="num">{settled ? signed(payoff) : '—'}</b>
          <span>分</span>
        </div>
        <div className="result-meta">
          <div><span>声誉变化</span><b className={reputationDelta >= 0 ? 'num is-mint' : 'num is-flame'}>{signed(reputationDelta)}</b></div>
          <div><span>当前声誉</span><b className="num">{cover.reputationAfter ?? me.reputation}</b></div>
          <div><span>成功代勤</span><b className="num">{cover.coverSuccessCount ?? 0} 次</b></div>
        </div>
        <p className="result-note">{note}</p>
        <p className="result-rank">
          同桌 <b>{cover.partnerName}</b> · 声誉 {reputationTierLabel(cover.partnerTier)}
        </p>
      </div>

      {settled ? (
        <StudentBoards
          leaderboard={room.leaderboard}
          reputationBoard={room.reputationBoard}
          meId={me.id}
          open={showBoard}
          onToggle={() => setShowBoard((value) => !value)}
          showReputation
          note="下一局重新组队、重新抽身份，声誉继续带着走。"
        />
      ) : (
        <p className="fine center">全班已亮牌，老师正在看账单。</p>
      )}
    </div>
  );
}

function ResultScreen({ room, me, settled }: { room: PublicRoom; me: PlayerPrivate; settled: boolean }) {
  const result = me.lastResult;
  const waitingSettle = room.status === 'review' && !settled;
  const reduce = useReducedMotion();
  const [showBoard, setShowBoard] = useState(settled);
  const [revealed, setRevealed] = useState(waitingSettle);
  const revealedRound = useRef<number | null>(waitingSettle && result ? result.round : null);
  const played = useRef<number | null>(null);
  const delta = useCountUp(!waitingSettle && revealed && result ? result.payoff : 0, 700, true);
  const score = useCountUp(!waitingSettle && revealed && result ? (result.scoreAfter ?? me.score) : me.score, 700, true);

  useEffect(() => {
    setShowBoard(settled);
  }, [settled]);

  useEffect(() => {
    if (!result) {
      setRevealed(false);
      return undefined;
    }
    if (reduce || waitingSettle || revealedRound.current === result.round) {
      revealedRound.current = result.round;
      setRevealed(true);
      return undefined;
    }
    setRevealed(false);
    const round = result.round;
    const timer = window.setTimeout(() => {
      revealedRound.current = round;
      setRevealed(true);
    }, 1900);
    return () => window.clearTimeout(timer);
  }, [result?.round, reduce, waitingSettle]);

  useEffect(() => {
    if (!result || !revealed || waitingSettle || played.current === result.round) return;
    played.current = result.round;
    if (result.payoff > 0) {
      play(result.action === 'skip' && !result.called ? 'coin' : 'safe');
      if (!reduce) {
        confetti({
          particleCount: 70,
          spread: 65,
          startVelocity: 30,
          origin: { y: 0.7 },
          colors: result.action === 'skip' ? ['#ffbe3d', '#8be6c6', '#fff2d2'] : ['#ffbe3d', '#7cc8ff', '#fff2d2'],
          disableForReducedMotion: true,
        });
      }
    } else {
      play('lose');
    }
  }, [result, revealed, waitingSettle, reduce]);

  if (!result) return <SpectatorScreen room={room} me={me} />;
  if (!revealed) {
    return (
      <div className="result-pending">
        <p className="stage-kicker">第 {room.round} 局 · 开奖中</p>
        <div className="pending-card">
          <span className="pending-mark"><IconBell /></span>
          <h1 className="display">翻花名册</h1>
          <p>老师在讲台上那份名单里，找你的名字。</p>
          <span className="pending-track" aria-hidden="true"><i /></span>
        </div>
        <p className="fine center">屏住呼吸，马上揭晓</p>
      </div>
    );
  }

  const headline =
    result.action === 'skip'
      ? result.called
        ? '点名了，没你'
        : '没点名，躺赢'
      : result.called
        ? '点名了，你在'
        : '没点名，白来';

  const kicker =
    result.action === 'skip'
      ? result.called
        ? '人在被窝，名在榜上'
        : '被窝之神眷顾'
      : result.called
        ? '天选早八人'
        : '早起的鸟儿没虫吃';
  const danger = result.action === 'skip' && result.called;

  return (
    <div className={`result-screen ${danger ? 'is-called' : 'is-safe'} ${result.payoff >= 0 ? 'is-plus' : 'is-minus'}`}>
      <div className="result-top">
        <span className="stage-kicker">第 {room.round} 局 · {modeLabel(result.mode)}</span>
        <span className={`result-call-pill ${result.called ? 'is-called' : 'is-safe'}`}>{result.called ? '点名' : '没点'}</span>
      </div>
      <div className="result-ticket ticket">
        <div className="result-ticket-head">
          <span>{kicker}</span>
          <span className="mono">{room.code}</span>
        </div>
        <h1 className="display">{headline}</h1>
        <div className={`result-stamp ${danger ? 'stamp-flame' : 'stamp-mint'}`}>
          {danger ? '危' : '安'}
        </div>
        <div className="result-delta">
          <span>{waitingSettle ? '主积分待结算' : '本局'}</span>
          <b className="num">{waitingSettle ? '—' : signed(Math.round(delta))}</b>
          <span>分</span>
        </div>
        <div className="result-meta">
          <div><span>出勤率</span><b className="num">{pct(result.attendanceRate, 0)}</b></div>
          <div><span>点名概率</span><b className="num">{pct(result.q, 1)}</b></div>
          <div><span>累计积分</span><b className="num">{waitingSettle ? '—' : Math.round(score)}</b></div>
        </div>
        <p className="result-note">
          {result.action === 'skip'
            ? result.called
              ? '你在被窝里睡得正香，老师对着空座位念出了你的名字。这波逃课被抓个正着，血亏 5 分。'
              : '老师今天直到下课都没翻花名册。你舒舒服服补了一觉，还白捡 5 分，堪称早八人生赢家。'
            : result.called
              ? '听到自己名字的那一刻，早起受的所有罪都值了。你在教室里响亮答“到”，稳稳收下平时分。'
              : result.payoff === 0
                ? '你千辛万苦从被窝里爬出来，结果老师压根没点名。听课收获刚好抵掉起床痛苦，这局纯属陪跑（+0 分）。'
                : '你一早赶到教室，结果老师今天根本没点名。虽然少了点名加分，好歹听进了课，小赚 3 分不亏。'}
        </p>
        <p className="result-rank">当前第 <b>{me.rank}</b> 名</p>
      </div>

      {settled ? (
        <StudentBoards
          leaderboard={room.leaderboard}
          reputationBoard={room.reputationBoard}
          meId={me.id}
          open={showBoard}
          onToggle={() => setShowBoard((value) => !value)}
          showReputation={room.gameMode === 'cover'}
          note={
            room.gameMode === 'cover'
              ? '下一局重新组队、重新抽身份，声誉继续带着走。'
              : '等老师开启下一局，身份牌会重新洗牌抽取。'
          }
        />
      ) : (
        <p className="fine center">{waitingSettle ? '全班已亮牌，老师正在看账单。' : '等老师在讲台大屏揭晓总榜。'}</p>
      )}
    </div>
  );
}

function FinalScreen({ room, me, push }: { room: PublicRoom; me: PlayerPrivate; push: (message: string, tone?: 'info' | 'good' | 'error') => void }) {
  const [copied, setCopied] = useState(false);
  const finalScore = useCountUp(me.score, 800, true);
  const top = room.leaderboard?.find((e) => e.id === me.id);
  const rank = top?.rank || me.rank;
  const tied = (room.leaderboard || []).filter((e) => e.rank === rank).length > 1;
  const copy = () => {
    const text = room.gameMode === 'cover'
      ? `我在《早八生存局》代勤者联盟激战 ${room.round} 局，积分 ${me.score > 0 ? `+${me.score}` : me.score}，排名第 ${rank}，江湖声誉 ${me.reputation}。今天谁最会演？`
      : `我在《早八生存局》激战 ${room.round} 局，拿下 ${me.score > 0 ? `+${me.score}` : me.score} 分，全班排名第 ${rank}！今天早八翘不翘，还真是一门博弈论学问。`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    push('战绩已复制，快去群里晒分', 'good');
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="final-screen">
      <div className="final-stamp">下课</div>
      <p className="stage-kicker">房间 {room.code} · 共战 {room.round} 局</p>
      <h1 className="display">{rank === 1 ? '早八封神！' : me.score >= 0 ? '早八幸存！' : '被窝焊死！'}</h1>
      <div className="final-score">
        <span>最终积分</span>
        <b className="num">{finalScore > 0 ? `+${Math.round(finalScore)}` : Math.round(finalScore)}</b>
        <span className="final-rank">{tied ? `并列第 ${rank} 名` : `第 ${rank} 名`}</span>
      </div>
      {room.gameMode === 'cover' && (
        <p className="final-reputation">
          你的江湖声誉：<b className="num">{me.reputation}</b>
        </p>
      )}
      <Leaderboard entries={room.leaderboard} meId={me.id} limit={5} title="最终积分榜" compact />
      {room.gameMode === 'cover' && (
        <ReputationBoard entries={room.reputationBoard} meId={me.id} title="江湖声誉榜" limit={5} compact />
      )}
      <button type="button" className="btn btn-sun copy-result" onClick={copy}>
        <IconCopy /> {copied ? '已复制' : '复制战绩'}
      </button>
      <Link className="btn btn-ghost" to="/">回首页</Link>
      <p className="fine center">每局身份重抽，积分持续累计。下一局又是新的人生。</p>
    </div>
  );
}
