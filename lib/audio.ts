// Synthesized SFX engine. Web Audio API only, zero external audio files.
// All sounds are generated from oscillators and noise buffers.

let ctx: AudioContext | null = null;
let muted = false;
let ambientNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (muted) stopAmbient();
}

export function isMuted(): boolean {
  return muted;
}

interface ToneOpts {
  freq: number;
  endFreq?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
}

function tone({ freq, endFreq, dur = 0.12, type = 'sine', vol = 0.15, delay = 0 }: ToneOpts): void {
  const ac = getCtx();
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur = 0.2, vol = 0.12, delay = 0, filterFreq = 1200): void {
  const ac = getCtx();
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t0);
}

/** UI navigation blip. */
export function sfxBlip(): void {
  tone({ freq: 520, endFreq: 760, dur: 0.07, type: 'triangle', vol: 0.08 });
}

/** Selection confirm. */
export function sfxSelect(): void {
  tone({ freq: 440, dur: 0.08, type: 'square', vol: 0.06 });
  tone({ freq: 660, dur: 0.1, type: 'square', vol: 0.06, delay: 0.07 });
}

/** Mission step tick. */
export function sfxStep(): void {
  tone({ freq: 880, endFreq: 990, dur: 0.06, type: 'sine', vol: 0.1 });
}

/** Equipment equip. */
export function sfxEquip(): void {
  tone({ freq: 330, endFreq: 660, dur: 0.14, type: 'sawtooth', vol: 0.07 });
  tone({ freq: 660, endFreq: 990, dur: 0.12, type: 'sawtooth', vol: 0.05, delay: 0.1 });
}

/** Tab / panel open. */
export function sfxPanel(): void {
  tone({ freq: 300, endFreq: 420, dur: 0.09, type: 'triangle', vol: 0.07 });
}

/** Victory stinger: rising arpeggio plus noise swell. */
export function sfxVictory(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.14, delay: i * 0.09 });
  });
  tone({ freq: 1046.5, endFreq: 2093, dur: 0.5, type: 'sine', vol: 0.08, delay: 0.36 });
  noiseBurst(0.5, 0.05, 0.3, 3000);
}

/** Level-up fanfare. */
export function sfxLevelUp(): void {
  const notes = [392, 523.25, 659.25, 783.99, 1046.5, 1318.5];
  notes.forEach((f, i) => {
    tone({ freq: f, dur: 0.18, type: 'square', vol: 0.06, delay: i * 0.07 });
  });
}

/** Boss defeated: low boom plus rising tone. */
export function sfxBossDown(): void {
  tone({ freq: 110, endFreq: 40, dur: 0.7, type: 'sawtooth', vol: 0.16 });
  noiseBurst(0.6, 0.12, 0, 400);
  tone({ freq: 220, endFreq: 880, dur: 0.5, type: 'triangle', vol: 0.1, delay: 0.4 });
}

/** District unlock chime. */
export function sfxUnlock(): void {
  tone({ freq: 587.33, dur: 0.15, type: 'sine', vol: 0.12 });
  tone({ freq: 880, dur: 0.2, type: 'sine', vol: 0.12, delay: 0.12 });
  tone({ freq: 1174.66, dur: 0.3, type: 'sine', vol: 0.12, delay: 0.24 });
}

/** Ambient hum: low layered drones. Call once per session. */
export function startAmbient(): void {
  const ac = getCtx();
  if (!ac || muted || ambientNodes) return;
  const gain = ac.createGain();
  gain.gain.value = 0.018;
  gain.connect(ac.destination);
  const osc: OscillatorNode[] = [];
  for (const f of [55, 82.5, 110.3]) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(gain);
    o.start();
    osc.push(o);
  }
  ambientNodes = { osc, gain };
}

export function stopAmbient(): void {
  if (!ambientNodes) return;
  try {
    ambientNodes.gain.gain.exponentialRampToValueAtTime(0.0001, (ctx as AudioContext).currentTime + 0.3);
    const nodes = ambientNodes.osc;
    window.setTimeout(() => nodes.forEach((o) => { try { o.stop(); } catch { /* noop */ } }), 400);
  } catch { /* noop */ }
  ambientNodes = null;
}
