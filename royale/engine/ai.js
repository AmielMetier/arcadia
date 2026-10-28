// Island Rush — les bots. Un bot lit la partie comme un joueur (ce qu'il voit, ce qu'il entend, la tempête, son sac)
// et écrit les mêmes commandes qu'un joueur dans P.inp : la simulation les traite pareil. Il saute de la
// montgolfière vers un lieu choisi, fouille coffres et butin, se soigne, suit la zone et se bat. Trois niveaux
// (facile, normal, difficile) : portée de vue, temps de réaction, précision et vitesse de visée. Les bots ne
// récoltent pas, mais ramassent des matériaux et posent un mur pour se couvrir quand on leur tire dessus. Moteur PUR, branché par sim.S.hooks.think ; ne tourne que là où la partie tourne.
import { createNav } from './nav.js';
import { makeRng, hash } from './rng.js';
import { WEAPONS, ITEMS } from './items.js';
import { COST } from './build.js';
import { STORM_TIMES } from './map.js';
import { PING_T } from './sim.js';

export const LEVELS = {
  facile: { see: 40, cone: 0.35, react: [0.75, 1.3], err: 0.085, lag: 0.24, adapt: 0.4, turn: 3.2, burst: [0.45, 0.75], head: 0.04, strafe: 0.35, hop: 0, nade: 0, push: 0.35, wall: 0.25 },
  normal: { see: 55, cone: 0.1, react: [0.42, 0.75], err: 0.05, lag: 0.16, adapt: 0.25, turn: 5.5, burst: [0.9, 0.4], head: 0.14, strafe: 0.7, hop: 0.12, nade: 0.5, push: 0.6, wall: 0.6 },
  difficile: { see: 80, cone: -0.25, react: [0.22, 0.42], err: 0.026, lag: 0.11, adapt: 0.18, turn: 9, burst: [1.6, 0.2], head: 0.3, strafe: 1, hop: 0.3, nade: 1, push: 0.85, wall: 0.9 },
};
const WSCORE = { fusil: 10, pompe: 9.5, smg: 8, sniper: 7, roquette: 6.5, pistolet: 4.5 };
const WANT_D = { pompe: 5, smg: 11, pistolet: 14, fusil: 24, sniper: 60, roquette: 22 };
// au-delà, on ne cherche pas la bagarre (on continue sa fouille ou sa route, sauf si on est pris pour cible)
const ENGAGE = { pompe: 18, smg: 32, pistolet: 32, fusil: 50, sniper: 110, roquette: 45 };
const ISCORE = { potion: 8, soin: 6, potion_petite: 5, bandage: 3, grenade: 2.5, souffle: 0.5, tremplin: 0.3 };
const RUN = 5.6;
// pas plus de bots à la fois sur un même combat entendu (plus pour un humain) ni sur un même largage
const HUNT_MAX = 2, HUNT_HUMAN = 3, DROP_MAX = 3;

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createAI(sim, map, world) {
  const S = sim.S;
  const nav = createNav(map, world);
  const queue = [];               // bots qui attendent un chemin (un calcul par pas)
  const claims = new Map();       // cible → bot qui y va
  let lastT = -1;

  // ------------------------------------------------------------------ outils
  const weaponFit = (w, d) => ({
    pompe: d < 9 ? 10 : d < 18 ? 4 : 0.5, smg: d < 25 ? 8 : d < 45 ? 5 : 2, fusil: d < 8 ? 6 : d < 70 ? 9 : 6,
    pistolet: d < 30 ? 5 : 3, sniper: d > 40 ? 11 : d > 18 ? 6 : 1, roquette: d > 9 && d < 60 ? 8 : d >= 60 ? 4 : 0,
  })[w];
  const usable = (P, it) => it && it.t === 'arme' && (it.mag > 0 || P.ammo[WEAPONS[it.w].ammo] > 0);
  const armed = (P) => P.inv.some((it) => usable(P, it));
  function bestSlot(P, d) {
    let best = 0, bs = 0, cur = 0;
    P.inv.forEach((it, i) => {
      if (!usable(P, it)) return;
      const s = weaponFit(it.w, d) * (1 + 0.15 * it.r) * (it.mag > 0 ? 1 : 0.4);
      if (i + 1 === P.sel) cur = s;
      if (s > bs) { bs = s; best = i + 1; }
    });
    // on garde l'arme en main si elle fait presque aussi bien (changer coûte un quart de seconde)
    return cur >= bs * 0.8 && cur > 0 ? P.sel : best;
  }
  const slotValue = (it) => (!it ? 0 : it.t === 'arme' ? WSCORE[it.w] * (1 + 0.18 * it.r) : ISCORE[it.c] || 0);
  function worstSlot(P) {
    let w = -1, ws = Infinity;
    P.inv.forEach((it, i) => { const v = slotValue(it); if (v < ws) { ws = v; w = i; } });
    return { i: w, v: ws };
  }
  // ce que vaut un objet au sol pour ce bot (0 : il n'en veut pas) ; swap : la case à libérer
  function want(P, it) {
    if (it.t === 'munitions') {
      const used = P.inv.some((s) => s && s.t === 'arme' && WEAPONS[s.w].ammo === it.a);
      return { v: used && P.ammo[it.a] < 90 ? 4 : 0 };
    }
    // des matériaux pour se couvrir d'un mur en combat (les bots ne récoltent pas à la pioche)
    if (it.t === 'materiaux') return { v: P.mats[it.m] < 60 ? 2.5 : 0 };
    const free = P.inv.some((s) => !s);
    let v;
    if (it.t === 'arme') {
      const same = P.inv.find((s) => s && s.t === 'arme' && s.w === it.w);
      // la même en mieux : le ramassage l'échange tout seul contre l'ancienne
      if (same) return { v: it.r > same.r ? (it.r - same.r) * 3 : 0 };
      const nW = P.inv.filter((s) => s && s.t === 'arme').length;
      v = WSCORE[it.w] * (1 + 0.18 * it.r) * (nW === 0 ? 2 : 1);
      if (nW >= 3) {
        let wi = -1, wv = Infinity;
        P.inv.forEach((s, i) => { if (s && s.t === 'arme' && slotValue(s) < wv) { wv = slotValue(s); wi = i; } });
        return v > wv + 2 ? { v: v - wv, swap: wi } : { v: 0 };
      }
    } else {
      const I = ITEMS[it.c];
      const stack = P.inv.find((s) => s && s.t === 'objet' && s.c === it.c && s.n < I.stack);
      v = ISCORE[it.c] || 0;
      if (I.shield && P.sh >= (I.maxShield || 100) && P.inv.some((s) => s && s.c === it.c)) v *= 0.4;
      if (stack) return { v };
    }
    if (free) return { v };
    const w = worstSlot(P);
    return v > w.v + 2 ? { v: v - w.v, swap: w.i } : { v: 0 };
  }
  function needHeal(P) {
    for (let i = 0; i < 5; i++) {
      const it = P.inv[i];
      if (!it || it.t !== 'objet') continue;
      const I = ITEMS[it.c];
      if (I.heal && P.hp < Math.min(I.max, 100) - 15 && P.hp < 80) return i + 1;
      if (I.shield && P.sh < I.maxShield - 20) return i + 1;
    }
    return 0;
  }
  function stormDanger(P) {
    const st = S.storm;
    if (!st || !st.cur) return 0;
    const dc = Math.hypot(P.x - st.cur.x, P.z - st.cur.z), dn = Math.hypot(P.x - st.next.x, P.z - st.next.z);
    if (dc > st.cur.r - 4) return 2;
    if (st.state === 'fermeture' && dn > st.next.r - 5) return 2;
    if (st.state === 'attente' && dn > st.next.r - 5) { const need = (dn - st.next.r * 0.6) / RUN + 12; if (st.left < need) return 1; }
    return 0;
  }

  // ------------------------------------------------------------------ montgolfière : où sauter
  const dropCount = new Map(), dropPts = [];
  function chooseDrop(P, B) {
    const f = S.flight, cands = [];
    // déjà visé tout près par d'autres bots : moins tentant (on se répartit sur l'île au lieu de s'empiler)
    const crowd = (x, z) => dropPts.reduce((n, q) => n + (Math.hypot(q.x - x, q.z - z) < 60 ? 1 : 0), 0);
    const lineD = (x, z) => Math.abs((x - f.x0) * f.uz - (z - f.z0) * f.ux);
    for (const b of map.buildings) {
      if (!b.chests.length && B.rng.next() < 0.6) continue;
      const d = b.doors.find((q) => q.ext && q.k === 0);
      if (!d) continue;
      const x = (d.o === 'h' ? (d.x + 0.5) * 4 : d.x * 4) + d.nx * 4, z = (d.o === 'h' ? d.z * 4 : (d.z + 0.5) * 4) + d.nz * 4;
      // à portée de vol plané de la ligne de la montgolfière, et pas tous au même endroit
      if (lineD(x, z) > 320) continue;
      const w = (b.chests.length + 1) / (1 + (dropCount.get(b.id) || 0) * 4 + crowd(x, z) * 3);
      cands.push([{ x, z, b: b.id }, w]);
    }
    for (const c of map.chests) if (c.b < 0 && lineD(c.x, c.z) < 320) cands.push([{ x: c.x + 2, z: c.z + 2, b: -1 }, 0.8 / (1 + crowd(c.x, c.z) * 3)]);
    if (!cands.length) return { x: map.center, z: map.center };
    const pick = B.rng.weighted(cands);
    dropCount.set(pick.b, (dropCount.get(pick.b) || 0) + 1);
    dropPts.push(pick);
    return pick;
  }

  // quelques bots (un tiers, 5 au plus) suivent un joueur : pendant qu'il est en l'air, ils visent l'un des bâtiments les plus
  // proches de l'endroit où il va se poser (combats dès l'atterrissage, sans mêlée géante autour de lui)
  const FOLLOW_MAX = 5;
  let followers = 0;
  const doorPts = [];
  for (const b of map.buildings) {
    const d = b.doors.find((q) => q.ext && q.k === 0);
    if (d) doorPts.push({ x: (d.o === 'h' ? (d.x + 0.5) * 4 : d.x * 4) + d.nx * 4, z: (d.o === 'h' ? d.z * 4 : (d.z + 0.5) * 4) + d.nz * 4, b: b.id });
  }
  function followDrop(P, B) {
    const H = S.players.get(B.follow);
    if (!H || !H.alive || (H.mode !== 'chute' && H.mode !== 'planeur')) return null;
    const lead = H.mode === 'chute' ? 6 : 3, x = H.x + H.vx * lead, z = H.z + H.vz * lead;
    const near = doorPts.map((q) => [q, Math.hypot(q.x - x, q.z - z)]).filter((a) => a[1] < 130).sort((a, b) => a[1] - b[1]).slice(0, 4);
    if (!near.length) return { x: x + (B.rng.next() - 0.5) * 50, z: z + (B.rng.next() - 0.5) * 50, b: -1 };
    if (!B.followPick || !near.some((a) => a[0] === B.followPick)) B.followPick = near[Math.floor(B.rng.next() * near.length)][0];
    return B.followPick;
  }

  // ------------------------------------------------------------------ chemins
  function setGoal(P, B, g) {
    B.goal = g; B.path = null; B.wp = 0; B.stuckN = 0;
    if (g) { g.tries = 0; g.since = S.t; askPath(P, B); }
  }
  function askPath(P, B) { if (!B.waiting) { B.waiting = true; queue.push(P); } }
  function plan(P) {
    const B = P.ai;
    B.waiting = false;
    const g = B.goal;
    if (!g || !P.alive) return;
    const hd = Math.hypot(g.x - P.x, g.z - P.z);
    // loin d'une cible en étage : on vise d'abord le pied du bâtiment
    const high = g.y != null && g.y - nav.stand0(g.x, g.z) > 2;
    const to = hd > 40 && high ? { x: g.x, y: nav.stand0(g.x, g.z), z: g.z } : { x: g.x, y: g.y != null ? g.y + 0.2 : nav.stand0(g.x, g.z), z: g.z };
    B.approach = to.y !== (g.y != null ? g.y + 0.2 : to.y);
    // but lointain (rotation, zone) : un chemin partiel suffit, repris en route ; ça évite les à-coups (60 bots). Après un
    // blocage (voir unstick), on cherche bien plus loin : le chemin partiel menait au pied d'une pente ou d'un mur
    const p = nav.path({ x: P.x, y: P.y, z: P.z }, to, B.big ? 40000 : hd > 120 ? 4500 : 9000);
    B.big = false;
    // parti de l'eau, d'une pente trop raide ou d'un rebord : on rejoint d'abord l'endroit praticable le plus proche
    if (p.fail === 'depart') { B.path = null; B.escape = escapeFrom(P, B); B.direct = B.escape.until; return; }
    if (p.fail) { ban(B, g); B.goal = null; return; }
    B.path = p.pts; B.wp = 1; B.partial = !p.reached; B.escape = null;
    if (!p.reached && hd < 30 && !B.approach) { ban(B, g); B.goal = null; B.path = null; }
  }
  // l'endroit praticable (pour la grille des chemins) le plus proche, à rejoindre tout droit ; à défaut, vers le bas de la pente
  function escapeFrom(P, B) {
    for (let r = 1; r <= 14; r += 1.5) {
      const a0 = B.rng.next() * Math.PI * 2;
      for (let k = 0; k < 16; k++) {
        const a = a0 + k * Math.PI / 8, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
        if (nav.free(x, P.y, z)) return { x, z, until: S.t + 3 };
      }
    }
    const sl = world.slope ? world.slope(P.x, P.z, P.y) : null, g = sl ? Math.hypot(sl[0], sl[1]) : 0;
    return g > 0.05 ? { x: P.x - sl[0] / g * 8, z: P.z - sl[1] / g * 8, until: S.t + 3 } : { x: P.x + (B.rng.next() - 0.5) * 12, z: P.z + (B.rng.next() - 0.5) * 12, until: S.t + 3 };
  }
  // un point libre à portée (rMin à rMax mètres), qu'on voit et qu'on peut rejoindre tout droit : pour un détour
  function freeAround(P, B, rMin, rMax) {
    for (let k = 0; k < 20; k++) {
      const a = B.rng.next() * Math.PI * 2, r = rMin + B.rng.next() * (rMax - rMin), dx = Math.cos(a), dz = Math.sin(a);
      const x = P.x + dx * r, z = P.z + dz * r;
      if (!nav.free(x, P.y, z) || world.ray(P.x, P.y + 1, P.z, dx, 0, dz, r, 0.3) < r - 0.5) continue;
      return { x, z };
    }
    return null;
  }
  // un point praticable à 25-60 m, plutôt vers le bas de la pente et dans le cercle : un détour par là (une poche à flanc de
  // montagne, un recoin) permet souvent de trouver ensuite le chemin du but
  function detourPoint(P, B) {
    const sl = world.slope ? world.slope(P.x, P.z, P.y) : null, g = sl ? Math.hypot(sl[0], sl[1]) : 0, st = S.storm;
    const down = g > 0.1 ? Math.atan2(-sl[1], -sl[0]) : null;
    for (let k = 0; k < 24; k++) {
      const a = down != null && k < 12 ? down + (B.rng.next() - 0.5) * 1.6 : B.rng.next() * Math.PI * 2, r = 25 + B.rng.next() * 35;
      const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      if (st && st.cur && Math.hypot(x - st.cur.x, z - st.cur.z) > st.cur.r - 5) continue;
      if (nav.free(x, nav.stand0(x, z), z)) return { x, z };
    }
    return null;
  }
  // on veut avancer mais on reste sur place depuis 10 s (pente, socle, rebord, obstacle que la grille croit franchissable),
  // quel que soit le but : on bouche devant soi et on cherche un chemin bien plus long, puis on fait un détour par un endroit
  // praticable, puis on s'en va tout droit (en sautant), puis on renonce à ce but
  function unstick(P, B) {
    const n = B.unstuck = (B.unstuck || 0) + 1;
    if (n === 1) {
      const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw);
      nav.expire(S.t);
      for (const k of [0.6, 1.1, 1.6]) nav.block(P.x + fx * k, P.y, P.z + fz * k, 30, S.t);
      B.big = true; B.path = null; askPath(P, B);
    } else if (n === 2) {
      const d = detourPoint(P, B);
      if (d) setGoal(P, B, { kind: 'detour', id: null, x: d.x, z: d.z, r: 4 });
      else B.unstuck++;
    }
    if (B.unstuck === 3) {
      const e = freeAround(P, B, 6, 15) || escapeFrom(P, B);
      B.escape = { x: e.x, z: e.z, until: S.t + 4 }; B.direct = S.t + 4; B.path = null; P.inp.jump++;
    } else if (B.unstuck >= 4) {
      if (B.goal) ban(B, B.goal);
      B.goal = null; B.path = null; B.escape = null; B.unstuck = 0; B.decideT = 0;
      if (B.state === 'zone') B.state = 'go';
    }
  }
  const keyOfGoal = (g) => g.kind + ':' + g.id;
  // combien d'autres bots se dirigent vers ce but (un combat entendu, un largage)
  function heading(P, kind, id) {
    let n = 0;
    for (const Q of S.players.values()) if (Q !== P && Q.alive && Q.ai && Q.ai.goal && Q.ai.goal.kind === kind && Q.ai.goal.id === id) n++;
    return n;
  }
  // un autre bot (pas un coéquipier) se dirige-t-il vers un point à moins de r mètres de (x, z) ?
  function bound(P, x, z, r) {
    for (const Q of S.players.values()) {
      const g = Q !== P && Q.alive && Q.ai && !sim.mates(P, Q) && Q.ai.goal;
      if (g && Math.abs(g.x - x) < r && Math.abs(g.z - z) < r) return true;
    }
    return false;
  }
  // combien d'adversaires debout à moins de r mètres de (x, z)
  function others(P, x, z, r) {
    let n = 0;
    for (const Q of S.players.values()) if (Q !== P && Q.alive && Q.mode === 'sol' && !sim.mates(P, Q) && Math.abs(Q.x - x) < r && Math.abs(Q.z - z) < r && Math.hypot(Q.x - x, Q.z - z) < r) n++;
    return n;
  }
  function ban(B, g, sec = 40) { if (g && g.id != null) B.ban.set(keyOfGoal(g), S.t + sec); }
  const banned = (B, k) => { const t = B.ban.get(k); return t != null && t > S.t; };
  function claimed(P, k) { const c = claims.get(k); return c && c.id !== P.id && c.until > S.t && S.players.get(c.id) && S.players.get(c.id).alive; }

  // ------------------------------------------------------------------ choix d'une cible de fouille
  function pickLoot(P, B, range = 1) {
    let best = null, bs = 0;
    const consider = (g, v, d) => {
      const k = keyOfGoal(g);
      if (v <= 0 || banned(B, k) || claimed(P, k)) return;
      let s = v / (d + 6);
      // déjà du monde sur place (le butin d'un éliminé, un coffre disputé, la même maison) : on va plutôt ailleurs
      if (s > bs) s /= 1 + 3 * others(P, g.x, g.z, 14);
      if (s > bs) { bs = s; best = g; }
    };
    const ammoLow = P.inv.some((s) => s && s.t === 'arme' && P.ammo[WEAPONS[s.w].ammo] < 30);
    for (const c of S.chests.values()) {
      if (c.open) continue;
      const d = Math.hypot(c.x - P.x, c.z - P.z) + Math.abs(c.y - P.y) * 2;
      if (d > 60 * range) continue;
      consider({ kind: 'coffre', id: c.id, x: c.x, y: c.y, z: c.z }, c.kind === 'coffre' ? 10 : ammoLow ? 5 : 1, d);
    }
    for (const g of S.items.values()) {
      const d = Math.hypot(g.x - P.x, g.z - P.z) + Math.abs(g.y - P.y) * 2;
      if (d > 38 * range) continue;
      const w = want(P, g.it);
      consider({ kind: g.it.t === 'munitions' || g.it.t === 'materiaux' ? 'tas' : 'objet', id: g.id, x: g.x, y: g.y, z: g.z, swap: w.swap }, w.v, d);
    }
    if (best) claims.set(keyOfGoal(best), { id: P.id, until: S.t + 25 });
    // un largage posé attire de loin (170 m), et plusieurs bots peuvent s'y rendre : c'est là que ça se bat
    for (const d of S.drops.values()) {
      if (!d.landed || d.open || banned(B, 'largage:' + d.id)) continue;
      if (heading(P, 'largage', d.id) >= DROP_MAX) continue;
      const dd = Math.hypot(d.x - P.x, d.z - P.z) + Math.abs(d.gy - P.y) * 2;
      if (dd < 170 && 30 / (dd + 6) > bs) { bs = 30 / (dd + 6); best = { kind: 'largage', id: d.id, x: d.x, y: d.gy, z: d.z }; }
    }
    return best;
  }
  // un point sûr dans le prochain cercle (ou une maison à fouiller dedans)
  function zonePoint(P, B, roam) {
    const st = S.storm;
    const c = st ? st.next : { x: map.center, z: map.center, r: map.islandR * 0.6 };
    if (roam) {
      const bs = map.buildings.filter((b) => Math.hypot((b.x0 + b.w / 2) * 4 - c.x, (b.z0 + b.d / 2) * 4 - c.z) < c.r * 0.8);
      if (bs.length) {
        const b = B.rng.pick(bs), d = b.doors.find((q) => q.ext && q.k === 0);
        if (d) return { kind: 'roam', id: 'b' + b.id, x: (d.o === 'h' ? (d.x + 0.5) * 4 : d.x * 4) - d.nx * 2, z: (d.o === 'h' ? d.z * 4 : (d.z + 0.5) * 4) - d.nz * 2, r: 2 };
      }
    }
    // un point libre, loin des autres et de là où vont les autres bots (sinon ils y marchent en colonne)
    let fallback = null;
    for (let i = 0; i < 12; i++) {
      let dx = P.x - c.x, dz = P.z - c.z;
      const l = Math.hypot(dx, dz) || 1;
      const a = Math.atan2(dz / l, dx / l) + (B.rng.next() - 0.5) * (i < 4 ? 0.8 : 3), rr = c.r * (0.25 + B.rng.next() * 0.4);
      const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
      if (!nav.free(x, nav.stand0(x, z), z)) continue;
      const g = { kind: roam ? 'roam' : 'zone', id: null, x, z, r: 3 };
      if (others(P, x, z, 18) || bound(P, x, z, 18)) { fallback = fallback || g; continue; }
      return g;
    }
    return fallback || { kind: 'zone', id: null, x: c.x, z: c.z, r: 3 };
  }

  // rythme de la partie (« directeur ») : part des joueurs encore en vie visée à la fin de chaque phase de la tempête
  // (≈ 10 min en tout). Entre bots, l'envie de se battre monte quand il reste plus de monde que prévu et retombe quand il
  // en reste moins ; un humain est toujours engagé. Recalculé une fois par seconde.
  const SHARE = [0.75, 0.5, 0.32, 0.18, 0.1, 0.05];
  let pace = null;
  function target(t) {
    if (!pace) {
      pace = [[0, 1], [60, 0.95]];
      let at = S.storm ? S.storm.t0 : 30;
      SHARE.forEach((v, k) => { const P = STORM_TIMES[Math.min(k, STORM_TIMES.length - 1)]; at += P.wait + P.shrink; pace.push([at, v]); });
      pace.push([at + 20, 0]);
    }
    for (let i = 1; i < pace.length; i++) if (t < pace[i][0]) { const [t0, a] = pace[i - 1], [t1, b] = pace[i]; return a + (b - a) * (t - t0) / (t1 - t0); }
    return 0;
  }
  let aggT = -9, aggV = 0.3;
  const agg = () => {
    if (S.t - aggT < 1) return aggV;
    aggT = S.t;
    const n = S.players.size, live = sim.alive().length, want = Math.max(1, target(S.t) * n);
    aggV = clamp(0.25 + (live - want) / Math.max(4, n * 0.1), 0.04, 1);
    return aggV;
  };
  // un bot en voit un autre : à moins de 30 m (10 m tant qu'on s'équipe), il l'engage, comme un joueur (deux bots ne restent
  // pas à se regarder). Plus loin, il choisit ses combats selon le rythme de la partie (voir agg) : sinon il le laisse un temps
  function wants(P, B, Q, hurt, d) {
    if (hurt || !Q.bot || d < (geared(P, B) ? 30 : 10)) return true;
    const u = B.ignore.get(Q.id);
    if (u != null && u > S.t) return false;
    if (B.rng.next() < agg()) return true;
    B.ignore.set(Q.id, S.t + 10);
    return false;
  }
  // ------------------------------------------------------------------ perception
  function perceive(P, B) {
    const e = sim.eye(P), fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), lv = B.lv;
    const cands = [];
    for (const Q of S.players.values()) {
      if (Q === P || !Q.alive || Q.mode === 'ballon' || sim.mates(P, Q)) continue;
      const dx = Q.x - P.x, dz = Q.z - P.z, d = Math.hypot(dx, dz);
      if (Q.down && d > 30) continue; // à terre et loin : pas la peine (ses coéquipiers, debout, sont la menace)
      if (d > Math.max(lv.see, 110) && !(P.hitBy === Q.id && S.t - (P.hitT || -9) < 1.5)) continue;
      if (d > lv.see && !(Q.shotT != null && S.t - Q.shotT < 1.2) && !(P.hitBy === Q.id && S.t - (P.hitT || -9) < 1.5)) continue;
      const front = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      // on entend les coups de feu de loin, et quelqu'un qui court tout près (même dans son dos)
      const heard = (Q.shotT != null && S.t - Q.shotT < 1.2 && d < 110) || (d < 15 && Q.mode === 'sol' && Math.hypot(Q.vx, Q.vz) > 4.5);
      const hurt = P.hitBy === Q.id && S.t - (P.hitT || -9) < 1.5;
      if (d < 12 || front > lv.cone || heard || hurt) cands.push({ Q, d, hurt, heard });
    }
    // ceux qui tiennent debout d'abord : un ennemi à terre ne menace plus (on l'achève quand plus personne n'est en vue)
    cands.sort((a, b) => a.d + (a.Q.down ? 45 : 0) - b.d - (b.Q.down ? 45 : 0));
    let seen = null;
    for (const c of cands.slice(0, 3)) {
      const Q = c.Q, ty = Q.y + (Q.crouch ? 0.85 : 1.3), dx = Q.x - e[0], dy = ty - e[1], dz = Q.z - e[2], L = Math.hypot(dx, dy, dz);
      const h = world.raycast(e[0], e[1], e[2], dx / L, dy / L, dz / L, L);
      if (h.t >= L - 0.5) { if ((B.enemy === Q.id && !Q.down) || wants(P, B, Q, c.hurt, c.d)) { seen = c; break; } }
    }
    if (seen) {
      if (B.enemy !== seen.Q.id) {
        B.enemy = seen.Q.id; B.react = lv.react[0] + B.rng.next() * (lv.react[1] - lv.react[0]); B.track = 0; B.tvx = 0; B.tvy = 0; B.tvz = 0; B.sneak = false; B.sneakT = S.t;
        if (!seen.Q.down) callOut(P, B, seen.Q);
      }
      B.visible = true; B.seenT = S.t; B.last = { x: seen.Q.x, y: seen.Q.y, z: seen.Q.z };
      return;
    }
    B.visible = false;
    // touché ou entendu sans voir : on se tourne par là
    const alert = cands.find((c) => c.hurt || (c.heard && !(B.ignore.get(c.Q.id) > S.t)));
    if (alert && (B.enemy == null || B.enemy === alert.Q.id || S.t - B.seenT > 3)) {
      if (B.enemy !== alert.Q.id) { B.enemy = alert.Q.id; B.react = lv.react[1]; B.track = 0; B.seenT = S.t; B.tvx = 0; B.tvy = 0; B.tvz = 0; B.sneakT = S.t; }
      B.last = { x: alert.Q.x, y: alert.Q.y, z: alert.Q.z };
    }
    if (B.enemy != null && S.t - B.seenT > 6) B.enemy = null;
  }

  // ------------------------------------------------------------------ décision (deux fois par seconde)
  function decide(P, B) {
    if (P.revive) return; // on relève un coéquipier : on ne bouge pas
    // (l'hôte du salon a l'identifiant 0 : on teste toujours != null, jamais la valeur elle-même)
    const E = B.enemy != null ? S.players.get(B.enemy) : null;
    const danger = stormDanger(P), gun = armed(P);
    // équipes : un coéquipier à terre pas trop loin, et pas d'ennemi en vue tout près : on va le relever
    if (S.teams > 1 && danger < 2) {
      const down = [...S.players.values()].filter((Q) => Q.alive && Q.down && sim.mates(P, Q)).map((Q) => [Q, Math.hypot(Q.x - P.x, Q.z - P.z)]).filter(([, d]) => d < 130).sort((a, b) => a[1] - b[1])[0];
      const close = E && E.alive && B.visible && Math.hypot(E.x - P.x, E.z - P.z) < 22;
      if (down && !close) {
        B.state = 'go'; B.enemy = close ? B.enemy : null;
        if (!B.goal || B.goal.kind !== 'releve' || B.goal.id !== down[0].id) setGoal(P, B, { kind: 'releve', id: down[0].id, x: down[0].x, y: down[0].y, z: down[0].z, r: 1.6 });
        return;
      }
    }
    if (E && E.alive) {
      const d = Math.hypot(E.x - P.x, E.z - P.z);
      let reach = 0;
      for (const it of P.inv) if (usable(P, it)) reach = Math.max(reach, ENGAGE[it.w]);
      const hunted = S.t - (P.hitT || -9) < 4 && P.hitBy === E.id;
      // comme un joueur : tant qu'on s'équipe, on ne cherche pas la bagarre de loin (mais on se défend, et un joueur
      // croisé de près est engagé) ; une fois équipé, on va au combat
      if (!geared(P, B)) reach *= E.bot ? 0.55 : 0.85;
      // contre un bot lointain, on ne cherche la bagarre que si la partie le demande ; à moins de 30 m, toujours
      if (E.bot && d > 30) reach *= agg();
      // un combat commencé continue tant qu'on a vu l'ennemi il y a moins de 4 s (on ne l'« oublie » pas en route), sauf à
      // bout de forces : on se met à couvert pour se soigner (voir plus bas), comme un joueur
      const low = P.hp + P.sh < 35 && needHeal(P) && S.t - (P.hitT || -9) > 1.5;
      const sticky = B.state === 'fight' && S.t - B.seenT < 4 && !low;
      // sans arme : à la pelle, si on l'attaque ou si un joueur vient tout près
      if ((gun && (d < reach || hunted || sticky) && (danger < 2 || d < 25)) || (!gun && B.visible && ((hunted && d < 5) || d < (E.bot ? 4 : 6)))) { B.state = 'fight'; return; }
      // entendu sans le voir : armé et en forme, on va voir (on pousse vers les coups de feu)
      if (gun && (!E.bot || (geared(P, B) && B.rng.next() < agg())) && !B.visible && B.last && P.hp + P.sh > 70 && d < 110 && danger < 2 && (!B.goal || B.goal.kind !== 'chasse')
        && heading(P, 'chasse', E.id) < (E.bot ? HUNT_MAX : HUNT_HUMAN)) {
        B.state = 'go'; setGoal(P, B, { kind: 'chasse', id: E.id, x: B.last.x, z: B.last.z, r: 4 }); return;
      }
      if (B.goal && B.goal.kind === 'chasse' && danger < 2) return;
    } else B.enemy = null;
    // repère tout neuf d'un joueur de l'équipe : on y va (ici, largage), ou l'on s'occupe de l'ennemi désigné
    const pg = S.teams > 1 ? humanPing(P) : null;
    if (pg && pg.t > (B.pingSeen || -99) && danger < 2) {
      B.pingSeen = pg.t;
      const T = pg.kind === 'ennemi' && pg.target != null ? S.players.get(pg.target) : null;
      if (T && T.alive && !sim.mates(P, T) && gun) {
        B.enemy = T.id; B.last = { x: T.x, y: T.y, z: T.z }; B.seenT = S.t; B.react = B.lv.react[1];
        B.state = 'go'; setGoal(P, B, { kind: 'chasse', id: T.id, x: T.x, z: T.z, r: 4 });
        return;
      }
      if (pg.kind === 'ici' || pg.kind === 'largage') { B.state = 'go'; setGoal(P, B, { kind: 'repere', id: null, x: pg.x, z: pg.z, r: 5 }); return; }
    }
    if (B.goal && B.goal.kind === 'repere' && S.t - B.goal.since < 25 && danger < 2) return;
    // équipes : on ne laisse pas son chef derrière (la tempête ne passe devant que si on y est déjà)
    const L = leaderOf(P, B);
    if (L && L.alive && L.mode === 'sol' && danger < 2 && Math.hypot(L.x - P.x, L.z - P.z) > 35) {
      if (!B.goal || B.goal.kind !== 'escorte' || Math.hypot(B.goal.x - L.x, B.goal.z - L.z) > 12) setGoal(P, B, { kind: 'escorte', id: null, x: L.x, z: L.z, r: 8 });
      B.state = 'go';
      return;
    }
    // en route vers la zone : on va jusqu'à être bien dedans (sinon on fait demi-tour pour un objet, on repart, et ainsi de suite)
    const st = S.storm, hold = B.state === 'zone' && B.goal && st && st.next && Math.hypot(P.x - st.next.x, P.z - st.next.z) > st.next.r * 0.75;
    if (danger || hold) {
      if (B.state !== 'zone' || !B.goal) { B.state = 'zone'; setGoal(P, B, zonePoint(P, B, false)); }
      return;
    }
    const h = needHeal(P);
    if (h && S.t - (P.hitT || -9) > 2.5 && (!E || !B.visible || P.hp + P.sh < 40)) { B.state = 'heal'; B.healSlot = h; return; }
    if (B.state === 'fight' || B.state === 'heal' || B.state === 'zone') { B.state = 'go'; B.goal = null; }
    if (B.goal && B.goal.kind !== 'roam' && B.goal.kind !== 'zone' && B.goal.kind !== 'rota' && S.t - B.goal.since < 40) return;
    // début de partie : on fouille et on se protège ; une fois équipé, on ne ramasse plus que ce qui est tout près
    const ready = geared(P, B);
    const g = pickLoot(P, B, ready ? 0.45 : 1);
    if (g) { B.state = 'go'; setGoal(P, B, g); return; }
    if (ready) {
      // équipé : on va là où ça tire (on entend les combats de loin), sinon on tourne vers le prochain cercle
      const fight = heardFight(P, B);
      if (fight) { B.state = 'go'; setGoal(P, B, { kind: 'chasse', id: fight.id, x: fight.x, z: fight.z, r: 6 }); return; }
      if (!B.goal || (B.goal.kind === 'roam' && S.t - B.goal.since > 25)) { B.state = 'go'; setGoal(P, B, { ...zonePoint(P, B, false), kind: 'rota' }); }
      return;
    }
    if (!B.goal) { B.state = 'go'; setGoal(P, B, zonePoint(P, B, true)); }
  }
  // équipé : une arme chargée et de quoi tirer, un bouclier (ou plus rien pour en mettre), ou déjà deux minutes au sol
  function geared(P, B) {
    const gun = P.inv.some((it) => it && it.t === 'arme' && WEAPONS[it.w] && (it.mag > 0 || P.ammo[WEAPONS[it.w].ammo] > 0));
    if (!gun) return false;
    const shieldLeft = P.inv.some((it) => it && it.t === 'objet' && ITEMS[it.c] && ITEMS[it.c].shield);
    const guns = P.inv.filter((it) => it && it.t === 'arme').length;
    return S.t - (B.landT || 0) > 120 || (P.sh >= 50 && guns >= 2) || P.sh >= 75 || (!shieldLeft && guns >= 2 && S.t - (B.landT || 0) > 60);
  }
  // un combat qu'on entend (des tirs depuis moins de 6 s, à moins de 160 m, hors tempête) : le plus proche
  function heardFight(P, B) {
    let best = null, bd = 160 * agg();
    for (const Q of S.players.values()) {
      if (Q === P || !Q.alive || Q.mode !== 'sol' || Q.shotT == null || S.t - Q.shotT > 6 || sim.mates(P, Q)) continue;
      const d = Math.hypot(Q.x - P.x, Q.z - P.z);
      if (d < bd && stormDanger(Q) < 2 && heading(P, 'chasse', Q.id) < (Q.bot ? HUNT_MAX : HUNT_HUMAN)) { bd = d; best = Q; }
    }
    return best && B.rng.next() < B.lv.push ? best : null;
  }

  // ------------------------------------------------------------------ actions
  function turn(B, yaw, pitch, rate) {
    const dy = wrap(yaw - B.yaw), dp = pitch - B.pitch;
    B.yaw = wrap(B.yaw + clamp(dy, -rate, rate));
    B.pitch += clamp(dp, -rate * 0.7, rate * 0.7);
  }
  function face(B, x, z, dt, P) { turn(B, Math.atan2(x - P.x, z - P.z), -0.15, 10 * dt); }
  // avance le long du chemin ; renvoie la direction voulue (monde) ou null (arrivé / rien à faire)
  function travel(P, B, dt) {
    const g = B.goal, I = P.inp;
    if (!g) return null;
    const hd = Math.hypot(g.x - P.x, g.z - P.z), dy = g.y != null ? Math.abs(g.y - P.y) : 0;
    if (hd < (g.r || 1.4) && dy < 1.6) { arrive(P, B, dt); return null; }
    if (S.t - g.since > 90) { ban(B, g); B.goal = null; return null; }
    let tx = g.x, tz = g.z;
    if (B.path) {
      let w = B.path[B.wp];
      while (w && Math.hypot(w.x - P.x, w.z - P.z) < 0.8 && (w.y == null || Math.abs(P.y - w.y) < 1.3)) w = B.path[++B.wp];
      if (!w) { B.path = null; if (B.partial || B.approach || hd > 3) askPath(P, B); }
      else { tx = w.x; tz = w.z; }
    } else if (!B.waiting && hd > 3 && S.t > (B.direct || 0)) askPath(P, B);
    // on se dégage (pente trop raide, rebord, détour) : tout droit vers l'endroit choisi, puis on reprend le chemin
    if (B.escape) {
      if (S.t < B.escape.until && Math.hypot(B.escape.x - P.x, B.escape.z - P.z) > 0.8) { tx = B.escape.x; tz = B.escape.z; }
      else { B.escape = null; B.direct = 0; if (!B.path) askPath(P, B); }
    }
    const dx = tx - P.x, dz = tz - P.z, l = Math.hypot(dx, dz) || 1;
    // portes fermées sur le passage : on les ouvre
    if (S.t - B.useT > 0.6) {
      const d = world.doorNear(P.x, P.y, P.z, dx / l, dz / l, 1.9);
      if (d && !d.open && !d.dead) { B.yaw = Math.atan2(d.cx - P.x, d.cz - P.z); I.use++; B.useT = S.t; }
    }
    I.sprint = hd > 8 && B.enemy == null;
    // on va voir des coups de feu : les 25 derniers mètres accroupi, sans bruit de pas
    if (g.kind === 'chasse' && hd < 25 && B.enemy != null) I.crouch = true;
    return { x: dx / l, z: dz / l };
  }
  function arrive(P, B, dt) {
    const g = B.goal, I = P.inp;
    const done = () => { claims.delete(keyOfGoal(g)); B.goal = null; B.decideT = 0; };
    if (g.kind === 'releve') {
      // à côté du coéquipier : E, puis on reste immobile jusqu'à ce qu'il soit debout
      const Q = S.players.get(g.id);
      if (!Q || !Q.alive || !Q.down) { if (!P.revive) done(); return; }
      if (Math.hypot(Q.x - P.x, Q.z - P.z) > 2) { g.x = Q.x; g.z = Q.z; g.y = Q.y; B.path = null; askPath(P, B); return; }
      face(B, Q.x, Q.z, dt, P);
      if (!P.revive && S.t - B.useT > 0.6) { I.use++; B.useT = S.t; if (++g.tries > 6) { ban(B, g, 10); done(); } }
      return;
    }
    if (g.kind === 'coffre' || g.kind === 'largage') {
      const c = g.kind === 'coffre' ? S.chests.get(g.id) : S.drops.get(g.id);
      if (!c || c.open) return done();
      face(B, c.x, c.z, dt, P);
      if (S.t - B.useT > 0.45 && Math.abs(wrap(Math.atan2(c.x - P.x, c.z - P.z) - B.yaw)) < 0.5) { I.use++; B.useT = S.t; if (++g.tries > 5) { ban(B, g); done(); } }
      return;
    }
    if (g.kind === 'objet') {
      const it = S.items.get(g.id);
      if (!it) return done();
      const w = want(P, it.it);
      if (w.v <= 0) { ban(B, g, 60); return done(); }
      if (w.swap != null) {
        // échange : la case à libérer en main ; sac plein, le ramassage échange ; sinon on lâche l'ancienne d'abord
        I.sel = w.swap + 1;
        if (P.sel !== w.swap + 1 || P.cd > 0) return;
        if (!P.inv.every(Boolean) && P.inv[w.swap]) { if (S.t - B.useT > 0.3) { I.drop++; B.useT = S.t; } return; }
      }
      face(B, it.x, it.z, dt, P);
      if (S.t - B.useT > 0.45) { I.use++; B.useT = S.t; if (++g.tries > 5) { ban(B, g); done(); } }
      return;
    }
    if (g.kind === 'tas') {
      // munitions : ramassées en marchant dessus
      const it = S.items.get(g.id);
      if (!it) return done();
      g.r = 0.5;
      if (++g.tries > 120) { ban(B, g); done(); }
      return;
    }
    done();
  }
  function heal(P, B, dt) {
    const I = P.inp, slot = needHeal(P);
    if (!slot) { B.state = 'go'; B.decideT = 0; return null; }
    I.sel = slot;
    if (P.sel === slot) I.fire = true;
    I.crouch = B.lv.hop > 0;
    return null;
  }
  // l'ennemi nous a-t-il repérés ? Un bot qui nous a pour cible et nous voit ; un joueur tourné vers nous ou qui vient de
  // nous toucher. Tirer trahit sa position (quelques secondes)
  function spotted(P, E, d) {
    if (S.t - (P.shotT != null ? P.shotT : -9) < 4 || (P.hitBy === E.id && S.t - (P.hitT || -9) < 4)) return true;
    if (E.bot) return !!E.ai && E.ai.enemy === P.id && E.ai.visible;
    return d < 12 || (d < 90 && ((P.x - E.x) * Math.sin(E.yaw) + (P.z - E.z) * Math.cos(E.yaw)) / d > 0.7);
  }
  function fight(P, B, dt) {
    const I = P.inp, lv = B.lv, E = S.players.get(B.enemy);
    if (!E || !E.alive) { B.enemy = null; B.state = 'go'; B.decideT = 0; return null; }
    const e = sim.eye(P), dx = E.x - P.x, dz = E.z - P.z, d = Math.hypot(dx, dz) || 0.01;
    const slot = bestSlot(P, d);
    // une grenade de temps en temps (moyenne distance)
    if (B.nade) {
      I.sel = B.nade.slot;
      const it = P.inv[B.nade.slot - 1];
      if (!it || it.c !== 'grenade' || S.t - B.nade.t > 2) B.nade = null;
      else if (P.sel === B.nade.slot && P.cd <= 0) {
        const th = 0.5 * Math.asin(clamp(d * 22 / 484, 0, 1));
        turn(B, Math.atan2(dx, dz), th - 0.18, 12 * dt);
        if (Math.abs(B.pitch - (th - 0.18)) < 0.05) { I.shoot++; B.nade = null; B.nadeT = S.t; }
        return null;
      }
      return null;
    }
    I.sel = slot;
    const it = slot ? P.inv[slot - 1] : null, W = it ? WEAPONS[it.w] : null;
    // touché de loin par celui qu'on combat : un mur entre lui et nous (de quoi construire, pas trop souvent), puis on
    // reste à couvert un moment, accroupi, le temps de recharger (et de se soigner si besoin, voir decide)
    if (P.hitBy === E.id && P.hitT > (B.hitSeen || -99) && S.t - P.hitT < 1.2 && d > 7 && P.ground && S.t - (B.wallT || -99) > 5) {
      B.hitSeen = P.hitT;
      const mat = ['bois', 'pierre', 'metal'].find((m) => P.mats[m] >= COST);
      if (mat && B.rng.next() < lv.wall) {
        B.wallT = S.t;
        B.yaw = Math.atan2(dx, dz); B.pitch = 0;
        I.build = 'mur'; I.mat = mat; I.shoot++;
        B.coverT = S.t + 1.2 + B.rng.next() * 1.6;
        return null;
      }
      B.wallT = S.t - 3.5; // pas cette fois : on y repense à la prochaine touche, dans 1,5 s au plus tôt
    }
    if (S.t < (B.coverT || 0) && d > 6) {
      I.crouch = true;
      if (W && it.mag < W.mag * 0.7 && P.ammo[W.ammo] > 0 && !P.rl) I.reload++;
      return null;
    }
    if (B.visible) {
      B.track += dt; B.react -= dt;
      const head = B.headshot && it && it.w !== 'roquette';
      const ty = E.y + (it && it.w === 'roquette' ? 0.4 : head ? (E.crouch ? 1.05 : 1.55) : (E.crouch ? 0.85 : 1.2));
      // comme un joueur, on voit la cible avec un temps de retard (lag) et on devine où elle va d'après son allure des
      // derniers instants (adapt) : qui court droit est bien suivi, mais un changement de direction ou un saut fait rater
      const a = 1 - Math.exp(-dt / lv.adapt);
      B.tvx += (E.vx - B.tvx) * a; B.tvy += ((E.ground ? 0 : E.vy) - B.tvy) * a; B.tvz += (E.vz - B.tvz) * a;
      const ax = E.x + (B.tvx - E.vx) * lv.lag - e[0], ay = ty + (B.tvy - (E.ground ? 0 : E.vy)) * lv.lag - e[1], az = E.z + (B.tvz - E.vz) * lv.lag - e[2];
      if ((B.errT -= dt) <= 0) {
        B.errT = 0.3 + B.rng.next() * 0.2;
        const m = lv.err * (0.35 + 0.65 * Math.exp(-B.track / 1.4)) * (1 + Math.min(1, Math.hypot(E.vx, E.vz) / 6) * 0.6) * (E.bot ? 1.8 : 1);
        B.ex = (B.rng.next() - 0.5) * 2 * m; B.ey = (B.rng.next() - 0.5) * 1.2 * m;
        B.headshot = B.rng.next() < lv.head;
      }
      // balle lente (fusil de précision) : on vise devant la cible et un peu au-dessus (temps de vol, chute)
      let lx = ax, lz = az, ly = ay;
      if (W && W.bullet) {
        const tf = Math.hypot(ax, ay, az) / W.bullet.speed;
        lx += E.vx * tf; lz += E.vz * tf; ly += 0.5 * W.bullet.g * tf * tf;
      }
      const wy = Math.atan2(lx, lz) + B.ex, wp = Math.atan2(ly, Math.hypot(lx, lz)) + B.ey;
      turn(B, wy, wp, lv.turn * dt);
      const tol = Math.max(0.025, Math.atan(0.7 / d));
      const aligned = Math.abs(wrap(B.yaw - wy)) < tol && Math.abs(B.pitch - wp) < tol;
      I.aim = !!W && d > 14 && it.w !== 'pompe';
      // pas encore repéré : accroupi (sans bruit de pas), on s'approche à bonne portée sans tirer, puis on ouvre le feu
      // posément ; au bout de 10 s de traque (ou repéré), on se bat normalement
      B.sneak = !!W && P.ground && !P.swim && S.t - B.sneakT < 10 && !spotted(P, E, d);
      const hold = B.sneak && it.w !== 'sniper' && it.w !== 'roquette' && d > Math.max(WANT_D[it.w] * 1.3, 8);
      if (B.sneak) I.crouch = true;
      if (W && B.react <= 0 && aligned && P.sel === slot && !hold) {
        if (W.auto) {
          if ((B.burstT -= dt) <= 0) { B.burstOn = !B.burstOn; B.burstT = (B.burstOn ? lv.burst[0] : lv.burst[1]) * (0.6 + B.rng.next() * 0.8); }
          I.fire = B.burstOn;
        } else if (P.cd <= 0 && !P.rl && it.mag > 0 && (it.w !== 'sniper' || Math.hypot(P.vx, P.vz) < 0.8)) I.shoot++;
      } else if (!W && d < 2.4 && aligned) I.fire = true;
      // grenade : à moyenne distance, de temps en temps
      if (lv.nade && d > 9 && d < 22 && S.t - (B.nadeT || -99) > 8 && B.rng.next() < lv.nade * dt * 0.6) {
        const gi = P.inv.findIndex((s) => s && s.t === 'objet' && s.c === 'grenade');
        if (gi >= 0) B.nade = { slot: gi + 1, t: S.t };
      }
    } else {
      // perdu de vue : on va voir où il était
      if (W && it.mag < W.mag * 0.4 && P.ammo[W.ammo] > 0 && !P.rl) I.reload++;
      if (B.last && S.t - B.seenT < 5) {
        if (!B.goal || B.goal.kind !== 'chasse' || Math.hypot(B.goal.x - B.last.x, B.goal.z - B.last.z) > 4) setGoal(P, B, { kind: 'chasse', id: null, x: B.last.x, y: B.last.y, z: B.last.z, r: 2 });
        const mv = travel(P, B, dt);
        if (mv) turn(B, Math.atan2(mv.x, mv.z), 0, 8 * dt);
        return mv;
      }
      B.enemy = null; B.state = 'go'; B.decideT = 0;
      return null;
    }
    // déplacement : garder sa distance, pas de côté, petits sauts ; bien amoché face à un bot : on décroche
    if (it && it.w === 'sniper' && I.aim) { I.crouch = true; return null; }
    // bien amoché, de quoi se soigner : on décroche (de près face à un joueur, mieux vaut finir le combat)
    const retreat = P.hp + P.sh < 35 && needHeal(P) && (E.bot || d > 10);
    if (retreat) { I.fire = false; I.aim = false; }
    const want = retreat ? 80 : W ? WANT_D[it.w] : 1.5;
    const ux = dx / d, uz = dz / d;
    const fwd = clamp((d - want) / 6, -1, 1);
    // à l'affût : on avance accroupi droit sur lui (ni pas de côté ni sauts, qui se voient), ou l'on reste immobile en tirant
    if (B.sneak && !retreat) return fwd > 0.2 ? { x: ux, z: uz, k: 1 } : null;
    if ((B.strafeT -= dt) <= 0) { B.strafe = B.rng.next() < 0.5 ? -1 : 1; B.strafeT = 0.5 + B.rng.next() * 1.1; }
    const side = B.strafe * lv.strafe;
    if (lv.hop && P.ground && B.rng.next() < lv.hop * dt * 1.5) I.jump++;
    const mx = ux * fwd - uz * side, mz = uz * fwd + ux * side, ml = Math.hypot(mx, mz);
    return ml > 0.1 ? { x: mx / ml, z: mz / ml, k: Math.min(1, ml) } : null;
  }

  // repères : le dernier repère encore frais d'un joueur (humain) de l'équipe
  function humanPing(P) {
    let best = null;
    for (const pg of S.pings.values()) {
      if (pg.team !== P.team || pg.p === P.id || S.t - pg.t > PING_T) continue;
      const Q = S.players.get(pg.p);
      if (Q && !Q.bot && (!best || pg.t > best.t)) best = pg;
    }
    return best;
  }
  // un bot dont l'équipe compte un joueur lui signale l'ennemi qu'il voit (pas plus d'une fois par 15 s, et pas un
  // ennemi qu'un coéquipier vient de signaler)
  function callOut(P, B, Q) {
    if (S.teams <= 1 || P.team == null || S.t - (B.pingT || -99) < 15) return;
    if (B.withHuman === undefined) B.withHuman = [...S.players.values()].some((q) => !q.bot && q.team === P.team);
    if (!B.withHuman) return;
    for (const pg of S.pings.values()) if (pg.team === P.team && pg.target === Q.id && S.t - pg.t < 8) return;
    if (sim.ping(P, 'ennemi', Q.x, Q.y + 1.3, Q.z, Q.id)) B.pingT = S.t;
  }
  // chef d'équipe : le joueur de l'équipe (le premier), sinon le premier bot ; null pour le chef lui-même et en solo
  function leaderOf(P, B) {
    if (S.teams <= 1 || P.team == null) return null;
    if (B.leader === undefined) {
      const team = [...S.players.values()].filter((q) => q.team === P.team);
      const L = team.find((q) => !q.bot) || team[0];
      B.leader = L && L !== P ? L.id : null;
    }
    const L = B.leader != null ? S.players.get(B.leader) : null;
    return L && L.alive ? L : null;
  }

  // ------------------------------------------------------------------ un bot, un pas
  function init(P) {
    const n = typeof P.id === 'string' ? [...P.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) : P.id;
    const rng = makeRng(hash((S.seed | 0) * 7 + (n | 0)));
    P.ai = {
      rng, lv: LEVELS[P.level] || LEVELS.normal, state: 'go', goal: null, path: null, wp: 0, waiting: false, partial: false, approach: false,
      enemy: null, visible: false, seenT: -99, last: null, react: 0, track: 0, ex: 0, ey: 0, errT: 0, headshot: false, tvx: 0, tvy: 0, tvz: 0, sneak: false, sneakT: -99,
      strafe: 1, strafeT: 0, burstOn: true, burstT: 0, scanT: rng.next() * 0.25, decideT: rng.next() * 0.5,
      ban: new Map(), ignore: new Map(), useT: -9, yaw: P.yaw || 0, pitch: 0, drop: null, prevD: null, minJump: 1 + rng.next() * 5,
      sx: P.x, sz: P.z, stuckT: 0, stuckN: 0, nade: null, nadeT: -99, healSlot: 0, follow: null, followPick: null, followT: 0,
    };
    const humans = [...S.players.values()].filter((q) => !q.bot && !sim.mates(P, q));
    // (un bot d'équipe suit son chef, pas un adversaire)
    if (humans.length && followers < FOLLOW_MAX && !leaderOf(P, P.ai) && rng.next() < 1 / 3) { followers++; P.ai.follow = humans[Math.floor(rng.next() * humans.length)].id; }
    return P.ai;
  }
  function think(P, dt) {
    if (S.t !== lastT) {
      lastT = S.t;
      // un chemin par pas (les autres attendent leur tour en marchant tout droit)
      while (queue.length) { const Q = queue.shift(); if (Q.alive && Q.ai && Q.ai.waiting) { plan(Q); break; } }
    }
    const B = P.ai || init(P), I = P.inp;
    if (P.down) {
      // à terre : on rampe vers le coéquipier debout le plus proche (il viendra nous relever)
      const M = [...S.players.values()].filter((Q) => Q.alive && !Q.down && sim.mates(P, Q)).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
      B.goal = null; B.path = null; B.state = 'go'; B.enemy = null;
      const dx = M ? M.x - P.x : 0, dz = M ? M.z - P.z : 0, d = Math.hypot(dx, dz);
      if (d > 0.1) B.yaw = Math.atan2(dx, dz);
      I.yaw = B.yaw; I.pitch = 0; I.mx = 0; I.mz = d > 2.5 ? 1 : 0; I.fire = false; I.build = null;
      return;
    }
    const L = leaderOf(P, B);
    if (L && P.mode !== 'sol') {
      // équipe : on saute avec son chef et on se pose près de lui
      if (P.mode === 'ballon') {
        if (L.mode === 'ballon') { B.prevD = null; return; }
        if (B.jumpAt == null) B.jumpAt = S.t + 0.3 + B.rng.next() * 0.8;
        if (S.t >= B.jumpAt) I.jump++;
        return;
      }
      if ((B.followT -= dt) <= 0) {
        B.followT = 0.5;
        const lead = L.mode === 'chute' ? 6 : L.mode === 'planeur' ? 3 : 0, side = (B.rng.next() - 0.5) * 8;
        B.drop = L.mode === 'sol' ? { x: L.x + side, z: L.z + side, b: -1 } : L.ai && L.ai.drop && L.mode === 'ballon' ? L.ai.drop : { x: L.x + L.vx * lead + side, z: L.z + L.vz * lead + side, b: -1 };
      }
    }
    if (B.follow != null && P.mode !== 'sol' && (B.followT -= dt) <= 0) {
      B.followT = 0.5;
      const f = followDrop(P, B);
      if (f && f !== B.drop) { B.drop = f; B.prevD = null; }
    }
    if (P.mode === 'ballon') {
      if (!B.drop) B.drop = chooseDrop(P, B);
      const b = sim.balloonPos(), d = Math.hypot(b.x - B.drop.x, b.z - B.drop.z);
      if (S.flight.t > B.minJump && (d < 110 || (B.prevD != null && d > B.prevD))) I.jump++;
      B.prevD = d;
      return;
    }
    if (P.mode === 'chute' || P.mode === 'planeur') {
      B.landT = S.t;
      const t = B.drop || { x: P.x, z: P.z }, dx = t.x - P.x, dz = t.z - P.z, d = Math.hypot(dx, dz);
      B.yaw = Math.atan2(dx, dz); I.yaw = B.yaw; I.pitch = -0.4; I.mx = 0; I.mz = d > 4 ? 1 : 0;
      // point lointain : on ouvre le deltaplane tout de suite, comme un joueur (il porte bien plus loin que la chute)
      if (P.mode === 'chute' && d > 150) I.jump++;
      return;
    }
    if ((B.scanT -= dt) <= 0) {
      B.scanT = 0.25; perceive(P, B);
      // les combats entre bots durent (voir S.hooks.pace) : passé le début de partie (où l'on cherche ses munitions comme tout
      // le monde), un bot garde de quoi recharger ses armes, sinon il finirait par errer sans pouvoir tirer
      if (S.t - (B.landT || S.t) > 90) for (const it of P.inv) if (it && it.t === 'arme') { const W = WEAPONS[it.w]; if (P.ammo[W.ammo] < W.mag * 2) P.ammo[W.ammo] = W.mag * 2; }
    }
    if ((B.decideT -= dt) <= 0) { B.decideT = 0.5; decide(P, B); }
    I.fire = false; I.aim = false; I.sprint = false; I.crouch = false; I.build = null;
    let mv = null;
    if (B.state === 'fight') mv = fight(P, B, dt);
    else if (B.state === 'heal') mv = heal(P, B, dt);
    else {
      // en route : l'arme la plus utile en main
      if (!B.goal || B.goal.kind !== 'objet' || B.goal.swap == null) { const s = bestSlot(P, 20); if (s) I.sel = s; }
      mv = travel(P, B, dt);
      if (mv) turn(B, Math.atan2(mv.x, mv.z), 0, 8 * dt);
      // on veut avancer : sorti d'un rayon de 5 m, tout va bien ; 10 s dedans, on se dégage (voir unstick)
      if (mv && !P.revive) {
        if (!B.anchor || Math.hypot(P.x - B.anchor.x, P.z - B.anchor.z) > 5) { B.anchor = { x: P.x, z: P.z, t: S.t }; B.unstuck = 0; }
        else if (S.t - B.anchor.t > 10) { B.anchor.t = S.t; unstick(P, B); }
      }
    }
    I.yaw = B.yaw; I.pitch = B.pitch;
    if (mv) {
      const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), k = mv.k || 1;
      I.mz = (mv.x * fx + mv.z * fz) * k; I.mx = (-mv.x * fz + mv.z * fx) * k;
    } else { I.mx = 0; I.mz = 0; }
    // coincé ? on saute, on ouvre, on recalcule, puis on abandonne la cible
    B.stuckT += dt;
    if (B.stuckT >= 0.8) {
      const moved = Math.hypot(P.x - B.sx, P.z - B.sz);
      if (mv && moved < 0.45 && !P.use) {
        B.stuckN++;
        if (B.stuckN === 1 || B.stuckN === 3) I.jump++;
        else if (B.stuckN === 2) I.use++;
        else if (B.stuckN === 4) {
          // la grille croit qu'on passe et on ne passe pas : on bouche devant soi et on cherche un autre chemin
          const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw);
          nav.expire(S.t);
          for (const k of [0.6, 1.1]) nav.block(P.x + fx * k, P.y, P.z + fz * k, 30, S.t);
          B.path = null; askPath(P, B);
        }
        else if (B.stuckN >= 6) { if (B.goal) ban(B, B.goal); B.goal = null; B.path = null; B.stuckN = 0; B.decideT = 0; if (B.state === 'zone') B.state = 'go'; }
      } else B.stuckN = 0;
      B.stuckT = 0; B.sx = P.x; B.sz = P.z;
    }
  }
  S.hooks.think = think;
  // rythme de la partie entre bots : quand il est déjà tombé plus de monde que prévu, les coups d'un bot sur un autre bot
  // font moins mal (les combats se voient toujours, ils durent un peu plus) ; ni les joueurs ni les coups reçus par eux ne changent
  S.hooks.pace = () => clamp(0.04 + agg() * 1.4, 0.04, 1);
  return { think, nav, LEVELS };
}
