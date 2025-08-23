import React from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (t: 'light' | 'dark' | 'system') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, theme, onThemeChange }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</h3>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="theme"
                  value="system"
                  checked={theme === 'system'}
                  onChange={() => onThemeChange('system')}
                />
                <span className="text-sm text-gray-800 dark:text-gray-200">Auto (System)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={theme === 'light'}
                  onChange={() => onThemeChange('light')}
                />
                <span className="text-sm text-gray-800 dark:text-gray-200">Day (Light)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={theme === 'dark'}
                  onChange={() => onThemeChange('dark')}
                />
                <span className="text-sm text-gray-800 dark:text-gray-200">Night (Dark)</span>
              </label>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-right">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};


