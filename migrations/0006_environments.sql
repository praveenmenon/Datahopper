-- Environments persistence
CREATE TABLE IF NOT EXISTS environments (
  name TEXT PRIMARY KEY,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


