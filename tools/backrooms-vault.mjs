#!/usr/bin/env node
// Le coffre du mode VIP de The Backrooms (backrooms/view/vault.js) : chiffre, déchiffre ou vérifie ses fichiers.
// La phrase secrète vient de la variable d'environnement BACKROOMS_VIP ou de --phrase ; sinon elle est demandée sans
// s'afficher. Elle n'est jamais écrite nulle part (ni sur le disque, ni à l'écran).
//
//   node tools/backrooms-vault.mjs chiffrer <fichier> backrooms/data/eN.bin
//   node tools/backrooms-vault.mjs dechiffrer backrooms/data/eN.bin <fichier>
//   node tools/backrooms-vault.mjs verifier          (le témoin et tous les médias du coffre s'ouvrent-ils ?)
//   node tools/backrooms-vault.mjs temoin            (écrit le témoin de cette phrase : pour changer de phrase)
//
// Chiffrer refuse une phrase qui n'ouvre pas le témoin (data/e0.bin) : tous les fichiers gardent la même clé.
// Changer de phrase : déchiffrer chaque média avec l'ancienne (hors du dépôt), écrire le témoin de la nouvelle,
// puis rechiffrer chaque média avec la nouvelle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveKey, seal, unseal, checkKey, CHECK, CHECK_TEXT, VAULT_FILES } from '../backrooms/view/vault.js';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'backrooms', 'data');
const load = async (file) => fs.readFileSync(path.join(DATA, `${file}.bin`));

const args = process.argv.slice(2);
let phrase = process.env.BACKROOMS_VIP || '';
const pi = args.findIndex((a) => a === '--phrase' || a.startsWith('--phrase='));
if (pi >= 0) {
  const a = args[pi];
  phrase = a.includes('=') ? a.slice(a.indexOf('=') + 1) : args[pi + 1] || '';
  args.splice(pi, a.includes('=') ? 1 : 2);
}
const [cmd, src, dst] = args;
const usage = () => {
  console.error('usage : node tools/backrooms-vault.mjs chiffrer|dechiffrer|verifier|temoin [entrée] [sortie]');
  console.error('        (phrase : BACKROOMS_VIP=… ou --phrase …, sinon demandée)');
  process.exit(2);
};
if (!['chiffrer', 'dechiffrer', 'verifier', 'temoin'].includes(cmd)) usage();
if ((cmd === 'chiffrer' || cmd === 'dechiffrer') && (!src || !dst)) usage();

// la phrase tapée au clavier, sans écho
function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin } = process;
    if (!stdin.isTTY) return resolve('');
    process.stderr.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    let s = '';
    const on = (d) => {
      for (const ch of d.toString('utf8')) {
        if (ch === '\u0003') process.exit(130);
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', on);
          process.stderr.write('\n');
          return resolve(s);
        }
        if (ch === '\u007f' || ch === '\b') s = s.slice(0, -1);
        else s += ch;
      }
    };
    stdin.on('data', on);
  });
}

if (!phrase.trim()) phrase = await askHidden('Phrase du coffre : ');
if (!phrase.trim()) {
  console.error('Pas de phrase (BACKROOMS_VIP, --phrase, ou à taper).');
  process.exit(2);
}
const key = await deriveKey(phrase);
phrase = '';
const check = path.join(DATA, `${CHECK}.bin`);
const kb = (n) => `${Math.round(n / 1024)} Ko`;

if (cmd === 'temoin') {
  fs.writeFileSync(check, await seal(key, new TextEncoder().encode(CHECK_TEXT)));
  console.log(`Témoin écrit : ${path.relative(process.cwd(), check)}`);
} else if (cmd === 'chiffrer') {
  if (fs.existsSync(check)) {
    if (!(await checkKey(key, load))) {
      console.error("Cette phrase n'ouvre pas le témoin du coffre (data/e0.bin) : ce n'est pas la phrase des autres fichiers.");
      process.exit(1);
    }
  } else {
    fs.writeFileSync(check, await seal(key, new TextEncoder().encode(CHECK_TEXT)));
    console.log(`Témoin écrit : ${path.relative(process.cwd(), check)}`);
  }
  const data = fs.readFileSync(src);
  fs.writeFileSync(dst, await seal(key, data));
  console.log(`${src} → ${dst} (${kb(data.length)}, chiffré)`);
} else if (cmd === 'dechiffrer') {
  try {
    const out = await unseal(key, fs.readFileSync(src));
    fs.writeFileSync(dst, out);
    console.log(`${src} → ${dst} (${kb(out.length)})`);
  } catch (e) {
    console.error(`${src} : ne s'ouvre pas avec cette phrase (${e.message})`);
    process.exit(1);
  }
} else {
  let bad = 0;
  const ok = await checkKey(key, load);
  console.log(`${ok ? '✓' : '✗'} témoin (${CHECK}.bin)`);
  if (!ok) bad++;
  for (const [name, [file]] of Object.entries(VAULT_FILES)) {
    try {
      const out = await unseal(key, await load(file));
      console.log(`✓ ${file}.bin  ${name}  ${kb(out.length)}`);
    } catch (e) {
      bad++;
      console.log(`✗ ${file}.bin  ${name}  ${e.code === 'ENOENT' ? 'absent' : 'ne s’ouvre pas'}`);
    }
  }
  process.exit(bad ? 1 : 0);
}
