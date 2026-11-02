// Le sol vu du ciel : la vraie île d'Island Rush (relief, routes, bâtiments, arbres), repeinte façon photo aérienne,
// entourée d'une mer et d'une terre de décor dessinées par un seul shader.
// Aucune copie du générateur : si l'île change dans Island Rush, Dogfight suit tout seul.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GR, CELL, STOREY } from '../../royale/engine/map.js';
import { terrainImage, drawMap } from '../../royale/view/maprender.js';
import { HAZE, FOG_DENSITY, noiseData, hash } from './sky.js';

const TEX = 2048;
const FIELD_PALETTE = [0x8d9150, 0xa79c5f, 0x6e7e45, 0xb6a86c, 0x7b8a4d, 0x97864f, 0x5e7040, 0xab905a, 0x7f7f4c].map((h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255]);
const cellHash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

// Les plaines deviennent des parcelles agricoles, avec haies et sillons
function paintFields(relief, map, grain) {
  const ctx = relief.getContext('2d'), W = relief.width, img = ctx.getImageData(0, 0, W, W), px = img.data, scale = map.size / W;
  const baseL = 0.3 * 0x8d + 0.59 * 0xbd + 0.11 * 0x52;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const wx = (x + 0.5) * scale, wz = (y + 0.5) * scale;
    if (map.groundAt(wx, wz) !== GR.PLAINE) continue;
    const k = (y * W + x) * 4, th = (cellHash(Math.floor(wx / 300) + 91, Math.floor(wz / 300) - 37) % 1000) / 1000 * 1.57, c = Math.cos(th), s = Math.sin(th);
    const u = wx * c + wz * s, w = -wx * s + wz * c, iu = Math.floor(u / 62), iw = Math.floor(w / 41), hh = cellHash(iu, iw), fu = u / 62 - iu, fw = w / 41 - iw;
    const p = FIELD_PALETTE[hh % FIELD_PALETTE.length], shade = Math.max(0.62, Math.min(1.25, (0.3 * px[k] + 0.59 * px[k + 1] + 0.11 * px[k + 2]) / baseL));
    const stripe = 0.965 + 0.035 * Math.sin((hh % 2 ? u : w) * 1.9), g = 0.94 + 0.12 * grain[(y % 256) * 256 + (x % 256)];
    const eu = Math.min(fu, 1 - fu) * 62, ew = Math.min(fw, 1 - fw) * 41, hedge = (eu < 1.5 && (hh >> 4) % 3) || (ew < 1.5 && (hh >> 6) % 3);
    const q = hedge ? [52, 66, 38] : p, f = shade * (hedge ? 1 : stripe * g);
    px[k] = q[0] * f; px[k + 1] = q[1] * f; px[k + 2] = q[2] * f;
  }
  ctx.putImageData(img, 0, 0);
}

// Longues ombres d'arbres et de bâtiments, peintes une fois pour toutes selon le soleil
function paintShadows(ctx, map, sun, k) {
  const h = Math.hypot(sun.x, sun.z), L = h / sun.y, dx = -sun.x / h, dz = -sun.z / h, ang = Math.atan2(dz, dx);
  ctx.save(); ctx.scale(k, k); ctx.fillStyle = 'rgba(16,24,18,.5)';
  for (const p of map.props) {
    if (p.kind !== 'arbre' && p.kind !== 'sapin') continue;
    const l = 9 * p.s * L;
    ctx.beginPath(); ctx.ellipse(p.x + dx * l * 0.5, p.z + dz * l * 0.5, l * 0.55, 2.8 * p.s, ang, 0, 6.283); ctx.fill();
  }
  ctx.fillStyle = 'rgba(16,22,26,.16)';
  for (const b of map.buildings) { const l = b.floors * STOREY * L; for (let t = 1; t <= 6; t++) ctx.fillRect(b.x0 * CELL + dx * l * t / 6, b.z0 * CELL + dz * l * t / 6, b.w * CELL, b.d * CELL); }
  ctx.restore();
}

// Étalonnage : couleurs sourdes, routes moins blanches
function grade(ctx) {
  const im = ctx.getImageData(0, 0, TEX, TEX), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], l = 0.3 * r + 0.59 * g + 0.11 * b, water = b > g && b > r, sat = water ? 0.62 : 0.66;
    let R = l + (r - l) * sat, G = l + (g - l) * sat, B = l + (b - l) * sat;
    if (!water) { const k = l > 165 ? 0.72 : 1; R *= 0.93 * k; G *= 0.92 * k; B *= 0.8 * k; } else { R *= 0.9; G *= 0.95; B *= 0.92; }
    d[i] = R; d[i + 1] = G; d[i + 2] = B;
  }
  ctx.putImageData(im, 0, 0);
}

export function paintIsland(map, sun) {
  const grain = noiseData();
  const relief = terrainImage(map, { ppm: 1 });
  paintFields(relief, map, grain);
  const cv = document.createElement('canvas'); cv.width = cv.height = TEX;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  drawMap(ctx, map, relief, { x: map.size / 2, z: map.size / 2, s: TEX / map.size, w: TEX, h: TEX, dpr: 1 }, { layers: { relief: true, routes: true, batiments: true, vegetation: false, vehicules: false, coffres: false, butin: false, noms: false, grille: false, tempete: false, vol: false }, level: 0 });
  paintShadows(ctx, map, sun, TEX / map.size);
  grade(ctx);
  return cv;
}

const GROUND_FRAGMENT = `varying vec2 vU; varying vec3 vW; uniform sampler2D uMap, uN; uniform vec3 uSun, uHaze, uCam, uDeep; uniform float uTex, uFogD;
float fb(vec2 p){ return texture2D(uN,p).r*.6+texture2D(uN,p*2.3+.17).r*.3+texture2D(uN,p*5.1+.41).r*.1; }
float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec3 lin(vec3 c){ return pow(c,vec3(2.2)); }
float landMask(vec2 w){ vec2 q=w-800.; return smoothstep(-.012,.012,(length(q)-1520.)/4200.+(fb(w/9000.)-.47)*.9); }
vec3 farLand(vec2 w){ vec2 rg=floor(w/2600.); float th=hs(rg)*1.57,ca=cos(th),sa=sin(th); vec2 u=vec2(w.x*ca+w.y*sa,-w.x*sa+w.y*ca); vec2 cell=vec2(150.,105.); vec2 id=floor(u/cell),fr=u/cell-id; float h=hs(id+rg*7.);
  vec3 c=h<.2?lin(vec3(.55,.57,.31)):h<.4?lin(vec3(.65,.61,.37)):h<.58?lin(vec3(.43,.49,.27)):h<.74?lin(vec3(.71,.66,.42)):h<.88?lin(vec3(.48,.54,.3)):lin(vec3(.59,.52,.31)); vec3 avg=lin(vec3(.54,.55,.32)); c*=.92+.16*texture2D(uN,w*.009).r;
  float fw=max(fwidth(u.x)/cell.x,fwidth(u.y)/cell.y); float e=min(min(fr.x,1.-fr.x)*cell.x,min(fr.y,1.-fr.y)*cell.y); c=mix(c,lin(vec3(.2,.26,.15)),(1.-smoothstep(1.5,3.5,e))*step(.35,hs(id*1.3))*(1.-smoothstep(.02,.1,fw))); c=mix(c,avg,smoothstep(.2,.9,fw));
  float fo=fb(w/1500.+.3); c=mix(c,lin(vec3(.15,.22,.13))*(.75+.5*texture2D(uN,w*.021).r),smoothstep(.54,.57,fo)); float vil=smoothstep(.72,.75,fb(w/640.+.7)); c=mix(c,lin(vec3(.58,.5,.44)),vil*.65); return c; }
void main(){
  float lm=uTex>.5?0.:landMask(vW.xz); vec3 c=uTex>.5?texture2D(uMap,vU).rgb:uDeep; float wm=uTex<.5?1.-smoothstep(.35,.65,lm):smoothstep(1.,1.07,c.b/max(c.g,.001));
  vec3 V=normalize(uCam-vW); float d=length(uCam-vW);
  if(uTex<.5&&lm>0.) c=mix(c,farLand(vW.xz),lm);
  if(uTex>.5) c*=mix(.86+.28*texture2D(uN,vW.xz*.021).r,1.,wm);
  if(wm>0.){ vec2 p=vW.xz*.012; float n1=texture2D(uN,p).r-.5,n2=texture2D(uN,p*3.1+.3).r-.5; vec3 N=normalize(vec3((n1+n2*.5)*.09,1.,(n2+n1*.4)*.09)); float fr=pow(1.-max(dot(N,V),0.),3.5);
    vec3 R=reflect(-V,N); vec3 skyc=mix(uHaze,vec3(.13,.3,.55),smoothstep(0.,.5,R.y)); c=mix(c,skyc,(.12+.8*fr)*wm); c+=vec3(1.,.93,.8)*pow(max(dot(R,uSun),0.),260.)*1.6*wm; }
  float f=1.-exp(-pow(d*uFogD,1.45)); float sa=pow(max(dot(-V,uSun),0.),6.); vec3 h=mix(uHaze,vec3(1.,.93,.84),sa*.4); c=mix(c,h,f);
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const GROUND_VERTEX = `varying vec2 vU; varying vec3 vW; void main(){ vU=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;

function buildBuildings(map) {
  const P = [], C = [], col = new THREE.Color();
  const quad = (a, b, c, d, cc) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) C.push(cc.r, cc.g, cc.b); };
  const WALL = { pierre: 0xbdb6a6, bois: 0x8a7458, metal: 0x8f999d }, ROOF = { pente: { pierre: 0x9c5a46, bois: 0x6f5340, metal: 0x707f88 }, plat: { pierre: 0x9d9c97, bois: 0x8f7a60, metal: 0x88949b } };
  for (const b of map.buildings) {
    const x0 = b.x0 * CELL, z0 = b.z0 * CELL, x1 = (b.x0 + b.w) * CELL, z1 = (b.z0 + b.d) * CELL, y0 = b.y - 1, y1 = b.y + b.floors * STOREY;
    const w = col.clone().setHex(WALL[b.mat] ?? 0xbdb6a6), r = col.clone().setHex((ROOF[b.roof] || ROOF.pente)[b.mat] ?? 0x9c5a46);
    const A = [x0, y1, z0], B = [x1, y1, z0], Cc = [x1, y1, z1], D = [x0, y1, z1], a = [x0, y0, z0], bb = [x1, y0, z0], c = [x1, y0, z1], d = [x0, y0, z1];
    quad(a, A, B, bb, w); quad(bb, B, Cc, c, w); quad(c, Cc, D, d, w); quad(d, D, A, a, w);
    if (b.roof === 'plat') quad(D, Cc, B, A, r);
    else {
      const rh = Math.min(x1 - x0, z1 - z0) * 0.35;
      if (x1 - x0 > z1 - z0) { const zm = (z0 + z1) / 2, E = [x0, y1 + rh, zm], F = [x1, y1 + rh, zm]; quad(A, E, F, B, r); quad(D, Cc, F, E, r); }
      else { const xm = (x0 + x1) / 2, E = [xm, y1 + rh, z0], F = [xm, y1 + rh, z1]; quad(A, D, F, E, r); quad(B, E, F, Cc, r); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

function buildTrees(map) {
  const group = new THREE.Group(), meshes = [];
  const make = (kinds, geo, palette) => {
    const list = map.props.filter((p) => kinds.includes(p.kind));
    const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length), o = new THREE.Object3D(), cc = new THREE.Color();
    list.forEach((p, i) => { o.position.set(p.x, map.heightAt(p.x, p.z), p.z); o.scale.setScalar(p.s * (0.9 + hash(i, 3) * 0.5)); o.rotation.y = i; o.updateMatrix(); im.setMatrixAt(i, o.matrix); cc.setHex(palette[i % palette.length]); im.setColorAt(i, cc); });
    im.frustumCulled = false; group.add(im); meshes.push({ im, n: list.length });
  };
  const leafy = new THREE.IcosahedronGeometry(3.6, 0); leafy.scale(1, 1.15, 1); leafy.translate(0, 5, 0);
  const pine = new THREE.ConeGeometry(2.7, 10, 5); pine.translate(0, 5.5, 0);
  make(['arbre'], leafy, [0x35492a, 0x41552f, 0x2e4228, 0x4a5c33]);
  make(['sapin'], pine, [0x263a29, 0x2c4030]);
  group.setDensity = (f) => { for (const m of meshes) m.im.count = Math.floor(m.n * f); };
  return group;
}

export function buildGround(scene, map, sun, noiseTex, anisotropy = 8) {
  const canvas = paintIsland(map, sun);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = anisotropy; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  const shared = { uMap: { value: tex }, uN: { value: noiseTex }, uSun: { value: sun }, uHaze: { value: HAZE }, uCam: { value: new THREE.Vector3() }, uDeep: { value: new THREE.Color(0x24506e) }, uFogD: { value: FOG_DENSITY } };
  const islandMat = new THREE.ShaderMaterial({ uniforms: { ...shared, uTex: { value: 1 } }, fog: false, vertexShader: GROUND_VERTEX, fragmentShader: GROUND_FRAGMENT });
  const seaMat = new THREE.ShaderMaterial({ uniforms: { ...shared, uTex: { value: 0 } }, fog: false, vertexShader: GROUND_VERTEX, fragmentShader: GROUND_FRAGMENT });

  // relief : une grille régulière, l'eau à plat à son niveau
  const N = map.n, H = map.heights, W = map.water, WL = map.waterLevel, STEP = 4;
  const n = Math.floor((N - 1) / STEP) + 1, pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++, k++) {
    const q = j * STEP * N + i * STEP, y = W[q] ? Math.max(WL[q], 0) : Math.max(H[q], 0.5);
    pos[k * 3] = i * STEP * 2; pos[k * 3 + 1] = y; pos[k * 3 + 2] = j * STEP * 2; uv[k * 2] = i / (n - 1); uv[k * 2 + 1] = 1 - j / (n - 1);
  }
  k = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const island = new THREE.Mesh(geo, islandMat);
  // la mer de décor s'arrête au bord de la carte, à la même hauteur et de la même couleur que l'eau de l'île :
  // si elle passait dessous, les deux surfaces se disputeraient chaque pixel et le rivage scintillerait
  const [dr, dg, db] = canvas.getContext('2d').getImageData(1, 1, 1, 1).data;
  shared.uDeep.value.setRGB(dr / 255, dg / 255, db / 255, THREE.SRGBColorSpace);
  const E = (n - 1) * STEP * 2, IN = 8, OUT = 20000, A = -OUT, B = E + OUT;
  const seaPos = [[A, B, A, IN], [A, B, E - IN, B], [A, IN, IN, E - IN], [E - IN, B, IN, E - IN]].flatMap(([x0, x1, z0, z1]) => [x0, 0, z0, x0, 0, z1, x1, 0, z0, x1, 0, z0, x0, 0, z1, x1, 0, z1]);
  const seaGeo = new THREE.BufferGeometry(); seaGeo.setAttribute('position', new THREE.Float32BufferAttribute(seaPos, 3));
  const sea = new THREE.Mesh(seaGeo, seaMat);
  const buildings = buildBuildings(map), trees = buildTrees(map);
  scene.add(island, sea, buildings, trees);
  return { canvas, trees, update(camPos) { shared.uCam.value.copy(camPos); }, dispose() { geo.dispose(); seaGeo.dispose(); islandMat.dispose(); seaMat.dispose(); tex.dispose(); buildings.geometry.dispose(); buildings.material.dispose(); } };
}
