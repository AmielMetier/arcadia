// Convoy Storm — sapins enneigés, faits comme les arbres de Birdie Party : un tronc d'écorce et des étages de branches
// inclinées vers le bas (des « cartes » d'aiguilles transparentes), de plus en plus courtes vers la pointe. Ici, la neige
// est posée sur le dessus de chaque branche, et le haut de l'arbre ondule au vent (SWAY, partagé avec le décor).
// Textures peintes en canevas au chargement, aucun fichier. Tout se dessine en instances (voir decor.js).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { makeRng } from '../engine/rng.js';
import { SWAY } from './models.js';

export const PINE_H = 13; // hauteur d'origine des géométries (m) : l'échelle d'une instance vaut hauteur voulue / PINE_H

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function finish(c, { srgb = true, repeat = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// Une branche vue de dessus : la tige au milieu, des rameaux de part et d'autre, des aiguilles serrées (fond transparent)
function needleTexture(size = 256, seed = 9) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(seed), y0 = size / 2;
  g.lineCap = 'round';
  for (let k = 0; k < 9; k++) {
    const t = 0.08 + k * 0.1, x = t * size, side = k % 2 ? 1 : -1, span = size * 0.42 * (1 - t * 0.75);
    const ex = x + span * 0.55, ey = y0 + side * span * 0.8;
    g.strokeStyle = 'rgb(62,50,36)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(ex, ey); g.stroke();
    for (let j = 0; j < 75; j++) {
      const u = r(), px = x + (ex - x) * u, py = y0 + (ey - y0) * u, len = 11 + r() * 13, a = Math.atan2(ey - y0, ex - x) + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.5);
      const v = 0.5 + r() * 0.5;
      g.strokeStyle = `rgb(${Math.round(14 + 24 * v)},${Math.round(46 + 50 * v)},${Math.round(40 + 30 * v)})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke();
    }
  }
  for (let j = 0; j < 520; j++) {
    const u = r(), px = u * size * 0.97, w = size * 0.26 * (1 - u * 0.75), len = 10 + r() * w * 0.6, a = (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.9) + 0.15;
    const v = 0.4 + r() * 0.6;
    g.strokeStyle = `rgb(${Math.round(12 + 24 * v)},${Math.round(44 + 52 * v)},${Math.round(36 + 32 * v)})`; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(px, y0); g.lineTo(px + Math.cos(a) * len, y0 + Math.sin(a) * len); g.stroke();
  }
  g.strokeStyle = 'rgb(72,56,38)'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, y0); g.lineTo(size * 0.95, y0); g.stroke();
  return finish(c, { repeat: false });
}
// La neige : des paquets ronds semés au hasard, sur une texture qui se répète sans couture. Chaque branche en prend un
// morceau différent (décalage, échelle), si bien qu'aucun motif ne se répète d'une branche ou d'un sapin à l'autre.
function snowMask(size = 256, seed = 13) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  const blob = (x, y, rad, v) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(255,255,255,${v})`); gr.addColorStop(0.65, `rgba(255,255,255,${v * 0.75})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
  for (let i = 0; i < 90; i++) {
    const x = r() * size, y = r() * size, rad = 6 + Math.pow(r(), 1.5) * 24, v = 0.5 + r() * 0.5;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) if (x + dx > -rad && x + dx < size + rad && y + dy > -rad && y + dy < size + rad) blob(x + dx, y + dy, rad, v);
  }
  return finish(c, { srgb: false, repeat: true });
}
// Écorce : stries verticales brunes, un peu givrées
function barkTexture(size = 128) {
  const c = canvas(size), g = c.getContext('2d'), r = rng(31);
  g.fillStyle = '#4e3a2a'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = r() * size, w = 1 + r() * 3;
    g.fillStyle = r() < 0.5 ? 'rgba(45,30,20,0.6)' : 'rgba(160,140,120,0.35)';
    for (const dx of [-size, 0, size]) g.fillRect(x + dx, 0, w, size);
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(30,22,14,0.5)'; g.fillRect(r() * size, r() * size, 2 + r() * 4, 1 + r() * 2); }
  return finish(c, {});
}

// ------------------------------------------------------------------ géométries (arbre de 13 m)
function builder() {
  const pos = [], nor = [], uv = [], idx = [], col = [], snow = [];
  return {
    // branche : la tige part de root vers tip, la largeur s'étale de part et d'autre ; ao : ombre interne (0 → 1) ;
    // sn : sa neige (décalage u, v dans le masque, quantité, échelle)
    branch(root, tip, side, n, ao, tint, sn) {
      const b = pos.length / 3;
      for (const [p, s, tu, tv, a] of [[root, -1, 0, 0, ao * 0.6], [tip, -1, 1, 0, ao], [tip, 1, 1, 1, ao], [root, 1, 0, 1, ao * 0.6]]) {
        pos.push(p.x + side.x * s, p.y + side.y * s, p.z + side.z * s);
        nor.push(n.x, n.y, n.z); uv.push(tu, tv); col.push(a * tint.r, a * tint.g, a * tint.b); snow.push(...sn);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    },
    geo() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('aSnow', new THREE.Float32BufferAttribute(snow, 4));
      g.setIndex(idx); g.computeBoundingSphere();
      return g;
    },
  };
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function pineGeo(seed, { height = PINE_H, base = 1.0, radius = 3.4, tiers = 16, per = 9, tint = 0xffffff } = {}) {
  const r = makeRng(seed), b = builder(), tc = new THREE.Color(tint);
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1), y = base + (height - base - 0.8) * f;
    const R = radius * Math.pow(1 - f, 0.85) + 0.35, off = r.range(0, 6.283), n = Math.max(4, Math.round(per * (1 - f * 0.4)));
    for (let k = 0; k < n; k++) {
      const a = off + k * (Math.PI * 2 / n) + r.range(-0.2, 0.2), dx = Math.sin(a), dz = Math.cos(a), droop = R * r.range(0.35, 0.55);
      const root = V3(dx * 0.15, y + 0.25, dz * 0.15), tip = V3(dx * R, y - droop, dz * R);
      const side = V3(dz, r.range(-0.35, 0.35), -dx).normalize().multiplyScalar(R * 0.85);
      // neige inégale : certaines branches en sont chargées, d'autres presque nues (plus de neige vers le haut, à découvert)
      const amt = (r.chance(0.22) ? r.range(0.05, 0.35) : r.range(0.6, 1.3)) * (0.7 + 0.3 * f);
      b.branch(root, tip, side, V3(dx * 0.7, 0.75, dz * 0.7).normalize(), 0.55 + 0.45 * f, tc, [r.next(), r.next(), amt, r.range(0.55, 1.35)]);
    }
  }
  b.branch(V3(0, height - 1.6, 0), V3(0, height + 0.3, 0), V3(0.45, 0, 0), V3(0, 1, 0), 1, tc, [r.next(), r.next(), 0.9, 1]);
  b.branch(V3(0, height - 1.6, 0), V3(0, height + 0.3, 0), V3(0, 0, 0.45), V3(0, 1, 0), 1, tc, [r.next(), r.next(), 0.9, 1]);
  return b.geo();
}
function trunkGeo(h, r0) {
  const g = new THREE.CylinderGeometry(r0 * 0.55, r0, h, 8, 1, true).translate(0, h / 2, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * h / 2);
  return g;
}

// Aiguilles : découpe nette (alphaTest + couverture), lumière douce et ronde (normales hors de la couronne),
// neige sur la face du dessus, balancement au vent plus fort vers la cime
function needleMaterial(map, mask) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, vertexColors: true });
  const U = { uSnowMask: { value: mask }, uSnow: { value: 0.95 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SWAY, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uT; uniform float uWind; attribute vec4 aSnow; varying vec4 vSnow;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec2 ph = instanceMatrix[3].xz; float ts = length(instanceMatrix[0].xyz);
          #else
            vec2 ph = modelMatrix[3].xz; float ts = length(modelMatrix[0].xyz);
          #endif
          // chaque sapin décale encore le masque (sa taille, propre à chaque arbre, sert de graine)
          vSnow = vec4(aSnow.xy + vec2(fract(ts * 97.31), fract(ts * 61.73)), aSnow.zw);
          float k = max(0.0, transformed.y - 2.0) * (0.01 + uWind * 0.022);
          transformed.x += sin(uT * 1.4 + ph.x * 0.21 + transformed.y * 0.3) * k;
          transformed.z += cos(uT * 1.1 + ph.y * 0.17 + transformed.x * 0.4) * k * 0.8;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uSnowMask; uniform float uSnow; varying vec4 vSnow;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // plus de neige le long de la tige qu'au bout des aiguilles
          float band = 1.0 - smoothstep(0.12, 0.5, abs(vMapUv.y - 0.5));
          float sm = texture2D(uSnowMask, vMapUv * vSnow.w + vSnow.xy).r * mix(0.45, 1.0, band) * vSnow.z * (gl_FrontFacing ? 1.0 : 0.12) * uSnow;
          // la neige garde un peu de l'ombre interne (dessous et cœur de l'arbre)
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.98) * (0.6 + 0.4 * max(vColor.r, max(vColor.g, vColor.b))), smoothstep(0.36, 0.74, sm));
        }`)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal); nonPerturbedNormal = normal;');
  };
  m.customProgramCacheKey = () => 'convoy-pine-2';
  return { m, U };
}

const TINTS = [0xffffff, 0xd8e6dc, 0xc4d6c8];

// Le jeu de sapins : trois silhouettes détaillées, deux allégées (au loin), et leurs troncs
export function createPineKit() {
  const needles = needleTexture(), mask = snowMask(), bark = barkTexture();
  const nm = needleMaterial(needles, mask);
  const mats = { needle: nm.m, bark: new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 }) };
  const trunk = trunkGeo(11, 0.3);
  const variants = [
    { needles: pineGeo(4, { tint: TINTS[0] }), trunk },
    { needles: pineGeo(12, { radius: 3.0, tiers: 13, tint: TINTS[1] }), trunk },
    { needles: pineGeo(27, { radius: 3.8, tiers: 17, per: 10, tint: TINTS[2] }), trunk },
  ];
  const lo = [
    { needles: pineGeo(30, { tiers: 9, per: 7, radius: 3.4, tint: TINTS[1] }), trunk },
    { needles: pineGeo(41, { tiers: 8, per: 6, radius: 3.1, tint: TINTS[0] }), trunk },
  ];
  return {
    variants, lo, mats,
    // un sapin seul (abattu, qui tombe) : mêmes géométries, sans instances
    mesh(i = 0) {
      const v = variants[i % variants.length], g = new THREE.Group();
      const a = new THREE.Mesh(v.trunk, mats.bark), b = new THREE.Mesh(v.needles, mats.needle);
      a.castShadow = b.castShadow = true; a.receiveShadow = b.receiveShadow = true; g.add(a, b);
      return g;
    },
    setSnow(k) { nm.U.uSnow.value = k; },
    dispose() {
      for (const v of [...variants, ...lo]) v.needles.dispose();
      trunk.dispose(); for (const m of Object.values(mats)) m.dispose(); needles.dispose(); mask.dispose(); bark.dispose();
    },
  };
}
