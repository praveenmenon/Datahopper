package runner

import (
	"testing"
)

func TestRunnerService(t *testing.T) {
	// Create registry service
	runner := NewService(nil)

	t.Run("NewService", func(t *testing.T) {
		if runner == nil {
			t.Error("Expected runner service, got nil")
		}
	})

	t.Run("RunWithInvalidRequest", func(t *testing.T) {
		// Test with an invalid request (empty URL)
		req := &RunReq{
			Method: "GET",
			URL:    "",
		}

		_, err := runner.Run(req)
		if err == nil {
			t.Error("Expected error for invalid request, got none")
		}
	})
}
