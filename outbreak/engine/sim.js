// Simulation d'Outbreak. Tourne chez l'hôte (ou en solo) à pas fixe ; les invités ne font qu'afficher ce qu'elle diffuse.
// Aucun DOM, aucun réseau : testable sous Node (tools/test-outbreak.mjs).
import { WEAPONS, ZOMBIES, PERKS, PERK_IDS, ROOM_TYPES, BRANCH_TYPES, CAMPAIGN_ROOMS, DIFFICULTY, GRENADE, WEAPON_IDS, ZOMBIE_IDS, CLASSES, CLASS_IDS, FINAL_BOSSES, MINI_BOSSES, isBig, SPECIAL_TYPES, SHOP_ITEMS, SECTORS, SECTOR_LIST, roomName, TRAPS, TRAP_IDS, DEFENSE_WAVES } from './data.js';
import { generateRoom, distanceField, flowDir, WALL_TOP, DOOR_W } from './level.js';
import { pushOutRect, segRect, segCircle, raycastSolids, clamp, angDiff } from './geom.js';
import { makeRng } from './rng.js';

const MAX_PAD_TURRETS = 2;
import { NOTES } from './story.js';

export const DT = 1 / 60;
const PLAYER_R = 17;
const BASE_SPEED = 232;
const REVIVE_TIME = 3;
const DASH_SPEED = 680, DASH_TIME = 0.2, DASH_CD = 1.5;

const BIGW = 1;
const COST = { walker: 1, crawler: 0.7, runner: 1.4, spitter: 2.6, bloater: 3, screamer: 4.5, brute: 10, armored: 4, stalker: 6, larva: 2.4 };

export class Sim {
  constructor(cfg = {}) {
    this.cfg = {
      mode: cfg.mode === 'survival' || cfg.mode === 'defense' ? cfg.mode : 'campaign',
      difficulty: DIFFICULTY[cfg.difficulty] ? cfg.difficulty : 'normal',
      startWeapon: WEAPONS[cfg.startWeapon] ? cfg.startWeapon : 'pistol',
      seed: cfg.seed || ((Math.random() * 2 ** 31) | 0),
      sector: cfg.sector,
    };
    if (!SECTORS[this.cfg.sector]) this.cfg.sector = SECTOR_LIST[((this.cfg.seed >>> 7) % SECTOR_LIST.length + SECTOR_LIST.length) % SECTOR_LIST.length];
    this.diff = DIFFICULTY[this.cfg.difficulty];
    this.rng = makeRng(this.cfg.seed ^ 0x5eed);
    this.t = 0; this.tick = 0;
    this.phase = 'play'; // 'play' | 'over' | 'won'
    this.players = new Map();
    this.zombies = []; this.projs = []; this.eprojs = []; this.pickups = []; this.hazards = []; this.pending = []; this.turrets = [];
    this.destroyed = new Set();
    this.events = [];
    this.nid = 1;
    this.score = 0; this.kills = 0; this.roomsCleared = 0; this.scrap = 0;
    this.bossKind = FINAL_BOSSES[((this.cfg.seed >>> 3) % FINAL_BOSSES.length + FINAL_BOSSES.length) % FINAL_BOSSES.length];
    this.miniKind = MINI_BOSSES[((this.cfg.seed >>> 5) % 2 + 2) % 2];
    this.shop = []; this.vault = null; this.evt = null; this.evtAt = -1; this.dark = false;
    this.intro = 0; this.notesFound = [];
    this.endT = 0;
    this.rally = null;
    this.field = null; this.fieldT = 0;
    this.toast = null;
    if (this.cfg.mode === 'survival') this.startRoom('arena', 1);
    else if (this.cfg.mode === 'defense') this.startRoom('base', 1);
    else this.startRoom('start', 1);
  }

  // ------------------------------------------------------------------ joueurs
  addPlayer({ id, name, color, bot = false, cls = 'soldier' }) {
    if (this.players.has(id)) return this.players.get(id);
    if (!CLASSES[cls]) cls = 'soldier';
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
      input: blankInput(), last: { dash: 0, reload: 0, sw: 0, nade: 0, pk: 0, use: false, ab: 0 },
      stats: { kills: 0, score: 0, revives: 0, downs: 0, dmg: 0 },
      seq: 0, emote: null,
      cls, abCd: 4, abT: 0, pinnedBy: null,
    };
    if (cls === 'tank') { p.maxHp = p.hp = 150; p.maxArmor = 75; p.armor = 40; }
    if (cls === 'scout') p.dashCharges = 2;
    if (cls === 'soldier') p.grenades = 3;
    this.players.set(id, p);
    this.collideBody(p);
    return p;
  }

  removePlayer(id) { this.players.delete(id); }

  setInput(id, inp) {
    const p = this.players.get(id); if (!p || !inp) return;
    // première commande reçue : caler les compteurs (une nouvelle partie ne doit pas rejouer d'anciennes actions)
    if (!p.inputSynced) { p.inputSynced = true; p.last = { dash: inp.dash, reload: inp.reload, sw: inp.sw, nade: inp.nade, pk: inp.pk, use: !!inp.use, ab: inp.ab | 0 }; }
    p.input = inp;
    if (Number.isFinite(inp.q)) p.seq = inp.q;
  }

  inZone(e, k) { for (const z of this.lv.zones) if (z.k === k && e.x > z.x && e.x < z.x + z.w && e.y > z.y && e.y < z.y + z.h) return z; return null; }

  standing() { return [...this.players.values()].filter((p) => p.state === 'ok'); }

  // ------------------------------------------------------------------ salles
  startRoom(type, index) {
    const seed = (this.cfg.seed + index * 1013 + type.length * 71) | 0;
    let exits = [];
    if (this.cfg.mode === 'campaign') {
      if (index >= CAMPAIGN_ROOMS) exits = [];
      else if (index === CAMPAIGN_ROOMS - 1) exits = ['core'];
      else exits = this.pickExits(index + 1, makeRng(seed ^ 0xd00d));
    }
    this.room = { type, index, seed, exits };
    this.lv = generateRoom({ mode: this.cfg.mode, index, type, seed, exits, sector: this.cfg.sector });
    this.cars = new Set(); this.train = this.lv.zones.some((z) => z.k === 'track') ? { t: 12 + this.rng.range(0, 6), st: 'idle', x: 0, dir: this.rng.chance(0.5) ? 1 : -1 } : null;
    this.zombies = []; this.projs = []; this.eprojs = []; this.hazards = []; this.pending = []; this.turrets = [];
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
    this.wave = { n: 0, total: n, budget: 0, timer: 2.2, spawnT: 0, breather: 0, endless: this.cfg.mode !== 'campaign' };
    if (this.cfg.mode === 'survival') { this.wave.total = Infinity; this.wave.timer = 3; }
    this.base = null;
    if (this.cfg.mode === 'defense') {
      this.wave.total = DEFENSE_WAVES; this.wave.timer = 30;
      const B = this.lv.base, g = B.gen;
      this.base = {
        gen: { x: g.x, y: g.y, r: g.r, hp: 2000, max: 2000, isGen: true, id: 'gen', state: 'ok', vx: 0, vy: 0 },
        bars: B.bars.map((b) => ({ ...b, hp: 450, max: 450 })),
        pads: B.pads.map((q) => ({ ...q, trap: null })),
        field: distanceField(this.lv, [{ x: g.x, y: g.y - 80 }, { x: g.x, y: g.y + 80 }, { x: g.x - 80, y: g.y }, { x: g.x + 80, y: g.y }]),
      };
      this.scrap += 20;
    }
    // butin de départ
    if (type === 'start') {
      this.spawnPickup('ammo', this.lv.spawn.x - 120, this.lv.spawn.y - 140);
      this.spawnPickup('nade', this.lv.spawn.x + 120, this.lv.spawn.y - 140);
    }
    // salles spéciales
    this.shop = []; this.vault = null; this.evt = null; this.dark = type === 'dark';
    const I = this.lv.inner, cx = this.lv.w / 2;
    if (type === 'shop') {
      this.cleared = true; this.doorsOpen = true; this.wave.total = 0;
      const st = this.lv.solids.find((q) => q.kind === 'stall');
      this.openShop(cx, st ? st.y + st.h + 46 : I.y0 + 260, makeRng(seed ^ 0x5409));
    } else if (type === 'vault') {
      this.cleared = true; this.doorsOpen = true; this.wave.total = 0;
      const vd = this.lv.solids.find((q) => q.kind === 'vault');
      this.vault = { x: cx, y: vd ? vd.y + vd.h + 30 : I.y0 + 170, st: 'closed', prog: 0 };
    } else if (type === 'gas') {
      const r = makeRng(seed ^ 0x6a5);
      for (let k = 0; k < 2 + Math.min(3, Math.floor(index / 2)); k++) {
        this.addHazard('gas', r.range(I.x0 + 200, I.x1 - 200), r.range(I.y0 + 150, I.y1 - 320), r.range(110, 150), 9999);
        const h = this.hazards[this.hazards.length - 1], a = r.range(0, Math.PI * 2); h.vx = Math.cos(a) * 45; h.vy = Math.sin(a) * 45;
      }
    }
    // dossier à trouver (campagne, une salle sur deux environ)
    const notes = NOTES[this.cfg.sector] || [];
    const ni = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3 }[index];
    if (this.cfg.mode === 'campaign' && ni != null && !this.notesFound.includes(ni) && type !== 'shop' && makeRng(seed ^ 0x707e).chance(index === 1 ? 1 : 0.6)) {
      const r = makeRng(seed ^ 0x9071);
      for (let a = 0; a < 30; a++) {
        const x = r.range(I.x0 + 120, I.x1 - 120), y = r.range(I.y0 + 140, I.y1 - 220);
        if (this.lv.solids.some((q) => x > q.x - 40 && x < q.x + q.w + 40 && y > q.y - 40 && y < q.y + q.h + 40)) continue;
        if (this.lv.zones.some((q) => x > q.x - 20 && x < q.x + q.w + 20 && y > q.y - 30 && y < q.y + q.h + 30)) continue;
        this.spawnPickup('note', x, y, { n: ni }); break;
      }
    }
    // événement aléatoire en cours de salle
    this.evtAt = -1;
    if (this.cfg.mode === 'campaign' && index >= 2 && !['shop', 'vault', 'core', 'start'].includes(type) && this.rng.chance(0.55)) this.evtAt = this.rng.range(14, 32);
    this.ev({ e: 'room', i: index, ty: type });
    const bossName = ZOMBIES[this.bossKind].name;
    this.setToast(this.cfg.mode === 'defense' ? 'Préparez le fort : réparez, posez des pièges' : this.cfg.mode === 'survival' ? 'Survivez aux vagues' : isBoss ? `${bossName} se réveille…` : roomName(type, this.cfg.sector), 2.6);
  }

  // Deux portes vers la salle suivante. Le marchand est proposé avant les salles 3 et 5 ; la 4 est celle du mini-boss.
  pickExits(next, r) {
    const base = r.shuffle(BRANCH_TYPES.slice());
    const special = r.shuffle(SPECIAL_TYPES.slice());
    if (next === 3 || next === 5) return [ 'shop', r.chance(0.4) ? special[0] : base[0] ];
    if (next === 4) return [base[0], r.chance(0.35) ? special.find((t) => t !== 'vault') : base[1]];
    return r.chance(0.45) ? [base[0], special[0]] : [base[0], base[1]];
  }

  openShop(cx, y, r) {
    const kinds = ['weapon', 'weapon', 'perk', 'med', 'armor', 'ammo', 'nade'];
    const n = kinds.length, gap = 74;
    this.shop = kinds.map((k, i) => {
      const it = { id: 'sh' + i, k, x: cx + (i - (n - 1) / 2) * gap, y, price: SHOP_ITEMS[k].price, sold: false };
      if (k === 'weapon') { const pool = WEAPON_IDS.filter((w) => WEAPONS[w].tier === (i === 0 ? 2 : 3)); it.w = r.pick(pool); it.price = i === 0 ? 22 : 34; }
      return it;
    });
  }

  tryBuy(p) {
    let best = null, bd = 50 * 50;
    for (const it of this.shop) { if (it.sold) continue; const d = (it.x - p.x) ** 2 + (it.y - p.y) ** 2; if (d < bd) { bd = d; best = it; } }
    if (!best) return false;
    if (this.scrap < best.price) { this.ev({ e: 'poor', p: p.id }); return true; }
    this.scrap -= best.price;
    switch (best.k) {
      case 'med': p.hp = Math.min(p.maxHp, p.hp + 50); best.price += 4; break;
      case 'armor': p.armor = p.maxArmor; best.price += 4; break;
      case 'nade': p.grenades = Math.min(nadeMax(p) + 1, p.grenades + 2); best.price += 3; break;
      case 'ammo': for (const w of p.weapons) if (w.res !== Infinity) w.res = resMax(p, WEAPONS[w.id]); best.price += 3; break;
      case 'perk': best.sold = true; this.offerPerks(p, 2); break;
      case 'weapon': best.sold = true; { const pk = this.spawnPickup('weapon', p.x, p.y, { w: best.w }); this.tryPickWeapon(p, pk); } break;
    }
    this.ev({ e: 'buy', p: p.id, k: best.k, x: Math.round(best.x), y: Math.round(best.y) });
    return true;
  }

  setToast(text, dur = 2.5, kind = '') { this.toast = { text, until: this.t + dur, kind, n: (this.toast ? this.toast.n : 0) + 1 }; }

  // Cinématique d'intro : la simulation attend ; elle se termine au bout du temps ou quand tous les humains passent
  beginIntro(sec = 12.5) { this.intro = sec; for (const p of this.players.values()) p.skip = false; }

  // ------------------------------------------------------------------ boucle
  step(dt = DT) {
    if (this.intro > 0) {
      this.intro -= dt; this.t += dt; this.tick++;
      for (const p of this.players.values()) {
        if ((p.input.sk | 0) !== (p.last.sk | 0)) p.skip = true;
        this.consumeEdges(p); p.last.sk = p.input.sk | 0;
      }
      const humans = [...this.players.values()].filter((p) => !p.bot);
      if (humans.length && humans.every((p) => p.skip)) this.intro = 0;
      if (this.intro <= 0) { this.intro = 0; this.ev({ e: 'introEnd' }); this.roomT = 0; }
      return;
    }
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
    this.stepEvents(dt);
    if (this.train) this.stepTrain(dt);
    this.stepZombies(dt);
    this.stepTurrets(dt);
    if (this.base) this.stepTraps(dt);
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
    const dashMax = dashMaxOf(p);
    if (p.abCd > 0) p.abCd -= dt;
    if (p.abT > 0) { p.abT -= dt; if (p.abT <= 0) { p.abT = 0; this.ev({ e: 'abEnd', p: p.id }); } }
    if (p.pinnedBy != null) {
      const z = this.zombies.find((q) => q.id === p.pinnedBy && q.hp > 0 && q.state === 'pin');
      if (!z || p.state !== 'ok') p.pinnedBy = null;
    }
    if (p.dashCharges < dashMax) { p.dashCd -= dt * (1 + 0.55 * lvl(p, 'dash')); if (p.dashCd <= 0) { p.dashCharges++; p.dashCd = DASH_CD; } }
    if (lvl(p, 'regen') && p.state === 'ok' && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 1.5 * lvl(p, 'regen') * dt);
    if (p.offers && p.bot) { p.offerT -= dt; if (p.offerT <= 0) this.pickPerk(p, botPerkChoice(p)); }

    // choix d'amélioration (compteur pk, index pi)
    if (inp.pk !== L.pk) {
      L.pk = inp.pk;
      if (p.offers && inp.pi >= 0 && inp.pi < p.offers.length) this.pickPerk(p, p.offers[inp.pi]);
      else if (p.build && inp.pi >= 0 && inp.pi < TRAP_IDS.length) this.buildTrap(p, TRAP_IDS[inp.pi]);
    }
    if (p.build) { const q = this.base && this.base.pads.find((x) => x.id === p.build); if (!q || q.trap || Math.hypot(q.x - p.x, q.y - p.y) > 90) p.build = null; }

    if (p.state === 'dead') { p.vx = p.vy = 0; this.consumeEdges(p); return; }

    if (p.state === 'down') {
      p.bleed -= dt * (p.reviveBy ? 0.25 : 1);
      if (p.bleed <= 0) { p.state = 'dead'; p.hp = 0; p.reviveP = 0; this.ev({ e: 'dead', p: p.id }); this.setToast(`${p.name} n'a pas survécu`, 2.4, 'bad'); }
      // adrénaline : relève automatique si personne ne peut aider
      if (p.adrenaline > 0 && p.state === 'down' && this.standing().length === 0 && this.t - p.downAt > 1.6) {
        p.adrenaline--; this.raise(p, 55); this.ev({ e: 'adren', p: p.id }); this.setToast('Adrénaline ! ' + p.name + ' se relève', 2.2, 'good');
      }
    }

    // capacité de classe
    if ((inp.ab | 0) !== (L.ab | 0)) { L.ab = inp.ab | 0; if (p.state === 'ok' && p.abCd <= 0 && p.pinnedBy == null) this.useAbility(p); }
    const pinned = p.pinnedBy != null;
    // se débattre : chaque appui sur roulade aide à se libérer
    if (pinned && (inp.dash | 0) !== (L.dash | 0)) {
      const z = this.zombies.find((q) => q.id === p.pinnedBy);
      if (z) { z.pinDmg = (z.pinDmg || 0) + (z.ty === 'queen' ? 18 : 12); this.ev({ e: 'struggle', p: p.id }); if (z.pinDmg > (z.ty === 'queen' ? 160 : 55)) this.releasePin(z, true); }
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
    if (inp.fire && !reviving && !pinned && p.dashT <= 0 && p.reloadT <= 0 && p.fireCd <= 0 && (!CW.spinUp || p.spin >= CW.spinUp)) {
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
      if (p.state === 'ok' && !pinned && p.dashCharges > 0 && p.dashT <= 0) {
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
        best.reviveP += (dt / REVIVE_TIME) * (1 + lvl(p, 'medic')) * (p.cls === 'medic' ? 2 : 1);
        if (best.reviveP >= 1) {
          this.raise(best, 30 + 30 * lvl(p, 'medic'));
          p.stats.revives++; p.stats.score += 250;
          this.ev({ e: 'rev', p: best.id, by: p.id });
        }
      } else if (this.vault && this.vault.st === 'closed' && Math.hypot(this.vault.x - p.x, this.vault.y - p.y) < 95) {
        p.reviving = 'vault';
        this.vault.prog += dt / 3;
        if (this.vault.prog >= 1) this.openVault();
      } else if (this.base && this.nearBar(p, true)) {
        const b = this.nearBar(p, true);
        p.reviving = 'bar'; b.hp = Math.min(b.max, b.hp + 110 * dt * (p.cls === 'engineer' ? 1.6 : 1));
        if (Math.random() < dt * 3) this.ev({ e: 'repair', x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) });
      } else if (useEdge) { if (!this.tryBuy(p) && !this.tryPad(p)) this.tryPickWeapon(p); }
    }
    for (const o of this.players.values()) if (o.state === 'down' && o.reviveBy === p.id && p.reviving !== o.id) { o.reviveBy = null; }
    if (this.vault && this.vault.st === 'closed' && ![...this.players.values()].some((q) => q.reviving === 'vault')) this.vault.prog = Math.max(0, this.vault.prog - dt * 0.5);

    // déplacement
    let sp = BASE_SPEED * (1 + 0.1 * lvl(p, 'speed'));
    if (lvl(p, 'rage') && p.hp < p.maxHp * 0.35) sp *= 1.4;
    if (CW.slow && p.spin > 0) sp *= CW.slow;
    sp *= classSpeed(p);
    if (this.lv.zones.length && this.inZone(p, 'water')) sp *= 0.62;
    if (p.state === 'down') sp = 52;
    if (reviving || pinned) sp = 0;
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

  // ------------------------------------------------------------------ capacités de classe
  useAbility(p) {
    const C = CLASSES[p.cls];
    p.abCd = C.cd; p.abT = C.dur;
    if (p.cls === 'medic') { this.addHazard('heal', p.x, p.y, 170, C.dur); this.hazards[this.hazards.length - 1].owner = p.id; p.abT = 0; }
    else if (p.cls === 'engineer') {
      this.turrets = this.turrets.filter((t) => t.owner !== p.id);
      let tx = p.x + Math.cos(p.aim) * 44, ty = p.y + Math.sin(p.aim) * 44;
      const c = { x: tx, y: ty, r: 16 }; this.collideBody(c);
      this.turrets.push({ id: this.nid++, owner: p.id, x: c.x, y: c.y, a: p.aim, t: C.dur, dur: C.dur, cd: 0.5, color: p.color });
      p.abT = 0;
    } else if (p.cls === 'tank') {
      for (const z of this.zombies) if (!isBig(z.ty) && Math.hypot(z.x - p.x, z.y - p.y) < 430) { z.tgt = p.id; z.tgtLock = C.dur; }
    } else if (p.cls === 'scout') {
      for (const z of this.zombies) if (z.tgt === p.id) { z.tgt = null; z.tgtLock = 0; z.retarget = 0; }
    }
    this.ev({ e: 'ab', p: p.id, c: p.cls, x: Math.round(p.x), y: Math.round(p.y) });
  }

  stepTurrets(dt) {
    for (const t of this.turrets) {
      t.t -= dt; t.cd -= dt;
      // tourelle de piège (mode Défense) plus faible et plus courte que celle de l'Ingénieur
      const pad = t.pad != null, range = pad ? 330 : 400;
      let best = null, bd = range;
      for (const z of this.zombies) {
        if (z.hp <= 0 || z.state === 'vanish') continue;
        const d = Math.hypot(z.x - t.x, z.y - t.y);
        if (d < bd && !raycastSolids(this.blockers, t.x, t.y, z.x, z.y)) { bd = d; best = z; }
      }
      if (best) {
        const want = Math.atan2(best.y - t.y, best.x - t.x);
        t.a += angDiff(t.a, want) * Math.min(1, dt * 12);
        if (t.cd <= 0 && Math.abs(angDiff(t.a, want)) < 0.25) {
          t.cd = pad ? 0.32 : 0.24;
          const a = t.a + (Math.random() - 0.5) * 0.16, sx = t.x + Math.cos(a) * 22, sy = t.y + Math.sin(a) * 22;
          this.projs.push({ x: sx, y: sy, vx: Math.cos(a) * 1700, vy: Math.sin(a) * 1700, life: range / 1700 + 0.02, dmg: pad ? 8 : 10, pen: 1, knock: 14, owner: t.owner, w: 'smg', hit: null, drag: 0 });
          this.ev({ e: 'f', p: 't' + t.id, w: 'smg', x: Math.round(sx), y: Math.round(sy), a: [Math.round(a * 1000) / 1000] });
        }
      }
    }
    if (this.turrets.some((t) => t.t <= 0)) { for (const t of this.turrets) if (t.t <= 0) this.ev({ e: 'tEnd', x: Math.round(t.x), y: Math.round(t.y) }); this.turrets = this.turrets.filter((t) => t.t > 0); }
  }

  consumeEdges(p) {
    const inp = p.input, L = p.last;
    L.dash = inp.dash; L.reload = inp.reload; L.sw = inp.sw; L.nade = inp.nade; L.pk = inp.pk; L.use = !!inp.use; L.ab = inp.ab | 0;
  }

  collideBody(e) {
    const solids = this.solidsNow || this.lv.solids;
    for (let it = 0; it < 2; it++) {
      for (const s of solids) {
        if (s.low && e.r >= 34) continue; // les géants enjambent tables, sacs de sable et réacteur
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
    if (p.cls === 'soldier') m *= 1.1;
    if (p.cls === 'scout' && p.abT > 0) m *= 1.4;
    if (lvl(p, 'rage') && p.hp < p.maxHp * 0.35) m *= 1.4;
    for (const o of this.players.values()) {
      if (o !== p && o.state === 'ok' && lvl(o, 'team') && (o.x - p.x) ** 2 + (o.y - p.y) ** 2 < 300 * 300) { m *= 1 + 0.15 * lvl(o, 'team'); break; }
    }
    if (p.state === 'down') m *= 0.8;
    return m;
  }

  fire(p, w, W) {
    const barrage = p.cls === 'soldier' && p.abT > 0;
    if (!W.melee && !barrage) w.mag--;
    p.fireCd = 1 / (W.rate * (1 + 0.15 * lvl(p, 'rate')) * (barrage ? 1.5 : 1));
    if (W.melee) { this.slash(p, W); return; }
    if (W.tesla) { this.zap(p, W); return; }
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
        drag: W.flame ? 2.2 : 0, bolt: !!W.bolt,
      });
    }
    p.kx -= Math.cos(p.aim) * W.kick; p.ky -= Math.sin(p.aim) * W.kick;
    this.ev({ e: 'f', p: p.id, w: W.id, x: Math.round(sx), y: Math.round(sy), a: angs });
  }

  slash(p, W) {
    const mult = this.dmgMult(p), reach = W.range;
    let hits = 0;
    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      if (d > reach + z.r) continue;
      const a = Math.atan2(z.y - p.y, z.x - p.x);
      if (Math.abs(angDiff(p.aim, a)) > W.arc && d > z.r + p.r) continue;
      this.damageZombie(z, W.dmg * mult, a, W.knock, p, false, true); hits++;
    }
    for (const b of this.barrels) if (b.hp > 0 && Math.hypot(b.x - p.x, b.y - p.y) < reach + b.r && Math.abs(angDiff(p.aim, Math.atan2(b.y - p.y, b.x - p.x))) < W.arc) this.damageBarrel(b, W.dmg);
    for (const c of this.crates) if (c.hp > 0 && Math.hypot(c.x + c.w / 2 - p.x, c.y + c.h / 2 - p.y) < reach + 22 && Math.abs(angDiff(p.aim, Math.atan2(c.y + c.h / 2 - p.y, c.x + c.w / 2 - p.x))) < W.arc) this.damageCrate(c, W.dmg);
    p.kx += Math.cos(p.aim) * 90; p.ky += Math.sin(p.aim) * 90;
    this.ev({ e: 'slash', p: p.id, a: Math.round(p.aim * 100) / 100, x: Math.round(p.x), y: Math.round(p.y), h: hits });
  }

  // éclair qui saute de zombie en zombie
  zap(p, W) {
    const mult = this.dmgMult(p);
    const pts = [[Math.round(p.x + Math.cos(p.aim) * 26), Math.round(p.y + Math.sin(p.aim) * 26)]];
    const hit = new Set();
    let first = null, bd = Infinity;
    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      if (d > W.range || Math.abs(angDiff(p.aim, Math.atan2(z.y - p.y, z.x - p.x))) > 0.45) continue;
      const score = d + Math.abs(angDiff(p.aim, Math.atan2(z.y - p.y, z.x - p.x))) * 300;
      if (score < bd && !raycastSolids(this.blockers, p.x, p.y, z.x, z.y)) { bd = score; first = z; }
    }
    let cur = first, dmg = W.dmg * mult;
    const jumps = W.tesla + lvl(p, 'pierce');
    while (cur && hit.size < jumps) {
      hit.add(cur.id); pts.push([Math.round(cur.x), Math.round(cur.y)]);
      cur.slowT = 0.6;
      this.damageZombie(cur, dmg, Math.atan2(cur.y - pts[pts.length - 2][1], cur.x - pts[pts.length - 2][0]), W.knock, p, false, true);
      dmg *= 0.85;
      let nx = null, nd = 190;
      for (const z of this.zombies) {
        if (z.hp <= 0 || hit.has(z.id)) continue;
        const d = Math.hypot(z.x - cur.x, z.y - cur.y);
        if (d < nd) { nd = d; nx = z; }
      }
      cur = nx;
    }
    if (!first) { const a = p.aim + (Math.random() - 0.5) * 0.5; pts.push([Math.round(p.x + Math.cos(a) * 150), Math.round(p.y + Math.sin(a) * 150)]); }
    this.ev({ e: 'zap', p: p.id, pts });
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
    for (const [, z] of hits) { if (n-- <= 0) break; this.damageZombie(z, W.dmg * mult, a, W.knock, p, false, true); }
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
        if (z.hp <= 0 || z.state === 'vanish' || (pr.hit && pr.hit.has(z.id))) continue;
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
        this.damageZombie(z, pr.dmg, a, pr.knock, owner, pr.flame, pr.bolt);
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
        if (wall.solid && wall.solid.kind === 'car' && !this.cars.has(wall.solid.id)) this.carAlarm(wall.solid);
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
  damageZombie(z, dmg, ang, knock, by, flame = false, pierceArmor = false) {
    if (z.hp <= 0) return;
    let crit = false, clank = false;
    if (by && !flame && Math.random() < 0.12 * lvl(by, 'crit') + (by.cls === 'scout' ? 0.1 : 0)) { dmg *= 2.5; crit = true; }
    // blindé : la plaque avant encaisse, il faut le prendre de côté ou de dos
    if (z.ty === 'armored' && !flame && !pierceArmor && Math.abs(angDiff(z.ang, ang + Math.PI)) < 1.0) { dmg *= 0.2; clank = true; crit = false; knock *= 0.3; }
    if (z.state === 'pin') { z.pinDmg = (z.pinDmg || 0) + dmg; if (z.pinDmg > (z.ty === 'queen' ? 160 : 55)) this.releasePin(z, true); }
    // Colosse : carapace devant, point faible dans le dos
    if (z.ty === 'colossus') {
      const front = Math.abs(angDiff(z.ang, ang + Math.PI)) < 1.25, back = Math.abs(angDiff(z.ang, ang)) < 0.8;
      if (front && !flame) { dmg *= pierceArmor ? 0.5 : 0.15; clank = !pierceArmor; }
      else if (back) { dmg *= 1.6; crit = true; }
    }
    if (z.state === 'stun') dmg *= 1.5;
    if (flame || (by && lvl(by, 'fire') && Math.random() < 0.2 * lvl(by, 'fire'))) { z.burnT = 3; z.burnBy = by ? by.id : null; }
    dmg = Math.max(1, dmg);
    z.hp -= dmg; z.flash = 0.07;
    if (by) by.stats.dmg += Math.min(dmg, z.hp + dmg);
    const mass = z.r / 16;
    const kb = (isBig(z.ty) ? 0.05 : z.ty === 'brute' ? 0.15 : 1) * knock / mass;
    z.kx += Math.cos(ang) * kb; z.ky += Math.sin(ang) * kb;
    if (clank && Math.random() < 0.6) this.ev({ e: 'clank', x: Math.round(z.x + Math.cos(z.ang) * z.r), y: Math.round(z.y + Math.sin(z.ang) * z.r), a: Math.round(z.ang * 100) / 100 });
    else if (!flame || Math.random() < 0.15) this.ev({ e: 'h', i: z.id, x: Math.round(z.x), y: Math.round(z.y), a: Math.round(ang * 100) / 100, d: Math.round(dmg), c: crit ? 1 : 0, g: z.ty === 'spitter' || z.ty === 'bloater' ? 1 : 0 });
    if (!isBig(z.ty) && z.tgtLock <= 0 && by) { z.tgt = by.id; z.tgtLock = 1.2; }
    if (z.hp <= 0) this.killZombie(z, ang, by);
  }

  killZombie(z, ang, by) {
    z.hp = 0;
    if (z.state === 'pin') this.releasePin(z, false);
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
    if (isBig(z.ty)) { if (FINAL_BOSSES.includes(z.ty)) this.bossDead = true; this.setToast(`${Z.name} neutralisé${z.ty === 'queen' || z.ty === 'mother' || z.ty === 'abomination' ? 'e' : ''} !`, 3, 'good'); }
    // ferraille (monnaie du marchand, commune à l'escouade)
    const def = this.cfg.mode === 'defense';
    const scrapP = isBig(z.ty) ? 1 : z.ty === 'brute' || z.elite ? (def ? 0.5 : 1) : (def ? 0.04 : 0.1) * (this.dark ? 2 : 1);
    if (Math.random() < scrapP) {
      const v = isBig(z.ty) ? 6 : z.ty === 'brute' ? 3 : z.elite ? 2 : 1;
      for (let k = 0; k < (isBig(z.ty) ? 4 : 1); k++) this.spawnPickup('scrap', z.x + (Math.random() - 0.5) * 40, z.y + (Math.random() - 0.5) * 40, { v });
    }
    // butin
    const dropP = Z.drop * this.diff.drops * (z.elite ? 3 : 1) * (this.cfg.mode === 'survival' ? 0.8 : def ? 0.35 : 1);
    if (Math.random() < dropP) {
      if ((z.ty === 'brute' || z.elite) && Math.random() < (def ? 0.2 : 0.45)) this.spawnWeaponDrop(z.x, z.y, 2);
      else this.spawnPickup(this.rng.weighted([['ammo', 46], ['med', 26], ['armor', 14], ['nade', 14]]), z.x, z.y);
    }
  }

  hurtPlayer(p, dmg, sx, sy, knock = 0) {
    if (p.state !== 'ok' || p.dashT > 0 || p.hurtT > 0.55 || this.phase !== 'play') return false;
    if (p.cls === 'tank' && p.abT > 0) { dmg *= 0.25; knock *= 0.2; }
    if (p.armor > 0) { const a = Math.min(p.armor, dmg * 0.6); p.armor -= a; dmg -= a; }
    p.hp -= dmg; p.hurtT = 0.6;
    if (knock && sx != null) { const a = Math.atan2(p.y - sy, p.x - sx); p.kx += Math.cos(a) * knock; p.ky += Math.sin(a) * knock; }
    this.ev({ e: 'hurt', p: p.id, d: Math.round(dmg), x: Math.round(sx ?? p.x), y: Math.round(sy ?? p.y) });
    if (p.hp <= 0) {
      if (lvl(p, 'second') && !p.secondUsed) { p.secondUsed = true; p.hp = 45; p.hurtT = 1.5; this.ev({ e: 'adren', p: p.id }); this.setToast(`Second souffle pour ${p.name} !`, 2, 'good'); return true; }
      p.pinnedBy = null;
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
        this.damageZombie(z, dmgZ * f, Math.atan2(z.y - y, z.x - x), 380 * f, by, false, true);
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
      const eng = [...this.players.values()].some((p) => p.cls === 'engineer' && p.state !== 'dead');
      if (eng) this.spawnPickup(this.rng.pick(['ammo', 'nade', 'armor']), cx - 16, cy - 12);
      this.spawnPickup('scrap', cx + 14, cy + 14, { v: 2 });
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
      if (h.k === 'heal') {
        for (const p of this.players.values()) {
          if ((p.x - h.x) ** 2 + (p.y - h.y) ** 2 > h.r * h.r) continue;
          if (p.state === 'ok') { p.hp = Math.min(p.maxHp, p.hp + 16 * dt); p.armor = Math.min(p.maxArmor, p.armor + 4 * dt); }
          else if (p.state === 'down') { p.reviveP += dt / 1.6; if (p.reviveP >= 1) { this.raise(p, 50); const m = this.players.get(h.owner); if (m) { m.stats.revives++; m.stats.score += 250; } this.ev({ e: 'rev', p: p.id, by: h.owner }); } }
        }
        continue;
      }
      if (h.k === 'gas') {
        h.x += h.vx * dt; h.y += h.vy * dt;
        const I = this.lv.inner;
        if (h.x < I.x0 + h.r * 0.6 || h.x > I.x1 - h.r * 0.6) h.vx = -h.vx;
        if (h.y < I.y0 + h.r * 0.6 || h.y > I.y1 - h.r * 0.6) h.vy = -h.vy;
      }
      const dps = h.k === 'acid' ? 16 : h.k === 'toxic' ? 9 : h.k === 'gas' ? 9 : 0;
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
      if (!taken && (pk.t < (this.cfg.mode === 'defense' ? 25 : 60) || pk.k === 'weapon' || pk.k === 'note')) keep.push(pk);
    }
    this.pickups = keep;
  }

  wants(p, k) {
    if (k === 'scrap' || k === 'note') return true;
    if (k === 'med') return p.hp < p.maxHp - 1;
    if (k === 'armor') return p.armor < p.maxArmor - 1;
    if (k === 'nade') return p.grenades < nadeMax(p);
    if (k === 'ammo') return p.weapons.some((w) => w.res !== Infinity && w.res < resMax(p, WEAPONS[w.id]));
    return false;
  }

  take(p, pk) {
    if (!this.wants(p, pk.k)) return false;
    if (pk.k === 'note') { this.notesFound.push(pk.n); this.ev({ e: 'note', p: p.id, n: pk.n, sec: this.cfg.sector, x: Math.round(pk.x), y: Math.round(pk.y) }); return true; }
    if (pk.k === 'scrap') { this.scrap += pk.v || 1; this.ev({ e: 'pk', p: p.id, k: 'scrap', v: pk.v || 1, x: Math.round(pk.x), y: Math.round(pk.y) }); return true; }
    if (pk.k === 'med') {
      p.hp = Math.min(p.maxHp, p.hp + 40);
      if (p.cls === 'medic') for (const o of this.players.values()) if (o !== p && o.state === 'ok' && Math.hypot(o.x - p.x, o.y - p.y) < 220) o.hp = Math.min(o.maxHp, o.hp + 25);
    }
    else if (pk.k === 'armor') p.armor = Math.min(p.maxArmor, p.armor + 35);
    else if (pk.k === 'nade') p.grenades++;
    else if (pk.k === 'ammo') for (const w of p.weapons) { const W = WEAPONS[w.id]; if (w.res !== Infinity) w.res = Math.min(resMax(p, W), w.res + Math.ceil(resMax(p, W) * 0.4)); }
    this.ev({ e: 'pk', p: p.id, k: pk.k, x: Math.round(pk.x), y: Math.round(pk.y) });
    return true;
  }

  tryPickWeapon(p, forced = null) {
    let best = forced, bd = 60 * 60;
    if (!best) for (const pk of this.pickups) {
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
    if (id === 'nade') p.grenades = Math.min(nadeMax(p), p.grenades + 1);
    if (id === 'dash') p.dashCharges = dashMaxOf(p);
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
          const count = ty === 'crawler' ? 2 : ty === 'larva' ? 6 : 1;
          const elite = this.room.index >= 3 && ['walker', 'runner', 'spitter'].includes(ty) && this.rng.chance(0.06);
          for (let k = 0; k < count; k++) this.pending.push({ ty, x: v.sx + (k ? (k % 3 - 1) * 16 : 0), y: v.sy + (k ? ((k / 3) | 0) * 14 : 0), t: 0.75 + k * (ty === 'larva' ? 0.08 : 0.25), elite });
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
    if (this.cfg.mode === 'defense') {
      W.budget = (12 + 6.5 * W.n) * pf * this.diff.budget;
      if (W.n >= 4) for (let k = 0; k < Math.floor(W.n / 4); k++) this.queueSpecial('brute');
      if (W.n === W.total) this.spawnBoss(0.8, this.bossKind);
      else if (W.n % 5 === 0) this.spawnBoss(0.7, MINI_BOSSES[(W.n / 5) % 2]);
      this.shop = [];
      if (W.n > 2 && W.n % 3 === 0 && this.rng.chance(0.6)) this.evtAt = this.rng.range(10, 20);
      this.setToast(W.n === W.total ? 'Dernière vague !' : `Vague ${W.n} / ${W.total}`, 2, 'wave');
      for (const p of this.players.values()) p.build = null;
    } else if (this.cfg.mode === 'survival') {
      W.budget = (12 + 6 * W.n) * pf * this.diff.budget;
      if (W.n % 5 === 0) for (let k = 0; k < Math.floor(W.n / 5); k++) this.queueSpecial('brute');
      if (W.n % 10 === 0) this.spawnBoss(0.45 + 0.15 * (W.n / 10 - 1), FINAL_BOSSES[(W.n / 10 - 1) % FINAL_BOSSES.length]);
      else if (W.n % 5 === 0) this.spawnBoss(0.6 + 0.1 * Math.floor(W.n / 10), MINI_BOSSES[Math.floor(W.n / 5) % 2]);
      this.shop = [];
      if (W.n > 1 && W.n % 3 === 1 && this.rng.chance(0.6)) this.evtAt = this.rng.range(10, 20);
      this.setToast(`Vague ${W.n}`, 2, 'wave');
    } else if (isBoss) {
      this.spawnBoss(1, this.bossKind);
      W.budget = 8 * pf * this.diff.budget;
    } else {
      W.budget = (9 + 5 * i) * (0.8 + 0.25 * W.n) * pf * this.diff.budget * (W.mult || 1);
      if (W.n === W.total && i === 4) { this.spawnBoss(0.8, this.miniKind); W.budget *= 0.25; }
      else if (W.n === W.total && i >= 3) for (let k = 0; k < (i >= 6 && nPlayers(this) >= 3 ? 2 : 1); k++) this.queueSpecial('brute');
      if (this.room.type === 'armory' && W.n === W.total && i < 3) this.queueSpecial('brute');
      this.setToast(W.total > 1 ? `Vague ${W.n} / ${W.total}` : 'Contact !', 2, 'wave');
    }
    W.spawnT = 0.4; W.timer = this.cfg.mode === 'survival' ? 6 : this.cfg.mode === 'defense' ? 22 : 3.5;
    this.ev({ e: 'wave', n: W.n });
  }

  queueSpecial(ty) {
    const v = this.pickVent(); if (!v) return;
    this.pending.push({ ty, x: v.sx, y: v.sy, t: 1.2 }); this.ev({ e: 'vent', v: v.id, big: 1 });
  }

  pickZombieType(n) {
    const i = this.cfg.mode !== 'campaign' ? 1 + Math.min(8, Math.floor(this.wave.n / 2)) : this.room.index;
    const ty = this.room.type;
    const w = [
      ['walker', 10],
      ['crawler', (ty === 'storage' ? 8 : 4)],
      ['runner', (i >= 2 ? 5 : 1.2) * (ty === 'medbay' ? 1.7 : ty === 'dark' ? 1.5 : 1)],
      ['spitter', (i >= 2 ? 2.5 : 0) * (ty === 'lab' ? 2.2 : 1)],
      ['bloater', (i >= 3 ? 1.6 : 0) * (ty === 'storage' ? 1.6 : 1)],
      ['screamer', i >= 4 ? 0.8 : 0],
      ['brute', i >= 6 ? 0.25 : 0],
      ['armored', i >= 3 ? 1.3 : 0],
      ['stalker', (i >= 4 ? 0.7 : i >= 3 ? 0.3 : 0) + (ty === 'dark' ? 1.2 : 0)],
      ['larva', (i >= 2 ? 1.4 : 0) * (ty === 'lab' ? 1.8 : 1)],
    ].map(([k, v]) => [k, v * (SECTORS[this.cfg.sector].zw[k] || 1)]).filter((x) => x[1] > 0);
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
    const roomScale = this.cfg.mode !== 'campaign' ? 1 + this.wave.n * 0.045 : 1 + (this.room.index - 1) * 0.1;
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

  spawnBoss(scale, kind = 'boss') {
    const z = this.spawnZombie(kind, this.lv.w / 2, this.lv.inner.y0 + 160);
    z.hp *= scale * (1 + 0.3 * (this.players.size - 1)) / (1 + 0.12 * (this.players.size - 1)); z.maxHp = z.hp;
    z.cdA = 4; z.cdB = 6; z.cdC = kind === 'mother' ? 3 : 9;
    this.ev({ e: 'boss', k: kind });
    if (MINI_BOSSES.includes(kind)) this.setToast(`Mini-boss : ${ZOMBIES[kind].name} !`, 2.6, 'bad');
    return z;
  }

  // ------------------------------------------------------------------ mode Défense
  nearBar(p, damagedOnly) {
    let best = null, bd = 75;
    for (const b of this.base.bars) {
      if (damagedOnly && b.hp >= b.max) continue;
      const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  tryPad(p) {
    if (!this.base) return false;
    const q = this.base.pads.find((x) => !x.trap && Math.hypot(x.x - p.x, x.y - p.y) < 48);
    if (!q) return false;
    p.build = p.build === q.id ? null : q.id;
    return true;
  }

  buildTrap(p, k) {
    const q = this.base.pads.find((x) => x.id === p.build); const T = TRAPS[k];
    if (!q || q.trap || !T) return;
    if (k === 'turret' && this.base.pads.filter((x) => x.trap && x.trap.k === 'turret').length >= MAX_PAD_TURRETS) { this.setToast(`${MAX_PAD_TURRETS} tourelles maximum dans le fort`, 2, 'bad'); return; }
    if (this.scrap < T.price) { this.ev({ e: 'poor', p: p.id }); return; }
    this.scrap -= T.price;
    q.trap = { k, n: k === 'mine' ? 3 : 0, cd: 0, waves: k === 'turret' ? 2 : 3 };
    if (k === 'turret') this.turrets.push({ id: this.nid++, owner: p.id, pad: q.id, x: q.x, y: q.y, a: -Math.PI / 2, t: 9999, dur: 9999, cd: 0.5, color: p.color });
    p.build = null;
    this.ev({ e: 'build', p: p.id, k, x: Math.round(q.x), y: Math.round(q.y) });
  }

  stepTraps(dt) {
    for (const q of this.base.pads) {
      const tr = q.trap; if (!tr) continue;
      if (tr.cd > 0) tr.cd -= dt;
      for (const z of this.zombies) {
        if (z.hp <= 0) continue;
        const d = Math.hypot(z.x - q.x, z.y - q.y);
        if (tr.k === 'wire' && d < 62 + z.r * 0.5) { z.slowT = Math.max(z.slowT || 0, 0.2); z.hp -= 9 * dt; if (z.hp <= 0) this.killZombie(z, 0, null); }
        else if (tr.k === 'flame' && d < 56) { if (!(z.burnT > 0)) z.burnT = 2.5; }
        else if (tr.k === 'mine' && d < 36 && tr.cd <= 0 && tr.n > 0) {
          tr.n--; tr.cd = 0.6; this.explode(q.x, q.y, 120, 170, 0, null, 'nade');
          if (tr.n <= 0) { q.trap = null; break; }
        }
      }
    }
  }

  barricadeContact(z, Z) {
    for (const b of this.base.bars) {
      if (b.hp <= 0) continue;
      const c = { x: z.x, y: z.y, r: z.r };
      if (!pushOutRect(c, b)) continue;
      z.x = c.x; z.y = c.y;
      if (z.atkCd <= 0 && z.state === 'walk') {
        z.atkCd = Z.cd; z.atkT = 0;
        b.hp -= Z.dmg * this.diff.zDmg * (isBig(z.ty) ? 4 : 1) * (z.ty === 'brute' ? 2.5 : 1);
        this.ev({ e: 'barHit', x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) });
        if (b.hp <= 0) { b.hp = 0; this.ev({ e: 'barBreak', id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) }); this.setToast('Une barricade a cédé !', 2, 'bad'); }
      }
      z.ang = Math.atan2(b.y + b.h / 2 - z.y, b.x + b.w / 2 - z.x);
    }
  }

  hitGen(dmg, z) {
    const G = this.base.gen;
    G.hp -= dmg;
    this.ev({ e: 'genHit', x: Math.round(G.x), y: Math.round(G.y) });
    if (G.hp <= 0 && this.phase === 'play') { G.hp = 0; this.phase = 'over'; this.endT = 0; this.ev({ e: 'genDown', x: Math.round(G.x), y: Math.round(G.y) }); this.ev({ e: 'over' }); this.setToast('Le générateur est détruit…', 4, 'bad'); }
  }

  openVault() {
    const V = this.vault;
    V.st = 'alarm'; V.prog = 1;
    this.cleared = false; this.doorsOpen = false; this.rally = null;
    this.wave = { n: 0, total: 2, budget: 0, timer: 1.2, spawnT: 0, endless: false, mult: 1.5 };
    this.ev({ e: 'vaultAlarm', x: Math.round(V.x), y: Math.round(V.y) });
    this.setToast('Alarme ! Tenez jusqu\'à l\'ouverture du coffre', 3, 'bad');
  }

  // Métro : une rame traverse régulièrement la salle ; tout ce qui est sur les voies est fauché
  carAlarm(car) {
    this.cars.add(car.id);
    const cx = car.x + car.w / 2, cy = car.y + car.h / 2;
    this.ev({ e: 'carAlarm', x: Math.round(cx), y: Math.round(cy), id: car.id });
    this.setToast('Alarme de voiture ! Ils arrivent…', 2.2, 'bad');
    for (let i = 0; i < 8 + this.players.size * 2; i++) { const v = this.rng.pick(this.lv.vents); this.pending.push({ ty: i % 3 ? 'runner' : 'walker', x: v.sx, y: v.sy, t: 0.6 + i * 0.15 }); }
    for (const z of this.zombies) if (!isBig(z.ty) && Math.hypot(z.x - cx, z.y - cy) < 700) z.buffT = 4;
  }

  stepTrain(dt) {
    const T = this.train, tz = this.lv.zones.find((z) => z.k === 'track');
    T.t -= dt;
    if (T.st === 'idle' && T.t <= 0) { T.st = 'warn'; T.t = 2.6; this.ev({ e: 'trainWarn' }); }
    else if (T.st === 'warn' && T.t <= 0) { T.st = 'pass'; T.t = 1.3; T.x = T.dir > 0 ? -900 : this.lv.w + 900; this.ev({ e: 'train', d: T.dir }); }
    else if (T.st === 'pass') {
      T.x += T.dir * 2600 * dt;
      const x0 = T.dir > 0 ? T.x - 900 : T.x, x1 = T.dir > 0 ? T.x : T.x + 900;
      for (const p of this.players.values()) {
        if (p.state === 'dead' || p.y < tz.y - 4 || p.y > tz.y + tz.h + 4 || p.x < x0 || p.x > x1) continue;
        if (p.state === 'down') { p.bleed = Math.min(p.bleed, 0.01); continue; }
        if (!p.trainHit) { p.trainHit = true; p.hurtT = 0; p.dashT = 0; this.hurtPlayer(p, 70, p.x, p.y - T.dir * 0.01, 0); p.ky += (p.y < tz.y + tz.h / 2 ? -1 : 1) * 900; p.kx += T.dir * 300; }
      }
      for (const z of this.zombies) {
        if (z.hp <= 0 || isBig(z.ty) || z.y < tz.y - z.r || z.y > tz.y + tz.h + z.r || z.x < x0 || z.x > x1) continue;
        this.damageZombie(z, 9999, T.dir > 0 ? 0 : Math.PI, 600, null, false, true);
      }
      if (T.t <= 0 || (T.dir > 0 ? T.x - 900 > this.lv.w : T.x + 900 < 0)) { T.st = 'idle'; T.t = 18 + this.rng.range(0, 10); for (const p of this.players.values()) p.trainHit = false; }
    }
  }

  // ------------------------------------------------------------------ événements aléatoires
  stepEvents(dt) {
    const E = this.evt;
    if (this.evtAt > 0 && !this.cleared && this.wave.n > 0) {
      this.evtAt -= dt;
      if (this.evtAt <= 0) this.startEvent(this.rng.weighted([['blackout', 3], ['horde', 3], ['drop', 4]]));
    }
    if (!E) return;
    E.t -= dt;
    if (E.k === 'drop') {
      if (E.st === 'fall') { if (E.t <= 0) { E.st = 'land'; E.t = 0; this.ev({ e: 'dropLand', x: E.x, y: E.y }); this.wave.budget += 10; } }
      else if (E.st === 'land') {
        const near = this.standing().filter((p) => Math.hypot(p.x - E.x, p.y - E.y) < 120).length;
        E.prog += dt * (near ? 1 + 0.35 * (near - 1) : 0) / E.need;
        if (E.prog >= 1) {
          E.st = 'done'; E.t = 2;
          this.spawnWeaponDrop(E.x - 30, E.y, 3); this.spawnPickup('ammo', E.x + 30, E.y); this.spawnPickup('med', E.x, E.y + 30);
          for (let k = 0; k < 4; k++) this.spawnPickup('scrap', E.x + (k - 1.5) * 20, E.y - 30, { v: 3 });
          this.ev({ e: 'dropOk', x: E.x, y: E.y }); this.setToast('Ravitaillement sécurisé !', 2.2, 'good');
        }
      } else if (E.t <= 0) this.evt = null;
    } else if (E.t <= 0) { if (E.k === 'blackout') this.ev({ e: 'lightsOn' }); this.evt = null; }
  }

  startEvent(k) {
    if (k === 'blackout') { this.evt = { k, t: 13 }; this.ev({ e: 'blackout' }); this.setToast('Coupure de courant !', 2.4, 'bad'); }
    else if (k === 'horde') {
      this.evt = { k, t: 3 };
      for (let i = 0; i < 12; i++) { const v = this.rng.pick(this.lv.vents); this.pending.push({ ty: i % 3 ? 'runner' : 'walker', x: v.sx + (Math.random() - 0.5) * 30, y: v.sy + (Math.random() - 0.5) * 30, t: 0.8 + i * 0.12 }); }
      this.ev({ e: 'horde' }); this.setToast('Horde en approche !', 2.4, 'bad');
    } else if (k === 'drop') {
      const I = this.lv.inner;
      let x = this.lv.w / 2, y = (I.y0 + I.y1) / 2;
      for (let a = 0; a < 40; a++) {
        const cx = this.rng.range(I.x0 + 150, I.x1 - 150), cy = this.rng.range(I.y0 + 150, I.y1 - 200);
        const c = { x: cx, y: cy, r: 40 };
        if (this.lv.solids.some((q) => cx > q.x - 60 && cx < q.x + q.w + 60 && cy > q.y - 60 && cy < q.y + q.h + 60)) continue;
        if (this.standing().some((p) => Math.hypot(p.x - cx, p.y - cy) < 260)) continue;
        x = c.x; y = c.y; break;
      }
      this.evt = { k, t: 3, st: 'fall', x: Math.round(x), y: Math.round(y), prog: 0, need: 8 };
      this.ev({ e: 'dropIn', x: Math.round(x), y: Math.round(y) }); this.setToast('Largage de ravitaillement : sécurisez-le !', 2.6, 'good');
    }
  }

  roomCleared() {
    this.cleared = true; this.roomsCleared++;
    const bonus = 400 * this.room.index;
    this.score += bonus;
    const ty = this.room.type;
    if ((this.cfg.mode === 'campaign' && (ty === 'core' || this.room.index >= CAMPAIGN_ROOMS)) || this.cfg.mode === 'defense') {
      this.phase = 'won'; this.endT = 0; this.ev({ e: 'won' }); return;
    }
    this.doorsOpen = this.lv.doors.some((d) => d.kind === 'exit');
    this.ev({ e: 'clear', b: bonus });
    this.setToast('Zone sécurisée — choisissez une porte', 3.2, 'good');
    const cx = this.lv.w / 2, cy = (this.lv.inner.y0 + this.lv.inner.y1) / 2;
    for (const p of this.players.values()) {
      if (p.state === 'down') { /* on peut encore le relever ; sinon il se relève à la salle suivante */ }
      this.offerPerks(p, ty === 'lab' ? 1 : ty === 'gas' ? 2 : ty === 'vault' ? 3 : 0);
      if (ty === 'lab') p.picksQueued++;
      if (ty === 'medbay' && p.state === 'ok') { p.hp = Math.min(p.maxHp, p.hp + 50); p.armor = Math.min(p.maxArmor, p.armor + 40); }
      if (ty === 'storage') p.grenades = nadeMax(p);
    }
    if (ty === 'armory') { this.spawnWeaponDrop(cx - 60, cy, 2); this.spawnWeaponDrop(cx + 60, cy, 2); this.spawnPickup('ammo', cx, cy + 50); }
    else if (ty === 'medbay') { this.spawnPickup('med', cx - 40, cy); this.spawnPickup('med', cx + 40, cy); this.spawnPickup('armor', cx, cy + 40); }
    else if (ty === 'storage') { for (let k = 0; k < 3; k++) this.spawnPickup('ammo', cx - 60 + k * 60, cy); this.spawnPickup('armor', cx, cy + 50); }
    else this.spawnPickup('ammo', cx, cy);
    const scrapN = ty === 'dark' ? 8 : 3;
    for (let k = 0; k < scrapN; k++) this.spawnPickup('scrap', cx + (k - (scrapN - 1) / 2) * 26, cy + 60, { v: 2 });
    if (ty === 'gas') for (const h of this.hazards) if (h.k === 'gas') { h.t = Math.min(h.t, 2); h.dur = 2; }
    if (ty === 'vault' && this.vault) {
      this.vault.st = 'open';
      this.spawnWeaponDrop(this.vault.x - 50, this.vault.y + 20, 3); this.spawnWeaponDrop(this.vault.x + 50, this.vault.y + 20, 3);
      for (let k = 0; k < 8; k++) this.spawnPickup('scrap', this.vault.x + (k - 3.5) * 22, this.vault.y + 70, { v: 3 });
      this.setToast('Le coffre est ouvert !', 3, 'good');
    }
    if (this.evt && this.evt.k === 'blackout') { this.evt = null; this.ev({ e: 'lightsOn' }); }
  }

  // mode Survie : fin de vague = petite pause, objets, et améliorations une vague sur deux
  survivalBreak() {
    const W = this.wave;
    if (W.budget > 0 || this.zombies.length + this.pending.length > 0 || W.n === 0 || W.rewarded === W.n) return;
    W.rewarded = W.n;
    this.roomsCleared = W.n;
    if (this.base) {
      this.scrap += 8 + W.n;
      for (const q of this.base.pads) if (q.trap && q.trap.k === 'turret' && --q.trap.waves <= 0) { this.turrets = this.turrets.filter((t) => t.pad !== q.id); q.trap = null; }
    }
    const cx = this.lv.w / 2, cy = (this.lv.inner.y0 + this.lv.inner.y1) / 2;
    this.spawnPickup('ammo', cx - 40, cy); this.spawnPickup(this.rng.pick(['med', 'armor', 'nade']), cx + 40, cy);
    if (W.n % 3 === 0) this.spawnWeaponDrop(cx, cy - 60, W.n >= 6 ? 2 : 1);
    if (W.n % 3 === 0) { this.openShop(cx, cy + 120, this.rng); this.setToast('Dédé le ferrailleur passe : achetez vite !', 2.6, 'good'); }
    for (let k = 0; k < 3; k++) this.spawnPickup('scrap', cx + (k - 1) * 26, cy + 40, { v: 2 });
    for (const p of this.players.values()) {
      if (p.state === 'dead') { p.state = 'ok'; p.hp = Math.round(p.maxHp * 0.5); p.x = this.lv.spawn.x; p.y = this.lv.spawn.y; this.ev({ e: 'respawn', p: p.id }); }
      if (W.n % 2 === 0) this.offerPerks(p);
    }
    this.setToast(`Vague ${W.n} repoussée`, 2.4, 'good');
    this.score += 300 * W.n;
  }

  // ------------------------------------------------------------------ portes
  stepRally(dt) {
    if (this.cfg.mode !== 'campaign') { this.survivalBreak(); return; }
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
    const targets = plist.filter((p) => p.state === 'ok' && !(p.cls === 'scout' && p.abT > 0));
    // grille spatiale pour la séparation
    const G = 56, grid = new Map();
    for (const z of Zs) { const k = ((z.x / G) | 0) * 4096 + ((z.y / G) | 0); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(z); }

    for (const z of Zs) {
      if (z.hp <= 0) continue;
      const Z = ZOMBIES[z.ty];
      z.flash = Math.max(0, z.flash - dt);
      if (z.burnT > 0) {
        z.burnT -= dt;
        z.hp -= 13 * dt * (isBig(z.ty) ? 0.5 : 1);
        if (z.hp <= 0) { this.killZombie(z, 0, this.players.get(z.burnBy)); continue; }
      }
      if (z.buffT > 0) z.buffT -= dt;
      if (z.tgtLock > 0) z.tgtLock -= dt;
      z.atkCd -= dt; z.cdA -= dt; z.cdB -= dt; z.cdC -= dt;

      // cible
      z.retarget -= dt;
      let T = this.players.get(z.tgt);
      if (T && T.cls === 'scout' && T.abT > 0) T = null;
      if (z.state === 'pin') T = this.players.get(z.pinId) || null;
      else if (!T || T.state !== 'ok' || (z.retarget <= 0 && z.tgtLock <= 0)) {
        z.retarget = 0.6 + Math.random() * 0.3;
        let best = null, bd = Infinity;
        for (const p of targets) { const d = (p.x - z.x) ** 2 + (p.y - z.y) ** 2; if (d < bd) { bd = d; best = p; } }
        z.tgt = best ? best.id : null; T = best;
      }
      // Défense : les zombies foncent vers le générateur, sauf si un survivant est tout près
      if (this.base && z.state !== 'pin' && (!T || Math.hypot(T.x - z.x, T.y - z.y) > (isBig(z.ty) ? 420 : 280))) T = this.base.gen;
      const dx = T ? T.x - z.x : 0, dy = T ? T.y - z.y : 0, dist = Math.hypot(dx, dy) || 1;
      z.losT -= dt;
      if (z.losT <= 0 && T) { z.losT = 0.25; z.los = !raycastSolids(this.blockers, z.x, z.y, T.x, T.y); z.walkLos = z.los && (z.r >= 34 || !this.solidsNow.some((s) => s.low && segRect(z.x, z.y, dx, dy, s, z.r * 0.8))); }

      let speed = z.spd * (z.buffT > 0 ? 1.45 : 1);
      if (z.slowT > 0) { z.slowT -= dt; speed *= 0.35; }
      if (this.lv.zones.length && !isBig(z.ty) && this.inZone(z, 'water')) speed *= 0.6;
      let want = null; // direction souhaitée {x,y}
      // coincé contre un coin : on contourne
      z.stuckT = (z.stuckT || 0) + dt;
      if (z.stuckT > 1.2) { const moved = Math.hypot(z.x - (z.sx0 ?? z.x), z.y - (z.sy0 ?? z.y)); z.unstick = moved < 18 && z.state === 'walk' ? 0.8 : 0; z.sx0 = z.x; z.sy0 = z.y; z.stuckT = 0; }
      if (z.unstick > 0) z.unstick -= dt;
      const chase = () => {
        if (!T) return null;
        if (z.unstick > 0) { const s2 = z.id % 2 ? 1 : -1; return { x: (-dy / dist) * s2 * 0.8 + (dx / dist) * 0.6, y: (dx / dist) * s2 * 0.8 + (dy / dist) * 0.6 }; }
        if (z.walkLos && dist < 520) return { x: dx / dist, y: dy / dist };
        const fld = T.isGen ? this.base.field : this.field;
        const f = fld && flowDir(this.lv, fld, z.x, z.y);
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
        case 'colossus':
        case 'abomination':
          if (this.bigAI(z, T, dt, dist, dx, dy)) { speed = z.curSpeed; want = z.curWant; }
          else want = chase();
          if (z.ty !== 'brute') speed *= z.phase === 3 ? 1.3 : 1;
          break;
        case 'mother':
          if (this.motherAI(z, T, dt, dist, dx, dy)) { speed = z.curSpeed; want = z.curWant; } else want = chase();
          break;
        case 'queen':
          if (this.queenAI(z, T, dt, dist, dx, dy)) { speed = z.curSpeed; want = z.curWant; } else want = chase();
          break;
        case 'runner':
          want = chase(); if (T && dist < 160) speed *= 1.35;
          break;
        case 'stalker':
          if (this.stalkerAI(z, T, dt, dist, dx, dy)) { speed = z.curSpeed; want = z.curWant; } else want = chase();
          break;
        case 'larva': {
          want = chase();
          if (want) { const wig = Math.sin(this.t * 9 + z.wob) * 0.7; const c = Math.cos(wig), sn = Math.sin(wig); want = { x: want.x * c - want.y * sn, y: want.x * sn + want.y * c }; }
          break;
        }
        case 'armored':
          want = chase(); if (T && dist < 140) speed *= 1.2;
          break;
        default:
          want = chase();
      }

      // attaque au contact
      if (T && z.state === 'walk' && z.ty !== 'bloater' && z.ty !== 'stalker') {
        const reach = z.r + T.r + (isBig(z.ty) ? 30 : 8);
        if (z.atkT > 0) {
          z.atkT -= dt; speed *= 0.35;
          if (z.atkT <= 0) {
            z.atkCd = Z.cd;
            if (dist < reach + 16 && T.isGen) this.hitGen(Z.dmg * this.diff.zDmg * (isBig(z.ty) ? 3 : 1), z);
            else if (dist < reach + 16) this.hurtPlayer(T, Z.dmg * this.diff.zDmg * (z.elite ? 1.4 : 1), z.x, z.y, isBig(z.ty) ? 420 : z.ty === 'brute' ? 300 : 90);
            this.ev({ e: 'zs', z: z.id });
          }
        } else if (dist < reach && z.atkCd <= 0) { z.atkT = isBig(z.ty) ? 0.45 : 0.28; }
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
          const heavy = z.ty === 'brute' || isBig(z.ty);
          const pz = heavy ? 0.1 : p.dashT > 0 ? 0.9 : 0.72;
          z.x -= (ox / d) * over * pz; z.y -= (oy / d) * over * pz;
          if (p.dashT <= 0) { p.x += (ox / d) * over * (1 - pz); p.y += (oy / d) * over * (1 - pz); }
        }
      }
      this.collideBody(z);
      if (this.base) this.barricadeContact(z, Z);
      if (z.state === 'charge' && z.hitWall) { z.hitWall = false; }
    }
    this.zombies = Zs.filter((z) => z.hp > 0);
  }

  // Traqueur : rôde à distance, presque invisible, bondit et plaque un survivant au sol
  stalkerAI(z, T, dt, dist, dx, dy) {
    const Z = ZOMBIES[z.ty].pounce ? ZOMBIES[z.ty] : ZOMBIES.stalker;
    switch (z.state) {
      case 'crouch':
        z.stT -= dt; z.curSpeed = 0; z.curWant = null;
        if (T) z.lockA = Math.atan2(dy, dx);
        if (z.stT <= 0) { z.state = 'leap'; z.stT = 0.55; this.ev({ e: 'pounce', x: Math.round(z.x), y: Math.round(z.y) }); }
        return true;
      case 'leap': {
        z.stT -= dt;
        z.curSpeed = Z.pounce; z.curWant = { x: Math.cos(z.lockA), y: Math.sin(z.lockA) };
        z.vx = Math.cos(z.lockA) * Z.pounce; z.vy = Math.sin(z.lockA) * Z.pounce;
        for (const p of this.players.values()) {
          if (p.state !== 'ok' || p.dashT > 0 || p.pinnedBy != null) continue;
          if (Math.hypot(p.x - z.x, p.y - z.y) < z.r + p.r + 8) {
            if (p.cls === 'tank' && p.abT > 0) { z.state = 'stun'; z.stT = 1.2; this.ev({ e: 'clank', x: Math.round(p.x), y: Math.round(p.y), a: 0 }); return true; }
            z.state = 'pin'; z.pinId = p.id; z.pinDmg = 0; z.stT = z.ty === 'queen' ? 2.6 : 4; p.pinnedBy = z.id; p.vx = p.vy = 0;
            this.ev({ e: 'pin', p: p.id }); this.setToast(`${p.name} est plaqué au sol !`, 2, 'bad');
            return true;
          }
        }
        if (z.stT <= 0) { z.state = 'walk'; z.cdA = 3.5; }
        return true;
      }
      case 'pin': {
        const p = this.players.get(z.pinId);
        z.curSpeed = 0; z.curWant = null; z.vx = z.vy = 0;
        if (!p || p.state !== 'ok') { this.releasePin(z, false); return true; }
        z.x += (p.x - z.x) * Math.min(1, dt * 10); z.y += (p.y - z.y) * Math.min(1, dt * 10);
        z.ang = Math.atan2(p.y - z.y, p.x - z.x) || z.ang;
        let d = (z.ty === 'queen' ? 15 : 12) * this.diff.zDmg * dt;
        if (p.armor > 0) { const a = Math.min(p.armor, d * 0.5); p.armor -= a; d -= a; }
        p.hp -= d;
        if (p.hp <= 0) { p.hp = 0.01; p.hurtT = 0; this.hurtPlayer(p, 5, z.x, z.y); }
        z.stT -= dt; if (z.stT <= 0) this.releasePin(z, true);
        return true;
      }
      case 'stun':
        z.stT -= dt; z.curSpeed = 0; z.curWant = null; if (z.stT <= 0) { z.state = 'walk'; z.cdA = 2; }
        return true;
    }
    if (!T) return false;
    if (z.cdA <= 0 && z.los && dist < 430 && dist > 120) { z.state = 'crouch'; z.stT = 0.6; z.lockA = Math.atan2(dy, dx); return true; }
    // tourne autour de sa proie à distance en attendant
    if (z.los && dist < 300) { const s = (z.id % 2 ? 1 : -1); z.curWant = { x: (-dy / dist) * s - (dx / dist) * 0.3, y: (dx / dist) * s - (dy / dist) * 0.3 }; z.curSpeed = z.spd * 0.8; return true; }
    return false;
  }

  releasePin(z, jumpAway) {
    const p = this.players.get(z.pinId);
    if (p && p.pinnedBy === z.id) { p.pinnedBy = null; p.hurtT = 0.8; }
    z.pinId = null;
    if (z.hp > 0) {
      z.state = 'stun'; z.stT = jumpAway ? 0.9 : 0.4; z.cdA = 5;
      if (p && jumpAway) { const a = Math.atan2(z.y - p.y, z.x - p.x); z.kx += Math.cos(a) * 520; z.ky += Math.sin(a) * 520; }
    }
    this.ev({ e: 'unpin', p: p ? p.id : null });
  }

  // Brute et boss : charge, onde de choc, salves d'acide, invocation. Renvoie true si l'IA contrôle le mouvement.
  bigAI(z, T, dt, dist, dx, dy) {
    const boss = z.ty !== 'brute';
    this.bossPhase(z);
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
        if (z.stT <= 0) {
          // Colosse enragé : enchaîne une deuxième charge
          if (z.ty === 'colossus' && z.phase >= 2 && !z.chained) { z.chained = true; z.state = 'tele'; z.stT = 0.45; if (T) z.lockA = Math.atan2(T.y - z.y, T.x - z.x); return true; }
          z.chained = false; z.state = 'walk'; z.cdA = (z.ty === 'colossus' ? 3.6 : boss ? 5 : 5.5) * cdm;
        }
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
    if (z.cdA <= 0 && z.los && dist > 170 && dist < 560 && (z.ty !== 'boss' || z.phase >= 2)) { z.state = 'tele'; z.stT = boss ? 0.75 : 0.85; z.lockA = Math.atan2(dy, dx); this.ev({ e: 'roar', x: Math.round(z.x), y: Math.round(z.y) }); return true; }
    if (boss) {
      if (z.ty === 'colossus') {
        if (z.cdB <= 0 && dist < 240) { z.state = 'slamwind'; z.stT = 0.85; this.ev({ e: 'roar', x: Math.round(z.x), y: Math.round(z.y) }); return true; }
        if (z.cdC <= 0 && z.phase >= 2) { z.cdC = 10 * cdm; for (let k = 0; k < z.phase; k++) this.queueSpecial('armored'); this.ev({ e: 'roar', x: Math.round(z.x), y: Math.round(z.y) }); }
        return false;
      }
      if (z.ty === 'abomination') {
        if (z.cdB <= 0 && dist < 220) { z.state = 'slamwind'; z.stT = 0.8; this.ev({ e: 'roar', x: Math.round(z.x), y: Math.round(z.y) }); return true; }
        if (z.cdC <= 0) { z.cdC = 5 * cdm; const st = this.standing(); if (st.length) this.throwRock(z, this.rng.pick(st), z.phase >= 2 ? 3 : 2); }
        return false;
      }
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

  bossPhase(z) {
    if (!isBig(z.ty)) return;
    const f = z.hp / z.maxHp;
    const ph = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
    if (ph !== z.phase && ph > z.phase) {
      z.phase = ph; z.cdC = 1; this.ev({ e: 'phase', n: ph, k: z.ty });
      const nm = ZOMBIES[z.ty].name;
      this.setToast(ph === 2 ? `${nm} mute !` : `${nm} : enragé${z.ty === 'queen' || z.ty === 'mother' || z.ty === 'abomination' ? 'e' : ''} !`, 2.2, 'bad');
    }
  }

  // Mère des Cracheurs : garde ses distances, pond des larves et fait pleuvoir l'acide
  motherAI(z, T, dt, dist, dx, dy) {
    this.bossPhase(z);
    const fast = z.phase >= 2 ? 0.65 : 1;
    if (z.cdA <= 0) {
      z.cdA = 7.5 * fast;
      const n = this.zombies.length > 22 ? 0 : 1 + z.phase;
      for (let k = 0; k < n; k++) this.pending.push({ ty: 'larva', x: z.x + Math.cos(k * 1.7) * 40, y: z.y + Math.sin(k * 1.7) * 40, t: 0.35 + k * 0.08 });
      if (z.phase === 3) this.pending.push({ ty: 'spitter', x: z.x, y: z.y + 30, t: 0.6 });
      this.ev({ e: 'birth', x: Math.round(z.x), y: Math.round(z.y) });
    }
    if (z.cdC <= 0) { z.cdC = 5.5 * fast; const st = this.standing(); if (st.length) this.spit(z, this.rng.pick(st), z.phase === 3 ? 3 : 2); }
    if (Math.random() < dt * 0.2) this.addHazard('acid', z.x, z.y, 45, 3.5);
    if (!T) return false;
    z.curSpeed = z.spd;
    if (dist < 280) { z.curWant = { x: -dx / dist, y: -dy / dist }; return true; }
    if (dist < 460 && z.los) { const s2 = z.id % 2 ? 1 : -1; z.curWant = { x: (-dy / dist) * s2, y: (dx / dist) * s2 }; z.curSpeed = z.spd * 0.7; return true; }
    return false;
  }

  // Reine : rapide, disparaît et réapparaît ailleurs avec sa nuée, plaque au sol à partir de la phase 2
  queenAI(z, T, dt, dist, dx, dy) {
    this.bossPhase(z);
    if (['crouch', 'leap', 'pin', 'stun'].includes(z.state)) return this.stalkerAI(z, T, dt, dist, dx, dy);
    if (z.state === 'vanish') {
      z.stT -= dt; z.curSpeed = 0; z.curWant = null; z.vx = z.vy = 0;
      if (z.stT <= 0) {
        const far = this.lv.vents.filter((v) => !this.standing().some((p) => Math.hypot(p.x - v.sx, p.y - v.sy) < 300));
        const v = this.rng.pick(far.length ? far : this.lv.vents);
        z.x = v.sx; z.y = v.sy; z.state = 'walk'; z.cdA = (z.phase === 3 ? 7 : 10);
        for (let k = 0; k < 3 + z.phase; k++) this.pending.push({ ty: k < z.phase ? 'runner' : 'larva', x: v.sx + (Math.random() - 0.5) * 50, y: v.sy + (Math.random() - 0.5) * 50, t: 0.2 + k * 0.06 });
        this.ev({ e: 'screech', x: Math.round(z.x), y: Math.round(z.y) });
      }
      return true;
    }
    if (z.cdA <= 0) { z.state = 'vanish'; z.stT = 2; this.ev({ e: 'vanish', x: Math.round(z.x), y: Math.round(z.y) }); return true; }
    if (!T) return false;
    if (z.cdC <= 0) { z.cdC = 3.2; this.spit(z, T, z.phase); }
    if (z.phase >= 2 && z.cdB <= 0 && z.los && dist < 460 && dist > 120) { z.cdB = z.phase === 3 ? 6.5 : 8.5; z.state = 'crouch'; z.stT = 0.55; z.lockA = Math.atan2(dy, dx); return true; }
    if (z.los && dist < 320) { const s2 = z.id % 2 ? 1 : -1; z.curWant = { x: (-dy / dist) * s2 + (dx / dist) * 0.2, y: (dx / dist) * s2 + (dy / dist) * 0.2 }; z.curSpeed = z.spd; return true; }
    return false;
  }

  throwRock(z, T, n) {
    for (let k = 0; k < n; k++) {
      const tx = T.x + T.vx * 0.6 + (Math.random() - 0.5) * 140, ty = T.y + T.vy * 0.6 + (Math.random() - 0.5) * 140;
      const d = Math.hypot(tx - z.x, ty - z.y), dur = clamp(d / 380, 0.6, 1.4);
      this.eprojs.push({ id: this.nid++, k: 'rock', x: z.x, y: z.y, sx: z.x, sy: z.y, tx, ty, t: 0, dur, big: true });
    }
    this.ev({ e: 'throwRock', x: Math.round(z.x), y: Math.round(z.y) });
  }

  spit(z, T, n) {
    for (let k = 0; k < n; k++) {
      const lead = 0.5;
      const tx = T.x + T.vx * lead + (n > 1 ? (k - (n - 1) / 2) * 70 : 0) + (Math.random() - 0.5) * 30;
      const ty = T.y + T.vy * lead + (Math.random() - 0.5) * 30;
      const d = Math.hypot(tx - z.x, ty - z.y), dur = clamp(d / 420, 0.45, 1.3);
      this.eprojs.push({ id: this.nid++, k: 'acid', x: z.x, y: z.y, sx: z.x, sy: z.y, tx, ty, t: 0, dur, big: isBig(z.ty) });
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
      if (e.k === 'rock') {
        const f = Math.min(1, e.t / e.dur);
        e.x = e.sx + (e.tx - e.sx) * f; e.y = e.sy + (e.ty - e.sy) * f; e.h = Math.sin(f * Math.PI) * 140;
        if (f >= 1) {
          for (const p of this.players.values()) if (p.state === 'ok' && Math.hypot(p.x - e.tx, p.y - e.ty) < 70) this.hurtPlayer(p, 24 * this.diff.zDmg, e.tx, e.ty, 300);
          this.ev({ e: 'slam', x: Math.round(e.tx), y: Math.round(e.ty), r: 70 });
          continue;
        }
      } else if (e.k === 'acid') {
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
        bl: r1(p.bleed), rv: r2(p.reviveP), rg: p.reviving, d: p.dashT > 0 ? 1 : 0, dc: p.dashCharges, dm: dashMaxOf(p), dcd: r2(p.dashCd),
        w: p.weapons.map((w) => [WEAPON_IDS.indexOf(w.id), w.mag, w.res === Infinity ? -1 : w.res]), sl: p.slot,
        rl: p.reloadT > 0 ? r2(1 - p.reloadT / (p.reloadDur || 1)) : 0, sp: r2(p.spin), g: p.grenades, gm: nadeMax(p),
        bd: p.build || 0, cl: CLASS_IDS.indexOf(p.cls), ab: [r2(Math.max(0, p.abCd) / CLASSES[p.cls].cd), r2(p.abT)], pn: p.pinnedBy != null ? 1 : 0,
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
      if (z.state === 'vanish') fl |= 8192;
      if (z.state === 'pin') fl |= 2048; if (z.state === 'crouch' || z.state === 'leap') fl |= 4096;
      return [z.id, ZOMBIE_IDS.indexOf(z.ty), r1(z.x), r1(z.y), r2(z.ang), Math.max(0, Math.round((z.hp / z.maxHp) * 1000)), fl, r2(z.lockA), z.phase, r1(z.vx), r1(z.vy)];
    });
    const O = this.eprojs.map((e) => [e.id, e.k === 'acid' ? 0 : e.k === 'rock' ? 2 : 1, r1(e.x), r1(e.y), r1(e.h || 0), e.big ? 1 : 0, r1(e.tx ?? e.x), r1(e.ty ?? e.y), r2(e.k === 'nade' ? e.t / e.fuse : e.t / e.dur)]);
    const K = this.pickups.map((k) => [k.id, k.k, r1(k.x), r1(k.y), k.k === 'note' ? k.n : k.w || 0]);
    const T = this.turrets.map((t) => [t.id, r1(t.x), r1(t.y), r2(t.a), r2(t.t / t.dur), t.color]);
    const A = this.hazards.map((h) => [h.id, h.k, r1(h.x), r1(h.y), r1(h.r), r2(h.t / h.dur)]);
    const W = this.wave;
    const boss = this.zombies.find((z) => isBig(z.ty));
    return {
      ph: this.phase, t: r2(this.t), rm: { i: this.room.index, ty: this.room.type, sd: this.room.seed, ex: this.room.exits, mode: this.cfg.mode, sec: this.cfg.sector },
      P, Z, O, K, A, T, D: [...this.destroyed], op: this.doorsOpen ? 1 : 0, cl: this.cleared ? 1 : 0,
      rl: this.rally ? { d: this.rally.door, t: r2(this.rally.t), a: this.rally.all ? 1 : 0 } : null,
      wv: { n: W.n, tot: W.total === Infinity ? -1 : W.total, bt: W.budget <= 0 && !this.zombies.length && !this.pending.length && W.n < W.total ? Math.ceil(W.timer) : 0, left: this.zombies.length + this.pending.length + Math.ceil(Math.max(0, W.budget)) },
      sc: this.score, k: this.kills, rc: this.roomsCleared, ts: this.toast && this.toast.until > this.t ? this.toast : null,
      bs: boss ? Math.round((boss.hp / boss.maxHp) * 1000) : -1, bn: boss ? ZOMBIES[boss.ty].name : '',
      in: Math.round(this.intro * 100) / 100, sv: [...this.players.values()].filter((p) => p.skip && !p.bot).map((p) => p.id),
      bs2: this.base ? { g: [Math.ceil(this.base.gen.hp), this.base.gen.max], b: this.base.bars.map((b) => [b.id, Math.ceil(b.hp), b.max]), p: this.base.pads.map((q) => [q.id, Math.round(q.x), Math.round(q.y), q.trap ? q.trap.k : 0, q.trap ? q.trap.n || q.trap.waves : 0]) } : null,
      scr: this.scrap, tr: this.train ? [this.train.st, Math.round(this.train.x), this.train.dir, Math.round(this.train.t * 10) / 10] : null, ca: [...this.cars], dk: this.dark || (this.evt && this.evt.k === 'blackout') ? 1 : 0,
      sh: this.shop.map((it) => [it.id, it.k, Math.round(it.x), Math.round(it.y), it.w || 0, it.price, it.sold ? 1 : 0]),
      vt: this.vault ? [Math.round(this.vault.x), Math.round(this.vault.y), this.vault.st, Math.round(this.vault.prog * 100) / 100] : null,
      ev: this.evt && this.evt.k === 'drop' ? [this.evt.st, this.evt.x, this.evt.y, Math.round(this.evt.prog * 100) / 100, Math.round(this.evt.t * 10) / 10] : null, cfg: { d: this.cfg.difficulty, sw: this.cfg.startWeapon, seed: this.cfg.seed },
    };
  }

  // Nouvel hôte : reprendre la partie à partir du dernier état reçu (la salle en cours redémarre proprement)
  static restore(snap, cfg) {
    const sim = new Sim({ mode: snap.rm.mode, difficulty: snap.cfg.d, startWeapon: snap.cfg.sw, seed: snap.cfg.seed, sector: snap.rm.sec, ...cfg });
    sim.score = snap.sc; sim.kills = snap.k; sim.roomsCleared = snap.rc; sim.scrap = snap.scr || 0;
    for (const q of snap.P) {
      const p = sim.addPlayer({ id: q.i, name: q.n, color: q.c, bot: !!q.b, cls: CLASS_IDS[q.cl] || 'soldier' });
      p.maxHp = q.H; p.hp = Math.max(1, q.h); p.maxArmor = q.R; p.armor = q.r; p.state = q.s === 0 ? 'ok' : q.s === 1 ? 'down' : 'dead';
      if (p.state === 'down') { p.state = 'ok'; p.hp = 30; }
      p.weapons = q.w.map(([wi, mag, res]) => ({ id: WEAPON_IDS[wi], mag, res: res < 0 ? Infinity : res }));
      p.slot = Math.min(q.sl, p.weapons.length - 1); p.grenades = q.g; p.perks = { ...(q.pk || {}) };
      p.stats = { kills: q.st[0], score: q.st[1], revives: q.st[2], downs: q.st[3], dmg: q.st[4] };
      p.adrenaline = q.ad ?? p.adrenaline;
    }
    sim.startRoom(snap.rm.ty, snap.rm.i);
    if (snap.rm.mode !== 'campaign') { sim.wave.n = Math.max(0, snap.wv.n - 1); sim.wave.rewarded = sim.wave.n; sim.wave.timer = 5; }
    if (sim.base && snap.bs2) { sim.base.gen.hp = Math.max(1, snap.bs2.g[0]); for (const [id, hp] of snap.bs2.b) { const b = sim.base.bars.find((x) => x.id === id); if (b) b.hp = hp; } }
    return sim;
  }
}

// ------------------------------------------------------------------ utilitaires
function blankInput() { return { mx: 0, my: 0, a: -Math.PI / 2, fire: false, dash: 0, reload: 0, sw: 0, sl: 0, nade: 0, td: 300, use: false, pk: 0, pi: -1, q: 0 }; }
export function lvl(p, id) { return (p && p.perks && p.perks[id]) || 0; }
export function magSize(p, W) { return Math.round(W.mag * (1 + 0.35 * lvl(p, 'mag'))); }
export function resMax(p, W) { return W.resMax === Infinity ? Infinity : Math.round(W.resMax * (1 + 0.5 * lvl(p, 'ammo')) * (p && p.cls === 'engineer' ? 1.25 : 1)); }
export function nadeMax(p) { return GRENADE.max + lvl(p, 'nade') + (p && p.cls === 'soldier' ? 1 : 0); }
export function dashMaxOf(p) { return 1 + lvl(p, 'dash') + (p && p.cls === 'scout' ? 1 : 0); }
export function classSpeed(p) { return p.cls === 'tank' ? 0.92 : p.cls === 'scout' ? (p.abT > 0 ? 1.4 * 1.08 : 1.08) : 1; }
function mkWeapon(id, p) { const W = WEAPONS[id]; return { id, mag: p ? magSize(p, W) : W.mag, res: W.res }; }
function nPlayers(sim) { return sim.players.size; }
function botPerkChoice(p) {
  const pref = ['dmg', 'rate', 'hp', 'vamp', 'crit', 'pierce', 'medic', 'regen', 'second', 'armor', 'reload', 'mag'];
  for (const id of pref) if (p.offers.includes(id)) return id;
  return p.offers[0];
}
export { blankInput };
