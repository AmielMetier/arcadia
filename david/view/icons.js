// Icônes SVG du plateau (traits épais, style des cartes du jeu).
const S = (body, vb = '0 0 48 48') => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const ink = 'stroke="#16181d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';

export const ICONS = {
  chance: S(`<text x="24" y="40" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="40" fill="#F7941D" stroke="#16181d" stroke-width="2">?</text>`),
  chest: S(`<rect x="7" y="18" width="34" height="22" rx="3" fill="#1C5FB4" ${ink}/><path d="M7 18 Q24 4 41 18" fill="#2b8cff" ${ink}/><rect x="20" y="22" width="8" height="8" rx="1.5" fill="#ffc531" ${ink}/>`),
  tax: S(`<circle cx="24" cy="24" r="17" fill="#ffc531" ${ink}/><text x="24" y="32" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="22" fill="#16181d">€</text>`),
  train: S(`<rect x="10" y="6" width="28" height="28" rx="6" fill="#2b2f3a" ${ink}/><rect x="15" y="11" width="18" height="10" rx="2" fill="#9FD8F5"/><circle cx="17" cy="28" r="2.5" fill="#ffc531"/><circle cx="31" cy="28" r="2.5" fill="#ffc531"/><path d="M14 36 L9 43 M34 36 L39 43" ${ink}/>`),
  tram: S(`<path d="M24 4 V9 M16 4 H32" ${ink}/><rect x="9" y="9" width="30" height="26" rx="7" fill="#e3262f" ${ink}/><rect x="14" y="14" width="20" height="9" rx="2" fill="#9FD8F5"/><path d="M12 40 H36" ${ink}/><circle cx="17" cy="30" r="2" fill="#fff"/><circle cx="31" cy="30" r="2" fill="#fff"/>`),
  plane: S(`<path d="M24 5 C27 5 27 9 27 12 L27 19 L42 27 L42 31 L27 27 L27 36 L32 40 L32 43 L24 41 L16 43 L16 40 L21 36 L21 27 L6 31 L6 27 L21 19 L21 12 C21 9 21 5 24 5Z" fill="#ffffff" ${ink}/>`),
  water: S(`<path d="M24 5 C33 18 38 24 38 31 A14 14 0 0 1 10 31 C10 24 15 18 24 5Z" fill="#2b8cff" ${ink}/><path d="M17 31 A7 7 0 0 0 24 38" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
  bus: S(`<rect x="7" y="8" width="34" height="28" rx="5" fill="#1fc7c1" ${ink}/><rect x="11" y="12" width="26" height="10" rx="2" fill="#fff8ea"/><circle cx="15" cy="39" r="3.5" fill="#16181d"/><circle cx="33" cy="39" r="3.5" fill="#16181d"/><path d="M11 29 H17 M31 29 H37" ${ink}/>`),
  go: S(`<path d="M44 24 H8 M20 11 L7 24 L20 37" fill="none" stroke="#e3262f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`),
  hill: S(`<path d="M2 44 C10 26 18 20 26 22 C34 24 40 34 46 44Z" fill="#2fbf71" ${ink}/><rect x="22" y="10" width="8" height="13" fill="#f3e9d2" ${ink}/><path d="M21 10 h10 M23 7 v3 M26 7 v3 M29 7 v3" ${ink}/><path d="M8 44 L9 34 M9 34 C6 31 4 32 3 33 M9 34 C11 30 14 31 15 32" fill="none" ${ink}/>`),
  police: S(`<path d="M8 20 L24 8 L40 20 Z" fill="#1C5FB4" ${ink}/><rect x="8" y="20" width="32" height="6" fill="#16181d"/><circle cx="24" cy="15" r="3" fill="#ffc531"/><circle cx="24" cy="34" r="9" fill="#f3c9a3" ${ink}/><path d="M33 40 L43 30" ${ink}/><path d="M40 27 L46 33" stroke="#16181d" stroke-width="4" stroke-linecap="round"/>`),
  bars: S(`<rect x="4" y="4" width="40" height="40" rx="3" fill="#F7941D" ${ink}/><path d="M13 4 V44 M24 4 V44 M35 4 V44" stroke="#16181d" stroke-width="4"/>`),
  house: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 11 L21 8 L21 18 L13 21 Z" fill="#1f8f52" stroke="#16181d" stroke-width="1.4" stroke-linejoin="round"/><path d="M3 11 L13 11 L13 21 L3 21 Z" fill="#2fbf71" stroke="#16181d" stroke-width="1.4" stroke-linejoin="round"/><path d="M3 11 L8 4 L13 11 Z" fill="#2fbf71" stroke="#16181d" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 4 L16 1 L21 8 L13 11 Z" fill="#157043" stroke="#16181d" stroke-width="1.4" stroke-linejoin="round"/><path d="M4.5 12.5 L9 12.5" stroke="#8fe2b3" stroke-width="1.2"/></svg>`,
  hotel: `<svg viewBox="0 0 34 26" aria-hidden="true"><path d="M22 9 L32 5 L32 20 L22 24 Z" fill="#b51c22" stroke="#16181d" stroke-width="1.4" stroke-linejoin="round"/><path d="M2 9 L22 9 L22 24 L2 24 Z" fill="#e3262f" stroke="#16181d" stroke-width="1.4" stroke-linejoin="round"/><path d="M2 9 L7 3 L17 3 L22 9 Z" fill="#e3262f" stroke="#16181d" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 3 L27 -1 L32 5 L22 9 L17 3 Z" fill="#8f1418" stroke="#16181d" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 13 h3 M10.5 13 h3 M16 13 h3 M5 18 h3 M16 18 h3" stroke="#ffd9d0" stroke-width="2"/><rect x="10.5" y="17" width="3" height="7" fill="#16181d"/></svg>`,
};

export function spaceIcon(sp) {
  if (sp.type === 'chance') return ICONS.chance;
  if (sp.type === 'chest') return ICONS.chest;
  if (sp.type === 'tax') return ICONS.tax;
  if (sp.type === 'station') {
    if (/Aéroport/i.test(sp.name)) return ICONS.plane;
    if (/Tram/i.test(sp.name)) return ICONS.tram;
    return ICONS.train;
  }
  if (sp.type === 'utility') return /Eau/i.test(sp.name) ? ICONS.water : ICONS.bus;
  return '';
}

// Silhouette de pion, couleur du joueur
export function pawnSvg(color, letter) {
  return `<svg viewBox="0 0 40 56" aria-hidden="true">
    <path d="M20 4 a9 9 0 0 1 6 15.7 c3 2 4.5 4.5 4.5 7 c0 2-1 3.3-2.5 4.3 l3.5 13 c4 .8 6.5 2.5 6.5 4.5 c0 2.6-8 4.5-18 4.5 s-18-1.9-18-4.5 c0-2 2.5-3.7 6.5-4.5 l3.5-13 c-1.5-1-2.5-2.3-2.5-4.3 c0-2.5 1.5-5 4.5-7 A9 9 0 0 1 20 4Z"
      fill="${color}" stroke="#16181d" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="16.5" cy="11" rx="2.6" ry="3.6" fill="rgba(255,255,255,.6)"/>
    <text x="20" y="45" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="12" fill="#fff" stroke="#16181d" stroke-width="2.4" paint-order="stroke">${letter}</text>
  </svg>`;
}
