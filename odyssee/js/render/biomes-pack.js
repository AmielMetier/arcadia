// odyssee/js/render/biomes-pack.js — les biomes des routes avec un pack de graphismes (Noir & Blanc) : ses tuiles gardent leur
// dessin, leurs verts, leurs terres et leurs bleus prennent les teintes du biome de la case (world/biomes.js). Un seul
// nuanceur, posé sur les matières du sol ; le biome de chaque case est lu dans une texture de la carte.
import * as THREE from 'three';
import { T } from '../world/tiles.js';
import { BIOMES, MER, matiere } from '../world/biomes.js';

// rangées de la palette d'un biome : herbe, hautes herbes, chemin, eau, mousse, feuilles, roche, (massif), neige, cendre
const CLES = ['herbe', 'haute', 'chemin', 'eau', 'mousse', 'feuilles', 'rocher', '', 'neige', 'cendre'], NC = 16;
const DEFAUT = { mousse: ['#173a1e', '#336c32', '#66a248'], feuilles: ['#3f4c1e', '#6e7830', '#c4b85e'], rocher: ['#584048', '#a07858', '#d8a878'], neige: ['#a8bcd4', '#dce8f4', '#ffffff'], cendre: ['#2c2628', '#544a48', '#8a7c74'] };
// la roche des massifs, selon la famille de falaises du biome (b.roche)
const ROCHES = { ocre: ['#6a2c1c', '#b8683c', '#ecac74'], granit: ['#3c3c44', '#74747c', '#b4b4b8'], lune: ['#3a3450', '#6c6488', '#aca4c4'], glace: ['#4a6488', '#8cb0cc', '#e0f0fa'], magma: ['#241a1c', '#54423e', '#8a7468'], terre: ['#4a3428', '#806044', '#b8946c'], mer: ['#4c5460', '#848c94', '#c0c4c4'] };
const U = { uBio: { value: null }, uPal: { value: null }, uBioT: { value: new THREE.Vector2(1, 1) }, uBioO: { value: 0 } };

function palette() {
  const d = new Uint8Array(NC * CLES.length * BIOMES.length * 4);
  BIOMES.forEach((b, n) => CLES.forEach((cle, k) => {
    const R = b && (b[cle] || (cle === 'rocher' && ROCHES[b.roche]) || DEFAUT[cle]);
    for (let i = 0; i < NC; i++) {
      const o = ((n * CLES.length + k) * NC + i) * 4; if (!R) continue;
      const f = i / (NC - 1) * 2, j = Math.min(1, Math.floor(f)), t = f - j, A = parseInt(R[j].slice(1), 16), Z = parseInt(R[j + 1].slice(1), 16);
      for (let c = 0; c < 3; c++) { const s = 16 - c * 8, a = (A >> s) & 255, z = (Z >> s) & 255; d[o + c] = Math.round(a + (z - a) * t); }
      d[o + 3] = 255;
    }
  }));
  const t = new THREE.DataTexture(d, NC, CLES.length * BIOMES.length, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
let map = null;
/** la carte affichée : sa texture des biomes (R : biome et MER, G : 1 hautes herbes, 4 mousse, 5 feuilles, 6 roche, 7 massif, 8 neige, 9 cendre) */
export function carteBiomes(m) {
  const b = m.base || m; if (!b.biomes) { U.uBioO.value = 0; map = null; return; }
  U.uPal.value ||= palette(); U.uBioO.value = 1;
  if (map === b) return; map = b;
  U.uBio.value?.dispose();
  const d = new Uint8Array(b.w * b.h * 2), M = { mousse: 4, feuilles: 5, roche: 6, neige: 8, cendre: 9 };
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = y * b.w + x, n = b.biomes[i]; d[i * 2] = n; if (!n) continue;
    const t = b.t[i]; d[i * 2 + 1] = t === T.TALL || t === T.DARKTALL ? 1 : t === T.WATER || t === T.BRIDGE || t === T.WHIRL ? 2 : t === T.PATH || t === T.DOOR ? 3 : t === T.CAVEWALL ? 7 : M[matiere(n & 31, x, y)] || 0;
  }
  const tex = U.uBio.value = new THREE.DataTexture(d, b.w, b.h, THREE.RGFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true; U.uBioT.value.set(b.w, b.h);
}
/** pose le nuanceur des biomes sur une matière du sol */
export function matBiome(mat) {
  const avant = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    avant?.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vBioP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBioP = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vBioP; uniform sampler2D uBio, uPal; uniform vec2 uBioT; uniform float uBioO;
vec3 bioTon(float n, float k, float l) { return texture2D(uPal, vec2((floor(clamp(l, 0.0, 0.999) * ${NC}.0) + 0.5) / ${NC}.0, (n * ${CLES.length}.0 + k + 0.5) / ${(CLES.length * BIOMES.length).toFixed(1)})).rgb; }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  if (uBioO > 0.5) {
    // le pixel du sol (16 par case), et la limite des biomes qui ondule d'une à deux cases
    vec2 bp = (floor(vBioP * 16.0) + 0.5) / 16.0;
    vec2 bw = bp + vec2(sin(bp.y * 0.9 + sin(bp.x * 0.4) * 2.0) + 0.5 * sin(bp.y * 2.7 + bp.x), sin(bp.x * 0.8 + sin(bp.y * 0.5) * 2.0) + 0.5 * sin(bp.x * 2.9 - bp.y)) * 0.8;
    float brut = floor(texture2D(uBio, (floor(bw) + 0.5) / uBioT).r * 255.0 + 0.5);
    float mer = step(${MER}.0 - 0.5, brut), n = brut - mer * ${MER}.0;
    if (n > 0.5) {
      float kind = floor(texture2D(uBio, (floor(bp) + 0.5) / uBioT).g * 255.0 + 0.5);
      if (kind < 0.5 || (kind > 3.5 && kind != 7.0)) { kind = floor(texture2D(uBio, (floor(bw) + 0.5) / uBioT).g * 255.0 + 0.5); if (kind < 3.5 || kind == 7.0) kind = 0.0; }   // les plaques de matière ondulent aussi
      vec3 c = pow(max(diffuseColor.rgb, 0.0), vec3(0.4545));
      float l = dot(c, vec3(0.3, 0.59, 0.11)), mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = mx - mn;
      if (kind > 0.5 && kind < 1.5 && !(c.r > c.g && c.g > c.b && sat > 0.15)) {   // (le sable sous une touffe garde sa couleur)
        // hautes herbes : toute la touffe (contours compris) prend l'herbe du biome, un ton plus sombre que le sol, comme
        // dans Noir 2 / Blanc 2 ; la rampe « haute » des biomes colorés (rose, or, lavande) changeait la ligne claire du
        // haut de chaque tuile en bande de couleur, et la touffe paraissait mal détourée
        vec3 t = bioTon(n, 0.0, (l - 0.28) / 0.55); if (dot(t, vec3(1.0)) > 0.0) diffuseColor.rgb = t;   // (même teinte que le sol : le fond de la tuile se raccorde)
      } else if (kind == 7.0) {
        // un massif : son herbe prend l'herbe du biome, sa roche la roche du biome
        bool vert = c.g > c.r * 1.12 && c.g > c.b * 1.12 && sat > 0.16;
        diffuseColor.rgb = vert ? bioTon(n, 0.0, (l - 0.28) / 0.55) : bioTon(n, 6.0, (l - 0.1) / 0.62);
      } else if (sat > 0.06) {
        if (kind > 2.5 && kind < 3.5 && c.g < c.r * 1.1 && c.r > c.b) {
          vec3 t = bioTon(n, 2.0, (l - 0.3) / 0.6); if (dot(t, vec3(1.0)) > 0.0) diffuseColor.rgb = t;
        } else if (kind > 1.5 && kind < 2.5 ? c.g >= c.r * 1.02 && c.g > c.b : c.g >= c.r * 1.02 && c.b < c.g * 1.2) {
          float k = kind < 0.5 ? 0.0 : kind < 1.5 ? 1.0 : kind > 3.5 ? kind : 0.0;
          vec3 t = bioTon(n, k, kind > 0.5 && kind < 1.5 ? (l - 0.22) / 0.5 : (l - 0.28) / 0.55); if (dot(t, vec3(1.0)) > 0.0) diffuseColor.rgb = t;
        } else if (kind > 1.5 && kind < 2.5 && c.b > c.r * 1.1) {
          if (mer < 0.5) { vec3 t = bioTon(n, 3.0, (l - 0.25) / 0.6); if (dot(t, vec3(1.0)) > 0.0) diffuseColor.rgb = t; }
        } else if (c.r > c.g && c.g > c.b && (sat < 0.5 || (kind > 2.5 && kind < 3.5))) {
          vec3 t = bioTon(n, 2.0, (l - 0.3) / 0.6); if (dot(t, vec3(1.0)) > 0.0) diffuseColor.rgb = t;
        }
      }
    }
  }`);
  };
  const cle = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => 'bio' + (avant && cle ? cle() : '');
  return mat;
}
