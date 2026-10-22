// Manuel de désamorçage : ses règles sont tirées d'un numéro d'édition, imprimé sur la bombe.
// Chaque partie a donc un manuel différent : impossible d'apprendre les tables par cœur.
// Moteur pur (aucun DOM) : la même fonction sert à l'hôte, aux vues et aux tests.
import { rngOf } from './rng.js';
import { RUNES } from './runes.js';

export const WIRE_COLORS = [
  { id: 'rouge', hex: '#d62828' }, { id: 'bleu', hex: '#1d5fd1' }, { id: 'jaune', hex: '#f2c200' },
  { id: 'blanc', hex: '#eeeae0' }, { id: 'noir', hex: '#1b1b1f' }, { id: 'vert', hex: '#23a050' },
];
export const KEY_COLORS = [
  { id: 'rouge', hex: '#e23b3b' }, { id: 'bleu', hex: '#2f6fe0' }, { id: 'jaune', hex: '#f4c51d' }, { id: 'vert', hex: '#2fb35c' },
];
export const GAUGE_COLORS = [
  { id: 'bleu', hex: '#2f7fe0' }, { id: 'vert', hex: '#2fb35c' }, { id: 'rouge', hex: '#e23b3b' }, { id: 'violet', hex: '#8a4fe0' },
];
export const LED_COLORS = [{ id: 'éteinte', hex: '#2a2a2a' }, { id: 'rouge', hex: '#ff3030' }, { id: 'bleue', hex: '#3aa0ff' }];
export const CITIES = ['NICE', 'MENTON', 'GRASSE', 'ANTIBES', 'CANNES', 'VENCE'];
export const INKS = ['rouge', 'bleue'];
export const OUTLETS = ['I', 'II', 'III', 'IV'];
export const LOT_LETTERS = 'ABCDEFGHJKLMNPRSTUVXZ';

const lastDigit = (lot) => { const d = lot.match(/\d/g); return d ? Number(d[d.length - 1]) : 0; };

// Conditions sur l'extérieur de la bombe (étiquette de lot, tampons, vis) : il faut la retourner pour les lire.
export const CONDS = [
  { id: 'lotPair', text: 'le dernier chiffre du n° de lot est pair', test: (b) => lastDigit(b.lot) % 2 === 0 },
  { id: 'lotVoyelle', text: 'le n° de lot contient une voyelle', test: (b) => /[AEIOUY]/.test(b.lot) },
  { id: 'tampons2', text: 'la bombe porte au moins deux tampons', test: (b) => b.stamps.length >= 2 },
  { id: 'tamponRouge', text: 'un tampon est à l’encre rouge', test: (b) => b.stamps.some((s) => s.ink === 'rouge') },
  { id: 'vis', text: 'il manque au moins une vis sur la face avant', test: (b) => b.screwsMissing > 0 },
  { id: 'nice', text: 'un tampon « NICE » est présent', test: (b) => b.stamps.some((s) => s.city === 'NICE') },
];
export const cond = (i, bomb) => CONDS[i].test(bomb);

export const MODULE_INFO = {
  wires: { name: 'Raccordements', icon: '✂️' },
  safe: { name: 'Coffre', icon: '🔐' },
  switches: { name: 'Leviers', icon: '🎚️' },
  chime: { name: 'Carillon', icon: '🎵' },
  pipes: { name: 'Tuyauterie', icon: '🚰' },
  gauges: { name: 'Manomètres', icon: '⏲️' },
};

// Mélodie : 4 notes sur 5 hauteurs (0 = la plus grave)
const contourKey = (m) => m.join('');

export function makeManual(edition) {
  const st = { seed: (edition * 2654435761) >>> 0 };
  const rng = rngOf(st);
  const pick = (arr) => arr[rng.int(arr.length)];
  const condIdx = () => rng.int(CONDS.length);

  // Raccordements : grille lettre (borne de gauche) × chiffre (borne de droite)
  const wires = [];
  for (let r = 0; r < 6; r++) {
    const row = [];
    for (let c = 0; c < 6; c++) {
      const x = rng.next();
      if (x < 0.22) row.push({ k: 'cut' });
      else if (x < 0.52) row.push({ k: 'keep' });
      else if (x < 0.85) { const a = rng.int(6); let b = rng.int(5); if (b >= a) b++; row.push({ k: 'col', c: [a, b].sort() }); }
      else row.push({ k: 'cond', q: condIdx() });
    }
    wires.push(row);
  }

  // Coffre : chaque symbole vaut un chiffre ; règles d'ordre et de décalage
  const digits = rng.shuffle(RUNES.map((_, i) => i % 10));
  const safe = { digits, reverseIf: condIdx(), addStamps: rng.next() < 0.5 };

  // Leviers : code affiché → position des 5 leviers (true = en haut)
  const codes = new Set();
  while (codes.size < 12) codes.add(pick(LOT_LETTERS.split('')) + (1 + rng.int(9)));
  const switches = {
    table: [...codes].map((code) => ({ code, up: Array.from({ length: 5 }, () => rng.next() < 0.5) })),
    invertLed: 1 + rng.int(2),
  };

  // Carillon : 8 mélodies distinctes → touches à presser
  const seen = new Set(), melodies = [];
  while (melodies.length < 8) {
    const m = Array.from({ length: 4 }, () => rng.int(5));
    if (new Set(m).size < 2 || seen.has(contourKey(m))) continue;
    seen.add(contourKey(m));
    melodies.push({ notes: m, keys: Array.from({ length: 4 }, () => rng.int(4)) });
  }
  const chime = { melodies, reverseIf: condIdx() };

  // Tuyauterie : couleur de la vanne × condition → sortie à alimenter
  const pipes = { cond: condIdx(), table: KEY_COLORS.map(() => [rng.int(4), rng.int(4)]) };
  for (const row of pipes.table) if (row[0] === row[1]) row[1] = (row[1] + 1 + rng.int(3)) % 4;

  // Manomètres : couleur × lecture → réglage de la molette
  const gauges = { table: GAUGE_COLORS.map(() => Array.from({ length: 10 }, () => rng.int(10))) };

  return { edition, wires, safe, switches, chime, pipes, gauges };
}
