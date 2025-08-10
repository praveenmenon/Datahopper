package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/datahopper/backend/internal/dotpath"
	"github.com/datahopper/backend/internal/interpolate"
	"github.com/datahopper/backend/internal/registry"
	"github.com/rs/zerolog"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/dynamicpb"
)

// Service provides HTTP request execution with Protobuf support
type Service struct {
	registry *registry.Service
	logger   zerolog.Logger
	client   *http.Client
}

// NewService creates a new runner service
func NewService(registry *registry.Service) *Service {
	return &Service{
		registry: registry,
		client:   &http.Client{},
	}
}

// Run executes an HTTP request according to the RunReq specification
func (s *Service) Run(req *RunReq) (*RunRes, error) {
	s.logger.Info().
		Str("method", req.Method).
		Str("url", req.URL).
		Msg("Executing request")

	// Build request context
	ctx, err := s.buildRequestContext(req)
	if err != nil {
		return nil, fmt.Errorf("failed to build request context: %w", err)
	}

	// Execute HTTP request
	resp, err := s.executeRequest(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}

	// Process response
	result, err := s.processResponse(resp, req.ResponseType)
	if err != nil {
		return nil, fmt.Errorf("failed to process response: %w", err)
	}

	return result, nil
}

// buildRequestContext builds the request context from RunReq
func (s *Service) buildRequestContext(req *RunReq) (*RequestContext, error) {
	// Merge variables (collection -> environment -> request)
	mergedVars := req.Variables
	if mergedVars == nil {
		mergedVars = make(map[string]string)
	}

	// Interpolate URL and headers
	interpolatedURL := interpolate.String(req.URL, mergedVars)
	interpolatedHeaders := interpolate.Deep(req.Headers, mergedVars).(map[string]string)

	// Build body from dot-path fields
	var body interface{}
	if len(req.Body) > 0 {
		// Convert types.BodyField to interface{} slice for dotpath.BuildFromFields
		fields := make([]interface{}, len(req.Body))
		for i, field := range req.Body {
			fields[i] = map[string]interface{}{
				"path":  field.Path,
				"value": field.Value,
			}
		}
		bodyMap, err := dotpath.BuildFromFields(fields)
		if err != nil {
			return nil, fmt.Errorf("failed to build body from fields: %w", err)
		}
		body = bodyMap
	}

	// Encode body as Protobuf if specified
	if req.ProtoMessage != "" && body != nil {
		encodedBody, err := s.encodeProtobufBody(req.ProtoMessage, body)
		if err != nil {
			return nil, fmt.Errorf("failed to encode protobuf body: %w", err)
		}
		body = encodedBody
	}

	// Set default headers
	if interpolatedHeaders == nil {
		interpolatedHeaders = make(map[string]string)
	}

	// Set Content-Type based on body type
	if req.ProtoMessage != "" {
		interpolatedHeaders["Content-Type"] = "application/x-protobuf"
	} else if body != nil {
		interpolatedHeaders["Content-Type"] = "application/json"
	}

	// Set Accept header for protobuf responses
	if req.ResponseType != "" {
		interpolatedHeaders["Accept"] = "application/x-protobuf, application/octet-stream"
	}

	// Set timeout
	timeout := req.TimeoutSeconds
	if timeout <= 0 {
		timeout = 30 // Default 30 seconds
	}

	return &RequestContext{
		Method:         req.Method,
		URL:            interpolatedURL,
		Headers:        interpolatedHeaders,
		Body:           body,
		TimeoutSeconds: timeout,
		ProtoMessage:   req.ProtoMessage,
		ResponseType:   req.ResponseType,
	}, nil
}

// encodeProtobufBody encodes a JSON body as Protobuf
func (s *Service) encodeProtobufBody(messageType string, body interface{}) ([]byte, error) {
	// Get message descriptor
	msgDesc, err := s.registry.GetMessageDescriptor(messageType)
	if err != nil {
		return nil, fmt.Errorf("message descriptor not found: %s", messageType)
	}

	// Create dynamic message
	dynamicMsg := dynamicpb.NewMessage(msgDesc)

	// Convert body to JSON bytes
	jsonBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal body to JSON: %w", err)
	}

	// Unmarshal JSON into dynamic message
	unmarshalOpts := protojson.UnmarshalOptions{
		DiscardUnknown: false,
	}
	if err := unmarshalOpts.Unmarshal(jsonBytes, dynamicMsg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON into protobuf: %w", err)
	}

	// Marshal to protobuf bytes
	protoBytes, err := proto.Marshal(dynamicMsg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal protobuf: %w", err)
	}

	return protoBytes, nil
}

// executeRequest executes the HTTP request
func (s *Service) executeRequest(ctx *RequestContext) (*ResponseContext, error) {
	// Create HTTP request
	var bodyReader io.Reader
	if ctx.Body != nil {
		switch body := ctx.Body.(type) {
		case []byte:
			bodyReader = bytes.NewReader(body)
		case string:
			bodyReader = strings.NewReader(body)
		default:
			jsonBytes, err := json.Marshal(body)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal body: %w", err)
			}
			bodyReader = bytes.NewReader(jsonBytes)
		}
	}

	httpReq, err := http.NewRequest(ctx.Method, ctx.URL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	for key, value := range ctx.Headers {
		httpReq.Header.Set(key, value)
	}

	// Set timeout
	timeoutCtx, cancel := context.WithTimeout(context.Background(), time.Duration(ctx.TimeoutSeconds)*time.Second)
	defer cancel()
	httpReq = httpReq.WithContext(timeoutCtx)

	// Execute request
	s.logger.Debug().Msg("Sending HTTP request")
	resp, err := s.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Build response context
	responseCtx := &ResponseContext{
		Status:      resp.StatusCode,
		Headers:     make(map[string]string),
		Body:        bodyBytes,
		ContentType: resp.Header.Get("Content-Type"),
	}

	// Copy headers
	for key, values := range resp.Header {
		if len(values) > 0 {
			responseCtx.Headers[key] = values[0]
		}
	}

	return responseCtx, nil
}

// processResponse processes the HTTP response
func (s *Service) processResponse(resp *ResponseContext, responseType string) (*RunRes, error) {
	result := &RunRes{
		Status:  resp.Status,
		Headers: resp.Headers,
	}

	// Try to decode protobuf response if specified
	if responseType != "" && s.isProtobufResponse(resp.ContentType) {
		decoded, err := s.decodeProtobufResponse(responseType, resp.Body)
		if err != nil {
			s.logger.Warn().Err(err).Msg("Failed to decode protobuf response, using raw")
			result.Raw = string(resp.Body)
		} else {
			result.Decoded = decoded
		}
	} else {
		// Use raw response
		result.Raw = string(resp.Body)
	}

	return result, nil
}

// isProtobufResponse checks if the response is a protobuf message
func (s *Service) isProtobufResponse(contentType string) bool {
	return strings.Contains(contentType, "application/x-protobuf") ||
		strings.Contains(contentType, "application/octet-stream")
}

// decodeProtobufResponse decodes a protobuf response to JSON
func (s *Service) decodeProtobufResponse(messageType string, bodyBytes []byte) (string, error) {
	// Get message descriptor
	msgDesc, err := s.registry.GetMessageDescriptor(messageType)
	if err != nil {
		return "", fmt.Errorf("message descriptor not found: %s", messageType)
	}

	// Create dynamic message
	dynamicMsg := dynamicpb.NewMessage(msgDesc)

	// Unmarshal protobuf bytes
	if err := proto.Unmarshal(bodyBytes, dynamicMsg); err != nil {
		return "", fmt.Errorf("failed to unmarshal protobuf: %w", err)
	}

	// Marshal to JSON
	marshalOpts := protojson.MarshalOptions{
		Multiline: true,
		Indent:    "  ",
	}
	jsonBytes, err := marshalOpts.Marshal(dynamicMsg)
	if err != nil {
		return "", fmt.Errorf("failed to marshal to JSON: %w", err)
	}

	return string(jsonBytes), nil
}

// SetLogger sets the logger for the service
func (s *Service) SetLogger(logger zerolog.Logger) {
	s.logger = logger
}
