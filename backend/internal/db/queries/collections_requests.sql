-- Collections

-- name: GetCollectionByID :one
SELECT * FROM collections WHERE id = $1;

-- name: GetCollectionByName :one
SELECT * FROM collections WHERE name = $1;

-- name: CreateCollection :one
INSERT INTO collections (id, name, description)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateCollection :one
UPDATE collections SET name = $2, description = $3
WHERE id = $1
RETURNING *;

-- Requests

-- name: GetRequestByID :one
SELECT * FROM requests WHERE id = $1;

-- name: GetRequestByCollectionAndName :one
SELECT * FROM requests WHERE collection_id = $1 AND name = $2;

-- name: CreateRequest :one
INSERT INTO requests (id, collection_id, name, verb, url, headers, body_model, proto_message_fqmn, timeout_ms)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
RETURNING *;

-- name: UpdateRequest :one
UPDATE requests
SET name = $2,
    verb = $3,
    url = $4,
    headers = $5,
    body_model = $6,
    proto_message_fqmn = $7,
    timeout_ms = $8,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS response_message_fqmn TEXT,
  ADD COLUMN IF NOT EXISTS error_response_message_fqmn TEXT;



