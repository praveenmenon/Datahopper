import React, { useMemo, useState } from 'react';
import { BodyField, MessageField } from '../lib/types';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NestedBodyEditorProps {
  fields: MessageField[];
  values: BodyField[];
  onChange: (body: BodyField[]) => void;
}

interface TreeNode {
  name: string;
  fullPath: string;
  field?: MessageField; // present for leaves
  children?: Record<string, TreeNode>;
}

function buildTree(fields: MessageField[]): TreeNode {
  const root: TreeNode = { name: 'root', fullPath: '', children: {} };
  for (const f of fields) {
    const path = (f.path || f.name || '').trim();
    if (!path) continue;
    const parts = path.split('.');
    let cursor = root;
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}.${part}` : part;
      if (!cursor.children) cursor.children = {};
      if (!cursor.children[part]) {
        cursor.children[part] = { name: part, fullPath: acc, children: {} };
      }
      cursor = cursor.children[part];
    }
    cursor.field = f; // leaf
  }
  return root;
}

function getValueMap(values: BodyField[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of values) {
    if (v.path) map[v.path] = String(v.value ?? '');
  }
  return map;
}

function setValueInBody(path: string, value: string, body: BodyField[]): BodyField[] {
  const idx = body.findIndex(b => b.path === path);
  if (idx === -1) return [...body, { path, value }];
  const newBody = [...body];
  newBody[idx] = { ...newBody[idx], value };
  return newBody;
}

const FieldInput: React.FC<{
  field: MessageField;
  value: string;
  onChange: (v: string) => void;
}> = ({ field, value, onChange }) => {
  // Enum dropdown
  if ((field as any).enum && Array.isArray((field as any).enumValues)) {
    const opts = (field as any).enumValues as string[];
    return (
      <select
        value={value || (opts[0] || '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      >
        {opts.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  const t = (field.type || '').toUpperCase();
  if (t === 'BOOL' || t === 'TYPE_BOOL') {
    return (
      <input
        type="checkbox"
        checked={value === 'true'}
        onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
        className="h-4 w-4"
      />
    );
  }
  if (
    ['INT32','INT64','UINT32','UINT64','SINT32','SINT64','FIXED32','FIXED64','SFIXED32','SFIXED64','TYPE_INT32','TYPE_INT64','TYPE_UINT32','TYPE_UINT64','TYPE_SINT32','TYPE_SINT64','TYPE_FIXED32','TYPE_FIXED64','TYPE_SFIXED32','TYPE_SFIXED64'].includes(t)
  ) {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    );
  }
  if (t === 'FLOAT' || t === 'DOUBLE' || t === 'TYPE_FLOAT' || t === 'TYPE_DOUBLE') {
    return (
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    );
  }
  // Default text input (string/bytes/enum/unknown)
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.message ? '{}' : ''}
      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
    />
  );
};

const NodeRenderer: React.FC<{
  node: TreeNode;
  valueMap: Record<string, string>;
  body: BodyField[];
  onBodyChange: (next: BodyField[]) => void;
  level?: number;
}> = ({ node, valueMap, body, onBodyChange, level = 0 }) => {
  // Leaf node
  if (node.field && (!node.children || Object.keys(node.children!).length === 0)) {
    const v = valueMap[node.fullPath] ?? '';
    return (
      <div className="flex items-center space-x-3 py-1" style={{ marginLeft: level * 16 }}>
        <label className="w-64 text-sm text-gray-700">{node.name}</label>
        <div className="flex-1">
          <FieldInput
            field={node.field}
            value={v}
            onChange={(nv) => onBodyChange(setValueInBody(node.fullPath, nv, body))}
          />
        </div>
      </div>
    );
  }

  // Group node
  const [open, setOpen] = useState(true);
  const entries = Object.entries(node.children || {});
  return (
    <div className="rounded-md" style={{ marginLeft: level * 12 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center px-1.5 py-1 text-left hover:bg-gray-50"
      >
        {open ? <ChevronDown className="h-4 w-4 mr-1 text-gray-500" /> : <ChevronRight className="h-4 w-4 mr-1 text-gray-500" />}
        <span className="text-sm font-medium text-gray-900">{node.name}</span>
      </button>
      {open && (
        <div className="pl-3">
          {entries.map(([key, child]) => (
            <NodeRenderer
              key={child.fullPath}
              node={child}
              valueMap={valueMap}
              body={body}
              onBodyChange={onBodyChange}
              level={(level || 0) + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const NestedBodyEditor: React.FC<NestedBodyEditorProps> = ({ fields, values, onChange }) => {
  const tree = useMemo(() => buildTree(fields), [fields]);
  const valueMap = useMemo(() => getValueMap(values), [values]);

  const rootChildren = Object.entries(tree.children || {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Request Body</h3>
      </div>

      {rootChildren.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm">No fields available for this message</div>
      ) : (
        <div className="space-y-2">
          {rootChildren.map(([key, child]) => (
            <NodeRenderer
              key={child.fullPath}
              node={child}
              valueMap={valueMap}
              body={values}
              onBodyChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};
