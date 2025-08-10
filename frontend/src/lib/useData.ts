import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  collectionsApi, 
  environmentsApi, 
  protoApi, 
  requestsApi, 
  runnerApi,
  ApiError 
} from './api';
import { 
  Collection, 
  Environment, 
  MessageType, 
  CreateCollectionRequest, 
  CreateRequestRequest, 
  UpdateRequestRequest,
  RunRequest,
  RunResponse,
  Request
} from './types';

// Collections
export const useCollections = () => {
  return useQuery<Collection[], ApiError>('collections', collectionsApi.list);
};

export const useCollection = (id: string) => {
  return useQuery<Collection, ApiError>(
    ['collection', id], 
    () => collectionsApi.get(id),
    { enabled: !!id }
  );
};

export const useCreateCollection = () => {
  const queryClient = useQueryClient();
  return useMutation<Collection, ApiError, CreateCollectionRequest>(
    collectionsApi.create,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('collections');
      },
    }
  );
};

export const useUpdateCollection = () => {
  const queryClient = useQueryClient();
  return useMutation<Collection, ApiError, { id: string; data: Partial<Collection> }>(
    ({ id, data }) => collectionsApi.update(id, data),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries(['collection', id]);
        queryClient.invalidateQueries('collections');
      },
    }
  );
};

export const useDeleteCollection = () => {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>(
    collectionsApi.delete,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('collections');
      },
    }
  );
};

// Requests
export const useCreateRequest = () => {
  const queryClient = useQueryClient();
  return useMutation<Request, ApiError, { collectionId: string; data: CreateRequestRequest }>(
    ({ collectionId, data }) => requestsApi.create(collectionId, data),
    {
      onSuccess: (_, { collectionId }) => {
        queryClient.invalidateQueries(['collection', collectionId]);
        queryClient.invalidateQueries('collections');
      },
    }
  );
};

export const useUpdateRequest = () => {
  const queryClient = useQueryClient();
  return useMutation<
    Request, 
    ApiError, 
    { collectionId: string; requestId: string; data: UpdateRequestRequest }
  >(
    ({ collectionId, requestId, data }) => requestsApi.update(collectionId, requestId, data),
    {
      onSuccess: (_, { collectionId }) => {
        queryClient.invalidateQueries(['collection', collectionId]);
        queryClient.invalidateQueries('collections');
      },
    }
  );
};

export const useDeleteRequest = () => {
  const queryClient = useQueryClient();
  return useMutation<
    void, 
    ApiError, 
    { collectionId: string; requestId: string }
  >(
    ({ collectionId, requestId }) => requestsApi.delete(collectionId, requestId),
    {
      onSuccess: (_, { collectionId }) => {
        queryClient.invalidateQueries(['collection', collectionId]);
        queryClient.invalidateQueries('collections');
      },
    }
  );
};

// Environments
export const useEnvironments = () => {
  return useQuery<Environment[], ApiError>('environments', environmentsApi.list);
};

export const useCreateEnvironment = () => {
  const queryClient = useQueryClient();
  return useMutation<Environment, ApiError, Environment>(
    environmentsApi.create,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('environments');
      },
    }
  );
};

export const useUpdateEnvironment = () => {
  const queryClient = useQueryClient();
  return useMutation<Environment, ApiError, { name: string; data: Partial<Environment> }>(
    ({ name, data }) => environmentsApi.update(name, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('environments');
      },
    }
  );
};

export const useDeleteEnvironment = () => {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>(
    environmentsApi.delete,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('environments');
      },
    }
  );
};

// Protobuf Registry
export const useMessageTypes = () => {
  return useQuery<MessageType[], ApiError>('messageTypes', protoApi.listMessages);
};

export const useRegisterProto = () => {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { path: string; includePaths?: string[] }>(
    ({ path, includePaths }) => protoApi.register({ path, includePaths }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('messageTypes');
      },
    }
  );
};

// Request Runner
export const useRunRequest = () => {
  return useMutation<RunResponse, ApiError, RunRequest>(runnerApi.run);
};
