// odyssee/js/audio-failles.js — les musiques des failles : une par sorte d'île, le trône, et le combat du gardien.
//   ileInverse : un motif, puis son reflet (retourné et joué à l'envers), sans fin      ileChaos : quatre climats qui se relaient
//   ileAlpha   : un cœur énorme qui bat sous la roche                                   ileTrone : orgue et timbales, la montée vers le gardien
//   gardienFaille : le combat du gardien
import { midiOf } from './audio-boss.js';

const at = (mesure, pas) => mesure * 16 + pas;
/** ramène un degré sur la gamme mineure (une transposition ou un reflet garde la couleur de l'île) */
const MINEUR = [0, 2, 3, 5, 7, 8, 10];
const surGamme = (n) => { const o = Math.floor(n / 12), d = n - o * 12; return o * 12 + MINEUR.reduce((a, g) => (Math.abs(g - d) < Math.abs(a - d) ? g : a), 0); };

export const FAILLES_THEMES = {
  ileInverse: { custom: 'ileInverse', key: 'A3', scale: 'min', bpm: 100, prog: ['i'], seed: 401, style: 'mystery' },
  ileChaos: { custom: 'ileChaos', key: 'D3', scale: 'min', bpm: 126, prog: ['i'], seed: 402, style: 'swing' },
  ileAlpha: { custom: 'ileAlpha', key: 'C3', scale: 'min', bpm: 84, prog: ['i'], seed: 403, style: 'mystery' },
  ileTrone: { custom: 'ileTrone', key: 'D3', scale: 'harm', bpm: 76, prog: ['i'], seed: 404, style: 'mystery' },
  gardienFaille: { custom: 'gardienFaille', key: 'D3', scale: 'harm', bpm: 182, prog: ['i'], seed: 405, style: 'battle', big: 1 },
};

/** Îles du Reflet (100 BPM, 16 mesures) : le motif monte, son reflet redescend en miroir pendant que la basse échange sa place avec lui */
function composeIleInverse() {
  const A = midiOf('A3'), t = { pad: [], basse: [], arp: [], miroir: [], cloche: [], voix: [], drum: [] };
  const acc = [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -4, 0, 5], [-5, -2, 2, 7]];
  const motif = [[0, 3, 0], [3, 3, 3], [6, 2, 7], [8, 4, 10], [12, 2, 8], [14, 2, 7]];            // [pas, durée, degré]
  const reflet = motif.map(([p, d, n]) => [16 - p - d, d, surGamme(12 - n)]).sort((x, y) => x[0] - y[0]);      // retourné et à l'envers
  for (let b = 0; b < 16; b++) {
    const ch = acc[b % 4], envers = Math.floor(b / 4) % 2 === 1;
    for (const n of ch) t.pad.push({ s: at(b, 0), d: 16, m: A - 12 + n, v: 0.8 });
    t.basse.push({ s: at(b, 0), d: 6, m: A - 24 + ch[0], v: 1 }, { s: at(b, 6), d: 4, m: A - 24 + ch[0] + 12, v: 0.6 }, { s: at(b, 10), d: 6, m: A - 24 + ch[2], v: 0.85 });
    for (let k = 0; k < 16; k++) {
      const i = k < 8 ? k : 15 - k;                                                                   // l'arpège monte puis revient sur ses pas
      t.arp.push({ s: at(b, k), d: 1, m: A + 12 + ch[(envers ? 3 - (i % 4) : i % 4)] + (i >= 4 ? 12 : 0), v: k % 4 === 0 ? 0.85 : 0.55 });
    }
    if (b >= 2) for (const [p, d, n] of envers ? reflet : motif) t.voix.push({ s: at(b, p), d, m: A + 12 + surGamme(n + (b % 2 ? ch[0] : 0)), v: 0.9 });
    if (b >= 8) for (const [p, d, n] of envers ? motif : reflet) t.miroir.push({ s: at(b, p), d, m: A + n, v: 0.7 });
    if (b % 2 === 1) t.cloche.push({ s: at(b, 4), d: 8, m: A + 24 + ch[2], v: 0.6 }, { s: at(b, 12), d: 4, m: A + 24 + ch[1], v: 0.45 });
    if (b >= 4) { t.drum.push({ s: at(b, 0), k: 'k', v: 0.7 }, { s: at(b, 10), k: 'k', v: 0.5 }, { s: at(b, 8), k: 's', v: 0.45 }); for (let k = 2; k < 16; k += 4) t.drum.push({ s: at(b, k), k: 'h', v: 0.4 }); }
    if (b === 7 || b === 15) for (let k = 12; k < 16; k++) t.drum.push({ s: at(b, k), k: 't', m: 60 - (k - 12) * 3, v: 0.5 });
  }
  return {
    steps: 256, loopStart: 64, bpm: 100,
    tracks: [
      { type: 'sawtooth', vol: 0.045, notes: t.pad, attack: 0.35, release: 0.4 }, { type: 'triangle', vol: 0.15, notes: t.basse }, { type: 'pulse12', vol: 0.042, notes: t.arp },
      { type: 'pulse25', vol: 0.08, notes: t.voix, attack: 0.02 }, { type: 'pulse50', vol: 0.05, notes: t.miroir }, { type: 'sine', vol: 0.07, notes: t.cloche, release: 0.6 }, { type: 'drum', vol: 0.07, notes: t.drum },
    ],
  };
}

/** Îles des Quatre Vents (126 BPM, 16 mesures) : pluie, soleil, sable, glace ; quatre mesures chacun, le même thème à chaque fois habillé autrement */
function composeIleChaos() {
  const D = midiOf('D3'), t = { pad: [], basse: [], arp: [], cloche: [], lead: [], drum: [] };
  const climats = [
    { acc: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], gamme: [0, 2, 3, 5, 7, 8, 10] },       // pluie : mineur, gouttes qui tombent
    { acc: [[-4, 0, 3], [3, 7, 10], [-2, 2, 5], [0, 4, 7]], gamme: [0, 2, 3, 5, 7, 8, 10] },        // soleil : les accords s'ouvrent
    { acc: [[0, 4, 7], [1, 5, 8], [0, 4, 7], [-2, 1, 5]], gamme: [0, 1, 4, 5, 7, 8, 10] },          // sable : phrygien majeur, percussions
    { acc: [[0, 3, 10], [-4, 0, 7], [-7, 0, 3], [-5, 2, 5]], gamme: [0, 2, 3, 5, 7, 8, 10] },       // glace : clochettes, presque rien d'autre
  ];
  const theme = [[0, 4, 0], [4, 2, 4], [6, 4, 2], [10, 2, 3], [12, 4, 4], [16, 4, 5], [20, 2, 4], [22, 6, 2], [28, 4, 1], [32, 4, 2], [36, 2, 4], [38, 4, 6], [42, 2, 5], [44, 4, 4], [48, 6, 3], [54, 2, 1], [56, 8, 0]];
  for (let b = 0; b < 16; b++) {
    const c = Math.floor(b / 4), C = climats[c], ch = C.acc[b % 4];
    for (const n of ch) t.pad.push({ s: at(b, 0), d: 16, m: D + n, v: c === 3 ? 0.5 : 0.8 });
    if (c === 0) { for (let k = 0; k < 16; k += 1) t.arp.push({ s: at(b, k), d: 1, m: D + 24 + ch[(15 - k) % 3] + (k < 8 ? 12 : 0), v: 0.4 + 0.25 * ((k * 7) % 3) / 2 }); for (let k = 0; k < 16; k += 4) t.basse.push({ s: at(b, k), d: 3, m: D - 12 + ch[0] }); }
    if (c === 1) { for (let k = 0; k < 16; k += 2) t.arp.push({ s: at(b, k), d: 2, m: D + 12 + ch[(k / 2) % 3] + (k % 8 === 6 ? 12 : 0), v: 0.7 }); for (const k of [0, 3, 6, 8, 11, 14]) t.basse.push({ s: at(b, k), d: 2, m: D - 12 + ch[0] + (k === 6 || k === 14 ? 12 : 0) }); }
    if (c === 2) { for (const k of [0, 3, 6, 10, 12]) t.basse.push({ s: at(b, k), d: 2, m: D - 12 + ch[0] }); for (const k of [0, 1, 4, 6, 7, 10, 12, 13]) t.arp.push({ s: at(b, k), d: 1, m: D + 12 + C.gamme[(k * 3 + b) % 7], v: 0.7 }); }
    if (c === 3) { t.basse.push({ s: at(b, 0), d: 14, m: D - 12 + ch[0], v: 0.7 }); for (let k = 0; k < 16; k += 4) t.cloche.push({ s: at(b, k), d: 6, m: D + 24 + ch[(k / 4) % 3] + (k === 8 ? 12 : 0), v: 0.75 }); t.cloche.push({ s: at(b, 14), d: 4, m: D + 36 + ch[1], v: 0.5 }); }
    for (const [p, d, n] of theme) if (Math.floor(p / 16) === b % 4) t.lead.push({ s: at(b, p % 16), d, m: D + (c === 3 ? 24 : 12) + C.gamme[n % 7] + (n >= 7 ? 12 : 0), v: c === 3 ? 0.6 : 0.9 });
    // la batterie change de monde elle aussi
    if (c === 0) for (let k = 0; k < 16; k++) { if (k % 8 === 0) t.drum.push({ s: at(b, k), k: 'k', v: 0.6 }); if (k % 2) t.drum.push({ s: at(b, k), k: 'h', v: 0.3 + (k % 3) * 0.1 }); }
    if (c === 1) for (let k = 0; k < 16; k++) { if (k % 4 === 0) t.drum.push({ s: at(b, k), k: 'k', v: 0.85 }); if (k % 8 === 4) t.drum.push({ s: at(b, k), k: 's', v: 0.65 }); if (k % 4 === 2) t.drum.push({ s: at(b, k), k: 'h', v: 0.5 }); }
    if (c === 2) for (const [k, m] of [[0, 48], [3, 58], [4, 52], [6, 58], [8, 48], [10, 55], [11, 58], [13, 52], [14, 60]]) t.drum.push({ s: at(b, k), k: 't', m, v: 0.6 });
    if (c === 3 && b % 2 === 0) t.drum.push({ s: at(b, 0), k: 'h', v: 0.4 });
    if (b % 4 === 3) t.drum.push({ s: at(b, 12), k: 's', v: 0.4 }, { s: at(b, 14), k: 's', v: 0.55 });
    if (b % 4 === 0) t.drum.push({ s: at(b, 0), k: 'c', v: 0.45 });
  }
  return {
    steps: 256, loopStart: 0, bpm: 126,
    tracks: [
      { type: 'sawtooth', vol: 0.045, notes: t.pad, attack: 0.15 }, { type: 'triangle', vol: 0.15, notes: t.basse }, { type: 'pulse25', vol: 0.045, notes: t.arp },
      { type: 'sine', vol: 0.085, notes: t.cloche, release: 0.6 }, { type: 'pulse50', vol: 0.075, notes: t.lead, attack: 0.02 }, { type: 'drum', vol: 0.085, notes: t.drum },
    ],
  };
}

/** Îles du Colosse (84 BPM, 12 mesures) : deux battements de cœur par mesure, des cuivres graves, un souffle qui se rapproche */
function composeIleAlpha() {
  const C = midiOf('C3'), t = { drone: [], basse: [], cuivre: [], souffle: [], lead: [], drum: [] };
  const acc = [[0, 7, 12], [0, 8, 13], [-2, 5, 10], [1, 8, 13]];
  const appel = [[0, 6, 0], [6, 2, 1], [8, 8, -2], [16, 6, 0], [22, 2, 3], [24, 8, 1], [32, 4, 5], [36, 4, 3], [40, 8, 1], [48, 3, 0], [51, 3, -1], [54, 10, 0]];
  for (let b = 0; b < 12; b++) {
    const ch = acc[b % 4], fort = b >= 4;
    for (const n of ch) t.drone.push({ s: at(b, 0), d: 16, m: C - 12 + n, v: 0.8 });
    t.basse.push({ s: at(b, 0), d: 7, m: C - 24 + ch[0], v: 1 }, { s: at(b, 8), d: 7, m: C - 24 + ch[0], v: 0.8 });
    // boum-boum… boum-boum
    for (const [k, v] of [[0, 1], [3, 0.65], [8, 1], [11, 0.65]]) t.drum.push({ s: at(b, k), k: 'k', v });
    if (fort) { t.drum.push({ s: at(b, 6), k: 't', m: 42, v: 0.6 }, { s: at(b, 14), k: 't', m: 40, v: 0.7 }, { s: at(b, 15), k: 't', m: 38, v: 0.8 }); if (b % 4 === 0) t.drum.push({ s: at(b, 0), k: 'c', v: 0.55 }); }
    if (b >= 8) for (let k = 2; k < 16; k += 4) t.drum.push({ s: at(b, k), k: 's', v: 0.25 + b * 0.02 });
    if (b % 2 === 1) for (const [k, n] of [[8, 0], [11, 1], [14, 7]]) t.cuivre.push({ s: at(b, k), d: 3, m: C - 12 + ch[0] + n, v: 0.9 });
    for (let k = 0; k < 16; k += 2) t.souffle.push({ s: at(b, k), d: 2, m: C + 12 + [0, 1, 0, 3, 1, 0, -2, 0][k / 2], v: fort ? 0.5 : 0.28 });
    if (fort) for (const [p, d, n] of appel) if (Math.floor(p / 16) === b % 4) t.lead.push({ s: at(b, p % 16), d, m: C + n, v: 0.95 });
  }
  return {
    steps: 192, loopStart: 64, bpm: 84,
    tracks: [
      { type: 'sawtooth', vol: 0.05, notes: t.drone, attack: 0.3, release: 0.4 }, { type: 'triangle', vol: 0.2, notes: t.basse }, { type: 'sawtooth', vol: 0.055, notes: t.cuivre, attack: 0.03, dist: true },
      { type: 'pulse12', vol: 0.03, notes: t.souffle }, { type: 'pulse25', vol: 0.085, notes: t.lead, attack: 0.04 }, { type: 'drum', vol: 0.15, notes: t.drum },
    ],
  };
}

/** Trône du Gardien (76 BPM, 16 mesures) : un orgue qui gravit les marches, les timbales au loin, un chœur qui se lève */
function composeIleTrone() {
  const D = midiOf('D3'), t = { choeur: [], orgue: [], basse: [], cloche: [], voix: [], drum: [] };
  const acc = [[0, 3, 7, 12], [-4, 0, 3, 8], [-7, -4, 0, 5], [-1, 2, 5, 11], [0, 3, 7, 12], [3, 7, 10, 15], [-2, 2, 5, 10], [-5, -1, 2, 7]];
  const chant = [[0, 8, 12], [8, 4, 11], [12, 4, 12], [16, 12, 8], [28, 4, 7], [32, 8, 5], [40, 4, 8], [44, 4, 7], [48, 16, 5], [64, 8, 12], [72, 4, 14], [76, 4, 15], [80, 12, 19], [92, 4, 17], [96, 8, 14], [104, 4, 12], [108, 4, 10], [112, 16, 11]];
  for (let b = 0; b < 16; b++) {
    const ch = acc[b % 8];
    for (const n of ch) t.choeur.push({ s: at(b, 0), d: 16, m: D + n, v: b < 4 ? 0.5 : 0.85 });
    t.basse.push({ s: at(b, 0), d: 15, m: D - 24 + ch[0] + (ch[0] < -5 ? 12 : 0), v: 1 });
    for (let k = 0; k < 16; k += 2) t.orgue.push({ s: at(b, k), d: 2, m: D + 12 + ch[[0, 1, 2, 3, 2, 3, 2, 1][k / 2]] + (b >= 8 && k >= 8 ? 12 : 0), v: 0.6 });
    if (b >= 4) for (const [p, d, n] of chant) if (Math.floor(p / 16) === b % 8) t.voix.push({ s: at(b, p % 16), d, m: D + n + (b >= 8 ? 12 : 0), v: 0.85 });
    if (b % 2 === 0) t.cloche.push({ s: at(b, 0), d: 14, m: D + 24 + ch[3] - 12, v: 0.7 });
    t.drum.push({ s: at(b, 0), k: 't', m: 38, v: 0.8 });
    if (b % 2 === 1) for (const [k, v] of [[10, 0.4], [12, 0.55], [13, 0.6], [14, 0.75], [15, 0.9]]) t.drum.push({ s: at(b, k), k: 't', m: 40 - (k > 12 ? 2 : 0), v });
    if (b % 8 === 0 && b) t.drum.push({ s: at(b, 0), k: 'c', v: 0.6 });
    if (b >= 8) t.drum.push({ s: at(b, 8), k: 'k', v: 0.7 });
  }
  return {
    steps: 256, loopStart: 64, bpm: 76,
    tracks: [
      { type: 'sawtooth', vol: 0.042, notes: t.choeur, attack: 0.5, release: 0.6 }, { type: 'pulse50', vol: 0.042, notes: t.orgue }, { type: 'triangle', vol: 0.17, notes: t.basse, attack: 0.05 },
      { type: 'sine', vol: 0.08, notes: t.cloche, release: 1 }, { type: 'triangle', vol: 0.11, notes: t.voix, attack: 0.12, release: 0.35 }, { type: 'drum', vol: 0.1, notes: t.drum },
    ],
  };
}

/** Combat du gardien (182 BPM, 28 mesures) : le chant du trône revient, au galop ; refrain, puis tout monte d'un ton pour la fin */
function composeGardien() {
  const D = midiOf('D3'), t = { pad: [], arp: [], lead: [], tierce: [], gtr: [], basse: [], drum: [] };
  const couplet = [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5]], refrain = [[-4, 0, 3], [-2, 2, 5], [0, 3, 7], [-1, 2, 7]];
  const A = [[0, 3, 12], [3, 3, 12], [6, 2, 14], [8, 3, 15], [11, 3, 14], [14, 2, 12], [16, 6, 11], [22, 2, 7], [24, 4, 8], [28, 4, 11], [32, 3, 12], [35, 3, 15], [38, 2, 19], [40, 3, 20], [43, 3, 19], [46, 2, 15], [48, 4, 17], [52, 4, 14], [56, 8, 10]];
  const R = [[0, 6, 20], [6, 2, 19], [8, 4, 15], [12, 4, 12], [16, 6, 22], [22, 2, 20], [24, 4, 17], [28, 4, 14], [32, 8, 24], [40, 4, 22], [44, 4, 19], [48, 4, 23], [52, 4, 19], [56, 4, 14], [60, 4, 11]];
  for (let b = 0; b < 28; b++) {
    const intro = b < 4, ref = b >= 12, ton = b >= 20 ? 2 : 0, ch = (ref ? refrain : couplet)[b % 4], T = D + ton;
    for (const n of ch) t.pad.push({ s: at(b, 0), d: 16, m: T + n, v: intro ? 0.6 + b * 0.1 : 0.85 });
    // galop : une croche, deux doubles
    for (let k = 0; k < 16; k += 4) for (const [o, d] of [[0, 2], [2, 1], [3, 1]]) t.basse.push({ s: at(b, k + o), d, m: T - 24 + ch[0] + (o === 3 && k === 12 ? 12 : 0), v: o ? 0.75 : 1 });
    for (let k = 0; k < 16; k++) t.arp.push({ s: at(b, k), d: 1, m: T + 12 + ch[[0, 1, 2, 1, 0, 2, 1, 2][k % 8]] + (ref && k % 8 >= 4 ? 12 : 0), v: intro ? 0.4 + b * 0.08 : 0.72 });
    if (!intro) {
      for (const k of ref ? [0, 3, 6, 8, 10, 12, 14] : [0, 3, 6, 10, 13]) { t.gtr.push({ s: at(b, k), d: 2, m: T - 12 + ch[0], v: 1 }, { s: at(b, k), d: 2, m: T - 12 + ch[0] + 7, v: 0.85 }); }
      const mel = ref ? R : A;
      for (const [p, d, n] of mel) if (Math.floor(p / 16) === b % 4) { t.lead.push({ s: at(b, p % 16), d, m: T + n, v: 1 }); if (ref || b >= 8) t.tierce.push({ s: at(b, p % 16), d, m: T + n - 12, v: 0.65 }); }
      for (let k = 0; k < 16; k++) {
        if (k % 4 === 0 || k % 4 === 3) t.drum.push({ s: at(b, k), k: 'k', v: k % 4 ? 0.7 : 1 });
        if (k % 8 === 4) t.drum.push({ s: at(b, k), k: 's' });
        if (k % 2 === 0) t.drum.push({ s: at(b, k), k: 'h', v: ref ? 0.9 : 0.6 });
      }
      if (b % 4 === 0) t.drum.push({ s: at(b, 0), k: 'c' });
      if (b % 4 === 3) for (let k = 12; k < 16; k++) t.drum.push({ s: at(b, k), k: 't', m: 58 - (k - 12) * 4 });
    } else {
      for (let k = 0; k < 16; k += 4) t.drum.push({ s: at(b, k), k: 't', m: 38 + (k === 12 ? 4 : 0), v: 0.6 + b * 0.1 });
      if (b === 3) for (let k = 8; k < 16; k++) if (k % 4) t.drum.push({ s: at(b, k), k: 's', v: 0.4 + (k - 8) * 0.07 });
    }
  }
  return {
    steps: 448, loopStart: 64, bpm: 182,
    tracks: [
      { type: 'sawtooth', vol: 0.05, notes: t.pad, attack: 0.06 }, { type: 'pulse12', vol: 0.042, notes: t.arp }, { type: 'pulse25', vol: 0.11, notes: t.lead }, { type: 'pulse50', vol: 0.05, notes: t.tierce },
      { type: 'sawtooth', vol: 0.042, notes: t.gtr, dist: true }, { type: 'triangle', vol: 0.15, notes: t.basse }, { type: 'drum', vol: 0.115, notes: t.drum },
    ],
  };
}

export const FAILLES_COMPOSERS = { ileInverse: composeIleInverse, ileChaos: composeIleChaos, ileAlpha: composeIleAlpha, ileTrone: composeIleTrone, gardienFaille: composeGardien };
