// odyssee/js/audio-wow.js — Musiques stylées (#1/#4), ambiances immersives et sound design WebAudio avancé
import { midiOf } from './audio-boss.js';

const at = (bar, step) => bar * 16 + step;

export const WOW_THEMES = {
  aurora: { custom: 'aurora', key: 'F3', scale: 'maj', bpm: 88, prog: ['I'], seed: 301, style: 'mystery' },
  meteor: { custom: 'meteor', key: 'D3', scale: 'min', bpm: 118, prog: ['i'], seed: 302, style: 'swing' },
  riftBattle: { custom: 'riftBattle', key: 'E3', scale: 'harm', bpm: 170, prog: ['i'], seed: 303, style: 'battle', big: 1 },
  alphaBoss: { custom: 'alphaBoss', key: 'C3', scale: 'harm', bpm: 176, prog: ['i'], seed: 304, style: 'battle', big: 1 },
};

/**
 * Thème Aurore Boréale (88 BPM, 16 mesures = 256 pas, Lydien Fmaj7 → G → Em7 → Am7).
 * Nappes chatoyantes, clochettes célestes, piano électrique doux et mélodie de flûte planante.
 */
function composeAurora() {
  const F = midiOf('F3'); // 53
  const tracks = { pad: [], bell: [], arp: [], bass: [], flute: [], drum: [] };
  // Progression rêveuse sur 8 mesures répétée deux fois avec variations
  const prog = [
    [0, 4, 7, 11],    // Fmaj7
    [2, 6, 9, 14],    // G6
    [-1, 2, 7, 11],   // Em7
    [4, 7, 11, 16],   // Am9
    [-2, 2, 5, 9],    // Dmaj7/Eb coloration
    [0, 4, 7, 11],    // Fmaj7
    [2, 7, 11, 14],   // Gadd9
    [4, 9, 11, 16],   // Am7
  ];
  const melA = [
    [0, 6, 12], [6, 2, 16], [8, 8, 19],
    [16, 4, 23], [20, 4, 24], [24, 8, 19],
    [32, 6, 16], [38, 2, 14], [40, 8, 12],
    [48, 4, 14], [52, 4, 16], [56, 8, 19],
  ];
  const melB = [
    [0, 4, 24], [4, 4, 26], [8, 8, 28],
    [16, 4, 26], [20, 4, 24], [24, 8, 23],
    [32, 6, 19], [38, 2, 21], [40, 8, 23],
    [48, 8, 24], [56, 8, 19],
  ];
  for (let b = 0; b < 16; b++) {
    const ch = prog[b % 8];
    for (const iv of ch) tracks.pad.push({ s: at(b, 0), d: 16, m: F - 12 + iv, v: 0.75 });
    tracks.bass.push({ s: at(b, 0), d: 8, m: F - 24 + ch[0], v: 0.9 });
    tracks.bass.push({ s: at(b, 8), d: 8, m: F - 24 + ch[2], v: 0.72 });
    // Arpèges de verre tous les 2 pas
    for (let k = 0; k < 16; k += 2) {
      const iv = ch[(k / 2) % ch.length];
      tracks.arp.push({ s: at(b, k), d: 2, m: F + iv + (k % 8 === 6 ? 12 : 0), v: 0.68 });
    }
    // Étincelles celesta en contretemps
    if (b % 2 === 0) {
      tracks.bell.push({ s: at(b, 4), d: 6, m: F + 12 + ch[3], v: 0.75 });
      tracks.bell.push({ s: at(b, 12), d: 6, m: F + 24 + ch[1], v: 0.55 });
    } else {
      tracks.bell.push({ s: at(b, 2), d: 6, m: F + 24 + ch[0], v: 0.65 });
      tracks.bell.push({ s: at(b, 10), d: 6, m: F + 12 + ch[2], v: 0.7 });
    }
    // Charlestons très légers sur les mesures paires
    if (b >= 4) {
      tracks.drum.push({ s: at(b, 0), k: 'h', v: 0.4 });
      tracks.drum.push({ s: at(b, 8), k: 'h', v: 0.35 });
    }
    const mel = b < 8 ? melA : melB;
    const localBar = b % 4;
    for (const [st, d, iv] of mel) {
      if (Math.floor(st / 16) === localBar) {
        tracks.flute.push({ s: at(b, st % 16), d, m: F + iv, v: 0.92 });
      }
    }
  }
  return {
    steps: 256,
    loopStart: 0,
    bpm: 88,
    tracks: [
      { type: 'sawtooth', vol: 0.04, notes: tracks.pad, attack: 0.45, release: 0.5 },
      { type: 'triangle', vol: 0.13, notes: tracks.bass, attack: 0.04, release: 0.2 },
      { type: 'pulse50', vol: 0.045, notes: tracks.arp },
      { type: 'sine', vol: 0.06, notes: tracks.bell, release: 0.45 },
      { type: 'triangle', vol: 0.10, notes: tracks.flute, attack: 0.08, release: 0.3 },
      { type: 'drum', vol: 0.045, notes: tracks.drum },
    ],
  };
}

/**
 * Thème Pluie d'Étoiles (118 BPM, 16 mesures = 256 pas, Dm9 → Bbmaj7 → C6 → Am7).
 * Arpèges synthwave stellaires, carillons d'étoiles filantes et rythmique feutrée.
 */
function composeMeteor() {
  const D = midiOf('D3'); // 50
  const tracks = { pad: [], arp: [], bell: [], bass: [], lead: [], drum: [] };
  const prog = [
    [0, 3, 7, 14],    // Dm9
    [-4, 0, 3, 7],    // Bbmaj7
    [-2, 2, 5, 10],   // C6 / C7sus
    [-5, -2, 2, 7],   // Am7
  ];
  const riff = [0, 7, 12, 14, 15, 14, 12, 7];
  const motif = [
    [0, 3, 12], [3, 3, 15], [6, 2, 19], [8, 4, 22], [12, 4, 19],
    [16, 3, 17], [19, 3, 15], [22, 2, 14], [24, 8, 12],
    [32, 3, 15], [35, 3, 19], [38, 2, 22], [40, 4, 24], [44, 4, 22],
    [48, 4, 19], [52, 4, 15], [56, 8, 14],
  ];
  for (let b = 0; b < 16; b++) {
    const ch = prog[b % 4];
    for (const iv of ch) tracks.pad.push({ s: at(b, 0), d: 16, m: D - 12 + iv, v: b < 2 ? 0.55 : 0.8 });
    // Basse synthwave pulsée en croches
    for (let k = 0; k < 16; k += 2) {
      tracks.bass.push({ s: at(b, k), d: 2, m: D - 24 + ch[0] + (k % 8 === 6 ? 12 : 0), v: k % 4 === 0 ? 1 : 0.72 });
    }
    // Arpèges stellaires en doubles croches rapides
    for (let k = 0; k < 16; k += 2) {
      const iv = riff[(k / 2) % riff.length];
      tracks.arp.push({ s: at(b, k), d: 1, m: D + ch[0] + iv, v: 0.75 });
    }
    // Carillons descendants simulant les étoiles filantes
    if (b % 2 === 1) {
      [0, 2, 4].forEach((off, i) => tracks.bell.push({ s: at(b, 10 + off), d: 3, m: D + 26 - i * 3, v: 0.7 - i * 0.12 }));
    }
    if (b >= 2) {
      for (let k = 0; k < 16; k++) {
        if (k % 4 === 0) tracks.drum.push({ s: at(b, k), k: 'k', v: 0.85 });
        if (k % 8 === 4) tracks.drum.push({ s: at(b, k), k: 's', v: 0.65 });
        if (k % 2 === 1) tracks.drum.push({ s: at(b, k), k: 'h', v: 0.45 });
      }
      if (b % 4 === 2) tracks.drum.push({ s: at(b, 0), k: 'c', v: 0.5 });
    }
    const localBar = b % 4;
    for (const [st, d, iv] of motif) {
      if (Math.floor(st / 16) === localBar && b >= 4) {
        tracks.lead.push({ s: at(b, st % 16), d, m: D + 12 + iv, v: 0.9 });
      }
    }
  }
  return {
    steps: 256,
    loopStart: 32,
    bpm: 118,
    tracks: [
      { type: 'sawtooth', vol: 0.045, notes: tracks.pad, attack: 0.25 },
      { type: 'triangle', vol: 0.13, notes: tracks.bass },
      { type: 'pulse50', vol: 0.055, notes: tracks.arp },
      { type: 'sine', vol: 0.065, notes: tracks.bell, release: 0.35 },
      { type: 'pulse25', vol: 0.075, notes: tracks.lead },
      { type: 'drum', vol: 0.075, notes: tracks.drum },
    ],
  };
}

/**
 * Thème Combat Faille Spatio-Temporelle (170 BPM, 20 mesures = 320 pas, loopStart: 64).
 * Sonorités phrygiennes nerveuses, arpèges tordus, guitare saturée et batterie agressive.
 */
function composeRiftBattle() {
  const E = midiOf('E3'); // 52
  const tracks = { pad: [], arp: [], lead: [], subLead: [], gtr: [], bass: [], drum: [] };
  const chords = [
    [0, 1, 7],   // E + F (Phrygien)
    [1, 5, 8],   // Fmaj/aug tension
    [3, 7, 10],  // G
    [-2, 5, 7],  // Dsus
  ];
  const mel = [
    [0, 2, 12], [2, 2, 13], [4, 2, 15], [6, 2, 19], [8, 4, 18], [12, 2, 15], [14, 2, 13],
    [16, 2, 12], [18, 2, 10], [20, 4, 13], [24, 4, 15], [28, 4, 19],
    [32, 3, 24], [35, 3, 22], [38, 2, 19], [40, 4, 18], [44, 4, 15],
    [48, 2, 13], [50, 2, 15], [52, 4, 19], [56, 8, 12],
  ];
  for (let b = 0; b < 20; b++) {
    const ch = chords[b % 4];
    for (const iv of ch) tracks.pad.push({ s: at(b, 0), d: 16, m: E - 12 + iv, v: 0.85 });
    for (let k = 0; k < 16; k += 2) {
      tracks.bass.push({ s: at(b, k), d: 2, m: E - 24 + ch[0] + (k % 4 === 2 ? 12 : 0) });
    }
    // Arpèges prismatiques rapides sur tout le morceau
    const seq = [ch[0], ch[1], ch[2], ch[1], ch[0] + 12, ch[2], ch[1] + 12, ch[2]];
    for (let k = 0; k < 16; k++) {
      const iv = seq[k % seq.length];
      tracks.arp.push({ s: at(b, k), d: 1, m: E + 12 + iv, v: b < 4 ? 0.55 + b * 0.1 : 0.9 });
    }
    if (b >= 4) {
      for (const st of [0, 3, 6, 8, 11, 14]) {
        tracks.gtr.push({ s: at(b, st), d: 2, m: E - 12 + ch[0], v: 1 });
        tracks.gtr.push({ s: at(b, st), d: 2, m: E - 12 + ch[0] + 7, v: 0.8 });
      }
      for (let k = 0; k < 16; k++) {
        if (k % 4 === 0 || k === 10) tracks.drum.push({ s: at(b, k), k: 'k' });
        if (k % 8 === 4) tracks.drum.push({ s: at(b, k), k: 's' });
        if (k % 2 === 1) tracks.drum.push({ s: at(b, k), k: 'h' });
      }
      if (b % 4 === 0) tracks.drum.push({ s: at(b, 0), k: 'c' });
      const local = b % 4;
      for (const [st, d, iv] of mel) {
        if (Math.floor(st / 16) === local) {
          tracks.lead.push({ s: at(b, st % 16), d, m: E + iv, v: 1 });
          tracks.subLead.push({ s: at(b, st % 16), d, m: E + iv - 5, v: 0.7 });
        }
      }
    } else if (b === 3) {   // un seul roulement : empilé quatre fois, il saturait
      for (let k = 12; k < 16; k++) tracks.drum.push({ s: at(3, k), k: 't', m: 54 - (k - 12) * 2 });
    }
  }
  return {
    steps: 320,
    loopStart: 64,
    bpm: 170,
    tracks: [
      { type: 'sawtooth', vol: 0.055, notes: tracks.pad, attack: 0.08 },
      { type: 'pulse12', vol: 0.05, notes: tracks.arp },
      { type: 'pulse25', vol: 0.11, notes: tracks.lead },
      { type: 'pulse50', vol: 0.045, notes: tracks.subLead },
      { type: 'sawtooth', vol: 0.04, notes: tracks.gtr, dist: true },
      { type: 'triangle', vol: 0.15, notes: tracks.bass },
      { type: 'drum', vol: 0.11, notes: tracks.drum },
    ],
  };
}

/**
 * Thème Boss Alpha Géant (176 BPM, 20 mesures = 320 pas, loopStart: 64).
 * Rythmique lourde à double grosse caisse, cuivres mineurs harmoniques et guitares puissantes.
 */
function composeAlphaBoss() {
  const C = midiOf('C3'); // 48
  const tracks = { pad: [], arp: [], lead: [], subLead: [], gtr: [], bass: [], drum: [] };
  const chords = [
    [0, 3, 7],   // Cm
    [-4, 0, 3],  // Ab
    [-1, 2, 7],  // G
    [-2, 2, 5],  // Bb
  ];
  const mel = [
    [0, 4, 12], [4, 2, 15], [6, 2, 19], [8, 6, 20], [14, 2, 19],
    [16, 4, 15], [20, 4, 14], [24, 8, 11],
    [32, 3, 12], [35, 3, 14], [38, 2, 15], [40, 4, 19], [44, 4, 23],
    [48, 4, 24], [52, 4, 20], [56, 8, 19],
  ];
  for (let b = 0; b < 20; b++) {
    const ch = chords[b % 4];
    for (const iv of ch) tracks.pad.push({ s: at(b, 0), d: 16, m: C - 12 + iv, v: 0.9 });
    for (let k = 0; k < 16; k += 2) {
      tracks.bass.push({ s: at(b, k), d: 2, m: C - 24 + ch[0] + (k % 8 === 6 ? 7 : 0) });
      tracks.arp.push({ s: at(b, k), d: 2, m: C + 12 + ch[(k / 2) % 3], v: 0.72 });
    }
    if (b >= 4) {
      for (const st of [0, 3, 6, 8, 10, 12, 14]) {
        tracks.gtr.push({ s: at(b, st), d: 2, m: C - 12 + ch[0], v: 1 });
        tracks.gtr.push({ s: at(b, st), d: 2, m: C - 12 + ch[0] + 7, v: 0.85 });
      }
      for (let k = 0; k < 16; k++) {
        if ([0, 2, 6, 8, 10, 14].includes(k)) tracks.drum.push({ s: at(b, k), k: 'k' });
        if (k % 8 === 4) tracks.drum.push({ s: at(b, k), k: 's' });
        if (k % 2 === 1) tracks.drum.push({ s: at(b, k), k: 'h' });
      }
      if (b % 4 === 0) tracks.drum.push({ s: at(b, 0), k: 'c' });
      if (b % 4 === 3) {
        tracks.drum.push({ s: at(b, 12), k: 't', m: 52 });
        tracks.drum.push({ s: at(b, 14), k: 't', m: 46 });
      }
      const local = b % 4;
      for (const [st, d, iv] of mel) {
        if (Math.floor(st / 16) === local) {
          tracks.lead.push({ s: at(b, st % 16), d, m: C + iv, v: 1 });
          tracks.subLead.push({ s: at(b, st % 16), d, m: C + iv + 12, v: 0.55 });
        }
      }
    } else {
      for (let k = 0; k < 16; k += 4) tracks.drum.push({ s: at(b, k), k: 'k', v: 0.5 + b * 0.12 });
    }
  }
  return {
    steps: 320,
    loopStart: 64,
    bpm: 176,
    tracks: [
      { type: 'sawtooth', vol: 0.06, notes: tracks.pad, attack: 0.08 },
      { type: 'pulse50', vol: 0.045, notes: tracks.arp },
      { type: 'pulse25', vol: 0.115, notes: tracks.lead },
      { type: 'pulse12', vol: 0.055, notes: tracks.subLead },
      { type: 'sawtooth', vol: 0.045, notes: tracks.gtr, dist: true },
      { type: 'triangle', vol: 0.16, notes: tracks.bass },
      { type: 'drum', vol: 0.12, notes: tracks.drum },
    ],
  };
}

export const WOW_COMPOSERS = {
  aurora: composeAurora,
  meteor: composeMeteor,
  riftBattle: composeRiftBattle,
  alphaBoss: composeAlphaBoss,
};

export const WOW_SFX_KEYS = [
  'astrolabe', 'aurora_cast', 'meteor_cast', 'meteor_pick',
  'rift_open', 'rift_enter', 'rift_impact', 'rift_exit', 'rift_seal', 'alpha_roar', 'memory_unlock',
  'aura_stars', 'aura_petals', 'aura_sparks', 'aura_crimson',
  'follower_happy', 'quest_complete',
  'amb_rain', 'amb_thunder', 'amb_wind_gust', 'amb_aurora',
  'amb_shooting_star', 'amb_rift_hum', 'amb_volcano', 'amb_mystic', 'amb_musician',
];

/**
 * Exécute les bruitages stylés et sons d'ambiance avancés.
 * Renvoie true si la clé `k` a été traitée, false sinon.
 */
export function playWowSfx(sound, k, t, B, P, n) {
  switch (k) {
    case 'astrolabe':
      sound.tone('noise', 5200, t, 0.03, 0.08, B, { filter: 'bandpass' });
      [['E5', 0], ['G#5', 0.05], ['B5', 0.1], ['E6', 0.16]].forEach(([m, dt]) => {
        P(n(m), dt, 0.24, 0.075, 'sine');
      });
      return true;
    case 'aurora_cast':
      sound.duck(1700);
      sound.tone('sine', n('F3'), t, 1.3, 0.09, B, { attack: 0.25, release: 0.6 });
      sound.tone('sine', n('C4'), t + 0.08, 1.2, 0.07, B, { attack: 0.25, release: 0.6 });
      [['F5', 0.05], ['A5', 0.13], ['C6', 0.21], ['E6', 0.29], ['G6', 0.37], ['C7', 0.46]].forEach(([m, dt], i) => {
        P(n(m), dt, i === 5 ? 0.75 : 0.22, 0.075, 'sine');
      });
      return true;
    case 'meteor_cast':
      sound.duck(1500);
      sound.tone('sine', n('E7'), t, 0.42, 0.11, B, { slide: n('D5'), release: 0.2 });
      sound.tone('noise', 3400, t + 0.04, 0.35, 0.07, B, { filter: 'bandpass' });
      [['A6', 0.25], ['F#6', 0.38], ['D7', 0.52]].forEach(([m, dt]) => P(n(m), dt, 0.32, 0.08, 'sine'));
      sound.tone('triangle', 85, t + 0.28, 0.28, 0.16, B, { slide: 36 });
      return true;
    case 'meteor_pick':
      [['D6', 0], ['F#6', 0.06], ['A6', 0.12], ['D7', 0.2]].forEach(([m, dt], i) => {
        P(n(m), dt, i === 3 ? 0.5 : 0.14, 0.09, 'sine');
      });
      P(n('A4'), 0, 0.45, 0.06, 'triangle');
      return true;
    case 'rift_open':
      sound.duck(1800);
      sound.tone('sawtooth', 180, t, 0.48, 0.14, B, { slide: 42 });
      sound.tone('noise', 2200, t + 0.04, 0.42, 0.16, B, { filter: 'bandpass' });
      [['E5', 0.16], ['Bb5', 0.24], ['E6', 0.34]].forEach(([m, dt]) => P(n(m), dt, 0.36, 0.08, 'pulse12'));
      return true;
    case 'rift_enter': {
      // la chute : un souffle qui monte, un grondement qui s'enfonce, des éclats qui filent de plus en plus vite
      sound.duck(2600);
      sound.tone('noise', 500, t, 2.2, 0.12, B, { filter: 'bandpass', attack: 1.3, release: 0.5, slide: 5200 });
      sound.tone('sawtooth', 62, t, 2.1, 0.12, B, { slide: 210, attack: 0.5, release: 0.3 });
      sound.tone('triangle', 130, t, 2.2, 0.12, B, { slide: 33, attack: 0.1, release: 0.4 });
      let dt = 0.1;
      for (let i = 0; i < 15; i++) { P(n(['E5', 'Bb5', 'C6', 'F6', 'Bb6'][i % 5]), dt, 0.09, 0.03 + i * 0.0022, 'sine'); dt += 0.22 - i * 0.0105; }
      return true;
    }
    case 'rift_impact':
      sound.duck(1200);
      sound.tone('triangle', 150, t, 0.7, 0.3, B, { slide: 30, release: 0.4 });
      sound.tone('noise', 1400, t, 0.4, 0.14, B, { filter: 'lowpass', release: 0.35 });
      [['E4', 0], ['B4', 0.02], ['E5', 0.04], ['Bb5', 0.07]].forEach(([m, d]) => P(n(m), d, 0.9, 0.05, 'sine'));
      return true;
    case 'rift_exit':
      // l'implosion : tout se rétracte vers le haut, puis un vide
      sound.duck(1600);
      sound.tone('noise', 3200, t, 1.05, 0.12, B, { filter: 'bandpass', attack: 0.9, release: 0.06 });
      sound.tone('sawtooth', 50, t, 1.05, 0.1, B, { slide: 620, attack: 0.5, release: 0.05 });
      ['Bb6', 'F6', 'C6', 'Bb5', 'F5', 'E5'].forEach((m, i) => P(n(m), 0.1 + i * 0.15, 0.12, 0.04, 'sine'));
      return true;
    case 'rift_seal':
      sound.duck(1800);
      [['C5', 0], ['G5', 0.08], ['D6', 0.16], ['E6', 0.24], ['G6', 0.34]].forEach(([m, dt], i) => {
        P(n(m), dt, i === 4 ? 0.8 : 0.18, 0.09, 'sine');
      });
      P(n('C4'), 0.08, 0.7, 0.07, 'triangle');
      return true;
    case 'alpha_roar':
      sound.duck(1700);
      sound.tone('sawtooth', 155, t, 0.62, 0.22, B, { slide: 44, release: 0.25 });
      sound.tone('triangle', 95, t + 0.04, 0.65, 0.24, B, { slide: 32, release: 0.3 });
      sound.tone('noise', 900, t + 0.02, 0.55, 0.2, B, { filter: 'lowpass', release: 0.35 });
      return true;
    case 'memory_unlock':
      sound.duck(1500);
      [['C5', 0], ['E5', 0.1], ['G5', 0.2], ['B5', 0.3], ['D6', 0.42]].forEach(([m, dt], i) => {
        P(n(m), dt, i === 4 ? 0.7 : 0.18, 0.085, 'sine');
      });
      P(n('C4'), 0, 0.7, 0.055, 'triangle');
      return true;
    case 'aura_stars':
      [['G5', 0], ['B5', 0.05], ['D6', 0.1], ['F#6', 0.15], ['A6', 0.2], ['D7', 0.26]].forEach(([m, dt], i) => {
        P(n(m), dt, i === 5 ? 0.4 : 0.12, 0.075, 'sine');
      });
      return true;
    case 'aura_petals':
      sound.tone('noise', 2600, t, 0.35, 0.04, B, { filter: 'bandpass', attack: 0.06, release: 0.2 });
      [['E6', 0.02], ['G#6', 0.09], ['B6', 0.16], ['E7', 0.24]].forEach(([m, dt]) => P(n(m), dt, 0.18, 0.06, 'sine'));
      return true;
    case 'aura_sparks':
      sound.tone('noise', 4600, t, 0.14, 0.09, B, { filter: 'bandpass' });
      [['E6', 0], ['B5', 0.05], ['E6', 0.1], ['B6', 0.15]].forEach(([m, dt]) => P(n(m), dt, 0.09, 0.075, 'pulse25'));
      return true;
    case 'aura_crimson':
      sound.tone('noise', 620, t, 0.32, 0.15, B, { filter: 'lowpass', attack: 0.02, release: 0.22 });
      sound.tone('triangle', 120, t, 0.24, 0.16, B, { slide: 55 });
      [['C5', 0.06], ['G5', 0.14], ['C6', 0.22]].forEach(([m, dt]) => P(n(m), dt, 0.22, 0.085, 'pulse25'));
      return true;
    case 'follower_happy':
      P(n('C6'), 0, 0.07, 0.07, 'sine', { slide: n('E6') });
      P(n('G6'), 0.09, 0.14, 0.07, 'sine');
      return true;
    case 'quest_complete':
      sound.duck(2000);
      [['G4', 0], ['C5', 0.1], ['E5', 0.2], ['G5', 0.3], ['E5', 0.42], ['G5', 0.54], ['C6', 0.68]].forEach(([m, dt], i) => {
        P(n(m), dt, i === 6 ? 0.75 : 0.13, 0.09, 'pulse25');
      });
      P(n('C4'), 0.1, 0.85, 0.065, 'triangle');
      return true;
    // Ambiances sonores subtiles
    case 'amb_rain':
      sound.tone('noise', 2400, t, 1.4, 0.022, B, { filter: 'bandpass', attack: 0.3, release: 0.7 });
      sound.tone('noise', 900, t + 0.1, 1.3, 0.018, B, { filter: 'lowpass', attack: 0.3, release: 0.7 });
      return true;
    case 'amb_thunder':
      sound.tone('noise', 180, t, 1.6, 0.045, B, { filter: 'lowpass', attack: 0.15, release: 1.2 });
      sound.tone('triangle', 58, t + 0.08, 1.1, 0.035, B, { slide: 30 });
      return true;
    case 'amb_wind_gust':
      sound.tone('noise', 720, t, 1.8, 0.025, B, { filter: 'bandpass', attack: 0.5, release: 0.9 });
      return true;
    case 'amb_aurora':
      P(n('F5'), 0, 0.8, 0.018, 'sine');
      P(n('C6'), 0.18, 0.75, 0.015, 'sine');
      P(n('G6'), 0.35, 0.65, 0.012, 'sine');
      return true;
    case 'amb_shooting_star':
      sound.tone('sine', 2400, t, 0.24, 0.022, B, { slide: 920 });
      P(n('A6'), 0.18, 0.22, 0.02, 'sine');
      return true;
    case 'amb_rift_hum':
      P(n('E3'), 0, 0.45, 0.025, 'triangle', { slide: n('F3') });
      P(n('Bb5'), 0.16, 0.18, 0.018, 'sine');
      return true;
    case 'amb_volcano':
      sound.tone('noise', 240, t, 1.1, 0.03, B, { filter: 'lowpass', attack: 0.25, release: 0.65 });
      sound.tone('triangle', 64, t, 0.7, 0.025, B, { slide: 42 });
      return true;
    case 'amb_mystic':
      [['A5', 0], ['E6', 0.22], ['D6', 0.44]].forEach(([m, dt]) => P(n(m), dt, 0.35, 0.018, 'sine'));
      return true;
    case 'amb_musician':
      [['G5', 0], ['A5', 0.14], ['B5', 0.28], ['D6', 0.42], ['B5', 0.58], ['G5', 0.74]].forEach(([m, dt]) => {
        P(n(m), dt, 0.16, 0.05, 'triangle');
      });
      return true;
    default:
      return false;
  }
}
