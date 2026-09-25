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

export async function writePlayerState(playerId: string, data: Partial<PlayerState>): Promise<void> {
  const payload = JSON.stringify(data);
  await sql`
    INSERT INTO player_state (player_id, data, updated_at)
    VALUES (${playerId}, ${payload}::jsonb, NOW())
    ON CONFLICT (player_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
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

export async function writeMissionProgress(
  playerId: string,
  missionId: string,
  progress: MissionProgress,
): Promise<void> {
  const steps = JSON.stringify(progress.stepsDone ?? []);
  await sql`
    INSERT INTO mission_progress (player_id, mission_id, status, steps_done, completed_at, updated_at)
    VALUES (${playerId}, ${missionId}, ${progress.status}, ${steps}::jsonb, ${progress.completedAt}, NOW())
    ON CONFLICT (player_id, mission_id) DO UPDATE SET
      status = EXCLUDED.status,
      steps_done = EXCLUDED.steps_done,
      completed_at = EXCLUDED.completed_at,
      updated_at = NOW()`;
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

export async function writeIntel(playerId: string, gapId: string, clarification: string): Promise<void> {
  await sql`
    INSERT INTO intel_resolutions (player_id, gap_id, clarification, updated_at)
    VALUES (${playerId}, ${gapId}, ${clarification}, NOW())
    ON CONFLICT (player_id, gap_id) DO UPDATE SET clarification = EXCLUDED.clarification, updated_at = NOW()`;
}

export type { GameState };
