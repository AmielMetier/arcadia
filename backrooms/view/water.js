// The Backrooms (Level 37, les Poolrooms) - Le rendu des salles préfabriquées : sols en relief qui suivent la forme
// des bassins (bords courbes, îlots, margelles), cloisons percées de portes en plein cintre, plafonds (plats, voûtes
// d'arêtes, berceaux à arcs, verrière), colonnes, échelles chromées, hublots, et l'eau : limpide, vert d'eau, plus
// sombre avec la profondeur, avec les ronds des pas. Et deux choses qu'on n'est jamais sûr d'avoir vues : l'eau qui
// monte ou descend de quelques centimètres quand on ne la regarde pas, et une ombre longue au fond d'un bassin.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';
import { CELL_SIZE } from '../engine/map.js';
import { POOL_CEIL, WALL_T, MOUTH, roomDepth, poolSdf, islandSdf } from '../engine/poolrooms.js';

const C = CELL_SIZE;
const SPLASHES = 8;
const BOTTOM = -1.3; // les murs descendent jusque-là, sous les bassins
const GROIN = { spring: POOL_CEIL - 2.2, rise: 2.2 };
const BARREL = { spring: POOL_CEIL - 2.5, r: 2.5 };
const RIDGE = 7.5; // faîtage de la verrière

// géométrie à partir de listes : positions, uv (et une valeur par sommet, en option)
function geometry(pos, uv, extra) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (extra) g.setAttribute(extra.name, new THREE.Float32BufferAttribute(extra.data, 1));
  g.computeVertexNormals();
  return g;
}

export function buildWater({ map, group, baked, textures, bake, fog, film, tileRelief }) {
  // le carrelage émaillé : la photo, son relief (les joints en creux), et ses reflets (voir BK_POOL dans scene.js)
  const glaze = (tex, opts, extra = {}) => baked(new THREE.MeshPhongMaterial({ map: tex, bumpMap: tileRelief(tex), bumpScale: 1.1, specular: '#2c3537', shininess: 70, ...extra }), opts);
  const mosaic = glaze(textures.mosaic, { pool: 'ceil', spec: 0.12, gloss: 90 }, { side: THREE.DoubleSide });
  const wallMat = glaze(textures.mosaic, { pool: 'wall', spec: 0.22, gloss: 140 });
  const mats = {
    dry: glaze(textures.carpet, { pool: 'floor', spec: 0.25, gloss: 200 }),
    pool: glaze(textures.pool, { pool: 'wall', spec: 0.2, gloss: 140 }, { side: THREE.DoubleSide }),
    coping: baked(new THREE.MeshPhongMaterial({ color: '#eef1ec', specular: '#2c3537', shininess: 60, side: THREE.DoubleSide }), { pool: 'floor', spec: 0.25, gloss: 140 }),
  };
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    group.add(m);
    return m;
  };

  // --- 1. Sols et surface de l'eau, salle par salle. Une grille fine dont chaque triangle est découpé le long du bord
  // de l'eau (f = 0) et du bord de la margelle (f = COP), f étant la distance au bord (négative dans l'eau, îlots
  // compris) : un bord net qui suit la courbe du bassin, sans dents de scie. Le long du bord de l'eau, une paroi
  // verticale carrelée descend de la margelle au fond ; au bord extérieur de la margelle, une petite marche ---
  const fl = { dry: [[], []], pool: [[], []], coping: [[], []] };
  const wPos = [];
  const wDep = [];
  const wEdge = [];
  const deepSpots = [];
  const waterSpots = [];
  const edgeSegs = []; // le bord de l'eau, par petits bouts (pour y poser les skimmers et les marquages)
  const drains = []; // le point le plus profond de chaque bassin
  const COP = 0.32;
  const COP_Y = 0.045;
  const pushTri = (k, a, b, c, y) => {
    const [pos, uv] = fl[k];
    for (const v of [a, b, c]) {
      pos.push(v.x, y(v), v.z);
      uv.push(v.x / C, v.z / C);
    }
  };
  // la partie d'un polygone (sommets { x, z, f }) où f < lvl (below) ou f >= lvl : Sutherland-Hodgman sur une valeur
  // interpolée ; les sommets créés sur la ligne sont marqués (on : la valeur de la ligne)
  const clip = (poly, lvl, below) => {
    const out = [];
    const inside = (v) => (below ? v.f < lvl : v.f >= lvl);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ia = inside(a);
      const ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) {
        const t = (lvl - a.f) / (b.f - a.f);
        out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, f: lvl, on: lvl });
      }
    }
    return out;
  };
  // un mur vertical le long du segment p → q, de yTop à yBot(v), tourné vers n (x, z)
  const vwall = (k, p, q, yTop, yBot, nx, nz) => {
    if ((q.z - p.z) * nx - (q.x - p.x) * nz < 0) [p, q] = [q, p];
    const [pos, uv] = fl[k];
    const L = Math.hypot(q.x - p.x, q.z - p.z);
    const u0 = (p.x + p.z) / C;
    const bp = yBot(p);
    const bq = yBot(q);
    for (const [v, y, u] of [[p, yTop, u0], [q, yTop, u0 + L / C], [q, bq, u0 + L / C], [p, yTop, u0], [q, bq, u0 + L / C], [p, bp, u0]]) {
      pos.push(v.x, y, v.z);
      uv.push(u, y / C);
    }
  };
  for (const r of map.rooms) {
    let x0 = r.x0;
    let x1 = r.x1;
    let z0 = r.z0;
    let z1 = r.z1;
    // un couloir n'occupe que le milieu de son module (5 m)
    if (r.axis === 'x') {
      z0 += C;
      z1 -= C;
    } else if (r.axis === 'z') {
      x0 += C;
      x1 -= C;
    }
    const flat = r.flat !== undefined;
    const step = flat ? 1.25 : 0.25;
    const nx = Math.round((x1 - x0) / step);
    const nz = Math.round((z1 - z0) / step);
    const hasPool = !flat && poolSdf(r, (x0 + x1) / 2, (z0 + z1) / 2) !== null;
    // f : distance au bord de l'eau ; la profondeur, le bord franc de 45 cm compris (sur le bord même : 45 cm)
    const fAt = (x, z) => (hasPool ? Math.max(poolSdf(r, x, z), -islandSdf(r, x, z)) : 1e9);
    const depthOf = (x, z) => (flat ? r.flat : Math.min(r.maxDepth, 0.45 + Math.max(0, -poolSdf(r, x, z)) * 0.45));
    const grad = (x, z) => {
      const e = 0.02;
      const gx = fAt(x + e, z) - fAt(x - e, z);
      const gz = fAt(x, z + e) - fAt(x, z - e);
      const l = Math.hypot(gx, gz) || 1;
      return [gx / l, gz / l];
    };
    const P = [];
    let deepest = null;
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = x0 + i * step;
        const z = z0 + j * step;
        const f = fAt(x, z);
        P.push({ x, z, f });
        const d = f < 0 ? depthOf(x, z) : flat ? r.flat : 0;
        if (d >= 1) deepSpots.push({ x, z, d });
        if (!flat && f < -1.2 && (!deepest || f < deepest.f)) deepest = { x, z, f, depthOf };
        if (d > 0 && (i + j) % 4 === 0) waterSpots.push({ x, z });
      }
    }
    const at = (i, j) => P[j * (nx + 1) + i];
    const yWater = (v) => -depthOf(v.x, v.z);
    const water = (poly) => {
      for (let k = 1; k + 1 < poly.length; k++) {
        pushTri(flat ? 'dry' : 'pool', poly[0], poly[k], poly[k + 1], yWater);
        for (const v of [poly[0], poly[k], poly[k + 1]]) {
          wPos.push(v.x, 0, v.z);
          wDep.push(depthOf(v.x, v.z));
          wEdge.push(flat ? 9 : Math.max(0, -v.f));
        }
      }
      // le bord de l'eau dans ce morceau : la paroi du bassin, de la margelle au fond
      const on = poly.filter((v) => v.on === 0);
      if (on.length === 2) {
        const mx = (on[0].x + on[1].x) / 2;
        const mz = (on[0].z + on[1].z) / 2;
        const [gx, gz] = grad(mx, mz);
        vwall('pool', on[0], on[1], COP_Y, yWater, -gx, -gz);
        edgeSegs.push({ x: mx, z: mz, gx, gz, L: Math.hypot(on[1].x - on[0].x, on[1].z - on[0].z), room: r, d: depthOf(mx - gx, mz - gz) });
      }
    };
    const fan = (k, poly, y) => {
      for (let i = 1; i + 1 < poly.length; i++) pushTri(k, poly[0], poly[i], poly[i + 1], y);
    };
    const tri = (a, b, c) => {
      if (flat) {
        water([a, b, c]);
        return;
      }
      if (a.f >= COP && b.f >= COP && c.f >= COP) {
        pushTri('dry', a, b, c, () => 0);
        return;
      }
      const wet = clip([a, b, c], 0, true);
      if (wet.length >= 3) water(wet);
      const rest = clip([a, b, c], 0, false);
      if (rest.length < 3) return;
      const cop = clip(rest, COP, true);
      if (cop.length >= 3) {
        fan('coping', cop, () => COP_Y);
        const on = cop.filter((v) => v.on === COP);
        if (on.length === 2) {
          const [gx, gz] = grad((on[0].x + on[1].x) / 2, (on[0].z + on[1].z) / 2);
          vwall('coping', on[0], on[1], COP_Y, () => 0, gx, gz);
        }
      }
      const dry = clip(rest, COP, false);
      if (dry.length >= 3) fan('dry', dry, () => 0);
    };
    if (deepest) drains.push(deepest);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        tri(at(i, j), at(i, j + 1), at(i + 1, j + 1));
        tri(at(i, j), at(i + 1, j + 1), at(i + 1, j));
      }
    }
  }
  for (const k of ['dry', 'pool', 'coping']) if (fl[k][0].length) add(geometry(fl[k][0], fl[k][1]), mats[k]);

  // --- 2. Cloisons entre les salles : un pan par bord commun, percé de ses portes en plein cintre ---
  const runs = new Map();
  for (const e of map.edges) {
    const line = e.along === 'x' ? e.z0 : e.x0;
    const key = `${e.along}:${line.toFixed(2)}`;
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(e.along === 'x' ? [e.x0, e.x1] : [e.z0, e.z1]);
  }
  const DW = map.doors.length ? map.doors[0].w / 2 : 1.5;
  const SPRING = 1.7; // naissance de l'arc des portes (clé à 3,20 m)
  const thresholds = [];
  for (const [key, list] of runs) {
    const [along, ls] = key.split(':');
    const line = +ls;
    list.sort((a, b) => a[0] - b[0]);
    // bords contigus regroupés en pans
    const spans = [];
    for (const [a, b] of list) {
      const last = spans[spans.length - 1];
      if (last && Math.abs(last[1] - a) < 0.01) last[1] = b;
      else spans.push([a, b]);
    }
    for (const [u0, u1] of spans) {
      const ds = map.doors.filter((d) => d.along === along && Math.abs((along === 'x' ? d.pz : d.px) - line) < 0.01).map((d) => (along === 'x' ? d.px : d.pz)).filter((c) => c > u0 && c < u1).sort((a, b) => a - b);
      const sh = new THREE.Shape();
      sh.moveTo(u0, BOTTOM);
      for (const c of ds) {
        sh.lineTo(c - DW, BOTTOM);
        sh.lineTo(c - DW, SPRING);
        for (let k = 1; k <= 16; k++) {
          const a = Math.PI - (k / 16) * Math.PI;
          sh.lineTo(c + DW * Math.cos(a), SPRING + DW * Math.sin(a));
        }
        sh.lineTo(c + DW, BOTTOM);
        // le seuil de la porte : le sol de chaque salle va jusqu'au milieu de la cloison ; s'ils ne sont pas à la même
        // profondeur, une marche (voir plus bas)
        const px = along === 'x' ? c : line;
        const pz = along === 'x' ? line : c;
        const off = 0.6;
        const da = map.depthAt(along === 'x' ? px : px - off, along === 'x' ? pz - off : pz);
        const db = map.depthAt(along === 'x' ? px : px + off, along === 'x' ? pz + off : pz);
        thresholds.push({ c, line, along, da, db });
      }
      sh.lineTo(u1, BOTTOM);
      sh.lineTo(u1, POOL_CEIL);
      sh.lineTo(u0, POOL_CEIL);
      sh.lineTo(u0, BOTTOM);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: WALL_T, bevelEnabled: false, curveSegments: 4 });
      // la mosaïque : 2,5 m par répétition
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / C, uv.getY(i) / C);
      geo.translate(0, 0, -WALL_T / 2);
      const m = add(geo, wallMat);
      if (along === 'x') m.position.set(0, 0, line);
      else {
        m.rotation.y = -Math.PI / 2;
        m.position.set(line, 0, 0);
      }
    }
  }
  // la marche d'une porte entre deux profondeurs d'eau : une contremarche carrelée de mosaïque, au milieu de la
  // cloison, tournée vers la salle la plus profonde, de son sol à celui de l'autre (l'eau des deux salles se rejoint
  // au-dessus, sans se recouvrir ; une salle au sec retient l'eau de l'autre derrière son seuil)
  const risers = [[], []];
  for (const t of thresholds) {
    const lo = -Math.max(t.da, t.db);
    const hi = -Math.min(t.da, t.db);
    if (hi - lo < 0.01) continue;
    const sgn = t.db > t.da ? 1 : -1; // vers la salle profonde
    const P = (u, y) => (t.along === 'x' ? [u, y, t.line] : [t.line, y, u]);
    const u0 = t.c - DW;
    const u1 = t.c + DW;
    // (sens des sommets : la face regarde vers la salle profonde)
    const flip = t.along === 'x' ? sgn > 0 : sgn < 0;
    const quadV = [[u0, hi], [u1, hi], [u1, lo], [u0, hi], [u1, lo], [u0, lo]];
    const order = flip ? [0, 2, 1, 3, 5, 4] : [0, 1, 2, 3, 4, 5];
    for (const k of order) {
      const [u, y] = quadV[k];
      risers[0].push(...P(u, y));
      risers[1].push(u / C, y / C);
    }
  }
  if (risers[0].length) add(geometry(risers[0], risers[1]), wallMat);

  // --- 3. Plafonds : plats, bas (locaux techniques), voûtes d'arêtes, berceaux à arcs, verrière ---
  const flatCeil = [[], []];
  const quad = (out, ax, az, bx, bz, y) => {
    const [pos, uv] = out;
    for (const [x, z] of [[ax, az], [ax, bz], [bx, bz], [ax, az], [bx, bz], [bx, az]]) {
      pos.push(x, y, z);
      uv.push(x / C, z / C);
    }
  };
  const groin = [[], []];
  const barrel = [[], []];
  const ribs = [[], []];
  const glass = [[], []]; // le verre : positions, et uv en vitres (u : le long du toit, v : en montant la pente)
  const beams = [];
  const PANE_W = 0.625; // largeur d'une vitre (quatre entre deux fermes)
  const gables = [[], []];
  for (const r of map.rooms) {
    if (r.ceil === 'flat') quad(flatCeil, r.x0, r.z0, r.x1, r.z1, POOL_CEIL);
    else if (r.ceil === 'low') {
      quad(flatCeil, r.x0, r.z0, r.x1, r.z1, 3.2);
      // sous le plafond bas d'un local technique, un caisson ferme le haut des murs
      for (const [ax, az, bx, bz] of [[r.x0, r.z0, r.x1, r.z0], [r.x1, r.z0, r.x1, r.z1], [r.x1, r.z1, r.x0, r.z1], [r.x0, r.z1, r.x0, r.z0]]) {
        const [pos, uv] = gables;
        const L = Math.hypot(bx - ax, bz - az);
        for (const [x, z, y, u] of [[ax, az, 3.2, 0], [bx, bz, 3.2, L], [bx, bz, POOL_CEIL, L], [ax, az, 3.2, 0], [bx, bz, POOL_CEIL, L], [ax, az, POOL_CEIL, 0]]) {
          pos.push(x, y, z);
          uv.push(u / C, y / C);
        }
      }
    } else if (r.ceil === 'groin') {
      const N = 16;
      for (const b of r.bays) {
        const pt = (i, j) => {
          const u = (i / N) * 2 - 1;
          const v = (j / N) * 2 - 1;
          const x = b.x0 + ((u + 1) / 2) * (b.x1 - b.x0);
          const z = b.z0 + ((v + 1) / 2) * (b.z1 - b.z0);
          const y = GROIN.spring + GROIN.rise * Math.max(Math.sqrt(Math.max(0, 1 - u * u)), Math.sqrt(Math.max(0, 1 - v * v)));
          return [x, y, z];
        };
        for (let j = 0; j < N; j++) {
          for (let i = 0; i < N; i++) {
            for (const [a, c] of [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]]) {
              const [x, y, z] = pt(i + a, j + c);
              groin[0].push(x, y, z);
              groin[1].push((x + (y - GROIN.spring) * 0.6) / C, (z + (y - GROIN.spring) * 0.6) / C);
            }
          }
        }
      }
    } else if (r.ceil === 'barrel') {
      // berceau sur 5 m de large, le long du couloir, et un arc doubleau tous les 2,5 m
      const ax = r.axis === 'x';
      const len = ax ? r.w : r.h;
      const a0 = ax ? r.x0 : r.z0;
      const mid = ax ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
      const SEG = 20;
      const p = (u, t, R) => {
        const lat = -R * Math.cos(t);
        const y = BARREL.spring + R * Math.sin(t);
        return ax ? [a0 + u, y, mid + lat] : [mid + lat, y, a0 + u];
      };
      for (let k = 0; k < SEG; k++) {
        const t0 = (k / SEG) * Math.PI;
        const t1 = ((k + 1) / SEG) * Math.PI;
        for (const [u, t] of [[0, t0], [len, t0], [len, t1], [0, t0], [len, t1], [0, t1]]) {
          barrel[0].push(...p(u, t, BARREL.r));
          barrel[1].push(u / C, (t * BARREL.r) / C);
        }
        for (let u = C / 2; u < len; u += C) {
          for (const [du, t] of [[-0.18, t0], [0.18, t0], [0.18, t1], [-0.18, t0], [0.18, t1], [-0.18, t1]]) {
            ribs[0].push(...p(u + du, t, BARREL.r - 0.14));
            ribs[1].push((u + du) / C, (t * BARREL.r) / C);
          }
        }
      }
    } else if (r.ceil === 'sky') {
      // verrière à deux pans : de l'égout (4,5 m) au faîtage (7,5 m), le long de la grande longueur
      const ax = r.long === 'x';
      const L = ax ? r.w : r.h;
      const S = ax ? r.h : r.w;
      const a0 = ax ? r.x0 : r.z0;
      const s0 = ax ? r.z0 : r.x0;
      const P = (u, v, y) => (ax ? [a0 + u, y, s0 + v] : [s0 + v, y, a0 + u]);
      // chaque pan : des vitres de 62,5 cm sur à peu près un mètre de pente (un nombre entier jusqu'au faîtage)
      const slope = Math.hypot(S / 2, RIDGE - POOL_CEIL);
      const paneH = slope / Math.max(1, Math.round(slope));
      for (const [v0, v1] of [[0, S / 2], [S, S / 2]]) {
        const A = [P(0, v0, POOL_CEIL), P(L, v0, POOL_CEIL), P(L, v1, RIDGE), P(0, v1, RIDGE)];
        const T = [[0, 0], [L / PANE_W, 0], [L / PANE_W, slope / paneH], [0, slope / paneH]];
        for (const i of [0, 1, 2, 0, 2, 3]) {
          glass[0].push(...A[i]);
          glass[1].push(...T[i]);
        }
      }
      for (let u = 0; u <= L + 0.01; u += C) beams.push({ P, u, S, ax, L });
      // les pignons : vitrés eux aussi, de l'égout au faîtage (le jour y entre de face)
      for (const u of [0, L]) {
        const tri = [[0, POOL_CEIL], [S, POOL_CEIL], [S / 2, RIDGE]];
        for (const [v, y] of tri) {
          glass[0].push(...P(u, v, y));
          glass[1].push(v / PANE_W + 0.5, (y - POOL_CEIL) / 1.0);
        }
      }
    }
  }
  if (flatCeil[0].length) add(geometry(flatCeil[0], flatCeil[1]), mosaic);
  if (groin[0].length) add(geometry(groin[0], groin[1]), mosaic);
  if (barrel[0].length) add(geometry(barrel[0], barrel[1]), mosaic);
  if (ribs[0].length) add(geometry(ribs[0], ribs[1]), glaze(textures.mosaic, { pool: 'ceil', spec: 0.12, gloss: 90 }, { color: '#cddcda', side: THREE.DoubleSide }));
  if (gables[0].length) add(geometry(gables[0], gables[1]), mosaic);
  if (glass[0].length) {
    // le verre armé, laiteux : il donne le jour (il ne prend pas la lumière). Des petits bois sombres entre les vitres ;
    // chaque vitre a sa nuance (quelques-unes, changées, plus claires et plus bleues) ; la crasse s'amasse au bas de
    // chacune (l'eau de pluie y stagne) et coule en traînées le long de la pente ; des feuilles mortes collées, vues à
    // contre-jour ; ici et là une vitre fêlée ou couverte de mousse
    const glassMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, fog: false });
    glassMat.defines = { USE_UV: '' };
    glassMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
float gH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gN(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gH(i), gH(i + vec2(1.0, 0.0)), f.x), mix(gH(i + vec2(0.0, 1.0)), gH(i + vec2(1.0, 1.0)), f.x), f.y);
}`,
        )
        .replace(
          '#include <map_fragment>',
          `{
  vec2 gp = vUv;
  vec2 gi = floor(gp);
  vec2 gf = fract(gp);
  float h1 = gH(gi);
  float h2 = gH(gi + 17.3);
  float h3 = gH(gi + 41.9);
  // le verre, éclairé par le ciel blanc : à peine vert, plus ou moins dense d'une vitre à l'autre
  vec3 col = vec3(0.86, 0.92, 0.9) * (0.92 + 0.12 * h1) * (0.96 + 0.08 * gN(gp * vec2(1.3, 0.4) + 3.0));
  if (h2 < 0.07) col *= vec3(0.92, 0.99, 1.04);
  // le verre armé : un fin quadrillage de fils, à peine visible
  vec2 wq = abs(fract(gp * vec2(0.625, 1.0) / 0.025) - 0.5);
  float wpx = fwidth(gp.x) * 25.0;
  col *= 1.0 - 0.06 * clamp(1.0 - wpx, 0.0, 1.0) * (1.0 - smoothstep(0.42, 0.48, max(wq.x, wq.y)));
  // la crasse : au bas de la vitre, et en coulées qui descendent
  float streak = smoothstep(0.5, 0.95, gN(vec2(gp.x * 11.0, gp.y * 0.7 + h1 * 9.0))) * (1.0 - gf.y) * 0.6;
  float dirt = (1.0 - smoothstep(0.0, 0.16 + 0.1 * h3, gf.y)) * (0.25 + 0.45 * h1) + streak * (0.25 + 0.6 * h3);
  // de la mousse verdâtre sur quelques vitres, partie du bas
  if (h3 > 0.9) dirt += smoothstep(0.35, 0.8, gN(gp * vec2(7.0, 5.0) + h1 * 20.0)) * (1.0 - smoothstep(0.1, 0.7, gf.y)) * 1.2;
  col *= 1.0 - clamp(dirt, 0.0, 1.0) * vec3(0.42, 0.38, 0.46);
  // des feuilles mortes, posées sur le verre : des ombres à contre-jour
  if (h2 > 0.93) {
    for (int k = 0; k < 2; k++) {
      vec2 c = vec2(gH(gi + float(k) * 3.1), gH(gi + float(k) * 5.7 + 1.3) * 0.5) + vec2(0.0, 0.08);
      float a = gH(gi + float(k) * 9.1) * 6.2832;
      vec2 d = (gf - c) * vec2(0.625, 1.0);
      d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
      float leaf = length(d / vec2(0.06, 0.028)) - 1.0 + (gN(d * 60.0) - 0.5) * 0.5;
      col *= 1.0 - 0.72 * (1.0 - smoothstep(-0.1, 0.1, leaf)) * step(float(k), h1 * 2.0);
    }
  }
  // une vitre fêlée : trois traits qui partent d'un point
  if (h1 < 0.035) {
    vec2 o = vec2(0.25 + 0.5 * h2, 0.25 + 0.5 * h3);
    vec2 q = (gf - o) * vec2(0.625, 1.0);
    float cr = 0.0;
    for (int k = 0; k < 3; k++) {
      float a = (float(k) + h2) * 2.1;
      vec2 dir = vec2(cos(a), sin(a));
      float t = dot(q, dir);
      float dl = abs(dot(q, vec2(-dir.y, dir.x)) + 0.01 * sin(t * 70.0));
      float pw = max(fwidth(dl), 1e-4);
      cr = max(cr, step(0.0, t) * clamp((0.0025 + pw * 0.5 - dl) / pw, 0.0, 1.0));
    }
    col *= 1.0 - 0.5 * cr;
  }
  // les petits bois : d'aplomb entre les vitres (5 cm), plus fins aux recouvrements (3 cm)
  vec2 bd = min(gf, 1.0 - gf) * vec2(0.625, 1.0);
  vec2 bpx = max(fwidth(gp) * vec2(0.625, 1.0), vec2(1e-4));
  float bar = max(clamp((0.025 - bd.x) / bpx.x + 0.5, 0.0, 1.0), clamp((0.014 - bd.y) / bpx.y + 0.5, 0.0, 1.0));
  col = mix(col, vec3(0.3, 0.34, 0.35), bar);
  diffuseColor.rgb *= col;
}`,
        );
    };
    add(geometry(glass[0], glass[1]), glassMat);
    // les fermes en acier (profil en I), peintes en vert de gris : vues à contre-jour, sombres ; la panne faîtière en
    // haut, et un chéneau le long de chaque égout (il cache la jointure du verre et du mur)
    const beamMat = new THREE.MeshLambertMaterial({ color: '#56625f', emissive: '#56625f', emissiveIntensity: 0.55 });
    const iBeam = (len, h = 0.22, w = 0.16) => {
      const parts = [new THREE.BoxGeometry(0.025, h, len), new THREE.BoxGeometry(w, 0.022, len).translate(0, h / 2 - 0.011, 0), new THREE.BoxGeometry(w, 0.022, len).translate(0, -h / 2 + 0.011, 0)];
      const pos = [];
      for (const g of parts) {
        const ng = g.toNonIndexed();
        pos.push(...ng.attributes.position.array);
      }
      return geometry(pos);
    };
    const runs = new Map();
    for (const b of beams) {
      // une ferme de chaque côté, de l'égout au faîtage
      for (const [v0, v1] of [[0, b.S / 2], [b.S, b.S / 2]]) {
        const a = new THREE.Vector3(...b.P(b.u, v0, POOL_CEIL));
        const c = new THREE.Vector3(...b.P(b.u, v1, RIDGE));
        const len = a.distanceTo(c);
        const m = new THREE.Mesh(iBeam(len), beamMat);
        m.position.copy(a).add(c).multiplyScalar(0.5);
        m.lookAt(c);
        m.position.y -= 0.12;
        group.add(m);
      }
      runs.set(b.P, b);
    }
    for (const b of runs.values()) {
      // la panne faîtière
      const a = new THREE.Vector3(...b.P(0, b.S / 2, RIDGE - 0.13));
      const c = new THREE.Vector3(...b.P(b.L, b.S / 2, RIDGE - 0.13));
      const ridge = new THREE.Mesh(iBeam(a.distanceTo(c), 0.2, 0.14), beamMat);
      ridge.position.copy(a).add(c).multiplyScalar(0.5);
      ridge.lookAt(c);
      group.add(ridge);
      // les chéneaux, le long des deux égouts
      for (const v of [0.14, b.S - 0.14]) {
        const p0 = new THREE.Vector3(...b.P(0, v, POOL_CEIL - 0.06));
        const p1 = new THREE.Vector3(...b.P(b.L, v, POOL_CEIL - 0.06));
        const gut = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, p0.distanceTo(p1)), beamMat);
        gut.position.copy(p0).add(p1).multiplyScalar(0.5);
        gut.lookAt(p1);
        group.add(gut);
      }
    }
  }

  // --- 4. Colonnes, carrelées de mosaïque, du fond des bassins au plafond ---
  const colKinds = new Map();
  for (const c of map.cols) {
    const key = c.r.toFixed(2);
    if (!colKinds.has(key)) colKinds.set(key, []);
    colKinds.get(key).push(c);
  }
  const dummy = new THREE.Object3D();
  for (const [key, list] of colKinds) {
    const r = +key;
    const h = POOL_CEIL - BOTTOM;
    const geo = new THREE.CylinderGeometry(r, r, h, 28, 1, true);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * 2 * Math.PI * r) / C, (uv.getY(i) * h) / C);
    const inst = new THREE.InstancedMesh(geo, wallMat, list.length);
    list.forEach((c, i) => {
      dummy.position.set(c.x, (POOL_CEIL + BOTTOM) / 2, c.z);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.frustumCulled = false;
    group.add(inst);
  }

  // --- 5. Hublots ronds sur les longs murs des halles sous verrière ---
  const portMat = new THREE.MeshBasicMaterial({ color: '#8fb7b8' }); // le verre des hublots, un peu sombre
  const chrome = baked(new THREE.MeshLambertMaterial({ color: '#dfe5e8', emissive: '#596066', emissiveIntensity: 0.4 }));
  const portGeo = new THREE.CircleGeometry(0.34, 24);
  const ringGeo = new THREE.TorusGeometry(0.36, 0.04, 6, 24);
  for (const r of map.rooms) {
    if (r.ceil !== 'sky') continue;
    const ax = r.long === 'x';
    const L = ax ? r.w : r.h;
    for (let u = C / 2; u < L; u += C) {
      for (const [side, n] of [[0, 1], [1, -1]]) {
        const x = ax ? r.x0 + u : side ? r.x1 - 0.02 : r.x0 + 0.02;
        const z = ax ? (side ? r.z1 - 0.02 : r.z0 + 0.02) : r.z0 + u;
        if (map.doors.some((d) => Math.hypot(d.px - x, d.pz - z) < 2.2)) continue;
        // (pas derrière la plaque ni l'arrivée d'eau d'un toboggan)
        if ((map.slides || []).some((sl) => Math.hypot(sl.x - x, sl.z - z) < 1.9)) continue;
        if (map.collide(x + (ax ? 0 : n * 0.3), z + (ax ? n * 0.3 : 0), 0.05)) continue;
        for (const [geo, mat, dz] of [[portGeo, portMat, 0.005], [ringGeo, chrome, 0.01]]) {
          const m = new THREE.Mesh(geo, mat);
          m.position.set(x + (ax ? 0 : n * dz), 2.3, z + (ax ? n * dz : 0));
          m.rotation.y = ax ? (n > 0 ? 0 : Math.PI) : n > 0 ? Math.PI / 2 : -Math.PI / 2;
          group.add(m);
        }
      }
    }
  }

  // --- 6. Échelles chromées : deux montants recourbés au-dessus de la margelle, trois marches sous l'eau ---
  for (const l of map.ladders || []) {
    const g = new THREE.Group();
    for (const side of [-0.26, 0.26]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side, 0, -0.5),
        new THREE.Vector3(side, 0.7, -0.45),
        new THREE.Vector3(side, 0.95, -0.2),
        new THREE.Vector3(side, 0.8, 0.07),
        new THREE.Vector3(side, 0.1, 0.13),
        new THREE.Vector3(side, -0.9, 0.13),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.025, 8, false), chrome));
    }
    for (const y of [-0.22, -0.48, -0.74]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.09), chrome);
      st.position.set(0, y, 0.15);
      g.add(st);
    }
    g.position.set(l.x, 0, l.z);
    g.rotation.y = Math.atan2(l.dx, l.dz); // +z local = vers l'eau
    group.add(g);
  }

  // --- 6b. Les toboggans : le départ d'un toboggan aquatique en polyester, comme dans un parc. Un tube coloré et luisant
  // sort du mur sur 95 cm, posé sur un socle, ouvert en pavillon au bourrelet roulé ; par la bouche, on voit le tube
  // continuer derrière le mur et ses raccords, puis plonger et tourner dans le noir (voir tunnelMat). Le tube est sec :
  // l'arrivée d'eau chromée qui entre dans son haut est coupée. Des brides boulonnées, la barre d'appui en inox pour se lancer, une plaque émaillée à sa
  // couleur, un tapis antidérapant devant. Une grille ronde le ferme quand un autre toboggan a été pris ---
  const slideMeshes = [];
  const steel = baked(new THREE.MeshPhongMaterial({ color: '#c3cacf', specular: '#ffffff', shininess: 110 }), { spec: 0.6, gloss: 260 });
  const R = MOUTH.r;
  const SL = 0.95; // ce qui dépasse du mur
  const TH = 0.05; // l'épaisseur de la coque
  const FL = 0.16; // l'évasement du pavillon
  // le profil de la coque (rayon, avancée depuis le mur) : dehors du mur au pavillon, le bourrelet, dedans jusqu'au mur
  const prof = [];
  const inner = []; // (pour chaque point : sur la face intérieure ?)
  const pt = (r, a, i) => {
    prof.push(new THREE.Vector2(r, a));
    inner.push(i);
  };
  const A0 = SL - 0.34;
  pt(R + TH, -0.03, false);
  for (let k = 0; k <= 10; k++) pt(R + TH + FL * (k / 10) ** 2, A0 + 0.32 * (k / 10), false);
  for (let k = 1; k < 8; k++) {
    const t = (k / 8) * Math.PI;
    pt(R + FL + TH / 2 + (TH / 2) * Math.cos(t), SL - 0.02 + (TH / 2) * Math.sin(t), false);
  }
  for (let k = 10; k >= 0; k--) pt(R + FL * (k / 10) ** 2, A0 + 0.32 * (k / 10), true);
  pt(R, 0.18, true);
  pt(R, -0.03, true);
  const shellGeo = new THREE.LatheGeometry(prof, 56);
  {
    // dedans, la coque s'assombrit vers le mur : le tube plonge dans le noir
    const n = prof.length;
    const col = new Float32Array(shellGeo.attributes.position.count * 3);
    for (let v = 0; v < shellGeo.attributes.position.count; v++) {
      const j = v % n;
      const a = prof[j].y;
      const t = Math.min(1, Math.max(0, a / (SL - 0.15)));
      const k = inner[j] ? 0.55 + 0.45 * t * t * (3 - 2 * t) : 1;
      col[v * 3] = col[v * 3 + 1] = col[v * 3 + 2] = k;
    }
    shellGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  shellGeo.rotateX(Math.PI / 2).translate(0, MOUTH.y, 0);
  // une bride : un anneau plat autour du tube (avancée a), et ses boulons sur la face avant
  const flangeGeo = (a, w, h) => {
    const p = [new THREE.Vector2(R + TH - 0.002, a), new THREE.Vector2(R + TH + w, a), new THREE.Vector2(R + TH + w, a + h), new THREE.Vector2(R + TH - 0.002, a + h)];
    const g = new THREE.LatheGeometry(p, 56).rotateX(Math.PI / 2).translate(0, MOUTH.y, 0);
    g.deleteAttribute('uv');
    return g;
  };
  const boltsGeo = (a, rr, n) => {
    const list = [];
    for (let k = 0; k < n; k++) {
      const t = ((k + 0.5) / n) * Math.PI * 2;
      const b = new THREE.CylinderGeometry(0.013, 0.013, 0.018, 6).rotateX(Math.PI / 2);
      b.translate(Math.cos(t) * rr, MOUTH.y + Math.sin(t) * rr, a);
      b.deleteAttribute('uv');
      list.push(b);
    }
    return mergeGeometries(list);
  };
  const flanges = mergeGeometries([flangeGeo(0, 0.1, 0.03), flangeGeo(0.36, 0.055, 0.035)]);
  const bolts = mergeGeometries([boltsGeo(0.035, R + TH + 0.055, 16), boltsGeo(0.4, R + TH + 0.03, 14), boltsGeo(0.36 - 0.004, R + TH + 0.03, 14)]);
  const AIN = SL - 0.42; // là où l'arrivée d'eau entre dans le tube
  // Derrière le mur, le tube continue : un disque au ras du mur, qui montre en perspective (lancer de rayon dans un
  // tube virtuel) la suite du toboggan. Tout droit sur 60 cm, puis il plonge et tourne du côté de son premier virage ;
  // la lumière de la salle s'y éteint vite, les raccords passent tous les 1,6 m ; la lampe du joueur l'éclaire. Rien ne
  // dépasse de l'autre côté du mur
  const tunnelMat = (sl) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uO: { value: new THREE.Vector3(sl.x - sl.dx * 0.012, MOUTH.y, sl.z - sl.dz * 0.012) },
        uF: { value: new THREE.Vector3(sl.dx, 0, sl.dz).normalize() },
        uS: { value: new THREE.Vector3(sl.dx, 0, sl.dz).normalize().cross(new THREE.Vector3(0, 1, 0)) },
        uColor: { value: new THREE.Color(sl.hex) },
        uR: { value: R },
        uSide: { value: sl.id % 2 ? -1 : 1 },
        uTime: { value: 0 },
        uLamp: { value: 0 },
        uAmb: { value: 0.55 },
      },
      vertexShader: `varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
      fragmentShader: `uniform vec3 uO;
uniform vec3 uF;
uniform vec3 uS;
uniform vec3 uColor;
uniform float uR;
uniform float uSide;
uniform float uTime;
uniform float uLamp;
uniform float uAmb;
varying vec3 vW;
vec2 axisAt(float z) {
  float b = max(0.0, z - 0.6);
  return vec2(-uSide * 0.11 * b * b, -0.17 * b * b);
}
void main() {
  vec3 U = vec3(0.0, 1.0, 0.0);
  vec3 rd = normalize(vW - cameraPosition);
  vec3 p0 = vW - uO;
  vec3 p = vec3(dot(p0, uS), dot(p0, U), dot(p0, uF));
  vec3 d = vec3(dot(rd, uS), dot(rd, U), dot(rd, uF));
  float lat = max(length(d.xy), 0.12);
  float t = 0.0;
  float t0 = 0.0;
  bool hit = false;
  for (int i = 0; i < 72; i++) {
    vec3 q = p + d * t;
    if (length(q.xy - axisAt(q.z)) >= uR) { hit = true; break; }
    if (q.z > 8.0) break;
    t0 = t;
    t += clamp((uR - length(q.xy - axisAt(q.z))) * 0.6 / lat, 0.008, 0.3);
  }
  if (hit) {
    for (int i = 0; i < 6; i++) {
      float m = 0.5 * (t0 + t);
      vec3 q = p + d * m;
      if (length(q.xy - axisAt(q.z)) >= uR) t = m; else t0 = m;
    }
  }
  vec3 q = p + d * t;
  float z = hit ? q.z : 8.0;
  float fw = fwidth(z) + 1e-4;
  vec3 col = vec3(0.0);
  if (hit) {
    vec2 n2 = normalize(q.xy - axisAt(q.z));
    float ang = atan(n2.x, -n2.y);
    // la lumière de la salle entre par la bouche et s'éteint vite ; le haut, un peu plus sombre
    float amb = uAmb * exp(-z * 1.7) * (0.8 + 0.2 * (-n2.y));
    float dist = t + length(vW - cameraPosition);
    vec3 nW = -(n2.x * uS + n2.y * U);
    float lamp = uLamp * max(0.0, dot(nW, -rd)) * 5.0 / (1.0 + dist * dist);
    float light = amb + lamp;
    // les raccords des tronçons : une rainure sombre et le jonc de la bride
    float jf = fract((z + 0.02) / 1.6);
    float dj = min(jf, 1.0 - jf) * 1.6;
    float groove = 1.0 - smoothstep(0.018, 0.018 + fw * 1.5, dj);
    float lip = 1.0 - smoothstep(0.0, 0.012 + fw * 1.5, abs(dj - 0.045));
    col = uColor * (1.0 - 0.75 * groove) * (1.0 + 0.45 * lip) * light;
    // le reflet du polyester, vers la bouche
    col += vec3(1.0) * pow(max(0.0, dot(reflect(rd, nW), -uF)), 24.0) * amb * 0.35;
  }
  gl_FragColor = vec4(col, 1.0);
}`,
    });
  // le tapis antidérapant : caoutchouc gris foncé percé de trous, liseré de la couleur du toboggan
  const matCanvas = (hex) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#2f3436';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#1b1f20';
    for (let y = 18; y < 240; y += 16) for (let x = 18 + ((y / 16) % 2) * 8; x < 240; x += 16) {
      g.beginPath();
      g.arc(x, y, 4.2, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = hex;
    g.lineWidth = 9;
    g.strokeRect(5, 5, 246, 246);
    // l'usure : plus pâle au milieu, là où on marche
    const w = g.createRadialGradient(128, 150, 10, 128, 150, 130);
    w.addColorStop(0, 'rgba(160,170,170,0.22)');
    w.addColorStop(1, 'rgba(160,170,170,0)');
    g.fillStyle = w;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // la plaque émaillée : le nom, et la consigne
  const signCanvas = (sl) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 192;
    const g = c.getContext('2d');
    g.fillStyle = '#f2f0e8';
    g.fillRect(0, 0, 512, 192);
    g.fillStyle = sl.hex;
    g.fillRect(10, 10, 492, 172);
    g.strokeStyle = '#f2f0e8';
    g.lineWidth = 4;
    g.strokeRect(20, 20, 472, 152);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.font = 'bold 74px Arial, Helvetica, sans-serif';
    g.fillText(`${sl.name} SLIDE`, 256, 104);
    g.font = 'bold 26px Arial, Helvetica, sans-serif';
    g.fillText('FEET FIRST  ·  ONE AT A TIME', 256, 150);
    // l'émail écaillé aux coins, la rouille des vis
    for (const [x, y] of [[26, 26], [486, 26], [26, 166], [486, 166]]) {
      g.fillStyle = '#5b4a3a';
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 9; i++) {
      g.fillStyle = 'rgba(40,40,40,0.55)';
      const x = Math.random() < 0.5 ? Math.random() * 40 : 472 + Math.random() * 40;
      g.beginPath();
      g.ellipse(x, Math.random() * 192, 2 + Math.random() * 6, 1.5 + Math.random() * 4, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  for (const sl of map.slides || []) {
    const g = new THREE.Group();
    g.position.set(sl.x, 0, sl.z);
    g.rotation.y = Math.atan2(-sl.dx, -sl.dz); // +z local = vers la salle
    const spec = { spec: 0.5, gloss: 220 };
    const gelIn = baked(new THREE.MeshPhongMaterial({ color: sl.hex, specular: '#ffffff', shininess: 90, vertexColors: true, side: THREE.DoubleSide }), spec);
    const gel = baked(new THREE.MeshPhongMaterial({ color: sl.hex, specular: '#ffffff', shininess: 90 }), spec);
    const shell = new THREE.Mesh(shellGeo, gelIn);
    // la suite du tube, derrière le mur (voir tunnelMat)
    const hole = new THREE.Mesh(new THREE.CircleGeometry(R + 0.01, 40), tunnelMat(sl));
    hole.position.set(0, MOUTH.y, 0.012);
    // le socle carrelé sous le tube, du sol (ou du fond de la pataugeoire) à la coque
    const fy = -map.depthAt(sl.x - sl.dx * 0.6, sl.z - sl.dz * 0.6);
    const by = MOUTH.y - R - TH + 0.01;
    // (il s'arrête avant le pavillon, qui s'évase par-dessus)
    const bd = A0 - 0.03;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, by - fy, bd), mats.coping);
    base.position.set(0, (by + fy) / 2, bd / 2);
    // l'arrivée d'eau : un tuyau chromé sort du mur, descend, et plonge dans le haut du tube, avec sa vanne
    const top = MOUTH.y + R + TH;
    const feed = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.32, 2.95, 0),
      new THREE.Vector3(-0.32, 2.95, 0.1),
      new THREE.Vector3(-0.32, 2.75, 0.13),
      new THREE.Vector3(-0.32, 2.12, 0.13),
      new THREE.Vector3(-0.24, 1.82, 0.26),
      new THREE.Vector3(-0.08, top + 0.1, AIN - 0.06),
      new THREE.Vector3(0, top - 0.04, AIN),
    ], false, 'centripetal');
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(feed, 40, 0.038, 10, false), steel);
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 16).rotateX(Math.PI / 2), steel);
    rose.position.set(-0.32, 2.95, 0.012);
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 16), new THREE.MeshLambertMaterial({ color: '#2f5fae' }));
    valve.position.set(-0.32, 2.3, 0.22);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6).rotateX(Math.PI / 2), steel);
    stem.position.set(-0.32, 2.3, 0.17);
    // la barre d'appui : un U en inox au-dessus du départ, fixé au mur par deux rosaces
    const BY = 1.86;
    const bz = SL - 0.3;
    const bar = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.6, BY, 0),
      new THREE.Vector3(-0.6, BY, bz - 0.2),
      new THREE.Vector3(-0.56, BY, bz - 0.04),
      new THREE.Vector3(-0.42, BY, bz),
      new THREE.Vector3(0.42, BY, bz),
      new THREE.Vector3(0.56, BY, bz - 0.04),
      new THREE.Vector3(0.6, BY, bz - 0.2),
      new THREE.Vector3(0.6, BY, 0),
    ], false, 'centripetal');
    const grip = new THREE.Mesh(new THREE.TubeGeometry(bar, 60, 0.021, 8, false), steel);
    const roses = mergeGeometries([-0.6, 0.6].map((x) => new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14).rotateX(Math.PI / 2).translate(x, BY, 0.01)));
    // la plaque, au-dessus
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.345), baked(new THREE.MeshLambertMaterial({ map: signCanvas(sl), emissive: '#ffffff', emissiveIntensity: 0.06 })));
    sign.material.emissiveMap = sign.material.map;
    sign.position.set(0.3, 2.42, 0.012);
    // le tapis, devant
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.0).rotateX(-Math.PI / 2), baked(new THREE.MeshLambertMaterial({ map: matCanvas(sl.hex), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
    mat.position.set(0, fy + 0.008, SL + 0.62);
    // la grille, quand le toboggan est fermé : un cercle et ses barreaux, cadenassés
    const gl = [new THREE.TorusGeometry(R + 0.005, 0.026, 8, 40)];
    for (let k = -3; k <= 3; k++) {
      const x = k * 0.16;
      const h = 2 * Math.sqrt(Math.max(0, R * R - x * x));
      gl.push(new THREE.CylinderGeometry(0.018, 0.018, h, 6).translate(x, 0, 0));
    }
    gl.push(new THREE.CylinderGeometry(0.018, 0.018, 2 * R, 6).rotateZ(Math.PI / 2));
    gl.push(new THREE.BoxGeometry(0.07, 0.09, 0.04).translate(R * 0.72, -R * 0.66, 0.03));
    for (const x of gl) x.deleteAttribute('uv');
    const grate = new THREE.Mesh(mergeGeometries(gl).translate(0, MOUTH.y, SL - 0.12), steel);
    g.add(shell, hole, base, new THREE.Mesh(flanges, gel), new THREE.Mesh(bolts, steel), pipe, rose, valve, stem, grip, new THREE.Mesh(roses, steel), sign, mat, grate);
    group.add(g);
    slideMeshes.push({ sl, grate, tunnel: hole.material });
  }

  // --- 6c. Les détails d'une vraie piscine, un peu fatiguée : la bonde au fond de chaque bassin, les skimmers au ras
  // de l'eau, la profondeur peinte sur la margelle (et « NO DIVING » là où c'est peu profond), les bouches d'aération
  // au plafond. Tout est tiré des positions (les mêmes pour tous les joueurs) ---
  const hr = (x, z, k) => {
    const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
    return v - Math.floor(v);
  };
  const paint = (w, h, draw) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  // de la peinture qui s'écaille : des points effacés, tirés d'une suite fixe
  const chip = (c, w, h, n, seed) => {
    c.save();
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < n; i++) {
      const r = hr(i, seed, 1);
      c.globalAlpha = 0.4 + 0.6 * hr(i, seed, 4);
      c.beginPath();
      c.arc(hr(i, seed, 2) * w, hr(i, seed, 3) * h, 0.6 + r * r * 3.2, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  };
  const decal = (tex) => baked(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  // un quadrilatère (quatre coins, dans l'ordre) tourné vers n, avec ses uv
  const quads = () => ({ pos: [], uv: [] });
  const pushQuad = (q, P, U, n) => {
    const [a, b, c] = P;
    const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const order = cx * n[0] + cy * n[1] + cz * n[2] >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const i of order) {
      q.pos.push(...P[i]);
      q.uv.push(...U[i]);
    }
  };
  const avoid = (x, z, d) => (map.ladders || []).some((l) => Math.hypot(l.x - x, l.z - z) < d) || (map.slides || []).some((sl) => Math.hypot(sl.x - x, sl.z - z) < d + 1) || map.doors.some((o) => Math.hypot(o.px - x, o.pz - z) < d);

  // la profondeur peinte : 0,4 à 3,4 m, et « NO DIVING » (la dernière case)
  const depthTex = paint(1024, 256, (c) => {
    for (let k = 0; k < 32; k++) {
      const cx = (k % 8) * 128 + 64;
      const cy = Math.floor(k / 8) * 64 + 34;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (k === 31) {
        c.fillStyle = '#a3241c';
        c.font = 'bold 25px "Arial Narrow", Arial, sans-serif';
        c.fillText('NO DIVING', cx, cy);
      } else {
        c.fillStyle = '#1a1c1c';
        c.font = 'bold 40px "Arial Narrow", Arial, sans-serif';
        c.fillText(`${((k + 4) / 10).toFixed(1)} m`, cx, cy);
      }
    }
    chip(c, 1024, 256, 2600, 7);
  });
  const marks = quads();
  const skims = quads();
  const placed = [];
  for (const e of edgeSegs) {
    const ty = e.room.type;
    if (ty !== 'lagoon' && ty !== 'wade' && ty !== 'sky' && ty !== 'groin') continue;
    const cx = e.x + e.gx * COP * 0.5;
    const cz = e.z + e.gz * COP * 0.5;
    if (avoid(cx, cz, 1.4) || map.collide(cx + e.gx * 0.3, cz + e.gz * 0.3, 0.2)) continue;
    const kind = placed.some((p) => p.room === e.room && Math.hypot(p.x - cx, p.z - cz) < 5.5) ? null : placed.filter((p) => p.room === e.room).length % 2 ? 'skim' : 'mark';
    if (!kind) continue;
    placed.push({ room: e.room, x: cx, z: cz });
    const F = [-e.gx, -e.gz]; // vers l'eau
    const Rt = [e.gz, -e.gx]; // la droite de qui regarde l'eau depuis le bord
    if (kind === 'mark') {
      const k = e.d < 1.35 && hr(cx, cz, 9) < 0.5 ? 31 : Math.max(0, Math.min(30, Math.round(e.d * 10) - 4));
      const u0 = (k % 8) / 8;
      const u1 = u0 + 1 / 8;
      const v1 = 1 - Math.floor(k / 8) / 4;
      const v0 = v1 - 1 / 4;
      const w = 0.3;
      const h = 0.15;
      const y = COP_Y + 0.003;
      const P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + (Rt[0] * a * w) / 2 + (F[0] * b * h) / 2, y, cz + (Rt[1] * a * w) / 2 + (F[1] * b * h) / 2]);
      pushQuad(marks, P, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [0, 1, 0]);
    } else {
      // le skimmer : sa bouche dans la paroi, à moitié sous l'eau
      const sx = e.x + F[0] * 0.007;
      const sz = e.z + F[1] * 0.007;
      const P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [sx + (Rt[0] * a * 0.36) / 2, -0.035 + b * 0.075, sz + (Rt[1] * a * 0.36) / 2]);
      pushQuad(skims, P, [[0, 0], [1, 0], [1, 1], [0, 1]], [F[0], 0, F[1]]);
    }
  }
  if (marks.pos.length) add(geometry(marks.pos, marks.uv), decal(depthTex));
  const skimTex = paint(128, 56, (c, w, h) => {
    c.fillStyle = '#dfe3dc';
    c.beginPath();
    c.roundRect(0, 0, w, h, 9);
    c.fill();
    c.fillStyle = '#121817';
    c.beginPath();
    c.roundRect(9, 9, w - 18, h - 16, 5);
    c.fill();
    // le volet flottant, entrouvert
    c.fillStyle = '#4c5553';
    c.fillRect(12, 12, w - 24, 9);
    c.fillStyle = 'rgba(120,96,60,0.45)';
    c.fillRect(0, h - 6, w, 6);
  });
  if (skims.pos.length) add(geometry(skims.pos, skims.uv), decal(skimTex));

  // la bonde : une grille ronde en inox, aux fentes encrassées, posée sur le fond (qui penche un peu)
  const drainTex = paint(128, 128, (c) => {
    c.fillStyle = '#9ba3a4';
    c.beginPath();
    c.arc(64, 64, 63, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#5d6566';
    c.lineWidth = 5;
    c.stroke();
    c.fillStyle = '#151b1b';
    for (let y = 24; y <= 104; y += 10) {
      const hw = Math.sqrt(Math.max(0, 50 * 50 - (y - 64) ** 2));
      if (hw > 6) c.fillRect(64 - hw, y - 2.5, hw * 2, 5);
    }
    c.fillStyle = 'rgba(90,70,40,0.35)';
    c.beginPath();
    c.arc(64, 64, 60, 0, Math.PI * 2);
    c.lineWidth = 9;
    c.strokeStyle = 'rgba(80,66,40,0.4)';
    c.stroke();
  });
  const drainQ = { pos: [], uv: [] };
  for (const d of drains) {
    const N = 20;
    const rad = 0.22;
    const yAt = (x, z) => -d.depthOf(x, z) + 0.004;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 1) / N) * Math.PI * 2;
      const pts = [[d.x, d.z, 0.5, 0.5], [d.x + Math.cos(a1) * rad, d.z + Math.sin(a1) * rad, 0.5 + Math.cos(a1) * 0.5, 0.5 + Math.sin(a1) * 0.5], [d.x + Math.cos(a0) * rad, d.z + Math.sin(a0) * rad, 0.5 + Math.cos(a0) * 0.5, 0.5 + Math.sin(a0) * 0.5]];
      for (const [x, z, u, v] of pts) {
        drainQ.pos.push(x, yAt(x, z), z);
        drainQ.uv.push(u, v);
      }
    }
  }
  if (drainQ.pos.length) add(geometry(drainQ.pos, drainQ.uv), decal(drainTex));

  // les bouches d'aération : des lames grises sous les plafonds plats, entre les dalles, le pourtour taché de poussière
  const ventTex = paint(128, 64, (c, w, h) => {
    c.fillStyle = '#8d9493';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#20272a';
    c.fillRect(7, 7, w - 14, h - 14);
    for (let x = 12; x < w - 12; x += 8) {
      c.fillStyle = '#7a8382';
      c.fillRect(x, 8, 4, h - 16);
      c.fillStyle = '#a2aaa8';
      c.fillRect(x, 8, 1.5, h - 16);
    }
    c.strokeStyle = 'rgba(60,55,45,0.5)';
    c.lineWidth = 3;
    c.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
  const vents = quads();
  for (const r of map.rooms) {
    if (r.ceil !== 'flat') continue;
    for (let x = r.x0 + 5; x < r.x1 - 1; x += 5) {
      for (let z = r.z0 + 5; z < r.z1 - 1; z += 5) {
        if (hr(x, z, 13) > 0.3) continue;
        const along = hr(x, z, 14) < 0.5;
        const hw = along ? 0.36 : 0.18;
        const hd = along ? 0.18 : 0.36;
        const y = POOL_CEIL - 0.004;
        pushQuad(vents, [[x - hw, y, z - hd], [x + hw, y, z - hd], [x + hw, y, z + hd], [x - hw, y, z + hd]], along ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 1], [0, 0], [1, 0], [1, 1]], [0, -1, 0]);
      }
    }
  }
  if (vents.pos.length) add(geometry(vents.pos, vents.uv), decal(ventTex));

  // --- 7. La surface de l'eau : un miroir à peine ridé (Fresnel : on voit le fond de près et d'en haut, la salle s'y
  // reflète en rasant). Ce qu'elle reflète : le plafond éclairé, les dalles lumineuses (nettes, tremblées par les
  // rides), les murs au loin, et le faisceau de la lampe torche. Ce qu'on voit à travers : le fond carrelé, voilé
  // d'autant plus que l'eau est profonde et qu'on la regarde de biais (l'eau absorbe le rouge, renvoie un vert d'eau).
  // Mélange prémultiplié : la couleur s'ajoute à ce qui est derrière, atténué par la transparence ---
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(wDep, 1));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(wEdge, 1));
  const splash = Array.from({ length: SPLASHES }, () => new THREE.Vector4(0, 0, -100, 0));
  const NF = film.uFilmL.value.length;
  const uniforms = {
    uTime: { value: 0 },
    uBake: bake.uBake,
    uBakeScale: bake.uBakeScale,
    uBakeTint: bake.uBakeTint,
    uGlossH: bake.uGlossH,
    uFilmL: film.uFilmL,
    uFilmC: film.uFilmC,
    uFogColor: { value: fog.color },
    uFogDensity: { value: fog.density },
    uSplash: { value: splash },
    uLampP: { value: new THREE.Vector3() },
    uLampD: { value: new THREE.Vector3(0, 0, -1) },
    uLamp: { value: 0 },
    uRefl: { value: null },
    uReflOn: { value: 0 },
    uReflM: { value: new THREE.Matrix4() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `attribute float aDepth;
attribute float aEdge;
uniform mat4 uReflM;
varying float vDepth;
varying float vEdge;
varying vec3 vWorld;
varying vec4 vRefl;
void main() {
  vDepth = aDepth;
  vEdge = aEdge;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vRefl = uReflM * w;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uTime;
uniform sampler2D uBake;
uniform vec2 uBakeScale;
uniform vec3 uBakeTint;
uniform float uGlossH;
uniform vec3 uFilmL[${NF}];
uniform vec3 uFilmC[${NF}];
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec4 uSplash[${SPLASHES}];
uniform vec3 uLampP;
uniform vec3 uLampD;
uniform float uLamp;
uniform sampler2D uRefl;
uniform float uReflOn;
varying float vDepth;
varying float vEdge;
varying vec3 vWorld;
varying vec4 vRefl;
float hgt(vec2 p) {
  // l'eau est presque immobile : deux houles très lentes, des rides fines qui se croisent
  float h = sin(p.x * 1.3 + uTime * 0.6) * 0.012 + sin(p.y * 1.7 - uTime * 0.5) * 0.010;
  h += sin((p.x + p.y) * 4.1 + uTime * 1.3) * 0.004 + sin((p.x - p.y) * 5.3 - uTime * 1.1) * 0.003;
  h += sin(p.x * 9.7 - p.y * 3.1 + uTime * 1.9) * 0.0012 + sin(p.y * 11.3 + p.x * 2.3 - uTime * 2.3) * 0.001;
  // les ronds des pas
  for (int i = 0; i < ${SPLASHES}; i++) {
    vec4 s = uSplash[i];
    float age = uTime - s.z;
    if (age < 0.0 || age > 3.0) continue;
    float d = distance(p, s.xy);
    float r = age * 0.9;
    h += sin((d - r) * 22.0) * exp(-age * 1.4) * exp(-abs(d - r) * 5.0) * 0.02 * s.w;
  }
  return h;
}
void main() {
  vec2 p = vWorld.xz;
  float e = 0.03;
  vec3 n = normalize(vec3(-(hgt(p + vec2(e, 0.0)) - hgt(p - vec2(e, 0.0))) / (2.0 * e), 1.0, -(hgt(p + vec2(0.0, e)) - hgt(p - vec2(0.0, e))) / (2.0 * e)));
  vec3 toEye = cameraPosition - vWorld;
  float eyeD = length(toEye);
  vec3 v = toEye / eyeD;
  if (v.y < 0.0) n.y = -n.y; // vue d'en dessous (la tête sous l'eau)
  float cosI = clamp(abs(dot(n, v)), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosI, 5.0);
  float light = texture2D(uBake, p * uBakeScale).r * 2.0;
  // le reflet : le rayon renvoyé vers le haut coupe le plan des dalles
  vec3 r = reflect(-v, n);
  float ry = max(r.y, 0.03);
  float H = uGlossH - vWorld.y;
  vec2 hit = p + r.xz * (H / ry);
  float hd = H / ry * length(r.xz);
  vec3 ceilC = uBakeTint * texture2D(uBake, clamp(hit * uBakeScale, 0.0, 1.0)).r * 1.7;
  float blur = 0.015 + hd * 0.008;
  vec3 pan = vec3(0.0);
  for (int i = 0; i < ${NF}; i++) {
    vec2 q = abs(hit - uFilmL[i].xy) - vec2(0.64) * uFilmL[i].z;
    float d = max(q.x, q.y);
    pan += uFilmC[i] * ((1.0 - smoothstep(-blur, blur, d)) * 2.4 + exp(-max(d, 0.0) / (0.12 + blur * 2.0)) * 0.2);
  }
  // en rasant, le rayon renvoyé touche un mur avant le plafond : un mur carrelé clair, éclairé comme la salle
  vec3 wallC = uBakeTint * texture2D(uBake, clamp((p + normalize(r.xz + vec2(1e-4)) * 2.5) * uBakeScale, 0.0, 1.0)).r * 1.5;
  vec3 refl = mix(ceilC + pan, wallC, smoothstep(6.0, 14.0, hd));
  // le vrai reflet de la salle (colonnes, murs, dalles, ce qui passe au bord), décalé par les rides
  if (uReflOn > 0.5) {
    vec2 ruv = vRefl.xy / vRefl.w + n.xz * vec2(0.6, -0.6) * min(1.0, 3.0 / max(eyeD, 1.0));
    refl = mix(refl, texture2D(uRefl, clamp(ruv, 0.002, 0.998)).rgb, smoothstep(-0.02, 0.0, min(min(ruv.x, ruv.y), 1.0 - max(ruv.x, ruv.y))) * 0.92 + 0.0);
  }
  // la lampe torche : un éclat vif là où le faisceau tombe sur l'eau
  if (uLamp > 0.01) {
    vec3 lv = uLampP - vWorld;
    float ld = length(lv);
    vec3 l = lv / ld;
    float cone = smoothstep(0.89, 0.978, dot(-l, uLampD));
    float sh = max(dot(n, normalize(l + v)), 0.0);
    refl += vec3(1.0, 0.95, 0.85) * cone * uLamp * (pow(sh, 500.0) * 6.0 + pow(sh, 60.0) * 0.3) / (1.0 + ld * ld * 0.04) / max(fres, 0.05);
  }
  // à travers l'eau : le chemin réfracté jusqu'au fond, et ce qu'il en reste
  float sinT = sqrt(max(0.0, 1.0 - cosI * cosI)) / 1.33;
  float cosT = sqrt(max(0.0, 1.0 - sinT * sinT));
  float path = vDepth / max(cosT, 0.12);
  float T = exp(-path * 0.95);
  // l'eau elle-même : un vert d'eau lumineux là où il fait clair, plus sombre au fond des fosses
  vec3 scat = mix(vec3(0.16, 0.62, 0.6), vec3(0.03, 0.3, 0.36), clamp(vDepth / 2.2, 0.0, 1.0)) * (0.25 + light * 0.62);
  // au ras du bord, une fine ligne plus claire (le ménisque contre le carrelage)
  float rim = (1.0 - smoothstep(0.0, 0.04, vEdge)) * 0.25;
  float a = 1.0 - T * (1.0 - fres);
  vec3 col = scat * (1.0 - T) * (1.0 - fres) + refl * fres + vec3(rim) * light * 0.3;
  float fogF = 1.0 - exp(-uFogDensity * uFogDensity * eyeD * eyeD);
  gl_FragColor = vec4(col * (1.0 - fogF) + uFogColor * fogF * a, a);
}`,
  });
  const surface = new THREE.Mesh(geo, mat);
  const BASE = -0.03;
  surface.position.y = BASE;
  surface.renderOrder = 3;
  surface.frustumCulled = false;
  group.add(surface);

  // --- 8. L'ombre au fond des bassins profonds ---
  const sc = document.createElement('canvas');
  sc.width = 256;
  sc.height = 64;
  const sg = sc.getContext('2d');
  sg.filter = 'blur(6px)';
  sg.fillStyle = '#000';
  sg.beginPath();
  sg.ellipse(110, 32, 80, 15, 0, 0, Math.PI * 2); // le corps
  sg.fill();
  sg.beginPath();
  sg.moveTo(180, 32);
  sg.quadraticCurveTo(220, 22, 250, 30); // la queue
  sg.quadraticCurveTo(220, 40, 180, 34);
  sg.fill();
  const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', alphaMap: new THREE.CanvasTexture(sc), transparent: true, opacity: 0, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9).rotateX(-Math.PI / 2), shadowMat);
  shadow.renderOrder = 2;
  group.add(shadow);
  const ghostSpots = deepSpots.filter((_, i) => i % 7 === 0);
  let ghost = null;
  let nextGhost = 25 + Math.random() * 20;

  const mirror = { on: true, rt: null, cam: new THREE.PerspectiveCamera(), size: new THREE.Vector2(), n: new THREE.Vector3(0, 1, 0), o: new THREE.Vector3(), cp: new THREE.Vector3(), v: new THREE.Vector3(), l: new THREE.Vector3(), t: new THREE.Vector3(), rot: new THREE.Matrix4(), plane: new THREE.Plane(), clip: new THREE.Vector4(), q: new THREE.Vector4() };

  // --- 9. L'eau qui change de niveau quand on ne la regarde pas ---
  let level = BASE;
  let levelWant = BASE;
  let nextShift = 30 + Math.random() * 30;
  const fwd = new THREE.Vector3();
  const steps = new Map();
  let si = 0;

  return {
    get level() {
      return level;
    },
    setMirror(on) {
      mirror.on = on;
      if (!on) uniforms.uReflOn.value = 0;
    },
    // la salle vue dans l'eau : une caméra en miroir sous le plan de l'eau, dont le plan proche est ce plan (rien de ce
    // qui est sous l'eau n'y entre), dans une petite image (360 lignes) ; l'eau la lit à l'endroit de chaque pixel
    reflect(renderer, scene, camera, hide = []) {
      uniforms.uReflOn.value = 0;
      if (!mirror.on || !surface.visible) return;
      const y = surface.position.y + group.position.y;
      camera.updateMatrixWorld();
      const cp = mirror.cp.setFromMatrixPosition(camera.matrixWorld);
      if (cp.y < y + 0.05) return;
      // assez d'eau à portée de vue ?
      let near = false;
      for (const w of waterSpots) if (Math.abs(w.x - cp.x) + Math.abs(w.z - cp.z) < 30) { near = true; break; }
      if (!near) return;
      renderer.getDrawingBufferSize(mirror.size);
      const h = 360;
      const w = Math.max(64, Math.round((h * mirror.size.x) / Math.max(1, mirror.size.y)));
      if (!mirror.rt || mirror.rt.width !== w || mirror.rt.height !== h) {
        if (mirror.rt) mirror.rt.dispose();
        mirror.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
      }
      const vc = mirror.cam;
      const N = mirror.n;
      const O = mirror.o.set(cp.x, y, cp.z);
      // (la méthode de Reflector.js de three.js : position et visée réfléchies, le haut aussi)
      const view = mirror.v.subVectors(O, cp).reflect(N).negate().add(O);
      mirror.rot.extractRotation(camera.matrixWorld);
      const look = mirror.l.set(0, 0, -1).applyMatrix4(mirror.rot).add(cp);
      const tgt = mirror.t.subVectors(O, look).reflect(N).negate().add(O);
      vc.position.copy(view);
      vc.up.set(0, 1, 0).applyMatrix4(mirror.rot).reflect(N);
      vc.lookAt(tgt);
      vc.near = camera.near;
      vc.far = camera.far;
      vc.updateMatrixWorld();
      vc.projectionMatrix.copy(camera.projectionMatrix);
      uniforms.uReflM.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
      // plan proche oblique (Lengyel) : le plan de l'eau
      mirror.plane.setFromNormalAndCoplanarPoint(N, O).applyMatrix4(vc.matrixWorldInverse);
      const cl = mirror.clip.set(mirror.plane.normal.x, mirror.plane.normal.y, mirror.plane.normal.z, mirror.plane.constant);
      const e = vc.projectionMatrix.elements;
      const q = mirror.q.set((Math.sign(cl.x) + e[8]) / e[0], (Math.sign(cl.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
      cl.multiplyScalar(2 / cl.dot(q));
      e[2] = cl.x;
      e[6] = cl.y;
      e[10] = cl.z + 1 - 0.003;
      e[14] = cl.w;
      const was = [surface, shadow, ...hide].map((o) => [o, o.visible]);
      for (const [o] of was) o.visible = false;
      const old = renderer.getRenderTarget();
      renderer.setRenderTarget(mirror.rt);
      renderer.clear();
      renderer.render(scene, vc);
      renderer.setRenderTarget(old);
      for (const [o, v] of was) o.visible = v;
      uniforms.uRefl.value = mirror.rt.texture;
      uniforms.uReflOn.value = 1;
    },
    // la lampe torche, pour son éclat sur l'eau (position, direction, force)
    setLamp(pos, dir, k) {
      uniforms.uLampP.value.copy(pos);
      uniforms.uLampD.value.copy(dir);
      uniforms.uLamp.value = k;
    },
    update(sim, P, time, dt, camera) {
      uniforms.uTime.value = time;
      // les grilles des toboggans : fermées sur ceux qu'on n'a pas pris (et l'eau y est coupée) ; l'eau file vers le noir
      const lampOn = !!(P && P.flashlight && P.status === 'alive');
      for (const { sl, grate, tunnel } of slideMeshes) {
        grate.visible = !sim.open || (sim.slide >= 0 && sim.slide !== sl.id);
        tunnel.uniforms.uTime.value = time;
        tunnel.uniforms.uLamp.value = lampOn ? 1 : 0;
      }
      // un rond dans l'eau à chaque pas de chaque joueur qui marche dans l'eau
      for (const Q of sim.players) {
        if (Q.status !== 'alive' || !Q.moving || map.depthAt(Q.x, Q.z) <= 0) continue;
        const last = steps.get(Q.id) || 0;
        if (time - last < (Q.running ? 0.3 : 0.45)) continue;
        steps.set(Q.id, time);
        splash[si].set(Q.x, Q.z, time, Q.running ? 1.4 : 1);
        si = (si + 1) % SPLASHES;
      }
      // le niveau de l'eau bouge de quelques centimètres, seulement quand le joueur regarde ailleurs
      nextShift -= dt;
      camera.getWorldDirection(fwd);
      if (nextShift <= 0 && waterSpots.length) {
        let near = null;
        for (const w of waterSpots) {
          const d = Math.hypot(w.x - P.x, w.z - P.z);
          if (!near || d < near.d) near = { w, d };
        }
        const away = fwd.y > 0.25 || (fwd.x * (near.w.x - P.x) + fwd.z * (near.w.z - P.z)) / Math.max(0.1, near.d) < 0;
        if (away) {
          // (elle descend de 3 à 7 cm, ou monte d'à peine 2 cm : jamais par-dessus le seuil d'une salle au sec)
          levelWant = Math.random() < 0.3 ? BASE : Math.random() < 0.6 ? BASE - (0.03 + Math.random() * 0.04) : BASE + 0.01 + Math.random() * 0.01;
          nextShift = 25 + Math.random() * 35;
        }
      }
      level += Math.sign(levelWant - level) * Math.min(Math.abs(levelWant - level), dt * 0.03);
      surface.position.y = level;
      // l'ombre : de temps en temps, elle traverse le fond d'un bassin profond pas trop loin, puis disparaît
      nextGhost -= dt;
      if (!ghost && nextGhost <= 0 && ghostSpots.length) {
        const near = ghostSpots.filter((c) => {
          const d = Math.hypot(c.x - P.x, c.z - P.z);
          return d > 5 && d < 20;
        });
        if (near.length) {
          const c = near[Math.floor(Math.random() * near.length)];
          ghost = { x: c.x, z: c.z, y: -c.d + 0.06, a: Math.random() * Math.PI * 2, t: 0, len: 4 + Math.random() * 2 };
        }
        nextGhost = 30 + Math.random() * 40;
      }
      if (ghost) {
        ghost.t += dt;
        const f = ghost.t / ghost.len;
        const travel = (0.5 - f) * 3.2; // la tête (côté -x de l'image) devant
        shadow.position.set(ghost.x + Math.cos(ghost.a) * travel, ghost.y, ghost.z + Math.sin(ghost.a) * travel);
        shadow.rotation.y = -ghost.a;
        shadowMat.opacity = Math.sin(Math.min(1, f) * Math.PI) * 0.6;
        if (f >= 1) {
          ghost = null;
          shadowMat.opacity = 0;
        }
      }
    },
  };
}
