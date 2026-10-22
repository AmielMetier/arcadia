// Simulation d'Outbreak. Tourne chez l'hôte (ou en solo) à pas fixe ; les invités ne font qu'afficher ce qu'elle diffuse.
// Aucun DOM, aucun réseau : testable sous Node (tools/test-outbreak.mjs).
import { WEAPONS, ZOMBIES, PERKS, PERK_IDS, ROOM_TYPES, BRANCH_TYPES, CAMPAIGN_ROOMS, DIFFICULTY, GRENADE, WEAPON_IDS, ZOMBIE_IDS } from './data.js';
import { generateRoom, distanceField, flowDir, WALL_TOP, DOOR_W } from './level.js';
import { pushOutRect, segRect, segCircle, raycastSolids, clamp, angDiff } from './geom.js';
import { makeRng } from './rng.js';

export const DT = 1 / 60;
const PLAYER_R = 17;
const BASE_SPEED = 232;
const REVIVE_TIME = 3;
const DASH_SPEED = 680, DASH_TIME = 0.2, DASH_CD = 1.5;

const COST = { walker: 1, crawler: 0.7, runner: 1.4, spitter: 2.6, bloater: 3, screamer: 4.5, brute: 10 };

export class Sim {
  constructor(cfg = {}) {
    this.cfg = {
      mode: cfg.mode === 'survival' ? 'survival' : 'campaign',
      difficulty: DIFFICULTY[cfg.difficulty] ? cfg.difficulty : 'normal',
      startWeapon: WEAPONS[cfg.startWeapon] ? cfg.startWeapon : 'pistol',
      seed: cfg.seed || ((Math.random() * 2 ** 31) | 0),
    };
    this.diff = DIFFICULTY[this.cfg.difficulty];
    this.rng = makeRng(this.cfg.seed ^ 0x5eed);
    this.t = 0; this.tick = 0;
    this.phase = 'play'; // 'play' | 'over' | 'won'
    this.players = new Map();
    this.zombies = []; this.projs = []; this.eprojs = []; this.pickups = []; this.hazards = []; this.pending = [];
    this.destroyed = new Set();
    this.events = [];
    this.nid = 1;
    this.score = 0; this.kills = 0; this.roomsCleared = 0;
    this.endT = 0;
    this.rally = null;
    this.field = null; this.fieldT = 0;
    this.toast = null;
    if (this.cfg.mode === 'survival') this.startRoom('arena', 1);
    else this.startRoom('start', 1);
  }

  // ------------------------------------------------------------------ joueurs
  addPlayer({ id, name, color, bot = false }) {
    if (this.players.has(id)) return this.players.get(id);
    const w0 = this.cfg.startWeapon;
    const weapons = [mkWeapon('pistol')];
    if (w0 !== 'pistol') weapons.push(mkWeapon(w0));
    const n = this.players.size;
    const p = {
      id, name: String(name || 'Survivant').slice(0, 14), color: color || '#2b8cff', bot,
      x: this.lv.spawn.x + (n - 1.5) * 44, y: this.lv.spawn.y + (n % 2) * 30, vx: 0, vy: 0, kx: 0, ky: 0, r: PLAYER_R,
      aim: -Math.PI / 2, hp: 100, maxHp: 100, armor: 25, maxArmor: 50,
      state: 'ok', // 'ok' | 'down' | 'dead'
      bleed: 0, reviveP: 0, reviving: null, reviveBy: null,
      dashT: 0, dashCd: 0, dashCharges: 1, dashDir: 0,
      weapons, slot: weapons.length - 1, reloadT: 0, fireCd: 0, spin: 0,
      grenades: 2, perks: {}, offers: null, picksQueued: 0, offerT: 0,
      hurtT: 0, adrenaline: this.diff.adrenaline, secondUsed: false,
      input: blankInput(), last: { dash: 0, reload: 0, sw: 0, nade: 0, pk: 0, use: false },
      stats: { kills: 0, score: 0, revives: 0, downs: 0, dmg: 0 },
      seq: 0, emote: null,
    };
    this.players.set(id, p);
    this.collideBody(p);
    return p;
  }

  removePlayer(id) { this.players.delete(id); }

  setInput(id, inp) {
    const p = this.players.get(id); if (!p || !inp) return;
    // première commande reçue : caler les compteurs (une nouvelle partie ne doit pas rejouer d'anciennes actions)
    if (!p.inputSynced) { p.inputSynced = true; p.last = { dash: inp.dash, reload: inp.reload, sw: inp.sw, nade: inp.nade, pk: inp.pk, use: !!inp.use }; }
    p.input = inp;
    if (Number.isFinite(inp.q)) p.seq = inp.q;
  }

  standing() { return [...this.players.values()].filter((p) => p.state === 'ok'); }

  // ------------------------------------------------------------------ salles
  startRoom(type, index) {
    const seed = (this.cfg.seed + index * 1013 + type.length * 71) | 0;
    let exits = [];
    if (this.cfg.mode === 'campaign') {
      if (index >= CAMPAIGN_ROOMS) exits = [];
      else if (index === CAMPAIGN_ROOMS - 1) exits = ['core'];
      else { const r = makeRng(seed ^ 0xd00d); exits = r.shuffle(BRANCH_TYPES.slice()).slice(0, 2); }
    }
    this.room = { type, index, seed, exits };
    this.lv = generateRoom({ mode: this.cfg.mode, index, type, seed, exits });
    this.zombies = []; this.projs = []; this.eprojs = []; this.hazards = []; this.pending = [];
    this.pickups = this.pickups.filter(() => false);
    this.destroyed = new Set();
    this.barrels = this.lv.barrels.map((b) => ({ ...b, hp: 30, fuse: -1 }));
    this.crates = this.lv.crates.map((c) => ({ ...c, hp: 45 }));
    this.rally = null; this.cleared = false; this.field = null;
    this.doorsOpen = false;
    this.roomT = 0;
    // joueurs : à l'entrée, les morts reviennent, les blessés à terre se relèvent
    let k = 0;
    for (const p of this.players.values()) {
      p.x = this.lv.spawn.x + (k - (this.players.size - 1) / 2) * 46; p.y = this.lv.spawn.y + (k % 2) * 26; k++;
      p.vx = p.vy = p.kx = p.ky = 0;
      if (p.state === 'dead') { p.state = 'ok'; p.hp = Math.round(p.maxHp * 0.5); this.ev({ e: 'respawn', p: p.id }); }
      else if (p.state === 'down') { p.state = 'ok'; p.hp = Math.max(30, p.hp); }
      p.secondUsed = false; p.reviveP = 0; p.reviving = null; p.dashT = 0;
      if (p.offers) { this.applyPerk(p, p.offers[(Math.random() * p.offers.length) | 0]); }
      p.picksQueued = 0; p.offers = null;
      this.collideBody(p);
    }
    // vagues
    const isBoss = type === 'core';
    const n = this.cfg.mode === 'survival' ? 0 : isBoss ? 1 : index <= 2 ? 2 : 3;
    this.wave = { n: 0, total: n, budget: 0, timer: 2.2, spawnT: 0, breather: 0, endless: this.cfg.mode === 'survival' };
    if (this.cfg.mode === 'survival') { this.wave.total = Infinity; this.wave.timer = 3; }
    // butin de départ
    if (type === 'start') {
      this.spawnPickup('ammo', this.lv.spawn.x - 120, this.lv.spawn.y - 140);
      this.spawnPickup('nade', this.lv.spawn.x + 120, this.lv.spawn.y - 140);
    }
    this.ev({ e: 'room', i: index, ty: type });
    this.setToast(this.cfg.mode === 'survival' ? 'Survivez aux vagues' : isBoss ? 'Le Spécimen Zéro se réveille…' : ROOM_TYPES[type].name, 2.6);
  }

  setToast(text, dur = 2.5, kind = '') { this.toast = { text, until: this.t + dur, kind, n: (this.toast ? this.toast.n : 0) + 1 }; }

  // ------------------------------------------------------------------ boucle
  step(dt = DT) {
    this.t += dt; this.tick++;
    this.roomT += dt;
    if (this.phase !== 'play') { this.endT += dt; this.stepParticlesOnly(dt); return; }
    this.solidsNow = this.lv.solids.concat(
      this.lv.doors.filter((d) => !(d.kind === 'exit' && this.doorsOpen)).map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h, kind: 'door' })),
      this.crates.filter((c) => c.hp > 0),
    );
    this.blockers = this.solidsNow.filter((s) => !s.low);
    for (const p of this.players.values()) this.stepPlayer(p, dt);
    this.updateField(dt);
    this.stepWaves(dt);
    this.stepZombies(dt);
    this.stepProjectiles(dt);
    this.stepEnemyProjectiles(dt);
    this.stepHazards(dt);
    this.stepBarrels(dt);
    this.stepPickups(dt);
    this.stepRally(dt);
    this.checkWipe(dt);
    if (this.zombies.some((z) => z.hp <= 0)) this.zombies = this.zombies.filter((z) => z.hp > 0);
  }

  stepParticlesOnly(dt) {
    for (const z of this.zombies) { z.vx *= 0.9; z.vy *= 0.9; }
  }

  // ------------------------------------------------------------------ joueur
  stepPlayer(p, dt) {
    const inp = p.input, L = p.last;
    p.aim = Number.isFinite(inp.a) ? inp.a : p.aim;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;
    const dashMax = 1 + lvl(p, 'dash');
    if (p.dashCharges < dashMax) { p.dashCd -= dt * (1 + 0.55 * lvl(p, 'dash')); if (p.dashCd <= 0) { p.dashCharges++; p.dashCd = DASH_CD; } }
    if (lvl(p, 'regen') && p.state === 'ok' && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 1.5 * lvl(p, 'regen') * dt);
    if (p.offers && p.bot) { p.offerT -= dt; if (p.offerT <= 0) this.pickPerk(p, botPerkChoice(p)); }

    // choix d'amélioration (compteur pk, index pi)
    if (inp.pk !== L.pk) { L.pk = inp.pk; if (p.offers && inp.pi >= 0 && inp.pi < p.offers.length) this.pickPerk(p, p.offers[inp.pi]); }

    if (p.state === 'dead') { p.vx = p.vy = 0; this.consumeEdges(p); return; }

    if (p.state === 'down') {
      p.bleed -= dt * (p.reviveBy ? 0.25 : 1);
      if (p.bleed <= 0) { p.state = 'dead'; p.hp = 0; p.reviveP = 0; this.ev({ e: 'dead', p: p.id }); this.setToast(`${p.name} n'a pas survécu`, 2.4, 'bad'); }
      // adrénaline : relève automatique si personne ne peut aider
      if (p.adrenaline > 0 && p.state === 'down' && this.standing().length === 0 && this.t - p.downAt > 1.6) {
        p.adrenaline--; this.raise(p, 55); this.ev({ e: 'adren', p: p.id }); this.setToast('Adrénaline ! ' + p.name + ' se relève', 2.2, 'good');
      }
    }

    // armes
    const w = p.weapons[p.slot], W = WEAPONS[w.id];
    if (inp.sw !== L.sw) {
      L.sw = inp.sw;
      const target = inp.sl === -1 ? (p.slot + 1) % p.weapons.length : inp.sl === -2 ? (p.slot - 1 + p.weapons.length) % p.weapons.length : inp.sl;
      if (p.state === 'ok' && target >= 0 && target < p.weapons.length && target !== p.slot) { p.slot = target; p.reloadT = 0; p.fireCd = Math.max(p.fireCd, 0.18); p.spin = 0; this.ev({ e: 'sw', p: p.id }); }
    }
    if (p.state === 'down' && p.slot !== 0) { p.slot = 0; p.reloadT = 0; }
    const cw = p.weapons[p.slot], CW = WEAPONS[cw.id];
    if (inp.reload !== L.reload) { L.reload = inp.reload; this.startReload(p); }
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        const need = magSize(p, CW) - cw.mag;
        const take = Math.min(need, cw.res);
        cw.mag += take; if (cw.res !== Infinity) cw.res -= take;
        p.reloadT = 0; this.ev({ e: 'rl1', p: p.id });
      }
    }
    if (CW.spinUp) p.spin = inp.fire && p.state !== 'dead' ? Math.min(CW.spinUp + 0.2, p.spin + dt) : Math.max(0, p.spin - dt * 2);
    const reviving = p.reviving != null;
    if (inp.fire && !reviving && p.dashT <= 0 && p.reloadT <= 0 && p.fireCd <= 0 && (!CW.spinUp || p.spin >= CW.spinUp)) {
      if (cw.mag > 0) this.fire(p, cw, CW);
      else if (cw.res > 0) this.startReload(p);
      else if (p.state === 'ok') { p.fireCd = 0.3; this.ev({ e: 'dry', p: p.id }); }
    }
    if (cw.mag === 0 && cw.res > 0 && p.reloadT <= 0 && !inp.fire) this.startReload(p);

    // grenade
    if (inp.nade !== L.nade) {
      L.nade = inp.nade;
      if (p.state === 'ok' && p.grenades > 0) {
        p.grenades--;
        const d = clamp(Number(inp.td) || 300, 60, GRENADE.maxThrow);
        const sp = d / 0.7;
        this.eprojs.push({ id: this.nid++, k: 'nade', x: p.x + Math.cos(p.aim) * 20, y: p.y + Math.sin(p.aim) * 20, vx: Math.cos(p.aim) * sp, vy: Math.sin(p.aim) * sp, t: 0, fuse: GRENADE.fuse, owner: p.id });
        this.ev({ e: 'throw', p: p.id });
      }
    }

    // roulade
    if (inp.dash !== L.dash) {
      L.dash = inp.dash;
      if (p.state === 'ok' && p.dashCharges > 0 && p.dashT <= 0) {
        p.dashCharges--; if (p.dashCd <= 0) p.dashCd = DASH_CD;
        p.dashT = DASH_TIME;
        const mx = inp.mx || 0, my = inp.my || 0;
        p.dashDir = Math.hypot(mx, my) > 0.2 ? Math.atan2(my, mx) : p.aim;
        p.reviving = null;
        this.ev({ e: 'dash', p: p.id });
      }
    }

    // interaction (E) : relever un allié, sinon ramasser une arme
    const useEdge = inp.use && !L.use; L.use = !!inp.use;
    p.reviving = null;
    if (inp.use && p.state === 'ok') {
      let best = null, bd = 82 * 82;
      for (const o of this.players.values()) {
        if (o === p || o.state !== 'down') continue;
        const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        p.reviving = best.id; best.reviveBy = p.id;
        best.reviveP += (dt / REVIVE_TIME) * (1 + lvl(p, 'medic'));
        if (best.reviveP >= 1) {
          this.raise(best, 30 + 30 * lvl(p, 'medic'));
          p.stats.revives++; p.stats.score += 250;
          this.ev({ e: 'rev', p: best.id, by: p.id });
        }
      } else if (useEdge) this.tryPickWeapon(p);
    }
    for (const o of this.players.values()) if (o.state === 'down' && o.reviveBy === p.id && p.reviving !== o.id) { o.reviveBy = null; }

    // déplacement
    let sp = BASE_SPEED * (1 + 0.1 * lvl(p, 'speed'));
    if (lvl(p, 'rage') && p.hp < p.maxHp * 0.35) sp *= 1.4;
    if (CW.slow && p.spin > 0) sp *= CW.slow;
    if (p.state === 'down') sp = 52;
    if (reviving) sp = 0;
    let mx = clamp(Number(inp.mx) || 0, -1, 1), my = clamp(Number(inp.my) || 0, -1, 1);
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = Math.cos(p.dashDir) * DASH_SPEED; p.vy = Math.sin(p.dashDir) * DASH_SPEED;
      if (p.dashT <= 0) { p.vx *= 0.35; p.vy *= 0.35; }
    } else {
      const k = Math.min(1, dt * 16);
      p.vx += (mx * sp - p.vx) * k; p.vy += (my * sp - p.vy) * k;
    }
    p.x += (p.vx + p.kx) * dt; p.y += (p.vy + p.ky) * dt;
    p.kx *= Math.pow(0.0005, dt); p.ky *= Math.pow(0.0005, dt);
    this.collideBody(p);
    this.consumeEdges(p);
  }

  consumeEdges(p) {
    const inp = p.input, L = p.last;
    L.dash = inp.dash; L.reload = inp.reload; L.sw = inp.sw; L.nade = inp.nade; L.pk = inp.pk; L.use = !!inp.use;
  }

  collideBody(e) {
    const solids = this.solidsNow || this.lv.solids;
    for (let it = 0; it < 2; it++) {
      for (const s of solids) {
        if (e.x + e.r < s.x || e.x - e.r > s.x + s.w || e.y + e.r < s.y || e.y - e.r > s.y + s.h) continue;
        pushOutRect(e, s);
      }
    }
    if (this.barrels) for (const b of this.barrels) {
      if (b.hp <= 0) continue;
      const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy), m = e.r + b.r;
      if (d < m && d > 0.01) { e.x = b.x + (dx / d) * m; e.y = b.y + (dy / d) * m; }
    }
    const I = this.lv.inner;
    e.x = clamp(e.x, I.x0 + e.r, I.x1 - e.r);
    e.y = clamp(e.y, (this.doorsOpen ? 8 : I.y0) + e.r, I.y1 - e.r);
  }

  raise(p, hp) {
    p.state = 'ok'; p.hp = Math.min(p.maxHp, hp); p.reviveP = 0; p.reviveBy = null; p.bleed = 0; p.hurtT = 0.8;
  }

  startReload(p) {
    const w = p.weapons[p.slot], W = WEAPONS[w.id];
    if (p.reloadT > 0 || w.mag >= magSize(p, W) || w.res <= 0) return;
    p.reloadT = W.reload * Math.pow(0.75, lvl(p, 'reload')) * (p.state === 'down' ? 1.4 : 1);
    p.reloadDur = p.reloadT; p.spin = 0;
    this.ev({ e: 'rl', p: p.id, w: w.id });
  }

  // ------------------------------------------------------------------ tir
  dmgMult(p) {
    let m = 1 + 0.2 * lvl(p, 'dmg');
    if (lvl(p, 'rage') && p.hp < p.maxHp * 0.35) m *= 1.4;
    for (const o of this.players.values()) {
      if (o !== p && o.state === 'ok' && lvl(o, 'team') && (o.x - p.x) ** 2 + (o.y - p.y) ** 2 < 300 * 300) { m *= 1 + 0.15 * lvl(o, 'team'); break; }
    }
    if (p.state === 'down') m *= 0.8;
    return m;
  }

  fire(p, w, W) {
    w.mag--;
    p.fireCd = 1 / (W.rate * (1 + 0.15 * lvl(p, 'rate')));
    p.stats.shots = (p.stats.shots || 0) + 1;
    const mult = this.dmgMult(p);
    const ox = p.x + Math.cos(p.aim) * 26, oy = p.y + Math.sin(p.aim) * 26;
    // le canon ne doit pas traverser un mur
    const block = raycastSolids(this.blockers, p.x, p.y, ox, oy);
    const sx = block ? p.x : ox, sy = block ? p.y : oy;
    const angs = [];
    for (let i = 0; i < W.pellets; i++) {
      const spread = W.pellets > 1 ? ((i + Math.random()) / W.pellets * 2 - 1) * W.spread : (Math.random() * 2 - 1) * W.spread;
      const a = p.aim + spread;
      angs.push(Math.round(a * 1000) / 1000);
      if (W.rail) { this.railShot(p, sx, sy, a, W, mult); continue; }
      const spd = W.speed * (W.pellets > 1 ? 0.9 + Math.random() * 0.2 : 1);
      this.projs.push({
        x: sx, y: sy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: W.range / spd,
        dmg: W.dmg * mult, pen: W.pen + lvl(p, 'pierce') * (W.flame ? 0 : 1), knock: W.knock, owner: p.id, w: W.id,
        flame: !!W.flame, explosive: W.explosive || 0, bounce: lvl(p, 'ricochet') && !W.flame && !W.explosive ? 1 : 0, hit: null,
        drag: W.flame ? 2.2 : 0,
      });
    }
    p.kx -= Math.cos(p.aim) * W.kick; p.ky -= Math.sin(p.aim) * W.kick;
    this.ev({ e: 'f', p: p.id, w: W.id, x: Math.round(sx), y: Math.round(sy), a: angs });
  }

  railShot(p, x, y, a, W, mult) {
    const ex = x + Math.cos(a) * W.range, ey = y + Math.sin(a) * W.range;
    const wall = raycastSolids(this.blockers, x, y, ex, ey);
    const tEnd = wall ? wall.t : 1;
    const dx = ex - x, dy = ey - y;
    const hits = [];
    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      const t = segCircle(x, y, dx, dy, z.x, z.y, z.r);
      if (t >= 0 && t <= tEnd) hits.push([t, z]);
    }
    hits.sort((u, v) => u[0] - v[0]);
    let n = W.pen + lvl(p, 'pierce');
    for (const [, z] of hits) { if (n-- <= 0) break; this.damageZombie(z, W.dmg * mult, a, W.knock, p); }
    this.hitBarrelsOnSegment(x, y, dx * tEnd, dy * tEnd, W.dmg);
  }

  hitBarrelsOnSegment(x, y, dx, dy, dmg) {
    for (const b of this.barrels) {
      if (b.hp <= 0) continue;
      if (segCircle(x, y, dx, dy, b.x, b.y, b.r) >= 0) this.damageBarrel(b, dmg);
    }
  }

  stepProjectiles(dt) {
    const keep = [];
    for (const pr of this.projs) {
      pr.life -= dt;
      if (pr.drag) { const k = Math.exp(-pr.drag * dt); pr.vx *= k; pr.vy *= k; }
      let dx = pr.vx * dt, dy = pr.vy * dt;
      let alive = pr.life > 0;
      // murs
      const wall = raycastSolids(this.blockers, pr.x, pr.y, pr.x + dx, pr.y + dy);
      const tWall = wall ? wall.t : 1;
      // zombies sur le trajet
      const hits = [];
      for (const z of this.zombies) {
        if (z.hp <= 0 || (pr.hit && pr.hit.has(z.id))) continue;
        if (Math.abs(z.x - pr.x) > Math.abs(dx) + z.r + 40 || Math.abs(z.y - pr.y) > Math.abs(dy) + z.r + 40) continue;
        const t = segCircle(pr.x, pr.y, dx, dy, z.x, z.y, z.r + (pr.flame ? 8 : 2));
        if (t >= 0 && t <= tWall) hits.push([t, z]);
      }
      hits.sort((u, v) => u[0] - v[0]);
      const owner = this.players.get(pr.owner);
      for (const [t, z] of hits) {
        if (!alive) break;
        const a = Math.atan2(pr.vy, pr.vx);
        if (pr.explosive) {
          this.explode(pr.x + dx * t, pr.y + dy * t, pr.explosive * (1 + 0.3 * lvl(owner, 'nade')), pr.dmg, 0, owner, 'shell');
          alive = false; break;
        }
        this.damageZombie(z, pr.dmg, a, pr.knock, owner, pr.flame);
        if (pr.flame) (pr.hit = pr.hit || new Set()).add(z.id);
        else { (pr.hit = pr.hit || new Set()).add(z.id); if (--pr.pen <= 0) { alive = false; this.ev({ e: 'stop', x: Math.round(pr.x + dx * t), y: Math.round(pr.y + dy * t) }); } }
      }
      // barils et caisses
      if (alive && !pr.flame) {
        for (const b of this.barrels) {
          if (b.hp <= 0) continue;
          const t = segCircle(pr.x, pr.y, dx, dy, b.x, b.y, b.r);
          if (t >= 0 && t <= tWall) { this.damageBarrel(b, pr.dmg); if (pr.explosive) this.explode(b.x, b.y, pr.explosive, pr.dmg, 0, owner, 'shell'); alive = false; break; }
        }
      }
      if (alive && !pr.flame) {
        for (const c of this.crates) {
          if (c.hp <= 0) continue;
          const h = segRect(pr.x, pr.y, dx, dy, c);
          if (h && h.t <= tWall) { this.damageCrate(c, pr.dmg); if (pr.explosive) this.explode(pr.x + dx * h.t, pr.y + dy * h.t, pr.explosive, pr.dmg, 0, owner, 'shell'); alive = false; break; }
        }
      }
      if (alive && wall) {
        const hx = pr.x + dx * wall.t, hy = pr.y + dy * wall.t;
        if (pr.explosive) { this.explode(hx - (wall.nx || 0) * 6, hy - (wall.ny || 0) * 6, pr.explosive * (1 + 0.3 * lvl(owner, 'nade')), pr.dmg, 0, owner, 'shell'); alive = false; }
        else if (pr.bounce > 0 && !wall.inside) {
          pr.bounce--; pr.x = hx + wall.nx * 2; pr.y = hy + wall.ny * 2;
          if (wall.nx) pr.vx = -pr.vx; if (wall.ny) pr.vy = -pr.vy;
          pr.hit = null; keep.push(pr); this.ev({ e: 'ric', x: Math.round(hx), y: Math.round(hy) }); continue;
        } else { alive = false; if (!pr.flame) this.ev({ e: 'spark', x: Math.round(hx), y: Math.round(hy), nx: wall.nx, ny: wall.ny }); }
      }
      if (alive) { pr.x += dx; pr.y += dy; keep.push(pr); }
    }
    this.projs = keep;
  }

  // ------------------------------------------------------------------ dégâts
  damageZombie(z, dmg, ang, knock, by, flame = false) {
    if (z.hp <= 0) return;
    let crit = false;
    if (by && !flame && Math.random() < 0.12 * lvl(by, 'crit')) { dmg *= 2.5; crit = true; }
    if (z.state === 'stun') dmg *= 1.5;
    if (flame || (by && lvl(by, 'fire') && Math.random() < 0.2 * lvl(by, 'fire'))) { z.burnT = 3; z.burnBy = by ? by.id : null; }
    dmg = Math.max(1, dmg);
    z.hp -= dmg; z.flash = 0.07;
    if (by) by.stats.dmg += Math.min(dmg, z.hp + dmg);
    const mass = z.r / 16;
    const kb = (z.ty === 'boss' ? 0.05 : z.ty === 'brute' ? 0.15 : 1) * knock / mass;
    z.kx += Math.cos(ang) * kb; z.ky += Math.sin(ang) * kb;
    if (!flame || Math.random() < 0.15) this.ev({ e: 'h', i: z.id, x: Math.round(z.x), y: Math.round(z.y), a: Math.round(ang * 100) / 100, d: Math.round(dmg), c: crit ? 1 : 0, g: z.ty === 'spitter' || z.ty === 'bloater' ? 1 : 0 });
    if (z.ty !== 'boss' && z.tgtLock <= 0 && by) { z.tgt = by.id; z.tgtLock = 1.2; }
    if (z.hp <= 0) this.killZombie(z, ang, by);
  }

  killZombie(z, ang, by) {
    z.hp = 0;
    const Z = ZOMBIES[z.ty];
    this.kills++;
    const pts = Math.round(Z.score * (z.elite ? 2 : 1));
    this.score += pts;
    if (by) {
      by.stats.kills++; by.stats.score += pts;
      if (lvl(by, 'vamp') && by.state === 'ok') by.hp = Math.min(by.maxHp, by.hp + 2 * lvl(by, 'vamp'));
    }
    this.ev({ e: 'zd', x: Math.round(z.x), y: Math.round(z.y), t: ZOMBIE_IDS.indexOf(z.ty), a: Math.round(ang * 100) / 100, i: z.id, s: z.elite ? 1 : 0, pts });
    if (z.ty === 'bloater') this.explode(z.x, z.y, Z.blast, 120, Z.dmg * this.diff.zDmg, null, 'toxic');
    else if (by && lvl(by, 'chain') && Math.random() < 0.15) this.explode(z.x, z.y, 110, 90, 0, by, 'chain');
    if (z.ty === 'boss') { this.bossDead = true; this.setToast('Spécimen Zéro neutralisé !', 3, 'good'); }
    // butin
    const dropP = Z.drop * this.diff.drops * (z.elite ? 3 : 1) * (this.cfg.mode === 'survival' ? 0.8 : 1);
    if (Math.random() < dropP) {
      if ((z.ty === 'brute' || z.elite) && Math.random() < 0.45) this.spawnWeaponDrop(z.x, z.y, 2);
      else this.spawnPickup(this.rng.weighted([['ammo', 46], ['med', 26], ['armor', 14], ['nade', 14]]), z.x, z.y);
    }
  }

  hurtPlayer(p, dmg, sx, sy, knock = 0) {
    if (p.state !== 'ok' || p.dashT > 0 || p.hurtT > 0.55 || this.phase !== 'play') return false;
    dmg *= 1;
    if (p.armor > 0) { const a = Math.min(p.armor, dmg * 0.6); p.armor -= a; dmg -= a; }
    p.hp -= dmg; p.hurtT = 0.6;
    if (knock && sx != null) { const a = Math.atan2(p.y - sy, p.x - sx); p.kx += Math.cos(a) * knock; p.ky += Math.sin(a) * knock; }
    this.ev({ e: 'hurt', p: p.id, d: Math.round(dmg), x: Math.round(sx ?? p.x), y: Math.round(sy ?? p.y) });
    if (p.hp <= 0) {
      if (lvl(p, 'second') && !p.secondUsed) { p.secondUsed = true; p.hp = 45; p.hurtT = 1.5; this.ev({ e: 'adren', p: p.id }); this.setToast(`Second souffle pour ${p.name} !`, 2, 'good'); return true; }
      p.hp = 0; p.state = 'down'; p.bleed = this.diff.bleed; p.reviveP = 0; p.downAt = this.t; p.stats.downs++;
      p.slot = 0; p.reloadT = 0; p.spin = 0;
      this.ev({ e: 'down', p: p.id });
      this.setToast(`${p.name} est à terre !`, 2.2, 'bad');
    }
    return true;
  }

  explode(x, y, r, dmgZ, dmgP, by, kind) {
    this.ev({ e: 'boom', x: Math.round(x), y: Math.round(y), r: Math.round(r), k: kind });
    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      const d = Math.hypot(z.x - x, z.y - y);
      if (d < r + z.r) {
        const f = 1 - 0.6 * Math.min(1, d / r);
        this.damageZombie(z, dmgZ * f, Math.atan2(z.y - y, z.x - x), 380 * f, by);
      }
    }
    if (dmgP > 0) for (const p of this.players.values()) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < r + p.r) this.hurtPlayer(p, dmgP * (1 - 0.5 * Math.min(1, d / r)), x, y, 260);
    }
    for (const b of this.barrels) if (b.hp > 0 && Math.hypot(b.x - x, b.y - y) < r + b.r) { b.hp = 0; b.fuse = 0.12 + Math.random() * 0.1; }
    for (const c of this.crates) if (c.hp > 0 && Math.hypot(c.x + c.w / 2 - x, c.y + c.h / 2 - y) < r + 20) this.damageCrate(c, 999);
    if (kind === 'toxic') this.addHazard('toxic', x, y, r * 0.85, 4.5);
  }

  damageBarrel(b, dmg) {
    if (b.hp <= 0) return;
    b.hp -= dmg;
    if (b.hp <= 0) { b.hp = 0; b.fuse = 0.06; }
  }

  stepBarrels(dt) {
    for (const b of this.barrels) {
      if (b.fuse < 0) continue;
      b.fuse -= dt;
      if (b.fuse <= 0) {
        b.fuse = -1; this.destroyed.add(b.id);
        if (b.kind === 'toxic') this.explode(b.x, b.y, 130, 95, 14 * this.diff.zDmg, null, 'toxic');
        else this.explode(b.x, b.y, 150, 170, 34 * this.diff.zDmg, null, 'barrel');
      }
    }
  }

  damageCrate(c, dmg) {
    if (c.hp <= 0) return;
    c.hp -= dmg;
    if (c.hp <= 0) {
      this.destroyed.add(c.id);
      this.ev({ e: 'crate', x: Math.round(c.x + c.w / 2), y: Math.round(c.y + c.h / 2) });
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      const roll = this.rng.next();
      if (roll < 0.12) this.spawnWeaponDrop(cx, cy, 1);
      else { this.spawnPickup(this.rng.weighted([['ammo', 45], ['med', 25], ['armor', 15], ['nade', 15]]), cx, cy); if (this.rng.chance(0.35)) this.spawnPickup('ammo', cx + 18, cy + 10); }
    }
  }

  addHazard(k, x, y, r, dur) {
    this.hazards.push({ id: this.nid++, k, x, y, r, t: dur, dur });
  }

  stepHazards(dt) {
    for (const h of this.hazards) {
      h.t -= dt;
      const dps = h.k === 'acid' ? 16 : h.k === 'toxic' ? 9 : 0;
      for (const p of this.players.values()) {
        if (p.state !== 'ok' || p.dashT > 0) continue;
        if ((p.x - h.x) ** 2 + (p.y - h.y) ** 2 < h.r * h.r) {
          let d = dps * dt * this.diff.zDmg;
          if (p.armor > 0) { const a = Math.min(p.armor, d * 0.6); p.armor -= a; d -= a; }
          p.hp -= d; p.acidT = 0.2;
          if (p.hp <= 0) { p.hp = 0.01; p.hurtT = 0; this.hurtPlayer(p, 1, h.x, h.y); }
        }
      }
      if (h.k === 'toxic') for (const z of this.zombies) {
        if (z.hp > 0 && z.ty !== 'bloater' && (z.x - h.x) ** 2 + (z.y - h.y) ** 2 < h.r * h.r) { z.hp -= 18 * dt; if (z.hp <= 0) this.killZombie(z, 0, null); }
      }
    }
    this.hazards = this.hazards.filter((h) => h.t > 0);
  }

  // ------------------------------------------------------------------ objets
  spawnPickup(k, x, y, extra) {
    const pk = { id: this.nid++, k, x: clamp(x, this.lv.inner.x0 + 20, this.lv.inner.x1 - 20), y: clamp(y, this.lv.inner.y0 + 20, this.lv.inner.y1 - 20), t: 0 };
    if (extra) Object.assign(pk, extra);
    // les objets ne doivent pas tomber dans un obstacle
    const c = { x: pk.x, y: pk.y, r: 14 };
    for (const s of this.lv.solids) pushOutRect(c, s);
    pk.x = c.x; pk.y = c.y;
    this.pickups.push(pk);
    return pk;
  }

  spawnWeaponDrop(x, y, minTier) {
    const pool = WEAPON_IDS.filter((id) => WEAPONS[id].tier >= minTier && WEAPONS[id].tier > 0);
    const w = this.rng.pick(pool.length ? pool : ['smg']);
    return this.spawnPickup('weapon', x, y, { w });
  }

  stepPickups(dt) {
    const keep = [];
    for (const pk of this.pickups) {
      pk.t += dt;
      let taken = false;
      if (pk.k !== 'weapon') {
        for (const p of this.players.values()) {
          if (p.state !== 'ok') continue;
          const reach = lvl(p, 'magnet') ? 150 : 30;
          const d = Math.hypot(p.x - pk.x, p.y - pk.y);
          if (d < reach && d > 26 && this.wants(p, pk.k)) { pk.x += ((p.x - pk.x) / d) * 420 * dt; pk.y += ((p.y - pk.y) / d) * 420 * dt; }
          if (d < 30 && this.take(p, pk)) { taken = true; break; }
        }
      }
      if (!taken && (pk.t < 60 || pk.k === 'weapon')) keep.push(pk);
    }
    this.pickups = keep;
  }

  wants(p, k) {
    if (k === 'med') return p.hp < p.maxHp - 1;
    if (k === 'armor') return p.armor < p.maxArmor - 1;
    if (k === 'nade') return p.grenades < GRENADE.max + lvl(p, 'nade');
    if (k === 'ammo') return p.weapons.some((w) => w.res !== Infinity && w.res < resMax(p, WEAPONS[w.id]));
    return false;
  }

  take(p, pk) {
    if (!this.wants(p, pk.k)) return false;
    if (pk.k === 'med') p.hp = Math.min(p.maxHp, p.hp + 40);
    else if (pk.k === 'armor') p.armor = Math.min(p.maxArmor, p.armor + 35);
    else if (pk.k === 'nade') p.grenades++;
    else if (pk.k === 'ammo') for (const w of p.weapons) { const W = WEAPONS[w.id]; if (w.res !== Infinity) w.res = Math.min(resMax(p, W), w.res + Math.ceil(resMax(p, W) * 0.4)); }
    this.ev({ e: 'pk', p: p.id, k: pk.k, x: Math.round(pk.x), y: Math.round(pk.y) });
    return true;
  }

  tryPickWeapon(p) {
    let best = null, bd = 60 * 60;
    for (const pk of this.pickups) {
      if (pk.k !== 'weapon') continue;
      const d = (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2;
      if (d < bd) { bd = d; best = pk; }
    }
    if (!best) return false;
    const W = WEAPONS[best.w];
    const own = p.weapons.findIndex((w) => w.id === best.w);
    if (own >= 0) {
      const w = p.weapons[own];
      w.res = Math.min(resMax(p, W), w.res + magSize(p, W) * 2); w.mag = magSize(p, W);
    } else if (p.weapons.length < 3) {
      p.weapons.push(mkWeapon(best.w, p)); p.slot = p.weapons.length - 1;
    } else {
      const slot = p.slot === 0 ? 1 : p.slot;
      const old = p.weapons[slot];
      p.weapons[slot] = mkWeapon(best.w, p); p.slot = slot;
      this.spawnPickup('weapon', p.x - Math.cos(p.aim) * 30, p.y - Math.sin(p.aim) * 30, { w: old.id, mag: old.mag, res: old.res });
    }
    if (best.mag != null && own < 0) { const w = p.weapons[p.slot]; w.mag = best.mag; w.res = best.res; }
    p.reloadT = 0;
    this.pickups = this.pickups.filter((q) => q !== best);
    this.ev({ e: 'pkw', p: p.id, w: best.w });
    return true;
  }

  // ------------------------------------------------------------------ améliorations
  offerPerks(p, boost = 0) {
    if (p.offers) { p.picksQueued++; return; }
    const avail = PERK_IDS.filter((id) => lvl(p, id) < PERKS[id].max);
    const weights = avail.map((id) => [id, [60, 28 + boost * 15, 9 + boost * 12][PERKS[id].rar]]);
    const out = [];
    while (out.length < 3 && weights.length) {
      const id = this.rng.weighted(weights);
      out.push(id); weights.splice(weights.findIndex((x) => x[0] === id), 1);
    }
    if (!out.length) return;
    p.offers = out; p.offerT = 1.2 + Math.random() * 1.5; p.offerN = (p.offerN || 0) + 1;
  }

  pickPerk(p, id) {
    if (!p.offers || !p.offers.includes(id)) return;
    this.applyPerk(p, id);
    p.offers = null;
    this.ev({ e: 'perk', p: p.id, k: id });
    if (p.picksQueued > 0) { p.picksQueued--; this.offerPerks(p, 1); }
  }

  applyPerk(p, id) {
    if (!PERKS[id]) return;
    p.perks[id] = lvl(p, id) + 1;
    if (id === 'hp') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); }
    if (id === 'armor') { p.maxArmor += 25; p.armor = p.maxArmor; }
    if (id === 'ammo') for (const w of p.weapons) if (w.res !== Infinity) w.res = resMax(p, WEAPONS[w.id]);
    if (id === 'nade') p.grenades = Math.min(GRENADE.max + lvl(p, 'nade'), p.grenades + 1);
    if (id === 'dash') p.dashCharges = 1 + lvl(p, 'dash');
  }

  // ------------------------------------------------------------------ vagues
  stepWaves(dt) {
    const W = this.wave;
    const nP = Math.max(1, this.players.size);
    const pf = nP === 1 ? 0.85 : 1 + 0.45 * (nP - 1);
    const alive = this.zombies.length + this.pending.length;
    const cap = 22 + 6 * (nP - 1);
    // apparitions en attente (la bouche d'aération s'ouvre d'abord)
    for (const sp of this.pending) sp.t -= dt;
    const ready = this.pending.filter((s) => s.t <= 0);
    if (ready.length) { this.pending = this.pending.filter((s) => s.t > 0); for (const s of ready) this.spawnZombie(s.ty, s.x, s.y, s.elite); }

    if (this.cleared) return;
    if (W.budget > 0) {
      W.spawnT -= dt;
      if (W.spawnT <= 0 && alive < cap) {
        const ty = this.pickZombieType(W.n);
        const cost = COST[ty];
        W.budget -= cost;
        const v = this.pickVent();
        if (v) {
          const count = ty === 'crawler' ? 2 : 1;
          const elite = this.room.index >= 3 && ['walker', 'runner', 'spitter'].includes(ty) && this.rng.chance(0.06);
          for (let k = 0; k < count; k++) this.pending.push({ ty, x: v.sx + (k ? 16 : 0), y: v.sy + (k ? 10 : 0), t: 0.75 + k * 0.25, elite });
          this.ev({ e: 'vent', v: v.id });
        }
        W.spawnT = Math.max(0.28, (0.95 - this.room.index * 0.06) / Math.sqrt(pf)) * (0.6 + this.rng.next() * 0.8);
      }
      return;
    }
    // vague épuisée : attendre que la salle se vide (presque) avant la suivante
    if (W.n < W.total) {
      if (W.n === 0 || alive <= (W.endless ? 0 : 2 + nP)) {
        W.timer -= dt;
        if (W.timer <= 0) this.nextWave(pf);
      }
      return;
    }
    if (alive === 0 && !this.cleared) this.roomCleared();
  }

  nextWave(pf) {
    const W = this.wave;
    W.n++;
    const i = this.room.index;
    const isBoss = this.room.type === 'core';
    if (this.cfg.mode === 'survival') {
      W.budget = (12 + 6 * W.n) * pf * this.diff.budget;
      if (W.n % 5 === 0) for (let k = 0; k < Math.floor(W.n / 5); k++) this.queueSpecial('brute');
      if (W.n % 10 === 0) this.spawnBoss(0.45 + 0.15 * (W.n / 10 - 1));
      this.setToast(`Vague ${W.n}`, 2, 'wave');
    } else if (isBoss) {
      this.spawnBoss(1);
      W.budget = 8 * pf * this.diff.budget;
    } else {
      W.budget = (9 + 5 * i) * (0.8 + 0.25 * W.n) * pf * this.diff.budget;
      if (W.n === W.total && i >= 3) for (let k = 0; k < (i >= 6 && nPlayers(this) >= 3 ? 2 : 1); k++) this.queueSpecial('brute');
      if (this.room.type === 'armory' && W.n === W.total && i < 3) this.queueSpecial('brute');
      this.setToast(W.total > 1 ? `Vague ${W.n} / ${W.total}` : 'Contact !', 2, 'wave');
    }
    W.spawnT = 0.4; W.timer = this.cfg.mode === 'survival' ? 6 : 3.5;
    this.ev({ e: 'wave', n: W.n });
  }

  queueSpecial(ty) {
    const v = this.pickVent(); if (!v) return;
    this.pending.push({ ty, x: v.sx, y: v.sy, t: 1.2 }); this.ev({ e: 'vent', v: v.id, big: 1 });
  }

  pickZombieType(n) {
    const i = this.cfg.mode === 'survival' ? 1 + Math.min(8, Math.floor(this.wave.n / 2)) : this.room.index;
    const ty = this.room.type;
    const w = [
      ['walker', 10],
      ['crawler', (ty === 'storage' ? 8 : 4)],
      ['runner', (i >= 2 ? 5 : 1.2) * (ty === 'medbay' ? 1.7 : 1)],
      ['spitter', (i >= 2 ? 2.5 : 0) * (ty === 'lab' ? 2.2 : 1)],
      ['bloater', (i >= 3 ? 1.6 : 0) * (ty === 'storage' ? 1.6 : 1)],
      ['screamer', i >= 4 ? 0.8 : 0],
      ['brute', i >= 6 ? 0.25 : 0],
    ].filter((x) => x[1] > 0);
    if (this.room.type === 'core') return this.rng.weighted([['runner', 4], ['walker', 4], ['crawler', 3], ['spitter', 1]]);
    return this.rng.weighted(w);
  }

  pickVent() {
    const vents = this.lv.vents;
    const ok = vents.filter((v) => ![...this.players.values()].some((p) => p.state !== 'dead' && Math.hypot(p.x - v.sx, p.y - v.sy) < 270));
    return this.rng.pick(ok.length ? ok : vents);
  }

  spawnZombie(ty, x, y, elite = false) {
    const Z = ZOMBIES[ty];
    const nP = Math.max(1, this.players.size);
    const roomScale = this.cfg.mode === 'survival' ? 1 + this.wave.n * 0.045 : 1 + (this.room.index - 1) * 0.1;
    const hp = Z.hp * this.diff.zHp * roomScale * (1 + 0.12 * (nP - 1)) * (elite ? 2.6 : 1);
    const z = {
      id: this.nid++, ty, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: Z.r * (elite ? 1.18 : 1), hp, maxHp: hp,
      ang: Math.PI / 2, tgt: null, tgtLock: 0, retarget: 0, atkCd: 0.5, atkT: 0, state: 'walk', stT: 0, flash: 0, burnT: 0,
      buffT: 0, elite, spd: Z.speed * (0.88 + Math.random() * 0.24), wob: Math.random() * 10,
      cdA: 2 + Math.random() * 2, cdB: 4 + Math.random() * 3, cdC: 6, lockA: 0, phase: 1, los: false, losT: Math.random() * 0.3,
    };
    this.zombies.push(z);
    return z;
  }

  spawnBoss(scale) {
    const z = this.spawnZombie('boss', this.lv.w / 2, this.lv.inner.y0 + 160);
    z.hp *= scale; z.maxHp = z.hp; z.cdA = 4; z.cdB = 6; z.cdC = 9;
    this.ev({ e: 'boss' });
  }

  roomCleared() {
    this.cleared = true; this.roomsCleared++;
    const bonus = 400 * this.room.index;
    this.score += bonus;
    const ty = this.room.type;
    if (this.cfg.mode === 'campaign' && (ty === 'core' || this.room.index >= CAMPAIGN_ROOMS)) {
      this.phase = 'won'; this.endT = 0; this.ev({ e: 'won' }); return;
    }
    this.doorsOpen = this.lv.doors.some((d) => d.kind === 'exit');
    this.ev({ e: 'clear', b: bonus });
    this.setToast('Zone sécurisée — choisissez une porte', 3.2, 'good');
    const cx = this.lv.w / 2, cy = (this.lv.inner.y0 + this.lv.inner.y1) / 2;
    for (const p of this.players.values()) {
      if (p.state === 'down') { /* on peut encore le relever ; sinon il se relève à la salle suivante */ }
      this.offerPerks(p, ty === 'lab' ? 1 : 0);
      if (ty === 'lab') p.picksQueued++;
      if (ty === 'medbay' && p.state === 'ok') { p.hp = Math.min(p.maxHp, p.hp + 50); p.armor = Math.min(p.maxArmor, p.armor + 40); }
      if (ty === 'storage') p.grenades = GRENADE.max + lvl(p, 'nade');
    }
    if (ty === 'armory') { this.spawnWeaponDrop(cx - 60, cy, 2); this.spawnWeaponDrop(cx + 60, cy, 2); this.spawnPickup('ammo', cx, cy + 50); }
    else if (ty === 'medbay') { this.spawnPickup('med', cx - 40, cy); this.spawnPickup('med', cx + 40, cy); this.spawnPickup('armor', cx, cy + 40); }
    else if (ty === 'storage') { for (let k = 0; k < 3; k++) this.spawnPickup('ammo', cx - 60 + k * 60, cy); this.spawnPickup('armor', cx, cy + 50); }
    else this.spawnPickup('ammo', cx, cy);
  }

  // mode Survie : fin de vague = petite pause, objets, et améliorations une vague sur deux
  survivalBreak() {
    const W = this.wave;
    if (W.budget > 0 || this.zombies.length + this.pending.length > 0 || W.n === 0 || W.rewarded === W.n) return;
    W.rewarded = W.n;
    this.roomsCleared = W.n;
    const cx = this.lv.w / 2, cy = (this.lv.inner.y0 + this.lv.inner.y1) / 2;
    this.spawnPickup('ammo', cx - 40, cy); this.spawnPickup(this.rng.pick(['med', 'armor', 'nade']), cx + 40, cy);
    if (W.n % 3 === 0) this.spawnWeaponDrop(cx, cy - 60, W.n >= 6 ? 2 : 1);
    for (const p of this.players.values()) {
      if (p.state === 'dead') { p.state = 'ok'; p.hp = Math.round(p.maxHp * 0.5); p.x = this.lv.spawn.x; p.y = this.lv.spawn.y; this.ev({ e: 'respawn', p: p.id }); }
      if (W.n % 2 === 0) this.offerPerks(p);
    }
    this.setToast(`Vague ${W.n} repoussée`, 2.4, 'good');
    this.score += 300 * W.n;
  }

  // ------------------------------------------------------------------ portes
  stepRally(dt) {
    if (this.cfg.mode === 'survival') { this.survivalBreak(); return; }
    if (!this.doorsOpen) return;
    const st = this.standing();
    if (!st.length) return;
    const zoneOf = (p) => this.lv.doors.find((d) => d.kind === 'exit' && p.x > d.x - 10 && p.x < d.x + d.w + 10 && p.y < WALL_TOP + 80);
    const counts = new Map();
    for (const p of st) { const d = zoneOf(p); if (d) counts.set(d, (counts.get(d) || 0) + 1); }
    if (!counts.size) { if (this.rally) this.rally = null; return; }
    let door = null, best = 0;
    for (const [d, c] of counts) if (c > best) { best = c; door = d; }
    if (!this.rally || this.rally.door !== door.id) this.rally = { door: door.id, t: 6, to: door.to };
    const all = best >= st.length;
    this.rally.t -= dt * (all ? 5 : 1);
    this.rally.all = all;
    if (this.rally.t <= 0) {
      const to = door.to;
      // les améliorations non choisies sont tirées au hasard
      this.startRoom(to, this.room.index + 1);
      this.ev({ e: 'door' });
    }
  }

  checkWipe() {
    if (this.phase !== 'play' || !this.players.size) return;
    const any = [...this.players.values()].some((p) => p.state === 'ok' || (p.state === 'down' && p.adrenaline > 0));
    if (!any) { this.phase = 'over'; this.endT = 0; this.ev({ e: 'over' }); this.setToast('Escouade décimée', 4, 'bad'); }
  }

  // ------------------------------------------------------------------ zombies
  updateField(dt) {
    this.fieldT -= dt;
    if (this.fieldT > 0 && this.field) return;
    this.fieldT = 0.3;
    const st = this.standing();
    const src = st.length ? st : [...this.players.values()].filter((p) => p.state === 'down');
    this.field = src.length ? distanceField(this.lv, src) : null;
  }

  stepZombies(dt) {
    const Zs = this.zombies;
    const plist = [...this.players.values()];
    const targets = plist.filter((p) => p.state === 'ok');
    // grille spatiale pour la séparation
    const G = 56, grid = new Map();
    for (const z of Zs) { const k = ((z.x / G) | 0) * 4096 + ((z.y / G) | 0); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(z); }

    for (const z of Zs) {
      if (z.hp <= 0) continue;
      const Z = ZOMBIES[z.ty];
      z.flash = Math.max(0, z.flash - dt);
      if (z.burnT > 0) {
        z.burnT -= dt;
        z.hp -= 13 * dt * (z.ty === 'boss' ? 0.5 : 1);
        if (z.hp <= 0) { this.killZombie(z, 0, this.players.get(z.burnBy)); continue; }
      }
      if (z.buffT > 0) z.buffT -= dt;
      if (z.tgtLock > 0) z.tgtLock -= dt;
      z.atkCd -= dt; z.cdA -= dt; z.cdB -= dt; z.cdC -= dt;

      // cible
      z.retarget -= dt;
      let T = this.players.get(z.tgt);
      if (!T || T.state !== 'ok' || (z.retarget <= 0 && z.tgtLock <= 0)) {
        z.retarget = 0.6 + Math.random() * 0.3;
        let best = null, bd = Infinity;
        for (const p of targets) { const d = (p.x - z.x) ** 2 + (p.y - z.y) ** 2; if (d < bd) { bd = d; best = p; } }
        z.tgt = best ? best.id : null; T = best;
      }
      const dx = T ? T.x - z.x : 0, dy = T ? T.y - z.y : 0, dist = Math.hypot(dx, dy) || 1;
      z.losT -= dt;
      if (z.losT <= 0 && T) { z.losT = 0.25; z.los = !raycastSolids(this.blockers, z.x, z.y, T.x, T.y); z.walkLos = z.los && !this.solidsNow.some((s) => s.low && segRect(z.x, z.y, dx, dy, s, z.r * 0.8)); }

      let speed = z.spd * (z.buffT > 0 ? 1.45 : 1);
      let want = null; // direction souhaitée {x,y}
      const chase = () => {
        if (!T) return null;
        if (z.walkLos && dist < 520) return { x: dx / dist, y: dy / dist };
        const f = this.field && flowDir(this.lv, this.field, z.x, z.y);
        return f || { x: dx / dist, y: dy / dist };
      };

      switch (z.ty) {
        case 'spitter':
          if (z.state === 'windup') {
            speed = 0; z.stT -= dt;
            if (z.stT <= 0) {
              z.state = 'walk'; z.cdA = ZOMBIES.spitter.cd * (0.8 + Math.random() * 0.4);
              if (T) this.spit(z, T, 1);
            }
          } else if (T && z.los && dist < Z.range && dist > 140 && z.cdA <= 0) { z.state = 'windup'; z.stT = 0.55; }
          else if (T && z.los && dist < 260) want = { x: -dx / dist, y: -dy / dist };
          else if (T && z.los && dist < Z.range - 40) { want = { x: -dy / dist, y: dx / dist }; speed *= 0.5; }
          else want = chase();
          break;
        case 'screamer':
          if (z.state === 'windup') {
            speed = 0; z.stT -= dt;
            if (z.stT <= 0) { z.state = 'walk'; z.cdA = 7.5; this.scream(z); }
          } else if (T && dist < 480 && z.cdA <= 0) { z.state = 'windup'; z.stT = 0.85; }
          else if (T && dist < 300) want = { x: -dx / dist, y: -dy / dist };
          else want = chase();
          break;
        case 'bloater':
          if (z.state === 'fuse') {
            speed *= 0.4; z.stT -= dt; want = chase();
            if (z.stT <= 0) { this.killZombie(z, 0, null); continue; }
          } else { want = chase(); if (T && dist < 72 + T.r) { z.state = 'fuse'; z.stT = 0.75; this.ev({ e: 'fuse', x: Math.round(z.x), y: Math.round(z.y) }); } }
          break;
        case 'brute':
        case 'boss':
          if (this.bigAI(z, T, dt, dist, dx, dy)) { speed = z.curSpeed; want = z.curWant; }
          else want = chase();
          if (z.ty === 'boss') speed *= z.phase === 3 ? 1.3 : 1;
          break;
        case 'runner':
          want = chase(); if (T && dist < 160) speed *= 1.35;
          break;
        default:
          want = chase();
      }

      // attaque au contact
      if (T && z.state === 'walk' && (z.ty !== 'bloater')) {
        const reach = z.r + T.r + (z.ty === 'boss' ? 30 : 8);
        if (z.atkT > 0) {
          z.atkT -= dt; speed *= 0.35;
          if (z.atkT <= 0) {
            z.atkCd = Z.cd;
            if (dist < reach + 16) this.hurtPlayer(T, Z.dmg * this.diff.zDmg * (z.elite ? 1.4 : 1), z.x, z.y, z.ty === 'boss' ? 420 : z.ty === 'brute' ? 300 : 90);
            this.ev({ e: 'zs', z: z.id });
          }
        } else if (dist < reach && z.atkCd <= 0) { z.atkT = z.ty === 'boss' ? 0.45 : 0.28; }
      }

      // mouvement
      if (z.state === 'charge') { /* vitesse gérée par bigAI */ }
      const wob = z.ty === 'walker' || z.ty === 'crawler' ? Math.sin(this.t * 2.6 + z.wob) * 0.45 : 0;
      if (want) {
        const a = Math.atan2(want.y, want.x) + wob;
        const tvx = Math.cos(a) * speed, tvy = Math.sin(a) * speed;
        const k = Math.min(1, dt * (z.ty === 'runner' ? 7 : 4.5));
        z.vx += (tvx - z.vx) * k; z.vy += (tvy - z.vy) * k;
      } else { z.vx *= 0.85; z.vy *= 0.85; }
      if (T && z.state !== 'charge') z.ang += angDiff(z.ang, Math.atan2(dy, dx)) * Math.min(1, dt * 8);
      else if (z.state === 'charge') z.ang = z.lockA;

      z.x += (z.vx + z.kx) * dt; z.y += (z.vy + z.ky) * dt;
      const kd = Math.pow(0.001, dt); z.kx *= kd; z.ky *= kd;

      // séparation entre zombies
      const gx = (z.x / G) | 0, gy = (z.y / G) | 0;
      for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iy = gy - 1; iy <= gy + 1; iy++) {
        const cell = grid.get(ix * 4096 + iy); if (!cell) continue;
        for (const o of cell) {
          if (o === z || o.hp <= 0) continue;
          const ox = z.x - o.x, oy = z.y - o.y, m = z.r + o.r - 2, d2 = ox * ox + oy * oy;
          if (d2 < m * m && d2 > 0.01) {
            const d = Math.sqrt(d2), push = (m - d) * 0.5;
            const wz = o.r / (z.r + o.r);
            z.x += (ox / d) * push * wz * 2 * 0.5; z.y += (oy / d) * push * wz * 2 * 0.5;
          }
        }
      }
      // corps à corps avec les joueurs
      for (const p of plist) {
        if (p.state === 'dead') continue;
        const ox = p.x - z.x, oy = p.y - z.y, m = z.r + p.r - 4, d2 = ox * ox + oy * oy;
        if (d2 < m * m && d2 > 0.01) {
          const d = Math.sqrt(d2), over = m - d;
          const heavy = z.ty === 'brute' || z.ty === 'boss';
          const pz = heavy ? 0.1 : p.dashT > 0 ? 0.9 : 0.72;
          z.x -= (ox / d) * over * pz; z.y -= (oy / d) * over * pz;
          if (p.dashT <= 0) { p.x += (ox / d) * over * (1 - pz); p.y += (oy / d) * over * (1 - pz); }
        }
      }
      this.collideBody(z);
      if (z.state === 'charge' && z.hitWall) { z.hitWall = false; }
    }
    this.zombies = Zs.filter((z) => z.hp > 0);
  }

  // Brute et boss : charge, onde de choc, salves d'acide, invocation. Renvoie true si l'IA contrôle le mouvement.
  bigAI(z, T, dt, dist, dx, dy) {
    const boss = z.ty === 'boss';
    if (boss) {
      const f = z.hp / z.maxHp;
      const ph = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
      if (ph !== z.phase) { z.phase = ph; this.ev({ e: 'phase', n: ph }); this.setToast(ph === 2 ? 'Le Spécimen mute !' : 'Le Spécimen est enragé !', 2.2, 'bad'); z.cdC = 1; }
    }
    const cdm = boss && z.phase === 3 ? 0.65 : 1;
    switch (z.state) {
      case 'tele': // préparation de charge (ligne rouge)
        z.stT -= dt; z.curSpeed = 0; z.curWant = null;
        if (T) z.lockA += angDiff(z.lockA, Math.atan2(dy, dx)) * Math.min(1, dt * (z.stT > 0.3 ? 6 : 0.5));
        if (z.stT <= 0) { z.state = 'charge'; z.stT = boss ? 1.0 : 0.95; z.hitSet = new Set(); this.ev({ e: 'charge', x: Math.round(z.x), y: Math.round(z.y) }); }
        return true;
      case 'charge': {
        z.stT -= dt;
        const sp = ZOMBIES.brute.charge * (boss ? 1.15 : 1);
        z.vx = Math.cos(z.lockA) * sp; z.vy = Math.sin(z.lockA) * sp;
        z.curSpeed = sp; z.curWant = { x: Math.cos(z.lockA), y: Math.sin(z.lockA) };
        for (const p of this.players.values()) {
          if (p.state !== 'ok' || z.hitSet.has(p.id)) continue;
          if (Math.hypot(p.x - z.x, p.y - z.y) < z.r + p.r + 6) { z.hitSet.add(p.id); this.hurtPlayer(p, 34 * this.diff.zDmg, z.x, z.y, 620); }
        }
        // mur percuté → étourdi
        const ahead = { x: z.x + Math.cos(z.lockA) * (z.r + 6), y: z.y + Math.sin(z.lockA) * (z.r + 6), r: 4 };
        const I = this.lv.inner;
        const wallHit = ahead.x < I.x0 || ahead.x > I.x1 || ahead.y < I.y0 || ahead.y > I.y1 || this.blockers.some((s) => ahead.x > s.x && ahead.x < s.x + s.w && ahead.y > s.y && ahead.y < s.y + s.h);
        if (wallHit) { z.state = 'stun'; z.stT = boss ? 1.1 : 1.6; z.vx = z.vy = 0; this.ev({ e: 'slam', x: Math.round(z.x), y: Math.round(z.y), r: 60 }); return true; }
        if (z.stT <= 0) { z.state = 'walk'; z.cdA = (boss ? 5 : 5.5) * cdm; }
        return true;
      }
      case 'stun':
        z.stT -= dt; z.curSpeed = 0; z.curWant = null; z.vx *= 0.8; z.vy *= 0.8;
        if (z.stT <= 0) { z.state = 'walk'; z.cdA = 4.5 * cdm; }
        return true;
      case 'slamwind': // boss : onde de choc
        z.stT -= dt; z.curSpeed = 0; z.curWant = null;
        if (z.stT <= 0) {
          z.state = 'walk'; z.cdB = 6.5 * cdm;
          const R = 230;
          this.ev({ e: 'slam', x: Math.round(z.x), y: Math.round(z.y), r: R });
          for (const p of this.players.values()) if (p.state === 'ok' && Math.hypot(p.x - z.x, p.y - z.y) < R) this.hurtPlayer(p, 28 * this.diff.zDmg, z.x, z.y, 520);
          if (z.phase === 3) this.addHazard('acid', z.x, z.y, 120, 4);
        }
        return true;
    }
    if (!T) return false;
    // déclencheurs
    if (z.cdA <= 0 && z.los && dist > 170 && dist < 560 && (!boss || z.phase >= 2)) { z.state = 'tele'; z.stT = boss ? 0.75 : 0.85; z.lockA = Math.atan2(dy, dx); this.ev({ e: 'roar', x: Math.round(z.x), y: Math.round(z.y) }); return true; }
    if (boss) {
      if (z.cdB <= 0 && dist < 260) { z.state = 'slamwind'; z.stT = 0.95; this.ev({ e: 'roar', x: Math.round(z.x), y: Math.round(z.y) }); return true; }
      if (z.cdC <= 0) {
        z.cdC = (z.phase === 1 ? 7 : 8) * cdm;
        if (z.phase >= 2 && Math.random() < 0.5) { for (let k = 0; k < 2 + z.phase; k++) this.queueSpecial(k % 2 ? 'runner' : 'crawler'); this.ev({ e: 'roar', x: Math.round(z.x), y: Math.round(z.y) }); }
        else for (const p of this.standing()) this.spit(z, p, z.phase === 3 ? 5 : 3);
      }
      if (z.phase === 3 && Math.random() < dt * 0.8) this.addHazard('acid', z.x, z.y, 55, 3.5);
    }
    return false;
  }

  spit(z, T, n) {
    for (let k = 0; k < n; k++) {
      const lead = 0.5;
      const tx = T.x + T.vx * lead + (n > 1 ? (k - (n - 1) / 2) * 70 : 0) + (Math.random() - 0.5) * 30;
      const ty = T.y + T.vy * lead + (Math.random() - 0.5) * 30;
      const d = Math.hypot(tx - z.x, ty - z.y), dur = clamp(d / 420, 0.45, 1.3);
      this.eprojs.push({ id: this.nid++, k: 'acid', x: z.x, y: z.y, sx: z.x, sy: z.y, tx, ty, t: 0, dur, big: z.ty === 'boss' });
    }
    this.ev({ e: 'spit', x: Math.round(z.x), y: Math.round(z.y) });
  }

  scream(z) {
    this.ev({ e: 'scream', x: Math.round(z.x), y: Math.round(z.y) });
    for (const o of this.zombies) if (o !== z && Math.hypot(o.x - z.x, o.y - z.y) < 460) o.buffT = 5;
    const n = this.zombies.length + this.pending.length;
    if (n < 40) for (let k = 0; k < 2; k++) this.pending.push({ ty: 'crawler', x: z.x + (Math.random() - 0.5) * 60, y: z.y + (Math.random() - 0.5) * 60, t: 0.3 + k * 0.2 });
  }

  stepEnemyProjectiles(dt) {
    const keep = [];
    for (const e of this.eprojs) {
      e.t += dt;
      if (e.k === 'acid') {
        const f = Math.min(1, e.t / e.dur);
        e.x = e.sx + (e.tx - e.sx) * f; e.y = e.sy + (e.ty - e.sy) * f; e.h = Math.sin(f * Math.PI) * 90;
        if (f >= 1) {
          this.addHazard('acid', e.tx, e.ty, e.big ? 80 : 58, e.big ? 5 : 4.5);
          for (const p of this.players.values()) if (p.state === 'ok' && Math.hypot(p.x - e.tx, p.y - e.ty) < (e.big ? 70 : 50)) this.hurtPlayer(p, (e.big ? 18 : 12) * this.diff.zDmg, e.tx, e.ty, 60);
          this.ev({ e: 'splash', x: Math.round(e.tx), y: Math.round(e.ty) });
          continue;
        }
      } else if (e.k === 'nade') {
        const k = Math.pow(0.12, dt);
        e.vx *= k; e.vy *= k;
        const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
        const hit = raycastSolids(this.solidsNow, e.x, e.y, nx, ny, 5);
        if (hit && !hit.inside) { if (hit.nx) e.vx = -e.vx * 0.55; if (hit.ny) e.vy = -e.vy * 0.55; e.x += e.vx * dt * hit.t; e.y += e.vy * dt * hit.t; }
        else { e.x = nx; e.y = ny; }
        e.h = Math.max(0, Math.sin(Math.min(1, e.t / 0.7) * Math.PI) * 50);
        if (e.t >= e.fuse) {
          const by = this.players.get(e.owner);
          this.explode(e.x, e.y, GRENADE.radius * (1 + 0.3 * lvl(by, 'nade')), GRENADE.dmg * (by ? this.dmgMult(by) : 1), 0, by, 'nade');
          continue;
        }
      }
      keep.push(e);
    }
    this.eprojs = keep;
  }

  ev(o) { this.events.push(o); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ------------------------------------------------------------------ réseau : état diffusé aux invités
  snapshot() {
    const r1 = (v) => Math.round(v), r2 = (v) => Math.round(v * 100) / 100;
    const P = [];
    for (const p of this.players.values()) {
      P.push({
        i: p.id, n: p.name, c: p.color, b: p.bot ? 1 : 0, x: r1(p.x), y: r1(p.y), vx: r1(p.vx), vy: r1(p.vy), a: r2(p.aim),
        h: Math.ceil(p.hp), H: p.maxHp, r: Math.ceil(p.armor), R: p.maxArmor, s: p.state === 'ok' ? 0 : p.state === 'down' ? 1 : 2,
        bl: r1(p.bleed), rv: r2(p.reviveP), rg: p.reviving, d: p.dashT > 0 ? 1 : 0, dc: p.dashCharges, dm: 1 + lvl(p, 'dash'), dcd: r2(p.dashCd),
        w: p.weapons.map((w) => [WEAPON_IDS.indexOf(w.id), w.mag, w.res === Infinity ? -1 : w.res]), sl: p.slot,
        rl: p.reloadT > 0 ? r2(1 - p.reloadT / (p.reloadDur || 1)) : 0, sp: r2(p.spin), g: p.grenades, gm: GRENADE.max + lvl(p, 'nade'),
        pk: p.perks, of: p.offers, on: p.offerN || 0, ht: p.hurtT > 0 ? 1 : 0, q: p.seq, ad: p.adrenaline,
        st: [p.stats.kills, p.stats.score, p.stats.revives, p.stats.downs, r1(p.stats.dmg)],
      });
    }
    const Z = this.zombies.filter((z) => z.hp > 0).map((z) => {
      let fl = 0;
      if (z.atkT > 0) fl |= 1; if (z.burnT > 0) fl |= 2;
      if (z.state === 'tele' || z.state === 'windup' || z.state === 'fuse' || z.state === 'slamwind') fl |= 4;
      if (z.state === 'tele') fl |= 256; if (z.state === 'slamwind') fl |= 512; if (z.state === 'fuse') fl |= 1024;
      if (z.elite) fl |= 8; if (z.buffT > 0) fl |= 16; if (z.state === 'stun') fl |= 32; if (z.state === 'charge') fl |= 64;
      if (z.flash > 0) fl |= 128;
      return [z.id, ZOMBIE_IDS.indexOf(z.ty), r1(z.x), r1(z.y), r2(z.ang), Math.max(0, Math.round((z.hp / z.maxHp) * 1000)), fl, r2(z.lockA), z.phase, r1(z.vx), r1(z.vy)];
    });
    const O = this.eprojs.map((e) => [e.id, e.k === 'acid' ? 0 : 1, r1(e.x), r1(e.y), r1(e.h || 0), e.big ? 1 : 0, r1(e.tx ?? e.x), r1(e.ty ?? e.y), r2(e.k === 'acid' ? e.t / e.dur : e.t / e.fuse)]);
    const K = this.pickups.map((k) => [k.id, k.k, r1(k.x), r1(k.y), k.w || 0]);
    const A = this.hazards.map((h) => [h.id, h.k, r1(h.x), r1(h.y), r1(h.r), r2(h.t / h.dur)]);
    const W = this.wave;
    const boss = this.zombies.find((z) => z.ty === 'boss');
    return {
      ph: this.phase, t: r2(this.t), rm: { i: this.room.index, ty: this.room.type, sd: this.room.seed, ex: this.room.exits, mode: this.cfg.mode },
      P, Z, O, K, A, D: [...this.destroyed], op: this.doorsOpen ? 1 : 0, cl: this.cleared ? 1 : 0,
      rl: this.rally ? { d: this.rally.door, t: r2(this.rally.t), a: this.rally.all ? 1 : 0 } : null,
      wv: { n: W.n, tot: W.total === Infinity ? -1 : W.total, left: this.zombies.length + this.pending.length + Math.ceil(Math.max(0, W.budget)) },
      sc: this.score, k: this.kills, rc: this.roomsCleared, ts: this.toast && this.toast.until > this.t ? this.toast : null,
      bs: boss ? Math.round((boss.hp / boss.maxHp) * 1000) : -1, cfg: { d: this.cfg.difficulty, sw: this.cfg.startWeapon, seed: this.cfg.seed },
    };
  }

  // Nouvel hôte : reprendre la partie à partir du dernier état reçu (la salle en cours redémarre proprement)
  static restore(snap, cfg) {
    const sim = new Sim({ mode: snap.rm.mode, difficulty: snap.cfg.d, startWeapon: snap.cfg.sw, seed: snap.cfg.seed, ...cfg });
    sim.score = snap.sc; sim.kills = snap.k; sim.roomsCleared = snap.rc;
    for (const q of snap.P) {
      const p = sim.addPlayer({ id: q.i, name: q.n, color: q.c, bot: !!q.b });
      p.maxHp = q.H; p.hp = Math.max(1, q.h); p.maxArmor = q.R; p.armor = q.r; p.state = q.s === 0 ? 'ok' : q.s === 1 ? 'down' : 'dead';
      if (p.state === 'down') { p.state = 'ok'; p.hp = 30; }
      p.weapons = q.w.map(([wi, mag, res]) => ({ id: WEAPON_IDS[wi], mag, res: res < 0 ? Infinity : res }));
      p.slot = Math.min(q.sl, p.weapons.length - 1); p.grenades = q.g; p.perks = { ...(q.pk || {}) };
      p.stats = { kills: q.st[0], score: q.st[1], revives: q.st[2], downs: q.st[3], dmg: q.st[4] };
      p.adrenaline = q.ad ?? p.adrenaline;
    }
    sim.startRoom(snap.rm.ty, snap.rm.i);
    if (snap.rm.mode === 'survival') { sim.wave.n = Math.max(0, snap.wv.n - 1); sim.wave.rewarded = sim.wave.n; }
    return sim;
  }
}

// ------------------------------------------------------------------ utilitaires
function blankInput() { return { mx: 0, my: 0, a: -Math.PI / 2, fire: false, dash: 0, reload: 0, sw: 0, sl: 0, nade: 0, td: 300, use: false, pk: 0, pi: -1, q: 0 }; }
export function lvl(p, id) { return (p && p.perks && p.perks[id]) || 0; }
export function magSize(p, W) { return Math.round(W.mag * (1 + 0.35 * lvl(p, 'mag'))); }
export function resMax(p, W) { return W.resMax === Infinity ? Infinity : Math.round(W.resMax * (1 + 0.5 * lvl(p, 'ammo'))); }
function mkWeapon(id, p) { const W = WEAPONS[id]; return { id, mag: p ? magSize(p, W) : W.mag, res: W.res }; }
function nPlayers(sim) { return sim.players.size; }
function botPerkChoice(p) {
  const pref = ['dmg', 'rate', 'hp', 'vamp', 'crit', 'pierce', 'medic', 'regen', 'second', 'armor', 'reload', 'mag'];
  for (const id of pref) if (p.offers.includes(id)) return id;
  return p.offers[0];
}
export { blankInput };
