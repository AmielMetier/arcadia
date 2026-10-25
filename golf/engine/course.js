// Birdie Party — les 18 trous et leur terrain. Moteur pur (aucun DOM) : le même code donne le relief et les surfaces
// à la physique (hôte et invités) et au rendu. Repère : x vers la gauche quand on regarde le green depuis le départ,
// y vers le haut, z du départ vers le green.
//
// Un trou est décrit par quelques formes : une ligne de jeu (départ → fairway → green) avec la largeur du fairway,
// le green (ellipse penchée), les bunkers, les étangs, des collines, et selon le décor : la mer (trait de côte + plage),
// des plateaux à falaises, des ravins avec un torrent, une pente générale. buildHole() en tire des fonctions continues :
// heightAt(x, z) pour le relief, surfaceAt(x, z) pour la nature du sol, et la liste des arbres.
import { makeRng } from './rng.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// réglages par décor : forme de la vallée, vent, essences d'arbres
export const THEMES = {
  campagne: { label: 'Campagne', valley: 34, bankH: 15, bankR: 60, wind: 5, trees: [['round', 5], ['oak', 3], ['pine', 2]] },
  mer: { label: 'Bord de mer', valley: 38, bankH: 11, bankR: 60, wind: 7, trees: [['palm', 6], ['round', 2], ['oak', 1]] },
  montagne: { label: 'Montagne', valley: 30, bankH: 26, bankR: 48, wind: 6, trees: [['pine', 8], ['round', 1]] },
};

// ------------------------------------------------------------------ les trous
// Pour chaque trou : par, départ, drapeau, ligne de jeu [x, z, demi-largeur du fairway (0 : pas de fairway)], green,
// bunkers, étangs (water), collines (hills) ; options : coast (mer), plateaus, ravines, tilt (pente [dh/dx, dh/dz]).
const T0 = { x: 0, z: 0 };
export const HOLES = [
  // --------------------------------------------------------------- campagne
  {
    n: 1, name: 'Les Prés Fleuris', theme: 'campagne', par: 4, seed: 101, tee: T0, pin: { x: -38, z: 334 },
    line: [[0, 34, 13], [-1, 100, 16], [3, 175, 19], [-3, 236, 18], [-19, 286, 15], [-31, 314, 12]],
    green: { x: -37, z: 333, rx: 14, rz: 17, rot: 0.35, lift: 0.7, sx: 0.013, sz: -0.009, ph: 1.7 },
    bunkers: [
      { x: 21, z: 228, rx: 9, rz: 5.5, rot: -0.35, ph: 0.4 }, { x: -23, z: 202, rx: 6.5, rz: 4.5, rot: 0.6, ph: 2.1 },
      { x: -19, z: 322, rx: 6.5, rz: 4, rot: 1.0, ph: 3.3 }, { x: -53, z: 343, rx: 6, rz: 3.8, rot: -0.5, ph: 5.2 },
    ],
    water: [{ x: -44, z: 150, rx: 21, rz: 32, rot: 0.25, ph: 0.9, depth: 2.6 }],
    hills: [{ x: 60, z: 120, r: 45, h: 6 }, { x: -85, z: 280, r: 50, h: 7 }, { x: 40, z: 360, r: 40, h: 5 }],
    bounds: { x0: -115, x1: 95, z0: -45, z1: 400 },
  },
  {
    n: 2, name: 'Le Petit Lac', theme: 'campagne', par: 3, seed: 202, tee: T0, pin: { x: 4, z: 152 },
    line: [[2, 40, 0], [4, 118, 7], [5, 132, 9]],
    green: { x: 6, z: 150, rx: 13, rz: 11, rot: 0.2, lift: 0.5, sx: -0.012, sz: -0.008, ph: 0.6 },
    bunkers: [{ x: -12, z: 156, rx: 5, rz: 4, rot: 0.6, ph: 1 }, { x: 22, z: 148, rx: 5.5, rz: 3.5, rot: -0.8, ph: 2 }, { x: 8, z: 166, rx: 6, rz: 3, rot: 0.1, ph: 3 }],
    water: [{ x: 3, z: 82, rx: 22, rz: 26, rot: 0.1, ph: 1.2, depth: 2.4 }],
    hills: [{ x: -50, z: 90, r: 35, h: 5 }, { x: 55, z: 150, r: 40, h: 6 }],
  },
  {
    n: 3, name: 'La Grande Allée', theme: 'campagne', par: 5, seed: 303, tee: T0, pin: { x: -10, z: 474 },
    line: [[0, 35, 14], [6, 120, 18], [20, 220, 19], [18, 300, 18], [0, 380, 16], [-10, 440, 12]],
    green: { x: -12, z: 470, rx: 15, rz: 17, rot: -0.2, lift: 0.8, sx: -0.01, sz: 0.011, ph: 2.4 },
    bunkers: [
      { x: -12, z: 235, rx: 8, rz: 5, rot: 0.3, ph: 1 }, { x: 42, z: 300, rx: 7, rz: 5, rot: -0.4, ph: 2 }, { x: -28, z: 455, rx: 6, rz: 4, rot: 0.8, ph: 3 },
      { x: 6, z: 487, rx: 6, rz: 3.5, rot: -0.3, ph: 4 }, { x: 22, z: 400, rx: 7, rz: 4.5, rot: 0.2, ph: 5 },
    ],
    water: [{ x: -35, z: 360, rx: 16, rz: 24, rot: 0.2, ph: 0.4, depth: 2.4 }],
    hills: [{ x: 75, z: 200, r: 50, h: 7 }, { x: -70, z: 120, r: 45, h: 6 }],
  },
  {
    n: 4, name: 'Le Ruisseau', theme: 'campagne', par: 4, seed: 404, tee: T0, pin: { x: -64, z: 354 },
    line: [[0, 35, 14], [-2, 120, 17], [-8, 205, 18], [-30, 270, 16], [-55, 320, 13]],
    green: { x: -66, z: 352, rx: 14, rz: 16, rot: 0.6, lift: 0.6, sx: 0.012, sz: -0.01, ph: 0.8 },
    bunkers: [{ x: 16, z: 196, rx: 7, rz: 5, rot: -0.3, ph: 1 }, { x: -46, z: 344, rx: 6, rz: 4, rot: 1.0, ph: 2 }, { x: -82, z: 362, rx: 5.5, rz: 3.5, rot: 0.3, ph: 3 }],
    water: [{ x: -22, z: 252, rx: 46, rz: 5.5, rot: 0.25, ph: 0.3, depth: 1.8 }],
    hills: [{ x: 60, z: 300, r: 45, h: 7 }, { x: -95, z: 150, r: 50, h: 8 }],
  },
  {
    n: 5, name: 'Les Chênes', theme: 'campagne', par: 4, seed: 505, tee: T0, pin: { x: -1, z: 321 }, valley: 27,
    line: [[0, 35, 12], [3, 110, 14], [0, 200, 15], [-4, 270, 13], [-4, 295, 11]],
    green: { x: -3, z: 318, rx: 13, rz: 15, rot: 0.1, lift: 0.9, sx: 0.013, sz: 0.008, ph: 3.1 },
    bunkers: [{ x: -18, z: 215, rx: 6, rz: 4.5, rot: 0.4, ph: 1 }, { x: 15, z: 240, rx: 6, rz: 4.5, rot: -0.4, ph: 2 }, { x: 14, z: 313, rx: 5, rz: 3.5, rot: -1.0, ph: 3 }, { x: -19, z: 323, rx: 5, rz: 3.5, rot: 1.0, ph: 4 }],
    hills: [{ x: 50, z: 160, r: 40, h: 6 }],
  },
  {
    n: 6, name: 'Le Moulin', theme: 'campagne', par: 3, seed: 606, tee: T0, pin: { x: 6, z: 179 }, tilt: [0, -0.02],
    line: [[0, 40, 0], [2, 145, 9], [3, 158, 11]],
    green: { x: 4, z: 176, rx: 14, rz: 13, rot: 0, lift: 0.4, sx: -0.01, sz: 0.012, ph: 1.9 },
    bunkers: [{ x: -9, z: 160, rx: 5.5, rz: 3.5, rot: 0.5, ph: 1 }, { x: 17, z: 161, rx: 5.5, rz: 3.5, rot: -0.5, ph: 2 }, { x: 2, z: 195, rx: 7, rz: 3, rot: 0, ph: 3 }],
    water: [{ x: -32, z: 118, rx: 14, rz: 18, rot: 0.4, ph: 2, depth: 2.2 }],
    hills: [{ x: 60, z: 90, r: 40, h: 6 }],
  },
  // --------------------------------------------------------------- bord de mer
  {
    n: 7, name: 'La Plage', theme: 'mer', par: 4, seed: 707, tee: T0, pin: { x: -1, z: 352 },
    line: [[0, 35, 14], [4, 120, 17], [10, 220, 18], [8, 290, 15], [0, 325, 12]],
    green: { x: -2, z: 350, rx: 14, rz: 16, rot: -0.2, lift: 0.6, sx: -0.012, sz: -0.01, ph: 1.2 },
    bunkers: [{ x: -16, z: 235, rx: 7, rz: 5, rot: 0.2, ph: 1 }, { x: 14, z: 345, rx: 5, rz: 3.5, rot: -0.9, ph: 2 }, { x: -17, z: 358, rx: 5, rz: 3.5, rot: 0.7, ph: 3 }],
    hills: [{ x: -80, z: 200, r: 60, h: 10 }, { x: -70, z: 380, r: 50, h: 8 }],
    coast: { pts: [[46, -100], [50, 150], [42, 420]], sea: [300, 150], level: -1.4, beach: 10 },
  },
  {
    n: 8, name: 'Le Cap', theme: 'mer', par: 3, seed: 808, tee: T0, pin: { x: -6, z: 168 },
    line: [[0, 30, 0], [-6, 140, 9], [-7, 152, 10]],
    green: { x: -8, z: 166, rx: 13, rz: 12, rot: 0.3, lift: 0.7, sx: 0.012, sz: -0.012, ph: 2.2 },
    bunkers: [{ x: 10, z: 170, rx: 5, rz: 3.5, rot: -0.6, ph: 1 }, { x: -25, z: 160, rx: 5, rz: 3.5, rot: 0.8, ph: 2 }],
    hills: [{ x: 60, z: 90, r: 45, h: 9 }],
    coast: { pts: [[-400, 40], [-70, 42], [-18, 54], [8, 70], [14, 86], [0, 104], [-30, 120], [-80, 128], [-400, 130]], sea: [-80, 85], level: -1.4, beach: 7 },
  },
  {
    n: 9, name: "L'Anse", theme: 'mer', par: 5, seed: 909, tee: T0, pin: { x: 124, z: 451 },
    line: [[0, 35, 15], [0, 130, 18], [8, 225, 18], [36, 305, 16], [78, 368, 15], [108, 420, 12]],
    green: { x: 122, z: 448, rx: 14, rz: 17, rot: -0.6, lift: 0.7, sx: -0.01, sz: 0.01, ph: 0.5 },
    bunkers: [{ x: -18, z: 245, rx: 7, rz: 5, rot: 0.1, ph: 1 }, { x: 18, z: 330, rx: 6, rz: 4, rot: 0.5, ph: 2 }, { x: 101, z: 452, rx: 5, rz: 3.5, rot: 1, ph: 3 }, { x: 141, z: 440, rx: 5, rz: 3.5, rot: -0.4, ph: 4 }],
    hills: [{ x: -90, z: 250, r: 60, h: 10 }, { x: 10, z: 480, r: 50, h: 8 }],
    coast: { pts: [[700, 150], [95, 160], [62, 230], [78, 300], [135, 330], [700, 335]], sea: [180, 250], level: -1.4, beach: 8 },
  },
  {
    n: 10, name: 'Les Palmiers', theme: 'mer', par: 4, seed: 1010, tee: T0, pin: { x: -5, z: 332 },
    line: [[0, 35, 14], [-4, 120, 16], [-12, 210, 17], [-8, 280, 14], [-4, 305, 11]],
    green: { x: -3, z: 330, rx: 14, rz: 15, rot: 0.2, lift: 0.6, sx: 0.012, sz: -0.01, ph: 1.6 },
    bunkers: [{ x: -24, z: 226, rx: 7, rz: 5, rot: -0.2, ph: 1 }, { x: -20, z: 330, rx: 5, rz: 3.5, rot: 0.8, ph: 2 }],
    water: [{ x: 24, z: 298, rx: 16, rz: 20, rot: -0.3, ph: 0.7, depth: 2.4 }],
    hills: [{ x: 80, z: 160, r: 55, h: 9 }],
    coast: { pts: [[-112, -300], [-116, 200], [-100, 700]], sea: [-400, 200], level: -1.4, beach: 12 },
  },
  {
    n: 11, name: 'La Pointe', theme: 'mer', par: 3, seed: 1111, tee: T0, pin: { x: 5, z: 142 },
    line: [[0, 30, 0], [2, 115, 8], [3, 126, 9]],
    green: { x: 4, z: 140, rx: 12, rz: 11, rot: 0.4, lift: 0.5, sx: -0.012, sz: -0.012, ph: 2.9 },
    bunkers: [{ x: -12, z: 138, rx: 4.5, rz: 3.5, rot: 1, ph: 1 }, { x: 4, z: 124, rx: 6, rz: 2.5, rot: 0, ph: 2 }],
    hills: [{ x: -60, z: 60, r: 45, h: 8 }],
    coast: { pts: [[62, -300], [56, 90], [32, 160], [-20, 182], [-400, 190]], sea: [250, 320], level: -1.4, beach: 7 },
  },
  {
    n: 12, name: 'Le Phare', theme: 'mer', par: 5, seed: 1212, tee: T0, pin: { x: 10, z: 501 },
    line: [[0, 35, 15], [-4, 140, 18], [-10, 240, 19], [-6, 340, 18], [4, 430, 14], [8, 470, 12]],
    green: { x: 8, z: 498, rx: 15, rz: 17, rot: 0.1, lift: 0.8, sx: 0.01, sz: -0.012, ph: 0.2 },
    bunkers: [{ x: 21, z: 250, rx: 8, rz: 5, rot: 0.2, ph: 1 }, { x: -25, z: 355, rx: 7, rz: 5, rot: -0.3, ph: 2 }, { x: -10, z: 491, rx: 5, rz: 3.5, rot: 0.8, ph: 3 }, { x: 27, z: 505, rx: 5, rz: 3.5, rot: -0.8, ph: 4 }],
    water: [{ x: 32, z: 420, rx: 14, rz: 18, rot: 0.2, ph: 1.4, depth: 2.4 }],
    hills: [{ x: 90, z: 300, r: 60, h: 11 }],
    coast: { pts: [[-62, -300], [-64, 200], [-48, 420], [-62, 800]], sea: [-400, 300], level: -1.4, beach: 11 },
  },
  // --------------------------------------------------------------- montagne
  {
    n: 13, name: 'Le Col', theme: 'montagne', par: 4, seed: 1313, tee: T0, pin: { x: -13, z: 341 }, tilt: [0, -0.035],
    line: [[0, 35, 14], [4, 120, 17], [0, 210, 18], [-10, 280, 15], [-14, 310, 12]],
    green: { x: -15, z: 338, rx: 14, rz: 16, rot: 0.3, lift: 0.7, sx: 0.012, sz: 0.01, ph: 1.1 },
    bunkers: [{ x: 20, z: 215, rx: 7, rz: 5, rot: -0.2, ph: 1 }, { x: -31, z: 330, rx: 5, rz: 4, rot: 0.9, ph: 2 }],
    plateaus: [{ x: 48, z: 150, rx: 18, rz: 38, rot: 0.2, h: 9, ph: 1 }, { x: -58, z: 240, rx: 20, rz: 32, rot: -0.3, h: 11, ph: 2 }],
  },
  {
    n: 14, name: 'Le Torrent', theme: 'montagne', par: 3, seed: 1414, tee: T0, pin: { x: 5, z: 164 },
    line: [[0, 30, 0], [2, 135, 8], [3, 146, 10]],
    green: { x: 3, z: 162, rx: 13, rz: 12, rot: 0.2, lift: 0.6, sx: -0.01, sz: 0.012, ph: 2.6 },
    bunkers: [{ x: -12, z: 171, rx: 5, rz: 3.5, rot: 0.8, ph: 1 }, { x: 19, z: 158, rx: 4.5, rz: 3.5, rot: -0.7, ph: 2 }],
    hills: [{ x: -60, z: 190, r: 40, h: 9 }],
    ravines: [{ pts: [[-400, 80], [-60, 86], [0, 90], [60, 82], [400, 74]], w: 22, depth: 9 }],
  },
  {
    n: 15, name: 'Les Sapins', theme: 'montagne', par: 4, seed: 1515, tee: T0, pin: { x: 64, z: 375 }, tilt: [0, 0.025],
    line: [[0, 35, 14], [2, 130, 16], [10, 220, 17], [35, 290, 15], [55, 340, 12]],
    green: { x: 62, z: 372, rx: 14, rz: 15, rot: -0.5, lift: 0.6, sx: -0.012, sz: -0.01, ph: 0.9 },
    bunkers: [{ x: -14, z: 225, rx: 7, rz: 5, rot: 0.1, ph: 1 }, { x: 44, z: 373, rx: 5, rz: 3.5, rot: 1, ph: 2 }, { x: 81, z: 365, rx: 5, rz: 3.5, rot: -0.5, ph: 3 }],
    plateaus: [{ x: 58, z: 185, rx: 22, rz: 28, rot: 0, h: 10, ph: 3 }],
  },
  {
    n: 16, name: 'Le Belvédère', theme: 'montagne', par: 5, seed: 1616, tee: T0, pin: { x: 12, z: 492 }, tilt: [0, -0.01],
    line: [[0, 40, 14], [-3, 140, 18], [-8, 240, 18], [-4, 340, 17], [6, 420, 14], [10, 460, 12]],
    green: { x: 10, z: 490, rx: 15, rz: 16, rot: 0.2, lift: 0.8, sx: 0.01, sz: -0.012, ph: 1.8 },
    bunkers: [{ x: 18, z: 250, rx: 7, rz: 5, rot: 0.2, ph: 1 }, { x: -15, z: 430, rx: 6, rz: 4, rot: -0.2, ph: 2 }, { x: -7, z: 500, rx: 5, rz: 3.5, rot: 0.8, ph: 3 }, { x: 29, z: 488, rx: 5, rz: 3.5, rot: -0.6, ph: 4 }],
    plateaus: [{ x: 0, z: 0, rx: 22, rz: 24, rot: 0, h: 12, ph: 0.5 }],
    ravines: [{ pts: [[-400, 300], [0, 296], [400, 310]], w: 20, depth: 8 }],
  },
  {
    n: 17, name: 'Le Lac Alpin', theme: 'montagne', par: 4, seed: 1717, tee: T0, pin: { x: 1, z: 320 },
    line: [[0, 35, 14], [-2, 120, 16], [-6, 210, 17], [-2, 270, 13], [2, 292, 11]],
    green: { x: 3, z: 318, rx: 14, rz: 15, rot: 0, lift: 0.6, sx: -0.012, sz: 0.01, ph: 2.3 },
    bunkers: [{ x: -21, z: 230, rx: 7, rz: 5, rot: 0.2, ph: 1 }, { x: -17, z: 325, rx: 5, rz: 3.5, rot: 0.8, ph: 2 }],
    water: [{ x: 32, z: 288, rx: 20, rz: 30, rot: 0.2, ph: 0.6, depth: 2.8 }],
    plateaus: [{ x: -62, z: 120, rx: 20, rz: 30, rot: 0.1, h: 10, ph: 2.5 }],
  },
  {
    n: 18, name: 'Le Sommet', theme: 'montagne', par: 4, seed: 1818, tee: T0, pin: { x: 0, z: 403 }, tilt: [0, 0.02],
    line: [[0, 35, 15], [4, 130, 18], [0, 230, 18], [-6, 300, 15], [-6, 318, 0], [-4, 362, 0], [-3, 378, 11]],
    green: { x: -2, z: 400, rx: 15, rz: 16, rot: 0.1, lift: 0.8, sx: 0.012, sz: -0.012, ph: 0.4 },
    bunkers: [{ x: 21, z: 220, rx: 7, rz: 5, rot: -0.1, ph: 1 }, { x: -23, z: 395, rx: 5, rz: 3.5, rot: 0.8, ph: 2 }, { x: 17, z: 410, rx: 5, rz: 3.5, rot: -0.7, ph: 3 }],
    ravines: [{ pts: [[-400, 333], [0, 338], [400, 326]], w: 16, depth: 7 }],
  },
];

// Parcours proposés : 6 trous par décor, l'aller, le retour ou les 18
export const COURSES = {
  campagne: { label: 'Campagne · 6 trous', holes: [1, 2, 3, 4, 5, 6] },
  mer: { label: 'Bord de mer · 6 trous', holes: [7, 8, 9, 10, 11, 12] },
  montagne: { label: 'Montagne · 6 trous', holes: [13, 14, 15, 16, 17, 18] },
  aller: { label: 'Aller · 9 trous', holes: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  retour: { label: 'Retour · 9 trous', holes: [10, 11, 12, 13, 14, 15, 16, 17, 18] },
  complet: { label: 'Grand tour · 18 trous', holes: Array.from({ length: 18 }, (_, i) => i + 1) },
};

// ------------------------------------------------------------------ formes
// distance normalisée à une ellipse au bord ondulé (< 1 dedans), stable et lisse
function ellD(e, x, z) {
  const dx = x - e.x, dz = z - e.z, c = Math.cos(e.rot || 0), s = Math.sin(e.rot || 0);
  const u = (dx * c - dz * s) / e.rx, v = (dx * s + dz * c) / e.rz;
  const r = Math.hypot(u, v);
  if (r < 1e-6) return 0;
  const a = Math.atan2(v, u), ph = e.ph || 0;
  const wob = 1 + 0.09 * Math.sin(3 * a + ph) + 0.05 * Math.sin(5 * a + 2 * ph);
  return r / wob;
}

// distance à une polyligne + marge du fairway (positive dedans) en interpolant la demi-largeur
function lineInfo(pts, x, z) {
  let best = Infinity, margin = -Infinity, acc = 0, bestAlong = 0, side = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, aw] = pts[i], [bx, bz, bw] = pts[i + 1];
    const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez, L = Math.sqrt(L2);
    let t = ((x - ax) * ex + (z - az) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
    const sd = (x - px) * ez - (z - pz) * ex > 0 ? 1 : -1;
    if (d < best) { best = d; bestAlong = acc + t * L; side = sd; }
    if (aw > 0 && bw > 0) {
      // bord du fairway légèrement ondulé, différent à gauche et à droite
      const w = lerp(aw, bw, t) * (1 + 0.07 * Math.sin(pz * 0.045 + sd * 1.9) + 0.045 * Math.sin(pz * 0.13 + sd));
      margin = Math.max(margin, w - d);
    }
    acc += L;
  }
  return { dist: best, margin, along: bestAlong, side };
}

// prolonge une polyligne aux deux bouts (trait de côte, ravin) pour qu'elle traverse tout le paysage
function extend(pts, far = 3000) {
  const out = pts.map((p) => [p[0], p[1], 0]);
  const ext = (a, b) => { const dx = a[0] - b[0], dz = a[1] - b[1], L = Math.hypot(dx, dz) || 1; return [a[0] + dx / L * far, a[1] + dz / L * far, 0]; };
  return [ext(out[0], out[1]), ...out, ext(out[out.length - 1], out[out.length - 2])];
}

// ------------------------------------------------------------------ construction
export function buildHole(def) {
  const theme = THEMES[def.theme] || THEMES.campagne;
  const tee = def.tee, pin = def.pin, G = def.green;
  const valley = def.valley ?? theme.valley, bankH = def.bankH ?? theme.bankH, bankR = def.bankR ?? theme.bankR;
  // ligne de jeu complète (pour le relief) : départ → points du fairway → green
  const center = [[tee.x, tee.z, 0], ...def.line, [G.x, G.z, 0]];
  const fair = def.line;
  const teeDir = Math.atan2(fair[0][0] - tee.x, fair[0][1] - tee.z);
  const hills = def.hills || [], bunkers = def.bunkers || [], waters = def.water || [], plateaus = def.plateaus || [];
  const tilt = def.tilt || [0, 0];
  // limites du terrain jouable : la ligne de jeu et ses obstacles, avec de la marge
  const B = def.bounds || (() => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of center) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { x0: Math.round(x0 - 95), x1: Math.round(x1 + 95), z0: Math.round(z0 - 45), z1: Math.round(z1 + 60) };
  })();
  // mer : trait de côte prolongé, signe du côté de la mer
  const coast = def.coast ? { ...def.coast, line: extend(def.coast.pts) } : null;
  if (coast) coast.seaSide = lineInfo(coast.line, coast.sea[0], coast.sea[1]).side;
  const ravines = (def.ravines || []).map((r) => ({ ...r, line: extend(r.pts) }));

  // relief naturel : ondulations douces + collines + rives de la vallée + pente générale + plateaux
  function base(x, z) {
    let h = 0.9 * Math.sin(x * 0.023 + 1.3) * Math.sin(z * 0.019 + 0.4)
      + 0.5 * Math.sin(x * 0.051 - z * 0.037) + 0.35 * Math.sin(z * 0.071 + x * 0.013);
    for (const k of hills) { const d2 = ((x - k.x) ** 2 + (z - k.z) ** 2) / (k.r * k.r); if (d2 < 9) h += k.h * Math.exp(-d2); }
    const s = lineInfo(center, x, z).dist - valley;
    if (s > 0) h += bankH * (1 - Math.exp(-(s * s) / (bankR * bankR)));
    // au loin, de grandes collines qui ferment l'horizon
    const far = Math.max(0, Math.hypot(x - (B.x0 + B.x1) / 2, (z - (B.z0 + B.z1) / 2) * 0.7) - 260);
    if (far > 0) h += far * (def.theme === 'montagne' ? 0.14 : 0.06) * (1.4 + Math.sin(x * 0.006 + 1) * Math.cos(z * 0.005));
    h += tilt[0] * (x - tee.x) + tilt[1] * (z - tee.z);
    // plateaux aux bords à pic (falaises)
    for (const p of plateaus) { const d = ellD(p, x, z); if (d < 1.05) h += p.h * (1 - smooth(0.86, 1.0, d)); }
    return h;
  }
  const greenH = base(G.x, G.z) + (G.lift || 0);
  const teeH = base(tee.x, tee.z) + 0.45;
  // niveau de l'eau un peu sous la berge : on voit la paroi de pierre, comme une rive aménagée
  const waterLv = waters.map((w) => base(w.x, w.z) - 0.8);

  // distance (m) hors de l'aire de départ (rectangle 8 × 10 m orienté vers le fairway), 0 dedans
  function teeOut(x, z) {
    const c = Math.cos(teeDir), s = Math.sin(teeDir), dx = x - tee.x, dz = z - tee.z;
    const u = dx * c - dz * s, v = dx * s + dz * c; // u : en travers, v : dans l'axe
    return Math.hypot(Math.max(0, Math.abs(u) - 4), Math.max(0, Math.abs(v - 1) - 5));
  }

  // champs utiles au relief, aux surfaces et à la texture du sol
  function fields(x, z) {
    const li = lineInfo(fair, x, z);
    let bd = Infinity, bi = -1;
    for (let i = 0; i < bunkers.length; i++) { const d = ellD(bunkers[i], x, z); if (d < bd) { bd = d; bi = i; } }
    let wd = Infinity, wi = -1;
    for (let i = 0; i < waters.length; i++) { const d = ellD(waters[i], x, z); if (d < wd) { wd = d; wi = i; } }
    // côte : distance signée (positive côté terre)
    let sd = Infinity;
    if (coast) { const c = lineInfo(coast.line, x, z); sd = c.side === coast.seaSide ? -c.dist : c.dist; }
    let rv = Infinity, ri = -1;
    for (let i = 0; i < ravines.length; i++) { const d = lineInfo(ravines[i].line, x, z).dist; if (d < rv) { rv = d; ri = i; } }
    return { fm: li.margin, along: li.along, gd: ellD(G, x, z), bd, bi, wd, wi, td: teeOut(x, z), sd, rv, ri };
  }

  function heightF(x, z, f) {
    let h = base(x, z);
    // green : un plan légèrement penché (la pente fait tourner les putts) avec de petites ondulations
    const wg = 1 - smooth(1.0, 1.75, f.gd);
    if (wg > 0) {
      const gx = x - G.x, gz = z - G.z;
      const gh = greenH + G.sx * gx + G.sz * gz + 0.05 * Math.sin(gx * 0.24 + G.ph) * Math.sin(gz * 0.21 + 1);
      h = lerp(h, gh, wg);
    }
    // aire de départ : plateau plat et surélevé
    const wt = 1 - smooth(0, 3.5, f.td);
    if (wt > 0) h = lerp(h, teeH, wt);
    // bunkers : cuvette de sable avec une petite lèvre
    // (le green garde sa surface : la cuvette ne commence qu'au-delà de l'avant-green)
    if (f.bd < 1.4) {
      const keep = smooth(1.0, 1.15, f.gd);
      h -= (bunkers[f.bi].depth || 0.75) * (1 - smooth(0.45, 1.0, f.bd)) * keep;
      h += 0.22 * Math.exp(-(((f.bd - 1.07) / 0.1) ** 2)) * keep;
    }
    // étangs : rive franche puis fond qui se creuse sous le niveau de l'eau
    if (f.wd < 1.5) h -= (waters[f.wi].depth || 2) * (1 - smooth(0.9, 1.03, f.wd));
    // ravin : parois à pic, torrent au fond
    if (f.rv < 40) { const R = ravines[f.ri]; h -= R.depth * (1 - smooth(R.w * 0.3, R.w * 0.5, f.rv)); }
    // mer : plage en pente douce, puis fond qui plonge
    if (coast && f.sd < coast.beach + 18) {
      const sd = f.sd, L = coast.level;
      const target = sd > 0 ? L + 0.2 + sd * 0.08 : L + 0.2 - Math.min(14, -sd * 0.2);
      h = lerp(target, h, smooth(coast.beach * 0.7, coast.beach + 18, sd));
    }
    return h;
  }
  const heightAt = (x, z) => heightF(x, z, fields(x, z));

  function surfaceF(x, z, f, h) {
    // l'eau (étang, mer, torrent) est un obstacle d'eau même au-delà des limites : on repart de la rive
    if (f.wd < 1.5 && h < waterLv[f.wi]) return 'water';
    if (coast && h < coast.level) return 'water';
    if (f.ri >= 0 && f.rv < ravines[f.ri].w * 0.33) return 'water';
    if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return 'ob';
    if (f.td === 0) return 'tee';
    if (f.gd < 1) return 'green';
    if (f.bd < 0.93) return 'bunker';
    if (coast && f.sd < coast.beach && h < coast.level + 2.2) return 'beach';
    if (f.gd < 1.13) return 'fringe';
    if (f.fm > 0) return 'fairway';
    return 'rough';
  }
  const surfaceAt = (x, z) => { const f = fields(x, z); return surfaceF(x, z, f, heightF(x, z, f)); };

  // normale du terrain (différences finies) et pente (dh/dx, dh/dz)
  function slopeAt(x, z, e = 0.08) {
    return [(heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e)];
  }

  // ---------------------------------------------------------------- arbres (partagés physique / rendu)
  const rng = makeRng(def.seed * 7919 + 13);
  const trees = [];
  const okTree = (x, z) => {
    if (x < B.x0 - 120 || x > B.x1 + 120 || z < B.z0 - 120 || z > B.z1 + 120) return false;
    const f = fields(x, z);
    if (f.fm > -9 || f.gd < 2.3 || f.bd < 1.9 || f.wd < 1.35 || f.td < 12) return false;
    if (coast && f.sd < coast.beach + 3) return false;
    if (f.ri >= 0 && f.rv < ravines[f.ri].w * 0.75) return false;
    if (plateaus.some((p) => { const d = ellD(p, x, z); return d > 0.8 && d < 1.12; })) return false;
    if (Math.hypot(x - pin.x, z - pin.z) < 30) return false;
    for (const t of trees) if ((t.x - x) ** 2 + (t.z - z) ** 2 < (t.r + 2.2) ** 2) return false;
    return true;
  };
  const addTree = (x, z, big) => {
    if (!okTree(x, z)) return;
    const kind = rng.weighted(theme.trees);
    const s = rng.range(0.85, 1.25) * (big ? 1.15 : 1);
    // feuillage vu comme un ellipsoïde : r (rayon horizontal), ry (demi-hauteur), centré à h au-dessus du sol
    const D = { pine: [2.7, 5.2, 6.6], oak: [3.9, 2.9, 5.6], round: [3.3, 2.9, 5.6], palm: [3.2, 1.6, 7.6] }[kind];
    trees.push({ x, z, y: heightAt(x, z), kind, s, r: D[0] * s, ry: D[1] * s, h: D[2] * s, rot: rng.range(0, 6.283), v: rng.int(0, 7) });
  };
  // lisières le long du fairway, puis bosquets plus loin sur les rives
  for (let i = 0; i < center.length - 1; i++) {
    const [ax, az] = center[i], [bx, bz] = center[i + 1], L = Math.hypot(bx - ax, bz - az);
    const nx = (bz - az) / L, nz = -(bx - ax) / L;
    for (let d = 0; d < L; d += 6) {
      const px = ax + (bx - ax) * d / L, pz = az + (bz - az) * d / L;
      for (const side of [-1, 1]) {
        if (rng.chance(0.55)) { const o = rng.range(valley - 4, valley + 12); addTree(px + nx * o * side, pz + nz * o * side, false); }
        if (rng.chance(0.75)) { const o = rng.range(valley + 14, valley + 60); addTree(px + nx * o * side, pz + nz * o * side, true); }
        if (rng.chance(0.5)) { const o = rng.range(valley + 60, valley + 115); addTree(px + nx * o * side, pz + nz * o * side, true); }
      }
    }
  }
  // derrière le green et le départ
  for (let k = 0; k < 40; k++) { const a = rng.range(0, 6.283), o = rng.range(34, 90); addTree(G.x + Math.sin(a) * o, G.z + Math.cos(a) * o, true); }
  for (let k = 0; k < 30; k++) { const a = rng.range(0, 6.283), o = rng.range(25, 70); addTree(tee.x + Math.sin(a) * o, tee.z - Math.abs(Math.cos(a)) * o, true); }

  // grille de recherche des arbres (cases de 16 m) pour les collisions
  const CELL = 16, grid = new Map();
  for (const t of trees) {
    const k = Math.floor(t.x / CELL) + ',' + Math.floor(t.z / CELL);
    if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t);
  }
  function treesNear(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), out = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = grid.get((cx + i) + ',' + (cz + j)); if (a) out.push(...a); }
    return out;
  }

  // longueur officielle du trou : le long de la ligne de jeu
  const length = Math.round(lineInfo(center, pin.x, pin.z).along);

  return {
    def, n: def.n, name: def.name, par: def.par, theme: def.theme, tee, pin, green: G, bunkers, waters, waterLv, bounds: B, length,
    fields, heightAt, heightF, surfaceAt, surfaceF, slopeAt, trees, treesNear, teeDir, center, fair,
    centerDist: (x, z) => lineInfo(center, x, z).dist, valley, coast, ravines, plateaus,
  };
}

// Vent d'un trou : direction et force tirées de la graine de la partie (identiques chez tous les joueurs).
// strength : 0 (calme), 1 (normal), 1.5 (fort)
export function windFor(hole, seed, strength = 1) {
  const r = makeRng((seed >>> 0) * 31 + hole.n * 977);
  const max = (hole.def.wind?.max ?? THEMES[hole.theme]?.wind ?? 6) * strength;
  const speed = Math.round(r.range(0, max) * 2) / 2;
  const dir = r.range(0, Math.PI * 2); // direction vers laquelle souffle le vent (0 = vers le green, +z)
  return { speed, dir, x: Math.sin(dir) * speed, z: Math.cos(dir) * speed };
}
