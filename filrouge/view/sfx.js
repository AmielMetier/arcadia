// Sons synthétisés (WebAudio), sans fichier. Le contexte audio naît au premier clic (règle des navigateurs).
// volume : le curseur « Effets » des réglages (l'ancien bouton 🔇 le met à 0)
let ac = null, master = null;
DDVolume.legacy('fil_mute', ['fx']);
function ctx() {
  if (!ac) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ac = new C(); master = ac.createGain(); master.gain.value = 0.5; master.connect(DDVolume.gain(ac, 'fx')).connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
window.addEventListener('pointerdown', () => ctx(), { once: true });
window.addEventListener('keydown', () => ctx(), { once: true });

function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.005 } = {}) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.4, at = 0, freq = 1200, q = 0.7, type = 'lowpass', decay = true } = {}) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (decay ? Math.pow(1 - i / d.length, 2) : 1);
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

// Hauteurs du carillon (gamme pentatonique) et sons des touches
const MEL = [261.6, 293.7, 329.6, 392.0, 440.0];
const KEYS = [523.3, 659.3, 784.0, 987.8];

export const sfx = {
  click() { tone(1800, 0.04, { type: 'square', vol: 0.08 }); tone(900, 0.05, { type: 'triangle', vol: 0.1, at: 0.01 }); },
  clack() { noise(0.06, { vol: 0.35, freq: 2600, type: 'bandpass', q: 2 }); tone(220, 0.06, { type: 'square', vol: 0.06 }); },
  cut() { noise(0.09, { vol: 0.5, freq: 5000, type: 'highpass' }); tone(3200, 0.05, { type: 'square', vol: 0.05 }); },
  dial() { noise(0.03, { vol: 0.25, freq: 3500, type: 'bandpass', q: 6 }); },
  tick(fast) { tone(fast ? 1900 : 1500, 0.05, { type: 'square', vol: 0.05 }); },
  strike() { tone(140, 0.5, { type: 'sawtooth', vol: 0.25 }); tone(147, 0.5, { type: 'sawtooth', vol: 0.2 }); noise(0.25, { vol: 0.15, freq: 400 }); },
  solve() { [784, 988, 1175].forEach((f, k) => tone(f, 0.25, { type: 'triangle', vol: 0.18, at: k * 0.08 })); },
  water() { noise(1.2, { vol: 0.25, freq: 900, type: 'bandpass', q: 0.8, decay: false }); },
  boom() { noise(2.6, { vol: 1.0, freq: 500 }); tone(60, 1.8, { type: 'sine', vol: 0.8, slide: 0.4 }); noise(0.4, { vol: 0.6, freq: 3000 }); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone(f, 0.3, { type: 'triangle', vol: 0.2, at: k * 0.11 })); },
  page() { noise(0.18, { vol: 0.18, freq: 2400, type: 'bandpass', q: 0.6 }); },
  chat() { tone(1320, 0.07, { type: 'sine', vol: 0.12 }); tone(1760, 0.09, { type: 'sine', vol: 0.1, at: 0.06 }); },
  sabotage() { tone(400, 0.4, { type: 'sawtooth', vol: 0.15, slide: 0.3 }); },
  key(i) { tone(KEYS[i], 0.35, { type: 'triangle', vol: 0.25 }); },
  melody(notes) { notes.forEach((n, k) => tone(MEL[n], 0.42, { type: 'sine', vol: 0.32, at: 0.15 + k * 0.5, attack: 0.02 })); },
};
