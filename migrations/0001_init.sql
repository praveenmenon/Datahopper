-- Schema initialization for DataHopper
-- Registries table stores compiled protobuf descriptor images

CREATE TABLE IF NOT EXISTS registries (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  descriptor_bytes BYTEA NOT NULL,
  descriptor_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registries_sha ON registries(descriptor_sha256);

-- Trigger to auto-update updated_at on row modification
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'registries_set_updated_at'
  ) THEN
    CREATE TRIGGER registries_set_updated_at
    BEFORE UPDATE ON registries
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;


