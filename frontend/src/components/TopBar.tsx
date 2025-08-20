import React, { useState } from 'react';
import { Zap, Settings, Plus, Pencil, Trash2 } from 'lucide-react';
import { Environment, MessageType } from '../lib/types';
import { useRegisterProto } from '../lib/useData';
import { Dropdown } from './Dropdown';
import { RegisterProtoModal } from './RegisterProtoModal';
import { SettingsModal } from './SettingsModal';
import { type ThemeMode, setTheme as persistTheme, getStoredTheme, getSystemPrefersDark } from '../lib/theme';
import { EnvironmentModal } from './EnvironmentModal';

interface TopBarProps {
  environments: Environment[];
  activeEnvironment: string;
  onEnvironmentChange: (env: string) => void;
  messageTypes: MessageType[];
  showEnvironmentSelector?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  environments,
  activeEnvironment,
  onEnvironmentChange,
  messageTypes,
  showEnvironmentSelector = true,
}) => {
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme() ?? 'system');

  const applyTheme = (t: ThemeMode) => {
    setThemeState(t);
    persistTheme(t);
  };
  const registerProto = useRegisterProto();

  // Note: native select removed; using Dropdown component instead

  return (
    <>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 fixed top-0 left-0 right-0 z-50 text-gray-900 dark:text-white">
        <div className="flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Zap className="h-8 w-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">DataHopper</h1>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-300 font-medium">
              Hop between APIs with protobuf speed
            </span>
          </div>

          {/* Environment Selector */}
          <div className="flex items-center space-x-4">
            {showEnvironmentSelector && (
              <div className="flex items-center space-x-2">
                <label htmlFor="environment" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Environment:
                </label>
                <div className="w-56">
                  <Dropdown
                    options={environments.map((e) => ({ label: e.name, value: e.name }))}
                    value={activeEnvironment || ''}
                    onChange={(v) => onEnvironmentChange(v)}
                    placeholder={environments.length === 0 ? '(no environments)' : 'Select environment'}
                    headerContent={
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Environments</span>
                        <button
                          type="button"
                          className="px-2 py-1 text-xs rounded bg-primary-600 text-white hover:bg-primary-700"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowEnvModal(true); }}
                        >
                          New
                        </button>
                      </div>
                    }
                    renderItem={(opt, onSelect) => (
                      <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <button
                          type="button"
                          className="text-left flex-1 text-sm"
                          onClick={(e) => { e.preventDefault(); onSelect(); }}
                        >
                          {opt.label}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowEnvModal(true); }}
                            title="Edit environment"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); alert(`Delete env '${opt.value}' (wire to API)`); }}
                            title="Delete environment"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Register .proto Button */}
            <button
              onClick={() => setShowRegisterModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Register .proto
            </button>

            {/* Settings Button */}
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setShowSettings(true)}>
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Register Proto Modal */}
      <RegisterProtoModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onRegister={registerProto.mutate}
        isLoading={registerProto.isLoading}
        messageTypes={messageTypes}
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onThemeChange={applyTheme}
      />
      <EnvironmentModal
        isOpen={showEnvModal}
        mode="create"
        initial={null}
        onClose={() => setShowEnvModal(false)}
        onSave={async () => setShowEnvModal(false)}
      />
    </>
  );
};
