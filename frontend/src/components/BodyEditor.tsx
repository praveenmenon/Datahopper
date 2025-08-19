import React from 'react';
import { Plus, Trash2, Info, Zap } from 'lucide-react';
import { BodyField, MessageField } from '../lib/types';

interface BodyEditorProps {
  body: BodyField[];
  onChange: (body: BodyField[]) => void;
  protoMessage?: string;
  messageFields?: MessageField[];
  onGenerateFromProto?: (fields: MessageField[]) => void;
}

export const BodyEditor: React.FC<BodyEditorProps> = ({ 
  body, 
  onChange, 
  protoMessage, 
  messageFields, 
  onGenerateFromProto 
}) => {
  const addField = () => {
    onChange([...body, { path: '', value: '' }]);
  };

  const updateField = (index: number, field: 'path' | 'value', value: string) => {
    const newBody = [...body];
    newBody[index] = { ...newBody[index], [field]: value };
    onChange(newBody);
  };

  const removeField = (index: number) => {
    const newBody = body.filter((_, i) => i !== index);
    onChange(newBody);
  };

  const removeEmptyFields = () => {
    const newBody = body.filter(field => field.path.trim() || field.value.trim());
    onChange(newBody);
  };

  const getPathExamples = () => [
    'user.id',
    'user.email',
    'user.tags[0]',
    'user.profile.name',
    'items[0].id',
    'metadata.version'
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Request Body</h3>
        <div className="flex space-x-2">
          {protoMessage && onGenerateFromProto && (
            <button
              onClick={() => messageFields && messageFields.length > 0 && onGenerateFromProto(messageFields)}
              disabled={!messageFields || messageFields.length === 0}
              className={`inline-flex items-center text-xs ${(!messageFields || messageFields.length === 0) ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
              title={!messageFields || messageFields.length === 0 ? 'Loading proto fields…' : 'Generate fields from protobuf message'}
            >
              <Zap className="h-3 w-3 mr-1" />
              Generate from Proto
            </button>
          )}
          <button
            onClick={removeEmptyFields}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clean up
          </button>
          <button
            onClick={addField}
            className="inline-flex items-center text-xs text-primary-600 hover:text-primary-700 transition-colors"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Field
          </button>
        </div>
      </div>

      {body.length === 0 ? (
        <div className="text-center py-4 text-gray-500 dark:text-gray-300 text-sm">
          <p>No body fields defined</p>
          <p className="text-xs">Add fields to build your protobuf request body</p>
        </div>
      ) : (
        <div className="space-y-2">
          {body.map((field, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={field.path}
                onChange={(e) => updateField(index, 'path', e.target.value)}
                placeholder="Field path (e.g., user.email)"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <input
                type="text"
                value={field.value}
                onChange={(e) => updateField(index, 'value', e.target.value)}
                placeholder="Value (supports {{variables}})"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={() => removeField(index)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                title="Remove field"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Path Examples */}
      <div className="bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-md p-3">
        <div className="flex items-center space-x-2 mb-2">
          <Info className="h-4 w-4 text-gray-500 dark:text-gray-300" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Path Examples</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {getPathExamples().map((example, index) => (
            <code
              key={index}
              className="bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200 font-mono"
            >
              {example}
            </code>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">
          Use dot notation for nested fields and [index] for repeated fields. Values support {'{variable}'} interpolation.
        </p>
      </div>
    </div>
  );
};
