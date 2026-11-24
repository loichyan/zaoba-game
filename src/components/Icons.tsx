import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function IconAlarm(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="13" r="7.2" />
      <path d="M12 9.5V13l2.4 1.6M7 3.8 9.2 6M17 3.8 14.8 6M5.3 18.4l-1.8 2M18.7 18.4l1.8 2" />
      <path d="M4.5 6.4A3.2 3.2 0 0 1 7.3 4M19.5 6.4A3.2 3.2 0 0 0 16.7 4" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
    </svg>
  );
}

export function IconBed(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 18.5v-8.2h11.2a4 4 0 0 1 4 4v4.2M3 16.2h18.2M3 20.5v-2M21.2 20.5v-2" />
      <path d="M6.2 10.3V7.2h5.1v3.1M14.2 10.3V7.2h3.2v3.1" />
      <path d="M17 4.2h3.2M17.8 2.8h2.4M17.4 5.6h2.4" strokeWidth="1.4" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.4 9.2a5.6 5.6 0 0 1 11.2 0c0 5 2 6.1 2 6.1H4.4s2-1.1 2-6.1Z" />
      <path d="M9.4 18.3a2.8 2.8 0 0 0 5.2 0M12 2.3V3.6" />
    </svg>
  );
}

export function IconDice(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4" />
      <circle cx="8.2" cy="8.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="8.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.2" cy="15.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="15.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.7" />
      <path d="M12 7.2V12l3.2 2.1" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="17" r="2" />
    </svg>
  );
}

export function IconExpand(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.2 9V4.2H9M19.8 9V4.2H15M4.2 15v4.8H9M19.8 15v4.8H15" />
    </svg>
  );
}

export function IconVolume(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" />
      <path d="M15.4 9a4.2 4.2 0 0 1 0 6M17.8 6.4a7.6 7.6 0 0 1 0 11.2" />
    </svg>
  );
}

export function IconVolumeOff(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" />
      <path d="m16 9.5 4 5M20 9.5l-4 5" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m4.5 12.5 4.8 4.8L19.8 6.8" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8" />
    </svg>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4h8v5.2a4 4 0 0 1-8 0zM8 5.5H4.5v2.2A3.3 3.3 0 0 0 8 11M16 5.5h3.5v2.2A3.3 3.3 0 0 1 16 11" />
      <path d="M12 13.2v4.2M8.5 20.5h7M10 17.4h4" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8.2" r="3.2" />
      <path d="M3.2 19.2c.4-3.3 2.7-5.2 5.8-5.2s5.4 1.9 5.8 5.2M15.4 5.4a3.2 3.2 0 0 1 0 5.9M17.2 14.4c2.1.4 3.4 2.1 3.7 4.8" />
    </svg>
  );
}

export function IconArrow(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 12h14M13.2 6.5 18.8 12l-5.6 5.5" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="10" width="14" height="10" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v2.5" />
    </svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s6.2-5.4 6.2-10.2a6.2 6.2 0 1 0-12.4 0C5.8 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.6" r="2.2" />
    </svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.2 13.9 9l5.8 1.9-5.8 1.9L12 18.6l-1.9-5.8L4.3 11l5.8-1.9z" />
      <path d="M19 3v3M20.5 4.5h-3M5 17v2.8M6.4 18.4H3.6" strokeWidth="1.4" />
    </svg>
  );
}

export function IconWifi(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 9.2a13 13 0 0 1 17 0M6.3 12.3a8.8 8.8 0 0 1 11.4 0M9 15.5a4.6 4.6 0 0 1 6 0" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSlides(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.2" width="18" height="12.2" rx="2.4" />
      <path d="M8.5 20h7M12 16.4V20M7.2 9.2h5.2M7.2 12.6h9.6" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m14.8 6.2-5.8 5.8 5.8 5.8" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m9.2 6.2 5.8 5.8-5.8 5.8" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12s3.6-6.2 9.5-6.2S21.5 12 21.5 12s-3.6 6.2-9.5 6.2S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function IconScale(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4v16M7 20h10M4.5 7.5h15" />
      <path d="M6.5 7.5 4 13.2h5L6.5 7.5ZM17.5 7.5 15 13.2h5l-2.5-5.7Z" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7.5 5.5 18.5 12l-11 6.5V5.5Z" />
    </svg>
  );
}

export function IconQr(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" />
      <path d="M14 14h2.5v2.5M14 20.5h3.5M20.5 14v6.5h-1" />
    </svg>
  );
}
