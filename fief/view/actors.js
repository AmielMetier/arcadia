// Fief Maudit : les personnages animés (KayKit Adventurers, CC0). Les héros et les squelettes partagent le même
// squelette d'animation : les clips viennent d'un seul fichier (models/anims.glb) et s'appliquent à tous.
// Chaque métier a son modèle et l'arme qu'il garde en main (la hache du bûcheron…). Pour porter une bûche, les bras
// prennent la pose d'une arme à deux mains pendant que les jambes marchent, et la bûche est tenue contre la poitrine.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';
import { ACT } from '../engine/sim.js';

export const JOBS = {
  bucheron: { model: 'barbarian', name: 'Bûcheron', show: ['1H_Axe'] },
  chevalier: { model: 'knight', name: 'Chevalier', show: ['1H_Sword', 'Round_Shield'] },
  chasseuse: { model: 'rogue', name: 'Chasseuse', show: ['Knife'] },
  pretre: { model: 'mage', name: 'Prêtre', show: ['Staff'] },
  forgeronne: { model: 'rogue_hooded', name: 'Forgeronne', show: ['1H_Crossbow'] },
};
// objets tenus que le modèle d'origine montre tous à la fois : on n'en garde qu'un
const HELD = /(_Axe|Shield|Sword|Mug|Staff|Wand|Crossbow|Knife|Dagger|Spellbook|Throwable|Quiver)/i;
const SCALE = 0.8;
const ARM = /^(upperarm|lowerarm|wrist|hand|handslot|elbowIK|handIK)/;

export function cloneSkinned(src) {
  const clone = src.clone(true), map = new Map();
  const walk = (a, b) => { map.set(a, b); for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]); };
  walk(src, clone);
  clone.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    let s = null;
    for (const [a, b] of map) if (b === o) { s = a; break; }
    const sk = s.skeleton.clone();
    sk.bones = s.skeleton.bones.map((b) => map.get(b));
    o.bind(sk, s.bindMatrix);
  });
  return clone;
}
const only = (clip, keep) => { const c = clip.clone(); c.tracks = c.tracks.filter((t) => keep(t.name.split('.')[0])); c.name = clip.name + (keep === isArm ? '#bras' : '#corps'); return c; };
const isArm = (b) => ARM.test(b);
const notArm = (b) => !ARM.test(b);

export async function createActors(scene, { makeLog }) {
  const loader = new GLTFLoader();
  const animG = await loader.loadAsync('models/anims.glb');
  const clips = new Map(animG.animations.map((c) => [c.name, c]));
  // marche sans les bras + bras qui portent
  clips.set('carryLegs', only(clips.get('Walking_A'), notArm));
  clips.set('carryIdleLegs', only(clips.get('Idle'), notArm));
  clips.set('carryArms', only(clips.get('2H_Melee_Idle'), isArm));
  const models = new Map();
  const getModel = async (name) => { if (!models.has(name)) models.set(name, loader.loadAsync(`models/persos/${name}.glb`)); return models.get(name); };
  await getModel('barbarian');
  const list = new Map();

  async function add(p) {
    const job = JOBS[p.job] || JOBS.bucheron;
    const g = await getModel(job.model);
    const root = cloneSkinned(g.scene);
    root.scale.setScalar(SCALE);
    let hand = null;
    root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (o.material) o.material.envMapIntensity = 0.5; }
      if (HELD.test(o.name) && !o.isBone) o.visible = job.show.includes(o.name);
      if (o.name === 'handslotr') hand = o;
    });
    const holder = new THREE.Group(); holder.add(root); scene.add(holder);
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map();
    const act = (n) => { if (!actions.has(n)) { const c = clips.get(n); if (!c) return null; actions.set(n, mixer.clipAction(c)); } return actions.get(n); };
    // bûche portée contre la poitrine, en travers
    const log = makeLog(); log.scale.set(0.8, 0.9, 0.9); log.position.set(0, 1.12, 0.42); log.visible = false; holder.add(log);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.renderOrder = 1; scene.add(shadow);
    const a = { p, root, holder, mixer, act, cur: new Set(), log, shadow, hand, tool: root.getObjectByName(job.show[0]), lastAct: null, yaw: p.yaw, oneShot: null };
    list.set(p.id, a);
    return a;
  }

  // fondu vers un ensemble de clips (un seul, ou jambes + bras quand on porte)
  function play(a, names, { fade = 0.18, once = false, dur = null } = {}) {
    const key = names.join('+') + (once ? '!' + dur : '');
    if (a.key === key) return;
    a.key = key;
    const next = new Set();
    for (const n of names) {
      const ac = a.act(n); if (!ac) continue;
      next.add(ac);
      if (!a.cur.has(ac) || once) {
        ac.reset(); ac.enabled = true; ac.setEffectiveWeight(1);
        ac.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
        ac.clampWhenFinished = once;
        ac.timeScale = once && dur ? ac.getClip().duration / dur : 1;
        ac.fadeIn(fade).play();
      }
    }
    for (const ac of a.cur) if (!next.has(ac)) ac.fadeOut(fade);
    a.cur = next;
  }

  const ONCE = { chop: '1H_Melee_Attack_Chop', pick: 'PickUp', store: 'Interact', drop: 'PickUp' };

  function update(sim, dt, me) {
    for (const p of sim.players) if (!list.has(p.id) && !p._adding) { p._adding = true; add(p); }
    for (const [id, a] of list) {
      const p = sim.player(id);
      if (!p) { scene.remove(a.holder); scene.remove(a.shadow); list.delete(id); continue; }
      a.holder.position.set(p.x, p.y, p.z);
      // rotation adoucie (le moteur tourne vite)
      let d = p.yaw - a.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      a.yaw += d * (1 - Math.exp(-dt * 16)); a.holder.rotation.y = a.yaw;
      a.shadow.position.set(p.x, sim.map.heightAt(p.x, p.z) + 0.04, p.z);
      // ce que montre le personnage
      a.log.visible = p.carry === 'bois' && !(p.act === 'pick' && p.actT < ACT.pick.at) || (p.act === 'store' && p.actT < ACT.store.at) || (p.act === 'drop' && p.actT < ACT.drop.at);
      if (a.tool) a.tool.visible = !p.carry && !(p.act === 'pick' || p.act === 'store');
      if (p.act) {
        const dur = ACT[p.act].dur;
        // le même geste deux fois de suite (deuxième coup de hache) repart du début
        const tag = p.act + ':' + (p.act === p._lastAct && p.actT < a.lastT ? (a.n = (a.n || 0) + 1) : (a.n || 0));
        a.lastT = p.actT; p._lastAct = p.act;
        if (a.tag !== tag) { a.tag = tag; a.key = null; }
        play(a, [ONCE[p.act]], { once: true, dur, fade: 0.1 });
      } else if (!p.ground) play(a, ['Jump_Idle'], { fade: 0.12 });
      else if (p.carry) play(a, p.speed > 0.4 ? ['carryLegs', 'carryArms'] : ['carryIdleLegs', 'carryArms']);
      else if (p.speed > 3.6) play(a, ['Running_A'], { fade: 0.2 });
      else if (p.speed > 0.4) play(a, ['Walking_A'], { fade: 0.2 });
      else play(a, ['Idle'], { fade: 0.25 });
      if (!p.act) a.tag = null;
      // vitesse des pas calée sur le déplacement
      const run = a.act('Running_A'), walk = a.act('Walking_A'), legs = a.act('carryLegs');
      if (run && !p.act) run.timeScale = Math.max(0.6, p.speed / 5.2);
      if (walk && !p.act) walk.timeScale = Math.max(0.6, p.speed / 2.6);
      if (legs) legs.timeScale = Math.max(0.6, p.speed / 2.4);
      a.mixer.update(dt);
    }
  }
  function event() {}
  return { update, event, list };
}
