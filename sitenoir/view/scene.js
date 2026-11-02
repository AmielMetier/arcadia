// Site Noir : la scène 3D. Le bâtiment se construit depuis la grille (quads fusionnés par morceaux), les meubles sont instanciés.
// La lumière est un budget fixe : quelques lampes de secours (les plus proches), la lampe du joueur avec ombres, deux lampes d'équipiers sans ombre,
// allumées seulement s'ils sont en vue (sinon elles traverseraient les murs). Le monstre voit autrement : pénombre bleutée et corps chauds.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { Models, grime } from './models.js';
import { makeSurface, setTextureSize, softSprite, doorTexture, torchCookie, decalAtlas, DECAL, exitSign } from './textures.js';
import { createPost } from './post.js';
import { makeRng } from '../engine/rng.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';
import { T, Z, W, H, CEIL, DEEP, DOOR_H, zoneAt, hasLOS, Nav } from '../engine/map.js';

const CHUNK = 16;
const LIGHT_POOL = 5;
const LCOL = { urgence: 0xff9a5a, rouge: 0xff2a18, ambre: 0xffa72e, neon: 0xd8e6ff, projecteur: 0xeaf1ff };
const LPOW = { urgence: 7, rouge: 7, ambre: 8, neon: 10, projecteur: 420 };
const LDIST = { urgence: 8, rouge: 7, ambre: 9, neon: 9, projecteur: 34 };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
const EYE = 1.62, EYE_CROUCH = 0.95, EYE_DOWN = 0.35, EYE_M = 2.15, HEAD_SHRINK = 0.05;

export function createScene(stage, { map: M, quality = 'normal', onLost } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.domElement.className = 'gl';
  stage.appendChild(renderer.domElement);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const post = createPost(renderer, { samples: quality === 'bas' ? 0 : 4, bloom: quality !== 'bas' });
  // sans passe d'image (vieille carte) : le rendu direct, sans grain
  renderer.toneMapping = post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  setTextureSize(quality === 'bas' ? 512 : 1024);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let pixel = Math.min(devicePixelRatio || 1, quality === 'haut' ? 1.5 : quality === 'bas' ? 0.8 : 1.15);
  renderer.setPixelRatio(pixel);
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost && onLost(); });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020305);
  scene.fog = new THREE.FogExp2(0x03050a, 0.1);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.07, 90);
  scene.add(camera);
  const resize = () => { const w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight; renderer.setSize(w, h, false); if (post) { const v = renderer.getDrawingBufferSize(new THREE.Vector2()); post.setSize(v.x, v.y); } camera.aspect = w / h; camera.updateProjectionMatrix(); };
  resize(); addEventListener('resize', resize);

  const ambient = new THREE.AmbientLight(0x8fa4c8, 0.02);
  scene.add(ambient);

  // ---------------------------------------------------------------- matériaux
  const mat = {};
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const std = (name, opts = {}) => (mat[name] = new THREE.MeshStandardMaterial({ ...makeSurface(name, { aniso }), normalScale: new THREE.Vector2(0.9, 0.9), roughness: 1, metalness: 0, vertexColors: true, ...opts }));
  for (const n of ['wallA', 'floorA', 'ceilA', 'wallB', 'floorB', 'ceilB', 'wallS', 'floorS', 'ceilS']) std(n);
  std('outer', { emissive: 0x26303a, emissiveIntensity: 0.3 });
  std('ground', { emissive: 0x2c3a2e, emissiveIntensity: 0.22 });
  mat.skirt = new THREE.MeshStandardMaterial({ color: 0x24231f, roughness: 0.5, metalness: 0.1, vertexColors: true });
  // même matériau, pour les boîtes sans couleurs de sommets (linteaux)
  const plain = (name) => { const m = mat[name].clone(); m.vertexColors = false; return m; };
  const zoneMat = (z) => (z === Z.B ? 'B' : z === Z.SOUS || z === Z.CABINE ? 'S' : 'A');

  // ---------------------------------------------------------------- le bâtiment
  const buckets = new Map();
  const quad = (name, cx, cz, a, b, c, d, nx, ny, nz, ua, va, ub, vb, k = [1, 1, 1, 1]) => {
    const key = `${name}:${Math.floor(cx / CHUNK)}:${Math.floor(cz / CHUNK)}`;
    let q = buckets.get(key);
    if (!q) buckets.set(key, q = { name, p: [], n: [], u: [], i: [], c: [] });
    const o = q.p.length / 3;
    q.p.push(...a, ...b, ...c, ...d);
    for (const v of k) q.c.push(v, v, v);
    for (let k = 0; k < 4; k++) q.n.push(nx, ny, nz);
    q.u.push(ua, va, ub, va, ub, vb, ua, vb);
    q.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const cellH = (cx, cz, x, z) => {
    for (const r of M.ramps) if (cx >= r.x0 && cx < r.x1 && cz >= r.z0 && cz < r.z1) return DEEP * (x - r.x0) / (r.x1 - r.x0);
    return M.floor[cz * W + cx];
  };
  const inRamp = (x, z) => M.ramps.some((q) => x >= q.x0 && x < q.x1 && z >= q.z0 && z < q.z1);
  // la pente regardée de face : vers le haut pour le plafond renversé, sinon la lumière la rate
  const SLOPE_L = Math.hypot(4 / 7, 1), SLOPE_NX = (4 / 7) / SLOPE_L, SLOPE_NY = 1 / SLOPE_L;
  const isOpen = (x, z) => x >= 0 && z >= 0 && x < W && z < H && (M.t[z * W + x] === T.FLOOR || M.t[z * W + x] === T.PROP);
  // ombre de contact, cuite dans les sommets : combien de murs autour de ce coin ?
  const wallCell = (a, b) => a < 0 || b < 0 || a >= W || b >= H || M.t[b * W + a] === T.WALL;
  const around = (vx, vz) => (wallCell(vx - 1, vz - 1) ? 1 : 0) + (wallCell(vx, vz - 1) ? 1 : 0) + (wallCell(vx - 1, vz) ? 1 : 0) + (wallCell(vx, vz) ? 1 : 0);
  const aoFlat = (vx, vz, f) => [1, 0.8, 0.6, 0.42, 0.42][around(vx, vz)] * f + (1 - f);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (!isOpen(x, z)) continue;
    const i = z * W + x, zn = M.zone[i], out = zn === Z.OUTPOST || zn === Z.PAD, cab = zn === Z.CABINE, letter = zoneMat(zn), S = 1 / 2;
    const h00 = cellH(x, z, x, z), h10 = cellH(x, z, x + 1, z), h01 = cellH(x, z, x, z + 1), h11 = cellH(x, z, x + 1, z + 1);
    if (!cab) {
      const ramped = inRamp(x, z); // les marches se dessinent à part
      const fl = out ? 'ground' : `floor${letter}`, Sf = out ? 1 / 6 : letter === 'S' ? 1 / 3 : S, u0 = x * Sf, v0 = (z + (ramped ? 0.5 : 0)) * Sf;
      if (!ramped) quad(fl, x, z, [x, h01, z + 1], [x + 1, h11, z + 1], [x + 1, h10, z], [x, h00, z], 0, 1, 0, u0, v0 + Sf, u0 + Sf, v0, out ? [1, 1, 1, 1] : [aoFlat(x, z + 1, 1), aoFlat(x + 1, z + 1, 1), aoFlat(x + 1, z, 1), aoFlat(x, z, 1)]);
      if (!out) quad(`ceil${letter}`, x, z, [x, h00 + CEIL, z], [x + 1, h10 + CEIL, z], [x + 1, h11 + CEIL, z + 1], [x, h01 + CEIL, z + 1], ramped ? -SLOPE_NX : 0, ramped ? -SLOPE_NY : -1, 0, u0, v0, u0 + Sf, v0 + Sf, [aoFlat(x, z, 1), aoFlat(x + 1, z, 1), aoFlat(x + 1, z + 1, 1), aoFlat(x, z + 1, 1)]);
    }
    // murs : hauteur du bâtiment vu de dehors, tout le puits dans la cabine
    const wn = out ? 'outer' : `wall${letter}`;
    const top = out ? 8 : CEIL, bottom = cab ? DEEP : null, wTop = cab ? CEIL : null;
    const STRIPS = out ? [[0, 0.72], [0.05, 1], [1, 1]] : cab ? [[0, 1], [1, 1]] : [[0, 0.52], [0.09, 0.9], [0.8, 1], [1, 0.62]];
    const wall = (ax, az, bx, bz, ha, hb, nx, nz, cell) => {
      const span = out ? 4 : 3, u = cell / span, ya = bottom ?? ha, yb = bottom ?? hb, ta = wTop ?? ha + top, tb = wTop ?? hb + top, vmax = out ? top / 4 : (ta - ya) / CEIL;
      const ka = around(ax, az) >= 3 ? 0.66 : 1, kb = around(bx, bz) >= 3 ? 0.66 : 1;
      for (let i = 0; i + 1 < STRIPS.length; i++) {
        const [f0, k0] = STRIPS[i], [f1, k1] = STRIPS[i + 1];
        const a0 = ya + (ta - ya) * f0, a1 = ya + (ta - ya) * f1, b0 = yb + (tb - yb) * f0, b1 = yb + (tb - yb) * f1;
        quad(wn, x, z, [bx, b0, bz], [ax, a0, az], [ax, a1, az], [bx, b1, bz], nx, 0, nz, u, vmax * f0, u + 1 / span, vmax * f1, [k0 * kb, k0 * ka, k1 * ka, k1 * kb]);
      }
      if (!out && !cab) {
        // plinthe : une vraie marche, qui accroche la lumière de la lampe
        const e = 0.016, H0 = 0.11, ox = nx * e, oz = nz * e;
        quad('skirt', x, z, [bx + ox, hb, bz + oz], [ax + ox, ha, az + oz], [ax + ox, ha + H0, az + oz], [bx + ox, hb + H0, bz + oz], nx, 0, nz, 0, 0, 1, 1, [0.55 * kb, 0.55 * ka, ka, kb]);
        quad('skirt', x, z, [bx + ox, hb + H0, bz + oz], [ax + ox, ha + H0, az + oz], [ax, ha + H0, az], [bx, hb + H0, bz], 0, 1, 0, 0, 0, 1, 1, [kb, ka, ka, kb]);
      }
    };
    const solid = (a, b) => a < 0 || b < 0 || a >= W || b >= H || M.t[b * W + a] === T.WALL;
    if (solid(x, z - 1)) wall(x + 1, z, x, z, h10, h00, 0, 1, x);
    if (solid(x, z + 1)) wall(x, z + 1, x + 1, z + 1, h01, h11, 0, -1, x);
    if (solid(x - 1, z)) wall(x, z, x, z + 1, h00, h01, 1, 0, z);
    if (solid(x + 1, z)) wall(x + 1, z + 1, x + 1, z, h11, h10, -1, 0, z);
  }
  // les escaliers : de vraies marches au-dessus de la pente sur laquelle on marche, chacune avec son nez clair et son pied sombre
  for (const r of M.ramps) {
    const N = 24, tw = (r.x1 - r.x0) / N, Sf = 1 / 3;
    for (let i = 0; i < N; i++) {
      const x0 = r.x0 + i * tw, x1 = x0 + tw, y = DEEP * i / N, y1 = DEEP * (i + 1) / N, cell = Math.floor(x0);
      for (let z = r.z0; z < r.z1; z++) {
        const v0 = (z + 0.5) * Sf, k0 = z === r.z0 ? 0.6 : 1, k1 = z === r.z1 - 1 ? 0.6 : 1;
        quad('floorS', cell, z, [x0, y, z + 1], [x1, y, z + 1], [x1, y, z], [x0, y, z], 0, 1, 0, x0 * Sf, v0 + Sf, x1 * Sf, v0, [0.62 * k1, 1.25 * k1, 1.25 * k0, 0.62 * k0]);
        quad('floorS', cell, z, [x1, y1, z + 1], [x1, y1, z], [x1, y, z], [x1, y, z + 1], 1, 0, 0, v0 + Sf, y1 * Sf, v0, y * Sf, [0.4, 0.4, 0.8, 0.8]);
      }
    }
  }
  const worldGroup = new THREE.Group(); scene.add(worldGroup);
  for (const q of buckets.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(q.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(q.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(q.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(q.c, 3));
    g.setIndex(q.i);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat[q.name]);
    m.castShadow = q.name.startsWith('wall'); m.receiveShadow = true; m.matrixAutoUpdate = false;
    worldGroup.add(m);
  }
  // sol au-delà de la clôture
  const farG = new THREE.Mesh(new THREE.PlaneGeometry(260, 200), new THREE.MeshStandardMaterial({ ...makeSurface('ground', { aniso, repeat: 90 }), roughness: 1, emissive: 0x2c3a2e, emissiveIntensity: 0.22 })); farG.rotation.x = -Math.PI / 2; farG.position.set(38, -0.02, 90); scene.add(farG);

  // ---------------------------------------------------------------- portes
  const plainCache = {};
  const plainMat = (n) => (plainCache[n] ||= plain(n));
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a4e52, roughness: 0.6, metalness: 0.3 }); grime(metal);
  const frames = [];
  const doors = M.doors.map((d) => {
    const w = d.cells.length, dirX = d.axis === 'x';
    const tex = doorTexture(d.name, d.key);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.25 });
    const panels = [];
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(dirX ? w / 2 : 0.1, DOOR_H, dirX ? 0.1 : w / 2), m);
      b.position.set(d.x + (dirX ? side * w / 4 : 0), d.y + DOOR_H / 2, d.z + (dirX ? 0 : side * w / 4));
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b); panels.push({ b, side, base: b.position.clone() });
    }
    // linteau au-dessus du passage, des deux côtés
    const letter = zoneMat(d.zone);
    const linG = new THREE.BoxGeometry(dirX ? w : 1.0, CEIL - DOOR_H, dirX ? 1.0 : w), linU = linG.attributes.uv;
    for (let i = 0; i < linU.count; i++) linU.setXY(i, linU.getX(i) * w / 3, linU.getY(i) * (CEIL - DOOR_H) / 3 + 0.62);
    const lin = new THREE.Mesh(linG, plainMat(d.kind === 'lift' ? 'wallS' : d.kind === 'sas' && d.key === null ? 'wallA' : `wall${letter}`));
    lin.position.set(d.x, d.y + (DOOR_H + CEIL) / 2, d.z);
    // cadre d'acier des deux côtés de l'ouverture
    for (const side of [-0.51, 0.51]) {
      const fx = (cx, cy, cz, sx, sy, sz) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(cx, cy, cz); frames.push(g); };
      const t = 0.07, e = 0.05;
      if (dirX) { const z0 = d.z + side; fx(d.x - w / 2 - t / 2, d.y + DOOR_H / 2, z0, t, DOOR_H, e); fx(d.x + w / 2 + t / 2, d.y + DOOR_H / 2, z0, t, DOOR_H, e); fx(d.x, d.y + DOOR_H + t / 2, z0, w + t * 2, t, e); }
      else { const x0 = d.x + side; fx(x0, d.y + DOOR_H / 2, d.z - w / 2 - t / 2, e, DOOR_H, t); fx(x0, d.y + DOOR_H / 2, d.z + w / 2 + t / 2, e, DOOR_H, t); fx(x0, d.y + DOOR_H + t / 2, d.z, e, t, w + t * 2); }
    }
    scene.add(lin);
    // voyant : rouge verrouillé, vert libre, violet bloqué
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: 0x33ff66, fog: false }));
    led.position.set(d.x + (dirX ? w / 2 + 0.2 : 0.52), d.y + 1.5, d.z + (dirX ? 0.52 : w / 2 + 0.2));
    scene.add(led);
    return { d, panels, led, t: 0, tex, m };
  });

  if (frames.length) { const fm = new THREE.Mesh(mergeGeometries(frames), metal); fm.receiveShadow = true; fm.matrixAutoUpdate = false; scene.add(fm); }
  // panneaux lumineux au-dessus du sas : c'est par là qu'on ressort
  const exitTex = exitSign(), exitMat = new THREE.MeshBasicMaterial({ map: exitTex });
  for (const d of M.doors) if (d.kind === 'sas' && d.key === null) { const e = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.27), exitMat); e.position.set(d.x, d.y + 2.72, d.z - 0.52); e.rotation.y = Math.PI; scene.add(e); }

  // ---------------------------------------------------------------- signalétique : bandes peintes au sol, panneaux sur les murs
  {
    const nav = new Nav(M), walk = (i) => M.t[i] === T.FLOOR;
    const cellClear = (x, z) => { const i = z * W + x; return x >= 0 && z >= 0 && x < W && z < H && M.t[i] === T.FLOOR; };
    const legClear = (a, b) => { const dx = Math.sign(b[0] - a[0]), dz = Math.sign(b[1] - a[1]); let x = a[0], z = a[1]; while (x !== b[0] || z !== b[1]) { x += dx; z += dz; if (!cellClear(x, z)) return false; } return true; };
    const byColor = new Map();
    // deux jambes droites de préférence à un escalier de petites cases, comme le ferait un peintre
    const straighten = (cells) => {
      const out = [cells[0]];
      let i = 0;
      while (i < cells.length - 1) {
        let best = null, bj = i + 1;
        for (let j = cells.length - 1; j > i; j--) {
          const a = cells[i], b = cells[j], c1 = [b[0], a[1]], c2 = [a[0], b[1]];
          if (a[0] === b[0] || a[1] === b[1]) { if (legClear(a, b)) { best = [b]; bj = j; break; } }
          else if (legClear(a, c1) && legClear(c1, b)) { best = [c1, b]; bj = j; break; }
          else if (legClear(a, c2) && legClear(c2, b)) { best = [c2, b]; bj = j; break; }
        }
        out.push(...(best || [cells[i + 1]]));
        i = bj;
      }
      return out;
    };
    for (const r of M.routes) {
      const path = nav.find(r.a[0], r.a[1], r.b[0], r.b[1], walk);
      if (!path) continue;
      const q = byColor.get(r.color) || byColor.set(r.color, { p: [], i: [] }).get(r.color);
      const pts = straighten(path.map((i) => [i % W, Math.floor(i / W)]));
      const tri = (a, b, c) => { const o = q.p.length / 3; q.p.push(...a, ...b, ...c); q.i.push(o, o + 1, o + 2); };
      for (let k = 0; k + 1 < pts.length; k++) {
        const ax = pts[k][0] + 0.5, az = pts[k][1] + 0.5, bx = pts[k + 1][0] + 0.5, bz = pts[k + 1][1] + 0.5, len = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, W2 = 0.075;
        for (let s = 0; s < len; s += 0.5) {
          const e = Math.min(len, s + 0.5), x0 = ax + ux * s, z0 = az + uz * s, x1 = ax + ux * e, z1 = az + uz * e;
          if (inRamp(Math.floor(x0), Math.floor(z0)) || inRamp(Math.floor(x1), Math.floor(z1))) continue;
          const y = M.floor[Math.floor(z0) * W + Math.floor(x0)] + 0.012;
          tri([x0 + nx * W2, y, z0 + nz * W2], [x1 + nx * W2, y, z1 + nz * W2], [x1 - nx * W2, y, z1 - nz * W2]);
          tri([x0 + nx * W2, y, z0 + nz * W2], [x1 - nx * W2, y, z1 - nz * W2], [x0 - nx * W2, y, z0 - nz * W2]);
          // tous les trois mètres, une pointe de flèche dans le sens de la marche
          if (s % 3 === 1.5) { const tx = x0 + ux * 0.42, tz = z0 + uz * 0.42; tri([x0 + nx * 0.26, y, z0 + nz * 0.26], [tx, y, tz], [x0 - nx * 0.26, y, z0 - nz * 0.26]); }
        }
      }
    }
    for (const [color, q] of byColor) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(q.p, 3)); g.setIndex(q.i); g.computeVertexNormals();
      const line = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.75, emissive: color, emissiveIntensity: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      line.receiveShadow = true; line.matrixAutoUpdate = false; scene.add(line);
    }
    const signTexture = (g) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 192;
      const x = c.getContext('2d');
      x.fillStyle = '#14161a'; x.fillRect(0, 0, 512, 192);
      x.fillStyle = g.color; x.fillRect(0, 0, 512, 14); x.fillRect(0, 178, 512, 14);
      x.fillStyle = g.color; x.textBaseline = 'middle';
      const tw = g.arrow ? 356 : 476;
      x.font = '900 62px "Arial Black", Impact, sans-serif'; x.textAlign = 'left'; x.fillText(g.text, 18, 74, tw);
      x.fillStyle = '#d8d2c0'; x.font = '700 29px Arial, sans-serif'; x.fillText(g.sub, 20, 140, tw);
      if (g.arrow) { x.fillStyle = g.color; x.font = '900 132px Arial, sans-serif'; x.textAlign = 'center'; x.fillText(g.arrow, 438, 100); }
      // les années : rouille et griffures
      const r = makeRng(Math.round(g.x * 13 + g.z * 7));
      x.globalAlpha = 0.25; x.fillStyle = '#000';
      for (let i = 0; i < 90; i++) x.fillRect(r.next() * 512, r.next() * 192, r.next() * 26, 1 + r.next() * 2);
      x.globalAlpha = 1;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
      return tex;
    };
    for (const g of M.signs) {
      const tex = signTexture(g), fy = M.floor[Math.floor(g.z + g.nz * 0.5) * W + Math.floor(g.x + g.nx * 0.5)];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.58), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.16, roughness: 0.6 }));
      m.position.set(g.x + g.nx * 0.02, g.y ?? fy + 1.75, g.z + g.nz * 0.02); m.rotation.y = Math.atan2(g.nx, g.nz); m.receiveShadow = true;
      scene.add(m);
    }
  }

  // ---------------------------------------------------------------- cabine de l'ascenseur
  const cabin = new THREE.Group(); scene.add(cabin);
  const cabFloor = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 3), new THREE.MeshStandardMaterial({ color: 0x3e4145, roughness: 0.55, metalness: 0.3 })); cabFloor.position.set(60, -0.05, 45.5); cabFloor.receiveShadow = true; cabin.add(cabFloor);
  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 3), cabFloor.material); cabRoof.position.set(60, 2.75, 45.5); cabin.add(cabRoof);
  const cabLamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.3), new THREE.MeshBasicMaterial({ color: 0xdfe9ff })); cabLamp.position.set(60, 2.68, 45.5); cabin.add(cabLamp);
  const cabBtn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.2), new THREE.MeshBasicMaterial({ color: 0xff3a2a })); cabBtn.position.set(61.95, 1.25, 44.6); cabin.add(cabBtn);

  // le puits au-dessus de la porte du bas et sous celle du haut
  for (const [z, y0, y1] of [[43.95, DEEP + DOOR_H, CEIL], [47.05, DEEP, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(4.2, y1 - y0, 0.1), plainMat('wallS')); b.position.set(60, (y0 + y1) / 2, z); scene.add(b); }

  // ---------------------------------------------------------------- appareils dessinés (panneau d'appel, écrans, boîtier du générateur)
  const box = (w, h, d, c, x, y, z, emis) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), emis ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })); b.position.set(x, y, z); scene.add(b); return b; };
  const callBtn = box(0.28, 0.42, 0.06, 0xaa2211, M.liftCall.x, DEEP + 1.3, M.liftCall.z + 0.48, true);
  box(0.38, 0.55, 0.05, 0x22262c, M.liftCall.x, DEEP + 1.3, M.liftCall.z + 0.51);
  box(0.8, 1.3, 0.14, 0x33383e, M.generator.panel.x, DEEP + 0.65, M.generator.z + 1.38);
  const genLeds = [0, 1, 2].map((i) => box(0.14, 0.14, 0.04, 0x441111, M.generator.panel.x - 0.22 + i * 0.22, DEEP + 1.08, M.generator.z + 1.18, true));
  const genBar = box(0.6, 0.08, 0.04, 0x33ff66, M.generator.panel.x, DEEP + 0.84, M.generator.z + 1.18, true);
  box(1.6, 0.05, 0.3, 0x79c6ff, M.monitor.x, 0.77, M.monitor.z - 0.65, true);

  // ---------------------------------------------------------------- lumières
  const pool = [];
  for (let i = 0; i < LIGHT_POOL; i++) { const l = new THREE.PointLight(0xffffff, 0, 8, 2); scene.add(l); pool.push(l); }
  const torch = new THREE.SpotLight(0xfff1d6, 0, 17, 0.36, 0.3, 1.6);
  torch.map = torchCookie();
  torch.castShadow = true; torch.shadow.mapSize.set(quality === 'bas' ? 512 : 1024, quality === 'bas' ? 512 : 1024); torch.shadow.camera.near = 0.2; torch.shadow.camera.far = 17; torch.shadow.bias = -0.0015; torch.shadow.normalBias = 0.02;
  scene.add(torch, torch.target);
  const others = [0, 1].map(() => { const s = new THREE.SpotLight(0xfff1d6, 0, 14, 0.36, 0.75, 1.6); scene.add(s, s.target); return s; });
  const flashLight = new THREE.PointLight(0xffffff, 0, 22, 1.5); scene.add(flashLight);
  const glowTex = softSprite('rgba(255,255,255,.9)', 'rgba(255,255,255,0)');
  const glows = M.lights.map((l) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: LCOL[l.kind], transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    const size = l.kind === 'projecteur' ? 1.5 : 0.9;
    s.scale.set(size, size, 1); s.position.set(l.x, l.y - 0.02, l.z);
    const fix = new THREE.Mesh(new THREE.BoxGeometry(l.kind === 'projecteur' ? 0.7 : 0.5, 0.06, 0.16), new THREE.MeshBasicMaterial({ color: LCOL[l.kind] }));
    fix.position.set(l.x, l.y + 0.04, l.z);
    scene.add(s, fix);
    return { l, s, fix };
  });
  const flick = (l, t) => { if (!l.flick) return 1; const a = Math.sin(t * 2.1 + l.phase) * Math.sin(t * 5.7 + l.phase * 2), panne = Math.sin(t * 0.31 + l.phase * 3) > 1 - l.flick * 0.55; if (panne) return Math.sin(t * 41 + l.phase) > 0.2 ? 0.75 : 0.02; return 0.85 + a * 0.15 * l.flick; };

  // brume : grandes taches douces près des lumières, et poussière autour du joueur
  const puffTex = softSprite('rgba(170,180,200,.5)', 'rgba(170,180,200,0)');
  const puffs = [];
  M.lights.forEach((l, i) => { for (let k = 0; k < 2; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: LCOL[l.kind], transparent: true, opacity: 0.05, depthWrite: false })); s.scale.setScalar(4 + (i % 3)); s.position.set(l.x + (k ? 1.2 : -1.2), l.y - 1.5, l.z + (i % 2 ? 1 : -1)); s.userData.l = l; scene.add(s); puffs.push(s); } });
  const dustN = 90, dustP = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN * 3; i++) dustP[i] = Math.random() * 10 - 5;
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dustP, 3));
  const dust = new THREE.Points(dustG, new THREE.PointsMaterial({ size: 0.02, color: 0xcfd6e6, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false; scene.add(dust);

  // faisceau visible des lampes
  const beamGeo = new THREE.ConeGeometry(1.5, 7, 16, 1, true); beamGeo.translate(0, -3.5, 0); beamGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uA: { value: 0.06 } },
    vertexShader: 'varying float vD; varying vec3 vN; varying vec3 vV; void main(){ vD = abs(position.z) / 7.0; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float uA; varying float vD; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(vN,vV)),1.5); gl_FragColor = vec4(vec3(1.0,0.93,0.8), uA*(1.0-vD)*(1.0-vD)*e); }',
  });

  const ownBeamMat = beamMat.clone(); ownBeamMat.uniforms.uA.value = 0.02;
  const ownBeam = new THREE.Mesh(beamGeo, ownBeamMat); ownBeam.visible = false; ownBeam.frustumCulled = false; scene.add(ownBeam);

  // ---------------------------------------------------------------- détails posés : papiers, sang, huile, gravats, affiches
  const decalTex = decalAtlas();
  const decalMat = new THREE.MeshStandardMaterial({ map: decalTex, transparent: true, alphaTest: 0.03, depthWrite: false, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  {
    const r = makeRng(61803), byKind = new Map();
    const put = (k, x, y, z, rx, ry, size, stretch = 1) => { (byKind.get(k) || byKind.set(k, []).get(k)).push({ x, y, z, rx, ry, size, stretch }); };
    const FLOORS = { [Z.A]: [[DECAL.paper, 0.05], [DECAL.sheet, 0.035], [DECAL.boots, 0.012], [DECAL.debris, 0.02], [DECAL.splat, 0.006], [DECAL.cable, 0.008]], [Z.B]: [[DECAL.sheet, 0.03], [DECAL.splat, 0.03], [DECAL.drag, 0.018], [DECAL.debris, 0.03], [DECAL.boots, 0.018]], [Z.SOUS]: [[DECAL.oil, 0.05], [DECAL.drag, 0.012], [DECAL.splat, 0.012], [DECAL.debris, 0.03], [DECAL.cable, 0.022], [DECAL.boots, 0.012]], [Z.OUTPOST]: [[DECAL.boots, 0.008], [DECAL.oil, 0.012], [DECAL.debris, 0.012]] };
    const WALLS = { [Z.A]: [[DECAL.notice, 0.022], [DECAL.soot, 0.03], [DECAL.hand, 0.004]], [Z.B]: [[DECAL.warn, 0.018], [DECAL.soot, 0.035], [DECAL.hand, 0.022]], [Z.SOUS]: [[DECAL.warn, 0.03], [DECAL.soot, 0.05], [DECAL.hand, 0.008]] };
    const DIRS = [[0, -1, 0], [0, 1, Math.PI], [-1, 0, Math.PI / 2], [1, 0, -Math.PI / 2]];
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const i = z * W + x;
      if (M.t[i] !== T.FLOOR || M.doorAt[i] >= 0 || inRamp(x, z)) continue;
      const zn = M.zone[i], fy = M.floor[i];
      for (const [k, c] of FLOORS[zn] || []) if (r.chance(c)) { put(k, x + 0.2 + r.next() * 0.6, fy + 0.006 + r.next() * 0.004, z + 0.2 + r.next() * 0.6, -Math.PI / 2, r.next() * 6.28, k === DECAL.paper || k === DECAL.sheet ? 0.46 : k === DECAL.drag ? 1.9 : k === DECAL.boots ? 1.25 : 0.7 + r.next() * 0.75); }
      for (const [dx, dz, ry] of DIRS) {
        if (!wallCell(x + dx, z + dz)) continue;
        for (const [k, c] of WALLS[zn] || []) if (r.chance(c)) {
          const size = k === DECAL.soot ? 1.1 + r.next() * 1.3 : k === DECAL.hand ? 0.34 : 0.56, h = k === DECAL.soot ? r.next() * 2.2 : k === DECAL.hand ? 0.9 + r.next() * 0.6 : 1.35 + r.next() * 0.2;
          const off = 0.5 - 0.008, along = (r.next() - 0.5) * 0.5;
          put(k, x + 0.5 + dx * off + (dz ? along : 0), fy + h, z + 0.5 + dz * off + (dx ? along : 0), 0, ry, size);
        }
      }
    }
    const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), P = new THREE.Vector3(), Sc = new THREE.Vector3(), mx = new THREE.Matrix4();
    for (const [k, list] of byKind) {
      const g = new THREE.PlaneGeometry(1, 1), u = g.attributes.uv, cx = k % 4, cy = Math.floor(k / 4);
      for (let i = 0; i < u.count; i++) u.setXY(i, (cx + u.getX(i)) / 4, (2 - cy + u.getY(i)) / 3);
      const im = new THREE.InstancedMesh(g, decalMat, list.length);
      list.forEach((o, i) => { e.set(o.rx, o.ry, 0); q.setFromEuler(e); P.set(o.x, o.y, o.z); Sc.set(o.size, o.size, 1); im.setMatrixAt(i, mx.compose(P, q, Sc)); });
      im.receiveShadow = true; im.renderOrder = 1; scene.add(im);
    }
  }

  // ---------------------------------------------------------------- modèles
  const models = new Models();
  const R = { actors: new Map(), itemMeshes: new Map(), camMeshes: new Map(), traceMeshes: new Map() };
  let inHand = null, hand = new THREE.Group(), claws = null, torchHand = null;
  camera.add(hand);
  const ready = models.ready.then(() => {
    // meubles instanciés
    const byModel = new Map();
    for (const p of M.props) (byModel.get(p.m) || byModel.set(p.m, []).get(p.m)).push(p);
    for (const l of M.lockers) (byModel.get('locker') || byModel.set('locker', []).get('locker')).push({ x: l.x, z: l.z, y: l.y, rot: [Math.PI, Math.PI * 1.5, 0, Math.PI / 2][l.dir] });
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    for (const [name, list] of byModel) {
      const r = models.parts(name); if (!r) continue;
      for (const part of r.parts) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        list.forEach((p, i) => { pos.set(p.x, p.y, p.z); q.setFromAxisAngle(up, p.rot || 0); mx.compose(pos, q, one).multiply(part.mtx); im.setMatrixAt(i, mx); });
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
        scene.add(im);
      }
    }
    // l'ombre de contact des meubles : sans elle, ils flottent
    {
      const blobC = document.createElement('canvas'); blobC.width = blobC.height = 64;
      const bg = blobC.getContext('2d'), gr = bg.createRadialGradient(32, 32, 10, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.88)'); gr.addColorStop(0.62, 'rgba(0,0,0,.66)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      bg.fillStyle = gr; bg.fillRect(0, 0, 64, 64);
      const list = [...M.props.filter((p) => p.m !== 'pipes' && p.m !== 'spotlight'), ...M.lockers.map((l) => ({ m: 'locker', x: l.x, y: l.y, z: l.z, rot: [Math.PI, Math.PI * 1.5, 0, Math.PI / 2][l.dir] }))];
      const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
      const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobC), transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), list.length);
      const Sb = new THREE.Vector3();
      list.forEach((p, i) => { const sz = models.parts(p.m)?.size || one; pos.set(p.x, p.y + 0.004, p.z); q.setFromAxisAngle(up, p.rot || 0); Sb.set(sz.x * 1.4 + 0.2, 1, sz.z * 1.4 + 0.2); im.setMatrixAt(i, mx.compose(pos, q, Sb)); });
      im.computeBoundingSphere(); scene.add(im);
    }
    // clôtures
    const fr = models.parts('fence');
    if (fr) {
      const segs = [];
      const line = (x0, z0, x1, z1) => { const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 3.4); for (let i = 0; i < n; i++) segs.push({ x: x0 + (x1 - x0) * (i + 0.5) / n, z: z0 + (z1 - z0) * (i + 0.5) / n, rot: x0 === x1 ? Math.PI / 2 : 0 }); };
      line(3.5, 48, 3.5, 62.5); line(3.5, 62.5, 73.5, 62.5); line(73.5, 48, 73.5, 62.5); line(48.5, 48, 48.5, 62.5);
      for (const part of fr.parts) { const im = new THREE.InstancedMesh(part.geo, part.mat, segs.length); segs.forEach((s, i) => { pos.set(s.x, 0, s.z); q.setFromAxisAngle(up, s.rot); mx.compose(pos, q, one).multiply(part.mtx); im.setMatrixAt(i, mx); }); im.computeBoundingSphere(); scene.add(im); }
    }
    // lampe en main
    torchHand = inHandLook(models.mesh('flashlight', 0.62), 0.035);
    torchHand.position.set(-0.26, -0.27, -0.5); torchHand.rotation.y = Math.PI / 2;
    const glove = new THREE.MeshBasicMaterial({ color: 0x151310 }), sleeve = new THREE.MeshBasicMaterial({ color: 0x1f1a0d });
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.047, 10, 8), glove); fist.scale.set(1.1, 0.95, 1.25); fist.position.set(-0.262, -0.285, -0.44);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.068, 0.46, 10), sleeve); fore.position.set(-0.31, -0.42, -0.27); fore.rotation.set(1.1, 0, 0.3);
    hand.add(torchHand, fist, fore);
    torchHand.userData.arm = [fist, fore];
    // griffes du monstre
    claws = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b1512, roughness: 0.42, emissive: 0x2a0806, emissiveIntensity: 0.7 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 0.35, emissive: 0x40281a, emissiveIntensity: 0.7 });
    const blood = new THREE.MeshBasicMaterial({ color: 0x4a0503 });
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.062, 0.9, 7), dark); fore.rotation.x = Math.PI / 2 - 0.5; fore.position.set(0, -0.08, 0.14); arm.add(fore);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), dark); palm.scale.set(1.1, 0.5, 1.35); palm.position.set(0, 0.12, -0.3); arm.add(palm);
      for (const f of [-1.5, -0.5, 0.5, 1.5]) {
        const spread = -f * 0.13, x0 = f * 0.036;
        const phal = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.26, 6), dark); phal.rotation.set(-Math.PI / 2 + 0.3, 0, spread); phal.position.set(x0, 0.17, -0.45); arm.add(phal);
        const talon = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.3, 5), bone); talon.rotation.set(-Math.PI / 2 - 0.42, 0, spread * 1.3); talon.position.set(x0 * 1.45, 0.17, -0.66); arm.add(talon);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0145, 0.1, 5), blood); tip.rotation.copy(talon.rotation); tip.position.set(x0 * 1.45, 0.205, -0.59); arm.add(tip);
      }
      arm.position.set(s * 0.33, -0.34, -0.5); arm.userData.s = s;
      claws.add(arm);
    }
    claws.scale.setScalar(1.22); claws.visible = false; hand.add(claws);
  });

  // ---------------------------------------------------------------- personnages
  function makeActor(p) {
    const isM = p.role === 'm', src = isM ? 'animhuman' : 'hazmat';
    const root = new THREE.Group(), model = models.skinned(src);
    const a = { root, model, mixer: null, clips: {}, cur: null, isM, bones: {}, mats: [], heat: null };
    scene.add(root);
    if (!model) { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 4, 8), new THREE.MeshStandardMaterial({ color: isM ? 0x101010 : 0xc9962c })); b.position.y = 0.85; root.add(b); return a; }
    model.updateMatrixWorld(true);
    // la vraie hauteur se lit sur le squelette (les boîtes des maillages animés sont fausses)
    let top = 0, minY = 1e9; const v = new THREE.Vector3();
    model.traverse((o) => { if (o.isBone) { o.getWorldPosition(v); if (v.y > top) top = v.y; if (v.y < minY) minY = v.y; a.bones[o.name] = o; } });
    const h = top - minY || 1, k = (isM ? 2.8 : 1.72) / h;
    model.scale.multiplyScalar(k);
    if (isM) model.scale.x *= 0.76, model.scale.z *= 0.8;
    root.add(model);
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name === 'gun') { o.visible = false; return; }
      o.castShadow = true; o.frustumCulled = false;
      const m = o.material.clone();
      if (m.metalness !== undefined) { m.metalness = 0; m.roughness = 0.75; }
      if (isM) { m.color = new THREE.Color(0x1d1815); m.map = null; m.roughness = 0.3; }
      else { m.color = new THREE.Color(0xffffff).lerp(new THREE.Color(p.color), 0.35); }
      m.emissive = new THREE.Color(0xff3a10); m.emissiveIntensity = 0;
      grime(m, isM ? 0.5 : 0.8);
      o.material = m; a.mats.push(m);
    });
    a.mixer = new THREE.AnimationMixer(model);
    for (const c of models.anim(src)) { const n = c.name.split('|').pop().toLowerCase(); a.clips[n] = a.mixer.clipAction(c); }
    if (isM) {
      buildMonsterBody(a);
    }
    // aura de chaleur vue par le monstre
    a.heat = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff5a22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    a.heat.scale.set(1.5, 2.3, 1); a.heat.position.y = 0.95; root.add(a.heat);
    // faisceau de sa lampe
    if (!isM) { a.beam = new THREE.Mesh(beamGeo, beamMat); a.beam.position.y = 1.32; a.beam.visible = false; root.add(a.beam); }
    return a;
  }
  // Le corps est un humain étiré et sombre : tout ce qui fait peur s'accroche au squelette. Un visage pâle qu'on ne découvre qu'à la lampe,
  // des orbites noires, une bouche trop grande, une colonne qui perce le dos, des griffes qui traînent presque par terre.
  function buildMonsterBody(a) {
    const v = new THREE.Vector3();
    // chaque groupe travaille en mètres, quelle que soit l'échelle du squelette
    const onBone = (name, k = 1) => { const b = a.bones[name]; if (!b) return null; const g = new THREE.Group(); g.scale.setScalar(k / (Math.abs(b.getWorldScale(v).x) || 1)); b.add(g); return g; };
    const pale = new THREE.MeshStandardMaterial({ color: 0xa39a88, roughness: 0.46 }), hole = new THREE.MeshBasicMaterial({ color: 0x010101 }), toothM = new THREE.MeshStandardMaterial({ color: 0xcfc6a8, roughness: 0.4 }), boneM = new THREE.MeshStandardMaterial({ color: 0x8d8371, roughness: 0.42 }), clawM = new THREE.MeshStandardMaterial({ color: 0x12100e, roughness: 0.18 });
    grime(pale, 0.9);
    // la tête du modèle s'efface (l'os est réduit à presque rien) : ce crâne prend sa place
    const head = onBone('Head', 1.55 / HEAD_SHRINK);
    if (head) {
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), pale); skull.scale.set(0.86, 1.5, 0.96); skull.position.set(0, 0.1, 0.03); head.add(skull);
      const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), pale); jaw.scale.set(0.82, 0.9, 0.86); jaw.position.set(0, -0.075, 0.055); head.add(jaw);
      for (const s of [-1, 1]) {
        const sock = new THREE.Mesh(new THREE.SphereGeometry(0.031, 9, 7), hole); sock.scale.set(1, 1.4, 0.55); sock.position.set(s * 0.04, 0.125, 0.112); head.add(sock);
        // des yeux minuscules au fond des orbites, seule chose qu'on voit de lui dans le noir
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd9c2, fog: false })); e.position.set(s * 0.04, 0.122, 0.13); head.add(e);
        const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff5a3a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); g.scale.setScalar(0.04); e.add(g);
      }
      const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), hole); mouth.scale.set(0.84, 1.45, 0.34); mouth.position.set(0, -0.03, 0.112); head.add(mouth);
      for (let i = -3; i <= 3; i++) for (const up of [1, -1]) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.0055, 0.03, 4), toothM); t.rotation.x = up > 0 ? Math.PI : 0;
        t.position.set(i * 0.0118, -0.03 + up * (0.066 - Math.abs(i) * 0.009), 0.125 - Math.abs(i) * 0.003); head.add(t);
      }
      a.face = skull;
    }
    // la colonne qui perce le dos
    for (const [n, count] of [['Spine', 2], ['Spine1', 2], ['Spine2', 3], ['Neck', 1]]) {
      const g = onBone(n); if (!g) continue;
      for (let i = 0; i < count; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.13 + (i % 2) * 0.05, 5), boneM); c.rotation.x = -1.3; c.position.set(0, i * 0.07, -0.135); g.add(c); }
    }
    // griffes : le long du dernier os de la main
    for (const n of ['LeftHand', 'RightHand']) {
      const g = onBone(n); if (!g) continue;
      for (const f of [-1.5, -0.5, 0.5, 1.5]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.36, 5), clawM); c.position.set(f * 0.026, 0.2, 0.012); c.rotation.z = -f * 0.08; g.add(c); }
    }
    a.tilt = 0; a.tiltTo = 0.2; a.turn = 0; a.turnTo = 0; a.tw = 1; a.hitch = 0;
  }
  function playClip(a, name, once = false, speed = 1) {
    const c = a.clips[name]; if (!c || a.cur === c) { if (c) c.timeScale = speed; return; }
    c.reset(); c.timeScale = speed; c.enabled = true; c.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); c.clampWhenFinished = once; c.fadeIn(0.15).play();
    if (a.cur) a.cur.fadeOut(0.15);
    a.cur = c;
  }
  const updateActor = (p, dt, view) => {
    let a = R.actors.get(p.id);
    if (!a || a.isM !== (p.role === 'm')) { if (a) scene.remove(a.root); a = makeActor(p); R.actors.set(p.id, a); }
    const firstPerson = view.me && view.me.id === p.id && view.camMode === 'fps';
    const visible = !firstPerson && p.st !== 'out' && p.hide < 0 && !p.spectator;
    a.root.visible = visible;
    if (!visible) return;
    a.root.position.set(p.x, p.y, p.z);
    a.root.rotation.y = p.yaw + Math.PI;
    if (a.isM) {
      if (p.st === 'ok' && (p.atk || p.atkT > 0)) playClip(a, 'punch', true, 1.8);
      else if (p.stun > 0 || p.stunned) playClip(a, 'idle', false, 0.2);
      else if (p.moving) playClip(a, p.run ? 'run' : 'walk', false, p.run ? 1.05 : 1.25);
      else playClip(a, 'idle', false, 1);
      // il bouge par à-coups : le mouvement cale un instant, puis repart trop vite
      if ((a.hitch -= dt) < -0.5 - Math.random() * 1.4) a.hitch = 0.06 + Math.random() * 0.13;
      a.mixer && a.mixer.update(a.hitch > 0 ? 0 : dt * 1.1);
      // bras démesurés et corps voûté : après l'animation, on étire et on plie les os
      for (const n of ['LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm']) if (a.bones[n]) a.bones[n].scale.set(0.84, 1.26, 0.84);
      if (a.bones.LeftLeg) a.bones.LeftLeg.scale.set(0.74, 1, 0.74);
      if (a.bones.RightLeg) a.bones.RightLeg.scale.set(0.74, 1, 0.74);
      if (a.bones.LeftUpLeg) a.bones.LeftUpLeg.scale.set(0.76, 1, 0.76);
      if (a.bones.RightUpLeg) a.bones.RightUpLeg.scale.set(0.76, 1, 0.76);
      if (a.bones.Spine1) a.bones.Spine1.rotateX(0.3);
      if (a.bones.Spine2) a.bones.Spine2.rotateX(0.34);
      if (a.bones.Neck) a.bones.Neck.rotateX(-0.42);
      // la tête : elle penche, se fige, puis casse d'un coup vers un autre angle
      if ((a.tw -= dt) <= 0) { a.tw = 0.5 + Math.random() * 2.6; a.tiltTo = (Math.random() - 0.5) * 1.05; a.turnTo = (Math.random() - 0.5) * 0.7; }
      const snap = Math.min(1, dt * 26); a.tilt += (a.tiltTo - a.tilt) * snap; a.turn += (a.turnTo - a.turn) * snap;
      if (a.bones.Head) { a.bones.Head.scale.setScalar(HEAD_SHRINK); a.bones.Head.rotateZ(a.tilt); a.bones.Head.rotateY(a.turn); a.bones.Head.rotateX(-0.2); }
    } else {
      if (p.st === 'dead') playClip(a, 'death', true, 1);
      else if (p.st === 'down') playClip(a, 'death', true, 1.5);
      else if (p.moving) playClip(a, 'run_anydirection', false, p.run ? 1.3 : p.crouch ? 0.6 : 0.85);
      else playClip(a, 'idle', false, 1);
      a.mixer && a.mixer.update(dt);
      a.root.scale.y = p.crouch ? 0.72 : 1;
      if (a.beam) { a.beam.visible = p.st === 'ok' && p.torch && view.vision !== 'm'; a.beam.rotation.x = -p.pitch; }
    }
    const hot = view.vision === 'm' && !a.isM && p.st !== 'dead' && p.hide < 0;
    // pour lui, ils brûlent, et leur cœur bat
    const beat = 0.8 + Math.sin(time * 5.4 + p.id) * 0.25;
    for (const m of a.mats) m.emissiveIntensity = hot ? 1.5 * beat : 0;
    if (a.heat) a.heat.material.opacity = hot ? 0.55 * beat : 0;
  };

  // ---------------------------------------------------------------- objet en main
  // collé à la lampe, un objet tenu serait grillé : il garde une teinte sombre fixe, et le voyant de sa propre lampe
  function inHandLook(o, k = 0.085) {
    o.traverse((m) => {
      if (!m.isMesh || m.material.isMeshBasicMaterial) return;
      const old = m.material, c = (old.color ? old.color.clone() : new THREE.Color(0x888888)).multiplyScalar(k);
      m.material = new THREE.MeshBasicMaterial({ color: c, map: old.map || null });
    });
    return o;
  }
  function setHand(kind, role) {
    if (inHand && inHand.userData.kind === kind) return;
    if (inHand) { hand.remove(inHand); inHand = null; }
    if (torchHand) { torchHand.visible = role !== 'm'; for (const a of torchHand.userData.arm) a.visible = role !== 'm'; }
    if (claws) claws.visible = role === 'm';
    if (!kind) return;
    let o;
    if (kind === 'photo') { o = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.08, 0.045), new THREE.MeshBasicMaterial({ color: 0x1a1b1e })); const top = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.016, 0.045), new THREE.MeshBasicMaterial({ color: 0x3a3b3e })); top.position.y = 0.048; const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.048), new THREE.MeshBasicMaterial({ color: 0x18282e })); scr.position.set(-0.018, -0.003, 0.0235); const led = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.008), new THREE.MeshBasicMaterial({ color: 0xc73a2a })); led.position.set(0.045, 0.02, 0.0235); const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x8b8b8b })); f.position.set(0.04, 0.062, 0); o.add(b, top, scr, led, f); o.rotation.set(0.08, 0.1, 0); }
    else if (kind === 'emf') { o = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.03), new THREE.MeshStandardMaterial({ color: 0x2c2f22, roughness: 0.6 })); o.add(b); o.userData.leds = [0, 1, 2, 3, 4].map((i) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.016, 0.006), new THREE.MeshBasicMaterial({ color: 0x223322 })); l.position.set(0, -0.05 + i * 0.026, 0.017); o.add(l); return l; }); o.rotation.x = -0.9; }
    else if (kind === 'cams') { o = models.mesh('seccam', 0.55); o.rotation.y = Math.PI; }
    else if (kind === 'pile') o = models.mesh('battery', 0.8);
    else if (kind === 'bleu') { o = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.004), new THREE.MeshBasicMaterial({ color: 0x2d7ff0 })); o.rotation.x = -0.6; }
    else if (kind === 'orange') { o = models.mesh('key', 1.2); o.rotation.set(0.5, 0.6, 0); }
    else if (kind === 'fuse') { o = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0xc9a23a, roughness: 0.4, metalness: 0.3 })); b.rotation.z = Math.PI / 2; o.add(b); }
    else return;
    inHandLook(o);
    o.userData.kind = kind;
    o.position.set(0.27, -0.25, -0.5);
    inHand = o; hand.add(o);
  }

  // ---------------------------------------------------------------- objets du monde
  const itemGeo = {
    default: new THREE.BoxGeometry(0.16, 0.08, 0.1),
    preuve: new THREE.BoxGeometry(0.24, 0.03, 0.17),
  };
  const ITEM_COL = { bleu: 0x2d7ff0, orange: 0xf08a1d, fuse: 0xe2bd46, pile: 0x71d65d, preuve: 0xf4efe0, photo: 0x9aa0a8, emf: 0x9cc25a, cams: 0x8aa3b8 };
  function itemMesh(it) {
    const g = new THREE.Group();
    const name = it.k === 'pile' ? 'battery' : it.k === 'orange' ? 'key' : it.k === 'cams' ? 'seccam' : null;
    if (name) g.add(models.mesh(name, it.k === 'orange' ? 3 : 1));
    else g.add(new THREE.Mesh(it.k === 'preuve' ? itemGeo.preuve : itemGeo.default, new THREE.MeshStandardMaterial({ color: ITEM_COL[it.k] || 0x999999, roughness: 0.5, emissive: ITEM_COL[it.k] || 0, emissiveIntensity: 0.25 })));
    // petit reflet pour qu'on le repère à la lampe
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: ITEM_COL[it.k] || 0xffffff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(0.5); s.position.y = 0.12; g.add(s); g.userData.glow = s;
    g.position.set(it.x, it.y, it.z);
    scene.add(g);
    return g;
  }
  function syncSet(map, list, make, keep) {
    const seen = new Set();
    for (const o of list) { seen.add(o.id); let m = map.get(o.id); if (!m) { m = make(o); map.set(o.id, m); } keep && keep(o, m); }
    for (const [id, m] of map) if (!seen.has(id)) { scene.remove(m); map.delete(id); }
  }
  // un meuble pas encore fouillé accroche un petit reflet quand on s'en approche
  const glintMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffd488, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glints = M.caches.map((c) => { const s = new THREE.Sprite(glintMat.clone()); s.position.set(c.x, c.y + 0.95, c.z); s.scale.setScalar(0.3); s.visible = false; scene.add(s); return s; });
  const traceMat = new THREE.MeshBasicMaterial({ map: softSprite('rgba(120,255,150,.95)', 'rgba(60,255,120,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const traceGeo = new THREE.PlaneGeometry(1.5, 1.5); traceGeo.rotateX(-Math.PI / 2);

  // ---------------------------------------------------------------- image
  let wasCctv = false, time = 0, shake = 0, flashT = 0, eye = EYE, bob = 0, punch = 0, eyeExp = 1, fov = 72, lagX = 0, lagY = 0, prevYaw = null, prevPitch = 0, slowT = 0, dread = 0, spike = 0, jump = 0;
  const torchDir = new THREE.Vector3(0, 0, -1), right = new THREE.Vector3();
  const draw = (vhs, exposure, tear = 0, hunt = 0) => { if (post) post.render(scene, camera, { time, vhs, exposure, tear, hunt }); else { renderer.toneMappingExposure = exposure; renderer.render(scene, camera); } };
  const ve = new THREE.Vector3(), dir = new THREE.Vector3(), nearL = [];
  const lightStrength = { v: 1 };
  function frame(view, dt) {
    time += dt;
    const { w, players, me } = view;
    if (!w) { draw(1, 1); return; }
    // portes
    for (const D of doors) {
      const st = w.doors[D.d.id], want = st.open ? 1 : 0;
      D.t += Math.sign(want - D.t) * Math.min(Math.abs(want - D.t), dt * 2.6);
      for (const p of D.panels) { const off = D.t * D.d.cells.length / 2 * p.side * 0.98; p.b.position.x = p.base.x + (D.d.axis === 'x' ? off : 0); p.b.position.z = p.base.z + (D.d.axis === 'x' ? 0 : off); p.b.visible = D.t < 0.995; }
      D.led.material.color.setHex(st.jam > 0 ? 0xc040ff : D.d.key && !st.unlocked ? 0xff2a18 : 0x33ff66);
    }
    cabin.position.y = w.lift.y;
    callBtn.material.color.setHex(w.genOn ? (w.lift.state === 'moving' ? 0xffc531 : 0x33ff66) : 0x551108);
    genLeds.forEach((l, i) => l.material.color.setHex(i < (w.parts || 0) ? 0x33ff66 : 0x551108));
    genBar.scale.x = Math.max(0.01, w.gen / 100); genBar.material.color.setHex(w.genOn ? 0x33ff66 : 0xffc531);

    // objets
    syncSet(R.itemMeshes, w.items.filter((i) => !i.gone), itemMesh, (it, m) => { m.userData.glow.material.opacity = 0.3 + Math.sin(time * 3 + it.id) * 0.12; });
    syncSet(R.camMeshes, w.cams, (c) => { const m = models.mesh('seccam', 1); m.position.set(c.x, c.y - 0.1, c.z); m.rotation.y = c.yaw + Math.PI; const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2a18 })); led.position.set(0, 0.22, 0); m.add(led); scene.add(m); return m; });
    syncSet(R.traceMeshes, w.traces, (t) => { const m = new THREE.Mesh(traceGeo, traceMat.clone()); m.position.set(t.x, t.y + 0.03, t.z); m.rotation.y = t.id; scene.add(m); return m; }, (t, m) => { m.material.opacity = t.done ? 0.1 : view.emf ? 0.95 : 0.42 + Math.sin(time * 2 + t.id) * 0.1; });

    for (let i = 0; i < glints.length; i++) {
      const s = glints[i], c = M.caches[i];
      if (view.vision === 'm' || w.caches[i].done || !me || Math.abs(c.y - me.y) > 2.5) { s.visible = false; continue; }
      const d = Math.hypot(c.x - me.x, c.z - me.z);
      s.visible = d < 8;
      if (s.visible) s.material.opacity = (1 - d / 8) * (0.42 + Math.sin(time * 2.4 + i * 1.7) * 0.18);
    }

    for (const p of players) updateActor(p, dt, view);
    const mon = players.find((p) => p.role === 'm' && !p.spectator);

    // caméra
    const cctv = view.camMode === 'cctv' ? view.cctv : null;
    if (cctv) {
      camera.position.set(cctv.x, cctv.y + 0.15, cctv.z);
      camera.rotation.set(-0.35, (cctv.yaw || 0) + (view.pan || 0), 0, 'YXZ');
    } else if (me) {
      const target = me.role === 'm' ? EYE_M : me.st === 'down' ? EYE_DOWN : me.crouch ? EYE_CROUCH : EYE;
      eye += (target - eye) * Math.min(1, dt * 9);
      bob += dt * (me.moving ? (me.run ? 12.5 : 8.5) : 0);
      const isM = me.role === 'm';
      const by = (me.moving ? Math.sin(bob) * (isM ? 0.075 : me.run ? 0.04 : 0.024) : 0) + (isM ? Math.sin(time * 1.9) * 0.022 : 0), bx = me.moving ? Math.cos(bob * 0.5) * (me.run ? 0.024 : 0.013) : 0;
      shake = Math.max(0, shake - dt * 3);
      const shk = shake * shake * 0.09;
      // l'enquêteur tient sa caméra à la main : ça respire, et davantage quand il est essoufflé. Le monstre, lui, souffle lourdement.
      const puff = isM ? 1.7 : 1 + (1 - (me.stam ?? 100) / 100) * 2.4 + (me.hide >= 0 ? 1 : 0);
      const swP = (Math.sin(time * 0.83) * 0.0034 + Math.sin(time * 2.11 + 1) * 0.0012) * puff, swY = (Math.sin(time * 0.57 + 2) * 0.0036 + Math.sin(time * 1.73) * 0.0011) * puff, swR = Math.sin(time * 0.43 + 4) * 0.0042 * puff + (me.moving && !isM ? Math.cos(bob * 0.5) * (me.run ? 0.011 : 0.0055) : 0);
      camera.position.set(me.x + Math.cos(me.yaw) * bx, me.y + eye + by + (Math.random() - 0.5) * shk, me.z - Math.sin(me.yaw) * bx);
      camera.rotation.set(me.pitch + swP + (Math.random() - 0.5) * shk * 0.5, me.yaw + swY + (Math.random() - 0.5) * shk * 0.5, swR + (me.st === 'down' ? 0.55 : 0), 'YXZ');
      const wantFov = jump > 0 ? 50 : isM ? (me.run && me.moving ? 96 : 88) : me.run && me.moving ? 77 : 72;
      fov += (wantFov - fov) * Math.min(1, dt * 5);
      if (Math.abs(camera.fov - fov) > 0.02) { camera.fov = fov; camera.updateProjectionMatrix(); }
      if (me.hide >= 0) camera.position.y = me.y + 1.55;
      // la mise à terre : la vue est arrachée vers son visage, à quelques dizaines de centimètres
      jump = Math.max(0, jump - dt);
      const ma = jump > 0 && mon ? R.actors.get(mon.id) : null;
      if (ma && ma.bones.Head) {
        ma.bones.Head.getWorldPosition(ve);
        const fx = -Math.sin(mon.yaw), fz = -Math.cos(mon.yaw);
        dir.set(ve.x + fx * 0.72, ve.y - 0.02, ve.z + fz * 0.72);
        camera.position.lerp(dir, clamp01(1.25 - jump * 0.1)).add(dir.set(Math.random() - 0.5, Math.random() - 0.5, 0).multiplyScalar(0.018));
        camera.lookAt(ve);
      }
    }
    camera.updateMatrixWorld();

    // en main
    hand.visible = view.camMode === 'fps' && !!me && me.st === 'ok' && me.hide < 0 && view.mine;
    if (hand.visible) {
      const kind = me.role === 'm' ? null : me.inv?.[me.sel]?.k || null;
      setHand(kind, me.role);
      punch = Math.max(0, punch - dt * 3.5);
      // la main suit le regard avec un temps de retard
      let dy = prevYaw == null ? 0 : me.yaw - prevYaw; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
      const dpi = prevYaw == null ? 0 : me.pitch - prevPitch; prevYaw = me.yaw; prevPitch = me.pitch;
      const lk = Math.min(1, dt * 9);
      lagX += (clampN(dy * 0.55, -0.09, 0.09) - lagX) * lk; lagY += (clampN(dpi * 0.55, -0.07, 0.07) - lagY) * lk;
      hand.position.set((me.moving ? Math.cos(bob * 0.5) * 0.01 : 0) + lagX * 0.5, (me.moving ? Math.abs(Math.sin(bob)) * 0.012 : Math.sin(time) * 0.003) - (me.run ? 0.05 : 0) - lagY * 0.5, 0);
      hand.rotation.set(lagY * 0.8, lagX * 0.8, 0);
      if (torchHand) { torchHand.visible = me.role !== 'm'; }
      if (claws) { claws.visible = me.role === 'm'; for (const a of claws.children) { const s = a.userData.s, sw = punch, step = me.moving ? Math.sin(bob * 0.5 + (s > 0 ? 0 : Math.PI)) : 0; a.rotation.x = step * 0.12 + Math.sin(time * 1.9) * 0.03; a.rotation.z = s * sw * 0.2; a.rotation.y = -s * sw * 1.3; a.position.z = -0.5 - sw * 0.2 + step * 0.05; a.position.x = s * (0.36 - sw * 0.25); a.position.y = -0.3 + sw * 0.14 + Math.sin(time * 1.9 + s) * 0.012; } }
      if (inHand && inHand.userData.leds) inHand.userData.leds.forEach((l, i) => l.material.color.setHex(i < (view.emfLevel || 0) ? (i > 2 ? 0xff3a18 : 0x7dff5a) : 0x1a2a1a));
    }

    // vision
    const vision = cctv ? 'cctv' : view.vision;
    const zn = me ? zoneAt(M, me.x, me.z) : Z.A, outside = !cctv && (zn === Z.OUTPOST || zn === Z.PAD);
    const fogK = vision === 'm' ? 0.035 : vision === 'cctv' ? 0.035 : outside ? 0.032 : 0.075;
    scene.fog.density += (fogK - scene.fog.density) * Math.min(1, dt * 2);
    scene.fog.color.setHex(vision === 'm' ? 0x090204 : outside ? 0x060a12 : 0x020408);
    scene.background.copy(scene.fog.color);
    const amb = vision === 'm' ? 1.5 : vision === 'cctv' ? 1.1 : outside ? 0.3 : 0.03;
    ambient.intensity += (amb - ambient.intensity) * (vision === 'cctv' || wasCctv ? 1 : Math.min(1, dt * 3));
    if (vision === 'cctv' || wasCctv) scene.fog.density = fogK;
    wasCctv = vision === 'cctv';
    ambient.color.setHex(vision === 'm' ? 0xc9b0a8 : vision === 'cctv' ? 0xb8d8c0 : 0x8fa4c8);

    // lampes de secours : les plus proches, éteintes dans une zone coupée (le courant revenu les renforce)
    const cx = camera.position.x, cz = camera.position.z;
    nearL.length = 0;
    for (const g of glows) {
      const l = g.l, dark = w.dark && w.dark[l.zone] > 0;
      let k = dark ? 0 : flick(l, time) * (w.genOn && l.kind !== 'projecteur' ? 1.5 : 1);
      // sa présence fait mourir les lampes : elles crépitent, puis s'éteignent quand il passe dessous
      if (k > 0 && mon && !mon.wake && vision !== 'm' && l.kind !== 'projecteur') {
        const dm = Math.hypot(l.x - mon.x, l.z - mon.z);
        if (dm < 9 && Math.abs(l.y - mon.y) < 5) k *= dm < 3 ? 0.04 : Math.sin(time * 37 + l.phase) * Math.sin(time * 11 + l.phase * 3) > (dm - 3) / 7 - 0.25 ? 0.12 : 0.7;
      }
      g.k = k;
      g.s.material.opacity = 0.5 * k; g.fix.material.color.setHex(LCOL[l.kind]).multiplyScalar(Math.max(0.05, k));
      const d = Math.hypot(l.x - cx, l.z - cz) + Math.abs(l.y - camera.position.y) * 2;
      if (k > 0.03 && d < 34) nearL.push({ g, d });
    }
    nearL.sort((a, b) => a.d - b.d);
    pool.forEach((pl, i) => {
      const n = nearL[i];
      if (!n) { pl.intensity = 0; return; }
      const l = n.g.l;
      pl.position.set(l.x, l.y - 0.15, l.z); pl.color.setHex(LCOL[l.kind]); pl.distance = LDIST[l.kind];
      pl.intensity = (l.power ?? LPOW[l.kind]) * n.g.k * (vision === 'm' ? 0.35 : 1);
    });
    for (const s of puffs) s.material.opacity = 0.05 * (w.dark && w.dark[s.userData.l.zone] ? 0 : 1);

    // il approche : on le sent avant de le voir
    let dreadWant = 0;
    if (mon && !mon.wake && vision !== 'm' && Math.abs(mon.y - camera.position.y) < 5) dreadWant = clamp01(1 - Math.hypot(mon.x - cx, mon.z - cz) / 14);
    dread += (dreadWant - dread) * Math.min(1, dt * 2.2);
    spike = Math.max(0, spike - dt * 1.1);

    // ma lampe
    const seeTorch = me && me.st === 'ok' && me.torch && me.role !== 'm' && !cctv && vision !== 'm';
    let tk = 0;
    if (seeTorch) {
      const low = me.batt < 15 ? (Math.sin(time * 23) * Math.sin(time * 7) > 0.2 ? 0.25 : 0.8) : 1;
      tk = (me.batt < 30 ? 14 + me.batt * 0.93 : 42) * low;
      // contre un mur, le faisceau n'éblouit pas : il faiblit avec la distance au premier obstacle
      let d = 3;
      const sx = -Math.sin(me.yaw), sz = -Math.cos(me.yaw);
      for (let r = 0.2; r < 3; r += 0.2) { const i = Math.floor(me.z + sz * r) * W + Math.floor(me.x + sx * r); if (M.t[i] !== T.FLOOR) { d = r; break; } }
      tk *= clamp01(d * d / 7 + 0.05);
      // et elle se met à faiblir quand il est tout près
      const fear = Math.max(dread, spike);
      if (fear > 0.12 && Math.sin(time * 29) * Math.sin(time * 13.3 + 1) > 1 - fear * 0.72) tk *= 0.18;
    }
    // sous son nez, la lampe éclaire son visage de plein fouet
    if (jump > 0 && view.vision !== 'm') tk = 34 * (Math.sin(time * 41) > -0.5 ? 1 : 0.3);
    torch.intensity = tk;
    torch.color.setHex(me && me.batt < 25 ? 0xffc48a : 0xfff1d6);
    camera.getWorldDirection(dir);
    // la lampe est tenue en main gauche, un peu plus bas : elle suit le regard avec du retard, et les ombres bougent pour de vrai
    torchDir.lerp(dir, 1 - Math.exp(-dt * 15)).normalize();
    right.crossVectors(dir, camera.up).normalize();
    torch.position.copy(camera.position).addScaledVector(right, -0.18).addScaledVector(dir, 0.12); torch.position.y -= 0.24;
    torch.target.position.copy(torch.position).addScaledVector(torchDir, 8);
    if (jump > 0) { torch.position.copy(camera.position); torch.target.position.copy(camera.position).addScaledVector(dir, 8); }
    ownBeam.visible = tk > 0;
    if (tk > 0) { ownBeam.position.copy(torch.position); ownBeam.lookAt(torch.target.position); }
    renderer.shadowMap.autoUpdate = tk > 0;

    // lampes des autres, seulement s'ils sont en vue
    let oi = 0;
    for (const p of players) {
      if (oi >= others.length || p === me || p.role === 'm' || p.st !== 'ok' || !p.torch || p.hide >= 0) continue;
      if (Math.hypot(p.x - cx, p.z - cz) > 28 || !hasLOS(M, w.doors, cx, cz, p.x, p.z)) continue;
      const s = others[oi++];
      s.intensity = vision === 'm' ? 6 : 24;
      s.position.set(p.x, p.y + 1.35, p.z);
      s.target.position.set(p.x - Math.sin(p.yaw) * Math.cos(p.pitch) * 8, p.y + 1.35 + Math.sin(p.pitch) * 8, p.z - Math.cos(p.yaw) * Math.cos(p.pitch) * 8);
    }
    for (; oi < others.length; oi++) others[oi].intensity = 0;

    // éclair
    flashT = Math.max(0, flashT - dt * 5);
    flashLight.intensity = flashT * flashT * 220;

    // poussière
    dust.position.set(cx, camera.position.y, cz);
    const P = dustG.attributes.position.array;
    for (let i = 0; i < dustN; i++) { P[i * 3 + 1] -= dt * 0.03; if (P[i * 3 + 1] < -3) P[i * 3 + 1] = 3; P[i * 3] += Math.sin(time * 0.4 + i) * dt * 0.05; }
    dustG.attributes.position.needsUpdate = true;
    dust.material.opacity = vision === 'm' ? 0.1 : 0.22;

    // l'œil s'habitue au noir en quelques secondes, et se referme vite à la lumière
    const wantExp = vision === 'm' ? 1.2 : vision === 'cctv' ? 1.25 : outside ? 1 : tk > 0 ? 1 : 1.9;
    eyeExp += (wantExp - eyeExp) * Math.min(1, dt * (wantExp > eyeExp ? 0.22 : 1.6));
    // si la machine peine, on baisse la définition plutôt que les images par seconde
    if (dt > 1 / 26) slowT += dt; else slowT = Math.max(0, slowT - dt * 0.5);
    if (slowT > 4 && pixel > 0.62) { slowT = 0; pixel = Math.max(0.6, pixel * 0.85); renderer.setPixelRatio(pixel); resize(); if (pixel < 0.75 && post) post.setBloom(false); }
    const tear = vision === 'm' ? 0 : clamp01(Math.max(dread * dread * 0.6, jump > 0 ? 0.4 : spike));
    draw(vision === 'm' ? 0 : vision === 'cctv' ? 1.7 : 1 + tear * 0.8, eyeExp, tear, vision === 'm' ? 1 : 0);
  }

  return {
    ready, frame, models, camera,
    fx: {
      flash(x, y, z) { flashLight.position.set(x, y, z); flashT = 1; },
      hurt() { shake = 1; },
      shake(v) { shake = Math.max(shake, v); },
      swing() { punch = 1; },
      dread(v) { spike = Math.max(spike, v); },
      jump(sec = 1.5) { jump = sec; shake = 1; spike = 1; },
    },
    setQuality(q) { pixel = Math.min(devicePixelRatio || 1, q === 'haut' ? 1.5 : q === 'bas' ? 0.8 : 1.15); renderer.setPixelRatio(pixel); resize(); },
    domElement: renderer.domElement,
    dispose() { removeEventListener('resize', resize); post && post.dispose(); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); renderer.domElement.remove(); },
  };
}
