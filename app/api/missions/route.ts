import { NextResponse } from 'next/server';
import { ensureTables, isDbConfigured, readMissionProgress, writeMissionProgress } from '@/lib/db';
import type { MissionProgress } from '@/lib/game';
import { getPlayerId, missingPlayerId } from '@/lib/playerAuth';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json(
    { ok: false, error: 'database not configured' },
    { status: 503 },
  );
}

const VALID_STATUS = new Set(['locked', 'available', 'active', 'done']);

export async function GET(req: Request) {
  if (!isDbConfigured()) return unavailable();
  const playerId = getPlayerId(req);
  if (!playerId) return missingPlayerId();
  await ensureTables();
  const data = await readMissionProgress(playerId);
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  if (!isDbConfigured()) return unavailable();
  const playerId = getPlayerId(req);
  if (!playerId) return missingPlayerId();
  await ensureTables();
  const body = (await req.json()) as {
    mission_id?: unknown;
    status?: unknown;
    stepsDone?: unknown;
    steps_done?: unknown;
    completedAt?: unknown;
    completed_at?: unknown;
  };
  const missionId = typeof body.mission_id === 'string' ? body.mission_id : '';
  const status = typeof body.status === 'string' && VALID_STATUS.has(body.status) ? body.status : 'available';
  const rawSteps = body.stepsDone ?? body.steps_done;
  const stepsDone = Array.isArray(rawSteps) ? rawSteps.filter((n) => typeof n === 'number') : [];
  const rawCompleted = body.completedAt ?? body.completed_at;
  const completedAt = typeof rawCompleted === 'string' ? rawCompleted : null;
  if (!missionId) {
    return NextResponse.json({ ok: false, error: 'mission_id required' }, { status: 400 });
  }
  const progress: MissionProgress = {
    status: status as MissionProgress['status'],
    stepsDone,
    completedAt,
  };
  await writeMissionProgress(playerId, missionId, progress);
  return NextResponse.json({ ok: true });
}
