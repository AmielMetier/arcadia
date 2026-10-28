// Island Rush — ce qui fait sentir le mouvement : traînées d'air qui filent le long du joueur en chute libre, en
// deltaplane et sur les tremplins ; éclaboussures et ronds dans l'eau (nage, plongeon, balle qui tombe dans l'eau) ;
// anneau de souffle au sol sous une explosion. Affichage seulement.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const STREAKS = 90, RINGS = 64;

// fx : les effets de la partie (gouttes = éclats, embruns = particules douces) ; world : niveau de l'eau
export function createMotion(scene, world, fx) {
  const group = new THREE.Group(); scene.add(group);
  // ---------------------------------------------------------------- traînées d'air : rubans fins, face à la caméra
  const pos = new Float32Array(STREAKS * 4 * 3), alp = new Float32Array(STREAKS * 4), idx = [];
  for (let i = 0; i < STREAKS; i++) { const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); alp[b + 2] = alp[b + 3] = 0; }
  const sGeo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aAlp = new THREE.BufferAttribute(alp, 1);
  aPos.setUsage(THREE.DynamicDrawUsage); aAlp.setUsage(THREE.DynamicDrawUsage);
  sGeo.setAttribute('position', aPos); sGeo.setAttribute('aA', aAlp); sGeo.setIndex(idx);
  const sMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(0.95, 0.97, 1.0) * vA, 1.0); }',
  });
  const streaks = new THREE.Mesh(sGeo, sMat); streaks.frustumCulled = false; streaks.renderOrder = 4; group.add(streaks);
  const st = Array.from({ length: STREAKS }, () => ({ on: false, x: 0, y: 0, z: 0, len: 2 }));
  const v = new THREE.Vector3(), dv = new THREE.Vector3(), w = new THREE.Vector3(), side = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function spawn(S, cam, dir, speed) {
    // devant, autour de l'axe du mouvement, à distance de la caméra
    side.crossVectors(dir, Math.abs(dir.y) > 0.9 ? w.set(1, 0, 0) : up).normalize();
    b.crossVectors(dir, side).normalize();
    const ang = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 6, ahead = 8 + Math.random() * Math.min(40, speed * 0.9);
    S.x = cam.x + dir.x * ahead + (side.x * Math.cos(ang) + b.x * Math.sin(ang)) * r;
    S.y = cam.y + dir.y * ahead + (side.y * Math.cos(ang) + b.y * Math.sin(ang)) * r;
    S.z = cam.z + dir.z * ahead + (side.z * Math.cos(ang) + b.z * Math.sin(ang)) * r;
    S.len = 1.5 + Math.random() * 3; S.on = true;
  }
  let rush = 0;
  // ---------------------------------------------------------------- ronds : sur l'eau, ou anneau de souffle au sol
  const rGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
  const rMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const rings = new THREE.InstancedMesh(rGeo, rMat, RINGS); rings.frustumCulled = false; rings.renderOrder = 2; group.add(rings);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < RINGS; i++) { rings.setMatrixAt(i, zero); rings.setColorAt(i, col.setRGB(0, 0, 0)); }
  const rl = new Array(RINGS).fill(null);
  let rNext = 0;
  function ring(x, y, z, { r0 = 0.2, r1 = 1.6, life = 1.2, color = 0xdff2ff, alpha = 0.55 } = {}) {
    const i = rNext; rNext = (rNext + 1) % RINGS;
    rl[i] = { x, y, z, r0, r1, life, t: 0, c: new THREE.Color(color), alpha };
  }
  // éclaboussure à la surface de l'eau (force k de 0 à 1)
  function splash(x, y, z, k = 1) {
    const n = Math.round(4 + 12 * k);
    for (let i = 0; i < n; i++) {
      const an = Math.random() * Math.PI * 2, sp = (0.6 + Math.random()) * (1 + 2.2 * k), sz = 0.03 + Math.random() * 0.04;
      fx.chip(x, y + 0.05, z, { vx: Math.cos(an) * sp, vy: 2 + Math.random() * 4.5 * k + 1.5, vz: Math.sin(an) * sp, sx: sz, sy: sz, sz, color: i % 3 ? 0xeaf6ff : 0xbfe4f5, life: 0.7 + Math.random() * 0.4 });
    }
    for (let i = 0; i < 2 + 4 * k; i++) fx.cloud(x + (Math.random() - 0.5) * 0.6, y + 0.2, z + (Math.random() - 0.5) * 0.6, { vx: (Math.random() - 0.5) * 1.5, vy: 1.2 + Math.random() * 1.5 * k, vz: (Math.random() - 0.5) * 1.5, size: 0.35 + 0.5 * k, grow: 1.4, life: 0.7 + 0.4 * k, color: 0xf2f8ff, op: 0.55 });
    ring(x, y + 0.03, z, { r0: 0.3, r1: 1.4 + 2.2 * k, life: 1 + k, alpha: 0.6 });
    if (k > 0.5) ring(x, y + 0.03, z, { r0: 0.2, r1: 0.8 + 1.4 * k, life: 1.4 + k, alpha: 0.45 });
  }
  const swim = new Map(); // joueur → { in : dans l'eau, next : prochain rond }
  return {
    group, ring, splash,
    // une balle de `from` à `to` : si elle passe la surface de l'eau, un petit jet là où elle y entre
    shotWater(from, to) {
      const wl = world.waterLevel(to[0], to[2]);
      if (!(wl > to[1] - 0.05) || from[1] <= wl) return;
      const k = (from[1] - wl) / Math.max(0.001, from[1] - to[1]);
      const x = from[0] + (to[0] - from[0]) * k, z = from[2] + (to[2] - from[2]) * k;
      if (!(world.waterLevel(x, z) > -Infinity)) return;
      splash(x, wl, z, 0.08);
    },
    // P : joueur suivi par la caméra (traînées) ; cam : position et direction de la caméra
    update(dt, sim, P, cam, camDir, near = 70) {
      // traînées : au-delà de 16 m/s, en l'air
      const air = P && P.alive && (P.mode === 'chute' || P.mode === 'planeur');
      const speed = air ? Math.hypot(P.vx, P.vy, P.vz) : 0;
      rush += ((air ? Math.min(1, Math.max(0, (speed - 16) / 26)) : 0) - rush) * (1 - Math.exp(-5 * dt));
      v.set(P ? P.vx : 0, P ? P.vy : 0, P ? P.vz : 0);
      const dir = v.lengthSq() > 1 ? dv.copy(v).normalize() : camDir;
      for (let i = 0; i < STREAKS; i++) {
        const S = st[i], o = i * 4;
        if (rush > 0.02 && (!S.on || (S.x - cam.x) * dir.x + (S.y - cam.y) * dir.y + (S.z - cam.z) * dir.z < -6) && i < STREAKS * rush + 4) spawn(S, cam, dir, speed);
        if (!S.on || rush <= 0.02) { S.on = false; alp[o] = alp[o + 1] = alp[o + 2] = alp[o + 3] = 0; continue; }
        a.set(S.x, S.y, S.z); b.copy(a).addScaledVector(dir, -S.len);
        // ruban tourné vers la caméra, plus pâle tout près (il ne barre pas l'écran)
        side.subVectors(a, cam).cross(dir).normalize().multiplyScalar(0.02);
        const d = a.distanceTo(cam), al = rush * 0.35 * Math.min(1, Math.max(0, (d - 2) / 4)) * Math.min(1, Math.max(0, (45 - d) / 15));
        pos.set([a.x - side.x, a.y - side.y, a.z - side.z, a.x + side.x, a.y + side.y, a.z + side.z, b.x + side.x, b.y + side.y, b.z + side.z, b.x - side.x, b.y - side.y, b.z - side.z], o * 3);
        alp[o] = alp[o + 1] = al; alp[o + 2] = alp[o + 3] = 0;
      }
      aPos.needsUpdate = true; aAlp.needsUpdate = true;
      // nageurs proches : ronds réguliers ; plongeon : grande gerbe
      for (const Q of sim.S.players.values()) {
        if (!Q.alive || Q.mode === 'ballon' || Math.abs(Q.x - cam.x) > near || Math.abs(Q.z - cam.z) > near) { swim.delete(Q.id); continue; }
        const wl = world.waterLevel(Q.x, Q.z), wet = wl > Q.y + 0.25;
        let st2 = swim.get(Q.id);
        if (!st2) { st2 = { in: wet, next: 0, vy: Q.vy }; swim.set(Q.id, st2); }
        if (wet && !st2.in) splash(Q.x, wl, Q.z, Math.min(1, Math.max(0.25, -st2.vy / 18)));
        st2.in = wet; st2.vy = Q.vy;
        if (wet && Q.swim) {
          st2.next -= dt;
          const sp = Math.hypot(Q.vx, Q.vz);
          if (st2.next <= 0) {
            st2.next = sp > 0.5 ? 0.32 : 0.9;
            ring(Q.x, wl + 0.03, Q.z, { r0: 0.35, r1: sp > 0.5 ? 1.6 : 1.1, life: 1.3, alpha: 0.4 });
            if (sp > 0.5) fx.cloud(Q.x + Q.vx * 0.12, wl + 0.15, Q.z + Q.vz * 0.12, { vx: Q.vx * 0.2, vy: 0.6, vz: Q.vz * 0.2, size: 0.3, grow: 0.9, life: 0.5, color: 0xf2f8ff, op: 0.45 });
          }
        }
      }
      // ronds : ils s'élargissent et s'effacent
      for (let i = 0; i < RINGS; i++) {
        const R = rl[i];
        if (!R) continue;
        R.t += dt;
        if (R.t >= R.life) { rl[i] = null; rings.setMatrixAt(i, zero); continue; }
        const k = R.t / R.life, r = R.r0 + (R.r1 - R.r0) * (1 - (1 - k) * (1 - k));
        rings.setMatrixAt(i, m4.compose(p.set(R.x, R.y, R.z), q, s.set(r, 1, r)));
        rings.setColorAt(i, col.copy(R.c).multiplyScalar(R.alpha * (1 - k)));
      }
      rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true;
    },
    get rush() { return rush; },
    dispose() { sGeo.dispose(); sMat.dispose(); rGeo.dispose(); rMat.dispose(); scene.remove(group); },
  };
}
