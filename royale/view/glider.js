// Island Rush — le deltaplane de la descente. Armature en tubes d'aluminium (bords d'attaque, quille, transversale,
// mât), voile en delta tendue et creusée, aux couleurs du joueur avec des chevrons clairs, barre de contrôle que le
// pilote tient à deux mains. La voile ondule au bord de fuite, l'aile s'ouvre en se dépliant et s'incline dans les
// virages ; deux traînées blanches partent des bouts d'aile. Repère du joueur : pieds en 0, regard vers +z.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const SPAN = 2.2, NOSE = 1.05, TIP_Z = -0.6, TAIL_Z = -0.82, H = 2.72;  // demi-envergure, nez, bouts d'aile, quille
const NU = 18, NV = 7;                                                     // maillage de la voile
export const BAR = { y: 2.06, z: 0.34, half: 0.42 };                       // barre de contrôle (repère du joueur)
const TRAIL_N = 26;

const tubeMat = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.35, metalness: 0.7 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b2e36, roughness: 0.6, metalness: 0.3 });
const sailTex = new Map();

// toile : couleur du joueur, chevrons blancs vers le nez, bord de fuite plus sombre, liseré au bord d'attaque
function sailTexture(color) {
  const key = color.getHexString();
  if (sailTex.has(key)) return sailTex.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d'), base = '#' + key, dark = '#' + color.clone().multiplyScalar(0.62).getHexString();
  g.fillStyle = base; g.fillRect(0, 0, 256, 128);
  // u → x (envergure), v → y (du bord d'attaque au bord de fuite)
  g.fillStyle = 'rgba(255,255,255,0.92)';
  for (const [v0, w] of [[0.3, 0.12], [0.55, 0.07]]) {
    g.beginPath(); g.moveTo(0, (v0 + 0.25) * 128); g.lineTo(128, v0 * 128); g.lineTo(256, (v0 + 0.25) * 128);
    g.lineTo(256, (v0 + 0.25 + w) * 128); g.lineTo(128, (v0 + w) * 128); g.lineTo(0, (v0 + 0.25 + w) * 128); g.closePath(); g.fill();
  }
  const grd = g.createLinearGradient(0, 96, 0, 128); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, dark);
  g.fillStyle = grd; g.fillRect(0, 96, 256, 32);
  g.fillStyle = 'rgba(30,32,40,0.85)'; g.fillRect(0, 0, 256, 5);
  // coutures
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
  for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  sailTex.set(key, t);
  return t;
}

function tube(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}

export function buildGlider(color) {
  const col = new THREE.Color(color);
  const root = new THREE.Group();          // pivot : le point d'accroche, au-dessus de la tête
  root.position.set(0, H - 0.05, 0.12);
  const wing = new THREE.Group(); root.add(wing);
  wing.position.set(0, 0.05 - H, -0.12);   // les points ci-dessous sont dans le repère du joueur
  const N = new THREE.Vector3(0, H + 0.06, NOSE), TL = new THREE.Vector3(SPAN, H - 0.12, TIP_Z), TR = new THREE.Vector3(-SPAN, H - 0.12, TIP_Z);
  const C = new THREE.Vector3(0, H, TAIL_Z);
  // ---------------------------------------------------------------- voile (u : −1 → 1 d'un bout d'aile à l'autre)
  const pos = new Float32Array(NU * NV * 3), uv = new Float32Array(NU * NV * 2), base = new Float32Array(NU * NV * 3);
  const idx = [];
  const L = new THREE.Vector3(), Tt = new THREE.Vector3(), P = new THREE.Vector3();
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1) * 2 - 1, v = j / (NV - 1), au = Math.abs(u);
    L.copy(N).lerp(u < 0 ? TR : TL, au);
    Tt.copy(C).lerp(u < 0 ? TR : TL, au);
    P.copy(L).lerp(Tt, v);
    // creux de la voile, plus profond au centre ; bords d'aile relevés
    P.y += 0.17 * Math.sin(Math.PI * v) * Math.pow(1 - au, 0.6) + 0.05 * au * au;
    const k = (j * NU + i) * 3;
    pos[k] = base[k] = P.x; pos[k + 1] = base[k + 1] = P.y; pos[k + 2] = base[k + 2] = P.z;
    uv[(j * NU + i) * 2] = (u + 1) / 2; uv[(j * NU + i) * 2 + 1] = 1 - v;
    if (i < NU - 1 && j < NV - 1) { const a = j * NU + i; idx.push(a, a + NU, a + 1, a + 1, a + NU, a + NU + 1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const sailMat = new THREE.MeshStandardMaterial({ map: sailTexture(col), roughness: 0.75, side: THREE.DoubleSide });
  const sail = new THREE.Mesh(geo, sailMat); sail.castShadow = true; wing.add(sail);
  // ---------------------------------------------------------------- armature
  const lift = (p) => p.clone().add(new THREE.Vector3(0, -0.03, 0));
  wing.add(tube(lift(N), lift(TL), 0.025, tubeMat), tube(lift(N), lift(TR), 0.025, tubeMat), tube(lift(N), lift(C), 0.022, tubeMat));
  const cross = (k) => lift(N).lerp(lift(k), 0.48);
  wing.add(tube(cross(TL), cross(TR), 0.02, tubeMat));
  const keelHang = new THREE.Vector3(0, H - 0.04, 0.12), king = new THREE.Vector3(0, H + 0.42, 0.1);
  wing.add(tube(keelHang, king, 0.018, tubeMat));
  // câbles du mât vers le nez, la queue et les bouts d'aile
  for (const p of [N, C, TL, TR]) wing.add(tube(king, p, 0.005, darkMat));
  // barre de contrôle : deux montants et la barre que l'on tient
  const bl = new THREE.Vector3(BAR.half, BAR.y, BAR.z), br = new THREE.Vector3(-BAR.half, BAR.y, BAR.z);
  wing.add(tube(keelHang, bl, 0.016, tubeMat), tube(keelHang, br, 0.016, tubeMat), tube(bl, br, 0.02, darkMat));
  // sangle du harnais
  wing.add(tube(keelHang, new THREE.Vector3(0, 1.55, -0.05), 0.02, darkMat));
  // bouts d'aile : petits embouts sombres
  for (const p of [TL, TR]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), darkMat); e.position.copy(lift(p)); wing.add(e); }

  // ---------------------------------------------------------------- traînées des bouts d'aile (dans le monde)
  const trails = [TL, TR].map((tip) => {
    const g = new THREE.BufferGeometry(), p = new Float32Array(TRAIL_N * 3), c = new Float32Array(TRAIL_N * 4);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 4));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    line.frustumCulled = false; line.visible = false;
    return { line, tip: lift(tip), pts: [], acc: 0 };
  });

  let open = 0, bank = 0, lastYaw = null, t = 0;
  const w = new THREE.Vector3();
  return {
    root, trails: trails.map((tr) => tr.line),
    // on : planeur ouvert ; far : distance à la caméra (on n'anime la toile que de près)
    update(dt, on, yaw, far = 0) {
      t += dt;
      open = on ? Math.min(1, open + dt * 3) : 0;
      root.visible = open > 0;
      if (!root.visible) { for (const tr of trails) { tr.pts.length = 0; tr.line.visible = false; } lastYaw = null; return; }
      // dépliage : l'aile s'ouvre en envergure et se met en place
      const e = 1 - Math.pow(1 - open, 3);
      wing.scale.set(0.15 + 0.85 * e, 0.6 + 0.4 * e, 0.5 + 0.5 * e);
      // inclinaison dans les virages
      if (lastYaw != null && dt > 0) {
        let dy = yaw - lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        bank += (Math.max(-0.55, Math.min(0.55, -dy / dt * 0.35)) - bank) * (1 - Math.exp(-4 * dt));
      }
      lastYaw = yaw;
      root.rotation.z = bank; root.rotation.x = -0.08 + Math.sin(t * 1.3) * 0.02;
      // la toile ondule au bord de fuite
      if (far < 90) {
        for (let j = 1; j < NV; j++) {
          const v = j / (NV - 1), a = v * v * 0.045;
          for (let i = 0; i < NU; i++) {
            const k = (j * NU + i) * 3 + 1, u = i / (NU - 1) * 2 - 1;
            pos[k] = base[k] + Math.sin(t * 15 + u * 5 + v * 3) * a + Math.sin(t * 9.3 - u * 3) * a * 0.5;
          }
        }
        geo.attributes.position.needsUpdate = true;
      }
      // traînées : un point toutes les 50 ms, effacées vers l'arrière
      root.updateMatrixWorld(true);
      for (const tr of trails) {
        tr.acc += dt;
        if (tr.acc >= 0.05) {
          tr.acc = 0;
          wing.localToWorld(w.copy(tr.tip));
          // un saut de plus de 20 m (téléportation, première image) : on repart de zéro
          if (tr.pts.length && Math.hypot(w.x - tr.pts[0], w.y - tr.pts[1], w.z - tr.pts[2]) > 20) tr.pts.length = 0;
          tr.pts.unshift(w.x, w.y, w.z); if (tr.pts.length > TRAIL_N * 3) tr.pts.length = TRAIL_N * 3;
        }
        const n = tr.pts.length / 3, P2 = tr.line.geometry.attributes.position, C2 = tr.line.geometry.attributes.color;
        for (let i = 0; i < TRAIL_N; i++) {
          const k = Math.min(i, n - 1) * 3;
          P2.setXYZ(i, tr.pts[k], tr.pts[k + 1], tr.pts[k + 2]);
          C2.setXYZW(i, 1, 1, 1, i < n ? 0.55 * e * (1 - i / TRAIL_N) : 0);
        }
        P2.needsUpdate = true; C2.needsUpdate = true;
        tr.line.visible = n > 1 && far < 160;
      }
    },
    // point de la barre de contrôle (dans le monde) : side −1 main droite, 1 main gauche
    bar(side, out) { return wing.localToWorld(out.set(side * BAR.half * 0.72, BAR.y, BAR.z)); },
    dispose() {
      root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      sailMat.dispose();
      for (const tr of trails) { tr.line.geometry.dispose(); tr.line.material.dispose(); tr.line.parent && tr.line.parent.remove(tr.line); }
    },
  };
}
