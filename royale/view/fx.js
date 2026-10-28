// Les effets : traînées de balles, éclairs de bouche, impacts (poussière, étincelles), explosions (boule de feu,
// fumée, éclair de lumière), roquettes et grenades en vol, et le mur violet de la tempête. Fumée des cheminées et
// poussière (atterrissage, course, casse) : des particules douces toutes dessinées d'un coup, prises dans le
// brouillard. Débris (casse, explosions, coups de pelle) et douilles éjectées : de petits éclats qui tombent,
// rebondissent et s'éteignent.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';

function spriteTex(draw, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const radial = (stops) => spriteTex((g, S) => {
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [o, c] of stops) grd.addColorStop(o, c);
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
});

// panneaux toujours face à la caméra, tous dessinés d'un coup (pris dans le brouillard) : set(i, x, y, z, taille,
// r, g, b, a) puis count(n) à chaque image. additive : lueurs (halos, étincelles) ; sinon fumée, poussière
export function createBillboards(cap, tex, { additive = false } = {}) {
  const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
  const aP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), aC = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  aP.setUsage(THREE.DynamicDrawUsage); aC.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aP', aP); geo.setAttribute('aC', aC); geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]),
    vertexShader: `attribute vec4 aP; attribute vec4 aC; varying vec2 vUv; varying vec4 vC;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv; vC = aC;
        vec4 mvPosition = modelViewMatrix * vec4(aP.xyz, 1.0);
        mvPosition.xy += position.xy * aP.w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying vec4 vC;
      #include <fog_pars_fragment>
      void main() {
        vec4 t = texture2D(map, vUv);
        gl_FragColor = vec4(vC.rgb * t.rgb, t.a * vC.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.map.value = tex;
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  return {
    mesh,
    set(i, x, y, z, size, r, g, b, a) { aP.setXYZW(i, x, y, z, size); aC.setXYZW(i, r, g, b, a); },
    count(n) { geo.instanceCount = n; aP.needsUpdate = true; aC.needsUpdate = true; },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

// floor(x, z, y) : hauteur du sol (ou de la dalle) sous un point ; chimneys : sommets des cheminées [{ x, y, z }]
export function createFx(scene, { floor = null, chimneys = [] } = {}) {
  const group = new THREE.Group(); scene.add(group);
  const own = [];
  const T = {
    glow: radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,230,160,.9)'], [1, 'rgba(255,160,40,0)']]),
    puff: radial([[0, 'rgba(255,255,255,.9)'], [0.6, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]),
    // flamme : quelques taches chaudes serrées, au bord irrégulier (teintée par la couleur du sprite)
    fire: spriteTex((g, S) => {
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * S * 0.17, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, r = S * (0.16 + Math.random() * 0.16);
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(255,255,255,0.85)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, S, S);
      }
    }, 128),
  };
  own.push(...Object.values(T));
  // ------------------------------------------------------------------ traînées : bâtonnets lumineux étirés
  const N = 96;
  const trGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 5, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const trMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracers = new THREE.InstancedMesh(trGeo, trMat, N); tracers.frustumCulled = false; tracers.count = N;
  own.push(trGeo, trMat); group.add(tracers);
  const trList = Array.from({ length: N }, () => ({ life: 0, max: 0.1, from: new THREE.Vector3(), to: new THREE.Vector3(), color: new THREE.Color() }));
  let trNext = 0;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  // couleur par instance créée d'emblée (le shader la prévoit dès la première image)
  for (let i = 0; i < N; i++) { tracers.setMatrixAt(i, zero); tracers.setColorAt(i, new THREE.Color(0)); }
  // ------------------------------------------------------------------ sprites (éclairs, impacts, explosions, fumée)
  const pool = [];
  function sprite(tex, color, blending) {
    let s = pool.find((p) => !p.on && p.tex === tex && p.blend === blending);
    if (!s) {
      const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending });
      const o = new THREE.Sprite(m); group.add(o);
      s = { o, m, tex, blend: blending, on: false };
      pool.push(s); own.push(m);
    }
    s.on = true; s.o.visible = true; s.m.color.set(color); s.m.rotation = 0;
    return s;
  }
  const live = [];
  // effets différés de quelques dixièmes de seconde
  const timers = [];
  const later = (sec, fn) => timers.push({ t: sec, fn });
  // (vx, vy, vz : vitesse de départ, freinée par drag ; g : pesanteur ; rot : rotation de l'image)
  function puff(x, y, z, { tex = T.puff, color = 0xffffff, size = 0.5, grow = 2, life = 0.5, add = false, rise = 0, op = 0.8, vx = 0, vy = 0, vz = 0, drag = 0, g = 0, rot = 0 } = {}) {
    const s = sprite(tex, color, add ? THREE.AdditiveBlending : THREE.NormalBlending);
    s.o.position.set(x, y, z); s.o.scale.setScalar(size); s.m.rotation = rot;
    live.push({ s, t: 0, life, size, grow, rise, op, vx, vy, vz, drag, g });
  }
  // ------------------------------------------------------------------ particules douces (fumée, poussière) : un seul dessin
  const CN = 480;
  const soft = createBillboards(CN, T.puff);
  soft.mesh.renderOrder = 2; group.add(soft.mesh); own.push(soft);
  const cl = [];
  const tint = new THREE.Color();
  // une bouffée : position, vitesse, taille de départ et grossissement, durée, couleur, opacité
  function cloud(x, y, z, { vx = 0, vy = 0, vz = 0, size = 0.6, grow = 1.5, life = 1, color = 0xbfb6a4, op = 0.5, drag = 1.5 } = {}) {
    if (cl.length >= CN) cl.shift();
    tint.setHex(color);
    cl.push({ x, y, z, vx, vy, vz, size, grow, life, t: 0, r: tint.r, g: tint.g, b: tint.b, op, drag });
  }
  // poussière soulevée au sol : n bouffées en couronne
  function dust(x, y, z, { n = 6, r = 0.5, color = 0xb9ad94, size = 0.5, op = 0.45, speed = 1.6 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, k = speed * (0.6 + Math.random() * 0.6);
      cloud(x + Math.cos(a) * r, y + 0.15, z + Math.sin(a) * r, { vx: Math.cos(a) * k, vy: 0.35 + Math.random() * 0.4, vz: Math.sin(a) * k, size, grow: 1.6, life: 0.9 + Math.random() * 0.5, color, op });
    }
  }
  // ------------------------------------------------------------------ éclats : débris et douilles, qui tombent et rebondissent
  const KN = 220;
  const kGeo = new THREE.BoxGeometry(1, 1, 1), kMat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.1 });
  const chips = new THREE.InstancedMesh(kGeo, kMat, KN); chips.frustumCulled = false; chips.castShadow = false;
  for (let i = 0; i < KN; i++) { chips.setMatrixAt(i, zero); chips.setColorAt(i, new THREE.Color(1, 1, 1)); }
  group.add(chips); own.push(kGeo, kMat);
  const ks = []; let kNext = 0;
  const kq = new THREE.Quaternion(), ke = new THREE.Euler(), km = new THREE.Matrix4(), kp = new THREE.Vector3(), kz = new THREE.Vector3();
  function chip(x, y, z, { vx = 0, vy = 3, vz = 0, sx = 0.12, sy = 0.08, sz = 0.1, color = 0x8a7a68, life = 2.2, metal = false } = {}) {
    const i = kNext; kNext = (kNext + 1) % KN;
    const f = floor ? floor(x, z, y + 0.3) : y - 1;
    ks[i] = { x, y, z, vx, vy, vz, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, wx: (Math.random() - 0.5) * 14, wy: (Math.random() - 0.5) * 14, wz: (Math.random() - 0.5) * 14,
      sx, sy, sz, life, t: 0, f: Number.isFinite(f) ? f : y - 1, metal };
    chips.setColorAt(i, tint.setHex(color)); chips.instanceColor.needsUpdate = true;
  }
  const CHIP_COLORS = { bois: [0x9a6a3a, 0x7a5230, 0xb88a56], pierre: [0x8a857c, 0x6f6a62, 0xa9a49a], metal: [0xaab2b8, 0x80888e, 0xc8ccd0], terre: [0x6b5a44, 0x5a4a38, 0x7d6a52] };
  // débris d'une casse : morceaux de la matière, projetés autour du point
  function debris(x, y, z, mat, { n = 12, spread = 1.2, power = 4 } = {}) {
    const cols = CHIP_COLORS[mat] || CHIP_COLORS.pierre;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, k = power * (0.4 + Math.random() * 0.8), s = 0.06 + Math.random() * 0.16;
      chip(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread,
        { vx: Math.cos(a) * k, vy: 1.5 + Math.random() * power, vz: Math.sin(a) * k, sx: s, sy: s * (0.5 + Math.random() * 0.6), sz: s * (0.6 + Math.random() * 0.8), color: cols[i % cols.length], life: 1.6 + Math.random() * 1.2 });
    }
  }
  // douille éjectée à droite de l'arme (cartouche rouge pour le fusil à pompe)
  function casing(p, yaw, w) {
    if (w === 'roquette') return;
    const rx = -Math.cos(yaw), rz = Math.sin(yaw), k = 1.6 + Math.random() * 0.8;
    const shell = w === 'pompe';
    chip(p.x + rx * 0.12, p.y + 0.06, p.z + rz * 0.12, { vx: rx * k + Math.sin(yaw) * 0.3, vy: 2.2 + Math.random(), vz: rz * k + Math.cos(yaw) * 0.3,
      sx: shell ? 0.03 : 0.018, sy: shell ? 0.03 : 0.018, sz: shell ? 0.07 : 0.045, color: shell ? 0xc8322a : 0xd8a943, life: 1.4, metal: true });
  }
  // ------------------------------------------------------------------ fumée des cheminées (une sur deux fume)
  const smokers = chimneys.filter((c, i) => ((i * 2654435761) >>> 0) % 2 === 0).map((c) => ({ ...c, next: Math.random() }));
  const runDust = new Map();

  // lumière partagée des explosions
  const flash = new THREE.PointLight(0xffa040, 0, 30, 1.6); group.add(flash);
  let flashT = 0, flashMax = 0.25, flashI = 90;
  // ------------------------------------------------------------------ projectiles en vol
  // roquette : corps olive, ogive rouge sombre à pointe grise, ailettes en croix, tuyère ; une flamme et un halo derrière
  const rocketGeo = (() => {
    const parts = [];
    const put = (geo, hex) => {
      const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
      if (g !== geo) geo.dispose();
      for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); parts.push(g);
    };
    const along = (geo, z) => geo.rotateX(Math.PI / 2).translate(0, 0, z);
    put(along(new THREE.CylinderGeometry(0.058, 0.058, 0.5, 14), 0), 0x58683c);
    put(along(new THREE.CylinderGeometry(0.061, 0.061, 0.04, 14), 0.2), 0xd8b23a);
    put(along(new THREE.CylinderGeometry(0.02, 0.07, 0.22, 14), 0.36), 0x7a3326);
    put(along(new THREE.SphereGeometry(0.021, 8, 6), 0.47), 0x9aa0a6);
    put(along(new THREE.CylinderGeometry(0.045, 0.036, 0.07, 12), -0.28), 0x2c2f30);
    put(new THREE.BoxGeometry(0.26, 0.008, 0.13).translate(0, 0, -0.2), 0x3a4228);
    put(new THREE.BoxGeometry(0.008, 0.26, 0.13).translate(0, 0, -0.2), 0x3a4228);
    const g = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    return g;
  })();
  const rocketMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 });
  const flameGeo = new THREE.ConeGeometry(0.06, 0.6, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.6);
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.5), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  own.push(flameGeo, flameMat);
  const launches = new Map(); // tireur → bouche du tube au moment du tir (la roquette en part, puis rejoint sa trajectoire)
  const nadeGeo = new THREE.SphereGeometry(0.09, 10, 8), nadeMat = new THREE.MeshStandardMaterial({ color: 0x4f6a3a }), blastMat = new THREE.MeshStandardMaterial({ color: 0x9b59d0, emissive: 0x3a1a6a });
  // balle du fusil de précision : un trait lumineux de 4 m dans l'axe de son vol
  const bulletGeo = new THREE.CylinderGeometry(0.025, 0.012, 4, 5).rotateX(Math.PI / 2).translate(0, 0, -2);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  own.push(rocketGeo, rocketMat, nadeGeo, nadeMat, blastMat, bulletGeo, bulletMat);
  const projMeshes = new Map();
  // ------------------------------------------------------------------ tempête : un grand cylindre violet translucide
  const stormMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uT;
      void main(){
        float a = atan(vW.z, vW.x);
        float s = sin(a * 60.0 + uT * 1.5 + vW.y * 0.05) * 0.5 + 0.5;
        float s2 = sin(a * 23.0 - uT * 0.8 + vW.y * 0.11) * 0.5 + 0.5;
        float fade = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
        vec3 c = mix(vec3(0.42, 0.16, 0.78), vec3(0.75, 0.45, 1.0), s * s2);
        gl_FragColor = vec4(c, (0.28 + 0.22 * s) * fade);
      }`,
  });
  const storm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128, 1, true).translate(0, 0.5, 0), stormMat);
  storm.frustumCulled = false; storm.visible = false; storm.renderOrder = 5; group.add(storm);
  own.push(storm.geometry, stormMat);

  // ------------------------------------------------------------------ réactions aux événements de la partie
  const TRACER_COLORS = { fusil: 0xffe08a, smg: 0xffd070, pistolet: 0xfff0b0, pompe: 0xffb060, sniper: 0xbfe0ff };
  // late : la balle (fusil de précision) a déjà été dessinée en vol, on ne montre que l'impact
  function shot(from, to, w, hit, muzzle, late = false) {
    if (late) { impact(to, hit); return; }
    const tr = trList[trNext]; trNext = (trNext + 1) % N;
    tr.from.set(from[0], from[1], from[2]); tr.to.set(to[0], to[1], to[2]);
    // la traînée part de la bouche de l'arme si on la connaît
    if (muzzle) tr.from.copy(muzzle);
    tr.life = tr.max = w === 'sniper' ? 0.35 : 0.09; tr.color.setHex(TRACER_COLORS[w] || 0xffffff);
    impact(to, hit);
  }
  function impact(to, hit) {
    if (hit === 1) {
      puff(to[0], to[1], to[2], { color: 0xc8bfa8, size: 0.25, grow: 2.5, life: 0.45, op: 0.7 });
      puff(to[0], to[1], to[2], { tex: T.glow, color: 0xffd080, size: 0.25, grow: 0.5, life: 0.08, add: true });
    } else if (hit === 2) puff(to[0], to[1], to[2], { tex: T.glow, color: 0xfff4e0, size: 0.3, grow: 1.4, life: 0.1, add: true });
  }
  // flamme de bouche : plus grosse pour le fusil à pompe et le fusil de précision, et un éclair de lumière
  const MUZZLE = { pompe: 1.1, sniper: 1, fusil: 0.75, smg: 0.6, pistolet: 0.55, roquette: 1.2 };
  function muzzleFlash(p, w = 'fusil') {
    const k = MUZZLE[w] || 0.7;
    puff(p.x, p.y, p.z, { tex: T.glow, color: 0xffd890, size: 0.55 * k, grow: 0.9, life: 0.06, add: true });
    puff(p.x, p.y, p.z, { tex: T.glow, color: 0xfff6d8, size: 0.25 * k, grow: 0.5, life: 0.035, add: true, op: 1 });
    if (flashT <= 0.05) { flash.position.set(p.x, p.y, p.z); flashI = 7 * k; flashMax = flashT = 0.06; }
  }
  // éclats à l'impact sur un joueur, sans sang : bleus sur le bouclier, blancs sur la vie, jaunes à la tête
  const HIT_COL = { bouclier: [0x5ad1ff, 0xc4f1ff, 0x2f8fe0], vie: [0xffffff, 0xffeede, 0xd9d9d9], tete: [0xffd23f, 0xfff2a8, 0xffffff] };
  function hitSpark(x, y, z, kind = 'vie', n = 8) {
    const cols = HIT_COL[kind] || HIT_COL.vie;
    puff(x, y, z, { tex: T.glow, color: cols[0], size: 0.45, grow: 1.6, life: 0.16, add: true, op: 1 });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, k = 1.8 + Math.random() * 3, sz = 0.025 + Math.random() * 0.04;
      chip(x, y, z, { vx: Math.cos(a) * k, vy: 0.8 + Math.random() * 3, vz: Math.sin(a) * k, sx: sz, sy: sz, sz, color: cols[i % cols.length], life: 0.45 + Math.random() * 0.35, metal: kind === 'bouclier' });
    }
  }
  // départ d'une roquette : flamme à la bouche, souffle et fumée qui jaillissent derrière le tube (front, back : bouche
  // et arrière du tube, dir : sens du tir)
  function launch(owner, front, back, dir) {
    launches.set(owner, { p: front.clone(), age: 0 });
    puff(front.x, front.y, front.z, { tex: T.glow, color: 0xffc070, size: 0.9, grow: 1.4, life: 0.09, add: true, op: 1 });
    puff(back.x, back.y, back.z, { tex: T.glow, color: 0xff9a40, size: 1.1, grow: 1.8, life: 0.14, add: true, op: 1 });
    for (let i = 0; i < 10; i++) {
      const k = 3 + Math.random() * 6;
      cloud(back.x, back.y, back.z, { vx: -dir.x * k + (Math.random() - 0.5) * 2, vy: -dir.y * k + Math.random() * 1.2, vz: -dir.z * k + (Math.random() - 0.5) * 2, size: 0.4, grow: 2.6, life: 1.2 + Math.random() * 0.8, color: 0xcfc9c0, op: 0.6, drag: 2.2 });
    }
    for (let i = 0; i < 4; i++) cloud(front.x, front.y, front.z, { vx: dir.x * 2 + (Math.random() - 0.5), vy: 0.4, vz: dir.z * 2 + (Math.random() - 0.5), size: 0.3, grow: 1.8, life: 0.9, color: 0xd8d2c8, op: 0.45, drag: 2 });
    if (flashT <= 0.1) { flash.position.copy(front); flashI = 25; flashMax = flashT = 0.12; }
  }
  // explosion : pas une grosse boule, mais un cœur blanc très bref, une boule de feu faite d'une douzaine de flammes
  // qui jaillissent et s'étalent (jaunes, orange, rouges), des braises qui retombent, une fumée sombre qui monte ;
  // la grenade de souffle fait de même en violet, sans feu ni fumée
  const FIRE = [0xffb347, 0xff7a1a, 0xe2481a], BLAST = [0xe2c4ff, 0xb77dff, 0x8a4fe0];
  function boom(x, y, z, r, kind) {
    const purple = kind === 'souffle', cols = purple ? BLAST : FIRE, R = r * 0.45, y0 = y + 0.5;
    puff(x, y0, z, { tex: T.glow, color: purple ? 0xf2e6ff : 0xfff6e0, size: 1.2, grow: 1.4, life: 0.09, add: true, op: 1 });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.1, sp = 3 + Math.random() * 6;
      puff(x, y0, z, { tex: T.fire, color: cols[i % 3], size: 0.6 + Math.random() * 0.5, grow: R * (0.7 + Math.random() * 0.6), life: 0.3 + Math.random() * 0.32, add: true, op: 0.75,
        vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + 1.5, vz: Math.sin(a) * Math.cos(e) * sp, drag: 5, rot: Math.random() * 6.28 });
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.3 + Math.random() * 1.1, sp = 6 + Math.random() * 7;
      puff(x, y0, z, { tex: T.glow, color: purple ? 0xd0a8ff : 0xffb050, size: 0.14, grow: 0, life: 0.6 + Math.random() * 0.5, add: true, op: 1,
        vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp, vz: Math.sin(a) * Math.cos(e) * sp, drag: 0.8, g: 14 });
    }
    if (purple) { dust(x, y, z, { n: 10, r: 0.8, speed: 5, size: 0.9, op: 0.4, color: 0xc9b8e0 }); return; }
    debris(x, y + 0.3, z, 'terre', { n: 14, spread: 0.8, power: 6 });
    dust(x, y, z, { n: 12, r: 1, speed: 4, size: 1.1, op: 0.5, color: 0x8a7e6c });
    // (la fumée vient après le feu, pas devant lui)
    later(0.16, () => {
      for (let i = 0; i < 10; i++) {
        cloud(x + (Math.random() - 0.5) * R, y0 + Math.random() * R * 0.6, z + (Math.random() - 0.5) * R,
          { vx: (Math.random() - 0.5) * 2.4, vy: 1.4 + Math.random() * 1.6, vz: (Math.random() - 0.5) * 2.4, size: 1.1, grow: 3.2, life: 2.4 + Math.random() * 1.2, color: 0x3e3a37, op: 0.6, drag: 1.2 });
      }
    });
    flash.position.set(x, y + 1, z); flashI = 90; flashMax = flashT = 0.25;
  }

  function update(dt, t, sim, stormState, cam) {
    // traînées
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), dir = new THREE.Vector3(), s3 = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < N; i++) {
      const tr = trList[i];
      if (tr.life <= 0) continue;
      tr.life -= dt;
      if (tr.life <= 0) { tracers.setMatrixAt(i, zero); continue; }
      dir.subVectors(tr.to, tr.from); const L = dir.length(); dir.normalize();
      q.setFromUnitVectors(Z, dir); s3.set(1, 1, L); m4.compose(tr.from, q, s3); tracers.setMatrixAt(i, m4);
      tracers.setColorAt(i, new THREE.Color().copy(tr.color).multiplyScalar(tr.life / tr.max));
    }
    tracers.instanceMatrix.needsUpdate = true; if (tracers.instanceColor) tracers.instanceColor.needsUpdate = true;
    for (let i = timers.length - 1; i >= 0; i--) if ((timers[i].t -= dt) <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); }
    // sprites
    for (let i = live.length - 1; i >= 0; i--) {
      const L = live[i]; L.t += dt;
      const k = L.t / L.life;
      if (k >= 1) { L.s.on = false; L.s.o.visible = false; live.splice(i, 1); continue; }
      L.s.o.scale.setScalar(L.size + L.grow * Math.sqrt(k));
      L.s.m.opacity = L.op * (1 - k);
      if (L.drag) { const d = Math.exp(-L.drag * dt); L.vx *= d; L.vy *= d; L.vz *= d; }
      L.vy -= L.g * dt;
      L.s.o.position.x += L.vx * dt; L.s.o.position.y += (L.vy + L.rise) * dt; L.s.o.position.z += L.vz * dt;
    }
    if (flashT > 0) { flashT -= dt; flash.intensity = Math.max(0, flashT / flashMax) * flashI; }
    // fumée des cheminées proches
    if (cam) for (const c of smokers) {
      if (Math.abs(c.x - cam.x) > 160 || Math.abs(c.z - cam.z) > 160) continue;
      c.next -= dt;
      if (c.next > 0) continue;
      c.next = 0.35 + Math.random() * 0.3;
      cloud(c.x + (Math.random() - 0.5) * 0.2, c.y + 0.1, c.z + (Math.random() - 0.5) * 0.2,
        { vx: 0.35 + Math.random() * 0.2, vy: 1.1 + Math.random() * 0.4, vz: 0.15, size: 0.55, grow: 3.4, life: 4 + Math.random() * 1.5, color: 0xc4c1bb, op: 0.7, drag: 0.15 });
    }
    // poussière sous les pieds de ceux qui sprintent
    if (cam) for (const P of sim.S.players.values()) {
      if (!P.alive || P.mode !== 'sol' || !P.ground || P.swim || Math.hypot(P.vx, P.vz) < 6.2 || Math.abs(P.x - cam.x) > 60 || Math.abs(P.z - cam.z) > 60) continue;
      const k = (runDust.get(P.id) || 0) - dt;
      if (k > 0) { runDust.set(P.id, k); continue; }
      runDust.set(P.id, 0.16 + Math.random() * 0.08);
      cloud(P.x - P.vx * 0.05, P.y + 0.1, P.z - P.vz * 0.05, { vx: -P.vx * 0.08, vy: 0.4, vz: -P.vz * 0.08, size: 0.35, grow: 1.1, life: 0.7, color: 0xbcb19a, op: 0.35 });
    }
    // particules douces : mouvement, freinage, grossissement, fondu ; rangées dans les attributs
    let n = 0;
    for (let i = cl.length - 1; i >= 0; i--) {
      const c = cl[i]; c.t += dt;
      if (c.t >= c.life) { cl.splice(i, 1); continue; }
      const d = Math.exp(-c.drag * dt);
      c.vx *= d; c.vz *= d; c.vy *= Math.exp(-c.drag * 0.5 * dt);
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
    }
    for (const c of cl) {
      const k = c.t / c.life, a = c.op * Math.min(1, c.t * 8) * (1 - k);
      soft.set(n++, c.x, c.y, c.z, c.size + c.grow * Math.sqrt(k), c.r, c.g, c.b, a);
    }
    soft.count(n);
    // éclats : chute, rebonds amortis, au repos puis rétrécis
    for (let i = 0; i < KN; i++) {
      const c = ks[i];
      if (!c) continue;
      c.t += dt;
      if (c.t >= c.life) { chips.setMatrixAt(i, zero); ks[i] = null; continue; }
      c.vy -= 18 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      if (c.y < c.f + c.sy / 2) {
        c.y = c.f + c.sy / 2;
        if (Math.abs(c.vy) > 1.2) { c.vy = -c.vy * (c.metal ? 0.45 : 0.3); c.vx *= 0.6; c.vz *= 0.6; c.wx *= 0.5; c.wy *= 0.5; c.wz *= 0.5; }
        else { c.vy = 0; c.vx *= 0.8; c.vz *= 0.8; c.wx *= 0.8; c.wy *= 0.8; c.wz *= 0.8; }
      }
      c.rx += c.wx * dt; c.ry += c.wy * dt; c.rz += c.wz * dt;
      const shrink = Math.min(1, (c.life - c.t) / 0.4);
      kq.setFromEuler(ke.set(c.rx, c.ry, c.rz)); kp.set(c.x, c.y, c.z); kz.set(c.sx * shrink, c.sy * shrink, c.sz * shrink);
      chips.setMatrixAt(i, km.compose(kp, kq, kz));
    }
    chips.instanceMatrix.needsUpdate = true;
    // projectiles
    const seen = new Set();
    for (const L of launches.values()) L.age += dt;
    for (const [k, L] of launches) if (L.age > 0.5) launches.delete(k);
    for (const pr of sim.S.projectiles) {
      seen.add(pr.id);
      let o = projMeshes.get(pr.id);
      if (!o) {
        if (pr.kind === 'roquette') {
          o = new THREE.Group(); o.add(new THREE.Mesh(rocketGeo, rocketMat));
          const fl = new THREE.Mesh(flameGeo, flameMat); o.add(fl);
          // elle sort de la bouche du tube (la simulation la lance depuis l'épaule de visée) et rejoint sa trajectoire
          const L = launches.get(pr.owner);
          o.userData = { flame: fl, age: 0, last: null, off: L ? new THREE.Vector3(L.p.x - pr.x, L.p.y - pr.y, L.p.z - pr.z) : null };
          launches.delete(pr.owner);
        } else o = pr.kind === 'balle' ? new THREE.Mesh(bulletGeo, bulletMat) : new THREE.Mesh(nadeGeo, pr.kind === 'souffle' ? blastMat : nadeMat);
        group.add(o); projMeshes.set(pr.id, o);
      }
      o.position.set(pr.x, pr.y, pr.z);
      if (pr.kind === 'balle') o.lookAt(pr.x + pr.vx, pr.y + pr.vy, pr.z + pr.vz);
      if (pr.kind === 'roquette') {
        const U = o.userData, p = o.position;
        U.age += dt;
        if (U.off) { const k = Math.max(0, 1 - U.age / 0.22); p.addScaledVector(U.off, k * k); }
        o.lookAt(p.x + pr.vx, p.y + pr.vy, p.z + pr.vz);
        U.flame.scale.set(0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 0.7 + Math.random() * 0.7);
        // traînée continue : une bouffée tous les 45 cm du trajet, et une lueur juste derrière la tuyère
        if (!U.last) U.last = p.clone();
        const ex = p.x - U.last.x, ey = p.y - U.last.y, ez = p.z - U.last.z, n = Math.min(40, Math.floor(Math.hypot(ex, ey, ez) / 0.45));
        for (let i = 1; i <= n; i++) {
          const k = i / n;
          cloud(U.last.x + ex * k + (Math.random() - 0.5) * 0.1, U.last.y + ey * k + (Math.random() - 0.5) * 0.1, U.last.z + ez * k + (Math.random() - 0.5) * 0.1,
            { vx: (Math.random() - 0.5) * 0.6, vy: 0.25 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.6, size: 0.26, grow: 2.3, life: 1.4 + Math.random() * 0.8, color: 0xdcd8d0, op: 0.55, drag: 1.4 });
        }
        if (n) U.last.copy(p);
        const L = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
        puff(p.x - pr.vx / L * 0.45, p.y - pr.vy / L * 0.45, p.z - pr.vz / L * 0.45, { tex: T.glow, color: 0xffa040, size: 0.55, grow: 0.3, life: 0.05, add: true, op: 0.9 });
      }
    }
    for (const [id, o] of projMeshes) if (!seen.has(id)) { group.remove(o); projMeshes.delete(id); }
    // tempête
    storm.visible = !!stormState;
    if (stormState) {
      storm.position.set(stormState.x, -60, stormState.z);
      storm.scale.set(Math.max(1, stormState.r), 700, Math.max(1, stormState.r));
      stormMat.uniforms.uT.value = t;
    }
  }
  return {
    group, shot, muzzleFlash, launch, hitSpark, boom, update, puff, cloud, dust, debris, casing, chip,
    dispose() { for (const o of own) o.dispose(); scene.remove(group); },
  };
}
