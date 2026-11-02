// Mystère Mystère : le moteur, sans DOM ni réseau. L'hôte le fait tourner à 60 Hz ; les invités rejouent seulement movePlayer
// pour anticiper leur propre pas. Règles façon Murder Mystery 2 : un meurtrier (couteau, lancer, coupure de courant), un shérif
// (revolver), des innocents qui ramassent les pièces d'or. Le shérif qui abat un innocent est sonné et lâche son arme ;
// le revolver d'un shérif mort tombe aussi, et le premier innocent qui le ramasse devient le héros.
// Les bots passent par la même porte que les joueurs : ils remplissent une commande (inp) à chaque pas.
import { makeRng } from './rng.js';
import { buildMap, LV_Y, li, groundAt, levelFor, blocksAt, hasLOS, solidAt, roomAt, W, T } from './map.js';
import { updateBots } from './bots.js';

export const DT = 1 / 60;
export const SPEED = { walk: 4.4, run: 6.4 };
export const R_BODY = 0.32, EYE = 1.55, BODY_H = 1.8;
export const JUMP_V = 5.6, GRAV = 17;
export const INTRO_T = 5;
export const CD = { stab: 0.85, throw: 1.4, gun: 2.6, bo: 70, boFirst: 25, draw: 0.22 };
export const STAB_R = 2.4, KNIFE_V = 30, KNIFE_G = 5, KNIFE_RET = 8, GUN_R = 70, STUN_T = 3, BO_T = 12, PASS_T = 7;
export const COIN_BAG = 40;
export const ROLE = { m: 'Meurtrier', s: 'Shérif', i: 'Innocent', h: 'Héros', x: 'Explorateur' };
// bits de l'état rapide d'un joueur (rangée envoyée 20 fois par seconde)
export const FL = { MOVE: 1, RUN: 2, AIR: 4, DRAWN: 8, KNIFE: 16, GUN: 32, ATK: 64, SHOT: 128, THROW: 256, DEAD: 512, STUN: 1024, FROZEN: 2048, SPEC: 4096 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// tp : force du lancer (0,3 à 1), réglée en tenant G en mode sans souris
export const emptyInput = () => ({ mx: 0, my: 0, yaw: 0, pitch: 0, run: false, jump: false, draw: false, ws: 0, fc: 0, sc: 0, uc: 0, bc: 0, q: 0, tp: 1 });
export const alive = (p) => p.st === 'ok';
const aimDir = (yaw, pitch) => [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];

// ------------------------------------------------------------------ déplacement (partagé avec la prédiction des invités)
// seuls les points du bord qui avancent comptent : on peut toujours s'écarter d'un obstacle qu'on frôle
function hits(M, w, lv, x, z, y, dx, dz) {
  if (blocksAt(M, w, lv, x, z, y)) return true;
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6, cx = Math.cos(a), cz = Math.sin(a);
    if (cx * dx + cz * dz <= 0.05) continue;
    if (blocksAt(M, w, lv, x + cx * R_BODY, z + cz * R_BODY, y)) return true;
  }
  return false;
}
export function canMove(w, p) { return p.st === 'ok' && !(p.stun > 0) && !(w && w.ph === 'intro'); }
export function movePlayer(M, w, p, inp, dt) {
  p.yaw = inp.yaw; p.pitch = clamp(inp.pitch, -1.45, 1.45);
  const can = canMove(w, p);
  const mx = can ? clamp(inp.mx, -1, 1) : 0, my = can ? clamp(inp.my, -1, 1) : 0;
  p.moving = !!(mx || my);
  p.run = p.moving && !!inp.run && p.stam > 1 && my > -0.2;
  p.stam = clamp(p.stam + (p.run ? -100 / 5 : 100 / 7) * dt, 0, 100);
  if (p.moving) {
    let l = Math.hypot(mx, my); if (l < 1) l = 1;
    const v = (p.run ? SPEED.run : SPEED.walk) * (p.mul || 1);
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    // avant = -z quand yaw = 0 ; droite = +x
    const vx = (mx * c - my * s) / l * v, vz = (-mx * s - my * c) / l * v;
    const nx = p.x + vx * dt, nz = p.z + vz * dt;
    if (!hits(M, w, p.lv, nx, p.z, p.y, Math.sign(vx), 0)) p.x = nx;
    if (!hits(M, w, p.lv, p.x, nz, p.y, 0, Math.sign(vz))) p.z = nz;
  }
  // saut et gravité
  const g = groundAt(M, p.lv, p.x, p.z);
  if (!p.air) {
    if (can && inp.jump && p.jumpOk !== false) { p.vy = JUMP_V; p.air = true; p.jumpOk = false; }
    else if (g < p.y - 0.9) { p.air = true; p.vy = 0; }
    else p.y = g;
  }
  if (!inp.jump) p.jumpOk = true;
  if (p.air) {
    p.vy -= GRAV * dt; p.y += p.vy * dt;
    if (p.y <= g) { p.y = g; p.vy = 0; p.air = false; }
    if (p.y > LV_Y[li(p.lv)] + 3.9 - BODY_H && p.vy > 0) p.vy = 0; // plafond
  }
  p.lv = levelFor(M, p.lv, p.x, p.z, p.y);
}

// ------------------------------------------------------------------ partie
export class Sim {
  constructor({ seed = 1, mode = 'classic', duration = 180, level = 'normal', map } = {}) {
    this.M = map || buildMap();
    this.rng = makeRng(seed);
    this.level = level;
    this.players = []; this.byId = new Map();
    this.events = [];
    this.dirty = true;
    this.w = {
      ph: 'intro', t: mode === 'explore' ? -1 : duration, dur: duration, intro: mode === 'explore' ? 0.6 : INTRO_T, mode, round: 1,
      pass: this.M.passages.map(() => 0), coins: [], knives: [], guns: [], bo: 0, win: null, why: '', roles: null, nid: 1, coinT: 1,
      gunDown: false, sheriffDead: false,
    };
    this.time = 0;
  }
  addPlayer({ id, name, color, model = 0, bot = false, role = 'i', spec = false }) {
    const M = this.M, k = this.players.length, sp = M.spawns[k % M.spawns.length];
    const p = {
      id, name, color, model, bot, role, st: spec ? 'spec' : 'ok', spec,
      x: sp.x, y: 0, z: sp.z, lv: sp.lv, vy: 0, air: false, yaw: sp.yaw, pitch: 0, run: false, moving: false, stam: 100,
      drawn: false, ws: 0, hasKnife: role === 'm' || role === 'x', hasGun: role === 's' || role === 'x', hero: false,
      cd: { stab: 0, throw: 0, gun: 0, bo: CD.boFirst, draw: 0 }, stun: 0, atkT: 0, shotT: 0, throwT: 0,
      coins: 0, kills: 0, score: 0, inp: emptyInput(), pc: { fc: 0, sc: 0, uc: 0, bc: 0 }, q: 0, deadAt: 0, how: '', by: null,
    };
    if (spec) { p.x = 20.5; p.z = 18.5; }
    this.players.push(p); this.byId.set(id, p);
    this.dirty = true;
    return p;
  }
  // les rôles : un meurtrier, un shérif, le reste innocent (mode découverte : tout le monde explore)
  assignRoles(pref = {}) {
    const pool = this.players.filter((p) => !p.spec);
    if (this.w.mode === 'explore') { for (const p of pool) this.setRole(p, 'x'); return; }
    const pick = (cands) => {
      // un joueur déjà meurtrier à la manche d'avant a moins de chances de l'être encore
      const ws = cands.map((p) => (pref.avoid && pref.avoid.includes(p.id) ? 0.35 : 1));
      let tot = ws.reduce((a, b) => a + b, 0), r = this.rng.next() * tot;
      for (let i = 0; i < cands.length; i++) { r -= ws[i]; if (r <= 0) return cands[i]; }
      return cands[cands.length - 1];
    };
    const m = pref.murderer != null ? pool.find((p) => p.id === pref.murderer) || pick(pool) : pick(pool);
    const rest = pool.filter((p) => p !== m);
    const s = pref.sheriff != null ? rest.find((p) => p.id === pref.sheriff) || pick(rest) : pick(rest);
    for (const p of pool) this.setRole(p, p === m ? 'm' : p === s ? 's' : 'i');
  }
  setRole(p, role) { p.role = role; p.hasKnife = role === 'm' || role === 'x'; p.hasGun = role === 's' || role === 'x'; p.hero = false; this.dirty = true; }
  setInput(id, inp) { const p = this.byId.get(id); if (p && !p.bot) p.inp = inp; }
  emit(e) { this.events.push(e); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---------------------------------------------------------------- un pas
  step(dt = DT) {
    const w = this.w;
    this.time += dt;
    if (w.ph === 'over') { for (const p of this.players) { p.atkT = Math.max(0, p.atkT - dt); p.shotT = Math.max(0, p.shotT - dt); } return; }
    if (w.ph === 'intro') { w.intro -= dt; if (w.intro <= 0) { w.ph = 'play'; this.dirty = true; this.emit({ e: 'start' }); } }
    else if (w.t > 0) { w.t = Math.max(0, w.t - dt); if (w.t <= 0) return this.finish('i', 'time'); }
    if (w.bo > 0) { w.bo = Math.max(0, w.bo - dt); if (w.bo === 0) { this.dirty = true; this.emit({ e: 'lights' }); } }
    // passages qui se referment (pas sur quelqu'un)
    for (let k = 0; k < w.pass.length; k++) if (w.pass[k] > 0) {
      w.pass[k] -= dt;
      if (w.pass[k] <= 0) { if (this.someoneIn(this.M.passages[k])) w.pass[k] = 0.5; else { w.pass[k] = 0; this.dirty = true; this.emit({ e: 'pass', id: k, open: false }); } }
    }
    if (w.ph === 'play') updateBots(this, dt);
    for (const p of this.players) this.stepPlayer(p, dt);
    this.stepKnives(dt);
    if (w.ph === 'play') { this.stepCoins(dt); this.checkWin(); }
  }
  someoneIn(ps) {
    for (const p of this.players) if (p.st === 'ok' && p.lv === ps.lv) {
      for (const i of ps.cells) { const cx = i % W, cz = Math.floor(i / W); if (Math.abs(p.x - cx - 0.5) < 0.5 + R_BODY && Math.abs(p.z - cz - 0.5) < 0.5 + R_BODY) return true; }
    }
    return false;
  }
  stepPlayer(p, dt) {
    const w = this.w, inp = p.inp;
    for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] = Math.max(0, p.cd[k] - dt);
    p.atkT = Math.max(0, p.atkT - dt); p.shotT = Math.max(0, p.shotT - dt); p.throwT = Math.max(0, p.throwT - dt);
    if (p.stun > 0) p.stun = Math.max(0, p.stun - dt);
    if (p.st !== 'ok') { p.pc = { fc: inp.fc, sc: inp.sc, uc: inp.uc, bc: inp.bc }; return; }
    movePlayer(this.M, w, p, inp, dt);
    p.q = inp.q || p.q;
    // arme en main : le shérif, le héros et le meurtrier choisissent ; sonné, on ne tient rien
    const had = p.drawn;
    const can = w.ph === 'play' && !(p.stun > 0);
    p.ws = p.role === 'x' ? (inp.ws === 1 ? 1 : 0) : p.role === 'm' ? 0 : 1;
    p.drawn = !!inp.draw && can && this.holding(p) !== null;
    if (p.drawn && !had) { p.cd.draw = CD.draw; this.emit({ e: 'draw', id: p.id, k: this.holding(p), x: p.x, y: p.y, z: p.z }); }
    // appuis comptés : un appui bref ou un paquet perdu ne fait pas rater l'action
    const fire = inp.fc !== p.pc.fc, alt = inp.sc !== p.pc.sc, use = inp.uc !== p.pc.uc, bo = inp.bc !== p.pc.bc;
    p.pc = { fc: inp.fc, sc: inp.sc, uc: inp.uc, bc: inp.bc };
    if (use) this.use(p);
    if (!can) return;
    const held = p.drawn && p.cd.draw <= 0 ? this.holding(p) : null;
    if (fire && held === 'knife') this.stab(p);
    else if (fire && held === 'gun') this.shoot(p);
    if (alt && held === 'knife') this.throwKnife(p);
    if (bo && p.role === 'm') this.blackout(p);
    // revolver au sol : ramassé en passant dessus (jamais par le meurtrier)
    if (p.role !== 'm' && !p.hasGun && w.guns.length && !(p.stun > 0)) {
      for (let k = w.guns.length - 1; k >= 0; k--) {
        const g = w.guns[k];
        if (g.lv === p.lv && Math.hypot(g.x - p.x, g.z - p.z) < 1.1 && Math.abs(g.y - p.y) < 1.3) {
          w.guns.splice(k, 1); p.hasGun = true; if (p.role === 'i') { p.role = 'h'; p.hero = true; }
          this.dirty = true; w.gunDown = w.guns.length > 0;
          this.emit({ e: 'gunpick', id: p.id, x: g.x, y: g.y, z: g.z });
        }
      }
    }
    // couteau planté : le meurtrier le récupère en passant dessus
    if (p.role === 'm' && !p.hasKnife) for (const k of w.knives) if (!k.fly && k.owner === p.id && Math.hypot(k.x - p.x, k.z - p.z) < 1.3 && Math.abs(k.y - p.y - 0.8) < 1.8) this.returnKnife(k, true);
  }
  // l'arme que le joueur peut tenir : 'knife', 'gun' ou null
  holding(p) {
    if (p.role === 'x') return p.ws === 1 ? 'gun' : 'knife';
    if (p.role === 'm') return p.hasKnife ? 'knife' : null;
    return p.hasGun ? 'gun' : null;
  }
  // ---------------------------------------------------------------- actions
  use(p) {
    const M = this.M, w = this.w;
    // passage secret devant soi
    let best = null, bd = 2.1;
    for (const ps of M.passages) {
      if (ps.lv !== p.lv) continue;
      const d = Math.hypot(ps.x - p.x, ps.z - p.z);
      if (d < bd) { bd = d; best = ps; }
    }
    if (best) {
      if (w.pass[best.id] > 0) { if (!this.someoneIn(best)) { w.pass[best.id] = 0; this.emit({ e: 'pass', id: best.id, open: false, by: p.id }); } }
      else { w.pass[best.id] = PASS_T; this.emit({ e: 'pass', id: best.id, open: true, by: p.id }); }
      this.dirty = true;
      return;
    }
    if (p.role === 'm' && !p.hasKnife) for (const k of w.knives) if (!k.fly && k.owner === p.id && Math.hypot(k.x - p.x, k.z - p.z) < 2.4) { this.returnKnife(k, true); return; }
  }
  stab(p) {
    if (p.cd.stab > 0) return;
    p.cd.stab = CD.stab; p.atkT = 0.4;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best = null, bd = STAB_R;
    for (const q of this.players) {
      if (q === p || q.st !== 'ok') continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(q.y - p.y) > 1.4) continue;
      if (d > 0.6 && (dx * fx + dz * fz) / d < 0.45) continue;
      if (!hasLOS(this.M, this.w, p.lv, p.x, p.z, q.x, q.z) && q.lv === p.lv) continue;
      bd = d; best = q;
    }
    this.emit({ e: 'swing', id: p.id, x: p.x, y: p.y, z: p.z });
    if (best) this.hit(best, p, 'knife');
  }
  throwKnife(p) {
    if (p.cd.throw > 0 || p.cd.stab > 0.4 || !p.hasKnife) return;
    p.cd.throw = CD.throw; p.throwT = 0.45; p.hasKnife = false; p.drawn = false;
    const [dx, dy, dz] = aimDir(p.yaw, p.pitch), v = KNIFE_V * Math.min(1, Math.max(0.3, p.inp.tp ?? 1));
    const k = { id: this.w.nid++, owner: p.id, x: p.x + dx * 0.5, y: p.y + EYE - 0.1 + dy * 0.5, z: p.z + dz * 0.5, vx: dx * v, vy: dy * v + 1, vz: dz * v, fly: true, ret: KNIFE_RET, life: 0, yaw: p.yaw };
    if (p.role === 'x') { p.hasKnife = true; k.owner = -1; }
    this.w.knives.push(k); this.dirty = true;
    this.emit({ e: 'throw', id: p.id, x: k.x, y: k.y, z: k.z });
  }
  returnKnife(k, picked) {
    const w = this.w, i = w.knives.indexOf(k);
    if (i >= 0) w.knives.splice(i, 1);
    const o = this.byId.get(k.owner);
    if (o) { o.hasKnife = true; if (picked) this.emit({ e: 'knifeback', id: o.id, x: k.x, y: k.y, z: k.z }); }
    this.dirty = true;
  }
  stepKnives(dt) {
    const w = this.w, M = this.M;
    for (const k of [...w.knives]) {
      if (!k.fly) { k.ret -= dt; if (k.ret <= 0) this.returnKnife(k, false); continue; }
      k.life += dt;
      for (let s = 0; s < 4 && k.fly; s++) {
        const h = dt / 4;
        k.vy -= KNIFE_G * h;
        const nx = k.x + k.vx * h, ny = k.y + k.vy * h, nz = k.z + k.vz * h;
        for (const q of this.players) {
          if (q.id === k.owner || q.st !== 'ok') continue;
          if (Math.hypot(q.x - nx, q.z - nz) < 0.5 && ny > q.y - 0.1 && ny < q.y + BODY_H + 0.1) {
            k.fly = false; k.x = q.x; k.z = q.z; k.y = q.y + 0.08; k.ret = KNIFE_RET;
            if (k.owner === -1) { this.emit({ e: 'hitmark', id: q.id, x: q.x, y: q.y, z: q.z }); }
            else this.hit(q, this.byId.get(k.owner), 'throw');
            break;
          }
        }
        if (!k.fly) break;
        if (solidAt(M, w, nx, ny, nz) || k.life > 3) { k.fly = false; k.ret = KNIFE_RET; this.emit({ e: 'stick', x: k.x, y: k.y, z: k.z }); break; }
        k.x = nx; k.y = ny; k.z = nz;
      }
      if (!k.fly) { this.dirty = true; if (k.owner === -1) this.returnKnife(k, false); }
    }
  }
  shoot(p) {
    if (p.cd.gun > 0) return;
    p.cd.gun = CD.gun; p.shotT = 0.35;
    const [dx, dy, dz] = aimDir(p.yaw, p.pitch), ox = p.x, oy = p.y + EYE, oz = p.z;
    let hit = null, end = GUN_R;
    for (let d = 0.3; d < GUN_R; d += 0.1) {
      const x = ox + dx * d, y = oy + dy * d, z = oz + dz * d;
      if (solidAt(this.M, this.w, x, y, z)) { end = d; break; }
      for (const q of this.players) {
        if (q === p || q.st !== 'ok') continue;
        if (y > q.y - 0.05 && y < q.y + BODY_H + 0.05 && Math.hypot(q.x - x, q.z - z) < (y > q.y + 1.35 ? 0.3 : 0.42)) { hit = q; break; }
      }
      if (hit) { end = d; break; }
    }
    this.emit({ e: 'shot', id: p.id, x: ox, y: oy, z: oz, tx: ox + dx * end, ty: oy + dy * end, tz: oz + dz * end, hit: hit ? hit.id : null });
    if (hit) this.hit(hit, p, 'gun');
  }
  blackout(p) {
    if (p.cd.bo > 0 || this.w.bo > 0) return;
    p.cd.bo = CD.bo; this.w.bo = BO_T; this.dirty = true;
    this.emit({ e: 'blackout', by: p.id });
  }
  // touche : en mode découverte, juste un marqueur
  hit(q, by, how) {
    if (this.w.mode === 'explore') { this.emit({ e: 'hitmark', id: q.id, x: q.x, y: q.y, z: q.z, by: by && by.id }); return; }
    // la balle d'un shérif (ou d'un héros) qui touche un innocent : l'innocent meurt, le tireur est sonné et lâche l'arme
    if (how === 'gun' && q.role !== 'm' && by) {
      this.kill(q, by, how);
      by.stun = STUN_T; by.drawn = false;
      if (by.hasGun) { by.hasGun = false; this.dropGun(by.x, by.y, by.z, by.lv); }
      this.emit({ e: 'misfire', id: by.id, victim: q.id, x: by.x, y: by.y, z: by.z });
      return;
    }
    this.kill(q, by, how);
  }
  kill(q, by, how) {
    const w = this.w;
    q.st = 'dead'; q.deadAt = this.time; q.how = how; q.by = by ? by.id : null; q.drawn = false; q.moving = false; q.run = false;
    if (by && by !== q) by.kills++;
    if (q.hasGun) { q.hasGun = false; this.dropGun(q.x, q.y, q.z, q.lv); }
    if (q.role === 's') w.sheriffDead = true;
    this.dirty = true;
    this.emit({ e: 'kill', id: q.id, x: q.x, y: q.y, z: q.z, how, sheriff: q.role === 's' || q.role === 'h' });
    if (q.role === 'm') this.finish('i', how === 'gun' ? 'shot' : 'dead', by);
  }
  dropGun(x, y, z, lv) {
    const g = { id: this.w.nid++, x, y: groundAt(this.M, lv, x, z), z, lv };
    this.w.guns.push(g); this.w.gunDown = true; this.dirty = true;
    this.emit({ e: 'gundrop', x: g.x, y: g.y, z: g.z, lv });
  }
  stepCoins(dt) {
    const w = this.w, M = this.M;
    const cap = 18 + this.players.filter((p) => !p.spec).length * 3;
    w.coinT -= dt;
    if (w.coinT <= 0 && w.coins.length < cap) {
      w.coinT = 1.2 + this.rng.next() * 1.2;
      for (let tries = 0; tries < 8; tries++) {
        const c = M.walk[Math.floor(this.rng.next() * M.walk.length)];
        if (w.coins.some((o) => o.lv === c.lv && Math.abs(o.x - c.x) + Math.abs(o.z - c.z) < 3)) continue;
        w.coins.push({ id: w.nid++, lv: c.lv, x: c.x, z: c.z, y: LV_Y[li(c.lv)] }); this.dirty = true; break;
      }
    }
    for (const p of this.players) {
      if (p.st !== 'ok' || p.coins >= COIN_BAG) continue;
      for (let k = w.coins.length - 1; k >= 0; k--) {
        const c = w.coins[k];
        if (c.lv === p.lv && Math.abs(c.x - p.x) < 0.9 && Math.abs(c.z - p.z) < 0.9 && Math.abs(c.y - p.y) < 1.3) {
          w.coins.splice(k, 1); p.coins++; this.dirty = true;
          this.emit({ e: 'coin', id: p.id, n: p.coins, x: c.x, y: c.y, z: c.z });
          if (p.coins >= COIN_BAG) break;
        }
      }
    }
  }
  checkWin() {
    if (this.w.mode === 'explore' || this.w.ph !== 'play') return;
    const live = this.players.filter((p) => p.st === 'ok');
    const m = this.players.find((p) => p.role === 'm');
    if (!m) return;
    if (m.st !== 'ok') return this.finish('i', 'dead');
    if (!live.some((p) => p.role !== 'm')) return this.finish('m', 'all');
  }
  finish(win, why, by) {
    const w = this.w;
    if (w.ph === 'over') return;
    w.ph = 'over'; w.win = win; w.why = why; w.hero = by ? by.id : null; w.bo = 0;
    w.roles = {}; for (const p of this.players) w.roles[p.id] = p.role;
    for (const p of this.players) {
      if (p.spec) { p.score = 0; continue; }
      let s = p.coins * 5;
      if (p.role === 'm') s += p.kills * 100 + (win === 'm' ? 300 : 0);
      else {
        if (win === 'i') s += 100 + (p.st === 'ok' ? 100 : 0);
        if (by && by.id === p.id) s += 300;
      }
      p.score = s; p.won = (win === 'm') === (p.role === 'm');
    }
    this.dirty = true;
    this.emit({ e: 'over', win, why, by: by ? by.id : null });
  }
  ranking() {
    return this.players.filter((p) => !p.spec).map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.bot, role: p.role, won: !!p.won, score: p.score, kills: p.kills, coins: p.coins, st: p.st, how: p.how }))
      .sort((a, b) => (b.won - a.won) || b.score - a.score);
  }
  // un joueur parti : un bot prend sa place, son rôle et ses armes
  replaceByBot(id) {
    const p = this.byId.get(id); if (!p || p.bot) return;
    if (p.spec) { this.players.splice(this.players.indexOf(p), 1); this.byId.delete(id); this.dirty = true; return; }
    p.bot = true; p.name = p.name + ' (bot)'; p.inp = emptyInput(); p.brain = null; this.dirty = true;
  }

  // ---------------------------------------------------------------- réseau
  // rangée d'un joueur : [id, x, y, z, yaw, pitch, drapeaux, dernier n° de commande vu, niveau]
  row(p) {
    let f = 0;
    if (p.moving) f |= FL.MOVE; if (p.run) f |= FL.RUN; if (p.air) f |= FL.AIR;
    const h = p.drawn ? this.holding(p) : null;
    if (h) f |= FL.DRAWN | (h === 'knife' ? FL.KNIFE : FL.GUN);
    if (p.atkT > 0) f |= FL.ATK; if (p.shotT > 0) f |= FL.SHOT; if (p.throwT > 0) f |= FL.THROW;
    if (p.st === 'dead') f |= FL.DEAD; if (p.stun > 0) f |= FL.STUN; if (this.w.ph === 'intro') f |= FL.FROZEN; if (p.spec) f |= FL.SPEC;
    return [p.id, Math.round(p.x * 100), Math.round(p.y * 100), Math.round(p.z * 100), Math.round(p.yaw * 1000), Math.round(p.pitch * 1000), f, p.q | 0, p.lv];
  }
  rows() { return this.players.map((p) => this.row(p)); }
  flying() { return this.w.knives.filter((k) => k.fly).map((k) => [k.id, Math.round(k.x * 100), Math.round(k.y * 100), Math.round(k.z * 100), Math.round(Math.atan2(k.vx, k.vz) * 1000)]); }
  // l'état lent, sans rien de secret : les rôles n'y sont qu'à la fin
  world() {
    const w = this.w;
    return {
      ph: w.ph, t: +w.t.toFixed(1), intro: +w.intro.toFixed(2), dur: w.dur, mode: w.mode, round: w.round, bo: +w.bo.toFixed(1), win: w.win, why: w.why, hero: w.hero ?? null,
      pass: w.pass.map((v) => (v > 0 ? 1 : 0)), coins: w.coins.map((c) => [c.id, c.lv, Math.round(c.x * 10), Math.round(c.z * 10)]),
      knives: w.knives.filter((k) => !k.fly).map((k) => [k.id, Math.round(k.x * 100), Math.round(k.y * 100), Math.round(k.z * 100), Math.round(k.yaw * 1000), k.owner]),
      guns: w.guns.map((g) => [g.id, Math.round(g.x * 100), Math.round(g.y * 100), Math.round(g.z * 100), g.lv]),
      gunDown: w.gunDown, sheriffDead: w.sheriffDead, roles: w.roles,
      pl: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, model: p.model, bot: p.bot, st: p.st, spec: p.spec, how: w.ph === 'over' ? p.how : undefined, score: w.ph === 'over' ? p.score : undefined, kills: w.ph === 'over' ? p.kills : undefined, coins: p.coins })),
    };
  }
  // ce que seul ce joueur sait de lui-même
  sheet(p) {
    return { role: p.role, hasKnife: p.hasKnife, hasGun: p.hasGun, coins: p.coins, cd: { stab: +p.cd.stab.toFixed(2), throw: +p.cd.throw.toFixed(2), gun: +p.cd.gun.toFixed(2), bo: +p.cd.bo.toFixed(1) }, stun: +p.stun.toFixed(2), stam: Math.round(p.stam), kills: p.kills };
  }
}

// le joueur peut-il voir l'autre ? (même niveau ou balcon au-dessus du hall)
export function sees(M, w, a, b, range = 30) {
  const d = Math.hypot(a.x - b.x, a.z - b.z);
  if (d > range) return false;
  if (a.lv === b.lv && Math.abs(a.y - b.y) < 2.5) return hasLOS(M, w, a.lv, a.x, a.z, b.x, b.z);
  // d'un niveau à l'autre : rayon dans le volume (balcon, escaliers)
  const ax = a.x, ay = a.y + EYE, az = a.z, bx = b.x, by = b.y + 1.2, bz = b.z, L = Math.hypot(bx - ax, by - ay, bz - az);
  for (let s = 0.4; s < L - 0.3; s += 0.25) { const k = s / L; if (solidAt(M, w, ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k)) return false; }
  return true;
}
export { roomAt, T };
