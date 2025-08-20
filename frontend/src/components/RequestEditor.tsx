import React, { useState, useEffect, useRef } from 'react';
import { Play, Save, Eye, Code2, List } from 'lucide-react';
import clsx from 'clsx';
import { Collection, Environment, MessageType, BodyField, HeaderKV, MessageField, RunRequest } from '../lib/types';
import { BodyEditor } from './BodyEditor';
import { VariableAwareInput } from './VariableAwareInput';
import { NestedBodyEditor } from './NestedBodyEditor';
import { HeadersEditor } from './HeadersEditor';
import { ResponsePanel } from './ResponsePanel';
import { VariablesPreview } from './VariablesPreview';
import { useRunRequest } from '../lib/useData';
import { protoApi, saveRequest as saveRequestApi } from '../lib/api';
import { MessageSchemaMeta } from '../lib/types';
import { useQueryClient } from 'react-query';
import { Dropdown } from './Dropdown';

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
  const [requestName, setRequestName] = useState('Untitled Request');
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [protoMessage, setProtoMessage] = useState('');
  const [responseType, setResponseType] = useState('');
  const [errorResponseType, setErrorResponseType] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [headers, setHeaders] = useState<HeaderKV[]>([]);
  const [body, setBody] = useState<BodyField[]>([]);
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageFields, setMessageFields] = useState<MessageField[]>([]);
  const [schema, setSchema] = useState<MessageSchemaMeta | null>(null);
  const [activeLeftTab, setActiveLeftTab] = useState<'proto' | 'headers'>('proto');
  const [showVariables, setShowVariables] = useState<boolean>(true);

  const runRequest = useRunRequest();
  const queryClient = useQueryClient();

  // Track last seen requestId to avoid unnecessary clears on collection refetches
  const lastRequestIdRef = useRef<string | null>(null);

  // Load request data when selected; clear only when requestId actually changes to empty
  useEffect(() => {
    const lastId = lastRequestIdRef.current;

    if (collection && requestId) {
      const request = collection.requests.find(r => r.id === requestId);
      if (request) {
        setRequestName(request.name || 'Untitled Request');
        setMethod(request.method);
        setUrl(request.url);
        setProtoMessage(request.protoMessage || '');
        setResponseType(request.responseType || '');
        setErrorResponseType((request as any).errorResponseType || '');
        setTimeoutSeconds(request.timeoutSeconds || 30);
        setHeaders(request.headers || []);
        setBody(request.body || []);
        // Prefer server-stored last response if available, else fallback to localStorage
        if ((request as any).lastResponse) {
          setResponse((request as any).lastResponse);
        } else {
          try {
            const cached = localStorage.getItem(`requestResp:${requestId}`);
            if (cached) {
              setResponse(JSON.parse(cached));
            } else {
              setResponse(null);
            }
          } catch {
            setResponse(null);
          }
        }
        lastRequestIdRef.current = requestId;
        return;
      }
    }
    // New/unsaved request path: clear editor only on transition (when id actually changed)
    if (collection && !requestId && lastId !== requestId) {
      setRequestName('Untitled Request');
      setMethod('GET');
      setUrl('');
      setProtoMessage('');
      setResponseType('');
      setErrorResponseType('');
      setTimeoutSeconds(30);
      setHeaders([]);
      setBody([]);
      setMessageFields([]);
      setSchema(null);
      setResponse(null);
      lastRequestIdRef.current = requestId || null;
    }
    // Also clear everything if no collection selected
    if (!collection) {
      setRequestName('Untitled Request');
      setMethod('GET');
      setUrl('');
      setProtoMessage('');
      setResponseType('');
      setErrorResponseType('');
      setTimeoutSeconds(30);
      setHeaders([]);
      setBody([]);
      setMessageFields([]);
      setSchema(null);
      setResponse(null);
    }
  }, [collection, requestId]);

  // Helper
  const isTimestamp = (field: MessageField) => !!(field.message && field.messageType && field.messageType.includes('google.protobuf.Timestamp'));

  // Load message fields when proto message changes
  useEffect(() => {
    if (protoMessage) {
      // Try advanced schema first; if unavailable, fall back to fields
      (async () => {
        try {
          const s = await protoApi.getMessageSchema(protoMessage);
          setSchema(s);
        } catch (e) {
          setSchema(null);
        }
        try {
          const response = await protoApi.getMessageFields(protoMessage);
          setMessageFields(response.fields);
        } catch (err) {
          console.error('Failed to load message fields:', err);
          setMessageFields([]);
        }
      })();
    } else {
      setMessageFields([]);
      setSchema(null);
    }
  }, [protoMessage]);

  // Auto-generate body from proto on selection if body is empty
  useEffect(() => {
    if (!protoMessage) return;
    if (body && body.length > 0) return; // don't overwrite user content
    if (!messageFields || messageFields.length === 0) return;

    // Build set of oneof member prefixes (like paymentMethod.details.cc)
    const oneofPrefixes = new Set<string>();
    messageFields.forEach((f) => {
      if ((f as any).oneof && f.message && (f.path || f.name)) {
        const p = (f.path || f.name)!;
        oneofPrefixes.add(p);
      }
    });

    const generatedFields: BodyField[] = messageFields
      .filter(f => !isTimestamp(f))
      // Do not pre-generate any oneof member fields. They become visible only when selected.
      .filter(f => {
        if ((f as any).oneof) return false; // direct member
        const p = (f.path || f.name) || '';
        // Skip leaves that live under any oneof member prefix
        for (const pref of oneofPrefixes) {
          if (p.startsWith(pref + '.')) return false;
        }
        return true;
      })
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
    const oneofPrefixes2 = new Set<string>();
    fields.forEach((f) => {
      if ((f as any).oneof && f.message && (f.path || f.name)) {
        const p = (f.path || f.name)!;
        oneofPrefixes2.add(p);
      }
    });

    const generated: BodyField[] = fields
      .filter(f => !isTimestamp(f))
      // Exclude oneof members from bulk generation
      .filter(f => {
        if ((f as any).oneof) return false;
        const p = (f.path || f.name) || '';
        for (const pref of oneofPrefixes2) {
          if (p.startsWith(pref + '.')) return false;
        }
        return true;
      })
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

  // Compute resolved URL inline when needed (env overrides collection)
  const resolvedUrl = React.useMemo(() => {
    let resolved = url || '';
    const merged: Record<string, string> = {};
    if (collection?.variables) Object.assign(merged, collection.variables);
    if (environment?.variables) Object.assign(merged, environment.variables);
    Object.entries(merged).forEach(([k, v]) => {
      resolved = resolved.replace(new RegExp(`{{${k}}}`, 'g'), v);
    });
    return resolved;
  }, [url, environment, collection]);

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

      // Merge saved request body (if any) with in-editor changes so unchanged fields are also sent
      let effectiveBody = body;
      if (collection?.requests && requestId) {
        const saved = collection.requests.find(r => r.id === requestId);
        if (saved && Array.isArray(saved.body)) {
          const merged: Record<string, any> = {};
          // seed with saved
          saved.body.forEach((b) => { if (b.path) merged[b.path] = b.value; });
          // overlay edits
          body.forEach((b) => { if (b.path) merged[b.path] = b.value; });
          effectiveBody = Object.entries(merged).map(([path, value]) => ({ path, value }));
        }
      }

      const requestData: RunRequest = {
        method,
        url,
        protoMessage: protoMessage || undefined,
        responseType: responseType || undefined,
        errorResponseType: errorResponseType || undefined,
        headers: headersMap,
        body: effectiveBody,
        timeoutSeconds,
        variables
      } as any;

      try { console.log('Sending body fields:', effectiveBody); } catch {}
      // Attach identifiers for backend persistence when available
      (requestData as any).collectionId = collection?.id || undefined;
      (requestData as any).requestId = requestId || undefined;

      const resp = await runRequest.mutateAsync(requestData);
      setResponse(resp);
      // Cache last response
      if (requestId) {
        try { localStorage.setItem(`requestResp:${requestId}`, JSON.stringify(resp)); } catch {}
      }
      onRequestRun(resp);
      // Do NOT invalidate collections here; refetch would rehydrate editor from saved
      // request and overwrite unsaved in-editor changes (e.g., firstName).
      // Collections will refresh on explicit save or navigation.
    } catch (error) {
      console.error('Failed to run request:', error);
      setError(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!collection) return;

    try {
      // Convert headers to map for payload
      const headersMap: Record<string, any> = {};
      headers.forEach(h => {
        if (h.key.trim()) headersMap[h.key.trim()] = h.value;
      });

      const bodyModel: Record<string, any> = {};
      // Flatten BodyField[] into a simple object; keep as a map of path->value
      body.forEach(b => {
        if (b.path) bodyModel[b.path] = b.value;
      });

      const payload = {
        collection: collection.id ? { id: collection.id } : { name: collection.name, description: (collection as any).description },
        request: {
          id: requestId || undefined,
          name: requestName || 'Untitled Request',
          verb: method,
          url,
          headers: headersMap,
          bodyModel,
          protoMessageFqmn: protoMessage || undefined,
          responseMessageFqmn: responseType || undefined,
          errorResponseMessageFqmn: errorResponseType || undefined,
          timeoutMs: timeoutSeconds * 1000,
        }
      };

      const saved = await saveRequestApi(payload as any);
      // If this was a newly created request and we have a current response, cache it under the new id
      if (!requestId && saved && (saved as any).request && (saved as any).request.id && response) {
        try { localStorage.setItem(`requestResp:${(saved as any).request.id}`, JSON.stringify(response)); } catch {}
      }
      // Immediately refresh collections so the sidebar shows the saved request
      queryClient.invalidateQueries('collections');
      if (collection.id) {
        queryClient.invalidateQueries(['collection', collection.id]);
      }
    } catch (error) {
      console.error('Failed to save request:', error);
    }
  };

  if (!collection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-300">
          <p className="text-lg">Select a collection to get started</p>
          <p className="text-sm">Or create a new collection to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 dark:text-white">
      {/* Request Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 pb-[9px] relative z-40">
        <div className="space-y-3">
          {/* Row 1: Request name (left) + Save (right) */}
          <div className="flex items-center justify-between">
            <input
              type="text"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="Request name"
              className="w-64 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={handleSave}
              disabled={!collection}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {'Save'}
            </button>
          </div>

          {/* Row 2: Method + URL + Send */}
          <div className="flex items-center space-x-4">
            <div className="w-28">
              <Dropdown
                options={['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m => ({ label: m, value: m }))}
                value={method}
                onChange={setMethod}
                labelClassName={
                  method === 'GET' ? 'text-green-600 dark:text-green-400' :
                  method === 'POST' ? 'text-blue-600 dark:text-blue-400' :
                  method === 'PUT' ? 'text-amber-600 dark:text-amber-400' :
                  method === 'PATCH' ? 'text-yellow-600 dark:text-yellow-400' :
                  method === 'DELETE' ? 'text-red-600 dark:text-red-400' :
                  method === 'HEAD' ? 'text-purple-600 dark:text-purple-400' :
                  method === 'OPTIONS' ? 'text-cyan-600 dark:text-cyan-400' :
                  undefined
                }
                itemClassNameFn={(opt) => (
                  opt.value === 'GET' ? 'text-green-600 dark:text-green-400' :
                  opt.value === 'POST' ? 'text-blue-600 dark:text-blue-400' :
                  opt.value === 'PUT' ? 'text-amber-600 dark:text-amber-400' :
                  opt.value === 'PATCH' ? 'text-yellow-600 dark:text-yellow-400' :
                  opt.value === 'DELETE' ? 'text-red-600 dark:text-red-400' :
                  opt.value === 'HEAD' ? 'text-purple-600 dark:text-purple-400' :
                  opt.value === 'OPTIONS' ? 'text-cyan-600 dark:text-cyan-400' :
                  'text-gray-700 dark:text-gray-200'
                )}
              />
            </div>
            <div className="flex-1">
              <VariableAwareInput
                value={url}
                onChange={(e) => setUrl((e.target as HTMLInputElement).value)}
                placeholder="Enter the request URL— variables are allowed with {{name}}"
                variables={{
                  ...(collection?.variables || {}),
                  ...(environment?.variables || {}),
                }}
                showExplainButton
              />
            </div>
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
      <div className="relative flex-1 flex overflow-visible">
        {/* Left Panel - Tabs (Proto / Headers) and Body */}
        <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
          {/* Tabs */}
          <div className="px-4 pt-2 mt-3 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-6">
              <button
                type="button"
                onClick={() => setActiveLeftTab('proto')}
                className={clsx(
                  'pb-3 inline-flex items-center text-sm font-medium border-b-2',
                  activeLeftTab === 'proto'
                    ? 'border-primary-600 text-primary-600 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:border-gray-300'
                )}
              >
                <Code2 className="h-4 w-4 mr-2" /> Protobuf Configuration
              </button>
              <button
                type="button"
                onClick={() => setActiveLeftTab('headers')}
                className={clsx(
                  'pb-3 inline-flex items-center text-sm font-medium border-b-2',
                  activeLeftTab === 'headers'
                    ? 'border-primary-600 text-primary-600 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:border-gray-300'
                )}
              >
                <List className="h-4 w-4 mr-2" /> Headers
              </button>
            </nav>
          </div>

          {/* Tab content */}
          <div className="px-4 py-3">
            {activeLeftTab === 'proto' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Request Message Type
                  </label>
                  <Dropdown
                    options={messageTypes.map((msg) => ({ label: msg.fqName, value: msg.fqName }))}
                    value={protoMessage}
                    onChange={setProtoMessage}
                    placeholder="Select message type"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Success Response Message Type
                  </label>
                  <Dropdown
                    options={messageTypes.map((msg) => ({ label: msg.fqName, value: msg.fqName }))}
                    value={responseType}
                    onChange={setResponseType}
                    placeholder="Select message type"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Error Response Message Type
                  </label>
                  <Dropdown
                    options={messageTypes.map((msg) => ({ label: msg.fqName, value: msg.fqName }))}
                    value={errorResponseType}
                    onChange={setErrorResponseType}
                    placeholder="Select message type"
                    className="w-full"
                  />
                </div>
              </div>
            ) : (
              <HeadersEditor
                headers={headers}
                onChange={setHeaders}
                variables={{
                  ...(collection?.variables || {}),
                  ...(environment?.variables || {}),
                }}
              />
            )}
          </div>

          {/* Body */}
          {(method !== 'GET' || protoMessage) && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              {messageFields && messageFields.length > 0 ? (
                <NestedBodyEditor
                  fields={messageFields}
                  values={body}
                  onChange={setBody}
                  // Pass schema for oneof and cardinality awareness
                  // @ts-ignore - component currently accepts props defined below
                  schema={schema || undefined}
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

        {/* Variables Preview Drawer - collapses to mini bar with icon */}
        <aside
          className={clsx(
            'overflow-hidden transition-all duration-300 bg-gray-50 dark:bg-gray-900 dark:text-white border-l border-gray-200 dark:border-gray-700 flex flex-col',
            showVariables ? 'w-80' : 'w-10'
          )}
          aria-label="Variables preview drawer"
        >
          {showVariables ? (
            <>
              <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-medium">Variables Preview</h2>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => setShowVariables(false)}
                >
                  Close
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <VariablesPreview
                  collection={collection}
                  environment={environment}
                  url={url}
                  headers={headers}
                  body={body}
                  showResolvedBody={false}
                  variablesOverride={(environment?.variables || collection?.variables) ? {
                    ...(collection?.variables || {}),
                    ...(environment?.variables || {}),
                  } : undefined}
                />
              </div>
            </>
          ) : (
            <div className="p-2">
              <button
                type="button"
                className="rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setShowVariables(true)}
                title="Open Variables Preview"
              >
                <span className="font-mono text-lg text-gray-600 dark:text-gray-300">{`{}`}</span>
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Response Panel */}
      <div className="border-t border-gray-200 dark:border-gray-700 mt-2">
        <ResponsePanel
          response={response}
          isLoading={isLoading}
          error={error || undefined}
        />
      </div>
    </div>
  );
};
