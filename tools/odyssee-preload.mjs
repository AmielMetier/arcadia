// tools/odyssee-preload.mjs — Odyssée : écrit dans odyssee/index.html la liste des modules à précharger et la version.
// Le jeu n'a pas d'étape de construction : ses modules se chargent en cascade (main.js, puis ce qu'il importe, puis…).
// Avec <link rel="modulepreload">, le navigateur les demande tous d'emblée, en parallèle.
// Version (odyssee/js/version.js, VERSION_ODYSSEE) : chaque module, chaque feuille de style et main.js prennent « ?v=<version> »
// dans leur adresse ; la carte des imports renvoie chaque module de odyssee/js/ vers son adresse versionnée (un import
// relatif « ./game.js » y passe aussi) : une nouvelle version n'est jamais servie par le cache du navigateur.
//   node tools/odyssee-preload.mjs          réécrit tout (à relancer quand on ajoute ou retire un fichier de odyssee/js/,
//                                           et à chaque changement de VERSION_ODYSSEE)
//   node tools/odyssee-preload.mjs --check  vérifie seulement que tout est à jour (code de sortie 1 sinon)
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
const V = /VERSION_ODYSSEE\s*=\s*'([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'odyssee/js/version.js'), 'utf8'))?.[1];
if (!V) { console.error('VERSION_ODYSSEE introuvable dans odyssee/js/version.js'); process.exit(1); }
const rel = (f) => path.relative(path.dirname(HTML), f).split(path.sep).join('/');
const links = order.slice(1).map((f) => `<link rel="modulepreload" href="${rel(f)}?v=${V}">`).join('\n');
// tous les modules du jeu (chargés d'emblée ou à la demande) : leur adresse versionnée dans la carte des imports
const tous = [];
(function lister(d) { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const f = path.join(d, e.name); if (e.isDirectory()) lister(f); else if (e.name.endsWith('.js')) tous.push(f); } })(path.join(ROOT, 'odyssee/js'));
for (const f of order) if (!tous.includes(f)) tous.push(f);
const carte = { three: `${rel(MAP.three)}?v=${V}` };
for (const f of tous) if (f !== MAP.three) carte['./' + rel(f)] = `./${rel(f)}?v=${V}`;
const importmap = `<script type="importmap">\n${JSON.stringify({ imports: carte }, null, 1).split('\n').map((l) => '  ' + l).join('\n')}\n</script>`;
const A = '<!-- modules préchargés (tools/odyssee-preload.mjs) -->', B = '<!-- fin des modules préchargés -->';
let html = fs.readFileSync(HTML, 'utf8');
const bloc = `${A}\n${links}\n${B}`;
let next = html.includes(A) ? html.replace(new RegExp(A.replace(/[()]/g, '\\$&') + '[\\s\\S]*?' + B), bloc) : html.replace('</head>', bloc + '\n</head>');
next = next.replace(/<script type="importmap">[\s\S]*?<\/script>/, importmap);
next = next.replace(/(<link rel="stylesheet" href="css\/[^"?]+\.css)(\?v=[^"]*)?"/g, `$1?v=${V}"`);
next = next.replace(/<script type="module" src="js\/main\.js(\?v=[^"]*)?"><\/script>/, `<script type="module" src="js/main.js?v=${V}"></script>`);
next = next.replace(/<meta name="odyssee-version" content="[^"]*">\n?/, '').replace('<meta charset="utf-8">\n', `<meta charset="utf-8">\n<meta name="odyssee-version" content="${V}">\n`);
if (process.argv.includes('--check')) {
  if (next !== html) { console.log('✗ odyssee/index.html : modules préchargés ou version à refaire (node tools/odyssee-preload.mjs)'); process.exit(1); }
  console.log(`✓ Odyssée ${V} : ${order.length - 1} modules préchargés, versions à jour`);
} else { fs.writeFileSync(HTML, next); console.log(`Odyssée ${V} : ${order.length - 1} modules préchargés et versions écrits dans odyssee/index.html`); }
