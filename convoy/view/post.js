// Convoy Storm — post-traitement (même chaîne que Birdie Party, réglée pour la neige). La scène est rendue en couleurs
// linéaires (HDR, anticrénelage 4×) avec sa profondeur ; on en tire l'occlusion ambiante (le pied des wagons, des ruines
// et des sapins s'assombrit), un halo autour des lumières (foyer, phare, lanternes, fusées), puis la passe finale applique
// la tonalité, l'étalonnage (ombres froides, lumières chaudes ; la nuit, le tunnel et le Front qui approche le changent),
// une vignette et un grain léger.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// noyau d'échantillonnage de l'occlusion : points dans une demi-sphère, plus denses près du centre
function kernel(n) {
  const out = [];
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    // jamais rasant : un échantillon trop couché sur la surface la voit « s'occulter » elle-même (bandes sur le pont et le sol)
    const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, 0.35 + rnd() * 0.65).normalize();
    const k = i / n; v.multiplyScalar(0.15 + 0.85 * k * k);
    out.push(v);
  }
  return out;
}

export function createPost(renderer) {
  // profondeur en virgule flottante : assez précise pour retrouver les surfaces planes sans marches d'escalier
  const depth = new THREE.DepthTexture(1, 1); depth.type = THREE.FloatType;
  const main = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, depthTexture: depth });
  const lin = { type: THREE.HalfFloatType, depthBuffer: false };
  const aoRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const aoBlur = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const bloomA = new THREE.WebGLRenderTarget(1, 1, lin), bloomB = new THREE.WebGLRenderTarget(1, 1, lin);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); };

  const aoMat = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: depth }, uProj: { value: new THREE.Matrix4() }, uInv: { value: new THREE.Matrix4() }, uK: { value: kernel(16) }, uR: { value: 0.42 } },
    vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uInv; uniform vec3 uK[16]; uniform float uR;
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
        float r = uR * clamp(-p.z / 25.0, 0.6, 2.5), occ = 0.0;
        for (int i = 0; i < 16; i++) {
          vec3 k = uK[i];
          vec3 s = p + (t * k.x + b * k.y + n * k.z) * r;
          vec4 o = uProj * vec4(s, 1.0); vec2 su = o.xy / o.w * 0.5 + 0.5;
          float sz = vpos(su).z;
          float range = smoothstep(0.0, 1.0, r / max(0.001, abs(p.z - sz)));
          occ += step(s.z + 0.06 * r + 0.004 * -p.z, sz) * range;
        }
        float ao = 1.0 - occ / 16.0;
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
  // seuil du halo : la neige au soleil est presque blanche, on ne garde que ce qui brille vraiment (lumières, reflets)
  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: main.texture }, uThr: { value: 2.2 } },
    vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tColor; uniform float uThr;
      void main(){ vec3 c = texture2D(tColor, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); c = min(c, vec3(256.0)); float l = max(max(c.r, c.g), c.b); gl_FragColor = vec4(c * max(0.0, l - uThr) / max(l, 0.001), 1.0); }`,
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
  const G = { uNight: { value: 0 }, uStorm: { value: 0 }, uTun: { value: 0 } };
  const finalMat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: main.texture }, tAO: { value: aoBlur.texture }, tBloom: { value: bloomA.texture }, uAO: { value: 1 }, uBloom: { value: 0.35 }, uT: { value: 0 }, ...G },
    vertexShader: VERT, depthTest: false, depthWrite: false, toneMapped: true,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tAO; uniform sampler2D tBloom; uniform float uAO; uniform float uBloom; uniform float uT;
      uniform float uNight; uniform float uStorm; uniform float uTun;
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
        vec3 c = safeColor(tColor, vUv);
        float ao = texture2D(tAO, vUv).r; if (isnan(ao)) ao = 1.0;
        c *= mix(1.0, ao, 0.7 * uAO);
        vec3 bl = texture2D(tBloom, vUv).rgb; if (!bad3(bl)) c += bl * uBloom;
        // ombres bleutées, lumières un peu chaudes ; la nuit tire vers le bleu
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c *= mix(vec3(0.9, 0.97, 1.1), vec3(1.04, 1.0, 0.95), smoothstep(0.04, 0.9, l));
        c *= mix(vec3(1.0), vec3(0.82, 0.9, 1.12), uNight * 0.7);
        // vignette : plus serrée dans le tunnel et quand le Front approche
        vec2 q = vUv - 0.5;
        float vig = smoothstep(0.85 - 0.18 * uStorm - 0.2 * uTun, 0.2, length(q * vec2(1.12, 1.0)));
        c *= mix(0.7 - 0.2 * uStorm - 0.25 * uTun, 1.0, vig);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // contraste et saturation légers (la tempête délave les couleurs), grain contre les bandes de dégradé
        vec3 g = gl_FragColor.rgb;
        g = (g - 0.5) * (1.13 + 0.05 * uStorm) + 0.5;
        g = mix(vec3(dot(g, vec3(0.299, 0.587, 0.114))), g, 1.12 - 0.4 * uStorm);
        g += (fract(sin(dot(gl_FragCoord.xy + uT, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (1.0 + 4.0 * uStorm) / 255.0;
        gl_FragColor.rgb = clamp(g, 0.0, 1.0);
      }`,
  });

  const q = { ao: true, bloom: true };
  let W = 1, H = 1;
  return {
    q, main,
    // étalonnage du moment : nuit (0 → 1), Front proche (0 → 1), tunnel (0 → 1) ; seuil du halo (plus bas la nuit)
    grade(night, storm, tun) { G.uNight.value = night; G.uStorm.value = storm; G.uTun.value = tun; brightMat.uniforms.uThr.value = 2.2 - 1.3 * Math.max(night, tun); },
    setSize(w, h) {
      W = w; H = h;
      main.setSize(w, h);
      aoRT.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); aoBlur.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
      bloomA.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2)); bloomB.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
      blurMat.uniforms.uTexel.value.set(3 / w, 3 / h);
    },
    render(scene, camera, t) {
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
      finalMat.uniforms.uAO.value = q.ao ? 1 : 0; finalMat.uniforms.uBloom.value = q.bloom ? 0.35 : 0; finalMat.uniforms.uT.value = t % 100;
      pass(finalMat, null);
    },
    dispose() {
      for (const r of [main, aoRT, aoBlur, bloomA, bloomB]) r.dispose();
      depth.dispose();
      for (const m of [aoMat, blurMat, brightMat, gaussMat, finalMat]) m.dispose();
      quad.geometry.dispose();
    },
  };
}
