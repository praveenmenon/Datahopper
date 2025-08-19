import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { Environment } from '../lib/types';

interface EnvironmentModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initial?: Environment | null;
  onClose: () => void;
  onSave: (env: Environment) => Promise<void> | void;
}

export const EnvironmentModal: React.FC<EnvironmentModalProps> = ({
  isOpen,
  mode,
  initial,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const base = initial ?? { name: '', variables: {} };
      setName(base.name || '');
      const entries = Object.entries(base.variables || {}).map(([k, v]) => ({ key: k, value: v }));
      setRows(entries.length ? entries : [{ key: '', value: '' }]);
    }
  }, [isOpen, initial]);

  const addRow = () => setRows((r) => [...r, { key: '', value: '' }]);
  const updateRow = (i: number, field: 'key' | 'value', value: string) => {
    setRows((r) => {
      const copy = [...r];
      copy[i] = { ...copy[i], [field]: value } as any;
      return copy;
    });
  };
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    // allow empty variables, but if filled, require non-empty key
    for (const { key } of rows) {
      if (key.trim() === '' && rows.length > 1) return false;
    }
    return true;
  }, [name, rows]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const variables: Record<string, string> = {};
    rows.forEach(({ key, value }) => {
      const k = key.trim();
      if (k) variables[k] = value ?? '';
    });
    await Promise.resolve(onSave({ name: name.trim(), variables }));
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {mode === 'create' ? 'Create Environment' : `Edit Environment`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="local / staging / prod"
              className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
            />
          </div>

          {/* Variables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Variables</label>
              <button
                onClick={addRow}
                className="inline-flex items-center text-xs text-primary-600 hover:text-primary-700"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Variable
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => updateRow(idx, 'key', e.target.value)}
                    placeholder="key (e.g., base_url)"
                    className="w-1/3 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateRow(idx, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => removeRow(idx)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};


