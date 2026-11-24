import { motion } from 'motion/react';
import QRCode from 'qrcode';
import { useEffect, useState, type CSSProperties } from 'react';
import { IconCopy } from './Icons';

interface QRPanelProps {
  url: string;
  code: string;
  size?: number;
  onCopy?: () => void;
}

export function QRPanel({ url, code, size = 300, onCopy }: QRPanelProps) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, {
      width: 900,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0e1028', light: '#fff2d2' },
    })
      .then((next) => {
        if (alive) setDataUrl(next);
      })
      .catch(() => {
        if (alive) setDataUrl('');
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className="qr-panel" style={{ '--qr-size': `${size}px` } as CSSProperties}>
      <div className="qr-frame">
        <span className="qr-corner qr-corner-a" />
        <span className="qr-corner qr-corner-b" />
        <span className="qr-corner qr-corner-c" />
        <span className="qr-corner qr-corner-d" />
        {dataUrl ? (
          <img src={dataUrl} alt={`扫码加入房间 ${code}`} draggable="false" />
        ) : (
          <div className="qr-loading">正在生成入局二维码…</div>
        )}
        <motion.span
          className="qr-scan"
          aria-hidden="true"
          initial={{ top: '8%' }}
          animate={{ top: ['8%', '90%', '8%'] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="qr-caption">
        <span>扫码入局</span>
        <button
          type="button"
          className="qr-code-copy"
          onClick={() => {
            navigator.clipboard?.writeText(code);
            onCopy?.();
          }}
          title="复制房间码"
        >
          <span className="mono">{code}</span>
          <IconCopy />
        </button>
      </div>
    </div>
  );
}
