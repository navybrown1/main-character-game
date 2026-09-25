import { NextResponse } from 'next/server';
import { ensureTables, isDbConfigured, readPlayerState, writePlayerState } from '@/lib/db';
import { getPlayerId, missingPlayerId } from '@/lib/playerAuth';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json(
    { ok: false, error: 'database not configured' },
    { status: 503 },
  );
}

export async function GET(req: Request) {
  if (!isDbConfigured()) return unavailable();
  const playerId = getPlayerId(req);
  if (!playerId) return missingPlayerId();
  await ensureTables();
  const data = await readPlayerState(playerId);
  // null when this player has no cloud row yet. The client distinguishes
  // "no row" from "an empty row" so a fresh cloud account never wipes local
  // progress on a save-sequence tie.
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  if (!isDbConfigured()) return unavailable();
  const playerId = getPlayerId(req);
  if (!playerId) return missingPlayerId();
  await ensureTables();
  const body = (await req.json()) as Record<string, unknown>;
  // Whitelist player fields; never persist unknown keys.
  const allowed = [
    'xp', 'credits', 'streak', 'lastActiveDate', 'achievements', 'equipment',
    'equipped', 'unlockedDistricts', 'muted', 'splashSeen',
    'missionsCompleted', 'bossesSlain', 'saveSeq',
  ] as const;
  const clean: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) clean[key] = body[key];
  }
  const result = await writePlayerState(playerId, clean);
  if (result === 'stale') {
    // A newer tab already saved a higher save sequence; the caller should
    // rebase instead of overwriting it.
    return NextResponse.json({ ok: false, error: 'stale-write' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}