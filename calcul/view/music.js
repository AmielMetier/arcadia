// Musique du mode The Candidate : « Opening Bell », un morceau de salle de marché composé à la volée (Web Audio,
// aucun fichier). Ré mineur, 120 BPM, grille Rém – Si♭ – Solm – La : grosse caisse en continu, basse qui pompe,
// arpège pluck avec écho, nappes, bips de terminal. Le morceau tourne sans coupure pendant toute la partie et
// change d'habit selon la phase :
//   lobby    nappes + arpège étouffé (avant-partie)
//   intro    cloche d'ouverture, montée de bruit
//   question groove complet ; le chrono qui file (setTension) ouvre les filtres, double les charlestons,
//            fait rouler la basse et finit par une alarme
//   final    la question quitte ou double : tempo 126, clap permanent, gros « braam » toutes les deux mesures
//   reveal   le morceau passe « derrière la vitre » (filtre fermé, demi-temps) le temps de la correction
//   over     « Closing Bell », un autre morceau pour l'écran des scores : cloche de clôture, 98 BPM, piano,
//            mélodie et claps. En majeur (Fa) pour qui gagne, en mineur (Rém, plus doux-amer) sinon
import { store, save } from './util.js';

const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
// une mesure par accord ; basse, nappe et arpège suivent la même grille
const BASS = [38, 34, 31, 33];
const PAD = [[50, 53, 57, 62], [50, 53, 58, 62], [50, 55, 58, 62], [49, 52, 57, 61]];
const ARP = [[62, 65, 69, 74], [62, 65, 70, 74], [62, 67, 70, 74], [61, 64, 69, 73]];
const ARP_STEPS = [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 1, 2, 3, 2];
const BLIPS = [86, 89, 91, 93, 96, 98];
// Closing Bell : une grille de 4 mesures et une mélodie (pas de double croche → note), par version
const OVER = {
  win: {
    bass: [41, 36, 38, 34], // Fa – Do – Rém – Si♭
    chords: [[53, 57, 60, 65], [52, 55, 60, 64], [50, 53, 57, 62], [50, 53, 58, 62]],
    mel: [{ 0: 72, 4: 77, 6: 76, 8: 74, 12: 72 }, { 0: 72, 4: 76, 8: 79, 12: 76 }, { 0: 74, 4: 77, 8: 81, 12: 79 }, { 0: 77, 6: 74, 8: 72, 12: 70, 14: 72 }],
  },
  lose: {
    bass: [38, 34, 41, 36], // Rém – Si♭ – Fa – Do
    chords: [[50, 53, 57, 62], [50, 53, 58, 62], [53, 57, 60, 65], [52, 55, 60, 64]],
    mel: [{ 0: 74, 4: 77, 8: 76, 12: 74 }, { 0: 74, 4: 72, 8: 70, 12: 69 }, { 0: 72, 4: 69, 8: 65, 12: 67 }, { 0: 67, 4: 72, 8: 70, 12: 69 }],
  },
};
let overSide = 'win';

let enabled = store('calcul_music', true);
let ctx = null, out = null, filt = null, comp = null, duck = null, verb = null, echo = null, noiseBuf = null;
let playing = false, wanted = false, timer = 0, step = 0, nextT = 0, mode = 'lobby', tension = 0, smooth = 0, riserArmed = true;

function build() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  out = ctx.createGain(); out.gain.value = 0;
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2400; filt.Q.value = 0.7;
  filt.connect(comp); comp.connect(out); out.connect(ctx.destination);
  // bus « pompé » par la grosse caisse (sidechain)
  duck = ctx.createGain(); duck.connect(filt);
  // réverbe : réponse impulsionnelle de bruit qui décroît
  verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3); }
  verb.buffer = ir;
  const vg = ctx.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(filt);
  // écho en croche pointée pour l'arpège
  echo = ctx.createDelay(1); echo.delayTime.value = (60 / 120) * 0.75;
  const fb = ctx.createGain(); fb.gain.value = 0.33;
  const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 2600;
  echo.connect(ef); ef.connect(fb); fb.connect(echo); ef.connect(duck);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
  return ctx;
}

// le navigateur exige un geste avant le son : on réveille le contexte au premier clic ou à la première touche
function unlock() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, unlock, { capture: true });

const bpm = () => (mode === 'final' ? 126 : mode === 'over' ? 98 : 120);
const sixteenth = () => 60 / bpm() / 4;

function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function noiseSrc(t, dur) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t, Math.random() * 0.5); s.stop(t + dur); return s; }
const pan = (v) => { const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (p.pan) p.pan.value = v; return p; };

function kick(t, vol = 1) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  env(g, t, 0.95 * vol, 0.003, 0.38);
  o.connect(g); g.connect(filt); o.start(t); o.stop(t + 0.45);
  const c = noiseSrc(t, 0.01), cf = ctx.createBiquadFilter(), cg = ctx.createGain();
  cf.type = 'highpass'; cf.frequency.value = 3000; env(cg, t, 0.25 * vol, 0.001, 0.008);
  c.connect(cf); cf.connect(cg); cg.connect(filt);
  // sidechain : le reste du morceau s'efface une fraction de seconde
  duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(0.35, t); duck.gain.linearRampToValueAtTime(1, t + 0.2);
}
function hat(t, open, vol) {
  const s = noiseSrc(t, open ? 0.3 : 0.06), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = pan(open ? 0.15 : -0.2);
  f.type = 'highpass'; f.frequency.value = open ? 7000 : 8500;
  env(g, t, vol, 0.002, open ? 0.22 : 0.035);
  s.connect(f); f.connect(g); g.connect(p); p.connect(filt);
}
function clap(t, vol = 0.32) {
  for (let k = 0; k < 3; k++) {
    const s = noiseSrc(t + k * 0.011, 0.25), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.9;
    env(g, t + k * 0.011, vol, 0.002, k === 2 ? 0.17 : 0.03);
    s.connect(f); f.connect(g); g.connect(filt); if (k === 2) g.connect(verb);
  }
}
function bass(t, note, vol, t01) {
  const o = ctx.createOscillator(), sub = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = mtof(note);
  sub.type = 'sine'; sub.frequency.value = mtof(note - 12);
  f.type = 'lowpass'; f.frequency.setValueAtTime(260 + t01 * 1300, t); f.frequency.exponentialRampToValueAtTime(140, t + 0.18); f.Q.value = 7;
  env(g, t, vol, 0.004, 0.2);
  o.connect(f); sub.connect(g); f.connect(g); g.connect(duck);
  o.start(t); sub.start(t); o.stop(t + 0.26); sub.stop(t + 0.26);
}
function pluck(t, note, vol, bright, side) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = pan(side);
  o.type = 'square'; o2.type = 'sawtooth'; o.frequency.value = mtof(note); o2.frequency.value = mtof(note); o2.detune.value = 9;
  f.type = 'lowpass'; f.Q.value = 5;
  f.frequency.setValueAtTime(bright, t); f.frequency.exponentialRampToValueAtTime(320, t + 0.16);
  env(g, t, vol, 0.003, 0.17);
  o.connect(f); o2.connect(f); f.connect(g); g.connect(p); p.connect(duck); p.connect(echo); g.connect(verb);
  o.start(t); o2.start(t); o.stop(t + 0.22); o2.stop(t + 0.22);
}
function pad(t, notes, dur, bright) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.frequency.value = bright; f.Q.value = 0.5;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.35); g.gain.setValueAtTime(1, t + dur - 0.25); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
  f.connect(g); g.connect(duck); g.connect(verb);
  for (const n of notes) for (const d of [-8, 8]) {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = d; og.gain.value = 0.017;
    o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 0.15);
  }
}
function braam(t, root) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.Q.value = 3;
  f.frequency.setValueAtTime(180, t); f.frequency.exponentialRampToValueAtTime(1900, t + 0.22); f.frequency.exponentialRampToValueAtTime(380, t + 1.7);
  env(g, t, 0.16, 0.02, 2.1);
  f.connect(g); g.connect(filt); g.connect(verb);
  for (const n of [root - 24, root - 12, root - 5]) for (const d of [-14, 0, 14]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = d;
    o.connect(f); o.start(t); o.stop(t + 2.3);
  }
}
function blip(t) {
  const o = ctx.createOscillator(), g = ctx.createGain(), p = pan(Math.random() * 1.4 - 0.7);
  o.type = 'sine'; o.frequency.value = mtof(BLIPS[Math.floor(Math.random() * BLIPS.length)]);
  env(g, t, 0.03, 0.002, 0.05);
  o.connect(g); g.connect(p); p.connect(filt); p.connect(verb); o.start(t); o.stop(t + 0.08);
}
function alarm(t) {
  for (const [k, fq] of [[0, 1760], [0.07, 1480]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = fq; env(g, t + k, 0.028, 0.002, 0.055);
    o.connect(g); g.connect(filt); o.start(t + k); o.stop(t + k + 0.08);
  }
}
function riser(t, dur) {
  const s = noiseSrc(t, dur + 0.1), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass'; f.Q.value = 2.5;
  f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  s.connect(f); f.connect(g); g.connect(filt); g.connect(verb);
}
// cloche d'ouverture des marchés : trois coups
function bellAt(t) {
  for (let k = 0; k < 3; k++) {
    const t0 = t + k * 0.42;
    for (const [m, v] of [[1, 0.12], [2.01, 0.05], [2.76, 0.04], [5.4, 0.02]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880 * m; env(g, t0, v, 0.003, k === 2 ? 1.8 : 0.5);
      o.connect(g); g.connect(filt); g.connect(verb); o.start(t0); o.stop(t0 + 2);
    }
  }
}

// piano électrique : triangle + harmonique, attaque franche, longue queue dans la réverbe
function keys(t, notes, vol, dur) {
  for (const n of notes) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = mtof(n); o2.type = 'sine'; o2.frequency.value = mtof(n) * 2;
    env(g, t, vol, 0.004, dur); env(g2, t, vol * 0.35, 0.002, dur * 0.4);
    o.connect(g); o2.connect(g2); g.connect(duck); g2.connect(duck); g.connect(verb);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
}
// voix de la mélodie : sinus légèrement vibré, en écho
function lead(t, note, dur) {
  const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = mtof(note);
  lfo.frequency.value = 5.2; lg.gain.value = 4; lfo.connect(lg); lg.connect(o.detune);
  f.type = 'lowpass'; f.frequency.value = 3200;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(duck); g.connect(echo); g.connect(verb);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
// Closing Bell : ça démarre piano seul, la rythmique entre à la 3e mesure, la mélodie à la 5e
function scheduleOver(s, t) {
  if (s < 0) return; // la cloche sonne seule
  const st = s % 16, bar = Math.floor(s / 16) % 4, k = OVER[overSide], X = sixteenth();
  const drums = s >= 32, tune = s >= 64;
  if (drums && (st === 0 || st === 8)) kick(t, 0.6);
  if (drums && (st === 4 || st === 12)) clap(t, 0.2);
  if (drums && st % 4 === 2) hat(t, st === 14, 0.05);
  if (st === 0) { keys(t, k.chords[bar], 0.07, X * 14); pad(t, k.chords[bar], X * 16, 1300); }
  if (st === 6 || st === 10) keys(t, k.chords[bar].slice(1), 0.045, X * 3);
  if (drums && (st === 0 || st === 7 || st === 10)) bass(t, k.bass[bar] + (st === 10 ? 7 : 0), 0.24, 0.2);
  const m = k.mel[bar][st];
  // au deuxième passage, la version gagnante monte d'une octave sur la 3e mesure
  const up = overSide === 'win' && bar === 2 && Math.floor(s / 64) % 2 ? 12 : 0;
  if (tune && m) lead(t, m + up, X * 3.6);
  if (Math.random() < 0.05) blip(t + X * 0.5);
}

function schedule(s, t) {
  if (mode === 'over') return scheduleOver(s, t);
  const st = s % 16, bar = Math.floor(s / 16) % 4, beat = st % 4 === 0;
  const tt = smooth, lobby = mode === 'lobby', reveal = mode === 'reveal', final = mode === 'final', intro = mode === 'intro';
  const groove = mode === 'question' || final;
  // grosse caisse
  if (groove && beat) kick(t);
  else if ((reveal || intro) && st === 0) kick(t, 0.8);
  else if (intro && st === 8) kick(t, 0.8);
  else if (lobby && (st === 0 || st === 8)) kick(t, 0.45);
  // charlestons et clap
  if (groove) {
    if (st % 4 === 2) hat(t, tt > 0.5 || final, 0.09);
    else if (tt > 0.3 || final) hat(t, false, beat ? 0.05 : 0.07);
    if ((st === 4 || st === 12) && (tt > 0.15 || final)) clap(t);
    if (final && st === 15 && bar === 3) clap(t, 0.2);
  }
  // basse : croches à contretemps, puis roulement de doubles croches quand ça presse
  if (groove) {
    const roll = tt > 0.55 || final;
    if (st % 4 === 2) bass(t, BASS[bar], 0.3, tt);
    else if (roll && !beat) bass(t, BASS[bar] + (st % 4 === 3 ? 12 : 0), 0.2, tt);
  }
  // arpège
  if (!intro || st % 2 === 0) {
    const i = ARP_STEPS[st], note = ARP[bar][i] + (groove && tt > 0.7 && st % 8 === 7 ? 12 : 0);
    const bright = lobby ? 1100 : reveal ? 900 : 900 + tt * 3600 + (final ? 1200 : 0);
    pluck(t, note, lobby ? 0.06 : 0.05, bright, st % 2 ? 0.35 : -0.35);
  }
  // nappes à chaque mesure
  if (st === 0) pad(t, PAD[bar], sixteenth() * 16, lobby || reveal ? 900 : 1100 + tt * 900);
  // finale : braam toutes les deux mesures
  if (final && st === 0 && bar % 2 === 0) braam(t, BASS[bar]);
  // bips de terminal
  if (Math.random() < (groove ? 0.1 + tt * 0.22 : 0.07)) blip(t + sixteenth() * 0.5);
  // alarme dans les dernières secondes
  if (groove && tt > 0.8 && (st === 0 || st === 8)) alarm(t);
}

function tick() {
  if (!playing) return;
  smooth += (tension - smooth) * 0.25;
  // onglet en arrière-plan ou contexte en pause : on ne rattrape pas des mesures entières d'un coup
  if (nextT < ctx.currentTime - 0.5) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.15) {
    try { schedule(step, nextT); } catch (e) { /* un nœud refusé ne doit pas casser la boucle */ }
    nextT += sixteenth(); step++;
  }
  timer = setTimeout(tick, 25);
}

function halt(fade = 0.6) {
  if (!playing) return;
  playing = false; clearTimeout(timer);
  setMaster(0, fade);
}
function setMaster(target, time = 0.5) {
  if (!ctx) return;
  const t = ctx.currentTime;
  out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(target, t + time);
}
function setFilter(freq, time = 0.4) {
  if (!ctx) return;
  const t = ctx.currentTime;
  filt.frequency.cancelScheduledValues(t); filt.frequency.setValueAtTime(filt.frequency.value, t); filt.frequency.exponentialRampToValueAtTime(freq, t + time);
}
const FILTER = { lobby: 2400, intro: 6000, question: 16000, final: 18000, reveal: 750, over: 9000 };

export const wallStreetMusic = {
  get on() { return enabled; },
  get playing() { return playing; },
  get mode() { return mode; },
  toggle() {
    enabled = !enabled; save('calcul_music', enabled);
    if (enabled && wanted) this.start(); else if (!enabled) halt();
    return enabled;
  },
  // la musique est voulue pour ce mode de jeu ; elle ne joue que si le joueur ne l'a pas coupée
  start() {
    wanted = true;
    if (!enabled || playing) return;
    if (!build()) return;
    unlock();
    playing = true; step = 0; nextT = ctx.currentTime + 0.08;
    setMaster(0.6, 0.8); setFilter(FILTER[mode] || 2400, 0.1);
    tick();
  },
  stop(fade = 0.6) { wanted = false; halt(fade); },
  // phase du jeu : lobby, intro, question, final, reveal, over ({ win } : version gagnante ou doux-amère)
  setMode(m, { win = true } = {}) {
    if (m === 'over') overSide = win ? 'win' : 'lose';
    if (m === mode) return;
    const prev = mode; mode = m;
    // Closing Bell repart du début de sa grille, après la cloche de clôture
    if (m === 'over' && ctx && playing) { step = -16; bellAt(ctx.currentTime + 0.05); }
    if (m === 'question' || m === 'final') { tension = 0; smooth = 0; riserArmed = true; }
    if (!ctx || !playing) return;
    setFilter(FILTER[m] || 2400, m === 'reveal' ? 0.35 : 0.6);
    if (m === 'intro') { bellAt(ctx.currentTime + 0.05); riser(ctx.currentTime + 0.4, 3); }
    if (m === 'final' && prev !== 'final') braam(ctx.currentTime + 0.02, BASS[0]);
  },
  // un « braam » de cinéma, pour l'annonce d'un nouveau tour
  sting() { if (playing && ctx) braam(ctx.currentTime + 0.02, BASS[0]); },
  // 0 : tout le temps devant soi → 1 : dernières secondes
  setTension(v) {
    tension = Math.max(0, Math.min(1, v));
    if (playing && ctx && riserArmed && tension > 0.72 && (mode === 'question' || mode === 'final')) {
      riserArmed = false; riser(ctx.currentTime + 0.02, 2.6);
    }
  },
};
