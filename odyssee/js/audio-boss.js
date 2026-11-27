// odyssee/js/audio-boss.js — profils sonores et sound design WebAudio temps réel des cinématiques 3D de boss et légendaires.
import { warnDev } from './core/safe.js';

export const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** Convertit une notation musicale (ex. 'B1', 'F#2') en numéro de note MIDI. */
export const midiOf = (n) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); return 12 * (+m[2] + 1) + NOTE[m[1]]; };

/** Convertit un numéro de note MIDI en fréquence (Hz). */
export const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const CINE_AUDIO_PROFILES = {
  shadow: {
    dur: 14.8, root: 'B1', padWave: 'sawtooth', arpWave: 'pulse12', drum: 'heavy',
    chord1: [0, 6, 9, 14], chord2: [0, 7, 12, 15], filterRange: [220, 900], noiseRange: [140, 380],
    arp: [0, 6, 12, 15, 18, 15, 12, 6],
    fanfare: [[0.44, 0.08, 12], [0.52, 0.08, 15], [0.60, 0.14, 18], [0.74, 0.18, 24]],
  },
  fire: {
    dur: 6.8, root: 'D2', padWave: 'sawtooth', arpWave: 'pulse25', drum: 'taiko',
    chord1: [0, 1, 7, 12], chord2: [0, 7, 12, 16, 19], filterRange: [260, 1400], noiseRange: [180, 620],
    arp: [0, 1, 7, 12, 13, 19, 13, 7],
    fanfare: [[0.42, 0.10, 12], [0.52, 0.08, 13], [0.60, 0.14, 19], [0.74, 0.20, 24]],
  },
  phoenix: {
    dur: 7.8, root: 'E2', padWave: 'sawtooth', arpWave: 'triangle', drum: 'taiko',
    chord1: [0, 5, 7, 12], chord2: [0, 7, 12, 16, 21], filterRange: [340, 1800], noiseRange: [260, 760],
    arp: [12, 16, 19, 24, 28, 24, 19, 16],
    fanfare: [[0.40, 0.10, 12], [0.50, 0.08, 16], [0.58, 0.12, 19], [0.70, 0.24, 24]],
  },
  water: {
    dur: 6.4, root: 'E2', padWave: 'triangle', arpWave: 'sine', drum: 'chime',
    chord1: [0, 3, 7, 14], chord2: [0, 7, 12, 15, 19], filterRange: [300, 1200], noiseRange: [240, 820],
    arp: [12, 15, 19, 26, 24, 19, 15, 12],
    fanfare: [[0.42, 0.12, 19], [0.54, 0.10, 22], [0.64, 0.14, 24], [0.78, 0.20, 26]],
  },
  abyssal: {
    dur: 7.8, root: 'E2', padWave: 'triangle', arpWave: 'pulse12', drum: 'heavy',
    chord1: [0, 1, 7, 10], chord2: [0, 7, 12, 15, 22], filterRange: [200, 1100], noiseRange: [150, 680],
    arp: [12, 13, 19, 24, 25, 24, 19, 13],
    fanfare: [[0.42, 0.12, 12], [0.54, 0.10, 15], [0.64, 0.14, 19], [0.78, 0.20, 24]],
  },
  thunder: {
    dur: 6.4, root: 'E2', padWave: 'sawtooth', arpWave: 'pulse25', drum: 'thunder',
    chord1: [0, 7, 10, 15], chord2: [0, 7, 12, 19, 24], filterRange: [420, 2200], noiseRange: [600, 2400],
    arp: [0, 12, 7, 15, 12, 19, 15, 24],
    fanfare: [[0.40, 0.06, 19], [0.46, 0.06, 22], [0.52, 0.12, 24], [0.66, 0.22, 27]],
  },
  ice: {
    dur: 6.4, root: 'A2', padWave: 'triangle', arpWave: 'sine', drum: 'chime',
    chord1: [0, 7, 11, 15], chord2: [0, 7, 12, 15, 23], filterRange: [520, 2400], noiseRange: [800, 2600],
    arp: [24, 27, 31, 35, 31, 27, 24, 19],
    fanfare: [[0.42, 0.10, 24], [0.52, 0.10, 23], [0.62, 0.14, 19], [0.76, 0.20, 24]],
  },
  cosmic: {
    dur: 7.2, root: 'F#2', padWave: 'triangle', arpWave: 'pulse12', drum: 'chime',
    chord1: [0, 6, 11, 18], chord2: [0, 7, 11, 16, 23], filterRange: [380, 2000], noiseRange: [320, 1500],
    arp: [12, 18, 19, 23, 24, 23, 19, 18],
    fanfare: [[0.42, 0.10, 18], [0.52, 0.10, 19], [0.62, 0.14, 23], [0.76, 0.22, 24]],
  },
  celestial: {
    dur: 8.2, root: 'C2', padWave: 'sawtooth', arpWave: 'sine', drum: 'taiko',
    chord1: [0, 7, 14, 16], chord2: [0, 7, 12, 16, 24], filterRange: [400, 2400], noiseRange: [350, 1800],
    arp: [12, 16, 19, 24, 28, 31, 28, 24],
    fanfare: [[0.40, 0.10, 19], [0.50, 0.10, 24], [0.60, 0.14, 28], [0.74, 0.24, 31]],
  },
  nature: {
    dur: 6.2, root: 'G2', padWave: 'triangle', arpWave: 'sine', drum: 'chime',
    chord1: [0, 7, 11, 14], chord2: [0, 7, 12, 16, 19], filterRange: [340, 1600], noiseRange: [300, 1100],
    arp: [12, 16, 19, 23, 26, 23, 19, 16],
    fanfare: [[0.42, 0.10, 16], [0.52, 0.10, 19], [0.62, 0.12, 23], [0.74, 0.22, 24]],
  },
  fairy: {
    dur: 6.2, root: 'F2', padWave: 'triangle', arpWave: 'sine', drum: 'chime',
    chord1: [0, 4, 11, 14], chord2: [0, 7, 12, 16, 23], filterRange: [440, 2100], noiseRange: [450, 1700],
    arp: [12, 19, 23, 28, 23, 19, 24, 31],
    fanfare: [[0.42, 0.08, 19], [0.50, 0.08, 23], [0.58, 0.12, 24], [0.70, 0.22, 28]],
  },
  titan: {
    dur: 6.2, root: 'A1', padWave: 'sawtooth', arpWave: 'pulse25', drum: 'taiko',
    chord1: [0, 5, 7, 12], chord2: [0, 7, 12, 15, 19], filterRange: [180, 950], noiseRange: [120, 450],
    arp: [0, 7, 12, 15, 12, 7, 19, 12],
    fanfare: [[0.42, 0.12, 12], [0.54, 0.10, 15], [0.64, 0.14, 19], [0.78, 0.20, 24]],
  },
  dragon: {
    dur: 6.8, root: 'D2', padWave: 'sawtooth', arpWave: 'pulse25', drum: 'heavy',
    chord1: [0, 7, 10, 14], chord2: [0, 7, 12, 15, 22], filterRange: [280, 1600], noiseRange: [200, 780],
    arp: [12, 15, 19, 22, 24, 22, 19, 15],
    fanfare: [[0.42, 0.10, 12], [0.52, 0.08, 15], [0.60, 0.12, 19], [0.72, 0.24, 24]],
  },
  eclipse: {
    dur: 6.6, root: 'F2', padWave: 'sawtooth', arpWave: 'pulse12', drum: 'industrial',
    chord1: [0, 6, 10, 13], chord2: [0, 7, 12, 13, 19], filterRange: [220, 1300], noiseRange: [160, 620],
    arp: [12, 13, 18, 24, 19, 18, 13, 12],
    fanfare: [[0.42, 0.10, 12], [0.52, 0.10, 13], [0.62, 0.12, 19], [0.74, 0.22, 24]],
  },
  champion: {
    dur: 8.0, root: 'C2', padWave: 'sawtooth', arpWave: 'pulse50', drum: 'taiko',
    chord1: [0, 7, 10, 15], chord2: [0, 7, 12, 16, 24], filterRange: [340, 2100], noiseRange: [250, 950],
    arp: [12, 15, 19, 24, 19, 22, 24, 28],
    fanfare: [[0.40, 0.10, 19], [0.50, 0.08, 22], [0.58, 0.12, 24], [0.70, 0.25, 28]],
  },
  elite4: {
    dur: 6.2, root: 'C#2', padWave: 'sawtooth', arpWave: 'pulse12', drum: 'heavy',
    chord1: [0, 3, 7, 11], chord2: [0, 7, 12, 15, 23], filterRange: [280, 1650], noiseRange: [200, 750],
    arp: [12, 15, 19, 23, 24, 23, 19, 15],
    fanfare: [[0.42, 0.10, 12], [0.52, 0.08, 15], [0.60, 0.12, 23], [0.72, 0.24, 24]],
  },
  dojo: {
    dur: 6.0, root: 'A2', padWave: 'triangle', arpWave: 'pulse12', drum: 'taiko',
    chord1: [0, 2, 7, 8], chord2: [0, 7, 12, 14, 19], filterRange: [300, 1750], noiseRange: [240, 900],
    arp: [12, 14, 15, 19, 20, 19, 15, 14],
    fanfare: [[0.40, 0.08, 12], [0.48, 0.08, 15], [0.56, 0.12, 19], [0.68, 0.24, 24]],
  },
  raid: {
    dur: 5.6, root: 'G2', padWave: 'sawtooth', arpWave: 'pulse25', drum: 'industrial',
    chord1: [0, 6, 10, 12], chord2: [0, 7, 12, 15, 22], filterRange: [320, 2200], noiseRange: [280, 1400],
    arp: [12, 19, 12, 22, 12, 24, 22, 19],
    fanfare: [[0.40, 0.08, 12], [0.48, 0.08, 19], [0.56, 0.12, 22], [0.68, 0.24, 24]],
  },
  rival: {
    dur: 5.8, root: 'D2', padWave: 'sawtooth', arpWave: 'pulse25', drum: 'heavy',
    chord1: [0, 5, 7, 10], chord2: [0, 7, 12, 16, 19], filterRange: [320, 1850], noiseRange: [240, 920],
    arp: [12, 16, 19, 24, 19, 16, 19, 24],
    fanfare: [[0.42, 0.08, 16], [0.50, 0.08, 19], [0.58, 0.12, 22], [0.70, 0.22, 24]],
  },
  gym: {
    dur: 5.6, root: 'E2', padWave: 'sawtooth', arpWave: 'pulse25', drum: 'taiko',
    chord1: [0, 5, 7, 12], chord2: [0, 7, 12, 16, 24], filterRange: [340, 1950], noiseRange: [260, 1000],
    arp: [12, 16, 19, 24, 19, 16, 24, 28],
    fanfare: [[0.42, 0.08, 12], [0.50, 0.08, 16], [0.58, 0.12, 19], [0.70, 0.22, 24]],
  },
};

export const CINE_AUDIO_KEYS = Object.keys(CINE_AUDIO_PROFILES);

function makeDistortion(c, k = 9) {
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * k);
  const ws = c.createWaveShaper();
  ws.curve = curve;
  ws.oversample = '2x';
  return ws;
}

/**
 * Bruitage et musique WebAudio en temps réel pour toute cinématique 3D de boss / légendaire.
 * Synchronisé avec les phases d'apparition du sceau, éclatement et envol du boss/légendaire.
 */
export function playBossCinematicAudio(sound, preset = 'shadow', durationSec = null, opts = {}) {
  if (!sound.ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
    try { sound.init?.(); } catch (e) { warnDev('audio-boss', e); }
  }
  if (!sound.ctx || sound.muted || (sound.vol ?? 0.7) <= 0) return { stop: () => {} };
  const prof = CINE_AUDIO_PROFILES[preset] || CINE_AUDIO_PROFILES.shadow;
  const dur = Math.max(3.0, Number(durationSec) || prof.dur || 6.4);
  const isShadowFull = preset === 'shadow' && dur >= 12;
  const c = sound.ctx;
  const bus = c.createGain();
  // le bus général (sound.master) applique déjà le volume réglé : ici, seulement le niveau propre à la scène
  // (avant : volume × volume × 1,25, trop fort à fond et presque muet à bas volume)
  const masterVol = sound.master ? 1 : Math.max(0, Math.min(1, sound.vol ?? 0.7));
  bus.gain.value = masterVol;
  bus.connect(sound.master || c.destination);

  const nodes = [];
  const cryEls = [];
  const timers = [];
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    timers.forEach((id) => clearTimeout(id));
    cryEls.forEach((a) => { try { a.pause(); a.src = ''; } catch (e) { warnDev('audio-boss', e); } });
    const now = c.currentTime;
    try {
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0.0001, now + 0.35);
      setTimeout(() => {
        nodes.forEach((n) => {
          try { n.stop(); } catch (e) { warnDev('audio-boss', e); }
          try { n.disconnect(); } catch (e) { warnDev('audio-boss', e); }
        });
        try { bus.disconnect(); } catch (e) { warnDev('audio-boss', e); }
      }, 400);
    } catch (e) { warnDev('audio-boss', e); }
  };

  const t0 = c.currentTime + 0.05;
  const baseMidi = midiOf(prof.root || 'D2');
  const [fMin, fMax] = prof.filterRange || [240, 1500];
  const [nMin, nMax] = prof.noiseRange || [180, 700];

  // 1. Sub-bass Drone & Ambiance élémentaire (0 -> dur)
  try {
    const sub = c.createOscillator();
    sub.type = 'sine';
    const subHz = freq(baseMidi - 12);
    sub.frequency.setValueAtTime(Math.max(30, subHz), t0);
    sub.frequency.exponentialRampToValueAtTime(Math.max(34, subHz * 1.35), t0 + dur * 0.25);
    sub.frequency.exponentialRampToValueAtTime(Math.max(28, subHz * 0.9), t0 + dur * 0.42);
    sub.frequency.exponentialRampToValueAtTime(Math.max(32, subHz * 1.15), t0 + dur * 0.78);
    sub.frequency.exponentialRampToValueAtTime(Math.max(25, subHz * 0.8), t0 + dur);

    const subGain = c.createGain();
    subGain.gain.setValueAtTime(0.0001, t0);
    subGain.gain.exponentialRampToValueAtTime(0.42, t0 + Math.min(0.6, dur * 0.1));
    subGain.gain.setValueAtTime(0.42, t0 + Math.max(0.7, dur - 0.8));
    subGain.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.1);
    sub.connect(subGain);
    subGain.connect(bus);
    sub.start(t0);
    sub.stop(t0 + dur + 0.2);
    nodes.push(sub);

    if (sound.noise) {
      const nSrc = c.createBufferSource();
      nSrc.buffer = sound.noise;
      nSrc.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(nMin, t0);
      lp.frequency.exponentialRampToValueAtTime(nMax, t0 + dur * 0.36);
      lp.frequency.exponentialRampToValueAtTime(Math.max(120, nMin * 1.2), t0 + dur * 0.65);
      lp.frequency.exponentialRampToValueAtTime(nMax, t0 + dur * 0.86);
      lp.frequency.exponentialRampToValueAtTime(90, t0 + dur);

      const nGain = c.createGain();
      nGain.gain.setValueAtTime(0.0001, t0);
      nGain.gain.exponentialRampToValueAtTime(0.28, t0 + Math.min(0.5, dur * 0.1));
      nGain.gain.setValueAtTime(0.28, t0 + Math.max(0.6, dur - 0.8));
      nGain.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.1);
      nSrc.connect(lp);
      lp.connect(nGain);
      nGain.connect(bus);
      nSrc.start(t0);
      nSrc.stop(t0 + dur + 0.2);
      nodes.push(nSrc);
    }
  } catch (e) { warnDev('audio-boss', e); }

  // 2. Nappe harmonique bi-phase (Tension -> Climax glorieux / dramatique)
  const shatterFrac = isShadowFull ? (2.8 / dur) : 0.36;
  const tShatter = dur * shatterFrac;
  try {
    const playChordBand = (offsets, startOff, span, volScale) => {
      offsets.forEach((iv, idx) => {
        const osc = c.createOscillator();
        osc.type = idx % 2 === 0 ? prof.padWave : 'triangle';
        osc.frequency.setValueAtTime(freq(baseMidi + iv), t0 + startOff);
        osc.detune.setValueAtTime((idx - 1.5) * 7, t0 + startOff);

        const flt = c.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(fMin, t0 + startOff);
        flt.frequency.exponentialRampToValueAtTime(fMax, t0 + startOff + span * 0.65);
        flt.frequency.exponentialRampToValueAtTime(Math.max(180, fMin * 0.9), t0 + startOff + span);

        const cGain = c.createGain();
        cGain.gain.setValueAtTime(0.0001, t0 + startOff);
        cGain.gain.exponentialRampToValueAtTime(volScale, t0 + startOff + Math.min(0.55, span * 0.2));
        cGain.gain.setValueAtTime(volScale, t0 + startOff + Math.max(0.25, span - 0.45));
        cGain.gain.linearRampToValueAtTime(0.0001, t0 + startOff + span + 0.08);

        osc.connect(flt);
        flt.connect(cGain);
        cGain.connect(bus);
        osc.start(t0 + startOff);
        osc.stop(t0 + startOff + span + 0.15);
        nodes.push(osc);
      });
    };
    playChordBand(prof.chord1, 0, Math.max(1.0, tShatter + 0.25), 0.11);
    playChordBand(prof.chord2, Math.max(0.5, tShatter - 0.08), Math.max(1.2, dur - tShatter + 0.1), 0.13);
  } catch (e) { warnDev('audio-boss', e); }

  // 3. Arpège signature & montée percussive pré-impact
  try {
    const stepDt = isShadowFull ? 0.28 : 0.16;
    const totalSteps = Math.floor((dur - 0.5) / stepDt);
    for (let i = 0; i < totalSteps; i++) {
      const atT = t0 + 0.18 + i * stepDt;
      if (atT > t0 + dur - 0.25) break;
      const iv = prof.arp[i % prof.arp.length];
      const m = Math.max(28, Math.min(104, baseMidi + 12 + iv));
      const inBuild = (atT - t0) < tShatter;
      const v = inBuild ? 0.10 + 0.06 * ((atT - t0) / Math.max(0.5, tShatter)) : 0.14;
      sound.tone(prof.arpWave || 'pulse12', freq(m), atT, stepDt * 0.85, v, bus, { attack: 0.01 });
      if (inBuild && i % 2 === 0) {
        if (prof.drum === 'taiko') sound.tone('sine', 120, atT, 0.2, 0.26, bus, { slide: 46 });
        else if (prof.drum === 'thunder' && i % 4 === 0) sound.tone('pulse25', 1400, atT, 0.09, 0.12, bus, { slide: 280 });
        else if (prof.drum === 'industrial') sound.tone('noise', 1800, atT, 0.06, 0.14, bus, { filter: 'bandpass' });
      }
    }
  } catch (e) { warnDev('audio-boss', e); }

  // 4. Éclatement du Sceau / Rugissement & Cri à tShatter
  const cryUrl = opts.cryUrl || (isShadowFull ? new URL('../snd/cris/249.ogg', import.meta.url).href : null);
  timers.push(setTimeout(() => {
    if (stopped) return;
    const tHit = c.currentTime;
    sound.tone('noise', prof.drum === 'chime' ? 2200 : 420, tHit, 0.42, 0.52, bus, { filter: 'lowpass' });
    sound.tone('triangle', prof.drum === 'thunder' ? 190 : 105, tHit, 0.48, 0.48, bus, { slide: 28 });
    if (preset === 'ice' || preset === 'fairy' || preset === 'cosmic' || preset === 'celestial') {
      [1567, 2093, 2637].forEach((f, idx) => sound.tone('sine', f, tHit + idx * 0.05, 0.55, 0.16, bus, { release: 0.45 }));
    } else if (preset === 'thunder') {
      sound.tone('pulse25', 1900, tHit, 0.14, 0.24, bus, { slide: 210 });
    }
    if (cryUrl && typeof window !== 'undefined' && typeof window.Audio === 'function') {
      try {
        const a = new window.Audio(cryUrl);
        const fx = typeof window !== 'undefined' && window.DDVolume?.get ? Number(window.DDVolume.get('fx')) : 1;
        a.volume = sound.muted ? 0 : Math.max(0, Math.min(1, (sound.vol ?? 0.7) * 0.92 * (Number.isFinite(fx) ? fx : 1)));
        if (isShadowFull) a.playbackRate = 0.85;
        cryEls.push(a);
        a.play().catch((e) => warnDev('audio-boss', e));
      } catch (e) { warnDev('audio-boss', e); }
    }
    if (isShadowFull) {
      try {
        const dist = makeDistortion(c, 10);
        const rGain = c.createGain();
        rGain.gain.setValueAtTime(0.0001, tHit);
        rGain.gain.exponentialRampToValueAtTime(0.45, tHit + 0.15);
        rGain.gain.setValueAtTime(0.45, tHit + 1.2);
        rGain.gain.exponentialRampToValueAtTime(0.0001, tHit + 2.0);
        const r1 = c.createOscillator(), r2 = c.createOscillator();
        r1.type = 'sawtooth'; r1.frequency.setValueAtTime(240, tHit); r1.frequency.exponentialRampToValueAtTime(85, tHit + 1.8);
        r2.type = 'sawtooth'; r2.frequency.setValueAtTime(160, tHit); r2.frequency.exponentialRampToValueAtTime(55, tHit + 1.9);
        const lfo = c.createOscillator(), lfoG = c.createGain();
        lfo.frequency.value = 9; lfoG.gain.value = 25;
        lfo.connect(lfoG); lfoG.connect(r1.frequency); lfoG.connect(r2.frequency);
        r1.connect(dist); r2.connect(dist); dist.connect(rGain); rGain.connect(bus);
        lfo.start(tHit); lfo.stop(tHit + 2.0);
        r1.start(tHit); r1.stop(tHit + 2.05);
        r2.start(tHit); r2.stop(tHit + 2.05);
        nodes.push(lfo, r1, r2);
      } catch (e) { warnDev('audio-boss', e); }
    }
  }, Math.round(tShatter * 1000)));

  // 5. Motif héroïque de révélation & pulsations rythmiques finales
  timers.push(setTimeout(() => {
    if (stopped) return;
    const tAct3 = c.currentTime;
    const span = Math.max(1.2, dur - tShatter);
    (prof.fanfare || []).forEach(([rel, dFrac, iv]) => {
      const offset = Math.max(0, (rel - shatterFrac)) * dur;
      const m = Math.max(30, Math.min(104, baseMidi + iv));
      sound.tone(prof.padWave === 'triangle' ? 'pulse25' : 'sawtooth', freq(m), tAct3 + offset, Math.max(0.22, dFrac * dur), 0.16, bus, { attack: 0.02, release: 0.18 });
      sound.tone('triangle', freq(m + 12), tAct3 + offset, Math.max(0.22, dFrac * dur), 0.10, bus, { attack: 0.02, release: 0.18 });
    });
    const beats = isShadowFull ? 6 : 4;
    const beatDt = (span * 0.85) / beats;
    for (let i = 0; i < beats; i++) {
      const bT = tAct3 + i * beatDt;
      sound.tone('triangle', prof.drum === 'taiko' ? 145 : 130, bT, 0.2, 0.36, bus, { slide: 38 });
      sound.tone('noise', 1400, bT + beatDt * 0.5, 0.08, 0.18, bus, { filter: 'bandpass' });
    }
  }, Math.round((tShatter + 0.18) * 1000)));

  // 6. Climax / Plongée finale
  const tClimax = isShadowFull ? 10.8 : dur * 0.78;
  timers.push(setTimeout(() => {
    if (stopped) return;
    const tHit = c.currentTime;
    sound.tone('noise', 280, tHit, 0.55, 0.55, bus, { filter: 'lowpass' });
    sound.tone('triangle', 175, tHit, 0.5, 0.5, bus, { slide: 32 });
    sound.tone('pulse25', 1650, tHit, 0.14, 0.22, bus, { slide: 210 });
  }, Math.round(tClimax * 1000)));

  return { stop };
}
