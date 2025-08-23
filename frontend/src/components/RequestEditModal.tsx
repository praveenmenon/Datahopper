import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface RequestEditModalProps {
  isOpen: boolean;
  initial: { name: string } | null;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (data: { name: string }) => Promise<void> | void;
}

export const RequestEditModal: React.FC<RequestEditModalProps> = ({
  isOpen,
  initial,
  isLoading = false,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(initial?.name || '');
  }, [initial]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave({ name: name.trim() });
  };

  const handleClose = () => {
    if (!isLoading) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Request</h2>
          <button onClick={handleClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="reqName" className="block text-sm font-medium text-gray-700 mb-2">Request Name</label>
            <input
              id="reqName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Request"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

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
              disabled={isLoading || !name.trim()}
              className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
