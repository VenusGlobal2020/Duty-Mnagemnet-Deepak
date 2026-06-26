import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return createPortal(
    <div
      className="fixed top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full ${sizes[size]} bg-white dark:bg-ink-800 rounded-xl shadow-2xl border border-ink-200/70 dark:border-white/[0.08] max-h-[90vh] flex flex-col animate-fadeUp`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ink-200/70 dark:border-white/[0.06] shrink-0">
          <h2 className="text-base font-bold font-display text-ink-900 dark:text-white">
            {title}
          </h2>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4 text-ink-500 dark:text-ink-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}