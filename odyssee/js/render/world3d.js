// odyssee/js/render/world3d.js — rendu « fausse 3D » façon DS : sol en tuiles, bâtiments en volume,
// arbres / herbes / personnages en sprites verticaux, caméra inclinée en perspective étroite, rendu basse résolution.
import * as THREE from 'three';
import { T } from '../world/tiles.js';
import { buildAtlas, buildAnimAtlas, buildSprites, facade, sideWall, roofTex, roofColors, PAL } from './textures.js';

export const EL = 55 * Math.PI / 180, FOV = 26;
export const WPX = Math.sin(EL) / 16, HPX = Math.tan(EL) / 16; // unités monde par pixel de sprite (largeur, hauteur)
const CH = 16;
export const CHAR_ROWS = { red: 0, green: 1, prof: 2, nurse: 3, clerk: 4, youngster: 5, lass: 6, sailor: 7, hiker: 8, cooltrainer_f: 9 };
// tenues de la Team Éclipse : recoloriées à partir des lignes existantes (ligne source, teintes sombre → claire)
const RECOLOR = [
  ['grunt', 4, ['#1c1a28', '#3e3a56', '#6e6894']], ['gruntf', 6, ['#1c1a28', '#3e3a56', '#6e6894']],
  ['nyx', 9, ['#3a0c24', '#8a2050', '#d05a8a']], ['erebe', 7, ['#101c34', '#2a4a7a', '#5e8ac0']],
  ['boss', 2, ['#0c0814', '#2e2050', '#6a54a0']], ['lumen', 4, ['#3a4a3a', '#7aa07a', '#c8e8c0']],
];
/** planche des personnages + lignes recoloriées (peau, contours et reflets conservés) */
export function extendChars(img) {
  const W = 288, H0 = 320, c = document.createElement('canvas'); c.width = W; c.height = H0 + RECOLOR.length * 32;
  const x = c.getContext('2d'); if (img) x.drawImage(img, 0, 0);
  if (!img) return c;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  RECOLOR.forEach(([name, src, pal], k) => {
    const d = x.getImageData(0, src * 32, W, 32), P = pal.map(hex);
    for (let i = 0; i < d.data.length; i += 4) {
      const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
      if (d.data[i + 3] < 10) continue;
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const skin = r > 150 && g > 95 && b > 60 && r > g && g > b && r - b > 40 && r - b < 150;
      if (skin || lum < 46 || lum > 236) continue;
      const u = Math.min(1, Math.max(0, (lum - 46) / 170)), [a, m2, z] = P;
      const mix = u < 0.5 ? a.map((v, j) => v + (m2[j] - v) * u * 2) : m2.map((v, j) => v + (z[j] - v) * (u - 0.5) * 2);
      d.data[i] = mix[0]; d.data[i + 1] = mix[1]; d.data[i + 2] = mix[2];
    }
    x.putImageData(d, 0, H0 + k * 32);
    CHAR_ROWS[name] = 10 + k;
  });
  return c;
}
const DIR_COL = { down: 0, left: 1, right: 2, up: 3 };

function tex(canvasOrImg) {
  const t = new THREE.Texture(canvasOrImg);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
/** bruit de valeur lissé (0..1) : grandes taches de couleur sur le sol, pour casser la répétition des tuiles */
function vnoise(x, y, sc) {
  const fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, w = fy - iy;
  const s = (t) => t * t * (3 - 2 * t), a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * s(u) + (c - a) * s(w) + (a - b - c + d) * s(u) * s(w);
}
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** accumulateur de géométrie (quads indexés) */
class Geo {
  constructor() { this.p = []; this.uv = []; this.c = []; this.i = []; this.n = 0; }
  quad(a, b, c, d, u0, v0, u1, v1, shade = 1) {
    // a=bas-gauche, b=bas-droite, c=haut-droite, d=haut-gauche (du point de vue de la texture)
    this.p.push(...a, ...b, ...c, ...d);
    this.uv.push(u0, v1, u1, v1, u1, v0, u0, v0);
    if (typeof shade === 'number') for (let k = 0; k < 4; k++) this.c.push(shade, shade, shade);
    else if (shade.length === 3) for (let k = 0; k < 4; k++) this.c.push(shade[0], shade[1], shade[2]);
    else for (let k = 0; k < 4; k++) this.c.push(...shade[k]); // une teinte par coin (a, b, c, d)
    const n = this.n; this.i.push(n, n + 1, n + 2, n, n + 2, n + 3); this.n += 4;
  }
  build() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere();
    return g;
  }
}
/** sprite vertical, pieds en (cx, cz) */
function billboard(G, cx, cz, w, h, r, y0 = 0, flip = false, shade = 1) {
  const u0 = flip ? r.u1 : r.u0, u1 = flip ? r.u0 : r.u1;
  G.quad([cx - w / 2, y0, cz], [cx + w / 2, y0, cz], [cx + w / 2, y0 + h, cz], [cx - w / 2, y0 + h, cz], u0, r.v0, u1, r.v1, shade);
}
function flat(G, x0, z0, x1, z1, y, cell, shade = 1) {
  // la texture regarde vers le haut : haut de la tuile = nord (z0)
  G.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], cell[0], cell[1], cell[2], cell[3], shade);
}
/** boîte : faces sud / est / ouest / dessus */
function box(G, x0, z0, x1, z1, h, front, top, side = front, o = {}) {
  if (o.south !== false) G.quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], front[0], front[1], front[2], front[3], 1);
  if (o.east !== false) G.quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], side[0], side[1], side[2], side[3], 0.78);
  if (o.west !== false) G.quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], side[0], side[1], side[2], side[3], 0.78);
  if (top) G.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], top[0], top[1], top[2], top[3], 1);
}

export class WorldView {
  constructor(renderer, charsImg) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
    const A = buildAtlas(), N = buildAnimAtlas(), S = buildSprites();
    this.A = A; this.N = N; this.S = S;
    this.texA = tex(A.canvas); this.texN = tex(N.canvas); this.texS = tex(S.canvas); const sheet = extendChars(charsImg); this.charsH = sheet.height; this.texC = tex(sheet);
    const mk = (map, o = {}) => new THREE.MeshBasicMaterial({ map, vertexColors: true, ...o });
    this.mat = {
      ground: mk(this.texA), anim: mk(this.texN), sprite: mk(this.texS, { alphaTest: 0.5, side: THREE.DoubleSide }),
      chars: new THREE.MeshBasicMaterial({ map: this.texC, alphaTest: 0.5, side: THREE.DoubleSide }),
      // sprites isolés (objets, bulle « ! », herbes qui bougent) : pas de couleurs de sommets
      actorSprite: new THREE.MeshBasicMaterial({ map: this.texS, alphaTest: 0.5, side: THREE.DoubleSide }),
      shadow: mk(this.texS, { transparent: true, depthWrite: false }),
      walls: mk(this.texA),
    };
    this.tinted = Object.values(this.mat);
    this.glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 1, 16, 16, 16); g.addColorStop(0, 'rgba(255,240,180,0.9)'); g.addColorStop(0.4, 'rgba(255,210,120,0.35)'); g.addColorStop(1, 'rgba(255,200,100,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return tex(c); })();
    this.matGlow = new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.matPool = new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
    this.matCrystal = new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.35, 0.6, 1), opacity: 0.7 });
    this.tint = new THREE.Color(1, 1, 1); this.night = 0;
    this.animFrame = 0; this.animT = 0;
    this.focus = new THREE.Vector3(); this.shake = 0;
    this.actors = new Map();
    this.root = null;
  }

  resize(w, h) {
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    // distance pour qu'une tuile fasse 16 pixels de haut à l'écran (rendu basse résolution)
    this.dist = (Math.sin(EL) * h) / (2 * Math.tan(FOV * Math.PI / 360) * 16) * (this.zoom || 1);
  }

  /* ---------------- construction d'une carte ---------------- */
  setMap(map) {
    if (this.root) { this.scene.remove(this.root); this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.userData.own) { o.material.map?.dispose(); o.material.dispose(); } }); }
    for (const a of this.actors.values()) a.dispose?.();
    this.actors.clear();
    this.map = map; this.root = new THREE.Group(); this.scene.add(this.root);
    this.tintCache = new Map();
    this.chunks = new Map(); this.glows = new THREE.Group(); this.root.add(this.glows);
    this.decoAt = new Map(); for (const d of map.deco) this.decoAt.set(d.x + ',' + d.y, d);
    this.scene.background = new THREE.Color(map.outdoor ? '#1d4f2a' : '#0c0a10');
    if (map.id === 'monde') this.scene.background = new THREE.Color('#1d4f2a');
    this.buildBuildings();
    this.buildWindowsGroup();
    this.lastChunk = null;
  }

  groundCell(x, y) {
    const m = this.map, t = m.get(x, y), A = this.A.cells, v = hash(x, y);
    const v2 = hash(x * 3 + 11, y * 5 + 2);
    const g4 = () => (v2 < 0.05 ? 'grassx' + (1 + Math.floor(v2 * 60) % 3) : 'grass' + (v < 0.4 ? 0 : v < 0.7 ? 1 : v < 0.9 ? 2 : 3));
    const zone = m.outdoor ? m.zoneAt(x, y) : null, theme = zone?.theme;
    const grassKey = theme === 'volcanic' ? 'ash' + (v < 0.5 ? 0 : 1) : g4();
    const mask = (same) => { let k = 0; if (same(m.get(x, y - 1))) k |= 1; if (same(m.get(x + 1, y))) k |= 2; if (same(m.get(x, y + 1))) k |= 4; if (same(m.get(x - 1, y))) k |= 8; return k; };
    const groundOf = (tt) => (tt === T.SIGN || tt === T.BLOCK ? m.underAt(x, y) ?? (m.outdoor ? T.GRASS : T.FLOOR) : tt);
    const tt = groundOf(t);
    const deco = this.decoAt.get(x + ',' + y);
    if (deco?.k === 'carpet') return { c: A.mat };
    const isPathish = (q) => [T.PATH, T.PAVE, T.SAND, T.BUILD, T.DOOR, T.BRIDGE, T.SIGN, T.BLOCK, T.MAT].includes(q);
    switch (tt) {
      case T.GRASS: case T.FENCE: case T.ROCK: case T.BUSH: case T.BOULDER: return { c: A[grassKey] };
      case T.TALL: return { c: A['tall' + (v < 0.5 ? 0 : 1)] };
      case T.DARKTALL: return { c: A['darktall' + (v < 0.5 ? 0 : 1)] };
      case T.TREE: case T.PINE: return { c: theme === 'volcanic' ? A.ash1 : A['forest' + (v < 0.5 ? 0 : 1)] };
      case T.PATH: return { c: A[(theme === 'volcanic' ? 'pathash' : 'path') + mask(isPathish)] };
      case T.PAVE: case T.DOOR: case T.BUILD: return { c: A['pave' + mask((q) => isPathish(q))] };
      case T.SAND: return { c: A['sand' + mask((q) => q !== T.GRASS && q !== T.TALL && q !== T.TREE && q !== T.FLOWER && q !== T.PINE)] };
      case T.WATER: {
        const k = mask((q) => q === T.WATER || q === T.BRIDGE);
        if (k === 15) { const dd = this.waterDepth(x, y); if (dd >= 3) return { anim: this.N.cells.deep }; if (dd === 2) return { anim: this.N.cells.mid }; }
        return { anim: this.N.cells['water' + k] };
      }
      case T.BRIDGE: return { anim: this.N.cells.water15, bridge: A.bridge };
      case T.FLOWER: return { anim: this.N.cells['flower' + Math.floor(v * 3)] };
      case T.LEDGE: return { c: A.ledge }; case T.LEDGE_E: return { c: A.ledgeE }; case T.LEDGE_W: return { c: A.ledgeW };
      case T.CAVE: case T.CAVEWALL: return { c: A['cave' + Math.floor(v * 4)] };
      case T.CAVEDOOR: return { c: A.cavestairs };
      case T.ASH: return { c: A['ash' + (v < 0.5 ? 0 : 1)] };
      case T.SNOW: return { c: A['snow' + (v < 0.5 ? 0 : 1)] };
      case T.STAIRS: return { c: A.stairs };
      case T.MAT: return { c: A.mat };
      case T.FLOOR: case T.WALL: return { c: A['floor_' + m.floor] || A.floor_wood };
      default: return { c: A[grassKey] };
    }
  }

  /** distance (en tuiles, 1 à 3) jusqu'à la terre la plus proche */
  waterDepth(x, y) {
    const m = this.map, land = (a, b) => { const t = m.get(a, b); return t !== T.WATER && t !== T.BRIDGE; };
    for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if ((Math.abs(dx) === r || Math.abs(dy) === r) && land(x + dx, y + dy)) return r;
    return 3;
  }
  /** teinte du sol à un coin de tuile : grandes taches douces + ombre des arbres et bâtiments voisins (lissée d'un coin à l'autre) */
  cornerTint(cx, cy) {
    const m = this.map;
    const n = vnoise(cx, cy, 7) * 0.65 + vnoise(cx + 99, cy + 37, 3) * 0.35;
    let k = 0.93 + n * 0.13;
    const occ = (a, b) => { const q = m.get(a, b); return q === T.TREE || q === T.PINE || q === T.BUILD; };
    // les quatre tuiles autour du coin ; celles du nord-ouest projettent plus d'ombre (lumière en haut à gauche)
    const o = (occ(cx - 1, cy - 1) ? 1.2 : 0) + (occ(cx, cy - 1) ? 1 : 0) + (occ(cx - 1, cy) ? 0.7 : 0) + (occ(cx, cy) ? 0.3 : 0);
    k *= 1 - Math.min(0.24, o * 0.075);
    return [k * (0.98 + n * 0.05), k, k * (1.02 - n * 0.05)];
  }
  groundTint(x, y, t) {
    if (!this.map.outdoor || t === T.WATER) return 1;
    const c = (a, b) => { const kk = a + ',' + b; let v = this.tintCache.get(kk); if (!v) { v = this.cornerTint(a, b); this.tintCache.set(kk, v); } return v; };
    // ordre des coins du quad : bas-gauche, bas-droite, haut-droite, haut-gauche
    return [c(x, y + 1), c(x + 1, y + 1), c(x + 1, y), c(x, y)];
  }

  buildChunk(ci, cj) {
    const m = this.map, A = this.A.cells, S = this.S.rects;
    const G = new Geo(), N = new Geo(), P = new Geo(), Wl = new Geo(), Sh = new Geo();
    const glows = []; this.crystalGlows = [];
    const x0 = ci * CH, y0 = cj * CH;
    const wallH = 2 * Math.tan(EL), caveH = 1.6 * Math.tan(EL);
    for (let y = y0; y < Math.min(m.h, y0 + CH); y++) for (let x = x0; x < Math.min(m.w, x0 + CH); x++) {
      const t = m.get(x, y), g = this.groundCell(x, y), v = hash(x + 7, y + 3);
      if (g.c) flat(G, x, y, x + 1, y + 1, 0, g.c, this.groundTint(x, y, t));
      if (g.anim) flat(N, x, y, x + 1, y + 1, 0, g.anim);
      if (g.bridge) flat(G, x - 0.02, y, x + 1.02, y + 1, 0.06, g.bridge);
      const zone = m.outdoor ? m.zoneAt(x, y) : null, theme = zone?.theme;
      // décor en volume
      const nb = m.get(x, y - 1);
      if ((t === T.TREE || t === T.PINE) && (nb === T.BUSH || nb === T.BOULDER)) {
        // juste devant un petit arbre ou un rocher : un buisson bas, pour qu'on voie l'obstacle
        const r = S.bush; billboard(P, x + 0.5, y + 0.66, r.w * WPX * 1.3, r.h * HPX * 1.2, r);
      } else if (t === T.TREE || t === T.PINE) {
        // forêt variée : cinq formes d'arbres, tailles et teintes un peu différentes, plus sombre au cœur des bois
        const v3 = hash(x * 13 + 5, y * 7 + 1);
        let key = t === T.PINE ? 'pine' : ['tree', 'tree', 'tree2', 'tree3', 'tree4', 'tree5'][Math.floor(v3 * 6)];
        if (theme === 'volcanic') key = 'deadtree';
        const r = S[key];
        const isTree = (q) => q === T.TREE || q === T.PINE;
        const deep = isTree(m.get(x, y + 1)) && isTree(m.get(x - 1, y)) && isTree(m.get(x + 1, y)) && isTree(m.get(x, y - 1));
        const sc = 0.92 + v3 * 0.16, tone = (deep ? 0.8 : 1) * (0.92 + v * 0.12);
        billboard(P, x + 0.5 + (v - 0.5) * 0.16, y + 0.62, r.w * WPX * sc, r.h * HPX * sc, r, 0, v > 0.5, [tone * 0.97, tone, tone * 0.95]);
        flat(Sh, x - 0.15, y + 0.35, x + 1.15, y + 0.95, 0.015, [S.shadow.u0, S.shadow.v0, S.shadow.u1, S.shadow.v1]);
      } else if (t === T.TALL || t === T.DARKTALL) {
        // deux rangées de touffes par case : les hautes herbes paraissent épaisses
        const r = S[t === T.DARKTALL ? 'darktuft' : v < 0.5 ? 'tuft' : 'tuft1'];
        billboard(P, x + 0.5, y + 0.45, 1.04, r.h * HPX * 0.9, r, 0, v < 0.5, 0.88);
        billboard(P, x + 0.5, y + 0.95, 1.04, r.h * HPX, r, 0, v > 0.5);
      } else if (t === T.FENCE) { const r = S.fence; billboard(P, x + 0.5, y + 0.55, 1.0, r.h * HPX, r); }
      else if (t === T.ROCK) { const r = S.rock; billboard(P, x + 0.5, y + 0.6, r.w * WPX * 1.2, r.h * HPX, r); flat(Sh, x + 0.05, y + 0.4, x + 0.95, y + 0.85, 0.015, [S.shadow.u0, S.shadow.v0, S.shadow.u1, S.shadow.v1]); }
      else if (t === T.BUSH) { const r = S.cuttree; billboard(P, x + 0.5, y + 0.7, r.w * WPX * 1.3, r.h * HPX * 1.3, r); flat(Sh, x + 0.05, y + 0.4, x + 0.95, y + 0.85, 0.015, [S.shadow.u0, S.shadow.v0, S.shadow.u1, S.shadow.v1]); }
      else if (t === T.BOULDER) { const r = S.rock; billboard(P, x + 0.5, y + 0.62, r.w * WPX * 1.7, r.h * HPX * 1.6, r); flat(Sh, x - 0.05, y + 0.35, x + 1.05, y + 0.9, 0.015, [S.shadow.u0, S.shadow.v0, S.shadow.u1, S.shadow.v1]); }
      else if (t === T.WALL) {
        // mur du fond en volume ; murs latéraux et bas réduits à une bordure sombre, comme sur DS
        if (y <= 1) { const south = m.get(x, y + 1) !== T.WALL; box(Wl, x, y, x + 1, y + 1, wallH, A[m.wallStyle] || A.wall_in, A.walltop, A.walltop, { south, east: false, west: false }); }
        else flat(Wl, x, y, x + 1, y + 1, 0.01, A.walltop);
      } else if (t === T.CAVEWALL) {
        const south = m.get(x, y + 1) !== T.CAVEWALL, east = m.get(x + 1, y) !== T.CAVEWALL, west = m.get(x - 1, y) !== T.CAVEWALL;
        if (south || east || west || m.get(x, y - 1) !== T.CAVEWALL) box(Wl, x, y, x + 1, y + 1, caveH, A.cavewall, A.cavetop, A.cavewall, { south, east, west });
        else flat(Wl, x, y, x + 1, y + 1, caveH, A.cavetop);
      }
      // petits détails au sol, sans effet sur le jeu : la nature n'est jamais vide
      this.groundDetail(P, x, y, t, theme);
      // décor posé (lampadaires, panneaux, meubles…)
      const d = this.decoAt.get(x + ',' + y);
      if (d) {
        if (d.k === 'counter') { box(Wl, x, y + 0.1, x + 1, y + 1, 0.75 * Math.tan(EL), A[d.front] || A.counterfront, A.counter, A.counter, { east: m.get(x + 1, y) !== T.BLOCK, west: m.get(x - 1, y) !== T.BLOCK }); }
        else if (d.k === 'shelf') box(Wl, x + 0.05, y + 0.2, x + 0.95, y + 0.95, 1.5 * Math.tan(EL), A.shelf, A.roof_flat, A.shelf);
        else if (d.k === 'carpet' || d.k === 'exitlight') { /* sol */ }
        else if (S[d.k]) {
          const r = S[d.k];
          billboard(P, x + (r.w > 16 ? 1 : 0.5), y + 0.6, r.w * WPX, r.h * HPX, r);
          if (d.k === 'lamp') glows.push([x + 0.5, y + 0.62, 26 * HPX]);
          if (['statue', 'plant', 'lamp', 'mailbox', 'sign', 'pot', 'caverock', 'stalag'].includes(d.k)) flat(Sh, x + 0.1, y + 0.4, x + 0.9, y + 0.85, 0.015, [S.shadow.u0, S.shadow.v0, S.shadow.u1, S.shadow.v1]);
        }
      }
    }
    const grp = new THREE.Group();
    const add = (geo, mat, order = 0) => { const g = geo.build(); if (g) { const me = new THREE.Mesh(g, mat); me.renderOrder = order; me.frustumCulled = true; grp.add(me); } };
    add(G, this.mat.ground); add(N, this.mat.anim); add(Sh, this.mat.shadow, 1); add(P, this.mat.sprite); add(Wl, this.mat.walls);
    for (const [gx, gz, gy] of this.crystalGlows) {
      const me = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), this.matCrystal); me.position.set(gx, gy, gz); me.rotation.x = -0.3; grp.add(me);
    }
    for (const [gx, gz, gy] of glows) {
      const me = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), this.matGlow); me.position.set(gx, gy, gz + 0.05); me.rotation.x = -0.3; me.userData.lampGlow = true; this.glows.add(me);
      // flaque de lumière chaude au pied du lampadaire
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), this.matPool); pool.rotation.x = -Math.PI / 2; pool.position.set(gx, 0.03, gz + 0.3); this.glows.add(pool);
    }
    this.root.add(grp);
    return grp;
  }

  groundDetail(P, x, y, t, theme) {
    const m = this.map, S = this.S.rects, h = hash(x * 7 + 3, y * 11 + 9), h2 = hash(x * 5 + 1, y * 3 + 7);
    if (this.decoAt.has(x + ',' + y) || m.warpAt(x, y)) return;
    const flatDec = (k) => { const r = S[k], ox = 0.15 + h2 * 0.35, oy = 0.15 + (1 - h2) * 0.35; flat(P, x + ox, y + oy, x + ox + 0.5, y + oy + 0.5, 0.012, [r.u0, r.v0, r.u1, r.v1]); };
    const stand = (k, sc = 1, fx = 0.5) => { const r = S[k]; billboard(P, x + 0.2 + h2 * 0.6, y + 0.4 + fx * 0.4, r.w * WPX * sc, r.h * HPX * sc, r, 0, h > 0.5); };
    const isTree = (q) => q === T.TREE || q === T.PINE;
    if (t === T.GRASS && m.outdoor) {
      if (theme === 'volcanic') { if (h < 0.1) flatDec('d_ash'); return; }
      // lisière des bois : fougères, champignons et feuilles mortes au pied des arbres
      const edge = isTree(m.get(x, y - 1)) || isTree(m.get(x - 1, y)) || isTree(m.get(x + 1, y));
      if (edge && h < 0.28) { if (h < 0.12) stand('fern', 0.9, 0.1); else if (h < 0.17) stand('mushroom', 0.9, 0.3); else flatDec('d_leaves'); return; }
      if (h < 0.05) stand('flowerbush', 0.8);
      else if (h < 0.16) stand('sprig', 1, 0.6);
      else if (h < 0.21) flatDec('d_clover');
      else if (h < 0.25) flatDec('d_daisies');
      else if (h < 0.28) flatDec('d_pebbles');
    } else if (t === T.SAND && h < 0.07) flatDec(h < 0.035 ? 'd_shell' : 'd_pebbles');
    else if (t === T.PATH && h < 0.06) flatDec('d_pebbles');
    else if (t === T.ASH && h < 0.1) flatDec('d_ash');
    else if (t === T.CAVE && h < 0.09) flatDec('d_cave');
    else if (t === T.CAVEWALL && m.dark && m.get(x, y + 1) === T.CAVE && h < 0.14) {
      // cristaux qui luisent au pied des parois de la Grotte Lunaire
      const r = S.crystal; billboard(P, x + 0.3 + h2 * 0.4, y + 1.02, r.w * WPX, r.h * HPX, r, 0, h2 > 0.5);
      this.crystalGlows.push([x + 0.5, y + 1.05, 10 * HPX]);
    }
  }

  ensureChunks(px, py) {
    const ci = Math.floor(px / CH), cj = Math.floor(py / CH), k = ci + ',' + cj;
    if (k === this.lastChunk) return; this.lastChunk = k;
    for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) {
      if (i < 0 || j < 0 || i * CH >= this.map.w || j * CH >= this.map.h) continue;
      const kk = i + ',' + j; if (!this.chunks.has(kk)) this.chunks.set(kk, this.buildChunk(i, j));
    }
    // les morceaux éloignés sont masqués
    for (const [kk, g] of this.chunks) { const [i, j] = kk.split(',').map(Number); g.visible = Math.abs(i - ci) <= 2 && Math.abs(j - cj) <= 2; }
  }

  /** reconstruit les morceaux de carte qui contiennent ces tuiles (arbre coupé, rocher poussé…) */
  refreshTiles(list) {
    const ks = new Set();
    for (const [x, y] of list) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) ks.add(Math.floor((x + dx) / CH) + ',' + Math.floor((y + dy) / CH));
    for (const k of ks) { const g = this.chunks.get(k); if (!g) continue; this.root.remove(g); g.traverse((o) => o.geometry?.dispose()); this.chunks.delete(k); }
    this.lastChunk = null;
  }
  /** grand sprite à part (Pokémon légendaire sur la carte) : image ou canvas, pieds en bas */
  imageActor(id, img, wPx, hPx) {
    let a = this.actors.get(id); if (a) return a;
    const t = tex(img), mat = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(wPx * WPX, hPx * HPX); geo.translate(0, hPx * HPX / 2, 0);
    const uv = geo.attributes.uv; for (let i = 0; i < 4; i++) uv.setY(i, 1 - uv.getY(i));
    const mesh = new THREE.Mesh(geo, mat); this.root.add(mesh);
    const S = this.S.rects.shadow, sg = new THREE.PlaneGeometry(2.2, 1); sg.rotateX(-Math.PI / 2);
    const su = sg.attributes.uv; for (let i = 0; i < 4; i++) su.setXY(i, i % 2 ? S.u1 : S.u0, i < 2 ? S.v0 : S.v1);
    const shadow = new THREE.Mesh(sg, this.mat.shadow); shadow.renderOrder = 1; this.root.add(shadow);
    a = { mesh, shadow, kind: 'image', dispose: () => { geo.dispose(); sg.dispose(); t.dispose(); mat.dispose(); this.root?.remove(mesh); this.root?.remove(shadow); } };
    this.actors.set(id, a); return a;
  }

  /* ---------------- bâtiments ---------------- */
  buildBuildings() {
    this.buildingMeshes = [];
    const cache = new Map();
    const T3 = (key, mk) => { if (!cache.has(key)) cache.set(key, tex(mk())); return cache.get(key); };
    for (const b of this.map.buildings) {
      const g = new THREE.Group();
      const wallH = b.h * Math.tan(EL), o = 0.18;
      const own = (t) => { const m = new THREE.MeshBasicMaterial({ map: t, vertexColors: true }); this.tinted.push(m); m.userData.ownTint = true; return m; };
      if (b.kind === 'cave') {
        // monticule rocheux avec une ouverture sombre
        const geo = new Geo(), A = this.A.cells;
        const h = 1.6 * Math.tan(EL);
        box(geo, b.x, b.y, b.x + b.w, b.y + b.d, h, A.cliffplain, A.cliff, A.cliffplain);
        const mesh = new THREE.Mesh(geo.build(), this.mat.walls); g.add(mesh);
        const holeW = 1.6, holeH = 1.15 * Math.tan(EL);
        const hole = new THREE.Mesh(new THREE.PlaneGeometry(holeW, holeH), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
        hole.position.set(b.doorX + 0.5, holeH / 2, b.y + b.d + 0.01); g.add(hole);
        this.root.add(g); this.buildingMeshes.push(g); continue;
      }
      const fkey = `${b.style}:${b.w}:${b.h}:${b.door}`;
      const fr = T3('f' + fkey, () => facade(b.style, b.w, b.h, b.door, false, b.x * 7 + b.y));
      const sd = T3(`s${b.style}:${b.d}:${b.h}`, () => sideWall(b.style, b.d, b.h));
      const rf = T3(`r${b.roof}:${b.w}:${b.d}`, () => roofTex(b.roof, b.w + 1, b.d + 1));
      const mFront = own(fr), mSide = own(sd), mRoof = own(rf);
      const x0 = b.x, x1 = b.x + b.w, z0 = b.y, z1 = b.y + b.d;
      // façade
      const geoF = new Geo(); geoF.quad([x0, 0, z1], [x1, 0, z1], [x1, wallH, z1], [x0, wallH, z1], 0, 0, 1, 1, 1);
      g.add(new THREE.Mesh(geoF.build(), mFront));
      const geoS = new Geo();
      geoS.quad([x1, 0, z1], [x1, 0, z0], [x1, wallH, z0], [x1, wallH, z1], 0, 0, 1, 1, 0.8);
      geoS.quad([x0, 0, z0], [x0, 0, z1], [x0, wallH, z1], [x0, wallH, z0], 0, 0, 1, 1, 0.8);
      g.add(new THREE.Mesh(geoS.build(), mSide));
      // toit à deux pans
      const flatRoof = b.style === 'center' || b.style === 'mart' || b.style === 'gym' || b.style === 'league';
      const rh = flatRoof ? 0.35 : Math.min(0.9, 0.22 * b.d + 0.2);
      const zm = (z0 + z1) / 2, ytop = wallH + rh;
      const geoR = new Geo();
      geoR.quad([x0 - o, wallH - 0.05, z1 + o], [x1 + o, wallH - 0.05, z1 + o], [x1 + o, ytop, zm], [x0 - o, ytop, zm], 0, 0.5, 1, 1, 1);
      geoR.quad([x1 + o, wallH - 0.05, z0 - o], [x0 - o, wallH - 0.05, z0 - o], [x0 - o, ytop, zm], [x1 + o, ytop, zm], 0, 0, 1, 0.5, 0.7);
      g.add(new THREE.Mesh(geoR.build(), mRoof));
      // pignons
      const rc = roofColors[b.roof] || roofColors.red;
      const gableMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(rc[1]) }); this.tinted.push(gableMat); gableMat.userData.ownTint = true; gableMat.userData.base = new THREE.Color(rc[1]);
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute([x1 + o, wallH - 0.05, z1 + o, x1 + o, wallH - 0.05, z0 - o, x1 + o, ytop, zm, x0 - o, wallH - 0.05, z0 - o, x0 - o, wallH - 0.05, z1 + o, x0 - o, ytop, zm], 3));
      g.add(new THREE.Mesh(gg, gableMat));
      // liseré sous le toit
      const eave = new THREE.Mesh(new THREE.BoxGeometry(b.w + 2 * o, 0.12, 0.12), gableMat); eave.position.set((x0 + x1) / 2, wallH - 0.06, z1 + o); g.add(eave);
      // ombre portée au sol devant le bâtiment
      const sh = new Geo(); const S = this.S.rects.shadow;
      flat(sh, x0 - 0.1, z1 - 0.2, x1 + 0.1, z1 + 0.45, 0.012, [S.u0, S.v0 + (S.v1 - S.v0) * 0.4, S.u1, S.v1]);
      g.add(new THREE.Mesh(sh.build(), this.mat.shadow));
      g.userData.b = b; g.userData.front = mFront; g.userData.fkey = fkey;
      this.root.add(g); this.buildingMeshes.push(g);
    }
  }
  buildWindowsGroup() {
    // à la nuit tombée, fenêtres et portes s'allument (façades de nuit non teintées)
    this.nightGroup = new THREE.Group(); this.root.add(this.nightGroup);
    const cache = new Map();
    for (const g of this.buildingMeshes) {
      const b = g.userData.b; if (!b) continue;
      const key = g.userData.fkey;
      if (!cache.has(key)) {
        const day = facade(b.style, b.w, b.h, b.door, false, b.x * 7 + b.y), night = facade(b.style, b.w, b.h, b.door, true, b.x * 7 + b.y);
        // ne garder que les pixels qui changent (fenêtres)
        const c = document.createElement('canvas'); c.width = day.width; c.height = day.height;
        const x = c.getContext('2d'); const dd = day.getContext('2d').getImageData(0, 0, c.width, c.height), nd = night.getContext('2d').getImageData(0, 0, c.width, c.height);
        const out = x.createImageData(c.width, c.height);
        for (let i = 0; i < dd.data.length; i += 4) { if (dd.data[i] !== nd.data[i] || dd.data[i + 1] !== nd.data[i + 1] || dd.data[i + 2] !== nd.data[i + 2]) { out.data[i] = nd.data[i]; out.data[i + 1] = nd.data[i + 1]; out.data[i + 2] = nd.data[i + 2]; out.data[i + 3] = 255; } }
        x.putImageData(out, 0, 0);
        cache.set(key, new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, alphaTest: 0.5 }));
      }
      const wallH = b.h * Math.tan(EL);
      const geo = new Geo(); geo.quad([b.x, 0, b.y + b.d + 0.01], [b.x + b.w, 0, b.y + b.d + 0.01], [b.x + b.w, wallH, b.y + b.d + 0.01], [b.x, wallH, b.y + b.d + 0.01], 0, 0, 1, 1, 1);
      this.nightGroup.add(new THREE.Mesh(geo.build(), cache.get(key)));
    }
    this.nightGroup.visible = false;
  }

  /* ---------------- personnages, objets ---------------- */
  actor(id, o) {
    let a = this.actors.get(id);
    if (!a) {
      const geo = new THREE.PlaneGeometry(24 * WPX, 32 * HPX); geo.translate(0, 16 * HPX, 0);
      const mesh = new THREE.Mesh(geo, o.kind === 'item' || o.kind === 'bang' ? this.mat.actorSprite : this.mat.chars);
      const S = this.S.rects.shadow;
      const sg = new THREE.PlaneGeometry(0.85, 0.42); sg.rotateX(-Math.PI / 2);
      const uv = sg.attributes.uv; for (let i = 0; i < 4; i++) uv.setXY(i, i % 2 ? S.u1 : S.u0, i < 2 ? S.v0 : S.v1);
      const shadow = new THREE.Mesh(sg, this.mat.shadow); shadow.renderOrder = 1;
      a = { mesh, shadow, kind: o.kind || 'char', dispose: () => { geo.dispose(); sg.dispose(); this.root?.remove(mesh); this.root?.remove(shadow); } };
      this.root.add(mesh); if (o.kind !== 'bang') this.root.add(shadow);
      this.actors.set(id, a);
      if (o.kind === 'item') this.setSpriteRect(a, this.S.rects.itemball, 16, 16);
      if (o.kind === 'bang') this.setSpriteRect(a, this.S.rects.bang, 14, 16);
    }
    return a;
  }
  setSpriteRect(a, r, w, h) {
    const g = a.mesh.geometry; const pos = g.attributes.position, uv = g.attributes.uv;
    const W = w * WPX, H = h * HPX;
    pos.setXYZ(0, -W / 2, H, 0); pos.setXYZ(1, W / 2, H, 0); pos.setXYZ(2, -W / 2, 0, 0); pos.setXYZ(3, W / 2, 0, 0);
    uv.setXY(0, r.u0, r.v0); uv.setXY(1, r.u1, r.v0); uv.setXY(2, r.u0, r.v1); uv.setXY(3, r.u1, r.v1);
    pos.needsUpdate = uv.needsUpdate = true; g.computeBoundingSphere();
  }
  /** cadre d'animation : sprite (ligne), direction, pas (0 = immobile) */
  setFrame(a, sprite, dir, step) {
    const row = CHAR_ROWS[sprite] ?? 0, col = DIR_COL[dir] * 3 + (step === 0 ? 1 : step === 1 ? 0 : 2);
    const k = row * 100 + col; if (a.frame === k) return; a.frame = k;
    const u0 = col * 24 / 288, u1 = (col + 1) * 24 / 288, v0 = row * 32 / this.charsH, v1 = (row + 1) * 32 / this.charsH;
    const uv = a.mesh.geometry.attributes.uv; uv.setXY(0, u0, v0); uv.setXY(1, u1, v0); uv.setXY(2, u0, v1); uv.setXY(3, u1, v1); uv.needsUpdate = true;
  }
  place(a, x, y, hop = 0, inGrass = false) {
    a.mesh.position.set(x + 0.5, hop, y + 0.55);
    a.shadow.position.set(x + 0.5, 0.02, y + 0.6);
    a.shadow.visible = !inGrass;
  }
  /** les herbes hautes s'agitent quand on y entre */
  rustle(x, y) {
    const id = 'rustle:' + x + ',' + y + ':' + performance.now();
    const a = this.actor(id, { kind: 'item' }); this.setSpriteRect(a, this.S.rects.tuft1, 16, 14);
    a.shadow.visible = false; a.mesh.position.set(x + 0.5, 0, y + 0.96);
    const t0 = performance.now();
    const step = () => {
      const u = (performance.now() - t0) / 320;
      if (u >= 1 || !this.actors.has(id)) { this.removeActor(id); return; }
      a.mesh.scale.set(1.05 + Math.sin(u * 18) * 0.06, 1 + Math.sin(u * Math.PI) * 0.18, 1);
      requestAnimationFrame(step);
    };
    step();
  }
  removeActor(id) { const a = this.actors.get(id); if (a) { a.dispose(); this.actors.delete(id); } }

  /* ---------------- heure du jour ---------------- */
  setTimeOfDay(h) {
    // matin doré, journée neutre, soirée orangée, nuit bleutée
    const keys = [[0, [0.27, 0.32, 0.58]], [4.5, [0.31, 0.34, 0.6]], [6.5, [1.0, 0.86, 0.78]], [9.5, [1, 1, 1]], [17, [1, 1, 1]], [18.5, [1.0, 0.8, 0.66]], [20, [0.47, 0.44, 0.7]], [21.5, [0.27, 0.32, 0.58]], [24, [0.27, 0.32, 0.58]]];
    let c = keys[0][1];
    for (let i = 1; i < keys.length; i++) if (h <= keys[i][0]) { const [a, ca] = keys[i - 1], [b, cb] = keys[i]; const u = (h - a) / (b - a); c = ca.map((v, k) => v + (cb[k] - v) * u); break; }
    this.night = h >= 20 || h < 5.5 ? 1 : h >= 18.5 ? (h - 18.5) / 1.5 : h < 6.5 ? 1 - (h - 5.5) : 0;
    this.applyTint(c);
  }
  applyTint(c) {
    const indoorOrCave = !this.map?.outdoor;
    // l'Éclipse : nuit violette sur toute la région
    const k = indoorOrCave ? (this.map?.floor === 'cave' ? [0.82, 0.8, 0.86] : [1, 1, 1]) : this.eclipse ? [0.3, 0.17, 0.44] : c;
    this.tint.setRGB(k[0], k[1], k[2]);
    for (const m of this.tinted) { const base = m.userData.base; if (base) m.color.copy(base).multiply(this.tint); else m.color.copy(this.tint); }
    if (this.nightGroup) this.nightGroup.visible = !indoorOrCave && this.night > 0.5;
    if (this.glows) this.glows.visible = !indoorOrCave && this.night > 0.5;
  }

  /* ---------------- image ---------------- */
  update(dt, fx, fy) {
    this.ensureChunks(fx, fy);
    this.animT += dt;
    if (this.animT > 0.28) {
      this.animT = 0; this.animFrame = (this.animFrame + 1) % this.N.frames.length;
      const ctx = this.N.canvas.getContext('2d'); ctx.clearRect(0, 0, this.N.canvas.width, this.N.canvas.height); ctx.drawImage(this.N.frames[this.animFrame], 0, 0); this.texN.needsUpdate = true;
    }
    this.focus.set(fx + 0.5, 0, fy + 0.5);
    const d = this.dist;
    this.camera.position.set(this.focus.x, d * Math.sin(EL), this.focus.z + d * Math.cos(EL));
    if (this.shake > 0) { this.camera.position.x += (Math.random() - 0.5) * this.shake; this.camera.position.y += (Math.random() - 0.5) * this.shake; this.shake *= 0.85; if (this.shake < 0.01) this.shake = 0; }
    this.camera.lookAt(this.focus.x, 0, this.focus.z);
  }
  render() { this.renderer.render(this.scene, this.camera); }
  /** position à l'écran (pixels CSS) d'un point de la carte, h = hauteur en pixels de sprite ; null s'il est hors champ */
  screenPos(x, y, h = 34) {
    const v = new THREE.Vector3(x + 0.5, h * HPX, y + 0.55).project(this.camera);
    if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    return { left: r.left + (v.x + 1) / 2 * r.width, top: r.top + (1 - v.y) / 2 * r.height };
  }
}
