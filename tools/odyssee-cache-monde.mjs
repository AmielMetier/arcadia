// tools/odyssee-cache-monde.mjs — calcule d'avance les étapes lentes de la construction du monde d'Odyssée
// (écrans de verdure, ponts, plages : voir odyssee/js/world/cache-monde.js) et écrit
// odyssee/js/data/monde-cache.js. À relancer après toute modification de la carte (odyssee/js/world/) :
// sans ça, le jeu reste juste mais démarre plus lentement (et la console le signale).
//   node tools/odyssee-cache-monde.mjs           réécrit le cache
//   node tools/odyssee-cache-monde.mjs --check   vérifie qu'il est à jour (sortie en erreur sinon)
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const check = process.argv.includes('--check');
const racine = new URL('../odyssee/js/', import.meta.url);
const fichier = fileURLToPath(new URL('data/monde-cache.js', racine));
const { MANQUES, NOUVEAU, OPTIONS } = await import(new URL('world/cache-monde.js', racine));
const { buildWorld } = await import(new URL('world/region.js', racine));

if (check) {
  const t0 = performance.now();
  buildWorld();
  const ms = Math.round(performance.now() - t0);
  if (MANQUES.length) {
    console.error(`✗ cache du monde périmé (${MANQUES.join(', ')}) : node tools/odyssee-cache-monde.mjs`);
    process.exit(1);
  }
  console.log(`✓ cache du monde à jour (monde construit en ${ms} ms)`);
  process.exit(0);
}

OPTIONS.actif = false;
const t0 = performance.now();
buildWorld();
const ms = Math.round(performance.now() - t0);
const lignes = Object.entries(NOUVEAU).map(([k, c]) => `  ${JSON.stringify(k)}: ${JSON.stringify(c)},`);
const texte = `// écrit par tools/odyssee-cache-monde.mjs : ne pas modifier à la main (voir world/cache-monde.js)\nexport const CACHE_MONDE = {\n${lignes.join('\n')}\n};\n`;
let ancien = ''; try { ancien = readFileSync(fichier, 'utf8'); } catch { }
writeFileSync(fichier, texte);
const n = Object.values(NOUVEAU).reduce((a, c) => a + Object.values(c.d).reduce((b, [, n]) => b + n.reduce((s, x) => s + x, 0), 0), 0);
console.log(`${ancien === texte ? 'inchangé' : 'écrit'} : odyssee/js/data/monde-cache.js · ${Object.keys(NOUVEAU).join(', ')} · ${n} cases · ${(texte.length / 1024).toFixed(0)} Ko (monde construit sans cache en ${ms} ms)`);
