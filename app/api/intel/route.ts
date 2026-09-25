import { NextResponse } from 'next/server';
import { ensureTables, isDbConfigured, readIntel, writeIntel } from '@/lib/db';

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
  const data = await readIntel();
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  if (!isDbConfigured()) return unavailable();
  await ensureTables();
  const body = (await req.json()) as { gap_id?: unknown; clarification?: unknown };
  const gapId = typeof body.gap_id === 'string' ? body.gap_id : '';
  const clarification = typeof body.clarification === 'string' ? body.clarification.slice(0, 2000) : '';
  if (!gapId) {
    return NextResponse.json({ ok: false, error: 'gap_id required' }, { status: 400 });
  }
  await writeIntel(gapId, clarification);
  return NextResponse.json({ ok: true });
}
