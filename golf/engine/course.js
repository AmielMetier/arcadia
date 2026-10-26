// Birdie Party — les 30 trous et leur terrain. Moteur pur (aucun DOM) : le même code donne le relief et les surfaces
// à la physique (hôte et invités) et au rendu. Repère : x vers la gauche quand on regarde le green depuis le départ,
// y vers le haut, z du départ vers le green.
//
// Un trou est décrit par quelques formes : une ligne de jeu (départ → fairway → green) avec la largeur du fairway
// (0 : pas de fairway, il faut passer par-dessus), un second fairway éventuel (alt), le green (ellipse penchée), les
// bunkers, les étangs, des collines, et selon le décor : l'eau (mer ou lac : trait de côte, rive lointaine, îles et
// chaussées posées dessus), des plateaux à falaises, des ravins (torrent, ruisseau ou canyon sec), une pente générale.
// buildHole() en tire des fonctions continues : heightAt(x, z) pour le relief, surfaceAt(x, z) pour la nature du sol,
// et la liste des arbres.
import { makeRng } from './rng.js';

const FAIR = 1.35;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// réglages par décor : forme de la vallée, vent, essences d'arbres
export const THEMES = {
  campagne: { label: 'Campagne', valley: 30, bankH: 15, bankR: 60, wind: 5, trees: [['round', 5], ['oak', 3], ['pine', 2]] },
  mer: { label: 'Bord de mer', valley: 32, bankH: 11, bankR: 60, wind: 7, trees: [['palm', 6], ['round', 2], ['oak', 1]] },
  montagne: { label: 'Montagne', valley: 28, bankH: 26, bankR: 48, wind: 6, trees: [['pine', 8], ['round', 1]] },
  // désert : hors du fairway et de sa première coupe, du sable tassé (« sable dur ») semé de cactus
  desert: { label: 'Désert', valley: 34, bankH: 10, bankR: 70, wind: 6, trees: [['cactus', 9], ['palm', 1]], hardpan: true },
};

// ------------------------------------------------------------------ les trous
// Pour chaque trou : par, départ, drapeau, ligne de jeu [x, z, demi-largeur du fairway (0 : pas de fairway)], green,
// bunkers, étangs (water), collines (hills) ; options : coast (mer), plateaus, ravines, tilt (pente [dh/dx, dh/dz]).
const T0 = { x: 0, z: 0 };
export const HOLES = [
  // --------------------------------------------------------------- campagne
  {
    // un étang à franchir dès le départ, puis un long fairway qui file légèrement à droite
    n: 1, name: 'Les Prés Fleuris', theme: 'campagne', par: 4, seed: 101, tee: T0, pin: { x: -19, z: 352 },
    line: [[1, 64, 0, 26], [3, 112, 15, 30], [1, 180, 17], [-7, 250, 16, 34], [-14, 305, 13]],
    green: { x: -18, z: 350, rx: 14, rz: 16, rot: 0.2, lift: 0.7, sx: 0.012, sz: -0.01, ph: 1.7 },
    bunkers: [{ x: -26, z: 205, rx: 8, rz: 5, rot: 0.3, ph: 0.4 }, { x: 20, z: 262, rx: 7, rz: 5, rot: -0.4, ph: 2.1 }, { x: -2, z: 364, rx: 6, rz: 3.5, rot: 0.1, ph: 3.3 }, { x: -34, z: 344, rx: 5, rz: 4, rot: 1.2, ph: 5.2 }],
    water: [{ x: 2, z: 58, rx: 20, rz: 24, rot: 0.2, ph: 0.9, depth: 2.4 }],
    hills: [{ x: 70, z: 160, r: 50, h: 7 }, { x: -70, z: 300, r: 45, h: 6 }],
  },
  {
    // green sur une île au milieu du lac
    n: 2, name: "L'Île du Lac", theme: 'campagne', par: 3, seed: 202, tee: T0, pin: { x: 1, z: 123 }, relief: 0.3,
    line: [[0, 25, 0], [0, 104, 0]],
    green: { x: 0, z: 121, rx: 12, rz: 11, rot: 0.3, lift: 0.25, sx: -0.012, sz: 0.008, ph: 0.6 },
    bunkers: [{ x: -15, z: 127, rx: 4.5, rz: 3, rot: 0.9, ph: 1 }],
    coast: { level: -1.0, beach: 2.5, sea: [40, 70], ring: { x: 0, z: 80, rx: 95, rz: 112 },
      land: [{ pts: [[0, -70, 17], [0, 24, 12]] }, { x: 0, z: 122, rx: 22, rz: 20, ph: 0.8 }] },
    hills: [{ x: -110, z: 120, r: 50, h: 8 }, { x: 120, z: 60, r: 45, h: 7 }],
  },
  {
    // grand S : à gauche le long d'une étendue de sable, puis à droite, puis le green gardé par une mare
    n: 3, name: 'La Grande Allée', theme: 'campagne', par: 5, seed: 303, tee: T0, pin: { x: -4, z: 490 },
    line: [[0, 35, 14], [16, 100, 17], [32, 165, 18, 58], [24, 230, 17], [-6, 290, 16], [-32, 350, 15], [-32, 410, 14], [-16, 455, 12]],
    green: { x: -4, z: 488, rx: 15, rz: 17, rot: -0.4, lift: 0.8, sx: -0.01, sz: 0.011, ph: 2.4 },
    bunkers: [
      { x: 66, z: 168, rx: 16, rz: 36, rot: 0.15, ph: 1, depth: 0.6 }, { x: -50, z: 300, rx: 7, rz: 5, rot: 0.3, ph: 2 },
      { x: 10, z: 500, rx: 6, rz: 4, rot: 0.8, ph: 3 }, { x: -18, z: 503, rx: 6, rz: 3.5, rot: -0.3, ph: 4 },
    ],
    water: [{ x: -34, z: 472, rx: 12, rz: 16, rot: 0.3, ph: 0.4, depth: 2.2 }],
    hills: [{ x: 90, z: 300, r: 50, h: 7 }, { x: -80, z: 140, r: 45, h: 6 }],
  },
  {
    // un croissant de terre autour de l'eau : le green est au bout, de l'autre côté
    n: 4, name: 'Le Croissant', theme: 'campagne', par: 3, seed: 404, tee: T0, pin: { x: 15, z: 160 }, relief: 0.5, wobble: 8,
    line: [[-26, 45, 0, 20], [-40, 96, 0, 22], [-28, 140, 8, 22]], greenLand: 24,
    green: { x: 14, z: 158, rx: 13, rz: 12, rot: 0.8, lift: 0.6, sx: 0.012, sz: -0.01, ph: 0.8 },
    bunkers: [{ x: 30, z: 168, rx: 5, rz: 3.5, rot: 0.4, ph: 2 }, { x: -4, z: 170, rx: 6, rz: 3.5, rot: 1.2, ph: 3 }],
    coast: { hug: true, level: -1.0, beach: 3, sea: [10, 90], ring: { x: -10, z: 80, rx: 150, rz: 170 } },
    hills: [{ x: 150, z: 60, r: 50, h: 8 }],
  },
  {
    // tout droit, puis le fairway s'enroule vers la droite : le green est derrière le ruisseau
    n: 5, name: 'Le Crochet', theme: 'campagne', par: 4, seed: 505, tee: T0, pin: { x: -56, z: 284 },
    line: [[0, 35, 14], [2, 110, 16], [4, 190, 17], [-4, 250, 15], [-22, 282, 0, 26]], greenLand: 26,
    green: { x: -55, z: 282, rx: 13, rz: 15, rot: 1.3, lift: 0.6, sx: 0.013, sz: 0.008, ph: 3.1 },
    bunkers: [{ x: 22, z: 210, rx: 7, rz: 5, rot: 0.4, ph: 1 }, { x: -18, z: 160, rx: 6, rz: 4.5, rot: -0.4, ph: 2 }, { x: -60, z: 300, rx: 5, rz: 3.5, rot: 0.2, ph: 3 }],
    ravines: [{ pts: [[-34, -300], [-38, 200], [-34, 260], [-40, 600]], w: 12, depth: 2 }],
    hills: [{ x: 70, z: 160, r: 40, h: 6 }],
  },
  {
    // en J : à droite, puis on remonte vers un green gardé par un étang
    n: 6, name: 'Le Moulin', theme: 'campagne', par: 5, seed: 606, tee: T0, pin: { x: 22, z: 438 },
    line: [[0, 35, 14], [-22, 105, 17], [-48, 175, 18], [-56, 255, 17], [-40, 330, 16, 40], [-10, 384, 13]],
    green: { x: 21, z: 436, rx: 14, rz: 15, rot: 0.6, lift: 0.5, sx: -0.01, sz: 0.012, ph: 1.9 },
    bunkers: [{ x: -80, z: 190, rx: 8, rz: 5, rot: 0.2, ph: 1 }, { x: 8, z: 450, rx: 5.5, rz: 3.5, rot: 0.5, ph: 2 }, { x: 36, z: 446, rx: 6, rz: 3, rot: 0.8, ph: 3 }],
    water: [{ x: 30, z: 398, rx: 15, rz: 18, rot: 0.6, ph: 2, depth: 2.2 }],
    hills: [{ x: 60, z: 150, r: 40, h: 6 }, { x: -80, z: 380, r: 45, h: 7 }],
  },
  {
    // le fairway se resserre entre deux étangs, là où tombent les drives
    n: 7, name: 'Les Deux Étangs', theme: 'campagne', par: 4, seed: 717, tee: T0, pin: { x: 12, z: 372 },
    line: [[0, 35, 13], [-3, 110, 15], [-4, 180, 12, 36], [-2, 240, 14], [6, 300, 14], [10, 338, 12]],
    green: { x: 12, z: 370, rx: 14, rz: 15, rot: -0.2, lift: 1.0, sx: -0.012, sz: 0.01, ph: 0.7 },
    bunkers: [{ x: -26, z: 290, rx: 8, rz: 5, rot: 0.3, ph: 1 }, { x: -4, z: 380, rx: 6, rz: 3.5, rot: 0.6, ph: 2 }, { x: 28, z: 376, rx: 5, rz: 4, rot: -0.7, ph: 3 }],
    water: [{ x: 32, z: 205, rx: 17, rz: 26, rot: 0.2, ph: 0.4, depth: 2.4 }, { x: -38, z: 214, rx: 16, rz: 24, rot: -0.2, ph: 1.9, depth: 2.4 }],
    hills: [{ x: 80, z: 120, r: 45, h: 6 }, { x: -80, z: 320, r: 45, h: 7 }],
  },
  {
    // deux chemins de part et d'autre d'un long bosquet, qui se rejoignent avant le green
    n: 8, name: 'Le Vallon', theme: 'campagne', par: 5, seed: 818, tee: T0, pin: { x: 12, z: 476 },
    line: [[0, 35, 14], [-14, 110, 15], [-30, 190, 15], [-28, 270, 15], [-10, 340, 14], [4, 400, 13], [10, 442, 12]],
    alt: [[[6, 95, 7], [28, 150, 11], [34, 230, 11], [24, 300, 10], [2, 350, 7]]],
    groves: [{ x: 2, z: 222, rx: 9, rz: 70, n: 40, kind: 'oak' }],
    green: { x: 12, z: 474, rx: 15, rz: 16, rot: 0.2, lift: 0.6, sx: 0.012, sz: -0.01, ph: 2.9 },
    bunkers: [{ x: -54, z: 200, rx: 8, rz: 5, rot: 0.2, ph: 1 }, { x: -4, z: 482, rx: 6, rz: 3.5, rot: 0.6, ph: 2 }, { x: 28, z: 488, rx: 5, rz: 4, rot: -0.6, ph: 3 }],
    water: [{ x: 38, z: 450, rx: 14, rz: 18, rot: 0.4, ph: 2.2, depth: 2.2 }],
    hills: [{ x: -90, z: 300, r: 50, h: 7 }],
  },
  // --------------------------------------------------------------- bord de mer
  {
    // d'île en île jusqu'au green, avec un îlot de palmiers au milieu du lagon
    n: 9, name: 'Les Îles', theme: 'mer', par: 5, seed: 707, tee: T0, pin: { x: 10, z: 424 }, relief: 0.3, bankH: 6,
    line: [[0, 30, 0], [4, 128, 12], [8, 176, 14], [-8, 232, 0], [-28, 262, 14], [-24, 304, 12], [0, 362, 0]],
    green: { x: 10, z: 422, rx: 13, rz: 12, rot: 0.3, lift: 0.25, sx: 0.012, sz: -0.01, ph: 1.6 },
    bunkers: [{ x: 26, z: 160, rx: 6, rz: 4, rot: -0.2, ph: 1 }, { x: -46, z: 290, rx: 6, rz: 4, rot: 0.6, ph: 2 }, { x: 24, z: 432, rx: 5, rz: 3.5, rot: 0.8, ph: 3 }],
    groves: [{ x: 24, z: 150, rx: 8, rz: 22, n: 6, kind: 'palm' }, { x: -8, z: 160, rx: 6, rz: 18, n: 3, kind: 'palm' }, { x: -44, z: 280, rx: 8, rz: 20, n: 5, kind: 'palm' }, { x: 26, z: 410, rx: 5, rz: 8, n: 2, kind: 'palm' }, { x: 48, z: 226, rx: 7, rz: 5, n: 3, kind: 'palm' }],
    coast: { level: -1.4, beach: 3, sea: [60, 220], ring: { x: 0, z: 210, rx: 170, rz: 300 },
      // le départ sur une pointe de la rive (et pas sur un chemin dans l'eau) : la terre s'avance de chaque côté
      land: [{ pts: [[0, -170, 100], [0, -70, 64], [0, -20, 24], [0, 22, 15]] }, { x: -62, z: -52, rx: 58, rz: 44, rot: 0.35, ph: 0.9 }, { x: 64, z: -48, rx: 60, rz: 40, rot: -0.4, ph: 1.9 }, { x: 6, z: 152, rx: 32, rz: 46, rot: 0.1, ph: 0.6 }, { x: -26, z: 282, rx: 34, rz: 40, rot: -0.2, ph: 1.4 }, { x: 10, z: 420, rx: 28, rz: 26, rot: 0.3, ph: 2.1 }, { x: 48, z: 226, rx: 15, rz: 12, rot: 0.4, ph: 2.6 }] },
  },
  {
    // par-dessus une anse, vers un green posé sur le cap
    n: 10, name: 'Le Cap', theme: 'mer', par: 3, seed: 1808, tee: T0, pin: { x: -6, z: 168 },
    line: [[0, 30, 0], [-6, 140, 9], [-7, 152, 10]],
    green: { x: -8, z: 166, rx: 13, rz: 12, rot: 0.3, lift: 0.7, sx: 0.012, sz: -0.012, ph: 2.2 },
    bunkers: [{ x: 10, z: 170, rx: 5, rz: 3.5, rot: -0.6, ph: 1 }, { x: -25, z: 160, rx: 5, rz: 3.5, rot: 0.8, ph: 2 }],
    hills: [{ x: 60, z: 90, r: 45, h: 9 }],
    coast: { pts: [[-400, 40], [-70, 42], [-18, 54], [8, 70], [14, 86], [0, 104], [-30, 120], [-80, 128], [-400, 130]], sea: [-80, 85], level: -1.4, beach: 7 },
  },
  {
    // en C autour d'une baie : couper par-dessus l'eau rapproche, mais il faut porter loin
    n: 11, name: 'La Baie', theme: 'mer', par: 5, seed: 909, tee: T0, pin: { x: 72, z: 398 }, relief: 0.5, wobble: 10, bankH: 6,
    line: [[-28, 55, 14], [-66, 128, 17], [-82, 218, 18], [-64, 304, 17], [-22, 364, 15], [30, 392, 13]],
    green: { x: 70, z: 396, rx: 14, rz: 15, rot: -1.3, lift: 0.7, sx: -0.01, sz: 0.01, ph: 0.5 },
    bunkers: [{ x: -112, z: 220, rx: 7, rz: 5, rot: 0.1, ph: 1 }, { x: -30, z: 386, rx: 6, rz: 4, rot: 0.5, ph: 2 }, { x: 82, z: 380, rx: 5, rz: 3.5, rot: 1, ph: 3 }],
    groves: [{ x: -100, z: 300, rx: 10, rz: 30, n: 5, kind: 'palm' }],
    coast: { hug: true, level: -1.4, beach: 7, sea: [0, 220], ring: { x: -10, z: 210, rx: 240, rz: 310 } },
  },
  {
    // le green est sur un îlot, de l'autre côté d'un chenal
    n: 12, name: "L'Îlot", theme: 'mer', par: 4, seed: 1010, tee: T0, pin: { x: -8, z: 330 }, relief: 0.5, wobble: 8, bankH: 6,
    line: [[0, 35, 14], [6, 120, 17], [-4, 200, 16], [-10, 252, 13], [-10, 276, 0]], greenLand: 22,
    gaps: [[268, 302]],
    green: { x: -8, z: 328, rx: 13, rz: 12, rot: 0.2, lift: 0.6, sx: 0.012, sz: -0.01, ph: 1.6 },
    bunkers: [{ x: -26, z: 180, rx: 7, rz: 5, rot: -0.2, ph: 1 }, { x: 6, z: 340, rx: 5, rz: 3.5, rot: 0.8, ph: 2 }],
    groves: [{ x: 28, z: 160, rx: 6, rz: 20, n: 3, kind: 'palm' }],
    coast: { hug: true, level: -1.4, beach: 6, sea: [80, 200], ring: { x: 0, z: 170, rx: 200, rz: 270 } },
  },
  {
    // départ sur un îlot, green sur la grande île d'en face
    n: 13, name: 'Le Rocher', theme: 'mer', par: 3, seed: 1111, tee: T0, pin: { x: -6, z: 158 }, relief: 0.3, bankH: 6,
    line: [[0, 22, 0], [-2, 110, 0]],
    green: { x: -5, z: 156, rx: 13, rz: 12, rot: 0.4, lift: 0.25, sx: -0.012, sz: -0.012, ph: 2.9 },
    bunkers: [{ x: 10, z: 150, rx: 4.5, rz: 3.5, rot: 1, ph: 1 }, { x: -6, z: 136, rx: 7, rz: 3, rot: 0.1, ph: 2 }],
    groves: [{ x: 10, z: -4, rx: 5, rz: 5, n: 2, kind: 'palm' }, { x: -30, z: 170, rx: 14, rz: 24, n: 8, kind: 'palm' }, { x: 24, z: 172, rx: 12, rz: 20, n: 6, kind: 'palm' }],
    coast: { level: -1.4, beach: 4, sea: [60, 70], ring: { x: 0, z: 90, rx: 190, rz: 200 },
      land: [{ x: 0, z: 2, rx: 17, rz: 17, ph: 0.6 }, { x: -4, z: 168, rx: 48, rz: 42, rot: 0.3, ph: 1.4 }] },
  },
  {
    // un estuaire coupe le fairway en biais : le porter au départ, ou rester court
    n: 14, name: "L'Estuaire", theme: 'mer', par: 4, seed: 1212, tee: T0, pin: { x: 26, z: 372 },
    line: [[0, 35, 15], [4, 120, 17], [8, 168, 15], [12, 196, 0], [16, 236, 0], [20, 262, 15], [24, 320, 13], [26, 345, 12]],
    green: { x: 26, z: 370, rx: 15, rz: 16, rot: 0.1, lift: 0.8, sx: 0.01, sz: -0.012, ph: 0.2 },
    bunkers: [{ x: -16, z: 140, rx: 7, rz: 5, rot: 0.2, ph: 1 }, { x: 44, z: 300, rx: 7, rz: 5, rot: -0.3, ph: 2 }, { x: 10, z: 380, rx: 5, rz: 3.5, rot: 0.8, ph: 3 }],
    ravines: [{ pts: [[-300, 60], [-40, 186], [60, 236], [300, 420]], w: 30, depth: 2.6 }],
    hills: [{ x: 90, z: 200, r: 60, h: 9 }],
  },
  {
    // virage à droite autour d'une lagune bordée de palmiers ; la mer longe tout le trou à gauche
    n: 15, name: 'La Lagune', theme: 'mer', par: 4, seed: 1525, tee: T0, pin: { x: -109, z: 272 },
    line: [[0, 35, 14], [2, 115, 17], [-10, 190, 17], [-40, 240, 15], [-80, 262, 13]],
    green: { x: -108, z: 270, rx: 14, rz: 15, rot: 1.2, lift: 0.6, sx: 0.012, sz: -0.01, ph: 1.4 },
    bunkers: [{ x: 26, z: 200, rx: 8, rz: 5, rot: -0.3, ph: 1 }, { x: -120, z: 286, rx: 5, rz: 3.5, rot: 0.5, ph: 2 }, { x: -94, z: 254, rx: 5, rz: 3.5, rot: 1.1, ph: 3 }],
    water: [{ x: -54, z: 174, rx: 26, rz: 34, rot: 0.5, ph: 1.1, depth: 2.4 }],
    groves: [{ x: -54, z: 174, rx: 38, rz: 46, n: 10, kind: 'palm' }],
    coast: { pts: [[70, -300], [66, 200], [36, 300], [-40, 336], [-300, 346]], sea: [300, 420], level: -1.4, beach: 9 },
  },
  {
    // un banc de sable en S posé sur l'eau, d'un bout à l'autre
    n: 16, name: 'Le Récif', theme: 'mer', par: 5, seed: 1626, tee: T0, pin: { x: 0, z: 480 }, relief: 0.5, wobble: 10, bankH: 6,
    line: [[0, 35, 14], [18, 110, 16], [30, 190, 17], [14, 265, 16], [-14, 330, 16], [-24, 400, 14], [-12, 446, 12]],
    green: { x: 0, z: 478, rx: 14, rz: 15, rot: -0.3, lift: 0.7, sx: -0.012, sz: 0.01, ph: 0.9 },
    bunkers: [{ x: 50, z: 200, rx: 7, rz: 5, rot: 0.2, ph: 1 }, { x: -36, z: 340, rx: 7, rz: 4.5, rot: -0.3, ph: 2 }, { x: 14, z: 486, rx: 5, rz: 3.5, rot: -0.7, ph: 3 }],
    groves: [{ x: 46, z: 150, rx: 8, rz: 20, n: 4, kind: 'palm' }, { x: -40, z: 380, rx: 8, rz: 20, n: 4, kind: 'palm' }],
    coast: { hug: true, level: -1.4, beach: 6, sea: [90, 260], ring: { x: 0, z: 240, rx: 230, rz: 340 } },
  },
  // --------------------------------------------------------------- montagne
  {
    // le torrent coupe le trou en deux : on remonte la rive gauche, le green est sur l'autre rive
    n: 17, name: 'Le Torrent', theme: 'montagne', par: 4, seed: 1313, tee: T0, pin: { x: -42, z: 340 }, tilt: [0, -0.02],
    line: [[8, 35, 14], [18, 120, 16, 30], [20, 200, 15, 30], [12, 262, 12], [-10, 300, 0, 22]], greenLand: 28,
    green: { x: -42, z: 338, rx: 14, rz: 15, rot: 0.6, lift: 0.7, sx: 0.012, sz: 0.01, ph: 1.1 },
    bunkers: [{ x: 38, z: 215, rx: 7, rz: 5, rot: -0.2, ph: 1 }, { x: -58, z: 350, rx: 5, rz: 4, rot: 0.9, ph: 2 }],
    ravines: [{ pts: [[-12, -300], [-14, 140], [-24, 250], [-16, 300], [-6, 600]], w: 20, depth: 4 }],
    plateaus: [{ x: 60, z: 160, rx: 18, rz: 40, rot: 0.1, h: 10, ph: 1 }],
  },
  {
    // un long par 3 par-dessus un ravin aux bords déchiquetés
    n: 18, name: 'Le Ravin', theme: 'montagne', par: 3, seed: 1414, tee: T0, pin: { x: 6, z: 176 },
    line: [[0, 30, 0], [3, 148, 8], [4, 158, 10]],
    green: { x: 5, z: 174, rx: 13, rz: 12, rot: 0.2, lift: 0.6, sx: -0.01, sz: 0.012, ph: 2.6 },
    bunkers: [{ x: -10, z: 184, rx: 5, rz: 3.5, rot: 0.8, ph: 1 }, { x: 21, z: 168, rx: 4.5, rz: 3.5, rot: -0.7, ph: 2 }],
    plateaus: [{ x: 0, z: -4, rx: 22, rz: 22, rot: 0, h: 8, ph: 1.5 }],
    ravines: [{ pts: [[-400, 80], [-60, 92], [0, 88], [40, 104], [400, 96]], w: 40, depth: 8 }],
  },
  {
    // un grand S entre deux lacs
    n: 19, name: 'Les Deux Lacs', theme: 'montagne', par: 5, seed: 1515, tee: T0, pin: { x: -4, z: 492 }, tilt: [0, 0.015],
    line: [[0, 35, 14], [-22, 110, 16], [-36, 190, 17], [-8, 262, 17], [30, 322, 16], [38, 392, 14], [16, 452, 12]],
    green: { x: -4, z: 490, rx: 14, rz: 15, rot: -0.5, lift: 0.6, sx: -0.012, sz: -0.01, ph: 0.9 },
    bunkers: [{ x: -66, z: 180, rx: 7, rz: 5, rot: 0.1, ph: 1 }, { x: 66, z: 350, rx: 7, rz: 5, rot: 1, ph: 2 }, { x: -20, z: 500, rx: 5, rz: 3.5, rot: -0.5, ph: 3 }],
    water: [{ x: 6, z: 168, rx: 16, rz: 28, rot: 0.2, ph: 0.6, depth: 2.8 }, { x: 8, z: 380, rx: 14, rz: 22, rot: -0.3, ph: 1.6, depth: 2.6 }],
  },
  {
    // étroit, en S (dans l'autre sens que les Deux Lacs), des bunkers à chaque virage
    n: 20, name: 'Le Serpent', theme: 'montagne', par: 4, seed: 1616, tee: T0, pin: { x: -8, z: 384 }, tilt: [0, -0.01],
    line: [[0, 35, 12, 38], [22, 102, 13, 38], [26, 168, 13, 38], [-6, 226, 13, 38], [-32, 284, 12, 38], [-26, 340, 11]],
    green: { x: -8, z: 382, rx: 14, rz: 15, rot: 0.4, lift: 0.8, sx: -0.01, sz: -0.012, ph: 1.8 },
    bunkers: [{ x: 42, z: 112, rx: 6, rz: 4, rot: -0.2, ph: 1 }, { x: 8, z: 170, rx: 6, rz: 4, rot: 0.2, ph: 2 }, { x: 12, z: 236, rx: 6, rz: 4, rot: -0.8, ph: 3 }, { x: -50, z: 288, rx: 6, rz: 4, rot: 0.6, ph: 4 }, { x: 8, z: 388, rx: 5, rz: 3.5, rot: -0.6, ph: 5 }, { x: -22, z: 396, rx: 5, rz: 3.5, rot: 0.6, ph: 6 }],
    plateaus: [{ x: 0, z: 0, rx: 22, rz: 24, rot: 0, h: 10, ph: 0.5 }],
  },
  {
    // le long d'un lac de montagne ; le green est sur une île, au bout
    n: 21, name: 'Le Lac Alpin', theme: 'montagne', par: 5, seed: 1717, tee: T0, pin: { x: -20, z: 502 }, relief: 0.5, wobble: 8, bankH: 14,
    line: [[0, 35, 14], [10, 120, 17], [14, 200, 18], [4, 280, 17], [-10, 350, 15], [-16, 410, 12], [-18, 440, 0]], greenLand: 24,
    gaps: [[432, 468]],
    green: { x: -20, z: 500, rx: 14, rz: 13, rot: 0.9, lift: 0.6, sx: -0.012, sz: 0.01, ph: 2.3 },
    bunkers: [{ x: -16, z: 230, rx: 7, rz: 5, rot: 0.2, ph: 1 }, { x: -4, z: 512, rx: 5, rz: 3.5, rot: 0.8, ph: 2 }],
    coast: { hug: true, level: -1.2, beach: 3, sea: [60, 300], ring: { x: 0, z: 260, rx: 190, rz: 330 } },
  },
  {
    // tout droit et en montée, bordé de bunkers, jusqu'au green posé sur un replat
    n: 22, name: 'Le Sommet', theme: 'montagne', par: 4, seed: 1818, tee: T0, pin: { x: -4, z: 412 }, tilt: [0, 0.03],
    line: [[0, 35, 15], [1, 130, 18], [-1, 230, 17], [-3, 320, 15], [-4, 370, 12]],
    green: { x: -4, z: 410, rx: 15, rz: 16, rot: 0.1, lift: 0.5, sx: 0.012, sz: -0.012, ph: 0.4 },
    bunkers: [{ x: 22, z: 180, rx: 7, rz: 4.5, rot: -0.1, ph: 1 }, { x: -24, z: 230, rx: 7, rz: 4.5, rot: 0.1, ph: 2 }, { x: 20, z: 300, rx: 6, rz: 4, rot: -0.1, ph: 3 }, { x: -20, z: 400, rx: 5, rz: 3.5, rot: 0.8, ph: 4 }, { x: 12, z: 420, rx: 5, rz: 3.5, rot: -0.7, ph: 5 }],
    plateaus: [{ x: -4, z: 412, rx: 38, rz: 32, rot: 0.1, h: 4, ph: 2, soft: true }],
  },
  {
    // départ tout en haut d'une falaise : on joue vers le green, vingt mètres plus bas
    n: 23, name: 'La Cascade', theme: 'montagne', par: 3, seed: 2525, tee: T0, pin: { x: 4, z: 140 }, tilt: [0, -0.03],
    line: [[0, 34, 0], [2, 114, 8], [3, 124, 10]],
    green: { x: 4, z: 138, rx: 14, rz: 13, rot: 0.2, lift: 0.5, sx: 0.012, sz: 0.01, ph: 1.2 },
    bunkers: [{ x: 20, z: 146, rx: 5, rz: 3.5, rot: -0.7, ph: 1 }, { x: -6, z: 154, rx: 6, rz: 3, rot: 0.2, ph: 2 }],
    water: [{ x: -20, z: 114, rx: 14, rz: 16, rot: 0.3, ph: 0.8, depth: 2.6 }],
    plateaus: [{ x: 0, z: -2, rx: 26, rz: 26, rot: 0, h: 18, ph: 0.4 }],
  },
  {
    // en lacets dans la pente : à droite, demi-tour vers la gauche, puis on remonte jusqu'au green
    n: 24, name: 'Les Lacets', theme: 'montagne', par: 5, seed: 2626, tee: T0, pin: { x: 2, z: 356 }, tilt: [0, 0.035],
    line: [[-14, 40, 14], [-50, 95, 16], [-84, 140, 15, 40], [-70, 180, 0, 40], [-20, 205, 15], [40, 225, 15], [66, 255, 0, 40], [40, 300, 13], [14, 330, 12]],
    green: { x: 2, z: 354, rx: 14, rz: 15, rot: -0.5, lift: 0.6, sx: 0.012, sz: -0.01, ph: 2.4 },
    bunkers: [{ x: -106, z: 130, rx: 7, rz: 5, rot: 0.6, ph: 1 }, { x: 74, z: 214, rx: 7, rz: 5, rot: -0.4, ph: 2 }, { x: -12, z: 362, rx: 5, rz: 3.5, rot: 0.8, ph: 3 }],
    groves: [{ x: -14, z: 148, rx: 46, rz: 12, n: 26, kind: 'pine' }, { x: 2, z: 262, rx: 40, rz: 12, n: 20, kind: 'pine' }],
  },
  // --------------------------------------------------------------- désert
  {
    // dogleg à droite autour d'une oasis bordée de palmiers
    n: 25, name: "L'Oasis", theme: 'desert', par: 4, seed: 1919, tee: T0, pin: { x: -95, z: 282 },
    line: [[0, 35, 15], [2, 115, 18], [-8, 190, 18], [-38, 245, 15], [-70, 268, 12]],
    green: { x: -94, z: 280, rx: 14, rz: 15, rot: 1.2, lift: 0.6, sx: 0.012, sz: -0.01, ph: 1.3 },
    bunkers: [{ x: 22, z: 212, rx: 12, rz: 7, rot: -0.4, ph: 1 }, { x: -108, z: 294, rx: 5, rz: 3.5, rot: 0.6, ph: 2 }],
    water: [{ x: -52, z: 192, rx: 24, rz: 30, rot: 0.5, ph: 0.8, depth: 2.4 }],
    groves: [{ x: -52, z: 192, rx: 36, rz: 42, n: 14, kind: 'palm' }],
    hills: [{ x: 90, z: 150, r: 60, h: 8 }],
  },
  {
    // par-dessus un canyon : rater le green, c'est jouer depuis le fond
    n: 26, name: 'Le Canyon', theme: 'desert', par: 3, seed: 2020, tee: T0, pin: { x: 3, z: 176 },
    line: [[0, 30, 0], [2, 150, 10], [3, 160, 11]],
    green: { x: 3, z: 174, rx: 14, rz: 13, rot: 0.2, lift: 0.6, sx: -0.012, sz: 0.01, ph: 0.4 },
    bunkers: [{ x: -14, z: 186, rx: 6, rz: 3.5, rot: 0.8, ph: 1 }, { x: 18, z: 168, rx: 5, rz: 3.5, rot: -0.7, ph: 2 }],
    ravines: [{ pts: [[-400, 76], [-40, 84], [10, 94], [60, 88], [400, 100]], w: 46, depth: 14, dry: true }],
  },
  {
    // en lacets entre les mesas
    n: 27, name: 'Les Mesas', theme: 'desert', par: 5, seed: 2121, tee: T0, pin: { x: -30, z: 512 },
    line: [[0, 35, 15], [10, 120, 18], [40, 200, 18], [48, 280, 17], [20, 360, 17], [-20, 430, 15], [-30, 480, 12]],
    green: { x: -30, z: 510, rx: 15, rz: 16, rot: -0.2, lift: 0.8, sx: 0.01, sz: 0.012, ph: 2.2 },
    bunkers: [{ x: 70, z: 230, rx: 10, rz: 6, rot: 0.3, ph: 1 }, { x: 0, z: 410, rx: 9, rz: 5, rot: -0.5, ph: 2 }, { x: -46, z: 500, rx: 5, rz: 3.5, rot: 0.6, ph: 3 }],
    plateaus: [{ x: -36, z: 170, rx: 28, rz: 44, rot: 0.2, h: 22, ph: 1 }, { x: 98, z: 300, rx: 26, rz: 40, rot: -0.2, h: 24, ph: 2 }, { x: -58, z: 340, rx: 22, rz: 36, rot: 0.3, h: 20, ph: 3 }],
  },
  {
    // court et tentant : un grand bunker barre le fairway, on peut le contourner par la gauche
    n: 28, name: 'Le Mirage', theme: 'desert', par: 4, seed: 2222, tee: T0, pin: { x: 2, z: 288 },
    line: [[0, 35, 14], [4, 110, 15], [6, 168, 14], [6, 178, 0], [4, 222, 0], [3, 232, 12], [2, 256, 12]],
    alt: [[[8, 150, 8], [36, 186, 11], [32, 214, 11], [6, 246, 8]]],
    green: { x: 2, z: 286, rx: 14, rz: 15, rot: 0, lift: 0.6, sx: 0.012, sz: 0.01, ph: 0.9 },
    bunkers: [{ x: 2, z: 200, rx: 28, rz: 20, rot: 0.15, ph: 1, depth: 1.2 }, { x: -14, z: 296, rx: 5, rz: 3.5, rot: 0.7, ph: 2 }, { x: 18, z: 278, rx: 5, rz: 3.5, rot: -0.6, ph: 3 }],
  },
  {
    // longue descente, des îlots de fairway au milieu du sable
    n: 29, name: 'La Piste', theme: 'desert', par: 4, seed: 2323, tee: T0, pin: { x: 0, z: 432 }, tilt: [0, -0.05], valley: 46,
    line: [[0, 35, 14], [2, 92, 15], [3, 122, 0], [4, 150, 0], [5, 176, 16], [4, 240, 16], [3, 272, 0], [2, 298, 0], [1, 322, 15], [0, 384, 14], [0, 402, 12]],
    green: { x: 0, z: 430, rx: 15, rz: 16, rot: 0.1, lift: 0.6, sx: -0.012, sz: 0.012, ph: 2.7 },
    bunkers: [{ x: 26, z: 208, rx: 8, rz: 5, rot: 0.3, ph: 1 }, { x: -24, z: 350, rx: 8, rz: 5, rot: -0.3, ph: 2 }, { x: 16, z: 440, rx: 5, rz: 3.5, rot: -0.8, ph: 3 }],
  },
  {
    // le green au sommet d'une mesa : il faut tomber pile dessus
    n: 30, name: 'Le Couchant', theme: 'desert', par: 3, seed: 2424, tee: T0, pin: { x: 2, z: 142 },
    line: [[0, 30, 0], [1, 116, 0]],
    green: { x: 2, z: 140, rx: 13, rz: 12, rot: 0.3, lift: 0.4, sx: 0.012, sz: -0.01, ph: 1.9 },
    bunkers: [{ x: -14, z: 146, rx: 4.5, rz: 3, rot: 0.9, ph: 1 }],
    plateaus: [{ x: 0, z: -3, rx: 20, rz: 20, rot: 0, h: 8, ph: 0.3 }, { x: 2, z: 140, rx: 34, rz: 31, rot: 0.3, h: 7, ph: 1.7, soft: true }],
  },

];

// Parcours proposés : un décor (8 trous, 6 au désert), l'aller, le retour, les 18 premiers trous ou les 30
export const COURSES = {
  campagne: { label: 'Campagne · 8 trous', holes: [1, 2, 3, 4, 5, 6, 7, 8] },
  mer: { label: 'Bord de mer · 8 trous', holes: [9, 10, 11, 12, 13, 14, 15, 16] },
  montagne: { label: 'Montagne · 8 trous', holes: [17, 18, 19, 20, 21, 22, 23, 24] },
  desert: { label: 'Désert · 6 trous', holes: [25, 26, 27, 28, 29, 30] },
  aller: { label: 'Aller · 9 trous', holes: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  retour: { label: 'Retour · 9 trous', holes: [10, 11, 12, 13, 14, 15, 16, 17, 18] },
  complet: { label: 'Grand tour · 18 trous', holes: Array.from({ length: 18 }, (_, i) => i + 1) },
  tour: { label: 'Les quatre décors · 30 trous', holes: Array.from({ length: 30 }, (_, i) => i + 1) },
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

// le terrain du trou : distance à la ligne de jeu, abscisse le long de la ligne, côté, et demi-largeur de terrain
// voulue à cet endroit (4e valeur des points, interpolée)
function landInfo(pts, x, z) {
  let best = Infinity, acc = 0, along = 0, side = 1, lw = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, , aw] = pts[i], [bx, bz, , bw] = pts[i + 1];
    const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez, L = Math.sqrt(L2);
    let t = ((x - ax) * ex + (z - az) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; along = acc + t * L; side = (x - px) * ez - (z - pz) * ex > 0 ? 1 : -1; lw = lerp(aw, bw, t); }
    acc += L;
  }
  return { dist: best, along, side, lw };
}

// prolonge une polyligne aux deux bouts (trait de côte, ravin) pour qu'elle traverse tout le paysage
function extend(pts, far = 3000) {
  const out = pts.map((p) => [p[0], p[1], 0]);
  const ext = (a, b) => { const dx = a[0] - b[0], dz = a[1] - b[1], L = Math.hypot(dx, dz) || 1; return [a[0] + dx / L * far, a[1] + dz / L * far, 0]; };
  return [ext(out[0], out[1]), ...out, ext(out[out.length - 1], out[out.length - 2])];
}

// distance signée (m, positive dedans) à une forme de terre posée sur l'eau : ellipse { x, z, rx, rz } ou
// bande { pts: [[x, z, demi-largeur], …] } (chaussée, presqu'île)
function shapeSD(L, x, z) {
  if (L.pts) return lineInfo(L.pts, x, z).margin;
  return (1 - ellD(L, x, z)) * Math.min(L.rx, L.rz);
}

// ------------------------------------------------------------------ construction
export function buildHole(def) {
  const theme = THEMES[def.theme] || THEMES.campagne;
  const tee = def.tee, pin = def.pin, G = def.green;
  const valley = def.valley ?? theme.valley, bankH = def.bankH ?? theme.bankH, bankR = def.bankR ?? theme.bankR;
  // ligne de jeu complète (pour le relief) : départ → points du fairway → green
  // fairways larges, à la Wii : les demi-largeurs des fiches sont multipliées par FAIR
  const line = def.line.map((p) => [p[0], p[1], p[2] * FAIR, p[3]]);
  const center = [[tee.x, tee.z, 0], ...line, [G.x, G.z, 0]];
  const fair = line, alts = (def.alt || []).map((a) => a.map((p) => [p[0], p[1], p[2] * FAIR, p[3]]));
  // forme du terrain du trou : une bande qui suit la ligne de jeu, au bord ondulé, plus large autour du green ;
  // au-delà, la forêt (hors-limites) ou l'eau. 4e valeur d'un point de la ligne : demi-largeur du terrain à cet endroit
  // (sur l'eau, le terrain a en plus sa plage et une rangée d'arbres)
  const shore = def.coast && def.coast.hug ? def.coast.beach + 5 : 0;
  const landPts = [[tee.x, tee.z, 0, (def.teeLand ?? 30) + shore], ...line.map((p) => [p[0], p[1], p[2], (p[3] ?? Math.max(42, p[2] + 28)) + shore]), [G.x, G.z, 0, (def.greenLand ?? Math.max(G.rx, G.rz) + 28) + shore]];
  const altPts = alts.map((a) => a.map((p) => [p[0], p[1], p[2], p[3] ?? Math.max(20, p[2] + 16)]));
  const wob = def.wobble ?? 9, ph = (def.seed % 97) * 0.37;
  function landSD(x, z) {
    let best = -Infinity;
    for (const pts of [landPts, ...altPts]) {
      const L = landInfo(pts, x, z);
      if (pts === landPts && def.gaps && def.gaps.some(([a, b]) => L.along > a && L.along < b)) continue;
      const w = wob * (0.62 * Math.sin(L.along * 0.047 + L.side * 2.1 + ph) + 0.38 * Math.sin(L.along * 0.13 + L.side * 0.8 + ph * 2));
      best = Math.max(best, L.lw + w - L.dist);
    }
    return best;
  }
  // distance au couloir de jeu (ligne principale ou second fairway)
  const corridor = (x, z) => { let d = lineInfo(center, x, z).dist; for (const a of alts) d = Math.min(d, lineInfo(a, x, z).dist); return d; };
  const teeDir = Math.atan2(fair[0][0] - tee.x, fair[0][1] - tee.z);
  const hills = def.hills || [], bunkers = def.bunkers || [], waters = def.water || [], plateaus = def.plateaus || [];
  const tilt = def.tilt || [0, 0], relief = def.relief ?? 1;
  // limites du terrain jouable : la ligne de jeu et ses obstacles, avec de la marge
  const B = def.bounds || (() => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of center) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { x0: Math.round(x0 - 95), x1: Math.round(x1 + 95), z0: Math.round(z0 - 45), z1: Math.round(z1 + 60) };
  })();
  // mer : trait de côte prolongé, signe du côté de la mer
  // l'eau peut aussi être un lac : pas de trait de côte, mais une rive lointaine (ring) et des terres posées dessus
  const coast = def.coast ? { ...def.coast, line: def.coast.pts ? extend(def.coast.pts) : null, land: def.coast.land || [] } : null;
  if (coast && coast.line) coast.seaSide = lineInfo(coast.line, coast.sea[0], coast.sea[1]).side;
  // distance signée à l'eau (positive côté terre)
  function shoreSD(x, z) {
    let sd = -Infinity;
    if (coast.line) { const c = lineInfo(coast.line, x, z); sd = c.side === coast.seaSide ? -c.dist : c.dist; }
    if (coast.ring) sd = Math.max(sd, (ellD(coast.ring, x, z) - 1) * Math.min(coast.ring.rx, coast.ring.rz));
    for (const L of coast.land) sd = Math.max(sd, shapeSD(L, x, z));
    // trou posé sur l'eau : son terrain est une île qui suit la ligne de jeu (sauf dans les passages à franchir)
    if (coast.hug) sd = Math.max(sd, landSD(x, z) - 2);
    return sd;
  }
  const ravines = (def.ravines || []).map((r) => ({ ...r, line: extend(r.pts) }));
  // hors-limites : au-delà d'une bande qui suit la forme du trou (et, de toute façon, hors du cadre)
  const oob = def.oob ?? 3;
  const obDist = (x, z) => Math.max(-landSD(x, z) - oob, B.x0 - x, x - B.x1, B.z0 - z, z - B.z1);

  // relief naturel : ondulations douces + collines + rives de la vallée + pente générale + plateaux
  function base(x, z) {
    // (relief : ampleur des ondulations, faible sur les îles pour que la balle ne redescende pas à l'eau)
    let h = relief * (0.9 * Math.sin(x * 0.023 + 1.3) * Math.sin(z * 0.019 + 0.4)
      + 0.5 * Math.sin(x * 0.051 - z * 0.037) + 0.35 * Math.sin(z * 0.071 + x * 0.013));
    for (const k of hills) { const d2 = ((x - k.x) ** 2 + (z - k.z) ** 2) / (k.r * k.r); if (d2 < 9) h += k.h * Math.exp(-d2); }
    const s = -landSD(x, z) - 6;
    if (s > 0) h += bankH * (1 - Math.exp(-(s * s) / (bankR * bankR)));
    // au loin, de grandes collines qui ferment l'horizon
    const far = Math.max(0, Math.hypot(x - (B.x0 + B.x1) / 2, (z - (B.z0 + B.z1) / 2) * 0.7) - 260);
    if (far > 0) h += far * (def.theme === 'montagne' ? 0.085 : 0.06) * (1.4 + Math.sin(x * 0.006 + 1) * Math.cos(z * 0.005));
    h += tilt[0] * (x - tee.x) + tilt[1] * (z - tee.z);
    // plateaux aux bords à pic (falaises)
    // (soft : talus en pente douce plutôt que falaise, pour pouvoir remonter un coup raté)
    for (const p of plateaus) { const d = ellD(p, x, z); if (d < 1.05) h += p.h * (1 - smooth(p.soft ? 0.55 : 0.86, 1.0, d)); }
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
    for (const a of alts) li.margin = Math.max(li.margin, lineInfo(a, x, z).margin);
    let bd = Infinity, bi = -1;
    for (let i = 0; i < bunkers.length; i++) { const d = ellD(bunkers[i], x, z); if (d < bd) { bd = d; bi = i; } }
    let wd = Infinity, wi = -1;
    for (let i = 0; i < waters.length; i++) { const d = ellD(waters[i], x, z); if (d < wd) { wd = d; wi = i; } }
    // côte : distance signée (positive côté terre)
    let sd = Infinity;
    if (coast) sd = shoreSD(x, z);
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
    // ravin : parois à pic au bord irrégulier, torrent au fond
    if (f.rv < 40) { const R = ravines[f.ri], j = 1.6 * Math.sin(x * 0.13 + 1) * Math.sin(z * 0.17); h -= R.depth * (1 - smooth(R.w * 0.26, R.w * 0.52 + j, f.rv)); }
    // mer : plage en pente douce, puis fond qui plonge
    if (coast && f.sd < coast.beach + 18) {
      const sd = f.sd, L = coast.level;
      const target = sd > 0 ? L + 0.2 + sd * 0.08 : L + 0.2 - Math.min(14, -sd * 0.2);
      h = lerp(target, h, smooth(coast.beach * 0.7, coast.beach + 18, sd));
    }
    // à l'intérieur des terres, jamais sous l'eau (pas de flaques au milieu d'une île) ; les étangs et les ravins
    // gardent leur creux
    if (coast && f.sd > coast.beach && f.wd > 1.6 && !(f.rv < 40)) h = Math.max(h, coast.level + 0.5 + Math.min(f.sd - coast.beach, 30) * 0.04);
    return h;
  }
  const heightAt = (x, z) => heightF(x, z, fields(x, z));

  function surfaceF(x, z, f, h) {
    // l'eau (étang, mer, torrent) est un obstacle d'eau même au-delà des limites : on repart de la rive
    if (f.wd < 1.5 && h < waterLv[f.wi]) return 'water';
    if (coast && h < coast.level) return 'water';
    if (f.ri >= 0 && !ravines[f.ri].dry && f.rv < ravines[f.ri].w * 0.32) return 'water';
    if (obDist(x, z) > 0) return 'ob';
    if (f.td === 0) return 'tee';
    if (f.gd < 1) return 'green';
    if (f.bd < 0.93) return 'bunker';
    if (coast && f.sd < coast.beach && h < coast.level + 2.2) return 'beach';
    if (f.gd < 1.13) return 'fringe';
    if (f.fm > 0) return 'fairway';
    // désert : une première coupe de rough autour du fairway et du green, puis le sable dur
    if (theme.hardpan && f.fm < -3.5 && f.gd > 1.6 && f.td > 4) return 'desert';
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
    if (plateaus.some((p) => { const d = ellD(p, x, z); return d > (p.soft ? 0.5 : 0.8) && d < 1.12; })) return false;
    if (Math.hypot(x - pin.x, z - pin.z) < 30) return false;
    for (const t of trees) if ((t.x - x) ** 2 + (t.z - z) ** 2 < (t.r + 2.2) ** 2) return false;
    return true;
  };
  const addTree = (x, z, big, forced) => {
    if (!okTree(x, z)) return;
    const kind = forced || rng.weighted(theme.trees);
    const s = rng.range(0.85, 1.25) * (big ? 1.15 : 1);
    // feuillage vu comme un ellipsoïde : r (rayon horizontal), ry (demi-hauteur), centré à h au-dessus du sol
    const D = { pine: [2.7, 5.2, 6.6], oak: [3.9, 2.9, 5.6], round: [3.3, 2.9, 5.6], palm: [3.2, 1.6, 7.6], cactus: [1.1, 2.4, 2.6] }[kind];
    trees.push({ x, z, y: heightAt(x, z), kind, s, r: D[0] * s, ry: D[1] * s, h: D[2] * s, rot: rng.range(0, 6.283), v: rng.int(0, 7) });
  };
  // une rangée d'arbres qui borde le terrain, juste à l'intérieur de son contour ; au-delà, la forêt (sauf sur l'eau)
  const ring = def.ringTrees ?? 0.8;
  for (const pts of [landPts, ...altPts]) for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    const nx = (bz - az) / L, nz = -(bx - ax) / L;
    for (let d = 0; d < L; d += 5) {
      const px = ax + (bx - ax) * d / L, pz = az + (bz - az) * d / L;
      for (const side of [-1, 1]) {
        // on cherche le bord du terrain en partant de la ligne, puis on plante un peu en dedans
        let o = 8; while (o < 140 && landSD(px + nx * o * side, pz + nz * o * side) > 0) o += 2;
        if (o >= 140) continue;
        // (sur l'eau, on plante après la plage)
        const inset = coast && coast.hug ? coast.beach + rng.range(4, 9) : rng.range(2.5, 7);
        if (rng.chance(ring)) { const k = o - inset; addTree(px + nx * k * side, pz + nz * k * side, false); }
        if (!coast || !coast.hug) {
          if (rng.chance(0.8)) { const k = o + rng.range(4, 30); addTree(px + nx * k * side, pz + nz * k * side, true); }
          if (rng.chance(0.55)) { const k = o + rng.range(30, 90); addTree(px + nx * k * side, pz + nz * k * side, true); }
        }
      }
    }
  }
  // des bouquets d'arbres dans le rough, entre le fairway et la lisière
  for (let i = 0; i < landPts.length - 1; i++) {
    const [ax, az] = landPts[i], [bx, bz] = landPts[i + 1], L = Math.hypot(bx - ax, bz - az);
    const nx = (bz - az) / L, nz = -(bx - ax) / L;
    for (let d = rng.range(10, 30); d < L; d += rng.range(26, 46)) {
      const side = rng.chance(0.5) ? 1 : -1, px = ax + (bx - ax) * d / L, pz = az + (bz - az) * d / L;
      const o = rng.range(20, 34), cx = px + nx * o * side, cz = pz + nz * o * side;
      if (landSD(cx, cz) < 8) continue;
      for (let k = 0, n = rng.int(2, 4); k < n; k++) addTree(cx + rng.range(-5, 5), cz + rng.range(-5, 5), false);
    }
  }
  // bosquets plantés exprès (entre deux fairways, palmiers d'une oasis…)
  for (const g of def.groves || []) for (let k = 0; k < g.n; k++) {
    const a = rng.range(0, 6.283), r = Math.sqrt(rng.next());
    addTree(g.x + Math.cos(a) * r * g.rx, g.z + Math.sin(a) * r * (g.rz || g.rx), true, g.kind);
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
    centerDist: corridor, obDist, landSD, valley, coast, ravines, plateaus,
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
