import { 
  Collection, 
  Request, 
  Environment, 
  MessageType, 
  CreateCollectionRequest, 
  CreateRequestRequest, 
  UpdateRequestRequest, 
  RunRequest, 
  RunResponse,
  ProtoRegisterRequest,
  MessageFieldsResponse,
  MessageSchemaMeta 
} from './types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8088';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, errorText || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Protobuf Registry API
export const protoApi = {
  register: (data: ProtoRegisterRequest): Promise<void> =>
    apiRequest('/api/protos/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  registerFromFiles: (files: File[]): Promise<void> => {
    const formData = new FormData();
    
    // Add files with just their filenames - backend will handle import resolution
    files.forEach(file => {
      console.log('Adding to FormData:', { 
        fileName: file.name, 
        size: file.size
      });
      formData.append('files', file);
    });
    
    return apiRequest('/api/protos/register/upload', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header for FormData, let the browser set it
      headers: {},
    });
  },

  listMessages: (): Promise<MessageType[]> =>
    apiRequest('/api/registry/messages'),
    
  getMessageFields: (fqn: string): Promise<MessageFieldsResponse> =>
    apiRequest(`/api/registry/messages/${encodeURIComponent(fqn)}/fields`),

  // Optional advanced schema endpoint (backend may or may not expose it)
  getMessageSchema: async (fqn: string): Promise<MessageSchemaMeta> =>
    apiRequest(`/api/registry/messages/${encodeURIComponent(fqn)}/schema`),
};

// Collections API
export const collectionsApi = {
  list: (): Promise<Collection[]> =>
    apiRequest('/api/collections'),

  get: (id: string): Promise<Collection> =>
    apiRequest(`/api/collections/${id}`),

  create: (data: CreateCollectionRequest): Promise<Collection> =>
    apiRequest('/api/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Collection>): Promise<Collection> =>
    apiRequest(`/api/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<void> =>
    apiRequest(`/api/collections/${id}`, {
      method: 'DELETE',
    }),
};

// Requests API
export const requestsApi = {
  create: (collectionId: string, data: CreateRequestRequest): Promise<Request> =>
    apiRequest(`/api/collections/${collectionId}/requests`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (collectionId: string, requestId: string): Promise<Request> =>
    apiRequest(`/api/collections/${collectionId}/requests/${requestId}`),

  update: (collectionId: string, requestId: string, data: UpdateRequestRequest): Promise<Request> =>
    apiRequest(`/api/collections/${collectionId}/requests/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (collectionId: string, requestId: string): Promise<void> =>
    apiRequest(`/api/collections/${collectionId}/requests/${requestId}`, {
      method: 'DELETE',
    }),
};

// Environments API
export const environmentsApi = {
  list: (): Promise<Environment[]> =>
    apiRequest('/api/environments'),

  create: (data: Omit<Environment, 'name'> & { name: string }): Promise<Environment> =>
    apiRequest('/api/environments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (name: string, data: Partial<Environment>): Promise<Environment> =>
    apiRequest(`/api/environments/${name}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (name: string): Promise<void> =>
    apiRequest(`/api/environments/${name}`, {
      method: 'DELETE',
    }),
};

// Request Runner API
export const runnerApi = {
  run: (data: RunRequest): Promise<RunResponse> =>
    apiRequest('/api/run', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export { ApiError };
