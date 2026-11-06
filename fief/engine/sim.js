// Fief Maudit : la simulation. Moteur PUR (aucun DOM, aucun réseau) : joueurs qui se déplacent dans la vallée,
// abattent les arbres à la hache, ramassent les bûches, les portent (plus lentement) et les rangent à l'entrepôt.
// Le pas est fixe (DT). L'entrée d'un joueur est déjà en coordonnées du monde : { wx, wz } (direction voulue, longueur ≤ 1),
// run, jump, et des compteurs d'appuis fc (frapper) et uc (utiliser) : un appui bref n'est jamais perdu.
import { createValley, TREE_HP } from './map.js';

export const DT = 1 / 30;
export const SPEED = { run: 5.2, walk: 2.4, carry: 3.0 };
export const ACT = {
  chop: { dur: 0.95, hit: 0.48 },     // coup de hache
  pick: { dur: 0.75, at: 0.45 },      // ramasser une bûche
  store: { dur: 0.6, at: 0.35 },      // ranger à l'entrepôt
  drop: { dur: 0.45, at: 0.2 },       // poser la bûche par terre
};
export const REACH = { chop: 1.6, pick: 1.9, store: 3.2 };
export const P_R = 0.42;              // rayon d'un joueur
const GRAV = 22, JUMP_V = 7.2;
const LOGS_PER_TREE = 2, LOG_DELAY = 1.3;

// étapes du petit tutoriel du premier jour
export const GOALS = [
  { id: 'chop', text: 'Abats un arbre à la hache', hint: 'Approche-toi d\'un arbre et frappe (clic)' },
  { id: 'pick', text: 'Ramasse une bûche', hint: 'E près d\'une bûche' },
  { id: 'store', text: 'Range-la à l\'entrepôt', hint: 'E devant la porte de l\'entrepôt' },
  { id: 'ten', text: 'Rentre 10 bûches avant la nuit', hint: 'Les arbres près du village tombent plus vite à deux… plus tard' },
  { id: 'done', text: 'Bravo, le village a du bois', hint: 'La nuit et les squelettes arrivent à l\'étape suivante' },
];

export const emptyInput = () => ({ wx: 0, wz: 0, run: false, walk: false, jump: false, fc: 0, uc: 0 });
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export class Sim {
  constructor({ seed = 1, players = [{ id: 0, name: 'Toi', job: 'bucheron', color: '#e0a040' }] } = {}) {
    this.seed = seed;
    this.map = createValley(seed);
    this.t = 0; this.tick = 0;
    this.day = 1;
    this.stock = { bois: 0, pierre: 0, nourriture: 0 };
    this.trees = this.map.trees.map((t) => ({ id: t.id, hp: TREE_HP, down: false, fallAt: 0, dir: 0 }));
    this.logs = []; this.nextLog = 1;
    this.goal = 0;
    this.events = [];
    this.players = players.map((p, i) => this.makePlayer(p, i));
    this.inputs = new Map();
    this.lastC = new Map();
  }
  makePlayer(p, i) {
    const s = this.map.spawn, a = i * 1.1;
    const x = s.x + Math.sin(a) * i * 1.2, z = s.z + Math.cos(a) * i * 1.2;
    return { id: p.id, name: p.name, job: p.job || 'bucheron', color: p.color || '#e0a040', x, z, y: this.map.heightAt(x, z), vy: 0, ground: true,
      yaw: s.yaw, speed: 0, moving: 0, carry: null, act: null, actT: 0, target: null, stored: 0, felled: 0 };
  }
  fallen = (id) => this.trees[id].down;
  player(id) { return this.players.find((p) => p.id === id); }
  setInput(id, inp) { this.inputs.set(id, inp); }

  step() {
    this.t += DT; this.tick++;
    for (const p of this.players) this.stepPlayer(p, this.inputs.get(p.id) || emptyInput());
    // bûches qui tombent avec l'arbre : prêtes à être ramassées après un instant
    for (const l of this.logs) if (!l.ready && this.t >= l.at) l.ready = true;
    if (this.goal === 3 && this.stock.bois >= 10) this.setGoal(4);
  }
  setGoal(g) { if (g > this.goal) { this.goal = g; this.events.push({ t: 'goal', goal: g }); } }

  stepPlayer(p, inp) {
    const last = this.lastC.get(p.id) || { fc: 0, uc: 0 };
    const wantChop = inp.fc > last.fc, wantUse = inp.uc > last.uc;
    this.lastC.set(p.id, { fc: inp.fc, uc: inp.uc });
    const M = this.map;

    // ------------------------------------------------ action en cours
    if (p.act) {
      const A = ACT[p.act], before = p.actT;
      p.actT += DT;
      const at = A.hit ?? A.at;
      if (before < at && p.actT >= at) this.resolve(p);
      if (p.actT >= A.dur) { p.act = null; p.target = null; }
    } else if (wantChop && !p.carry && p.ground) {
      // la hache se tourne vers l'arbre le plus proche, s'il y en a un à portée
      const t = M.treeNear(p.x, p.z, REACH.chop + 0.6, this.fallen);
      if (t) p.yaw = Math.atan2(t.x - p.x, t.z - p.z);
      p.act = 'chop'; p.actT = 0; p.target = t ? t.id : null;
    } else if (wantUse && p.ground) this.use(p);

    // ------------------------------------------------ déplacement (immobile pendant une action)
    let wx = inp.wx || 0, wz = inp.wz || 0;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    const busy = !!p.act;
    const sp = busy ? 0 : p.carry ? SPEED.carry : inp.walk ? SPEED.walk : SPEED.run;
    const k = Math.min(1, len);
    let nx = p.x + wx * sp * DT, nz = p.z + wz * sp * DT;
    if (!busy && k > 0.05) p.yaw += wrap(Math.atan2(wx, wz) - p.yaw) * Math.min(1, DT * 12);
    // pas dans l'eau profonde
    if (M.isWater(nx, nz)) { nx = p.x; nz = p.z; }
    [nx, nz] = M.collide(nx, nz, P_R, this.fallen);
    const moved = Math.hypot(nx - p.x, nz - p.z) / DT;
    p.x = nx; p.z = nz;
    p.speed = moved; p.moving = busy ? 0 : k;
    // saut et gravité
    const g = M.heightAt(p.x, p.z);
    if (p.ground && inp.jump && !busy && !p.carry) { p.vy = JUMP_V; p.ground = false; this.events.push({ t: 'jump', pid: p.id }); }
    if (!p.ground) {
      p.vy -= GRAV * DT; p.y += p.vy * DT;
      if (p.y <= g) { p.y = g; p.vy = 0; p.ground = true; this.events.push({ t: 'land', pid: p.id }); }
    } else p.y = g;
  }

  // E : ramasser, ranger, ou poser
  use(p) {
    const M = this.map;
    if (p.carry) {
      const d = Math.hypot(p.x - M.depot.x, p.z - M.depot.z);
      if (d < REACH.store) { p.act = 'store'; p.actT = 0; p.yaw = Math.atan2(M.warehouse.x - p.x, M.warehouse.z - p.z); }
      else { p.act = 'drop'; p.actT = 0; }
      return;
    }
    const l = this.logNear(p.x, p.z, REACH.pick);
    if (l) { p.act = 'pick'; p.actT = 0; p.target = l.id; p.yaw = Math.atan2(l.x - p.x, l.z - p.z); }
  }
  logNear(x, z, r) {
    let best = null, bd = r;
    for (const l of this.logs) { if (!l.ready || l.held) continue; const d = Math.hypot(l.x - x, l.z - z); if (d < bd) { bd = d; best = l; } }
    return best;
  }

  // le moment où l'action fait effet (la hache touche, la bûche est soulevée…)
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
        T.dir = Math.atan2(src.x - p.x, src.z - p.z);   // l'arbre tombe dans le sens du coup
        p.felled++;
        this.events.push({ t: 'fall', pid: p.id, tree: id, dir: T.dir });
        for (let i = 0; i < LOGS_PER_TREE; i++) {
          const d = 2.2 + i * 2.1 * src.s;
          let x = src.x + Math.sin(T.dir) * d, z = src.z + Math.cos(T.dir) * d;
          if (M.isWater(x, z)) { x = src.x + Math.sin(T.dir) * 1.2; z = src.z + Math.cos(T.dir) * 1.2; }
          [x, z] = M.collide(x, z, 0.3, this.fallen);
          this.logs.push({ id: this.nextLog++, x, z, y: M.heightAt(x, z), rot: T.dir + (i ? 0.25 : -0.15), at: this.t + LOG_DELAY, ready: false, held: false });
        }
        if (this.goal === 0) this.setGoal(1);
      }
    } else if (p.act === 'pick') {
      const l = this.logs.find((o) => o.id === p.target);
      if (!l || l.held) return;
      this.logs = this.logs.filter((o) => o !== l);
      p.carry = 'bois';
      this.events.push({ t: 'pick', pid: p.id });
      if (this.goal === 1) this.setGoal(2);
    } else if (p.act === 'store') {
      if (!p.carry) return;
      this.stock.bois++; p.stored++; p.carry = null;
      this.events.push({ t: 'store', pid: p.id, n: this.stock.bois });
      if (this.goal === 2) this.setGoal(3);
    } else if (p.act === 'drop') {
      if (!p.carry) return;
      let x = p.x + Math.sin(p.yaw) * 0.9, z = p.z + Math.cos(p.yaw) * 0.9;
      [x, z] = this.map.collide(x, z, 0.3, this.fallen);
      this.logs.push({ id: this.nextLog++, x, z, y: this.map.heightAt(x, z), rot: p.yaw + Math.PI / 2, at: this.t, ready: true, held: false });
      p.carry = null;
      this.events.push({ t: 'drop', pid: p.id });
    }
  }

  // ce que E (ou le clic) ferait maintenant, pour l'invite à l'écran
  prompt(id) {
    const p = this.player(id), M = this.map;
    if (!p || p.act) return null;
    if (p.carry) {
      if (Math.hypot(p.x - M.depot.x, p.z - M.depot.z) < REACH.store) return { key: 'E', text: 'Ranger la bûche dans l\'entrepôt' };
      return { key: 'E', text: 'Poser la bûche' };
    }
    if (this.logNear(p.x, p.z, REACH.pick)) return { key: 'E', text: 'Ramasser la bûche' };
    const t = M.treeNear(p.x, p.z, REACH.chop + 0.6, this.fallen);
    if (t) return { key: 'Clic', text: 'Couper l\'arbre', hp: this.trees[t.id].hp / TREE_HP };
    return null;
  }
  takeEvents() { const e = this.events; this.events = []; return e; }
}
