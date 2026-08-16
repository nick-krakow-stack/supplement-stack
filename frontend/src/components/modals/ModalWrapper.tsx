import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalWrapperProps {
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'md' | 'lg';
  padded?: boolean;
}

export default function ModalWrapper({
  onClose,
  children,
  title,
  size = 'md',
  padded = true,
}: ModalWrapperProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`dialog-title-${Math.random().toString(36).slice(2)}`);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      );
      (first ?? dialogRef.current)?.focus();
    });
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/55 px-0 pt-4 backdrop-blur-sm sm:items-center sm:px-4 sm:py-4"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId.current : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        className={`relative w-full max-h-[calc(100dvh-0.75rem)] overscroll-contain overflow-y-auto bg-white shadow-[0_35px_90px_rgba(15,23,42,0.35)] sm:max-h-[92vh] ${
          size === 'lg' ? 'sm:max-w-4xl' : 'sm:max-w-lg'
        } ${padded ? 'p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6' : 'p-0'} rounded-t-[1.75rem] sm:rounded-[1.75rem]`}
      >
        {title && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id={titleId.current} className="min-w-0 pt-2 text-lg font-bold leading-tight text-gray-900 sm:text-xl">{title}</h2>
            <button
              onClick={onClose}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Schließen"
            >
              <X size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
