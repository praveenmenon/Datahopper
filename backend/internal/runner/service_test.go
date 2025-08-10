package runner

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRunnerService(t *testing.T) {
	// Create a test HTTP server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Echo back the request method and headers
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Request-Method", r.Method)
		w.Header().Set("X-Request-URL", r.URL.String())
		
		// Echo back custom headers
		for key, values := range r.Header {
			if len(values) > 0 {
				w.Header().Set("X-Echo-"+key, values[0])
			}
		}

		// Return a simple JSON response
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "success", "method": "` + r.Method + `"}`))
	}))
	defer server.Close()

	runner := NewRunnerService()

	t.Run("SimpleGETRequest", func(t *testing.T) {
		req := RunReq{
			Method: "GET",
			URL:    server.URL + "/test",
			Headers: map[string]string{
				"X-Test-Header": "test-value",
			},
			TimeoutSeconds: 10,
		}

		resp, err := runner.RunRequest(context.Background(), req)
		if err != nil {
			t.Errorf("Failed to run GET request: %v", err)
		}

		if resp.Status != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, resp.Status)
		}

		if resp.Headers["X-Request-Method"] != "GET" {
			t.Errorf("Expected method 'GET', got %s", resp.Headers["X-Request-Method"])
		}

		if resp.Headers["X-Echo-X-Test-Header"] != "test-value" {
			t.Errorf("Expected header echo 'test-value', got %s", resp.Headers["X-Echo-X-Test-Header"])
		}
	})

	t.Run("POSTRequestWithBody", func(t *testing.T) {
		req := RunReq{
			Method: "POST",
			URL:    server.URL + "/test",
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: []BodyField{
				{Path: "name", Value: "John"},
				{Path: "age", Value: "30"},
			},
			TimeoutSeconds: 10,
		}

		resp, err := runner.RunRequest(context.Background(), req)
		if err != nil {
			t.Errorf("Failed to run POST request: %v", err)
		}

		if resp.Status != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, resp.Status)
		}

		if resp.Headers["X-Request-Method"] != "POST" {
			t.Errorf("Expected method 'POST', got %s", resp.Headers["X-Request-Method"])
		}
	})

	t.Run("RequestWithVariables", func(t *testing.T) {
		req := RunReq{
			Method: "GET",
			URL:    "{{base_url}}/{{endpoint}}",
			Headers: map[string]string{
				"Authorization": "Bearer {{token}}",
			},
			Variables: map[string]string{
				"base_url":  server.URL,
				"endpoint":  "test",
				"token":     "test-token-123",
			},
			TimeoutSeconds: 10,
		}

		resp, err := runner.RunRequest(context.Background(), req)
		if err != nil {
			t.Errorf("Failed to run request with variables: %v", err)
		}

		if resp.Status != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, resp.Status)
		}

		// Check that variables were interpolated
		if resp.Headers["X-Echo-Authorization"] != "Bearer test-token-123" {
			t.Errorf("Expected authorization header 'Bearer test-token-123', got %s", resp.Headers["X-Echo-Authorization"])
		}
	})

	t.Run("RequestTimeout", func(t *testing.T) {
		// Create a slow server
		slowServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(2 * time.Second) // Sleep for 2 seconds
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status": "delayed"}`))
		}))
		defer slowServer.Close()

		req := RunReq{
			Method:         "GET",
			URL:            slowServer.URL + "/test",
			TimeoutSeconds: 1, // 1 second timeout
		}

		_, err := runner.RunRequest(context.Background(), req)
		if err == nil {
			t.Error("Expected timeout error, got none")
		}
	})

	t.Run("InvalidURL", func(t *testing.T) {
		req := RunReq{
			Method: "GET",
			URL:    "invalid://url",
		}

		_, err := runner.RunRequest(context.Background(), req)
		if err == nil {
			t.Error("Expected error for invalid URL, got none")
		}
	})

	t.Run("UnsupportedMethod", func(t *testing.T) {
		req := RunReq{
			Method: "INVALID",
			URL:    server.URL + "/test",
		}

		_, err := runner.RunRequest(context.Background(), req)
		if err == nil {
			t.Error("Expected error for invalid method, got none")
		}
	})
}

func TestRunnerServiceWithProtobuf(t *testing.T) {
	// Create a test server that expects protobuf and returns protobuf
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check content type
		contentType := r.Header.Get("Content-Type")
		if contentType != "application/x-protobuf" {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error": "expected protobuf content type"}`))
			return
		}

		// Check accept header
		accept := r.Header.Get("Accept")
		if accept != "application/x-protobuf" {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error": "expected protobuf accept header"}`))
			return
		}

		// Return success
		w.Header().Set("Content-Type", "application/x-protobuf")
		w.WriteHeader(http.StatusOK)
		// In a real test, we'd return actual protobuf bytes
		w.Write([]byte("protobuf-response"))
	}))
	defer server.Close()

	runner := NewRunnerService()

	t.Run("ProtobufRequestAndResponse", func(t *testing.T) {
		req := RunReq{
			Method:        "POST",
			URL:           server.URL + "/protobuf",
			ProtoMessage:  "user.v1.CreateUserRequest",
			ResponseType:  "user.v1.CreateUserResponse",
			Headers: map[string]string{
				"X-Custom": "value",
			},
			Body: []BodyField{
				{Path: "user.id", Value: "123"},
				{Path: "user.email", Value: "test@example.com"},
			},
			TimeoutSeconds: 10,
		}

		resp, err := runner.RunRequest(context.Background(), req)
		if err != nil {
			t.Errorf("Failed to run protobuf request: %v", err)
		}

		if resp.Status != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, resp.Status)
		}

		// Check that content-type was set automatically
		if resp.Headers["X-Echo-Content-Type"] != "application/x-protobuf" {
			t.Errorf("Expected content-type 'application/x-protobuf', got %s", resp.Headers["X-Echo-Content-Type"])
		}

		// Check that accept header was set automatically
		if resp.Headers["X-Echo-Accept"] != "application/x-protobuf" {
			t.Errorf("Expected accept 'application/x-protobuf', got %s", resp.Headers["X-Echo-Accept"])
		}
	})

	t.Run("ProtobufRequestWithoutResponseType", func(t *testing.T) {
		req := RunReq{
			Method:       "POST",
			URL:          server.URL + "/protobuf",
			ProtoMessage: "user.v1.CreateUserRequest",
			Body: []BodyField{
				{Path: "user.id", Value: "123"},
			},
			TimeoutSeconds: 10,
		}

		resp, err := runner.RunRequest(context.Background(), req)
		if err != nil {
			t.Errorf("Failed to run protobuf request without response type: %v", err)
		}

		if resp.Status != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, resp.Status)
		}

		// Should still set content-type for request
		if resp.Headers["X-Echo-Content-Type"] != "application/x-protobuf" {
			t.Errorf("Expected content-type 'application/x-protobuf', got %s", resp.Headers["X-Echo-Content-Type"])
		}
	})
}

func TestRunnerServiceErrorHandling(t *testing.T) {
	runner := NewRunnerService()

	t.Run("ContextCancellation", func(t *testing.T) {
		// Create a server that takes a long time
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(5 * time.Second)
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		// Create a context that gets cancelled after a short time
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		req := RunReq{
			Method:         "GET",
			URL:            server.URL + "/test",
			TimeoutSeconds: 10,
		}

		_, err := runner.RunRequest(ctx, req)
		if err == nil {
			t.Error("Expected context cancellation error, got none")
		}
	})

	t.Run("LargeTimeout", func(t *testing.T) {
		req := RunReq{
			Method:         "GET",
			URL:            "http://example.com",
			TimeoutSeconds: 3600, // 1 hour
		}

		// This should not cause an error, just set a very long timeout
		_, err := runner.RunRequest(context.Background(), req)
		// We don't expect an error here, just testing that large timeouts are handled
		if err != nil && err.Error() != "context deadline exceeded" {
			t.Errorf("Unexpected error: %v", err)
		}
	})
}

func TestRunnerServiceHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Echo back all headers
		for key, values := range r.Header {
			if len(values) > 0 {
				w.Header().Set("X-Echo-"+key, values[0])
			}
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok"}`))
	}))
	defer server.Close()

	runner := NewRunnerService()

	t.Run("CustomHeaders", func(t *testing.T) {
		req := RunReq{
			Method: "GET",
			URL:    server.URL + "/test",
			Headers: map[string]string{
				"X-Custom-Header": "custom-value",
				"Authorization":    "Bearer token123",
				"User-Agent":       "DataHopper/1.0",
			},
			TimeoutSeconds: 10,
		}

		resp, err := runner.RunRequest(context.Background(), req)
		if err != nil {
			t.Errorf("Failed to run request with custom headers: %v", err)
		}

		// Check that all custom headers were sent
		expectedHeaders := map[string]string{
			"X-Custom-Header": "custom-value",
			"Authorization":    "Bearer token123",
			"User-Agent":       "DataHopper/1.0",
		}

		for key, expectedValue := range expectedHeaders {
			actualValue := resp.Headers["X-Echo-"+key]
			if actualValue != expectedValue {
				t.Errorf("Expected header %s to be '%s', got '%s'", key, expectedValue, actualValue)
			}
		}
	})

	t.Run("EmptyHeaders", func(t *testing.T) {
		req := RunReq{
			Method:         "GET",
			URL:            server.URL + "/test",
			Headers:        map[string]string{},
			TimeoutSeconds: 10,
		}

		resp, err := runner.RunRequest(context.Background(), req)
		if err != nil {
			t.Errorf("Failed to run request with empty headers: %v", err)
		}

		if resp.Status != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, resp.Status)
		}
	})
}
