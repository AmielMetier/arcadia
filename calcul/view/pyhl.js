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

// SQL : mots-clés, chaînes, nombres, commentaires
const SQLKW = new Set('select from where and or not in is null as join left right inner outer on group by order having limit distinct count sum avg min max round case when then else end desc asc union all like between exists insert into values update set delete create table'.split(' '));
const SQLTOK = /(--[^\n]*)|('(?:''|[^'])*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)/g;
export function highlightSql(code) {
  let out = '', last = 0, m;
  SQLTOK.lastIndex = 0;
  while ((m = SQLTOK.exec(code))) {
    out += esc(code.slice(last, m.index));
    const [t, com, str, num, word] = m;
    out += com ? `<i class="hc">${esc(t)}</i>` : str ? `<i class="hs">${esc(t)}</i>` : num ? `<i class="hn">${esc(t)}</i>` : word && SQLKW.has(word.toLowerCase()) ? `<i class="hk">${esc(t)}</i>` : esc(t);
    last = m.index + t.length;
  }
  return out + esc(code.slice(last));
}
export const highlightCode = (code, lang) => (lang === 'sql' ? highlightSql(code) : highlightPy(code));
