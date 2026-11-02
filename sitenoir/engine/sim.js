// Site Noir : le moteur, sans DOM ni réseau. L'hôte le fait tourner à 60 Hz ; les invités rejouent seulement movePlayer pour anticiper leur propre pas.
// Les enquêteurs entrent par le sas, trouvent le badge bleu (aile A) puis la clé de la salle des machines (aile B), relancent le générateur,
// appellent l'ascenseur et remontent à la zone d'extraction avec au moins une preuve. Le monstre gagne si personne n'en sort.
// L'état se divise en deux : `w` (portes, objets, générateur… JSON, envoyé quand il change) et une ligne par joueur (position, envoyée 20 fois par seconde).
import { makeRng } from './rng.js';
import { buildMap, T, Z, DEEP, CEIL, floorAt, zoneAt, hasLOS, W } from './map.js';
import { updateBots } from './bots.js';

export const DT = 1 / 60;
export const SPEED = { walk: 3.0, run: 4.7, crouch: 1.5, crawl: 0.55, mWalk: 3.8, mSprint: 5.9 };
export const R_BODY = 0.3;
export const WAKE_T = 90;          // le monstre reste en cage au début
export const SLOTS = 3;            // cases libres en plus de la lampe
export const MAX_CAMS = 4;
export const CD = { atk: 1.5, lights: 40, jam: 18, cam: 8, smash: 35 };
export const LIGHTS_OFF_T = 25, JAM_T = 10, BLEED_T = 45, RECOVER_T = 35, REVIVE_T = 4, FINISH_T = 1.4, CACHE_T = 4, SMASH_T = 2.5, SMASH_LOSS = 15, FUSES = 3, SCAN_T = 3, AUDIO_T = 4, STUN_T = 1.7, STUN_IMMUNE = 18;
export const SATED_T = 70, HIT_DMG = 34;   // après une mise à terre, le monstre ne peut plus frapper pendant un moment
export const GEN_T = 170;          // secondes pour un seul enquêteur
export const LIFT = { firstDown: 40, down: 12, up: 7, go: 3 };
export const REACH = 2.2;
export const ITEMS = {
  photo: { name: 'Appareil photo', icon: '📷', n: 6, use: 'Photographier : une preuve et un éclair qui sonne le monstre' },
  emf: { name: 'Capteur EMF', icon: '📡', n: 1, use: 'Maintiens le clic sur une trace ou près du monstre pour l\'enregistrer' },
  cams: { name: 'Caméras', icon: '🎥', n: 2, use: 'Pose une caméra sur le mur devant toi' },
  tablet: { name: 'Tablette', icon: '📱', n: 1, use: 'Regarde les caméras posées' },
  pile: { name: 'Pile', icon: '🔋', n: 1, use: 'Recharge ta lampe', max: 3 },
  fuse: { name: 'Fusible', icon: '🔌', n: 1, use: 'À brancher sur le générateur', max: 3 },
  bleu: { name: 'Badge bleu', icon: '🟦', n: 1, use: 'Ouvre le sas de l\'aile B' },
  orange: { name: 'Clé des machines', icon: '🗝️', n: 1, use: 'Ouvre l\'accès au sous-sol' },
};
const KEY_NAME = { bleu: 'le badge bleu', orange: 'la clé de la salle des machines' };
// bits de l'état rapide d'un joueur
export const FL = { RUN: 1, CROUCH: 2, TORCH: 4, DOWN: 8, DEAD: 16, OUT: 32, HIDE: 64, ATK: 128, STUN: 256, WORK: 512, CAGE: 1024, SPRINT: 2048, MOVE: 4096, HALT: 8192, SLOW: 16384, RUSH: 32768 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const emptyInput = () => ({ mx: 0, my: 0, yaw: 0, pitch: 0, run: false, crouch: false, use: false, fire: false, sel: 0, uc: 0, fc: 0, dc: 0, tc: 0, rc: 0, a1: 0, a2: 0, a3: 0, q: 0 });
export const standing = (p) => p.st === 'ok';
export const inPlay = (p) => p.st === 'ok' || p.st === 'down';

// ------------------------------------------------------------------ déplacement (partagé avec la prédiction des invités)
export function cellSolid(M, w, p, i) {
  const t = M.t[i];
  if (t !== T.FLOOR) return true;
  const d = M.doorAt[i];
  if (p.role === 'm') {
    const z = M.zone[i];
    if (z === Z.OUTPOST || z === Z.PAD || z === Z.CABINE || d === M.liftBottom || d === M.liftTop) return true;
  }
  return d >= 0 && !w.doors[d].open;
}
const hitsCell = (M, w, p, x, z) => {
  const r = R_BODY, x0 = Math.floor(x - r), x1 = Math.floor(x + r), z0 = Math.floor(z - r), z1 = Math.floor(z + r);
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) if (cellSolid(M, w, p, cz * W + cx)) return true;
  return false;
};
export function speedOf(p, run) {
  if (p.role === 'm') {
    let v = run && p.energy > 0.02 ? SPEED.mSprint : SPEED.mWalk;
    if (p.slow > 0) v *= 0.45;
    return v * (p.mul || 1);
  }
  if (p.st === 'down') return SPEED.crawl;
  if (p.crouch) return SPEED.crouch * (p.mul || 1);
  // touché : l'adrénaline donne une seconde et demie pour décrocher
  return (run && p.stam > 0.5 ? SPEED.run : SPEED.walk) * (p.mul || 1) * (p.inv0 > 0 ? 1.35 : 1);
}
export function canMove(p) { return (p.st === 'ok' || p.st === 'down') && p.hide < 0 && !(p.stun > 0) && !(p.wake > 0) && !(p.stall > 0); }
export function movePlayer(M, w, p, inp, dt) {
  p.yaw = inp.yaw; p.pitch = inp.pitch;
  p.crouch = !!inp.crouch && p.role !== 'm' && p.st === 'ok';
  const moving = canMove(p) && (inp.mx || inp.my);
  const wantRun = !!inp.run && !p.crouch && moving && inp.my > 0.1;
  p.run = wantRun && (p.role === 'm' ? p.energy > 0.02 : p.stam > 0.5) && p.st === 'ok';
  if (p.role === 'm') p.energy = clamp(p.energy + (p.run ? -dt / 3.5 : dt / 11), 0, 1);
  else p.stam = clamp(p.stam + (p.run ? -100 * dt / 6.5 : 100 * dt / 11), 0, 100);
  p.moving = false;
  if (moving) {
    const v = speedOf(p, wantRun), s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    let l = Math.hypot(inp.mx, inp.my); if (l < 1) l = 1;
    const fx = inp.mx / l, fy = inp.my / l;
    const dx = (fx * c - fy * s) * v * dt, dz = (-fx * s - fy * c) * v * dt;
    const ox = p.x, oz = p.z;
    if (!hitsCell(M, w, p, p.x + dx, p.z)) p.x += dx;
    if (!hitsCell(M, w, p, p.x, p.z + dz)) p.z += dz;
    p.moving = Math.hypot(p.x - ox, p.z - oz) > 0.1 * v * dt;
    p.stepAcc = (p.stepAcc || 0) + Math.hypot(p.x - ox, p.z - oz);
  }
  p.y = floorAt(M, p.x, p.z, w.lift.y);
}

// ------------------------------------------------------------------ ce que le joueur peut utiliser devant lui (sert à l'invite affichée chez le client et au moteur)
export function interactTarget(M, w, players, p) {
  if (!p || p.st !== 'ok') return null;
  if (p.hide >= 0) return { kind: 'unhide', id: p.hide, label: 'Sortir du casier' };
  if (p.wake > 0 || p.stun > 0) return null;
  const forced = p.botTarget, isM = p.role === 'm';
  const fwdYaw = p.yaw;
  let best = null, bestS = 1e9;
  const consider = (o, x, z, reach = REACH, noLos = false, anyAngle = false) => {
    if (forced && (forced.kind !== o.kind || forced.id !== o.id)) return;
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d > reach) return;
    const ang = d < 0.5 ? 0 : Math.abs(angDiff(Math.atan2(-dx, -dz), fwdYaw));
    if (!forced && !anyAngle && ang > 1.05) return;
    if (!noLos && !hasLOS(M, w.doors, p.x, p.z, x, z)) return;
    const s = d + ang * 1.6;
    if (s < bestS) { bestS = s; best = o; }
  };
  for (const q of players) {
    if (q === p || q.st !== 'down') continue;
    if (Math.abs(q.y - p.y) > 2) continue;
    if (isM) { if (q.downs >= 2) consider({ kind: 'finish', id: q.id, label: `Achever ${q.name}`, hold: FINISH_T }, q.x, q.z); }
    else if (q.role !== 'm') consider({ kind: 'revive', id: q.id, label: `Relever ${q.name}`, hold: REVIVE_T }, q.x, q.z);
  }
  M.lockers.forEach((l) => { if (Math.abs(l.y - p.y) < 2) consider(isM ? { kind: 'search', id: l.id, label: 'Fouiller le casier' } : { kind: 'hide', id: l.id, label: 'Se cacher' }, l.x, l.z, 2, true); });
  M.doors.forEach((d) => {
    const st = w.doors[d.id];
    if (d.kind === 'lift' || Math.abs(d.y - p.y) > 2.2) return;
    if (isM) {
      if (d.key === null && d.kind === 'sas') { consider({ kind: 'door', id: d.id, label: 'Les projecteurs te repoussent', ok: false }, d.x, d.z, REACH, true); return; }
      consider({ kind: 'door', id: d.id, label: st.open ? 'Fermer' : 'Ouvrir', ok: true }, d.x, d.z, REACH, true);
      return;
    }
    if (st.jam > 0) { consider({ kind: 'door', id: d.id, label: 'La porte est bloquée !', ok: false }, d.x, d.z, REACH, true); return; }
    if (d.key && !st.unlocked) {
      const has = p.inv.some((s) => s && s.k === d.key);
      consider({ kind: 'door', id: d.id, label: has ? `Déverrouiller : ${d.name}` : `Verrouillé : il faut ${KEY_NAME[d.key]}`, ok: has }, d.x, d.z, REACH, true);
      return;
    }
    consider({ kind: 'door', id: d.id, label: `${st.open ? 'Fermer' : 'Ouvrir'} : ${d.name}`, ok: true }, d.x, d.z, REACH, true);
  });
  if (isM && Math.abs(DEEP - p.y) < 2 && w.gen > 0 && !w.genOn && p.cd.smash <= 0) consider({ kind: 'smash', id: 0, label: `Saboter le générateur · ${Math.floor(w.gen)} %`, hold: SMASH_T }, M.generator.panel.x, M.generator.panel.z, 2.8, true);
  if (!isM) {
    for (const it of w.items) {
      if (it.gone || Math.abs((it.y ?? 0) - p.y) > 2.2) continue;
      const def = ITEMS[it.k];
      const label = it.k === 'preuve' ? `Ramasser ${it.n > 1 ? `${it.n} preuves` : 'la preuve'}` : `${it.stock ? 'Prendre' : 'Ramasser'} : ${def.name}${it.stock ? ` (${it.n})` : ''}`;
      consider({ kind: 'item', id: it.id, label }, it.x, it.z);
    }
    for (const c of M.caches) if (!w.caches[c.id].done && Math.abs(c.y - p.y) < 2.2) consider({ kind: 'cache', id: c.id, label: `Fouiller : ${c.label}`, hold: CACHE_T }, c.x, c.z, 1.9, true);
    const g = M.generator.panel;
    if (Math.abs(DEEP - p.y) < 2 && w.gen < 100) {
      if (w.parts < FUSES) { const has = p.inv.some((s) => s && s.k === 'fuse'); consider({ kind: 'fuse', id: 0, label: has ? `Brancher un fusible (${w.parts}/${FUSES})` : `Générateur : il manque des fusibles (${w.parts}/${FUSES})`, ok: has }, g.x, g.z, 2.6, true); }
      else consider({ kind: 'gen', id: 0, label: `Réparer le générateur · ${Math.floor(w.gen)} %`, hold: Infinity }, g.x, g.z, 2.6, true);
    }
    const c = M.liftCall;
    if (Math.abs(c.y - p.y) < 2) {
      const L = w.lift;
      const label = !w.genOn ? 'Pas de courant : relancez le générateur' : L.state === 'moving' ? 'L\'ascenseur arrive…' : L.at === 'bottom' ? 'L\'ascenseur est là' : 'Appeler l\'ascenseur';
      consider({ kind: 'call', id: 0, label, ok: w.genOn && L.state === 'idle' && L.at === 'top' }, c.x, c.z, 2.4, true);
    }
    const g2 = M.liftGo;
    if (p.x > M.cabin.x0 && p.x < M.cabin.x1 && p.z > M.cabin.z0 && p.z < M.cabin.z1 - 1) {
      const L = w.lift;
      consider({ kind: 'go', id: 0, label: L.state === 'moving' ? 'En route…' : L.go > 0 ? 'Fermeture des portes…' : L.at === 'bottom' ? 'Monter à la surface' : 'Redescendre', ok: L.state === 'idle' && !(L.go > 0) && w.genOn }, g2.x, g2.z, 4, true, true);
    }
    consider({ kind: 'monitor', id: 0, label: 'Regarder les écrans' }, M.monitor.x, M.monitor.z, 2.2, true);
  }
  return best;
}

// ------------------------------------------------------------------ la partie
export class Sim {
  constructor(opts = {}) {
    this.seed = (opts.seed ?? 1) >>> 0;
    this.rng = makeRng(this.seed);
    this.M = opts.map || buildMap();
    this.level = opts.level || 'normal';
    this.players = [];
    this.byId = new Map();
    this.ev = [];
    this.noises = [];
    this.dirty = true;
    this.mem = null; // mémoire commune des bots (bots.js)
    const M = this.M, dur = opts.duration || 900;
    this.w = {
      v: 0, t: 0, tl: dur, dur, ph: 'play', win: null, end: '', gen: 0, genOn: false, parts: 0, partsNeed: FUSES, banked: 0, caches: M.caches.map(() => ({ done: false, loot: null })), seed: this.seed, nid: 1, level: this.level,
      doors: M.doors.map((d) => ({ open: d.startOpen, unlocked: !d.key, jam: 0 })),
      items: [], cams: [], traces: [], dark: {},
      lift: { y: 0, state: 'idle', at: 'top', go: 0, dir: 0, dur: LIFT.firstDown, calls: 0 },
    };
    this.spawnWorld();
  }

  spawnWorld() {
    const { M, w, rng } = this;
    const item = (k, x, z, n, stock) => { const it = { id: w.nid++, k, x, z, y: floorAt(M, x, z, DEEP) + (M.t[Math.floor(z) * W + Math.floor(x)] === T.PROP ? 0.95 : 0.03), n: n ?? ITEMS[k].n }; if (stock) it.stock = 1; w.items.push(it); return it; };
    for (const c of M.crates) { const it = item(c.k, c.x, c.z, c.n, true); it.y = 0.9; }
    const pickAt = (list) => { const [x, z] = rng.pick(list); return [x + 0.5, z + 0.5]; };
    // dans les meubles : le badge en aile A, la clé en aile B, un fusible par zone et un de secours en aile B
    const inZone = (z) => rng.shuffle(M.caches.filter((c) => c.zone === z));
    const a = inZone(Z.A), b = inZone(Z.B), u = inZone(Z.SOUS);
    w.caches[a[0].id].loot = 'bleu'; w.caches[b[0].id].loot = 'orange';
    w.caches[a[1].id].loot = 'fuse'; w.caches[b[1].id].loot = 'fuse'; w.caches[b[2].id].loot = 'fuse'; w.caches[u[0].id].loot = 'fuse';
    for (const c of [a[2], b[3], u[1]]) w.caches[c.id].loot = 'pile';
    for (const [x, z] of rng.shuffle([...M.spots.pile]).slice(0, 9)) item('pile', x + 0.5, z + 0.5);
    // traces : au moins une par zone, et cinq en tout
    const byZone = {};
    for (const s of M.spots.trace) (byZone[s[2]] ||= []).push(s);
    const chosen = new Set(Object.values(byZone).map((l) => rng.pick(l)));
    for (const s of rng.shuffle([...M.spots.trace])) if (chosen.size < 5) chosen.add(s);
    for (const [x, z, zone] of chosen) w.traces.push({ id: w.nid++, x: x + 0.5, z: z + 0.5, y: floorAt(M, x + 0.5, z + 0.5, DEEP), zone, done: false });
  }

  addPlayer({ id, name, color, bot = false, role = 's', level, spectator = false }) {
    const { M } = this, sp = M.spawns.surv[this.players.filter((p) => p.role === 's').length % M.spawns.surv.length];
    const p = {
      id, name, color, bot, role, level: level || this.level, spectator,
      x: role === 'm' ? M.spawns.monster.x : sp[0] + 0.5, z: role === 'm' ? M.spawns.monster.z : sp[1] + 0.5, y: 0,
      yaw: role === 'm' ? Math.PI / 2 : 0, pitch: 0, hp: 100, stam: 100, batt: 100, torch: role === 's', crouch: false, run: false, moving: false,
      st: spectator ? 'dead' : 'ok', hide: -1, inv: [null, null, null], sel: 0, proofs: 0, audio: false, kills: 0, downT: 0, inv0: 0,
      energy: 1, sated: 0, stun: 0, immune: 0, slow: 0, stall: 0, atkT: 0, wake: role === 'm' ? WAKE_T : 0, cd: { atk: 0, lights: 0, jam: 0, cam: 0, smash: 0 }, hold: null, holdFrac: 0, scan: 0, scanTrace: 0, audioT: 0, flashCd: 0, stepAcc: 0, inp: emptyInput(), prevC: emptyInput(), ack: 0, escaped: false,
    };
    p.y = floorAt(M, p.x, p.z, this.w.lift.y);
    p.inp.yaw = p.yaw;
    if (role === 'm') this.w.monster = id;
    this.players.push(p); this.byId.set(id, p);
    this.dirty = true;
    return p;
  }
  // un joueur parti : un bot prend sa place, la partie continue
  replaceByBot(id) { const p = this.byId.get(id); if (!p) return; if (p.spectator) { this.players.splice(this.players.indexOf(p), 1); this.byId.delete(id); } else { p.bot = true; p.name = p.name + ' 🤖'; p.ai = null; } this.dirty = true; }
  get monster() { return this.byId.get(this.w.monster); }

  setInput(id, inp) { const p = this.byId.get(id); if (p && !p.bot) p.inp = inp; }
  emit(e) { this.ev.push(e); }
  drainEvents() { const e = this.ev; this.ev = []; return e; }
  touch() { this.dirty = true; }
  noise(x, z, r, by = -1) { this.noises.push({ x, z, r, t: this.w.t, by }); if (r >= 5) this.emit({ e: 'n', x: +x.toFixed(1), z: +z.toFixed(1), r }); }

  // ---------------------------------------------------------------- objets
  hasItem(p, k) { return p.inv.some((s) => s && s.k === k); }
  giveItem(p, k, n) {
    const def = ITEMS[k];
    if (def.max) { const s = p.inv.find((q) => q && q.k === k && q.n < def.max); if (s) { s.n += n; return true; } }
    let i = p.inv.indexOf(null);
    if (i < 0) { this.dropSlot(p, p.sel); i = p.inv.indexOf(null); }
    p.inv[i] = { k, n };
    return true;
  }
  dropItem(k, n, x, z) {
    const { w, M } = this;
    const it = { id: w.nid++, k, n, x, z, y: floorAt(M, x, z, w.lift.y) + 0.03 };
    w.items.push(it); this.touch();
    return it;
  }
  dropSlot(p, i) {
    const s = p.inv[i]; if (!s) return;
    p.inv[i] = null;
    this.dropItem(s.k, s.n, p.x, p.z);
    this.emit({ e: 'drop', id: p.id });
  }
  dropAll(p) {
    for (let i = 0; i < p.inv.length; i++) this.dropSlot(p, i);
    if (p.proofs > 0) { this.dropItem('preuve', p.proofs, p.x + 0.2, p.z); p.proofs = 0; }
  }
  useItem(p, it) {
    const { w } = this;
    if (it.k === 'preuve') { p.proofs += it.n; it.gone = true; this.emit({ e: 'proofpick', id: p.id, n: it.n }); }
    else if (it.stock) {
      if (it.n <= 0) return;
      if (it.k === 'pile' || !this.hasItem(p, it.k)) { it.n--; this.giveItem(p, it.k, it.k === 'pile' ? 1 : ITEMS[it.k].n); this.emit({ e: 'pick', id: p.id, k: it.k, x: it.x, z: it.z }); }
      else { this.emit({ e: 'info', id: p.id, msg: `Tu as déjà : ${ITEMS[it.k].name}` }); return; }
      if (it.n <= 0) it.gone = true;
    } else {
      this.giveItem(p, it.k, it.n); it.gone = true;
      this.emit({ e: 'pick', id: p.id, k: it.k, x: it.x, z: it.z });
    }
    w.items = w.items.filter((q) => !q.gone);
    this.touch();
  }

  // ---------------------------------------------------------------- portes
  setDoor(d, open, who) {
    const st = this.w.doors[d];
    if (st.open === open) return;
    if (!open && this.players.some((q) => inPlay(q) && this.M.doors[d].cells.some((i) => this.overlapsCell(q, i)))) return;
    st.open = open;
    this.touch();
    const D = this.M.doors[d];
    this.emit({ e: 'door', id: d, open, x: D.x, z: D.z, y: D.y });
    this.noise(D.x, D.z, 9, who ?? -1);
  }
  overlapsCell(q, i) { const cx = i % W, cz = (i / W) | 0, r = R_BODY + 0.02; return q.x + r > cx && q.x - r < cx + 1 && q.z + r > cz && q.z - r < cz + 1; }

  // ---------------------------------------------------------------- utiliser (appui)
  usePress(p) {
    const { M, w } = this;
    const tg = interactTarget(M, w, this.players, p);
    if (!tg || tg.hold) return;
    switch (tg.kind) {
      case 'unhide': { const l = M.lockers[p.hide]; p.hide = -1; p.x = l.fx; p.z = l.fz; this.touch(); this.emit({ e: 'locker', id: p.id, x: l.x, z: l.z, y: l.y }); break; }
      case 'hide': { const l = M.lockers[tg.id]; if (this.players.some((q) => q.hide === l.id)) { this.emit({ e: 'info', id: p.id, msg: 'Quelqu\'un s\'y cache déjà' }); break; } p.hide = l.id; p.hideT = 0; p.x = l.x; p.z = l.z; p.torch = false; this.touch(); this.emit({ e: 'locker', id: p.id, x: l.x, z: l.z, y: l.y }); break; }
      case 'search': {
        const l = M.lockers[tg.id], q = this.players.find((o) => o.hide === l.id);
        this.emit({ e: 'bang', x: l.x, z: l.z, y: l.y });
        this.noise(l.x, l.z, 12, p.id);
        if (q) { q.hide = -1; q.x = l.fx; q.z = l.fz; this.knockDown(q, p); p.stall = 0.8; this.emit({ e: 'found', id: q.id, by: p.id }); }
        else p.stall = 1.4;
        break;
      }
      case 'door': {
        const D = M.doors[tg.id], st = w.doors[tg.id];
        if (tg.ok === false) { this.emit({ e: 'deny', id: p.id, x: D.x, z: D.z, y: D.y }); break; }
        if (D.key && !st.unlocked && p.role === 's') { st.unlocked = true; this.emit({ e: 'unlock', id: tg.id, by: p.id, x: D.x, z: D.z, y: D.y }); this.setDoor(tg.id, true, p.id); break; }
        this.setDoor(tg.id, !st.open, p.id);
        if (p.role === 'm' && D.key && !st.unlocked && st.open) st.shutT = 2.6; // le monstre passe, le verrou retombe
        break;
      }
      case 'fuse': if (tg.ok) {
        const i = p.inv.findIndex((q) => q && q.k === 'fuse');
        p.inv[i].n--; if (p.inv[i].n <= 0) p.inv[i] = null;
        w.parts++; this.touch();
        this.emit({ e: 'fuse', id: p.id, n: w.parts, x: M.generator.x, z: M.generator.z });
        this.noise(M.generator.x, M.generator.z, 12, p.id);
      } break;
      case 'item': { const it = w.items.find((q) => q.id === tg.id); if (it) this.useItem(p, it); break; }
      case 'call': if (tg.ok) { w.lift.state = 'moving'; w.lift.dir = -1; w.lift.dur = w.lift.calls ? LIFT.down : LIFT.firstDown; w.lift.calls++; this.touch(); this.emit({ e: 'lift', k: 'call', by: p.id }); this.noise(M.liftCall.x, M.liftCall.z, 40, p.id); } break;
      case 'go': if (tg.ok) { w.lift.go = LIFT.go; this.touch(); this.emit({ e: 'lift', k: 'go', by: p.id }); } break;
      // 'monitor' ne change rien au monde : le client ouvre les écrans
    }
  }

  // ---------------------------------------------------------------- objet tenu (clic)
  firePress(p) {
    const { M, w } = this;
    if (p.role === 'm') { if (p.sated > 0) { this.emit({ e: 'info', id: p.id, msg: `Repu : encore ${Math.ceil(p.sated)} s avant de pouvoir frapper` }); return; } if (p.cd.atk <= 0 && p.atkT <= 0 && p.wake <= 0 && p.stun <= 0) { p.atkT = 0.28; p.cd.atk = CD.atk; this.emit({ e: 'swing', id: p.id, x: p.x, z: p.z, y: p.y }); } return; }
    if (p.st !== 'ok' || p.hide >= 0) return;
    const s = p.inv[p.sel]; if (!s) return;
    if (s.k === 'photo') {
      if (s.n <= 0) { this.emit({ e: 'info', id: p.id, msg: 'Plus de pellicule' }); return; }
      if (p.flashCd > 0) return;
      s.n--; p.flashCd = 1.4; this.touch();
      this.emit({ e: 'flash', id: p.id, x: p.x, y: p.y + 1.6, z: p.z, yaw: p.yaw });
      this.noise(p.x, p.z, 10, p.id);
      const m = this.monster;
      if (m && m.st === 'ok') {
        const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
        const ang = Math.abs(angDiff(Math.atan2(-dx, -dz), p.yaw));
        if (d < 18 && ang < 0.5 && Math.abs(m.y - p.y) < 2.5 && hasLOS(M, w.doors, p.x, p.z, m.x, m.z)) {
          if (!p.photoDone) { p.photoDone = true; this.addProof(p, 'photo'); }
          if (d < 12 && m.immune <= 0) { m.stun = STUN_T; m.immune = STUN_IMMUNE; m.atkT = 0; this.emit({ e: 'stun', by: p.id, x: m.x, z: m.z, y: m.y }); }
        }
      }
    } else if (s.k === 'cams') {
      if (w.cams.length >= MAX_CAMS) { this.emit({ e: 'info', id: p.id, msg: `${MAX_CAMS} caméras au plus` }); return; }
      // sur le mur devant soi, à moins de 2 m ; sinon au sol
      const sx = -Math.sin(p.yaw), sz = -Math.cos(p.yaw);
      let cx = p.x + sx * 0.5, cz = p.z + sz * 0.5, wall = false;
      for (let d = 0.2; d <= 2; d += 0.1) { const x = p.x + sx * d, z = p.z + sz * d, i = Math.floor(z) * W + Math.floor(x); if (M.t[i] === T.WALL) { wall = true; cx = p.x + sx * (d - 0.15); cz = p.z + sz * (d - 0.15); break; } }
      w.cams.push({ id: w.nid++, x: +cx.toFixed(2), z: +cz.toFixed(2), y: +(p.y + (wall ? 2.3 : 0.25)).toFixed(2), yaw: +(p.yaw + Math.PI).toFixed(3), wall, by: p.id });
      s.n--; if (s.n <= 0) p.inv[p.sel] = null;
      this.touch();
      this.emit({ e: 'cam', id: p.id, x: cx, z: cz, y: p.y });
    } else if (s.k === 'pile') this.reload(p);
  }
  reload(p) {
    const i = p.inv.findIndex((s) => s && s.k === 'pile');
    if (i < 0 || p.batt >= 99) return;
    p.batt = 100; p.inv[i].n--; if (p.inv[i].n <= 0) p.inv[i] = null;
    this.touch();
    this.emit({ e: 'reload', id: p.id });
  }
  addProof(p, kind) {
    p.proofs++; this.touch();
    this.emit({ e: 'proof', id: p.id, kind });
  }
  teamProofs() { return this.w.banked + this.players.reduce((a, p) => a + (p.role === 's' && p.st !== 'dead' && p.st !== 'out' ? p.proofs : 0), 0) + this.w.items.reduce((a, it) => a + (it.k === 'preuve' ? it.n : 0), 0); }

  // ---------------------------------------------------------------- pouvoirs du monstre
  ability(p, which) {
    const { M, w } = this;
    if (p.role !== 'm' || p.wake > 0 || p.stun > 0) return;
    if (which === 'lights' && p.cd.lights <= 0) {
      const z = zoneAt(M, p.x, p.z);
      if (z === Z.A || z === Z.B || z === Z.SOUS) { w.dark[z] = LIGHTS_OFF_T; p.cd.lights = CD.lights; this.touch(); this.emit({ e: 'dark', zone: z }); }
    } else if (which === 'jam' && p.cd.jam <= 0) {
      let best = -1, bs = 1e9;
      M.doors.forEach((d, i) => {
        if (d.kind === 'lift' || (d.kind === 'sas' && d.key === null)) return;
        const dd = Math.hypot(d.x - p.x, d.z - p.z), a = Math.abs(angDiff(Math.atan2(-(d.x - p.x), -(d.z - p.z)), p.yaw));
        if (dd > 7 || (dd > 2 && a > 0.8) || Math.abs(d.y - p.y) > 2.5) return;
        const s = dd + a * 2; if (s < bs) { bs = s; best = i; }
      });
      if (best < 0) { this.emit({ e: 'info', id: p.id, msg: 'Aucune porte à portée' }); return; }
      const st = w.doors[best], D = M.doors[best];
      if (this.players.some((q) => inPlay(q) && D.cells.some((i) => this.overlapsCell(q, i)))) { this.emit({ e: 'info', id: p.id, msg: 'Quelqu\'un est dans le passage' }); return; }
      if (st.open) { st.open = false; }
      st.jam = JAM_T; p.cd.jam = CD.jam; this.touch();
      this.emit({ e: 'jam', id: best, x: D.x, z: D.z, y: D.y });
    } else if (which === 'cam' && p.cd.cam <= 0) {
      let best = null, bs = 1e9;
      for (const c of w.cams) { const d = Math.hypot(c.x - p.x, c.z - p.z), a = Math.abs(angDiff(Math.atan2(-(c.x - p.x), -(c.z - p.z)), p.yaw)); if (d < 6 && a < 1.2 && Math.abs(c.y - p.y) < 4 && d + a < bs) { bs = d + a; best = c; } }
      if (!best) { this.emit({ e: 'info', id: p.id, msg: 'Aucune caméra à portée' }); return; }
      w.cams = w.cams.filter((c) => c !== best); p.cd.cam = CD.cam; this.touch();
      this.emit({ e: 'camdead', id: best.id, x: best.x, y: best.y, z: best.z });
    }
  }

  // ---------------------------------------------------------------- coups
  knockDown(q, by) {
    q.hp = 0; q.st = 'down'; q.downs = (q.downs || 0) + 1; q.downT = q.downs >= 2 ? BLEED_T : RECOVER_T; q.run = false; q.hold = null; q.holdFrac = 0; q.torch = false;
    if (by) { by.stall = 2.5; by.sated = SATED_T; } // il savoure, et les enquêteurs ont un répit
    this.touch();
    this.emit({ e: 'down', id: q.id, by: by ? by.id : -1, x: q.x, z: q.z, y: q.y });
    this.checkEnd();
  }
  hurt(q, by) {
    if (q.inv0 > 0) return;
    q.hp -= HIT_DMG;
    this.emit({ e: 'hit', id: q.id, x: q.x, z: q.z, y: q.y });
    if (q.hp <= 0) this.knockDown(q, by);
    else { q.inv0 = 1.2; this.touch(); }
  }
  kill(q, by) {
    if (q.st === 'dead' || q.st === 'out') return;
    q.st = 'dead'; q.hold = null; q.hide = -1;
    if (by) by.kills = (by.kills || 0) + 1;
    this.dropAll(q);
    this.touch();
    this.emit({ e: 'dead', id: q.id, by: by ? by.id : -1, x: q.x, z: q.z, y: q.y });
    this.checkEnd();
  }

  // ---------------------------------------------------------------- un pas de simulation
  step(dt = DT) {
    const { w, M } = this;
    if (w.ph === 'over') return;
    w.t += dt; w.tl -= dt;
    this.noises = this.noises.filter((n) => w.t - n.t < 1.5);
    updateBots(this, dt);
    for (const p of this.players) this.stepPlayer(p, dt);
    this.stepWorld(dt);
    if (w.tl <= 0) this.timeUp();
  }

  stepPlayer(p, dt) {
    const { M, w } = this, inp = p.inp, pc = p.prevC;
    p.ack = inp.q || 0;
    if (p.spectator) return;
    if (p.st === 'dead' || p.st === 'out') { p.yaw = inp.yaw; p.pitch = inp.pitch; return; }
    p.stun = Math.max(0, p.stun - dt); p.immune = Math.max(0, p.immune - dt); p.slow = Math.max(0, p.slow - dt); p.stall = Math.max(0, p.stall - dt); p.inv0 = Math.max(0, p.inv0 - dt); p.sated = Math.max(0, (p.sated || 0) - dt); p.flashCd = Math.max(0, p.flashCd - dt);
    if (p.role === 'm') for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
    if (p.wake > 0) { p.wake -= dt; if (p.wake <= 0) { p.wake = 0; this.touch(); this.emit({ e: 'wake', x: p.x, z: p.z, y: p.y }); } }

    // appuis (compteurs : un appui très bref ou un paquet perdu ne se perd pas)
    if ((inp.sel | 0) !== p.sel && inp.sel >= 0 && inp.sel < SLOTS) { p.sel = inp.sel | 0; this.touch(); }
    if (inp.tc !== pc.tc && p.role === 's' && p.st === 'ok' && p.hide < 0) { if (p.batt > 0) p.torch = !p.torch; this.emit({ e: 'torch', id: p.id, on: p.torch, x: p.x, z: p.z, y: p.y }); }
    if (inp.rc !== pc.rc && p.role === 's' && p.st === 'ok') this.reload(p);
    if (inp.dc !== pc.dc && p.role === 's' && p.st === 'ok') this.dropSlot(p, p.sel);
    if (inp.uc !== pc.uc && p.st === 'ok') this.usePress(p);
    if (inp.fc !== pc.fc && p.st === 'ok') this.firePress(p);
    if (inp.a1 !== pc.a1) this.ability(p, 'lights');
    if (inp.a2 !== pc.a2) this.ability(p, 'jam');
    if (inp.a3 !== pc.a3) this.ability(p, 'cam');
    pc.uc = inp.uc; pc.fc = inp.fc; pc.dc = inp.dc; pc.tc = inp.tc; pc.rc = inp.rc; pc.a1 = inp.a1; pc.a2 = inp.a2; pc.a3 = inp.a3;

    movePlayer(M, w, p, inp, dt);

    if (p.st === 'down') {
      p.downT -= dt;
      if (p.downT <= 0) {
        // la première fois, on finit par se relever seul ; la seconde est mortelle
        if (p.downs >= 2) this.kill(p, this.monster);
        else { p.st = 'ok'; p.hp = 50; p.inv0 = 3; p.torch = p.batt > 0; this.touch(); this.emit({ e: 'revive', id: p.id, by: p.id, x: p.x, z: p.z, y: p.y }); }
      }
      return;
    }
    // bruit des pas
    if (p.stepAcc >= (p.run ? 2.2 : 1.7)) {
      p.stepAcc = 0;
      const r = p.role === 'm' ? 0 : p.crouch ? 1.2 : p.run ? 15 : 6.5;
      if (r) this.noise(p.x, p.z, r, p.id);
    }
    if (p.role === 'm') this.stepMonster(p, dt);
    else this.stepSurvivor(p, dt);
    this.stepHold(p, dt);
  }

  stepSurvivor(p, dt) {
    const { M, w } = this, inp = p.inp;
    if (p.torch) { p.batt = Math.max(0, p.batt - 100 * dt / 210); if (p.batt <= 0) { p.torch = false; this.emit({ e: 'torch', id: p.id, on: false, x: p.x, z: p.z, y: p.y }); } }
    if (p.hp < 100 && zoneAt(M, p.x, p.z) === Z.OUTPOST) p.hp = Math.min(100, p.hp + 4 * dt); // la trousse de l'avant-poste
    if (p.hide >= 0) { p.hideT = (p.hideT || 0) + dt; if (p.hideT > 25 && Math.floor(p.hideT) % 6 === 0 && Math.floor(p.hideT - dt) % 6 !== 0) this.noise(p.x, p.z, 7, p.id); return; }
    // capteur EMF : enregistrer une trace, ou le monstre s'il est tout près
    const s = p.inv[p.sel];
    if (s && s.k === 'emf' && inp.fire) {
      const tr = w.traces.find((t) => !t.done && Math.hypot(t.x - p.x, t.z - p.z) < 2.6 && Math.abs(t.y - p.y) < 2);
      const m = this.monster;
      if (tr) {
        if (p.scanTrace !== tr.id) { p.scanTrace = tr.id; p.scan = 0; }
        p.scan += dt;
        if (p.scan >= SCAN_T) { tr.done = true; p.scan = 0; p.scanTrace = 0; this.addProof(p, 'trace'); }
      } else if (m && !p.audio && m.wake <= 0 && Math.hypot(m.x - p.x, m.z - p.z) < 11 && Math.abs(m.y - p.y) < 3) {
        p.audioT += dt; p.scan = p.audioT * SCAN_T / AUDIO_T;
        if (p.audioT >= AUDIO_T) { p.audio = true; p.audioT = 0; p.scan = 0; this.addProof(p, 'audio'); }
      } else { p.scan = 0; p.scanTrace = 0; }
    } else { p.scan = 0; p.scanTrace = 0; }
    // arrivée à la zone d'extraction
    if (zoneAt(M, p.x, p.z) === Z.PAD && M.t[Math.floor(p.z) * W + Math.floor(p.x)] === T.FLOOR) {
      if (p.proofs > 0 || w.banked > 0) this.extract(p);
      else if (!p.padWarn) { p.padWarn = true; this.emit({ e: 'info', id: p.id, msg: 'Sans preuve, personne ne vous croira : redescends en chercher une', long: true }); }
    }
  }

  extract(p) {
    const { w } = this;
    p.st = 'out'; p.escaped = true; w.banked += p.proofs; p.score = (p.score || 0) + p.proofs;
    p.proofs = 0; p.hold = null;
    for (let i = 0; i < p.inv.length; i++) p.inv[i] = null;
    this.touch();
    this.emit({ e: 'extract', id: p.id });
    this.checkEnd();
  }

  stepMonster(p, dt) {
    const { M, w } = this;
    if (p.atkT > 0) {
      p.atkT -= dt;
      if (p.atkT <= 0) {
        let hit = false;
        for (const q of this.players) {
          if (q.role === 'm' || q.st !== 'ok' || q.hide >= 0) continue;
          const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
          if (d > 2.25 || Math.abs(q.y - p.y) > 2) continue;
          if (Math.abs(angDiff(Math.atan2(-dx, -dz), p.yaw)) > 1.0 || !hasLOS(M, w.doors, p.x, p.z, q.x, q.z)) continue;
          this.hurt(q, p); hit = true;
        }
        if (hit) p.slow = 1.3;
      }
    }
    // une porte verrouillée ouverte par le monstre se referme derrière lui
    M.doors.forEach((d, i) => { const st = w.doors[i]; if (st.shutT > 0) { st.shutT -= dt; if (st.shutT <= 0) this.setDoor(i, false, p.id); } });
  }

  stepHold(p, dt) {
    const { M, w } = this, inp = p.inp;
    const tg = inp.use && p.st === 'ok' ? interactTarget(M, w, this.players, p) : null;
    if (!tg || !tg.hold) { if (p.hold) { p.hold = null; p.holdFrac = 0; } return; }
    const key = `${tg.kind}:${tg.id}`;
    if (!p.hold || p.hold.key !== key) p.hold = { key, t: 0 };
    p.hold.t += dt;
    if (tg.kind === 'gen') {
      // deux enquêteurs au plus se partagent l'atelier
      const workers = this.players.filter((q) => q.hold && q.hold.key === key).length;
      if (workers <= 2 || this.players.filter((q) => q.hold && q.hold.key === key).indexOf(p) < 2) w.gen = Math.min(100, w.gen + 100 * dt / GEN_T);
      p.holdFrac = w.gen / 100;
      w.genNoise = (w.genNoise || 0) + dt;
      if (w.genNoise > 5) { w.genNoise = 0; this.noise(M.generator.x, M.generator.z, 28, p.id); this.emit({ e: 'genwork', x: M.generator.x, z: M.generator.z }); }
      this.genDirty = true;
      if (w.gen >= 100) { w.genOn = true; p.hold = null; p.holdFrac = 0; this.touch(); this.emit({ e: 'gen', by: p.id }); this.noise(M.generator.x, M.generator.z, 60, p.id); }
      return;
    }
    p.holdFrac = p.hold.t / tg.hold;
    if (tg.kind === 'cache' && p.hold.t - dt < 0.02) this.noise(p.x, p.z, 8, p.id);
    if (p.hold.t >= tg.hold) {
      const q = this.byId.get(tg.id);
      p.hold = null; p.holdFrac = 0;
      if (tg.kind === 'cache') {
        const c = M.caches[tg.id], st = w.caches[tg.id];
        st.done = true; this.touch();
        const it = st.loot && this.dropItem(st.loot, 1, c.x, c.z);
        if (it) it.y = c.y + 1;
        this.emit({ e: 'found', id: p.id, what: st.loot ? ITEMS[st.loot].name : '', k: st.loot, x: c.x, z: c.z, y: c.y, empty: !st.loot });
        return;
      }
      if (tg.kind === 'smash') { w.gen = Math.max(0, w.gen - SMASH_LOSS); p.cd.smash = CD.smash; this.touch(); this.emit({ e: 'smash', x: M.generator.x, z: M.generator.z, gen: w.gen }); this.noise(M.generator.x, M.generator.z, 30, -1); return; }
      if (!q || q.st !== 'down') return;
      if (tg.kind === 'revive') { q.st = 'ok'; q.hp = 50; q.inv0 = 3; q.torch = q.batt > 0; this.touch(); this.emit({ e: 'revive', id: q.id, by: p.id, x: q.x, z: q.z, y: q.y }); }
      else if (tg.kind === 'finish') this.kill(q, p);
    }
  }

  stepWorld(dt) {
    const { w, M } = this;
    for (const k in w.dark) { w.dark[k] -= dt; if (w.dark[k] <= 0) { delete w.dark[k]; this.touch(); this.emit({ e: 'lightsback', zone: +k }); } }
    for (const st of w.doors) if (st.jam > 0) { st.jam -= dt; if (st.jam <= 0) { st.jam = 0; this.touch(); } }
    const L = w.lift;
    if (L.go > 0) { L.go -= dt; if (L.go <= 0) { L.go = 0; L.state = 'moving'; L.dir = L.at === 'bottom' ? 1 : -1; L.dur = L.dir > 0 ? LIFT.up : LIFT.down; L.calls++; this.touch(); this.emit({ e: 'lift', k: L.dir > 0 ? 'up' : 'down' }); } }
    if (L.state === 'moving') {
      L.y = clamp(L.y + L.dir * -DEEP * dt / L.dur, DEEP, 0);
      if ((L.dir > 0 && L.y >= 0) || (L.dir < 0 && L.y <= DEEP)) { L.state = 'idle'; L.at = L.dir > 0 ? 'top' : 'bottom'; this.touch(); this.emit({ e: 'lift', k: 'arrive', at: L.at }); }
    }
    // portes de l'ascenseur : ouvertes à l'arrêt à cet étage (une fois le courant revenu), jamais sur quelqu'un
    const wantB = w.genOn && L.state === 'idle' && L.at === 'bottom' && !(L.go > 0 && L.go < 1.5);
    const wantT = w.genOn && L.state === 'idle' && L.at === 'top' && !(L.go > 0 && L.go < 1.5);
    this.setLiftDoor(M.liftBottom, wantB); this.setLiftDoor(M.liftTop, wantT);
  }
  setLiftDoor(d, open) {
    const st = this.w.doors[d];
    if (st.open === open) return;
    if (!open && this.players.some((q) => inPlay(q) && this.M.doors[d].cells.some((i) => this.overlapsCell(q, i)))) { if (this.w.lift.go > 0) this.w.lift.go = 1.6; return; }
    st.open = open; this.touch();
    this.emit({ e: 'door', id: d, open, x: this.M.doors[d].x, z: this.M.doors[d].z, y: this.M.doors[d].y, lift: 1 });
  }

  timeUp() {
    const { w } = this;
    for (const p of this.players) if (p.role === 's' && inPlay(p)) { p.st = 'dead'; p.hide = -1; this.emit({ e: 'purge', id: p.id }); }
    w.end = 'purge';
    this.checkEnd(true);
  }
  checkEnd(force) {
    const { w } = this;
    if (w.ph === 'over') return;
    const surv = this.players.filter((p) => p.role === 's' && !p.spectator);
    if (!surv.length) return;
    const left = surv.filter((p) => inPlay(p)), up = surv.filter((p) => p.st === 'ok');
    const out = surv.filter((p) => p.st === 'out').length;
    // tous à terre, personne pour les relever : c'est fini seulement quand ils sont morts, ou s'il n'en reste qu'à terre (le monstre a gagné s'il achève)
    if (!force && left.length) return;
    w.ph = 'over'; w.win = out > 0 ? 's' : 'm'; w.out = out;
    this.touch();
    this.emit({ e: 'over', win: w.win });
  }

  ranking() {
    const w = this.w, win = w.win;
    return this.players.filter((p) => !p.spectator).map((p) => {
      const won = p.role === win;
      const score = p.role === 'm' ? (p.kills || 0) * 100 + (won ? 200 : 0) : (p.escaped ? 150 : 0) + (p.score || 0) * 50;
      return { id: p.id, name: p.name, color: p.color, bot: p.bot, role: p.role, won, score, kills: p.kills || 0, proofs: p.score || 0, st: p.st };
    }).sort((a, b) => (b.won - a.won) || b.score - a.score);
  }

  // ---------------------------------------------------------------- réseau
  // état lent : tout `w`, plus la fiche de chaque joueur
  world() {
    const w = this.w;
    w.v++;
    return { ...w, seedRun: this.seed, pl: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: !!p.bot, role: p.role, spectator: !!p.spectator, st: p.st, downs: p.downs || 0, inv: p.inv, sel: p.sel, proofs: p.proofs, kills: p.kills || 0, cd: p.cd, sated: p.sated || 0, wake: p.wake, audio: p.audio, photoDone: !!p.photoDone, score: p.score || 0, escaped: p.escaped, level: p.level, immune: p.immune })) };
  }
  // restauration chez le nouvel hôte : le dernier état reçu suffit, les bots repartent de zéro
  static restore(world, rows) {
    const sim = new Sim({ seed: world.seed, level: world.level, duration: world.dur });
    const { pl, seedRun, ...w } = world;
    sim.w = w;
    for (const f of pl) { const p = sim.addPlayer(f); Object.assign(p, f); p.bot = !!f.bot; p.prevC = emptyInput(); p.inp = emptyInput(); p.inp.yaw = p.yaw; }
    sim.w.monster = world.monster;
    for (const r of rows || []) { const p = sim.byId.get(r[0]); if (p) applyRow(p, r); }
    for (const p of sim.players) { p.inp.yaw = p.yaw; p.inp.pitch = p.pitch; }
    sim.drainEvents();
    return sim;
  }
  rows() { return this.players.filter((p) => !p.spectator).map(rowOf); }
}

export function rowOf(p) {
  const fl = (p.run ? FL.RUN : 0) | (p.crouch ? FL.CROUCH : 0) | (p.torch ? FL.TORCH : 0) | (p.st === 'down' ? FL.DOWN : 0) | (p.st === 'dead' ? FL.DEAD : 0) | (p.st === 'out' ? FL.OUT : 0) | (p.hide >= 0 ? FL.HIDE : 0) | (p.atkT > 0 ? FL.ATK : 0) | (p.stun > 0 ? FL.STUN : 0) | (p.hold ? FL.WORK : 0) | (p.wake > 0 ? FL.CAGE : 0) | (p.moving ? FL.MOVE : 0) | (p.stall > 0 ? FL.HALT : 0) | (p.slow > 0 ? FL.SLOW : 0) | (p.inv0 > 0 ? FL.RUSH : 0);
  return [p.id, Math.round(p.x * 100), Math.round(p.y * 100), Math.round(p.z * 100), Math.round(p.yaw * 1000), Math.round(p.pitch * 1000), fl, Math.round(p.hp), Math.round(p.stam), Math.round(p.batt), p.ack, Math.round((p.holdFrac || 0) * 100), Math.round((p.energy ?? 1) * 100), p.hide, Math.round((p.scan || 0) * 10), Math.ceil(p.downT || 0)];
}
export function applyRow(p, r) {
  p.x = r[1] / 100; p.y = r[2] / 100; p.z = r[3] / 100; p.yaw = r[4] / 1000; p.pitch = r[5] / 1000;
  const f = r[6];
  p.run = !!(f & FL.RUN); p.crouch = !!(f & FL.CROUCH); p.torch = !!(f & FL.TORCH); p.moving = !!(f & FL.MOVE);
  p.st = f & FL.DEAD ? 'dead' : f & FL.OUT ? 'out' : f & FL.DOWN ? 'down' : 'ok';
  p.atk = !!(f & FL.ATK); p.stunned = !!(f & FL.STUN); p.stun = f & FL.STUN ? 0.1 : 0; p.work = !!(f & FL.WORK); p.caged = !!(f & FL.CAGE); p.wake = f & FL.CAGE ? Math.max(p.wake || 0, 0.1) : 0; p.stall = f & FL.HALT ? 0.1 : 0; p.slow = f & FL.SLOW ? 0.1 : 0; p.inv0 = f & FL.RUSH ? 0.1 : 0;
  p.hp = r[7]; p.stam = r[8]; p.batt = r[9]; p.ack = r[10]; p.holdFrac = r[11] / 100; p.energy = r[12] / 100; p.hide = r[13]; p.scan = r[14] / 10; p.downT = r[15];
}
