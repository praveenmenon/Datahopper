import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

type JsonPrimitive = string | number | boolean | null;

interface JsonViewerProps {
  data: any;
  showLineNumbers?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

type ExpandedMap = Set<string>;

export const JsonViewer: React.FC<JsonViewerProps> = ({ data, showLineNumbers = true, defaultExpanded = true, className }) => {
  const buildExpandedSet = React.useCallback((value: any): ExpandedMap => {
    const paths = new Set<string>();
    const walk = (v: any, path: string) => {
      const isArray = Array.isArray(v);
      const isObject = !isArray && typeof v === 'object' && v !== null;
      if (isArray || isObject) {
        paths.add(path);
        const entries = isArray ? (v as any[]).map((child, i) => [String(i), child] as [string, any]) : Object.entries(v as Record<string, any>);
        for (const [k, child] of entries) {
          walk(child, `${path}.${k}`);
        }
      }
    };
    if (defaultExpanded) walk(value, 'root');
    return paths;
  }, [defaultExpanded]);

  const [expanded, setExpanded] = React.useState<ExpandedMap>(() => buildExpandedSet(data));

  React.useEffect(() => {
    // Recompute expanded nodes when data changes so new responses start expanded
    setExpanded(buildExpandedSet(data));
  }, [data, buildExpandedSet]);

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  let line = 0;

  const LineNumber: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-right pr-3 select-none text-gray-400 dark:text-gray-500 tabular-nums">
      {children}
    </div>
  );

  const IndentGuides: React.FC<{ depth: number }> = ({ depth }) => (
    <div className="flex items-stretch">
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="w-4 border-l border-gray-200 dark:border-gray-700/60 mr-2" />
      ))}
    </div>
  );

  const KeyLabel: React.FC<{ label: string }> = ({ label }) => (
    <span className="text-indigo-700 dark:text-indigo-300">"{label}"</span>
  );

  const Value: React.FC<{ value: JsonPrimitive }> = ({ value }) => {
    if (value === null) return <span className="text-pink-600 dark:text-pink-300">null</span>;
    switch (typeof value) {
      case 'string':
        return <span className="text-green-700 dark:text-green-300">"{value}"</span>;
      case 'number':
        return <span className="text-amber-600 dark:text-amber-300">{String(value)}</span>;
      case 'boolean':
        return <span className="text-purple-600 dark:text-purple-300">{String(value)}</span>;
      default:
        return <span className="text-gray-700 dark:text-gray-200">{String(value)}</span>;
    }
  };

  const renderNode = (key: string | null, value: any, path: string, depth: number): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const isArray = Array.isArray(value);
    const isObject = !isArray && typeof value === 'object' && value !== null;

    const makeRow = (content: React.ReactNode) => {
      line += 1;
      return (
        <div key={`${path}__${line}`} className="grid" style={{ gridTemplateColumns: showLineNumbers ? '3rem 1fr' : '1fr' }}>
          {showLineNumbers && <LineNumber>{line}</LineNumber>}
          <div className="flex items-start font-mono text-xs text-gray-800 dark:text-gray-100">
            <IndentGuides depth={depth} />
            <div className="flex-1 whitespace-pre-wrap break-words">{content}</div>
          </div>
        </div>
      );
    };

    if (isObject || isArray) {
      const nodeKey = path || 'root';
      const open = expanded.has(nodeKey);
      const count = isArray ? value.length : Object.keys(value).length;
      const opener = isArray ? '[' : '{';
      const closer = isArray ? ']' : '}';

      rows.push(
        makeRow(
          <div className="inline-flex items-center">
            <button
              className="inline-flex items-center mr-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={() => toggle(nodeKey)}
              aria-label={open ? 'Collapse' : 'Expand'}
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {key !== null && (
              <>
                <KeyLabel label={key} />
                <span className="text-gray-500">: </span>
              </>
            )}
            <span className="text-gray-500">{opener}</span>
            {!open && (
              <span className="text-gray-500 ml-1">{isArray ? `${count} item${count === 1 ? '' : 's'}` : `${count} key${count === 1 ? '' : 's'}`}</span>
            )}
          </div>
        )
      );

      if (open) {
        const entries = isArray ? (value as any[]).map((v, i) => [String(i), v] as [string, any]) : Object.entries(value as Record<string, any>);
        entries.forEach(([k, v]) => {
          const child = renderNode(isArray ? null : k, v, `${nodeKey}.${k}`, depth + 1);
          rows.push(...child);
        });
        rows.push(makeRow(<span className="text-gray-500">{closer}</span>));
      }
      return rows;
    }

    // primitive
    rows.push(
      makeRow(
        <>
          {key !== null && (
            <>
              <KeyLabel label={key} />
              <span className="text-gray-500">: </span>
            </>
          )}
          <Value value={value as JsonPrimitive} />
        </>
      )
    );
    return rows;
  };

  return (
    <div className={clsx("bg-gray-50 dark:bg-gray-900 p-3 rounded-md overflow-auto h-full", className)}>
      {renderNode(null, data, 'root', 0)}
    </div>
  );
};


