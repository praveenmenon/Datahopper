package registry

import (
    "context"
    "errors"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
)

// RegistryRecord represents a row in the registries table
type RegistryRecord struct {
    ID               int64
    Name             string
    DescriptorBytes  []byte
    DescriptorSHA256 string
    CreatedAt        time.Time
    UpdatedAt        time.Time
}

// Repository provides persistence for compiled protobuf descriptor images
type Repository struct {
    pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
    return &Repository{pool: pool}
}

// UpsertRegistry stores or updates the descriptor image for a registry name.
// If the incoming SHA is the same as the existing, only touch updated_at.
func (r *Repository) UpsertRegistry(ctx context.Context, name string, descriptorBytes []byte, sha256 string) error {
    if r == nil || r.pool == nil {
        return errors.New("repository not initialized")
    }

    // Perform an upsert keyed by unique name
    // If SHA matches, only update updated_at. Else update descriptor columns.
    _, err := r.pool.Exec(ctx, `
        INSERT INTO registries (name, descriptor_bytes, descriptor_sha256)
        VALUES ($1, $2, $3)
        ON CONFLICT (name)
        DO UPDATE SET
            descriptor_bytes = CASE WHEN registries.descriptor_sha256 = EXCLUDED.descriptor_sha256 THEN registries.descriptor_bytes ELSE EXCLUDED.descriptor_bytes END,
            descriptor_sha256 = CASE WHEN registries.descriptor_sha256 = EXCLUDED.descriptor_sha256 THEN registries.descriptor_sha256 ELSE EXCLUDED.descriptor_sha256 END,
            updated_at = NOW();
    `, name, descriptorBytes, sha256)
    return err
}

// GetLatestByName fetches the latest descriptor for a registry name.
func (r *Repository) GetLatestByName(ctx context.Context, name string) (*RegistryRecord, error) {
    if r == nil || r.pool == nil {
        return nil, errors.New("repository not initialized")
    }

    row := r.pool.QueryRow(ctx, `
        SELECT id, name, descriptor_bytes, descriptor_sha256, created_at, updated_at
        FROM registries
        WHERE name = $1
        ORDER BY updated_at DESC
        LIMIT 1;
    `, name)

    var rec RegistryRecord
    if err := row.Scan(&rec.ID, &rec.Name, &rec.DescriptorBytes, &rec.DescriptorSHA256, &rec.CreatedAt, &rec.UpdatedAt); err != nil {
        return nil, err
    }
    return &rec, nil
}


