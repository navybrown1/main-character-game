'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hud from './Hud';
import HeroCard from './HeroCard';
import CurrentMission from './CurrentMission';
import WorldMap from './WorldMap';
import MissionLog from './MissionLog';
import NpcPanel from './NpcPanel';
import GearPanel from './GearPanel';
import IntelPanel from './IntelPanel';
import { Splash, ToastStack, VictoryOverlay, type Toast } from './Overlays';
import { MISSIONS, missionById, type DistrictId, type Mission } from '@/lib/missions';
import {
  completeMission as applyCompletion,
  defaultGameState,
  isMissionPlayable,
  levelForXp,
  pickNextMission,
  titleForLevel,
  toggleStep as applyToggleStep,
  type CompletionEvents,
  type GameState,
} from '@/lib/game';
import { gameStore, type BackendMode } from '@/lib/store';
import {
  setMuted,
  sfxBlip,
  sfxBossDown,
  sfxEquip,
  sfxLevelUp,
  sfxPanel,
  sfxSelect,
  sfxStep,
  sfxUnlock,
  sfxVictory,
  startAmbient,
} from '@/lib/audio';

type Tab = 'map' | 'missions' | 'npcs' | 'gear' | 'intel';

const MOTES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 67 + 11) % 100}%`,
  duration: `${9 + ((i * 37) % 14)}s`,
  delay: `${-((i * 53) % 20)}s`,
}));

let toastId = 0;

export default function GameShell() {
  const [state, setState] = useState<GameState | null>(null);
  const [mode, setMode] = useState<BackendMode>('local');
  const [tab, setTab] = useState<Tab>('map');
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const [victory, setVictory] = useState<{ mission: Mission; events: CompletionEvents } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const stateRef = useRef<GameState>(defaultGameState());
  stateRef.current = state ?? stateRef.current;

  useEffect(() => {
    let cancelled = false;
    gameStore.load().then(({ state: loaded, mode: m }) => {
      if (cancelled) return;
      setState(loaded);
      setMode(m);
      setMuted(loaded.player.muted);
      if (!loaded.player.splashSeen) setShowSplash(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pushToast = useCallback((text: string) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3600);
  }, []);

  const persist = useCallback((next: GameState) => {
    setState(next);
    gameStore.save(next);
  }, []);

  const gmPick = useMemo(
    () => (state ? pickNextMission(state) : null),
    [state],
  );

  const currentMission: Mission | null = useMemo(() => {
    if (!state) return null;
    if (selectedMissionId) {
      const m = missionById(selectedMissionId);
      if (m && isMissionPlayable(state, m)) return m;
    }
    return gmPick;
  }, [state, selectedMissionId, gmPick]);

  const isGmPick = currentMission?.id === gmPick?.id;

  // ------------------------------------------------------------ actions
  const handleToggleStep = useCallback(
    (missionId: string, stepIndex: number) => {
      sfxStep();
      persist(applyToggleStep(stateRef.current, missionId, stepIndex));
    },
    [persist],
  );

  const handleComplete = useCallback(
    (missionId: string) => {
      const mission = missionById(missionId);
      if (!mission) return;
      const { state: next, events } = applyCompletion(stateRef.current, missionId);
      setSelectedMissionId(null);
      persist(next);
      void gameStore.flushNow(next);

      sfxVictory();
      if (mission.type === 'boss') window.setTimeout(() => sfxBossDown(), 500);
      if (events.leveledUp) window.setTimeout(() => sfxLevelUp(), 900);
      if (events.unlockedDistricts.length > 0) window.setTimeout(() => sfxUnlock(), 1300);
      setVictory({ mission, events });

      const level = levelForXp(next.player.xp);
      pushToast(`+${events.xpGained} XP, +${events.creditsGained} credits. LV ${level} ${titleForLevel(level)}.`);
    },
    [persist, pushToast],
  );

  const handleToggleMute = useCallback(() => {
    const next: GameState = {
      ...stateRef.current,
      player: { ...stateRef.current.player, muted: !stateRef.current.player.muted },
    };
    setMuted(next.player.muted);
    persist(next);
    if (!next.player.muted) sfxBlip();
  }, [persist]);

  const handleEquip = useCallback(
    (equipmentId: string) => {
      sfxEquip();
      const next: GameState = {
        ...stateRef.current,
        player: { ...stateRef.current.player, equipped: [equipmentId] },
      };
      persist(next);
      pushToast('Gear equipped.');
    },
    [persist, pushToast],
  );

  const handleIntelSave = useCallback(
    (gapId: string, clarification: string) => {
      const next: GameState = {
        ...stateRef.current,
        intel: { ...stateRef.current.intel, [gapId]: clarification },
      };
      persist(next);
      sfxSelect();
      pushToast('Intel clarification saved.');
    },
    [persist, pushToast],
  );

  const handleSelectMission = useCallback(
    (missionId: string) => {
      const m = missionById(missionId);
      if (!m || !isMissionPlayable(stateRef.current, m)) return;
      sfxSelect();
      setSelectedMissionId(missionId);
      setSelectedDistrict(m.district);
    },
    [],
  );

  const handleTab = useCallback((t: Tab) => {
    sfxPanel();
    setTab(t);
  }, []);

  const handleEnter = useCallback(() => {
    startAmbient();
    sfxSelect();
    setShowSplash(false);
    const next: GameState = {
      ...stateRef.current,
      player: { ...stateRef.current.player, splashSeen: true },
    };
    persist(next);
  }, [persist]);

  const seasonDone = state !== null && MISSIONS.every((m) => state.missions[m.id]?.status === 'done');

  // ------------------------------------------------------------ render
  if (!state) {
    return (
      <div className="loading-screen">
        <div className="loading-ring" />
        <div>Loading the Homestead...</div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'map', label: 'World Map' },
    {
      id: 'missions',
      label: 'Missions',
      count: MISSIONS.filter((m) => state.missions[m.id]?.status === 'done').length,
    },
    { id: 'npcs', label: 'Contacts' },
    {
      id: 'gear',
      label: 'Loadout',
      count: state.player.achievements.length,
    },
    { id: 'intel', label: 'Intel' },
  ];

  return (
    <div className="game-root">
      <div className="ambient-field" aria-hidden="true">
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="ambient-mote"
            style={{ left: m.left, animationDuration: m.duration, animationDelay: m.delay }}
          />
        ))}
      </div>

      <Hud player={state.player} mode={mode} onToggleMute={handleToggleMute} />

      <main className="game-main">
        <div className="col-stack">
          <HeroCard player={state.player} />
          {seasonDone ? (
            <section className="panel current-mission" aria-label="Season complete">
              <div className="panel-head">
                <span className="panel-title">Season One: Complete</span>
              </div>
              <h2>The Homestead Holds</h2>
              <p className="mission-brief">
                Every mission done. Every district clear. Edwin Brown, main character, season one in the books.
              </p>
              <div className="real-world">
                <span className="rwo-label">Real-world objective:</span>
                Enjoy it. Then start season two.
              </div>
            </section>
          ) : currentMission ? (
            <CurrentMission
              mission={currentMission}
              progress={state.missions[currentMission.id]}
              isGameMasterPick={isGmPick}
              onToggleStep={handleToggleStep}
              onComplete={handleComplete}
              onBrowse={() => handleTab('missions')}
            />
          ) : null}
        </div>

        <div className="col-stack">
          <div className="tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`tab-btn${tab === t.id ? ' active' : ''}`}
                onClick={() => handleTab(t.id)}
              >
                {t.label}
                {typeof t.count === 'number' && <span className="tab-count">{t.count}</span>}
              </button>
            ))}
          </div>

          {tab === 'map' && (
            <section className="panel" aria-label="World map">
              <div className="panel-head">
                <span className="panel-title">World Map</span>
                <span className="panel-sub">The Homestead and its districts</span>
              </div>
              <WorldMap
                state={state}
                selectedDistrict={selectedDistrict}
                onSelectDistrict={(d) => {
                  sfxBlip();
                  setSelectedDistrict(d);
                }}
                onSelectMission={handleSelectMission}
              />
            </section>
          )}

          {tab === 'missions' && (
            <section className="panel" aria-label="Mission log">
              <div className="panel-head">
                <span className="panel-title">Mission Log</span>
                <span className="panel-sub">Every open loop, one list</span>
              </div>
              <MissionLog state={state} selectedId={selectedMissionId} onSelect={handleSelectMission} />
            </section>
          )}

          {tab === 'npcs' && (
            <section className="panel" aria-label="Contacts">
              <div className="panel-head">
                <span className="panel-title">Contacts</span>
                <span className="panel-sub">People wired to the mission</span>
              </div>
              <NpcPanel state={state} onSelectMission={handleSelectMission} />
            </section>
          )}

          {tab === 'gear' && (
            <section className="panel" aria-label="Loadout">
              <div className="panel-head">
                <span className="panel-title">Loadout</span>
                <span className="panel-sub">Gear and achievements</span>
              </div>
              <GearPanel player={state.player} onEquip={handleEquip} />
            </section>
          )}

          {tab === 'intel' && (
            <section className="panel" aria-label="Intel">
              <div className="panel-head">
                <span className="panel-title">Intel</span>
                <span className="panel-sub">Unresolved, until you say otherwise</span>
              </div>
              <IntelPanel intel={state.intel} onSave={handleIntelSave} />
            </section>
          )}
        </div>
      </main>

      {showSplash && <Splash onEnter={handleEnter} />}
      {victory && (
        <VictoryOverlay
          mission={victory.mission}
          events={victory.events}
          onContinue={() => setVictory(null)}
        />
      )}
      <ToastStack toasts={toasts} />
    </div>
  );
}
