-- App-wide preferences (no auth/users yet)
CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  bool_value BOOLEAN,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default to show delete confirmation for requests
INSERT INTO preferences(key, bool_value)
VALUES ('confirm_delete_request', TRUE)
ON CONFLICT (key) DO NOTHING;


