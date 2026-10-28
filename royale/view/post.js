// Battle royale (repris de Birdie Party) — post-traitement. La scène est rendue en couleurs linéaires (HDR, anticrénelage 4×) avec sa profondeur ;
// on en tire l'occlusion ambiante (les creux, le pied des arbres et des golfeurs s'assombrissent), un halo sur les
// éclats de soleil, puis la passe finale applique la tonalité, une vignette et l'étalonnage des couleurs.
// Island Rush y ajoute (voir createPost : fx) des rayons de soleil entre les arbres et les maisons, une brume au ras du
// sol et de la mer, et les réactions de l'écran : onde de choc et chaleur des explosions, coups encaissés (couleurs qui
// se séparent, éclat bleu du bouclier, image qui pâlit et bat quand la vie est basse), flou de vitesse, éclair d'orage.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// noyau d'échantillonnage de l'occlusion : points dans une demi-sphère, plus denses près du centre
function kernel(n) {
  const out = [];
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd()).normalize();
    const k = i / n; v.multiplyScalar(0.15 + 0.85 * k * k);
    out.push(v);
  }
  return out;
}

export function createPost(renderer) {
  // profondeur en 32 bits flottants : assez précise au loin (sinon l'occlusion dessine des bandes)
  const depth = new THREE.DepthTexture(1, 1); depth.type = THREE.FloatType;
  const main = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, depthTexture: depth });
  const lin = { type: THREE.HalfFloatType, depthBuffer: false };
  const aoRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const aoBlur = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const bloomA = new THREE.WebGLRenderTarget(1, 1, lin), bloomB = new THREE.WebGLRenderTarget(1, 1, lin);
  const raysRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); };

  const aoMat = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: depth }, uProj: { value: new THREE.Matrix4() }, uInv: { value: new THREE.Matrix4() }, uK: { value: kernel(14) }, uR: { value: 0.75 } },
    vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uInv; uniform vec3 uK[14]; uniform float uR;
      vec3 vpos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 c = uInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return c.xyz / c.w; }
      void main(){
        float d = texture2D(tDepth, vUv).x;
        if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
        vec3 p = vpos(vUv);
        // dérivées nulles (surface vue de très loin, précision de la profondeur) : pas d'occlusion plutôt qu'une
        // normale invalide, que certaines cartes graphiques rendent en carrés noirs
        vec3 cr = cross(dFdx(p), dFdy(p));
        float cl = dot(cr, cr);
        if (!(cl > 1e-24) || isinf(cl)) { gl_FragColor = vec4(1.0); return; }
        vec3 n = cr * inversesqrt(cl);
        // repère tourné au hasard par pixel (bruit à gradient entrelacé), lissé ensuite par le flou
        float a = 6.2831 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        vec3 t = normalize(cross(n, abs(n.y) < 0.9 ? vec3(cos(a), 0.0, sin(a)) : vec3(cos(a), sin(a), 0.0))), b = cross(n, t);
        // l'occlusion ne concerne que le premier plan : au loin, elle s'efface
        float far = smoothstep(60.0, 140.0, -p.z);
        if (far >= 1.0) { gl_FragColor = vec4(1.0); return; }
        float r = uR * clamp(-p.z / 12.0, 0.6, 3.0), occ = 0.0;
        for (int i = 0; i < 14; i++) {
          vec3 k = uK[i];
          vec3 s = p + (t * k.x + b * k.y + n * k.z) * r;
          vec4 o = uProj * vec4(s, 1.0); vec2 su = o.xy / o.w * 0.5 + 0.5;
          float sz = vpos(su).z;
          float range = smoothstep(0.0, 1.0, r / max(0.001, abs(p.z - sz)));
          occ += step(s.z + 0.02 * r, sz) * range;
        }
        float ao = mix(1.0 - occ / 14.0, 1.0, far);
        gl_FragColor = vec4(vec3(isnan(ao) ? 1.0 : clamp(ao, 0.0, 1.0)), 1.0);
      }`,
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tAO: { value: aoRT.texture }, tDepth: { value: depth }, uTexel: { value: new THREE.Vector2() }, uNear: { value: 0.1 }, uFar: { value: 1000 } },
    vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tAO; uniform sampler2D tDepth; uniform vec2 uTexel; uniform float uNear; uniform float uFar;
      float lz(vec2 uv){ float d = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - d * (uFar - uNear)); }
      void main(){
        float z0 = lz(vUv), sum = 0.0, w = 0.0;
        for (int x = -2; x <= 2; x++) for (int y = -2; y <= 2; y++) {
          vec2 uv = vUv + vec2(float(x), float(y)) * uTexel;
          float k = exp(-abs(lz(uv) - z0) / (0.04 * z0 + 0.05));
          sum += texture2D(tAO, uv).r * k; w += k;
        }
        gl_FragColor = vec4(vec3(sum / w), 1.0);
      }`,
  });
  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: main.texture }, uThr: { value: 1.6 } },
    vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tColor; uniform float uThr;
      void main(){ vec3 c = texture2D(tColor, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); c = min(c, vec3(256.0)); float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); gl_FragColor = vec4(c * max(0.0, l - uThr) / max(l, 0.001), 1.0); }`,
  });
  const gaussMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform vec2 uDir;
      void main(){
        vec3 c = texture2D(tex, vUv).rgb * 0.2270270270;
        c += (texture2D(tex, vUv + uDir * 1.3846153846).rgb + texture2D(tex, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
        c += (texture2D(tex, vUv + uDir * 3.2307692308).rgb + texture2D(tex, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  // rayons de soleil : depuis chaque pixel, on remonte vers le soleil à l'écran en comptant le ciel dégagé autour de
  // lui ; arbres, toits et reliefs y découpent des faisceaux (quart de la définition, assez pour une lumière diffuse)
  const raysMat = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: depth }, uSun: { value: new THREE.Vector3() }, uAspect: { value: 1 } },
    vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tDepth; uniform vec3 uSun; uniform float uAspect;
      void main(){
        vec2 d = (uSun.xy - vUv) * (0.9 / 28.0), uv = vUv;
        float sum = 0.0, decay = 1.0;
        for (int i = 0; i < 28; i++) {
          uv += d;
          vec2 q = (uv - uSun.xy) * vec2(uAspect, 1.0);
          float sky = step(0.99999, texture2D(tDepth, clamp(uv, 0.001, 0.999)).x);
          sum += sky * exp(-dot(q, q) * 9.0) * decay;
          decay *= 0.96;
        }
        gl_FragColor = vec4(vec3(sum / 28.0), 1.0);
      }`,
  });
  const MAXW = 4;
  const finalMat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: main.texture }, tAO: { value: aoBlur.texture }, tBloom: { value: bloomA.texture }, uAO: { value: 1 }, uBloom: { value: 0.28 }, uT: { value: 0 },
      tDepth: { value: depth }, tRays: { value: raysRT.texture }, uInv: { value: new THREE.Matrix4() }, uCamW: { value: new THREE.Matrix4() }, uAspect: { value: 1 },
      uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uRays: { value: 0 }, uMist: { value: 0 }, uMistCol: { value: new THREE.Color() },
      uWaves: { value: Array.from({ length: MAXW }, () => new THREE.Vector4()) }, uHurt: { value: 0 }, uShield: { value: 0 }, uLow: { value: 0 }, uSpeed: { value: 0 }, uFlash: { value: 0 },
    },
    vertexShader: VERT, depthTest: false, depthWrite: false, toneMapped: true,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tAO; uniform sampler2D tBloom; uniform float uAO; uniform float uBloom; uniform float uT;
      uniform sampler2D tDepth; uniform sampler2D tRays; uniform mat4 uInv; uniform mat4 uCamW; uniform float uAspect;
      uniform vec3 uSun; uniform vec3 uSunCol; uniform float uRays; uniform float uMist; uniform vec3 uMistCol;
      uniform vec4 uWaves[${MAXW}]; uniform float uHurt; uniform float uShield; uniform float uLow; uniform float uSpeed; uniform float uFlash;
      float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y); }
      // une valeur invalide (NaN, infini) sortie d'un calcul de la scène s'afficherait en noir (et le halo l'étalerait
      // en carrés) : on la remplace par la moyenne des voisins valides
      bool bad3(vec3 v){ return any(isnan(v)) || any(isinf(v)); }
      vec3 safeColor(sampler2D t, vec2 uv){
        vec3 c = texture2D(t, uv).rgb;
        if (!bad3(c)) return min(c, vec3(60000.0));
        vec2 px = 2.0 / vec2(textureSize(t, 0));
        vec3 s = vec3(0.0); float n = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 o = (i < 2 ? vec2(i == 0 ? 1.0 : -1.0, 0.0) : vec2(0.0, i == 2 ? 1.0 : -1.0)) * px;
          vec3 q = texture2D(t, uv + o).rgb;
          if (!bad3(q)) { s += q; n += 1.0; }
        }
        return n > 0.0 ? min(s / n, vec3(60000.0)) : vec3(0.0);
      }
      void main(){
        // ondes de choc et chaleur des explosions : l'image se déforme autour du point (anneau qui s'élargit, puis
        // air qui tremble)
        vec2 uv = vUv;
        for (int i = 0; i < ${MAXW}; i++) {
          vec4 w = uWaves[i];
          if (w.w <= 0.0) continue;
          vec2 dv = (vUv - w.xy) * vec2(uAspect, 1.0);
          float L = length(dv), R = w.w * min(1.0, w.z * 3.0);
          float ring = exp(-pow((L - R) / (0.12 * w.w + 0.004), 2.0)) * (1.0 - w.z) * (1.0 - w.z);
          float heat = smoothstep(w.w * 0.8, 0.0, L) * sin(w.z * 3.14159);
          vec2 dir = L > 1e-4 ? dv / L : vec2(0.0);
          uv += (dir * ring * 0.03 + vec2(sin(vUv.y * 140.0 + uT * 23.0), cos(vUv.x * 120.0 + uT * 19.0)) * heat * 0.0035) / vec2(uAspect, 1.0);
        }
        vec2 dc = uv - 0.5;
        vec3 c = safeColor(tColor, uv);
        // coup encaissé : les couleurs se séparent vers les bords
        if (uHurt > 0.01) { vec2 o = dc * uHurt * 0.018; c.r = safeColor(tColor, uv + o).r; c.b = safeColor(tColor, uv - o).b; }
        // vitesse (chute libre, deltaplane, tremplin) : l'image file vers les bords
        if (uSpeed > 0.01) {
          float k = uSpeed * smoothstep(0.12, 0.6, length(dc));
          vec3 acc = c;
          for (int i = 1; i < 6; i++) acc += safeColor(tColor, uv - dc * k * 0.028 * float(i));
          c = acc / 6.0;
        }
        float ao = texture2D(tAO, uv).r; if (isnan(ao)) ao = 1.0;
        c *= mix(1.0, ao * sqrt(ao), 0.7 * uAO);
        vec3 bl = texture2D(tBloom, uv).rgb; if (!bad3(bl)) c += bl * uBloom;
        // brume au ras du sol et de la mer, en nappes qui dérivent : légère tout près, épaisse au loin et dans les creux
        float d = texture2D(tDepth, uv).x;
        if (uMist > 0.0 && d < 0.99999) {
          vec4 vp = uInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vec3 v = vp.xyz / vp.w, wp = (uCamW * vec4(v, 1.0)).xyz;
          float n = vnoise(wp.xz * 0.018 + uT * vec2(0.012, 0.007)) * 0.6 + vnoise(wp.xz * 0.05 - uT * 0.01) * 0.4;
          float dens = exp(-max(0.0, wp.y - 0.5) / 5.0) * (0.45 + 0.75 * n);
          float m = (1.0 - exp(-length(v) * 0.011 * dens)) * uMist;
          c = mix(c, uMistCol, clamp(m, 0.0, 0.85));
        }
        // rayons de soleil
        if (uRays > 0.0) c += uSunCol * texture2D(tRays, uv).r * uRays;
        // lumière du soleil un peu chaude, ombres un peu froides
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c *= mix(vec3(0.97, 1.0, 1.05), vec3(1.03, 1.0, 0.96), smoothstep(0.05, 0.8, l));
        // bouclier touché : un éclat bleu ondule sur les bords
        float edge = smoothstep(0.3, 0.75, length(dc * vec2(1.15, 1.0)));
        if (uShield > 0.01) c += vec3(0.25, 0.7, 1.0) * 0.6 * uShield * edge * (0.65 + 0.35 * sin(dc.x * 70.0 + dc.y * 45.0 + uT * 14.0));
        // vie basse : l'image pâlit et ses bords s'assombrissent au rythme d'un cœur
        if (uLow > 0.01) {
          float beat = pow(max(0.0, sin(uT * 7.5)), 6.0), g = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(c, vec3(g), 0.45 * uLow);
          c *= 1.0 - uLow * edge * (0.3 + 0.35 * beat);
        }
        // éclair d'orage
        c += vec3(0.75, 0.72, 1.0) * uFlash;
        // vignette douce
        vec2 q = vUv - 0.5; c *= mix(0.74, 1.0, smoothstep(0.82, 0.22, length(q * vec2(1.15, 1.0))));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // contraste et saturation légers, grain contre les bandes de dégradé
        vec3 g = gl_FragColor.rgb;
        g = (g - 0.5) * 1.08 + 0.5;
        g = mix(vec3(dot(g, vec3(0.299, 0.587, 0.114))), g, 1.06);
        g += (fract(sin(dot(gl_FragCoord.xy + uT, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor.rgb = clamp(g, 0.0, 1.0);
      }`,
  });

  const q = { ao: true, bloom: true, fx: true };
  let W = 1, H = 1;
  return {
    q, main,
    setSize(w, h) {
      W = w; H = h;
      // anticrénelage 4× ; 2× sur les grandes images (l'essentiel du coût de la carte graphique)
      const samples = w * h > 2.6e6 ? 2 : 4;
      if (main.samples !== samples) { main.dispose(); main.samples = samples; }
      main.setSize(w, h);
      aoRT.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); aoBlur.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
      bloomA.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2)); bloomB.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
      raysRT.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
      blurMat.uniforms.uTexel.value.set(2 / w, 2 / h);
    },
    // fx : { sun (x, y à l'écran entre 0 et 1, z : force selon qu'il est dans le champ), sunCol, rays, mist, mistCol,
    // waves [{ x, y, age (0 → 1), r (rayon, en hauteur d'écran) }], hurt, shield, low, speed, flash }
    render(scene, camera, t, fx = null) {
      renderer.setRenderTarget(main);
      renderer.render(scene, camera);
      if (q.ao) {
        aoMat.uniforms.uProj.value.copy(camera.projectionMatrix);
        aoMat.uniforms.uInv.value.copy(camera.projectionMatrixInverse);
        blurMat.uniforms.uNear.value = camera.near; blurMat.uniforms.uFar.value = camera.far;
        pass(aoMat, aoRT);
        pass(blurMat, aoBlur);
      }
      if (q.bloom) {
        pass(brightMat, bloomA);
        gaussMat.uniforms.tex.value = bloomA.texture; gaussMat.uniforms.uDir.value.set(4 / W, 0); pass(gaussMat, bloomB);
        gaussMat.uniforms.tex.value = bloomB.texture; gaussMat.uniforms.uDir.value.set(0, 4 / H); pass(gaussMat, bloomA);
        gaussMat.uniforms.tex.value = bloomA.texture; gaussMat.uniforms.uDir.value.set(9 / W, 0); pass(gaussMat, bloomB);
        gaussMat.uniforms.tex.value = bloomB.texture; gaussMat.uniforms.uDir.value.set(0, 9 / H); pass(gaussMat, bloomA);
      }
      const F = finalMat.uniforms, sunOn = !!(q.fx && fx && fx.rays > 0 && fx.sun.z > 0.01);
      if (sunOn) { raysMat.uniforms.uSun.value.copy(fx.sun); raysMat.uniforms.uAspect.value = W / H; pass(raysMat, raysRT); }
      F.uAO.value = q.ao ? 1 : 0; F.uBloom.value = q.bloom ? 0.28 : 0; F.uT.value = t % 100;
      F.uAspect.value = W / H;
      F.uRays.value = sunOn ? fx.rays * fx.sun.z : 0;
      F.uMist.value = q.fx && fx ? fx.mist : 0;
      if (fx) {
        F.uSun.value.copy(fx.sun); F.uSunCol.value.copy(fx.sunCol); F.uMistCol.value.copy(fx.mistCol);
        F.uInv.value.copy(camera.projectionMatrixInverse); F.uCamW.value.copy(camera.matrixWorld);
        for (let i = 0; i < MAXW; i++) { const w = fx.waves[i]; if (w) F.uWaves.value[i].set(w.x, w.y, w.age, w.r); else F.uWaves.value[i].set(0, 0, 0, 0); }
        F.uHurt.value = fx.hurt; F.uShield.value = fx.shield; F.uLow.value = fx.low; F.uSpeed.value = fx.speed; F.uFlash.value = fx.flash;
      }
      pass(finalMat, null);
    },
    dispose() {
      for (const r of [main, aoRT, aoBlur, bloomA, bloomB, raysRT]) r.dispose();
      depth.dispose();
      for (const m of [aoMat, blurMat, brightMat, gaussMat, raysMat, finalMat]) m.dispose();
      quad.geometry.dispose();
    },
  };
}
