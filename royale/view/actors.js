// Les joueurs à l'écran (le sien, les autres et les bots) avec l'objet qu'ils tiennent, la montgolfière du départ,
// le butin posé au sol (modèle qui tourne, faisceau et halo au sol de la couleur de sa rareté), les coffres et caisses
// de munitions (couvercle qui s'ouvre ; les coffres dorés fermés luisent et scintillent) et les tremplins.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { buildHero, SKINS } from './hero.js';
import { buildSoldier } from './soldier.js';
import { itemModel, lootScale } from './weapons.js';
import { RARITY } from '../engine/items.js';
import { createBillboards } from './fx.js';
import { buildBalloon } from './balloon.js';
import { hash } from '../engine/rng.js';

const keyOf = (it) => (it ? it.t + (it.w || it.c || it.a || it.m || '') + (it.r ?? '') : 'pioche');
const LOOT_R = 65;

const PANTS = [0x3a3f4a, 0x4a3a2a, 0x3d4a3a, 0x2a2a30, 0x5a4a3a, 0x4a4f5a];
// deux géométries de même forme en une (plans croisés du faisceau)
function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry(), A = a.toNonIndexed(), B = b.toNonIndexed();
  for (const k of ['position', 'uv']) {
    const x = A.attributes[k], y = B.attributes[k], arr = new Float32Array(x.array.length + y.array.length);
    arr.set(x.array); arr.set(y.array, x.array.length);
    g.setAttribute(k, new THREE.BufferAttribute(arr, x.itemSize));
  }
  A.dispose(); B.dispose();
  return g;
}
export function createActors(scene, sim, kit = null) {
  const group = new THREE.Group(); scene.add(group);
  const own = [];
  // ------------------------------------------------------------------ joueurs
  const heroes = new Map();
  function heroFor(P) {
    let h = heroes.get(P.id);
    if (!h) {
      const c = parseInt(String(P.color || '#ff4b2b').replace('#', ''), 16);
      const v = hash(String(P.id).split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7)) >>> 0;
      h = { hero: kit && kit.soldier ? buildSoldier(kit, { shirt: c, skin: SKINS[v % 5], pants: PANTS[(v >>> 6) % PANTS.length], look: P.look || 'soldat' })
        : buildHero({ shirt: c, skin: v % 5, hair: (v >>> 3) % 5, pants: [0x2f3646, 0x4a3a2a, 0x3a4a3a, 0x2a2a30][(v >>> 6) % 4] }), key: null, tick: v & 3, acc: 0 };
      group.add(h.hero.root);
      heroes.set(P.id, h);
    }
    return h;
  }
  // ------------------------------------------------------------------ montgolfière (view/balloon.js)
  const bal = buildBalloon(), balloon = bal.group;
  balloon.visible = false; group.add(balloon); own.push(bal);
  // ------------------------------------------------------------------ butin au sol
  const loot = new Map(); // id d'objet → { g, model, ph, n, r, beam }
  // faisceau (deux plans croisés, lumineux en bas, qui s'efface en haut) et halo au sol, à la couleur de la rareté
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; own.push(t); return t; };
  const beamTex = canvasTex(64, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w - 0.5, v = 1 - (j + 0.5) / h, a = Math.exp(-u * u * 40) * Math.pow(1 - v, 1.6) * (0.55 + 0.45 * Math.exp(-u * u * 400));
      const o = (j * w + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.round(255 * Math.min(1, a));
    }
    g.putImageData(img, 0, 0);
  });
  const ringTex = canvasTex(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.35)'); grd.addColorStop(0.72, 'rgba(255,255,255,0.8)'); grd.addColorStop(0.8, 'rgba(255,255,255,0.25)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
  // socle : un hexagone net qui tourne lentement sous l'objet, cerclé d'un trait clair
  const padTex = canvasTex(128, 128, (g, w) => {
    const c = w / 2, hex = (r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); };
    hex(w * 0.46); g.fillStyle = 'rgba(255,255,255,0.16)'; g.fill();
    g.lineWidth = w * 0.035; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.stroke();
    hex(w * 0.36); g.lineWidth = w * 0.012; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
  });
  const glowTex = canvasTex(64, 64, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,240,200,0.55)'); grd.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
  // coffres : halo doré creux (le coffre cache le milieu, la lumière déborde de sa silhouette) et lueur dorée au sol
  const haloTex = canvasTex(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,214,110,0.05)'); grd.addColorStop(0.32, 'rgba(255,208,96,0.22)'); grd.addColorStop(0.46, 'rgba(255,196,70,0.85)');
    grd.addColorStop(0.62, 'rgba(255,172,40,0.32)'); grd.addColorStop(0.82, 'rgba(240,140,20,0.08)'); grd.addColorStop(1, 'rgba(240,140,20,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
  const floorTex = canvasTex(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,200,90,0.5)'); grd.addColorStop(0.55, 'rgba(255,184,64,0.32)'); grd.addColorStop(0.7, 'rgba(255,206,110,0.7)');
    grd.addColorStop(0.78, 'rgba(255,170,40,0.18)'); grd.addColorStop(1, 'rgba(255,150,20,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
  const LCAP = 256;
  const beamGeo = new THREE.PlaneGeometry(0.8, 1).translate(0, 0.5, 0);
  const beamGeo2 = beamGeo.clone().rotateY(Math.PI / 2);
  const beamMesh = new THREE.InstancedMesh(mergeTwo(beamGeo, beamGeo2), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), LCAP);
  const ringMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), LCAP);
  const padMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: padTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), LCAP);
  for (const m of [beamMesh, ringMesh, padMesh]) {
    m.frustumCulled = false; m.count = 0; m.renderOrder = 3;
    for (let i = 0; i < LCAP; i++) m.setColorAt(i, new THREE.Color(0));
    group.add(m); own.push(m.geometry, m.material);
  }
  own.push(beamGeo, beamGeo2);
  const RCOL = RARITY.map((r) => new THREE.Color(r.color));
  const RGLOW = [0.5, 0.95, 1.15, 1.35];
  // lueur des coffres dorés et étincelles ; poussière lumineuse qui monte autour du butin rare
  const glows = createBillboards(128, glowTex, { additive: true }); glows.mesh.renderOrder = 3; group.add(glows.mesh); own.push(glows);
  const halos = createBillboards(100, haloTex, { additive: true }); halos.mesh.renderOrder = 3; group.add(halos.mesh); own.push(halos);
  const chestFloor = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 100);
  chestFloor.frustumCulled = false; chestFloor.count = 0; chestFloor.renderOrder = 3; group.add(chestFloor); own.push(chestFloor.geometry, chestFloor.material);
  for (let i = 0; i < 100; i++) chestFloor.setColorAt(i, new THREE.Color(0));
  const motes = createBillboards(220, glowTex, { additive: true }); motes.mesh.renderOrder = 3; group.add(motes.mesh); own.push(motes);
  const sparks = [], dust = [];
  let lootClock = 0;
  function syncLoot(cx, cz) {
    const S = sim.S;
    for (const [id, l] of loot) {
      const g = S.items.get(id);
      if (!g || Math.hypot(g.x - cx, g.z - cz) > LOOT_R + 10) { group.remove(l.g); loot.delete(id); }
      else if (g.it.n !== l.n) l.n = g.it.n;
    }
    for (const g of S.items.values()) {
      if (loot.has(g.id) || Math.hypot(g.x - cx, g.z - cz) > LOOT_R) continue;
      const it = g.it, root = new THREE.Group(), model = itemModel(it);
      model.scale.setScalar(lootScale(model, it));
      root.add(model);
      root.position.set(g.x, g.y, g.z);
      group.add(root);
      loot.set(g.id, { g: root, model, ph: (g.id * 0.77) % 6.28, n: it.n, r: Math.min(RARITY.length - 1, it.r || 0), beam: it.t === 'arme' || (it.t === 'objet' && it.r > 0), weapon: it.t === 'arme' });
    }
  }
  // ------------------------------------------------------------------ coffres et caisses de munitions (instanciés)
  const chests = [...sim.S.chests.values()];
  const cGeo = {
    base: new THREE.BoxGeometry(1.0, 0.55, 0.62).translate(0, 0.275, 0),
    lid: new THREE.BoxGeometry(1.02, 0.22, 0.64).translate(0, 0.11, 0.32),
    trim: new THREE.BoxGeometry(1.04, 0.07, 0.66).translate(0, 0.52, 0),
  };
  own.push(...Object.values(cGeo));
  const cMat = {
    wood: new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.8 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xffc531, roughness: 0.3, metalness: 0.6, emissive: 0x6a4a00 }),
    green: new THREE.MeshStandardMaterial({ color: 0x4f6a3a, roughness: 0.7 }),
  };
  own.push(...Object.values(cMat));
  const kinds = { coffre: chests.filter((c) => c.kind === 'coffre'), munitions: chests.filter((c) => c.kind === 'munitions') };
  const im = {};
  for (const [kind, list] of Object.entries(kinds)) {
    const n = Math.max(1, list.length);
    im[kind] = {
      base: new THREE.InstancedMesh(cGeo.base, kind === 'coffre' ? cMat.wood : cMat.green, n),
      lid: new THREE.InstancedMesh(cGeo.lid, kind === 'coffre' ? cMat.gold : cMat.green, n),
      trim: new THREE.InstancedMesh(cGeo.trim, cMat.gold, n),
      list,
    };
    for (const m of Object.values(im[kind])) if (m.isInstancedMesh) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qx = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), ax = new THREE.Vector3(1, 0, 0);
  const tmpC = new THREE.Color();
  const lidOpen = new Map();
  function placeChest(kind, i, c, open) {
    const M = im[kind], yaw = Math.atan2(c.fx || 0, c.fz || 1), sc = kind === 'coffre' ? 1 : 0.75;
    q.setFromAxisAngle(up, yaw); p3.set(c.x, c.y + 0.15, c.z); s3.set(sc, sc, sc);
    m4.compose(p3, q, s3); M.base.setMatrixAt(i, m4); M.trim.setMatrixAt(i, m4);
    // couvercle : charnière à l'arrière (z = −0,31)
    const back = new THREE.Vector3(0, 0.55 * sc, -0.31 * sc).applyQuaternion(q);
    qx.setFromAxisAngle(ax, -open * 1.9);
    const ql = q.clone().multiply(qx);
    p3.set(c.x + back.x, c.y + 0.15 + back.y, c.z + back.z);
    m4.compose(p3, ql, s3); M.lid.setMatrixAt(i, m4);
    for (const m of [M.base, M.lid, M.trim]) m.instanceMatrix.needsUpdate = true;
  }
  for (const [kind, M] of Object.entries(im)) M.list.forEach((c, i) => { placeChest(kind, i, c, 0); lidOpen.set(c.id, { kind, i, t: 0 }); });
  for (const M of Object.values(im)) for (const m of [M.base, M.lid, M.trim]) m.computeBoundingSphere();
  // ------------------------------------------------------------------ tremplins
  const padGeo = new THREE.CylinderGeometry(0.9, 1.0, 0.2, 20).translate(0, 0.1, 0), padMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.4, emissive: 0x3a2a00 });
  const arrowGeo = new THREE.ConeGeometry(0.45, 0.5, 3).translate(0, 0.45, 0), arrowMat = new THREE.MeshStandardMaterial({ color: 0xd8432f });
  own.push(padGeo, padMat, arrowGeo, arrowMat);
  const pads = new Map();

  // ------------------------------------------------------------------ chaque image
  // pos(P) : position affichée d'un joueur (interpolée par l'appli)
  // see(x, y, z) : vrai si rien ne cache ce point (un mur, un plancher) ; les lueurs ne se voient pas à travers
  const chestSeen = new Map();
  function update(dt, t, cam, pos, hideId, see = null) {
    const S = sim.S;
    for (const P of S.players.values()) {
      const h = heroFor(P), a = pos(P), hero = h.hero;
      hero.root.position.set(a.x, a.y, a.z);
      hero.root.rotation.y = a.yaw;
      // à terre : plus rien en main
      const it = P.sel > 0 && !P.down ? P.inv[P.sel - 1] : null, k = P.alive ? keyOf(it) : null;
      if (k !== h.key) {
        h.key = k;
        if (hero.setItem) hero.setItem(P.alive ? it : null, P.alive && it && it.t !== 'arme' ? itemModel(it) : null);
        else hero.setHeld(P.alive ? itemModel(it) : null);
      }
      hero.root.visible = P.mode !== 'ballon' && P.id !== hideId && (P.alive || hero.root.visible);
      // animation : à chaque image de près, une sur deux au-delà de 50 m, une sur quatre au-delà de 120 m (60 joueurs)
      const far = Math.hypot(a.x - cam.x, a.z - cam.z), every = far < 50 ? 1 : far < 120 ? 2 : 4;
      // l'ombre du soleil ne couvre que les environs : les personnages lointains n'en projettent pas
      if (h.shadow !== far < 70) { h.shadow = far < 70; hero.root.traverse((o) => { if (o.isMesh) o.castShadow = h.shadow; }); }
      // (caché, dans la montgolfière : le temps ne s'accumule pas, sinon la première image en chute sauterait la culbute)
      h.acc = hero.root.visible ? h.acc + dt : 0;
      if (!hero.root.visible || ++h.tick % every) continue;
      hero.update(h.acc, { speed: Math.hypot(P.vx, P.vz), vx: P.vx, vz: P.vz, ground: P.ground, swim: P.swim, crouch: P.crouch, sprint: P.sprint, pitch: P.pitch, mode: P.mode, alive: P.alive, down: !!P.down, held: !!h.key, use: !!P.use, reload: P.rl > 0, far });
      h.acc = 0;
    }
    // montgolfière
    if (S.flight) {
      const b = sim.balloonPos(), gone = S.flight.t * S.flight.speed > S.flight.len + 250;
      balloon.visible = !gone;
      balloon.position.set(b.x, b.y - 2, b.z);
      balloon.rotation.y = Math.atan2(S.flight.ux, S.flight.uz);
      if (!gone) bal.update(dt, (sec) => api.onBurn && api.onBurn(balloon.position, sec));
      if (S.flight.t * S.flight.speed > S.flight.len) {
        // elle s'éloigne après le dernier saut
        const extra = S.flight.t * S.flight.speed - S.flight.len;
        balloon.position.x += S.flight.ux * extra; balloon.position.z += S.flight.uz * extra; balloon.position.y += extra * 0.2;
      }
    }
    // butin : rafraîchi 4 fois par seconde, animé à chaque image
    lootClock += dt;
    if (lootClock > 0.25) {
      lootClock = 0; syncLoot(cam.x, cam.z);
      for (const l of loot.values()) { const p = l.g.position; l.vis = !see || see(p.x, p.y + 0.5, p.z); }
      chestSeen.clear();
      if (see) for (const c of S.chests.values()) if (c.kind === 'coffre' && !c.open && Math.abs(c.x - cam.x) < 55 && Math.abs(c.z - cam.z) < 55) chestSeen.set(c.id, see(c.x, c.y + 0.6, c.z));
    }
    let nb = 0, nr = 0;
    for (const l of loot.values()) {
      // l'objet flotte en tournant, un peu penché
      l.model.rotation.set(0, t * 1.1 + l.ph, l.weapon ? 0.18 : 0); l.model.position.y = 0.55 + Math.sin(t * 2 + l.ph) * 0.09;
      const p = l.g.position, k = RGLOW[l.r], pulse = 0.85 + 0.15 * Math.sin(t * 3 + l.ph);
      if (l.vis === false) continue;
      if (nr < LCAP) {
        q.identity(); p3.set(p.x, p.y + 0.04, p.z); s3.setScalar(1.4 + 0.3 * l.r + 0.12 * Math.sin(t * 2.5 + l.ph));
        ringMesh.setMatrixAt(nr, m4.compose(p3, q, s3)); ringMesh.setColorAt(nr, tmpC.copy(RCOL[l.r]).multiplyScalar(k * 1.3 * pulse));
        q.setFromAxisAngle(up, t * 0.5 + l.ph); p3.set(p.x, p.y + 0.06, p.z); s3.setScalar(1.05 + 0.12 * l.r);
        padMesh.setMatrixAt(nr, m4.compose(p3, q, s3)); padMesh.setColorAt(nr, tmpC.copy(RCOL[l.r]).multiplyScalar(k * (0.9 + 0.2 * pulse)));
        nr++;
      }
      // poussière lumineuse : plus il est rare, plus il en monte (seulement près de soi)
      if (l.r > 0 && dust.length < 200 && Math.abs(p.x - cam.x) < 30 && Math.abs(p.z - cam.z) < 30 && Math.random() < dt * l.r * 1.6) {
        const a = Math.random() * Math.PI * 2, rr = 0.25 + Math.random() * 0.35;
        dust.push({ x: p.x + Math.cos(a) * rr, y: p.y + 0.1, z: p.z + Math.sin(a) * rr, t: 0, life: 1 + Math.random() * 0.6, c: RCOL[l.r] });
      }
      if (l.beam && nb < LCAP) {
        q.setFromAxisAngle(up, t * 0.4 + l.ph); p3.set(p.x, p.y, p.z); s3.set(1, 2.2 + 0.6 * l.r, 1);
        beamMesh.setMatrixAt(nb, m4.compose(p3, q, s3)); beamMesh.setColorAt(nb, tmpC.copy(RCOL[l.r]).multiplyScalar(k * pulse)); nb++;
      }
    }
    beamMesh.count = nb; ringMesh.count = nr; padMesh.count = nr;
    for (const m of [beamMesh, ringMesh, padMesh]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    let nm = 0;
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i]; d.t += dt; d.y += dt * 0.55;
      if (d.t >= d.life) { dust.splice(i, 1); continue; }
      motes.set(nm++, d.x, d.y, d.z, 0.09, d.c.r * 1.4, d.c.g * 1.4, d.c.b * 1.4, Math.sin(Math.PI * d.t / d.life) * 0.9);
    }
    motes.count(nm);
    // coffres dorés fermés à portée : halo doré autour du coffre, lueur au sol qui palpite, paillettes d'or qui montent
    let ng = 0, nh = 0;
    for (const c of S.chests.values()) {
      if (c.kind !== 'coffre' || c.open || Math.abs(c.x - cam.x) > 55 || Math.abs(c.z - cam.z) > 55 || chestSeen.get(c.id) === false) continue;
      // (l'identifiant d'un coffre est « c12 » : sa phase vient du numéro, sinon elle vaut NaN et la lueur devient une tache blanche)
      const ph = ((+c.id.slice(1) || 0) * 1.7) % 6.28, pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + ph);
      if (nh < 100) {
        halos.set(nh, c.x, c.y + 0.5, c.z, 1.9 + 0.12 * pulse, 1, 1, 1, 0.55 + 0.3 * pulse);
        q.setFromAxisAngle(up, t * 0.3 + ph); p3.set(c.x, c.y + 0.17, c.z); s3.setScalar(2.3 + 0.25 * pulse);
        chestFloor.setMatrixAt(nh, m4.compose(p3, q, s3)); chestFloor.setColorAt(nh, tmpC.setRGB(0.55 + 0.35 * pulse, 0.42 + 0.27 * pulse, 0.16 + 0.1 * pulse));
        nh++;
      }
      if (Math.random() < dt * 6 && sparks.length < 160) {
        const a = Math.random() * Math.PI * 2, r = 0.45 + Math.random() * 0.25;
        sparks.push({ x: c.x + Math.cos(a) * r, y: c.y + 0.25 + Math.random() * 0.3, z: c.z + Math.sin(a) * r, t: 0, life: 0.9 + Math.random() * 0.6 });
      }
    }
    halos.count(nh); chestFloor.count = nh;
    chestFloor.instanceMatrix.needsUpdate = true; if (chestFloor.instanceColor) chestFloor.instanceColor.needsUpdate = true;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i]; sp.t += dt; sp.y += dt * 0.6;
      if (sp.t >= sp.life) { sparks.splice(i, 1); continue; }
      if (ng < 128) glows.set(ng++, sp.x, sp.y, sp.z, 0.11, 1, 0.78, 0.3, Math.sin(Math.PI * sp.t / sp.life) * 0.9);
    }
    glows.count(ng);
    // coffres : le couvercle s'ouvre quand le coffre est ouvert ; les coffres fermés luisent doucement
    for (const c of S.chests.values()) {
      const L = lidOpen.get(c.id);
      const want = c.open ? 1 : 0;
      if (L.t !== want) { L.t = Math.min(1, L.t + dt * 3) * want; placeChest(L.kind, L.i, c, L.t); }
    }
    cMat.gold.emissiveIntensity = 0.7 + 0.5 * Math.sin(t * 3);
    // tremplins
    for (const pad of S.pads) if (!pads.has(pad.id)) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(padGeo, padMat)); g.add(new THREE.Mesh(arrowGeo, arrowMat));
      g.position.set(pad.x, pad.y, pad.z); group.add(g); pads.set(pad.id, g);
    }
  }
  const api = {
    group, update, onBurn: null,
    heroOf: (id) => heroes.get(id) && heroes.get(id).hero,
    dispose() {
      for (const h of heroes.values()) h.hero.dispose();
      for (const o of own) o.dispose();
      scene.remove(group);
    },
  };
  return api;
}
