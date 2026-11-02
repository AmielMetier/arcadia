// Scène 3D Dogfight : rendu Three.js, île 3D Island Rush, base aérienne militaire, végétation instanciée,
// nuages volumétriques, océan avec reflets spéculaires et caméra de poursuite dynamique.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { buildF16Model } from './plane.js';
import { FxManager } from './fx.js';

export class DogfightScene {
  constructor(container, map) {
    this.container = container;
    this.map = map;

    // 1. Moteur de rendu WebGL
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // 2. Scène & Caméra
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x82b8e8); // Ciel azur
    this.scene.fog = new THREE.FogExp2(0x9cc8ed, 0.00032); // Brume atmosphérique douce

    this.camera = new THREE.PerspectiveCamera(
      72,
      this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight,
      0.5,
      7000
    );

    // 3. Éclairage solaire et hémisphérique
    const hemiLight = new THREE.HemisphereLight(0xdff0ff, 0x3d5a80, 0.7);
    this.scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff3e0, 2.1);
    sun.position.set(-450, 850, -550).normalize();
    this.scene.add(sun);
    this.sunDir = sun.position.clone();

    // 4. Construction de l'univers 3D (relief, base militaire, végétation, ciel, mer)
    this.buildSkyDome();
    this.buildOcean();
    this.buildTerrain(map);
    this.buildAirbase(map);
    this.buildVegetation(map);

    // 5. Gestionnaire d'effets visuels (traçantes Vulcan, fumée, explosions, condensation)
    this.fx = new FxManager(this.scene);

    // 6. Dictionnaire des modèles de chasseurs 3D
    this.planeModels = new Map();

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // Construit le dôme céleste avec dégradé d'altitude, disque solaire et nuages
  buildSkyDome() {
    const radius = 5500;
    const skyGeo = new THREE.SphereGeometry(radius, 24, 16);
    const pos = skyGeo.attributes.position;
    const count = pos.count;
    const colors = new Float32Array(count * 3);

    const cZenith = new THREE.Color(0x133868);   // Bleu nuit aérospatial
    const cMid = new THREE.Color(0x3b82f6);      // Bleu ciel pur
    const cHorizon = new THREE.Color(0x99ccf0);  // Azur brumeux horizon
    const cNadir = new THREE.Color(0x0e243f);    // Profondeurs sous la mer

    for (let i = 0; i < count; i++) {
      const y = pos.getY(i) / radius;
      let c = new THREE.Color();
      if (y > 0.4) {
        c.lerpColors(cMid, cZenith, (y - 0.4) / 0.6);
      } else if (y >= 0) {
        c.lerpColors(cHorizon, cMid, y / 0.4);
      } else {
        c.lerpColors(cHorizon, cNadir, -y);
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const skyMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.position.set(800, 0, 800);
    this.scene.add(skyDome);

    // Disque solaire éclatant
    const sunGeo = new THREE.CircleGeometry(180, 16);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfffae0,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sunDisc = new THREE.Mesh(sunGeo, sunMat);
    const sunPos = this.sunDir.clone().multiplyScalar(4600).add(new THREE.Vector3(800, 0, 800));
    sunDisc.position.copy(sunPos);
    sunDisc.lookAt(800, 0, 800);
    this.scene.add(sunDisc);

    // Cumulus : des paquets de sprites doux (texture dessinée au canvas), plus clairs en haut, gris dessous
    const cloudTex = makeCloudTexture();
    const cloudMats = [0.62, 0.78, 0.92, 1.0].map((k) => new THREE.SpriteMaterial({
      map: cloudTex,
      color: new THREE.Color(k, k, Math.min(1, k * 1.04)),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      fog: true,
    }));
    this.clouds = new THREE.Group();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let c = 0; c < 46; c++) {
      const cx = -900 + rnd() * 3400;
      const cz = -900 + rnd() * 3400;
      const cy = 300 + rnd() * 260;
      const size = 60 + rnd() * 90;
      const puffs = 6 + Math.floor(rnd() * 7);
      for (let i = 0; i < puffs; i++) {
        const dy = (rnd() - 0.3) * size * 0.45;
        const level = Math.max(0, Math.min(3, Math.floor(((dy / (size * 0.45)) + 0.5) * 4)));
        const sp = new THREE.Sprite(cloudMats[level]);
        const k = size * (0.9 + rnd() * 0.9);
        sp.scale.set(k * 1.6, k, 1);
        sp.position.set(cx + (rnd() - 0.5) * size * 2.6, cy + dy, cz + (rnd() - 0.5) * size * 1.8);
        this.clouds.add(sp);
      }
    }
    this.scene.add(this.clouds);
  }

  // Océan avec reflets spéculaires et lagon côtier turquoise
  buildOcean() {
    const waterGeo = new THREE.PlaneGeometry(16000, 16000);
    waterGeo.rotateX(-Math.PI / 2);
    waterGeo.translate(800, 0, 800);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0f3e6d,
      roughness: 0.16,
      metalness: 0.8,
      transparent: true,
      opacity: 0.9,
    });

    const ocean = new THREE.Mesh(waterGeo, waterMat);
    this.scene.add(ocean);

    // Lagon turquoise translucide entourant les côtes de l'île
    const lagoonGeo = new THREE.PlaneGeometry(1750, 1750);
    lagoonGeo.rotateX(-Math.PI / 2);
    lagoonGeo.translate(800, 0.35, 800);

    const lagoonMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      roughness: 0.25,
      metalness: 0.5,
      transparent: true,
      opacity: 0.32,
    });

    const lagoon = new THREE.Mesh(lagoonGeo, lagoonMat);
    this.scene.add(lagoon);
  }

  // Relief 3D de l'île avec textures de pente et d'altitude (plages, vallées, falaises, sommets)
  buildTerrain(map) {
    if (!map) return;

    const N = map.n; // 800
    const size = map.size; // 1600 m

    const step = 4;
    const gridPoints = Math.floor(N / step);
    const geo = new THREE.PlaneGeometry(size, size, gridPoints - 1, gridPoints - 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(size / 2, 0, size / 2);

    const pos = geo.attributes.position;
    const count = pos.count;
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = map.heightAt(x, z);
      pos.setY(i, h);

      // Dégradé d'altitude fondu : sable, prairie, forêt, roche, neige, avec la pente et un peu de bruit
      const e = 6;
      const slope = Math.min(1, (Math.abs(map.heightAt(x + e, z) - map.heightAt(x - e, z)) + Math.abs(map.heightAt(x, z + e) - map.heightAt(x, z - e))) / (2 * e) / 0.9);
      const n = Math.sin(x * 0.043) * Math.cos(z * 0.037) * 0.5 + Math.sin(x * 0.11 + z * 0.09) * 0.25;
      const mix = (c1, c2, t) => { t = Math.max(0, Math.min(1, t)); return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t]; };
      const SAND = [0.86, 0.79, 0.58];
      const GRASS = [0.36 + n * 0.04, 0.58 + n * 0.05, 0.25];
      const FOREST = [0.2, 0.4, 0.18];
      const ROCK = [0.47, 0.45, 0.42];
      const SNOW = [0.95, 0.96, 0.98];
      let c = mix(SAND, GRASS, (h - 1.2) / 3);
      c = mix(c, FOREST, (h - 14 + n * 6) / 14);
      c = mix(c, ROCK, Math.max((h - 34 + n * 8) / 12, (slope - 0.45) / 0.3));
      c = mix(c, SNOW, (h - 66 + n * 6) / 8);
      if (h < 0.6) c = mix(c, [0.55, 0.62, 0.55], 0.6); // fonds sous l'eau peu profonde
      let r = c[0], g = c[1], b = c[2];

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.08,
    });

    const terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);
  }

  // Base militaire avec piste d'atterrissage asphaltée, marquages blancs, hangars et tour de contrôle
  buildAirbase(map) {
    const baseGroup = new THREE.Group();
    const runwayY = 7.3;

    // 1. Piste en asphalte sombre (longueur 380m, largeur 34m)
    const rwGeo = new THREE.PlaneGeometry(380, 34);
    rwGeo.rotateX(-Math.PI / 2);
    const rwMat = new THREE.MeshStandardMaterial({
      color: 0x222629,
      roughness: 0.9,
      metalness: 0.1,
    });
    const runway = new THREE.Mesh(rwGeo, rwMat);
    runway.position.set(700, runwayY, 800);
    baseGroup.add(runway);

    // 2. Marquages blancs pointillés au centre de la piste
    const dashCount = 14;
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    for (let i = 0; i < dashCount; i++) {
      const dashGeo = new THREE.PlaneGeometry(14, 1.8);
      dashGeo.rotateX(-Math.PI / 2);
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(530 + i * 26, runwayY + 0.05, 800);
      baseGroup.add(dash);
    }

    // 3. Deux grands hangars d'aviation
    const hangarMat = new THREE.MeshStandardMaterial({
      color: 0x5a6572,
      roughness: 0.65,
      metalness: 0.4,
    });
    for (let h = 0; h < 2; h++) {
      const hGeo = new THREE.CylinderGeometry(14, 14, 45, 16, 1, false, 0, Math.PI);
      hGeo.rotateZ(Math.PI / 2);
      const hangar = new THREE.Mesh(hGeo, hangarMat);
      hangar.position.set(650 + h * 60, runwayY, 760);
      baseGroup.add(hangar);
    }

    // 4. Tour de contrôle avec antenne radar
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x8a929a, roughness: 0.5 });
    const towerBaseGeo = new THREE.CylinderGeometry(4.5, 6, 26, 8);
    const towerBase = new THREE.Mesh(towerBaseGeo, towerMat);
    towerBase.position.set(560, runwayY + 13, 760);
    baseGroup.add(towerBase);

    // Vigie vitrée
    const cabGeo = new THREE.CylinderGeometry(7, 5.5, 6, 8);
    const cabMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.1,
      metalness: 0.8,
    });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(560, runwayY + 28, 760);
    baseGroup.add(cab);

    // Balise rouge clignotante au sommet
    const beaconGeo = new THREE.SphereGeometry(0.8, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });
    this.controlBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.controlBeacon.position.set(560, runwayY + 32, 760);
    baseGroup.add(this.controlBeacon);

    this.scene.add(baseGroup);
  }

  // Végétation instanciée (pins et sapins alpins répartis sur les versants de l'île)
  buildVegetation(map) {
    if (!map) return;

    // Géométrie d'un conifère stylisé low-poly (un tronc + 2 cônes)
    const treeGeo = new THREE.ConeGeometry(3.2, 8.5, 5);
    treeGeo.translate(0, 5, 0);
    const treeMat = new THREE.MeshStandardMaterial({
      color: 0x1f4728, // Vert forêt profond
      roughness: 0.85,
      metalness: 0.05,
    });

    const maxTrees = 450;
    const instancedTrees = new THREE.InstancedMesh(treeGeo, treeMat, maxTrees);
    const dummy = new THREE.Object3D();
    let placed = 0;

    // Échantillonnage déterministe pour peupler les zones vertes
    for (let i = 0; i < 900 && placed < maxTrees; i++) {
      const rx = 200 + ((i * 137.5) % 1200);
      const rz = 200 + ((i * 249.3) % 1200);
      const h = map.heightAt(rx, rz);

      // On plante des arbres uniquement sur les prairies et collines (3m à 38m)
      // et loin de la piste d'atterrissage
      const distToRunway = Math.hypot(rx - 700, rz - 800);
      if (h > 2.5 && h < 38 && distToRunway > 80) {
        dummy.position.set(rx, h, rz);
        const scale = 0.75 + ((i % 5) * 0.12);
        dummy.scale.set(scale, scale * (0.9 + Math.random() * 0.2), scale);
        dummy.rotation.y = (i * 0.7);
        dummy.updateMatrix();
        instancedTrees.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }

    instancedTrees.count = placed;
    instancedTrees.instanceMatrix.needsUpdate = true;
    instancedTrees.receiveShadow = true;
    this.scene.add(instancedTrees);
  }

  // Synchronise les modèles 3D d'avions avec l'état de jeu
  syncPlanes(planes) {
    const currentIds = new Set(planes.map((p) => p.id));
    for (const [id, model] of this.planeModels.entries()) {
      if (!currentIds.has(id)) {
        this.scene.remove(model.root);
        this.planeModels.delete(id);
      }
    }

    for (const p of planes) {
      let model = this.planeModels.get(p.id);
      if (!model) {
        const hexColor = parseInt(p.color.replace('#', '0x'), 16) || 0x2563eb;
        model = buildF16Model({ color: hexColor });
        this.scene.add(model.root);
        this.planeModels.set(p.id, model);
      }

      model.root.visible = p.alive;
      if (p.alive) {
        model.root.position.set(p.flight.x, p.flight.y, p.flight.z);

        // Orientation 3D de l'avion à partir des vecteurs tri-orthonormés
        const rotMat = new THREE.Matrix4().makeBasis(
          new THREE.Vector3(p.flight.rightX, p.flight.rightY, p.flight.rightZ),
          new THREE.Vector3(p.flight.upX, p.flight.upY, p.flight.upZ),
          new THREE.Vector3(p.flight.forwardX, p.flight.forwardY, p.flight.forwardZ)
        );
        model.root.quaternion.setFromRotationMatrix(rotMat);

        // Flamme de postcombustion (Afterburner)
        model.setBoosting(p.flight.boosting);
      }
    }
  }

  // Caméra de poursuite dynamique (Chase Cam) derrière le joueur avec lissage fluide et stabilisation d'horizon
  updateCamera(myPlane, dt) {
    if (!myPlane || !myPlane.alive) return;

    // Position idéale : 14.5 m derrière, 3.6 m au-dessus
    // Lors du boost, la caméra recule légèrement pour donner l'impression d'accélération
    const distBehind = myPlane.flight.boosting ? 16.5 : (myPlane.flight.braking ? 13.0 : 14.5);
    const heightAbove = 3.6;

    const targetCamX = myPlane.flight.x - myPlane.flight.forwardX * distBehind + myPlane.flight.upX * heightAbove;
    const targetCamY = myPlane.flight.y - myPlane.flight.forwardY * distBehind + myPlane.flight.upY * heightAbove;
    const targetCamZ = myPlane.flight.z - myPlane.flight.forwardZ * distBehind + myPlane.flight.upZ * heightAbove;

    const lerpPos = Math.min(1.0, 7.5 * dt);
    if (!this.cameraInitialized) {
      this.cameraInitialized = true;
      this.camera.position.set(targetCamX, targetCamY, targetCamZ);
    } else {
      // Amortissement de la position caméra : léger retard naturel
      this.camera.position.x += (targetCamX - this.camera.position.x) * lerpPos;
      this.camera.position.y += (targetCamY - this.camera.position.y) * lerpPos;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * lerpPos;
    }

    // Point de visée devant l'avion
    const lookAtX = myPlane.flight.x + myPlane.flight.forwardX * 45;
    const lookAtY = myPlane.flight.y + myPlane.flight.forwardY * 45;
    const lookAtZ = myPlane.flight.z + myPlane.flight.forwardZ * 45;
    this.camera.lookAt(lookAtX, lookAtY, lookAtZ);

    // Orientation de roulis de la caméra : STABILISÉE SUR L'HORIZON !
    // Au lieu de figer la caméra sur le roulis de l'avion (ce qui donnait l'illusion d'une image fixe),
    // la caméra garde l'horizon et suit seulement 28% de l'inclinaison.
    // Le joueur voit ainsi directement l'avion s'incliner, virer et réagir en 3D !
    const worldUp = new THREE.Vector3(0, 1, 0);
    const planeUp = new THREE.Vector3(myPlane.flight.upX, myPlane.flight.upY, myPlane.flight.upZ);
    const desiredCamUp = worldUp.clone().lerp(planeUp, 0.28).normalize();
    this.camera.up.lerp(desiredCamUp, Math.min(1.0, 8.0 * dt));

    // FOV dynamique lors de la postcombustion (effet de vitesse)
    const targetFov = myPlane.flight.boosting ? 84 : 72;
    this.camera.fov += (targetFov - this.camera.fov) * lerpPos;
    this.camera.updateProjectionMatrix();
  }

  render(state, myPlaneId, dt) {
    if (!state) return;

    this.syncPlanes(state.planes);

    const myPlane = state.planes.find((p) => p.id === myPlaneId);
    this.updateCamera(myPlane, dt);

    // Balise clignotante de la base aérienne
    if (this.controlBeacon) {
      this.controlBeacon.visible = Math.sin(Date.now() * 0.006) > 0;
    }

    // Traitement des événements visuels (explosions, flashes de canon)
    if (state.events && state.events.length > 0) {
      for (const ev of state.events) {
        if (ev.type === 'kill' || ev.type === 'crash') {
          this.fx.createExplosion(ev.x, ev.y, ev.z);
        } else if (ev.type === 'fire') {
          const model = this.planeModels.get(ev.ownerId);
          if (model) model.triggerMuzzleFlash();
        }
      }
    }

    this.fx.update(dt, state.planes);
    this.renderer.render(this.scene, this.camera);
  }
}

// Texture de cumulus : plusieurs disques flous superposés
function makeCloudTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 22; i++) {
    const x = S * (0.25 + rnd() * 0.5);
    const y = S * (0.3 + rnd() * 0.4);
    const r = S * (0.12 + rnd() * 0.16);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
