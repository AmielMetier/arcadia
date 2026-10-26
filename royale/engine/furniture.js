// L'intérieur des bâtiments : un usage par pièce (séjour, cuisine, chambre, salle de bains, bureau, magasin, garage,
// entrepôt, grange, restaurant…) selon le type de bâtiment et l'étage, puis les meubles de cet usage, posés contre
// les murs (ou au milieu des grandes pièces) sans jamais boucher une porte, un escalier, un coffre ou du butin.
// Et les portes : un battant par porte, un rideau ou des vantaux par portail. Moteur PUR, tirage à part (la graine
// de l'île ne change pas quand on ajoute un meuble).
import { CELL } from './buildings.js';

// meubles : largeur (le long du mur), profondeur, hauteur (m) ; solid : arrête les joueurs ; tall : contre un mur plein
// seulement (pas devant une fenêtre) ; mat : matériau récolté en le cassant
export const FURN = {
  lit:          { label: 'Lit', w: 1.6, d: 2.1, h: 0.6, solid: true, mat: 'bois' },
  lit_simple:   { label: 'Lit', w: 1.0, d: 2.0, h: 0.6, solid: true, mat: 'bois' },
  armoire:      { label: 'Armoire', w: 1.3, d: 0.62, h: 2.0, solid: true, tall: true, mat: 'bois' },
  commode:      { label: 'Commode', w: 1.0, d: 0.5, h: 0.85, solid: true, mat: 'bois' },
  chevet:       { label: 'Table de chevet', w: 0.5, d: 0.45, h: 0.55, solid: true, mat: 'bois' },
  canape:       { label: 'Canapé', w: 2.1, d: 0.92, h: 0.85, solid: true, mat: 'bois' },
  fauteuil:     { label: 'Fauteuil', w: 0.95, d: 0.9, h: 0.85, solid: true, mat: 'bois' },
  table_basse:  { label: 'Table basse', w: 1.1, d: 0.6, h: 0.42, solid: true, mat: 'bois' },
  meuble_tv:    { label: 'Meuble télé', w: 1.6, d: 0.45, h: 1.15, solid: true, mat: 'bois' },
  bibliotheque: { label: 'Bibliothèque', w: 1.4, d: 0.4, h: 2.0, solid: true, tall: true, mat: 'bois' },
  cuisine:      { label: 'Cuisine', w: 3.2, d: 0.65, h: 2.2, solid: true, tall: true, mat: 'metal' },
  frigo:        { label: 'Frigo', w: 0.75, d: 0.7, h: 1.9, solid: true, tall: true, mat: 'metal' },
  table:        { label: 'Table', w: 1.6, d: 0.9, h: 0.76, solid: true, mat: 'bois' },
  chaise:       { label: 'Chaise', w: 0.46, d: 0.46, h: 0.92, solid: true, mat: 'bois' },
  baignoire:    { label: 'Baignoire', w: 1.7, d: 0.78, h: 0.58, solid: true, mat: 'pierre' },
  douche:       { label: 'Douche', w: 0.95, d: 0.95, h: 2.05, solid: true, tall: true, mat: 'pierre' },
  toilettes:    { label: 'Toilettes', w: 0.45, d: 0.68, h: 0.8, solid: true, mat: 'pierre' },
  lavabo:       { label: 'Lavabo', w: 0.62, d: 0.48, h: 0.9, solid: true, mat: 'pierre' },
  bureau:       { label: 'Bureau', w: 1.4, d: 0.72, h: 0.76, solid: true, mat: 'bois' },
  classeur:     { label: 'Classeur', w: 0.5, d: 0.62, h: 1.3, solid: true, tall: true, mat: 'metal' },
  etagere:      { label: 'Étagère', w: 2.0, d: 0.5, h: 1.85, solid: true, tall: true, mat: 'metal' },
  comptoir:     { label: 'Comptoir', w: 2.0, d: 0.72, h: 1.02, solid: true, mat: 'bois' },
  bar:          { label: 'Bar', w: 3.0, d: 0.72, h: 1.1, solid: true, mat: 'bois' },
  etabli:       { label: 'Établi', w: 2.0, d: 0.72, h: 0.92, solid: true, mat: 'bois' },
  pneus:        { label: 'Pneus', w: 0.72, d: 0.72, h: 0.95, solid: true, mat: 'metal' },
  voiture:      { label: 'Voiture', w: 2.0, d: 4.4, h: 1.5, solid: true, mat: 'metal' },
  caisses:      { label: 'Caisses', w: 1.2, d: 1.2, h: 1.25, solid: true, mat: 'bois' },
  palette:      { label: 'Palette', w: 1.2, d: 1.0, h: 0.95, solid: true, mat: 'bois' },
  tonneau:      { label: 'Tonneau', w: 0.62, d: 0.62, h: 0.92, solid: true, mat: 'bois' },
  foin:         { label: 'Botte de foin', w: 1.3, d: 0.9, h: 0.85, solid: true, mat: 'bois' },
  poele:        { label: 'Poêle', w: 0.62, d: 0.62, h: 0.95, solid: true, mat: 'metal' },
  tapis:        { label: 'Tapis', w: 2.2, d: 1.5, h: 0.02, solid: false, mat: null },
  plante:       { label: 'Plante', w: 0.45, d: 0.45, h: 1.15, solid: false, mat: null },
  lampe:        { label: 'Lampadaire', w: 0.35, d: 0.35, h: 1.7, solid: false, mat: null },
  cadre:        { label: 'Tableau', w: 0.9, d: 0.05, h: 0.7, solid: false, mat: null, deco: 1.35 },
  horloge:      { label: 'Horloge', w: 0.4, d: 0.06, h: 0.4, solid: false, mat: null, deco: 1.9 },
};
// meubles en plus dans les grandes pièces (au moins 4 cases, puis encore à partir de 6)
const EXTRAS = {
  salon: [['canape', 0, 1, 'mur'], ['fauteuil', 1, 2, 'mur'], ['bibliotheque', 1, 2, 'mur'], ['commode', 0, 1, 'mur'], ['plante', 1, 2, 'coin'], ['lampe', 0, 1, 'coin'], ['table', 0, 1, 'centre']],
  sejour: [['bibliotheque', 1, 1, 'mur'], ['fauteuil', 1, 2, 'mur'], ['commode', 1, 1, 'mur'], ['plante', 1, 2, 'coin'], ['tapis', 0, 1, 'centre'], ['table_basse', 0, 1, 'centre']],
  cuisine: [['cuisine', 0, 1, 'mur'], ['frigo', 0, 1, 'mur'], ['etagere', 0, 1, 'mur'], ['tonneau', 0, 1, 'coin'], ['plante', 1, 1, 'coin']],
  chambre: [['commode', 1, 1, 'mur'], ['bureau', 0, 1, 'mur'], ['fauteuil', 1, 1, 'mur'], ['bibliotheque', 0, 1, 'mur'], ['plante', 0, 1, 'coin'], ['lit_simple', 0, 1, 'mur']],
  chambre_simple: [['bureau', 1, 1, 'mur'], ['commode', 0, 1, 'mur'], ['fauteuil', 0, 1, 'mur'], ['plante', 0, 1, 'coin']],
  sdb: [['baignoire', 0, 1, 'mur'], ['douche', 0, 1, 'mur'], ['commode', 1, 1, 'mur'], ['plante', 0, 1, 'coin']],
  bureau: [['bureau', 1, 2, 'mur'], ['classeur', 1, 2, 'mur'], ['canape', 0, 1, 'mur'], ['plante', 1, 2, 'coin'], ['table', 0, 1, 'centre']],
  salle: [['bibliotheque', 1, 2, 'mur'], ['fauteuil', 1, 2, 'mur']],
  magasin: [['etagere', 1, 3, 'centre'], ['etagere', 1, 2, 'mur'], ['frigo', 1, 2, 'mur'], ['caisses', 0, 2, 'coin']],
  garage: [['etagere', 1, 1, 'mur'], ['caisses', 1, 2, 'coin'], ['pneus', 1, 2, 'coin'], ['palette', 0, 1, 'centre']],
  entrepot: [['caisses', 1, 3, 'centre'], ['palette', 1, 2, 'centre'], ['etagere', 1, 2, 'mur']],
  grange: [['foin', 2, 4, 'centre'], ['caisses', 1, 2, 'coin']],
  grenier: [['foin', 1, 3, 'centre']],
  restaurant: [['table', 1, 3, 'centre'], ['plante', 1, 2, 'coin'], ['bibliotheque', 0, 1, 'mur']],
  studio: [['fauteuil', 0, 1, 'mur'], ['etagere', 0, 1, 'mur'], ['plante', 0, 1, 'coin']],
};
// décor accroché aux murs (pas sur les murs d'un garage, d'un entrepôt ou d'une grange)
const DECOR = { salon: 3, sejour: 2, chambre: 2, chambre_simple: 1, bureau: 2, salle: 3, restaurant: 3, cuisine: 1, studio: 1, magasin: 1 };

// une recette : [meuble, combien (min, max), où : 'mur' | 'centre' | 'coin']
const RECIPES = {
  salon: [['canape', 1, 1, 'mur'], ['fauteuil', 1, 2, 'mur'], ['meuble_tv', 1, 1, 'mur'], ['bibliotheque', 0, 1, 'mur'], ['tapis', 1, 1, 'centre'], ['table_basse', 1, 1, 'centre'], ['plante', 0, 2, 'coin'], ['lampe', 0, 1, 'coin']],
  sejour: [['cuisine', 1, 1, 'mur'], ['frigo', 1, 1, 'mur'], ['canape', 1, 1, 'mur'], ['fauteuil', 0, 1, 'mur'], ['meuble_tv', 0, 1, 'mur'], ['table', 1, 1, 'centre'], ['plante', 0, 1, 'coin']],
  cuisine: [['cuisine', 1, 1, 'mur'], ['frigo', 1, 1, 'mur'], ['table', 1, 1, 'centre'], ['commode', 0, 1, 'mur'], ['plante', 0, 1, 'coin']],
  chambre: [['lit', 1, 1, 'mur'], ['armoire', 1, 1, 'mur'], ['chevet', 1, 2, 'mur'], ['commode', 0, 1, 'mur'], ['tapis', 0, 1, 'centre'], ['lampe', 0, 1, 'coin']],
  chambre_simple: [['lit_simple', 1, 2, 'mur'], ['armoire', 1, 1, 'mur'], ['commode', 1, 1, 'mur'], ['chevet', 0, 1, 'mur']],
  sdb: [['baignoire', 0, 1, 'mur'], ['douche', 0, 1, 'mur'], ['toilettes', 1, 1, 'mur'], ['lavabo', 1, 2, 'mur'], ['commode', 0, 1, 'mur']],
  bureau: [['bureau', 1, 2, 'mur'], ['classeur', 1, 2, 'mur'], ['bibliotheque', 0, 2, 'mur'], ['plante', 0, 2, 'coin'], ['fauteuil', 0, 1, 'mur']],
  salle: [['table', 2, 2, 'centre'], ['bibliotheque', 1, 2, 'mur'], ['classeur', 0, 1, 'mur'], ['plante', 1, 2, 'coin']],
  magasin: [['etagere', 2, 5, 'mur'], ['etagere', 1, 3, 'centre'], ['comptoir', 1, 1, 'mur'], ['frigo', 0, 2, 'mur'], ['plante', 0, 1, 'coin']],
  garage: [['voiture', 1, 1, 'centre'], ['etabli', 1, 1, 'mur'], ['etagere', 1, 2, 'mur'], ['pneus', 1, 3, 'coin'], ['tonneau', 0, 2, 'coin']],
  entrepot: [['etagere', 2, 5, 'mur'], ['caisses', 2, 5, 'centre'], ['palette', 1, 4, 'centre'], ['tonneau', 1, 3, 'coin']],
  grange: [['foin', 3, 7, 'mur'], ['foin', 1, 4, 'centre'], ['caisses', 1, 2, 'coin'], ['tonneau', 1, 2, 'coin'], ['etabli', 0, 1, 'mur']],
  grenier: [['foin', 2, 6, 'mur'], ['caisses', 1, 3, 'coin']],
  restaurant: [['bar', 1, 1, 'mur'], ['table', 2, 4, 'centre'], ['frigo', 0, 1, 'mur'], ['plante', 1, 2, 'coin']],
  studio: [['lit_simple', 1, 1, 'mur'], ['poele', 1, 1, 'mur'], ['table', 1, 1, 'centre'], ['armoire', 0, 1, 'mur'], ['commode', 0, 1, 'mur'], ['tonneau', 0, 1, 'coin']],
  poste: [['table', 1, 1, 'centre'], ['caisses', 1, 1, 'coin'], ['tonneau', 0, 1, 'coin']],
  vide: [['caisses', 0, 1, 'coin']],
};
export const ROOM_LABELS = {
  salon: 'Salon', sejour: 'Séjour', cuisine: 'Cuisine', chambre: 'Chambre', chambre_simple: 'Chambre', sdb: 'Salle de bains', bureau: 'Bureau',
  salle: 'Salle de réunion', magasin: 'Magasin', garage: 'Garage', entrepot: 'Entrepôt', grange: 'Grange', grenier: 'Grenier', restaurant: 'Salle de restaurant',
  studio: 'Pièce unique', poste: 'Poste de guet', vide: 'Pièce vide',
};

// usage des pièces d'un étage (du plus grand au plus petit)
function plan(b, k, n) {
  const top = k === b.floors - 1, one = n === 1;
  switch (b.type) {
    case 'maison': case 'chalet': case 'abandonnee':
      if (b.floors === 1) return one ? ['studio'] : ['sejour', 'chambre', 'sdb', 'chambre_simple', 'cuisine'];
      if (k === 0) return one ? ['sejour'] : ['salon', 'cuisine', 'sdb', 'bureau', 'chambre_simple'];
      return one ? ['chambre'] : ['chambre', 'chambre_simple', 'sdb', 'chambre_simple', 'bureau'];
    case 'immeuble': case 'tour':
      return one ? ['sejour'] : ['sejour', 'chambre', 'cuisine', 'sdb', 'chambre_simple', 'bureau', 'chambre_simple', 'sdb'];
    case 'manoir':
      if (k === 0) return one ? ['salon'] : ['salon', 'restaurant', 'cuisine', 'bureau', 'sdb', 'salle'];
      return one ? ['chambre'] : ['chambre', 'chambre', 'sdb', 'bureau', 'chambre_simple', 'sdb'];
    case 'boutique': case 'station': return one ? ['magasin'] : ['magasin', 'entrepot', 'sdb', 'bureau'];
    case 'garage': return ['garage'];
    case 'hangar': case 'abri': return ['entrepot'];
    case 'grange': return k === 0 ? ['grange'] : ['grenier'];
    case 'mairie': return k === 0 ? (one ? ['salle'] : ['salle', 'bureau', 'sdb', 'bureau']) : (one ? ['bureau'] : ['bureau', 'bureau', 'salle', 'sdb']);
    case 'auberge': return k === 0 ? (one ? ['restaurant'] : ['restaurant', 'cuisine', 'sdb', 'bureau']) : (one ? ['chambre'] : ['chambre', 'chambre', 'sdb', 'chambre_simple']);
    case 'bureaux': return one ? ['bureau'] : ['bureau', 'salle', 'bureau', 'sdb', 'bureau', 'entrepot'];
    case 'cabane': return ['studio'];
    case 'phare': return [['salon'], ['chambre_simple'], ['entrepot'], ['bureau'], ['vide']][k] || ['vide'];
    case 'guet': return top ? ['poste'] : ['vide'];
    default: return ['vide'];
  }
}

// ------------------------------------------------------------------ rectangles (m, monde)
const overlap = (a, b, m = 0) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
const inside = (a, r) => a.x0 >= r.x0 && a.x1 <= r.x1 && a.z0 >= r.z0 && a.z1 <= r.z1;
// emprise d'un meuble centré en (x, z), tourné de rot quarts de tour (0 : il regarde +z)
export function furnRect(f) {
  const odd = f.rot & 1, hw = (odd ? f.d : f.w) / 2, hd = (odd ? f.w : f.d) / 2;
  return { x0: f.x - hw, x1: f.x + hw, z0: f.z - hd, z1: f.z + hd };
}

export function furnishBuilding(b, rng) {
  b.furniture = []; b.doors = [];
  const id = () => b.id * 1000 + b.furniture.length;
  const T = 0.18; // demi-épaisseur des murs et marge
  // garage : dans une maison sur trois environ, une pièce du rez-de-chaussée d'au moins 2 × 2 cases, avec un
  // portail percé au milieu d'un mur extérieur (loin des coffres et du butin)
  let garage = null;
  if ((b.type === 'maison' || b.type === 'chalet') && b.levels[0].rooms.length >= 2 && rng.chance(0.4)) {
    const lv0 = b.levels[0], biggest = [...lv0.rooms].sort((a, c) => c.w * c.d - a.w * a.d)[0];
    for (const room of rng.shuffle(lv0.rooms.filter((r) => r !== biggest && Math.min(r.w, r.d) >= 2))) {
      const cand = lv0.walls.filter((e) => e.ext && (e.k === 'mur' || e.k === 'fenetre') && (
        (e.o === 'h' && (e.z === room.z || e.z === room.z + room.d) && e.x > room.x - 1 && e.x < room.x + room.w && e.x !== b.x0 && e.x !== b.x0 + b.w - 1) ||
        (e.o === 'v' && (e.x === room.x || e.x === room.x + room.w) && e.z > room.z - 1 && e.z < room.z + room.d && e.z !== b.z0 && e.z !== b.z0 + b.d - 1)));
      const e = cand.find((q) => {
        const cx = q.o === 'h' ? (q.x + 0.5) * CELL : q.x * CELL, cz = q.o === 'h' ? q.z * CELL : (q.z + 0.5) * CELL;
        return ![...b.chests, ...b.ammo, ...b.loot].some((c) => c.k === 0 && Math.hypot(c.x - cx, c.z - cz) < 4);
      });
      if (!e) continue;
      e.k = 'portail';
      garage = room;
      break;
    }
  }
  for (const lv of b.levels) {
    const k = lv.k;
    const edges = new Map(lv.walls.map((e) => [e.o + e.x + ',' + e.z, e]));
    // portes : un battant (porte) ou un rideau (portail) par pan ; fermées au départ (les maisons abandonnées ont
    // souvent perdu les leurs, ou les ont laissées ouvertes)
    for (const e of lv.walls) {
      if (e.k !== 'porte' && e.k !== 'portail') continue;
      if (b.abandoned && rng.chance(0.3)) continue;
      const nx = e.o === 'v' ? (e.x === b.x0 ? -1 : e.x === b.x0 + b.w ? 1 : 0) : 0, nz = e.o === 'h' ? (e.z === b.z0 ? -1 : e.z === b.z0 + b.d ? 1 : 0) : 0;
      b.doors.push({ id: b.id * 100 + b.doors.length, b: b.id, k, o: e.o, x: e.x, z: e.z, kind: e.k, ext: e.ext, nx, nz,
        open: b.abandoned ? rng.chance(0.5) : !e.ext && rng.chance(0.4) });
    }
    // zones à garder libres : devant chaque porte (des deux côtés), escalier et paliers, coffres, butin
    const clear = [];
    for (const e of lv.walls) {
      if (e.k === 'mur' || e.k === 'fenetre') continue;
      const cx = e.o === 'h' ? (e.x + 0.5) * CELL : e.x * CELL, cz = e.o === 'h' ? e.z * CELL : (e.z + 0.5) * CELL;
      const half = e.k === 'portail' ? 2.2 : 1.1, deep = e.k === 'portail' ? 3.5 : 1.7;
      clear.push(e.o === 'h' ? { x0: cx - half, x1: cx + half, z0: cz - deep, z1: cz + deep } : { x0: cx - deep, x1: cx + deep, z0: cz - half, z1: cz + half });
    }
    const stairCells = [];
    if (b.stairs && (lv.stairs || lv.hole)) { const s = b.stairs; for (const t of [-1, 0, 1]) stairCells.push([s.x + s.dx * t, s.z + s.dz * t]); }
    for (const [x, z] of stairCells) clear.push({ x0: x * CELL - 0.2, x1: (x + 1) * CELL + 0.2, z0: z * CELL - 0.2, z1: (z + 1) * CELL + 0.2 });
    for (const c of [...b.chests, ...b.ammo]) if (c.k === k) clear.push({ x0: c.x - 1.1, x1: c.x + 1.1, z0: c.z - 1.1, z1: c.z + 1.1 });
    for (const c of b.loot) if (c.k === k) clear.push({ x0: c.x - 0.7, x1: c.x + 0.7, z0: c.z - 0.7, z1: c.z + 0.7 });
    const placed = [];
    const free = (r, solid, tall) => !clear.some((c) => overlap(r, c)) && !placed.some((p) => overlap(r, p.r, solid && p.solid ? 0.12 : 0))
      && !(tall && b.furniture.some((f) => f.k === k && f.y && overlap(r, furnRect(f), 0.1)));
    const add = (f) => { const r = furnRect(f); const it = { ...f, id: id(), b: b.id, k }; b.furniture.push(it); placed.push({ r, solid: FURN[f.kind].solid }); return it; };

    // pièces du plus grand au plus petit, usages selon le bâtiment
    const rooms = lv.rooms.map((r) => ({ ...r })).sort((a, c) => c.w * c.d - a.w * a.d);
    const uses = plan(b, k, rooms.length);
    lv.roomUse = [];
    rooms.forEach((room, i) => {
      let use = uses[Math.min(i, uses.length - 1)];
      if (garage && k === 0 && room.x === garage.x && room.z === garage.z) use = 'garage';
      // les petites pièces ne prennent pas les grosses recettes
      const area = room.w * room.d;
      if (area <= 1 && (use === 'salon' || use === 'sejour' || use === 'restaurant' || use === 'salle')) use = 'bureau';
      if (area <= 1 && use === 'garage') use = 'entrepot';
      lv.roomUse.push({ x: room.x, z: room.z, w: room.w, d: room.d, use });
      const R = { x0: room.x * CELL + T, x1: (room.x + room.w) * CELL - T, z0: room.z * CELL + T, z1: (room.z + room.d) * CELL - T };
      // emplacements contre les murs : une case de bord et un côté plein (mur, ou fenêtre pour les meubles bas)
      const slots = [];
      for (let z = room.z; z < room.z + room.d; z++) for (let x = room.x; x < room.x + room.w; x++) {
        const sides = [
          [z === room.z, 'h' + x + ',' + z, 0, -1], [z === room.z + room.d - 1, 'h' + x + ',' + (z + 1), 0, 1],
          [x === room.x, 'v' + x + ',' + z, -1, 0], [x === room.x + room.w - 1, 'v' + (x + 1) + ',' + z, 1, 0],
        ];
        for (const [edge, key, sx, sz] of sides) {
          if (!edge) continue;
          const e = edges.get(key);
          if (e && (e.k === 'mur' || e.k === 'fenetre')) slots.push({ x, z, sx, sz, win: e.k === 'fenetre' });
        }
      }
      rng.shuffle(slots);
      const keep = b.abandoned ? 0.6 : 1;
      // les grandes pièces reçoivent des meubles en plus
      const recipe = [...(RECIPES[use] || RECIPES.vide), ...(area >= 4 ? EXTRAS[use] || [] : []), ...(area >= 6 ? EXTRAS[use] || [] : [])];
      // tableaux et horloges : sur un mur plein, au-dessus des meubles bas
      const walls = slots.filter((s) => !s.win);
      for (let t = 0, n = DECOR[use] || 0; t < n * Math.max(1, Math.floor(area / 2)) && walls.length; t++) {
        const s = walls.splice(rng.int(0, walls.length - 1), 1)[0], kind = rng.chance(0.85) ? 'cadre' : 'horloge', F = FURN[kind];
        const rot = s.sz < 0 ? 0 : s.sz > 0 ? 2 : s.sx < 0 ? 1 : 3;
        let x = (s.x + 0.5) * CELL + (s.sx ? 0 : rng.range(-1, 1)), z = (s.z + 0.5) * CELL + (s.sx ? rng.range(-1, 1) : 0);
        if (s.sx) x = s.sx < 0 ? R.x0 + 0.03 : R.x1 - 0.03; else z = s.sz < 0 ? R.z0 + 0.03 : R.z1 - 0.03;
        b.furniture.push({ kind, x, z, rot, w: F.w, d: F.d, h: F.h, y: F.deco, id: id(), b: b.id, k, tall: true });
      }
      for (const [kind, n0, n1, where] of recipe) {
        const F = FURN[kind];
        let n = rng.int(n0, n1);
        if (kind === 'voiture' && Math.min(room.w, room.d) < 2) n = 0;
        for (let t = 0; t < n; t++) {
          if (rng.next() > keep) continue;
          let ok = false;
          if (where === 'centre') {
            // au milieu : seulement dans les pièces d'au moins deux cases de large
            if (Math.min(room.w, room.d) < 2 && !(kind === 'tapis' || kind === 'table_basse' || kind === 'table' || kind === 'caisses' || kind === 'palette' || kind === 'foin')) continue;
            for (let a = 0; a < 14 && !ok; a++) {
              // le grand côté du meuble suit le grand côté de la pièce
              const rot = room.w === room.d ? rng.int(0, 1) : room.w > room.d ? 0 : 1;
              const mx = (R.x0 + R.x1) / 2 + rng.range(-1, 1) * Math.max(0, (R.x1 - R.x0) / 2 - 2.6), mz = (R.z0 + R.z1) / 2 + rng.range(-1, 1) * Math.max(0, (R.z1 - R.z0) / 2 - 2.6);
              const f = { kind, x: mx, z: mz, rot, w: F.w, d: F.d, h: F.h };
              // une table garde la place de ses chaises
              const r = furnRect(f), m = kind === 'table' ? 0.75 : kind === 'voiture' ? 0.9 : 0.5;
              const big = { x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m };
              if (!inside(big, R) || !free(big, true)) continue;
              // dans une pièce étroite, il reste un passage d'au moins 1,1 m d'un côté
              if (Math.min(room.w, room.d) < 2) {
                const gap = room.w <= room.d ? Math.max(big.x0 - R.x0, R.x1 - big.x1) : Math.max(big.z0 - R.z0, R.z1 - big.z1);
                if (gap < 1.1) continue;
              }
              const it = add(f); ok = true;
              if (kind === 'table') {
                // chaises autour de la table
                // sur les deux grands côtés, tournées vers la table
                const seats = rot & 1
                  ? [[-F.d / 2 - 0.35, -F.w / 4, 1], [-F.d / 2 - 0.35, F.w / 4, 1], [F.d / 2 + 0.35, -F.w / 4, 3], [F.d / 2 + 0.35, F.w / 4, 3]]
                  : [[-F.w / 4, -F.d / 2 - 0.35, 0], [F.w / 4, -F.d / 2 - 0.35, 0], [-F.w / 4, F.d / 2 + 0.35, 2], [F.w / 4, F.d / 2 + 0.35, 2]];
                for (const [ox, oz, r2] of seats) if (rng.chance(0.85)) add({ kind: 'chaise', x: it.x + ox, z: it.z + oz, rot: r2, w: 0.46, d: 0.46, h: 0.92 });
              }
            }
          } else {
            for (const s of slots) {
              if (F.tall && s.win) continue;
              // contre le mur, centré sur la case (les coins se décalent vers un angle)
              const rot = s.sz < 0 ? 0 : s.sz > 0 ? 2 : s.sx < 0 ? 1 : 3;
              // w se mesure toujours le long du mur, d en profondeur
              const along = F.w, depth = F.d;
              const shift = where === 'coin' ? (rng.chance(0.5) ? -1 : 1) * (CELL / 2 - T - along / 2 - 0.05) : rng.range(-0.4, 0.4);
              let x = (s.x + 0.5) * CELL, z = (s.z + 0.5) * CELL;
              if (s.sx) { x = s.sx < 0 ? R.x0 + depth / 2 : R.x1 - depth / 2; z += shift; }
              else { z = s.sz < 0 ? R.z0 + depth / 2 : R.z1 - depth / 2; x += shift; }
              const f = { kind, x, z, rot, w: F.w, d: F.d, h: F.h };
              const r = furnRect(f);
              if (!inside(r, R) || !free(r, F.solid, F.h > 1.2)) continue;
              add(f); ok = true;
              slots.splice(slots.indexOf(s), 1);
              break;
            }
          }
          if (!ok) break;
        }
      }
    });
  }
  return b;
}
