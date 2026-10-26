// L'eau : la mer (un grand plan au niveau 0 qui file jusqu'à l'horizon), le lac (un plan à son niveau, découpé à sa
// forme) et la rivière (un ruban qui descend du lac à la mer). Couleur selon la profondeur (lue dans une image cuite
// depuis l'île), vaguelettes, reflet du ciel, éclat du soleil et écume au bord.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const MAXD = 12; // profondeur codée dans l'image (m)

function depthImage(map) {
  const N = map.n, H = map.heights, WK = map.water, WL = map.waterLevel;
  const data = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    const d = WK[k] ? WL[k] - H[k] : Math.max(0, -H[k]);
    data[k * 4] = Math.max(0, Math.min(255, (d / MAXD) * 255));
    data[k * 4 + 1] = WK[k] * 80;
    data[k * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}

export function buildWater(map, { noise, sunDir, sky }) {
  const depth = depthImage(map);
  const T = { value: 0 };
  const make = (lake, shallow, deep) => new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uDepth: { value: null }, uNoise: { value: null }, uN: { value: map.n }, uHR: { value: map.hres }, uT: { value: 0 }, uLake: { value: lake },
      uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color(0xfff2da) }, uSky: { value: new THREE.Color(sky.horizon) },
      uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) },
    }]),
    vertexShader: `varying vec3 vW;
      #include <common>
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vW;
      uniform sampler2D uDepth; uniform sampler2D uNoise; uniform float uN; uniform float uHR; uniform float uT; uniform float uLake;
      uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uShallow; uniform vec3 uDeep;
      #include <common>
      #include <fog_pars_fragment>
      void main(){
        vec2 uv = (vW.xz / uHR + 0.5) / uN;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        vec4 d = texture2D(uDepth, clamp(uv, 0.0, 1.0));
        float depth = mix(${MAXD.toFixed(1)}, d.r * ${MAXD.toFixed(1)}, inside);
        // le plan du lac ne se montre qu'au-dessus du lac
        if (uLake > 0.5 && (inside < 0.5 || d.g < 0.45 || d.r <= 0.0)) discard;
        vec2 p = vW.xz;
        float n1 = texture2D(uNoise, p / 23.0 + vec2(uT * 0.011, uT * 0.007)).r;
        float n2 = texture2D(uNoise, p / 8.0 - vec2(uT * 0.019, -uT * 0.013)).g;
        vec3 nrm = normalize(vec3((n1 - 0.5) * 0.32 + (n2 - 0.5) * 0.22, 1.0, (n2 - 0.5) * 0.32 - (n1 - 0.5) * 0.18));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(nrm, V), 0.0), 4.0);
        float df = smoothstep(0.0, uLake > 0.5 ? 5.0 : 8.0, depth);
        vec3 col = mix(uShallow, uDeep, df);
        col = mix(col, uSky, clamp(fres * 0.65, 0.0, 0.8));
        vec3 Hh = normalize(normalize(uSun) + V);
        col += uSunCol * pow(max(dot(nrm, Hh), 0.0), 240.0) * 2.2;
        // écume qui va et vient au bord
        float wave = 0.5 + 0.5 * sin(uT * 1.3 - depth * 6.0 + n1 * 4.0);
        float foam = (1.0 - smoothstep(0.0, 0.5 + 0.25 * wave, depth)) * smoothstep(0.3, 0.6, texture2D(uNoise, p / 3.5 + uT * 0.02).b + 0.2);
        col = mix(col, vec3(0.93, 0.97, 0.97), foam * 0.85);
        float alpha = max(mix(0.5, 0.97, smoothstep(0.0, 2.2, depth)), foam);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mSea = make(0, 0x4ec3c4, 0x15558f), mLake = make(1, 0x58b8b9, 0x1d5f7d), mRiver = make(0, 0x5ab7b4, 0x2a6f86);
  const mats = [mSea, mLake, mRiver];
  for (const m of mats) { m.uniforms.uDepth.value = depth; m.uniforms.uNoise.value = noise; m.uniforms.uSun.value.copy(sunDir); m.uniforms.uT = T; }
  const group = new THREE.Group();
  const C = map.center;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2).translate(C, 0, C), mSea);
  sea.renderOrder = 2; group.add(sea);
  const L = map.lake, R = Math.max(L.a, L.b) * 1.9;
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2, 1, 1).rotateX(-Math.PI / 2).translate(L.x, L.level, L.z), mLake);
  lake.renderOrder = 2; group.add(lake);
  if (map.river) {
    const P = map.river.pts, pos = [], idx = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const w = P[i].hw + 3.5;
      // le ruban reste au niveau de l'eau : celui du lac au départ, la mer à l'arrivée
      for (const sd of [-1, 1]) pos.push(P[i].x - tz * w * sd, Math.max(0, P[i].lv), P[i].z + tx * w * sd);
      if (i < P.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const river = new THREE.Mesh(g, mRiver); river.renderOrder = 2; group.add(river);
  }
  return {
    group,
    update(t, sun) { T.value = t; if (sun) for (const m of mats) m.uniforms.uSun.value.copy(sun); },
    dispose() { group.traverse((o) => o.isMesh && o.geometry.dispose()); for (const m of mats) m.dispose(); depth.dispose(); },
  };
}
