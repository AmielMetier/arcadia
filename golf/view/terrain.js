// Birdie Party — le sol : un seul maillage (fin sur le parcours, de plus en plus lâche vers l'horizon) et un shader
// qui peint l'herbe. Plutôt qu'une image des couleurs (floue de près), on stocke dans une texture les distances
// aux bords — fairway, green, bunkers — et l'avancée le long du trou (bandes de tonte) : le shader en tire des bords
// nets à toute distance, puis ajoute le grain de l'herbe (texture de brins) et les nuances des prés.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { grassTexture, sandTexture } from './textures.js';

// couleurs naturelles (rendu AgX) : herbes tondues claires, rough olive, sous-bois très sombre hors du jeu
export const LOOKS = {
  campagne: {
    rough: 0x44702a, rough2: 0x6a7d34, cut: 0x52802e, fair1: 0x6c9a3a, fair2: 0x5f8d32, fringe: 0x66953a,
    green1: 0x78a542, green2: 0x6f9c3c, tee1: 0x6c9a3a, tee2: 0x608e33, sand: 0xe2d2a3, sandEdge: 0xc4ad7a, bed: 0x34442a,
    out1: 0x14290d, out2: 0x1d3613, rock: 0xb0a897, shallow: 0x5fb3a8, deep: 0x0f4566,
  },
  mer: {
    rough: 0x4c7a2c, rough2: 0x7a8638, cut: 0x5a8a30, fair1: 0x74a23c, fair2: 0x669434, fringe: 0x6e9d3b,
    green1: 0x7fac45, green2: 0x76a33f, tee1: 0x74a23c, tee2: 0x669434, sand: 0xeadcb2, sandEdge: 0xcdb888, bed: 0x3a5a48,
    out1: 0x172f0f, out2: 0x213d15, rock: 0xbfa883, shallow: 0x58c2b6, deep: 0x0b4f78,
  },
  montagne: {
    rough: 0x3d6a2a, rough2: 0x5f7436, cut: 0x4b7a2e, fair1: 0x649438, fair2: 0x578731, fringe: 0x5e8f37,
    green1: 0x70a043, green2: 0x67963d, tee1: 0x649438, tee2: 0x578731, sand: 0xd9cba2, sandEdge: 0xbba878, bed: 0x2f4034,
    out1: 0x10240c, out2: 0x183012, rock: 0x7d786f, shallow: 0x6fb0aa, deep: 0x1d4a60,
  },
  // désert : fairway irrigué, première coupe vert olive, puis le sable tassé ; hors-limites en terre rouge
  desert: {
    rough: 0xc49a62, rough2: 0xb0844f, cut: 0x7c8a3a, fair1: 0x6f9a3a, fair2: 0x628c33, fringe: 0x6a9338,
    green1: 0x78a542, green2: 0x6f9c3c, tee1: 0x6f9a3a, tee2: 0x628c33, sand: 0xecd6a2, sandEdge: 0xcfb07a, bed: 0x5a5a3a,
    out1: 0x8a5232, out2: 0x9c6038, rock: 0xb4674a, shallow: 0x4fb6a8, deep: 0x125a66,
  },
};

const PX = 0.5;        // mètres par texel de la carte des distances
const FM = 6, SG = 6, SB = 3, STRIPE = 22; // plages des distances encodées (m) et période des bandes de tonte (m)

// Carte des distances : R fairway, G green, B bunker (signées, positives dedans), A bandes de tonte.
// pace() rend la main au navigateur de temps en temps (calcul en tâche de fond).
async function distanceMap(hole, pace) {
  const B = hole.bounds, M = 70;
  const area = { x0: B.x0 - M, z0: B.z0 - M, x1: B.x1 + M, z1: B.z1 + M };
  const W = Math.ceil((area.x1 - area.x0) / PX), H = Math.ceil((area.z1 - area.z0) / PX);
  const data = new Uint8Array(W * H * 4);
  const G = hole.green, rG = Math.min(G.rx, G.rz);
  const enc = (v, r) => Math.round(255 * Math.min(1, Math.max(0, (v + r) / (2 * r))));
  for (let j = 0; j < H; j++) {
    await pace();
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
async function zoneMap(hole, pace) {
  const B = hole.bounds, M = 260, P = 2;
  const area = { x0: B.x0 - M, z0: B.z0 - M, x1: B.x1 + M, z1: B.z1 + M };
  const W = Math.ceil((area.x1 - area.x0) / P), H = Math.ceil((area.z1 - area.z0) / P);
  const data = new Uint8Array(W * H * 4);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < H; j++) {
    await pace();
    const z = area.z0 + (j + 0.5) * P;
    for (let i = 0; i < W; i++) {
      const x = area.x0 + (i + 0.5) * P;
      const k = Math.max(smooth(4, -10, hole.landSD(x, z)), smooth(-6, 6, hole.obDist(x, z)));
      data[(j * W + i) * 4] = Math.round(k * 255);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  return { tex, area };
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

export async function buildTerrain(hole, { look, noise, anisotropy = 8, step = 1.25, pace = async () => {} } = {}) {
  const B = hole.bounds;
  const xs = axis(B.x0 - 40, B.x1 + 40, step, 1600), zs = axis(B.z0 - 40, B.z1 + 40, step, 1600);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    await pace();
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3, x = xs[i], z = zs[j];
      pos[k] = x; pos[k + 1] = hole.heightAt(x, z); pos[k + 2] = z;
    }
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

  await pace();
  const sdf = await distanceMap(hole, pace), zone = await zoneMap(hole, pace);
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
        // (seulement sur le parcours : au loin, les collines restent boisées)
        float rockK = smoothstep(0.8, 0.6, vWN.y) * zin;
        // projections sur les plans verticaux (pas d'étirement sur les parois)
        vec3 bw = abs(vWN); bw /= (bw.x + bw.y + bw.z);
        float rn1 = texture2D(uNoise, vW.zy * 0.07).r * bw.x + texture2D(uNoise, vW.xy * 0.07).r * bw.z + texture2D(uNoise, vW.xz * 0.07).r * bw.y;
        float rn2 = texture2D(uNoise, vW.zy * 0.23).g * bw.x + texture2D(uNoise, vW.xy * 0.23).g * bw.z + texture2D(uNoise, vW.xz * 0.23).g * bw.y;
        float rn3 = texture2D(uNoise, vW.zy * 0.9).r * bw.x + texture2D(uNoise, vW.xy * 0.9).r * bw.z + texture2D(uNoise, vW.xz * 0.9).r * bw.y;
        float crack = smoothstep(0.08, 0.0, abs(rn2 - 0.5)) * 0.8;
        vec3 rockC = cRock * (0.62 + 0.55 * rn1) * (0.85 + 0.3 * rn3) * (1.0 - 0.45 * crack);
        col = mix(col, rockC, rockK); detail = mix(detail, 0.3, rockK);
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
        diffuseColor.rgb *= col;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // relief fin de l'herbe : la lumière accroche les brins (s'efface au loin)
          vec2 gq = vW.xz / 1.7; float ge = 1.0 / 512.0;
          float g0 = texture2D(uGrass, gq).r, gx = texture2D(uGrass, gq + vec2(ge, 0.0)).r, gz = texture2D(uGrass, gq + vec2(0.0, ge)).r;
          float fade = 1.0 - smoothstep(20.0, 90.0, length(vW - cameraPosition));
          vec3 dn = vec3(g0 - gx, 0.0, g0 - gz) * 2.6 * detail * fade;
          normal = normalize(normal + (viewMatrix * vec4(dn, 0.0)).xyz);
        }`);
  };
  mat.customProgramCacheKey = () => 'golf-terrain-5';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  mesh.userData.textures = [sdf.tex, zone.tex, grass, sand];
  return { mesh, uniforms: U };
}

// Mini-carte en relief, vue du dessus et sans lumière : teintes d'altitude, estompage éclairé depuis le haut à gauche
// de la carte, courbes de niveau (une ligne maîtresse sur cinq) et, sur le green, des courbes très serrées pour lire
// la pente. Le parcours reste lisible : fairway, départ, green et bunkers en aplats clairs détourés.
export function reliefMaterial(U, { hMin, hMax, step, light }) {
  const col = (h) => new THREE.Color(h);
  const R = {
    uSdf: U.uSdf, uMin: U.uMin, uSize: U.uSize, uTee: U.uTee, uGreen: U.uGreen, uSea: U.uSea,
    uH: { value: new THREE.Vector2(hMin, Math.max(hMin + 1, hMax)) }, uStep: { value: step }, uLight: { value: light },
    cLow: { value: col(0x6fa65c) }, cMid: { value: col(0xb9cf7f) }, cHigh: { value: col(0xd9c48e) }, cTop: { value: col(0xb18a63) },
    cFair: { value: col(0xd3eba4) }, cGreen: { value: col(0xa6df7c) }, cSand: { value: col(0xf1e2b0) }, cSea: { value: col(0x5ba8da) },
    cLine: { value: col(0x3b4a2c) }, cEdge: { value: col(0xfbfdf2) },
  };
  return new THREE.ShaderMaterial({
    uniforms: R,
    vertexShader: `varying vec3 vW; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW; varying vec3 vN;
      uniform sampler2D uSdf; uniform vec2 uMin; uniform vec2 uSize; uniform vec4 uTee; uniform vec4 uGreen; uniform float uSea;
      uniform vec2 uH; uniform float uStep; uniform vec3 uLight;
      uniform vec3 cLow; uniform vec3 cMid; uniform vec3 cHigh; uniform vec3 cTop; uniform vec3 cFair; uniform vec3 cGreen; uniform vec3 cSand; uniform vec3 cSea; uniform vec3 cLine; uniform vec3 cEdge;
      float edge(float d) { float w = max(fwidth(d) * 0.75, 0.02); return smoothstep(-w, w, d); }
      // ligne fine d'un pixel environ sur chaque multiple de 'k'
      float iso(float v, float k, float px) { float c = v / k; float d = abs(fract(c + 0.5) - 0.5) / max(fwidth(c), 1e-4); return 1.0 - smoothstep(px * 0.5, px * 0.5 + 1.0, d); }
      void main(){
        float t = clamp((vW.y - uH.x) / (uH.y - uH.x), 0.0, 1.0);
        vec3 c = t < 0.4 ? mix(cLow, cMid, t / 0.4) : t < 0.75 ? mix(cMid, cHigh, (t - 0.4) / 0.35) : mix(cHigh, cTop, (t - 0.75) / 0.25);
        vec2 suv = (vW.xz - uMin) / uSize;
        float inside = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
        vec4 sd = texture2D(uSdf, clamp(suv, 0.0, 1.0));
        float fm = mix(-${FM}.0, ${FM}.0, sd.r) * inside - 9.0 * (1.0 - inside);
        float sg = mix(-${SG}.0, ${SG}.0, sd.g) * inside - 9.0 * (1.0 - inside);
        float sb = mix(-${SB}.0, ${SB}.0, sd.b) * inside - 9.0 * (1.0 - inside);
        vec2 tq = vW.xz - uTee.xy;
        float tu = tq.x * uTee.z - tq.y * uTee.w, tv = tq.x * uTee.w + tq.y * uTee.z;
        float tdist = -max(abs(tu) - 4.0, abs(tv - 1.0) - 5.0);
        float fK = edge(fm), gK = edge(sg + 0.6), bK = edge(sb), teeK = edge(tdist);
        c = mix(c, mix(c, cFair, 0.7), fK);
        c = mix(c, cFair, teeK);
        c = mix(c, cGreen, gK);
        c = mix(c, cSand, bK);
        // estompage
        float sh = clamp(dot(normalize(vN), uLight), 0.0, 1.0);
        c *= 0.62 + 0.55 * sh;
        // mer
        float under = uSea - vW.y;
        c = mix(c, cSea * (1.0 - 0.25 * smoothstep(0.5, 6.0, under)), smoothstep(-0.05, 0.15, under));
        // courbes de niveau : une maîtresse toutes les cinq ; sur le green, une tous les 15 cm
        float minor = iso(vW.y, uStep, 1.0), major = iso(vW.y, uStep * 5.0, 1.8);
        float fine = iso(vW.y, 0.15, 1.0) * gK;
        float land = 1.0 - smoothstep(-0.05, 0.15, under);
        c = mix(c, cLine, (max(minor * 0.28, major * 0.55) * (1.0 - gK) + fine * 0.45) * land);
        // contours clairs du parcours
        float outl = max(max(iso(fm, 100.0, 1.6) * step(-1.0, fm) * step(fm, 1.0), iso(sg + 0.6, 100.0, 1.6) * step(-1.6, sg) * step(sg, 0.4)), iso(sb, 100.0, 1.4) * step(-1.0, sb) * step(sb, 1.0));
        c = mix(c, cEdge, outl * 0.9 * land);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// L'eau : étangs, mer et torrents. Bleu vif, vaguelettes animées, éclats de soleil, et reflet du décor
// (rendu miroir partagé `refl`, calculé par la scène pour le plan d'eau le plus proche).
export function buildWater(hole, { noise, envMap, refl, sun }) {
  const group = new THREE.Group();
  const bodies = [];
  const make = (geo, level, { color = 0x2b5b66, opacity = 0.9, flow = null } = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.0, transparent: true, opacity, envMap, envMapIntensity: 1.1 });
    const U = { uT: { value: 0 }, uNoise: { value: noise }, uReflOn: { value: 0 }, uSun: { value: sun.clone() }, uFlow: { value: new THREE.Vector2(flow ? flow[0] : 0, flow ? flow[1] : 0) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, refl);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec4 vRefl; uniform mat4 uReflM;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRefl = uReflM * vec4(vW, 1.0);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vW; varying vec4 vRefl; uniform float uT; uniform sampler2D uNoise; uniform sampler2D uRefl; uniform float uReflOn; uniform vec2 uFlow; uniform vec3 uSun;
          float wv(vec2 q){ q -= uFlow * uT; return texture2D(uNoise, q / 5.0 + vec2(uT * 0.018, uT * 0.012)).r * 0.75 + texture2D(uNoise, q / 1.8 - vec2(uT * 0.028, -uT * 0.016)).g * 0.35; }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec2 q = vW.xz; float e = 0.25;
          float h0 = wv(q), hx = wv(q + vec2(e, 0.0)), hz = wv(q + vec2(0.0, e));
          vec3 wn = normalize(vec3((h0 - hx) * 0.75, 1.0, (h0 - hz) * 0.75));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= 1.0;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          // reflet du décor : plus fort quand on regarde l'eau de biais
          if (uReflOn > 0.5) {
            float fres = 0.38 + 0.58 * pow(1.0 - abs(normalize(cameraPosition - vW).y), 3.0);
            vec4 rp = vRefl; rp.xy += wn.xz * rp.w * 0.014;
            vec3 rc = texture2DProj(uRefl, rp).rgb;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, rc * vec3(0.85, 0.95, 1.05), fres);
          }
          // reflet du soleil sur les vaguelettes
          vec3 Vd = normalize(cameraPosition - vW), Rf = reflect(-Vd, wn);
          float sd = max(dot(Rf, normalize(uSun)), 0.0);
          gl_FragColor.rgb += vec3(1.0, 0.94, 0.82) * (pow(sd, 700.0) * 9.0 + pow(sd, 48.0) * 0.18);
          // écume là où le torrent dévale une pente
          float ny = normalize(cross(dFdx(vW), dFdy(vW))).y;
          float foam = smoothstep(0.995, 0.93, abs(ny)) * smoothstep(0.45, 0.75, wv(vW.xz * 2.3 + 11.0));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.92, 0.95, 0.97), foam * 0.85);`);
    };
    mat.customProgramCacheKey = () => 'golf-water-7';
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
    const m = make(geo, hole.coast.level, { color: 0x15758f, opacity: 0.78 });
    m.position.set(cx, hole.coast.level, cz);
    bodies[bodies.length - 1].center = { x: hole.coast.sea[0], z: hole.coast.sea[1], r: 400, sea: true };
  }
  // torrents au fond des ravins : un ruban d'eau qui suit le ravin et s'écoule
  for (const R of hole.ravines) {
    if (R.dry) continue; // canyon sec : pas de torrent
    const pts = []; const L = R.line;
    for (let i = 0; i < L.length - 1; i++) {
      const [ax, az] = L[i], [bx, bz] = L[i + 1], len = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < len; d += 3) { const x = ax + (bx - ax) * d / len, z = az + (bz - az) * d / len; if (x > hole.bounds.x0 - 120 && x < hole.bounds.x1 + 120 && z > hole.bounds.z0 - 120 && z < hole.bounds.z1 + 120) pts.push([x, z]); }
    }
    if (pts.length < 2) continue;
    const pos = [], idx = [], w = R.w * 0.36;
    let lvSum = 0;
    pts.forEach(([x, z], i) => {
      const [nx, nz] = i < pts.length - 1 ? [pts[i + 1][0] - x, pts[i + 1][1] - z] : [x - pts[i - 1][0], z - pts[i - 1][1]];
      const l = Math.hypot(nx, nz) || 1, sx = -nz / l, sz = nx / l, y = hole.heightAt(x, z) + 1.5;
      lvSum += y;
      pos.push(x + sx * w, y, z + sz * w, x - sx * w, y, z - sz * w);
      // triangles tournés vers le ciel
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const dir = [pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]], dl = Math.hypot(...dir) || 1;
    const m = make(geo, lvSum / pts.length, { color: 0x3a7a8c, opacity: 0.92, flow: [dir[0] / dl * 1.6, dir[1] / dl * 1.6] });
    m.material.side = THREE.DoubleSide;
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
