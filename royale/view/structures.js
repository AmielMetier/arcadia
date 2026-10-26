// Les bâtiments en 3D, construits avec les mêmes pans que le monde solide (engine/world.js) : un pan = une instance
// (mur, fenêtre, porte, portail, mur cassé ; cloisons), une dalle par rangée de cases, un escalier par étage.
// Toute l'île tient en une vingtaine de maillages instanciés ; chaque pan garde son numéro d'instance pour pouvoir
// être cassé plus tard. Face extérieure à la couleur du bâtiment, face intérieure en plâtre (attribut aSide).
// Les toits en pente et les pignons sont fusionnés en deux maillages pour toute l'île.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL, STOREY } from '../engine/buildings.js';
import { panelSolids, WALL_T, INNER_T, SLAB_T, BASE_UP, ROOF_SLOPE, levelH, floorY } from '../engine/world.js';
import { makeRng } from '../engine/rng.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';

// couleurs des façades selon le matériau (variées d'un bâtiment à l'autre)
const FACADES = {
  pierre: [0xe8dcc4, 0xdccaa6, 0xcda47f, 0xb8604a, 0xdfd6c9, 0xaebbc1, 0xe6c9a8],
  bois: [0xa8744a, 0x8c5f3c, 0xbb976b, 0x6f8a6a, 0x9b4f3c, 0x7d6a55],
  metal: [0x9aa9b2, 0xb7bbb7, 0x7f919b, 0xc4b38a, 0x8fa38c],
};
const INTERIOR = { pierre: 0xefe7d8, bois: 0xd9bf94, metal: 0xc9ccc8 };
const FLOORS = [0xc39a6b, 0xb0855a, 0xd2b48a, 0xa9a49a, 0xcfc6b5];
const ROOFS = { pierre: [0xb9543d, 0xa8472f, 0x9c5b40, 0x7d6a64], bois: [0x7d5435, 0x6b4a32, 0x5f5a52], metal: [0x7f949f, 0x8c9a91, 0x6d7d86] };

// ------------------------------------------------------------------ textures peintes (motif clair multiplié par la couleur)
function canvasTex(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const grain = (g, S, n, a) => { for (let i = 0; i < n; i++) { const v = 200 + Math.random() * 55; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); } };
const TEX = {
  // enduit : légères assises de pierre
  pierre: () => canvasTex((g, S) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, S, S); grain(g, S, 2500, 0.5);
    g.strokeStyle = 'rgba(150,150,150,.28)'; g.lineWidth = 2;
    for (let y = 0; y < S; y += S / 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); for (let x = (y / (S / 8)) % 2 ? S / 8 : 0; x < S; x += S / 4) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + S / 8); g.stroke(); } }
  }),
  // planches horizontales
  bois: () => canvasTex((g, S) => {
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += S / 10) {
      const v = 215 + Math.random() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, S, S / 10 - 3);
      g.fillStyle = 'rgba(80,80,80,.45)'; g.fillRect(0, y + S / 10 - 3, S, 3);
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(120,120,120,.18)'; g.fillRect(Math.random() * S, y + 2 + Math.random() * (S / 10 - 8), 30 + Math.random() * 60, 1.5); }
    }
  }),
  // tôle ondulée
  metal: () => canvasTex((g, S) => {
    for (let x = 0; x < S; x++) { const v = 205 + 45 * Math.sin((x / S) * Math.PI * 2 * 12); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, S); }
    grain(g, S, 800, 0.25);
  }),
  // parquet
  parquet: () => canvasTex((g, S) => {
    for (let x = 0; x < S; x += S / 8) for (let y = 0; y < S; y += S / 2) {
      const yy = y + ((x / (S / 8)) % 2 ? S / 4 : 0), v = 200 + Math.random() * 50;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, yy % S, S / 8 - 2, S / 2 - 2); g.fillRect(x, (yy % S) - S, S / 8 - 2, S / 2 - 2);
    }
  }),
  // tuiles (rangées décalées)
  tuiles: () => canvasTex((g, S) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += S / 8) for (let x = ((y / (S / 8)) % 2) * S / 16; x < S + S / 8; x += S / 8) {
      const v = 190 + Math.random() * 60; g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath(); g.ellipse(x, y + S / 10, S / 17, S / 9, 0, 0, Math.PI); g.fill();
    }
  }),
  // gravier des toits plats
  gravier: () => canvasTex((g, S) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, S, S); grain(g, S, 4000, 0.6); }),
};

// ------------------------------------------------------------------ géométries
// constructeur : boîtes à faces séparées, UV en mètres / 2, aSide par face
function builder() {
  const pos = [], nor = [], uv = [], side = [], idx = [];
  return {
    box(x0, y0, z0, x1, y1, z1, sideOf = () => 1) {
      const F = [
        [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
        [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
        [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
        [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
        [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]],
        [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
      ];
      for (const [a, b, c, d, n] of F) {
        const k = pos.length / 3, s = sideOf(n);
        for (const p of [a, b, c, d]) {
          pos.push(...p); nor.push(...n); side.push(s);
          // projection planaire selon la normale (texture à l'échelle du monde, 2 m par motif)
          if (n[2]) uv.push(p[0] / 2, p[1] / 2); else if (n[0]) uv.push(p[2] / 2, p[1] / 2); else uv.push(p[0] / 2, p[2] / 2);
        }
        idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
    },
    geo() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
      g.setIndex(idx); g.computeBoundingSphere();
      return g;
    },
  };
}
// pan de 4 m sur un étage normal ; +z = dehors
function panelGeo(kind, T, exterior) {
  const B = builder();
  for (const [u0, u1, v0, v1] of panelSolids(kind, STOREY)) B.box(u0, v0, -T / 2, u1, v1, T / 2, (n) => (exterior ? (n[2] < 0 ? 0 : 1) : 0));
  return B.geo();
}
function stairGeo() {
  // dix marches minces, deux limons et une sous-face inclinée (le dessous reste libre : on passe sous l'escalier
  // de l'étage au-dessus)
  const parts = [], n = 10, a = Math.atan2(STOREY, CELL), L = Math.hypot(STOREY, CELL);
  for (let i = 0; i < n; i++) { const y = (STOREY / n) * (i + 1); parts.push(new THREE.BoxGeometry(CELL - 0.6, 0.12, CELL / n + 0.02).translate(CELL / 2, y - 0.06, (CELL / n) * (i + 0.5))); }
  for (const x of [0.22, CELL - 0.22]) parts.push(new THREE.BoxGeometry(0.16, 0.5, L).rotateX(-a).translate(x, STOREY / 2 - 0.12, CELL / 2));
  parts.push(new THREE.BoxGeometry(CELL - 0.6, 0.06, L).rotateX(-a).translate(CELL / 2, STOREY / 2 - 0.3, CELL / 2));
  const g = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return g;
}
const unitBox = (sideOf) => { const B = builder(); B.box(0, 0, 0, 1, 1, 1, sideOf); return B.geo(); };

// matériau à deux faces de couleur : aSide = 1 → couleur de l'instance, 0 → couleur uniforme (intérieur).
// glow : lumière propre des faces intérieure (0) et extérieure (1) — les pièces restent lisibles loin des fenêtres
function twoTone(map, inner, extra = {}, glow = [0.32, 0], plainInner = false) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, ...extra });
  const U = { uInner: { value: new THREE.Color(inner) }, uGlow: { value: new THREE.Vector2(...glow) }, uPlain: { value: plainInner ? 1 : 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSide; uniform vec3 uInner; varying float vSide;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor = mix(uInner, vColor, aSide); vSide = aSide;')
      // texture plaquée selon la position dans le monde (2 m par motif) : les boîtes étirées (planchers, poteaux,
      // garde-corps) gardent un motif à la bonne taille
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        {
          vec4 wp4 = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wp4 = instanceMatrix * wp4; wn = mat3(instanceMatrix) * wn;
          #endif
          wp4 = modelMatrix * wp4; wn = abs(normalize(mat3(modelMatrix) * wn));
          #ifdef USE_MAP
            vMapUv = wn.y > 0.5 ? wp4.xz * 0.5 : (wn.x > wn.z ? wp4.zy * 0.5 : wp4.xy * 0.5);
          #endif
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uGlow; uniform float uPlain; varying float vSide;')
      // plafonds unis (le dessous des dalles ne prend pas le parquet)
      .replace('#include <map_fragment>', '#include <map_fragment>\nif (uPlain > 0.5 && vSide < 0.5) diffuseColor.rgb = diffuse;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * mix(uGlow.x, uGlow.y, vSide);');
  };
  m.customProgramCacheKey = () => 'royale-twotone';
  m.userData.inner = U.uInner;
  return m;
}

export function buildStructures(map) {
  const rng = makeRng(map.seed * 13 + 5);
  const tex = Object.fromEntries(Object.keys(TEX).map((k) => [k, TEX[k]()]));
  const mats = {}, geos = {};
  for (const mat of ['pierre', 'bois', 'metal']) mats[mat] = twoTone(tex[mat], INTERIOR[mat], { roughness: mat === 'metal' ? 0.6 : 0.9, metalness: mat === 'metal' ? 0.25 : 0 });
  mats.floor = twoTone(tex.parquet, 0xf3efe6, {}, [0.32, 0.28], true);
  mats.roof = twoTone(tex.gravier, 0xf3efe6, {}, [0.32, 0], true);
  mats.socle = twoTone(tex.parquet, 0x8d877c, {}, [0, 0.28]);
  mats.stairs = new THREE.MeshStandardMaterial({ map: tex.parquet, color: 0xb98c5e, roughness: 0.85, emissive: 0x3a2a1a });
  for (const k of ['mur', 'fenetre', 'porte', 'portail', 'casse']) geos['ext:' + k] = panelGeo(k, WALL_T, true);
  for (const k of ['mur', 'porte']) geos['int:' + k] = panelGeo(k, INNER_T, false);
  geos.slab = unitBox((n) => (n[1] > 0 ? 1 : 0));        // socle : dessus = plancher, côtés en pierre
  geos.deck = unitBox((n) => (n[1] < 0 ? 0 : 1));        // dalles d'étage et de toit : seul le dessous est un plafond
  geos.box = unitBox(() => 1);
  geos.stairs = stairGeo();
  geos.parapet = unitBox(() => 1);

  // listes d'instances : clé "géométrie|matériau" → [{ m: matrice, c: couleur, ref }]
  const lists = new Map();
  const push = (geo, mat, m, c, ref) => { const key = geo + '|' + mat; if (!lists.has(key)) lists.set(key, []); lists.get(key).push({ m, c, ref }); };
  const M4 = () => new THREE.Matrix4();
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  const place = (x, y, z, rot, sx = 1, sy = 1, sz = 1) => { q.setFromAxisAngle(up, rot); v.set(x, y, z); s.set(sx, sy, sz); return M4().compose(v, q, s); };
  const color = (h) => new THREE.Color(h);

  // toits en pente et pignons, fusionnés
  const roofPos = [], roofCol = [], roofUv = [], gabPos = [], gabCol = [];
  const lanterns = [];

  for (const b of map.buildings) {
    const H = levelH(b), sy = H / STOREY, mat = b.mat;
    let face = color(FACADES[mat][rng.int(0, FACADES[mat].length - 1)]);
    if (b.type === 'grange') face = color(0x9b3f30);
    if (b.type === 'phare') face = color(0xf2efe6);
    if (b.abandoned) face.lerp(color(0x6e6a62), 0.45);
    const floorC = color(FLOORS[rng.int(0, FLOORS.length - 1)]);
    const X0 = b.x0 * CELL, Z0 = b.z0 * CELL, X1 = (b.x0 + b.w) * CELL, Z1 = (b.z0 + b.d) * CELL;
    // socle (plancher du rez-de-chaussée) : boîte unité étirée sur l'emprise
    push('slab', 'socle', place(X0, b.y - 3, Z0, 0, X1 - X0, 3 + BASE_UP, Z1 - Z0), floorC, { b: b.id });
    const nodes = new Set();
    for (let k = 0; k < b.floors; k++) {
      const lv = b.levels[k], F = floorY(b, k);
      for (const e of lv.walls) {
        const key = (e.ext ? 'ext:' : 'int:') + (e.ext ? e.k : e.k === 'porte' ? 'porte' : 'mur');
        let x = e.x * CELL, z = e.z * CELL, rot = 0;
        if (e.ext) {
          if (e.o === 'h') { if (e.z === b.z0) { rot = Math.PI; x += CELL; } }
          else if (e.x === b.x0) rot = -Math.PI / 2; else { rot = Math.PI / 2; z += CELL; }
        } else if (e.o === 'v') rot = -Math.PI / 2;
        push(key, mat, place(x, F, z, rot, 1, sy, 1), face, { b: b.id, k, e });
        if (e.ext) { nodes.add(e.x + ',' + e.z); nodes.add(e.o === 'h' ? (e.x + 1) + ',' + e.z : e.x + ',' + (e.z + 1)); }
      }
      if (k > 0) rows(b, lv.hole, (x0, x1, z) => push('deck', 'floor', place(x0 * CELL, F - SLAB_T, z * CELL, 0, (x1 - x0) * CELL, SLAB_T, CELL), floorC, { b: b.id, k }));
      if (lv.stairs) {
        const st = lv.stairs;
        // la géométrie monte vers +z : on la tourne dans le sens de l'escalier
        const rot = st.dz > 0 ? 0 : st.dz < 0 ? Math.PI : st.dx > 0 ? Math.PI / 2 : -Math.PI / 2;
        const cx = (st.x + 0.5) * CELL, cz = (st.z + 0.5) * CELL;
        const m = place(cx, F, cz, rot, 1, sy, 1).multiply(M4().makeTranslation(-CELL / 2, 0, -CELL / 2));
        push('stairs', 'stairs', m, null, { b: b.id, k });
      }
    }
    const top = floorY(b, b.floors);
    for (const n of nodes) {
      const [x, z] = n.split(',').map(Number);
      push('box', mat, place(x * CELL - WALL_T / 2, b.y, z * CELL - WALL_T / 2, 0, WALL_T, top - b.y, WALL_T), face, { b: b.id });
    }
    // toit plat : dalle de gravier + garde-corps ; toit en pente : plafond + deux pans + pignons
    const roofC = color(ROOFS[mat][rng.int(0, ROOFS[mat].length - 1)]);
    if (b.roof !== 'pente') {
      rows(b, b.roofHatch || null, (x0, x1, z) => push('deck', 'roof', place(x0 * CELL, top - SLAB_T, z * CELL, 0, (x1 - x0) * CELL, SLAB_T, CELL), color(0xb7b4ac), { b: b.id }));
      const pc = face.clone().multiplyScalar(0.92);
      push('parapet', mat, place(X0 - WALL_T / 2, top, Z0 - WALL_T / 2, 0, X1 - X0 + WALL_T, 1, WALL_T), pc, { b: b.id });
      push('parapet', mat, place(X0 - WALL_T / 2, top, Z1 - WALL_T / 2, 0, X1 - X0 + WALL_T, 1, WALL_T), pc, { b: b.id });
      push('parapet', mat, place(X0 - WALL_T / 2, top, Z0, 0, WALL_T, 1, Z1 - Z0), pc, { b: b.id });
      push('parapet', mat, place(X1 - WALL_T / 2, top, Z0, 0, WALL_T, 1, Z1 - Z0), pc, { b: b.id });
      if (b.roof === 'phare') lanterns.push({ x: (X0 + X1) / 2, y: top, z: (Z0 + Z1) / 2 });
    } else {
      rows(b, null, (x0, x1, z) => push('deck', 'roof', place(x0 * CELL, top - SLAB_T, z * CELL, 0, (x1 - x0) * CELL, SLAB_T, CELL), color(0xb7b4ac), { b: b.id }));
      const alongX = b.w >= b.d, o = 0.5; // débord du toit
      const half = (alongX ? Z1 - Z0 : X1 - X0) / 2, rise = half * ROOF_SLOPE, drop = o * ROOF_SLOPE;
      const rc = [roofC.r, roofC.g, roofC.b];
      if (b.abandoned) for (let i = 0; i < 3; i++) rc[i] *= 0.7;
      const quad = (a, bb, c, d) => {
        for (const p of [a, bb, c, a, c, d]) { roofPos.push(...p); roofCol.push(...rc); }
        // UV : le long du faîtage et dans la pente, en mètres / 2
        const L = Math.hypot(bb[0] - a[0], bb[2] - a[2]), Hs = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
        for (const [u, w] of [[0, 0], [L, 0], [L, Hs], [0, 0], [L, Hs], [0, Hs]]) roofUv.push(u / 2, w / 2);
      };
      const tri = (a, bb, c) => { for (const p of [a, bb, c]) { gabPos.push(...p); gabCol.push(face.r, face.g, face.b); } };
      const ty = top - drop, ry = top + rise;
      if (alongX) {
        const zm = (Z0 + Z1) / 2;
        quad([X0 - o, ty, Z0 - o], [X1 + o, ty, Z0 - o], [X1 + o, ry, zm], [X0 - o, ry, zm]);
        quad([X1 + o, ty, Z1 + o], [X0 - o, ty, Z1 + o], [X0 - o, ry, zm], [X1 + o, ry, zm]);
        tri([X0, top, Z1], [X0, top, Z0], [X0, ry - 0.05, zm]); tri([X1, top, Z0], [X1, top, Z1], [X1, ry - 0.05, zm]);
      } else {
        const xm = (X0 + X1) / 2;
        quad([X0 - o, ty, Z1 + o], [X0 - o, ty, Z0 - o], [xm, ry, Z0 - o], [xm, ry, Z1 + o]);
        quad([X1 + o, ty, Z0 - o], [X1 + o, ty, Z1 + o], [xm, ry, Z1 + o], [xm, ry, Z0 - o]);
        tri([X0, top, Z0], [X1, top, Z0], [xm, ry - 0.05, Z0]); tri([X1, top, Z1], [X0, top, Z1], [xm, ry - 0.05, Z1]);
      }
    }
  }

  // ------------------------------------------------------------------ maillages instanciés
  const group = new THREE.Group();
  const index = new Map(); // pan → { mesh, i } (pour casser un pan plus tard)
  for (const [key, list] of lists) {
    const [g, m] = key.split('|');
    const im = new THREE.InstancedMesh(geos[g], mats[m], list.length);
    list.forEach((it, i) => {
      im.setMatrixAt(i, it.m);
      if (it.c) im.setColorAt(i, it.c);
      if (it.ref && it.ref.e) index.set(it.ref.b + ':' + it.ref.k + ':' + it.ref.e.o + it.ref.e.x + ',' + it.ref.e.z, { mesh: im, i });
    });
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }
  const roofTex = tex.tuiles;
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const gableMat = new THREE.MeshStandardMaterial({ map: tex.pierre, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  if (roofPos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(roofPos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(roofCol, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(roofUv, 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, roofMat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  if (gabPos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(gabPos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(gabCol, 3));
    const uvs = []; for (let i = 0; i < gabPos.length; i += 3) uvs.push((gabPos[i] + gabPos[i + 2]) / 2, gabPos[i + 1] / 2);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, gableMat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  // lanterne des phares : galerie, vitrage lumineux, chapeau rouge
  const extra = [];
  for (const L of lanterns) {
    const gal = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.25, 24), new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.6 }));
    gal.position.set(L.x, L.y + 0.1, L.z);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.4, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd36a, emissiveIntensity: 1.4, roughness: 0.2, side: THREE.DoubleSide }));
    glass.position.set(L.x, L.y + 1.4, L.z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0xd8432f, roughness: 0.5 }));
    cap.position.set(L.x, L.y + 3.5, L.z);
    for (const o of [gal, glass, cap]) { o.castShadow = true; group.add(o); extra.push(o); }
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    group, index,
    // un pan de mur cassé disparaît (clé « b:k:ox,z » du moteur)
    hideWall(key) { const w = index.get(key); if (w) { w.mesh.setMatrixAt(w.i, zero); w.mesh.instanceMatrix.needsUpdate = true; } },
    dispose() {
      for (const g of Object.values(geos)) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
      for (const t of Object.values(tex)) t.dispose();
      roofMat.dispose(); gableMat.dispose();
      group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) { o.geometry.dispose(); if (extra.includes(o)) o.material.dispose(); } });
    },
  };
}

// dalles par rangées de cases (on saute la trémie)
function rows(b, hole, fn) {
  for (let z = b.z0; z < b.z0 + b.d; z++) {
    let x = b.x0;
    while (x < b.x0 + b.w) {
      if (hole && hole.x === x && hole.z === z) { x++; continue; }
      let e = x;
      while (e < b.x0 + b.w && !(hole && hole.x === e && hole.z === z)) e++;
      fn(x, e, z);
      x = e;
    }
  }
}
