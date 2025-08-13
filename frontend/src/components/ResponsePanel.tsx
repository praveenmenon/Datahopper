import React, { useState } from 'react';
import { Copy, Check, AlertCircle, Clock, Globe } from 'lucide-react';

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
}

export const ResponsePanel: React.FC<ResponsePanelProps> = ({ response, isLoading, error }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-50';
    if (status >= 300 && status < 400) return 'text-blue-600 bg-blue-50';
    if (status >= 400 && status < 500) return 'text-yellow-600 bg-yellow-50';
    if (status >= 500) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };



  const formatJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <Clock className="h-8 w-8 mx-auto mb-2 animate-spin" />
          <p>Sending request...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-red-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm font-medium">Request Failed</p>
          <p className="text-xs text-gray-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <Globe className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No response yet</p>
          <p className="text-xs">Send a request to see the response here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Response Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(response.status)}`}>
            {response.status} {getStatusText(response.status)}
          </div>
          <div className="text-sm text-gray-500">
            Response received
          </div>
        </div>
        {response.decodeError && (
          <div className="mt-3 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2">
            Could not decode using the selected message type. Showing raw body.
            <div className="mt-1 font-mono break-all">{response.decodeError}</div>
          </div>
        )}
      </div>

      {/* Response Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Headers */}
        <div className="w-80 border-r border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Response Headers</h3>
          <div className="space-y-2">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="text-xs">
                <div className="font-medium text-gray-700">{key}</div>
                <div className="text-gray-600 break-all">{value}</div>
              </div>
            ))}
            {Object.keys(response.headers).length === 0 && (
              <p className="text-xs text-gray-500">No headers received</p>
            )}
          </div>
        </div>

        {/* Right Panel - Response Body */}
        <div className="flex-1 p-4">
          <div className="space-y-4">
            {/* Decoded Response */}
            {response.decoded && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900">Decoded Response (Protobuf → JSON)</h3>
                  <button
                    onClick={() => copyToClipboard(response.decoded!, 'decoded')}
                    className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {copiedField === 'decoded' ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    {copiedField === 'decoded' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="bg-gray-50 p-3 rounded-md text-xs font-mono text-gray-800 overflow-auto max-h-64">
                  {formatJson(response.decoded)}
                </pre>
              </div>
            )}

            {/* Raw Response */}
            {response.raw && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900">Raw Response</h3>
                  <button
                    onClick={() => copyToClipboard(response.raw!, 'raw')}
                    className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {copiedField === 'raw' ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    {copiedField === 'raw' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="bg-gray-50 p-3 rounded-md text-xs font-mono text-gray-800 overflow-auto max-h-64">
                  {response.raw}
                </pre>
              </div>
            )}

            {/* No Response Body */}
            {!response.decoded && !response.raw && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No response body</p>
                <p className="text-xs">This response has no content</p>
              </div>
            )}
          </div>
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
