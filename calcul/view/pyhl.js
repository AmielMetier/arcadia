// Coloration du Python pour l'éditeur de l'épreuve de code (mots-clés, chaînes, nombres, commentaires, fonctions).
import { esc } from './util.js';

const KW = new Set('and as assert break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'.split(' '));
const BI = new Set('abs all any bool dict enumerate filter float int isinstance len list map max min print range reversed round set sorted str sum tuple zip'.split(' '));
// un seul passage : commentaire | chaîne | nombre | mot
const TOK = /(#[^\n]*)|("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_À-ÿ][\wÀ-ÿ]*)/g;

export function highlightPy(code) {
  let out = '', last = 0, m, prev = '';
  TOK.lastIndex = 0;
  while ((m = TOK.exec(code))) {
    out += esc(code.slice(last, m.index));
    const [t, com, str, num, word] = m;
    if (com) out += `<i class="hc">${esc(t)}</i>`;
    else if (str) out += `<i class="hs">${esc(t)}</i>`;
    else if (num) out += `<i class="hn">${esc(t)}</i>`;
    else if (word && KW.has(word)) out += `<i class="hk">${esc(t)}</i>`;
    else if (word && prev === 'def') out += `<i class="hf">${esc(t)}</i>`;
    else if (word && BI.has(word)) out += `<i class="hb">${esc(t)}</i>`;
    else out += esc(t);
    if (word) prev = word;
    last = m.index + t.length;
  }
  return out + esc(code.slice(last));
}
