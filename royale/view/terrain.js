// Le sol de l'île : des dalles de 100 m dont la finesse dépend de la distance (2, 4, 10 ou 20 m entre deux points),
// bordées d'une jupe qui cache les raccords. Les couleurs viennent d'une image du sol cuite une fois (herbe, sous-bois,
// sable, roche, neige, fonds sous l'eau) ; le shader y ajoute le grain de l'herbe, du sable ou de la roche et la roche
// sur les pentes fortes. Les routes, rues, places et champs sont des rubans posés sur le relief.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { SNOW, CELL } from '../engine/map.js';
import { grassTexture, sandTexture } from './textures.js';

const CH = 100;                 // côté d'une dalle (m)
const LODS = [2, 4, 10, 20];    // pas du maillage selon la distance (diviseurs de CH)
const LOD_D = [190, 420, 850];  // distances de bascule (m)
const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const GROUND_COLORS = {
  grass: hex(0x5f9536), grass2: hex(0x77a443), dry: hex(0x8f9a4a), forest: hex(0x46702c), sand: hex(0xe3d3a1), wet: hex(0xb8ad83), rock: hex(0x9d978b),
  snow: hex(0xeef1f5), bed: hex(0xc6b487), yard: hex(0x6c9f3e), gravel: hex(0xb9b1a0), dirt: hex(0xa88d64),
};

// image du sol, un texel par point de la grille des hauteurs. Alpha : grain à appliquer (0 herbe, 0,5 sable, 1 roche)
function groundImage(map) {
  const N = map.n, HR = map.hres, H = map.heights, WK = map.water, WL = map.waterLevel, E = map.inland, M = map.mountain;
  const data = new Uint8Array(N * N * 4), C = GROUND_COLORS;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = i * HR, z = j * HR, h = H[k];
    let c, a = 0;
    if (WK[k]) { c = mix3(C.bed, mix3(C.bed, [0.36, 0.42, 0.36], 0.6), ss(0, 6, WL[k] - h)); a = 0.5; }
    else {
      const f = map.forestAt(x, z);
      // prés : deux verts et des taches d'herbe plus sèche, à grande échelle
      c = mix3(C.grass, C.grass2, ss(-0.5, 0.8, Math.sin(x * 0.021) * Math.cos(z * 0.017) + Math.sin((x + z) * 0.008)) * 0.7);
      c = mix3(c, C.dry, ss(0.35, 0.9, Math.sin(x * 0.0061 + 1.3) * Math.cos(z * 0.0073 - 0.4) + 0.4 * Math.sin((x - z) * 0.013)) * 0.45);
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
    // rives : le sol s'assombrit et s'humidifie à l'approche de l'eau
    if (!WK[k]) {
      let wet = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (j + dj) * N + i + di; if (q >= 0 && q < N * N && WK[q]) wet = 1; }
      if (wet) { c = mix3(c, C.wet, 0.55); a = Math.max(a, 0.5); }
    }
    const o = k * 4;
    data[o] = c[0] * 255; data[o + 1] = c[1] * 255; data[o + 2] = c[2] * 255; data[o + 3] = a * 255;
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

// ------------------------------------------------------------------ rubans : routes, rues, places, champs
function roadTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  // enrobé gris, grain, bandes blanches en bordure, tirets au centre
  g.fillStyle = '#6f6e6b'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 1400; i++) { const v = 90 + Math.random() * 40; g.fillStyle = `rgba(${v},${v},${v - 4},.35)`; g.fillRect(Math.random() * 64, Math.random() * 256, 1.5, 1.5); }
  g.fillStyle = 'rgba(236,236,228,.85)'; g.fillRect(3, 0, 2, 256); g.fillRect(59, 0, 2, 256);
  g.fillStyle = 'rgba(240,240,232,.9)'; g.fillRect(31, 20, 2.5, 90); g.fillRect(31, 148, 2.5, 90);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function dirtTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b39468'; g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 900; i++) { const v = Math.random(); g.fillStyle = v < 0.5 ? 'rgba(120,92,58,.35)' : 'rgba(214,190,150,.35)'; g.fillRect(Math.random() * 64, Math.random() * 128, 2, 2); }
  // ornières plus sombres, bords qui se fondent dans l'herbe
  g.fillStyle = 'rgba(110,84,52,.35)'; g.fillRect(16, 0, 7, 128); g.fillRect(41, 0, 7, 128);
  const grd = g.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, 'rgba(110,150,70,.8)'); grd.addColorStop(0.12, 'rgba(110,150,70,0)'); grd.addColorStop(0.88, 'rgba(110,150,70,0)'); grd.addColorStop(1, 'rgba(110,150,70,.8)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function pavedTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#cfc7b6'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(120,110,95,.45)'; g.lineWidth = 1.5;
  for (let y = 0; y < 128; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); for (let x = (y / 16) % 2 ? 8 : 0; x < 128; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
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
  const road = roadTexture(), dirt = dirtTexture(), paved = pavedTexture();
  textures.push(road, dirt, paved);
  const mRoad = decalMat(road), mDirt = decalMat(dirt), mPaved = decalMat(paved), mStreet = decalMat(road);
  mats.push(mRoad, mDirt, mPaved, mStreet);
  // rubans le long des routes : hauteur prise sur le relief à chaque bord (ou sur le tablier des ponts)
  const ribbon = (list, matFor) => {
    const by = new Map();
    for (const r of list) {
      const P = r.pts, pos = [], uv = [], idx = [];
      let dist = 0;
      for (let i = 0; i < P.length; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
        let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        if (i > 0) dist += Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z);
        for (const sd of [-1, 1]) {
          const x = P[i].x - tz * r.hw * sd, z = P[i].z + tx * r.hw * sd;
          const y = P[i].bridge ? P[i].y + 0.06 : hAt(x, z) + 0.07;
          pos.push(x, y, z); uv.push(sd < 0 ? 0 : 1, dist / (r.hw * 4));
        }
        if (i < P.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = matFor(r);
      if (!by.has(m)) by.set(m, []);
      by.get(m).push(g);
    }
    for (const [m, geos] of by) for (const g of geos) { const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; group.add(mesh); }
  };
  ribbon(map.roads.filter((r) => r.pts.length > 1), (r) => (r.kind === 'route' ? mRoad : mDirt));
  // rues et places : des dalles plates au niveau du plateau de la ville
  const flat = (rect, m, uvScale, along) => {
    const w = rect.x1 - rect.x0, d = rect.z1 - rect.z0, y = hAt((rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2) + 0.07;
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate((rect.x0 + rect.x1) / 2, y, (rect.z0 + rect.z1) / 2);
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) {
      const u = uvA.getX(i), v = uvA.getY(i);
      if (along === 'x') uvA.setXY(i, v, u * w / uvScale); else if (along === 'z') uvA.setXY(i, u, v * d / uvScale); else uvA.setXY(i, u * w / uvScale, v * d / uvScale);
    }
    const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; group.add(mesh);
  };
  for (const st of map.streets) flat(st, mStreet, 32, st.x1 - st.x0 > st.z1 - st.z0 ? 'x' : 'z');
  for (const p of map.plazas) flat(p, mPaved, 4);
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
