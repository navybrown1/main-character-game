'use client';

import { levelForXp, titleForLevel, xpForLevel, type PlayerState } from '@/lib/game';
import type { BackendMode } from '@/lib/store';

interface HudProps {
  player: PlayerState;
  mode: BackendMode;
  onToggleMute: () => void;
}

export default function Hud({ player, mode, onToggleMute }: HudProps) {
  const level = levelForXp(player.xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = next > cur ? Math.min(100, Math.round(((player.xp - cur) / (next - cur)) * 100)) : 100;

  return (
    <header className="hud">
      <div className="hud-brand">
        <span className="mc">Main Character</span>
        <span className="season">S1: Operation Homestead</span>
      </div>
      <div className="hud-mid">
        <div className="hud-level-line">
          <span className="hud-level">LV {level}</span>
          <span className="hud-title">{titleForLevel(level)}</span>
          <span className="hud-title">
            {player.xp} XP{next > player.xp ? ` / ${next} XP` : ''}
          </span>
        </div>
        <div className="xp-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="xp-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="hud-stats">
        <span className="stat-chip" title="Homestead Credits">
          <span aria-hidden="true">&#9670;</span> <b>{player.credits}</b> credits
        </span>
        <span className="stat-chip" title="Day streak">
          <span aria-hidden="true">&#128293;</span> <b>{player.streak}</b> day{player.streak === 1 ? '' : 's'}
        </span>
        <span className="stat-chip" title="Save mode">
          <span className={`mode-dot ${mode}`} aria-hidden="true" />
          {mode === 'server' ? 'cloud save' : 'local save'}
        </span>
        <button className="hud-btn" onClick={onToggleMute} aria-label={player.muted ? 'Unmute sound' : 'Mute sound'}>
          {player.muted ? 'Muted' : 'Sound on'}
        </button>
      </div>
    </header>
  );
}
