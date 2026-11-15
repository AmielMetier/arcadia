// tools/odyssee-preload.mjs — Odyssée : écrit dans odyssee/index.html la liste des modules à précharger.
// Le jeu n'a pas d'étape de construction : ses modules se chargent en cascade (main.js, puis ce qu'il importe, puis…).
// Avec <link rel="modulepreload">, le navigateur les demande tous d'emblée, en parallèle.
//   node tools/odyssee-preload.mjs          réécrit la liste (à relancer quand on ajoute ou retire un fichier de odyssee/js/)
//   node tools/odyssee-preload.mjs --check  vérifie seulement qu'elle est à jour (code de sortie 1 sinon)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'odyssee/index.html');
const MAP = { three: path.join(ROOT, 'shared/vendor/three/three.module.min.js') };
const seen = new Set(), order = [];
function walk(file) {
  if (seen.has(file)) return; seen.add(file);
  if (!fs.existsSync(file)) { console.error('module introuvable : ' + path.relative(ROOT, file)); process.exit(1); }
  order.push(file);
  if (Object.values(MAP).includes(file)) return;   // bibliothèque d'un seul fichier
  const src = fs.readFileSync(file, 'utf8');
  // imports statiques seulement (import … from '…', export … from '…', import '…') ; les import() à la demande restent à la demande
  for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)) {
    const spec = m[1] || m[2];
    if (MAP[spec]) walk(MAP[spec]);
    else if (spec.startsWith('.')) walk(path.resolve(path.dirname(file), spec));
  }
}
walk(path.join(ROOT, 'odyssee/js/main.js'));
const links = order.slice(1).map((f) => `<link rel="modulepreload" href="${path.relative(path.dirname(HTML), f).split(path.sep).join('/')}">`).join('\n');
const A = '<!-- modules préchargés (tools/odyssee-preload.mjs) -->', B = '<!-- fin des modules préchargés -->';
let html = fs.readFileSync(HTML, 'utf8');
const bloc = `${A}\n${links}\n${B}`;
const next = html.includes(A) ? html.replace(new RegExp(A.replace(/[()]/g, '\\$&') + '[\\s\\S]*?' + B), bloc) : html.replace('</head>', bloc + '\n</head>');
if (process.argv.includes('--check')) {
  if (next !== html) { console.log('✗ odyssee/index.html : liste des modules préchargés à refaire (node tools/odyssee-preload.mjs)'); process.exit(1); }
  console.log(`✓ ${order.length - 1} modules préchargés, liste à jour`);
} else { fs.writeFileSync(HTML, next); console.log(`${order.length - 1} modules préchargés écrits dans odyssee/index.html`); }
