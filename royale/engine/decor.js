// Les détails des toits qui comptent aussi pour les collisions : cheminées des toits en pente, climatiseurs,
// ventilations et réservoirs d'eau des toits plats. Tirés de la graine de l'île et du numéro du bâtiment, sans toucher
// au tirage de l'île ; le monde solide (engine/world.js) et la 3D (view/structures.js) lisent la même liste.
// Chaque détail : { kind, x0, z0, x1, z1, y0, y1 } (boîte), plus cx, cz, r pour les réservoirs (cylindre).
import { makeRng, hash } from './rng.js';
import { CELL } from './buildings.js';

const CHIMNEYS = new Set(['maison', 'chalet', 'auberge', 'manoir', 'abandonnee', 'mairie', 'cabane']);
const TANKS = new Set(['immeuble', 'tour', 'bureaux', 'hangar']);

// top : hauteur du toit (dessus de la dernière dalle) ; slope : pente des toits (ROOF_SLOPE)
export function roofDetails(b, seed, top, slope) {
  const rng = makeRng(hash((seed | 0) * 7919 + b.id * 104729 + 3));
  const out = [];
  const X0 = b.x0 * CELL, Z0 = b.z0 * CELL, X1 = (b.x0 + b.w) * CELL, Z1 = (b.z0 + b.d) * CELL;
  if (b.roof === 'pente') {
    if (!CHIMNEYS.has(b.type) || rng.next() < 0.2) return out;
    // une cheminée près du faîtage, d'un côté ou de l'autre
    const alongX = b.w >= b.d, half = (alongX ? Z1 - Z0 : X1 - X0) / 2, ry = top + half * slope;
    const t = 0.2 + rng.next() * 0.6, side = rng.next() < 0.5 ? -1 : 1, off = 1.1;
    const w = 0.75, d = 0.75;
    let cx, cz;
    if (alongX) { cx = X0 + (X1 - X0) * t; cz = (Z0 + Z1) / 2 + side * off; } else { cz = Z0 + (Z1 - Z0) * t; cx = (X0 + X1) / 2 + side * off; }
    out.push({ kind: 'cheminee', x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, y0: top, y1: ry + 0.9 });
    return out;
  }
  if (b.roof === 'phare') return out;
  // toits plats : quelques équipements, loin de la trappe de l'escalier et de son palier
  const busy = new Set();
  if (b.roofHatch) {
    const h = b.roofHatch, st = b.stairs || { dx: 0, dz: 0 };
    for (const [dx, dz] of [[0, 0], [st.dx, st.dz], [-st.dx, -st.dz]]) busy.add((h.x + dx) + ',' + (h.z + dz));
  }
  const cells = [];
  for (let z = b.z0; z < b.z0 + b.d; z++) for (let x = b.x0; x < b.x0 + b.w; x++) if (!busy.has(x + ',' + z)) cells.push([x, z]);
  rng.shuffle(cells);
  const n = Math.min(cells.length, Math.max(1, Math.round(cells.length / 5)));
  for (let i = 0; i < n; i++) {
    const [cx0, cz0] = cells[i];
    const px = cx0 * CELL + 0.9 + rng.next() * 2.2, pz = cz0 * CELL + 0.9 + rng.next() * 2.2;
    const r = rng.next();
    if (i === 0 && TANKS.has(b.type) && r < 0.6) out.push({ kind: 'reservoir', cx: px, cz: pz, r: 0.8, x0: px - 0.8, z0: pz - 0.8, x1: px + 0.8, z1: pz + 0.8, y0: top, y1: top + 2.1 });
    else if (r < 0.55) {
      const rot = rng.next() < 0.5;
      const w = rot ? 0.8 : 1.15, d = rot ? 1.15 : 0.8;
      out.push({ kind: 'clim', x0: px - w / 2, z0: pz - d / 2, x1: px + w / 2, z1: pz + d / 2, y0: top, y1: top + 0.85 });
    } else out.push({ kind: 'ventil', x0: px - 0.25, z0: pz - 0.25, x1: px + 0.25, z1: pz + 0.25, y0: top, y1: top + 0.75 });
  }
  return out;
}
