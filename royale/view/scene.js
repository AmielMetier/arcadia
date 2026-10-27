// La scène 3D : rendu (Three.js r169 embarqué), lumières du moment de la journée, ciel et îles au loin, brume, ombres
// qui suivent le joueur, post-traitement (occlusion, halo) ; assemble le relief, l'eau, les bâtiments, les forêts et le
// décor. La qualité baisse toute seule si la machine peine (résolution, puis effets).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { buildSky, buildPeaks, skyFor, TIMES } from './sky.js';
import { noiseTexture } from './textures.js';
import { createPost } from './post.js';
import { buildTerrain, buildDecals } from './terrain.js';
import { buildRoads } from './roads.js';
import { createGrass } from './grass.js';
import { buildNightLights } from './lights.js';
import { buildWater } from './water.js';
import { buildStructures } from './structures.js';
import { buildInterior } from './interior.js';
import { buildForest, buildProps } from './props.js';
import { SWAY } from './trees.js';
import { createSkyLife } from './life.js';
import { loadKit } from './kit.js';

export const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
const DAY = { dir: [-0.45, 0.78, -0.42], sunColor: 0xffeed4, sunInt: 4.0, hemiSky: 0xc4d8f0, hemiGround: 0x34481f, hemiInt: 0.5, exposure: 0.95, env: 0.32 };
const breathe = () => new Promise((r) => setTimeout(r, 0));

export async function createScene(host, map, { time = 'jour', progress = () => {}, onLost } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: MOBILE, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost && onLost(); });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 0.15, 6000);
  const noise = noiseTexture();
  const T = TIMES[time], L = T ? { ...DAY, ...T } : DAY;
  const sunDir = new THREE.Vector3(...(T ? T.dir : DAY.dir)).normalize();
  const look = skyFor('mer', time);

  // lumières : soleil (ombres autour du joueur), ciel, rebond vert
  const hemi = new THREE.HemisphereLight(L.hemiSky, L.hemiGround, L.hemiInt); scene.add(hemi);
  const sun = new THREE.DirectionalLight(L.sunColor, L.sunInt);
  sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 500 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  renderer.toneMappingExposure = L.exposure;

  // ciel → environnement (reflets, lumière d'ambiance), îles à l'horizon, brume
  const sky = buildSky(look, sunDir, noise); scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(buildSky(look, sunDir, noise));
  const env = pmrem.fromScene(envScene, 0.02).texture;
  envScene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  pmrem.dispose();
  scene.environment = env; scene.environmentIntensity = L.env;
  const peaks = buildPeaks(look, map.seed, { x: map.center, z: map.center }, noise); if (peaks) scene.add(peaks);
  scene.fog = new THREE.FogExp2(look.fog, 0.00095);
  scene.background = new THREE.Color(look.horizon);

  progress('Relief de l\'île', 0.35); await breathe();
  const terrain = buildTerrain(map, { noise, anisotropy: renderer.capabilities.getMaxAnisotropy() });
  scene.add(terrain.group);
  const decals = buildDecals(map); scene.add(decals.group);
  const roads = await buildRoads(map, { anisotropy: renderer.capabilities.getMaxAnisotropy() }); scene.add(roads.group);
  const grass = createGrass(map, terrain.ground, { mobile: MOBILE }); scene.add(grass.group);
  // nuages bas et vols d'oiseaux (couleur des nuages : celle du ciel du moment)
  const life = createSkyLife(map, { tint: look.cloudLit || 0xffffff }); scene.add(life.group);
  const water = buildWater(map, { noise, sunDir, sky: look }); scene.add(water.group);
  progress('Bâtiments', 0.5); await breathe();
  const structures = buildStructures(map, { time }); scene.add(structures.group);
  progress('Meubles et portes', 0.56); await breathe();
  const interior = buildInterior(map); scene.add(interior.group);
  progress('Forêts', 0.62); await breathe();
  const forest = buildForest(map); scene.add(forest.group);
  progress('Soldats, armes et décor', 0.68); await breathe();
  const kit = await loadKit(new URL('../models/', import.meta.url).href);
  progress('Décor', 0.72); await breathe();
  const props = await buildProps(map, { base: new URL('../models/', import.meta.url).href, kit }); scene.add(props.group);
  // au crépuscule et le soir, lampadaires et lampes des portes allumés
  const night = time === 'soir' ? 1 : time === 'crepuscule' ? 0.45 : 0;
  const lights = night > 0 ? buildNightLights(props.lampHeads, structures.bulbs || [], night) : null;
  if (lights) scene.add(lights.group);

  // qualité : résolution, effets ; baissée automatiquement si la machine peine
  const post = MOBILE ? null : createPost(renderer);
  const quality = { ao: !MOBILE, bloom: !MOBILE };
  function lowerQuality() {
    const pr = renderer.getPixelRatio();
    const setPr = (v) => { renderer.setPixelRatio(v); resize(); return 'résolution ' + v.toFixed(2); };
    if (pr > 1.01) return setPr(Math.max(1, pr * 0.85));
    for (const k of ['ao', 'bloom']) if (quality[k]) { quality[k] = false; return k; }
    if (grass.range > 24) { grass.shrink(); return 'herbe'; }
    if (sun.castShadow && sun.shadow.mapSize.x > 1024) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map && sun.shadow.map.dispose(); sun.shadow.map = null; return 'ombres'; }
    if (pr > 0.76) return setPr(Math.max(0.75, pr * 0.85));
    return null;
  }

  function resize() {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    if (post) post.setSize(Math.round(w * pr), Math.round(h * pr));
  }
  resize();
  addEventListener('resize', resize);

  // préchauffage : shaders compilés avant la première image
  progress('Préparation de l\'affichage', 0.85); await breathe();
  terrain.update(map.center, map.center, 99);
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera).catch(() => {});

  let time0 = 0, disposed = false;
  // repère du soleil, pour caler l'ombre sur ses texels (sinon elle scintille quand on tourne ou qu'on avance)
  const lx = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sunDir).normalize(), ly = new THREE.Vector3().crossVectors(sunDir, lx);
  const sc = new THREE.Vector3();
  // cam : { pos, look, near? } ; focus : le joueur (ombres, niveaux de détail)
  function frame(dt, cam, focus) {
    if (disposed) return;
    time0 += dt;
    camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z); camera.lookAt(cam.look.x, cam.look.y, cam.look.z);
    // plan proche : la caméra garde sa distance, ce qui se trouve entre elle et le joueur est découpé
    const near = cam.near || 0.15;
    if (Math.abs(camera.near - near) > 0.002) { camera.near = near; camera.updateProjectionMatrix(); }
    terrain.update(camera.position.x, camera.position.z, 2);
    forest.update(camera.position.x, camera.position.z, 1);
    // l'herbe pousse autour du joueur ; inutile vue de la montgolfière ou en chute libre
    life.update(dt, camera.position);
    grass.group.visible = camera.position.y - map.heightAt(camera.position.x, camera.position.z) < 70;
    if (grass.group.visible) grass.update(focus, 2);
    // de loin, on ne voit ni les meubles ni les petits ornements des façades
    interior.cull(camera.position.x, camera.position.z);
    structures.cull(camera.position.x, camera.position.z);
    // l'ombre couvre ce qui est autour du joueur, sans dépendre de la direction du regard, calée au texel près
    const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
    sc.set(focus.x, focus.y, focus.z);
    const a = Math.round(sc.dot(lx) / texel) * texel, b = Math.round(sc.dot(ly) / texel) * texel, c = sc.dot(sunDir);
    sc.copy(lx).multiplyScalar(a).addScaledVector(ly, b).addScaledVector(sunDir, c);
    sun.target.position.copy(sc);
    sun.position.copy(sc).addScaledVector(sunDir, 200);
    SWAY.uT.value = time0; SWAY.uWind.value = 0.35;
    water.update(time0);
    interior.update(dt);
    sky.userData.update(time0, { dir: 0.7, speed: 3 });
    if (post) { post.q.ao = quality.ao; post.q.bloom = quality.bloom; post.render(scene, camera, time0); }
    else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    removeEventListener('resize', resize);
    life.dispose(); terrain.dispose(); decals.dispose(); roads.dispose(); grass.dispose(); lights && lights.dispose(); water.dispose(); structures.dispose(); interior.dispose(); forest.dispose(); props.dispose();
    scene.traverse((o) => {
      if ((o.isMesh || o.isPoints) && !o.userData.shared && !o.isInstancedMesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.dispose(); }
    });
    env.dispose(); noise.dispose(); post && post.dispose();
    renderer.dispose(); renderer.forceContextLoss();
    canvas.remove();
  }

  return { renderer, scene, camera, canvas, quality, lowerQuality, frame, resize, dispose, structures, interior, props, forest, kit, lights, MOBILE };
}
