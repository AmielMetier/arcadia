// Rendu d'une image : salle, entités, effets, éclairage dynamique (lampes torches, flashs, explosions), indicateurs.
import { drawSurvivor, drawZombie, zombieEyes, drawPickup, drawBarrel, drawCrate, drawTurret, INK, shade, circ, ell, rr, fs, MUZZLE } from './sprites.js';
import { paintLevel, THEMES } from './level-art.js';
import { WALL_TOP } from '../engine/level.js';
import { ROOM_TYPES } from '../engine/data.js';

const LS = 0.5; // résolution de la carte de lumière

export class Renderer {
  constructor(canvas, fx) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    this.fx = fx;
    this.light = document.createElement('canvas'); this.lc = this.light.getContext('2d');
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.lvKey = null; this.art = null; this.doorAnim = new Map();
    this.W = 0; this.H = 0; this.dpr = 1;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    if (W !== this.W || H !== this.H || dpr !== this.dpr) {
      this.W = W; this.H = H; this.dpr = dpr;
      this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
      this.light.width = Math.ceil(W * dpr * LS); this.light.height = Math.ceil(H * dpr * LS);
    }
  }

  setLevel(lv, key) {
    if (this.lvKey === key) return false;
    this.lvKey = key; this.lv = lv;
    this.art = paintLevel(lv);
    this.theme = THEMES[lv.theme] || THEMES.sas;
    this.doorAnim.clear();
    this.fx.setLevel(lv);
    return true;
  }

  // position écran → monde
  toWorld(sx, sy) { return { x: (sx - this.W / 2) / this.cam.zoom + this.cam.x, y: (sy - this.H / 2) / this.cam.zoom + this.cam.y }; }
  toScreen(wx, wy) { return { x: (wx - this.cam.x) * this.cam.zoom + this.W / 2, y: (wy - this.cam.y) * this.cam.zoom + this.H / 2 }; }

  frame(v, dt) {
    this.resize();
    const { c, W, H, dpr, fx } = this;
    const lv = this.lv; if (!lv) return;
    const t = v.t;

    // ---- caméra
    const zoom = Math.max(0.5, Math.min(1.35, Math.min(W / 1150, H / 740)));
    this.cam.zoom += (zoom - this.cam.zoom) * Math.min(1, dt * 4);
    const Z = this.cam.zoom;
    const tx = v.focus.x + (v.look ? v.look.x : 0), ty = v.focus.y + (v.look ? v.look.y : 0);
    if (!this.camInit || v.snapCam) { this.cam.x = tx; this.cam.y = ty; this.camInit = true; }
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 7); this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 7);
    const hw = W / 2 / Z, hh = H / 2 / Z, m = 60;
    this.cam.x = lv.w + m * 2 < hw * 2 ? lv.w / 2 : Math.max(hw - m, Math.min(lv.w + m - hw, this.cam.x));
    this.cam.y = lv.h + m * 2 < hh * 2 ? lv.h / 2 : Math.max(hh - m - 40, Math.min(lv.h + m - hh, this.cam.y));
    v.cam = this.cam;
    const sh = fx.shake, sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
    const camX = this.cam.x - sx / Z, camY = this.cam.y - sy / Z;
    const setWorld = (ctx, s) => ctx.setTransform(s * Z, 0, 0, s * Z, s * (W / 2 - camX * Z), s * (H / 2 - camY * Z));

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#07080b'; c.fillRect(0, 0, this.cv.width, this.cv.height);
    setWorld(c, dpr);
    c.imageSmoothingEnabled = true;

    // ---- sol, décalques
    c.drawImage(this.art, 0, 0);
    if (fx.decal) c.drawImage(fx.decal, 0, 0);

    // ---- flaques
    for (const h of v.hazards) this.drawHazard(c, h, t);
    // ---- bouches d'aération actives
    for (const [id, g] of fx.ventGlow) {
      const vt = lv.vents[id]; if (!vt) continue;
      c.globalAlpha = Math.min(1, g * 1.5); ell(c, vt.sx - vt.nx * 22, vt.sy - vt.ny * 22, 30, 30); c.fillStyle = '#000'; c.fill(); c.globalAlpha = 1;
    }
    // ---- portes
    for (const d of lv.doors) this.drawDoor(c, d, v, dt, t);

    fx.drawUnder(c);
    for (const k of v.pickups) { c.save(); c.translate(k.x, k.y); ell(c, 0, 12, 14, 5); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill(); drawPickup(c, k, t); c.restore(); }
    for (const b of v.barrels) { c.save(); c.translate(b.x, b.y); ell(c, 4, 6, b.r, b.r * 0.8); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill(); drawBarrel(c, b, t); c.restore(); }
    for (const tt of v.turrets || []) { c.save(); c.translate(tt[1], tt[2]); drawTurret(c, tt, t); c.restore(); }
    for (const k of v.crates) { c.save(); c.translate(k.x, k.y); rr(c, 6, 8, k.w, k.h, 3); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill(); drawCrate(c, k.w, k.h); c.restore(); }

    // ---- ombres
    c.fillStyle = 'rgba(0,0,0,.32)';
    for (const z of v.zombies) { ell(c, z.x + 4, z.y + 7, z.r * 1.05, z.r * 0.8); c.fill(); }
    for (const p of v.players) if (p.state !== 2) { ell(c, p.x + 4, p.y + 7, 18, 14); c.fill(); }

    // ---- entités triées par profondeur
    const ents = [];
    for (const z of v.zombies) ents.push([z.y, 0, z]);
    for (const p of v.players) if (p.state !== 2) ents.push([p.y, 1, p]);
    ents.sort((a, b) => a[0] - b[0]);
    for (const [, k, e] of ents) {
      c.save(); c.translate(e.x, e.y);
      if (k === 0) {
        // traqueur : presque invisible sauf de près, quand il bondit, plaque ou se fait toucher
        if (e.ty === 'stalker') {
          const near = v.players.some((p) => p.state !== 2 && Math.hypot(p.x - e.x, p.y - e.y) < 190);
          e.alpha = e.flags & (2048 | 4096 | 128 | 32) || near ? 1 : 0.13;
          c.globalAlpha = e.alpha;
        }
        if (e.flags & 8) { c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 6); circ(c, 0, 0, e.r + 7); c.fillStyle = '#ffb03a'; c.fill(); c.globalAlpha = 1; }
        if (e.flags & 16) { circ(c, 0, 0, e.r + 4); c.strokeStyle = '#ff4b2b'; c.lineWidth = 2; c.stroke(); }
        drawZombie(c, e, t);
        c.globalAlpha = 1;
      } else {
        if (e.shadow) c.globalAlpha = e.id === v.meId ? 0.55 : 0.35;
        if (e.shield) {
          circ(c, 0, 0, 30 + Math.sin(t * 8) * 1.5); c.fillStyle = 'rgba(43,140,255,.18)'; c.fill();
          c.strokeStyle = 'rgba(140,200,255,.85)'; c.lineWidth = 3; c.stroke();
        }
        if (e.barrage) { circ(c, 0, 0, 26); c.strokeStyle = `rgba(255,197,49,${0.5 + 0.3 * Math.sin(t * 20)})`; c.lineWidth = 3; c.stroke(); }
        if (e.dash) { c.globalAlpha = 0.3; c.save(); c.translate(-e.vx * 0.05, -e.vy * 0.05); drawSurvivor(c, e, t); c.restore(); c.globalAlpha = 1; }
        drawSurvivor(c, e, t);
        if (fx.muzzle.has(e.id) && e.state !== 1) this.muzzleFlash(c, e);
        c.globalAlpha = 1;
      }
      c.restore();
    }

    // ---- projectiles ennemis et grenades
    for (const o of v.eprojs) {
      const [, k, x, y, h, big] = o;
      ell(c, x, y + 4, big ? 12 : 8, big ? 6 : 4); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill();
      if (k === 0) { circ(c, x, y - h, big ? 11 : 7); fs(c, '#9be15d', 2.5); circ(c, x - 2, y - h - 2, big ? 4 : 2.5); c.fillStyle = '#e6ffc2'; c.fill(); }
      else { circ(c, x, y - h, 7); fs(c, '#4a5d32', 2.5); if (Math.sin(t * 30) > 0) { circ(c, x + 3, y - h - 5, 2.5); c.fillStyle = '#ff4b2b'; c.fill(); } }
    }

    fx.drawOver(c);

    // ---- obscurité et lumières
    this.lighting(v, setWorld, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.light, 0, 0, this.cv.width, this.cv.height);
    setWorld(c, dpr);
    this.colorGlow(c, v, t);

    // ---- par-dessus l'obscurité : yeux, lueurs, avertissements, étiquettes
    for (const z of v.zombies) zombieEyes(c, z);
    fx.drawGlow(c);
    this.telegraphs(c, v, t);
    this.labels(c, v, t);
    fx.drawTexts(c);

    // ---- écran
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.screenOverlays(c, v, t);
  }

  drawHazard(c, h, t) {
    const [id, k, x, y, r, f] = h;
    const a = Math.min(1, f * 3);
    if (k === 'heal') {
      circ(c, x, y, r); c.fillStyle = `rgba(47,191,113,${0.14 * a})`; c.fill();
      c.strokeStyle = `rgba(127,240,176,${0.8 * a})`; c.lineWidth = 3; c.setLineDash([14, 10]); c.lineDashOffset = -t * 30; c.stroke(); c.setLineDash([]);
      c.strokeStyle = `rgba(47,191,113,${0.5 * a})`; c.lineWidth = 2; circ(c, x, y, r * (1 - ((t * 0.8) % 1))); c.stroke();
      c.fillStyle = `rgba(255,255,255,${0.75 * a})`; c.fillRect(x - 6, y - 18, 12, 36); c.fillRect(x - 18, y - 6, 36, 12);
      c.fillStyle = `rgba(47,191,113,${0.9 * a})`; c.fillRect(x - 3.5, y - 15, 7, 30); c.fillRect(x - 15, y - 3.5, 30, 7);
      return;
    }
    if (k === 'acid') {
      c.globalAlpha = 0.75 * a;
      c.fillStyle = '#5a9a1f'; ell(c, x, y, r, r * 0.8, id); c.fill();
      c.fillStyle = '#9be15d'; ell(c, x + Math.sin(t * 2 + id) * 4, y, r * 0.7, r * 0.5, id); c.fill();
      c.fillStyle = '#e6ffc2';
      for (let i = 0; i < 4; i++) { const bb = (t * 1.5 + i * 0.25 + id) % 1; circ(c, x + Math.cos(i * 2 + id) * r * 0.45, y + Math.sin(i * 3 + id) * r * 0.3, 2 + bb * 4); c.globalAlpha = 0.6 * a * (1 - bb); c.fill(); }
      c.globalAlpha = 1;
    } else {
      for (let i = 0; i < 5; i++) {
        const ang = t * 0.4 + i * 1.3 + id;
        c.globalAlpha = 0.22 * a; c.fillStyle = '#8fbf4a';
        circ(c, x + Math.cos(ang) * r * 0.35, y + Math.sin(ang) * r * 0.3, r * 0.6); c.fill();
      }
      c.globalAlpha = 1;
    }
  }

  drawDoor(c, d, v, dt, t) {
    const open = d.kind === 'exit' && v.doorsOpen;
    const cur = this.doorAnim.get(d.id) || 0;
    const nv = Math.max(0, Math.min(1, cur + (open ? dt * 1.6 : -dt * 3)));
    this.doorAnim.set(d.id, nv);
    const half = (d.w / 2) * (1 - nv);
    const y0 = d.side === 'top' ? 0 : d.y, h = d.side === 'top' ? WALL_TOP : d.h;
    c.fillStyle = '#0d0f13'; c.fillRect(d.x, y0, d.w, h);
    if (nv > 0.02 && d.side === 'top') { // couloir éclairé derrière
      const g = c.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, 'rgba(47,191,113,.0)'); g.addColorStop(1, 'rgba(47,191,113,.35)');
      c.fillStyle = g; c.fillRect(d.x + d.w / 2 - (d.w / 2 - half), y0, (d.w / 2 - half) * 2, h);
    }
    const panel = (x, w) => {
      if (w < 1) return;
      rr(c, x, y0 + 2, w, h - 4, 3); fs(c, '#59616d', 3);
      c.save(); c.beginPath(); c.rect(x + 3, y0 + h / 2 - 7, w - 6, 14); c.clip();
      c.fillStyle = '#ffc531'; c.fillRect(x, y0 + h / 2 - 7, w, 14);
      c.fillStyle = INK; for (let k = -20; k < w + 20; k += 16) { c.beginPath(); c.moveTo(x + k, y0 + h / 2 + 7); c.lineTo(x + k + 8, y0 + h / 2 + 7); c.lineTo(x + k + 22, y0 + h / 2 - 7); c.lineTo(x + k + 14, y0 + h / 2 - 7); c.fill(); }
      c.restore();
    };
    panel(d.x, half); panel(d.x + d.w - half, half);
    if (d.kind !== 'exit') return;
    // voyant et pancarte de destination
    const lit = open ? '#2fbf71' : '#ff4b2b';
    circ(c, d.x - 14, 14, 6); fs(c, lit, 2); circ(c, d.x + d.w + 14, 14, 6); fs(c, lit, 2);
    const R = ROOM_TYPES[d.to];
    const label = (R.icon ? R.icon + ' ' : '') + R.name.split(' — ')[0].toUpperCase();
    c.font = '700 15px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const tw = c.measureText(label).width + 20;
    const ly = WALL_TOP + 40;
    const rally = v.rally && v.rally.d === d.id;
    rr(c, d.x + d.w / 2 - tw / 2, ly - 13, tw, 26, 7); fs(c, rally ? '#2fbf71' : open ? '#fff8ea' : 'rgba(255,248,234,.75)', 2.5);
    c.fillStyle = INK; c.fillText(label, d.x + d.w / 2, ly + 1);
    if (R.reward) { c.font = '600 12px "Chakra Petch", sans-serif'; c.lineWidth = 3; c.strokeStyle = INK; c.strokeText(R.reward, d.x + d.w / 2, ly + 26); c.fillStyle = '#ffc531'; c.fillText(R.reward, d.x + d.w / 2, ly + 26); }
  }

  muzzleFlash(c, p) {
    c.save(); c.rotate(p.a);
    const L = (MUZZLE[p.weapon] || 20) + 10 - (p.recoil || 0);
    c.translate(L, p.weapon === 'pistol' ? 0 : 3);
    c.fillStyle = '#fff3c4';
    c.beginPath(); c.moveTo(0, -5); c.lineTo(16 + Math.random() * 8, 0); c.lineTo(0, 5); c.lineTo(5, 0); c.closePath(); c.fill();
    c.fillStyle = '#ffb347'; circ(c, 2, 0, 4); c.fill();
    c.restore();
  }

  // Carte de lumière : on part du noir et on « creuse » les zones éclairées
  lighting(v, setWorld, t) {
    const lc = this.lc, th = this.theme;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    const dark = v.dark ?? th.dark;
    lc.clearRect(0, 0, this.light.width, this.light.height);
    lc.fillStyle = `rgba(3,5,12,${dark})`; lc.fillRect(0, 0, this.light.width, this.light.height);
    lc.globalCompositeOperation = 'destination-out';
    setWorld(lc, this.dpr * LS);
    const blob = (x, y, r, a) => {
      const g = lc.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g; lc.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const cone = (x, y, a, L, half, alpha) => {
      const g = lc.createRadialGradient(x, y, 10, x, y, L);
      g.addColorStop(0, `rgba(0,0,0,${alpha})`); g.addColorStop(0.65, `rgba(0,0,0,${alpha * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g; lc.beginPath(); lc.moveTo(x, y); lc.arc(x, y, L, a - half, a + half); lc.closePath(); lc.fill();
    };
    for (const l of this.lv.lamps) blob(l.x, l.y + 40, 280, 0.42);
    for (const p of v.players) {
      if (p.state === 2) continue;
      const mine = p.id === v.meId;
      blob(p.x, p.y, mine ? 170 : 130, 0.9);
      if (p.state === 0) cone(p.x + Math.cos(p.a) * 12, p.y + Math.sin(p.a) * 12, p.a, mine ? 620 : 460, 0.5, mine ? 1 : 0.8);
    }
    for (const l of this.fx.lights) blob(l.x, l.y, l.r, l.a * (l.life / l.max));
    let n = 0;
    for (const p of this.fx.parts) if ((p.k === 'flame' || p.k === 'fire') && (n++ % 3 === 0)) blob(p.x, p.y, 90, 0.5 * (p.life / p.max));
    for (const h of v.hazards) blob(h[2], h[3], h[4] * 1.4, h[1] === 'acid' ? 0.4 : h[1] === 'heal' ? 0.55 : 0.2);
    for (const tt of v.turrets || []) blob(tt[1], tt[2], 120, 0.5);
    for (const k of v.pickups) blob(k.x, k.y, k.k === 'weapon' ? 110 : 70, 0.4);
    for (const d of this.lv.doors) if (d.kind === 'exit') blob(d.x + d.w / 2, WALL_TOP, 200, v.doorsOpen ? 0.7 : 0.35);
    for (const z of v.zombies) { if (z.flags & 2) blob(z.x, z.y, 90, 0.6); if (z.ty === 'boss') blob(z.x, z.y, 240, 0.45); }
    for (const o of v.eprojs) blob(o[2], o[3], 60, 0.4);
    lc.globalCompositeOperation = 'source-over';
  }

  colorGlow(c, v, t) {
    c.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, col, a) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const lock = !v.cleared && v.mode !== 'survival';
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    for (const l of this.lv.lamps) {
      if (lock) glow(l.x, l.y + 10, 220, 'rgba(255,40,30,A)', 0.1 + 0.12 * pulse);
      else glow(l.x, l.y + 10, 200, 'rgba(255,220,160,A)', 0.08);
    }
    for (const l of this.fx.lights) { const f = l.life / l.max; const rgb = hexToRgb(l.c); glow(l.x, l.y, l.r * 0.6, `rgba(${rgb},A)`, 0.35 * f); }
    for (const h of v.hazards) glow(h[2], h[3], h[4] * 1.2, h[1] === 'heal' ? 'rgba(60,230,140,A)' : 'rgba(120,220,60,A)', h[1] === 'acid' ? 0.18 : h[1] === 'heal' ? 0.22 : 0.08);
    for (const p of v.players) if (p.shield) glow(p.x, p.y, 90, 'rgba(60,140,255,A)', 0.25);
    for (const d of this.lv.doors) if (d.kind === 'exit') glow(d.x + d.w / 2, WALL_TOP + 10, 160, v.doorsOpen ? 'rgba(47,191,113,A)' : 'rgba(255,60,40,A)', 0.18);
    for (const z of v.zombies) {
      if (z.ty === 'boss') glow(z.x, z.y, 160, 'rgba(199,125,255,A)', 0.25);
      if (z.ty === 'spitter') glow(z.x, z.y, 50, 'rgba(155,225,93,A)', z.flags & 4 ? 0.45 : 0.15);
      if (z.flags & 2) glow(z.x, z.y, 60, 'rgba(255,130,40,A)', 0.35);
    }
    for (const o of v.eprojs) glow(o[2], o[3] - o[4], 40, o[1] === 0 ? 'rgba(155,225,93,A)' : 'rgba(255,80,60,A)', 0.4);
    c.globalCompositeOperation = 'source-over';
    // zombies en feu : petites flammes
    for (const z of v.zombies) if (z.flags & 2 && Math.random() < 0.5) this.fx.parts.push({ k: 'flame', x: z.x + (Math.random() - 0.5) * z.r, y: z.y + (Math.random() - 0.5) * z.r, vx: 0, vy: -40, life: 0.35, max: 0.35, r: 5 });
  }

  telegraphs(c, v, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 18);
    for (const z of v.zombies) {
      if (z.flags & 256) { // charge
        c.save(); c.translate(z.x, z.y); c.rotate(z.lockA);
        c.fillStyle = `rgba(255,60,40,${0.18 + 0.15 * pulse})`; c.fillRect(z.r * 0.5, -z.r, 520, z.r * 2);
        c.strokeStyle = `rgba(255,90,60,${0.6 + 0.3 * pulse})`; c.lineWidth = 3; c.setLineDash([16, 12]); c.strokeRect(z.r * 0.5, -z.r, 520, z.r * 2); c.setLineDash([]);
        c.fillStyle = `rgba(255,200,180,${0.5 + 0.4 * pulse})`;
        for (let k = 0; k < 4; k++) { const x = 90 + k * 110 + ((t * 300) % 110); c.beginPath(); c.moveTo(x, -10); c.lineTo(x + 18, 0); c.lineTo(x, 10); c.closePath(); c.fill(); }
        c.restore();
      }
      if (z.flags & 512) { circ(c, z.x, z.y, 230); c.fillStyle = `rgba(255,60,40,${0.12 + 0.1 * pulse})`; c.fill(); c.strokeStyle = `rgba(255,90,60,${0.7})`; c.lineWidth = 3; c.stroke(); }
      if (z.ty === 'stalker' && z.flags & 4096 && !(z.flags & 64)) {
        c.save(); c.translate(z.x, z.y); c.rotate(z.lockA);
        c.strokeStyle = `rgba(200,140,255,${0.5 + 0.4 * pulse})`; c.lineWidth = 3; c.setLineDash([10, 8]);
        c.beginPath(); c.moveTo(16, 0); c.lineTo(330, 0); c.stroke(); c.setLineDash([]); c.restore();
      }
      if (z.flags & 2048) { c.font = '16px sans-serif'; c.textAlign = 'center'; c.fillText('⚠', z.x, z.y - 30); }
      if (z.flags & 1024) { circ(c, z.x, z.y, 115); c.fillStyle = `rgba(200,255,90,${0.1 + 0.12 * pulse})`; c.fill(); c.strokeStyle = 'rgba(200,255,90,.8)'; c.lineWidth = 2.5; c.setLineDash([10, 8]); c.stroke(); c.setLineDash([]); }
      // barres de vie des gros et des élites
      if ((z.ty === 'brute' || z.flags & 8) && z.hp < 1) {
        const w = z.r * 2.2;
        rr(c, z.x - w / 2, z.y - z.r - 16, w, 6, 3); c.fillStyle = 'rgba(0,0,0,.6)'; c.fill();
        rr(c, z.x - w / 2, z.y - z.r - 16, w * z.hp, 6, 3); c.fillStyle = z.flags & 8 ? '#ffb03a' : '#ff4b2b'; c.fill();
      }
    }
    for (const o of v.eprojs) {
      const [, k, x, y, h, big, tx2, ty2, f] = o;
      if (k === 0) { const r = big ? 70 : 50; circ(c, tx2, ty2, r * (0.4 + 0.6 * f)); c.strokeStyle = 'rgba(155,225,93,.85)'; c.lineWidth = 2.5; c.setLineDash([8, 6]); c.stroke(); c.setLineDash([]); c.fillStyle = `rgba(155,225,93,${0.12 + 0.15 * f})`; c.fill(); }
      else if (f > 0.55) { circ(c, x, y, 145); c.strokeStyle = `rgba(255,80,60,${(f - 0.55) * 1.6})`; c.lineWidth = 2; c.setLineDash([8, 8]); c.stroke(); c.setLineDash([]); }
    }
  }

  labels(c, v, t) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const p of v.players) {
      if (p.state === 2) continue;
      const mine = p.id === v.meId;
      if (!mine) {
        c.font = '700 13px "Chakra Petch", sans-serif';
        c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(p.name, p.x, p.y - 38); c.fillStyle = p.color; c.fillText(p.name, p.x, p.y - 38);
        rr(c, p.x - 20, p.y - 29, 40, 6, 3); c.fillStyle = 'rgba(0,0,0,.65)'; c.fill();
        rr(c, p.x - 20, p.y - 29, 40 * Math.max(0, p.h / p.H), 6, 3); c.fillStyle = p.h / p.H < 0.35 ? '#ff4b2b' : '#2fbf71'; c.fill();
      }
      if (p.pinned && Math.sin(t * 10) > -0.2) { c.font = 'bold 13px "Chakra Petch", sans-serif'; c.lineWidth = 4; c.strokeStyle = INK; c.strokeText('AIDEZ-MOI !', p.x, p.y + 36); c.fillStyle = '#ff4b2b'; c.fillText('AIDEZ-MOI !', p.x, p.y + 36); }
      if (p.state === 1) { // à terre : compte à rebours et progression de réanimation
        const f = Math.max(0, p.bl / (v.bleedMax || 28));
        c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.6)'; circ(c, p.x, p.y, 30); c.stroke();
        c.strokeStyle = '#ff4b2b'; c.beginPath(); c.arc(p.x, p.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); c.stroke();
        if (p.rv > 0) { c.strokeStyle = '#2fbf71'; c.lineWidth = 7; c.beginPath(); c.arc(p.x, p.y, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.rv); c.stroke(); }
        if (Math.sin(t * 6) > -0.3) { c.font = '18px sans-serif'; c.fillText('✚', p.x, p.y - 52); }
      }
      if (mine && p.rl > 0) {
        c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.5)'; circ(c, p.x, p.y, 27); c.stroke();
        c.strokeStyle = '#ffc531'; c.beginPath(); c.arc(p.x, p.y, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.rl); c.stroke();
      }
    }
  }

  screenOverlays(c, v, t) {
    const W = this.W, H = this.H;
    // indicateurs hors écran : alliés, derniers zombies, porte choisie
    const edge = (wx, wy, col, label) => {
      const s = this.toScreen(wx, wy);
      if (s.x > 30 && s.x < W - 30 && s.y > 30 && s.y < H - 30) return;
      const cx = W / 2, cy = H / 2, a = Math.atan2(s.y - cy, s.x - cx);
      const k = Math.min((W / 2 - 34) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - 34) / Math.abs(Math.sin(a) || 1e-6));
      const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
      c.save(); c.translate(x, y); c.rotate(a);
      c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -11); c.lineTo(-8, 11); c.closePath(); fs(c, col, 2.5);
      c.restore();
      if (label) { c.font = '700 12px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = INK; c.strokeText(label, x - Math.cos(a) * 24, y - Math.sin(a) * 22); c.fillStyle = col; c.fillText(label, x - Math.cos(a) * 24, y - Math.sin(a) * 22); }
    };
    for (const p of v.players) if (p.id !== v.meId && p.state !== 2) edge(p.x, p.y, p.state === 1 ? '#ff4b2b' : p.color, p.state === 1 ? '✚ ' + p.name : p.name);
    if (!v.cleared && v.zombies.length && v.zombies.length <= 4 && v.waveLeft <= 4) for (const z of v.zombies) edge(z.x, z.y, '#ff6a4a');
    if (v.doorsOpen) for (const d of this.lv.doors) if (d.kind === 'exit') edge(d.x + d.w / 2, WALL_TOP + 20, '#2fbf71');

    // vignette + dégâts
    const me = v.me;
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    let red = this.fx.hurtFlash * 0.5;
    if (me && me.state === 0 && me.h < me.H * 0.3) red = Math.max(red, 0.18 + 0.14 * Math.sin(t * 7));
    if (me && me.state === 1) red = 0.35;
    if (red > 0.01) {
      const g2 = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
      g2.addColorStop(0, 'rgba(180,0,0,0)'); g2.addColorStop(1, `rgba(180,0,0,${red})`);
      c.fillStyle = g2; c.fillRect(0, 0, W, H);
    }
    if (me && me.state !== 0) { c.fillStyle = me.state === 2 ? 'rgba(20,20,30,.35)' : 'rgba(60,0,0,.12)'; c.fillRect(0, 0, W, H); }

    // sticks tactiles
    if (v.touch) for (const k of ['move', 'aim']) {
      const T = v.touch[k]; if (!T) continue;
      c.globalAlpha = 0.5; circ(c, T.ox, T.oy, 60); c.strokeStyle = '#fff8ea'; c.lineWidth = 3; c.stroke();
      const dx = T.x - T.ox, dy = T.y - T.oy, d = Math.hypot(dx, dy), m = Math.min(60, d);
      circ(c, T.ox + (d ? (dx / d) * m : 0), T.oy + (d ? (dy / d) * m : 0), 24); c.fillStyle = k === 'aim' ? '#ff4b2b' : '#fff8ea'; c.fill();
      c.globalAlpha = 1;
    }
    // réticule
    if (v.cross) {
      const { x, y } = v.cross;
      const spread = 8 + (v.spread || 0) * 160;
      c.save(); c.translate(x, y);
      c.lineCap = 'round';
      for (const [col, w] of [[INK, 6], ['#fff8ea', 2.5]]) {
        c.strokeStyle = col; c.lineWidth = w; c.beginPath();
        for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + Math.PI / 4; c.moveTo(Math.cos(a) * spread, Math.sin(a) * spread); c.lineTo(Math.cos(a) * (spread + 8), Math.sin(a) * (spread + 8)); }
        c.stroke();
      }
      circ(c, 0, 0, 2.6); fs(c, '#ff4b2b', 2);
      if (me && me.rl > 0) { c.strokeStyle = '#ffc531'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, spread + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * me.rl); c.stroke(); }
      c.restore();
    }
  }
}

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }
