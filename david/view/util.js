// Petits outils partagés par la vue.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function store(key, def) {
  try { const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
}
export function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

// Texte lisible sur une couleur de groupe
export function inkOn(hex) {
  const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#16181d' : '#ffffff';
}
