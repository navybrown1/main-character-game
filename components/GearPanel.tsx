'use client';

import { ACHIEVEMENTS, EQUIPMENT, levelForXp, type PlayerState } from '@/lib/game';

interface GearPanelProps {
  player: PlayerState;
  onEquip: (equipmentId: string) => void;
}

export default function GearPanel({ player, onEquip }: GearPanelProps) {
  const level = levelForXp(player.xp);

  return (
    <div>
      <div className="section-label">Equipment (LV {level})</div>
      <div className="gear-grid">
        {EQUIPMENT.map((e) => {
          const owned = player.equipment.includes(e.id);
          const equipped = player.equipped.includes(e.id);
          return (
            <div key={e.id} className={`gear-card${owned ? '' : ' locked'}${equipped ? ' equipped' : ''}`}>
              <div className="gear-name">{e.name}</div>
              <div className="gear-flavor">{owned ? e.flavor : `Unlocks at LV ${e.unlockLevel}.`}</div>
              {owned && !equipped && (
                <button className="btn btn-ghost btn-small" onClick={() => onEquip(e.id)}>
                  Equip
                </button>
              )}
              {equipped && <span className="xp-chip" style={{ fontSize: 11 }}>EQUIPPED</span>}
            </div>
          );
        })}
      </div>

      <div className="section-label">
        Achievements ({player.achievements.length}/{ACHIEVEMENTS.length})
      </div>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const earned = player.achievements.includes(a.id);
          return (
            <div key={a.id} className={`ach-card${earned ? ' earned' : ' locked'}`}>
              <div className="ach-name">{earned ? '\u2713 ' : ''}{a.name}</div>
              <div className="ach-desc">{a.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
