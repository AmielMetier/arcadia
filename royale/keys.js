// Island Rush — les touches. Chaque action a deux touches au plus, modifiables dans les Réglages et retenues dans ce
// navigateur. Une touche s'écrit par sa position sur le clavier (« KeyW » : Z sur un clavier français, W sur un anglais),
// par la lettre qu'elle tape (« k:e » : la touche marquée E, quel que soit le clavier), ou c'est un bouton de la souris
// (« Mouse0 » clic gauche, « Mouse1 » clic molette, « Mouse2 » clic droit, « Mouse3 » et « Mouse4 » boutons du côté).
// Échap ne se change pas : il libère la souris et ferme le sac ou la carte.
// La manette a ses propres boutons (deux par action aussi, « Pad0 » à « Pad16 » dans l'ordre standard : A, B, X, Y, LB,
// RB, LT, RT, Vue, Menu, L3, R3, croix ↑ ↓ ← →) ; par défaut à la façon de Fortnite. Ses sticks (se déplacer, regarder)
// et Menu (pause) ne se changent pas.
export const ACTIONS = [
  ['avant', 'Avancer', ['KeyW', 'ArrowUp'], []],
  ['arriere', 'Reculer', ['KeyS', 'ArrowDown'], []],
  ['gauche', 'Aller à gauche', ['KeyA', 'ArrowLeft'], []],
  ['droite', 'Aller à droite', ['KeyD', 'ArrowRight'], []],
  ['saut', 'Sauter, deltaplane', ['Space'], ['Pad0']],
  ['sprint', 'Sprinter', ['ShiftLeft', 'ShiftRight'], ['Pad10']],
  ['accroupi', 'S\'accroupir', ['ControlLeft', 'ControlRight'], ['Pad1']],
  ['tir', 'Tirer', ['Mouse0'], ['Pad7']],
  ['visee', 'Viser', ['Mouse2'], ['Pad6']],
  ['utiliser', 'Ouvrir, ramasser, relever', ['k:e'], ['Pad2']],
  ['recharger', 'Recharger', ['k:r'], ['Pad2']],
  ['lacher', 'Lâcher l\'objet', ['k:g'], []],
  ['pioche', 'Pioche', ['k:x', 'Backquote'], []],
  ['prec', 'Objet précédent', [], ['Pad4']],
  ['suiv', 'Objet suivant', [], ['Pad5']],
  ['objet1', 'Objet 1', ['Digit1'], []],
  ['objet2', 'Objet 2', ['Digit2'], []],
  ['objet3', 'Objet 3', ['Digit3'], []],
  ['objet4', 'Objet 4', ['Digit4'], []],
  ['objet5', 'Objet 5', ['Digit5'], []],
  ['mur', 'Construire un mur', ['k:f'], ['Pad12']],
  ['sol', 'Construire un sol', ['k:v'], ['Pad15']],
  ['escalier', 'Construire un escalier', ['k:c'], ['Pad14']],
  ['materiau', 'Changer de matériau', ['k:t'], ['Pad13']],
  ['repere', 'Repère pour l\'équipe', ['k:b', 'Mouse1'], ['Pad11']],
  ['sac', 'Sac', ['Tab'], ['Pad3']],
  ['carte', 'Carte', ['k:m'], ['Pad8']],
  ['aide', 'Rappel des touches', ['k:h'], []],
];
// noms des boutons de manette : Xbox (et la plupart des manettes), PlayStation
const PAD_XBOX = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Vue', 'Menu', 'L3', 'R3', 'Croix ↑', 'Croix ↓', 'Croix ←', 'Croix →', 'Accueil'];
const PAD_PS = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', 'Croix ↑', 'Croix ↓', 'Croix ←', 'Croix →', 'PS'];
const MOVES = new Set(['avant', 'arriere', 'gauche', 'droite']);
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
  const binds = {}, pad = {}, labels = {};
  let layout = null, device = 'kb', padStyle = PAD_XBOX;
  const subs = new Set();
  const reset = () => { for (const [id, , def] of ACTIONS) binds[id] = [def[0] || null, def[1] || null]; };
  const padReset = () => { for (const [id, , , def] of ACTIONS) pad[id] = [def[0] || null, def[1] || null]; };
  reset(); padReset();
  const okPad = (b) => typeof b === 'string' && /^Pad\d{1,2}$/.test(b);
  try {
    const o = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (o && o.binds) {
      for (const [id] of ACTIONS) {
        const b = o.binds[id];
        if (Array.isArray(b)) binds[id] = [0, 1].map((i) => (typeof b[i] === 'string' && b[i].length < 32 ? b[i] : null));
      }
      if (o.labels) for (const [c, l] of Object.entries(o.labels)) if (typeof l === 'string' && l.length <= 3) labels[c] = l;
    }
    if (o && o.pad) for (const [id] of ACTIONS) { const b = o.pad[id]; if (Array.isArray(b)) pad[id] = [0, 1].map((i) => (okPad(b[i]) ? b[i] : null)); }
  } catch (e) { /* pas de stockage */ }
  // ce que porte chaque touche sur le clavier de ce joueur (Chrome, Edge) ; sinon on l'apprend en jouant
  try {
    const kb = navigator.keyboard;
    if (kb && kb.getLayoutMap) kb.getLayoutMap().then((m) => { layout = m; notify(); }).catch(() => {});
  } catch (e) { /* pas de carte du clavier */ }
  const notify = () => { for (const f of subs) { try { f(); } catch (e) { console.error(e); } } };
  const store = () => { try { localStorage.setItem(STORE, JSON.stringify({ binds, labels, pad })); } catch (e) { /* pas de stockage */ } };
  function save() { store(); notify(); }
  // nom d'une touche, tel qu'il est écrit dessus
  function label(b) {
    if (!b) return '—';
    if (/^Pad\d+$/.test(b)) return padStyle[+b.slice(3)] || 'Bouton ' + b.slice(3);
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
  // ce que joue le joueur en ce moment : les rappels à l'écran montrent les touches du clavier ou les boutons de la manette
  const shown = (id) => {
    if (device === 'pad') { const p = (pad[id] || []).filter(Boolean); if (p.length) return p; }
    return (binds[id] || []).filter(Boolean);
  };
  return {
    ACTIONS, binds, pad,
    label,
    // les touches d'une action, écrites (sans les cases vides)
    labels: (id) => (device === 'pad' && MOVES.has(id) ? ['Stick gauche'] : shown(id).map(label)),
    first: (id) => { if (device === 'pad' && MOVES.has(id)) return 'Stick G'; const b = shown(id)[0]; return b ? label(b) : '—'; },
    get device() { return device; },
    // le joueur passe du clavier à la manette (ou l'inverse) ; style : 'ps' pour une manette PlayStation
    setDevice(d, style) {
      const st = style === 'ps' ? PAD_PS : style === 'xbox' ? PAD_XBOX : padStyle;
      if (d === device && st === padStyle) return;
      device = d; padStyle = st; notify();
    },
    // actions déclenchées par une touche (code : position ; ch : lettre tapée, en minuscule), ou un bouton de manette (« Pad3 »)
    match(code, ch) {
      const out = [];
      if (code.startsWith('Pad')) { for (const [id] of ACTIONS) if (pad[id].includes(code)) out.push(id); return out; }
      for (const [id] of ACTIONS) if (binds[id].some((b) => b && pressed(b, code, ch))) out.push(id);
      return out;
    },
    // une touche est-elle tenue ? down : positions enfoncées (boutons de la souris et de la manette), chars : lettres tapées
    held(id, down, chars) {
      return binds[id].some((b) => b && (b.startsWith('k:') ? chars.has(b.slice(2)) : down.has(b))) || pad[id].some((b) => b && down.has(b));
    },
    // réglages de la manette (même forme que ceux du clavier ; un bouton peut servir deux actions, comme X par défaut)
    padRows: () => ACTIONS.filter(([id]) => !MOVES.has(id)).map(([id, lab]) => [id, lab, pad[id].map((b) => (b ? label(b) : ''))]),
    padSet(id, slot, ev) {
      const b = 'Pad' + (ev.pad | 0), lost = [];
      for (const [a, lab] of ACTIONS) pad[a].forEach((x, i) => { if (x === b && (a !== id || i !== slot)) { pad[a][i] = null; if (a !== id) lost.push(lab); } });
      pad[id][slot] = b;
      save();
      return lost;
    },
    padClear(id, slot) { pad[id][slot] = null; save(); },
    padReset() { padReset(); save(); },
    // le joueur appuie sur une touche du clavier : on retient ce qui y est écrit (pour l'afficher ensuite)
    learn(code, key) {
      if (!/^Key[A-Z]$|^Semicolon$|^Comma$|^Period$|^Quote$|^Backquote$|^Bracket/.test(code) || !key || key.length !== 1 || !key.trim()) return;
      const l = key.toUpperCase();
      if (labels[code] === l) return;
      labels[code] = l;
      store();
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
