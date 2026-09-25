// Server-only helper: validate the per-browser player id sent by the client.
// No login system; the id is a random unguessable string generated once in
// the browser, and it scopes every cloud save to its owner.
import { NextResponse } from 'next/server';

const PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function getPlayerId(req: Request): string | null {
  const id = req.headers.get('x-player-id')?.trim() ?? '';
  return PLAYER_ID_RE.test(id) ? id : null;
}

export function missingPlayerId() {
  return NextResponse.json(
    { ok: false, error: 'missing or invalid player id' },
    { status: 401 },
  );
}
