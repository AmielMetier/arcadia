// L'herbe en 3D autour du joueur (reprise de Birdie Party) : des touffes de brins (deux cartes croisées) et des fleurs
// des prés (marguerites, boutons d'or, lavande, coquelicots), posées sur le relief par dalles de 16 m construites à la
// demande et libérées quand on s'éloigne. La couleur vient de l'image du sol (view/terrain.js) : l'herbe a la teinte
// du pré sur lequel elle pousse. Haute dans les prés, éparse en forêt, rase en montagne et dans les cours ; rien sur
// le sable, la roche, la neige, le gravier, l'eau, les champs, les routes, les rues, les allées ni sous les bâtiments.
// Elle se balance au vent et rentre dans le sol au bord du champ de vision.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { makeRng } from '../engine/rng.js';
import { GR, OC } from '../engine/map.js';
import { tuftTexture } from './textures.js';
import { SWAY } from './trees.js';

const TILE = 16;
// touffes par m², hauteur et demi-largeur (m), part de fleurs, éclat
const KINDS = {
  pre: { dens: 7, h: [0.22, 0.45], w: [0.34, 0.54], flowers: 0.07, lum: 1 },
  bois: { dens: 3.5, h: [0.24, 0.46], w: [0.34, 0.5], flowers: 0.015, lum: 0.92 },
  mont: { dens: 2.6, h: [0.12, 0.24], w: [0.26, 0.38], flowers: 0.05, lum: 1 },
  cour: { dens: 3, h: [0.1, 0.18], w: [0.26, 0.36], flowers: 0.03, lum: 1.05 },
};
const NONE = new Set([GR.MER, GR.LAC, GR.RIVIERE, GR.BATI, GR.CHAMP, GR.ROCHE, GR.NEIGE, GR.PLAGE]);
const BARE = new Set([OC.BUILD, OC.STREET, OC.FIELD, OC.DOCK, OC.PLAZA]);

// atlas 1024 × 512 : à gauche les quatre touffes (tons neutres, teintées par la couleur du sol), à droite quatre
// bouquets de fleurs en couleurs
function atlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'), tufts = tuftTexture(512);
  g.drawImage(tufts.image, 0, 0); tufts.dispose();
  let s = 977;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const blob = (x, y, rx, ry, a, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill(); };
  for (let q = 0; q < 4; q++) {
    const ox = 512 + (q % 2) * 256, oy = Math.floor(q / 2) * 256, base = oy + 256;
    // quelques brins au pied
    for (let i = 0; i < 14; i++) {
      const x0 = ox + 128 + (r() - 0.5) * 150, h = 50 + r() * 70, lean = (r() - 0.5) * 40;
      g.strokeStyle = `rgb(${70 + r() * 30},${120 + r() * 35},${50 + r() * 20})`; g.lineWidth = 3 + r() * 3;
      g.beginPath(); g.moveTo(x0, base); g.quadraticCurveTo(x0 + lean * 0.3, base - h * 0.6, x0 + lean, base - h); g.stroke();
    }
    const n = q === 2 ? 7 : 6 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const x0 = ox + 128 + (r() - 0.5) * 170, h = 110 + r() * 110, lean = (r() - 0.5) * 50, x1 = x0 + lean, y1 = base - h;
      g.strokeStyle = '#4c7f35'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x0, base); g.quadraticCurveTo(x0 + lean * 0.2, base - h * 0.5, x1, y1); g.stroke();
      blob(x0 + lean * 0.15 + 7, base - h * 0.35, 8, 3, -0.5, '#5a9440');
      if (q === 0) {
        // marguerite
        for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; blob(x1 + Math.cos(a) * 9, y1 + Math.sin(a) * 6, 7, 3, a, '#f7f5ec'); }
        blob(x1, y1, 4.5, 3.5, 0, '#f2c21b');
      } else if (q === 1) {
        // bouton d'or
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; blob(x1 + Math.cos(a) * 5, y1 + Math.sin(a) * 4, 6, 4, a, '#ffd21f'); }
        blob(x1, y1, 3, 3, 0, '#e0a810');
      } else if (q === 2) {
        // lavande : un épi de petites fleurs
        for (let k = 0; k < 9; k++) blob(x1 + (r() - 0.5) * 4, y1 + k * 5, 4.5, 3.5, 0, k % 2 ? '#9a74d6' : '#7f5bc4');
      } else {
        // coquelicot
        blob(x1 - 6, y1, 9, 8, 0.3, '#e0352b'); blob(x1 + 6, y1, 9, 8, -0.3, '#d82a22'); blob(x1, y1 - 4, 9, 7, 0, '#ee4535');
        blob(x1, y1 + 1, 3.5, 3, 0, '#2a1a1a');
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createGrass(map, ground, { mobile = false } = {}) {
  let R = mobile ? 22 : 36;
  const dens = mobile ? 0.5 : 1;
  const group = new THREE.Group(), tiles = new Map();
  // ce qui couche l'herbe : les personnages qui la traversent, le souffle des explosions (x, z, rayon, force)
  const PUSH = 8;
  const U = { uFocus: { value: new THREE.Vector3() }, uR: { value: R }, uPush: { value: Array.from({ length: PUSH }, () => new THREE.Vector4()) } };
  const tex = atlas();
  const mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.5, alphaToCoverage: true, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SWAY, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aBend; attribute float aGround; uniform float uT; uniform float uWind; uniform vec3 uFocus; uniform float uR; uniform vec4 uPush[${PUSH}];`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // le brin plie au vent (plus fort à la pointe) et rentre dans le sol au bord du champ
        float wv = sin(uT * 2.3 + transformed.x * 0.8 + transformed.z * 0.5) + 0.5 * sin(uT * 3.7 + transformed.z * 1.3);
        transformed.x += wv * aBend * (0.012 + uWind * 0.05);
        transformed.z += cos(uT * 1.9 + transformed.x * 0.6) * aBend * (0.008 + uWind * 0.03);
        // couché par qui passe (ou par un souffle) : la pointe s'écarte et descend
        for (int i = 0; i < ${PUSH}; i++) {
          vec4 p = uPush[i];
          if (p.w <= 0.0) continue;
          vec2 d = transformed.xz - p.xy;
          float l = length(d), k = p.w * aBend * (1.0 - smoothstep(p.z * 0.35, p.z, l));
          if (k <= 0.0) continue;
          transformed.xz += (l > 0.001 ? d / l : vec2(0.0)) * k * 0.32;
          transformed.y -= (transformed.y - aGround) * k * 0.6;
        }
        float fade = smoothstep(uR, uR * 0.72, distance(transformed.xz, uFocus.xz));
        transformed.y = aGround + (transformed.y - aGround) * fade;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal); nonPerturbedNormal = normal;');
  };
  mat.customProgramCacheKey = () => 'royale-grass';

  const img = ground.image, NI = img.width, D = img.data, HR = map.hres, CELL = map.cell, GN = map.gn;
  const texel = (x, z) => (Math.min(NI - 1, Math.max(0, Math.round(z / HR))) * NI + Math.min(NI - 1, Math.max(0, Math.round(x / HR)))) * 4;
  const cellOf = (x, z) => Math.min(GN - 1, Math.max(0, Math.floor(z / CELL))) * GN + Math.min(GN - 1, Math.max(0, Math.floor(x / CELL)));
  // routes : on laisse la chaussée et l'accotement dégagés
  const segs = [];
  for (const r of map.roads) for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1], b = r.pts[i], m = r.hw + (r.kind === 'route' ? 1.1 : 0.4);
    segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, m, x0: Math.min(a.x, b.x) - m, x1: Math.max(a.x, b.x) + m, z0: Math.min(a.z, b.z) - m, z1: Math.max(a.z, b.z) + m });
  }
  const segDist = (s, x, z) => {
    const dx = s.bx - s.ax, dz = s.bz - s.az, l = dx * dx + dz * dz;
    const t = l ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l)) : 0;
    return Math.hypot(x - s.ax - dx * t, z - s.az - dz * t);
  };
  function kindAt(x, z) {
    if (D[texel(x, z) + 3] > 90) return null; // sable, gravier, roche, neige, berges
    const c = cellOf(x, z);
    if (BARE.has(map.occ[c]) || NONE.has(map.ground[c]) || map.waterAt(x, z)) return null;
    const g = map.ground[c];
    return g === GR.FORET ? 'bois' : g === GR.MONTAGNE ? 'mont' : g === GR.VILLE || g === GR.LIEU ? 'cour' : 'pre';
  }

  const col = new THREE.Color(), c0 = new THREE.Color(), c1 = new THREE.Color();
  function buildTile(tx, tz) {
    const x0 = tx * TILE, z0 = tz * TILE, N = TILE * 2; // grille de 0,5 m
    const near = segs.filter((s) => s.x1 > x0 && s.x0 < x0 + TILE && s.z1 > z0 && s.z0 < z0 + TILE);
    const paved = (map.paths || []).filter((p) => p.x1 > x0 && p.x0 < x0 + TILE && p.z1 > z0 && p.z0 < z0 + TILE);
    const hs = new Float32Array((N + 1) * (N + 1)), ks = new Array(N * N);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) hs[j * (N + 1) + i] = map.heightAt(x0 + i * 0.5, z0 + j * 0.5);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) ks[j * N + i] = kindAt(x0 + (i + 0.5) * 0.5, z0 + (j + 0.5) * 0.5);
    const r = makeRng((tx * 73856093) ^ (tz * 19349663) ^ map.seed);
    const pos = [], colr = [], bend = [], gnd = [], nor = [], uv = [], idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = ks[j * N + i]; if (!k) continue;
      const h00 = hs[j * (N + 1) + i], h10 = hs[j * (N + 1) + i + 1], h01 = hs[(j + 1) * (N + 1) + i], h11 = hs[(j + 1) * (N + 1) + i + 1];
      if (Math.max(Math.abs(h10 - h00), Math.abs(h01 - h00), Math.abs(h11 - h00)) > 0.45) continue;
      const K = KINDS[k], n = Math.floor(K.dens * 0.25 * dens + r.next());
      for (let b = 0; b < n; b++) {
        const u = r.next(), v = r.next(), x = x0 + (i + u) * 0.5, z = z0 + (j + v) * 0.5;
        if (near.length && near.some((s) => segDist(s, x, z) < s.m)) continue;
        if (paved.length && paved.some((p) => x > p.x0 - 0.15 && x < p.x1 + 0.15 && z > p.z0 - 0.15 && z < p.z1 + 0.15)) continue;
        const y = h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v - 0.02;
        const flower = r.next() < K.flowers;
        const sc = 0.65 + 0.75 * r.next() * r.next();
        const hb = (flower ? 0.42 + 0.2 * r.next() : K.h[0] + (K.h[1] - K.h[0]) * r.next()) * sc, w = (K.w[0] + (K.w[1] - K.w[0]) * r.next()) * (flower ? 0.6 : 0.5) * sc;
        const vq = Math.floor(r.next() * 4), u0 = (flower ? 0.5 : 0) + (vq % 2) * 0.25, v0 = Math.floor(vq / 2) * 0.5;
        const lum = K.lum * (0.9 + 0.25 * r.next());
        if (flower) { c0.setRGB(0.8, 0.8, 0.8).multiplyScalar(lum); c1.setRGB(1, 1, 1).multiplyScalar(lum); }
        else {
          const o = texel(x, z);
          col.setRGB(D[o] / 255, D[o + 1] / 255, D[o + 2] / 255, THREE.SRGBColorSpace);
          c0.copy(col).multiplyScalar(1.3 * lum); c1.copy(col).multiplyScalar(1.8 * lum);
        }
        const a0 = r.next() * Math.PI;
        // deux cartes croisées
        for (const a of [a0, a0 + Math.PI / 2]) {
          const ca = Math.cos(a) * w, sa = Math.sin(a) * w, b0 = pos.length / 3;
          pos.push(x - ca, y, z - sa, x + ca, y, z + sa, x + ca, y + hb, z + sa, x - ca, y + hb, z - sa);
          uv.push(u0, 1 - v0 - 0.5, u0 + 0.25, 1 - v0 - 0.5, u0 + 0.25, 1 - v0, u0, 1 - v0);
          colr.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b, c1.r, c1.g, c1.b);
          bend.push(0, 0, 1, 1); gnd.push(y, y, y, y);
          nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
          idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
        }
      }
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aBend', new THREE.Float32BufferAttribute(bend, 1));
    g.setAttribute('aGround', new THREE.Float32BufferAttribute(gnd, 1));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    return m;
  }

  // garde les dalles autour du joueur ; `budget` dalles construites au plus par appel
  function update(focus, budget = 2) {
    U.uFocus.value.set(focus.x, focus.y, focus.z);
    const cx = Math.floor(focus.x / TILE), cz = Math.floor(focus.z / TILE), rr = Math.ceil(R / TILE);
    const want = [];
    for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) {
      const tx = cx + i, tz = cz + j;
      const dx = Math.max(0, Math.abs((tx + 0.5) * TILE - focus.x) - TILE / 2), dz = Math.max(0, Math.abs((tz + 0.5) * TILE - focus.z) - TILE / 2);
      const d = Math.hypot(dx, dz);
      if (d < R) want.push({ key: tx + ',' + tz, tx, tz, d });
    }
    want.sort((a, b) => a.d - b.d);
    const keep = new Set(want.map((w) => w.key));
    for (const [k, t] of tiles) if (!keep.has(k)) { if (t) { group.remove(t); t.geometry.dispose(); } tiles.delete(k); }
    for (const w of want) {
      if (budget <= 0) break;
      if (tiles.has(w.key)) continue;
      const m = buildTile(w.tx, w.tz);
      tiles.set(w.key, m); if (m) group.add(m);
      budget--;
    }
  }
  return {
    group, update,
    get range() { return R; },
    // list : [{ x, z, r, k }] (les plus proches d'abord, huit au plus)
    push(list) {
      for (let i = 0; i < PUSH; i++) { const p = list[i]; if (p) U.uPush.value[i].set(p.x, p.z, p.r, p.k); else U.uPush.value[i].set(0, 0, 0, 0); }
    },
    // machine qui peine : l'herbe s'arrête plus près
    shrink() { R = Math.max(18, R * 0.7); U.uR.value = R; },
    dispose() { for (const t of tiles.values()) if (t) t.geometry.dispose(); tiles.clear(); mat.dispose(); tex.dispose(); },
  };
}
