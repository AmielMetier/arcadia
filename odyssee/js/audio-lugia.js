// odyssee/js/audio-lugia.js — bande-son de l'éveil de Lugia Obscur (cine-lugia.js), synthétisée et écrite sur les repères
// de la scène (LUGIA_EPIC) : orage et pluie, tonnerre à chaque éclair, nappe grave, cœur qui s'emballe, verre qui éclate,
// ralenti, chœur des abysses, tambours, tintement de l'œil, cri de Lugia, ostinato et cuivres, montée de l'Aéroblast,
// impact, accord final. Tout passe par une réverbération de cathédrale et un compresseur.
import { LUGIA_EPIC } from './ui/cine-lugia.js';
import { warnDev } from './core/safe.js';

/** snd : l'objet Sound d'audio.js (contexte, bruit blanc, volume, sortie) */
export function playShadowLugiaEpic(snd, opts = {}) {
  if (!snd.ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) { try { snd.unlock?.(); } catch (e) { warnDev('audio-lugia', e); } }
  if (!snd.ctx || snd.muted || (snd.vol ?? 0.7) <= 0 || !snd.noise) return { stop: () => {} };
  const E = LUGIA_EPIC, c = snd.ctx, t0 = c.currentTime + 0.05, T = (s) => t0 + s, D = E.dur;
  const nodes = [], timers = [], cris = [];
  let stopped = false;
  const bus = c.createGain(); bus.gain.value = snd.master ? 1.15 : Math.min(1.3, (snd.vol ?? 0.7) * 1.2);
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
  bus.connect(comp); comp.connect(snd.master || c.destination);
  // réverbération : réponse impulsionnelle de bruit qui décroît en 3,4 s
  const rev = c.createConvolver();
  {
    const len = Math.floor(c.sampleRate * 3.4), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    rev.buffer = ir;
  }
  const revOut = c.createGain(); revOut.gain.value = 0.55; rev.connect(revOut); revOut.connect(bus);
  const route = (n, wet) => { n.connect(bus); if (wet > 0) { const s = c.createGain(); s.gain.value = wet; n.connect(s); s.connect(rev); } };
  const env = (start, dur, vol, a = 0.01, r = 0.1, swell = false) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    if (swell) { g.gain.exponentialRampToValueAtTime(vol, start + dur); g.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.06); }
    else { g.gain.exponentialRampToValueAtTime(vol, start + Math.max(0.002, a)); g.gain.setValueAtTime(vol, start + Math.max(a, dur - r)); g.gain.exponentialRampToValueAtTime(0.0001, start + dur); }
    return g;
  };
  /** une note d'oscillateur (glissando, filtre, enveloppe, envoi en réverbération) */
  const N = (type, f, start, dur, vol, o = {}) => {
    const osc = c.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(f, start);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), start + dur);
    if (o.det) osc.detune.value = o.det;
    let n = osc;
    if (o.lp) { const f1 = c.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.setValueAtTime(o.lp, start); if (o.lpTo) f1.frequency.exponentialRampToValueAtTime(o.lpTo, start + dur); n.connect(f1); n = f1; }
    if (o.trem) { const tg = c.createGain(); tg.gain.value = 0.5; const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = o.trem; lg.gain.value = 0.5; lfo.connect(lg); lg.connect(tg.gain); n.connect(tg); n = tg; lfo.start(start); lfo.stop(start + dur + 0.1); nodes.push(lfo); }
    const g = env(start, dur, vol, o.a ?? 0.01, o.r ?? 0.1, o.swell);
    n.connect(g); route(g, o.wet ?? 0.25);
    osc.start(start); osc.stop(start + dur + 0.1); nodes.push(osc);
  };
  /** un souffle de bruit filtré */
  const Z = (type, f, start, dur, vol, o = {}) => {
    const src = c.createBufferSource(); src.buffer = snd.noise; src.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, start); fl.Q.value = o.q ?? 0.7;
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, start + dur);
    const g = env(start, dur, vol, o.a ?? 0.005, o.r ?? 0.1, o.swell);
    src.connect(fl); fl.connect(g); route(g, o.wet ?? 0.2);
    src.start(start, Math.random() * 0.5); src.stop(start + dur + 0.1); nodes.push(src);
  };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  /** une voix de chœur : dent de scie passée par trois formants (« aah »), vibrato */
  const choeur = (m, start, dur, vol) => {
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = hz(m);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 4.6 + Math.random(); lg.gain.value = 9; lfo.connect(lg); lg.connect(osc.detune);
    const g = env(start, dur, vol, Math.min(1.2, dur * 0.35), Math.min(1.2, dur * 0.35));
    for (const [f, q] of [[780, 9], [1150, 10], [2600, 12]]) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; osc.connect(b); b.connect(g); }
    route(g, 0.7);
    osc.start(start); osc.stop(start + dur + 0.1); lfo.start(start); lfo.stop(start + dur + 0.1); nodes.push(osc, lfo);
  };
  const coupGrave = (s, vol = 0.9) => { N('sine', 72, T(s), 1.8, vol, { to: 26, r: 1.2, wet: 0.35 }); Z('lowpass', 320, T(s), 1.3, vol * 0.55, { to: 70, r: 0.9, wet: 0.4 }); };
  const tambour = (s, vol = 0.7) => { N('sine', 115, T(s), 0.45, vol, { to: 48, r: 0.3, wet: 0.5 }); Z('lowpass', 900, T(s), 0.14, vol * 0.4, { wet: 0.4 }); };

  // 1. orage : vent, pluie, grave tenu
  Z('bandpass', 420, T(0), D, 0.16, { a: 1.2, r: 1.2, q: 0.8, wet: 0.1 });
  Z('highpass', 4200, T(0), D, 0.05, { a: 0.8, r: 1.2, wet: 0 });
  N('sine', hz(26), T(0), D, 0.22, { a: 1.5, r: 1.5, wet: 0 });
  // 2. tonnerre à chaque éclair
  for (const s of E.strikes) { Z('highpass', 1600, T(s), 0.2, 0.42, { wet: 0.5 }); Z('lowpass', 190, T(s + 0.07), 2.9, 0.48, { to: 55, a: 0.04, r: 2.2, wet: 0.6 }); }
  // 3. nappe de ré mineur qui s'ouvre jusqu'à la rupture
  for (const [m, det] of [[38, -8], [45, 6], [53, -5], [52, 7]]) N('sawtooth', hz(m), T(0.2), E.shatter - 0.25, 0.045, { det, lp: 280, lpTo: 1300, a: 2.2, r: 0.3, wet: 0.65 });
  // 4. le cœur
  for (const s of E.heart) { N('sine', 62, T(s), 0.16, 0.75, { to: 38, wet: 0.2 }); N('sine', 58, T(s + 0.19), 0.15, 0.5, { to: 36, wet: 0.2 }); }
  // 5. cordes en trémolo, crescendo jusqu'à la rupture, puis aspiration à l'envers
  for (const m of [62, 65, 69]) N('sawtooth', hz(m), T(E.crack), E.shatter - E.crack, 0.06, { lp: 1800, trem: 13, swell: true, wet: 0.5 });
  Z('bandpass', 300, T(E.shatter - 0.9), 0.9, 0.38, { to: 5200, swell: true, q: 1.2, wet: 0.2 });
  // 6. la rupture : verre, coup, ralenti
  for (let i = 0; i < 34; i++) N('sine', 2400 + Math.random() * 5200, T(E.shatter + Math.random() * 0.45), 0.25 + Math.random() * 0.45, 0.05, { r: 0.3, wet: 0.7 });
  Z('highpass', 3000, T(E.shatter), 0.45, 0.45, { r: 0.35, wet: 0.5 });
  coupGrave(E.shatter, 1.0);
  Z('lowpass', 700, T(E.shatter + 0.15), E.shots[3] - E.shatter, 0.12, { to: 140, a: 0.2, wet: 0.6 });
  // 7. le chœur des abysses, la colonne d'eau, les tambours, l'œil
  for (const m of [50, 53, 57]) choeur(m, T(E.shots[3]), 1.95, 0.07);
  for (const m of [46, 50, 53]) choeur(m, T(E.shots[3] + 1.75), E.reveal - E.shots[3] - 1.7, 0.075);
  Z('lowpass', 200, T(E.erupt), 1.6, 0.55, { to: 2600, a: 0.05, r: 1.0, wet: 0.4 }); N('sine', 45, T(E.erupt), 1.4, 0.7, { to: 30, wet: 0.2 });
  for (const s of [8.1, 8.8, 9.3, 9.72, 10.05, 10.3]) tambour(s);
  for (const [f, v] of [[2637, 0.11], [3951, 0.07], [2637 * 2.76, 0.03]]) N('sine', f, T(E.eyes), 1.8, v, { r: 1.5, wet: 0.8 });
  Z('highpass', 5200, T(E.eyes + 0.2), E.reveal - E.eyes - 0.2, 0.22, { swell: true, wet: 0.3 });
  // 8. la révélation : accord d'orchestre, grand coup, ostinato et cuivres
  for (const [m, det] of [[38, -6], [45, 5], [50, -4], [53, 4], [57, 0]]) N('sawtooth', hz(m), T(E.reveal), 1.1, 0.08, { det, lp: 2600, lpTo: 600, r: 0.8, wet: 0.6 });
  coupGrave(E.reveal, 1.0);
  const motif = [38, 38, 38, 41, 38, 38, 36, 38], croche = 60 / 140 / 2;
  for (let i = 0; E.reveal + 0.6 + i * croche < E.charge; i++) {
    const s = E.reveal + 0.6 + i * croche;
    N('sawtooth', hz(motif[i % 8]), T(s), croche * 0.8, 0.11, { lp: 650, r: 0.05, wet: 0.15 });
    if (i % 4 === 0) tambour(s, 0.45);
  }
  let tb = E.reveal + 0.6;
  for (const [m, l] of [[50, 0.85], [53, 0.43], [52, 0.43], [45, 1.28]]) { for (const det of [-7, 7]) N('sawtooth', hz(m), T(tb), l, 0.05, { det, lp: 500, lpTo: 2200, a: 0.12, r: 0.15, wet: 0.45 }); tb += l; }
  // 9. l'Aéroblast : montée, tic-tac qui s'accélère, silence, impact, souffle du rayon
  N('sawtooth', 80, T(E.charge), E.fire - E.charge - 0.12, 0.13, { to: 900, lp: 300, lpTo: 5000, swell: true, wet: 0.3 });
  Z('bandpass', 200, T(E.charge), E.fire - E.charge - 0.12, 0.32, { to: 6500, swell: true, q: 1.4, wet: 0.3 });
  for (let s = E.charge, k = 0.26; s < E.fire - 0.15; s += k, k = Math.max(0.045, k * 0.88)) Z('highpass', 3500, T(s), 0.03, 0.18, { wet: 0.2 });
  for (const m of [50, 53, 57]) choeur(m, T(E.charge), E.fire - E.charge - 0.12, 0.05);
  coupGrave(E.fire, 1.1);
  for (const [m, det] of [[38, -6], [45, 5], [50, -4], [53, 4]]) N('sawtooth', hz(m), T(E.fire), 1.4, 0.09, { det, lp: 3000, lpTo: 500, r: 1.0, wet: 0.6 });
  Z('bandpass', 1300, T(E.fire), E.white - E.fire + 0.3, 0.42, { q: 2, r: 0.3, wet: 0.3 });
  // 10. le titre : roulement de timbales, grand accord, chœur, tout s'éteint
  for (let s = E.title - 0.6, i = 0; s < E.title - 0.02; s += 0.05, i++) N('sine', 92, T(s), 0.08, 0.05 + i * 0.03, { to: 70, wet: 0.4 });
  coupGrave(E.title, 0.9);
  for (const [m, det] of [[38, -7], [45, 6], [50, -4], [53, 5], [57, -3], [62, 4]]) N('sawtooth', hz(m), T(E.title), D - E.title, 0.05, { det, lp: 400, lpTo: 2400, a: 0.4, r: 1.6, wet: 0.7 });
  for (const m of [50, 53, 57, 62]) choeur(m, T(E.title), D - E.title, 0.06);

  // le cri de Lugia, un peu ralenti (le vrai cri du jeu), et un grondement saturé dessous
  const cryUrl = opts.cryUrl;
  if (cryUrl && typeof window !== 'undefined' && typeof window.Audio === 'function' && !String(cryUrl).startsWith('synth:')) {
    timers.push(setTimeout(() => {
      if (stopped) return;
      try { const a = new window.Audio(cryUrl); const fxVol = typeof window.DDVolume?.get === 'function' ? window.DDVolume.get('fx') : 1; a.volume = Math.min(1, (snd.vol ?? 0.7) * fxVol * 1.05); a.preservesPitch = false; a.playbackRate = 0.82; cris.push(a); a.play().catch((e) => warnDev('audio-lugia', e)); } catch (e) { warnDev('audio-lugia', e); }
    }, Math.round((E.reveal + 0.05) * 1000)));
  }
  try {
    const s = T(E.reveal + 0.08), ws = c.createWaveShaper(), n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * 10);
    ws.curve = curve;
    const g = env(s, 2.0, 0.32, 0.15, 0.8);
    for (const [f0, f1] of [[240, 85], [160, 55]]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f1, s + 1.9); o.connect(ws); o.start(s); o.stop(s + 2.05); nodes.push(o); }
    ws.connect(g); route(g, 0.4);
  } catch (e) { /* rien */ }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    timers.forEach((id) => clearTimeout(id));
    cris.forEach((a) => { try { a.pause(); a.src = ''; } catch (e) { /* rien */ } });
    const now = c.currentTime;
    try {
      bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(bus.gain.value, now); bus.gain.linearRampToValueAtTime(0.0001, now + 0.45);
      setTimeout(() => {
        nodes.forEach((x) => { try { x.stop(); } catch (e) { /* déjà arrêté */ } try { x.disconnect(); } catch (e) { /* rien */ } });
        try { comp.disconnect(); bus.disconnect(); rev.disconnect(); } catch (e) { /* rien */ }
      }, 520);
    } catch (e) { /* rien */ }
  };
  return { stop };
}
