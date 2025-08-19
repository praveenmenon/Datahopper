-- Add text_value column to preferences for storing strings like active environment name
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS text_value TEXT;

-- Seed empty active_environment preference if not present
INSERT INTO preferences(key, text_value)
VALUES ('active_environment', '')
ON CONFLICT (key) DO NOTHING;


