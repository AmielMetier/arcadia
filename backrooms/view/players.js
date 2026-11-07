// The Backrooms - Les autres joueurs : des explorateurs en combinaison jaune de protection (casque à visière noire,
// gants et bottes noirs), animés : attente, marche, course.
// Modèle : Quaternius, « Character Hazmat » (CC0, https://poly.pizza/m/z3TSQYx1Kn), sans ses armes (models/hazmat.glb).
// Leur lampe éclaire vraiment devant eux (un projecteur doux qui part de la main), sans cône dessiné dans l'air.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

const MODEL = new URL('../models/hazmat.glb', import.meta.url).href;
const HEIGHT = 1.78; // taille d'un explorateur, casque compris

const SUIT = '#d9a91a';

// Leurs lampes : six joueurs au plus (hub/games.js), plus l'explorateur du rejeu de la mort. three.js compte toutes les
// lumières de la scène, même éteintes : en ajouter une en cours de partie recompile tous les matériaux éclairés (le jeu
// se fige une à deux secondes au début du rejeu, à la première image d'une partie à plusieurs, la première fois qu'un
// coéquipier nous filme). Elles sont donc toutes posées d'avance, éteintes, avant la compilation des matériaux
// (scene.js), et chaque explorateur en prend une.
const LAMPS = 6 + 1;

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

// leur lampe : la torche jaune de Poly Haven (small_plastic_torch, CC0), la même que la nôtre
let torchSrc = null;
const torchLoading = new GLTFLoader().loadAsync(new URL('../models/small_plastic_torch.glb', import.meta.url).href).then((g) => {
  const body = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#4a3a10', emissiveIntensity: 0.6 });
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (/glass/.test(o.material.name || '')) o.userData.glass = true;
    else {
      body.map = o.material.map;
      o.material = body;
    }
  });
  torchSrc = g.scene;
}, () => {});

function makeTorch(mat) {
  const g = new THREE.Group();
  if (torchSrc) {
    const m = torchSrc.clone(true);
    m.traverse((o) => {
      if (o.isMesh && o.userData.glass) o.material = mat.lens;
    });
    m.rotation.z = -Math.PI / 2;
    g.add(m);
    return g;
  }
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

export function createPlayerAvatars(scene, lamps = LAMPS) {
  const avatars = new Map();
  const tmp = new THREE.Vector3();
  // la lampe : un vrai projecteur à bord doux. Il reste dans la scène même caché (sa puissance tombe à 0) : le nombre
  // de lumières ne change pas, les matériaux ne se recompilent pas
  const newLamp = () => {
    const light = new THREE.SpotLight('#fff1d0', 0, 20, Math.PI / 7.5, 0.8, 1.6);
    light.target = new THREE.Object3D();
    scene.add(light, light.target);
    return light;
  };
  const spare = []; // les lampes libres
  for (let i = 0; i < lamps; i++) spare.push(newLamp());

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
    // le voyant rouge du caméscope, à hauteur du visage, quand il filme (V)
    a.rec = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a1a' }));
    a.rec.position.set(-0.12, 1.62, -0.3);
    a.rec.visible = false;
    a.g.add(a.rec);
  };

  const get = (P) => {
    let a = avatars.get(P.id);
    if (!a) {
      a = { g: new THREE.Group() };
      scene.add(a.g);
      build(a);
      avatars.set(P.id, a);
      if (!torchSrc) torchLoading.then(() => {
        // la torche vient d'arriver : on la met dans sa main
        if (!torchSrc || !a.torch) return;
        a.g.remove(a.torch);
        a.torch = makeTorch(a.mat);
        a.g.add(a.torch);
      });
      if (!source) loading.then(() => {
        // le modèle vient d'arriver : on refait l'explorateur
        if (!source || a.root) return;
        a.g.clear();
        build(a);
      });
    }
    // sa lampe : une de celles posées d'avance (une nouvelle seulement si toutes sont prises : les matériaux se
    // recompilent alors, mais il a bien sa lampe)
    if (!a.light) a.light = spare.pop() || newLamp();
    return a;
  };

  return {
    has: (id) => avatars.has(id),
    // cache (ou remontre) le corps d'un joueur le temps d'une prise de vue depuis sa tête ; renvoie l'état d'avant
    setShown(id, v) {
      const a = avatars.get(id);
      if (!a) return false;
      const was = a.g.visible;
      a.g.visible = v;
      return was;
    },
    // Q : le joueur ; y : hauteur des pieds ; light : lumière des néons là où il est ; dt : durée de l'image
    update(Q, show, y, light, dt) {
      if (!show) {
        const a = avatars.get(Q.id);
        if (a) {
          a.g.visible = false;
          if (a.light) a.light.intensity = 0;
        }
        return;
      }
      const a = get(Q);
      a.g.visible = true;
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
      a.light.target.position.copy(a.g.localToWorld(tmp));
      a.light.target.updateMatrixWorld();
      a.light.intensity = Q.flashlight ? 14 : 0;
      if (a.rec) a.rec.visible = !!Q.cam && (performance.now() % 1200) < 700;
      a.mat.lens.color.setHex(Q.flashlight ? 0xfff6dc : 0x2a2620); // en nombre : pas de texte à relire à chaque image
    },
    // ceux qui ne sont plus dans la partie (partis, déconnectés) : sinon ils restent figés sur place, lampe allumée.
    // Ils se cachent et leur lampe retourne dans la réserve ; keep : l'explorateur qui n'est pas un joueur (le rejeu)
    hideGone(players, keep) {
      avatars.forEach((a, id) => {
        if (id === keep || !a.light) return;
        for (let i = 0; i < players.length; i++) if (players[i].id === id) return;
        a.g.visible = false;
        a.light.intensity = 0;
        spare.push(a.light);
        a.light = null;
      });
    },
  };
}
