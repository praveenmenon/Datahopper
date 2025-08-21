import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

export type DropdownOption = { label: string; value: string };

type DropdownProps = {
  options: DropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  itemClassName?: string;
  labelClassName?: string;
  itemClassNameFn?: (opt: DropdownOption) => string | undefined;
  headerContent?: React.ReactNode;
  renderItem?: (opt: DropdownOption, onSelect: () => void) => React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** escape stacking/overflow issues (recommended: true) */
  usePortal?: boolean;
};

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className,
  disabled,
  itemClassName,
  labelClassName,
  itemClassNameFn,
  headerContent,
  renderItem,
  searchable = false,
  searchPlaceholder = 'Search…',
  usePortal = true,
}) => {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const [usingKeyboard, setUsingKeyboard] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // menu position when portaled
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null);

  const selected = useMemo(() => options.find(o => o.value === value), [options, value]);

  useEffect(() => {
    if (open) {
      setInputValue(selected?.label || '');
      setHighlightIndex(-1);
      setUsingKeyboard(false);
    }
  }, [open, selected]);

  useEffect(() => {
    if (!open) setInputValue(selected?.label || '');
  }, [selected, open]);

  const filtered = useMemo(() => {
    if (!searchable || !inputValue.trim()) return options;
    const q = inputValue.toLowerCase();
    const starts = options.filter(o => o.label.toLowerCase().startsWith(q));
    const contains = options.filter(o => !o.label.toLowerCase().startsWith(q) && o.label.toLowerCase().includes(q));
    return [...starts, ...contains];
  }, [options, searchable, inputValue]);

  // outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlightIndex(-1);
        setUsingKeyboard(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // compute portal menu position
  const updateMenuPos = () => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const gap = 8;
    const below = vh - r.bottom - gap;
    const above = r.top - gap;
    const desired = Math.max(180, Math.min(320, Math.floor(vh * 0.5)));
    const placeAbove = below < 180 && above > below;
    const maxH = placeAbove ? Math.max(140, Math.min(desired, Math.floor(above))) : Math.max(140, Math.min(desired, Math.floor(below)));
    setMenuPos({
      top: placeAbove ? Math.max(gap, r.top - maxH) : Math.min(vh - gap, r.bottom),
      left: Math.max(gap, r.left),
      width: Math.max(160, Math.floor(r.width)),
      maxH,
    });
  };

  useLayoutEffect(() => {
    if (!open || !usePortal) return;
    updateMenuPos();
    const onScroll = () => updateMenuPos();
    const onResize = () => updateMenuPos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, usePortal]);

  const commit = (opt: DropdownOption) => {
    onChange(opt.value);
    setInputValue(opt.label);
    setOpen(false);
    setHighlightIndex(-1);
    setUsingKeyboard(false);
    inputRef.current?.focus();
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    setUsingKeyboard(true);
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      if (usePortal) updateMenuPos();
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => (i + 1 >= filtered.length ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => (i - 1 < 0 ? Math.max(filtered.length - 1, 0) : i - 1));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        e.preventDefault();
        commit(filtered[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIndex(-1);
      setUsingKeyboard(false);
      setInputValue(selected?.label || '');
    }
  };

  // shared menu (used inline or via portal)
  const MenuNode = (
    <div
      className="bg-white dark:bg-gray-800 dark:text-white shadow-lg ring-1 ring-black ring-opacity-5 rounded-md overflow-auto text-sm"
      style={usePortal && menuPos ? { maxHeight: menuPos.maxH } : undefined}
      onMouseMove={() => usingKeyboard && setUsingKeyboard(false)}
    >
      {headerContent && (
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
          {headerContent}
        </div>
      )}
      {searchable ? (
        filtered.length > 0 && (
          <div id="dropdown-suggestions-popup" role="listbox" className="py-1">
            {filtered.map((opt, i) => {
              const colorClass = itemClassNameFn ? itemClassNameFn(opt) : 'text-gray-700 dark:text-gray-200';
              const isKbActive = usingKeyboard && highlightIndex === i;
              const isSelected = selected?.value === opt.value;
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isKbActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(opt)}
                  className={clsx(
                    'px-3 py-2 cursor-pointer transition-colors duration-100',
                    isKbActive ? 'bg-gray-50 dark:bg-gray-700/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40',
                    isSelected && 'font-medium', // keep normal text color; no faded primary-200
                    isSelected && 'after:content-["✓"] after:ml-2 after:text-xs after:opacity-70',
                    colorClass,
                    itemClassName
                  )}
                >
                  {opt.label}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <ul className="py-1">
          {options.map(opt => {
            const colorClass = itemClassNameFn ? itemClassNameFn(opt) : 'text-gray-700 dark:text-gray-200';
            if (renderItem) {
              return (
                <li key={opt.value} className="px-0">
                  {renderItem(opt, () => { onChange(opt.value); setOpen(false); })}
                </li>
              );
            }
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  className={clsx(
                    'w-full text-left px-3 py-2 transition-colors duration-100',
                    value === opt.value && 'font-medium bg-gray-50 dark:bg-gray-700/40',
                    'hover:bg-gray-50 dark:hover:bg-gray-700/40',
                    colorClass,
                    itemClassName
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
          {options.length === 0 && <li className="px-3 py-2 text-gray-400">No options</li>}
        </ul>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {searchable ? (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
            if (usePortal) updateMenuPos();
          }}
          onFocus={() => {
            setOpen(true);
            if (usePortal) updateMenuPos();
          }}
          onBlur={() => {
            if (selected?.label) setInputValue(selected.label);
            // allow click to register first
            setTimeout(() => {
              setOpen(false);
              setHighlightIndex(-1);
              setUsingKeyboard(false);
            }, 0);
          }}
          onKeyDown={onKeyDown}
          placeholder={searchPlaceholder}
          className={clsx(
            'w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          disabled={disabled}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="dropdown-suggestions-popup"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(o => !o);
            if (!open && usePortal) updateMenuPos();
          }}
          className={clsx(
            'w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-left text-sm bg-white dark:bg-gray-800 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className={clsx(!selected && 'text-gray-400', labelClassName)}>
            {selected ? selected.label : placeholder}
          </span>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </button>
      )}

      {open && (
        usePortal && menuPos
          ? createPortal(
              <div className="fixed z-[9999]" style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}>
                {MenuNode}
              </div>,
              document.body
            )
          : (
            <div className="absolute z-50 mt-1 w-full max-h-80 overflow-auto">
              {MenuNode}
            </div>
          )
      )}
    </div>
  );
};
