'use client';

import { useEffect, useRef } from 'react';
import { districtById, type Mission } from '@/lib/missions';
import type { CompletionEvents } from '@/lib/game';

// ---------------------------------------------------------------- Splash
export function Splash({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-label="Intro">
      <div className="splash-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/keyart.webp" alt="Operation Homestead key art" />
        <div className="splash-shade">
          <div className="splash-kicker">Season 1</div>
          <h1 className="splash-title">OPERATION HOMESTEAD</h1>
          <p className="splash-sub">
            Edwin Brown. One real to-do list, turned into a campaign.
            Every mission you finish here moves your actual life forward.
          </p>
          <div className="splash-actions">
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={onEnter}>
              Enter the Homestead
            </button>
            <button className="btn btn-ghost" onClick={onEnter}>
              Skip intro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Victory
export function VictoryOverlay({
  mission,
  events,
  onContinue,
}: {
  mission: Mission;
  events: CompletionEvents;
  onContinue: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let alive = true;
    const cvs = canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = Math.floor(window.innerWidth * dpr);
    cvs.height = Math.floor(window.innerHeight * dpr);

    interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
    const colors = ['#e8b34b', '#f2d488', '#5fd68a', '#5fa8e0', '#ffffff'];
    const parts: P[] = [];
    const cx = cvs.width / 2;
    const cy = cvs.height * 0.35;
    for (let i = 0; i < 160; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 7) * dpr;
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2 * dpr,
        life: 0,
        max: 60 + Math.random() * 60,
        color: colors[i % colors.length],
        size: (2 + Math.random() * 4) * dpr,
      });
    }

    const start = performance.now();
    function frame(now: number) {
      if (!alive) return;
      const ctx2 = ctx;
      if (!ctx2) return;
      ctx2.clearRect(0, 0, cvs.width, cvs.height);
      const t = (now - start) / 1000;
      for (const p of parts) {
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12 * dpr;
        p.vx *= 0.985;
        const alpha = Math.max(0, 1 - p.life / p.max);
        ctx2.globalAlpha = alpha;
        ctx2.fillStyle = p.color;
        ctx2.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx2.globalAlpha = 1;
      if (t < 3.2) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx2.clearRect(0, 0, cvs.width, cvs.height);
      }
    }
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const district = districtById(mission.district);

  return (
    <>
      <canvas id="victory-canvas" ref={canvasRef} aria-hidden="true" />
      <div className="overlay" role="dialog" aria-label="Mission complete">
        <div className="victory-card">
          <div className="victory-kicker">
            {mission.type === 'boss' ? 'Boss defeated' : 'Mission complete'}
          </div>
          <div className="victory-title">{mission.title}</div>
          <div className="victory-mission">{district.name}</div>
          <div className="victory-rewards">
            <div className="vr-box">
              <div className="vr-num">+{events.xpGained}</div>
              <div className="vr-label">XP</div>
            </div>
            <div className="vr-box">
              <div className="vr-num">+{events.creditsGained}</div>
              <div className="vr-label">Credits</div>
            </div>
          </div>
          <ul className="victory-list">
            {events.leveledUp && (
              <li>
                <b>Level {events.newLevel}: {events.newTitle}.</b> New gear may be waiting in the Loadout tab.
              </li>
            )}
            {events.unlockedDistricts.map((d) => (
              <li key={d}>
                <b>{districtById(d).name} unlocked.</b> New territory on the map.
              </li>
            ))}
            {events.newEquipment.map((e) => (
              <li key={e.id}>
                <b>Gear acquired: {e.name}.</b> {e.flavor}
              </li>
            ))}
            {events.newAchievements.map((a) => (
              <li key={a.id}>
                <b>Achievement: {a.name}.</b> {a.desc}
              </li>
            ))}
            {events.newAchievements.length === 0 &&
              !events.leveledUp &&
              events.unlockedDistricts.length === 0 &&
              events.newEquipment.length === 0 && (
                <li>The homestead is a little more secure than it was a minute ago.</li>
              )}
          </ul>
          <button className="btn btn-primary" onClick={onContinue}>
            Back to the mission
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Toasts
export interface Toast {
  id: number;
  text: string;
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">{t.text}</div>
      ))}
    </div>
  );
}
