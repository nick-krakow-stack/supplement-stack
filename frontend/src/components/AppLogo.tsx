import { Link } from 'react-router-dom';

type AppLogoVariant = 'nav' | 'stack' | 'admin';

interface AppLogoProps {
  to?: string;
  variant?: AppLogoVariant;
  className?: string;
  onClick?: () => void;
}

const imageClasses: Record<AppLogoVariant, string> = {
  nav: 'h-10 w-[154px] object-contain object-left sm:h-11 sm:w-[172px]',
  stack: 'h-10 w-[150px] object-contain object-left sm:h-11 sm:w-[170px]',
  admin: 'h-10 w-[150px] object-contain object-left',
};

const shellClasses: Record<AppLogoVariant, string> = {
  nav: 'inline-flex min-w-0 items-center',
  stack:
    'inline-flex min-w-0 items-center rounded-2xl bg-white/95 px-2.5 py-1.5 shadow-sm ring-1 ring-white/70',
  admin:
    'inline-flex min-w-0 items-center rounded-2xl bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-white/10',
};

export default function AppLogo({
  to = '/',
  variant = 'nav',
  className = '',
  onClick,
}: AppLogoProps) {
  return (
    <Link
      to={to}
      className={`${shellClasses[variant]} ${className}`}
      onClick={onClick}
      aria-label="Supplement Stack Startseite"
    >
      <img
        src="/logo.png"
        alt="Supplement Stack"
        className={imageClasses[variant]}
        draggable={false}
      />
    </Link>
  );
}
