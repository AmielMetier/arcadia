// odyssee/js/render/arenes-relief.js — relief des arènes dessinées (world/arenes-plan.js).
//
// Même charpente que le moteur de terrain (odyssee/moteur, render/rendu.js) : chaque case a une hauteur, son dessus est
// posé à cette hauteur, une paroi descend vers la voisine du sud, de l'est ou de l'ouest quand celle-ci est plus basse
// (le nord ne se voit pas), et les personnages prennent la hauteur de leur case, en pente douce d'une case à l'autre.
//
// La hauteur n'est que du rendu. Elle se lit dans l'état de la case à l'instant du dessin (lave qui coule ou figée, fosse
// ouverte ou comblée, pont-dragon en place ou non) : rien n'est ajouté au plan, aux collisions, au solveur ni aux
// sauvegardes.
//
// Unité : la « case d'écran ». Une hauteur de 1 décale un point d'une case à l'écran (tan(inclinaison) dans le monde,
// comme les murs). Toutes les hauteurs sont des multiples d'un pixel (1 / 32) : le sol relevé ou creusé reste sur la grille
// des pixels, rien ne bave.
import { T, walkable } from '../world/tiles.js';

/** hauteur du dessus de chaque sorte de case, en cases d'écran */
export const HAUTEURS = {
  estrade: 6 / 32,     // l'estrade du Champion : une marche
  lave: -8 / 32,       // le lac de lave, en contrebas des dalles de basalte
  fosse: -12 / 32,     // une fosse de la carrière, tant qu'un rocher ne l'a pas comblée
  gouffre: -1,         // le gouffre de la Tour de Drakos
  pont: 0,             // un pont-dragon : une dalle mince au-dessus du gouffre
};

export class ReliefArene {
  /** decosAt : les décors de la carte rangés par case (« x,y » → liste), tenus par la vue */
  constructor(map, decosAt) { this.m = map; this.decosAt = decosAt; }
  /** sorte de relief d'une case : 'estrade', 'lave', 'fosse', 'gouffre', 'pont', ou null (sol ordinaire, mur, hors carte) */
  sorte(x, y) {
    const m = this.m; if (!m.in(x, y)) return null;
    const t = m.get(x, y);
    if (t === T.LAVA) return 'lave';
    const D = this.decosAt.get(x + ',' + y); if (!D) return null;
    const marche = walkable(t);
    for (const d of D) {
      if (d.k === 'estrade') return 'estrade';
      if (d.k === 'gouffre') return 'gouffre';
      if (d.k === 'etat' && d.f === 'gouffre') return marche ? 'pont' : 'gouffre';
      if (d.k === 'etat' && d.f === 'fosse') return marche ? null : 'fosse';
    }
    return null;
  }
  /** hauteur du dessus d'une case, en cases d'écran */
  h(x, y) { return HAUTEURS[this.sorte(x, y)] || 0; }
  /** la carte a-t-elle du relief (sinon la vue garde son rendu à plat, sans rien calculer) ? */
  utile() {
    const m = this.m;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (this.sorte(x, y)) return true;
    return false;
  }
  /**
   * Hauteur où l'on marche au point (x, z), en cases d'écran : celle de la case, fondue vers ses voisines d'un centre de
   * case à l'autre (on monte sur l'estrade en un pas, sans saut). On ne descend jamais dans un creux : le bord compte
   * pour du sol. dz : où tombent les pieds dans la case (0,55 pour un personnage).
   */
  marche(x, z, dz = 0.55) {
    const u = x - 0.5, v = z - dz, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const s = (a, b) => Math.max(0, this.h(a, b));
    return (s(i, j) * (1 - fu) + s(i + 1, j) * fu) * (1 - fv) + (s(i, j + 1) * (1 - fu) + s(i + 1, j + 1) * fu) * fv;
  }
}
