// Pages du manuel imprimé, dessinées dans des canevas (texture du livret 3D).
// Une double page par section : à gauche les consignes, à droite la table ou la figure.
import { CONDS, WIRE_COLORS, KEY_COLORS, GAUGE_COLORS, LED_COLORS, OUTLETS, MODULE_INFO } from '../engine/manual.js';
import { RUNES, drawRune } from '../engine/runes.js';
import { roundRect, FONT, BUNG } from './tex.js';

export const PAGE_W = 1024, PAGE_H = 1400;
const INK = '#16181d', RED = '#b3122a', MUTED = '#6d675c', PAPER = '#f6efdc';
const M = 84; // marge
const circled = (i) => '①②③④⑤⑥'[i];

export const SECTIONS = [
  { id: 'cover', title: 'Bombe', icon: '📘', color: '#e9dcc0' },
  { id: 'wires', title: MODULE_INFO.wires.name, icon: MODULE_INFO.wires.icon, color: '#ff8f7a' },
  { id: 'safe', title: MODULE_INFO.safe.name, icon: MODULE_INFO.safe.icon, color: '#ffd166' },
  { id: 'switches', title: MODULE_INFO.switches.name, icon: MODULE_INFO.switches.icon, color: '#9fd8f5' },
  { id: 'chime', title: MODULE_INFO.chime.name, icon: MODULE_INFO.chime.icon, color: '#c9a7ff' },
  { id: 'pipes', title: MODULE_INFO.pipes.name, icon: MODULE_INFO.pipes.icon, color: '#7fd6c2' },
  { id: 'gauges', title: MODULE_INFO.gauges.name, icon: MODULE_INFO.gauges.icon, color: '#ffb3d1' },
];

/* ------------------------------------------------------------------ mise en page minimale */
// Texte enrichi : **gras**, [[#couleur|libellé]] pastille de couleur
function tokens(markup) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\[\[(#[0-9a-fA-F]{3,6})\|(.+?)\]\]/g;
  let last = 0, mm;
  const words = (s, bold) => s.split(/(\s+)/).filter(Boolean).forEach((w) => out.push({ t: w, bold, space: /^\s+$/.test(w) }));
  while ((mm = re.exec(markup))) {
    words(markup.slice(last, mm.index), false);
    if (mm[1] !== undefined) words(mm[1], true);
    else out.push({ chip: mm[2], t: mm[3] });
    last = re.lastIndex;
  }
  words(markup.slice(last), false);
  return out;
}
function pen(ctx) {
  const P = { x: M, y: M + 40, w: PAGE_W - 2 * M };
  const font = (size, bold) => `${bold ? 700 : 500} ${size}px ${FONT}`;
  P.text = (markup, { size = 35, color = INK, indent = 0, lh = 1.42 } = {}) => {
    const line = size * lh;
    let x = P.x + indent;
    const maxX = P.x + P.w;
    for (const tk of tokens(markup)) {
      if (tk.chip) {
        ctx.font = font(size, true);
        const tw = size * 0.8 + 8 + ctx.measureText(tk.t).width;
        if (x + tw > maxX) { x = P.x + indent; P.y += line; }
        chip(ctx, x, P.y - size * 0.35, tk.chip, tk.t, size);
        x += tw + 6;
        continue;
      }
      ctx.font = font(size, tk.bold);
      const w = ctx.measureText(tk.t).width;
      if (tk.space) { if (x > P.x + indent) x += w; continue; }
      if (x + w > maxX && x > P.x + indent) { x = P.x + indent; P.y += line; }
      ctx.fillStyle = tk.bold ? (color === INK ? '#000' : color) : color;
      ctx.fillText(tk.t, x, P.y);
      x += w;
    }
    P.y += line;
    return P;
  };
  P.h1 = (t, size = 66) => { ctx.font = `${size}px ${BUNG}`; ctx.fillStyle = INK; ctx.fillText(t, P.x, P.y + size * 0.6); P.y += size * 1.45; return P; };
  P.h2 = (t) => { ctx.font = `38px ${BUNG}`; ctx.fillStyle = RED; ctx.fillText(t, P.x, P.y + 24); P.y += 66; return P; };
  P.gap = (n = 18) => { P.y += n; return P; };
  P.list = (items, { ordered = false, size = 35 } = {}) => {
    items.forEach((it, k) => {
      ctx.font = `700 ${size}px ${FONT}`; ctx.fillStyle = RED;
      ctx.fillText(ordered ? `${k + 1}.` : '•', P.x + 4, P.y);
      P.text(it, { size, indent: 44 });
      P.y += 6;
    });
    return P;
  };
  return P;
}
function chip(ctx, x, cy, hex, label, size = 28) {
  const r = size * 0.36;
  ctx.fillStyle = hex; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x + r, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.font = `700 ${size}px ${FONT}`; ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
  if (label) ctx.fillText(label, x + 2 * r + 8, cy + size * 0.35);
  return 2 * r + 8 + (label ? ctx.measureText(label).width : 0);
}
function cellBox(ctx, x, y, w, h, fill = 'rgba(255,255,255,.55)') {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
}
function headCell(ctx, x, y, w, h, text, { dark = true, size = 34 } = {}) {
  cellBox(ctx, x, y, w, h, dark ? INK : '#e3d6b6');
  ctx.font = `${size}px ${BUNG}`; ctx.fillStyle = dark ? PAPER : INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
const center = (ctx, text, x, y, font, color = INK) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; };

/* ------------------------------------------------------------------ fond de page */
function paper(ctx, side, man, num, section) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  // grain
  for (let k = 0; k < 2500; k++) { ctx.fillStyle = `rgba(120,90,50,${Math.random() * 0.05})`; ctx.fillRect(Math.random() * PAGE_W, Math.random() * PAGE_H, 2, 2); }
  // ombre de la reliure
  const g = side === 'L' ? ctx.createLinearGradient(PAGE_W, 0, PAGE_W - 120, 0) : ctx.createLinearGradient(0, 0, 120, 0);
  g.addColorStop(0, 'rgba(70,45,20,.35)'); g.addColorStop(1, 'rgba(70,45,20,0)');
  ctx.fillStyle = g; ctx.fillRect(side === 'L' ? PAGE_W - 120 : 0, 0, 120, PAGE_H);
  ctx.font = `600 22px ${FONT}`; ctx.fillStyle = MUTED;
  ctx.textAlign = side === 'L' ? 'left' : 'right';
  ctx.fillText(`FIL ROUGE · MANUEL ÉD. ${man.edition} · ${section.title.toUpperCase()}`, side === 'L' ? M : PAGE_W - M, 54);
  ctx.fillText(String(num), side === 'L' ? M : PAGE_W - M, PAGE_H - 40);
  ctx.textAlign = 'left';
  ctx.strokeStyle = 'rgba(22,24,29,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M, 70); ctx.lineTo(PAGE_W - M, 70); ctx.stroke();
}

/* ------------------------------------------------------------------ contenu */
const LEFT = {
  cover(ctx, man) {
    const P = pen(ctx); P.y = 190;
    center(ctx, 'BRIGADE DE DÉMINAGE · NICE', PAGE_W / 2, 150, `600 28px ${FONT}`, MUTED);
    center(ctx, 'MANUEL DE', PAGE_W / 2, 250, `70px ${BUNG}`);
    center(ctx, 'DÉSAMORÇAGE', PAGE_W / 2, 340, `70px ${BUNG}`, RED);
    // écusson
    ctx.save(); ctx.translate(PAGE_W / 2, 560);
    ctx.fillStyle = RED; ctx.strokeStyle = INK; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, 0, 130, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 20, 62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(30, -30); ctx.quadraticCurveTo(60, -80, 100, -70); ctx.stroke();
    ctx.fillStyle = '#ffc531'; ctx.beginPath(); ctx.arc(104, -72, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    center(ctx, 'ÉDITION N°', PAGE_W / 2, 790, `40px ${BUNG}`);
    center(ctx, String(man.edition), PAGE_W / 2, 880, `120px ${BUNG}`, RED);
    P.y = 1010;
    P.text(`Vérifie avec le démineur que le numéro imprimé sous le chrono est bien **${man.edition}**. Un autre numéro, c'est un autre manuel.`, { size: 30 });
    P.gap(10);
    P.text('Les **onglets** sur la tranche mènent à chaque module. Clique la page de droite pour avancer, celle de gauche pour revenir.', { size: 28, color: MUTED });
  },
  wires(ctx, man) {
    const P = pen(ctx);
    P.h1(`${MODULE_INFO.wires.name}`);
    P.text('Des fils relient des bornes lettrées (à gauche, **A** à **F**) à des bornes numérotées (à droite, **1** à **6**).');
    P.gap();
    P.h2('Pour chaque fil');
    P.list(['Demande sa **lettre**, son **chiffre** et sa **couleur**.', 'Lis la case **lettre × chiffre** dans la grille, page de droite.', 'Coupe-le si la case le demande.'], { ordered: true });
    P.gap();
    P.h2('Légende');
    P.list(['**✂** : couper.', '**—** : ne pas toucher.', '**✂ si** deux couleurs : couper si le fil a l\'une d\'elles.', '**✂ si ①…⑥** : couper si la condition est vraie (liste page 2).']);
    P.gap();
    P.text('Le module est désamorcé quand **tous** les fils à couper le sont. Couper un mauvais fil est une **faute**.', { color: RED });
  },
  safe(ctx, man) {
    const P = pen(ctx);
    P.h1(MODULE_INFO.safe.name);
    P.text('L\'écran du coffre montre **trois symboles**. Chaque symbole vaut un chiffre (table page de droite).');
    P.gap();
    P.h2('Combinaison');
    const rules = ['Note le chiffre de chaque symbole, de gauche à droite.'];
    if (man.safe.addStamps) rules.push('Ajoute le **nombre de tampons** de la bombe au **premier** chiffre. Au-delà de 9, retire 10.');
    rules.push(`Si **${CONDS[man.safe.reverseIf].text}**, entre les chiffres **de droite à gauche**.`);
    rules.push('Pour chaque chiffre : tourner la molette (flèches) jusqu\'au **repère rouge**, puis **ENTRER**.');
    P.list(rules, { ordered: true });
    P.gap();
    P.text('Un mauvais chiffre est une **faute** et remet le coffre à zéro. Les trois voyants indiquent les chiffres déjà acceptés.', { color: RED });
  },
  switches(ctx, man) {
    const P = pen(ctx);
    const inv = LED_COLORS[man.switches.invertLed];
    P.h1(MODULE_INFO.switches.name);
    P.text('Un petit écran affiche un **code**. Cinq leviers, numérotés de **1 à 5** de gauche à droite, ont chacun une **LED** au-dessus.');
    P.gap();
    P.h2('Procédure');
    P.list([
      'Trouve le code dans la table : elle donne la position de chaque levier (**▲** haut, **▼** bas).',
      `Si la LED au-dessus d'un levier est [[${inv.hex}|${inv.id}]], **inverse** la position de ce levier.`,
      'Les autres LED ne comptent pas.',
      'Le démineur appuie sur **VALIDER**.',
    ], { ordered: true });
    P.gap();
    P.text('Une mauvaise combinaison au moment de valider est une **faute**.', { color: RED });
  },
  chime(ctx, man) {
    const P = pen(ctx);
    P.h1(MODULE_INFO.chime.name);
    P.text('Le démineur appuie sur le bouton rouge **ÉCOUTER** : quatre notes jouent. Il doit te **décrire la mélodie** : ça monte ? ça descend ? quelle note est la plus aiguë ?');
    P.gap();
    P.h2('Lire les portées');
    P.text('Chaque point est une note : **en bas = grave**, **en haut = aigu**. Trouve la mélodie qui correspond, page de droite.');
    P.gap();
    P.h2('Jouer');
    P.list(['Le démineur presse les touches de couleur dans l\'ordre indiqué sous la mélodie.',
      `Si **${CONDS[man.chime.reverseIf].text}**, l'ordre est **inversé**.`]);
    P.gap();
    P.text('Une fausse touche est une **faute** et la séquence repart du début.', { color: RED });
  },
  pipes(ctx, man) {
    const P = pen(ctx);
    P.h1(MODULE_INFO.pipes.name);
    P.text('L\'eau arrive par une **vanne colorée**, à gauche. Les sorties sont numérotées **I** à **IV**, à droite, de haut en bas.');
    P.gap();
    P.h2('Procédure');
    P.list(['Demande la **couleur de la vanne**.', `Regarde si **${CONDS[man.pipes.cond].text}**.`, 'La table (page de droite) donne la **sortie** à alimenter.',
      'Le démineur fait pivoter les tuyaux (un clic = un quart de tour) : l\'eau suit le tuyau en bleu.', 'Puis il tourne la vanne pour ouvrir.'], { ordered: true });
    P.gap();
    P.text('Ouvrir sur une fuite ou sur la mauvaise sortie est une **faute**.', { color: RED });
  },
  gauges(ctx, man) {
    const P = pen(ctx);
    P.h1(MODULE_INFO.gauges.name);
    P.text('Trois cadrans indiquent chacun une **pression de 0 à 9**. Chaque cadran est **cerclé d\'une couleur**. Sous chacun, une molette réglable de 0 à 9.');
    P.gap();
    P.h2('Procédure');
    P.list(['Pour chaque cadran : **couleur** + **pression** → la table donne le **réglage**.', 'Le démineur règle chaque molette avec les flèches.', 'Il appuie sur **PURGER**.'], { ordered: true });
    P.gap();
    P.text('Un seul mauvais réglage au moment de purger est une **faute**.', { color: RED });
  },
};

const RIGHT = {
  cover(ctx) {
    const P = pen(ctx);
    P.h1('Généralités', 48);
    P.h2('Chrono et fautes');
    P.list(['Chaque faute allume un voyant rouge sous le chrono et le fait défiler **plus vite** (+25 %).', 'Trop de fautes, ou **00:00** : la bombe explose.', 'Un module désamorcé allume son **voyant vert**, en haut à droite.'], { size: 27 });
    P.gap(6);
    P.h2('L\'extérieur de la bombe');
    P.list(['**N° de lot** : étiquette blanche sur un flanc (ex. K7R-42F).', '**Tampons** : cachets ronds au nom d\'une ville, encre **rouge** ou **bleue** (flanc, dessus, dessous).', '**Vis** : quatre vis aux coins de la face avant (celle du chrono). Un trou vide = vis manquante.'], { size: 27 });
    P.gap(6);
    P.h2('Conditions');
    CONDS.forEach((c, i) => { ctx.font = `700 34px ${FONT}`; ctx.fillStyle = RED; ctx.fillText(circled(i), P.x, P.y + 2); P.text(c.text, { size: 27, indent: 50 }); P.y += 2; });
  },
  wires(ctx, man) {
    const x0 = M - 10, y0 = 140, hw = 64, cw = (PAGE_W - 2 * x0 - hw) / 6, ch = 172;
    headCell(ctx, x0, y0, hw, 70, '');
    for (let c = 0; c < 6; c++) headCell(ctx, x0 + hw + c * cw, y0, cw, 70, String(c + 1));
    man.wires.forEach((row, r) => {
      const y = y0 + 70 + r * ch;
      headCell(ctx, x0, y, hw, ch, 'ABCDEF'[r], { dark: false });
      row.forEach((cell, c) => {
        const x = x0 + hw + c * cw;
        cellBox(ctx, x, y, cw, ch);
        const cx = x + cw / 2, cy = y + ch / 2;
        if (cell.k === 'cut') center(ctx, '✂', cx, cy, `700 70px ${FONT}`, RED);
        else if (cell.k === 'keep') center(ctx, '—', cx, cy, `700 60px ${FONT}`, '#9a9284');
        else if (cell.k === 'cond') { center(ctx, '✂ si', cx, cy - 30, `700 30px ${FONT}`, RED); center(ctx, circled(cell.q), cx, cy + 22, `700 58px ${FONT}`, RED); }
        else {
          center(ctx, '✂ si', cx, y + 34, `700 28px ${FONT}`, RED);
          cell.c.forEach((ci, k) => {
            const col = WIRE_COLORS[ci];
            const cy2 = y + 80 + k * 50;
            ctx.fillStyle = col.hex; ctx.strokeStyle = INK; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x + 22, cy2, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.font = `700 25px ${FONT}`; ctx.fillStyle = INK; ctx.fillText(col.id, x + 40, cy2 + 9);
          });
        }
      });
    });
  },
  safe(ctx, man) {
    const cols = 4, w = (PAGE_W - 2 * M) / cols, h = 186, y0 = 120;
    RUNES.forEach((_, i) => {
      const x = M + (i % cols) * w, y = y0 + Math.floor(i / cols) * h;
      ctx.fillStyle = 'rgba(255,255,255,.55)'; roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 18); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      drawRune(ctx, i, x + 18, y + 30, 112, INK, 9);
      center(ctx, String(man.safe.digits[i]), x + w - 46, y + h / 2, `66px ${BUNG}`, RED);
    });
  },
  switches(ctx, man) {
    const x0 = M, y0 = 120, cw0 = 190, cw = (PAGE_W - 2 * M - cw0) / 5, ch = 92;
    headCell(ctx, x0, y0, cw0, 74, 'CODE', { size: 30 });
    for (let c = 0; c < 5; c++) headCell(ctx, x0 + cw0 + c * cw, y0, cw, 74, String(c + 1));
    man.switches.table.forEach((row, r) => {
      const y = y0 + 74 + r * ch;
      headCell(ctx, x0, y, cw0, ch, row.code, { dark: false, size: 42 });
      row.up.forEach((u, c) => {
        cellBox(ctx, x0 + cw0 + c * cw, y, cw, ch);
        center(ctx, u ? '▲' : '▼', x0 + cw0 + c * cw + cw / 2, y + ch / 2, `700 48px ${FONT}`, u ? '#1f7a3f' : RED);
      });
    });
  },
  chime(ctx, man) {
    const cols = 2, w = (PAGE_W - 2 * M) / cols, h = 290, y0 = 110;
    man.chime.melodies.forEach((m, k) => {
      const x = M + (k % cols) * w, y = y0 + Math.floor(k / cols) * h;
      ctx.fillStyle = 'rgba(255,255,255,.55)'; roundRect(ctx, x + 8, y + 8, w - 16, h - 16, 18); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.font = `30px ${BUNG}`; ctx.fillStyle = MUTED; ctx.fillText(`N° ${k + 1}`, x + 28, y + 52);
      // portée : cinq lignes, une par hauteur
      const sx = x + 36, sw = w - 72, sy = y + 76, gap = 26;
      ctx.strokeStyle = '#cbbfa6'; ctx.lineWidth = 3;
      for (let l = 0; l < 5; l++) { ctx.beginPath(); ctx.moveTo(sx, sy + l * gap); ctx.lineTo(sx + sw, sy + l * gap); ctx.stroke(); }
      const pts = m.notes.map((n, i) => [sx + 40 + i * (sw - 80) / 3, sy + (4 - n) * gap]);
      ctx.setLineDash([8, 8]); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = INK; for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill(); }
      // touches
      let kx = x + 24;
      m.keys.forEach((i, j) => {
        const col = KEY_COLORS[i];
        ctx.fillStyle = col.hex; ctx.strokeStyle = INK; ctx.lineWidth = 3;
        roundRect(ctx, kx, y + 212, 82, 48, 8); ctx.fill(); ctx.stroke();
        center(ctx, col.id, kx + 41, y + 237, `700 22px ${FONT}`, col.id === 'jaune' ? INK : '#fff');
        kx += 82;
        if (j < 3) { center(ctx, '›', kx + 8, y + 235, `700 30px ${FONT}`, MUTED); kx += 16; }
      });
    });
  },
  pipes(ctx, man) {
    const x0 = M + 40, y0 = 150, cw0 = 300, cw = (PAGE_W - 2 * x0 - cw0) / 2, ch = 150;
    headCell(ctx, x0, y0, cw0, 110, 'VANNE', { size: 32 });
    headCell(ctx, x0 + cw0, y0, cw, 110, 'SINON', { size: 30 });
    headCell(ctx, x0 + cw0 + cw, y0, cw, 110, `SI ${circled(man.pipes.cond)}`, { size: 30 });
    man.pipes.table.forEach((row, i) => {
      const y = y0 + 110 + i * ch;
      cellBox(ctx, x0, y, cw0, ch, '#e3d6b6');
      chip(ctx, x0 + 30, y + ch / 2, KEY_COLORS[i].hex, KEY_COLORS[i].id, 40);
      row.forEach((o, k) => { cellBox(ctx, x0 + cw0 + k * cw, y, cw, ch); center(ctx, OUTLETS[o], x0 + cw0 + k * cw + cw / 2, y + ch / 2 + 4, `70px ${BUNG}`, RED); });
    });
    const P = pen(ctx); P.y = y0 + 110 + 4 * ch + 80;
    P.text(`**${circled(man.pipes.cond)}** : ${CONDS[man.pipes.cond].text}.`, { size: 30 });
  },
  gauges(ctx, man) {
    const x0 = M - 30, y0 = 150, cw0 = 190, cw = (PAGE_W - 2 * x0 - cw0) / 10, ch = 170;
    headCell(ctx, x0, y0, cw0, 90, 'COULEUR', { size: 24 });
    for (let c = 0; c < 10; c++) headCell(ctx, x0 + cw0 + c * cw, y0, cw, 90, String(c), { size: 32 });
    man.gauges.table.forEach((row, r) => {
      const y = y0 + 90 + r * ch;
      cellBox(ctx, x0, y, cw0, ch, '#e3d6b6');
      chip(ctx, x0 + 16, y + ch / 2, GAUGE_COLORS[r].hex, GAUGE_COLORS[r].id, 30);
      row.forEach((v, c) => { cellBox(ctx, x0 + cw0 + c * cw, y, cw, ch); center(ctx, String(v), x0 + cw0 + c * cw + cw / 2, y + ch / 2 + 3, `52px ${BUNG}`, RED); });
    });
    const P = pen(ctx); P.y = y0 + 90 + 4 * ch + 80;
    P.text('Colonne = **pression** lue sur le cadran. Case = **réglage** de la molette sous ce cadran.', { size: 30 });
  },
};

// Dessine la page n° idx (0 = gauche de la 1re double page)
export function drawPage(ctx, man, idx) {
  const s = Math.floor(idx / 2), side = idx % 2 ? 'R' : 'L', sec = SECTIONS[s];
  ctx.save();
  paper(ctx, side, man, idx + 1, sec);
  if (side === 'L' && s > 0) {
    // bandeau de section à gauche
    ctx.fillStyle = sec.color; ctx.fillRect(0, 84, 22, PAGE_H - 168);
  }
  (side === 'L' ? LEFT : RIGHT)[sec.id](ctx, man);
  ctx.restore();
}
export const PAGE_COUNT = SECTIONS.length * 2;
