// Le coffre du mode VIP : les médias des monstres d'origine (photos, voix, intro sous-titrée) sont chiffrés dans
// data/*.bin, en AES-GCM 256 bits (WebCrypto). La clé sort d'une phrase secrète par PBKDF2 (SHA-256, ROUNDS tours,
// sel SALT) ; ni la phrase ni la clé ne sont dans le dépôt. Le relais garde la clé (base64) lui-même, enveloppée par son
// jeton GitHub, après l'avoir apprise une fois (server/vip.js : il n'accepte qu'une clé qui ouvre le témoin), et la
// donne aux seuls comptes Arcadia VIP connectés : l'hôte VIP n'a rien à taper ni à copier. Son navigateur la garde
// (localStorage), la réapprend au relais s'il l'a perdue et l'envoie aux invités avec la partie (le « go » du salon).
// Sans clé, rien ne se déchiffre et le jeu garde l'entité, la voix et l'intro classiques.
//
// Un fichier du coffre : « ARV1 » (4 octets), l'IV (12 octets, tiré au hasard), puis le chiffré suivi de son
// étiquette (16 octets) : une mauvaise clé, ou un fichier abîmé, est refusée au déchiffrement.
// Le témoin (CHECK) est un court texte connu : il reconnaît la bonne phrase sans télécharger les gros fichiers.
//
// Chiffrer, déchiffrer ou vérifier un fichier (la phrase en variable d'environnement, jamais écrite sur le disque) :
//   BACKROOMS_VIP='…' node tools/backrooms-vault.mjs chiffrer <fichier> backrooms/data/eN.bin
// Ce module ne touche au navigateur (fetch, localStorage) que dans ses fonctions : l'outil et les tests l'importent.

const subtle = globalThis.crypto.subtle;
const MAGIC = [0x41, 0x52, 0x56, 0x31]; // « ARV1 »
const IV_LEN = 12;
export const SALT = new Uint8Array([246, 104, 35, 220, 218, 176, 224, 54, 198, 137, 243, 62, 94, 236, 139, 33]);
export const ROUNDS = 600000;
export const CHECK = 'e0';
export const CHECK_TEXT = 'arcadia · backrooms · vip';
// les médias du coffre : nom → [fichier de data/, type]
export const VAULT_FILES = {
  entite: ['e1', 'image/png'], // la photo de l'entité du Level 0 (son visage, le screamer)
  bouc: ['e2', 'image/jpeg'], // le bouc (Level 2, attrapé par le troupeau)
  level1: ['e3', 'image/webp'], // l'entité du Level 1 : la planche d'images de sa vidéo détourée
  voix: ['e4', 'audio/mpeg'], // la voix d'origine de l'entité (Level 1 et Poolrooms)
  appel: ['e5', 'audio/mpeg'], // la voix qui appelle au Level 1, quand l'entité rôde près de toi ou te poursuit
  intro: ['e6', 'video/mp4'], // l'intro du Level 0, version sous-titrée
};
// nom → URL blob du média déchiffré (vide tant que le coffre est fermé)
export const vault = {};
// la clé du coffre ouvert (base64), envoyée aux invités ; '' s'il est fermé
export let vaultKey = '';
export const vaultOpen = () => !!vaultKey;

const toB64 = (b) => btoa(String.fromCharCode(...b));
const fromB64 = (s) => Uint8Array.from(atob(String(s)), (c) => c.charCodeAt(0));

// la clé AES qui sort de la phrase (espaces autour ôtés, Unicode normalisé : la même phrase tapée sur un autre clavier)
export async function deriveKey(phrase) {
  const raw = new TextEncoder().encode(String(phrase || '').normalize('NFC').trim());
  const base = await subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations: ROUNDS }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
export const exportKey = async (key) => toB64(new Uint8Array(await subtle.exportKey('raw', key)));
export async function importKey(text) {
  const raw = fromB64(text);
  if (raw.length !== 32) throw new Error('clé du coffre invalide');
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function seal(key, data) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(MAGIC.length + IV_LEN + ct.length);
  out.set(MAGIC, 0);
  out.set(iv, MAGIC.length);
  out.set(ct, MAGIC.length + IV_LEN);
  return out;
}
export const isSealed = (data) => {
  const b = new Uint8Array(data);
  return b.length > MAGIC.length + IV_LEN + 16 && MAGIC.every((x, i) => b[i] === x);
};
// le contenu d'origine ; lève une erreur si la clé n'est pas la bonne (ou si le fichier est abîmé)
export async function unseal(key, data) {
  const b = new Uint8Array(data);
  if (!isSealed(b)) throw new Error("ce n'est pas un fichier du coffre");
  const iv = b.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv }, key, b.subarray(MAGIC.length + IV_LEN)));
}

// un fichier de data/, tel quel (à la version du Hub, comme ce module : un coffre rechiffré n'est pas pris dans le cache)
const fetchData = (file) =>
  fetch(new URL(`../data/${file}.bin${new URL(import.meta.url).search}`, import.meta.url).href).then((r) => {
    if (!r.ok) throw new Error(`data/${file}.bin : ${r.status}`);
    return r.arrayBuffer();
  });

// la clé ouvre-t-elle le témoin ? true, false (pas la bonne), ou null (témoin introuvable : pas de réseau)
export async function checkKey(key, load = fetchData) {
  let data;
  try {
    data = await load(CHECK);
  } catch (e) {
    return null;
  }
  try {
    return new TextDecoder().decode(await unseal(key, data)) === CHECK_TEXT;
  } catch (e) {
    return false;
  }
}

// la clé (base64) qui sort de la phrase si c'est la bonne, '' sinon, null si le témoin est introuvable (outil, tests)
export async function keyFromPhrase(phrase, load = fetchData) {
  if (!String(phrase || '').trim()) return '';
  const key = await deriveKey(phrase);
  const ok = await checkKey(key, load);
  return ok ? exportKey(key) : ok === false ? '' : null;
}

// Ouvre le coffre avec une clé (base64) : tout est déchiffré, ou rien. 'ok', 'wrong' (pas la bonne clé) ou 'error'
// (fichier introuvable). Une même clé n'est essayée qu'une fois à la fois.
let opening = null; // { text, promise }
export function openVault(text, load = fetchData) {
  if (typeof text !== 'string' || !text) return Promise.resolve('wrong');
  if (text === vaultKey) return Promise.resolve('ok');
  if (opening && opening.text === text) return opening.promise;
  const promise = (async () => {
    let key;
    try {
      key = await importKey(text);
    } catch (e) {
      return 'wrong';
    }
    const ok = await checkKey(key, load);
    if (!ok) return ok === false ? 'wrong' : 'error';
    let blobs;
    try {
      blobs = await Promise.all(Object.entries(VAULT_FILES).map(async ([name, [file, type]]) => [name, new Blob([await unseal(key, await load(file))], { type })]));
    } catch (e) {
      return 'error';
    }
    closeVault();
    for (const [name, blob] of blobs) vault[name] = URL.createObjectURL(blob);
    vaultKey = text;
    return 'ok';
  })();
  opening = { text, promise };
  promise.then(() => {
    if (opening && opening.promise === promise) opening = null;
  });
  return promise;
}
export function closeVault() {
  for (const name of Object.keys(vault)) {
    try {
      URL.revokeObjectURL(vault[name]);
    } catch (e) {}
    delete vault[name];
  }
  vaultKey = '';
}

// la clé gardée dans ce navigateur (celle de la dernière phrase acceptée)
const STORE = 'backrooms_vip_key';
export function storedKey() {
  try {
    return localStorage.getItem(STORE) || '';
  } catch (e) {
    return '';
  }
}
export function rememberKey(text) {
  try {
    if (text) localStorage.setItem(STORE, text);
    else localStorage.removeItem(STORE);
  } catch (e) {}
}
