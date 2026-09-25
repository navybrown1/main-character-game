'use client';

import { useRef, useState } from 'react';
import { DISTRICTS, MISSIONS, missionsForDistrict, type DistrictId } from '@/lib/missions';
import { isDistrictUnlocked, type GameState } from '@/lib/game';

interface WorldMapProps {
  state: GameState;
  selectedDistrict: DistrictId | null;
  onSelectDistrict: (d: DistrictId) => void;
  onSelectMission: (missionId: string) => void;
}

const PIN_GLYPH: Record<DistrictId, string> = {
  clinic: '+',
  campus: '\u0394',
  'home-base': '\u2302',
  vault: '$',
  arena: '\u2694',
  market: '\u25C8',
  garage: '\u2699',
};

export default function WorldMap({ state, selectedDistrict, onSelectDistrict, onSelectMission }: WorldMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [hoverDistrict, setHoverDistrict] = useState<DistrictId | null>(null);

  function handleParallax(e: React.PointerEvent<HTMLDivElement>) {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const rect = wrap.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    inner.style.transform = `scale(1.06) translate(${-px * 18}px, ${-py * 14}px)`;
  }

  function resetParallax() {
    const inner = innerRef.current;
    if (inner) inner.style.transform = 'scale(1) translate(0, 0)';
  }

  const active = selectedDistrict ?? hoverDistrict;

  return (
    <div>
      <div
        className="map-wrap"
        ref={wrapRef}
        onPointerMove={handleParallax}
        onPointerLeave={() => {
          resetParallax();
          setHoverDistrict(null);
        }}
      >
        <div className="map-inner" ref={innerRef}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="map-bg" src="/assets/world-map.webp" alt="Tactical map of the Homestead" draggable={false} />
          <div className="map-fog" />
          {DISTRICTS.map((d) => {
            const unlocked = isDistrictUnlocked(state, d.id);
            const missions = missionsForDistrict(d.id);
            const done = missions.filter((m) => state.missions[m.id]?.status === 'done').length;
            const cleared = done === missions.length;
            const cls = [
              'map-marker',
              unlocked ? '' : 'locked',
              cleared && unlocked ? 'done-district' : '',
              active === d.id ? 'active-district' : '',
            ].join(' ');
            return (
              <button
                key={d.id}
                className={cls}
                style={{ left: `${d.mapX}%`, top: `${d.mapY}%` }}
                onClick={() => onSelectDistrict(d.id)}
                onPointerEnter={() => setHoverDistrict(d.id)}
                aria-label={`${d.name}${unlocked ? `, ${done} of ${missions.length} missions complete` : ', locked'}`}
                title={unlocked ? `${d.name}: ${done}/${missions.length} done` : `${d.name}: locked`}
              >
                <span className="pin">{unlocked ? PIN_GLYPH[d.id] : '\uD83D\uDD12'}</span>
                <span className="pin-label">{d.name}</span>
                {unlocked && (
                  <span className="pin-count">
                    {done}/{missions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="map-legend">
        <span><span className="legend-dot" style={{ background: 'var(--gold)' }} /> Active district</span>
        <span><span className="legend-dot" style={{ background: 'var(--green)' }} /> Cleared</span>
        <span><span className="legend-dot" style={{ background: '#555' }} /> Locked: finish its breach mission</span>
      </div>

      {active && (
        <DistrictDetail
          districtId={active}
          state={state}
          onSelectMission={onSelectMission}
        />
      )}
    </div>
  );
}

function DistrictDetail({
  districtId,
  state,
  onSelectMission,
}: {
  districtId: DistrictId;
  state: GameState;
  onSelectMission: (id: string) => void;
}) {
  const d = DISTRICTS.find((x) => x.id === districtId);
  if (!d) return null;
  const unlocked = isDistrictUnlocked(state, districtId);
  const missions = missionsForDistrict(districtId);
  const visible = unlocked ? missions : missions.filter((m) => d.gateMissionId === m.id);
  const gate = d.gateMissionId ? MISSIONS.find((m) => m.id === d.gateMissionId) : undefined;

  return (
    <div className="district-detail panel">
      <h3>{d.name}</h3>
      <p className="tagline">{d.tagline}</p>
      {!unlocked && gate && (
        <p className="mission-brief">
          Locked sector. Breach it by completing: <b>{gate.title}</b>
        </p>
      )}
      {visible.map((m) => {
        const done = state.missions[m.id]?.status === 'done';
        return (
          <button
            key={m.id}
            className={`mission-row${done ? ' is-done' : ''}`}
            onClick={() => onSelectMission(m.id)}
          >
            <span className={`mrow-type ${m.type === 'boss' || m.type === 'timed' || m.type === 'main' ? m.type : ''}`}>
              {m.type}
            </span>
            <span className="mrow-body">
              <span className="mrow-title">{done ? '\u2713 ' : ''}{m.title}</span>
              <span className="mrow-sub">{m.realWorldObjective}</span>
            </span>
            <span className="mrow-xp">+{m.xp}</span>
          </button>
        );
      })}
    </div>
  );
}
