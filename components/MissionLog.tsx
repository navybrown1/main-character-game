'use client';

import { useMemo, useState } from 'react';
import { DISTRICTS, MISSIONS, districtById, type DistrictId, type MissionType } from '@/lib/missions';
import { isMissionPlayable, type GameState } from '@/lib/game';

interface MissionLogProps {
  state: GameState;
  selectedId: string | null;
  onSelect: (missionId: string) => void;
}

type StatusFilter = 'all' | 'open' | 'done';

export default function MissionLog({ state, selectedId, onSelect }: MissionLogProps) {
  const [district, setDistrict] = useState<DistrictId | 'all'>('all');
  const [type, setType] = useState<MissionType | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const types = useMemo(() => {
    const set = new Set<MissionType>();
    MISSIONS.forEach((m) => set.add(m.type));
    return [...set];
  }, []);

  const rows = useMemo(() => {
    return MISSIONS.filter((m) => {
      if (district !== 'all' && m.district !== district) return false;
      if (type !== 'all' && m.type !== type) return false;
      const done = state.missions[m.id]?.status === 'done';
      if (status === 'done' && !done) return false;
      if (status === 'open' && done) return false;
      if (!isMissionPlayable(state, m)) return false;
      return true;
    }).sort((a, b) => {
      const da = state.missions[a.id]?.status === 'done' ? 1 : 0;
      const db = state.missions[b.id]?.status === 'done' ? 1 : 0;
      return da - db || b.xp - a.xp;
    });
  }, [state, district, type, status]);

  const doneCount = MISSIONS.filter((m) => state.missions[m.id]?.status === 'done').length;

  return (
    <div>
      <div className="filter-row" role="group" aria-label="Filter by district">
        <button className={`filter-chip${district === 'all' ? ' active' : ''}`} onClick={() => setDistrict('all')}>
          All districts
        </button>
        {DISTRICTS.map((d) => (
          <button
            key={d.id}
            className={`filter-chip${district === d.id ? ' active' : ''}`}
            onClick={() => setDistrict(d.id)}
          >
            {d.name}
          </button>
        ))}
      </div>
      <div className="filter-row" role="group" aria-label="Filter by type">
        <button className={`filter-chip${type === 'all' ? ' active' : ''}`} onClick={() => setType('all')}>
          All types
        </button>
        {types.map((t) => (
          <button key={t} className={`filter-chip${type === t ? ' active' : ''}`} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="filter-row" role="group" aria-label="Filter by status">
        {(['all', 'open', 'done'] as StatusFilter[]).map((s) => (
          <button key={s} className={`filter-chip${status === s ? ' active' : ''}`} onClick={() => setStatus(s)}>
            {s === 'all' ? 'All' : s === 'open' ? 'Open' : 'Done'}
          </button>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="empty-note">No missions match. Locked districts hide until you breach them.</p>
      )}

      {rows.map((m) => {
        const done = state.missions[m.id]?.status === 'done';
        const d = districtById(m.district);
        return (
          <button
            key={m.id}
            className={`mission-row${done ? ' is-done' : ''}${selectedId === m.id ? ' selected' : ''}`}
            onClick={() => onSelect(m.id)}
          >
            <span className={`mrow-type ${m.type === 'boss' || m.type === 'timed' || m.type === 'main' ? m.type : ''}`}>
              {m.type}
            </span>
            <span className="mrow-body">
              <span className="mrow-title">{done ? '\u2713 ' : ''}{m.title}</span>
              <span className="mrow-sub">
                {d.name} &middot; {m.realWorldObjective}
              </span>
            </span>
            <span className="mrow-xp">+{m.xp}</span>
          </button>
        );
      })}

      <div className="progress-strip">
        <span><b>{doneCount}</b> of {MISSIONS.length} missions complete</span>
      </div>
    </div>
  );
}
