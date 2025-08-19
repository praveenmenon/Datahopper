import React, { useState } from 'react';
import { Zap, Settings, Plus } from 'lucide-react';
import { Environment, MessageType } from '../lib/types';
import { useRegisterProto } from '../lib/useData';
import { Dropdown } from './Dropdown';
import { RegisterProtoModal } from './RegisterProtoModal';

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
  const registerProto = useRegisterProto();

  const handleEnvironmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onEnvironmentChange(e.target.value);
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-4 fixed top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Zap className="h-8 w-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">DataHopper</h1>
            </div>
            <span className="text-sm text-gray-500 font-medium">
              Hop between APIs with protobuf speed
            </span>
          </div>

          {/* Environment Selector */}
          <div className="flex items-center space-x-4">
            {showEnvironmentSelector && (
              <div className="flex items-center space-x-2">
                <label htmlFor="environment" className="text-sm font-medium text-gray-700">
                  Environment:
                </label>
                <div className="w-48">
                  <Dropdown
                    options={environments.map((e) => ({ label: e.name, value: e.name }))}
                    value={activeEnvironment || ''}
                    onChange={(v) => onEnvironmentChange(v)}
                    placeholder={environments.length === 0 ? '(no environments)' : 'Select environment'}
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
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
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

    </>
  );
};
