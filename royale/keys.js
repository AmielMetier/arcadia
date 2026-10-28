// Island Rush — les touches. Chaque action a deux touches au plus, modifiables dans les Réglages et retenues dans ce
// navigateur. Une touche s'écrit par sa position sur le clavier (« KeyW » : Z sur un clavier français, W sur un anglais),
// par la lettre qu'elle tape (« k:e » : la touche marquée E, quel que soit le clavier), ou c'est un bouton de la souris
// (« Mouse0 » clic gauche, « Mouse1 » clic molette, « Mouse2 » clic droit, « Mouse3 » et « Mouse4 » boutons du côté).
// Échap ne se change pas : il libère la souris et ferme le sac ou la carte.
export const ACTIONS = [
  ['avant', 'Avancer', ['KeyW', 'ArrowUp']],
  ['arriere', 'Reculer', ['KeyS', 'ArrowDown']],
  ['gauche', 'Aller à gauche', ['KeyA', 'ArrowLeft']],
  ['droite', 'Aller à droite', ['KeyD', 'ArrowRight']],
  ['saut', 'Sauter, deltaplane', ['Space']],
  ['sprint', 'Sprinter', ['ShiftLeft', 'ShiftRight']],
  ['accroupi', 'S\'accroupir', ['ControlLeft', 'ControlRight']],
  ['tir', 'Tirer', ['Mouse0']],
  ['visee', 'Viser', ['Mouse2']],
  ['utiliser', 'Ouvrir, ramasser, relever', ['k:e']],
  ['recharger', 'Recharger', ['k:r']],
  ['lacher', 'Lâcher l\'objet', ['k:g']],
  ['pioche', 'Pioche', ['k:x', 'Backquote']],
  ['objet1', 'Objet 1', ['Digit1']],
  ['objet2', 'Objet 2', ['Digit2']],
  ['objet3', 'Objet 3', ['Digit3']],
  ['objet4', 'Objet 4', ['Digit4']],
  ['objet5', 'Objet 5', ['Digit5']],
  ['mur', 'Construire un mur', ['k:f']],
  ['sol', 'Construire un sol', ['k:v']],
  ['escalier', 'Construire un escalier', ['k:c']],
  ['materiau', 'Changer de matériau', ['k:t']],
  ['repere', 'Repère pour l\'équipe', ['k:b', 'Mouse1']],
  ['sac', 'Sac', ['Tab']],
  ['carte', 'Carte', ['k:m']],
  ['aide', 'Rappel des touches', ['k:h']],
];
const STORE = 'royale_keys';
const NAMES = {
  Space: 'Espace', ShiftLeft: 'Maj', ShiftRight: 'Maj droite', ControlLeft: 'Ctrl', ControlRight: 'Ctrl droite', AltLeft: 'Alt', AltRight: 'Alt Gr',
  MetaLeft: 'Cmd', MetaRight: 'Cmd droite', Tab: 'Tab', CapsLock: 'Verr. Maj', Enter: 'Entrée', NumpadEnter: 'Entrée (pavé)', Backspace: 'Retour',
  Delete: 'Suppr', Insert: 'Inser', Home: 'Début', End: 'Fin', PageUp: 'Page ↑', PageDown: 'Page ↓', ContextMenu: 'Menu',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse0: 'Clic gauche', Mouse1: 'Clic molette', Mouse2: 'Clic droit', Mouse3: 'Souris 4', Mouse4: 'Souris 5',
};
// ce qui est écrit sur les touches d'un clavier français, quand le navigateur ne sait pas le dire
const AZERTY = { KeyQ: 'A', KeyW: 'Z', KeyA: 'Q', KeyZ: 'W', KeyM: ',', Semicolon: 'M', Comma: ';', Period: ':', Slash: '!', Backquote: '²',
  BracketLeft: '^', BracketRight: '$', Quote: 'ù', Backslash: '*', Minus: ')', Equal: '=', IntlBackslash: '<' };

export function createKeys() {
  const binds = {}, labels = {};
  let layout = null;
  const subs = new Set();
  const reset = () => { for (const [id, , def] of ACTIONS) binds[id] = [def[0] || null, def[1] || null]; };
  reset();
  try {
    const o = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (o && o.binds) {
      for (const [id] of ACTIONS) {
        const b = o.binds[id];
        if (Array.isArray(b)) binds[id] = [0, 1].map((i) => (typeof b[i] === 'string' && b[i].length < 32 ? b[i] : null));
      }
      if (o.labels) for (const [c, l] of Object.entries(o.labels)) if (typeof l === 'string' && l.length <= 3) labels[c] = l;
    }
  } catch (e) { /* pas de stockage */ }
  // ce que porte chaque touche sur le clavier de ce joueur (Chrome, Edge) ; sinon on l'apprend en jouant
  try {
    const kb = navigator.keyboard;
    if (kb && kb.getLayoutMap) kb.getLayoutMap().then((m) => { layout = m; notify(); }).catch(() => {});
  } catch (e) { /* pas de carte du clavier */ }
  const notify = () => { for (const f of subs) { try { f(); } catch (e) { console.error(e); } } };
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ binds, labels })); } catch (e) { /* pas de stockage */ }
    notify();
  }
  // nom d'une touche, tel qu'il est écrit dessus
  function label(b) {
    if (!b) return '—';
    if (b.startsWith('k:')) return b.slice(2).toUpperCase();
    if (NAMES[b]) return NAMES[b];
    let m = /^Digit(\d)$/.exec(b);
    if (m) return m[1];
    if ((m = /^Numpad(\d)$/.exec(b))) return 'Pavé ' + m[1];
    if (/^F\d+$/.test(b)) return b;
    if (labels[b]) return labels[b];
    const l = layout && layout.get(b);
    if (l && l.trim()) return l.toUpperCase();
    if (AZERTY[b]) return AZERTY[b];
    if ((m = /^Key([A-Z])$/.exec(b))) return m[1];
    return b.replace(/^Numpad/, 'Pavé ');
  }
  const pressed = (b, code, ch) => b === code || (!!ch && b === 'k:' + ch);
  return {
    ACTIONS, binds,
    label,
    // les touches d'une action, écrites (sans les cases vides)
    labels: (id) => (binds[id] || []).filter(Boolean).map(label),
    first: (id) => { const b = (binds[id] || []).find(Boolean); return b ? label(b) : '—'; },
    // actions déclenchées par une touche (code : position ; ch : lettre tapée, en minuscule)
    match(code, ch) {
      const out = [];
      for (const [id] of ACTIONS) if (binds[id].some((b) => b && pressed(b, code, ch))) out.push(id);
      return out;
    },
    // une touche est-elle tenue ? down : positions enfoncées (et boutons de la souris), chars : lettres tapées par elles
    held(id, down, chars) {
      return binds[id].some((b) => b && (b.startsWith('k:') ? chars.has(b.slice(2)) : down.has(b)));
    },
    // le joueur appuie sur une touche du clavier : on retient ce qui y est écrit (pour l'afficher ensuite)
    learn(code, key) {
      if (!/^Key[A-Z]$|^Semicolon$|^Comma$|^Period$|^Quote$|^Backquote$|^Bracket/.test(code) || !key || key.length !== 1 || !key.trim()) return;
      const l = key.toUpperCase();
      if (labels[code] === l) return;
      labels[code] = l;
      try { localStorage.setItem(STORE, JSON.stringify({ binds, labels })); } catch (e) { /* pas de stockage */ }
    },
    // nouvelle touche pour (action, case) : { code, key } (clavier) ou { mouse } ; la touche quitte l'action qui l'avait.
    // Renvoie le libellé des actions qui l'ont perdue.
    set(id, slot, ev) {
      const b = ev.mouse != null ? 'Mouse' + ev.mouse : ev.code;
      if (!b || b === 'Escape') return [];
      const ch = ev.key && ev.key.length === 1 ? ev.key.toLowerCase() : '';
      if (ev.mouse == null) this.learn(ev.code, ev.key);
      const lost = [];
      for (const [a, lab] of ACTIONS) binds[a].forEach((x, i) => {
        if (x && (a !== id || i !== slot) && pressed(x, b, ch)) { binds[a][i] = null; if (a !== id) lost.push(lab); }
      });
      binds[id][slot] = b;
      save();
      return lost;
    },
    clear(id, slot) { binds[id][slot] = null; save(); },
    reset() { reset(); save(); },
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
