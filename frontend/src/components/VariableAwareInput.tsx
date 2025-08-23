// VariableAwareInput.tsx
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Eye } from 'lucide-react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  variables?: Record<string, string>;
  containerClassName?: string;
  /** Show an inline "eye" that opens a variables explainer */
  showExplainButton?: boolean;
}

const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export const VariableAwareInput: React.FC<Props> = ({
  variables = {},
  className = '',
  containerClassName = '',
  value = '',
  showExplainButton = false,
  ...rest
}) => {
  const str = String(value ?? '');

  // Parse into parts and collect var names
  const { hasVars, allKnown, parts, names } = useMemo(() => {
    const found: string[] = [];
    const out: Array<{ text: string; isVar?: boolean; known?: boolean }> = [];
    let m: RegExpExecArray | null;
    let last = 0;

    while ((m = VAR_REGEX.exec(str)) !== null) {
      const name = m[1];
      found.push(name);
      if (m.index > last) out.push({ text: str.slice(last, m.index) });
      out.push({
        text: `{{${name}}}`,
        isVar: true,
        known: Object.prototype.hasOwnProperty.call(variables, name),
      });
      last = m.index + m[0].length;
    }
    if (last < str.length) out.push({ text: str.slice(last) });
    if (found.length === 0) return { hasVars: false, allKnown: true, parts: [{ text: str }], names: [] as string[] };

    return {
      hasVars: true,
      allKnown: found.every((k) => Object.prototype.hasOwnProperty.call(variables, k)),
      parts: out,
      names: Array.from(new Set(found)),
    };
  }, [str, variables]);

  // Resolve preview string (simple {{k}} replace using provided variables)
  const resolved = useMemo(() => {
    if (!hasVars) return str;
    let r = str;
    for (const [k, v] of Object.entries(variables)) {
      r = r.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v ?? '');
    }
    return r;
  }, [str, variables, hasVars]);

  const borderClass = hasVars
    ? (allKnown ? 'ring-2 ring-green-400 ring-inset rounded-md' : 'ring-2 ring-yellow-400 ring-inset rounded-md')
    : '';

  // Popover state/close on outside click
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className={`relative ${borderClass} ${containerClassName} isolate`}>
      {/* Overlay text layer */}
      <div
        aria-hidden
        className="
          pointer-events-none absolute inset-0 z-0
          flex items-center px-3 py-2 pr-10
          whitespace-nowrap overflow-hidden
          font-mono text-sm leading-5 tracking-normal
          text-gray-900 dark:text-white
          [font-kerning:none] [font-variant-ligatures:none]
        "
      >
        {parts.map((p, i) =>
          p.isVar ? (
            <span
              key={i}
              className={p.known
                ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200'}
              style={{ borderRadius: 3 }}
            >
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </div>

      {/* Real input */}
      <input
        value={value}
        className={`
          relative z-10 w-full border border-gray-300 rounded-md
          px-3 py-2 pr-10 bg-transparent
          font-mono text-sm leading-5 tracking-normal
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          ${str.length > 0 ? 'text-transparent' : 'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500'} caret-slate-900 dark:caret-white
          ${className}
        `}
        // keep overlay visible only when there is content; otherwise allow placeholder to show
        style={{ WebkitTextFillColor: str.length > 0 ? 'transparent' : undefined, backgroundColor: 'transparent' }}
        {...rest}
      />

      {/* End adornments (right side) */}
      {hasVars && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
          {showExplainButton && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Explain variables"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          {allKnown ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
        </div>
      )}

      {/* Popover */}
      {open && (
        <div
          ref={popRef}
          className="absolute right-0 top-full mt-2 w-[min(36rem,90vw)] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-30"
        >
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-medium">
            Variables in this field
          </div>
          <div className="max-h-72 overflow-auto p-3 space-y-2 text-sm">
            {names.length === 0 ? (
              <div className="text-gray-500">No variables detected.</div>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4 font-medium">Variable</div>
                  <div className="col-span-6 font-medium">Value</div>
                  <div className="col-span-2 font-medium">Status</div>
                </div>
                {names.map((n) => {
                  const known = Object.prototype.hasOwnProperty.call(variables, n);
                  const val = known ? variables[n] : '';
                  return (
                    <div key={n} className="grid grid-cols-12 gap-2 items-center">
                      <code className="col-span-4 font-mono text-xs">{{}.constructor === Object ? `{{${n}}}` : `{{${n}}}`}</code>
                      <div className="col-span-6 break-all">{known ? <code className="font-mono">{val}</code> : <span className="text-gray-500">—</span>}</div>
                      <div className="col-span-2">{known ? <span className="text-green-600">known</span> : <span className="text-amber-600">missing</span>}</div>
                    </div>
                  );
                })}
              </>
            )}
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs uppercase tracking-wide text-gray-500">Resolved preview</div>
              <div className="mt-1 font-mono text-xs bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded break-all">
                {resolved}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
