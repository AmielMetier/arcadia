// Site Noir : la passe d'image. La scène se dessine dans une texture en valeurs hautes, puis : halo autour des lumières, exposition (l'œil s'habitue au noir), ACES,
// et pour les enquêteurs le rendu d'un vieux caméscope, discret : grain, couleurs qui bavent un peu, bande qui ondule à peine. Le monstre voit net.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT = `uniform sampler2D tScene; varying vec2 vUv;
void main(){ vec3 c = texture2D(tScene, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float k = smoothstep(0.7, 1.9, l); gl_FragColor = vec4(min(c, vec3(6.0)) * k, 1.0); }`;
const BLUR = `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.2;
  c += (texture2D(tSrc, vUv + uDir * 1.4).rgb + texture2D(tSrc, vUv - uDir * 1.4).rgb) * 0.24;
  c += (texture2D(tSrc, vUv + uDir * 3.3).rgb + texture2D(tSrc, vUv - uDir * 3.3).rgb) * 0.12;
  c += (texture2D(tSrc, vUv + uDir * 5.2).rgb + texture2D(tSrc, vUv - uDir * 5.2).rgb) * 0.04;
  gl_FragColor = vec4(c, 1.0); }`;
const FINAL = `uniform sampler2D tScene, tBloom; uniform vec2 uRes; uniform float uT, uVhs, uExp, uBloom; varying vec2 vUv;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec3 aces(vec3 x){ x *= 0.6; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 c = vUv - 0.5; float r2 = dot(c, c);
  // objectif grand angle, juste assez pour courber les bords
  vec2 uv = 0.5 + c * (1.0 - 0.018 + 0.05 * r2);
  float frame = floor(uT * 24.0);
  // la bande ondule : deux lentes vagues et un tremblement de ligne
  float line = floor(uv.y * 270.0);
  uv.x += uVhs * (sin(uv.y * 34.0 + uT * 1.7) * 0.00022 + sin(uv.y * 5.0 - uT * 0.6) * 0.0004 + (hash(vec2(line, frame)) - 0.5) * 0.00042);
  // les couleurs bavent à l'horizontale, davantage sur les bords
  float s = uVhs * (0.0009 + r2 * 0.0026);
  vec3 col = vec3(texture2D(tScene, uv + vec2(s, 0.0)).r, texture2D(tScene, uv).g, texture2D(tScene, uv - vec2(s * 1.2, 0.0)).b);
  col += texture2D(tBloom, uv).rgb * uBloom;
  col = aces(col * uExp);
  col = toSRGB(col);
  // vignette de l'optique
  col *= 1.0 - smoothstep(0.16, 0.62, r2) * mix(0.35, 0.55, uVhs);
  float lum = dot(col, vec3(0.3, 0.59, 0.11));
  if (uVhs > 0.0) {
    // noirs un peu levés, couleurs fatiguées
    col = mix(col, vec3(lum), 0.14 * min(uVhs, 1.0));
    col = col * 0.965 + vec3(0.016, 0.02, 0.024) * min(uVhs, 1.0);
    // grain : plus fort dans les ombres, à peine teinté, change 24 fois par seconde
    vec2 gp = floor(gl_FragCoord.xy / 1.5);
    float g = hash(gp + frame * 17.0) - 0.5, g2 = hash(gp.yx + frame * 5.0) - 0.5;
    float amp = uVhs * mix(0.075, 0.03, smoothstep(0.0, 0.55, lum));
    col += vec3(g + g2 * 0.22, g, g - g2 * 0.22) * amp;
    // lignes de balayage presque invisibles
    col *= 1.0 - uVhs * 0.022 * (0.5 + 0.5 * sin(vUv.y * uRes.y * 1.57));
    // tout en bas, la bande de suivi qui frémit
    float band = smoothstep(0.018, 0.0, vUv.y) * step(0.62, hash(vec2(line, frame)));
    col += band * uVhs * 0.09;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createPost(renderer, { samples = 4, bloom = true } = {}) {
  const ok = renderer.capabilities.isWebGL2 !== false && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  if (!ok) return null;
  const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const rt = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: true, samples });
  const b0 = new THREE.WebGLRenderTarget(4, 4, opts), b1 = new THREE.WebGLRenderTarget(4, 4, opts);
  const fsScene = new THREE.Scene(), fsCam = new THREE.Camera();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(geo); quad.frustumCulled = false; fsScene.add(quad);
  const shader = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const mBright = shader(BRIGHT, { tScene: { value: rt.texture } });
  const mBlur = shader(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
  const mFinal = shader(FINAL, { tScene: { value: rt.texture }, tBloom: { value: b0.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 }, uVhs: { value: 1 }, uExp: { value: 1 }, uBloom: { value: 0.75 } });
  let bw = 1, bh = 1, useBloom = bloom;
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); };
  return {
    setSize(w, h) { rt.setSize(w, h); bw = Math.max(2, w >> 2); bh = Math.max(2, h >> 2); b0.setSize(bw, bh); b1.setSize(bw, bh); mFinal.uniforms.uRes.value.set(w, h); },
    setBloom(v) { useBloom = v; },
    render(scene, camera, { time, vhs, exposure }) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      if (useBloom) {
        pass(mBright, b0);
        mBlur.uniforms.tSrc.value = b0.texture; mBlur.uniforms.uDir.value.set(1 / bw, 0); pass(mBlur, b1);
        mBlur.uniforms.tSrc.value = b1.texture; mBlur.uniforms.uDir.value.set(0, 1 / bh); pass(mBlur, b0);
      }
      const u = mFinal.uniforms;
      u.uT.value = time; u.uVhs.value = vhs; u.uExp.value = exposure; u.uBloom.value = useBloom ? 0.75 : 0;
      pass(mFinal, null);
    },
    dispose() { rt.dispose(); b0.dispose(); b1.dispose(); geo.dispose(); mBright.dispose(); mBlur.dispose(); mFinal.dispose(); },
  };
}
