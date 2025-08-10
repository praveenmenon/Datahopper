package registry

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/rs/zerolog"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
)

// Service manages Protobuf file registration and message type discovery
type Service struct {
	mu           sync.RWMutex
	files        *protoregistry.Files
	logger       zerolog.Logger
	protoRoots   []string
	includePaths []string
}

// NewService creates a new Protobuf registry service
func NewService() *Service {
	return &Service{
		files:        &protoregistry.Files{},
		protoRoots:   make([]string, 0),
		includePaths: make([]string, 0),
	}
}

// RegisterRoot registers a root directory or single .proto file
func (s *Service) RegisterRoot(path string, include []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.logger.Info().Str("path", path).Msg("Registering Protobuf root")

	// Add include paths
	if include != nil {
		s.includePaths = append(s.includePaths, include...)
	}

	// Check if path is a file or directory
	if strings.HasSuffix(path, ".proto") {
		return s.registerSingleFile(path)
	}

	return s.registerDirectory(path)
}

// registerSingleFile registers a single .proto file
func (s *Service) registerSingleFile(filePath string) error {
	// Get directory for include path
	dir := filepath.Dir(filePath)
	
	// Build protoc command
	cmd := exec.Command("protoc",
		"--descriptor_set_out=/dev/stdout",
		"--include_imports",
		"-I", dir,
		filePath,
	)

	// Add additional include paths
	for _, includePath := range s.includePaths {
		cmd.Args = append(cmd.Args, "-I", includePath)
	}

	// Execute protoc
	output, err := cmd.CombinedOutput()
	if err != nil {
		s.logger.Error().Err(err).Str("command", cmd.String()).Str("output", string(output)).Msg("protoc command failed")
		return fmt.Errorf("protoc failed: %w, output: %s", err, string(output))
	}

	// Parse descriptor set
	var descriptorSet descriptorpb.FileDescriptorSet
	if err := proto.Unmarshal(output, &descriptorSet); err != nil {
		return fmt.Errorf("failed to unmarshal descriptor set: %w", err)
	}

	// Register files
	return s.registerDescriptorSet(&descriptorSet)
}

// registerDirectory registers all .proto files in a directory recursively
func (s *Service) registerDirectory(dirPath string) error {
	// Check if protoc is available
	if _, err := exec.LookPath("protoc"); err != nil {
		return fmt.Errorf("protoc not found in PATH: %w", err)
	}
	
	// Find all .proto files recursively
	protoFiles, err := s.findProtoFilesRecursive(dirPath)
	if err != nil {
		return fmt.Errorf("failed to find .proto files: %w", err)
	}

	if len(protoFiles) == 0 {
		return fmt.Errorf("no .proto files found in directory: %s", dirPath)
	}

	s.logger.Info().Str("dirPath", dirPath).Strs("protoFiles", protoFiles).Msg("Found proto files recursively")

	// Build protoc command for all files
	cmd := exec.Command("protoc",
		"--descriptor_set_out=/dev/stdout",
		"--include_imports",
		"-I", dirPath,
	)

	// Add additional include paths
	for _, includePath := range s.includePaths {
		cmd.Args = append(cmd.Args, "-I", includePath)
	}

	// Add all .proto files
	cmd.Args = append(cmd.Args, protoFiles...)

	// Log the command being executed
	s.logger.Info().Str("command", cmd.String()).Strs("args", cmd.Args).Msg("Executing protoc command")

	// Execute protoc
	output, err := cmd.CombinedOutput()
	if err != nil {
		s.logger.Error().Err(err).Str("command", cmd.String()).Str("output", string(output)).Msg("protoc command failed")
		return fmt.Errorf("protoc failed: %w, output: %s", err, string(output))
	}

	// Parse descriptor set
	var descriptorSet descriptorpb.FileDescriptorSet
	if err := proto.Unmarshal(output, &descriptorSet); err != nil {
		return fmt.Errorf("failed to unmarshal descriptor set: %w", err)
	}

	// Register files
	return s.registerDescriptorSet(&descriptorSet)
}

// findProtoFilesRecursive finds all .proto files in a directory recursively
func (s *Service) findProtoFilesRecursive(dirPath string) ([]string, error) {
	var protoFiles []string
	
	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if !info.IsDir() && strings.HasSuffix(path, ".proto") {
			protoFiles = append(protoFiles, path)
		}
		
		return nil
	})
	
	return protoFiles, err
}

// registerDescriptorSet registers a FileDescriptorSet
func (s *Service) registerDescriptorSet(descriptorSet *descriptorpb.FileDescriptorSet) error {
	// Create new registry
	newFiles, err := protodesc.NewFiles(descriptorSet)
	if err != nil {
		return fmt.Errorf("failed to create new files registry: %w", err)
	}

	// Merge with existing registry
	if err := s.mergeRegistries(newFiles); err != nil {
		return fmt.Errorf("failed to merge registries: %w", err)
	}

	s.logger.Info().Int("fileCount", len(descriptorSet.File)).Msg("Successfully registered Protobuf files")
	return nil
}

// mergeRegistries merges a new registry with the existing one
func (s *Service) mergeRegistries(newFiles *protoregistry.Files) error {
	// For now, we'll replace the entire registry
	// In a more sophisticated implementation, we could merge individual files
	s.files = newFiles
	return nil
}

// ListMessageTypes returns all available message type FQNs
func (s *Service) ListMessageTypes() ([]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var messageTypes []string

	// Iterate through all registered files
	s.files.RangeFiles(func(fd protoreflect.FileDescriptor) bool {
		// Get all message types in this file
		filePath := fd.Path()
		s.logger.Debug().Str("file", filePath).Msg("Scanning file for message types")

		// Get package name
		packageName := string(fd.Package())
		if packageName == "" {
			packageName = "default"
		}

		// Get all message types
		messages := fd.Messages()
		for i := 0; i < messages.Len(); i++ {
			msg := messages.Get(i)
			fqn := fmt.Sprintf("%s.%s", packageName, msg.Name())
			messageTypes = append(messageTypes, fqn)
			s.logger.Debug().Str("message", fqn).Msg("Found message type")
		}

		return true
	})

	return messageTypes, nil
}

// GetMessageDescriptor returns a message descriptor by FQN
func (s *Service) GetMessageDescriptor(fqn string) (protoreflect.MessageDescriptor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// For now, we'll search through all files manually
	// In a more sophisticated implementation, we could build an index
	var foundMsg protoreflect.MessageDescriptor
	s.files.RangeFiles(func(fd protoreflect.FileDescriptor) bool {
		messages := fd.Messages()
		for i := 0; i < messages.Len(); i++ {
			msg := messages.Get(i)
			fullName := string(fd.Package()) + "." + string(msg.Name())
			if fullName == fqn {
				foundMsg = msg
				return false // stop iteration
			}
		}
		return true
	})

	if foundMsg == nil {
		return nil, fmt.Errorf("message not found: %s", fqn)
	}

	return foundMsg, nil
}

// GetFileDescriptor returns a file descriptor by path
func (s *Service) GetFileDescriptor(path string) (protoreflect.FileDescriptor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// For now, we'll search through all files manually
	var foundFile protoreflect.FileDescriptor
	s.files.RangeFiles(func(fd protoreflect.FileDescriptor) bool {
		if fd.Path() == path {
			foundFile = fd
			return false // stop iteration
		}
		return true
	})

	if foundFile == nil {
		return nil, fmt.Errorf("file not found: %s", path)
	}

	return foundFile, nil
}

// SetLogger sets the logger for the service
func (s *Service) SetLogger(logger zerolog.Logger) {
	s.logger = logger
}
