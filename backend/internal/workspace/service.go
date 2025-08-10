package workspace

import (
	"time"

	"github.com/datahopper/backend/internal/store"
	"github.com/datahopper/backend/internal/types"
)

// Service provides workspace management functionality
type Service struct {
	store store.Store
}

// NewService creates a new workspace service
func NewService(store store.Store) *Service {
	return &Service{
		store: store,
	}
}

// CreateCollection creates a new collection
func (s *Service) CreateCollection(req *types.CreateCollectionRequest) (*types.Collection, error) {
	collection := &types.Collection{
		Name:        req.Name,
		Description: req.Description,
		ProtoRoots:  req.ProtoRoots,
		Variables:   req.Variables,
		Requests:    []*types.Request{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.store.CreateCollection(collection); err != nil {
		return nil, err
	}

	return collection, nil
}

// GetCollection retrieves a collection by ID
func (s *Service) GetCollection(id string) (*types.Collection, error) {
	return s.store.GetCollection(id)
}

// ListCollections returns all collections
func (s *Service) ListCollections() ([]*types.Collection, error) {
	return s.store.ListCollections()
}

// UpdateCollection updates an existing collection
func (s *Service) UpdateCollection(collection *types.Collection) error {
	collection.UpdatedAt = time.Now()
	return s.store.UpdateCollection(collection)
}

// DeleteCollection removes a collection
func (s *Service) DeleteCollection(id string) error {
	return s.store.DeleteCollection(id)
}

// CreateRequest adds a new request to a collection
func (s *Service) CreateRequest(collectionID string, req *types.CreateRequestRequest) (*types.Request, error) {
	request := &types.Request{
		Name:           req.Name,
		Method:         req.Method,
		URL:            req.URL,
		ProtoMessage:   req.ProtoMessage,
		ResponseType:   req.ResponseType,
		Headers:        req.Headers,
		Body:           req.Body,
		TimeoutSeconds: req.TimeoutSeconds,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.store.CreateRequest(collectionID, request); err != nil {
		return nil, err
	}

	return request, nil
}

// GetRequest retrieves a request from a collection
func (s *Service) GetRequest(collectionID, requestID string) (*types.Request, error) {
	return s.store.GetRequest(collectionID, requestID)
}

// UpdateRequest updates an existing request
func (s *Service) UpdateRequest(collectionID string, req *types.UpdateRequestRequest, requestID string) (*types.Request, error) {
	// Get existing request
	existing, err := s.store.GetRequest(collectionID, requestID)
	if err != nil {
		return nil, err
	}

	// Update fields if provided
	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Method != "" {
		existing.Method = req.Method
	}
	if req.URL != "" {
		existing.URL = req.URL
	}
	if req.ProtoMessage != "" {
		existing.ProtoMessage = req.ProtoMessage
	}
	if req.ResponseType != "" {
		existing.ResponseType = req.ResponseType
	}
	if req.Headers != nil {
		existing.Headers = req.Headers
	}
	if req.Body != nil {
		existing.Body = req.Body
	}
	if req.TimeoutSeconds > 0 {
		existing.TimeoutSeconds = req.TimeoutSeconds
	}

	existing.UpdatedAt = time.Now()

	if err := s.store.UpdateRequest(collectionID, existing); err != nil {
		return nil, err
	}

	return existing, nil
}

// DeleteRequest removes a request from a collection
func (s *Service) DeleteRequest(collectionID, requestID string) error {
	return s.store.DeleteRequest(collectionID, requestID)
}

// CreateEnvironment creates a new environment
func (s *Service) CreateEnvironment(env *types.Environment) error {
	return s.store.CreateEnvironment(env)
}

// GetEnvironment retrieves an environment by name
func (s *Service) GetEnvironment(name string) (*types.Environment, error) {
	return s.store.GetEnvironment(name)
}

// ListEnvironments returns all environments
func (s *Service) ListEnvironments() ([]*types.Environment, error) {
	return s.store.ListEnvironments()
}

// UpdateEnvironment updates an existing environment
func (s *Service) UpdateEnvironment(env *types.Environment) error {
	return s.store.UpdateEnvironment(env)
}

// DeleteEnvironment removes an environment
func (s *Service) DeleteEnvironment(name string) error {
	return s.store.DeleteEnvironment(name)
}
