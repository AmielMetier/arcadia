// Birdie Party — ciel : dégradé bleu, halo du soleil et nuages peints (bruit qui dérive avec le vent dans le shader du dôme).
// Le ciel sert aussi de carte d'environnement (reflets de l'eau, lumière d'ambiance).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { makeRng } from '../engine/rng.js';

export const SKIES = {
  campagne: { zenith: 0x2f66bd, horizon: 0xc9dbec, ground: 0xa9bccd, sun: 0xfff0d6, fog: 0x9fb8d8, cloudShade: 0xa7b3c4 },
  mer: { zenith: 0x2a6bc4, horizon: 0xd2e3f0, ground: 0xb3c8d8, sun: 0xfff2da, fog: 0xa9c4e2, cloudShade: 0xb0bccc, peaks: 'iles', peak: 0x52767f, peakTop: 0x6c8a74 },
  montagne: { zenith: 0x2a5cb4, horizon: 0xc4d4e6, ground: 0xa6b6c8, sun: 0xfff0d8, fog: 0x98b0d4, cloudShade: 0xa2aec0, peaks: 'alpes', peak: 0x66778f, peakTop: 0xeef2f8 },
  desert: { zenith: 0x3270c4, horizon: 0xeed8b8, ground: 0xd8b48a, sun: 0xfff1d0, fog: 0xd9c0a0, cloudShade: 0xc8b8a4, peaks: 'mesas', peak: 0xb05e3c, peakTop: 0xcc8a5a },
};
// Moments de la journée : direction et couleur du soleil (la lune le soir), lumière du ciel, couleurs du ciel et de
// la brume. Le jour garde les réglages de chaque décor.
export const TIMES = {
  jour: null,
  crepuscule: {
    dir: [-0.62, 0.2, -0.76], sunColor: 0xffa45c, sunInt: 3.0, hemiSky: 0xf2b88e, hemiGround: 0x3a2e1e, hemiInt: 0.36, exposure: 0.98, env: 0.26,
    sky: { zenith: 0x2c4a8c, horizon: 0xf4a46c, ground: 0x9a7868, sun: 0xffb46a, fog: 0xd49c7c, cloudShade: 0x9a6a70, cloudLit: 0xffcfa2, glow: 1.5 },
  },
  soir: {
    dir: [0.36, 0.62, -0.7], sunColor: 0xa6baff, sunInt: 1.4, hemiSky: 0x6c82c4, hemiGround: 0x141a26, hemiInt: 0.6, exposure: 1.28, env: 0.22,
    sky: { zenith: 0x0b1636, horizon: 0x3a4f86, ground: 0x1e2636, sun: 0xdce6ff, fog: 0x25335a, cloudShade: 0x232c48, cloudLit: 0x7c8cb4, glow: 0.35, stars: 1 },
  },
};
export const skyFor = (theme, time) => { const T = TIMES[time]; const base = SKIES[theme] || SKIES.campagne; return T ? { ...base, ...T.sky } : base; };

export function buildSky(look, sunDir, noise) {
  const geo = new THREE.SphereGeometry(3000, 48, 24);
  const U = {
    uZen: { value: new THREE.Color(look.zenith) }, uHor: { value: new THREE.Color(look.horizon) },
    uGround: { value: new THREE.Color(look.ground) }, uSun: { value: new THREE.Color(look.sun) }, uSunDir: { value: sunDir.clone() },
    uShade: { value: new THREE.Color(look.cloudShade) }, uNoise: { value: noise }, uDrift: { value: new THREE.Vector2() },
    uLit: { value: new THREE.Color(look.cloudLit ?? 0xffffff) }, uGlow: { value: look.glow ?? 1 }, uNight: { value: look.stars ?? 0 },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `varying vec3 vD; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGround; uniform vec3 uSun; uniform vec3 uSunDir; uniform vec3 uShade;
      uniform sampler2D uNoise; uniform vec2 uDrift; uniform vec3 uLit; uniform float uGlow; uniform float uNight;
      // hasard sans sinus (pas d'alignements quand les coordonnées sont grandes)
      float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float fbm(vec2 p){ return texture2D(uNoise, p).r * 0.5 + texture2D(uNoise, p * 2.07 + 0.31).g * 0.3 + texture2D(uNoise, p * 4.3 + 0.77).r * 0.2; }
      // les grandes masses avancent moins vite que le détail : les nuages changent de forme en dérivant
      float cloud(vec2 p){ return fbm(p) * 0.75 + fbm((p + uDrift * 0.2) * 0.37 + 0.5) * 0.25; }
      void main(){
        vec3 d = normalize(vD);
        float h = d.y;
        vec3 c = mix(uHor, uZen, pow(smoothstep(0.0, 0.75, h), 0.6));
        c = mix(c, uGround, smoothstep(0.0, -0.12, h));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        c += uSun * (pow(s, 900.0) * 5.0 + (pow(s, 30.0) * 0.28 + pow(s, 5.0) * 0.08) * uGlow);
        // le soir : des étoiles, plus nombreuses vers le zénith
        if (uNight > 0.0 && h > 0.04) {
          vec2 sp = d.xz / (h + 0.35) * 260.0, cell = floor(sp);
          float st = step(0.9965, hash(cell)) * smoothstep(0.42, 0.1, length(fract(sp) - 0.5)) * (0.5 + 0.5 * hash(cell + 3.1));
          c += vec3(0.9, 0.93, 1.0) * st * uNight * smoothstep(0.04, 0.35, h) * 1.6;
        }
        if (h > 0.0) {
          // nuages : projetés sur un plafond, plus fins vers l'horizon, poussés par le vent ; ombrés en comparant au bruit décalé vers le soleil
          vec2 cp = d.xz / (h + 0.12) * 0.055 - uDrift;
          float n = cloud(cp);
          float cov = smoothstep(0.56, 0.72, n);
          float lit = clamp((n - cloud(cp + normalize(uSunDir.xz) * 0.01)) * 7.0 + 0.6, 0.0, 1.0);
          vec3 cc = mix(uShade, uLit * 1.08, lit) * (0.92 + 0.12 * smoothstep(0.56, 0.9, n));
          c = mix(c, cc, cov * smoothstep(0.015, 0.16, h) * 0.97);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  // dérive lente des nuages dans le sens du vent du trou (un peu plus vite quand il souffle fort)
  let last = null;
  sky.userData.update = (t, wind) => {
    const dt = last == null ? 0 : Math.min(0.1, Math.max(0, t - last)); last = t;
    const a = wind ? wind.dir : 0.7, v = 0.0014 + 0.0002 * (wind ? wind.speed : 0);
    U.uDrift.value.x += Math.sin(a) * v * dt; U.uDrift.value.y += Math.cos(a) * v * dt;
  };
  return sky;
}

// Horizon lointain : chaîne de sommets (montagne), îles sur la mer ou mesas du désert. Relief à crêtes ; le shader
// peint la forêt en bas, la roche, puis la neige en altitude (moins sur les pentes raides) ; au désert, la roche rouge
// en strates. La brume de la scène les voile.
export function buildPeaks(look, seed, center, noise) {
  if (!look.peaks) return null;
  const alps = look.peaks === 'alpes', mesas = look.peaks === 'mesas';
  const r = makeRng(seed * 3 + 1);
  const seg = alps || mesas ? 720 : 360, rings = alps || mesas ? 44 : 16, R0 = alps ? 1600 : 1450, R1 = alps ? 2550 : 2100;
  const peaks = Array.from({ length: alps ? 16 : mesas ? 14 : 6 }, () => ({ a: r.range(0, Math.PI * 2), w: r.range(alps ? 0.22 : mesas ? 0.04 : 0.08, alps ? 0.5 : mesas ? 0.16 : 0.18), h: alps ? r.range(150, 330) : mesas ? r.range(55, 150) : r.range(40, 110), k: r.range(0.25, 0.75), kw: r.range(0.12, 0.3) }));
  // relief calculé en coordonnées du monde : il varie doucement d'un anneau du maillage à l'autre (pas de marches)
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const height = (a, k, x, z) => {
    let h = 0;
    if (mesas) {
      // mesas et buttes : sommet plat, flancs à pic ; entre elles, des dunes basses
      for (const p of peaks) {
        let d = Math.abs(a - p.a); d = Math.min(d, Math.PI * 2 - d);
        const t = (1 - sm(0.72, 1.0, d / p.w)) * (1 - sm(0.7, 1.0, Math.abs(k - p.k) / p.kw));
        h = Math.max(h, p.h * t + 3 * Math.sin(x * 0.02 + z * 0.013) * t);
      }
      return (h + 6 + 5 * Math.sin(x * 0.006 + 1.1) * Math.sin(z * 0.007)) * Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.08)), 0.5);
    }
    for (const p of peaks) { let d = Math.abs(a - p.a); d = Math.min(d, Math.PI * 2 - d); h += p.h * Math.exp(-(d * d) / (p.w * p.w * 0.25)); }
    if (alps) {
      // crêtes et ravines
      h += 70 + 46 * (1 - Math.abs(Math.sin(x * 0.0042 + z * 0.0023))) + 22 * (1 - Math.abs(Math.sin(x * 0.0105 - z * 0.0088 + 1.3))) + 9 * Math.sin(x * 0.024 + z * 0.019);
    } else h -= 45;
    return h * Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.08)), 0.8);
  };
  const pos = [], idx = [];
  for (let j = 0; j <= rings; j++) {
    const k = j / rings, R = R0 + (R1 - R0) * k;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, x = center.x + Math.sin(a) * R, z = center.z + Math.cos(a) * R, h = height(a, k, x, z);
      pos.push(x, Math.max(alps ? -40 : -8, h) - (mesas ? 14 : 30), z);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const U = { uNoise: { value: noise }, uFog: { value: new THREE.Color(look.fog) }, uSnow: { value: alps ? 580 : 9999 }, uTree: { value: alps ? 130 : mesas ? -999 : 9999 },
    uRock: { value: new THREE.Color(look.peak) }, uForest: { value: new THREE.Color(alps ? 0x1d2f1b : 0x3c5a34) }, uStrata: { value: mesas ? 1 : 0 } };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vWN; uniform sampler2D uNoise; uniform vec3 uFog; uniform float uSnow; uniform float uTree; uniform vec3 uRock; uniform vec3 uForest; uniform float uStrata;')
      .replace('#include <map_fragment>', `
        float n = texture2D(uNoise, vW.xz / 140.0).r * 0.6 + texture2D(uNoise, vW.xz / 37.0).g * 0.4;
        float slope = 1.0 - abs(vWN.y);
        vec3 rock = uRock * (0.6 + 0.6 * n);
        // désert : strates horizontales, plus claires sur les sommets plats, plus sombres sur les flancs
        rock = mix(rock, uRock * (0.78 + 0.22 * sin(vW.y * 0.42 + n * 2.5)) * mix(0.82, 1.18, smoothstep(0.35, 0.05, slope)), uStrata);
        // limites de la forêt et des neiges qui varient d'un massif à l'autre ; la neige descend plus bas à l'ombre
        float big = texture2D(uNoise, vW.xz / 2500.0).b - 0.5, mid = texture2D(uNoise, vW.xz / 700.0).b - 0.5;
        float tree = 1.0 - smoothstep(uTree - 30.0, uTree + 40.0, vW.y + n * 50.0 - big * 120.0);
        vec3 c = mix(rock, uForest * (0.8 + 0.4 * n), tree);
        // elle reste dans les couloirs (les creux entre les petites crêtes du relief) et quitte les arêtes
        float gully = abs(sin(vW.x * 0.0105 - vW.z * 0.0088 + 1.3));
        float line = uSnow + big * 300.0 + mid * 170.0 + dot(vWN.xz, vec2(-0.73, -0.68)) * 60.0 + 40.0 - gully * gully * 110.0;
        float sn = smoothstep(line - 20.0, line + 20.0, vW.y + n * 60.0) * (1.0 - smoothstep(0.4, 0.7, slope) * 0.9);
        // rochers qui percent la neige sur les arêtes
        float rk = texture2D(uNoise, vW.xz / 260.0).r * 0.6 + texture2D(uNoise, vW.xz / 110.0).g * 0.4;
        sn *= smoothstep(0.36, 0.62, rk + (vW.y - line) * 0.002);
        c = mix(c, c * 0.8, smoothstep(0.5, 0.3, rk) * (1.0 - tree));
        c = mix(c, vec3(0.93, 0.95, 0.99), sn);
        diffuseColor.rgb = c * vec3(0.92, 0.96, 1.04);`)
      ;
  };
  mat.customProgramCacheKey = () => 'golf-peaks';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
