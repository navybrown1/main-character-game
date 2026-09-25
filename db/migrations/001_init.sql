-- Operation Homestead initial schema.
-- Run with: psql "$POSTGRES_URL" -f db/migrations/001_init.sql
-- (The API routes also create these tables automatically on first use.)

CREATE TABLE IF NOT EXISTS player_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_progress (
  mission_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'available',
  steps_done JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_resolutions (
  gap_id TEXT PRIMARY KEY,
  clarification TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
