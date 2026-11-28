// odyssee/js/render/murs-tex.js — murs des intérieurs façon HeartGold / SoulSilver, à 32 px par case.
// Le mur du fond est coupé en deux : le haut (papier peint, corniche) et le bas (lambris, cimaise, plinthe) ; les murs
// latéraux et le mur du bas sont de vrais volumes coiffés d'un chaperon (le dessus du mur, bordé d'une arête claire
// côté pièce). Fenêtres posées sur le haut du mur du fond, ombre portée des murs sur le sol.
// Tuiles (atlas du décor) : murh_<style>, murb_<style>, cap_<style>, fen_<style>, plus ombre_n / ombre_o / ombre_e.
// Styles : in0…in3 (maisons, papier peint tiré de l'identifiant de la carte), center, mart, lab, gym, league, cendre.

const rgba = (h) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, h.length > 7 ? parseInt(h.slice(7, 9), 16) : 255]; };
function toile(draw, graine = 7) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const x = c.getContext('2d'), im = x.createImageData(32, 32), d = im.data;
  const p = (i, j, col) => {
    i = Math.round(i); j = Math.round(j); if (i < 0 || j < 0 || i > 31 || j > 31 || !col) return;
    const [r, g, b, a] = rgba(col), k = (j * 32 + i) * 4;
    if (a >= 255 || !d[k + 3]) { d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = a; return; }
    const t = a / 255; d[k] = d[k] * (1 - t) + r * t; d[k + 1] = d[k + 1] * (1 - t) + g * t; d[k + 2] = d[k + 2] * (1 - t) + b * t; d[k + 3] = Math.max(d[k + 3], a);
  };
  const rect = (x0, y0, w, h, col) => { for (let j = y0; j < y0 + h; j++) for (let i = x0; i < x0 + w; i++) p(i, j, col); };
  let s = graine; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  draw({ p, rect, rnd });
  x.putImageData(im, 0, 0);
  return c;
}

// palette de chaque style : papier peint (fond, motif), lambris (fond, clair, sombre), cimaise, plinthe, chaperon
const STYLES = {
  in0: { fond: '#f4ead2', motif: '#e6d6b2', motifK: 'rayures', lam: '#b88452', lamC: '#d4a06a', lamS: '#8a5c34', cim: '#6e4626', pl: '#4a2e18', cap: '#46301e', capC: '#8a603e' },
  in1: { fond: '#e4eef0', motif: '#c8dce2', motifK: 'losanges', lam: '#8aa0a8', lamC: '#aec2c8', lamS: '#62787e', cim: '#4a5c62', pl: '#33424a', cap: '#3e4e58', capC: '#7a909a' },
  in2: { fond: '#f6e4e0', motif: '#ecc8c2', motifK: 'fleurs', lam: '#a86a5a', lamC: '#c88a78', lamS: '#7e4a3c', cim: '#5e3428', pl: '#42241a', cap: '#583428', capC: '#9a6656' },
  in3: { fond: '#eef0dc', motif: '#d8dcb8', motifK: 'pois', lam: '#8a9a5a', lamC: '#a8b878', lamS: '#667440', cim: '#4c5830', pl: '#343c20', cap: '#4a5230', capC: '#86945a' },
  center: { fond: '#fbf6ee', motif: '#f2e6d8', motifK: 'uni', bande: '#f08890', bandeS: '#d05860', lam: '#e86a78', lamC: '#f8a0a8', lamS: '#b84858', cim: '#ffffff', pl: '#8a2a38', cap: '#7a2a3a', capC: '#d87888' },
  mart: { fond: '#f6f9fc', motif: '#e6eef6', motifK: 'uni', bande: '#7aa8e0', bandeS: '#4a78b8', lam: '#5a8ad0', lamC: '#8ab4ec', lamS: '#3a5a98', cim: '#ffffff', pl: '#22386a', cap: '#22386a', capC: '#6a94d0' },
  lab: { fond: '#f2f4f6', motif: '#e2e6ea', motifK: 'carreaux', lam: '#b8c0c8', lamC: '#d8dee4', lamS: '#8a929a', cim: '#6a7480', pl: '#4a525c', cap: '#5a6470', capC: '#a8b0bc' },
  gym: { fond: '#c8ccd8', motif: '#b4b8c6', motifK: 'pierres', lam: '#8a8ea0', lamC: '#a8acbe', lamS: '#6a6e80', cim: '#e0e4f0', pl: '#4a4e60', cap: '#4a4e60', capC: '#9a9eb0' },
  league: { fond: '#6c5c9c', motif: '#7c6cac', motifK: 'losanges', lam: '#4c3c7c', lamC: '#6c5c9c', lamS: '#342860', cim: '#e8c860', pl: '#241a44', cap: '#3a2c66', capC: '#a090d8' },
  // arènes 3 à 5 : Voltacité (acier et bande jaune), Floralia (treillis de serre), Mirage (marbre lilas, cimaise d'or)
  gymElec: { fond: '#8a94a4', motif: '#7a8494', motifK: 'carreaux', bande: '#f0c838', bandeS: '#2a2a30', lam: '#4a5260', lamC: '#6a7484', lamS: '#323842', cim: '#f0c838', pl: '#1e2228', cap: '#2e343e', capC: '#f0c838' },
  gymGrass: { fond: '#dcecd0', motif: '#a8cc94', motifK: 'treillis', lam: '#7a5a3a', lamC: '#9a7650', lamS: '#5a3e24', cim: '#5a9a4a', pl: '#3a2a1a', cap: '#3e6a32', capC: '#8ac470' },
  gymPsy: { fond: '#d8cce8', motif: '#c4b4dc', motifK: 'losanges', lam: '#7a6aa8', lamC: '#9a8ac8', lamS: '#5a4a88', cim: '#e8c860', pl: '#3a2e5a', cap: '#4a3a72', capC: '#e8c860' },
  // les trois frères de l'archipel. Port-Granit : front de taille ocre, strates et veines sombres ; Cendrelune : basalte noir
  // aux fissures de braise, liseré de lave ; Fort-Écaille : mur d'écailles indigo, cimaise et chaperon d'or
  gymRock: { fond: '#b89a72', motif: '#977a54', motifK: 'strates', lam: '#7a6044', lamC: '#9c8060', lamS: '#57422c', cim: '#e2cfa4', pl: '#3a2a1a', cap: '#5a4630', capC: '#d6c096' },
  gymFire: { fond: '#3a2c2a', motif: '#e8622a', motifK: 'fissures', bande: '#ff8a2a', bandeS: '#b8320e', lam: '#2a1e1c', lamC: '#4a3430', lamS: '#170f0e', cim: '#ffb040', pl: '#0e0808', cap: '#241816', capC: '#ff7a2a' },
  gymDragon: { fond: '#3c3470', motif: '#5a4ea0', motifK: 'ecailles', bande: '#d8b45a', bandeS: '#8a6a2a', lam: '#262048', lamC: '#40387a', lamS: '#15112c', cim: '#e8c860', pl: '#0c0a1c', cap: '#2a2352', capC: '#e8c860' },
  // la Centrale de Voltacité : tôle grise, bande de danger jaune et noire, des écrans de contrôle au lieu des fenêtres
  usine: { fond: '#9aa2ae', motif: '#8a929e', motifK: 'carreaux', bande: '#f0c838', bandeS: '#2a2a30', lam: '#5a6270', lamC: '#7a8490', lamS: '#3e444e', cim: '#c8ccd4', pl: '#22262c', cap: '#30363e', capC: '#8a94a2', fenK: 'ecran', ecran: ['#0e2a20', '#40e070'] },
  // le repaire de la Team Éclipse : murs d'obsidienne, liserés violets, écrans pourpres
  eclipse: { fond: '#2a2438', motif: '#342c46', motifK: 'pierres', bande: '#6a3aa8', bandeS: '#a070e0', lam: '#1e1a2a', lamC: '#3a2e52', lamS: '#120e1a', cim: '#8a5ad0', pl: '#0a0810', cap: '#181424', capC: '#7a4ac0', fenK: 'ecran', ecran: ['#1a0a2a', '#b07af0'] },
  // la Tour Mirage : pierre dorée, frise de fresques antiques au lieu des fenêtres
  antique: { fond: '#e6d6a8', motif: '#d6c290', motifK: 'pierres', lam: '#b08a4a', lamC: '#d0aa64', lamS: '#8a6a34', cim: '#7a4a9a', pl: '#5a3a1a', cap: '#6a4a2a', capC: '#e8c860', fenK: 'fresque' },
  // le Musée des Dragons de Cimelune : marbre clair, cimaise d'or, fresques des légendes (Odyssor, Lugia) au lieu des fenêtres
  musee: { fond: '#ece6da', motif: '#dad2c2', motifK: 'pierres', lam: '#bdb5a6', lamC: '#dad2c4', lamS: '#928a7c', cim: '#c8a040', pl: '#5a5448', cap: '#6e6656', capC: '#e8c860', fenK: 'legendes' },
  // la Caserne d'Écaille : pierre de taille sombre, bandeau indigo de la garde, bannières au dragon au lieu des fenêtres
  caserne: { fond: '#6a687c', motif: '#565468', motifK: 'pierres', bande: '#3c3470', bandeS: '#d8b45a', lam: '#444254', lamC: '#5e5c70', lamS: '#2c2a38', cim: '#d8b45a', pl: '#16141e', cap: '#2e2c3c', capC: '#9a96b8', fenK: 'banniere' },
  cendre: { fond: '#5a4a44', motif: '#4a3c36', motifK: 'pierres', lam: '#3e322c', lamC: '#5a4a42', lamS: '#2a201c', cim: '#8a6a50', pl: '#1e1612', cap: '#2e2420', capC: '#6a5444' },
};
/** style des murs d'une carte d'intérieur (null : on garde l'ancien rendu) */
/** pack de graphismes : d'autres couleurs pour les murs d'un style (avant de fabriquer les textures) */
export function paletteMurs(nom, p) { if (STYLES[nom]) Object.assign(STYLES[nom], p); }

export function styleMur(m) {
  const w = m.wallStyle || 'wall_in';
  if (w === 'wall_in') { let h = 0; for (const ch of String(m.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 'in' + (h % 4); }
  if (w === 'wall_mart') return m.floor === 'lab' ? 'lab' : 'mart';
  // arènes de Voltacité, Floralia, Mirage et de l'archipel : leurs propres murs (les autres gardent la pierre grise)
  if (w === 'wall_gym' && STYLES[m.floor]) return m.floor;
  const k = w.replace('wall_', '');
  return STYLES[k] ? k : null;
}

function motif(T, S, y0, y1) {
  for (let j = y0; j < y1; j++) for (let i = 0; i < 32; i++) {
    let on = false;
    if (S.motifK === 'rayures') on = i % 8 === 0 || i % 8 === 1;
    else if (S.motifK === 'losanges') on = (Math.abs((i % 16) - 8) + Math.abs((j % 16) - 8)) === 6;
    else if (S.motifK === 'pois') on = (i % 8 === 3 && j % 8 === 3) || (i % 8 === 7 && j % 8 === 7);
    else if (S.motifK === 'carreaux') on = i % 16 === 0 || j % 16 === 0;
    else if (S.motifK === 'treillis') on = (i + j) % 8 === 0 || (i - j + 64) % 8 === 0;
    else if (S.motifK === 'pierres') on = j % 8 === 0 || (i + (Math.floor(j / 8) % 2 ? 8 : 0)) % 16 === 0;
    // strates de carrière : lits horizontaux d'épaisseur inégale, veines obliques
    else if (S.motifK === 'strates') on = j % 11 === 0 || j % 11 === 4 && (i + j) % 7 < 3 || (i * 3 + j) % 32 === 5 && j % 11 > 5;
    // basalte fissuré : un réseau de failles en zigzag où rougeoie la braise
    else if (S.motifK === 'fissures') { const a = (i + (j >> 3) * 5) % 16, z = [0, 1, 1, 2, 1, 0, 0, 1][j % 8]; on = a === 4 + z || (j % 8 === 5 && a > 4 && a < 9 && (j >> 3) % 2 === 0); }
    // écailles : demi-cercles en quinconce
    else if (S.motifK === 'ecailles') { const b = j % 8, a = (i + ((j >> 3) % 2 ? 4 : 0)) % 8 - 3.5, r = Math.sqrt(a * a + (b - 1) * (b - 1)); on = b >= 1 && r > 3.2 && r < 4.3; }
    else if (S.motifK === 'fleurs') { const a = i % 16, b = (j + (Math.floor(i / 16) % 2 ? 8 : 0)) % 16; on = (Math.abs(a - 8) + Math.abs(b - 8) <= 1) || ((a === 8) && (b === 6 || b === 10)) || ((b === 8) && (a === 6 || a === 10)); }
    T.p(i, j, on ? S.motif : S.fond);
  }
}

export function texturesMurs(putImg) {
  for (const [k, S] of Object.entries(STYLES)) {
    // haut du mur : corniche en haut, papier peint (ou bande de couleur dans les Centres et les Boutiques)
    const haut = (T) => {
      motif(T, S, 0, 32);
      T.rect(0, 0, 32, 3, S.cap); T.rect(0, 3, 32, 1, S.capC); T.rect(0, 4, 32, 1, '#00000030');
      if (S.bande) { T.rect(0, 22, 32, 10, S.bande); T.rect(0, 22, 32, 1, S.bandeS); T.rect(0, 26, 32, 1, '#ffffff50'); }
    };
    putImg('murh_' + k, toile(haut));
    // bas du mur : lambris en panneaux, cimaise en haut, plinthe sombre en bas
    putImg('murb_' + k, toile((T) => {
      T.rect(0, 0, 32, 32, S.lam);
      for (const x0 of [0, 16]) { T.rect(x0 + 2, 5, 12, 21, S.lamS); T.rect(x0 + 3, 6, 10, 19, S.lam); T.rect(x0 + 3, 6, 10, 1, S.lamC); T.rect(x0 + 3, 6, 1, 19, S.lamC); }
      T.rect(0, 0, 32, 3, S.cim); T.rect(0, 3, 32, 1, S.lamS);
      T.rect(0, 27, 32, 5, S.pl); T.rect(0, 27, 32, 1, S.lamC);
    }));
    // dessus des murs : chaperon sombre bordé d'arêtes claires ; _h pour une rangée (mur du fond, muret), _v pour une colonne
    const chaperon = (T, h) => {
      T.rect(0, 0, 32, 32, S.cap);
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) if ((i * 7 + j * 13) % 23 === 0) T.p(i, j, S.capC + '40');
      if (h) { T.rect(0, 29, 32, 3, S.capC); T.rect(0, 0, 32, 1, '#00000040'); }
      else { T.rect(0, 0, 3, 32, S.capC); T.rect(29, 0, 3, 32, S.capC); T.rect(3, 0, 1, 32, '#00000030'); T.rect(28, 0, 1, 32, '#00000030'); }
    };
    putImg('cap_' + k, toile((T) => chaperon(T, true)));
    putImg('capv_' + k, toile((T) => chaperon(T, false)));
    // fenêtre (posée sur le haut du mur du fond), avec rideaux pour les maisons
    // le Musée des Dragons a deux fresques, posées en alternance : celles dont parle le scientifique du musée. La première,
    // Odyssor, immense, nage sous la mer étoilée ; la seconde (fen_<style>_b), l'oiseau d'argent, Lugia, plonge dans la mer
    if (S.fenK === 'legendes') {
      const cadre = (T, ciel, mer) => { haut(T); T.rect(3, 5, 26, 21, S.capC); T.rect(4, 6, 24, 19, ciel); T.rect(4, 17, 24, 8, mer); for (let i = 4; i < 28; i += 3) T.p(i, 17 + (i % 2), '#a8c8e8'); };
      putImg('fen_' + k, toile((T) => {
        cadre(T, '#1c2450', '#27508c');
        for (const [x, y] of [[6, 8], [10, 11], [14, 7], [19, 10], [23, 8], [26, 12], [8, 14], [17, 13]]) T.p(x, y, (x + y) % 3 ? '#f4f0c0' : '#ffffff');
        // la baleine céleste : dos bleu nuit, ventre clair, nageoire, queue relevée, œil d'or
        for (let j = 18; j <= 23; j++) for (let i = 7; i <= 23; i++) { const q = ((i - 15) / 8.5) ** 2 + ((j - 20.5) / 2.9) ** 2; if (q <= 1) T.p(i, j, j > 21 ? '#c8dcf0' : q > 0.7 ? '#2a3a8a' : '#4a62c0'); }
        T.rect(23, 18, 2, 2, '#4a62c0'); T.p(25, 17, '#4a62c0'); T.p(26, 16, '#4a62c0'); T.p(25, 19, '#4a62c0'); T.p(26, 20, '#4a62c0');
        T.p(10, 20, '#f0d060'); T.rect(13, 23, 3, 1, '#2a3a8a'); for (const x of [12, 15, 18]) T.p(x, 19, '#9ab4f0');
      }));
      putImg('fen_' + k + '_b', toile((T) => {
        cadre(T, '#e4d6ac', '#3a6aa8');
        T.rect(4, 6, 24, 4, '#f0e6c4');
        // l'oiseau d'argent en piqué : corps blanc, ailes déployées, ventre et tour de l'œil bleus
        for (let k2 = 0; k2 < 7; k2++) { T.rect(13 + k2, 9 + k2, 3, 2, '#f4f6fa'); }
        for (let k2 = 0; k2 < 5; k2++) { T.rect(10 - k2, 9 + k2, 4, 1, '#d8dee8'); T.rect(17 + k2, 7 + k2, 4, 1, '#d8dee8'); }
        T.rect(19, 15, 2, 2, '#f4f6fa'); T.p(21, 17, '#5a7ad0'); T.p(20, 16, '#27408c'); T.rect(14, 11, 2, 2, '#5a7ad0'); T.p(12, 8, '#f4f6fa'); T.p(11, 7, '#f4f6fa');
        // gerbe d'écume là où il touche la mer
        for (const [x, y] of [[20, 18], [22, 17], [23, 19], [19, 19], [24, 18]]) T.p(x, y, '#ffffff');
      }));
      continue;
    }
    putImg('fen_' + k, toile((T) => {
      // écran, fresque, bannière : plus petits que la tuile, posés sur le mur (sans lui, leur tour restait noir)
      if (S.fenK) haut(T);
      // écran de contrôle (Centrale, repaire) : courbes lumineuses sur fond sombre
      if (S.fenK === 'ecran') {
        const [f, l] = S.ecran;
        T.rect(4, 6, 24, 18, S.cap); T.rect(6, 8, 20, 14, f);
        for (let i = 6; i < 26; i++) { T.p(i, Math.round(15 + Math.sin(i * 0.7) * 3), l); T.p(i, Math.round(19 + Math.cos(i * 0.45) * 1.5), l + '80'); }
        for (let i = 7; i < 25; i += 4) T.p(i, 10, l + 'a0');
        T.rect(4, 24, 24, 2, S.capC); return;
      }
      // bannière de la Garde d'Écaille : étoffe indigo à pointe, liseré d'or, écaille brodée
      if (S.fenK === 'banniere') {
        T.rect(7, 4, 18, 2, S.cim); T.p(6, 4, S.cim); T.p(25, 4, S.cim);
        for (let j = 6; j < 27; j++) { const r = j > 21 ? j - 21 : 0; T.rect(9 + r, j, 14 - 2 * r, 1, '#3c3470'); if (14 - 2 * r > 2) { T.p(9 + r, j, S.cim); T.p(22 - r, j, S.cim); } }
        for (let j = 8; j <= 18; j++) for (let i = 12; i <= 20; i++) { const q = ((i - 16) / 3.5) ** 2 + ((j - 13) / 4.5) ** 2; if (q <= 1) T.p(i, j, q > 0.7 ? S.cim : i < 16 ? '#8a7ad0' : '#6a5cc0'); }
        T.p(15, 11, '#ffffff');
        return;
      }
      // fresque antique (Tour Mirage) : trois oiseaux et la mer, sur un fond ocre, dans un cadre d'or
      if (S.fenK === 'fresque') {
        T.rect(3, 5, 26, 21, S.capC); T.rect(4, 6, 24, 19, '#d8b878'); T.rect(4, 19, 24, 6, '#5a7ab0');
        for (let i = 4; i < 28; i += 3) T.p(i, 19 + (i % 2), '#a8c8e8');
        for (const [x, y, c] of [[9, 11, '#e8c040'], [16, 9, '#d84a3a'], [23, 11, '#7ac0e8']]) { T.p(x, y, c); T.p(x - 1, y - 1, c); T.p(x - 2, y - 1, c); T.p(x + 1, y - 1, c); T.p(x + 2, y - 1, c); T.p(x, y + 1, c); }
        T.rect(14, 14, 4, 3, '#e8e8f0'); T.p(13, 15, '#e8e8f0'); T.p(18, 15, '#e8e8f0');
        return;
      }
      T.rect(5, 6, 22, 20, S.cap); T.rect(7, 8, 18, 16, '#a8d8f8'); T.rect(7, 8, 18, 6, '#c8e8ff');
      T.rect(15, 8, 2, 16, S.cap); T.rect(7, 15, 18, 2, S.cap);
      T.rect(9, 9, 3, 1, '#ffffff'); T.rect(19, 18, 3, 1, '#ffffff');
      T.rect(4, 25, 24, 2, S.capC);
      if (k.startsWith('in')) { T.rect(3, 5, 5, 20, S.motif); T.rect(24, 5, 5, 20, S.motif); T.rect(3, 5, 26, 2, S.lamS); T.rect(3, 5, 5, 20, S.lamC + '90'); T.rect(24, 5, 5, 20, S.lamC + '90'); }
    }));
  }
  // tapis des maisons (posé sous la table, 3 × 2 cases) : une bordure, un motif au centre
  for (const [k, c1, c2, c3] of [['in0', '#b84838', '#e8c060', '#8a2a20'], ['in1', '#3a6aa8', '#e8e0c8', '#24467a'], ['in2', '#7a5a9a', '#f0d8a0', '#523a70'], ['in3', '#4a8a5a', '#f0e0b0', '#2e5a3a']]) putImg('tapis_' + k, toile((T) => {
    T.rect(0, 0, 32, 32, c3); T.rect(1, 1, 30, 30, c1); T.rect(3, 3, 26, 26, c2); T.rect(4, 4, 24, 24, c1);
    for (let i = 6; i < 26; i += 4) { T.p(i, 6, c2); T.p(i, 25, c2); } for (let j = 6; j < 26; j += 4) { T.p(6, j, c2); T.p(25, j, c2); }
    for (let j = 10; j < 22; j++) for (let i = 10; i < 22; i++) if (Math.abs(i - 15.5) + Math.abs(j - 15.5) < 6) T.p(i, j, (i + j) % 2 ? c2 : c3);
  }));
  // ombres portées des murs sur le sol (nord : mur du fond ; ouest et est : murs latéraux)
  putImg('ombre_n', toile((T) => { for (let j = 0; j < 12; j++) T.rect(0, j, 32, 1, `#000000${Math.round(90 * (1 - j / 12)).toString(16).padStart(2, '0')}`); }));
  putImg('ombre_o', toile((T) => { for (let i = 0; i < 8; i++) T.rect(i, 0, 1, 32, `#000000${Math.round(60 * (1 - i / 8)).toString(16).padStart(2, '0')}`); }));
  putImg('ombre_e', toile((T) => { for (let i = 0; i < 8; i++) T.rect(31 - i, 0, 1, 32, `#000000${Math.round(60 * (1 - i / 8)).toString(16).padStart(2, '0')}`); }));
}
