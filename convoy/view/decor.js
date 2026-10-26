// Convoy Storm — décor instancié : des milliers de sapins, rochers, monticules, traverses… en quelques appels de dessin.
// Chaque modèle (ou forme simple) a son « pool » d'InstancedMesh ; à chaque image on y range les instances visibles
// (position, cap, échelle), puis end() écrit les matrices. Les pools grandissent à la demande.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

export function makeScatter(scene) {
  const pools = new Map();
  const M = new THREE.Matrix4(), R = new THREE.Matrix4(), S = new THREE.Matrix4();
  function grow(P, need) {
    if (need <= P.cap) return;
    const cap = Math.max(32, 2 ** Math.ceil(Math.log2(need)));
    for (const m of P.meshes) { scene.remove(m); m.dispose(); }
    P.meshes = P.parts.map((pt, pi) => {
      const m = new THREE.InstancedMesh(pt.geo, pt.mat, cap); m.name = P.key + '#' + pi;
      m.castShadow = P.cast; m.receiveShadow = P.recv; m.frustumCulled = false; m.count = 0;
      scene.add(m); return m;
    });
    const buf = new Float32Array(cap * 7); buf.set(P.buf.subarray(0, Math.min(P.buf.length, buf.length))); P.buf = buf;
    P.cap = cap;
  }
  return {
    // parts : [{ geo, mat, base: Matrix4 }] — une forme peut avoir plusieurs pièces (tronc et feuillage…)
    define(key, parts, { cast = true, recv = true } = {}) {
      const old = pools.get(key);
      if (old) for (const m of old.meshes) { scene.remove(m); m.dispose(); }
      pools.set(key, { key, parts, meshes: [], cap: 0, n: 0, buf: new Float32Array(0), cast, recv });
    },
    has: (key) => pools.has(key),
    begin() { for (const P of pools.values()) P.n = 0; },
    // une instance : position (x, y, z), cap yaw, échelle (sx, sy, sz)
    add(key, x, y, z, yaw, sx, sy = sx, sz = sx) {
      const P = pools.get(key); if (!P) return false;
      if (P.n >= P.cap) grow(P, P.n + 1);
      const o = P.n++ * 7, b = P.buf;
      b[o] = x; b[o + 1] = y; b[o + 2] = z; b[o + 3] = yaw; b[o + 4] = sx; b[o + 5] = sy; b[o + 6] = sz;
      return true;
    },
    end() {
      for (const P of pools.values()) {
        if (P.n > P.cap) grow(P, P.n);
        for (let pi = 0; pi < P.meshes.length; pi++) {
          const mesh = P.meshes[pi], base = P.parts[pi].base;
          for (let i = 0; i < P.n; i++) {
            const o = i * 7, b = P.buf;
            S.makeScale(b[o + 4], b[o + 5], b[o + 6]); R.makeRotationY(b[o + 3]);
            M.multiplyMatrices(R, S); M.setPosition(b[o], b[o + 1], b[o + 2]);
            if (base) M.multiply(base);
            mesh.setMatrixAt(i, M);
          }
          mesh.count = P.n;
          if (P.n) mesh.instanceMatrix.needsUpdate = true;
        }
      }
    },
    dispose() { for (const P of pools.values()) for (const m of P.meshes) { scene.remove(m); m.dispose(); } pools.clear(); },
  };
}
