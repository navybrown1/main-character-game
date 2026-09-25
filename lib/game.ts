// Game Master logic and progression systems for Operation Homestead.

import {
  DISTRICTS,
  MISSIONS,
  Mission,
  DistrictId,
} from './missions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MissionStatus = 'locked' | 'available' | 'active' | 'done';

export interface MissionProgress {
  status: MissionStatus;
  stepsDone: number[];
  completedAt: string | null;
}

export interface PlayerState {
  xp: number;
  credits: number;
  streak: number;
  lastActiveDate: string | null;
  achievements: string[];
  equipment: string[];
  equipped: string[];
  unlockedDistricts: DistrictId[];
  muted: boolean;
  splashSeen: boolean;
  missionsCompleted: number;
  bossesSlain: number;
  /** Monotonically increasing save sequence, stamped by the persistence layer.
   *  Used on load to keep whichever copy (cloud or local) is newer. */
  saveSeq: number;
}

export interface GameState {
  player: PlayerState;
  missions: Record<string, MissionProgress>;
  intel: Record<string, string>;
}

// ---------------------------------------------------------------------------
// XP, levels, titles, credits
// ---------------------------------------------------------------------------

/** XP needed to reach a given level (level 1 starts at 0). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 * (level - 1) * level / 2;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level += 1;
  return level;
}

export const TITLES: string[] = [
  'Nobody',
  'Rookie',
  'Operator',
  'Homesteader',
  'Dealmaker',
  'Vanguard',
  'Strategist',
  'Legend',
  'Main Character',
];

export function titleForLevel(level: number): string {
  if (level <= 0) return TITLES[0];
  if (level >= TITLES.length) return TITLES[TITLES.length - 1];
  return TITLES[level];
}

export function creditsForXp(xp: number): number {
  return Math.max(5, Math.round(xp / 4));
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

export interface Equipment {
  id: string;
  name: string;
  flavor: string;
  unlockLevel: number;
}

export const EQUIPMENT: Equipment[] = [
  { id: 'field-jacket', name: 'Field Jacket', flavor: 'The uniform of a man with a list.', unlockLevel: 1 },
  { id: 'tactical-clipboard', name: 'Tactical Clipboard', flavor: '+focus on paperwork missions.', unlockLevel: 2 },
  { id: 'vault-key', name: 'Vault Key', flavor: 'The Vault answers to you now.', unlockLevel: 3 },
  { id: 'coach-whistle', name: "Coach's Whistle", flavor: 'The Arena goes quiet when you blow it.', unlockLevel: 4 },
  { id: 'night-optics', name: 'Night Optics', flavor: 'See every deadline before it sees you.', unlockLevel: 5 },
  { id: 'commander-coat', name: "Commander's Coat", flavor: 'Black leather, shearling collar. Main character energy.', unlockLevel: 7 },
];

export function equipmentForLevel(level: number): Equipment[] {
  return EQUIPMENT.filter((e) => e.unlockLevel <= level);
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-blood', name: 'First Blood', desc: 'Complete your first mission.' },
  { id: 'warming-up', name: 'Warming Up', desc: 'Complete 5 missions.' },
  { id: 'on-a-roll', name: 'On a Roll', desc: 'Complete 15 missions.' },
  { id: 'homestead-hero', name: 'Homestead Hero', desc: 'Complete 30 missions.' },
  { id: 'boss-slayer', name: 'Boss Slayer', desc: 'Defeat a boss mission.' },
  { id: 'boss-hunter', name: 'Boss Hunter', desc: 'Defeat 3 boss missions.' },
  { id: 'streak-3', name: 'Three Day Fire', desc: 'Complete missions 3 days in a row.' },
  { id: 'streak-7', name: 'Full Week Operator', desc: 'Complete missions 7 days in a row.' },
  { id: 'district-clear-clinic', name: 'Clinic Cleared', desc: 'Finish every mission in The Clinic.' },
  { id: 'district-clear-campus', name: 'Campus Cleared', desc: 'Finish every mission in Campus.' },
  { id: 'district-clear-home-base', name: 'Home Base Secured', desc: 'Finish every mission in Home Base.' },
  { id: 'district-clear-vault', name: 'Vault Emptied', desc: 'Finish every mission in The Vault.' },
  { id: 'district-clear-arena', name: 'Arena Champion', desc: 'Finish every mission in The Arena.' },
  { id: 'district-clear-market', name: 'Market Swept', desc: 'Finish every mission in The Market.' },
  { id: 'district-clear-garage', name: 'Garage Master', desc: 'Finish every mission in The Garage.' },
  { id: 'all-sectors', name: 'All Sectors Open', desc: 'Unlock every district.' },
  { id: 'season-one-clear', name: 'Season One: Complete', desc: 'Finish every mission in Operation Homestead.' },
];

export const achievementById = (id: string): Achievement | undefined =>
  ACHIEVEMENTS.find((a) => a.id === id);

// ---------------------------------------------------------------------------
// District unlocks
// ---------------------------------------------------------------------------

export const OPEN_DISTRICTS: DistrictId[] = ['clinic', 'campus', 'home-base'];

export function isDistrictUnlocked(state: GameState, district: DistrictId): boolean {
  return state.player.unlockedDistricts.includes(district);
}

/** A gate mission is playable even when its district is locked. */
export function isGateMission(mission: Mission): boolean {
  const d = DISTRICTS.find((x) => x.id === mission.district);
  return d?.gateMissionId === mission.id;
}

export function isMissionPlayable(state: GameState, mission: Mission): boolean {
  if (state.missions[mission.id]?.status === 'done') return false;
  if (isDistrictUnlocked(state, mission.district)) return true;
  return isGateMission(mission);
}

// ---------------------------------------------------------------------------
// Game Master: pick the next mission
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function deadlineWithin(dateIso: string, now: number, windowMs: number): boolean {
  const t = new Date(dateIso).getTime();
  return t >= now - 24 * 60 * 60 * 1000 && t <= now + windowMs;
}

function missionRank(m: Mission): number {
  // Lower number = suggested earlier.
  if (m.flags?.includes('tutorial')) return 0;
  if (m.deadline) return 1;
  if (m.flags?.includes('imperative') || m.flags?.includes('veryImportant')) return 2;
  if (m.type === 'main' || m.type === 'boss' || m.type === 'campaign') return 3;
  if (m.type === 'quick' || m.type === 'daily') return 4;
  return 5;
}

/**
 * Game Master next-mission logic.
 * Priority: (1) tutorial first, (2) timed events with real dates within
 * 30 days, (3) veryImportant / imperative flags, (4) main missions,
 * (5) quick wins. Never fabricates urgency: only real deadlines count.
 */
export function pickNextMission(state: GameState, now: number = Date.now()): Mission | null {
  const playable = MISSIONS.filter((m) => isMissionPlayable(state, m));
  if (playable.length === 0) return null;

  // Tutorial always wins if unplayed.
  const tutorial = playable.find((m) => m.flags?.includes('tutorial'));
  if (tutorial) return tutorial;

  // Timed missions with real dates inside the 30-day window, earliest first.
  const timed = playable
    .filter((m) => m.deadline && deadlineWithin(m.deadline, now, THIRTY_DAYS_MS))
    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime());
  if (timed.length > 0) return timed[0];

  // Flagged missions: imperative / veryImportant, highest XP first.
  const flagged = playable
    .filter((m) => m.flags?.includes('imperative') || m.flags?.includes('veryImportant'))
    .sort((a, b) => b.xp - a.xp);
  if (flagged.length > 0) return flagged[0];

  // Everything else by rank, then XP.
  const rest = [...playable].sort((a, b) => {
    const r = missionRank(a) - missionRank(b);
    if (r !== 0) return r;
    return b.xp - a.xp;
  });
  return rest[0] ?? null;
}

// ---------------------------------------------------------------------------
// Completion: apply mission completion to state, return events
// ---------------------------------------------------------------------------

export interface CompletionEvents {
  xpGained: number;
  creditsGained: number;
  leveledUp: boolean;
  newLevel: number;
  newTitle: string;
  unlockedDistricts: DistrictId[];
  newAchievements: Achievement[];
  newEquipment: Equipment[];
}

export function defaultPlayerState(): PlayerState {
  return {
    xp: 0,
    credits: 0,
    streak: 0,
    lastActiveDate: null,
    achievements: [],
    equipment: ['field-jacket'],
    equipped: ['field-jacket'],
    unlockedDistricts: [...OPEN_DISTRICTS],
    muted: false,
    splashSeen: false,
    missionsCompleted: 0,
    bossesSlain: 0,
    saveSeq: 0,
  };
}

export function defaultGameState(): GameState {
  return { player: defaultPlayerState(), missions: {}, intel: {} };
}

/** Calendar-day key in the player's local timezone (not UTC), so streaks
 *  count real local days: completions on either side of UTC midnight used to
 *  increment a streak twice in one local day or miss it across a local one. */
function todayKey(now: number = Date.now()): string {
  const d = new Date(now);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function checkAchievements(state: GameState): Achievement[] {
  const earned = new Set(state.player.achievements);
  const fresh: Achievement[] = [];
  const grant = (id: string) => {
    if (!earned.has(id)) {
      earned.add(id);
      const a = achievementById(id);
      if (a) fresh.push(a);
    }
  };
  const p = state.player;
  const doneCount = p.missionsCompleted;
  if (doneCount >= 1) grant('first-blood');
  if (doneCount >= 5) grant('warming-up');
  if (doneCount >= 15) grant('on-a-roll');
  if (doneCount >= 30) grant('homestead-hero');
  if (p.bossesSlain >= 1) grant('boss-slayer');
  if (p.bossesSlain >= 3) grant('boss-hunter');
  if (p.streak >= 3) grant('streak-3');
  if (p.streak >= 7) grant('streak-7');
  for (const d of DISTRICTS) {
    const all = MISSIONS.filter((m) => m.district === d.id);
    const done = all.filter((m) => state.missions[m.id]?.status === 'done');
    if (all.length > 0 && done.length === all.length) {
      grant(`district-clear-${d.id}`);
    }
  }
  if (state.player.unlockedDistricts.length === DISTRICTS.length) grant('all-sectors');
  if (doneCount >= MISSIONS.length) grant('season-one-clear');
  return fresh;
}

/** Mark a mission complete. Mutates a deep-ish copy and returns it with events.
 *  Idempotent: completing an already-done mission returns the state unchanged
 *  with zeroed events, so a double click can never award rewards twice. */
export function completeMission(prev: GameState, missionId: string, now: number = Date.now()): { state: GameState; events: CompletionEvents } {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) throw new Error(`Unknown mission: ${missionId}`);

  if (prev.missions[missionId]?.status === 'done') {
    const level = levelForXp(prev.player.xp);
    return {
      state: prev,
      events: {
        xpGained: 0,
        creditsGained: 0,
        leveledUp: false,
        newLevel: level,
        newTitle: titleForLevel(level),
        unlockedDistricts: [],
        newAchievements: [],
        newEquipment: [],
      },
    };
  }

  const state: GameState = {
    player: { ...prev.player, achievements: [...prev.player.achievements], equipment: [...prev.player.equipment], equipped: [...prev.player.equipped], unlockedDistricts: [...prev.player.unlockedDistricts] },
    missions: { ...prev.missions },
    intel: { ...prev.intel },
  };

  state.missions[missionId] = {
    status: 'done',
    stepsDone: (mission.steps ?? []).map((_, i) => i),
    completedAt: new Date(now).toISOString(),
  };

  const oldLevel = levelForXp(state.player.xp);
  const xpGained = mission.xp;
  const creditsGained = creditsForXp(mission.xp);
  state.player.xp += xpGained;
  state.player.credits += creditsGained;
  state.player.missionsCompleted += 1;
  if (mission.type === 'boss') state.player.bossesSlain += 1;

  // Streak: consecutive calendar days with at least one completion.
  const today = todayKey(now);
  const last = state.player.lastActiveDate;
  if (last !== today) {
    const yesterday = todayKey(now - 24 * 60 * 60 * 1000);
    state.player.streak = last === yesterday ? state.player.streak + 1 : 1;
    state.player.lastActiveDate = today;
  }

  // District unlock via gate mission.
  const district = DISTRICTS.find((d) => d.gateMissionId === missionId);
  const unlockedDistricts: DistrictId[] = [];
  if (district && !state.player.unlockedDistricts.includes(district.id)) {
    state.player.unlockedDistricts.push(district.id);
    unlockedDistricts.push(district.id);
  }

  const newLevel = levelForXp(state.player.xp);
  const leveledUp = newLevel > oldLevel;

  // Equipment unlocks by level.
  const before = new Set(equipmentForLevel(oldLevel).map((e) => e.id));
  const newEquipment = equipmentForLevel(newLevel).filter((e) => !before.has(e.id));
  for (const e of newEquipment) {
    if (!state.player.equipment.includes(e.id)) state.player.equipment.push(e.id);
  }

  const newAchievements = checkAchievements(state);
  for (const a of newAchievements) {
    if (!state.player.achievements.includes(a.id)) state.player.achievements.push(a.id);
  }

  return {
    state,
    events: {
      xpGained,
      creditsGained,
      leveledUp,
      newLevel,
      newTitle: titleForLevel(newLevel),
      unlockedDistricts,
      newAchievements,
      newEquipment,
    },
  };
}

/** Toggle a step on a multi-step mission. Returns updated state. */
export function toggleStep(prev: GameState, missionId: string, stepIndex: number): GameState {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission || !mission.steps) return prev;
  const current = prev.missions[missionId] ?? { status: 'available' as MissionStatus, stepsDone: [], completedAt: null };
  const stepsDone = current.stepsDone.includes(stepIndex)
    ? current.stepsDone.filter((s) => s !== stepIndex)
    : [...current.stepsDone, stepIndex];
  return {
    ...prev,
    missions: {
      ...prev.missions,
      [missionId]: {
        status: current.status === 'done' ? 'done' : stepsDone.length > 0 ? 'active' : 'available',
        stepsDone,
        completedAt: current.completedAt,
      },
    },
  };
}
