// Birdie Party — ciel : dégradé bleu, halo du soleil et nuages peints (bruit animé dans le shader du dôme).
// Le ciel sert aussi de carte d'environnement (reflets de l'eau, lumière d'ambiance).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { makeRng } from '../engine/rng.js';

export const SKIES = {
  campagne: { zenith: 0x2a6ad6, horizon: 0xb2d6f6, ground: 0x9cc4e4, sun: 0xfff2d6, fog: 0xa9cbe9, cloudShade: 0xc9d6ea },
  mer: { zenith: 0x1d78e0, horizon: 0xbfe6fb, ground: 0x9fd6ee, sun: 0xfff4dc, fog: 0xb5def5, cloudShade: 0xcfdcee, peaks: 'iles', peak: 0x6f9fb8, peakTop: 0x8fb8a8 },
  montagne: { zenith: 0x1f5fcf, horizon: 0xb8d4f0, ground: 0x9ab8d8, sun: 0xfff0d8, fog: 0xaecbe6, cloudShade: 0xc4d0e4, peaks: 'alpes', peak: 0x7e93b4, peakTop: 0xf4f7ff },
};

export function buildSky(look, sunDir, noise) {
  const geo = new THREE.SphereGeometry(3000, 48, 24);
  const U = {
    uZen: { value: new THREE.Color(look.zenith) }, uHor: { value: new THREE.Color(look.horizon) },
    uGround: { value: new THREE.Color(look.ground) }, uSun: { value: new THREE.Color(look.sun) }, uSunDir: { value: sunDir.clone() },
    uShade: { value: new THREE.Color(look.cloudShade) }, uNoise: { value: noise }, uT: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `varying vec3 vD; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGround; uniform vec3 uSun; uniform vec3 uSunDir; uniform vec3 uShade;
      uniform sampler2D uNoise; uniform float uT;
      float fbm(vec2 p){ return texture2D(uNoise, p).r * 0.5 + texture2D(uNoise, p * 2.07 + 0.31).g * 0.3 + texture2D(uNoise, p * 4.3 + 0.77).r * 0.2; }
      void main(){
        vec3 d = normalize(vD);
        float h = d.y;
        vec3 c = mix(uHor, uZen, pow(smoothstep(0.0, 0.75, h), 0.6));
        c = mix(c, uGround, smoothstep(0.0, -0.12, h));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        c += uSun * (pow(s, 900.0) * 5.0 + pow(s, 30.0) * 0.28 + pow(s, 5.0) * 0.08);
        if (h > 0.0) {
          // nuages : projetés sur un plafond, plus fins vers l'horizon ; ombrés en comparant au bruit décalé vers le soleil
          vec2 cp = d.xz / (h + 0.12) * 0.055 + vec2(uT * 0.0009, uT * 0.0004);
          float n = fbm(cp) * 0.75 + fbm(cp * 0.37 + 0.5) * 0.25;
          float cov = smoothstep(0.56, 0.72, n);
          float lit = clamp((n - fbm(cp + normalize(uSunDir.xz) * 0.01) * 0.75 - fbm((cp + normalize(uSunDir.xz) * 0.01) * 0.37 + 0.5) * 0.25) * 7.0 + 0.6, 0.0, 1.0);
          vec3 cc = mix(uShade, vec3(1.0), lit);
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
  sky.userData.update = (t) => { U.uT.value = t; };
  return sky;
}

// Horizon lointain : sommets enneigés (montagne) ou îles basses sur la mer, déjà teintés par la brume
export function buildPeaks(look, seed, center) {
  if (!look.peaks) return null;
  const alps = look.peaks === 'alpes';
  const r = makeRng(seed * 3 + 1);
  const seg = 240, rings = 7, R0 = alps ? 1650 : 1500, R1 = alps ? 2350 : 2100;
  const pos = [], col = [], idx = [];
  const base = new THREE.Color(look.peak), top = new THREE.Color(look.peakTop), far = new THREE.Color(look.fog);
  const peaks = Array.from({ length: alps ? 13 : 6 }, () => ({ a: r.range(0, Math.PI * 2), w: r.range(alps ? 0.3 : 0.12, alps ? 0.6 : 0.25), h: alps ? r.range(200, 400) : r.range(50, 120) }));
  const height = (a, k) => {
    let h = alps ? 60 + 40 * Math.sin(a * 7 + 1) + 30 * Math.sin(a * 13 + 2) + 18 * Math.sin(a * 31) : -40;
    for (const p of peaks) { let d = Math.abs(a - p.a); d = Math.min(d, Math.PI * 2 - d); h += p.h * Math.exp(-(d * d) / (p.w * p.w * 0.1)); }
    return h * Math.sin(Math.PI * k) ** 0.7;
  };
  for (let j = 0; j <= rings; j++) {
    const k = j / rings, R = R0 + (R1 - R0) * k;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, h = height(a, k);
      pos.push(center.x + Math.sin(a) * R, Math.max(alps ? -30 : -6, h) - 25, center.z + Math.cos(a) * R);
      const snow = alps ? Math.max(0, Math.min(1, (h - 190) / 60)) : Math.max(0, Math.min(1, h / 90));
      const c = base.clone().lerp(far, 0.3 + 0.3 * (1 - k)).lerp(top, snow * 0.92);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, emissive: 0x5b77a0, emissiveIntensity: 0.22 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
