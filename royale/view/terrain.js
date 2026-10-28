// Le sol de l'île : des dalles de 100 m dont la finesse dépend de la distance (2, 4, 10 ou 20 m entre deux points),
// bordées d'une jupe qui cache les raccords. Les couleurs viennent d'une image du sol cuite une fois (herbe, sous-bois,
// sable, roche, neige, fonds sous l'eau) ; le shader y ajoute le grain de l'herbe, du sable ou de la roche et la roche
// sur les pentes fortes. Les champs sont des nappes posées sur le relief (routes, rues et places : view/roads.js).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { SNOW, CELL } from '../engine/map.js';
import { grassTexture, sandTexture } from './textures.js';
import { makeNoise } from '../engine/noise.js';

const CH = 100;                 // côté d'une dalle (m)
const LODS = [2, 4, 10, 20];    // pas du maillage selon la distance (diviseurs de CH)
const LOD_D = [190, 420, 850];  // distances de bascule (m)
const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const GROUND_COLORS = {
  grass: hex(0x5f9536), grass2: hex(0x77a443), dry: hex(0x8f9a4a), forest: hex(0x46702c), sand: hex(0xe3d3a1), wet: hex(0xb8ad83), rock: hex(0x9d978b),
  snow: hex(0xeef1f5), bed: hex(0xc6b487), yard: hex(0x6c9f3e), gravel: hex(0xb9b1a0), dirt: hex(0xa88d64),
  // prairies fleuries (vues du ciel : des taches de couleur dans les prés)
  buttercup: hex(0xc9c24a), lavender: hex(0x8f86b8), daisy: hex(0xd9dccb), clover: hex(0x4f8a3a),
  hedge: hex(0x355f27),
};
// parcelles de la campagne (vues du ciel) : teintes de pré, de foin, de regain
const PARCELS = [hex(0x86b04e), hex(0xb5ad60), hex(0x4f8a36), hex(0x9fb24a), hex(0x6f9c3f), hex(0xa7a05a)];
const ihash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

// image du sol, un texel par point de la grille des hauteurs. Alpha : grain à appliquer (0 herbe, 0,5 sable, 1 roche)
function groundImage(map) {
  const N = map.n, HR = map.hres, H = map.heights, WK = map.water, WL = map.waterLevel, E = map.inland, M = map.mountain;
  const data = new Uint8Array(N * N * 4), C = GROUND_COLORS, nz = makeNoise((map.seed | 0) ^ 0x6f1e);
  const fbm = (x, z) => nz.n2(x, z) * 0.65 + nz.n2(x * 2.3 + 17, z * 2.3 - 9) * 0.35;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = i * HR, z = j * HR, h = H[k];
    let c, a = 0;
    if (WK[k]) { c = mix3(C.bed, mix3(C.bed, [0.36, 0.42, 0.36], 0.6), ss(0, 6, WL[k] - h)); a = 0.5; }
    else {
      const f = map.forestAt(x, z);
      // prés : deux verts et des taches d'herbe plus sèche, à grande échelle
      c = mix3(C.grass, C.grass2, ss(-0.5, 0.8, Math.sin(x * 0.021) * Math.cos(z * 0.017) + Math.sin((x + z) * 0.008)) * 0.7);
      c = mix3(c, C.dry, ss(0.35, 0.9, Math.sin(x * 0.0061 + 1.3) * Math.cos(z * 0.0073 - 0.4) + 0.4 * Math.sin((x - z) * 0.013)) * 0.45);
      // prés fleuris et trèfle, en taches de 20 à 60 m, loin des bois et des lieux
      const open = (1 - ss(0.1, 0.4, f)) * ss(3, 6, h);
      if (open > 0) {
        const fl = fbm(x / 70, z / 70), kind = nz.n2(x / 260 + 40, z / 260 - 13);
        const flower = kind > 0.25 ? C.lavender : kind < -0.25 ? C.daisy : C.buttercup;
        c = mix3(c, flower, ss(0.32, 0.62, fl) * 0.5 * open);
        c = mix3(c, C.clover, ss(0.3, 0.7, -fl) * 0.35 * open);
        // marqueterie de parcelles bordées de haies, hors montagne ; chaque domaine de 360 m a son orientation
        const farm = open * (1 - ss(0.04, 0.2, M[k])) * ss(-0.35, 0.05, nz.n2(x / 420 - 7, z / 420 + 3));
        if (farm > 0) {
          const th = (ihash(Math.floor(x / 360) + 91, Math.floor(z / 360) - 37) % 1000) / 1000 * Math.PI / 2;
          const u = x * Math.cos(th) + z * Math.sin(th), w = -x * Math.sin(th) + z * Math.cos(th);
          const iu = Math.floor(u / 56), iw = Math.floor(w / 40), hh = ihash(iu, iw), fu = u / 56 - iu, fw = w / 40 - iw;
          if (hh % 10 < 7) c = mix3(c, PARCELS[hh % PARCELS.length], 0.5 * farm);
          const eu = Math.min(fu, 1 - fu) * 56, ew = Math.min(fw, 1 - fw) * 40;
          const hedge = Math.max((hh >> 4) % 4 ? ss(1.8, 0.6, eu) : 0, (hh >> 6) % 3 ? ss(1.8, 0.6, ew) : 0);
          c = mix3(c, C.hedge, hedge * 0.75 * farm);
        }
      }
      c = mix3(c, C.forest, ss(0.2, 0.6, f) * 0.8);
      const poi = map.poiAt(x, z);
      if (poi) {
        if (poi.town) c = mix3(c, C.yard, 0.5);
        else if (poi.kind === 'usine' || poi.kind === 'carriere' || poi.kind === 'station') { c = mix3(c, C.gravel, 0.85); a = 0.75; }
        else if (poi.kind === 'ferme' || poi.kind === 'scierie' || poi.kind === 'camping') { c = mix3(c, C.dirt, 0.45); a = 0.3; }
      }
      // plage, berges humides
      const beach = ss(2.8, 1.3, h) * ss(20, 8, E[k]);
      if (beach > 0) { c = mix3(c, C.sand, beach); a = Math.max(a, 0.5 * beach); }
      // roche en altitude, neige au sommet
      const m = M[k], rk = ss(30, 70, h) * ss(0.12, 0.4, m);
      if (rk > 0) { c = mix3(c, C.rock, rk); a = Math.max(a, rk); }
      const sn = ss(SNOW - 6, SNOW + 2, h);
      if (sn > 0) { c = mix3(c, C.snow, sn); a = Math.max(a, sn * 0.9); }
    }
    // relief lisible du ciel : creux plus sombres, crêtes plus claires (écart à la moyenne alentour, à 6 et 18 m)
    if (!WK[k]) {
      const at = (di, dj) => H[Math.min(N - 1, Math.max(0, j + dj)) * N + Math.min(N - 1, Math.max(0, i + di))];
      const cav = (r) => (at(r, 0) + at(-r, 0) + at(0, r) + at(0, -r)) / 4 - h;
      const cv = cav(3) * 0.6 + cav(9) * 0.4, sh = cv > 0 ? 1 - Math.min(0.2, cv * 0.09) : 1 + Math.min(0.08, -cv * 0.04);
      c = [c[0] * sh, c[1] * sh, c[2] * sh];
    }
    // rives : le sol s'assombrit et s'humidifie à l'approche de l'eau
    if (!WK[k]) {
      let wet = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (j + dj) * N + i + di; if (q >= 0 && q < N * N && WK[q]) wet = 1; }
      if (wet) { c = mix3(c, C.wet, 0.55); a = Math.max(a, 0.5); }
    }
    const o = k * 4;
    data[o] = Math.min(255, c[0] * 255); data[o + 1] = Math.min(255, c[1] * 255); data[o + 2] = Math.min(255, c[2] * 255); data[o + 3] = a * 255;
  }
  const t = new THREE.DataTexture(data, N, N);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}

// matériau du sol : couleur de l'image + grain selon le terrain + roche sur les pentes
function groundMaterial(map, ground, noise, anisotropy) {
  const grass = grassTexture(), sand = sandTexture();
  grass.anisotropy = sand.anisotropy = anisotropy;
  const U = {
    uGround: { value: ground }, uGrass: { value: grass }, uSand: { value: sand }, uNoise: { value: noise },
    uN: { value: map.n }, uHR: { value: map.hres }, uRock: { value: new THREE.Color(0x9a948a) },
  };
  // double face : les jupes des dalles se voient des deux côtés
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW; varying vec3 vWN;
        uniform sampler2D uGround; uniform sampler2D uGrass; uniform sampler2D uSand; uniform sampler2D uNoise;
        uniform float uN; uniform float uHR; uniform vec3 uRock;`)
      .replace('#include <map_fragment>', `
        vec4 gc = texture2D(uGround, (vW.xz / uHR + 0.5) / uN);
        vec3 base = gc.rgb;
        float kind = gc.a;
        // grain : brins d'herbe, sable, roche (bruit), à deux échelles pour casser la répétition
        float gr = dot(texture2D(uGrass, vW.xz / 2.6).rgb, vec3(0.3, 0.59, 0.11)) / 0.42;
        float sd = dot(texture2D(uSand, vW.xz / 3.5).rgb, vec3(0.3, 0.59, 0.11)) / 0.75;
        float rk = texture2D(uNoise, vW.xz / 9.0).r * 0.55 + texture2D(uNoise, vW.xz / 2.1).g * 0.45;
        float det = mix(mix(gr, sd, smoothstep(0.15, 0.45, kind)), rk * 1.6, smoothstep(0.6, 0.95, kind));
        // pentes fortes : la roche affleure (pas sous la neige)
        float slope = 1.0 - vWN.y;
        float bare = smoothstep(0.42, 0.68, slope + (rk - 0.5) * 0.25);
        base = mix(base, uRock * (0.75 + 0.5 * rk), bare * (1.0 - step(0.98, kind) * 0.7));
        det = mix(det, rk * 1.6, bare);
        float macro = texture2D(uNoise, vW.xz / 210.0).b;
        // touffes et plaques d'herbe (7 et 21 m) : le pré garde du relief vu de haut, quand le grain fin s'efface
        float cl = texture2D(uNoise, vW.xz / 7.0).g * 0.6 + texture2D(uNoise, vW.xz / 21.0).r * 0.4;
        float isGrass = (1.0 - smoothstep(0.15, 0.45, kind)) * (1.0 - bare);
        base *= mix(1.0, 0.8 + 0.4 * cl, isGrass);
        base = mix(base, base * vec3(1.1, 1.05, 0.78), isGrass * smoothstep(0.58, 0.82, cl) * 0.55);
        diffuseColor.rgb = base * clamp(0.7 + 0.32 * det, 0.6, 1.2) * (0.84 + 0.28 * macro);`);
  };
  m.customProgramCacheKey = () => 'royale-ground';
  return { mat: m, textures: [ground, grass, sand] };
}

export function buildTerrain(map, { noise, anisotropy = 8 } = {}) {
  const S = map.size, N = map.n, HR = map.hres, H = map.heights;
  const ground = groundImage(map);
  const { mat, textures } = groundMaterial(map, ground, noise, anisotropy);
  const group = new THREE.Group();
  const nc = Math.ceil(S / CH);
  const hgt = (i, j) => H[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
  // une dalle par case de 100 m (sauf la haute mer, cachée par l'eau)
  const chunks = [];
  for (let cj = 0; cj < nc; cj++) for (let ci = 0; ci < nc; ci++) {
    const i0 = ci * CH / HR, j0 = cj * CH / HR, n = CH / HR;
    let hi = -Infinity;
    for (let j = j0; j <= j0 + n; j += 2) for (let i = i0; i <= i0 + n; i += 2) hi = Math.max(hi, hgt(i, j));
    if (hi < -5.5) continue;
    const c = { ci, cj, x: (ci + 0.5) * CH, z: (cj + 0.5) * CH, lod: -1, geos: [], mesh: null };
    chunks.push(c);
  }
  function geometry(c, lod) {
    const step = LODS[lod] / HR, n = CH / LODS[lod], i0 = c.ci * CH / HR, j0 = c.cj * CH / HR;
    const V = (n + 1) * (n + 1), skirt = 4 * (n + 1);
    const pos = new Float32Array((V + skirt) * 3), nor = new Float32Array((V + skirt) * 3);
    const idx = [];
    const put = (v, i, j, drop) => {
      const h = hgt(i, j);
      // normale tirée de la grille fine (même éclairage quel que soit le niveau de détail)
      const nx = hgt(i - 1, j) - hgt(i + 1, j), nz = hgt(i, j - 1) - hgt(i, j + 1), ny = 2 * HR, l = Math.hypot(nx, ny, nz);
      pos[v * 3] = i * HR; pos[v * 3 + 1] = h - drop; pos[v * 3 + 2] = j * HR;
      nor[v * 3] = nx / l; nor[v * 3 + 1] = ny / l; nor[v * 3 + 2] = nz / l;
    };
    for (let b = 0; b <= n; b++) for (let a = 0; a <= n; a++) put(b * (n + 1) + a, i0 + a * step, j0 + b * step, 0);
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
      const p = b * (n + 1) + a, q = p + 1, r = p + n + 1, s = r + 1;
      idx.push(p, r, q, q, r, s);
    }
    // jupe : un ruban qui descend de 3 m sous chaque bord
    let v = V;
    const edges = [[0, 0, 1, 0], [n, 0, 0, 1], [n, n, -1, 0], [0, n, 0, -1]];
    for (const [a0, b0, da, db] of edges) {
      const start = v;
      for (let t = 0; t <= n; t++) { const a = a0 + da * t, b = b0 + db * t; put(v++, i0 + a * step, j0 + b * step, 3); }
      for (let t = 0; t < n; t++) {
        const a = a0 + da * t, b = b0 + db * t, top0 = b * (n + 1) + a, top1 = (b + db) * (n + 1) + a + da;
        idx.push(top0, start + t, top1, top1, start + t, start + t + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }
  function setLod(c, lod) {
    if (c.lod === lod) return;
    if (!c.geos[lod]) c.geos[lod] = geometry(c, lod);
    if (!c.mesh) {
      c.mesh = new THREE.Mesh(c.geos[lod], mat);
      c.mesh.receiveShadow = true;
      c.mesh.userData.shared = true;
      group.add(c.mesh);
    } else c.mesh.geometry = c.geos[lod];
    c.lod = lod;
  }
  // bascule des niveaux de détail autour de la caméra ; budget : quelques dalles fines par image
  function update(cx, cz, budget = 3) {
    for (const c of chunks) {
      const d = Math.max(0, Math.hypot(c.x - cx, c.z - cz) - CH * 0.7);
      const want = d < LOD_D[0] ? 0 : d < LOD_D[1] ? 1 : d < LOD_D[2] ? 2 : 3;
      if (want === c.lod) continue;
      if (!c.geos[want]) { if (budget <= 0) continue; budget--; }
      setLod(c, want);
    }
  }
  for (const c of chunks) setLod(c, 3);
  return {
    group, mat, ground, update,
    dispose() { for (const c of chunks) for (const g of c.geos) g && g.dispose(); mat.dispose(); for (const t of textures) t.dispose(); },
  };
}

// ------------------------------------------------------------------ champs (les routes, rues et places : view/roads.js)
function cropTexture(a, b) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 64, 64);
  g.fillStyle = b; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 7, 64);
  for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(Math.random() * 64, Math.random() * 64, 1, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const decalMat = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, ...extra });

export function buildDecals(map) {
  const group = new THREE.Group(), textures = [], mats = [];
  const hAt = map.heightAt;
  // champs : posés sur le relief, rangs le long du grand côté
  const CROPS = { ble: ['#d9b94e', '#c4a23c'], mais: ['#9fb043', '#7f9233'], colza: ['#e8d434', '#a9b23a'] };
  for (const f of map.fields) {
    const t = cropTexture(...CROPS[f.crop]); textures.push(t);
    const m = decalMat(t, { polygonOffsetFactor: -1 }); mats.push(m);
    const w = f.x1 - f.x0, d = f.z1 - f.z0, nx = Math.round(w / 4), nz = Math.round(d / 4);
    const g = new THREE.PlaneGeometry(w, d, nx, nz).rotateX(-Math.PI / 2).translate((f.x0 + f.x1) / 2, 0, (f.z0 + f.z1) / 2);
    const p = g.attributes.position, uvA = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      p.setY(i, hAt(p.getX(i), p.getZ(i)) + 0.05);
      const u = (p.getX(i) - f.x0) / 4, v = (p.getZ(i) - f.z0) / 4;
      if (f.alongX) uvA.setXY(i, v, u); else uvA.setXY(i, u, v);
    }
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; group.add(mesh);
  }
  return {
    group,
    dispose() { group.traverse((o) => o.isMesh && o.geometry.dispose()); for (const m of mats) m.dispose(); for (const t of textures) t.dispose(); },
  };
}
export { CH, CELL };
