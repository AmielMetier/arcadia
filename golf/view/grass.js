// Birdie Party — l'herbe en 3D autour de la caméra : des touffes (deux cartes croisées, une quarantaine de brins
// dessinés) posées sur le relief, par dalles de 12 m construites à la demande et libérées quand on s'éloigne.
// Hauteur et couleur suivent la surface : courte dans la première coupe, haute dans le rough, sombre dans le sous-bois ;
// rien sur le fairway, le départ, le green, le sable, l'eau ni la roche. Elles se balancent au vent et s'effacent
// au bord du champ.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { makeRng } from '../engine/rng.js';
import { tuftTexture } from './textures.js';

const TILE = 12;
// par type d'herbe : touffes par m², hauteur et largeur min/max (m) ; rien sur le fairway, le départ ni le green
const KINDS = {
  cut: { dens: 6, h: [0.09, 0.15], w: [0.2, 0.3] },
  rough: { dens: 10, h: [0.16, 0.28], w: [0.24, 0.38] },
  out: { dens: 8, h: [0.24, 0.42], w: [0.3, 0.48] },
};

export function createGrass(hole, look, { mobile = false, sway }) {
  const R = mobile ? 22 : 38;
  const dens = mobile ? 0.5 : 1;
  const group = new THREE.Group();
  const tiles = new Map();
  const U = { uFocus: { value: new THREE.Vector3() }, uR: { value: R } };
  const tex = tuftTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.5, alphaToCoverage: true, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, sway, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBend; attribute float aGround; uniform float uT; uniform float uWind; uniform vec3 uFocus; uniform float uR;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // le brin plie au vent (plus fort à la pointe) et rentre dans le sol au bord du champ
        float wv = sin(uT * 2.3 + transformed.x * 0.8 + transformed.z * 0.5) + 0.5 * sin(uT * 3.7 + transformed.z * 1.3);
        transformed.x += wv * aBend * (0.012 + uWind * 0.05);
        transformed.z += cos(uT * 1.9 + transformed.x * 0.6) * aBend * (0.008 + uWind * 0.03);
        float fade = smoothstep(uR, uR * 0.72, distance(transformed.xz, uFocus.xz));
        transformed.y = aGround + (transformed.y - aGround) * fade;`);
    // les deux faces d'une touffe sont éclairées pareil (pas de dos sombre)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal); nonPerturbedNormal = normal;');
  };
  mat.customProgramCacheKey = () => 'golf-grass-2';

  const col = (h) => new THREE.Color(h);
  const C = {
    cut: [col(look.cut), col(look.fair2)],
    rough: [col(look.rough), col(look.rough2)], out: [col(look.out1), col(look.out2)],
  };
  const lv = hole.waterLv, coast = hole.coast;

  // nature de l'herbe en un point (null : pas d'herbe)
  function kindAt(x, z, h, f) {
    if (f.wd < 1.6 && h < lv[f.wi] + 0.25) return null;
    if (coast && (h < coast.level + 0.4 || f.sd < coast.beach + 1.5)) return null;
    if (f.ri >= 0 && f.rv < hole.ravines[f.ri].w * 0.55) return null;
    if (f.bd < 1.04 || f.gd < 1.03) return null;
    if (f.td < 1.2 || f.gd < 1.18 || f.fm > -0.3) return null;
    if (f.fm > -2.4) return 'cut';
    if (hole.centerDist(x, z) > hole.valley + 14 || x < hole.bounds.x0 || x > hole.bounds.x1 || z < hole.bounds.z0 || z > hole.bounds.z1) return 'out';
    return 'rough';
  }

  function buildTile(tx, tz) {
    const x0 = tx * TILE, z0 = tz * TILE, N = TILE * 2; // grille de 0,5 m
    const hs = new Float32Array((N + 1) * (N + 1)), ks = new Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = x0 + i * 0.5, z = z0 + j * 0.5, f = hole.fields(x, z), h = hole.heightF(x, z, f);
      hs[j * (N + 1) + i] = h; ks[j * (N + 1) + i] = kindAt(x, z, h, f);
    }
    const r = makeRng((tx * 73856093) ^ (tz * 19349663) ^ hole.def.seed);
    const pos = [], colr = [], bend = [], gnd = [], nor = [], uv = [], idx = [];
    const c0 = new THREE.Color(), c1 = new THREE.Color();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = ks[j * (N + 1) + i]; if (!k) continue;
      const h00 = hs[j * (N + 1) + i], h10 = hs[j * (N + 1) + i + 1], h01 = hs[(j + 1) * (N + 1) + i], h11 = hs[(j + 1) * (N + 1) + i + 1];
      // pas d'herbe sur les pentes raides (roche)
      if (Math.max(Math.abs(h10 - h00), Math.abs(h01 - h00), Math.abs(h11 - h00)) > 0.6) continue;
      const K = KINDS[k], n = Math.floor(K.dens * 0.25 * dens + r.next());
      for (let b = 0; b < n; b++) {
        const u = r.next(), v = r.next(), x = x0 + (i + u) * 0.5, z = z0 + (j + v) * 0.5;
        const y = h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v - 0.02;
        const sc = 0.65 + 0.75 * r.next() * r.next(), hb = (K.h[0] + (K.h[1] - K.h[0]) * r.next()) * sc, w = (K.w[0] + (K.w[1] - K.w[0]) * r.next()) * 0.5 * sc;
        const vq = Math.floor(r.next() * 4), u0 = (vq % 2) * 0.5, v0 = Math.floor(vq / 2) * 0.5;
        const pal = C[k], m = r.next(), lum = 0.92 + 0.26 * r.next();
        c0.copy(pal[0]).lerp(pal[1], m).multiplyScalar(lum);
        c1.copy(c0).multiplyScalar(1.2);
        const a0 = r.next() * Math.PI;
        // deux cartes croisées
        for (const a of [a0, a0 + Math.PI / 2]) {
          const ca = Math.cos(a) * w, sa = Math.sin(a) * w, b0 = pos.length / 3;
          pos.push(x - ca, y, z - sa, x + ca, y, z + sa, x + ca, y + hb, z + sa, x - ca, y + hb, z - sa);
          uv.push(u0, 1 - v0 - 0.5, u0 + 0.5, 1 - v0 - 0.5, u0 + 0.5, 1 - v0, u0, 1 - v0);
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

  // garde les dalles autour du point regardé ; `budget` dalles construites au plus par appel
  function update(focus, budget = 2) {
    U.uFocus.value.copy(focus);
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
    for (const [k, t] of tiles) if (!keep.has(k) && t) { group.remove(t); t.geometry.dispose(); tiles.delete(k); } else if (!keep.has(k)) tiles.delete(k);
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
    dispose() { for (const t of tiles.values()) if (t) t.geometry.dispose(); tiles.clear(); mat.dispose(); tex.dispose(); },
  };
}
