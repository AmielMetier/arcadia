// Équipiers IA : suivent l'escouade, tirent, relèvent les blessés, ramassent, franchissent les portes.
// Ils produisent des entrées comme un joueur humain (même chemin que le clavier).
import { WEAPONS, GRENADE, CLASSES } from './data.js';
import { distanceField, flowDir, WALL_TOP } from './level.js';
import { raycastSolids, angDiff } from './geom.js';

export function botThink(sim, p, dt) {
  const B = p.brain || (p.brain = { fieldT: 0, field: null, goalKey: '', strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, inp: { mx: 0, my: 0, a: p.aim, fire: false, dash: 0, reload: 0, sw: 0, sl: 0, nade: 0, td: 300, use: false, pk: 0, pi: -1, q: 0, ab: 0 }, nadeCd: 3, useT: 0, think: 0, aimErr: 0 });
  const inp = B.inp;
  inp.use = false;
  if (p.state === 'dead') { inp.mx = inp.my = 0; inp.fire = false; p.input = inp; return; }

  const players = [...sim.players.values()];
  const humans = players.filter((o) => !o.bot && o !== p && o.state === 'ok');
  const allies = players.filter((o) => o !== p && o.state === 'ok');
  const blockers = sim.blockers || sim.lv.solids;

  // ---- menace la plus proche et cible visible
  let near = null, nd = Infinity, tgt = null, td = Infinity;
  const W = WEAPONS[p.weapons[p.slot].id];
  for (const z of sim.zombies) {
    if (z.hp <= 0) continue;
    const d = Math.hypot(z.x - p.x, z.y - p.y);
    if (d < nd) { nd = d; near = z; }
    // priorité : cracheurs, hurleuses et gonflés proches
    let prio = d * (z.ty === 'screamer' || z.ty === 'spitter' ? 0.7 : z.ty === 'bloater' && d < 220 ? 0.5 : 1);
    if (z.state === 'pin') prio *= 0.2; // libérer un allié plaqué au sol
    if (z.ty === 'armored' && Math.abs(((Math.atan2(p.y - z.y, p.x - z.x) - z.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.9) prio *= 1.6;
    if (prio < td && d < W.range * 0.95 && !raycastSolids(blockers, p.x, p.y, z.x, z.y)) { td = prio; tgt = z; }
  }

  // ---- but de déplacement
  let goal = null, goalTight = 60, stopAtGoal = false;
  const downed = players.filter((o) => o !== p && o.state === 'down');
  if (p.state === 'ok' && downed.length) {
    const d = downed.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    const danger = sim.zombies.some((z) => Math.hypot(z.x - d.x, z.y - d.y) < 110);
    if (!danger || Math.hypot(d.x - p.x, d.y - p.y) < 70) { goal = d; goalTight = 46; stopAtGoal = true; if (Math.hypot(d.x - p.x, d.y - p.y) < 62) inp.use = true; }
  }
  if (!goal && p.state === 'ok') {
    let pick = null, pd = 520;
    for (const k of sim.pickups) {
      const d = Math.hypot(k.x - p.x, k.y - p.y);
      if (d > pd) continue;
      let want = false;
      if (k.k === 'weapon') want = WEAPONS[k.w].tier > Math.max(...p.weapons.map((w) => WEAPONS[w.id].tier)) && !p.weapons.some((w) => w.id === k.w) && nd > 200;
      else if (k.k === 'med') want = p.hp < p.maxHp * 0.6;
      else if (k.k === 'ammo') want = sim.wants(p, 'ammo') && p.weapons.some((w) => w.res !== Infinity && w.res < WEAPONS[w.id].resMax * 0.5);
      else want = sim.wants(p, k.k) && nd > 250;
      // laisser les objets aux humains qui en ont plus besoin
      if (want && k.k === 'med' && humans.some((h) => h.hp < p.hp && Math.hypot(h.x - k.x, h.y - k.y) < d)) want = false;
      if (want) { pd = d; pick = k; }
    }
    if (pick) { goal = pick; goalTight = 10; if (pick.k === 'weapon' && pd < 40) { B.useT += dt; if (B.useT > 0.15) { inp.use = true; B.useT = 0; } } }
  }
  if (!goal && p.state === 'ok' && sim.evt && sim.evt.k === 'drop' && sim.evt.st === 'land' && nd > 90) { goal = { x: sim.evt.x, y: sim.evt.y }; goalTight = 70; stopAtGoal = true; }
  // Défense : réparer les barricades abîmées quand ça se calme, sinon rester près du fort
  if (!goal && p.state === 'ok' && sim.base) {
    const quiet = sim.zombies.filter((z) => Math.hypot(z.x - p.x, z.y - p.y) < 350).length === 0;
    let bar = null, worst = 0.85;
    for (const b of sim.base.bars) { const f = b.hp / b.max; if (f < worst) { worst = f; bar = b; } }
    if (bar && quiet) {
      const g = sim.base.gen, bx = bar.x + bar.w / 2, by = bar.y + bar.h / 2;
      const ix = bx + Math.sign(g.x - bx) * (Math.abs(g.x - bx) > 5 ? 45 : 0), iy = by + Math.sign(g.y - by) * (Math.abs(g.y - by) > 5 ? 45 : 0);
      goal = { x: ix, y: iy }; goalTight = 20; stopAtGoal = true;
      if (Math.hypot(bx - p.x, by - p.y) < 70) inp.use = true;
    } else if (!humans.length && Math.hypot(sim.base.gen.x - p.x, sim.base.gen.y - p.y) > 230) { goal = { x: sim.base.gen.x + (p.id % 3) * 60 - 60, y: sim.base.gen.y + 120 }; goalTight = 60; }
  }
  if (!goal && sim.doorsOpen && p.state === 'ok' && !sim.zombies.length) {
    const doors = sim.lv.doors.filter((d) => d.kind === 'exit');
    let door = sim.rally ? doors.find((d) => d.id === sim.rally.door) : null;
    if (!door && !humans.length) door = doors[0];
    if (!door && humans.length) {
      // suivre le choix des humains s'ils s'approchent d'une porte
      const h = humans[0];
      const close = doors.find((d) => Math.abs(h.x - (d.x + d.w / 2)) < 200 && h.y < WALL_TOP + 300);
      if (close) door = close;
    }
    if (door) { goal = { x: door.x + door.w / 2, y: WALL_TOP + 30 }; goalTight = 20; }
  }
  if (!goal) {
    const lead = (humans.length ? humans : allies).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (lead) {
      const d = Math.hypot(lead.x - p.x, lead.y - p.y);
      if (d > 220) { goal = lead; goalTight = 140; }
    }
  }

  // ---- direction
  let mx = 0, my = 0;
  if (goal) {
    const d = Math.hypot(goal.x - p.x, goal.y - p.y);
    if (d > goalTight) {
      const key = Math.round(goal.x / 64) + ':' + Math.round(goal.y / 64);
      B.fieldT -= dt;
      const direct = !sim.solidsNow?.some((s) => {
        const minX = Math.min(p.x, goal.x) - 20, maxX = Math.max(p.x, goal.x) + 20, minY = Math.min(p.y, goal.y) - 20, maxY = Math.max(p.y, goal.y) + 20;
        if (s.x > maxX || s.x + s.w < minX || s.y > maxY || s.y + s.h < minY) return false;
        return !!raycastSolids([{ ...s, low: false }], p.x, p.y, goal.x, goal.y, 18);
      });
      if (direct || d < 50) { mx = (goal.x - p.x) / d; my = (goal.y - p.y) / d; }
      else {
        if (B.goalKey !== key || B.fieldT <= 0 || !B.field) { B.field = distanceField(sim.lv, [goal]); B.goalKey = key; B.fieldT = 0.6; }
        const f = flowDir(sim.lv, B.field, p.x, p.y);
        if (f) { mx = f.x; my = f.y; } else { mx = (goal.x - p.x) / d; my = (goal.y - p.y) / d; }
      }
    } else if (stopAtGoal) { mx = my = 0; }
  }
  // garder ses distances avec les zombies (sauf pendant une réanimation)
  if (near && !inp.use) {
    const kite = near.ty === 'brute' || near.r > 30 ? 260 : near.ty === 'bloater' ? 200 : 140;
    if (nd < kite) {
      const ax = (p.x - near.x) / nd, ay = (p.y - near.y) / nd;
      const w = 1.4 * (1 - nd / kite) + 0.6;
      mx += ax * w; my += ay * w;
      // un peu de côté pour ne pas reculer dans un mur
      mx += -ay * B.strafe * 0.5; my += ax * B.strafe * 0.5;
      B.strafeT -= dt; if (B.strafeT <= 0) { B.strafe = -B.strafe; B.strafeT = 1.5 + Math.random() * 2; }
      if (nd < near.r + 40 && p.dashCharges > 0 && (p.hp < p.maxHp * 0.7 || near.ty === 'brute' || near.r > 30) && Math.random() < 0.08) inp.dash++;
    }
  }
  // éviter les flaques d'acide
  for (const h of sim.hazards) {
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    if (d < h.r + 30 && d > 1) { mx += ((p.x - h.x) / d) * 1.5; my += ((p.y - h.y) / d) * 1.5; }
  }
  // métro : quitter les voies quand la rame arrive
  if (sim.train && sim.train.st !== 'idle' || (sim.train && sim.train.t < 3)) {
    const tz = sim.lv.zones.find((z) => z.k === 'track');
    if (tz && p.y > tz.y - 30 && p.y < tz.y + tz.h + 30) { mx *= 0.3; my = p.y < tz.y + tz.h / 2 ? -1.5 : 1.5; }
  }
  // charge d'une brute : s'écarter de la ligne
  for (const z of sim.zombies) {
    if ((z.state === 'tele' || z.state === 'charge') && Math.hypot(z.x - p.x, z.y - p.y) < 600) {
      const ca = Math.cos(z.lockA), sa = Math.sin(z.lockA);
      const rx = p.x - z.x, ry = p.y - z.y, along = rx * ca + ry * sa, side = -rx * sa + ry * ca;
      if (along > 0 && Math.abs(side) < z.r + 40) { const s = side >= 0 ? 1 : -1; mx += -sa * s * 2.2; my += ca * s * 2.2; if (z.state === 'charge' && along < 160 && p.dashCharges > 0) inp.dash++; }
    }
  }
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  inp.mx = mx; inp.my = my;

  // ---- visée et tir
  if (tgt) {
    const d = Math.hypot(tgt.x - p.x, tgt.y - p.y);
    const lead = W.rail ? 0 : d / W.speed;
    const ax = tgt.x + (tgt.vx || 0) * lead, ay = tgt.y + (tgt.vy || 0) * lead;
    B.aimErr += (Math.random() - 0.5) * 0.08; B.aimErr *= 0.9;
    const want = Math.atan2(ay - p.y, ax - p.x) + B.aimErr;
    inp.a = p.aim + angDiff(p.aim, want) * Math.min(1, dt * 14);
    const onTarget = Math.abs(angDiff(inp.a, want)) < 0.18;
    inp.fire = onTarget && !inp.use && (W.id !== 'shotgun' || d < 340) && (!W.explosive || d > 170) && (!W.flame || d < W.range);
  } else {
    inp.fire = W.spinUp ? !!near && nd < 500 : false;
    if (ml > 0.2) inp.a = p.aim + angDiff(p.aim, Math.atan2(my, mx)) * Math.min(1, dt * 6);
  }

  // ---- recharge, changement d'arme, grenade
  const w = p.weapons[p.slot];
  if (p.reloadT <= 0 && w.res > 0 && w.mag < W.mag * 0.4 && (!near || nd > 380)) inp.reload++;
  if (p.state === 'ok' && p.reloadT <= 0) {
    // meilleure arme encore chargée
    let best = 0, bt = -1;
    p.weapons.forEach((x, i) => { const X = WEAPONS[x.id]; const ok = x.mag > 0 || x.res > 0; const sc = ok ? X.tier * 10 + (X.id === 'shotgun' && nd < 260 ? 15 : 0) + (X.explosive && nd < 200 ? -30 : 0) + (X.melee ? (nd < 110 ? 20 : -25) : 0) : -100; if (sc > bt) { bt = sc; best = i; } });
    if (best !== p.slot && Math.random() < dt * 3) { inp.sw++; inp.sl = best; }
  }
  if (p.pinnedBy != null && Math.random() < dt * 6) inp.dash++; // se débattre
  // capacité de classe
  if (p.state === 'ok' && p.abCd <= 0 && p.pinnedBy == null) {
    const close = (r) => sim.zombies.filter((z) => Math.hypot(z.x - p.x, z.y - p.y) < r).length;
    let go = false;
    if (p.cls === 'soldier') go = close(420) >= 6;
    else if (p.cls === 'medic') go = players.some((o) => o.state === 'down' && Math.hypot(o.x - p.x, o.y - p.y) < 150) || players.filter((o) => o.state === 'ok' && o.hp < o.maxHp * 0.55 && Math.hypot(o.x - p.x, o.y - p.y) < 160).length >= 2 || p.hp < p.maxHp * 0.35;
    else if (p.cls === 'engineer') go = close(500) >= 4;
    else if (p.cls === 'tank') go = close(260) >= 4 || players.some((o) => o.state === 'down' && Math.hypot(o.x - p.x, o.y - p.y) < 200);
    else if (p.cls === 'scout') go = p.hp < p.maxHp * 0.4 && close(200) >= 2;
    if (go) inp.ab++;
  }
  B.nadeCd -= dt;
  if (p.state === 'ok' && p.grenades > 0 && B.nadeCd <= 0) {
    for (const z of sim.zombies) {
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      if (d < 200 || d > GRENADE.maxThrow) continue;
      const crowd = sim.zombies.filter((o) => Math.hypot(o.x - z.x, o.y - z.y) < 130).length;
      if (crowd >= 5 || (z.ty === 'brute' && d < 380)) {
        inp.a = Math.atan2(z.y - p.y, z.x - p.x); inp.td = d; inp.nade++; B.nadeCd = 6 + Math.random() * 4; break;
      }
    }
  }
  p.input = inp;
}
