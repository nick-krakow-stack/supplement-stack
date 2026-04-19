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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 px-0 backdrop-blur-sm sm:items-center sm:px-4"
      onClick={handleOverlayClick}
    >
      <div
        className={`relative w-full max-h-[92vh] overflow-y-auto bg-white shadow-[0_35px_90px_rgba(15,23,42,0.35)] ${
          size === 'lg' ? 'sm:max-w-4xl' : 'sm:max-w-lg'
        } ${padded ? 'p-6' : 'p-0'} rounded-t-[1.75rem] sm:rounded-[1.75rem]`}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
