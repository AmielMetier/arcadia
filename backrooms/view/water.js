// The Backrooms (Level 37, les Poolrooms) - Le sol qui suit la profondeur de chaque case, les parois carrelées des
// bassins, les margelles, la surface de l'eau (limpide, cyan, de plus en plus sombre avec la profondeur, avec les ronds
// des pas des joueurs), et deux choses qu'on n'est jamais sûr d'avoir vues : l'eau qui monte ou descend de quelques
// centimètres quand on ne la regarde pas, et une ombre longue qui glisse au fond d'un bassin.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE, T } from '../engine/map.js';
import { BARREL, GROIN } from '../engine/poolrooms.js';

const C = CELL_SIZE;
const SPLASHES = 8;

export function buildWater({ map, group, baked, textures, bake, fog }) {
  const W = map.W;
  const H = map.H;
  const depth = map.depth;
  const floorLike = (x, z) => x >= 0 && z >= 0 && x < W && z < H && (map.grid[z * W + x] === T.FLOOR || map.grid[z * W + x] === T.PILLAR);
  const dAt = (x, z) => depth[z * W + x];
  const dummy = new THREE.Object3D();

  // --- sols : une dalle par case, à la hauteur du fond (carrelage blanc au sec et dans les pataugeoires, cyan dans les
  // bassins, bleu profond au centre des grands bassins) ---
  const mats = {
    white: baked(new THREE.MeshLambertMaterial({ map: textures.carpet })),
    pool: baked(new THREE.MeshLambertMaterial({ map: textures.pool })),
    deep: baked(new THREE.MeshLambertMaterial({ map: textures.deep })),
  };
  const kindOf = (d) => (d >= 1 ? 'deep' : d >= 0.5 ? 'pool' : 'white');
  const floors = { white: [], pool: [], deep: [] };
  const sides = { white: [], pool: [], deep: [] };
  const coping = [];
  const waterCells = [];
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (!floorLike(x, z)) continue;
      const d = dAt(x, z);
      floors[kindOf(d)].push({ x, z, d });
      if (d > 0) waterCells.push({ x, z, d });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!floorLike(x + dx, z + dz)) continue;
        const n = dAt(x + dx, z + dz);
        // paroi entre une case profonde et sa voisine moins profonde, tournée vers la profonde
        if (d > n + 0.01) sides[kindOf(d)].push({ x, z, dx, dz, top: -n, bottom: -d });
        // margelle : le bord sec d'un bassin
        if (d === 0 && n >= 0.5) coping.push({ x, z, dx, dz });
      }
    }
  }
  const flat = new THREE.PlaneGeometry(C, C).rotateX(-Math.PI / 2);
  for (const k of ['white', 'pool', 'deep']) {
    const list = floors[k];
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(flat, mats[k], list.length);
    list.forEach((c, i) => {
      dummy.position.set((c.x + 0.5) * C, -c.d, (c.z + 0.5) * C);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }
  const wallQuad = new THREE.PlaneGeometry(1, 1);
  for (const k of ['white', 'pool', 'deep']) {
    const list = sides[k];
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(wallQuad, mats[k], list.length);
    list.forEach((s, i) => {
      dummy.position.set((s.x + 0.5) * C + s.dx * (C / 2), (s.top + s.bottom) / 2, (s.z + 0.5) * C + s.dz * (C / 2));
      dummy.rotation.set(0, Math.atan2(-s.dx, -s.dz), 0); // la paroi regarde la case profonde
      dummy.scale.set(C, s.top - s.bottom, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }
  if (coping.length) {
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(C, 0.06, 0.3), baked(new THREE.MeshLambertMaterial({ color: '#f3f5f1' })), coping.length);
    coping.forEach((c, i) => {
      dummy.position.set((c.x + 0.5) * C + c.dx * (C / 2 - 0.15), 0.02, (c.z + 0.5) * C + c.dz * (C / 2 - 0.15));
      dummy.rotation.set(0, c.dx ? Math.PI / 2 : 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  // --- voûtes : couloirs en berceau (avec un arc doubleau une case sur deux) et voûtes d'arêtes des grandes salles,
  // carrelées de mosaïque comme le reste ---
  const mosaic = baked(new THREE.MeshLambertMaterial({ map: textures.mosaic, side: THREE.DoubleSide }));
  const ribMat = baked(new THREE.MeshLambertMaterial({ map: textures.mosaic, color: '#d8e4e3', side: THREE.DoubleSide }));
  // un quart de berceau : l'axe le long de x (une case), de la naissance (z = -R) au sommet (z = 0)
  const quarter = (R, len, seg = 12) => {
    const g = new THREE.BufferGeometry();
    const p = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * (Math.PI / 2);
      for (const a of [-len / 2, len / 2]) {
        p.push(a, BARREL.spring + R * Math.sin(t), -R * Math.cos(t));
        uv.push((a + len / 2) / C, (R * t) / C);
      }
    }
    for (let i = 0; i < seg; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const vaults = [];
  const ribs = [];
  if (map.ceilKind) {
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        const k = map.ceilKind[z * W + x];
        if (!k) continue;
        const cx = (x + 0.5) * C;
        const cz = (z + 0.5) * C;
        // la ligne de faîte du couloir est au bord commun des deux cases de sa largeur
        const at = [null, [cx, cz + C / 2, 0], [cx, cz - C / 2, Math.PI], [cx + C / 2, cz, Math.PI / 2], [cx - C / 2, cz, -Math.PI / 2]][k];
        vaults.push(at);
        if ((k <= 2 ? x : z) % 2 === 0) ribs.push(at);
      }
    }
  }
  const place = (geo, mat, list) => {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, z, r], i) => {
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, r, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    group.add(inst);
  };
  place(quarter(BARREL.r, C), mosaic, vaults);
  place(quarter(BARREL.r - 0.12, 0.35), ribMat, ribs);
  // voûtes d'arêtes : sur chaque travée, la plus haute des deux voûtes en berceau qui se croisent
  if (map.bays && map.bays.length) {
    const N = 18;
    const p = [];
    const uv = [];
    const idx = [];
    for (const b of map.bays) {
      const base = p.length / 3;
      for (let j = 0; j <= N; j++) {
        for (let i = 0; i <= N; i++) {
          const u = (i / N) * 2 - 1;
          const v = (j / N) * 2 - 1;
          const x = b.x0 + ((u + 1) / 2) * (b.x1 - b.x0);
          const z = b.z0 + ((v + 1) / 2) * (b.z1 - b.z0);
          const y = GROIN.spring + GROIN.rise * Math.max(Math.sqrt(Math.max(0, 1 - u * u)), Math.sqrt(Math.max(0, 1 - v * v)));
          p.push(x, y, z);
          uv.push((x + (y - GROIN.spring) * 0.6) / C, (z + (y - GROIN.spring) * 0.6) / C);
        }
      }
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const a = base + j * (N + 1) + i;
          idx.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mosaic);
    m.frustumCulled = false;
    group.add(m);
  }

  // --- échelles chromées : deux montants recourbés au-dessus de la margelle, trois marches sous l'eau ---
  const chrome = baked(new THREE.MeshLambertMaterial({ color: '#dfe5e8', emissive: '#596066', emissiveIntensity: 0.4 }));
  for (const l of map.ladders || []) {
    const g = new THREE.Group();
    for (const side of [-0.26, 0.26]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side, 0, -0.45),
        new THREE.Vector3(side, 0.7, -0.4),
        new THREE.Vector3(side, 0.95, -0.15),
        new THREE.Vector3(side, 0.8, 0.12),
        new THREE.Vector3(side, 0.1, 0.18),
        new THREE.Vector3(side, -0.9, 0.18),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.025, 8, false), chrome));
    }
    for (const y of [-0.22, -0.48, -0.74]) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.09), chrome);
      step.position.set(0, y, 0.2);
      g.add(step);
    }
    g.position.set(l.x, 0, l.z);
    g.rotation.y = Math.atan2(l.dx, l.dz); // +z local = vers l'eau
    group.add(g);
  }

  // --- la surface de l'eau : un carré par case mouillée, avec sa profondeur ---
  const pos = [];
  const dep = [];
  for (const c of waterCells) {
    const x0 = c.x * C;
    const z0 = c.z * C;
    const x1 = x0 + C;
    const z1 = z0 + C;
    pos.push(x0, 0, z0, x0, 0, z1, x1, 0, z1, x0, 0, z0, x1, 0, z1, x1, 0, z0);
    for (let i = 0; i < 6; i++) dep.push(c.d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
  const splash = Array.from({ length: SPLASHES }, () => new THREE.Vector4(0, 0, -100, 0));
  const uniforms = {
    uTime: { value: 0 },
    uBake: bake.uBake,
    uBakeScale: bake.uBakeScale,
    uFogColor: { value: fog.color },
    uFogDensity: { value: fog.density },
    uSplash: { value: splash },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `attribute float aDepth;
varying float vDepth;
varying vec3 vWorld;
void main() {
  vDepth = aDepth;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uTime;
uniform sampler2D uBake;
uniform vec2 uBakeScale;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec4 uSplash[${SPLASHES}];
varying float vDepth;
varying vec3 vWorld;
float hgt(vec2 p) {
  // l'eau est presque immobile : deux houles très lentes et une ride fine
  float h = sin(p.x * 1.3 + uTime * 0.6) * 0.012 + sin(p.y * 1.7 - uTime * 0.5) * 0.010;
  h += sin((p.x + p.y) * 4.1 + uTime * 1.3) * 0.004 + sin((p.x - p.y) * 5.3 - uTime * 1.1) * 0.003;
  // les ronds des pas
  for (int i = 0; i < ${SPLASHES}; i++) {
    vec4 s = uSplash[i];
    float age = uTime - s.z;
    if (age < 0.0 || age > 3.0) continue;
    float d = distance(p, s.xy);
    float r = age * 0.9;
    h += sin((d - r) * 22.0) * exp(-age * 1.4) * exp(-abs(d - r) * 5.0) * 0.02 * s.w;
  }
  return h;
}
void main() {
  vec2 p = vWorld.xz;
  float e = 0.04;
  vec3 n = normalize(vec3(-(hgt(p + vec2(e, 0.0)) - hgt(p - vec2(e, 0.0))) / (2.0 * e), 1.0, -(hgt(p + vec2(0.0, e)) - hgt(p - vec2(0.0, e))) / (2.0 * e)));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  float light = texture2D(uBake, p * uBakeScale).r * 2.0;
  float k = clamp(vDepth / 1.1, 0.0, 1.0);
  // turquoise peu profond, cyan, bleu profond : l'absorption de l'eau
  vec3 body = mix(vec3(0.6, 0.9, 0.84), vec3(0.04, 0.36, 0.42), k); // vert d'eau, puis bleu-vert sombre
  vec3 sky = vec3(0.92, 0.97, 0.97) * (0.55 + light * 0.5);
  // reflets des dalles lumineuses : des taches claires qui bougent avec la ride
  float glint = pow(max(dot(reflect(-v, n), vec3(0.0, 1.0, 0.0)), 0.0), 60.0) * 0.35;
  vec3 col = mix(body * (0.45 + light * 0.55), sky, fres) + glint;
  float alpha = clamp(mix(0.22, 0.72, k) + fres * 0.5, 0.0, 0.95);
  float fd = length(cameraPosition - vWorld);
  float fogF = 1.0 - exp(-uFogDensity * uFogDensity * fd * fd);
  gl_FragColor = vec4(mix(col, uFogColor, fogF), alpha);
}`,
  });
  const surface = new THREE.Mesh(geo, mat);
  const BASE = -0.03;
  surface.position.y = BASE;
  surface.renderOrder = 3;
  surface.frustumCulled = false;
  group.add(surface);

  // --- l'ombre au fond des bassins profonds ---
  const [sc, sg] = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    return [c, c.getContext('2d')];
  })();
  sg.filter = 'blur(6px)';
  sg.fillStyle = '#000';
  sg.beginPath();
  sg.ellipse(110, 32, 80, 15, 0, 0, Math.PI * 2); // le corps
  sg.fill();
  sg.beginPath();
  sg.moveTo(180, 32);
  sg.quadraticCurveTo(220, 22, 250, 30); // la queue
  sg.quadraticCurveTo(220, 40, 180, 34);
  sg.fill();
  const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', alphaMap: new THREE.CanvasTexture(sc), transparent: true, opacity: 0, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9).rotateX(-Math.PI / 2), shadowMat);
  shadow.renderOrder = 2;
  group.add(shadow);
  const deepCells = waterCells.filter((c) => c.d >= 1).length ? waterCells.filter((c) => c.d >= 1) : waterCells.filter((c) => c.d >= 0.5);
  let ghost = null;
  let nextGhost = 25 + Math.random() * 20;

  // --- l'eau qui change de niveau quand on ne la regarde pas ---
  let level = BASE;
  let levelWant = BASE;
  let nextShift = 30 + Math.random() * 30;
  const fwd = new THREE.Vector3();

  const steps = new Map(); // dernier rond de chaque joueur
  let si = 0;

  return {
    get level() {
      return level;
    },
    update(sim, P, time, dt, camera) {
      uniforms.uTime.value = time;
      // un rond dans l'eau à chaque pas de chaque joueur qui marche dans l'eau
      for (const Q of sim.players) {
        if (Q.status !== 'alive' || !Q.moving || !map.depthAt || map.depthAt(Q.x, Q.z) <= 0) continue;
        const last = steps.get(Q.id) || 0;
        if (time - last < (Q.running ? 0.3 : 0.45)) continue;
        steps.set(Q.id, time);
        splash[si].set(Q.x, Q.z, time, Q.running ? 1.4 : 1);
        si = (si + 1) % SPLASHES;
      }
      // le niveau de l'eau bouge de quelques centimètres, seulement quand le joueur regarde ailleurs (en l'air, ou
      // loin de l'eau la plus proche)
      nextShift -= dt;
      camera.getWorldDirection(fwd);
      if (nextShift <= 0) {
        let near = null;
        for (const c of waterCells) {
          const d = Math.hypot((c.x + 0.5) * C - P.x, (c.z + 0.5) * C - P.z);
          if (!near || d < near.d) near = { c, d };
        }
        const away = !near || fwd.y > 0.25 || (fwd.x * ((near.c.x + 0.5) * C - P.x) + fwd.z * ((near.c.z + 0.5) * C - P.z)) / Math.max(0.1, near.d) < 0;
        if (away) {
          levelWant = BASE + (Math.random() < 0.5 ? -1 : 1) * (0.03 + Math.random() * 0.04);
          if (Math.random() < 0.3) levelWant = BASE;
          nextShift = 25 + Math.random() * 35;
        }
      }
      level += Math.sign(levelWant - level) * Math.min(Math.abs(levelWant - level), dt * 0.03);
      surface.position.y = level;
      // l'ombre : de temps en temps, elle traverse le fond d'un bassin profond pas trop loin, puis disparaît
      nextGhost -= dt;
      if (!ghost && nextGhost <= 0 && deepCells.length) {
        const near = deepCells.filter((c) => {
          const d = Math.hypot((c.x + 0.5) * C - P.x, (c.z + 0.5) * C - P.z);
          return d > 5 && d < 20;
        });
        if (near.length) {
          const c = near[Math.floor(Math.random() * near.length)];
          const a = Math.random() * Math.PI * 2;
          ghost = { x: (c.x + 0.5) * C, z: (c.z + 0.5) * C, y: -c.d + 0.06, a, t: 0, len: 4 + Math.random() * 2 };
        }
        nextGhost = 30 + Math.random() * 40;
      }
      if (ghost) {
        ghost.t += dt;
        const f = ghost.t / ghost.len;
        const travel = (0.5 - f) * 3.2; // la tête (côté -x de l'image) devant
        shadow.position.set(ghost.x + Math.cos(ghost.a) * travel, ghost.y, ghost.z + Math.sin(ghost.a) * travel);
        shadow.rotation.y = -ghost.a;
        shadowMat.opacity = Math.sin(Math.min(1, f) * Math.PI) * 0.6;
        if (f >= 1) {
          ghost = null;
          shadowMat.opacity = 0;
        }
      }
    },
  };
}
