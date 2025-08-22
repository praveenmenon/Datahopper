package registry

import (
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/desc/protoparse"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
)

// VirtualFS implements fs.FS for in-memory proto files with smart import resolution
type VirtualFS struct {
	files     map[string][]byte   // filepath -> content
	basenames map[string][]string // basename -> list of full paths that have this basename
}

// NewVirtualFS creates a new virtual filesystem
func NewVirtualFS() *VirtualFS {
	return &VirtualFS{
		files:     make(map[string][]byte),
		basenames: make(map[string][]string),
	}
}

// AddFile adds a file to the virtual filesystem
func (vfs *VirtualFS) AddFile(path string, content []byte) {
	// Normalize the path
	path = filepath.Clean(path)
	vfs.files[path] = content

	// Update basename mapping
	basename := filepath.Base(path)
	vfs.basenames[basename] = append(vfs.basenames[basename], path)
}

// Open implements fs.FS interface
func (vfs *VirtualFS) Open(name string) (fs.File, error) {
	// First, try exact path match
	if content, exists := vfs.files[name]; exists {
		return &virtualFile{
			name:    name,
			content: content,
		}, nil
	}

	// If not found, try basename resolution
	basename := filepath.Base(name)
	if paths, exists := vfs.basenames[basename]; exists {
		switch len(paths) {
		case 1:
			// Exactly one match - serve the content but keep the requested name
			// This allows the parser to see the import path it expects
			actualPath := paths[0]
			content := vfs.files[actualPath]
			return &virtualFile{
				name:    name, // Keep the requested import path name
				content: content,
			}, nil
		case 0:
			// No matches (shouldn't happen if basenames is maintained correctly)
			return nil, fmt.Errorf("file not found: %s", name)
		default:
			// Ambiguous - multiple files with same basename
			return nil, fmt.Errorf("ambiguous import %s: multiple files match basename %s: %v", name, basename, paths)
		}
	}

	return nil, fmt.Errorf("file not found: %s", name)
}

// virtualFile implements fs.File interface
type virtualFile struct {
	name    string
	content []byte
	offset  int64
}

func (f *virtualFile) Stat() (fs.FileInfo, error) {
	return &virtualFileInfo{
		name: f.name,
		size: int64(len(f.content)),
	}, nil
}

func (f *virtualFile) Read(b []byte) (int, error) {
	if f.offset >= int64(len(f.content)) {
		return 0, io.EOF
	}

	remaining := int64(len(f.content)) - f.offset
	toRead := int64(len(b))
	if toRead > remaining {
		toRead = remaining
	}

	copy(b, f.content[f.offset:f.offset+toRead])
	f.offset += toRead

	var err error
	if f.offset >= int64(len(f.content)) {
		err = io.EOF
	}

	return int(toRead), err
}

func (f *virtualFile) Close() error {
	return nil
}

// virtualFileInfo implements fs.FileInfo interface
type virtualFileInfo struct {
	name string
	size int64
}

func (fi *virtualFileInfo) Name() string       { return fi.name }
func (fi *virtualFileInfo) Size() int64        { return fi.size }
func (fi *virtualFileInfo) Mode() fs.FileMode  { return 0644 }
func (fi *virtualFileInfo) ModTime() time.Time { return time.Now() }
func (fi *virtualFileInfo) IsDir() bool        { return false }
func (fi *virtualFileInfo) Sys() interface{}   { return nil }

// RegisterFromVirtualFS registers proto files using the virtual filesystem approach
func (s *Service) RegisterFromVirtualFS(fileContents map[string][]byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(fileContents) == 0 {
		return fmt.Errorf("no .proto files found")
	}

	// Create a mapping of basename to actual filename for import rewriting
	basenameToFile := make(map[string]string)
	for filename := range fileContents {
		if strings.HasSuffix(filename, ".proto") {
			basename := filepath.Base(filename)
			basenameToFile[basename] = filename
		}
	}

	// Rewrite import statements in all proto files to use actual filenames
	rewrittenContents := make(map[string][]byte)
	var protoFiles []string

	for filename, content := range fileContents {
		if strings.HasSuffix(filename, ".proto") {
			rewrittenContent := s.rewriteImports(string(content), basenameToFile)
			rewrittenContents[filename] = []byte(rewrittenContent)
			protoFiles = append(protoFiles, filename)
		}
	}

	s.logger.Info().Int("fileCount", len(protoFiles)).Strs("files", protoFiles).Msg("Using import rewriting for proto parsing")

	// Create temporary directory and write rewritten files
	tempDir, err := os.MkdirTemp("", "proto_rewritten_*")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir)

	var tempFileNames []string
	for filename, content := range rewrittenContents {
		tempFilePath := filepath.Join(tempDir, filename)
		if err := os.WriteFile(tempFilePath, content, 0644); err != nil {
			return fmt.Errorf("failed to write temp file %s: %w", filename, err)
		}
		tempFileNames = append(tempFileNames, filename)
		s.logger.Debug().Str("filename", filename).Str("tempPath", tempFilePath).Msg("Wrote rewritten file to temp directory")
	}

	// Create parser with temp directory - protoparse should find standard Google imports automatically
	parser := &protoparse.Parser{
		ImportPaths:           []string{tempDir}, // Only include our temp directory
		IncludeSourceCodeInfo: true,
		// Don't add any special handling - protoparse has built-in support for well-known types
	}

	// Parse all files with rewritten imports (using filenames, not full paths)
	fileDescriptors, err := parser.ParseFiles(tempFileNames...)
	if err != nil {
		s.logger.Error().Err(err).Strs("files", tempFileNames).Str("tempDir", tempDir).Msg("Failed to parse proto files with rewritten imports")
		return fmt.Errorf("failed to parse proto files: %w", err)
	}

	s.logger.Info().Int("parsedCount", len(fileDescriptors)).Msg("Successfully parsed proto files")

	// Store the protoparse results directly - they already have all imports resolved
	return s.storeProtoparseDescriptors(fileDescriptors)
}

// rewriteImports rewrites import statements to use actual filenames
func (s *Service) rewriteImports(content string, basenameToFile map[string]string) string {
	// Find all import statements
	importRegex := regexp.MustCompile(`import\s+"([^"]+\.proto)";`)

	return importRegex.ReplaceAllStringFunc(content, func(match string) string {
		// Extract the import path
		submatch := importRegex.FindStringSubmatch(match)
		if len(submatch) < 2 {
			return match
		}

		importPath := submatch[1]

		// Don't rewrite Google/well-known imports
		if strings.HasPrefix(importPath, "google/") {
			return match
		}

		basename := filepath.Base(importPath)

		// If we have an actual file with this basename, rewrite the import
		if actualFile, exists := basenameToFile[basename]; exists {
			newImport := fmt.Sprintf(`import "%s";`, actualFile)
			s.logger.Debug().Str("originalImport", match).Str("rewrittenImport", newImport).Msg("Rewritten import statement")
			return newImport
		}

		// Otherwise, keep the original import (might be a standard library import)
		return match
	})
}

// storeProtoparseDescriptors stores desc.FileDescriptor objects directly
// This avoids conversion issues with Google imports since protoparse already resolved them
func (s *Service) storeProtoparseDescriptors(fileDescriptors []*desc.FileDescriptor) error {
	s.logger.Info().
		Int("fileDescriptorCount", len(fileDescriptors)).
		Msg("storeProtoparseDescriptors called - STARTING FUNCTION")

	// Store the parsed descriptors directly in our service
	// Filter to only user proto files (not Google well-known types)
	var userFiles []*desc.FileDescriptor
	for _, fd := range fileDescriptors {
		fileName := fd.GetName()
		if !strings.HasPrefix(fileName, "google/") {
			userFiles = append(userFiles, fd)
			s.logger.Debug().Str("filename", fileName).Msg("Stored user proto file descriptor")
		} else {
			s.logger.Debug().Str("filename", fileName).Msg("Skipped Google well-known type in storage")
		}
	}

	if len(userFiles) == 0 {
		return fmt.Errorf("no user proto files found (only Google well-known types)")
	}

	// Store the descriptors directly for desc-based lookups
	s.descFiles = userFiles

	// Debug: Log what messages are in each file
	for _, fd := range userFiles {
		packageName := fd.GetPackage()
		messages := fd.GetMessageTypes()
		s.logger.Info().
			Str("filename", fd.GetName()).
			Str("package", packageName).
			Int("messageCount", len(messages)).
			Msg("Stored file descriptor")

		for _, msg := range messages {
			msgFqn := fmt.Sprintf("%s.%s", packageName, msg.GetName())
			s.logger.Info().
				Str("filename", fd.GetName()).
				Str("package", packageName).
				Str("messageName", msg.GetName()).
				Str("messageFqn", msgFqn).
				Msg("Stored message descriptor")
		}
	}

	// Additionally, convert to a FileDescriptorSet and merge into protoregistry so
	// callers that rely on protoregistry (e.g., encoder) can find message descriptors
	set := &descriptorpb.FileDescriptorSet{File: make([]*descriptorpb.FileDescriptorProto, 0, len(userFiles))}
	for _, fd := range userFiles {
		if proto := fd.AsFileDescriptorProto(); proto != nil {
			set.File = append(set.File, proto)
		}
	}
	// Add well-known types that user files commonly import so NewFiles can resolve
	addWellKnown := func(path string) {
		if gfd, err := protoregistry.GlobalFiles.FindFileByPath(path); err == nil {
			set.File = append(set.File, protodesc.ToFileDescriptorProto(gfd))
		}
	}
	addWellKnown("google/protobuf/descriptor.proto")
	addWellKnown("google/protobuf/timestamp.proto")
	if err := s.registerDescriptorSet(set); err != nil {
		return fmt.Errorf("failed to register protoparse descriptors into registry: %w", err)
	}

	// Persist to DB if configured
	if s.repo != nil {
		bytes, err := proto.Marshal(set)
		if err == nil {
			sum := sha256.Sum256(bytes)
			sha := fmt.Sprintf("%x", sum[:])
			ctx := context.Background()
			if err := s.repo.UpsertRegistry(ctx, "default", bytes, sha); err != nil {
				s.logger.Error().Err(err).Msg("failed to upsert registry descriptor (virtual fs)")
			}
			if s.lastSHA != "" && s.lastSHA != sha {
				delete(s.parsedCache, s.lastSHA)
			}
			s.parsedCache[sha] = s.files
			s.lastSHA = sha
		}
	}

	s.logger.Info().Int("storedCount", len(userFiles)).Msg("Successfully stored proto file descriptors")
	return nil
}
