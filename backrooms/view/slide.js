// La descente en toboggan (Poolrooms → niveau suivant). Allongé sur le dos, les pieds devant, on glisse dans un long
// tube de polyester qui tourne et plonge, de plus en plus vite ; dans les virages, la vitesse fait monter le long de
// la paroi. Rendu avec le moteur partagé de la scène et le même filtre de caméscope (vhs.js), sans scène du niveau.
// En deux temps, de part et d'autre de l'écran de chargement : start() s'enfonce dans le tube jusqu'au noir (le
// niveau suivant se charge pendant ce temps, hold()), finish() reprend dans le noir, enchaîne la spirale et les
// derniers virages, puis la lumière du niveau d'arrivée grandit au bout du tube et on y tombe (onEnd).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { createVhsFilter } from './vhs.js';

const R = 0.62; // rayon intérieur du tube : celui de la bouche (MOUTH.r)
const STEP = 0.25; // un anneau tous les 25 cm
const SEG = 32; // côtés du tube
const JOINT = 1.6; // un raccord de tronçon tous les 1,6 m (la bride, vue de l'intérieur : un jonc plus sombre)
const EYE = 0.3; // les yeux, au-dessus de la paroi (allongé, la tête relevée)
const G = 9.8;
const V0 = 2.4; // vitesse au départ (m/s)
const ACC = 2.4; // on va de plus en plus vite (m/s²)…
const VMAX = 19; // … jusqu'à près de 70 km/h
const BANK = 1.22; // dans un virage, on monte au plus à 70° sur la paroi
const speedAt = (s) => Math.min(VMAX, Math.sqrt(V0 * V0 + 2 * ACC * Math.max(0, s)));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

// Ce qui attend au bout du tube : la couleur et la force de sa lumière
const DEST = {
  pipes: { light: [1.0, 0.6, 0.28], k: 1.6 }, // les galeries de service : les lampes au sodium
  hotel: { light: [1.0, 0.38, 0.22], k: 1.3 }, // le Terror Hotel : la lueur rouge de ses couloirs
  out: { light: [1.0, 0.9, 0.55], k: 2.6 }, // le toboggan bleu recrache au Level 0 : les néons jaunes
};

// Le tracé, en tronçons { l : longueur (m), k : virage total (rad, + à gauche), p : descente par mètre }. side : le
// sens des virages (chaque toboggan a le sien)
function partOne(side) {
  return [
    { l: 3.5, k: 0, p: 0.1 }, // on passe le mur
    { l: 9, k: 1.5 * side, p: 0.2 }, // un premier virage, large
    { l: 5, k: 0, p: 0.32 },
    { l: 10, k: -2.2 * side, p: 0.26 }, // dans l'autre sens, plus serré
    { l: 6, k: 0, p: 0.55 }, // ça plonge
    { l: 14, k: 2.1 * side, p: 0.3 },
    { l: 12, k: 0, p: 0.45 }, // dans le noir
    { l: 30, k: -2.8 * side, p: 0.3 }, // (de la marge, si le niveau suivant tarde)
  ];
}
function partTwo(side) {
  return [
    { l: 5, k: 0, p: 0.35 },
    { l: 22, k: Math.PI * 2 * side, p: 0.3 }, // la spirale : un tour complet
    { l: 7, k: -1.3 * side, p: 0.22 },
    { l: 7, k: 1.3 * side, p: 0.18 },
    { l: 9, k: 0, p: 0.05 }, // la dernière ligne droite, presque à plat : la sortie
  ];
}

// Échantillonne un tracé depuis from { x, y, z, h (cap) } : un point tous les STEP mètres. Les changements de
// courbure et de pente sont adoucis sur 3 m (pas de cassure dans la trajectoire, ni dans la caméra)
function trace(segs, from) {
  const H = 1.5;
  const spans = [];
  let a = 0;
  for (const g of segs) {
    spans.push([a, a + g.l, g]);
    a += g.l;
  }
  const at = (u) => {
    let k = 0;
    let p = 0;
    spans.forEach(([a0, a1, g], i) => {
      const w = (i === 0 ? 1 : smooth((u - a0 + H) / (2 * H))) - (i === spans.length - 1 ? 0 : smooth((u - a1 + H) / (2 * H)));
      k += (g.k / g.l) * w;
      p += g.p * w;
    });
    return [k, p];
  };
  const pts = [];
  let { x, y, z, h } = from;
  const n = Math.round(a / STEP);
  for (let i = 0; i <= n; i++) {
    pts.push({ x, y, z, h });
    const [k, p] = at(i * STEP + STEP / 2);
    h += k * STEP;
    x -= Math.sin(h) * STEP;
    z -= Math.cos(h) * STEP;
    y -= p * STEP;
  }
  return pts;
}

// Les repères le long du tracé : abscisse (s, comptée depuis le départ du toboggan), tangente, le bas (D0, la
// pesanteur vue du tube), le côté (B), et l'inclinaison prévue (bank) : à la vitesse qu'on aura là, le poids et la
// force qui pousse vers l'extérieur du virage font monter le long de la paroi
function frames(pts, s0) {
  const n = pts.length;
  const F = [];
  let s = s0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (i > 0) {
      const q = pts[i - 1];
      s += Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
    }
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const T = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
    F.push({ P: new THREE.Vector3(p.x, p.y, p.z), T, s, h: p.h });
  }
  const raw = [];
  for (let i = 0; i < n; i++) {
    const f = F[i];
    const a = F[Math.max(0, i - 1)];
    const b = F[Math.min(n - 1, i + 1)];
    const K = b.T.clone().sub(a.T).divideScalar(Math.max(1e-3, b.s - a.s)); // la courbure (vers l'intérieur)
    f.D0 = new THREE.Vector3(0, -1, 0).addScaledVector(f.T, f.T.y).normalize();
    f.B = new THREE.Vector3().crossVectors(f.T, f.D0);
    const v = speedAt(f.s);
    const Gv = new THREE.Vector3(0, -G, 0).addScaledVector(K, -v * v);
    Gv.addScaledVector(f.T, -Gv.dot(f.T));
    raw.push(THREE.MathUtils.clamp(Math.atan2(Gv.dot(f.B), Gv.dot(f.D0)), -BANK, BANK));
  }
  const w = Math.round(1.2 / STEP);
  for (let i = 0; i < n; i++) {
    let t = 0;
    let c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) {
      t += raw[j];
      c++;
    }
    F[i].bank = t / c;
  }
  return F;
}

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Le tube : un anneau par repère, un jonc plus sombre (et un peu rentré) à chaque raccord, chaque tronçon d'une
// teinte à peine différente. glowAt(s, haut) : la lumière qui traverse le polyester à cet endroit (rgb)
function tubeGeometry(F, base, glowAt) {
  const rings = F.length;
  const N = rings * (SEG + 1);
  const pos = new Float32Array(N * 3);
  const nor = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const glo = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  const su = new Float32Array(N * 2);
  const d = new THREE.Vector3();
  for (let r = 0; r < rings; r++) {
    const f = F[r];
    const lot = 0.94 + 0.1 * hash(Math.floor(f.s / JOINT));
    const rad = R;
    for (let k = 0; k <= SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      d.copy(f.D0).multiplyScalar(Math.cos(a)).addScaledVector(f.B, Math.sin(a));
      const o = r * (SEG + 1) + k;
      pos[o * 3] = f.P.x + d.x * rad;
      pos[o * 3 + 1] = f.P.y + d.y * rad;
      pos[o * 3 + 2] = f.P.z + d.z * rad;
      // (vers l'intérieur : c'est de là qu'on le voit, et que la lampe l'éclaire)
      nor[o * 3] = -d.x;
      nor[o * 3 + 1] = -d.y;
      nor[o * 3 + 2] = -d.z;
      // le fond, poli par les passages, un peu plus clair ; le haut, un peu plus terne
      const sh = lot * (0.9 + 0.1 * Math.max(0, -d.y));
      col[o * 3] = base.r * sh;
      col[o * 3 + 1] = base.g * sh;
      col[o * 3 + 2] = base.b * sh;
      const g = glowAt(f.s, d.y);
      glo[o * 3] = g[0];
      glo[o * 3 + 1] = g[1];
      glo[o * 3 + 2] = g[2];
      uv[o * 2] = k / SEG;
      uv[o * 2 + 1] = f.s / 2;
      su[o * 2] = f.s;
      su[o * 2 + 1] = d.y;
    }
  }
  const idx = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let k = 0; k < SEG; k++) {
      const a = r * (SEG + 1) + k;
      const b = a + SEG + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('glow', new THREE.BufferAttribute(glo, 3));
  geo.setAttribute('su', new THREE.BufferAttribute(su, 2));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// gl : { renderer, opts } (voir sceneGl dans scene.js) ; hex : la couleur du toboggan ; side : le sens des virages ;
// sfx : le son (facultatif)
export function createSlideRide({ gl, hex, side = 1, sfx = null }) {
  const renderer = gl.renderer;
  const opts = gl.opts || {};
  const vhs = createVhsFilter(renderer);
  vhs.setQuality(opts.quality === 'auto' || !opts.quality ? 'high' : opts.quality);
  vhs.setFx({ brightness: opts.brightness ?? 1, reduceFlashes: !!opts.reduceFlashes });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.04, 140);
  scene.add(cam);
  // la lampe torche, sur la poitrine, qui éclaire le tube devant soi ; un peu de lumière diffuse autour
  const lamp = new THREE.SpotLight(0xfff0d8, 9, 32, 0.62, 0.7, 2);
  lamp.position.set(0, -0.05, 0.1);
  lamp.target.position.set(0, -0.12, -1);
  cam.add(lamp, lamp.target);
  const fill = new THREE.PointLight(0xffe4c4, 0.35, 3.5, 2);
  cam.add(fill);
  scene.add(new THREE.HemisphereLight(0x8c96a2, 0x1a1c20, 0.05));
  const exitLight = new THREE.PointLight(0xffffff, 0, 40, 1.6);
  scene.add(exitLight);

  const base = new THREE.Color(hex);
  const tubeMat = new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, shininess: 75, specular: 0x4a4a4a });
  tubeMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 glow;\nattribute vec2 su;\nvarying vec3 vGlow;\nvarying vec2 vSU;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;\nvSU = su;');
    // les raccords des tronçons (tous les 1,6 m) : une rainure sombre bordée du jonc de la bride, nets à toute vitesse ;
    // à 25 m, une grille d'aération sur le dessus, par où tombe la lumière des Poolrooms
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlow;\nvarying vec2 vSU;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float jf = fract(vSU.x / ${JOINT.toFixed(2)});
        float dj = min(jf, 1.0 - jf) * ${JOINT.toFixed(2)};
        float fw = fwidth(vSU.x) + 1e-4;
        float groove = 1.0 - smoothstep(0.018, 0.018 + fw * 1.5, dj);
        float lip = 1.0 - smoothstep(0.0, 0.012 + fw * 1.5, abs(dj - 0.045));
        diffuseColor.rgb *= (1.0 - 0.75 * groove) * (1.0 + 0.45 * lip);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vGlow;
        float vent = step(abs(vSU.x - 25.0), 0.55) * smoothstep(0.8, 0.86, vSU.y) * step(0.45, fract(vSU.x * 7.0));
        totalEmissiveRadiance += vec3(0.8, 0.9, 0.95) * vent * 1.4;`
      );
  };
  const outMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const outDisc = new THREE.Mesh(new THREE.CircleGeometry(R * 1.1, 40), outMat);
  outDisc.visible = false;
  scene.add(outDisc);

  let F = [];
  let pts = [];
  let tube = null;
  let dest = null;
  let sEnd = Infinity;

  // la lumière qui traverse le polyester : au départ, celle des Poolrooms (teintée par le tube) ; plus loin, une
  // grille d'aération par où elle tombe encore ; au bout, celle du niveau d'arrivée
  const glowAt = (s, up) => {
    const top = 0.55 + 0.45 * up;
    let r = 0;
    let g = 0;
    let b = 0;
    const k0 = s < 12 ? 0.5 * (1 - s / 12) ** 2 * top : 0;
    r += base.r * k0 + 0.03 * k0;
    g += base.g * k0 + 0.03 * k0;
    b += base.b * k0 + 0.03 * k0;
    // (le halo de la grille d'aération, sur le haut du tube ; la grille elle-même est dans le matériau)
    const vent = Math.max(0, 1 - Math.abs(s - 25) / 2.2) ** 2 * clamp01((up + 0.2) / 1.2) * 0.22;
    r += base.r * vent + vent * 0.2;
    g += base.g * vent + vent * 0.22;
    b += base.b * vent + vent * 0.24;
    if (dest && Number.isFinite(sEnd)) {
      const ke = clamp01((s - (sEnd - 14)) / 14) ** 2 * dest.k * 0.6 * (0.7 + 0.3 * top);
      r += dest.light[0] * ke;
      g += dest.light[1] * ke;
      b += dest.light[2] * ke;
    }
    return [r, g, b];
  };

  function build() {
    if (tube) {
      scene.remove(tube);
      tube.geometry.dispose();
    }
    tube = new THREE.Mesh(tubeGeometry(F, base, glowAt), tubeMat);
    tube.frustumCulled = false;
    scene.add(tube);
  }

  pts = trace(partOne(side), { x: 0, y: 0, z: 0, h: 0 });
  F = frames(pts, 0);
  build();

  // l'état : 'wait' (pas encore parti), 'one' (avant le chargement), 'hold' (le chargement), 'two' (après), 'done'
  let state = 'wait';
  let s = 0; // où on en est dans le tube (m)
  let ip = 0; // le repère juste avant
  let bankNow = 0;
  let t1 = 0; // depuis le départ
  let t2 = 0; // depuis la reprise
  let darkK = 1; // avant le chargement : on s'enfonce dans le noir (ne remonte plus)
  let onEnd = null;
  let rush = null;
  let cw = 0;
  let ch = 0;
  const flash = document.createElement('div');
  flash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:9';
  document.body.appendChild(flash);

  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const D0 = new THREE.Vector3();
  const B = new THREE.Vector3();
  const Dn = new THREE.Vector3();
  const look = new THREE.Vector3();

  // le repère à l'abscisse x (interpolé) ; renvoie l'inclinaison prévue
  function frameAt(x, from = 0) {
    let i = from;
    while (i < F.length - 2 && F[i + 1].s < x) i++;
    const a = F[i];
    const b = F[i + 1] || a;
    const u = b.s > a.s ? clamp01((x - a.s) / (b.s - a.s)) : 0;
    P.lerpVectors(a.P, b.P, u);
    T.lerpVectors(a.T, b.T, u).normalize();
    D0.lerpVectors(a.D0, b.D0, u).normalize();
    B.lerpVectors(a.B, b.B, u).normalize();
    return [a.bank + (b.bank - a.bank) * u, i];
  }

  function place(dt) {
    const v = speedAt(s);
    if (state === 'one' || state === 'two') s += v * dt;
    if (state === 'two' && s > sEnd) s = sEnd;
    if (state === 'one' && s > F[F.length - 1].s - 3) s = F[F.length - 1].s - 3;
    while (ip < F.length - 2 && F[ip + 1].s < s) ip++;
    // le regard, un peu plus loin dans le tube : on se penche dans les virages avant d'y être
    const [bAhead] = frameAt(Math.min(s + 2.8, F[F.length - 1].s), ip);
    Dn.copy(D0).multiplyScalar(Math.cos(bAhead)).addScaledVector(B, Math.sin(bAhead));
    look.copy(P).addScaledVector(Dn, (R - EYE) * 0.75);
    const [bank] = frameAt(s, ip);
    bankNow += (bank - bankNow) * Math.min(1, dt * 7);
    Dn.copy(D0).multiplyScalar(Math.cos(bankNow)).addScaledVector(B, Math.sin(bankNow));
    // un à-coup à chaque raccord, plus sec avec la vitesse ; et le corps qui vibre sur le polyester
    const jm = ((s % JOINT) + JOINT) % JOINT;
    const bump = Math.exp(-jm * 7) * Math.min(1, v / 12) * 0.022 + (Math.random() - 0.5) * 0.004 * Math.min(1, v / 10);
    cam.position.copy(P).addScaledVector(Dn, R - EYE - bump);
    cam.up.copy(Dn).negate();
    cam.lookAt(look);
    cam.rotateZ((Math.random() - 0.5) * 0.006 * Math.min(1, v / 10));
    // plus on va vite, plus le champ s'ouvre
    const fov = (opts.fov || 72) + 16 * clamp01((v - V0) / (VMAX - V0));
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    return v;
  }

  const api = {
    get active() {
      return state === 'one' || state === 'two';
    },
    get held() {
      return state === 'hold';
    },
    // on se laisse glisser : la première partie (jusqu'au noir)
    start() {
      if (state !== 'wait') return;
      state = 'one';
      if (sfx && sfx.slideRush) rush = sfx.slideRush();
    },
    // l'écran de chargement : plus d'image, le grondement s'éteint
    hold() {
      if (state === 'done') return;
      state = 'hold';
      if (rush) rush.set(0, 0);
    },
    // la suite : le reste du tube, refait à partir d'ici, jusqu'à la lumière de where ('pipes', 'hotel', 'out')
    finish(where, cb) {
      if (state === 'done') return;
      if (state === 'wait') state = 'one';
      dest = DEST[where] || DEST.out;
      onEnd = cb;
      const i0 = Math.max(0, ip - 40);
      const last = pts[ip];
      const tail = trace(partTwo(side), last);
      pts = pts.slice(i0, ip).concat(tail);
      F = frames(pts, F[i0].s);
      sEnd = F[F.length - 1].s - 0.6;
      ip = 0;
      while (ip < F.length - 2 && F[ip + 1].s < s) ip++;
      build();
      const e = F[F.length - 1];
      outDisc.position.copy(e.P).addScaledVector(e.T, 0.4);
      outDisc.lookAt(e.P);
      outMat.color.setRGB(dest.light[0] * dest.k * 2.4, dest.light[1] * dest.k * 2.4, dest.light[2] * dest.k * 2.4);
      outDisc.visible = true;
      exitLight.color.setRGB(dest.light[0], dest.light[1], dest.light[2]);
      exitLight.position.copy(e.P).addScaledVector(e.T, -1.2);
      t2 = 0;
      state = 'two';
      if (sfx && sfx.slideRush && !rush) rush = sfx.slideRush();
    },
    // une image. remaining : le temps qui reste avant le chargement (sim.departT), pour plonger dans le noir à temps
    render(dt, time, remaining = null) {
      if (!api.active) return;
      dt = Math.min(0.05, Math.max(0, dt));
      const cv = renderer.domElement;
      const w = cv.clientWidth || window.innerWidth;
      const h = cv.clientHeight || window.innerHeight;
      if (w !== cw || h !== ch) {
        cw = w;
        ch = h;
        vhs.setSize(w, h);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
      const v = place(dt);
      let ex = 1.25;
      let wet = 1;
      if (state === 'one') {
        t1 += dt;
        ex *= 0.3 + 0.7 * smooth(t1 / 0.35);
        if (remaining != null && remaining > 0) darkK = Math.min(darkK, clamp01((remaining - 0.1) / 0.85));
        else if (remaining != null || t1 > 30) darkK = 0;
        ex *= darkK;
        wet = darkK;
      } else {
        t2 += dt;
        ex *= smooth(t2 / 0.8);
        // au bout, la lumière d'arrivée : elle éclaire le tube, puis aveugle
        const left = sEnd - s;
        const near = clamp01(1 - left / 16);
        exitLight.intensity = near * near * dest.k * 40;
        ex *= 1 + near ** 3 * 1.6;
        const white = clamp01(1 - left / 2.2);
        flash.style.opacity = String(white * white);
        if (left <= 0.01 && state === 'two') {
          state = 'done';
          if (sfx && sfx.slideLand) sfx.slideLand('thud');
          const cb = onEnd;
          onEnd = null;
          if (cb) cb();
          return;
        }
      }
      if (rush) rush.set(v, wet); // (wet : le son s'éteint avec l'image avant le chargement)
      vhs.render(scene, cam, time, 0, ex);
    },
    dispose() {
      state = 'done';
      if (rush) rush.stop();
      rush = null;
      // le flash blanc de l'arrivée s'efface sur le nouveau niveau
      flash.style.transition = 'opacity 0.9s ease-out';
      requestAnimationFrame(() => {
        flash.style.opacity = '0';
      });
      setTimeout(() => flash.remove(), 1200);
      if (tube) tube.geometry.dispose();
      outDisc.geometry.dispose();
      tubeMat.dispose();
      outMat.dispose();
      vhs.dispose?.();
    },
  };
  return api;
}
