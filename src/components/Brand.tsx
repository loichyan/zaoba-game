import { Link } from 'react-router-dom';
import { IconAlarm } from './Icons';

interface BrandProps {
  compact?: boolean;
  to?: string;
}

export function Brand({ compact = false, to = '/' }: BrandProps) {
  return (
    <Link className="brand" to={to} aria-label="早八生存局首页">
      <span className="brand-mark">
        <IconAlarm />
      </span>
      <span>
        早八生存局
        {!compact && <small>今天翘不翘？</small>}
      </span>
    </Link>
  );
}
