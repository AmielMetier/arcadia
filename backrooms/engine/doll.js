// The Backrooms - Level 17 : Miss Marigold, la grande poupée de parade du Halcyon Park Mall (3,75 m sur son socle à
// roulettes). Elle ne bouge jamais sous un regard : figée tant qu'un joueur l'a dans le cadre de sa caméra sans mur
// entre eux, elle roule vers le plus proche dès que plus personne ne la regarde, de plus en plus vite. Elle ne passe
// pas sous les plafonds bas : les boutiques, les coulisses, la galerie de l'annexe, la place de la cour est sont des
// refuges ; les mails, les cours, les grandes surfaces, le food court, le hall du cinéma, les salles sont son terrain.
// Elle ne monte aucune marche : pour changer d'étage, ou quand sa proie lui échappe trop longtemps, elle se replace
// ailleurs, hors de tous les regards (jamais elle n'apparaît dans un champ de vision).
// Elle occupe la place de l'entité (sim.monster) : même prise, même fin que les entités des autres niveaux.
import { CELL_SIZE as C, T, FLOOR_DY } from './map.js';
import { hasLineOfSight } from './nav.js';
import { polyDist } from './mall.js';

const DT = 1 / 60;
export const DOLL_NAME = 'Miss Marigold';
export const DOLL_H = 3.75; // sa hauteur, chapeau compris
export const DOLL_R = 0.78; // le rayon de son socle
export const DOLL_BODY = 0.45; // ce qui arrête un joueur (on frôle sa jupe)
export const DOLL_CLEAR = 3.8; // le plafond qu'il lui faut
export const DOLL_REACH = 1.5; // elle attrape à cette distance (de son axe)
export const DOLL_V0 = 1.3; // sa vitesse en repartant…
export const DOLL_ACC = 0.9; // … puis elle prend de l'élan
export const DOLL_VMAX = 5.4; // plus vite qu'un sprint : on ne la sème qu'en la regardant, ou sous un plafond bas
export const DOLL_BLINK = 0.3; // secondes sans regard avant qu'elle reparte
export const DOLL_DORMANT = 75; // à l'arrivée, elle reste à sa place (on la découvre immobile)
export const DOLL_WAKE_R = 12; // … sauf si quelqu'un s'approche d'elle
export const DOLL_RELOC_T = 14; // sa proie hors d'atteinte ce temps-là, et personne ne la regarde : elle se replace
export const DOLL_BORED_T = 40; // plantée devant un refuge ce temps-là : elle va attendre ailleurs
export const DOLL_FRAME = 1.25; // demi-angle du cadre le plus large qu'un joueur puisse régler

const cellOf = (v) => Math.floor(v / C);

// la hauteur sous plafond d'une case (comme la dessine view/mall.js)
function ceilAt(r, gx, gz) {
  if (!r) return 0;
  if (r.vault) return r.vault.base;
  if (r.tray && gx >= r.tray.x0 && gx <= r.tray.x1 && gz >= r.tray.z0 && gz <= r.tray.z1) return r.tray.h;
  return r.ceilH;
}

// Son terrain à un étage : les cases où elle tient debout et où son socle passe (rien à moins de son rayon), sans les
// portes ni les cases qui les touchent (elle ne bouche jamais un passage), ni le grand magasin fermé (on la verrait
// à travers la grille). comp : la composante de chaque case (on ne passe pas de l'une à l'autre en roulant)
export function dollTerrain(map) {
  if (map.dollTerr) return map.dollTerr;
  const { W, H } = map;
  const ok = new Uint8Array(W * H);
  const doors = new Set();
  for (const d of map.doors || []) if (d.kind !== 'passage') doors.add(d.z * W + d.x);
  const stairs = new Set((map.stairs || []).flatMap((st) => st.cells.map((c) => c.gz * W + c.gx)));
  for (let gz = 0; gz < H; gz++)
    for (let gx = 0; gx < W; gx++) {
      const k = gz * W + gx;
      if (map.grid[k] !== T.FLOOR || map.navBlock.has(k) || stairs.has(k) || doors.has(k)) continue;
      const r = map.roomAt((gx + 0.5) * C, (gz + 0.5) * C);
      if (!r || r.kind === 'closed' || ceilAt(r, gx, gz) < DOLL_CLEAR) continue;
      if (doors.has(k - 1) || doors.has(k + 1) || doors.has(k - W) || doors.has(k + W)) continue;
      if (map.collide((gx + 0.5) * C, (gz + 0.5) * C, DOLL_R + 0.07)) continue;
      ok[k] = 1;
    }
  const comp = new Int16Array(W * H).fill(-1);
  const sizes = [];
  for (let k0 = 0; k0 < W * H; k0++) {
    if (!ok[k0] || comp[k0] >= 0) continue;
    const id = sizes.length;
    const q = [k0];
    comp[k0] = id;
    for (let h = 0; h < q.length; h++) {
      const k = q[h];
      const x = k % W;
      for (const n of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
        if (n < 0 || n >= W * H || !ok[n] || comp[n] >= 0) continue;
        comp[n] = id;
        q.push(n);
      }
    }
    sizes.push(q.length);
  }
  // ce qui cache vraiment la poupée : les murs pleins et les piliers (pas les rayonnages ni les grilles : elle dépasse)
  const see = {
    isWall: (gx, gz) => gx < 0 || gz < 0 || gx >= W || gz >= H || map.grid[gz * W + gx] === T.WALL || map.grid[gz * W + gx] === T.EXIT || map.grid[gz * W + gx] === T.PILLAR,
    pillarAt: map.pillarAt,
  };
  return (map.dollTerr = { ok, comp, sizes, see, W, H, edges: new Map() });
}
// son socle passe-t-il en ligne droite de (x0, z0) à (x1, z1) ? (un point tous les 40 cm)
const clearLine = (map, x0, z0, x1, z1) => {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.4));
  for (let i = 1; i < n; i++) if (map.collide(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, DOLL_R + 0.02)) return false;
  return true;
};
// d'une case de son terrain à sa voisine : rien entre les deux (un banc, une poubelle posés à cheval sur deux cases)
const edgeOk = (map, t, k, n) => {
  const key = k < n ? k * 16384 + n : n * 16384 + k;
  let v = t.edges.get(key);
  if (v === undefined) {
    v = clearLine(map, ((k % t.W) + 0.5) * C, (Math.floor(k / t.W) + 0.5) * C, ((n % t.W) + 0.5) * C, (Math.floor(n / t.W) + 0.5) * C);
    t.edges.set(key, v);
  }
  return v;
};
export const dollCanStand = (map, x, z) => {
  const t = dollTerrain(map);
  const gx = cellOf(x);
  const gz = cellOf(z);
  return gx >= 0 && gz >= 0 && gx < t.W && gz < t.H && !!t.ok[gz * t.W + gx];
};

// Le joueur Q a-t-il le point (x, z) de l'étage floor dans le cadre de sa caméra, sans mur entre eux ? (son axe ou un
// bord de son socle ; à un autre étage : par les vides des cours et du mail, vus du garde-corps ou d'en dessous)
export function dollSeenBy(sim, Q, floor, x, z, margin = 0) {
  if (Q.status !== 'alive') return false;
  const d = Math.hypot(Q.x - x, Q.z - z);
  if (d > 75) return false;
  if (d > 0.6 && sim.facing(Q, x, z) > DOLL_FRAME + margin + Math.atan2(DOLL_R, d)) return false;
  const qf = Q.floor || 0;
  if (qf !== floor) {
    const voids = sim.floors[0].voids || [];
    const [ux, uz, lx, lz] = qf === 0 ? [Q.x, Q.z, x, z] : [x, z, Q.x, Q.z];
    // (en haut : à moins de 8 m du bord ; en bas : sous l'ouverture ou guère plus loin. La poupée en haut ne se voit
    // d'en bas que près du garde-corps)
    const nearUp = qf === 0 ? 8 : 5;
    const nearDn = qf === 0 ? 6 : 8;
    return voids.some((v) => polyDist(v.pts, ux, uz) < nearUp && polyDist(v.pts, lx, lz) < nearDn);
  }
  const see = dollTerrain(sim.fm(floor)).see;
  if (hasLineOfSight(see, Q.x, Q.z, x, z)) return true;
  const nx = (-(z - Q.z) / Math.max(0.01, d)) * DOLL_R;
  const nz = ((x - Q.x) / Math.max(0.01, d)) * DOLL_R;
  return hasLineOfSight(see, Q.x, Q.z, x + nx, z + nz) || hasLineOfSight(see, Q.x, Q.z, x - nx, z - nz);
}
export const dollWatched = (sim, floor, x, z, margin = 0) => sim.players.some((Q) => dollSeenBy(sim, Q, floor, x, z, margin));

// la case de son terrain la plus proche d'un point (à moins de r cases), ou -1
function nearestTerr(t, x, z, r = 12, comp = -1) {
  const gx = cellOf(x);
  const gz = cellOf(z);
  let best = -1;
  let bd = Infinity;
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) {
      const cx = gx + dx;
      const cz = gz + dz;
      if (cx < 0 || cz < 0 || cx >= t.W || cz >= t.H) continue;
      const k = cz * t.W + cx;
      if (!t.ok[k] || (comp >= 0 && t.comp[k] !== comp)) continue;
      const d = Math.hypot((cx + 0.5) * C - x, (cz + 0.5) * C - z);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
  return best;
}

// Le chemin de la poupée vers sa proie, sur son terrain : un parcours en largeur depuis sa case (huit voisines, sans
// couper un coin) ; elle vise la case atteinte la plus proche de sa proie. Renvoie { path, gap } : les points à
// suivre, et ce qu'il restera entre elle et sa proie une fois au bout (Infinity : rien à faire en roulant)
function plan(sim, M, P) {
  const map = sim.fm(M.floor || 0);
  const t = dollTerrain(map);
  const { W, H } = t;
  let k0 = cellOf(M.z) * W + cellOf(M.x);
  if (!t.ok[k0]) k0 = nearestTerr(t, M.x, M.z, 4);
  if (k0 < 0 || (P.floor || 0) !== (M.floor || 0)) return { path: [], gap: Infinity };
  const from = new Int32Array(W * H).fill(-1);
  const q = [k0];
  from[k0] = k0;
  let goal = k0;
  let gd = Infinity;
  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    const x = k % W;
    const z = (k - x) / W;
    const d = Math.hypot((x + 0.5) * C - P.x, (z + 0.5) * C - P.z);
    if (d < gd) {
      gd = d;
      goal = k;
    }
    if (d < C * 0.75) break; // (sa case, ou sa voisine : on n'ira pas plus près)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const n = nz * W + nx;
      if (!t.ok[n] || from[n] >= 0) continue;
      if (dx && dz && (!t.ok[z * W + nx] || !t.ok[nz * W + x])) continue;
      if (!edgeOk(map, t, k, n)) continue;
      from[n] = k;
      q.push(n);
    }
  }
  const path = [];
  for (let k = goal; k !== k0; k = from[k]) path.push({ x: ((k % W) + 0.5) * C, z: (Math.floor(k / W) + 0.5) * C });
  path.reverse();
  // (elle n'est pas forcément au milieu de sa case : elle y repasse si la ligne droite vers la suivante est gênée)
  const c0 = { x: ((k0 % W) + 0.5) * C, z: (Math.floor(k0 / W) + 0.5) * C };
  if (Math.hypot(c0.x - M.x, c0.z - M.z) > 0.05 && (!path.length || !clearLine(map, M.x, M.z, path[0].x, path[0].z))) path.unshift(c0);
  // tout près, sur son terrain : droit sur sa proie (sinon elle s'arrêterait au milieu de la case d'à côté)
  if (gd < C * 1.6 && dollCanStand(map, P.x, P.z)) {
    const lx = path.length ? path[path.length - 1].x : M.x;
    const lz = path.length ? path[path.length - 1].z : M.z;
    const L = Math.hypot(P.x - lx, P.z - lz);
    if (L > 1.0) {
      const k = (L - 0.9) / L;
      const tx = lx + (P.x - lx) * k;
      const tz = lz + (P.z - lz) * k;
      if (!map.collide(tx, tz, DOLL_R + 0.02) && clearLine(map, lx, lz, tx, tz)) path.push({ x: tx, z: tz });
    }
    gd = Math.min(gd, 0.9);
  }
  return { path, gap: gd };
}

// Elle se replace : une case de son terrain à l'étage de sa proie, d'où elle pourra rouler jusqu'à elle, à bonne
// distance de tous et dans le champ de vision de personne. Renvoie true si elle a trouvé
export function dollRelocate(sim, M, P, o = {}) {
  const floor = P.floor || 0;
  const map = sim.fm(floor);
  const t = dollTerrain(map);
  const alive = sim.players.filter((Q) => Q.status === 'alive');
  // d'où elle pourra l'atteindre : la composante de la case de terrain la plus proche de lui (dans une salle donnée
  // pour le final du film : devant l'écran de la salle 1)
  let anchor = -1;
  if (o.room != null) {
    const r = map.rooms[o.room];
    // (la case de terrain la plus à l'est de la salle : la bande libre au pied de l'écran)
    for (let x = r.x1; x >= r.x0 && anchor < 0; x--) for (let z = r.z0; z <= r.z1 && anchor < 0; z++) if (t.ok[z * t.W + x] && map.zone[z * t.W + x] === r.id) anchor = z * t.W + x;
  }
  if (anchor < 0) anchor = nearestTerr(t, P.x, P.z, 16);
  if (anchor < 0) return false;
  const comp = t.comp[anchor];
  const rMin = o.rMin ?? 16;
  const rMax = o.rMax ?? 38;
  const cells = [];
  const gx0 = cellOf(P.x);
  const gz0 = cellOf(P.z);
  const R = Math.ceil(rMax / C);
  for (let gz = Math.max(0, gz0 - R); gz <= Math.min(t.H - 1, gz0 + R); gz++)
    for (let gx = Math.max(0, gx0 - R); gx <= Math.min(t.W - 1, gx0 + R); gx++) {
      const k = gz * t.W + gx;
      if (!t.ok[k] || t.comp[k] !== comp) continue;
      const d = Math.hypot((gx + 0.5) * C - P.x, (gz + 0.5) * C - P.z);
      if (d >= rMin && d <= rMax) cells.push(k);
    }
  for (let i = 0; i < 40 && cells.length; i++) {
    const j = Math.floor(Math.random() * cells.length);
    const k = cells[j];
    cells[j] = cells[cells.length - 1];
    cells.pop();
    const x = ((k % t.W) + 0.5) * C;
    const z = (Math.floor(k / t.W) + 0.5) * C;
    if (alive.some((Q) => (Q.floor || 0) === floor && Math.hypot(Q.x - x, Q.z - z) < Math.min(14, rMin))) continue;
    if (dollWatched(sim, floor, x, z, 0.35)) continue;
    // (et là où elle est : personne ne doit la voir disparaître)
    M.x = x;
    M.z = z;
    M.floor = floor;
    M.y = -floor * FLOOR_DY;
    M.yaw = Math.atan2(P.x - x, P.z - z);
    M.v = 0;
    M.path = [];
    M.planT = 0;
    M.lostT = 0;
    M.boredT = 0;
    M.unseenT = 0;
    M.mode = 'still';
    sim.emit({ type: 'dollMoved', x, z, floor });
    return true;
  }
  return false;
}

// Installe la poupée à sa place d'origine : sous la coupole de la cour centrale, en haut, tournée vers le mail d'où
// l'on arrive
export function dollInit(sim) {
  const M = sim.monster;
  const map = sim.floors[0];
  const t = dollTerrain(map);
  const cc = (map.courts && map.courts.center) || { x0: 51, x1: 64, z0: 22, z1: 41 };
  const hx = (cc.x0 + 1.5) * C;
  const hz = ((cc.z0 + cc.z1 + 1) / 2) * C;
  // (sur le côté ouest de la cour, dans l'axe d'une allée du mail)
  let k = nearestTerr(t, hx, hz - 9, 6);
  if (k < 0) k = nearestTerr(t, map.monsterSpawn.x, map.monsterSpawn.z, 40);
  M.x = k >= 0 ? ((k % t.W) + 0.5) * C : map.monsterSpawn.x;
  M.z = k >= 0 ? (Math.floor(k / t.W) + 0.5) * C : map.monsterSpawn.z;
  M.floor = 0;
  M.y = 0;
  M.yaw = -Math.PI / 2;
  M.mode = 'still';
  M.v = 0;
  M.silent = true;
  M.dormantT = DOLL_DORMANT * (sim.difficulty === 'hard' ? 0.6 : 1);
  M.unseenT = 0;
  M.lostT = 0;
  M.boredT = 0;
  M.planT = 0;
  M.path = [];
  M.doll = true;
  M.home = { x: M.x, z: M.z };
}

// le film démarre : elle vient attendre devant l'écran de la salle 1 (dès que personne ne la regarde)
export function dollOnFilm(sim) {
  const M = sim.monster;
  if (!M || !M.doll) return;
  M.dormantT = 0;
  M.finale = true;
  M.finaleT = 0;
  M.finaleTry = 0;
}

const stop = (M) => {
  M.v = 0;
  M.mode = 'still';
  M.silent = true;
};

// Un pas de la poupée (l'hôte, ou le joueur seul)
export function updateDoll(sim) {
  const M = sim.monster;
  const P0 = sim.senseMonster();
  if (M.mode === 'grab') return sim.updateGrab(M);
  if (M.stunT > 0) {
    // repoussée : elle reste où elle est, le temps que sa proie s'éloigne
    M.stunT = Math.max(0, M.stunT - DT);
    M.push = null;
    stop(M);
    return;
  }
  if (M.mode === 'stun' || M.mode === 'patrol') M.mode = 'still';
  const alive = sim.players.filter((Q) => Q.status === 'alive');
  const floor = M.floor || 0;
  if (M.dormantT > 0) {
    M.dormantT = Math.max(0, M.dormantT - DT);
    stop(M);
    if (sim.cassettes > 0 || alive.some((Q) => (Q.floor || 0) === floor && Math.hypot(Q.x - M.x, Q.z - M.z) < DOLL_WAKE_R)) M.dormantT = 0;
    return;
  }
  // sous un regard : rien ne bouge
  if (dollWatched(sim, floor, M.x, M.z)) {
    if (M.mode === 'roll') sim.emit({ type: 'dollStop', x: M.x, z: M.z, floor, v: M.v });
    stop(M);
    M.unseenT = 0;
    return;
  }
  M.unseenT += DT;
  if (!P0) return stop(M);
  // le chemin, refait deux fois par seconde
  M.planT -= DT;
  if (M.planT <= 0 || !M.path) {
    const pl = plan(sim, M, P0);
    M.path = pl.path;
    M.gap = pl.gap;
    M.planT = 0.5;
  }
  // sa proie hors d'atteinte (un autre étage, un refuge loin de son terrain) : au bout d'un moment, elle se replace ;
  // plantée trop longtemps devant un refuge, elle va attendre ailleurs
  const far = !(M.gap < 7);
  M.lostT = far ? (M.lostT || 0) + DT : 0;
  M.boredT = !far && !M.path.length && Math.hypot(P0.x - M.x, P0.z - M.z) > DOLL_REACH + 1 ? (M.boredT || 0) + DT : 0;
  // le film démarre : elle vient se poster au pied de l'écran de la salle 1, face à celui qui est dans la cabine (une
  // seule mise en scène ; elle réessaie chaque seconde tant que quelqu'un regarde par là, puis renonce)
  if (M.finale && sim.film > 0 && sim.map.booth) {
    M.finaleT = (M.finaleT || 0) + DT;
    M.finaleTry = (M.finaleTry || 0) - DT;
    if (M.finaleT > 1 && M.finaleTry <= 0) {
      M.finaleTry = 1;
      const b = sim.map.booth;
      const near = (q) => Math.hypot(q.x - b.use.x, q.z - b.use.z);
      const Pc = alive.reduce((a, q) => (near(q) < near(a) ? q : a));
      if ((Pc.floor || 0) === 0 && near(Pc) < 60 && dollRelocate(sim, M, Pc, { room: b.screen.room, rMin: 9, rMax: 34 })) {
        M.finale = false;
        return;
      }
    }
    if (M.finaleT > 25) M.finale = false;
  }
  if (M.lostT >= DOLL_RELOC_T || M.boredT >= DOLL_BORED_T) {
    if (dollRelocate(sim, M, P0)) return;
    M.lostT = Math.max(0, M.lostT - 2); // rien trouvé : elle réessaie dans deux secondes
    M.boredT = Math.max(0, M.boredT - 2);
  }
  if (M.unseenT < DOLL_BLINK || !M.path.length) {
    stop(M);
    if (M.path && !M.path.length) M.yaw = Math.atan2(P0.x - M.x, P0.z - M.z); // au bout de son chemin : elle l'attend, tournée vers lui
  } else {
    // elle roule, de plus en plus vite ; jamais jusque dans un champ de vision
    const vmax = DOLL_VMAX * (sim.difficulty === 'hard' ? 1.15 : 1);
    M.v = Math.min(vmax, Math.max(DOLL_V0, M.v + DOLL_ACC * DT));
    let left = M.v * DT;
    let moved = false;
    while (left > 1e-6 && M.path.length) {
      const w = M.path[0];
      const dx = w.x - M.x;
      const dz = w.z - M.z;
      const L = Math.hypot(dx, dz);
      if (L < 1e-4) {
        M.path.shift();
        continue;
      }
      const s = Math.min(L, left);
      const nx = M.x + (dx / L) * s;
      const nz = M.z + (dz / L) * s;
      if (dollWatched(sim, floor, nx, nz)) {
        M.v = 0;
        break;
      }
      M.x = nx;
      M.z = nz;
      M.yaw = Math.atan2(dx, dz);
      moved = true;
      left -= s;
      if (s >= L - 1e-6) M.path.shift();
    }
    M.mode = moved ? 'roll' : 'still';
    M.silent = !moved;
    if (!moved) M.v = 0;
  }
  // elle attrape (jamais sous un regard : on est sorti plus haut) : la première fois elle agrippe, la seconde est la fin
  for (const P of alive) {
    if ((P.floor || 0) !== floor || Math.hypot(P.x - M.x, P.z - M.z) >= DOLL_REACH || sim.liftBetween(floor, M.x, M.z, P.x, P.z)) continue;
    sim.dollCatch(M, P);
    return;
  }
}
