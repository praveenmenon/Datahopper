import { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { RequestEditor } from './components/RequestEditor';
import { useCollections, useEnvironments, useMessageTypes } from './lib/useData';
import { preferencesApi } from './lib/api';
import { Collection } from './lib/types';

function App() {
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [activeEnvironment, setActiveEnvironment] = useState<string>('');
  const [hasRestoredEnv, setHasRestoredEnv] = useState<boolean>(false);

  // Data fetching
  const { data: collections = [], isLoading: collectionsLoading } = useCollections();
  const { data: environments = [], isLoading: environmentsLoading } = useEnvironments();
  const { data: messageTypes = [], isLoading: messageTypesLoading } = useMessageTypes();

  const currentEnvironment = environments.find(env => env.name === activeEnvironment);

  // Restore previously selected environment on first load (backend pref first, then local)
  useEffect(() => {
    (async () => {
      // Prefer backend preference when available; fallback to localStorage
      try {
        const pref = await preferencesApi.get();
        const fromBackend = pref?.activeEnvironment;
        const candidate = fromBackend || localStorage.getItem('activeEnvironment') || '';
        if (candidate && !environmentsLoading && environments.length > 0) {
          if (environments.find(e => e.name === candidate)) {
            setActiveEnvironment(candidate);
          }
        }
      } catch {
        const stored = localStorage.getItem('activeEnvironment');
        if (stored && !environmentsLoading && environments.length > 0) {
          if (environments.find(e => e.name === stored)) {
            setActiveEnvironment(stored);
          }
        }
      }
      // Mark restore complete so downstream effects can run safely
      setHasRestoredEnv(true);
    })();
  }, [environmentsLoading, environments]);

  // Persist active environment selection (only after initial restore completes)
  useEffect(() => {
    if (!hasRestoredEnv) return;
    if (activeEnvironment) {
      localStorage.setItem('activeEnvironment', activeEnvironment);
      // Best-effort sync to backend
      try { preferencesApi.update({ activeEnvironment }); } catch {}
    } else {
      localStorage.removeItem('activeEnvironment');
      try { preferencesApi.update({ activeEnvironment: '' }); } catch {}
    }
  }, [activeEnvironment, hasRestoredEnv]);

  // If the stored/active environment no longer exists, clear it.
  // After restore finishes, if nothing is set, default to first environment.
  useEffect(() => {
    if (!environmentsLoading) {
      if (activeEnvironment && !environments.find(e => e.name === activeEnvironment)) {
        setActiveEnvironment('');
      }
      // If no environment is selected and there are environments available, select the first one
      if (hasRestoredEnv && !activeEnvironment && environments.length > 0) {
        const first = environments[0].name;
        setActiveEnvironment(first);
        try { preferencesApi.update({ activeEnvironment: first }); } catch {}
      }
    }
  }, [environmentsLoading, environments, activeEnvironment, hasRestoredEnv]);

  // Keep selected collection reference in sync with refreshed query data
  useEffect(() => {
    if (selectedCollection) {
      const updated = collections.find(c => c.id === selectedCollection.id);
      if (updated && updated !== selectedCollection) {
        setSelectedCollection(updated);
      }
    }
  }, [collections, selectedCollection]);

  const handleRequestSelect = (collectionId: string, requestId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    if (collection) {
      setSelectedCollection(collection);
      setSelectedRequest(requestId);
    }
  };

  const handleRequestRun = () => {
    // Response handling can be added here in the future
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
          try { preferencesApi.update({ activeEnvironment: name }); } catch {}
        }}
        messageTypes={messageTypes}
        showEnvironmentSelector={hasRestoredEnv}
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
