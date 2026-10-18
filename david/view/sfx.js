// Sons synthétisés (WebAudio) : aucun fichier à charger. Coupables, réglage mémorisé.
import { store, save } from './util.js';

let ctx = null, master = null;
let on = store('david_sound', true);

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.32; master.connect(ctx.destination);
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
  dice(c, t) { for (let k = 0; k < 7; k++) noise(t + k * 0.07 + Math.random() * 0.03, 0.05, { vol: 0.5 - k * 0.05, freq: 2200 + Math.random() * 1200, q: 2 }); },
  hop(c, t) { tone(520 + Math.random() * 60, t, 0.07, { type: 'triangle', vol: 0.18, slide: 1.4 }); },
  coin(c, t) { tone(1320, t, 0.09, { type: 'square', vol: 0.12 }); tone(1760, t + 0.07, 0.18, { type: 'square', vol: 0.12 }); },
  pay(c, t) { tone(660, t, 0.1, { type: 'triangle', vol: 0.25 }); tone(440, t + 0.08, 0.16, { type: 'triangle', vol: 0.22 }); },
  buy(c, t) { noise(t, 0.08, { vol: 0.5, freq: 3000 }); tone(988, t + 0.05, 0.12, { type: 'square', vol: 0.12 }); tone(1319, t + 0.15, 0.3, { type: 'square', vol: 0.12 }); },
  build(c, t) { tone(140, t, 0.18, { type: 'sine', vol: 0.6, slide: 0.5 }); noise(t, 0.12, { vol: 0.35, freq: 400 }); },
  card(c, t) { noise(t, 0.25, { vol: 0.3, freq: 900, q: 0.6 }); tone(784, t + 0.18, 0.2, { type: 'triangle', vol: 0.18 }); },
  jail(c, t) { tone(196, t, 0.5, { type: 'sawtooth', vol: 0.18, slide: 0.7 }); noise(t, 0.2, { vol: 0.4, freq: 600 }); },
  turn(c, t) { tone(784, t, 0.12, { vol: 0.2 }); tone(1047, t + 0.1, 0.2, { vol: 0.2 }); },
  bid(c, t) { tone(880, t, 0.06, { type: 'square', vol: 0.12 }); },
  error(c, t) { tone(220, t, 0.18, { type: 'square', vol: 0.12 }); },
  win(c, t) { [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone(f, t + k * 0.12, 0.25, { type: 'square', vol: 0.13 })); },
  bankrupt(c, t) { [392, 330, 262, 196].forEach((f, k) => tone(f, t + k * 0.15, 0.3, { type: 'sawtooth', vol: 0.12 })); },
};

export const sfx = {
  play(name) {
    if (!on || !SOUNDS[name]) return;
    const c = ac(); if (!c) return;
    try { SOUNDS[name](c, c.currentTime + 0.01); } catch (e) {}
  },
  get on() { return on; },
  toggle() { on = !on; save('david_sound', on); if (on) ac(); return on; },
};
