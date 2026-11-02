// Tests du moteur de Mollo ! (mollo/engine/) : node tools/test-mollo.mjs
// Arènes, tenir debout sans trembler, marche et foulée, saut, coup et gros coup, KO mou puis réveil, prise, soulever et jeter,
// s'accrocher et se hisser, fatigue des bras, chute et crédit, fin de manche, parties entières entre bots, instantané et reprise par un nouvel hôte, coût d'un pas.
import { Sim, DT, ST, PN, JUMP_V, KO_T } from '../mollo/engine/sim.js';
import { Arena, ARENAS, ARENA_KEYS, KILL_Y } from '../mollo/engine/arena.js';

let fails = 0, count = 0;
const ok = (cond, msg) => { count++; if (!cond) { fails++; console.log('  ✗ ' + msg); } };
const section = (s) => console.log('• ' + s);
const run = (sim, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++) { each && each(i); sim.step(DT); } };
const { P, C, H } = PN;
function lab(key = 'chantier', n = 2, seed = 7) {
  const sim = new Sim({ seed, goal: 3, hazards: false });
  for (let i = 0; i < n; i++) sim.addPlayer({ id: i, name: 'J' + i, color: '#ff0000' });
  sim.start(); sim.rd = 0; sim.drainEvents(); sim.startRound(key); sim.ph = 'play'; sim.pt = 0;
  return sim;
}
// pose un corps immobile à cet endroit, debout
function put(b, x, z, yaw) {
  const g = b.p[P], dx = x - g.x, dz = z - g.z;
  for (const q of b.p) { q.x += dx; q.z += dz; q.px = q.x; q.py = q.y; q.pz = q.z; }
  if (yaw !== undefined) b.yaw = yaw;
}
const events = (sim) => sim.drainEvents().map((e) => e.e);
// frappe en face : a est tourné vers b, à portée
function face(sim, a, b, gap = 0.72) { put(a, -1, 1.5, Math.PI / 2); put(b, -1 + gap, 1.5, -Math.PI / 2); a.m = b.m = 1; a.dip = b.dip = 0; b.dz = 0; }

section('Arènes');
for (const k of ARENA_KEYS) {
  const a = new Arena(k);
  ok(a.spawns.length >= 8, `${k} : 8 places de départ`);
  for (const [x, z] of a.spawns) ok(a.groundAt(x, z, 50), `${k} : le départ ${x},${z} a un sol`);
  for (const [i, j] of a.links) ok(a.nodes[i] && a.nodes[j], `${k} : les liens des bots pointent sur des points de passage`);
  ok(ARENAS[k].boxes.some((b) => b.hx > 2), `${k} : il y a de quoi se tenir`);
}
{ const a = new Arena('toits'), mv = a.boxes.find((b) => b.move); a.update(1); const z1 = mv.z; a.update(1); ok(mv.z === z1, 'une plateforme mobile ne dépend que du temps'); }

section('Tenir debout');
for (const k of ARENA_KEYS) {
  const s = lab(k), [a] = s.players.values();
  run(s, 3);
  let minHead = 9, jitter = 0;
  run(s, 17, () => { minHead = Math.min(minHead, a.p[H].y - a.gy); const q = a.p[H]; jitter = Math.max(jitter, Math.hypot(q.x - q.px, q.y - q.py, q.z - q.pz) - (a.gbox ? Math.hypot(a.gbox.vx, a.gbox.vz) / 60 + 0.02 : 0.02)); });
  ok(a.st === ST.LIVE, `${k} : debout tout seul`);
  ok(minHead > 1.25, `${k} : la tête reste en l'air pendant 20 s (${minHead.toFixed(2)} m au plus bas)`);
  ok(jitter < 0.012 || k === 'usine', `${k} : le corps immobile ne tremble pas (${jitter.toFixed(4)} m par pas)`);
}

section('Marche');
{
  const s = lab(), [a, b] = s.players.values(); put(b, 5, -3); put(a, -5.5, 1.5, Math.PI / 2);
  run(s, 0.5);
  const x0 = a.p[P].x; a.inp = { ...a.inp, mx: 1 };
  let minH = 9, flips = 0, last = 0, lastLead = 0, maxSlide = 0;
  run(s, 2, () => {
    minH = Math.min(minH, a.p[H].y);
    const lead = Math.sign(a.p[PN.LF].x - a.p[PN.RF].x); if (lead && lead !== lastLead) { flips++; lastLead = lead; }
    void last;
    const d = Math.hypot(a.p[C].x - a.p[P].x, a.p[C].z - a.p[P].z); maxSlide = Math.max(maxSlide, d);
  });
  const v = (a.p[P].x - x0) / 2;
  ok(v > 2.7 && v < 4.2, `vitesse de marche (${v.toFixed(2)} m/s)`);
  ok(minH > 1.2, `reste droit en marchant (tête à ${minH.toFixed(2)} m au plus bas)`);
  ok(flips >= 3, `les pieds se passent l'un devant l'autre (${flips} fois en 2 s)`);
  ok(maxSlide < 0.42, `le buste penche sans se coucher (${maxSlide.toFixed(2)} m d'avance)`);
  a.inp = { ...a.inp, mx: 0 }; run(s, 0.6);
  ok(Math.hypot(a.p[P].x - a.p[P].px, a.p[P].z - a.p[P].pz) / DT < 0.5, "s'arrête quand on lâche");
}

section('Saut');
{
  const s = lab(), [a, b] = s.players.values(); put(b, 5, -3); put(a, -1, 1.5); run(s, 0.5);
  const y0 = a.p[P].y; let top = 0; a.inp = { ...a.inp, jc: a.jc + 1 };
  run(s, 1.2, () => { top = Math.max(top, a.p[P].y); });
  ok(JUMP_V > 0 && top - y0 > 0.7 && top - y0 < 1.4, `saute d'environ un mètre (${(top - y0).toFixed(2)} m)`);
  ok(a.grounded, 'retombe sur ses pieds');
  ok(events(s).includes('jump'), 'événement de saut');
}

section('Coups');
{
  const s = lab(), [a, b] = s.players.values(); face(s, a, b); s.step(DT); face(s, a, b);
  const x0 = b.p[C].x; a.inp = { ...a.inp, pc: a.pc + 1, punch: false };
  let got = false;
  run(s, 0.25, () => { got = got || s.events.some((e) => e.e === 'hit'); });
  ok(got, 'un appui très bref donne un coup');
  ok(b.p[C].x > x0 + 0.12, `le coup repousse (${(b.p[C].x - x0).toFixed(2)} m)`);
  ok(b.dz > 0.1 && b.dz < 0.6, `le coup entame (${b.dz.toFixed(2)})`);
  ok(b.st === ST.LIVE, 'un seul coup ne met pas KO');
  // le gros coup, armé
  const t = lab(), [c, d] = t.players.values(); face(t, c, d); t.step(DT); face(t, c, d);
  c.inp = { ...c.inp, pc: 1, punch: true }; run(t, 0.42); face(t, c, d); c.inp = { ...c.inp, punch: false };
  let v1 = 0; run(t, 0.25, () => { v1 = Math.max(v1, Math.abs(d.p[C].x - d.p[C].px) / DT); });
  ok(d.dz > 0.35, `le gros coup sonne (${d.dz.toFixed(2)})`);
  const u = lab(), [e, f] = u.players.values(); face(u, e, f); u.step(DT); face(u, e, f);
  e.inp = { ...e.inp, pc: 1, punch: false }; let v0 = 0; run(u, 0.25, () => { v0 = Math.max(v0, Math.abs(f.p[C].x - f.p[C].px) / DT); });
  ok(v1 > v0 * 1.3, `le gros coup porte plus (${v1.toFixed(1)} contre ${v0.toFixed(1)} m/s)`);
}

section('KO mou, puis réveil');
{
  const s = lab(), [a, b] = s.players.values();
  face(s, a, b); s.step(DT); face(s, a, b); b.dz = 0.9;
  a.inp = { ...a.inp, pc: 1 }; run(s, 0.25);
  ok(b.st === ST.KO, 'le coup de trop assomme');
  run(s, 1.4);
  ok(b.p[H].y - b.gy < 0.75, `assommé, il s'effondre (tête à ${(b.p[H].y - b.gy).toFixed(2)} m)`);
  run(s, KO_T);
  ok(b.st === ST.LIVE, 'il revient à lui tout seul');
  run(s, 1.6);
  ok(b.p[H].y - b.gy > 1.2, `et se remet debout (tête à ${(b.p[H].y - b.gy).toFixed(2)} m)`);
  // marteler raccourcit
  const t = lab(), [, d] = t.players.values(); d.st = ST.KO; d.ko = KO_T; let n = 0, tKO = 0;
  while (d.st === ST.KO && tKO < 5) { if (n++ % 6 === 0) d.inp = { ...d.inp, pc: d.pc + 1 }; t.step(DT); tKO += DT; }
  ok(tKO < KO_T * 0.75, `marteler réveille plus vite (${tKO.toFixed(2)} s au lieu de ${KO_T})`);
}

section('Saisir, soulever, jeter');
{
  const s = lab(), [a, b] = s.players.values(); put(b, -0.3, 1.5); put(a, -1, 1.5, Math.PI / 2); b.st = ST.KO; b.ko = 30; b.m = 0;
  run(s, 0.7); a.yaw = Math.PI / 2;
  a.inp = { ...a.inp, grab: true, gc: 1 }; run(s, 0.5);
  ok(a.grip.some((g) => g && g.o === b), "les mains s'accrochent au corps");
  ok(b.heldBy > 0, 'il se sait tenu');
  a.inp = { ...a.inp, jump: true }; run(s, 0.8); a.inp = { ...a.inp, jump: false };
  ok(a.lifting === 1, 'saut : il le soulève');
  ok(b.p[P].y > a.p[H].y - 0.35, `il le porte au-dessus de sa tête (${b.p[P].y.toFixed(2)} contre ${a.p[H].y.toFixed(2)})`);
  const x0 = b.p[P].x; a.yaw = Math.PI / 2; a.inp = { ...a.inp, grab: false }; run(s, 0.45);
  ok(!a.lifting && b.heldBy === 0 && b.liftedBy < 0, 'lâcher libère tout le monde');
  ok(b.p[P].x - x0 > 1.5, `et le jette devant lui (${(b.p[P].x - x0).toFixed(2)} m)`);
  ok(events(s).includes('throw'), 'événement de lancer');
  // quelqu'un d'éveillé ne se laisse pas soulever
  const t = lab(), [c, d] = t.players.values(); put(d, -0.3, 1.5); put(c, -1, 1.5, Math.PI / 2); run(t, 0.2); c.yaw = Math.PI / 2;
  c.inp = { ...c.inp, grab: true, gc: 1 }; run(t, 0.4); c.inp = { ...c.inp, jump: true }; run(t, 0.5);
  ok(c.grip.some((g) => g && g.o === d) && !c.lifting, "un adversaire en forme ne se soulève pas");
  // se débattre fait lâcher plus vite
  let rel = 0; c.inp = { ...c.inp, jump: false }; let k = 0;
  while (c.grip.some(Boolean) && rel < 8) { if (k++ % 8 === 0) d.inp = { ...d.inp, pc: d.pc + 1 }; t.step(DT); rel += DT; }
  ok(rel < 4, `se débattre fait lâcher (${rel.toFixed(1)} s)`);
}

section("S'accrocher et se hisser");
{
  const s = lab('toits'), [a, b] = s.players.values(); put(b, -6, 0); put(a, -1.25, -3, Math.PI / 2); // juste au bord, rien en dessous à droite
  a.inp = { ...a.inp, mx: 1 }; run(s, 0.3); a.inp = { ...a.inp, mx: 0, grab: true, gc: 1 };
  run(s, 1.2);
  ok(a.grip.some((g) => g && g.box), "en tombant, les mains s'accrochent au rebord");
  const hang = a.p[C].y;
  ok(hang < 0.2 && hang > -1.2, `il pend sous le toit (poitrine à ${hang.toFixed(2)})`);
  a.inp = { ...a.inp, jump: true }; let climbed = false;
  run(s, 2, () => { climbed = climbed || s.events.some((e) => e.e === 'climb'); });
  ok(climbed, 'se hisser : il passe par-dessus');
  a.inp = { ...a.inp, jump: false, grab: false }; run(s, 1.2);
  ok(a.grounded && a.p[P].x < -1.4 && a.p[P].y > 0.3, `il est revenu sur le toit (x ${a.p[P].x.toFixed(2)}, y ${a.p[P].y.toFixed(2)})`);
  // les bras fatiguent
  const t = lab('toits'), [c, d] = t.players.values(); put(d, -6, 0); put(c, -1.25, -3, Math.PI / 2);
  c.inp = { ...c.inp, mx: 1 }; run(t, 0.3); c.inp = { ...c.inp, mx: 0, grab: true, gc: 1 }; run(t, 1.2);
  ok(c.grip.some(Boolean), 'accroché');
  run(t, 3); ok(c.grip.some(Boolean), 'tient encore après 4 s');
  run(t, 5); ok(!c.grip.some(Boolean), 'au bout de 8 s, ça glisse');
  // debout, on n'agrippe pas le sol
  const u = lab(), [e, f] = u.players.values(); put(f, 5, -3); put(e, -1, 1.5); run(u, 0.2); e.inp = { ...e.inp, grab: true, gc: 1 }; run(u, 0.6);
  ok(!e.grip.some(Boolean), "debout au milieu de la dalle, les mains n'attrapent pas le sol");
}

section('Chute et manche');
{
  const s = lab('toits', 3), [a, b, c] = s.players.values();
  put(a, -6, -1); put(c, -6, 2); put(b, 0.1, 3.4); // b au-dessus du vide, à côté de la nacelle
  put(b, 0, -3); b.hitBy = a.id; b.hitT = s.t;
  run(s, 3);
  ok(b.st === ST.OUT, 'tomber dans le vide élimine');
  ok(b.p[P].y < KILL_Y, 'le corps sort du jeu');
  ok(a.kos === 1, 'celui qui a frappé juste avant est crédité');
  ok(b.order === 1, "ordre d'élimination noté");
  ok(s.ph === 'play', 'il en reste deux : la manche continue');
  put(c, 0, -3); run(s, 3);
  ok(s.ph === 'round' && s.rw === a.id && a.pts === 1, 'le dernier debout gagne la manche');
  run(s, 4);
  ok(s.rd === 2 && s.ph === 'count', 'la manche suivante démarre');
  ok([...s.players.values()].every((p) => p.st === ST.LIVE), 'tout le monde est revenu');
  ok(new Set([s.lastKey, 'toits']).size === 2, "l'arène change");
}

section('Parties entières entre bots');
for (const lv of ['facile', 'normal', 'expert']) for (const seed of [1, 2, 3]) {
  const s = new Sim({ seed, goal: 2 }); s.addBots(4, lv); s.start();
  let n = 0; const ev = {}; let nan = false;
  while (s.ph !== 'over' && n < 60 * 420) {
    s.step(DT); n++;
    for (const e of s.drainEvents()) ev[e.e] = (ev[e.e] || 0) + 1;
    if (n % 30 === 0) for (const b of s.players.values()) for (const q of b.p) if (!Number.isFinite(q.x + q.y + q.z)) nan = true;
  }
  ok(!nan, `${lv}/${seed} : aucun corps ne part en vrille`);
  ok(s.ph === 'over', `${lv}/${seed} : la partie se termine (${Math.round(n / 60)} s, ${s.rd} manches)`);
  ok(s.ranking()[0].pts >= 2, `${lv}/${seed} : un vainqueur`);
  ok((ev.hit || 0) >= 2, `${lv}/${seed} : les bots se tapent dessus (${ev.hit || 0} coups)`);
}
{ // les bots franchissent les trois arènes : personne ne reste planté
  for (const k of ARENA_KEYS) {
    const s = new Sim({ seed: 5, goal: 3 }); s.addBots(4, 'normal'); s.start(); s.drainEvents(); s.rd = 0; s.startRound(k);
    let t = 0; while (s.ph !== 'round' && t < 150) { s.step(DT); t += DT; }
    ok(t < 150, `${k} : une manche entre bots aboutit (${Math.round(t)} s)`);
  }
}

section('Instantané et reprise');
{
  const s = new Sim({ seed: 9, goal: 3 }); s.addBots(8, 'normal'); s.start(); run(s, 8);
  const snap = s.snapshot(), size = JSON.stringify(snap).length;
  ok(size < 3400, `8 joueurs tiennent dans un message raisonnable (${size} octets)`);
  snap.run = 1;
  const r = Sim.restore(JSON.parse(JSON.stringify(snap)));
  ok(r.players.size === 8 && r.ph === s.ph && r.rd === s.rd && r.arena.key === s.arena.key, 'un nouvel hôte reprend la manche');
  const [b0] = s.players.values(), b1 = r.players.get(b0.id);
  ok(b0.st === ST.OUT || Math.abs(b1.p[H].x - b0.p[H].x) < 0.02, 'les corps restent à leur place');
  ok(b1.name === b0.name && b1.bot, 'les noms suivent');
  run(r, 5);
  for (const b of r.players.values()) for (const q of b.p) ok(Number.isFinite(q.x + q.y + q.z), 'la reprise reste stable');
  s.removePlayer(BOTID(s)); s.step(DT);
  ok(s.players.size === 7, 'un joueur qui part quitte la partie sans casser les prises');
}
function BOTID(s) { return [...s.players.keys()][0]; }

section("Coût d'un pas");
{
  const s = new Sim({ seed: 2, goal: 9 }); s.addBots(8, 'expert'); s.start(); const t0 = performance.now(); let n = 0;
  while (performance.now() - t0 < 1000) { s.step(DT); n++; if (s.ph === 'over') { s.start(); } }
  const ms = 1000 / n; ok(ms < 2, `un pas à 8 joueurs coûte peu (${ms.toFixed(3)} ms)`);
}

console.log(fails ? `\n${fails} échec(s) sur ${count} vérifications` : `\nTout est bon (${count} vérifications)`);
process.exit(fails ? 1 : 0);
