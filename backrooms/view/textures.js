// The Backrooms - Textures procédurales Canvas pour le Level 0
import * as THREE from '../../shared/vendor/three/three.module.min.js';

export function createBackroomsTextures() {
  // 1. Papier peint jaune iconique Level 0
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 512;
  wallCanvas.height = 512;
  const wctx = wallCanvas.getContext('2d');

  // Fond jaune moutarde
  wctx.fillStyle = '#cfb53b';
  wctx.fillRect(0, 0, 512, 512);

  // Bandes verticales et motif de papier peint
  wctx.fillStyle = '#c4aa30';
  for (let x = 0; x < 512; x += 16) {
    wctx.fillRect(x, 0, 6, 512);
  }

  // Taches d'humidité et salissures
  wctx.fillStyle = 'rgba(120, 105, 30, 0.15)';
  for (let i = 0; i < 40; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const rad = 10 + Math.random() * 40;
    wctx.beginPath();
    wctx.arc(rx, ry, rad, 0, Math.PI * 2);
    wctx.fill();
  }

  // Bruit de texture
  const wImg = wctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < wImg.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 22;
    wImg.data[i] = Math.min(255, Math.max(0, wImg.data[i] + noise));
    wImg.data[i + 1] = Math.min(255, Math.max(0, wImg.data[i + 1] + noise));
    wImg.data[i + 2] = Math.min(255, Math.max(0, wImg.data[i + 2] + noise));
  }
  wctx.putImageData(wImg, 0, 0);

  const wallTexture = new THREE.CanvasTexture(wallCanvas);
  wallTexture.wrapS = THREE.RepeatWrapping;
  wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(1.5, 1);

  // 2. Moquette humide brunâtre
  const carpetCanvas = document.createElement('canvas');
  carpetCanvas.width = 512;
  carpetCanvas.height = 512;
  const cctx = carpetCanvas.getContext('2d');

  cctx.fillStyle = '#8f7d45';
  cctx.fillRect(0, 0, 512, 512);

  // Trame de moquette
  const cImg = cctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < cImg.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 36;
    cImg.data[i] = Math.min(255, Math.max(0, cImg.data[i] + noise));
    cImg.data[i + 1] = Math.min(255, Math.max(0, cImg.data[i + 1] + noise * 0.9));
    cImg.data[i + 2] = Math.min(255, Math.max(0, cImg.data[i + 2] + noise * 0.6));
  }
  cctx.putImageData(cImg, 0, 0);

  const carpetTexture = new THREE.CanvasTexture(carpetCanvas);
  carpetTexture.wrapS = THREE.RepeatWrapping;
  carpetTexture.wrapT = THREE.RepeatWrapping;
  carpetTexture.repeat.set(6, 6);

  // 3. Plafond suspendu à dalles
  const ceilCanvas = document.createElement('canvas');
  ceilCanvas.width = 512;
  ceilCanvas.height = 512;
  const clctx = ceilCanvas.getContext('2d');

  clctx.fillStyle = '#e8e5d8';
  clctx.fillRect(0, 0, 512, 512);

  // Grille de dalles
  clctx.strokeStyle = '#999482';
  clctx.lineWidth = 4;
  clctx.strokeRect(0, 0, 512, 512);
  clctx.strokeRect(256, 0, 0, 512);
  clctx.strokeRect(0, 256, 512, 0);

  const ceilTexture = new THREE.CanvasTexture(ceilCanvas);
  ceilTexture.wrapS = THREE.RepeatWrapping;
  ceilTexture.wrapT = THREE.RepeatWrapping;
  ceilTexture.repeat.set(6, 6);

  // 4. Texture Cassette VHS
  const vhsCanvas = document.createElement('canvas');
  vhsCanvas.width = 256;
  vhsCanvas.height = 160;
  const vctx = vhsCanvas.getContext('2d');

  vctx.fillStyle = '#1c1b18';
  vctx.fillRect(0, 0, 256, 160);

  // Étiquette blanche
  vctx.fillStyle = '#e5dfcc';
  vctx.fillRect(20, 20, 216, 65);

  // Fenêtre transparente des bobines
  vctx.fillStyle = '#0a0a09';
  vctx.fillRect(40, 100, 176, 40);

  // Bobines
  vctx.fillStyle = '#555';
  vctx.beginPath();
  vctx.arc(80, 120, 14, 0, Math.PI * 2);
  vctx.arc(176, 120, 14, 0, Math.PI * 2);
  vctx.fill();

  // Texte VHS
  vctx.fillStyle = '#9b1c1c';
  vctx.font = 'bold 20px monospace';
  vctx.fillText('BACKROOMS // TAPE', 30, 48);

  const vhsTexture = new THREE.CanvasTexture(vhsCanvas);

  // 5. Texture Porte de Sortie EXIT
  const exitCanvas = document.createElement('canvas');
  exitCanvas.width = 512;
  exitCanvas.height = 512;
  const ectx = exitCanvas.getContext('2d');

  ectx.fillStyle = '#22252a';
  ectx.fillRect(0, 0, 512, 512);

  // Panneau EXIT lumineux
  ectx.fillStyle = '#000';
  ectx.fillRect(106, 40, 300, 90);
  ectx.strokeStyle = '#c00';
  ectx.lineWidth = 4;
  ectx.strokeRect(106, 40, 300, 90);

  ectx.fillStyle = '#ff2222';
  ectx.font = 'bold 58px sans-serif';
  ectx.textAlign = 'center';
  ectx.fillText('EXIT / SORTIE', 256, 105);

  // Bandes de sécurité jaunes et noires
  ectx.fillStyle = '#d97706';
  ectx.fillRect(60, 440, 392, 40);
  ectx.fillStyle = '#000';
  for (let x = 60; x < 452; x += 40) {
    ectx.beginPath();
    ectx.moveTo(x, 480);
    ectx.lineTo(x + 20, 480);
    ectx.lineTo(x + 40, 440);
    ectx.lineTo(x + 20, 440);
    ectx.fill();
  }

  const exitTexture = new THREE.CanvasTexture(exitCanvas);

  return {
    wall: wallTexture,
    carpet: carpetTexture,
    ceiling: ceilTexture,
    vhs: vhsTexture,
    exit: exitTexture,
  };
}
