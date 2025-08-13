package runner

import (
	"github.com/datahopper/backend/internal/types"
)

// RunReq represents a request to execute an HTTP request
type RunReq struct {
	Method          string                    `json:"method" binding:"required"`
	URL             string                    `json:"url" binding:"required"`
	ProtoMessage    string                    `json:"protoMessage,omitempty"`    // FQN of request message type
    ResponseType    string                    `json:"responseType,omitempty"`    // FQN of success response message type
    ErrorResponseType string                  `json:"errorResponseType,omitempty"` // FQN of error response message type
	Headers         map[string]string         `json:"headers"`
	Body            []types.BodyField     `json:"body"`
	TimeoutSeconds  int                       `json:"timeoutSeconds"`
	Variables       map[string]string         `json:"variables"`
}

// RunRes represents the response from executing an HTTP request
type RunRes struct {
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Decoded string            `json:"decoded,omitempty"` // JSON representation if protobuf response
	Raw     string            `json:"raw,omitempty"`     // Raw response body
    DecodeError string        `json:"decodeError,omitempty"`
}

// RequestContext contains the context for executing a request
type RequestContext struct {
	Method          string
	URL             string
	Headers         map[string]string
	Body            interface{}
	TimeoutSeconds  int
	ProtoMessage    string
    ResponseType    string
    ErrorResponseType string
}

// ResponseContext contains the response data
type ResponseContext struct {
	Status     int
	Headers    map[string]string
	Body       []byte
	ContentType string
}
