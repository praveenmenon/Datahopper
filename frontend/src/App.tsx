import { useState } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { RequestEditor } from './components/RequestEditor';
import { useCollections, useEnvironments, useMessageTypes } from './lib/useData';
import { Collection } from './lib/types';

function App() {
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [activeEnvironment, setActiveEnvironment] = useState<string>('local');
  const [responseData, setResponseData] = useState<any>(null);

  // Data fetching
  const { data: collections = [], isLoading: collectionsLoading } = useCollections();
  const { data: environments = [], isLoading: environmentsLoading } = useEnvironments();
  const { data: messageTypes = [], isLoading: messageTypesLoading } = useMessageTypes();

  const currentEnvironment = environments.find(env => env.name === activeEnvironment);

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
        onEnvironmentChange={setActiveEnvironment}
        messageTypes={messageTypes}
      />
      
      <div className="flex h-screen pt-16">
        <Sidebar 
          collections={collections}
          selectedCollection={selectedCollection}
          selectedRequest={selectedRequest}
          onRequestSelect={handleRequestSelect}
          onCollectionSelect={setSelectedCollection}
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
