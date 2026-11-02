// pokemon/view/tips.js
// Bulles d'aide au survol : ce que fait une attaque, un talent ou un objet (attribut data-tip, texte HTML).
import { TYPES } from '../engine/types.js';

const STAT = { atk: 'Attaque', def: 'Défense', spa: 'Att. Spé.', spd: 'Déf. Spé.', spe: 'Vitesse' };
const STATUS = { burn: 'brûler', paralysis: 'paralyser', freeze: 'geler', poison: 'empoisonner', toxic: 'gravement empoisonner', sleep: 'endormir' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Description d'une attaque, écrite pour le joueur */
export function describeMove(m) {
  if (!m) return '';
  const cat = m.cat === 'physical' ? 'Physique' : m.cat === 'special' ? 'Spéciale' : 'Statut';
  const head = [`${TYPES[m.type] ? TYPES[m.type].name : m.type} · ${cat}`];
  if (m.power) head.push(`Puissance ${m.power}`);
  head.push(m.acc >= 100 || !m.acc ? 'Touche toujours' : `Précision ${m.acc} %`);
  if (m.pp) head.push(`PP ${m.pp}`);
  const fx = [];
  if (m.priority > 0) fx.push('Frappe en priorité, avant les attaques normales.');
  const e = m.effect;
  if (e && e.type === 'heal') fx.push(`Rend ${Math.round(e.val * 100)} % des PV max.${m.name === 'Atterrissage' ? ' Échoue à PV pleins.' : ''}`);
  if (e && e.type === 'status') fx.push(e.chance >= 100 || m.cat === 'status' ? `Tente de ${STATUS[e.status]} la cible.` : `${e.chance} % de chances de ${STATUS[e.status]} la cible.`);
  if (e && e.type === 'stat') {
    const ch = Object.entries(e.stats || { [e.stat]: e.val });
    const txt = ch.map(([k, v]) => `${STAT[k]} ${v > 0 ? '+' : ''}${v}`).join(', ');
    const who = e.target === 'self' ? 'du lanceur' : 'de la cible';
    fx.push(`${e.chance && e.chance < 100 ? `${e.chance} % de chances : ` : ''}${txt} ${who}.`);
  }
  if (m.flinch) fx.push(`${m.flinch} % de chances d'apeurer la cible (si le lanceur agit en premier).`);
  if (m.confuse) fx.push(`${m.confuse} % de chances de rendre la cible confuse.`);
  if (m.drain) fx.push(`Rend ${Math.round(m.drain * 100)} % des dégâts infligés.`);
  if (m.recoil) fx.push(`Le lanceur subit ${Math.round(m.recoil * 100)} % des dégâts infligés.`);
  if (m.crit) fx.push('Taux de coup critique élevé.');
  if (m.recharge) fx.push('Le lanceur doit se recharger au tour suivant.');
  if (m.charge) fx.push('Un tour de charge avant de frapper (immédiat au soleil).');
  if (m.rampage) fx.push('Frappe 2 ou 3 tours d\'affilée, puis le lanceur devient confus.');
  if (m.pivot) fx.push('Après le coup, le lanceur revient et un autre Pokémon prend le relais.');
  if (m.sucker) fx.push('Échoue si la cible ne prépare pas une attaque.');
  if (m.defStat === 'def') fx.push('Frappe la Défense de la cible, pas sa Déf. Spé.');
  if (m.rainSure) fx.push('Touche à coup sûr sous la pluie.');
  if (m.name === 'Blizzard') fx.push('Touche à coup sûr sous la grêle.');
  if (m.name === 'Trempette') fx.push('Ne fait rien du tout.');
  if (!fx.length && m.power) fx.push('Pas d\'effet en plus.');
  return `<b>${esc(m.name)}</b><small>${head.join(' · ')}</small>${fx.map((t) => `<span>${esc(t)}</span>`).join('')}`;
}
export const tipText = (name, desc) => `<b>${esc(name)}</b><span>${esc(desc)}</span>`;
export const tipAttr = (html) => `data-tip="${esc(html)}"`;

/** Bulle unique qui suit les éléments [data-tip] survolés (ou touchés longtemps sur mobile). */
let installed = false;
export function installTips() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const tip = document.createElement('div');
  tip.className = 'pd-tip'; tip.hidden = true;
  document.body.appendChild(tip);
  let cur = null;
  const place = (el) => {
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - t.width / 2, y = r.top - t.height - 10;
    if (y < 6) y = r.bottom + 10;
    x = Math.max(6, Math.min(window.innerWidth - t.width - 6, x));
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  };
  const show = (el) => { cur = el; tip.innerHTML = el.dataset.tip; tip.hidden = false; place(el); };
  const hide = () => { cur = null; tip.hidden = true; };
  document.addEventListener('mouseover', (ev) => { const el = ev.target.closest && ev.target.closest('[data-tip]'); if (el && el !== cur) show(el); else if (!el && cur) hide(); });
  document.addEventListener('mouseleave', hide);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('scroll', hide, true);
}
