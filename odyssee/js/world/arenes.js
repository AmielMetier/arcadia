// odyssee/js/world/arenes.js — les arènes à énigmes, comme dans HeartGold / SoulSilver.
// Chaque arène (21 × 26 cases) : le Champion attend en haut, on entre par le bas, et entre les deux une énigme propre
// au type, tirée d'une graine fixe et vérifiée par un petit solveur (on est sûr d'atteindre le Champion, puis de
// revenir à la sortie). Mécanismes : labyrinthes, fausses haies qu'on traverse, murs invisibles, obscurité, glace et
// sable qui glissent, flèches / souffles / courants qui poussent, dalles qui lèvent les barrières rouges ou bleues,
// téléporteurs, rochers à pousser, lave et gardiens du savoir qui posent une question avant de laisser passer.
// Une fois entré, on ne ressort pas avant d'avoir affronté le Champion (ou d'avoir perdu) : `gymLock` de la carte.
import { T, DIRS, walkable } from './tiles.js';
import { GameMap, rng } from './mapgen.js';

const W = 21, H = 26, X0 = 1, Y0 = 5, MW = 19, MH = 17;   // zone de l'énigme : x 1..19, y 5..21
const DOOR_X = 10;
/** style de chaque arène : sol, obstacle, mécanisme */
export const STYLES = {
  bug: { sol: 'gymBug', obs: 'bush', meca: 'labyrinthe' },
  water: { sol: 'gymWater', obs: 'pot', meca: 'courants' },
  electric: { sol: 'gymElec', obs: 'pc', meca: 'barrieres' },
  grass: { sol: 'gymGrass', obs: 'bush', meca: 'haies' },
  psychic: { sol: 'gymPsy', obs: 'statue', meca: 'teleport' },
  rock: { sol: 'gymRock', obs: 'rock', meca: 'rochers' },
  fire: { sol: 'gymFire', obs: 'rock', meca: 'lave' },
  dragon: { sol: 'gymDragon', obs: 'statue', meca: 'fleches' },
  normal: { sol: 'gymRock', obs: 'plant', meca: 'invisibles' },
  flying: { sol: 'gymPsy', obs: 'statue', meca: 'vents' },
  poison: { sol: 'gymPsy', obs: 'pot', meca: 'invisibles2' },
  ground: { sol: 'gymRock', obs: 'rock', meca: 'sable' },
  steel: { sol: 'gymElec', obs: 'pc', meca: 'barrieres2' },
  fairy: { sol: 'gymGrass', obs: 'plant', meca: 'teleport2' },
  dark: { sol: 'gymDragon', obs: 'statue', meca: 'noir' },
};

/* ---------------- grille de travail ---------------- */
// cellule : { t: 'mur'|'sol'|'eau'|'lave'|'glace'|'fleche'|'dalle'|'barr'|'tp'|'roc'|'haie'|'invis', dir, g, to }
function grille() {
  const G = [];
  for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) r.push({ t: 'sol' }); G.push(r); }
  for (let x = 0; x < W; x++) { G[0][x] = { t: 'mur' }; G[1][x] = { t: 'mur' }; G[H - 1][x] = { t: 'mur' }; }
  for (let y = 0; y < H; y++) { G[y][0] = { t: 'mur' }; G[y][W - 1] = { t: 'mur' }; }
  G[H - 1][DOOR_X] = { t: 'sortie' };
  return G;
}
const LEADER = [DOOR_X, 3], START = [DOOR_X, H - 2], GUIDE = [12, H - 2];

/** labyrinthe parfait (exploration en profondeur) dans la zone de l'énigme ; ouvertures en haut et en bas au milieu */
function labyrinthe(G, r, mur = 'mur') {
  const cw = (MW - 1) / 2, ch = (MH - 1) / 2;   // 9 × 8 cellules
  for (let y = Y0; y < Y0 + MH; y++) for (let x = X0; x < X0 + MW; x++) G[y][x] = { t: mur };
  const seen = new Set(), st = [[4, ch - 1]];
  const cx = (i) => X0 + 1 + 2 * i, cy = (j) => Y0 + 1 + 2 * j;
  seen.add('4,' + (ch - 1)); G[cy(ch - 1)][cx(4)] = { t: 'sol' };
  while (st.length) {
    const [i, j] = st[st.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < cw && b < ch && !seen.has(a + ',' + b));
    if (!nb.length) { st.pop(); continue; }
    const [a, b] = nb[Math.floor(r() * nb.length)];
    G[cy(j) + (b - j)][cx(i) + (a - i)] = { t: 'sol' }; G[cy(b)][cx(a)] = { t: 'sol' };
    seen.add(a + ',' + b); st.push([a, b]);
  }
  // quelques boucles : moins de culs-de-sac, plusieurs chemins
  for (let k = 0; k < 4; k++) {
    const x = X0 + 1 + 2 * Math.floor(r() * (cw - 1)) + 1, y = Y0 + 1 + 2 * Math.floor(r() * ch);
    if (G[y][x].t === mur) G[y][x] = { t: 'sol' };
  }
  G[Y0][DOOR_X] = { t: 'sol' }; G[Y0 + MH - 1][DOOR_X] = { t: 'sol' };
}
/** champ ouvert (bordure de murs, ouvertures en haut et en bas) rempli d'une case donnée */
function champ(G, cell) {
  for (let y = Y0; y < Y0 + MH; y++) for (let x = X0; x < X0 + MW; x++) G[y][x] = { ...cell };
  for (let x = X0; x < X0 + MW; x++) { G[Y0][x] = { t: 'mur' }; G[Y0 + MH - 1][x] = { t: 'mur' }; }
  G[Y0][DOOR_X] = { t: 'sol' }; G[Y0 + MH - 1][DOOR_X] = { t: 'sol' };
}

/* ---------------- solveur ---------------- */
const passable = (c, up) => (c.t === 'barr' ? c.g !== up : ['sol', 'glace', 'fleche', 'dalle', 'tp', 'haie', 'sortie', 'garde'].includes(c.t));
function bloque(G, x, y, up, rocs, npc) { if (x < 0 || y < 0 || x >= W || y >= H) return true; const k = x + ',' + y; if (npc?.has(k) || rocs.has(k)) return true; return !passable(G[y][x], up); }
/** où l'on s'arrête après un pas (glace, flèches, téléporteur, dalle) */
function poser(G, x, y, d, up, rocs, npc) {
  for (let g = 0; g < 400; g++) {
    const c = G[y][x];
    if (c.t === 'fleche') d = c.dir; else if (c.t !== 'glace') break;
    const [dx, dy] = DIRS[d]; if (bloque(G, x + dx, y + dy, up, rocs, npc)) break; x += dx; y += dy;
  }
  const c = G[y][x];
  if (c.t === 'tp') [x, y] = c.to;
  if (c.t === 'dalle') up = c.g;
  return [x, y, up];
}
/** plus court chemin (en pas) de (sx, sy) jusqu'à goal ; renvoie la suite des cases occupées, ou null */
export function resoudre(G, sx, sy, goal, o = {}) {
  const npc = o.npc || new Set(), up0 = o.up || 'r', rocs0 = o.rocs || new Set();
  const K = (x, y, up, rocs) => `${x},${y},${up}${rocs.size ? '|' + [...rocs].sort().join(';') : ''}`;
  const start = [sx, sy, up0, rocs0], prev = new Map([[K(...start), null]]), q = [start];
  for (let h = 0; h < q.length && h < 200000; h++) {
    const s = q[h], [x, y, up, rocs] = s;
    if (goal(x, y)) { const path = []; let k = K(...s), cur = s; while (cur) { path.push(cur); cur = prev.get(K(...cur)); } return path.reverse(); }
    for (const d of Object.keys(DIRS)) {
      const [dx, dy] = DIRS[d], tx = x + dx, ty = y + dy; let nr = rocs;
      if (rocs.has(tx + ',' + ty)) {
        const bx = tx + dx, by = ty + dy;
        if (bloque(G, bx, by, up, rocs, npc) || G[by][bx].t !== 'sol') continue;
        nr = new Set(rocs); nr.delete(tx + ',' + ty); nr.add(bx + ',' + by);
      } else if (bloque(G, tx, ty, up, rocs, npc)) continue;
      const [nx, ny, nup] = poser(G, tx, ty, d, up, nr, npc);
      const n = [nx, ny, nup, nr], k = K(...n);
      if (prev.has(k)) continue; prev.set(k, s); q.push(n);
    }
  }
  return null;
}
const pres = ([lx, ly]) => (x, y) => Math.abs(x - lx) + Math.abs(y - ly) === 1;
/** l'énigme est-elle bonne ? aller jusqu'au Champion, et retour à la sortie depuis là */
function verifier(G, rocs) {
  const npc = new Set([LEADER.join(','), GUIDE.join(',')]);
  const aller = resoudre(G, START[0], START[1], pres(LEADER), { npc, rocs });
  if (!aller) return null;
  const [x, y, up, r2] = aller[aller.length - 1];
  const retour = resoudre(G, x, y, (a, b) => a === START[0] && b === START[1], { npc, up, rocs: r2 });
  return retour ? aller : null;
}

/* ---------------- mécanismes ---------------- */
const MECA = {
  labyrinthe(G, r) { labyrinthe(G, r); },
  noir(G, r) { labyrinthe(G, r); },
  // haies : on bouche le vrai chemin à trois endroits ; des fausses haies ouvrent des passages ailleurs
  haies(G, r) {
    labyrinthe(G, r);
    const sol = verifier(G); if (!sol) return false;
    const murs = []; for (let y = Y0 + 1; y < Y0 + MH - 1; y++) for (let x = X0 + 1; x < X0 + MW - 1; x++) if (G[y][x].t === 'mur' && ((G[y][x - 1].t === 'sol' && G[y][x + 1].t === 'sol') || (G[y - 1][x].t === 'sol' && G[y + 1][x].t === 'sol'))) murs.push([x, y]);
    for (let k = 0; k < 7; k++) { const [x, y] = murs.splice(Math.floor(r() * murs.length), 1)[0]; G[y][x] = { t: 'haie' }; }
    const chemin = sol.filter(([x, y]) => y > Y0 + 1 && y < Y0 + MH - 2 && G[y][x].t === 'sol');
    for (let k = 0; k < 3 && chemin.length; k++) { const [x, y] = chemin.splice(Math.floor(r() * chemin.length), 1)[0]; G[y][x] = { t: 'mur' }; }
  },
  // murs invisibles : un labyrinthe dont une partie des murs ne se voit pas
  invisibles(G, r) { labyrinthe(G, r); for (let y = Y0 + 1; y < Y0 + MH - 1; y++) for (let x = X0 + 1; x < X0 + MW - 1; x++) if (G[y][x].t === 'mur' && r() < 0.5) G[y][x] = { t: 'invis' }; },
  invisibles2(G, r) { labyrinthe(G, r); for (let y = Y0 + 1; y < Y0 + MH - 1; y++) for (let x = X0 + 1; x < X0 + MW - 1; x++) if (G[y][x].t === 'mur') G[y][x] = { t: 'invis' }; },
  // lave : un labyrinthe dont les murs sont de la lave, et trois gardiens du savoir sur le chemin
  lave(G, r) {
    labyrinthe(G, r, 'lave');
    const sol = verifier(G); if (!sol) return false;
    const ch = sol.filter(([x, y]) => y > Y0 + 1 && y < Y0 + MH - 2 && G[y][x].t === 'sol');
    for (let k = 0; k < 3; k++) { const [x, y] = ch[Math.floor((k + 1) * ch.length / 4)]; G[y][x] = { t: 'garde' }; }
  },
  // dalles et barrières : des barrières sur le vrai chemin, des dalles dans les impasses
  barrieres(G, r, _rocs, n = 4) {
    labyrinthe(G, r);
    const sol = verifier(G); if (!sol) return false;
    const ch = sol.filter(([x, y]) => y > Y0 + 1 && y < Y0 + MH - 2 && G[y][x].t === 'sol' && (x - X0) % 2 !== (y - Y0) % 2);   // passages entre deux cellules
    for (let k = 0; k < n && ch.length; k++) { const [x, y] = ch.splice(Math.floor(r() * ch.length), 1)[0]; G[y][x] = { t: 'barr', g: k % 2 ? 'b' : 'r' }; }
    const impasses = [];
    for (let y = Y0 + 1; y < Y0 + MH - 1; y++) for (let x = X0 + 1; x < X0 + MW - 1; x++) if (G[y][x].t === 'sol') { const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => G[y + b][x + a].t !== 'mur').length; if (n4 === 1) impasses.push([x, y]); }
    for (let k = 0; k < 4 && impasses.length; k++) { const [x, y] = impasses.splice(Math.floor(r() * impasses.length), 1)[0]; G[y][x] = { t: 'dalle', g: k % 2 ? 'r' : 'b' }; }
  },
  barrieres2(G, r) { return MECA.barrieres(G, r, null, 6); },
  // glace / sable : un champ glissant parsemé de rochers ; on ne s'arrête que contre un obstacle
  sable(G, r) {
    champ(G, { t: 'glace' });
    for (let y = Y0 + 1; y < Y0 + MH - 1; y++) for (let x = X0; x < X0 + MW; x++) if (r() < 0.11) G[y][x] = { t: 'mur' };
    G[Y0 + MH - 2][DOOR_X] = { t: 'sol' }; G[Y0 + 1][DOOR_X] = { t: 'glace' };
  },
  // flèches : des tapis roulants (ou des souffles, des courants) sur un sol semé d'obstacles
  fleches(G, r, fond = 'sol', p = 0.42) {
    champ(G, { t: fond });
    const D = ['up', 'down', 'left', 'right'];
    for (let y = Y0 + 1; y < Y0 + MH - 1; y++) for (let x = X0; x < X0 + MW; x++) {
      const q = r();
      if (q < p) G[y][x] = { t: 'fleche', dir: D[Math.floor(r() * 4)] };
      else if (q < p + 0.16) G[y][x] = { t: fond === 'eau' ? 'eau' : 'mur' };
      else G[y][x] = { t: 'sol' };
    }
    G[Y0 + MH - 2][DOOR_X] = { t: 'sol' };
  },
  vents(G, r) { return MECA.fleches(G, r, 'sol', 0.5); },
  courants(G, r) { return MECA.fleches(G, r, 'eau', 0.45); },
  // téléporteurs : neuf salles closes, reliées seulement par des dalles
  teleport(G, r) {
    champ(G, { t: 'mur' });
    const salles = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const x0 = X0 + 1 + i * 6, y0 = Y0 + 1 + j * 5;
      for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 5; x++) G[y][x] = { t: 'sol' };
      salles.push({ x0, y0 });
    }
    // la salle du bas au milieu touche l'entrée, celle du haut au milieu touche le Champion
    G[Y0 + MH - 1][DOOR_X] = { t: 'sol' }; for (let y = Y0 + MH - 2; y >= salles[7].y0 + 4; y--) G[y][DOOR_X] = { t: 'sol' };
    G[Y0][DOOR_X] = { t: 'sol' };
    const places = salles.map((s) => { const L = []; for (let y = s.y0; y < s.y0 + 4; y++) for (let x = s.x0; x < s.x0 + 5; x++) if (x !== DOOR_X) L.push([x, y]); return L; });
    // chaque salle reçoit deux dalles ; on les relie au hasard deux à deux
    const pads = []; places.forEach((L, i) => { for (let k = 0; k < 2; k++) pads.push(L.splice(Math.floor(r() * L.length), 1)[0]); });
    for (let i = pads.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pads[i], pads[j]] = [pads[j], pads[i]]; }
    for (let k = 0; k + 1 < pads.length; k += 2) { const [a, b] = [pads[k], pads[k + 1]]; G[a[1]][a[0]] = { t: 'tp', to: b }; G[b[1]][b[0]] = { t: 'tp', to: a }; }
  },
  teleport2(G, r) { MECA.teleport(G, r); },
  // rochers : un labyrinthe dont trois passages du vrai chemin sont bouchés par des rochers à pousser
  rochers(G, r, rocs) {
    labyrinthe(G, r);
    const sol = verifier(G); if (!sol) return false;
    const ch = sol.filter(([x, y]) => y > Y0 + 2 && y < Y0 + MH - 3 && G[y][x].t === 'sol');
    for (let k = 0; k < 3 && ch.length; k++) { const [x, y] = ch.splice(Math.floor(r() * ch.length), 1)[0]; rocs.add(x + ',' + y); }
  },
};

/** tire l'énigme d'une arène (graine fixe), en recommençant jusqu'à ce qu'elle soit résoluble et assez longue */
export function enigme(type, seed = 1) {
  const S = STYLES[type] || STYLES.normal;
  for (let essai = 0; essai < 400; essai++) {
    const r = rng(seed * 7919 + essai * 104729 + 3), G = grille(), rocs = new Set();
    if (MECA[S.meca](G, r, rocs) === false) continue;
    const sol = verifier(G, rocs);
    const min = { labyrinthe: 30, noir: 30, haies: 30, invisibles: 30, invisibles2: 30, lave: 30, barrieres: 30, barrieres2: 30, sable: 12, fleches: 18, vents: 18, courants: 18, teleport: 8, teleport2: 8, rochers: 30 }[S.meca] || 10;
    // énigmes à états : il faut vraiment changer de couleur, ou pousser un rocher
    if (!sol || sol.length < min) continue;
    if (S.meca.startsWith('barrieres') && !sol.some((s) => s[2] !== 'r')) continue;
    if (S.meca === 'rochers' && !sol.some((s) => s[3] !== rocs)) continue;
    if (S.meca.startsWith('teleport') && sol.filter((s, i) => i && Math.abs(s[0] - sol[i - 1][0]) + Math.abs(s[1] - sol[i - 1][1]) > 1).length < 3) continue;
    return { G, rocs, sol, S };
  }
  throw new Error('arène ' + type + ' : aucune énigme résoluble');
}

/** construit l'arène d'un type : la carte, les places des dresseurs (le long du parcours) et du Champion */
export function buildArena(id, gym, type, name) {
  const { G, rocs, sol, S } = enigme(type, gym + 1);
  const m = new GameMap(id, W, H, { outdoor: false, fill: T.FLOOR, floor: S.sol, music: 'gym', name, battleBg: 'gym', wallStyle: 'wall_gym' });
  m.gymLock = gym; m.pushFree = true; m.barriers = []; m.arene = type;
  if (S.meca === 'noir') m.dark = 'arene';
  const quiz = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = G[y][x], floor = () => m.set(x, y, T.FLOOR);
    if (c.t === 'mur') { if (y <= 1 || x === 0 || x === W - 1 || y === H - 1) m.set(x, y, T.WALL); else { floor(); m.prop(S.obs, x, y, true); } }
    else if (c.t === 'sortie') { m.set(x, y, T.MAT); m.exitX = x; m.exitY = y; }
    else if (c.t === 'haie') { floor(); m.prop(S.obs, x, y, false); }
    else if (c.t === 'invis') { m.under.set(x + ',' + y, T.FLOOR); m.set(x, y, T.BLOCK); }
    else if (c.t === 'eau') m.set(x, y, T.WATER);
    else if (c.t === 'lave') m.set(x, y, T.LAVA);
    else if (c.t === 'glace') { floor(); m.deco.push({ k: type === 'ground' ? 'sable' : 'glace', x, y }); m.object(x, y, { type: 'glace' }); }
    else if (c.t === 'fleche') {
      floor(); const k = S.meca === 'vents' ? 'vent' : S.meca === 'courants' ? 'courant' : 'fleche';
      if (k === 'courant') m.deco.push({ k: 'eau', x, y });
      m.deco.push({ k, x, y, dir: c.dir }); m.object(x, y, { type: 'fleche', dir: c.dir });
    } else if (c.t === 'dalle') { floor(); m.deco.push({ k: 'dalle', x, y, g: c.g }); m.object(x, y, { type: 'dalle', g: c.g }); }
    else if (c.t === 'barr') { m.barriers.push([x, y, c.g]); m.deco.push({ k: 'socle', x, y, g: c.g }); m.set(x, y, c.g === 'r' ? T.BARRIER_R : T.FLOOR); }
    else if (c.t === 'tp') { floor(); m.deco.push({ k: 'tp', x, y }); m.object(x, y, { type: 'tp', to: c.to }); }
    else if (c.t === 'garde') { floor(); quiz.push([x, y]); }
    else floor();
  }
  for (const k of rocs) { const [x, y] = k.split(',').map(Number); m.set(x, y, T.BOULDER); }
  // statues de l'entrée
  m.prop('gymstatue', 8, H - 4, true); m.prop('gymstatue', 12, H - 4, true);
  // dresseurs : sur des cases libres voisines du parcours (jamais dessus), tournés vers lui, répartis du bas vers le haut
  const surChemin = new Set(sol.map(([x, y]) => x + ',' + y));
  const cand = [];
  for (let i = 1; i < sol.length; i++) {
    const [x, y] = sol[i];
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const nx = x + dx, ny = y + dy, c = G[ny]?.[nx];
      if (!c || c.t !== 'sol' || surChemin.has(nx + ',' + ny) || ny < Y0 + 1 || ny > Y0 + MH - 2 || rocs.has(nx + ',' + ny)) continue;
      const face = { up: 'down', down: 'up', left: 'right', right: 'left' }[d];
      cand.push([nx, ny, face, i]);
    }
  }
  const spots = [];
  for (const q of [0.15, 0.4, 0.65, 0.88]) {
    const want = q * sol.length; let best = null;
    for (const c of cand) if (!spots.some((s) => Math.abs(s[0] - c[0]) + Math.abs(s[1] - c[1]) < 3) && (!best || Math.abs(c[3] - want) < Math.abs(best[3] - want))) best = c;
    if (!best) continue;
    // un dresseur ne doit jamais fermer le seul passage (aller et retour)
    const npc = new Set([LEADER.join(','), GUIDE.join(','), ...spots.map(([a, b]) => a + ',' + b), best[0] + ',' + best[1]]);
    const aller = resoudre(G, START[0], START[1], pres(LEADER), { npc, rocs });
    const fin = aller && aller[aller.length - 1];
    if (fin && resoudre(G, fin[0], fin[1], (a, b) => a === START[0] && b === START[1], { npc, up: fin[2], rocs: fin[3] })) spots.push(best.slice(0, 3));
    else cand.splice(cand.indexOf(best), 1);
  }
  // repli : des places fixes sur les côtés de l'entrée
  for (const s of [[3, H - 3, 'right'], [17, H - 3, 'left'], [4, 4, 'right'], [16, 4, 'left']]) if (spots.length < 4) spots.push(s);
  spots.sort((a, b) => b[1] - a[1]);
  return { map: m, spots, leader: LEADER, guide: GUIDE, quiz };
}

/* ---------------- les gardiens du savoir (arène Feu) ---------------- */
export const QUIZ = [
  { q: 'Quel type résiste au Feu ?', choix: ['Plante', 'Eau', 'Glace', 'Insecte'], bonne: 1 },
  { q: 'Quelle attaque Feu brûle à coup sûr ?', choix: ['Lance-Flammes', 'Feu Follet', 'Flammèche', 'Déflagration'], bonne: 1 },
  { q: 'Le Feu est super efficace contre…', choix: ['l\'Acier', 'la Roche', 'le Dragon', 'l\'Eau'], bonne: 0 },
  { q: 'Que soigne l\'Anti-Brûle ?', choix: ['Le gel', 'La brûlure', 'Le poison', 'La paralysie'], bonne: 1 },
  { q: 'Quel talent rend insensible aux attaques Feu ?', choix: ['Torche', 'Brasier', 'Écran Fumée', 'Corps Ardent'], bonne: 0 },
  { q: 'Contre quoi le Feu est-il peu efficace ?', choix: ['La Plante', 'La Glace', 'Le Dragon', 'L\'Insecte'], bonne: 2 },
];
