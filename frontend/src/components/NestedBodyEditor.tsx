import React, { useMemo, useState } from 'react';
import { BodyField, MessageField, MessageSchemaMeta, OneofGroupMeta } from '../lib/types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Dropdown } from './Dropdown';

interface NestedBodyEditorProps {
  fields: MessageField[];
  values: BodyField[];
  onChange: (body: BodyField[]) => void;
  schema?: MessageSchemaMeta;
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
  // Special-case Timestamp: expect JSON object {seconds,nanos}
  if (field.message && field.messageType && field.messageType.includes('google.protobuf.Timestamp')) {
    let seconds = 0;
    let nanos = 0;
    try {
      if (value && value.trim().length > 0) {
        const obj = JSON.parse(value);
        seconds = Number(obj.seconds) || 0;
        nanos = Number(obj.nanos) || 0;
      }
    } catch (_) {}
    return (
      <div className="flex items-center space-x-2">
        <input
          type="number"
          value={seconds}
          onChange={(e) => onChange(JSON.stringify({ seconds: Number(e.target.value) || 0, nanos }))}
          placeholder="seconds"
          className="w-28 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <input
          type="number"
          value={nanos}
          onChange={(e) => onChange(JSON.stringify({ seconds, nanos: Number(e.target.value) || 0 }))}
          placeholder="nanos"
          className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
    );
  }

  // Enum dropdown
  if ((field as any).enum && Array.isArray((field as any).enumValues)) {
    const opts = (field as any).enumValues as string[];
    const current = value && opts.includes(value) ? value : (opts[0] || '');
    return (
      <Dropdown
        options={opts.map(o => ({ label: o, value: o }))}
        value={current}
        onChange={onChange}
        className="w-full"
      />
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
  schema?: MessageSchemaMeta;
}> = ({ node, valueMap, body, onBodyChange, level = 0, schema }) => {
  // Leaf node
  if (node.field && (!node.children || Object.keys(node.children!).length === 0)) {
    const v = valueMap[node.fullPath] ?? '';
    return (
      <div className="flex items-center space-x-3 py-1" style={{ marginLeft: level * 16 }}>
        <label className="w-64 text-sm text-gray-700 dark:text-gray-300">{node.name}</label>
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
  
  // Oneof detection from backend schema with optional enum controller sibling
  const detectOneofGroup = () => {
    if (!(schema && Array.isArray(schema.oneofs) && schema.oneofs.length > 0)) return null;
    const childKeys = new Set(entries.map(([k]) => k));
    const groupsInNode: { group: OneofGroupMeta; memberKeys: string[] }[] = [];
    for (const group of schema.oneofs) {
      const memberKeys = group.fields.filter(f => childKeys.has(f));
      if (memberKeys.length >= 2) groupsInNode.push({ group, memberKeys });
    }
    if (groupsInNode.length === 0) return null;
    const chosen = groupsInNode[0];
    // Prefer explicit enum controller sibling if present
    const enumSiblings = entries.filter(([, ch]) => ch.field && (ch.field as any).enum);
    const controllerTuple = enumSiblings.find(([key]) => !chosen.memberKeys.includes(key));
    let controllerKey: string | undefined;
    let controllerPath: string | undefined;
    let controllerValue: string | undefined;
    if (controllerTuple) {
      controllerKey = controllerTuple[0];
      controllerPath = (controllerTuple[1] as any).fullPath;
      if (controllerPath) controllerValue = valueMap[controllerPath] as string | undefined;
    }
    // If no controller, derive active by presence
    let active: string | undefined = controllerValue;
    if (!controllerKey) {
      active = chosen.memberKeys.find(member => {
        const prefix = node.fullPath ? `${node.fullPath}.${member}.` : `${member}.`;
        return Object.keys(valueMap).some(p => p.startsWith(prefix));
      });
    }
    return {
      controllerKey,
      controllerPath,
      controllerValue: active,
      oneofOptions: chosen.memberKeys,
      oneofGroupName: chosen.group.name,
      messageFields: entries.filter(([k]) => chosen.memberKeys.includes(k)).map(([key, node]) => ({ key, node })),
    } as any;
  };
  
  // Fallback: infer oneof groups from field metadata when schema is missing
  const detectOneofGroupFallback = () => {
    // Build map childKey -> set(oneofName) from descendants' leaf fields
    const childToOneofNames: Record<string, Set<string>> = {};
    const collectOneofNames = (node: TreeNode, acc: Set<string>) => {
      if (node.field && (node.field as any).oneof && node.field.oneofName) {
        acc.add(node.field.oneofName as string);
      }
      if (node.children) {
        Object.values(node.children).forEach(ch => collectOneofNames(ch, acc));
      }
    };
    for (const [key, child] of entries) {
      const s = new Set<string>();
      collectOneofNames(child, s);
      if (s.size > 0) childToOneofNames[key] = s;
    }
    if (Object.keys(childToOneofNames).length === 0) return null;
    // Group children by shared oneofName
    const nameToMembers: Record<string, string[]> = {};
    for (const [key, names] of Object.entries(childToOneofNames)) {
      names.forEach(n => {
        if (!nameToMembers[n]) nameToMembers[n] = [];
        nameToMembers[n].push(key);
      });
    }
    // Find any oneofName that has >= 2 members among this node's direct children
    const [groupName, members] = Object.entries(nameToMembers).find(([, members]) => members.length >= 2) || [] as any;
    if (!groupName || !members) return null;
    // Try to identify an enum controller sibling (not part of members)
    const enumSiblings = entries.filter(([, ch]) => ch.field && (ch.field as any).enum);
    const controllerTuple = enumSiblings.find(([key]) => !(members as string[]).includes(key));
    let controllerKey: string | undefined;
    let controllerPath: string | undefined;
    let controllerValue: string | undefined;
    if (controllerTuple) {
      controllerKey = controllerTuple[0];
      controllerPath = (controllerTuple[1] as any).fullPath;
      controllerValue = controllerPath ? valueMap[controllerPath] : undefined;
    }
    // If no controller found, infer active by presence
    let active = controllerValue as string | undefined;
    if (!controllerKey) {
      active = (members as string[]).find(member => {
        const prefix = node.fullPath ? `${node.fullPath}.${member}.` : `${member}.`;
        return Object.keys(valueMap).some(p => p.startsWith(prefix));
      });
    }
    return {
      controllerKey,
      controllerPath,
      controllerValue: active,
      oneofOptions: members as string[],
      oneofGroupName: groupName as string,
      messageFields: entries.filter(([k]) => (members as string[]).includes(k)).map(([key, node]) => ({ key, node })),
    } as any;
  };
  
  const oneofInfo = detectOneofGroup() || detectOneofGroupFallback();
  let visibleEntries = entries;
  
  if (oneofInfo) {
    const { controllerKey, controllerValue, oneofOptions } = oneofInfo;
    
    // Check if controller has a meaningful value (not undefined or default enum values)
    const hasValidControllerValue = !!controllerValue &&
      String(controllerValue).toLowerCase() !== 'undefined' &&
      !String(controllerValue).toLowerCase().startsWith('undefined_') &&
      String(controllerValue).trim() !== '';
    
    if (controllerKey && hasValidControllerValue) {
      // Show the controller and the matching oneof option
      visibleEntries = entries.filter(([key]) => {
        // If we had a controller field, always show it
        if (controllerKey && key === controllerKey) return true;
        
        // Show non-oneof fields (not in the oneofOptions list)
        if (oneofOptions && !oneofOptions.includes(key)) return true;
        
        // For oneof fields, only show the one that matches the controller value
        const keyLower = key.toLowerCase();
        const valueLower = String(controllerValue).toLowerCase();
        
        // Direct match
        if (keyLower === valueLower) return true;
        
        // Handle common protobuf naming patterns:
        // 1. Remove common suffixes (Type, Details, etc.)
        const keyBase = keyLower.replace(/(type|details|identity)$/, '');
        const valueBase = valueLower.replace(/(type|details|identity)$/, '');
        if (keyBase === valueBase) return true;
        
        // 2. Handle abbreviations (CreditCard -> cc)
        if (keyLower === 'cc' && valueBase === 'creditcard') return true;
        if (keyLower === 'ach' && valueBase === 'ach') return true;
        
        // 3. Handle underscored versions
        if (keyLower.replace(/[_-]/g, '') === valueLower.replace(/[_-]/g, '')) return true;
        
        // 4. Handle partial matches where one contains the other
        if (valueLower.includes(keyLower) || keyLower.includes(valueLower)) return true;
        
        return false;
      });
    } else if (controllerKey && !hasValidControllerValue) {
      // Explicit controller exists but is unset → hide all members but still show non-oneof siblings
      visibleEntries = entries.filter(([key]) => {
        if (key === controllerKey) return true;
        if (!oneofOptions) return true;
        return !oneofOptions.includes(key);
      });
    } else {
      // No controller sibling; use presence-only active selection
      visibleEntries = entries.filter(([key]) => {
        if (oneofOptions && !oneofOptions.includes(key)) return true;
        const keyPrefix = node.fullPath ? `${node.fullPath}.${key}.` : `${key}.`;
        return Object.keys(valueMap).some(p => p.startsWith(keyPrefix));
      });
    }
  }
  
  return (
    <div className="rounded-md" style={{ marginLeft: level * 12 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center px-1.5 py-1 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40"
      >
        {open ? <ChevronDown className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-300" /> : <ChevronRight className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-300" />}
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{node.name}</span>
        {oneofInfo && (
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            (oneof - {oneofInfo.controllerValue || `select ${oneofInfo.controllerKey}`})
          </span>
        )}
      </button>
      {open && (
        <div className="pl-3">
          {visibleEntries.map(([, child]) => (
            <NodeRenderer
              key={child.fullPath}
              node={child}
              valueMap={valueMap}
              body={body}
              onBodyChange={onBodyChange}
              level={(level || 0) + 1}
              schema={schema}
            />
          ))}
          {oneofInfo && !oneofInfo.controllerValue && (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic py-1">
              Select a {oneofInfo.controllerKey} above to see available fields
            </div>
          )}
          {oneofInfo && oneofInfo.controllerValue && visibleEntries.filter(([key]) => 
            oneofInfo.messageFields.some((mf: { key: string }) => mf.key === key)
          ).length === 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic py-1">
              No fields available for {oneofInfo.controllerValue}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const NestedBodyEditor: React.FC<NestedBodyEditorProps> = ({ fields, values, onChange, schema }) => {
  const tree = useMemo(() => buildTree(fields), [fields]);
  const valueMap = useMemo(() => getValueMap(values), [values]);

  const rootChildren = Object.entries(tree.children || {});

  return (
    <div className="space-y-3">
      {rootChildren.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm">No fields available for this message</div>
      ) : (
        <div className="space-y-2">
          {rootChildren.map(([, child]) => (
            <NodeRenderer
              key={child.fullPath}
              node={child}
              valueMap={valueMap}
              body={values}
              onBodyChange={onChange}
              schema={schema}
            />
          ))}
        </div>
      )}
    </div>
  );
};
