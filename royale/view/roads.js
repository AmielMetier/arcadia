// Routes, rues et places. Le revêtement vient de photos libres de droits (img/tex, Poly Haven, CC0) plaquées selon
// la position dans le monde : aucun raccord visible d'un tronçon à l'autre, et la photo est ramenée aux couleurs de
// l'île. Par-dessus, une couche dessinée suit chaque ruban : marquages usés, traces de pneus, trottoirs dallés,
// bordures et caniveaux, passages piétons, dallage des places.
// Rues de ville : trottoir, bordure, caniveau puis chaussée ; chaque carrefour est dessiné une seule fois (deux rues
// qui se croisent ne se superposent plus), bordures arrondies aux angles, trottoir continu du côté sans rue.
// Chemins de terre et accotements des routes : la terre se fond dans l'herbe, une bande d'herbe au milieu des chemins.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const PHOTO = 4;            // m couverts par une photo du revêtement
const PX = 64;              // pixels par mètre des couches dessinées
const LIFT = 0.07;          // hauteur au-dessus du relief
// profil en travers d'une rue (8 m) : trottoir, bordure, caniveau, puis la chaussée
const WALK = 1.0, CURB = 0.2, GUTTER = 0.25, EDGE = WALK + CURB + GUTTER;
const CW = 4;               // longueur d'un passage piéton (m)
const ROUTE_TILE = 10;      // motif des routes : un tiret de 3 m tous les 10 m
const STREET_TILE = 8;
const SHOULDER = 0.9;       // accotement en terre de part et d'autre des routes (m)
const N = 1, S = 2, W = 4, E = 8; // branches d'un carrefour

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const hash2 = (a, b) => { let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// ------------------------------------------------------------------ photos
async function photo(url, { normal = false, anisotropy, fallback }) {
  let t;
  try { t = await new THREE.TextureLoader().loadAsync(url); } catch (e) { if (normal) return null; t = new THREE.CanvasTexture(fallback()); }
  t.colorSpace = normal ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; t.channel = 1;
  return t;
}
// teinte moyenne (linéaire) d'une photo : on la ramène ensuite à la couleur voulue
function average(img) {
  const c = canvas(16, 16), g = c.getContext('2d');
  g.drawImage(img, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data, s = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += lin(d[i + k] / 255);
  return new THREE.Vector3(s[0] / 256, s[1] / 256, s[2] / 256);
}
function grit(base) {
  const c = canvas(256, 256), g = c.getContext('2d'), r = rng(7);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) { const v = r() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${0.04 + r() * 0.08})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
  return c;
}

// ------------------------------------------------------------------ matériau : photo + couche dessinée (ou fondu)
function roadMaterial(tex, texN, { color, contrast = 0.85, grain = 0.5, mark = null, fade = false, ruts = 0, feather = 0.6, normal = 0.6, offset = -4, roughness = 0.92 }) {
  const m = new THREE.MeshStandardMaterial({
    map: tex, normalMap: texN || null, normalScale: new THREE.Vector2(normal, normal), roughness, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: offset, transparent: fade, depthWrite: !fade,
  });
  const U = {
    uColor: { value: new THREE.Color(color) }, uAvg: { value: tex.userData.avg }, uContrast: { value: contrast }, uGrain: { value: grain },
    uMark: { value: mark }, uFeather: { value: feather }, uRuts: { value: ruts },
  };
  m.defines = mark ? { ROAD_MARK: '' } : fade ? { ROAD_FADE: '' } : {};
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMk;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMk = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vMk;
        uniform vec3 uColor; uniform vec3 uAvg; uniform float uContrast; uniform float uGrain;
        uniform sampler2D uMark; uniform float uFeather; uniform float uRuts;`)
      .replace('#include <map_fragment>', `
        vec3 rel = texture2D(map, vMapUv).rgb / uAvg;
        float g = dot(rel, vec3(0.3, 0.59, 0.11));
        // grandes taches : la même photo vue de beaucoup plus loin, pour casser la répétition
        float big = dot(texture2D(map, vMapUv * 0.11 + 0.37).rgb / uAvg, vec3(0.3, 0.59, 0.11));
        vec3 col = uColor * mix(vec3(1.0), rel, uContrast) * mix(1.0, big, 0.3);
        #ifdef ROAD_MARK
          // couche dessinée en alpha prémultiplié : peinture, trottoirs, bordures (avec le grain de la photo)
          vec4 mk = texture2D(uMark, vMk);
          col = col * (1.0 - mk.a) + mk.rgb * mix(1.0, g, uGrain);
        #endif
        #ifdef ROAD_FADE
          // bords qui se fondent dans l'herbe, irréguliers ; ornières et bande d'herbe au milieu des chemins
          float c = abs(vMk.x - 0.5);
          float a = smoothstep(0.0, uFeather, (0.5 - c) * 2.0 + (big - 1.0) * 0.35 + (g - 1.0) * 0.1);
          col *= 1.0 - 0.18 * uRuts * exp(-pow((c - 0.22) / 0.07, 2.0));
          a *= 1.0 - 0.55 * uRuts * smoothstep(0.07, 0.02, c + (g - 1.0) * 0.02 + (big - 1.0) * 0.03);
          diffuseColor.a *= a;
        #endif
        diffuseColor.rgb = col;`);
  };
  m.customProgramCacheKey = () => 'royale-road-' + (mark ? 'mark' : fade ? 'fade' : 'plain');
  return m;
}

// ------------------------------------------------------------------ couches dessinées
function finish(c, repeatV, repeatU = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.premultiplyAlpha = true; t.anisotropy = 8;
  t.wrapS = repeatU ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = repeatV ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  return t;
}
// trottoir, bordure, caniveau selon d : distance (m) depuis la chaussée ; x, z (m) pour le dallage, n : grain
function pavement(d, x, z, n) {
  if (d <= 0) return null;
  if (d <= GUTTER) return [148 + n, 144 + n, 136 + n, 235];
  if (d <= GUTTER + 0.035) return [92, 89, 84, 255];
  if (d <= GUTTER + CURB - 0.02) return [216 + n, 212 + n, 203 + n, 255];
  if (d <= GUTTER + CURB) return [150, 146, 139, 255];
  const fx = x / 0.5, fz = z / 0.5, ix = Math.floor(fx), iz = Math.floor(fz);
  if (fx - ix < 0.035 || fz - iz < 0.035) return [128, 123, 115, 255];
  const v = (hash2(ix, iz) - 0.5) * 16;
  return [190 + v + n, 184 + v + n, 172 + v + n, 255];
}
// une couche de W × H m ; depth(x, z) : distance au trottoir le plus proche (chaussée au-delà de EDGE)
function paved(W, H, depth, seed) {
  const w = Math.round(W * PX), h = Math.round(H * PX), c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
  const img = g.createImageData(w, h), D = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i + 0.5) / PX, z = (j + 0.5) / PX, p = pavement(EDGE - depth(x, z), x, z, (r() - 0.5) * 12);
    if (!p) continue;
    const o = (j * w + i) * 4;
    D[o] = p[0]; D[o + 1] = p[1]; D[o + 2] = p[2]; D[o + 3] = p[3];
  }
  g.putImageData(img, 0, 0);
  return { c, g, r };
}
// peinture usée : un rectangle blanc dont on gratte des points
function paint(g, r, x, z, w, h, a = 0.9) {
  const X = x * PX, Z = z * PX, Wp = w * PX, Hp = h * PX;
  g.fillStyle = `rgba(242,240,232,${a})`; g.fillRect(X, Z, Wp, Hp);
  g.save(); g.beginPath(); g.rect(X, Z, Wp, Hp); g.clip(); g.globalCompositeOperation = 'destination-out';
  for (let k = 0, n = Wp * Hp / 45; k < n; k++) { const s = 1 + r() * 1.5; g.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.35})`; g.fillRect(X + r() * Wp - 1, Z + r() * Hp - 1, s, s); }
  g.restore();
}
// trace de pneus : bande sombre, floue, le long de la voie
function track(g, x, H, w = 0.5, a = 0.12) {
  const X = x * PX, Wp = w * PX, grd = g.createLinearGradient(X - Wp / 2, 0, X + Wp / 2, 0);
  grd.addColorStop(0, 'rgba(16,16,16,0)'); grd.addColorStop(0.5, `rgba(16,16,16,${a})`); grd.addColorStop(1, 'rgba(16,16,16,0)');
  g.fillStyle = grd; g.fillRect(X - Wp / 2, 0, Wp, H * PX);
}
const TRACKS = [EDGE + 0.53, 4 - 0.53, 4 + 0.53, 8 - EDGE - 0.53];
const side = (x) => Math.min(x, 8 - x);

function streetMark() {
  const { c, g, r } = paved(8, STREET_TILE, side, 11);
  for (const x of TRACKS) track(g, x, STREET_TILE);
  paint(g, r, 4 - 0.06, 2.5, 0.12, 3);
  return finish(c, true);
}
// passage piéton : v = 0 côté carrefour
function crossingMark() {
  const { c, g, r } = paved(8, CW, side, 12);
  for (const x of TRACKS) track(g, x, CW);
  for (let k = 0; k < 5; k++) paint(g, r, 1.75 + k, 0.6, 0.5, 2.5, 0.92);
  return finish(c, false);
}
// carrefour de 8 × 8 m : bordures arrondies aux angles, trottoir continu du côté sans branche
function junctionMark(arms) {
  const depth = (x, z) => {
    let m = Math.min(Math.hypot(x, z), Math.hypot(8 - x, z), Math.hypot(x, 8 - z), Math.hypot(8 - x, 8 - z));
    if (!(arms & N)) m = Math.min(m, z);
    if (!(arms & S)) m = Math.min(m, 8 - z);
    if (!(arms & W)) m = Math.min(m, x);
    if (!(arms & E)) m = Math.min(m, 8 - x);
    return m;
  };
  const { c, g } = paved(8, 8, depth, 20 + arms);
  // une tache d'huile au milieu
  const grd = g.createRadialGradient(4 * PX, 4 * PX, 0, 4 * PX, 4 * PX, 1.6 * PX);
  grd.addColorStop(0, 'rgba(14,14,14,.12)'); grd.addColorStop(1, 'rgba(14,14,14,0)');
  g.fillStyle = grd; g.fillRect(2 * PX, 2 * PX, 4 * PX, 4 * PX);
  return finish(c, false);
}
// route de 7 m : lignes de rive continues, axe en tirets, traces de pneus, bord qui s'effrite
function routeMark() {
  const c = canvas(7 * PX, ROUTE_TILE * PX), g = c.getContext('2d'), r = rng(31);
  for (const x of [0.95, 2.55, 4.45, 6.05]) track(g, x, ROUTE_TILE, 0.55, 0.11);
  for (const x of [0, 7]) {
    const grd = g.createLinearGradient(x * PX, 0, (x ? x - 0.18 : 0.18) * PX, 0);
    grd.addColorStop(0, 'rgba(20,20,18,.45)'); grd.addColorStop(1, 'rgba(20,20,18,0)');
    g.fillStyle = grd; g.fillRect(x ? (x - 0.18) * PX : 0, 0, 0.18 * PX, ROUTE_TILE * PX);
  }
  paint(g, r, 0.3, 0, 0.15, ROUTE_TILE, 0.85);
  paint(g, r, 7 - 0.45, 0, 0.15, ROUTE_TILE, 0.85);
  paint(g, r, 3.5 - 0.06, 3.5, 0.12, 3);
  return finish(c, true);
}
// place de 32 × 32 m : pavés en quinconce, rosace de pavés autour de la fontaine, bordure de dalles de granit
function plazaMark(size) {
  const P = 32, w = Math.round(size * P), c = canvas(w, w), g = c.getContext('2d'), r = rng(41);
  const img = g.createImageData(w, w), D = img.data, mid = size / 2;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = (i + 0.5) / P, z = (j + 0.5) / P, n = (r() - 0.5) * 10;
    let col, joint = false;
    const rr = Math.hypot(x - mid, z - mid), edge = Math.min(x, z, size - x, size - z);
    if (edge < 0.9) {
      // bordure : grandes dalles de granit le long des bords
      const along = edge === x || edge === size - x ? z : x, k = Math.floor(along / 0.9);
      joint = along / 0.9 - k < 0.04 || edge > 0.86;
      const v = (hash2(k, 7) - 0.5) * 14;
      col = [150 + v, 148 + v, 144 + v];
    } else if (rr < 6.2) {
      // rosace : anneaux de pavés autour de la fontaine, un anneau sombre en bordure
      const ring = Math.floor(rr / 0.45), cnt = Math.max(6, Math.round(2 * Math.PI * (ring + 0.5) * 0.45 / 0.55));
      const ang = (Math.atan2(z - mid, x - mid) / (2 * Math.PI) + 0.5) * cnt + (ring % 2) * 0.5, k = Math.floor(ang);
      joint = rr / 0.45 - ring < 0.1 || ang - k < 0.07;
      const v = (hash2(ring * 131 + k, 3) - 0.5) * 18, dark = ring === 13 || ring === 6;
      col = dark ? [158 + v, 140 + v, 120 + v] : [210 + v, 200 + v, 182 + v];
    } else {
      // pavés de 80 × 40 cm en quinconce
      const row = Math.floor(z / 0.4), fx = x / 0.8 + (row % 2) * 0.5, k = Math.floor(fx);
      joint = z / 0.4 - row < 0.06 || fx - k < 0.03;
      const h = hash2(k, row), v = (h - 0.5) * 22, warm = h > 0.86 ? 14 : 0;
      col = [204 + v + warm, 195 + v, 178 + v - warm];
    }
    const o = (j * w + i) * 4;
    if (joint) col = col.map((q) => q * 0.66);
    D[o] = col[0] + n; D[o + 1] = col[1] + n; D[o + 2] = col[2] + n; D[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return finish(c, false);
}

// ------------------------------------------------------------------ géométrie
function builder() {
  const pos = [], uv = [], uv1 = [], idx = [];
  const P = (k) => [pos[k * 3], pos[k * 3 + 2]];
  return {
    v(x, y, z, u, v) { pos.push(x, y, z); uv.push(u, v); uv1.push(x / PHOTO, z / PHOTO); return pos.length / 3 - 1; },
    // deux triangles tournés vers le haut, quel que soit l'ordre des coins
    quad(a, b, c, d) {
      const [ax, az] = P(a), [bx, bz] = P(b), [cx, cz] = P(c);
      if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) >= 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
    },
    get empty() { return !idx.length; },
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    },
  };
}
const overlap = (a, b) => {
  const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1), z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
  return x1 - x0 > 0.01 && z1 - z0 > 0.01 ? { x0, z0, x1, z1 } : null;
};
const inside = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l)) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

export async function buildRoads(map, { anisotropy = 8 } = {}) {
  const base = new URL('../img/tex/', import.meta.url).href;
  const [asphalt, asphaltN, dirt, dirtN] = await Promise.all([
    photo(base + 'asphalt.jpg', { anisotropy, fallback: () => grit('#4a4a48') }),
    photo(base + 'asphalt_n.jpg', { anisotropy, normal: true }),
    photo(base + 'dirt.jpg', { anisotropy, fallback: () => grit('#8a6a45') }),
    photo(base + 'dirt_n.jpg', { anisotropy, normal: true }),
  ]);
  asphalt.userData.avg = average(asphalt.image);
  dirt.userData.avg = average(dirt.image);
  const textures = [asphalt, asphaltN, dirt, dirtN].filter(Boolean), mats = [], group = new THREE.Group();
  const hAt = map.heightAt;
  const pieces = new Map(); // matériau → constructeur de géométrie
  const add = (mat) => { if (!pieces.has(mat)) pieces.set(mat, builder()); return pieces.get(mat); };
  const mark = (t) => { textures.push(t); return t; };
  const ASPHALT = '#76746f';
  const marked = (t, extra) => { const m = roadMaterial(asphalt, asphaltN, { color: ASPHALT, mark: mark(t), ...extra }); mats.push(m); return m; };
  const mRoute = marked(routeMark(), { offset: -6 });
  const mDirt = roadMaterial(dirt, dirtN, { color: '#a88d64', contrast: 0.9, fade: true, ruts: 1, feather: 0.4, normal: 0.8, roughness: 0.97, offset: -3 });
  const mShoulder = roadMaterial(dirt, dirtN, { color: '#9a9079', contrast: 0.8, fade: true, feather: 0.9, normal: 0.8, roughness: 0.97, offset: -3 });
  mats.push(mDirt, mShoulder);

  // routes et chemins : rubans sur le relief (ou sur le tablier des ponts), accotements de terre le long des routes
  for (const r of map.roads) {
    const P = r.pts;
    if (P.length < 2) continue;
    const route = r.kind === 'route', B = add(route ? mRoute : mDirt), tile = route ? ROUTE_TILE : 8;
    const edges = [];
    let dist = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      if (i > 0) dist += Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z);
      const e = { bridge: !!P[i].bridge, tx, tz, side: [] };
      for (const sd of [-1, 1]) {
        const x = P[i].x - tz * r.hw * sd, z = P[i].z + tx * r.hw * sd, y = P[i].bridge ? P[i].y + 0.06 : hAt(x, z) + LIFT;
        e.side.push({ x, y, z, k: B.v(x, y, z, sd < 0 ? 0 : 1, dist / tile) });
      }
      edges.push(e);
      if (i > 0) B.quad(edges[i - 1].side[0].k, edges[i - 1].side[1].k, e.side[1].k, e.side[0].k);
    }
    if (!route) continue;
    const Bs = add(mShoulder);
    for (const [s, sd] of [[0, -1], [1, 1]]) {
      let prev = null;
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i], q = e.side[s];
        if (e.bridge) { prev = null; continue; }
        const ox = q.x - e.tz * SHOULDER * sd, oz = q.z + e.tx * SHOULDER * sd;
        const cur = { inner: Bs.v(q.x, q.y, q.z, 0.5, 0), outer: Bs.v(ox, hAt(ox, oz) + LIFT, oz, 0, 0) };
        if (prev) Bs.quad(prev.inner, prev.outer, cur.outer, cur.inner);
        prev = cur;
      }
    }
  }

  // rues : tronçons entre les carrefours, passage piéton au bout de chaque tronçon qui touche un carrefour
  const streets = map.streets, junctions = new Map();
  const mStreet = marked(streetMark()), mCross = marked(crossingMark());
  const roadSegs = [];
  for (const r of map.roads) for (let i = 1; i < r.pts.length; i++) roadSegs.push([r.pts[i - 1], r.pts[i], r.hw]);
  streets.forEach((st, si) => {
    const alongX = st.x1 - st.x0 > st.z1 - st.z0, len = alongX ? st.x1 - st.x0 : st.z1 - st.z0;
    const start = alongX ? st.x0 : st.z0, y = hAt((st.x0 + st.x1) / 2, (st.z0 + st.z1) / 2) + LIFT;
    const cover = [];
    streets.forEach((o, oi) => {
      if (oi === si) return;
      const ov = overlap(st, o);
      if (!ov) return;
      const oAlongX = o.x1 - o.x0 > o.z1 - o.z0, cross = oAlongX !== alongX;
      if (cross) junctions.set(`${ov.x0},${ov.z0},${ov.x1},${ov.z1}`, ov);
      else if (oi > si) return; // tronçon commun à deux rues alignées : dessiné par la première
      cover.push(alongX ? [ov.x0 - start, ov.x1 - start, cross] : [ov.z0 - start, ov.z1 - start, cross]);
    });
    cover.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const c of cover) {
      const last = merged[merged.length - 1];
      if (last && c[0] <= last[1] + 0.01) { last[1] = Math.max(last[1], c[1]); last[2] = last[2] || c[2]; } else merged.push([...c]);
    }
    // pièce [a0, a1] le long de la rue, texture de v0 à v1
    const piece = (mat, a0, a1, v0, v1) => {
      const B = add(mat), p = (a, u) => (alongX ? [start + a, u ? st.z1 : st.z0] : [u ? st.x1 : st.x0, start + a]);
      const k = [[a0, 0, v0], [a1, 0, v1], [a1, 1, v1], [a0, 1, v0]].map(([a, u, v]) => { const [x, z] = p(a, u); return B.v(x, y, z, u, v); });
      B.quad(...k);
    };
    let at = 0, after = false;
    for (const [c0, c1, cross] of [...merged, [len, len, false]]) {
      if (c0 > at + 0.01) {
        let s0 = at, s1 = Math.min(c0, len);
        const before = cross && c0 < len, room = s1 - s0;
        const cwA = after && room >= CW + 2, cwB = before && room >= (cwA ? 2 * CW + 2 : CW + 2);
        if (cwA) { piece(mCross, s0, s0 + CW, 0, 1); s0 += CW; }
        if (cwB) { piece(mCross, s1 - CW, s1, 1, 0); s1 -= CW; }
        if (s1 > s0 + 0.01) piece(mStreet, s0, s1, 0, (s1 - s0) / STREET_TILE);
      }
      at = Math.max(at, c1); after = cross;
    }
  });
  // carrefours : une couche par combinaison de branches (rue ou route qui arrive de ce côté)
  const jMats = new Map();
  const armAt = (x, z) => streets.some((o) => inside(o, x, z)) || roadSegs.some(([a, b, hw]) => segDist(x, z, a.x, a.z, b.x, b.z) < hw + 0.5);
  for (const j of junctions.values()) {
    const cx = (j.x0 + j.x1) / 2, cz = (j.z0 + j.z1) / 2;
    const arms = (armAt(cx, j.z0 - 1) ? N : 0) | (armAt(cx, j.z1 + 1) ? S : 0) | (armAt(j.x0 - 1, cz) ? W : 0) | (armAt(j.x1 + 1, cz) ? E : 0);
    if (!jMats.has(arms)) jMats.set(arms, marked(junctionMark(arms)));
    const B = add(jMats.get(arms)), y = hAt(cx, cz) + LIFT;
    B.quad(B.v(j.x0, y, j.z0, 0, 0), B.v(j.x1, y, j.z0, 1, 0), B.v(j.x1, y, j.z1, 1, 1), B.v(j.x0, y, j.z1, 0, 1));
  }
  // places
  if (map.plazas.length) {
    const size = map.plazas[0].x1 - map.plazas[0].x0, mPlaza = marked(plazaMark(size), { grain: 0.6 });
    for (const p of map.plazas) {
      const B = add(mPlaza), y = hAt((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2) + LIFT;
      B.quad(B.v(p.x0, y, p.z0, 0, 0), B.v(p.x1, y, p.z0, 1, 0), B.v(p.x1, y, p.z1, 1, 1), B.v(p.x0, y, p.z1, 0, 1));
    }
  }
  // un maillage par matériau pour toute l'île
  for (const [mat, B] of pieces) {
    if (B.empty) continue;
    const mesh = new THREE.Mesh(B.geometry(), mat);
    mesh.receiveShadow = true; mesh.renderOrder = mat.transparent ? 1 : 0;
    group.add(mesh);
  }
  return {
    group,
    dispose() { group.traverse((o) => o.isMesh && o.geometry.dispose()); for (const m of mats) m.dispose(); for (const t of textures) t.dispose(); },
  };
}
