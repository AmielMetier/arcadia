// Le manuel posé sur la table : un livret ouvert, pages dessinées par pages.js, onglets colorés sur la tranche.
// Clic sur la page de droite : page suivante ; sur celle de gauche : page précédente ; sur un onglet : la section.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { manualOf } from '../engine/rules.js';
import { drawPage, PAGE_W, PAGE_H, SECTIONS } from './pages.js';
import { canvasTex } from './tex.js';

export const PW = 0.9, PH = PW * PAGE_H / PAGE_W;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });

export function buildBook(edition) {
  const man = manualOf(edition);
  const root = new THREE.Group();
  const cache = new Map();
  const tex = (idx) => {
    if (!cache.has(idx)) cache.set(idx, canvasTex(PAGE_W, PAGE_H, (ctx) => drawPage(ctx, man, idx)).tex);
    return cache.get(idx);
  };

  // couverture rigide et blocs de pages
  const cover = new THREE.Mesh(new THREE.BoxGeometry(2 * PW + 0.1, 0.025, PH + 0.08), std('#7a1526', { roughness: 0.6 }));
  cover.position.y = 0.0125; cover.castShadow = cover.receiveShadow = true; root.add(cover);
  const block = (side) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.01, 1, PH), std('#efe6cf'));
    me.castShadow = me.receiveShadow = true; root.add(me);
    me.userData.side = side;
    return me;
  };
  const blocks = [block(-1), block(1)];
  // papier mat (sans reflet de la lampe) et un peu lumineux par lui-même : la page reste lisible dans l'ombre de la bombe
  const pageMat = () => new THREE.MeshLambertMaterial({ color: '#f2ede2', emissive: '#ffffff', emissiveIntensity: 0.4 });
  const plane = () => new THREE.PlaneGeometry(PW - 0.01, PH).rotateX(-Math.PI / 2);
  const left = new THREE.Mesh(plane(), pageMat()), right = new THREE.Mesh(plane(), pageMat());
  left.receiveShadow = right.receiveShadow = false;
  left.userData.pick = { book: 'prev' }; right.userData.pick = { book: 'next' };
  root.add(left, right);

  // feuille qui tourne : recto et verso, pivot sur la reliure
  const flipper = new THREE.Group(); root.add(flipper); flipper.visible = false;
  const front = new THREE.Mesh(plane(), pageMat());
  const back = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.01, PH).rotateZ(Math.PI).rotateX(Math.PI / 2), pageMat());
  front.position.x = back.position.x = PW / 2; front.castShadow = true;
  flipper.add(front, back);

  // onglets : un par section, sur la tranche droite
  const tabs = SECTIONS.map((s, k) => {
    const t = canvasTex(128, 160, (c, w, h) => {
      c.fillStyle = s.color; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#16181d'; c.lineWidth = 8; c.strokeRect(0, 0, w, h);
      c.font = '78px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(s.icon, w / 2 + 14, h / 2 + 4);
    });
    const me = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.006, 0.13), [std(s.color), std(s.color), new THREE.MeshStandardMaterial({ map: t.tex, roughness: 0.7 }), std(s.color), std(s.color), std(s.color)]);
    me.position.set(PW + 0.035, 0, -PH / 2 + 0.1 + k * (PH - 0.2) / (SECTIONS.length - 1));
    me.castShadow = true;
    me.userData.pick = { book: 'goto', s: k };
    root.add(me);
    return me;
  });

  // taches d'encre (sabotage)
  const inkTex = canvasTex(1024, 640, null);
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(2 * PW, PH).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: inkTex.tex, transparent: true, roughness: 0.2 }));
  ink.visible = false; root.add(ink);

  let spread = 0, anim = null;
  const N = SECTIONS.length;
  function layout() {
    // les pages déjà lues s'empilent à gauche
    const tl = 0.01 + 0.035 * spread / (N - 1), tr = 0.01 + 0.035 * (N - 1 - spread) / (N - 1);
    blocks[0].scale.y = tl; blocks[0].position.set(-PW / 2, 0.025 + tl / 2, 0);
    blocks[1].scale.y = tr; blocks[1].position.set(PW / 2, 0.025 + tr / 2, 0);
    left.position.set(-PW / 2, 0.026 + tl, 0); right.position.set(PW / 2, 0.026 + tr, 0);
    flipper.position.y = 0.03 + Math.max(tl, tr);
    tabs.forEach((t) => { t.position.y = 0.026 + tr - 0.004; });
    ink.position.y = 0.03 + Math.max(tl, tr);
  }
  function show(s) {
    left.material.map = left.material.emissiveMap = tex(2 * s); right.material.map = right.material.emissiveMap = tex(2 * s + 1);
    left.material.needsUpdate = right.material.needsUpdate = true;
  }
  function go(s) {
    s = Math.max(0, Math.min(N - 1, s));
    if (s === spread || anim) return false;
    const fwd = s > spread;
    // recto : l'ancienne page de droite (en avant) ; verso : la nouvelle page de gauche
    front.material.map = front.material.emissiveMap = fwd ? tex(2 * spread + 1) : tex(2 * s + 1);
    back.material.map = back.material.emissiveMap = fwd ? tex(2 * s) : tex(2 * spread);
    front.material.needsUpdate = back.material.needsUpdate = true;
    if (fwd) { right.material.map = right.material.emissiveMap = tex(2 * s + 1); right.material.needsUpdate = true; }
    else { left.material.map = left.material.emissiveMap = tex(2 * s); left.material.needsUpdate = true; }
    anim = { t: 0, fwd, to: s };
    flipper.rotation.z = fwd ? 0 : Math.PI;
    flipper.visible = true;
    // préchauffe les pages voisines
    setTimeout(() => { tex(Math.min(2 * N - 1, 2 * s + 2)); tex(Math.min(2 * N - 1, 2 * s + 3)); }, 400);
    return true;
  }
  layout(); show(0);
  setTimeout(() => { tex(2); tex(3); }, 300);

  return {
    root,
    pickables: [left, right, ...tabs],
    get spread() { return spread; },
    go, next: () => go(spread + 1), prev: () => go(spread - 1),
    tick(dt) {
      if (!anim) return;
      anim.t = Math.min(1, anim.t + dt / 0.5);
      const e = anim.t < 0.5 ? 2 * anim.t * anim.t : 1 - Math.pow(-2 * anim.t + 2, 2) / 2;
      flipper.rotation.z = anim.fwd ? e * Math.PI : (1 - e) * Math.PI;
      flipper.position.y = 0.03 + 0.05 + Math.sin(e * Math.PI) * 0.06;
      if (anim.t >= 1) { spread = anim.to; anim = null; flipper.visible = false; show(spread); layout(); }
    },
    ink(sec = 6) {
      inkTex.redraw((c, w, h) => {
        for (let k = 0; k < 9; k++) {
          const x = Math.random() * w, y = Math.random() * h, r = 50 + Math.random() * 110;
          c.fillStyle = '#0b0d1a';
          c.beginPath();
          for (let a = 0; a <= 24; a++) { const ang = a / 24 * Math.PI * 2, rr = r * (0.7 + Math.random() * 0.5); c.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
          c.fill();
          for (let d = 0; d < 6; d++) { c.beginPath(); c.arc(x + (Math.random() - 0.5) * r * 3, y + (Math.random() - 0.5) * r * 3, 6 + Math.random() * 16, 0, 7); c.fill(); }
        }
      });
      ink.visible = true;
      setTimeout(() => { ink.visible = false; }, sec * 1000);
    },
  };
}
