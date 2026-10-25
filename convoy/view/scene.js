// Convoy Storm — scène 3D (Three.js r169 embarqué). Décor : modèles Kenney (CC0) givrés + primitives low-poly.
// La scène vit dans le repère du train : le convoi reste à l'origine, la plaine et les ruines défilent vers +Z.
// createScene() monte le canevas ; dispose() libère tout (géométries, matériaux, textures, contexte WebGL, écouteurs).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { DECK_Y, HALF_W, REAR, BODY_FRONT, BOILER, DECK_BOXES, WAGONS, CHUNK, piecePos } from '../engine/world.js';
import { Ruins, DIFFICULTY, stationDist, STATION_NAMES, WARM_R, FLARE_R, LEVER, VALVE } from '../engine/sim.js';
import { hash, makeRng } from '../engine/rng.js';
import { loadKit, frost } from './models.js';
import { makeActors } from './actors.js';

// Caméra isométrique : décalage fixe par rapport au point suivi. CAM_DIR sert à l'entrée (haut de l'écran = CAM_DIR).
const CAM_OFF = new THREE.Vector3(11, 17, 15);
export const CAM_DIR = (() => { const l = Math.hypot(CAM_OFF.x, CAM_OFF.z); return { x: -CAM_OFF.x / l, z: -CAM_OFF.z / l }; })();
const FOG = 0xc3ced9, FOG_GUST = 0xdfe5ec;

export function createScene(host, { onLost } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 14, 56);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 220);
  let disposed = false;

  // ---------------------------------------------------------------- ressources partagées (libérées dans dispose)
  const owned = { geo: new Set(), mat: new Set(), tex: new Set() };
  const G = (g) => (owned.geo.add(g), g);
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true, ...o }); owned.mat.add(m); return m; };
  const F = (m, a = 1) => { const f = frost(m, a); owned.mat.add(f); return f; };
  const mesh = (geo, mat, cast = true, recv = true) => { const me = new THREE.Mesh(geo, mat); me.castShadow = cast; me.receiveShadow = recv; return me; };
  const MAT = {
    steel: M(0x4b525c, { metalness: 0.45, roughness: 0.55 }), dark: M(0x262a31, { metalness: 0.3 }), plate: M(0x6a5a48, { roughness: 0.95 }),
    rust: M(0x8a4b2e), red: M(0xb3362a), snow: M(0xf4f7fb, { roughness: 1 }), stone: M(0x8d8a86), concrete: M(0xa4a6a4), roof: M(0x5d4a3c),
    metal: M(0x5c6168, { metalness: 0.4 }), wood: M(0x7b5a3a), crate: M(0xc0821f), stripe: M(0x1d1f23),
    glow: M(0xff8a2a, { emissive: 0xff6a10, emissiveIntensity: 2.2 }),
    lamp: M(0xfff1c4, { emissive: 0xffe2a0, emissiveIntensity: 2 }), redLamp: M(0xff3b2f, { emissive: 0xff2010, emissiveIntensity: 2 }),
    loot: M(0xffd34d, { emissive: 0xffb020, emissiveIntensity: 1.6 }), lootOff: M(0x5a5f66), coal: M(0x18191c),
    brass: M(0xc8a24a, { metalness: 0.6, roughness: 0.35 }),
    window: M(0xffd98a, { emissive: 0xffb84a, emissiveIntensity: 1.4 }), flare: M(0xff3b2f, { emissive: 0xff2a10, emissiveIntensity: 4 }),
    warn: M(0xff4b2b, { emissive: 0xff2a10, emissiveIntensity: 0.6, transparent: true, opacity: 0.45, depthWrite: false }),
  };
  // version givrée des matériaux du décor
  const FM = { stone: F(MAT.stone), concrete: F(MAT.concrete), roof: F(MAT.roof), metal: F(MAT.metal), rust: F(MAT.rust), wood: F(MAT.wood), steel: F(MAT.steel, 0.6), dark: F(MAT.dark, 0.6), red: F(MAT.red, 0.5) };
  const GEO = {
    box: G(new THREE.BoxGeometry(1, 1, 1)), cyl10: G(new THREE.CylinderGeometry(1, 1, 1, 10)),
    wheel: G(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 10).rotateZ(Math.PI / 2)), ball: G(new THREE.IcosahedronGeometry(0.24, 1)),
    mound: G(new THREE.IcosahedronGeometry(1, 0)), crate: G(new THREE.BoxGeometry(0.5, 0.5, 0.5)), cone: G(new THREE.ConeGeometry(1, 1, 7)),
    ring: G(new THREE.RingGeometry(0.92, 1, 40)), plane: G(new THREE.PlaneGeometry(1, 1)),
  };
  const box = (w, h, d, mat, cast = true) => { const m = mesh(GEO.box, mat, cast); m.scale.set(w, h, d); return m; };

  // ---------------------------------------------------------------- lumières
  scene.add(new THREE.HemisphereLight(0xe2ebf5, 0x5f6b78, 1.05));
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.35);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- sol enneigé (texture dessinée en canevas)
  const snowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#eef2f7'; x.fillRect(0, 0, 256, 256);
    const r = makeRng(7);
    for (let i = 0; i < 900; i++) { const v = 220 + r.int(0, 30); x.fillStyle = `rgba(${v - 12},${v - 4},${v},${r.range(0.15, 0.5)})`; x.beginPath(); x.ellipse(r.range(0, 256), r.range(0, 256), r.range(2, 14), r.range(1, 4), r.range(0, 3), 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(36, 36); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    owned.tex.add(t); return t;
  })();
  const ground = mesh(G(new THREE.PlaneGeometry(360, 360)), M(0xffffff, { map: snowTex, roughness: 1, flatShading: false }), false, true);
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  // voie : ballast, rails, traverses (instanciées, recyclées en boucle)
  const track = new THREE.Group(); scene.add(track);
  const ballast = box(4.2, 0.12, 360, M(0x6f6a66), false); ballast.position.y = 0.06; ballast.receiveShadow = true; track.add(ballast);
  for (const sx of [-0.75, 0.75]) { const r = box(0.12, 0.16, 360, MAT.steel, false); r.position.set(sx, 0.26, 0); track.add(r); }
  const SLEEPERS = 200, SP = 1.2;
  const sleepers = new THREE.InstancedMesh(GEO.box, MAT.wood, SLEEPERS); sleepers.receiveShadow = true; track.add(sleepers);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(2.4, 0.12, 0.28), tmpP = new THREE.Vector3();

  // ---------------------------------------------------------------- le convoi
  const train = new THREE.Group(); scene.add(train);
  const wheels = [];
  const snowRoof = F(MAT.dark, 1);
  WAGONS.forEach(([z0, z1], wi) => {
    const len = z1 - z0, zc = (z0 + z1) / 2;
    const chassis = box(HALF_W * 2 - 0.2, 0.7, len - 0.2, MAT.dark); chassis.position.set(0, 0.85, zc); train.add(chassis);
    const dz0 = wi === 0 ? -12.9 : z0, deck = box(HALF_W * 2, 0.16, z1 - dz0, MAT.plate); deck.position.set(0, DECK_Y - 0.08, (z1 + dz0) / 2); train.add(deck);
    // jupes blindées légèrement inclinées, rivets, garde-corps
    const rz0 = wi === 0 ? -12.6 : z0 + 0.4, rlen = z1 - 0.4 - rz0;
    for (const s of [-1, 1]) {
      const sk = box(0.12, 0.85, len - 0.6, MAT.steel); sk.position.set(s * (HALF_W + 0.02), 1.0, zc); sk.rotation.z = s * 0.12; train.add(sk);
      for (let k = 0; k < Math.floor(len / 1.4); k++) { const rv = box(0.07, 0.07, 0.07, MAT.brass, false); rv.position.set(s * (HALF_W + 0.1), 1.3, z0 + 0.8 + k * 1.4); train.add(rv); }
      const rail = box(0.06, 0.06, rlen, MAT.steel, false); rail.position.set(s * (HALF_W - 0.05), DECK_Y + 0.75, rz0 + rlen / 2); train.add(rail);
      for (let k = 0; k <= Math.floor(rlen / 2.2); k++) { const post = box(0.06, 0.75, 0.06, MAT.steel, false); post.position.set(s * (HALF_W - 0.05), DECK_Y + 0.38, rz0 + k * 2.2); train.add(post); }
    }
    for (let i = 0; i < 2; i++) for (const s of [-1, 1]) {
      const w = mesh(GEO.wheel, MAT.dark); w.position.set(s * 1.2, 0.48, z0 + 1.6 + i * (len - 3.2)); train.add(w); wheels.push(w);
    }
  });
  // passerelles entre les wagons
  for (const zc of [-5.8, 5.8]) { const pl = box(1.6, 0.1, 1.0, MAT.steel); pl.position.set(0, DECK_Y - 0.06, zc); train.add(pl); }
  // locomotive : corps chaudière horizontal cerclé de laiton, cabine, chasse-neige, phare
  const lbody = mesh(GEO.cyl10, MAT.steel); lbody.scale.set(1.25, 6.2, 1.25); lbody.rotation.x = Math.PI / 2; lbody.position.set(0, DECK_Y + 1.15, -16.4); train.add(lbody);
  for (const z of [-18.6, -16.4, -14.2]) { const band = mesh(GEO.cyl10, MAT.brass); band.scale.set(1.29, 0.12, 1.29); band.rotation.x = Math.PI / 2; band.position.set(0, DECK_Y + 1.15, z); train.add(band); }
  const lsnow = box(1.4, 0.16, 5.4, MAT.snow, false); lsnow.position.set(0, DECK_Y + 2.38, -16.4); train.add(lsnow);
  const cab = box(2.4, 2.4, 3.4, MAT.red); cab.position.set(0, DECK_Y + 1.2, -11.5); train.add(cab);
  const cabRoof = box(2.9, 0.18, 3.9, snowRoof); cabRoof.position.set(0, DECK_Y + 2.5, -11.5); train.add(cabRoof);
  const cabSnow = box(2.7, 0.14, 3.6, MAT.snow, false); cabSnow.position.set(0, DECK_Y + 2.64, -11.5); train.add(cabSnow);
  for (const s of [-1, 1]) { const win = box(0.05, 0.6, 1.4, MAT.window, false); win.position.set(s * 1.22, DECK_Y + 1.7, -11.5); train.add(win); }
  const backWin = box(1.4, 0.55, 0.05, MAT.window, false); backWin.position.set(0, DECK_Y + 1.75, -9.79); train.add(backWin);
  const stack = mesh(GEO.cyl10, MAT.dark); stack.scale.set(0.32, 1.2, 0.32); stack.position.set(0, DECK_Y + 2.3, -17.6); train.add(stack);
  const stackTop = mesh(GEO.cyl10, MAT.dark); stackTop.scale.set(0.45, 0.25, 0.45); stackTop.position.set(0, DECK_Y + 2.95, -17.6); train.add(stackTop);
  for (const s of [-1, 1]) { const pw = box(2.6, 1.4, 0.18, F(MAT.red, 0.4)); pw.position.set(s * 0.95, 0.75, -19.0); pw.rotation.y = s * 0.62; train.add(pw); }
  const head = mesh(GEO.cyl10, MAT.lamp, false); head.scale.set(0.28, 0.2, 0.28); head.rotation.x = Math.PI / 2; head.position.set(0, DECK_Y + 1.15, -19.55); train.add(head);
  const beam = new THREE.SpotLight(0xffe7b0, 45, 40, 0.42, 0.6, 1.4); beam.position.set(0, DECK_Y + 1.2, -19.6); beam.target.position.set(0, 0, -40); train.add(beam, beam.target);
  // cône de lumière du phare, visible dans la neige
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }); owned.mat.add(coneMat);
  const lightCone = mesh(G(new THREE.ConeGeometry(4.5, 18, 16, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -9)), coneMat, false, false);
  lightCone.position.set(0, DECK_Y + 1.15, -19.6); lightCone.rotation.x = 0.06; train.add(lightCone);
  // la chaudière au centre : foyer rougeoyant, cheminée, manomètre, cercle de chaleur au sol
  const boilerMat = M(0x4b525c, { metalness: 0.45, roughness: 0.55, emissive: 0xff2a00, emissiveIntensity: 0 });
  const boiler = mesh(GEO.cyl10, boilerMat); boiler.scale.set(BOILER.r, BOILER.top - DECK_Y, BOILER.r); boiler.position.set(0, (BOILER.top + DECK_Y) / 2, 0); train.add(boiler);
  for (const y of [0.4, 1.1, 1.8]) { const band = mesh(GEO.cyl10, MAT.brass); band.scale.set(BOILER.r + 0.04, 0.1, BOILER.r + 0.04); band.position.set(0, DECK_Y + y, 0); train.add(band); }
  const mouthRim = mesh(G(new THREE.TorusGeometry(BOILER.mouth, 0.12, 6, 14)), MAT.dark); mouthRim.rotation.x = Math.PI / 2; mouthRim.position.set(0, BOILER.top + 0.02, 0); train.add(mouthRim);
  const fireMat = M(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 2.5 });
  const fire = mesh(G(new THREE.CircleGeometry(BOILER.mouth - 0.05, 12)), fireMat, false, false); fire.rotation.x = -Math.PI / 2; fire.position.set(0, BOILER.top - 0.05, 0); train.add(fire);
  const door = box(0.7, 0.6, 0.06, fireMat, false); door.position.set(0, DECK_Y + 0.55, BOILER.r + 0.02); train.add(door);
  const chim = mesh(GEO.cyl10, MAT.dark); chim.scale.set(0.28, 1.6, 0.28); chim.position.set(0.75, BOILER.top + 0.5, -0.5); train.add(chim);
  const gauge = mesh(GEO.cyl10, MAT.brass); gauge.scale.set(0.22, 0.06, 0.22); gauge.rotation.set(Math.PI / 2, 0, 0); gauge.position.set(-0.75, DECK_Y + 1.5, 0.95); train.add(gauge);
  const fireLight = new THREE.PointLight(0xff7a2a, 30, 14, 1.6); fireLight.position.set(0, BOILER.top + 0.6, 0); train.add(fireLight);
  const warmMat = new THREE.MeshBasicMaterial({ color: 0xff9a4a, transparent: true, opacity: 0.18, depthWrite: false }); owned.mat.add(warmMat);
  const warmRing = mesh(GEO.ring, warmMat, false, false); warmRing.rotation.x = -Math.PI / 2; warmRing.scale.setScalar(WARM_R); warmRing.position.set(0, DECK_Y + 0.02, 0); train.add(warmRing);
  // obstacles du plancher (soute à charbon, caisses de pièces)
  DECK_BOXES.slice(1).forEach((b, i) => {
    const o = box(b.x1 - b.x0, i === 0 ? 0.9 : 0.6, b.z1 - b.z0, i === 0 ? MAT.rust : MAT.metal); o.position.set((b.x0 + b.x1) / 2, DECK_Y + (i === 0 ? 0.45 : 0.3), (b.z0 + b.z1) / 2); train.add(o);
    if (i === 0) { const coal = box(b.x1 - b.x0 - 0.2, 0.1, b.z1 - b.z0 - 0.2, MAT.coal, false); coal.position.set(o.position.x, DECK_Y + 0.82, o.position.z); train.add(coal); }
  });
  // manette de vitesse, adossée à l'arrière de la cabine
  const leverBase = box(0.36, 0.9, 0.26, MAT.dark); leverBase.position.set(LEVER.x, DECK_Y + 0.45, -9.66); train.add(leverBase);
  const leverPiv = new THREE.Group(); leverPiv.position.set(LEVER.x, DECK_Y + 0.9, -9.62); train.add(leverPiv);
  const rod = box(0.07, 0.75, 0.07, MAT.brass, false); rod.position.y = 0.36; leverPiv.add(rod);
  const knob = mesh(GEO.ball, MAT.redLamp, false); knob.scale.setScalar(0.65); knob.position.y = 0.78; leverPiv.add(knob);
  for (let i = 0; i < 3; i++) { const n = box(0.3, 0.04, 0.04, i === 0 ? M(0x2fbf71) : i === 1 ? MAT.brass : MAT.redLamp, false); n.position.set(LEVER.x + 0.28, DECK_Y + 1.05 + i * 0.16, -9.75); train.add(n); }
  let leverA = 0;
  // soupape de la chaudière (volant rouge, côté avant) et manomètre
  const valveMat = M(0xd8342a, { metalness: 0.3 });
  const valvePiv = new THREE.Group(); valvePiv.position.set(VALVE.x, DECK_Y + 1.05, -BOILER.r - 0.12); train.add(valvePiv);
  const wheel = mesh(G(new THREE.TorusGeometry(0.24, 0.05, 6, 16)), valveMat); valvePiv.add(wheel);
  for (const r of [0, Math.PI / 2]) { const sp = box(0.46, 0.04, 0.04, valveMat, false); sp.rotation.z = r; valvePiv.add(sp); }
  const vstem = mesh(GEO.cyl10, MAT.brass); vstem.scale.set(0.06, 0.2, 0.06); vstem.rotation.x = Math.PI / 2; vstem.position.set(VALVE.x, DECK_Y + 1.05, -BOILER.r - 0.02); train.add(vstem);
  const dial = mesh(G(new THREE.CircleGeometry(0.2, 18)), M(0xfff8ea, { flatShading: false }), false, false); dial.position.set(0.55, DECK_Y + 1.6, -BOILER.r + 0.1); dial.rotation.y = Math.PI + 0.45; train.add(dial);
  const needle = box(0.02, 0.17, 0.01, MAT.redLamp, false); needle.geometry = GEO.box; const needlePiv = new THREE.Group(); needlePiv.position.copy(dial.position); needlePiv.rotation.y = dial.rotation.y; needlePiv.position.z -= 0.01; needle.position.y = 0.07; needlePiv.add(needle); train.add(needlePiv);
  let valveSpin = 0, steamT = 0;
  // fanaux de pont
  for (const [x, z] of [[HALF_W - 0.05, -6.6], [-HALF_W + 0.05, 6.6], [HALF_W - 0.05, 15.6]]) {
    const pole = box(0.06, 1.2, 0.06, MAT.steel, false); pole.position.set(x, DECK_Y + 0.6, z); train.add(pole);
    const lan = mesh(GEO.ball, MAT.lamp, false); lan.scale.setScalar(0.5); lan.position.set(x, DECK_Y + 1.25, z); train.add(lan);
  }
  // échelle de queue et feux rouges
  for (const s of [-0.55, 0.55]) {
    const rl = box(0.08, DECK_Y + 0.6, 0.08, MAT.steel); rl.position.set(s, (DECK_Y + 0.6) / 2, REAR + 0.12); train.add(rl);
    const lamp = mesh(GEO.ball, MAT.redLamp, false); lamp.scale.setScalar(0.5); lamp.position.set(s * 2.6, DECK_Y + 0.25, REAR + 0.05); train.add(lamp);
  }
  for (let i = 0; i < 4; i++) { const rg = box(1.1, 0.06, 0.06, MAT.steel); rg.position.set(0, 0.35 + i * 0.38, REAR + 0.14); train.add(rg); }

  // tache ronde et douce pour la fumée, les flocons, les étincelles
  const puffTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); owned.tex.add(t); return t;
  })();
  const points = (n, o) => {
    const geo = G(new THREE.BufferGeometry()); const pos = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: puffTex, transparent: true, depthWrite: false, ...o }); owned.mat.add(mat);
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    return { geo, pos, mat };
  };
  // fumée de la cheminée, étincelles du foyer
  const SMOKE = 70, smoke = points(SMOKE, { color: 0x55585e, size: 2.2, opacity: 0.55 }); const smokeAge = new Float32Array(SMOKE);
  for (let i = 0; i < SMOKE; i++) smokeAge[i] = i / SMOKE * 3;
  const SPARK = 24, spark = points(SPARK, { color: 0xffb04a, size: 0.25, blending: THREE.AdditiveBlending }); const sparkAge = new Float32Array(SPARK);
  for (let i = 0; i < SPARK; i++) sparkAge[i] = i / SPARK * 1.2;
  // blizzard
  const SNOW = 2600, BOX = { x: 46, y: 16, z: 46 };
  const snow = points(SNOW, { color: 0xffffff, size: 0.2, opacity: 0.95, fog: false }); const flakes = snow.pos; const fr = makeRng(99);
  for (let i = 0; i < SNOW; i++) { flakes[i * 3] = fr.range(-BOX.x / 2, BOX.x / 2); flakes[i * 3 + 1] = fr.range(0, BOX.y); flakes[i * 3 + 2] = fr.range(-BOX.z / 2, BOX.z / 2); }
  // bouffées de neige (avalanche, congère déblayée, chute)
  const PUFF = 160, puff = points(PUFF, { color: 0xffffff, size: 1.6, opacity: 0.85 });
  const puffVel = new Float32Array(PUFF * 3), puffLife = new Float32Array(PUFF);
  let puffI = 0;
  function burst(x, y, z, n = 30, spread = 3, up = 3) {
    for (let k = 0; k < n; k++) {
      const i = puffI = (puffI + 1) % PUFF;
      puff.pos[i * 3] = x + (Math.random() - 0.5) * spread; puff.pos[i * 3 + 1] = y + Math.random(); puff.pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
      puffVel[i * 3] = (Math.random() - 0.5) * 4; puffVel[i * 3 + 1] = Math.random() * up; puffVel[i * 3 + 2] = (Math.random() - 0.5) * 4;
      puffLife[i] = 1 + Math.random() * 0.8;
    }
  }

  // ---------------------------------------------------------------- ruines (construites à la demande, recyclées)
  let ruins = null; const ruinMeshes = new Map(); const ruinsGroup = new THREE.Group(); scene.add(ruinsGroup);
  function buildRuin(r) {
    const g = new THREE.Group();
    for (const pc of r.pieces) {
      const p = piecePos(r, pc);
      const model = typeof pc.m === 'string' && pc.m.startsWith('model:') ? pc.m.slice(6) : null;
      let m = model && kit ? kit.make(model, pc.w, pc.h, pc.d) : null;
      if (m) { m.position.set(p.x, 0, p.zw); m.rotation.y = -p.rot; g.add(m); continue; }
      m = box(pc.w, pc.h, pc.d, FM[model ? 'stone' : pc.m] || FM.stone);
      m.position.set(p.x, pc.h / 2, p.zw); m.rotation.y = -p.rot; g.add(m);
      if (pc.h > 0.6) { const cap = box(pc.w + 0.05, 0.14, pc.d + 0.05, MAT.snow, false); cap.position.set(p.x, pc.h + 0.06, p.zw); cap.rotation.y = -p.rot; g.add(cap); }
    }
    const rr = makeRng(r.seed);
    for (let i = 0; i < 4; i++) { const m = mesh(GEO.mound, MAT.snow, false); m.scale.set(rr.range(0.8, 2.4), rr.range(0.3, 0.8), rr.range(0.8, 2.2)); m.position.set(r.x + rr.range(-4.5, 4.5), 0, r.zw + rr.range(-4.5, 4.5)); g.add(m); }
    // lanterne du point de fouille (éteinte une fois fouillée)
    const post = box(0.08, 1.2, 0.08, MAT.dark); post.position.set(r.spot.x, 0.6, r.spot.zw); g.add(post);
    const lan = mesh(GEO.ball, MAT.loot, false); lan.scale.setScalar(0.7); lan.position.set(r.spot.x, 1.3, r.spot.zw); g.add(lan);
    if (r.kind === 'camp' && kit) { const fl = kit.make('arena/banner', 0.9, 1.8, 0.4); if (fl) { fl.position.set(r.spot.x - r.side * 0.6, 0, r.spot.zw - 0.8); g.add(fl); } }
    g.userData = { lan, loot: (r.loot || 0) + (r.scrap || 0) };
    return g;
  }
  // monticules de neige, poteaux et sapins par tronçon
  const moundGroups = new Map();
  const pineMat = F(M(0x2f5d4a), 1), trunkMat = MAT.wood;
  function buildMounds(seed, k, chunk) {
    const g = new THREE.Group(); const rr = makeRng(hash(seed * 31 + k));
    for (let i = 0; i < 7; i++) {
      const m = mesh(GEO.mound, MAT.snow, false); const side = rr.chance(0.5) ? -1 : 1;
      m.scale.set(rr.range(1, 4), rr.range(0.25, 0.9), rr.range(1, 3.5)); m.rotation.y = rr.range(0, 3);
      m.position.set(side * rr.range(3.5, 34), -0.05, -k * CHUNK - rr.range(0, CHUNK)); g.add(m);
    }
    if (rr.chance(0.5)) { // poteau télégraphique penché
      const p = box(0.18, 4.5, 0.18, FM.wood); p.position.set((rr.chance(0.5) ? -1 : 1) * 4.2, 2.1, -k * CHUNK - rr.range(0, CHUNK)); p.rotation.z = rr.range(-0.25, 0.25); g.add(p);
    }
    for (const t of (chunk && chunk.trees) || []) {
      const h = 5.6 * t.s;
      let tr = kit && kit.make('arena/tree', 2.2 * t.s, h, 2.2 * t.s);
      if (!tr) {
        tr = new THREE.Group();
        const tk = box(0.3 * t.s, h * 0.3, 0.3 * t.s, trunkMat); tk.position.y = h * 0.15; tr.add(tk);
        for (let j = 0; j < 3; j++) { const c = mesh(GEO.cone, pineMat); c.scale.set((1.3 - j * 0.3) * t.s, h * 0.4, (1.3 - j * 0.3) * t.s); c.position.y = h * (0.4 + j * 0.2); tr.add(c); }
      }
      tr.position.set(t.x, 0, t.zw); tr.rotation.y = t.r; g.add(tr);
    }
    return g;
  }

  // ---------------------------------------------------------------- gares et ville d'arrivée
  const setpieces = new Map();
  function signTex(text, sub) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
    x.fillStyle = '#16181d'; x.fillRect(0, 0, 512, 160); x.strokeStyle = '#ffc531'; x.lineWidth = 10; x.strokeRect(8, 8, 496, 144);
    x.fillStyle = '#fff8ea'; x.textAlign = 'center'; x.font = '900 52px Bungee, Impact, sans-serif'; x.fillText(text.toUpperCase(), 256, 84, 470);
    if (sub) { x.fillStyle = '#ffc531'; x.font = '700 28px "Chakra Petch", sans-serif'; x.fillText(sub, 256, 130); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; owned.tex.add(t); return t;
  }
  function lampPost(x, z, g) {
    const dir = x > 0 ? -1 : 1;
    const p = box(0.14, 3.6, 0.14, FM.dark); p.position.set(x, 1.8, z); g.add(p);
    const arm = box(0.9, 0.1, 0.1, FM.dark); arm.position.set(x + 0.4 * dir, 3.55, z); g.add(arm);
    const l = mesh(GEO.ball, MAT.lamp, false); l.scale.setScalar(0.7); l.position.set(x + 0.8 * dir, 3.4, z); g.add(l);
  }
  function model(name, w, h, d, opts, fallMat) {
    const m = kit && kit.make(name, w, h, d, opts);
    if (m) return m;
    const b = box(w, h, d, fallMat || FM.concrete); b.position.y = h / 2; const g = new THREE.Group(); g.add(b); return g;
  }
  function buildStation(i, zw) {
    const g = new THREE.Group();
    const qx = -(HALF_W + 2.6);
    // quai côté gauche (les caisses de la gare y sont posées), dépôt, abri, lampadaires, panneau
    const quai = box(3.2, 0.14, 34, FM.concrete); quai.position.set(qx, 0.07, zw); g.add(quai);
    const edge = box(0.12, 0.16, 34, MAT.brass, false); edge.position.set(qx + 1.55, 0.1, zw); g.add(edge);
    const dep = model('city/building-garage', 7, 3.9, 7, { cleanLook: true }); dep.position.set(-(HALF_W + 9.2), 0, zw - 4); dep.rotation.y = Math.PI / 2; g.add(dep);
    for (let k = 0; k < 3; k++) { const w = box(0.06, 0.7, 1.2, MAT.window, false); w.position.set(-(HALF_W + 5.66), 1.6, zw - 6.5 + k * 2.2); g.add(w); }
    const shelter = box(3.2, 0.16, 8, FM.roof); shelter.position.set(qx - 0.2, 2.9, zw + 6); g.add(shelter);
    for (const dz of [2.4, 9.6]) for (const dx of [-1.4, 1.4]) { const c = box(0.14, 2.8, 0.14, FM.dark); c.position.set(qx - 0.2 + dx, 1.4, zw + dz); g.add(c); }
    for (const dz of [-14, -4, 6, 14]) lampPost(-(HALF_W + 4.4), zw + dz, g);
    const sm = new THREE.MeshBasicMaterial({ map: signTex(STATION_NAMES[i % STATION_NAMES.length], `Gare n° ${i + 1} · ravitaillement`) }); owned.mat.add(sm);
    const sign = mesh(G(new THREE.PlaneGeometry(4.2, 1.3)), sm, false, false); sign.position.set(-(HALF_W + 4.4), 4.4, zw + 0.5); sign.rotation.y = Math.PI / 2 - 0.5; g.add(sign);
    for (const dz of [-1.4, 2.4]) { const sp = box(0.1, 4.4, 0.1, FM.dark); sp.position.set(-(HALF_W + 4.5), 2.2, zw + dz); g.add(sp); }
    const lt = new THREE.PointLight(0xffd59a, 40, 22, 1.5); lt.position.set(-(HALF_W + 3.5), 4, zw); g.add(lt);
    const flag = kit && kit.make('platformer/flag', 1, 2.6, 1); if (flag) { flag.position.set(-(HALF_W + 6), 0, zw + 12); g.add(flag); }
    return { g };
  }
  function buildCity(zw) {
    const g = new THREE.Group();
    const names = ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d'];
    const HR = { 'building-small-a': 0.95, 'building-small-b': 1.63, 'building-small-c': 1.75, 'building-small-d': 1.0 };
    const rr = makeRng(424242);
    for (const side of [-1, 1]) for (let k = 0; k < 8; k++) {
      const n = names[(k + (side > 0 ? 2 : 0)) % 4], S = rr.range(5, 6.5), H = HR[n] * S;
      const b = model('city/' + n, S, H, S, { cleanLook: true });
      b.position.set(side * (HALF_W + 8.5 + rr.range(0, 5)), 0, zw - 34 + k * 7.5); b.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(b);
      for (let w = 0; w < 3; w++) { const win = box(0.05, 0.6, 0.9, MAT.window, false); win.position.set(b.position.x - side * (S / 2 + 0.03), 1.4 + (w % 2) * 1.8, b.position.z - 1.5 + w * 1.4); g.add(win); }
    }
    // porte de la ville, braseros, grand panneau
    const gz = zw + 26; // le convoi s'arrête juste après la porte
    for (const s of [-1, 1]) {
      const tw = box(1.4, 7, 1.4, FM.stone); tw.position.set(s * (HALF_W + 2.4), 3.5, gz); g.add(tw);
      const brz = mesh(GEO.ball, MAT.glow, false); brz.scale.setScalar(1.4); brz.position.set(s * (HALF_W + 2.4), 7.4, gz); g.add(brz);
    }
    const top = box(2 * (HALF_W + 2.4) + 1.4, 1.2, 1.4, FM.stone); top.position.set(0, 7.6, gz); g.add(top);
    const sm = new THREE.MeshBasicMaterial({ map: signTex('Fort-Givre', 'Terminus · bienvenue') }); owned.mat.add(sm);
    const sign = mesh(G(new THREE.PlaneGeometry(6, 1.9)), sm, false, false); sign.position.set(0, 7.6, gz + 0.75); g.add(sign);
    for (let k = 0; k < 6; k++) lampPost((k % 2 ? 1 : -1) * (HALF_W + 3.6), zw - 20 + k * 8, g);
    const lt = new THREE.PointLight(0xffc27a, 70, 40, 1.4); lt.position.set(0, 7, zw - 10); g.add(lt);
    return { g };
  }

  // congère sur la voie, zone d'avalanche, fusées
  const driftG = new THREE.Group(); scene.add(driftG);
  for (let i = 0; i < 6; i++) { const m = mesh(GEO.mound, MAT.snow, true); m.scale.set(1.8 + (i % 3) * 0.5, 1.2 + (i % 2) * 0.5, 1.4); m.position.set(-3.2 + i * 1.3, 0.2, (i % 2) * 0.5 - 0.2); driftG.add(m); }
  const driftStripe = box(7.5, 0.05, 0.4, MAT.warn, false); driftStripe.position.set(0, 0.03, 2.2); driftG.add(driftStripe);
  driftG.visible = false;
  const avalZone = mesh(GEO.plane, MAT.warn, false, false); avalZone.rotation.x = -Math.PI / 2; avalZone.visible = false; scene.add(avalZone);
  const flareLights = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xff4a2a, 0, FLARE_R * 2.2, 1.5); scene.add(l); return l; });
  const flareMeshes = new Map();
  const flareRingMat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.22, depthWrite: false }); owned.mat.add(flareRingMat);

  // modèles Kenney (chargés en arrière-plan ; le décor déjà affiché est reconstruit à leur arrivée)
  let kit = null;
  const actors = makeActors();
  loadKit(new URL('../models/', import.meta.url).href).then((k) => {
    if (disposed) { k.dispose(); return; }
    kit = k;
    for (const g of ruinMeshes.values()) ruinsGroup.remove(g); ruinMeshes.clear();
    for (const g of moundGroups.values()) ruinsGroup.remove(g); moundGroups.clear();
    for (const s of setpieces.values()) scene.remove(s.g); setpieces.clear();
  }).catch((e) => console.warn(e));

  // ---------------------------------------------------------------- pannes à bord
  const faultMeshes = new Map();
  const iceMat = M(0xa8dcff, { emissive: 0x3a8fd8, emissiveIntensity: 0.5, roughness: 0.3, transparent: true, opacity: 0.9 });
  const oilMat = M(0x14110e, { roughness: 0.15, metalness: 0.4, flatShading: false });
  const markMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.6, depthWrite: false }); owned.mat.add(markMat);
  function buildFault(f) {
    const g = new THREE.Group();
    if (f.k === 'pipe') {
      const pipe = mesh(GEO.cyl10, MAT.metal); pipe.scale.set(0.1, 1.6, 0.1); pipe.rotation.x = Math.PI / 2; pipe.position.set(Math.sign(f.x) * 0.25, 0.35, 0); g.add(pipe);
      const ice = new THREE.Group(); g.add(ice);
      for (let i = 0; i < 5; i++) { const c = mesh(GEO.mound, iceMat, false); c.scale.set(0.16 + (i % 2) * 0.06, 0.32 + (i % 3) * 0.1, 0.16); c.position.set(Math.sign(f.x) * 0.25 + (i % 2 ? 0.08 : -0.08), 0.42, -0.6 + i * 0.3); c.rotation.set(i, i * 2, 0); ice.add(c); }
      g.userData.shrink = ice;
    } else {
      const puddle = mesh(G(new THREE.CircleGeometry(0.75, 16)), oilMat, false, false); puddle.rotation.x = -Math.PI / 2; puddle.position.y = 0.02; g.add(puddle);
      const can = mesh(GEO.cyl10, MAT.rust); can.scale.set(0.22, 0.5, 0.22); can.position.set(Math.sign(f.x) * 0.25, 0.25, 0.3); can.rotation.z = 1.4; g.add(can);
      g.userData.shrink = puddle;
    }
    const ring = mesh(GEO.ring, markMat, false, false); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(0.95); ring.position.y = 0.04; g.add(ring);
    const bang = mesh(GEO.ball, MAT.redLamp, false); bang.scale.setScalar(0.6); bang.position.y = 1.5; g.add(bang);
    g.userData.ring = ring; g.userData.bang = bang;
    g.position.set(f.x, DECK_Y, f.z);
    return g;
  }

  // ---------------------------------------------------------------- front de tempête : un mur de neige qui suit le convoi
  const stormTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(60,68,84,0)'); gr.addColorStop(0.18, 'rgba(62,70,88,.75)'); gr.addColorStop(0.6, 'rgba(92,102,120,.95)'); gr.addColorStop(1, 'rgba(206,214,226,1)');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 256);
    const r = makeRng(5);
    x.filter = 'blur(5px)';
    const blob = (bx, by, rx, ry, col) => { for (const o of [-512, 0, 512]) { x.fillStyle = col; x.beginPath(); x.ellipse(bx + o, by, rx, ry, 0, 0, 7); x.fill(); } };
    for (let i = 0; i < 220; i++) { const v = r.int(40, 110); blob(r.range(0, 512), r.range(30, 200), r.range(25, 90), r.range(10, 34), `rgba(${v},${v + 8},${v + 22},${r.range(0.15, 0.45)})`); }
    for (let i = 0; i < 160; i++) blob(r.range(0, 512), r.range(60, 256), r.range(20, 70), r.range(3, 9), `rgba(235,242,250,${r.range(0.1, 0.35)})`); // rafales de neige
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; owned.tex.add(t); return t;
  })();
  const stormG = new THREE.Group(); scene.add(stormG);
  const stormMats = [0, 1, 2].map((i) => { const m = new THREE.MeshBasicMaterial({ map: stormTex.clone(), transparent: true, opacity: 0.92 - i * 0.12, depthWrite: false, fog: false, side: THREE.DoubleSide }); m.map.wrapS = THREE.RepeatWrapping; m.map.repeat.set(2 + i, 1); owned.tex.add(m.map); owned.mat.add(m); return m; });
  stormMats.forEach((m, i) => { const pl = mesh(GEO.plane, m, false, false); pl.scale.set(260, 46 + i * 8, 1); pl.position.set(0, 18 + i * 3, i * 5); stormG.add(pl); });
  // ombre du front au sol (visible d'en haut) : un voile sombre qui commence pile au front
  const shadeTex = (() => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(70,78,94,0)'); gr.addColorStop(0.25, 'rgba(70,78,94,.55)'); gr.addColorStop(1, 'rgba(60,66,80,.95)');
    x.fillStyle = gr; x.fillRect(0, 0, 8, 128);
    const t = new THREE.CanvasTexture(c); owned.tex.add(t); return t;
  })();
  const shadeMat = new THREE.MeshBasicMaterial({ map: shadeTex, transparent: true, depthWrite: false, fog: false }); owned.mat.add(shadeMat);
  const shade = mesh(GEO.plane, shadeMat, false, false); shade.rotation.x = -Math.PI / 2; shade.scale.set(260, 70, 1); shade.position.set(0, 0.35, -35 + 35); stormG.add(shade);
  shade.position.z = 35; // transparent côté convoi, de plus en plus sombre derrière le front
  const stormLight = new THREE.PointLight(0xdfe8ff, 0, 120, 1.2); stormG.add(stormLight); stormLight.position.set(0, 20, 8);
  let flashT = 0;

  // ---------------------------------------------------------------- pillards en motoneige
  const raiders = new Map();
  const RM = { body: M(0x5a1f1a), dark: M(0x1c1d21), coat: M(0x3a3026), scarf: M(0xd8342a), skin: M(0xc79a7a), glass: new THREE.MeshStandardMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.5, roughness: 0.1 }) };
  owned.mat.add(RM.glass);
  function buildRaider() {
    const g = new THREE.Group(), sled = new THREE.Group(); g.add(sled);
    const b = box(0.9, 0.45, 2.0, RM.body); b.position.y = 0.55; sled.add(b);
    const hood = box(0.8, 0.3, 0.7, RM.body); hood.position.set(0, 0.75, -0.75); hood.rotation.x = 0.35; sled.add(hood);
    const scr = box(0.75, 0.4, 0.04, RM.glass, false); scr.position.set(0, 1.05, -0.45); scr.rotation.x = -0.5; sled.add(scr);
    const seat = box(0.6, 0.18, 0.9, RM.dark); seat.position.set(0, 0.85, 0.3); sled.add(seat);
    for (const sx of [-0.55, 0.55]) { const ski = box(0.12, 0.06, 2.3, MAT.steel); ski.position.set(sx, 0.08, -0.1); sled.add(ski); const st = box(0.06, 0.4, 0.06, MAT.steel); st.position.set(sx, 0.28, -0.6); sled.add(st); }
    const tread = box(0.6, 0.3, 1.1, RM.dark); tread.position.set(0, 0.25, 0.55); sled.add(tread);
    const lamp = mesh(GEO.ball, MAT.lamp, false); lamp.scale.setScalar(0.5); lamp.position.set(0, 0.75, -1.1); sled.add(lamp);
    const rider = new THREE.Group(); rider.position.set(0, 0.95, 0.25); sled.add(rider);
    const torso = box(0.55, 0.7, 0.4, RM.coat); torso.position.y = 0.4; rider.add(torso);
    const head = mesh(GEO.ball, RM.skin); head.scale.setScalar(1.05); head.position.y = 0.95; rider.add(head);
    const scarf = box(0.42, 0.14, 0.42, RM.scarf); scarf.position.y = 0.8; rider.add(scarf);
    const gog = box(0.36, 0.08, 0.1, RM.glass, false); gog.position.set(0, 0.99, -0.2); rider.add(gog);
    const cap = box(0.38, 0.14, 0.38, RM.dark); cap.position.y = 1.12; rider.add(cap);
    for (const sx of [-0.32, 0.32]) { const arm = box(0.14, 0.5, 0.14, RM.coat); arm.position.set(sx, 0.45, -0.25); arm.rotation.x = -1.1; rider.add(arm); }
    const crate = makeCrate(); crate.position.set(0, 1.0, 0.85); sled.add(crate);
    const flag = box(0.04, 1.4, 0.04, MAT.dark, false); flag.position.set(0.35, 1.4, 0.95); sled.add(flag);
    const cloth = box(0.02, 0.35, 0.5, RM.scarf, false); cloth.position.set(0.35, 1.95, 1.2); sled.add(cloth);
    g.scale.setScalar(1.2);
    return { g, sled, rider, crate, cloth };
  }

  // ---------------------------------------------------------------- joueurs, loups et caisses
  const players = new Map();
  function labelTex(name, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = '700 30px "Chakra Petch", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = Math.min(240, x.measureText(name).width + 28);
    x.fillStyle = 'rgba(14,16,20,.78)'; x.beginPath(); x.roundRect(128 - w / 2, 10, w, 44, 12); x.fill();
    x.fillStyle = color; x.fillRect(128 - w / 2 + 8, 26, 8, 12);
    x.fillStyle = '#fff'; x.fillText(name, 136, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function makeCrate() {
    const g = new THREE.Group();
    g.add(mesh(GEO.crate, MAT.crate));
    const s = mesh(GEO.crate, MAT.stripe, false); s.scale.set(1.02, 0.18, 1.02); g.add(s);
    const s2 = mesh(GEO.crate, MAT.stripe, false); s2.scale.set(0.18, 1.02, 1.03); g.add(s2);
    return g;
  }
  function buildPlayer(p) {
    const o = actors.survivor(p.color);
    const crate = makeCrate(); crate.position.set(0, 2.15, 0.05); crate.visible = false; o.root.add(crate);
    const tex = labelTex(p.name, p.color);
    const labMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const label = new THREE.Sprite(labMat); label.scale.set(2.4, 0.6, 1); label.position.y = 2.85; label.renderOrder = 10; o.g.add(label);
    scene.add(o.g);
    o.crate = crate; o.label = label; o.own.push(tex, labMat); o.name = p.name; o.color = p.color;
    return o;
  }
  const crates = new Map();
  const wolves = new Map();

  // ---------------------------------------------------------------- dimensionnement
  let W = 1, H = 1;
  const ro = new ResizeObserver(() => resize()); ro.observe(host);
  function resize() {
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false); camera.aspect = W / H;
    camera.fov = W / H < 0.8 ? 52 : 38; // portrait : on recule un peu
    camera.updateProjectionMatrix();
  }
  resize();
  const onCtxLost = (e) => { e.preventDefault(); onLost && onLost(); };
  canvas.addEventListener('webglcontextlost', onCtxLost);

  // ---------------------------------------------------------------- image
  const focus = new THREE.Vector3(0, 0, 0);
  let camInit = false, wheelA = 0, lastSeed = null, lastDiff = null, shake = 0, gustK = 0, lastDrift = null;
  const v3 = new THREE.Vector3();
  const fogC = new THREE.Color(FOG), fogG = new THREE.Color(FOG_GUST), fogS = new THREE.Color(0x8e99a8);
  const camLook = new THREE.Vector3(), cp = new THREE.Vector3(), cl = new THREE.Vector3();
  // intro : travelling le long du convoi, vers le front de tempête, puis retour à la vue de jeu
  function cinematic(k, gap) {
    const g = Math.min(140, Math.max(30, gap || 90));
    const keys = [
      [0, [16, 3.5, -46], [0, 2, -16]],
      [0.22, [10, 4.5, -8], [0, 2.6, 0]],
      [0.45, [-7, 6, 12], [0, 5, g]],
      [0.68, [-3, 9, g * 0.45], [0, 9, g]],
      [0.86, [5, 17, 24], [0, 0, -6]],
      [1, [camera.position.x, camera.position.y, camera.position.z], [camLook.x, camLook.y, camLook.z]],
    ];
    let i = 0; while (i < keys.length - 2 && k > keys[i + 1][0]) i++;
    const [k0, p0, l0] = keys[i], [k1, p1, l1] = keys[i + 1];
    let f = Math.min(1, Math.max(0, (k - k0) / (k1 - k0))); f = f * f * (3 - 2 * f);
    cp.set(p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f);
    cl.set(l0[0] + (l1[0] - l0[0]) * f, l0[1] + (l1[1] - l0[1]) * f, l0[2] + (l1[2] - l0[2]) * f);
    camera.position.copy(cp); camLook.copy(cl);
  }

  function frame(view, dt) {
    if (view.seed !== lastSeed || view.diff !== lastDiff) {
      reset(); lastSeed = view.seed; lastDiff = view.diff;
      ruins = new Ruins(view.seed, DIFFICULTY[view.diff]?.loot ?? 0.6);
    }
    const bl = view.diff === 'blizzard';
    const dist = view.dist;
    // bourrasque : brouillard plus épais et plus clair, flocons plus gros et plus rapides
    gustK += ((view.gust > 0 ? 1 : 0) - gustK) * Math.min(1, dt * 1.5);
    scene.fog.near = (bl ? 9 : 14) - gustK * 6; scene.fog.far = (bl ? 42 : 56) - gustK * 22;
    scene.fog.color.copy(fogC).lerp(fogG, gustK); scene.background.copy(scene.fog.color);
    snow.mat.size = (bl ? 0.26 : 0.2) + gustK * 0.14;
    // caméra : suit le joueur local (ou le convoi)
    const fx = view.focus.x, fz = view.focus.z;
    if (!camInit) { focus.set(fx, 0, fz); camInit = true; }
    focus.x += (fx - focus.x) * Math.min(1, dt * 4); focus.z += (fz - focus.z) * Math.min(1, dt * 4);
    shake = Math.max(0, shake - dt * 2);
    camera.position.copy(focus).add(CAM_OFF);
    camLook.set(focus.x, 0.8, focus.z - 1.5);
    if (view.cine != null) cinematic(view.cine, view.gap);
    if (shake > 0) camera.position.add(v3.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
    camera.lookAt(camLook);
    sun.position.set(focus.x - 9, 24, focus.z + 7); sun.target.position.set(focus.x, 0, focus.z);
    ground.position.set(Math.round(focus.x / 10) * 10, 0, Math.round(focus.z / 10) * 10);
    snowTex.offset.set(ground.position.x / 10, (dist - ground.position.z) / 10 % 1);

    // voie
    const zb = focus.z, L = SLEEPERS * SP;
    for (let i = 0; i < SLEEPERS; i++) {
      const z = (((i * SP + dist - zb) % L) + L) % L - L / 2 + zb;
      tmpP.set(0, 0.15, z); tmpM.compose(tmpP, tmpQ, tmpS); sleepers.setMatrixAt(i, tmpM);
    }
    sleepers.instanceMatrix.needsUpdate = true;

    // roues et secousses du train
    wheelA += (view.speed / 0.42) * dt; for (const w of wheels) w.rotation.x = -wheelA;
    train.position.y = view.speed > 0.1 ? Math.sin(view.t * 9) * 0.015 * view.speed : 0;

    // chaudière : feu et lumière selon le carburant
    const f = Math.min(1, view.fuel / 100), flick = 0.85 + Math.sin(view.t * 23) * 0.08 + Math.sin(view.t * 7.3) * 0.07;
    fireMat.emissiveIntensity = (0.3 + 2.6 * f) * flick;
    fireLight.intensity = (4 + 34 * f) * flick;
    fire.scale.setScalar(0.4 + 0.6 * Math.min(1, f * 1.6));
    beam.intensity = view.speed > 0.05 ? 45 : 18; coneMat.opacity = view.speed > 0.05 ? 0.1 : 0.05;
    warmMat.opacity = view.fuel > 0 ? 0.1 + 0.07 * Math.sin(view.t * 3) : 0;
    // pression : la chaudière rougit, l'aiguille monte, la vapeur fuit ; manette selon le régime
    const pr = Math.max(0, Math.min(100, view.press || 0)) / 100;
    boilerMat.emissiveIntensity = pr > 0.6 ? (pr - 0.6) * 2.2 * (0.7 + 0.3 * Math.sin(view.t * (8 + pr * 14))) : 0;
    needlePiv.rotation.z = 2.2 - pr * 4.4;
    leverA += ((view.thr - 1) * -0.65 - leverA) * Math.min(1, dt * 8); leverPiv.rotation.x = leverA;
    const venting = view.players.some((p) => p.dig && p.on && Math.hypot(p.x - VALVE.x, p.z - VALVE.z) < VALVE.r);
    if (venting) steamT = 0.2;
    steamT -= dt; valveSpin += (steamT > 0 ? 9 : 0) * dt; valvePiv.rotation.z = valveSpin;
    if ((steamT > 0 && Math.random() < 0.6) || (pr > 0.75 && Math.random() < pr - 0.7)) burst(VALVE.x + (Math.random() - 0.5) * 0.3, DECK_Y + 1.3, VALVE.z - 0.2, 2, 0.4, 3.5);
    if (pr > 0.85) shake = Math.max(shake, (pr - 0.85) * 0.5);

    // fumée : sort de la cheminée, file vers l'arrière
    for (let i = 0; i < SMOKE; i++) {
      smokeAge[i] += dt * (0.6 + f); if (smokeAge[i] > 3) smokeAge[i] -= 3;
      const a = smokeAge[i];
      smoke.pos[i * 3] = 0.75 + Math.sin(i * 1.7 + a) * 0.3 * a + a * 1.1;
      smoke.pos[i * 3 + 1] = BOILER.top + 1.3 + a * 1.4;
      smoke.pos[i * 3 + 2] = -0.5 + a * (1.5 + view.speed * 1.2);
    }
    smoke.geo.attributes.position.needsUpdate = true; smoke.mat.opacity = 0.15 + 0.45 * f;
    for (let i = 0; i < SPARK; i++) {
      sparkAge[i] += dt; if (sparkAge[i] > 1.2) sparkAge[i] -= 1.2;
      const a = sparkAge[i];
      spark.pos[i * 3] = Math.sin(i * 2.3) * 0.5 + Math.sin(i + a * 4) * 0.2; spark.pos[i * 3 + 1] = BOILER.top + a * 2.4; spark.pos[i * 3 + 2] = Math.cos(i * 2.3) * 0.5 + a * view.speed * 0.8;
    }
    spark.geo.attributes.position.needsUpdate = true; spark.mat.opacity = f > 0 ? 0.9 * f : 0;

    // blizzard : vent latéral (renforcé et orienté par la bourrasque)
    const gs = view.gust > 0 ? (view.ev?.side || 1) : 1;
    const wx = 7 * gs * (1 + gustK * 1.6), wy = -3.2 - gustK, wz = 3 + view.speed;
    for (let i = 0; i < SNOW; i++) {
      let x = flakes[i * 3] + (wx + Math.sin(i + view.t * 2) * 1.5) * dt, y = flakes[i * 3 + 1] + wy * dt, z = flakes[i * 3 + 2] + wz * dt;
      if (y < 0) y += BOX.y;
      const dx = x - focus.x, dz = z - focus.z;
      if (dx > BOX.x / 2) x -= BOX.x; else if (dx < -BOX.x / 2) x += BOX.x;
      if (dz > BOX.z / 2) z -= BOX.z; else if (dz < -BOX.z / 2) z += BOX.z;
      flakes[i * 3] = x; flakes[i * 3 + 1] = y; flakes[i * 3 + 2] = z;
    }
    snow.geo.attributes.position.needsUpdate = true;
    // bouffées
    for (let i = 0; i < PUFF; i++) {
      if (puffLife[i] <= 0) { puff.pos[i * 3 + 1] = -50; continue; }
      puffLife[i] -= dt; puffVel[i * 3 + 1] -= 3 * dt;
      puff.pos[i * 3] += puffVel[i * 3] * dt; puff.pos[i * 3 + 1] = Math.max(0.2, puff.pos[i * 3 + 1] + puffVel[i * 3 + 1] * dt); puff.pos[i * 3 + 2] += (puffVel[i * 3 + 2] + view.speed) * dt;
    }
    puff.geo.attributes.position.needsUpdate = true;

    // ruines, monticules et sapins du voisinage (repère du sol → décalage de dist)
    ruinsGroup.position.z = dist;
    const live = new Set(), liveK = new Set();
    for (const [k, c] of ruins.around(dist)) {
      liveK.add(k);
      if (!moundGroups.has(k)) { const g = buildMounds(view.seed, k, c); moundGroups.set(k, g); ruinsGroup.add(g); }
      for (const r of c.ruins) {
        live.add(r.id);
        let g = ruinMeshes.get(r.id);
        if (!g) { g = buildRuin(r); ruinMeshes.set(r.id, g); ruinsGroup.add(g); }
        const looted = view.looted.has(r.id);
        // détecteur (amélioration « radar ») : les ruines vides n'ont plus de lanterne
        const shown = !looted && !(view.radar && !g.userData.loot);
        g.userData.lan.visible = shown;
        if (shown) g.userData.lan.scale.setScalar(0.6 + Math.sin(view.t * 4 + r.id) * 0.12);
      }
    }
    for (const [id, g] of ruinMeshes) if (!live.has(id)) { ruinsGroup.remove(g); ruinMeshes.delete(id); }
    for (const [k, g] of moundGroups) if (!liveK.has(k)) { ruinsGroup.remove(g); moundGroups.delete(k); }

    // gares et ville d'arrivée, attachées au sol
    const want = new Map();
    for (const i of [view.ns - 1, view.ns]) {
      if (i < 0) continue;
      const sd = stationDist(view.mode, view.goal, i); if (sd == null) continue;
      const z = dist - sd; if (z > -160 && z < 140) want.set('s' + i, () => buildStation(i, -sd));
    }
    if (view.mode === 'expedition' && view.goal && dist - view.goal > -170) want.set('city', () => buildCity(-view.goal));
    for (const [key, mk] of want) if (!setpieces.has(key)) { const s = mk(); setpieces.set(key, s); scene.add(s.g); }
    for (const [key, s] of setpieces) { if (!want.has(key)) { scene.remove(s.g); setpieces.delete(key); } else s.g.position.z = dist; }

    // congère sur la voie (rétrécit à mesure qu'on la déblaie)
    const E = view.ev;
    if (E && E.k === 'drift' && !E.done) {
      driftG.visible = true; driftG.position.set(0, 0, E.zw + dist);
      driftG.scale.set(1, Math.max(0.12, 1 - (E.prog || 0) * 0.88), 1);
      lastDrift = driftG.position.z;
    } else {
      if (driftG.visible && lastDrift != null) burst(0, 0.5, lastDrift, 50, 7, 5);
      driftG.visible = false; lastDrift = null;
    }
    // zone d'avalanche (clignote avant l'impact)
    if (E && E.k === 'aval' && E.t > 0 && !E.hit) {
      const w = 28 - (HALF_W + 1), z0 = BODY_FRONT - 8, z1 = REAR + 12;
      avalZone.visible = true; avalZone.scale.set(w, z1 - z0, 1);
      avalZone.position.set(E.side * (HALF_W + 1 + w / 2), 0.05, (z0 + z1) / 2);
      MAT.warn.opacity = 0.2 + 0.25 * Math.abs(Math.sin(view.t * 8));
    } else { avalZone.visible = false; MAT.warn.opacity = 0.45; }

    // fusées éclairantes
    const seenF = new Set(); let li = 0;
    for (const fl of view.flares) {
      seenF.add(fl.id);
      let m = flareMeshes.get(fl.id);
      if (!m) {
        m = new THREE.Group(); const stick = box(0.09, 0.5, 0.09, MAT.flare, false); stick.position.y = 0.3; stick.rotation.z = 0.3; m.add(stick);
        const ring = mesh(GEO.ring, flareRingMat, false, false); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(FLARE_R); ring.position.y = 0.06; m.add(ring);
        flareMeshes.set(fl.id, m); scene.add(m);
        burst(fl.x, fl.m === 1 ? DECK_Y + 0.5 : 0.5, fl.m === 0 ? fl.z + dist : fl.z, 8, 0.6, 4);
      }
      m.position.set(fl.x, fl.m === 1 ? DECK_Y : 0, fl.m === 0 ? fl.z + dist : fl.z);
      if (li < flareLights.length) { const l = flareLights[li++]; l.position.set(m.position.x, m.position.y + 1.2, m.position.z); l.intensity = (26 + Math.random() * 14) * Math.min(1, fl.t / 1.5); }
    }
    for (; li < flareLights.length; li++) flareLights[li].intensity = 0;
    for (const [id, m] of flareMeshes) if (!seenF.has(id)) { scene.remove(m); flareMeshes.delete(id); }

    // caisses
    const seen = new Set();
    for (const c of view.crates) {
      seen.add(c.id);
      let m = crates.get(c.id);
      if (!m) { m = makeCrate(); crates.set(c.id, m); scene.add(m); }
      m.position.set(c.x, c.y, c.m === 0 ? c.z + dist : c.z);
      m.rotation.y = (c.id * 0.7) % 3; if (c.m === 2) m.rotation.x += dt * 8;
    }
    for (const [id, m] of crates) if (!seen.has(id)) { scene.remove(m); crates.delete(id); }

    // front de tempête
    const gap = view.gap ?? 999;
    stormG.visible = !view.calm && gap < 230;
    if (stormG.visible) {
      stormG.position.set(focus.x, 0, gap);
      stormMats.forEach((m, i) => { m.map.offset.x = (view.t * (0.02 + i * 0.015) * (i % 2 ? -1 : 1)) % 1; });
      flashT -= dt; if (flashT <= 0) { flashT = 2 + Math.random() * 5; stormLight.intensity = 260; } stormLight.intensity *= Math.exp(-dt * 9);
      // plus il est proche, plus la lumière tombe et la neige s'épaissit
      const near = Math.max(0, Math.min(1, (70 - gap) / 60));
      scene.fog.color.lerp(fogS, near * 0.6); scene.background.copy(scene.fog.color);
      scene.fog.far -= near * 14; snow.mat.size += near * 0.1;
      if (near > 0.5) shake = Math.max(shake, (near - 0.5) * 0.15);
    }
    // pannes à bord
    const seenFa = new Set();
    for (const f of view.faults || []) {
      seenFa.add(f.id);
      let g = faultMeshes.get(f.id);
      if (!g) { g = buildFault(f); faultMeshes.set(f.id, g); train.add(g); }
      const k = 1 - (f.prog || 0) * 0.85; g.userData.shrink.scale.setScalar(k);
      const pulse = 0.5 + 0.5 * Math.sin(view.t * 7);
      g.userData.ring.material.opacity = 0.3 + 0.5 * pulse; g.userData.bang.position.y = 1.5 + pulse * 0.2;
      if (f.k === 'leak' && Math.random() < 0.05) burst(f.x, DECK_Y + 0.2, f.z, 1, 0.3, 0.5);
    }
    for (const [id, g] of faultMeshes) if (!seenFa.has(id)) { train.remove(g); faultMeshes.delete(id); }
    // pillards
    const seenR = new Set();
    for (const w of view.raiders || []) {
      seenR.add(w.id);
      let o = raiders.get(w.id);
      if (!o) { o = buildRaider(); raiders.set(w.id, o); scene.add(o.g); }
      o.g.position.set(w.x, 0, w.z); o.g.rotation.y = Math.PI;
      o.crate.visible = w.carry > 0;
      o.cloth.rotation.y = Math.sin(view.t * 9 + w.id) * 0.3;
      if (w.st === 3) { o.sled.rotation.z += (1.25 * w.side - o.sled.rotation.z) * Math.min(1, dt * 6); o.sled.position.y = 0.3; }
      else { o.sled.rotation.z = Math.sin(view.t * 6 + w.id) * 0.05; o.sled.position.y = Math.abs(Math.sin(view.t * 11 + w.id)) * 0.06; o.rider.rotation.y = w.st === 1 ? -w.side * 0.9 : 0; }
      if (w.st < 3 && Math.random() < 0.3) burst(w.x, 0.3, w.z + 1.4, 1, 0.6, 1);
    }
    for (const [id, o] of raiders) if (!seenR.has(id)) { scene.remove(o.g); raiders.delete(id); }

    // loups (positions du sol → repère du train)
    const seenW = new Set();
    for (const w of view.wolves) {
      seenW.add(w.id);
      const z = w.zw + dist;
      let o = wolves.get(w.id);
      if (!o) { o = actors.wolf(); o.px = w.x; o.pz = w.zw; wolves.set(w.id, o); scene.add(o.g); }
      const sp = Math.hypot(w.x - o.px, w.zw - o.pz) / Math.max(dt, 1e-3);
      o.px = w.x; o.pz = w.zw; o.sp = (o.sp || 0) + (Math.min(7, sp) - (o.sp || 0)) * Math.min(1, dt * 8);
      o.g.position.set(w.x, 0, z); o.g.rotation.y = w.yaw;
      actors.poseWolf(o, w, view.t, dt, o.sp);
    }
    for (const [id, o] of wolves) if (!seenW.has(id)) { scene.remove(o.g); wolves.delete(id); }

    // joueurs
    const seenP = new Set();
    for (const p of view.players) {
      seenP.add(p.id);
      let o = players.get(p.id);
      if (o && (o.name !== p.name || o.color !== p.color)) { dropPlayer(p.id); o = null; }
      if (!o) { o = buildPlayer(p); players.set(p.id, o); }
      o.g.visible = p.st !== 3;
      o.g.position.set(p.x, p.y, p.z);
      o.g.rotation.y = p.st === 2 ? Math.PI : p.yaw; // dos à la caméra sur l'échelle
      actors.poseSurvivor(o, p, view.t, dt);
      o.crate.visible = !!p.carry;
      o.label.material.opacity = p.me ? 0.75 : 1;
    }
    for (const id of [...players.keys()]) if (!seenP.has(id)) dropPlayer(id);

    renderer.render(scene, camera);
  }
  function dropPlayer(id) {
    const o = players.get(id); if (!o) return;
    scene.remove(o.g); actors.drop(o); players.delete(id);
  }

  // position écran d'un point du repère du train (marqueurs du HUD)
  function toScreen(x, y, z) {
    v3.set(x, y, z).project(camera);
    return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, front: v3.z < 1 };
  }

  // remise à zéro entre deux parties (nouvelle graine) : on garde la scène, on vide le décor et les entités
  function reset() {
    for (const g of ruinMeshes.values()) ruinsGroup.remove(g); ruinMeshes.clear();
    for (const g of moundGroups.values()) ruinsGroup.remove(g); moundGroups.clear();
    for (const s of setpieces.values()) scene.remove(s.g); setpieces.clear();
    for (const m of crates.values()) scene.remove(m); crates.clear();
    for (const o of wolves.values()) scene.remove(o.g); wolves.clear();
    for (const m of flareMeshes.values()) scene.remove(m); flareMeshes.clear();
    for (const o of raiders.values()) scene.remove(o.g); raiders.clear();
    for (const g of faultMeshes.values()) train.remove(g); faultMeshes.clear();
    for (const id of [...players.keys()]) dropPlayer(id);
    driftG.visible = false; lastDrift = null; camInit = false;
  }

  function dispose() {
    if (disposed) return; disposed = true;
    ro.disconnect();
    canvas.removeEventListener('webglcontextlost', onCtxLost);
    for (const id of [...players.keys()]) dropPlayer(id);
    scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    for (const g of owned.geo) g.dispose();
    for (const m of owned.mat) { m.map && !owned.tex.has(m.map) && m.map.dispose(); m.dispose(); }
    for (const t of owned.tex) t.dispose();
    actors.dispose(); kit && kit.dispose();
    sun.shadow.map?.dispose(); beam.shadow?.map?.dispose();
    scene.clear();
    renderer.dispose(); renderer.forceContextLoss();
    canvas.remove();
  }

  return { frame, resize, toScreen, reset, dispose, kick: (s = 0.35) => { shake = Math.max(shake, s); }, burst, steam: () => { steamT = 0.6; }, canvas };
}
