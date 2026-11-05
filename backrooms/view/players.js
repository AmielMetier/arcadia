// The Backrooms - Les autres joueurs : des explorateurs en combinaison jaune de protection (casque à visière noire,
// gants et bottes noirs), animés : attente, marche, course.
// Modèle : Quaternius, « Character Hazmat » (CC0, https://poly.pizza/m/z3TSQYx1Kn), sans ses armes (models/hazmat.glb).
// Leur lampe éclaire vraiment devant eux (un projecteur doux qui part de la main), sans cône dessiné dans l'air.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

const MODEL = new URL('../models/hazmat.glb', import.meta.url).href;
const HEIGHT = 1.78; // taille d'un explorateur, casque compris

const SUIT = '#d9a91a';

// copie d'un objet animé avec son propre squelette (comme SkeletonUtils.clone)
function cloneSkinned(src) {
  const clone = src.clone(true);
  const map = new Map();
  const walk = (a, b) => {
    map.set(a, b);
    for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]);
  };
  walk(src, clone);
  clone.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    let s = null;
    for (const [a, b] of map) if (b === o) s = a;
    const sk = s.skeleton.clone();
    sk.bones = s.skeleton.bones.map((b) => map.get(b));
    o.bind(sk, s.bindMatrix);
  });
  return clone;
}

let source = null;
let scale = 1;
const loading = new GLTFLoader().loadAsync(MODEL).then((g) => {
  g.scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  g.scene.traverse((o) => {
    if (o.isMesh) box.expandByObject(o);
  });
  scale = HEIGHT / (box.max.y - box.min.y || 1);
  source = g;
}, () => {});

function makeTorch(mat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 10), mat.dark);
  body.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.024, 0.05, 12), mat.dark);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.12;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), mat.lens);
  lens.position.z = 0.146;
  g.add(body, head, lens);
  return g;
}

export function createPlayerAvatars(scene) {
  const avatars = new Map();
  const tmp = new THREE.Vector3();

  const build = (a) => {
    const mat = a.mat || {
      suit: new THREE.MeshLambertMaterial({ color: SUIT, emissive: SUIT, emissiveIntensity: 0 }),
      dark: new THREE.MeshLambertMaterial({ color: '#141414', emissive: '#303030', emissiveIntensity: 0 }),
      grey: new THREE.MeshLambertMaterial({ color: '#3a3c3e', emissive: '#3a3c3e', emissiveIntensity: 0 }),
      lens: new THREE.MeshBasicMaterial({ color: '#2a2620' }),
    };
    a.mat = mat;
    const body = new THREE.Group();
    body.rotation.y = Math.PI; // le modèle regarde +z, le joueur -z
    a.g.add(body);
    if (source) {
      const root = cloneSkinned(source.scene);
      root.scale.setScalar(scale);
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        const n = (o.material.name || '').replace(/\.\d+$/, '');
        o.material = n === 'Hazmat_Main' ? mat.suit : n === 'Black' ? mat.dark : mat.grey;
      });
      body.add(root);
      a.root = root;
      a.hand = root.getObjectByName('Middle1R') || root.getObjectByName('LowerArmR');
      a.mixer = new THREE.AnimationMixer(root);
      const clip = (n) => source.animations.find((c) => c.name.endsWith('|' + n) || c.name === n);
      a.acts = {};
      for (const n of ['Idle', 'Walk', 'Run']) {
        const c = clip(n);
        if (!c) continue;
        a.acts[n] = a.mixer.clipAction(c);
        a.acts[n].play();
        a.acts[n].weight = n === 'Idle' ? 1 : 0;
      }
      a.w = { Idle: 1, Walk: 0, Run: 0 };
    } else {
      // le modèle n'est pas encore là : une silhouette en combinaison
      const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.9, 4, 10), mat.suit);
      capsule.position.y = 0.85;
      body.add(capsule);
    }
    a.torch = makeTorch(mat);
    a.g.add(a.torch);
    if (!a.light) {
      // la lampe : un vrai projecteur à bord doux. Il reste dans la scène même caché (sa puissance tombe à 0) :
      // le nombre de lumières ne change pas, les matériaux ne se recompilent pas
      a.light = new THREE.SpotLight('#fff1d0', 0, 20, Math.PI / 7.5, 0.8, 1.6);
      a.lightTarget = new THREE.Object3D();
      scene.add(a.light, a.lightTarget);
      a.light.target = a.lightTarget;
    }
  };

  const get = (P) => {
    let a = avatars.get(P.id);
    if (!a) {
      a = { g: new THREE.Group() };
      scene.add(a.g);
      build(a);
      avatars.set(P.id, a);
      if (!source) loading.then(() => {
        // le modèle vient d'arriver : on refait l'explorateur
        if (!source || a.root) return;
        a.g.clear();
        build(a);
      });
    }
    return a;
  };

  return {
    has: (id) => avatars.has(id),
    // Q : le joueur ; y : hauteur des pieds ; light : lumière des néons là où il est ; dt : durée de l'image
    update(Q, show, y, light, dt) {
      if (!show && !avatars.has(Q.id)) return;
      const a = get(Q);
      a.g.visible = show;
      if (!show) {
        a.light.intensity = 0;
        return;
      }
      a.g.position.set(Q.x, y, Q.z);
      a.g.rotation.set(0, Q.yaw, 0);
      a.g.rotateZ(-(Q.tilt || 0) * 0.6);
      // la combinaison prend la lumière des néons d'où il est (les néons sont cuits dans le décor, pas des lumières)
      const k = Math.min(0.7, 0.04 + light * 0.4);
      a.mat.suit.emissiveIntensity = k;
      a.mat.dark.emissiveIntensity = k;
      a.mat.grey.emissiveIntensity = k * 0.6;
      // attente, marche, course : les poses se fondent l'une dans l'autre
      if (a.mixer) {
        const want = Q.moving ? (Q.running ? 'Run' : 'Walk') : 'Idle';
        for (const n in a.acts) {
          a.w[n] += ((n === want ? 1 : 0) - a.w[n]) * Math.min(1, dt * 7);
          a.acts[n].weight = a.w[n];
        }
        a.mixer.update(dt);
      }
      a.g.updateMatrixWorld(true);
      // la lampe dans la main droite, qui vise où il regarde
      if (a.hand) {
        a.hand.getWorldPosition(tmp);
        a.g.worldToLocal(tmp);
        a.torch.position.set(tmp.x, tmp.y, tmp.z - 0.05);
      } else a.torch.position.set(0.22, 1.1, -0.25);
      const pitch = Q.pitch || 0;
      a.torch.rotation.set(pitch, Math.PI, 0);
      a.g.updateMatrixWorld(true);
      a.torch.getWorldPosition(a.light.position);
      tmp.set(a.torch.position.x, a.torch.position.y + Math.sin(pitch) * 6, a.torch.position.z - Math.cos(pitch) * 6);
      a.lightTarget.position.copy(a.g.localToWorld(tmp));
      a.lightTarget.updateMatrixWorld();
      a.light.intensity = Q.flashlight ? 14 : 0;
      a.mat.lens.color.set(Q.flashlight ? '#fff6dc' : '#2a2620');
    },
  };
}
