import type { ReactNode } from 'react';

type StatusTone = 'info' | 'success' | 'warning' | 'error';

interface StatusMessageProps {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<StatusTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-800',
};

export default function StatusMessage({
  tone = 'info',
  children,
  className = '',
}: StatusMessageProps) {
  const isError = tone === 'error';
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm font-semibold leading-6 ${toneClasses[tone]} ${className}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  );
}
