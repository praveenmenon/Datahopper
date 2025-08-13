package store

import (
	"fmt"
	"sync"

	"github.com/datahopper/backend/internal/types"
)

// Store defines the interface for data persistence
type Store interface {
	// Collections
	CreateCollection(collection *types.Collection) error
	GetCollection(id string) (*types.Collection, error)
	ListCollections() ([]*types.Collection, error)
	UpdateCollection(collection *types.Collection) error
	DeleteCollection(id string) error

	// Requests
	CreateRequest(collectionID string, request *types.Request) error
	GetRequest(collectionID, requestID string) (*types.Request, error)
	UpdateRequest(collectionID string, request *types.Request) error
	DeleteRequest(collectionID, requestID string) error

	// Environments
	CreateEnvironment(env *types.Environment) error
	GetEnvironment(name string) (*types.Environment, error)
	ListEnvironments() ([]*types.Environment, error)
	UpdateEnvironment(env *types.Environment) error
	DeleteEnvironment(name string) error
}

// InMemoryStore implements Store interface with in-memory storage
type InMemoryStore struct {
	mu           sync.RWMutex
	collections  map[string]*types.Collection
	environments map[string]*types.Environment
	nextID       int
}

// NewInMemoryStore creates a new in-memory store
func NewInMemoryStore() *InMemoryStore {
	store := &InMemoryStore{
		collections:  make(map[string]*types.Collection),
		environments: make(map[string]*types.Environment),
		nextID:       1,
	}

	return store
}

func (s *InMemoryStore) generateID() string {
	id := s.nextID
	s.nextID++
	return fmt.Sprintf("%d", id)
}

// Collection methods
func (s *InMemoryStore) CreateCollection(collection *types.Collection) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if collection.ID == "" {
		collection.ID = s.generateID()
	}
	s.collections[collection.ID] = collection
	return nil
}

func (s *InMemoryStore) GetCollection(id string) (*types.Collection, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	collection, exists := s.collections[id]
	if !exists {
		return nil, fmt.Errorf("collection not found: %s", id)
	}
	return collection, nil
}

func (s *InMemoryStore) ListCollections() ([]*types.Collection, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	collections := make([]*types.Collection, 0, len(s.collections))
	for _, collection := range s.collections {
		collections = append(collections, collection)
	}
	return collections, nil
}

func (s *InMemoryStore) UpdateCollection(collection *types.Collection) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.collections[collection.ID]; !exists {
		return fmt.Errorf("collection not found: %s", collection.ID)
	}
	s.collections[collection.ID] = collection
	return nil
}

func (s *InMemoryStore) DeleteCollection(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.collections[id]; !exists {
		return fmt.Errorf("collection not found: %s", id)
	}
	delete(s.collections, id)
	return nil
}

// Request methods
func (s *InMemoryStore) CreateRequest(collectionID string, request *types.Request) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	collection, exists := s.collections[collectionID]
	if !exists {
		return fmt.Errorf("collection not found: %s", collectionID)
	}

	if request.ID == "" {
		request.ID = s.generateID()
	}
	collection.Requests = append(collection.Requests, request)
	return nil
}

func (s *InMemoryStore) GetRequest(collectionID, requestID string) (*types.Request, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	collection, exists := s.collections[collectionID]
	if !exists {
		return nil, fmt.Errorf("collection not found: %s", collectionID)
	}

	for _, request := range collection.Requests {
		if request.ID == requestID {
			return request, nil
		}
	}
	return nil, fmt.Errorf("request not found: %s", requestID)
}

func (s *InMemoryStore) UpdateRequest(collectionID string, request *types.Request) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	collection, exists := s.collections[collectionID]
	if !exists {
		return fmt.Errorf("collection not found: %s", collectionID)
	}

	for i, req := range collection.Requests {
		if req.ID == request.ID {
			collection.Requests[i] = request
			return nil
		}
	}
	return fmt.Errorf("request not found: %s", request.ID)
}

func (s *InMemoryStore) DeleteRequest(collectionID, requestID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	collection, exists := s.collections[collectionID]
	if !exists {
		return fmt.Errorf("collection not found: %s", collectionID)
	}

	for i, request := range collection.Requests {
		if request.ID == requestID {
			collection.Requests = append(collection.Requests[:i], collection.Requests[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("request not found: %s", requestID)
}

// Environment methods
func (s *InMemoryStore) CreateEnvironment(env *types.Environment) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.environments[env.Name] = env
	return nil
}

func (s *InMemoryStore) GetEnvironment(name string) (*types.Environment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	env, exists := s.environments[name]
	if !exists {
		return nil, fmt.Errorf("environment not found: %s", name)
	}
	return env, nil
}

func (s *InMemoryStore) ListEnvironments() ([]*types.Environment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	environments := make([]*types.Environment, 0, len(s.environments))
	for _, env := range s.environments {
		environments = append(environments, env)
	}
	return environments, nil
}

func (s *InMemoryStore) UpdateEnvironment(env *types.Environment) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.environments[env.Name]; !exists {
		return fmt.Errorf("environment not found: %s", env.Name)
	}
	s.environments[env.Name] = env
	return nil
}

func (s *InMemoryStore) DeleteEnvironment(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.environments[name]; !exists {
		return fmt.Errorf("environment not found: %s", name)
	}
	delete(s.environments, name)
	return nil
}
