import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CreateRequestRequest } from '../lib/types';
import { Dropdown } from './Dropdown';

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { collectionId: string; data: CreateRequestRequest }) => void;
  isLoading: boolean;
  collectionId: string | null;
  onSuccess: () => void;
}

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading,
  collectionId,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [protoMessage, setProtoMessage] = useState('');
  const [responseType, setResponseType] = useState('');
  const [errorResponseType, setErrorResponseType] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim() || !collectionId) return;

    onCreate({
      collectionId,
      data: {
        name: name.trim(),
        method,
        url: url.trim(),
        protoMessage: protoMessage.trim() || undefined,
        responseType: responseType.trim() || undefined,
        errorResponseType: errorResponseType.trim() || undefined,
        timeoutSeconds: timeoutSeconds || undefined,
        headers: [],
        body: []
      }
    });

    // Reset form
    setName('');
    setMethod('GET');
    setUrl('');
    setProtoMessage('');
    setResponseType('');
    setErrorResponseType('');
    setTimeoutSeconds(30);
    
    onSuccess();
  };

  const handleClose = () => {
    if (!isLoading) {
      setName('');
      setMethod('GET');
      setUrl('');
      setProtoMessage('');
      setResponseType('');
    setErrorResponseType('');
      setTimeoutSeconds(30);
      onClose();
    }
  };

  if (!isOpen || !collectionId) return null;

  const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create New Request
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Request Name *
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Create User"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          {/* Method and URL */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="method" className="block text-sm font-medium text-gray-700 mb-2">
                Method *
              </label>
              <Dropdown
                options={httpMethods.map(m => ({ label: m, value: m }))}
                value={method}
                onChange={setMethod}
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                URL *
              </label>
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/v1/users"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Protobuf Message Types */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="protoMessage" className="block text-sm font-medium text-gray-700 mb-2">
                Request Message Type
              </label>
              <input
                type="text"
                id="protoMessage"
                value={protoMessage}
                onChange={(e) => setProtoMessage(e.target.value)}
                placeholder="user.v1.CreateUserRequest"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                FQN of the request message type
              </p>
            </div>
            <div>
              <label htmlFor="responseType" className="block text-sm font-medium text-gray-700 mb-2">
                Response Message Type
              </label>
              <input
                type="text"
                id="responseType"
                value={responseType}
                onChange={(e) => setResponseType(e.target.value)}
                placeholder="user.v1.CreateUserResponse"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                FQN of the response message type
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="errorResponseType" className="block text-sm font-medium text-gray-700 mb-2">
              Error Response Message Type
            </label>
            <input
              type="text"
              id="errorResponseType"
              value={errorResponseType}
              onChange={(e) => setErrorResponseType(e.target.value)}
              placeholder="payments.v1.ErrorResponse"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              FQN of the error response message type (used for non-2xx status)
            </p>
          </div>

          {/* Timeout */}
          <div>
            <label htmlFor="timeoutSeconds" className="block text-sm font-medium text-gray-700 mb-2">
              Timeout (seconds)
            </label>
            <input
              type="number"
              id="timeoutSeconds"
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(parseInt(e.target.value) || 30)}
              min="1"
              max="300"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim() || !url.trim()}
              className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
