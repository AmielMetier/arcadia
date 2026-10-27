// Island Rush — ce qui passe sur le réseau. L'hôte fait tourner la partie ; vingt fois par seconde il envoie à tous un
// instantané (joueurs, projectiles, tempête, montgolfière) et les événements depuis le dernier envoi (butin posé ou
// ramassé, coffres, portes, constructions, destructions, tirs, dégâts…). Chaque invité garde une copie de la partie
// (même graine : même butin de départ) qu'il tient à jour avec ces messages ; il prédit son propre déplacement et
// dessine les autres un dixième de seconde en arrière, en interpolant. Un retardataire reçoit d'abord l'état
// complet. Moteur PUR (testé hors navigateur).
import { AMMO } from './items.js';
import { stepPlayer, stepAir } from './player.js';
import { CRAWL, REVIVE } from './sim.js';

export const MODES = ['sol', 'ballon', 'chute', 'planeur'];
const AMMO_K = Object.keys(AMMO), MATS_K = ['bois', 'pierre', 'metal'];
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;

export const encIt = (it) => (!it ? 0 : it.t === 'arme' ? ['a', it.w, it.r, it.mag] : it.t === 'objet' ? ['o', it.c, it.r, it.n] : it.t === 'munitions' ? ['m', it.a, 0, it.n] : ['x', it.m, 0, it.n]);
export const decIt = (a) => (!a ? null : a[0] === 'a' ? { t: 'arme', w: a[1], r: a[2], mag: a[3] } : a[0] === 'o' ? { t: 'objet', c: a[1], r: a[2], n: a[3] }
  : a[0] === 'm' ? { t: 'munitions', a: a[1], r: 0, n: a[3] } : { t: 'materiaux', m: a[1], r: 0, n: a[3] });

// ------------------------------------------------------------------ instantané (hôte → tous)
// inv : 'humains' (inventaires des joueurs humains) ou 'tous' (de temps en temps : pour qu'un nouvel hôte reparte)
export function snapshot(sim, inv = 'humains') {
  const S = sim.S, P = [], I = [];
  for (const p of S.players.values()) {
    const held = p.sel > 0 ? p.inv[p.sel - 1] : null;
    const bits = (p.alive ? 1 : 0) | (p.ground ? 2 : 0) | (p.swim ? 4 : 0) | (p.crouch ? 8 : 0) | (p.sprint ? 16 : 0) | (p.inp.aim ? 32 : 0) | (p.rl > 0 ? 64 : 0);
    P.push([p.id, r2(p.x), r2(p.y), r2(p.z), r3(p.yaw), r3(p.pitch || 0), r2(p.vx), r2(p.vy), r2(p.vz), bits, MODES.indexOf(p.mode),
      Math.max(0, Math.round(p.hp)), Math.round(p.sh), p.sel, encIt(held), p.use ? r2(p.use.t / p.use.T) : -1, p.kills, p.place, p.q | 0, Math.round(p.dealt), p.hitBy ?? null,
      // équipes : réserve quand on est à terre (−1 debout), coéquipier qu'on relève et où on en est
      p.down ? Math.max(0, Math.round(p.down.hp)) : -1, p.revive ? [p.revive.id, r2(p.revive.t / REVIVE)] : 0]);
    if (inv === 'tous' || !p.bot) I.push([p.id, p.inv.map(encIt), AMMO_K.map((a) => p.ammo[a]), MATS_K.map((m) => p.mats[m]), r2(p.rl), r2(p.cd), p.use ? p.use.c : 0, p.use ? r2(p.use.T) : 0]);
  }
  const st = S.storm;
  return {
    t: r3(S.t), ph: S.phase, ft: S.flight ? r3(S.flight.t) : 0, w: S.winner ?? null,
    st: st && st.cur ? [st.k, st.state, r2(st.left || 0), r2(st.cur.x), r2(st.cur.z), r2(st.cur.r), r2(st.next.x), r2(st.next.z), r2(st.next.r), st.dps || 0] : null,
    P, I, J: S.projectiles.map((q) => [q.id, q.kind, r2(q.x), r2(q.y), r2(q.z), r2(q.vx), r2(q.vy), r2(q.vz)]),
  };
}

// la copie de l'invité prend l'instantané ; me : son joueur (sa position vient de sa prédiction, pas d'ici)
export function applySnapshot(sim, s, me) {
  const S = sim.S;
  S.t = s.t; S.phase = s.ph; S.winner = s.w;
  if (S.flight) S.flight.t = s.ft;
  if (s.st && S.storm) {
    const st = S.storm, a = s.st;
    st.k = a[0]; st.state = a[1]; st.left = a[2]; st.cur = { x: a[3], z: a[4], r: a[5] }; st.next = { x: a[6], z: a[7], r: a[8] }; st.dps = a[9];
  }
  const withInv = new Set(s.I.map((r) => r[0]));
  for (const r of s.P) {
    const p = S.players.get(r[0]);
    if (!p) continue;
    if (p.id !== me) { p.x = r[1]; p.y = r[2]; p.z = r[3]; p.yaw = r[4]; p.vx = r[6]; p.vy = r[7]; p.vz = r[8]; p.mode = MODES[r[10]]; }
    p.pitch = r[5];
    p.alive = !!(r[9] & 1); p.ground = !!(r[9] & 2); p.swim = !!(r[9] & 4); p.crouch = !!(r[9] & 8); p.sprint = !!(r[9] & 16);
    if (p.id !== me) p.inp.aim = !!(r[9] & 32);
    p.hp = r[11]; p.sh = r[12]; p.sel = r[13]; p.kills = r[16]; p.place = r[17]; p.q = r[18]; p.dealt = r[19]; p.hitBy = r[20];
    p.down = r[21] >= 0 ? { hp: r[21] } : null; p.revive = r[22] ? { id: r[22][0], t: r[22][1] * REVIVE } : null;
    if (!withInv.has(p.id)) {
      // des autres, on ne connaît que l'objet en main (pour le dessiner)
      p.inv = [null, null, null, null, null];
      if (p.sel > 0) p.inv[p.sel - 1] = decIt(r[14]);
      p.rl = r[9] & 64 ? 1 : 0;
      p.use = r[15] >= 0 ? { t: r[15], T: 1, c: null } : null;
    }
  }
  for (const r of s.I) {
    const p = S.players.get(r[0]);
    if (!p) continue;
    p.inv = r[1].map(decIt);
    AMMO_K.forEach((a, i) => { p.ammo[a] = r[2][i]; });
    MATS_K.forEach((m, i) => { p.mats[m] = r[3][i]; });
    p.rl = r[4]; p.cd = r[5];
    const row = s.P.find((q) => q[0] === p.id);
    p.use = r[6] && row && row[15] >= 0 ? { t: row[15] * r[7], T: r[7], c: r[6] } : null;
  }
  S.projectiles = s.J.map((q) => ({ id: q[0], kind: q[1], x: q[2], y: q[3], z: q[4], vx: q[5], vy: q[6], vz: q[7] }));
}

// ------------------------------------------------------------------ événements : ce qui change le monde de la copie
export function mirrorEvent(sim, world, build, e) {
  const S = sim.S;
  switch (e.e) {
    case 'objet+': S.items.set(e.id, { id: e.id, it: e.it, x: e.x, y: e.y, z: e.z }); S.nextItem = Math.max(S.nextItem, e.id + 1); break;
    case 'objet-': S.items.delete(e.id); break;
    case 'objet~': { const g = S.items.get(e.id); if (g) g.it.n = e.n; break; }
    case 'coffre': { const c = S.chests.get(e.id); if (c) c.open = true; break; }
    case 'porte': { const d = world.doors.get(e.id); if (d) d.swing = e.swing; world.setDoor(e.id, e.open); break; }
    case 'construit': build.mirrorAdd(e.piece); break;
    case 'casse': build.mirrorBreak(e.key); break;
    case 'tremplin': if (!S.pads.some((p) => p.id === e.id)) S.pads.push({ id: e.id, x: e.x, y: e.y, z: e.z, t: 0 }); S.nextProj = Math.max(S.nextProj, e.id + 1); break;
    case 'elim': { const p = S.players.get(e.to); if (p) { p.alive = false; p.place = e.place; p.hp = 0; } if (!S.order.includes(e.to)) S.order.push(e.to); break; }
    case 'fin': S.phase = 'fin'; S.winner = e.winner; S.winTeam = e.team ?? null; break;
    case 'repere': S.pings.set(e.p, { p: e.p, team: e.team, kind: e.kind, x: e.x, y: e.y, z: e.z, target: e.target, what: e.what, t: e.t }); break;
    default: break;
  }
}

// ------------------------------------------------------------------ état complet (pour un retardataire)
export function fullState(sim, world, build) {
  const S = sim.S;
  return {
    items: [...S.items.values()].map((g) => [g.id, encIt(g.it), r2(g.x), r2(g.y), r2(g.z)]),
    chests: [...S.chests.values()].filter((c) => c.open).map((c) => c.id),
    doors: [...world.doors.values()].filter((d) => d.open && !d.dead).map((d) => [d.id, d.swing || 1]),
    broken: [...build.broken],
    pieces: [...build.pieces.values()].map((p) => ({ ...p })),
    pads: S.pads.map((p) => [p.id, r2(p.x), r2(p.y), r2(p.z)]),
    order: [...S.order],
  };
}
export function applyFull(sim, world, build, st) {
  const S = sim.S;
  S.items.clear();
  for (const [id, it, x, y, z] of st.items) { S.items.set(id, { id, it: decIt(it), x, y, z }); S.nextItem = Math.max(S.nextItem, id + 1); }
  for (const id of st.chests) { const c = S.chests.get(id); if (c) c.open = true; }
  for (const [id, sw] of st.doors) { const d = world.doors.get(id); if (d) d.swing = sw; world.setDoor(id, true); }
  // les destructions avant les constructions (une pièce cassée ne revient pas)
  for (const k of st.broken) build.mirrorBreak(k);
  for (const p of st.pieces) build.mirrorAdd(p);
  S.pads = st.pads.map(([id, x, y, z]) => ({ id, x, y, z, t: 0 }));
  S.order = [...st.order];
}

// ------------------------------------------------------------------ commandes (invité → hôte)
const num = (v, a, b) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : 0);
export function cleanInput(m) {
  return {
    mx: num(m.mx, -1, 1), mz: num(m.mz, -1, 1), yaw: num(m.yaw, -1e4, 1e4), pitch: num(m.pitch, -1.6, 1.6),
    fire: !!m.fire, aim: !!m.aim, sprint: !!m.sprint, crouch: !!m.crouch,
    jump: m.jump | 0, use: m.use | 0, reload: m.reload | 0, shoot: m.shoot | 0, drop: m.drop | 0, sel: num(m.sel | 0, 0, 5),
    build: m.build === 'mur' || m.build === 'sol' || m.build === 'escalier' ? m.build : null,
    mat: m.mat === 'pierre' || m.mat === 'metal' ? m.mat : 'bois',
    mv: Array.isArray(m.mv) && m.mv.length === 3 ? [m.mv[0] | 0, Math.max(0, Math.min(4, m.mv[1] | 0)), Math.max(-1, Math.min(4, m.mv[2] | 0))] : null,
  };
}

// ------------------------------------------------------------------ prédiction de l'invité : un pas de son joueur
// h : { mx, mz, yaw, pitch, sprint, crouch, aim, jump (appui ce pas-ci) } ; même calcul que la simulation de l'hôte
export function predictStep(P, h, world, dt) {
  if (!P.alive || P.mode === 'ballon') return;
  if (P.mode === 'chute' || P.mode === 'planeur') { stepAir(P, { ...h }, world, dt); return; }
  if (P.down) { stepPlayer(P, { mx: h.mx, mz: h.mz, yaw: h.yaw, jump: false, sprint: false, crouch: true, k: CRAWL }, world, dt); P.pitch = h.pitch; return; }
  const slow = P.use ? 0.5 : h.aim ? 0.7 : 1;
  stepPlayer(P, { mx: h.mx, mz: h.mz, yaw: h.yaw, jump: h.jump, sprint: h.sprint && !P.use && !h.aim, crouch: h.crouch, k: slow }, world, dt);
  P.pitch = h.pitch;
}
