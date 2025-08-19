import React, { useEffect, useMemo, useRef, useState } from 'react';
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
};

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className,
  disabled,
  itemClassName,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find(o => o.value === value), [options, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-left text-sm bg-white dark:bg-gray-800 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={clsx(!selected && 'text-gray-400')}>{selected ? selected.label : placeholder}</span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 dark:text-white shadow-lg ring-1 ring-black ring-opacity-5 rounded-md max-h-60 overflow-auto">
          <ul className="py-1 text-sm">
            {options.map(opt => (
              <li key={opt.value}>
                <button
                  type="button"
                  className={clsx(
                    'w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40',
                    value === opt.value
                      ? 'font-medium bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-200'
                      : 'text-gray-700 dark:text-gray-200',
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
            ))}
            {options.length === 0 && (
              <li className="px-3 py-2 text-gray-400">No options</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};


