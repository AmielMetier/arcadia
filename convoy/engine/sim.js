// Convoy Storm — simulation (moteur pur, sans DOM ni réseau ; testée par tools/test-convoy.mjs).
// L'hôte la fait tourner à 60 Hz et diffuse snapshot() 20 fois par seconde. Les invités rejouent stepPlayer()
// pour prédire leur propre déplacement (mêmes règles, même géométrie).
import { hash } from './rng.js';
import {
  DECK_Y, HALF_W, DECK_FRONT, REAR, BODY_FRONT, BOILER, LADDER, DECK_BOXES, CHUNK,
  chunkRuins, pushOutBox, piecePos, onDeckRect,
} from './world.js';

export const DT = 1 / 60;
export const FUEL_PER_CRATE = 25;
export const DIFFICULTY = {
  facile: { burn: 0.6, ramp: 0.10, loot: 0.8, label: 'Facile' },
  normal: { burn: 0.8, ramp: 0.15, loot: 0.65, label: 'Normale' },
  blizzard: { burn: 1.0, ramp: 0.22, loot: 0.5, label: 'Blizzard' },
};
export const VMAX = 2.6, VMIN = 1.0;              // vitesse du convoi (m/s) réservoir plein / presque vide
export const trainSpeedFor = (fuel) => (fuel <= 0 ? 0 : VMIN + (VMAX - VMIN) * Math.min(1, fuel / 60));
export const PR = 0.42;                           // rayon d'un joueur
const G = 22, JUMP_V = 7.0;
const SPEED_DECK = 5.6, SPEED_SNOW = 4.3, CARRY_K = 0.85, STUMBLE_K = 0.45, STUMBLE_T = 0.9;
export const LOST_DIST = 55;                      // au-delà, le joueur se perd dans la tempête
const LOST_T = 4, CLIMB_T = 0.7, SEARCH_T = 1.4;
const USE_R = 1.5, FEED_R = 2.4, SEARCH_R = 2.4, CRATE_H = 0.25, MAX_CRATES = 40;
const SPAWNS = [[-0.9, -6], [0.9, -6], [-0.9, 6.5], [0.9, 6.5], [-0.9, 14], [0.9, 14]];

const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ------------------------------------------------------------------ plaine : ruines mises en cache par tronçon */
export class Ruins {
  constructor(seed, lootRate) { this.seed = seed; this.loot = lootRate; this.cache = new Map(); }
  chunk(k) {
    let c = this.cache.get(k);
    if (!c) { c = chunkRuins(this.seed, k, this.loot); this.cache.set(k, c); }
    return c;
  }
  // tronçons visibles autour du convoi (repère du train : de -ahead devant à +behind derrière)
  around(dist, ahead = 85, behind = 95) {
    const k0 = Math.floor((dist - behind) / CHUNK), k1 = Math.floor((dist + ahead) / CHUNK);
    for (const k of this.cache.keys()) if (k < k0 - 2 || k > k1 + 2) this.cache.delete(k);
    const out = [];
    for (let k = k0; k <= k1; k++) out.push([k, this.chunk(k)]);
    return out;
  }
  // morceaux solides en repère du train
  colliders(dist) {
    const out = [];
    for (const [, c] of this.around(dist, 40, 70)) for (const r of c.ruins) for (const pc of r.pieces) {
      const p = piecePos(r, pc);
      out.push({ x: p.x, z: p.zw + dist, w: pc.w, d: pc.d, rot: p.rot, h: pc.h });
    }
    return out;
  }
}

/* ------------------------------------------------------------------ déplacement d'un joueur (partagé hôte / prédiction) */
// p : état du joueur ; inp : { mx, mz, jump } ; ctx : { v, colliders } ; ev : rappel d'événement (hôte seulement)
export function stepPlayer(p, inp, dt, ctx, ev) {
  if (p.st === 3) { // perdu dans la tempête : réapparition à l'arrière du convoi
    p.tm -= dt;
    if (p.tm <= 0) { Object.assign(p, { st: 0, tm: 0, x: 0, z: REAR - 1.2, y: DECK_Y, vx: 0, vy: 0, vz: 0, on: 1, ref: 1, air: 0 }); ev && ev({ e: 'respawn', p: p.id }); }
    return;
  }
  if (p.st === 2) { // grimpe à l'échelle
    p.tm -= dt; p.vx = p.vz = 0;
    p.x += (clamp(p.x, -0.6, 0.6) - p.x) * Math.min(1, dt * 10);
    p.y = DECK_Y * clamp(1 - p.tm / CLIMB_T, 0, 1);
    if (p.tm <= 0) { Object.assign(p, { st: 0, tm: 0, y: DECK_Y, z: REAR - 0.9, on: 1, ref: 1, air: 0, vy: 0 }); ev && ev({ e: 'board', p: p.id }); }
    return;
  }
  if (p.st === 1) { p.tm -= dt; if (p.tm <= 0) { p.st = 0; p.tm = 0; } }

  // commande
  let mx = Number(inp.mx) || 0, mz = Number(inp.mz) || 0;
  const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; }
  let sp = p.on ? SPEED_DECK : SPEED_SNOW;
  if (p.carry) sp *= CARRY_K;
  if (p.st === 1) sp *= STUMBLE_K;
  const k = p.air ? Math.min(1, dt * 3) : Math.min(1, dt * (p.on ? 14 : 8));
  p.vx += (mx * sp - p.vx) * k; p.vz += (mz * sp - p.vz) * k;
  if (m > 0.15) p.yaw = Math.atan2(mx, mz);

  // saut (compteur : une pression = un saut, même si un paquet se perd)
  if (p.pj == null) p.pj = inp.jump | 0;
  if ((inp.jump | 0) !== p.pj) { p.pj = inp.jump | 0; if (!p.air) { p.vy = JUMP_V; p.air = 1; } }

  // la neige file sous les pieds : hors du convoi, le sol recule à la vitesse du train
  const drift = p.ref ? 0 : ctx.v;
  p.x += p.vx * dt; p.z += (p.vz + drift) * dt;

  // vertical
  const wasAir = p.air;
  if (p.air) { p.vy -= G * dt; p.y += p.vy * dt; }
  const overDeck = onDeckRect(p.x, p.z);
  if (!p.air && p.on && !overDeck) { p.air = 1; p.vy = 0; } // on marche dans le vide : chute
  if (p.air) {
    const floor = overDeck && p.y >= DECK_Y - 0.35 ? DECK_Y : 0;
    if (p.y <= floor && p.vy <= 0) {
      p.y = floor; p.vy = 0; p.air = 0;
      if (floor === DECK_Y) { p.on = 1; p.ref = 1; }
      else {
        const fell = p.on || p.ref;
        p.on = 0; p.ref = 0;
        if (fell) { p.st = 1; p.tm = STUMBLE_T; p.falls = (p.falls | 0) + 1; ev && ev({ e: 'fall', p: p.id, x: p.x, z: p.z }); }
        else if (wasAir) ev && ev({ e: 'land', p: p.id, x: p.x, z: p.z });
      }
    }
  }

  // collisions
  const deckLevel = p.y > DECK_Y - 0.3;
  if (deckLevel && overDeck) {
    for (const b of DECK_BOXES) pushOutBox(p, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0, b.z1 - b.z0, 0, PR);
    const dx = p.x - BOILER.x, dz = p.z - BOILER.z, d = Math.hypot(dx, dz), mr = BOILER.r + PR;
    if (d < mr && p.y < BOILER.top) { const s = d > 1e-4 ? mr / d : 1; p.x = BOILER.x + (d > 1e-4 ? dx * s : mr); p.z = BOILER.z + dz * (d > 1e-4 ? s : 0); }
    if (p.z < DECK_FRONT + PR) p.z = DECK_FRONT + PR;
  } else if (!deckLevel || !overDeck) {
    if (p.y < DECK_Y - 0.1) {
      // flancs du convoi et chasse-neige
      if (Math.abs(p.x) < HALF_W + 0.15 + PR && p.z > BODY_FRONT - PR && p.z < REAR) {
        if (p.z < -17.2) { p.x = Math.sign(p.x || 1) * (HALF_W + 0.2 + PR); p.vx = Math.sign(p.x) * 3; } // le chasse-neige écarte
        else pushOutBox(p, 0, (BODY_FRONT + REAR) / 2, 2 * HALF_W + 0.3, REAR - BODY_FRONT, 0, PR);
      }
      for (const c of ctx.colliders) if (p.y < c.h && Math.abs(c.z - p.z) < 6 && Math.abs(c.x - p.x) < 6) pushOutBox(p, c.x, c.z, c.w, c.d, c.rot, PR);
    }
    // échelle de queue : on remonte à bord
    if (!p.on && p.y < 0.9 && Math.abs(p.x) <= LADDER.x && p.z >= LADDER.z0 && p.z <= LADDER.z1) {
      p.st = 2; p.tm = CLIMB_T; p.vx = p.vz = p.vy = 0; p.air = 0; p.z = REAR + 0.35;
      return;
    }
  }
  p.x = clamp(p.x, -45, 45);
  if (p.z < -70) p.z = -70;
  if (!p.on && p.z > REAR + LOST_DIST) {
    p.st = 3; p.tm = LOST_T; p.vx = p.vz = p.vy = 0; p.air = 0;
    const had = p.carry; p.carry = 0;
    ev && ev({ e: 'lost', p: p.id, crate: !!had });
  }
}

/* ------------------------------------------------------------------ simulation complète (hôte) */
export class Sim {
  constructor({ seed = 1, difficulty = 'normal' } = {}) {
    this.seed = seed | 0; this.diff = DIFFICULTY[difficulty] ? difficulty : 'normal';
    this.D = DIFFICULTY[this.diff];
    this.ruins = new Ruins(this.seed, this.D.loot);
    this.t = 0; this.phase = 'play'; this.dist = 0; this.v = 0; this.fuel = 100; this.stallT = 0; this.lowWarned = false;
    this.players = new Map(); this.crates = []; this.looted = new Set(); this.nid = 1; this.ks = -1; this.events = []; this.fedTotal = 0;
  }

  addPlayer({ id, name, color }) {
    if (this.players.has(id)) return this.players.get(id);
    const used = new Set([...this.players.values()].map((p) => p.slot));
    let slot = 0; while (used.has(slot)) slot++;
    const [x, z] = SPAWNS[slot % SPAWNS.length];
    const p = {
      id, name: String(name || 'Joueur').slice(0, 12), color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#2b8cff', slot,
      x, y: DECK_Y, z, vx: 0, vy: 0, vz: 0, yaw: Math.PI, on: 1, ref: 1, air: 0, st: 0, tm: 0, carry: 0,
      sp: 0, sr: -1, q: 0, pj: null, pt: null, pu: false, fed: 0, found: 0, falls: 0,
      inp: { mx: 0, mz: 0, jump: 0, use: false, thr: 0 },
    };
    this.players.set(id, p);
    return p;
  }

  // Un joueur parti (déconnexion) lâche sa caisse là où il était
  removePlayer(id) {
    const p = this.players.get(id); if (!p) return;
    if (p.carry && p.st !== 3) this.spawnCrate(p.x, p.on ? DECK_Y + CRATE_H : CRATE_H, p.z, p.on ? 1 : 0);
    this.players.delete(id);
    this.events.push({ e: 'left', p: id, n: p.name });
  }

  setInput(id, inp) { const p = this.players.get(id); if (p) { p.inp = inp; if (Number.isFinite(inp.q)) p.q = Math.max(p.q, inp.q); } }

  spawnCrate(x, y, z, m, vel) {
    if (this.crates.length >= MAX_CRATES) this.crates.shift();
    const c = { id: this.nid++, m, x, y, z: m === 0 ? z - this.dist : z, vx: 0, vy: 0, vz: 0, by: -99 };
    if (vel) Object.assign(c, vel);
    this.crates.push(c);
    return c;
  }
  humans() { return this.players.size; }
  burnRate() {
    const n = Math.max(1, this.players.size);
    return this.D.burn * Math.min(2.6, 1 + this.D.ramp * this.t / 60) * (1 + 0.15 * (n - 1));
  }

  step(dt = DT) {
    if (this.phase !== 'play') return;
    this.t += dt;
    // chaudière
    if (this.fuel > 0) this.fuel = Math.max(0, this.fuel - this.burnRate() * dt);
    if (this.fuel < 25 && !this.lowWarned) { this.lowWarned = true; this.events.push({ e: 'low' }); }
    if (this.fuel > 35) this.lowWarned = false;
    const target = trainSpeedFor(this.fuel);
    this.v += clamp(target - this.v, -0.45 * dt, 0.8 * dt);
    if (this.v < 0) this.v = 0;
    this.dist += this.v * dt;
    if (this.fuel <= 0 && this.v < 0.05) {
      if (this.stallT === 0) this.events.push({ e: 'stall' });
      this.stallT += dt;
      if (this.stallT > 3) { this.phase = 'over'; this.events.push({ e: 'over', dist: Math.round(this.dist) }); return; }
    } else this.stallT = 0;

    // caisses tombées d'un convoi précédent, quand un nouveau tronçon apparaît devant
    const kAhead = Math.floor((this.dist + 85) / CHUNK);
    while (this.ks < kAhead) {
      this.ks++;
      const L = this.ruins.chunk(this.ks).loose;
      if (L && L.zw + this.dist < REAR) this.spawnCrate(L.x, CRATE_H, L.zw + this.dist, 0);
    }
    // joueurs
    const ctx = { v: this.v, colliders: this.ruins.colliders(this.dist) };
    const ev = (e) => this.events.push(e);
    for (const p of this.players.values()) {
      stepPlayer(p, p.inp, dt, ctx, ev);
      this.interact(p, dt);
    }
    this.stepCrates(dt);
    // oubli des ruines fouillées loin derrière
    const kMin = Math.floor((this.dist - 120) / CHUNK) * 8;
    if (this.looted.size > 40) for (const id of this.looted) if (id < kMin) this.looted.delete(id);
  }

  interact(p, dt) {
    const inp = p.inp || {};
    const use = !!inp.use, useEdge = use && !p.pu; p.pu = use;
    if (p.pt == null) p.pt = inp.thr | 0;
    const thrEdge = (inp.thr | 0) !== p.pt; p.pt = inp.thr | 0;
    if (p.st >= 2) { p.sp = 0; return; }
    const onDeck = p.on && !p.air;
    // lancer
    if (thrEdge && p.carry) {
      p.carry = 0;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      const c = this.spawnCrate(p.x + fx * 0.5, p.y + 1.3, p.z + fz * 0.5, 2, { vx: fx * 6.5 + p.vx * 0.5, vy: 6.4, vz: fz * 6.5 + p.vz * 0.5 + (p.ref ? 0 : this.v) });
      c.by = p.id;
      this.events.push({ e: 'throw', p: p.id, x: p.x, z: p.z });
      return;
    }
    // nourrir la chaudière
    if (useEdge && p.carry && onDeck && Math.hypot(p.x - BOILER.x, p.z - BOILER.z) < FEED_R) { this.feed(p.id); p.carry = 0; return; }
    // ramasser
    if (useEdge && !p.carry && !p.air) {
      let best = null, bd = USE_R;
      for (const c of this.crates) {
        if (c.m === 2 || (c.m === 1) !== !!p.on) continue;
        const cz = c.m === 0 ? c.z + this.dist : c.z;
        const d = Math.hypot(c.x - p.x, cz - p.z);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) { this.crates.splice(this.crates.indexOf(best), 1); p.carry = 1; p.sp = 0; this.events.push({ e: 'pick', p: p.id, x: p.x, z: p.z }); return; }
    }
    // fouiller une ruine (maintenir)
    if (use && !p.carry && !p.on && !p.air) {
      const r = this.nearRuin(p.x, p.z);
      if (r) {
        if (p.sr !== r.id) { p.sr = r.id; p.sp = 0; }
        p.sp += dt / SEARCH_T;
        if (p.sp >= 1) {
          p.sp = 0; this.looted.add(r.id);
          const sz = r.spot.zw + this.dist;
          for (let i = 0; i < r.loot; i++) this.spawnCrate(r.spot.x - r.side * 0.8, CRATE_H, sz + (i ? 0.8 : -0.4), 0);
          p.found += r.loot;
          this.events.push(r.loot ? { e: 'found', p: p.id, n: r.loot, x: r.spot.x, z: sz } : { e: 'empty', p: p.id, x: r.spot.x, z: sz });
        }
        return;
      }
    }
    p.sp = Math.max(0, p.sp - dt * 2);
  }

  nearRuin(x, z) {
    let best = null, bd = SEARCH_R;
    for (const [, c] of this.ruins.around(this.dist, 40, 70)) for (const r of c.ruins) {
      if (this.looted.has(r.id)) continue;
      const d = Math.hypot(r.spot.x - x, r.spot.zw + this.dist - z);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  feed(byId) {
    const before = this.fuel;
    this.fuel = Math.min(100, this.fuel + FUEL_PER_CRATE);
    this.fedTotal++;
    const p = this.players.get(byId); if (p) p.fed++;
    this.events.push({ e: 'feed', p: byId, fu: Math.round(this.fuel), rescue: before <= 0 });
  }

  stepCrates(dt) {
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      if (c.m === 0) { if (c.z + this.dist > REAR + 90) this.crates.splice(i, 1); continue; }
      if (c.m === 1) continue;
      const py = c.y;
      c.vy -= G * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      const hd = Math.hypot(c.x - BOILER.x, c.z - BOILER.z);
      if (hd < BOILER.r + CRATE_H && c.y < BOILER.top && onDeckRect(c.x, c.z)) {
        if (py >= BOILER.top - 0.1 && hd < BOILER.mouth) { this.crates.splice(i, 1); this.feed(c.by); continue; } // en plein dans le foyer
        const s = (BOILER.r + CRATE_H) / Math.max(hd, 1e-3); c.x = BOILER.x + (c.x - BOILER.x) * s; c.z = BOILER.z + (c.z - BOILER.z) * s; c.vx = c.vz = 0;
      }
      if (onDeckRect(c.x, c.z) && c.y <= DECK_Y + CRATE_H && py > DECK_Y + CRATE_H - 0.3) {
        c.m = 1; c.y = DECK_Y + CRATE_H; c.vx = c.vy = c.vz = 0;
        c.x = clamp(c.x, -HALF_W + 0.3, HALF_W - 0.3);
        this.events.push({ e: 'thud', x: c.x, z: c.z, deck: 1 });
      } else if (c.y <= CRATE_H) {
        // au sol : la caisse rejoint le repère de la plaine
        if (Math.abs(c.x) < HALF_W + 0.4 && c.z > BODY_FRONT && c.z < REAR) c.x = Math.sign(c.x || 1) * (HALF_W + 0.5);
        c.m = 0; c.y = CRATE_H; c.z -= this.dist; c.vx = c.vy = c.vz = 0;
        this.events.push({ e: 'thud', x: c.x, z: c.z + this.dist });
      }
    }
  }

  drainEvents() { const e = this.events; this.events = []; return e; }

  // État diffusé (compact) : c'est aussi tout ce qu'il faut pour reprendre la partie (migration d'hôte)
  snapshot() {
    return {
      v: 1, t: r2(this.t), ph: this.phase, sd: this.seed, df: this.diff, d: r2(this.dist), sp: r2(this.v), fu: r2(this.fuel),
      st: r2(this.stallT), ks: this.ks, lw: this.lowWarned ? 1 : 0, nid: this.nid, ft: this.fedTotal, br: r2(this.burnRate()),
      P: [...this.players.values()].map((p) => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.vx), r2(p.vy), r2(p.vz), r2(p.yaw),
        p.on, p.air, p.ref, p.st, r2(p.tm), p.carry, r2(p.sp), p.q, p.pj ?? 0, p.fed, p.found, p.falls, p.slot]),
      N: [...this.players.values()].map((p) => [p.id, p.name, p.color]),
      C: this.crates.map((c) => [c.id, c.m, r2(c.x), r2(c.y), r2(c.z), r2(c.vx), r2(c.vy), r2(c.vz), c.by]),
      L: [...this.looted],
    };
  }

  static restore(s) {
    const sim = new Sim({ seed: s.sd, difficulty: s.df });
    Object.assign(sim, { t: s.t, phase: s.ph, dist: s.d, v: s.sp, fuel: s.fu, stallT: s.st, ks: s.ks ?? -1, lowWarned: !!s.lw, nid: s.nid, fedTotal: s.ft | 0 });
    const names = new Map(s.N.map(([id, n, c]) => [id, [n, c]]));
    for (const a of s.P) {
      const [n, c] = names.get(a[0]) || ['Joueur', '#2b8cff'];
      const p = sim.addPlayer({ id: a[0], name: n, color: c });
      Object.assign(p, playerFromRow(a));
      p.pt = null; p.pu = false;
    }
    sim.crates = s.C.map((c) => ({ id: c[0], m: c[1], x: c[2], y: c[3], z: c[4], vx: c[5], vy: c[6], vz: c[7], by: c[8] }));
    sim.looted = new Set(s.L);
    return sim;
  }
}

// Ligne P d'un snapshot → champs de joueur (utilisé par restore et par la prédiction des invités)
export function playerFromRow(a) {
  return { id: a[0], x: a[1], y: a[2], z: a[3], vx: a[4], vy: a[5], vz: a[6], yaw: a[7], on: a[8], air: a[9], ref: a[10], st: a[11], tm: a[12], carry: a[13], sp: a[14], q: a[15], pj: a[16], fed: a[17], found: a[18], falls: a[19], slot: a[20] };
}

export const personalScore = (p) => p.fed * 100 + p.found * 25;
export { DECK_Y, REAR, BOILER, HALF_W, DECK_FRONT, LADDER };
