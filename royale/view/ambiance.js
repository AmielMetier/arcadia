// Island Rush — l'air autour du joueur : poussière et pollen qui flottent (des lucioles le soir), feuilles qui tombent
// des arbres (et en gerbe quand on les frappe), petits oiseaux posés dans l'herbe qui s'envolent quand on approche ou
// qu'on tire, et dans la tempête une pluie violette et des éclairs (on les voit aussi tomber sur le mur de la zone).
// Rien de tout ça ne compte pour la partie : c'est l'affichage de chacun, au hasard.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';
import { createBillboards } from './fx.js';
import { GR } from '../engine/map.js';

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// un moineau : corps brun, ventre clair, tête, bec, queue (couleurs dans les sommets)
function sparrow() {
  const parts = [];
  const add = (geo, hex) => {
    const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    if (g !== geo) geo.dispose();
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g);
  };
  add(new THREE.SphereGeometry(1, 10, 8).scale(0.07, 0.065, 0.12), 0x8c6b4a);
  add(new THREE.SphereGeometry(1, 10, 8).scale(0.058, 0.05, 0.1).translate(0, -0.02, 0.012), 0xd9cbb0);
  add(new THREE.SphereGeometry(0.05, 10, 8).translate(0, 0.055, 0.1), 0x6e5238);
  add(new THREE.ConeGeometry(0.015, 0.045, 6).rotateX(Math.PI / 2).translate(0, 0.05, 0.165), 0xe0a83a);
  add(new THREE.BoxGeometry(0.05, 0.012, 0.11).rotateX(-0.25).translate(0, 0.025, -0.15), 0x5a4430);
  const g = mergeGeometries(parts);
  for (const q of parts) q.dispose();
  return g;
}
const wrap = (v, c, R) => c - R + ((((v - (c - R)) % (2 * R)) + 2 * R) % (2 * R));

// opts : time (moment de la journée), quality ({ ambiance } : 1, ou 0.5 si la machine peine), screen (éclair),
// broken (clé → objet détruit ?), sfx (tonnerre)
export function createAmbiance(scene, map, { time = 'jour', quality = { ambiance: 1 }, screen = null, broken = () => false, sfx = null } = {}) {
  const group = new THREE.Group(); scene.add(group);
  const own = [];
  const night = time === 'soir';

  // ---------------------------------------------------------------- poussière, pollen, lucioles
  const MOTES = 260, MR = 13;
  const dot = dotTexture(); own.push(dot);
  const motes = createBillboards(MOTES, dot, { additive: true }); motes.mesh.renderOrder = 3; group.add(motes.mesh); own.push(motes);
  const mo = Array.from({ length: MOTES }, () => ({ x: Math.random() * 1000, y: Math.random() * 1000, z: Math.random() * 1000,
    vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.3) * 0.12, vz: (Math.random() - 0.5) * 0.25, ph: Math.random() * 6.28, s: 0.025 + Math.random() * 0.035 }));
  const moteCol = night ? [0.75, 1, 0.45] : time === 'crepuscule' ? [1, 0.8, 0.55] : [1, 0.95, 0.8];

  // ---------------------------------------------------------------- feuilles
  const LEAVES = 160;
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, -0.06); leafShape.quadraticCurveTo(0.05, 0, 0, 0.06); leafShape.quadraticCurveTo(-0.05, 0, 0, -0.06);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 3), leafMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, LEAVES); leafMesh.frustumCulled = false; leafMesh.count = 0;
  own.push(leafGeo, leafMat); group.add(leafMesh);
  const LEAF_COLS = [0x5f8f2e, 0x76a23a, 0x8aa83c, 0xc8a83a, 0xd88a2e, 0xb0602a].map((h) => new THREE.Color(h));
  for (let i = 0; i < LEAVES; i++) leafMesh.setColorAt(i, LEAF_COLS[i % LEAF_COLS.length]);
  const lv = [];
  const trees = [];
  for (let i = 0; i < map.props.length; i++) { const p = map.props[i]; if (p.kind === 'arbre') trees.push({ i, x: p.x, z: p.z, s: p.s || 1, y: map.heightAt(p.x, p.z) }); }
  let nearTrees = [], treeScan = 0;
  function leaf(x, y, z, burst = 0) {
    if (lv.length >= LEAVES * quality.ambiance) return;
    const a = Math.random() * 6.28;
    lv.push({ x, y, z, vx: Math.cos(a) * burst, vy: burst ? 1 + Math.random() * burst : -0.3, vz: Math.sin(a) * burst, ph: Math.random() * 6.28, rx: Math.random() * 6, ry: Math.random() * 6, w: 2 + Math.random() * 3,
      g: map.heightAt(x, z), t: 0, rest: 0, c: (Math.random() * LEAF_COLS.length) | 0 });
  }

  // ---------------------------------------------------------------- oiseaux posés
  const FLOCKS = 3, BIRDS = 6, NB = FLOCKS * BIRDS;
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, 0.55, 0.02, -0.05], 3));
  wingGeo.computeVertexNormals();
  const bodyGeo = sparrow();
  const birdMat = new THREE.MeshLambertMaterial({ vertexColors: true }), wingMat = new THREE.MeshLambertMaterial({ color: 0x6b5038, side: THREE.DoubleSide });
  const bodies = new THREE.InstancedMesh(bodyGeo, birdMat, NB); bodies.frustumCulled = false; bodies.count = 0; bodies.castShadow = true; group.add(bodies);
  const wings = [1, -1].map((sd) => { const m = new THREE.InstancedMesh(wingGeo, wingMat, NB); m.frustumCulled = false; m.count = 0; m.userData.sd = sd; group.add(m); return m; });
  own.push(wingGeo, bodyGeo, birdMat, wingMat);
  const flocks = [];
  let flockWait = 2;
  // un coin d'herbe dégagé, à 30–60 m de la caméra
  function spot(cam) {
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * 6.28, d = 30 + Math.random() * 30, x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
      const gr = map.groundAt(x, z);
      if (map.waterAt(x, z) || (gr !== GR.PLAINE && gr !== GR.CHAMP && gr !== GR.LIEU)) continue;
      const y = map.heightAt(x, z);
      if (Math.abs(y - cam.y) > 40) continue;
      return { x, y, z };
    }
    return null;
  }
  function addFlock(cam) {
    const s = spot(cam);
    if (!s) return;
    flocks.push({ ...s, state: 'pose', t: 0, birds: Array.from({ length: 3 + ((Math.random() * (BIRDS - 2)) | 0) }, () => {
      const a = Math.random() * 6.28, d = Math.random() * 2.2, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      return { x, y: map.heightAt(x, z), z, yaw: Math.random() * 6.28, ph: Math.random() * 6.28, vx: 0, vy: 0, vz: 0, k: 0.85 + Math.random() * 0.3, hop: 0 };
    }) });
  }
  function flee(F, fx, fz) {
    if (F.state !== 'pose') return;
    F.state = 'envol'; F.t = 0;
    for (const B of F.birds) {
      let dx = B.x - fx, dz = B.z - fz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const a = (Math.random() - 0.5) * 0.9, c = Math.cos(a), s = Math.sin(a), sp = 6 + Math.random() * 3;
      B.vx = (dx * c - dz * s) * sp; B.vz = (dx * s + dz * c) * sp; B.vy = 4 + Math.random() * 2.5; B.yaw = Math.atan2(B.vx, B.vz); B.delay = Math.random() * 0.25;
    }
  }

  // ---------------------------------------------------------------- tempête : pluie et éclairs
  const DROPS = 700, RR = 16;
  const dropGeo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0));
  const aOff = new Float32Array(DROPS * 3);
  for (let i = 0; i < DROPS; i++) { aOff[i * 3] = Math.random() * 2 * RR; aOff[i * 3 + 1] = Math.random() * 2 * RR; aOff[i * 3 + 2] = Math.random(); }
  dropGeo.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 3)); dropGeo.instanceCount = DROPS;
  const rainU = { uCam: { value: new THREE.Vector3() }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uT: { value: 0 }, uK: { value: 0 } };
  const rainMat = new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aOff; uniform vec3 uCam; uniform vec3 uRight; uniform float uT; uniform float uK; varying float vA;
      void main(){
        float R = ${RR.toFixed(1)};
        vec3 c = vec3(uCam.x - R + mod(aOff.x - (uCam.x - R), 2.0 * R), 0.0, uCam.z - R + mod(aOff.y - (uCam.z - R), 2.0 * R));
        float fall = mod(aOff.z * 24.0 + uT * 26.0, 24.0);
        c.y = uCam.y + 14.0 - fall;
        // vent : la pluie tombe un peu de biais
        c.x += (14.0 - fall) * 0.18;
        vec3 p = c + uRight * position.x * 0.03 + vec3(0.18, 1.0, 0.0) * position.y * 0.95;
        float d = length(c.xz - uCam.xz);
        vA = uK * step(fract(aOff.z * 7.31), uK) * (1.0 - smoothstep(R * 0.7, R, d));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(0.62, 0.55, 0.85) * vA * 0.8, 1.0); }',
  });
  const rain = new THREE.Mesh(dropGeo, rainMat); rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 4; group.add(rain);
  own.push(dropGeo, rainMat);
  // éclair : un ruban brisé du ciel au sol, qui scintille deux ou trois fois
  // couleur au-delà du blanc : le halo du post-traitement la fait rayonner
  const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const bolt = new THREE.Mesh(new THREE.BufferGeometry(), boltMat); bolt.frustumCulled = false; bolt.visible = false; bolt.renderOrder = 6; group.add(bolt);
  own.push(boltMat);
  let boltT = 0, boltWait = 4, rainK = 0;
  function strike(x, z, cam) {
    const gy = Math.max(0, map.heightAt(x, z)), pos = [];
    const seg = (pts, w) => {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        // ruban tourné vers la caméra
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], vx = (a[0] + b[0]) / 2 - cam.x, vy = (a[1] + b[1]) / 2 - cam.y, vz = (a[2] + b[2]) / 2 - cam.z;
        let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx; const l = Math.hypot(sx, sy, sz) || 1; sx *= w / l; sy *= w / l; sz *= w / l;
        pos.push(a[0] - sx, a[1] - sy, a[2] - sz, a[0] + sx, a[1] + sy, a[2] + sz, b[0] + sx, b[1] + sy, b[2] + sz, a[0] - sx, a[1] - sy, a[2] - sz, b[0] + sx, b[1] + sy, b[2] + sz, b[0] - sx, b[1] - sy, b[2] - sz);
      }
    };
    const path = (x0, y0, z0, x1, y1, z1, n, j) => { const p = [[x0, y0, z0]]; for (let i = 1; i < n; i++) { const k = i / n; p.push([x0 + (x1 - x0) * k + (Math.random() - 0.5) * j, y0 + (y1 - y0) * k, z0 + (z1 - z0) * k + (Math.random() - 0.5) * j]); } p.push([x1, y1, z1]); return p; };
    const main = path(x + (Math.random() - 0.5) * 30, gy + 260, z + (Math.random() - 0.5) * 30, x, gy, z, 16, 14);
    seg(main, 0.9);
    for (let b = 0; b < 3; b++) { const o = main[3 + ((Math.random() * 9) | 0)]; seg(path(o[0], o[1], o[2], o[0] + (Math.random() - 0.5) * 50, o[1] - 40 - Math.random() * 50, o[2] + (Math.random() - 0.5) * 50, 6, 8), 0.45); }
    bolt.geometry.dispose();
    bolt.geometry = new THREE.BufferGeometry(); bolt.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bolt.visible = true; boltT = 0;
    const d = Math.hypot(x - cam.x, z - cam.z);
    if (screen) screen.flash = Math.max(screen.flash, Math.max(0.08, 0.8 - d / 400));
    if (sfx && sfx.thunder) sfx.thunder(d);
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qf = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Zx = new THREE.Vector3(0, 0, 1), w3 = new THREE.Vector3();
  let T = 0;
  return {
    group,
    // gerbe de feuilles : un arbre frappé ou abattu
    leaves(x, y, z, n = 8) { for (let i = 0; i < n; i++) leaf(x + (Math.random() - 0.5) * 3, y + Math.random() * 2, z + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 1.5); },
    // un bruit (tir, explosion) en (x, z) : les oiseaux posés à moins de r mètres s'envolent
    scare(x, z, r) { for (const F of flocks) if (Math.hypot(F.x - x, F.z - z) < r) flee(F, x, z); },
    // cam : position de la caméra ; right : sa droite (vecteur) ; storm : cercle sûr { x, z, r } ou null
    update(dt, cam, right, sim, storm) {
      T += dt;
      const high = cam.y - map.heightAt(cam.x, cam.z) > 50;
      // poussière : enroulée autour de la caméra, elle dérive lentement et scintille
      let n = 0;
      const nm = high ? 0 : Math.floor(MOTES * quality.ambiance);
      for (let i = 0; i < nm; i++) {
        const M = mo[i];
        M.x += (M.vx + Math.sin(T * 0.4 + M.ph) * 0.06) * dt; M.y += (M.vy + Math.sin(T * 0.3 + M.ph * 2) * 0.04) * dt; M.z += (M.vz + Math.cos(T * 0.35 + M.ph) * 0.06) * dt;
        const x = wrap(M.x, cam.x, MR), z = wrap(M.z, cam.z, MR), y = wrap(M.y, cam.y + 2, MR * 0.45);
        const d = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
        if (d < 0.8) continue;
        const tw = night ? Math.max(0, Math.sin(T * 2.2 + M.ph * 3)) ** 3 : 0.55 + 0.45 * Math.sin(T * 1.7 + M.ph * 5);
        const a = tw * (1 - Math.min(1, Math.max(0, (d - MR * 0.6) / (MR * 0.4)))) * (night ? 0.9 : 0.45);
        motes.set(n++, x, y, z, night ? M.s * 2.2 : M.s, moteCol[0], moteCol[1], moteCol[2], a);
      }
      motes.count(n);
      // feuilles : quelques arbres proches en lâchent de temps en temps
      if ((treeScan -= dt) <= 0) { treeScan = 0.6; nearTrees = high ? [] : trees.filter((t) => Math.abs(t.x - cam.x) < 34 && Math.abs(t.z - cam.z) < 34 && !broken('p:' + t.i)); }
      for (const t of nearTrees) if (Math.random() < dt * 0.12 * quality.ambiance) leaf(t.x + (Math.random() - 0.5) * 3.5 * t.s, t.y + (4 + Math.random() * 2.5) * t.s, t.z + (Math.random() - 0.5) * 3.5 * t.s);
      for (let i = lv.length - 1; i >= 0; i--) {
        const L = lv[i]; L.t += dt;
        if (L.rest) { L.rest += dt; if (L.rest > 5) lv.splice(i, 1); continue; }
        // elle plane en se balançant, puis se pose
        const dr = Math.exp(-2.5 * dt);
        L.vx *= dr; L.vz *= dr; L.vy = L.vy * dr + (-0.75 - L.vy) * (1 - dr);
        L.x += (L.vx + Math.sin(T * L.w * 0.5 + L.ph) * 0.7) * dt; L.z += (L.vz + Math.cos(T * L.w * 0.4 + L.ph) * 0.5) * dt; L.y += L.vy * dt;
        L.rx += L.w * dt; L.ry += L.w * 0.6 * dt;
        if (L.y <= L.g + 0.02 || L.t > 30) { L.y = L.g + 0.02; L.rest = 0.001; L.rx = Math.PI / 2; }
      }
      for (let i = 0; i < lv.length; i++) {
        const L = lv[i], k = L.rest ? Math.max(0, 1 - Math.max(0, L.rest - 4)) : 1;
        q.setFromEuler(e.set(L.rx, L.ry, 0));
        leafMesh.setMatrixAt(i, m4.compose(p.set(L.x, L.y, L.z), q, s.set(k, k, k)));
        leafMesh.setColorAt(i, LEAF_COLS[L.c]);
      }
      leafMesh.count = lv.length; leafMesh.instanceMatrix.needsUpdate = true; if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
      // oiseaux : une nuée posée de temps en temps, qui s'envole quand quelqu'un approche
      if (!high && flocks.length < FLOCKS && (flockWait -= dt) <= 0) { addFlock(cam); flockWait = 6 + Math.random() * 10; }
      let b = 0;
      for (let f = flocks.length - 1; f >= 0; f--) {
        const F = flocks[f]; F.t += dt;
        if (F.state === 'pose') {
          if (Math.hypot(F.x - cam.x, F.z - cam.z) > 110) { flocks.splice(f, 1); continue; }
          for (const P of sim.S.players.values()) if (P.alive && P.mode !== 'ballon' && Math.hypot(P.x - F.x, P.z - F.z) < 9 && Math.abs(P.y - F.y) < 6) { flee(F, P.x, P.z); break; }
        } else if (F.t > 8) { flocks.splice(f, 1); continue; }
      }
      for (const F of flocks) for (const B of F.birds) {
        if (b >= NB) break;
        let flap = 0, fold = 1;
        if (F.state === 'pose') {
          // ils picorent et sautillent
          B.hop = Math.max(0, B.hop - dt);
          if (B.hop === 0 && Math.random() < dt * 0.4) { B.hop = 0.25; B.yaw += (Math.random() - 0.5) * 1.5; }
          const h = B.hop > 0 ? Math.sin((B.hop / 0.25) * Math.PI) * 0.08 : 0;
          if (B.hop > 0) { B.x += Math.sin(B.yaw) * dt * 0.8; B.z += Math.cos(B.yaw) * dt * 0.8; }
          p.set(B.x, B.y + 0.06 + h, B.z);
          q.setFromAxisAngle(Y, B.yaw).multiply(qf.setFromAxisAngle(X, Math.max(0, Math.sin(T * 3 * B.k + B.ph)) * 0.6));
          fold = 0.45;
        } else {
          if (B.delay > 0) { B.delay -= dt; p.set(B.x, B.y + 0.07, B.z); }
          else {
            B.vy -= 1.2 * dt; B.x += B.vx * dt; B.y += B.vy * dt; B.z += B.vz * dt;
            p.set(B.x, B.y + 0.07, B.z);
            flap = Math.sin(T * 22 * B.k + B.ph) * 0.9;
          }
          q.setFromAxisAngle(Y, B.yaw).multiply(qf.setFromAxisAngle(X, -0.35));
        }
        bodies.setMatrixAt(b, m4.compose(p, q, s.set(B.k, B.k, B.k)));
        // ailes : repliées le long du corps au sol, qui battent en vol
        for (const W of wings) {
          qf.setFromAxisAngle(Zx, (flap - (fold < 1 ? 1.2 : 0)) * W.userData.sd).premultiply(q);
          w3.set(W.userData.sd * 0.05, 0.03, 0).applyQuaternion(q);
          W.setMatrixAt(b, m4.compose(w3.add(p), qf, s.set(W.userData.sd * 0.32 * fold * B.k, 0.32 * B.k, 0.32 * B.k)));
        }
        b++;
      }
      bodies.count = b; bodies.instanceMatrix.needsUpdate = true;
      for (const W of wings) { W.count = b; W.instanceMatrix.needsUpdate = true; }
      // tempête : pluie quand on est dedans (un peu déjà près du mur), éclairs sur le mur ou autour de soi
      const out = storm ? Math.hypot(cam.x - storm.x, cam.z - storm.z) - storm.r : -1e9;
      const want = storm ? Math.max(0, Math.min(1, (out + 12) / 24)) : 0;
      rainK += (want - rainK) * (1 - Math.exp(-1.5 * dt));
      rain.visible = rainK > 0.02;
      if (rain.visible) { rainU.uCam.value.set(cam.x, cam.y, cam.z); rainU.uRight.value.copy(right); rainU.uT.value = T; rainU.uK.value = rainK * (quality.ambiance < 1 ? 0.6 : 1); }
      if (bolt.visible) {
        boltT += dt;
        boltMat.opacity = boltT < 0.3 ? (Math.sin(boltT * 60) > -0.2 ? 1 : 0.15) * (1 - boltT / 0.35) : 0;
        if (boltT > 0.35) bolt.visible = false;
      }
      if (storm && storm.r > 1 && (boltWait -= dt) <= 0) {
        boltWait = out > 0 ? 2 + Math.random() * 3 : 4 + Math.random() * 6;
        let x, z;
        if (out > 0) { const a = Math.random() * 6.28, d = 60 + Math.random() * 160; x = cam.x + Math.cos(a) * d; z = cam.z + Math.sin(a) * d; }
        else {
          // sur le mur de la tempête, du côté où l'on regarde à peu près
          const a0 = Math.atan2(cam.z - storm.z, cam.x - storm.x), a = a0 + (Math.random() - 0.5) * 1.6, r = storm.r + 10 + Math.random() * 60;
          x = storm.x + Math.cos(a) * r; z = storm.z + Math.sin(a) * r;
        }
        if (Math.hypot(x - cam.x, z - cam.z) < 900) strike(x, z, cam);
      }
    },
    dispose() { for (const o of own) o.dispose(); bolt.geometry.dispose(); scene.remove(group); },
  };
}
