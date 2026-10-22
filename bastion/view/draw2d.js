// Interface de Bastion Clash (navigateur uniquement).
// Dessin 2D (repli sans WebGL) et vignettes.
'use strict';

/* ============================================================================
   PRIMITIVES DE PROJECTION 3D VUE DU DESSUS (PERSPECTIVE CAMÉRA + FACES OMBRÉES)
   ============================================================================ */
// Projette un point local (lx, ly, z) situé autour de l'ancre monde (wx, wy) en coordonnées 2D avec point de fuite caméra
function project3DOffset(wx, wy, z, isIcon = false) {
  if (isIcon) {
    return { ox: -z * 0.14, oy: -z * 0.48 };
  }
  // Point de fuite radial depuis le centre de la caméra + inclinaison isométrique à 50° vers le sud
  const perspX = clamp((wx - cam.x) * 0.00085, -0.34, 0.34) * z;
  const perspY = clamp((wy - cam.y) * 0.00085, -0.34, 0.34) * z - z * 0.77;
  return { ox: perspX - z * 0.08, oy: perspY };
}

// Génère un polygone régulier ou boîte biseautée
function makeRectPoly(hw, hh, bevel = 5) {
  const b = Math.min(bevel, hw * 0.4, hh * 0.4);
  if (b <= 0.5) {
    return [
      { x: -hw, y: -hh }, { x: hw, y: -hh },
      { x: hw, y: hh },   { x: -hw, y: hh },
    ];
  }
  return [
    { x: -hw + b, y: -hh }, { x: hw - b, y: -hh },
    { x: hw, y: -hh + b },  { x: hw, y: hh - b },
    { x: hw - b, y: hh },   { x: -hw + b, y: hh },
    { x: -hw, y: hh - b },  { x: -hw, y: -hh + b },
  ];
}

function makeNGon(r, n = 8, rot = Math.PI / 8) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

// Extrude un prisme 3D entre la hauteur z0 et la hauteur z1 avec calcul d'illumination par face latérale
function drawPrism3D(g, wx, wy, pts, z0, z1, baseColor, topColor, isIcon = false, topScale = 1.0) {
  const o0 = project3DOffset(wx, wy, z0, isIcon);
  const o1 = project3DOffset(wx, wy, z1, isIcon);
  const p0 = pts.map((p) => ({ x: p.x + o0.ox, y: p.y + o0.oy }));
  const p1 = pts.map((p) => ({ x: p.x * topScale + o1.ox, y: p.y * topScale + o1.oy }));

  const n = pts.length;
  const faces = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a0 = p0[i], b0 = p0[j], b1 = p1[j], a1 = p1[i];
    // Produit vectoriel 2D (Back-face culling : ne dessine que les faces orientées vers la caméra)
    const cross = (b0.x - a0.x) * (a1.y - a0.y) - (b0.y - a0.y) * (a1.x - a0.x);
    if (cross < 0) {
      const edgeDx = pts[j].x - pts[i].x, edgeDy = pts[j].y - pts[i].y;
      const len = Math.hypot(edgeDx, edgeDy) || 1;
      const nx = edgeDy / len, ny = -edgeDx / len;
      // Soleil venant du haut-gauche (-0.6, -0.8) + rebond sur la face avant (sud)
      const light = clamp(nx * -0.35 + ny * 0.25, -0.45, 0.25);
      const depthY = (a0.y + b0.y + a1.y + b1.y) * 0.25;
      faces.push({ a0, b0, b1, a1, col: shade(baseColor, light - 0.12), depthY });
    }
  }

  faces.sort((a, b) => a.depthY - b.depthY);
  g.strokeStyle = '#16181d';
  g.lineWidth = 2.6;
  g.lineJoin = 'round';

  for (const f of faces) {
    g.fillStyle = f.col;
    g.beginPath();
    g.moveTo(f.a0.x, f.a0.y);
    g.lineTo(f.b0.x, f.b0.y);
    g.lineTo(f.b1.x, f.b1.y);
    g.lineTo(f.a1.x, f.a1.y);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // Face supérieure (Toit 3D)
  g.fillStyle = topColor || shade(baseColor, 0.12);
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    if (i === 0) g.moveTo(p1[i].x, p1[i].y);
    else g.lineTo(p1[i].x, p1[i].y);
  }
  g.closePath();
  g.fill();
  g.stroke();

  return o1;
}

// Dessine une Pyramide / Cristal 3D pointu avec facettes triangulaires ombrées
function drawPyramid3D(g, wx, wy, pts, zBase, zApex, baseColor, isIcon = false) {
  const o0 = project3DOffset(wx, wy, zBase, isIcon);
  const oTop = project3DOffset(wx, wy, zApex, isIcon);
  const p0 = pts.map((p) => ({ x: p.x + o0.ox, y: p.y + o0.oy }));
  const apex = { x: oTop.ox, y: oTop.oy };

  const n = pts.length;
  const faces = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = p0[i], b = p0[j];
    const edgeDx = pts[j].x - pts[i].x, edgeDy = pts[j].y - pts[i].y;
    const len = Math.hypot(edgeDx, edgeDy) || 1;
    const nx = edgeDy / len, ny = -edgeDx / len;
    const light = clamp(nx * -0.45 + ny * -0.25, -0.38, 0.38);
    const depthY = (a.y + b.y + apex.y) / 3;
    faces.push({ a, b, col: shade(baseColor, light), depthY });
  }
  faces.sort((f1, f2) => f1.depthY - f2.depthY);

  g.strokeStyle = '#16181d';
  g.lineWidth = 2.4;
  g.lineJoin = 'round';
  for (const f of faces) {
    g.fillStyle = f.col;
    g.beginPath();
    g.moveTo(f.a.x, f.a.y);
    g.lineTo(f.b.x, f.b.y);
    g.lineTo(apex.x, apex.y);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

/* ============================================================================
   RENDU 3D VOLUMÉTRIQUE DES BÂTIMENTS (MULTI-ÉTAGES & ÉCHAFAUDAGES 3D)
   ============================================================================ */
function drawBuilding(g, b, color, selected, now, isIcon = false) {
  const r = b.radius;
  const def = BUILDINGS[b.kind] || BUILDINGS.hq;
  const wx = b.x || 0, wy = b.y || 0;
  const waitingScv = !isIcon && b.constructing && !b.buildStarted && (b.buildProg || 0) <= 0.01;
  const prog = b.constructing && !isIcon ? clamp(b.buildProg || 0.08, 0.12, 1) : 1;
  const H3D = (def.height || 36) * prog;
  const darkCol = shade(color, -0.28);
  const lightCol = shade(color, 0.22);

  g.save();
  g.translate(wx, wy);

  if (selected) {
    g.strokeStyle = '#2fbf71';
    g.lineWidth = 3.5;
    g.beginPath(); g.arc(0, 0, r + 9, 0, TAU); g.stroke();
  }

  // Tant que le VCS n'est pas arrivé sur l'emplacement, on affiche le plan holographique au sol !
  if (waitingScv) {
    g.fillStyle = 'rgba(31, 199, 193, 0.16)';
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = '#ffc531';
    g.lineWidth = 2.8;
    g.setLineDash([7, 5]);
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    g.setLineDash([]);
    // Balise centrale "VCS en approche"
    const pulse = 5 + Math.sin(now * 0.01) * 2.5;
    g.fillStyle = '#ffc531';
    g.strokeStyle = '#16181d';
    g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, pulse, 0, TAU); g.fill(); g.stroke();
    g.restore();
    return;
  }

  // Ombre portée 3D au sol
  g.fillStyle = 'rgba(12, 16, 20, 0.42)';
  g.beginPath(); g.ellipse(9, 11, r * 1.08, r * 0.95, 0, 0, TAU); g.fill();

  if (b.kind === 'hq') {
    // 4 Tourelles de bastion d'angle en 3D
    const cOff = r * 0.68;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.save();
      g.translate(sx * cOff, sy * cOff);
      drawPrism3D(g, wx + sx * cOff, wy + sy * cOff, makeNGon(r * 0.34, 6), 0, H3D * 0.62, '#3d414b', '#565b68', isIcon, 0.9);
      g.restore();
    }
    // Étage 1 : Forteresse blindée octogonale biseautée
    drawPrism3D(g, wx, wy, makeRectPoly(r * 0.88, r * 0.88, 12), 0, H3D * 0.56, darkCol, color, isIcon, 0.92);
    // Étage 2 : Pont de commandement en acier crème
    const top2 = drawPrism3D(g, wx, wy, makeRectPoly(r * 0.62, r * 0.62, 7), H3D * 0.56, H3D * 0.86, '#cfc4ad', '#fff8ea', isIcon, 0.92);
    // Étage 3 : Tourelle réacteur & double canon rotatif
    const top3 = drawPrism3D(g, wx, wy, makeNGon(r * 0.34, 8), H3D * 0.86, H3D * 1.04, '#2a2d35', '#484c58', isIcon, 0.9);

    g.save();
    g.translate(top3.ox, top3.oy);
    g.save();
    g.rotate(b.aimA || 0);
    g.fillStyle = '#383b44'; g.strokeStyle = '#16181d'; g.lineWidth = 2.4;
    g.fillRect(4, -8, r * 0.56, 5); g.strokeRect(4, -8, r * 0.56, 5);
    g.fillRect(4, 3, r * 0.56, 5);  g.strokeRect(4, 3, r * 0.56, 5);
    g.restore();
    g.fillStyle = '#ffc531'; g.strokeStyle = '#16181d'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, 0, 9.5, 0, TAU); g.fill(); g.stroke();
    g.restore();

    // Antenne radar Comsat rotative sur le toit 2
    g.save();
    g.translate(top2.ox - r * 0.38, top2.oy - r * 0.38);
    g.rotate(now * 0.0038);
    g.strokeStyle = '#16181d'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.stroke();
    g.fillStyle = '#1fc7c1';
    g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill(); g.stroke();
    g.restore();

  } else if (b.kind === 'extractor') {
    // Raffinerie 3D avec cuves de Gaz Vespène
    drawPrism3D(g, wx, wy, makeNGon(r, 8), 0, H3D * 0.65, '#3b4a40', '#d5f2df', isIcon, 0.9);
    const top = drawPrism3D(g, wx, wy, makeNGon(r * 0.62, 8), H3D * 0.65, H3D, '#1f8a4f', '#2fbf71', isIcon, 0.88);
    g.save();
    g.translate(top.ox, top.oy);
    g.rotate(now * 0.005);
    g.fillStyle = '#ffc531'; g.strokeStyle = '#16181d'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      g.rotate(TAU / 3);
      g.fillRect(-3, -r * 0.48, 6, r * 0.38);
      g.strokeRect(-3, -r * 0.48, 6, r * 0.38);
    }
    g.restore();

  } else if (b.kind === 'pylon') {
    // Socle 3D hexagonal + Cristal Pyramidal 3D en lévitation rotative !
    drawPrism3D(g, wx, wy, makeNGon(r * 0.92, 6, 0), 0, H3D * 0.42, darkCol, color, isIcon, 0.86);
    const rot = now * 0.0025;
    const crysPts = makeNGon(r * 0.56, 4, rot);
    const bobZ = Math.sin(now * 0.006) * 4;
    drawPrism3D(g, wx, wy, crysPts, H3D * 0.5 + bobZ, H3D * 0.78 + bobZ, '#129691', '#1fc7c1', isIcon, 1.0);
    drawPyramid3D(g, wx, wy, crysPts, H3D * 0.78 + bobZ, H3D * 1.15 + bobZ, '#64f5ef', isIcon);

  } else if (b.kind === 'barracks') {
    // Bunker Caserne 3D à 2 niveaux + rampe blindée 3D
    drawPrism3D(g, wx, wy, makeRectPoly(r * 0.95, r * 0.78, 8), 0, H3D * 0.68, '#665e52', '#f3e9d2', isIcon, 0.94);
    const top2 = drawPrism3D(g, wx, wy, makeRectPoly(r * 0.68, r * 0.48, 5), H3D * 0.68, H3D, darkCol, color, isIcon, 0.92);
    g.save();
    g.translate(top2.ox, top2.oy);
    g.fillStyle = '#ffc531'; g.strokeStyle = '#16181d'; g.lineWidth = 2.2;
    g.beginPath(); g.arc(0, 0, 6.5, 0, TAU); g.fill(); g.stroke();
    g.restore();

  } else if (b.kind === 'factory') {
    // Usine lourde 3D avec 2 cheminées cylindriques 3D hautes
    drawPrism3D(g, wx, wy, makeRectPoly(r * 0.96, r * 0.84, 9), 0, H3D * 0.65, '#353942', '#525766', isIcon, 0.94);
    drawPrism3D(g, wx, wy, makeRectPoly(r * 0.72, r * 0.54, 6), H3D * 0.65, H3D * 0.9, darkCol, color, isIcon, 0.92);
    for (const sx of [-r * 0.54, r * 0.54]) {
      g.save();
      g.translate(sx, r * 0.35);
      drawPrism3D(g, wx + sx, wy + r * 0.35, makeNGon(8.5, 6), H3D * 0.4, H3D * 1.22, '#22252b', '#ff4b2b', isIcon, 0.85);
      g.restore();
    }

  } else if (b.kind === 'turret') {
    // Socle Bunker octogonal 3D + Tourelle rotative 3D
    drawPrism3D(g, wx, wy, makeNGon(r, 8), 0, H3D * 0.58, '#6d675c', '#f3e9d2', isIcon, 0.88);
    const top2 = drawPrism3D(g, wx, wy, makeNGon(r * 0.62, 8), H3D * 0.58, H3D, darkCol, color, isIcon, 0.88);
    g.save();
    g.translate(top2.ox, top2.oy);
    g.rotate(b.aimA || 0);
    const rec = b.cd > 0.2 ? -4 : 0;
    g.fillStyle = '#16181d'; g.strokeStyle = '#16181d'; g.lineWidth = 2.4;
    g.fillRect(4 + rec, -7, r * 0.85, 5);
    g.fillRect(4 + rec, 2, r * 0.85, 5);
    g.fillStyle = lightCol;
    g.beginPath(); g.arc(0, 0, r * 0.28, 0, TAU); g.fill(); g.stroke();
    g.restore();

  } else if (b.kind === 'tesla') {
    // Bobine Tesla 3D : socle + pylône pyramidal + 2 anneaux 3D + sphère de plasma au sommet
    drawPrism3D(g, wx, wy, makeNGon(r, 8), 0, H3D * 0.38, '#2b303c', '#484e5e', isIcon, 0.88);
    drawPrism3D(g, wx, wy, makeNGon(r * 0.48, 6), H3D * 0.38, H3D * 0.92, '#1c6b68', '#1fc7c1', isIcon, 0.55);
    const topOrb = project3DOffset(wx, wy, H3D * 1.05, isIcon);
    g.save();
    g.translate(topOrb.ox, topOrb.oy);
    const pR = r * 0.42 + Math.sin(now * 0.012) * 2.5;
    g.fillStyle = '#1fc7c1'; g.strokeStyle = '#16181d'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, pR, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#fff8ea';
    g.beginPath(); g.arc(-3, -3, pR * 0.4, 0, TAU); g.fill();
    g.restore();

  } else if (b.kind === 'wall') {
    drawPrism3D(g, wx, wy, makeRectPoly(r * 0.9, r * 0.9, 5), 0, H3D, '#756e61', '#d6c8aa', isIcon, 0.9);
    const topW = project3DOffset(wx, wy, H3D, isIcon);
    g.save();
    g.translate(topW.ox, topW.oy);
    g.fillStyle = color; g.strokeStyle = '#16181d'; g.lineWidth = 2;
    g.fillRect(-r * 0.55, -4, r * 1.1, 8);
    g.strokeRect(-r * 0.55, -4, r * 1.1, 8);
    g.restore();

  } else if (b.kind === 'armory') {
    // Armurerie Tech 2D : dôme hexagonal avec capteur holo rotatif
    drawPrism3D(g, wx, wy, makeNGon(r * 0.95, 6, 0), 0, H3D * 0.58, '#323742', '#586072', isIcon, 0.92);
    const topLab = drawPrism3D(g, wx, wy, makeNGon(r * 0.62, 6, 0), H3D * 0.58, H3D * 0.88, darkCol, color, isIcon, 0.9);
    g.save();
    g.translate(topLab.ox, topLab.oy);
    g.rotate(now * 0.0035);
    g.fillStyle = '#1fc7c1'; g.strokeStyle = '#16181d'; g.lineWidth = 2.4;
    g.beginPath(); g.arc(0, 0, 7.5, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = '#ffc531'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(-11, 0); g.lineTo(11, 0); g.moveTo(0, -11); g.lineTo(0, 11); g.stroke();
    g.restore();

  } else if (b.kind === 'starport') {
    // Spatioport Spatial 2D : grande plateforme octogonale, chevrons au sol, tour radar
    drawPrism3D(g, wx, wy, makeNGon(r * 1.05, 8, Math.PI / 8), 0, H3D * 0.38, '#2b303c', '#485060', isIcon, 0.95);
    const deck = drawPrism3D(g, wx, wy, makeNGon(r * 0.82, 8, Math.PI / 8), H3D * 0.38, H3D * 0.48, darkCol, color, isIcon, 0.9);
    g.save();
    g.translate(deck.ox, deck.oy);
    g.strokeStyle = '#ffc531'; g.lineWidth = 2.8; g.lineCap = 'round';
    for (let dy = -r * 0.32; dy <= r * 0.32; dy += r * 0.32) {
      g.beginPath();
      g.moveTo(-r * 0.26, dy + 3);
      g.lineTo(0, dy - 3);
      g.lineTo(r * 0.26, dy + 3);
      g.stroke();
    }
    g.fillStyle = '#1fc7c1';
    g.beginPath(); g.arc(r * 0.48, -r * 0.36, 5, 0, TAU); g.fill();
    g.restore();
  } else if (b.kind === 'radar') {
    // Tour de Détection : socle, mât en treillis, parabole rotative
    drawPrism3D(g, wx, wy, makeNGon(r, 6, 0), 0, H3D * 0.22, '#2b303c', '#4a5263', isIcon, 0.9);
    drawPrism3D(g, wx, wy, makeNGon(r * 0.36, 4, Math.PI / 4), H3D * 0.22, H3D * 0.86, darkCol, color, isIcon, 0.7);
    const top = project3DOffset(wx, wy, H3D * 0.92, isIcon);
    g.save();
    g.translate(top.ox, top.oy);
    g.rotate(isIcon ? -0.5 : now * 0.004);
    g.fillStyle = '#e8eef4'; g.strokeStyle = '#16181d'; g.lineWidth = 2.2;
    g.beginPath(); g.ellipse(0, 0, r * 0.95, r * 0.42, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#3fe0d8';
    g.beginPath(); g.arc(0, 0, 4.5, 0, TAU); g.fill(); g.stroke();
    g.restore();
  }

  // Cage d'échafaudage holographique 3D pendant la construction
  if (!isIcon && b.constructing) {
    const fullH = def.height || 36;
    const oTop = project3DOffset(wx, wy, fullH, false);
    g.strokeStyle = '#ffc531';
    g.lineWidth = 2;
    g.setLineDash([5, 5]);
    g.strokeRect(oTop.ox - r * 0.85, oTop.oy - r * 0.85, r * 1.7, r * 1.7);
    g.setLineDash([]);
    const bw = r * 1.9;
    g.fillStyle = '#16181d';
    g.fillRect(oTop.ox - bw / 2 - 1, oTop.oy - r - 20, bw + 2, 7);
    g.fillStyle = '#ffc531';
    g.fillRect(oTop.ox - bw / 2, oTop.oy - r - 19, bw * clamp(b.buildProg || 0, 0, 1), 5);
  }

  // Anneau de progression de la file d'attente de production
  const roofOff = project3DOffset(wx, wy, H3D, isIcon);
  if (!isIcon && !b.constructing && Array.isArray(b.queue) && b.queue.length > 0 && b.qTotal > 0) {
    const qProg = clamp(1 - b.qTimer / b.qTotal, 0, 1);
    g.strokeStyle = '#ffc531';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(roofOff.ox, roofOff.oy, r + 5, -Math.PI / 2, -Math.PI / 2 + qProg * TAU);
    g.stroke();
  }

  // Barre de PV flottant au-dessus du toit 3D
  if (!isIcon && (b.hp < b.maxHp || b.kind === 'hq' || selected)) {
    const bw = r * 1.9, bh = 6;
    const pct = clamp(b.hp / b.maxHp, 0, 1);
    g.fillStyle = '#16181d';
    g.beginPath(); g.roundRect(roofOff.ox - bw / 2 - 1.5, roofOff.oy - r - 14, bw + 3, bh + 3, 3); g.fill();
    g.fillStyle = pct > 0.45 ? '#2fbf71' : '#ff4b2b';
    g.fillRect(roofOff.ox - bw / 2, roofOff.oy - r - 12.5, bw * pct, bh);
  }
  if (!isIcon && b.kind === 'hq' && state) {
    const ownerP = state.players.find((q) => Number(q.id) === Number(b.owner));
    if (ownerP) {
      const pingVal = ownerP.bot ? '🤖 IA' : `${getPlayerPing(ownerP)} ms`;
      const lbl = `${ownerP.name} · ${pingVal}`;
      g.font = '700 11px "Chakra Petch", sans-serif';
      const tw = g.measureText(lbl).width + 16;
      const bx = roofOff.ox - tw / 2, by = roofOff.oy - r - 34;
      g.fillStyle = 'rgba(22, 24, 29, 0.88)';
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath(); g.roundRect(bx, by, tw, 18, 6); g.fill(); g.stroke();
      g.fillStyle = '#fff8ea';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(lbl, roofOff.ox, by + 9);
    }
  }
  g.restore();
}

/* ============================================================================
   RENDU 3D VOLUMÉTRIQUE DES UNITÉS, ARBRES, ROCHERS & CRISTAUX
   ============================================================================ */
function drawTree3D(g, tr) {
  g.save();
  g.translate(tr.x, tr.y);

  if (tr.type === 'volcano') {
    // Ombre au sol
    g.fillStyle = 'rgba(12, 8, 10, 0.42)';
    g.beginPath(); g.ellipse(6, 8, tr.r * 1.1, tr.r * 0.9, 0, 0, TAU); g.fill();
    const oTop = project3DOffset(tr.x, tr.y, tr.h, false);
    // Cône volcanique basaltique
    g.fillStyle = tr.col || '#2a1e20';
    g.strokeStyle = '#100a0d';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-tr.r * 0.9, 0);
    g.lineTo(oTop.ox - tr.r * 0.45, oTop.oy);
    g.lineTo(oTop.ox + tr.r * 0.45, oTop.oy);
    g.lineTo(tr.r * 0.9, 0);
    g.closePath();
    g.fill(); g.stroke();
    // Cratère et magma incandescent au sommet
    g.fillStyle = '#ff4500';
    g.beginPath(); g.ellipse(oTop.ox, oTop.oy, tr.r * 0.42, tr.r * 0.28, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffd000';
    g.beginPath(); g.ellipse(oTop.ox, oTop.oy, tr.r * 0.22, tr.r * 0.15, 0, 0, TAU); g.fill();

  } else if (tr.type === 'crystal') {
    // Ombre au sol
    g.fillStyle = 'rgba(6, 16, 24, 0.38)';
    g.beginPath(); g.ellipse(5, 7, tr.r * 0.95, tr.r * 0.8, 0, 0, TAU); g.fill();
    const oTop = project3DOffset(tr.x, tr.y, tr.h * 1.15, false);
    // Spire cristalline à 2 facettes réfléchissantes
    g.fillStyle = '#104b66';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-tr.r * 0.6, 0);
    g.lineTo(oTop.ox, oTop.oy);
    g.closePath();
    g.fill();

    g.fillStyle = tr.col || '#1fc7c1';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(tr.r * 0.6, 0);
    g.lineTo(oTop.ox, oTop.oy);
    g.closePath();
    g.fill();

    g.strokeStyle = '#d6f0ff';
    g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(oTop.ox, oTop.oy); g.stroke();

  } else {
    // Arbre standard (Vallée)
    g.fillStyle = 'rgba(12, 16, 20, 0.34)';
    g.beginPath(); g.ellipse(8, 10, tr.r * 1.05, tr.r * 0.9, 0, 0, TAU); g.fill();

    const oTrunk = project3DOffset(tr.x, tr.y, tr.h * 0.32, false);
    g.strokeStyle = '#16181d'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(oTrunk.ox, oTrunk.oy); g.stroke();
    g.strokeStyle = '#5c4028'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(oTrunk.ox, oTrunk.oy); g.stroke();

    const tiers = [
      { z: tr.h * 0.38, r: tr.r * 1.0, col: shade(tr.col, -0.16) },
      { z: tr.h * 0.68, r: tr.r * 0.82, col: tr.col },
      { z: tr.h * 0.98, r: tr.r * 0.56, col: shade(tr.col, 0.2) },
    ];
    g.strokeStyle = '#16181d';
    g.lineWidth = 2.8;
    for (const t of tiers) {
      const o = project3DOffset(tr.x, tr.y, t.z, false);
      g.fillStyle = t.col;
      g.beginPath(); g.arc(o.ox, o.oy, t.r, 0, TAU); g.fill(); g.stroke();
    }
  }
  g.restore();
}

function drawUnit(g, u, color, selected, now, isIcon = false) {
  const r = u.kind === 'scv' ? 10.0 : u.radius;
  const wx = u.x || 0, wy = u.y || 0;
  const darkCol = shade(color, -0.35);
  const lightCol = shade(color, 0.25);

  g.save();
  g.translate(wx, wy);

  // Si c'est un VCS posé SUR un chantier en cours de construction, on l'élève sur la dalle 3D du chantier !
  let siteZ = 0;
  if (!isIcon && u.kind === 'scv' && u.onSite && u.buildTargetId && state) {
    const tb = state.buildings.find((b) => b.id === u.buildTargetId && b.constructing);
    if (tb) {
      const defB = BUILDINGS[tb.kind] || BUILDINGS.hq;
      siteZ = (defB.height || 36) * clamp(tb.buildProg || 0.12, 0.12, 1) * 0.72;
    }
  }
  const siteOff = siteZ > 0 ? project3DOffset(wx, wy, siteZ, false) : { ox: 0, oy: 0 };
  g.translate(siteOff.ox, siteOff.oy);

  if (!isIcon && u.stimT > 0) {
    g.strokeStyle = '#ff4b2b';
    g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, 0, r + 4 + Math.sin(now * 0.03) * 2, 0, TAU); g.stroke();
  }

  if (selected) {
    g.strokeStyle = '#2fbf71';
    g.lineWidth = 2.8;
    g.beginPath(); g.arc(0, 0, r + 6, 0, TAU); g.stroke();
  }

  g.fillStyle = 'rgba(12, 16, 20, 0.38)';
  g.beginPath(); g.ellipse(4.5, 5.5, r * 1.08, r * 0.92, 0, 0, TAU); g.fill();

  // Décalage 3D du châssis et de la tourelle/tête selon l'élévation Z
  const bodyOff = project3DOffset(wx, wy, u.kind === 'titan' ? 22 : u.kind === 'tank' || u.kind === 'siege' ? 12 : 9, isIcon);
  const topOff = project3DOffset(wx, wy, u.kind === 'titan' ? 38 : u.kind === 'tank' || u.kind === 'siege' ? 22 : 16, isIcon);

  g.strokeStyle = '#16181d';
  g.lineWidth = 2.5;

  if (u.kind === 'scv') {
    // Base chenilles au sol
    g.save();
    g.rotate(u.a || 0);
    g.fillStyle = '#383b44';
    g.fillRect(-r * 0.9, -r * 0.85, r * 1.4, 5); g.strokeRect(-r * 0.9, -r * 0.85, r * 1.4, 5);
    g.fillRect(-r * 0.9, r * 0.85 - 5, r * 1.4, 5); g.strokeRect(-r * 0.9, r * 0.85 - 5, r * 1.4, 5);
    g.fillStyle = '#ffc531';
    g.fillRect(r * 0.3, -r * 0.68, 8, 4); g.strokeRect(r * 0.3, -r * 0.68, 8, 4);
    g.fillRect(r * 0.3, r * 0.68 - 4, 8, 4); g.strokeRect(r * 0.3, r * 0.68 - 4, 8, 4);
    if (!isIcon && u.carryAmt > 0) {
      g.fillStyle = u.carryType === 'gas' ? '#2fbf71' : u.carryType === 'gold' ? '#ffc531' : '#1fc7c1';
      g.beginPath(); g.arc(r + 3, 0, 5.5, 0, TAU); g.fill(); g.stroke();
    }
    // Arc de soudure plasma actif quand le VCS construit sur le chantier
    if (!isIcon && u.onSite && u.mode === 'build') {
      const fR = 4.5 + Math.sin(now * 0.045) * 2.5;
      g.strokeStyle = '#1fc7c1';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(r * 0.7, -3); g.lineTo(r + 12, 0); g.lineTo(r * 0.7, 3); g.stroke();
      g.fillStyle = '#fff8ea';
      g.beginPath(); g.arc(r + 12, 0, fR, 0, TAU); g.fill();
    }
    g.restore();
    // Cabine 3D surélevée
    g.save();
    g.translate(bodyOff.ox, bodyOff.oy);
    g.rotate(u.a || 0);
    g.fillStyle = color;
    g.beginPath(); g.roundRect(-r * 0.78, -r * 0.68, r * 1.45, r * 1.36, 4); g.fill(); g.stroke();
    g.fillStyle = '#a9d8ff';
    g.beginPath(); g.roundRect(0, -r * 0.42, r * 0.48, r * 0.84, 2); g.fill(); g.stroke();
    g.restore();

  } else if (u.kind === 'tank' || u.kind === 'siege') {
    const L = r * 1.25, Wd = r * 0.95;
    // Niveau 0 : Chenilles et vérins de siège au sol
    g.save();
    g.rotate(u.a || 0);
    if (u.sieged) {
      g.fillStyle = '#ffc531';
      for (const [sx, sy] of [[-L * 0.85, -Wd * 1.15], [L * 0.85, -Wd * 1.15], [-L * 0.85, Wd * 1.15], [L * 0.85, Wd * 1.15]]) {
        g.beginPath(); g.arc(sx, sy, 5.5, 0, TAU); g.fill(); g.stroke();
      }
    }
    g.fillStyle = '#26282e';
    for (const sy of [-Wd, Wd - 6]) {
      g.beginPath(); g.roundRect(-L, sy, L * 2, 6, 2); g.fill(); g.stroke();
    }
    g.fillStyle = darkCol;
    g.beginPath(); g.roundRect(-L * 0.9, -Wd * 0.78, L * 1.8, Wd * 1.56, 5); g.fill(); g.stroke();
    g.restore();

    // Niveau 1 (Z=12) : Châssis blindé 3D
    g.save();
    g.translate(bodyOff.ox, bodyOff.oy);
    g.rotate(u.a || 0);
    g.fillStyle = color;
    g.beginPath(); g.roundRect(-L * 0.78, -Wd * 0.68, L * 1.56, Wd * 1.36, 4); g.fill(); g.stroke();
    g.restore();

    // Niveau 2 (Z=22) : Tourelle 3D et canon
    g.save();
    g.translate(topOff.ox, topOff.oy);
    g.rotate(u.a || 0);
    g.fillStyle = '#16181d';
    if (u.kind === 'siege') {
      const ext = u.sieged ? 21 : 14;
      g.fillRect(0, -5, r + ext, 10);
      g.fillStyle = '#1fc7c1';
      g.fillRect(4, -2, r + ext - 5, 4);
    } else {
      g.fillRect(2, -3.5, r + 11, 7);
    }
    g.fillStyle = '#fff8ea';
    g.beginPath(); g.arc(-2, 0, r * 0.5, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = color;
    g.beginPath(); g.arc(-2, 0, r * 0.25, 0, TAU); g.fill();
    g.restore();

  } else if (u.kind === 'titan') {
    const walk = isIcon ? 0 : Math.sin(now * 0.012 + (u.id || 0)) * 3;
    // Niveau 0 : Pieds mécaniques au sol
    g.save();
    g.rotate(u.a || 0);
    g.fillStyle = '#383b44';
    g.beginPath(); g.roundRect(-8 + walk, -r * 0.85, 14, 8, 3); g.fill(); g.stroke();
    g.beginPath(); g.roundRect(-8 - walk, r * 0.85 - 8, 14, 8, 3); g.fill(); g.stroke();
    g.restore();

    // Niveau 1 (Z=22) : Torse & Canons plasma aux bras
    g.save();
    g.translate(bodyOff.ox, bodyOff.oy);
    g.rotate(u.a || 0);
    g.fillStyle = '#16181d';
    g.fillRect(2, -r * 0.88, r * 0.98, 7);
    g.fillRect(2, r * 0.88 - 7, r * 0.98, 7);
    g.fillStyle = '#1fc7c1';
    g.fillRect(r * 0.65, -r * 0.82, 6, 4);
    g.fillRect(r * 0.65, r * 0.82 - 4, 6, 4);
    g.fillStyle = color;
    g.beginPath(); g.roundRect(-r * 0.78, -r * 0.78, r * 1.56, r * 1.56, 8); g.fill(); g.stroke();
    g.restore();

    // Niveau 2 (Z=38) : Épaulières lourdes & Tête réacteur 3D
    g.save();
    g.translate(topOff.ox, topOff.oy);
    g.rotate(u.a || 0);
    g.fillStyle = '#fff8ea';
    g.beginPath(); g.roundRect(-r * 0.48, -r * 0.72, r * 0.96, r * 1.44, 5); g.fill(); g.stroke();
    g.fillStyle = '#ffc531';
    g.beginPath(); g.arc(0, 0, r * 0.36, 0, TAU); g.fill(); g.stroke();
    g.restore();

  } else if (u.kind === 'dropship') {
    // Navette de Transport 2D : coque lourde avec ailes à double turbine, baie de largage
    const hoverH = isIcon ? 0 : 20 + Math.sin(now * 0.003 + (u.id || 0)) * 2;
    if (!isIcon) {
      g.fillStyle = 'rgba(10, 16, 24, 0.35)';
      g.beginPath(); g.ellipse(0, 0, r * 1.1, r * 0.75, 0, 0, TAU); g.fill();
    }
    g.save();
    g.translate(0, -hoverH);
    g.rotate(u.a || 0);
    // Réacteurs latéraux
    g.fillStyle = '#232730'; g.strokeStyle = '#121418'; g.lineWidth = 2;
    g.fillRect(-r * 0.6, -r * 0.85, r * 1.2, r * 0.35); g.strokeRect(-r * 0.6, -r * 0.85, r * 1.2, r * 0.35);
    g.fillRect(-r * 0.6, r * 0.5, r * 1.2, r * 0.35); g.strokeRect(-r * 0.6, r * 0.5, r * 1.2, r * 0.35);
    // Flammes réacteurs
    g.fillStyle = '#1fc7c1';
    g.fillRect(-r * 0.85, -r * 0.8, r * 0.25, r * 0.25);
    g.fillRect(-r * 0.85, r * 0.55, r * 0.25, r * 0.25);
    // Fuselage principal
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(r * 1.1, 0);
    g.lineTo(r * 0.3, -r * 0.65);
    g.lineTo(-r * 0.8, -r * 0.6);
    g.lineTo(-r * 0.8, r * 0.6);
    g.lineTo(r * 0.3, r * 0.65);
    g.closePath();
    g.fill(); g.stroke();
    // Verrière cockpit
    g.fillStyle = '#3ecbff';
    g.beginPath(); g.ellipse(r * 0.45, 0, r * 0.35, r * 0.25, 0, 0, TAU); g.fill();
    // Indicateur de passagers
    const passCount = u.cargo?.length || 0;
    if (passCount > 0) {
      g.fillStyle = '#ffc531';
      for (let i = 0; i < passCount; i++) g.fillRect(-r * 0.4 + i * 6, -2, 4, 4);
    }
    g.restore();

  } else if (u.kind === 'medivac') {
    // Navette Médicale 2D : cellule aérodynamique, croix de secours, propulseurs
    const hoverH = isIcon ? 0 : 20 + Math.sin(now * 0.003 + (u.id || 0)) * 2;
    if (!isIcon) {
      g.fillStyle = 'rgba(10, 16, 24, 0.35)';
      g.beginPath(); g.ellipse(0, 0, r * 1.05, r * 0.7, 0, 0, TAU); g.fill();
    }
    g.save();
    g.translate(0, -hoverH);
    g.rotate(u.a || 0);
    // Turbines
    g.fillStyle = '#2b303c'; g.strokeStyle = '#121418'; g.lineWidth = 1.8;
    g.fillRect(-r * 0.5, -r * 0.78, r * 1.0, r * 0.3); g.strokeRect(-r * 0.5, -r * 0.78, r * 1.0, r * 0.3);
    g.fillRect(-r * 0.5, r * 0.48, r * 1.0, r * 0.3); g.strokeRect(-r * 0.5, r * 0.48, r * 1.0, r * 0.3);
    // Lueur verte de propulsion
    g.fillStyle = '#2fbf71';
    g.fillRect(-r * 0.75, -r * 0.74, r * 0.25, r * 0.22);
    g.fillRect(-r * 0.75, r * 0.52, r * 0.25, r * 0.22);
    // Fuselage blanc/équipe
    g.fillStyle = '#e8edf5';
    g.beginPath();
    g.moveTo(r * 1.0, 0);
    g.lineTo(r * 0.2, -r * 0.55);
    g.lineTo(-r * 0.75, -r * 0.45);
    g.lineTo(-r * 0.75, r * 0.45);
    g.lineTo(r * 0.2, r * 0.55);
    g.closePath();
    g.fill(); g.stroke();
    // Croix médicale verte
    g.fillStyle = '#2fbf71';
    g.fillRect(-r * 0.15, -r * 0.32, r * 0.3, r * 0.64);
    g.fillRect(-r * 0.32, -r * 0.15, r * 0.64, r * 0.3);
    // Verrière
    g.fillStyle = '#3ecbff';
    g.beginPath(); g.arc(r * 0.45, 0, r * 0.22, 0, TAU); g.fill();
    g.restore();

  } else {
    // Infanterie 3D : corps à Z=9, casque et arme à Z=16
    g.save();
    g.translate(bodyOff.ox * 0.6, bodyOff.oy * 0.6);
    g.rotate(u.a || 0);
    g.fillStyle = u.kind === 'sapper' ? '#ffc531' : darkCol;
    g.beginPath(); g.roundRect(-r * 0.95, -r * 0.55, r * 0.7, r * 1.1, 3); g.fill(); g.stroke();
    g.fillStyle = darkCol;
    g.beginPath(); g.arc(0, 0, r * 0.9, 0, TAU); g.fill(); g.stroke();
    g.restore();

    g.save();
    g.translate(topOff.ox * 0.75, topOff.oy * 0.75);
    g.rotate(u.a || 0);
    if (u.kind === 'rocket') {
      g.fillStyle = '#383b44';
      g.fillRect(-4, 3, r + 9, 6); g.strokeRect(-4, 3, r + 9, 6);
      g.fillStyle = '#ff4b2b';
      g.fillRect(r + 3, 4, 4, 4);
    } else if (u.kind === 'sapper') {
      g.fillStyle = '#ff4b2b';
      g.beginPath(); g.arc(r * 0.75, 0, 5, 0, TAU); g.fill(); g.stroke();
    } else {
      g.fillStyle = '#16181d';
      g.fillRect(2, 2, r + 6, 4.5);
    }
    g.fillStyle = color;
    g.beginPath(); g.arc(0, 0, r * 0.82, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#a9d8ff';
    g.beginPath(); g.roundRect(r * 0.12, -r * 0.45, r * 0.5, r * 0.9, 3); g.fill(); g.stroke();
    g.fillStyle = lightCol;
    g.beginPath(); g.arc(-r * 0.22, -r * 0.22, r * 0.25, 0, TAU); g.fill();
    g.restore();
  }

  if (!isIcon && (u.hp < u.maxHp || selected)) {
    const bw = r * 2.1, pct = clamp(u.hp / u.maxHp, 0, 1);
    g.fillStyle = '#16181d';
    g.fillRect(topOff.ox - bw / 2 - 1, topOff.oy - r - 10, bw + 2, 5);
    g.fillStyle = pct > 0.45 ? '#2fbf71' : '#ff4b2b';
    g.fillRect(topOff.ox - bw / 2, topOff.oy - r - 9, bw * pct, 3);
  }
  g.restore();
}

function drawThumbIcon(canvasEl, kind, playerColor) {
  if (!canvasEl) return;
  const g = canvasEl.getContext('2d');
  const w = canvasEl.width, h = canvasEl.height;
  const fill = canvasEl.classList.contains('thumb') ? 2.0 : 1;   // vignettes de la carte de commande : on remplit davantage
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.save();
  if (BUILDINGS[kind]) {
    const def = BUILDINGS[kind];
    const r = def.radius;
    const zMax = (def.height || 36) * 1.1;
    const spanY = 2.05 * r + zMax * 0.48;
    const spanX = 2.25 * r + zMax * 0.14;
    const sc = Math.min((w * 0.76 * fill) / spanX, (h * 0.76 * fill) / spanY);
    const midY = -zMax * 0.24;
    g.translate(w / 2 + zMax * 0.06 * sc, h / 2 - midY * sc);
    g.scale(sc, sc);
    drawBuilding(g, { kind, x: 0, y: 0, radius: r, hp: def.hp, maxHp: def.hp, aimA: -0.4 }, playerColor, false, 0, true);
  } else if (UNITS[kind]) {
    const def = UNITS[kind];
    const r = def.radius;
    const zMax = kind === 'titan' ? 40 : (kind === 'tank' || kind === 'siege') ? 24 : 18;
    const spanY = 2.2 * r + zMax * 0.48;
    const spanX = 2.5 * r + zMax * 0.14;
    const sc = Math.min((w * 0.74 * fill) / spanX, (h * 0.74 * fill) / spanY);
    const midY = -zMax * 0.24;
    g.translate(w / 2 + zMax * 0.06 * sc, h / 2 - midY * sc);
    g.scale(sc, sc);
    drawUnit(g, { kind, x: 0, y: 0, radius: r, a: -0.35, hp: def.hp, maxHp: def.hp }, playerColor, false, 0, true);
  }
  g.restore();
}
