import { NextResponse } from 'next/server';
import { ensureTables, isDbConfigured, readPlayerState, writePlayerState } from '@/lib/db';
import { defaultPlayerState } from '@/lib/game';

export const dynamic = 'force-dynamic';

function unavailable() {
  return NextResponse.json(
    { ok: false, error: 'database not configured' },
    { status: 503 },
  );
}

export async function GET() {
  if (!isDbConfigured()) return unavailable();
  await ensureTables();
  const data = await readPlayerState();
  return NextResponse.json(data ?? defaultPlayerState());
}

export async function PUT(req: Request) {
  if (!isDbConfigured()) return unavailable();
  await ensureTables();
  const body = (await req.json()) as Record<string, unknown>;
  // Whitelist player fields; never persist unknown keys.
  const allowed = [
    'xp', 'credits', 'streak', 'lastActiveDate', 'achievements', 'equipment',
    'equipped', 'unlockedDistricts', 'muted', 'splashSeen',
    'missionsCompleted', 'bossesSlain',
  ] as const;
  const clean: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) clean[key] = body[key];
  }
  await writePlayerState(clean);
  return NextResponse.json({ ok: true });
}
