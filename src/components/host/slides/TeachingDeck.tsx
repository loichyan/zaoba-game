import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '../../Icons';
import { SLIDES } from '../../../lib/teaching';
import { play } from '../../../lib/sound';
import type { HostState } from '../../../lib/types';
import { Slide01Intro } from './Slide01Intro';
import { Slide02Harsanyi } from './Slide02Harsanyi';
import { Slide03Equilibrium } from './Slide03Equilibrium';
import { Slide04ProbExample } from './Slide04ProbExample';
import { Slide05ThresholdExample } from './Slide05ThresholdExample';

interface TeachingDeckProps {
  slideIndex: number;
  onSelectSlide: (index: number) => void;
  onClose: () => void;
  roomState?: HostState | null;
}

export function TeachingDeck({ slideIndex, onSelectSlide, onClose, roomState }: TeachingDeckProps) {
  const slide = SLIDES[slideIndex] ?? SLIDES[0];
  const reduce = useReducedMotion();
  const [direction, setDirection] = useState(1);
  const [step, setStep] = useState(1);

  useEffect(() => {
    setStep(1);
  }, [slideIndex]);

  const goSlide = (target: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, target));
    if (clamped === slideIndex) return;
    setDirection(clamped > slideIndex ? 1 : -1);
    onSelectSlide(clamped);
    play('click');
  };

  const handleNext = () => {
    if (step < slide.steps) {
      setStep((s) => s + 1);
      play('click');
      return;
    }
    if (slideIndex < SLIDES.length - 1) {
      goSlide(slideIndex + 1);
    } else {
      play('safe');
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      play('click');
      return;
    }
    if (slideIndex > 0) {
      goSlide(slideIndex - 1);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        handleNext();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        handlePrev();
        return;
      }
      if (event.key >= '1' && event.key <= String(SLIDES.length)) {
        event.preventDefault();
        goSlide(Number(event.key) - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <section className="teaching-deck" aria-label={`课堂课件：第 ${slideIndex + 1} 页`}>
      <header className="deck-slide-head">
        <div className="deck-slide-title-wrap">
          <div className="deck-slide-meta">
            <span className="stage-kicker">第 {slide.num} / 0{SLIDES.length} 页 · {slide.tag}</span>
            {slide.steps > 1 && (
              <span className="deck-step-pill mono">推导进度 {step}/{slide.steps}</span>
            )}
          </div>
          <h1 className="display deck-slide-title">{slide.title}</h1>
          <p className="deck-slide-sub">{slide.subtitle}</p>
        </div>

        <div className="deck-slide-nav">
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={handlePrev}
            disabled={slideIndex === 0 && step === 1}
            title="上一页 / 上一步 (←)"
          >
            <IconChevronLeft /> {step > 1 ? '上一步' : '上一页'}
          </button>
          <button
            type="button"
            className="btn btn-sun btn-small"
            onClick={handleNext}
            title="下一页 / 下一步 (→ 或 空格)"
          >
            {step < slide.steps
              ? `下一步 (${step + 1}/${slide.steps})`
              : slideIndex < SLIDES.length - 1
                ? `下一页 · ${SLIDES[slideIndex + 1].short}`
                : '讲完，回游戏开打'}
            <IconChevronRight />
          </button>
        </div>
      </header>

      <div className="deck-stage">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.index}
            className="deck-slide-frame"
            custom={direction}
            initial={reduce ? false : { opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction * -28 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {slideIndex === 0 && <Slide01Intro />}
            {slideIndex === 1 && <Slide02Harsanyi step={step} onStep={setStep} />}
            {slideIndex === 2 && <Slide03Equilibrium />}
            {slideIndex === 3 && (
              <Slide04ProbExample step={step} onStep={setStep} roomState={roomState} />
            )}
            {slideIndex === 4 && (
              <Slide05ThresholdExample step={step} onStep={setStep} onJumpSlide={goSlide} roomState={roomState} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="deck-foot">
        <div className="deck-progress-bar" aria-hidden="true">
          <motion.span
            animate={{ width: `${((slideIndex + 1) / SLIDES.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          />
        </div>
        <div className="deck-shortcuts">
          <span><kbd>←</kbd><kbd>→</kbd> 翻页 / 逐步推导</span>
          <span><kbd>1</kbd>–<kbd>5</kbd> 直达页码</span>
          <span><kbd>G</kbd> / <kbd>Esc</kbd> 秒切回游戏</span>
        </div>
      </footer>
    </section>
  );
}
