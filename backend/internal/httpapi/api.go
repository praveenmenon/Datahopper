package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"database/sql"

	"github.com/datahopper/backend/internal/registry"
	"github.com/datahopper/backend/internal/runner"
	"github.com/datahopper/backend/internal/types"
	"github.com/datahopper/backend/internal/workspace"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
	api.logger.Info().Msg("Setting up API routes")
	// Add CORS middleware
	router.Use(api.corsMiddleware())

	// Add logging middleware
	router.Use(api.loggingMiddleware())

	// Add error handler
	router.Use(api.errorHandler())

	// Test endpoint for multipart debugging
	router.POST("/api/test/multipart", api.testMultipart)

	// Expose save-request at root per spec
	router.POST("/v1/save-request", api.saveRequest)

	// API routes
	apiGroup := router.Group("/api")
	{
		// Protobuf registration
		apiGroup.POST("/protos/register", api.registerProtos)
		apiGroup.POST("/protos/register/upload", api.registerProtosFromUpload)
		apiGroup.GET("/registry/messages", api.listMessages)
		apiGroup.GET("/registry/messages/:fqn/schema", api.getMessageSchema)
		apiGroup.GET("/registry/messages/:fqn/fields", api.getMessageFields)
		api.logger.Info().Msg("Registered schema endpoint")

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
		apiGroup.PUT("/environments/:name", api.updateEnvironment)
		apiGroup.DELETE("/environments/:name", api.deleteEnvironment)

		// Request execution
		apiGroup.POST("/run", api.runRequest)

		// Transactional save-request endpoint under /api as well (compat)
		apiGroup.POST("/v1/save-request", api.saveRequest)

		// Preferences
		apiGroup.GET("/preferences", api.getPreferences)
		apiGroup.PUT("/preferences", api.updatePreferences)
	}
}
// Preferences payload
type Preferences struct {
    ConfirmDeleteRequest *bool `json:"confirmDeleteRequest"`
}

func (api *API) getPreferences(c *gin.Context) {
    if apiRunnerPool == nil {
        // default when no DB
        c.JSON(http.StatusOK, Preferences{ConfirmDeleteRequest: ptrBool(true)})
        return
    }
    ctx := context.Background()
    row := apiRunnerPool.QueryRow(ctx, `SELECT bool_value FROM preferences WHERE key='confirm_delete_request'`)
    var v sql.NullBool
    if err := row.Scan(&v); err != nil {
        // default if missing
        c.JSON(http.StatusOK, Preferences{ConfirmDeleteRequest: ptrBool(true)})
        return
    }
    c.JSON(http.StatusOK, Preferences{ConfirmDeleteRequest: ptrBool(v.Bool)})
}

func (api *API) updatePreferences(c *gin.Context) {
    var p Preferences
    if err := c.ShouldBindJSON(&p); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if apiRunnerPool == nil {
        c.JSON(http.StatusOK, p)
        return
    }
    ctx := context.Background()
    if p.ConfirmDeleteRequest != nil {
        _, err := apiRunnerPool.Exec(ctx, `INSERT INTO preferences(key,bool_value) VALUES('confirm_delete_request',$1)
            ON CONFLICT (key) DO UPDATE SET bool_value=EXCLUDED.bool_value, updated_at=NOW()` , *p.ConfirmDeleteRequest)
        if err != nil {
            api.logger.Error().Err(err).Msg("Failed to update preferences")
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update preferences"})
            return
        }
    }
    c.JSON(http.StatusOK, p)
}

func ptrBool(b bool) *bool { return &b }

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
	// Ensure registry is loaded from DB if available and empty in-memory state
	if err := api.ensureRegistryLoaded(); err != nil {
		api.logger.Error().Err(err).Msg("Failed to ensure registry is loaded")
	}

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

	if err := api.ensureRegistryLoaded(); err != nil {
		api.logger.Error().Err(err).Msg("Failed to ensure registry is loaded")
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

// getMessageSchema returns comprehensive schema metadata for a message
func (api *API) getMessageSchema(c *gin.Context) {
	fqn := c.Param("fqn")
	if fqn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message FQN is required"})
		return
	}

	if err := api.ensureRegistryLoaded(); err != nil {
		api.logger.Error().Err(err).Msg("Failed to ensure registry is loaded")
	}

	schema, err := api.registry.GetSchemaService().GetMessageSchema(fqn)
	if err != nil {
		api.logger.Error().Err(err).Str("fqn", fqn).Msg("Failed to get message schema")
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("message schema not found: %s", fqn)})
		return
	}

	c.JSON(http.StatusOK, schema)
}

// ensureRegistryLoaded attempts to load registry from DB if the in-memory registry is empty
func (api *API) ensureRegistryLoaded() error {
	// Simple heuristic: if ListMessageTypes returns 0, try to LoadFromDatabase
	types, err := api.registry.ListMessageTypes()
	if err == nil && len(types) > 0 {
		return nil
	}
	ctx := context.Background()
	return api.registry.LoadFromDatabase(ctx, "default")
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

	api.logger.Debug().
		Str("method", "flattenMessageFields").
		Str("fqn", fqn).
		Int("depth", depth).
		Msg("Calling GetComprehensiveMessageFields")

	// Use GetComprehensiveMessageFields to get all nested fields with oneof information
	comprehensive, err := api.registry.GetComprehensiveMessageFields(fqn)
	if err != nil {
		api.logger.Debug().
			Str("method", "flattenMessageFields").
			Str("fqn", fqn).
			Str("error", err.Error()).
			Msg("GetComprehensiveMessageFields failed")

		// Only bubble up for the root; for nested, treat as leaf
		if depth == 0 {
			return nil, fmt.Errorf("message not found: %s", fqn)
		}
		return []gin.H{}, nil
	}

	api.logger.Debug().
		Str("method", "flattenMessageFields").
		Str("fqn", fqn).
		Int("fieldCount", len(comprehensive)).
		Msg("GetComprehensiveMessageFields succeeded")

	var out []gin.H
	for _, raw := range comprehensive {
		name, _ := raw["name"].(string)
		// Prefer fully-computed path from registry if present to avoid duplication
		path := name
		if rp, ok := raw["path"].(string); ok && rp != "" {
			path = rp
		} else if prefix != "" {
			path = prefix + "." + name
		}
		typ, _ := raw["type"].(string)
		repeated, _ := raw["repeated"].(bool)
		optional, _ := raw["optional"].(bool)
		isMsg, _ := raw["message"].(bool)
		msgType, _ := raw["messageType"].(string)

		// Deduplicate by full path for all entries to avoid repeats rendered in the UI
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
		// Add oneof information
		if oneofFlag, ok := raw["oneof"].(bool); ok && oneofFlag {
			entry["oneof"] = true
			if oneofName, ok := raw["oneofName"].(string); ok {
				entry["oneofName"] = oneofName
			}
		}
		out = append(out, entry)

		// Do not recurse here: GetComprehensiveMessageFields already returned nested entries with full paths
	}
	return out, nil
}

// Collections
func (api *API) listCollections(c *gin.Context) {
	if apiRunnerPool != nil {
		ctx := context.Background()
		rows, err := apiRunnerPool.Query(ctx, `SELECT id, name, description, created_at FROM collections ORDER BY created_at ASC`)
		if err != nil {
			api.logger.Error().Err(err).Msg("Failed to query collections")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list collections"})
			return
		}
		defer rows.Close()
		collections := make([]*types.Collection, 0)
		for rows.Next() {
			var id uuid.UUID
			var name string
			var desc sql.NullString
			var createdAt time.Time
			if err := rows.Scan(&id, &name, &desc, &createdAt); err != nil {
				continue
			}
			// Load requests
			reqRows, _ := apiRunnerPool.Query(ctx, `
				SELECT id, name, verb, url, headers, body_model, proto_message_fqmn, response_message_fqmn, error_response_message_fqmn, last_response, last_response_at
				FROM requests WHERE collection_id=$1 ORDER BY created_at ASC`, id)
			requests := make([]*types.Request, 0)
			for reqRows.Next() {
				var rid uuid.UUID
				var rname, verb, url string
				var hdrsJSON, bodyJSON []byte
				var protoFQ, respFQ, errRespFQ sql.NullString
				var lastRespJSON []byte
				var lastRespAt sql.NullTime
				if err := reqRows.Scan(&rid, &rname, &verb, &url, &hdrsJSON, &bodyJSON, &protoFQ, &respFQ, &errRespFQ, &lastRespJSON, &lastRespAt); err == nil {
					headers := parseHeadersJSON(hdrsJSON)
					body := parseBodyJSON(bodyJSON)
					var last map[string]any
					if len(lastRespJSON) > 0 {
						_ = json.Unmarshal(lastRespJSON, &last)
					}
					var lastAtPtr *time.Time
					if lastRespAt.Valid {
						la := lastRespAt.Time
						lastAtPtr = &la
					}
					requests = append(requests, &types.Request{
						ID:                rid.String(),
						Name:              rname,
						Method:            verb,
						URL:               url,
						Headers:           headers,
						Body:              body,
						ProtoMessage:      protoFQ.String,
						ResponseType:      respFQ.String,
						ErrorResponseType: errRespFQ.String,
						LastResponse:      last,
						LastResponseAt:    lastAtPtr,
					})
				}
			}
			reqRows.Close()
			collections = append(collections, &types.Collection{
				ID:          id.String(),
				Name:        name,
				Description: desc.String,
				ProtoRoots:  []string{},
				Variables:   map[string]string{},
				Requests:    requests,
				CreatedAt:   createdAt,
				UpdatedAt:   createdAt,
			})
		}
		c.JSON(http.StatusOK, collections)
		return
	}

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

	if apiRunnerPool != nil {
		ctx := context.Background()
		id := uuid.New()
		var desc sql.NullString
		if strings.TrimSpace(req.Description) != "" {
			desc = sql.NullString{String: req.Description, Valid: true}
		}
		_, err := apiRunnerPool.Exec(ctx, `INSERT INTO collections (id, name, description) VALUES ($1,$2,$3)`, id, req.Name, desc)
		if err != nil {
			api.logger.Error().Err(err).Msg("Failed to insert collection")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create collection"})
			return
		}
		c.JSON(http.StatusCreated, &types.Collection{
			ID:          id.String(),
			Name:        req.Name,
			Description: req.Description,
			ProtoRoots:  req.ProtoRoots,
			Variables:   req.Variables,
			Requests:    []*types.Request{},
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		})
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
	if apiRunnerPool != nil {
		ctx := context.Background()
		var uuidID uuid.UUID
		var name string
		var desc sql.NullString
		var createdAt time.Time
		row := apiRunnerPool.QueryRow(ctx, `SELECT id, name, description, created_at FROM collections WHERE id=$1`, id)
		if err := row.Scan(&uuidID, &name, &desc, &createdAt); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Collection not found"})
			return
		}
		// Load requests
		reqRows, _ := apiRunnerPool.Query(ctx, `
			SELECT id, name, verb, url, headers, body_model, proto_message_fqmn, response_message_fqmn, error_response_message_fqmn, last_response, last_response_at
			FROM requests WHERE collection_id=$1 ORDER BY created_at ASC`, uuidID)
		requests := make([]*types.Request, 0)
		for reqRows.Next() {
			var rid uuid.UUID
			var rname, verb, url string
			var hdrsJSON, bodyJSON []byte
			var protoFQ, respFQ, errRespFQ sql.NullString
			var lastRespJSON []byte
			var lastRespAt sql.NullTime
			if err := reqRows.Scan(&rid, &rname, &verb, &url, &hdrsJSON, &bodyJSON, &protoFQ, &respFQ, &errRespFQ, &lastRespJSON, &lastRespAt); err == nil {
				headers := parseHeadersJSON(hdrsJSON)
				body := parseBodyJSON(bodyJSON)
				var last map[string]any
				if len(lastRespJSON) > 0 {
					_ = json.Unmarshal(lastRespJSON, &last)
				}
				var lastAtPtr *time.Time
				if lastRespAt.Valid {
					lastAt := lastRespAt.Time
					lastAtPtr = &lastAt
				}
				requests = append(requests, &types.Request{
					ID:                rid.String(),
					Name:              rname,
					Method:            verb,
					URL:               url,
					Headers:           headers,
					Body:              body,
					ProtoMessage:      protoFQ.String,
					ResponseType:      respFQ.String,
					ErrorResponseType: errRespFQ.String,
					LastResponse:      last,
					LastResponseAt:    lastAtPtr,
				})
			}
		}
		reqRows.Close()
		c.JSON(http.StatusOK, &types.Collection{
			ID:          uuidID.String(),
			Name:        name,
			Description: desc.String,
			ProtoRoots:  []string{},
			Variables:   map[string]string{},
			Requests:    requests,
			CreatedAt:   createdAt,
			UpdatedAt:   createdAt,
		})
		return
	}

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

	if apiRunnerPool != nil {
		ctx := context.Background()
		var desc sql.NullString
		if strings.TrimSpace(collection.Description) != "" {
			desc = sql.NullString{String: collection.Description, Valid: true}
		}
		ct, err := apiRunnerPool.Exec(ctx, `UPDATE collections SET name=$2, description=$3 WHERE id=$1`, id, collection.Name, desc)
		if err != nil {
			api.logger.Error().Err(err).Msg("Failed to update collection")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update collection"})
			return
		}
		if ct.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Collection not found"})
			return
		}
		collection.ID = id
		c.JSON(http.StatusOK, &collection)
		return
	}

	collection.ID = id
	if err := api.workspace.UpdateCollection(&collection); err != nil {
		api.logger.Error().Err(err).Msg("Failed to update collection")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, &collection)
}

func (api *API) deleteCollection(c *gin.Context) {
	id := c.Param("id")
	if apiRunnerPool != nil {
		ctx := context.Background()
		ct, err := apiRunnerPool.Exec(ctx, `DELETE FROM collections WHERE id=$1`, id)
		if err != nil {
			api.logger.Error().Err(err).Msg("Failed to delete collection")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete collection"})
			return
		}
		if ct.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Collection not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Collection deleted successfully"})
		return
	}

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

	if apiRunnerPool != nil {
		ctx := context.Background()
		collectionUUID, err := uuid.Parse(collectionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid collection ID"})
			return
		}
		id := uuid.New()
		var url sql.NullString
		if strings.TrimSpace(req.URL) != "" {
			url = sql.NullString{String: req.URL, Valid: true}
		}
		_, err = apiRunnerPool.Exec(ctx, `INSERT INTO requests (id, collection_id, name, verb, url) VALUES ($1,$2,$3,$4,$5)`, id, collectionUUID, req.Name, req.Method, url)
		if err != nil {
			api.logger.Error().Err(err).Msg("Failed to insert request")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create request"})
			return
		}
		c.JSON(http.StatusCreated, &types.Request{
			ID:     id.String(),
			Name:   req.Name,
			Method: req.Method,
			URL:    req.URL,
		})
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

// Request CRUD
func (api *API) getRequest(c *gin.Context) {
	collectionID := c.Param("id")
	requestID := c.Param("requestId")
	if apiRunnerPool != nil {
		ctx := context.Background()
		var uuidID uuid.UUID
		var rname, verb, url string
		row := apiRunnerPool.QueryRow(ctx, `SELECT id, name, verb, url FROM requests WHERE id=$1 AND collection_id=$2`, requestID, collectionID)
		if err := row.Scan(&uuidID, &rname, &verb, &url); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
			return
		}
		c.JSON(http.StatusOK, &types.Request{
			ID:     uuidID.String(),
			Name:   rname,
			Method: verb,
			URL:    url,
		})
		return
	}

	request, err := api.workspace.GetRequest(collectionID, requestID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	c.JSON(http.StatusOK, request)
}

func (api *API) updateRequest(c *gin.Context) {
	collectionID := c.Param("id")
	requestID := c.Param("requestId")
	var req types.UpdateRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if apiRunnerPool != nil {
		ctx := context.Background()
		var url sql.NullString
		if strings.TrimSpace(req.URL) != "" {
			url = sql.NullString{String: req.URL, Valid: true}
		}
		ct, err := apiRunnerPool.Exec(ctx, `UPDATE requests SET name=$2, verb=$3, url=$4 WHERE id=$1 AND collection_id=$5`, requestID, req.Name, req.Method, url, collectionID)
		if err != nil {
			api.logger.Error().Err(err).Msg("Failed to update request")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update request"})
			return
		}
		if ct.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
			return
		}
		c.JSON(http.StatusOK, &types.Request{
			ID:     requestID,
			Name:   req.Name,
			Method: req.Method,
			URL:    req.URL,
		})
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
	requestID := c.Param("requestId")
	if apiRunnerPool != nil {
		ctx := context.Background()
		ct, err := apiRunnerPool.Exec(ctx, `DELETE FROM requests WHERE id=$1 AND collection_id=$2`, requestID, collectionID)
		if err != nil {
			api.logger.Error().Err(err).Msg("Failed to delete request")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete request"})
			return
		}
		if ct.RowsAffected() == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Request deleted successfully"})
		return
	}

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

	// Ensure registry loaded before running
	if err := api.ensureRegistryLoaded(); err != nil {
		api.logger.Error().Err(err).Msg("Failed to ensure registry is loaded before run")
	}

	// Execute request
	result, err := api.runner.Run(&req)
	if err != nil {
		api.logger.Error().Err(err).Msg("Failed to execute request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Persist last response if requestId provided and DB configured
	if apiRunnerPool != nil {
		var ids struct{
			CollectionId *string `json:"collectionId"`
			RequestId    *string `json:"requestId"`
		}
		// Ignore bind error; we’ll persist only if present
		_ = c.ShouldBindJSON(&ids)
		if ids.RequestId != nil {
			respObj := map[string]any{
				"status": result.Status,
				"headers": result.Headers,
				"decoded": result.Decoded,
				"raw": result.Raw,
				"decodeError": result.DecodeError,
			}
			if buf, err := json.Marshal(respObj); err == nil {
				ctx := context.Background()
				_, _ = apiRunnerPool.Exec(ctx, `UPDATE requests SET last_response=$2, last_response_at=NOW() WHERE id=$1`, *ids.RequestId, buf)
			}
		}
	}

	c.JSON(http.StatusOK, result)
}

// helper to convert map headers to HeaderKV slice
func toHeaderKV(m map[string]string) []types.HeaderKV {
	if m == nil {
		return nil
	}
	out := make([]types.HeaderKV, 0, len(m))
	for k, v := range m {
		out = append(out, types.HeaderKV{Key: k, Value: v})
	}
	return out
}

// JSON helpers
func parseHeadersJSON(b []byte) []types.HeaderKV {
	if len(b) == 0 || string(b) == "null" {
		return []types.HeaderKV{}
	}
	m := map[string]string{}
	if err := json.Unmarshal(b, &m); err != nil {
		return []types.HeaderKV{}
	}
	return toHeaderKV(m)
}

func parseBodyJSON(b []byte) []types.BodyField {
	if len(b) == 0 || string(b) == "null" {
		return []types.BodyField{}
	}
	var raw map[string]any
	if err := json.Unmarshal(b, &raw); err != nil {
		return []types.BodyField{}
	}
	fields := make([]types.BodyField, 0, len(raw))
	for k, v := range raw {
		fields = append(fields, types.BodyField{Path: k, Value: v})
	}
	return fields
}
