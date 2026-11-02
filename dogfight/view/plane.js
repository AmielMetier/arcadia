// Gestionnaire et instanciateur de modèles 3D F-16 Fighting Falcon pour Dogfight 3D.
// Charge le modèle réaliste texturé GLB avec repli immédiat procédural, postcombustion et gouvernes.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

let f16Template = null;
let templateLoading = null;

// Charge le fichier f-16.glb une seule fois pour tout le jeu
export function preloadF16Model() {
  if (f16Template) return Promise.resolve(f16Template);
  if (templateLoading) return templateLoading;

  templateLoading = new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      'f-16.glb',
      (gltf) => {
        const root = gltf.scene;

        // Alignement géométrique exact du F-16 GLB :
        // Le modèle Three.js issu de Sketchfab a son axe longitudinal (moteur -> nez) sur +X,
        // son axe vertical (ventre -> cockpit/dérive) vers +Y,
        // et son envergure d'ailes sur l'axe Z (aile droite vers -Z, aile gauche vers +Z).
        // Une simple rotation de -90° autour de l'axe vertical Y aligne l'avion parfaitement droit :
        // - Nez strictement vers +Z (devant, en face de la caméra et droit vers le réticule)
        // - Cockpit et dérive strictement vers +Y (vers le ciel)
        // - Aile droite vers +X (droite) et aile gauche vers -X (gauche)
        // - Tuyère d'échappement vers -Z (vers la caméra de poursuite)
        const pivot = new THREE.Group();
        root.rotation.set(0, -Math.PI / 2, 0);

        // Échelle à taille réelle (longueur exacte de 15.0 mètres) et centrage parfait sur le pivot
        const scale = 15.0 / 150.91997;
        root.scale.set(scale, scale, scale);
        root.position.set(0, -0.69854, -2.57771);

        // Activer les ombres et masquer le train d'atterrissage déployé (avion en vol)
        root.traverse((child) => {
          if (child.name && (child.name.includes('landingOn') || child.name.includes('landingOnLight'))) {
            child.visible = false;
          }
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              if (child.material.name === 'Glass') {
                child.material.transparent = true;
                child.material.opacity = 0.55;
                child.material.roughness = 0.05;
                child.material.metalness = 0.9;
              } else {
                child.material.roughness = Math.max(0.35, child.material.roughness || 0.4);
                child.material.metalness = Math.min(0.6, child.material.metalness || 0.3);
              }
            }
          }
        });

        pivot.add(root);
        f16Template = pivot;
        resolve(f16Template);
      },
      undefined,
      (err) => {
        console.warn('Impossible de charger f-16.glb, utilisation du modèle de secours :', err);
        resolve(null);
      }
    );
  });

  return templateLoading;
}

export function buildF16Model({ color = 0x2563eb, camo = 'grey' } = {}) {
  const container = new THREE.Group();

  let bodyGroup = new THREE.Group();
  container.add(bodyGroup);

  // 1. Si le modèle réaliste f-16.glb est déjà disponible, on le clone
  if (f16Template) {
    const clone = f16Template.clone(true);
    // Teinte personnalisée de l'empennage/ailes
    colorizeModel(clone, color);
    bodyGroup.add(clone);
  } else {
    // Sinon on construit le modèle procédural immédiat et on remplace dès chargement
    const proc = buildProceduralF16({ color, camo });
    bodyGroup.add(proc);

    preloadF16Model().then((tpl) => {
      if (tpl && bodyGroup) {
        bodyGroup.remove(proc);
        const clone = tpl.clone(true);
        colorizeModel(clone, color);
        bodyGroup.add(clone);
      }
    });
  }

  // 2. Flamme de postcombustion (Afterburner)
  const flameGeo = new THREE.ConeGeometry(0.55, 4.2, 16);
  flameGeo.rotateX(-Math.PI / 2);
  flameGeo.translate(0, 0, -2.1);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff, // Cœur cyan plasma
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
  const flameMesh = new THREE.Mesh(flameGeo, flameMat);
  flameMesh.position.set(0, 0.0, -7.5);
  flameMesh.visible = false;
  container.add(flameMesh);

  // Enveloppe extérieure orange thermique
  const outerFlameGeo = new THREE.ConeGeometry(0.85, 5.8, 16);
  outerFlameGeo.rotateX(-Math.PI / 2);
  outerFlameGeo.translate(0, 0, -2.9);
  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xff5500,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
  });
  const outerFlameMesh = new THREE.Mesh(outerFlameGeo, outerFlameMat);
  outerFlameMesh.position.set(0, 0.0, -7.5);
  outerFlameMesh.visible = false;
  container.add(outerFlameMesh);

  // 3. Flash lumineux du canon rotatif Vulcan M61
  const flashGeo = new THREE.SphereGeometry(0.45, 8, 8);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffea00,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
  });
  const flashMesh = new THREE.Mesh(flashGeo, flashMat);
  flashMesh.position.set(-0.46, 0.10, 3.58);
  flashMesh.visible = false;
  container.add(flashMesh);

  return {
    root: container,
    flameMesh,
    outerFlameMesh,
    flashMesh,
    setBoosting(boost) {
      flameMesh.visible = boost;
      outerFlameMesh.visible = boost;
      if (boost) {
        const flicker = 0.88 + Math.random() * 0.28;
        flameMesh.scale.set(1, 1, flicker);
        outerFlameMesh.scale.set(1, 1, flicker);
      }
    },
    triggerMuzzleFlash() {
      flashMesh.visible = true;
      setTimeout(() => {
        flashMesh.visible = false;
      }, 35);
    },
  };
}

function colorizeModel(model, color) {
  const accentMat = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.35,
    metalness: 0.45,
  });
  // Appliquer la couleur sur les rails de bouts d'ailes et points d'emport
  model.traverse((o) => {
    if (o.isMesh && (o.name.includes('rails') || o.name.includes('Object_20'))) {
      o.material = accentMat;
    }
  });

  // Balise lumineuse d'escadron au sommet de la dérive verticale
  const beaconGeo = new THREE.BoxGeometry(0.18, 0.22, 0.6);
  const beaconMat = new THREE.MeshBasicMaterial({ color: color });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0, 2.62, -6.8);
  model.add(beacon);
}

// Modèle de secours procédural
function buildProceduralF16({ color = 0x2563eb, camo = 'grey' } = {}) {
  const root = new THREE.Group();
  const bodyColor = 0x8a9ba8;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.7, metalness: 0.2 });

  // Nez
  const noseGeo = new THREE.ConeGeometry(0.55, 3.2, 16);
  noseGeo.rotateX(Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeo, darkMat);
  noseMesh.position.set(0, 0, 4.2);
  root.add(noseMesh);

  // Fuselage
  const fuseMidGeo = new THREE.CylinderGeometry(0.9, 0.85, 4.2, 16);
  fuseMidGeo.rotateX(Math.PI / 2);
  fuseMidGeo.scale(1.4, 0.85, 1.0);
  const fuseMidMesh = new THREE.Mesh(fuseMidGeo, bodyMat);
  fuseMidMesh.position.set(0, -0.05, -2.4);
  root.add(fuseMidMesh);

  // Ailes delta
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.8);
  wingShape.lineTo(4.8, -1.8);
  wingShape.lineTo(4.8, -2.8);
  wingShape.lineTo(0.9, -2.5);
  wingShape.lineTo(0, -2.5);

  const wingGeoRight = new THREE.ExtrudeGeometry(wingShape, { depth: 0.1, bevelEnabled: false });
  wingGeoRight.rotateX(Math.PI / 2);
  const wingMeshRight = new THREE.Mesh(wingGeoRight, bodyMat);
  wingMeshRight.position.set(0, 0, -0.2);
  root.add(wingMeshRight);

  const wingGeoLeft = wingGeoRight.clone();
  wingGeoLeft.scale(-1, 1, 1);
  const wingMeshLeft = new THREE.Mesh(wingGeoLeft, bodyMat);
  wingMeshLeft.position.set(0, 0, -0.2);
  root.add(wingMeshLeft);

  // Dérive
  const tailFinShape = new THREE.Shape();
  tailFinShape.moveTo(0, 0);
  tailFinShape.lineTo(0, 2.8);
  tailFinShape.lineTo(0.6, 2.7);
  tailFinShape.lineTo(1.8, 0);
  const tailGeo = new THREE.ExtrudeGeometry(tailFinShape, { depth: 0.12, bevelEnabled: false });
  tailGeo.rotateY(-Math.PI / 2);
  tailGeo.translate(0.06, 0.6, -4.6);
  const tailMesh = new THREE.Mesh(tailGeo, accentMat);
  root.add(tailMesh);

  return root;
}
