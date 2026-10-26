// Récolte, destruction et construction. Tout ce qui est solide a des points de vie : décor (arbres, rochers,
// voitures, conteneurs…), pans de mur des bâtiments, portes, meubles, et les constructions des joueurs. La pioche
// (outil de récolte) en tire du bois, de la pierre ou du métal ; balles et explosions les abîment aussi.
// On construit des murs, des sols et des escaliers en bois, pierre ou métal sur la grille de 4 m des bâtiments
// (et d'étages de 3,2 m) ; une construction qui ne repose plus sur rien (sol, bâtiment, autre construction
// soutenue) s'effondre. Moteur PUR, branché sur la partie par sim.S.hooks.
import { CELL, STOREY } from './buildings.js';
import { keyOf, floorY } from './world.js';
import { PROPS } from './map.js';
import { FURN } from './furniture.js';
import { MAT_MAX } from './items.js';

export const COST = 10;
export const PIECE_HP = { bois: 150, pierre: 300, metal: 450 };
export const BUILD_TIME = { bois: 1.1, pierre: 1.6, metal: 2.2 };
export const PIECES = { mur: 'Mur', sol: 'Sol', escalier: 'Escalier' };
const PICK_DMG = 50, PICK_PLAYER = 20, PICK_RATE = 0.5, PICK_RANGE = 3.2;
// points de vie et rendement (matériau gagné par coup de pioche) du décor
const PROP_HP = {
  arbre: [200, 'bois', 9], sapin: [200, 'bois', 9], rocher: [260, 'pierre', 8], voiture: [320, 'metal', 8], camion: [500, 'metal', 10], tracteur: [300, 'metal', 8],
  engin: [450, 'metal', 10], conteneur: [520, 'metal', 10], citerne: [350, 'metal', 8], silo: [700, 'metal', 10], botte: [70, 'bois', 5], caisse: [90, 'bois', 6],
  grume: [220, 'bois', 10], tente: [60, null, 0], table: [70, 'bois', 5], fontaine: [400, 'pierre', 8], pompe: [120, 'metal', 6], cheminee: [900, 'pierre', 10], bateau: [160, 'bois', 7],
  auvent: [260, 'metal', 6],
  lampadaire: [120, 'metal', 5], benne: [380, 'metal', 9], poubelle: [420, 'metal', 9], baril: [90, 'metal', 5], bonbonne: [110, 'metal', 6], cone: [30, null, 0],
  barriere: [140, 'metal', 5], sacs: [320, 'bois', 6], pneus: [160, 'metal', 5], reservoir: [480, 'metal', 10], epave: [360, 'metal', 9],
  cartons: [60, 'bois', 5], tuyaux: [240, 'metal', 7], caisson: [400, 'metal', 9],
  banc: [80, 'bois', 5], bouche: [100, 'metal', 4], corbeille: [60, 'metal', 3], boite: [60, 'metal', 3], abribus: [220, 'metal', 7],
  jardiniere: [90, 'bois', 5], transfo: [150, 'metal', 6],
};
const WALL_HP = { bois: 170, pierre: 300, metal: 420 };

// emplacement visé pour une pièce, depuis la position et le regard d'un joueur. Grille de 4 m en plan ; en hauteur,
// des étages de 3,2 m calés sur les constructions voisines (à moins de 10 m), sinon sur les pieds du joueur.
export function slotFor(x, y, z, yaw, pitch, kind, pieces) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  let off = ((y % STOREY) + STOREY) % STOREY, best = 100;
  if (pieces) for (const p of pieces.values()) {
    const d = Math.hypot((p.x + 0.5) * CELL - x, (p.z + 0.5) * CELL - z);
    if (d < 10 && d < best) { best = d; off = ((p.y0 % STOREY) + STOREY) % STOREY; }
  }
  const y0 = off + (Math.floor((y + 0.4 - off) / STOREY) + (pitch > 0.45 ? 1 : 0)) * STOREY;
  if (kind === 'mur') {
    // le bord de la case devant soi (on construit un mur pour se couvrir)
    const ax = x + fx * 1.2, az = z + fz * 1.2, cx = Math.floor(ax / CELL), cz = Math.floor(az / CELL);
    if (Math.abs(fx) > Math.abs(fz)) return { kind, o: 'v', x: fx > 0 ? cx + 1 : cx, z: Math.floor(z / CELL), y0 };
    return { kind, o: 'h', x: Math.floor(x / CELL), z: fz > 0 ? cz + 1 : cz, y0 };
  }
  const ahead = pitch < -0.8 ? 0 : 2.8, cx = Math.floor((x + fx * ahead) / CELL), cz = Math.floor((z + fz * ahead) / CELL);
  if (kind === 'sol') return { kind, x: cx, z: cz, y0 };
  const [dx, dz] = Math.abs(fx) > Math.abs(fz) ? [Math.sign(fx), 0] : [0, Math.sign(fz)];
  return { kind, x: cx, z: cz, y0, dx, dz };
}
const lvl = (y) => Math.round(y * 10);
export const slotKey = (s) => s.kind === 'mur' ? `m${s.o}${s.x},${s.z},${lvl(s.y0)}` : s.kind === 'sol' ? `s${s.x},${s.z},${lvl(s.y0)}` : `e${s.x},${s.z},${lvl(s.y0)}`;
// boîte englobante d'une pièce (contacts entre pièces, soutien)
export function pieceBox(p) {
  const y0 = p.y0, x0 = p.x * CELL, z0 = p.z * CELL;
  if (p.kind === 'mur') return p.o === 'h' ? { x0, x1: x0 + CELL, z0: z0 - 0.15, z1: z0 + 0.15, y0, y1: y0 + STOREY } : { x0: x0 - 0.15, x1: x0 + 0.15, z0, z1: z0 + CELL, y0, y1: y0 + STOREY };
  if (p.kind === 'sol') return { x0, x1: x0 + CELL, z0, z1: z0 + CELL, y0: y0 - 0.2, y1: y0 + 0.05 };
  return { x0, x1: x0 + CELL, z0, z1: z0 + CELL, y0, y1: y0 + STOREY };
}
const touch = (a, b, m = 0.2) => a.x0 <= b.x1 + m && a.x1 >= b.x0 - m && a.y0 <= b.y1 + m && a.y1 >= b.y0 - m && a.z0 <= b.z1 + m && a.z1 >= b.z0 - m;

export function createBuild(sim, map, world) {
  const S = sim.S;
  const ev = (e) => S.events.push(e);
  const hp = new Map();          // clé → { hp, max, mat, yield }
  const pieces = new Map();      // id → pièce construite { id, kind, o, x, z, L, dx, dz, mat, owner, hp, max, t }
  const bySlot = new Map();
  const broken = new Set();      // clés détruites (pour les retardataires et le réseau)
  let nextId = 1;
  S.build = { pieces, broken };

  // ------------------------------------------------------------------ points de vie d'un objet destructible
  function info(key) {
    if (hp.has(key)) return hp.get(key);
    let r = null;
    const [kind, rest] = [key[0], key.slice(2)];
    if (kind === 'p') {
      const p = map.props[+rest], h = p && PROP_HP[p.kind];
      if (h) r = { hp: h[0] * (p.kind === 'rocher' ? Math.max(0.6, p.s) : 1), mat: h[1], yield: h[2], what: p.kind };
    } else if (kind === 'w') {
      const [b] = rest.split(':'), B = map.buildings[+b];
      const ext = !(world.byKey.get(key) || []).some((s) => s.ref && s.ref.e && !s.ref.e.ext);
      r = { hp: ext ? WALL_HP[B.mat] : 110, mat: B.mat, yield: 6, what: 'mur' };
    } else if (kind === 'f') {
      const f = findFurn(+rest), F = f && FURN[f.kind];
      if (F) r = { hp: F.mat === 'metal' ? 140 : 90, mat: F.mat, yield: F.mat ? 5 : 0, what: f.kind };
    } else if (kind === 'd') r = { hp: 90, mat: 'bois', yield: 5, what: 'porte' };
    else if (kind === 'b') { const p = pieces.get(+rest); if (p) r = p; }
    if (r) { r.max = r.max || r.hp; if (kind !== 'b') hp.set(key, r); }
    return r;
  }
  const furnById = new Map();
  for (const b of map.buildings) for (const f of b.furniture) furnById.set(f.id, f);
  const findFurn = (id) => furnById.get(id);

  // abîmer un objet ; by : le joueur (récolte) ; renvoie true s'il est détruit
  function hit(key, dmg, by, point, harvest) {
    if (!key || broken.has(key)) return false;
    const I = info(key);
    if (!I) return false;
    I.hp -= dmg;
    if (harvest && by && I.mat && I.yield) {
      const n = Math.min(I.yield, MAT_MAX - by.mats[I.mat]);
      if (n > 0) { by.mats[I.mat] += n; ev({ e: 'recolte', p: by.id, m: I.mat, n }); }
    }
    ev({ e: 'coup', key, hp: Math.max(0, I.hp), max: I.max, x: point[0], y: point[1], z: point[2], by: by ? by.id : null, mat: I.mat });
    if (I.hp <= 0) { destroy(key, I); return true; }
    return false;
  }
  function destroy(key, I) {
    broken.add(key);
    const c = world.removeKey(key) || { x: 0, y: 0, z: 0 };
    if (key[0] === 'b') { const p = pieces.get(+key.slice(2)); if (p) { pieces.delete(p.id); bySlot.delete(slotKey(p)); } }
    ev({ e: 'casse', key, x: c.x, y: c.y, z: c.z, mat: I && I.mat, what: I && I.what });
    settle();
  }

  // ------------------------------------------------------------------ constructions des joueurs
  function canPlace(slot) {
    if (bySlot.has(slotKey(slot))) return false;
    const B = pieceBox(slot), cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, cy = (B.y0 + B.y1) / 2;
    if (cx < 8 || cz < 8 || cx > map.size - 8 || cz > map.size - 8) return false;
    // pas dans un mur, un meuble ou le relief (le bas d'un mur peut s'enfoncer dans le sol)
    const probe = slot.kind === 'mur' ? [cx, B.y1 - 0.6, cz] : slot.kind === 'sol' ? [cx, B.y1 - 0.1, cz] : [cx, cy, cz];
    // une pièce entièrement sous le relief ne sert à rien
    if (B.y1 < Math.min(map.heightAt(B.x0 + 0.3, B.z0 + 0.3), map.heightAt(B.x1 - 0.3, B.z1 - 0.3), map.heightAt(cx, cz)) - 0.1) return false;
    let blocked = false;
    world.near(cx, cz, 3, (s) => { if (!blocked && !(s.ref && s.ref.build) && s.y1 > probe[1] - 0.05 && s.y0 < probe[1] + 0.05 && world.over(s, probe[0], probe[2], -0.15)) blocked = true; });
    return !blocked;
  }
  function addSolids(p) {
    const ref = { build: p.id }, B = pieceBox(p);
    if (p.kind === 'escalier') {
      world.ramp({ x0: p.x * CELL, z0: p.z * CELL, x1: (p.x + 1) * CELL, z1: (p.z + 1) * CELL, dx: p.dx, dz: p.dz, y0: B.y0, y1: B.y1, ref });
      // sous l'escalier, une fine planche qui arrête les balles (le dessus reste une rampe)
    } else world.box(B.x0, B.y0, B.z0, B.x1, B.y1, B.z1, ref);
  }
  function place(P, kind, mat) {
    if (P.mats[mat] < COST) { ev({ e: 'manque', p: P.id, m: mat }); return null; }
    const slot = slotFor(P.x, P.y, P.z, P.inp.yaw, P.inp.pitch, kind, pieces);
    if (!canPlace(slot)) return null;
    P.mats[mat] -= COST;
    const p = { id: nextId++, ...slot, mat, owner: P.id, max: PIECE_HP[mat], hp: PIECE_HP[mat] * 0.12, t: 0, what: kind, yield: 0 };
    pieces.set(p.id, p); bySlot.set(slotKey(p), p);
    addSolids(p);
    ev({ e: 'construit', piece: { ...p } });
    return p;
  }
  // une pièce tient si elle touche le sol, un bâtiment, ou une pièce qui tient
  function grounded(p) {
    const B = pieceBox(p), cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    const pts = p.kind === 'mur' ? [[cx, cz], [B.x0 + 0.2, B.z0 + 0.1], [B.x1 - 0.2, B.z1 - 0.1]] : [[cx, cz], [B.x0 + 0.4, B.z0 + 0.4], [B.x1 - 0.4, B.z1 - 0.4], [B.x0 + 0.4, B.z1 - 0.4], [B.x1 - 0.4, B.z0 + 0.4]];
    for (const [x, z] of pts) {
      if (map.heightAt(x, z) >= B.y0 - 0.7) return true;
      let on = false;
      world.near(x, z, 1, (s) => { if (!on && !(s.ref && s.ref.build) && Math.abs(s.y1 - B.y0) < 0.6 && world.over(s, x, z, 0.1)) on = true; });
      if (on) return true;
    }
    return false;
  }
  function settle() {
    if (!pieces.size) return;
    const list = [...pieces.values()], boxes = new Map(list.map((p) => [p.id, pieceBox(p)]));
    const ok = new Set(list.filter(grounded).map((p) => p.id)), todo = [...ok];
    while (todo.length) {
      const a = boxes.get(todo.pop());
      for (const p of list) if (!ok.has(p.id) && touch(a, boxes.get(p.id))) { ok.add(p.id); todo.push(p.id); }
    }
    for (const p of list) if (!ok.has(p.id) && !broken.has('b:' + p.id)) destroy('b:' + p.id, p);
  }

  // ------------------------------------------------------------------ branchements sur la partie
  // outil de récolte (case 0) et mode construction : à la place du tir
  S.hooks.act = (P, dt, shot) => {
    P.swing = Math.max(0, (P.swing || 0) - dt);
    P.bcd = Math.max(0, (P.bcd || 0) - dt);
    const B = P.inp.build;
    if (B && PIECES[B]) {
      const mat = P.inp.mat || 'bois';
      // un clic pose une pièce (gardé en mémoire s'il tombe pendant le délai) ; clic maintenu : une toutes les 0,2 s
      if (shot) P.bq = true;
      if ((P.inp.fire || P.bq) && P.bcd <= 0) { P.bq = false; if (place(P, B, mat)) P.bcd = 0.2; }
      return true;
    }
    if (P.sel !== 0) return false;
    if ((P.inp.fire || shot) && P.swing <= 0) {
      P.swing = PICK_RATE;
      const o = sim.eye(P), c = Math.cos(P.inp.pitch), d = [Math.sin(P.inp.yaw) * c, Math.sin(P.inp.pitch), Math.cos(P.inp.yaw) * c];
      // la portée se compte depuis le joueur (l'épaule est un peu en arrière de la caméra)
      const h = world.raycast(o[0], o[1], o[2], d[0], d[1], d[2], PICK_RANGE);
      ev({ e: 'pioche', p: P.id });
      // un joueur à portée ?
      for (const Q of S.players.values()) {
        if (Q === P || !Q.alive || Q.mode !== 'sol') continue;
        const dx = Q.x - P.x, dz = Q.z - P.z, dd = Math.hypot(dx, dz);
        if (dd < 2.2 && (dx * d[0] + dz * d[2]) / (dd || 1) > 0.6 && Math.abs(Q.y - P.y) < 1.5 && dd < h.t + 0.5) { sim.damage(Q, PICK_PLAYER, P, { cause: 'pioche' }); return true; }
      }
      if (h.s && h.t < PICK_RANGE) {
        const key = keyOf(h.s.ref);
        if (key) hit(key, PICK_DMG, P, [o[0] + d[0] * h.t, o[1] + d[1] * h.t, o[2] + d[2] * h.t], true);
      }
    }
    return true;
  };
  // balles et explosions abîment aussi le décor et les constructions (sans récolte)
  S.hooks.hitSolid = (s, dmg, by, point) => { const key = keyOf(s.ref); if (key) hit(key, dmg, by, point, false); };
  S.hooks.blast = (x, y, z, r, dmg) => {
    const keys = new Map();
    world.near(x, z, r + 2, (s) => {
      const key = keyOf(s.ref);
      if (!key || keys.has(key)) return;
      const cx = s.t === 0 ? Math.max(s.x0, Math.min(x, s.x1)) : s.cx, cz = s.t === 0 ? Math.max(s.z0, Math.min(z, s.z1)) : s.cz, cy = Math.max(s.y0, Math.min(y, s.y1));
      const d = Math.hypot(cx - x, cy - y, cz - z);
      if (d <= r) keys.set(key, d);
    });
    for (const r2 of world.ramps) if (r2.ref && r2.ref.build && !keys.has(r2.key) && Math.hypot((r2.x0 + r2.x1) / 2 - x, (r2.y0 + r2.y1) / 2 - y, (r2.z0 + r2.z1) / 2 - z) <= r + 2) keys.set(r2.key, 1);
    for (const [key, d] of keys) hit(key, dmg * (1 - 0.5 * d / (r + 2)), null, [x, y, z], false);
  };
  // les constructions durcissent pendant quelques secondes
  S.hooks.step = (dt) => {
    for (const p of pieces.values()) if (p.t < 1) { const g = dt / BUILD_TIME[p.mat]; p.t = Math.min(1, p.t + g); p.hp = Math.min(p.max, p.hp + p.max * 0.88 * g); }
  };
  // invités : la copie de la partie suit les constructions et les destructions décidées par l'hôte
  function mirrorAdd(p) {
    if (pieces.has(p.id) || broken.has('b:' + p.id)) return;
    const q = { ...p };
    pieces.set(q.id, q); bySlot.set(slotKey(q), q); addSolids(q);
    nextId = Math.max(nextId, q.id + 1);
  }
  function mirrorBreak(key) {
    if (broken.has(key)) return;
    broken.add(key);
    world.removeKey(key);
    if (key[0] === 'b') { const p = pieces.get(+key.slice(2)); if (p) { pieces.delete(p.id); bySlot.delete(slotKey(p)); } }
  }
  return { hit, place, slotFor, canPlace, pieces, broken, info, mirrorAdd, mirrorBreak };
}
export { floorY };
