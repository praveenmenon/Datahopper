import React, { useState, useEffect } from 'react';
import { Play, Save, Eye } from 'lucide-react';
import { Collection, Environment, MessageType, BodyField, HeaderKV, MessageField, RunRequest } from '../lib/types';
import { BodyEditor } from './BodyEditor';
import { NestedBodyEditor } from './NestedBodyEditor';
import { HeadersEditor } from './HeadersEditor';
import { ResponsePanel } from './ResponsePanel';
import { VariablesPreview } from './VariablesPreview';
import { useRunRequest, useUpdateRequest } from '../lib/useData';
import { protoApi } from '../lib/api';

interface RequestEditorProps {
  collection: Collection | null;
  requestId: string | null;
  environment: Environment | null;
  messageTypes: MessageType[];
  onRequestRun: (response: any) => void;
}

export const RequestEditor: React.FC<RequestEditorProps> = ({
  collection,
  requestId,
  environment,
  messageTypes,
  onRequestRun
}) => {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [protoMessage, setProtoMessage] = useState('');
  const [responseType, setResponseType] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [headers, setHeaders] = useState<HeaderKV[]>([]);
  const [body, setBody] = useState<BodyField[]>([]);
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageFields, setMessageFields] = useState<MessageField[]>([]);

  const runRequest = useRunRequest();
  const updateRequest = useUpdateRequest();

  // Load request data when selected
  useEffect(() => {
    if (collection && requestId) {
      const request = collection.requests.find(r => r.id === requestId);
      if (request) {
        setMethod(request.method);
        setUrl(request.url);
        setProtoMessage(request.protoMessage || '');
        setResponseType(request.responseType || '');
        setTimeoutSeconds(request.timeoutSeconds || 30);
        setHeaders(request.headers || []);
        setBody(request.body || []);
      }
    }
  }, [collection, requestId]);

  // Helper
  const isTimestamp = (field: MessageField) => !!(field.message && field.messageType && field.messageType.includes('google.protobuf.Timestamp'));

  // Load message fields when proto message changes
  useEffect(() => {
    if (protoMessage) {
      protoApi.getMessageFields(protoMessage)
        .then(response => {
          setMessageFields(response.fields);
        })
        .catch(err => {
          console.error('Failed to load message fields:', err);
          setMessageFields([]);
        });
    } else {
      setMessageFields([]);
    }
  }, [protoMessage]);

  // Auto-generate body from proto on selection if body is empty
  useEffect(() => {
    if (!protoMessage) return;
    if (body && body.length > 0) return; // don't overwrite user content
    if (!messageFields || messageFields.length === 0) return;

    const generatedFields: BodyField[] = messageFields
      .filter(f => !isTimestamp(f))
      .map(field => ({
        path: field.path || field.name,
        value: getDefaultValueForField(field)
      }));
    setBody(generatedFields);
  }, [protoMessage, messageFields]);

  // Manual generate button handler (overwrites current body)
  const handleGenerateFromProtoClick = (fields: MessageField[]) => {
    if (!fields || fields.length === 0) return;
    const overwrite = body.length === 0 || window.confirm('Replace current body with fields from the selected proto?');
    if (!overwrite) return;
    const generated: BodyField[] = fields
      .filter(f => !isTimestamp(f))
      .map(f => ({
        path: f.path || f.name,
        value: getDefaultValueForField(f),
      }));
    setBody(generated);
  };

  // Get default value for a protobuf field
  const getDefaultValueForField = (field: MessageField): string => {
    if (field.repeated) {
      return '[]';
    }

    // Prefer enum default if available
    if ((field as any).enum && Array.isArray((field as any).enumValues)) {
      const opts = (field as any).enumValues as string[];
      return opts[0] || '';
    }

    const t = (field.type || '').toUpperCase();

    switch (t) {
      case 'STRING':
      case 'TYPE_STRING':
        return '';
      case 'INT32':
      case 'INT64':
      case 'UINT32':
      case 'UINT64':
      case 'SINT32':
      case 'SINT64':
      case 'FIXED32':
      case 'FIXED64':
      case 'SFIXED32':
      case 'SFIXED64':
      case 'TYPE_INT32':
      case 'TYPE_INT64':
      case 'TYPE_UINT32':
      case 'TYPE_UINT64':
      case 'TYPE_SINT32':
      case 'TYPE_SINT64':
      case 'TYPE_FIXED32':
      case 'TYPE_FIXED64':
      case 'TYPE_SFIXED32':
      case 'TYPE_SFIXED64':
        return '0';
      case 'FLOAT':
      case 'DOUBLE':
      case 'TYPE_FLOAT':
      case 'TYPE_DOUBLE':
        return '0.0';
      case 'BOOL':
      case 'TYPE_BOOL':
        return 'false';
      case 'BYTES':
      case 'TYPE_BYTES':
        return '';
      default:
        // For nested messages or unknown kinds, use object placeholder
        return field.message ? '{}' : '';
    }
  };

  // Update resolved URL when variables change
  useEffect(() => {
    if (url && environment) {
      let resolved = url;
      Object.entries(environment.variables).forEach(([key, value]) => {
        resolved = resolved.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
      setResolvedUrl(resolved);
    } else {
      setResolvedUrl(url);
    }
  }, [url, environment]);

  const handleSend = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Merge variables (environment overrides collection)
      const variables: Record<string, string> = {};
      if (collection?.variables) {
        Object.assign(variables, collection.variables);
      }
      if (environment?.variables) {
        Object.assign(variables, environment.variables);
      }

      // Convert headers to map
      const headersMap: Record<string, string> = {};
      headers.forEach(header => {
        if (header.key.trim()) {
          headersMap[header.key.trim()] = header.value;
        }
      });

      const requestData: RunRequest = {
        method,
        url,
        protoMessage: protoMessage || undefined,
        responseType: responseType || undefined,
        headers: headersMap,
        body,
        timeoutSeconds,
        variables
      };

      const response = await runRequest.mutateAsync(requestData);
      setResponse(response);
      onRequestRun(response);
    } catch (error) {
      console.error('Failed to run request:', error);
      setError(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!collection || !requestId) return;

    try {
      const requestData = {
        method,
        url,
        protoMessage: protoMessage || undefined,
        responseType: responseType || undefined,
        headers,
        body,
        timeoutSeconds
      };

      await updateRequest.mutateAsync({
        collectionId: collection.id,
        requestId,
        data: requestData
      });
    } catch (error) {
      console.error('Failed to save request:', error);
      // You could show an error toast here
    }
  };

  if (!collection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg">Select a collection to get started</p>
          <p className="text-sm">Or create a new collection to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Request Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          {/* Method Selector */}
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* URL Input */}
          <div className="flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL (supports {{variables}})"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Resolved URL Preview */}
          {resolvedUrl !== url && (
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Eye className="h-4 w-4" />
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                {resolvedUrl}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              disabled={updateRequest.isLoading || !requestId}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateRequest.isLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleSend}
              disabled={runRequest.isLoading || !url.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="h-4 w-4 mr-2" />
              {runRequest.isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Request Configuration */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Headers, Body, etc. */}
        <div className="flex-1 flex flex-col border-r border-gray-200">
          {/* Protobuf Configuration */}
          <div className="border-b border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Protobuf Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Message Type
                </label>
                <select
                  value={protoMessage}
                  onChange={(e) => setProtoMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select message type</option>
                  {messageTypes.map((msg, index) => (
                    <option key={index} value={msg.fqName}>{msg.fqName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Response Message Type
                </label>
                <select
                  value={responseType}
                  onChange={(e) => setResponseType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select message type</option>
                  {messageTypes.map((msg, index) => (
                    <option key={index} value={msg.fqName}>{msg.fqName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Headers */}
          <div className="p-4">
            <HeadersEditor headers={headers} onChange={setHeaders} />
          </div>

          {/* Body */}
          {(method !== 'GET' || protoMessage) && (
            <div className="p-4 border-t border-gray-200">
              {messageFields && messageFields.length > 0 ? (
                <NestedBodyEditor
                  fields={messageFields}
                  values={body}
                  onChange={setBody}
                />
              ) : (
                <BodyEditor
                  body={body}
                  onChange={setBody}
                  protoMessage={protoMessage}
                  messageFields={messageFields}
                  onGenerateFromProto={handleGenerateFromProtoClick}
                />
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Variables/Preview */}
        <div className="w-80 p-4 bg-gray-50">
          <VariablesPreview 
            collection={collection}
            environment={environment}
            url={url}
            headers={headers}
            body={body}
            showResolvedBody={false}
          />
        </div>

      </div>

      {/* Response Panel */}
      <div className="border-t border-gray-200 h-96">
        <ResponsePanel
          response={response}
          isLoading={isLoading}
          error={error || undefined}
        />
      </div>
    </div>
  );
};
