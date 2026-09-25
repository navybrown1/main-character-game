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
 *  localStorage, and sent on every API call to scope cloud saves.
 *  Returns null when no secure randomness is available: rather than minting
 *  a guessable id that could collide with another player's cloud save, the
 *  game stays local-only. */
export function getPlayerId(): string | null {
  try {
    let id = window.localStorage.getItem(PLAYER_ID_KEY);
    if (!id || !PLAYER_ID_RE.test(id)) {
      id = newPlayerId();
      if (!id) return null;
      window.localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Unguessable random id. Prefers crypto.randomUUID, falls back to
 * crypto.getRandomValues. Returns '' when neither exists, so the caller can
 * choose local-only mode instead of minting a predictable id.
 */
function newPlayerId(): string {
  try {
    // Cast through unknown: at runtime this can be an older browser or a
    // non-secure context where parts of WebCrypto are missing.
    const c = (typeof crypto !== 'undefined' ? crypto : undefined) as unknown as
      | {
          randomUUID?: () => string;
          getRandomValues?: (array: Uint8Array) => Uint8Array;
        }
      | undefined;
    if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
    if (c?.getRandomValues) {
      const bytes = c.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fall through to the empty return below
  }
  return '';
}

async function apiFetchRaw(path: string, init?: RequestInit): Promise<Response> {
  const playerId = getPlayerId();
  return fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(playerId ? { 'x-player-id': playerId } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await apiFetchRaw(path, init);
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

/** Merge a raw server snapshot over defaults into a full GameState. */
function snapshotToState(snapshot: {
  player: unknown;
  missions: unknown;
  intel: unknown;
}): GameState {
  const base = defaultGameState();
  return {
    player: { ...base.player, ...((snapshot.player ?? {}) as Partial<GameState['player']>) },
    missions: (snapshot.missions ?? {}) as GameState['missions'],
    intel: (snapshot.intel ?? {}) as GameState['intel'],
  };
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
   *  Three cases when the server answers:
   *  - No cloud row for this player: local wins outright. Legacy
   *    pre-player-id saves stamp saveSeq 0, the same as an empty cloud
   *    default, so a strict newer-wins check here would wipe them on first
   *    launch. The dirty baseline stays empty so the next flush uploads
   *    everything.
   *  - Cloud row present: higher save sequence wins, ties go to local (same
   *    lineage means identical content, and the device in hand is freshest).
   *  - Server unreachable: local-only, never touching the cloud. */
  async load(): Promise<{ state: GameState; mode: BackendMode }> {
    let serverOk = false;
    // Present only when the server answered AND holds a row for this player.
    let serverSnapshot: { player: unknown; missions: unknown; intel: unknown } | null = null;
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
      serverOk = true;
      // The state endpoint returns null (not an empty default) when this
      // player has no cloud row yet, so "no row" is distinguishable from
      // "an empty row".
      if (player !== null && player !== undefined) {
        serverSnapshot = { player, missions, intel };
      }
    } catch {
      serverOk = false;
    }
    const local = readLocal();
    if (!serverOk) {
      this.mode = 'local';
      if (local) return { state: local, mode: 'local' };
      return { state: defaultGameState(), mode: 'local' };
    }
    this.mode = 'server';
    if (!serverSnapshot) {
      this.lastSentJson = null;
      if (local) return { state: local, mode: 'server' };
      return { state: defaultGameState(), mode: 'server' };
    }
    const serverState = snapshotToState(serverSnapshot);
    // Seed the dirty-tracking baseline from what the server actually holds,
    // so the first flush after load only sends deltas instead of re-sending
    // every record.
    this.seedBaseline(serverState);
    const seq = (s: GameState | null) => s?.player.saveSeq ?? -1;
    const state = seq(local) >= seq(serverState) ? (local as GameState) : serverState;
    return { state, mode: 'server' };
  }

  /** Snapshot exactly what the server holds, for dirty-only PUTs. */
  private seedBaseline(state: GameState): void {
    this.lastSentJson = {
      player: JSON.stringify(state.player),
      missions: Object.fromEntries(
        Object.entries(state.missions).map(([k, v]) => [k, JSON.stringify(v)]),
      ),
      intel: Object.fromEntries(
        Object.entries(state.intel).map(([k, v]) => [k, JSON.stringify(v)]),
      ),
    };
  }

  /** Re-read the server snapshot into the baseline after a stale-write
   *  rejection, so the next flush diffs against the server's truth. */
  private async reseedBaseline(): Promise<void> {
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
    if (player === null || player === undefined) {
      this.lastSentJson = null;
      return;
    }
    this.seedBaseline(snapshotToState({ player, missions, intel }));
  }

  /** PUT that tolerates a 409 stale-write: another tab saved a newer
   *  generation first. Anything else non-OK still throws. */
  private async putRecord(path: string, body: string): Promise<'ok' | 'stale'> {
    const res = await apiFetchRaw(path, { method: 'PUT', body });
    if (res.status === 409) return 'stale';
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return 'ok';
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

    const doFlush = async (): Promise<void> => {
      const saveSeq = state.player.saveSeq ?? 0;
      // Records this flush actually got the server to accept. A record
      // rejected as stale stays dirty so the next flush retries it.
      const acceptedMissions: Record<string, string> = {};
      const acceptedIntel: Record<string, string> = {};

      const playerJson = JSON.stringify(state.player);
      if (!this.lastSentJson || this.lastSentJson.player !== playerJson) {
        const res = await this.putRecord('/api/state', playerJson);
        if (res === 'stale') {
          // A newer tab saved first. Rebase the baseline on the server's
          // truth; the next save re-stamps and retries against it.
          await this.reseedBaseline();
          return;
        }
      }
      for (const [missionId, progress] of Object.entries(state.missions)) {
        const progressJson = JSON.stringify(progress);
        if (!this.lastSentJson || this.lastSentJson.missions[missionId] !== progressJson) {
          const res = await this.putRecord(
            '/api/missions',
            JSON.stringify({ mission_id: missionId, ...(progress as MissionProgress), saveSeq }),
          );
          if (res === 'ok') acceptedMissions[missionId] = progressJson;
        }
      }
      for (const [gapId, clarification] of Object.entries(state.intel)) {
        const clarificationJson = JSON.stringify(clarification);
        if (!this.lastSentJson || this.lastSentJson.intel[gapId] !== clarificationJson) {
          const res = await this.putRecord(
            '/api/intel',
            JSON.stringify({ gap_id: gapId, clarification, saveSeq }),
          );
          if (res === 'ok') acceptedIntel[gapId] = clarificationJson;
        }
      }

      this.lastSentJson = {
        player: playerJson,
        missions: { ...(this.lastSentJson?.missions ?? {}), ...acceptedMissions },
        intel: { ...(this.lastSentJson?.intel ?? {}), ...acceptedIntel },
      };
    };

    try {
      // Serialize flushes across tabs sharing this player id, so a delayed
      // flush from a background tab can't interleave with a newer one. The
      // lock is best-effort: older browsers without the Web Locks API fall
      // back to a direct flush, and the server's save-sequence guard still
      // rejects stale writes with a 409.
      const locks = (navigator as Navigator & { locks?: LockManager }).locks;
      if (locks && typeof locks.request === 'function') {
        await locks.request('main-character-game-flush', () => doFlush());
      } else {
        await doFlush();
      }
    } catch {
      // Server went away mid-session: stay on local, which is already written.
      this.mode = 'local';
    }
  }

  /** Force an immediate server flush (e.g. on important events) of an
   *  already-stamped state. Serialized with every other flush through the
   *  same chain. Does NOT re-stamp: stamping happens exactly once in save(),
   *  and a second stamp here used to desync the client/server sequences. */
  async flushNow(state: GameState): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    writeLocal(state);
    this.enqueueFlush(state);
    return this.flushChain;
  }
}

export const gameStore = new GameStore();
