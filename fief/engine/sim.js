// Fief Maudit : la simulation. Moteur PUR (aucun DOM, aucun réseau).
// Le jour : abattre les arbres à la hache, ramasser les bûches, les ranger à l'entrepôt ou les mettre dans les braseros.
// La nuit : la brume monte, les squelettes sortent du sol au nord (côté château) et marchent sur le village ; ils
// visent les joueurs proches, sinon les braseros allumés, sinon l'entrepôt. Un squelette tombé dans la brume se relève ;
// dans la lumière d'un brasero ou du feu, il reste à terre. Un joueur à 0 PV tombe : un équipier le relève en tenant E.
// À l'aube, les squelettes encore debout tombent en poussière. Défaite si toute l'équipe est à terre ou si l'entrepôt tombe.
// Le pas est fixe (DT). Entrée d'un joueur : { wx, wz } (direction voulue dans le monde, longueur ≤ 1), walk, jump,
// hold (E tenu) et des compteurs d'appuis fc (frapper) et uc (utiliser) : un appui bref n'est jamais perdu.
import { createValley, TREE_HP, LIGHT_R, FIRE_LIGHT_R } from './map.js';
import { createNav } from './nav.js';
import { makeRng } from './rng.js';
import { botInput } from './bots.js';

export const DT = 1 / 30;
export const SPEED = { run: 5.2, walk: 2.4, carry: 3.0 };
export const ACT = {
  chop: { dur: 0.95, hit: 0.48 },     // coup de hache (arbre)
  strike: { dur: 0.8, hit: 0.38 },    // coup sur un squelette
  pick: { dur: 0.75, at: 0.45 },      // ramasser une bûche
  store: { dur: 0.6, at: 0.35 },      // ranger à l'entrepôt
  feed: { dur: 0.7, at: 0.4 },        // bûche dans un brasero
  take: { dur: 0.6, at: 0.35 },       // reprendre une bûche à l'entrepôt
  drop: { dur: 0.45, at: 0.2 },       // poser la bûche par terre
};
export const REACH = { chop: 1.6, pick: 1.9, store: 3.2, feed: 2.3, strike: 2.4, revive: 1.9 };
export const P_R = 0.42;
export const CYCLE = { day: 270, dusk: 25, night: 150, dawn: 10 };
export const HP = { player: 100, revived: 45, bleed: 40, revive: 3 };
export const FUEL = { start: 70, log: 50, max: 150, hit: 20, burn: 0.6 };
export const FOES = {
  minion: { hp: 55, speed: 2.7, dmg: 8, reach: 1.35, dur: 1.1, hit: 0.5 },
  warrior: { hp: 100, speed: 2.2, dmg: 13, reach: 1.45, dur: 1.25, hit: 0.6, block: true },
};
export const RISE = { delay: 6, dur: 2.3, max: 2, awaken: 2.4, crumble: 9 };
export const WAREHOUSE_HP = 600;
const DMG = { bucheron: 30, chevalier: 34 };
const GRAV = 22, JUMP_V = 7.2;
const LOGS_PER_TREE = 2, LOG_DELAY = 1.3;

// étapes du tutoriel des premiers jours
export const GOALS = [
  { id: 'chop', text: 'Abats un arbre à la hache', hint: 'Approche-toi d\'un arbre et frappe (clic)' },
  { id: 'pick', text: 'Ramasse une bûche', hint: 'E près d\'une bûche' },
  { id: 'store', text: 'Range-la à l\'entrepôt', hint: 'E devant la porte de l\'entrepôt' },
  { id: 'ten', text: 'Rentre 10 bûches', hint: 'Chaque arbre donne deux bûches' },
  { id: 'feed', text: 'Charge les braseros avant la nuit', hint: 'Porte une bûche à un brasero et appuie sur E' },
  { id: 'night', text: 'Tiens jusqu\'à l\'aube', hint: 'Garde les braseros allumés : dans leur lumière, les morts ne se relèvent pas' },
  { id: 'free', text: 'Prépare la prochaine nuit', hint: 'Du bois pour les braseros, et l\'entrepôt à défendre' },
];

export const emptyInput = () => ({ wx: 0, wz: 0, walk: false, jump: false, hold: false, fc: 0, uc: 0 });
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Sim {
  constructor({ seed = 1, players = [{ id: 0, name: 'Toi', job: 'bucheron', color: '#e0a040' }], bots = 0 } = {}) {
    this.seed = seed;
    this.map = createValley(seed);
    this.nav = createNav(this.map);
    this.rng = makeRng(seed * 31 + 5);
    this.t = 0; this.tick = 0;
    this.clock = { day: 1, phase: 'jour', t: 0 };
    this.stock = { bois: 0, pierre: 0, nourriture: 0 };
    this.trees = this.map.trees.map((t) => ({ id: t.id, hp: TREE_HP, down: false, fallAt: 0, dir: 0 }));
    this.logs = []; this.nextLog = 1;
    this.braziers = this.map.braziers.map((b) => ({ id: b.id, fuel: FUEL.start }));
    this.village = { hp: WAREHOUSE_HP };
    this.foes = []; this.nextFoe = 1; this.spawnQ = [];
    this.goal = 0; this.over = null; this.stats = { kills: 0, nights: 0 };
    this.events = [];
    const list = [...players];
    const BOT_NAMES = ['Bertrand', 'Aliénor', 'Gauvain', 'Mahaut', 'Tristan'];
    for (let i = 0; i < bots; i++) list.push({ id: 100 + i, name: BOT_NAMES[i % BOT_NAMES.length], job: 'chevalier', color: '#6aa0e0', bot: true });
    this.players = list.map((p, i) => this.makePlayer(p, i));
    this.inputs = new Map();
    this.lastC = new Map();
  }
  makePlayer(p, i) {
    const s = this.map.spawn, a = i * 2.1;
    const x = s.x + Math.sin(a) * i * 1.4, z = s.z + Math.cos(a) * i * 1.4;
    return { id: p.id, name: p.name, job: p.job || 'bucheron', color: p.color || '#e0a040', bot: !!p.bot, x, z, y: this.map.heightAt(x, z), vy: 0, ground: true,
      yaw: s.yaw, speed: 0, moving: 0, carry: null, act: null, actT: 0, target: null,
      hp: HP.player, down: false, downT: 0, dead: false, revive: 0, reviving: null, hurtT: 0, stored: 0, felled: 0, kills: 0, ai: null };
  }
  fallen = (id) => this.trees[id].down;
  player(id) { return this.players.find((p) => p.id === id); }
  foe(id) { return this.foes.find((f) => f.id === id); }
  setInput(id, inp) { this.inputs.set(id, inp); }
  get night() { return this.clock.phase === 'nuit'; }
  // 0 en plein jour, 1 en pleine nuit (crépuscule et aube en fondu)
  get darkness() {
    const c = this.clock;
    if (c.phase === 'nuit') return 1;
    if (c.t > CYCLE.day - CYCLE.dusk) return (c.t - (CYCLE.day - CYCLE.dusk)) / CYCLE.dusk;
    if (c.day > 1 && c.t < CYCLE.dawn) return 1 - c.t / CYCLE.dawn;
    return 0;
  }
  // temps avant le prochain changement (pour l'horloge à l'écran)
  get timeLeft() { const c = this.clock; return c.phase === 'nuit' ? CYCLE.night - c.t : CYCLE.day - c.t; }
  // un point est-il dans la lumière (feu de camp ou brasero allumé) ?
  lit(x, z) {
    const c = this.map.campfire;
    if (Math.hypot(x - c.x, z - c.z) < FIRE_LIGHT_R) return true;
    for (const b of this.map.braziers) if (this.braziers[b.id].fuel > 0 && Math.hypot(x - b.x, z - b.z) < LIGHT_R) return true;
    return false;
  }
  skipToDusk() { if (this.clock.phase === 'jour' && this.clock.t < CYCLE.day - CYCLE.dusk) this.clock.t = CYCLE.day - CYCLE.dusk; }

  // ------------------------------------------------------------------ un pas
  step() {
    if (this.over) return;
    this.t += DT; this.tick++;
    this.stepClock();
    // braseros : ils brûlent à la nuit tombée
    if (this.darkness > 0.5) for (const b of this.braziers) b.fuel = Math.max(0, b.fuel - DT * FUEL.burn);
    for (const p of this.players) if (p.bot) this.inputs.set(p.id, botInput(this, p));
    for (const p of this.players) this.stepPlayer(p, this.inputs.get(p.id) || emptyInput());
    this.stepRevives();
    this.stepFoes();
    for (const l of this.logs) if (!l.ready && this.t >= l.at) l.ready = true;
    if (this.goal === 3 && this.stock.bois >= 10) this.setGoal(4);
    this.checkOver();
  }
  setGoal(g) { if (g > this.goal) { this.goal = g; this.events.push({ t: 'goal', goal: g }); } }

  stepClock() {
    const c = this.clock;
    c.t += DT;
    if (c.phase === 'jour') {
      if (c.t >= CYCLE.day - CYCLE.dusk && !c.duskSaid) { c.duskSaid = true; this.events.push({ t: 'dusk' }); this.duskSnap = this.snapshot(); }
      if (c.t >= CYCLE.day) { c.phase = 'nuit'; c.t = 0; this.startNight(); }
    } else if (c.t >= CYCLE.night) {
      c.phase = 'jour'; c.t = 0; c.day++; c.duskSaid = false;
      this.dawn();
    }
  }
  startNight() {
    const n = this.clock.day;
    this.events.push({ t: 'night', n });
    if (this.goal < 5) this.setGoal(5);
    // les squelettes arrivent par petits groupes pendant les deux premiers tiers de la nuit
    const total = 6 + 3 * (n - 1), warriors = Math.max(1, Math.floor(total * (n === 1 ? 0.2 : 0.33)));
    const kinds = []; for (let i = 0; i < total; i++) kinds.push(i < warriors ? 'warrior' : 'minion');
    this.rng.shuffle(kinds);
    this.spawnQ = [];
    let at = 4;
    for (let i = 0; i < total;) {
      const g = Math.min(total - i, this.rng.int(2, 3)), side = this.rng.range(-1.4, 1.4);
      for (let k = 0; k < g; k++, i++) this.spawnQ.push({ at: at + k * 0.8, kind: kinds[i], side: side + this.rng.range(-0.25, 0.25) });
      at += (CYCLE.night * 0.62) / Math.ceil(total / 2.5);
    }
  }
  dawn() {
    this.stats.nights++;
    this.spawnQ = [];
    for (const f of this.foes) if (f.state !== 'dead') { f.state = 'dead'; f.t = 0; f.sun = true; }
    for (const f of this.foes) f.sun = true;
    for (const p of this.players) {
      if (p.dead || p.down) { p.dead = false; p.down = false; p.revive = 0; const c = this.map.campfire; p.x = c.x + 1.6; p.z = c.z + 1.6; p.y = this.map.heightAt(p.x, p.z); }
      p.hp = HP.player;
    }
    this.events.push({ t: 'dawn', n: this.clock.day - 1 });
    if (this.goal === 5) this.setGoal(6);
  }
  checkOver() {
    const alive = this.players.filter((p) => !p.dead);
    if (this.village.hp <= 0) this.over = { reason: 'entrepot' };
    else if (!alive.length || alive.every((p) => p.down)) this.over = { reason: 'equipe' };
    if (this.over) this.events.push({ t: 'over', reason: this.over.reason });
  }

  // ------------------------------------------------------------------ joueurs
  stepPlayer(p, inp) {
    const last = this.lastC.get(p.id) || { fc: 0, uc: 0 };
    const wantHit = inp.fc > last.fc, wantUse = inp.uc > last.uc;
    this.lastC.set(p.id, { fc: inp.fc, uc: inp.uc });
    const M = this.map;
    p.hurtT = Math.max(0, p.hurtT - DT);
    if (p.dead) return;
    if (p.down) {
      p.downT += DT;
      if (p.downT >= HP.bleed) { p.dead = true; p.down = false; this.events.push({ t: 'dead', pid: p.id }); }
      return;
    }
    // relever un équipier : E tenu tout près de lui
    p.reviving = null;
    if (inp.hold && !p.carry && !p.act) {
      const m = this.players.find((o) => o !== p && o.down && Math.hypot(o.x - p.x, o.z - p.z) < REACH.revive);
      if (m) { p.reviving = m.id; p.yaw = Math.atan2(m.x - p.x, m.z - p.z); }
    }

    if (p.act) {
      const A = ACT[p.act], before = p.actT;
      p.actT += DT;
      const at = A.hit ?? A.at;
      if (before < at && p.actT >= at) this.resolve(p);
      if (p.actT >= A.dur) { p.act = null; p.target = null; }
    } else if (p.reviving !== null) {
      // immobile pendant qu'on relève
    } else if (wantHit && !p.carry && p.ground) {
      // un squelette à portée passe avant les arbres
      const f = this.foeNear(p.x, p.z, REACH.strike + 0.4);
      if (f) { p.yaw = Math.atan2(f.x - p.x, f.z - p.z); p.act = 'strike'; p.actT = 0; p.target = f.id; }
      else {
        const t = M.treeNear(p.x, p.z, REACH.chop + 0.6, this.fallen);
        if (t) p.yaw = Math.atan2(t.x - p.x, t.z - p.z);
        p.act = 'chop'; p.actT = 0; p.target = t ? t.id : null;
      }
    } else if (wantUse && p.ground) this.use(p);

    let wx = inp.wx || 0, wz = inp.wz || 0;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    const busy = !!p.act || p.reviving !== null;
    const sp = busy ? 0 : p.carry ? SPEED.carry : inp.walk ? SPEED.walk : SPEED.run;
    const k = Math.min(1, len);
    let nx = p.x + wx * sp * DT, nz = p.z + wz * sp * DT;
    if (!busy && k > 0.05) p.yaw += wrap(Math.atan2(wx, wz) - p.yaw) * Math.min(1, DT * 12);
    if (M.isWater(nx, nz)) { nx = p.x; nz = p.z; }
    [nx, nz] = M.collide(nx, nz, P_R, this.fallen);
    p.speed = Math.hypot(nx - p.x, nz - p.z) / DT;
    p.x = nx; p.z = nz; p.moving = busy ? 0 : k;
    const g = M.heightAt(p.x, p.z);
    if (p.ground && inp.jump && !busy && !p.carry) { p.vy = JUMP_V; p.ground = false; this.events.push({ t: 'jump', pid: p.id }); }
    if (!p.ground) {
      p.vy -= GRAV * DT; p.y += p.vy * DT;
      if (p.y <= g) { p.y = g; p.vy = 0; p.ground = true; this.events.push({ t: 'land', pid: p.id }); }
    } else p.y = g;
    // le jour, près du feu de camp, on récupère
    if (!this.night && Math.hypot(p.x - M.campfire.x, p.z - M.campfire.z) < 6) p.hp = Math.min(HP.player, p.hp + 4 * DT);
  }
  stepRevives() {
    for (const m of this.players) {
      if (!m.down) continue;
      const helpers = this.players.filter((p) => p.reviving === m.id).length;
      if (helpers) m.revive += DT * (1 + 0.5 * (helpers - 1));
      else m.revive = Math.max(0, m.revive - DT * 2);
      if (m.revive >= HP.revive) { m.down = false; m.revive = 0; m.downT = 0; m.hp = HP.revived; this.events.push({ t: 'up', pid: m.id }); }
    }
  }
  hurt(p, dmg, from) {
    if (p.down || p.dead) return;
    p.hp -= dmg; p.hurtT = 0.4;
    this.events.push({ t: 'hurt', pid: p.id, dmg });
    if (p.hp <= 0) {
      p.hp = 0; p.down = true; p.downT = 0; p.revive = 0; p.act = null;
      // la bûche tombe avec lui
      if (p.carry) { this.logs.push({ id: this.nextLog++, x: p.x + 0.6, z: p.z, y: this.map.heightAt(p.x + 0.6, p.z), rot: p.yaw, at: this.t, ready: true }); p.carry = null; }
      this.events.push({ t: 'down', pid: p.id });
    }
  }

  // E : poser dans un brasero, ranger, poser par terre, ramasser
  use(p) {
    const M = this.map;
    if (p.carry) {
      const b = this.brazierNear(p.x, p.z, REACH.feed);
      if (b && this.braziers[b.id].fuel < FUEL.max - 5) { p.act = 'feed'; p.actT = 0; p.target = b.id; p.yaw = Math.atan2(b.x - p.x, b.z - p.z); return; }
      if (Math.hypot(p.x - M.depot.x, p.z - M.depot.z) < REACH.store) { p.act = 'store'; p.actT = 0; p.yaw = Math.atan2(M.warehouse.x - p.x, M.warehouse.z - p.z); return; }
      p.act = 'drop'; p.actT = 0; return;
    }
    if (this.players.some((o) => o !== p && o.down && Math.hypot(o.x - p.x, o.z - p.z) < REACH.revive)) return; // E se tient pour relever
    const l = this.logNear(p.x, p.z, REACH.pick);
    if (l) { p.act = 'pick'; p.actT = 0; p.target = l.id; p.yaw = Math.atan2(l.x - p.x, l.z - p.z); return; }
    if (this.canTake(p)) { p.act = 'take'; p.actT = 0; p.yaw = Math.atan2(M.warehouse.x - p.x, M.warehouse.z - p.z); }
  }
  // reprendre une bûche à l'entrepôt (pour les braseros), une fois le tutoriel des bûches passé
  canTake(p) { return this.stock.bois > 0 && this.goal >= 4 && Math.hypot(p.x - this.map.depot.x, p.z - this.map.depot.z) < REACH.store; }
  // le guerrier pare avec son bouclier les coups venus de face
  blocks(f, x, z) { return !!FOES[f.kind].block && f.state !== 'awaken' && f.stun <= 0 && Math.abs(wrap(Math.atan2(x - f.x, z - f.z) - f.yaw)) < 0.9; }
  logNear(x, z, r) {
    let best = null, bd = r;
    for (const l of this.logs) { if (!l.ready) continue; const d = Math.hypot(l.x - x, l.z - z); if (d < bd) { bd = d; best = l; } }
    return best;
  }
  brazierNear(x, z, r) {
    let best = null, bd = r;
    for (const b of this.map.braziers) { const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  foeNear(x, z, r) {
    let best = null, bd = r;
    for (const f of this.foes) { if (f.state === 'dead' || f.state === 'rise') continue; const d = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; best = f; } }
    return best;
  }

  resolve(p) {
    const M = this.map;
    if (p.act === 'chop') {
      const id = p.target;
      if (id === null || this.trees[id].down) { this.events.push({ t: 'swing', pid: p.id }); return; }
      const T = this.trees[id], src = M.trees[id];
      if (Math.hypot(src.x - p.x, src.z - p.z) - 0.55 * src.s > REACH.chop + 0.7) { this.events.push({ t: 'swing', pid: p.id }); return; }
      T.hp -= p.job === 'bucheron' ? 1.34 : 1;
      this.events.push({ t: 'hit', pid: p.id, tree: id, hp: Math.max(0, T.hp) });
      if (T.hp <= 0.01) {
        T.down = true; T.fallAt = this.t;
        T.dir = Math.atan2(src.x - p.x, src.z - p.z);
        p.felled++;
        this.events.push({ t: 'fall', pid: p.id, tree: id, dir: T.dir });
        for (let i = 0; i < LOGS_PER_TREE; i++) {
          const d = 2.2 + i * 2.1 * src.s;
          let x = src.x + Math.sin(T.dir) * d, z = src.z + Math.cos(T.dir) * d;
          if (M.isWater(x, z)) { x = src.x + Math.sin(T.dir) * 1.2; z = src.z + Math.cos(T.dir) * 1.2; }
          [x, z] = M.collide(x, z, 0.3, this.fallen);
          this.logs.push({ id: this.nextLog++, x, z, y: M.heightAt(x, z), rot: T.dir + (i ? 0.25 : -0.15), at: this.t + LOG_DELAY, ready: false });
        }
        if (this.goal === 0) this.setGoal(1);
      }
    } else if (p.act === 'strike') {
      const f = this.foe(p.target);
      if (!f || f.state === 'dead' || f.state === 'rise' || Math.hypot(f.x - p.x, f.z - p.z) > REACH.strike + 0.6) { this.events.push({ t: 'swing', pid: p.id }); return; }
      let dmg = DMG[p.job] || 30;
      // le guerrier pare de face avec son bouclier
      const blocked = this.blocks(f, p.x, p.z);
      if (blocked) dmg *= 0.3;
      f.hp -= dmg; f.stun = blocked ? 0.15 : 0.4;
      const d = Math.hypot(f.x - p.x, f.z - p.z) || 1;
      [f.x, f.z] = M.collide(f.x + (f.x - p.x) / d * (blocked ? 0.15 : 0.45), f.z + (f.z - p.z) / d * (blocked ? 0.15 : 0.45), 0.4, this.fallen);
      this.events.push({ t: blocked ? 'block' : 'strike', pid: p.id, foe: f.id, x: f.x, z: f.z });
      if (f.hp <= 0) this.killFoe(f, p);
    } else if (p.act === 'pick') {
      const l = this.logs.find((o) => o.id === p.target);
      if (!l) return;
      this.logs = this.logs.filter((o) => o !== l);
      p.carry = 'bois';
      this.events.push({ t: 'pick', pid: p.id });
      if (this.goal === 1) this.setGoal(2);
    } else if (p.act === 'store') {
      if (!p.carry) return;
      this.stock.bois++; p.stored++; p.carry = null;
      this.events.push({ t: 'store', pid: p.id, n: this.stock.bois });
      if (this.goal === 2) this.setGoal(3);
    } else if (p.act === 'feed') {
      if (!p.carry) return;
      const B = this.braziers[p.target];
      B.fuel = Math.min(FUEL.max, B.fuel + FUEL.log); p.carry = null;
      this.events.push({ t: 'feed', pid: p.id, brazier: p.target, fuel: B.fuel });
      if (this.goal === 4) this.setGoal(5);
    } else if (p.act === 'take') {
      if (p.carry || this.stock.bois <= 0) return;
      this.stock.bois--; p.carry = 'bois';
      this.events.push({ t: 'take', pid: p.id, n: this.stock.bois });
    } else if (p.act === 'drop') {
      if (!p.carry) return;
      let x = p.x + Math.sin(p.yaw) * 0.9, z = p.z + Math.cos(p.yaw) * 0.9;
      [x, z] = M.collide(x, z, 0.3, this.fallen);
      this.logs.push({ id: this.nextLog++, x, z, y: M.heightAt(x, z), rot: p.yaw + Math.PI / 2, at: this.t, ready: true });
      p.carry = null;
      this.events.push({ t: 'drop', pid: p.id });
    }
  }

  // ------------------------------------------------------------------ squelettes
  spawnFoe(kind, side) {
    const M = this.map;
    for (let tries = 0; tries < 40; tries++) {
      // ils sortent du sol au nord, entre le village et le château
      const a = Math.PI + side + this.rng.range(-0.3, 0.3), r = this.rng.range(34, 50);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (this.nav.blocked(x, z, this.fallen) || this.lit(x, z) || M.isWater(x, z)) continue;
      const F = FOES[kind];
      const f = { id: this.nextFoe++, kind, x, z, y: M.heightAt(x, z), yaw: Math.atan2(-x, -z), hp: F.hp, state: 'awaken', t: 0, rises: 0, stun: 0,
        tgt: null, path: null, pathAt: -9, pathTo: null, atkT: 0, stuck: 0 };
      this.foes.push(f);
      this.events.push({ t: 'spawn', foe: f.id, kind, x, z });
      return f;
    }
    return null;
  }
  killFoe(f, by) {
    f.state = 'dead'; f.t = 0; f.stun = 0;
    if (by) { by.kills++; this.stats.kills++; }
    this.events.push({ t: 'kill', foe: f.id, pid: by ? by.id : null, lit: this.lit(f.x, f.z) });
  }
  // la cible d'un squelette : un joueur proche, sinon un brasero allumé, sinon l'entrepôt
  chooseTarget(f) {
    let best = null, bd = 9;
    for (const p of this.players) { if (p.down || p.dead) continue; const d = Math.hypot(p.x - f.x, p.z - f.z); if (d < bd) { bd = d; best = { type: 'p', id: p.id }; } }
    if (best) return best;
    bd = 26;
    for (const b of this.map.braziers) { if (this.braziers[b.id].fuel <= 0) continue; const d = Math.hypot(b.x - f.x, b.z - f.z); if (d < bd) { bd = d; best = { type: 'b', id: b.id }; } }
    return best || { type: 'w' };
  }
  // point visé et distance à laquelle on frappe
  targetPoint(f, tg) {
    if (tg.type === 'p') { const p = this.player(tg.id); return p && !p.down && !p.dead ? { x: p.x, z: p.z, reach: FOES[f.kind].reach } : null; }
    if (tg.type === 'b') { const b = this.map.braziers[tg.id]; return this.braziers[tg.id].fuel > 0 ? { x: b.x, z: b.z, reach: 1.25 } : null; }
    const box = this.map.boxes.find((o) => o.id === 'entrepot');
    return { x: clamp(f.x, box.x0, box.x1), z: clamp(f.z, box.z0, box.z1), reach: 0.95 };
  }
  stepFoes() {
    const M = this.map;
    if (this.night) while (this.spawnQ.length && this.spawnQ[0].at <= this.clock.t) { const s = this.spawnQ.shift(); this.spawnFoe(s.kind, s.side); }
    for (const f of this.foes) {
      const F = FOES[f.kind];
      f.t += DT; f.stun = Math.max(0, f.stun - DT);
      if (f.state === 'awaken') { if (f.t >= RISE.awaken) { f.state = 'walk'; f.t = 0; } continue; }
      if (f.state === 'dead') {
        // dans la brume, il se relève (deux fois au plus) ; dans la lumière, il reste à terre
        if (!f.sun && f.t >= RISE.delay && f.rises < RISE.max && !this.lit(f.x, f.z) && this.night) { f.state = 'rise'; f.t = 0; f.rises++; this.events.push({ t: 'rise', foe: f.id }); }
        continue;
      }
      if (f.state === 'rise') { if (f.t >= RISE.dur) { f.state = 'walk'; f.t = 0; f.hp = F.hp * 0.6; } continue; }
      if (f.stun > 0) continue;
      // cible revue deux fois par seconde
      if (!f.tgt || this.tick % 15 === f.id % 15) f.tgt = this.chooseTarget(f);
      let tp = this.targetPoint(f, f.tgt);
      if (!tp) { f.tgt = this.chooseTarget(f); tp = this.targetPoint(f, f.tgt); if (!tp) continue; }
      const dx = tp.x - f.x, dz = tp.z - f.z, d = Math.hypot(dx, dz);
      if (f.state === 'attack') {
        f.yaw += wrap(Math.atan2(dx, dz) - f.yaw) * Math.min(1, DT * 10);
        const before = f.atkT; f.atkT += DT;
        if (before < F.hit && f.atkT >= F.hit && d < tp.reach + 0.5) this.foeHits(f, f.tgt);
        if (f.atkT >= F.dur) { f.state = 'walk'; f.atkT = 0; }
        continue;
      }
      if (d < tp.reach) { f.state = 'attack'; f.atkT = 0; this.events.push({ t: 'swingFoe', foe: f.id }); continue; }
      // chemin : recalculé quand la cible a bougé, ou de temps en temps
      if (!f.path || this.t - f.pathAt > 2 || (f.pathTo && Math.hypot(f.pathTo[0] - tp.x, f.pathTo[1] - tp.z) > 2.5)) {
        f.path = this.nav.path(f.x, f.z, tp.x, tp.z, this.fallen) || [[tp.x, tp.z]];
        f.pathAt = this.t; f.pathTo = [tp.x, tp.z];
      }
      while (f.path.length > 1 && Math.hypot(f.path[0][0] - f.x, f.path[0][1] - f.z) < 0.6) f.path.shift();
      const w = f.path[0] || [tp.x, tp.z];
      const wx = w[0] - f.x, wz = w[1] - f.z, wd = Math.hypot(wx, wz) || 1;
      const sp = F.speed * (this.lit(f.x, f.z) ? 0.85 : 1);
      let nx = f.x + wx / wd * sp * DT, nz = f.z + wz / wd * sp * DT;
      [nx, nz] = M.collide(nx, nz, 0.4, this.fallen);
      const moved = Math.hypot(nx - f.x, nz - f.z);
      f.stuck = moved < sp * DT * 0.3 ? f.stuck + DT : 0;
      if (f.stuck > 0.8) { f.path = null; f.stuck = 0; }
      f.x = nx; f.z = nz; f.y = M.heightAt(f.x, f.z);
      f.yaw += wrap(Math.atan2(wx, wz) - f.yaw) * Math.min(1, DT * 8);
    }
    // ils ne se marchent pas dessus
    const act = this.foes.filter((f) => f.state === 'walk' || f.state === 'attack');
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 0.85 && d > 1e-4) { const k = (0.85 - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
    }
    // les squelettes tombés à la lumière, ou au soleil, finissent en poussière
    this.foes = this.foes.filter((f) => {
      if (f.state === 'dead' && (f.sun ? f.t > 3 : (f.t > RISE.crumble && (this.lit(f.x, f.z) || f.rises >= RISE.max || !this.night)))) { this.events.push({ t: 'crumble', foe: f.id }); return false; }
      return true;
    });
  }
  foeHits(f, tg) {
    const F = FOES[f.kind];
    if (tg.type === 'p') { const p = this.player(tg.id); if (p) this.hurt(p, F.dmg, f); }
    else if (tg.type === 'b') { const B = this.braziers[tg.id]; B.fuel = Math.max(0, B.fuel - FUEL.hit); this.events.push({ t: 'brazierHit', brazier: tg.id, fuel: B.fuel }); }
    else { this.village.hp = Math.max(0, this.village.hp - F.dmg * 0.7); this.events.push({ t: 'wallHit', hp: this.village.hp }); }
  }

  // ------------------------------------------------------------------ pour l'écran
  // ce que E (ou le clic) ferait maintenant
  prompt(id) {
    const p = this.player(id), M = this.map;
    if (!p || p.act || p.down || p.dead) return null;
    const mate = this.players.find((o) => o !== p && o.down && Math.hypot(o.x - p.x, o.z - p.z) < REACH.revive + 0.4);
    if (mate && !p.carry) return { key: 'E', hold: true, text: `Relever ${mate.name} (tenir E)`, hp: mate.revive / HP.revive };
    if (p.carry) {
      const b = this.brazierNear(p.x, p.z, REACH.feed);
      if (b && this.braziers[b.id].fuel < FUEL.max - 5) return { key: 'E', text: 'Mettre la bûche dans le brasero', hp: this.braziers[b.id].fuel / FUEL.max };
      if (Math.hypot(p.x - M.depot.x, p.z - M.depot.z) < REACH.store) return { key: 'E', text: 'Ranger la bûche dans l\'entrepôt' };
      return { key: 'E', text: 'Poser la bûche' };
    }
    if (this.foeNear(p.x, p.z, REACH.strike + 0.4)) return { key: 'Clic', text: 'Frapper' };
    if (this.logNear(p.x, p.z, REACH.pick)) return { key: 'E', text: 'Ramasser la bûche' };
    if (this.canTake(p)) return { key: 'E', text: `Prendre une bûche à l'entrepôt (${this.stock.bois})` };
    const t = M.treeNear(p.x, p.z, REACH.chop + 0.6, this.fallen);
    if (t) return { key: 'Clic', text: 'Couper l\'arbre', hp: this.trees[t.id].hp / TREE_HP };
    const b = this.brazierNear(p.x, p.z, REACH.feed);
    if (b) return { key: '', text: `Brasero : ${Math.round(this.braziers[b.id].fuel)} s de feu (apporte une bûche)`, hp: this.braziers[b.id].fuel / FUEL.max };
    return null;
  }
  takeEvents() { const e = this.events; this.events = []; return e; }

  // état complet (sans la carte), pour rejouer une nuit ; plus tard pour le réseau
  snapshot() {
    return structuredClone({ t: this.t, tick: this.tick, clock: this.clock, stock: this.stock, trees: this.trees, logs: this.logs, nextLog: this.nextLog,
      braziers: this.braziers, village: this.village, foes: this.foes, nextFoe: this.nextFoe, spawnQ: this.spawnQ, goal: this.goal, stats: this.stats,
      players: this.players.map((p) => ({ ...p, ai: null })) });
  }
  restore(s) {
    const c = structuredClone(s);
    Object.assign(this, c);
    this.over = null; this.events = []; this.inputs = new Map();   // lastC est gardé : les compteurs d'appuis continuent
  }
}
