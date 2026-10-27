// Sons synthétisés (WebAudio) : aucun fichier à charger. Leur volume : le curseur « Effets » des réglages (0 : coupés).
let ctx = null, master = null;
// l'ancien bouton 🔊 / 🔇 : des bruitages coupés passent le curseur à 0
DDVolume.legacy('calcul_sound', ['fx'], (v) => v === 'false');
const on = () => DDVolume.get('fx') > 0;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.3; master.connect(DDVolume.gain(ctx, 'fx')).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// Le navigateur exige un geste de l'utilisateur avant de jouer du son
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (on()) ac(); }, { once: true, capture: true });

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
  // The Candidate : le piège qui se referme, la porte qui claque, les ciseaux du palier, les jokers
  trap(c, t) { tone(520, t, 0.18, { type: 'square', vol: 0.14, slide: 0.5 }); noise(t + 0.16, 0.08, { vol: 0.5, freq: 3200, q: 2 }); tone(140, t + 0.2, 0.4, { type: 'sawtooth', vol: 0.16, slide: 0.7 }); },
  elim(c, t) { [392, 370, 349, 262].forEach((f, k) => tone(f, t + k * 0.28, k === 3 ? 0.7 : 0.26, { type: 'sawtooth', vol: 0.12, slide: k === 3 ? 0.8 : 0.97 })); noise(t + 1.15, 0.25, { vol: 0.5, freq: 200, q: 0.6 }); },
  cut(c, t) { noise(t, 0.05, { vol: 0.5, freq: 5000, q: 3 }); noise(t + 0.12, 0.05, { vol: 0.5, freq: 4200, q: 3 }); tone(196, t + 0.25, 0.3, { type: 'triangle', vol: 0.2, slide: 0.7 }); },
  // ascenseur qui arrive, portes qui s'ouvrent
  ding(c, t) { tone(1318, t, 0.9, { type: 'sine', vol: 0.3 }); tone(1046, t + 0.32, 1.2, { type: 'sine', vol: 0.3 }); noise(t + 0.5, 0.7, { vol: 0.12, freq: 600, q: 0.4 }); },
  // roulement de tambour qui accélère et enfle, puis gong grave
  drum(c, t) {
    let at = t, gap = 0.12;
    for (let k = 0; k < 46 && at < t + 2.9; k++) { noise(at, 0.05, { vol: 0.12 + (at - t) * 0.12, freq: 260 + k * 4, q: 0.8 }); at += gap; gap = Math.max(0.028, gap * 0.95); }
    noise(at, 0.5, { vol: 0.35, freq: 5200, q: 0.4 });
  },
  gong(c, t) { tone(73, t, 2.6, { type: 'sine', vol: 0.5 }); tone(146, t, 1.8, { type: 'sine', vol: 0.22 }); tone(219, t + 0.01, 1.2, { type: 'triangle', vol: 0.1 }); noise(t, 1.4, { vol: 0.25, freq: 900, q: 0.5 }); },
  life(c, t) { [659, 880, 1319].forEach((f, k) => tone(f, t + k * 0.09, 0.3, { type: 'sine', vol: 0.28 })); tone(1760, t + 0.3, 0.4, { type: 'triangle', vol: 0.12 }); },
  snip(c, t) { noise(t, 0.04, { vol: 0.45, freq: 5200, q: 3 }); noise(t + 0.09, 0.04, { vol: 0.45, freq: 4600, q: 3 }); },
  ring(c, t) { for (let k = 0; k < 6; k++) { tone(1400, t + k * 0.05, 0.04, { type: 'square', vol: 0.07 }); tone(1750, t + k * 0.05 + 0.025, 0.04, { type: 'square', vol: 0.07 }); } },
  win(c, t) { [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone(f, t + k * 0.13, 0.3, { type: 'triangle', vol: 0.3 })); noise(t + 0.7, 0.6, { vol: 0.2, freq: 4000, q: 0.5 }); },
};

export const sfx = {
  get on() { return on(); },
  play(name) {
    if (!on() || !SOUNDS[name]) return;
    const c = ac(); if (!c) return;
    try { SOUNDS[name](c, c.currentTime + 0.01); } catch (e) {}
  },
};
