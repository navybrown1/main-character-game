// Persistence layer: storage interface with two backends.
// Server backend: @vercel/postgres via the /api routes, used when the API
// answers (which requires POSTGRES_URL / DATABASE_URL on the server).
// Client fallback: localStorage, so the game is fully playable single-device.
// The game works in both modes without code changes.
//
// Cloud saves are scoped per browser by a random player id sent on every API
// call (x-player-id). No login system; the id is unguessable, so one player's
// saves cannot be read or overwritten by another visitor.

'use client';

import { defaultGameState, type GameState, type MissionProgress } from './game';

const LS_KEY = 'main-character-homestead-v1';
const PLAYER_ID_KEY = 'main-character-player-id';
const PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export type BackendMode = 'server' | 'local';

interface SavePayload {
  player: GameState['player'];
  missions: GameState['missions'];
  intel: GameState['intel'];
}

/** Stable random per-browser player id. Generated once, stored in
 *  localStorage, and sent on every API call to scope cloud saves. */
export function getPlayerId(): string | null {
  try {
    let id = window.localStorage.getItem(PLAYER_ID_KEY);
    if (!id || !PLAYER_ID_RE.test(id)) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID().replace(/-/g, '')
          : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`;
      window.localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const playerId = getPlayerId();
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(playerId ? { 'x-player-id': playerId } : {}),
      ...(init?.headers ?? {}),
    },
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
  /** All flushes run through this chain so an older snapshot can never
   *  finish after a newer one and roll progress back. */
  private flushChain: Promise<void> = Promise.resolve();
  /** JSON snapshot of exactly what the server last acknowledged, so saves
   *  only send records that actually changed. */
  private lastSentJson: {
    player: string;
    missions: Record<string, string>;
    intel: Record<string, string>;
  } | null = null;

  /** Load state, trying the server first, then localStorage, then defaults.
   *  When both cloud and local copies exist, the one with the higher save
   *  sequence wins, so a stale cloud copy can never clobber newer local
   *  progress (e.g. after closing the tab mid-flush). */
  async load(): Promise<{ state: GameState; mode: BackendMode }> {
    let serverState: GameState | null = null;
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
      serverState = {
        player: { ...base.player, ...(player ?? {}) },
        missions: (missions ?? {}) as GameState['missions'],
        intel: (intel ?? {}) as GameState['intel'],
      };
    } catch {
      serverState = null;
    }
    const local = readLocal();
    if (serverState) {
      this.mode = 'server';
      const seq = (s: GameState | null) => s?.player.saveSeq ?? -1;
      const state = seq(local) > seq(serverState) ? (local as GameState) : serverState;
      return { state, mode: 'server' };
    }
    if (local) {
      this.mode = 'local';
      return { state: local, mode: 'local' };
    }
    this.mode = 'local';
    return { state: defaultGameState(), mode: 'local' };
  }

  /** Debounced save: safe to call on every state change.
   *  Stamps a monotonically increasing save sequence and returns the
   *  stamped state so callers keep one consistent copy. */
  save(state: GameState): GameState {
    const stamped: GameState = {
      ...state,
      player: { ...state.player, saveSeq: (state.player.saveSeq ?? 0) + 1 },
    };
    this.pending = stamped;
    writeLocal(stamped);
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        this.enqueueFlush();
      }, 800);
    }
    return stamped;
  }

  private enqueueFlush(state?: GameState): void {
    if (state) this.pending = state;
    this.flushChain = this.flushChain.then(() => this.flushLatest()).catch(() => {
      // flushLatest already handles its own errors; never break the chain.
    });
  }

  private async flushLatest(): Promise<void> {
    const state = this.pending;
    this.pending = null;
    if (!state || this.mode !== 'server') return;

    const requests: Promise<Response>[] = [];
    const playerJson = JSON.stringify(state.player);
    if (!this.lastSentJson || this.lastSentJson.player !== playerJson) {
      requests.push(apiFetch('/api/state', { method: 'PUT', body: playerJson }));
    }
    for (const [missionId, progress] of Object.entries(state.missions)) {
      const progressJson = JSON.stringify(progress);
      if (!this.lastSentJson || this.lastSentJson.missions[missionId] !== progressJson) {
        requests.push(
          apiFetch('/api/missions', {
            method: 'PUT',
            body: JSON.stringify({ mission_id: missionId, ...(progress as MissionProgress) }),
          }),
        );
      }
    }
    for (const [gapId, clarification] of Object.entries(state.intel)) {
      const clarificationJson = JSON.stringify(clarification);
      if (!this.lastSentJson || this.lastSentJson.intel[gapId] !== clarificationJson) {
        requests.push(
          apiFetch('/api/intel', {
            method: 'PUT',
            body: JSON.stringify({ gap_id: gapId, clarification }),
          }),
        );
      }
    }

    try {
      await Promise.all(requests);
      // Remember exactly what the server now holds.
      this.lastSentJson = {
        player: playerJson,
        missions: Object.fromEntries(
          Object.entries(state.missions).map(([k, v]) => [k, JSON.stringify(v)]),
        ),
        intel: Object.fromEntries(
          Object.entries(state.intel).map(([k, v]) => [k, JSON.stringify(v)]),
        ),
      };
    } catch {
      // Server went away mid-session: stay on local, which is already written.
      this.mode = 'local';
    }
  }

  /** Force an immediate server flush (e.g. on important events). Serialized
   *  with every other flush through the same chain. */
  async flushNow(state: GameState): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const stamped: GameState = {
      ...state,
      player: { ...state.player, saveSeq: (state.player.saveSeq ?? 0) + 1 },
    };
    writeLocal(stamped);
    this.enqueueFlush(stamped);
    return this.flushChain;
  }
}

export const gameStore = new GameStore();
