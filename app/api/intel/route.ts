import { NextResponse } from 'next/server';
import { ensureTables, isDbConfigured, readIntel, writeIntel } from '@/lib/db';
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
  const data = await readIntel(playerId);
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  if (!isDbConfigured()) return unavailable();
  const playerId = getPlayerId(req);
  if (!playerId) return missingPlayerId();
  await ensureTables();
  const body = (await req.json()) as { gap_id?: unknown; clarification?: unknown; saveSeq?: unknown };
  const gapId = typeof body.gap_id === 'string' ? body.gap_id : '';
  const clarification = typeof body.clarification === 'string' ? body.clarification.slice(0, 2000) : '';
  if (!gapId) {
    return NextResponse.json({ ok: false, error: 'gap_id required' }, { status: 400 });
  }
  // Same stale-write guard as missions: a delayed background-tab flush must
  // not overwrite a newer tab's save.
  const saveSeq = typeof body.saveSeq === 'number' ? body.saveSeq : -1;
  const result = await writeIntel(playerId, gapId, clarification, saveSeq);
  if (result === 'stale') {
    return NextResponse.json({ ok: false, error: 'stale-write' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
