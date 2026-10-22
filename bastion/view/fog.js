// Interface de Bastion Clash (navigateur uniquement).
// Brouillard de guerre affiché à ce joueur.
'use strict';

var fogCanvas = document.createElement('canvas');
fogCanvas.width = FOG_RES;
fogCanvas.height = FOG_RES;
var fogCtx = fogCanvas.getContext('2d');
var fogImg = fogCtx.createImageData(FOG_RES, FOG_RES);
var exploredGrid = new Uint8Array(FOG_RES * FOG_RES);
// Version lissée (plus grande + flou) : bords de vision doux au lieu de marches d'escalier
var fogSmooth = document.createElement('canvas');
fogSmooth.width = 768;
fogSmooth.height = 768;
var fogSmoothCtx = fogSmooth.getContext('2d');
var myVisGrid = new Uint8Array(FOG_RES * FOG_RES);

const exploredCanvas = null, exploredCtx = null; // conservés pour compatibilité

function isExplored(wx, wy) {
  if (!state) return true;
  const me = state.players.find((p) => p.id === myId);
  if (!me || me.dead) return true;
  if (exploredGrid[fogCellOf(wx, wy)] === 1) return true;
  return false;
}

function isVisibleToMe(wx, wy) {
  if (!state) return true;
  const me = state.players.find((p) => p.id === myId);
  if (!me || me.dead) return true;
  return myVisGrid[fogCellOf(wx, wy)] === 1;
}

let lastFogUpdate = 0;
function updateFogCanvas(now = performance.now()) {
  if (!state) return;
  if (now - lastFogUpdate < 90) return;
  lastFogUpdate = now;
  const me = state.players.find((p) => p.id === myId);
  const d = fogImg.data;
  if (!me || me.dead) {
    myVisGrid.fill(1);
    fogCtx.clearRect(0, 0, FOG_RES, FOG_RES);
    fogSmoothCtx.clearRect(0, 0, fogSmooth.width, fogSmooth.height);
    if (fogTexture3D) fogTexture3D.needsUpdate = true;
    return;
  }
  computeTeamVision(state, me.team, myVisGrid, exploredGrid);
  for (let i = 0, n = FOG_RES * FOG_RES; i < n; i++) {
    const o = i * 4;
    d[o] = 4; d[o + 1] = 8; d[o + 2] = 10;
    d[o + 3] = myVisGrid[i] ? 0 : exploredGrid[i] ? 138 : 246;
  }
  fogCtx.putImageData(fogImg, 0, 0);
  smoothFog();
  if (fogTexture3D) fogTexture3D.needsUpdate = true;
}
function smoothFog() {
  const S = fogSmooth.width;
  fogSmoothCtx.clearRect(0, 0, S, S);
  fogSmoothCtx.imageSmoothingEnabled = true;
  fogSmoothCtx.filter = `blur(${Math.round(S / FOG_RES * 1.1)}px)`;
  fogSmoothCtx.drawImage(fogCanvas, 0, 0, S, S);
  fogSmoothCtx.filter = 'none';
}
