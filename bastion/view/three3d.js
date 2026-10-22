// Interface de Bastion Clash (navigateur uniquement).
// Rendu WebGL (Three.js).
'use strict';

/* ============================================================================
   MOTEUR WEBGL 3D VRAIE 3D VUE DU DESSUS (THREE.JS + OMBRES TEMPS RÉEL)
   ============================================================================ */
const bldMeshes3D = new Map();
const unitMeshes3D = new Map();
let treeMeshes3D = [];
let rockMeshes3D = [];
let centerMonumentGroup3D = null;
let basePlatformsGroup3D = null;
let mineralMeshes3D = [];
let geyserMeshes3D = [];
let wallBeamsGroup3D = null;
let fxGroup3D = null;
let ghostGroup3D = null;
let ghostKind3D = null;
let hemiLight3D = null;
let rimLight3D = null;
let skirtMesh3D = null;
let groundMesh3D = null;
const matCache3D = new Map();
const UP_3D = window.THREE ? new THREE.Vector3(0, 1, 0) : null;
const tmpVec3D = window.THREE ? new THREE.Vector3() : null;
const geoCache3D = {};

function getMat3D(hexOrStr, rough = 0.45, metal = 0.25, emissiveHex = 0x000000, emissiveInt = 0, opacity = 1) {
  // Opacité arrondie au 1/20 : les ondes de choc et rayons qui s'estompent réutilisent 20 matières
  // au lieu d'en créer une nouvelle (jamais libérée) à chaque image
  opacity = Math.round(clamp(opacity, 0, 1) * 20) / 20;
  const key = `${hexOrStr}|${rough}|${metal}|${emissiveHex}|${emissiveInt}|${opacity}`;
  if (matCache3D.has(key)) return matCache3D.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(hexOrStr),
    roughness: rough,
    metalness: metal,
    emissive: new THREE.Color(emissiveHex),
    emissiveIntensity: emissiveInt,
    transparent: opacity < 1,
    opacity,
  });
  m.userData.shared = true;
  matCache3D.set(key, m);
  return m;
}

// Retire un objet 3D de la scène et libère ses géométries et matières propres (pas celles partagées par les caches) :
// sans ça, chaque unité morte laissait ses géométries dans la mémoire de la carte graphique
function disposeObject3D(obj) {
  if (!obj) return;
  if (obj.parent) obj.parent.remove(obj);
  const sharedGeo = new Set(Object.values(geoCache3D));
  obj.traverse((o) => {
    if (o.geometry && !sharedGeo.has(o.geometry)) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData && m.userData.shared) continue;
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}

function initThree3D() {
  if (threeReady || !window.THREE || !webglCvs) return false;
  try {
    threeRenderer = new THREE.WebGLRenderer({
      canvas: webglCvs,
      antialias: true,
      powerPreference: 'high-performance',
    });
    threeRenderer.setPixelRatio(Math.min(gfxPreset().pixelRatio, DPR));
    threeRenderer.setSize(W, H, false);
    threeRenderer.shadowMap.enabled = gfxPreset().shadows;
    threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const def = MAP_DEFS[activeMapId] || MAP_DEFS.vallee;
    const FOG_COLOR = def.fogColor;
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(FOG_COLOR);
    // Brouillard atmosphérique au loin : dissimule le bord du monde et plonge le lointain dans la brume sci-fi
    threeScene.fog = new THREE.Fog(FOG_COLOR, def.fogNear, def.fogFar);

    threeCam = new THREE.PerspectiveCamera(34, W / Math.max(1, H), 40, 9500);
    threeRaycaster = new THREE.Raycaster();
    threeGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    threeNdc = new THREE.Vector2();
    threeHitPt = new THREE.Vector3();
    threeProjVec = new THREE.Vector3();

    // Éclairage 3D directionnel + hémisphérique avec vraies ombres portées au sol
    hemiLight3D = new THREE.HemisphereLight(def.hemiSky, def.hemiGround, 0.78);
    threeScene.add(hemiLight3D);

    const sun = new THREE.DirectionalLight(def.sunColor, 0.98);
    sun.position.set(WORLD_SIZE * 0.26, 1750, WORLD_SIZE * 0.82);
    sun.target.position.set(HALF_W, 0, HALF_W);
    sun.castShadow = gfxPreset().shadows;
    sun.shadow.mapSize.width = gfxPreset().shadowSize;
    sun.shadow.mapSize.height = gfxPreset().shadowSize;
    sun.shadow.camera.near = 250;
    sun.shadow.camera.far = 4800;
    const sc = 1450;
    sun.shadow.camera.left = -sc;
    sun.shadow.camera.right = sc;
    sun.shadow.camera.top = sc;
    sun.shadow.camera.bottom = -sc;
    sun.shadow.bias = -0.0005;
    threeScene.add(sun);
    threeScene.add(sun.target);
    sunLight3D = sun;

    rimLight3D = new THREE.DirectionalLight(def.rimColor, 0.32);
    rimLight3D.position.set(WORLD_SIZE * 0.85, 950, WORLD_SIZE * 0.14);
    rimLight3D.target.position.set(HALF_W, 0, HALF_W);
    threeScene.add(rimLight3D);
    threeScene.add(rimLight3D.target);

    // Sol étendu à l'horizon (empêche tout vide noir à angle bas prononcé et se fond dans le brouillard)
    const skirtGeo = new THREE.PlaneGeometry(WORLD_SIZE * 3.5, WORLD_SIZE * 3.5);
    const skirtMat = new THREE.MeshStandardMaterial({
      color: FOG_COLOR,
      roughness: 0.95,
      metalness: 0.08,
    });
    skirtMesh3D = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh3D.rotation.x = -Math.PI / 2;
    skirtMesh3D.position.set(HALF_W, -1.2, HALF_W);
    skirtMesh3D.receiveShadow = true;
    threeScene.add(skirtMesh3D);

    // Le sol en relief (plateaux, rampes, montagnes, lits de rivière) est construit par buildTerrainMeshes3D()

    basePlatformsGroup3D = new THREE.Group();
    threeScene.add(basePlatformsGroup3D);

    centerMonumentGroup3D = new THREE.Group();
    threeScene.add(centerMonumentGroup3D);

    wallBeamsGroup3D = new THREE.Group();
    threeScene.add(wallBeamsGroup3D);

    fxGroup3D = new THREE.Group();
    threeScene.add(fxGroup3D);

    // Brouillard de Guerre 3D dynamique : drapé sur le relief (voir buildTerrainMeshes3D)
    fogTexture3D = new THREE.CanvasTexture(fogSmooth);
    fogTexture3D.minFilter = THREE.LinearFilter;
    fogTexture3D.magFilter = THREE.LinearFilter;

    threeReady = true;
    setupThreeMapScenery(activeMapId);
    return true;
  } catch (err) {
    console.warn('Fallback 2D activé :', err);
    threeReady = false;
    return false;
  }
}

let liquidMesh3D = null;
let fogMesh3D = null;
// Sol 3D en relief : un maillage dont chaque sommet suit la hauteur du terrain (plateaux, rampes, montagnes)
function buildTerrainMeshes3D(def) {
  if (!threeScene || !terrainCanvas) return;
  if (groundMesh3D) {
    threeScene.remove(groundMesh3D);
    groundMesh3D.geometry.dispose();
    if (groundMesh3D.material.map) groundMesh3D.material.map.dispose();
    groundMesh3D.material.dispose();
  }
  if (liquidMesh3D) { threeScene.remove(liquidMesh3D); liquidMesh3D.geometry.dispose(); liquidMesh3D.material.dispose(); }
  if (fogMesh3D) { threeScene.remove(fogMesh3D); fogMesh3D.geometry.dispose(); fogMesh3D.material.dispose(); }

  const W = WORLD_SIZE;
  const seg = Math.round(W / 20);
  const geo = new THREE.PlaneGeometry(W, W, seg, seg);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, heightAt(HALF_W + pos.getX(i), HALF_W - pos.getY(i)));
  }
  geo.computeVertexNormals();
  const tex = new THREE.CanvasTexture(terrainCanvas);
  tex.anisotropy = threeRenderer ? Math.min(8, threeRenderer.capabilities.getMaxAnisotropy()) : 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.04 });
  groundMesh3D = new THREE.Mesh(geo, mat);
  groundMesh3D.rotation.x = -Math.PI / 2;
  groundMesh3D.position.set(HALF_W, 0, HALF_W);
  groundMesh3D.receiveShadow = true;
  groundMesh3D.castShadow = true;
  threeScene.add(groundMesh3D);

  // Surface de l'eau / de la lave / de la glace
  const theme = def.theme;
  const lava = theme === 'volcanique', ice = theme === 'cryo';
  const liqMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(lava ? '#ff5a00' : ice ? '#8ee9ff' : '#2f86c0'),
    roughness: ice ? 0.12 : 0.22, metalness: 0.25,
    transparent: !lava, opacity: ice ? 0.8 : 0.74,
    emissive: new THREE.Color(lava ? '#ff3000' : ice ? '#0a7fa0' : '#0b3a58'),
    emissiveIntensity: lava ? 1.0 : 0.3,
  });
  liquidMesh3D = new THREE.Mesh(new THREE.PlaneGeometry(W, W), liqMat);
  liquidMesh3D.rotation.x = -Math.PI / 2;
  liquidMesh3D.position.set(HALF_W, -5, HALF_W);
  liquidMesh3D.receiveShadow = !lava;
  liquidMesh3D.userData.lava = lava;
  threeScene.add(liquidMesh3D);

  // Brouillard de guerre drapé sur le relief (au-dessus de l'eau)
  const fogGeo = geo.clone();
  const fp = fogGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.max(fp.getZ(i), -3));
  const fogMat = new THREE.MeshBasicMaterial({
    map: fogTexture3D, transparent: true, depthWrite: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6,
  });
  fogMesh3D = new THREE.Mesh(fogGeo, fogMat);
  fogMesh3D.rotation.x = -Math.PI / 2;
  fogMesh3D.position.set(HALF_W, 1.5, HALF_W);
  fogMesh3D.renderOrder = 10;
  threeScene.add(fogMesh3D);
}

function setupThreeMapScenery(mapId = activeMapId) {
  if (!threeScene) return;
  const def = MAP_DEFS[mapId] || MAP_DEFS.vallee;

  // 1. Ambiance, Fog et Horizon
  threeScene.background = new THREE.Color(def.fogColor);
  if (threeScene.fog) {
    threeScene.fog.color = new THREE.Color(def.fogColor);
  }
  if (skirtMesh3D && skirtMesh3D.material) {
    skirtMesh3D.material.color = new THREE.Color(def.fogColor);
  }

  // 2. Éclairage
  if (sunLight3D) sunLight3D.color = new THREE.Color(def.sunColor);
  if (hemiLight3D) {
    hemiLight3D.color = new THREE.Color(def.hemiSky);
    hemiLight3D.groundColor = new THREE.Color(def.hemiGround);
  }
  if (rimLight3D) rimLight3D.color = new THREE.Color(def.rimColor);

  // 3. Sol en relief texturé + plan d'eau / lave + brouillard drapé
  buildTerrainMeshes3D(def);

  // 4. Balises lumineuses en haut des rampes
  if (basePlatformsGroup3D) {
    while (basePlatformsGroup3D.children.length > 0) {
      basePlatformsGroup3D.remove(basePlatformsGroup3D.children[0]);
    }
    const beaconCol = def.theme === 'volcanique' ? '#ff5500' : def.theme === 'cryo' ? '#00f0ff' : '#ffc531';
    const beaconMat = getMat3D(beaconCol, 0.3, 0.2, beaconCol, 0.9);
    const postMat = getMat3D('#2b2f38', 0.6, 0.5);
    const postGeo = new THREE.CylinderGeometry(3, 4, 16, 6);
    const lampGeo = new THREE.SphereGeometry(4.2, 8, 6);
    for (const P of (MAP_FEATURES?.plateaus || [])) {
      for (const a of P.ramps) {
        for (const sgn of [-1, 1]) {
          const px = P.x + Math.cos(a) * (P.r - 6) - Math.sin(a) * sgn * (RAMP_HALF + 4);
          const py = P.y + Math.sin(a) * (P.r - 6) + Math.cos(a) * sgn * (RAMP_HALF + 4);
          const hy = heightAt(px, py);
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(px, hy + 8, py);
          post.castShadow = true;
          basePlatformsGroup3D.add(post);
          const lamp = new THREE.Mesh(lampGeo, beaconMat);
          lamp.position.set(px, hy + 18, py);
          basePlatformsGroup3D.add(lamp);
        }
      }
    }
  }

  // 5. Monument Central
  if (centerMonumentGroup3D) {
    while (centerMonumentGroup3D.children.length > 0) {
      centerMonumentGroup3D.remove(centerMonumentGroup3D.children[0]);
    }
    const platMat1 = getMat3D(def.theme === 'volcanique' ? '#261a22' : def.theme === 'cryo' ? '#27475d' : '#585c69', 0.55, 0.35);
    const platMat2 = getMat3D(def.theme === 'volcanique' ? '#3c242c' : def.theme === 'cryo' ? '#1e384b' : '#454954', 0.5, 0.4);
    const ringCol = def.theme === 'volcanique' ? '#ff5500' : def.theme === 'cryo' ? '#1fc7c1' : '#ffc531';
    const ringMat = getMat3D(ringCol, 0.35, 0.5, ringCol === '#ff5500' ? 0xff3b00 : ringCol === '#1fc7c1' ? 0x00f0ff : 0xffc531, 0.35);

    const cy0 = heightAt(HALF_W, HALF_W);
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(98, 104, 4, 40), platMat2);
    c2.position.set(HALF_W, cy0 + 2, HALF_W);
    c2.receiveShadow = true;
    centerMonumentGroup3D.add(c2);
    void platMat1;

    const cRing = new THREE.Mesh(new THREE.TorusGeometry(112, 2.8, 8, 48), ringMat);
    cRing.rotation.x = Math.PI / 2;
    cRing.position.set(HALF_W, cy0 + 4.5, HALF_W);
    centerMonumentGroup3D.add(cRing);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(4, 14, 70, 6), getMat3D('#2b2f38', 0.5, 0.6));
    spire.position.set(HALF_W, cy0 + 35, HALF_W);
    spire.castShadow = true;
    centerMonumentGroup3D.add(spire);
    const crown = new THREE.Mesh(new THREE.OctahedronGeometry(12, 0), ringMat);
    crown.position.set(HALF_W, cy0 + 80, HALF_W);
    centerMonumentGroup3D.add(crown);
  }

  // 6. Éléments de décor (Arbres / Cheminées / Spires de glace)
  if (treeMeshes3D) {
    for (const item of treeMeshes3D) {
      if (item.grp) disposeObject3D(item.grp);
    }
  }
  treeMeshes3D = [];

  const trunkGeo = new THREE.CylinderGeometry(2.4, 3.6, 12, 7);
  const cone1Geo = new THREE.ConeGeometry(1, 1, 8);
  const barkMat = getMat3D('#4b3624', 0.85, 0.05);

  const volcanoGeo = new THREE.CylinderGeometry(0.5, 1, 1, 10);
  const lavaCoreGeo = new THREE.SphereGeometry(1, 8, 8);
  const lavaMat = getMat3D('#ff4500', 0.2, 0.2, 0xff3300, 0.95);

  const spireGeo = new THREE.ConeGeometry(1, 1, 6);
  const crystalMat = getMat3D('#5cd5eb', 0.15, 0.45, 0x00e5ff, 0.55);

  for (const tr of TREES_3D) {
    const grp = new THREE.Group();
    grp.position.set(tr.x, heightAt(tr.x, tr.y) - 1, tr.y);

    if (tr.type === 'volcano') {
      const basaltMat = getMat3D(tr.col || '#2a1e20', 0.78, 0.15);
      const chim = new THREE.Mesh(volcanoGeo, basaltMat);
      chim.scale.set(tr.r * 0.9, tr.h, tr.r * 0.9);
      chim.position.y = tr.h * 0.5;
      chim.castShadow = true; chim.receiveShadow = true;
      grp.add(chim);

      const core = new THREE.Mesh(lavaCoreGeo, lavaMat);
      core.scale.set(tr.r * 0.35, tr.r * 0.25, tr.r * 0.35);
      core.position.y = tr.h;
      grp.add(core);

    } else if (tr.type === 'crystal') {
      const spire = new THREE.Mesh(spireGeo, crystalMat);
      spire.scale.set(tr.r * 0.7, tr.h * 1.15, tr.r * 0.7);
      spire.position.y = (tr.h * 1.15) * 0.5;
      spire.castShadow = true; spire.receiveShadow = true;
      grp.add(spire);

    } else {
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.position.y = 6;
      trunk.castShadow = true;
      grp.add(trunk);

      const leafMat = getMat3D(tr.col, 0.72, 0.05);
      const h = tr.h || 40;
      const r = tr.r || 20;
      for (let tier = 0; tier < 3; tier++) {
        const cone = new THREE.Mesh(cone1Geo, leafMat);
        const rad = r * (1.02 - tier * 0.24);
        const ch = h * (0.48 - tier * 0.07);
        cone.scale.set(rad, ch, rad);
        cone.position.y = 10 + tier * (h * 0.24) + ch * 0.45;
        cone.castShadow = true; cone.receiveShadow = true;
        grp.add(cone);
      }
    }

    threeScene.add(grp);
    treeMeshes3D.push({ grp, x: tr.x, y: tr.y });
  }

  // 7. Rochers 3D
  if (rockMeshes3D) {
    for (const item of rockMeshes3D) {
      if (item.mesh) disposeObject3D(item.mesh);
    }
  }
  rockMeshes3D = [];
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (const rk of ROCKS) {
    const rockMat = getMat3D(rk.col || (def.theme === 'volcanique' ? '#251c20' : def.theme === 'cryo' ? '#2b506b' : '#6e685f'), 0.8, 0.1);
    const m = new THREE.Mesh(rockGeo, rockMat);
    m.position.set(rk.x, heightAt(rk.x, rk.y) + rk.r * 0.42, rk.y);
    m.scale.set(rk.r * 1.05, rk.r * 0.78, rk.r * 0.95);
    m.rotation.set(rk.seed * 0.7, rk.seed * 1.3, rk.seed * 0.4);
    m.castShadow = true; m.receiveShadow = true;
    threeScene.add(m);
    rockMeshes3D.push({ mesh: m, x: rk.x, y: rk.y });
  }

  // 8. Gisements de Minéraux 3D
  if (mineralMeshes3D) {
    for (const item of mineralMeshes3D) {
      if (item.grp) disposeObject3D(item.grp);
    }
  }
  mineralMeshes3D.length = 0;
  const crysGeo = new THREE.OctahedronGeometry(1, 0);
  for (const m of MINERAL_NODES) {
    const baseY = heightAt(m.x, m.y) + 2.5;
    const grp = new THREE.Group();
    grp.position.set(m.x, baseY, m.y);
    let col, em;
    if (def.theme === 'volcanique') {
      col = m.rich ? '#ffd700' : '#ff4b2b';
      em = m.rich ? 0xffa000 : 0xd42b00;
    } else if (def.theme === 'cryo') {
      col = m.rich ? '#c084fc' : '#38bdf8';
      em = m.rich ? 0x9333ea : 0x0284c7;
    } else {
      col = m.rich ? '#ffc531' : '#1fc7c1';
      em = m.rich ? 0xffa800 : 0x0ea5a0;
    }
    const mat = getMat3D(col, 0.2, 0.35, em, 0.55);
    const r = m.rich ? 14 : 11.5;
    const h = m.rich ? 34 : 28;
    const angles = [
      { ox: 0, oz: 0, sx: r * 0.72, sy: h, sz: r * 0.72, rx: 0.08, rz: -0.06 },
      { ox: -r * 0.55, oz: r * 0.3, sx: r * 0.52, sy: h * 0.74, sz: r * 0.52, rx: -0.22, rz: 0.28 },
      { ox: r * 0.55, oz: -r * 0.25, sx: r * 0.5, sy: h * 0.7, sz: r * 0.5, rx: 0.24, rz: -0.26 },
      { ox: r * 0.15, oz: r * 0.58, sx: r * 0.44, sy: h * 0.62, sz: r * 0.44, rx: 0.3, rz: 0.15 },
    ];
    for (const a of angles) {
      const c = new THREE.Mesh(crysGeo, mat);
      c.position.set(a.ox, a.sy * 0.36, a.oz);
      c.scale.set(a.sx, a.sy * 0.65, a.sz);
      c.rotation.set(a.rx, a.ox, a.rz);
      c.castShadow = true;
      grp.add(c);
    }
    threeScene.add(grp);
    mineralMeshes3D.push({ grp, id: m.id, seed: m.x * 0.02 + m.y * 0.01, x: m.x, y: m.y, baseY });
  }

  // 9. Geysers de Gaz Plasma 3D
  if (geyserMeshes3D) {
    for (const item of geyserMeshes3D) {
      if (item.grp) disposeObject3D(item.grp);
    }
  }
  geyserMeshes3D = [];
  const geyRimMat = getMat3D(def.theme === 'volcanique' ? '#332428' : def.theme === 'cryo' ? '#26485e' : '#435449', 0.68, 0.22);
  let geyCol = '#2fbf71', geyEm = 0x2fbf71;
  if (def.theme === 'volcanique') {
    geyCol = '#ff5500'; geyEm = 0xff4500;
  } else if (def.theme === 'cryo') {
    geyCol = '#00f0ff'; geyEm = 0x00f0ff;
  }
  const geyCoreMat = getMat3D(geyCol, 0.2, 0.1, geyEm, 0.85);

  for (const gey of GAS_GEYSERS) {
    const baseY = heightAt(gey.x, gey.y);
    const grp = new THREE.Group();
    grp.position.set(gey.x, baseY, gey.y);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(22, 29, 14, 12), geyRimMat);
    base.position.y = 7;
    base.castShadow = true; base.receiveShadow = true;
    grp.add(base);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(16, 4.5, 8, 16), geyRimMat);
    torus.rotation.x = Math.PI / 2;
    torus.position.y = 14;
    grp.add(torus);
    const core = new THREE.Mesh(new THREE.SphereGeometry(12, 14, 12), geyCoreMat);
    core.position.y = 13;
    grp.add(core);
    threeScene.add(grp);
    geyserMeshes3D.push({ grp, core, seed: gey.x * 0.01, x: gey.x, y: gey.y, baseY });
  }
}

function createBuildingMesh3D(kind, color, isGhost = false) {
  const grp = new THREE.Group();
  const bodyGroup = new THREE.Group();
  grp.add(bodyGroup);

  const def = BUILDINGS[kind] || BUILDINGS.pylon;
  const r = def.radius || 32;
  const h = def.height || 36;
  const op = isGhost ? 0.65 : 1;

  const teamMat = getMat3D(color, 0.35, 0.35, color, isGhost ? 0.35 : 0.1, op);
  const darkTeamMat = getMat3D(shade(color, -0.36), 0.45, 0.4, 0x000000, 0, op);
  const steelMat = getMat3D('#5a606e', 0.45, 0.55, 0x000000, 0, op);
  const darkSteelMat = getMat3D('#2b2f38', 0.55, 0.6, 0x000000, 0, op);
  const lightSteelMat = getMat3D('#929aa8', 0.35, 0.5, 0x000000, 0, op);
  const cyanMat = getMat3D('#1fc7c1', 0.2, 0.2, 0x1fc7c1, 0.75, op);
  const yellowMat = getMat3D('#ffc531', 0.3, 0.3, 0xffc531, 0.5, op);
  const greenMat = getMat3D('#2fbf71', 0.2, 0.2, 0x2fbf71, 0.7, op);

  // Socle blindé commun
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.08, 6, 8), darkSteelMat);
  plinth.position.y = 3;
  plinth.castShadow = !isGhost;
  plinth.receiveShadow = !isGhost;
  bodyGroup.add(plinth);

  if (kind === 'hq') {
    // Forteresse octogonale Terran + 4 bastions d'angle + pont supérieur + radar Comsat rotatif 3D
    const mainHull = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.96, h * 0.55, 8), steelMat);
    mainHull.position.y = 6 + h * 0.275;
    mainHull.castShadow = !isGhost;
    mainHull.receiveShadow = !isGhost;
    bodyGroup.add(mainHull);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const pod = new THREE.Mesh(new THREE.BoxGeometry(r * 0.46, h * 0.62, r * 0.46), darkTeamMat);
      pod.position.set(Math.cos(a) * r * 0.64, 6 + h * 0.31, Math.sin(a) * r * 0.64);
      pod.rotation.y = -a;
      pod.castShadow = !isGhost;
      bodyGroup.add(pod);
    }

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.66, h * 0.32, 8), teamMat);
    deck.position.y = 6 + h * 0.68;
    deck.castShadow = !isGhost;
    bodyGroup.add(deck);

    const heliRing = new THREE.Mesh(new THREE.TorusGeometry(r * 0.36, 2.2, 8, 24), yellowMat);
    heliRing.rotation.x = Math.PI / 2;
    heliRing.position.y = 6 + h * 0.85;
    bodyGroup.add(heliRing);

    const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, 4, 16), cyanMat);
    coreGlow.position.y = 6 + h * 0.85;
    bodyGroup.add(coreGlow);

    const radarGrp = new THREE.Group();
    radarGrp.position.set(r * 0.34, 6 + h * 0.92, -r * 0.28);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 10, 8), darkSteelMat);
    radarGrp.add(mast);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(11, 4, 5, 12), lightSteelMat);
    dish.position.y = 6;
    dish.rotation.z = 0.55;
    radarGrp.add(dish);
    bodyGroup.add(radarGrp);
    grp.userData.rotPart = radarGrp;

  } else if (kind === 'pylon') {
    // Dépôt de Ravitaillement 3D : 4 dômes pressurisés + cristal d'énergie central rotatif
    const baseBox = new THREE.Mesh(new THREE.BoxGeometry(r * 1.45, h * 0.48, r * 1.45), steelMat);
    baseBox.position.y = 6 + h * 0.24;
    baseBox.castShadow = !isGhost;
    bodyGroup.add(baseBox);

    const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [ox, oz] of offsets) {
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.36, h * 0.65, 12), teamMat);
      dome.position.set(ox * r * 0.42, 6 + h * 0.33, oz * r * 0.42);
      dome.castShadow = !isGhost;
      bodyGroup.add(dome);
    }

    const crys = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.34, 0), cyanMat);
    crys.position.y = 6 + h * 0.85;
    crys.scale.set(0.8, 1.45, 0.8);
    bodyGroup.add(crys);
    grp.userData.rotPart = crys;

  } else if (kind === 'extractor') {
    // Raffinerie de Gaz 3D : anneau industriel + cuves de stockage + colonne plasma verte
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.95, h * 0.68, 10), steelMat);
    body.position.y = 6 + h * 0.34;
    body.castShadow = !isGhost;
    bodyGroup.add(body);

    const teamBand = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.86, h * 0.22, 10), teamMat);
    teamBand.position.y = 6 + h * 0.48;
    bodyGroup.add(teamBand);

    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3;
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, h * 0.78, 10), lightSteelMat);
      tank.position.set(Math.cos(a) * r * 0.68, 6 + h * 0.39, Math.sin(a) * r * 0.68);
      tank.castShadow = !isGhost;
      bodyGroup.add(tank);
    }

    const piston = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.36, r * 0.36, h * 0.45, 14), greenMat);
    piston.position.y = 6 + h * 0.78;
    bodyGroup.add(piston);
    grp.userData.piston = piston;

  } else if (kind === 'barracks') {
    // Caserne Militaire 3D : hangar blindé, toit biseauté couleur équipe, sas lumineux et antenne
    const hull = new THREE.Mesh(new THREE.BoxGeometry(r * 1.65, h * 0.62, r * 1.38), steelMat);
    hull.position.y = 6 + h * 0.31;
    hull.castShadow = !isGhost;
    hull.receiveShadow = !isGhost;
    bodyGroup.add(hull);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(r * 1.42, h * 0.26, r * 1.12), teamMat);
    roof.position.y = 6 + h * 0.72;
    roof.castShadow = !isGhost;
    bodyGroup.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(r * 0.75, h * 0.42, 6), darkSteelMat);
    door.position.set(0, 6 + h * 0.21, r * 0.68);
    bodyGroup.add(door);

    const neon = new THREE.Mesh(new THREE.BoxGeometry(r * 0.85, 3.5, 4), yellowMat);
    neon.position.set(0, 6 + h * 0.48, r * 0.69);
    bodyGroup.add(neon);

    const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.5, 18, 6), lightSteelMat);
    ant.position.set(-r * 0.5, 6 + h * 0.92, -r * 0.35);
    bodyGroup.add(ant);

  } else if (kind === 'factory') {
    // Usine d'Armement 3D : double nef industrielle, cheminées, grue et cœur de fusion
    const baseH = new THREE.Mesh(new THREE.BoxGeometry(r * 1.72, h * 0.58, r * 1.56), darkSteelMat);
    baseH.position.y = 6 + h * 0.29;
    baseH.castShadow = !isGhost;
    baseH.receiveShadow = !isGhost;
    bodyGroup.add(baseH);

    for (const oz of [-r * 0.36, r * 0.36]) {
      const bay = new THREE.Mesh(new THREE.BoxGeometry(r * 1.52, h * 0.32, r * 0.58), teamMat);
      bay.position.set(0, 6 + h * 0.7, oz);
      bay.castShadow = !isGhost;
      bodyGroup.add(bay);
    }

    for (const ox of [-r * 0.55, r * 0.55]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(6, 7.5, h * 0.55, 10), steelMat);
      stack.position.set(ox, 6 + h * 0.82, -r * 0.45);
      stack.castShadow = !isGhost;
      bodyGroup.add(stack);
      const glowTop = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 3, 10), yellowMat);
      glowTop.position.set(ox, 6 + h * 1.1, -r * 0.45);
      bodyGroup.add(glowTop);
    }

  } else if (kind === 'turret') {
    // Tourelle Lance-Missiles 3D : bunker octogonal + tourelle rotative double-panier SAM
    const bunker = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.76, r * 0.92, h * 0.48, 8), steelMat);
    bunker.position.y = 6 + h * 0.24;
    bunker.castShadow = !isGhost;
    bodyGroup.add(bunker);

    const turretGrp = new THREE.Group();
    turretGrp.position.y = 6 + h * 0.56;
    const head = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 16), teamMat);
    head.castShadow = !isGhost;
    turretGrp.add(head);

    for (const oz of [-9.5, 9.5]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 7), darkSteelMat);
      pod.position.set(4, 2, oz);
      pod.castShadow = !isGhost;
      turretGrp.add(pod);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4, 8), getMat3D('#ff4b2b', 0.3, 0.2, 0xff4b2b, 0.5, op));
      tip.rotation.z = Math.PI / 2;
      tip.position.set(15, 2, oz);
      turretGrp.add(tip);
    }
    bodyGroup.add(turretGrp);
    grp.userData.turret = turretGrp;

  } else if (kind === 'tesla') {
    // Bobine Tesla 3D : socle blindé + 3 anneaux d'induction + sphère plasma en lévitation
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.85, h * 0.38, 8), darkSteelMat);
    ped.position.y = 6 + h * 0.19;
    ped.castShadow = !isGhost;
    bodyGroup.add(ped);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(4, 8, h * 0.72, 10), steelMat);
    spire.position.y = 6 + h * 0.52;
    spire.castShadow = !isGhost;
    bodyGroup.add(spire);

    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * (0.56 - k * 0.1), 2.2, 8, 20), cyanMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 6 + h * (0.42 + k * 0.18);
      bodyGroup.add(ring);
    }

    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(9.5, 1), cyanMat);
    orb.position.y = 6 + h * 0.96;
    bodyGroup.add(orb);
    grp.userData.rotPart = orb;

  } else if (kind === 'wall') {
    // Mur Bastion 3D
    const blk = new THREE.Mesh(new THREE.BoxGeometry(r * 1.75, h * 0.85, r * 1.75), lightSteelMat);
    blk.position.y = 6 + h * 0.42;
    blk.castShadow = !isGhost;
    blk.receiveShadow = !isGhost;
    bodyGroup.add(blk);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(r * 1.2, 5, r * 1.2), teamMat);
    cap.position.y = 6 + h * 0.88;
    bodyGroup.add(cap);

  } else if (kind === 'armory') {
    // Armurerie Tech 3D : dôme hexagonal blindé, consoles d'ingénierie, anneau holo et antenne radar rotative
    const baseHex = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 1.05, h * 0.52, 6), darkSteelMat);
    baseHex.position.y = 6 + h * 0.26;
    baseHex.castShadow = !isGhost;
    baseHex.receiveShadow = !isGhost;
    bodyGroup.add(baseHex);

    const midLab = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.68, r * 0.78, h * 0.36, 6), teamMat);
    midLab.position.y = 6 + h * 0.62;
    midLab.castShadow = !isGhost;
    bodyGroup.add(midLab);

    const ringHolo = new THREE.Mesh(new THREE.TorusGeometry(r * 0.52, 2.2, 8, 24), cyanMat);
    ringHolo.rotation.x = Math.PI / 2;
    ringHolo.position.y = 6 + h * 0.82;
    bodyGroup.add(ringHolo);

    const sensorGrp = new THREE.Group();
    sensorGrp.position.set(0, 6 + h * 0.82, 0);
    const dishPole = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 12, 8), lightSteelMat);
    dishPole.position.y = 6;
    sensorGrp.add(dishPole);
    const techDish = new THREE.Mesh(new THREE.CylinderGeometry(10, 3, 4, 12), yellowMat);
    techDish.position.y = 12;
    techDish.rotation.z = 0.45;
    sensorGrp.add(techDish);
    bodyGroup.add(sensorGrp);
    grp.userData.rotPart = sensorGrp;

  } else if (kind === 'starport') {
    // Spatioport Spatial 3D : grande dalle d'atterrissage, balises lumineuses, tour radar
    const padBase = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.1, h * 0.32, 8), darkSteelMat);
    padBase.position.y = 6 + h * 0.16;
    padBase.castShadow = !isGhost;
    padBase.receiveShadow = !isGhost;
    bodyGroup.add(padBase);

    const padDeck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.94, 4, 8), teamMat);
    padDeck.position.y = 6 + h * 0.34;
    padDeck.castShadow = !isGhost;
    padDeck.receiveShadow = !isGhost;
    bodyGroup.add(padDeck);

    const runway = new THREE.Mesh(new THREE.BoxGeometry(r * 1.2, 2.2, r * 0.32), yellowMat);
    runway.position.y = 6 + h * 0.36;
    bodyGroup.add(runway);

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, h * 0.7, 6), steelMat);
    tower.position.set(r * 0.6, 6 + h * 0.35, -r * 0.45);
    tower.castShadow = !isGhost;
    bodyGroup.add(tower);

    const radDome = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), cyanMat);
    radDome.position.set(r * 0.6, 6 + h * 0.72, -r * 0.45);
    bodyGroup.add(radDome);

    const sensorGrp = new THREE.Group();
    sensorGrp.position.set(r * 0.6, 6 + h * 0.78, -r * 0.45);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(8, 2, 3, 8), yellowMat);
    dish.rotation.z = 0.5;
    sensorGrp.add(dish);
    bodyGroup.add(sensorGrp);
    grp.userData.rotPart = sensorGrp;
  } else if (kind === 'radar') {
    // Tour de Détection 3D : socle hexagonal, mât en treillis, grande parabole rotative + balise
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 1.05, 10, 6), steelMat);
    base.position.y = 6 + 5;
    base.castShadow = !isGhost;
    bodyGroup.add(base);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, h * 0.82, 6), darkSteelMat);
      leg.position.set(Math.cos(a) * r * 0.32, 6 + h * 0.45, Math.sin(a) * r * 0.32);
      leg.rotation.set(Math.sin(a) * 0.09, 0, -Math.cos(a) * 0.09);
      leg.castShadow = !isGhost;
      bodyGroup.add(leg);
    }
    for (let k = 1; k <= 3; k++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(r * (0.36 - k * 0.04), 1.2, 6, 4), teamMat);
      band.rotation.x = Math.PI / 2;
      band.rotation.z = Math.PI / 4;
      band.position.y = 6 + h * (0.22 * k);
      bodyGroup.add(band);
    }
    const dishGrp = new THREE.Group();
    dishGrp.position.y = 6 + h * 0.9;
    const dish = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 16, 8, 0, TAU, 0, Math.PI * 0.32), lightSteelMat);
    dish.rotation.x = Math.PI / 2 + 0.5;
    dish.position.z = -3;
    dish.castShadow = !isGhost;
    dishGrp.add(dish);
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, r * 0.8, 6), darkSteelMat);
    feed.rotation.x = Math.PI / 2 - 0.5;
    feed.position.set(0, 3, 4);
    dishGrp.add(feed);
    bodyGroup.add(dishGrp);
    grp.userData.rotPart = dishGrp;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), cyanMat);
    beacon.position.y = 6 + h * 1.05;
    bodyGroup.add(beacon);
    grp.userData.beacon = beacon;
  }

  // Cage d'échafaudage 3D dorée visible pendant la construction par le VCS
  if (!isGhost) {
    const scaffGeo = new THREE.BoxGeometry(r * 1.75, h * 1.05, r * 1.75);
    const scaffMat = new THREE.MeshBasicMaterial({
      color: 0xffc531,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const scaffold = new THREE.Mesh(scaffGeo, scaffMat);
    scaffold.position.y = (h * 1.05) / 2 + 2;
    scaffold.visible = false;
    grp.add(scaffold);
    grp.userData.scaffold = scaffold;
  }

  // Ombre de contact : une auréole sombre et douce ancre le bâtiment dans le sol
  if (!isGhost) {
    if (!geoCache3D.contact) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const cg = cv.getContext('2d');
      const gr = cg.createRadialGradient(64, 64, 18, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      cg.fillStyle = gr; cg.fillRect(0, 0, 128, 128);
      geoCache3D.contact = new THREE.PlaneGeometry(1, 1);
      geoCache3D.contactMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false });
      geoCache3D.contactMat.userData.shared = true;
    }
    const disc = new THREE.Mesh(geoCache3D.contact, geoCache3D.contactMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.8;
    disc.scale.setScalar(r * 2.9);
    disc.renderOrder = -1;
    grp.add(disc);
  }

  grp.userData.bodyGroup = bodyGroup;
  grp.userData.color = color;
  grp.userData.kind = kind;
  return grp;
}

function createUnitMesh3D(kind, color) {
  const grp = new THREE.Group();
  const def = UNITS[kind] || UNITS.marine;
  const r = kind === 'scv' ? 10.2 : (def.radius || 12);

  const teamMat = getMat3D(color, 0.35, 0.35, color, 0.12);
  const darkTeamMat = getMat3D(shade(color, -0.35), 0.48, 0.42);
  const steelMat = getMat3D('#5a606e', 0.45, 0.58);
  const darkSteelMat = getMat3D('#232730', 0.6, 0.55);
  const lightSteelMat = getMat3D('#929aa8', 0.35, 0.5);
  const visorMat = getMat3D('#9be7ff', 0.15, 0.2, 0x3ecbff, 0.65);
  const yellowMat = getMat3D('#ffc531', 0.35, 0.3, 0xffc531, 0.35);
  const cyanMat = getMat3D('#1fc7c1', 0.2, 0.2, 0x1fc7c1, 0.8);
  const greenMat = getMat3D('#2fbf71', 0.2, 0.2, 0x2fbf71, 0.8);
  const redMat = getMat3D('#ff4b2b', 0.25, 0.2, 0xff4b2b, 0.75);

  if (kind === 'scv') {
    // Ouvrier VCS 3D : chenilles, châssis industriel jaune/équipe, arceau, pinces et cristal/gaz sur le dos
    for (const oz of [-r * 0.68, r * 0.68]) {
      const trk = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, 6, 4.5), darkSteelMat);
      trk.position.set(0, 3, oz);
      trk.castShadow = true;
      grp.add(trk);
    }
    const hull = new THREE.Mesh(new THREE.BoxGeometry(r * 1.45, 11, r * 1.25), teamMat);
    hull.position.y = 9.5;
    hull.castShadow = true;
    grp.add(hull);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(r * 0.85, 8, r * 0.9), yellowMat);
    cab.position.set(-1, 17, 0);
    cab.castShadow = true;
    grp.add(cab);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(4, 5, r * 0.72), visorMat);
    visor.position.set(r * 0.35, 17, 0);
    grp.add(visor);

    for (const oz of [-r * 0.48, r * 0.48]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 3.5, 3), steelMat);
      arm.position.set(r * 0.9, 8.5, oz);
      grp.add(arm);
    }

    const cargoMin = new THREE.Mesh(new THREE.OctahedronGeometry(6.5, 0), cyanMat);
    cargoMin.position.set(-r * 0.45, 22, 0);
    cargoMin.visible = false;
    grp.add(cargoMin);

    const cargoGas = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 10, 10), greenMat);
    cargoGas.position.set(-r * 0.45, 22, 0);
    cargoGas.visible = false;
    grp.add(cargoGas);

    const weldGlow = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 10), cyanMat);
    weldGlow.position.set(r * 1.35, 9, 0);
    weldGlow.visible = false;
    grp.add(weldGlow);

    grp.userData.cargoMin = cargoMin;
    grp.userData.cargoGas = cargoGas;
    grp.userData.weldGlow = weldGlow;

  } else if (kind === 'tank' || kind === 'siege') {
    // Char d'Assaut & Char de Siège 3D : doubles chenilles blindées, châssis incliné, stabilisateurs Siège & tourelle rotative
    const isSiege = kind === 'siege';
    for (const oz of [-r * 0.72, r * 0.72]) {
      const trk = new THREE.Mesh(new THREE.BoxGeometry(r * 2.05, 8.5, 7), darkSteelMat);
      trk.position.set(0, 4.25, oz);
      trk.castShadow = true;
      grp.add(trk);
    }
    const hull = new THREE.Mesh(new THREE.BoxGeometry(r * 1.75, 11, r * 1.32), darkTeamMat);
    hull.position.y = 10;
    hull.castShadow = true;
    grp.add(hull);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(r * 1.35, 4, r * 1.08), teamMat);
    deck.position.y = 16.5;
    grp.add(deck);

    if (isSiege) {
      const stabs = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 6), yellowMat);
        leg.position.set(Math.cos(a) * (r + 5), 3, Math.sin(a) * (r + 5));
        leg.rotation.y = -a;
        stabs.add(leg);
      }
      stabs.visible = false;
      grp.add(stabs);
      grp.userData.stabilizers = stabs;
    }

    const turretGrp = new THREE.Group();
    turretGrp.position.y = 20;
    const tBox = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.66, 9, 8), teamMat);
    tBox.castShadow = true;
    turretGrp.add(tBox);

    if (isSiege) {
      for (const oz of [-4.2, 4.2]) {
        const brl = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.4, r * 1.95, 10), steelMat);
        brl.rotation.z = -Math.PI / 2;
        brl.position.set(r * 0.95, 1.5, oz);
        brl.castShadow = true;
        turretGrp.add(brl);
      }
    } else {
      const brl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, r * 1.75, 10), darkSteelMat);
      brl.rotation.z = -Math.PI / 2;
      brl.position.set(r * 0.88, 1, 0);
      brl.castShadow = true;
      turretGrp.add(brl);
    }
    grp.add(turretGrp);
    grp.userData.turret = turretGrp;

  } else if (kind === 'titan') {
    // Titan Mécha Thor 3D : jambes articulées, torse blindé massif, pods lance-missiles d'épaule et doubles canons plasma
    for (const oz of [-r * 0.46, r * 0.46]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 11), darkSteelMat);
      foot.position.set(0, 3, oz);
      foot.castShadow = true;
      grp.add(foot);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.5, 18, 8), steelMat);
      leg.position.set(0, 14, oz);
      leg.castShadow = true;
      grp.add(leg);
    }

    const turretGrp = new THREE.Group();
    turretGrp.position.y = 26;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(r * 1.35, 18, r * 1.55), teamMat);
    torso.castShadow = true;
    turretGrp.add(torso);

    const core = new THREE.Mesh(new THREE.SphereGeometry(6.5, 12, 12), cyanMat);
    core.position.set(r * 0.55, 1, 0);
    turretGrp.add(core);

    for (const oz of [-r * 0.85, r * 0.85]) {
      const shPod = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 10), darkTeamMat);
      shPod.position.set(-2, 10, oz);
      shPod.castShadow = true;
      turretGrp.add(shPod);

      const armCannon = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.5, r * 1.7, 10), darkSteelMat);
      armCannon.rotation.z = -Math.PI / 2;
      armCannon.position.set(r * 0.85, -1, oz * 1.05);
      armCannon.castShadow = true;
      turretGrp.add(armCannon);

      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 4, 10), cyanMat);
      muzzle.rotation.z = -Math.PI / 2;
      muzzle.position.set(r * 1.68, -1, oz * 1.05);
      turretGrp.add(muzzle);
    }

    grp.add(turretGrp);
    grp.userData.turret = turretGrp;

  } else if (kind === 'dropship') {
    // Navette de Transport 3D : coque lourde, réacteurs jumeaux, cockpit, soute
    const hull = new THREE.Mesh(new THREE.BoxGeometry(r * 1.9, 10, r * 1.25), teamMat);
    hull.position.y = 5;
    hull.castShadow = true;
    grp.add(hull);

    const cockpit = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, 12, 6), visorMat);
    cockpit.rotation.z = -Math.PI / 2;
    cockpit.position.set(r * 0.95, 5, 0);
    grp.add(cockpit);

    for (const oz of [-r * 0.78, r * 0.78]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, r * 1.5, 8), darkSteelMat);
      eng.rotation.z = Math.PI / 2;
      eng.position.set(-2, 5, oz);
      eng.castShadow = true;
      grp.add(eng);

      const glow = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 2, 8), cyanMat);
      glow.rotation.z = Math.PI / 2;
      glow.position.set(-r * 0.78, 5, oz);
      grp.add(glow);
    }

    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38 });
    const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(r * 1.2, 16), shadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.5;
    grp.add(shadowDisc);
    grp.userData.shadowDisc = shadowDisc;

  } else if (kind === 'medivac') {
    // Navette Médicale 3D : cellule aérodynamique, croix médicale, propulseurs
    const hull = new THREE.Mesh(new THREE.ConeGeometry(r * 0.8, r * 2.2, 6), lightSteelMat);
    hull.rotation.z = -Math.PI / 2;
    hull.position.y = 5;
    hull.castShadow = true;
    grp.add(hull);

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 8, 8), visorMat);
    canopy.position.set(r * 0.35, 7, 0);
    grp.add(canopy);

    for (const oz of [-r * 0.85, r * 0.85]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, 2.5, r * 0.8), greenMat);
      wing.position.set(-2, 5, oz);
      wing.castShadow = true;
      grp.add(wing);

      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 8, 8), darkSteelMat);
      thruster.rotation.z = Math.PI / 2;
      thruster.position.set(-r * 0.4, 5, oz);
      grp.add(thruster);

      const tGlow = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 2, 8), greenMat);
      tGlow.rotation.z = Math.PI / 2;
      tGlow.position.set(-r * 0.82, 5, oz);
      grp.add(tGlow);
    }

    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38 });
    const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(r * 1.1, 16), shadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.5;
    grp.add(shadowDisc);
    grp.userData.shadowDisc = shadowDisc;

  } else {
    // Infanterie 3D (Marine, Maraudeur, Démolisseur) : armure CMC, épaulières, casque à visière et arme 3D
    const bodyGrp = new THREE.Group();
    const torsoH = kind === 'rocket' ? 15 : 13;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.52, torsoH, 10), teamMat);
    torso.position.y = torsoH * 0.5 + 2;
    torso.castShadow = true;
    bodyGrp.add(torso);

    // Épaulières blindées
    for (const oz of [-r * 0.68, r * 0.68]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(r * (kind === 'rocket' ? 0.52 : 0.42), 8, 8), darkTeamMat);
      pad.position.set(0, torsoH + 1, oz);
      pad.castShadow = true;
      bodyGrp.add(pad);
    }

    // Casque + visière lumineuse
    const helm = new THREE.Mesh(new THREE.SphereGeometry(r * 0.52, 10, 10), teamMat);
    helm.position.set(0, torsoH + 5, 0);
    helm.castShadow = true;
    bodyGrp.add(helm);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(r * 0.45, 3.8, r * 0.68), kind === 'sapper' ? yellowMat : visorMat);
    visor.position.set(r * 0.35, torsoH + 5, 0);
    bodyGrp.add(visor);

    if (kind === 'rocket') {
      for (const oz of [-r * 0.78, r * 0.78]) {
        const launcher = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, r * 1.45, 8), darkSteelMat);
        launcher.rotation.z = -Math.PI / 2;
        launcher.position.set(r * 0.55, torsoH - 1, oz);
        bodyGrp.add(launcher);
      }
    } else if (kind === 'sapper') {
      const bomb = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 12, 10), redMat);
      bomb.position.set(-r * 0.5, torsoH * 0.7, 0);
      bodyGrp.add(bomb);
    } else {
      const rifle = new THREE.Mesh(new THREE.BoxGeometry(r * 1.45, 3.2, 2.8), darkSteelMat);
      rifle.position.set(r * 0.65, torsoH * 0.72, r * 0.45);
      bodyGrp.add(rifle);
    }

    const stimRing = new THREE.Mesh(new THREE.RingGeometry(r * 0.95, r * 1.3, 18), redMat);
    stimRing.rotation.x = -Math.PI / 2;
    stimRing.position.y = 1.5;
    stimRing.visible = false;
    grp.add(stimRing);
    grp.userData.stimRing = stimRing;

    grp.add(bodyGrp);
    grp.userData.walkBody = bodyGrp;
  }

  grp.userData.color = color;
  grp.userData.kind = kind;
  return grp;
}

function syncAndRenderThree3D(dt, now, shX, shY) {
  if (!threeReady && !initThree3D()) return false;
  try {
    // Caméra 3D vue tactique à ~70° au-dessus du sol (inclinaison douce de 20° depuis le dessus)
    const pitchDeg = clamp(cam.pitch || 70, 25, 82);
    const pitchRad = (pitchDeg * Math.PI) / 180;
    const fovRad = (36 * Math.PI) / 180;
    const dist = (H / 2) / (cam.z * Math.tan(fovRad / 2));
    const camH = dist * Math.sin(pitchRad);
    const camZOffset = dist * Math.cos(pitchRad);

    threeCam.position.set(cam.x + shX, camH, cam.y + camZOffset + shY);
    threeCam.up.set(0, 1, 0);
    threeCam.lookAt(cam.x + shX, 0, cam.y + shY);
    threeCam.updateMatrixWorld();

    // Éclairage solaire dynamique aligné sur le centre de vision pour des ombres portées prononcées
    if (sunLight3D) {
      sunLight3D.position.set(cam.x - 650, 1800, cam.y + 800);
      sunLight3D.target.position.set(cam.x, 0, cam.y);
      sunLight3D.target.updateMatrixWorld();
    }

    // Brouillard atmosphérique au loin adaptatif selon la distance caméra
    if (threeScene.fog) {
      threeScene.fog.near = Math.max(650, dist * 0.9);
      threeScene.fog.far = Math.max(1800, dist * 2.85);
    }

    // Masquage tactique des arbres, rochers, monuments et ressources non encore explorés
    if (centerMonumentGroup3D) {
      centerMonumentGroup3D.visible = isExplored(HALF_W, HALF_W) ||
        isExplored(HALF_W - 180, HALF_W) || isExplored(HALF_W + 180, HALF_W) ||
        isExplored(HALF_W, HALF_W - 180) || isExplored(HALF_W, HALF_W + 180);
    }
    for (const t of treeMeshes3D) {
      t.grp.visible = isExplored(t.x, t.y);
    }
    for (const r of rockMeshes3D) {
      r.mesh.visible = isExplored(r.x, r.y);
    }
    // Les cristaux rapetissent à mesure qu'on les exploite et disparaissent une fois épuisés
    for (const m of mineralMeshes3D) {
      const left = state.mineralLeft ? state.mineralLeft[m.id] : null;
      const frac = left == null ? 1 : clamp(left / 1200, 0, 1.25);
      m.grp.visible = isExplored(m.x, m.y) && (left == null || left > 0);
      const sc = 0.45 + 0.55 * Math.min(1, frac);
      m.grp.scale.set(sc, sc, sc);
    }
    for (const g of geyserMeshes3D) {
      g.grp.visible = isExplored(g.x, g.y);
    }

    if (liquidMesh3D) {
      liquidMesh3D.position.y = -5 + Math.sin(now * 0.0012) * 0.7;
      if (liquidMesh3D.userData.lava) liquidMesh3D.material.emissiveIntensity = 0.85 + Math.sin(now * 0.002) * 0.15;
    }

    // Animation des cristaux de minéraux et geysers de gaz plasma
    for (const m of mineralMeshes3D) {
      if (m.grp.visible) {
        m.grp.position.y = (m.baseY || 4) + Math.sin(now * 0.0035 + m.seed) * 1.2;
      }
    }
    for (const g of geyserMeshes3D) {
      if (g.grp.visible) {
        const s = 0.88 + Math.sin(now * 0.006 + g.seed) * 0.18;
        g.core.scale.set(s, s * 0.7, s);
      }
    }

    // Synchronisation des Bâtiments 3D
    const activeBldIds = new Set();
    for (const b of state.buildings) {
      if (b.hp <= 0) continue;
      const vis = b.owner === myId || isVisibleToMe(b.x, b.y);
      activeBldIds.add(b.id);
      const owner = state.players.find((p) => p.id === b.owner);
      const col = owner ? pc(owner) : '#888888';

      let mesh = bldMeshes3D.get(b.id);
      if (!mesh || mesh.userData.kind !== b.kind || mesh.userData.color !== col) {
        disposeObject3D(mesh);
        mesh = createBuildingMesh3D(b.kind, col, false);
        threeScene.add(mesh);
        bldMeshes3D.set(b.id, mesh);
      }

      mesh.visible = vis;
      if (!vis) continue;
      mesh.position.set(b.x, heightAt(b.x, b.y) - 1, b.y);
      if (mesh.userData.beacon) mesh.userData.beacon.visible = !b.constructing && Math.floor(now / 420) % 2 === 0;

      const prog = b.constructing ? clamp(b.buildProg || 0.06, 0.06, 1) : 1;
      if (mesh.userData.bodyGroup) {
        mesh.userData.bodyGroup.scale.set(1, b.constructing ? 0.15 + 0.85 * prog : 1, 1);
      }
      if (mesh.userData.scaffold) {
        mesh.userData.scaffold.visible = !!b.constructing;
        if (b.constructing) mesh.userData.scaffold.rotation.y = now * 0.0012;
      }
      if (mesh.userData.rotPart && !b.constructing) {
        mesh.userData.rotPart.rotation.y = now * 0.0022;
      }
      if (mesh.userData.piston && !b.constructing) {
        mesh.userData.piston.position.y = 26 + Math.sin(now * 0.006 + b.id) * 4;
      }
      if (mesh.userData.turret) {
        mesh.userData.turret.rotation.y = -(b.aimA || 0);
      }
    }
    for (const [id, mesh] of bldMeshes3D.entries()) {
      if (!activeBldIds.has(id)) {
        disposeObject3D(mesh);
        bldMeshes3D.delete(id);
      }
    }

    // Connexions 3D entre Murs voisins
    while (wallBeamsGroup3D.children.length > 0) {
      wallBeamsGroup3D.remove(wallBeamsGroup3D.children[0]);
    }
    const walls = state.buildings.filter((b) => b.kind === 'wall' && b.hp > 0 && (b.owner === myId || isVisibleToMe(b.x, b.y)));
    if (walls.length > 1) {
      if (!geoCache3D.wallBox) geoCache3D.wallBox = new THREE.BoxGeometry(1, 16, 10);
      const wallBeamMat = getMat3D('#929aa8', 0.4, 0.5);
      for (let i = 0; i < walls.length; i++) {
        for (let j = i + 1; j < walls.length; j++) {
          const w1 = walls[i], w2 = walls[j];
          if (w1.team === w2.team) {
            const d = hypot(w1.x, w1.y, w2.x, w2.y);
            if (d > 8 && d <= 58) {
              const beam = new THREE.Mesh(geoCache3D.wallBox, wallBeamMat);
              beam.scale.set(d, 1, 1);
              beam.position.set((w1.x + w2.x) * 0.5, 11 + heightAt((w1.x + w2.x) * 0.5, (w1.y + w2.y) * 0.5), (w1.y + w2.y) * 0.5);
              beam.rotation.y = -Math.atan2(w2.y - w1.y, w2.x - w1.x);
              beam.castShadow = true;
              wallBeamsGroup3D.add(beam);
            }
          }
        }
      }
    }

    // Synchronisation des Unités 3D
    const activeUnitIds = new Set();
    const healLinks = [];
    for (const u of state.units) {
      if (u.hp <= 0 || u.boardedIn) continue;
      const vis = u.owner === myId || isVisibleToMe(u.x, u.y);
      activeUnitIds.add(u.id);
      const owner = state.players.find((p) => p.id === u.owner);
      const col = owner ? pc(owner) : '#888888';

      let mesh = unitMeshes3D.get(u.id);
      if (!mesh || mesh.userData.kind !== u.kind || mesh.userData.color !== col) {
        disposeObject3D(mesh);
        mesh = createUnitMesh3D(u.kind, col);
        threeScene.add(mesh);
        unitMeshes3D.set(u.id, mesh);
      }

      mesh.visible = vis;
      if (!vis) continue;

      const isFly = !!u.flying;
      const hoverY = isFly ? (42 + Math.sin(now * 0.003 + u.id) * 3) : 0;
      mesh.position.set(u.x, heightAt(u.x, u.y) + hoverY, u.y);
      if (mesh.userData.shadowDisc) {
        mesh.userData.shadowDisc.position.y = -hoverY + 0.5;
      }

      if (u.kind === 'medivac' && u.healingTargetId) {
        const ally = state.units.find((a) => a.id === u.healingTargetId && a.hp > 0 && !a.boardedIn);
        // Dessiné plus bas, après le nettoyage du groupe d'effets (avant, il était effacé avant d'être affiché)
        if (ally) healLinks.push([u.x, heightAt(u.x, u.y) + hoverY + 2, u.y, ally.x, heightAt(ally.x, ally.y) + (ally.kind === 'titan' ? 24 : 10), ally.y]);
      }

      if (u.kind === 'tank' || u.kind === 'siege' || u.kind === 'titan') {
        const moveA = (Math.abs(u.vx || 0) + Math.abs(u.vy || 0) > 2) ? Math.atan2(u.vy, u.vx) : (u.a || 0);
        mesh.rotation.y = -moveA;
        if (mesh.userData.turret) {
          mesh.userData.turret.rotation.y = -(u.a || 0) + moveA;
        }
        if (mesh.userData.stabilizers) {
          mesh.userData.stabilizers.visible = !!u.sieged;
        }
      } else {
        mesh.rotation.y = -(u.a || 0);
        if (mesh.userData.walkBody) {
          const moving = (Math.abs(u.vx || 0) + Math.abs(u.vy || 0)) > 4;
          mesh.userData.walkBody.position.y = moving ? Math.abs(Math.sin(now * 0.015 + u.id)) * 2.2 : 0;
        }
        if (mesh.userData.stimRing) {
          mesh.userData.stimRing.visible = (u.stimT || 0) > 0;
        }
        if (u.kind === 'scv') {
          if (mesh.userData.cargoMin) mesh.userData.cargoMin.visible = u.carryAmt > 0 && u.carryType === 'min';
          if (mesh.userData.cargoGas) mesh.userData.cargoGas.visible = u.carryAmt > 0 && u.carryType === 'gas';
          if (mesh.userData.weldGlow) {
            const welding = !!(u.onSite && u.buildTargetId);
            mesh.userData.weldGlow.visible = welding && ((Math.floor(now / 50) + u.id) % 2 === 0);
          }
        }
      }
    }
    for (const [id, mesh] of unitMeshes3D.entries()) {
      if (!activeUnitIds.has(id)) {
        disposeObject3D(mesh);
        unitMeshes3D.delete(id);
      }
    }

    // Aperçu fantôme 3D du bâtiment à poser (uniquement quand un VCS est sélectionné)
    if (buildMode) {
      const def = BUILDINGS[buildMode];
      const check = canPlaceBuilding(state, myId, buildMode, mouse.wx, mouse.wy);
      const gx = check.snapX ?? mouse.wx, gy = check.snapY ?? mouse.wy;
      const ghostCol = check.ok ? '#2fbf71' : '#ff4b2b';
      const ghostKey = `${buildMode}|${ghostCol}`;
      if (!ghostGroup3D || ghostKind3D !== ghostKey) {
        disposeObject3D(ghostGroup3D);
        ghostGroup3D = createBuildingMesh3D(buildMode, ghostCol, true);
        threeScene.add(ghostGroup3D);
        ghostKind3D = ghostKey;
      }
      ghostGroup3D.visible = true;
      ghostGroup3D.position.set(gx, heightAt(gx, gy), gy);
    } else if (ghostGroup3D) {
      ghostGroup3D.visible = false;
    }

    // Projectiles, Rayons Tesla/Laser, Ondes de choc et Particules en 3D
    while (fxGroup3D.children.length > 0) {
      fxGroup3D.remove(fxGroup3D.children[0]);
    }
    if (!geoCache3D.proj) {
      geoCache3D.proj = new THREE.SphereGeometry(1, 8, 8);
      geoCache3D.ring = new THREE.RingGeometry(0.86, 1.0, 24);
      geoCache3D.beamCyl = new THREE.CylinderGeometry(1, 1, 1, 6);
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.prog += pr.speed * dt;
      if (pr.prog >= 1) { projectiles.splice(i, 1); continue; }
      const px = lerp(pr.x, pr.tx, pr.prog), py = lerp(pr.y, pr.ty, pr.prog);
      const arcH = lerp(heightAt(pr.x, pr.y), heightAt(pr.tx, pr.ty), pr.prog) + 14 + Math.sin(pr.prog * Math.PI) * 16;
      const pm = new THREE.Mesh(geoCache3D.proj, getMat3D(pr.color, 0.1, 0.1, pr.color, 0.95));
      pm.position.set(px, arcH, py);
      pm.scale.setScalar(pr.r * 1.15);
      fxGroup3D.add(pm);
    }
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) { shockwaves.splice(i, 1); continue; }
      const u = 1 - sw.life / sw.maxLife;
      const rad = lerp(sw.r, sw.maxR, u);
      const rm = new THREE.Mesh(geoCache3D.ring, getMat3D(sw.color, 0.2, 0.1, sw.color, 0.85, 1 - u));
      rm.rotation.x = -Math.PI / 2;
      rm.position.set(sw.x, heightAt(sw.x, sw.y) + 3.5, sw.y);
      rm.scale.setScalar(rad);
      fxGroup3D.add(rm);
    }
    for (let i = beams.length - 1; i >= 0; i--) {
      const bm = beams[i];
      bm.life -= dt;
      if (bm.life <= 0) { beams.splice(i, 1); continue; }
      const d = hypot(bm.x1, bm.y1, bm.x2, bm.y2);
      const beamMesh = new THREE.Mesh(
        geoCache3D.beamCyl,
        getMat3D(bm.color, 0.1, 0.1, bm.color, 0.95, clamp(bm.life / bm.maxLife, 0, 1))
      );
      beamMesh.scale.set(bm.w * 0.35, d, bm.w * 0.35);
      beamMesh.position.set((bm.x1 + bm.x2) * 0.5, 22 + heightAt((bm.x1 + bm.x2) * 0.5, (bm.y1 + bm.y2) * 0.5), (bm.y1 + bm.y2) * 0.5);
      beamMesh.rotation.z = Math.PI / 2;
      beamMesh.rotation.y = -Math.atan2(bm.y2 - bm.y1, bm.x2 - bm.x1);
      fxGroup3D.add(beamMesh);
    }
    // Rayons nanites des Navettes Médicales : un tube vert qui pulse
    for (const [x1, y1, z1, x2, y2, z2] of healLinks) {
      const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1) || 1;
      const ray = new THREE.Mesh(geoCache3D.beamCyl, getMat3D('#2fbf71', 0.2, 0.1, '#2fbf71', 1.1, 0.55 + 0.25 * Math.sin(now * 0.012)));
      ray.scale.set(1.6, len, 1.6);
      ray.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      ray.quaternion.setFromUnitVectors(UP_3D, tmpVec3D.set(x2 - x1, y2 - y1, z2 - z1).normalize());
      fxGroup3D.add(ray);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const pm = new THREE.Mesh(geoCache3D.proj, getMat3D(p.color, 0.2, 0.1, p.color, 0.8));
      pm.position.set(p.x, heightAt(p.x, p.y) + 10 + p.life * 28, p.y);
      pm.scale.setScalar(p.r * 0.85);
      fxGroup3D.add(pm);
    }

    updateFlashes3D(dt);
    renderFrame3D();
    return true;
  } catch (err) {
    console.error('3D render error, fallback to 2D:', err);
    threeReady = false;
    if (c3d) c3d.style.display = 'none';
    return false;
  }
}
