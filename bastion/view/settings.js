// Interface de Bastion Clash (navigateur uniquement).
// Réglages graphiques : qualité, mode daltonien, secousses de caméra, barres de vie. Gardés dans le navigateur.
'use strict';

const GFX_KEY = 'bastion_gfx_v1';
const GFX_PRESETS = {
  bas: { label: 'Bas', pixelRatio: 1, shadows: false, shadowSize: 1024, particles: 0.45, lights: false, bloom: false },
  moyen: { label: 'Moyen', pixelRatio: 1.25, shadows: true, shadowSize: 1024, particles: 0.75, lights: false, bloom: false },
  haut: { label: 'Haut', pixelRatio: 1.75, shadows: true, shadowSize: 2048, particles: 1, lights: true, bloom: false },
  ultra: { label: 'Ultra', pixelRatio: 2, shadows: true, shadowSize: 4096, particles: 1, lights: true, bloom: true },
};
const GFX = { quality: 'haut', colorblind: false, shake: true, bars: 'damaged' };
try { Object.assign(GFX, JSON.parse(localStorage.getItem(GFX_KEY) || '{}')); } catch (e) { /* stockage indisponible */ }
if (!GFX_PRESETS[GFX.quality]) GFX.quality = 'haut';
const gfxPreset = () => GFX_PRESETS[GFX.quality];
function saveGfx() { try { localStorage.setItem(GFX_KEY, JSON.stringify(GFX)); } catch (e) { /* ignoré */ } }

// Mode daltonien : chaque joueur reçoit une couleur de la palette Okabe-Ito, distinguable par tous
const CVD_PALETTE = ['#E69F00', '#56B4E9', '#F0E442', '#009E73', '#CC79A7', '#D55E00'];
function pc(playerOrColor) {
  const color = typeof playerOrColor === 'string' ? playerOrColor : playerOrColor && playerOrColor.color;
  if (!GFX.colorblind || !state || !color) return color || '#888888';
  const idx = state.players.findIndex((p) => p.color === color);
  return idx >= 0 ? CVD_PALETTE[idx % CVD_PALETTE.length] : color;
}

function applyGfx() {
  const q = gfxPreset();
  if (threeRenderer) {
    threeRenderer.setPixelRatio(Math.min(q.pixelRatio, window.devicePixelRatio || 1));
    threeRenderer.setSize(W, H, false);
    threeRenderer.shadowMap.enabled = q.shadows;
    if (sunLight3D) {
      sunLight3D.castShadow = q.shadows;
      if (sunLight3D.shadow.mapSize.width !== q.shadowSize) {
        sunLight3D.shadow.mapSize.set(q.shadowSize, q.shadowSize);
        if (sunLight3D.shadow.map) { sunLight3D.shadow.map.dispose(); sunLight3D.shadow.map = null; }
      }
    }
    // Les matières doivent être recompilées quand les ombres s'allument ou s'éteignent
    threeScene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  }
  if (q.bloom) loadBloom();
  lastRosterSig = '';
  if (typeof renderConsoleUI === 'function') renderConsoleUI(true);
}

/* ---------- Bloom (qualité Ultra) : chargé à la demande depuis le CDN ---------- */
let bloomState = 'off'; // off | loading | ready | failed
let bloomComposer = null;
function loadBloom() {
  if (bloomState !== 'off' || !window.THREE) return;
  bloomState = 'loading';
  const base = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
  const files = ['shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'postprocessing/EffectComposer.js',
    'postprocessing/RenderPass.js', 'postprocessing/ShaderPass.js', 'postprocessing/UnrealBloomPass.js'];
  const next = (i) => {
    if (i >= files.length) { bloomState = 'ready'; return; }
    const s = document.createElement('script');
    s.src = base + files[i];
    s.onload = () => next(i + 1);
    s.onerror = () => { bloomState = 'failed'; toast('Effet de lueur indisponible (hors ligne ?) : le jeu continue sans.', 2600); };
    document.head.appendChild(s);
  };
  next(0);
}
// Rendu final : avec lueur en Ultra si elle est chargée, sinon rendu direct
function renderFrame3D() {
  if (gfxPreset().bloom && bloomState === 'ready' && THREE.EffectComposer) {
    if (!bloomComposer) {
      bloomComposer = new THREE.EffectComposer(threeRenderer);
      bloomComposer.addPass(new THREE.RenderPass(threeScene, threeCam));
      bloomComposer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.5, 0.82));
    }
    bloomComposer.setSize(W, H);
    bloomComposer.render();
    return;
  }
  threeRenderer.render(threeScene, threeCam);
}

/* ---------- Éclairs des explosions (Haut et Ultra) ----------
   Un halo de lumière posé au sol qui s'éteint en un tiers de seconde (dessiné dans syncAndRenderThree3D). Ce ne sont
   plus de vraies lumières : chacune ajoutée à la scène faisait recompiler toutes les matières (image figée une
   demi-seconde au premier combat), puis alourdissait chaque pixel de l'écran pour le reste de la partie. */
const flashes3D = [];
function flash3D(x, y, color, power = 1) {
  if (!threeScene || !gfxPreset().lights) return;
  if (hypot(x, y, cam.x, cam.y) > 1400) return;
  if (flashes3D.length >= 24) flashes3D.shift();
  const max = 0.32 + 0.18 * power;
  flashes3D.push({ x, y, color, r: 150 + 130 * power, power, life: max, max });
}

/* ---------- Panneau Réglages (commun à tous les jeux) : le son, puis les graphismes ---------- */
(function setupSettingsPanel() {
  const btn = $('#btnSettings');
  if (!btn || !window.DDVolume) return;
  btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); Sfx.wake(); });
  DDVolume.panel(btn, {
    accent: '#2fbf71',
    test: (k) => { if (k === 'fx') Sfx.ack('marine'); },
    sections: [{
      title: 'Graphismes',
      items: [
        { label: 'Qualité', options: Object.keys(GFX_PRESETS).map((k) => [k, GFX_PRESETS[k].label]), get: () => GFX.quality,
          set: (v) => { GFX.quality = v; saveGfx(); applyGfx(); } },
        { label: 'Couleurs pour daltoniens', get: () => GFX.colorblind, set: (v) => { GFX.colorblind = v; saveGfx(); applyGfx(); } },
        { label: 'Secousses de caméra', get: () => GFX.shake, set: (v) => { GFX.shake = v; saveGfx(); } },
        { label: 'Barres de vie', options: [['damaged', 'Unités blessées'], ['always', 'Toujours']], get: () => GFX.bars,
          set: (v) => { GFX.bars = v; saveGfx(); } },
      ],
      hint: 'Bas : sans ombres, pour les petites machines. Ultra : lueurs et ombres fines.',
    }],
    hint: 'Touche <kbd>M</kbd> : couper ou remettre le son.',
  });
}());
