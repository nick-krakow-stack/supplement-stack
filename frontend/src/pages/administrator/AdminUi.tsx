import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

export type AdminTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

type AdminBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  tone?: AdminTone;
  children: ReactNode;
};

export function AdminBadge({
  tone = 'neutral',
  children,
  className,
  ...props
}: AdminBadgeProps) {
  return <span className={clsx('admin-badge', `admin-badge-${tone}`, className)} {...props}>{children}</span>;
}

export function AdminButton({
  variant = 'default',
  size = 'default',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'default' | 'sm';
}) {
  return (
    <button
      type="button"
      className={clsx(
        'admin-btn',
        variant !== 'default' && `admin-btn-${variant}`,
        size === 'sm' && 'admin-btn-sm',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminCard({
  title,
  subtitle,
  actions,
  children,
  padded = false,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <section className={clsx('admin-card', className)}>
      {(title || subtitle || actions) && (
        <div className="admin-card-head">
          <div>
            {title && <h2 className="admin-card-title">{title}</h2>}
            {subtitle && <p className="admin-card-sub">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? 'admin-card-pad' : undefined}>{children}</div>
    </section>
  );
}

export function AdminPageHeader({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="admin-page-head">
      <div>
        <h1 className="admin-page-title">{title}</h1>
        {subtitle && <p className="admin-page-sub">{subtitle}</p>}
      </div>
      {meta && <div className="admin-page-meta">{meta}</div>}
    </div>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <div className="admin-empty">{children}</div>;
}

export function AdminError({ children }: { children: ReactNode }) {
  return <div className="admin-error">{children}</div>;
}
