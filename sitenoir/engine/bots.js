// Site Noir : les bots. Ils jouent avec la même commande qu'un joueur (déplacement, regard, appuis) : aucune triche sur la vitesse ou les règles,
// mais ils ne voient que ce qu'une ligne de vue leur montre. Les enquêteurs partagent ce qu'ils ont trouvé (mémoire commune).
import { Nav, Z, T, hasLOS, zoneAt, cellOf, W, H } from './map.js';
import { interactTarget, ITEMS, inPlay, cellSolid, R_BODY } from './sim.js';

const LEVELS = {
  facile: { see: 0.72, react: 0.55, mul: 0.94, atkRange: 1.6, finish: 0.5, flee: 0.8 },
  normal: { see: 1, react: 0.3, mul: 1, atkRange: 1.85, finish: 0.9, flee: 1 },
  expert: { see: 1.25, react: 0.14, mul: 1.03, atkRange: 2.05, finish: 1, flee: 1.15 },
};
const angTo = (p, x, z) => Math.atan2(-(x - p.x), -(z - p.z));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const press = (inp, k) => { inp[k] = (inp[k] | 0) + 1; };

export function updateBots(sim, dt) {
  if (!sim.players.some((p) => p.bot)) return;
  sim.nav ||= new Nav(sim.M);
  sim.mem ||= { items: new Set(), visited: new Set(), claims: new Map(), traces: new Set() };
  for (const p of sim.players) {
    if (!p.bot || p.spectator) continue;
    if (p.st === 'dead' || p.st === 'out') continue;
    p.mul = LEVELS[p.level]?.mul ?? 1;
    p.ai ||= { think: Math.random() * 0.3, path: null, pi: 0, goal: null, stuckT: 0, lx: p.x, lz: p.z, lockT: 0, wantUse: false, tx: 0, tz: 0, fear: 0, seen: 0, hideT: 0, lastSeen: null, searchT: 0, flashT: 0 };
    p.botTarget = null;
    if (p.role === 'm') monsterBot(sim, p, dt);
    else survivorBot(sim, p, dt);
  }
}

// ------------------------------------------------------------------ déplacement commun
function passFn(sim, p) {
  const { M, w } = sim, isM = p.role === 'm';
  return (i) => {
    const t = M.t[i];
    if (t !== T.FLOOR) return false;
    const d = M.doorAt[i];
    if (isM) { const z = M.zone[i]; if (z === Z.OUTPOST || z === Z.PAD || z === Z.CABINE) return false; if (d === M.liftBottom || d === M.liftTop) return false; if (d >= 0 && M.doors[d].kind === 'sas' && M.doors[d].key === null) return false; return true; }
    if (d < 0) return true;
    const D = M.doors[d], st = w.doors[d];
    if (D.kind === 'lift') return st.open;
    if (D.key && !st.unlocked) return p.inv.some((s) => s && s.k === D.key);
    return true;
  };
}
// ce que ce bot peut atteindre (recalculé deux fois par seconde : bien moins cher qu'un chemin par meuble)
function reach(sim, p) {
  const a = p.ai, now = sim.w.t;
  if (a.reach && now - a.reachT < 0.5) return a.reach;
  a.reachT = now;
  const r = a.reach || (a.reach = new Uint8Array(W * H)), pass = passFn(sim, p), q = a.reachQ || (a.reachQ = new Int32Array(W * H));
  r.fill(0);
  let h = 0, t = 0; const s = cellOf(p.x, p.z);
  r[s] = 1; q[t++] = s;
  while (h < t) {
    const i = q[h++], x = i % W;
    for (const j of [x < W - 1 ? i + 1 : -1, x > 0 ? i - 1 : -1, i + W, i - W]) if (j >= 0 && j < W * H && !r[j] && pass(j)) { r[j] = 1; q[t++] = j; }
  }
  return r;
}
const canReach = (sim, p, x, z) => !!reach(sim, p)[cellOf(x, z)];
function setGoal(sim, p, x, z, tag) {
  const a = p.ai;
  // cible proche de la précédente, ou chemin tout frais : on garde ce chemin (une cible qui bouge ne relance pas un A* à chaque image)
  if (a.path && a.pathT > 0 && (Math.hypot(a.gx - x, a.gz - z) < 1 || (a.pathT > 1.15 && a.pi < a.path.length))) return true;
  if (!a.path && a.pathT > 1.15 && a.gx === x && a.gz === z) return false;
  const path = sim.nav.find(p.x, p.z, x, z, passFn(sim, p), (i) => (sim.M.doorAt[i] >= 0 ? 2 : 0));
  a.path = path; a.pi = 0; a.gx = x; a.gz = z; a.pathT = 1.5; a.tag = tag;
  return !!path;
}
function clearStraight(sim, p, x, z) {
  const d = Math.hypot(x - p.x, z - p.z), n = Math.ceil(d / 0.3);
  for (let i = 1; i <= n; i++) {
    const f = i / n, qx = p.x + (x - p.x) * f, qz = p.z + (z - p.z) * f, r = R_BODY + 0.05;
    for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      const c = Math.floor(qz + oz) * W + Math.floor(qx + ox);
      if (cellSolid(sim.M, sim.w, p, c)) return false;
    }
  }
  return true;
}
// suit le chemin : tourne vers le prochain point et ouvre les portes fermées sur la route
function follow(sim, p, dt, run = false) {
  const a = p.ai, inp = p.inp, M = sim.M;
  a.pathT -= dt;
  inp.mx = 0; inp.my = 0; inp.run = run; inp.crouch = false;
  if (!a.path || a.pi >= a.path.length) return true;
  // un point plus loin en ligne droite ?
  for (let k = Math.min(a.path.length - 1, a.pi + 5); k > a.pi; k--) {
    const c = a.path[k], x = c % W + 0.5, z = ((c / W) | 0) + 0.5;
    if (clearStraight(sim, p, x, z)) { a.pi = k; break; }
  }
  const c = a.path[a.pi], x = c % W + 0.5, z = ((c / W) | 0) + 0.5;
  // porte fermée juste devant ?
  const nextD = M.doorAt[c];
  if (nextD >= 0 && !sim.w.doors[nextD].open) {
    const D = M.doors[nextD];
    const near = Math.hypot(D.x - p.x, D.z - p.z);
    if (D.kind !== 'lift' && near < 2 && sim.w.doors[nextD].jam <= 0) { p.botTarget = { kind: 'door', id: nextD }; p.inp.yaw = angTo(p, D.x, D.z); if (a.useCd <= 0 || a.useCd === undefined) { press(inp, 'uc'); a.useCd = 0.5; } }
    if (sim.w.doors[nextD].jam > 0 && near < 2) return false;
  }
  a.useCd = (a.useCd || 0) - dt;
  if (Math.hypot(x - p.x, z - p.z) < (a.pi === a.path.length - 1 ? 0.2 : 0.55)) { a.pi++; if (a.pi >= a.path.length) return true; }
  const c2 = a.path[a.pi], x2 = c2 % W + 0.5, z2 = ((c2 / W) | 0) + 0.5;
  inp.yaw = turn(inp.yaw, angTo(p, x2, z2), dt * 7);
  inp.my = 1;
  // bloqué ?
  a.stuckT += dt;
  if (a.stuckT > 1.2) {
    if (Math.hypot(p.x - a.lx, p.z - a.lz) < 0.3 && !(p.stall > 0)) { a.pathT = 0; a.path = null; a.jitter = 0.6; a.stuck = (a.stuck || 0) + 1; sim.botStuck = (sim.botStuck || 0) + 1; }
    a.lx = p.x; a.lz = p.z; a.stuckT = 0;
  }
  if (a.jitter > 0) { a.jitter -= dt; inp.mx = Math.sin(sim.w.t * 13 + p.id) > 0 ? 1 : -1; }
  return false;
}
function turn(cur, want, max) { let d = (want - cur) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return cur + Math.max(-max, Math.min(max, d)); }
const stop = (p) => { p.inp.mx = 0; p.inp.my = 0; p.inp.run = false; p.inp.use = false; p.inp.fire = false; };
function goTo(sim, p, dt, x, z, tag, run) {
  if (!setGoal(sim, p, x, z, tag)) return false;
  follow(sim, p, dt, run);
  return true;
}
const near = (p, x, z, r) => Math.hypot(p.x - x, p.z - z) < r;

// ------------------------------------------------------------------ enquêteur
function survivorBot(sim, p, dt) {
  const { M, w, mem } = sim, a = p.ai, inp = p.inp, m = sim.monster, lv = LEVELS[p.level] || LEVELS.normal;
  inp.use = false; inp.fire = false;
  if (p.st === 'down') { stop(p); return; }
  a.useCd = (a.useCd || 0) - 0;
  const dm = m && m.wake <= 0 ? dist(p, m) : 99;
  const sees = dm < 16 && Math.abs(m.y - p.y) < 2.5 && hasLOS(M, w.doors, p.x, p.z, m.x, m.z);
  if (sees) { a.seen = 3; a.lastSeen = { x: m.x, z: m.z }; }
  a.seen = Math.max(0, a.seen - dt);

  // la lampe : allumée dedans, éteinte si elle est vide ; une pile quand il le faut
  if (p.batt < 18 && p.inv.some((s) => s && s.k === 'pile')) press(inp, 'rc');
  const wantTorch = zoneAt(M, p.x, p.z) !== Z.OUTPOST && p.batt > 2 && p.hide < 0 && !(sees === false && a.seen > 0 && dm < 9);
  if (wantTorch !== p.torch && (a.torchCd || 0) <= 0) { press(inp, 'tc'); a.torchCd = 1; }
  a.torchCd = (a.torchCd || 0) - dt;

  // mémoire d'équipe : ce que je vois
  a.think -= dt;
  if (a.think <= 0) {
    a.think = 0.35;
    for (const it of w.items) if (!mem.items.has(it.id) && (it.stock || (dist(p, it) < 9 && hasLOS(M, w.doors, p.x, p.z, it.x, it.z)))) mem.items.add(it.id);
    for (const t of w.traces) if (!mem.traces.has(t.id) && dist(p, t) < 8 && hasLOS(M, w.doors, p.x, p.z, t.x, t.z)) mem.traces.add(t.id);
    for (const r of M.rooms) if (!mem.visited.has(r.id) && Math.hypot(r.cx - p.x, r.cz - p.z) < 3.5) mem.visited.add(r.id);
  }

  // caché : attendre que ça se calme
  if (p.hide >= 0) {
    stop(p); a.hideT -= dt;
    if (a.hideT <= 0 && dm > 7) { press(inp, 'uc'); a.fear = 0; }
    return;
  }

  // fuite
  if (sees && dm < 12 * lv.flee) a.fear = Math.max(a.fear, 3.5);
  if (p.hp < 100 && p.inv0 > 0) a.fear = 5;
  a.fear = Math.max(0, a.fear - dt);
  if (a.fear > 0 && m) { flee(sim, p, dt, m, dm, sees, lv); return; }

  a.goalT = (a.goalT || 0) - dt;
  if (a.goalT <= 0) { a.goalT = 0.25; a.g = chooseGoal(sim, p); }
  const g = a.g;
  if (g && g.tag) a.tag = g.tag;
  if (!g) { stop(p); return; }
  if (g.act) { g.act(); return; }
  if (!goTo(sim, p, dt, g.x, g.z, g.tag, !!g.run)) { a.noPath = (a.noPath || 0) + 1; stop(p); }
}

function flee(sim, p, dt, m, dm, sees, lv) {
  const { M, w } = sim, a = p.ai, inp = p.inp;
  // l'éclair de l'appareil le sonne : tourner et photographier quand il arrive
  const sel = p.inv.findIndex((s) => s && s.k === 'photo' && s.n > 0);
  if (sel >= 0 && sees && dm < 10 && m.immune <= 0 && p.flashCd <= 0) {
    inp.sel = sel;
    inp.yaw = angTo(p, m.x, m.z);
    if (p.sel === sel && Math.abs(turnDiff(p.yaw, inp.yaw)) < 0.2) press(inp, 'fc');
    inp.mx = 0; inp.my = 0.2;
    return;
  }
  // un casier tout près et il ne me voit pas : s'y cacher
  if (!sees && dm > 4) {
    let bl = null, bd = 6;
    for (const l of M.lockers) { const d = Math.hypot(l.fx - p.x, l.fz - p.z); if (d < bd && Math.abs(l.y - p.y) < 2 && !sim.players.some((q) => q.hide === l.id)) { bd = d; bl = l; } }
    if (bl) {
      if (bd < 1.2) { p.botTarget = { kind: 'hide', id: bl.id }; inp.yaw = angTo(p, bl.x, bl.z); press(inp, 'uc'); a.hideT = 7 + (p.id * 7 % 8); return; }
      goTo(sim, p, dt, bl.fx, bl.fz, 'locker', true); return;
    }
  }
  // sinon : la pièce la plus loin de lui, au pas de course
  a.fleeT = (a.fleeT || 0) - dt;
  if (a.fleeT <= 0 || !a.flee) {
    a.fleeT = 2;
    let best = null, bs = -1e9;
    for (const r of M.rooms) {
      if (r.zone === Z.PAD) continue;
      const sc = Math.hypot(r.cx - m.x, r.cz - m.z) * 1.0 - Math.hypot(r.cx - p.x, r.cz - p.z) * 0.6;
      const toward = (r.cx - p.x) * (m.x - p.x) + (r.cz - p.z) * (m.z - p.z);
      if (toward > 0 && dm < 8) continue; // pas en passant devant lui
      if (sc > bs && canReach(sim, p, r.cx, r.cz)) { bs = sc; best = r; }
    }
    a.flee = best;
  }
  if (a.flee) goTo(sim, p, dt, a.flee.cx, a.flee.cz, 'flee', true);
}
const turnDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function chooseGoal(sim, p) {
  const { M, w, mem } = sim, a = p.ai, inp = p.inp;
  const known = (pred) => w.items.filter((it) => mem.items.has(it.id) && pred(it));
  const nearest = (list) => { let b = null, bd = 1e9; for (const o of list) { const d = dist(p, o); if (d < bd) { bd = d; b = o; } } return b; };
  const team = sim.players.filter((q) => q.role === 's' && !q.spectator);
  const teamHas = (k) => team.some((q) => inPlay(q) && q.inv.some((s) => s && s.k === k));
  const nearHand = (it, tag) => {
    if (!it) return null;
    // un objet posé sur un meuble : on s'arrête à côté
    const onProp = M.t[cellOf(it.x, it.z)] !== T.FLOOR, s = onProp ? standBy(sim, p, it) : [it.x, it.z];
    if (!s) return null;
    return { x: s[0], z: s[1], tag, act: dist(p, it) < 1.9 ? () => { stop(p); p.botTarget = { kind: 'item', id: it.id }; p.inp.yaw = angTo(p, it.x, it.z); press(p.inp, 'uc'); } : null };
  };

  // 1. s'équiper à la table de l'avant-poste : l'appareil photo est déjà dans le sac, la moitié de l'équipe prend un capteur
  if (!a.equipped) {
    const hasEmf = team.filter((q) => q.inv.some((s) => s && s.k === 'emf')).length;
    const c = w.items.find((it) => it.stock && it.k === 'emf');
    if (c && zoneAt(M, p.x, p.z) === Z.OUTPOST && !p.inv.some((s) => s && s.k === 'emf') && hasEmf <= team.findIndex((q) => q === p) / 2) return nearHand(c, 'equip');
    a.equipped = true;
  }
  // 2. relever un équipier à terre
  const down = team.filter((q) => q.st === 'down' && q !== p && dist(q, p) < 40);
  if (down.length) {
    const q = nearest(down), m = sim.monster;
    if (!m || dist(m, q) > 6 || dist(q, p) < 2) {
      if (dist(q, p) < 1.8) return { act: () => { stop(p); p.botTarget = { kind: 'revive', id: q.id }; inp.yaw = angTo(p, q.x, q.z); inp.use = true; } };
      return { x: q.x, z: q.z, tag: 'revive', run: true };
    }
  }
  // 3. récupérer ce qui est tombé : clés et preuves
  const drop = nearest(known((it) => it.k === 'preuve' || ((it.k === 'bleu' || it.k === 'orange') && !teamHas(it.k))));
  if (drop) return nearHand(drop, 'fetch');
  // 4. souffler à l'avant-poste s'il n'est pas loin, une pile si la lampe faiblit
  if (p.hp < 100 && zoneAt(M, p.x, p.z) === Z.OUTPOST) return { tag: 'soin', act: () => stop(p) };
  if (p.hp <= 50 && Math.hypot(p.x - 23, p.z - 49) < 26 && p.y > -0.5) return { x: 23.5, z: 50, tag: 'soin' };
  if (p.batt < 35 && !p.inv.some((s) => s && s.k === 'pile')) { const pile = nearest(known((it) => it.k === 'pile' && !it.stock && dist(it, p) < 18)); if (pile) return nearHand(pile, 'pile'); }

  // 5. les portes : chercher la clé, puis ouvrir
  for (const k of ['bleu', 'orange']) {
    const doors = M.doors.filter((d) => d.key === k && !w.doors[d.id].unlocked);
    if (doors.length === M.doors.filter((d) => d.key === k).length) {
      if (p.inv.some((s) => s && s.k === k)) {
        const d = nearest(doors);
        if (dist(d, p) < 2) return { act: () => { stop(p); p.botTarget = { kind: 'door', id: d.id }; inp.yaw = angTo(p, d.x, d.z); if ((a.dCd || 0) <= 0) { press(inp, 'uc'); a.dCd = 0.6; } a.dCd -= 0.016; } };
        const side = doorSide(sim, p, d);
        return { x: side[0], z: side[1], tag: 'unlock' };
      }
      const it = nearest(known((q) => q.k === k));
      if (it) return nearHand(it, 'key');
      if (teamHas(k)) break; // un autre l'a : pendant ce temps, chercher une preuve
      const g = searchZone(sim, p, k === 'bleu' ? Z.A : Z.B);
      if (g) return g;
    }
  }
  // 6. une preuve, tant que l'équipe en a peu
  const proofs = sim.teamProofs();
  const emfSlot = p.inv.findIndex((s) => s && s.k === 'emf');
  if (proofs < 3 && emfSlot >= 0) {
    if (p.sel !== emfSlot) inp.sel = emfSlot;
    const tr = nearest(w.traces.filter((t) => !t.done && mem.traces.has(t.id) && canReach(sim, p, t.x, t.z)));
    if (tr) {
      if (dist(tr, p) < 2.2) return { act: () => { stop(p); inp.yaw = angTo(p, tr.x, tr.z); inp.fire = true; } };
      return { x: tr.x, z: tr.z, tag: 'trace' };
    }
    if (proofs < 1) { const s = searchReachable(sim, p); if (s) return s; }
  }
  if (proofs < 1 && !teamHas('emf')) {
    // plus aucun capteur dans l'équipe : en reprendre un
    const c = nearest(known((it) => it.k === 'emf'));
    if (c) return nearHand(c, 'emf');
  }
  // 7. le générateur : d'abord les fusibles, puis la réparation
  if (w.gen < 100) {
    const orange = M.doors.filter((d) => d.key === 'orange').some((d) => w.doors[d.id].unlocked) || p.inv.some((s) => s && s.k === 'orange');
    const g = M.generator.panel, fuses = p.inv.find((s) => s && s.k === 'fuse');
    if (!orange) return searchReachable(sim, p);
    if (fuses && w.parts < 3) {
      if (Math.hypot(g.x - p.x, g.z - p.z) < 1.8) return { tag: 'fusible', act: () => { stop(p); p.botTarget = { kind: 'fuse', id: 0 }; inp.yaw = angTo(p, M.generator.x, M.generator.z); if ((a.dCd || 0) <= 0) { press(inp, 'uc'); a.dCd = 0.5; } a.dCd -= 0.016; } };
      return { x: g.x, z: g.z, tag: 'fusible' };
    }
    if (w.parts < 3) {
      const f = nearest(known((it) => it.k === 'fuse'));
      if (f) return nearHand(f, 'fusible');
      const held = team.reduce((n, q) => n + (inPlay(q) ? q.inv.reduce((m, s) => m + (s && s.k === 'fuse' ? s.n : 0), 0) : 0), 0);
      if (w.parts + held < 3) { const s = searchReachable(sim, p); if (s) return s; }
      return { x: g.x + (p.id % 3) - 1, z: g.z + 1, tag: 'garde' };
    }
    if (Math.hypot(g.x - p.x, g.z - p.z) < 1.8) return { act: () => { stop(p); p.botTarget = { kind: 'gen', id: 0 }; inp.yaw = angTo(p, M.generator.x, M.generator.z); inp.use = true; } };
    return { x: g.x, z: g.z, tag: 'gen' };
  }
  // 8. l'ascenseur
  const L = w.lift, c = M.cabin;
  const inCabin = p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1 - 1;
  if (L.at === 'top' && L.state === 'idle') {
    if (p.y > -1 && inCabin) return { x: M.padCenter.x, z: M.padCenter.z, tag: 'pad', run: true };
    if (p.y > -1) return { x: M.padCenter.x, z: M.padCenter.z, tag: 'pad', run: true };
    if (near(p, M.liftCall.x, M.liftCall.z, 1.8)) return { act: () => { stop(p); p.botTarget = { kind: 'call', id: 0 }; inp.yaw = angTo(p, M.liftCall.x, M.liftCall.z); if ((a.dCd || 0) <= 0) { press(inp, 'uc'); a.dCd = 1; } a.dCd -= 0.016; } };
    return { x: M.liftCall.x, z: M.liftCall.z - 1, tag: 'call' };
  }
  if (L.state === 'moving') {
    if (inCabin) return { act: () => stop(p) };
    return { x: 59.5 + (p.id & 1) * 1.5, z: 40.5, tag: 'wait' };
  }
  if (L.at === 'bottom') {
    if (proofs < 1) { const s = searchReachable(sim, p); if (s) return s; }
    if (!inCabin) return { x: 59.5 + (p.id % 3), z: 45.5, tag: 'board', run: true };
    // on attend les équipiers debout quelques secondes
    a.boardT = (a.boardT || 0) + 0.016;
    const others = team.filter((q) => q.st === 'ok' && q !== p && !(q.x > c.x0 && q.x < c.x1 && q.z > c.z0 && q.z < c.z1 - 1));
    if ((!others.length || a.boardT > 9) && !(L.go > 0) && L.state === 'idle') return { act: () => { stop(p); p.botTarget = { kind: 'go', id: 0 }; inp.yaw = angTo(p, M.liftGo.x, M.liftGo.z); if ((a.dCd || 0) <= 0) { press(inp, 'uc'); a.dCd = 1; } a.dCd -= 0.016; } };
    return { act: () => stop(p) };
  }
  return searchReachable(sim, p);
}
function doorSide(sim, p, d) {
  const dx = d.axis === 'x' ? 0 : Math.sign(p.x - d.x) || 1, dz = d.axis === 'x' ? Math.sign(p.z - d.z) || 1 : 0;
  return [d.x + dx * 1.2 - (d.axis === 'x' ? 0.5 : 0), d.z + dz * 1.2 - (d.axis === 'z' ? 0.5 : 0)];
}
// fouille le meuble libre le plus proche de la zone demandée (les autres bots en prennent d'autres)
function searchZone(sim, p, zone) {
  const { M, w, mem } = sim, a = p.ai, inp = p.inp;
  let best = null, bd = 1e9;
  for (const c of M.caches) {
    if (w.caches[c.id].done || c.zone !== zone) continue;
    const taken = mem.claims.get(c.id);
    const d = Math.hypot(c.x - p.x, c.z - p.z) + (taken !== undefined && taken !== p.id ? 22 : 0);
    if (d < bd) { const s = standBy(sim, p, c); if (s) { bd = d; best = { c, s }; } }
  }
  if (!best) return null;
  mem.claims.set(best.c.id, p.id);
  const { c, s } = best;
  if (Math.hypot(c.x - p.x, c.z - p.z) < 1.8) return { tag: 'fouille', act: () => { stop(p); p.botTarget = { kind: 'cache', id: c.id }; inp.yaw = angTo(p, c.x, c.z); inp.use = true; } };
  return { x: s[0], z: s[1], tag: 'fouille' };
}
// une case libre et atteignable à côté du meuble (les cases voisines ne changent pas : calculées une fois)
function standBy(sim, p, c) {
  const { M } = sim;
  const key = c.k ? `i${c.id}` : c.id;
  const list = (sim.stand ||= new Map()).get(key) || (() => {
    const l = [], cx = Math.floor(c.x), cz = Math.floor(c.z);
    for (let z = cz - 2; z <= cz + 2; z++) for (let x = cx - 2; x <= cx + 2; x++) { const i = z * W + x; if (M.t[i] === T.FLOOR && M.doorAt[i] < 0 && Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z) <= 1.6) l.push([x + 0.5, z + 0.5]); }
    sim.stand.set(key, l);
    return l;
  })();
  let best = null, bd = 1e9;
  for (const q of list) { const d = Math.hypot(q[0] - p.x, q[1] - p.z); if (d < bd && canReach(sim, p, q[0], q[1])) { bd = d; best = q; } }
  return best;
}
function searchReachable(sim, p) {
  for (const z of [Z.A, Z.B, Z.SOUS]) { const g = searchZone(sim, p, z); if (g) return g; }
  return { tag: 'attente', act: () => stop(p) };
}
function openCell(sim, r) {
  const { M } = sim, cx = Math.floor(r.cx), cz = Math.floor(r.cz);
  for (let d = 0; d < 7; d++) for (let z = cz - d; z <= cz + d; z++) for (let x = cx - d; x <= cx + d; x++) if (M.t[z * W + x] === T.FLOOR && M.doorAt[z * W + x] < 0 && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return [x + 0.5, z + 0.5];
  return [r.cx, r.cz];
}

// ------------------------------------------------------------------ monstre
function monsterBot(sim, p, dt) {
  const { M, w } = sim, a = p.ai, inp = p.inp, lv = LEVELS[p.level] || LEVELS.normal;
  inp.use = false; inp.fire = false; inp.run = false;
  if (p.wake > 0 || p.stun > 0) { stop(p); return; }
  // ce qu'il perçoit
  a.think -= dt;
  if (a.think <= 0) {
    a.think = lv.react * (0.6 + Math.random() * 0.6);
    let best = null, bs = 1e9;
    for (const q of sim.players) {
      if (q.role === 'm' || q.spectator || q.st !== 'ok' || q.hide >= 0) continue;
      const d = dist(p, q), r = (q.torch ? 15 : q.crouch ? 5 : 8) * lv.see;
      if (p.sated > 0 || d > r || Math.abs(q.y - p.y) > 2.5 || !hasLOS(M, w.doors, p.x, p.z, q.x, q.z)) continue;
      if (zoneAt(M, q.x, q.z) === Z.OUTPOST || zoneAt(M, q.x, q.z) === Z.CABINE) continue;
      if (d < bs) { bs = d; best = q; }
    }
    if (best) { a.tg = best.id; a.lost = 0; a.lastSeen = { x: best.x, z: best.z }; }
    // ce qu'il entend
    if (!best) for (const n of sim.noises) {
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      const by = n.by >= 0 && sim.byId.get(n.by);
      if (by && by.role === 'm') continue;
      if (d < n.r * lv.see && (!a.heard || a.heardR <= n.r || a.heardT <= 0)) { a.heard = { x: n.x, z: n.z }; a.heardR = n.r; a.heardT = 8; }
    }
    // caméra à portée : il la casse
    if (p.cd.cam <= 0) for (const c of w.cams) if (Math.hypot(c.x - p.x, c.z - p.z) < 5 && hasLOS(M, w.doors, p.x, p.z, c.x, c.z)) { inp.yaw = angTo(p, c.x, c.z); p.yaw = inp.yaw; press(inp, 'a3'); break; }
  }
  a.heardT = (a.heardT || 0) - dt;

  // à terre : achever
  const dn = sim.players.filter((q) => q.st === 'down' && q.role === 's' && q.downs >= 2).sort((x, y) => dist(p, x) - dist(p, y))[0];
  const tg = a.tg != null ? sim.byId.get(a.tg) : null;
  const tgOk = tg && tg.st === 'ok' && tg.hide < 0 && zoneAt(M, tg.x, tg.z) !== Z.OUTPOST && zoneAt(M, tg.x, tg.z) !== Z.CABINE;
  if (dn && (!tgOk || dist(tg, p) > dist(dn, p) - 3) && Math.random() < lv.finish + 0.5) {
    if (dist(dn, p) < 1.7) { stop(p); p.botTarget = { kind: 'finish', id: dn.id }; inp.yaw = angTo(p, dn.x, dn.z); inp.use = true; return; }
    if (goTo(sim, p, dt, dn.x, dn.z, 'finish', true)) return;
  }
  // repu : il ne peut plus frapper, il s'éloigne et reprend sa ronde
  if (p.sated > 0) a.tg = null;
  // au générateur : il casse le travail déjà fait
  if (!tgOk && w.gen > 0 && !w.genOn && p.cd.smash <= 0 && Math.hypot(M.generator.panel.x - p.x, M.generator.panel.z - p.z) < 2.4) { stop(p); p.botTarget = { kind: 'smash', id: 0 }; inp.yaw = angTo(p, M.generator.x, M.generator.z); inp.use = true; return; }
  // poursuite
  if (tgOk) {
    const d = dist(tg, p), los = d < 26 && Math.abs(tg.y - p.y) < 2.5 && hasLOS(M, w.doors, p.x, p.z, tg.x, tg.z);
    if (los) { a.lost = 0; a.lastSeen = { x: tg.x, z: tg.z }; } else a.lost = (a.lost || 0) + dt;
    if (los && d < lv.atkRange && Math.abs(tg.y - p.y) < 2) {
      inp.yaw = turn(inp.yaw, angTo(p, tg.x, tg.z), dt * 10);
      inp.my = 1; inp.mx = 0;
      if (p.cd.atk <= 0 && Math.abs(turnDiff(p.yaw, angTo(p, tg.x, tg.z))) < 0.5) press(inp, 'fc');
      return;
    }
    // pouvoirs : noir et porte bloquée pendant la poursuite
    if (d < 16 && p.cd.lights <= 0 && !w.dark[zoneAt(M, p.x, p.z)] && los) press(inp, 'a1');
    if (d < 11 && d > 4 && p.cd.roar <= 0 && los) press(inp, 'rc');
    if (d > 3 && d < 12 && p.cd.jam <= 0 && los) {
      const dr = M.doors.find((o) => o.kind !== 'lift' && !(o.kind === 'sas' && o.key === null) && Math.hypot(o.x - tg.x, o.z - tg.z) < 3.2 && Math.hypot(o.x - p.x, o.z - p.z) < 7 && !o.cells.some((i) => sim.overlapsCell(tg, i)));
      if (dr) { const ya = inp.yaw; p.yaw = angTo(p, dr.x, dr.z); inp.yaw = p.yaw; press(inp, 'a2'); a.yawBack = ya; }
    }
    if (a.lost > 4) { a.tg = null; a.searchT = 14; a.searchAt = a.lastSeen; }
    else {
      const goal = los ? tg : (a.lastSeen || tg);
      const sprint = los && d > 3 && d < 15;
      if (goTo(sim, p, dt, goal.x, goal.z, 'chase', sprint)) return;
      a.tg = null;
    }
  }
  // cherche là où il l'a perdu : il fouille les casiers tout près
  if (a.searchT > 0) {
    a.searchT -= dt;
    const l = M.lockers.filter((o) => Math.hypot(o.fx - a.searchAt.x, o.fz - a.searchAt.z) < 11 && !(a.checked && a.checked.has(o.id)) && Math.abs(o.y - p.y) < 2).sort((x, y) => Math.hypot(x.fx - p.x, x.fz - p.z) - Math.hypot(y.fx - p.x, y.fz - p.z))[0];
    if (l) {
      if (Math.hypot(l.fx - p.x, l.fz - p.z) < 1.3) { (a.checked ||= new Set()).add(l.id); p.botTarget = { kind: 'search', id: l.id }; inp.yaw = angTo(p, l.x, l.z); press(inp, 'uc'); stop(p); return; }
      if (goTo(sim, p, dt, l.fx, l.fz, 'locker')) return;
    }
    if (goTo(sim, p, dt, a.searchAt.x, a.searchAt.z, 'lastseen')) return;
  } else if (a.checked) a.checked = null;
  // un bruit : il va voir
  if (a.heard && a.heardT > 0) {
    if (Math.hypot(a.heard.x - p.x, a.heard.z - p.z) < 2.5) a.heard = null;
    else if (goTo(sim, p, dt, a.heard.x, a.heard.z, 'heard', a.heardR > 20)) return;
    else a.heard = null;
  }
  // ronde : vers le générateur s'il est en route, sinon une pièce au hasard du côté des enquêteurs
  a.patrolT = (a.patrolT || 0) - dt;
  if (!a.patrol || a.patrolT <= 0 || Math.hypot(a.patrol.x - p.x, a.patrol.z - p.z) < 2) {
    a.patrolT = 22;
    const rooms = M.rooms.filter((r) => r.zone === Z.A || r.zone === Z.B || r.zone === Z.SOUS);
    const inPlaySurv = sim.players.filter((q) => q.role === 's' && q.st === 'ok');
    // il a de l'instinct : il préfère les pièces d'une zone où il y a du monde, sans savoir où exactement
    const zones = new Set(inPlaySurv.map((q) => zoneAt(M, q.x, q.z)));
    const pool = rooms.filter((r) => zones.has(r.zone));
    const pickFrom = pool.length && sim.rng.chance(0.65) ? pool : rooms;
    const r = sim.rng.pick(pickFrom);
    const [x, z] = w.gen > 8 && !w.genOn && p.cd.smash <= 0 && sim.rng.chance(0.4) ? [M.generator.panel.x, M.generator.panel.z] : openCell(sim, r);
    a.patrol = { x, z };
  }
  if (!goTo(sim, p, dt, a.patrol.x, a.patrol.z, 'patrol')) { a.patrol = null; stop(p); }
}
