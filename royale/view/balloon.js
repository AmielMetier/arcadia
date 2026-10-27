// Island Rush — la montgolfière du départ. Enveloppe en poire (tour), seize fuseaux colorés avec coutures et un bandeau
// « ISLAND RUSH » à l'équateur, jupe sombre, câbles jusqu'à la nacelle en osier (bord en cuir, sacs de lest), brûleur
// dont la flamme rugit par moments et éclaire l'intérieur. Elle se balance doucement. Pieds de la nacelle en 0.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

// profil de l'enveloppe (rayon, hauteur), de la bouche au sommet
const PROFILE = [[1.7, 4.2], [3.6, 6.2], [6.4, 9.2], [8.5, 12.8], [9.4, 16.5], [9.2, 19.6], [8.0, 22.6], [5.8, 25], [3.0, 26.4], [0.01, 26.9]];
const GORES = ['#e8473a', '#ffd23f', '#2f7fe0', '#fff6e8'];
const BASKET = { w: 4, h: 1.5 };

function envelopeTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'), n = 16, gw = 1024 / n;
  for (let i = 0; i < n; i++) { g.fillStyle = GORES[i % GORES.length]; g.fillRect(i * gw, 0, gw + 1, 512); }
  // bandeau à l'équateur (v ≈ 0,45 du profil) : fond bleu nuit, losanges et le nom du jeu
  const y0 = 512 * (1 - 0.53), bh = 512 * 0.1;
  g.fillStyle = '#1b2a4a'; g.fillRect(0, y0, 1024, bh);
  g.fillStyle = '#ffd23f';
  for (let x = 0; x < 1024; x += 32) { g.beginPath(); g.moveTo(x, y0 + 4); g.lineTo(x + 8, y0 + 10); g.lineTo(x, y0 + 16); g.lineTo(x - 8, y0 + 10); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x, y0 + bh - 4); g.lineTo(x + 8, y0 + bh - 10); g.lineTo(x, y0 + bh - 16); g.lineTo(x - 8, y0 + bh - 10); g.closePath(); g.fill(); }
  g.font = 'bold 26px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff6e8';
  for (let k = 0; k < 3; k++) g.fillText('ISLAND RUSH', (k + 0.5) * 1024 / 3, y0 + bh / 2 + 1);
  // coutures des fuseaux et sangles horizontales
  g.strokeStyle = 'rgba(40,30,30,0.45)'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * gw, 0); g.lineTo(i * gw, 512); g.stroke(); }
  g.strokeStyle = 'rgba(40,30,30,0.18)'; g.lineWidth = 1;
  for (let y = 24; y < 512; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  // sommet plus sombre (calotte), ombre douce vers la bouche
  const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, 'rgba(0,0,0,0.25)'); grd.addColorStop(0.08, 'rgba(0,0,0,0)'); grd.addColorStop(0.85, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function wickerTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8a5f33'; g.fillRect(0, 0, 128, 128);
  // tressage : rangées décalées de brins clairs et sombres
  for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 16) {
    const o = (y / 8) % 2 ? 8 : 0;
    g.fillStyle = '#b07d45'; g.fillRect(x + o, y + 1, 12, 6);
    g.fillStyle = 'rgba(60,35,15,0.6)'; g.fillRect(x + o + 12, y, 4, 8);
  }
  for (let x = 0; x < 128; x += 16) { g.fillStyle = 'rgba(60,35,15,0.35)'; g.fillRect(x, 0, 2, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1.2);
  return t;
}
function flameTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 100, 2, 32, 80, 64);
  grd.addColorStop(0, 'rgba(255,255,230,1)'); grd.addColorStop(0.25, 'rgba(255,200,90,0.9)'); grd.addColorStop(0.6, 'rgba(255,110,30,0.45)'); grd.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildBalloon() {
  const group = new THREE.Group(), own = [];
  const keep = (...a) => { own.push(...a); return a[0]; };
  const sway = new THREE.Group(); group.add(sway);
  // ---------------------------------------------------------------- enveloppe et jupe
  const env = new THREE.Mesh(keep(new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 48)),
    keep(new THREE.MeshStandardMaterial({ map: keep(envelopeTexture()), roughness: 0.62, side: THREE.DoubleSide })));
  env.castShadow = true; sway.add(env);
  const skirt = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.7, 1.95, 1.4, 24, 1, true).translate(0, 3.5, 0)), keep(new THREE.MeshStandardMaterial({ color: 0x3a2f2a, roughness: 0.8, side: THREE.DoubleSide })));
  sway.add(skirt);
  // ---------------------------------------------------------------- nacelle
  const half = BASKET.w / 2, wicker = keep(new THREE.MeshStandardMaterial({ map: keep(wickerTexture()), roughness: 0.9 }));
  const leather = keep(new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.7 }));
  const basket = new THREE.Mesh(keep(new THREE.BoxGeometry(BASKET.w, BASKET.h, BASKET.w).translate(0, BASKET.h / 2, 0)), wicker);
  basket.castShadow = true; sway.add(basket);
  for (const [w, d, x, z] of [[BASKET.w + 0.2, 0.18, 0, half], [BASKET.w + 0.2, 0.18, 0, -half], [0.18, BASKET.w + 0.2, half, 0], [0.18, BASKET.w + 0.2, -half, 0]]) {
    const rim = new THREE.Mesh(keep(new THREE.BoxGeometry(w, 0.18, d)), leather); rim.position.set(x, BASKET.h + 0.02, z); sway.add(rim);
  }
  // montants aux coins, sacs de lest accrochés aux flancs
  const sand = keep(new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.95 })), sandGeo = keep(new THREE.SphereGeometry(0.22, 10, 8).scale(1, 1.3, 1));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6)), leather); post.position.set(sx * (half - 0.1), BASKET.h + 0.7, sz * (half - 0.1)); sway.add(post);
  }
  for (let i = 0; i < 8; i++) {
    const side = i % 4, k = (Math.floor(i / 4) ? 0.45 : -0.45) * half;
    const x = side === 0 ? half + 0.18 : side === 1 ? -half - 0.18 : k, z = side === 2 ? half + 0.18 : side === 3 ? -half - 0.18 : k;
    const bag = new THREE.Mesh(sandGeo, sand); bag.position.set(x, BASKET.h - 0.45, z); sway.add(bag);
  }
  // ---------------------------------------------------------------- câbles de la bouche aux coins de la nacelle
  const cable = keep(new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.6 }));
  const tube = (a, b, r) => {
    const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(keep(new THREE.CylinderGeometry(r, r, d.length(), 5)), cable);
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); sway.add(m);
  };
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, top = new THREE.Vector3(Math.cos(a) * 1.75, 4.2, Math.sin(a) * 1.75);
    const cx = Math.sign(Math.cos(a)) * (half - 0.1), cz = Math.sign(Math.sin(a)) * (half - 0.1);
    tube(top, new THREE.Vector3(cx, BASKET.h + 1.4, cz), 0.035);
  }
  // ---------------------------------------------------------------- brûleur et flamme
  const metal = keep(new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.8 }));
  const frame = new THREE.Mesh(keep(new THREE.TorusGeometry(0.75, 0.05, 6, 24).rotateX(Math.PI / 2)), metal); frame.position.y = BASKET.h + 1.45; sway.add(frame);
  const burner = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.28, 0.34, 0.45, 12)), metal); burner.position.y = BASKET.h + 1.6; sway.add(burner);
  const flameMat = keep(new THREE.MeshBasicMaterial({ map: keep(flameTexture()), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const flameGeo = keep(new THREE.PlaneGeometry(0.9, 2.2).translate(0, 1.1, 0));
  const flame = new THREE.Group(); flame.position.y = BASKET.h + 1.8; sway.add(flame);
  for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(flameGeo, flameMat); p.rotation.y = k * Math.PI / 3; flame.add(p); }
  const glow = new THREE.PointLight(0xffa040, 0, 26, 1.5); glow.position.y = BASKET.h + 3.2; sway.add(glow);

  let burn = 0, next = 2 + Math.random() * 3, t = 0;
  return {
    group,
    // le brûleur s'allume par moments (onBurn : pour le son) ; la nacelle se balance
    update(dt, onBurn = null) {
      t += dt; next -= dt;
      if (next <= 0) { burn = 1.1 + Math.random() * 0.8; next = burn + 3 + Math.random() * 4; if (onBurn) onBurn(burn); }
      burn = Math.max(0, burn - dt);
      const on = burn > 0 ? 1 : 0.18, f = on * (0.85 + 0.25 * Math.sin(t * 37) * Math.sin(t * 23));
      flame.scale.set(0.7 + 0.3 * f, 0.35 + 0.9 * f, 0.7 + 0.3 * f);
      flameMat.opacity = 0.55 + 0.45 * f;
      glow.intensity = 60 * f * on;
      sway.rotation.z = Math.sin(t * 0.45) * 0.025; sway.rotation.x = Math.sin(t * 0.37 + 1) * 0.02;
    },
    dispose() { for (const o of own) o.dispose(); },
  };
}
