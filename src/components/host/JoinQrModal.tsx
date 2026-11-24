import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { QRPanel } from '../QRPanel';
import { IconClose, IconCopy } from '../Icons';
import { play } from '../../lib/sound';

interface JoinQrModalProps {
  open: boolean;
  onClose: () => void;
  code: string;
  joinUrl: string;
  displayUrl: string;
  isLocal: boolean;
  lan: string | null;
  push: (message: string, tone?: 'info' | 'good' | 'error') => void;
}

export function JoinQrModal({
  open,
  onClose,
  code,
  joinUrl,
  displayUrl,
  isLocal,
  lan,
  push,
}: JoinQrModalProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const copyLink = () => {
    navigator.clipboard?.writeText(joinUrl);
    play('click');
    push('入座链接已复制，发群里就能进', 'good');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="qr-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="qr-modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="中途加入或重连二维码"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="qr-modal-head">
              <div>
                <p className="stage-kicker">中途入座 · 掉线重连</p>
                <h2>手机扫码回到教室</h2>
              </div>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭二维码">
                <IconClose />
              </button>
            </div>

            <div className="qr-modal-body">
              <QRPanel
                url={joinUrl}
                code={code}
                size={272}
                onCopy={() => push('房间码已复制，快发群里摇人', 'good')}
              />
              <div className="qr-modal-note">
                <span className="mono">{displayUrl}</span>
                <p>掉线或关掉网页的同学扫码后，输入原来的代号即可点「回到原座位」保留积分；新同学将在下一局发牌时上场。</p>
                {isLocal && !lan && (
                  <p className="qr-modal-warn">当前是 localhost 打开，请换用局域网 IP 打开主持台再展示二维码。</p>
                )}
                <div className="qr-modal-actions">
                  <button type="button" className="btn btn-sun btn-small" onClick={copyLink}>
                    <IconCopy /> 复制入座链接
                  </button>
                  <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
