import React, { useMemo } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  variables?: Record<string, string>;
  containerClassName?: string;
}

const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export const VariableAwareInput: React.FC<Props> = ({
  variables = {},
  className = '',
  containerClassName = '',
  value = '',
  ...rest
}) => {
  const { hasVars, allKnown, parts } = useMemo(() => {
    const str = String(value ?? '');
    const found: string[] = [];
    const out: Array<{ text: string; isVar?: boolean; known?: boolean }> = [];

    let m: RegExpExecArray | null;
    let last = 0;
    while ((m = VAR_REGEX.exec(str)) !== null) {
      const varName = m[1];
      found.push(varName);
      if (m.index > last) out.push({ text: str.slice(last, m.index) });
      out.push({ text: `{{${varName}}}`, isVar: true, known: Object.prototype.hasOwnProperty.call(variables, varName) });
      last = m.index + m[0].length;
    }
    if (last < str.length) out.push({ text: str.slice(last) });

    if (found.length === 0) return { hasVars: false, allKnown: true, parts: [{ text: str }] };
    return { hasVars: true, allKnown: found.every((k) => Object.prototype.hasOwnProperty.call(variables, k)), parts: out };
  }, [value, variables]);

  const borderClass = hasVars
    ? (allKnown ? 'ring-2 ring-green-400 ring-inset rounded-md' : 'ring-2 ring-yellow-400 ring-inset rounded-md')
    : '';

  return (
    <div className={`relative ${borderClass} ${containerClassName}`}>
      {/* Overlay (ALWAYS ON) */}
      <div
        aria-hidden
        className="
          pointer-events-none absolute inset-0 z-0
          flex items-center px-3 py-2 pr-8
          whitespace-nowrap overflow-hidden
          font-mono text-sm leading-5 tracking-normal
          [font-kerning:none] [font-variant-ligatures:none]
        "
      >
        {parts.map((p, i) =>
          p.isVar ? (
            <span
              key={i}
              className={p.known ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
              style={{ borderRadius: 3 }} /* no padding => exact glyph advance */
            >
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </div>

      {/* Real input on top */}
      <input
        value={value}
        className={`
          relative z-10 w-full border border-gray-300 rounded-md
          px-3 py-2 pr-8 bg-transparent
          font-mono text-sm leading-5 tracking-normal
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          text-transparent caret-slate-900
          ${className}
        `}
        {...rest}
      />

      {hasVars && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 z-20">
          {allKnown ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-yellow-500" />}
        </div>
      )}
    </div>
  );
};
