import { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { RequestEditor } from './components/RequestEditor';
import { useCollections, useEnvironments, useMessageTypes } from './lib/useData';
import { Collection } from './lib/types';

function App() {
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [activeEnvironment, setActiveEnvironment] = useState<string>('');
  const [responseData, setResponseData] = useState<any>(null);

  // Data fetching
  const { data: collections = [], isLoading: collectionsLoading } = useCollections();
  const { data: environments = [], isLoading: environmentsLoading } = useEnvironments();
  const { data: messageTypes = [], isLoading: messageTypesLoading } = useMessageTypes();

  const currentEnvironment = environments.find(env => env.name === activeEnvironment);

  // Restore previously selected environment on first load
  useEffect(() => {
    const stored = localStorage.getItem('activeEnvironment');
    if (stored && !environmentsLoading && environments.length > 0) {
      // Only restore if the environment exists in the loaded environments
      if (environments.find(e => e.name === stored)) {
        setActiveEnvironment(stored);
      }
    }
  }, [environmentsLoading, environments]);

  // Persist active environment selection
  useEffect(() => {
    if (activeEnvironment) {
      localStorage.setItem('activeEnvironment', activeEnvironment);
    } else {
      localStorage.removeItem('activeEnvironment');
    }
  }, [activeEnvironment]);

  // If the stored/active environment no longer exists, clear it
  useEffect(() => {
    if (!environmentsLoading) {
      if (activeEnvironment && !environments.find(e => e.name === activeEnvironment)) {
        setActiveEnvironment('');
      }
      // If no environment is selected and there are environments available, select the first one
      if (!activeEnvironment && environments.length > 0) {
        setActiveEnvironment(environments[0].name);
      }
    }
  }, [environmentsLoading, environments, activeEnvironment]);

  const handleRequestSelect = (collectionId: string, requestId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    if (collection) {
      setSelectedCollection(collection);
      setSelectedRequest(requestId);
    }
  };

  const handleRequestRun = (response: any) => {
    setResponseData(response);
  };

  if (collectionsLoading || environmentsLoading || messageTypesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading DataHopper...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar 
        environments={environments}
        activeEnvironment={activeEnvironment}
        onEnvironmentChange={(name) => {
          setActiveEnvironment(name);
          if (name) localStorage.setItem('activeEnvironment', name);
        }}
        messageTypes={messageTypes}
      />
      
      <div className="flex h-screen pt-16">
          <Sidebar 
          collections={collections}
          selectedCollection={selectedCollection}
          selectedRequest={selectedRequest}
          onRequestSelect={handleRequestSelect}
          onCollectionSelect={setSelectedCollection}
          environments={environments}
          onEnvironmentCreated={(name) => { setActiveEnvironment(name); localStorage.setItem('activeEnvironment', name); }}
        />
        
        <div className="flex-1 flex flex-col">
          <RequestEditor 
            collection={selectedCollection}
            requestId={selectedRequest}
            environment={currentEnvironment || null}
            messageTypes={messageTypes}
            onRequestRun={handleRequestRun}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
