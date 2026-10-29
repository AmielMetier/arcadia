// odyssee/js/core/savecode.js — code de sauvegarde à copier d'un appareil à l'autre (sans serveur).
// Format : « ODY1. » + base64url( deflate( JSON ) ) + « . » + empreinte (8 caractères hexadécimaux).
// L'empreinte détecte un code tronqué ou mal recopié ; la vérification de structure refuse un code d'autre chose.

const PREFIX = 'ODY1.';

function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

function toB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** Vérifie qu'un objet ressemble à une partie d'Odyssée ; renvoie un message d'erreur ou null. */
export function checkState(s) {
  if (!s || typeof s !== 'object') return 'Ce code ne contient pas de partie.';
  if (s.v !== 1) return 'Ce code vient d\'une autre version du jeu.';
  if (typeof s.name !== 'string' || !s.name) return 'Ce code ne contient pas de partie.';
  if (!Array.isArray(s.party) || !Array.isArray(s.box) || !Array.isArray(s.badges) || s.badges.length !== 8) return 'Ce code ne contient pas de partie.';
  if (typeof s.map !== 'string' || !Number.isFinite(s.x) || !Number.isFinite(s.y)) return 'Ce code ne contient pas de partie.';
  for (const m of s.party.concat(s.box)) {
    if (!m || !Number.isFinite(m.sp) || !Number.isFinite(m.lvl) || !Array.isArray(m.moves) || !Array.isArray(m.stats)) return 'Un Pokémon de ce code est illisible.';
  }
  return null;
}

/** Partie → code texte. */
export async function encodeSave(state) {
  const json = JSON.stringify(state);
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  return `${PREFIX}${toB64url(packed)}.${fnv(json)}`;
}

/** Code texte → { state } ou { error }. Accepte les espaces et retours à la ligne collés avec le code. */
export async function decodeSave(code) {
  const c = String(code || '').replace(/\s+/g, '');
  if (!c) return { error: 'Colle d\'abord ton code.' };
  if (!c.startsWith(PREFIX)) return { error: 'Ce n\'est pas un code de sauvegarde d\'Odyssée (il commence par ODY1.).' };
  const body = c.slice(PREFIX.length);
  const dot = body.lastIndexOf('.');
  if (dot < 0) return { error: 'Ce code est incomplet : copie-le en entier.' };
  let json;
  try {
    const raw = await pipe(fromB64url(body.slice(0, dot)), new DecompressionStream('deflate-raw'));
    json = new TextDecoder().decode(raw);
  } catch (e) {
    return { error: 'Ce code est incomplet ou abîmé : copie-le en entier.' };
  }
  if (fnv(json) !== body.slice(dot + 1)) return { error: 'Ce code a été mal recopié : copie-le en entier.' };
  let state;
  try { state = JSON.parse(json); } catch (e) { return { error: 'Ce code est abîmé.' }; }
  const bad = checkState(state);
  return bad ? { error: bad } : { state };
}

/** Résumé lisible d'une partie (écran de confirmation). */
export function saveSummary(s) {
  const h = Math.floor((s.time || 0) / 3600), m = Math.floor((s.time || 0) / 60) % 60;
  return `${s.name} · ${s.badges.filter(Boolean).length} badge${s.badges.filter(Boolean).length > 1 ? 's' : ''} · ${s.dex?.caught?.length || 0} Pokémon capturés · ${h}:${String(m).padStart(2, '0')}`;
}
