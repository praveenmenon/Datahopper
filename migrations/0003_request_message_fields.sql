-- Add response and error response message FQMN columns to requests
ALTER TABLE IF EXISTS requests
  ADD COLUMN IF NOT EXISTS response_message_fqmn TEXT,
  ADD COLUMN IF NOT EXISTS error_response_message_fqmn TEXT;


