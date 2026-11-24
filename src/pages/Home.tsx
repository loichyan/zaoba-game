import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { HeroClock } from '../components/HeroClock';
import { IconAlarm, IconArrow, IconBed, IconBell, IconDice, IconSpark, IconSun, IconUsers } from '../components/Icons';
import { SoundToggle } from '../components/SoundToggle';
import { Ticker } from '../components/Ticker';
import { ToastStack, useToasts } from '../components/Toast';
import { createRoom } from '../lib/api';
import { hostKey, write } from '../lib/storage';
import { play } from '../lib/sound';
import { difficult, disciplined } from '../lib/home-reasons';
import type { GameMode, RoleType } from '../lib/types';

const GAME_MODE_CARDS: Array<{
  id: GameMode;
  name: string;
  tag: string;
  icon: typeof IconBell;
  line: string;
  punch: string;
  tone: string;
}> = [
  {
    id: 'base',
    name: '起床战争',
    tag: '单堂决胜 · 经典局',
    icon: IconAlarm,
    line: '一堂早八，一次表态，老师点不点名当场见分晓。',
    punch: '经典的味道，一局定输赢',
    tone: 'sun',
  },
  {
    id: 'rollcall',
    name: '点名风云',
    tag: '两堂连战 · 回笼觉',
    icon: IconBell,
    line: '第一堂刚逃过，第二堂还敢不敢睡？老师会记仇，缺人越狠下堂抓得越凶。',
    punch: '首轮躲过别得意，下节回笼觉见',
    tone: 'flame',
  },
  {
    id: 'cover',
    name: '代勤者联盟',
    tag: '双人组队 · 拼人品',
    icon: IconUsers,
    line: '每局随机配同桌。点名时队友在被窝里，你帮不帮他答“到”？帮成了涨声誉，翻车一起背锅。',
    punch: '塑料同桌情，全看这一声“到”',
    tone: 'mint',
  },
];

const MODE_CARDS = [
  {
    id: 'must',
    name: '必点',
    icon: IconBell,
    rule: 'q = 1',
    line: '老师站在讲台上翻开了花名册，一个都不放过。',
    punch: '别侥幸，老实去上课',
    tone: 'flame',
  },
  {
    id: 'never',
    name: '必不点',
    icon: IconBed,
    rule: 'q = 0',
    line: '老师今天佛系讲课，点名册压根没带进教室。',
    punch: '被窝党大获全胜',
    tone: 'mint',
  },
  {
    id: 'prob',
    name: '概率点名',
    icon: IconDice,
    rule: 'q = 翘课率',
    line: '全班有几成同学翘课，老师就有几成概率点名。',
    punch: '全班一起凑出来的概率',
    tone: 'sky',
  },
  {
    id: 'threshold',
    name: '阈值点名',
    icon: IconSun,
    rule: 'K / N < τ',
    line: '教室看着太冷清才点名；至于真不真抓，还得看老师脸色。',
    punch: '人齐就安全，人少看心情',
    tone: 'sun',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts();
  const [code, setCode] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState<Record<RoleType, boolean>>({ H: false, L: false });
  const [roleReason, setRoleReason] = useState<Record<RoleType, string>>({
    H: difficult[0],
    L: disciplined[0],
  });
  const reduce = useReducedMotion();

  useEffect(() => {
    document.title = '早八生存局 · 今天翘不翘？';
  }, []);

  useEffect(() => {
    if (!setupOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) setSetupOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setupOpen, loading]);

  const openCreate = () => {
    if (loading) return;
    play('click');
    setPin('');
    setSetupOpen(true);
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    play('click');
    try {
      const room = await createRoom(pin.trim() || undefined);
      write(hostKey(room.code), room.hostToken);
      setSetupOpen(false);
      navigate(`/host/${room.code}`);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const join = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) {
      push('先输四位房间码，看一眼讲台大屏。', 'error');
      return;
    }
    play('join');
    navigate(`/play?room=${encodeURIComponent(clean)}`);
  };

  const flipRole = (type: RoleType) => {
    const pool = type === 'H' ? difficult : disciplined;
    setRoleReason((prev) => ({ ...prev, [type]: pool[Math.floor(Math.random() * pool.length)] }));
    setFlipped((prev) => ({ ...prev, [type]: !prev[type] }));
    play('click');
  };

  const roles = useMemo(
    (): Array<{ type: RoleType; name: string; character: string; cost: string; front: string; back: string }> => [
      {
        type: 'H',
        name: '起床困难户',
        character: '困',
        cost: '上课成本 6',
        front: '被窝永久居留权持有者，下床需要消耗巨大勇气。',
        back: '去趟教室跟渡劫一样。点名威胁不够狠时，还不如躺平赌一把。',
      },
      {
        type: 'L',
        name: '早起自律人',
        character: '醒',
        cost: '上课成本 3',
        front: '闹钟响第一声就能掀被子的校园稀有物种。',
        back: '早起虽然没那么痛苦，但也不是大冤种——点名风险太低，照样翘课。',
      },
    ],
    [],
  );

  return (
    <div className="home">
      <div className="app-bg" />
      <div className="vignette" />
      <div className="grain" />

      <header className="site-nav">
        <Brand />
        <div className="site-nav-right">
          <a className="nav-link" href="#roles">两种角色</a>
          <a className="nav-link" href="#game-modes">三种模式</a>
          <a className="nav-link" href="#modes">四种点名</a>
          <SoundToggle />
        </div>
      </header>

      <main>
        <section className="hero">
          <motion.div
            className="hero-copy"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="stage-kicker">07:59 · 早八大型心理博弈现场</p>
            <h1 className="display hero-title">
              早八
              <span>生存局</span>
            </h1>
            <p className="hero-question">今天翘不翘？</p>
            <p className="hero-lede">
              闹钟响了，去教室还是留被窝？别光猜老师点不点名——这节课的点名率，是全班同学一起凑出来的。
            </p>

            <div className="join-box">
              <form onSubmit={join} className="join-form">
                <label className="sr-only" htmlFor="room-code">房间码</label>
                <div className="room-field">
                  <input
                    id="room-code"
                    className="room-input mono"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                    autoComplete="off"
                    spellCheck="false"
                    inputMode="text"
                    maxLength={4}
                  />
                  {!code && <span className="room-placeholder" aria-hidden="true">房间码</span>}
                </div>
                <button className="btn btn-sun" type="submit">
                  入局
                  <IconArrow />
                </button>
              </form>
              <button className="teacher-link" type="button" onClick={openCreate} disabled={loading}>
                我是老师，开一局
                <span aria-hidden="true">→</span>
              </button>
              <p className="fine">扫讲台二维码或输四位房间码入座。每局随机抽身份，底牌只有你自己知道。</p>
            </div>
          </motion.div>

          <motion.div
            className="hero-art-wrap"
            initial={reduce ? false : { opacity: 0, scale: 0.94, rotate: 2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroClock />
          </motion.div>
        </section>

        <Ticker />

        <section className="section roles-section" id="roles">
          <div className="section-head">
            <div>
              <p className="stage-kicker">每局重新发牌</p>
              <h2 className="display">两种角色</h2>
            </div>
            <p className="section-note">
              开局前老师会公开困难户比例，但具体谁是困难户只有自己知道。别人是困难户还是自律人，只能靠课堂表现和运气猜。
            </p>
          </div>
          <div className="role-deck">
            {roles.map((role) => {
              const isFlipped = flipped[role.type];
              return (
                <button
                  type="button"
                  key={role.type}
                  className={`home-role-card tone-${role.type === 'H' ? 'flame' : 'mint'} ${isFlipped ? 'is-flipped' : ''}`}
                  onClick={() => flipRole(role.type)}
                  aria-pressed={isFlipped}
                >
                  <span className="home-role-character display" aria-hidden="true">{role.character}</span>
                  <span className="home-role-top">
                    <span className="home-role-meta">
                      <span className="home-role-type">{role.type}</span>
                      <span>{role.cost}</span>
                    </span>
                    <span>{isFlipped ? '再点翻回正面' : '点一下看今日借口'}</span>
                  </span>
                  <span className="home-role-face">
                    {isFlipped ? (
                      <>
                        <span className="home-role-label">今日起床报告</span>
                        <strong className="home-role-reason">{roleReason[role.type]}</strong>
                        <em>{role.back}</em>
                      </>
                    ) : (
                      <>
                        <span className="home-role-label">本局身份</span>
                        <strong>{role.name}</strong>
                        <em>{role.front}</em>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="section game-modes-section" id="game-modes">
          <div className="section-head">
            <div>
              <p className="stage-kicker">一房三套玩法</p>
              <h2 className="display">三种模式</h2>
            </div>
            <p className="section-note">
              先选这节课怎么折腾，再选老师今天翻不翻花名册。玩法进房间再定，开局前都能调；每局结束还能换，本局内锁死。
            </p>
          </div>
          <div className="game-mode-grid">
            {GAME_MODE_CARDS.map((mode) => {
              const Icon = mode.icon;
              return (
                <article className={`game-mode-card tone-${mode.tone}`} key={mode.id}>
                  <div className="game-mode-top">
                    <span className="game-mode-icon"><Icon /></span>
                    <span className="game-mode-tag">{mode.tag}</span>
                  </div>
                  <h3>{mode.name}</h3>
                  <p>{mode.line}</p>
                  <strong>{mode.punch}</strong>
                  <span className="game-mode-mark" aria-hidden="true">{mode.id === 'base' ? '01' : mode.id === 'rollcall' ? '02' : '03'}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section modes-section" id="modes">
          <div className="section-head">
            <div>
              <p className="stage-kicker">老师随时换套路</p>
              <h2 className="display">四种点名</h2>
            </div>
            <p className="section-note">
              套路不同，算盘就不同。先看清这局的规矩，再决定是保平时分还是保睡眠质量。
            </p>
          </div>
          <div className="mode-grid">
            {MODE_CARDS.map((mode) => {
              const Icon = mode.icon;
              return (
                <article className={`mode-card tone-${mode.tone}`} key={mode.id}>
                  <div className="mode-icon"><Icon /></div>
                  <span className="mode-rule mono">{mode.rule}</span>
                  <h3>{mode.name}</h3>
                  <p>{mode.line}</p>
                  <strong>{mode.punch}</strong>
                </article>
              );
            })}
          </div>
          <div className="final-cta">
            <div>
              <IconSpark />
              <p>准备好跟全班赌一把了吗？</p>
            </div>
            <div className="final-cta-actions">
              <button className="btn btn-sun" type="button" onClick={openCreate} disabled={loading}>开一局</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <Brand compact />
        <p>友情提示：本游戏纯属课堂博弈实验，游戏里扣的是虚拟分，现实里挂的是真学分。</p>
        <span className="fine">早八生存局 · 不完全信息静态博弈</span>
      </footer>

      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {setupOpen && (
        <div
          className="setup-layer"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loading) setSetupOpen(false);
          }}
        >
          <motion.div
            className="setup-card ticket"
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-title"
            initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="stage-kicker">开教室 · 只差一把钥匙</p>
            <h2 id="setup-title" className="display">给教室上把锁</h2>
            <p className="setup-lede">设一个四位数 PIN，用于重新接管主持台。留空会自动生成。</p>
            <form onSubmit={create} className="setup-form">
              <label htmlFor="setup-pin" className="sr-only">主持人 PIN，可留空</label>
              <div className="setup-pin-field">
                <input
                  id="setup-pin"
                  className="setup-pin mono"
                  type="password"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={4}
                  autoFocus
                />
                {!pin && <span className="setup-pin-placeholder" aria-hidden="true">自动生成</span>}
              </div>
              <div className="setup-actions">
                <button className="btn btn-ghost" type="button" onClick={() => setSetupOpen(false)} disabled={loading}>
                  先不开了
                </button>
                <button className="btn btn-sun" type="submit" disabled={loading || (pin.length > 0 && pin.length < 4)}>
                  {loading ? '正在开教室…' : '开教室'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
