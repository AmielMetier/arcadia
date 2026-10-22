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

/* ---------- Éclairs lumineux des explosions (Haut et Ultra) ---------- */
const flashLights = [];
function flash3D(x, y, color, power = 1) {
  if (!threeScene || !gfxPreset().lights) return;
  if (hypot(x, y, cam.x, cam.y) > 1400) return;
  let l = flashLights.find((f) => f.life <= 0);
  if (!l) {
    if (flashLights.length >= 6) l = flashLights.reduce((a, b) => (a.life < b.life ? a : b));
    else { l = { light: new THREE.PointLight(0xffffff, 0, 260, 2), life: 0, max: 1 }; threeScene.add(l.light); flashLights.push(l); }
  }
  l.light.color.set(color);
  l.light.position.set(x, heightAt(x, y) + 40, y);
  l.light.distance = 200 + 160 * power;
  l.max = l.life = 0.32 + 0.18 * power;
  l.power = 3.2 * power;
}
function updateFlashes3D(dt) {
  for (const l of flashLights) {
    if (l.life <= 0) { l.light.intensity = 0; continue; }
    l.life -= dt;
    l.light.intensity = Math.max(0, l.life / l.max) * l.power;
  }
}

/* ---------- Panneau des réglages ---------- */
function syncGfxUI() {
  const pop = $('#gfxPop');
  if (!pop) return;
  for (const b of pop.querySelectorAll('[data-gfx-q]')) b.classList.toggle('on', b.dataset.gfxQ === GFX.quality);
  $('#tgCvd').textContent = GFX.colorblind ? 'ON' : 'OFF';
  $('#tgCvd').classList.toggle('on', GFX.colorblind);
  $('#tgShake').textContent = GFX.shake ? 'ON' : 'OFF';
  $('#tgShake').classList.toggle('on', GFX.shake);
  $('#tgBars').textContent = GFX.bars === 'always' ? 'TOUJOURS' : 'BLESSÉS';
  $('#tgBars').classList.toggle('on', GFX.bars === 'always');
}
(function setupGfxPanel() {
  const pop = $('#gfxPop');
  if (!pop) return;
  $('#btnGfx').onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; $('#audioPop').hidden = true; syncGfxUI(); };
  $('#btnGfx').addEventListener('pointerdown', (e) => e.stopPropagation());
  pop.addEventListener('pointerdown', (e) => e.stopPropagation());
  window.addEventListener('pointerdown', () => { pop.hidden = true; });
  for (const b of pop.querySelectorAll('[data-gfx-q]')) {
    b.onclick = () => { GFX.quality = b.dataset.gfxQ; saveGfx(); applyGfx(); syncGfxUI(); };
  }
  $('#tgCvd').onclick = () => { GFX.colorblind = !GFX.colorblind; saveGfx(); applyGfx(); syncGfxUI(); };
  $('#tgShake').onclick = () => { GFX.shake = !GFX.shake; saveGfx(); syncGfxUI(); };
  $('#tgBars').onclick = () => { GFX.bars = GFX.bars === 'always' ? 'damaged' : 'always'; saveGfx(); syncGfxUI(); };
  syncGfxUI();
}());
