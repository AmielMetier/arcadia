// tools/odyssee-bundle-css.mjs — assemble les feuilles CSS numérotées d'Odyssée en un seul odyssee.bundle.css.
//   node tools/odyssee-bundle-css.mjs          écrit odyssee/css/odyssee.bundle.css
//   node tools/odyssee-bundle-css.mjs --check  vérifie qu'il est à jour (code de sortie 1 sinon)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS_DIR = path.join(ROOT, 'odyssee/css');
const OUT = path.join(CSS_DIR, 'odyssee.bundle.css');

const files = fs.readdirSync(CSS_DIR)
  .filter((f) => /^\d{2}-.*\.css$/.test(f))
  .sort((a, b) => a.localeCompare(b));

const header = '/* Fichier généré par node tools/odyssee-bundle-css.mjs — ne pas modifier à la main */\n';
const bundle = header + files.map((f) => {
  const txt = fs.readFileSync(path.join(CSS_DIR, f), 'utf8').replace(/\r\n/g, '\n').trimEnd();
  return `/* === ${f} === */\n${txt}\n`;
}).join('\n');

const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : null;
if (process.argv.includes('--check')) {
  if (existing !== bundle) {
    console.log('✗ odyssee/css/odyssee.bundle.css à régénérer (node tools/odyssee-bundle-css.mjs)');
    process.exit(1);
  }
  console.log(`✓ bundle CSS à jour (${files.length} feuilles, ${Math.round(Buffer.byteLength(bundle) / 1024)} Ko)`);
  process.exit(0);
}

fs.writeFileSync(OUT, bundle, 'utf8');
console.log(`écrit : odyssee/css/odyssee.bundle.css (${files.length} feuilles, ${Math.round(Buffer.byteLength(bundle) / 1024)} Ko)`);
