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
  errorResponseType?: string;
  headers: HeaderKV[];
  body: BodyField[];
  timeoutSeconds?: number;
  createdAt: string;
  updatedAt: string;
  lastResponse?: Record<string, any> | null;
  lastResponseAt?: string | null;
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
  errorResponseType?: string;
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
  errorResponseType?: string;
  headers?: HeaderKV[];
  body?: BodyField[];
  timeoutSeconds?: number;
}

export interface RunRequest {
  method: string;
  url: string;
  protoMessage?: string;
  responseType?: string;
  errorResponseType?: string;
  headers: Record<string, string>;
  body: BodyField[];
  timeoutSeconds?: number;
  variables: Record<string, string>;
  collectionId?: string;
  requestId?: string;
}

export interface RunResponse {
  status: number;
  headers: Record<string, string>;
  decoded?: string;
  raw?: string;
  decodeError?: string;
}

// Registry types
export interface ProtoRegisterRequest {
  path: string;
  includePaths?: string[];
}

export interface MessageType {
  fqName: string;
  package?: string;
  name?: string;
  description?: string;
}

export interface MessageField {
  path?: string;  // Dot notation path for nested fields
  name: string;
  number: number;
  type: string;
  repeated: boolean;
  optional: boolean;
  message: boolean;
  messageType?: string;
  enum?: boolean;
  enumValues?: string[];
  // Oneof information
  oneof?: boolean;
  oneofName?: string;
  oneofIndex?: number;
}

export interface MessageFieldsResponse {
  fqn: string;
  fields: MessageField[];
}

// Comprehensive schema (optional, if backend exposes /schema)
export interface EnumValueMeta {
  name: string;
  number: number;
  deprecated?: boolean;
}

export interface EnumMeta {
  name: string;
  values: EnumValueMeta[];
}

export interface MapMeta {
  keyKind: string;
  valueKind: string;
  valueFqmn?: string;
}

export interface WellKnownTypeMeta {
  type: string;
  format?: string;
}

export interface FieldSchemaMeta {
  name: string;
  jsonName?: string;
  number: number;
  kind: string; // string, int32, message, enum, etc.
  cardinality: 'optional' | 'repeated' | 'map';
  hasPresence: boolean;
  defaultValue?: any;
  oneofIndex?: number | null;
  deprecated?: boolean;
  messageFqmn?: string;
  enum?: EnumMeta;
  map?: MapMeta;
  wkt?: WellKnownTypeMeta;
  bytesHint?: string;
}

export interface OneofGroupMeta {
  index: number;
  name: string;
  fields: string[];
}

export interface MessageSchemaMeta {
  fqmn: string;
  descriptorHash?: string;
  fields: FieldSchemaMeta[];
  oneofs: OneofGroupMeta[];
  wkt?: WellKnownTypeMeta;
  reservedNumbers?: number[];
  reservedNames?: string[];
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
