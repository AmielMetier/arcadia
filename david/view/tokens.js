// Pions façon figurines en métal, posés sur un socle à la couleur du joueur.
// Dessins originaux (SVG) : objets du quotidien, avec deux clins d'œil niçois (le pointu, la chaise bleue).
export const TOKENS = [
  { id: 'voiture', name: 'Voiture' },
  { id: 'chapeau', name: 'Chapeau' },
  { id: 'chien', name: 'Chien' },
  { id: 'pointu', name: 'Pointu' },
  { id: 'botte', name: 'Botte' },
  { id: 'de', name: 'Dé à coudre' },
  { id: 'chat', name: 'Chat' },
  { id: 'canard', name: 'Canard' },
  { id: 'chaise', name: 'Chaise bleue' },
  { id: 'palmier', name: 'Palmier' },
];
export const TOKEN_IDS = TOKENS.map((t) => t.id);
export const tokenName = (id) => (TOKENS.find((t) => t.id === id) || TOKENS[0]).name;

const O = 'stroke="#2a2f36" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
const M = `fill="url(#mtl)" ${O}`;      // métal
const D = `fill="url(#mtd)" ${O}`;      // métal sombre (ombres, creux)
const L = 'fill="none" stroke="#2a2f36" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const H = 'fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="2" stroke-linecap="round"'; // reflet

const SHAPES = {
  voiture: `
    <path d="M6 46 L8 38 Q10 33 17 32 L25 31 L31 24 Q33 22 37 22 L45 22 Q49 22 51 25 L55 31 Q60 33 60 39 L60 46 Z" ${M}/>
    <path d="M32 31 L36 25 L44 25 L48 31 Z" ${D}/>
    <path d="M10 38 L56 38" ${L}/>
    <path d="M13 34 Q20 33 26 33" ${H}/>
    <circle cx="17" cy="47" r="8" ${M}/><circle cx="17" cy="47" r="3.2" ${D}/>
    <circle cx="49" cy="47" r="8" ${M}/><circle cx="49" cy="47" r="3.2" ${D}/>`,
  chapeau: `
    <ellipse cx="32" cy="49" rx="27" ry="8" ${M}/>
    <path d="M17 13 Q32 7 47 13 L44 47 Q32 51 20 47 Z" ${M}/>
    <path d="M19.5 38 Q32 42 44.5 38 L44 46 Q32 50 20 46 Z" ${D}/>
    <ellipse cx="32" cy="13" rx="15" ry="4.5" ${M}/>
    <path d="M23 18 L22 36" ${H}/>`,
  chien: `
    <path d="M9 22 L12 14 L15 21 L19 20 L21 12 L24 21 Q30 22 34 26 L48 26 Q53 26 54 21 Q57 17 58 21 Q58 28 54 32 L55 52 L49 52 L48 40 L36 40 L34 52 L28 52 L28 40 Q22 40 20 37 L19 52 L13 52 L13 34 Q8 32 6 28 Q5 24 9 22 Z" ${M}/>
    <path d="M6 28 Q10 34 15 34" ${L}/>
    <circle cx="13" cy="24" r="1.8" fill="#2a2f36"/>
    <path d="M30 30 Q40 29 50 30" ${H}/>`,
  pointu: `
    <path d="M30 42 L30 7" ${L} stroke-width="2.6"/>
    <path d="M14 30 L52 8" ${L} stroke-width="2.6"/>
    <path d="M31 11 L50 10 L31 38 Z" ${M}/>
    <path d="M4 40 Q8 38 14 40 L50 40 Q56 38 61 36 Q58 50 46 53 L18 53 Q8 51 4 40 Z" ${M}/>
    <path d="M7 44 L58 42" ${L}/>
    <path d="M14 49 Q32 51 50 48" ${H}/>`,
  botte: `
    <path d="M20 6 L40 6 L40 34 Q42 37 49 38 Q59 40 59 47 L59 52 L18 52 L18 30 Q19 18 20 6 Z" ${M}/>
    <path d="M18 47 L59 47 L59 52 L18 52 Z" ${D}/>
    <path d="M19 12 L41 12" ${L}/>
    <path d="M25 16 L24 40" ${H}/>
    <circle cx="35" cy="20" r="1.6" fill="#2a2f36"/><circle cx="35" cy="27" r="1.6" fill="#2a2f36"/>`,
  de: `
    <path d="M17 50 L21 15 Q32 7 43 15 L47 50 Z" ${M}/>
    <path d="M15 44 L49 44 L50 52 L14 52 Z" ${D}/>
    ${[[26, 20], [32, 18], [38, 20], [24, 27], [30, 26], [36, 26], [41, 27], [23, 34], [29, 34], [35, 34], [41, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="#5d6570"/>`).join('')}
    <path d="M22 20 L20 40" ${H}/>`,
  chat: `
    <path d="M18 52 Q14 40 18 30 Q20 24 24 22 L22 12 L28 18 L34 18 L40 12 L39 23 Q44 28 44 36 Q44 46 40 52 Z" ${M}/>
    <path d="M40 50 Q54 50 54 40 Q54 34 50 32" fill="none" stroke="#2a2f36" stroke-width="6" stroke-linecap="round"/>
    <path d="M40 50 Q54 50 54 40 Q54 34 50 32" fill="none" stroke="url(#mtl)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="27" cy="26" r="1.6" fill="#2a2f36"/><circle cx="35" cy="26" r="1.6" fill="#2a2f36"/>
    <path d="M29 31 L31 33 L33 31" ${L}/>
    <path d="M22 36 Q21 44 23 48" ${H}/>`,
  canard: `
    <path d="M10 36 Q10 52 30 52 L44 52 Q58 52 58 40 Q58 34 54 32 Q50 38 42 36 Q46 30 44 22 Q42 12 32 12 Q22 12 21 22 Q20 28 24 32 Q14 30 10 36 Z" ${M}/>
    <path d="M21 20 Q14 20 10 23 Q14 27 22 26 Z" ${D}/>
    <circle cx="31" cy="20" r="2" fill="#2a2f36"/>
    <path d="M30 40 Q38 46 48 42" ${L}/>
    <path d="M16 40 Q18 47 26 49" ${H}/>`,
  chaise: `
    <path d="M14 10 Q32 4 50 10 L48 30 Q32 26 16 30 Z" ${M}/>
    <path d="M18 15 Q32 11 46 15 M18 21 Q32 17 46 21" ${L}/>
    <path d="M12 34 Q32 30 52 34 L50 40 Q32 37 14 40 Z" ${M}/>
    <path d="M16 30 L14 52 M48 30 L50 52 M18 40 L21 52 M46 40 L43 52" fill="none" stroke="#2a2f36" stroke-width="5" stroke-linecap="round"/>
    <path d="M16 30 L14 52 M48 30 L50 52 M18 40 L21 52 M46 40 L43 52" fill="none" stroke="url(#mtl)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M10 26 Q8 32 12 34 M54 26 Q56 32 52 34" ${L}/>`,
  palmier: `
    <path d="M30 52 Q28 38 32 24 Q33 20 35 18 L38 19 Q35 30 36 52 Z" ${M}/>
    <path d="M30 44 L36 43 M30 37 L36 36 M31 30 L36 30" ${L}/>
    <path d="M36 18 Q24 6 8 14 Q22 13 34 20 Z" ${M}/>
    <path d="M36 18 Q48 4 60 12 Q48 11 38 21 Z" ${M}/>
    <path d="M36 19 Q26 22 16 34 Q28 25 36 22 Z" ${M}/>
    <path d="M37 19 Q50 22 56 32 Q46 24 37 22 Z" ${M}/>
    <circle cx="33" cy="22" r="3.2" ${D}/><circle cx="39" cy="22" r="3.2" ${D}/>`,
};

let uid = 0;
// Pion complet (socle coloré + figurine). size en px ; le bas du socle touche le bas de l'image.
export function tokenSvg(id, color, { base = true } = {}) {
  const k = ++uid;
  const shape = (SHAPES[id] || SHAPES.voiture).replace(/url\(#mtl\)/g, `url(#mtl${k})`).replace(/url\(#mtd\)/g, `url(#mtd${k})`);
  return `<svg viewBox="0 0 64 70" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="mtl${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbfcfd"/><stop offset=".35" stop-color="#c9cfd6"/><stop offset=".6" stop-color="#8e979f"/><stop offset=".85" stop-color="#d7dce1"/><stop offset="1" stop-color="#9aa2aa"/></linearGradient>
      <linearGradient id="mtd${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a929b"/><stop offset="1" stop-color="#5a626b"/></linearGradient>
    </defs>
    ${base ? `<ellipse cx="32" cy="62" rx="24" ry="6.5" fill="${color}" stroke="#16181d" stroke-width="2.4"/><ellipse cx="32" cy="60.5" rx="18" ry="3.4" fill="#ffffff" fill-opacity=".28"/>` : ''}
    <g transform="translate(0 4)">${shape}</g>
  </svg>`;
}
