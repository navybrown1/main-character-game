-- Operation Homestead initial schema.
-- Run with: psql "$POSTGRES_URL" -f db/migrations/001_init.sql
-- (The API routes also create these tables automatically on first use.)
--
-- Every table is keyed by player_id: a random per-browser id the client sends
-- on each request (x-player-id). No login system; the unguessable id keeps
-- each player's cloud saves isolated from every other visitor.
--
-- UPGRADING: if this database was created by the original pre-player-id
-- schema (player_state with an `id` column, mission_progress keyed by
-- mission_id alone), run db/migrations/002_player_id.sql afterwards to
-- migrate the old tables in place. (The app also migrates automatically on
-- boot; 002 is for operators who manage the schema by hand.)

CREATE TABLE IF NOT EXISTS player_state (
  player_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_progress (
  player_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  steps_done JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, mission_id)
);

CREATE TABLE IF NOT EXISTS intel_resolutions (
  player_id TEXT NOT NULL,
  gap_id TEXT NOT NULL,
  clarification TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, gap_id)
);
