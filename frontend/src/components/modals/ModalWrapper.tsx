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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
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
        className={`relative w-full max-h-[calc(100dvh-0.75rem)] overscroll-contain overflow-y-auto bg-white shadow-[0_35px_90px_rgba(15,23,42,0.35)] sm:max-h-[92vh] ${
          size === 'lg' ? 'sm:max-w-4xl' : 'sm:max-w-lg'
        } ${padded ? 'p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6' : 'p-0'} rounded-t-[1.75rem] sm:rounded-[1.75rem]`}
      >
        {title && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="min-w-0 pt-2 text-lg font-bold leading-tight text-gray-900 sm:text-xl">{title}</h2>
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
