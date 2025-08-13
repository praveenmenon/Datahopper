package registry

import (
	"testing"
)

func TestRegistryService(t *testing.T) {
	// Create registry service
	registry := NewService()

	t.Run("NewService", func(t *testing.T) {
		if registry == nil {
			t.Error("Expected registry service, got nil")
		}
	})

	t.Run("ListMessageTypesEmpty", func(t *testing.T) {
		// Test that initially there are no message types
		messageTypes, err := registry.ListMessageTypes()
		if err != nil {
			t.Errorf("Failed to list message types: %v", err)
		}

		if len(messageTypes) != 0 {
			t.Errorf("Expected 0 message types initially, got %d", len(messageTypes))
		}
	})

	t.Run("GetMessageDescriptorNotFound", func(t *testing.T) {
		// Test getting a non-existent message descriptor
		descriptor, err := registry.GetMessageDescriptor("non.existent.Message")
		if err == nil {
			t.Error("Expected error when getting non-existent message type")
		}
		if descriptor != nil {
			t.Error("Expected nil descriptor for non-existent message type")
		}
	})
}
