// Server-only Postgres access. Never import this from a client component.
import { sql } from '@vercel/postgres';
import type { GameState, MissionProgress, PlayerState } from './game';

export function isDbConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

export async function ensureTables(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS player_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS mission_progress (
      mission_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'available',
      steps_done JSONB NOT NULL DEFAULT '[]'::jsonb,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS intel_resolutions (
      gap_id TEXT PRIMARY KEY,
      clarification TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
}

export async function readPlayerState(): Promise<Partial<PlayerState> | null> {
  const { rows } = await sql`SELECT data FROM player_state WHERE id = 1`;
  if (rows.length === 0) return null;
  return rows[0].data as Partial<PlayerState>;
}

export async function writePlayerState(data: Partial<PlayerState>): Promise<void> {
  const payload = JSON.stringify(data);
  await sql`
    INSERT INTO player_state (id, data, updated_at)
    VALUES (1, ${payload}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
}

export async function readMissionProgress(): Promise<Record<string, MissionProgress>> {
  const { rows } = await sql`SELECT mission_id, status, steps_done, completed_at FROM mission_progress`;
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
  missionId: string,
  progress: MissionProgress,
): Promise<void> {
  const steps = JSON.stringify(progress.stepsDone ?? []);
  await sql`
    INSERT INTO mission_progress (mission_id, status, steps_done, completed_at, updated_at)
    VALUES (${missionId}, ${progress.status}, ${steps}::jsonb, ${progress.completedAt}, NOW())
    ON CONFLICT (mission_id) DO UPDATE SET
      status = EXCLUDED.status,
      steps_done = EXCLUDED.steps_done,
      completed_at = EXCLUDED.completed_at,
      updated_at = NOW()`;
}

export async function readIntel(): Promise<Record<string, string>> {
  const { rows } = await sql`SELECT gap_id, clarification FROM intel_resolutions`;
  const out: Record<string, string> = {};
  for (const r of rows as Array<{ gap_id: string; clarification: string }>) {
    out[r.gap_id] = r.clarification;
  }
  return out;
}

export async function writeIntel(gapId: string, clarification: string): Promise<void> {
  await sql`
    INSERT INTO intel_resolutions (gap_id, clarification, updated_at)
    VALUES (${gapId}, ${clarification}, NOW())
    ON CONFLICT (gap_id) DO UPDATE SET clarification = EXCLUDED.clarification, updated_at = NOW()`;
}

export type { GameState };
