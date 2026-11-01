// Atelier graphique d'Odyssée (odyssee/atelier.html) : montre chaque image du décor à l'échelle du jeu, sur la grille
// des cases, avec ce qui ne respecte pas les règles (docs/ODYSSEE-GRAPHISME.md), et les bâtiments tels que le jeu
// les assemble à partir des kits.
import { REGLES, kitCell } from '../data/regles.js';
import { SPRITES } from '../data/sprites.js';
import { setArt, facade, roofTex } from '../render/textures.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const img = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const json = (src) => fetch(src).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const CASE = REGLES.case;

/** agrandit une image (ou un canvas) d'un facteur entier, sans lissage */
function zoom(src, k) {
  const c = el('canvas'); c.width = src.width * k; c.height = src.height * k;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height); return c;
}

/** contrôles faits dans la page (en plus du rapport) */
function liveChecks(im, fam, name) {
  const c = el('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; const pb = [];
  let semi = 0, op = 0, bottom = false; const cols = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]; if (a > 0 && a < 255) semi++; if (a) { op++; cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); if (i / 4 >= (c.height - 1) * c.width) bottom = true; }
  }
  if (semi) pb.push(`${semi} pixels à demi transparents`);
  if (fam === 'deco' && !bottom) pb.push('ne touche pas le bas (ancrage aux pieds)');
  return { pb, colors: cols.size, opaque: op };
}

function rulesPanel(pal) {
  const R = REGLES, box = $('#rules');
  const items = [
    ['Case', `${R.case} pixels à l'écran`],
    ['Densité', `${R.densite} pixels d'art par case, affichés ×${R.echelle} (sols, herbes et arbres v2 : 32, tolérés)`],
    ['Lumière', R.lumiere], ['Contour', R.contour], ['Transparence', R.alpha],
    ['Couleurs', `palette commune de ${R.palette.couleurs} couleurs, ${R.palette.max_par_objet} au plus par objet`],
  ];
  for (const [k, v] of items) box.appendChild(el('div', '', `<b>${k}</b>${v}`));
  const p = el('div', '', '<b>Palette commune</b>'); const sw = el('div', 'pal');
  for (const c of pal?.couleurs || []) { const i = el('i'); i.style.background = c; i.title = c; sw.appendChild(i); }
  if (!pal) p.append(' (lancer python3 tools/odyssee-atelier.py palette)'); p.appendChild(sw); box.appendChild(p);
  const b = el('div', '', '<b>Bâtiments (emprise w × d, mur h)</b>' + Object.entries(R.batiments).map(([k, v]) => `${k} ${v.w}×${v.d} h${v.h}`).join(' · '));
  box.appendChild(b);
}

function buildingsPanel(kits) {
  const box = $('#builds');
  const list = [
    ['Maison (rouge)', 'house', 4, 3, 2, 1, 'red'], ['Maison large (bleue)', 'house2', 5, 3, 2, 2, 'blue'], ['Grande maison', 'bighouse', 6, 4, 3, 2, 'green'],
    ['Chalet', 'chalet', 4, 3, 2, 1, 'red'], ['Pêcheur', 'pecheur', 4, 3, 2, 1, 'red'], ['Capitainerie', 'port', 5, 3, 2, 2, 'red'],
    ['Centre Pokémon', 'center', 5, 4, 3, 2, 'red'], ['Boutique', 'mart', 4, 4, 3, 1, 'blue'], ['Arène', 'gym', 7, 5, 3, 3, 'gray'],
    ['Labo', 'lab', 6, 4, 3, 2, 'teal'], ['Ligue', 'league', 9, 6, 4, 4, 'purple'], ['Musée', 'musee', 6, 4, 3, 2, 'red'],
    ['Base', 'base', 6, 4, 3, 2, 'red'], ['Tour Mirage', 'mirage', 5, 3, 2, 2, 'red'], ['Phare', 'phare', 4, 4, 3, 1, 'red'], ['Pagode', 'pagode', 4, 4, 3, 1, 'red'],
  ];
  for (const [label, style, w, d, h, door, roof] of list) {
    const card = el('div', 'card'); card.appendChild(el('div', 'name', `${label} <span class="meta">${w} × ${d}, mur ${h}</span>`));
    const st = el('div', 'stage plain'); const row = el('div', 'row');
    const day = facade(style, w, h, door, false), night = facade(style, w, h, door, true);
    const flat = ['center', 'mart', 'gym', 'league'].includes(style), rh = flat ? 0.35 : Math.min(2.2, 0.55 * d);
    const rows = Math.max(1, Math.round(d / 2 + 0.18 + rh * 0.7));
    const rf = roofTex(roof, w, d + 1, 3, style, rows);
    // pan avant seulement (moitié basse de la texture du toit)
    const front = el('canvas'); front.width = rf.width; front.height = rf.height / 2; front.getContext('2d').drawImage(rf, 0, -rf.height / 2);
    const k = CASE / (day.width / w);
    for (const [c, l] of [[front, 'toit'], [day, 'jour'], [night, 'nuit']]) { const f = el('div'); f.appendChild(zoom(c, k)); f.appendChild(el('div', 'lbl', l)); row.appendChild(f); }
    st.appendChild(row); card.appendChild(st);
    // le kit et le rôle de ses cellules
    const kitName = { house: 'maison', house2: 'maison', bighouse: 'maison', center: 'centre', mart: 'boutique', gym: 'arene', lab: 'labo', league: 'ligue' }[style] || style;
    const K = kits[kitName];
    if (K) {
      const wrap = el('div', 'kit'); const z = 4; wrap.appendChild(zoom(K, z));
      const cell = K.width / 4;
      const at = new Map();
      for (const role of [...REGLES.kits.cellules, 'embleme', 'fenetre_bas']) {
        const c = kitCell(kitName, role); if (!c) continue;
        const key = c.join(','); at.set(key, [...(at.get(key) || []), role.replace('_', ' ')]);
      }
      for (const [key, roles] of at) {
        const [ci, cj] = key.split(',').map(Number);
        const s = el('span', '', roles.join(' · ')); s.style.left = (ci * cell * z + 1) + 'px'; s.style.top = (cj * cell * z + 1) + 'px'; s.style.maxWidth = (cell * z - 2) + 'px'; wrap.appendChild(s);
      }
      card.appendChild(el('div', 'lbl', `kit « ${kitName} » (img/facades/${kitName}.png)`)); card.appendChild(wrap);
    }
    box.appendChild(card);
  }
}

async function imagesPanel(rapport) {
  const box = $('#fams'); let total = 0, bad = 0;
  const fams = {
    deco: Object.keys(SPRITES.deco || {}),
    facades: SPRITES.facades || [],
    sol: SPRITES.sol32 || [],
    herbes: Object.entries(SPRITES.herbes || {}).flatMap(([th, ks]) => ks.map((k) => `${th}_${k}`)),
    nature: Object.keys(SPRITES.nature || {}),
    hgss: Object.keys(SPRITES.hgss || {}),
  };
  for (const [fam, names] of Object.entries(fams)) {
    const rf = REGLES.familles[fam] || {};
    const sec = el('section'); const h = el('h2', '', `${fam} <small>${rf.dossier || ''} · densité ${rf.densite || REGLES.densite}${rf.exception ? ' · ' + rf.exception : ''}</small>`);
    const grid = el('div', 'grid'); sec.appendChild(h); sec.appendChild(grid); box.appendChild(sec);
    let nb = 0;
    for (const name of names) {
      const im = await img(`./${rf.dossier}/${name}.png`); if (!im) continue;
      total++;
      const rep = rapport?.[fam]?.[name] || { problemes: [] };
      const live = liveChecks(im, fam, name);
      const pb = [...new Set([...(rep.problemes || []), ...live.pb])];
      const card = el('div', 'card' + (pb.length ? ' bad' : ''));
      // à l'échelle du jeu : une case = 32 px ; densité 16 → ×2, densité 32 → ×1 ; les sprites des planches sont
      // affichés avec leur densité propre (nature : SPRITES.nature[k][2])
      const dens = fam === 'nature' ? (SPRITES.nature[name]?.[2] === 2 ? 32 : 16) : fam === 'hgss' ? 16 : (rf.densite || REGLES.densite);
      const k = Math.max(1, Math.round(CASE / dens));
      const st = el('div', 'stage' + (fam === 'facades' ? ' plain' : ''));
      const holder = el('div', 'foot'); const z = zoom(im, k); holder.appendChild(z);
      if (fam === 'deco') {
        const r = REGLES.deco[name]; const cases = r?.cases || 1;
        holder.style.setProperty('--fw', cases * CASE + 'px'); holder.style.setProperty('--fx', ((z.width - cases * CASE) / 2) + 'px');
      } else holder.style.setProperty('--fw', '0px');
      st.appendChild(holder); card.appendChild(st);
      card.appendChild(el('div', 'name', name));
      const r = REGLES.deco[name];
      card.appendChild(el('div', 'meta', `${im.width} × ${im.height} px · ${live.colors} couleurs${r ? ` · ${r.largeur} case${r.largeur > 1 ? 's' : ''} de large` : ''}`));
      if (pb.length) { const ul = el('ul'); for (const p of pb) ul.appendChild(el('li', '', p)); card.appendChild(ul); bad++; nb++; }
      else card.appendChild(el('div', 'meta ok', 'conforme'));
      grid.appendChild(card);
    }
    h.insertAdjacentHTML('beforeend', ` <small class="${nb ? 'ko' : 'ok'}">${nb ? nb + ' à revoir' : 'tout est conforme'}</small>`);
  }
  $('#sum').innerHTML = `${total} images · <span class="${bad ? 'ko' : 'ok'}">${bad} à revoir</span>`;
}

(async () => {
  const [pal, rapport] = await Promise.all([json('./atelier/palette.json'), json('./atelier/rapport.json')]);
  rulesPanel(pal);
  const kits = {}; await Promise.all((SPRITES.facades || []).map(async (k) => { kits[k] = await img(`./img/facades/${k}.png`); }));
  setArt({ kits });
  buildingsPanel(kits);
  await imagesPanel(rapport);
  $('#only-bad').addEventListener('change', (e) => document.body.classList.toggle('hide-ok', e.target.checked));
})();
