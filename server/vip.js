'use strict';
// Le mode VIP des Backrooms vu du relais : qui est VIP, et la clé du coffre (les médias chiffrés de backrooms/data/).
//
// Qui est VIP : la même liste que le Hub (hub/vip.js, tenue par tools/vip-add.mjs), qui ne contient que des
// empreintes d'identifiants. Lue sur le disque quand le relais a le dépôt entier, sinon dans le dépôt public sur
// GitHub ; gardée 5 minutes. VIP_FILE désigne un autre fichier (tests).
//
// La clé du coffre n'est jamais dans le dépôt, et personne n'a à la copier nulle part : le relais l'apprend une fois
// (/account/vipseed, envoyée par tools/backrooms-vault.mjs semer, ou par le navigateur d'un hôte VIP qui l'a déjà) et
// ne l'accepte que si elle ouvre le témoin du coffre (backrooms/data/e0.bin). Il la garde dans la branche saves,
// enveloppée (AES-256-GCM) par une clé tirée de son jeton GitHub : sans ce jeton, le fichier ne dit rien. Si le jeton
// change, la clé enveloppée ne s'ouvre plus et le prochain hôte VIP la renvoie. BACKROOMS_VIP_KEY (facultatif) la
// donne directement. Il la remet aux seuls comptes VIP qui prouvent leur mot de passe (/account/vipkey).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const saves = require('./saves');

const REPO = process.env.SAVES_REPO || 'AmielMetier/arcadia';
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const LIST_LOCAL = process.env.VIP_FILE || path.join(__dirname, '..', 'hub', 'vip.js');
const CHECK_LOCAL = process.env.VIP_CHECK_FILE || path.join(__dirname, '..', 'backrooms', 'data', 'e0.bin');
const STORE = 'vip/backrooms.json';
const CHECK_TEXT = 'arcadia · backrooms · vip'; // le texte du témoin (CHECK_TEXT de backrooms/view/vault.js)
const KEEP_MS = 5 * 60 * 1000;
const KEY_RE = /^[A-Za-z0-9+/]{43}=$/;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// un fichier du dépôt : sur le disque s'il y est, sinon sur GitHub (dépôt public)
async function repoFile(local, rel, binary) {
  try {
    return fs.readFileSync(local, binary ? undefined : 'utf8');
  } catch (e) {
    const r = await fetch(`${RAW}/${rel}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`${rel} : ${r.status}`);
    return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
  }
}

// les deux listes de hub/vip.js : HASHES (sha256 de « arcadia-vip:<id> ») et ACCOUNTS (nom du fichier du compte)
function parse(src) {
  const out = { hashes: new Set(), accounts: new Set() };
  for (const [, name, body] of String(src).matchAll(/const (HASHES|ACCOUNTS) = \[([\s\S]*?)\];/g)) {
    const set = name === 'HASHES' ? out.hashes : out.accounts;
    for (const [, h] of body.matchAll(/'([0-9a-f]{32}|[0-9a-f]{64})'/g)) set.add(h);
  }
  return out;
}
let listCache = null; // { t, list }
async function isVip(user) {
  if (!listCache || Date.now() - listCache.t > KEEP_MS) listCache = { t: Date.now(), list: parse(await repoFile(LIST_LOCAL, 'hub/vip.js')) };
  const l = listCache.list;
  return l.hashes.has(sha256('arcadia-vip:' + user)) || l.accounts.has(sha256('arcadia-account:' + user).slice(0, 32));
}

// la clé ouvre-t-elle le témoin ? (format du coffre : « ARV1 », IV de 12 octets, chiffré, étiquette de 16 octets)
let checkCache = null; // { t, data }
async function opensCheck(key) {
  if (!checkCache || Date.now() - checkCache.t > KEEP_MS) checkCache = { t: Date.now(), data: await repoFile(CHECK_LOCAL, 'backrooms/data/e0.bin', true) };
  const b = checkCache.data;
  try {
    const k = Buffer.from(key, 'base64');
    if (k.length !== 32 || b.length < 33 || b.subarray(0, 4).toString('latin1') !== 'ARV1') return false;
    const d = crypto.createDecipheriv('aes-256-gcm', k, b.subarray(4, 16));
    d.setAuthTag(b.subarray(b.length - 16));
    return Buffer.concat([d.update(b.subarray(16, b.length - 16)), d.final()]).toString('utf8') === CHECK_TEXT;
  } catch (e) {
    return false;
  }
}

// l'enveloppe : AES-256-GCM avec une clé tirée du jeton GitHub du relais
const wrapKey = () => crypto.createHmac('sha256', process.env.GITHUB_TOKEN || '').update('arcadia-backrooms-vip-wrap').digest();
function wrap(key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', wrapKey(), iv);
  const ct = Buffer.concat([c.update(key, 'utf8'), c.final()]);
  return { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: c.getAuthTag().toString('base64') };
}
function unwrap(rec) {
  try {
    if (!rec || rec.v !== 1) return '';
    const d = crypto.createDecipheriv('aes-256-gcm', wrapKey(), Buffer.from(rec.iv, 'base64'));
    d.setAuthTag(Buffer.from(rec.tag, 'base64'));
    const key = Buffer.concat([d.update(Buffer.from(rec.ct, 'base64')), d.final()]).toString('utf8');
    return KEY_RE.test(key) ? key : '';
  } catch (e) {
    return ''; // enveloppée avec un autre jeton
  }
}

// la clé du coffre (base64 d'une clé AES de 32 octets), ou '' si le relais ne l'a pas (encore)
let known = null; // { key, t }
async function vaultKey() {
  const env = String(process.env.BACKROOMS_VIP_KEY || '').trim();
  if (KEY_RE.test(env)) return env;
  if (!saves.enabled()) return '';
  if (known && (known.key || Date.now() - known.t < 60000)) return known.key;
  let key = '';
  try {
    key = unwrap((await saves.readFile(STORE)).data);
  } catch (e) {}
  // une clé qui n'ouvre plus le témoin (coffre rechiffré depuis) ne sert plus
  if (key) {
    try {
      if (!(await opensCheck(key))) key = '';
    } catch (e) {}
  }
  known = { key, t: Date.now() };
  return key;
}

// apprendre la clé : 'ok', 'wrong' (elle n'ouvre pas le coffre) ou 'off' (pas de jeton GitHub : rien où la garder)
async function seed(key) {
  key = String(key || '');
  if (!KEY_RE.test(key) || !(await opensCheck(key))) return 'wrong';
  if (!saves.enabled()) return 'off';
  if ((await vaultKey()) === key) return 'ok';
  await saves.queueWrite(STORE, wrap(key), 'Coffre VIP des Backrooms : clé enveloppée');
  known = { key, t: Date.now() };
  return 'ok';
}

module.exports = { parse, isVip, vaultKey, seed, STORE };
