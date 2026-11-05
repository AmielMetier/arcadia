// odyssee/js/world/faune.js — Pokémon en liberté dans les villes (posés à la création du monde ; leur comportement : vie.js)
import { T, walkable } from './tiles.js';

/* ================= Pokémon des villes (création du monde) ================= */
// espèces qui ont un sprite de marche (planche des suiveurs), réparties par décor de ville
const FAUNE_VILLE = {
  defaut: [16, 19, 25, 52, 133, 10, 43],
  mer: [54, 60, 7, 158, 16, 52], feu: [37, 4, 155, 74, 66], froid: [133, 7, 158, 143, 54],
  sable: [50, 74, 66, 37, 4], vert: [43, 1, 152, 10, 16, 25], ville: [25, 52, 66, 19, 133], roche: [74, 66, 50, 143],
};
const DECOR = {
  azur: 'mer', ecaille: 'mer', marais: 'mer', volcanic: 'feu', forge: 'feu', cendre: 'feu', snow: 'froid', cime: 'froid',
  desert: 'sable', dunes: 'sable', mirage: 'sable', canyon: 'sable', jardin: 'vert', flora: 'vert', rose: 'vert', sylve: 'vert', forest: 'vert',
  lisiere: 'vert', automne: 'vert', metro: 'ville', volta: 'ville', granit: 'roche', pierre: 'roche', montagne: 'roche',
};
export const PHRASES = [
  (n) => `${n} te regarde avec curiosité.`, (n) => `${n} a l'air de bien se plaire ici.`, (n) => `${n} cherche quelque chose à grignoter.`,
  (n) => `${n} joue avec les enfants du quartier.`, (n) => `${n} se laisse caresser, tout content.`, (n) => `${n} fait la sieste au soleil… ou presque.`,
];
const h32 = (a, b, s) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

/** pose 3 à 6 Pokémon en liberté dans chaque ville de la grande carte, sur des cases dégagées (jamais devant une porte) */
export function addFauneVilles(W) {
  const pris = new Set(W.npcs.map((n) => n.x + ',' + n.y));
  const libre = (x, y) => [T.GRASS, T.FLOWER, T.PATH, T.PAVE, T.SAND, T.SNOW].includes(W.get(x, y)) && !pris.has(x + ',' + y) && !W.objectAt?.(x, y)
    && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].every(([dx, dy]) => walkable(W.get(x + dx, y + dy)) && W.get(x + dx, y + dy) !== T.DOOR && W.get(x + dx, y + dy) !== T.MAT);
  W.zones.filter((z) => z.town).forEach((z, zi) => {
    const liste = FAUNE_VILLE[DECOR[z.theme] || 'defaut'];
    const n = Math.max(3, Math.min(6, Math.round((z.x1 - z.x0) * (z.y1 - z.y0) / 900)));
    let posees = 0;
    for (let essai = 0; essai < 400 && posees < n; essai++) {
      const x = Math.round(z.x0 + 2 + h32(zi, essai, 1) * (z.x1 - z.x0 - 4)), y = Math.round(z.y0 + 2 + h32(zi, essai, 2) * (z.y1 - z.y0 - 4));
      if (!libre(x, y)) continue;
      const sp = liste[Math.floor(h32(zi, essai, 3) * liste.length)];
      pris.add(x + ',' + y);
      W.npc({ id: `faune:${z.id || zi}:${posees}`, x, y, sprite: 'poke:' + sp, dir: 'down', move: 'wander', script: 'faune', sp, roam: 3,
        phrase: Math.floor(h32(zi, essai, 4) * PHRASES.length) });
      posees++;
    }
  });
}

