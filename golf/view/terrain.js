// Birdie Party — le sol : un seul maillage (fin sur le parcours, de plus en plus lâche vers l'horizon) et un shader
// qui peint l'herbe. Plutôt qu'une image des couleurs (floue de près), on stocke dans une texture les distances
// aux bords — fairway, green, bunkers — et l'avancée le long du trou (bandes de tonte) : le shader en tire des bords
// nets à toute distance, puis ajoute le grain de l'herbe (texture de brins) et les nuances des prés.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { grassTexture, sandTexture } from './textures.js';

export const LOOKS = {
  campagne: {
    rough: 0x2b8c12, rough2: 0x3f9e16, cut: 0x3fa61a, fair1: 0x5cc425, fair2: 0x4cb41c, fringe: 0x55bf27,
    green1: 0x6fd53a, green2: 0x63c933, tee1: 0x60c829, tee2: 0x52b922, sand: 0xf6e8bf, sandEdge: 0xdcc890, bed: 0x2e6b55,
    out1: 0x175c08, out2: 0x1f6a0b, rock: 0xd8d2c4, shallow: 0x7fd6c8, deep: 0x1d5f8a,
  },
  mer: {
    rough: 0x35951a, rough2: 0x48a61e, cut: 0x47ad22, fair1: 0x66cb2c, fair2: 0x55bb22, fringe: 0x5ec42d,
    green1: 0x76da40, green2: 0x6acd38, tee1: 0x66cc2e, tee2: 0x57bd26, sand: 0xfbefcc, sandEdge: 0xe8d6a2, bed: 0x2e7a6a,
    out1: 0x1d6a0c, out2: 0x267812, rock: 0xd9c8a6, shallow: 0x5fe0d4, deep: 0x0f6fa8,
  },
  montagne: {
    rough: 0x2a8618, rough2: 0x3a961c, cut: 0x3ba01e, fair1: 0x58c02a, fair2: 0x48ae20, fringe: 0x52b92a,
    green1: 0x6ad23e, green2: 0x5ec636, tee1: 0x5cc42c, tee2: 0x4fb524, sand: 0xf1e6c8, sandEdge: 0xd6c595, bed: 0x2a5e58,
    out1: 0x145408, out2: 0x1b600c, rock: 0x9d958a, shallow: 0x8fd8d0, deep: 0x245c78,
  },
};

const PX = 0.5;        // mètres par texel de la carte des distances
const FM = 6, SG = 6, SB = 3, STRIPE = 22; // plages des distances encodées (m) et période des bandes de tonte (m)

// Carte des distances : R fairway, G green, B bunker (signées, positives dedans), A bandes de tonte
function distanceMap(hole) {
  const B = hole.bounds, M = 70;
  const area = { x0: B.x0 - M, z0: B.z0 - M, x1: B.x1 + M, z1: B.z1 + M };
  const W = Math.ceil((area.x1 - area.x0) / PX), H = Math.ceil((area.z1 - area.z0) / PX);
  const data = new Uint8Array(W * H * 4);
  const G = hole.green, rG = Math.min(G.rx, G.rz);
  const enc = (v, r) => Math.round(255 * Math.min(1, Math.max(0, (v + r) / (2 * r))));
  for (let j = 0; j < H; j++) {
    const z = area.z0 + (j + 0.5) * PX;
    for (let i = 0; i < W; i++) {
      const x = area.x0 + (i + 0.5) * PX;
      const f = hole.fields(x, z), k = (j * W + i) * 4;
      data[k] = enc(f.fm, FM);
      data[k + 1] = enc((1 - f.gd) * rG, SG);
      // sable : bunkers et plage (la plage continue sous l'eau, teintée ensuite par la profondeur)
      let sb = f.bi >= 0 ? (1 - f.bd) * Math.min(hole.bunkers[f.bi].rx, hole.bunkers[f.bi].rz) : -SB;
      if (hole.coast) sb = Math.max(sb, hole.coast.beach - f.sd);
      data[k + 2] = enc(sb, SB);
      data[k + 3] = Math.round(127.5 + 127.5 * Math.sin(f.along * 2 * Math.PI / STRIPE));
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  return { tex, area };
}

// Carte « hors jeu » (2 m par texel) : 0 dans le couloir du trou, 1 au-delà de la vallée et hors limites
function zoneMap(hole) {
  const B = hole.bounds, M = 260, P = 2;
  const area = { x0: B.x0 - M, z0: B.z0 - M, x1: B.x1 + M, z1: B.z1 + M };
  const W = Math.ceil((area.x1 - area.x0) / P), H = Math.ceil((area.z1 - area.z0) / P);
  const data = new Uint8Array(W * H * 4);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < H; j++) {
    const z = area.z0 + (j + 0.5) * P;
    for (let i = 0; i < W; i++) {
      const x = area.x0 + (i + 0.5) * P;
      const ob = Math.max(B.x0 - x, x - B.x1, B.z0 - z, z - B.z1);
      const k = Math.max(smooth(hole.valley - 8, hole.valley + 22, hole.centerDist(x, z)), smooth(-6, 10, ob));
      data[(j * W + i) * 4] = Math.round(k * 255);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  return { tex, area };
}

// Mini-carte : le trou dessiné en couleurs franches, détouré (transparent hors de la vallée du trou)
export function paintMap(hole, look) {
  const P = 1.25, B = hole.bounds, M = 30;
  const area = { x0: B.x0 - M, z0: B.z0 - M, x1: B.x1 + M, z1: B.z1 + M };
  const W = Math.ceil((area.x1 - area.x0) / P), H = Math.ceil((area.z1 - area.z0) / P);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const C = { rough: [34, 112, 20], edge: [20, 80, 14], fair1: hex(look.fair1), fair2: hex(look.fair2), green: hex(look.green1), sand: hex(look.sand), water: [60, 150, 225], tee: hex(look.tee1) };
  const reach = hole.valley + 22;
  for (let py = 0; py < H; py++) {
    const z = area.z1 - (py + 0.5) * P;
    for (let px = 0; px < W; px++) {
      const x = area.x0 + (px + 0.5) * P, cd = hole.centerDist(x, z);
      const k = (py * W + px) * 4;
      if (cd > reach + 3) { d[k + 3] = 0; continue; }
      const f = hole.fields(x, z), s = hole.surfaceF(x, z, f, hole.heightF(x, z, f));
      let c = C.rough;
      if (cd > reach) c = C.edge;
      else if (s === 'water') c = C.water;
      else if (s === 'bunker') c = C.sand;
      else if (s === 'green' || s === 'fringe') c = C.green;
      else if (s === 'tee') c = C.tee;
      else if (s === 'fairway') c = (Math.floor(f.along / (STRIPE / 2)) & 1) ? C.fair1 : C.fair2;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { canvas: cv, area };
}

// Coordonnées d'un axe : pas fin sur [a, b], puis des pas qui s'allongent jusqu'à `far` de chaque côté
function axis(a, b, step, far) {
  const out = [];
  for (let v = a; v <= b + 1e-6; v += step) out.push(v);
  let s = step, v = a; const pre = [];
  while (v > a - far) { s *= 1.12; v -= s; pre.push(v); }
  s = step; v = out[out.length - 1];
  while (v < b + far) { s *= 1.12; v += s; out.push(v); }
  return [...pre.reverse(), ...out];
}

export function buildTerrain(hole, { look, noise, anisotropy = 8, step = 1.25 } = {}) {
  const B = hole.bounds;
  const xs = axis(B.x0 - 40, B.x1 + 40, step, 1600), zs = axis(B.z0 - 40, B.z1 + 40, step, 1600);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = (j * nx + i) * 3, x = xs[i], z = zs[j];
    pos[k] = x; pos[k + 1] = hole.heightAt(x, z); pos[k + 2] = z;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let q = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();

  const sdf = distanceMap(hole), zone = zoneMap(hole);
  const grass = grassTexture(), sand = sandTexture();
  grass.anisotropy = sand.anisotropy = anisotropy;
  const G = hole.green, td = hole.teeDir;
  const ponds = [], pondsB = [];
  for (let i = 0; i < 4; i++) {
    const w = hole.waters[i];
    ponds.push(w ? new THREE.Vector4(w.x, w.z, w.rx, w.rz) : new THREE.Vector4(0, 0, 1, 1));
    pondsB.push(w ? new THREE.Vector4(Math.cos(w.rot || 0), Math.sin(w.rot || 0), hole.waterLv[i], 1) : new THREE.Vector4(1, 0, -1e4, 0));
  }
  const col = (h) => new THREE.Color(h);
  const U = {
    uSdf: { value: sdf.tex }, uMin: { value: new THREE.Vector2(sdf.area.x0, sdf.area.z0) }, uSize: { value: new THREE.Vector2(sdf.area.x1 - sdf.area.x0, sdf.area.z1 - sdf.area.z0) },
    uZone: { value: zone.tex }, uZMin: { value: new THREE.Vector2(zone.area.x0, zone.area.z0) }, uZSize: { value: new THREE.Vector2(zone.area.x1 - zone.area.x0, zone.area.z1 - zone.area.z0) },
    cOut1: { value: col(look.out1) }, cOut2: { value: col(look.out2) }, cRock: { value: col(look.rock) }, cShallow: { value: col(look.shallow) }, cDeep: { value: col(look.deep) },
    uSea: { value: hole.coast ? hole.coast.level : -1e4 },
    uGrass: { value: grass }, uSandT: { value: sand }, uNoise: { value: noise },
    uTee: { value: new THREE.Vector4(hole.tee.x, hole.tee.z, Math.cos(td), Math.sin(td)) },
    uGreen: { value: new THREE.Vector4(G.x, G.z, Math.cos(G.rot), Math.sin(G.rot)) },
    uPond: { value: ponds }, uPondB: { value: pondsB },
    cRough: { value: col(look.rough) }, cRough2: { value: col(look.rough2) }, cCut: { value: col(look.cut) },
    cFair1: { value: col(look.fair1) }, cFair2: { value: col(look.fair2) }, cFringe: { value: col(look.fringe) },
    cGreen1: { value: col(look.green1) }, cGreen2: { value: col(look.green2) }, cTee1: { value: col(look.tee1) }, cTee2: { value: col(look.tee2) },
    cSand: { value: col(look.sand) }, cSandEdge: { value: col(look.sandEdge) }, cBed: { value: col(look.bed) },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <common>', '#include <common>\nvarying vec3 vWN;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW; varying vec3 vWN; uniform vec3 cRock; uniform vec3 cShallow; uniform vec3 cDeep; uniform float uSea;
        uniform sampler2D uSdf; uniform vec2 uMin; uniform vec2 uSize; uniform sampler2D uZone; uniform vec2 uZMin; uniform vec2 uZSize; uniform vec3 cOut1; uniform vec3 cOut2;
        uniform sampler2D uGrass; uniform sampler2D uSandT; uniform sampler2D uNoise;
        uniform vec4 uTee; uniform vec4 uGreen; uniform vec4 uPond[4]; uniform vec4 uPondB[4];
        uniform vec3 cRough; uniform vec3 cRough2; uniform vec3 cCut; uniform vec3 cFair1; uniform vec3 cFair2; uniform vec3 cFringe;
        uniform vec3 cGreen1; uniform vec3 cGreen2; uniform vec3 cTee1; uniform vec3 cTee2; uniform vec3 cSand; uniform vec3 cSandEdge; uniform vec3 cBed;
        float edge(float d) { float w = max(fwidth(d) * 0.75, 0.025); return smoothstep(-w, w, d); }`)
      .replace('#include <map_fragment>', `
        vec2 suv = (vW.xz - uMin) / uSize;
        float inside = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
        vec4 sd = texture2D(uSdf, clamp(suv, 0.0, 1.0));
        float fm = mix(-${FM}.0, ${FM}.0, sd.r) * inside - 9.0 * (1.0 - inside);
        float sg = mix(-${SG}.0, ${SG}.0, sd.g) * inside - 9.0 * (1.0 - inside);
        float sb = mix(-${SB}.0, ${SB}.0, sd.b) * inside - 9.0 * (1.0 - inside);
        float stripe = sd.a * 2.0 - 1.0;

        // prés et rough : vert profond, grandes nuances
        float m1 = texture2D(uNoise, vW.xz / 170.0).b, m2 = texture2D(uNoise, vW.xz / 41.0).g, m3 = texture2D(uNoise, vW.xz / 9.0).r;
        vec3 col = mix(cRough, cRough2, smoothstep(0.3, 0.75, m1));
        col *= 0.88 + 0.22 * m2;
        // hors jeu : vert sombre, comme les sous-bois
        vec2 zuv = (vW.xz - uZMin) / uZSize;
        float zin = step(0.0, zuv.x) * step(zuv.x, 1.0) * step(0.0, zuv.y) * step(zuv.y, 1.0);
        float outK = mix(1.0, texture2D(uZone, clamp(zuv, 0.0, 1.0)).r, zin);
        col = mix(col, mix(cOut1, cOut2, smoothstep(0.3, 0.75, m1)) * (0.9 + 0.2 * m2), outK);
        float detail = 0.8;
        // première coupe autour du fairway
        float cutK = edge(fm + 2.4);
        col = mix(col, cCut * (0.95 + 0.1 * m3), cutK); detail = mix(detail, 0.55, cutK);
        // fairway : larges bandes de tonte
        float fairK = edge(fm);
        float st = smoothstep(-max(fwidth(stripe), 0.02), max(fwidth(stripe), 0.02), stripe);
        col = mix(col, mix(cFair2, cFair1, st), fairK); detail = mix(detail, 0.42, fairK);
        // départ : rectangle tondu court, bandes serrées
        vec2 tq = vW.xz - uTee.xy;
        float tu = tq.x * uTee.z - tq.y * uTee.w, tv = tq.x * uTee.w + tq.y * uTee.z;
        float tdist = -max(abs(tu) - 4.0, abs(tv - 1.0) - 5.0);
        float teeK = edge(tdist);
        float tst = step(0.5, fract(tv / 2.4));
        col = mix(col, mix(cTee2, cTee1, tst), teeK); detail = mix(detail, 0.35, teeK);
        // avant-green puis green, bandes fines dans l'axe du green
        float frK = edge(sg + 1.7);
        col = mix(col, cFringe, frK); detail = mix(detail, 0.38, frK);
        float gK = edge(sg);
        vec2 gq = vW.xz - uGreen.xy;
        float gu = gq.x * uGreen.z - gq.y * uGreen.w;
        float gs = sin(gu * 6.2832 / 4.4);
        col = mix(col, mix(cGreen2, cGreen1, smoothstep(-0.15, 0.15, gs)), gK); detail = mix(detail, 0.16, gK);
        // ombre de la lèvre autour des bunkers, puis sable clair au bord plus doré
        float lip = (1.0 - smoothstep(0.0, 0.55, -sb)) * (1.0 - edge(sb));
        col *= 1.0 - 0.28 * lip;
        float bK = edge(sb);
        float sgr = texture2D(uSandT, vW.xz / 2.3).r;
        vec3 sandC = mix(cSandEdge, cSand, smoothstep(0.0, 0.7, sb)) * (0.86 + 0.28 * sgr);
        col = mix(col, sandC, bK); detail = mix(detail, 0.0, bK);
        // roche sur les pentes raides : falaises, parois des ravins, berges des étangs
        float rockK = smoothstep(0.8, 0.6, vWN.y);
        float strata = texture2D(uNoise, vec2((vW.x + vW.z) * 0.09, vW.y * 0.55)).r * 0.6 + texture2D(uNoise, vec2((vW.x - vW.z) * 0.31, vW.y * 1.9)).g * 0.4;
        col = mix(col, cRock * (0.72 + 0.5 * strata), rockK); detail = mix(detail, 0.25, rockK);
        // sous la mer : sable turquoise près du bord, bleu profond au large
        float under = uSea - vW.y;
        col = mix(col, mix(cShallow, cDeep, smoothstep(0.4, 6.0, under)), smoothstep(-0.05, 0.25, under));
        // fond des étangs
        for (int i = 0; i < 4; i++) {
          vec2 pq = vW.xz - uPond[i].xy;
          float pu = (pq.x * uPondB[i].x - pq.y * uPondB[i].y) / uPond[i].z, pv = (pq.x * uPondB[i].y + pq.y * uPondB[i].x) / uPond[i].w;
          float near = 1.0 - step(1.8, length(vec2(pu, pv)));
          col = mix(col, cBed, near * smoothstep(uPondB[i].z + 0.1, uPondB[i].z - 0.7, vW.y));
        }
        // grain de l'herbe : deux échelles croisées pour casser la répétition
        float g1 = texture2D(uGrass, vW.xz / 1.7).r;
        float g2 = texture2D(uGrass, mat2(0.8, -0.6, 0.6, 0.8) * vW.xz / 5.3).r;
        col *= 1.0 + ((g1 * 0.62 + g2 * 0.38) - 0.5) * detail * 2.6;
        diffuseColor.rgb *= col;`);
  };
  mat.customProgramCacheKey = () => 'golf-terrain-2';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  mesh.userData.textures = [sdf.tex, zone.tex, grass, sand];
  const map = paintMap(hole, look);
  return { mesh, canvas: map.canvas, area: map.area };
}

// L'eau : étangs, mer et torrents. Bleu vif, vaguelettes animées, éclats de soleil, et reflet du décor
// (rendu miroir partagé `refl`, calculé par la scène pour le plan d'eau le plus proche).
export function buildWater(hole, { noise, envMap, refl }) {
  const group = new THREE.Group();
  const bodies = [];
  const make = (geo, level, { color = 0x2a86e8, opacity = 0.93, flow = null } = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.0, transparent: true, opacity, envMap, envMapIntensity: 1.1 });
    const U = { uT: { value: 0 }, uNoise: { value: noise }, uReflOn: { value: 0 }, uFlow: { value: new THREE.Vector2(flow ? flow[0] : 0, flow ? flow[1] : 0) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, refl);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec4 vRefl; uniform mat4 uReflM;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRefl = uReflM * vec4(vW, 1.0);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vW; varying vec4 vRefl; uniform float uT; uniform sampler2D uNoise; uniform sampler2D uRefl; uniform float uReflOn; uniform vec2 uFlow;
          float wv(vec2 q){ q -= uFlow * uT; return texture2D(uNoise, q / 6.0 + vec2(uT * 0.02, uT * 0.013)).r + texture2D(uNoise, q / 2.3 - vec2(uT * 0.031, -uT * 0.017)).g * 0.7 + texture2D(uNoise, q / 0.9 + vec2(-uT * 0.05, uT * 0.04)).r * 0.35; }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec2 q = vW.xz; float e = 0.25;
          float h0 = wv(q), hx = wv(q + vec2(e, 0.0)), hz = wv(q + vec2(0.0, e));
          vec3 wn = normalize(vec3((h0 - hx) * 2.2, 1.0, (h0 - hz) * 2.2));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= 0.82 + 0.36 * smoothstep(0.6, 1.5, wv(vW.xz));`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          // reflet du décor : plus fort quand on regarde l'eau de biais
          if (uReflOn > 0.5) {
            float fres = 0.2 + 0.6 * pow(1.0 - abs(normalize(cameraPosition - vW).y), 2.0);
            vec4 rp = vRefl; rp.xy += (vec2(wv(vW.xz) - 1.0, wv(vW.xz + 7.0) - 1.0)) * 0.35 * rp.w * 0.06;
            vec3 rc = texture2DProj(uRefl, rp).rgb;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, rc * vec3(0.85, 0.95, 1.05), fres);
          }
          float sp = smoothstep(1.62, 1.85, wv(vW.xz * 1.7 + 3.0));
          gl_FragColor.rgb += vec3(sp) * 0.9;`);
    };
    mat.customProgramCacheKey = () => 'golf-water-3';
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    group.add(m);
    bodies.push({ mesh: m, U, level });
    return m;
  };
  // étangs
  hole.waters.forEach((w, i) => {
    const geo = new THREE.CircleGeometry(1, 72); geo.rotateX(-Math.PI / 2);
    const m = make(geo, hole.waterLv[i]);
    m.scale.set(w.rx * 1.55, 1, w.rz * 1.55); m.rotation.y = w.rot || 0; m.position.set(w.x, hole.waterLv[i], w.z);
    bodies[bodies.length - 1].center = { x: w.x, z: w.z, r: Math.max(w.rx, w.rz) };
  });
  // la mer jusqu'à l'horizon : turquoise, un peu plus transparente pour laisser voir les hauts-fonds
  if (hole.coast) {
    const B = hole.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    const geo = new THREE.CircleGeometry(2900, 96); geo.rotateX(-Math.PI / 2);
    const m = make(geo, hole.coast.level, { color: 0x1aa6d6, opacity: 0.8 });
    m.position.set(cx, hole.coast.level, cz);
    bodies[bodies.length - 1].center = { x: hole.coast.sea[0], z: hole.coast.sea[1], r: 400, sea: true };
  }
  // torrents au fond des ravins : un ruban d'eau qui suit le ravin et s'écoule
  for (const R of hole.ravines) {
    const pts = []; const L = R.line;
    for (let i = 0; i < L.length - 1; i++) {
      const [ax, az] = L[i], [bx, bz] = L[i + 1], len = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < len; d += 4) { const x = ax + (bx - ax) * d / len, z = az + (bz - az) * d / len; if (Math.abs(x - hole.tee.x) < 450 && z > hole.bounds.z0 - 200 && z < hole.bounds.z1 + 200) pts.push([x, z]); }
    }
    if (pts.length < 2) continue;
    const pos = [], idx = [], w = R.w * 0.42;
    let lvSum = 0;
    pts.forEach(([x, z], i) => {
      const [nx, nz] = i < pts.length - 1 ? [pts[i + 1][0] - x, pts[i + 1][1] - z] : [x - pts[i - 1][0], z - pts[i - 1][1]];
      const l = Math.hypot(nx, nz) || 1, sx = -nz / l, sz = nx / l, y = hole.heightAt(x, z) + 0.45;
      lvSum += y;
      pos.push(x + sx * w, y, z + sz * w, x - sx * w, y, z - sz * w);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const dir = [pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]], dl = Math.hypot(...dir) || 1;
    make(geo, lvSum / pts.length, { color: 0x3a9fd8, opacity: 0.9, flow: [dir[0] / dl * 1.6, dir[1] / dl * 1.6] });
    bodies[bodies.length - 1].river = true;
  }
  return {
    group, bodies,
    update(t) { for (const b of bodies) b.U.uT.value = t; },
    // active le reflet sur les plans d'eau au niveau du miroir
    setReflect(level) { for (const b of bodies) b.U.uReflOn.value = level != null && !b.river && Math.abs(b.level - level) < 0.25 ? 1 : 0; },
  };
}

// Bruit de valeur répétable (256²), trois octaves dans R, G et B
export function noiseTexture() {
  const N = 256, data = new Uint8Array(N * N * 4);
  const oct = (cells, seed) => {
    const g = new Float32Array(cells * cells);
    let s = seed; for (let i = 0; i < g.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; g[i] = s / 4294967296; }
    return (x, y) => {
      const fx = x * cells / N, fy = y * cells / N, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[(iy % cells) * cells + (ix % cells)], b = g[(iy % cells) * cells + ((ix + 1) % cells)];
      const c = g[((iy + 1) % cells) * cells + (ix % cells)], d = g[((iy + 1) % cells) * cells + ((ix + 1) % cells)];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  };
  const o = [oct(64, 7), oct(32, 11), oct(16, 13), oct(8, 17), oct(4, 19)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    data[i] = 255 * (0.6 * o[0](x, y) + 0.4 * o[1](x, y));
    data[i + 1] = 255 * (0.55 * o[2](x, y) + 0.45 * o[1](x, y));
    data[i + 2] = 255 * (0.6 * o[4](x, y) + 0.4 * o[3](x, y));
    data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
