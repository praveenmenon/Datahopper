package runner

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/datahopper/backend/internal/dotpath"
	"github.com/datahopper/backend/internal/interpolate"
	"github.com/datahopper/backend/internal/registry"
	"github.com/datahopper/backend/internal/types"
	"github.com/rs/zerolog"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
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
    result, err := s.processResponse(resp, req.ResponseType, req.ErrorResponseType)
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
		// Log the body structure for debugging
		if bodyMap, ok := body.(map[string]interface{}); ok {
			bodyJSON, _ := json.MarshalIndent(bodyMap, "", "  ")
			s.logger.Debug().
				Str("messageType", req.ProtoMessage).
				Str("body", string(bodyJSON)).
				Msg("Building protobuf body")
		}
		
		encodedBody, err := s.encodeProtobufBody(req.ProtoMessage, body, req.Body)
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
        ErrorResponseType: req.ErrorResponseType,
	}, nil
}

// encodeProtobufBody encodes a JSON body as Protobuf
func (s *Service) encodeProtobufBody(messageType string, body interface{}, originalFields []types.BodyField) ([]byte, error) {
	// Get message descriptor
	msgDesc, err := s.registry.GetMessageDescriptor(messageType)
	if err != nil {
		return nil, fmt.Errorf("message descriptor not found: %s", messageType)
	}

	// Clean up the body to handle potential oneof conflicts using the descriptor and original field order
	cleanedBody := s.cleanBodyForProtobufWithDescriptor(msgDesc, body, originalFields)

	// Create dynamic message
	dynamicMsg := dynamicpb.NewMessage(msgDesc)

	// Convert cleaned body to JSON bytes
	jsonBytes, err := json.Marshal(cleanedBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal body to JSON: %w", err)
	}

	// Unmarshal JSON into dynamic message with more permissive options
	unmarshalOpts := protojson.UnmarshalOptions{
		DiscardUnknown: true, // Allow unknown fields
		AllowPartial:   true, // Allow partial messages
	}
	if err := unmarshalOpts.Unmarshal(jsonBytes, dynamicMsg); err != nil {
		// If unmarshaling fails, try to provide a more helpful error
		return nil, fmt.Errorf("failed to unmarshal JSON into protobuf: %w. This often happens when conflicting values are set for oneof fields or when required fields are missing", err)
	}

	// Marshal to protobuf bytes
	protoBytes, err := proto.Marshal(dynamicMsg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal protobuf: %w", err)
	}

return protoBytes, nil
}

// cleanBodyForProtobufWithDescriptor cleans up the body to handle potential oneof conflicts
// by pruning multiple members of the same oneof, keeping the last-set one based on the
// order of original dot-path fields.
func (s *Service) cleanBodyForProtobufWithDescriptor(md protoreflect.MessageDescriptor, body interface{}, originalFields []types.BodyField) interface{} {
	if bodyMap, ok := body.(map[string]interface{}); ok {
		cleaned := make(map[string]interface{})
		
		// Process fields in a deterministic order to handle conflicts
		keys := make([]string, 0, len(bodyMap))
		for k := range bodyMap {
			keys = append(keys, k)
		}
		// Sort keys for deterministic processing
		sort.Strings(keys)
		
		// First copy as-is
		for _, key := range keys {
			cleaned[key] = bodyMap[key]
		}

		// Prune oneof conflicts at this level
		pruneOneofConflicts(md, cleaned, "", originalFields)

		// Recurse into nested message fields
		for i := 0; i < md.Fields().Len(); i++ {
			fd := md.Fields().Get(i)
			jsonName := fd.JSONName()
			val, exists := cleaned[jsonName]
			if !exists {
				continue
			}
			if fd.Kind() == protoreflect.MessageKind {
				childMd := fd.Message()
				// Map value
				if childMap, ok := val.(map[string]interface{}); ok {
					cleaned[jsonName] = s.cleanBodyForProtobufWithDescriptor(childMd, childMap, originalFields)
				} else if arr, ok := val.([]interface{}); ok {
					// Recurse for each element if it's a map
					for idx, item := range arr {
						if itemMap, ok := item.(map[string]interface{}); ok {
							arr[idx] = s.cleanBodyForProtobufWithDescriptor(childMd, itemMap, originalFields)
						}
					}
					cleaned[jsonName] = arr
				}
			}
		}
		
		return cleaned
	}
	
	return body
}

// pruneOneofConflicts removes conflicting oneof members from the given map, keeping the last-set one
// based on the order in originalFields.
func pruneOneofConflicts(md protoreflect.MessageDescriptor, m map[string]interface{}, basePath string, originalFields []types.BodyField) {
	// Build a quick path order index for lookup
	orderedPaths := make([]string, len(originalFields))
	for i, bf := range originalFields {
		orderedPaths[i] = bf.Path
	}

	// For each oneof, find present members and keep the last one
	for i := 0; i < md.Oneofs().Len(); i++ {
		od := md.Oneofs().Get(i)
		present := make([]string, 0)
		for j := 0; j < od.Fields().Len(); j++ {
			fd := od.Fields().Get(j)
			jsonName := fd.JSONName()
			if _, exists := m[jsonName]; exists {
				present = append(present, jsonName)
			}
		}
		if len(present) <= 1 {
			continue
		}

		// Determine which to keep based on latest occurrence in originalPaths
		keepKey := present[0]
		keepIdx := -1
		for _, key := range present {
			candidatePrefix := joinPath(basePath, key)
			idx := lastIndexWithPrefix(orderedPaths, candidatePrefix)
			if idx > keepIdx {
				keepIdx = idx
				keepKey = key
			}
		}

		for _, key := range present {
			if key != keepKey {
				delete(m, key)
			}
		}
	}
}

func joinPath(base, key string) string {
	if base == "" {
		return key
	}
	return base + "." + key
}

func lastIndexWithPrefix(paths []string, prefix string) int {
	last := -1
	for i, p := range paths {
		if strings.HasPrefix(p, prefix) {
			last = i
		}
	}
	return last
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
func (s *Service) processResponse(resp *ResponseContext, responseType string, errorResponseType string) (*RunRes, error) {
	result := &RunRes{
		Status:  resp.Status,
		Headers: resp.Headers,
	}

    // Pick which message type to use for decoding: success 2xx -> responseType, else errorResponseType if provided
    selectedType := responseType
    if resp.Status < 200 || resp.Status >= 300 {
        if errorResponseType != "" {
            selectedType = errorResponseType
        }
    }

    // Try to decode protobuf response if specified
    if selectedType != "" && s.isProtobufResponse(resp.ContentType) {
        decoded, err := s.decodeProtobufResponse(selectedType, resp.Body)
        if err != nil {
            s.logger.Warn().Err(err).Msg("Failed to decode protobuf response, using raw")
            result.Raw = string(resp.Body)
            result.DecodeError = err.Error()
        } else {
            result.Decoded = decoded
            // Heuristic: decoded to an empty structure though body had content → likely wrong type
            trimmed := strings.TrimSpace(decoded)
            if len(resp.Body) > 0 && (trimmed == "{}" || trimmed == "[]") {
                result.DecodeError = "Decoded to an empty structure; the selected message type may be incorrect."
            }
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
