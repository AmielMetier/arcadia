// The Backrooms (Level 7, Thalassophobia) - Ce que la scène des bureaux ne sait pas dessiner : l'océan (une nappe noire
// et opaque sous le plancher, sur toute la carte ; la moquette est ôtée au-dessus, map.seaHoles), le flanc des îlots,
// le radeau et son moteur, la porte plantée sur le dernier îlot, et l'ombre de la chose sous la surface.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE } from '../engine/map.js';
import { SEA_Y, RAFT, DECK } from '../engine/ocean.js';

const C = CELL_SIZE;

// une houle lente : quelques ondes superposées, répétées sur la nappe
function swellTexture() {
  const N = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x / N) * Math.PI * 2;
      const v = (y / N) * Math.PI * 2;
      const h = Math.sin(u * 3 + v) * 0.35 + Math.sin(v * 4 - u * 2) * 0.3 + Math.sin(u * 7 + v * 5) * 0.15 + Math.sin(u * 2 - v * 6) * 0.2;
      const c = Math.round(128 + h * 70);
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// une tache noire aux bords fondus (l'ombre de la chose sous l'eau)
function blobTexture() {
  const N = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.85)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, N, N);
  return new THREE.CanvasTexture(cv);
}

export function buildOcean({ map, scene }) {
  const W = map.W * C;
  const H = map.H * C;
  const root = new THREE.Group();
  scene.add(root);

  // 1. L'océan : opaque, presque noir ; il ne renvoie que la lampe et les néons (reflets)
  const bump = swellTexture();
  bump.repeat.set(W / 7, H / 7);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshPhongMaterial({ color: '#0a1a1e', emissive: '#03090b', specular: '#a9c4c4', shininess: 80, bumpMap: bump, bumpScale: 0.7 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(W / 2, SEA_Y, H / 2);
  root.add(sea);

  // 2. Le flanc des îlots : le bord de la dalle et ce qui plonge dans l'eau (béton taché)
  const sideMat = new THREE.MeshLambertMaterial({ color: '#4a463c', emissive: '#14130f' });
  for (const o of map.islets) {
    const w = o.w * C;
    const h = o.h * C;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, h), sideMat);
    box.position.set(o.x0 * C + w / 2, -0.8 - 0.004, o.z0 * C + h / 2);
    root.add(box);
  }

  // 3. La porte de sortie : un bâti et une porte de bureau blanche, plantés seuls au milieu du dernier îlot
  const E = map.exit;
  const doorG = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color: '#8b8576', emissive: '#1d1b16' });
  const leafMat = new THREE.MeshLambertMaterial({ color: '#d9d4c3', emissive: '#2c2a24' });
  const post = (x) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.15, 0.16), frameMat);
    m.position.set(x, 1.075, 0);
    doorG.add(m);
  };
  post(-0.5);
  post(0.5);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.16), frameMat);
  head.position.set(0, 2.2, 0);
  doorG.add(head);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.05, 0.05), leafMat);
  leaf.position.set(0, 1.03, 0);
  doorG.add(leaf);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#c9a64a' }));
  knob.position.set(0.33, 1.0, 0.05);
  doorG.add(knob);
  doorG.position.set(E.x, 0, E.z);
  root.add(doorG);

  // 4. Le radeau : des planches sur deux flotteurs, un garde-corps bas, le moteur hors-bord à l'arrière
  const raft = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: '#6b4f33', emissive: '#1a120a' });
  const dark = new THREE.MeshLambertMaterial({ color: '#2a2b2c', emissive: '#08090a' });
  const yellow = new THREE.MeshLambertMaterial({ color: '#b8902a', emissive: '#2a2008' });
  const deckY = -DECK; // le dessus du plancher : là où sont les pieds de ceux qui sont à bord (depthAt), 30 cm au-dessus de l'eau
  for (let i = 0; i < 7; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(RAFT.hw * 2, 0.06, 0.42), wood);
    p.position.set(0, deckY - 0.03, -RAFT.hl + 0.25 + i * ((RAFT.hl * 2 - 0.5) / 6));
    raft.add(p);
  }
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, RAFT.hl * 2, 12), yellow);
    f.rotation.x = Math.PI / 2;
    f.position.set(s * (RAFT.hw - 0.25), deckY - 0.2, 0);
    raft.add(f);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, RAFT.hl * 2 - 0.4), wood);
    rail.position.set(s * (RAFT.hw - 0.05), deckY + 0.45, 0);
    raft.add(rail);
    for (const z of [-RAFT.hl + 0.3, 0, RAFT.hl - 0.3]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), wood);
      st.position.set(s * (RAFT.hw - 0.05), deckY + 0.22, z);
      raft.add(st);
    }
  }
  const motor = new THREE.Group();
  const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.5), dark);
  cowl.position.set(0, deckY + 0.25, 0);
  motor.add(cowl);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.1), dark);
  shaft.position.set(0, deckY - 0.25, -0.15);
  motor.add(shaft);
  motor.position.set(0, 0, -RAFT.hl + 0.3); // (sur le plancher, à l'arrière : il ne dépasse pas dans l'îlot à quai)
  raft.add(motor);
  root.add(raft);

  // 5. L'ombre de la chose : une longue tache noire juste sous la surface (on la devine plus qu'on ne la voit)
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0, depthWrite: false, fog: true });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(6, 17), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = SEA_Y + 0.01;
  const blobRoot = new THREE.Group();
  blobRoot.add(blob);
  // … et son dos : une échine de bosses noires et luisantes qui crève la surface quand elle fonce (elle ondule),
  // qui reste sous l'eau quand elle rôde. Les néons et la lampe glissent dessus : on la voit venir
  const hideMat = new THREE.MeshPhongMaterial({ color: '#1a2622', emissive: '#18241f', specular: '#9fbab3', shininess: 70, fog: true });
  const spine = [];
  for (let i = 0; i < 6; i++) {
    const k = 1 - Math.abs(i - 1.5) / 5;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), hideMat);
    seg.scale.set(1.5 * k + 0.3, 0.55 * k + 0.15, 1.6);
    seg.position.z = 4.5 - i * 2.1;
    blobRoot.add(seg);
    spine.push(seg);
  }
  // l'écume qu'elle soulève autour d'elle quand elle fonce : un ovale pâle et brassé sur l'eau noire
  const foamCv = document.createElement('canvas');
  foamCv.width = foamCv.height = 128;
  {
    const g = foamCv.getContext('2d');
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 22 * (Math.random() < 0.7 ? 1 : 0.5);
      g.fillStyle = `rgba(220,232,228,${0.15 + Math.random() * 0.35})`;
      g.beginPath();
      g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1 + Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const foamMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(foamCv), transparent: true, opacity: 0, depthWrite: false, fog: true });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(7, 15), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = SEA_Y + 0.02;
  blobRoot.add(foam);
  root.add(blobRoot);

  let shown = 0;
  let back = -2;
  return {
    update(sim, time, dt) {
      bump.offset.set(Math.sin(time * 0.04) * 0.4, time * 0.015);
      const R = sim.raft;
      if (R) {
        // la houle berce le radeau ; le moteur tremble quand il tourne
        raft.position.set(R.x, Math.sin(time * 1.3) * 0.03, R.z);
        raft.rotation.set(Math.sin(time * 0.9) * 0.02, R.yaw, Math.sin(time * 1.1 + 1) * 0.025);
        motor.position.x = R.motor ? (Math.random() - 0.5) * 0.012 : 0;
      }
      const M = sim.hasMonster ? sim.monster : null;
      const want = !M ? 0 : M.mode === 'chase' ? 0.62 : M.mode === 'search' ? 0.35 : 0.22;
      shown += (want - shown) * Math.min(1, dt * 1.5);
      blobMat.opacity = shown;
      // le dos affleure en chasse (jusqu'à 35 cm au-dessus de l'eau), plonge sinon
      const rise = !M ? -2 : M.mode === 'chase' ? 0.35 : M.mode === 'search' ? -0.4 : -1.2;
      back += (rise - back) * Math.min(1, dt * 0.9);
      if (M) {
        blobRoot.position.set(M.x, 0, M.z);
        blobRoot.rotation.y = M.yaw || 0;
        blob.scale.set(1 + Math.sin(time * 0.7) * 0.05, 1, 1);
        foamMat.opacity = Math.max(0, Math.min(0.85, (back + 0.4) * 1.2));
        foam.rotation.z = time * 0.3;
        spine.forEach((seg, i) => {
          seg.position.y = SEA_Y + back - seg.scale.y * 0.9 + Math.sin(time * 2.2 - i * 0.9) * 0.18;
          seg.visible = seg.position.y + seg.scale.y > SEA_Y;
        });
      }
    },
  };
}
