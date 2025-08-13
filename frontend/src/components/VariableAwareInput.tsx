import React, { useMemo } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  variables?: Record<string, string>;
  containerClassName?: string;
}

const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_\.\-]+)\s*\}\}/g;

export const VariableAwareInput: React.FC<Props> = ({ variables = {}, className = '', containerClassName = '', value = '', ...rest }) => {
  const { hasVars, allKnown } = useMemo(() => {
    const str = String(value ?? '');
    const found: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = VAR_REGEX.exec(str)) !== null) {
      found.push(m[1]);
    }
    if (found.length === 0) return { hasVars: false, allKnown: true };
    const allKnown = found.every((k) => Object.prototype.hasOwnProperty.call(variables, k));
    return { hasVars: true, allKnown };
  }, [value, variables]);

  const borderClass = hasVars
    ? (allKnown
        ? 'ring-2 ring-green-400 ring-inset rounded-md'
        : 'ring-2 ring-yellow-400 ring-inset rounded-md')
    : '';

  return (
    <div className={`relative ${borderClass} ${containerClassName}`}>
      <input
        value={value}
        className={`w-full border border-gray-300 rounded-md px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${className}`}
        {...rest}
      />
      {hasVars && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
          {allKnown ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-500" title="Unknown variable" />
          )}
        </div>
      )}
    </div>
  );
};


