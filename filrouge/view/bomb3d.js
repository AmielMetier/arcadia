// La bombe en 3D : boîtier, étiquette de lot, tampons, vis, chrono et les six modules.
// Chaque module expose sync(mod) pour suivre l'état reçu de l'hôte. Les pièces cliquables portent
// userData.pick = { m, op, i, d } (relu par la scène au clic) et userData.press (petite animation).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { canvasTex, roundRect, FONT, BUNG } from './tex.js';
import { WIRE_COLORS, KEY_COLORS, GAUGE_COLORS, LED_COLORS, OUTLETS } from '../engine/manual.js';
import { drawRune } from '../engine/runes.js';
import { pipeSides, pipeFlow, TIMER_SLOT } from '../engine/modules.js';

export const PITCH = 1.1;
export const CASE = { w: 3 * PITCH + 0.3, h: 2 * PITCH + 0.3, d: 1.05 };
const Z0 = 0.05; // dessus de la plaque d'un module

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25, ...o });
const box = (w, h, d, m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.castShadow = true; me.receiveShadow = true; return me; };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

// Plan texturé posé sur la plaque
function decal(w, h, tex, z = Z0 + 0.002) {
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0, transparent: true }));
  me.position.z = z; me.receiveShadow = true;
  return me;
}

// Bouton : pavé avec étiquette sur le dessus
function button(w, h, color, text, pick, { depth = 0.05, fg = '#16181d', size = 46 } = {}) {
  const cw = 256, ch = Math.max(64, Math.round(256 * h / w));
  const face = canvasTex(cw, ch, (ctx) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, cw, ch);
    const g = ctx.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    if (typeof text === 'function') text(ctx, cw, ch);
    else if (text) { ctx.fillStyle = fg; ctx.font = `${size}px ${BUNG}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cw / 2, ch / 2 + 3); }
  });
  const side = std(color, { roughness: 0.4 });
  const top = new THREE.MeshStandardMaterial({ map: face.tex, roughness: 0.4, metalness: 0.1 });
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), [side, side, side, side, top, side]);
  me.castShadow = true;
  me.position.z = Z0 + depth / 2;
  me.userData.pick = pick; me.userData.press = me; me.userData.baseZ = me.position.z;
  return me;
}
const tri = (dir) => (ctx, w, h) => {
  ctx.fillStyle = '#16181d'; ctx.beginPath();
  const cx = w / 2, cy = h / 2, s = Math.min(w, h) * 0.28;
  if (dir > 0) { ctx.moveTo(cx - s * 0.7, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx - s * 0.7, cy + s); }
  else if (dir < 0) { ctx.moveTo(cx + s * 0.7, cy - s); ctx.lineTo(cx - s, cy); ctx.lineTo(cx + s * 0.7, cy + s); }
  ctx.fill();
};
const triV = (up) => (ctx, w, h) => {
  ctx.fillStyle = '#16181d'; ctx.beginPath();
  const cx = w / 2, cy = h / 2, s = Math.min(w, h) * 0.3;
  if (up) { ctx.moveTo(cx - s, cy + s * 0.6); ctx.lineTo(cx, cy - s * 0.8); ctx.lineTo(cx + s, cy + s * 0.6); }
  else { ctx.moveTo(cx - s, cy - s * 0.6); ctx.lineTo(cx, cy + s * 0.8); ctx.lineTo(cx + s, cy - s * 0.6); }
  ctx.fill();
};

function lamp(r = 0.03, color = '#ff3030') {
  const m = new THREE.MeshStandardMaterial({ color: '#3a3a3a', emissive: color, emissiveIntensity: 0, roughness: 0.3 });
  const me = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  me.userData.on = (v, c) => { if (c) m.emissive.set(c); m.emissiveIntensity = v ? 2.4 : 0; m.color.set(v ? '#ffffff' : '#3a3a3a'); };
  return me;
}

// Plaque commune : fond métal, rebord, voyant d'état en haut à droite
function plate(g, tone = '#2c3038') {
  const p = box(0.98, 0.98, Z0, std(tone, { roughness: 0.6, metalness: 0.5 }));
  p.position.z = Z0 / 2; g.add(p);
  const led = at(lamp(0.035, '#3dff7a'), 0.41, 0.41, Z0 + 0.02); g.add(led);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 20), std('#111', { metalness: 0.7 })); ring.position.set(0.41, 0.41, Z0 + 0.005); g.add(ring);
  return led;
}
function engraved(g, text, x, y, w = 0.5, h = 0.07) {
  const t = canvasTex(512, Math.round(512 * h / w), (ctx, cw, ch) => {
    ctx.fillStyle = 'rgba(230,230,220,.75)'; ctx.font = `600 ${Math.round(ch * 0.62)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch / 2);
  });
  g.add(at(decal(w, h, t.tex), x, y, Z0 + 0.002));
}

/* ======================================================================= chrono */
function buildTimer(g, ctx) {
  plate(g, '#23262c').userData.on(false);
  const lcd = box(0.8, 0.36, 0.06, std('#0b0b0b', { roughness: 0.2 }));
  at(lcd, 0, 0.12, Z0 + 0.03); g.add(lcd);
  const disp = canvasTex(512, 224, null);
  const screen = decal(0.76, 0.32, disp.tex, Z0 + 0.062);
  screen.material = new THREE.MeshBasicMaterial({ map: disp.tex, toneMapped: false });
  at(screen, 0, 0.12, Z0 + 0.062); g.add(screen);
  const lamps = [];
  const n = ctx.maxStrikes;
  for (let k = 0; k < n; k++) { const l = at(lamp(0.04, '#ff2a2a'), (k - (n - 1) / 2) * 0.13, -0.18, Z0 + 0.03); lamps.push(l); g.add(l); }
  engraved(g, 'FAUTES', 0, -0.27, 0.4, 0.06);
  engraved(g, `FIL ROUGE · MANUEL ÉD. ${ctx.edition}`, 0, -0.4, 0.86, 0.08);
  let shown = '';
  return {
    sync(team, ms, flash) {
      const s = Math.ceil(ms / 1000), txt = team.status === 'defused' ? 'OK' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      const color = team.status === 'defused' ? '#3dff7a' : flash ? '#ffd0d0' : '#ff2a2a';
      const key = txt + color;
      if (key !== shown) {
        shown = key;
        disp.redraw((c, w, h) => {
          c.fillStyle = '#080808'; c.fillRect(0, 0, w, h);
          c.font = `170px ${BUNG}`; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillStyle = 'rgba(255,40,40,.08)'; c.fillText(team.status === 'defused' ? '88' : '88:88', w / 2, h / 2 + 10);
          c.fillStyle = color; c.shadowColor = color; c.shadowBlur = 24; c.fillText(txt, w / 2, h / 2 + 10);
        });
      }
      lamps.forEach((l, k) => l.userData.on(k < team.strikes));
    },
  };
}

/* ======================================================================= raccordements */
function buildWires(g, mod, m) {
  const led = plate(g);
  const yAt = (i) => 0.33 - i * 0.13;
  const bg = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#e9e3d3'; roundRect(c, 4, 4, w - 8, h - 8, 20); c.fill();
    c.fillStyle = '#16181d'; c.font = `46px ${BUNG}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) {
      const y = h / 2 - yAt(i) / 0.9 * h;
      c.fillText('ABCDEF'[i], 34, y + 2); c.fillText(String(i + 1), w - 34, y + 2);
    }
  });
  g.add(at(decal(0.9, 0.9, bg.tex), 0, 0, Z0 + 0.002));
  const brass = std('#c9a24a', { metalness: 0.85, roughness: 0.3 });
  for (let i = 0; i < 6; i++) for (const x of [-0.33, 0.33]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 14), brass);
    post.rotation.x = Math.PI / 2; at(post, x, yAt(i), Z0 + 0.03); post.castShadow = true; g.add(post);
  }
  const items = mod.wires.map((w, k) => {
    const zb = 0.1 + (k % 3) * 0.05;
    const a = new THREE.Vector3(-0.33, yAt(w.l), Z0 + 0.05), b = new THREE.Vector3(0.33, yAt(w.r), Z0 + 0.05);
    const curve = new THREE.CatmullRomCurve3([a, new THREE.Vector3(-0.18, yAt(w.l) * 0.85 + yAt(w.r) * 0.15, zb), new THREE.Vector3(0.18, yAt(w.l) * 0.15 + yAt(w.r) * 0.85, zb), b]);
    const material = std(WIRE_COLORS[w.c].hex, { roughness: 0.45, metalness: 0.05 });
    const whole = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.022, 10, false), material);
    whole.castShadow = true; whole.userData.pick = { m, op: 'cut', i: k, kind: 'wire' };
    g.add(whole);
    return { whole, curve, material, cut: false };
  });
  function cutWire(it) {
    it.cut = true; g.remove(it.whole);
    const pts = it.curve.getPoints(60);
    const half = (from, to) => {
      const c = new THREE.CatmullRomCurve3(pts.slice(from, to));
      const me = new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.022, 10, false), it.material); me.castShadow = true; g.add(me);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8), std('#c87533', { metalness: 0.9, roughness: 0.3 }));
      cap.position.copy(pts[from === 0 ? to - 1 : from]); g.add(cap);
    };
    half(0, 26); half(35, 61);
  }
  return { led, sync(mod) { mod.wires.forEach((w, k) => { if (w.cut && !items[k].cut) cutWire(items[k]); }); } };
}

/* ======================================================================= coffre */
function buildSafe(g, mod, m) {
  const led = plate(g);
  const lcd = box(0.8, 0.26, 0.05, std('#0b0b0b', { roughness: 0.2 })); at(lcd, 0, 0.29, Z0 + 0.025); g.add(lcd);
  const scr = canvasTex(512, 166, (c, w, h) => {
    c.fillStyle = '#0d1f14'; c.fillRect(0, 0, w, h);
    mod.runes.forEach((r, k) => drawRune(c, r, 42 + k * 156, 18, 130, '#7dffb0', 11));
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.22), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
  at(screen, 0, 0.29, Z0 + 0.052); g.add(screen);
  const lamps = [0, 1, 2].map((k) => { const l = at(lamp(0.026, '#ffb020'), -0.42 + k * 0.0, 0, 0); l.position.set(-0.12 + k * 0.12, 0.11, Z0 + 0.02); g.add(l); return l; });
  // molette
  const face = canvasTex(512, 512, (c, w, h) => {
    const g2 = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    g2.addColorStop(0, '#d9d9d9'); g2.addColorStop(0.8, '#9c9c9c'); g2.addColorStop(1, '#5b5b5b');
    c.fillStyle = g2; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, 7); c.fill();
    c.fillStyle = '#16181d'; c.font = `64px ${BUNG}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI * 2 / 10;
      c.fillText(String(k), w / 2 + Math.cos(a) * 180, h / 2 + Math.sin(a) * 180 + 4);
      c.fillRect(w / 2 + Math.cos(a) * 232 - 3, h / 2 + Math.sin(a) * 232 - 3, 6, 6);
    }
    c.beginPath(); c.arc(w / 2, h / 2, 70, 0, 7); c.fillStyle = '#3d3d3d'; c.fill();
  });
  const dialSide = std('#7c7c7c', { metalness: 0.8, roughness: 0.35 });
  const dialFace = new THREE.MeshStandardMaterial({ map: face.tex, metalness: 0.5, roughness: 0.4 });
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.07, 40), [dialSide, dialFace, dialSide]);
  dial.rotation.x = Math.PI / 2;
  const dialPivot = at(new THREE.Group(), 0, -0.17, Z0 + 0.035);
  dialPivot.add(dial); g.add(dialPivot); dial.castShadow = true;
  dial.userData.pick = { m, op: 'dial', d: 1, kind: 'dial' };
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 3), std('#ff2a2a', { emissive: '#ff2a2a', emissiveIntensity: 0.5 }));
  pointer.rotation.z = Math.PI; at(pointer, 0, 0.08, Z0 + 0.02); g.add(pointer);
  g.add(at(button(0.13, 0.17, '#f3e9d2', tri(-1), { m, op: 'dial', d: -1 }), -0.37, -0.17, 0));
  g.add(at(button(0.13, 0.17, '#f3e9d2', tri(1), { m, op: 'dial', d: 1 }), 0.37, -0.17, 0));
  const enter = button(0.42, 0.1, '#ffc531', 'ENTRER', { m, op: 'enter' }, { size: 40 });
  at(enter, 0, -0.42, enter.position.z); g.add(enter);
  // la molette tourne pour amener le chiffre choisi sous le repère
  let target = 0;
  return {
    led,
    sync(mod) { target = mod.pos * Math.PI * 2 / 10; lamps.forEach((l, k) => l.userData.on(k < mod.entered.length || mod.solved)); },
    tick(dt) { dial.rotation.y += (target - dial.rotation.y) * Math.min(1, dt * 12); },
  };
}

/* ======================================================================= leviers */
function buildSwitches(g, mod, m) {
  const led = plate(g);
  const lcd = box(0.44, 0.17, 0.05, std('#0b0b0b')); at(lcd, -0.1, 0.36, Z0 + 0.025); g.add(lcd);
  const scr = canvasTex(256, 100, (c, w, h) => {
    c.fillStyle = '#0d1f14'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7dffb0'; c.shadowColor = '#7dffb0'; c.shadowBlur = 14; c.font = `72px ${BUNG}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(mod.code, w / 2, h / 2 + 4);
  });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false })); at(s, -0.1, 0.36, Z0 + 0.052); g.add(s);
  const nums = canvasTex(512, 64, (c, w, h) => {
    c.fillStyle = 'rgba(230,230,220,.8)'; c.font = `600 40px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 5; i++) c.fillText(String(i + 1), w / 2 + (i - 2) * 0.18 / 0.9 * w, h / 2);
  });
  g.add(at(decal(0.9, 0.06, nums.tex), 0, -0.25, Z0 + 0.002));
  const levers = [];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.18;
    const l = at(lamp(0.035), x, 0.17, Z0 + 0.02); g.add(l);
    l.userData.on(mod.leds[i] > 0, LED_COLORS[mod.leds[i]].hex);
    const base = box(0.11, 0.2, 0.05, std('#1a1a1a', { metalness: 0.6 })); at(base, x, -0.05, Z0 + 0.025); g.add(base);
    base.userData.pick = { m, op: 'flip', i, kind: 'lever' };
    const piv = at(new THREE.Group(), x, -0.05, Z0 + 0.05); g.add(piv);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.17, 12), std('#d8d8d8', { metalness: 0.9, roughness: 0.25 }));
    stick.rotation.x = Math.PI / 2; stick.position.z = 0.085; stick.castShadow = true; piv.add(stick);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), std('#16181d', { roughness: 0.3 })); knob.position.z = 0.17; knob.castShadow = true; piv.add(knob);
    stick.userData.pick = knob.userData.pick = base.userData.pick;
    levers.push({ piv, target: 0 });
  }
  const ok = button(0.42, 0.1, '#ff4b2b', 'VALIDER', { m, op: 'submit' }, { fg: '#fff', size: 40 });
  at(ok, 0, -0.39, ok.position.z); g.add(ok);
  return {
    led,
    sync(mod) { mod.up.forEach((u, i) => { levers[i].target = u ? -0.6 : 0.6; }); },
    tick(dt) { for (const l of levers) l.piv.rotation.x += (l.target - l.piv.rotation.x) * Math.min(1, dt * 18); },
  };
}

/* ======================================================================= carillon */
function buildChime(g, mod, m) {
  const led = plate(g);
  const grille = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#16181d'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, 7); c.fill();
    c.fillStyle = '#4a4f59';
    for (let y = 20; y < h; y += 22) for (let x = 20; x < w; x += 22) if ((x - w / 2) ** 2 + (y - h / 2) ** 2 < (w / 2 - 22) ** 2) { c.beginPath(); c.arc(x + (y % 44 ? 11 : 0), y, 6, 0, 7); c.fill(); }
  });
  g.add(at(decal(0.34, 0.34, grille.tex), -0.22, 0.22, Z0 + 0.004));
  const play = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 30), [std('#c8102e'), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e23b3b'; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 2); c.translate(-w / 2, -h / 2); tri(1)(c, w, h); c.restore(); }).tex }), std('#c8102e')]);
  play.rotation.x = Math.PI / 2; at(play, 0.24, 0.22, Z0 + 0.025); play.castShadow = true; g.add(play);
  play.userData.pick = { m, op: 'play', local: true }; play.userData.press = play; play.userData.baseZ = play.position.z;
  engraved(g, 'ÉCOUTER', 0.24, 0.07, 0.3, 0.06);
  const lamps = [0, 1, 2, 3].map((k) => { const l = at(lamp(0.026, '#ffb020'), -0.18 + k * 0.12, -0.02, Z0 + 0.02); g.add(l); return l; });
  for (let i = 0; i < 4; i++) {
    const k = button(0.19, 0.32, KEY_COLORS[i].hex, '', { m, op: 'key', i }, { depth: 0.06 });
    at(k, -0.33 + i * 0.22, -0.27, k.position.z); g.add(k);
  }
  return { led, sync(mod) { lamps.forEach((l, k) => l.userData.on(k < mod.done || mod.solved)); } };
}

/* ======================================================================= tuyauterie */
function buildPipes(g, mod, m) {
  const led = plate(g);
  const T = 0.17, ox = 0.0, oy = 0.04;
  const cx = (c) => ox + (c - 1.5) * T, cy = (r) => oy + (1.5 - r) * T;
  const tiles = mod.grid.map((t, k) => {
    const r = Math.floor(k / 4), c = k % 4;
    const tex = canvasTex(128, 128, null);
    const piv = at(new THREE.Group(), cx(c), cy(r), Z0 + 0.02);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(T * 0.94, T * 0.94, 0.03), [std('#444'), std('#444'), std('#444'), std('#444'), new THREE.MeshStandardMaterial({ map: tex.tex, roughness: 0.5, metalness: 0.3 }), std('#444')]);
    mesh.castShadow = true; mesh.receiveShadow = true; piv.add(mesh); g.add(piv);
    mesh.userData.pick = { m, op: 'rot', i: k, kind: 'tile' };
    return { piv, tex, kind: t.k, wet: null, target: 0 };
  });
  const draw = (tile, wet) => {
    if (tile.wet === wet) return; tile.wet = wet;
    tile.tex.redraw((c, w, h) => {
      c.fillStyle = '#3b4048'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
      const col = wet ? '#46b6ff' : '#b9b1a0';
      c.lineCap = 'butt';
      for (const [lw, cc] of [[46, '#16181d'], [34, col]]) {
        c.strokeStyle = cc; c.lineWidth = lw; c.beginPath();
        if (tile.kind === 'I') { c.moveTo(0, h / 2); c.lineTo(w, h / 2); }
        else { c.moveTo(w / 2, 0); c.lineTo(w / 2, h / 2); c.lineTo(w, h / 2); }
        c.stroke();
      }
      c.fillStyle = col; c.fillRect(w / 2 - 17, h / 2 - 17, 34, 34);
    });
  };
  // arrivée (vanne colorée) et sorties numérotées
  const vcol = KEY_COLORS[mod.valve].hex;
  const inY = cy(mod.inlet);
  const pipeMat = std('#9c9486', { metalness: 0.6, roughness: 0.4 });
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), pipeMat); stub.rotation.z = Math.PI / 2; at(stub, cx(0) - T / 2 - 0.04, inY, Z0 + 0.035); g.add(stub);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 10, 24), std(vcol, { roughness: 0.35 }));
  at(wheel, cx(0) - T / 2 - 0.08, inY, Z0 + 0.08); wheel.castShadow = true; g.add(wheel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 10), std(vcol)); hub.rotation.x = Math.PI / 2; at(hub, wheel.position.x, inY, Z0 + 0.05); g.add(hub);
  for (const a of [0, Math.PI / 2]) { const sp = box(0.12, 0.012, 0.012, std(vcol)); sp.rotation.z = a; at(sp, wheel.position.x, inY, Z0 + 0.08); g.add(sp); }
  wheel.userData.pick = hub.userData.pick = { m, op: 'open', kind: 'valve' };
  engraved(g, 'OUVRIR', cx(0) - T / 2 - 0.04, cy(3) - T / 2 - 0.07, 0.24, 0.06);
  for (let r = 0; r < 4; r++) {
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), pipeMat); s2.rotation.z = Math.PI / 2; at(s2, cx(3) + T / 2 + 0.02, cy(r), Z0 + 0.03); g.add(s2);
    const lab = canvasTex(128, 96, (c, w, h) => { c.fillStyle = '#f3e9d2'; c.font = `56px ${BUNG}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(OUTLETS[r], w / 2, h / 2 + 3); });
    g.add(at(decal(0.1, 0.075, lab.tex), cx(3) + T / 2 + 0.1, cy(r), Z0 + 0.003));
  }
  return {
    led,
    sync(mod) {
      const flow = new Set(pipeFlow(mod).cells);
      mod.grid.forEach((t, k) => { tiles[k].target = -t.rot * Math.PI / 2; draw(tiles[k], flow.has(k) || mod.solved); });
      // un quart de tour à la fois, toujours dans le sens des aiguilles d'une montre
      const TAU = Math.PI * 2;
      for (const tl of tiles) {
        if (tl.goal === undefined) { tl.goal = tl.target; tl.piv.rotation.z = tl.target; continue; }
        let d = (((tl.target - tl.goal) % TAU) + TAU) % TAU;
        if (d > 0.01) tl.goal += d - TAU;
      }
    },
    tick(dt) { for (const tl of tiles) if (tl.goal !== undefined) tl.piv.rotation.z += (tl.goal - tl.piv.rotation.z) * Math.min(1, dt * 16); },
  };
}

/* ======================================================================= manomètres */
function buildGauges(g, mod, m) {
  const led = plate(g);
  const lcds = [];
  mod.g.forEach((gg, i) => {
    const x = (i - 1) * 0.3;
    const col = GAUGE_COLORS[gg.c].hex;
    const face = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#f7f3ea'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill();
      c.strokeStyle = col; c.lineWidth = 26; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 22, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
      c.fillStyle = '#16181d'; c.font = `600 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let k = 0; k < 10; k++) { const a = Math.PI * 0.75 + k / 9 * Math.PI * 1.5; c.fillText(String(k), w / 2 + Math.cos(a) * 76, h / 2 + Math.sin(a) * 76); }
    });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.02, 10, 36), std(col, { metalness: 0.4, roughness: 0.35 }));
    at(rim, x, 0.2, Z0 + 0.025); rim.castShadow = true; g.add(rim);
    g.add(at(decal(0.27, 0.27, face.tex), x, 0.2, Z0 + 0.012));
    const needle = new THREE.Group(); at(needle, x, 0.2, Z0 + 0.03);
    const nm = box(0.012, 0.11, 0.008, std('#c8102e')); nm.position.y = 0.045; needle.add(nm);
    needle.rotation.z = -(-Math.PI * 0.75 + gg.v / 9 * Math.PI * 1.5);
    g.add(needle);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), std('#16181d')); cap.rotation.x = Math.PI / 2; at(cap, x, 0.2, Z0 + 0.035); g.add(cap);
    const up = button(0.13, 0.065, '#f3e9d2', triV(true), { m, op: 'knob', i, d: 1 }); at(up, x, 0.0, up.position.z); g.add(up);
    const lcdBox = box(0.13, 0.1, 0.04, std('#0b0b0b')); at(lcdBox, x, -0.1, Z0 + 0.02); g.add(lcdBox);
    const lt = canvasTex(128, 96, null);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.08), new THREE.MeshBasicMaterial({ map: lt.tex, toneMapped: false })); at(screen, x, -0.1, Z0 + 0.042); g.add(screen);
    const dn = button(0.13, 0.065, '#f3e9d2', triV(false), { m, op: 'knob', i, d: -1 }); at(dn, x, -0.2, dn.position.z); g.add(dn);
    lcds.push({ lt, shown: -1 });
  });
  const ok = button(0.42, 0.1, '#ff4b2b', 'PURGER', { m, op: 'submit' }, { fg: '#fff', size: 40 });
  at(ok, 0, -0.38, ok.position.z); g.add(ok);
  return {
    led,
    sync(mod) {
      mod.g.forEach((gg, i) => {
        const L = lcds[i]; if (L.shown === gg.set) return; L.shown = gg.set;
        L.lt.redraw((c, w, h) => { c.fillStyle = '#0d1f14'; c.fillRect(0, 0, w, h); c.fillStyle = '#7dffb0'; c.shadowColor = '#7dffb0'; c.shadowBlur = 10; c.font = `72px ${BUNG}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(gg.set), w / 2, h / 2 + 4); });
      });
    },
  };
}

const BUILDERS = { wires: buildWires, safe: buildSafe, switches: buildSwitches, chime: buildChime, pipes: buildPipes, gauges: buildGauges };

/* ======================================================================= boîtier */
function slotFrame(slot) {
  const back = slot >= 6, k = slot % 6, col = k % 3, row = Math.floor(k / 3);
  return { x: (col - 1) * PITCH * (back ? -1 : 1), y: (0.5 - row) * PITCH, z: (back ? -1 : 1) * (CASE.d / 2), ry: back ? Math.PI : 0 };
}

function stampTex(city, ink) {
  const col = ink === 'rouge' ? '#c8102e' : '#1f4fbf';
  return canvasTex(256, 256, (c, w, h) => {
    c.translate(w / 2, h / 2); c.rotate((Math.random() - 0.5) * 0.6); c.translate(-w / 2, -h / 2);
    c.strokeStyle = col; c.fillStyle = col; c.globalAlpha = 0.85;
    c.lineWidth = 10; c.beginPath(); c.arc(w / 2, h / 2, 108, 0, 7); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.arc(w / 2, h / 2, 88, 0, 7); c.stroke();
    c.font = `${city.length > 6 ? 34 : 44}px ${BUNG}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(city, w / 2, h / 2 + 2);
    c.font = `600 18px ${FONT}`; c.fillText('CONTRÔLÉ', w / 2, h / 2 - 50); c.fillText('★ ★ ★', w / 2, h / 2 + 50);
    c.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 900; k++) { c.globalAlpha = Math.random() * 0.6; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  });
}

export function buildBomb(bomb, { edition, maxStrikes }) {
  const root = new THREE.Group();
  const { w, h, d } = CASE;
  const shell = std('#59654a', { roughness: 0.7, metalness: 0.35 });
  const body = box(w, h, d, shell); root.add(body);
  // cadres en relief autour des faces et coins en caoutchouc
  const rubber = std('#17181a', { roughness: 0.9, metalness: 0 });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) root.add(at(box(0.24, 0.24, 0.24, rubber), sx * (w / 2 - 0.08), sy * (h / 2 - 0.08), sz * (d / 2 - 0.08)));
  const rail = std('#4a5440', { roughness: 0.6, metalness: 0.45 });
  for (const sz of [-1, 1]) {
    for (const sy of [-1, 1]) root.add(at(box(w - 0.3, 0.07, 0.06, rail), 0, sy * (h / 2 - 0.035), sz * (d / 2 + 0.01)));
    for (const sx of [-1, 1]) root.add(at(box(0.07, h - 0.3, 0.06, rail), sx * (w / 2 - 0.035), 0, sz * (d / 2 + 0.01)));
  }
  // poignée
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 12, 30, Math.PI), rubber);
  at(handle, 0, h / 2 + 0.02, 0); handle.castShadow = true; root.add(handle);
  for (const sx of [-1, 1]) root.add(at(box(0.16, 0.08, 0.22, rail), sx * 0.42, h / 2 + 0.03, 0));

  // étiquette de lot (flanc gauche)
  const lot = canvasTex(512, 256, (c, cw, ch) => {
    c.fillStyle = '#f7f3ea'; roundRect(c, 4, 4, cw - 8, ch - 8, 18); c.fill();
    c.fillStyle = '#16181d'; c.font = `600 30px ${FONT}`; c.fillText('N° DE LOT', 28, 52);
    c.font = `72px ${BUNG}`; c.fillText(bomb.lot, 28, 138);
    for (let x = 28; x < cw - 28; x += 6) { const bw = 1 + ((x * 7 + bomb.lot.charCodeAt((x / 6) % 7 | 0)) % 4); c.fillRect(x, 170, bw, 56); }
  });
  const lotMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: lot.tex, roughness: 0.85 }));
  lotMesh.rotation.y = -Math.PI / 2; at(lotMesh, -w / 2 - 0.003, 0.15, 0); root.add(lotMesh);
  // tampons : flanc droit, dessus, dessous
  const places = [
    { p: [w / 2 + 0.003, 0, 0], r: [0, Math.PI / 2, 0] },
    { p: [0.7, h / 2 + 0.003, 0], r: [-Math.PI / 2, 0, 0] },
    { p: [-0.5, -h / 2 - 0.003, 0], r: [Math.PI / 2, 0, 0] },
  ];
  bomb.stamps.forEach((s, k) => {
    const t = stampTex(s.city, s.ink);
    const me = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: t.tex, transparent: true, roughness: 0.9 }));
    me.position.set(...places[k].p); me.rotation.set(...places[k].r); root.add(me);
  });
  // autocollant décoratif (ne compte pas)
  const warn = canvasTex(512, 160, (c, cw, ch) => { c.fillStyle = '#ffc531'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#16181d'; for (let x = -ch; x < cw; x += 48) { c.beginPath(); c.moveTo(x, ch); c.lineTo(x + 24, ch); c.lineTo(x + 24 + ch * 0.4, 0); c.lineTo(x + ch * 0.4, 0); c.fill(); } c.fillStyle = '#ffc531'; c.fillRect(30, 40, cw - 60, ch - 80); c.fillStyle = '#16181d'; c.font = `40px ${BUNG}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('NE PAS SECOUER', cw / 2, ch / 2 + 2); });
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), new THREE.MeshStandardMaterial({ map: warn.tex, roughness: 0.8 }));
  wm.rotation.y = -Math.PI / 2; at(wm, -w / 2 - 0.003, -0.42, 0); root.add(wm);

  // vis de la face avant (certaines manquent)
  const order = [0, 1, 2, 3].sort((a, b) => ((bomb.lot.charCodeAt(a) * 31) % 7) - ((bomb.lot.charCodeAt(b) * 31) % 7));
  const missing = new Set(order.slice(0, bomb.screwsMissing));
  const screwM = std('#b8b8b8', { metalness: 0.95, roughness: 0.25 });
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy], k) => {
    for (const sz of [1, -1]) {
      const pos = [sx * (w / 2 - 0.2), sy * (h / 2 - 0.2), sz * (d / 2 + 0.002)];
      if (sz === 1 && missing.has(k)) {
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: '#050505' }));
        hole.position.set(...pos); root.add(hole);
      } else {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16), screwM);
        s.rotation.x = Math.PI / 2; s.position.set(...pos); if (sz === -1) s.rotation.x = -Math.PI / 2; root.add(s);
        const slotM = box(0.06, 0.012, 0.01, std('#333')); slotM.rotation.z = k; slotM.position.set(pos[0], pos[1], pos[2] + sz * 0.016); root.add(slotM);
      }
    }
  });

  // emplacements : modules, chrono, caches vides
  const mods = [], pickables = [];
  const used = new Map(bomb.modules.map((mod, m) => [mod.slot, m]));
  let timer = null;
  for (let slot = 0; slot < 12; slot++) {
    const f = slotFrame(slot);
    const g = new THREE.Group(); g.position.set(f.x, f.y, f.z); g.rotation.y = f.ry; root.add(g);
    if (slot === TIMER_SLOT) { timer = buildTimer(g, { edition, maxStrikes }); continue; }
    if (!used.has(slot)) {
      const cover = box(0.98, 0.98, 0.03, std('#4f5a42', { roughness: 0.65, metalness: 0.4 })); cover.position.z = 0.015; g.add(cover);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), screwM); s.rotation.x = Math.PI / 2; at(s, sx * 0.4, sy * 0.4, 0.035); g.add(s); }
      continue;
    }
    const m = used.get(slot);
    const api = BUILDERS[bomb.modules[m].type](g, bomb.modules[m], m);
    g.userData.module = m;
    api.group = g;
    mods[m] = api;
  }
  root.traverse((o) => { if (o.userData.pick) pickables.push(o); if (o.isMesh) o.castShadow = true; });

  return {
    root, mods, pickables, timer,
    sync(team, ms, flash) {
      timer.sync(team, ms, flash);
      team.bomb.modules.forEach((mod, m) => { mods[m].sync(mod); mods[m].led.userData.on(mod.solved, '#3dff7a'); });
    },
    tick(dt) { for (const a of mods) if (a.tick) a.tick(dt); },
    flashStrike(m) {
      const led = mods[m] && mods[m].led; if (!led) return;
      led.userData.on(true, '#ff2020');
      setTimeout(() => led.userData.on(false), 700);
    },
  };
}
