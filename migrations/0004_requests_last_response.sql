-- Persist last response for requests
ALTER TABLE IF EXISTS requests
  ADD COLUMN IF NOT EXISTS last_response JSONB,
  ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ;


