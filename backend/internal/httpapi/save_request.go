package httpapi

import (
    "context"
    "database/sql"
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "github.com/jackc/pgx/v5"
    "github.com/jackc/pgx/v5/pgconn"
    "github.com/jackc/pgx/v5/pgxpool"
)

// SaveRequestPayload represents the incoming payload from the UI
type SaveRequestPayload struct {
    Collection struct {
        ID          *uuid.UUID `json:"id"`
        Name        *string    `json:"name"`
        Description *string    `json:"description"`
    } `json:"collection"`
    Request struct {
        ID               *uuid.UUID    `json:"id"`
        Name             string        `json:"name"`
        Verb             string        `json:"verb"`
        URL              string        `json:"url"`
        Headers          map[string]any `json:"headers"`
        BodyModel        map[string]any `json:"bodyModel"`
        ProtoMessageFQMN *string       `json:"protoMessageFqmn"`
        ResponseMessageFQMN *string    `json:"responseMessageFqmn"`
        ErrorResponseMessageFQMN *string `json:"errorResponseMessageFqmn"`
        TimeoutMS        *int32        `json:"timeoutMs"`
    } `json:"request"`
}

// SaveRequestResponse represents the response shape after saving
type SaveRequestResponse struct {
    Collection map[string]any `json:"collection"`
    Request    map[string]any `json:"request"`
}

// saveRequest handles POST /v1/save-request
func (api *API) saveRequest(c *gin.Context) {
    // Verify we have a DB pool via registry's repo (piggyback for this iteration)
    pool := api.getDBPool()
    if pool == nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "database not configured"})
        return
    }

    var payload SaveRequestPayload
    if err := c.ShouldBindJSON(&payload); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Validate required request fields
    if strings.TrimSpace(payload.Request.Name) == "" || strings.TrimSpace(payload.Request.URL) == "" || strings.TrimSpace(payload.Request.Verb) == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "request.name, request.verb, and request.url are required"})
        return
    }
    verb := strings.ToUpper(payload.Request.Verb)
    if !isValidHTTPVerb(verb) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid HTTP verb"})
        return
    }

    // Normalize maps
    if payload.Request.Headers == nil {
        payload.Request.Headers = map[string]any{}
    }
    if payload.Request.BodyModel == nil {
        payload.Request.BodyModel = map[string]any{}
    }

    ctx := context.Background()
    tx, err := pool.Begin(ctx)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to begin tx"})
        return
    }
    defer func() { _ = tx.Rollback(ctx) }()

    // 1) Resolve/Upsert collection
    var colID uuid.UUID
    if payload.Collection.ID != nil {
        // ID provided
        row := tx.QueryRow(ctx, `SELECT id, name, description FROM collections WHERE id = $1`, payload.Collection.ID)
        var id uuid.UUID
        var name, desc sql.NullString
        if err := row.Scan(&id, &name, &desc); err != nil {
            if err == pgx.ErrNoRows {
                c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
                return
            }
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch collection"})
            return
        }
        // Optional update if name/description provided
        if payload.Collection.Name != nil || payload.Collection.Description != nil {
            // Keep existing values if field not provided
            newName := name.String
            newDesc := desc.String
            if payload.Collection.Name != nil {
                newName = *payload.Collection.Name
            }
            if payload.Collection.Description != nil {
                newDesc = *payload.Collection.Description
            }
            row := tx.QueryRow(ctx, `UPDATE collections SET name=$2, description=$3 WHERE id=$1 RETURNING id`, id, newName, newDesc)
            if err := row.Scan(&colID); err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update collection"})
                return
            }
        } else {
            colID = id
        }
    } else if payload.Collection.Name != nil {
        // Name provided; try fetch by name
        row := tx.QueryRow(ctx, `SELECT id FROM collections WHERE name = $1`, payload.Collection.Name)
        if err := row.Scan(&colID); err != nil {
            if err == pgx.ErrNoRows {
                // Create new collection
                colID = uuid.New()
                desc := sql.NullString{}
                if payload.Collection.Description != nil {
                    desc.String, desc.Valid = *payload.Collection.Description, true
                }
                _, err := tx.Exec(ctx, `INSERT INTO collections (id, name, description) VALUES ($1,$2,$3)`, colID, *payload.Collection.Name, desc)
                if err != nil {
                    c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create collection"})
                    return
                }
            } else {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch collection by name"})
                return
            }
        } else if payload.Collection.Description != nil {
            // Update description only if provided
            if _, err := tx.Exec(ctx, `UPDATE collections SET description=$2 WHERE id=$1`, colID, *payload.Collection.Description); err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update collection description"})
                return
            }
        }
    } else {
        c.JSON(http.StatusBadRequest, gin.H{"error": "collection id or name required"})
        return
    }

    // 2) Upsert request under collection
    var reqID uuid.UUID
    if payload.Request.ID != nil {
        // Fetch existing
        var existingColID uuid.UUID
        row := tx.QueryRow(ctx, `SELECT id, collection_id FROM requests WHERE id=$1`, payload.Request.ID)
        if err := row.Scan(&reqID, &existingColID); err != nil {
            if err == pgx.ErrNoRows {
                c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
                return
            }
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch request by id"})
            return
        }
        if existingColID != colID {
            c.JSON(http.StatusBadRequest, gin.H{"error": "request does not belong to the provided collection"})
            return
        }
        // Update
        _, err := tx.Exec(ctx, `UPDATE requests SET name=$2, verb=$3, url=$4, headers=$5, body_model=$6, proto_message_fqmn=$7, response_message_fqmn=$8, error_response_message_fqmn=$9, timeout_ms=$10, updated_at=NOW() WHERE id=$1`,
            reqID, payload.Request.Name, verb, payload.Request.URL, payload.Request.Headers, payload.Request.BodyModel, payload.Request.ProtoMessageFQMN, payload.Request.ResponseMessageFQMN, payload.Request.ErrorResponseMessageFQMN, payload.Request.TimeoutMS,
        )
        if err != nil {
            if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.ConstraintName == "requests_collection_id_name_key" {
                c.JSON(http.StatusConflict, gin.H{"error": "request name already exists in this collection"})
                return
            }
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update request"})
            return
        }
    } else {
        // Try by (collection_id, name)
        row := tx.QueryRow(ctx, `SELECT id FROM requests WHERE collection_id=$1 AND name=$2`, colID, payload.Request.Name)
        if err := row.Scan(&reqID); err != nil {
            if err == pgx.ErrNoRows {
                // Create new
                reqID = uuid.New()
                _, err := tx.Exec(ctx, `INSERT INTO requests (id, collection_id, name, verb, url, headers, body_model, proto_message_fqmn, response_message_fqmn, error_response_message_fqmn, timeout_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                    reqID, colID, payload.Request.Name, verb, payload.Request.URL, payload.Request.Headers, payload.Request.BodyModel, payload.Request.ProtoMessageFQMN, payload.Request.ResponseMessageFQMN, payload.Request.ErrorResponseMessageFQMN, payload.Request.TimeoutMS,
                )
                if err != nil {
                    if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.ConstraintName == "requests_collection_id_name_key" {
                        c.JSON(http.StatusConflict, gin.H{"error": "request name already exists in this collection"})
                        return
                    }
                    c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create request"})
                    return
                }
            } else {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch existing request"})
                return
            }
        } else {
            // Update existing by name
            _, err := tx.Exec(ctx, `UPDATE requests SET verb=$2, url=$3, headers=$4, body_model=$5, proto_message_fqmn=$6, response_message_fqmn=$7, error_response_message_fqmn=$8, timeout_ms=$9, updated_at=NOW() WHERE id=$1`,
                reqID, verb, payload.Request.URL, payload.Request.Headers, payload.Request.BodyModel, payload.Request.ProtoMessageFQMN, payload.Request.ResponseMessageFQMN, payload.Request.ErrorResponseMessageFQMN, payload.Request.TimeoutMS,
            )
            if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update request"})
                return
            }
        }
    }

    if err := tx.Commit(ctx); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit transaction"})
        return
    }

    // Build response objects
    resp := SaveRequestResponse{
        Collection: map[string]any{
            "id": colID,
        },
        Request: map[string]any{
            "id":            reqID,
            "collectionId":  colID,
            "name":          payload.Request.Name,
            "verb":          verb,
            "url":           payload.Request.URL,
            "headers":       payload.Request.Headers,
            "bodyModel":     payload.Request.BodyModel,
            "protoMessageFqmn": payload.Request.ProtoMessageFQMN,
            "timeoutMs":     payload.Request.TimeoutMS,
        },
    }
    c.JSON(http.StatusOK, resp)
}

func isValidHTTPVerb(v string) bool {
    switch strings.ToUpper(v) {
    case "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE":
        return true
    default:
        return false
    }
}

// getDBPool fetches the pgx pool from the registry repo (temporary wiring)
func (api *API) getDBPool() *pgxpool.Pool {
    // We wired DB through registry repository; expose its pool here
    // to avoid adding a new DB service layer in this iteration.
    // If no repo or no pool, return nil.
    if api.registry == nil {
        return nil
    }
    // Unsafe: use package-level knowledge; adding a small helper on repo would be ideal.
    type repoAccessor interface{ GetPool() *pgxpool.Pool }
    if api.registry != nil && api.registry.GetSchemaService() != nil { /* no-op to avoid unused import */ }
    // Use type assertion against our concrete type
    // We know api.registry.WithRepository uses *registry.Repository
    // So we reflect via an unexported accessor shim below.
    return repoPoolAccessor(api)
}

// repoPoolAccessor is a small shim to access pool via the API struct without exporting internals.
func repoPoolAccessor(api *API) *pgxpool.Pool {
    // We keep this minimal and safe: relying on a method on Repository would be better long-term.
    // For now, keep it nil-safe.
    // Since fields are unexported, we can't access directly; so we store pool reference on API via context if needed.
    // Simpler: stash pool in gin.Engine context? For this iteration, reuse main wiring by adding a helper.
    return apiRunnerPool
}

// apiRunnerPool is assigned in main during server setup for this iteration.
var apiRunnerPool *pgxpool.Pool


