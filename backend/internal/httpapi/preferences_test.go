package httpapi

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"

    "github.com/datahopper/backend/internal/obs"
    "github.com/datahopper/backend/internal/registry"
    "github.com/datahopper/backend/internal/runner"
    "github.com/datahopper/backend/internal/store"
    "github.com/datahopper/backend/internal/workspace"
    "github.com/gin-gonic/gin"
)

// helper to build an API without DB
func buildTestAPI(t *testing.T) *API {
    t.Helper()
    gin.SetMode(gin.TestMode)

    logger := obs.NewLogger()
    reg := registry.NewService()
    ws := workspace.NewService(store.NewInMemoryStore())
    run := runner.NewService(reg)
    api := NewAPI(reg, ws, run, logger)
    return api
}

func TestGetPreferences_Default_NoDB(t *testing.T) {
    apiRunnerPool = nil // ensure no DB for this test

    api := buildTestAPI(t)
    r := gin.New()
    api.SetupRoutes(r)

    req := httptest.NewRequest(http.MethodGet, "/api/preferences", nil)
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)

    if w.Code != http.StatusOK {
        t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
    }

    var body struct{ ConfirmDeleteRequest *bool `json:"confirmDeleteRequest"` }
    if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
        t.Fatalf("invalid json: %v", err)
    }
    if body.ConfirmDeleteRequest == nil || *body.ConfirmDeleteRequest != true {
        t.Fatalf("expected confirmDeleteRequest=true by default, got %+v", body)
    }
}

func TestUpdatePreferences_NoDB(t *testing.T) {
    apiRunnerPool = nil // ensure no DB for this test

    api := buildTestAPI(t)
    r := gin.New()
    api.SetupRoutes(r)

    payload := `{"confirmDeleteRequest":false}`
    req := httptest.NewRequest(http.MethodPut, "/api/preferences", strings.NewReader(payload))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)

    if w.Code != http.StatusOK {
        t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
    }

    var body struct{ ConfirmDeleteRequest *bool `json:"confirmDeleteRequest"` }
    if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
        t.Fatalf("invalid json: %v", err)
    }
    if body.ConfirmDeleteRequest == nil || *body.ConfirmDeleteRequest != false {
        t.Fatalf("expected confirmDeleteRequest=false echo, got %+v", body)
    }
}


