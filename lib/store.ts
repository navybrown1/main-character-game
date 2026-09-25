// Persistence layer: storage interface with two backends.
// Server backend: @vercel/postgres via the /api routes, used when the API
// answers (which requires POSTGRES_URL / DATABASE_URL on the server).
// Client fallback: localStorage, so the game is fully playable single-device.
// The game works in both modes without code changes.

'use client';

import { defaultGameState, type GameState, type MissionProgress } from './game';

const LS_KEY = 'main-character-homestead-v1';

export type BackendMode = 'server' | 'local';

interface SavePayload {
  player: GameState['player'];
  missions: GameState['missions'];
  intel: GameState['intel'];
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res;
}

function readLocal(): GameState | null {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavePayload;
    const base = defaultGameState();
    return {
      player: { ...base.player, ...parsed.player },
      missions: parsed.missions ?? {},
      intel: parsed.intel ?? {},
    };
  } catch {
    return null;
  }
}

function writeLocal(state: GameState): void {
  try {
    const payload: SavePayload = {
      player: state.player,
      missions: state.missions,
      intel: state.intel,
    };
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable; the in-memory state still works.
  }
}

export class GameStore {
  mode: BackendMode = 'local';
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: GameState | null = null;

  /** Load state, trying the server first, then localStorage, then defaults. */
  async load(): Promise<{ state: GameState; mode: BackendMode }> {
    // Try server.
    try {
      const [pRes, mRes, iRes] = await Promise.all([
        apiFetch('/api/state'),
        apiFetch('/api/missions'),
        apiFetch('/api/intel'),
      ]);
      const [player, missions, intel] = await Promise.all([
        pRes.json(),
        mRes.json(),
        iRes.json(),
      ]);
      const base = defaultGameState();
      const state: GameState = {
        player: { ...base.player, ...(player ?? {}) },
        missions: (missions ?? {}) as GameState['missions'],
        intel: (intel ?? {}) as GameState['intel'],
      };
      this.mode = 'server';
      return { state, mode: 'server' };
    } catch {
      // Fall through to local.
    }
    const local = readLocal();
    if (local) {
      this.mode = 'local';
      return { state: local, mode: 'local' };
    }
    this.mode = 'local';
    return { state: defaultGameState(), mode: 'local' };
  }

  /** Debounced save: safe to call on every state change. */
  save(state: GameState): void {
    this.pending = state;
    writeLocal(state);
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const snapshot = this.pending;
      this.pending = null;
      if (snapshot) void this.flush(snapshot);
    }, 800);
  }

  private async flush(state: GameState): Promise<void> {
    if (this.mode !== 'server') return;
    try {
      await Promise.all([
        apiFetch('/api/state', { method: 'PUT', body: JSON.stringify(state.player) }),
        ...Object.entries(state.missions).map(([missionId, progress]) =>
          apiFetch('/api/missions', {
            method: 'PUT',
            body: JSON.stringify({ mission_id: missionId, ...(progress as MissionProgress) }),
          }),
        ),
        ...Object.entries(state.intel).map(([gapId, clarification]) =>
          apiFetch('/api/intel', { method: 'PUT', body: JSON.stringify({ gap_id: gapId, clarification }) }),
        ),
      ]);
    } catch {
      // Server went away mid-session: stay on local, which is already written.
      this.mode = 'local';
    }
  }

  /** Force an immediate server flush (e.g. on important events). */
  async flushNow(state: GameState): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.pending = null;
    }
    writeLocal(state);
    await this.flush(state);
  }
}

export const gameStore = new GameStore();
