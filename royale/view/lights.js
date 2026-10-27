// Au crépuscule et le soir, les lampadaires et les lampes des portes s'allument : un halo chaud autour de l'ampoule
// et une flaque de lumière au sol. Pas de vraies lumières (bien trop coûteuses par centaines) : des panneaux
// lumineux, dessinés d'un coup. Un lampadaire cassé s'éteint.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { createBillboards } from './fx.js';

function radial(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// lamps : têtes des lampadaires [{ x, y, z, gy (sol), pid }] ; bulbs : lampes des portes [Vector3] ; night : 0 → 1
export function buildNightLights(lamps, bulbs, night) {
  const group = new THREE.Group();
  const glowTex = radial([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,236,190,0.75)'], [0.5, 'rgba(255,200,120,0.18)'], [1, 'rgba(255,180,90,0)']]);
  const poolTex = radial([[0, 'rgba(255,255,255,0.9)'], [0.45, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
  const n = lamps.length + bulbs.length;
  const halos = createBillboards(Math.max(1, n), glowTex, { additive: true });
  halos.mesh.renderOrder = 3; group.add(halos.mesh);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }), Math.max(1, n));
  pools.frustumCulled = false; pools.renderOrder = 1; group.add(pools);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  const lampCol = new THREE.Color(1, 0.86, 0.62), bulbCol = new THREE.Color(1, 0.8, 0.5);
  const byPid = new Map(), off = new Map();
  let i = 0;
  const lit = [];
  for (const l of lamps) {
    lit.push(i);
    halos.set(i, l.x, l.y, l.z, 2.6, lampCol.r, lampCol.g, lampCol.b, 0.85 * night);
    pools.setMatrixAt(i, m4.compose(p.set(l.x, l.gy + 0.12, l.z), q, s.set(10, 1, 10)));
    pools.setColorAt(i, col.copy(lampCol).multiplyScalar(0.26 * night));
    if (l.pid != null) byPid.set(l.pid, i);
    i++;
  }
  for (const b of bulbs) {
    halos.set(i, b.x, b.y, b.z, 1.1, bulbCol.r, bulbCol.g, bulbCol.b, 0.75 * night);
    pools.setMatrixAt(i, m4.compose(p.set(b.x, b.y - 1.95, b.z), q, s.set(4.5, 1, 4.5)));
    pools.setColorAt(i, col.copy(bulbCol).multiplyScalar(0.2 * night));
    i++;
  }
  halos.count(n);
  pools.count = n;
  return {
    group,
    // lampadaire cassé (numéro d'objet de l'île)
    hide(pid) {
      const k = byPid.get(pid);
      if (k == null || off.has(k)) return;
      const m = new THREE.Matrix4(); pools.getMatrixAt(k, m); off.set(k, m);
      halos.set(k, 0, -999, 0, 0, 0, 0, 0, 0); halos.count(n);
      pools.setMatrixAt(k, m4.makeScale(0, 0, 0)); pools.instanceMatrix.needsUpdate = true;
    },
    // nouvelle partie : les lampadaires cassés se rallument
    restore() {
      for (const [k, m] of off) {
        const l = lamps[k];
        if (l) halos.set(k, l.x, l.y, l.z, 2.6, lampCol.r, lampCol.g, lampCol.b, 0.85 * night);
        pools.setMatrixAt(k, m);
      }
      off.clear(); halos.count(n); pools.instanceMatrix.needsUpdate = true;
    },
    dispose() { halos.dispose(); pools.geometry.dispose(); pools.material.dispose(); glowTex.dispose(); poolTex.dispose(); },
  };
}
