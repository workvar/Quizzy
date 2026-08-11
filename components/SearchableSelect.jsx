'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Searchable dropdown that replaces native <select>.
 * options: [{ value: string, label: string }]
 * creatable: when true, show "Add new" if the typed query is not an exact option match
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  className = '',
  emptyMessage = 'No matches',
  creatable = false,
  onCreate,
  createLabel = (q) => `Add new: “${q}”`,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [menuPos, setMenuPos] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selected = useMemo(
    () => options.find(o => String(o.value) === String(value)) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const createQuery = query.trim();
  const showCreate = Boolean(
    creatable
    && createQuery
    && !options.some(o => o.label.toLowerCase() === createQuery.toLowerCase())
  );

  const itemCount = filtered.length + (showCreate ? 1 : 0);
  const createIdx = showCreate ? filtered.length : -1;

  const updateMenuPos = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 240 && rect.top > spaceBelow;
    setMenuPos({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      maxHeight: Math.min(280, openUp ? rect.top - 12 : spaceBelow - 12),
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setHighlight(0);
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    const idx = Math.max(0, options.findIndex(o => String(o.value) === String(value)));
    setHighlight(idx === -1 ? 0 : idx);
    requestAnimationFrame(() => {
      updateMenuPos();
      inputRef.current?.focus();
    });
  }, [disabled, options, updateMenuPos, value]);

  const choose = useCallback((opt) => {
    onChange?.(opt.value);
    close();
  }, [close, onChange]);

  const chooseCreate = useCallback(() => {
    if (!createQuery) return;
    onCreate?.(createQuery);
    close();
  }, [close, createQuery, onCreate]);

  useEffect(() => {
    if (!open) return;
    updateMenuPos();
    const onScroll = () => updateMenuPos();
    const onResize = () => updateMenuPos();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, updateMenuPos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    setHighlight((h) => (itemCount ? Math.min(h, itemCount - 1) : 0));
  }, [itemCount, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.querySelector(`[data-idx="${highlight}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => (itemCount ? (h + 1) % itemCount : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => (itemCount ? (h - 1 + itemCount) % itemCount : 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showCreate && highlight === createIdx) {
        chooseCreate();
      } else if (filtered[highlight]) {
        choose(filtered[highlight]);
      }
    }
  };

  const menu = open && mounted && menuPos && createPortal(
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      className="fixed z-[80] overflow-hidden rounded-apple border border-apple-gray-2 bg-white/95 backdrop-blur-xl shadow-apple-lg"
      style={{
        left: menuPos.left,
        width: menuPos.width,
        top: menuPos.top,
        bottom: menuPos.bottom,
        maxHeight: menuPos.maxHeight,
      }}
    >
      <div className="p-2 border-b border-apple-gray-2">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-apple-text-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlight(0); }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-2 text-sm bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text placeholder-apple-text-3 focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent"
            aria-autocomplete="list"
            aria-controls={listId}
          />
        </div>
      </div>
      <ul className="overflow-y-auto py-1" style={{ maxHeight: Math.max(80, (menuPos.maxHeight || 240) - 56) }}>
        {filtered.length === 0 && !showCreate ? (
          <li className="px-3 py-2.5 text-sm text-apple-text-3">{emptyMessage}</li>
        ) : (
          <>
            {filtered.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              const isActive = i === highlight;
              return (
                <li
                  key={`${opt.value}-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose(opt); }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                    isActive ? 'bg-blue-50 text-apple-blue' : 'text-apple-text hover:bg-apple-gray'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <svg className="w-4 h-4 flex-shrink-0 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </li>
              );
            })}
            {showCreate && (
              <li
                data-idx={createIdx}
                role="option"
                aria-selected={false}
                onMouseEnter={() => setHighlight(createIdx)}
                onMouseDown={(e) => { e.preventDefault(); chooseCreate(); }}
                className={`px-3 py-2.5 text-sm cursor-pointer border-t border-apple-gray-2 ${
                  highlight === createIdx ? 'bg-blue-50 text-apple-blue' : 'text-apple-blue hover:bg-apple-gray'
                }`}
              >
                <span className="font-semibold underline-offset-2 hover:underline">{createLabel(createQuery)}</span>
              </li>
            )}
          </>
        )}
      </ul>
    </div>,
    document.body
  );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-sm text-left focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all disabled:opacity-50 ${
          open ? 'ring-2 ring-apple-blue border-transparent' : ''
        }`}
      >
        <span className={`truncate ${selected ? 'text-apple-text' : 'text-apple-text-3'}`}>
          {selected?.label || placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-apple-text-3 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {menu}
    </div>
  );
}
