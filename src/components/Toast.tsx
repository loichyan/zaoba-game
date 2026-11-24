import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import type { ToastItem } from '../lib/types';

type Tone = ToastItem['tone'];

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const push = useCallback((message: string, tone: Tone = 'info', ttl = 3200) => {
    const id = ++idRef.current;
    setToasts((list) => [...list.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, ttl);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  return { toasts, push, dismiss };
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            className={`toast ${toast.tone === 'error' ? 'is-error' : toast.tone === 'good' ? 'is-good' : ''}`}
            onClick={() => onDismiss(toast.id)}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <span aria-hidden="true">{toast.tone === 'error' ? '!' : toast.tone === 'good' ? '✓' : '·'}</span>
            <span>{toast.message}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
