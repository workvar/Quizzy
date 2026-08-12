'use client';
import { useEffect } from 'react';

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
      <div className={`relative bg-white/90 backdrop-blur-xl border border-white/60 rounded-apple-xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`} style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.5) inset' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 flex-shrink-0">
          <h2 className="text-base font-bold text-apple-text">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors text-apple-text-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}