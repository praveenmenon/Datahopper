package workspace

import (
	"testing"
)

func TestWorkspaceService(t *testing.T) {
	// Create a mock store for testing
	mockStore := &mockStore{
		collections: make(map[string]*Collection),
		environments: map[string]*Environment{
			"local": {
				Name: "local",
				Variables: map[string]string{
					"base_url": "http://localhost:8080",
				},
			},
		},
	}

	service := NewWorkspaceService(mockStore)

	t.Run("CreateCollection", func(t *testing.T) {
		req := CreateCollectionRequest{
			Name:        "Test Collection",
			Description: "A test collection",
			ProtoRoots:  []string{"/path/to/protos"},
		}

		collection, err := service.CreateCollection(req)
		if err != nil {
			t.Errorf("Failed to create collection: %v", err)
		}

		if collection.Name != req.Name {
			t.Errorf("Expected collection name %s, got %s", req.Name, collection.Name)
		}

		if collection.Description != req.Description {
			t.Errorf("Expected collection description %s, got %s", req.Description, collection.Description)
		}

		if len(collection.ProtoRoots) != len(req.ProtoRoots) {
			t.Errorf("Expected %d proto roots, got %d", len(req.ProtoRoots), len(collection.ProtoRoots))
		}

		if len(collection.Requests) != 0 {
			t.Errorf("Expected empty requests list, got %d", len(collection.Requests))
		}
	})

	t.Run("CreateRequest", func(t *testing.T) {
		// First create a collection
		collection, _ := service.CreateCollection(CreateCollectionRequest{
			Name: "Test Collection for Request",
		})

		req := CreateRequestRequest{
			CollectionId: collection.ID,
			Name:         "Test Request",
			Method:       "POST",
			URL:          "{{base_url}}/api/test",
			ProtoMessage: "user.v1.CreateUserRequest",
			ResponseType: "user.v1.CreateUserResponse",
			TimeoutSeconds: 30,
		}

		request, err := service.CreateRequest(req)
		if err != nil {
			t.Errorf("Failed to create request: %v", err)
		}

		if request.Name != req.Name {
			t.Errorf("Expected request name %s, got %s", req.Name, request.Name)
		}

		if request.Method != req.Method {
			t.Errorf("Expected request method %s, got %s", req.Method, request.Method)
		}

		if request.URL != req.URL {
			t.Errorf("Expected request URL %s, got %s", req.URL, request.URL)
		}

		if request.ProtoMessage != req.ProtoMessage {
			t.Errorf("Expected proto message %s, got %s", req.ProtoMessage, request.ProtoMessage)
		}

		if request.ResponseType != req.ResponseType {
			t.Errorf("Expected response type %s, got %s", req.ResponseType, request.ResponseType)
		}

		if request.TimeoutSeconds != req.TimeoutSeconds {
			t.Errorf("Expected timeout %d, got %d", req.TimeoutSeconds, request.TimeoutSeconds)
		}
	})

	t.Run("GetCollection", func(t *testing.T) {
		collection, _ := service.CreateCollection(CreateCollectionRequest{
			Name: "Test Collection for Get",
		})

		retrieved, err := service.GetCollection(collection.ID)
		if err != nil {
			t.Errorf("Failed to get collection: %v", err)
		}

		if retrieved.ID != collection.ID {
			t.Errorf("Expected collection ID %s, got %s", collection.ID, retrieved.ID)
		}

		if retrieved.Name != collection.Name {
			t.Errorf("Expected collection name %s, got %s", collection.Name, retrieved.Name)
		}
	})

	t.Run("GetRequest", func(t *testing.T) {
		collection, _ := service.CreateCollection(CreateCollectionRequest{
			Name: "Test Collection for Get Request",
		})

		request, _ := service.CreateRequest(CreateRequestRequest{
			CollectionId: collection.ID,
			Name:         "Test Request for Get",
			Method:       "GET",
			URL:          "/api/test",
		})

		retrieved, err := service.GetRequest(collection.ID, request.ID)
		if err != nil {
			t.Errorf("Failed to get request: %v", err)
		}

		if retrieved.ID != request.ID {
			t.Errorf("Expected request ID %s, got %s", request.ID, retrieved.ID)
		}

		if retrieved.Name != request.Name {
			t.Errorf("Expected request name %s, got %s", request.Name, retrieved.Name)
		}
	})

	t.Run("UpdateRequest", func(t *testing.T) {
		collection, _ := service.CreateCollection(CreateCollectionRequest{
			Name: "Test Collection for Update",
		})

		request, _ := service.CreateRequest(CreateRequestRequest{
			CollectionId: collection.ID,
			Name:         "Test Request for Update",
			Method:       "GET",
			URL:          "/api/test",
		})

		updateReq := UpdateRequestRequest{
			CollectionId: collection.ID,
			RequestId:    request.ID,
			Data: Request{
				Name:         "Updated Request",
				Method:       "POST",
				URL:          "/api/updated",
				ProtoMessage: "user.v1.UpdateUserRequest",
				ResponseType: "user.v1.UpdateUserResponse",
				TimeoutSeconds: 60,
			},
		}

		updated, err := service.UpdateRequest(updateReq)
		if err != nil {
			t.Errorf("Failed to update request: %v", err)
		}

		if updated.Name != "Updated Request" {
			t.Errorf("Expected updated name 'Updated Request', got %s", updated.Name)
		}

		if updated.Method != "POST" {
			t.Errorf("Expected updated method 'POST', got %s", updated.Method)
		}

		if updated.URL != "/api/updated" {
			t.Errorf("Expected updated URL '/api/updated', got %s", updated.URL)
		}

		if updated.ProtoMessage != "user.v1.UpdateUserRequest" {
			t.Errorf("Expected updated proto message 'user.v1.UpdateUserRequest', got %s", updated.ProtoMessage)
		}

		if updated.ResponseType != "user.v1.UpdateUserResponse" {
			t.Errorf("Expected updated response type 'user.v1.UpdateUserResponse', got %s", updated.ResponseType)
		}

		if updated.TimeoutSeconds != 60 {
			t.Errorf("Expected updated timeout 60, got %d", updated.TimeoutSeconds)
		}
	})

	t.Run("ListCollections", func(t *testing.T) {
		// Create a few collections
		service.CreateCollection(CreateCollectionRequest{Name: "Collection 1"})
		service.CreateCollection(CreateCollectionRequest{Name: "Collection 2"})
		service.CreateCollection(CreateCollectionRequest{Name: "Collection 3"})

		collections, err := service.ListCollections()
		if err != nil {
			t.Errorf("Failed to list collections: %v", err)
		}

		if len(collections) < 3 {
			t.Errorf("Expected at least 3 collections, got %d", len(collections))
		}
	})

	t.Run("ListEnvironments", func(t *testing.T) {
		environments, err := service.ListEnvironments()
		if err != nil {
			t.Errorf("Failed to list environments: %v", err)
		}

		if len(environments) < 1 {
			t.Errorf("Expected at least 1 environment, got %d", len(environments))
		}

		// Check that local environment exists
		foundLocal := false
		for _, env := range environments {
			if env.Name == "local" {
				foundLocal = true
				break
			}
		}

		if !foundLocal {
			t.Error("Expected local environment not found")
		}
	})

	t.Run("GetEnvironment", func(t *testing.T) {
		env, err := service.GetEnvironment("local")
		if err != nil {
			t.Errorf("Failed to get local environment: %v", err)
		}

		if env.Name != "local" {
			t.Errorf("Expected environment name 'local', got %s", env.Name)
		}

		if env.Variables["base_url"] != "http://localhost:8080" {
			t.Errorf("Expected base_url 'http://localhost:8080', got %s", env.Variables["base_url"])
		}
	})

	t.Run("DeleteCollection", func(t *testing.T) {
		collection, _ := service.CreateCollection(CreateCollectionRequest{
			Name: "Test Collection for Delete",
		})

		err := service.DeleteCollection(collection.ID)
		if err != nil {
			t.Errorf("Failed to delete collection: %v", err)
		}

		// Try to get the deleted collection
		_, err = service.GetCollection(collection.ID)
		if err == nil {
			t.Error("Expected error when getting deleted collection")
		}
	})

	t.Run("DeleteRequest", func(t *testing.T) {
		collection, _ := service.CreateCollection(CreateCollectionRequest{
			Name: "Test Collection for Delete Request",
		})

		request, _ := service.CreateRequest(CreateRequestRequest{
			CollectionId: collection.ID,
			Name:         "Test Request for Delete",
			Method:       "GET",
			URL:          "/api/test",
		})

		err := service.DeleteRequest(collection.ID, request.ID)
		if err != nil {
			t.Errorf("Failed to delete request: %v", err)
		}

		// Try to get the deleted request
		_, err = service.GetRequest(collection.ID, request.ID)
		if err == nil {
			t.Error("Expected error when getting deleted request")
		}
	})
}

// Mock store implementation for testing
type mockStore struct {
	collections map[string]*Collection
	environments map[string]*Environment
	nextID      int
}

func (m *mockStore) CreateCollection(collection *Collection) error {
	m.nextID++
	collection.ID = string(rune(m.nextID + 64)) // Simple ID generation
	m.collections[collection.ID] = collection
	return nil
}

func (m *mockStore) GetCollection(id string) (*Collection, error) {
	if collection, exists := m.collections[id]; exists {
		return collection, nil
	}
	return nil, &NotFoundError{Entity: "collection", ID: id}
}

func (m *mockStore) ListCollections() ([]*Collection, error) {
	collections := make([]*Collection, 0, len(m.collections))
	for _, collection := range m.collections {
		collections = append(collections, collection)
	}
	return collections, nil
}

func (m *mockStore) UpdateCollection(collection *Collection) error {
	if _, exists := m.collections[collection.ID]; !exists {
		return &NotFoundError{Entity: "collection", ID: collection.ID}
	}
	m.collections[collection.ID] = collection
	return nil
}

func (m *mockStore) DeleteCollection(id string) error {
	if _, exists := m.collections[id]; !exists {
		return &NotFoundError{Entity: "collection", ID: id}
	}
	delete(m.collections, id)
	return nil
}

func (m *mockStore) CreateRequest(collectionID string, request *Request) error {
	collection, exists := m.collections[collectionID]
	if !exists {
		return &NotFoundError{Entity: "collection", ID: collectionID}
	}

	m.nextID++
	request.ID = string(rune(m.nextID + 64))
	collection.Requests = append(collection.Requests, request)
	return nil
}

func (m *mockStore) GetRequest(collectionID, requestID string) (*Request, error) {
	collection, exists := m.collections[collectionID]
	if !exists {
		return nil, &NotFoundError{Entity: "collection", ID: collectionID}
	}

	for _, request := range collection.Requests {
		if request.ID == requestID {
			return request, nil
		}
	}
	return nil, &NotFoundError{Entity: "request", ID: requestID}
}

func (m *mockStore) UpdateRequest(collectionID string, request *Request) error {
	collection, exists := m.collections[collectionID]
	if !exists {
		return &NotFoundError{Entity: "collection", ID: collectionID}
	}

	for i, existingRequest := range collection.Requests {
		if existingRequest.ID == request.ID {
			collection.Requests[i] = request
			return nil
		}
	}
	return &NotFoundError{Entity: "request", ID: request.ID}
}

func (m *mockStore) DeleteRequest(collectionID, requestID string) error {
	collection, exists := m.collections[collectionID]
	if !exists {
		return &NotFoundError{Entity: "collection", ID: collectionID}
	}

	for i, request := range collection.Requests {
		if request.ID == requestID {
			collection.Requests = append(collection.Requests[:i], collection.Requests[i+1:]...)
			return nil
		}
	}
	return &NotFoundError{Entity: "request", ID: requestID}
}

func (m *mockStore) ListEnvironments() ([]*Environment, error) {
	environments := make([]*Environment, 0, len(m.environments))
	for _, environment := range m.environments {
		environments = append(environments, environment)
	}
	return environments, nil
}

func (m *mockStore) GetEnvironment(name string) (*Environment, error) {
	if environment, exists := m.environments[name]; exists {
		return environment, nil
	}
	return nil, &NotFoundError{Entity: "environment", ID: name}
}
