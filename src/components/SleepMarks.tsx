interface SleepMarksProps {
  className?: string;
}

export function SleepMarks({ className = '' }: SleepMarksProps) {
  return (
    <svg className={`sleep-marks ${className}`} viewBox="0 0 120 80" aria-hidden="true">
      <path d="M12 58h14L12 70h14" />
      <path d="M36 36h22L36 54h22" />
      <path d="M70 8h30L70 32h30" />
    </svg>
  );
}
