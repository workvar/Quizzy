'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MdAutocomplete, MdSelectOption } from '@awc-ui/react';

/**
 * Searchable dropdown backed by AWC MdAutocomplete.
 * options: [{ value: string, label: string }]
 * creatable: when true, allow free-solo values not in the list
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
  label = '',
}) {
  const ref = useRef(null);

  const optionList = useMemo(
    () => options.map((o) => ({ value: String(o.value), label: o.label })),
    [options]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.options = optionList;
    el.noResultsLabel = emptyMessage;
  }, [optionList, emptyMessage]);

  const handleChange = (e) => {
    const next = e.detail;
    // free-solo may return a string that isn't in options
    const matched = optionList.find((o) => o.value === String(next) || o.label === String(next));
    if (matched) {
      onChange?.(matched.value);
      return;
    }
    if (creatable && next) {
      onCreate?.(String(next));
      onChange?.(String(next));
    }
  };

  return (
    <div className={className}>
      <MdAutocomplete
        ref={ref}
        variant="outlined"
        label={label || undefined}
        placeholder={placeholder || searchPlaceholder}
        value={value == null ? '' : String(value)}
        disabled={disabled}
        clearable
        freeSolo={creatable}
        onMdChange={handleChange}
      >
        {optionList.map((o) => (
          <MdSelectOption key={o.value} value={o.value}>
            {o.label}
          </MdSelectOption>
        ))}
      </MdAutocomplete>
      {/* keep createLabel referenced for API parity (freeSolo handles creation) */}
      {creatable && createLabel ? null : null}
    </div>
  );
}
