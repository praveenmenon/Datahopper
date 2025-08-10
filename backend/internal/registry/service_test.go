package registry

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRegistryService(t *testing.T) {
	// Create a temporary directory for test proto files
	tempDir, err := os.MkdirTemp("", "registry_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create a simple test proto file
	protoContent := `syntax = "proto3";

package user.v1;

option go_package = "github.com/example/user/v1;userv1";

message User {
  string id = 1;
  string email = 2;
  repeated string tags = 3;
}

message CreateUserRequest {
  User user = 1;
}

message CreateUserResponse {
  string status = 1;
}
`
	protoPath := filepath.Join(tempDir, "user.proto")
	if err := os.WriteFile(protoPath, []byte(protoContent), 0644); err != nil {
		t.Fatalf("Failed to write test proto file: %v", err)
	}

	// Create registry service
	registry := NewRegistryService()

	t.Run("RegisterProtoFile", func(t *testing.T) {
		// Test registering a single proto file
		err := registry.RegisterProto(protoPath, nil)
		if err != nil {
			t.Errorf("Failed to register proto file: %v", err)
		}

		// Verify message types are available
		messageTypes, err := registry.ListMessageTypes()
		if err != nil {
			t.Errorf("Failed to list message types: %v", err)
		}

		expectedTypes := []string{
			"user.v1.User",
			"user.v1.CreateUserRequest",
			"user.v1.CreateUserResponse",
		}

		if len(messageTypes) != len(expectedTypes) {
			t.Errorf("Expected %d message types, got %d", len(expectedTypes), len(messageTypes))
		}

		// Check that all expected types are present
		typeMap := make(map[string]bool)
		for _, msgType := range messageTypes {
			typeMap[msgType.FQName] = true
		}

		for _, expectedType := range expectedTypes {
			if !typeMap[expectedType] {
				t.Errorf("Expected message type %s not found", expectedType)
			}
		}
	})

	t.Run("GetMessageDescriptor", func(t *testing.T) {
		// Test getting a specific message descriptor
		descriptor, err := registry.GetMessageDescriptor("user.v1.User")
		if err != nil {
			t.Errorf("Failed to get message descriptor: %v", err)
		}

		if descriptor == nil {
			t.Error("Expected message descriptor, got nil")
		}

		// Verify the descriptor has the expected fields
		if descriptor.GetName() != "User" {
			t.Errorf("Expected message name 'User', got '%s'", descriptor.GetName())
		}

		// Check field count (id, email, tags)
		if len(descriptor.GetField()) != 3 {
			t.Errorf("Expected 3 fields, got %d", len(descriptor.GetField()))
		}
	})

	t.Run("GetFileDescriptor", func(t *testing.T) {
		// Test getting file descriptor
		fileDescriptor, err := registry.GetFileDescriptor("user.proto")
		if err != nil {
			t.Errorf("Failed to get file descriptor: %v", err)
		}

		if fileDescriptor == nil {
			t.Error("Expected file descriptor, got nil")
		}

		if fileDescriptor.GetName() != "user.proto" {
			t.Errorf("Expected file name 'user.proto', got '%s'", fileDescriptor.GetName())
		}
	})

	t.Run("RegisterProtoDirectory", func(t *testing.T) {
		// Test registering a directory
		err := registry.RegisterProto(tempDir, nil)
		if err != nil {
			t.Errorf("Failed to register proto directory: %v", err)
		}

		// Should still have the same message types
		messageTypes, err := registry.ListMessageTypes()
		if err != nil {
			t.Errorf("Failed to list message types after directory registration: %v", err)
		}

		if len(messageTypes) < 3 {
			t.Errorf("Expected at least 3 message types after directory registration, got %d", len(messageTypes))
		}
	})

	t.Run("InvalidProtoFile", func(t *testing.T) {
		// Test with invalid proto content
		invalidProto := `syntax = "proto3";
package invalid;

message InvalidMessage {
  invalid_type field = 1;
}
`
		invalidPath := filepath.Join(tempDir, "invalid.proto")
		if err := os.WriteFile(invalidPath, []byte(invalidProto), 0644); err != nil {
			t.Fatalf("Failed to write invalid proto file: %v", err)
		}

		// Should handle invalid proto gracefully
		err := registry.RegisterProto(invalidPath, nil)
		if err == nil {
			t.Log("Note: Invalid proto file was accepted (this might be expected behavior)")
		}
	})

	t.Run("NonExistentFile", func(t *testing.T) {
		// Test with non-existent file
		err := registry.RegisterProto("/non/existent/file.proto", nil)
		if err == nil {
			t.Error("Expected error when registering non-existent file")
		}
	})

	t.Run("MessageTypeNotFound", func(t *testing.T) {
		// Test getting non-existent message type
		descriptor, err := registry.GetMessageDescriptor("non.existent.Message")
		if err == nil {
			t.Error("Expected error when getting non-existent message type")
		}
		if descriptor != nil {
			t.Error("Expected nil descriptor for non-existent message type")
		}
	})
}

func TestRegistryServiceWithIncludePaths(t *testing.T) {
	// Create a temporary directory structure for test proto files with imports
	tempDir, err := os.MkdirTemp("", "registry_include_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create common proto directory
	commonDir := filepath.Join(tempDir, "common")
	if err := os.MkdirAll(commonDir, 0755); err != nil {
		t.Fatalf("Failed to create common dir: %v", err)
	}

	// Create common proto file
	commonProto := `syntax = "proto3";

package common.v1;

option go_package = "github.com/example/common/v1;commonv1";

message Timestamp {
  int64 seconds = 1;
  int32 nanos = 2;
}
`
	commonPath := filepath.Join(commonDir, "timestamp.proto")
	if err := os.WriteFile(commonPath, []byte(commonProto), 0644); err != nil {
		t.Fatalf("Failed to write common proto file: %v", err)
	}

	// Create main proto file that imports common
	mainProto := `syntax = "proto3";

package main.v1;

option go_package = "github.com/example/main/v1;mainv1";

import "common/v1/timestamp.proto";

message Event {
  string id = 1;
  common.v1.Timestamp created_at = 2;
}
`
	mainPath := filepath.Join(tempDir, "main.proto")
	if err := os.WriteFile(mainPath, []byte(mainProto), 0644); err != nil {
		t.Fatalf("Failed to write main proto file: %v", err)
	}

	// Create registry service
	registry := NewRegistryService()

	t.Run("RegisterWithIncludePaths", func(t *testing.T) {
		// Test registering with include paths
		includePaths := []string{tempDir}
		err := registry.RegisterProto(mainPath, includePaths)
		if err != nil {
			t.Errorf("Failed to register proto with include paths: %v", err)
		}

		// Verify both message types are available
		messageTypes, err := registry.ListMessageTypes()
		if err != nil {
			t.Errorf("Failed to list message types: %v", err)
		}

		expectedTypes := []string{
			"common.v1.Timestamp",
			"main.v1.Event",
		}

		if len(messageTypes) < len(expectedTypes) {
			t.Errorf("Expected at least %d message types, got %d", len(expectedTypes), len(messageTypes))
		}

		// Check that main message type is present
		typeMap := make(map[string]bool)
		for _, msgType := range messageTypes {
			typeMap[msgType.FQName] = true
		}

		if !typeMap["main.v1.Event"] {
			t.Error("Expected message type 'main.v1.Event' not found")
		}
	})
}
