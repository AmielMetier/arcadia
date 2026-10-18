// Musique d'ambiance « lo-fi » générée en direct (WebAudio) : aucun fichier, aucun droit d'auteur.
// Piano électrique (accords de septième), basse ronde, batterie feutrée avec swing, petites mélodies
// pentatoniques en écho, léger souffle de vinyle. Les grilles d'accords changent toutes les 8 mesures.
import { store, save } from './util.js';

const LOOKAHEAD = 0.25;

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Grilles (accords en notes MIDI, 4 mesures chacune, 1 accord par mesure)
const PROGRESSIONS = [
  [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], // Fmaj7 Em7 Dm7 Cmaj7
  [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 60, 64, 67]], // Dm7 G7 Cmaj7 Am7
  [[57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59]], // Am7 Dm7 G7 Cmaj7
  [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67]], // Fmaj7 G7 Em7 Am7
];
const PENTA = [72, 74, 76, 79, 81, 84]; // do majeur pentatonique, octave haute

// Ambiances : la partie choisit l'ambiance selon la situation, le changement se fait en début de mesure.
const MOODS = {
  calm: { label: 'Calme', bpm: 76, swing: 0.18, progs: PROGRESSIONS, lead: PENTA, leadP: 0.22, hats: 0.03, stab: false, ost: false, tone: 3800 },
  tense: { label: 'Tendue', bpm: 86, swing: 0.1, leadP: 0.18, hats: 0.04, stab: false, ost: true, tone: 2600,
    progs: [
      [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 56, 59, 62]], // Am7 Fmaj7 Dm7 E7
      [[57, 60, 64, 67], [55, 59, 62, 65], [53, 57, 60, 64], [52, 56, 59, 62]], // Am7 G7 Fmaj7 E7
    ],
    lead: [69, 72, 74, 76, 79, 81] },
  auction: { label: 'Enchères', bpm: 104, swing: 0, leadP: 0, hats: 0.035, stab: true, ost: true, tone: 4200,
    progs: [[[48, 52, 55, 59], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]]], // C Am F G
    lead: PENTA },
};
export function createMusic(getCtx) {
  let ctx = null, out = null, verbIn = null, timer = 0, playing = false;
  let next = 0, step = 0, bar = 0, prog = PROGRESSIONS[0], seed = 1;
  let mood = 'calm', wanted = 'calm', M = MOODS.calm, tone = null;
  const beat = () => 60 / M.bpm, stepLen = () => beat() / 4;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let on = store('david_music', true), vol = store('david_music_vol', 0.55);

  function build() {
    ctx = getCtx(); if (!ctx) return false;
    out = ctx.createGain(); out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = M.tone; lp.Q.value = 0.4; tone = lp;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    out.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
    // écho doux (delay en boucle filtrée)
    verbIn = ctx.createGain(); verbIn.gain.value = 0.32;
    const dl = ctx.createDelay(1.5); dl.delayTime.value = (60 / 76) * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.33;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2000;
    verbIn.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(out);
    // souffle de vinyle : bruit rose très faible, en boucle
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let k = 0; k < len; k++) {
      const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[k] = (b0 + b1 + b2 + w * 0.1848) * 0.05 + (Math.random() < 0.0006 ? (Math.random() - 0.5) * 0.6 : 0);
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2500; nf.Q.value = 0.5;
    src.connect(nf); nf.connect(ng); ng.connect(out); src.start();
    return true;
  }

  /* -------------------------------------------------------------- instruments */
  function epiano(n, t, dur, v = 0.12) {
    const f = midi(n), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(700, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // trémolo lent, typique du piano électrique
    const trem = ctx.createOscillator(), tg = ctx.createGain(); trem.frequency.value = 4.2; tg.gain.value = v * 0.18;
    trem.connect(tg); tg.connect(g.gain); trem.start(t); trem.stop(t + dur + 0.05);
    for (const [type, mult, det, lvl] of [['sine', 1, -4, 1], ['sine', 1, 5, 0.8], ['triangle', 2, 0, 0.18], ['sine', 3.01, 0, 0.06]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; o.frequency.value = f * mult; o.detune.value = det; og.gain.value = lvl;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    lp.connect(g); g.connect(out); g.connect(verbIn);
  }
  function bass(n, t, dur, v = 0.32) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = midi(n - 12);
    lp.type = 'lowpass'; lp.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.42, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35);
  }
  let noiseBuf = null;
  function noise(t, dur, freq, q, v, type = 'bandpass') {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const snare = (t) => { noise(t, 0.22, 1800, 0.7, 0.12); noise(t, 0.08, 220, 1, 0.08, 'lowpass'); };
  const hat = (t, v) => noise(t, 0.05, 8000, 1.2, v, 'highpass');
  function lead(n, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = midi(n);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(out); g.connect(verbIn); o.start(t); o.stop(t + 1);
  }

  /* -------------------------------------------------------------- séquenceur */
  function schedule(i, t) {
    const s = i % 16, bt = Math.floor(s / 4), B = beat(), STEP = stepLen();
    if (s === 0 && wanted !== mood) {
      // changement d'ambiance en début de mesure
      mood = wanted; M = MOODS[mood]; prog = M.progs[Math.floor(rnd() * M.progs.length)]; bar = 0;
      if (tone) tone.frequency.setTargetAtTime(M.tone, t, 0.6);
    }
    const chord = prog[bar % 4];
    const tt = t + (s % 2 ? M.swing * STEP : 0);
    if (M.stab) {
      // enchères : accords piqués sur les contretemps, basse en croches, « tic-tac » de bloc de bois
      if (s % 4 === 2) chord.forEach((n) => epiano(n, tt, B * 0.35, 0.05));
      if (s % 2 === 0) bass(s % 8 === 0 ? chord[0] : chord[0] + 12, t, B * 0.45);
      if (s % 4 === 0) wood(t, s === 0 ? 1500 : 1100);
    } else if (s === 0) {
      // accord à chaque mesure, renversé de façon aléatoire pour respirer
      const voicing = rnd() < 0.5 ? chord : [chord[1], chord[2], chord[3], chord[0] + 12];
      voicing.forEach((n, k) => epiano(n, t + k * 0.012, B * 3.6, 0.075));
      bass(chord[0], t, B * 1.6);
    }
    if (!M.stab) {
      if (M.ost && s % 2 === 0 && s !== 0 && s !== 8) bass(s % 4 === 0 ? chord[0] : chord[0] + 7, t, B * 0.4, 0.16);
      if (s === 8) bass(rnd() < 0.5 ? chord[0] : chord[2], t, B * 1.4);
      if (s === 10 && rnd() < 0.45) epiano(chord[rnd() < 0.5 ? 2 : 3] + 12, tt, B * 1.2, 0.05);
    }
    // batterie : grosse caisse 1 et « 3+ », caisse claire 2 et 4, charleston
    if (s === 0 || (s === 10 && rnd() < 0.7) || (s === 7 && rnd() < 0.25) || (M.stab && s === 8)) kick(tt);
    if (bt % 2 === 1 && s % 4 === 0) snare(t);
    const sixteenths = M.ost || M.stab;
    if (s % 2 === 0 || (sixteenths && rnd() < 0.6) || rnd() < 0.15) hat(tt, s % 4 === 0 ? M.hats + 0.02 : M.hats);
    // mélodie clairsemée
    if (s % 4 === 2 && rnd() < M.leadP) lead(M.lead[Math.floor(rnd() * M.lead.length)], tt);
    if (s === 15) {
      bar++;
      if (bar % 8 === 0) prog = M.progs[Math.floor(rnd() * M.progs.length)];
    }
  }
  function wood(t, f) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1);
  }
  // Petite fanfare de victoire (cuivres synthétiques)
  function fanfare(t) {
    const notes = [[60, 0], [64, 0.16], [67, 0.32], [72, 0.48], [67, 0.8], [72, 0.96]];
    for (const [n, d] of notes) brass(n, t + d, d >= 0.96 ? 1.6 : 0.3);
    for (const n of [48, 55, 64, 67]) brass(n, t + 0.96, 1.6, 0.05);
  }
  function brass(n, t, dur, v = 0.08) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.06); lp.frequency.exponentialRampToValueAtTime(1200, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.04); g.gain.setValueAtTime(v, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
    lp.connect(g); g.connect(out); g.connect(verbIn);
  }
  function tick() {
    while (next < ctx.currentTime + LOOKAHEAD) { schedule(step, next); step++; next += stepLen(); }
  }

  const api = {
    get on() { return on; },
    get volume() { return vol; },
    start() {
      if (playing || !on) return;
      if (!ctx && !build()) return;
      playing = true; seed = (Date.now() % 100000) + 1;
      mood = wanted; M = MOODS[mood]; prog = M.progs[Math.floor(rnd() * M.progs.length)];
      next = ctx.currentTime + 0.1; step = 0; bar = 0;
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2.5);
      timer = setInterval(tick, 60); tick();
    },
    stop() {
      if (!playing) return;
      playing = false; clearInterval(timer);
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    },
    toggle() { on = !on; save('david_music', on); if (on) api.start(); else api.stop(); return on; },
    setVolume(v) {
      vol = Math.max(0, Math.min(1, v)); save('david_music_vol', vol);
      if (playing) { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(vol, ctx.currentTime, 0.1); }
    },
    get mood() { return wanted; },
    setMood(m) { if (MOODS[m]) wanted = m; },
    win() {
      if (!on) return;
      if (!ctx && !build()) return;
      const t = ctx.currentTime + 0.05;
      if (!playing) { out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(vol, t); }
      fanfare(t);
    },
    // Pendant un moment fort (fin de partie), la musique s'efface un peu
    duck(on2) { if (playing) { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(on2 ? vol * 0.35 : vol, ctx.currentTime, 0.4); } },
    // tests : rendu hors ligne (OfflineAudioContext) de `seconds` secondes
    renderOffline(offline, seconds) {
      getCtx = () => offline; ctx = null; noiseBuf = null; build();
      out.gain.value = vol; seed = 12345; prog = PROGRESSIONS[0]; bar = 0;
      // démonstration : un tiers de chaque ambiance, puis la fanfare
      const moods = ['calm', 'tense', 'auction'];
      let i = 0, t = 0.05;
      for (const m of moods) { wanted = m; const end = (seconds - 3) * (moods.indexOf(m) + 1) / 3; while (t < end || i % 16) { schedule(i, t); i++; t += stepLen(); } }
      fanfare(t + 0.2);
      return offline.startRendering();
    },
  };
  return api;
}
