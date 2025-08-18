package registry

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"context"
	"crypto/sha256"

	"github.com/jhump/protoreflect/desc"
	"github.com/rs/zerolog"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
)

// Service manages Protobuf file registration and message type discovery
type Service struct {
	mu           sync.RWMutex
	files        *protoregistry.Files
	descFiles    []*desc.FileDescriptor // Store protoparse results directly
	logger       zerolog.Logger
	protoRoots   []string
	includePaths []string
	schema       *SchemaService
	repo         *Repository
	parsedCache  map[string]*protoregistry.Files
	lastSHA      string
}

// NewService creates a new Protobuf registry service
func NewService() *Service {
	service := &Service{
		files:        &protoregistry.Files{},
		protoRoots:   make([]string, 0),
		includePaths: make([]string, 0),
		parsedCache:  make(map[string]*protoregistry.Files),
	}
	service.schema = NewSchemaService(service)
	return service
}

// WithRepository attaches a persistence repository to the registry service
func (s *Service) WithRepository(repo *Repository) *Service {
	s.repo = repo
	return s
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
		return s.RegisterSingleFile(path)
	}

	return s.registerDirectory(path)
}

// registerSingleFile registers a single .proto file
func (s *Service) RegisterSingleFile(filePath string) error {
	// Read the file content
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read file %s: %w", filePath, err)
	}

	// Use virtual filesystem approach for single files
	fileContents := map[string][]byte{
		filepath.Base(filePath): content,
	}

	return s.RegisterFromVirtualFS(fileContents)
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
	if err := s.registerDescriptorSet(&descriptorSet); err != nil {
		return err
	}

	// Persist to database if repository is configured
	if s.repo != nil {
		// Compute SHA256 of descriptor bytes
		sum := sha256.Sum256(output)
		sha := fmt.Sprintf("%x", sum[:])
		// Upsert using name "default" for now (no multi-tenant scope yet)
		ctx := context.Background()
		if err := s.repo.UpsertRegistry(ctx, "default", output, sha); err != nil {
			s.logger.Error().Err(err).Msg("failed to upsert registry descriptor")
		}
		// Update parsed cache and invalidate prior
		if s.lastSHA != "" && s.lastSHA != sha {
			delete(s.parsedCache, s.lastSHA)
		}
		s.parsedCache[sha] = s.files
		s.lastSHA = sha
	}
	return nil
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

	// First check if we have protoparse descriptors (from virtual filesystem)
	if len(s.descFiles) > 0 {
		for _, fd := range s.descFiles {
			filePath := fd.GetName()
			s.logger.Debug().Str("file", filePath).Msg("Scanning desc file for message types")

			// Get package name
			packageName := fd.GetPackage()
			if packageName == "" {
				packageName = "default"
			}

			// Get all message types
			messages := fd.GetMessageTypes()
			for _, msg := range messages {
				fqn := fmt.Sprintf("%s.%s", packageName, msg.GetName())
				messageTypes = append(messageTypes, fqn)
				s.logger.Debug().Str("message", fqn).Msg("Found message type from desc")
			}
		}
	} else {
		// Fallback to original protobuf registry approach
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
	}

	return messageTypes, nil
}

// GetMessageDescriptor returns a message descriptor by FQN
func (s *Service) GetMessageDescriptor(fqn string) (protoreflect.MessageDescriptor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// First: search existing protoregistry
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
	if foundMsg != nil {
		return foundMsg, nil
	}

	// Fallback: search descFiles by converting to protoreflect using a composite resolver
	if len(s.descFiles) > 0 {
		resolver := compositeResolver{primary: s.files, fallback: protoregistry.GlobalFiles}
		for _, dfile := range s.descFiles {
			protoFD := dfile.AsFileDescriptorProto()
			if protoFD == nil {
				continue
			}
			fileDesc, err := protodesc.NewFile(protoFD, resolver)
			if err != nil {
				continue
			}
			messages := fileDesc.Messages()
			for i := 0; i < messages.Len(); i++ {
				msg := messages.Get(i)
				fullName := string(fileDesc.Package()) + "." + string(msg.Name())
				if fullName == fqn {
					return msg, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("message not found: %s", fqn)
}

// compositeResolver checks the current registry first, then the global files
type compositeResolver struct {
	primary  *protoregistry.Files
	fallback *protoregistry.Files
}

func (r compositeResolver) FindFileByPath(path string) (protoreflect.FileDescriptor, error) {
	if r.primary != nil {
		if fd, err := r.primary.FindFileByPath(path); err == nil {
			return fd, nil
		}
	}
	if r.fallback != nil {
		return r.fallback.FindFileByPath(path)
	}
	return nil, protoregistry.NotFound
}

func (r compositeResolver) FindDescriptorByName(name protoreflect.FullName) (protoreflect.Descriptor, error) {
	if r.primary != nil {
		if d, err := r.primary.FindDescriptorByName(name); err == nil {
			return d, nil
		}
	}
	if r.fallback != nil {
		return r.fallback.FindDescriptorByName(name)
	}
	return nil, protoregistry.NotFound
}

// GetMessageFields returns field information for a message by FQN
func (s *Service) GetMessageFields(fqn string) ([]map[string]interface{}, error) {
	s.logger.Info().
		Str("method", "GetMessageFields").
		Str("fqn", fqn).
		Msg("GetMessageFields called")
	
	s.mu.RLock()
	defer s.mu.RUnlock()

				// Search through descFiles (protoparse descriptors from virtual filesystem) for immediate fields
	if len(s.descFiles) > 0 {
		s.logger.Info().
			Int("descFileCount", len(s.descFiles)).
			Str("searchingFor", fqn).
			Msg("Searching for message in descFiles")
		
		for _, fd := range s.descFiles {
			packageName := fd.GetPackage()
			if packageName == "" {
				packageName = "default"
			}
			messages := fd.GetMessageTypes()
			s.logger.Info().
				Str("filePackage", packageName).
				Int("messageCount", len(messages)).
				Msg("Processing desc file")
			
			// Log all messages in this file for debugging
			for _, msg := range messages {
				msgFqn := fmt.Sprintf("%s.%s", packageName, msg.GetName())
				s.logger.Info().
					Str("filePackage", packageName).
					Str("messageName", msg.GetName()).
					Str("messageFqn", msgFqn).
					Str("searchingFor", fqn).
					Bool("matches", msgFqn == fqn).
					Msg("Checking message in desc file")
			}
			
			for _, msg := range messages {
				msgFqn := fmt.Sprintf("%s.%s", packageName, msg.GetName())
				s.logger.Debug().
					Str("checkingFqn", msgFqn).
					Str("targetFqn", fqn).
					Bool("matches", msgFqn == fqn).
					Msg("Checking message FQN")
				
				if msgFqn == fqn {
					s.logger.Info().
						Str("fqn", fqn).
						Str("package", packageName).
						Str("message", msg.GetName()).
						Int("fieldCount", len(msg.GetFields())).
						Msg("Found message in descFiles - using protoparse path")
					
					fields := make([]map[string]interface{}, 0)
					for _, field := range msg.GetFields() {
						fi := map[string]interface{}{
							"name":     field.GetName(),
							"number":   field.GetNumber(),
							"type":     field.GetType().String(),
							"repeated": field.IsRepeated(),
							"optional": field.IsRepeated() || field.GetType().String() == "message",
							"message":  field.GetMessageType() != nil,
						}
						if field.GetMessageType() != nil {
							fi["messageType"] = field.GetMessageType().GetFullyQualifiedName()
						}
						if enumDesc := field.GetEnumType(); enumDesc != nil {
							fi["enum"] = true
							vals := enumDesc.GetValues()
							enumNames := make([]string, 0, len(vals))
							for _, v := range vals {
								enumNames = append(enumNames, v.GetName())
							}
							fi["enumValues"] = enumNames
						}
						// Add oneof information
						if oneof := field.GetOneOf(); oneof != nil {
							s.logger.Info().
								Str("field", field.GetName()).
								Str("oneofName", oneof.GetName()).
								Str("message", msg.GetName()).
								Str("package", packageName).
								Msg("Found oneof field via protoparse")
							fi["oneof"] = true
							fi["oneofName"] = oneof.GetName()
						}
						fields = append(fields, fi)
					}
					return fields, nil
				}
			}
		}
	}

	// Fallback to protoregistry approach for immediate fields
	s.logger.Info().
		Str("fqn", fqn).
		Msg("Trying protoregistry fallback")
	var foundMsg protoreflect.MessageDescriptor
	s.files.RangeFiles(func(fd protoreflect.FileDescriptor) bool {
		packageName := string(fd.Package())
		messages := fd.Messages()
		s.logger.Info().
			Str("fqn", fqn).
			Str("package", packageName).
			Int("messageCount", messages.Len()).
			Msg("Checking protoregistry package")
		for i := 0; i < messages.Len(); i++ {
			msg := messages.Get(i)
			fullName := packageName + "." + string(msg.Name())
			s.logger.Info().
				Str("checking", fullName).
				Str("target", fqn).
				Bool("matches", fullName == fqn).
				Msg("Checking protoregistry message")
			if fullName == fqn {
				foundMsg = msg
				return false
			}
		}
		return true
	})

	if foundMsg != nil {
		s.logger.Info().
			Str("fqn", fqn).
			Msg("Found message in protoregistry - using protoregistry path")
		fields := make([]map[string]interface{}, 0)
		msgFields := foundMsg.Fields()
		for i := 0; i < msgFields.Len(); i++ {
			fd := msgFields.Get(i)
			fi := map[string]interface{}{
				"name":     string(fd.Name()),
				"number":   int32(fd.Number()),
				"type":     fd.Kind().String(),
				"repeated": fd.IsList(),
				"optional": fd.HasPresence(),
				"message":  fd.Message() != nil,
			}
			if fd.Message() != nil {
				fi["messageType"] = string(fd.Message().FullName())
			}
			if enumDesc := fd.Enum(); enumDesc != nil {
				fi["enum"] = true
				vals := enumDesc.Values()
				enumNames := make([]string, 0, vals.Len())
				for j := 0; j < vals.Len(); j++ {
					enumNames = append(enumNames, string(vals.Get(j).Name()))
				}
				fi["enumValues"] = enumNames
			}
			// Add oneof information
			if oneof := fd.ContainingOneof(); oneof != nil {
				s.logger.Info().
					Str("field", string(fd.Name())).
					Str("oneofName", string(oneof.Name())).
					Str("message", string(foundMsg.Name())).
					Str("package", string(foundMsg.ParentFile().Package())).
					Msg("Found oneof field via protoregistry")
				fi["oneof"] = true
				fi["oneofName"] = string(oneof.Name())
			}
			fields = append(fields, fi)
		}
		return fields, nil
	}

	return nil, fmt.Errorf("message not found: %s", fqn)
}

// GetComprehensiveMessageFields returns all fields including nested fields with dot notation paths
func (s *Service) GetComprehensiveMessageFields(fqn string) ([]map[string]interface{}, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// First, search through descFiles (protoparse descriptors)
	if len(s.descFiles) > 0 {
		for _, fd := range s.descFiles {
			// Get package name
			packageName := fd.GetPackage()
			if packageName == "" {
				packageName = "default"
			}

			// Get all message types
			messages := fd.GetMessageTypes()
			for _, msg := range messages {
				msgFqn := fmt.Sprintf("%s.%s", packageName, msg.GetName())
				if msgFqn == fqn {
					return s.extractComprehensiveFields(msg, "", make(map[string]bool))
				}
			}
		}
	}

	// Fallback to protoregistry approach
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

	if foundMsg != nil {
		return s.extractComprehensiveFieldsFromProtoreflect(foundMsg, "", make(map[string]bool))
	}

	return nil, fmt.Errorf("message not found: %s", fqn)
}

// extractComprehensiveFields recursively extracts all fields including nested ones
func (s *Service) extractComprehensiveFields(msg *desc.MessageDescriptor, prefix string, visited map[string]bool) ([]map[string]interface{}, error) {
	fields := make([]map[string]interface{}, 0)
	
	// Prevent infinite recursion
	msgFqn := msg.GetFullyQualifiedName()
	if visited[msgFqn] {
		return fields, nil
	}
	visited[msgFqn] = true
	
	for _, field := range msg.GetFields() {
		fieldPath := field.GetName()
		if prefix != "" {
			fieldPath = prefix + "." + field.GetName()
		}
		
		fieldInfo := map[string]interface{}{
			"path":     fieldPath,
			"name":     field.GetName(),
			"number":   field.GetNumber(),
			"type":     field.GetType().String(),
			"repeated": field.IsRepeated(),
			"optional": field.IsRepeated() || field.GetType().String() == "message",
			"message":  field.GetMessageType() != nil,
		}
		
		// Enum metadata
		if enumDesc := field.GetEnumType(); enumDesc != nil {
			fieldInfo["enum"] = true
			vals := enumDesc.GetValues()
			enumNames := make([]string, 0, len(vals))
			for _, v := range vals {
				enumNames = append(enumNames, v.GetName())
			}
			fieldInfo["enumValues"] = enumNames
		}
		
		// Add oneof information
		if oneof := field.GetOneOf(); oneof != nil {
			s.logger.Info().
				Str("field", field.GetName()).
				Str("oneofName", oneof.GetName()).
				Str("message", msg.GetName()).
				Str("path", fieldPath).
				Msg("Found oneof field via comprehensive extraction")
			fieldInfo["oneof"] = true
			fieldInfo["oneofName"] = oneof.GetName()
		}
		
		// Add message type if it's a message field
		if field.GetMessageType() != nil {
			fieldInfo["messageType"] = field.GetMessageType().GetFullyQualifiedName()
			
			// Recursively get nested fields
			if nestedFields, err := s.extractComprehensiveFields(field.GetMessageType(), fieldPath, visited); err == nil {
				fields = append(fields, fieldInfo)
				fields = append(fields, nestedFields...)
			} else {
				fields = append(fields, fieldInfo)
			}
		} else {
			fields = append(fields, fieldInfo)
		}
	}
	
	return fields, nil
}

// extractComprehensiveFieldsFromProtoreflect recursively extracts all fields including nested ones from protoreflect
func (s *Service) extractComprehensiveFieldsFromProtoreflect(msg protoreflect.MessageDescriptor, prefix string, visited map[string]bool) ([]map[string]interface{}, error) {
	fields := make([]map[string]interface{}, 0)
	
	// Prevent infinite recursion
	msgFqn := string(msg.FullName())
	if visited[msgFqn] {
		return fields, nil
	}
	visited[msgFqn] = true
	
	msgFields := msg.Fields()
	for i := 0; i < msgFields.Len(); i++ {
		fd := msgFields.Get(i)
		fieldPath := string(fd.Name())
		if prefix != "" {
			fieldPath = prefix + "." + string(fd.Name())
		}
		
		fieldInfo := map[string]interface{}{
			"path":     fieldPath,
			"name":     string(fd.Name()),
			"number":   int32(fd.Number()),
			"type":     fd.Kind().String(),
			"repeated": fd.IsList(),
			"optional": fd.HasPresence(),
			"message":  fd.Message() != nil,
		}
		
		// Enum metadata
		if enumDesc := fd.Enum(); enumDesc != nil {
			fieldInfo["enum"] = true
			vals := enumDesc.Values()
			enumNames := make([]string, 0, vals.Len())
			for j := 0; j < vals.Len(); j++ {
				enumNames = append(enumNames, string(vals.Get(j).Name()))
			}
			fieldInfo["enumValues"] = enumNames
		}
		
		// Add oneof information
		if oneof := fd.ContainingOneof(); oneof != nil {
			s.logger.Info().
				Str("field", string(fd.Name())).
				Str("oneofName", string(oneof.Name())).
				Str("message", string(msg.Name())).
				Str("package", string(msg.ParentFile().Package())).
				Str("path", fieldPath).
				Msg("Found oneof field via protoreflect comprehensive extraction")
			fieldInfo["oneof"] = true
			fieldInfo["oneofName"] = string(oneof.Name())
		}
		
		// Add message type if it's a message field
		if fd.Message() != nil {
			fieldInfo["messageType"] = string(fd.Message().FullName())
			
			// Recursively get nested fields
			if nestedFields, err := s.extractComprehensiveFieldsFromProtoreflect(fd.Message(), fieldPath, visited); err == nil {
				fields = append(fields, fieldInfo)
				fields = append(fields, nestedFields...)
			} else {
				fields = append(fields, fieldInfo)
			}
		} else {
			fields = append(fields, fieldInfo)
		}
	}
	
	return fields, nil
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

// GetSchemaService returns the schema service
func (s *Service) GetSchemaService() *SchemaService {
	return s.schema
}

// LoadFromDatabase loads the latest registry descriptor from DB and populates in-memory registry.
// If cache has parsed registry for the same SHA, reuse it.
func (s *Service) LoadFromDatabase(ctx context.Context, name string) error {
	if s.repo == nil {
		return fmt.Errorf("repository not configured")
	}
	rec, err := s.repo.GetLatestByName(ctx, name)
	if err != nil {
		return err
	}
	// If cached, reuse parsed registry
	if cached, ok := s.parsedCache[rec.DescriptorSHA256]; ok && cached != nil {
		s.mu.Lock()
		s.files = cached
		s.lastSHA = rec.DescriptorSHA256
		s.mu.Unlock()
		return nil
	}
	// Parse descriptor bytes
	var descriptorSet descriptorpb.FileDescriptorSet
	if err := proto.Unmarshal(rec.DescriptorBytes, &descriptorSet); err != nil {
		return fmt.Errorf("failed to unmarshal descriptor set from DB: %w", err)
	}
	// Register into service and populate cache
	if err := s.registerDescriptorSet(&descriptorSet); err != nil {
		return err
	}
	s.parsedCache[rec.DescriptorSHA256] = s.files
	s.lastSHA = rec.DescriptorSHA256
	return nil
}
