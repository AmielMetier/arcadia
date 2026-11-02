// Mollo ! — la simulation (sans DOM ni réseau) : des pantins physiques, sept points reliés par des contraintes
// (bassin, poitrine, tête, deux mains, deux pieds), intégrés par Verlet et tenus debout par des muscles : des ressorts
// vers une pose, qui lâchent quand on encaisse. Coudes et genoux n'existent qu'à l'affichage (view/pantin.js).
// L'hôte fait tourner tout ça à 60 Hz et diffuse snapshot() 20 fois par seconde ; les invités affichent, sans prédire.
import { makeRng } from './rng.js';
import { Arena, ARENA_KEYS, KILL_Y } from './arena.js';
import { botThink } from './bots.js';

export const DT = 1 / 60;
export const PN = { P: 0, C: 1, H: 2, LH: 3, RH: 4, LF: 5, RF: 6 };
const { P, C, H, LH, RH, LF, RF } = PN;
const G = 19;                         // pesanteur : un peu forte, les corps retombent lourdement
const DAMP = 0.992;
const TORSO = 0.44, NECK = 0.38, ARM = 0.7, LEG = 0.9, STAND = 0.84;
const SHOULDER = 0.26, HIP = 0.14;
const RADII = [0.24, 0.27, 0.27, 0.1, 0.1, 0.11, 0.11], WEIGHT = [1, 1, 1.5, 3.2, 3.2, 2.4, 2.4]; // inverse de la masse : les mains suivent, le tronc pèse
const SPEED = 3.7, ACC = 20, AIR_ACC = 4;
export const JUMP_V = 6.6;
export const KO_T = 2.8; const KO_MASH = 0.16, DZ_DECAY = 0.12;
const PUNCH_T = 0.17, PUNCH_CD = 0.27; export const CHARGE_T = 0.32;
const KICK_T = 0.36;
const P_POWER = 3.4, P_DZ = 0.24, H_POWER = 6.4, H_DZ = 0.46, K_POWER = 8.5, K_DZ = 0.62;
const GRIP_MAX = 7;                   // on se fatigue à tenir : au bout de 7 s, ça glisse
const HOLD_MAX = 5;                   // tenir quelqu'un qui se débat
const THROW_V = 8.5, THROW_VY = 4.2, RELEASE_V = 2.4;
export const SUDDEN_AT = 75;          // mort subite : des bourrasques de plus en plus fortes
export const ST = { LIVE: 0, KO: 1, OUT: 2 };
// les drapeaux d'un joueur dans l'instantané
export const FL = { GRIP: 3, LIFTING: 4, CHARGE: 8, KICK: 16, GROUND: 32, LIFTED: 64, HELD: 128, HANG: 256 };
export const BOT_NAMES = ['Gros Mou', 'Flan', 'Guimauve', 'Tofu', 'Nougat', 'Bibendum', 'Patate', 'Marsh'];
export const BOT_ID = 1000;
export const COLORS = ['#ff9f1c', '#2ec4b6', '#e71d36', '#7b2ff7', '#8ac926', '#ff70a6', '#3a86ff', '#ffd23f'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function mk(x, y, z, r, w) { return { x, y, z, px: x, py: y, pz: z, r, w, on: null }; }
function newBody({ id, name, color, bot = false, level = 'normal' }) {
  const p = []; for (let i = 0; i < 7; i++) p.push(mk(0, 1, 0, RADII[i], WEIGHT[i]));
  return { id, name: String(name || '?').slice(0, 12), color, bot: !!bot, level, p, yaw: 0, st: ST.LIVE,
    m: 1, dip: 0, dz: 0, ko: 0, phase: 0, vault: 0, vx: 0, vz: 0, grip: [null, null], gripT: 0, gripCd: 0, heldBy: 0, lifting: 0, liftedBy: -1,
    punchT: 0, punchH: 0, punchCd: 0, power: 1, hitDone: false, charge: 0, kick: 0, jumpCd: 0, grounded: false, gy: 0, gbox: null,
    hitBy: -1, hitT: -99, pts: 0, kos: 0, surv: 0, order: 0, pc: 0, jc: 0, gc: 0, inp: { mx: 0, mz: 0, jump: false, punch: false, grab: false, pc: 0, jc: 0, gc: 0 }, ai: null };
}
// vitesse (par pas) d'un point
const vel = (a, ax, ay, az) => { a.px -= ax; a.py -= ay; a.pz -= az; };
// un muscle : déplace le point vers sa pose ; l'essentiel du déplacement ne devient pas de la vitesse (sinon le corps vibre et s'envole),
// le peu qui reste (keep) donne le côté gélatine
function pull(a, x, y, z, k, keep = 0.1) {
  const dx = (x - a.x) * k, dy = (y - a.y) * k, dz = (z - a.z) * k, r = 1 - keep;
  a.x += dx; a.y += dy; a.z += dz; a.px += dx * r; a.py += dy * r; a.pz += dz * r;
}
function dist(a, b, L, stiff = 1, onlyMax = false, onlyMin = 0) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-5;
  if (onlyMax && d <= L && d >= onlyMin) return;
  const tgt = onlyMax && d < onlyMin ? onlyMin : L;
  const s = a.w + b.w, c = (d - tgt) / d / s * stiff;
  a.x += dx * c * a.w; a.y += dy * c * a.w; a.z += dz * c * a.w;
  b.x -= dx * c * b.w; b.y -= dy * c * b.w; b.z -= dz * c * b.w;
}
// épaule (virtuelle) : à côté de la poitrine, selon le lacet
export function shoulder(b, side, o = _o) { const c = b.p[C], cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); o.x = c.x + side * cs * SHOULDER; o.y = c.y + 0.1; o.z = c.z - side * sn * SHOULDER; return o; }
const _o = { x: 0, y: 0, z: 0 };

export class Sim {
  constructor({ seed = 1, goal = 3, hazards = true } = {}) {
    this.seed = seed >>> 0; this.rng = makeRng(this.seed);
    this.goal = clamp(goal | 0 || 3, 1, 9); this.hazards = !!hazards;
    this.players = new Map(); this.t = 0; this.at = 0; this.ph = 'wait'; this.pt = 0; this.rd = 0; this.rt = 0; this.rw = -1; this.win = -1; this.order = 0;
    this.arena = new Arena('toits'); this.lastKey = ''; this.gust = null; this.gustT = 0; this.events = [];
  }
  addPlayer(o) {
    if (this.players.has(o.id)) return this.players.get(o.id);
    const b = newBody(o); this.players.set(b.id, b);
    if (this.ph === 'play' || this.ph === 'round') { b.st = ST.OUT; b.order = -1; this.park(b); }
    else if (this.ph === 'count') this.place(b, this.players.size - 1);
    return b;
  }
  removePlayer(id) {
    const b = this.players.get(id); if (!b) return;
    this.releaseAll(b);
    for (const o of this.players.values()) { for (let i = 0; i < 2; i++) if (o.grip[i] && o.grip[i].o === b) o.grip[i] = null; if (o.liftedBy === id) o.liftedBy = -1; }
    this.players.delete(id);
  }
  addBots(n, level = 'normal') {
    const used = new Set([...this.players.values()].map((p) => p.name)), names = BOT_NAMES.filter((x) => !used.has(x));
    for (let i = 0; i < n; i++) this.addPlayer({ id: BOT_ID + i, name: names[i % names.length], color: COLORS[i % COLORS.length], bot: true, level });
  }
  setInput(id, inp) { const b = this.players.get(id); if (b && !b.bot) b.inp = inp; }
  start() { this.rd = 0; this.win = -1; for (const b of this.players.values()) { b.pts = 0; b.kos = 0; b.surv = 0; } this.startRound(); }
  startRound(key) {
    const keys = ARENA_KEYS.filter((k) => k !== this.lastKey);
    const k = key || (this.rd === 0 ? 'toits' : this.rng.pick(keys));
    this.lastKey = k; this.rd++; this.arena = new Arena(k); this.at = 0; this.rt = 0; this.ph = 'count'; this.pt = 3; this.order = 0; this.rw = -1; this.gust = null; this.gustT = 8;
    if (!this.hazards) { this.arena.balls = []; for (const b of this.arena.boxes) if (b.crush) { b.move = null; b.y = 40; b.by = 40; } }
    [...this.players.values()].forEach((b, i) => this.place(b, i));
    this.events.push({ e: 'round', rd: this.rd, ar: k });
  }
  place(b, i) {
    const sp = this.arena.spawns, order = this.rd % 2 ? i : sp.length - 1 - i, [x, z] = sp[order % sp.length];
    const yaw = Math.atan2(-x, -z);
    const c = Math.cos(yaw), s = Math.sin(yaw), g = (this.arena.groundAt(x, z, 50) || { y: 0 }).y;
    const pos = [[x, g + STAND, z], [x, g + STAND + TORSO, z], [x, g + STAND + TORSO + NECK, z],
      [x - c * 0.3, g + STAND + 0.1, z + s * 0.3], [x + c * 0.3, g + STAND + 0.1, z - s * 0.3], [x - c * HIP, g + 0.11, z + s * HIP], [x + c * HIP, g + 0.11, z - s * HIP]];
    pos.forEach((q, j) => { const a = b.p[j]; a.x = a.px = q[0]; a.y = a.py = q[1]; a.z = a.pz = q[2]; a.on = null; });
    Object.assign(b, { yaw, st: ST.LIVE, m: 1, dip: 0, dz: 0, ko: 0, grip: [null, null], gripT: 0, gripCd: 0, vault: 0, heldBy: 0, lifting: 0, liftedBy: -1, punchT: 0, punchCd: 0, charge: 0, kick: 0, jumpCd: 0, hitBy: -1, hitT: -99, order: 0 });
  }
  park(b) { for (const a of b.p) { a.x = a.px = 0; a.y = a.py = KILL_Y - 5; a.z = a.pz = 0; } }

  step(dt = DT) {
    this.t += dt;
    if (this.ph === 'wait' || this.ph === 'over') return;
    this.at += dt; this.arena.update(this.at, dt);
    const frozen = this.ph === 'count';
    if (frozen) { this.pt -= dt; if (this.pt <= 0) { this.ph = 'play'; this.events.push({ e: 'go' }); } }
    const live = this.ph === 'play';
    if (live) { this.rt += dt; this.stepGust(dt); }
    const bs = [...this.players.values()];
    for (const b of bs) if (b.st !== ST.OUT) { if (b.bot) botThink(this, b, dt); this.control(b, frozen ? { ...b.inp, mx: 0, mz: 0, jump: false, punch: false, grab: false } : b.inp, dt); }
    for (const b of bs) if (b.st !== ST.OUT) this.integrate(b);
    for (let it = 0; it < 4; it++) {
      for (const b of bs) if (b.st !== ST.OUT) this.solve(b);
      this.solveBodies(bs);
      for (const b of bs) if (b.st !== ST.OUT) this.collideWorld(b);
    }
    for (const b of bs) if (b.st !== ST.OUT) { this.attacks(b, bs); this.hazardsOn(b, dt); this.checkOut(b, live); }
    if (live) this.checkRound();
    else if (this.ph === 'round') { this.pt -= dt; if (this.pt <= 0) { if (this.win >= 0) { this.ph = 'over'; this.events.push({ e: 'over', id: this.win }); } else this.startRound(); } }
  }

  stepGust(dt) {
    if (this.rt < SUDDEN_AT) return;
    if (this.gust) { this.gust.t -= dt; if (this.gust.t <= 0) { this.gust = null; this.gustT = 3; } return; }
    this.gustT -= dt;
    if (this.gustT <= 0) { const a = this.rng.next() * Math.PI * 2; this.gust = { x: Math.sin(a), z: Math.cos(a), t: 1.6, k: Math.min(14, 6 + (this.rt - SUDDEN_AT) * 0.15) }; this.events.push({ e: 'gust' }); }
    if (this.rt - dt < SUDDEN_AT + dt) this.events.push({ e: 'sudden' });
  }

  // ------------------------------------------------------------------ les muscles : ce que veut le corps
  control(b, inp, dt) {
    const p = b.p, pel = p[P], che = p[C], hea = p[H];
    const press = (inp.pc | 0) !== b.pc, jumpPress = (inp.jc | 0) !== b.jc, grabPress = (inp.gc | 0) !== b.gc;
    b.pc = inp.pc | 0; b.jc = inp.jc | 0; b.gc = inp.gc | 0;
    if (b.punchCd > 0) b.punchCd -= dt; if (b.jumpCd > 0) b.jumpCd -= dt;
    if (b.dz > 0 && b.st === ST.LIVE) b.dz = Math.max(0, b.dz - DZ_DECAY * dt);
    if (b.dip > 0) b.dip = Math.max(0, b.dip - dt * 1.5);
    // KO : plus aucun muscle ; marteler raccourcit
    if (b.st === ST.KO) {
      if (press || jumpPress) b.ko -= KO_MASH;
      b.ko -= dt;
      if (b.ko <= 0) { b.st = ST.LIVE; b.dz = 0.35; b.dip = 0.65; this.events.push({ e: 'wake', id: b.id }); }
      b.m = 0;
      return;
    }
    b.m = Math.min(b.m + dt * 1.6, 1 - b.dip);
    if (b.heldBy > 0 && press) for (const o of this.players.values()) if (o.grip.some((q) => q && q.o === b)) o.gripT += 0.5;
    const m = Math.max(0, b.m);
    const lifted = b.liftedBy >= 0;
    // l'appui : ce qu'il y a sous le bassin
    const g = this.arena.groundAt(pel.x, pel.z, pel.y + 0.1);
    const footOn = p[LF].on || p[RF].on;
    const h = g ? pel.y - g.y : 99;
    const grounded = !!g && !lifted && h < STAND + 0.3 && (footOn || h < STAND + 0.1 || h < 0.6);
    if (!grounded) b.fallV = Math.max(b.fallV || 0, (pel.py - pel.y) / DT);
    else { if (!b.grounded && b.fallV > 4.5) this.events.push({ e: 'land', id: b.id, k: Math.min(1, b.fallV / 12), x: +pel.x.toFixed(2), y: +g.y.toFixed(2), z: +pel.z.toFixed(2) }); b.fallV = 0; }
    b.grounded = grounded; b.gy = g ? g.y : 0; b.gbox = grounded ? g.box : null;
    // le regard
    const il = Math.hypot(inp.mx, inp.mz);
    if (il > 0.15 && !b.kick) { let d = Math.atan2(inp.mx, inp.mz) - b.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; b.yaw += clamp(d, -9 * dt, 9 * dt); }
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw);
    // se déplacer : le tronc rejoint la vitesse voulue (celle de ce qu'il y a sous les pieds, plus la marche)
    const carrying = b.grip.some((q) => q && q.o), slow = carrying ? 0.72 : 1, hold = b.heldBy > 0 ? 0.55 : 1;
    const bx = b.gbox ? b.gbox.vx + (b.gbox.belt ? b.gbox.belt[0] : 0) : 0, bz = b.gbox ? b.gbox.vz + (b.gbox.belt ? b.gbox.belt[1] : 0) : 0;
    const tx = inp.mx * SPEED * slow * hold * (0.4 + 0.6 * m) + bx, tz = inp.mz * SPEED * slow * hold * (0.4 + 0.6 * m) + bz;
    const a = (grounded ? ACC * (0.25 + 0.75 * m) : AIR_ACC) * dt;
    if (grounded || il > 0.1) for (const i of [P, C]) {
      const q = p[i], vx = (q.x - q.px) / DT, vz = (q.z - q.pz) / DT;
      let dx = tx - vx, dz = tz - vz; const l = Math.hypot(dx, dz);
      if (l > a) { dx *= a / l; dz *= a / l; }
      q.px -= dx * DT; q.pz -= dz * DT;
    }
    // tenir debout : le bassin à hauteur, la poitrine au-dessus, la tête au-dessus (les ressorts mollissent quand on encaisse)
    const speed = Math.hypot((pel.x - pel.px) / DT - bx, (pel.z - pel.pz) / DT - bz);
    if (grounded) {
      const dy = g.y + STAND - pel.y;
      if (dy > -0.05) { const d = Math.max(0, Math.min(dy, 0.1)) * 0.35 * m; pel.y += d; pel.py += d * 0.9; const vy = pel.y - pel.py; if (vy < 0) pel.py = pel.y - vy * (1 - 0.5 * m); }
    }
    const air = grounded ? 1 : 0.5;
    const lean = clamp(speed * 0.045, 0, 0.2) - (b.charge > 0 ? 0.14 : 0);
    if (!lifted) {
      pull(che, pel.x + fx * lean, pel.y + TORSO, pel.z + fz * lean, 0.3 * m * air);
      pull(hea, che.x + fx * lean * 0.8, che.y + NECK, che.z + fz * lean * 0.8, 0.26 * m * air);
    }
    // sauter
    if (jumpPress && grounded && b.jumpCd <= 0 && m > 0.45 && !b.grip[0] && !b.grip[1]) {
      b.jumpCd = 0.45;
      for (const q of p) { q.py = q.y - JUMP_V * DT; }
      this.events.push({ e: 'jump', id: b.id });
    }
    // les pieds : chacun sa foulée, calée sur la vitesse pour qu'un pied posé ne patine pas
    const stride = 0.34;
    b.phase += (speed / stride) * dt;
    if (grounded && !b.kick) {
      for (const [i, side, ph] of [[LF, -1, 0], [RF, 1, Math.PI]]) {
        const moving = clamp(speed / 1.2, 0, 1), sw = Math.sin(b.phase + ph), up = Math.max(0, Math.cos(b.phase + ph));
        const mvx = speed > 0.1 ? ((pel.x - pel.px) / DT - bx) / speed : fx, mvz = speed > 0.1 ? ((pel.z - pel.pz) / DT - bz) / speed : fz;
        const X = pel.x + side * sx * HIP + mvx * sw * stride * moving, Z = pel.z + side * sz * HIP + mvz * sw * stride * moving;
        pull(p[i], X, g.y + 0.11 + up * 0.24 * moving, Z, 0.42 * m);
      }
    } else if (!b.kick) for (const [i, side] of [[LF, -1], [RF, 1]]) pull(p[i], pel.x + side * sx * HIP - fx * 0.1, pel.y - LEG * 0.82, pel.z + side * sz * HIP - fz * 0.1, 0.08 * m);
    if (b.vault > 0) {
      b.vault -= dt;
      for (const t of [P, C, H]) { const u = p[t]; u.px = u.x - b.vx * 3.2 * DT; u.pz = u.z - b.vz * 3.2 * DT; if (u.y - u.py < 1.6 * DT) u.py = u.y - 1.6 * DT; }
      for (const t of [LF, RF]) pull(p[t], pel.x, pel.y - 0.3, pel.z, 0.45, 0);
    }
    // les mains : pendent en balançant, frappent, ou se tendent pour agripper
    this.arms(b, inp, press, jumpPress, grabPress, dt, m, fx, fz, sx, sz, speed);
    // mort subite : la bourrasque
    if (this.gust) for (const q of p) vel(q, this.gust.x * this.gust.k * DT * DT * 8, 0, this.gust.z * this.gust.k * DT * DT * 8);
  }

  arms(b, inp, press, jumpPress, grabPress, dt, m, fx, fz, sx, sz, speed) {
    const p = b.p, che = p[C], hea = p[H], pel = p[P];
    // ------- frapper : un appui bref, un coup de poing ; maintenu, un gros ; en l'air et lancé, un coup de pied sauté
    const free = !b.grip[0] && !b.grip[1];
    if (press && free) b.charge = Math.max(b.charge, 0.001);
    if (inp.punch && free && b.charge > 0) b.charge += dt;
    if (!free) b.charge = 0;
    if (press && !b.grounded && b.kick <= 0 && Math.hypot(pel.x - pel.px, pel.z - pel.pz) / DT > 1.5 && !b.heldBy) {
      b.kick = KICK_T; b.power = 1; b.hitDone = false; b.charge = 0; this.events.push({ e: 'kick', id: b.id });
    }
    if (b.charge > 0 && !inp.punch) {
      const big = b.charge >= CHARGE_T;
      if (b.punchCd <= 0) { b.punchT = PUNCH_T * (big ? 1.4 : 1); b.punchH = b.punchH ? 0 : 1; b.punchCd = big ? 0.5 : PUNCH_CD; b.power = big ? 2 : 1; b.hitDone = false; this.events.push({ e: 'swing', id: b.id, k: big ? 1 : 0 }); }
      b.charge = 0;
    }
    if (b.punchT > 0) b.punchT -= dt;
    if (b.kick > 0) {
      b.kick -= dt;
      // les deux pieds devant, le corps couché en arrière
      for (const i of [LF, RF]) pull(p[i], pel.x + fx * 0.85, pel.y + 0.02, pel.z + fz * 0.85, 0.5);
      pull(che, pel.x - fx * 0.4, pel.y + 0.25, pel.z - fz * 0.4, 0.2);
      if (b.kick <= 0) b.dip = Math.max(b.dip, 0.5);
    }
    // ------- agripper
    const want = inp.grab && m > 0.3;
    if (!want) { for (let i = 0; i < 2; i++) if (b.grip[i]) this.letGo(b, i); }
    if (b.gripCd > 0) b.gripCd -= dt;
    b.gripT = b.grip[0] || b.grip[1] ? b.gripT + dt : 0;
    if (b.gripT > (b.grip.some((q) => q && q.box) ? GRIP_MAX : HOLD_MAX)) { for (let i = 0; i < 2; i++) if (b.grip[i]) this.letGo(b, i, true); b.gripT = 0; b.gripCd = 0.6; }
    const holdingBox = b.grip.some((q) => q && q.box);
    const body = b.grip.find((q) => q && q.o);
    // se hisser : tenir une boîte et sauter ; les bras tirent jusqu'à ce que le bassin passe le rebord, puis on bascule par-dessus
    if (holdingBox && inp.jump) {
      const q = b.grip.find((x) => x && x.box), A = { ...this.anchor(q) };
      const rx = (A.x - q.box.x) / q.box.hx, rz = (A.z - q.box.z) / q.box.hz;
      const ix = Math.abs(rx) >= Math.abs(rz) ? -Math.sign(rx) : 0, iz = ix ? 0 : -Math.sign(rz);
      const up = clamp((A.y + 0.42 - pel.y) * 7, 0, 3.4) + (q.box.vy || 0);
      for (const t of [P, C, H]) { p[t].py = p[t].y - up * DT; }
      if (pel.y > A.y + 0.3) {
        b.vault = 0.38; b.vx = ix; b.vz = iz; // la bascule : les jambes se replient pour ne pas rester coincées contre le mur
        for (let i = 0; i < 2; i++) if (b.grip[i]) this.letGo(b, i);
        b.gripCd = 0.7;
        this.events.push({ e: 'climb', id: b.id });
      }
    }
    // soulever : tenir quelqu'un et sauter
    if (body && inp.jump && !b.lifting && b.grounded) {
      const o = body.o;
      if (o.st === ST.KO || o.dz > 0.4 || o.dip > 0.25) { b.lifting = 1; o.liftedBy = b.id; this.events.push({ e: 'lift', id: b.id, who: o.id }); }
    }
    if (b.lifting && !body) { b.lifting = 0; }
    if (b.lifting && body) {
      const o = body.o, q = o.p, top = hea.y + 0.5;
      const k = o.st === ST.KO ? 0.3 : 0.2;
      pull(q[P], hea.x - fx * 0.05, top, hea.z - fz * 0.05, k); pull(q[C], hea.x + sx * 0.44, top + 0.02, hea.z + sz * 0.44, k); pull(q[H], hea.x + sx * 0.82, top + 0.04, hea.z + sz * 0.82, k);
      for (const t of q) { t.py = t.y - (t.y - t.py) * 0.5; }
    }
    // ------- chaque main
    const reachS = _s0;
    for (let i = 0; i < 2; i++) {
      const hand = p[LH + i], side = i ? 1 : -1, S = shoulder(b, side, reachS);
      if (b.grip[i]) { // la main tenue ne fait rien d'autre ; en portant à bout de bras, elle monte
        if (b.lifting) pull(hand, hea.x + side * sx * 0.2, hea.y + 0.42, hea.z + side * sz * 0.2, 0.4);
        continue;
      }
      if (want) {
        // viser ce qu'il y a de plus proche : un autre pantin, sinon un rebord (debout, pas le sol : seulement ce qui dépasse)
        let T = null;
        let bd = 1.5, O = null;
        for (const o of this.players.values()) {
          if (o === b || o.st === ST.OUT) continue;
          const c = o.p[C], d = Math.hypot(c.x - che.x, c.y - che.y, c.z - che.z);
          if (d < bd && ((c.x - che.x) * fx + (c.z - che.z) * fz) / (d || 1) > -0.1) { bd = d; O = o; }
          const pe = o.p[P], d2 = Math.hypot(pe.x - che.x, pe.y - che.y, pe.z - che.z);
          if (o.st === ST.KO && d2 < bd) { bd = d2; O = o; }
        }
        if (O) {
          const tg = O.st === ST.KO ? O.p[C] : O.p[C];
          T = { x: tg.x + side * sx * 0.12, y: tg.y, z: tg.z + side * sz * 0.12 };
        } else {
          const n = this.arena.nearestGrip(S.x + fx * 0.2, S.y + (b.grounded ? 0 : 0.2), S.z + fz * 0.2, 1.05, b.grounded ? pel.y - 0.1 : -99);
          if (n) T = { x: n.x + side * sx * 0.14, y: n.y, z: n.z + side * sz * 0.14 };
        }
        if (T) pull(hand, T.x, T.y, T.z, 0.42);
        else pull(hand, S.x + fx * 0.6, S.y + 0.02, S.z + fz * 0.6, 0.3);
        this.tryGrip(b, i, hand);
      } else if (b.punchT > 0 && b.punchH === i) {
        const k = b.power > 1 ? 1.0 : 0.82;
        pull(hand, che.x + fx * k + side * sx * 0.06, che.y + 0.12, che.z + fz * k + side * sz * 0.06, 0.62);
      } else if (b.charge > 0 && b.punchH !== i) { // armer : le poing en arrière
        pull(hand, che.x - fx * 0.3 + side * sx * 0.25, che.y + 0.1, che.z - fz * 0.3 + side * sz * 0.25, 0.3 * m);
      } else {
        const sw = Math.sin(b.phase + (i ? 0 : Math.PI)) * clamp(speed / 3, 0, 1) * 0.3;
        pull(hand, S.x + side * sx * 0.08 + fx * sw, S.y - ARM * 0.86, S.z + side * sz * 0.08 + fz * sw, 0.09 * m);
      }
    }
    void jumpPress; void grabPress;
  }
  anchor(q) { if (q.box) { _a.x = q.box.x + q.lx; _a.y = q.box.y + q.ly; _a.z = q.box.z + q.lz; } else { const t = q.o.p[q.pi]; _a.x = t.x; _a.y = t.y; _a.z = t.z; } return _a; }
  tryGrip(b, i, hand) {
    if (b.gripCd > 0) return;
    for (const o of this.players.values()) {
      if (o === b || o.st === ST.OUT) continue;
      for (const pi of [H, C, P, LH, RH]) {
        const t = o.p[pi], d = Math.hypot(t.x - hand.x, t.y - hand.y, t.z - hand.z);
        if (d < t.r + hand.r + 0.1) {
          b.grip[i] = { o, pi, d: Math.min(t.r, 0.2) }; o.heldBy++;
          if (!b.grip[1 - i] || !b.grip[1 - i].o) this.events.push({ e: 'grab', id: b.id, who: o.id });
          return;
        }
      }
    }
    for (const q of this.arena.boxes) {
      if (!q.grip) continue;
      const dx = Math.max(Math.abs(hand.x - q.x) - q.hx, 0), dy = Math.max(Math.abs(hand.y - q.y) - q.hy, 0), dz = Math.max(Math.abs(hand.z - q.z) - q.hz, 0);
      if (Math.hypot(dx, dy, dz) > hand.r + 0.05) continue;
      // debout, on ne s'accroche pas au sol qu'on a sous les pieds
      if (b.grounded && q === b.gbox && hand.y < b.p[P].y) continue;
      b.grip[i] = { box: q, lx: hand.x - q.x, ly: hand.y - q.y, lz: hand.z - q.z };
      if (!b.grip[1 - i]) this.events.push({ e: 'hold', id: b.id });
      return;
    }
  }
  letGo(b, i, slip = false) {
    const q = b.grip[i]; if (!q) return;
    b.grip[i] = null;
    if (!q.o) { if (slip) this.events.push({ e: 'slip', id: b.id }); return; }
    const o = q.o; o.heldBy = Math.max(0, o.heldBy - 1);
    if (b.grip[1 - i] && b.grip[1 - i].o === o) return; // l'autre main le tient encore
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    const up = b.lifting ? THROW_VY : 1, v = slip ? 0 : b.lifting ? THROW_V : RELEASE_V;
    if (b.lifting || !slip) for (const t of o.p) { vel(t, fx * v * DT, up * DT, fz * v * DT); }
    if (o.liftedBy === b.id) { o.liftedBy = -1; o.dip = Math.max(o.dip, 0.8); }
    o.hitBy = b.id; o.hitT = this.t;
    if (b.lifting) this.events.push({ e: 'throw', id: b.id, who: o.id });
    b.lifting = 0;
  }
  releaseAll(b) { for (let i = 0; i < 2; i++) if (b.grip[i]) this.letGo(b, i, true); b.lifting = 0; }

  // ------------------------------------------------------------------ la physique
  integrate(b) {
    for (const q of b.p) {
      const vx = (q.x - q.px) * DAMP, vy = (q.y - q.py) * DAMP, vz = (q.z - q.pz) * DAMP;
      q.px = q.x; q.py = q.y; q.pz = q.z;
      const lim = 0.36; // pas plus vite que ~21 m/s : rien ne traverse une planche
      q.x += clamp(vx, -lim, lim); q.y += clamp(vy, -lim, lim) - G * DT * DT; q.z += clamp(vz, -lim, lim);
      q.on = null;
    }
  }
  solve(b) {
    const p = b.p;
    dist(p[P], p[C], TORSO, 0.9); dist(p[C], p[H], NECK, 0.9);
    dist(p[P], p[H], TORSO + NECK, 0.2, true, 0.45);
    for (let i = 0; i < 2; i++) {
      const hand = p[LH + i], side = i ? 1 : -1, S = shoulder(b, side, _s0);
      // bras : pas plus long que le bras ; la main tire sur la poitrine
      const dx = hand.x - S.x, dy = hand.y - S.y, dz = hand.z - S.z, d = Math.hypot(dx, dy, dz) || 1e-5;
      if (d > ARM) { const che = p[C], grip = b.grip[i], hw = grip ? 0.25 : hand.w, s = hw + che.w, c = (d - ARM) / d / s; hand.x -= dx * c * hw; hand.y -= dy * c * hw; hand.z -= dz * c * hw; che.x += dx * c * che.w; che.y += dy * c * che.w; che.z += dz * c * che.w; }
      const g = b.grip[i];
      if (g) {
        if (g.box) { const A = this.anchor(g); hand.x = A.x; hand.y = A.y; hand.z = A.z; }
        else { const t = g.o.p[g.pi]; dist(hand, t, g.d, 0.8); }
      }
      // jambes
      const foot = p[LF + i], hx = Math.cos(b.yaw) * side * HIP, hz = -Math.sin(b.yaw) * side * HIP;
      const fx = foot.x - (p[P].x + hx), fy = foot.y - p[P].y, fz = foot.z - (p[P].z + hz), fd = Math.hypot(fx, fy, fz) || 1e-5;
      if (fd > LEG || fd < 0.22) { const tgt = fd > LEG ? LEG : 0.22, s = foot.w + p[P].w, c = (fd - tgt) / fd / s; foot.x -= fx * c * foot.w; foot.y -= fy * c * foot.w; foot.z -= fz * c * foot.w; p[P].x += fx * c * p[P].w; p[P].y += fy * c * p[P].w; p[P].z += fz * c * p[P].w; }
    }
  }
  solveBodies(bs) {
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (a.st === ST.OUT) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j]; if (b.st === ST.OUT) continue;
        if (Math.abs(a.p[P].x - b.p[P].x) > 2.6 || Math.abs(a.p[P].z - b.p[P].z) > 2.6 || Math.abs(a.p[P].y - b.p[P].y) > 2.8) continue;
        for (const m of [P, C, H]) for (const n of [P, C, H]) {
          const u = a.p[m], v = b.p[n], dx = v.x - u.x, dy = v.y - u.y, dz = v.z - u.z, r = u.r + v.r, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= r * r || d2 < 1e-8) continue;
          const d = Math.sqrt(d2), c = (r - d) / d * 0.5 * 0.7;
          u.x -= dx * c; u.y -= dy * c; u.z -= dz * c; v.x += dx * c; v.y += dy * c; v.z += dz * c;
        }
      }
    }
  }
  collideWorld(b) {
    for (let i = 0; i < 7; i++) {
      const q = b.p[i];
      if (i >= LH && i <= RH && b.grip[i - LH]) continue;
      if (b.vault > 0 && i >= LF) continue;
      const fr = i === LF || i === RF ? (b.m > 0.3 ? 0.08 : 0.3) : 0.3;
      const on = this.arena.collide(q, fr);
      if (on) q.on = on;
    }
  }

  // ------------------------------------------------------------------ les coups
  attacks(b, bs) {
    if (b.st !== ST.LIVE) return;
    const p = b.p;
    let tips = null, power = 0, dz = 0;
    if (b.kick > 0 && !b.hitDone) { tips = [p[LF], p[RF]]; power = K_POWER; dz = K_DZ; }
    else if (b.punchT > 0 && !b.hitDone) { tips = [p[LH + b.punchH]]; power = b.power > 1 ? H_POWER : P_POWER; dz = b.power > 1 ? H_DZ : P_DZ; }
    if (!tips) return;
    for (const o of bs) {
      if (o === b || o.st === ST.OUT || o.liftedBy === b.id) continue;
      for (const tip of tips) for (const pi of [H, C, P]) {
        const t = o.p[pi], d = Math.hypot(t.x - tip.x, t.y - tip.y, t.z - tip.z);
        if (d > t.r + tip.r + 0.08) continue;
        const nx = Math.sin(b.yaw), nz = Math.cos(b.yaw), head = pi === H;
        b.hitDone = true;
        this.hurt(o, nx, 0.25, nz, power * (head ? 1.15 : 1), dz * (head ? 1.5 : 1), b.id);
        vel(p[C], -nx * 0.6 * DT, 0, -nz * 0.6 * DT);
        // frappé pendant qu'il tient quelque chose : il peut lâcher
        this.events.push({ e: 'hit', id: o.id, by: b.id, k: b.kick > 0 ? 1 : b.power > 1 ? 0.7 : 0, head: head ? 1 : 0, x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2) });
        return;
      }
    }
  }
  hurt(o, nx, ny, nz, power, dz, by) {
    for (const t of o.p) vel(t, nx * power * DT, ny * power * DT, nz * power * DT);
    if (by >= 0) { o.hitBy = by; o.hitT = this.t; }
    o.dip = Math.max(o.dip, 0.5 + dz * 0.6);
    if (o.st === ST.KO) { o.ko = Math.max(o.ko, 1); return; }
    o.dz += dz; o.charge = 0;
    // le coup fait lâcher une main
    for (let i = 0; i < 2; i++) if (o.grip[i] && this.rng.next() < 0.3 + dz) { this.letGo(o, i, true); }
    if (o.dz >= 1) {
      o.st = ST.KO; o.ko = KO_T; o.dz = 1; this.releaseAll(o);
      this.events.push({ e: 'ko', id: o.id, by, x: +o.p[H].x.toFixed(2), y: +o.p[H].y.toFixed(2), z: +o.p[H].z.toFixed(2) });
    }
  }
  hazardsOn(b, dt) {
    const A = this.arena, c = b.p[C];
    for (const q of A.balls) {
      const dx = c.x - q.x, dy = c.y - q.y, dz = c.z - q.z, d = Math.hypot(dx, dy, dz);
      if (d < q.r + 0.42 && (b.ballCd || 0) <= 0) {
        b.ballCd = 0.8;
        const v = Math.hypot(q.vx, q.vz) || 1;
        this.hurt(b, q.vx / v, 0.35, q.vz / v, 5 + v * 1.1, 0.45, -1);
        this.events.push({ e: 'ball', id: b.id, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2) });
      }
    }
    if (b.ballCd > 0) b.ballCd -= dt;
    for (const q of A.boxes) {
      if (!q.crush || q.vy >= -1) continue;
      const bot = q.y - q.hy;
      if (Math.abs(c.x - q.x) < q.hx && Math.abs(c.z - q.z) < q.hz && bot < b.p[H].y + 0.3 && bot > c.y - 0.5 && (b.ballCd || 0) <= 0) {
        b.ballCd = 1;
        const a = Math.atan2(c.x - q.x, c.z - q.z);
        this.hurt(b, Math.sin(a), -0.2, Math.cos(a), 7, 0.8, -1);
        this.events.push({ e: 'crush', id: b.id, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2) });
      }
    }
  }
  checkOut(b, live) {
    if (b.p[P].y > KILL_Y) return;
    this.releaseAll(b);
    for (const o of this.players.values()) for (let i = 0; i < 2; i++) if (o.grip[i] && o.grip[i].o === b) this.letGo(o, i, true);
    b.st = ST.OUT; b.heldBy = 0; b.liftedBy = -1;
    if (live) {
      b.order = ++this.order; b.surv += this.rt;
      const by = b.hitBy >= 0 && this.t - b.hitT < 8 ? this.players.get(b.hitBy) : null;
      if (by && by !== b) by.kos++;
      this.events.push({ e: 'out', id: b.id, by: by && by !== b ? by.id : -1 });
    } else this.events.push({ e: 'out', id: b.id, by: -1 });
    this.park(b);
  }
  alive() { return [...this.players.values()].filter((b) => b.st !== ST.OUT); }
  checkRound() {
    const al = this.alive(), n = this.players.size;
    if (n === 0 || al.length > (n > 1 ? 1 : 0)) return;
    this.ph = 'round'; this.pt = 3.6;
    const w = al.length === 1 ? al[0] : null; this.rw = w ? w.id : -1;
    if (w) { w.pts++; w.surv += this.rt; if (w.pts >= this.goal) this.win = w.id; }
    this.events.push({ e: 'roundEnd', id: this.rw, rd: this.rd, win: this.win });
  }
  ranking() { return [...this.players.values()].sort((a, b) => b.pts - a.pts || b.kos - a.kos || b.surv - a.surv); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  snapshot() {
    const cm = (v) => Math.round(v * 100);
    return {
      t: Math.round(this.t * 1000) / 1000, ph: this.ph, pt: Math.round(this.pt * 100) / 100, rd: this.rd, rt: Math.round(this.rt * 10) / 10, at: Math.round(this.at * 1000) / 1000, go: this.goal, rw: this.rw, win: this.win, ar: this.arena.key, hz: this.hazards ? 1 : 0, gu: this.gust ? 1 : 0,
      P: [...this.players.values()].map((b) => {
        const a = [b.id, b.st, Math.round(b.yaw * 100) / 100, Math.round(b.dz * 100) / 100, (b.grip[0] ? 1 : 0) | (b.grip[1] ? 2 : 0) | (b.lifting ? 4 : 0) | (b.charge > 0.05 ? 8 : 0) | (b.kick > 0 ? 16 : 0) | (b.grounded ? 32 : 0) | (b.liftedBy >= 0 ? 64 : 0) | (b.heldBy > 0 ? 128 : 0) | (b.grip.some((q) => q && q.box) ? 256 : 0), b.pts, b.kos, b.order, Math.round(b.surv)];
        if (b.st !== ST.OUT) for (const q of b.p) a.push(cm(q.x), cm(q.y), cm(q.z));
        return a;
      }),
      N: [...this.players.values()].map((b) => [b.id, b.name, b.color, b.bot ? 1 : 0, b.level]),
    };
  }
  // nouvel hôte : la partie reprend du dernier état reçu (positions gardées, prises relâchées)
  static restore(s) {
    const sim = new Sim({ seed: (Math.random() * 2 ** 31) | 0, goal: s.go, hazards: !!s.hz });
    sim.t = s.t; sim.ph = s.ph; sim.pt = s.pt; sim.rd = s.rd; sim.rt = s.rt; sim.at = s.at; sim.rw = s.rw; sim.win = s.win;
    sim.arena = new Arena(s.ar); sim.lastKey = s.ar; sim.gustT = 3;
    if (!sim.hazards) { sim.arena.balls = []; for (const b of sim.arena.boxes) if (b.crush) { b.move = null; b.y = 40; b.by = 40; } }
    const names = new Map(s.N.map(([id, n, c, bo, l]) => [id, { name: n, color: c, bot: !!bo, level: l }]));
    for (const r of s.P) {
      const nm = names.get(r[0]) || {};
      const b = newBody({ id: r[0], name: nm.name, color: nm.color, bot: nm.bot, level: nm.level });
      b.st = r[1]; b.yaw = r[2]; b.dz = r[3]; b.pts = r[5]; b.kos = r[6]; b.order = r[7]; b.surv = r[8];
      if (b.st === ST.KO) b.ko = 1.2;
      if (b.st === ST.OUT) sim.park(b);
      else for (let i = 0; i < 7; i++) { const q = b.p[i]; q.x = q.px = r[9 + i * 3] / 100; q.y = q.py = r[10 + i * 3] / 100; q.z = q.pz = r[11 + i * 3] / 100; }
      sim.players.set(b.id, b);
    }
    return sim;
  }
}
const _s0 = { x: 0, y: 0, z: 0 }, _a = { x: 0, y: 0, z: 0 };
