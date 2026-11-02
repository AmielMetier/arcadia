// Plouf ! — simulation (sans DOM ni réseau) : joueurs, bousculades, prises et lancers, objets, mouettes, manches.
// L'hôte la fait tourner à 60 Hz et diffuse snapshot() 20 fois par seconde. Les invités rejouent stepPlayer()
// (le même code) pour prédire leur propre déplacement ; le reste (coups, prises, chutes, objets) vient de l'hôte.
import { makeRng } from './rng.js';
import { Arena, SHAPES, SHAPE_KEYS } from './arena.js';
import { botThink } from './bots.js';

export const DT = 1 / 60;
export const R = 0.42;                 // rayon d'un joueur (m)
export const G = 14;                   // pesanteur (un peu forte : les lancers restent vifs)
const SPEED = 4.6, ACC = 30;           // marche : vitesse et accélération
const CARRY_K = 0.78, CHARGE_K = 0.45; // ralenti quand on porte, quand on arme sa poussée
export const CHARGE_MAX = 0.8;         // poussée armée au maximum au bout de ce temps (s)
const LUNGE_T = 0.17, LUNGE_V0 = 8.5, LUNGE_V1 = 5.5;   // la ruée : durée, vitesse (petite tape → pleine charge)
const KB0 = 4.8, KB1 = 7;              // recul de celui qui est touché
const STUN0 = 0.32, STUN1 = 0.25;      // et le temps où il glisse sans contrôle
const PUSH_CD = 0.45;
const SLIDE = 2.8;                     // frottement quand on glisse, sonné (plus petit = on glisse plus loin)
const CATCH_V = 2.2;                   // arrivé au bord moins vite que ça, on se rattrape (on vacille) au lieu de tomber
const GRAB_R = 1.2, HOLD_MAX = 1.7, WRIGGLE = 0.22;     // portée de la prise, temps avant de se dégager, gain par appui
const THROW_P = { v: 7, vy: 4.6 }, THROW_O = { v: 9.5, vy: 3.4 };
const FALL_T = 1.1, BOB_T = 0.9;       // le plongeon, puis la bouée qui flotte avant de remonter
export const GULL_Y = 4.2;
const GULL_V = 6.5, GULL_CD = 3.2;     // mouette : vitesse, temps entre deux sardines
const FISH_R = 1.4, FISH_KB = 4.8;
export const WIND_V = 2.3;                    // coup de mistral : dérive (m/s)
const SHRINK_AT = 11, CORE_AT = 70;    // les planches du bord coulent dès 11 s ; celles du centre après 70 s
export const ST = { RUN: 0, AIR: 1, HELD: 2, FALL: 3, BOB: 4, GULL: 5 };
export const BOT_NAMES = ['Mouss', 'Zézette', 'Titou', 'Fanfan', 'Loulou', 'Pépé', 'Nono', 'Bibou'];
export const BOT_ID = 1000;            // les bots ont des numéros à partir de là (ceux du salon sont petits)
const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------------ déplacement d'un joueur (partagé hôte / invités)
// ctx : { arena, wind: { x, z }, frozen }. ev (facultatif) reçoit les événements (ruée, chute, atterrissage).
export function stepPlayer(p, inp, dt, ctx, ev) {
  const press = (inp.pc | 0) !== (p.pc | 0); p.pc = inp.pc | 0;
  if (p.cd > 0) p.cd = Math.max(0, p.cd - dt);
  const ix = +inp.mx || 0, iz = +inp.mz || 0, il = Math.hypot(ix, iz);
  if (ctx.frozen) { // compte à rebours : on peut seulement se tourner
    p.vx = p.vz = 0; p.chg = 0;
    if (p.st === ST.RUN && il > 0.2) turn(p, Math.atan2(ix, iz), 12 * dt);
    return press;
  }
  if (p.st === ST.RUN) run(p, ix, iz, il, inp, press, dt, ctx, ev);
  else if (p.st === ST.AIR) {
    p.x += p.vx * dt; p.z += p.vz * dt; p.vy -= G * dt; p.y += p.vy * dt;
    if (p.y <= 0 && p.vy <= 0) {
      p.y = 0; p.vy = 0;
      if (ctx.arena.support(p.x, p.z)) { p.st = ST.RUN; p.stun = Math.max(p.stun, 0.35); p.vx *= 0.45; p.vz *= 0.45; ev && ev.push({ e: 'land', id: p.id, x: r2(p.x), z: r2(p.z) }); }
      else fall(p, ev);
    }
  } else if (p.st === ST.FALL) {
    const f = Math.exp(-4 * dt);
    p.vx *= f; p.vz *= f; p.x += p.vx * dt; p.z += p.vz * dt;
    p.vy -= G * 0.35 * dt; p.y = Math.max(-1.6, p.y + p.vy * dt);
    p.tm -= dt;
  } else if (p.st === ST.BOB) {
    const f = Math.exp(-3 * dt);
    p.vx *= f; p.vz *= f; p.x += p.vx * dt; p.z += p.vz * dt; p.y = -0.15;
    p.tm -= dt;
  } else if (p.st === ST.GULL) {
    const k = Math.min(1, 7 * dt);
    p.vx += (ix * GULL_V - p.vx) * k; p.vz += (iz * GULL_V - p.vz) * k;
    p.x = clamp(p.x + p.vx * dt, -ctx.arena.hx - 2.5, ctx.arena.hx + 2.5);
    p.z = clamp(p.z + p.vz * dt, -ctx.arena.hz - 2.5, ctx.arena.hz + 2.5);
    p.y = GULL_Y;
    if (Math.hypot(p.vx, p.vz) > 0.5) turn(p, Math.atan2(p.vx, p.vz), 8 * dt);
  }
  return press;
}

function run(p, ix, iz, il, inp, press, dt, ctx, ev) {
  // pousser : l'appui arme la poussée (on ralentit), le lâcher lance la ruée droit devant
  if (press && !p.ck && p.cd <= 0 && p.lun <= 0 && p.stun <= 0) p.chg = 0.001;
  if (p.chg > 0) {
    if (p.stun > 0) p.chg = 0;                  // touché pendant qu'on armait : c'est perdu
    else if (inp.push) p.chg = Math.min(CHARGE_MAX, p.chg + dt);
    else {
      const k = Math.min(1, p.chg / CHARGE_MAX), v = LUNGE_V0 + LUNGE_V1 * k;
      p.chg = 0; p.lun = LUNGE_T; p.lk = k; p.cd = PUSH_CD;
      p.vx = Math.sin(p.yaw) * v; p.vz = Math.cos(p.yaw) * v;
      ev && ev.push({ e: 'lunge', id: p.id, k: r2(k) });
    }
  }
  if (p.lun <= 0 && il > 0.1) turn(p, Math.atan2(ix, iz), (p.chg > 0 ? 10 : 16) * dt);
  const W = ctx.wind;
  if (p.lun > 0) {
    p.lun -= dt;
    if (p.lun <= 0) { p.lun = 0; p.stun = Math.max(p.stun, 0.14); } // fin de la ruée : on glisse encore un peu
  } else if (p.stun > 0) {
    p.stun = Math.max(0, p.stun - dt);
    const f = Math.exp(-SLIDE * dt);
    p.vx = W.x + (p.vx - W.x) * f + ix * 6 * dt; p.vz = W.z + (p.vz - W.z) * f + iz * 6 * dt;
  } else {
    const s = SPEED * (p.ck ? CARRY_K : 1) * (p.chg > 0 ? CHARGE_K : 1);
    const tx = ix * s + W.x, tz = iz * s + W.z;
    let dx = tx - p.vx, dz = tz - p.vz;
    const dl = Math.hypot(dx, dz), mx = ACC * dt;
    if (dl > mx) { dx *= mx / dl; dz *= mx / dl; }
    p.vx += dx; p.vz += dz;
  }
  const px = p.x, pz = p.z;
  p.x += p.vx * dt; p.z += p.vz * dt;
  const s = ctx.arena.support(p.x, p.z);
  p.tee = s === 2 ? 1 : 0;
  if (s) return;
  // on arrive au bord : lentement, on se rattrape en moulinant des bras ; lancé, c'est le plongeon
  if (p.lun <= 0 && Math.hypot(p.vx, p.vz) < CATCH_V && ctx.arena.support(px, pz)) { p.x = px; p.z = pz; p.vx = p.vz = 0; p.tee = 1; return; }
  fall(p, ev);
}

function fall(p, ev) {
  p.st = ST.FALL; p.tm = FALL_T; p.vy = 0; p.chg = 0; p.lun = 0; p.tee = 0;
  ev && ev.push({ e: 'fall', id: p.id, x: r2(p.x), z: r2(p.z) });
}
function turn(p, a, k) {
  let d = a - p.yaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  p.yaw += clamp(d, -k, k);
}

// ------------------------------------------------------------------ partie
function newPlayer({ id, name, color, bot = false, level = 'normal' }) {
  return {
    id, name: String(name || '?').slice(0, 12), color, bot: !!bot, level,
    x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, yaw: 0,
    st: ST.RUN, tm: 0, stun: 0, chg: 0, lun: 0, lk: 0, cd: 0, tee: 0,
    ck: 0, cid: 0, by: -1, ht: 0,           // ce qu'on porte (1 objet, 2 joueur) ; qui nous porte, depuis quand
    buoy: 0, pc: 0, gs: 0, drop: 0,
    pts: 0, ko: 0, surv: 0, order: 0, hitBy: -1, hitT: -99, hits: null,
    inp: { mx: 0, mz: 0, push: false, pc: 0, gc: 0 }, ai: null,
  };
}

export class Sim {
  constructor({ seed = 1, goal = 3, items = true, wind = true } = {}) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.goal = clamp(goal | 0 || 3, 1, 9);
    this.items = !!items; this.windOn = !!wind;
    this.players = new Map();
    this.objs = []; this.nid = 1;
    this.t = 0; this.ph = 'wait'; this.pt = 0; this.rd = 0; this.rt = 0;
    this.arena = new Arena('radeau'); this.lastShape = '';
    this.wind = null; this.windT = 99; this.shrinkT = 0; this.itemT = 99; this.buoyT = 99;
    this.order = 0; this.rw = -1; this.win = -1;
    this.events = [];
  }

  addPlayer(o) {
    if (this.players.has(o.id)) return this.players.get(o.id);
    const p = newPlayer(o);
    this.players.set(p.id, p);
    // arrivée en pleine manche : mouette jusqu'à la manche suivante
    if (this.ph === 'play' || this.ph === 'round') { p.st = ST.GULL; p.y = GULL_Y; p.x = this.arena.cx; p.z = this.arena.cz - this.arena.hz - 1; }
    else if (this.ph === 'count') this.place([p], this.players.size - 1, this.players.size);
    return p;
  }
  removePlayer(id) {
    const p = this.players.get(id); if (!p) return;
    this.dropCarry(p);
    if (p.st === ST.HELD) { const c = this.players.get(p.by); if (c) { c.ck = 0; c.cid = 0; } }
    this.players.delete(id);
  }
  addBots(n, level = 'normal') {
    const used = new Set([...this.players.values()].map((p) => p.name));
    const names = BOT_NAMES.filter((x) => !used.has(x));
    const COLORS = ['#ff9f1c', '#2ec4b6', '#e71d36', '#7b2ff7', '#8ac926', '#ff70a6', '#3a86ff', '#ffd23f'];
    for (let i = 0; i < n; i++) this.addPlayer({ id: BOT_ID + i, name: names[i % names.length], color: COLORS[i % COLORS.length], bot: true, level });
  }
  setInput(id, inp) { const p = this.players.get(id); if (p && !p.bot) { p.inp = inp; p.q = inp.q | 0; } }
  start() { this.rd = 0; this.win = -1; for (const p of this.players.values()) { p.pts = 0; p.ko = 0; p.surv = 0; } this.startRound(); }

  startRound() {
    const rng = this.rng;
    const keys = SHAPE_KEYS.filter((k) => k !== this.lastShape);
    const key = this.rd === 0 ? 'radeau' : rng.pick(keys);
    this.lastShape = key;
    this.rd++;
    this.arena = new Arena(key, null, this.players.size >= 6);
    this.objs = []; this.wind = null;
    this.windT = rng.range(20, 30); this.shrinkT = 0; this.itemT = rng.range(4, 7); this.buoyT = rng.range(10, 16);
    this.rt = 0; this.ph = 'count'; this.pt = 3; this.order = 0; this.rw = -1;
    const list = rng.shuffle([...this.players.values()]);
    list.forEach((p, i) => this.place([p], i, list.length));
    this.events.push({ e: 'round', rd: this.rd, sh: key });
  }
  // place un joueur sur le cercle de départ, tourné vers le centre
  place(ps, i, n) {
    const A = this.arena;
    for (const p of ps) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.4;
      let x = A.cx + Math.sin(a) * A.spawnR, z = A.cz + Math.cos(a) * A.spawnR;
      if (A.support(x, z) !== 1) { const s = A.safeSpot(x, z); if (s) { x = s.x; z = s.z; } }
      Object.assign(p, { x, z, y: 0, vx: 0, vz: 0, vy: 0, yaw: Math.atan2(A.cx - x, A.cz - z), st: ST.RUN, tm: 0, stun: 0, chg: 0, lun: 0, cd: 0, tee: 0,
        ck: 0, cid: 0, by: -1, ht: 0, buoy: 0, drop: 0, order: 0, hitBy: -1, hitT: -99, hits: null });
    }
  }

  ctx() {
    const w = this.wind;
    const on = w && w.warn <= 0;
    return { arena: this.arena, wind: on ? { x: Math.sin(w.a) * WIND_V, z: Math.cos(w.a) * WIND_V } : { x: 0, z: 0 }, frozen: this.ph === 'count' };
  }

  step(dt) {
    this.t += dt;
    if (this.ph === 'wait' || this.ph === 'over') return;
    if (this.ph === 'count') {
      this.pt -= dt;
      const ctx = this.ctx();
      for (const p of this.players.values()) { if (p.bot) botThink(this, p, dt); stepPlayer(p, p.inp, dt, ctx, null); p.gs = p.inp.gc | 0; }
      if (this.pt <= 0) { this.ph = 'play'; this.events.push({ e: 'go' }); }
      return;
    }
    const live = this.ph === 'play';
    if (live) { this.rt += dt; this.stepArena(dt); this.stepWind(dt); this.stepSpawns(dt); }
    else this.wind = null;
    this.stepPlayers(dt, live);
    this.stepObjects(dt);
    if (live) this.checkRound();
    else { this.pt -= dt; if (this.pt <= 0) { if (this.win >= 0) { this.ph = 'over'; this.events.push({ e: 'over', id: this.win }); } else this.startRound(); } }
  }

  stepArena(dt) {
    const A = this.arena, rng = this.rng;
    if (this.rt > SHRINK_AT) {
      this.shrinkT -= dt;
      if (this.shrinkT <= 0) {
        this.shrinkT = 1.7 - 1.15 * clamp((this.rt - SHRINK_AT) / 55, 0, 1);
        const edges = A.edges(this.rt < CORE_AT);
        if (edges.length) {
          // de préférence loin du centre : le radeau rétrécit par le bord
          edges.sort((a, b) => A.d2(b, A.cx, A.cz) - A.d2(a, A.cx, A.cz));
          const i = edges[Math.floor(rng.next() * Math.ceil(edges.length / 2))];
          A.shake(i);
          this.events.push({ e: 'shake', i });
        }
      }
    }
    for (const i of A.step(dt)) this.events.push({ e: 'sink', i });
  }

  stepWind(dt) {
    if (!this.windOn) return;
    const w = this.wind;
    if (!w) {
      this.windT -= dt;
      if (this.windT <= 0) {
        this.wind = { a: Math.floor(this.rng.next() * 8) * Math.PI / 4, warn: 1.6, on: 3.2 };
        this.events.push({ e: 'windWarn', a: r2(this.wind.a) });
      }
      return;
    }
    if (w.warn > 0) { w.warn -= dt; if (w.warn <= 0) this.events.push({ e: 'wind', a: r2(w.a) }); }
    else { w.on -= dt; if (w.on <= 0) { this.wind = null; this.windT = this.rng.range(13, 20); } }
  }

  stepSpawns(dt) {
    if (!this.items) return;
    this.itemT -= dt;
    if (this.itemT <= 0) { this.itemT = this.rng.range(6, 10); if (this.objs.filter((o) => o.k === 'melon').length < 2) this.spawnObj('melon'); }
    this.buoyT -= dt;
    if (this.buoyT <= 0) {
      this.buoyT = this.rng.range(14, 20);
      const need = [...this.players.values()].some((p) => p.st === ST.RUN && !p.buoy);
      if (need && !this.objs.some((o) => o.k === 'buoy')) this.spawnObj('buoy');
    }
  }
  spawnObj(k) {
    const A = this.arena, cells = [];
    for (let i = 0; i < A.st.length; i++) if (A.st[i] === 1) cells.push(i);
    if (!cells.length) return;
    // loin du bord si possible : un objet qui tombe à l'eau tout de suite ne sert à rien
    cells.sort((a, b) => A.d2(a, A.cx, A.cz) - A.d2(b, A.cx, A.cz));
    const c = A.center(cells[Math.floor(this.rng.next() * Math.ceil(cells.length * 0.6))]);
    const o = { id: this.nid++, k, x: c.x, z: c.z, y: 6, vx: 0, vz: 0, vy: 0, st: 2, by: -1, age: 0 };
    this.objs.push(o);
    this.events.push({ e: 'drop', k, x: r2(o.x), z: r2(o.z) });
  }

  stepPlayers(dt, live) {
    const ctx = this.ctx();
    const ps = [...this.players.values()];
    for (const p of ps) {
      if (p.bot) botThink(this, p, dt);
      const inp = p.inp;
      const grab = (inp.gc | 0) !== (p.gs | 0); p.gs = inp.gc | 0;
      if (p.st === ST.HELD) { // on gigote pour se dégager
        if ((inp.pc | 0) !== (p.pc | 0) || grab) p.ht += WRIGGLE;
        p.pc = inp.pc | 0;
        continue;
      }
      const press = stepPlayer(p, inp, dt, ctx, this.events);
      // le plongeon sans bouée : éliminé dès qu'il touche l'eau (la manche peut finir sans attendre la mouette)
      if (p.st === ST.FALL && !p.buoy && !p.order && live) this.out(p);
      if (p.st === ST.RUN && grab) this.grabOrThrow(p);
      if (p.st === ST.GULL && (press || grab) && p.cd <= 0) this.dropFish(p);
    }
    // ce qu'on porte suit, et celui qu'on porte finit par se dégager
    for (const p of ps) {
      if (!p.ck) continue;
      if (p.st !== ST.RUN || p.stun > 0) { this.dropCarry(p); continue; }
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      if (p.ck === 2) {
        const h = this.players.get(p.cid);
        if (!h || h.st !== ST.HELD) { p.ck = 0; p.cid = 0; continue; }
        h.x = p.x + fx * 0.1; h.z = p.z + fz * 0.1; h.y = 1.15; h.vx = p.vx; h.vz = p.vz; h.yaw = p.yaw + Math.PI / 2;
        h.ht += dt;
        if (h.ht >= HOLD_MAX) {
          this.dropCarry(p);
          h.x = p.x + fx * 0.8; h.z = p.z + fz * 0.8; h.vx = fx * 2; h.vz = fz * 2;
          this.events.push({ e: 'escape', id: h.id });
        }
      } else {
        const o = this.objs.find((q) => q.id === p.cid);
        if (!o) { p.ck = 0; p.cid = 0; continue; }
        o.x = p.x + fx * 0.15; o.z = p.z + fz * 0.15; o.y = 1.3; o.vx = p.vx; o.vz = p.vz;
      }
    }
    // la ruée : on bouscule ceux qu'on touche devant soi
    for (const p of ps) {
      if (p.st !== ST.RUN || p.lun <= 0) continue;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      for (const q of ps) {
        if (q === p || q.st !== ST.RUN) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        if (d > 2 * R + 0.25 || d < 1e-4 || (dx * fx + dz * fz) / d < 0.25) continue;
        const nx = fx * 0.6 + dx / d * 0.4, nz = fz * 0.6 + dz / d * 0.4, nl = Math.hypot(nx, nz);
        this.hit(q, nx / nl, nz / nl, KB0 + KB1 * p.lk, STUN0 + STUN1 * p.lk, p.id);
        this.events.push({ e: 'hit', id: q.id, by: p.id, k: r2(p.lk), x: r2((p.x + q.x) / 2), z: r2((p.z + q.z) / 2) });
        p.lun = 0; p.vx *= 0.2; p.vz *= 0.2; p.stun = Math.max(p.stun, 0.18);
        break;
      }
    }
    // chocs entre joueurs (on se bouscule en marchant ; un joueur qui glisse entraîne les autres)
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; if (p.st !== ST.RUN) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const q = ps[j]; if (q.st !== ST.RUN) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        if (d >= 2 * R || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, push = (2 * R - d) / 2;
        p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push;
        const vrel = (q.vx - p.vx) * nx + (q.vz - p.vz) * nz;
        if (vrel < 0) {
          const j2 = -1.2 * vrel / 2;
          p.vx -= nx * j2; p.vz -= nz * j2; q.vx += nx * j2; q.vz += nz * j2;
          // le plus rapide est l'auteur du choc (ou celui qui l'a envoyé glisser)
          const sp = Math.hypot(p.vx, p.vz), sq = Math.hypot(q.vx, q.vz);
          if (-vrel > 3) {
            const [a, b] = sp > sq ? [p, q] : [q, p];
            const author = a.stun > 0 && a.hitBy >= 0 && this.t - a.hitT < 2 ? a.hitBy : a.id;
            if (author !== b.id) { b.hitBy = author; b.hitT = this.t; }
            b.stun = Math.max(b.stun, 0.15);
            this.events.push({ e: 'bump', x: r2((p.x + q.x) / 2), z: r2((p.z + q.z) / 2) });
          }
        }
      }
    }
    // chutes : la bouée sauve une fois, sinon on devient mouette
    for (const p of ps) {
      if (p.st === ST.FALL && p.tm <= 0) {
        if (p.buoy) { p.buoy = 0; p.st = ST.BOB; p.tm = BOB_T; this.events.push({ e: 'bob', id: p.id }); }
        else this.eliminate(p);
      } else if (p.st === ST.BOB && p.tm <= 0) {
        const s = this.arena.safeSpot(p.x, p.z);
        if (!s) { if (live && !p.order) this.out(p); this.eliminate(p); continue; }
        const ft = 0.75;
        p.st = ST.AIR; p.y = 0.01; p.vx = (s.x - p.x) / ft; p.vz = (s.z - p.z) / ft; p.vy = G * ft / 2;
        this.events.push({ e: 'rebound', id: p.id });
      }
    }
  }

  hit(q, nx, nz, kb, stun, by) {
    if (q.st === ST.HELD) return;
    q.vx = nx * kb + q.vx * 0.2; q.vz = nz * kb + q.vz * 0.2;
    q.stun = Math.max(q.stun, stun); q.chg = 0; q.lun = 0;
    if (by !== q.id) { q.hitBy = by; q.hitT = this.t; }
    this.dropCarry(q);
  }

  grabOrThrow(p) {
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    if (p.ck) { // lancer ce qu'on porte, droit devant
      if (p.ck === 2) {
        const h = this.players.get(p.cid);
        if (h && h.st === ST.HELD) {
          h.st = ST.AIR; h.y = 1.2; h.by = -1; h.stun = 0;
          h.vx = fx * THROW_P.v + p.vx * 0.4; h.vz = fz * THROW_P.v + p.vz * 0.4; h.vy = THROW_P.vy;
          h.hitBy = p.id; h.hitT = this.t;
        }
      } else {
        const o = this.objs.find((q) => q.id === p.cid);
        if (o) { o.st = 2; o.by = p.id; o.vx = fx * THROW_O.v + p.vx * 0.3; o.vz = fz * THROW_O.v + p.vz * 0.3; o.vy = THROW_O.vy; o.y = 1.3; }
      }
      this.events.push({ e: 'throw', id: p.id, k: p.ck });
      p.ck = 0; p.cid = 0;
      return;
    }
    if (p.chg > 0 || p.lun > 0 || p.stun > 0) return;
    // prendre ce qui est devant soi : une pastèque, ou un joueur
    let best = null, bd = GRAB_R;
    const front = (dx, dz, d) => d < 0.55 || (dx * fx + dz * fz) / d > 0.3;
    for (const o of this.objs) {
      if (o.st !== 0 || o.k !== 'melon') continue;
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
      if (d < bd && front(dx, dz, d)) { bd = d; best = { o }; }
    }
    for (const q of this.players.values()) {
      if (q === p || q.st !== ST.RUN || q.lun > 0) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < bd && front(dx, dz, d)) { bd = d; best = { q }; }
    }
    if (!best) { this.events.push({ e: 'miss', id: p.id }); return; }
    if (best.o) { best.o.st = 1; best.o.by = p.id; p.ck = 1; p.cid = best.o.id; }
    else {
      const q = best.q;
      this.dropCarry(q);
      q.st = ST.HELD; q.by = p.id; q.ht = 0; q.chg = 0; q.vx = q.vz = 0; q.stun = 0;
      p.ck = 2; p.cid = q.id;
    }
    this.events.push({ e: 'grab', id: p.id, who: best.q ? best.q.id : -1 });
  }

  dropCarry(p) {
    if (!p.ck) return;
    if (p.ck === 2) {
      const h = this.players.get(p.cid);
      if (h && h.st === ST.HELD) { h.st = ST.RUN; h.y = 0; h.by = -1; h.stun = 0.15; }
    } else {
      const o = this.objs.find((q) => q.id === p.cid);
      if (o) { o.st = 2; o.vy = 1; o.by = -1; }
    }
    p.ck = 0; p.cid = 0;
  }

  dropFish(p) {
    p.cd = GULL_CD;
    this.objs.push({ id: this.nid++, k: 'fish', x: p.x + p.vx * 0.15, z: p.z + p.vz * 0.15, y: GULL_Y - 0.3, vx: p.vx * 0.3, vz: p.vz * 0.3, vy: 0, st: 2, by: p.id, age: 0 });
    this.events.push({ e: 'caw', id: p.id });
  }

  // tombé à l'eau pour de bon : rang d'élimination, temps passé au sec, et le point à celui qui l'a poussé
  out(p) {
    this.dropCarry(p);
    p.order = ++this.order; p.surv += this.rt;
    const by = p.hitBy >= 0 && this.t - p.hitT < 5 ? this.players.get(p.hitBy) : null;
    if (by && by !== p) by.ko++;
    this.events.push({ e: 'out', id: p.id, by: by && by !== p ? by.id : -1 });
  }
  // la mouette remplace le joueur une fois le plongeon fini
  eliminate(p) {
    if (p.st === ST.GULL) return;
    this.dropCarry(p);
    p.st = ST.GULL; p.y = GULL_Y; p.vx = p.vz = 0; p.stun = 0; p.chg = 0; p.lun = 0; p.cd = 1.5;
  }

  stepObjects(dt) {
    const A = this.arena;
    for (const o of this.objs) {
      o.age += dt;
      if (o.st === 1) continue;
      if (o.st === 2) {
        o.x += o.vx * dt; o.z += o.vz * dt; o.vy -= G * dt; o.y += o.vy * dt;
        // une pastèque lancée renverse le premier qu'elle touche
        if (o.k === 'melon' && o.by >= 0 && Math.hypot(o.vx, o.vz) > 3) {
          for (const q of this.players.values()) {
            if (q.id === o.by || (q.st !== ST.RUN && q.st !== ST.AIR) || q.y > 1.7) continue;
            const dx = q.x - o.x, dz = q.z - o.z;
            if (Math.hypot(dx, dz) > R + 0.4 || o.y > 1.9) continue;
            const v = Math.hypot(o.vx, o.vz);
            this.hit(q, o.vx / v, o.vz / v, 9.5, 0.5, o.by);
            this.events.push({ e: 'splat', id: q.id, by: o.by, x: r2(o.x), z: r2(o.z) });
            o.dead = 1; break;
          }
          if (o.dead) continue;
        }
        if (o.y <= 0 && o.vy <= 0) {
          o.y = 0;
          const s = A.support(o.x, o.z);
          if (o.k === 'fish') { // la sardine de la mouette : petit choc autour du point d'impact
            for (const q of this.players.values()) {
              if (q.st !== ST.RUN) continue;
              const dx = q.x - o.x, dz = q.z - o.z, d = Math.hypot(dx, dz);
              if (d > FISH_R) continue;
              const nx = d > 0.05 ? dx / d : 1, nz = d > 0.05 ? dz / d : 0, k = 1 - d / FISH_R * 0.5;
              this.hit(q, nx, nz, FISH_KB * k + 1, 0.3, o.by);
            }
            this.events.push({ e: 'fish', x: r2(o.x), z: r2(o.z), w: s ? 0 : 1 });
            o.dead = 1; continue;
          }
          if (!s) { this.events.push({ e: 'plop', x: r2(o.x), z: r2(o.z), k: o.k }); o.dead = 1; continue; }
          o.st = 0; o.vx *= 0.3; o.vz *= 0.3; o.vy = 0; o.by = -1;
          this.events.push({ e: 'thud', x: r2(o.x), z: r2(o.z), k: o.k });
        }
      } else { // au sol : roule un peu, coule avec sa planche, la bouée se ramasse en passant dessus
        const f = Math.exp(-5 * dt);
        o.vx *= f; o.vz *= f; o.x += o.vx * dt; o.z += o.vz * dt;
        if (!A.support(o.x, o.z) || o.age > 40) { this.events.push({ e: 'plop', x: r2(o.x), z: r2(o.z), k: o.k }); o.dead = 1; continue; }
        if (o.k === 'buoy') {
          for (const q of this.players.values()) {
            if (q.st !== ST.RUN || q.buoy || Math.hypot(q.x - o.x, q.z - o.z) > R + 0.35) continue;
            q.buoy = 1; o.dead = 1;
            this.events.push({ e: 'buoy', id: q.id });
            break;
          }
        }
      }
    }
    if (this.objs.some((o) => o.dead)) this.objs = this.objs.filter((o) => !o.dead);
  }

  alive() { return [...this.players.values()].filter((p) => p.st !== ST.GULL && !(p.st === ST.FALL && !p.buoy)); }

  checkRound() {
    const al = this.alive(), n = this.players.size;
    if (n === 0 || al.length > (n > 1 ? 1 : 0)) return;
    this.ph = 'round'; this.pt = 3.4;
    const w = al.length === 1 ? al[0] : null;
    this.rw = w ? w.id : -1;
    if (w) {
      w.pts++; w.surv += this.rt;
      if (w.pts >= this.goal) this.win = w.id;
    }
    this.events.push({ e: 'roundEnd', id: this.rw, rd: this.rd, win: this.win });
  }

  // classement : manches gagnées, puis adversaires tombés, puis temps passé au sec
  ranking() {
    return [...this.players.values()].sort((a, b) => b.pts - a.pts || b.ko - a.ko || b.surv - a.surv);
  }

  drainEvents() { const e = this.events; this.events = []; return e; }

  snapshot() {
    const w = this.wind;
    return {
      t: Math.round(this.t * 1000) / 1000, ph: this.ph, pt: r2(this.pt), rd: this.rd, rt: r2(this.rt), go: this.goal, rw: this.rw, win: this.win,
      sh: this.arena.key, bg: this.arena.big, ti: this.arena.encode(), wd: w ? [r2(w.a), r2(w.warn), r2(w.on)] : 0, it: this.items ? 1 : 0, wo: this.windOn ? 1 : 0,
      P: [...this.players.values()].map((p) => [p.id, r2(p.x), r2(p.z), r2(p.y), r2(p.vx), r2(p.vz), r2(p.vy), r2(p.yaw), p.st, r2(p.tm), r2(p.stun),
        r2(p.chg), r2(p.lun), r2(p.cd), p.ck, p.cid, p.buoy, p.pc, p.pts, p.ko, p.tee, p.by, r2(p.ht), r2(p.surv), p.order, p.q | 0]),
      N: [...this.players.values()].map((p) => [p.id, p.name, p.color, p.bot ? 1 : 0, p.level]),
      O: this.objs.map((o) => [o.id, o.k, r2(o.x), r2(o.z), r2(o.y), o.st]),
    };
  }

  // nouvel hôte : la partie reprend du dernier état reçu
  static restore(s) {
    const sim = new Sim({ seed: (Math.random() * 2 ** 31) | 0, goal: s.go, items: !!s.it, wind: !!s.wo });
    sim.t = s.t; sim.ph = s.ph; sim.pt = s.pt; sim.rd = s.rd; sim.rt = s.rt; sim.rw = s.rw; sim.win = s.win;
    sim.arena = new Arena(s.sh, s.ti, !!s.bg); sim.lastShape = s.sh;
    sim.wind = s.wd ? { a: s.wd[0], warn: s.wd[1], on: s.wd[2] } : null;
    sim.windT = 10; sim.itemT = 4; sim.buoyT = 12; sim.shrinkT = 0.5;
    const names = new Map(s.N.map(([id, n, c, b, l]) => [id, { name: n, color: c, bot: !!b, level: l }]));
    for (const row of s.P) {
      const q = playerFromRow(row), nm = names.get(q.id) || {};
      const p = newPlayer({ id: q.id, name: nm.name, color: nm.color, bot: nm.bot, level: nm.level });
      Object.assign(p, q);
      p.inp = { mx: 0, mz: 0, push: false, pc: p.pc, gc: 0 }; p.gs = 0;
      sim.players.set(p.id, p);
    }
    for (const [id, k, x, z, y, st] of s.O) { sim.objs.push({ id, k, x, z, y, vx: 0, vz: 0, vy: 0, st, by: -1, age: 0 }); sim.nid = Math.max(sim.nid, id + 1); }
    // ce que portent les joueurs : retrouvé à partir des objets portés et des joueurs portés
    for (const p of sim.players.values()) if (p.ck === 2 && !sim.players.has(p.cid)) { p.ck = 0; p.cid = 0; }
    return sim;
  }
}

export function playerFromRow(r) {
  return { id: r[0], x: r[1], z: r[2], y: r[3], vx: r[4], vz: r[5], vy: r[6], yaw: r[7], st: r[8], tm: r[9], stun: r[10], chg: r[11], lun: r[12], cd: r[13],
    ck: r[14], cid: r[15], buoy: r[16], pc: r[17], pts: r[18], ko: r[19], tee: r[20], by: r[21], ht: r[22], surv: r[23], order: r[24], q: r[25] | 0, lk: 0 };
}

export { SHAPES, Arena };
