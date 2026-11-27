// Petites illustrations des épreuves (menu, consignes, bilans), dessinées dans la couleur de l'épreuve (currentColor).
const svg = (body) => `<svg class="glyph" viewBox="0 0 160 100" aria-hidden="true">${body}</svg>`;
const DIM = 'stroke="#94A3B8" stroke-opacity="0.35"';

export const GLYPHS = {
  // des formes arrivent par des voies et remplissent la cible
  pulse: svg(`<g fill="none" stroke-width="3" stroke-linecap="round">
      <path d="M22 50H58M102 50H138M80 8V28M80 72V92" ${DIM}/>
      <circle cx="80" cy="50" r="32" stroke="currentColor" stroke-opacity="0.35" stroke-width="2"/>
      <circle cx="80" cy="50" r="22" stroke="currentColor"/></g>
    <path d="M80 39L91 59H69Z" fill="currentColor"/>
    <path d="M36 41L45 57H27Z" fill="currentColor" opacity="0.85"/>
    <rect x="114" y="43" width="14" height="14" rx="2" fill="#F8FAFC" opacity="0.45"/>`),
  // une figure au centre, deux côtés pour la trier
  aiguillage: svg(`<g fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <rect x="10" y="26" width="38" height="48" rx="9" ${DIM}/><rect x="112" y="26" width="38" height="48" rx="9" ${DIM}/>
      <path d="M36 50H22M28 43l-7 7 7 7M124 50h14M132 43l7 7-7 7" stroke="currentColor"/>
      <circle cx="80" cy="50" r="28" stroke="currentColor" stroke-opacity="0.3"/>
      <path d="M80 22a28 28 0 0 1 24 42" stroke="currentColor"/></g>
    <circle cx="80" cy="50" r="17" fill="currentColor"/>`),
  // une grille de nœuds, trois allumés et reliés dans l'ordre
  reseau: svg(`<g stroke-width="3" stroke-linecap="round" fill="none"><path d="M50 20L80 50L110 50L80 80" stroke="currentColor" stroke-opacity="0.6"/></g>
    <g fill="#334155">${[20, 50, 80].map((y) => [50, 80, 110].map((x) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('')).join('')}</g>
    <g fill="currentColor"><circle cx="50" cy="20" r="10"/><circle cx="80" cy="50" r="10"/><circle cx="110" cy="50" r="10"/><circle cx="80" cy="80" r="10" opacity="0.55"/></g>`),
  // un tempo qui tourne, une pastille numérotée à côté
  double: svg(`<g fill="none" stroke-width="5" stroke-linecap="round">
      <circle cx="58" cy="50" r="30" stroke="#334155"/><path d="M58 20a30 30 0 1 1 -28.5 39.3" stroke="currentColor"/></g>
    <circle cx="58" cy="50" r="6" fill="currentColor"/>
    <circle cx="124" cy="36" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="94 126" transform="rotate(-90 124 36)"/>
    <text x="124" y="43" text-anchor="middle" font-size="20" font-weight="800" fill="#F8FAFC" font-family="system-ui, sans-serif">7</text>
    <circle cx="124" cy="78" r="12" fill="none" stroke="#94A3B8" stroke-opacity="0.35" stroke-width="3"/>`),
};
