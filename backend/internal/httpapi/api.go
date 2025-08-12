package httpapi

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/datahopper/backend/internal/registry"
	"github.com/datahopper/backend/internal/runner"
	"github.com/datahopper/backend/internal/types"
	"github.com/datahopper/backend/internal/workspace"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// API provides HTTP API endpoints for DataHopper
type API struct {
	registry  *registry.Service
	workspace *workspace.Service
	runner    *runner.Service
	logger    zerolog.Logger
}

// NewAPI creates a new API instance
func NewAPI(registry *registry.Service, workspace *workspace.Service, runner *runner.Service, logger zerolog.Logger) *API {
	api := &API{
		registry:  registry,
		workspace: workspace,
		runner:    runner,
		logger:    logger,
	}

	// Set loggers for services
	registry.SetLogger(logger)
	runner.SetLogger(logger)

	return api
}

// SetupRoutes sets up all the API routes
func (api *API) SetupRoutes(router *gin.Engine) {
	// Add CORS middleware
	router.Use(api.corsMiddleware())

	// Add logging middleware
	router.Use(api.loggingMiddleware())

	// Add error handler
	router.Use(api.errorHandler())

	// Test endpoint for multipart debugging
	router.POST("/api/test/multipart", api.testMultipart)

	// API routes
	apiGroup := router.Group("/api")
	{
		// Protobuf registration
		apiGroup.POST("/protos/register", api.registerProtos)
		apiGroup.POST("/protos/register/upload", api.registerProtosFromUpload)
		apiGroup.GET("/registry/messages", api.listMessages)
		apiGroup.GET("/registry/messages/:fqn/fields", api.getMessageFields)

		// Collections
		apiGroup.GET("/collections", api.listCollections)
		apiGroup.POST("/collections", api.createCollection)
		apiGroup.GET("/collections/:id", api.getCollection)
		apiGroup.PUT("/collections/:id", api.updateCollection)
		apiGroup.DELETE("/collections/:id", api.deleteCollection)

		// Requests
		apiGroup.POST("/collections/:id/requests", api.createRequest)
		apiGroup.GET("/collections/:id/requests/:requestId", api.getRequest)
		apiGroup.PUT("/collections/:id/requests/:requestId", api.updateRequest)
		apiGroup.DELETE("/collections/:id/requests/:requestId", api.deleteRequest)

		// Environments
		apiGroup.GET("/environments", api.listEnvironments)
		apiGroup.POST("/environments", api.createEnvironment)
		apiGroup.PUT("/environments/:id", api.updateEnvironment)
		apiGroup.DELETE("/environments/:id", api.deleteEnvironment)

		// Request execution
		apiGroup.POST("/run", api.runRequest)
	}
}

// CORS middleware
func (api *API) corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		// Allow both common dev ports for frontend
		if origin == "http://localhost:3000" || origin == "http://localhost:5173" {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// Logging middleware
func (api *API) loggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// Process request
		c.Next()

		// Log request details
		duration := time.Since(start)
		status := c.Writer.Status()

		api.logger.Info().
			Str("method", method).
			Str("path", path).
			Int("status", status).
			Dur("duration", duration).
			Msg("HTTP request")
	}
}

// Error handler middleware
func (api *API) errorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Handle errors
		if len(c.Errors) > 0 {
			err := c.Errors.Last()
			api.logger.Error().Err(err.Err).Msg("Request error")

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Internal server error",
			})
		}
	}
}

// testMultipart is a simple test endpoint for debugging multipart form handling
func (api *API) testMultipart(c *gin.Context) {
	// Try to get multipart form
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Multipart form error: " + err.Error()})
		return
	}

	// Log what we received
	api.logger.Info().Interface("form", form).Msg("Received multipart form")

	c.JSON(http.StatusOK, gin.H{
		"message": "Multipart form received successfully",
		"files":   len(form.File),
		"values":  len(form.Value),
	})
}

// registerProtos handles both JSON (path-based) and multipart form data (file upload) requests
func (api *API) registerProtos(c *gin.Context) {
	// Check if this is a multipart form (file upload) or JSON (path-based)
	contentType := c.GetHeader("Content-Type")

	if strings.Contains(contentType, "multipart/form-data") {
		// Handle file upload
		api.registerProtosFromUpload(c)
	} else {
		// Handle path-based registration
		api.registerProtosFromPath(c)
	}
}

// registerProtosFromPath handles registration from file paths
func (api *API) registerProtosFromPath(c *gin.Context) {
	var req struct {
		Path         string   `json:"path" binding:"required"`
		IncludePaths []string `json:"includePaths"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := api.registry.RegisterRoot(req.Path, req.IncludePaths); err != nil {
		api.logger.Error().Err(err).Str("path", req.Path).Msg("Failed to register protos")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Protobuf files registered successfully"})
}

// registerProtosFromUpload handles registration from uploaded files using virtual filesystem
func (api *API) registerProtosFromUpload(c *gin.Context) {
	// Get multipart form directly
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get multipart form: " + err.Error()})
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No files uploaded"})
		return
	}

	// Read all uploaded files into memory for virtual filesystem
	fileContents := make(map[string][]byte)
	var filenames []string

	for _, fileHeader := range files {
		filename := fileHeader.Filename

		api.logger.Info().
			Str("originalFilename", fileHeader.Filename).
			Msg("Processing uploaded file")

		// Security: sanitize filename to prevent issues
		filename = filepath.Base(filename) // Use only the base filename
		if !strings.HasSuffix(filename, ".proto") {
			continue
		}

		file, err := fileHeader.Open()
		if err != nil {
			api.logger.Error().Err(err).Str("filename", fileHeader.Filename).Msg("Failed to open uploaded file")
			continue
		}

		// Read file content into memory
		content, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			api.logger.Error().Err(err).Str("filename", filename).Msg("Failed to read file content")
			continue
		}

		fileContents[filename] = content
		filenames = append(filenames, filename)

		api.logger.Info().
			Str("filename", filename).
			Int("contentSize", len(content)).
			Msg("Successfully loaded file into virtual filesystem")
	}

	if len(fileContents) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid .proto files found in upload"})
		return
	}

	api.logger.Info().
		Int("fileCount", len(fileContents)).
		Strs("filenames", filenames).
		Msg("About to register proto files using virtual filesystem")

	// Register using virtual filesystem approach
	if err := api.registry.RegisterFromVirtualFS(fileContents); err != nil {
		api.logger.Error().Err(err).Strs("filenames", filenames).Msg("Failed to register uploaded protos with virtual filesystem")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Protobuf files uploaded and registered successfully using virtual filesystem",
		"fileCount": len(fileContents),
		"files":     filenames,
	})
}

// List available message types
func (api *API) listMessages(c *gin.Context) {
	messageTypes, err := api.registry.ListMessageTypes()
	if err != nil {
		api.logger.Error().Err(err).Msg("Failed to list message types")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Convert to response format
	messages := make([]gin.H, len(messageTypes))
	for i, msgType := range messageTypes {
		messages[i] = gin.H{"fqName": msgType}
	}

	c.JSON(http.StatusOK, messages)
}

// Get message field details
func (api *API) getMessageFields(c *gin.Context) {
	fqn := c.Param("fqn")
	if fqn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message FQN is required"})
		return
	}

	// Build flattened list of fields including nested paths
	visited := make(map[string]bool)
	collected := make(map[string]bool)
	fields, err := api.flattenMessageFields(fqn, "", visited, 0, collected)
	if err != nil {
		api.logger.Error().Err(err).Str("fqn", fqn).Msg("Failed to flatten message fields")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"fqn":    fqn,
		"fields": fields,
	})
}

// flattenMessageFields recursively flattens fields of a message into dot-paths using registry immediate fields
func (api *API) flattenMessageFields(fqn string, prefix string, visited map[string]bool, depth int, collected map[string]bool) ([]gin.H, error) {
	// Guard against deep or cyclic graphs
	if depth > 20 {
		return nil, fmt.Errorf("max nesting depth exceeded for %s", fqn)
	}
	key := prefix + "|" + fqn
	if visited[key] {
		return []gin.H{}, nil
	}
	visited[key] = true

	immediate, err := api.registry.GetMessageFields(fqn)
	if err != nil {
		// Only bubble up for the root; for nested, treat as leaf
		if depth == 0 {
			return nil, fmt.Errorf("message not found: %s", fqn)
		}
		return []gin.H{}, nil
	}

	var out []gin.H
	for _, raw := range immediate {
		name, _ := raw["name"].(string)
		path := name
		if prefix != "" {
			path = prefix + "." + name
		}
		typ, _ := raw["type"].(string)
		repeated, _ := raw["repeated"].(bool)
		optional, _ := raw["optional"].(bool)
		isMsg, _ := raw["message"].(bool)
		msgType, _ := raw["messageType"].(string)

		// Recurse into messages; do not emit a separate container entry to avoid duplicates
		if isMsg && msgType != "" && !strings.HasPrefix(msgType, "google.") {
			nested, nerr := api.flattenMessageFields(msgType, path, visited, depth+1, collected)
			if nerr == nil {
				out = append(out, nested...)
			}
			continue
		}

		// Deduplicate by full path
		if collected[path] {
			continue
		}
		collected[path] = true

		entry := gin.H{
			"path":     path,
			"name":     name,
			"type":     typ,
			"repeated": repeated,
			"optional": optional,
			"message":  isMsg,
		}
		if msgType != "" {
			entry["messageType"] = msgType
		}
		if enumFlag, ok := raw["enum"].(bool); ok && enumFlag {
			entry["enum"] = true
			if ev, ok := raw["enumValues"].([]string); ok {
				entry["enumValues"] = ev
			} else if ia, ok := raw["enumValues"].([]interface{}); ok {
				vals := make([]string, 0, len(ia))
				for _, v := range ia {
					if s, ok := v.(string); ok {
						vals = append(vals, s)
					}
				}
				entry["enumValues"] = vals
			}
		}
		out = append(out, entry)
	}
	return out, nil
}

// Collections
func (api *API) listCollections(c *gin.Context) {
	collections, err := api.workspace.ListCollections()
	if err != nil {
		api.logger.Error().Err(err).Msg("Failed to list collections")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, collections)
}

func (api *API) createCollection(c *gin.Context) {
	var req types.CreateCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collection, err := api.workspace.CreateCollection(&req)
	if err != nil {
		api.logger.Error().Err(err).Msg("Failed to create collection")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, collection)
}

func (api *API) getCollection(c *gin.Context) {
	id := c.Param("id")
	collection, err := api.workspace.GetCollection(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Collection not found"})
		return
	}

	c.JSON(http.StatusOK, collection)
}

func (api *API) updateCollection(c *gin.Context) {
	id := c.Param("id")
	var collection types.Collection
	if err := c.ShouldBindJSON(&collection); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collection.ID = id
	if err := api.workspace.UpdateCollection(&collection); err != nil {
		api.logger.Error().Err(err).Msg("Failed to update collection")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, collection)
}

func (api *API) deleteCollection(c *gin.Context) {
	id := c.Param("id")
	if err := api.workspace.DeleteCollection(id); err != nil {
		api.logger.Error().Err(err).Msg("Failed to delete collection")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Collection deleted successfully"})
}

// Requests
func (api *API) createRequest(c *gin.Context) {
	collectionID := c.Param("id")
	var req types.CreateRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	request, err := api.workspace.CreateRequest(collectionID, &req)
	if err != nil {
		api.logger.Error().Err(err).Msg("Failed to create request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, request)
}

func (api *API) getRequest(c *gin.Context) {
	collectionID := c.Param("id")
	requestID := c.Param("rid")
	request, err := api.workspace.GetRequest(collectionID, requestID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	c.JSON(http.StatusOK, request)
}

func (api *API) updateRequest(c *gin.Context) {
	collectionID := c.Param("id")
	requestID := c.Param("rid")
	var req types.UpdateRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	request, err := api.workspace.UpdateRequest(collectionID, &req, requestID)
	if err != nil {
		api.logger.Error().Err(err).Msg("Failed to update request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, request)
}

func (api *API) deleteRequest(c *gin.Context) {
	collectionID := c.Param("id")
	requestID := c.Param("rid")
	if err := api.workspace.DeleteRequest(collectionID, requestID); err != nil {
		api.logger.Error().Err(err).Msg("Failed to delete request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Request deleted successfully"})
}

// Environments
func (api *API) listEnvironments(c *gin.Context) {
	environments, err := api.workspace.ListEnvironments()
	if err != nil {
		api.logger.Error().Err(err).Msg("Failed to list environments")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, environments)
}

func (api *API) createEnvironment(c *gin.Context) {
	var env types.Environment
	if err := c.ShouldBindJSON(&env); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := api.workspace.CreateEnvironment(&env); err != nil {
		api.logger.Error().Err(err).Msg("Failed to create environment")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, env)
}

func (api *API) updateEnvironment(c *gin.Context) {
	name := c.Param("name")
	var env types.Environment
	if err := c.ShouldBindJSON(&env); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	env.Name = name
	if err := api.workspace.UpdateEnvironment(&env); err != nil {
		api.logger.Error().Err(err).Msg("Failed to update environment")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, env)
}

func (api *API) deleteEnvironment(c *gin.Context) {
	name := c.Param("name")
	if err := api.workspace.DeleteEnvironment(name); err != nil {
		api.logger.Error().Err(err).Msg("Failed to delete environment")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Environment deleted successfully"})
}

// Request execution
func (api *API) runRequest(c *gin.Context) {
	var req runner.RunReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Execute request
	result, err := api.runner.Run(&req)
	if err != nil {
		api.logger.Error().Err(err).Msg("Failed to execute request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
