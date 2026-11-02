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
const P_POWER = 2.6, P_DZ = 0.15, H_POWER = 7.5, H_DZ = 0.42, K_POWER = 8.5, K_DZ = 0.5; // poing, gros coup, coup de pied sauté
const CHAIN_POWER = 5, CHAIN_DZ = 0.2, CHAIN_T = 0.8;  // le troisième poing d'une série éjecte
const BUTT_POWER = 1.6, BUTT_DZ = 0.3, BUTT_CD = 0.7;  // le coup de tête, quand on tient quelqu'un
const AIM_RANGE = 2, AIM_RANGE_BIG = 2.6, AIM_COS = 0.17; // la visée : qui est à portée, jusqu'à 80° de chaque côté
const GUARD_DRAIN = 0.32, GUARD_REGEN = 0.45, GUARD_BLOCK = 0.3, GUARD_CD = 1.1; // la garde s'use : à tenir, et à chaque poing arrêté
const LIFT_DZ = 0.45;                 // assez sonné pour être soulevé
const CATCH_DZ = 0.25;                // attrapé pendant qu'il arme ou se protège : il est pris à contre-pied
const WAKE_GRACE = 0.9;               // au réveil, un court répit : les coups poussent, mais n'assomment pas
const GRIP_MAX = 7;                   // on se fatigue à tenir : au bout de 7 s, ça glisse
const HOLD_MAX = 5;                   // tenir quelqu'un qui se débat
const THROW_V = 8.5, THROW_VY = 4.2, RELEASE_V = 2.4;
export const SUDDEN_AT = 75;          // mort subite : des bourrasques de plus en plus fortes
export const ST = { LIVE: 0, KO: 1, OUT: 2 };
// les drapeaux d'un joueur dans l'instantané
export const FL = { GRIP: 3, LIFTING: 4, CHARGE: 8, KICK: 16, GROUND: 32, LIFTED: 64, HELD: 128, HANG: 256, GUARD: 512 };
export const BOT_NAMES = ['Gros Mou', 'Flan', 'Guimauve', 'Tofu', 'Nougat', 'Bibendum', 'Patate', 'Marsh'];
export const BOT_ID = 1000;
// les objets : chacun a sa chance d'apparaître au début de chaque manche (et une petite chance d'être en double)
export const ITEMS = { poele: { p: 0.6, r: 0.17 }, petard: { p: 0.55, r: 0.15 }, parapluie: { p: 0.4, r: 0.15 }, banane: { p: 0.6, r: 0.12 } };
export const ITEM_KEYS = Object.keys(ITEMS);
export const FUSE_T = 3.4;
export const COLORS = ['#ff9f1c', '#2ec4b6', '#e71d36', '#7b2ff7', '#8ac926', '#ff70a6', '#3a86ff', '#ffd23f'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function mk(x, y, z, r, w) { return { x, y, z, px: x, py: y, pz: z, r, w, on: null }; }
function newBody({ id, name, color, bot = false, level = 'normal' }) {
  const p = []; for (let i = 0; i < 7; i++) p.push(mk(0, 1, 0, RADII[i], WEIGHT[i]));
  return { id, name: String(name || '?').slice(0, 12), color, bot: !!bot, level, p, yaw: 0, st: ST.LIVE,
    m: 1, dip: 0, dz: 0, ko: 0, phase: 0, guard: false, gd: 1, guardCd: 0, flinch: 0, grace: 0, grabLock: 0, butt: 0, aim: -1, lunge: 0, swung: false, chainBy: -1, chainN: 0, chainT: 0, climb: null, grip: [null, null], gripT: 0, gripCd: 0, heldBy: 0, lifting: 0, liftedBy: -1,
    punchT: 0, punchH: 0, punchCd: 0, power: 1, hitDone: false, charge: 0, kick: 0, jumpCd: 0, grounded: false, gy: 0, gbox: null,
    hitBy: -1, hitT: -99, pts: 0, kos: 0, surv: 0, order: 0, pc: 0, jc: 0, gc: 0, inp: { mx: 0, mz: 0, jump: false, punch: false, grab: false, guard: false, pc: 0, jc: 0, gc: 0 }, ai: null };
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
  constructor({ seed = 1, goal = 3, hazards = true, items = true } = {}) {
    this.seed = seed >>> 0; this.rng = makeRng(this.seed);
    this.goal = clamp(goal | 0 || 3, 1, 9); this.hazards = !!hazards; this.useItems = !!items; this.items = []; this.itemId = 0;
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
    this.releaseAll(b); this.dropItem(b);
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
    if (!this.hazards) this.arena.disableHazards();
    [...this.players.values()].forEach((b, i) => this.place(b, i));
    this.items = []; if (this.useItems) this.spawnItems();
    this.events.push({ e: 'round', rd: this.rd, ar: k });
  }
  place(b, i) {
    const sp = this.arena.spawns, order = this.rd % 2 ? i : sp.length - 1 - i, [x, z] = sp[order % sp.length];
    const yaw = Math.atan2(-x, -z);
    const c = Math.cos(yaw), s = Math.sin(yaw), g = (this.arena.groundAt(x, z, 50) || { y: 0 }).y;
    const pos = [[x, g + STAND, z], [x, g + STAND + TORSO, z], [x, g + STAND + TORSO + NECK, z],
      [x - c * 0.3, g + STAND + 0.1, z + s * 0.3], [x + c * 0.3, g + STAND + 0.1, z - s * 0.3], [x - c * HIP, g + 0.11, z + s * HIP], [x + c * HIP, g + 0.11, z - s * HIP]];
    pos.forEach((q, j) => { const a = b.p[j]; a.x = a.px = q[0]; a.y = a.py = q[1]; a.z = a.pz = q[2]; a.on = null; });
    Object.assign(b, { yaw, st: ST.LIVE, m: 1, dip: 0, dz: 0, ko: 0, grip: [null, null], gripT: 0, gripCd: 0, climb: null, guard: false, gd: 1, guardCd: 0, flinch: 0, grace: 0, grabLock: 0, butt: 0, aim: -1, lunge: 0, swung: false, chainBy: -1, chainN: 0, chainT: 0, item: null, itemCd: 0, heldBy: 0, lifting: 0, liftedBy: -1, punchT: 0, punchCd: 0, charge: 0, kick: 0, jumpCd: 0, hitBy: -1, hitT: -99, order: 0 });
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
    for (const b of bs) for (const q of b.p) { q.lx = q.x; q.ly = q.y; q.lz = q.z; } // d'où part chaque point, avant les muscles
    if (this.arena.alarm(this.at) && !this.alarmed) { this.alarmed = true; if (this.ph !== 'count') this.events.push({ e: 'alarm' }); } else if (!this.arena.alarm(this.at)) this.alarmed = false;
    for (const b of bs) if (b.st !== ST.OUT) { if (b.bot) botThink(this, b, dt); this.control(b, frozen ? { ...b.inp, mx: 0, mz: 0, jump: false, punch: false, grab: false, guard: false } : b.inp, dt); }
    for (const b of bs) if (b.st !== ST.OUT) this.integrate(b);
    for (let it = 0; it < 4; it++) {
      for (const b of bs) if (b.st !== ST.OUT) this.solve(b);
      this.solveBodies(bs);
      for (const b of bs) if (b.st !== ST.OUT) this.collideWorld(b);
    }
    for (const b of bs) if (b.st !== ST.OUT) for (let i = 0; i < 7; i++) { const q = b.p[i]; if ((i < LH || i > RH || !b.grip[i - LH]) && this.arena.sweep(q, q.lx, q.ly, q.lz, b.climb ? b.climb.box : null)) this.arena.collide(q, 0.3, b.climb ? b.climb.box : null); else if (i >= LH && (i > RH || !b.grip[i - LH])) this.arena.collide(q, 0.3, b.climb ? b.climb.box : null); } // les mains et les pieds, une fois encore : dans un coin, ils ressortent d'une boîte pour entrer dans l'autre
    for (const b of bs) if (b.st !== ST.OUT) { this.attacks(b, bs); this.hazardsOn(b, dt); this.checkOut(b, live); }
    this.stepItems(dt, bs);
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
    const on = this.ph !== 'count'; // pendant le compte à rebours, les appuis ne comptent pas
    const press = on && (inp.pc | 0) !== b.pc, jumpPress = on && (inp.jc | 0) !== b.jc, grabPress = on && (inp.gc | 0) !== b.gc;
    b.pc = inp.pc | 0; b.jc = inp.jc | 0; b.gc = inp.gc | 0;
    if (b.punchCd > 0) b.punchCd -= dt; if (b.jumpCd > 0) b.jumpCd -= dt;
    if (b.dz > 0 && b.st === ST.LIVE) b.dz = Math.max(0, b.dz - DZ_DECAY * dt);
    if (b.dip > 0) b.dip = Math.max(0, b.dip - dt * 1.5);
    for (const k of ['flinch', 'grace', 'grabLock', 'butt', 'guardCd']) if (b[k] > 0) b[k] -= dt;
    // KO : plus aucun muscle ; marteler raccourcit
    if (b.st === ST.KO) {
      b.climb = null; b.guard = false; b.punchT = 0; b.swung = false;
      if (press || jumpPress) b.ko -= KO_MASH;
      b.ko -= dt;
      if (b.ko <= 0) { b.st = ST.LIVE; b.dz = 0.35; b.dip = 0.65; b.grace = WAKE_GRACE; this.events.push({ e: 'wake', id: b.id }); }
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
    const grounded = !!g && !lifted && h < STAND + 0.3 && (!!footOn || h < STAND + 0.1 || h < 0.6);
    if (!grounded) b.fallV = Math.max(b.fallV || 0, (pel.py - pel.y) / DT);
    else { if (!b.grounded && b.fallV > 4.5) this.events.push({ e: 'land', id: b.id, k: Math.min(1, b.fallV / 12), x: +pel.x.toFixed(2), y: +g.y.toFixed(2), z: +pel.z.toFixed(2) }); b.fallV = 0; }
    b.grounded = grounded; b.gy = g ? g.y : 0; b.gbox = grounded ? g.box : null;
    // le regard
    const il = Math.hypot(inp.mx, inp.mz);
    const aimed = (b.punchT > 0 || b.kick > 0) && b.aim >= 0 ? this.players.get(b.aim) : null;
    if (aimed && aimed.st !== ST.OUT) this.turnTo(b, aimed.p[C].x - che.x, aimed.p[C].z - che.z, 22 * dt); // le coup part vers la cible
    else if (il > 0.15 && !b.kick) this.turnTo(b, inp.mx, inp.mz, 9 * dt);
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw);
    // se déplacer : le tronc rejoint la vitesse voulue (celle de ce qu'il y a sous les pieds, plus la marche)
    const canGuard = on && grounded && !lifted && !b.heldBy && !b.grip[0] && !b.grip[1] && !b.climb && b.kick <= 0 && b.punchT <= 0 && b.flinch <= 0 && b.guardCd <= 0;
    b.guard = !!inp.guard && canGuard && b.gd > 0;
    if (b.guard) { b.charge = 0; b.gd -= GUARD_DRAIN * dt; if (b.gd <= 0) { b.gd = 0; b.guard = false; b.guardCd = GUARD_CD; } }
    else b.gd = Math.min(1, b.gd + GUARD_REGEN * dt);
    const carrying = b.grip.some((q) => q && q.o), slow = (carrying ? 0.72 : 1) * (b.guard ? 0.4 : 1) * (b.charge > 0 ? 0.55 : 1), hold = b.heldBy > 0 ? 0.42 : 1;
    const bx = b.gbox ? b.gbox.vx + (b.gbox.belt ? b.gbox.belt[0] : 0) : 0, bz = b.gbox ? b.gbox.vz + (b.gbox.belt ? b.gbox.belt[1] : 0) : 0;
    const dash = b.punchT > 0 ? b.lunge : 0; // le coup emporte le corps vers l'avant
    const tx = inp.mx * SPEED * slow * hold * (0.4 + 0.6 * m) + bx + fx * dash, tz = inp.mz * SPEED * slow * hold * (0.4 + 0.6 * m) + bz + fz * dash;
    const umb = !grounded && b.item && b.item.k === 'parapluie';
    if (umb) for (const q of p) if (q.y - q.py < -2.4 * DT) q.py = q.y + 2.4 * DT; // le parapluie freine la chute et permet de planer
    const a = (grounded ? ACC * (0.25 + 0.75 * m) * (b.heldBy > 0 ? 0.3 : 1) : AIR_ACC * (umb ? 2.5 : 1)) * dt; // tenu, on a moins d'appuis : on se laisse pousser vers le bord
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
    // les mains : pendent en balançant, frappent, ou se tendent pour agripper
    this.arms(b, inp, press, jumpPress, grabPress, dt, m, fx, fz, sx, sz, speed);
    // mort subite : la bourrasque
    if (this.gust) for (const q of p) vel(q, this.gust.x * this.gust.k * DT * DT * 8, 0, this.gust.z * this.gust.k * DT * DT * 8);
  }

  arms(b, inp, press, jumpPress, grabPress, dt, m, fx, fz, sx, sz, speed) {
    const p = b.p, che = p[C], hea = p[H], pel = p[P];
    // ------- frapper : un appui bref, un coup de poing ; maintenu, un gros ; en l'air et lancé, un coup de pied sauté
    const free = !b.grip[0] && !b.grip[1];
    if (press && free && !b.guard && b.flinch <= 0) b.charge = Math.max(b.charge, 0.001);
    if (inp.punch && free && b.charge > 0) b.charge += dt;
    if (!free) b.charge = 0;
    if (press && !b.grounded && free && b.kick <= 0 && Math.hypot(pel.x - pel.px, pel.z - pel.pz) / DT > 1.5 && !b.heldBy) {
      const t = this.aimTarget(b, AIM_RANGE_BIG); b.aim = t ? t.id : -1;
      b.kick = KICK_T; b.power = 1; b.hitDone = false; b.charge = 0; this.events.push({ e: 'kick', id: b.id });
    }
    if (b.charge > 0 && !inp.punch) {
      const big = b.charge >= CHARGE_T;
      if (b.punchCd <= 0 && b.flinch <= 0) {
        const t = this.aimTarget(b, big ? AIM_RANGE_BIG : AIM_RANGE), d = t ? Math.hypot(t.p[C].x - che.x, t.p[C].z - che.z) : 9;
        b.aim = t ? t.id : -1;
        b.lunge = d < 0.7 ? 0 : t ? (big ? 5 : 2.8) : (big ? 3 : 0.8);
        b.punchT = PUNCH_T * (big ? 1.4 : 1); b.punchH = b.item ? (b.item.k === 'poele' ? 1 : 0) : b.punchH ? 0 : 1; b.punchCd = big ? 0.6 : PUNCH_CD; b.power = big ? 2 : 1; b.hitDone = false; b.swung = true;
        this.events.push({ e: 'swing', id: b.id, k: big ? 1 : 0 });
      }
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
    if (b.itemCd > 0) b.itemCd -= dt;
    if (grabPress && b.item) { this.throwItem(b); b.itemCd = 0.3; }
    else if (grabPress && !b.item && b.itemCd <= 0) this.tryPick(b);
    const want = inp.grab && m > 0.3 && !b.item && b.itemCd <= 0;
    if (!want) { for (let i = 0; i < 2; i++) if (b.grip[i]) this.letGo(b, i); }
    if (b.gripCd > 0) b.gripCd -= dt;
    b.gripT = b.grip[0] || b.grip[1] ? b.gripT + dt : 0;
    if (!b.climb && b.gripT > (b.grip.some((q) => q && q.box) ? GRIP_MAX : HOLD_MAX)) { for (let i = 0; i < 2; i++) if (b.grip[i]) this.letGo(b, i, true); b.gripT = 0; b.gripCd = 0.6; }
    const holdingBox = b.grip.some((q) => q && q.box);
    const body = b.grip.find((q) => q && q.o);
    // se hisser : accroché, un appui sur saut (ou pousser vers le rebord en pendant) lance la remontée, qui va au bout tant qu'on tient
    if (holdingBox && !b.climb) {
      const q = b.grip.find((x) => x && x.box).box;
      const toX = q.x - pel.x, toZ = q.z - pel.z, tl = Math.hypot(toX, toZ) || 1;
      const pushing = !b.grounded && Math.hypot(inp.mx, inp.mz) > 0.3 && (inp.mx * toX + inp.mz * toZ) / tl > 0.3;
      if (jumpPress || inp.jump || pushing) {
        b.climb = { box: q, t: 0, over: false };
        for (let i = 0; i < 2; i++) if (b.grip[i] && b.grip[i].box !== q) this.letGo(b, i); // l'autre main, accrochée ailleurs, retiendrait le corps
      }
    }
    if (b.climb) this.climbStep(b, dt);
    // soulever : tenir quelqu'un et sauter
    if (body && inp.jump && !b.lifting && b.grounded) {
      const o = body.o;
      if (o.st === ST.KO || o.dz >= LIFT_DZ) { b.lifting = 1; o.liftedBy = b.id; this.events.push({ e: 'lift', id: b.id, who: o.id }); }
    }
    if (b.lifting && !body) { b.lifting = 0; }
    // le coup de tête : on tient quelqu'un de bien réveillé, on le sonne avant de le soulever
    if (body && press && !b.lifting && b.punchCd <= 0 && body.o.st === ST.LIVE) {
      const o = body.o, t = o.p[H];
      b.punchCd = BUTT_CD; b.butt = 0.14;
      this.hurt(o, fx, 0.1, fz, BUTT_POWER, BUTT_DZ, b.id);
      this.events.push({ e: 'hit', id: o.id, by: b.id, k: 0.4, head: 1, pan: 0, x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2) });
    }
    if (b.butt > 0 && body) pull(hea, body.o.p[H].x, body.o.p[H].y, body.o.p[H].z, 0.35);
    if (b.lifting && body) {
      const o = body.o, q = o.p, top = hea.y + 0.5;
      const k = o.st === ST.KO ? 0.3 : 0.2;
      pull(q[P], hea.x - fx * 0.05, top, hea.z - fz * 0.05, k); pull(q[C], hea.x + sx * 0.44, top + 0.02, hea.z + sz * 0.44, k); pull(q[H], hea.x + sx * 0.82, top + 0.04, hea.z + sz * 0.82, k);
      for (const t of q) { t.py = t.y - (t.y - t.py) * 0.5; }
    }
    // ------- chaque main
    const reachS = _s0, it = b.item;
    for (let i = 0; i < 2; i++) {
      const hand = p[LH + i], side = i ? 1 : -1, S = shoulder(b, side, reachS);
      if (b.grip[i]) { // la main tenue ne fait rien d'autre ; en portant à bout de bras, elle monte
        if (b.lifting) pull(hand, hea.x + side * sx * 0.2, hea.y + 0.42, hea.z + side * sz * 0.2, 0.4);
        continue;
      }
      if (it && i === 1 && !(b.punchT > 0 && b.punchH === 1)) { // l'objet dans la main droite ; le parapluie se lève en tombant
        if (it.k === 'parapluie' && !b.grounded) pull(hand, hea.x + fx * 0.06, hea.y + 0.34, hea.z + fz * 0.06, 0.5);
        else pull(hand, che.x + fx * 0.42 + sx * 0.22, che.y + 0.02, che.z + fz * 0.42 + sz * 0.22, 0.35);
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
        if (O && i === 0) { this.turnTo(b, O.p[C].x - che.x, O.p[C].z - che.z, 12 * dt); }
        if (T) pull(hand, T.x, T.y, T.z, 0.42);
        else pull(hand, S.x + fx * 0.6, S.y + 0.02, S.z + fz * 0.6, 0.3);
        this.tryGrip(b, i, hand);
      } else if (b.punchT > 0 && b.punchH === i) {
        const k = b.power > 1 ? 1.0 : 0.82, tg = b.aim >= 0 ? this.players.get(b.aim) : null, tp = tg && tg.st !== ST.OUT ? tg.p[b.power > 1 ? H : C] : null;
        if (tp && Math.hypot(tp.x - che.x, tp.y - che.y, tp.z - che.z) < 1.5) pull(hand, tp.x, tp.y, tp.z, 0.62); // le poing va chercher la cible : la poitrine, la tête pour le gros coup
        else pull(hand, che.x + fx * k + side * sx * 0.06, che.y + 0.12, che.z + fz * k + side * sz * 0.06, 0.62);
      } else if (b.guard) { // la garde : les deux poings devant le visage
        pull(hand, hea.x + fx * 0.3 + side * sx * 0.12, hea.y - 0.08, hea.z + fz * 0.3 + side * sz * 0.12, 0.45);
      } else if (b.charge > 0 && b.punchH !== i) { // armer : le poing en arrière
        pull(hand, che.x - fx * 0.3 + side * sx * 0.25, che.y + 0.1, che.z - fz * 0.3 + side * sz * 0.25, 0.3 * m);
      } else {
        const sw = Math.sin(b.phase + (i ? 0 : Math.PI)) * clamp(speed / 3, 0, 1) * 0.3;
        pull(hand, S.x + side * sx * 0.08 + fx * sw, S.y - ARM * 0.86, S.z + side * sz * 0.08 + fz * sw, 0.09 * m);
      }
    }
    void jumpPress; void grabPress;
  }
  turnTo(b, x, z, max) { let d = Math.atan2(x, z) - b.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; b.yaw += clamp(d, -max, max); }
  // qui ce coup vise-t-il ? le mieux placé devant soi, à portée
  aimTarget(b, range) {
    const c = b.p[C], fx = Math.sin(b.yaw), fz = Math.cos(b.yaw); let best = null, bs = 1e9;
    for (const o of this.players.values()) {
      if (o === b || o.st === ST.OUT || o.liftedBy === b.id) continue;
      const t = o.p[C], dx = t.x - c.x, dz = t.z - c.z, d = Math.hypot(dx, dz) || 1e-3;
      if (d > range || Math.abs(t.y - c.y) > 1.5) continue;
      const dot = (dx * fx + dz * fz) / d; if (dot < AIM_COS && d > 0.5) continue;
      const sc = d + (1 - dot) * 1.2; if (sc < bs) { bs = sc; best = o; }
    }
    return best;
  }
  // la remontée : les mains grimpent jusqu'au rebord, le tronc suit, puis il bascule au-dessus de la boîte.
  // Le corps ne heurte pas cette boîte-là pendant le geste (sinon une planche fine le bloque par en dessous).
  climbStep(b, dt) {
    const c = b.climb, B = c.box, p = b.p, pel = p[P], top = B.y + B.hy;
    c.t += dt;
    if (!c.over && !b.grip.some((q) => q && q.box === B)) { b.climb = null; return; } // lâché, ou frappé : c'est fini
    if (c.t > 3) { b.climb = null; for (let i = 0; i < 2; i++) if (b.grip[i]) this.letGo(b, i, true); return; }
    if (!c.over) {
      for (const q of b.grip) if (q && q.box === B) q.ly = Math.min(B.hy + 0.02, q.ly + 3 * dt);
      const up = clamp((top + 0.42 - pel.y) * 7, 0.6, 3.6) + B.vy;
      for (const t of [P, C, H]) p[t].py = p[t].y - up * DT;
      for (const t of [LF, RF]) pull(p[t], pel.x, pel.y - 0.45, pel.z, 0.25, 0);
      if (pel.y > top + 0.28) {
        c.over = true; c.t = 2.45; // la bascule dure au plus 0,55 s
        for (let i = 0; i < 2; i++) if (b.grip[i]) this.letGo(b, i);
        b.gripCd = 0.7;
        this.events.push({ e: 'climb', id: b.id });
      }
      return;
    }
    // la bascule : vers un point du dessus, un peu à l'intérieur du rebord
    const mx = Math.min(0.45, B.hx * 0.6), mz = Math.min(0.45, B.hz * 0.6);
    const gx = clamp(pel.x, B.x - B.hx + mx, B.x + B.hx - mx), gz = clamp(pel.z, B.z - B.hz + mz, B.z + B.hz - mz);
    const dx = gx - pel.x, dz = gz - pel.z, d = Math.hypot(dx, dz);
    const v = Math.min(3.4, d / DT), vx = B.vx + (d > 1e-4 ? dx / d * v : 0), vz = B.vz + (d > 1e-4 ? dz / d * v : 0);
    for (const t of [P, C, H]) { const u = p[t]; u.px = u.x - vx * DT; u.pz = u.z - vz * DT; u.py = u.y - Math.max(u.y - u.py, (top + 0.5 - pel.y) * 4 * DT, 0.4 * DT); }
    for (const t of [LF, RF]) pull(p[t], pel.x, pel.y - 0.35, pel.z, 0.45, 0);
    if (d < 0.05) b.climb = null;
  }
  anchor(q) { if (q.box) { _a.x = q.box.x + q.lx; _a.y = q.box.y + q.ly; _a.z = q.box.z + q.lz; } else { const t = q.o.p[q.pi]; _a.x = t.x; _a.y = t.y; _a.z = t.z; } return _a; }
  tryGrip(b, i, hand) {
    if (b.gripCd > 0) return;
    if (b.grabLock <= 0) for (const o of this.players.values()) { // sonné par un poing, on n'attrape plus personne un court instant
      if (o === b || o.st === ST.OUT) continue;
      for (const pi of [H, C, P, LH, RH]) {
        const t = o.p[pi], d = Math.hypot(t.x - hand.x, t.y - hand.y, t.z - hand.z);
        if (d < t.r + hand.r + 0.1) {
          b.grip[i] = { o, pi, d: Math.min(t.r, 0.2) }; o.heldBy++;
          if (!b.grip[1 - i] || !b.grip[1 - i].o) {
            const caught = o.st === ST.LIVE && (o.charge > 0.1 || o.guard); // il armait ou se protégeait : la saisie passe, et le surprend
            if (caught) { o.charge = 0; o.guard = false; o.flinch = Math.max(o.flinch, 0.45); o.dz = Math.min(0.95, o.dz + CATCH_DZ); o.dip = Math.max(o.dip, 0.4); }
            this.events.push({ e: 'grab', id: b.id, who: o.id, caught: caught ? 1 : 0, x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2) });
          }
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

  // ------------------------------------------------------------------ les objets
  spawnItems() {
    const A = this.arena, rng = this.rng;
    const free = () => {
      for (let t = 0; t < 40; t++) {
        const x = A.x0 + rng.next() * (A.x1 - A.x0), z = A.z0 + rng.next() * (A.z1 - A.z0), g = A.groundAt(x, z, 2);
        if (!g || g.box.move || g.box.belt || g.box.crush || g.y > 0.2) continue;
        if (A.rollers.some((r) => Math.abs(z - r.cz) < r.hz + 0.3)) continue;
        if (A.boxes.some((b) => b !== g.box && Math.abs(x - b.x) < b.hx + 0.3 && Math.abs(z - b.z) < b.hz + 0.3 && b.y - b.hy < g.y + 1 && b.y + b.hy > g.y)) continue;
        return { x, y: g.y + 0.4, z };
      }
      return null;
    };
    for (const k of ITEM_KEYS) for (const chance of [ITEMS[k].p, ITEMS[k].p / 3]) {
      if (rng.next() >= chance) continue;
      const q = free(); if (q) this.items.push(this.newItem(k, q.x, q.y, q.z));
    }
  }
  newItem(k, x, y, z) { return { id: ++this.itemId, k, x, y, z, px: x, py: y, pz: z, lx: x, ly: y, lz: z, r: ITEMS[k].r, holder: null, fuse: 0, thrower: -1, tt: 99, hit: true }; }
  tryPick(b) {
    if (!this.items.length) return false;
    const c = b.p[C]; let best = null, bd = 1.25;
    for (const it of this.items) { if (it.holder) continue; const d = Math.hypot(it.x - c.x, it.y - c.y, it.z - c.z); if (d < bd) { bd = d; best = it; } }
    if (!best) return false;
    for (const o of this.players.values()) if (o !== b && o.st !== ST.OUT && Math.hypot(o.p[C].x - c.x, o.p[C].y - c.y, o.p[C].z - c.z) < bd * 0.7) return false; // un adversaire plus près : c'est lui qu'on attrape
    best.holder = b; b.item = best; for (let i = 0; i < 2; i++) if (b.grip[i]) this.letGo(b, i);
    if (best.k === 'petard' && best.fuse <= 0) best.fuse = FUSE_T;
    this.events.push({ e: 'pick', id: b.id, k: best.k });
    return true;
  }
  dropItem(b) { const it = b.item; if (!it) return; it.holder = null; b.item = null; it.px = it.x; it.py = it.y; it.pz = it.z; it.thrower = b.id; it.tt = 0; it.hit = true; }
  throwItem(b) {
    const it = b.item; if (!it) return;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), v = it.k === 'banane' ? 7 : 10;
    it.holder = null; b.item = null;
    it.x = b.p[C].x + fx * 0.5; it.y = b.p[C].y + 0.15; it.z = b.p[C].z + fz * 0.5;
    it.px = it.x - fx * v * DT; it.py = it.y - 3.4 * DT; it.pz = it.z - fz * v * DT; it.lx = it.x; it.ly = it.y; it.lz = it.z;
    it.thrower = b.id; it.tt = 0; it.hit = false;
    this.events.push({ e: 'toss', id: b.id, k: it.k });
  }
  stepItems(dt, bs) {
    for (const it of [...this.items]) {
      it.tt += dt;
      if (it.fuse > 0) { it.fuse -= dt; if (it.fuse <= 0) { this.explode(it, bs); continue; } }
      if (it.holder) { const h = it.holder.p[RH]; it.x = it.px = it.lx = h.x; it.y = it.py = it.ly = h.y; it.z = it.pz = it.lz = h.z; continue; }
      const vx = (it.x - it.px) * 0.996, vy = (it.y - it.py) * 0.996, vz = (it.z - it.pz) * 0.996;
      it.px = it.x; it.py = it.y; it.pz = it.z; it.lx = it.x; it.ly = it.y; it.lz = it.z;
      it.x += clamp(vx, -0.34, 0.34); it.y += clamp(vy, -0.34, 0.34) - G * DT * DT; it.z += clamp(vz, -0.34, 0.34);
      this.arena.rollerPush(it); this.arena.ballPush(it);
      if (this.arena.collide(it, 0.22)) it.hit = true;
      if (this.arena.sweep(it, it.lx, it.ly, it.lz)) { it.hit = true; this.arena.collide(it, 0.22); }
      if (it.y < KILL_Y || this.arena.inFire(it.x, it.y, it.z)) { this.items.splice(this.items.indexOf(it), 1); continue; }
      const sp = Math.hypot(it.x - it.px, it.y - it.py, it.z - it.pz) / DT;
      // lancé, il cogne le premier qu'il touche
      if (!it.hit && sp > 3.5) for (const o of bs) {
        if (o.st === ST.OUT || o.id === it.thrower) continue;
        const t = [o.p[H], o.p[C], o.p[P]].find((q) => Math.hypot(q.x - it.x, q.y - it.y, q.z - it.z) < q.r + it.r + 0.06);
        if (!t) continue;
        it.hit = true;
        const n = sp || 1;
        this.hurt(o, (it.x - it.px) / DT / n, 0.2, (it.z - it.pz) / DT / n, it.k === 'poele' ? 5.5 : 3.2, it.k === 'poele' ? 0.42 : 0.18, it.thrower);
        this.events.push({ e: 'hit', id: o.id, by: it.thrower, k: it.k === 'poele' ? 0.7 : 0.2, head: 0, pan: it.k === 'poele' ? 1 : 0, x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2) });
        break;
      }
      // la peau de banane
      if (it.k === 'banane' && sp < 2.5 && this.ph !== 'count') for (const o of bs) {
        if (o.st !== ST.LIVE || !o.grounded || (o.id === it.thrower && it.tt < 1.2)) continue;
        const v = Math.hypot(o.p[P].x - o.p[P].px, o.p[P].z - o.p[P].pz) / DT;
        if (v < 0.8 || ![o.p[LF], o.p[RF]].some((q) => Math.hypot(q.x - it.x, q.z - it.z) < 0.36 && Math.abs(q.y - it.y) < 0.4)) continue;
        const fx = (o.p[P].x - o.p[P].px) / DT / v, fz = (o.p[P].z - o.p[P].pz) / DT / v;
        this.hurt(o, 0, 0, 0, 0, 0.3, it.thrower);
        o.dip = 1; o.m = 0;
        for (const q of [o.p[LF], o.p[RF]]) vel(q, fx * 7 * DT, 2.5 * DT, fz * 7 * DT); // les pieds partent devant, le corps s'étale
        for (const q of [o.p[C], o.p[H]]) vel(q, -fx * 2.5 * DT, 0, -fz * 2.5 * DT);
        this.items.splice(this.items.indexOf(it), 1);
        this.events.push({ e: 'peel', id: o.id, x: +it.x.toFixed(2), y: +it.y.toFixed(2), z: +it.z.toFixed(2) });
        break;
      }
    }
  }
  explode(it, bs) {
    const holder = it.holder;
    if (holder) holder.item = null;
    this.items.splice(this.items.indexOf(it), 1);
    this.events.push({ e: 'boom', x: +it.x.toFixed(2), y: +it.y.toFixed(2), z: +it.z.toFixed(2) });
    for (const o of bs) {
      if (o.st === ST.OUT) continue;
      const c = o.p[C], dx = c.x - it.x, dy = c.y - it.y, dz = c.z - it.z, d = Math.hypot(dx, dy, dz);
      if (d > 3.2) continue;
      const f = 1 - d / 3.2, n = d || 1;
      this.hurt(o, dx / n, Math.max(0.45, dy / n), dz / n, 4 + 10 * f, 0.15 + 0.85 * f, o === holder ? -1 : it.thrower);
    }
    for (const q of this.items) if (!q.holder) { const dx = q.x - it.x, dz = q.z - it.z, d = Math.hypot(dx, dz) || 1; if (d < 3.2) { q.px -= dx / d * 3 * DT; q.pz -= dz / d * 3 * DT; q.py -= 3 * DT; } }
  }

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
      // bras : pas plus long que le bras ; la main tire sur la poitrine. Sur un corps, la traction reste réciproque : sinon, deux pantins qui se tiennent s'emballent tout seuls
      const dx = hand.x - S.x, dy = hand.y - S.y, dz = hand.z - S.z, d = Math.hypot(dx, dy, dz) || 1e-5;
      if (d > ARM) { const che = p[C], grip = b.grip[i], hw = grip && grip.box ? 0.25 : hand.w, s = hw + che.w, c = (d - ARM) / d / s; hand.x -= dx * c * hw; hand.y -= dy * c * hw; hand.z -= dz * c * hw; che.x += dx * c * che.w; che.y += dy * c * che.w; che.z += dz * c * che.w; }
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
      const fr = i === LF || i === RF ? (b.m > 0.3 ? 0.08 : 0.3) : 0.3;
      this.arena.rollerPush(q); this.arena.ballPush(q);
      const on = this.arena.collide(q, fr, b.climb ? b.climb.box : null);
      if (on) q.on = on;
    }
  }

  // ------------------------------------------------------------------ les coups
  attacks(b, bs) {
    if (b.st !== ST.LIVE) return;
    const p = b.p;
    if (b.swung && b.punchT <= 0) { // un gros coup dans le vide déséquilibre
      if (!b.hitDone && b.power > 1) { b.dip = Math.max(b.dip, 0.45); b.punchCd = Math.max(b.punchCd, 0.4); }
      b.swung = false;
    }
    let tips = null, power = 0, dz = 0;
    if (b.kick > 0 && !b.hitDone) { tips = [p[LF], p[RF]]; power = K_POWER; dz = K_DZ; }
    else if (b.punchT > 0 && !b.hitDone) { tips = [p[LH + b.punchH]]; power = b.power > 1 ? H_POWER : P_POWER; dz = b.power > 1 ? H_DZ : P_DZ; }
    if (!tips) return;
    const pan = b.item && b.item.k === 'poele' && b.punchT > 0 && b.kick <= 0, heavy = b.kick > 0 || b.power > 1;
    if (pan) { const h = tips[0]; tips = [{ x: h.x + Math.sin(b.yaw) * 0.3, y: h.y, z: h.z + Math.cos(b.yaw) * 0.3, r: 0.22 }]; power *= 1.5; dz *= 1.6; }
    for (const o of bs) {
      if (o === b || o.st === ST.OUT || o.liftedBy === b.id) continue;
      let t = null, pi = -1, best = 1e9; // le point du corps que le coup atteint vraiment
      for (const tip of tips) for (const k of [H, C, P]) {
        const q = o.p[k], d = Math.hypot(q.x - tip.x, q.y - tip.y, q.z - tip.z);
        if (d <= q.r + tip.r + 0.08 && d - q.r < best) { best = d - q.r; t = q; pi = k; }
      }
      if (!t) continue;
      const nx = Math.sin(b.yaw), nz = Math.cos(b.yaw), head = pi === H, pos = { x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2) };
      b.hitDone = true;
      // la garde : elle arrête les poings qui viennent de devant, le gros coup et le coup de pied la cassent
      const fromFront = o.guard && -(nx * Math.sin(o.yaw) + nz * Math.cos(o.yaw)) > -0.2;
      if (fromFront && !heavy) {
        o.gd -= GUARD_BLOCK * (pan ? 1.8 : 1);
        for (const q of o.p) vel(q, nx * 1.1 * DT, 0, nz * 1.1 * DT);
        b.flinch = Math.max(b.flinch, 0.25); b.punchCd = Math.max(b.punchCd, 0.42);
        vel(p[C], -nx * 1.2 * DT, 0, -nz * 1.2 * DT);
        if (o.gd <= 0) { o.gd = 0; o.guard = false; o.guardCd = GUARD_CD; o.flinch = Math.max(o.flinch, 0.4); this.events.push({ e: 'break', id: o.id, by: b.id, ...pos }); }
        else this.events.push({ e: 'block', id: o.id, by: b.id, ...pos });
        return;
      }
      if (fromFront) { o.guard = false; o.gd = 0; o.guardCd = GUARD_CD; dz += 0.1; this.events.push({ e: 'break', id: o.id, by: b.id, ...pos }); }
      // la série de poings : le troisième d'affilée éjecte
      let k = heavy ? (b.kick > 0 ? 1 : 0.7) : 0;
      if (!heavy && !pan) {
        if (o.chainBy === b.id && this.t < o.chainT) o.chainN++; else { o.chainBy = b.id; o.chainN = 1; }
        o.chainT = this.t + CHAIN_T;
        if (o.chainN >= 3) { power = CHAIN_POWER; dz = CHAIN_DZ; k = 0.5; o.chainN = 0; o.chainT = 0; }
      } else if (pan && !heavy) k = 0.8;
      this.hurt(o, nx, heavy ? 0.3 : 0.12, nz, power * (head && heavy ? 1.1 : 1), dz * (head ? 1.25 : 1), b.id);
      vel(p[C], -nx * 0.6 * DT, 0, -nz * 0.6 * DT);
      this.events.push({ e: 'hit', id: o.id, by: b.id, k, head: head ? 1 : 0, pan: pan ? 1 : 0, ...pos });
      return;
    }
  }
  hurt(o, nx, ny, nz, power, dz, by) {
    for (const t of o.p) vel(t, nx * power * DT, ny * power * DT, nz * power * DT);
    if (by >= 0) { o.hitBy = by; o.hitT = this.t; }
    if (o.grace > 0 && o.st === ST.LIVE) dz = Math.min(dz, Math.max(0, 0.95 - o.dz)); // au réveil, on encaisse sans retomber aussitôt
    o.dip = Math.max(o.dip, dz > 0 ? 0.12 + dz * 1.4 : 0);
    if (o.climb && o.climb.over) o.climb.t = 99; // la remontée s'arrête au pas suivant, le temps que le corps ressorte de la boîte
    if (o.st === ST.KO) { o.ko = Math.max(o.ko, 1); return; }
    o.dz += dz;
    if (dz > 0) {
      if (dz >= 0.3 || o.charge < 0.12) o.charge = 0; // un poing n'arrête pas un gros coup déjà bien armé
      o.punchT = 0; o.swung = false; o.flinch = Math.max(o.flinch, dz >= 0.3 ? 0.35 : 0.2); o.grabLock = Math.max(o.grabLock, 0.35); o.guard = false;
    }
    if (o.item && (dz >= 0.3 || o.dz >= 0.8)) this.dropItem(o);
    // le coup fait lâcher une main
    for (let i = 0; i < 2; i++) if (o.grip[i] && this.rng.next() < 0.3 + dz) { this.letGo(o, i, true); }
    if (o.dz >= 1) {
      o.st = ST.KO; o.ko = KO_T; o.dz = 1; this.releaseAll(o); if (o.climb) o.climb.t = 99; this.dropItem(o);
      this.events.push({ e: 'ko', id: o.id, by, x: +o.p[H].x.toFixed(2), y: +o.p[H].y.toFixed(2), z: +o.p[H].z.toFixed(2) });
    }
  }
  hazardsOn(b, dt) {
    const A = this.arena, c = b.p[C];
    if (this.ph === 'count') return;
    for (const r of A.rollers) {
      if ((b.ballCd || 0) > 0 || Math.abs(c.z - r.cz) > r.hz + 0.3) continue;
      const near = b.p.some((q) => Math.hypot(q.x - r.x, q.y - r.cy) < r.r + q.r + 0.12);
      if (!near) continue;
      b.ballCd = 0.75;
      const dir = c.x - r.x >= 0 ? 1 : -1;
      this.hurt(b, dir, 0.55, 0, 6 + Math.abs(r.vx), 0.55, -1);
      this.events.push({ e: 'spike', id: b.id, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2) });
    }
    for (const q of A.balls) {
      const dx = c.x - q.x, dy = c.y - q.y, dz = c.z - q.z, d = Math.hypot(dx, dy, dz);
      if (d < q.r + 0.34 && (b.ballCd || 0) <= 0) {
        b.ballCd = 0.8;
        const v = Math.hypot(q.vx, q.vz) || 1;
        this.hurt(b, q.vx / v, 0.35, q.vz / v, 5 + v * 1.1, 0.45, -1);
        this.events.push({ e: 'ball', id: b.id, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2) });
      }
    }
    if (b.ballCd > 0) b.ballCd -= dt;
    for (const q of A.boxes) {
      if (q.knock && (b.ballCd || 0) <= 0 && Math.abs(q.vx) > 0.8 && Math.abs(c.z - q.z) < q.hz + 0.2 && Math.abs(c.x - q.x) < q.hx + 0.42 && (c.x - q.x) * q.vx > 0 && c.y < q.y + q.hy + 0.2) { // la barre qui balaie
        b.ballCd = 0.7;
        this.hurt(b, Math.sign(q.vx), 0.3, 0, 3.5 + Math.abs(q.vx), 0.35, -1);
        this.events.push({ e: 'ball', id: b.id, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2) });
      }
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
    const burnt = this.arena.burn.length && this.arena.inFire(b.p[P].x, b.p[P].y, b.p[P].z);
    if (b.p[P].y > KILL_Y && !burnt) return;
    if (burnt) this.events.push({ e: 'burn', id: b.id, x: +b.p[P].x.toFixed(2), y: +b.p[P].y.toFixed(2), z: +b.p[P].z.toFixed(2) });
    this.dropItem(b);
    this.releaseAll(b); b.climb = null;
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
        const a = [b.id, b.st, Math.round(b.yaw * 100) / 100, Math.round(b.dz * 100) / 100, (b.grip[0] ? 1 : 0) | (b.grip[1] ? 2 : 0) | (b.lifting ? 4 : 0) | (b.charge > 0.05 ? 8 : 0) | (b.kick > 0 ? 16 : 0) | (b.grounded ? 32 : 0) | (b.liftedBy >= 0 ? 64 : 0) | (b.heldBy > 0 ? 128 : 0) | (b.grip.some((q) => q && q.box) ? 256 : 0) | (b.guard ? 512 : 0), b.pts, b.kos, b.order, Math.round(b.surv)];
        if (b.st !== ST.OUT) for (const q of b.p) a.push(cm(q.x), cm(q.y), cm(q.z));
        return a;
      }),
      N: [...this.players.values()].map((b) => [b.id, b.name, b.color, b.bot ? 1 : 0, b.level]),
      I: this.items.map((i) => [i.id, ITEM_KEYS.indexOf(i.k), Math.round(i.x * 100), Math.round(i.y * 100), Math.round(i.z * 100), i.holder ? i.holder.id : -1, Math.round(i.fuse * 10)]),
      it: this.useItems ? 1 : 0,
    };
  }
  // nouvel hôte : la partie reprend du dernier état reçu (positions gardées, prises relâchées)
  static restore(s) {
    const sim = new Sim({ seed: (Math.random() * 2 ** 31) | 0, goal: s.go, hazards: !!s.hz, items: !!s.it });
    sim.t = s.t; sim.ph = s.ph; sim.pt = s.pt; sim.rd = s.rd; sim.rt = s.rt; sim.at = s.at; sim.rw = s.rw; sim.win = s.win;
    sim.arena = new Arena(s.ar); sim.lastKey = s.ar; sim.gustT = 3;
    if (!sim.hazards) sim.arena.disableHazards();
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
    for (const r of s.I || []) { const it = sim.newItem(ITEM_KEYS[r[1]], r[2] / 100, r[3] / 100, r[4] / 100); it.id = r[0]; it.fuse = r[6] / 10; sim.items.push(it); sim.itemId = Math.max(sim.itemId, it.id); } // repris en main : ils retombent par terre
    return sim;
  }
}
const _s0 = { x: 0, y: 0, z: 0 }, _a = { x: 0, y: 0, z: 0 };
