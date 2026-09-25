'use client';

import { useRef } from 'react';
import { EQUIPMENT, levelForXp, titleForLevel, type PlayerState } from '@/lib/game';

interface HeroCardProps {
  player: PlayerState;
}

export default function HeroCard({ player }: HeroCardProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const level = levelForXp(player.xp);
  const equippedNames = player.equipped
    .map((id) => EQUIPMENT.find((e) => e.id === id)?.name)
    .filter(Boolean) as string[];

  function handleTilt(e: React.PointerEvent<HTMLDivElement>) {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(500px) rotateY(${px * 14}deg) rotateX(${-py * 14}deg)`;
  }

  function resetTilt() {
    const el = frameRef.current;
    if (el) el.style.transform = 'perspective(500px) rotateY(0deg) rotateX(0deg)';
  }

  return (
    <section className="panel hero-card" aria-label="Hero">
      <div className="panel-head">
        <span className="panel-title">The Hero</span>
      </div>
      <div
        className="hero-frame"
        ref={frameRef}
        onPointerMove={handleTilt}
        onPointerLeave={resetTilt}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/hero-portrait.webp" alt="Edwin Brown, hero portrait" />
        <span className="hero-level-badge">LV {level}</span>
      </div>
      <h2 className="hero-name">Edwin Brown</h2>
      <div className="hero-title-line">{titleForLevel(level)}</div>
      <p className="hero-flavor">
        One man. One list. Seventy-one open loops and a whole homestead counting on him.
      </p>
      {equippedNames.length > 0 && (
        <div className="equipped-row">
          {equippedNames.map((n) => (
            <span key={n} className="equip-chip equipped">{n}</span>
          ))}
        </div>
      )}
    </section>
  );
}
