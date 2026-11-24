import { motion } from 'motion/react';
import { IconArrow, IconSlides } from '../Icons';
import { SLIDES } from '../../lib/teaching';
import type { RoomStatus } from '../../lib/types';

interface TeachingBreadcrumbProps {
  open: boolean;
  currentIndex: number;
  nextIndex: number;
  visited: number[];
  roomStatus: RoomStatus;
  roomLabel: string;
  urgentGameHint?: boolean;
  onOpenNext: () => void;
  onSelectSlide: (index: number) => void;
  onClose: () => void;
}

export function TeachingBreadcrumb({
  open,
  currentIndex,
  nextIndex,
  visited,
  roomStatus,
  roomLabel,
  urgentGameHint = false,
  onOpenNext,
  onSelectSlide,
  onClose,
}: TeachingBreadcrumbProps) {
  const nextSlide = SLIDES[nextIndex] ?? SLIDES[0];
  const allVisited = visited.length >= SLIDES.length;

  return (
    <nav className={`deck-bar ${open ? 'is-presenting' : ''}`} aria-label="课堂课件导航">
      {open ? (
        <button
          type="button"
          className={`deck-primary-btn is-return ${urgentGameHint ? 'is-urgent' : ''}`}
          onClick={onClose}
          title="快捷键 Esc 或 G 返回游戏"
        >
          <span className={`deck-return-dot status-${roomStatus}`} aria-hidden="true" />
          <span>回到游戏 · {roomLabel}</span>
        </button>
      ) : (
        <button
          type="button"
          className="deck-primary-btn is-present"
          onClick={onOpenNext}
          title={`快捷键 G 打开：${nextSlide.num} ${nextSlide.title}`}
        >
          <IconSlides />
          <span>
            {visited.length === 0
              ? `开讲 · ${nextSlide.num} ${nextSlide.short}`
              : allVisited && nextIndex === 0
                ? `重温课件 · ${nextSlide.num} ${nextSlide.short}`
                : `下一页 · ${nextSlide.num} ${nextSlide.short}`}
          </span>
          <IconArrow />
        </button>
      )}

      <ol className="deck-crumbs" role="list">
        {SLIDES.map((slide) => {
          const isCurrent = open && currentIndex === slide.index;
          const isNext = !open && nextIndex === slide.index;
          const isVisited = visited.includes(slide.index);
          return (
            <li key={slide.num} className="deck-crumb-item">
              <button
                type="button"
                className={[
                  'deck-crumb',
                  isCurrent ? 'is-current' : '',
                  isNext ? 'is-next' : '',
                  isVisited ? 'is-visited' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelectSlide(slide.index)}
                aria-current={isCurrent ? 'step' : undefined}
                title={`${slide.num} · ${slide.title}`}
              >
                {isCurrent && (
                  <motion.span
                    layoutId="deck-crumb-pill"
                    className="deck-crumb-bg"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="deck-crumb-num mono">{slide.num}</span>
                <span className="deck-crumb-label">{slide.short}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
