// Island Rush — la partie. Simulation qui fait autorité (en solo et chez l'hôte) : joueurs et bots, commandes,
// montgolfière, chute libre et planeur, inventaire de 5 cases, butin au sol, coffres et caisses de munitions,
// portes, tirs (balles, plombs, roquettes, grenades), soins et boucliers, rechargement, tempête, éliminations,
// classement ; en équipes (duos, trios) : pas de tir ami, un joueur à 0 PV tombe « à terre » et un coéquipier peut le
// relever. Moteur PUR à pas fixe ; tout ce qui se voit ou s'entend sort en événements (sim.takeEvents()).
// Les bots (engine/ai.js) et la construction (engine/build.js) se branchent par S.hooks.
import { makeRng, hash } from './rng.js';
import { CELL } from './buildings.js';
import { newPlayer, stepPlayer, stepAir, MOVE } from './player.js';
import { planStorm, planFlight, STORM_TIMES } from './map.js';
import { WEAPONS, ITEMS, AMMO, MAT_MAX, rollFloor, rollChest, rollAmmoBox, rollDrop, weaponDamage, weapon, item, ammo, mats, spreadOf, REST } from './items.js';

export const DT = 1 / 60;
export const HP = 100, SHIELD = 100;
export const SLOTS = 5;
export const SHOULDER = 0.9;      // décalage à droite de l'épaule (le rayon de tir part de là, comme celui de la caméra)
const FLIGHT_H = 165;             // altitude de la montgolfière (m)
const FLIGHT_SPEED = 24;          // m/s
const FALL_SAFE = 8;               // m de chute sans dégâts
// Coriolis pour les balles du fusil de précision : rotation de la Terre à 46° de latitude (x vers l'est, z vers le
// nord, y en haut), forcée ×60 pour qu'on la sente sur l'île (≈ 65 cm de dérive à droite à 300 m)
const OMEGA = (() => { const w = 7.292e-5 * 60, lat = 46 * Math.PI / 180; return [0, w * Math.sin(lat), w * Math.cos(lat)]; })();
const STORM_START = 30;           // s après le départ de la montgolfière
const PICK_R = 2.1, CHEST_R = 2.5, AUTO_R = 1.4;
// équipes : à terre, on rampe (CRAWL × la vitesse) et sa réserve (DOWN_HP) fond en BLEED s ; un coéquipier immobile à
// moins de REVIVE_R m le relève en REVIVE s (E), avec RAISE_HP points de vie
export const CRAWL = 0.35, DOWN_HP = 100, BLEED = 30, REVIVE = 5, REVIVE_R = 2.4, RAISE_HP = 30;
// repères d'équipe : un par joueur, visible PING_T secondes par ses coéquipiers ; sortes : ici, ennemi, butin, largage
export const PING_T = 12, PING_KINDS = ['ici', 'ennemi', 'butin', 'largage'];
// largages : au début des quatre premières fermetures de la tempête, une caisse descend en parachute (DROP_H m à
// DROP_SPEED m/s, ≈ 26 s) quelque part dans le prochain cercle ; posée, elle s'ouvre comme un coffre (engine/items.js)
export const DROP_H = 110, DROP_SPEED = 4.2, DROP_PHASES = 4;
export const dropY = (d, t) => d.gy + Math.max(0, DROP_H - (t - d.t0) * DROP_SPEED);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const emptyInput = () => ({ mx: 0, mz: 0, yaw: 0, pitch: 0, fire: false, aim: false, sprint: false, crouch: false, jump: 0, use: 0, reload: 0, shoot: 0, drop: 0, sel: 1, build: null, place: 0, rotate: 0, edit: 0, mv: null });

export function createSim({ map, world, seed = 1, roster = [], mode = 'partie', start = null, teams = 1 } = {}) {
  const rng = makeRng(hash(seed * 31 + 7));
  const TEAMS = mode !== 'exploration' && teams > 1;
  const S = {
    t: 0, mode, seed, phase: mode === 'exploration' ? 'jeu' : 'vol', teams: TEAMS ? teams : 1, winTeam: null, pings: new Map(), drops: new Map(), nextDrop: 1,
    players: new Map(), items: new Map(), nextItem: 1, chests: new Map(), projectiles: [], pads: [], nextProj: 1,
    flight: null, storm: null, order: [], winner: null, events: [], hooks: {}, stormTick: 0,
  };
  const ev = (e) => { S.events.push(e); };

  // ------------------------------------------------------------------ butin au départ
  map.chests.forEach((c, i) => S.chests.set('c' + i, { id: 'c' + i, kind: 'coffre', x: c.x, y: c.y, z: c.z, fx: c.fx, fz: c.fz, open: false }));
  map.ammo.forEach((c, i) => S.chests.set('m' + i, { id: 'm' + i, kind: 'munitions', x: c.x, y: c.y, z: c.z, fx: c.fx, fz: c.fz, open: false }));
  function spawnItem(it, x, y, z, quiet = false) {
    const id = S.nextItem++;
    // posé sur ce qu'il y a dessous (plancher, sol, toit)
    const gy = world.support(x, z, y + 0.6, 0.05);
    const g = { id, it, x, y: gy, z };
    S.items.set(id, g);
    if (!quiet) ev({ e: 'objet+', id, it, x, y: gy, z });
    return g;
  }
  for (const spot of map.loot) {
    const list = rollFloor(rng);
    list.forEach((it, k) => spawnItem(it, spot.x + k * 0.55, spot.y + 0.3, spot.z + k * 0.25, true));
  }

  // ------------------------------------------------------------------ joueurs
  function addPlayer(r) {
    const P = { ...newPlayer(0, 0, 0), id: r.id, name: r.name, color: r.color, look: r.look || 'soldat', bot: !!r.bot, level: r.level || 'normal',
      team: TEAMS && r.team != null ? r.team : null, down: null, revive: null,
      // bilan de fin : tirs (et ceux qui ont touché), distance au sol, relevés, quand et par qui on a été éliminé
      shots: 0, hits: 0, dist: 0, revives: 0, outT: null, outBy: null, outHow: null,
      hp: HP, sh: 0, alive: true, inv: [null, null, null, null, null], sel: 0, ammo: Object.fromEntries(Object.keys(AMMO).map((a) => [a, 0])),
      mats: { bois: 0, pierre: 0, metal: 0 }, cd: 0, rl: 0, use: null, bloom: 0, kills: 0, dealt: 0, place: 0, mode: 'sol', safeFall: false,
      inp: emptyInput(), last: { jump: 0, use: 0, reload: 0, shoot: 0, drop: 0, place: 0, rotate: 0, edit: 0, mv: 0 }, hitBy: null, swing: 0 };
    S.players.set(P.id, P);
    return P;
  }
  for (const r of roster) addPlayer(r);
  const alive = () => [...S.players.values()].filter((p) => p.alive);
  // coéquipiers (jamais soi-même) ; équipes encore en lice
  const mates = (a, b) => TEAMS && a !== b && a.team != null && a.team === b.team;
  const teamOf = (P) => [...S.players.values()].filter((q) => q === P || mates(P, q));
  const liveTeams = () => new Set(alive().map((p) => (TEAMS ? p.team : p.id))).size;

  // départ : la montgolfière (partie) ou la ville (exploration)
  if (S.phase === 'vol') {
    const f = planFlight(map, seed);
    const dx = f.x1 - f.x0, dz = f.z1 - f.z0, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    // on démarre un peu avant la côte, on termine un peu après
    const C = map.center, along = (C - f.x0) * ux + (C - f.z0) * uz, half = map.islandR + 120;
    S.flight = { x0: f.x0 + ux * (along - half), z0: f.z0 + uz * (along - half), ux, uz, len: half * 2, speed: FLIGHT_SPEED, y: FLIGHT_H, t: 0 };
    for (const P of S.players.values()) { P.mode = 'ballon'; placeInBalloon(P); }
    S.storm = { circles: planStorm(map, seed), k: 0, state: 'attente', t0: STORM_START, cur: null, next: null };
    S.storm.cur = { ...S.storm.circles[0] };
    S.storm.next = { ...S.storm.circles[1] };
  } else {
    const at = start || { x: map.center, z: map.center };
    let i = 0;
    for (const P of S.players.values()) {
      const x = at.x + (i % 4) * 2, z = at.z + Math.floor(i / 4) * 2;
      Object.assign(P, { x, y: world.support(x, z, 400), z, mode: 'sol' }); i++;
    }
  }
  function balloonPos() {
    const f = S.flight, d = Math.min(f.len, f.t * f.speed);
    return { x: f.x0 + f.ux * d, y: f.y, z: f.z0 + f.uz * d };
  }
  function placeInBalloon(P) { const b = balloonPos(); P.x = b.x; P.y = b.y - 1; P.z = b.z; P.vx = P.vy = P.vz = 0; }
  function jumpOut(P) {
    if (P.mode !== 'ballon') return;
    const b = balloonPos();
    Object.assign(P, { mode: 'chute', x: b.x + (rng.next() - 0.5) * 2, y: b.y - 4, z: b.z + (rng.next() - 0.5) * 2, vx: S.flight.ux * 8, vy: 0, vz: S.flight.uz * 8 });
    ev({ e: 'saut', p: P.id });
  }

  // ------------------------------------------------------------------ commandes
  function input(id, inp) { const P = S.players.get(id); if (P) Object.assign(P.inp, inp); }
  const fired = (P, k) => { const n = P.inp[k] || 0; if (n !== P.last[k]) { P.last[k] = n; return true; } return false; };

  // ------------------------------------------------------------------ inventaire
  const heldItem = (P) => (P.sel > 0 ? P.inv[P.sel - 1] : null);
  function giveStack(P, it) {
    // munitions et matériaux : hors des cases ; renvoie le reste qu'on ne peut pas prendre
    if (it.t === 'munitions') { const room = AMMO[it.a].max - P.ammo[it.a], n = Math.min(room, it.n); P.ammo[it.a] += n; return it.n - n; }
    if (it.t === 'materiaux') { const room = MAT_MAX - P.mats[it.m], n = Math.min(room, it.n); P.mats[it.m] += n; return it.n - n; }
    return it.n;
  }
  // la case de la même arme en moins bonne rareté (la moins bonne s'il y en a deux), ou −1
  function upgradeSlot(P, it) {
    let up = -1;
    if (it.t === 'arme') P.inv.forEach((s, i) => { if (s && s.t === 'arme' && s.w === it.w && s.r < it.r && (up < 0 || s.r < P.inv[up].r)) up = i; });
    return up;
  }
  function pickUp(P, g) {
    const it = g.it;
    if (it.t === 'munitions' || it.t === 'materiaux') {
      const rest = giveStack(P, it);
      if (rest === it.n) return false;
      if (rest > 0) { it.n = rest; ev({ e: 'objet~', id: g.id, n: rest }); } else { S.items.delete(g.id); ev({ e: 'objet-', id: g.id }); }
      ev({ e: 'ramasse', p: P.id, it: { ...it, n: it.n - rest } });
      return true;
    }
    if (it.t === 'objet') {
      // on complète d'abord une pile du même objet
      for (const s of P.inv) if (s && s.t === 'objet' && s.c === it.c && s.n < ITEMS[it.c].stack) {
        const n = Math.min(ITEMS[it.c].stack - s.n, it.n); s.n += n; it.n -= n;
        if (!it.n) break;
      }
      if (!it.n) { S.items.delete(g.id); ev({ e: 'objet-', id: g.id }); ev({ e: 'ramasse', p: P.id, it: g.it }); return true; }
    }
    // la même arme dans une meilleure rareté : elle prend la place de l'ancienne, lâchée à nos pieds
    const up = upgradeSlot(P, it);
    if (up >= 0) {
      const old = P.inv[up];
      spawnItem(old, P.x + Math.sin(P.yaw) * 0.8, P.y + 0.3, P.z + Math.cos(P.yaw) * 0.8);
      P.inv[up] = it;
      S.items.delete(g.id); ev({ e: 'objet-', id: g.id }); ev({ e: 'ramasse', p: P.id, it, was: old.r });
      if (P.sel - 1 === up) { P.cd = Math.max(P.cd, 0.3); P.rl = 0; P.use = null; }
      return true;
    }
    let slot = P.inv.findIndex((s) => !s);
    if (slot < 0) {
      // inventaire plein : on échange avec l'objet tenu
      if (P.sel === 0) return false;
      slot = P.sel - 1;
      const old = P.inv[slot];
      spawnItem(old, P.x + Math.sin(P.yaw) * 0.8, P.y + 0.3, P.z + Math.cos(P.yaw) * 0.8);
    }
    P.inv[slot] = it;
    S.items.delete(g.id); ev({ e: 'objet-', id: g.id }); ev({ e: 'ramasse', p: P.id, it });
    if (P.sel === 0 || !P.inv[P.sel - 1] || P.sel - 1 === slot) { P.sel = slot + 1; P.cd = Math.max(P.cd, 0.3); P.rl = 0; P.use = null; }
    return true;
  }
  function dropHeld(P) {
    const it = heldItem(P);
    if (!it) return;
    P.inv[P.sel - 1] = null; P.rl = 0; P.use = null;
    spawnItem(it, P.x + Math.sin(P.yaw) * 1.2, P.y + 0.4, P.z + Math.cos(P.yaw) * 1.2);
  }
  function moveSlot(P, a, b) {
    if (!(a >= 0 && a < SLOTS) || a === b) return;
    if (b === -1) {
      const it = P.inv[a];
      if (!it) return;
      P.inv[a] = null;
      spawnItem(it, P.x + Math.sin(P.yaw) * 1.2, P.y + 0.4, P.z + Math.cos(P.yaw) * 1.2);
    } else if (b >= 0 && b < SLOTS) [P.inv[a], P.inv[b]] = [P.inv[b], P.inv[a]];
    else return;
    // l'objet en main a changé : on ne finit pas un rechargement ou un soin commencé avec l'autre
    if (P.sel - 1 === a || P.sel - 1 === b) { P.rl = 0; P.use = null; P.cd = Math.max(P.cd, 0.25); }
    ev({ e: 'range', p: P.id });
  }
  function openChest(P, c) {
    c.open = true;
    const r = makeRng(hash(seed * 977 + hash(c.id.charCodeAt(0) * 131 + +c.id.slice(1))));
    const list = c.kind === 'coffre' ? rollChest(r) : rollAmmoBox(r);
    ev({ e: 'coffre', id: c.id, p: P.id });
    // le butin jaillit devant le coffre
    list.forEach((it, k) => {
      const a = (k - (list.length - 1) / 2) * 0.7;
      const fx = c.fx || 0, fz = c.fz || 1;
      spawnItem(it, c.x + fx * 1.1 - fz * a, c.y + 0.5, c.z + fz * 1.1 + fx * a);
    });
  }
  // largage : quelque part dans le prochain cercle, sur la terre ferme ; ouvert, son butin jaillit autour
  function spawnDrop() {
    const c = S.storm && S.storm.next;
    if (!c) return;
    for (let i = 0; i < 40; i++) {
      const a = rng.next() * Math.PI * 2, r = c.r * (0.15 + rng.next() * 0.55), x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (x < 12 || z < 12 || x > map.size - 12 || z > map.size - 12 || map.waterAt(x, z) !== 0) continue;
      const gy = world.support(x, z, 400), id = 'L' + S.nextDrop++;
      S.drops.set(id, { id, x, z, y: gy, gy, t0: S.t, open: false, landed: false });
      ev({ e: 'largage', id, x, z, gy, t0: S.t });
      return;
    }
  }
  function openDrop(P, d) {
    d.open = true;
    const list = rollDrop(makeRng(hash(seed * 911 + +d.id.slice(1))));
    ev({ e: 'largage-ouvert', id: d.id, p: P.id });
    list.forEach((it, k) => { const a = (k / list.length) * Math.PI * 2; spawnItem(it, d.x + Math.cos(a) * 1.5, d.gy + 0.6, d.z + Math.sin(a) * 1.5); });
  }
  // ce que le joueur peut faire avec E : coffre, objet, porte (le plus proche de son regard)
  function target(P) {
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    let best = null, bs = Infinity;
    const consider = (kind, o, r, dy) => {
      const dx = o.x - P.x, dz = o.z - P.z, d = Math.hypot(dx, dz);
      if (d > r || Math.abs(o.y - P.y) > dy) return;
      const facing = d > 0.05 ? (dx * fx + dz * fz) / d : 1;
      if (facing < -0.1) return;
      const sc = d - facing * 1.2;
      if (sc < bs) { bs = sc; best = { kind, o }; }
    };
    for (const Q of S.players.values()) if (Q.alive && Q.down && mates(P, Q)) consider('releve', Q, REVIVE_R, 1.6);
    if (best) return best; // relever passe avant tout le reste
    for (const c of S.chests.values()) if (!c.open) consider('coffre', c, CHEST_R, 1.6);
    for (const d of S.drops.values()) if (d.landed && !d.open) consider('largage', d, CHEST_R + 0.6, 2);
    for (const g of S.items.values()) if (g.it.t === 'arme' || g.it.t === 'objet') consider('objet', g, PICK_R, 1.6);
    // la porte la plus proche concourt avec la même règle (un peu moins prioritaire qu'un objet)
    const d = world.doorNear(P.x, P.y, P.z, fx, fz);
    if (d) {
      const dx = d.cx - P.x, dz = d.cz - P.z, dd = Math.hypot(dx, dz), facing = dd > 0.05 ? (dx * fx + dz * fz) / dd : 1;
      if (dd - facing * 1.2 + 0.35 < bs) best = { kind: 'porte', o: d };
    }
    return best;
  }
  function setDoor(d, open, from) {
    if (open) d.swing = d.o === 'h' ? (from.z > d.cz ? -1 : 1) : (from.x > d.cx ? -1 : 1);
    world.setDoor(d.id, open);
    ev({ e: 'porte', id: d.id, open, swing: d.swing });
  }
  function interact(P) {
    const tg = target(P);
    if (!tg) return;
    if (tg.kind === 'releve') { P.revive = { id: tg.o.id, t: 0 }; P.use = null; P.rl = 0; ev({ e: 'releve…', p: P.id, to: tg.o.id }); }
    else if (tg.kind === 'coffre') openChest(P, tg.o);
    else if (tg.kind === 'largage') openDrop(P, tg.o);
    else if (tg.kind === 'objet') pickUp(P, tg.o);
    else setDoor(tg.o, !tg.o.open, P);
  }

  // ------------------------------------------------------------------ tirs
  // l'épaule : le rayon de la caméra passe par là (la caméra est derrière, sur le même axe)
  // solid : l'épaule s'arrête contre un mur à droite (comme la caméra), pour ne jamais tirer depuis l'autre côté du mur
  function eye(P, solid) {
    const rx = -Math.cos(P.yaw), rz = Math.sin(P.yaw), h = P.crouch ? MOVE.hc : MOVE.h, y = P.y + h - 0.25;
    const side = solid ? Math.max(0, world.ray(P.x, y, P.z, rx, 0, rz, SHOULDER, 0.2)) : SHOULDER;
    return [P.x + rx * side, y, P.z + rz * side];
  }
  // direction des tirs : celle du viseur envoyée par le joueur (ay, ap : depuis l'épaule vers ce que montre le centre de
  // l'image), à défaut celle du regard ; un écart trop grand avec le regard est ignoré
  function aimOf(P) {
    const I = P.inp;
    if (I.ay == null || I.ap == null) return [I.yaw, I.pitch];
    const dy = Math.atan2(Math.sin(I.ay - I.yaw), Math.cos(I.ay - I.yaw));
    return Math.abs(dy) < 0.6 && Math.abs(I.ap - I.pitch) < 0.6 ? [I.yaw + dy, I.ap] : [I.yaw, I.pitch];
  }
  const aimDir = (yaw, pitch) => { const c = Math.cos(pitch); return [Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c]; };
  // rayon contre un joueur : corps (cylindre) et tête (sphère) ; renvoie { t, head } ou null
  function hitPlayer(Q, o, d, maxT) {
    const h = Q.crouch ? 1.05 : 1.45, hy = Q.y + (Q.crouch ? 1.1 : 1.6);
    let best = null;
    // tête
    const ox = o[0] - Q.x, oy = o[1] - hy, oz = o[2] - Q.z;
    const b = ox * d[0] + oy * d[1] + oz * d[2], c = ox * ox + oy * oy + oz * oz - 0.29 * 0.29, disc = b * b - c;
    if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < maxT) best = { t, head: true }; }
    // corps
    const a = d[0] * d[0] + d[2] * d[2];
    if (a > 1e-9) {
      const bx = o[0] - Q.x, bz = o[2] - Q.z, bb = 2 * (bx * d[0] + bz * d[2]), cc = bx * bx + bz * bz - 0.45 * 0.45, dd = bb * bb - 4 * a * cc;
      if (dd >= 0) {
        const t = (-bb - Math.sqrt(dd)) / (2 * a), y = o[1] + d[1] * t;
        if (t > 0 && t < maxT && y >= Q.y && y <= Q.y + h && (!best || t < best.t)) best = { t, head: false };
      }
    }
    return best;
  }
  // où était Q il y a `lag` secondes ? (un invité vise ce qu'il voit, un peu en retard sur l'hôte)
  function rewound(Q, lag) {
    const tr = Q.trail;
    if (!lag || !tr || !tr.length) return Q;
    const t = S.t - lag;
    let a = tr[0];
    for (let i = tr.length - 1; i >= 0; i--) if (tr[i][0] <= t) { a = tr[i]; break; }
    return { x: a[1], y: a[2], z: a[3], crouch: a[4] };
  }
  function trace(P, o, d, range) {
    const w = world.raycast(o[0], o[1], o[2], d[0], d[1], d[2], range);
    let best = { t: w.t, who: null, head: false, solid: w.s };
    const lag = P && P.lag > 0.02 ? P.lag : 0;
    for (const Q of S.players.values()) {
      if (Q === P || !Q.alive || Q.mode === 'ballon') continue;
      if (Math.abs(Q.x - o[0]) > range && Math.abs(Q.z - o[2]) > range) continue;
      const h = hitPlayer(lag ? rewound(Q, lag) : Q, o, d, best.t);
      if (h && h.t < best.t) best = { t: h.t, who: Q, head: h.head, solid: null };
    }
    return best;
  }
  function damage(Q, n, by, opt = {}) {
    if (!Q.alive || n <= 0) return;
    if (by && mates(by, Q)) return; // pas de tir ami
    // entre bots, le rythme de la partie (voir ai.js) ; pas à la pioche : deux bots sans arme ne s'y attardent pas des minutes
    if (by && by.bot && Q.bot && S.hooks.pace && opt.cause !== 'pioche') n *= S.hooks.pace();
    if (Q.down) {
      // à terre : les coups entament sa réserve ; à zéro, il est éliminé (par celui qui l'a mis à terre, à défaut)
      Q.down.hp -= n;
      if (by && by !== Q) { by.dealt += n; Q.hitBy = by.id; Q.hitT = S.t; }
      ev({ e: 'degat', to: Q.id, by: by ? by.id : null, n: Math.round(n), head: !!opt.head, sh: false, x: Q.x, y: Q.y + 0.8, z: Q.z, cause: opt.cause || null });
      if (Q.down.hp <= 0) eliminate(Q, by && by !== Q ? by : S.players.get(Q.down.by) || null, opt.cause || Q.down.cause);
      return;
    }
    // la tempête et les chutes enlèvent de la vie, pas du bouclier
    const toSh = opt.storm || opt.cause === 'chute' ? 0 : Math.min(Q.sh, n);
    Q.sh -= toSh; Q.hp -= n - toSh;
    if (by && by !== Q) { by.dealt += n; Q.hitBy = by.id; Q.hitT = S.t; }
    ev({ e: 'degat', to: Q.id, by: by ? by.id : null, n: Math.round(n), head: !!opt.head, sh: toSh > 0, x: Q.x, y: Q.y + 1.4, z: Q.z, cause: opt.cause || null });
    if (Q.hp <= 0) {
      // en équipe, tant qu'un coéquipier tient debout : à terre plutôt qu'éliminé
      if (TEAMS && teamOf(Q).some((q) => q !== Q && q.alive && !q.down)) knock(Q, by, opt.cause);
      else eliminate(Q, by, opt.cause);
    }
  }
  function knock(Q, by, cause) {
    Q.hp = 0; Q.sh = 0; Q.use = null; Q.rl = 0; Q.revive = null; Q.sprint = false;
    Q.down = { t: S.t, by: by && by !== Q ? by.id : null, cause: cause || null, hp: DOWN_HP };
    ev({ e: 'abattu', to: Q.id, by: Q.down.by, cause: cause || null });
  }
  // une équipe dont tous les membres encore en vie sont à terre est éliminée
  function wipe(team) {
    if (!TEAMS || team == null) return;
    const live = [...S.players.values()].filter((q) => q.alive && q.team === team);
    if (!live.length || live.some((q) => !q.down)) return;
    for (const q of live) if (q.alive) eliminate(q, S.players.get(q.down.by) || null, q.down.cause);
  }
  function shoot(P, it) {
    const W = WEAPONS[it.w];
    // les bots gardent la dispersion d'avant (×1,4, sans le premier tir précis) : leur visée a déjà sa propre erreur
    const sp = P.bot ? spreadOf(it.w, P, P.inp.aim, false) * 1.4 : spreadOf(it.w, P, P.inp.aim, S.t - (P.shotT != null ? P.shotT : -9) > REST);
    it.mag--; P.cd = 1 / W.rate; P.shotT = S.t; P.shots++;
    const o = eye(P, true), [yaw, pitch] = aimOf(P);
    P.bloom = Math.min(P.bloom + W.bloom, 0.09);
    ev({ e: 'feu', p: P.id, w: it.w });
    if (W.bullet) {
      const a = rng.next() * Math.PI * 2, r = Math.sqrt(rng.next()) * sp, d = aimDir(yaw + Math.cos(a) * r, pitch + Math.sin(a) * r);
      const v = W.bullet.speed;
      S.projectiles.push({ id: S.nextProj++, kind: 'balle', x: o[0], y: o[1], z: o[2], vx: d[0] * v, vy: d[1] * v, vz: d[2] * v, owner: P.id, it: { ...it }, life: W.range / v + 0.3, from: [o[0], o[1], o[2]], dist: 0 });
      return;
    }
    if (W.rocket) {
      const d = aimDir(yaw + (rng.next() - 0.5) * sp, pitch + (rng.next() - 0.5) * sp);
      S.projectiles.push({ id: S.nextProj++, kind: 'roquette', x: o[0] + d[0] * 0.8, y: o[1] + d[1] * 0.8, z: o[2] + d[2] * 0.8, vx: d[0] * W.rocket.speed, vy: d[1] * W.rocket.speed, vz: d[2] * W.rocket.speed, owner: P.id, it: { ...it }, life: 6 });
      return;
    }
    const n = W.pellets || 1;
    let touched = false;
    for (let k = 0; k < n; k++) {
      // dispersion dans un cône
      const a = rng.next() * Math.PI * 2, r = Math.sqrt(rng.next()) * sp;
      const d = aimDir(yaw + Math.cos(a) * r, pitch + Math.sin(a) * r);
      const h = trace(P, o, d, W.range);
      const to = [o[0] + d[0] * h.t, o[1] + d[1] * h.t, o[2] + d[2] * h.t];
      ev({ e: 'tir', p: P.id, w: it.w, from: o, to, hit: h.who ? 2 : h.t < W.range ? 1 : 0, k });
      if (h.who) { if (!mates(P, h.who)) touched = true; damage(h.who, weaponDamage(it, h.t, h.head), P, { head: h.head, cause: it.w }); }
      else if (h.solid && S.hooks.hitSolid) S.hooks.hitSolid(h.solid, W.dmg[it.r] * W.struct, P, to);
    }
    if (touched) P.hits++;
  }
  // balle du fusil de précision : pesanteur et Coriolis (a = −2 Ω × v), touche ce qu'elle croise pendant le pas
  function stepBullet(pr, dt) {
    const W = WEAPONS[pr.it.w], owner = S.players.get(pr.owner);
    const cx = OMEGA[1] * pr.vz - OMEGA[2] * pr.vy, cy = OMEGA[2] * pr.vx - OMEGA[0] * pr.vz, cz = OMEGA[0] * pr.vy - OMEGA[1] * pr.vx;
    pr.vx -= 2 * cx * dt; pr.vy -= (W.bullet.g + 2 * cy) * dt; pr.vz -= 2 * cz * dt;
    const sp = Math.hypot(pr.vx, pr.vy, pr.vz), step = sp * dt, d = [pr.vx / sp, pr.vy / sp, pr.vz / sp];
    const h = trace(owner || null, [pr.x, pr.y, pr.z], d, step);
    const end = () => S.projectiles.splice(S.projectiles.indexOf(pr), 1);
    if (h.t < step) {
      const to = [pr.x + d[0] * h.t, pr.y + d[1] * h.t, pr.z + d[2] * h.t];
      ev({ e: 'tir', p: pr.owner, w: pr.it.w, from: pr.from, to, hit: h.who ? 2 : 1, k: 0, late: true });
      if (h.who) { if (owner && !mates(owner, h.who)) owner.hits++; damage(h.who, weaponDamage(pr.it, pr.dist + h.t, h.head), owner || null, { head: h.head, cause: pr.it.w }); }
      else if (h.solid && S.hooks.hitSolid) S.hooks.hitSolid(h.solid, W.dmg[pr.it.r] * W.struct, owner || null, to);
      end(); return;
    }
    pr.x += d[0] * step; pr.y += d[1] * step; pr.z += d[2] * step; pr.dist += step;
    if (pr.life <= 0 || pr.y < -20) { ev({ e: 'tir', p: pr.owner, w: pr.it.w, from: pr.from, to: [pr.x, pr.y, pr.z], hit: 0, k: 0, late: true }); end(); }
  }
  function explode(x, y, z, owner, dmg, radius, struct, kind = 'boum') {
    ev({ e: 'boum', x, y, z, r: radius, kind });
    const by = S.players.get(owner);
    let touched = false;
    for (const Q of S.players.values()) {
      if (!Q.alive || Q.mode === 'ballon') continue;
      const cy = Q.y + 0.9, dd = Math.hypot(Q.x - x, cy - y, Q.z - z);
      if (dd > radius) continue;
      // il faut voir l'explosion (un mur protège)
      const dx = (Q.x - x) / (dd || 1), dy = (cy - y) / (dd || 1), dz = (Q.z - z) / (dd || 1);
      const w = world.raycast(x - dx * 0.05, y - dy * 0.05, z - dz * 0.05, dx, dy, dz, dd);
      if (w.t < dd - 0.5) continue;
      if (by && Q !== by && !mates(by, Q)) touched = true;
      damage(Q, dmg * (1 - 0.6 * dd / radius), by || null, { cause: kind === 'roquette' ? 'roquette' : 'grenade' });
    }
    if (touched) by.hits++;
    if (S.hooks.blast) S.hooks.blast(x, y, z, radius, dmg * struct, by);
  }
  function blastPush(x, y, z, radius, push) {
    ev({ e: 'boum', x, y, z, r: radius, kind: 'souffle' });
    for (const Q of S.players.values()) {
      if (!Q.alive || Q.mode !== 'sol') continue;
      const dx = Q.x - x, dz = Q.z - z, d = Math.hypot(dx, dz);
      if (d > radius || Math.abs(Q.y - y) > radius) continue;
      const k = 1 - d / radius * 0.4;
      Q.vx += (dx / (d || 1)) * push * 0.6 * k; Q.vz += (dz / (d || 1)) * push * 0.6 * k; Q.vy = push * 0.55 * k;
      Q.ground = false; Q.safeFall = true;
    }
  }
  function throwItem(P, it) {
    const I = ITEMS[it.c], o = eye(P, true), d = aimDir(P.inp.yaw, P.inp.pitch + 0.18);
    const v = 22;
    S.projectiles.push({ id: S.nextProj++, kind: I.throw, x: o[0] + d[0] * 0.6, y: o[1] + d[1] * 0.6, z: o[2] + d[2] * 0.6, vx: d[0] * v + P.vx * 0.5, vy: d[1] * v, vz: d[2] * v + P.vz * 0.5, owner: P.id, c: it.c, life: I.fuse });
    ev({ e: 'lance', p: P.id, c: it.c });
    consume(P);
    P.cd = 0.6;
  }
  function consume(P) {
    const it = heldItem(P);
    if (!it) return;
    it.n--;
    if (it.n <= 0) P.inv[P.sel - 1] = null;
  }
  function placePad(P) {
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), x = P.x + fx * 2.2, z = P.z + fz * 2.2;
    const y = world.support(x, z, P.y + 0.6);
    if (Math.abs(y - P.y) > 1.2) return;
    const id = S.nextProj++;
    S.pads.push({ id, x, y, z, owner: P.id, t: 0 });
    ev({ e: 'tremplin', id, x, y, z, p: P.id });
    consume(P); P.cd = 0.5;
  }
  function stepProjectiles(dt) {
    for (const pr of [...S.projectiles]) {
      pr.life -= dt;
      if (pr.kind === 'balle') { stepBullet(pr, dt); continue; }
      const grav = pr.kind === 'roquette' ? 0 : 22;
      pr.vy -= grav * dt;
      const sp = Math.hypot(pr.vx, pr.vy, pr.vz), step = sp * dt;
      const d = [pr.vx / sp, pr.vy / sp, pr.vz / sp];
      const owner = S.players.get(pr.owner);
      const h = trace(owner && pr.kind === 'roquette' ? owner : null, [pr.x, pr.y, pr.z], d, step);
      if (h.t < step) {
        const hx = pr.x + d[0] * h.t, hy = pr.y + d[1] * h.t, hz = pr.z + d[2] * h.t;
        if (pr.kind === 'roquette') {
          const W = WEAPONS.roquette;
          explode(hx - d[0] * 0.2, hy - d[1] * 0.2, hz - d[2] * 0.2, pr.owner, W.dmg[pr.it.r], W.rocket.radius, W.struct, 'roquette');
          S.projectiles.splice(S.projectiles.indexOf(pr), 1);
          continue;
        }
        // grenade : rebond (sol ou dessus d'une forme : vers le haut ; mur : à l'opposé)
        const floor = h.solid === null || (h.solid && h.solid.y1 != null && Math.abs(h.solid.y1 - hy) < 0.2) || h.solid === undefined;
        pr.x = hx - d[0] * 0.08; pr.y = hy - d[1] * 0.08; pr.z = hz - d[2] * 0.08;
        if (floor) { pr.vy = Math.abs(pr.vy) * 0.35; pr.vx *= 0.6; pr.vz *= 0.6; } else { pr.vx *= -0.4; pr.vz *= -0.4; pr.vy *= 0.6; }
        if (h.who) { pr.vx *= 0.3; pr.vz *= 0.3; }
      } else { pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt; }
      if (pr.life <= 0) {
        S.projectiles.splice(S.projectiles.indexOf(pr), 1);
        if (pr.kind === 'roquette') explode(pr.x, pr.y, pr.z, pr.owner, WEAPONS.roquette.dmg[pr.it.r], WEAPONS.roquette.rocket.radius, WEAPONS.roquette.struct, 'roquette');
        else if (pr.kind === 'grenade') explode(pr.x, pr.y + 0.2, pr.z, pr.owner, ITEMS.grenade.dmg, ITEMS.grenade.radius, ITEMS.grenade.struct, 'grenade');
        else blastPush(pr.x, pr.y, pr.z, ITEMS.souffle.radius, ITEMS.souffle.push);
      }
    }
    // tremplins : on est propulsé en marchant dessus, puis on plane
    for (const pad of S.pads) {
      for (const Q of S.players.values()) {
        if (!Q.alive || Q.mode !== 'sol' || Q.vy > 1) continue;
        if (Math.hypot(Q.x - pad.x, Q.z - pad.z) < 1.2 && Math.abs(Q.y - pad.y) < 0.6) {
          Object.assign(Q, { mode: 'chute', vy: 30, safeFall: true }); Q.vx *= 0.5; Q.vz *= 0.5;
          ev({ e: 'propulse', p: Q.id, x: pad.x, y: pad.y, z: pad.z });
        }
      }
    }
  }

  // ------------------------------------------------------------------ actions d'un joueur au sol
  function act(P, dt) {
    P.cd = Math.max(0, P.cd - dt);
    P.bloom = Math.max(0, P.bloom - dt * 0.12);
    // changement de case (0 : outil de récolte)
    const want = clamp(P.inp.sel | 0, 0, SLOTS);
    if (want !== P.sel) { P.sel = want; P.rl = 0; P.use = null; P.cd = Math.max(P.cd, 0.25); ev({ e: 'arme', p: P.id, sel: want }); }
    // rangement du sac (menu d'inventaire) : [compteur, case, case de destination ou −1 pour lâcher]
    const mv = P.inp.mv;
    if (mv && mv[0] !== P.last.mv) { P.last.mv = mv[0]; moveSlot(P, mv[1], mv[2]); }
    if (fired(P, 'use')) interact(P);
    if (fired(P, 'drop')) dropHeld(P);
    // ramassage automatique des munitions et matériaux : une liste des tas proches (12 m), refaite trois fois par
    // seconde, suffit à chaque pas (passer tous les objets de l'île pour chaque joueur coûtait cher à 60)
    if ((P.nearT = (P.nearT || 0) - dt) <= 0) {
      P.nearT = 0.33;
      P.near = [];
      for (const g of S.items.values()) if ((g.it.t === 'munitions' || g.it.t === 'materiaux') && Math.abs(g.x - P.x) < 12 && Math.abs(g.z - P.z) < 12) P.near.push(g.id);
    }
    for (const id of P.near) {
      const g = S.items.get(id);
      if (g && Math.abs(g.x - P.x) < AUTO_R && Math.abs(g.z - P.z) < AUTO_R && Math.abs(g.y - P.y) < 1.4) pickUp(P, g);
    }
    const it = heldItem(P);
    // les appuis ponctuels sont lus à chaque pas (sinon un R pressé avec une potion en main rechargerait plus tard)
    const shot = fired(P, 'shoot'), reload = fired(P, 'reload');
    if (S.hooks.act && S.hooks.act(P, dt, shot)) return; // construction / récolte
    if (!it) return;
    if (it.t === 'arme') {
      const W = WEAPONS[it.w];
      if (reload && it.mag < W.mag && P.ammo[W.ammo] > 0 && !P.rl) { P.rl = W.reload[it.r]; ev({ e: 'recharge', p: P.id, w: it.w, T: P.rl }); }
      if (P.rl > 0) {
        P.rl -= dt;
        if (P.rl <= 0) { const n = Math.min(W.mag - it.mag, P.ammo[W.ammo]); it.mag += n; P.ammo[W.ammo] -= n; P.rl = 0; }
        return;
      }
      const trigger = W.auto ? P.inp.fire : shot;
      if (trigger && P.cd <= 0) {
        if (it.mag > 0) shoot(P, it);
        else if (P.ammo[W.ammo] > 0) { P.rl = W.reload[it.r]; ev({ e: 'recharge', p: P.id, w: it.w, T: P.rl }); }
        else if (shot) ev({ e: 'vide', p: P.id });
      }
      // chargeur vide : rechargement automatique
      if (it.mag === 0 && P.ammo[W.ammo] > 0 && !P.rl && P.cd <= 0) { P.rl = W.reload[it.r]; ev({ e: 'recharge', p: P.id, w: it.w, T: P.rl }); }
      return;
    }
    if (it.t === 'objet') {
      const I = ITEMS[it.c];
      if (I.throw) { if (shot && P.cd <= 0) throwItem(P, it); return; }
      if (I.place) { if (shot && P.cd <= 0) placePad(P); return; }
      // soin ou bouclier : on maintient le clic
      const useful = (I.heal && P.hp < I.max) || (I.shield && P.sh < I.maxShield);
      if (P.use) {
        if (!P.inp.fire && !shot) { P.use = null; return; }
        P.use.t += dt;
        if (P.use.t >= P.use.T) {
          if (I.heal) P.hp = Math.min(I.max, P.hp + I.heal);
          if (I.shield) P.sh = Math.min(I.maxShield, P.sh + I.shield);
          ev({ e: 'soin', p: P.id, c: it.c });
          consume(P);
          P.use = null;
        }
      } else if ((P.inp.fire || shot) && useful && P.cd <= 0) { P.use = { t: 0, T: I.time, c: it.c }; ev({ e: 'soigne', p: P.id, c: it.c }); }
      else if (shot && !useful) ev({ e: 'inutile', p: P.id, c: it.c });
    }
  }

  // ------------------------------------------------------------------ éliminations, fin
  function eliminate(Q, by, cause) {
    Q.alive = false; Q.hp = 0; Q.use = null; Q.rl = 0; Q.down = null; Q.revive = null;
    Q.outT = S.t; Q.outBy = by && by !== Q ? by.id : null; Q.outHow = cause || null;
    S.order.push(Q.id);
    if (!TEAMS) Q.place = alive().length + 1;
    // en équipe, la place se donne quand le dernier membre tombe (à toute l'équipe)
    else if (!teamOf(Q).some((q) => q.alive)) { const place = liveTeams() + 1; for (const q of teamOf(Q)) q.place = place; }
    if (by && by !== Q) by.kills++;
    // tout ce qu'il portait tombe autour de lui
    const drops = [...Q.inv.filter(Boolean), ...Object.entries(Q.ammo).filter(([, n]) => n > 0).map(([a, n]) => ammo(a, n)),
      ...Object.entries(Q.mats).filter(([, n]) => n > 0).map(([m, n]) => mats(m, n))];
    drops.forEach((it, k) => {
      const a = (k / Math.max(1, drops.length)) * Math.PI * 2;
      spawnItem(it, Q.x + Math.cos(a) * 1.3, Q.y + 0.4, Q.z + Math.sin(a) * 1.3);
    });
    Q.inv = [null, null, null, null, null]; for (const a in Q.ammo) Q.ammo[a] = 0; for (const m in Q.mats) Q.mats[m] = 0;
    ev({ e: 'elim', to: Q.id, by: by && by !== Q ? by.id : null, cause: cause || null, place: Q.place, left: alive().length });
    wipe(Q.team);
    checkEnd();
  }
  function checkEnd() {
    if (S.mode === 'exploration' || S.winner || S.phase === 'fin') return;
    const live = alive();
    if (liveTeams() <= 1 && S.players.size > 1 && (!TEAMS || new Set([...S.players.values()].map((p) => p.team)).size > 1)) {
      S.phase = 'fin';
      S.winner = live[0] ? live[0].id : S.order[S.order.length - 1];
      S.winTeam = TEAMS ? (S.players.get(S.winner) || {}).team ?? null : null;
      for (const q of S.players.values()) if (TEAMS ? q.team === S.winTeam : q.id === S.winner) q.place = 1;
      ev({ e: 'fin', winner: S.winner, team: S.winTeam });
    }
  }
  // un joueur quitte la partie (onglet fermé, retour au salon) : il est éliminé et lâche son sac
  function leave(id) {
    const Q = S.players.get(id);
    if (!Q || !Q.alive) return;
    if (Q.mode === 'ballon') { const b = balloonPos(); Object.assign(Q, { mode: 'sol', x: b.x, z: b.z, y: world.support(b.x, b.z, 400) }); }
    eliminate(Q, null, 'depart');
  }
  function results() {
    const list = [...S.players.values()].sort((a, b) => (a.place || 1) - (b.place || 1) || b.kills - a.kills);
    return list.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.bot, place: p.place || 1, kills: p.kills, dealt: Math.round(p.dealt), team: p.team,
      shots: p.shots, hits: p.hits, dist: Math.round(p.dist), revives: p.revives, out: p.outT == null ? null : Math.round(p.outT), by: p.outBy, how: p.outHow }));
  }

  // ------------------------------------------------------------------ tempête
  function stepStorm(dt) {
    const st = S.storm;
    if (!st) return;
    const C = st.circles, T = S.t;
    // fenêtre de temps de chaque phase : attente puis fermeture
    let t = T - st.t0, k = 0;
    while (k < C.length - 1) {
      const P = STORM_TIMES[k] || STORM_TIMES[STORM_TIMES.length - 1];
      if (t < P.wait) { st.state = 'attente'; st.left = P.wait - t; st.cur = { ...C[k] }; break; }
      t -= P.wait;
      if (t < P.shrink) {
        st.state = 'fermeture'; st.left = P.shrink - t;
        const a = t / P.shrink, A = C[k], B = C[k + 1];
        st.cur = { x: A.x + (B.x - A.x) * a, z: A.z + (B.z - A.z) * a, r: A.r + (B.r - A.r) * a };
        break;
      }
      t -= P.shrink; k++;
    }
    if (k >= C.length - 1) { st.state = 'fin'; st.cur = { ...C[C.length - 1] }; st.left = 0; }
    if (k !== st.k) { st.k = k; ev({ e: 'tempete', k, state: st.state }); }
    st.next = C[Math.min(C.length - 1, k + 1)];
    st.dps = (STORM_TIMES[k] || STORM_TIMES[STORM_TIMES.length - 1]).dps;
    if (S.mode === 'partie' && st.state === 'fermeture' && k < DROP_PHASES && st.dropK !== k) { st.dropK = k; spawnDrop(); }
    if (T < st.t0) return;
    // dégâts une fois par seconde, à ceux qui sont dehors (pas en l'air au-dessus de la montgolfière)
    S.stormTick += dt;
    if (S.stormTick < 1) return;
    S.stormTick -= 1;
    for (const Q of S.players.values()) {
      if (!Q.alive || Q.mode === 'ballon') continue;
      if (Math.hypot(Q.x - st.cur.x, Q.z - st.cur.z) > st.cur.r) damage(Q, st.dps, null, { storm: true, cause: 'tempete' });
    }
  }

  // ------------------------------------------------------------------ un pas de simulation
  function step(dt = DT) {
    S.t += dt;
    if (S.flight) {
      S.flight.t += dt;
      const over = S.flight.t * S.flight.speed >= S.flight.len;
      for (const P of S.players.values()) {
        if (P.mode !== 'ballon') continue;
        if (fired(P, 'jump') || over) jumpOut(P); else placeInBalloon(P);
      }
      if (S.phase === 'vol') { let any = false; for (const p of S.players.values()) if (p.mode === 'ballon') { any = true; break; } if (!any) S.phase = 'jeu'; }
    }
    if (S.hooks.think) for (const P of S.players.values()) if (P.bot && P.alive) S.hooks.think(P, dt);
    for (const P of S.players.values()) {
      if (!P.alive || P.mode === 'ballon') continue;
      const inp = P.inp;
      if (P.mode === 'chute' || P.mode === 'planeur') {
        const jump = fired(P, 'jump');
        if (stepAir(P, { ...inp, jump }, world, dt)) ev({ e: 'atterrit', p: P.id });
        continue;
      }
      if (P.down) {
        // à terre : on rampe, rien d'autre ; la réserve fond (la tempête l'entame aussi)
        fired(P, 'jump'); fired(P, 'use'); fired(P, 'shoot'); fired(P, 'reload'); fired(P, 'drop');
        stepPlayer(P, { mx: inp.mx, mz: inp.mz, yaw: inp.yaw, jump: false, sprint: false, crouch: true, k: CRAWL }, world, dt);
        P.pitch = inp.pitch;
        P.down.hp -= DOWN_HP / BLEED * dt;
        if (P.down.hp <= 0) eliminate(P, S.players.get(P.down.by) || null, P.down.cause);
        continue;
      }
      const jump = fired(P, 'jump');
      const slow = P.use ? 0.5 : inp.aim ? 0.7 : 1;
      const wasAir = !P.ground, x0 = P.x, z0 = P.z;
      stepPlayer(P, { mx: inp.mx, mz: inp.mz, yaw: inp.yaw, jump, sprint: inp.sprint && !P.use && !inp.aim, crouch: inp.crouch, k: slow }, world, dt);
      P.dist += Math.hypot(P.x - x0, P.z - z0);
      P.pitch = inp.pitch;
      if (P.ground && wasAir) {
        // dégâts de chute au-delà de FALL_SAFE mètres, proportionnels à la hauteur
        const h = P.fall * P.fall / (2 * MOVE.g);
        if (h > FALL_SAFE && !P.safeFall) damage(P, (h - FALL_SAFE) * 7, null, { cause: 'chute' });
        P.safeFall = false; P.fall = 0;
      }
      // tombé hors de l'île ou sous la mer : on remonte au bord (sécurité)
      if (P.y < -30) { P.y = world.support(P.x, P.z, 400); P.vy = 0; }
      if (P.alive) act(P, dt);
      if (P.revive) stepRevive(P, dt);
    }
    // un tiers de seconde de positions passées, pour viser juste malgré le décalage du réseau
    for (const P of S.players.values()) {
      if (!P.alive) continue;
      const tr = P.trail || (P.trail = []);
      // (on réutilise la plus ancienne entrée : pas de nouveau tableau à chaque pas)
      const a = tr.length >= 24 ? tr.shift() : [];
      a[0] = S.t; a[1] = P.x; a[2] = P.y; a[3] = P.z; a[4] = P.crouch;
      tr.push(a);
    }
    stepProjectiles(dt);
    stepStorm(dt);
    for (const d of S.drops.values()) if (!d.landed && S.t - d.t0 >= DROP_H / DROP_SPEED) { d.landed = true; ev({ e: 'largage-pose', id: d.id, x: d.x, y: d.gy, z: d.z }); }
    if (S.hooks.step) S.hooks.step(dt);
  }
  // repère d'équipe (le dernier de chaque joueur compte) ; what : ce qu'il désigne (« Fusil d'assaut épique »…)
  function ping(P, kind, x, y, z, target = null, what = '') {
    if (!P || !P.alive || !PING_KINDS.includes(kind) || ![x, y, z].every(Number.isFinite)) return false;
    const last = S.pings.get(P.id);
    if (last && S.t - last.t < 0.35) return false; // pas de rafale
    const pg = { p: P.id, team: P.team, kind, x, y, z, target: target ?? null, what: String(what || '').slice(0, 40), t: S.t };
    S.pings.set(P.id, pg);
    ev({ e: 'repere', ...pg });
    return true;
  }
  // relever un coéquipier : rester à côté, immobile, sans tirer, REVIVE secondes
  function stepRevive(P, dt) {
    const Q = S.players.get(P.revive.id);
    const moving = Math.abs(P.inp.mx) + Math.abs(P.inp.mz) > 0.1 || P.inp.fire;
    if (!P.alive || P.down || !Q || !Q.alive || !Q.down || moving || Math.hypot(Q.x - P.x, Q.z - P.z) > REVIVE_R + 0.6) {
      ev({ e: 'releve-', p: P.id, to: P.revive.id }); P.revive = null; return;
    }
    P.revive.t += dt;
    if (P.revive.t >= REVIVE) {
      Q.down = null; Q.hp = RAISE_HP; P.revive = null; P.revives++;
      ev({ e: 'releve', to: Q.id, by: P.id });
    }
  }
  function takeEvents() { const e = S.events; S.events = []; return e; }

  return {
    S, step, input, takeEvents, addPlayer, results, target, eye, trace, heldItem, alive, spawnItem, damage, explode, setDoor, balloonPos, leave, mates, ping,
    player: (id) => S.players.get(id),
  };
}
