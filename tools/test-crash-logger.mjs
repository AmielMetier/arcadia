/**
 * Test du système de journalisation des crashs et expulsions de joueurs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// 1. Vérification de l'existence des fichiers
const requiredFiles = [
  'logs/README.md',
  'logs/index.html',
  'logs/crash/README.md',
  'logs/crash/reasons-catalog.json',
  'logs/crash/latest.json',
  'logs/crash/crash-events.jsonl',
  'shared/logger.js',
];

for (const rel of requiredFiles) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.error(`FAIL: Fichier manquant: ${rel}`);
    process.exit(1);
  }
}

// 2. Validation du catalogue des raisons
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs/crash/reasons-catalog.json'), 'utf8'));
if (!catalog.codes || !catalog.games || catalog.games.length < 12) {
  console.error('FAIL: Catalogue incomplet (doit contenir au moins 12 entrées: 11 jeux + hub)');
  process.exit(1);
}

// 3. Validation de latest.json
const latest = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs/crash/latest.json'), 'utf8'));
if (!Array.isArray(latest) || latest.length === 0) {
  console.error('FAIL: latest.json vide ou invalide');
  process.exit(1);
}

// 4. Validation de crash-events.jsonl
const jsonlContent = fs.readFileSync(path.join(ROOT, 'logs/crash/crash-events.jsonl'), 'utf8');
const lines = jsonlContent.trim().split('\n');
if (lines.length === 0) {
  console.error('FAIL: crash-events.jsonl vide');
  process.exit(1);
}
for (const line of lines) {
  JSON.parse(line);
}

// 5. Chaque jeu du registre (hub/games.js) est reconnu par le capteur quand il est ouvert seul, et décrit dans le catalogue
globalThis.window = {};
await import(path.join(ROOT, 'hub/games.js'));
const ids = window.HUB_GAMES.map((g) => g.id);
const loggerSrc = fs.readFileSync(path.join(ROOT, 'shared/logger.js'), 'utf8');
const pathRe = /\/\(([a-z|]+)\)\(\?:\\\/\|\$\)/.exec(loggerSrc);
const known = pathRe ? pathRe[1].split('|') : [];
const missingLogger = ids.filter((id) => !known.includes(id));
if (missingLogger.length) {
  console.error(`FAIL: shared/logger.js (detectGameId) ne reconnaît pas : ${missingLogger.join(', ')}`);
  process.exit(1);
}
const missingCatalog = ids.filter((id) => !catalog.games.some((g) => g.id === id));
if (missingCatalog.length) {
  console.error(`FAIL: logs/crash/reasons-catalog.json ne décrit pas : ${missingCatalog.join(', ')}`);
  process.exit(1);
}

console.log(`SUCCESS: Tous les tests de structure et validation de logs/crash sont validés (${catalog.games.length} jeux référencés, ${latest.length} incidents répertoriés, ${ids.length} jeux du registre reconnus).`);
