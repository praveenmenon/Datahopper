import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Plus, Trash2, Globe, Pencil, Archive } from 'lucide-react';
import { Collection, Environment } from '../lib/types';
import { useCreateCollection, useDeleteCollection, useDeleteRequest, useCreateEnvironment, useUpdateEnvironment, useDeleteEnvironment, useUpdateCollection } from '../lib/useData';
import { EnvironmentModal } from './EnvironmentModal';
import { CollectionEditModal } from './CollectionEditModal';
import { CreateCollectionModal } from './CreateCollectionModal';
import { preferencesApi } from '../lib/api';

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

  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const deleteRequest = useDeleteRequest();
  const updateCollection = useUpdateCollection();
  const createEnvironment = useCreateEnvironment();
  const updateEnvironment = useUpdateEnvironment();
  const deleteEnvironment = useDeleteEnvironment();
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ collectionId: string; requestId: string } | null>(null);
  const [confirmDeletePref, setConfirmDeletePref] = useState<boolean>(true);

  const pendingNames = React.useMemo(() => {
    if (!pendingDelete) return { collectionName: '', requestName: '' };
    const col = collections.find(c => c.id === pendingDelete.collectionId);
    const req = col?.requests.find(r => r.id === pendingDelete.requestId);
    return { collectionName: col?.name || '', requestName: req?.name || '' };
  }, [pendingDelete, collections]);

  useEffect(() => {
    (async () => {
      try {
        const p = await preferencesApi.get();
        if (typeof p.confirmDeleteRequest === 'boolean') setConfirmDeletePref(p.confirmDeleteRequest);
      } catch {}
    })();
  }, []);

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
    const col = collections.find(c => c.id === collectionId) || null;
    onCollectionSelect(col);
    setExpandedCollections(prev => new Set([...Array.from(prev), collectionId]));
    onRequestSelect(collectionId, '');
  };

  const handleCollectionDelete = async (collectionId: string) => {
    if (window.confirm('Are you sure you want to delete this collection? This will also delete all requests within it.')) {
      await deleteCollection.mutateAsync(collectionId);
      if (selectedCollection?.id === collectionId) {
        onCollectionSelect(null);
      }
    }
  };

  const confirmAndDeleteRequest = async (collectionId: string, requestId: string) => {
    await deleteRequest.mutateAsync({ collectionId, requestId });
    if (selectedRequest === requestId) {
      onRequestSelect(collectionId, '');
    }
  };

  const handleRequestDelete = async (collectionId: string, requestId: string) => {
    if (!confirmDeletePref) {
      await confirmAndDeleteRequest(collectionId, requestId);
      return;
    }
    setPendingDelete({ collectionId, requestId });
    setDontAskAgain(false);
    setShowDeleteModal(true);
  };

  return (
    <>
      <div className="w-80 min-h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col text-gray-900 dark:text-white">
        {/* Header */}
        <div className="p-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-0">
            <div className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
              <Archive className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-300" /> Collections
            </div>
            <button
              onClick={() => setShowCreateCollection(true)}
              className="inline-flex items-center p-2 text-sm rounded-md transition-colors text-gray-600 dark:text-gray-100 hover:text-primary-600 dark:hover:text-white hover:bg-primary-50/20 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500/60"
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
                          ? 'bg-gray-50 text-gray-900 border border-gray-200 dark:bg-gray-700/40 dark:text-white dark:border-gray-600' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                      }`}
                      onClick={() => onCollectionSelect(collection)}
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollection(collection.id);
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors focus:bg-gray-100 dark:focus:bg-gray-700/60"
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
                          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
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
                          className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 focus:bg-primary-50 dark:focus:bg-primary-900/30 rounded transition-colors"
                          title="Add Request"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCollectionId(collection.id);
                          }}
                          className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 focus:bg-primary-50 dark:focus:bg-primary-900/30 rounded transition-colors"
                          title="Edit Collection"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCollectionDelete(collection.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 focus:bg-red-50 dark:focus:bg-red-900/30 rounded transition-colors"
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
                            className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                              selectedRequest === request.id 
                                ? 'bg-gray-50 text-gray-900 dark:bg-gray-700/40 dark:text-white' 
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                            }`}
                            onClick={() => onRequestSelect(collection.id, request.id)}
                          >
                            <div className="flex items-center space-x-2 flex-1">
                              <FileText className="h-3 w-3 text-gray-400" />
                              <span className="text-sm truncate">{request.name}</span>
                              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                {request.method}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestDelete(collection.id, request.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 focus:bg-red-50 dark:focus:bg-red-900/30 rounded transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
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
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                <Globe className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-300" /> Environments
              </div>
              <button
                className="inline-flex items-center p-1 text-xs rounded-md transition-colors text-gray-600 dark:text-gray-100 hover:text-primary-600 dark:hover:text-white hover:bg-primary-50/20 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500/60"
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
                  <div key={env.name} className="group flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/40 focus:bg-gray-100 dark:focus:bg-gray-700/60">
                    <div className="text-sm text-gray-800 dark:text-white truncate">{env.name}</div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 focus:bg-primary-50 dark:focus:bg-primary-900/30 rounded"
                        title="Edit Environment"
                        onClick={() => {
                          setEditingEnv(env);
                          setShowEnvModal(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 focus:bg-red-50 dark:focus:bg-red-900/30 rounded"
                        title="Delete Environment"
                        onClick={async () => {
                          if (!confirm(`Delete environment "${env.name}"?`)) return;
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
            setShowCreateCollection(false);
            if (created?.id) {
              onCollectionSelect(created as any);
              setExpandedCollections(prev => new Set([...Array.from(prev), created.id]));
            }
          } catch (e) {
            console.error('Failed to create collection', e);
          }
        }}
        isLoading={createCollection.isLoading}
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

      {/* Delete Request Confirm Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowDeleteModal(false);
            if (e.key === 'Enter') {
              const btn = document.getElementById('confirm-delete-btn') as HTMLButtonElement | null;
              btn?.click();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-[560px] p-5" role="dialog" aria-modal="true">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Delete request?</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete “{pendingNames.requestName}” from {pendingNames.collectionName}?</p>
            <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
              <input type="checkbox" checked={dontAskAgain} onChange={(e) => setDontAskAgain(e.target.checked)} />
              Skip confirmation next time
            </label>
            <div className="flex justify-end gap-2">
              <button
                autoFocus
                className="px-3 py-1.5 rounded border text-sm"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                className="px-3 py-1.5 rounded bg-red-600 text-white text-sm"
                onClick={async () => {
                  try {
                    if (dontAskAgain) {
                      await preferencesApi.update({ confirmDeleteRequest: false });
                      setConfirmDeletePref(false);
                    }
                    if (pendingDelete) {
                      await confirmAndDeleteRequest(pendingDelete.collectionId, pendingDelete.requestId);
                    }
                  } finally {
                    setShowDeleteModal(false);
                    setPendingDelete(null);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
