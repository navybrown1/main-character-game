-- 002: per-player cloud saves.
--
-- Migrates databases created by the ORIGINAL pre-player-id schema:
--   player_state(id INTEGER PRIMARY KEY CHECK (id = 1))
--   mission_progress(mission_id TEXT PRIMARY KEY)
--   intel_resolutions(gap_id TEXT PRIMARY KEY)
-- to the per-player shape:
--   player_state(player_id TEXT PRIMARY KEY)
--   mission_progress(player_id, mission_id composite PK)
--   intel_resolutions(player_id, gap_id composite PK)
--
-- The old saves were global singletons with no player identity, so their
-- rows are preserved under the 'legacy-singleton' player id: kept in the
-- database for reference, but never served to new clients (which all mint
-- random player ids and send them as x-player-id).
--
-- Every block is guarded, so this file is safe to run more than once.
-- NOTE: the app runs the same migration automatically inside ensureTables()
-- on boot (see lib/db.ts migrateLegacyTables). This file is only for
-- operators who manage the schema by hand with psql.

-- player_state: old PK (id) -> new PK (player_id)
DO $$
DECLARE
  pk_cols TEXT[];
  pk_name TEXT;
  has_player_id BOOLEAN;
BEGIN
  SELECT array_agg(kcu.column_name ORDER BY kcu.ordinal_position) INTO pk_cols
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'player_state'
    AND tc.constraint_type = 'PRIMARY KEY';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_state'
      AND column_name = 'player_id'
  ) INTO has_player_id;

  -- Old shape, or a previous run that added player_id but died before the PK.
  IF pk_cols = ARRAY['id'] OR (pk_cols IS NULL AND has_player_id) THEN
    ALTER TABLE player_state ADD COLUMN IF NOT EXISTS player_id TEXT;
    UPDATE player_state SET player_id = 'legacy-singleton' WHERE player_id IS NULL;
    ALTER TABLE player_state ALTER COLUMN player_id SET NOT NULL;
    -- Drop the old singleton id column; CASCADE removes the old PK/CHECK
    -- that depended on it no matter what they were named.
    ALTER TABLE player_state DROP COLUMN IF EXISTS id CASCADE;
    -- Drop whatever PK remains (name-agnostic), then add the new one.
    SELECT tc.constraint_name INTO pk_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'player_state'
      AND tc.constraint_type = 'PRIMARY KEY'
    LIMIT 1;
    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE player_state DROP CONSTRAINT %I', pk_name);
    END IF;
    ALTER TABLE player_state ADD CONSTRAINT player_state_pkey PRIMARY KEY (player_id);
  END IF;
END $$;

-- mission_progress: old PK (mission_id) -> new PK (player_id, mission_id)
DO $$
DECLARE
  pk_cols TEXT[];
  pk_name TEXT;
  has_player_id BOOLEAN;
BEGIN
  SELECT array_agg(kcu.column_name ORDER BY kcu.ordinal_position) INTO pk_cols
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'mission_progress'
    AND tc.constraint_type = 'PRIMARY KEY';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mission_progress'
      AND column_name = 'player_id'
  ) INTO has_player_id;

  IF pk_cols = ARRAY['mission_id'] OR (pk_cols IS NULL AND has_player_id) THEN
    ALTER TABLE mission_progress ADD COLUMN IF NOT EXISTS player_id TEXT;
    UPDATE mission_progress SET player_id = 'legacy-singleton' WHERE player_id IS NULL;
    ALTER TABLE mission_progress ALTER COLUMN player_id SET NOT NULL;
    SELECT tc.constraint_name INTO pk_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'mission_progress'
      AND tc.constraint_type = 'PRIMARY KEY'
    LIMIT 1;
    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE mission_progress DROP CONSTRAINT %I', pk_name);
    END IF;
    ALTER TABLE mission_progress
      ADD CONSTRAINT mission_progress_pkey PRIMARY KEY (player_id, mission_id);
  END IF;
END $$;

-- intel_resolutions: old PK (gap_id) -> new PK (player_id, gap_id)
DO $$
DECLARE
  pk_cols TEXT[];
  pk_name TEXT;
  has_player_id BOOLEAN;
BEGIN
  SELECT array_agg(kcu.column_name ORDER BY kcu.ordinal_position) INTO pk_cols
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'intel_resolutions'
    AND tc.constraint_type = 'PRIMARY KEY';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'intel_resolutions'
      AND column_name = 'player_id'
  ) INTO has_player_id;

  IF pk_cols = ARRAY['gap_id'] OR (pk_cols IS NULL AND has_player_id) THEN
    ALTER TABLE intel_resolutions ADD COLUMN IF NOT EXISTS player_id TEXT;
    UPDATE intel_resolutions SET player_id = 'legacy-singleton' WHERE player_id IS NULL;
    ALTER TABLE intel_resolutions ALTER COLUMN player_id SET NOT NULL;
    SELECT tc.constraint_name INTO pk_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'intel_resolutions'
      AND tc.constraint_type = 'PRIMARY KEY'
    LIMIT 1;
    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE intel_resolutions DROP CONSTRAINT %I', pk_name);
    END IF;
    ALTER TABLE intel_resolutions
      ADD CONSTRAINT intel_resolutions_pkey PRIMARY KEY (player_id, gap_id);
  END IF;
END $$;
