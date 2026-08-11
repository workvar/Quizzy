'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DialogContext = createContext(null);

const DEFAULT_CONFIRM = {
  title: 'Are you sure?',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'danger', // 'danger' | 'primary'
  mode: 'confirm', // 'confirm' | 'alert'
};

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const close = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const openDialog = useCallback((opts) => {
    return new Promise((resolve) => {
      // Resolve any pending dialog as cancelled/dismissed
      if (resolverRef.current) resolverRef.current(false);
      resolverRef.current = resolve;
      setDialog({ ...DEFAULT_CONFIRM, ...opts });
    });
  }, []);

  const confirm = useCallback((opts) => {
    if (typeof opts === 'string') {
      return openDialog({ message: opts, mode: 'confirm' });
    }
    return openDialog({ ...opts, mode: 'confirm' });
  }, [openDialog]);

  const alert = useCallback((opts) => {
    if (typeof opts === 'string') {
      return openDialog({
        title: 'Notice',
        message: opts,
        mode: 'alert',
        confirmLabel: 'OK',
        tone: 'primary',
      });
    }
    return openDialog({
      title: 'Notice',
      confirmLabel: 'OK',
      tone: 'primary',
      ...opts,
      mode: 'alert',
    });
  }, [openDialog]);

  useEffect(() => {
    if (!dialog) return;
    const t = requestAnimationFrame(() => confirmBtnRef.current?.focus());
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(dialog.mode === 'alert' ? true : false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [dialog, close]);

  const toneClass = dialog?.tone === 'primary'
    ? 'bg-apple-blue hover:bg-brand-orange-deep'
    : 'bg-apple-red hover:bg-red-600';

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {mounted && dialog && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="presentation">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-md animate-[fadeIn_150ms_ease]"
            onClick={() => close(dialog.mode === 'alert' ? true : false)}
            aria-hidden
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            aria-describedby={dialog.message ? 'app-dialog-desc' : undefined}
            className="relative w-full max-w-md bg-white/95 backdrop-blur-xl border border-white/60 rounded-apple-xl shadow-2xl p-6 animate-[dialogIn_180ms_ease]"
            style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.5) inset' }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                dialog.mode === 'alert' || dialog.tone === 'primary'
                  ? 'bg-blue-50 text-apple-blue'
                  : 'bg-red-50 text-apple-red'
              }`}>
                {dialog.mode === 'alert' || dialog.tone === 'primary' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 18a6 6 0 110-12 6 6 0 010 12z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="app-dialog-title" className="text-base font-bold text-apple-text tracking-tight">
                  {dialog.title}
                </h2>
                {dialog.message ? (
                  <p id="app-dialog-desc" className="mt-1.5 text-sm text-apple-text-2 leading-relaxed">
                    {dialog.message}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {dialog.mode === 'confirm' && (
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="min-h-[44px] px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors"
                >
                  {dialog.cancelLabel}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => close(true)}
                className={`min-h-[44px] px-5 py-2 text-sm font-semibold text-white rounded-apple transition-colors ${toneClass}`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return ctx;
}

/** Convenience alias matching window.confirm usage */
export function useConfirm() {
  const { confirm } = useDialog();
  return confirm;
}

/** Convenience alias matching window.alert usage */
export function useAlert() {
  const { alert } = useDialog();
  return alert;
}
