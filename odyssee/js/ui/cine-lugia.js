// odyssee/js/ui/cine-lugia.js — l'éveil de Lugia Obscur, mis en scène comme une cinématique de jeu (Three.js, temps réel).
// Sept plans montés cut, une bande-son écrite sur les mêmes repères (audio.js, playShadowLugiaEpic) :
//   1. plan large : la mer en furie sous l'éclipse, la pluie, la foudre, le Sanctuaire des Marées sur son rocher
//   2. gros plan : le Prisme Noir se fissure au rythme d'un cœur qui s'emballe
//   3. la rupture au ralenti : les éclats, l'éclair blanc, l'onde de choc qui court sur la mer
//   4. contre-plongée au ras de l'eau : la mer tourbillonne, une colonne d'eau noire jaillit, une silhouette s'y élève, un œil rouge s'allume
//   5. la révélation : la colonne éclate, Lugia Obscur se montre, crie ; tornade d'ombre et foudre
//   6. l'Aéroblast : l'énergie converge vers sa gueule, le rayon part droit vers nous
//   7. le plan héroïque devant l'éclipse, le titre
// Le module ne charge rien lui-même : cinematic.js lui passe THREE, le sprite et les passes de post-traitement.

export const LUGIA_EPIC = {
  dur: 21.5,
  shots: [0, 3.4, 6.5, 7.7, 11.2, 14.4, 17.7],
  strikes: [0.9, 2.5, 4.9, 8.4, 9.6, 11.45, 12.6, 13.5, 15.1, 19.2],
  heart: [3.7, 4.5, 5.15, 5.65, 6.0, 6.25],
  crack: 3.4,
  shatter: 6.5,
  erupt: 8.1,
  rise: 8.4,
  eyes: 10.3,
  reveal: 11.2,
  charge: 14.4,
  fire: 17.0,
  white: 17.7,
  title: 18.4,
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOut = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const seeded = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

const GLSL_NOISE = `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;

/** l'œil rouge du sprite (pixels rouges vifs) : position relative dans l'image, sinon une valeur sûre pour Lugia */
function trouverOeil(img) {
  try {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] > 200 && d[i] > 150 && d[i + 1] < 90 && d[i + 2] < 110) { sx += x; sy += y; n++; }
    }
    if (n && n < 80) return { u: (sx / n + 0.5) / W, v: (sy / n + 0.5) / H };
  } catch (e) { /* image d'une autre origine : valeur par défaut */ }
  return { u: 0.34, v: 0.37 };
}

function texDegrade(THREE, stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texEtoile(THREE) {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,200,230,0.9)'); gr.addColorStop(0.4, 'rgba(255,60,120,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[s, 3], [3, s * 0.7]]) {
    const lg = g.createLinearGradient(s / 2 - w / 2, s / 2 - h / 2, s / 2 + w / 2, s / 2 + h / 2);
    lg.addColorStop(0, 'rgba(255,80,140,0)'); lg.addColorStop(0.5, 'rgba(255,230,240,1)'); lg.addColorStop(1, 'rgba(255,80,140,0)');
    g.fillStyle = lg; g.fillRect(s / 2 - w / 2, s / 2 - h / 2, w, h);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** passe « pellicule » : aberration chromatique, vignette, grain, étalonnage violet-sarcelle */
const PASSE_FILM = {
  uniforms: { tDiffuse: { value: null }, uCA: { value: 0.0015 }, uTime: { value: 0 }, uGrain: { value: 0.05 }, uVig: { value: 1.0 }, uLift: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uCA, uTime, uGrain, uVig, uLift; varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5, off = c * uCA * (0.6 + dot(c, c) * 3.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(0.92, 0.95, 1.12) + vec3(0.012, 0.0, 0.025), smoothstep(0.35, 0.0, lum));   // ombres violettes
      col += uLift * vec3(0.9, 0.8, 1.0);
      col *= mix(1.0, smoothstep(0.95, 0.25, length(c * vec2(1.0, 0.82))), uVig * 0.85);
      col *= 1.0 + (h(vUv * 931.7 + fract(uTime * 7.13)) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createShadowLugiaEpic(THREE, container, img, fx = null) {
  const E = LUGIA_EPIC;
  const W0 = Math.max(320, container.clientWidth || 800), H0 = Math.max(180, container.clientHeight || 450);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(W0, H0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05020c);
  scene.fog = new THREE.FogExp2(0x140a26, 0.011);
  const camera = new THREE.PerspectiveCamera(40, W0 / H0, 0.1, 700);
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };

  const U = {
    uTime: { value: 0 }, uFlash: { value: 0 }, uStorm: { value: 0.55 },
    uVortex: { value: 0 }, uVortexP: { value: new THREE.Vector2(0, -10) },
    uShockR: { value: -20 }, uShockA: { value: 0 },
    uEclipse: { value: new THREE.Vector3(0, 0.33, -1).normalize() },
    uFogCol: { value: new THREE.Color(0.075, 0.035, 0.13) },
  };

  /* ---------------- ciel d'orage et éclipse ---------------- */
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(300, 48, 24)), keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: U,
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform float uTime, uFlash; uniform vec3 uEclipse; varying vec3 vDir; ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir); float hgt = d.y;
        vec3 col = mix(vec3(0.085, 0.04, 0.15), vec3(0.01, 0.004, 0.028), smoothstep(-0.05, 0.6, hgt));
        vec2 uv = d.xz / (max(hgt, 0.02) + 0.2) * 1.5 + vec2(uTime * 0.05, uTime * 0.018);
        float cl = fbm(uv) * 0.7 + fbm(uv * 2.4 - uTime * 0.04) * 0.45;
        float cloud = smoothstep(0.38, 0.86, cl) * smoothstep(-0.04, 0.14, hgt);
        float ang = acos(clamp(dot(d, uEclipse), -1.0, 1.0));
        float corona = exp(-max(ang - 0.06, 0.0) * 20.0);
        vec3 cloudCol = vec3(0.09, 0.045, 0.16) + vec3(0.55, 0.22, 0.8) * corona * 0.7 + vec3(0.85, 0.8, 1.0) * uFlash * 0.6 * (0.5 + cl);
        col = mix(col, cloudCol, cloud * 0.93);
        vec3 cor = vec3(0.75, 0.32, 1.0) * exp(-max(ang - 0.06, 0.0) * 32.0) * 1.8 + vec3(1.0, 0.85, 1.0) * exp(-abs(ang - 0.0605) * 420.0) * 2.6;
        col += cor * (1.0 - cloud * 0.75);
        col = mix(col, vec3(0.0), 1.0 - smoothstep(0.057, 0.061, ang));
        col += vec3(0.6, 0.55, 0.9) * uFlash * 0.15 * smoothstep(-0.1, 0.5, hgt);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })));
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  /* ---------------- la mer ---------------- */
  const merGeo = keep(new THREE.PlaneGeometry(320, 320, 256, 256)); merGeo.rotateX(-Math.PI / 2);
  const mer = new THREE.Mesh(merGeo, keep(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `uniform float uTime, uStorm, uVortex, uShockR, uShockA; uniform vec2 uVortexP;
      varying vec3 vW; varying float vH; varying vec3 vN;
      float vague(vec2 p) {
        float h = sin(dot(p, vec2(0.13, 0.07)) + uTime * 1.1) + sin(dot(p, vec2(-0.09, 0.15)) * 1.3 + uTime * 1.5) * 0.6
          + sin(dot(p, vec2(0.27, -0.21)) + uTime * 2.3) * 0.28 + sin(dot(p, vec2(-0.41, -0.33)) + uTime * 3.1) * 0.14;
        h *= uStorm;
        vec2 dv = p - uVortexP; float dd = length(dv);
        h -= uVortex * 4.5 * exp(-dd * dd / 60.0);
        h += uVortex * 0.6 * sin(atan(dv.y, dv.x) * 5.0 + dd * 0.9 - uTime * 5.0) * exp(-dd / 9.0);
        float ds = length(p) - uShockR; h += uShockA * 1.6 * exp(-ds * ds * 0.35);
        return h;
      }
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float h = vague(w.xz), e = 0.6;
        vN = normalize(vec3(h - vague(w.xz + vec2(e, 0.0)), e, h - vague(w.xz + vec2(0.0, e))));
        w.y += h; vW = w.xyz; vH = h;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform float uTime, uFlash, uStorm, uVortex, uShockR, uShockA; uniform vec2 uVortexP; uniform vec3 uEclipse, uFogCol;
      varying vec3 vW; varying float vH; varying vec3 vN; ${GLSL_NOISE}
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN + vec3(vnoise(vW.xz * 0.9 + uTime) - 0.5, 0.0, vnoise(vW.xz * 0.9 - uTime * 1.3) - 0.5) * 0.14);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        vec3 ciel = mix(vec3(0.085, 0.04, 0.15), vec3(0.012, 0.005, 0.03), smoothstep(-0.05, 0.6, R.y));
        float spec = pow(max(dot(R, uEclipse), 0.0), 90.0);
        vec3 col = vec3(0.002, 0.008, 0.022) + ciel * fres * 1.0 + vec3(0.9, 0.45, 1.0) * spec * 1.6;
        float ecume = smoothstep(0.8, 1.7, vH / max(uStorm, 0.1) + vnoise(vW.xz * 1.7 + uTime * 0.5) * 0.9);
        col = mix(col, vec3(0.32, 0.28, 0.44), ecume * 0.35);
        vec2 dv = vW.xz - uVortexP; float dd = length(dv);
        float spirale = pow(max(0.0, sin(atan(dv.y, dv.x) * 4.0 + dd * 1.1 - uTime * 6.0)), 6.0) * exp(-dd / 7.0) * uVortex;
        col += vec3(0.6, 0.15, 0.9) * spirale * 1.6 + vec3(0.5, 0.1, 0.85) * uVortex * exp(-dd * dd / 12.0) * 1.3;
        float ds = length(vW.xz) - uShockR; col += vec3(0.85, 0.55, 1.0) * uShockA * exp(-ds * ds * 0.25) * 2.4;
        col += vec3(0.7, 0.65, 1.0) * uFlash * (0.05 + fres * 0.4);
        col = mix(col, uFogCol, 1.0 - exp(-length(cameraPosition - vW) * 0.011));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })));
  mer.position.y = -1.4; mer.frustumCulled = false;
  scene.add(mer);

  /* ---------------- lumières ---------------- */
  const hemi = new THREE.HemisphereLight(0x6a4a9a, 0x05030a, 0.55);
  const rim = new THREE.DirectionalLight(0xb070ff, 1.7); rim.position.set(0, 14, -30);
  const key = new THREE.DirectionalLight(0x8090c0, 0.35); key.position.set(10, 8, 15);
  const eclairLum = new THREE.DirectionalLight(0xd8d0ff, 0); eclairLum.position.set(-8, 20, 10);
  const prismeLum = new THREE.PointLight(0xc040ff, 0, 16);
  const lugiaLum = new THREE.PointLight(0x9a40ff, 0, 34);
  scene.add(hemi, rim, key, eclairLum, prismeLum, lugiaLum);

  /* ---------------- le Sanctuaire des Marées, sur son rocher ---------------- */
  const r = seeded(249);
  const rocMat = keep(new THREE.MeshStandardMaterial({ color: 0x251c32, roughness: 0.92, metalness: 0.05, flatShading: true }));
  const rocGeo = keep(new THREE.CylinderGeometry(5.2, 7.8, 7, 22, 5));
  { const p = rocGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 3.4) { const k = 1 + (r() - 0.5) * 0.22; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, y + (r() - 0.5) * 0.5); } } rocGeo.computeVertexNormals(); }
  const roc = new THREE.Mesh(rocGeo, rocMat); roc.position.y = -3.1; scene.add(roc);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = 9 + r() * 22, s = 0.8 + r() * 2.2;
    const m = new THREE.Mesh(keep(new THREE.DodecahedronGeometry(s, 0)), rocMat);
    m.position.set(Math.cos(a) * d, -1.4 + s * 0.2, Math.sin(a) * d - 4); m.rotation.set(r() * 3, r() * 3, r() * 3); scene.add(m);
  }
  const autelMat = keep(new THREE.MeshStandardMaterial({ color: 0x1a1226, roughness: 0.6, metalness: 0.35, flatShading: true }));
  const autel = new THREE.Mesh(keep(new THREE.CylinderGeometry(3.0, 3.5, 0.7, 8)), autelMat); autel.position.y = 0.75; scene.add(autel);
  const runeMat = keep(new THREE.MeshBasicMaterial({ color: 0xb84dff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  const runes = new THREE.Mesh(keep(new THREE.RingGeometry(2.15, 2.45, 8, 1)), runeMat); runes.rotation.x = -Math.PI / 2; runes.position.y = 1.12; scene.add(runes);
  const runes2 = new THREE.Mesh(keep(new THREE.RingGeometry(1.2, 1.32, 48)), runeMat); runes2.rotation.x = -Math.PI / 2; runes2.position.y = 1.12; scene.add(runes2);
  const coiffes = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;   // aucun pilier dans l'axe de la caméra du plan final
    const ob = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.26, 0.42, 3.8, 4)), autelMat); ob.position.set(Math.cos(a) * 4.4, 2.3, Math.sin(a) * 4.4); ob.rotation.y = Math.PI / 4; scene.add(ob);
    const cm = keep(new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
    const c = new THREE.Mesh(keep(new THREE.OctahedronGeometry(0.3, 0)), cm); c.position.set(Math.cos(a) * 4.4, 4.55, Math.sin(a) * 4.4); scene.add(c); coiffes.push(c);
  }

  /* ---------------- le Prisme Noir, ses fissures, ses éclats ---------------- */
  const prisme = new THREE.Group(); prisme.position.set(0, 2.6, 0); scene.add(prisme);
  const prismeGeo = keep(new THREE.OctahedronGeometry(1, 0)); prismeGeo.scale(0.85, 1.5, 0.85);
  // reflets : une petite carte d'environnement peinte (ciel noir, bandes violettes, l'éclipse), pour que l'obsidienne brille
  const envCv = document.createElement('canvas'); envCv.width = 256; envCv.height = 128;
  { const g = envCv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#05010c'); gr.addColorStop(0.42, '#3a1466'); gr.addColorStop(0.5, '#d8b4fe'); gr.addColorStop(0.56, '#2a0c4a'); gr.addColorStop(1, '#020006'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#f5e8ff'; g.beginPath(); g.arc(128, 40, 9, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(128, 40, 7, 0, 7); g.fill(); }
  const envTex = keep(new THREE.CanvasTexture(envCv)); envTex.mapping = THREE.EquirectangularReflectionMapping; envTex.colorSpace = THREE.SRGBColorSpace;
  const prismeMat = keep(new THREE.MeshStandardMaterial({ color: 0x050208, emissive: 0x7a1fd0, emissiveIntensity: 0.12, roughness: 0.06, metalness: 1.0, flatShading: true, envMap: envTex, envMapIntensity: 1.4 }));
  const prismeMesh = new THREE.Mesh(prismeGeo, prismeMat); prisme.add(prismeMesh);
  const anneauMat = keep(new THREE.MeshBasicMaterial({ color: 0xd946ef, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  const anneau1 = new THREE.Mesh(keep(new THREE.TorusGeometry(1.65, 0.035, 8, 64)), anneauMat);
  const anneau2 = new THREE.Mesh(keep(new THREE.TorusGeometry(2.0, 0.025, 8, 64)), anneauMat); anneau2.rotation.x = Math.PI / 2.6;
  prisme.add(anneau1, anneau2);
  // fissures : des chemins tracés à la surface de l'octaèdre, révélés pas à pas
  const proj = (v) => v.multiplyScalar(1 / (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z)));
  const fis = []; const NF = 10, PAS = 12;
  for (let c = 0; c < NF; c++) {
    let p = proj(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5));
    const dir = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const segs = [];
    for (let k = 0; k < PAS; k++) {
      const q = proj(p.clone().addScaledVector(dir, 0.15));
      dir.add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
      segs.push([p.clone(), q.clone()]); p = q;
    }
    fis.push(segs);
  }
  const fisPos = [];
  for (let k = 0; k < PAS; k++) for (const segs of fis) for (const v of segs[k]) fisPos.push(v.x * 0.85 * 1.03, v.y * 1.5 * 1.03, v.z * 0.85 * 1.03);
  const fisGeo = keep(new THREE.BufferGeometry()); fisGeo.setAttribute('position', new THREE.Float32BufferAttribute(fisPos, 3)); fisGeo.setDrawRange(0, 0);
  const fisMat = keep(new THREE.LineBasicMaterial({ color: 0xffe0ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  prismeMesh.add(new THREE.LineSegments(fisGeo, fisMat));
  const eclatMat = keep(new THREE.MeshStandardMaterial({ color: 0x0a0312, emissive: 0x9b30ff, emissiveIntensity: 1.3, roughness: 0.1, metalness: 0.9, flatShading: true }));
  const eclats = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(keep(new THREE.TetrahedronGeometry(0.12 + r() * 0.32, 0)), eclatMat); m.visible = false;
    const d = proj(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5));
    const p0 = new THREE.Vector3(d.x * 0.85, d.y * 1.5, d.z * 0.85).add(prisme.position);
    eclats.push({ m, p0, v: d.clone().normalize().multiplyScalar(5 + r() * 8).add(new THREE.Vector3(0, 2.5, 0)), w: new THREE.Vector3(r() * 8 - 4, r() * 8 - 4, r() * 8 - 4) });
    scene.add(m);
  }
  const NE = 600, etPos = new Float32Array(NE * 3), etVel = [];
  for (let i = 0; i < NE; i++) { const d = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(); etVel.push(d.multiplyScalar(4 + r() * 14)); }
  const etGeo = keep(new THREE.BufferGeometry()); etGeo.setAttribute('position', new THREE.BufferAttribute(etPos, 3));
  const etincelles = new THREE.Points(etGeo, keep(new THREE.PointsMaterial({ color: 0xf0b0ff, size: 0.13, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  etincelles.frustumCulled = false; scene.add(etincelles);
  const choc = new THREE.Mesh(keep(new THREE.RingGeometry(0.92, 1, 128)), keep(new THREE.MeshBasicMaterial({ color: 0xd8a0ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })));
  choc.rotation.x = -Math.PI / 2; choc.position.y = -0.9; scene.add(choc);

  /* ---------------- la pluie ---------------- */
  const NP = 2600, pluiePos = new Float32Array(NP * 6), gouttes = [];
  for (let i = 0; i < NP; i++) gouttes.push({ x: (r() - 0.5) * 70, y: r() * 44 - 12, z: (r() - 0.5) * 70, v: 30 + r() * 12 });
  const pluieGeo = keep(new THREE.BufferGeometry()); pluieGeo.setAttribute('position', new THREE.BufferAttribute(pluiePos, 3));
  const pluieMat = keep(new THREE.LineBasicMaterial({ color: 0x9a8cc8, transparent: true, opacity: 0.32, depthWrite: false }));
  const pluie = new THREE.LineSegments(pluieGeo, pluieMat); pluie.frustumCulled = false; scene.add(pluie);

  /* ---------------- la foudre ---------------- */
  const eclairs = [];
  const eclairCoeurMat = keep(new THREE.MeshBasicMaterial({ color: 0xf4eaff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const eclairHaloMat = keep(new THREE.MeshBasicMaterial({ color: 0xa060ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  let flash = 0;
  const foudre = (cible) => {
    const haut = new THREE.Vector3(cible.x + (r() - 0.5) * 16, 46, cible.z + (r() - 0.5) * 10);
    const branche = (a, b, n, amp) => {
      const pts = [a.clone()];
      for (let k = 1; k < n; k++) { const f = k / n; const p = a.clone().lerp(b, f); p.x += (r() - 0.5) * amp * Math.sin(f * Math.PI); p.z += (r() - 0.5) * amp * Math.sin(f * Math.PI); pts.push(p); }
      pts.push(b.clone());
      const chemin = new THREE.CurvePath(); for (let k = 0; k + 1 < pts.length; k++) chemin.add(new THREE.LineCurve3(pts[k], pts[k + 1]));
      return { chemin, pts };
    };
    const g = new THREE.Group(); const geos = [];
    const tronc = branche(haut, cible, 22, 6);
    const ajoute = (ch, rayon, nseg) => {
      const g1 = new THREE.TubeGeometry(ch, nseg, rayon, 4, false), g2 = new THREE.TubeGeometry(ch, nseg, rayon * 5, 5, false);
      geos.push(g1, g2); g.add(new THREE.Mesh(g1, eclairCoeurMat), new THREE.Mesh(g2, eclairHaloMat));
    };
    ajoute(tronc.chemin, 0.07, 88);
    for (const k of [7, 13]) { const a = tronc.pts[k]; const b = a.clone().add(new THREE.Vector3((r() - 0.5) * 14, -8 - r() * 8, (r() - 0.5) * 8)); ajoute(branche(a, b, 8, 3).chemin, 0.04, 32); }
    scene.add(g);
    eclairs.push({ g, geos, vie: 0.34 });
    flash = 1;
  };
  const ciblesFoudre = [[16, -20], [-20, -26], [9, 6], [-14, -18], [12, -14], [3, -9], [-10, -6], [14, -22], [-6, -18], [-18, -30]];

  /* ---------------- la colonne d'eau ---------------- */
  const P = new THREE.Vector3(0, 0, -10);
  const colMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uFade: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime; varying vec2 vUv; varying vec3 vNv;
      void main() { vUv = uv; vec3 p = position; p.xz *= 1.0 + sin(p.y * 0.8 - uTime * 6.0 + atan(p.z, p.x) * 3.0) * 0.07;
        vNv = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime, uFade; varying vec2 vUv; varying vec3 vNv; ${GLSL_NOISE}
      void main() {
        float s = vnoise(vec2(vUv.x * 24.0, vUv.y * 5.0 - uTime * 4.0)) * 0.6 + vnoise(vec2(vUv.x * 60.0 + 3.0, vUv.y * 14.0 - uTime * 7.0)) * 0.5;
        float stri = pow(s, 3.0), bord = 1.0 - abs(vNv.z);
        vec3 col = mix(vec3(0.008, 0.012, 0.035), vec3(0.5, 0.18, 0.85), stri) + vec3(0.7, 0.75, 1.0) * pow(bord, 4.0) * 0.14;
        float a = (0.62 + 0.3 * stri + bord * 0.2) * uFade * (1.0 - smoothstep(0.82, 1.0, vUv.y) * 0.85);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const colGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 48, 32, true)); colGeo.translate(0, 0.5, 0);
  const colonne = new THREE.Mesh(colGeo, colMat); colonne.position.set(P.x, -1.6, P.z); colonne.visible = false; colonne.renderOrder = 2; scene.add(colonne);
  const NS = 900, embPos = new Float32Array(NS * 3), embruns = [];
  for (let i = 0; i < NS; i++) embruns.push({ p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), vie: 0 });
  const embGeo = keep(new THREE.BufferGeometry()); embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3));
  const embMat = keep(new THREE.PointsMaterial({ color: 0xb8c4ff, size: 0.22, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  const embPts = new THREE.Points(embGeo, embMat); embPts.frustumCulled = false; scene.add(embPts);
  let embIdx = 0;
  const projette = (n, depuis) => { for (let k = 0; k < n; k++) { const e = embruns[embIdx++ % NS]; depuis(e); } };

  /* ---------------- Lugia Obscur ---------------- */
  const cv = document.createElement('canvas');
  const iw = img?.naturalWidth || img?.width || 80, ih = img?.naturalHeight || img?.height || 80;
  cv.width = iw; cv.height = ih;
  const cg = cv.getContext('2d');
  if (img) cg.drawImage(img, 0, 0); else { cg.fillStyle = '#10081c'; cg.beginPath(); cg.ellipse(iw / 2, ih / 2, iw * 0.4, ih * 0.3, 0, 0, 7); cg.fill(); }
  const lugiaTex = keep(new THREE.CanvasTexture(cv)); lugiaTex.magFilter = THREE.NearestFilter; lugiaTex.minFilter = THREE.NearestFilter; lugiaTex.colorSpace = THREE.SRGBColorSpace;
  const oeil = img ? trouverOeil(img) : { u: 0.34, v: 0.37 };
  const LS = 10, LW = LS * (iw / ih);
  const lugiaMat = keep(new THREE.SpriteMaterial({ map: lugiaTex, alphaTest: 0.4, transparent: false }));
  const lugia = new THREE.Sprite(lugiaMat); lugia.scale.set(LW, LS, 1); lugia.visible = false; scene.add(lugia);
  const contourMat = keep(new THREE.SpriteMaterial({ map: lugiaTex, color: 0xb050ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const contour = new THREE.Sprite(contourMat); contour.visible = false; scene.add(contour);
  const auraMat = keep(new THREE.SpriteMaterial({ map: keep(texDegrade(THREE, [[0, 'rgba(190,90,255,0.9)'], [0.35, 'rgba(110,30,200,0.45)'], [1, 'rgba(0,0,0,0)']])), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const aura = new THREE.Sprite(auraMat); aura.visible = false; scene.add(aura);
  const etoileTex = keep(texEtoile(THREE));
  const lueurOeil = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: etoileTex, color: 0xff4070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })));
  const trainee = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(texDegrade(THREE, [[0, 'rgba(255,120,180,1)'], [0.25, 'rgba(255,40,110,0.5)'], [1, 'rgba(0,0,0,0)']])), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })));
  lueurOeil.renderOrder = trainee.renderOrder = 20;
  scene.add(lueurOeil, trainee);
  const anneauCri = new THREE.Mesh(keep(new THREE.RingGeometry(0.9, 1, 96)), keep(new THREE.MeshBasicMaterial({ color: 0xe0b0ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })));
  scene.add(anneauCri);
  const L = new THREE.Vector3(0, 8, -10);
  // tornade d'ombre
  const tornade = [];
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let k = 0; k <= 60; k++) { const f = k / 60, a = f * Math.PI * 6 + (i * Math.PI * 2) / 3, rr = 3.2 + f * 5.5; pts.push(new THREE.Vector3(Math.cos(a) * rr, -8 + f * 20, Math.sin(a) * rr)); }
    const m = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.09 + i * 0.03, 6, false)), keep(new THREE.MeshBasicMaterial({ color: i === 1 ? 0xe879f9 : 0x8a2be2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    m.position.copy(L); scene.add(m); tornade.push(m);
  }
  // fumée sombre autour de lui
  const NF2 = 300, fumPos = new Float32Array(NF2 * 3), fumees = [];
  for (let i = 0; i < NF2; i++) fumees.push({ a: r() * Math.PI * 2, d: 2 + r() * 6, y: (r() - 0.5) * 10, s: 0.4 + r() * 1.2 });
  const fumGeo = keep(new THREE.BufferGeometry()); fumGeo.setAttribute('position', new THREE.BufferAttribute(fumPos, 3));
  const fumMat = keep(new THREE.PointsMaterial({ map: keep(texDegrade(THREE, [[0, 'rgba(60,20,90,0.9)'], [1, 'rgba(0,0,0,0)']], 64)), color: 0x6a3a9a, size: 1.3, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const fumee = new THREE.Points(fumGeo, fumMat); fumee.frustumCulled = false; scene.add(fumee);

  /* ---------------- l'Aéroblast ---------------- */
  const sphere = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 24, 16)), keep(new THREE.MeshBasicMaterial({ color: 0xf6e8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })));
  sphere.visible = false; scene.add(sphere);
  const halo = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(texDegrade(THREE, [[0, 'rgba(255,240,255,1)'], [0.2, 'rgba(210,120,255,0.8)'], [0.55, 'rgba(120,40,220,0.25)'], [1, 'rgba(0,0,0,0)']])), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  scene.add(halo);
  const NC = 500, chPos = new Float32Array(NC * 3), charges = [];
  for (let i = 0; i < NC; i++) charges.push({ dir: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), d: 4 + r() * 10, v: 6 + r() * 10 });
  const chGeo = keep(new THREE.BufferGeometry()); chGeo.setAttribute('position', new THREE.BufferAttribute(chPos, 3));
  const chMat = keep(new THREE.PointsMaterial({ color: 0xe6c8ff, size: 0.16, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const chPts = new THREE.Points(chGeo, chMat); chPts.frustumCulled = false; scene.add(chPts);
  const rayGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true)); rayGeo.rotateX(Math.PI / 2); rayGeo.translate(0, 0, 0.5);
  const rayCoeur = new THREE.Mesh(rayGeo, keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  const rayHalo = new THREE.Mesh(rayGeo, keep(new THREE.MeshBasicMaterial({ color: 0x9d4dff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  scene.add(rayCoeur, rayHalo);

  /* ---------------- post-traitement ---------------- */
  let composer = null, bloom = null, film = null;
  if (fx?.EffectComposer) {
    try {
      composer = new fx.EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      composer.setSize(W0, H0);
      composer.addPass(new fx.RenderPass(scene, camera));
      bloom = new fx.UnrealBloomPass(new THREE.Vector2(W0 / 2, H0 / 2), 0.55, 0.5, 0.72);
      composer.addPass(bloom);
      if (fx.ShaderPass) { film = new fx.ShaderPass(PASSE_FILM); composer.addPass(film); }
      composer.addPass(new fx.OutputPass());
    } catch (e) { composer = null; bloom = null; film = null; }
  }

  /* ---------------- caméra : les sept plans ---------------- */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tmp = new THREE.Vector3(), droite = new THREE.Vector3(), haut = new THREE.Vector3(), versCam = new THREE.Vector3();
  const coeur = (t) => E.heart.reduce((s, b) => s + (t >= b ? Math.exp(-(t - b) * 9) : 0), 0);
  const bouche = new THREE.Vector3();
  const plan = (t) => {
    if (t < E.shots[1]) { const u = t / E.shots[1]; return { p: V(16, 3, 36).lerp(V(7, 4.5, 19), easeInOut(u)), l: V(0, 2, 0), f: 38 }; }
    if (t < E.shots[2]) {
      const u = (t - E.shots[1]) / (E.shots[2] - E.shots[1]), a = lerp(0.75, -0.35, easeInOut(u)), rr = lerp(3.9, 3.2, u);   // à l'intérieur du cercle des obélisques
      return { p: V(Math.sin(a) * rr, 2.3 + Math.sin(u * Math.PI) * 0.45, Math.cos(a) * rr), l: V(0, 2.6, 0), f: lerp(46, 36, u) - coeur(t) * 2.5 };
    }
    if (t < E.shots[3]) { const u = (t - E.shots[2]) / (E.shots[3] - E.shots[2]); return { p: V(0.6, 2.9, 2.6).lerp(V(1.6, 4.3, 12), easeOut(u * 1.15)), l: V(0, 2.4, 0), f: 48 }; }
    if (t < E.shots[4]) {
      const u = (t - E.shots[3]) / (E.shots[4] - E.shots[3]);
      // de côté et au ras de l'eau : le sanctuaire à gauche, la colonne au centre
      return { p: V(12, 0.9, -1.5).lerp(V(10, 1.4, -3.5), easeInOut(u)), l: V(0, 2.5, -9).lerp(V(0, 8.5, -10), smooth(0.15, 0.95, u)), f: 52 };
    }
    if (t < E.shots[5]) {
      const u = (t - E.shots[4]) / (E.shots[5] - E.shots[4]), a = lerp(-0.55, 0.35, easeInOut(u)), rr = lerp(13, 11, u);
      return { p: L.clone().add(V(Math.sin(a) * rr, lerp(-2.5, -1, u), Math.cos(a) * rr)), l: L.clone().add(V(0, 0.5, 0)), f: 44 };
    }
    if (t < E.shots[6]) {
      const u = (t - E.shots[5]) / (E.shots[6] - E.shots[5]);
      return { p: bouche.clone().add(V(2.2, -2.4, 15).lerp(V(0.8, -1.4, 10.5), easeInOut(u))), l: bouche.clone().add(V(0.6, -1.2, 0)), f: lerp(42, 34, u) };
    }
    const u = (t - E.shots[6]) / (E.dur - E.shots[6]);
    return { p: V(0, 1.4, 11).lerp(V(0, 2.3, 6.5), easeOut(u)), l: L.clone().add(V(0, 0.6, 0)), f: 46 };
  };

  let secousse = 0, roulis = 0, bloomKick = 0, caKick = 0;
  const fait = new Set();
  const une = (k, t, at) => { if (t >= at && !fait.has(k)) { fait.add(k); return true; } return false; };
  let tEclat = 0;

  const resize = () => {
    const w = Math.max(320, container.clientWidth || 800), h = Math.max(180, container.clientHeight || 450);
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    if (composer) { composer.setSize(w, h); bloom?.resolution?.set(w / 2, h / 2); }
  };

  const update = (t, dt) => {
    const d = Math.min(0.05, Math.max(0.001, dt));
    U.uTime.value = t;

    // repère de l'œil et de la gueule à l'écran (le sprite fait toujours face à la caméra)
    droite.setFromMatrixColumn(camera.matrixWorld, 0); haut.setFromMatrixColumn(camera.matrixWorld, 1);
    const sc = lugia.scale;
    const posOeil = lugia.position.clone().addScaledVector(droite, (oeil.u - 0.5) * sc.x).addScaledVector(haut, (0.5 - oeil.v) * sc.y);
    bouche.copy(L).addScaledVector(droite, (oeil.u - 0.06 - 0.5) * LW).addScaledVector(haut, (0.5 - oeil.v - 0.07) * LS);

    /* foudre */
    E.strikes.forEach((s, i) => { if (une('f' + i, t, s)) { const c = ciblesFoudre[i % ciblesFoudre.length]; foudre(V(c[0], -1.2, c[1])); secousse += 0.12; } });
    if (t > E.reveal && t < E.white && Math.random() < d * 0.6) { const a = Math.random() * 6.28; foudre(V(Math.cos(a) * 25, -1.2, Math.sin(a) * 25 - 12)); }
    for (let i = eclairs.length - 1; i >= 0; i--) {
      const e = eclairs[i]; e.vie -= d;
      const k = e.vie > 0 ? (Math.random() < 0.3 ? 0.15 : 1) * clamp01(e.vie / 0.34 + 0.2) : 0;
      eclairCoeurMat.opacity = k; eclairHaloMat.opacity = k * 0.3;
      if (e.vie <= 0) { scene.remove(e.g); e.geos.forEach((g) => g.dispose()); eclairs.splice(i, 1); }
    }
    flash = Math.max(0, flash - d * 3.2);
    const fl = flash * (0.6 + Math.random() * 0.4);
    U.uFlash.value = fl; eclairLum.intensity = fl * 2.2; hemi.intensity = 0.55 + fl * 0.8;

    /* tempête : la mer grossit après la rupture */
    U.uStorm.value = t < E.shatter ? 0.55 : lerp(0.55, 0.85, smooth(E.shatter, E.reveal, t));
    pluieMat.opacity = 0.3 + fl * 0.4;

    /* runes, coiffes et prisme */
    const c0 = coeur(t);
    runes.rotation.z = t * 0.35; runes2.rotation.z = -t * 0.6;
    const charge = smooth(E.crack, E.shatter, t);
    runeMat.opacity = t < E.shatter ? 0.5 + charge * 0.5 + c0 * 0.4 : Math.max(0, 0.9 - (t - E.shatter) * 0.4);
    for (const c of coiffes) c.material.color.setRGB(0.66 + c0 * 0.4, 0.33 + c0 * 0.2, 0.97);
    if (t < E.shatter) {
      prisme.visible = true;
      prismeMesh.rotation.y += d * (0.5 + charge * 3);
      prisme.position.y = 2.6 + Math.sin(t * 2.2) * 0.12;
      if (charge > 0.6) prisme.position.x = (Math.random() - 0.5) * 0.06 * charge;
      anneau1.rotation.z += d * 1.4; anneau2.rotation.y -= d * 1.9;
      prismeMat.emissiveIntensity = 0.04 + charge * 0.3 + c0 * 0.55;
      prismeLum.intensity = 1.5 + charge * 6 + c0 * 10;
      const prog = Math.pow(charge, 1.3);
      fisGeo.setDrawRange(0, Math.floor(prog * PAS) * NF * 2);
      fisMat.opacity = 0.6 + c0 * 0.4;
      secousse += c0 * d * 0.6;
    }
    if (une('rupture', t, E.shatter)) {
      prisme.visible = false; prismeLum.intensity = 22; bloomKick = 1.4; caKick = 0.025; secousse += 0.7;
      eclats.forEach((e) => { e.m.visible = true; e.m.position.copy(e.p0); });
      for (let i = 0; i < NE; i++) { etPos[i * 3] = 0; etPos[i * 3 + 1] = 2.6; etPos[i * 3 + 2] = 0; }
      U.uShockR.value = 0;
    }
    if (t >= E.shatter) {
      // ralenti : les éclats volent à 16 % de leur vitesse, puis le temps reprend
      const vitesse = t < E.shatter + 0.75 ? 0.16 : lerp(0.16, 1, smooth(E.shatter + 0.75, E.shots[3], t));
      const ds = d * vitesse; tEclat += ds;
      for (const e of eclats) {
        if (!e.m.visible) continue;
        e.v.y -= 9.8 * ds; e.m.position.addScaledVector(e.v, ds);
        e.m.rotation.x += e.w.x * ds; e.m.rotation.y += e.w.y * ds;
        if (e.m.position.y < -1.6) e.m.visible = false;
      }
      for (let i = 0; i < NE; i++) { etPos[i * 3] += etVel[i].x * ds; etPos[i * 3 + 1] += etVel[i].y * ds; etPos[i * 3 + 2] += etVel[i].z * ds; }
      etGeo.attributes.position.needsUpdate = true;
      etincelles.material.opacity = Math.max(0, 1 - tEclat * 0.9);
      prismeLum.intensity = Math.max(0, prismeLum.intensity - d * 14);
      // onde de choc sur la mer
      const ts = t - E.shatter;
      U.uShockR.value = ts * 22; U.uShockA.value = Math.max(0, 1 - ts / 2.6);
      choc.scale.setScalar(Math.max(0.01, ts * 22)); choc.material.opacity = Math.max(0, 0.8 * (1 - ts / 2.6));
    }

    /* tourbillon, colonne d'eau, embruns */
    U.uVortex.value = smooth(E.shots[3], E.erupt, t) * (1 - smooth(E.reveal, E.reveal + 1.5, t) * 0.7);
    if (t >= E.erupt) {
      colonne.visible = true;
      const ce = t - E.erupt;
      let rad = 2.7, hauteur = 30 * easeOut(ce / 0.6), fade = Math.min(1, ce / 0.25);
      if (t >= E.reveal) { const b = t - E.reveal; rad = 2.7 + b * 14; fade = Math.max(0, 1 - b / 0.5); hauteur = 30 - b * 10; }
      colonne.scale.set(rad, Math.max(0.1, hauteur), rad);
      colMat.uniforms.uFade.value = fade;
      if (fade <= 0) colonne.visible = false;
    }
    if (une('jaillit', t, E.erupt)) { secousse += 0.35; bloomKick = Math.max(bloomKick, 0.6); projette(420, (e) => { const a = Math.random() * 6.28, rr = 2.5 + Math.random(); e.p.set(P.x + Math.cos(a) * rr, -1, P.z + Math.sin(a) * rr); e.v.set(Math.cos(a) * (2 + Math.random() * 5), 9 + Math.random() * 16, Math.sin(a) * (2 + Math.random() * 5)); e.vie = 2.5; }); }
    if (une('eclate', t, E.reveal)) projette(500, (e) => { const a = Math.random() * 6.28, y = Math.random() * 26; e.p.set(P.x + Math.cos(a) * 2.7, y - 1, P.z + Math.sin(a) * 2.7); e.v.set(Math.cos(a) * (8 + Math.random() * 12), 2 + Math.random() * 6, Math.sin(a) * (8 + Math.random() * 12)); e.vie = 2.2; });
    for (let i = 0; i < NS; i++) {
      const e = embruns[i];
      if (e.vie > 0) { e.vie -= d; e.v.y -= 14 * d; e.p.addScaledVector(e.v, d); if (e.p.y < -1.5) e.vie = 0; }
      if (e.vie <= 0) e.p.y = -60;
      embPos[i * 3] = e.p.x; embPos[i * 3 + 1] = e.p.y; embPos[i * 3 + 2] = e.p.z;
    }
    embGeo.attributes.position.needsUpdate = true;

    /* Lugia : montée dans la colonne, révélation, vol stationnaire */
    if (t >= E.rise) {
      lugia.visible = contour.visible = aura.visible = true;
      const m = clamp01((t - E.rise) / (E.eyes + 0.3 - E.rise));
      let y = lerp(-6, 7.6, easeOut(m)) + Math.sin(t * 1.8) * 0.25;
      if (t >= E.reveal) y = L.y + Math.sin(t * 1.6) * 0.35 + Math.exp(-(t - E.reveal) * 3) * 0.8;
      lugia.position.set(L.x + Math.sin(t * 0.7) * 0.15, y, L.z);
      const s = t < E.reveal ? 0.88 : lerp(0.88, 1, smooth(E.reveal, E.reveal + 0.5, t));
      lugia.scale.set(LW * s, LS * s, 1);
      const k = t < E.reveal ? 0 : smooth(E.reveal, E.reveal + 0.45, t);
      lugiaMat.color.setRGB(lerp(0.02, 1, k), lerp(0.015, 1, k), lerp(0.04, 1, k));
      versCam.copy(lugia.position).sub(camera.position).normalize();
      contour.position.copy(lugia.position).addScaledVector(versCam, 0.25);
      contour.scale.set(LW * s * 1.05, LS * s * 1.05, 1);
      contourMat.opacity = t < E.reveal ? smooth(E.rise, E.eyes, t) * 0.55 : 0.5 + Math.exp(-(t - E.reveal) * 2.5) * 0.6;
      aura.position.copy(lugia.position).addScaledVector(versCam, 1.2);
      aura.scale.setScalar(LS * 2.1 * (1 + Math.sin(t * 5) * 0.04));
      auraMat.opacity = t < E.reveal ? 0.25 * smooth(E.rise, E.eyes, t) : 0.55 + Math.sin(t * 4) * 0.08;
      lugiaLum.position.copy(lugia.position).add(V(0, 0, 3));
      lugiaLum.intensity = t < E.reveal ? 0 : 3 + Math.sin(t * 6) * 0.8;
    }
    // l'œil rouge
    const og = t < E.eyes ? 0 : t < E.reveal ? Math.exp(-(t - E.eyes) * 2.4) * 1.6 + 0.5 : 0.55 + Math.exp(-(t - E.reveal) * 3) + (t > E.charge && t < E.white ? smooth(E.charge, E.fire, t) * 0.8 : 0);
    if (une('yeux', t, E.eyes)) { bloomKick = Math.max(bloomKick, 0.5); caKick = Math.max(caKick, 0.012); }
    lueurOeil.position.copy(posOeil).addScaledVector(versCam.copy(camera.position).sub(posOeil).normalize(), 0.4);
    lueurOeil.material.opacity = Math.min(1, og);
    lueurOeil.scale.setScalar(0.9 + og * 1.6);
    trainee.position.copy(lueurOeil.position);
    trainee.material.opacity = Math.min(1, og * 0.8);
    trainee.scale.set(4 + og * 10, 0.22 + og * 0.12, 1);
    if (t >= E.white + 0.3) { lueurOeil.material.opacity *= 0.5; trainee.material.opacity *= 0.4; }

    /* le cri : onde dans l'air, tornade, fumée */
    if (une('cri', t, E.reveal)) { secousse += 0.8; bloomKick = Math.max(bloomKick, 1.2); caKick = 0.02; }
    const tc = t - E.reveal;
    if (tc >= 0 && tc < 1.6) {
      anneauCri.position.copy(lugia.position); anneauCri.quaternion.copy(camera.quaternion);
      const k = (tc % 0.8) / 0.8; anneauCri.scale.setScalar(1 + k * 34); anneauCri.material.opacity = (1 - k) * 0.75;
    } else anneauCri.material.opacity = 0;
    const tor = t < E.reveal ? 0 : t < E.white ? smooth(E.reveal, E.reveal + 1, t) * 0.5 + smooth(E.charge, E.fire, t) * 0.3 : 0.35;
    tornade.forEach((m, i) => { m.material.opacity = tor * (i === 1 ? 0.7 : 1); m.rotation.y = t * (1.4 + i * 0.4) * (t > E.charge && t < E.white ? 2.2 : 1); const c = t > E.charge && t < E.white ? 1 - smooth(E.charge, E.fire, t) * 0.35 : 1; m.scale.set(c, 1, c); });
    fumMat.opacity = t < E.rise ? 0 : t < E.reveal ? 0.25 : 0.45;
    for (let i = 0; i < NF2; i++) {
      const f = fumees[i]; f.a += d * (0.6 + f.s * 0.5); f.y += d * f.s * 1.2; if (f.y > 7) f.y = -6;
      fumPos[i * 3] = lugia.position.x + Math.cos(f.a) * f.d; fumPos[i * 3 + 1] = lugia.position.y + f.y; fumPos[i * 3 + 2] = lugia.position.z + Math.sin(f.a) * f.d * 0.6 - 1;
    }
    fumGeo.attributes.position.needsUpdate = true;

    /* l'Aéroblast */
    const enCharge = t >= E.charge && t < E.fire + 0.1;
    sphere.visible = enCharge || (t >= E.fire && t < E.white);
    const kc = smooth(E.charge, E.fire, t);
    if (sphere.visible) { sphere.position.copy(bouche); sphere.scale.setScalar((0.1 + kc * 0.75) * (1 + Math.sin(t * 40) * 0.06)); }
    halo.position.copy(bouche);
    halo.material.opacity = t >= E.charge && t < E.white + 0.4 ? Math.min(1, kc * 1.2) : 0;
    halo.scale.setScalar(1.5 + kc * 6 + (t > E.fire ? 2.5 : 0));
    chMat.opacity = enCharge ? 0.9 * Math.min(1, (t - E.charge) * 2) : 0;
    if (enCharge) {
      for (let i = 0; i < NC; i++) {
        const c = charges[i]; c.d -= c.v * d * (1 + kc * 2); if (c.d < 0.3) { c.d = 6 + Math.random() * 9; c.dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); }
        chPos[i * 3] = bouche.x + c.dir.x * c.d; chPos[i * 3 + 1] = bouche.y + c.dir.y * c.d; chPos[i * 3 + 2] = bouche.z + c.dir.z * c.d;
      }
      chGeo.attributes.position.needsUpdate = true;
      lugiaLum.intensity += kc * 8;
      secousse = Math.max(secousse, kc * 0.12);
      caKick = Math.max(caKick, kc * 0.008);
    }
    if (une('tir', t, E.fire)) { secousse += 1.4; bloomKick = 1.1; caKick = 0.045; }
    if (t >= E.fire && t < E.white + 0.2) {
      // le rayon file de la gueule vers la caméra en un quart de seconde, puis l'engloutit
      const k = smooth(E.fire, E.fire + 0.1, t), kl = smooth(E.fire, E.fire + 0.28, t);
      const dist = (bouche.distanceTo(camera.position) + 3) * Math.max(0.02, kl);
      for (const [m, rr, o] of [[rayCoeur, 0.45, 1], [rayHalo, 1.3, 0.7]]) {
        m.position.copy(bouche); m.lookAt(camera.position); m.scale.set(rr * k * (1 + Math.sin(t * 60) * 0.08), rr * k, dist);
        m.material.opacity = o * k;
      }
    } else { rayCoeur.material.opacity = 0; rayHalo.material.opacity = 0; }

    /* plan héroïque : la mer se calme un peu, la lueur respire */
    if (une('titre', t, E.title)) { bloomKick = Math.max(bloomKick, 0.9); secousse += 0.25; }

    /* pluie autour de la caméra */
    pluie.position.copy(camera.position);
    for (let i = 0; i < NP; i++) {
      const g = gouttes[i]; g.y -= g.v * d; g.x -= 7 * d;
      if (g.y < -14) { g.y += 44; g.x = (Math.random() - 0.5) * 70; g.z = (Math.random() - 0.5) * 70; }
      if (g.x < -35) g.x += 70;
      const o = i * 6; pluiePos[o] = g.x; pluiePos[o + 1] = g.y; pluiePos[o + 2] = g.z; pluiePos[o + 3] = g.x + 0.25; pluiePos[o + 4] = g.y + 1.2; pluiePos[o + 5] = g.z;
    }
    pluieGeo.attributes.position.needsUpdate = true;

    /* caméra */
    const c = plan(t);
    secousse = Math.max(0, secousse - d * 1.5 * (1 + secousse));
    const sx = (Math.sin(t * 47.0) + Math.sin(t * 29.3 + 1.7)) * 0.5, sy = (Math.sin(t * 41.0 + 0.6) + Math.sin(t * 23.9 + 2.9)) * 0.5;
    camera.position.copy(c.p).add(tmp.set(sx * secousse * 0.4, sy * secousse * 0.4, 0));
    camera.lookAt(c.l);
    roulis = Math.sin(t * 13.7) * secousse * 0.02;
    camera.rotateZ(roulis);
    if (Math.abs(camera.fov - c.f) > 0.01) { camera.fov = c.f; camera.updateProjectionMatrix(); }
    sky.position.copy(camera.position);

    /* rendu */
    bloomKick = Math.max(0, bloomKick - d * 2.2);
    caKick = Math.max(0, caKick - d * 0.06);
    if (composer) {
      bloom.strength = 0.5 + bloomKick + fl * 0.25;
      if (film) { film.uniforms.uCA.value = 0.0018 + caKick; film.uniforms.uTime.value = t; film.uniforms.uLift.value = fl * 0.02; }
      composer.render(d);
    } else renderer.render(scene, camera);
  };

  const dispose = () => {
    try { for (const e of eclairs) e.geos.forEach((g) => g.dispose()); } catch (e) { /* rien */ }
    for (const o of disposables) { try { o.dispose?.(); } catch (e) { /* rien */ } }
    try { bloom?.dispose?.(); composer?.dispose?.(); } catch (e) { /* rien */ }
    try { renderer.dispose(); } catch (e) { /* rien */ }
    try { renderer.domElement?.parentNode?.removeChild(renderer.domElement); } catch (e) { /* rien */ }
  };

  // repères pour l'interface (éclairs blancs, carton du lieu, titre) : cinematic.js les joue au bon moment
  const cues = [
    { t: 0.6, loc: 'in' }, { t: 3.0, loc: 'out' },
    { t: E.shatter, flash: '#f3e0ff', o: 0.95, ms: 150 },
    { t: E.eyes, flash: '#ff2a6a', o: 0.18, ms: 70 },
    { t: E.reveal, flash: '#ffffff', o: 0.7, ms: 110 },
    { t: E.fire + 0.32, blanc: true }, { t: E.white + 0.15, blanc: false },
    { t: E.title, title: 'in' }, { t: E.dur - 0.75, title: 'out' },
  ];
  return { update, resize, dispose, duration: E.dur, cues, shatterAt: E.shatter };
}
