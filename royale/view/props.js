// Le décor : forêts (arbres de Birdie Party, détaillés près du joueur et allégés au loin, par tuiles de 200 m),
// rochers, buissons et objets Kenney (CC0) en instances, voitures et engins dessinés en volumes simples,
// ponts et quais. Tout est instancié par sorte d'objet pour toute l'île.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';
import { createTreeKit } from './trees.js';
import { hash } from '../engine/rng.js';
import { tintMaterial } from './kit.js';

const TILE = 200;
const HI_D = 260;   // tuiles détaillées jusqu'à cette distance (m)
export const CAR_COLORS = [0xe8473a, 0xf2c14e, 0x3d7fd9, 0xf4f2ea, 0x3fae6a, 0x7c5cc4, 0x6d5a4a];

// ------------------------------------------------------------------ forêts
// instances d'un objet du décor : pid (indice dans map.props) → [{ mesh, i }] ; hide(pid) le fait disparaître
function indexer() {
  const where = new Map(), dead = new Set(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    dead,
    scan(group) {
      group.traverse((o) => {
        if (o.isInstancedMesh && o.userData.items) o.userData.items.forEach((it, i) => {
          if (it.pid == null) return;
          if (!where.has(it.pid)) where.set(it.pid, []);
          where.get(it.pid).push({ mesh: o, i });
          if (dead.has(it.pid)) { o.setMatrixAt(i, zero); o.instanceMatrix.needsUpdate = true; }
        });
        else if (o.userData.pid != null) { if (!where.has(o.userData.pid)) where.set(o.userData.pid, []); where.get(o.userData.pid).push({ obj: o }); }
      });
    },
    hide(pid) {
      dead.add(pid);
      for (const w of where.get(pid) || []) {
        if (w.obj) w.obj.visible = false;
        else { w.mesh.setMatrixAt(w.i, zero); w.mesh.instanceMatrix.needsUpdate = true; }
      }
    },
  };
}

export function buildForest(map) {
  const kit = createTreeKit(), idx = indexer();
  const tiles = new Map();
  for (let pid = 0; pid < map.props.length; pid++) {
    const p = map.props[pid];
    if (p.kind !== 'arbre' && p.kind !== 'sapin') continue;
    const h = hash(Math.round(p.x * 10) * 7919 + Math.round(p.z * 10));
    // pied enfoncé dans la pente : jamais de tronc qui flotte
    let y = map.heightAt(p.x, p.z);
    for (const [dx, dz] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) y = Math.min(y, map.heightAt(p.x + dx, p.z + dz));
    const it = { x: p.x, y: y - 0.05, z: p.z, s: p.s, rot: (h % 628) / 100, v: h % 8, kind: p.kind === 'sapin' ? 'pine' : (h & 16 ? 'oak' : 'round'), pid };
    const key = Math.floor(p.x / TILE) + ',' + Math.floor(p.z / TILE);
    if (!tiles.has(key)) tiles.set(key, { x: (Math.floor(p.x / TILE) + 0.5) * TILE, z: (Math.floor(p.z / TILE) + 0.5) * TILE, items: [], hi: null, lo: null });
    tiles.get(key).items.push(it);
  }
  const group = new THREE.Group();
  for (const t of tiles.values()) { t.lo = kit.plant(t.items, { lo: true, shadows: false }); group.add(t.lo); idx.scan(t.lo); }
  // détail autour de la caméra : quelques tuiles construites par image au plus
  function update(cx, cz, budget = 1) {
    for (const t of tiles.values()) {
      const d = Math.hypot(t.x - cx, t.z - cz) - TILE * 0.7;
      const near = d < HI_D;
      if (near && !t.hi && budget > 0) { t.hi = kit.plant(t.items, { shadows: true }); group.add(t.hi); idx.scan(t.hi); budget--; }
      if (t.hi) t.hi.visible = near;
      t.lo.visible = !(near && t.hi);
    }
  }
  return { group, update, hide: (pid) => idx.hide(pid), dispose() { kit.dispose(); } };
}

// ------------------------------------------------------------------ modèles Kenney
const MODELS = {
  rockA: 'nature/rock_largeA', rockC: 'nature/rock_largeC', rockE: 'nature/rock_largeE', rockT: 'nature/rock_tallA', rockS: 'nature/rock_smallA', rockS2: 'nature/rock_smallC',
  bush: 'nature/plant_bush', bushL: 'nature/plant_bushLarge', bushD: 'nature/plant_bushDetailed',
  logs: 'nature/log_stackLarge', container: 'industrial/shipping-container-a', container2: 'industrial/shipping-container-b', tank: 'industrial/detail-tank',
  chimney: 'industrial/chimney-large', tent: 'survival/tent', fire: 'survival/campfire-pit', crate: 'pirate/crate', barrel: 'pirate/barrel', boat: 'pirate/boat-row-small',
  truck: 'racing/vehicle-truck-red', truckG: 'racing/vehicle-truck-green', truckY: 'racing/vehicle-truck-yellow',
};
const RECOLOR = { grass: 0x5a9a3a, leafsGreen: 0x4c8f37, stone: 0xa9a49a, dirt: 0x9c968c, woodBark: 0x7a5232, woodBarkDark: 0x5e3f27 };

async function loadKit(base) {
  const loader = new GLTFLoader(), kit = new Map(), mats = new Map();
  const matFor = (src) => {
    const key = src.name + '|' + (src.map ? src.map.uuid : '');
    if (!mats.has(key)) {
      const c = RECOLOR[src.name] != null ? new THREE.Color(RECOLOR[src.name]) : src.color.clone();
      mats.set(key, new THREE.MeshStandardMaterial({ color: c, map: src.map || null, roughness: 0.85, metalness: 0 }));
    }
    return mats.get(key);
  };
  await Promise.all(Object.entries(MODELS).map(async ([name, path]) => {
    try {
      const g = await loader.loadAsync(`${base}${path}.glb`);
      g.scene.updateMatrixWorld(true);
      const parts = [];
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (ms.length === 1) parts.push({ geo, mat: matFor(ms[0]) });
        else for (const gr of o.geometry.groups) {
          const sub = geo.clone(); sub.clearGroups();
          sub.setIndex(new THREE.BufferAttribute(geo.index.array.slice(gr.start, gr.start + gr.count), 1));
          parts.push({ geo: sub, mat: matFor(ms[gr.materialIndex]) });
        }
      });
      const box = new THREE.Box3();
      for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
      kit.set(name, { parts, box });
    } catch (e) { console.warn('modèle manquant', path, e); }
  }));
  return { kit, mats };
}

// ------------------------------------------------------------------ volumes simples : voitures, engins, foin, silos…
function carGeos() {
  const body = [], glass = [], dark = [];
  const B = (arr, w, h, d, x, y, z) => arr.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  B(body, 4.3, 0.75, 1.9, 0, 0.72, 0);          // caisse
  B(body, 2.3, 0.62, 1.7, -0.25, 1.4, 0);       // habitacle
  B(glass, 2.34, 0.42, 1.74, -0.25, 1.42, 0);   // vitres (légèrement plus larges)
  B(dark, 0.08, 0.3, 1.5, 2.16, 0.62, 0);       // calandre
  for (const sx of [-1.35, 1.35]) for (const sz of [-0.85, 0.85]) dark.push(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14).rotateX(Math.PI / 2).translate(sx, 0.38, sz));
  return { body: mergeGeometries(body), glass: mergeGeometries(glass), dark: mergeGeometries(dark) };
}
function tractorGeo() {
  const g = [new THREE.BoxGeometry(2.2, 1.0, 1.3).translate(0.4, 1.1, 0), new THREE.BoxGeometry(1.2, 1.2, 1.3).translate(-0.8, 1.9, 0)];
  return mergeGeometries(g);
}

// décor du « Toon Shooter Game Kit » : sorte d'objet de l'île → fichier du kit (models/toon/)
const TOON = { lampadaire: 'lampadaire', benne: 'benne', poubelle: 'poubelle', baril: 'baril', bonbonne: 'bonbonne', cone: 'cone', barriere: 'barriere',
  sacs: 'sacs', pneus: 'pneus', reservoir: 'reservoir', epave: 'epave', palette: 'palette', cartons: 'cartons-pile', gravats: 'gravats',
  tuyaux: 'tuyaux', planches: 'planches', caisson: 'caisson', caisse: 'caisse' };

// mobilier urbain du City Pack : sorte → [fichier, taille du plus grand côté (m), second modèle]
const CITY = { banc: ['banc', 1.8], bouche: ['bouche', 0.85], corbeille: ['poubelle-rue', 1.0], boite: ['boite-lettres', 1.25], abribus: ['abribus', 3.4],
  pot: ['pot-arbuste', 1.3, 'pot-plante'], jardiniere: ['jardiniere', 2.0], transfo: ['armoire-elec', 1.4], linge: ['corde-linge', 3.2],
  sacpoubelle: ['sac-poubelle', 0.6], plaque: ['plaque', 0.9] };
const FLAT = new Set(['gravats', 'planches', 'plaque', 'palette']);

// haie taillée de 2 × 1 × 0,7 m : un pavé bosselé (bosses tirées de la position, les arêtes restent fermées), plus
// étroit en haut ; feuillage dessiné plaqué selon la position
function hedgeGeo() {
  const g = new THREE.BoxGeometry(2.0, 1.0, 0.72, 10, 5, 4).translate(0, 0.5, 0);
  const P = g.attributes.position, Nn = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const n = (hash(Math.round(x * 20) * 7919 + Math.round(y * 20) * 131 + Math.round(z * 20)) % 1000) / 1000;
    const k = 1 + (n - 0.4) * 0.09, top = y / 1.0;
    P.setXYZ(i, x * k * (1 - 0.05 * top), y * (1 + (n - 0.5) * 0.06), z * k * (1 - 0.12 * top));
    const ax = Math.abs(Nn.getX(i)), ay = Math.abs(Nn.getY(i)), az = Math.abs(Nn.getZ(i));
    uv.setXY(i, ay > 0.5 ? x * 1.3 : ax > az ? z * 1.3 : x * 1.3, ay > 0.5 ? z * 1.3 : y * 1.3);
  }
  g.computeVertexNormals();
  return g;
}
function hedgeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let s = 4242;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  g.fillStyle = '#2f5a22'; g.fillRect(0, 0, 256, 256);
  const greens = ['#3d6e2a', '#4c8234', '#5a943c', '#6aa548', '#35632a', '#7ab452'];
  for (let i = 0; i < 2600; i++) {
    const x = r() * 256, y = r() * 256, a = r() * Math.PI, rx = 3 + r() * 4, ry = 1.8 + r() * 2;
    g.fillStyle = greens[Math.floor(r() * greens.length)];
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) { g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, a, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const HEDGE_TINTS = [0xffffff, 0xe6efda, 0xd6e6c4, 0xf2f4e2, 0xdfe9cf];

export async function buildProps(map, { base, kit: toon = null }) {
  const group = new THREE.Group(), own = [], idx = indexer(), lampHeads = [];
  const pidOf = new Map(map.props.map((p, i) => [p, i]));
  const { kit, mats } = await loadKit(base);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const yawOf = (p) => Math.atan2(p.dx || 0, p.dz || 0);
  // instances d'un modèle Kenney : items = [{ x, y, z, rot, s (échelle) }] ; size = taille voulue sur le plus grand côté
  const instanced = (name, items, { size, castShadow = true, tint } = {}) => {
    const k = kit.get(name);
    if (!k || !items.length) return;
    const ext = k.box.getSize(new THREE.Vector3()), base = size ? size / Math.max(ext.x, ext.z) : 1;
    for (const part of k.parts) {
      const im = new THREE.InstancedMesh(part.geo, tint ? part.mat.clone() : part.mat, items.length);
      if (tint) { im.material.color.multiply(new THREE.Color(tint)); own.push(im.material); }
      items.forEach((it, i) => { q.setFromAxisAngle(up, it.rot || 0); p3.set(it.x, it.y, it.z); s3.setScalar((it.s || 1) * base); m4.compose(p3, q, s3); im.setMatrixAt(i, m4); });
      im.castShadow = castShadow; im.receiveShadow = true; im.computeBoundingSphere();
      im.userData.items = items;
      group.add(im);
    }
  };
  const simple = (geo, mat, items, colors) => {
    if (!items.length) return;
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot || 0); p3.set(it.x, it.y, it.z); s3.set(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1); m4.compose(p3, q, s3); im.setMatrixAt(i, m4);
      if (colors) im.setColorAt(i, new THREE.Color(colors(it, i)));
    });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
    im.userData.items = items;
    own.push(geo, mat); group.add(im);
  };
  const by = {};
  for (const p of map.props) (by[p.kind] = by[p.kind] || []).push(p);
  // voitures abandonnées : l'épave du kit
  if (toon && toon.props.epave && by.voiture) { by.epave = [...(by.epave || []), ...by.voiture.filter((p) => p.epave)]; by.voiture = by.voiture.filter((p) => !p.epave); }
  const ground = (p) => map.heightAt(p.x, p.z);
  const at = (p, extra = {}) => ({ x: p.x, y: ground(p), z: p.z, rot: yawOf(p), pid: pidOf.get(p), ...extra });

  // rochers : quatre formes, taille selon l'île ; enfoncés d'un tiers
  const rocks = { rockA: [], rockC: [], rockE: [], rockT: [] };
  for (const p of by.rocher || []) {
    const h = hash(Math.round(p.x * 13) + Math.round(p.z * 7) * 131);
    const name = ['rockA', 'rockC', 'rockE', 'rockT'][h % 4];
    rocks[name].push({ x: p.x, y: ground(p) - 0.3 * p.s, z: p.z, rot: (h % 628) / 100, s: p.s * 2.4, pid: pidOf.get(p) });
  }
  for (const [name, list] of Object.entries(rocks)) instanced(name, list, { size: 1.1 });
  const bushes = { bush: [], bushL: [], bushD: [] };
  for (const p of by.buisson || []) {
    const h = hash(Math.round(p.x * 11) + Math.round(p.z * 3) * 977);
    bushes[['bush', 'bushL', 'bushD'][h % 3]].push({ x: p.x, y: ground(p) - 0.1, z: p.z, rot: (h % 628) / 100, s: p.s * 2.2, pid: pidOf.get(p) });
  }
  for (const [name, list] of Object.entries(bushes)) instanced(name, list, { size: 1, castShadow: false });
  // haies des jardins
  if (by.haie && by.haie.length) {
    const tex = hedgeTexture(); own.push(tex);
    simple(hedgeGeo(), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }), by.haie.map((p) => at(p, { rot: yawOf(p) - Math.PI / 2 })),
      (it) => HEDGE_TINTS[hash(Math.round(it.x * 3) + Math.round(it.z * 7) * 31) % HEDGE_TINTS.length]);
  }
  instanced('container', (by.conteneur || []).filter((p) => p.c % 2 === 0).map((p) => at(p, { rot: yawOf(p) + Math.PI / 2 })), { size: 6 });
  instanced('container2', (by.conteneur || []).filter((p) => p.c % 2 === 1).map((p) => at(p, { rot: yawOf(p) + Math.PI / 2 })), { size: 6 });
  instanced('tank', (by.citerne || []).map((p) => at(p)), { size: 4.8 });
  instanced('chimney', (by.cheminee || []).map((p) => at(p)), { size: 3.6 });
  instanced('tent', (by.tente || []).map((p) => at(p)), { size: 2.8 });
  instanced('fire', (by.feu || []).map((p) => at(p)), { size: 1.6 });
  if (!(toon && toon.props.caisse)) instanced('crate', (by.caisse || []).map((p) => at(p)), { size: 1.2 });
  // décor du kit : posé au sol, centré, son grand côté dans la direction de l'objet
  if (toon) {
    const kitMat = tintMaterial({}, { roughness: 0.75 });
    own.push(kitMat);
    const sources = [...Object.entries(TOON).map(([kind, file]) => [kind, toon.props[file], null, by[kind] || []]),
      ...Object.entries(CITY).map(([kind, [file, size, alt]]) => {
        const list = by[kind] || [];
        // deux modèles pour la même sorte (pots) : un sur deux
        if (alt) return [[kind, toon.city[file], size, list.filter((p, i) => i % 2 === 0)], [kind, toon.city[alt], size, list.filter((p, i) => i % 2 === 1)]];
        return [[kind, toon.city[file], size, list]];
      }).flat()];
    for (const [kind, src, size, list] of sources) {
      if (!src || !src.geo || !list.length) continue;
      const g = src.geo.clone();
      g.computeBoundingBox();
      let bb = g.boundingBox;
      // mobilier urbain : ramené à sa taille réelle (le plus grand côté)
      if (size) { const k = size / Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z); g.scale(k, k, k); g.computeBoundingBox(); bb = g.boundingBox; }
      const longX = bb.max.x - bb.min.x >= bb.max.z - bb.min.z;
      // lampadaire : le mât (et non le milieu du bras) sur le point de l'objet
      const pz = kind === 'lampadaire' ? bb.min.z + 0.2 : (bb.min.z + bb.max.z) / 2;
      g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -pz);
      own.push(g);
      const im = new THREE.InstancedMesh(g, kitMat, list.length);
      const items = list.map((p) => ({ x: p.x, y: ground(p) - 0.02, z: p.z, rot: longX && kind !== 'lampadaire' ? Math.atan2(-(p.dz || 0), p.dx || 0) : Math.atan2(p.dx || 0, p.dz || 0), pid: pidOf.get(p) }));
      // tête des lampadaires (au bout du bras, sous le chapeau) : on y accroche la lumière du soir
      if (kind === 'lampadaire') for (const it of items) { const L = bb.max.z - pz - 0.35; lampHeads.push({ x: it.x + Math.sin(it.rot) * L, y: it.y + bb.max.y - bb.min.y - 0.35, z: it.z + Math.cos(it.rot) * L, gy: it.y, pid: it.pid }); }
      items.forEach((it, i) => { q.setFromAxisAngle(up, it.rot); p3.set(it.x, it.y, it.z); s3.setScalar(1); m4.compose(p3, q, s3); im.setMatrixAt(i, m4); });
      im.castShadow = !FLAT.has(kind); im.receiveShadow = true; im.computeBoundingSphere();
      im.userData.items = items;
      group.add(im);
    }
  }
  instanced('logs', (by.grume || []).map((p) => at(p, { rot: yawOf(p) + Math.PI / 2 })), { size: 6 });
  instanced('boat', (by.bateau || []).map((p) => ({ x: p.x, y: Math.max(0, map.waterLevel[Math.round(p.z / map.hres) * map.n + Math.round(p.x / map.hres)] || ground(p)) - 0.1, z: p.z, rot: yawOf(p) + Math.PI / 2, pid: pidOf.get(p) })), { size: 5.2 });
  instanced('truck', (by.camion || []).map((p) => at(p, { rot: yawOf(p) - Math.PI / 2 })), { size: 7.5 });
  instanced('truckY', (by.engin || []).map((p) => at(p, { rot: yawOf(p) - Math.PI / 2 })), { size: 5.5 });

  // voitures : modèles du City Pack (carrosserie à la couleur de chaque voiture), épaves du kit ; sinon volumes simples
  if (toon && Object.keys(toon.cars).length) {
    const names = Object.keys(toon.cars).filter((n) => n !== 'voiture-police'), police = toon.cars['voiture-police'];
    const bodyMat = tintMaterial({}, { roughness: 0.35, metalness: 0.35 }), restMat = tintMaterial({}, { roughness: 0.5, metalness: 0.2 });
    own.push(bodyMat, restMat);
    const groups = new Map();
    for (const p of by.voiture || []) {
      const pid = pidOf.get(p), h = hash(pid * 31 + 7);
      const name = police && h % 11 === 0 ? 'voiture-police' : names[(p.c + (h >>> 3)) % names.length];
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push({ p, pid, c: name === 'voiture-police' ? 0xf4f2ea : CAR_COLORS[p.c % CAR_COLORS.length] });
    }
    for (const [name, list] of groups) {
      const src = toon.cars[name];
      for (const [part, mat] of [['body', bodyMat], ['rest', restMat]]) {
        if (!src[part]) continue;
        const g = src[part].clone();
        const bb = (src.rest.boundingBox || (src.rest.computeBoundingBox(), src.rest.boundingBox)), k = 4.3 / Math.max(bb.max.z - bb.min.z, bb.max.x - bb.min.x);
        g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2).scale(k, k, k);
        own.push(g);
        const im = new THREE.InstancedMesh(g, mat, list.length);
        const items = list.map(({ p, pid, c }) => ({ x: p.x, y: ground(p), z: p.z, rot: Math.atan2(p.dx || 0, p.dz || 0), pid, c }));
        items.forEach((it, i) => {
          q.setFromAxisAngle(up, it.rot); p3.set(it.x, it.y, it.z); s3.setScalar(1); m4.compose(p3, q, s3); im.setMatrixAt(i, m4);
          if (part === 'body') im.setColorAt(i, new THREE.Color(it.c));
        });
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
        im.userData.items = items;
        group.add(im);
      }
    }
  } else {
    const cars = (by.voiture || []).map((p) => at(p, { rot: yawOf(p) - Math.PI / 2, c: p.c, epave: p.epave }));
    const cg = carGeos();
    simple(cg.body, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.3 }), cars, (it) => (it.epave ? 0x6d5a4a : CAR_COLORS[it.c % CAR_COLORS.length]));
    simple(cg.glass, new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.15, metalness: 0.5 }), cars);
    simple(cg.dark, new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.8 }), cars);
  }
  simple(tractorGeo(), new THREE.MeshStandardMaterial({ color: 0x3f9d4a, roughness: 0.6 }), (by.tracteur || []).map((p) => at(p, { rot: yawOf(p) - Math.PI / 2 })));
  // bottes de foin, silos, citerne, fontaine, pompes, tables, auvents
  simple(new THREE.CylinderGeometry(1, 1, 1.2, 16).rotateZ(Math.PI / 2).translate(0, 1, 0), new THREE.MeshStandardMaterial({ color: 0xd9b95a, roughness: 1 }), (by.botte || []).map((p) => at(p)));
  const silos = (by.silo || []).map((p) => at(p));
  simple(new THREE.CylinderGeometry(3, 3, 10, 20).translate(0, 5, 0), new THREE.MeshStandardMaterial({ color: 0xcfd2d4, roughness: 0.5, metalness: 0.35 }), silos);
  simple(new THREE.SphereGeometry(3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 10, 0), new THREE.MeshStandardMaterial({ color: 0x9aa3aa, roughness: 0.4, metalness: 0.5 }), silos);
  const fountains = (by.fontaine || []).map((p) => at(p));
  simple(new THREE.CylinderGeometry(3.2, 3.4, 0.7, 28).translate(0, 0.35, 0), new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 0.8 }), fountains);
  simple(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 28).translate(0, 0.62, 0), new THREE.MeshStandardMaterial({ color: 0x4fb8c8, roughness: 0.1, metalness: 0.2 }), fountains);
  simple(new THREE.CylinderGeometry(0.4, 0.6, 2.2, 12).translate(0, 1.1, 0), new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 0.8 }), fountains);
  simple(new THREE.BoxGeometry(0.9, 1.7, 0.7).translate(0, 0.85, 0), new THREE.MeshStandardMaterial({ color: 0xe8473a, roughness: 0.5 }), (by.pompe || []).map((p) => at(p)));
  simple(new THREE.BoxGeometry(2, 0.12, 1).translate(0, 0.78, 0), new THREE.MeshStandardMaterial({ color: 0xa5743f, roughness: 0.9 }), (by.table || []).map((p) => at(p)));
  for (const p of by.auvent || []) {
    const W = p.dx ? 18 : 9, D = p.dx ? 9 : 18, y = ground(p);
    const pid = pidOf.get(p);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W, 0.4, D), new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: 0.6 }));
    roof.userData.pid = pid;
    roof.position.set(p.x, y + 4.8, p.z); roof.castShadow = roof.receiveShadow = true; group.add(roof); own.push(roof.geometry, roof.material);
    const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.25, D + 0.1), new THREE.MeshStandardMaterial({ color: 0xe8473a, roughness: 0.6 }));
    band.position.set(p.x, y + 4.75, p.z); band.userData.pid = pid; group.add(band); own.push(band.geometry, band.material);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.6, 10), new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.5 }));
      post.position.set(p.x + sx * (W / 2 - 0.6), y + 2.3, p.z + sz * (D / 2 - 0.6)); post.castShadow = true; post.userData.pid = pid; group.add(post); own.push(post.geometry, post.material);
    }
  }

  // ponts : tablier de pierre, garde-corps, deux piles ; quais : planches sur pilotis
  const stone = new THREE.MeshStandardMaterial({ color: 0xb7aa92, roughness: 0.9 }); own.push(stone);
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6c42, roughness: 0.85 }); own.push(wood);
  for (const br of map.bridges) {
    const dx = br.x1 - br.x0, dz = br.z1 - br.z0, L = Math.hypot(dx, dz) + 4, rot = Math.atan2(dx, dz), cx = (br.x0 + br.x1) / 2, cz = (br.z0 + br.z1) / 2;
    const g = new THREE.Group(); g.position.set(cx, br.y, cz); g.rotation.y = rot;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(br.hw * 2 + 0.6, 0.6, L).translate(0, -0.32, 0), stone);
    g.add(deck);
    for (const sd of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, L).translate(sd * (br.hw + 0.15), 0.5, 0), stone); g.add(rail); }
    for (const t of [-0.25, 0.25]) { const pile = new THREE.Mesh(new THREE.BoxGeometry(br.hw * 2, 8, 1.2).translate(0, -4.6, t * L), stone); g.add(pile); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; own.push(o.geometry); } });
    group.add(g);
  }
  for (const d of map.docks) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(d.x1 - d.x0, 0.35, d.z1 - d.z0), wood);
    deck.position.set((d.x0 + d.x1) / 2, 1.02, (d.z0 + d.z1) / 2); deck.castShadow = deck.receiveShadow = true; group.add(deck); own.push(deck.geometry);
    for (let x = d.x0 + 1; x < d.x1; x += 4) for (let z = d.z0 + 1; z < d.z1; z += 4) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4, 8), wood); post.position.set(x, -1, z); group.add(post); own.push(post.geometry);
    }
  }
  idx.scan(group);
  return {
    group, lampHeads, hide: (pid) => idx.hide(pid),
    dispose() {
      for (const k of kit.values()) for (const p of k.parts) p.geo.dispose();
      for (const m of mats.values()) { m.map && m.map.dispose(); m.dispose(); }
      for (const o of own) o.dispose();
    },
  };
}
