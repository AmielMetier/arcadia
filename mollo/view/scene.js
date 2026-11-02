// Mollo ! — le décor et la caméra (Three.js) : des boîtes habillées de textures dessinées au canvas, une ville loin en dessous, un ciel,
// et les mollassons (pantin.js). La caméra plonge depuis le sud (le haut de l'écran est -z, la droite +x) et cadre ceux qui restent.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { Arena } from '../engine/arena.js';
import { Pantins } from './pantin.js';

const SKIES = {
  toits: { top: '#2c3e7a', mid: '#e8726b', low: '#ffc27a', fog: '#d98a7c', sun: '#ffd9a8', sunI: 2.4, hemi: 1.1 },
  chantier: { top: '#2f83c7', mid: '#9fd4ee', low: '#f2ead0', fog: '#bcd7dd', sun: '#fff3d6', sunI: 2.7, hemi: 1.25 },
  usine: { top: '#2a2438', mid: '#6e4a5c', low: '#d88a4f', fog: '#7e5a58', sun: '#ffc48a', sunI: 2.2, hemi: 1 },
};

function canvasTex(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// un bruit reproductible (pas de hasard qui change d'une page à l'autre)
const nz = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
function speckle(g, s, n, a, seed = 1) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${nz(i + seed) > 0.5 ? '255,255,255' : '0,0,0'},${a * nz(i * 3 + seed)})`; g.fillRect(nz(i * 5 + seed) * s, nz(i * 7 + seed) * s, 2 + nz(i) * 5, 2 + nz(i * 2) * 5); } }
const TEX = {
  brique: (g, s) => { g.fillStyle = '#d9cbb8'; g.fillRect(0, 0, s, s); for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) { g.fillStyle = `hsl(${10 + nz(r * 9 + c) * 10},${45 + nz(c + r) * 15}%,${38 + nz(r + c * 3) * 12}%)`; g.fillRect(c * 85.3 + (r % 2) * 42 + 2, r * 32 + 2, 81, 28); } },
  tuile: (g, s) => { g.fillStyle = '#7d3c2a'; g.fillRect(0, 0, s, s); for (let r = 0; r < 6; r++) for (let c = -1; c < 7; c++) { g.fillStyle = `hsl(${14 + nz(r * 3 + c) * 10},55%,${36 + nz(c * 7 + r) * 14}%)`; g.beginPath(); g.arc(c * 42.6 + (r % 2) * 21, r * 42.6 + 8, 21, 0, Math.PI); g.lineTo(c * 42.6 + (r % 2) * 21 - 21, r * 42.6 - 12); g.lineTo(c * 42.6 + (r % 2) * 21 + 21, r * 42.6 - 12); g.fill(); } },
  zinc: (g, s) => { g.fillStyle = '#8f9ba6'; g.fillRect(0, 0, s, s); for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(i * 64, 0, 5, s); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(i * 64 + 5, 0, 4, s); } speckle(g, s, 150, 0.08); },
  beton: (g, s) => { g.fillStyle = '#a9a8a2'; g.fillRect(0, 0, s, s); speckle(g, s, 500, 0.1); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3; g.strokeRect(0, 0, s, s); },
  planche: (g, s) => { for (let i = 0; i < 4; i++) { g.fillStyle = `hsl(30,${48 + i * 3}%,${36 + nz(i) * 12}%)`; g.fillRect(0, i * 64, s, 62); for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(50,25,5,.2)'; g.fillRect(nz(k + i * 9) * s, i * 64 + nz(k) * 60, 50 + nz(k * 3) * 90, 2); } } },
  palette: (g, s) => { g.fillStyle = '#6d4a26'; g.fillRect(0, 0, s, s); for (let i = 0; i < 5; i++) { g.fillStyle = `hsl(33,50%,${48 + nz(i * 3) * 12}%)`; g.fillRect(0, i * 52 + 4, s, 42); } },
  poutre: (g, s) => { g.fillStyle = '#d9542b'; g.fillRect(0, 0, s, s); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, s, 14); g.fillRect(0, s - 14, s, 14); for (let i = 0; i < 4; i++) { g.fillStyle = '#7d2f15'; g.beginPath(); g.arc(i * 64 + 32, 30, 5, 0, 7); g.arc(i * 64 + 32, s - 30, 5, 0, 7); g.fill(); } },
  metal: (g, s) => { g.fillStyle = '#5e6a74'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 5; for (let x = -s; x < s * 2; x += 32) for (let y = 0; y < s; y += 32) { g.beginPath(); g.moveTo(x + y, y); g.lineTo(x + y + 14, y + 14); g.stroke(); } },
  danger: (g, s) => { g.fillStyle = '#f2c230'; g.fillRect(0, 0, s, s); g.fillStyle = '#222'; for (let i = -s; i < s * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 + s, s); g.lineTo(i + s, s); g.fill(); } },
  tapis: (g, s) => { g.fillStyle = '#2b2c31'; g.fillRect(0, 0, s, s); g.strokeStyle = '#e9b530'; g.lineWidth = 14; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(i * 128 + 90, 40); g.lineTo(i * 128 + 30, 128); g.lineTo(i * 128 + 90, 216); g.stroke(); } },
};

// une boîte dont les textures gardent leur échelle quelle que soit sa taille
function boxGeo(w, h, d, scale = 1.2) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const a = nx > 0.5 ? d : w, b = ny > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * a / scale, uv.getY(i) * b / scale);
  }
  return g;
}

export function createScene(stage, { onLost } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.classList.add('gl');
  stage.appendChild(renderer.domElement);
  const lost = (e) => { e.preventDefault(); onLost && onLost(); };
  renderer.domElement.addEventListener('webglcontextlost', lost);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd98a7c, 34, 120);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x665544, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(-9, 22, 11); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 60 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const textures = Object.fromEntries(Object.entries(TEX).map(([k, d]) => [k, canvasTex(d)]));
  const mats = Object.fromEntries(Object.entries(textures).map(([k, t]) => [k, new THREE.MeshLambertMaterial({ map: t })]));
  const belts = [];

  // ciel
  const skyTex = (c) => { const t = canvasTex((g, s) => { const l = g.createLinearGradient(0, 0, 0, s); l.addColorStop(0, c.top); l.addColorStop(0.62, c.mid); l.addColorStop(1, c.low); g.fillStyle = l; g.fillRect(0, 0, s, s); }, 64); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  const skies = Object.fromEntries(Object.entries(SKIES).map(([k, c]) => [k, skyTex(c)]));

  // la ville, très loin en dessous : c'est elle qui donne le vertige
  const windows = canvasTex((g, s) => { g.fillStyle = '#3b3a4a'; g.fillRect(0, 0, s, s); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = nz(x * 8 + y) > 0.62 ? '#ffd98a' : '#22222e'; g.fillRect(x * 32 + 7, y * 32 + 7, 18, 20); } });
  const cityGeo = new THREE.BoxGeometry(1, 1, 1);
  const city = new THREE.InstancedMesh(cityGeo, new THREE.MeshLambertMaterial({ map: windows }), 260);
  { const m = new THREE.Matrix4(); let n = 0;
    for (let i = 0; i < 260; i++) { const a = nz(i) * Math.PI * 2, r = 6 + nz(i * 3) * 95, x = Math.cos(a) * r, z = Math.sin(a) * r - 12, w = 5 + nz(i * 5) * 8, d = 5 + nz(i * 7) * 8, h = 20 + nz(i * 11) * 26, top = -16 - nz(i * 13) * 16 + Math.min(10, r * 0.12); m.makeScale(w, h, d).setPosition(x, top - h / 2, z); city.setMatrixAt(n++, m); }
    city.count = n; city.instanceMatrix.needsUpdate = true; }
  scene.add(city);

  const pantins = new Pantins(scene);
  let world = null, arena = null;

  function buildWorld(key, rd, hazards) {
    if (world) { scene.remove(world.group); world.geos.forEach((g) => g.dispose()); }
    belts.length = 0;
    const group = new THREE.Group(), geos = [];
    arena = new Arena(key);
    if (!hazards) { arena.balls = []; for (const b of arena.boxes) if (b.crush) { b.move = null; b.y = 40; b.by = 40; } }
    const movers = [];
    for (const b of arena.boxes) {
      const g = boxGeo(b.hx * 2, b.hy * 2, b.hz * 2); geos.push(g);
      let mat = mats[b.mat] || mats.beton;
      if (b.belt) { // tapis roulant : le dessus défile
        const t = textures.tapis.clone(); t.needsUpdate = true; const top = new THREE.MeshLambertMaterial({ map: t });
        mat = [mats.metal, mats.metal, top, mats.metal, mats.metal, mats.metal];
        belts.push({ t, v: b.belt[0] / 1.2 });
      }
      const m = new THREE.Mesh(g, mat); m.castShadow = b.hy < 2.5; m.receiveShadow = true; m.position.set(b.x, b.y, b.z); group.add(m);
      if (b.move) {
        const o = { b, m }; movers.push(o);
        if (b.crush) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 12, 12), mats.metal); geos.push(rod.geometry); m.add(rod); rod.position.y = 6.5; }
      }
    }
    // le dessous des toits : des murs qui plongent vers la rue
    if (key === 'toits') for (const [x, w, mt] of [[-5.75, 8.5, 'brique'], [6, 7, 'brique']]) { const g = boxGeo(w - 0.1, 26, 8.9); geos.push(g); const m = new THREE.Mesh(g, mats[mt]); m.position.set(x, -15, 0); group.add(m); }
    if (key === 'chantier') { const g = boxGeo(13.5, 22, 7); geos.push(g); const m = new THREE.Mesh(g, mats.poutre); m.scale.set(0.05, 1, 0.05); for (const [x, z] of [[-6, -3], [6, -3], [-6, 3], [6, 3], [0, 3], [0, -3]]) { const c = m.clone(); c.position.set(x, -12, z); group.add(c); } }
    if (key === 'usine') { const g = boxGeo(0.5, 22, 0.5); geos.push(g); for (const [x, z] of [[-6, -3], [6, -3], [0, -3], [0, 2.6]]) { const c = new THREE.Mesh(g, mats.metal); c.position.set(x, -12, z); group.add(c); } }
    const balls = arena.balls.map((q) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(q.r, 24, 16), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.7, roughness: 0.45 })); s.castShadow = true;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), new THREE.MeshLambertMaterial({ color: 0x222222 })); geos.push(s.geometry, c.geometry); group.add(s, c);
      return { q, s, c };
    });
    scene.add(group);
    world = { key, rd, group, geos, movers, balls };
    const c = SKIES[key]; scene.background = skies[key]; scene.fog.color.set(c.fog); sun.color.set(c.sun); sun.intensity = c.sunI; hemi.intensity = c.hemi;
    cam.reset = true;
  }

  // ---------------------------------------------------------------- particules (poussière, étoiles d'impact)
  const PN = 96, parts = Array.from({ length: PN }, () => ({ t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, g: 8 }));
  const pmesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), PN);
  pmesh.frustumCulled = false; pmesh.setColorAt(0, new THREE.Color()); scene.add(pmesh);
  let pi = 0; const pc = new THREE.Color(), pm = new THREE.Matrix4();
  function burst(x, y, z, color, n, sp, size = 0.09, up = 1, g = 9) {
    pc.set(color);
    for (let i = 0; i < n; i++) { const p = parts[pi]; const a = Math.random() * 6.28, b = Math.random() * 1.2, v = sp * (0.5 + Math.random() * 0.7); Object.assign(p, { t: 0.45 + Math.random() * 0.3, x, y, z, vx: Math.cos(a) * Math.cos(b) * v, vy: Math.sin(b) * v * up + 1, vz: Math.sin(a) * Math.cos(b) * v, s: size * (0.6 + Math.random() * 0.8), g }); pmesh.setColorAt(pi, pc); pi = (pi + 1) % PN; }
    pmesh.instanceColor.needsUpdate = true;
  }
  function stepParts(dt) {
    let n = 0;
    for (let i = 0; i < PN; i++) { const p = parts[i]; if (p.t > 0) { p.t -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; } const s = p.t > 0 ? p.s * Math.min(1, p.t * 4) : 0; pm.makeScale(s, s, s).setPosition(p.x, p.y, p.z); pmesh.setMatrixAt(i, pm); n++; }
    pmesh.count = n; pmesh.instanceMatrix.needsUpdate = true;
  }
  const fx = {
    hit: (x, y, z, k = 0) => { burst(x, y, z, '#ffe066', 5 + k * 8, 3.2 + k * 3.5, 0.08 + k * 0.05); shake(0.05 + k * 0.16); },
    ko: (x, y, z) => { burst(x, y, z, '#ffffff', 10, 4, 0.1); burst(x, y, z, '#ffc531', 8, 3, 0.09); shake(0.2); },
    dust: (x, y, z, k = 0.5) => { burst(x, y + 0.05, z, '#cfc4b0', 4 + k * 8, 1.6 + k * 2.2, 0.11, 0.35, 4); if (k > 0.5) shake(0.09); },
    clang: (x, y, z) => { burst(x, y, z, '#ffb347', 14, 6, 0.06); shake(0.3); },
    grip: (x, y, z) => burst(x, y, z, '#ffffff', 3, 1.2, 0.05),
  };

  // ---------------------------------------------------------------- caméra
  const cam = { x: 0, y: 0, z: 0, d: 18, reset: true, shake: 0 };
  const AIM = new THREE.Vector3(), DIR = new THREE.Vector3(0, 0.68, 0.73).normalize();
  function shake(k) { cam.shake = Math.min(0.5, cam.shake + k); }
  function frameCam(v, dt) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y = 0, n = 0;
    const win = (v.ph === 'round' || v.ph === 'over') && (v.ph === 'over' ? v.win : v.rw);
    for (const p of v.players) {
      if (!p.pos || p.pos[1] < -2.5) continue;
      if (win >= 0 && win !== false && p.id !== win) continue;
      x0 = Math.min(x0, p.pos[0]); x1 = Math.max(x1, p.pos[0]); z0 = Math.min(z0, p.pos[2]); z1 = Math.max(z1, p.pos[2]); y += p.pos[1]; n++;
    }
    const A = arena;
    const close = win >= 0 && win !== false && n > 0;
    if (!n) { x0 = A.x0; x1 = A.x1; z0 = A.z0; z1 = A.z1; y = 0; n = 1; }
    const asp = camera.aspect, spanX = x1 - x0 + 5, spanZ = z1 - z0 + 5;
    const t = Math.tan(camera.fov * Math.PI / 360);
    let d = Math.max(spanX / (2 * t * asp), spanZ * 0.8 / (2 * t) * 1.15, close ? 6.5 : 14.5);
    d = Math.min(d, 30);
    // on reste centré sur l'arène autant que possible : on voit toujours où est le vide
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, mx = (A.x0 + A.x1) / 2, mz = (A.z0 + A.z1) / 2, w = close ? 1 : 0.55;
    const tx = mx + (cx - mx) * w, tz = mz + (cz - mz) * w, ty = close ? y / n + 0.6 : 0.5;
    const k = cam.reset ? 1 : 1 - Math.exp(-dt * (close ? 3 : 2.2));
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * k; cam.d += (d - cam.d) * k; cam.reset = false;
    cam.shake = Math.max(0, cam.shake - dt * 1.4);
    const sk = cam.shake * cam.shake * 2.2, now = performance.now() / 1000;
    AIM.set(cam.x + Math.sin(now * 53) * sk, cam.y + Math.sin(now * 61) * sk, cam.z + Math.sin(now * 47) * sk);
    camera.position.copy(AIM).addScaledVector(DIR, cam.d);
    camera.lookAt(AIM);
    sun.target.position.set(cam.x, 0, cam.z); sun.position.set(cam.x - 9, 22, cam.z + 11);
  }

  function resize() { const w = Math.max(1, stage.clientWidth || innerWidth), h = Math.max(1, stage.clientHeight || innerHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  const P3 = new THREE.Vector3();

  buildWorld('toits', 0, true);

  return {
    ready: Promise.resolve(), fx, shake,
    hurt: (id) => pantins.hurt(id),
    toScreen(x, y, z) { P3.set(x, y, z).project(camera); return { x: (P3.x + 1) / 2 * renderer.domElement.clientWidth, y: (1 - P3.y) / 2 * renderer.domElement.clientHeight, back: P3.z > 1 }; },
    frame(v, dt) {
      if (!world || world.key !== v.ar || world.rd !== v.rd) buildWorld(v.ar, v.rd, v.hz !== 0);
      arena.update(v.at || 0);
      for (const o of world.movers) o.m.position.set(o.b.x, o.b.y, o.b.z);
      for (const b of world.balls) { const q = b.q; b.s.position.set(q.x, q.y, q.z); P3.set(q.px, q.py, q.pz); b.c.position.set((q.x + q.px) / 2, (q.y + q.py) / 2, (q.z + q.pz) / 2); b.c.scale.y = P3.distanceTo(b.s.position); b.c.lookAt(P3); b.c.rotateX(Math.PI / 2); }
      for (const b of belts) b.t.offset.x -= b.v * dt;
      pantins.draw(v.players, dt);
      stepParts(dt);
      frameCam(v, dt);
      renderer.render(scene, camera);
    },
    dispose() {
      removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      if (world) world.geos.forEach((g) => g.dispose());
      pantins.dispose(); for (const t of Object.values(textures)) t.dispose(); for (const t of Object.values(skies)) t.dispose(); windows.dispose(); cityGeo.dispose(); pmesh.geometry.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
