# MAIN CHARACTER: Operation Homestead

Season 1 of a first-person productivity RPG built from Edwin Brown's real to-do list
(his 100 most recent Mac notes, consolidated into 61 missions across 7 districts).
Every mission completed in game moves real life forward. This is not a dashboard
with points: Edwin is the visible hero, with mission markers, an interactive world
map, districts, NPCs, equipment, boss encounters, XP/levels, achievements, and a
completion loop that visibly changes the world.

## Run it

Requirements: Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The game drops straight into the current mission:
Edwin's hero card, the Game Master's pick, the concrete next action, and the
completion control. An optional skippable key-art intro shows once on first visit.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `POSTGRES_URL` (or `DATABASE_URL`) | No | Enables the server-side `@vercel/postgres` backend. When unset, or when the API is unreachable, the game runs fully on browser `localStorage` with zero code changes. |

Copy `.env.example` to `.env.local` and fill in `POSTGRES_URL` to enable cloud saves.

## Persistence

`lib/store.ts` exposes one storage interface with two backends:

- **Server** (`lib/db.ts`, `@vercel/postgres`): used when `POSTGRES_URL`/`DATABASE_URL`
  is set. API routes: `GET`+`PUT /api/state` (player: xp, level, credits, streaks,
  unlocks, achievements, equipment, mute pref), `GET`+`PUT /api/missions`
  (per-mission progress: status, steps done), `GET`+`PUT /api/intel`
  (intel gap clarifications). Tables are created automatically on first use.
- **Local** (browser `localStorage`): full fallback, game fully playable single-device.

Writes are debounced; mission completions flush immediately. The HUD shows
`cloud save` or `local save` so the active mode is always visible.

### Migrations

```bash
npm run db:migrate   # psql "$POSTGRES_URL" -f db/migrations/001_init.sql
```

Tables: `player_state` (single row, id = 1), `mission_progress`
(mission_id PK, status, steps_done JSONB, completed_at), `intel_resolutions`
(gap_id PK, clarification).

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel (or `vercel` from the CLI).
2. Add a Postgres database (Vercel Postgres / Neon) and set `POSTGRES_URL`.
   Without it, the app still deploys and runs on localStorage saves.
3. `npm run build` must pass; it does. No server-only Node APIs in client
   components (`lib/db.ts` is imported only by API routes).

## Project layout

- `app/` - App Router pages, API routes, `globals.css` (hand-written, no Tailwind)
- `components/` - HUD, HeroCard, CurrentMission, WorldMap, MissionLog, NpcPanel,
  GearPanel, IntelPanel, Overlays (splash, victory, toasts), GameShell
- `lib/missions.ts` - the full mission dataset (districts, missions, NPCs, intel gaps)
- `lib/game.ts` - Game Master `pickNextMission`, XP/levels/titles, equipment,
  achievements, completion logic, district unlocks
- `lib/store.ts` - persistence interface (server-first, localStorage fallback)
- `lib/db.ts` - server-only Postgres access
- `lib/audio.ts` - Web Audio synthesized SFX (zero external audio files)
- `public/assets/` - hero portrait, key art, world map
- `db/migrations/001_init.sql` - schema

## Game rules worth knowing

- Only the two periodontist dates (Nov 12 and Nov 19, 12:30) are real deadlines.
  Nothing else in the game claims a date.
- 7 intel gaps from the notes are surfaced as unresolved; the game never guesses
  what they mean, but the player can save their own clarifications.
- District unlock order: Clinic, Campus, and Home Base start open. The Vault,
  Arena, Market, and Garage are breached by completing their gate missions
  (Card Recon, Roster Invitation, Supply Run Alpha, Systems Green).
- Game Master priority: tutorial, then timed missions within 30 days, then
  veryImportant/imperative flags, then main missions, then quick wins.
