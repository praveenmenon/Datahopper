import React from 'react';
import { Eye, AlertCircle } from 'lucide-react';
import { Collection, Environment, HeaderKV, BodyField } from '../lib/types';

interface VariablesPreviewProps {
  collection: Collection | null;
  environment: Environment | null;
  url: string;
  headers: HeaderKV[];
  body: BodyField[];
  showResolvedBody?: boolean; // new optional flag
  variablesOverride?: Record<string, string>;
}

export const VariablesPreview: React.FC<VariablesPreviewProps> = ({
  collection,
  environment,
  url,
  headers,
  body,
  showResolvedBody = true,
  variablesOverride,
}) => {
  const getVariables = () => {
    if (variablesOverride) return variablesOverride;
    const variables: Record<string, string> = {};
    
    // Collection variables (base)
    if (collection?.variables) {
      Object.assign(variables, collection.variables);
    }
    
    // Environment variables (override collection)
    if (environment?.variables) {
      Object.assign(variables, environment.variables);
    }
    
    return variables;
  };

  const interpolateText = (text: string, variables: Record<string, string>) => {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  };

  const getResolvedUrl = () => {
    const variables = getVariables();
    return interpolateText(url, variables);
  };

  const getResolvedHeaders = () => {
    const variables = getVariables();
    return headers.map(header => ({
      ...header,
      resolvedValue: interpolateText(header.value, variables)
    }));
  };

  const getResolvedBody = () => {
    const variables = getVariables();
    return body.map(field => ({
      ...field,
      resolvedValue: interpolateText(field.value, variables)
    }));
  };

  const variables = getVariables();
  const resolvedUrl = getResolvedUrl();
  const resolvedHeaders = getResolvedHeaders();
  const resolvedBody = getResolvedBody();

  const hasUnresolvedVariables = (text: string) => {
    return /\{\{[^}]+\}\}/.test(text);
  };

  return (
    <div className="space-y-4 text-gray-900 dark:text-white">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white">Variables Preview</h3>
      
      {/* Available Variables */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Available Variables</h4>
        {Object.keys(variables).length === 0 ? (
          <p className="text-xs text-gray-500">No variables defined</p>
        ) : (
          <div className="space-y-1">
            {Object.entries(variables).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <code className="text-primary-600 font-mono">{`{${key}}`}</code>
                <span className="text-gray-600 truncate max-w-32" title={value}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* URL Preview */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
          <Eye className="h-3 w-3 mr-1" />
          Resolved URL
        </h4>
        {url ? (
          <div className="space-y-1">
            <div className="text-xs text-gray-500 dark:text-gray-400">Template:</div>
            <code className="block text-xs bg-gray-100 dark:bg-gray-700 dark:text-gray-100 p-2 rounded font-mono break-all">
              {url}
            </code>
            <div className="text-xs text-gray-500 dark:text-gray-400">Resolved:</div>
            <code className={`block text-xs p-2 rounded font-mono break-all ${
              hasUnresolvedVariables(resolvedUrl) 
                ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' 
                : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
            }`}>
              {resolvedUrl || 'No URL specified'}
            </code>
            {hasUnresolvedVariables(resolvedUrl) && (
              <div className="flex items-center text-xs text-yellow-600 dark:text-yellow-300">
                <AlertCircle className="h-3 w-3 mr-1" />
                Contains unresolved variables
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No URL specified</p>
        )}
      </div>

      {/* Headers Preview */}
      {headers.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Resolved Headers</h4>
          <div className="space-y-1">
            {resolvedHeaders.map((header, index) => (
              <div key={index} className="text-xs">
                <div className="flex justify-between">
                  <span className="font-medium">{header.key || 'Unnamed'}</span>
                  {hasUnresolvedVariables(header.resolvedValue) && (
                    <span className="text-yellow-600 dark:text-yellow-300 text-xs">Unresolved</span>
                  )}
                </div>
                <code className={`block text-xs p-1 rounded font-mono break-all ${
                  hasUnresolvedVariables(header.resolvedValue) 
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' 
                    : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                }`}>
                  {header.resolvedValue || '(empty)'}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body Preview (optional) */}
      {showResolvedBody && body.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Resolved Body</h4>
          <div className="space-y-1">
            {resolvedBody.map((field, index) => (
              <div key={index} className="text-xs">
                <div className="flex justify-between">
                  <span className="font-mono">{field.path || 'Unnamed'}</span>
                  {hasUnresolvedVariables(field.resolvedValue) && (
                    <span className="text-yellow-600 dark:text-yellow-300 text-xs">Unresolved</span>
                  )}
                </div>
                <code className={`block text-xs p-1 rounded font-mono break-all ${
                  hasUnresolvedVariables(field.resolvedValue) 
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' 
                    : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                }`}>
                  {field.resolvedValue || '(empty)'}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variable Precedence Info */}
      <div className="bg-blue-50 dark:bg-blue-900 rounded-md p-3">
        <h4 className="text-xs font-medium text-blue-700 dark:text-blue-200 mb-1">Variable Precedence</h4>
        <div className="text-xs text-blue-600 dark:text-blue-300 space-y-1">
          <p>1. Environment variables (highest priority)</p>
          <p>2. Collection variables (base values)</p>
          <p>3. No variables (fallback)</p>
        </div>
      </div>
    </div>
  );
};
