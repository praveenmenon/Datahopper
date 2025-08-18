-- Collections
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Requests
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  verb TEXT NOT NULL,
  url TEXT NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  body_model JSONB NOT NULL DEFAULT '{}'::jsonb,
  proto_message_fqmn TEXT,
  timeout_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (collection_id, name)
);

CREATE INDEX IF NOT EXISTS idx_requests_collection ON requests(collection_id);



