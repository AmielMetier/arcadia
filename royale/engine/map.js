// L'île du battle royale, tirée d'une seule graine : relief, mer, lac et rivière, ville, villages, port, lieux-dits,
// routes et ponts, maisons abandonnées, forêts, rochers, voitures, coffres et butin.
// Moteur PUR (aucun DOM) : chaque joueur reconstruit la même île chez lui, seule la graine passe sur le réseau
// (`hash` permet de vérifier qu'on a bien la même). Pas de sin, cos, atan2 ni pow dans les décisions (leurs derniers
// chiffres varient d'un navigateur à l'autre) : seulement + − × ÷, sqrt et floor.
// Repère : x vers l'est, z vers le sud, y vers le haut ; la carte va de 0 à `size` mètres sur x et z.
import { makeRng, hash as ihash } from './rng.js';
import { makeNoise } from './noise.js';
import { makeBuilding, CELL, STOREY, BTYPES, MATS } from './buildings.js';
import { furnishBuilding, FURN } from './furniture.js';

export { CELL, STOREY, BTYPES, MATS, FURN };
export const SIZE = 1600;   // côté de la carte (m)
export const HRES = 2;      // pas de la grille des hauteurs (m)
export const SNOW = 96;     // altitude des neiges (m)
export const ILE = 51;      // graine de l'île officielle (choisie dans l'aperçu : tous les lieux-dits, un pont, 1 km²)
export const SLIDE = 0.84;  // pente (tan) au-delà de laquelle on glisse (≈ 40°) : les montagnes ne s'escaladent plus
const ROAD_GRADE = 0.4;     // pente en long des routes et chemins (≈ 22°) : toujours praticable à pied

// classes du sol, une par case de 4 m (carte, statistiques, plus tard la navigation des bots)
export const GROUND = ['Mer', 'Plage', 'Plaine', 'Forêt', 'Montagne', 'Roche', 'Neige', 'Lac', 'Rivière', 'Route', 'Ville', 'Bâtiment', 'Champ', 'Lieu-dit'];
export const GR = { MER: 0, PLAGE: 1, PLAINE: 2, FORET: 3, MONTAGNE: 4, ROCHE: 5, NEIGE: 6, LAC: 7, RIVIERE: 8, ROUTE: 9, VILLE: 10, BATI: 11, CHAMP: 12, LIEU: 13 };
export const WATER = { NONE: 0, MER: 1, LAC: 2, RIVIERE: 3 };
export const OC = { FREE: 0, BUILD: 1, STREET: 2, ROAD: 3, FIELD: 4, DOCK: 5, PLAZA: 6 };

export const POI_KINDS = {
  ville: 'Ville', bourg: 'Bourg', village: 'Village', port: 'Port', scierie: 'Scierie', manoir: 'Manoir', ferme: 'Ferme', usine: 'Usine', camping: 'Camping', phare: 'Phare',
  chalet: 'Refuge', carriere: 'Carrière', station: 'Station-service',
};
const TOWNS = new Set(['ville', 'bourg', 'village', 'port']);
export const MAX_TOWN_BUILDINGS = 18; // la ville et le bourg restent à taille humaine

// objets du décor : matériau récolté en les cassant (null = ne donne rien), rayon de collision (m)
export const PROPS = {
  arbre: { label: 'Arbre', mat: 'bois', r: 0.6 }, sapin: { label: 'Sapin', mat: 'bois', r: 0.5 }, buisson: { label: 'Buisson', mat: null, r: 0 },
  rocher: { label: 'Rocher', mat: 'pierre', r: 1.6 }, voiture: { label: 'Voiture', mat: 'metal', r: 2.2 }, camion: { label: 'Camion', mat: 'metal', r: 3.5 },
  tracteur: { label: 'Tracteur', mat: 'metal', r: 2 }, engin: { label: 'Pelleteuse', mat: 'metal', r: 3 }, conteneur: { label: 'Conteneur', mat: 'metal', r: 3 },
  citerne: { label: 'Citerne', mat: 'metal', r: 2.5 }, silo: { label: 'Silo', mat: 'metal', r: 3 }, botte: { label: 'Botte de foin', mat: 'bois', r: 1 },
  caisse: { label: 'Caisse', mat: 'bois', r: 0.7 }, grume: { label: 'Tas de bûches', mat: 'bois', r: 2.2 }, tente: { label: 'Tente', mat: null, r: 1.2 }, table: { label: 'Table', mat: 'bois', r: 1 },
  feu: { label: 'Feu de camp', mat: null, r: 0.8 }, fontaine: { label: 'Fontaine', mat: 'pierre', r: 3 }, pompe: { label: 'Pompe à essence', mat: 'metal', r: 0.6 },
  auvent: { label: 'Auvent', mat: 'metal', r: 0 }, bateau: { label: 'Barque', mat: 'bois', r: 2 }, cheminee: { label: 'Cheminée', mat: 'pierre', r: 2 },
  // décor du « Toon Shooter Game Kit » (view/kit.js)
  lampadaire: { label: 'Lampadaire', mat: 'metal', r: 0.3 }, benne: { label: 'Benne', mat: 'metal', r: 1.4 }, poubelle: { label: 'Conteneur à ordures', mat: 'metal', r: 1.7 },
  baril: { label: 'Baril', mat: 'metal', r: 0.5 }, bonbonne: { label: 'Bonbonne de gaz', mat: 'metal', r: 0.6 }, cone: { label: 'Plot', mat: null, r: 0.35 },
  barriere: { label: 'Barrière', mat: 'metal', r: 1 }, sacs: { label: 'Sacs de sable', mat: 'bois', r: 1.6 }, pneus: { label: 'Pneus', mat: 'metal', r: 0.9 },
  reservoir: { label: 'Réservoir', mat: 'metal', r: 2.3 }, epave: { label: 'Épave', mat: 'metal', r: 2.8 }, palette: { label: 'Palette', mat: 'bois', r: 0 },
  cartons: { label: 'Cartons', mat: 'bois', r: 0.8 }, gravats: { label: 'Gravats', mat: null, r: 0 }, tuyaux: { label: 'Tuyaux', mat: 'metal', r: 2.1 },
  planches: { label: 'Planches', mat: null, r: 0 }, caisson: { label: 'Caisson', mat: 'metal', r: 1.5 },
  // mobilier urbain du « City Pack » (view/kit.js)
  banc: { label: 'Banc', mat: 'bois', r: 0.9 }, bouche: { label: 'Bouche d\'incendie', mat: 'metal', r: 0.25 }, corbeille: { label: 'Poubelle', mat: 'metal', r: 0.35 },
  boite: { label: 'Boîte aux lettres', mat: 'metal', r: 0.3 }, abribus: { label: 'Abribus', mat: 'metal', r: 1.7 }, pot: { label: 'Pot de fleurs', mat: null, r: 0 },
  jardiniere: { label: 'Jardinière', mat: 'bois', r: 1 }, transfo: { label: 'Armoire électrique', mat: 'metal', r: 0.5 }, linge: { label: 'Corde à linge', mat: null, r: 0 },
  sacpoubelle: { label: 'Sac poubelle', mat: null, r: 0 }, plaque: { label: 'Plaque d\'égout', mat: null, r: 0 },
  // abords des maisons
  haie: { label: 'Haie', mat: 'bois', r: 0.6 },
};

const NAMES = {
  ville: ['Hautes-Tours', 'Grand-Bourg', 'Pierreville', 'Cité-Lumière'],
  bourg: ['Bourg-les-Pins', 'Saint-Galet', 'Belle-Rive', 'Haut-Perché'],
  scierie: ['Scierie du Ruisseau', 'Scierie Bellevue'],
  manoir: ['Manoir des Ombres', 'Manoir Beauregard'],
  village: ['Les Saules', 'Val-Doré', 'Bois-Joli', 'Mirabelle', 'Clos-Fleuri', 'Pré-Vert', 'Roche-Fleurie'],
  port: ['Port-Galet', 'Anse-Bleue', 'Port-Mouette'],
  ferme: ['Ferme Gaillard', 'Ferme des Trois Chênes', 'Ferme du Moulin'],
  usine: ['La Fabrique', 'Usine Rouillée', 'Les Forges'],
  camping: ['Camp des Pins', 'Camping Écureuil'],
  phare: ['Phare du Cap', 'Pointe du Phare'],
  chalet: ['Refuge des Aigles', 'Chalet du Sommet'],
  carriere: ['Carrière Grise', 'Carrière du Loup'],
  station: ['Station Relais', 'Garage du Carrefour'],
  lac: ['Lac Miroir', 'Lac Bleu', 'Lac des Brumes'],
  mont: ['Mont Brumeux', 'Pic du Vent', 'Mont Granit'],
  riviere: ['La Serpentine', 'La Vive', 'L\'Argentine'],
};

const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sq = (v) => v * v;
const unit = (rng) => {
  for (;;) {
    const x = rng.range(-1, 1), z = rng.range(-1, 1), l = x * x + z * z;
    if (l > 0.04 && l <= 1) { const s = Math.sqrt(l); return { x: x / s, z: z / s }; }
  }
};
const rectDist = (a, b) => {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
  return Math.sqrt(dx * dx + dz * dz);
};
const inRect = (r, x, z, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// file de priorité (A* des routes)
function heap() {
  const k = [], v = [];
  return {
    get size() { return k.length; },
    push(key, val) {
      let i = k.length; k.push(key); v.push(val);
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
    },
    pop() {
      const top = v[0], lk = k.pop(), lv = v.pop();
      if (k.length) {
        k[0] = lk; v[0] = lv; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < k.length && k[l] < k[m]) m = l;
          if (r < k.length && k[r] < k[m]) m = r;
          if (m === i) break;
          [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
        }
      }
      return top;
    },
  };
}

export function generateMap(seed = 1, { size = SIZE } = {}) {
  const T0 = now();
  const S = size, N = S / HRES + 1, GN = S / CELL, C = S / 2, R0 = S * 0.344;
  const rng = makeRng(seed), nz = makeNoise(ihash(seed) ^ 0x2545f491);
  const H = new Float32Array(N * N), E = new Float32Array(N * N), M = new Float32Array(N * N);
  const WL = new Float32Array(N * N).fill(-1e4), WK = new Uint8Array(N * N);
  const RD = new Float32Array(N * N).fill(1e9), RL = new Float32Array(N * N), RW = new Float32Array(N * N);
  const ROADD = new Float32Array(N * N).fill(1e9), ROADH = new Float32Array(N * N), ROADW = new Float32Array(N * N);
  const OCC = new Uint8Array(GN * GN), ZONE = new Uint8Array(GN * GN);

  const vi = (x, z) => clamp(Math.round(z / HRES), 0, N - 1) * N + clamp(Math.round(x / HRES), 0, N - 1);
  const ci = (x, z) => clamp(Math.floor(z / CELL), 0, GN - 1) * GN + clamp(Math.floor(x / CELL), 0, GN - 1);
  const bil = (A, x, z) => {
    const fx = clamp(x / HRES, 0, N - 1.001), fz = clamp(z / HRES, 0, N - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * N + i;
    return (A[k] * (1 - tx) + A[k + 1] * tx) * (1 - tz) + (A[k + N] * (1 - tx) + A[k + N + 1] * tx) * tz;
  };
  const hAt = (x, z) => bil(H, x, z);
  const forVerts = (x0, z0, x1, z1, fn) => {
    const i0 = clamp(Math.floor(x0 / HRES), 0, N - 1), i1 = clamp(Math.ceil(x1 / HRES), 0, N - 1);
    const j0 = clamp(Math.floor(z0 / HRES), 0, N - 1), j1 = clamp(Math.ceil(z1 / HRES), 0, N - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * N + i, i * HRES, j * HRES);
  };
  const slopeAt = (k) => {
    const i = k % N, j = (k - i) / N;
    const a = H[j * N + Math.max(0, i - 1)], b = H[j * N + Math.min(N - 1, i + 1)];
    const c = H[Math.max(0, j - 1) * N + i], d = H[Math.min(N - 1, j + 1) * N + i];
    return Math.sqrt(sq((b - a) / (2 * HRES)) + sq((d - c) / (2 * HRES)));
  };
  const usedNames = new Set();
  const nameFor = (kind) => {
    const list = NAMES[kind].filter((n) => !usedNames.has(n));
    const n = list.length ? rng.pick(list) : NAMES[kind][0];
    usedNames.add(n); return n;
  };

  // ------------------------------------------------------------------ 1. l'île et la montagne
  const MD = unit(rng), mdist = R0 * rng.range(0.38, 0.55);
  const MC = { x: C + MD.x * mdist, z: C + MD.z * mdist };
  const MA = unit(rng), ma = rng.range(165, 215), mb = rng.range(105, 140);
  // « distance aux terres » approximative (m) : positive à l'intérieur, négative en mer. Rivage déformé par le bruit.
  const islandE = (x, z) => {
    const wx = x + 70 * nz.fbm(x * 0.0025 + 11.3, z * 0.0025 - 4.1, 3);
    const wz = z + 70 * nz.fbm(x * 0.0025 - 7.7, z * 0.0025 + 9.2, 3);
    const dx = wx - C, dz = wz - C, d = Math.sqrt(dx * dx + dz * dz) + 1e-6;
    const R = R0 * (1 + 0.17 * nz.fbm((dx / d) * 1.6 + 40, (dz / d) * 1.6 - 40, 3));
    return Math.min(R - d, Math.min(x, z, S - x, S - z) - 50);
  };
  const mountainAt = (x, z) => {
    const dx = x - MC.x, dz = z - MC.z, u = dx * MA.x + dz * MA.z, v = -dx * MA.z + dz * MA.x;
    return ss(1.05, 0.3, Math.sqrt(sq(u / ma) + sq(v / mb)) + 0.28 * nz.fbm(x * 0.006 + 50, z * 0.006 + 50, 3));
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i * HRES, z = j * HRES, k = j * N + i;
    const e = islandE(x, z), m = mountainAt(x, z) * ss(0, 70, e);
    let h;
    if (e < 0) h = Math.max(-9, 0.4 + e * 0.11);
    else {
      h = 0.4 + 6.5 * ss(0, 90, e) + 5 * nz.fbm(x * 0.0055 + 3, z * 0.0055 + 8, 4) * ss(15, 120, e);
      const hill = nz.fbm(x * 0.0026 - 30, z * 0.0026 + 12, 3);
      if (hill > 0) h += 16 * hill * hill * ss(40, 160, e);
    }
    h += 0.45 * nz.n2(x * 0.035, z * 0.035);
    if (m > 0.001) h += m * m * (34 + 82 * nz.ridged(x * 0.0065 + 20, z * 0.0065 - 20, 5));
    H[k] = h; E[k] = e; M[k] = m;
  }
  const forestBias = rng.range(-0.02, 0.05);
  const forest = (x, z) => ss(0.02, 0.3, nz.fbm(x * 0.0042 + 71, z * 0.0042 - 23, 4) + forestBias);

  // ------------------------------------------------------------------ 2. le lac (loin de la côte et de la montagne)
  let LC = null;
  for (let t = 0; t < 500 && !LC; t++) {
    const x = rng.range(150, S - 150), z = rng.range(150, S - 150), k = vi(x, z);
    if (E[k] > (t < 300 ? 210 : 140) && M[k] < 0.01 && Math.sqrt(sq(x - MC.x) + sq(z - MC.z)) > ma + 110) LC = { x, z };
  }
  if (!LC) LC = { x: C - MD.x * R0 * 0.3, z: C - MD.z * R0 * 0.3 };
  const LA = unit(rng), la = rng.range(95, 125), lb = rng.range(60, 85);
  const lakeD = (x, z) => {
    const dx = x - LC.x, dz = z - LC.z, u = dx * LA.x + dz * LA.z, v = -dx * LA.z + dz * LA.x;
    return Math.sqrt(sq(u / la) + sq(v / lb)) + 0.14 * nz.fbm(x * 0.012 + 9, z * 0.012 - 3, 2);
  };
  const LX = la * 1.8;
  const ring = [];
  forVerts(LC.x - LX, LC.z - LX, LC.x + LX, LC.z + LX, (k, x, z) => { const q = lakeD(x, z); if (q > 1.1 && q < 1.3) ring.push(H[k]); });
  ring.sort((a, b) => a - b);
  const LL = Math.max(1.2, (ring[Math.floor(ring.length * 0.15)] || 3) - 0.6);
  forVerts(LC.x - LX, LC.z - LX, LC.x + LX, LC.z + LX, (k, x, z) => {
    const q = lakeD(x, z);
    if (q < 1) H[k] = Math.min(H[k], LL - 0.4 - 5.5 * ss(1, 0.35, q));
    else if (q < 1.6) {
      const lo = LL + 0.25 + (q - 1) * 3, hi = LL + 0.6 + (q - 1) * 40;
      H[k] += (clamp(H[k], lo, hi) - H[k]) * ss(1.6, 1.0, q);
    }
  });

  // ------------------------------------------------------------------ 3. la rivière : du lac à la mer, à l'opposé de la montagne
  const traceRiver = (d) => {
    const perp = { x: -d.z, z: d.x };
    let s = 0;
    while (lakeD(LC.x + d.x * s, LC.z + d.z * s) < 0.85 && s < 300) s += 2;
    const s0 = s, pts = [];
    for (let n = 0; n < 220; n++, s += 8) {
      const off = 42 * nz.fbm(s * 0.0045 + 91, 7.7, 2) * ss(s0, s0 + 70, s);
      const x = LC.x + d.x * s + perp.x * off, z = LC.z + d.z * s + perp.z * off;
      if (x < 8 || z < 8 || x > S - 8 || z > S - 8) return null;
      const k = vi(x, z);
      if (M[k] > 0.18) return null;
      pts.push({ x, z, e: E[k] });
      if (E[k] < -24) return pts;
    }
    return null;
  };
  let river = null;
  {
    const dl = Math.sqrt(sq(LC.x - MC.x) + sq(LC.z - MC.z)) || 1, d0 = { x: (LC.x - MC.x) / dl, z: (LC.z - MC.z) / dl };
    for (const [c, s] of [[1, 0], [0.866, 0.5], [0.866, -0.5], [0.5, 0.866], [0.5, -0.866], [0, 1], [0, -1], [-0.5, 0.866], [-0.5, -0.866]]) {
      const pts = traceRiver({ x: d0.x * c - d0.z * s, z: d0.x * s + d0.z * c });
      if (pts && (!river || pts.length < river.length)) river = pts;
      if (river && c === 1) break;
    }
  }
  if (river) {
    let land = river.findIndex((p) => p.e < 0);
    if (land < 1) land = river.length - 1;
    river.forEach((p, i) => { const t = Math.min(1, i / land); p.hw = 4.5 + 3 * t; p.lv = LL * (1 - t); });
    for (let n = 0; n < river.length - 1; n++) {
      const a = river[n], b = river[n + 1], m = Math.max(a.hw, b.hw) + 44;
      const vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz;
      forVerts(Math.min(a.x, b.x) - m, Math.min(a.z, b.z) - m, Math.max(a.x, b.x) + m, Math.max(a.z, b.z) + m, (k, x, z) => {
        const t = clamp(((x - a.x) * vx + (z - a.z) * vz) / l2, 0, 1);
        const dd = Math.sqrt(sq(a.x + vx * t - x) + sq(a.z + vz * t - z));
        if (dd < RD[k]) { RD[k] = dd; RL[k] = a.lv + (b.lv - a.lv) * t; RW[k] = a.hw + (b.hw - a.hw) * t; }
      });
    }
    for (let k = 0; k < N * N; k++) {
      if (RD[k] >= RW[k] + 42) continue;
      const hw = RW[k], d = RD[k], lv = RL[k];
      if (d < hw) { H[k] = Math.min(H[k], lv - 0.3 - 1.8 * (1 - sq(d / hw))); continue; }
      const i = k % N, x = i * HRES, z = ((k - i) / N) * HRES, t = d - hw;
      // pas de berge surélevée en mer ni dans le lac (sinon des bandes de terre y apparaîtraient)
      const lo = E[k] < 4 || lakeD(x, z) < 1.05 ? -1e4 : lv + 0.35 + Math.min(t, 3) * 0.12, hi = lv + 0.35 + t * 0.5;
      H[k] += (clamp(H[k], lo, hi) - H[k]) * ss(42, 0, t);
    }
  }

  // ------------------------------------------------------------------ 4. emplacements : ville, villages, port, lieux-dits
  const pois = [];
  const fits = (r, rule) => {
    if (r.x0 < 30 || r.z0 < 30 || r.x1 > S - 30 || r.z1 > S - 30) return null;
    let n = 0, s = 0, s2 = 0;
    for (let z = r.z0; z <= r.z1 + 0.1; z += 8) for (let x = r.x0; x <= r.x1 + 0.1; x += 8) {
      const k = vi(x, z);
      if (E[k] < rule.minE || M[k] > rule.maxM || RD[k] - RW[k] < (rule.river ?? 25) || OCC[ci(x, z)]) return null;
      if (lakeD(x, z) < (rule.lake || 1.35)) return null;
      n++; s += H[k]; s2 += H[k] * H[k];
    }
    const mean = s / n;
    return { mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
  };
  // centres possibles : une grille de 16 m filtrée (terre ferme, condition propre au lieu), mélangée
  const centers = (minE, ok) => {
    const pts = [];
    for (let z = 60; z < S - 60; z += 16) for (let x = 60; x < S - 60; x += 16) {
      const k = vi(x, z);
      if (E[k] >= minE && (!ok || ok(x, z, k))) pts.push([x + rng.range(-8, 8), z + rng.range(-8, 8)]);
    }
    return rng.shuffle(pts);
  };
  const place = (wc, dc, rule, tries, score, ok) => {
    let best = null;
    for (const [cx, cz] of centers(rule.minE, ok).slice(0, tries)) {
      const x0 = Math.round(cx / CELL - wc / 2), z0 = Math.round(cz / CELL - dc / 2);
      const r = { x0: x0 * CELL, z0: z0 * CELL, x1: (x0 + wc) * CELL, z1: (z0 + dc) * CELL };
      if (pois.some((p) => rectDist(p.rect, r) < (TOWNS.has(p.kind) || rule.town ? rule.gapTown ?? 150 : rule.gap ?? 110))) continue;
      const f = fits(r, rule);
      if (!f) continue;
      const sc = (score ? score(r, f, cx, cz) : 0) - f.std * 2 + rng.next() * 3;
      if (sc > -1e8 && (!best || sc > best.sc)) best = { sc, r, cx0: x0, cz0: z0, f };
    }
    return best;
  };
  const addPoi = (kind, r, extra = {}) => {
    const p = { id: pois.length, kind, label: POI_KINDS[kind], name: nameFor(kind), town: TOWNS.has(kind), rect: r,
      x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, gates: [], buildings: [], level: 0, ...extra };
    pois.push(p);
    for (let j = r.z0 / CELL; j < r.z1 / CELL; j++) for (let i = r.x0 / CELL; i < r.x1 / CELL; i++) ZONE[j * GN + i] = p.id + 1;
    return p;
  };
  const centerDist = (cx, cz) => Math.sqrt(sq(cx - C) + sq(cz - C));

  // la ville et le bourg : un damier de pâtés de 8 × 8 cases séparés par des rues de 2 cases
  const grids = [];
  for (const [kind, sizes, gapTown, score] of [
    ['ville', [[4, 4], [4, 3], [3, 3]], 0, (r, f, cx, cz) => -0.02 * centerDist(cx, cz)],
    ['bourg', [[4, 3], [3, 3], [3, 2]], 180, null],
  ]) {
    for (const [a, b] of sizes) {
      const [nbx, nbz] = rng.chance(0.5) ? [a, b] : [b, a];
      const sp = place(nbx * 10 + 2, nbz * 10 + 2, { minE: 45, maxM: 0.1, lake: 1.5, river: 30, town: true, gapTown }, 700, score);
      if (sp) { grids.push(addPoi(kind, sp.r, { cx0: sp.cx0, cz0: sp.cz0, nbx, nbz, level: sp.f.mean })); break; }
    }
  }

  // le port : une rue qui descend vers la mer et se prolonge en jetée
  let port = null;
  {
    let best = null;
    for (const [cx, cz] of centers(18, (x, z, k) => E[k] <= 70).slice(0, 700)) {
      let dir = null;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let s = 8; s <= 130; s += 4) {
          if (E[vi(cx + dx * s, cz + dz * s)] < -3) { if (!dir || s < dir.s) dir = { dx, dz, s }; break; }
        }
      }
      if (!dir || dir.s < 26 || dir.s > 100) continue;
      const aShore = Math.round((dir.s + 40) / CELL), axisX = dir.dx !== 0, sgn = axisX ? dir.dx : dir.dz;
      const ox = axisX ? Math.round((cx - dir.dx * 40) / CELL) : Math.round(cx / CELL) - 8;
      const oz = axisX ? Math.round(cz / CELL) - 8 : Math.round((cz - dir.dz * 40) / CELL);
      const F = frame(ox, oz, axisX, sgn), lr = F.rect(0, 0, aShore - 1, 16);
      const r = { x0: lr.x * CELL, z0: lr.z * CELL, x1: (lr.x + lr.w) * CELL, z1: (lr.z + lr.d) * CELL };
      if (pois.some((p) => rectDist(p.rect, r) < (p.town ? 180 : 110))) continue;
      const f = fits(r, { minE: -3, maxM: 0.15, lake: 1.5, river: 24 });
      if (!f) continue;
      // la jetée doit tomber dans l'eau
      const pr = F.rect(aShore + 2, 7, 10, 2);
      if (E[vi((pr.x + pr.w / 2) * CELL, (pr.z + pr.d / 2) * CELL)] > -4) continue;
      const sc = -f.std * 2 + rng.next() * 3;
      if (!best || sc > best.sc) best = { sc, r, f, ox, oz, axisX, sgn, aShore };
    }
    if (best) port = addPoi('port', best.r, { ox: best.ox, oz: best.oz, axisX: best.axisX, sgn: best.sgn, aShore: best.aShore, level: Math.min(best.f.mean, 2.6) });
  }

  // quatre villages : une grand-rue (et parfois une rue en croix), des maisons de part et d'autre
  const villages = [];
  for (let v = 0; v < 4; v++) {
    const axisX = rng.chance(0.5);
    for (const [Ls, cross] of [[rng.int(28, 34), rng.chance(0.6)], [rng.int(24, 28), false]]) {
      const perp = cross ? 28 : 16;
      const sp = place(axisX ? Ls : perp, axisX ? perp : Ls, { minE: 35, maxM: 0.12, lake: 1.45, river: 28, town: true, gapTown: 130 }, 700);
      if (sp) { villages.push(addPoi('village', sp.r, { cx0: sp.cx0, cz0: sp.cz0, Ls, cross, axisX, level: sp.f.mean })); break; }
    }
  }

  // lieux-dits
  const LIEUX = [
    ['phare', 8, 8, { minE: 8, maxM: 0.5, lake: 1.3, river: 20, gap: 80, gapTown: 70 }, (x, z, k) => E[k] <= 34, (r, f, cx, cz) => {
      let land = 0;
      for (let dz = -72; dz <= 72; dz += 12) for (let dx = -72; dx <= 72; dx += 12) if (E[vi(cx + dx, cz + dz)] > 0) land++;
      return -land * 0.6 + f.mean * 0.2;
    }],
    ['chalet', 11, 10, { minE: 50, maxM: 1, lake: 1.3, river: 20, gap: 80, gapTown: 70 }, (x, z, k) => M[k] >= 0.45, (r, f) => f.mean * 0.15 + f.std * 1.4],
    ['carriere', 18, 14, { minE: 35, maxM: 0.85, lake: 1.3, river: 20, gap: 80, gapTown: 70 }, (x, z, k) => M[k] >= 0.05 && M[k] <= 0.5],
    ['camping', 18, 18, { minE: 50, maxM: 0.2, lake: 1.4, river: 20, gap: 80, gapTown: 70 }, (x, z) => forest(x, z) >= 0.4, (r, f, cx, cz) => forest(cx, cz) * 10],
    ['scierie', 18, 14, { minE: 50, maxM: 0.2, lake: 1.4, river: 20, gap: 80, gapTown: 70 }, (x, z) => forest(x, z) >= 0.25, (r, f, cx, cz) => forest(cx, cz) * 6],
    ['ferme', 18, 16, { minE: 60, maxM: 0.04, lake: 1.5, river: 24, gap: 80, gapTown: 70 }, (x, z, k) => M[k] < 0.02 && forest(x, z) < 0.3],
    ['usine', 22, 18, { minE: 40, maxM: 0.08, lake: 1.5, river: 24, gap: 80, gapTown: 70 }],
    ['manoir', 16, 16, { minE: 55, maxM: 0.15, lake: 1.4, river: 20, gap: 80, gapTown: 70 }, null, (r, f) => f.mean * 0.3],
  ];
  for (const [kind, wc, dc, rule, ok, score] of LIEUX) {
    const sp = place(wc, dc, rule, 900, score, ok);
    if (sp) addPoi(kind, sp.r, { cx0: sp.cx0, cz0: sp.cz0, level: sp.f.mean, flip: [rng.chance(0.5), rng.chance(0.5)] });
  }

  // ------------------------------------------------------------------ 5. terrassement des emplacements
  const flatten = (r, target, rim, keepSea = false) => {
    forVerts(r.x0 - rim, r.z0 - rim, r.x1 + rim, r.z1 + rim, (k, x, z) => {
      const dx = Math.max(0, r.x0 - x, x - r.x1), dz = Math.max(0, r.z0 - z, z - r.z1), d = Math.sqrt(dx * dx + dz * dz);
      let w = ss(rim, 0, d);
      if (d > 0 && keepSea && E[k] < 2) w = 0;
      H[k] += (target - H[k]) * w;
    });
  };
  for (const p of pois) {
    if (p.kind === 'phare') { p.level = hAt(p.x, p.z); flatten(p.rect, p.level, 8, true); }
    else flatten(p.rect, p.level, p.town ? 28 : 16, p.kind === 'port');
  }

  // ------------------------------------------------------------------ 6. plans des villes et des lieux-dits
  const buildings = [], props = [], streets = [], fields = [], docks = [], plazas = [];
  const occRect = (x, z, w, d, code) => {
    for (let j = z; j < z + d; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < GN && j < GN) OCC[j * GN + i] = code;
  };
  const addB = (poi, type, x0, z0, w, d, front, floors, mat) => {
    const b = makeBuilding(rng, buildings.length, { type, x0, z0, w, d, front, floors, mat });
    b.poi = poi ? poi.id : -1;
    buildings.push(b);
    occRect(x0, z0, w, d, OC.BUILD);
    if (poi) poi.buildings.push(b.id);
    return b;
  };
  const prop = (kind, x, z, extra) => { const p = { kind, x, z, dx: 1, dz: 0, s: 1, ...extra }; props.push(p); return p; };
  const street = (x, z, w, d) => { streets.push({ x0: x * CELL, z0: z * CELL, x1: (x + w) * CELL, z1: (z + d) * CELL }); occRect(x, z, w, d, OC.STREET); };
  const CARS = 7;
  // voitures garées le long d'une rue (rectangle en cases), sur le côté
  const parkCars = (st, prob) => {
    const alongX = st.x1 - st.x0 > st.z1 - st.z0;
    const len = alongX ? st.x1 - st.x0 : st.z1 - st.z0;
    for (let s = 6; s < len - 6; s += 9) {
      if (!rng.chance(prob)) continue;
      const side = rng.chance(0.5) ? 2.35 : 5.65; // dans la chaussée, entre le caniveau et l'axe
      const x = alongX ? st.x0 + s : st.x0 + side, z = alongX ? st.z0 + side : st.z0 + s;
      // pas au milieu d'un carrefour
      if (streets.some((o) => o !== st && inRect(o, x, z, 2))) continue;
      prop('voiture', x, z, { dx: alongX ? 1 : 0, dz: alongX ? 0 : 1, c: rng.int(0, CARS - 1) });
    }
  };

  for (const town of grids) {
    const { cx0, cz0, nbx, nbz } = town, big = town.kind === 'ville';
    const on = Array.from({ length: nbx * nbz }, () => true);
    if (nbx > 2 && nbz > 2) for (const [bi, bj] of [[0, 0], [nbx - 1, 0], [0, nbz - 1], [nbx - 1, nbz - 1]]) if (rng.chance(big ? 0.4 : 0.3)) on[bj * nbx + bi] = false;
    const isOn = (bi, bj) => bi >= 0 && bj >= 0 && bi < nbx && bj < nbz && on[bj * nbx + bi];
    const centrals = [];
    for (let bj = 1; bj < nbz - 1; bj++) for (let bi = 1; bi < nbx - 1; bi++) centrals.push([bi, bj]);
    const plaza = centrals.length && (big || rng.chance(0.6)) ? rng.pick(centrals) : null;
    const first = streets.length;
    for (let bj = 0; bj < nbz; bj++) for (let i = 0; i <= nbx; i++) if (isOn(i - 1, bj) || isOn(i, bj)) street(cx0 + i * 10, cz0 + bj * 10, 2, 12);
    for (let j = 0; j <= nbz; j++) for (let bi = 0; bi < nbx; bi++) if (isOn(bi, j - 1) || isOn(bi, j)) street(cx0 + bi * 10, cz0 + j * 10, 12, 2);
    let tower = !big;
    const mid = [(nbx - 1) / 2, (nbz - 1) / 2];
    const order = [];
    for (let bj = 0; bj < nbz; bj++) for (let bi = 0; bi < nbx; bi++) if (isOn(bi, bj)) order.push([bi, bj, Math.abs(bi - mid[0]) + Math.abs(bj - mid[1])]);
    order.sort((a, b) => a[2] - b[2]);
    // 18 bâtiments au plus : un immeuble par pâté, puis, en partant de la périphérie, quelques pâtés dédoublés (B)
    // ou en maisons (C) tant que le compte le permet
    const isPlaza = (bi, bj) => plaza && bi === plaza[0] && bj === plaza[1];
    const pats = new Map();
    let budget = MAX_TOWN_BUILDINGS - order.filter(([bi, bj]) => !isPlaza(bi, bj)).length;
    for (const [bi, bj, dc] of [...order].reverse()) {
      if (isPlaza(bi, bj)) continue;
      let pat = 'A';
      if (!(big && dc <= 1.01)) {
        if (budget >= 3 && rng.chance(big ? 0.35 : 0.6)) pat = 'C';
        else if (budget >= 1 && rng.chance(0.7)) pat = 'B';
      }
      budget -= pat === 'C' ? 3 : pat === 'B' ? 1 : 0;
      pats.set(bi + ',' + bj, pat);
    }
    for (const [bi, bj, dc] of order) {
      const bx = cx0 + bi * 10 + 2, bz = cz0 + bj * 10 + 2;
      if (plaza && bi === plaza[0] && bj === plaza[1]) {
        plazas.push({ x0: bx * CELL, z0: bz * CELL, x1: (bx + 8) * CELL, z1: (bz + 8) * CELL });
        occRect(bx, bz, 8, 8, OC.PLAZA);
        prop('fontaine', (bx + 4) * CELL, (bz + 4) * CELL);
        for (const [qx, qz] of [[1.2, 1.2], [6.8, 1.2], [1.2, 6.8], [6.8, 6.8]]) prop('arbre', (bx + qx) * CELL, (bz + qz) * CELL, { s: 0.9 });
        continue;
      }
      const pat = pats.get(bi + ',' + bj);
      if (pat === 'A') {
        const tall = !tower && dc <= 1.01;
        tower = tower || tall;
        addB(town, tall ? 'tour' : 'immeuble', bx + 1, bz + 1, 6, 6, rng.pick(['N', 'S', 'E', 'W']), tall ? 5 : big ? rng.int(3, 4) : 3);
      } else if (pat === 'B') {
        const alongX = rng.chance(0.5);
        for (const h of [0, 1]) {
          const type = rng.weighted([['immeuble', big ? 0.45 : 0.2], ['boutique', 0.3], ['maison', big ? 0.25 : 0.5]]);
          const fl = type === 'immeuble' ? (big ? 3 : 2) : undefined;
          if (alongX) addB(town, type, bx + 1, h ? bz + 5 : bz, 6, 3, h ? 'S' : 'N', fl);
          else addB(town, type, h ? bx + 5 : bx, bz + 1, 3, 6, h ? 'E' : 'W', fl);
        }
      } else {
        for (const [qi, qj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          if (rng.chance(0.1)) { prop('arbre', (bx + qi * 4 + 2) * CELL, (bz + qj * 4 + 2) * CELL); continue; }
          const type = rng.weighted([['maison', 0.55], ['boutique', 0.3], ['garage', 0.15]]);
          const front = rng.chance(0.5) ? (qj ? 'S' : 'N') : (qi ? 'E' : 'W');
          addB(town, type, bx + (qi ? 5 : 0), bz + (qj ? 5 : 0), 3, 3, front);
        }
      }
    }
    for (const st of streets.slice(first)) parkCars(st, big ? 0.28 : 0.2);
    const mi = Math.floor(nbx / 2), mj = Math.floor(nbz / 2);
    const gx = (cx0 + mi * 10 + 1) * CELL, gz = (cz0 + mj * 10 + 1) * CELL, R = town.rect;
    town.gates.push({ x: gx, z: R.z0 - 10, sx: gx, sz: R.z0 }, { x: gx, z: R.z1 + 10, sx: gx, sz: R.z1 },
      { x: R.x0 - 10, z: gz, sx: R.x0, sz: gz }, { x: R.x1 + 10, z: gz, sx: R.x1, sz: gz });
  }

  // repère local d'une rue : a le long de la rue, p en travers ; sgn < 0 retourne le sens de a
  function frame(ox, oz, axisX, sgn) {
    return {
      rect(a, p, wa, wp) {
        if (axisX) return sgn > 0 ? { x: ox + a, z: oz + p, w: wa, d: wp } : { x: ox - a - wa, z: oz + p, w: wa, d: wp };
        return sgn > 0 ? { x: ox + p, z: oz + a, w: wp, d: wa } : { x: ox + p, z: oz - a - wa, w: wp, d: wa };
      },
      side(dir) {
        if (axisX) return dir === '+p' ? 'S' : dir === '-p' ? 'N' : (dir === '+a') === (sgn > 0) ? 'E' : 'W';
        return dir === '+p' ? 'E' : dir === '-p' ? 'W' : (dir === '+a') === (sgn > 0) ? 'S' : 'N';
      },
      pt(a, p) { const r = this.rect(a, p, 0, 0); return { x: r.x * CELL, z: r.z * CELL }; },
    };
  }
  const B = (poi, F, type, a, p, wa, wp, dir, floors) => { const r = F.rect(a, p, wa, wp); return addB(poi, type, r.x, r.z, r.w, r.d, F.side(dir), floors); };
  const S_ = (F, a, p, wa, wp) => { const r = F.rect(a, p, wa, wp); street(r.x, r.z, r.w, r.d); return streets[streets.length - 1]; };
  const garden = (F, a, p, wa, wp) => {
    for (let t = 0; t < 3; t++) { const q = F.pt(a + rng.range(0.5, wa - 0.5), p + rng.range(0.5, wp - 0.5)); prop(rng.chance(0.7) ? 'arbre' : 'buisson', q.x, q.z, { s: rng.range(0.7, 1) }); }
  };

  for (const v of villages) {
    const { Ls, cross, axisX } = v, F = frame(v.cx0, v.cz0, axisX, 1), pa = cross ? 6 : 0, am = Math.floor(Ls / 2) - 1;
    const main = S_(F, 0, pa + 7, Ls, 2);
    let special = false;
    for (let a = 0; a + 6 <= Ls; a += 6) {
      if (cross && a < am + 2 && a + 6 > am) continue;
      for (const sideA of [true, false]) {
        if (rng.chance(0.18)) { garden(F, a, sideA ? pa : pa + 9, 6, 7); continue; }
        if (!special && sideA && a + 6 >= am) {
          special = true;
          B(v, F, rng.chance(0.5) ? 'mairie' : 'auberge', a + 1, pa + 2, 5, 4, '+p');
          continue;
        }
        const wa = rng.int(3, 4), wp = rng.int(3, 4), off = rng.int(1, 6 - wa);
        const type = rng.weighted([['maison', 0.8], ['boutique', 0.12], ['garage', 0.08]]);
        if (sideA) B(v, F, type, a + off, pa + 6 - wp, wa, wp, '+p');
        else B(v, F, type, a + off, pa + 10, wa, wp, '-p');
      }
    }
    parkCars(main, 0.3);
    const ends = [];
    if (cross) {
      const cs = S_(F, am, 0, 2, pa * 2 + 16);
      parkCars(cs, 0.25);
      for (const [p0, left] of [[0, true], [0, false], [pa + 16, true], [pa + 16, false]]) {
        if (!rng.chance(0.8)) continue;
        const wa = rng.int(3, 4), wp = rng.int(3, 4), pp = p0 + rng.int(1, 6 - wp);
        if (left) B(v, F, 'maison', am - 1 - wa, pp, wa, wp, '+a');
        else B(v, F, 'maison', am + 3, pp, wa, wp, '-a');
      }
      ends.push([F.pt(am + 1, 0), F.pt(am + 1, -2.5)], [F.pt(am + 1, pa * 2 + 16), F.pt(am + 1, pa * 2 + 18.5)]);
    }
    ends.push([F.pt(0, pa + 8), F.pt(-2.5, pa + 8)], [F.pt(Ls, pa + 8), F.pt(Ls + 2.5, pa + 8)]);
    for (const [s, g] of ends) v.gates.push({ x: g.x, z: g.z, sx: s.x, sz: s.z });
  }

  if (port) {
    const F = frame(port.ox, port.oz, port.axisX, port.sgn), A = port.aShore;
    S_(F, 0, 7, A, 2);
    for (let a = 0; a + 6 <= A - 8; a += 6) {
      for (const sideA of [true, false]) {
        if (rng.chance(0.15)) { garden(F, a, sideA ? 0 : 9, 6, 7); continue; }
        const wa = rng.int(3, 4), wp = rng.int(3, 4), off = rng.int(1, 6 - wa);
        if (sideA) B(port, F, 'maison', a + off, 6 - wp, wa, wp, '+p');
        else B(port, F, 'maison', a + off, 10, wa, wp, '-p');
      }
    }
    B(port, F, 'hangar', A - 7, 1, 6, 5, '+p');
    B(port, F, rng.chance(0.5) ? 'boutique' : 'auberge', A - 6, 10, 4, 4, '-p');
    // quai, jetée en T, barques et conteneurs
    for (const [a, p, wa, wp] of [[A - 1, 0, 1, 16], [A, 7, 12, 2], [A + 10, 3, 2, 10]]) {
      const r = F.rect(a, p, wa, wp);
      docks.push({ x0: r.x * CELL, z0: r.z * CELL, x1: (r.x + r.w) * CELL, z1: (r.z + r.d) * CELL });
      occRect(r.x, r.z, r.w, r.d, OC.DOCK);
    }
    const ax = port.axisX ? port.sgn : 0, az = port.axisX ? 0 : port.sgn;
    for (const p of [5.2, 10.8]) { const q = F.pt(A + 6, p); prop('bateau', q.x, q.z, { dx: ax, dz: az }); }
    for (let t = 0; t < 3; t++) { const q = F.pt(A - 6.2 + t * 1.7, 0.45); prop('conteneur', q.x, q.z, { dx: ax, dz: az, c: rng.int(0, 3) }); }
    const s = F.pt(0, 8), g = F.pt(-2.5, 8);
    port.gates.push({ x: g.x, z: g.z, sx: s.x, sz: s.z });
  }

  // lieux-dits : plans en cases relatives, retournés au hasard pour varier
  const LAYOUT = {
    ferme: { b: [['maison', 1, 1, 4, 4, 'S', 2], ['grange', 9, 1, 7, 5, 'S']], p: [['silo', 17, 2.5], ['silo', 17, 5.5], ['tracteur', 7.5, 8.5], ['botte', 3, 11], ['botte', 4.5, 12.5], ['botte', 11, 12], ['botte', 13, 13.5], ['caisse', 6.5, 2]] },
    usine: { b: [['hangar', 1, 1, 10, 6, 'S'], ['hangar', 13, 1, 8, 6, 'S'], ['bureaux', 1, 12, 5, 4, 'N']], p: [['cheminee', 20, 10], ['citerne', 17, 15], ['citerne', 20, 15], ['camion', 9, 9.5], ['conteneur', 9, 13, 'v'], ['conteneur', 10.2, 13, 'v'], ['conteneur', 11.4, 13, 'v'], ['conteneur', 13.5, 15.5, 'h'], ['conteneur', 13.5, 16.7, 'h'], ['caisse', 7.5, 15.5], ['caisse', 8, 16.5]] },
    camping: { b: [['cabane', 2, 2, 3, 2, 'S'], ['cabane', 13, 2, 3, 2, 'S'], ['cabane', 2, 14, 3, 2, 'N'], ['cabane', 13, 14, 2, 3, 'W'], ['cabane', 8, 1, 2, 3, 'S']], p: [['feu', 9, 9], ['tente', 5, 8], ['tente', 13, 8.5], ['tente', 9, 13], ['table', 7, 10.5], ['table', 11, 7], ['caisse', 10.5, 10.5]] },
    phare: { b: [['phare', 1, 1, 3, 3, 'S'], ['cabane', 4, 5, 3, 2, 'N']], p: [['caisse', 6.5, 2], ['bateau', 1.5, 6.5]] },
    chalet: { b: [['chalet', 1, 1, 5, 4, 'S'], ['cabane', 7, 6, 3, 2, 'W']], p: [['caisse', 7.5, 2], ['caisse', 8.2, 2.6], ['feu', 3.5, 7.5]] },
    scierie: { b: [['hangar', 1, 1, 9, 5, 'S', 1, 'bois'], ['cabane', 12, 1, 3, 3, 'S'], ['maison', 12, 8, 4, 4, 'W', 1]], p: [['grume', 3, 8.5, 'h'], ['grume', 3, 10.5, 'h'], ['grume', 6.5, 9.5, 'h'], ['grume', 3, 12.5, 'h'], ['camion', 9, 12], ['caisse', 10.5, 7.5], ['caisse', 11, 8.4]] },
    manoir: { b: [['manoir', 5, 4, 6, 5, 'S'], ['cabane', 1, 12, 3, 2, 'E']], p: [['fontaine', 8, 12], ['arbre', 2, 2], ['arbre', 14, 2], ['arbre', 2, 7], ['arbre', 14, 7], ['arbre', 13.5, 13], ['buisson', 5.5, 11], ['buisson', 10.5, 11], ['buisson', 5.5, 13.5], ['buisson', 10.5, 13.5], ['voiture', 12.5, 10.5, 'v']] },
    carriere: { b: [['hangar', 1, 1, 6, 5, 'S'], ['cabane', 9, 1, 3, 3, 'S']], p: [['engin', 14.5, 3], ['camion', 10, 7.5], ['rocher', 4, 9, 'b'], ['rocher', 6.5, 11, 'b'], ['rocher', 9, 10, 'b'], ['rocher', 12, 11.5, 'b'], ['rocher', 15, 9, 'b'], ['rocher', 16, 12, 'b'], ['caisse', 2.5, 7.5], ['caisse', 3.3, 7.8]] },
  };
  const mirror = { E: 'W', W: 'E', N: 'S', S: 'N' };
  const layoutLieu = (p, L, W, D) => {
    const [fx, fz] = p.flip || [false, false];
    const ox = p.rect.x0 / CELL, oz = p.rect.z0 / CELL;
    for (const [type, x, z, w, d, front, fl, mat] of L.b) {
      const bx = fx ? W - x - w : x, bz = fz ? D - z - d : z;
      let f = front;
      if ((fx && (f === 'E' || f === 'W')) || (fz && (f === 'N' || f === 'S'))) f = mirror[f];
      addB(p, type, ox + bx, oz + bz, w, d, f, fl, mat);
    }
    for (const [kind, x, z, o] of L.p) {
      const px = (ox + (fx ? W - x : x)) * CELL, pz = (oz + (fz ? D - z : z)) * CELL;
      prop(kind, px, pz, { dx: o === 'v' ? 0 : 1, dz: o === 'v' ? 1 : 0, s: o === 'b' ? rng.range(1.2, 1.6) : 1, c: rng.int(0, 3) });
    }
  };
  for (const p of pois) {
    if (p.town) continue;
    const L = LAYOUT[p.kind], W = (p.rect.x1 - p.rect.x0) / CELL, D = (p.rect.z1 - p.rect.z0) / CELL;
    layoutLieu(p, L, W, D);
    const R = p.rect;
    p.gates.push({ x: p.x, z: R.z0 - 10, sx: p.x, sz: R.z0 }, { x: p.x, z: R.z1 + 10, sx: p.x, sz: R.z1 },
      { x: R.x0 - 10, z: p.z, sx: R.x0, sz: p.z }, { x: R.x1 + 10, z: p.z, sx: R.x1, sz: p.z });
    // champs autour de la ferme
    if (p.kind === 'ferme') {
      const cand = [[R.x0 - 72, R.z0, 16, 10], [R.x1 + 8, R.z0, 16, 10], [R.x0, R.z1 + 8, 10, 16], [R.x0 + 44, R.z1 + 8, 10, 16], [R.x0, R.z0 - 72, 10, 16]];
      rng.shuffle(cand);
      for (const [x, z, w, d] of cand) {
        if (fields.length >= 3) break;
        const fr = { x0: Math.round(x / CELL) * CELL, z0: Math.round(z / CELL) * CELL };
        fr.x1 = fr.x0 + w * CELL; fr.z1 = fr.z0 + d * CELL;
        if (pois.some((q) => q !== p && rectDist(q.rect, fr) < 20)) continue;
        if (!fits(fr, { minE: 25, maxM: 0.1, lake: 1.4, river: 12 })) continue;
        fields.push({ ...fr, crop: rng.pick(['ble', 'mais', 'colza']), alongX: w > d });
        occRect(fr.x0 / CELL, fr.z0 / CELL, w, d, OC.FIELD);
      }
    }
  }

  // ------------------------------------------------------------------ 7. routes (A* sur une grille de 8 m) et ponts
  const roads = [], bridges = [];
  const RC = 8, RNn = S / RC;
  const cost = new Float32Array(RNn * RNn), HC = new Float32Array(RNn * RNn);
  for (let j = 0; j < RNn; j++) for (let i = 0; i < RNn; i++) {
    const x = (i + 0.5) * RC, z = (j + 0.5) * RC, k = vi(x, z), c = j * RNn + i;
    HC[c] = H[k];
    let v = 1 + M[k] * 12;
    if (E[k] < 5 || lakeD(x, z) < 1.12) v = Infinity;
    else if (RD[k] < RW[k] + 3) v += 12;
    if (v < Infinity) for (const p of pois) if (inRect(p.rect, x, z, 5)) { v = Infinity; break; }
    if (v < Infinity && OCC[ci(x, z)] === OC.FIELD) v += 3;
    cost[c] = v;
  }
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  const astar = (sx, sz, tx, tz) => {
    const si = clamp(Math.floor(sx / RC), 0, RNn - 1), sj = clamp(Math.floor(sz / RC), 0, RNn - 1);
    const ti = clamp(Math.floor(tx / RC), 0, RNn - 1), tj = clamp(Math.floor(tz / RC), 0, RNn - 1);
    // départ ou arrivée bloqués (bord d'un autre lieu, rivage) : la case praticable la plus proche
    const open = (i, j) => {
      for (let r = 0; r <= 3; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const ni = i + di, nj = j + dj;
        if (ni >= 0 && nj >= 0 && ni < RNn && nj < RNn && cost[nj * RNn + ni] < Infinity) return nj * RNn + ni;
      }
      return -1;
    };
    const s = open(si, sj), t = open(ti, tj);
    if (s < 0 || t < 0) return null;
    const g = new Float32Array(RNn * RNn).fill(Infinity), from = new Int32Array(RNn * RNn).fill(-1), done = new Uint8Array(RNn * RNn);
    const q = heap();
    g[s] = 0; q.push(0, s);
    while (q.size) {
      const c = q.pop();
      if (done[c]) continue;
      done[c] = 1;
      if (c === t) break;
      const ci_ = c % RNn, cj = (c - ci_) / RNn;
      for (const [di, dj, l] of NB) {
        const ni = ci_ + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= RNn || nj >= RNn) continue;
        const n = nj * RNn + ni;
        if (done[n] || cost[n] === Infinity) continue;
        const grade = Math.abs(HC[n] - HC[c]) / (RC * l);
        const ng = g[c] + l * (cost[c] + cost[n]) * 0.5 + l * grade * grade * 900 + (l > 1 ? 0.1 : 0);
        if (ng < g[n]) { g[n] = ng; from[n] = c; q.push(ng + Math.sqrt(sq(ni - ti) + sq(nj - tj)), n); }
      }
    }
    if (from[t] < 0 && s !== t) return null;
    const path = [];
    for (let c = t; c >= 0; c = from[c]) { const i = c % RNn; path.push({ x: (i + 0.5) * RC, z: ((c - i) / RNn + 0.5) * RC }); if (c === s) break; }
    return path.reverse();
  };
  const smoothLine = (pts) => {
    let P = pts;
    for (let it = 0; it < 3; it++) {
      const Q = [P[0], P[1]];
      for (let i = 1; i < P.length - 2; i++) {
        const a = P[i], b = P[i + 1];
        Q.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
      }
      Q.push(P[P.length - 2], P[P.length - 1]);
      P = Q;
    }
    // ré-échantillonnage tous les 4 m
    const out = [P[0]];
    let acc = 0;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], l = Math.sqrt(sq(b.x - a.x) + sq(b.z - a.z));
      let t = 4 - acc;
      while (t <= l) { out.push({ x: a.x + (b.x - a.x) * (t / l), z: a.z + (b.z - a.z) * (t / l) }); t += 4; }
      acc = l - (t - 4);
    }
    const last = P[P.length - 1], o = out[out.length - 1];
    if (Math.sqrt(sq(o.x - last.x) + sq(o.z - last.z)) > 1) out.push(last);
    return out;
  };
  const link = (A, Bp, kind) => {
    const pairs = [];
    for (const ga of A.gates) for (const gb of Bp.gates) pairs.push([ga, gb, sq(ga.x - gb.x) + sq(ga.z - gb.z)]);
    pairs.sort((a, b) => a[2] - b[2]);
    for (const [ga, gb] of pairs.slice(0, 5)) {
      const path = astar(ga.x, ga.z, gb.x, gb.z);
      if (!path) continue;
      const pts = smoothLine([{ x: ga.sx, z: ga.sz }, { x: ga.x, z: ga.z }, ...path.slice(1, -1), { x: gb.x, z: gb.z }, { x: gb.sx, z: gb.sz }]);
      const road = { kind, hw: kind === 'route' ? 3.5 : 2, pts, from: A.id, to: Bp.id };
      roads.push(road);
      return road;
    }
    return null;
  };
  {
    const main = pois.filter((p) => p.town || p.kind === 'ferme' || p.kind === 'usine' || p.kind === 'carriere');
    const minor = pois.filter((p) => !main.includes(p));
    // arbre couvrant minimal (Prim), puis une boucle entre deux villes
    const inT = new Set(main.length ? [main[0].id] : []), edges = [];
    while (inT.size < main.length) {
      let best = null;
      for (const a of main) if (inT.has(a.id)) for (const b of main) if (!inT.has(b.id)) {
        const d = sq(a.x - b.x) + sq(a.z - b.z);
        if (!best || d < best[2]) best = [a, b, d];
      }
      inT.add(best[1].id); edges.push(best);
    }
    const towns = main.filter((p) => p.town);
    let extra = null;
    for (const a of towns) for (const b of towns) {
      if (a.id >= b.id || edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) continue;
      const d = sq(a.x - b.x) + sq(a.z - b.z);
      if (!extra || d < extra[2]) extra = [a, b, d];
    }
    if (extra && extra[2] < sq(620)) edges.push(extra);
    // si une liaison échoue, on raccroche le lieu au plus proche des autres qui le permet
    const byDist = (p, list) => list.filter((q) => q !== p).sort((a, b) => (sq(p.x - a.x) + sq(p.z - a.z)) - (sq(p.x - b.x) + sq(p.z - b.z)));
    for (const [a, b] of edges) if (!link(a, b, 'route')) for (const q of byDist(b, main)) if (link(b, q, 'route')) break;
    // les petits lieux se raccrochent à ce qui est déjà relié au réseau, le plus proche d'abord
    const linked = [...main], todo = [...minor];
    while (todo.length) {
      todo.sort((a, b) => sq(a.x - byDist(a, linked)[0].x) + sq(a.z - byDist(a, linked)[0].z) - sq(b.x - byDist(b, linked)[0].x) - sq(b.z - byDist(b, linked)[0].z));
      const p = todo.shift();
      for (const q of byDist(p, linked)) if (link(p, q, 'chemin')) { linked.push(p); break; }
    }
  }
  // profil en long, ponts, puis la route s'imprime dans le relief
  const carveRoads = (list) => {
    for (const road of list) {
      const P = road.pts;
      let h = P.map((p) => hAt(p.x, p.z));
      for (let pass = 0; pass < 2; pass++) {
        const o = h.slice();
        for (let i = 2; i < h.length - 2; i++) {
          let s = 0, n = 0;
          for (let t = Math.max(0, i - 4); t <= Math.min(h.length - 1, i + 4); t++) { s += o[t]; n++; }
          h[i] = s / n;
        }
      }
      // pente en long bornée (ROAD_GRADE) : on monte partout à pied sans glisser, même jusqu'au refuge du sommet
      const lim = (i, j) => { const d = Math.hypot(P[i].x - P[j].x, P[i].z - P[j].z) * ROAD_GRADE; h[i] = clamp(h[i], h[j] - d, h[j] + d); };
      for (let i = 1; i < h.length; i++) lim(i, i - 1);
      for (let i = h.length - 2; i >= 0; i--) lim(i, i + 1);
      const wet = P.map((p) => { const k = vi(p.x, p.z); return RD[k] < RW[k] + 1.5 ? RL[k] : null; });
      // tablier à 2,6 m au-dessus de l'eau, rampes d'accès à 9 %
      for (let i = 0; i < P.length; i++) {
        for (let t = Math.max(0, i - 8); t <= Math.min(P.length - 1, i + 8); t++) if (wet[t] != null) h[i] = Math.max(h[i], wet[t] + 2.6 - Math.abs(i - t) * 0.36);
        P[i].y = h[i];
      }
      // tronçons au-dessus de l'eau : ponts. Le tablier est une dalle droite et plate ; la route s'y aligne (sinon un
      // virage sortait du tablier) et les rampes d'accès montent jusqu'à son niveau (sinon une marche à chaque bout)
      let st = -1;
      for (let i = 0; i <= P.length; i++) {
        const w = i < P.length && wet[i] != null;
        if (w && st < 0) st = i;
        if (!w && st >= 0) {
          const i0 = Math.max(0, st - 2), i1 = Math.min(P.length - 1, i + 1);
          const ax = P[i0].x, az = P[i0].z, bx = P[i1].x, bz = P[i1].z;
          let D = 0;
          for (let t = i0; t <= i1; t++) D = Math.max(D, P[t].y);
          for (let t = i0; t <= i1; t++) { const f = (t - i0) / (i1 - i0 || 1); Object.assign(P[t], { x: ax + (bx - ax) * f, z: az + (bz - az) * f, y: D, bridge: true }); }
          for (let t = Math.max(0, i0 - 10); t <= Math.min(P.length - 1, i1 + 10); t++) {
            if (t >= i0 && t <= i1) continue;
            const d = t < i0 ? Math.hypot(P[t].x - ax, P[t].z - az) : Math.hypot(P[t].x - bx, P[t].z - bz);
            P[t].y = Math.max(P[t].y, D - d * 0.09);
          }
          bridges.push({ x0: ax, z0: az, x1: bx, z1: bz, y: D, hw: road.hw + 0.8 });
          st = -1;
        }
      }
      for (let n = 0; n < P.length - 1; n++) {
        const a = P[n], b = P[n + 1], m = road.hw + 9;
        const vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz || 1;
        forVerts(Math.min(a.x, b.x) - m, Math.min(a.z, b.z) - m, Math.max(a.x, b.x) + m, Math.max(a.z, b.z) + m, (k, x, z) => {
          const t = clamp(((x - a.x) * vx + (z - a.z) * vz) / l2, 0, 1);
          const dd = Math.sqrt(sq(a.x + vx * t - x) + sq(a.z + vz * t - z));
          if (dd < ROADD[k]) { ROADD[k] = dd; ROADH[k] = a.y + (b.y - a.y) * t; ROADW[k] = road.hw; }
        });
      }
    }
    for (let k = 0; k < N * N; k++) {
      if (ROADD[k] > ROADW[k] + 8) continue;
      if (RD[k] < RW[k] + 0.5 || E[k] < 1) continue; // l'eau reste sous les ponts
      const i = k % N, x = i * HRES, z = ((k - i) / N) * HRES;
      if (ZONE[ci(x, z)] || lakeD(x, z) < 1.02) continue; // l'intérieur des lieux reste plat
      H[k] += (ROADH[k] - H[k]) * ss(ROADW[k] + 8, ROADW[k] + 0.6, ROADD[k]);
    }
  };
  carveRoads(roads);

  // ------------------------------------------------------------------ 8. station-service au bord d'une route
  {
    const cand = [];
    for (const r of roads) if (r.kind === 'route') for (let i = 6; i < r.pts.length - 6; i += 5) cand.push([r, i]);
    rng.shuffle(cand);
    for (const [r, i] of cand) {
      const p = r.pts[i], q = r.pts[i + 1];
      let tx = q.x - p.x, tz = q.z - p.z;
      const tl = Math.sqrt(tx * tx + tz * tz) || 1; tx /= tl; tz /= tl;
      const sg = rng.chance(0.5) ? 1 : -1, nx = -tz * sg, nz_ = tx * sg;
      const alongX = Math.abs(tx) > Math.abs(tz), wc = alongX ? 10 : 8, dc = alongX ? 8 : 10;
      // plus la route est en biais, plus on s'en écarte (le coin de la station ne doit pas mordre dessus)
      const off = r.hw + 3 + Math.min(Math.abs(tx), Math.abs(tz)) * 22 + (alongX ? dc : wc) * CELL / 2;
      const cx = p.x + nx * off, cz = p.z + nz_ * off;
      const x0 = Math.round(cx / CELL - wc / 2), z0 = Math.round(cz / CELL - dc / 2);
      const R = { x0: x0 * CELL, z0: z0 * CELL, x1: (x0 + wc) * CELL, z1: (z0 + dc) * CELL };
      if (pois.some((o) => rectDist(o.rect, R) < 60)) continue;
      if (!fits(R, { minE: 20, maxM: 0.15, lake: 1.3, river: 20 })) continue;
      let clash = false;
      forVerts(R.x0, R.z0, R.x1, R.z1, (k) => { if (ROADD[k] < ROADW[k] + 1) clash = true; });
      if (clash) continue;
      const st = addPoi('station', R, { level: p.y });
      flatten(R, p.y, 10);
      // la boutique au fond, l'auvent et les pompes côté route
      const front = alongX ? (nz_ > 0 ? 'N' : 'S') : (nx > 0 ? 'W' : 'E');
      if (alongX) addB(st, 'station', x0 + 2, nz_ > 0 ? z0 + dc - 4 : z0, 5, 4, front);
      else addB(st, 'station', nx > 0 ? x0 + wc - 4 : x0, z0 + 2, 4, 5, front);
      const mx = (R.x0 + R.x1) / 2 - nx * 6, mz = (R.z0 + R.z1) / 2 - nz_ * 6;
      prop('auvent', mx, mz, { dx: alongX ? 1 : 0, dz: alongX ? 0 : 1 });
      prop('pompe', mx - (alongX ? 4 : 0), mz - (alongX ? 0 : 4)); prop('pompe', mx + (alongX ? 4 : 0), mz + (alongX ? 0 : 4));
      prop('voiture', mx + (alongX ? 9 : -nx * 3), mz + (alongX ? -nz_ * 3 : 9), { dx: alongX ? 1 : 0, dz: alongX ? 0 : 1, c: rng.int(0, CARS - 1) });
      st.gates.push({ x: p.x, z: p.z, sx: p.x, sz: p.z });
      // l'accès : de la route à l'auvent
      roads.push({ kind: 'chemin', hw: 3, from: st.id, to: r.from, pts: [{ ...p }, { x: mx, z: mz, y: p.y }] });
      break;
    }
  }

  // ------------------------------------------------------------------ 9. petits bâtiments dans la nature
  // maisons abandonnées, cabanes de chasse et de pêcheur, tours de guet sur les hauteurs, abris au bord des routes, granges
  const lost = [];
  {
    const prominent = (x, z) => hAt(x, z) > (hAt(x + 40, z) + hAt(x - 40, z) + hAt(x, z + 40) + hAt(x, z - 40)) / 4 + 2;
    const nearWet = (x, z) => lakeD(x, z) < 1.7 || RD[vi(x, z)] - RW[vi(x, z)] < 36;
    // [type, nombre, côtés possibles (cases), étages, condition, règles]
    const SMALL = [
      ['abandonnee', rng.int(15, 18), [3, 4], () => (rng.chance(0.35) ? 2 : 1), null, {}],
      ['cabane', rng.int(6, 8), [2, 3], () => 1, (x, z) => forest(x, z) > 0.35, { gap: 60 }],
      ['cabane', rng.int(2, 3), [2, 2], () => 1, nearWet, { lake: 1.1, river: 7, gap: 60, peche: true }],
      ['guet', rng.int(4, 6), [2, 3], () => 3, prominent, { maxM: 0.6, std: 2.6, gap: 90 }],
      ['abri', rng.int(4, 6), [2, 2], () => 1, (x, z, k) => ROADD[k] < 28, { road: 9, gap: 70 }],
      ['grange', rng.int(2, 3), [4, 5], () => 2, (x, z, k) => M[k] < 0.05 && forest(x, z) < 0.3, { gap: 90 }],
    ];
    for (const [type, want, sides, floors, ok, rule] of SMALL) {
      let n = 0;
      for (let t = 0; t < 3000 && n < want; t++) {
        const x = rng.range(40, S - 40), z = rng.range(40, S - 40), k = vi(x, z);
        let w = rng.pick(sides), d = rng.pick(sides);
        if (type === 'guet') { w = 2; d = 3; }
        if (rng.chance(0.5)) [w, d] = [d, w];
        const fl = floors(), front = rng.pick(['N', 'S', 'E', 'W']);
        if (E[k] < 25 || M[k] > (rule.maxM ?? 0.45) || ROADD[k] < (rule.road ?? 14) || RD[k] - RW[k] < (rule.river ?? 20)) continue;
        if (ok && !ok(x, z, k)) continue;
        const x0 = Math.round(x / CELL - w / 2), z0 = Math.round(z / CELL - d / 2);
        const R = { x0: x0 * CELL, z0: z0 * CELL, x1: (x0 + w) * CELL, z1: (z0 + d) * CELL };
        if (pois.some((p) => rectDist(p.rect, R) < 45) || lost.some((b) => rectDist(b, R) < (type === 'abandonnee' ? 80 : rule.gap))) continue;
        if (fields.some((f) => rectDist(f, R) < 8)) continue;
        const f = fits({ x0: R.x0 - 6, z0: R.z0 - 6, x1: R.x1 + 6, z1: R.z1 + 6 }, { minE: 20, maxM: (rule.maxM ?? 0.45) + 0.05, lake: rule.lake ?? 1.3, river: Math.min(18, rule.river ?? 18) });
        if (!f || f.std > (rule.std ?? 1.6)) continue;
        flatten({ x0: R.x0 - 3, z0: R.z0 - 3, x1: R.x1 + 3, z1: R.z1 + 3 }, f.mean, 10);
        addB(null, type, x0, z0, w, d, front, fl);
        lost.push(R); n++;
        const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
        if (type === 'abandonnee' && rng.chance(0.4)) prop('voiture', R.x1 + 5, cz, { dx: 0, dz: 1, c: 6, epave: true });
        if (type === 'grange') { prop('botte', R.x0 - 3, R.z0 + 3); prop('botte', R.x0 - 3, R.z0 + 6); if (rng.chance(0.4)) prop('tracteur', R.x1 + 4, cz, { dx: 0, dz: 1 }); }
        if (type === 'abri') prop('caisse', R.x1 + 1.5, R.z0 + 1.5);
        if (type === 'cabane' && !rule.peche && rng.chance(0.5)) prop('grume', R.x0 - 3.5, cz, { dx: 0, dz: 1 });
        if (rule.peche) {
          // la barque, tirée sur la rive la plus proche
          for (let r = 8; r <= 40; r += 4) {
            const hit = [[r, 0], [-r, 0], [0, r], [0, -r]].find(([dx, dz]) => lakeD(cx + dx, cz + dz) < 0.98 || RD[vi(cx + dx, cz + dz)] < RW[vi(cx + dx, cz + dz)] - 1);
            if (hit) { prop('bateau', cx + hit[0], cz + hit[1], { dx: hit[1] ? 1 : 0, dz: hit[1] ? 0 : 1 }); break; }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ 10. l'eau, la hauteur des bâtiments
  for (let k = 0; k < N * N; k++) {
    const i = k % N, x = i * HRES, z = ((k - i) / N) * HRES;
    if (H[k] < 0 && E[k] < 40) { WK[k] = WATER.MER; WL[k] = 0; continue; }
    if (Math.abs(x - LC.x) < LX && Math.abs(z - LC.z) < LX && H[k] < LL && lakeD(x, z) < 1.04) { WK[k] = WATER.LAC; WL[k] = LL; continue; }
    if (RD[k] < RW[k] + 1.5 && H[k] < RL[k]) { WK[k] = WATER.RIVIERE; WL[k] = RL[k]; }
  }
  for (const b of buildings) b.y = hAt((b.x0 + b.w / 2) * CELL, (b.z0 + b.d / 2) * CELL);
  // meubles et portes : tirage à part par bâtiment (ajouter un meuble ne change pas l'île)
  for (const b of buildings) furnishBuilding(b, makeRng(ihash(seed * 7919 + b.id * 31 + 17)));
  for (let c = 0; c < GN * GN; c++) {
    const i = c % GN, j = (c - i) / GN, x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, k = vi(x, z);
    if (ROADD[k] < ROADW[k] && (OCC[c] === OC.FREE || OCC[c] === OC.FIELD) && !WK[k]) OCC[c] = OC.ROAD;
  }

  // ------------------------------------------------------------------ 11. forêts, buissons, rochers, voitures sur les routes
  const wet = (x, z) => WK[vi(x, z)] !== 0;
  const nearWater = (x, z, r) => wet(x, z) || wet(x + r, z) || wet(x - r, z) || wet(x, z + r) || wet(x, z - r);
  const freeAt = (x, z, rw) => {
    const k = vi(x, z), c = ci(x, z);
    if (nearWater(x, z, rw) || OCC[c] || ZONE[c]) return false;
    if (ROADD[k] < ROADW[k] + 2.5) return false;
    if (lost.some((r) => inRect(r, x, z, 3))) return false;
    return true;
  };
  {
    const TS = 7;
    for (let gz = 0; gz < S / TS; gz++) for (let gx = 0; gx < S / TS; gx++) {
      const x = (gx + rng.next()) * TS, z = (gz + rng.next()) * TS, r = rng.next(), sc = rng.next();
      const k = vi(x, z);
      if (E[k] < 10 || H[k] > SNOW - 4) continue;
      const f = forest(x, z), belt = M[k] > 0.12 ? 0.2 * (1 - ss(60, 88, H[k])) : 0;
      const p = (0.025 + 0.78 * f) * (1 - ss(72, 94, H[k])) + belt;
      if (r > p || slopeAt(k) > 0.85 || !freeAt(x, z, 4)) continue;
      const pine = H[k] > 38 || M[k] > 0.2 || nz.n2(x * 0.01 + 300, z * 0.01) > 0.42;
      props.push({ kind: pine ? 'sapin' : 'arbre', x, z, dx: 1, dz: 0, s: 0.8 + sc * 0.5 });
    }
    const BS = 9;
    for (let gz = 0; gz < S / BS; gz++) for (let gx = 0; gx < S / BS; gx++) {
      const x = (gx + rng.next()) * BS, z = (gz + rng.next()) * BS, r = rng.next(), sc = rng.next();
      const k = vi(x, z);
      if (E[k] < 8 || H[k] > SNOW - 10) continue;
      if (r > 0.02 + forest(x, z) * 0.1 || !freeAt(x, z, 2)) continue;
      props.push({ kind: 'buisson', x, z, dx: 1, dz: 0, s: 0.7 + sc * 0.6 });
    }
    const KS = 13;
    for (let gz = 0; gz < S / KS; gz++) for (let gx = 0; gx < S / KS; gx++) {
      const x = (gx + rng.next()) * KS, z = (gz + rng.next()) * KS, r = rng.next(), sc = rng.next();
      const k = vi(x, z);
      if (E[k] < 2) continue;
      if (r > 0.01 + M[k] * 0.3 + (E[k] < 20 ? 0.03 : 0) || !freeAt(x, z, 2)) continue;
      const big = M[k] > 0.3 ? sc > 0.35 : sc > 0.8;
      props.push({ kind: 'rocher', x, z, dx: 1, dz: 0, s: big ? 1.3 + sc * 0.8 : 0.5 + sc * 0.6 });
    }
    // voitures abandonnées sur les routes
    for (const r of roads) {
      if (r.kind !== 'route') continue;
      for (let i = 12; i < r.pts.length - 12; i += 22) {
        if (!rng.chance(0.45)) continue;
        const p = r.pts[i], q = r.pts[i + 1];
        if (p.bridge || pois.some((o) => inRect(o.rect, p.x, p.z, 10))) continue;
        let tx = q.x - p.x, tz = q.z - p.z;
        const l = Math.sqrt(tx * tx + tz * tz) || 1; tx /= l; tz /= l;
        const side = rng.chance(0.5) ? 1.6 : -1.6;
        prop('voiture', p.x - tz * side, p.z + tx * side, { dx: tx, dz: tz, c: rng.int(0, CARS - 1) });
      }
    }
  }

  // décor du kit : lampadaires des rues ; bennes et conteneurs à ordures des immeubles et commerces ; barils, pneus,
  // bonbonnes, palettes et cartons des garages, stations, usines, du port et des fermes ; épaves et gravats des
  // maisons abandonnées. Tirage à part : le reste de l'île ne change pas.
  {
    const R = makeRng(ihash(seed * 4243 + 77));
    const free = (x, z, r) => {
      if (x < 20 || z < 20 || x > S - 20 || z > S - 20 || WK[vi(x, z)]) return false;
      if (buildings.some((b) => x > b.x0 * CELL - r - 0.4 && x < (b.x0 + b.w) * CELL + r + 0.4 && z > b.z0 * CELL - r - 0.4 && z < (b.z0 + b.d) * CELL + r + 0.4)) return false;
      return !props.some((p) => { const q = PROPS[p.kind] ? PROPS[p.kind].r * (p.kind === 'rocher' ? p.s : 1) : 0; return sq(p.x - x) + sq(p.z - z) < sq(r + q + 0.4); });
    };
    const put = (kind, x, z, dx = 1, dz = 0) => (free(x, z, PROPS[kind].r) ? prop(kind, x, z, { dx, dz }) : null);
    // lampadaires sur les trottoirs, en quinconce, le bras vers la chaussée
    for (const st of streets) {
      const alongX = st.x1 - st.x0 > st.z1 - st.z0, len = alongX ? st.x1 - st.x0 : st.z1 - st.z0, wid = alongX ? st.z1 - st.z0 : st.x1 - st.x0;
      for (let s2 = 10, k = 0; s2 < len - 4; s2 += 22, k++) {
        const off = k % 2 ? 0.45 : wid - 0.45, toward = k % 2 ? 1 : -1;
        const x = alongX ? st.x0 + s2 : st.x0 + off, z = alongX ? st.z0 + off : st.z0 + s2;
        if (streets.some((o) => o !== st && inRect(o, x, z, 1))) continue;
        put('lampadaire', x, z, alongX ? 0 : toward, alongX ? toward : 0);
      }
    }
    // le long d'un mur qui n'est pas la façade principale : point à `dist` m du mur, et la direction du mur
    const SIDES = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
    const beside = (b, dist) => {
      const sides = Object.keys(SIDES).filter((k) => k !== b.front), sd = sides[R.int(0, sides.length - 1)], [nx, nz] = SIDES[sd];
      const X0 = b.x0 * CELL, Z0 = b.z0 * CELL, X1 = (b.x0 + b.w) * CELL, Z1 = (b.z0 + b.d) * CELL, t = 0.15 + R.next() * 0.7;
      const x = nx ? (nx < 0 ? X0 : X1) + nx * dist : X0 + (X1 - X0) * t, z = nz ? (nz < 0 ? Z0 : Z1) + nz * dist : Z0 + (Z1 - Z0) * t;
      return [x, z, nz ? 1 : 0, nx ? 1 : 0];
    };
    const near = (b, kind, dist = 1.8) => { const [x, z, dx, dz] = beside(b, dist + PROPS[kind].r); return put(kind, x, z, dx, dz); };
    // mobilier urbain : bancs, bouches d'incendie, poubelles et plaques d'égout le long des rues, abribus
    for (const st of streets) {
      const alongX = st.x1 - st.x0 > st.z1 - st.z0, len = alongX ? st.x1 - st.x0 : st.z1 - st.z0, wid = alongX ? st.z1 - st.z0 : st.x1 - st.x0;
      const at = (s2, off) => [alongX ? st.x0 + s2 : st.x0 + off, alongX ? st.z0 + off : st.z0 + s2];
      for (let s2 = 21, k = 0; s2 < len - 4; s2 += 22, k++) {
        const side = k % 2 ? wid - 0.5 : 0.5, toward = k % 2 ? -1 : 1;
        const [x, z] = at(s2, side);
        if (streets.some((o) => o !== st && inRect(o, x, z, 1))) continue;
        const r = R.next();
        if (r < 0.35) { if (put('banc', x, z, alongX ? 0 : toward, alongX ? toward : 0)) { const [cx, cz] = at(s2 + 2.1, side); put('corbeille', cx, cz); } }
        else if (r < 0.6) put('bouche', x, z);
        else if (r < 0.7 && len > 40) put('abribus', ...at(s2, k % 2 ? wid - 0.75 : 0.75), alongX ? 1 : 0, alongX ? 0 : 1);
      }
      for (let s2 = 15, k = 0; s2 < len - 4; s2 += 30, k++) { const [x, z] = at(s2, wid / 2 + (k % 2 ? 1.3 : -1.3)); if (!streets.some((o) => o !== st && inRect(o, x, z, 1))) put('plaque', x, z); }
    }
    // places : bancs tournés vers la fontaine, jardinières aux coins
    for (const pl of plazas) {
      const cx = (pl.x0 + pl.x1) / 2, cz = (pl.z0 + pl.z1) / 2, h = (pl.x1 - pl.x0) / 2;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put('banc', cx + dx * (h - 7), cz + dz * (h - 7), -dz, dx);
      for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) put('jardiniere', cx + dx * (h - 3), cz + dz * (h - 3), 1, 0);
    }
    for (const b of buildings) {
      const poi = b.poi >= 0 ? pois[b.poi] : null, pk = poi ? poi.kind : '';
      // devant les maisons : boîte aux lettres ; derrière : corde à linge ; à côté des portes des commerces : pots de fleurs
      const fd = b.doors.find((d) => d.ext && d.k === 0 && d.kind === 'porte');
      if (fd) {
        const dcx = fd.o === 'h' ? (fd.x + 0.5) * CELL : fd.x * CELL, dcz = fd.o === 'h' ? fd.z * CELL : (fd.z + 0.5) * CELL, tx = fd.nz ? 1 : 0, tz = fd.nx ? 1 : 0;
        if ((b.type === 'maison' || b.type === 'chalet') && R.chance(0.55)) put('boite', dcx + fd.nx * 2 + tx * 3, dcz + fd.nz * 2 + tz * 3, fd.nx, fd.nz);
        if (b.type === 'boutique' || b.type === 'auberge' || b.type === 'mairie' || b.type === 'manoir') for (const sd of [-1, 1]) put('pot', dcx + fd.nx * 0.7 + tx * sd * 1.9, dcz + fd.nz * 0.7 + tz * sd * 1.9);
        if ((b.type === 'maison' || b.type === 'chalet' || pk === 'ferme') && R.chance(0.3)) near(b, 'linge', 3.5);
      }
      if (b.type === 'immeuble' && R.chance(0.35)) near(b, 'transfo', 1);
      if ((b.type === 'immeuble' || b.type === 'boutique' || b.type === 'bureaux') && R.chance(0.55)) {
        const d = near(b, R.chance(0.6) ? 'benne' : 'poubelle');
        // des sacs poubelle à côté
        if (d) for (let i = 0; i < 2; i++) put('sacpoubelle', d.x + (d.dx ? 1.9 + i * 0.6 : 0.4 + i * 0.5) * (i ? 1 : -1), d.z + (d.dz ? 1.9 + i * 0.6 : 0.4) * (i ? 1 : -1));
      }
      if (b.type === 'station') { near(b, 'pneus'); near(b, 'bonbonne'); for (let i = 0; i < 3; i++) near(b, 'cone', 1.2 + i * 1.3); }
      if (b.type === 'garage') { near(b, 'pneus'); if (R.chance(0.6)) near(b, 'baril'); if (R.chance(0.5)) near(b, 'palette'); }
      if (b.type === 'hangar' || pk === 'usine' || pk === 'port') {
        for (let i = 0; i < 2; i++) near(b, 'baril', 1.4 + i * 1.1);
        if (R.chance(0.7)) near(b, 'palette', 2);
        if (R.chance(0.6)) near(b, 'cartons', 1.6);
        if (R.chance(0.4)) near(b, 'tuyaux', 2.5);
        if (pk === 'usine' && R.chance(0.6)) near(b, 'caisson', 2.5);
      }
      if (b.type === 'grange' || pk === 'ferme') { if (R.chance(0.6)) near(b, 'reservoir', 2.5); if (R.chance(0.5)) near(b, 'palette', 2); }
      if (pk === 'scierie' && R.chance(0.8)) near(b, 'planches', 2);
      if (pk === 'carriere' && R.chance(0.7)) near(b, 'sacs', 2);
      if (b.type === 'abandonnee') { if (R.chance(0.5)) near(b, 'gravats', 2.5); if (R.chance(0.35)) near(b, 'epave', 3.5); }
      if (pk === 'camping' && R.chance(0.5)) near(b, 'cartons', 1.5);
    }
  }

  // abords des bâtiments des villes et villages : une allée pavée va de chaque porte au trottoir, un parvis dallé
  // s'étend devant les immeubles et les commerces, une haie taillée borde le jardin des maisons côté rue (ouverte
  // au droit de l'allée). Sans tirage : le reste de l'île ne change pas.
  const paths = [];
  {
    const PARVIS = new Set(['immeuble', 'tour', 'bureaux', 'boutique', 'mairie', 'auberge', 'garage']);
    const HEDGE = new Set(['maison', 'chalet', 'manoir']);
    const inStreet = (x, z) => streets.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) || plazas.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    const inBuilding = (x, z, m = 0) => buildings.some((b) => x > b.x0 * CELL - m && x < (b.x0 + b.w) * CELL + m && z > b.z0 * CELL - m && z < (b.z0 + b.d) * CELL + m);
    const hedgeFree = (x, z) => !WK[vi(x, z)] && !inBuilding(x, z, 0.5) && !props.some((p) => p.kind !== 'haie' && PROPS[p.kind] && PROPS[p.kind].r > 0 && sq(p.x - x) + sq(p.z - z) < sq(PROPS[p.kind].r + 1.1));
    for (const b of buildings) {
      const poi = b.poi >= 0 ? pois[b.poi] : null;
      if (!poi || !poi.town || b.abandoned) continue;
      for (const e of b.levels[0].walls) {
        if (!e.ext || (e.k !== 'porte' && e.k !== 'portail')) continue;
        const h = e.o === 'h', nx = h ? 0 : e.x === b.x0 ? -1 : 1, nz = h ? (e.z === b.z0 ? -1 : 1) : 0;
        const mx = h ? (e.x + 0.5) * CELL : e.x * CELL, mz = h ? e.z * CELL : (e.z + 0.5) * CELL;
        // jusqu'au trottoir (rien s'il y a un bâtiment ou le bord du lieu avant)
        let gap = 0;
        for (let t = 0.25; t <= 14; t += 0.25) {
          const x = mx + nx * t, z = mz + nz * t;
          if (inStreet(x, z)) { gap = t - 0.25; break; }
          if (inBuilding(x, z) || !inRect(poi.rect, x, z, 0)) break;
        }
        if (gap < 0.75) continue;
        const front = (h ? (nz < 0 ? 'N' : 'S') : nx < 0 ? 'W' : 'E') === b.front;
        const a0 = h ? b.x0 * CELL : b.z0 * CELL, a1 = h ? (b.x0 + b.w) * CELL : (b.z0 + b.d) * CELL, door = h ? mx : mz;
        const wide = front && PARVIS.has(b.type) && gap <= 8;
        const c0 = wide ? a0 : door - 0.8, c1 = wide ? a1 : door + 0.8;
        const n0 = h ? mz : mx, n1 = n0 + (h ? nz : nx) * (gap + 0.25); // jusque sous le trottoir
        paths.push(h ? { x0: c0, x1: c1, z0: Math.min(n0, n1), z1: Math.max(n0, n1), kind: wide ? 'parvis' : 'allee' }
          : { x0: Math.min(n0, n1), x1: Math.max(n0, n1), z0: c0, z1: c1, kind: wide ? 'parvis' : 'allee' });
        // haie : devant les maisons, à 0,6 m du trottoir, en tronçons de 2 m, ouverte devant l'allée
        if (!front || !HEDGE.has(b.type) || gap < 2.5) continue;
        const off = gap - 0.6;
        for (let a = a0 - 1; a <= a1 + 1.01; a += 2) {
          if (Math.abs(a - door) < 2.1) continue;
          const x = h ? a : mx + nx * off, z = h ? mz + nz * off : a;
          const ends = h ? [[x - 1, z], [x + 1, z]] : [[x, z - 1], [x, z + 1]];
          if (ends.some(([ex, ez]) => inStreet(ex, ez) || inBuilding(ex, ez, 0.3) || !inRect(poi.rect, ex, ez, 0)) || !hedgeFree(x, z)) continue;
          prop('haie', x, z, { dx: h ? 1 : 0, dz: h ? 0 : 1 });
        }
      }
    }
  }

  // rien ne bouche une porte : le décor solide posé juste devant une porte ou un portail du rez-de-chaussée est retiré
  {
    const fronts = [];
    for (const b of buildings) for (const e of b.levels[0].walls) {
      if (!e.ext || (e.k !== 'porte' && e.k !== 'portail' && e.k !== 'casse')) continue;
      const nx = e.o === 'v' ? (e.x === b.x0 ? -1 : 1) : 0, nz = e.o === 'h' ? (e.z === b.z0 ? -1 : 1) : 0;
      const mx = e.o === 'h' ? (e.x + 0.5) * CELL : e.x * CELL, mz = e.o === 'h' ? e.z * CELL : (e.z + 0.5) * CELL;
      fronts.push([mx + nx * 2.2, mz + nz * 2.2]);
    }
    const keep = props.filter((p) => {
      const r = PROPS[p.kind] ? PROPS[p.kind].r * (p.kind === 'rocher' ? p.s : 1) : 0;
      if (!r) return true;
      return !fronts.some(([x, z]) => sq(p.x - x) + sq(p.z - z) < sq(r + 2.4));
    });
    props.length = 0; props.push(...keep);
  }

  // ------------------------------------------------------------------ 12. coffres, butin au sol, munitions
  const chests = [], loot = [], ammo = [];
  for (const b of buildings) {
    const base = { b: b.id, poi: b.poi };
    for (const c of b.chests) chests.push({ ...base, x: c.x, z: c.z, k: c.k, y: b.y + c.k * STOREY, fx: c.fx, fz: c.fz });
    for (const c of b.loot) loot.push({ ...base, x: c.x, z: c.z, k: c.k, y: b.y + c.k * STOREY });
    for (const c of b.ammo) ammo.push({ ...base, x: c.x, z: c.z, k: c.k, y: b.y + c.k * STOREY });
  }
  const outdoor = (x, z, poi = -1) => chests.push({ b: -1, poi, x, z, k: -1, y: hAt(x, z), fx: 0, fz: 1 });
  for (const p of pois) {
    if (p.kind === 'camping' || p.kind === 'carriere') {
      const f = props.find((q) => (q.kind === 'feu' || q.kind === 'engin') && inRect(p.rect, q.x, q.z));
      if (f) outdoor(f.x + 3, f.z + 2, p.id);
    }
  }
  if (bridges.length) { const br = bridges[0]; outdoor((br.x0 + br.x1) / 2 + 3, (br.z0 + br.z1) / 2 + 3); chests[chests.length - 1].sousPont = true; }
  {
    // coffres cachés dans la nature : sous-bois, montagne, rives du lac
    const hidden = [];
    for (let t = 0; t < 4000 && hidden.length < 8; t++) {
      const x = rng.range(40, S - 40), z = rng.range(40, S - 40), r = rng.next(), k = vi(x, z);
      if (E[k] < 15 || H[k] > SNOW || !freeAt(x, z, 3)) continue;
      const appeal = forest(x, z) * 0.7 + M[k] * 0.8 + (lakeD(x, z) < 1.5 ? 0.6 : 0);
      if (r > appeal) continue;
      if (hidden.some((h) => sq(h.x - x) + sq(h.z - z) < sq(110))) continue;
      if (buildings.some((b) => inRect({ x0: b.x0 * CELL, z0: b.z0 * CELL, x1: (b.x0 + b.w) * CELL, z1: (b.z0 + b.d) * CELL }, x, z, 40))) continue;
      hidden.push({ x, z });
      outdoor(x, z);
    }
  }
  for (const p of pois) {
    p.chests = chests.filter((c) => c.poi === p.id).length;
    p.loot = loot.filter((c) => c.poi === p.id).length;
  }

  // ------------------------------------------------------------------ 13. noms, classes du sol, chiffres
  let peak = { h: -1 };
  for (let k = 0; k < N * N; k++) if (M[k] > 0.3 && H[k] > peak.h) { const i = k % N; peak = { h: H[k], x: i * HRES, z: ((k - i) / N) * HRES }; }
  const labels = pois.map((p) => ({ text: p.name, x: p.x, z: p.z, kind: p.kind, town: p.town }));
  const lakeName = nameFor('lac'), montName = nameFor('mont'), riverName = river ? nameFor('riviere') : null;
  labels.push({ text: lakeName, x: LC.x, z: LC.z, kind: 'lac', nature: true });
  if (peak.h > 0) labels.push({ text: montName, x: peak.x, z: peak.z + 26, kind: 'mont', nature: true, alt: Math.round(peak.h) });
  if (river) { const m = river[Math.floor(river.length * 0.55)]; labels.push({ text: riverName, x: m.x, z: m.z, kind: 'riviere', nature: true }); }

  const ground = new Uint8Array(GN * GN);
  const counts = new Array(GROUND.length).fill(0);
  for (let c = 0; c < GN * GN; c++) {
    const i = c % GN, j = (c - i) / GN, x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, k = vi(x, z), o = OCC[c], zn = ZONE[c];
    let g;
    if (WK[k] === WATER.MER) g = GR.MER;
    else if (WK[k] === WATER.LAC) g = GR.LAC;
    else if (WK[k] === WATER.RIVIERE) g = GR.RIVIERE;
    else if (o === OC.BUILD) g = GR.BATI;
    else if (zn && pois[zn - 1].town) g = GR.VILLE;
    else if (zn) g = GR.LIEU;
    else if (o === OC.ROAD) g = GR.ROUTE;
    else if (o === OC.FIELD) g = GR.CHAMP;
    else if (H[k] > SNOW) g = GR.NEIGE;
    else if (M[k] > 0.3 && (H[k] > 55 || slopeAt(k) > 0.8)) g = GR.ROCHE;
    else if (M[k] > 0.15) g = GR.MONTAGNE;
    else if (E[k] < 14 && H[k] < 2.4) g = GR.PLAGE;
    else if (forest(x, z) > 0.4) g = GR.FORET;
    else g = GR.PLAINE;
    ground[c] = g; counts[g]++;
  }
  // part de nature : tout ce qui n'est ni ville, ni lieu-dit, ni route (le lac, la rivière et les maisons abandonnées comptent)
  const island = GN * GN - counts[GR.MER];
  let urban = 0, lieux = 0;
  for (let c = 0; c < GN * GN; c++) { if (ground[c] === GR.MER) continue; const zn = ZONE[c]; if (zn) { if (pois[zn - 1].town) urban++; else lieux++; } }
  lieux += counts[GR.CHAMP];
  const roadsN = counts[GR.ROUTE];
  let bx0 = S, bz0 = S, bx1 = 0, bz1 = 0;
  for (let c = 0; c < GN * GN; c++) if (ground[c] !== GR.MER) { const i = c % GN, j = (c - i) / GN; bx0 = Math.min(bx0, i); bx1 = Math.max(bx1, i); bz0 = Math.min(bz0, j); bz1 = Math.max(bz1, j); }
  const byKind = {};
  for (const p of props) byKind[p.kind] = (byKind[p.kind] || 0) + 1;
  const byType = {};
  for (const b of buildings) byType[b.type] = (byType[b.type] || 0) + 1;
  const stats = {
    islandKm2: (island * CELL * CELL) / 1e6,
    nature: (island - urban - lieux - roadsN) / island, urban: urban / island, lieux: lieux / island, roads: roadsN / island,
    forest: counts[GR.FORET] / island, water: (counts[GR.LAC] + counts[GR.RIVIERE]) / island, mountain: (counts[GR.MONTAGNE] + counts[GR.ROCHE] + counts[GR.NEIGE]) / island,
    spanM: Math.max(bx1 - bx0, bz1 - bz0) * CELL,
    buildings: buildings.length, byType, props: byKind,
    chests: chests.length, loot: loot.length, ammo: ammo.length,
    furniture: buildings.reduce((n, b) => n + b.furniture.length, 0), doors: buildings.reduce((n, b) => n + b.doors.length, 0),
    towns: pois.filter((p) => p.town).length, lieuxDits: pois.filter((p) => !p.town).length,
    roadKm: roads.reduce((s, r) => s + r.pts.length * 4, 0) / 1000, bridges: bridges.length,
    groundCounts: counts,
  };

  // empreinte de l'île : la même graine doit donner le même nombre partout
  let hh = 2166136261 >>> 0;
  const mix = (v) => { hh = Math.imul(hh ^ (v | 0), 16777619) >>> 0; };
  for (const b of buildings) { mix(b.x0); mix(b.z0); mix(b.w * 16 + b.d); mix(b.floors); mix(b.chests.length); }
  mix(props.length);
  for (let i = 0; i < props.length; i += 37) { mix(Math.round(props[i].x * 8)); mix(Math.round(props[i].z * 8)); }
  for (let k = 0; k < N * N; k += 4099) mix(Math.round(H[k] * 64));

  const waterAt = (x, z) => WK[vi(x, z)];
  return {
    seed, size: S, hres: HRES, n: N, cell: CELL, gn: GN, center: C, islandR: R0,
    heights: H, water: WK, waterLevel: WL, ground, zone: ZONE, occ: OCC, mountain: M, inland: E,
    heightAt: hAt, waterAt, groundAt: (x, z) => ground[ci(x, z)], poiAt: (x, z) => { const zn = ZONE[ci(x, z)]; return zn ? pois[zn - 1] : null; },
    forestAt: forest,
    lake: { x: LC.x, z: LC.z, a: la, b: lb, ax: LA.x, az: LA.z, level: LL, name: lakeName },
    river: river ? { pts: river.map((p) => ({ x: p.x, z: p.z, hw: p.hw, lv: p.lv })), name: riverName } : null,
    peak: { ...peak, name: montName },
    pois, buildings, props, streets, roads, bridges, fields, docks, plazas, paths,
    chests, loot, ammo, labels, stats, hash: hh >>> 0, ms: Math.round(now() - T0),
  };
}

// ------------------------------------------------------------------ la tempête : des cercles de plus en plus petits
// Chaque partie tire sa propre tempête (graine de partie), sur la même île.
export const STORM_TIMES = [ // attente avant de se refermer, durée de la fermeture (s), dégâts par seconde
  { wait: 75, shrink: 60, dps: 1 }, { wait: 60, shrink: 50, dps: 1 }, { wait: 50, shrink: 45, dps: 2 }, { wait: 45, shrink: 40, dps: 3 },
  { wait: 40, shrink: 30, dps: 5 }, { wait: 30, shrink: 25, dps: 8 }, { wait: 20, shrink: 20, dps: 10 },
];
export function planStorm(map, seed) {
  const rng = makeRng(ihash(seed ^ 0x5eed));
  const R = map.islandR, radii = [0.66, 0.42, 0.26, 0.15, 0.08, 0.035, 0].map((f) => f * R);
  const land = (x, z) => x > 0 && z > 0 && x < map.size && z < map.size && map.waterAt(x, z) === 0;
  let cur = { x: map.center, z: map.center, r: map.size * 0.75 };
  const out = [{ ...cur, ...STORM_TIMES[0] }];
  for (let i = 0; i < radii.length; i++) {
    const r = radii[i], span = cur.r - r;
    let pick = null;
    for (let t = 0; t < 400 && !pick; t++) {
      const dx = rng.range(-1, 1), dz = rng.range(-1, 1);
      if (dx * dx + dz * dz > 1) continue;
      const x = cur.x + dx * span, z = cur.z + dz * span;
      // le centre (et pour les grands cercles, un peu autour) doit être sur la terre ferme
      if (!land(x, z)) continue;
      if (r > 60 && !(land(x + r * 0.4, z) && land(x - r * 0.4, z) && land(x, z + r * 0.4) && land(x, z - r * 0.4))) continue;
      pick = { x, z };
    }
    if (!pick) pick = { x: cur.x, z: cur.z };
    cur = { x: pick.x, z: pick.z, r };
    out.push({ ...cur, ...(STORM_TIMES[i + 1] || STORM_TIMES[STORM_TIMES.length - 1]) });
  }
  return out;
}

// trajet de la montgolfière : une ligne qui traverse l'île près du centre
export function planFlight(map, seed) {
  const rng = makeRng(ihash(seed ^ 0xf11e));
  const d = unit(rng), off = rng.range(-0.25, 0.25) * map.islandR, C = map.center, L = map.size * 0.72;
  const cx = C - d.z * off, cz = C + d.x * off;
  return { x0: cx - d.x * L, z0: cz - d.z * L, x1: cx + d.x * L, z1: cz + d.z * L, speed: 24, height: 150 };
}
