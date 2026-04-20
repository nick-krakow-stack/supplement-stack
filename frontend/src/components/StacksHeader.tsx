import { Link } from 'react-router-dom';

export type StacksHeaderVariant = 'navy' | 'warm' | 'light';

interface StacksHeaderProps {
  variant?: StacksHeaderVariant;
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
}

function LogoMark() {
  return (
    <svg
      width="46"
      height="44"
      viewBox="0 0 46 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ssPg1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="50%" stopColor="#16a34a" />
          <stop offset="50%" stopColor="#86efac" />
        </linearGradient>
        <linearGradient id="ssPg2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="50%" stopColor="#ea580c" />
          <stop offset="50%" stopColor="#fed7aa" />
        </linearGradient>
        <linearGradient id="ssPg3" x1="0" y1="0" x2="1" y2="0">
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="50%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <g transform="translate(23,13)">
        <rect x="-13" y="-5" width="26" height="10" rx="5" fill="url(#ssPg1)" />
        <line x1="0" y1="-5" x2="0" y2="5" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        <rect x="-12" y="-3.5" width="10" height="3" rx="1.5" fill="rgba(255,255,255,0.2)" />
      </g>
      <g transform="translate(13,30) rotate(-52)">
        <rect x="-12" y="-4.5" width="24" height="9" rx="4.5" fill="url(#ssPg2)" />
        <line x1="0" y1="-4.5" x2="0" y2="4.5" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        <rect x="-11" y="-3" width="8" height="2.5" rx="1.25" fill="rgba(255,255,255,0.2)" />
      </g>
      <g transform="translate(33,30) rotate(52)">
        <rect x="-12" y="-4.5" width="24" height="9" rx="4.5" fill="url(#ssPg3)" />
        <line x1="0" y1="-4.5" x2="0" y2="4.5" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        <rect x="-11" y="-3" width="8" height="2.5" rx="1.25" fill="rgba(255,255,255,0.2)" />
      </g>
    </svg>
  );
}

export default function StacksHeader({
  variant = 'warm',
  title,
  subtitle,
  rightSlot,
}: StacksHeaderProps) {
  return (
    <header className={`site-header h-${variant}`}>
      <div className="header-nav-left">
        <Link to="/" className="header-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <LogoMark />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, gap: '1px' }}>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                opacity: 0.6,
                fontFamily: 'Nunito,sans-serif',
              }}
            >
              Supplement
            </span>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 900,
                letterSpacing: '-0.5px',
                fontFamily: 'Nunito,sans-serif',
              }}
            >
              Stack
            </span>
          </div>
        </Link>
      </div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {rightSlot && <div className="header-nav-right">{rightSlot}</div>}
    </header>
  );
}
