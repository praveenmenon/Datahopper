import React, { useEffect, useMemo, useRef, useState } from 'react';

interface HeaderKeyInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  containerClassName?: string;
}

export const HeaderKeyInput: React.FC<HeaderKeyInputProps> = ({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  containerClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1); // keyboard highlight only
  const [usingKeyboard, setUsingKeyboard] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = (value || '').toLowerCase();
    if (!q) return suggestions; // show all; scroll container
    const starts = suggestions.filter((s) => s.toLowerCase().startsWith(q));
    const contains = suggestions.filter((s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
    return [...starts, ...contains];
  }, [value, suggestions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlightIndex(-1);
        setUsingKeyboard(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const commit = (val: string) => {
    onChange(val);
    setOpen(false);
    setHighlightIndex(-1);
    setUsingKeyboard(false);
    inputRef.current?.focus();
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    setUsingKeyboard(true);

    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1 >= filtered.length ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 < 0 ? Math.max(filtered.length - 1, 0) : i - 1));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        e.preventDefault();
        commit(filtered[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIndex(-1);
      setUsingKeyboard(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${containerClassName || ''}`}
      onMouseMove={() => usingKeyboard && setUsingKeyboard(false)}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="header-key-suggestions-popup"
      />

      {open && filtered.length > 0 && (
        <div
          id="header-key-suggestions-popup"
          role="listbox"
          className="absolute z-10 mt-1 max-h-80 w-full overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
        >
          {filtered.map((s, i) => {
            const isKbActive = usingKeyboard && highlightIndex === i;
            const isSelected = value === s;
            return (
              <div
                key={s}
                role="option"
                aria-selected={isKbActive}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(s)}
                className={[
                  'px-3 py-2 text-sm cursor-pointer transition-colors duration-100',
                  // keyboard highlight matches hover (no dark band)
                  isKbActive ? 'bg-gray-50 dark:bg-gray-700/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40',
                  isSelected && 'font-medium',
                ].join(' ')}
              >
                {s}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
