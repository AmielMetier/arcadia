// Le monde solide : tout ce qui arrête un joueur ou le porte (sol, pans des bâtiments, dalles, escaliers, toits,
// ponts, quais, troncs, rochers, voitures…). Construit à partir de l'île ; moteur PUR, partagé plus tard par l'hôte
// (simulation) et par les invités (prédiction de leur propre déplacement).
// Trois formes : boîte alignée sur les axes, cylindre vertical, boîte tournée autour de la verticale ; plus des
// rampes (escaliers, pans de toit) qui ne font que porter. Une grille de 8 m range tout ça pour les recherches.
import { CELL, STOREY } from './buildings.js';
import { FURN, furnRect } from './furniture.js';

export const WALL_T = 0.3;     // épaisseur d'un mur extérieur (m)
export const INNER_T = 0.18;   // épaisseur d'une cloison
export const SLAB_T = 0.25;    // épaisseur d'une dalle
export const BASE_UP = 0.15;   // le rez-de-chaussée est un peu au-dessus du terrain
export const ROOF_SLOPE = 0.58; // pente des toits (≈ 30°)
const G = 8;                   // pas de la grille de recherche (m)

export const levelH = (b) => (b.tall ? STOREY * 2 : STOREY);
export const floorY = (b, k) => b.y + BASE_UP + k * levelH(b);

// parties pleines d'un pan : [u0, u1, v0, v1] (u le long du pan, 0 → 4 m ; v en hauteur, 0 → 3,2 m pour un étage
// normal ; les hangars, deux fois plus hauts, étirent tout en hauteur : la 3D fait pareil avec la même géométrie)
const SOLIDS = {
  mur: [[0, 4, 0, 3.2]],
  fenetre: [[0, 4, 0, 1.0], [0, 4, 2.3, 3.2], [0, 0.9, 1.0, 2.3], [3.1, 4, 1.0, 2.3]],
  porte: [[0, 1.3, 0, 3.2], [2.7, 4, 0, 3.2], [1.3, 2.7, 2.35, 3.2]],
  portail: [[0, 0.2, 0, 3.2], [3.8, 4, 0, 3.2], [0.2, 3.8, 2.9, 3.2]],
  casse: [[0, 0.9, 0, 3.2], [3.1, 4, 0, 2.0], [0.9, 4, 2.6, 3.2], [0.9, 3.1, 0, 0.35]],
};
export function panelSolids(kind, h = STOREY) {
  const k = h / STOREY;
  return (SOLIDS[kind] || SOLIDS.mur).map(([u0, u1, v0, v1]) => [u0, u1, v0 * k, v1 * k]);
}

// formes de collision du décor : demi-longueur, demi-largeur (ou rayon), hauteur
const PROP_SHAPES = {
  arbre: { cyl: 0.45, h: 7 }, sapin: { cyl: 0.4, h: 9 }, rocher: { cyl: 1.25, h: 1.15 },
  voiture: { obb: [2.2, 1.0], h: 1.5 }, camion: { obb: [3.75, 1.3], h: 3 }, tracteur: { obb: [1.8, 1.1], h: 2.4 }, engin: { obb: [2.75, 1.5], h: 3.2 },
  conteneur: { obb: [3.0, 1.25], h: 2.6 }, citerne: { cyl: 2.4, h: 4.2 }, silo: { cyl: 3, h: 11 }, botte: { cyl: 1, h: 1.2 },
  caisse: { obb: [0.6, 0.6], h: 1.2 }, grume: { obb: [3, 1.3], h: 1.5 }, tente: { obb: [1.3, 1.2], h: 1.5 }, table: { obb: [1, 0.5], h: 0.8 },
  fontaine: { cyl: 3.2, h: 0.75 }, pompe: { obb: [0.5, 0.4], h: 1.7 }, cheminee: { cyl: 1.7, h: 20 }, bateau: { obb: [2.6, 1.0], h: 0.7 },
};
const propScale = (p) => (p.kind === 'rocher' ? p.s : 1);

// clé d'un objet destructible (toutes ses formes partagent la même) : pan de mur, meuble, décor, porte, construction
export function keyOf(ref) {
  if (!ref) return null;
  if (ref.e) return `w:${ref.b}:${ref.k}:${ref.e.o}${ref.e.x},${ref.e.z}`;
  if (ref.furn != null) return `f:${ref.furn}`;
  if (ref.prop != null) return `p:${ref.prop}`;
  if (ref.door != null) return `d:${ref.door}`;
  if (ref.build != null) return `b:${ref.build}`;
  return null;
}

export function buildWorld(map) {
  const S = map.size, GN = Math.ceil(S / G);
  const solids = [];   // { t: 0 boîte | 1 cylindre | 2 boîte tournée, …, y0, y1, ref }
  const ramps = [];    // { x0, z0, x1, z1, dx, dz, y0, y1 }
  const grid = Array.from({ length: GN * GN }, () => []);
  const rgrid = Array.from({ length: GN * GN }, () => []);
  const cellRange = (x0, z0, x1, z1, fn) => {
    const i0 = Math.max(0, Math.floor(x0 / G)), i1 = Math.min(GN - 1, Math.floor(x1 / G));
    const j0 = Math.max(0, Math.floor(z0 / G)), j1 = Math.min(GN - 1, Math.floor(z1 / G));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * GN + i);
  };
  const bounds = (s) => {
    if (s.t === 0) return [s.x0, s.z0, s.x1, s.z1];
    if (s.t === 1) return [s.cx - s.r, s.cz - s.r, s.cx + s.r, s.cz + s.r];
    const e = Math.abs(s.ux) * s.hx + Math.abs(s.uz) * s.hz, f = Math.abs(s.uz) * s.hx + Math.abs(s.ux) * s.hz;
    return [s.cx - e, s.cz - f, s.cx + e, s.cz + f];
  };
  const byKey = new Map();
  // qui veut savoir qu'une forme apparaît ou disparaît (les chemins des bots)
  const watchers = [];
  function add(s) {
    s.id = solids.length; solids.push(s);
    const [a, b, c, d] = bounds(s);
    cellRange(a, b, c, d, (k) => grid[k].push(s));
    s.key = keyOf(s.ref);
    if (s.key) { if (!byKey.has(s.key)) byKey.set(s.key, []); byKey.get(s.key).push(s); }
    for (const w of watchers) w(s, true);
    return s;
  }
  function remove(s) {
    if (s.dead) return;
    s.dead = true;
    const [a, b, c, d] = bounds(s);
    cellRange(a, b, c, d, (k) => { const l = grid[k], i = l.indexOf(s); if (i >= 0) l.splice(i, 1); });
    if (s.key && byKey.has(s.key)) { const l = byKey.get(s.key), i = l.indexOf(s); if (i >= 0) l.splice(i, 1); }
    for (const w of watchers) w(s, false);
  }
  const box = (x0, y0, z0, x1, y1, z1, ref) => add({ t: 0, x0, y0, z0, x1, y1, z1, ref });
  // portes : un battant fermé est une plaque dans l'ouverture ; ouvert, il ne gêne plus
  const doors = new Map(), dgrid = Array.from({ length: GN * GN }, () => []);
  const doorSolid = (d) => {
    const b = map.buildings[d.b], F = floorY(b, d.k), sy = levelH(b) / STOREY;
    const [u0, u1, top] = d.kind === 'portail' ? [0.2, 3.8, 2.9 * sy] : [1.3, 2.7, 2.35 * sy];
    return d.o === 'h' ? box(d.x * CELL + u0, F, d.z * CELL - 0.07, d.x * CELL + u1, F + top, d.z * CELL + 0.07, { door: d.id })
      : box(d.x * CELL - 0.07, F, d.z * CELL + u0, d.x * CELL + 0.07, F + top, d.z * CELL + u1, { door: d.id });
  };
  function setDoor(id, open) {
    const d = doors.get(id);
    if (!d || d.dead || d.open === open) return d;
    d.open = open;
    if (open && d.solid) { remove(d.solid); d.solid = null; } else if (!open) d.solid = doorSolid(d);
    return d;
  }
  const ramp = (r) => {
    ramps.push(r); cellRange(r.x0, r.z0, r.x1, r.z1, (k) => rgrid[k].push(r));
    r.key = keyOf(r.ref);
    if (r.key) { if (!byKey.has(r.key)) byKey.set(r.key, []); byKey.get(r.key).push(r); }
    return r;
  };
  function removeRamp(r) {
    if (r.dead) return;
    r.dead = true;
    cellRange(r.x0, r.z0, r.x1, r.z1, (k) => { const l = rgrid[k], i = l.indexOf(r); if (i >= 0) l.splice(i, 1); });
    const i = ramps.indexOf(r); if (i >= 0) ramps.splice(i, 1);
    if (r.key && byKey.has(r.key)) { const l = byKey.get(r.key), j = l.indexOf(r); if (j >= 0) l.splice(j, 1); }
  }
  // retire tout un objet destructible (toutes ses formes) ; renvoie son centre et sa matière s'il existait
  function removeKey(key) {
    const list = byKey.get(key);
    if (!list || !list.length) return null;
    let x = 0, y = 0, z = 0;
    for (const s of [...list]) {
      const c = s.t === 0 ? [(s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.z0 + s.z1) / 2] : s.t != null ? [s.cx, (s.y0 + s.y1) / 2, s.cz] : [(s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.z0 + s.z1) / 2];
      x += c[0]; y += c[1]; z += c[2];
      if (s.t != null) remove(s); else removeRamp(s);
    }
    byKey.delete(key);
    if (key.startsWith('d:')) { const d = doors.get(+key.slice(2)); if (d) { d.dead = true; d.solid = null; } }
    return { x: x / list.length, y: y / list.length, z: z / list.length };
  }

  // ------------------------------------------------------------------ bâtiments
  for (const b of map.buildings) {
    const H = levelH(b), X0 = b.x0 * CELL, Z0 = b.z0 * CELL, X1 = (b.x0 + b.w) * CELL, Z1 = (b.z0 + b.d) * CELL;
    box(X0, b.y - 3, Z0, X1, b.y + BASE_UP, Z1, { b: b.id, part: 'socle' });
    const nodes = new Set();
    for (let k = 0; k < b.floors; k++) {
      const lv = b.levels[k], F = floorY(b, k);
      for (const e of lv.walls) {
        const T = e.ext ? WALL_T : INNER_T, ref = { b: b.id, k, e };
        for (const [u0, u1, v0, v1] of panelSolids(e.k, H)) {
          if (e.o === 'h') box(e.x * CELL + u0, F + v0, e.z * CELL - T / 2, e.x * CELL + u1, F + v1, e.z * CELL + T / 2, ref);
          else box(e.x * CELL - T / 2, F + v0, e.z * CELL + u0, e.x * CELL + T / 2, F + v1, e.z * CELL + u1, ref);
        }
        if (e.ext) { nodes.add(e.x + ',' + e.z); nodes.add(e.o === 'h' ? (e.x + 1) + ',' + e.z : e.x + ',' + (e.z + 1)); }
      }
      // dalle de l'étage (sauf la trémie de l'escalier), par rangées de cases
      if (k > 0) slabRows(b, lv.hole, (x0, x1, z) => box(x0 * CELL, F - SLAB_T, z * CELL, x1 * CELL, F, (z + 1) * CELL, { b: b.id, k, part: 'dalle' }));
      if (lv.stairs) {
        const st = lv.stairs;
        ramp({ x0: st.x * CELL, z0: st.z * CELL, x1: (st.x + 1) * CELL, z1: (st.z + 1) * CELL, dx: st.dx, dz: st.dz, y0: F, y1: F + H, ref: { b: b.id, k, part: 'escalier' } });
      }
    }
    // meubles (les tapis, plantes et lampes ne gênent pas), portes
    for (const f of b.furniture || []) {
      if (!FURN[f.kind].solid) continue;
      const r = furnRect(f), y = floorY(b, f.k);
      box(r.x0, y, r.z0, r.x1, y + f.h, r.z1, { furn: f.id, b: b.id, k: f.k });
    }
    for (const d of b.doors || []) {
      doors.set(d.id, d);
      d.cx = d.o === 'h' ? (d.x + 0.5) * CELL : d.x * CELL; d.cz = d.o === 'h' ? d.z * CELL : (d.z + 0.5) * CELL; d.y = floorY(b, d.k);
      dgrid[Math.min(GN - 1, Math.floor(d.cz / G)) * GN + Math.min(GN - 1, Math.floor(d.cx / G))].push(d);
      d.solid = d.open ? null : doorSolid(d);
    }
    // poteaux d'angle (les murs se rejoignent sans fente)
    const top = floorY(b, b.floors);
    for (const n of nodes) {
      const [x, z] = n.split(',').map(Number);
      box(x * CELL - WALL_T / 2, b.y, z * CELL - WALL_T / 2, x * CELL + WALL_T / 2, top, z * CELL + WALL_T / 2, { b: b.id, part: 'poteau' });
    }
    // toit
    slabRows(b, b.roof !== 'pente' ? b.roofHatch : null, (x0, x1, z) => box(x0 * CELL, top - SLAB_T, z * CELL, x1 * CELL, top, (z + 1) * CELL, { b: b.id, part: 'toit' }));
    if (b.roof === 'pente') {
      // deux pans qui montent vers le faîtage, le long du grand côté
      const alongX = b.w >= b.d, half = (alongX ? Z1 - Z0 : X1 - X0) / 2, rise = half * ROOF_SLOPE;
      if (alongX) {
        ramp({ x0: X0, z0: Z0, x1: X1, z1: Z0 + half, dx: 0, dz: 1, y0: top, y1: top + rise, ref: { b: b.id, part: 'toit' } });
        ramp({ x0: X0, z0: Z0 + half, x1: X1, z1: Z1, dx: 0, dz: -1, y0: top, y1: top + rise, ref: { b: b.id, part: 'toit' } });
      } else {
        ramp({ x0: X0, z0: Z0, x1: X0 + half, z1: Z1, dx: 1, dz: 0, y0: top, y1: top + rise, ref: { b: b.id, part: 'toit' } });
        ramp({ x0: X0 + half, z0: Z0, x1: X1, z1: Z1, dx: -1, dz: 0, y0: top, y1: top + rise, ref: { b: b.id, part: 'toit' } });
      }
    } else {
      // garde-corps du toit plat
      for (let x = b.x0; x < b.x0 + b.w; x++) for (const z of [b.z0, b.z0 + b.d]) box(x * CELL, top, z * CELL - WALL_T / 2, (x + 1) * CELL, top + 1, z * CELL + WALL_T / 2, { b: b.id, part: 'parapet' });
      for (let z = b.z0; z < b.z0 + b.d; z++) for (const x of [b.x0, b.x0 + b.w]) box(x * CELL - WALL_T / 2, top, z * CELL, x * CELL + WALL_T / 2, top + 1, (z + 1) * CELL, { b: b.id, part: 'parapet' });
    }
  }

  // ------------------------------------------------------------------ ponts, quais
  for (const br of map.bridges) {
    const dx = br.x1 - br.x0, dz = br.z1 - br.z0, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    const cx = (br.x0 + br.x1) / 2, cz = (br.z0 + br.z1) / 2;
    add({ t: 2, cx, cz, ux, uz, hx: L / 2 + 2, hz: br.hw, y0: br.y - 0.6, y1: br.y + 0.05, ref: { part: 'pont' } });
    for (const sd of [-1, 1]) add({ t: 2, cx: cx - uz * sd * (br.hw + 0.1), cz: cz + ux * sd * (br.hw + 0.1), ux, uz, hx: L / 2, hz: 0.12, y0: br.y, y1: br.y + 1.0, ref: { part: 'rambarde' } });
  }
  for (const d of map.docks) box(d.x0, -2, d.z0, d.x1, 1.2, d.z1, { part: 'quai' });

  // ------------------------------------------------------------------ décor
  for (let i = 0; i < map.props.length; i++) {
    const p = map.props[i], sh = PROP_SHAPES[p.kind];
    if (p.kind === 'auvent') {
      const W = p.dx ? 9 : 4.5, D = p.dx ? 4.5 : 9, y = map.heightAt(p.x, p.z);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add({ t: 1, cx: p.x + sx * (W - 0.6), cz: p.z + sz * (D - 0.6), r: 0.2, y0: y, y1: y + 4.6, ref: { prop: i } });
      box(p.x - W, y + 4.6, p.z - D, p.x + W, y + 5.0, p.z + D, { prop: i });
      continue;
    }
    if (!sh) continue;
    const k = propScale(p), y = p.kind === 'bateau' ? Math.max(0, map.heightAt(p.x, p.z)) : map.heightAt(p.x, p.z) - 0.1;
    if (sh.cyl) add({ t: 1, cx: p.x, cz: p.z, r: sh.cyl * k, y0: y - 0.5, y1: y + sh.h * k, ref: { prop: i } });
    else {
      const l = Math.hypot(p.dx, p.dz) || 1;
      add({ t: 2, cx: p.x, cz: p.z, ux: p.dx / l, uz: p.dz / l, hx: sh.obb[0], hz: sh.obb[1], y0: y - 0.5, y1: y + sh.h, ref: { prop: i } });
    }
  }

  // ------------------------------------------------------------------ requêtes
  const near = (x, z, r, fn) => {
    const i0 = Math.max(0, Math.floor((x - r) / G)), i1 = Math.min(GN - 1, Math.floor((x + r) / G));
    const j0 = Math.max(0, Math.floor((z - r) / G)), j1 = Math.min(GN - 1, Math.floor((z + r) / G));
    let stamp = ++near.stamp;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const s of grid[j * GN + i]) { if (s.seen === stamp) continue; s.seen = stamp; fn(s); }
  };
  near.stamp = 0;
  // le point (x, z) est-il au-dessus de la forme ? (marge m)
  const over = (s, x, z, m = 0) => {
    if (s.t === 0) return x >= s.x0 - m && x <= s.x1 + m && z >= s.z0 - m && z <= s.z1 + m;
    if (s.t === 1) return (x - s.cx) * (x - s.cx) + (z - s.cz) * (z - s.cz) <= (s.r + m) * (s.r + m);
    const dx = x - s.cx, dz = z - s.cz, u = dx * s.ux + dz * s.uz, v = -dx * s.uz + dz * s.ux;
    return Math.abs(u) <= s.hx + m && Math.abs(v) <= s.hz + m;
  };
  const rampY = (r, x, z) => {
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) return null;
    let t;
    if (r.dx > 0) t = (x - r.x0) / (r.x1 - r.x0); else if (r.dx < 0) t = (r.x1 - x) / (r.x1 - r.x0);
    else if (r.dz > 0) t = (z - r.z0) / (r.z1 - r.z0); else t = (r.z1 - z) / (r.z1 - r.z0);
    return r.y0 + (r.y1 - r.y0) * t;
  };

  // surface la plus haute sous maxY en (x, z) : sol, dessus des formes, rampes. m : rayon des pieds
  function support(x, z, maxY, m = 0.15) {
    let best = map.heightAt(x, z);
    near(x, z, m + 4, (s) => { if (s.y1 <= maxY && s.y1 > best && over(s, x, z, m)) best = s.y1; });
    const k = Math.min(GN - 1, Math.max(0, Math.floor(z / G))) * GN + Math.min(GN - 1, Math.max(0, Math.floor(x / G)));
    for (const r of rgrid[k]) { const y = rampY(r, x, z); if (y != null && y <= maxY && y > best) best = y; }
    return best;
  }
  // plafond le plus bas au-dessus de minY en (x, z)
  function ceiling(x, z, minY, m = 0.2) {
    let best = Infinity;
    near(x, z, m + 4, (s) => { if (s.y0 >= minY && s.y0 < best && over(s, x, z, m)) best = s.y0; });
    return best;
  }
  // repousse un cercle (x, z, r) hors des formes qui occupent la tranche de hauteur [y0, y1]
  function push(x, z, r, y0, y1) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      near(x, z, r + 4, (s) => {
        if (s.y1 <= y0 || s.y0 >= y1) return;
        let px, pz;
        if (s.t === 1) {
          const dx = x - s.cx, dz = z - s.cz, d = Math.hypot(dx, dz), R = s.r + r;
          if (d >= R) return;
          const k = d > 1e-6 ? (R - d) / d : 0;
          x += d > 1e-6 ? dx * k : R; z += dz * k; moved = true; return;
        }
        if (s.t === 0) {
          px = Math.max(s.x0, Math.min(x, s.x1)); pz = Math.max(s.z0, Math.min(z, s.z1));
          let dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
          if (d >= r) return;
          if (d < 1e-6) {
            // centre dans la boîte : sortie par le côté le plus proche
            const o = [[x - s.x0, -1, 0], [s.x1 - x, 1, 0], [z - s.z0, 0, -1], [s.z1 - z, 0, 1]].sort((a, b) => a[0] - b[0])[0];
            x += o[1] * (o[0] + r); z += o[2] * (o[0] + r);
          } else { x += dx / d * (r - d); z += dz / d * (r - d); }
          moved = true; return;
        }
        // boîte tournée : même calcul dans son repère
        const lx = x - s.cx, lz = z - s.cz, u = lx * s.ux + lz * s.uz, v = -lx * s.uz + lz * s.ux;
        const cu = Math.max(-s.hx, Math.min(u, s.hx)), cv = Math.max(-s.hz, Math.min(v, s.hz));
        let du = u - cu, dv = v - cv, d = Math.hypot(du, dv), nu, nv;
        if (d >= r) return;
        if (d < 1e-6) {
          const o = [[u + s.hx, -1, 0], [s.hx - u, 1, 0], [v + s.hz, 0, -1], [s.hz - v, 0, 1]].sort((a, b) => a[0] - b[0])[0];
          nu = u + o[1] * (o[0] + r); nv = v + o[2] * (o[0] + r);
        } else { nu = u + du / d * (r - d); nv = v + dv / d * (r - d); }
        x = s.cx + nu * s.ux - nv * s.uz; z = s.cz + nu * s.uz + nv * s.ux; moved = true;
      });
      if (!moved) break;
    }
    return [Math.max(4, Math.min(S - 4, x)), Math.max(4, Math.min(S - 4, z))];
  }
  // le point est-il dans une forme pleine ? (caméra, tirs)
  function solidAt(x, y, z, m = 0) {
    if (y < map.heightAt(x, z)) return true;
    let hit = false;
    near(x, z, m + 4, (s) => { if (!hit && y >= s.y0 - m && y <= s.y1 + m && over(s, x, z, m)) hit = true; });
    if (hit) return true;
    const k = Math.min(GN - 1, Math.max(0, Math.floor(z / G))) * GN + Math.min(GN - 1, Math.max(0, Math.floor(x / G)));
    for (const r of rgrid[k]) { const ry = rampY(r, x, z); if (ry != null && y <= ry + m && y >= ry - 0.3 - m) return true; }
    return false;
  }
  // distance libre le long d'un rayon (pas de 0,2 m), plafonnée à len
  function ray(ox, oy, oz, dx, dy, dz, len, m = 0.15) {
    for (let t = 0.2; t <= len; t += 0.2) if (solidAt(ox + dx * t, oy + dy * t, oz + dz * t, m)) return Math.max(0, t - 0.2);
    return len;
  }
  // ------------------------------------------------------------------ tirs : premier obstacle exact sur un rayon
  // (dx, dy, dz) unitaire ; renvoie { t, s } (s : forme touchée, null pour le sol, undefined si rien avant maxT)
  const hitShape = (s, ox, oy, oz, dx, dy, dz) => {
    if (s.t === 0 || s.t === 2) {
      // boîte (tournée ou non) : méthode des plans, dans le repère de la boîte
      let lx = ox, lz = oz, ldx = dx, ldz = dz, x0, x1, z0, z1;
      if (s.t === 0) { x0 = s.x0; x1 = s.x1; z0 = s.z0; z1 = s.z1; }
      else {
        const rx = ox - s.cx, rz = oz - s.cz;
        lx = rx * s.ux + rz * s.uz; lz = -rx * s.uz + rz * s.ux; ldx = dx * s.ux + dz * s.uz; ldz = -dx * s.uz + dz * s.ux;
        x0 = -s.hx; x1 = s.hx; z0 = -s.hz; z1 = s.hz;
      }
      let tmin = 0, tmax = Infinity;
      for (const [o, d, a, b] of [[lx, ldx, x0, x1], [oy, dy, s.y0, s.y1], [lz, ldz, z0, z1]]) {
        if (Math.abs(d) < 1e-9) { if (o < a || o > b) return Infinity; continue; }
        let ta = (a - o) / d, tb = (b - o) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        if (ta > tmin) tmin = ta; if (tb < tmax) tmax = tb;
        if (tmin > tmax) return Infinity;
      }
      return tmin;
    }
    // cylindre vertical : paroi puis couvercle
    const fx = ox - s.cx, fz = oz - s.cz, a = dx * dx + dz * dz;
    let best = Infinity;
    if (a > 1e-9) {
      const b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - s.r * s.r, disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const t = (-b - Math.sqrt(disc)) / (2 * a), y = oy + dy * t;
        if (t >= 0 && y >= s.y0 && y <= s.y1) best = t;
        else if (c < 0 && oy >= s.y0 && oy <= s.y1) best = 0;
      }
    }
    if (Math.abs(dy) > 1e-9) for (const yc of [s.y1, s.y0]) {
      const t = (yc - oy) / dy;
      if (t >= 0 && t < best && (fx + dx * t) ** 2 + (fz + dz * t) ** 2 <= s.r * s.r) best = t;
    }
    return best;
  };
  const hitRamp = (r, ox, oy, oz, dx, dy, dz) => {
    // plan incliné y = y0 + k·(avancée) borné au rectangle
    const L = r.dx ? r.x1 - r.x0 : r.z1 - r.z0, k = (r.y1 - r.y0) / L;
    const base = r.dx > 0 ? r.x0 : r.dx < 0 ? r.x1 : r.dz > 0 ? r.z0 : r.z1, sg = r.dx || r.dz;
    const o = r.dx ? ox : oz, d = r.dx ? dx : dz;
    // oy + dy·t = y0 + k·sg·(o + d·t − base)
    const den = dy - k * sg * d;
    if (Math.abs(den) < 1e-9) return Infinity;
    const t = (r.y0 + k * sg * (o - base) - oy) / den;
    if (t < 0) return Infinity;
    const x = ox + dx * t, z = oz + dz * t;
    return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 ? t : Infinity;
  };
  function raycast(ox, oy, oz, dx, dy, dz, maxT = 500) {
    let best = maxT, hit;
    const stamp = ++near.stamp;
    // parcours des colonnes de la grille traversées (Amanatides et Woo, dans le plan xz)
    let i = Math.floor(ox / G), j = Math.floor(oz / G);
    const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? G / Math.abs(dx) : Infinity, tdz = Math.abs(dz) > 1e-9 ? G / Math.abs(dz) : Infinity;
    let tx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (i + 1) * G : i * G) - ox) / dx : Infinity;
    let tz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (j + 1) * G : j * G) - oz) / dz : Infinity;
    let tc = 0;
    for (let n = 0; n < 400 && tc <= best; n++) {
      if (i >= 0 && j >= 0 && i < GN && j < GN) {
        const k = j * GN + i;
        for (const s of grid[k]) {
          if (s.seen === stamp) continue;
          s.seen = stamp;
          const t = hitShape(s, ox, oy, oz, dx, dy, dz);
          if (t < best) { best = t; hit = s; }
        }
        for (const r of rgrid[k]) { const t = hitRamp(r, ox, oy, oz, dx, dy, dz); if (t < best) { best = t; hit = r; } }
      }
      if (tx < tz) { tc = tx; tx += tdx; i += si; } else { tc = tz; tz += tdz; j += sj; }
    }
    // le sol : pas de 1 m puis affinage par dichotomie
    const below = (t) => oy + dy * t < map.heightAt(ox + dx * t, oz + dz * t);
    if (below(0)) return { t: 0, s: null };
    for (let t = 1; t <= best + 1; t += 1) {
      const tt = Math.min(t, best);
      if (below(tt)) {
        let a = Math.max(0, tt - 1), b = tt;
        for (let q = 0; q < 8; q++) { const m = (a + b) / 2; if (below(m)) b = m; else a = m; }
        if (b < best) return { t: b, s: null };
        break;
      }
      if (tt === best) break;
    }
    return { t: best, s: hit };
  }

  // niveau de l'eau (mer, lac, rivière) en (x, z), ou -Infinity
  const N = map.n, HR = map.hres;
  function waterLevel(x, z) {
    const i = Math.round(x / HR), j = Math.round(z / HR);
    if (i < 0 || j < 0 || i >= N || j >= N) return 0;
    const k = j * N + i;
    return map.water[k] ? map.waterLevel[k] : -Infinity;
  }

  // la porte la plus proche devant un joueur (x, y = pieds, z, regard fx, fz), à moins de r mètres
  function doorNear(x, y, z, fx, fz, r = 2.4) {
    let best = null, bd = Infinity;
    const i0 = Math.max(0, Math.floor((x - r) / G)), i1 = Math.min(GN - 1, Math.floor((x + r) / G));
    const j0 = Math.max(0, Math.floor((z - r) / G)), j1 = Math.min(GN - 1, Math.floor((z + r) / G));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const d of dgrid[j * GN + i]) {
      if (d.dead || Math.abs(d.y - y) > 1.6) continue;
      const dx = d.cx - x, dz = d.cz - z, dist = Math.hypot(dx, dz);
      if (dist > r) continue;
      // on préfère celle qu'on regarde
      const facing = dist > 0.01 ? (dx * fx + dz * fz) / dist : 1;
      if (facing < -0.2) continue;
      const score = dist - facing * 0.8;
      if (score < bd) { bd = score; best = d; }
    }
    return best;
  }

  return { solids, ramps, add, remove, box, ramp, removeRamp, removeKey, byKey, support, ceiling, push, solidAt, ray, raycast, waterLevel, near, over, bounds, doors, setDoor, doorNear, grid, G, GN, watch: (fn) => watchers.push(fn) };
}

// dalle d'un étage par rangées de cases contiguës (on saute la case `hole`)
function slabRows(b, hole, fn) {
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
