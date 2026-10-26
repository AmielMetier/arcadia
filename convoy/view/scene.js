// Convoy Storm — scène 3D (Three.js r169 embarqué). Décor : modèles Kenney (CC0) givrés + primitives low-poly.
// La scène vit dans un repère local centré sur le convoi : la voie tourne (view/curve.js enroule le monde sur sa courbe),
// le décor dense (forêts, villes, falaises) est dessiné en instances (view/decor.js).
// createScene() monte le canevas ; dispose() libère tout (géométries, matériaux, textures, contexte WebGL, écouteurs).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { DECK_Y, HALF_W, REAR, BODY_FRONT, BOILER, DECK_BOXES, WAGONS, CHUNK, piecePos } from '../engine/world.js';
import { Ruins, DIFFICULTY, STATION_NAMES, WARM_R, FLARE_R, LEVER, VALVE, TURRET, BENCH, MOMENTS, BIOMES } from '../engine/sim.js';
import { Line, stationDist, forksOf, forkOptions, forkChoice, forkBend, tunnelsOf, legAt, momentOf, BRIDGE_LEN } from '../engine/line.js';
import { hash, makeRng } from '../engine/rng.js';
import { loadKit, frost, SWAY } from './models.js';
import { makeActors } from './actors.js';
import { makeBend } from './curve.js';
import { makeScatter } from './decor.js';
import { createPost } from './post.js';
import { createPineKit, PINE_H } from './trees.js';
import { MODEL_SIZE } from '../engine/sizes.js';

// Caméra isométrique : décalage fixe par rapport au point suivi. CAM_DIR sert à l'entrée (haut de l'écran = CAM_DIR).
const CAM_OFF = new THREE.Vector3(11, 17, 15);
export const CAM_DIR = (() => { const l = Math.hypot(CAM_OFF.x, CAM_OFF.z); return { x: -CAM_OFF.x / l, z: -CAM_OFF.z / l }; })();
const FOG = 0xc3ced9, FOG_GUST = 0xdfe5ec, FOG_NIGHT = 0x131a29, FOG_TUNNEL = 0x0b0d12;
// teinte du sol et du brouillard selon le paysage du tronçon
const BIO_LOOK = {
  plaine: { ground: 0xe4e9f0, fog: 0xbcc7d3, rough: 1, near: 14, far: 56 },
  foret: { ground: 0xc6d1cd, fog: 0x93a5a0, rough: 1, near: 10, far: 46 },
  ville: { ground: 0xcdcbc7, fog: 0xb3b3b8, rough: 1, near: 13, far: 54 },
  lac: { ground: 0xb4d6ee, fog: 0xcde2f0, rough: 0.28, near: 16, far: 62 },
  col: { ground: 0xc4ccd8, fog: 0x9fb0c5, rough: 1, near: 12, far: 52 },
  usine: { ground: 0xc2beb9, fog: 0xa9a49d, rough: 1, near: 12, far: 50 },
  toundra: { ground: 0xdacfb6, fog: 0xe4e0d6, rough: 1, near: 17, far: 72 },
};
// aperçu de chaque paysage au bout de l'aiguillage (quelques pièces le long de la voie qui s'en va)
const PREVIEW = {
  plaine: [['~mound', 1.5], ['nature/plant_bush', 3.5]], foret: [['holiday/tree-snow-a', 1], ['holiday/tree-snow-b', 1], ['nature/tree_pineTallD', 1]],
  ville: [['commercial/building-a', 6], ['commercial/building-d', 6]], lac: [['~slab', 2], ['pirate/boat-row-small', 2.4]],
  col: [['nature/rock_tallA', 7], ['nature/cliff_block_rock', 6]], usine: [['industrial/detail-tank-large', 4.4], ['industrial/shipping-container-a', 7]],
  toundra: [['holiday/reindeer', 1.7], ['~moss', 2.4], ['nature/tree_pineSmallA', 3]],
};

export function createScene(host, { onLost } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  // post-traitement (occlusion ambiante, halo, étalonnage) hors téléphone ; il se coupe de lui-même si la machine peine
  const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
  const post = MOBILE ? null : createPost(renderer);
  const perf = { ema: 16, slow: 0, step: 0 };
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
  const canvasTex = (w, h, draw, repeat) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } owned.tex.add(t); return t; };
  const MAT = {
    steel: M(0x4b525c, { metalness: 0.45, roughness: 0.55 }), dark: M(0x262a31, { metalness: 0.3 }), plate: M(0x6a5a48, { roughness: 0.95 }),
    rust: M(0x8a4b2e), red: M(0xb3362a), snow: M(0xf4f7fb, { roughness: 1 }), stone: M(0x8d8a86), concrete: M(0xa4a6a4), roof: M(0x5d4a3c),
    metal: M(0x5c6168, { metalness: 0.4 }), wood: M(0x7b5a3a), crate: M(0xc0821f), stripe: M(0x1d1f23),
    glow: M(0xff8a2a, { emissive: 0xff6a10, emissiveIntensity: 4 }),
    lamp: M(0xfff1c4, { emissive: 0xffe2a0, emissiveIntensity: 5 }), redLamp: M(0xff3b2f, { emissive: 0xff2010, emissiveIntensity: 3.5 }),
    loot: M(0xffd34d, { emissive: 0xffb020, emissiveIntensity: 3.2 }), lootOff: M(0x5a5f66), coal: M(0x18191c),
    brass: M(0xc8a24a, { metalness: 0.6, roughness: 0.35 }), green: M(0x2fbf71, { emissive: 0x1a8a4a, emissiveIntensity: 0.6 }),
    window: M(0xffd98a, { emissive: 0xffb84a, emissiveIntensity: 2.4 }), flare: M(0xff3b2f, { emissive: 0xff2a10, emissiveIntensity: 7 }),
    warn: M(0xff4b2b, { emissive: 0xff2a10, emissiveIntensity: 0.6, transparent: true, opacity: 0.45, depthWrite: false }),
    rock: M(0x6b6f78), pine: M(0x2f5d4a), bark: M(0x5a4130),
  };
  // version givrée des matériaux du décor
  const FM = { stone: F(MAT.stone), concrete: F(MAT.concrete), roof: F(MAT.roof), metal: F(MAT.metal), rust: F(MAT.rust), wood: F(MAT.wood), steel: F(MAT.steel, 0.6), dark: F(MAT.dark, 0.6), red: F(MAT.red, 0.5), rock: F(MAT.rock), pine: F(MAT.pine), bark: F(MAT.bark, 0.6) };
  const GEO = {
    box: G(new THREE.BoxGeometry(1, 1, 1)), cyl10: G(new THREE.CylinderGeometry(1, 1, 1, 10)),
    wheel: G(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 10).rotateZ(Math.PI / 2)), ball: G(new THREE.IcosahedronGeometry(0.24, 1)),
    mound: G(new THREE.IcosahedronGeometry(1, 0)), crate: G(new THREE.BoxGeometry(0.5, 0.5, 0.5)), cone: G(new THREE.ConeGeometry(1, 1, 7)),
    ring: G(new THREE.RingGeometry(0.92, 1, 40)), plane: G(new THREE.PlaneGeometry(1, 1)), flat: G(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
  };
  const box = (w, h, d, mat, cast = true) => { const m = mesh(GEO.box, mat, cast); m.scale.set(w, h, d); return m; };
  const ident = new THREE.Matrix4();
  const mat4 = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

  // ---------------------------------------------------------------- lumières
  const hemi = new THREE.HemisphereLight(0xe2ebf5, 0x5f6b78, 1.05); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.35);
  const hemiDay = new THREE.Color(0xe2ebf5), hemiNight = new THREE.Color(0x5d74a8), sunDay = new THREE.Color(0xfff4e6), sunNight = new THREE.Color(0x9fb4e0);
  sun.castShadow = true; sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  // lumière d'ambiance et reflets : un ciel d'hiver bas et laiteux, cuit en carte d'environnement (métal, glace, vitres)
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vD;
        void main(){
          // ciel clair au-dessus, rebond du sol nettement plus sombre : les objets gardent leur modelé (dessus éclairé, dessous dans l'ombre)
          float h = vD.y; vec3 sd = normalize(vec3(-0.45, 0.35, 0.3));
          vec3 c = mix(vec3(0.7, 0.75, 0.82), vec3(0.36, 0.48, 0.68), pow(clamp(h, 0.0, 1.0), 0.55));
          c = mix(c, vec3(0.26, 0.29, 0.34), smoothstep(0.02, -0.25, h));
          float s = max(dot(normalize(vD), sd), 0.0); c += vec3(1.0, 0.86, 0.66) * (pow(s, 90.0) * 2.0 + pow(s, 8.0) * 0.15);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    const envScene = new THREE.Scene(); envScene.add(sky);
    const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(envScene, 0.04).texture;
    pm.dispose(); sky.geometry.dispose(); sky.material.dispose();
    scene.environment = env; scene.environmentIntensity = 0.45; owned.tex.add(env);
  }

  // ---------------------------------------------------------------- sol enneigé (texture dessinée en canevas, fixe dans le monde)
  const snowTex = canvasTex(256, 256, (x) => {
    x.fillStyle = '#eaeef4'; x.fillRect(0, 0, 256, 256);
    const r = makeRng(7);
    for (let i = 0; i < 900; i++) { const v = 205 + r.int(0, 45); x.fillStyle = `rgba(${v - 12},${v - 4},${v},${r.range(0.15, 0.5)})`; x.beginPath(); x.ellipse(r.range(0, 256), r.range(0, 256), r.range(2, 14), r.range(1, 4), r.range(0, 3), 0, 7); x.fill(); }
  }, true);
  snowTex.repeat.set(36, 36); snowTex.anisotropy = 8;
  // relief : rides de neige soufflée par le vent et petites bosses (carte de normales peinte), qui accrochent le soleil bas
  const snowNrm = (() => {
    const N = 256, hgt = new Float32Array(N * N), r = makeRng(23), blobs = Array.from({ length: 40 }, () => [r.range(0, N), r.range(0, N), r.range(6, 22), r.range(-1, 1)]);
    // ondulations douces et raccordées (fréquences entières : la dalle se répète sans couture) qui tordent et modulent les rides
    const waves = (n) => Array.from({ length: n }, () => [r.int(-3, 3), r.int(-3, 3) || 1, r.range(0, 6.28), r.range(0.4, 1)]);
    const warpW = waves(5), ampW = waves(4), wv = (W, x, y) => W.reduce((a, [fx, fy, ph, k]) => a + k * Math.sin((fx * x + fy * y) / N * Math.PI * 2 + ph), 0) / W.length;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const warp = wv(warpW, x, y) * 5, amp = 0.35 + 0.65 * (0.5 + 0.5 * wv(ampW, x, y) * 1.6);
      let h = amp * (0.55 * Math.sin((x * 6 + y * 2) / N * Math.PI * 2 + warp) + 0.22 * Math.sin((x * 11 - y * 5) / N * Math.PI * 2 + warp * 1.7));
      for (const [bx, by, br, bs] of blobs) { let dx = Math.abs(x - bx), dy = Math.abs(y - by); dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy); h += bs * Math.exp(-(dx * dx + dy * dy) / (br * br)); }
      hgt[y * N + x] = h;
    }
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const H0 = (xx, yy) => hgt[((yy + N) % N) * N + ((xx + N) % N)], dx = (H0(x + 1, y) - H0(x - 1, y)) * 1.6, dy = (H0(x, y + 1) - H0(x, y - 1)) * 1.6, l = Math.hypot(dx, dy, 1), o = (y * N + x) * 4;
      im.data[o] = (-dx / l * 0.5 + 0.5) * 255; im.data[o + 1] = (dy / l * 0.5 + 0.5) * 255; im.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(36, 36); t.anisotropy = 8; owned.tex.add(t);
    return t;
  })();
  const SNOWFX = { uT: { value: 0 }, uSpark: { value: 1 } };
  const groundMat = M(0xffffff, { map: snowTex, normalMap: snowNrm, normalScale: new THREE.Vector2(0.75, 0.75), roughness: 1, flatShading: false });
  // paillettes : quelques cristaux scintillent dans la neige (fixes au sol, comme la texture) ; le halo les fait briller
  groundMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SNOWFX);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uSpark;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec2 cell = vMapUv * 140.0, id = floor(cell), f = fract(cell) - 0.5;
          float h = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
          float tw = pow(max(0.0, sin(uT * (1.5 + h * 3.0) + h * 40.0)), 24.0);
          totalEmissiveRadiance += vec3(3.2, 3.4, 3.8) * step(0.985, h) * smoothstep(0.22, 0.0, length(f)) * tw * uSpark;
        }`);
  };
  groundMat.customProgramCacheKey = () => 'snowground';
  const groundPivot = new THREE.Group(); scene.add(groundPivot);
  const ground = mesh(G(new THREE.PlaneGeometry(360, 360)), groundMat, false, true);
  ground.rotation.x = -Math.PI / 2; groundPivot.add(ground);

  // ---------------------------------------------------------------- décor instancié : formes simples (les modèles s'ajoutent au chargement)
  const scatter = makeScatter(scene);
  const iceSlab = M(0xd4ecfa, { roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }), crackMat = M(0x5d86a8, { roughness: 0.4 });
  // vue en coupe : dans un tunnel, la montagne s'ouvre autour du convoi (tout ce qui dépasse 2,2 m dans un rayon CUT.r disparaît)
  const CUT = { p: { value: new THREE.Vector3() }, r: { value: 0 } };
  const cutaway = (m) => {
    const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
    m.onBeforeCompile = (sh, r) => {
      prev.call(m, sh, r);
      sh.uniforms.uCutP = CUT.p; sh.uniforms.uCutR = CUT.r;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCutW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 cw = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\ncw = instanceMatrix * cw;\n#endif\nvCutW = ( modelMatrix * cw ).xyz; }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCutW;\nuniform vec3 uCutP;\nuniform float uCutR;')
        .replace('void main() {', 'void main() {\n  if ( uCutR > 0.0 && vCutW.y > 2.2 && distance( vCutW.xz, uCutP.xz ) < uCutR ) discard;');
    };
    m.customProgramCacheKey = () => key + '|cut';
    return m;
  };
  const tunnelMat = cutaway(F(M(0x5a5e66, { roughness: 1 }), 0.5)), tunnelIn = cutaway(M(0x2a2c31, { roughness: 1, side: THREE.BackSide }));
  const portalMat = cutaway(F(M(0x8d8a86), 1)), portalRock = cutaway(F(M(0x6b6f78), 1));
  const shellGeo = G(new THREE.CylinderGeometry(4.9, 4.9, 4.2, 14, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2));
  // relief en rubans : falaise du col, ravin, montagne percée par les tunnels (couleurs par sommet, facettes)
  const reliefMat = M(0xffffff, { vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  const ridgeMat = cutaway(M(0xffffff, { vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  const vnoise = (t, j) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f), h = (n) => (hash(n * 7919 + j * 104729) % 2001) / 1000 - 1; return h(i) * (1 - u) + h(i + 1) * u; };
  function makeStrip(mat, cols, maxRows) {
    const pos = new Float32Array(maxRows * cols * 3), colr = new Float32Array(maxRows * cols * 3), idx = new Uint16Array((maxRows - 1) * (cols - 1) * 6);
    const geo = G(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(idx, 1).setUsage(THREE.DynamicDrawUsage));
    const me = mesh(geo, mat, true, true); me.frustumCulled = false; scene.add(me);
    let rows = 0, ni = 0, join = false;
    return {
      begin() { rows = 0; ni = 0; join = false; },
      cut() { join = false; },
      // une rangée du profil, au point d de la voie : écarts latéraux xs, hauteurs ys, couleurs cs (Color)
      row(d, xs, ys, cs) {
        if (rows >= maxRows) return;
        for (let j = 0; j < cols; j++) {
          B.at(d, xs[j], O); const o = (rows * cols + j) * 3;
          pos[o] = O.x; pos[o + 1] = ys[j]; pos[o + 2] = O.z; colr[o] = cs[j].r; colr[o + 1] = cs[j].g; colr[o + 2] = cs[j].b;
        }
        if (join) for (let j = 0; j < cols - 1; j++) { const a = (rows - 1) * cols + j, b = a + cols; idx[ni++] = a; idx[ni++] = b; idx[ni++] = a + 1; idx[ni++] = a + 1; idx[ni++] = b; idx[ni++] = b + 1; }
        rows++; join = true;
      },
      end() {
        geo.setDrawRange(0, ni); me.visible = ni > 0;
        if (ni) { geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.index.needsUpdate = true; }
      },
    };
  }
  // profils : [écart depuis le pied (m), hauteur (m)] ; la falaise monte depuis |x| = 15, le ravin s'ouvre à |x| = 30
  const CLIFF = [[-0.8, -0.4], [0.3, 2.4], [1, 5.6], [2.1, 8.6], [3, 10.2], [5.5, 11.4], [11, 12.8], [20, 14.5], [34, 15.5]];
  const RAV = [[-1.8, 0.01], [-0.9, 0.5], [-0.2, 0.42], [0.35, 0.05], [1.6, 0.05], [5, 0.05], [16, 0.05], [50, 0.05]];
  const RAV_C = [0xeef3f9, 0xdfe6ee, 0x7d848e, 0x58606b, 0x3c4654, 0x1f2a36, 0x0b0f16, 0x06080c].map((h) => new THREE.Color(h));
  const RIDGE_X = [-15, -10, -7, -4.9, -3.7, -2.5, -1.3, 0, 1.3, 2.5, 3.7, 4.9, 7, 10, 15];
  const ROCK_A = new THREE.Color(0x58606b), ROCK_B = new THREE.Color(0x80878f), SNOW_C = new THREE.Color(0xeef3f9);
  const cliffStrip = makeStrip(reliefMat, CLIFF.length, 220), ravStrip = makeStrip(reliefMat, RAV.length, 220), ridgeStrip = makeStrip(ridgeMat, RIDGE_X.length, 180);
  const PX = new Float32Array(16), PY = new Float32Array(16), PC = Array.from({ length: 16 }, () => new THREE.Color());
  let cutK = 0, stormNear = 0;
  scatter.define('sleeper', [{ geo: GEO.box, mat: MAT.wood, base: mat4(0, 0, 0, 2.4, 0.12, 0.28) }], { cast: false });
  scatter.define('ballast', [{ geo: GEO.box, mat: M(0x6f6a66), base: mat4(0, 0, 0, 4.2, 0.12, 1.25) }], { cast: false });
  scatter.define('rail', [{ geo: GEO.box, mat: MAT.steel, base: mat4(0, 0, 0, 0.12, 0.16, 1.25) }], { cast: false });
  scatter.define('~mound', [{ geo: GEO.mound, mat: MAT.snow, base: ident }], { cast: false });
  scatter.define('~slab', [{ geo: GEO.mound, mat: iceSlab, base: mat4(0, 0, 0, 1.2, 0.06, 1.2) }, { geo: GEO.box, mat: crackMat, base: mat4(0.8, 0.03, 0, 0.08, 0.02, 2.4, 0.7) }], { cast: false });
  scatter.define('~pole', [{ geo: GEO.box, mat: FM.wood, base: mat4(0, 2.1, 0, 0.18, 4.5, 0.18, 0, 0, 0.12) }]);
  scatter.define('~spire', [{ geo: GEO.cone, mat: FM.rock, base: mat4(0, 0.5, 0, 1, 1, 1) }]);
  // toundra : la lande rousse que le vent a mise à nu, des touffes d'herbe sèche ; col : des éboulis de roche grise
  const mossMat = M(0x6e4524, { roughness: 1 }), grassMat = M(0xd2a043, { roughness: 1 });
  scatter.define('~moss', [{ geo: GEO.mound, mat: mossMat, base: mat4(0, 0, 0, 1, 0.07, 1) }, { geo: GEO.mound, mat: mossMat, base: mat4(0.7, 0, 0.35, 0.65, 0.06, 0.55, 0.9) },
    ...[[0.35, 0.2, 0.5], [-0.4, -0.15, 0.4], [0.05, -0.45, 0.6], [-0.1, 0.45, 0.35], [0.85, 0.3, 0.45], [-0.6, 0.25, 0.3]].map(([x, z, h]) => ({ geo: GEO.cone, mat: grassMat, base: mat4(x, h / 2 + 0.03, z, 0.13, h * 1.3, 0.13) }))]);
  scatter.define('~scree', [{ geo: GEO.mound, mat: FM.rock, base: mat4(0, 0, 0, 1, 0.55, 1) }, { geo: GEO.mound, mat: MAT.rock, base: mat4(0.9, 0, 0.4, 0.45, 0.3, 0.45, 0.7) }, { geo: GEO.mound, mat: FM.rock, base: mat4(-0.7, 0, -0.6, 0.35, 0.25, 0.35, 1.9) }]);
  scatter.define('~lamp', [{ geo: GEO.box, mat: FM.dark, base: mat4(0, 1.8, 0, 0.14, 3.6, 0.14) }, { geo: GEO.box, mat: FM.dark, base: mat4(0.4, 3.55, 0, 0.9, 0.1, 0.1) }, { geo: GEO.ball, mat: MAT.lamp, base: mat4(0.8, 3.4, 0, 0.7, 0.7, 0.7) }]);
  scatter.define('~pipe', [{ geo: GEO.cyl10, mat: FM.steel, base: mat4(0, 1.25, 0, 0.32, 6.1, 0.32, 0, Math.PI / 2) }, { geo: GEO.box, mat: FM.dark, base: mat4(0, 0.55, 0, 0.18, 1.1, 0.18) }, { geo: GEO.cyl10, mat: MAT.rust, base: mat4(0, 1.25, 2.9, 0.42, 0.2, 0.42, 0, Math.PI / 2) }]);
  scatter.define('~tunnel', [{ geo: shellGeo, mat: tunnelMat, base: mat4(0, 0, 0) }, { geo: shellGeo, mat: tunnelIn, base: mat4(0, 0, 0, 0.97, 0.97, 1) }]);
  scatter.define('~portal', [{ geo: GEO.box, mat: portalMat, base: mat4(-5.2, 2.7, 0.2, 1.3, 5.6, 1.2) }, { geo: GEO.box, mat: portalMat, base: mat4(5.2, 2.7, 0.2, 1.3, 5.6, 1.2) }, { geo: GEO.box, mat: portalMat, base: mat4(0, 5.7, 0.2, 11.8, 1.3, 1.2) }, { geo: GEO.box, mat: portalRock, base: mat4(0, 6.6, 0.75, 5, 0.6, 0.35) }]);
  const holeMat = M(0x16324a, { roughness: 0.15, metalness: 0.2 });
  scatter.define('~hole', [{ geo: G(new THREE.CircleGeometry(1, 9).rotateX(-Math.PI / 2)), mat: holeMat, base: mat4(0, 0.03, 0) }, { geo: GEO.mound, mat: MAT.snow, base: mat4(0, -0.02, 0, 1.35, 0.12, 1.35) }], { cast: false });
  scatter.define('~tpole', [{ geo: GEO.box, mat: FM.wood, base: mat4(0, 2.6, 0, 0.2, 5.2, 0.2) }, { geo: GEO.box, mat: FM.wood, base: mat4(0, 4.9, 0, 1.5, 0.12, 0.12) }, { geo: GEO.ball, mat: MAT.window, base: mat4(-0.6, 5.02, 0, 0.35, 0.35, 0.35) }, { geo: GEO.ball, mat: MAT.window, base: mat4(0.6, 5.02, 0, 0.35, 0.35, 0.35) }]);
  scatter.define('~wire', [{ geo: GEO.box, mat: MAT.dark, base: mat4(-0.6, 0, 0, 0.03, 0.03, 1) }, { geo: GEO.box, mat: MAT.dark, base: mat4(0.6, 0, 0, 0.03, 0.03, 1) }], { cast: false });
  scatter.define('tree~', [{ geo: GEO.box, mat: MAT.bark, base: mat4(0, 0.15, 0, 0.08, 0.3, 0.08) }, { geo: GEO.cone, mat: FM.pine, base: mat4(0, 0.55, 0, 0.4, 0.7, 0.4) }]);
  scatter.define('stump~', [{ geo: GEO.cyl10, mat: FM.bark, base: mat4(0, 0.25, 0, 0.35, 0.5, 0.35) }]);
  const fallbackOf = (key) => (key.includes('tree') ? 'tree~' : key.includes('stump') ? 'stump~' : null);
  // sapins enneigés (les mêmes que ceux du golf, avec la neige sur les branches) à la place des sapins des kits Kenney ;
  // vid : identifiant stable (le même sapin garde sa silhouette), far : loin de la voie, version allégée
  const pines = createPineKit();
  pines.variants.forEach((v, i) => scatter.define('pine~' + i, [{ geo: v.trunk, mat: pines.mats.bark, base: ident }, { geo: v.needles, mat: pines.mats.needle, base: ident }]));
  pines.lo.forEach((v, i) => scatter.define('pineLo~' + i, [{ geo: v.trunk, mat: pines.mats.bark, base: ident }, { geo: v.needles, mat: pines.mats.needle, base: ident }], { cast: false }));
  const PINE_MODELS = new Set(['holiday/tree-snow-a', 'holiday/tree-snow-b', 'holiday/tree-snow-c', 'nature/tree_pineTallA', 'nature/tree_pineTallB', 'nature/tree_pineTallC',
    'nature/tree_pineTallD', 'nature/tree_pineRoundA', 'nature/tree_pineRoundC', 'nature/tree_cone_dark', 'nature/tree_pineDefaultA', 'nature/tree_pineSmallA', 'nature/tree_pineSmallC']);
  const pineScale = (key, s) => s * (MODEL_SIZE[key]?.[1] || 2) / PINE_H;
  // ajoute une instance d'un modèle du décor (ou sa forme de secours tant que les modèles chargent)
  const put = (key, x, y, z, yaw, s, sy = s, sz = s, vid = 0, far = false) => {
    if (PINE_MODELS.has(key)) { const v = Math.abs(Math.round(vid)) | 0; scatter.add(far ? 'pineLo~' + (v % 2) : 'pine~' + (v % 3), x, y, z, yaw, pineScale(key, sy)); return; }
    if (scatter.add(key, x, y, z, yaw, s, sy, sz)) return;
    const fb = fallbackOf(key); if (fb) scatter.add(fb, x, y, z, yaw, s * 1.6, sy * 1.6, sz * 1.6);
  };

  // ---------------------------------------------------------------- le convoi (trois wagons rigides qui suivent la courbe)
  const train = new THREE.Group();
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
  for (const zc of [-5.75, 5.75]) { const pl = box(1.6, 0.1, 1.2, MAT.steel); pl.position.set(0, DECK_Y - 0.06, zc); train.add(pl); }
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
  // obstacles du plancher (soute à charbon, caisse à outils)
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
  const needle = box(0.02, 0.17, 0.01, MAT.redLamp, false); const needlePiv = new THREE.Group(); needlePiv.position.copy(dial.position); needlePiv.rotation.y = dial.rotation.y; needlePiv.position.z -= 0.01; needle.position.y = 0.07; needlePiv.add(needle); train.add(needlePiv);
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
  // modules (achetés en gare) : tourelle-harpon, atelier, dortoir
  const turretG = new THREE.Group(); turretG.position.set(TURRET.x, DECK_Y + 0.9, TURRET.z); turretG.visible = false; train.add(turretG);
  { const base = mesh(GEO.cyl10, MAT.dark); base.scale.set(0.45, 0.3, 0.45); base.position.y = 0.15; turretG.add(base); }
  const turretHead = new THREE.Group(); turretHead.position.y = 0.45; turretG.add(turretHead);
  { const body = box(0.5, 0.42, 0.7, MAT.steel); turretHead.add(body); const barrel = mesh(GEO.cyl10, MAT.brass); barrel.scale.set(0.09, 1.5, 0.09); barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.9; turretHead.add(barrel);
    const tip = mesh(GEO.cone, MAT.steel); tip.scale.set(0.16, 0.36, 0.16); tip.rotation.x = Math.PI / 2; tip.position.z = 1.75; turretHead.add(tip); const seat = box(0.4, 0.1, 0.4, MAT.dark); seat.position.set(0.85, -0.3, 0); turretG.add(seat); }
  const benchG = new THREE.Group(); benchG.position.set(BENCH.x, DECK_Y + 0.6, BENCH.z); benchG.visible = false; train.add(benchG);
  const dormG = new THREE.Group(); dormG.position.set(0.9, DECK_Y, 13.6); dormG.visible = false; train.add(dormG);
  // les trois wagons : chaque pièce rejoint celui qui la porte
  const wagonG = WAGONS.map(() => { const g = new THREE.Group(); scene.add(g); return g; });
  const ZC = WAGONS.map(([a, b]) => (a + b) / 2);
  for (const c of [...train.children]) {
    const i = c.position.z < -5.8 ? 0 : c.position.z > 5.8 ? 2 : 1;
    c.position.z -= ZC[i]; wagonG[i].add(c);
  }

  // tache ronde et douce pour la fumée, les flocons, les étincelles
  const puffTex = canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  });
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
  // gros flocons tout près de l'objectif, flous : de la profondeur entre la caméra et le convoi
  const NEARF = 150, NB = 9, nearF = points(NEARF, { color: 0xffffff, size: 0.55, opacity: 0.3, fog: false }); const nflakes = nearF.pos;
  for (let i = 0; i < NEARF; i++) { nflakes[i * 3] = fr.range(-NB, NB); nflakes[i * 3 + 1] = fr.range(-NB, NB); nflakes[i * 3 + 2] = fr.range(-NB, NB); }
  // bouffées de neige (avalanche, congère déblayée, chute) — positions en repère du train, replacées sur la courbe
  const PUFF = 200, puff = points(PUFF, { color: 0xffffff, size: 1.6, opacity: 0.85 });
  const puffVel = new Float32Array(PUFF * 3), puffLife = new Float32Array(PUFF);
  let puffI = 0;
  const tmpO = { x: 0, z: 0, yaw: 0 }, tmpO2 = { x: 0, z: 0, yaw: 0 };
  function burst(x, y, z, n = 30, spread = 3, up = 3) {
    if (B.d0 !== undefined) { B.train(x, z, tmpO); x = tmpO.x; z = tmpO.z; }
    for (let k = 0; k < n; k++) {
      const i = puffI = (puffI + 1) % PUFF;
      puff.pos[i * 3] = x + (Math.random() - 0.5) * spread; puff.pos[i * 3 + 1] = y + Math.random(); puff.pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
      puffVel[i * 3] = (Math.random() - 0.5) * 4; puffVel[i * 3 + 1] = Math.random() * up; puffVel[i * 3 + 2] = (Math.random() - 0.5) * 4;
      puffLife[i] = 1 + Math.random() * 0.8;
    }
  }

  // ---------------------------------------------------------------- la ligne : courbe et repère local
  let line = new Line(1, 'endless', 0);
  let B = makeBend(line);
  let ruins = null;

  // ---------------------------------------------------------------- ruines (construites à la demande, recyclées)
  const ruinMeshes = new Map(); const ruinsGroup = new THREE.Group(); scene.add(ruinsGroup);
  const sniperMat = M(0x2a2420), cartMat = M(0x4a4038);
  function buildRuin(r) {
    const g = new THREE.Group();
    for (const pc of r.pieces) {
      const p = piecePos(r, pc), dx = p.x - r.x, dz = p.zw - r.zw;
      const model = typeof pc.m === 'string' && pc.m.startsWith('model:') ? pc.m.slice(6) : null;
      let m = model && kit ? kit.make(model, pc.w, pc.h, pc.d, { uniform: !!pc.u }) : null;
      if (m) { m.position.set(dx, pc.y0 || 0, dz); m.rotation.y = -p.rot; g.add(m); continue; }
      m = box(pc.w, pc.h, pc.d, FM[model ? 'stone' : pc.m] || FM.stone);
      m.position.set(dx, (pc.y0 || 0) + pc.h / 2, dz); m.rotation.y = -p.rot; g.add(m);
      if (pc.h > 0.6 && !pc.y0) { const cap = box(pc.w + 0.05, 0.14, pc.d + 0.05, MAT.snow, false); cap.position.set(dx, pc.h + 0.06, dz); cap.rotation.y = -p.rot; g.add(cap); }
    }
    const rr = makeRng(r.seed);
    for (let i = 0; i < 4; i++) { const m = mesh(GEO.mound, MAT.snow, false); m.scale.set(rr.range(0.8, 2.4), rr.range(0.3, 0.8), rr.range(0.8, 2.2)); m.position.set(rr.range(-4.5, 4.5), 0, rr.range(-4.5, 4.5)); g.add(m); }
    // une lanterne par point de fouille (éteinte une fois fouillé)
    const lans = r.spots.map((sp) => {
      const post = box(0.08, 1.2, 0.08, MAT.dark); post.position.set(sp.x - r.x, 0.6, sp.zw - r.zw); g.add(post);
      const lan = mesh(GEO.ball, MAT.loot, false); lan.scale.setScalar(0.7); lan.position.set(sp.x - r.x, 1.3, sp.zw - r.zw); g.add(lan);
      return lan;
    });
    if (r.kind === 'camp' && kit) { const fl = kit.make('arena/banner', 0.9, 1.8, 0.4); if (fl) { fl.position.set(r.spot.x - r.x - r.side * 0.6, 0, r.spot.zw - r.zw - 0.8); g.add(fl); } }
    // wagonnet de mine : sa petite voie jusqu'au convoi
    let cart = null;
    if (r.res && r.res.k === 'cart') {
      const x0 = r.res.x0 - r.x, x1 = r.res.x1 - r.x, len = Math.abs(x1 - x0) + 1.6, xm = (x0 + x1) / 2;
      for (const dz of [-0.45, 0.45]) { const rl = box(len, 0.08, 0.09, FM.steel, false); rl.position.set(xm, 0.1, dz); g.add(rl); }
      for (let k = 0; k < len; k += 1.1) { const sl = box(0.25, 0.06, 1.3, FM.wood, false); sl.position.set(Math.min(x0, x1) - 0.8 + k, 0.05, 0); g.add(sl); }
      cart = kit ? kit.make('fantasy/cart', 0, 0, 0, { s: 2.2 }) : null;
      if (!cart) { cart = new THREE.Group(); const b = box(1.4, 0.9, 1.9, cartMat); b.position.y = 0.6; cart.add(b); }
      const heap = mesh(GEO.mound, MAT.coal, false); heap.scale.set(0.7, 0.35, 0.9); heap.position.y = 1.05; cart.add(heap); cart.userData.heap = heap;
      cart.rotation.y = Math.PI / 2; g.add(cart);
    }
    // tireur embusqué sur le toit (ville)
    let sniper = null;
    if (r.sn) {
      sniper = new THREE.Group(); sniper.position.set(0, r.sn.h, 0); g.add(sniper);
      const bodyS = box(0.5, 0.9, 0.4, sniperMat); bodyS.position.y = 0.45; sniper.add(bodyS);
      const headS = mesh(GEO.ball, sniperMat); headS.scale.setScalar(1.1); headS.position.y = 1.05; sniper.add(headS);
      const gun = box(0.08, 0.08, 1.1, MAT.dark, false); gun.position.set(0.2, 0.75, 0.4); sniper.add(gun);
      const scope = mesh(GEO.ball, MAT.redLamp, false); scope.scale.setScalar(0.3); scope.position.set(0.2, 0.85, 0.2); sniper.add(scope);
      sniper.visible = false;
    }
    g.userData = { lans, loot: (r.loot || 0) + (r.scrap || 0), src: r, cart, sniper };
    return g;
  }

  // ---------------------------------------------------------------- gares et ville d'arrivée (construites autour de leur centre)
  const setpieces = new Map();
  function signTex(text, sub) {
    return canvasTex(512, 160, (x) => {
      x.fillStyle = '#16181d'; x.fillRect(0, 0, 512, 160); x.strokeStyle = '#ffc531'; x.lineWidth = 10; x.strokeRect(8, 8, 496, 144);
      x.fillStyle = '#fff8ea'; x.textAlign = 'center'; x.font = '900 52px Bungee, Impact, sans-serif'; x.fillText(text.toUpperCase(), 256, 84, 470);
      if (sub) { x.fillStyle = '#ffc531'; x.font = '700 28px "Chakra Petch", sans-serif'; x.fillText(sub, 256, 130); }
    });
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
    const b = box(w || 2, h || 2, d || 2, fallMat || FM.concrete); b.position.y = (h || 2) / 2; const g = new THREE.Group(); g.add(b); return g;
  }
  function buildStation(i) {
    const g = new THREE.Group();
    const qx = -(HALF_W + 2.6);
    // quai côté gauche (les caisses de la gare y sont posées), dépôt, abri, lampadaires, panneau
    const quai = box(3.2, 0.14, 34, FM.concrete); quai.position.set(qx, 0.07, 0); g.add(quai);
    const edge = box(0.12, 0.16, 34, MAT.brass, false); edge.position.set(qx + 1.55, 0.1, 0); g.add(edge);
    const dep = model('city/building-garage', 7, 3.9, 7, { cleanLook: true }); dep.position.set(-(HALF_W + 9.2), 0, -4); dep.rotation.y = Math.PI / 2; g.add(dep);
    for (let k = 0; k < 3; k++) { const w = box(0.06, 0.7, 1.2, MAT.window, false); w.position.set(-(HALF_W + 5.66), 1.6, -6.5 + k * 2.2); g.add(w); }
    const shelter = box(3.2, 0.16, 8, FM.roof); shelter.position.set(qx - 0.2, 2.9, 6); g.add(shelter);
    for (const dz of [2.4, 9.6]) for (const dx of [-1.4, 1.4]) { const c = box(0.14, 2.8, 0.14, FM.dark); c.position.set(qx - 0.2 + dx, 1.4, dz); g.add(c); }
    for (const dz of [-14, -4, 6, 14]) lampPost(-(HALF_W + 4.4), dz, g);
    const sm = new THREE.MeshBasicMaterial({ map: signTex(STATION_NAMES[i % STATION_NAMES.length], `Gare n° ${i + 1} · ravitaillement`) }); owned.mat.add(sm);
    const sign = mesh(G(new THREE.PlaneGeometry(4.2, 1.3)), sm, false, false); sign.position.set(-(HALF_W + 4.4), 4.4, 0.5); sign.rotation.y = Math.PI / 2 - 0.5; g.add(sign);
    for (const dz of [-1.4, 2.4]) { const sp = box(0.1, 4.4, 0.1, FM.dark); sp.position.set(-(HALF_W + 4.5), 2.2, dz); g.add(sp); }
    const lt = new THREE.PointLight(0xffd59a, 40, 22, 1.5); lt.position.set(-(HALF_W + 3.5), 4, 0); g.add(lt);
    const flag = kit && kit.make('platformer/flag', 1, 2.6, 1); if (flag) { flag.position.set(-(HALF_W + 6), 0, 12); g.add(flag); }
    // wagons garés sur une voie de service, côté droit
    if (kit) ['train/train-carriage-coal', 'train/train-carriage-box', 'train/train-carriage-lumber'].forEach((n, k) => { const w = kit.make(n, 0, 0, 0, { s: 3.4 }); if (w) { w.position.set(HALF_W + 6.5, 0, -10 + k * 9.6); g.add(w); } });
    return { g };
  }
  function buildCity() {
    const g = new THREE.Group();
    const names = ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d'];
    const HR = { 'building-small-a': 0.95, 'building-small-b': 1.63, 'building-small-c': 1.75, 'building-small-d': 1.0 };
    const rr = makeRng(424242);
    for (const side of [-1, 1]) for (let k = 0; k < 8; k++) {
      const n = names[(k + (side > 0 ? 2 : 0)) % 4], S = rr.range(5, 6.5), H = HR[n] * S;
      const b = model('city/' + n, S, H, S, { cleanLook: true });
      b.position.set(side * (HALF_W + 8.5 + rr.range(0, 5)), 0, -34 + k * 7.5); b.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(b);
      for (let w = 0; w < 3; w++) { const win = box(0.05, 0.6, 0.9, MAT.window, false); win.position.set(b.position.x - side * (S / 2 + 0.03), 1.4 + (w % 2) * 1.8, b.position.z - 1.5 + w * 1.4); g.add(win); }
    }
    // porte de la ville, braseros, grand panneau
    const gz = 26; // le convoi s'arrête juste après la porte
    for (const s of [-1, 1]) {
      const tw = box(1.4, 7, 1.4, FM.stone); tw.position.set(s * (HALF_W + 2.4), 3.5, gz); g.add(tw);
      const brz = mesh(GEO.ball, MAT.glow, false); brz.scale.setScalar(1.4); brz.position.set(s * (HALF_W + 2.4), 7.4, gz); g.add(brz);
    }
    const top = box(2 * (HALF_W + 2.4) + 1.4, 1.2, 1.4, FM.stone); top.position.set(0, 7.6, gz); g.add(top);
    const sm = new THREE.MeshBasicMaterial({ map: signTex('Fort-Givre', 'Terminus · bienvenue') }); owned.mat.add(sm);
    const sign = mesh(G(new THREE.PlaneGeometry(6, 1.9)), sm, false, false); sign.position.set(0, 7.6, gz + 0.75); g.add(sign);
    for (let k = 0; k < 6; k++) lampPost((k % 2 ? 1 : -1) * (HALF_W + 3.6), -20 + k * 8, g);
    const lt = new THREE.PointLight(0xffc27a, 70, 40, 1.4); lt.position.set(0, 7, -10); g.add(lt);
    return { g };
  }

  // ---------------------------------------------------------------- aiguillages : levier, panneau, voie qui s'en va
  const switches = new Map();
  function forkSignTex(labels, c, k) {
    return canvasTex(512, 128, (x) => {
      x.fillStyle = '#16181d'; x.fillRect(0, 0, 512, 128); x.strokeStyle = '#ffc531'; x.lineWidth = 6; x.strokeRect(5, 5, 502, 118);
      x.font = '700 15px "Chakra Petch", sans-serif'; x.fillStyle = '#ffc531'; x.textAlign = 'center'; x.fillText(k === 'st' ? 'AIGUILLAGE · PAYSAGE' : 'AIGUILLAGE · MOMENT FORT', 256, 26);
      labels.forEach((t, i) => {
        const on = i === c, cx = i ? 384 : 128;
        x.fillStyle = on ? '#ffc531' : 'rgba(255,248,234,.35)'; x.font = '900 30px Bungee, Impact, sans-serif';
        x.fillText((i ? '' : '◄ ') + t.toUpperCase() + (i ? ' ►' : ''), cx, 78, 236);
        if (on) { x.fillRect(cx - 90, 96, 180, 6); }
      });
      x.fillStyle = 'rgba(255,248,234,.25)'; x.fillRect(255, 40, 2, 76);
    });
  }
  function buildSwitch(f) {
    const g = new THREE.Group();
    const post = box(0.18, 1.2, 0.18, FM.dark); post.position.y = 0.6; g.add(post);
    const base = box(0.9, 0.25, 0.6, FM.dark); base.position.y = 0.12; g.add(base);
    const armPiv = new THREE.Group(); armPiv.position.set(0, 0.35, 0); g.add(armPiv);
    const arm = box(0.08, 1.1, 0.08, MAT.brass, false); arm.position.y = 0.5; armPiv.add(arm);
    const grip = mesh(GEO.ball, MAT.redLamp, false); grip.scale.setScalar(0.6); grip.position.y = 1.05; armPiv.add(grip);
    // cible tournante (rouge d'un côté, verte de l'autre) au sommet
    const target = new THREE.Group(); target.position.y = 1.45; g.add(target);
    const disc = mesh(G(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 16).rotateX(Math.PI / 2)), MAT.redLamp, false); target.add(disc);
    const disc2 = mesh(G(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 16).rotateX(Math.PI / 2)), MAT.green, false); disc2.position.z = 0.04; disc2.rotation.y = Math.PI / 2; target.add(disc2);
    const halo = mesh(GEO.ring, MAT.warn, false, false); halo.rotation.x = -Math.PI / 2; halo.scale.setScalar(1.4); halo.position.y = 0.03; g.add(halo);
    // panneau à deux flèches, au point de l'aiguille
    const sm = new THREE.MeshBasicMaterial({ map: null, transparent: true }); owned.mat.add(sm);
    const sign = mesh(G(new THREE.PlaneGeometry(4.6, 1.15)), sm, false, false); scene.add(sign);
    const legs = [-1.6, 1.6].map((x) => { const l = box(0.1, 3, 0.1, FM.dark); scene.add(l); l.userData.dx = x; return l; });
    scene.add(g);
    return { g, armPiv, target, halo, sign, sm, legs, key: '' };
  }

  // ---------------------------------------------------------------- congère, troupeau, zone d'avalanche, fusées
  const driftG = new THREE.Group(); scene.add(driftG);
  for (let i = 0; i < 6; i++) { const m = mesh(GEO.mound, MAT.snow, true); m.scale.set(1.8 + (i % 3) * 0.5, 1.2 + (i % 2) * 0.5, 1.4); m.position.set(-3.2 + i * 1.3, 0.2, (i % 2) * 0.5 - 0.2); driftG.add(m); }
  const driftStripe = box(7.5, 0.05, 0.4, MAT.warn, false); driftStripe.position.set(0, 0.03, 2.2); driftG.add(driftStripe);
  driftG.visible = false;
  const herdG = new THREE.Group(); herdG.visible = false; scene.add(herdG); let herdBuilt = false;
  const avalZone = mesh(GEO.plane, MAT.warn, false, false); avalZone.rotation.order = 'YXZ'; avalZone.rotation.x = -Math.PI / 2; avalZone.visible = false; scene.add(avalZone);
  const flareLights = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xff4a2a, 0, FLARE_R * 2.2, 1.5); scene.add(l); return l; });
  const flareMeshes = new Map();
  const flareRingMat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.22, depthWrite: false }); owned.mat.add(flareRingMat);

  // ---------------------------------------------------------------- modèles Kenney (chargés en arrière-plan ; le décor déjà affiché est reconstruit à leur arrivée)
  let kit = null;
  const actors = makeActors();
  loadKit(new URL('../models/', import.meta.url).href).then((k) => {
    if (disposed) { k.dispose(); return; }
    kit = k;
    for (const g of ruinMeshes.values()) ruinsGroup.remove(g); ruinMeshes.clear();
    for (const s of setpieces.values()) scene.remove(s.g); setpieces.clear();
    if (wreck) { scene.remove(wreck.g); wreck = null; }
    // les modèles du décor rejoignent l'affichage instancié
    for (const name of DECOR_MODELS) { const p = k.proto(name); if (p) scatter.define(name, p.parts); }
    buildModules();
    herdBuilt = false;
  }).catch((e) => console.warn(e));
  const DECOR_MODELS = [
    'holiday/tree-snow-a', 'holiday/tree-snow-b', 'holiday/tree-snow-c', 'nature/tree_pineTallA', 'nature/tree_pineTallB', 'nature/tree_pineTallC', 'nature/tree_pineTallD',
    'nature/tree_pineRoundA', 'nature/tree_pineRoundC', 'nature/tree_cone_dark', 'nature/tree_thin_dark', 'nature/tree_pineSmallA', 'nature/tree_pineSmallC', 'arena/tree',
    'nature/log_large', 'nature/stump_old', 'nature/stump_round', 'nature/plant_bush', 'nature/plant_bushLarge', 'nature/rock_largeA', 'nature/rock_largeC', 'nature/rock_largeE',
    'nature/rock_tallA', 'nature/rock_tallC', 'nature/rock_tallG', 'nature/cliff_block_rock', 'nature/canoe', 'holiday/snow-pile', 'holiday/rocks-large', 'holiday/snowman', 'holiday/reindeer',
    'commercial/building-a', 'commercial/building-b', 'commercial/building-d', 'commercial/building-e', 'commercial/low-detail-building-a', 'commercial/low-detail-building-b',
    'commercial/low-detail-building-c', 'commercial/building-skyscraper-a', 'racing/vehicle-truck-red', 'racing/vehicle-truck-green', 'racing/vehicle-truck-yellow',
    'pirate/structure-platform-dock-small', 'pirate/boat-row-small', 'industrial/shipping-container-a', 'industrial/shipping-container-b', 'industrial/chimney-large',
    'industrial/water-tower', 'industrial/building-a', 'industrial/building-f', 'industrial/building-k', 'industrial/detail-tank-large',
    'pirate/boat-row-large', 'pirate/ship-wreck', 'pirate/tower-watch', 'pirate/barrel', 'platformer/flag', 'survival/tent', 'survival/campfire-pit',
    'survival/fence-fortified', 'survival/signpost', 'nature/rock_tallE', 'nature/tent_detailedClosed', 'nature/campfire_logs', 'nature/log_stack',
    'nature/log_stackLarge', 'holiday/sled', 'holiday/lantern', 'fantasy/cart',
  ];
  // modules du convoi, en modèles Kenney quand ils sont là
  function buildModules() {
    benchG.clear(); dormG.clear();
    const wb = model('survival/workbench', 0, 0, 0, { s: 3.4 }); wb.position.y = -0.6; benchG.add(wb);
    const an = kit && kit.make('survival/workbench-anvil', 0, 0, 0, { s: 1.6 }); if (an) { an.position.set(0, 0.42, 0.3); benchG.add(an); }
    for (let i = 0; i < 4; i++) { const b = kit && kit.make('survival/bedroll', 0, 0, 0, { s: 2.6 }); if (b) { b.position.set(i % 2 ? 0.4 : -0.3, 0.02, -1.4 + i * 0.9); b.rotation.y = Math.PI / 2; dormG.add(b); } }
    const tent = kit && kit.make('survival/tent', 0, 0, 0, { s: 3.2 }); if (tent) { tent.position.set(0.1, 0, 0.2); dormG.add(tent); }
  }

  // ---------------------------------------------------------------- pannes à bord
  const faultMeshes = new Map();
  const iceMat = M(0xa8dcff, { emissive: 0x3a8fd8, emissiveIntensity: 0.5, roughness: 0.3, transparent: true, opacity: 0.9 });
  const oilMat = M(0x14110e, { roughness: 0.15, metalness: 0.4, flatShading: false });
  const markMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.6, depthWrite: false }); owned.mat.add(markMat);
  const flameMat = M(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 3, transparent: true, opacity: 0.9 });
  function buildFault(f) {
    const g = new THREE.Group();
    if (f.k === 'pipe') {
      const pipe = mesh(GEO.cyl10, MAT.metal); pipe.scale.set(0.1, 1.6, 0.1); pipe.rotation.x = Math.PI / 2; pipe.position.set(Math.sign(f.x) * 0.25, 0.35, 0); g.add(pipe);
      const ice = new THREE.Group(); g.add(ice);
      for (let i = 0; i < 5; i++) { const c = mesh(GEO.mound, iceMat, false); c.scale.set(0.16 + (i % 2) * 0.06, 0.32 + (i % 3) * 0.1, 0.16); c.position.set(Math.sign(f.x) * 0.25 + (i % 2 ? 0.08 : -0.08), 0.42, -0.6 + i * 0.3); c.rotation.set(i, i * 2, 0); ice.add(c); }
      g.userData.shrink = ice;
    } else if (f.k === 'fire') {
      const fl = new THREE.Group(); g.add(fl);
      for (let i = 0; i < 4; i++) { const c = mesh(GEO.cone, flameMat, false); c.scale.set(0.22, 0.7 + (i % 2) * 0.3, 0.22); c.position.set((i % 2 ? 0.2 : -0.2), 0.4, (i - 1.5) * 0.25); fl.add(c); }
      const lt = new THREE.PointLight(0xff7a2a, 16, 6, 1.6); lt.position.y = 0.8; g.add(lt);
      g.userData.shrink = fl; g.userData.flick = fl;
    } else {
      const puddle = mesh(G(new THREE.CircleGeometry(0.75, 16)), oilMat, false, false); puddle.rotation.x = -Math.PI / 2; puddle.position.y = 0.02; g.add(puddle);
      const can = mesh(GEO.cyl10, MAT.rust); can.scale.set(0.22, 0.5, 0.22); can.position.set(Math.sign(f.x) * 0.25, 0.25, 0.3); can.rotation.z = 1.4; g.add(can);
      g.userData.shrink = puddle;
    }
    const ring = mesh(GEO.ring, markMat, false, false); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(0.95); ring.position.y = 0.04; g.add(ring);
    const bang = mesh(GEO.ball, MAT.redLamp, false); bang.scale.setScalar(0.6); bang.position.y = 1.5; g.add(bang);
    g.userData.ring = ring; g.userData.bang = bang;
    scene.add(g);
    return g;
  }

  // ---------------------------------------------------------------- front de tempête : un mur de neige qui suit le convoi
  const stormTex = canvasTex(512, 256, (x) => {
    const gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(60,68,84,0)'); gr.addColorStop(0.18, 'rgba(62,70,88,.75)'); gr.addColorStop(0.6, 'rgba(92,102,120,.95)'); gr.addColorStop(1, 'rgba(206,214,226,1)');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 256);
    const r = makeRng(5);
    x.filter = 'blur(5px)';
    const blob = (bx, by, rx, ry, col) => { for (const o of [-512, 0, 512]) { x.fillStyle = col; x.beginPath(); x.ellipse(bx + o, by, rx, ry, 0, 0, 7); x.fill(); } };
    for (let i = 0; i < 220; i++) { const v = r.int(40, 110); blob(r.range(0, 512), r.range(30, 200), r.range(25, 90), r.range(10, 34), `rgba(${v},${v + 8},${v + 22},${r.range(0.15, 0.45)})`); }
    for (let i = 0; i < 160; i++) blob(r.range(0, 512), r.range(60, 256), r.range(20, 70), r.range(3, 9), `rgba(235,242,250,${r.range(0.1, 0.35)})`); // rafales de neige
  });
  stormTex.wrapS = THREE.RepeatWrapping;
  const stormG = new THREE.Group(); scene.add(stormG);
  const stormMats = [0, 1, 2].map((i) => { const m = new THREE.MeshBasicMaterial({ map: stormTex.clone(), transparent: true, opacity: 0.92 - i * 0.12, depthWrite: false, fog: false, side: THREE.DoubleSide }); m.map.wrapS = THREE.RepeatWrapping; m.map.repeat.set(5 + i * 2, 1); owned.tex.add(m.map); owned.mat.add(m); return m; });
  stormMats.forEach((m, i) => { const pl = mesh(GEO.plane, m, false, false); pl.scale.set(700, 46 + i * 8, 1); pl.position.set(0, 18 + i * 3, i * 5); stormG.add(pl); });
  // ombre du front au sol (visible d'en haut) : un voile sombre qui commence pile au front
  const shadeTex = canvasTex(8, 128, (x) => { const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(70,78,94,0)'); gr.addColorStop(0.25, 'rgba(70,78,94,.55)'); gr.addColorStop(1, 'rgba(60,66,80,.95)'); x.fillStyle = gr; x.fillRect(0, 0, 8, 128); });
  const shadeMat = new THREE.MeshBasicMaterial({ map: shadeTex, transparent: true, depthWrite: false, fog: false }); owned.mat.add(shadeMat);
  const shade = mesh(GEO.plane, shadeMat, false, false); shade.rotation.x = -Math.PI / 2; shade.scale.set(260, 70, 1); shade.position.set(0, 0.35, 35); stormG.add(shade);
  const stormLight = new THREE.PointLight(0xdfe8ff, 0, 120, 1.2); stormG.add(stormLight); stormLight.position.set(0, 20, 8);
  let flashT = 0;
  // aurore boréale, les nuits claires du lac, de la toundra et du col
  const auroraTex = canvasTex(512, 128, (x) => {
    for (let i = 0; i < 6; i++) { const gr = x.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(60,255,170,0)'); gr.addColorStop(0.35, `rgba(${60 + i * 20},255,${170 - i * 10},.35)`); gr.addColorStop(1, 'rgba(160,90,255,0)');
      x.fillStyle = gr; x.beginPath(); x.moveTo(0, 128); for (let u = 0; u <= 512; u += 16) x.lineTo(u, 40 + Math.sin(u / 60 + i) * 26 + i * 6); x.lineTo(512, 128); x.fill(); }
  });
  auroraTex.wrapS = THREE.RepeatWrapping;
  const auroraMat = new THREE.MeshBasicMaterial({ map: auroraTex, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); owned.mat.add(auroraMat);
  const aurora = mesh(GEO.plane, auroraMat, false, false); aurora.scale.set(260, 40, 1); aurora.position.set(0, 48, -90); aurora.rotation.x = 0.35; scene.add(aurora);

  // ---------------------------------------------------------------- pillards en motoneige, Brise-Glace
  const raiders = new Map();
  const RM = { body: M(0x5a1f1a), dark: M(0x1c1d21), coat: M(0x3a3026), scarf: M(0xd8342a), skin: M(0xc79a7a), glass: new THREE.MeshStandardMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.5, roughness: 0.1 }) };
  owned.mat.add(RM.glass);
  function buildRider() {
    const rider = new THREE.Group();
    const torso = box(0.55, 0.7, 0.4, RM.coat); torso.position.y = 0.4; rider.add(torso);
    const h = mesh(GEO.ball, RM.skin); h.scale.setScalar(1.05); h.position.y = 0.95; rider.add(h);
    const scarf = box(0.42, 0.14, 0.42, RM.scarf); scarf.position.y = 0.8; rider.add(scarf);
    const gog = box(0.36, 0.08, 0.1, RM.glass, false); gog.position.set(0, 0.99, -0.2); rider.add(gog);
    const cap = box(0.38, 0.14, 0.38, RM.dark); cap.position.y = 1.12; rider.add(cap);
    for (const sx of [-0.32, 0.32]) { const arm = box(0.14, 0.5, 0.14, RM.coat); arm.position.set(sx, 0.45, -0.25); arm.rotation.x = -1.1; rider.add(arm); }
    return rider;
  }
  function buildRaider() {
    const g = new THREE.Group(), sled = new THREE.Group(); g.add(sled);
    const b = box(0.9, 0.45, 2.0, RM.body); b.position.y = 0.55; sled.add(b);
    const hood = box(0.8, 0.3, 0.7, RM.body); hood.position.set(0, 0.75, -0.75); hood.rotation.x = 0.35; sled.add(hood);
    const scr = box(0.75, 0.4, 0.04, RM.glass, false); scr.position.set(0, 1.05, -0.45); scr.rotation.x = -0.5; sled.add(scr);
    const seat = box(0.6, 0.18, 0.9, RM.dark); seat.position.set(0, 0.85, 0.3); sled.add(seat);
    for (const sx of [-0.55, 0.55]) { const ski = box(0.12, 0.06, 2.3, MAT.steel); ski.position.set(sx, 0.08, -0.1); sled.add(ski); const st = box(0.06, 0.4, 0.06, MAT.steel); st.position.set(sx, 0.28, -0.6); sled.add(st); }
    const tread = box(0.6, 0.3, 1.1, RM.dark); tread.position.set(0, 0.25, 0.55); sled.add(tread);
    const lamp = mesh(GEO.ball, MAT.lamp, false); lamp.scale.setScalar(0.5); lamp.position.set(0, 0.75, -1.1); sled.add(lamp);
    const rider = buildRider(); rider.position.set(0, 0.95, 0.25); sled.add(rider);
    const crate = makeCrate(); crate.position.set(0, 1.0, 0.85); sled.add(crate);
    const flag = box(0.04, 1.4, 0.04, MAT.dark, false); flag.position.set(0.35, 1.4, 0.95); sled.add(flag);
    const cloth = box(0.02, 0.35, 0.5, RM.scarf, false); cloth.position.set(0.35, 1.95, 1.2); sled.add(cloth);
    const aboard = buildRider(); aboard.scale.setScalar(1.2); aboard.visible = false; scene.add(aboard);
    g.scale.setScalar(1.2);
    scene.add(g);
    return { g, sled, rider, crate, cloth, aboard };
  }
  const BM = { hull: F(M(0x5a1f1a), 0.35), plate: F(M(0x3b3f46, { metalness: 0.5, roughness: 0.5 }), 0.4), spike: M(0xb8bec7, { metalness: 0.7, roughness: 0.3 }) };
  function buildBoss() {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const ch = box(2.6, 0.7, 6.4, MAT.dark); ch.position.y = 0.75; body.add(ch);
    const bed = box(2.7, 1.5, 3.8, BM.hull); bed.position.set(0, 1.85, 1.1); body.add(bed);
    const cabB = box(2.5, 1.6, 2.0, BM.hull); cabB.position.set(0, 1.9, -1.9); body.add(cabB);
    const win = box(2.2, 0.5, 0.05, RM.glass, false); win.position.set(0, 2.3, -2.92); body.add(win);
    for (const sx of [-1, 1]) {
      const pl = box(0.12, 1.2, 5.6, BM.plate); pl.position.set(sx * 1.42, 1.5, 0.2); body.add(pl);
      for (let k = 0; k < 3; k++) { const w = mesh(GEO.wheel, MAT.dark); w.scale.setScalar(1.6); w.position.set(sx * 1.25, 0.65, -2.2 + k * 2.1); body.add(w); }
    }
    for (const sx of [-1, 1]) { const pw = box(1.9, 1.3, 0.2, BM.plate); pw.position.set(sx * 0.7, 0.8, -3.45); pw.rotation.y = sx * 0.55; body.add(pw); }
    for (let k = 0; k < 5; k++) { const sp = mesh(GEO.cone, BM.spike, false); sp.scale.set(0.12, 0.6, 0.12); sp.rotation.x = -Math.PI / 2; sp.position.set(-1 + k * 0.5, 0.95, -3.75); body.add(sp); }
    for (const sx of [-0.8, 0.8]) { const l = mesh(GEO.ball, MAT.lamp, false); l.scale.setScalar(0.6); l.position.set(sx, 1.5, -2.95); body.add(l); }
    const st = mesh(GEO.cyl10, MAT.dark); st.scale.set(0.18, 1.6, 0.18); st.position.set(1.0, 3.2, -1.2); body.add(st);
    const pole = box(0.06, 2.4, 0.06, MAT.dark, false); pole.position.set(-1.1, 3.6, 2.6); body.add(pole);
    const flag = box(0.03, 0.7, 1.1, RM.scarf, false); flag.position.set(-1.1, 4.4, 3.1); body.add(flag);
    const winch = mesh(GEO.cyl10, MAT.brass); winch.scale.set(0.35, 0.5, 0.35); winch.rotation.z = Math.PI / 2; winch.position.set(0, 2.8, 0.6); body.add(winch);
    return { g, body, flag };
  }
  let boss = null;
  const hooksM = new Map();
  const cableMat = M(0x2b2b2e, { metalness: 0.6 }), hoseMat = M(0x1f1f22, { roughness: 0.6 }), laserMat = new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.7, depthWrite: false }), harpoonMat = M(0xc8a24a, { metalness: 0.6 });
  owned.mat.add(laserMat);
  const clawGeo = G(new THREE.TorusGeometry(0.22, 0.06, 5, 10, Math.PI * 1.3));
  function buildHook() {
    const g = new THREE.Group();
    const claw = mesh(clawGeo, MAT.brass, false); claw.rotation.y = Math.PI / 2; g.add(claw);
    const ring = mesh(GEO.ring, markMat, false, false); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(0.95); ring.position.y = -0.7; g.add(ring);
    scene.add(g);
    return { g, cable: makeLine(cableMat) };
  }
  // un câble (tuyau, laser, harpon) : une boîte fine tendue entre deux points du repère local
  function makeLine(mat, w = 0.05) { const m = mesh(GEO.box, mat, false, false); m.visible = false; m.userData.w = w; scene.add(m); return m; }
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  function stretch(m, ax, ay, az, bx, by, bz) {
    va.set(ax, ay, az); vb.set(bx, by, bz); const len = va.distanceTo(vb);
    m.visible = len > 0.05; m.position.copy(va).add(vb).multiplyScalar(0.5); m.lookAt(vb); m.scale.set(m.userData.w, m.userData.w, len);
  }
  const hoses = new Map(), lasers = new Map(), harpoons = [];

  // ---------------------------------------------------------------- pont de la gorge (dessiné autour de son centre)
  const chasmTex = canvasTex(64, 256, (x) => {
    const gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#e9f0f7'); gr.addColorStop(0.08, '#7d8ea3'); gr.addColorStop(0.22, '#24303f'); gr.addColorStop(0.5, '#0b1018'); gr.addColorStop(0.78, '#24303f'); gr.addColorStop(0.92, '#7d8ea3'); gr.addColorStop(1, '#e9f0f7');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 256);
    const r = makeRng(17); for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(200,215,230,${r.range(0.04, 0.16)})`; x.fillRect(r.range(0, 64), r.range(40, 216), r.range(2, 10), r.range(1, 3)); }
  });
  chasmTex.wrapS = THREE.RepeatWrapping; chasmTex.repeat.set(30, 1);
  const gorge = new THREE.Group(); gorge.visible = false; scene.add(gorge);
  {
    const cm = new THREE.MeshBasicMaterial({ map: chasmTex, fog: true }); owned.mat.add(cm);
    const ch = mesh(GEO.plane, cm, false, false); ch.rotation.x = -Math.PI / 2; ch.scale.set(220, BRIDGE_LEN + 4, 1); ch.position.y = 0.03; gorge.add(ch);
    const deck = box(4.8, 0.1, BRIDGE_LEN + 4, FM.wood, false); deck.position.y = 0.05; gorge.add(deck);
    for (let z = -BRIDGE_LEN / 2; z < BRIDGE_LEN / 2; z += 4) for (const sgn of [-1, 1]) { const x = box(0.22, 0.04, 5.6, MAT.wood, false); x.position.set(sgn * 3.4, 0.045, z + 2); x.rotation.y = sgn * 0.7; gorge.add(x); }
    for (let z = -BRIDGE_LEN / 2; z <= BRIDGE_LEN / 2; z += 2.5) for (const sx of [-2.35, 2.35]) { const pst = box(0.1, 0.9, 0.1, FM.wood); pst.position.set(sx, 0.45, z); gorge.add(pst); }
    for (const sx of [-2.35, 2.35]) { const rl = box(0.08, 0.08, BRIDGE_LEN + 4, FM.wood, false); rl.position.set(sx, 0.9, 0); gorge.add(rl); }
    for (const sz of [-1, 1]) { const lip = box(220, 0.3, 1.4, MAT.snow, false); lip.position.set(0, 0.05, sz * (BRIDGE_LEN / 2 + 2.2)); gorge.add(lip); }
  }
  // ---------------------------------------------------------------- convoi abandonné sur sa voie de garage
  let wreck = null;
  function buildWreck() {
    const g = new THREE.Group(), x0 = -(HALF_W + 7.2);
    const ballast = box(4, 0.1, 40, M(0x6f6a66), false); ballast.position.set(x0, 0.05, 0); g.add(ballast);
    for (const sx of [-0.75, 0.75]) { const r = box(0.12, 0.14, 40, FM.rust, false); r.position.set(x0 + sx, 0.17, 0); g.add(r); }
    const names = ['train/train-carriage-box', 'train/train-carriage-tank', 'train/train-locomotive-b'];
    [-11, 0, 11].forEach((o, i) => {
      const w = new THREE.Group(); w.position.set(x0, 0, o); w.rotation.y = -(i - 1) * 0.06; w.rotation.z = (i - 1) * 0.05; g.add(w);
      const mdl = kit && kit.make(names[i], 0, 0, 0, { s: 3.5 });
      if (mdl) { w.add(mdl); }
      else {
        const chs = box(2.6, 0.5, 9.2, FM.dark); chs.position.y = 0.75; w.add(chs);
        const bodyW = box(2.8, 2.1, 9.5, FM.rust); bodyW.position.y = 2.0; w.add(bodyW);
      }
      const roof = box(3.0, 0.2, 9.4, MAT.snow, false); roof.position.y = mdl ? 4.7 : 3.15; if (!mdl) w.add(roof);
      const drift = mesh(GEO.mound, MAT.snow, false); drift.scale.set(2.2, 0.8, 4); drift.position.set(1.6, 0, i * 2 - 2); w.add(drift);
    });
    return g;
  }

  // ---------------------------------------------------------------- joueurs, survivants, loups et caisses
  const players = new Map(), survivors = new Map();
  function labelTex(name, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = '700 30px "Chakra Petch", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = Math.min(240, x.measureText(name).width + 28);
    x.fillStyle = 'rgba(14,16,20,.78)'; x.beginPath(); x.roundRect(128 - w / 2, 10, w, 44, 12); x.fill();
    x.fillStyle = color; x.fillRect(128 - w / 2 + 8, 26, 8, 12);
    x.fillStyle = '#fff'; x.fillText(name, 136, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // caisses : 1 fioul (orange), 2 charbon (noire, morceaux sur le dessus), 3 fioul pris dans la glace, 4 pièces détachées, 5 bûches
  const coalBox = M(0x2c2d31, { roughness: 0.95 }), partsBox = M(0x7d848e, { metalness: 0.5, roughness: 0.45 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x2a6fa8, emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.55, flatShading: true }); owned.mat.add(shellMat);
  const gearGeo = G(new THREE.TorusGeometry(0.13, 0.05, 5, 8)), logGeo = G(new THREE.CylinderGeometry(0.11, 0.11, 0.62, 7).rotateZ(Math.PI / 2));
  function makeCrate(t = 1) {
    const g = new THREE.Group();
    if (t === 2) {
      g.add(mesh(GEO.crate, coalBox));
      for (let i = 0; i < 5; i++) { const l = mesh(GEO.ball, MAT.coal, false); l.scale.setScalar(0.45 + (i % 2) * 0.2); l.position.set(-0.14 + (i % 3) * 0.14, 0.27, -0.12 + (i >> 1) * 0.12); g.add(l); }
      const s = mesh(GEO.crate, MAT.rust, false); s.scale.set(1.03, 0.14, 1.03); s.position.y = -0.1; g.add(s);
    } else if (t === 4) {
      g.add(mesh(GEO.crate, partsBox));
      const s = mesh(GEO.crate, MAT.brass, false); s.scale.set(1.03, 0.14, 1.03); g.add(s);
      const gear = mesh(gearGeo, MAT.brass, false); gear.position.set(0, 0.27, 0); gear.rotation.x = Math.PI / 2; g.add(gear);
    } else if (t === 5) {
      for (let i = 0; i < 5; i++) { const l = mesh(logGeo, MAT.wood); l.position.set(0, -0.15 + (i > 2 ? 0.2 : 0), -0.2 + (i % 3) * 0.2 + (i > 2 ? 0.1 : 0)); g.add(l); }
      const band = box(0.06, 0.5, 0.62, MAT.stripe, false); g.add(band);
    } else {
      g.add(mesh(GEO.crate, MAT.crate));
      const s = mesh(GEO.crate, MAT.stripe, false); s.scale.set(1.02, 0.18, 1.02); g.add(s);
      const s2 = mesh(GEO.crate, MAT.stripe, false); s2.scale.set(0.18, 1.02, 1.03); g.add(s2);
      if (t === 3) { const sh = mesh(GEO.crate, shellMat, false, false); sh.scale.setScalar(1.35); g.add(sh); g.userData.shell = sh; }
    }
    g.userData.t = t;
    return g;
  }
  function buildPlayer(p) {
    const o = actors.survivor(p.color);
    const held = [null, 1, 2, 3, 4, 5].map((t) => { if (!t) return null; const c = makeCrate(t); c.position.set(0, 2.15, 0.05); c.visible = false; o.root.add(c); return c; });
    const tex = labelTex(p.name, p.color);
    const labMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const label = new THREE.Sprite(labMat); label.scale.set(2.4, 0.6, 1); label.position.y = 2.85; label.renderOrder = 10; o.g.add(label);
    scene.add(o.g);
    o.held = held; o.label = label; o.own.push(tex, labMat); o.name = p.name; o.color = p.color;
    return o;
  }
  const crates = new Map();
  const wolves = new Map();
  const falls = [];        // arbres qui tombent
  let prevCut = new Set();

  // ---------------------------------------------------------------- dimensionnement
  let W = 1, H = 1;
  const ro = new ResizeObserver(() => resize()); ro.observe(host);
  function resize() {
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false); camera.aspect = W / H;
    if (post) { const pr = renderer.getPixelRatio(); post.setSize(Math.round(W * pr), Math.round(H * pr)); }
    camera.fov = W / H < 0.8 ? 52 : 38; // portrait : on recule un peu
    camera.updateProjectionMatrix();
  }
  resize();
  const onCtxLost = (e) => { e.preventDefault(); onLost && onLost(); };
  canvas.addEventListener('webglcontextlost', onCtxLost);

  // ---------------------------------------------------------------- image
  const focus = new THREE.Vector3(0, 0, 0);
  let camInit = false, wheelA = 0, lastSeed = null, lastKey = null, shake = 0, gustK = 0, tunK = 0, lastDrift = null;
  const v3 = new THREE.Vector3();
  const fogG = new THREE.Color(FOG_GUST), fogS = new THREE.Color(0x8e99a8), fogN = new THREE.Color(FOG_NIGHT), fogT = new THREE.Color(FOG_TUNNEL), bioFog = new THREE.Color(FOG), tmpC = new THREE.Color();
  let fogNear = 14, fogFar = 56;
  const camLook = new THREE.Vector3(), cp = new THREE.Vector3(), cl = new THREE.Vector3();
  const O = { x: 0, z: 0, yaw: 0 }, O2 = { x: 0, z: 0, yaw: 0 };
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
  // position d'un objet du repère du train : sur le pont (wagon rigide) ou au sol (courbe)
  const placeTrain = (obj, x, y, z, yaw, onDeck) => { (onDeck ? B.deck : B.train)(x, z, O); obj.position.set(O.x, y, O.z); obj.rotation.y = yaw + O.yaw; return O; };
  const placeGround = (obj, x, y, zw, yaw) => { B.ground(x, zw, O); obj.position.set(O.x, y, O.z); obj.rotation.y = yaw + O.yaw; return O; };

  // une voie (rails, traverses, ballast) le long de la courbe, ou d'une voie annexe donnée par une fonction de position
  function drawTrack(d0, d1, at) {
    for (let d = Math.ceil(d0 / 1.2) * 1.2; d < d1; d += 1.2) { at(d, 0, O); scatter.add('sleeper', O.x, 0.15, O.z, O.yaw, 1); }
    for (let d = Math.ceil(d0 / 1.25) * 1.25; d < d1; d += 1.25) {
      at(d, 0, O); scatter.add('ballast', O.x, 0.06, O.z, O.yaw, 1);
      for (const sx of [-0.75, 0.75]) { at(d, sx, O); scatter.add('rail', O.x, 0.26, O.z, O.yaw, 1); }
    }
  }
  // voie qui s'en va de l'autre côté d'un aiguillage : on l'intègre depuis la pointe de l'aiguille
  const alt = { x: 0, z: 0, th: 0 };
  function altPath(f, side) {
    const a = line.at(f.at), Bd = forkBend(f), pts = [];
    let x = a.x, z = a.z, th = a.th;
    for (let u = 0; u <= 150; u++) { pts.push([x, z, th]); const k = u < Bd.len ? side * Bd.ang / Bd.len : 0; th += k; x += Math.sin(th); z -= Math.cos(th); }
    return (u, lat, o) => {
      const i = Math.max(0, Math.min(149, Math.floor(u))), f2 = u - i, p = pts[i], q = pts[i + 1];
      const px = p[0] + (q[0] - p[0]) * f2, pz = p[1] + (q[1] - p[1]) * f2, pth = p[2] + (q[2] - p[2]) * f2;
      return B.world(px + lat * Math.cos(pth), pz + lat * Math.sin(pth), pth, o);
    };
  }

  function frame(view, dt) {
    const runKey = view.seed + ':' + view.diff + ':' + view.mode + ':' + view.goal;
    if (runKey !== lastKey) {
      reset(); lastKey = runKey; lastSeed = view.seed;
      ruins = new Ruins(view.seed, DIFFICULTY[view.diff]?.loot ?? 0.6, view.mode || 'endless', view.goal || 0);
      line = new Line(view.seed, view.mode || 'endless', view.goal || 0); B = makeBend(line);
    }
    const R = view.route || { legs: view.legs || ['plaine'], mk: view.mk || [], pc: null };
    ruins.setRoute(R.legs, R.mk);
    line.setRoute(R.legs, R.mk, R.pc);
    const dist = view.dist;
    B.set(dist);
    const bl = view.diff === 'blizzard';
    const cut = view.cut || prevCut;

    // paysage, nuit, tunnel : teinte du sol et du brouillard, lumière
    gustK += ((view.gust > 0 ? 1 : 0) - gustK) * Math.min(1, dt * 1.5);
    tunK += ((view.tn ? 1 : 0) - tunK) * Math.min(1, dt * 2.5);
    const look = BIO_LOOK[view.bio] || BIO_LOOK.plaine, kb = Math.min(1, dt * 0.8);
    bioFog.lerp(tmpC.set(look.fog), kb); groundMat.color.lerp(tmpC.set(look.ground), kb); groundMat.roughness += (look.rough - groundMat.roughness) * kb;
    fogNear += (look.near - fogNear) * kb; fogFar += (look.far - fogFar) * kb;
    const nk = view.night || 0;
    scene.fog.near = (bl ? fogNear - 5 : fogNear) - gustK * 6 - tunK * 6; scene.fog.far = (bl ? fogFar - 14 : fogFar) - gustK * 22 - nk * 8 - tunK * 18;
    scene.fog.color.copy(bioFog).lerp(fogG, gustK).lerp(fogN, nk * 0.88).lerp(fogT, tunK * 0.9); scene.background.copy(scene.fog.color);
    const dim = 1 - 0.85 * tunK;
    hemi.intensity = 0.72 * (1 - 0.7 * nk) * dim; hemi.color.copy(hemiDay).lerp(hemiNight, nk);
    sun.intensity = 1.55 * (1 - 0.82 * nk) * (1 - 0.95 * tunK); sun.color.copy(sunDay).lerp(sunNight, nk);
    scene.environmentIntensity = 0.2 * (1 - 0.75 * nk) * dim;
    SNOWFX.uT.value = view.t; SNOWFX.uSpark.value = (1 - 0.7 * nk) * (1 - tunK) * (view.bio === 'ville' || view.bio === 'usine' ? 0.35 : 1);
    snow.mat.size = (bl ? 0.26 : 0.2) + gustK * 0.14;
    snow.mat.color.setRGB(1 - nk * 0.4, 1 - nk * 0.33, 1 - nk * 0.2); snow.mat.opacity = 0.95 * (1 - tunK * 0.9);
    const auroraK = nk * (view.bio === 'lac' || view.bio === 'toundra' || view.bio === 'col' ? 0.85 : 0.25) * (1 - tunK);
    auroraMat.opacity += (auroraK - auroraMat.opacity) * Math.min(1, dt); auroraTex.offset.x = (view.t * 0.01) % 1;
    // caméra : suit le joueur local (ou le convoi)
    let fx = view.focus.x, fz = view.focus.z;
    if (view.me) { const me = view.me; (me.on || me.ref ? B.deck : B.train)(me.x, me.on ? me.z * 0.6 : me.z, O); fx = O.x * 0.85; fz = O.z; }
    if (!camInit) { focus.set(fx, 0, fz); camInit = true; }
    focus.x += (fx - focus.x) * Math.min(1, dt * 4); focus.z += (fz - focus.z) * Math.min(1, dt * 4);
    shake = Math.max(0, shake - dt * 2);
    camera.position.copy(focus).add(CAM_OFF);
    camLook.set(focus.x, 0.8, focus.z - 1.5);
    if (view.cine != null) cinematic(view.cine, view.gap);
    if (shake > 0) camera.position.add(v3.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
    camera.lookAt(camLook);
    sun.position.set(focus.x - 9, 24, focus.z + 7); sun.target.position.set(focus.x, 0, focus.z);
    // le sol reste fixe dans le monde : on tourne son pivot avec le cap, et on cale sa texture sur sa position réelle
    const A = B.anchor;
    groundPivot.rotation.y = A.th;
    const wcx = A.x + focus.x * Math.cos(A.th) - focus.z * Math.sin(A.th), wcz = A.z + focus.x * Math.sin(A.th) + focus.z * Math.cos(A.th);
    const gx = Math.round(wcx / 10) * 10, gz = Math.round(wcz / 10) * 10;
    B.world(gx, gz, 0, O); groundPivot.position.set(O.x, 0, O.z);
    snowTex.offset.set((gx / 10) % 1, (-gz / 10) % 1); snowNrm.offset.copy(snowTex.offset);

    scatter.begin(); cliffStrip.begin(); ravStrip.begin(); ridgeStrip.begin();
    // la voie, et son tablier au-dessus de la gorge
    drawTrack(dist - 130, dist + 230, B.at);

    // le convoi : chaque wagon suit la courbe
    wagonG.forEach((g, i) => { const w = B.wag[i]; g.position.set(w.x, view.speed > 0.1 ? Math.sin(view.t * 9 + i) * 0.015 * view.speed : 0, w.z); g.rotation.y = w.yaw; });
    wheelA += (view.speed / 0.42) * dt; for (const w of wheels) w.rotation.x = -wheelA;
    const up = view.up || {};
    turretG.visible = !!up.turret; benchG.visible = !!up.workshop; dormG.visible = !!up.dorm;
    if (turretG.visible) { turretHead.rotation.y += ((view.ty ?? Math.PI) - turretHead.rotation.y) * Math.min(1, dt * 10); }

    // chaudière : feu et lumière selon le carburant
    const f = Math.min(1, view.fuel / 100), flick = 0.85 + Math.sin(view.t * 23) * 0.08 + Math.sin(view.t * 7.3) * 0.07;
    fireMat.emissiveIntensity = (0.6 + 5 * f) * flick;
    fireLight.intensity = (4 + 34 * f) * flick * (1 + 0.4 * tunK);
    fire.scale.setScalar(0.4 + 0.6 * Math.min(1, f * 1.6));
    beam.intensity = (view.speed > 0.05 ? 45 : 18) * (1 + 0.8 * nk + 1.2 * tunK); coneMat.opacity = (view.speed > 0.05 ? 0.1 : 0.05) + 0.1 * nk + 0.12 * tunK;
    warmMat.opacity = view.fuel > 0 ? 0.1 + 0.07 * Math.sin(view.t * 3) : 0;
    warmRing.scale.setScalar(view.warmR || WARM_R);
    // pression : la chaudière rougit, l'aiguille monte, la vapeur fuit ; manette selon le régime
    const pr = Math.max(0, Math.min(100, view.press || 0)) / 100;
    boilerMat.emissiveIntensity = pr > 0.6 ? (pr - 0.6) * 2.2 * (0.7 + 0.3 * Math.sin(view.t * (8 + pr * 14))) : 0;
    needlePiv.rotation.z = 2.2 - pr * 4.4;
    // manette de vitesse : le convoi du menu n'a pas de cran (thr), et un angle invalide la ferait disparaître pour de bon
    const thr = Number.isFinite(view.thr) ? view.thr : 1;
    leverA += ((thr - 1) * -0.65 - leverA) * Math.min(1, dt * 8); if (!Number.isFinite(leverA)) leverA = 0; leverPiv.rotation.x = leverA;
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
    // flocons proches : dans une boîte à mi-chemin entre la caméra et le point suivi
    {
      const cx = focus.x + CAM_OFF.x * 0.55, cy = CAM_OFF.y * 0.55, cz = focus.z + CAM_OFF.z * 0.55;
      for (let i = 0; i < NEARF; i++) {
        let x = nflakes[i * 3] + (wx * 0.6 + Math.sin(i * 1.7 + view.t) * 0.8) * dt, y = nflakes[i * 3 + 1] + wy * 0.5 * dt, z = nflakes[i * 3 + 2] + wz * 0.6 * dt;
        x = ((x - cx + NB) % (2 * NB) + 2 * NB) % (2 * NB) - NB + cx; y = ((y - cy + NB) % (2 * NB) + 2 * NB) % (2 * NB) - NB + cy; z = ((z - cz + NB) % (2 * NB) + 2 * NB) % (2 * NB) - NB + cz;
        nflakes[i * 3] = x; nflakes[i * 3 + 1] = y; nflakes[i * 3 + 2] = z;
      }
      nearF.geo.attributes.position.needsUpdate = true; nearF.mat.opacity = 0.3 * (1 - tunK) * (0.6 + 0.4 * gustK + 0.3 * (bl ? 1 : 0));
    }
    SWAY.uT.value = view.t; SWAY.uWind.value = Math.min(1, 0.25 + gustK * 0.75 + (bl ? 0.2 : 0));
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

    // paysage du voisinage : ruines (objets), arbres et décor (instances)
    const live = new Set(), looted = view.looted;
    for (const [k, c] of ruins.around(dist)) {
      decorOf(view.seed, k, c);
      for (const t of c.trees) {
        B.ground(t.x, t.zw, O);
        if (cut.has(t.id)) { if (!prevCut.has(t.id) && Math.abs(t.zw + dist) < 80) startFall(t); put('nature/stump_old', O.x, 0, O.z, t.r, 2.6); continue; }
        put(t.m, O.x, 0, O.z, t.r + O.yaw, t.s, t.s, t.s, t.id, Math.abs(t.x) > 22);
      }
      for (const q of c.decor) {
        if (q.wall) continue;
        if (q.m[0] === '~') { drawSpecial(q, c, view); continue; }
        B.ground(q.x, q.zw, O); put(q.m, O.x, 0, O.z, -q.r + O.yaw, q.s, q.s, q.s, q.x * 7.3 + q.zw * 3.1, Math.abs(q.x) > 22);
      }
      for (const q of c.vis) { B.ground(q.x, q.zw, O); scatter.add(q.m, O.x, q.y, O.z, q.r + O.yaw, q.sx, q.sy, q.sz); }
      for (const r of c.ruins) {
        live.add(r.id);
        let g = ruinMeshes.get(r.id);
        if (g && g.userData.src !== r) { ruinsGroup.remove(g); g = null; } // tronçon reconstruit (aiguillage)
        if (!g) { g = buildRuin(r); ruinMeshes.set(r.id, g); ruinsGroup.add(g); }
        placeGround(g, r.x, 0, r.zw, 0);
        // détecteur (amélioration « radar ») : les lanternes des points vides restent éteintes
        g.userData.lans.forEach((lan, j) => {
          const sp = r.spots[j], shown = !looted.has(r.id * 4 + j) && !(view.radar && !(sp.loot || sp.scrap));
          lan.visible = shown; if (shown) lan.scale.setScalar((0.6 + Math.sin(view.t * 4 + r.id + j) * 0.12) * (1 + nk * 0.5));
        });
        const cart = g.userData.cart;
        if (cart) {
          const st = view.carts && view.carts.get(r.res.id), p = st ? st.p : 0;
          cart.position.set(r.res.x0 - r.x + (r.res.x1 - r.res.x0) * p, 0, 0);
          cart.userData.heap.visible = !(st && st.d);
          cart.rotation.z = st && st.d ? 0.5 * Math.sign(r.res.x1) : 0;
        }
        const sn = g.userData.sniper;
        if (sn) { const s = view.snipers && view.snipers.find((q) => q.id === r.id); sn.visible = !!s && s.st !== 4 && s.st !== 3; if (s && s.st === 1) sn.rotation.y = Math.atan2(-1, 0); }
      }
    }
    prevCut = new Set(cut);
    for (const [id, g] of ruinMeshes) if (!live.has(id)) { ruinsGroup.remove(g); ruinMeshes.delete(id); }
    stepFalls(dt);

    // gares et ville d'arrivée, à leur place sur la ligne
    const want = new Map();
    for (const i of [view.ns - 1, view.ns]) {
      if (i < 0) continue;
      const sd = stationDist(view.mode, view.goal, i); if (sd == null) continue;
      if (dist - sd > -160 && dist - sd < 140) want.set('s' + i, [() => buildStation(i), sd]);
    }
    if (view.mode === 'expedition' && view.goal && dist - view.goal > -170) want.set('city', [() => buildCity(), view.goal]);
    for (const [key, [mk]] of want) if (!setpieces.has(key)) { const s = mk(); setpieces.set(key, s); scene.add(s.g); }
    for (const [key, s] of setpieces) { if (!want.has(key)) { scene.remove(s.g); setpieces.delete(key); } else placeGround(s.g, 0, 0, -want.get(key)[1], 0); }

    // aiguillages proches : levier, panneau, voie annexe et aperçu du paysage de l'autre côté
    const seenF = new Set();
    const L = legAt(view.mode, view.goal, dist);
    for (const l of [L, L + 1, L + 2]) for (const fk of forksOf(view.seed, view.mode, view.goal, l)) {
      if (fk.at < dist - 90 || fk.at > dist + 260) continue;
      const opts = forkOptions(view.seed, R, fk); if (!opts) continue;
      const key = fk.k + fk.L; seenF.add(key);
      let s = switches.get(key); if (!s) { s = buildSwitch(fk); switches.set(key, s); }
      const c = forkChoice(view.seed, R, fk), passed = dist + 19.4 >= fk.at;
      placeGround(s.g, fk.lx, 0, -fk.lD, Math.PI / 2 * Math.sign(fk.lx));
      s.armPiv.rotation.z += ((c ? -0.6 : 0.6) - s.armPiv.rotation.z) * Math.min(1, dt * 10);
      s.target.rotation.y += ((c ? Math.PI / 2 : 0) - s.target.rotation.y) * Math.min(1, dt * 8);
      s.halo.visible = !passed && view.fork && view.fork.at === fk.at; MAT.warn.opacity = 0.25 + 0.2 * Math.abs(Math.sin(view.t * 4));
      const labels = opts.map((o) => (fk.k === 'st' ? BIOMES[o]?.label : MOMENTS[o]?.label) || o);
      const sk = labels.join('|') + c;
      if (s.key !== sk) { s.key = sk; if (s.sm.map) s.sm.map.dispose(); s.sm.map = forkSignTex(labels, c, fk.k); owned.tex.add(s.sm.map); s.sm.needsUpdate = true; }
      B.ground((HALF_W + 3.3) * Math.sign(fk.lx || -1), -(fk.at - 4), O); s.sign.position.set(O.x, 3.3, O.z); s.sign.rotation.y = O.yaw;
      for (const lg of s.legs) { lg.position.set(O.x + Math.cos(O.yaw) * lg.userData.dx, 1.5, O.z - Math.sin(O.yaw) * lg.userData.dx); }
      // l'autre voie s'en va de l'autre côté ; un aperçu du paysage la borde
      const altAt = altPath(fk, c ? -1 : 1);
      const at0 = fk.at;
      drawTrackAlt(altAt, Math.max(0, dist - 130 - at0), 140);
      preview(opts[1 - c], altAt, fk, 1 - c);
      if (!passed) preview(opts[c], (u, lat, o) => B.at(at0 + u, lat, o), fk, c);
    }
    for (const [key, s] of switches) if (!seenF.has(key)) { scene.remove(s.g, s.sign, ...s.legs); switches.delete(key); }

    // tunnels du col : la montagne qu'ils percent (un dôme au-dessus de la voûte, un front percé de l'arche à chaque bout),
    // la voûte le long de la courbe, les portails ; quand le convoi est dessous, la montagne s'ouvre autour de lui
    let inTun = false;
    for (const l of [L - 1, L, L + 1]) for (const [t0, t1] of tunnelsOf(view.seed, view.mode, view.goal, R, l)) {
      if (t1 < dist - 120 || t0 > dist + 200) continue;
      if (dist + 24 > t0 && dist - 18 < t1) inTun = true;
      for (let d = t0 + 2.1; d < t1; d += 4.2) { B.at(d, 0, O); scatter.add('~tunnel', O.x, 0, O.z, O.yaw, 1); }
      B.at(t0, 0, O); scatter.add('~portal', O.x, 0, O.z, O.yaw + Math.PI, 1);
      B.at(t1, 0, O); scatter.add('~portal', O.x, 0, O.z, O.yaw, 1);
      ridgeStrip.cut(); ridgeRow(t0, true); ridgeRow(t0, false);
      for (let d = t0 + 3; d < t1 - 1; d += 3) ridgeRow(d, false);
      ridgeRow(t1, false); ridgeRow(t1, true); ridgeStrip.cut();
    }
    cutK += ((inTun ? 1 : 0) - cutK) * Math.min(1, dt * 3);
    CUT.r.value = cutK > 0.02 ? cutK * 17 : 0; CUT.p.value.set(focus.x + 4, 0, focus.z + 5.5);

    // pont de la gorge et convoi abandonné, à leur place sur la ligne
    const mi = view.mi ?? 1;
    let br = null, wk = null;
    for (const l of [mi - 1, mi, mi + 1]) {
      const m = momentOf(view.seed, view.mode, view.goal, R, l); if (!m) continue;
      if (m.k === 'bridge' && dist - m.d > -230 && dist - m.d - BRIDGE_LEN < 160) br = m;
      if (m.k === 'wreck' && Math.abs(dist - m.d) < 190) wk = m;
    }
    gorge.visible = !!br;
    if (br) placeGround(gorge, 0, 0, -(br.d + BRIDGE_LEN / 2), 0);
    if (wk && (!wreck || wreck.d !== wk.d)) { if (wreck) scene.remove(wreck.g); wreck = { d: wk.d, g: buildWreck() }; scene.add(wreck.g); }
    if (!wk && wreck) { scene.remove(wreck.g); wreck = null; }
    if (wreck) placeGround(wreck.g, 0, 0, -wreck.d, 0);

    // congère (rétrécit à mesure qu'on la déblaie) ou troupeau de rennes sur la voie
    const E = view.ev;
    if (E && E.k === 'drift' && !E.done) {
      driftG.visible = true; placeTrain(driftG, 0, 0, E.zw + dist, 0);
      driftG.scale.set(1, Math.max(0.12, 1 - (E.prog || 0) * 0.88), 1);
      lastDrift = E.zw + dist;
    } else {
      if (driftG.visible && lastDrift != null) burst(0, 0.5, lastDrift, 50, 7, 5);
      driftG.visible = false; lastDrift = null;
    }
    if (E && E.k === 'herd' && !E.done) {
      if (!herdBuilt) buildHerd();
      herdG.visible = true; placeTrain(herdG, 0, 0, E.zw + dist, 0);
      herdG.children.forEach((r, i) => { r.position.x = r.userData.x0 + Math.sin(view.t * 0.6 + i) * 0.4 + (E.prog || 0) * r.userData.x0 * 1.5; r.rotation.y = r.userData.r0 + Math.sin(view.t * 0.3 + i) * 0.4; });
    } else herdG.visible = false;
    // zone d'avalanche (clignote avant l'impact)
    if (E && E.k === 'aval' && E.t > 0 && !E.hit) {
      const w = 28 - (HALF_W + 1), z0 = BODY_FRONT - 8, z1 = REAR + 12;
      avalZone.visible = true; avalZone.scale.set(w, z1 - z0, 1);
      placeTrain(avalZone, E.side * (HALF_W + 1 + w / 2), 0.05, (z0 + z1) / 2, 0); avalZone.rotation.x = -Math.PI / 2; avalZone.rotation.z = 0;
      MAT.warn.opacity = 0.2 + 0.25 * Math.abs(Math.sin(view.t * 8));
    } else { avalZone.visible = false; }

    // fusées éclairantes
    const seenFl = new Set(); let li = 0;
    for (const fl of view.flares) {
      seenFl.add(fl.id);
      let m = flareMeshes.get(fl.id);
      if (!m) {
        m = new THREE.Group(); const stick = box(0.09, 0.5, 0.09, MAT.flare, false); stick.position.y = 0.3; stick.rotation.z = 0.3; m.add(stick);
        const ring = mesh(GEO.ring, flareRingMat, false, false); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(view.flareR || FLARE_R); ring.position.y = 0.06; m.add(ring);
        flareMeshes.set(fl.id, m); scene.add(m);
      }
      if (fl.m === 1) placeTrain(m, fl.x, DECK_Y, fl.z, 0, true); else placeGround(m, fl.x, 0, fl.z, 0);
      if (li < flareLights.length) { const l = flareLights[li++]; l.position.set(m.position.x, m.position.y + 1.2, m.position.z); l.intensity = (26 + Math.random() * 14) * Math.min(1, fl.t / 1.5); }
    }
    for (; li < flareLights.length; li++) flareLights[li].intensity = 0;
    for (const [id, m] of flareMeshes) if (!seenFl.has(id)) { scene.remove(m); flareMeshes.delete(id); }

    // caisses
    const seen = new Set();
    for (const c of view.crates) {
      seen.add(c.id);
      let m = crates.get(c.id);
      if (m && m.userData.t !== (c.t || 1)) { scene.remove(m); m = null; } // dégelée : elle change d'aspect
      if (!m) { m = makeCrate(c.t || 1); crates.set(c.id, m); scene.add(m); }
      if (c.m === 0) placeGround(m, c.x, c.y, c.z, (c.id * 0.7) % 3);
      else placeTrain(m, c.x, c.y, c.z, (c.id * 0.7) % 3, c.m === 1);
      if (c.m === 2) m.rotation.x += dt * 8;
      if (m.userData.shell) m.userData.shell.scale.setScalar(1.35 - (c.th || 0) * 0.3);
    }
    for (const [id, m] of crates) if (!seen.has(id)) { scene.remove(m); crates.delete(id); }

    // front de tempête
    const gap = view.gap ?? 999; stormNear = 0;
    stormG.visible = !view.calm && gap < 230;
    if (stormG.visible) {
      placeTrain(stormG, 0, 0, gap, 0);
      stormMats.forEach((m, i) => { m.map.offset.x = (view.t * (0.02 + i * 0.015) * (i % 2 ? -1 : 1)) % 1; });
      // le Front rugit : éclairs à répétition, ciel plus sombre
      const roar = view.mm && view.mm.k === 'roar' && view.mm.t < 40 ? 1 : 0;
      flashT -= dt; if (flashT <= 0) { flashT = roar ? 0.3 + Math.random() * 1.1 : 2 + Math.random() * 5; stormLight.intensity = 260; } stormLight.intensity *= Math.exp(-dt * 9);
      // plus il est proche, plus la lumière tombe et la neige s'épaissit
      const near = Math.max(0, Math.min(1, (70 - gap) / 60)); stormNear = near;
      scene.fog.color.lerp(fogS, near * 0.6 + roar * 0.3); scene.background.copy(scene.fog.color);
      scene.fog.far -= near * 14; snow.mat.size += near * 0.1;
      if (near > 0.5) shake = Math.max(shake, (near - 0.5) * 0.15);
    }
    // pannes à bord
    const seenFa = new Set();
    for (const fa of view.faults || []) {
      seenFa.add(fa.id);
      let g = faultMeshes.get(fa.id);
      if (!g) g = buildFault(fa), faultMeshes.set(fa.id, g);
      placeTrain(g, fa.x, DECK_Y, fa.z, 0, true);
      const k = 1 - (fa.prog || 0) * 0.85; g.userData.shrink.scale.setScalar(k);
      const pulse = 0.5 + 0.5 * Math.sin(view.t * 7);
      g.userData.ring.material.opacity = 0.3 + 0.5 * pulse; g.userData.bang.position.y = 1.5 + pulse * 0.2;
      if (g.userData.flick) g.userData.flick.children.forEach((c, i) => { c.scale.y = (0.7 + (i % 2) * 0.3) * (0.8 + 0.3 * Math.sin(view.t * 17 + i * 2)); });
      if (fa.k === 'leak' && Math.random() < 0.05) burst(fa.x, DECK_Y + 0.2, fa.z, 1, 0.3, 0.5);
    }
    for (const [id, g] of faultMeshes) if (!seenFa.has(id)) { scene.remove(g); faultMeshes.delete(id); }
    // pillards (et ceux qui ont sauté sur le pont)
    const seenR = new Set();
    for (const w of view.raiders || []) {
      seenR.add(w.id);
      let o = raiders.get(w.id);
      if (!o) { o = buildRaider(); raiders.set(w.id, o); }
      placeTrain(o.g, w.x, 0, w.z, Math.PI);
      o.crate.visible = w.carry > 0;
      o.cloth.rotation.y = Math.sin(view.t * 9 + w.id) * 0.3;
      const aboard = w.st === 5;
      o.rider.visible = !aboard; o.aboard.visible = aboard;
      if (aboard) { placeTrain(o.aboard, w.rx, DECK_Y, w.rz, Math.atan2(-w.side, 0), true); o.aboard.position.y = DECK_Y + Math.abs(Math.sin(view.t * 9)) * 0.05; }
      if (w.st === 3) { o.sled.rotation.z += (1.25 * w.side - o.sled.rotation.z) * Math.min(1, dt * 6); o.sled.position.y = 0.3; }
      else { o.sled.rotation.z = Math.sin(view.t * 6 + w.id) * 0.05; o.sled.position.y = Math.abs(Math.sin(view.t * 11 + w.id)) * 0.06; o.rider.rotation.y = w.st === 1 ? -w.side * 0.9 : 0; }
      if (w.st < 3 && Math.random() < 0.3) burst(w.x, 0.3, w.z + 1.4, 1, 0.6, 1);
    }
    for (const [id, o] of raiders) if (!seenR.has(id)) { scene.remove(o.g, o.aboard); raiders.delete(id); }

    // Brise-Glace et grappins
    const bv = view.boss;
    if (bv && !boss) { boss = buildBoss(); scene.add(boss.g); }
    if (!bv && boss) { scene.remove(boss.g); boss = null; }
    if (boss) {
      placeTrain(boss.g, bv.x, 0, bv.z, 0);
      boss.flag.rotation.y = Math.sin(view.t * 8) * 0.3;
      if (bv.st === 3) { boss.body.rotation.z += (0.5 * bv.side - boss.body.rotation.z) * Math.min(1, dt * 4); if (Math.random() < 0.3) burst(bv.x, 2.5, bv.z, 1, 1.5, 2); }
      else { boss.body.rotation.z = Math.sin(view.t * 5) * 0.02; boss.body.position.y = Math.abs(Math.sin(view.t * 9)) * 0.05; if (Math.random() < 0.4) burst(bv.x - bv.side * 0.4, 0.4, bv.z + 3.2, 1, 1, 1.2); }
    }
    const seenH = new Set();
    for (const h of view.hooks || []) {
      seenH.add(h.id);
      let o = hooksM.get(h.id);
      if (!o) { o = buildHook(); hooksM.set(h.id, o); burst(h.x, DECK_Y + 0.8, h.z, 6, 0.5, 2); }
      placeTrain(o.g, h.x, DECK_Y + 0.75, h.z, 0, true);
      o.g.rotation.z = Math.sin(view.t * 12 + h.id) * 0.08 * (1 - (h.prog || 0));
      if (boss) { const p0 = o.g.position; B.train(bv.x - bv.side * 0.2, bv.z + 0.6, O2); stretch(o.cable, O2.x, 2.9, O2.z, p0.x, p0.y, p0.z); }
      else o.cable.visible = false;
    }
    for (const [id, o] of hooksM) if (!seenH.has(id)) { scene.remove(o.g, o.cable); hooksM.delete(id); }

    // loups (positions du sol)
    const seenW = new Set();
    for (const w of view.wolves) {
      seenW.add(w.id);
      let o = wolves.get(w.id);
      if (!o) { o = actors.wolf(!!w.al); o.px = w.x; o.pz = w.zw; wolves.set(w.id, o); scene.add(o.g); }
      const sp = Math.hypot(w.x - o.px, w.zw - o.pz) / Math.max(dt, 1e-3);
      o.px = w.x; o.pz = w.zw; o.sp = (o.sp || 0) + (Math.min(7, sp) - (o.sp || 0)) * Math.min(1, dt * 8);
      placeGround(o.g, w.x, 0, w.zw, w.yaw);
      actors.poseWolf(o, w, view.t, dt, o.sp);
    }
    for (const [id, o] of wolves) if (!seenW.has(id)) { scene.remove(o.g); wolves.delete(id); }

    // joueurs
    const seenP = new Set(), pos = new Map();
    for (const p of view.players) {
      seenP.add(p.id);
      let o = players.get(p.id);
      if (o && (o.name !== p.name || o.color !== p.color)) { dropPlayer(p.id); o = null; }
      if (!o) { o = buildPlayer(p); players.set(p.id, o); }
      o.g.visible = p.st !== 3;
      placeTrain(o.g, p.x, p.y, p.z, p.st === 2 ? Math.PI : p.yaw, p.on || p.ref); // dos à la caméra sur l'échelle
      pos.set(p.id, o.g.position);
      actors.poseSurvivor(o, p, view.t, dt);
      for (let t = 1; t <= 5; t++) o.held[t].visible = p.carry === t;
      if (p.carry === 3) o.held[3].userData.shell.scale.setScalar(1.35 - (p.cth || 0) * 0.3);
      o.label.material.opacity = p.me ? 0.75 : 1;
    }
    for (const id of [...players.keys()]) if (!seenP.has(id)) dropPlayer(id);
    // survivants : ils suivent leur sauveteur, puis s'assoient à bord
    const seenS = new Set();
    for (const s of view.surv || []) {
      seenS.add(s.id);
      let o = survivors.get(s.id);
      if (!o) { o = actors.survivor('#8f969f'); scene.add(o.g); survivors.set(s.id, o); }
      placeTrain(o.g, s.x, s.y, s.z, s.ss === 2 ? Math.PI : s.yaw, s.on);
      actors.poseSurvivor(o, { ...s, seat: s.ss === 2, carry: 0 }, view.t, dt);
    }
    for (const [id, o] of survivors) if (!seenS.has(id)) { scene.remove(o.g); actors.drop(o); survivors.delete(id); }
    // tuyaux des cuves : jusqu'à celui qui le tient, ou branché sur le flanc du wagon-chaudière
    const seenHo = new Set();
    for (const t of view.tanks || []) {
      const res = tankRes(t.id); if (!res) continue;
      let to = null;
      if (t.lk) { B.deck(Math.sign(res.x) * (HALF_W + 0.1), 0.6, O2); to = [O2.x, 1.3, O2.z]; }
      else if (t.h >= 0 && pos.has(t.h)) { const q = pos.get(t.h); to = [q.x, q.y + 1.0, q.z]; }
      if (!to) continue;
      seenHo.add(t.id);
      let m = hoses.get(t.id); if (!m) { m = makeLine(hoseMat, 0.12); hoses.set(t.id, m); }
      B.ground(res.x, res.zw, O); stretch(m, O.x, 1.2, O.z, to[0], to[1], to[2]);
    }
    for (const [id, m] of hoses) if (!seenHo.has(id)) { scene.remove(m); hoses.delete(id); }
    // tireurs qui visent : un trait rouge jusqu'à leur cible
    const seenL = new Set();
    for (const s of view.snipers || []) {
      if (s.st !== 1 || !pos.has(s.tg)) continue;
      seenL.add(s.id);
      let m = lasers.get(s.id); if (!m) { m = makeLine(laserMat, 0.04); lasers.set(s.id, m); }
      const q = pos.get(s.tg); B.ground(s.x, s.zw, O); stretch(m, O.x, s.h + 0.85, O.z, q.x, q.y + 1.2, q.z);
      laserMat.opacity = 0.4 + 0.4 * Math.abs(Math.sin(view.t * 20));
    }
    for (const [id, m] of lasers) if (!seenL.has(id)) { scene.remove(m); lasers.delete(id); }
    // harpons qui filent
    for (let i = harpoons.length - 1; i >= 0; i--) { const h = harpoons[i]; h.t -= dt; if (h.t <= 0) { scene.remove(h.m); harpoons.splice(i, 1); } }

    scatter.end(); cliffStrip.end(); ravStrip.end(); ridgeStrip.end();
    if (post && (post.q.ao || post.q.bloom)) { post.grade(nk, stormNear, tunK); post.render(scene, camera, view.t); }
    else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
    adapt(dt);
  }

  // décor fixe d'un tronçon (monticules, poteaux, plaques de glace, aiguilles rocheuses), calculé une fois
  function decorOf(seed, k, c) {
    if (c.vis) return c.vis;
    const V = [], rr = makeRng(hash(seed * 31 + k)), clear = c.clear || [];
    const free = (zw) => !clear.some(([a, b]) => -zw > a - 4 && -zw < b + 4);
    for (let i = 0; i < 7; i++) {
      const side = rr.chance(0.5) ? -1 : 1, sx = rr.range(1, 4), sy = rr.range(0.25, 0.9), sz = rr.range(1, 3.5), ry = rr.range(0, 3), x = side * rr.range(3.5, 34), zw = -k * CHUNK - rr.range(0, CHUNK);
      if (!free(zw)) continue;
      if (c.bio === 'lac') V.push({ m: '~slab', x, zw, y: 0.01, r: ry, sx, sy: 1, sz });
      else V.push({ m: '~mound', x, zw, y: -0.05, r: ry, sx, sy, sz });
    }
    if (c.bio === 'col') for (let i = 0; i < 3; i++) {
      const x = (c.cs || 1) * rr.range(28, 44), zw = -k * CHUNK - rr.range(0, CHUNK), h = rr.range(4, 9);
      if (free(zw)) V.push({ m: '~spire', x, zw, y: -0.2, r: rr.range(0, 3), sx: rr.range(2, 3.5), sy: h, sz: rr.range(2, 3.5) });
    }
    if (rr.chance(0.5) && c.bio !== 'ville' && c.bio !== 'lac') { const zw = -k * CHUNK - rr.range(0, CHUNK); if (free(zw)) V.push({ m: '~pole', x: (rr.chance(0.5) ? -1 : 1) * 4.2, zw, y: 0, r: 0, sx: 1, sy: 1, sz: 1 }); }
    if (c.bio === 'toundra') for (let i = 0; i < 22; i++) {
      const x = (rr.chance(0.5) ? -1 : 1) * rr.range(3.2, 26), zw = -k * CHUNK - rr.range(0, CHUNK), s = rr.range(1.6, 4.5);
      if (free(zw)) V.push({ m: '~moss', x, zw, y: 0.02, r: rr.range(0, 6.28), sx: s, sy: 1, sz: s * rr.range(0.5, 0.9) });
    }
    if (c.bio === 'col') for (let i = 0; i < 5; i++) {
      const x = (rr.chance(0.5) ? -1 : 1) * rr.range(3.4, 13), zw = -k * CHUNK - rr.range(0, CHUNK), s = rr.range(0.6, 1.5);
      if (free(zw)) V.push({ m: '~scree', x, zw, y: -0.05, r: rr.range(0, 6.28), sx: s, sy: s, sz: s });
    }
    c.vis = V;
    return V;
  }
  // hauteur de la falaise : elle s'efface en approchant d'une gare ou d'un aiguillage (pas d'un tunnel, qui la traverse)
  function cliffK(d, clear) {
    let k = 1;
    for (const [a, b, t] of clear || []) { if (t) continue; const out = d < a ? a - d : d > b ? d - b : 0; k = Math.min(k, Math.max(0, Math.min(1, (out - 10) / 10))); }
    return k;
  }
  // la falaise d'un tronçon : une paroi de roche d'un seul tenant, un plateau enneigé, quelques sapins au sommet
  function drawCliff(q, c) {
    const cs = Math.sign(q.x) || 1, d0 = -(q.zw + CHUNK / 2);
    cliffStrip.cut();
    for (let i = 0; i <= CHUNK / 3; i++) {
      const d = d0 + i * 3, k = cliffK(d, c.clear);
      for (let j = 0; j < CLIFF.length; j++) {
        const [u, y] = CLIFF[j], n = j > 0 && j < CLIFF.length - 1 ? vnoise(d * 0.16, j) : 0;
        PX[j] = cs * (15 + u + n * (j < 5 ? 0.7 : 2.5)); PY[j] = -0.4 + (y + 0.4 + n * 1.3) * k;
        if (j < 3) PC[j].copy(ROCK_A).lerp(ROCK_B, 0.5 + 0.5 * vnoise(d * 0.3, j + 20));
        else if (j === 3) PC[j].copy(ROCK_B).lerp(SNOW_C, vnoise(d * 0.25, 33) > 0.25 ? 0.65 : 0.12);
        else PC[j].copy(SNOW_C);
      }
      cliffStrip.row(d, PX, PY, PC);
      const h = hash(Math.round(d) * 31 + 7);
      if (k > 0.95 && i < CHUNK / 3 && h % 3 === 0) {
        const t = (h % 97) / 97, u = Math.abs(PX[5]) + (Math.abs(PX[6]) - Math.abs(PX[5])) * t, y = PY[5] + (PY[6] - PY[5]) * t;
        B.at(d + 1.5, cs * u, O); { const sc = 2.6 + (h % 5) * 0.3; put(h % 2 ? 'holiday/tree-snow-a' : 'nature/tree_pineTallD', O.x, y - 0.3, O.z, h % 6.28, sc, sc, sc, h, true); }
      }
    }
    cliffStrip.cut();
  }
  // le ravin : la lèvre de neige et de roche, puis le vide qui s'assombrit
  function drawRavine(q) {
    const sr = Math.sign(q.x) || 1, d0 = -(q.zw + CHUNK / 2), x0 = Math.abs(q.x);
    ravStrip.cut();
    for (let i = 0; i <= CHUNK / 3; i++) {
      const d = d0 + i * 3;
      for (let j = 0; j < RAV.length; j++) {
        const [u, y] = RAV[j], n = vnoise(d * 0.2, j + 40);
        PX[j] = sr * (x0 + u + (j < 4 ? n * 0.6 : 0)); PY[j] = y + (j === 1 || j === 2 ? n * 0.25 : 0); PC[j].copy(RAV_C[j]);
      }
      ravStrip.row(d, PX, PY, PC);
    }
    ravStrip.cut();
  }
  // une rangée de la montagne d'un tunnel ; front : le mur percé de l'arche (portail)
  function ridgeRow(d, front) {
    for (let j = 0; j < RIDGE_X.length; j++) {
      const x = RIDGE_X[j], e = Math.abs(x) / 15;
      if (front) { PX[j] = x; PY[j] = Math.abs(x) < 4.9 ? Math.sqrt(4.9 * 4.9 - x * x) : -0.3; PC[j].copy(ROCK_A); continue; }
      const n = vnoise(d * 0.12, j + 60) * (1 - e), h = 11.5 * Math.pow(Math.max(0, 1 - e * e), 0.7) + n * 1.4;
      PX[j] = x + (Math.abs(x) > 6 ? n * 0.8 : 0); PY[j] = Math.max(-0.3, h);
      if (h > 8.4) PC[j].copy(SNOW_C); else PC[j].copy(ROCK_A).lerp(ROCK_B, 0.5 + 0.5 * vnoise(d * 0.3, j + 80));
    }
    ridgeStrip.row(d, PX, PY, PC);
  }
  // entrées spéciales du décor (falaise, ravin, pipeline, lampadaires, troupeau, trous de pêche, ligne télégraphique)
  function drawSpecial(q, c, view) {
    if (q.m === '~cliff') drawCliff(q, c);
    else if (q.m === '~ravine') drawRavine(q);
    else if (q.m === '~hole') { B.ground(q.x, q.zw, O); scatter.add('~hole', O.x, 0, O.z, O.yaw, q.s); }
    else if (q.m === '~tele') {
      // un poteau tous les 24 m (en distance absolue : la ligne court d'un tronçon à l'autre), deux fils jusqu'au suivant
      const d0 = -(q.zw + CHUNK / 2), clear = c.clear || [], free = (d) => !clear.some(([a, b]) => d > a - 4 && d < b + 4);
      for (let d = Math.ceil(d0 / 24) * 24; d < d0 + CHUNK; d += 24) {
        if (!free(d)) continue;
        B.at(d, q.x, O); scatter.add('~tpole', O.x, 0, O.z, O.yaw, 1);
        if (!free(d + 24)) continue;
        B.at(d + 24, q.x, O2); const dx = O2.x - O.x, dz = O2.z - O.z;
        scatter.add('~wire', (O.x + O2.x) / 2, 4.95, (O.z + O2.z) / 2, Math.atan2(dx, dz), 1, 1, Math.hypot(dx, dz));
      }
    } else if (q.m === '~pipe') {
      for (let z = 0; z < CHUNK; z += 6) { const zw = q.zw + CHUNK / 2 - z - 3; B.ground(q.x, zw, O); scatter.add('~pipe', O.x, 0, O.z, O.yaw, 1); }
    } else if (q.m === '~lamp') {
      B.ground(q.x, q.zw, O); scatter.add('~lamp', O.x, 0, O.z, O.yaw + (q.x > 0 ? Math.PI : 0), 1);
    } else if (q.m === '~herd') {
      const rr = makeRng(hash(c.ruins.length * 7 + Math.round(q.zw)));
      for (let i = 0; i < q.s; i++) {
        const dx = rr.range(-5, 5), dz = rr.range(-5, 5), r0 = rr.range(0, 6.28);
        B.ground(q.x + dx, q.zw + dz, O);
        put('holiday/reindeer', O.x, Math.abs(Math.sin(view.t * 1.5 + i)) * 0.04, O.z, r0 + Math.sin(view.t * 0.2 + i) * 0.5 + O.yaw, 1.7);
      }
    }
  }
  // aperçu d'un paysage au bord d'une voie qui part de l'aiguillage
  function preview(bio, at, fk, side) {
    const items = PREVIEW[bio]; if (!items) return;
    const rr = makeRng(hash(lastSeed * 13 + fk.at * 7 + side));
    for (let i = 0; i < 12; i++) {
      const u = 26 + i * 9 + rr.range(-2, 2), lat = (rr.chance(0.5) ? -1 : 1) * rr.range(5.5, 13), [m, s] = items[i % items.length];
      at(u, lat, O);
      if (m === '~mound') scatter.add('~mound', O.x, -0.05, O.z, O.yaw, s * 2, s * 0.5, s * 1.5);
      else if (m === '~slab') scatter.add('~slab', O.x, 0.01, O.z, O.yaw, s * 2, 1, s * 2);
      else if (m === '~moss') scatter.add('~moss', O.x, 0.02, O.z, O.yaw + i, s, 1, s * 0.7);
      else { const sc = m.includes('tree') ? rr.range(4.5, 7) / 1.95 : s; put(m, O.x, 0, O.z, O.yaw + rr.range(0, 6.28) * (m.includes('building') ? 0 : 1) + (m.includes('building') ? (lat > 0 ? -Math.PI / 2 : Math.PI / 2) : 0), sc, sc, sc, i + fk.at, false); }
    }
  }
  function drawTrackAlt(at, u0, u1) {
    for (let u = Math.max(2, u0); u < u1; u += 1.2) { at(u, 0, O); scatter.add('sleeper', O.x, 0.15, O.z, O.yaw, 1); }
    for (let u = Math.max(2, u0); u < u1; u += 1.25) { at(u, 0, O); scatter.add('ballast', O.x, 0.06, O.z, O.yaw, 1); for (const sx of [-0.75, 0.75]) { at(u, sx, O); scatter.add('rail', O.x, 0.26, O.z, O.yaw, 1); } }
  }
  function buildHerd() {
    herdG.clear(); herdBuilt = !!kit;
    for (let i = 0; i < 9; i++) {
      const r = kit ? kit.make('holiday/reindeer', 0, 0, 0, { s: 1.8 }) : (() => { const g = new THREE.Group(); const b = box(0.5, 0.8, 1.1, MAT.wood); b.position.y = 0.9; g.add(b); return g; })();
      r.userData.x0 = (i - 4) * 1.2 + Math.sin(i * 7) * 0.5; r.userData.r0 = i * 1.3; r.position.set(r.userData.x0, 0, (i % 3 - 1) * 1.5); herdG.add(r);
    }
  }
  // un arbre abattu tombe vers l'extérieur, puis disparaît (la souche reste, les bûches attendent au sol)
  function startFall(t) {
    let m = null;
    if (PINE_MODELS.has(t.m)) { m = pines.mesh(Math.abs(t.id) % 3); m.scale.setScalar(pineScale(t.m, t.s)); }
    else m = kit ? kit.make(t.m, 0, 0, 0, { s: t.s }) : null;
    if (!m) return;
    const piv = new THREE.Group(); piv.add(m); scene.add(piv);
    falls.push({ piv, t: 0, x: t.x, zw: t.zw, r: t.r, s: Math.sign(t.x) || 1 });
  }
  function stepFalls(dt) {
    for (let i = falls.length - 1; i >= 0; i--) {
      const f = falls[i]; f.t += dt;
      const a = Math.min(1, (f.t / 1.4) ** 2) * Math.PI / 2;
      B.ground(f.x, f.zw, O); f.piv.position.set(O.x, 0, O.z); f.piv.rotation.set(0, O.yaw, -a * f.s);
      if (f.t > 1.4 && f.t - dt <= 1.4) burst(f.x + f.s * 3, 0.4, f.zw + B.d0, 24, 4, 3); // l'arbre touche le sol
      if (f.t > 3) { scene.remove(f.piv); falls.splice(i, 1); }
    }
  }
  function tankRes(id) {
    for (const [, c] of ruins.around(B.d0, 60, 60)) for (const r of c.ruins) if (r.res && r.res.k === 'tank' && r.res.id === id) return r.res;
    return null;
  }
  function dropPlayer(id) {
    const o = players.get(id); if (!o) return;
    scene.remove(o.g); actors.drop(o); players.delete(id);
  }
  // un harpon tiré depuis la tourelle (repère du train)
  function harpoon(x0, z0, x1, z1) {
    B.deck(x0, z0, O); B.train(x1, z1, O2);
    const m = makeLine(harpoonMat, 0.06); stretch(m, O.x, DECK_Y + 1.4, O.z, O2.x, 1.2, O2.z); harpoons.push({ m, t: 0.35 });
  }

  // position écran d'un point du repère du train (marqueurs du HUD)
  function toScreen(x, y, z, onDeck = false) {
    (onDeck ? B.deck : B.train)(x, z, O);
    v3.set(O.x, y, O.z).project(camera);
    return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, front: v3.z < 1 };
  }
  // position écran d'un point du sol (repère du sol)
  function groundToScreen(x, y, zw) { B.ground(x, zw, O); v3.set(O.x, y, O.z).project(camera); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, front: v3.z < 1 }; }

  // remise à zéro entre deux parties (nouvelle graine) : on garde la scène, on vide le décor et les entités
  function reset() {
    for (const g of ruinMeshes.values()) ruinsGroup.remove(g); ruinMeshes.clear();
    for (const s of setpieces.values()) scene.remove(s.g); setpieces.clear();
    for (const m of crates.values()) scene.remove(m); crates.clear();
    for (const o of wolves.values()) scene.remove(o.g); wolves.clear();
    for (const m of flareMeshes.values()) scene.remove(m); flareMeshes.clear();
    for (const o of raiders.values()) scene.remove(o.g, o.aboard); raiders.clear();
    for (const g of faultMeshes.values()) scene.remove(g); faultMeshes.clear();
    for (const o of hooksM.values()) scene.remove(o.g, o.cable); hooksM.clear();
    for (const s of switches.values()) scene.remove(s.g, s.sign, ...s.legs); switches.clear();
    for (const m of [...hoses.values(), ...lasers.values()]) scene.remove(m); hoses.clear(); lasers.clear();
    for (const o of survivors.values()) { scene.remove(o.g); actors.drop(o); } survivors.clear();
    for (const f of falls) scene.remove(f.piv); falls.length = 0;
    if (boss) { scene.remove(boss.g); boss = null; }
    if (wreck) { scene.remove(wreck.g); wreck = null; }
    gorge.visible = false; prevCut = new Set();
    for (const id of [...players.keys()]) dropPlayer(id);
    driftG.visible = false; lastDrift = null; camInit = false;
  }

  // qualité : si les images traînent (plus de 26 ms en moyenne pendant 3 s), on coupe l'occlusion, puis le halo, puis la définition
  function adapt(dt) {
    if (!(dt > 0) || dt > 0.25) return;
    perf.ema += (dt * 1000 - perf.ema) * 0.05;
    perf.slow = perf.ema > 26 ? perf.slow + dt : Math.max(0, perf.slow - dt * 0.5);
    if (perf.slow < 3 || perf.step > 2) return;
    perf.slow = 0; perf.step++;
    if (perf.step === 1 && post) post.q.ao = false;
    else if (perf.step === 2 && post) post.q.bloom = false;
    else { renderer.setPixelRatio(1); resize(); }
  }

  function dispose() {
    if (disposed) return; disposed = true;
    post && post.dispose(); pines.dispose();
    ro.disconnect();
    canvas.removeEventListener('webglcontextlost', onCtxLost);
    for (const id of [...players.keys()]) dropPlayer(id);
    for (const o of survivors.values()) actors.drop(o);
    scatter.dispose();
    for (const g of owned.geo) g.dispose();
    for (const m of owned.mat) { m.map && !owned.tex.has(m.map) && m.map.dispose(); m.dispose(); }
    for (const t of owned.tex) t.dispose();
    actors.dispose(); kit && kit.dispose();
    sun.shadow.map?.dispose(); beam.shadow?.map?.dispose();
    scene.clear();
    renderer.dispose(); renderer.forceContextLoss();
    canvas.remove();
  }

  return { frame, resize, toScreen, groundToScreen, reset, dispose, kick: (s = 0.35) => { shake = Math.max(shake, s); }, burst, harpoon, steam: () => { steamT = 0.6; }, canvas, _dbg: { scene, camera, renderer, post, perf, get B() { return B; } } };
}
