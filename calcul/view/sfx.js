// Sons synthétisés (WebAudio) : aucun fichier à charger. Coupables, réglage mémorisé.
import { store, save } from './util.js';

let ctx = null, master = null;
let on = store('calcul_sound', true);

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.3; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// Le navigateur exige un geste de l'utilisateur avant de jouer du son
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (on) ac(); }, { once: true, capture: true });

function tone(freq, t0, dur, { type = 'sine', vol = 0.5, slide = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, { vol = 0.4, freq = 1800, q = 1 } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t0);
}

const SOUNDS = {
  tick(c, t) { tone(1500, t, 0.04, { type: 'square', vol: 0.08 }); },
  count(c, t) { tone(660, t, 0.16, { type: 'triangle', vol: 0.3 }); },
  go(c, t) { tone(880, t, 0.1, { type: 'square', vol: 0.15 }); tone(1320, t + 0.09, 0.3, { type: 'square', vol: 0.15 }); },
  question(c, t) { noise(t, 0.12, { vol: 0.35, freq: 2600, q: 0.8 }); tone(523, t + 0.05, 0.12, { type: 'triangle', vol: 0.25 }); tone(784, t + 0.13, 0.2, { type: 'triangle', vol: 0.25 }); },
  lock(c, t) { tone(300, t, 0.07, { type: 'square', vol: 0.12 }); noise(t, 0.05, { vol: 0.4, freq: 900 }); },
  ok(c, t) { [784, 988, 1319].forEach((f, k) => tone(f, t + k * 0.08, 0.22, { type: 'triangle', vol: 0.3 })); },
  ko(c, t) { tone(220, t, 0.35, { type: 'sawtooth', vol: 0.18, slide: 0.6 }); },
  streak(c, t) { [988, 1175, 1480, 1976].forEach((f, k) => tone(f, t + k * 0.06, 0.12, { type: 'square', vol: 0.1 })); },
  sab(c, t) { tone(1200, t, 0.5, { type: 'sawtooth', vol: 0.12, slide: 0.25 }); noise(t + 0.05, 0.35, { vol: 0.3, freq: 700, q: 0.7 }); tone(180, t + 0.35, 0.25, { type: 'square', vol: 0.12 }); },
  pop(c, t) { tone(700, t, 0.08, { type: 'sine', vol: 0.3, slide: 1.8 }); },
  win(c, t) { [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone(f, t + k * 0.13, 0.3, { type: 'triangle', vol: 0.3 })); noise(t + 0.7, 0.6, { vol: 0.2, freq: 4000, q: 0.5 }); },
};

export const sfx = {
  get on() { return on; },
  toggle() { on = !on; save('calcul_sound', on); if (on) ac(); },
  play(name) {
    if (!on || !SOUNDS[name]) return;
    const c = ac(); if (!c) return;
    try { SOUNDS[name](c, c.currentTime + 0.01); } catch (e) {}
  },
};
