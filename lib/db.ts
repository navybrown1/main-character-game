// Server-only Postgres access. Never import this from a client component.
import { sql } from '@vercel/postgres';
import type { GameState, MissionProgress, PlayerState } from './game';

export function isDbConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

async function ensureTablesInner(): Promise<void> {
  // Per-player scoping: every table is keyed by an unguessable player id
  // supplied by the client. No login system; a random id generated once in
  // the browser keeps each player's saves isolated from everyone else's.
  await sql`
    CREATE TABLE IF NOT EXISTS player_state (
      player_id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS mission_progress (
      player_id TEXT NOT NULL,
      mission_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      steps_done JSONB NOT NULL DEFAULT '[]'::jsonb,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (player_id, mission_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS intel_resolutions (
      player_id TEXT NOT NULL,
      gap_id TEXT NOT NULL,
      clarification TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (player_id, gap_id)
    )`;

  // Databases created before per-player saves (the original singleton
  // schema) keep their old shape through CREATE TABLE IF NOT EXISTS, which
  // would make every player_id query fail. Migrate them in place first.
  await migrateLegacyTables();
}

/** Columns of a table's primary key, in key order. Empty when there is none. */
async function primaryKeyColumns(table: string): Promise<string[]> {
  const { rows } = await sql`
    SELECT kcu.column_name AS col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = ${table}
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position`;
  return rows.map((r) => (r as { col: string }).col);
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  const { rows } = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
      AND column_name = ${column}
    LIMIT 1`;
  return rows.length > 0;
}

function sameColumns(a: string[], b: string[]): boolean {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

/**
 * Whether a table still needs the per-player-id migration: either it still
 * has the pre-player-id primary key, or a previous run got as far as adding
 * the player_id column but died before re-adding the primary key.
 */
async function needsPlayerIdMigration(table: string, oldPk: string[]): Promise<boolean> {
  const pk = await primaryKeyColumns(table);
  if (sameColumns(pk, oldPk)) return true;
  if (pk.length === 0 && (await hasColumn(table, 'player_id'))) return true;
  return false;
}

/**
 * Upgrade databases created by the pre-player-id schema:
 *   player_state(id INTEGER PK), mission_progress(mission_id PK),
 *   intel_resolutions(gap_id PK).
 *
 * The old saves were global singletons with no player identity, so their
 * rows are preserved under the 'legacy-singleton' player id: kept in the
 * database, but never served to new clients (which all mint random ids).
 * Every step is guarded so the migration is safe to re-run (e.g. from two
 * serverless instances racing on first boot).
 */
async function migrateLegacyTables(): Promise<void> {
  // player_state: old PK (id) -> new PK (player_id)
  if (await needsPlayerIdMigration('player_state', ['id'])) {
    await sql`ALTER TABLE player_state ADD COLUMN IF NOT EXISTS player_id TEXT`;
    await sql`UPDATE player_state SET player_id = 'legacy-singleton' WHERE player_id IS NULL`;
    await sql`ALTER TABLE player_state ALTER COLUMN player_id SET NOT NULL`;
    await sql`ALTER TABLE player_state DROP COLUMN IF EXISTS id CASCADE`;
    await sql`ALTER TABLE player_state ADD CONSTRAINT player_state_pkey PRIMARY KEY (player_id)`;
  }

  // mission_progress: old PK (mission_id) -> new PK (player_id, mission_id)
  if (await needsPlayerIdMigration('mission_progress', ['mission_id'])) {
    await sql`ALTER TABLE mission_progress ADD COLUMN IF NOT EXISTS player_id TEXT`;
    await sql`UPDATE mission_progress SET player_id = 'legacy-singleton' WHERE player_id IS NULL`;
    await sql`ALTER TABLE mission_progress ALTER COLUMN player_id SET NOT NULL`;
    // Old PK was on (mission_id) alone under the deterministic PR #1 name;
    // IF EXISTS keeps re-runs safe, and anything else fails loudly at boot
    // rather than silently breaking saves.
    await sql`ALTER TABLE mission_progress DROP CONSTRAINT IF EXISTS mission_progress_pkey`;
    await sql`ALTER TABLE mission_progress
              ADD CONSTRAINT mission_progress_pkey PRIMARY KEY (player_id, mission_id)`;
  }

  // intel_resolutions: old PK (gap_id) -> new PK (player_id, gap_id)
  if (await needsPlayerIdMigration('intel_resolutions', ['gap_id'])) {
    await sql`ALTER TABLE intel_resolutions ADD COLUMN IF NOT EXISTS player_id TEXT`;
    await sql`UPDATE intel_resolutions SET player_id = 'legacy-singleton' WHERE player_id IS NULL`;
    await sql`ALTER TABLE intel_resolutions ALTER COLUMN player_id SET NOT NULL`;
    // Same as above: old PK was on (gap_id) alone under the PR #1 name.
    await sql`ALTER TABLE intel_resolutions DROP CONSTRAINT IF EXISTS intel_resolutions_pkey`;
    await sql`ALTER TABLE intel_resolutions
              ADD CONSTRAINT intel_resolutions_pkey PRIMARY KEY (player_id, gap_id)`;
  }
}

/** The save sequence the server currently holds for a player (-1 = no row).
 *  Used to reject stale writes from a background tab that saved earlier. */
async function storedSaveSeq(playerId: string): Promise<number> {
  const current = await readPlayerState(playerId);
  const seq = (current as { saveSeq?: unknown } | null)?.saveSeq;
  return typeof seq === 'number' ? seq : -1;
}

// Run schema setup once per server instance instead of on every request.
let tablesReady: Promise<void> | null = null;
export function ensureTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = ensureTablesInner().catch((err: unknown) => {
      tablesReady = null;
      throw err;
    });
  }
  return tablesReady;
}

export async function readPlayerState(playerId: string): Promise<Partial<PlayerState> | null> {
  const { rows } = await sql`SELECT data FROM player_state WHERE player_id = ${playerId}`;
  if (rows.length === 0) return null;
  return rows[0].data as Partial<PlayerState>;
}

/**
 * Write a player snapshot, but only if it is not older than what the server
 * already holds. Returns 'applied' or 'stale'. Stale means a newer tab (or
 * device) saved first, so the caller should rebase instead of overwriting.
 */
export async function writePlayerState(
  playerId: string,
  data: Partial<PlayerState>,
): Promise<'applied' | 'stale'> {
  const incoming = typeof data.saveSeq === 'number' ? data.saveSeq : -1;
  if (incoming < (await storedSaveSeq(playerId))) return 'stale';
  const payload = JSON.stringify(data);
  await sql`
    INSERT INTO player_state (player_id, data, updated_at)
    VALUES (${playerId}, ${payload}::jsonb, NOW())
    ON CONFLICT (player_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
  return 'applied';
}

export async function readMissionProgress(playerId: string): Promise<Record<string, MissionProgress>> {
  const { rows } = await sql`
    SELECT mission_id, status, steps_done, completed_at
    FROM mission_progress
    WHERE player_id = ${playerId}`;
  const out: Record<string, MissionProgress> = {};
  for (const r of rows as Array<{ mission_id: string; status: string; steps_done: unknown; completed_at: string | null }>) {
    out[r.mission_id] = {
      status: r.status as MissionProgress['status'],
      stepsDone: Array.isArray(r.steps_done) ? (r.steps_done as number[]) : [],
      completedAt: r.completed_at,
    };
  }
  return out;
}

/**
 * Write one mission record, guarded by the same save-sequence check as the
 * player snapshot: a delayed flush from a background tab must not overwrite
 * a newer tab's progress. Returns 'applied' or 'stale'.
 */
export async function writeMissionProgress(
  playerId: string,
  missionId: string,
  progress: MissionProgress,
  saveSeq: number,
): Promise<'applied' | 'stale'> {
  if (saveSeq < (await storedSaveSeq(playerId))) return 'stale';
  const steps = JSON.stringify(progress.stepsDone ?? []);
  await sql`
    INSERT INTO mission_progress (player_id, mission_id, status, steps_done, completed_at, updated_at)
    VALUES (${playerId}, ${missionId}, ${progress.status}, ${steps}::jsonb, ${progress.completedAt}, NOW())
    ON CONFLICT (player_id, mission_id) DO UPDATE SET
      status = EXCLUDED.status,
      steps_done = EXCLUDED.steps_done,
      completed_at = EXCLUDED.completed_at,
      updated_at = NOW()`;
  return 'applied';
}

export async function readIntel(playerId: string): Promise<Record<string, string>> {
  const { rows } = await sql`
    SELECT gap_id, clarification
    FROM intel_resolutions
    WHERE player_id = ${playerId}`;
  const out: Record<string, string> = {};
  for (const r of rows as Array<{ gap_id: string; clarification: string }>) {
    out[r.gap_id] = r.clarification;
  }
  return out;
}

/** Same save-sequence guard as writeMissionProgress. Returns 'applied' or 'stale'. */
export async function writeIntel(
  playerId: string,
  gapId: string,
  clarification: string,
  saveSeq: number,
): Promise<'applied' | 'stale'> {
  if (saveSeq < (await storedSaveSeq(playerId))) return 'stale';
  await sql`
    INSERT INTO intel_resolutions (player_id, gap_id, clarification, updated_at)
    VALUES (${playerId}, ${gapId}, ${clarification}, NOW())
    ON CONFLICT (player_id, gap_id) DO UPDATE SET clarification = EXCLUDED.clarification, updated_at = NOW()`;
  return 'applied';
}

export type { GameState };
