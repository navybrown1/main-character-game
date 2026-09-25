'use client';

import { NPCS, missionsForNpc } from '@/lib/missions';
import type { GameState } from '@/lib/game';

interface NpcPanelProps {
  state: GameState;
  onSelectMission: (missionId: string) => void;
}

const AVATAR_GLYPH: Record<string, string> = {
  tina: '\u2696',
  jenn: '\u26BD',
  dayanna: '\u2661',
  'housing-office': '\u2302',
  nydoh: '+',
  'va-office': 'VA',
};

export default function NpcPanel({ state, onSelectMission }: NpcPanelProps) {
  return (
    <div>
      <p className="panel-sub" style={{ marginTop: 0 }}>
        Contacts wired to live missions. Talk to them, then close the loop.
      </p>
      {NPCS.map((npc) => {
        const missions = missionsForNpc(npc.id);
        return (
          <div key={npc.id} className="npc-card">
            <div className="npc-avatar" aria-hidden="true">
              {AVATAR_GLYPH[npc.id] ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="npc-name">{npc.name}</div>
              <div className="npc-role">{npc.role}</div>
              <div className="npc-line">{npc.line}</div>
              <div className="npc-missions">
                {missions.map((m) => {
                  const done = state.missions[m.id]?.status === 'done';
                  return (
                    <button
                      key={m.id}
                      className="filter-chip"
                      onClick={() => onSelectMission(m.id)}
                      title={m.realWorldObjective}
                    >
                      {done ? '\u2713 ' : ''}{m.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
