import AppLogo from './AppLogo';

export type StacksHeaderVariant = 'navy' | 'warm' | 'light';

interface StacksHeaderProps {
  variant?: StacksHeaderVariant;
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
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
        <AppLogo variant="stack" />
      </div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {rightSlot && <div className="header-nav-right">{rightSlot}</div>}
    </header>
  );
}
