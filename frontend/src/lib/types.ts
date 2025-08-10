// Core data models
export interface Variable {
  key: string;
  value: string;
}

export interface HeaderKV {
  key: string;
  value: string;
}

export interface BodyField {
  path: string;
  value: any;
}

export interface Request {
  id: string;
  name: string;
  method: string;
  url: string;
  protoMessage?: string;
  responseType?: string;
  headers: HeaderKV[];
  body: BodyField[];
  timeoutSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  protoRoots: string[];
  variables?: Record<string, string>;
  requests: Request[];
  createdAt: string;
  updatedAt: string;
}

export interface Environment {
  name: string;
  variables: Record<string, string>;
}

// API request/response types
export interface CreateCollectionRequest {
  name: string;
  description?: string;
  protoRoots?: string[];
  variables?: Record<string, string>;
}

export interface CreateRequestRequest {
  name: string;
  method: string;
  url: string;
  protoMessage?: string;
  responseType?: string;
  headers?: HeaderKV[];
  body?: BodyField[];
  timeoutSeconds?: number;
}

export interface UpdateRequestRequest {
  name?: string;
  method?: string;
  url?: string;
  protoMessage?: string;
  responseType?: string;
  headers?: HeaderKV[];
  body?: BodyField[];
  timeoutSeconds?: number;
}

export interface RunRequest {
  method: string;
  url: string;
  protoMessage?: string;
  responseType?: string;
  headers: Record<string, string>;
  body: BodyField[];
  timeoutSeconds?: number;
  variables: Record<string, string>;
}

export interface RunResponse {
  status: number;
  headers: Record<string, string>;
  decoded?: string;
  raw?: string;
}

// Registry types
export interface ProtoRegisterRequest {
  path: string;
  includePaths?: string[];
}

export interface MessageType {
  fqName: string;
}

// UI state types
export interface AppState {
  collections: Collection[];
  environments: Environment[];
  activeEnvironment: string;
  messageTypes: MessageType[];
  isLoading: boolean;
  error: string | null;
}

export interface RequestFormData {
  method: string;
  url: string;
  protoMessage: string;
  responseType: string;
  headers: HeaderKV[];
  body: BodyField[];
  timeoutSeconds: number;
}
