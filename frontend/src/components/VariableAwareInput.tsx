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

    if (!found.length) return { hasVars: false, allKnown: true, parts: [{ text: str }] };
    return {
      hasVars: true,
      allKnown: found.every((k) => Object.prototype.hasOwnProperty.call(variables, k)),
      parts: out,
    };
  }, [value, variables]);

  return (
    <div
      className={`relative rounded-md isolate ${containerClassName}`}
      style={hasVars ? { outline: '2px solid', outlineColor: `var(${allKnown ? '--dh-ring-success' : '--dh-ring-warn'})` } : undefined}
    >
      {/* Paint layer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 flex items-center px-3 py-2 pr-8 whitespace-nowrap overflow-hidden font-mono text-sm leading-5 tracking-normal"
        style={{ color: 'var(--dh-fg)' }}
      >
        {parts.map((p, i) =>
          p.isVar ? (
            <span
              key={i}
              style={{
                backgroundColor: p.known ? 'var(--dh-chip-known-bg)' : 'var(--dh-chip-unknown-bg)',
                color: p.known ? 'var(--dh-chip-known-fg)' : 'var(--dh-chip-unknown-fg)',
                borderRadius: 3,
              }}
            >
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </div>

      {/* Actual input (transparent), uses tokens for caret/border */}
      <input
        value={value}
        className={`va-input relative z-10 w-full rounded-md border px-3 py-2 pr-8 font-mono text-sm leading-5 tracking-normal focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${className}`}
        style={{
          // keep overlay visible in any theme / plugin
          backgroundColor: 'transparent',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
          caretColor: 'var(--dh-caret)',
          borderColor: 'var(--dh-input-border)',
        }}
        {...rest}
      />

      {hasVars && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
          {allKnown ? (
            <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--dh-icon-success)' }} />
          ) : (
            <AlertTriangle style={{ width: 16, height: 16, color: 'var(--dh-icon-warn)' }} />
          )}
        </div>
      )}
    </div>
  );
};
