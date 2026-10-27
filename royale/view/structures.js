// Les bâtiments en 3D, construits avec les mêmes pans que le monde solide (engine/world.js) : un pan = une instance
// (mur, fenêtre, porte, portail, mur cassé ; cloisons), une dalle par rangée de cases, un escalier par étage.
// Toute l'île tient en quelques dizaines de maillages instanciés ; chaque pan garde son numéro d'instance (et ceux de
// ses ornements) pour pouvoir être cassé. Face extérieure à la couleur du bâtiment, face intérieure en plâtre.
// Les façades sont travaillées : enduit coloré, soubassement et chaînes d'angle en pierre, bandeaux entre les étages,
// corniche ; fenêtres avec encadrement, croisillon, vitre (allumée le soir), appui et linteau, volets, garde-corps
// et jardinières selon le bâtiment ; portes encadrées avec marche, lampe et marquise ; devantures à store rayé et
// enseigne. Toits en pente avec rives, faîtière et cheminée ; toits plats avec couvertine, climatiseurs, ventilations
// et réservoirs (engine/decor.js, qui donne aussi leurs collisions).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL, STOREY } from '../engine/buildings.js';
import { panelSolids, WALL_T, INNER_T, SLAB_T, BASE_UP, ROOF_SLOPE, levelH, floorY, slabCells } from '../engine/world.js';
import { roofDetails } from '../engine/decor.js';
import { makeRng } from '../engine/rng.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';

// couleurs des façades selon le matériau (enduits du Midi, bois peints, tôles)
const FACADES = {
  pierre: [0xf1e3c8, 0xe9cfa3, 0xf3d9b0, 0xe7b98f, 0xd98f6b, 0xf4ece0, 0xdfe4d6, 0xcfdbe3, 0xeac7b8, 0xe2d2b4],
  bois: [0xb5875a, 0x9c6b45, 0x7a8f6a, 0x8d5a3f, 0xc79e6e, 0x6f8fa0, 0xa45d45],
  metal: [0x9aa9b2, 0xb7bbb7, 0x7f919b, 0xc4b38a, 0x8fa38c, 0xa8584a],
};
const TRIMS = [0xf7f3ea, 0xefe6d2, 0xf7f3ea, 0x6b4a32, 0x52606e];
const SHUTTERS = [0x5f8f5a, 0x4a7aa8, 0xb04a3a, 0x8a8f96, 0xd9c49a, 0x3f6f74, 0x6d5a8a];
const STONES = [0xc2baab, 0xb1a998, 0xd0c6b2, 0xa89f90];
const AWNINGS = [0xc0392b, 0x2e7d32, 0x1f5fa8, 0xd68910, 0x6c3483, 0x117a65];
const SIGNS = ['BOULANGERIE', 'PHARMACIE', 'CAFÉ', 'ÉPICERIE', 'TABAC', 'BAR', 'HÔTEL', 'GARAGE', 'BOUCHERIE', 'FLEURS', 'PRESSE', 'STATION'];
const FLOWERS = [0xe84a6f, 0xf2c14e, 0xffffff, 0xb565d9, 0xf07d3a, 0xd8432f];
const INTERIOR = { pierre: 0xefe7d8, bois: 0xd9bf94, metal: 0xc9ccc8 };
const FLOORS = [0xc39a6b, 0xb0855a, 0xd2b48a, 0xa9a49a, 0xcfc6b5];
const ROOFS = { pierre: [0xb9543d, 0xa8472f, 0x9c5b40, 0x7d6a64, 0xc0613f], bois: [0x7d5435, 0x6b4a32, 0x5f5a52, 0x8a4a3a], metal: [0x7f949f, 0x8c9a91, 0x6d7d86] };
const SHUTTER_TYPES = new Set(['maison', 'chalet', 'auberge', 'mairie', 'manoir', 'abandonnee', 'cabane']);
const RAIL_TYPES = new Set(['immeuble', 'mairie', 'bureaux', 'auberge', 'manoir', 'tour']);
const FLOWER_TYPES = new Set(['maison', 'chalet', 'auberge', 'mairie']);
const CANOPY_TYPES = new Set(['maison', 'chalet', 'auberge', 'mairie', 'manoir', 'immeuble', 'bureaux']);
const SMALL = new Set(['fenCadre', 'fenVerre', 'fenPierre', 'fenVolets', 'fenGarde', 'fenJardin', 'fenFleurs', 'porteCadre', 'porteMarche', 'lampe', 'ampoule', 'soclePlein', 'soclePorte', 'soclePortail', 'bandeau', 'corniche', 'sign', 'grilleFace']);
const CORNICE_TYPES = new Set(['immeuble', 'tour', 'mairie', 'bureaux', 'manoir', 'auberge', 'boutique', 'maison']);

// ------------------------------------------------------------------ textures peintes (motif clair multiplié par la couleur)
function canvasTex(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const grain = (g, S, n, a, sz = 2) => { for (let i = 0; i < n; i++) { const v = 200 + Math.random() * 55; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(Math.random() * S, Math.random() * S, sz, sz); } };
const TEX = {
  // enduit : taches douces et fin grain (la couleur vient de l'instance)
  enduit: () => canvasTex((g, S) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 10 + Math.random() * 40, v = 225 + Math.random() * 30;
      const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, `rgba(${v},${v},${v},.35)`); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    grain(g, S, 5000, 0.35, 1.5);
    g.fillStyle = 'rgba(120,120,120,.05)'; for (let i = 0; i < 300; i++) g.fillRect(Math.random() * S, Math.random() * S, 1, 1);
  }),
  // pierre de taille : soubassements, chaînes d'angle, appuis, bandeaux
  pierre: () => canvasTex((g, S) => {
    g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += S / 4) for (let x = (y / (S / 4)) % 2 ? -S / 4 : 0; x < S; x += S / 2) {
      const v = 205 + Math.random() * 45; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 3, y + 3, S / 2 - 6, S / 4 - 6);
    }
    grain(g, S, 2500, 0.4);
  }),
  // planches horizontales
  bois: () => canvasTex((g, S) => {
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += S / 10) {
      const v = 215 + Math.random() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, S, S / 10 - 3);
      g.fillStyle = 'rgba(80,80,80,.45)'; g.fillRect(0, y + S / 10 - 3, S, 3);
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(120,120,120,.18)'; g.fillRect(Math.random() * S, y + 2 + Math.random() * (S / 10 - 8), 30 + Math.random() * 60, 1.5); }
    }
  }),
  // tôle ondulée
  metal: () => canvasTex((g, S) => {
    for (let x = 0; x < S; x++) { const v = 205 + 45 * Math.sin((x / S) * Math.PI * 2 * 12); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, S); }
    grain(g, S, 800, 0.25);
  }),
  // parquet
  parquet: () => canvasTex((g, S) => {
    for (let x = 0; x < S; x += S / 8) for (let y = 0; y < S; y += S / 2) {
      const yy = y + ((x / (S / 8)) % 2 ? S / 4 : 0), v = 200 + Math.random() * 50;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, yy % S, S / 8 - 2, S / 2 - 2); g.fillRect(x, (yy % S) - S, S / 8 - 2, S / 2 - 2);
    }
  }),
  // tuiles canal : rangées décalées, ombre sous chaque rang
  tuiles: () => canvasTex((g, S) => {
    g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, S, S);
    const rowH = S / 8, colW = S / 10;
    for (let r = 0; r < 9; r++) {
      const y = r * rowH;
      for (let c = -1; c < 11; c++) {
        const x = c * colW + (r % 2) * colW / 2, v = 200 + Math.random() * 50;
        const grd = g.createLinearGradient(x, 0, x + colW, 0);
        grd.addColorStop(0, `rgb(${v - 40},${v - 40},${v - 40})`); grd.addColorStop(0.5, `rgb(${v},${v},${v})`); grd.addColorStop(1, `rgb(${v - 50},${v - 50},${v - 50})`);
        g.fillStyle = grd; g.fillRect(x + 1, y, colW - 2, rowH + 2);
      }
      g.fillStyle = 'rgba(40,40,40,.35)'; g.fillRect(0, y + rowH - 3, S, 3);
    }
  }),
  // gravier des toits plats
  gravier: () => canvasTex((g, S) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, S, S); grain(g, S, 4000, 0.6); }),
  // volets à lames
  volet: () => canvasTex((g, S) => {
    g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += S / 16) { g.fillStyle = '#f2f2f2'; g.fillRect(0, y, S, S / 16 - 5); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y + S / 16 - 5, S, 3); }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 10, S); g.fillRect(S - 10, 0, 10, S);
  }, 128),
  // grille des climatiseurs
  grille: () => canvasTex((g, S) => {
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#5a5a5a'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#cfcfcf'; g.lineWidth = 3; for (let r = 10; r < S * 0.36; r += 9) { g.beginPath(); g.arc(S / 2, S / 2, r, 0, Math.PI * 2); g.stroke(); }
  }, 128),
  // briques des cheminées
  brique: () => canvasTex((g, S) => {
    g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += S / 12) for (let x = ((y / (S / 12)) % 2) * S / 8 - S / 8; x < S; x += S / 4) {
      const v = 215 + Math.random() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 2, y + 2, S / 4 - 4, S / 12 - 4);
    }
  }, 128),
};
// store rayé : la couleur de l'instance alterne avec du blanc (canal rouge de la texture)
function stripes() {
  return canvasTex((g, S) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#000' : '#fff'; g.fillRect((i * S) / 8, 0, S / 8, S); } }, 128);
}
// enseignes : une planche de lettres, une case par nom
function signAtlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 64 * SIGNS.length;
  const g = c.getContext('2d');
  SIGNS.forEach((name, i) => {
    const y = i * 64;
    g.fillStyle = '#1c2a3a'; g.fillRect(0, y, 1024, 64);
    g.strokeStyle = '#e9d8a6'; g.lineWidth = 4; g.strokeRect(6, y + 6, 1012, 52);
    g.fillStyle = '#f7ecc8'; g.font = 'bold 40px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, 512, y + 34);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------ géométries
// constructeur : boîtes à faces séparées, UV en mètres / 2, aSide par face
function builder() {
  const pos = [], nor = [], uv = [], side = [], idx = [];
  return {
    box(x0, y0, z0, x1, y1, z1, sideOf = () => 1) {
      const F = [
        [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
        [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
        [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
        [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
        [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]],
        [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
      ];
      for (const [a, b, c, d, n] of F) {
        const k = pos.length / 3, s = sideOf(n);
        for (const p of [a, b, c, d]) {
          pos.push(...p); nor.push(...n); side.push(s);
          // projection planaire selon la normale (texture à l'échelle du monde, 2 m par motif)
          if (n[2]) uv.push(p[0] / 2, p[1] / 2); else if (n[0]) uv.push(p[2] / 2, p[1] / 2); else uv.push(p[0] / 2, p[2] / 2);
        }
        idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
    },
    geo() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
      g.setIndex(idx); g.computeBoundingSphere();
      return g;
    },
  };
}
// pan de 4 m sur un étage normal ; +z = dehors
function panelGeo(kind, T, exterior) {
  const B = builder();
  for (const [u0, u1, v0, v1] of panelSolids(kind, STOREY)) B.box(u0, v0, -T / 2, u1, v1, T / 2, (n) => (exterior ? (n[2] < 0 ? 0 : 1) : 0));
  return B.geo();
}
const boxes = (list) => { const B = builder(); for (const b of list) B.box(...b); return B.geo(); };
// ornements d'un pan extérieur, dans son repère (u le long du pan 0 → 4, v en hauteur, +z dehors, face en z = O)
const O = WALL_T / 2;
const DECO = {
  fenCadre: () => boxes([
    [0.76, 0.94, O - 0.03, 0.9, 2.44, O + 0.05], [3.1, 0.94, O - 0.03, 3.24, 2.44, O + 0.05], [0.76, 2.3, O - 0.03, 3.24, 2.44, O + 0.05],
    [0.76, 0.94, -O - 0.05, 0.9, 2.44, -O + 0.03], [3.1, 0.94, -O - 0.05, 3.24, 2.44, -O + 0.03], [0.76, 2.3, -O - 0.05, 3.24, 2.44, -O + 0.03],
    [1.975, 1.0, -0.035, 2.025, 2.3, 0.035], [0.9, 1.83, -0.035, 3.1, 1.88, 0.035],
  ]),
  fenVerre: () => boxes([[0.9, 1.0, -0.006, 3.1, 2.3, 0.006]]),
  fenPierre: () => boxes([[0.68, 0.86, O - 0.04, 3.32, 1.0, O + 0.17], [0.68, 2.44, O - 0.03, 3.32, 2.62, O + 0.07]]),
  fenVolets: () => boxes([[-0.3, 0.96, O + 0.01, 0.84, 2.34, O + 0.06], [3.16, 0.96, O + 0.01, 4.3, 2.34, O + 0.06]]),
  fenGarde: () => {
    const L = [[0.86, 1.8, O + 0.17, 3.14, 1.86, O + 0.22], [0.86, 1.04, O + 0.17, 3.14, 1.08, O + 0.22]];
    for (let u = 0.95; u < 3.1; u += 0.15) L.push([u - 0.012, 1.08, O + 0.18, u + 0.012, 1.8, O + 0.21]);
    return boxes(L);
  },
  fenJardin: () => boxes([[1.0, 1.0, O + 0.17, 3.0, 1.2, O + 0.38]]),
  fenFleurs: () => { const L = []; for (let u = 1.1; u < 2.95; u += 0.2) { const h = 0.12 + ((u * 7.3) % 1) * 0.12; L.push([u - 0.07, 1.18, O + 0.2, u + 0.07, 1.2 + h, O + 0.35]); } return boxes(L); },
  porteCadre: () => boxes([
    [1.16, 0, O - 0.03, 1.3, 2.49, O + 0.05], [2.7, 0, O - 0.03, 2.84, 2.49, O + 0.05], [1.16, 2.35, O - 0.03, 2.84, 2.49, O + 0.05],
    [1.16, 0, -O - 0.05, 1.3, 2.49, -O + 0.03], [2.7, 0, -O - 0.05, 2.84, 2.49, -O + 0.03], [1.16, 2.35, -O - 0.05, 2.84, 2.49, -O + 0.03],
  ]),
  porteMarche: () => boxes([[1.05, -0.06, O - 0.02, 2.95, 0.12, O + 0.42]]),
  porteAuvent: () => boxes([[0.95, 2.66, O, 3.05, 2.74, O + 0.95], [0.98, 2.74, O + 0.85, 3.02, 2.8, O + 0.95], [1.0, 2.2, O, 1.07, 2.66, O + 0.07], [2.93, 2.2, O, 3.0, 2.66, O + 0.07]]),
  lampe: () => boxes([[3.02, 1.95, O, 3.14, 2.2, O + 0.1]]),
  ampoule: () => boxes([[3.04, 1.98, O + 0.1, 3.12, 2.12, O + 0.16]]),
  soclePlein: () => boxes([[-0.02, -0.05, O - 0.02, 4.02, 0.55, O + 0.05]]),
  soclePorte: () => boxes([[-0.02, -0.05, O - 0.02, 1.3, 0.55, O + 0.05], [2.7, -0.05, O - 0.02, 4.02, 0.55, O + 0.05]]),
  soclePortail: () => boxes([[-0.02, -0.05, O - 0.02, 0.2, 0.55, O + 0.05], [3.8, -0.05, O - 0.02, 4.02, 0.55, O + 0.05]]),
  bandeau: () => boxes([[-0.02, -0.12, O - 0.02, 4.02, 0.06, O + 0.07]]),
  corniche: () => boxes([[-0.03, STOREY - 0.26, O - 0.02, 4.03, STOREY - 0.08, O + 0.08], [-0.05, STOREY - 0.08, O - 0.02, 4.05, STOREY + 0.02, O + 0.15]]),
};
// store de devanture : une toile inclinée et son lambrequin
function awningGeo() {
  const a = Math.atan2(0.5, 1.1), L = Math.hypot(0.5, 1.1);
  const toile = new THREE.BoxGeometry(2.8, 0.04, L).rotateX(a).translate(2, 2.62 - 0.25, O + 0.55);
  const lambrequin = new THREE.BoxGeometry(2.8, 0.22, 0.03).translate(2, 2.03, O + 1.1);
  const g = mergeGeometries([toile.toNonIndexed(), lambrequin.toNonIndexed()]);
  toile.dispose(); lambrequin.dispose();
  return g;
}
function stairGeo() {
  // dix marches minces, deux limons et une sous-face inclinée (le dessous reste libre : on passe sous l'escalier
  // de l'étage au-dessus)
  const parts = [], n = 10, a = Math.atan2(STOREY, CELL), L = Math.hypot(STOREY, CELL);
  for (let i = 0; i < n; i++) { const y = (STOREY / n) * (i + 1); parts.push(new THREE.BoxGeometry(CELL - 0.6, 0.12, CELL / n + 0.02).translate(CELL / 2, y - 0.06, (CELL / n) * (i + 0.5))); }
  for (const x of [0.22, CELL - 0.22]) parts.push(new THREE.BoxGeometry(0.16, 0.5, L).rotateX(-a).translate(x, STOREY / 2 - 0.12, CELL / 2));
  parts.push(new THREE.BoxGeometry(CELL - 0.6, 0.06, L).rotateX(-a).translate(CELL / 2, STOREY / 2 - 0.3, CELL / 2));
  const g = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return g;
}
const unitBox = (sideOf) => { const B = builder(); B.box(0, 0, 0, 1, 1, 1, sideOf); return B.geo(); };

// matériau à deux faces de couleur : aSide = 1 → couleur de l'instance, 0 → couleur uniforme (intérieur).
// glow : lumière propre des faces intérieure (0) et extérieure (1) — les pièces restent lisibles loin des fenêtres
function twoTone(map, inner, extra = {}, glow = [0.32, 0], plainInner = false) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, ...extra });
  const U = { uInner: { value: new THREE.Color(inner) }, uGlow: { value: new THREE.Vector2(...glow) }, uPlain: { value: plainInner ? 1 : 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSide; uniform vec3 uInner; varying float vSide;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor = mix(uInner, vColor, aSide); vSide = aSide;')
      // texture plaquée selon la position dans le monde (2 m par motif) : les boîtes étirées (planchers, poteaux,
      // garde-corps) gardent un motif à la bonne taille
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        {
          vec4 wp4 = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wp4 = instanceMatrix * wp4; wn = mat3(instanceMatrix) * wn;
          #endif
          wp4 = modelMatrix * wp4; wn = abs(normalize(mat3(modelMatrix) * wn));
          #ifdef USE_MAP
            vMapUv = wn.y > 0.5 ? wp4.xz * 0.5 : (wn.x > wn.z ? wp4.zy * 0.5 : wp4.xy * 0.5);
          #endif
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uGlow; uniform float uPlain; varying float vSide;')
      // plafonds unis (le dessous des dalles ne prend pas le parquet)
      .replace('#include <map_fragment>', '#include <map_fragment>\nif (uPlain > 0.5 && vSide < 0.5) diffuseColor.rgb = diffuse;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * mix(uGlow.x, uGlow.y, vSide);');
  };
  m.customProgramCacheKey = () => 'royale-twotone';
  m.userData.inner = U.uInner;
  return m;
}
// vitres : légèrement teintées, reflets du ciel ; le soir, certaines sont allumées (couleur de l'instance)
function glassMaterial(night) {
  const m = new THREE.MeshStandardMaterial({ color: 0x9cc4dc, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.38, depthWrite: false, envMapIntensity: 1.6 });
  const U = { uNight: { value: night } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 lit = vColor; diffuseColor.rgb = diffuse;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += lit * uNight * 1.6; diffuseColor.a = mix(diffuseColor.a, 0.85, uNight * step(0.05, lit.r));');
  };
  m.customProgramCacheKey = () => 'royale-vitre';
  return m;
}
// store : blanc là où la texture est noire, couleur de l'instance ailleurs
function awningMaterial(map) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.85, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', '')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat stripe = texture2D(map, vMapUv).r; diffuseColor.rgb = mix(vec3(0.96, 0.94, 0.9), diffuseColor.rgb, stripe);');
  };
  m.customProgramCacheKey = () => 'royale-store';
  return m;
}
// enseigne : une case de la planche par instance (attribut aCell)
function signMaterial(map) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.6, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.15 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aCell;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vec2(uv.x, (aCell + uv.y) / ${SIGNS.length}.0);\n#endif\n#ifdef USE_EMISSIVEMAP\n vEmissiveMapUv = vec2(uv.x, (aCell + uv.y) / ${SIGNS.length}.0);\n#endif`);
  };
  m.customProgramCacheKey = () => 'royale-enseigne';
  return m;
}

export function buildStructures(map, { time = 'jour' } = {}) {
  const rng = makeRng(map.seed * 13 + 5);
  const night = time === 'soir' ? 1 : time === 'crepuscule' ? 0.45 : 0;
  const tex = Object.fromEntries(Object.keys(TEX).map((k) => [k, TEX[k]()]));
  tex.store = stripes(); tex.enseignes = signAtlas();
  const mats = {}, geos = {}, chimneys = [], bulbs = [];
  mats.pierre = twoTone(tex.enduit, INTERIOR.pierre, { roughness: 0.92 });
  mats.bois = twoTone(tex.bois, INTERIOR.bois, { roughness: 0.9 });
  mats.metal = twoTone(tex.metal, INTERIOR.metal, { roughness: 0.6, metalness: 0.25 });
  mats.floor = twoTone(tex.parquet, 0xf3efe6, {}, [0.32, 0.28], true);
  mats.roof = twoTone(tex.gravier, 0xf3efe6, {}, [0.32, 0], true);
  mats.socle = twoTone(tex.parquet, 0x8d877c, {}, [0, 0.28]);
  mats.stairs = new THREE.MeshStandardMaterial({ map: tex.parquet, color: 0xb98c5e, roughness: 0.85, emissive: 0x3a2a1a });
  // ornements
  mats.trim = new THREE.MeshStandardMaterial({ roughness: 0.55 });
  mats.stone = new THREE.MeshStandardMaterial({ map: tex.pierre, roughness: 0.9 });
  mats.shutter = new THREE.MeshStandardMaterial({ map: tex.volet, roughness: 0.7 });
  mats.glass = glassMaterial(night);
  mats.iron = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.45, metalness: 0.6 });
  mats.bulb = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffd27a, emissiveIntensity: 0.4 + night * 2.2 });
  mats.flower = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  mats.planter = new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.85 });
  mats.awning = awningMaterial(tex.store);
  mats.sign = signMaterial(tex.enseignes);
  mats.sign.emissiveIntensity = 0.15 + night * 0.85;
  mats.brick = new THREE.MeshStandardMaterial({ map: tex.brique, roughness: 0.9 });
  mats.unit = new THREE.MeshStandardMaterial({ color: 0xd9dcdd, roughness: 0.5, metalness: 0.35 });
  mats.grille = new THREE.MeshStandardMaterial({ map: tex.grille, roughness: 0.5, metalness: 0.3 });
  for (const k of ['mur', 'fenetre', 'porte', 'portail', 'casse']) geos['ext:' + k] = panelGeo(k, WALL_T, true);
  for (const k of ['mur', 'porte']) geos['int:' + k] = panelGeo(k, INNER_T, false);
  for (const [k, f] of Object.entries(DECO)) geos[k] = f();
  geos.awning = awningGeo();
  geos.slab = unitBox((n) => (n[1] > 0 ? 1 : 0));        // socle : dessus = plancher, côtés en pierre
  geos.deck = unitBox((n) => (n[1] < 0 ? 0 : 1));        // dalles d'étage et de toit : seul le dessous est un plafond
  geos.box = unitBox(() => 1);
  geos.stairs = stairGeo();
  geos.parapet = unitBox(() => 1);
  geos.sign = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
  geos.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 16).translate(0, 0.5, 0);
  geos.grilleFace = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);

  // listes d'instances : clé "géométrie|matériau" → [{ m: matrice, c: couleur, ref, cell }]
  const lists = new Map();
  // les ornements (et les chaînes d'angle) sont rangés par tuiles de 200 m, dessinées seulement de près (cull)
  const TILE = 200, e3 = new THREE.Vector3();
  const tiled = (geo, mat) => SMALL.has(geo) || (geo === 'box' && mat === 'stone') || geo === 'awning';
  const push = (geo, mat, m, c, ref, extra) => {
    let key = geo + '|' + mat;
    if (tiled(geo, mat)) { e3.setFromMatrixPosition(m); key += '|' + Math.floor(e3.x / TILE) + ',' + Math.floor(e3.z / TILE); }
    if (!lists.has(key)) lists.set(key, []);
    lists.get(key).push({ m, c, ref, ...extra });
  };
  const M4 = () => new THREE.Matrix4();
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  const place = (x, y, z, rot, sx = 1, sy = 1, sz = 1) => { q.setFromAxisAngle(up, rot); v.set(x, y, z); s.set(sx, sy, sz); return M4().compose(v, q, s); };
  const color = (h) => new THREE.Color(h);
  const pick = (r, list) => list[r.int(0, list.length - 1)];

  // toits en pente et pignons, fusionnés ; boiseries des toits (rives, faîtières) fusionnées aussi
  const roofPos = [], roofCol = [], roofUv = [], gabPos = [], gabCol = [];
  const trimParts = [], trimCols = [];
  const lanterns = [];
  const addBeam = (len, w, h, cx, cy, cz, rx, ry, c) => {
    const g = new THREE.BoxGeometry(len, h, w).rotateZ(rx).rotateY(ry).translate(cx, cy, cz).toNonIndexed();
    trimParts.push(g); trimCols.push([g.attributes.position.count, c]);
  };

  for (const b of map.buildings) {
    const H = levelH(b), sy = H / STOREY, mat = b.mat;
    const br = makeRng(map.seed * 31 + b.id * 977 + 11);      // les ornements ne changent pas le reste du tirage
    let face = color(FACADES[mat][rng.int(0, FACADES[mat].length - 1)]);
    if (b.type === 'grange') face = color(0x9b3f30);
    if (b.type === 'phare') face = color(0xf2efe6);
    if (b.abandoned) face.lerp(color(0x6e6a62), 0.45);
    const trim = color(b.abandoned ? 0x8a8378 : pick(br, TRIMS)), shutter = color(pick(br, SHUTTERS)), stone = color(pick(br, STONES));
    if (b.abandoned) shutter.lerp(color(0x6e6a62), 0.5);
    const floorC = color(FLOORS[rng.int(0, FLOORS.length - 1)]);
    const X0 = b.x0 * CELL, Z0 = b.z0 * CELL, X1 = (b.x0 + b.w) * CELL, Z1 = (b.z0 + b.d) * CELL;
    const fancy = mat === 'pierre' && !b.tall && b.type !== 'station' && b.type !== 'garage';
    const shutters = SHUTTER_TYPES.has(b.type), rails = RAIL_TYPES.has(b.type), flowers = FLOWER_TYPES.has(b.type) && !b.abandoned;
    const shopFront = (b.type === 'boutique' || b.type === 'station');
    let signDone = false;
    // socle (plancher du rez-de-chaussée) : boîte unité étirée sur l'emprise
    push('slab', 'socle', place(X0, b.y - 3, Z0, 0, X1 - X0, 3 + BASE_UP, Z1 - Z0), floorC, { b: b.id });
    const nodes = new Set();
    for (let k = 0; k < b.floors; k++) {
      const lv = b.levels[k], F = floorY(b, k);
      for (const e of lv.walls) {
        const key = (e.ext ? 'ext:' : 'int:') + (e.ext ? e.k : e.k === 'porte' ? 'porte' : 'mur');
        let x = e.x * CELL, z = e.z * CELL, rot = 0;
        if (e.ext) {
          if (e.o === 'h') { if (e.z === b.z0) { rot = Math.PI; x += CELL; } }
          else if (e.x === b.x0) rot = -Math.PI / 2; else { rot = Math.PI / 2; z += CELL; }
        } else if (e.o === 'v') rot = -Math.PI / 2;
        const ref = { b: b.id, k, e }, pm = place(x, F, z, rot, 1, sy, 1);
        push(key, mat, pm, face, ref);
        if (e.ext) { nodes.add(e.x + ',' + e.z); nodes.add(e.o === 'h' ? (e.x + 1) + ',' + e.z : e.x + ',' + (e.z + 1)); }
        if (!e.ext) continue;
        // ---------------------------------------------------------- ornements du pan
        const front = (b.front === 'N' && e.o === 'h' && e.z === b.z0) || (b.front === 'S' && e.o === 'h' && e.z === b.z0 + b.d)
          || (b.front === 'W' && e.o === 'v' && e.x === b.x0) || (b.front === 'E' && e.o === 'v' && e.x === b.x0 + b.w);
        if (k === 0 && fancy) push(e.k === 'porte' ? 'soclePorte' : e.k === 'portail' ? 'soclePortail' : e.k === 'casse' ? 'soclePortail' : 'soclePlein', 'stone', pm, stone, ref);
        if (k > 0 && fancy) push('bandeau', 'stone', pm, stone, ref);
        if (k === b.floors - 1 && CORNICE_TYPES.has(b.type) && mat === 'pierre') push('corniche', 'stone', pm, stone, ref);
        if (e.k === 'fenetre') {
          push('fenCadre', 'trim', pm, trim, ref);
          if (!b.abandoned) push('fenVerre', 'glass', pm, br.next() < 0.35 ? color(0xffd69a) : color(0x000000), ref);
          if (mat === 'pierre') push('fenPierre', 'stone', pm, stone, ref);
          if (shutters && !(shopFront && k === 0)) push('fenVolets', 'shutter', pm, shutter, ref);
          if (rails && k > 0) push('fenGarde', 'iron', pm, null, ref);
          else if (flowers && br.next() < 0.3) {
            push('fenJardin', 'planter', pm, null, ref);
            push('fenFleurs', 'flower', pm, color(pick(br, FLOWERS)), ref);
          }
          // devanture : store rayé au rez-de-chaussée de la façade principale
          if (shopFront && k === 0 && front) push('awning', 'awning', pm, color(b.type === 'station' ? 0xc0392b : pick(br, AWNINGS)), ref);
        } else if (e.k === 'porte') {
          push('porteCadre', 'trim', pm, trim, ref);
          if (k === 0) {
            push('porteMarche', 'stone', pm, stone, ref);
            if (!b.abandoned) { push('lampe', 'iron', pm, null, ref); push('ampoule', 'bulb', pm, null, ref); bulbs.push(new THREE.Vector3(3.08, 2.05, O + 0.2).applyMatrix4(pm)); }
            if (CANOPY_TYPES.has(b.type) && front) push('porteAuvent', 'trim', pm, trim, ref);
          }
        }
        // enseigne : au-dessus de la façade principale des commerces
        if (shopFront && k === 0 && front && !signDone && (e.k === 'fenetre' || e.k === 'porte')) {
          signDone = true;
          const cell = b.type === 'station' ? SIGNS.indexOf('STATION') : br.int(0, SIGNS.length - 2);
          // panneau de 3,6 m sur 0,45 m, un peu en avant de la façade, au-dessus du store
          const m = pm.clone().multiply(M4().makeTranslation(0.2, 2.78, O + 0.06)).multiply(M4().makeScale(3.6, 0.42, 1));
          push('sign', 'sign', m, null, ref, { cell });
        }
      }
      if (k > 0) slabCells(b, lv.hole, (x, z) => push('deck', 'floor', place(x * CELL, F - SLAB_T, z * CELL, 0, CELL, SLAB_T, CELL), floorC, { b: b.id, k, slab: `${x},${z}` }));
      if (lv.stairs) {
        const st = lv.stairs;
        // la géométrie monte vers +z : on la tourne dans le sens de l'escalier
        const rot = st.dz > 0 ? 0 : st.dz < 0 ? Math.PI : st.dx > 0 ? Math.PI / 2 : -Math.PI / 2;
        const cx = (st.x + 0.5) * CELL, cz = (st.z + 0.5) * CELL;
        const m = place(cx, F, cz, rot, 1, sy, 1).multiply(M4().makeTranslation(-CELL / 2, 0, -CELL / 2));
        push('stairs', 'stairs', m, null, { b: b.id, k });
      }
    }
    const top = floorY(b, b.floors);
    for (const n of nodes) {
      const [x, z] = n.split(',').map(Number);
      push('box', mat, place(x * CELL - WALL_T / 2, b.y, z * CELL - WALL_T / 2, 0, WALL_T, top - b.y, WALL_T), face, { b: b.id });
      // chaînes d'angle en pierre aux coins du bâtiment (une pierre sur deux plus longue de chaque côté), qui
      // dépassent un peu des deux façades sans entrer dans les pièces
      const sx = x === b.x0 ? -1 : x === b.x0 + b.w ? 1 : 0, sz = z === b.z0 ? -1 : z === b.z0 + b.d ? 1 : 0;
      if (fancy && sx && sz) {
        let i = 0;
        for (let y = b.y + BASE_UP + 0.55; y < top - 0.3; y += 0.42, i++) {
          const ax = i % 2 ? 0.6 : 0.34, az = i % 2 ? 0.34 : 0.6;
          const xa = x * CELL + sx * 0.2, xb = xa - sx * ax, za = z * CELL + sz * 0.2, zb = za - sz * az;
          push('box', 'stone', place(Math.min(xa, xb), y, Math.min(za, zb), 0, ax, 0.38, az), stone, { b: b.id });
        }
      }
    }
    // toit plat : dalle de gravier + garde-corps à couvertine ; toit en pente : plafond + deux pans + pignons + rives
    const roofC = color(ROOFS[mat][rng.int(0, ROOFS[mat].length - 1)]);
    if (b.roof !== 'pente') {
      slabCells(b, b.roofHatch || null, (x, z) => push('deck', 'roof', place(x * CELL, top - SLAB_T, z * CELL, 0, CELL, SLAB_T, CELL), color(0xb7b4ac), { b: b.id, k: b.floors, slab: `${x},${z}` }));
      const pc = face.clone().multiplyScalar(0.92);
      push('parapet', mat, place(X0 - WALL_T / 2, top, Z0 - WALL_T / 2, 0, X1 - X0 + WALL_T, 1, WALL_T), pc, { b: b.id });
      push('parapet', mat, place(X0 - WALL_T / 2, top, Z1 - WALL_T / 2, 0, X1 - X0 + WALL_T, 1, WALL_T), pc, { b: b.id });
      push('parapet', mat, place(X0 - WALL_T / 2, top, Z0, 0, WALL_T, 1, Z1 - Z0), pc, { b: b.id });
      push('parapet', mat, place(X1 - WALL_T / 2, top, Z0, 0, WALL_T, 1, Z1 - Z0), pc, { b: b.id });
      // couvertine (pierre ou métal) sur les garde-corps
      const cc = mat === 'metal' ? color(0x9aa2a8) : stone, cm = mat === 'metal' ? 'trim' : 'stone';
      push('box', cm, place(X0 - WALL_T / 2 - 0.06, top + 1, Z0 - WALL_T / 2 - 0.06, 0, X1 - X0 + WALL_T + 0.12, 0.08, WALL_T + 0.12), cc, { b: b.id });
      push('box', cm, place(X0 - WALL_T / 2 - 0.06, top + 1, Z1 - WALL_T / 2 - 0.06, 0, X1 - X0 + WALL_T + 0.12, 0.08, WALL_T + 0.12), cc, { b: b.id });
      push('box', cm, place(X0 - WALL_T / 2 - 0.06, top + 1, Z0, 0, WALL_T + 0.12, 0.08, Z1 - Z0), cc, { b: b.id });
      push('box', cm, place(X1 - WALL_T / 2 - 0.06, top + 1, Z0, 0, WALL_T + 0.12, 0.08, Z1 - Z0), cc, { b: b.id });
      if (b.roof === 'phare') lanterns.push({ x: (X0 + X1) / 2, y: top, z: (Z0 + Z1) / 2 });
    } else {
      slabCells(b, null, (x, z) => push('deck', 'roof', place(x * CELL, top - SLAB_T, z * CELL, 0, CELL, SLAB_T, CELL), color(0xb7b4ac), { b: b.id, k: b.floors, slab: `${x},${z}` }));
      const alongX = b.w >= b.d, o = 0.55; // débord du toit
      const half = (alongX ? Z1 - Z0 : X1 - X0) / 2, rise = half * ROOF_SLOPE, drop = o * ROOF_SLOPE;
      const rc = [roofC.r, roofC.g, roofC.b];
      if (b.abandoned) for (let i = 0; i < 3; i++) rc[i] *= 0.7;
      const quad = (a, bb, c, d) => {
        for (const p of [a, bb, c, a, c, d]) { roofPos.push(...p); roofCol.push(...rc); }
        // UV : le long du faîtage et dans la pente, en mètres / 2
        const L = Math.hypot(bb[0] - a[0], bb[2] - a[2]), Hs = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
        for (const [u, w] of [[0, 0], [L, 0], [L, Hs], [0, 0], [L, Hs], [0, Hs]]) roofUv.push(u / 2, w / 2);
      };
      const tri = (a, bb, c) => { for (const p of [a, bb, c]) { gabPos.push(...p); gabCol.push(face.r, face.g, face.b); } };
      const ty = top - drop, ry = top + rise;
      const slope = Math.atan(ROOF_SLOPE), sl = Math.hypot(half + o, rise + drop);
      const tc = b.abandoned ? color(0x5a5048) : color(mat === 'bois' ? 0x5a3d28 : 0xe9e2d4);
      const ridgeC = roofC.clone().multiplyScalar(0.75);
      if (alongX) {
        const zm = (Z0 + Z1) / 2;
        quad([X0 - o, ty, Z0 - o], [X1 + o, ty, Z0 - o], [X1 + o, ry, zm], [X0 - o, ry, zm]);
        quad([X1 + o, ty, Z1 + o], [X0 - o, ty, Z1 + o], [X0 - o, ry, zm], [X1 + o, ry, zm]);
        tri([X0, top, Z1], [X0, top, Z0], [X0, ry - 0.05, zm]); tri([X1, top, Z0], [X1, top, Z1], [X1, ry - 0.05, zm]);
        // planches de rive (bas des pans), rives des pignons, faîtière
        addBeam(X1 - X0 + 2 * o + 0.1, 0.06, 0.22, (X0 + X1) / 2, ty - 0.08, Z0 - o, 0, 0, tc);
        addBeam(X1 - X0 + 2 * o + 0.1, 0.06, 0.22, (X0 + X1) / 2, ty - 0.08, Z1 + o, 0, 0, tc);
        for (const xx of [X0 - o - 0.03, X1 + o + 0.03]) for (const sd of [-1, 1]) addBeam(sl, 0.07, 0.2, xx, (ty + ry) / 2 - 0.06, zm + sd * (half + o) / 2, sd * slope, Math.PI / 2, tc);
        addBeam(X1 - X0 + 2 * o, 0.26, 0.16, (X0 + X1) / 2, ry + 0.03, zm, 0, 0, ridgeC);
      } else {
        const xm = (X0 + X1) / 2;
        quad([X0 - o, ty, Z1 + o], [X0 - o, ty, Z0 - o], [xm, ry, Z0 - o], [xm, ry, Z1 + o]);
        quad([X1 + o, ty, Z0 - o], [X1 + o, ty, Z1 + o], [xm, ry, Z1 + o], [xm, ry, Z0 - o]);
        tri([X0, top, Z0], [X1, top, Z0], [xm, ry - 0.05, Z0]); tri([X1, top, Z1], [X0, top, Z1], [xm, ry - 0.05, Z1]);
        addBeam(Z1 - Z0 + 2 * o + 0.1, 0.06, 0.22, X0 - o, ty - 0.08, (Z0 + Z1) / 2, 0, Math.PI / 2, tc);
        addBeam(Z1 - Z0 + 2 * o + 0.1, 0.06, 0.22, X1 + o, ty - 0.08, (Z0 + Z1) / 2, 0, Math.PI / 2, tc);
        for (const zz of [Z0 - o - 0.03, Z1 + o + 0.03]) for (const sd of [-1, 1]) addBeam(sl, 0.07, 0.2, xm + sd * (half + o) / 2, (ty + ry) / 2 - 0.06, zz, -sd * slope, 0, tc);
        addBeam(Z1 - Z0 + 2 * o, 0.26, 0.16, xm, ry + 0.03, (Z0 + Z1) / 2, 0, Math.PI / 2, ridgeC);
      }
    }
    // cheminées, climatiseurs, ventilations, réservoirs (mêmes positions que leurs collisions)
    for (const r of roofDetails(b, map.seed, top, ROOF_SLOPE)) {
      if (r.kind === 'cheminee') {
        if (!b.abandoned) chimneys.push({ x: (r.x0 + r.x1) / 2, y: r.y1 + 0.12, z: (r.z0 + r.z1) / 2 });
        push('box', 'brick', place(r.x0, r.y0, r.z0, 0, r.x1 - r.x0, r.y1 - r.y0, r.z1 - r.z0), color(b.abandoned ? 0x7a6a5e : 0xb46a52), { b: b.id });
        push('box', 'stone', place(r.x0 - 0.08, r.y1, r.z0 - 0.08, 0, r.x1 - r.x0 + 0.16, 0.12, r.z1 - r.z0 + 0.16), stone, { b: b.id });
      } else if (r.kind === 'clim') {
        push('box', 'unit', place(r.x0, r.y0, r.z0, 0, r.x1 - r.x0, r.y1 - r.y0, r.z1 - r.z0), null, { b: b.id });
        // grille de ventilateur sur le dessus
        const gm = place((r.x0 + r.x1) / 2, r.y1 + 0.005, (r.z0 + r.z1) / 2, 0).multiply(M4().makeRotationX(-Math.PI / 2)).multiply(M4().makeScale(0.62, 0.62, 1)).multiply(M4().makeTranslation(0, -0.5, 0));
        push('grilleFace', 'grille', gm, null, { b: b.id });
      } else if (r.kind === 'ventil') {
        push('cyl', 'unit', place((r.x0 + r.x1) / 2, r.y0, (r.z0 + r.z1) / 2, 0, 0.36, r.y1 - r.y0, 0.36), null, { b: b.id });
        push('cyl', 'iron', place((r.x0 + r.x1) / 2, r.y1, (r.z0 + r.z1) / 2, 0, 0.5, 0.08, 0.5), null, { b: b.id });
      } else if (r.kind === 'reservoir') {
        for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) push('cyl', 'iron', place(r.cx + dx, r.y0, r.cz + dz, 0, 0.1, 0.7, 0.1), null, { b: b.id });
        push('cyl', 'unit', place(r.cx, r.y0 + 0.7, r.cz, 0, r.r * 2, r.y1 - r.y0 - 0.9, r.r * 2), null, { b: b.id });
        push('cyl', 'iron', place(r.cx, r.y1 - 0.2, r.cz, 0, r.r * 2.05, 0.2, r.r * 2.05), null, { b: b.id });
      }
    }
  }

  // ------------------------------------------------------------------ maillages instanciés
  const group = new THREE.Group();
  const index = new Map(); // pan → [{ mesh, i }] (le pan et ses ornements, pour les casser ensemble)
  const tiles = [];
  for (const [key, list] of lists) {
    const [g, m, tk] = key.split('|');
    const im = new THREE.InstancedMesh(geos[g], mats[m], list.length);
    if (tk) { const [tx, tz] = tk.split(',').map(Number); im.userData.tile = { x0: tx * TILE, z0: tz * TILE, x1: (tx + 1) * TILE, z1: (tz + 1) * TILE }; tiles.push(im); }
    const cells = g === 'sign' ? new Float32Array(list.length) : null;
    list.forEach((it, i) => {
      im.setMatrixAt(i, it.m);
      if (it.c) im.setColorAt(i, it.c);
      if (cells) cells[i] = it.cell || 0;
      if (it.ref && (it.ref.e || it.ref.slab != null)) {
        // pan de mur « b:k:ox,z » ou dalle « s:b:k:x,z » (clés du moteur)
        const k = it.ref.e ? it.ref.b + ':' + it.ref.k + ':' + it.ref.e.o + it.ref.e.x + ',' + it.ref.e.z : 's:' + it.ref.b + ':' + it.ref.k + ':' + it.ref.slab;
        if (!index.has(k)) index.set(k, []);
        index.get(k).push({ mesh: im, i });
      }
    });
    if (cells) im.geometry = geos[g].clone(), im.geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1));
    // les petits ornements ne projettent pas d'ombre (ce serait cher pour presque rien)
    im.castShadow = !SMALL.has(g) && m !== 'glass' && m !== 'bulb' && !(g === 'box' && m === 'stone'); im.receiveShadow = true;
    if (m === 'glass') im.renderOrder = 2;
    im.computeBoundingSphere();
    group.add(im);
  }
  const roofTex = tex.tuiles;
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const gableMat = new THREE.MeshStandardMaterial({ map: tex.enduit, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  if (roofPos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(roofPos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(roofCol, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(roofUv, 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, roofMat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  if (gabPos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(gabPos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(gabCol, 3));
    const uvs = []; for (let i = 0; i < gabPos.length; i += 3) uvs.push((gabPos[i] + gabPos[i + 2]) / 2, gabPos[i + 1] / 2);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, gableMat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  if (trimParts.length) {
    // une couleur par boiserie de toit
    for (let i = 0; i < trimParts.length; i++) {
      const [n, c] = trimCols[i], col = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
      trimParts[i].setAttribute('color', new THREE.BufferAttribute(col, 3));
      trimParts[i].deleteAttribute('uv');
    }
    const g = mergeGeometries(trimParts);
    for (const p of trimParts) p.dispose();
    const mesh = new THREE.Mesh(g, trimMat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  // lanterne des phares : galerie, vitrage lumineux, chapeau rouge
  const extra = [];
  for (const L of lanterns) {
    const gal = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.25, 24), new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.6 }));
    gal.position.set(L.x, L.y + 0.1, L.z);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.4, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd36a, emissiveIntensity: 1.4, roughness: 0.2, side: THREE.DoubleSide }));
    glass.position.set(L.x, L.y + 1.4, L.z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0xd8432f, roughness: 0.5 }));
    cap.position.set(L.x, L.y + 3.5, L.z);
    for (const o of [gal, glass, cap]) { o.castShadow = true; group.add(o); extra.push(o); }
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    group, index, chimneys, bulbs,
    // ornements : seulement les tuiles à moins de far mètres de (x, z)
    cull(x, z, far = 240) {
      for (const im of tiles) {
        const t = im.userData.tile, dx = Math.max(t.x0 - x, 0, x - t.x1), dz = Math.max(t.z0 - z, 0, z - t.z1);
        im.visible = dx * dx + dz * dz < far * far;
      }
    },
    // un pan de mur cassé disparaît avec ses ornements (clé « b:k:ox,z » du moteur)
    hideWall(key) {
      for (const w of index.get(key) || []) { w.mesh.setMatrixAt(w.i, zero); w.mesh.instanceMatrix.needsUpdate = true; }
    },
    dispose() {
      for (const g of Object.values(geos)) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
      for (const t of Object.values(tex)) t.dispose();
      roofMat.dispose(); gableMat.dispose(); trimMat.dispose();
      group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) { o.geometry.dispose(); if (extra.includes(o)) o.material.dispose(); } });
    },
  };
}
