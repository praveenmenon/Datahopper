import React from 'react';
import { HeaderKeyInput } from './HeaderKeyInput';
import { Plus, Trash2 } from 'lucide-react';
import { HeaderKV } from '../lib/types';

interface HeadersEditorProps {
  headers: HeaderKV[];
  onChange: (headers: HeaderKV[]) => void;
}

export const HeadersEditor: React.FC<HeadersEditorProps> = ({ headers, onChange }) => {
  // Common request header suggestions (not exhaustive)
  const COMMON_HEADER_KEYS = [
    'Authorization',
    'Content-Type',
    'Accept',
    'Accept-Encoding',
    'Accept-Language',
    'User-Agent',
    'Cache-Control',
    'Pragma',
    'If-None-Match',
    'If-Match',
    'If-Modified-Since',
    'If-Unmodified-Since',
    'ETag',
    'Origin',
    'Referer',
    'Cookie',
    'X-Request-Id',
    'X-Correlation-Id',
    'X-API-Key',
    // Proto-friendly defaults
    'Accept: application/x-protobuf',
    'Content-Type: application/x-protobuf'
  ];
  const addHeader = () => {
    onChange([...headers, { key: '', value: '' }]);
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    onChange(newHeaders);
  };

  const removeHeader = (index: number) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    onChange(newHeaders);
  };

  const removeEmptyHeaders = () => {
    const newHeaders = headers.filter(header => header.key.trim() || header.value.trim());
    onChange(newHeaders);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Headers</h3>
        <div className="flex space-x-2">
          <button
            onClick={removeEmptyHeaders}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clean up
          </button>
          <button
            onClick={addHeader}
            className="inline-flex items-center text-xs text-primary-600 hover:text-primary-700 transition-colors"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Header
          </button>
        </div>
      </div>

      {headers.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm">
          <p>No headers defined</p>
          <p className="text-xs">Headers will be sent with your request</p>
        </div>
      ) : (
        <div className="space-y-2">
          {headers.map((header, index) => (
            <div key={index} className="flex items-center gap-2">
              <HeaderKeyInput
                value={header.key}
                onChange={(val) => updateHeader(index, 'key', val)}
                suggestions={COMMON_HEADER_KEYS}
                placeholder="Header name (e.g., Authorization)"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                containerClassName="flex-1"
              />
              <input
                type="text"
                value={header.value}
                onChange={(e) => updateHeader(index, 'value', e.target.value)}
                placeholder="Header value (supports {{variables}})"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={() => removeHeader(index)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Remove header"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {/* Combobox handles suggestions; datalist removed intentionally */}
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>• Use {'{variable}'} syntax to reference environment or collection variables</p>
        <p>• Content-Type and Accept headers will be set automatically for protobuf requests</p>
      </div>
    </div>
  );
};
