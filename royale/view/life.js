// Island Rush — la vie dans le ciel : des nuages bas en amas cotonneux qui dérivent autour de l'altitude de la
// montgolfière (on les traverse en sautant), et des vols d'oiseaux qui tournent au-dessus de l'île. Vus du ciel, ils
// donnent de la profondeur entre la nacelle et le sol.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { createBillboards } from './fx.js';
import { makeRng } from '../engine/rng.js';

const CLOUDS = 22, PUFFS = 7, FLOCKS = 4, BIRDS = 7;

function cloudTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  // quelques bulles douces, plus blanches en haut, grises en dessous
  const blob = (x, y, r, a) => { const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, `rgba(255,255,255,${a})`); grd.addColorStop(0.6, `rgba(255,255,255,${a * 0.55})`); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); };
  blob(64, 70, 56, 0.75); blob(44, 60, 34, 0.6); blob(84, 58, 36, 0.6); blob(64, 46, 30, 0.55);
  const sh = g.createLinearGradient(0, 40, 0, 120); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(70,80,100,0.28)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = sh; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSkyLife(map, { tint = 0xffffff } = {}) {
  const group = new THREE.Group(), rng = makeRng((map.seed | 0) ^ 0xc10d), C = map.center, R = map.islandR;
  // ---------------------------------------------------------------- nuages : amas de bouffées
  const tex = cloudTexture(), bb = createBillboards(CLOUDS * PUFFS, tex);
  bb.mesh.renderOrder = 2; group.add(bb.mesh);
  const col = new THREE.Color(tint);
  const clouds = Array.from({ length: CLOUDS }, () => {
    const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * R * 1.15;
    return {
      x: C + Math.cos(a) * d, z: C + Math.sin(a) * d, y: rng.range(105, 190), s: rng.range(0.8, 1.5),
      puffs: Array.from({ length: PUFFS }, () => ({ dx: rng.range(-28, 28), dy: rng.range(-5, 7), dz: rng.range(-16, 16), r: rng.range(26, 46), sh: rng.range(0.9, 1) })),
    };
  });
  const wind = { x: 2.2, z: 0.9 };
  // ---------------------------------------------------------------- oiseaux : deux ailes par oiseau, qui battent
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, 0.55, 0.02, -0.05], 3));
  wingGeo.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x2a2a30, side: THREE.DoubleSide, fog: true });
  const wings = [1, -1].map((sd) => { const m = new THREE.InstancedMesh(wingGeo, birdMat, FLOCKS * BIRDS); m.frustumCulled = false; m.userData.sd = sd; group.add(m); return m; });
  const flocks = Array.from({ length: FLOCKS }, () => {
    const a = rng.range(0, Math.PI * 2), d = rng.range(0.15, 0.8) * R, cx = C + Math.cos(a) * d, cz = C + Math.sin(a) * d;
    return { cx, cz, y: Math.max(0, map.heightAt(cx, cz)) + rng.range(28, 60), r: rng.range(35, 90), w: rng.range(0.12, 0.22) * (rng.next() < 0.5 ? -1 : 1), ph: rng.range(0, 6.28),
      birds: Array.from({ length: BIRDS }, (_, i) => ({ o: new THREE.Vector3(rng.range(-6, 6), rng.range(-2, 2), (i - BIRDS / 2) * 2.2), f: rng.range(0, 6.28), k: rng.range(0.9, 1.15) })) };
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qf = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
  let t = 0;
  return {
    group,
    update(dt, cam) {
      t += dt;
      // nuages : ils dérivent avec le vent et reviennent de l'autre côté de l'île
      let n = 0;
      for (const c of clouds) {
        c.x += wind.x * dt; c.z += wind.z * dt;
        if (c.x - C > R * 1.3) c.x -= R * 2.6;
        if (c.z - C > R * 1.3) c.z -= R * 2.6;
        const near = Math.hypot(c.x - cam.x, c.y - cam.y, c.z - cam.z);
        // tout près (on passe dedans), le nuage s'efface pour ne pas boucher la vue
        const fade = Math.min(1, Math.max(0, (near - 25) / 60));
        for (const f of c.puffs) bb.set(n++, c.x + f.dx * c.s, c.y + f.dy * c.s, c.z + f.dz * c.s, f.r * c.s, col.r * f.sh, col.g * f.sh, col.b * f.sh, 0.85 * fade);
      }
      bb.count(n);
      // oiseaux : chaque vol tourne autour de son centre, en battant des ailes
      let b = 0;
      for (const F of flocks) {
        const a = F.ph + t * F.w, hx = Math.cos(a), hz = Math.sin(a);
        const fx = -hz * Math.sign(F.w), fz = hx * Math.sign(F.w), yaw = Math.atan2(fx, fz);
        q.setFromAxisAngle(Y, yaw);
        for (const B of F.birds) {
          p.set(B.o.x, B.o.y + Math.sin(t * 0.7 + B.f) * 0.8, B.o.z).applyQuaternion(q);
          p.x += F.cx + hx * F.r; p.z += F.cz + hz * F.r; p.y += F.y;
          const flap = Math.sin(t * 9 * B.k + B.f) * 0.55;
          for (const W of wings) {
            qf.setFromAxisAngle(Z, flap * W.userData.sd).premultiply(q);
            s.set(W.userData.sd, 1, 1).multiplyScalar(1.1);
            W.setMatrixAt(b, m4.compose(p, qf, s));
          }
          b++;
        }
      }
      for (const W of wings) { W.count = b; W.instanceMatrix.needsUpdate = true; }
    },
    dispose() { bb.dispose(); tex.dispose(); wingGeo.dispose(); birdMat.dispose(); },
  };
}
