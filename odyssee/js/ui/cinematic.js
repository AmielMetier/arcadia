// odyssee/js/ui/cinematic.js — Cinématique 3D procédurale de l'éveil de Lugia Obscur (Three.js HD-2D + WebAudio)
// Aucun fichier vidéo externe requis : décor 3D complet du Sanctuaire des Marées, océan animé par vagues,
// Prisme Noir fracturé en éclats 3D, tornade obscure en rubans/particules, éclairs, et sprite officiel HD-2D de Lugia Obscur.
import { el, wait } from './ui.js';

async function loadThree() {
  try { return await import('three'); } catch (e) {}
  try { return await import('../../../shared/vendor/three/three.module.min.js'); } catch (e) { return null; }
}

function makeGlowSpriteTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.28, 'rgba(216,180,254,0.85)');
  gr.addColorStop(0.65, 'rgba(126,34,206,0.28)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildAuraPlumeGeometry(THREE) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(1.1, 0.45, 2.8, 1.45);
  sh.quadraticCurveTo(1.45, 0.25, 0, -0.22);
  sh.closePath();
  return new THREE.ShapeGeometry(sh, 8);
}

function createVortexRibbon(THREE, radiusBot, radiusTop, height, turns, colorHex, opacity) {
  const pts = [];
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const ang = u * Math.PI * 2 * turns;
    const r = radiusBot + (radiusTop - radiusBot) * Math.pow(u, 0.85);
    pts.push(new THREE.Vector3(Math.cos(ang) * r, -0.4 + u * height, Math.sin(ang) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 72, 0.085, 6, false);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

function makeStarfield(THREE, count = 260) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.42;
    const r = 46 + Math.random() * 14;
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.cos(phi) * r * 0.72 + 2;
    pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xd8b4fe, size: 0.28, transparent: true, opacity: 0.75 });
  return new THREE.Points(geo, mat);
}

function buildSanctuary(THREE, scene) {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x161428, roughness: 0.86, metalness: 0.18 });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x6d28d9,
    emissiveIntensity: 1.35,
    roughness: 0.3,
    metalness: 0.5,
  });

  // Autel octogonal central émergeant des flots
  const altar = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.2, 0.85, 8), stoneMat);
  base.position.y = -0.15;
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.2, 0.48, 8), stoneMat);
  dais.position.y = 0.45;
  const runeRing = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.06, 8, 32), trimMat);
  runeRing.rotation.x = Math.PI / 2;
  runeRing.position.y = 0.7;
  altar.add(base, dais, runeRing);
  scene.add(altar);

  // 8 Piliers runiques du Sanctuaire des Marées en cercle
  const pillars = [];
  const count = 8;
  const shaftGeo = new THREE.CylinderGeometry(0.45, 0.62, 6.4, 8);
  const capGeo = new THREE.CylinderGeometry(0.74, 0.5, 0.55, 8);
  const shardGeo = new THREE.OctahedronGeometry(0.36, 0);

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.PI / 8;
    const rad = 11.2;
    const pg = new THREE.Group();
    pg.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
    pg.lookAt(0, 0, 0);

    const shaft = new THREE.Mesh(shaftGeo, stoneMat);
    shaft.position.y = 2.6;
    const cap = new THREE.Mesh(capGeo, stoneMat);
    cap.position.y = 5.95;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.045, 6, 16), trimMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 4.6;
    const crystal = new THREE.Mesh(shardGeo, trimMat);
    crystal.position.y = 6.9;

    pg.add(shaft, cap, ring, crystal);
    scene.add(pg);
    pillars.push({ group: pg, crystal, basePos: pg.position.clone() });
  }

  return { altar, runeRing, trimMat, pillars };
}

function buildBlackPrism(THREE, scene) {
  const group = new THREE.Group();
  group.position.set(0, 2.35, 0);

  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x090414,
    emissive: 0x4c1d95,
    emissiveIntensity: 1.1,
    roughness: 0.14,
    metalness: 0.9,
    transparent: true,
    opacity: 0.92,
  });
  const outer = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), outerMat);
  outer.scale.set(0.85, 1.45, 0.85);

  const coreMat = new THREE.MeshBasicMaterial({ color: 0xe879f9, wireframe: true, transparent: true, opacity: 0.55 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 1), coreMat);

  const ringGeo = new THREE.TorusGeometry(1.75, 0.045, 8, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.85 });
  const r1 = new THREE.Mesh(ringGeo, ringMat);
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.035, 8, 48), ringMat);
  r1.rotation.x = Math.PI / 3;
  r2.rotation.y = Math.PI / 3;

  group.add(outer, core, r1, r2);
  scene.add(group);

  // Éclats pré-générés pour l'explosion à 2.8s
  const shards = [];
  const shardGeo = new THREE.TetrahedronGeometry(0.28, 0);
  const shardMat = new THREE.MeshStandardMaterial({
    color: 0x1e0b36,
    emissive: 0x9333ea,
    emissiveIntensity: 1.6,
    roughness: 0.2,
    metalness: 0.85,
  });
  for (let i = 0; i < 30; i++) {
    const m = new THREE.Mesh(shardGeo, shardMat);
    m.visible = false;
    const phi = Math.acos(1 - 2 * ((i + 0.5) / 30));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const spd = 6 + Math.random() * 10;
    const vel = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * spd,
      Math.abs(Math.cos(phi)) * spd * 0.9 + 3,
      Math.sin(phi) * Math.sin(theta) * spd
    );
    const spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
    scene.add(m);
    shards.push({ mesh: m, vel, spin });
  }

  return { group, outer, core, r1, r2, shards, exploded: false };
}

function buildShadowLugia3D(THREE, scene, lugiaImg, glowTex) {
  const root = new THREE.Group();
  root.position.set(0, -1.6, 0);
  root.scale.setScalar(0.15);
  root.visible = false;

  // Texture sprite officielle de Lugia Obscur (HD-2D Pixel Art net)
  let spriteTex;
  if (lugiaImg) {
    spriteTex = new THREE.Texture(lugiaImg);
    spriteTex.magFilter = THREE.NearestFilter;
    spriteTex.minFilter = THREE.LinearFilter;
    spriteTex.colorSpace = THREE.SRGBColorSpace;
    spriteTex.needsUpdate = true;
  } else {
    spriteTex = glowTex;
  }

  const bodyMat = new THREE.MeshBasicMaterial({
    map: spriteTex,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
  });
  const bodyPlane = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 6.8), bodyMat);

  // Halo d'aura spectrale additive en arrière-plan
  const auraMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0xa855f7,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const auraPlane = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 9.6), auraMat);
  auraPlane.position.z = -0.35;

  // Plumes d'énergie obscure 3D sculptées en éventail derrière Lugia (prolongent son envergure)
  const plumeGeo = buildAuraPlumeGeometry(THREE);
  const plumeMatP = new THREE.MeshBasicMaterial({
    color: 0x9333ea,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plumeMatC = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const makeWingFan = (dir) => {
    const pivot = new THREE.Group();
    pivot.position.set(dir * 0.7, 0.65, -0.3);
    if (dir < 0) pivot.scale.x = -1;
    const angles = [0.22, -0.05, -0.32];
    angles.forEach((rot, idx) => {
      const m = new THREE.Mesh(plumeGeo, idx === 1 ? plumeMatC : plumeMatP);
      m.rotation.z = rot;
      m.scale.set(1.2 - idx * 0.12, 1.0, 1);
      m.position.z = -idx * 0.04;
      pivot.add(m);
    });
    return pivot;
  };
  const wingL = makeWingFan(-1);
  const wingR = makeWingFan(1);

  root.add(auraPlane, wingL, wingR, bodyPlane);
  scene.add(root);

  return { root, bodyPlane, auraPlane, auraMat, wingL, wingR };
}

function createLugia3DScene(THREE, glCanvas, viewport, lugiaImg) {
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  if (!renderer) return null;

  const w0 = viewport.clientWidth || 800;
  const h0 = viewport.clientHeight || 450;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w0, h0, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05020e);
  scene.fog = new THREE.FogExp2(0x0d0420, 0.032);

  const camera = new THREE.PerspectiveCamera(48, w0 / Math.max(1, h0), 0.1, 160);
  camera.position.set(0, 3.0, 14.5);

  // Lumières dramatiques
  scene.add(new THREE.AmbientLight(0x2e1a4a, 1.4));
  const moonLight = new THREE.DirectionalLight(0x93c5fd, 1.1);
  moonLight.position.set(-8, 18, -12);
  scene.add(moonLight);

  const coreLight = new THREE.PointLight(0xa855f7, 4.5, 34, 1.5);
  coreLight.position.set(0, 3.2, 1.5);
  scene.add(coreLight);

  const cyanLight = new THREE.PointLight(0x38bdf8, 2.4, 30, 1.5);
  cyanLight.position.set(0, 4.4, -2.5);
  scene.add(cyanLight);

  // Ciel d'éclipse & Lune rouge-pourpre
  scene.add(makeStarfield(THREE, 280));
  const moonGroup = new THREE.Group();
  moonGroup.position.set(-5, 13.5, -36);
  const eclipseDisc = new THREE.Mesh(new THREE.CircleGeometry(4.0, 36), new THREE.MeshBasicMaterial({ color: 0x05010a }));
  const eclipseCorona = new THREE.Mesh(
    new THREE.RingGeometry(3.95, 5.1, 48),
    new THREE.MeshBasicMaterial({ color: 0x9333ea, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
  );
  eclipseCorona.position.z = -0.05;
  moonGroup.add(eclipseDisc, eclipseCorona);
  scene.add(moonGroup);

  // Océan abyssal à sommets animés
  const seaGeo = new THREE.PlaneGeometry(88, 88, 56, 56);
  seaGeo.rotateX(-Math.PI / 2);
  const seaBaseY = new Float32Array(seaGeo.attributes.position.count);
  for (let i = 0; i < seaBaseY.length; i++) seaBaseY[i] = seaGeo.attributes.position.getY(i);
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x0b0f26,
    emissive: 0x160830,
    roughness: 0.24,
    metalness: 0.68,
  });
  const seaMesh = new THREE.Mesh(seaGeo, seaMat);
  seaMesh.position.y = 0;
  scene.add(seaMesh);

  const glowTex = makeGlowSpriteTex(THREE);
  const sanctuary = buildSanctuary(THREE, scene);
  const prism = buildBlackPrism(THREE, scene);
  const lugia = buildShadowLugia3D(THREE, scene, lugiaImg, glowTex);

  // Rubans 3D de la Tornade Obscure
  const tornadoGroup = new THREE.Group();
  tornadoGroup.visible = false;
  tornadoGroup.add(
    createVortexRibbon(THREE, 2.6, 7.6, 12.0, 3.2, 0x9333ea, 0.55),
    createVortexRibbon(THREE, 2.0, 6.2, 11.5, 4.0, 0x38bdf8, 0.35),
    createVortexRibbon(THREE, 3.2, 8.8, 12.5, 2.6, 0xf43f5e, 0.28)
  );
  scene.add(tornadoGroup);

  // Nuée de particules 3D spirales
  const pCount = 560;
  const pPos = new Float32Array(pCount * 3);
  const pCol = new Float32Array(pCount * 3);
  const pMeta = [];
  const palette = [new THREE.Color(0xc084fc), new THREE.Color(0x7e22ce), new THREE.Color(0x38bdf8), new THREE.Color(0xf43f5e)];
  for (let i = 0; i < pCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 1.4 + Math.random() * 8.5;
    const y = Math.random() * 11;
    pPos[i * 3] = Math.cos(ang) * rad;
    pPos[i * 3 + 1] = y;
    pPos[i * 3 + 2] = Math.sin(ang) * rad;
    const c = palette[i % palette.length];
    pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    pMeta.push({ ang, rad, y, spd: 0.8 + Math.random() * 2.2, vY: 0.7 + Math.random() * 2.4 });
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.42,
    map: glowTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pPoints = new THREE.Points(pGeo, pMat);
  scene.add(pPoints);

  // Anneaux d'onde de choc sur l'océan
  const shockRings = [];
  const ringGeo = new THREE.RingGeometry(0.9, 1.35, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const triggerShock = (colorHex = 0xc084fc, speed = 16) => {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const m = new THREE.Mesh(ringGeo, mat);
    m.position.y = 0.78;
    scene.add(m);
    shockRings.push({ mesh: m, mat, s: 1, alpha: 0.92, speed });
  };

  // Éclairs 3D aléatoires dans le sanctuaire
  const lightningGroup = new THREE.Group();
  scene.add(lightningGroup);
  const boltMat = new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.9 });
  let nextBoltAt = 3.1;
  let boltTTL = 0;

  const spawnLightning = () => {
    while (lightningGroup.children.length) {
      const ch = lightningGroup.children.pop();
      ch.geometry?.dispose?.();
    }
    const pA = sanctuary.pillars[Math.floor(Math.random() * sanctuary.pillars.length)].basePos;
    const pts = [];
    const segs = 7;
    const topY = 14;
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const jitter = i === 0 || i === segs ? 0 : (Math.random() - 0.5) * 1.8;
      pts.push(new THREE.Vector3(pA.x * (1 - f * 0.45) + jitter, 6.9 + f * (topY - 6.9), pA.z * (1 - f * 0.45) + (Math.random() - 0.5) * 1.4));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    lightningGroup.add(new THREE.Line(g, boltMat));
    boltTTL = 0.14;
  };

  let lastMs = performance.now();
  let lastTriggerSec = -1;

  const resize = () => {
    const w = viewport.clientWidth || 800;
    const h = viewport.clientHeight || 450;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };

  const renderFrame = (elapsedMs) => {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastMs) / 1000));
    lastMs = now;
    const t = elapsedMs / 1000;

    // 1. Vagues océaniques 3D
    const seaPos = seaGeo.attributes.position;
    const stormGain = t < 2.8 ? 0.25 + (t / 2.8) * 0.25 : t < 6.8 ? 0.72 : 1.15;
    for (let i = 0; i < seaPos.count; i++) {
      const vx = seaPos.getX(i);
      const vz = seaPos.getZ(i);
      const d = Math.hypot(vx, vz);
      const h = (Math.sin(vx * 0.38 + t * 2.1) * 0.26 + Math.cos(vz * 0.34 - t * 1.8) * 0.24 + Math.sin(d * 0.65 - t * 3.8) * 0.22) * stormGain;
      seaPos.setY(i, seaBaseY[i] + h);
    }
    seaPos.needsUpdate = true;
    seaGeo.computeVertexNormals();

    // 2. Piliers & Lune d'Éclipse
    sanctuary.runeRing.rotation.z += dt * (t < 2.8 ? 0.5 : 1.6);
    sanctuary.trimMat.emissiveIntensity = 1.1 + Math.sin(t * 4.5) * 0.45 + (t > 2.8 ? 0.5 : 0);
    for (let i = 0; i < sanctuary.pillars.length; i++) {
      const pl = sanctuary.pillars[i];
      pl.crystal.position.y = 6.9 + Math.sin(t * 2.4 + i) * 0.22;
      pl.crystal.rotation.y += dt * (1.2 + i * 0.1);
    }
    eclipseCorona.rotation.z += dt * 0.08;

    // 3. Prisme Noir (0 -> 2.8s) puis éclats (2.8s+)
    if (t < 2.8) {
      const rush = 1 + (t / 2.8) * 6.5;
      prism.outer.rotation.y += dt * 1.4 * rush;
      prism.core.rotation.x -= dt * 2.2 * rush;
      prism.r1.rotation.z += dt * 1.9 * rush;
      prism.r2.rotation.x -= dt * 2.3 * rush;
      prism.group.position.y = 2.35 + Math.sin(t * 3.2) * 0.16;
      if (t > 2.1) {
        const j = (t - 2.1) * 0.18;
        prism.outer.position.set((Math.random() - 0.5) * j, (Math.random() - 0.5) * j, (Math.random() - 0.5) * j);
      }
    } else {
      if (!prism.exploded) {
        prism.exploded = true;
        prism.group.visible = false;
        for (const s of prism.shards) {
          s.mesh.visible = true;
          s.mesh.position.copy(prism.group.position);
        }
        triggerShock(0xd8b4fe, 20);
      }
      for (const s of prism.shards) {
        if (!s.mesh.visible) continue;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.vel.y -= 13.5 * dt;
        s.mesh.rotation.x += s.spin.x * dt;
        s.mesh.rotation.y += s.spin.y * dt;
        if (s.mesh.position.y < -1.5) s.mesh.visible = false;
      }
    }

    // 4. Apparition et vol de Lugia Obscur (2.7s -> 15s)
    if (t >= 2.7) {
      lugia.root.visible = true;
      const rise = Math.min(1, (t - 2.7) / 0.9);
      const easeOut = 1 - Math.pow(1 - rise, 3);
      const lunge = t >= 10.8 ? Math.min(1, (t - 10.8) / 1.5) : 0;
      const hover = Math.sin(t * 2.6) * 0.28;
      lugia.root.position.set(0, -1.6 + easeOut * 4.8 + hover - lunge * 0.35, lunge * 2.4);
      lugia.root.scale.setScalar(0.18 + easeOut * 0.88 + lunge * 0.18);

      // Battement des ailes d'énergie 3D
      const wingFreq = t > 6.5 ? 5.2 : 3.2;
      const flap = Math.sin(t * wingFreq) * 0.42;
      lugia.wingL.rotation.z = flap;
      lugia.wingL.rotation.y = -0.25 + Math.cos(t * wingFreq) * 0.22;
      lugia.wingR.rotation.z = -flap;
      lugia.wingR.rotation.y = 0.25 - Math.cos(t * wingFreq) * 0.22;
      lugia.auraPlane.rotation.z -= dt * 0.65;
      lugia.auraMat.opacity = 0.5 + Math.sin(t * 6) * 0.2 + (t > 6.5 ? 0.18 : 0);

      // Billboard orienté face caméra (horizontale) pour préserver la netteté HD-2D
      lugia.root.lookAt(camera.position.x, lugia.root.position.y, camera.position.z);
    }

    // 5. Tornade Obscure (5.8s -> 14s) + Ondes de choc
    if (t >= 5.8) {
      tornadoGroup.visible = true;
      const fadeIn = Math.min(1, (t - 5.8) / 1.2);
      tornadoGroup.scale.set(fadeIn, fadeIn, fadeIn);
      tornadoGroup.rotation.y += dt * (t > 10.5 ? 5.2 : 3.4);
    }
    if (t >= 6.8 && lastTriggerSec < 6.8) { lastTriggerSec = 6.8; triggerShock(0x9333ea, 18); }
    if (t >= 10.8 && lastTriggerSec < 10.8) { lastTriggerSec = 10.8; triggerShock(0xffffff, 24); }

    for (let i = shockRings.length - 1; i >= 0; i--) {
      const sr = shockRings[i];
      sr.s += dt * sr.speed;
      sr.alpha -= dt * 0.85;
      sr.mesh.scale.setScalar(sr.s);
      sr.mat.opacity = Math.max(0, sr.alpha);
      if (sr.alpha <= 0) {
        scene.remove(sr.mesh);
        sr.mat.dispose();
        shockRings.splice(i, 1);
      }
    }

    // 6. Particules 3D spirales
    const pp = pGeo.attributes.position;
    const swirl = t < 2.8 ? 0.55 : t < 6.8 ? 1.8 : 3.6;
    for (let i = 0; i < pCount; i++) {
      const m = pMeta[i];
      m.ang += dt * m.spd * swirl;
      m.y += dt * m.vY * (t > 2.8 ? 1.6 : 0.65);
      if (m.y > 12.5) m.y = 0.2;
      const cone = t >= 5.8 ? m.rad * (0.45 + (m.y / 12.5) * 0.9) : m.rad;
      pp.setXYZ(i, Math.cos(m.ang) * cone, m.y, Math.sin(m.ang) * cone);
    }
    pp.needsUpdate = true;

    // 7. Éclairs dans la tempête
    if (t >= 3.0 && t >= nextBoltAt) {
      spawnLightning();
      nextBoltAt = t + (t > 6.5 ? 0.25 + Math.random() * 0.45 : 0.7 + Math.random() * 0.9);
    }
    if (boltTTL > 0) {
      boltTTL -= dt;
      lightningGroup.visible = boltTTL > 0;
    } else {
      lightningGroup.visible = false;
    }

    // 8. Lumières dynamiques
    coreLight.intensity = 4.0 + Math.sin(t * 7) * 1.4 + (t > 2.7 && t < 3.6 ? 7 : 0) + (t > 10.7 && t < 11.4 ? 9 : 0);
    cyanLight.intensity = 1.8 + Math.cos(t * 5) * 0.9;

    // 9. Caméra cinématographique multi-plans (avec secousses 3D subtiles sur les impacts)
    let shakeAmp = 0;
    if (t >= 2.8 && t <= 4.3) shakeAmp = 0.35 * (1 - (t - 2.8) / 1.5);
    else if (t >= 6.8 && t <= 9.5) shakeAmp = 0.14;
    else if (t >= 10.8 && t <= 12.6) shakeAmp = 0.46 * (1 - (t - 10.8) / 1.8);

    if (t < 2.8) {
      const u = t / 2.8;
      const ang = -0.35 + u * 0.55;
      const dist = 14.2 - u * 5.4;
      camera.position.set(Math.sin(ang) * dist, 2.6 + u * 0.7, Math.cos(ang) * dist);
      camera.lookAt(0, 2.25, 0);
      camera.fov = 50 - u * 6;
    } else if (t < 6.8) {
      const u = (t - 2.8) / 4.0;
      const ang = 0.2 + u * 0.5;
      const dist = 9.2 + u * 3.0;
      camera.position.set(Math.sin(ang) * dist, 1.45 + u * 1.8, Math.cos(ang) * dist);
      camera.lookAt(0, 2.9, 0);
      camera.fov = 54 - u * 6;
    } else if (t < 10.8) {
      const u = (t - 6.8) / 4.0;
      const ang = 0.7 + u * 2.2;
      const dist = 12.2 - u * 1.8;
      camera.position.set(Math.sin(ang) * dist, 3.2 + Math.sin(u * Math.PI) * 1.7, Math.cos(ang) * dist);
      camera.lookAt(0, 3.1, 0);
      camera.fov = 48 + Math.sin(u * Math.PI) * 7;
    } else {
      const u = Math.min(1, (t - 10.8) / 4.1);
      const ang = 2.9 + u * 0.38;
      const dist = 10.2 - Math.min(1, u * 1.3) * 1.6;
      camera.position.set(Math.sin(ang) * dist * 0.28, 2.35 + u * 0.35, Math.abs(Math.cos(ang) * dist) + 1.2);
      camera.lookAt(0, 3.05, lugia.root.position.z * 0.5);
      camera.fov = 52 - u * 8;
    }
    if (shakeAmp > 0) {
      camera.position.x += (Math.random() - 0.5) * shakeAmp;
      camera.position.y += (Math.random() - 0.5) * shakeAmp;
    }
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };

  const dispose = () => {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) {
        if (m.map && m.map !== glowTex) m.map.dispose?.();
        m.dispose?.();
      }
    });
    glowTex.dispose();
    ringGeo.dispose();
    renderer.dispose();
  };

  return { resize, renderFrame, dispose };
}

/**
 * Lance la cinématique 3D d'éveil de Lugia Obscur (Sculpture Three.js + WebAudio).
 * Renvoie une Promise résolue quand la cinématique est terminée ou passée.
 */
export async function playLugiaCinematic(game) {
  const ui = game.ui;
  const sound = game.sound;
  const input = ui.input;

  const prevBusy = !!game.busy;
  game.busy = true;
  sound.stopMusic(0.25);
  await ui.fade(true, 280);

  let THREE = null;
  let lugiaRaw = null;
  try {
    const [tMod, aMod, sMod] = await Promise.all([
      loadThree(),
      import('../assets.js'),
      import('../render/shadow.js'),
    ]);
    THREE = tMod;
    const { ASSETS, loadImg } = aMod;
    const { shadowCanvas } = sMod;
    lugiaRaw = await loadImg(ASSETS.shadowFront(249)).then(async (im) => im || shadowCanvas(await loadImg(ASSETS.front(249, false, true)) || await loadImg(ASSETS.front(249))));
  } catch (e) {}

  const scr = el('div', 'screen lugia-cine-scr');
  scr.innerHTML = `
    <div class="lugia-cine-bars">
      <div class="lugia-cine-bar top"></div>
      <div class="lugia-cine-bar bot"></div>
    </div>
    <div class="lugia-cine-viewport">
      <canvas class="lugia-cine-3d"></canvas>
      <canvas class="lugia-cine-canvas"></canvas>
      <div class="lugia-cine-aura"></div>
      <div class="lugia-cine-vignette"></div>
      <div class="lugia-cine-flash"></div>
      <div class="lugia-cine-hud">
        <div class="lugia-cine-title-wrap">
          <div class="lugia-cine-badge">
            <span class="lugia-badge-dot"></span>
            <span>SANCTUAIRE DES MARÉES · ÉVEIL DU MONSTRE</span>
          </div>
          <h1 class="lugia-cine-title">LUGIA OBSCUR</h1>
          <div class="lugia-cine-sub">LE GARDIEN CORROMPU DU PRISME NOIR</div>
        </div>
      </div>
    </div>
    <button type="button" class="lugia-cine-skip">Passer la cinématique (Entrée / Échap / Clic)</button>
  `;

  ui.root.appendChild(scr);

  const glCanvas = scr.querySelector('.lugia-cine-3d');
  const viewport = scr.querySelector('.lugia-cine-viewport');
  const canvas = scr.querySelector('.lugia-cine-canvas');
  const flashEl = scr.querySelector('.lugia-cine-flash');
  const titleWrap = scr.querySelector('.lugia-cine-title-wrap');
  const skipBtn = scr.querySelector('.lugia-cine-skip');

  const scene3D = THREE ? createLugia3DScene(THREE, glCanvas, viewport, lugiaRaw) : null;
  if (!scene3D) glCanvas.style.display = 'none';

  // Canvas 2D d'appoint (speedlines d'impact + fallback complet si WebGL indisponible)
  const ctx = canvas.getContext('2d');
  let cw = (canvas.width = viewport.clientWidth || 800);
  let ch = (canvas.height = viewport.clientHeight || 450);

  const onResize = () => {
    cw = canvas.width = viewport.clientWidth || 800;
    ch = canvas.height = viewport.clientHeight || 450;
    scene3D?.resize();
  };
  window.addEventListener('resize', onResize);

  const particles = Array.from({ length: 42 }, () => ({
    x: Math.random() * cw,
    y: Math.random() * ch,
    vx: (Math.random() - 0.5) * 0.9,
    vy: -1.0 - Math.random() * 2.2,
    r: 1.5 + Math.random() * 2.5,
    alpha: 0.2 + Math.random() * 0.7,
    color: Math.random() > 0.4 ? '#a855f7' : Math.random() > 0.5 ? '#7e22ce' : '#f43f5e',
  }));

  let animRunning = true;
  const startTime = performance.now();

  const renderLoop = () => {
    if (!animRunning) return;
    const elapsed = performance.now() - startTime;
    if (scene3D) scene3D.renderFrame(elapsed);

    if (ctx) {
      ctx.clearRect(0, 0, cw, ch);

      // Si pas de WebGL : fond abyssal de repli
      if (!scene3D) {
        const bg = ctx.createRadialGradient(cw / 2, ch * 0.45, 20, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
        bg.addColorStop(0, '#2e1065');
        bg.addColorStop(0.6, '#100424');
        bg.addColorStop(1, '#04010c');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, ch);
      }

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = ch + 10; p.x = Math.random() * cw; }
        if (p.x < -10) p.x = cw + 10;
        if (p.x > cw + 10) p.x = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (scene3D ? 0.75 : 1.1), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * (scene3D ? 0.45 : 0.85);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (animRunning) requestAnimationFrame(renderLoop);
  };
  requestAnimationFrame(renderLoop);

  const flash = async (color = '#ffffff', ms = 120) => {
    if (!animRunning) return;
    flashEl.style.background = color;
    flashEl.style.opacity = '0.92';
    await wait(ms);
    if (animRunning) flashEl.style.opacity = '0';
  };

  const timeouts = [];
  const at = (ms, fn) => timeouts.push(setTimeout(() => { if (animRunning) fn(); }, ms));
  let audioCtrl = { stop: () => {} };

  const stopEffects = () => {
    animRunning = false;
    timeouts.forEach((id) => clearTimeout(id));
    timeouts.length = 0;
    window.removeEventListener('resize', onResize);
    try { audioCtrl.stop(); } catch (e) {}
  };

  try {
    timeouts.push(setTimeout(() => { if (animRunning) scr.classList.add('in'); }, 40));
    await ui.fade(false, 300);

    audioCtrl = sound.playLugiaCinematicAudio ? sound.playLugiaCinematicAudio() : { stop: () => {} };

    // Séquence synchronisée sur le design sonore (14.9 s)
    at(2800, () => { flash('#d8b4fe', 160); });
    at(3300, () => { titleWrap.classList.add('in'); });
    at(10800, () => { flash('#ffffff', 140); });
    at(10960, () => flash('#7e22ce', 220));
    at(12200, () => {
      titleWrap.classList.remove('in');
      titleWrap.classList.add('out');
    });

    await new Promise((resolve) => {
      let finished = false;
      const end = () => {
        if (finished) return;
        finished = true;
        pop();
        resolve();
      };

      const pop = input.push((k) => {
        if (k === 'a' || k === 'b' || k === 'menu') {
          sound.sfx('select');
          end();
        }
      });

      skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.sfx('select');
        end();
      });

      timeouts.push(setTimeout(end, 14800));
    });

    stopEffects();
    await ui.fade(true, 300);
    scene3D?.dispose();
    scr.remove();

    if (game.state?.flags) {
      game.state.flags.seenLugiaCinematic = true;
      game.save?.(true);
    }

    await ui.fade(false, 250);
  } finally {
    stopEffects();
    scene3D?.dispose();
    if (scr.isConnected) scr.remove();
    game.busy = prevBusy;
  }
}
