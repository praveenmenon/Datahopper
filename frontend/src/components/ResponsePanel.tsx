import React, { useState } from 'react';
import { Copy, Check, AlertCircle, Clock, Globe, Code2, List } from 'lucide-react';
import { JsonViewer } from './JsonViewer';
import clsx from 'clsx';

interface ResponseData {
  status: number;
  headers: Record<string, string>;
  decoded?: string;
  raw?: string;
  decodeError?: string;
}

interface ResponsePanelProps {
  response: ResponseData | null;
  isLoading: boolean;
  error?: string;
  durationMs?: number;
  sizeBytes?: number;
}

export const ResponsePanel: React.FC<ResponsePanelProps> = ({ response, isLoading, error, durationMs, sizeBytes }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'decoded' | 'rawProto' | 'headers'>('decoded');

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-50 dark:text-green-200 dark:bg-green-900/40';
    if (status >= 300 && status < 400) return 'text-blue-600 bg-blue-50 dark:text-blue-200 dark:bg-blue-900/40';
    if (status >= 400 && status < 500) return 'text-yellow-600 bg-yellow-50 dark:text-yellow-200 dark:bg-yellow-900/40';
    if (status >= 500) return 'text-red-600 bg-red-50 dark:text-red-200 dark:bg-red-900/40';
    return 'text-gray-600 bg-gray-50 dark:text-gray-300 dark:bg-gray-900/40';
  };

  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
    const units = ['B','KB','MB','GB'];
    let b = Math.max(0, bytes);
    let i = 0;
    while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
    return `${b % 1 === 0 ? b : b.toFixed(1)} ${units[i]}`;
  };



  // const formatJson = (jsonString: string) => {
  //   try {
  //     const parsed = JSON.parse(jsonString);
  //     return JSON.stringify(parsed, null, 2);
  //   } catch {
  //     return jsonString;
  //   }
  // };

  const safeParse = (jsonString?: string) => {
    if (!jsonString) return null;
    try { return JSON.parse(jsonString); } catch { return jsonString; }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-300">
          <Clock className="h-8 w-8 mx-auto mb-2 animate-spin" />
          <p>Sending request...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-red-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm font-medium">Request Failed</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-300">
          <Globe className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No response yet</p>
          <p className="text-xs">Send a request to see the response here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 dark:text-white">
      {/* Optional decode error banner */}
      {response.decodeError && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="text-xs text-yellow-800 dark:text-yellow-200 bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-900 rounded p-2">
            Could not decode using the selected message type. Showing raw body.
            <div className="mt-1 font-mono break-all">{response.decodeError}</div>
          </div>
        </div>
      )}

      {/* Response Content with Tabs */}
      <div className="flex flex-col">
        {/* Tabs */}
        <div className="px-4 pt-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <nav className="flex space-x-6">
              <button
                type="button"
                onClick={() => setActiveTab('decoded')}
                className={clsx(
                  'pb-3 inline-flex items-center text-sm font-medium border-b-2',
                  activeTab === 'decoded'
                    ? 'border-primary-600 text-primary-600 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:border-gray-300'
                )}
              >
                <Code2 className="h-4 w-4 mr-2" /> Decoded Response
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rawProto')}
                className={clsx(
                  'pb-3 inline-flex items-center text-sm font-medium border-b-2',
                  activeTab === 'rawProto'
                    ? 'border-primary-600 text-primary-600 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:border-gray-300'
                )}
              >
                <Code2 className="h-4 w-4 mr-2" /> Raw Proto Output
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('headers')}
                className={clsx(
                  'pb-3 inline-flex items-center text-sm font-medium border-b-2',
                  activeTab === 'headers'
                    ? 'border-primary-600 text-primary-600 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:border-gray-300'
                )}
              >
                <List className="h-4 w-4 mr-1" /> Response Headers
              </button>
            </nav>
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(response.status)}`}>
                {response.status} {getStatusText(response.status)}
              </div>
              {typeof durationMs === 'number' && (
                <div className="text-sm text-gray-500 dark:text-gray-300">{durationMs} ms</div>
              )}
              {typeof sizeBytes === 'number' && (
                <div className="text-sm text-gray-500 dark:text-gray-300">{formatBytes(sizeBytes)}</div>
              )}
            </div>
          </div>
        </div>

        {/* Tab body */}
        <div className="p-4">
          {activeTab === 'decoded' ? (
            <div className="h-96 flex flex-col">
              {response.decoded && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Decoded Response (Protobuf → JSON)</h3>
                    <button
                      onClick={() => copyToClipboard(response.decoded!, 'decoded')}
                      className="inline-flex items-center text-xs text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      {copiedField === 'decoded' ? (
                        <Check className="h-4 w-4 mr-1" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      {copiedField === 'decoded' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 h-full">
                    <JsonViewer data={safeParse(response.decoded)} showLineNumbers defaultExpanded className="h-full" />
                  </div>
                </div>
              )}
              {!response.decoded && (
                <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-300">
                  <div className="text-center">
                    <p className="text-sm">No decoded response</p>
                    <p className="text-xs">This response could not be decoded</p>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'rawProto' ? (
            <div className="h-96 flex flex-col">
              {response.raw && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Raw Proto Output</h3>
                    <button
                      onClick={() => copyToClipboard(response.raw!, 'raw')}
                      className="inline-flex items-center text-xs text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      {copiedField === 'raw' ? (
                        <Check className="h-4 w-4 mr-1" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      {copiedField === 'raw' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 h-full">
                    <JsonViewer data={response.raw} showLineNumbers defaultExpanded className="h-full" />
                  </div>
                </div>
              )}
                              {!response.raw && (
                  <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-300">
                    <div className="text-center">
                      <p className="text-sm">No raw response</p>
                      <p className="text-xs">This response has no raw content</p>
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <div className="h-96 flex flex-col">
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Response Headers</h3>
                </div>
                <div className="flex-1 min-h-0 bg-gray-50 dark:bg-gray-900 p-3 rounded-md overflow-auto">
                  {Object.entries(response.headers).map(([key, value]) => (
                    <div key={key} className="text-xs mb-2">
                      <div className="font-medium text-gray-700 dark:text-gray-300">{key}</div>
                      <div className="text-gray-600 dark:text-gray-300 break-all">{value}</div>
                    </div>
                  ))}
                  {Object.keys(response.headers).length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-300">
                      <div className="text-center">
                        <p className="text-sm">No headers received</p>
                        <p className="text-xs">This response has no headers</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to get status text
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  return statusTexts[status] || 'Unknown';
}
