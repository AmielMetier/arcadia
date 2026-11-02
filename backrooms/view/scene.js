// The Backrooms - Scène 3D Three.js, rendu du Level 0 et entité
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE, WALL_HEIGHT, T } from '../engine/map.js';
import { createBackroomsTextures } from './textures.js';

export function createBackroomsScene(container, map) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0907');
  scene.fog = new THREE.FogExp2('#14120a', 0.045); // Brouillard atmosphérique dense et oppressant

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 80);
  camera.position.set(map.spawn.x, 1.6, map.spawn.z);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  container.appendChild(renderer.domElement);

  const textures = createBackroomsTextures();

  // 1. Sol en moquette humide
  const floorGeo = new THREE.PlaneGeometry(map.W * CELL_SIZE, map.H * CELL_SIZE);
  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.carpet,
    roughness: 0.92,
    metalness: 0.05,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((map.W * CELL_SIZE) / 2, 0, (map.H * CELL_SIZE) / 2);
  scene.add(floor);

  // 2. Plafond suspendu à dalles
  const ceilGeo = new THREE.PlaneGeometry(map.W * CELL_SIZE, map.H * CELL_SIZE);
  const ceilMat = new THREE.MeshStandardMaterial({
    map: textures.ceiling,
    roughness: 0.85,
    metalness: 0.05,
  });
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((map.W * CELL_SIZE) / 2, WALL_HEIGHT, (map.H * CELL_SIZE) / 2);
  scene.add(ceiling);

  // 3. Murs avec le papier peint jaune emblématique
  const wallGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.wall,
    roughness: 0.8,
    metalness: 0.05,
  });

  // InstancedMesh pour des performances 60 FPS parfaites
  let wallCount = 0;
  for (let z = 0; z < map.H; z++) {
    for (let x = 0; x < map.W; x++) {
      if (map.grid[z * map.W + x] === T.WALL) wallCount++;
    }
  }

  const wallsMesh = new THREE.InstancedMesh(wallGeo, wallMat, wallCount);
  const dummy = new THREE.Object3D();
  let idx = 0;

  for (let z = 0; z < map.H; z++) {
    for (let x = 0; x < map.W; x++) {
      if (map.grid[z * map.W + x] === T.WALL) {
        dummy.position.set((x + 0.5) * CELL_SIZE, WALL_HEIGHT / 2, (z + 0.5) * CELL_SIZE);
        dummy.updateMatrix();
        wallsMesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
  }
  wallsMesh.instanceMatrix.needsUpdate = true;
  scene.add(wallsMesh);

  // 4. Lumières d'ambiance et néons fluorescents
  const ambientLight = new THREE.AmbientLight('#cfba63', 0.22);
  scene.add(ambientLight);

  const fixtureGeo = new THREE.BoxGeometry(1.4, 0.08, 0.45);
  const fixtureMat = new THREE.MeshBasicMaterial({ color: '#fff9d6' });
  const flickeringLights = [];

  for (const l of map.lights) {
    const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixture.position.set(l.x, WALL_HEIGHT - 0.04, l.z);
    scene.add(fixture);

    const pLight = new THREE.PointLight('#fff2a8', 0.75, 10, 1.6);
    pLight.position.set(l.x, WALL_HEIGHT - 0.25, l.z);
    scene.add(pLight);

    if (l.flicker) {
      flickeringLights.push(pLight);
    }
  }

  // 5. Lampe torche du joueur (attachée à la caméra)
  const flashLight = new THREE.SpotLight('#fff5db', 2.8, 22, Math.PI / 5.5, 0.4, 1.4);
  flashLight.position.set(0, 0, 0);
  camera.add(flashLight);
  const flashTarget = new THREE.Object3D();
  flashTarget.position.set(0, 0, -5);
  camera.add(flashTarget);
  flashLight.target = flashTarget;
  scene.add(camera);

  // 6. Les 5 Cassettes VHS disséminées
  const cassetteGeo = new THREE.BoxGeometry(0.38, 0.22, 0.06);
  const cassetteMat = new THREE.MeshStandardMaterial({
    map: textures.vhs,
    roughness: 0.5,
    metalness: 0.2,
    emissive: '#d97706',
    emissiveIntensity: 0.25,
  });

  const cassetteMeshes = [];
  for (const cas of map.cassettes) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(cassetteGeo, cassetteMat);
    group.add(mesh);

    // Halo lumineux doré autour de chaque cassette pour la repérer au loin
    const aura = new THREE.PointLight('#f59e0b', 0.9, 4.5);
    aura.position.set(0, 0, 0);
    group.add(aura);

    group.position.set(cas.x, 0.85, cas.z);
    scene.add(group);
    cassetteMeshes.push({ id: cas.id, group, baseZ: cas.z });
  }

  // 7. Porte de Sortie EXIT
  const exitDoorGeo = new THREE.PlaneGeometry(1.8, 2.6);
  const exitDoorMat = new THREE.MeshStandardMaterial({
    map: textures.exit,
    roughness: 0.4,
    metalness: 0.5,
  });
  const exitDoor = new THREE.Mesh(exitDoorGeo, exitDoorMat);
  exitDoor.position.set(map.exit.x, 1.3, map.exit.z);
  scene.add(exitDoor);

  const exitLight = new THREE.PointLight('#ff1111', 1.6, 7);
  exitLight.position.set(map.exit.x, 2.4, map.exit.z);
  scene.add(exitLight);

  // 8. L'Entité / PNJ (Silhouette noire "Écran noir" comme demandé par l'utilisateur)
  const monsterGroup = new THREE.Group();

  // Corps élancé et inquiétant tout noir matte
  const bodyGeo = new THREE.CylinderGeometry(0.28, 0.35, 2.3, 12);
  const blackMat = new THREE.MeshBasicMaterial({ color: '#000000' });
  const monsterBody = new THREE.Mesh(bodyGeo, blackMat);
  monsterBody.position.y = 1.15;
  monsterGroup.add(monsterBody);

  // Tête sombre
  const headGeo = new THREE.SphereGeometry(0.32, 12, 12);
  const monsterHead = new THREE.Mesh(headGeo, blackMat);
  monsterHead.position.y = 2.35;
  monsterGroup.add(monsterHead);

  // Deux yeux rouges luisants perçants dans le noir absolu
  const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff0033' });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.1, 2.38, 0.28);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(-0.1, 2.38, 0.28);
  monsterGroup.add(eyeL);
  monsterGroup.add(eyeR);

  // Aura sombre rougeoyante autour du monstre
  const monsterAura = new THREE.PointLight('#ff0022', 1.2, 5);
  monsterAura.position.set(0, 1.8, 0);
  monsterGroup.add(monsterAura);

  monsterGroup.position.set(map.monsterSpawn.x, 0, map.monsterSpawn.z);
  scene.add(monsterGroup);

  // Redimensionnement automatique
  window.addEventListener('resize', () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  return {
    scene,
    camera,
    renderer,
    monsterGroup,
    cassetteMeshes,
    flashLight,
    exitLight,
    flickeringLights,

    // Rendu d'une frame
    render(sim, time) {
      // 1. Position et orientation de la caméra (joueur)
      camera.position.x = sim.player.x;
      camera.position.z = sim.player.z;
      camera.position.y = 1.6 + (sim.player.running ? Math.sin(time * 12) * 0.04 : (sim.player.vx !== 0 || sim.player.vz !== 0 ? Math.sin(time * 7) * 0.02 : 0));

      camera.rotation.order = 'YXZ';
      camera.rotation.y = sim.player.yaw;
      camera.rotation.x = sim.player.pitch;

      // Tremblement de caméra lorsque le monstre est très proche (effet de panique)
      if (sim.monster.danger > 0.3) {
        const shake = (sim.monster.danger - 0.3) * 0.035;
        camera.rotation.z = (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
      } else {
        camera.rotation.z = 0;
      }

      // Lampe torche
      flashLight.visible = sim.player.flashlight;

      // 2. Position et animation de l'entité
      if (sim.hasMonster) {
        monsterGroup.visible = true;
        monsterGroup.position.x = sim.monster.x;
        monsterGroup.position.z = sim.monster.z;
        monsterGroup.rotation.y = sim.monster.yaw;

        // Légère oscillation/respiration inquiétante du monstre
        monsterGroup.position.y = Math.sin(time * 6) * 0.06;
        monsterAura.intensity = 0.8 + Math.random() * 0.6;
      } else {
        monsterGroup.visible = false;
      }

      // 3. Animation des cassettes (flottement et rotation dorée)
      for (const cm of cassetteMeshes) {
        const casData = map.cassettes.find((c) => c.id === cm.id);
        if (casData && casData.collected) {
          cm.group.visible = false;
        } else {
          cm.group.visible = true;
          cm.group.rotation.y = time * 1.8;
          cm.group.position.y = 0.85 + Math.sin(time * 3 + cm.id) * 0.08;
        }
      }

      // 4. Couleur de la lumière de sortie (Rouge = verrouillée, Vert = ouverte !)
      if (sim.player.cassettesCollected >= 5) {
        exitLight.color.set('#22c55e'); // Vert éclatant
        exitLight.intensity = 2.4;
      } else {
        exitLight.color.set('#ef4444'); // Rouge fermé
        exitLight.intensity = 1.4;
      }

      // 5. Scintillement des néons défectueux
      for (const fl of flickeringLights) {
        if (Math.random() < 0.08) {
          fl.intensity = Math.random() < 0.4 ? 0.05 : 0.8;
        }
      }

      renderer.render(scene, camera);
    },
  };
}
