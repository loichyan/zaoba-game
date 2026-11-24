import { QRPanel } from '../QRPanel';
import { PlayerGrid, ModeSummary } from './widgets';
import { IconArrow, IconSpark, IconUsers } from '../Icons';
import { play } from '../../lib/sound';
import { gameModeLabel } from '../../lib/format';
import { useJoinUrl } from '../../lib/useJoinUrl';
import type { HostState } from '../../lib/types';

interface HostLobbyProps {
  state: HostState;
  onStart: () => void;
  onOpenSettings: () => void;
  busy: boolean;
  push: (message: string, tone?: 'info' | 'good' | 'error') => void;
}

export function HostLobby({ state, onStart, onOpenSettings, busy, push }: HostLobbyProps) {
  const gameMode = state.nextGameMode ?? state.gameMode;
  const { joinUrl, displayUrl, isLocal, lan } = useJoinUrl(state.code);

  return (
    <section className="host-lobby">
      <div className="lobby-left">
        <div className="lobby-heading">
          <p className="stage-kicker">教室已开门 · 等同学入座</p>
          <h1 className="display">扫码<br />入局</h1>
        </div>
        <QRPanel
          url={joinUrl}
          code={state.code}
          size={292}
          onCopy={() => push('房间码已复制，快发群里摇人', 'good')}
        />
        <div className="lobby-join-note">
          <span className="mono">{displayUrl}</span>
          {isLocal && (
            <div className="lan-warning">
              {lan ? (
                <>
                  <b>已自动切换为局域网扫码地址</b>
                  <span className="lan-sub">同学连同一校园网或 Wi-Fi 即可直接扫码。老师若换用局域网地址打开主持台，重新输一下 PIN 即可。</span>
                </>
              ) : (
                <>
                  <b>手机扫不开？</b>
                  <span className="lan-sub">请改用本机局域网 IP 打开主持人页，别用 localhost。</span>
                </>
              )}
            </div>
          )}
          {!isLocal && <p>拿出手机扫一扫，或输入四位房间码直接入座。</p>}
        </div>
      </div>

      <div className="lobby-right">
        <div className="lobby-topline">
          <div className="lobby-count">
            <IconUsers />
            <span>已入座</span>
            <b className="num">{state.playerCount}</b>
            <span>人</span>
          </div>
          <div className="lobby-code">
            <span>房间</span>
            <b className="mono">{state.code}</b>
          </div>
          <span className="lobby-game-mode">{gameModeLabel(gameMode)}</span>
        </div>

        <p className="lobby-private-note">
          {(state.settings.dealMode ?? 'fixed') === 'fixed' ? (
            <>
              本局采用<b>固定牌库</b>：困难户比例 <b className="num">{state.settings.h}%</b>
              {state.onlineCount > 0 && (
                <>（当前 {state.onlineCount} 人将恰好发 <b className="num">{Math.round((state.onlineCount * state.settings.h) / 100)}</b> 困 / <b className="num">{state.onlineCount - Math.round((state.onlineCount * state.settings.h) / 100)}</b> 醒）</>
              )}
              ，具体谁是困难户只有自己知道。
            </>
          ) : (
            <>
              本局采用<b>独立抽取</b>：每人独立以 <b className="num">{state.settings.h}%</b> 概率抽到困难户；具体谁是困难户，仍然只有自己知道。
            </>
          )}
        </p>

        <div className="lobby-roster">
          <div className="panel-title">
            <h2>候场同学名单</h2>
            <span className="fine">{state.onlineCount} 人在线</span>
          </div>
          <PlayerGrid players={state.players} status={state.status} empty="教室里还空荡荡的" />
        </div>

        <div className="lobby-bottom">
          <div className="lobby-mode">
            <ModeSummary settings={state.settings} />
          </div>
          <div className="lobby-start">
            <button
              type="button"
              className="btn btn-sun lobby-start-btn"
              onClick={() => {
                play('click');
                onStart();
              }}
              disabled={busy || state.onlineCount === 0}
            >
              {busy ? '正在发牌…' : state.onlineCount === 0 ? '先等同学扫码进场' : state.round > 0 ? '发牌，开启下一局' : '发牌，开第一局'}
              <IconArrow />
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={onOpenSettings}>
              调整本局规则
            </button>
          </div>
        </div>

        <div className="lobby-spark" aria-hidden="true"><IconSpark /></div>
      </div>
    </section>
  );
}
