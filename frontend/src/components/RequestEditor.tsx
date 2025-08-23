// NOTE: This is the full component with just the Protobuf Configuration section
// changed to a side-by-side label/field layout.

import React, { useState, useEffect, useRef } from 'react';
import { Play, Save, Code2, List, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [isBodyCollapsed, setIsBodyCollapsed] = useState<boolean>(false);

  const runRequest = useRunRequest();
  const queryClient = useQueryClient();
  const lastRequestIdRef = useRef<string | null>(null);

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
        setErrorResponseType(request.errorResponseType || '');
        setTimeoutSeconds(request.timeoutSeconds || 30);
        setHeaders(request.headers || []);
        setBody(request.body || []);
        if ((request as any).lastResponse) {
          setResponse((request as any).lastResponse);
        } else {
          try {
            const cached = localStorage.getItem(`requestResp:${requestId}`);
            setResponse(cached ? JSON.parse(cached) : null);
          } catch {
            setResponse(null);
          }
        }
        lastRequestIdRef.current = requestId;
        return;
      }
    }
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

  const isTimestamp = (f: MessageField) =>
    !!(f.message && f.messageType && f.messageType.includes('google.protobuf.Timestamp'));

  useEffect(() => {
    if (protoMessage) {
      (async () => {
        try { setSchema(await protoApi.getMessageSchema(protoMessage)); } catch { setSchema(null); }
        try {
          const r = await protoApi.getMessageFields(protoMessage);
          setMessageFields(r.fields);
        } catch {
          setMessageFields([]);
        }
      })();
    } else {
      setMessageFields([]);
      setSchema(null);
    }
  }, [protoMessage]);

  useEffect(() => {
    if (!protoMessage || (body && body.length > 0) || !messageFields.length) return;

    const oneofPrefixes = new Set<string>();
    messageFields.forEach((f) => {
      if ((f as any).oneof && f.message && (f.path || f.name)) {
        oneofPrefixes.add((f.path || f.name)!);
      }
    });

    const generatedFields: BodyField[] = messageFields
      .filter(f => !isTimestamp(f))
      .filter(f => {
        if ((f as any).oneof) return false;
        const p = (f.path || f.name) || '';
        for (const pref of oneofPrefixes) if (p.startsWith(pref + '.')) return false;
        return true;
      })
      .map(field => ({ path: field.path || field.name, value: getDefaultValueForField(field) }));
    setBody(generatedFields);
  }, [protoMessage, messageFields]);

  const handleGenerateFromProtoClick = (fields: MessageField[]) => {
    if (!fields?.length) return;
    const overwrite = body.length === 0 || window.confirm('Replace current body with fields from the selected proto?');
    if (!overwrite) return;

    const oneofPrefixes = new Set<string>();
    fields.forEach((f) => {
      if ((f as any).oneof && f.message && (f.path || f.name)) {
        oneofPrefixes.add((f.path || f.name)!);
      }
    });

    const generated: BodyField[] = fields
      .filter(f => !isTimestamp(f))
      .filter(f => {
        if ((f as any).oneof) return false;
        const p = (f.path || f.name) || '';
        for (const pref of oneofPrefixes) if (p.startsWith(pref + '.')) return false;
        return true;
      })
      .map(f => ({ path: f.path || f.name, value: getDefaultValueForField(f) }));
    setBody(generated);
  };

  const getDefaultValueForField = (field: MessageField): string => {
    if (field.repeated) return '[]';
    if ((field as any).enum && Array.isArray((field as any).enumValues)) {
      const opts = (field as any).enumValues as string[];
      return opts[0] || '';
    }
    const t = (field.type || '').toUpperCase();
    switch (t) {
      case 'STRING': case 'TYPE_STRING': return '';
      case 'INT32': case 'INT64': case 'UINT32': case 'UINT64':
      case 'SINT32': case 'SINT64': case 'FIXED32': case 'FIXED64':
      case 'SFIXED32': case 'SFIXED64': case 'TYPE_INT32': case 'TYPE_INT64':
      case 'TYPE_UINT32': case 'TYPE_UINT64': case 'TYPE_SINT32': case 'TYPE_SINT64':
      case 'TYPE_FIXED32': case 'TYPE_FIXED64': case 'TYPE_SFIXED32': case 'TYPE_SFIXED64': return '0';
      case 'FLOAT': case 'DOUBLE': case 'TYPE_FLOAT': case 'TYPE_DOUBLE': return '0.0';
      case 'BOOL': case 'TYPE_BOOL': return 'false';
      case 'BYTES': case 'TYPE_BYTES': return '';
      default: return field.message ? '{}' : '';
    }
  };

    // const resolvedUrl = React.useMemo(() => {
  //   let resolved = url || '';
  //   const merged: Record<string, string> = {};
  //   if (collection?.variables) Object.assign(merged, collection.variables);
  //   if (environment?.variables) Object.assign(merged, environment.variables);
  //   Object.entries(merged).forEach(([k, v]) => { resolved = resolved.replace(new RegExp(`{{${k}}}`, 'g'), v); });
  //   return resolved;
  // }, [url, environment, collection]);

  const handleSend = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setError(null);
    setResponse(null);
    const startedAt = performance.now();

    try {
      const variables: Record<string, string> = { ...(collection?.variables || {}), ...(environment?.variables || {}) };
      const headersMap: Record<string, string> = {};
      headers.forEach(h => { if (h.key.trim()) headersMap[h.key.trim()] = h.value; });

      let effectiveBody = body;
      if (collection?.requests && requestId) {
        const saved = collection.requests.find(r => r.id === requestId);
        if (saved?.body?.length) {
          const merged: Record<string, any> = {};
          saved.body.forEach((b) => { if (b.path) merged[b.path] = b.value; });
          body.forEach((b) => { if (b.path) merged[b.path] = b.value; });
          effectiveBody = Object.entries(merged).map(([path, value]) => ({ path, value }));
        }
      }

      const requestData: RunRequest = {
        method, url, protoMessage: protoMessage || undefined,
        responseType: responseType || undefined,
        errorResponseType: errorResponseType || undefined,
        headers: headersMap, body: effectiveBody, timeoutSeconds, variables
      } as any;

      (requestData as any).collectionId = collection?.id || undefined;
      (requestData as any).requestId = requestId || undefined;

      const resp = await runRequest.mutateAsync(requestData);
      setResponse(resp);

      try {
        const durationMs = Math.round(performance.now() - startedAt);
        let sizeBytes: number | undefined;
        if (typeof (resp as any)?.raw === 'string') sizeBytes = new TextEncoder().encode((resp as any).raw).length;
        else if (typeof (resp as any)?.decoded === 'string') sizeBytes = new TextEncoder().encode((resp as any).decoded).length;
        else if ((resp as any)?.headers) {
          const headers: Record<string, string> = (resp as any).headers || {};
          const key = Object.keys(headers).find(k => k.toLowerCase() === 'content-length');
          if (key) {
            const val = parseInt(headers[key], 10);
            if (!Number.isNaN(val)) sizeBytes = val;
          }
        }
        (resp as any).__meta = { durationMs, sizeBytes };
      } catch {}

      if (requestId) {
        try { localStorage.setItem(`requestResp:${requestId}`, JSON.stringify(resp)); } catch {}
      }
      onRequestRun(resp);
    } catch (err) {
      console.error('Failed to run request:', err);
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!collection) return;
    try {
      const headersMap: Record<string, any> = {};
      headers.forEach(h => { if (h.key.trim()) headersMap[h.key.trim()] = h.value; });
      const bodyModel: Record<string, any> = {};
      body.forEach(b => { if (b.path) bodyModel[b.path] = b.value; });

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
      if (!requestId && (saved as any)?.request?.id && response) {
        try { localStorage.setItem(`requestResp:${(saved as any).request.id}`, JSON.stringify(response)); } catch {}
      }
      queryClient.invalidateQueries('collections');
      if (collection.id) queryClient.invalidateQueries(['collection', collection.id]);
    } catch (e) {
      console.error('Failed to save request:', e);
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
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 pb-[9px] relative z-40">
        <div className="space-y-3">
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
              <Save className="h-4 w-4 mr-2" /> Save
            </button>
          </div>

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
                variables={{ ...(collection?.variables || {}), ...(environment?.variables || {}) }}
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

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
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
              <div className="space-y-3">
                {/* Request */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Request Message Type
                  </label>
                  <div className="col-span-3">
                    <Dropdown
                      options={messageTypes.map((m) => ({ label: m.fqName, value: m.fqName }))}
                      value={protoMessage}
                      onChange={setProtoMessage}
                      placeholder="Select message type"
                      className="w-full"
                      searchable
                      searchPlaceholder="Search message types..."
                    />
                  </div>
                </div>

                {/* Success */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Success Response Message Type
                  </label>
                  <div className="col-span-3">
                    <Dropdown
                      options={messageTypes.map((m) => ({ label: m.fqName, value: m.fqName }))}
                      value={responseType}
                      onChange={setResponseType}
                      placeholder="Select message type"
                      className="w-full"
                      searchable
                      searchPlaceholder="Search message types..."
                    />
                  </div>
                </div>

                {/* Error */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Error Response Message Type
                  </label>
                  <div className="col-span-3">
                    <Dropdown
                      options={messageTypes.map((m) => ({ label: m.fqName, value: m.fqName }))}
                      value={errorResponseType}
                      onChange={setErrorResponseType}
                      placeholder="Select message type"
                      className="w-full"
                      searchable
                      searchPlaceholder="Search message types..."
                    />
                  </div>
                </div>
              </div>
            ) : (
              <HeadersEditor
                headers={headers}
                onChange={setHeaders}
                variables={{ ...(collection?.variables || {}), ...(environment?.variables || {}) }}
              />
            )}
          </div>

          {/* Body */}
          {(method !== 'GET' || protoMessage) && (
            <div className={clsx('border-t border-gray-200 dark:border-gray-700', isBodyCollapsed ? 'px-4 pt-4 pb-4' : 'p-4')}>
              <button
                type="button"
                onClick={() => setIsBodyCollapsed(v => !v)}
                aria-expanded={!isBodyCollapsed}
                className={clsx('w-full flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded px-1.5 py-0', isBodyCollapsed ? 'mb-0' : 'mb-2')}
              >
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Request Body</h3>
                <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-300">
                  {isBodyCollapsed ? (<><ChevronRight className="h-4 w-4 mr-1" /> Expand</>) : (<><ChevronDown className="h-4 w-4 mr-1" /> Collapse</>)}
                </span>
              </button>
              {!isBodyCollapsed && (
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md overflow-auto max-h-96">
                  {messageFields?.length ? (
                    <NestedBodyEditor fields={messageFields} values={body} onChange={setBody} // @ts-ignore
                      schema={schema || undefined}
                    />
                  ) : (
                    <BodyEditor
                      body={body}
                      onChange={setBody}
                      protoMessage={protoMessage}
                      messageFields={messageFields}
                      onGenerateFromProto={handleGenerateFromProtoClick}
                      showHeader={false}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Response */}
          <div className={clsx('border-t border-gray-200 dark:border-gray-700', isBodyCollapsed ? 'mt-0' : 'mt-2')}>
            <ResponsePanel
              response={response}
              isLoading={isLoading}
              error={error || undefined}
              durationMs={(response as any)?.__meta?.durationMs}
              sizeBytes={(response as any)?.__meta?.sizeBytes}
            />
          </div>
        </div>

        {/* Variables Drawer */}
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
                <button type="button" className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setShowVariables(false)}>
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
                  variablesOverride={(environment?.variables || collection?.variables) ? { ...(collection?.variables || {}), ...(environment?.variables || {}) } : undefined}
                />
              </div>
            </>
          ) : (
            <div className="p-2">
              <button type="button" className="rounded hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setShowVariables(true)} title="Open Variables Preview">
                <span className="font-mono text-lg text-gray-600 dark:text-gray-300">{`{}`}</span>
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};