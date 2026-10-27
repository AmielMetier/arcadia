// Les joueurs à l'écran (le sien, les autres et les bots) avec l'objet qu'ils tiennent, la montgolfière du départ,
// le butin posé au sol (modèle qui tourne, faisceau et halo au sol de la couleur de sa rareté), les coffres et caisses
// de munitions (couvercle qui s'ouvre ; les coffres dorés fermés luisent et scintillent) et les tremplins.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { buildHero, SKINS } from './hero.js';
import { buildSoldier } from './soldier.js';
import { itemModel, lootScale } from './weapons.js';
import { RARITY } from '../engine/items.js';
import { createBillboards } from './fx.js';
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
      h = { hero: kit && kit.soldier ? buildSoldier(kit, { shirt: c, skin: SKINS[v % 5], pants: PANTS[(v >>> 6) % PANTS.length] })
        : buildHero({ shirt: c, skin: v % 5, hair: (v >>> 3) % 5, pants: [0x2f3646, 0x4a3a2a, 0x3a4a3a, 0x2a2a30][(v >>> 6) % 4] }), key: null };
      group.add(h.hero.root);
      heroes.set(P.id, h);
    }
    return h;
  }
  // ------------------------------------------------------------------ montgolfière
  const balloon = new THREE.Group();
  {
    const stripes = [0xe8473a, 0xffd23f, 0xe8473a, 0x3d8fe8, 0xffd23f, 0x3fbf4a];
    for (let i = 0; i < stripes.length; i++) {
      const g = new THREE.SphereGeometry(9, 32, 20, (i / stripes.length) * Math.PI * 2, Math.PI * 2 / stripes.length, 0, Math.PI * 0.78);
      const m = new THREE.MeshStandardMaterial({ color: stripes[i], roughness: 0.6, side: THREE.DoubleSide });
      const o = new THREE.Mesh(g, m); o.scale.set(1, 1.18, 1); o.position.y = 15; o.castShadow = true; balloon.add(o); own.push(g, m);
    }
    const basket = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 5), new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.9 }));
    basket.position.y = 1.1; balloon.add(basket); own.push(basket.geometry, basket.material);
    const rope = new THREE.MeshStandardMaterial({ color: 0x3a2a1a });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const g = new THREE.CylinderGeometry(0.05, 0.05, 8.5, 4); const o = new THREE.Mesh(g, rope);
      o.position.set(sx * 3.2, 6, sz * 3.2); o.rotation.set(sz * 0.2, 0, -sx * 0.2); balloon.add(o); own.push(g);
    }
    own.push(rope);
    balloon.visible = false; group.add(balloon);
  }
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
  const glowTex = canvasTex(64, 64, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,240,200,0.55)'); grd.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
  const LCAP = 256;
  const beamGeo = new THREE.PlaneGeometry(0.8, 1).translate(0, 0.5, 0);
  const beamGeo2 = beamGeo.clone().rotateY(Math.PI / 2);
  const beamMesh = new THREE.InstancedMesh(mergeTwo(beamGeo, beamGeo2), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), LCAP);
  const ringMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), LCAP);
  for (const m of [beamMesh, ringMesh]) {
    m.frustumCulled = false; m.count = 0; m.renderOrder = 3;
    for (let i = 0; i < LCAP; i++) m.setColorAt(i, new THREE.Color(0));
    group.add(m); own.push(m.geometry, m.material);
  }
  own.push(beamGeo, beamGeo2);
  const RCOL = RARITY.map((r) => new THREE.Color(r.color));
  const RGLOW = [0.5, 0.95, 1.15, 1.35];
  // lueur des coffres dorés et étincelles
  const glows = createBillboards(128, glowTex, { additive: true }); glows.mesh.renderOrder = 3; group.add(glows.mesh); own.push(glows);
  const sparks = [];
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
      loot.set(g.id, { g: root, model, ph: (g.id * 0.77) % 6.28, n: it.n, r: Math.min(RARITY.length - 1, it.r || 0), beam: it.t === 'arme' || (it.t === 'objet' && it.r > 0) });
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
  function update(dt, t, cam, pos, hideId) {
    const S = sim.S;
    for (const P of S.players.values()) {
      const h = heroFor(P), a = pos(P), hero = h.hero;
      hero.root.position.set(a.x, a.y, a.z);
      hero.root.rotation.y = a.yaw;
      const it = P.sel > 0 ? P.inv[P.sel - 1] : null, k = P.alive ? keyOf(it) : null;
      if (k !== h.key) {
        h.key = k;
        if (hero.setItem) hero.setItem(P.alive ? it : null, P.alive && it && it.t !== 'arme' ? itemModel(it) : null);
        else hero.setHeld(P.alive ? itemModel(it) : null);
      }
      hero.update(dt, { speed: Math.hypot(P.vx, P.vz), ground: P.ground, swim: P.swim, crouch: P.crouch, sprint: P.sprint, pitch: P.pitch, mode: P.mode, alive: P.alive, held: !!h.key, use: !!P.use, reload: P.rl > 0 });
      hero.root.visible = P.mode !== 'ballon' && P.id !== hideId && (P.alive || hero.root.visible);
    }
    // montgolfière
    if (S.flight) {
      const b = sim.balloonPos(), gone = S.flight.t * S.flight.speed > S.flight.len + 250;
      balloon.visible = !gone;
      balloon.position.set(b.x, b.y - 2, b.z);
      balloon.rotation.y = Math.atan2(S.flight.ux, S.flight.uz);
      if (S.flight.t * S.flight.speed > S.flight.len) {
        // elle s'éloigne après le dernier saut
        const extra = S.flight.t * S.flight.speed - S.flight.len;
        balloon.position.x += S.flight.ux * extra; balloon.position.z += S.flight.uz * extra; balloon.position.y += extra * 0.2;
      }
    }
    // butin : rafraîchi 4 fois par seconde, animé à chaque image
    lootClock += dt;
    if (lootClock > 0.25) { lootClock = 0; syncLoot(cam.x, cam.z); }
    let nb = 0, nr = 0;
    for (const l of loot.values()) {
      l.model.rotation.y = t * 1.2 + l.ph; l.model.position.y = 0.45 + Math.sin(t * 2 + l.ph) * 0.08;
      const p = l.g.position, k = RGLOW[l.r], pulse = 0.85 + 0.15 * Math.sin(t * 3 + l.ph);
      if (nr < LCAP) {
        q.identity(); p3.set(p.x, p.y + 0.04, p.z); s3.setScalar(1.4 + 0.3 * l.r + 0.12 * Math.sin(t * 2.5 + l.ph));
        ringMesh.setMatrixAt(nr, m4.compose(p3, q, s3)); ringMesh.setColorAt(nr, tmpC.copy(RCOL[l.r]).multiplyScalar(k * 1.3 * pulse)); nr++;
      }
      if (l.beam && nb < LCAP) {
        q.setFromAxisAngle(up, t * 0.4 + l.ph); p3.set(p.x, p.y, p.z); s3.set(1, 2.2 + 0.6 * l.r, 1);
        beamMesh.setMatrixAt(nb, m4.compose(p3, q, s3)); beamMesh.setColorAt(nb, tmpC.copy(RCOL[l.r]).multiplyScalar(k * pulse)); nb++;
      }
    }
    beamMesh.count = nb; ringMesh.count = nr;
    for (const m of [beamMesh, ringMesh]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // coffres dorés fermés à portée : lueur qui palpite et étincelles qui montent
    let ng = 0;
    for (const c of S.chests.values()) {
      if (c.kind !== 'coffre' || c.open || Math.abs(c.x - cam.x) > 55 || Math.abs(c.z - cam.z) > 55) continue;
      const ph = (c.id * 1.7) % 6.28, a = 0.55 + 0.25 * Math.sin(t * 3 + ph);
      if (ng < 100) glows.set(ng++, c.x, c.y + 0.75, c.z, 1.9, 1, 0.78, 0.3, a);
      if (Math.random() < dt * 5 && sparks.length < 160) sparks.push({ x: c.x + (Math.random() - 0.5) * 0.9, y: c.y + 0.4 + Math.random() * 0.4, z: c.z + (Math.random() - 0.5) * 0.9, t: 0, life: 0.7 + Math.random() * 0.5 });
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i]; sp.t += dt; sp.y += dt * 0.7;
      if (sp.t >= sp.life) { sparks.splice(i, 1); continue; }
      if (ng < 128) glows.set(ng++, sp.x, sp.y, sp.z, 0.16, 1, 0.9, 0.5, Math.sin(Math.PI * sp.t / sp.life));
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
  return {
    group, update,
    heroOf: (id) => heroes.get(id) && heroes.get(id).hero,
    dispose() {
      for (const h of heroes.values()) h.hero.dispose();
      for (const o of own) o.dispose();
      scene.remove(group);
    },
  };
}
