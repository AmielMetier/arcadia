// The Backrooms - Scène 3D Three.js, rendu du Level 0 et entité
// L'éclairage des néons est « cuit » dans une petite texture (une valeur par case) lue en coordonnées monde par tous les
// matériaux : des centaines de néons pour le prix d'aucune lumière. Seuls la lampe torche, les cassettes et la sortie
// sont de vraies lumières. L'image finale passe par le filtre de vieille caméra (vhs.js).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';
import { CELL_SIZE, WALL_HEIGHT, T, PROP_KINDS } from '../engine/map.js';
import { createBackroomsTextures } from './textures.js';
import { createVhsFilter } from './vhs.js';

const MODELS = new URL('../../mystery/models/meubles/', import.meta.url).href;
export const ENTITY_IMG = new URL('../img/entite.png?v=2', import.meta.url).href; // ?v : image plus nette, ne pas garder l'ancienne en cache

const LIGHT_R = 2.6; // portée d'un néon, en cases
const AMBIENT = 0.015; // lumière minimale dans les zones mortes

export function createBackroomsScene(container, map) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d0b06');
  scene.fog = new THREE.FogExp2('#14110a', 0.05);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 90);
  camera.position.set(map.spawn.x, 1.6, map.spawn.z);

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  container.appendChild(renderer.domElement);
  const vhs = createVhsFilter(renderer);
  vhs.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

  const textures = createBackroomsTextures();

  // --- Éclairage cuit des néons ---
  const W = map.W;
  const H = map.H;
  const base = new Float32Array(W * H);
  const live = new Float32Array(W * H);
  const bakeData = new Uint8Array(W * H * 4);
  const bakeTex = new THREE.DataTexture(bakeData, W, H, THREE.RGBAFormat);
  bakeTex.magFilter = THREE.LinearFilter;
  bakeTex.minFilter = THREE.LinearFilter;
  const bakeUniforms = {
    uBake: { value: bakeTex },
    uBakeScale: { value: new THREE.Vector2(1 / (W * CELL_SIZE), 1 / (H * CELL_SIZE)) },
    uBakeTint: { value: new THREE.Color(1.15, 1.05, 0.78) },
  };
  const R = Math.ceil(LIGHT_R);
  const addLight = (arr, l, k) => {
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = l.gx + dx;
        const z = l.gz + dz;
        if (x < 0 || x >= W || z < 0 || z >= H) continue;
        const d = Math.hypot(dx, dz);
        if (d > LIGHT_R) continue;
        arr[z * W + x] += k * Math.pow(1 - d / LIGHT_R, 1.4) * 0.55;
      }
    }
  };
  for (const l of map.lights) if (l.state === 'on') addLight(base, l, 1);
  const flickers = map.lights.filter((l) => l.state === 'flicker').map((l) => ({ l, k: 1 }));
  const writeBake = () => {
    live.set(base);
    for (const f of flickers) if (f.k > 0) addLight(live, f.l, f.k);
    for (let i = 0; i < W * H; i++) {
      const v = Math.min(1, AMBIENT + live[i] * 0.36); // stocké à moitié : jusqu'à 2 de lumière
      bakeData[i * 4] = Math.round(v * 255);
    }
    bakeTex.needsUpdate = true;
  };
  writeBake();

  // ajoute la lumière cuite à un matériau Lambert
  const baked = (mat) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, bakeUniforms);
      sh.vertexShader = 'varying vec2 vBakeXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 bakeWP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          bakeWP = instanceMatrix * bakeWP;
        #endif
        vBakeXZ = (modelMatrix * bakeWP).xz;`);
      sh.fragmentShader = 'uniform sampler2D uBake;\nuniform vec2 uBakeScale;\nuniform vec3 uBakeTint;\nvarying vec2 vBakeXZ;\n' +
        sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * uBakeTint * texture2D(uBake, vBakeXZ * uBakeScale).r * 2.0;`);
    };
    return mat;
  };

  // 1. Sol en moquette humide (une répétition de texture par case)
  textures.carpet.repeat.set(W, H);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL_SIZE, H * CELL_SIZE), baked(new THREE.MeshLambertMaterial({ map: textures.carpet })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((W * CELL_SIZE) / 2, 0, (H * CELL_SIZE) / 2);
  scene.add(floor);

  // 2. Faux plafond à dalles
  textures.ceiling.repeat.set(W, H);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL_SIZE, H * CELL_SIZE), baked(new THREE.MeshLambertMaterial({ map: textures.ceiling })));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((W * CELL_SIZE) / 2, WALL_HEIGHT, (H * CELL_SIZE) / 2);
  scene.add(ceiling);

  // 3. Murs au papier peint jaune
  let wallCount = 0;
  for (let i = 0; i < W * H; i++) if (map.grid[i] === T.WALL) wallCount++;
  const wallsMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE), baked(new THREE.MeshLambertMaterial({ map: textures.wall })), wallCount);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (map.grid[z * W + x] !== T.WALL) continue;
      dummy.position.set((x + 0.5) * CELL_SIZE, WALL_HEIGHT / 2, (z + 0.5) * CELL_SIZE);
      dummy.updateMatrix();
      wallsMesh.setMatrixAt(idx++, dummy.matrix);
    }
  }
  wallsMesh.instanceMatrix.needsUpdate = true;
  scene.add(wallsMesh);

  scene.add(new THREE.AmbientLight('#fff3c4', 0.05));

  // 4. Néons au plafond (les morts sont gris, ceux qui grésillent clignotent)
  const ON = new THREE.Color('#fffbe2');
  const OFF = new THREE.Color('#4a473c');
  const fixtures = new THREE.InstancedMesh(new THREE.BoxGeometry(1.25, 0.05, 0.42), new THREE.MeshBasicMaterial({ color: '#ffffff' }), map.lights.length);
  map.lights.forEach((l, i) => {
    dummy.position.set(l.x, WALL_HEIGHT - 0.025, l.z);
    dummy.updateMatrix();
    fixtures.setMatrixAt(i, dummy.matrix);
    fixtures.setColorAt(i, l.state === 'off' ? OFF : ON);
    l.index = i;
  });
  fixtures.instanceMatrix.needsUpdate = true;
  scene.add(fixtures);

  // 5. Lampe torche du joueur (attachée à la caméra)
  const flashLight = new THREE.SpotLight('#fff1d0', 20, 24, Math.PI / 6.5, 0.45, 1.5);
  flashLight.position.set(0.15, -0.12, 0);
  camera.add(flashLight);
  const flashTarget = new THREE.Object3D();
  flashTarget.position.set(0, -0.2, -5);
  camera.add(flashTarget);
  flashLight.target = flashTarget;
  scene.add(camera);

  // 6. Meubles abandonnés (modèles Kenney CC0 du manoir de Mystère Mystère), un InstancedMesh par morceau
  const loader = new GLTFLoader();
  const propMats = new Map();
  const propMat = (src) => {
    const key = src.color ? src.color.getHexString() : 'x';
    if (!propMats.has(key)) {
      const c = src.color ? src.color.clone().multiplyScalar(0.62) : new THREE.Color('#888');
      propMats.set(key, baked(new THREE.MeshLambertMaterial({ color: c })));
    }
    return propMats.get(key);
  };
  for (const kind of PROP_KINDS) {
    const list = map.props.filter((p) => p.m === kind.m);
    if (!list.length) continue;
    loader.load(MODELS + kind.m + '.glb', (g) => {
      const root = g.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      const c = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(c);
      const k = kind.h / (size.y || 1);
      const fix = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
      const place = list.map((p) => {
        const m = new THREE.Matrix4().makeTranslation(p.x, p.tipped ? (size.x * k) / 2 : 0, p.z).multiply(new THREE.Matrix4().makeRotationY(p.rot));
        if (p.tipped) m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
        return m.multiply(fix);
      });
      root.traverse((o) => {
        if (!o.isMesh) return;
        const src = Array.isArray(o.material) ? o.material[0] : o.material;
        const inst = new THREE.InstancedMesh(o.geometry, propMat(src), list.length);
        place.forEach((m, i) => inst.setMatrixAt(i, m.clone().multiply(o.matrixWorld)));
        inst.instanceMatrix.needsUpdate = true;
        inst.frustumCulled = false;
        scene.add(inst);
      });
    }, undefined, () => {});
  }

  // 7. Les 5 cassettes VHS
  const cassetteGeo = new THREE.BoxGeometry(0.38, 0.22, 0.06);
  const cassetteMat = new THREE.MeshLambertMaterial({ map: textures.vhs, emissive: '#d97706', emissiveIntensity: 0.35 });
  const cassetteMeshes = [];
  for (const cas of map.cassettes) {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(cassetteGeo, cassetteMat));
    const aura = new THREE.PointLight('#f5a524', 2.2, 5, 1.6);
    group.add(aura);
    group.position.set(cas.x, 0.85, cas.z);
    scene.add(group);
    cassetteMeshes.push({ id: cas.id, cas, group });
  }

  // 8. Eau d'amande (rend l'endurance)
  const bottleMeshes = [];
  const glassMat = baked(new THREE.MeshLambertMaterial({ color: '#e8efe6', transparent: true, opacity: 0.75 }));
  const capMat = baked(new THREE.MeshLambertMaterial({ color: '#2f6fb0' }));
  const labelMat = baked(new THREE.MeshLambertMaterial({ map: textures.label }));
  for (const b of map.bottles) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 12), glassMat);
    body.position.y = 0.13;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.1, 12, 1, true), labelMat);
    label.position.y = 0.12;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.06, 10), glassMat);
    neck.position.y = 0.29;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.035, 10), capMat);
    cap.position.y = 0.335;
    g.add(body, label, neck, cap);
    g.position.set(b.x + 0.4, 0, b.z - 0.3);
    g.rotation.y = b.id * 1.7;
    scene.add(g);
    bottleMeshes.push({ b, g });
  }

  // 8b. Piles (deux bâtons cuivrés couchés par terre)
  const batteryMeshes = [];
  const cellMat = baked(new THREE.MeshLambertMaterial({ color: '#1d1d1d' }));
  const capCopper = baked(new THREE.MeshLambertMaterial({ color: '#c98a2b', emissive: '#5a3a08', emissiveIntensity: 0.6 }));
  for (const b of map.batteries || []) {
    const g = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 10), cellMat);
      cell.rotation.z = Math.PI / 2;
      cell.position.set(0, 0.045, i * 0.1 - 0.05);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.07, 10), capCopper);
      top.rotation.z = Math.PI / 2;
      top.position.set(0.07, 0.045, i * 0.1 - 0.05);
      g.add(cell, top);
    }
    g.position.set(b.x - 0.3, 0, b.z + 0.35);
    g.rotation.y = b.id * 2.3;
    scene.add(g);
    batteryMeshes.push({ b, g });
  }

  // 9. Porte de sortie : plaquée contre un mur voisin de la case de sortie, avec son panneau EXIT
  const exitGroup = new THREE.Group();
  const dir = [[0, -1], [1, 0], [0, 1], [-1, 0]].find(([dx, dz]) => map.isWall(map.exit.gx + dx, map.exit.gz + dz));
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.3), baked(new THREE.MeshLambertMaterial({ map: textures.exit })));
  door.position.y = 1.15;
  const signMat = new THREE.MeshBasicMaterial({ map: textures.sign, color: '#ff3030' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), signMat);
  sign.position.y = 2.6;
  exitGroup.add(door, sign);
  if (dir) {
    exitGroup.position.set(map.exit.x + dir[0] * (CELL_SIZE / 2 - 0.02), 0, map.exit.z + dir[1] * (CELL_SIZE / 2 - 0.02));
    exitGroup.rotation.y = Math.atan2(-dir[0], -dir[1]);
  } else {
    // pas de mur : une porte dans son cadre, au milieu de la pièce
    exitGroup.position.set(map.exit.x, 0, map.exit.z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.45, 0.2), baked(new THREE.MeshLambertMaterial({ color: '#4a4232' })));
    frame.position.set(0, 1.22, -0.12);
    exitGroup.add(frame);
    door.position.z = 0.0;
  }
  scene.add(exitGroup);
  const exitLight = new THREE.PointLight('#ff2020', 3, 8, 1.6);
  exitLight.position.set(map.exit.x, 2.4, map.exit.z);
  scene.add(exitLight);

  // 10. L'entité : une image plate qui fait toujours face au joueur. Tant qu'elle n'est pas chargée (ou s'il n'y a
  // pas d'image), une silhouette noire aux yeux rouges la remplace.
  const monsterGroup = new THREE.Group();
  const shadow = new THREE.Group();
  const blackMat = new THREE.MeshBasicMaterial({ color: '#000000' });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.3, 12), blackMat);
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), blackMat);
  head.position.y = 2.4;
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff0033' });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMat);
  eyeL.position.set(0.1, 2.43, 0.27);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.1;
  shadow.add(body, head, eyeL, eyeR);
  monsterGroup.add(shadow);

  const face = new THREE.Group();
  const faceGlitch = { value: 1 };
  const faceTime = { value: 0 };
  face.visible = false;
  monsterGroup.add(face);
  new THREE.TextureLoader().load(ENTITY_IMG, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const h = 2.15;
    const w = Math.min(2.3, (h * t.image.width) / t.image.height);
    const mat = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, color: '#e6dccb' });
    // brouillage de l'image : bandes décalées, couleurs qui bavent, neige et lignes manquantes (uGlitch de 0 à 1)
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uGlitch = faceGlitch;
      sh.uniforms.uGTime = faceTime;
      sh.fragmentShader = `uniform float uGlitch;
uniform float uGTime;
float ghash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
` + sh.fragmentShader.replace('#include <map_fragment>', `
  vec2 guv = vMapUv;
  float gt = floor(uGTime * 15.0);
  float gb = floor(guv.y * 30.0);
  guv.x += step(1.0 - uGlitch * 0.6, ghash(vec2(gb, gt))) * (ghash(vec2(gb, gt + 7.0)) - 0.5) * 0.4 * uGlitch;
  guv.x += (ghash(vec2(floor(guv.y * 220.0), gt)) - 0.5) * 0.025 * uGlitch;
  float gca = 0.03 * uGlitch;
  vec4 gc = texture2D(map, guv);
  gc.r = texture2D(map, guv + vec2(gca, 0.0)).r;
  gc.b = texture2D(map, guv - vec2(gca, 0.0)).b;
  gc.rgb = mix(gc.rgb, vec3(ghash(guv * 420.0 + uGTime)), uGlitch * 0.4);
  if (ghash(vec2(gb * 3.1, floor(uGTime * 20.0))) < uGlitch * 0.2) gc.a = 0.0;
  diffuseColor *= gc;
`);
    };
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    plane.position.y = h / 2 + 0.25; // elle flotte au-dessus de la moquette
    plane.position.x = (0.5 - 0.6) * w; // la tête (à 60 % de la largeur de la photo) dans l'axe de l'entité
    face.add(plane);
    face.visible = true;
    shadow.visible = false;
  });

  const monsterAura = new THREE.PointLight('#ff1a1a', 2.5, 6, 1.6);
  monsterAura.position.set(0, 1.6, 0.6);
  monsterGroup.add(monsterAura);
  monsterGroup.position.set(map.monsterSpawn.x, 0, map.monsterSpawn.z);
  scene.add(monsterGroup);

  const onResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    vhs.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  let flickT = 0;
  let lastTime = 0;
  let bob = 0;

  return {
    scene,
    camera,
    renderer,
    monsterGroup,
    vhs,

    dispose() {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },

    // Rendu d'une frame
    render(sim, time) {
      const dt = Math.min(0.1, Math.max(0, time - lastTime));
      lastTime = time;
      const P = sim.player;

      // 1. Caméra : balancement lent de la marche, plus marqué en courant
      if (P.moving) bob += dt * (P.running ? 9 : 5.5);
      camera.position.set(P.x, 1.6 + (P.moving ? Math.sin(bob * 2) * (P.running ? 0.05 : 0.025) : 0), P.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = P.yaw;
      camera.rotation.x = P.pitch;
      camera.rotation.z = P.moving ? Math.sin(bob) * 0.006 : 0;

      // tremblement quand l'entité est tout près
      const danger = sim.hasMonster ? sim.monster.danger : 0;
      const calm = 1 - THREE.MathUtils.smoothstep(danger, 0.72, 0.92);
      if (danger > 0.3) {
        const shake = (danger - 0.3) * 0.035 * calm;
        camera.rotation.z += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
      }

      flashLight.visible = P.flashlight;
      // pile faible : la lampe faiblit et clignote
      const bat = P.battery ?? 100;
      flashLight.intensity = 20 * (bat < 15 ? 0.45 + (Math.random() < 0.12 ? -0.4 : 0.15) : bat < 35 ? 0.75 : 1);

      // 2. L'entité fait face au joueur et tressaute quand elle le traque
      if (sim.hasMonster) {
        const M = sim.monster;
        monsterGroup.visible = true;
        const chase = M.mode === 'chase';
        // plus elle est proche, moins elle est brouillée : nette à moins de 2,5 m
        const g = THREE.MathUtils.clamp((Math.hypot(P.x - M.x, P.z - M.z) - 2.5) / 14, 0, 1);
        faceGlitch.value = g;
        faceTime.value = time;
        const j = (chase ? 0.12 : 0.04) * g;
        monsterGroup.position.set(M.x + (Math.random() - 0.5) * j, chase ? Math.abs(Math.sin(time * 9)) * 0.08 : Math.sin(time * 2) * 0.03, M.z + (Math.random() - 0.5) * j);
        monsterGroup.rotation.y = Math.atan2(P.x - M.x, P.z - M.z);
        face.scale.set(1 + (Math.random() - 0.5) * 0.08 * g, 1 + Math.sin(time * 18) * 0.04 * g, 1);
        monsterAura.intensity = (chase ? 3 : 1.5) + Math.random() * 1.2;
      } else {
        monsterGroup.visible = false;
      }

      // 3. Cassettes et bouteilles
      for (const cm of cassetteMeshes) {
        cm.group.visible = !cm.cas.collected;
        if (cm.group.visible) {
          cm.group.rotation.y = time * 1.6;
          cm.group.position.y = 0.85 + Math.sin(time * 2.5 + cm.id) * 0.08;
        }
      }
      for (const bm of bottleMeshes) bm.g.visible = !bm.b.taken;
      for (const bm of batteryMeshes) bm.g.visible = !bm.b.taken;

      // 4. Sortie : rouge verrouillée, verte ouverte
      const open = P.cassettesCollected >= 5;
      exitLight.color.set(open ? '#22c55e' : '#ef4444');
      exitLight.intensity = open ? 6 : 2.5;
      signMat.color.set(open ? '#4ade80' : '#ff3030');

      // 5. Néons qui grésillent (une quinzaine de fois par seconde)
      flickT -= dt;
      if (flickT <= 0 && flickers.length) {
        flickT = 1 / 15;
        let changed = false;
        for (const f of flickers) {
          if (Math.random() < 0.12) {
            const k = Math.random() < 0.45 ? 0 : 0.6 + Math.random() * 0.4;
            if (k !== f.k) {
              f.k = k;
              fixtures.setColorAt(f.l.index, k > 0 ? ON : OFF);
              changed = true;
            }
          }
        }
        if (changed) {
          fixtures.instanceColor.needsUpdate = true;
          writeBake();
        }
      }

      vhs.render(scene, camera, time, danger * calm);
    },
  };
}
