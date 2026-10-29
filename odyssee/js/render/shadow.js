// odyssee/js/render/shadow.js — apparence des Pokémon Obscurs (teinte violette, halo sombre)
/** version « obscure » d'une image de Pokémon : teinte violette et halo sombre */
export function shadowCanvas(img, w = img?.width || 80, h = img?.height || 80) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  if (!img) return c;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  // halo
  x.filter = 'blur(2px)'; x.globalAlpha = 0.85; x.drawImage(img, 0, 0, w, h); x.filter = 'none'; x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#7a30d0'; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-over'; x.drawImage(img, 0, 0, w, h);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(40,0,70,0.55)'; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-over';
  return c;
}

