// Effets visuels côté client : particules, traçantes, décalques (sang, cadavres, brûlures), textes, tremblement.
// Tout est cosmétique : les dégâts sont décidés par la simulation de l'hôte.
import { drawZombie, shade, INK, ell, circ, MUZZLE } from './sprites.js';
import { segCircle, raycastSolids } from '../engine/geom.js';
import { WEAPONS, ZOMBIE_IDS } from '../engine/data.js';

const BLOOD = ['#7a0f12', '#8f1418', '#a3191d', '#6a0c0f'];
const GOO = ['#5f8f2a', '#78a832', '#9be15d'];

export class FX {
  constructor(audio) {
    this.audio = audio;
    this.parts = []; this.bullets = []; this.beams = []; this.lights = []; this.texts = []; this.rings = [];
    this.decal = null; this.dctx = null; this.shake = 0; this.flash = 0; this.hurtFlash = 0;
    this.recoil = new Map(); this.muzzle = new Map(); this.ventGlow = new Map(); this.zflash = new Map(); this.pflash = new Map();
    this.showDamage = true;
  }

  setLevel(lv) {
    this.lv = lv;
    this.decal = document.createElement('canvas'); this.decal.width = lv.w; this.decal.height = lv.h;
    this.dctx = this.decal.getContext('2d');
    this.parts = []; this.bullets = []; this.beams = []; this.lights = []; this.texts = []; this.rings = [];
  }

  // ------------------------------------------------------------------ événements de la simulation
  // view : état affiché (positions des joueurs pour placer les effets) ; me : id du joueur local
  handle(e, view, me) {
    const A = this.audio;
    const P = (id) => view.players.find((p) => p.id === id);
    switch (e.e) {
      case 'f': {
        const p = P(e.p); const W = WEAPONS[e.w]; if (!W) break;
        if (e.p === me && e.local !== true && view.predictFire) break; // déjà joué en local par la prédiction
        this.shot(e.p, W, e.x, e.y, e.a, p, view, e.p === me);
        break;
      }
      case 'h': {
        if (e.i) this.zflash.set(e.i, 0.08);
        this.spray(e.x, e.y, e.a, e.g ? GOO : BLOOD, e.c ? 10 : 5, e.c ? 260 : 180);
        if (Math.random() < 0.35) this.stain(e.x + Math.cos(e.a) * 18, e.y + Math.sin(e.a) * 18, e.g ? GOO : BLOOD, 3 + Math.random() * 4);
        if (this.showDamage) this.text(e.x + (Math.random() - 0.5) * 14, e.y - 18, String(e.d), e.c ? '#ffc531' : '#ffffff', e.c ? 20 : 13, e.c);
        A.play(e.c ? 'crit' : 'hit', e.x, e.y, 0.7);
        break;
      }
      case 'zd': this.zombieDeath(e); A.play('zdie', e.x, e.y); if (e.pts >= 300) this.text(e.x, e.y - 34, '+' + e.pts, '#ffc531', 16); break;
      case 'spark': this.sparks(e.x, e.y, Math.atan2(e.ny || 0, e.nx || 0), 4); A.play('spark', e.x, e.y, 0.5); break;
      case 'ric': this.sparks(e.x, e.y, Math.random() * 6.28, 6); A.play('spark', e.x, e.y, 0.8); break;
      case 'boom': this.explosion(e.x, e.y, e.r, e.k); A.play(e.r > 125 ? 'boom' : 'smallboom', e.x, e.y); this.addShake(Math.min(16, e.r / 9), e.x, e.y, view); break;
      case 'hurt':
        this.pflash.set(e.p, 0.12);
        if (e.p === me) { this.hurtFlash = Math.min(1, this.hurtFlash + 0.35 + e.d / 60); this.addShake(5 + e.d / 4); A.play('hurt'); }
        { const p = P(e.p); if (p) this.spray(p.x, p.y, Math.atan2(p.y - e.y, p.x - e.x), BLOOD, 6, 140); }
        break;
      case 'down': { const p = P(e.p); A.play('down', p && p.x, p && p.y); if (p) this.text(p.x, p.y - 40, 'À TERRE', '#ff4b2b', 18, true); break; }
      case 'dead': { const p = P(e.p); if (p) this.text(p.x, p.y - 40, 'K.O.', '#ff4b2b', 20, true); break; }
      case 'rev': { const p = P(e.p); A.play('revive', p && p.x, p && p.y); if (p) { this.text(p.x, p.y - 40, 'RELEVÉ !', '#2fbf71', 18, true); this.ring(p.x, p.y, 70, '#2fbf71', 0.5); } break; }
      case 'respawn': case 'adren': { const p = P(e.p); A.play('revive', p && p.x, p && p.y); if (p) this.ring(p.x, p.y, 80, '#1fc7c1', 0.6); break; }
      case 'pk': {
        A.play(e.k === 'med' ? 'heal' : 'pickup', e.x, e.y, e.p === me ? 1 : 0.5);
        const label = { med: '+40 PV', armor: '+35 ARMURE', ammo: 'MUNITIONS', nade: '+1 GRENADE' }[e.k];
        if (label && e.p === me) this.text(e.x, e.y - 24, label, e.k === 'med' ? '#2fbf71' : e.k === 'armor' ? '#2b8cff' : '#ffc531', 14);
        for (let i = 0; i < 8; i++) this.parts.push({ k: 'spark', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: 0.4, max: 0.4, c: '#fff8ea', r: 2 });
        break;
      }
      case 'pkw': { A.play('weapon', null, null, e.p === me ? 1 : 0.4); const p = P(e.p); if (p) this.text(p.x, p.y - 36, WEAPONS[e.w].name, '#ffc531', 15, true); break; }
      case 'vent': {
        const v = this.lv.vents[e.v]; if (!v) break;
        this.ventGlow.set(v.id, 0.9);
        for (let i = 0; i < (e.big ? 20 : 10); i++) {
          const a = Math.atan2(v.ny, v.nx) + (Math.random() - 0.5) * 1.6, s = 60 + Math.random() * 160;
          this.parts.push({ k: 'smoke', x: v.sx, y: v.sy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.9, max: 0.9, c: '#9a948a', r: 8 + Math.random() * 10 });
        }
        A.play('vent', v.sx, v.sy, e.big ? 1.2 : 0.7);
        break;
      }
      case 'spit': A.play('spit', e.x, e.y); break;
      case 'splash':
        A.play('splash', e.x, e.y, 0.7);
        this.stain(e.x, e.y, ['#4f7a1f', '#6f9a2a'], 16, 0.5);
        for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, s = 40 + Math.random() * 160; this.parts.push({ k: 'drop', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, max: 0.4, c: GOO[i % 3], r: 3 }); }
        break;
      case 'scream': this.ring(e.x, e.y, 460, '#e6b8ff', 0.7, 5); A.play('scream', e.x, e.y); this.addShake(3, e.x, e.y, view); break;
      case 'roar': A.play('roar', e.x, e.y); break;
      case 'charge': this.dust(e.x, e.y, 10); break;
      case 'slam': this.ring(e.x, e.y, e.r, '#ffc531', 0.45, 8); this.dust(e.x, e.y, 18); A.play('slam', e.x, e.y); this.addShake(e.r > 100 ? 14 : 8, e.x, e.y, view); this.scorch(e.x, e.y, e.r * 0.5, 0.25); break;
      case 'fuse': A.play('fuse', e.x, e.y); break;
      case 'crate': A.play('crate', e.x, e.y); for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, s = 80 + Math.random() * 200; this.parts.push({ k: 'chunk', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, max: 0.7, c: i % 2 ? '#b0793f' : '#7a4f24', r: 4, rot: Math.random() * 6, decal: true }); } break;
      case 'zs': break;
      case 'dash': { const p = P(e.p); if (p) { this.dust(p.x, p.y, 6); if (e.p === me) A.play('dash'); } break; }
      case 'throw': A.play('throw', null, null, e.p === me ? 1 : 0.4); break;
      case 'rl': if (e.p === me) A.play('reload'); break;
      case 'rl1': if (e.p === me) A.play('reloaded'); break;
      case 'sw': if (e.p === me) A.play('switch'); break;
      case 'dry': if (e.p === me) A.play('dry'); break;
      case 'perk': if (e.p === me) A.play('perk'); break;
      case 'wave': A.play('wave'); break;
      case 'clear': A.play('clear'); break;
      case 'room': A.play('alarm'); break;
      case 'door': A.play('door'); break;
      case 'boss': A.play('boss'); this.addShake(8); break;
      case 'phase': A.play('roar'); this.addShake(10); break;
      case 'won': A.play('won'); break;
      case 'over': A.play('over'); break;
    }
  }

  // ------------------------------------------------------------------ tirs (cosmétiques)
  shot(pid, W, x, y, angs, p, view, mine) {
    this.recoil.set(pid, 1);
    this.muzzle.set(pid, 0.06);
    const a0 = angs[0] ?? (p ? p.a : 0);
    if (!W.flame) this.lights.push({ x: x + Math.cos(a0) * 10, y: y + Math.sin(a0) * 10, r: W.pellets > 1 ? 260 : 190, a: 0.9, life: 0.06, max: 0.06, c: '#ffd27a' });
    this.audio.play(W.sound, x, y, mine ? 1 : 0.55);
    if (mine) this.addShake(W.shake);
    for (const a of angs) {
      if (W.rail) {
        const ex = x + Math.cos(a) * W.range, ey = y + Math.sin(a) * W.range;
        const hit = raycastSolids(view.solids, x, y, ex, ey);
        const t = hit ? hit.t : 1;
        this.beams.push({ x0: x, y0: y, x1: x + (ex - x) * t, y1: y + (ey - y) * t, life: 0.3, max: 0.3 });
        if (hit) this.sparks(x + (ex - x) * t, y + (ey - y) * t, a + Math.PI, 8);
        continue;
      }
      if (W.flame) {
        const s = W.speed * (0.8 + Math.random() * 0.4);
        this.parts.push({ k: 'flame', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.55, max: 0.55, r: 6, drag: 2.4 });
        continue;
      }
      const s = W.speed * (W.pellets > 1 ? 0.9 + Math.random() * 0.2 : 1);
      this.bullets.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: W.range / s, w: W.id, c: W.color, shell: !!W.explosive, len: W.pellets > 1 ? 18 : W.id === 'rifle' ? 34 : 26 });
    }
    // douille éjectée
    if (!W.flame && !W.rail && !W.explosive && p) {
      const side = (p.a ?? a0) + Math.PI / 2;
      this.parts.push({ k: 'casing', x: p.x + Math.cos(a0) * 8, y: p.y + Math.sin(a0) * 8, vx: Math.cos(side) * (90 + Math.random() * 60), vy: Math.sin(side) * (90 + Math.random() * 60), life: 0.5, max: 0.5, c: W.id === 'shotgun' ? '#d64545' : '#d9b14a', r: 2, rot: Math.random() * 6, decal: true, vr: 20 });
    }
  }

  // ------------------------------------------------------------------ helpers
  spray(x, y, a, pal, n, sp) {
    for (let i = 0; i < n; i++) {
      const aa = a + (Math.random() - 0.5) * 1.2, s = sp * (0.3 + Math.random());
      this.parts.push({ k: 'drop', x, y, vx: Math.cos(aa) * s, vy: Math.sin(aa) * s, life: 0.25 + Math.random() * 0.3, max: 0.5, c: pal[(Math.random() * pal.length) | 0], r: 1.5 + Math.random() * 2.5, decal: Math.random() < 0.4 });
    }
  }
  sparks(x, y, a, n) {
    for (let i = 0; i < n; i++) {
      const aa = a + (Math.random() - 0.5) * 2, s = 120 + Math.random() * 260;
      this.parts.push({ k: 'spark', x, y, vx: Math.cos(aa) * s, vy: Math.sin(aa) * s, life: 0.15 + Math.random() * 0.15, max: 0.3, c: '#ffe27a', r: 1.6 });
    }
  }
  dust(x, y, n) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 30 + Math.random() * 90; this.parts.push({ k: 'smoke', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, c: '#a8a296', r: 6 + Math.random() * 6 }); }
  }
  ring(x, y, r, c, life, w = 4) { this.rings.push({ x, y, r, c, life, max: life, w }); }
  text(x, y, s, c, size, bold) { this.texts.push({ x, y, s, c, size, bold, life: bold ? 1.2 : 0.7, max: bold ? 1.2 : 0.7, vy: bold ? -30 : -55 }); if (this.texts.length > 90) this.texts.shift(); }
  addShake(v, x, y, view) {
    if (x != null && view && view.cam) { const d = Math.hypot(x - view.cam.x, y - view.cam.y); v *= Math.max(0, 1 - d / 1100); }
    this.shake = Math.min(22, this.shake + v);
  }

  stain(x, y, pal, r, alpha = 0.85) {
    const c = this.dctx; if (!c) return;
    c.globalAlpha = alpha;
    for (let i = 0; i < 4; i++) {
      c.fillStyle = pal[(Math.random() * pal.length) | 0];
      ell(c, x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r, r * (0.4 + Math.random() * 0.6), r * (0.3 + Math.random() * 0.5), Math.random() * 3); c.fill();
    }
    c.globalAlpha = 1;
  }
  scorch(x, y, r, a = 0.55) {
    const c = this.dctx; if (!c) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(15,12,10,${a})`); g.addColorStop(0.7, `rgba(25,20,15,${a * 0.5})`); g.addColorStop(1, 'rgba(25,20,15,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  zombieDeath(e) {
    const ty = ZOMBIE_IDS[e.t];
    const goo = ty === 'spitter' || ty === 'bloater';
    const pal = goo ? GOO : BLOOD;
    // flaque + cadavre peints sur le sol
    const c = this.dctx;
    if (c) {
      this.stain(e.x + Math.cos(e.a) * 14, e.y + Math.sin(e.a) * 14, pal, ty === 'boss' ? 70 : ty === 'brute' ? 34 : 20, 0.8);
      if (ty !== 'bloater') {
        c.save(); c.translate(e.x + Math.cos(e.a) * 8, e.y + Math.sin(e.a) * 8); c.rotate(e.a + Math.PI + (Math.random() - 0.5) * 0.8);
        c.globalAlpha = 0.85;
        try { c.filter = 'brightness(0.55) saturate(0.7)'; } catch (err) {}
        drawZombie(c, { id: e.i, ty, a: 0, walk: 1.3, flags: 0, phase: 3 }, 0);
        try { c.filter = 'none'; } catch (err) {}
        c.restore(); c.globalAlpha = 1;
      }
    }
    // gerbe de sang et morceaux
    const n = ty === 'boss' ? 60 : ty === 'brute' ? 26 : ty === 'bloater' ? 30 : 14;
    this.spray(e.x, e.y, e.a, pal, n, ty === 'bloater' ? 320 : 230);
    for (let i = 0; i < (ty === 'boss' ? 16 : 4); i++) {
      const a = e.a + (Math.random() - 0.5) * 2, s = 120 + Math.random() * 220;
      this.parts.push({ k: 'chunk', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, c: goo ? '#6f8f3a' : '#7a2a2a', r: 3 + Math.random() * 3, rot: Math.random() * 6, decal: true });
    }
    if (ty === 'boss') { this.explosion(e.x, e.y, 200, 'toxic'); this.addShake(20); }
  }

  explosion(x, y, r, kind) {
    const toxic = kind === 'toxic';
    this.lights.push({ x, y, r: r * 2.6, a: 1, life: 0.35, max: 0.35, c: toxic ? '#a6ff4d' : '#ffb347' });
    this.ring(x, y, r, toxic ? '#c6f36a' : '#fff1c1', 0.35, 10);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.28, s = Math.random() * r * 3.2;
      this.parts.push({ k: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.35, max: 0.65, r: 10 + Math.random() * 16, toxic, drag: 4 });
    }
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 6.28, s = Math.random() * r * 1.4;
      this.parts.push({ k: 'smoke', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 + Math.random() * 0.8, max: 1.8, c: toxic ? '#6f8f4a' : '#4a4540', r: 14 + Math.random() * 18, drag: 1.5 });
    }
    this.sparks(x, y, 0, 18);
    if (!toxic) this.scorch(x, y, r * 0.8); else this.stain(x, y, ['#4f7a1f', '#3d6618'], r * 0.6, 0.45);
  }

  // ------------------------------------------------------------------ mise à jour
  update(dt, view) {
    this.shake *= Math.pow(0.0015, dt); if (this.shake < 0.05) this.shake = 0;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);
    for (const [k, v] of this.recoil) { const n = v - dt * 9; if (n <= 0) this.recoil.delete(k); else this.recoil.set(k, n); }
    for (const [k, v] of this.muzzle) { const n = v - dt; if (n <= 0) this.muzzle.delete(k); else this.muzzle.set(k, n); }
    for (const M of [this.zflash, this.pflash]) for (const [k, v] of M) { const n = v - dt; if (n <= 0) M.delete(k); else M.set(k, n); }
    for (const [k, v] of this.ventGlow) { const n = v - dt; if (n <= 0) this.ventGlow.delete(k); else this.ventGlow.set(k, n); }
    // traçantes : s'arrêtent sur un mur ou un zombie affiché
    const keep = [];
    for (const b of this.bullets) {
      b.life -= dt;
      const dx = b.vx * dt, dy = b.vy * dt;
      let stop = b.life <= 0;
      if (!stop) {
        const wall = raycastSolids(view.solids, b.x, b.y, b.x + dx, b.y + dy);
        let t = wall ? wall.t : 2;
        for (const z of view.zombies) {
          if (Math.abs(z.x - b.x) > Math.abs(dx) + 60 || Math.abs(z.y - b.y) > Math.abs(dy) + 60) continue;
          const tz = segCircle(b.x, b.y, dx, dy, z.x, z.y, z.r || 16);
          if (tz >= 0 && tz < t) t = tz;
        }
        if (t <= 1) { b.x += dx * t; b.y += dy * t; stop = true; }
      }
      if (stop) { b.dead = (b.dead || 0) + 1; if (b.dead > 2) continue; keep.push(b); continue; }
      b.x += dx; b.y += dy; keep.push(b);
    }
    this.bullets = keep;
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const l of this.lights) l.life -= dt;
    this.lights = this.lights.filter((l) => l.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= Math.pow(0.2, dt); }
    this.texts = this.texts.filter((t) => t.life > 0);
    const ps = [];
    for (const p of this.parts) {
      p.life -= dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      else if (p.k === 'drop' || p.k === 'chunk' || p.k === 'casing' || p.k === 'spark') { const k = Math.pow(p.k === 'spark' ? 0.2 : 0.02, dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.rot != null) p.rot += (p.vr || 8) * dt;
      if (p.life <= 0) {
        if (p.decal && this.dctx) {
          const c = this.dctx;
          if (p.k === 'casing') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.c; c.fillRect(-3, -1.2, 6, 2.4); c.restore(); }
          else { c.fillStyle = p.c; c.globalAlpha = 0.85; ell(c, p.x, p.y, p.r * 1.3, p.r, p.rot || 0); c.fill(); c.globalAlpha = 1; }
        }
        continue;
      }
      ps.push(p);
    }
    this.parts = ps.length > 1600 ? ps.slice(ps.length - 1600) : ps;
  }

  // ------------------------------------------------------------------ dessin
  drawUnder(c) { // sous les personnages
    for (const p of this.parts) {
      if (p.k !== 'casing' && p.k !== 'chunk') continue;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot || 0); c.fillStyle = p.c;
      if (p.k === 'casing') c.fillRect(-3, -1.2, 6, 2.4); else { ell(c, 0, 0, p.r * 1.3, p.r, 0); c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); }
      c.restore();
    }
  }

  drawOver(c) { // au-dessus des personnages, avant l'obscurité
    for (const p of this.parts) {
      const f = Math.max(0, p.life / p.max);
      if (p.k === 'drop') { c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); }
      else if (p.k === 'smoke') { c.globalAlpha = f * 0.45; c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.r * (1.6 - f * 0.6), 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
    }
    // traçantes
    c.lineCap = 'round';
    for (const b of this.bullets) {
      const sp = Math.hypot(b.vx, b.vy), ux = b.vx / sp, uy = b.vy / sp;
      if (b.shell) { c.fillStyle = '#3d4a2a'; c.beginPath(); c.arc(b.x, b.y, 5, 0, Math.PI * 2); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); continue; }
      const L = b.dead ? 6 : b.len;
      c.strokeStyle = 'rgba(255,240,180,.35)'; c.lineWidth = 5; c.beginPath(); c.moveTo(b.x - ux * L, b.y - uy * L); c.lineTo(b.x, b.y); c.stroke();
      c.strokeStyle = b.c; c.lineWidth = 2.2; c.stroke();
    }
  }

  drawGlow(c) { // additif, après l'obscurité
    c.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const f = Math.max(0, p.life / p.max);
      if (p.k === 'flame' || p.k === 'fire') {
        const r = p.r * (p.k === 'flame' ? 1 + (1 - f) * 2.2 : 0.7 + (1 - f));
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        if (p.toxic) { g.addColorStop(0, `rgba(200,255,120,${f})`); g.addColorStop(1, 'rgba(60,120,20,0)'); }
        else { g.addColorStop(0, `rgba(255,240,180,${f})`); g.addColorStop(0.4, `rgba(255,140,40,${f * 0.8})`); g.addColorStop(1, 'rgba(200,40,10,0)'); }
        c.fillStyle = g; c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      } else if (p.k === 'spark') { c.fillStyle = `rgba(255,230,140,${f})`; c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
    }
    for (const b of this.beams) {
      const f = b.life / b.max;
      c.lineCap = 'round';
      c.strokeStyle = `rgba(127,240,255,${f * 0.35})`; c.lineWidth = 14 * f + 2; c.beginPath(); c.moveTo(b.x0, b.y0); c.lineTo(b.x1, b.y1); c.stroke();
      c.strokeStyle = `rgba(230,255,255,${f})`; c.lineWidth = 3; c.stroke();
    }
    for (const r of this.rings) {
      const f = r.life / r.max;
      c.strokeStyle = r.c; c.globalAlpha = f; c.lineWidth = r.w * f + 1;
      c.beginPath(); c.arc(r.x, r.y, r.r * (1 - f * 0.75), 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  drawTexts(c) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const t of this.texts) {
      const f = t.life / t.max;
      c.globalAlpha = Math.min(1, f * 2.5);
      const s = t.size * (t.bold ? 1 + Math.max(0, f - 0.85) * 2 : 1);
      c.font = `${t.bold ? '' : '700 '}${Math.round(s)}px ${t.bold ? 'Bungee, Impact, sans-serif' : '"Chakra Petch", sans-serif'}`;
      c.lineWidth = t.bold ? 5 : 3.5; c.strokeStyle = INK; c.lineJoin = 'round';
      c.strokeText(t.s, t.x, t.y); c.fillStyle = t.c; c.fillText(t.s, t.x, t.y);
    }
    c.globalAlpha = 1;
  }
}

export { shade, circ, MUZZLE };
