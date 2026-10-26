// Island Rush — les bots. Un bot lit la partie comme un joueur (ce qu'il voit, ce qu'il entend, la tempête, son sac)
// et écrit les mêmes commandes qu'un joueur dans P.inp : la simulation les traite pareil. Il saute de la
// montgolfière vers un lieu choisi, fouille coffres et butin, se soigne, suit la zone et se bat. Trois niveaux
// (facile, normal, difficile) : portée de vue, temps de réaction, précision et vitesse de visée. Les bots ne
// construisent pas. Moteur PUR, branché par sim.S.hooks.think ; ne tourne que là où la partie tourne.
import { createNav } from './nav.js';
import { makeRng, hash } from './rng.js';
import { WEAPONS, ITEMS } from './items.js';

export const LEVELS = {
  facile: { see: 40, cone: 0.35, react: [0.75, 1.3], err: 0.085, turn: 3.2, burst: [0.45, 0.75], head: 0.04, strafe: 0.35, hop: 0, nade: 0 },
  normal: { see: 55, cone: 0.1, react: [0.42, 0.75], err: 0.05, turn: 5.5, burst: [0.9, 0.4], head: 0.14, strafe: 0.7, hop: 0.12, nade: 0.5 },
  difficile: { see: 80, cone: -0.25, react: [0.22, 0.42], err: 0.026, turn: 9, burst: [1.6, 0.2], head: 0.3, strafe: 1, hop: 0.3, nade: 1 },
};
const WSCORE = { fusil: 10, pompe: 9.5, smg: 8, sniper: 7, roquette: 6.5, pistolet: 4.5 };
const WANT_D = { pompe: 5, smg: 11, pistolet: 14, fusil: 24, sniper: 60, roquette: 22 };
// au-delà, on ne cherche pas la bagarre (on continue sa fouille ou sa route, sauf si on est pris pour cible)
const ENGAGE = { pompe: 18, smg: 32, pistolet: 32, fusil: 50, sniper: 110, roquette: 45 };
const ISCORE = { potion: 8, soin: 6, potion_petite: 5, bandage: 3, grenade: 2.5, souffle: 0.5, tremplin: 0.3 };
const RUN = 5.6;

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createAI(sim, map, world) {
  const S = sim.S;
  const nav = createNav(map, world);
  const queue = [];               // bots qui attendent un chemin (un calcul par pas)
  const claims = new Map();       // cible → bot qui y va
  let lastT = -1;

  // ------------------------------------------------------------------ outils
  const weaponFit = (w, d) => ({
    pompe: d < 9 ? 10 : d < 18 ? 4 : 0.5, smg: d < 25 ? 8 : d < 45 ? 5 : 2, fusil: d < 8 ? 6 : d < 70 ? 9 : 6,
    pistolet: d < 30 ? 5 : 3, sniper: d > 40 ? 11 : d > 18 ? 6 : 1, roquette: d > 9 && d < 60 ? 8 : d >= 60 ? 4 : 0,
  })[w];
  const usable = (P, it) => it && it.t === 'arme' && (it.mag > 0 || P.ammo[WEAPONS[it.w].ammo] > 0);
  const armed = (P) => P.inv.some((it) => usable(P, it));
  function bestSlot(P, d) {
    let best = 0, bs = 0, cur = 0;
    P.inv.forEach((it, i) => {
      if (!usable(P, it)) return;
      const s = weaponFit(it.w, d) * (1 + 0.15 * it.r) * (it.mag > 0 ? 1 : 0.4);
      if (i + 1 === P.sel) cur = s;
      if (s > bs) { bs = s; best = i + 1; }
    });
    // on garde l'arme en main si elle fait presque aussi bien (changer coûte un quart de seconde)
    return cur >= bs * 0.8 && cur > 0 ? P.sel : best;
  }
  const slotValue = (it) => (!it ? 0 : it.t === 'arme' ? WSCORE[it.w] * (1 + 0.18 * it.r) : ISCORE[it.c] || 0);
  function worstSlot(P) {
    let w = -1, ws = Infinity;
    P.inv.forEach((it, i) => { const v = slotValue(it); if (v < ws) { ws = v; w = i; } });
    return { i: w, v: ws };
  }
  // ce que vaut un objet au sol pour ce bot (0 : il n'en veut pas) ; swap : la case à libérer
  function want(P, it) {
    if (it.t === 'munitions') {
      const used = P.inv.some((s) => s && s.t === 'arme' && WEAPONS[s.w].ammo === it.a);
      return { v: used && P.ammo[it.a] < 90 ? 4 : 0 };
    }
    if (it.t === 'materiaux') return { v: 0 };
    const free = P.inv.some((s) => !s);
    let v;
    if (it.t === 'arme') {
      const same = P.inv.find((s) => s && s.t === 'arme' && s.w === it.w);
      if (same) { v = it.r > same.r ? (it.r - same.r) * 3 : 0; if (v) return { v, swap: P.inv.indexOf(same) }; return { v: 0 }; }
      const nW = P.inv.filter((s) => s && s.t === 'arme').length;
      v = WSCORE[it.w] * (1 + 0.18 * it.r) * (nW === 0 ? 2 : 1);
      if (nW >= 3) {
        let wi = -1, wv = Infinity;
        P.inv.forEach((s, i) => { if (s && s.t === 'arme' && slotValue(s) < wv) { wv = slotValue(s); wi = i; } });
        return v > wv + 2 ? { v: v - wv, swap: wi } : { v: 0 };
      }
    } else {
      const I = ITEMS[it.c];
      const stack = P.inv.find((s) => s && s.t === 'objet' && s.c === it.c && s.n < I.stack);
      v = ISCORE[it.c] || 0;
      if (I.shield && P.sh >= (I.maxShield || 100) && P.inv.some((s) => s && s.c === it.c)) v *= 0.4;
      if (stack) return { v };
    }
    if (free) return { v };
    const w = worstSlot(P);
    return v > w.v + 2 ? { v: v - w.v, swap: w.i } : { v: 0 };
  }
  function needHeal(P) {
    for (let i = 0; i < 5; i++) {
      const it = P.inv[i];
      if (!it || it.t !== 'objet') continue;
      const I = ITEMS[it.c];
      if (I.heal && P.hp < Math.min(I.max, 100) - 15 && P.hp < 80) return i + 1;
      if (I.shield && P.sh < I.maxShield - 20) return i + 1;
    }
    return 0;
  }
  function stormDanger(P) {
    const st = S.storm;
    if (!st || !st.cur) return 0;
    const dc = Math.hypot(P.x - st.cur.x, P.z - st.cur.z), dn = Math.hypot(P.x - st.next.x, P.z - st.next.z);
    if (dc > st.cur.r - 4) return 2;
    if (st.state === 'fermeture' && dn > st.next.r - 5) return 2;
    if (st.state === 'attente' && dn > st.next.r - 5) { const need = (dn - st.next.r * 0.6) / RUN + 12; if (st.left < need) return 1; }
    return 0;
  }

  // ------------------------------------------------------------------ montgolfière : où sauter
  const dropCount = new Map();
  function chooseDrop(P, B) {
    const f = S.flight, cands = [];
    const lineD = (x, z) => Math.abs((x - f.x0) * f.uz - (z - f.z0) * f.ux);
    for (const b of map.buildings) {
      if (!b.chests.length && B.rng.next() < 0.6) continue;
      const d = b.doors.find((q) => q.ext && q.k === 0);
      if (!d) continue;
      const x = (d.o === 'h' ? (d.x + 0.5) * 4 : d.x * 4) + d.nx * 4, z = (d.o === 'h' ? d.z * 4 : (d.z + 0.5) * 4) + d.nz * 4;
      // à portée de vol plané de la ligne de la montgolfière, et pas tous au même endroit
      if (lineD(x, z) > 230) continue;
      const w = (b.chests.length + 1) / (1 + (dropCount.get(b.id) || 0) * 4);
      cands.push([{ x, z, b: b.id }, w]);
    }
    for (const c of map.chests) if (c.b < 0 && lineD(c.x, c.z) < 230) cands.push([{ x: c.x + 2, z: c.z + 2, b: -1 }, 0.8]);
    if (!cands.length) return { x: map.center, z: map.center };
    const pick = B.rng.weighted(cands);
    dropCount.set(pick.b, (dropCount.get(pick.b) || 0) + 1);
    return pick;
  }

  // ------------------------------------------------------------------ chemins
  function setGoal(P, B, g) {
    B.goal = g; B.path = null; B.wp = 0; B.stuckN = 0;
    if (g) { g.tries = 0; g.since = S.t; askPath(P, B); }
  }
  function askPath(P, B) { if (!B.waiting) { B.waiting = true; queue.push(P); } }
  function plan(P) {
    const B = P.ai;
    B.waiting = false;
    const g = B.goal;
    if (!g || !P.alive) return;
    const hd = Math.hypot(g.x - P.x, g.z - P.z);
    // loin d'une cible en étage : on vise d'abord le pied du bâtiment
    const high = g.y != null && g.y - nav.stand0(g.x, g.z) > 2;
    const to = hd > 40 && high ? { x: g.x, y: nav.stand0(g.x, g.z), z: g.z } : { x: g.x, y: g.y != null ? g.y + 0.2 : nav.stand0(g.x, g.z), z: g.z };
    B.approach = to.y !== (g.y != null ? g.y + 0.2 : to.y);
    const p = nav.path({ x: P.x, y: P.y, z: P.z }, to, 9000);
    // parti de l'eau ou d'un endroit coincé : tout droit un moment, puis on réessaie
    if (p.fail === 'depart') { B.path = null; B.direct = S.t + 2; return; }
    if (p.fail) { ban(B, g); B.goal = null; return; }
    B.path = p.pts; B.wp = 1; B.partial = !p.reached;
    if (!p.reached && hd < 30 && !B.approach) { ban(B, g); B.goal = null; B.path = null; }
  }
  const keyOfGoal = (g) => g.kind + ':' + g.id;
  function ban(B, g, sec = 40) { if (g && g.id != null) B.ban.set(keyOfGoal(g), S.t + sec); }
  const banned = (B, k) => { const t = B.ban.get(k); return t != null && t > S.t; };
  function claimed(P, k) { const c = claims.get(k); return c && c.id !== P.id && c.until > S.t && S.players.get(c.id) && S.players.get(c.id).alive; }

  // ------------------------------------------------------------------ choix d'une cible de fouille
  function pickLoot(P, B) {
    let best = null, bs = 0;
    const consider = (g, v, d) => {
      const k = keyOfGoal(g);
      if (v <= 0 || banned(B, k) || claimed(P, k)) return;
      const s = v / (d + 6);
      if (s > bs) { bs = s; best = g; }
    };
    const ammoLow = P.inv.some((s) => s && s.t === 'arme' && P.ammo[WEAPONS[s.w].ammo] < 30);
    for (const c of S.chests.values()) {
      if (c.open) continue;
      const d = Math.hypot(c.x - P.x, c.z - P.z) + Math.abs(c.y - P.y) * 2;
      if (d > 60) continue;
      consider({ kind: 'coffre', id: c.id, x: c.x, y: c.y, z: c.z }, c.kind === 'coffre' ? 10 : ammoLow ? 5 : 1, d);
    }
    for (const g of S.items.values()) {
      const d = Math.hypot(g.x - P.x, g.z - P.z) + Math.abs(g.y - P.y) * 2;
      if (d > 38) continue;
      const w = want(P, g.it);
      consider({ kind: g.it.t === 'munitions' || g.it.t === 'materiaux' ? 'tas' : 'objet', id: g.id, x: g.x, y: g.y, z: g.z, swap: w.swap }, w.v, d);
    }
    if (best) claims.set(keyOfGoal(best), { id: P.id, until: S.t + 25 });
    return best;
  }
  // un point sûr dans le prochain cercle (ou une maison à fouiller dedans)
  function zonePoint(P, B, roam) {
    const st = S.storm;
    const c = st ? st.next : { x: map.center, z: map.center, r: map.islandR * 0.6 };
    if (roam) {
      const bs = map.buildings.filter((b) => Math.hypot((b.x0 + b.w / 2) * 4 - c.x, (b.z0 + b.d / 2) * 4 - c.z) < c.r * 0.8);
      if (bs.length) {
        const b = B.rng.pick(bs), d = b.doors.find((q) => q.ext && q.k === 0);
        if (d) return { kind: 'roam', id: 'b' + b.id, x: (d.o === 'h' ? (d.x + 0.5) * 4 : d.x * 4) - d.nx * 2, z: (d.o === 'h' ? d.z * 4 : (d.z + 0.5) * 4) - d.nz * 2, r: 2 };
      }
    }
    for (let i = 0; i < 12; i++) {
      let dx = P.x - c.x, dz = P.z - c.z;
      const l = Math.hypot(dx, dz) || 1;
      const a = Math.atan2(dz / l, dx / l) + (B.rng.next() - 0.5) * (i < 4 ? 0.8 : 3), rr = c.r * (0.25 + B.rng.next() * 0.4);
      const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
      if (nav.free(x, nav.stand0(x, z), z)) return { kind: roam ? 'roam' : 'zone', id: null, x, z, r: 3 };
    }
    return { kind: 'zone', id: null, x: c.x, z: c.z, r: 3 };
  }

  // ------------------------------------------------------------------ perception
  function perceive(P, B) {
    const e = sim.eye(P), fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), lv = B.lv;
    const cands = [];
    for (const Q of S.players.values()) {
      if (Q === P || !Q.alive || Q.mode === 'ballon') continue;
      const dx = Q.x - P.x, dz = Q.z - P.z, d = Math.hypot(dx, dz);
      if (d > lv.see && !(P.hitBy === Q.id && S.t - (P.hitT || -9) < 1.5)) continue;
      const front = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      const heard = Q.shotT != null && S.t - Q.shotT < 0.6 && d < 70;
      const hurt = P.hitBy === Q.id && S.t - (P.hitT || -9) < 1.5;
      if (d < 12 || front > lv.cone || heard || hurt) cands.push({ Q, d, hurt, heard });
    }
    cands.sort((a, b) => a.d - b.d);
    let seen = null;
    for (const c of cands.slice(0, 3)) {
      const Q = c.Q, ty = Q.y + (Q.crouch ? 0.85 : 1.3), dx = Q.x - e[0], dy = ty - e[1], dz = Q.z - e[2], L = Math.hypot(dx, dy, dz);
      const h = world.raycast(e[0], e[1], e[2], dx / L, dy / L, dz / L, L);
      if (h.t >= L - 0.5) { seen = c; break; }
    }
    if (seen) {
      if (B.enemy !== seen.Q.id) { B.enemy = seen.Q.id; B.react = lv.react[0] + B.rng.next() * (lv.react[1] - lv.react[0]); B.track = 0; }
      B.visible = true; B.seenT = S.t; B.last = { x: seen.Q.x, y: seen.Q.y, z: seen.Q.z };
      return;
    }
    B.visible = false;
    // touché ou entendu sans voir : on se tourne par là
    const alert = cands.find((c) => c.hurt || c.heard);
    if (alert && (!B.enemy || B.enemy === alert.Q.id || S.t - B.seenT > 3)) {
      if (B.enemy !== alert.Q.id) { B.enemy = alert.Q.id; B.react = lv.react[1]; B.track = 0; B.seenT = S.t; }
      B.last = { x: alert.Q.x, y: alert.Q.y, z: alert.Q.z };
    }
    if (B.enemy && S.t - B.seenT > 6) B.enemy = null;
  }

  // ------------------------------------------------------------------ décision (deux fois par seconde)
  function decide(P, B) {
    const E = B.enemy ? S.players.get(B.enemy) : null;
    const danger = stormDanger(P), gun = armed(P);
    if (E && E.alive) {
      const d = Math.hypot(E.x - P.x, E.z - P.z);
      let reach = 0;
      for (const it of P.inv) if (usable(P, it)) reach = Math.max(reach, ENGAGE[it.w]);
      const hunted = S.t - (P.hitT || -9) < 4 && P.hitBy === E.id;
      // entre bots, on se cherche moins de loin, surtout en début de partie (on fouille d'abord)
      if (E.bot) reach *= S.t - (B.landT || 0) < 150 ? 0.3 : 0.5;
      if ((gun && (d < reach || hunted) && (danger < 2 || d < 25)) || (!gun && hunted && d < 5 && B.visible)) { B.state = 'fight'; return; }
    } else B.enemy = null;
    if (danger) {
      if (B.state !== 'zone' || !B.goal) { B.state = 'zone'; setGoal(P, B, zonePoint(P, B, false)); }
      return;
    }
    const h = needHeal(P);
    if (h && S.t - (P.hitT || -9) > 2.5 && (!E || !B.visible || P.hp + P.sh < 60)) { B.state = 'heal'; B.healSlot = h; return; }
    if (B.state === 'fight' || B.state === 'heal' || B.state === 'zone') { B.state = 'go'; B.goal = null; }
    if (B.goal && B.goal.kind !== 'roam' && B.goal.kind !== 'zone' && S.t - B.goal.since < 40) return;
    // une fouille en route vaut mieux qu'une promenade
    const g = pickLoot(P, B);
    if (g) { B.state = 'go'; setGoal(P, B, g); return; }
    if (!B.goal) { B.state = 'go'; setGoal(P, B, zonePoint(P, B, true)); }
  }

  // ------------------------------------------------------------------ actions
  function turn(B, yaw, pitch, rate) {
    const dy = wrap(yaw - B.yaw), dp = pitch - B.pitch;
    B.yaw = wrap(B.yaw + clamp(dy, -rate, rate));
    B.pitch += clamp(dp, -rate * 0.7, rate * 0.7);
  }
  function face(B, x, z, dt, P) { turn(B, Math.atan2(x - P.x, z - P.z), -0.15, 10 * dt); }
  // avance le long du chemin ; renvoie la direction voulue (monde) ou null (arrivé / rien à faire)
  function travel(P, B, dt) {
    const g = B.goal, I = P.inp;
    if (!g) return null;
    const hd = Math.hypot(g.x - P.x, g.z - P.z), dy = g.y != null ? Math.abs(g.y - P.y) : 0;
    if (hd < (g.r || 1.4) && dy < 1.6) { arrive(P, B, dt); return null; }
    if (S.t - g.since > 90) { ban(B, g); B.goal = null; return null; }
    let tx = g.x, tz = g.z;
    if (B.path) {
      let w = B.path[B.wp];
      while (w && Math.hypot(w.x - P.x, w.z - P.z) < 0.8 && (w.y == null || Math.abs(P.y - w.y) < 1.3)) w = B.path[++B.wp];
      if (!w) { B.path = null; if (B.partial || B.approach || hd > 3) askPath(P, B); }
      else { tx = w.x; tz = w.z; }
    } else if (!B.waiting && hd > 3 && S.t > (B.direct || 0)) askPath(P, B);
    const dx = tx - P.x, dz = tz - P.z, l = Math.hypot(dx, dz) || 1;
    // portes fermées sur le passage : on les ouvre
    if (S.t - B.useT > 0.6) {
      const d = world.doorNear(P.x, P.y, P.z, dx / l, dz / l, 1.9);
      if (d && !d.open && !d.dead) { B.yaw = Math.atan2(d.cx - P.x, d.cz - P.z); I.use++; B.useT = S.t; }
    }
    I.sprint = hd > 8 && !B.enemy;
    return { x: dx / l, z: dz / l };
  }
  function arrive(P, B, dt) {
    const g = B.goal, I = P.inp;
    const done = () => { claims.delete(keyOfGoal(g)); B.goal = null; B.decideT = 0; };
    if (g.kind === 'coffre') {
      const c = S.chests.get(g.id);
      if (!c || c.open) return done();
      face(B, c.x, c.z, dt, P);
      if (S.t - B.useT > 0.45 && Math.abs(wrap(Math.atan2(c.x - P.x, c.z - P.z) - B.yaw)) < 0.5) { I.use++; B.useT = S.t; if (++g.tries > 5) { ban(B, g); done(); } }
      return;
    }
    if (g.kind === 'objet') {
      const it = S.items.get(g.id);
      if (!it) return done();
      const w = want(P, it.it);
      if (w.v <= 0) { ban(B, g, 60); return done(); }
      if (w.swap != null) {
        // échange : la case à libérer en main ; sac plein, le ramassage échange ; sinon on lâche l'ancienne d'abord
        I.sel = w.swap + 1;
        if (P.sel !== w.swap + 1 || P.cd > 0) return;
        if (!P.inv.every(Boolean) && P.inv[w.swap]) { if (S.t - B.useT > 0.3) { I.drop++; B.useT = S.t; } return; }
      }
      face(B, it.x, it.z, dt, P);
      if (S.t - B.useT > 0.45) { I.use++; B.useT = S.t; if (++g.tries > 5) { ban(B, g); done(); } }
      return;
    }
    if (g.kind === 'tas') {
      // munitions : ramassées en marchant dessus
      const it = S.items.get(g.id);
      if (!it) return done();
      g.r = 0.5;
      if (++g.tries > 120) { ban(B, g); done(); }
      return;
    }
    done();
  }
  function heal(P, B, dt) {
    const I = P.inp, slot = needHeal(P);
    if (!slot) { B.state = 'go'; B.decideT = 0; return null; }
    I.sel = slot;
    if (P.sel === slot) I.fire = true;
    I.crouch = B.lv.hop > 0;
    return null;
  }
  function fight(P, B, dt) {
    const I = P.inp, lv = B.lv, E = S.players.get(B.enemy);
    if (!E || !E.alive) { B.enemy = null; B.state = 'go'; B.decideT = 0; return null; }
    const e = sim.eye(P), dx = E.x - P.x, dz = E.z - P.z, d = Math.hypot(dx, dz) || 0.01;
    const slot = bestSlot(P, d);
    // une grenade de temps en temps (moyenne distance)
    if (B.nade) {
      I.sel = B.nade.slot;
      const it = P.inv[B.nade.slot - 1];
      if (!it || it.c !== 'grenade' || S.t - B.nade.t > 2) B.nade = null;
      else if (P.sel === B.nade.slot && P.cd <= 0) {
        const th = 0.5 * Math.asin(clamp(d * 22 / 484, 0, 1));
        turn(B, Math.atan2(dx, dz), th - 0.18, 12 * dt);
        if (Math.abs(B.pitch - (th - 0.18)) < 0.05) { I.shoot++; B.nade = null; B.nadeT = S.t; }
        return null;
      }
      return null;
    }
    I.sel = slot;
    const it = slot ? P.inv[slot - 1] : null, W = it ? WEAPONS[it.w] : null;
    if (B.visible) {
      B.track += dt; B.react -= dt;
      const head = B.headshot && it && it.w !== 'roquette';
      const ty = E.y + (it && it.w === 'roquette' ? 0.4 : head ? (E.crouch ? 1.05 : 1.55) : (E.crouch ? 0.85 : 1.2));
      const ax = E.x - e[0], ay = ty - e[1], az = E.z - e[2], ah = Math.hypot(ax, az);
      if ((B.errT -= dt) <= 0) {
        B.errT = 0.3 + B.rng.next() * 0.2;
        const m = lv.err * (0.35 + 0.65 * Math.exp(-B.track / 1.4)) * (1 + Math.min(1, Math.hypot(E.vx, E.vz) / 6) * 0.6) * (E.bot ? 1.8 : 1);
        B.ex = (B.rng.next() - 0.5) * 2 * m; B.ey = (B.rng.next() - 0.5) * 1.2 * m;
        B.headshot = B.rng.next() < lv.head;
      }
      const wy = Math.atan2(ax, az) + B.ex, wp = Math.atan2(ay, ah) + B.ey;
      turn(B, wy, wp, lv.turn * dt);
      const tol = Math.max(0.025, Math.atan(0.7 / d));
      const aligned = Math.abs(wrap(B.yaw - wy)) < tol && Math.abs(B.pitch - wp) < tol;
      I.aim = !!W && d > 14 && it.w !== 'pompe';
      if (W && B.react <= 0 && aligned && P.sel === slot) {
        if (W.auto) {
          if ((B.burstT -= dt) <= 0) { B.burstOn = !B.burstOn; B.burstT = (B.burstOn ? lv.burst[0] : lv.burst[1]) * (0.6 + B.rng.next() * 0.8); }
          I.fire = B.burstOn;
        } else if (P.cd <= 0 && !P.rl && it.mag > 0 && (it.w !== 'sniper' || Math.hypot(P.vx, P.vz) < 0.8)) I.shoot++;
      } else if (!W && d < 2.4 && aligned) I.fire = true;
      // grenade : à moyenne distance, de temps en temps
      if (lv.nade && d > 9 && d < 22 && S.t - (B.nadeT || -99) > 8 && B.rng.next() < lv.nade * dt * 0.6) {
        const gi = P.inv.findIndex((s) => s && s.t === 'objet' && s.c === 'grenade');
        if (gi >= 0) B.nade = { slot: gi + 1, t: S.t };
      }
    } else {
      // perdu de vue : on va voir où il était
      if (W && it.mag < W.mag * 0.4 && P.ammo[W.ammo] > 0 && !P.rl) I.reload++;
      if (B.last && S.t - B.seenT < 5) {
        if (!B.goal || B.goal.kind !== 'chasse' || Math.hypot(B.goal.x - B.last.x, B.goal.z - B.last.z) > 4) setGoal(P, B, { kind: 'chasse', id: null, x: B.last.x, y: B.last.y, z: B.last.z, r: 2 });
        const mv = travel(P, B, dt);
        if (mv) turn(B, Math.atan2(mv.x, mv.z), 0, 8 * dt);
        return mv;
      }
      B.enemy = null; B.state = 'go'; B.decideT = 0;
      return null;
    }
    // déplacement : garder sa distance, pas de côté, petits sauts ; bien amoché face à un bot : on décroche
    if (it && it.w === 'sniper' && I.aim) { I.crouch = true; return null; }
    const retreat = E.bot && P.hp + P.sh < 60 && needHeal(P);
    if (retreat) { I.fire = false; I.aim = false; }
    const want = retreat ? 80 : W ? WANT_D[it.w] : 1.5;
    const ux = dx / d, uz = dz / d;
    const fwd = clamp((d - want) / 6, -1, 1);
    if ((B.strafeT -= dt) <= 0) { B.strafe = B.rng.next() < 0.5 ? -1 : 1; B.strafeT = 0.5 + B.rng.next() * 1.1; }
    const side = B.strafe * lv.strafe;
    if (lv.hop && P.ground && B.rng.next() < lv.hop * dt * 1.5) I.jump++;
    const mx = ux * fwd - uz * side, mz = uz * fwd + ux * side, ml = Math.hypot(mx, mz);
    return ml > 0.1 ? { x: mx / ml, z: mz / ml, k: Math.min(1, ml) } : null;
  }

  // ------------------------------------------------------------------ un bot, un pas
  function init(P) {
    const n = typeof P.id === 'string' ? [...P.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) : P.id;
    const rng = makeRng(hash((S.seed | 0) * 7 + (n | 0)));
    P.ai = {
      rng, lv: LEVELS[P.level] || LEVELS.normal, state: 'go', goal: null, path: null, wp: 0, waiting: false, partial: false, approach: false,
      enemy: null, visible: false, seenT: -99, last: null, react: 0, track: 0, ex: 0, ey: 0, errT: 0, headshot: false,
      strafe: 1, strafeT: 0, burstOn: true, burstT: 0, scanT: rng.next() * 0.25, decideT: rng.next() * 0.5,
      ban: new Map(), useT: -9, yaw: P.yaw || 0, pitch: 0, drop: null, prevD: null, minJump: 1 + rng.next() * 5,
      sx: P.x, sz: P.z, stuckT: 0, stuckN: 0, nade: null, nadeT: -99, healSlot: 0,
    };
    return P.ai;
  }
  function think(P, dt) {
    if (S.t !== lastT) {
      lastT = S.t;
      // un chemin par pas (les autres attendent leur tour en marchant tout droit)
      while (queue.length) { const Q = queue.shift(); if (Q.alive && Q.ai && Q.ai.waiting) { plan(Q); break; } }
    }
    const B = P.ai || init(P), I = P.inp;
    if (P.mode === 'ballon') {
      if (!B.drop) B.drop = chooseDrop(P, B);
      const b = sim.balloonPos(), d = Math.hypot(b.x - B.drop.x, b.z - B.drop.z);
      if (S.flight.t > B.minJump && (d < 110 || (B.prevD != null && d > B.prevD))) I.jump++;
      B.prevD = d;
      return;
    }
    if (P.mode === 'chute' || P.mode === 'planeur') {
      B.landT = S.t;
      const t = B.drop || { x: P.x, z: P.z }, dx = t.x - P.x, dz = t.z - P.z, d = Math.hypot(dx, dz);
      B.yaw = Math.atan2(dx, dz); I.yaw = B.yaw; I.pitch = -0.4; I.mx = 0; I.mz = d > 4 ? 1 : 0;
      return;
    }
    if ((B.scanT -= dt) <= 0) { B.scanT = 0.25; perceive(P, B); }
    if ((B.decideT -= dt) <= 0) { B.decideT = 0.5; decide(P, B); }
    I.fire = false; I.aim = false; I.sprint = false; I.crouch = false;
    let mv = null;
    if (B.state === 'fight') mv = fight(P, B, dt);
    else if (B.state === 'heal') mv = heal(P, B, dt);
    else {
      // en route : l'arme la plus utile en main
      if (!B.goal || B.goal.kind !== 'objet' || B.goal.swap == null) { const s = bestSlot(P, 20); if (s) I.sel = s; }
      mv = travel(P, B, dt);
      if (mv) turn(B, Math.atan2(mv.x, mv.z), 0, 8 * dt);
    }
    I.yaw = B.yaw; I.pitch = B.pitch;
    if (mv) {
      const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), k = mv.k || 1;
      I.mz = (mv.x * fx + mv.z * fz) * k; I.mx = (-mv.x * fz + mv.z * fx) * k;
    } else { I.mx = 0; I.mz = 0; }
    // coincé ? on saute, on ouvre, on recalcule, puis on abandonne la cible
    B.stuckT += dt;
    if (B.stuckT >= 0.8) {
      const moved = Math.hypot(P.x - B.sx, P.z - B.sz);
      if (mv && moved < 0.45 && !P.use) {
        B.stuckN++;
        if (B.stuckN === 1 || B.stuckN === 3) I.jump++;
        else if (B.stuckN === 2) I.use++;
        else if (B.stuckN === 4) {
          // la grille croit qu'on passe et on ne passe pas : on bouche devant soi et on cherche un autre chemin
          const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw);
          nav.expire(S.t);
          for (const k of [0.6, 1.1]) nav.block(P.x + fx * k, P.y, P.z + fz * k, 30, S.t);
          B.path = null; askPath(P, B);
        }
        else if (B.stuckN >= 6) { if (B.goal) ban(B, B.goal); B.goal = null; B.path = null; B.stuckN = 0; B.decideT = 0; if (B.state === 'zone') B.state = 'go'; }
      } else B.stuckN = 0;
      B.stuckT = 0; B.sx = P.x; B.sz = P.z;
    }
  }
  S.hooks.think = think;
  return { think, nav, LEVELS };
}
