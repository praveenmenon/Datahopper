package types

import "time"

// Variable represents a key-value variable
type Variable struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// HeaderKV represents a header key-value pair
type HeaderKV struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// BodyField represents a body field with dot-path and value
type BodyField struct {
	Path  string      `json:"path"`
	Value interface{} `json:"value"`
}

// Request represents an HTTP request configuration
type Request struct {
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	Method          string       `json:"method"`
	URL             string       `json:"url"`
	ProtoMessage    string       `json:"protoMessage,omitempty"`    // FQN of request message type
    ResponseType    string       `json:"responseType,omitempty"`    // FQN of success response message type
    ErrorResponseType string     `json:"errorResponseType,omitempty"` // FQN of error response message type
	Headers         []HeaderKV   `json:"headers"`
	Body            []BodyField  `json:"body"`
	TimeoutSeconds  int          `json:"timeoutSeconds"`
	CreatedAt       time.Time    `json:"createdAt"`
	UpdatedAt       time.Time    `json:"updatedAt"`
	LastResponse    map[string]any `json:"lastResponse,omitempty"`
	LastResponseAt  *time.Time      `json:"lastResponseAt,omitempty"`
}

// Collection represents a group of related requests
type Collection struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	ProtoRoots  []string          `json:"protoRoots"`  // Paths to .proto files
	Variables   map[string]string `json:"variables"`   // Collection-scoped variables
	Requests    []*Request        `json:"requests"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}

// Environment represents a set of variables for different contexts
type Environment struct {
	Name      string            `json:"name"`
	Variables map[string]string `json:"variables"`
}

// CreateCollectionRequest represents the request to create a collection
type CreateCollectionRequest struct {
	Name        string            `json:"name" binding:"required"`
	Description string            `json:"description"`
	ProtoRoots  []string          `json:"protoRoots"`
	Variables   map[string]string `json:"variables"`
}

// CreateRequestRequest represents the request to create a request
type CreateRequestRequest struct {
	Name           string       `json:"name" binding:"required"`
	Method         string       `json:"method" binding:"required"`
	URL            string       `json:"url" binding:"required"`
	ProtoMessage   string       `json:"protoMessage"`
    ResponseType   string       `json:"responseType"`
    ErrorResponseType string    `json:"errorResponseType"`
	Headers        []HeaderKV   `json:"headers"`
	Body           []BodyField  `json:"body"`
	TimeoutSeconds int          `json:"timeoutSeconds"`
}

// UpdateRequestRequest represents the request to update a request
type UpdateRequestRequest struct {
	Name           string       `json:"name"`
	Method         string       `json:"method"`
	URL            string       `json:"url"`
	ProtoMessage   string       `json:"protoMessage"`
    ResponseType   string       `json:"responseType"`
    ErrorResponseType string    `json:"errorResponseType"`
	Headers        []HeaderKV   `json:"headers"`
	Body           []BodyField  `json:"body"`
	TimeoutSeconds int          `json:"timeoutSeconds"`
}

// RunRequest represents a request to execute an HTTP request
type RunRequest struct {
	Method       string                 `json:"method" binding:"required"`
	URL          string                 `json:"url" binding:"required"`
	ProtoMessage string                 `json:"protoMessage,omitempty"`
	ResponseType string                 `json:"responseType,omitempty"`
	Headers      map[string]string     `json:"headers"`
	Body         []BodyField           `json:"body"`
	Timeout      int                   `json:"timeout"`
	Variables    map[string]string     `json:"variables"`
}

// RunResponse represents the response from executing an HTTP request
type RunResponse struct {
	Status       int                    `json:"status"`
	Headers      map[string]string     `json:"headers"`
	Body         []byte                 `json:"body"`
	DecodedBody  interface{}            `json:"decodedBody,omitempty"`
	RawBody      string                 `json:"rawBody"`
	Error        string                 `json:"error,omitempty"`
	Duration     time.Duration          `json:"duration"`
}

// MessageType represents a Protobuf message type
type MessageType struct {
	FQN         string `json:"fqn"`
	Package     string `json:"package"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// RegisterProtoRequest represents a request to register Protobuf files
type RegisterProtoRequest struct {
	Paths    []string `json:"paths" binding:"required"`
	Includes []string `json:"includes"`
}
