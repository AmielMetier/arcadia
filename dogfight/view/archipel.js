// L'archipel vu du ciel : le vrai relief de la carte (la même grille que le moteur), peint de vraies photos aériennes
// (herbe, roche, plage, neige : Poly Haven, CC0) teintées aux couleurs du lieu, selon la pente et l'altitude ;
// l'horizon (la grille lointaine, moins fine) ; les lacs ; la piste de la base, son tarmac et sa digue ; des bois ;
// et la mer, claire au-dessus des hauts-fonds, frangée d'écume sur les côtes.
// L'île d'Island Rush garde son propre rendu (ground.js) : on n'y dessine rien.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { buildArchipel, heightAt, lakeAt, runwayLocal, PLATFORM, fbm } from '../engine/archipel.js';
import { HAZE, FOG_DENSITY, hash } from './sky.js';

const ISLAND = 1600;   // côté du carré d'Island Rush
const TEXTURES = { herbe: 'textures/herbe.webp', roche: 'textures/roche.webp', plage: 'textures/plage.webp', neige: 'textures/neige.webp' };
const MAX_TREES = 70000;

const COMMON = `uniform sampler2D uN; uniform vec3 uSun, uHaze, uCam; uniform float uFogD;
float fb(vec2 p){ return texture2D(uN,p).r*.6+texture2D(uN,p*2.3+.17).r*.3+texture2D(uN,p*5.1+.41).r*.1; }
vec3 lin(vec3 c){ return pow(c,vec3(2.2)); }
vec3 fog(vec3 c, vec3 V, float d){ float f=1.-exp(-pow(d*uFogD,1.45)); float sa=pow(max(dot(-V,uSun),0.),6.); return mix(c,mix(uHaze,vec3(1.,.93,.84),sa*.4),f); }`;

const TERRAIN_VERTEX = `varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normal; gl_Position=projectionMatrix*viewMatrix*w; }`;
const TERRAIN_FRAGMENT = `varying vec3 vW; varying vec3 vN; uniform sampler2D uGrass, uRock, uSand, uSnow, uLake, uMacro;
uniform vec3 uLush, uDryC, uScrub, uRockC, uSandC, uArea, uMacroA; uniform vec2 uRockL, uSnowL; uniform vec4 uRunC, uRunV; uniform float uMoist; ${COMMON}
// deux échelles du même cliché : la répétition ne se voit plus d'en haut
vec3 two(sampler2D t, vec2 p, float s){ return mix(texture2D(t,p*s).rgb, texture2D(t,p*s*.23+.37).rgb, .42); }
// projection sur les trois plans : les falaises ne s'étirent pas
vec3 tri(sampler2D t, vec3 p, vec3 n, float s){ vec3 b=pow(abs(n),vec3(4.)); b/=b.x+b.y+b.z; return texture2D(t,p.zy*s).rgb*b.x+texture2D(t,p.xz*s).rgb*b.y+texture2D(t,p.xy*s).rgb*b.z; }
// la photo ne donne que le grain : divisée par sa propre moyenne, elle module la couleur du lieu
vec3 grain(sampler2D t, vec3 c){ vec3 r=c/max(texture2D(t,vec2(.5),20.).rgb,vec3(.01)); return mix(vec3(dot(r,vec3(.3,.59,.11))),r,.35); }
void main(){
  vec3 N=normalize(vN); float h=vW.y; vec2 w=vW.xz;
  // le petit relief que la grille de 25 m ne porte pas
  float b0=fb(w/140.), bx=fb((w+vec2(4.,0.))/140.)-b0, bz=fb((w+vec2(0.,4.))/140.)-b0;
  N=normalize(N+vec3(-bx,0.,-bz)*7.); float sl=1.-N.y;
  // la carte des couleurs : végétation (vallons et versants nord plus verts) et creux
  vec4 M=texture2D(uMacro,(w-uMacroA.xy)/uMacroA.z); float cav=M.g*2.-1.;
  float m=fb(w/1400.), m2=fb(w/260.+.5), veg=M.r+(m2-.5)*.22;
  vec3 ground=mix(lin(uDryC),lin(uLush),smoothstep(.28,.6,veg)); ground=mix(ground,lin(uScrub),smoothstep(.58,.88,veg));
  ground*=grain(uGrass,two(uGrass,w,1./110.))*mix(.88,1.1,m);
  vec3 rock=lin(uRockC)*grain(uRock,mix(tri(uRock,vW,N,1./130.),tri(uRock,vW+37.,N,1./520.),.45))*mix(.84,1.12,m2);
  vec3 sand=lin(uSandC)*grain(uSand,two(uSand,w,1./60.)), snow=two(uSnow,w,1./190.)*1.08;
  // sous un climat humide, la végétation tient sur des pentes plus fortes
  float wRock=smoothstep(.24+.22*uMoist,.42+.25*uMoist,sl+(m2-.5)*.2)+smoothstep(uRockL.x,uRockL.y,h+(m-.5)*200.)+M.b*.8;
  float wSnow=smoothstep(uSnowL.x,uSnowL.y,h+(m-.5)*170.)*(1.-smoothstep(.45,.7,sl));
  float wSand=(1.-smoothstep(1.,4.5,h+(m2-.5)*4.))*(1.-smoothstep(.25,.45,sl));
  vec3 c=mix(ground,rock,clamp(wRock,0.,1.)); c=mix(c,sand,wSand); c=mix(c,snow,clamp(wSnow,0.,1.));
  c*=mix(.5,1.,smoothstep(-4.,.6,h));
  // la base : la digue en enrochement, le tarmac devant les hangars, et la piste avec son balisage
  vec2 d=w-uRunC.xy; float ra=dot(d,uRunC.zw), rb=dot(d,uRunV.xy), hl=uRunV.z*.5, hw=uRunV.w*.5;
  float pd=length(vec2(max(0.,abs(ra)-hl-${PLATFORM.end}.),max(0.,max(rb-${PLATFORM.apron}.,-${PLATFORM.side}.-rb))));
  c=mix(c,rock*.8,step(.5,pd)*step(pd,60.)*step(h,9.8));
  float apron=step(hl-1250.,ra)*step(ra,hl-150.)*step(hw,rb)*step(rb,158.);
  float strip=step(abs(ra),hl+6.)*step(abs(rb),hw+6.);
  vec3 tar=lin(vec3(.36,.36,.35))*(.84+.3*texture2D(uN,w*.043).r);
  c=mix(c,tar*1.25,apron); c=mix(c,tar,strip);
  float run=step(abs(ra),hl)*step(abs(rb),hw);
  float paint=step(hw-2.6,abs(rb))*step(abs(rb),hw-1.2)+step(abs(rb),.9)*step(.45,fract(ra/60.))*step(abs(ra),hl-90.)
    +step(hl-58.,abs(ra))*step(abs(ra),hl-12.)*step(.5,fract(rb/3.6))*step(abs(rb),hw-5.)+step(hl-210.,abs(ra))*step(abs(ra),hl-160.)*step(5.,abs(rb))*step(abs(rb),12.);
  c=mix(c,lin(vec3(.86,.86,.84)),min(paint,1.)*run);
  float nl=max(dot(N,uSun),0.); vec3 amb=mix(vec3(.3,.3,.27),vec3(.46,.52,.62),N.y*.5+.5);
  c*=(amb+vec3(1.,.94,.84)*nl*1.15)*1.2*mix(1.,.58,max(cav,0.))*(1.+.18*max(-cav,0.));
  vec3 V=normalize(uCam-vW);
  // les lacs : une eau sombre qui reflète le ciel
  vec2 st=(w-uArea.xy)/uArea.z; float lk=texture2D(uLake,st).r*step(0.,st.x)*step(0.,st.y)*step(st.x,1.)*step(st.y,1.);
  float fr=pow(1.-max(V.y,0.),3.); vec3 lw=mix(lin(vec3(.12,.24,.28)),uHaze*.9,.12+.7*fr)+vec3(1.,.93,.8)*pow(max(dot(reflect(-V,vec3(0.,1.,0.)),uSun),0.),200.)*1.4;
  c=mix(c,lw,smoothstep(.4,.62,lk));
  gl_FragColor=vec4(fog(c,V,length(uCam-vW)),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SEA_VERTEX = `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const SEA_FRAGMENT = `varying vec3 vW; uniform sampler2D uDepth, uDepthF; uniform vec3 uDeep, uShallow, uArea, uAreaF; uniform float uTime; ${COMMON}
void main(){
  vec2 st=(vW.xz-uArea.xy)/uArea.z, sf=(vW.xz-uAreaF.xy)/uAreaF.z; float dep=1.;
  if(st.x>0.&&st.y>0.&&st.x<1.&&st.y<1.) dep=texture2D(uDepth,st).r;
  else if(sf.x>0.&&sf.y>0.&&sf.x<1.&&sf.y<1.) dep=texture2D(uDepthF,sf).r;
  vec3 V=normalize(uCam-vW); float d=length(uCam-vW);
  vec3 c=mix(lin(uShallow),uDeep,smoothstep(.02,.75,dep));
  vec2 p=vW.xz*.012; float t=uTime*.012; float n1=texture2D(uN,p+vec2(t,t*.6)).r-.5,n2=texture2D(uN,p*3.1+.3-vec2(t*1.7,t)).r-.5;
  vec3 Nw=normalize(vec3((n1+n2*.5)*.09,1.,(n2+n1*.4)*.09)); float fr=pow(1.-max(dot(Nw,V),0.),3.5);
  vec3 R=reflect(-V,Nw); vec3 sky=mix(uHaze,vec3(.13,.3,.55),smoothstep(0.,.5,R.y));
  c=mix(c,sky,.12+.8*fr); c+=vec3(1.,.93,.8)*pow(max(dot(R,uSun),0.),260.)*1.6;
  float foam=(1.-smoothstep(.0,.07,dep+(texture2D(uN,vW.xz*.03+uTime*.006).r-.5)*.06))*smoothstep(.35,.7,texture2D(uN,vW.xz*.05-uTime*.01).r)*step(.001,dep);
  c=mix(c,vec3(.86,.9,.92),foam*.75);
  gl_FragColor=vec4(fog(c,V,d),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Un relief en grille régulière, seulement là où il dépasse de l'eau ; `skip(i, j)` écarte des cases
// (l'île d'Island Rush, ou le carré déjà couvert par la grille proche)
function terrainGeometry(G, stride, skip) {
  const n = G.n, h = G.h, step = G.step * stride, m = Math.floor((n - 1) / stride) + 1;
  const at = (i, j) => h[Math.min(n - 1, j * stride) * n + Math.min(n - 1, i * stride)];
  const index = new Int32Array(m * m).fill(-1), pos = [], nor = [], idx = [];
  const vert = (i, j) => {
    const k = j * m + i;
    if (index[k] < 0) {
      const x = G.x0 + i * step, z = G.z0 + j * step, y = at(i, j);
      const gx = (at(Math.min(m - 1, i + 1), j) - at(Math.max(0, i - 1), j)) / (2 * step), gz = (at(i, Math.min(m - 1, j + 1)) - at(i, Math.max(0, j - 1))) / (2 * step), l = Math.hypot(gx, 1, gz);
      index[k] = pos.length / 3; pos.push(x, y, z); nor.push(-gx / l, 1 / l, -gz / l);
    }
    return index[k];
  };
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) {
    const x = G.x0 + i * step, z = G.z0 + j * step;
    if (skip(x, z, step)) continue;
    if (Math.max(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)) < -3) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

function byteTexture(data, n) {
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}
// La grille G en texture : chaque point au centre de son texel
const areaOf = (G) => new THREE.Vector3(G.x0 - G.step / 2, G.z0 - G.step / 2, G.n * G.step);

// La carte des couleurs, calculée une fois depuis le relief : la végétation (R), plus fournie au creux des vallons,
// sur les versants nord et là où le lieu est humide, rare sur les pentes raides et au-dessus des arbres ;
// les creux et les crêtes (G), pour l'ombre des vallons ; la roche qui affleure par plaques (B)
function macroTexture(G, look, seed) {
  const n = G.n, h = G.h, st = G.step, out = new Uint8Array(n * n * 4), r = Math.max(1, Math.round(160 / st));
  const S = new Float64Array((n + 1) * (n + 1));
  for (let j = 0; j < n; j++) for (let i = 0, row = 0; i < n; i++) { row += h[j * n + i]; S[(j + 1) * (n + 1) + i + 1] = S[j * (n + 1) + i + 1] + row; }
  const mean = (i, j) => {
    const i0 = Math.max(0, i - r), j0 = Math.max(0, j - r), i1 = Math.min(n, i + r + 1), j1 = Math.min(n, j + r + 1);
    return (S[j1 * (n + 1) + i1] - S[j0 * (n + 1) + i1] - S[j1 * (n + 1) + i0] + S[j0 * (n + 1) + i0]) / ((i1 - i0) * (j1 - j0));
  };
  const T = look.trees, sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, y = h[k], x = G.x0 + i * st, z = G.z0 + j * st;
    const gx = (h[j * n + Math.min(n - 1, i + 1)] - h[j * n + Math.max(0, i - 1)]) / (2 * st), gz = (h[Math.min(n - 1, j + 1) * n + i] - h[Math.max(0, j - 1) * n + i]) / (2 * st);
    const g = Math.hypot(gx, gz), cav = Math.max(-1, Math.min(1, (mean(i, j) - y) / 35)), north = gz / Math.hypot(gx, gz, 1);
    let veg = look.moist + 1.1 * cav + 0.3 * north - 0.75 * sm(0.45, 1.1, g) + (fbm(x / 1100, z / 1100, 4, seed) - 0.5) * 1.5 + (fbm(x / 240, z / 240, 3, seed + 9) - 0.5) * 0.6;
    veg -= sm(T.hi, T.hi + 300, y) * 0.45;
    const bare = sm(0.6, 0.75, fbm(x / 420, z / 420, 3, seed + 21) + g * 0.15 - look.moist * 0.2);
    out[k * 4] = Math.round(Math.max(0, Math.min(1, veg)) * 255); out[k * 4 + 1] = Math.round((cav * 0.5 + 0.5) * 255); out[k * 4 + 2] = Math.round(bare * 255); out[k * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(out, n, n, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

// Profondeur de la mer (0 sur la côte, 1 au large) : l'eau s'éclaircit au-dessus des hauts-fonds
function depthTexture(G) {
  const d = new Uint8Array(G.n * G.n);
  for (let k = 0; k < d.length; k++) d[k] = Math.round(Math.max(0, Math.min(1, -G.h[k] / 60)) * 255);
  return byteTexture(d, G.n);
}

// Les bois : des bosquets là où le climat les laisse pousser (altitude, pente, ni lac ni piste)
function buildForest(A) {
  const T = A.def.look.trees, H = (x, z) => heightAt(A, x, z), W = A.runway, all = [];
  const cut = 0.62 - T.amount * 0.25;
  for (let z = A.z0; z < A.z0 + A.size; z += 20) for (let x = A.x0; x < A.x0 + A.size; x += 20) {
    if (x > -40 && x < ISLAND + 40 && z > -40 && z < ISLAND + 40) continue;
    const jx = x + (hash(x, z) - 0.5) * 18, jz = z + (hash(z, x) - 0.5) * 18, h = H(jx, jz);
    if (h < T.lo || h > T.hi || fbm(jx / 700, jz / 700, 4, 55) < cut) continue;
    if (Math.hypot(H(jx + 8, jz) - H(jx - 8, jz), H(jx, jz + 8) - H(jx, jz - 8)) / 16 > 0.75) continue;
    if (lakeAt(A, jx, jz)) continue;
    const r = runwayLocal(W, jx, jz);
    if (Math.abs(r.a) < W.len / 2 + 300 && r.b > -PLATFORM.side - 80 && r.b < PLATFORM.apron + 80) continue;
    all.push({ x: jx, y: h, z: jz, s: 1.3 + hash(jz, 5) * 0.9 });
  }
  // une forêt trop dense pour la carte graphique : on éclaircit au hasard, partout pareil
  const keep = Math.min(1, MAX_TREES / all.length), leafy = [], pine = [];
  for (const p of all) if (hash(p.x * 0.37, p.z * 0.61) < keep) (p.y > T.pine || hash(p.x, 3) < 0.35 ? pine : leafy).push(p);
  const group = new THREE.Group(), meshes = [], o = new THREE.Object3D(), cc = new THREE.Color();
  const make = (list, geo, palette) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, list.length));
    list.forEach((p, i) => { o.position.set(p.x, p.y - 0.5, p.z); o.scale.setScalar(p.s); o.rotation.y = i; o.updateMatrix(); im.setMatrixAt(i, o.matrix); cc.setHex(palette[i % palette.length]); im.setColorAt(i, cc); });
    im.count = list.length;
    group.add(im); meshes.push({ im, n: list.length });
  };
  const g1 = new THREE.IcosahedronGeometry(3.8, 0); g1.scale(1, 1.15, 1); g1.translate(0, 5.2, 0);
  const g2 = new THREE.ConeGeometry(2.8, 11, 5); g2.translate(0, 6, 0);
  make(leafy, g1, [0x34482a, 0x3e522e, 0x2d4127, 0x475a31]);
  make(pine, g2, [0x22372a, 0x2a3e2f, 0x253a2b]);
  group.setDensity = (f) => { for (const q of meshes) q.im.count = Math.floor(q.n * f); };
  group.dispose = () => { for (const q of meshes) { q.im.geometry.dispose(); q.im.material.dispose(); } };
  return group;
}

export function buildArchipelago(scene, { sun, deep, noiseTex, anisotropy = 8 }) {
  const A = buildArchipel(), F = A.far, L = A.def.look, R = A.runway, loader = new THREE.TextureLoader(), base = new URL('../', import.meta.url);
  const tex = {};
  for (const [k, f] of Object.entries(TEXTURES)) {
    const t = tex[k] = loader.load(new URL(f, base).href);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy;
  }
  const lakeData = new Uint8Array(A.n * A.n); for (let k = 0; k < lakeData.length; k++) lakeData[k] = A.lake[k] ? 255 : 0;
  const lake = byteTexture(lakeData, A.n);
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const shared = { uN: { value: noiseTex }, uSun: { value: sun }, uHaze: { value: HAZE }, uCam: { value: new THREE.Vector3() }, uFogD: { value: FOG_DENSITY } };
  const terrainUniforms = (G, macro) => ({
    ...shared, uGrass: { value: tex.herbe }, uRock: { value: tex.roche }, uSand: { value: tex.plage }, uSnow: { value: tex.neige }, uLake: { value: lake }, uMacro: { value: macro },
    uLush: { value: v3(L.lush) }, uDryC: { value: v3(L.dry) }, uScrub: { value: v3(L.scrub) }, uRockC: { value: v3(L.rock) }, uSandC: { value: v3(L.sand) }, uMoist: { value: L.moist },
    uRockL: { value: new THREE.Vector2(...L.rockLine) }, uSnowL: { value: new THREE.Vector2(...L.snowLine) }, uArea: { value: areaOf(A) }, uMacroA: { value: areaOf(G) },
    uRunC: { value: new THREE.Vector4(R.x, R.z, R.ux, R.uz) }, uRunV: { value: new THREE.Vector4(R.vx, R.vz, R.len, R.w) },
  });
  const macro = macroTexture(A, L, 61), macroF = macroTexture(F, L, 61);
  const terrainMat = new THREE.ShaderMaterial({ uniforms: terrainUniforms(A, macro), vertexShader: TERRAIN_VERTEX, fragmentShader: TERRAIN_FRAGMENT });
  const farMat = new THREE.ShaderMaterial({ uniforms: terrainUniforms(F, macroF), vertexShader: TERRAIN_VERTEX, fragmentShader: TERRAIN_FRAGMENT });
  const depth = depthTexture(A), depthF = depthTexture(F), time = { value: 0 };
  const seaMat = new THREE.ShaderMaterial({
    uniforms: {
      ...shared, uDepth: { value: depth }, uDepthF: { value: depthF }, uDeep: { value: deep }, uShallow: { value: v3(L.water) },
      uArea: { value: areaOf(A) }, uAreaF: { value: areaOf(F) }, uTime: time,
    },
    vertexShader: SEA_VERTEX, fragmentShader: SEA_FRAGMENT,
  });
  // la mer s'arrête au bord du carré d'Island Rush, dont l'eau est peinte dans sa propre texture
  const IN = 8, E = ISLAND, OUT = 26000, a = -OUT, b = E + OUT;
  const seaPos = [[a, b, a, IN], [a, b, E - IN, b], [a, IN, IN, E - IN], [E - IN, b, IN, E - IN]].flatMap(([x0, x1, z0, z1]) => [x0, 0, z0, x0, 0, z1, x1, 0, z0, x1, 0, z0, x0, 0, z1, x1, 0, z1]);
  const seaGeo = new THREE.BufferGeometry(); seaGeo.setAttribute('position', new THREE.Float32BufferAttribute(seaPos, 3));
  const sea = new THREE.Mesh(seaGeo, seaMat);
  const nearSkip = (x, z, s) => x >= 0 && z >= 0 && x + s <= ISLAND && z + s <= ISLAND;
  const farSkip = (x, z, s) => x >= A.x0 - 1 && z >= A.z0 - 1 && x + s <= A.x0 + A.size + 1 && z + s <= A.z0 + A.size + 1;
  let terrain = new THREE.Mesh(terrainGeometry(A, 1, nearSkip), terrainMat), stride = 1;
  const horizon = new THREE.Mesh(terrainGeometry(F, 1, farSkip), farMat);
  const forest = buildForest(A);
  scene.add(sea, terrain, horizon, forest);
  return {
    forest, materials: [terrainMat, farMat],
    // qualité basse : un point sur deux
    setDetail(fine) {
      const s = fine ? 1 : 2; if (s === stride) return;
      stride = s; terrain.geometry.dispose(); terrain.geometry = terrainGeometry(A, s, nearSkip);
    },
    update(camPos, t) { shared.uCam.value.copy(camPos); time.value = t; },
    dispose() {
      terrain.geometry.dispose(); horizon.geometry.dispose(); terrainMat.dispose(); farMat.dispose(); seaGeo.dispose(); seaMat.dispose(); depth.dispose(); depthF.dispose(); lake.dispose(); macro.dispose(); macroF.dispose(); forest.dispose();
      for (const t of Object.values(tex)) t.dispose();
      scene.remove(sea, terrain, horizon, forest);
    },
  };
}
