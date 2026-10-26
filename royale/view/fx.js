// Les effets : traînées de balles, éclairs de bouche, impacts (poussière, étincelles), explosions (boule de feu,
// fumée, éclair de lumière), roquettes et grenades en vol, et le mur violet de la tempête.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

function spriteTex(draw, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const radial = (stops) => spriteTex((g, S) => {
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [o, c] of stops) grd.addColorStop(o, c);
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
});

export function createFx(scene) {
  const group = new THREE.Group(); scene.add(group);
  const own = [];
  const T = {
    glow: radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,230,160,.9)'], [1, 'rgba(255,160,40,0)']]),
    puff: radial([[0, 'rgba(255,255,255,.9)'], [0.6, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]),
  };
  own.push(...Object.values(T));
  // ------------------------------------------------------------------ traînées : bâtonnets lumineux étirés
  const N = 96;
  const trGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 5, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const trMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracers = new THREE.InstancedMesh(trGeo, trMat, N); tracers.frustumCulled = false; tracers.count = N;
  own.push(trGeo, trMat); group.add(tracers);
  const trList = Array.from({ length: N }, () => ({ life: 0, max: 0.1, from: new THREE.Vector3(), to: new THREE.Vector3(), color: new THREE.Color() }));
  let trNext = 0;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  // couleur par instance créée d'emblée (le shader la prévoit dès la première image)
  for (let i = 0; i < N; i++) { tracers.setMatrixAt(i, zero); tracers.setColorAt(i, new THREE.Color(0)); }
  // ------------------------------------------------------------------ sprites (éclairs, impacts, explosions, fumée)
  const pool = [];
  function sprite(tex, color, blending) {
    let s = pool.find((p) => !p.on && p.tex === tex && p.blend === blending);
    if (!s) {
      const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending });
      const o = new THREE.Sprite(m); group.add(o);
      s = { o, m, tex, blend: blending, on: false };
      pool.push(s); own.push(m);
    }
    s.on = true; s.o.visible = true; s.m.color.set(color);
    return s;
  }
  const live = [];
  function puff(x, y, z, { tex = T.puff, color = 0xffffff, size = 0.5, grow = 2, life = 0.5, add = false, rise = 0, op = 0.8 } = {}) {
    const s = sprite(tex, color, add ? THREE.AdditiveBlending : THREE.NormalBlending);
    s.o.position.set(x, y, z); s.o.scale.setScalar(size);
    live.push({ s, t: 0, life, size, grow, rise, op });
  }
  // lumière partagée des explosions
  const flash = new THREE.PointLight(0xffa040, 0, 30, 1.6); group.add(flash);
  let flashT = 0;
  // ------------------------------------------------------------------ projectiles en vol
  const rocketGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8).rotateX(Math.PI / 2), rocketMat = new THREE.MeshStandardMaterial({ color: 0x4f6a3a });
  const nadeGeo = new THREE.SphereGeometry(0.09, 10, 8), nadeMat = new THREE.MeshStandardMaterial({ color: 0x4f6a3a }), blastMat = new THREE.MeshStandardMaterial({ color: 0x9b59d0, emissive: 0x3a1a6a });
  own.push(rocketGeo, rocketMat, nadeGeo, nadeMat, blastMat);
  const projMeshes = new Map();
  // ------------------------------------------------------------------ tempête : un grand cylindre violet translucide
  const stormMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uT;
      void main(){
        float a = atan(vW.z, vW.x);
        float s = sin(a * 60.0 + uT * 1.5 + vW.y * 0.05) * 0.5 + 0.5;
        float s2 = sin(a * 23.0 - uT * 0.8 + vW.y * 0.11) * 0.5 + 0.5;
        float fade = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
        vec3 c = mix(vec3(0.42, 0.16, 0.78), vec3(0.75, 0.45, 1.0), s * s2);
        gl_FragColor = vec4(c, (0.28 + 0.22 * s) * fade);
      }`,
  });
  const storm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128, 1, true).translate(0, 0.5, 0), stormMat);
  storm.frustumCulled = false; storm.visible = false; storm.renderOrder = 5; group.add(storm);
  own.push(storm.geometry, stormMat);

  // ------------------------------------------------------------------ réactions aux événements de la partie
  const TRACER_COLORS = { fusil: 0xffe08a, smg: 0xffd070, pistolet: 0xfff0b0, pompe: 0xffb060, sniper: 0xbfe0ff };
  function shot(from, to, w, hit, muzzle) {
    const tr = trList[trNext]; trNext = (trNext + 1) % N;
    tr.from.set(from[0], from[1], from[2]); tr.to.set(to[0], to[1], to[2]);
    // la traînée part de la bouche de l'arme si on la connaît
    if (muzzle) tr.from.copy(muzzle);
    tr.life = tr.max = w === 'sniper' ? 0.35 : 0.09; tr.color.setHex(TRACER_COLORS[w] || 0xffffff);
    if (hit === 1) {
      puff(to[0], to[1], to[2], { color: 0xc8bfa8, size: 0.25, grow: 2.5, life: 0.45, op: 0.7 });
      puff(to[0], to[1], to[2], { tex: T.glow, color: 0xffd080, size: 0.25, grow: 0.5, life: 0.08, add: true });
    } else if (hit === 2) puff(to[0], to[1], to[2], { tex: T.glow, color: 0xff6a4a, size: 0.35, grow: 1.5, life: 0.15, add: true });
  }
  function muzzleFlash(p) { puff(p.x, p.y, p.z, { tex: T.glow, color: 0xffd890, size: 0.5, grow: 0.6, life: 0.06, add: true }); }
  function boom(x, y, z, r, kind) {
    if (kind === 'souffle') {
      puff(x, y + 0.5, z, { tex: T.glow, color: 0xc08aff, size: 1, grow: r * 1.6, life: 0.45, add: true, op: 0.9 });
      return;
    }
    puff(x, y, z, { tex: T.glow, color: 0xffa040, size: 1.5, grow: r * 1.8, life: 0.45, add: true, op: 1 });
    puff(x, y, z, { tex: T.glow, color: 0xfff0c0, size: 1, grow: r, life: 0.18, add: true, op: 1 });
    for (let i = 0; i < 6; i++) puff(x + (Math.random() - 0.5) * r * 0.6, y + Math.random() * r * 0.4, z + (Math.random() - 0.5) * r * 0.6, { color: 0x5a5550, size: 1.2, grow: 3.5, life: 1.6 + Math.random(), rise: 1.2, op: 0.55 });
    flash.position.set(x, y + 1, z); flash.intensity = 90; flashT = 0.25;
  }

  function update(dt, t, sim, stormState, cam) {
    // traînées
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), dir = new THREE.Vector3(), s3 = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < N; i++) {
      const tr = trList[i];
      if (tr.life <= 0) continue;
      tr.life -= dt;
      if (tr.life <= 0) { tracers.setMatrixAt(i, zero); continue; }
      dir.subVectors(tr.to, tr.from); const L = dir.length(); dir.normalize();
      q.setFromUnitVectors(Z, dir); s3.set(1, 1, L); m4.compose(tr.from, q, s3); tracers.setMatrixAt(i, m4);
      tracers.setColorAt(i, new THREE.Color().copy(tr.color).multiplyScalar(tr.life / tr.max));
    }
    tracers.instanceMatrix.needsUpdate = true; if (tracers.instanceColor) tracers.instanceColor.needsUpdate = true;
    // sprites
    for (let i = live.length - 1; i >= 0; i--) {
      const L = live[i]; L.t += dt;
      const k = L.t / L.life;
      if (k >= 1) { L.s.on = false; L.s.o.visible = false; live.splice(i, 1); continue; }
      L.s.o.scale.setScalar(L.size + L.grow * k);
      L.s.m.opacity = L.op * (1 - k);
      L.s.o.position.y += L.rise * dt;
    }
    if (flashT > 0) { flashT -= dt; flash.intensity = Math.max(0, flashT / 0.25) * 90; }
    // projectiles
    const seen = new Set();
    for (const pr of sim.S.projectiles) {
      seen.add(pr.id);
      let o = projMeshes.get(pr.id);
      if (!o) {
        o = pr.kind === 'roquette' ? new THREE.Mesh(rocketGeo, rocketMat) : new THREE.Mesh(nadeGeo, pr.kind === 'souffle' ? blastMat : nadeMat);
        group.add(o); projMeshes.set(pr.id, o);
      }
      o.position.set(pr.x, pr.y, pr.z);
      if (pr.kind === 'roquette') { o.lookAt(pr.x + pr.vx, pr.y + pr.vy, pr.z + pr.vz); puff(pr.x - pr.vx * 0.012, pr.y - pr.vy * 0.012, pr.z - pr.vz * 0.012, { color: 0xd8d0c8, size: 0.25, grow: 1.4, life: 0.7, op: 0.5 }); }
    }
    for (const [id, o] of projMeshes) if (!seen.has(id)) { group.remove(o); projMeshes.delete(id); }
    // tempête
    storm.visible = !!stormState;
    if (stormState) {
      storm.position.set(stormState.x, -60, stormState.z);
      storm.scale.set(Math.max(1, stormState.r), 700, Math.max(1, stormState.r));
      stormMat.uniforms.uT.value = t;
    }
  }
  return {
    group, shot, muzzleFlash, boom, update, puff,
    dispose() { for (const o of own) o.dispose(); scene.remove(group); },
  };
}
