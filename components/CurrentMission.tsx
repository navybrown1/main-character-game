'use client';

import { districtById, npcById, type Mission } from '@/lib/missions';
import type { MissionProgress } from '@/lib/game';

interface CurrentMissionProps {
  mission: Mission;
  progress?: MissionProgress;
  isGameMasterPick: boolean;
  onToggleStep: (missionId: string, stepIndex: number) => void;
  onComplete: (missionId: string) => void;
  onBrowse: () => void;
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CurrentMission({
  mission,
  progress,
  isGameMasterPick,
  onToggleStep,
  onComplete,
  onBrowse,
}: CurrentMissionProps) {
  const steps = mission.steps ?? [];
  const stepsDone = progress?.stepsDone ?? [];
  const allStepsDone = steps.length === 0 || steps.every((_, i) => stepsDone.includes(i));
  const nextStep = steps.find((_, i) => !stepsDone.includes(i));
  const npc = mission.npc ? npcById(mission.npc) : undefined;
  const district = districtById(mission.district);

  const tagClass =
    mission.type === 'boss' ? 'mission-type-tag boss' : mission.type === 'timed' ? 'mission-type-tag timed' : 'mission-type-tag';

  return (
    <section className="panel current-mission" aria-label="Current mission">
      <div className="panel-head">
        <span className="panel-title">{isGameMasterPick ? 'Current Mission' : 'Selected Mission'}</span>
        <span className="panel-sub">{district.name}</span>
      </div>

      <span className={tagClass}>{mission.type}</span>
      <h2>{mission.title}</h2>
      <p className="mission-brief">{mission.brief}</p>

      <div className="real-world">
        <span className="rwo-label">Real-world objective:</span>
        {mission.realWorldObjective}
      </div>

      {steps.length > 0 ? (
        <>
          <div className="next-action">
            <div>
              <span className="na-label">Next action</span>
              {nextStep ?? 'All steps done. Close it out.'}
            </div>
          </div>
          <ul className="step-list">
            {steps.map((step, i) => {
              const done = stepsDone.includes(i);
              return (
                <li
                  key={i}
                  className={`step-row${done ? ' done' : ''}`}
                  onClick={() => onToggleStep(mission.id, i)}
                  role="checkbox"
                  aria-checked={done}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleStep(mission.id, i);
                    }
                  }}
                >
                  <span className="step-box">{done ? '\u2713' : ''}</span>
                  <span className="step-text">{step}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="next-action">
          <div>
            <span className="na-label">Next action</span>
            {mission.realWorldObjective}
          </div>
        </div>
      )}

      <div className="mission-meta">
        <span className="xp-chip">+{mission.xp} XP</span>
        {mission.deadline && <span className="deadline-chip">Due {formatDeadline(mission.deadline)}</span>}
        {mission.flags?.includes('veryImportant') && <span className="flag-chip veryImportant">Very important</span>}
        {mission.flags?.includes('imperative') && <span className="flag-chip imperative">Imperative</span>}
        {npc && <span className="npc-chip">Contact: {npc.name}</span>}
      </div>

      <button className="btn btn-primary" disabled={!allStepsDone} onClick={() => onComplete(mission.id)}>
        {allStepsDone ? 'Complete mission' : `Finish ${steps.length - stepsDone.length} step${steps.length - stepsDone.length === 1 ? '' : 's'} first`}
      </button>
      <div className="skip-link">
        <button className="btn btn-ghost btn-small alt-mission-btn" onClick={onBrowse}>
          Not now, show me other missions
        </button>
      </div>
    </section>
  );
}
