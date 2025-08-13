import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Plus, Trash2, Globe, Pencil, Archive } from 'lucide-react';
import { Collection, Environment } from '../lib/types';
import { useCreateCollection, useCreateRequest, useDeleteCollection, useDeleteRequest, useCreateEnvironment, useUpdateEnvironment, useDeleteEnvironment, useUpdateCollection } from '../lib/useData';
import { EnvironmentModal } from './EnvironmentModal';
import { CollectionEditModal } from './CollectionEditModal';
import { CreateCollectionModal } from './CreateCollectionModal';
import { CreateRequestModal } from './CreateRequestModal';

interface SidebarProps {
  collections: Collection[];
  selectedCollection: Collection | null;
  selectedRequest: string | null;
  onRequestSelect: (collectionId: string, requestId: string) => void;
  onCollectionSelect: (collection: Collection | null) => void;
  environments?: Environment[];
  onEnvironmentCreated?: (name: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  selectedCollection,
  selectedRequest,
  onRequestSelect,
  onCollectionSelect,
  environments = [],
  onEnvironmentCreated,
}) => {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [creatingForCollection, setCreatingForCollection] = useState<string | null>(null);

  const createCollection = useCreateCollection();
  const createRequest = useCreateRequest();
  const deleteCollection = useDeleteCollection();
  const deleteRequest = useDeleteRequest();
  const updateCollection = useUpdateCollection();
  const createEnvironment = useCreateEnvironment();
  const updateEnvironment = useUpdateEnvironment();
  const deleteEnvironment = useDeleteEnvironment();
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);

  const toggleCollection = (collectionId: string) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(collectionId)) {
      newExpanded.delete(collectionId);
    } else {
      newExpanded.add(collectionId);
    }
    setExpandedCollections(newExpanded);
  };

  const handleCreateRequest = async (collectionId: string) => {
    setCreatingForCollection(collectionId);
    setShowCreateRequest(true);
    try {
      // Best-effort refresh of proto types so dropdowns are not empty on first use
      const res = await fetch('/api/registry/messages');
      void res.ok;
    } catch (_) {}
  };

  const handleCollectionDelete = async (collectionId: string) => {
    if (window.confirm('Are you sure you want to delete this collection? This will also delete all requests within it.')) {
      await deleteCollection.mutateAsync(collectionId);
      if (selectedCollection?.id === collectionId) {
        onCollectionSelect(null);
      }
    }
  };

  const handleRequestDelete = async (collectionId: string, requestId: string) => {
    if (window.confirm('Are you sure you want to delete this request?')) {
      await deleteRequest.mutateAsync({ collectionId, requestId });
      if (selectedRequest === requestId) {
        onRequestSelect(collectionId, '');
      }
    }
  };

  return (
    <>
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center text-lg font-semibold text-gray-900">
              <Archive className="h-5 w-5 mr-2 text-gray-500" /> Collections
            </div>
            <button
              onClick={() => setShowCreateCollection(true)}
              className="inline-flex items-center p-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-md transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          
        </div>

        {/* Collections List */}
        <div className="flex-1 overflow-y-auto">
          

          {collections.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Folder className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No collections yet</p>
              <p className="text-xs">Create your first collection to get started</p>
            </div>
          ) : (
            <div className="p-2">
              {collections.map((collection) => {
                const isExpanded = expandedCollections.has(collection.id);
                const isSelected = selectedCollection?.id === collection.id;
                
                return (
                  <div key={collection.id} className="mb-2">
                    {/* Collection Header */}
                    <div
                      className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-primary-50 text-primary-700 border border-primary-200' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => onCollectionSelect(collection)}
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollection(collection.id);
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <Folder className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium truncate">{collection.name}</span>
                        {collection.requests.length > 0 && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                            {collection.requests.length}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateRequest(collection.id);
                          }}
                          className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Add Request"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCollectionId(collection.id);
                          }}
                          className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Edit Collection"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCollectionDelete(collection.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Collection"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Requests List */}
                    {isExpanded && (
                      <div className="ml-6 space-y-1">
                        {collection.requests.map((request) => (
                          <div
                            key={request.id}
                            className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                              selectedRequest === request.id 
                                ? 'bg-primary-100 text-primary-700' 
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => onRequestSelect(collection.id, request.id)}
                          >
                            <div className="flex items-center space-x-2 flex-1">
                              <FileText className="h-3 w-3 text-gray-400" />
                              <span className="text-sm truncate">{request.name}</span>
                              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                {request.method}
                              </span>
                            </div>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestDelete(collection.id, request.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete Request"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Environments section moved below collections */}
          <div className="p-4 border-t border-gray-200 mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-lg font-semibold text-gray-900">
                <Globe className="h-5 w-5 mr-2 text-gray-500" /> Environments
              </div>
              <button
                className="inline-flex items-center p-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-md"
                title="Add Environment"
                onClick={() => setShowEnvModal(true)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {/* List environments */}
            <div className="mt-2 space-y-1">
              {(environments || []).length === 0 ? (
                <div className="text-xs text-gray-500">No environments yet. Use + to create.</div>
              ) : (
                (environments || []).map((env) => (
                  <div key={env.name} className="group flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50">
                    <div className="text-sm text-gray-800 truncate">{env.name}</div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="Edit Environment"
                        onClick={() => {
                          setEditingEnv(env);
                          setShowEnvModal(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete Environment"
                        onClick={async () => {
                          if (!confirm(`Delete environment \"${env.name}\"?`)) return;
                          await deleteEnvironment.mutateAsync(env.name);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Collection Modal */}
      <CreateCollectionModal
        isOpen={showCreateCollection}
        onClose={() => setShowCreateCollection(false)}
        onCreate={async (data) => {
          try {
            const created = await createCollection.mutateAsync(data);
            // Close modal and select the new collection
            setShowCreateCollection(false);
            if (created?.id) {
              onCollectionSelect(created as any);
              // expand the new collection
              setExpandedCollections(prev => new Set([...Array.from(prev), created.id]));
            }
          } catch (e) {
            // leave modal open to show errors if any (optional: add toast)
            console.error('Failed to create collection', e);
          }
        }}
        isLoading={createCollection.isLoading}
      />

      {/* Create Request Modal */}
      <CreateRequestModal
        isOpen={showCreateRequest}
        onClose={() => setShowCreateRequest(false)}
        onCreate={createRequest.mutate}
        isLoading={createRequest.isLoading}
        collectionId={creatingForCollection}
        onSuccess={() => {
          setShowCreateRequest(false);
          setCreatingForCollection(null);
        }}
      />

      {/* Environment Modal (Create) */}
      <EnvironmentModal
        isOpen={showEnvModal}
        mode={editingEnv ? 'edit' : 'create'}
        initial={editingEnv || undefined as any}
        onClose={() => {
          setShowEnvModal(false);
          setEditingEnv(null);
        }}
        onSave={async (env) => {
          if (editingEnv) {
            // If the name changed, we simulate rename by delete+create (in-memory backend)
            if (env.name !== editingEnv.name) {
              await deleteEnvironment.mutateAsync(editingEnv.name);
              await createEnvironment.mutateAsync(env as any);
            } else {
              await updateEnvironment.mutateAsync({ name: env.name, data: env });
            }
          } else {
            await createEnvironment.mutateAsync(env as any);
            onEnvironmentCreated?.(env.name);
          }
          setShowEnvModal(false);
          setEditingEnv(null);
        }}
      />

      {/* Collection Edit Modal */}
      {(() => {
        const editingCollection = editingCollectionId ? collections.find(c => c.id === editingCollectionId) : null;
        return (
          <CollectionEditModal
            isOpen={!!editingCollectionId}
            onClose={() => setEditingCollectionId(null)}
            isLoading={updateCollection.isLoading}
            initial={editingCollection ? { name: editingCollection.name, description: (editingCollection as any).description } : null}
            onSave={async (data) => {
              if (!editingCollectionId) return;
              await updateCollection.mutateAsync({ id: editingCollectionId, data: { name: data.name, description: data.description } as any });
              setEditingCollectionId(null);
            }}
          />
        );
      })()}
    </>
  );
};
