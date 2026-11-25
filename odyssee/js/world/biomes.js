// odyssee/js/world/biomes.js — les biomes des routes : chaque route a son sol, ses herbes, ses arbres, son eau, sa lumière.
//
// Un biome est une fiche (BIOMES) : des dégradés qui remplacent les teintes du sol généré (render/solgen.js, par indice de
// palette : le dessin ne change pas, ses couleurs oui), les matières mêlées au sol (neige, sable, mousse…), les essences de
// la forêt, ce qui flotte dans l'air (render/ambiance.js), la lumière. W.biomes dit le biome de chaque case (0 : aucun).
// Sans DOM : lu par la carte, par le rendu, par les workers du sol et par les tests.

/** dégradé de n teintes entre des couleurs données (de la plus sombre à la plus claire) */
export function degrade(stops, n) {
  const c = stops.map((h) => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; });
  return Array.from({ length: n }, (_, i) => {
    const f = n === 1 ? 0 : i / (n - 1) * (c.length - 1), k = Math.min(c.length - 2, Math.floor(f)), t = f - k;
    return '#' + [0, 1, 2].map((j) => Math.round(c[k][j] + (c[k + 1][j] - c[k][j]) * t).toString(16).padStart(2, '0')).join('');
  });
}

/**
 * Les fiches. Dégradés (sombre, moyen, clair) : herbe, haute (hautes herbes), chemin, eau, berge, cendre, sable, rocher.
 *  fleurs : [rouge, rouge sombre, jaune, blanc, blanc ombré, bleu, bleu sombre] (les sept teintes du sol généré)
 *  sols : [matière ('neige' | 'cendre' | 'sable' | 'feuilles' | 'mousse' | 'roche'), part de 0 à 1] mêlées par plaques
 *  voie : 'pave' (le sentier est dallé) ; tall : 'TA' | 'TD' | 'TS' (dessin des hautes herbes)
 *  semis : [matière, densité par case] petites choses semées sur l'herbe
 *  arbres : [essence, poids] pour les feuillus ; pins : pour les résineux
 *  air : particules ; lum : lumière ; pierre : teinte des rochers ; roche : famille de falaise (render/falaises.js)
 */
export const BIOMES = [null,
  { id: 'campagne', nom: 'Campagne dorée', herbe: ['#4a7426', '#8cb444', '#d6de7c'], haute: ['#8a5a1a', '#d8a636', '#f8e48a'], tall: 'TA', chemin: ['#7c5030', '#c6965e', '#f0d4a0'],
    fleurs: ['#f04a30', '#a82818', '#ffd040', '#fffbe8', '#e0d8b0', '#5a8cf0', '#3858b0'], semis: [['fleur', 1.0]], arbres: [['tree', 5], ['tree2', 2], ['b_pommier', 2], ['b_peuplier', 3]], pins: [['b_peuplier', 3], ['tree', 2]], air: 'graines', lum: [1.05, 1.02, 0.94] },
  { id: 'valfleuri', nom: 'Val fleuri', herbe: ['#1f6e4e', '#5abc74', '#c0f0a8'], haute: ['#2c6c50', '#dc78b0', '#ffe4f2'], chemin: ['#8a6a50', '#d2b088', '#f8e8c8'], eau: ['#1e6ab0', '#48b4e0', '#d8f8ff'],
    fleurs: ['#ff6ea8', '#c23c7c', '#ffe066', '#ffffff', '#ecd4ee', '#b088ff', '#7650cc'], semis: [['fleur', 3.2], ['trefle', 0.6]], arbres: [['tree', 3], ['b_saule', 4], ['cerisier', 2], ['b_bouleau', 3]], pins: [['b_bouleau', 3], ['pine', 1]], air: 'pollen', lum: [1.02, 1.03, 1.0] },
  { id: 'murmure', nom: 'Bois Murmure', herbe: ['#0f3a44', '#1e6a60', '#54ac8c'], haute: ['#0a2e3c', '#18606c', '#4cb0a4'], chemin: ['#2e2a3a', '#5c5460', '#948a8c'], roche: 'lune',
    fleurs: ['#54e8ff', '#1f9ab8', '#b8fff0', '#e8ffff', '#a0d8e8', '#8c78ff', '#5040b0'], sols: [['mousse', 0.3]], mousse: ['#0c3438', '#1c6458', '#4aa88c'], semis: [['lueur', 1.3], ['champi', 0.25]], arbres: [['b_champi_bleu', 1.6], ['b_geant', 3], ['tree2', 4]], pins: [['b_geant', 3], ['pine', 2]], air: 'spores', lum: [0.92, 1.02, 1.1] },
  { id: 'alpage', nom: 'Alpages', herbe: ['#3a6650', '#7cae80', '#cfe2ac'], haute: ['#5a6a34', '#a0a854', '#e4dc90'], chemin: ['#5c5c5e', '#96968e', '#d2d2c4'], roche: 'granit', eau: ['#1c5a8c', '#4aa4cc', '#e0f8ff'],
    fleurs: ['#e85a9c', '#a42c64', '#ffd84c', '#ffffff', '#d8dce8', '#4a7cf0', '#2c4cb0'], semis: [['caillou', 0.9], ['fleur', 1.2]], arbres: [['pine', 5], ['b_meleze', 4]], pins: [['pine', 4], ['b_meleze', 4]], air: 'graines', lum: [0.98, 1.02, 1.06] },
  { id: 'cerisaie', nom: 'Cerisaie', herbe: ['#4a7c4c', '#92c47c', '#e0f0b4'], haute: ['#8c4468', '#e08cb0', '#ffd4e4'], chemin: ['#94706c', '#d8b4a4', '#fbe6d8'],
    fleurs: ['#ff9cc0', '#d4608c', '#ffe9a0', '#fff4f8', '#f4c8d8', '#f0a8d0', '#c070a0'], semis: [['petale', 5]], arbres: [['cerisier', 6], ['b_cerisier_blanc', 4], ['tree', 1]], pins: [['cerisier', 4], ['b_cerisier_blanc', 3], ['pine', 1]], air: 'petales', lum: [1.06, 1.0, 1.02] },
  { id: 'lande', nom: 'Lande de bruyère', herbe: ['#4c4c38', '#84805a', '#bcb484'], haute: ['#46265c', '#9456ae', '#e6b0ec'], chemin: ['#423e3c', '#7a7068', '#b4a898'], roche: 'granit', eau: ['#20304c', '#48688c', '#b8d4e4'],
    fleurs: ['#c86ad0', '#8a3c98', '#f0c8f0', '#f8e8f8', '#d0b8d8', '#9c70e0', '#6440a8'], sols: [['mousse', 0.16]], mousse: ['#4a2a58', '#8c58a0', '#c890cc'], semis: [['fleur', 2.2], ['caillou', 0.7]], arbres: [['deadtree', 2], ['b_pin_tordu', 5], ['tree2', 1]], pins: [['b_pin_tordu', 5], ['pine', 1]], air: 'vent', lum: [0.96, 0.96, 1.04] },
  { id: 'savane', pierre: [1.4, 1.1, 0.8], nom: 'Savane', herbe: ['#8a6c24', '#c8a84a', '#f2e094'], haute: ['#7c5212', '#c88c28', '#fae07c'], tall: 'TA', chemin: ['#8a3c22', '#c8744a', '#f0b48c'], roche: 'ocre', eau: ['#1c6a74', '#48b0a4', '#e0fff0'],
    fleurs: ['#f06030', '#a83a18', '#ffc840', '#fff4d8', '#e0cca0', '#e08848', '#a85c2c'], sols: [['roche', 0.14]], semis: [['caillou', 0.4], ['touffe', 1.2]], arbres: [['b_acacia', 4], ['b_olivier', 3], ['b_baobab', 1], ['bush', 2]], pins: [['b_acacia', 2], ['b_olivier', 3], ['deadtree', 2], ['bush', 1]], air: 'graines', lum: [1.08, 1.0, 0.88] },
  { id: 'lavande', nom: 'Champs de lavande', herbe: ['#4e7c36', '#90bc5c', '#d6e89c'], haute: ['#3c2c78', '#8260cc', '#d0b4fa'], chemin: ['#a08458', '#d8c090', '#f8ecd0'],
    fleurs: ['#a06cf0', '#6438b8', '#ffd94c', '#ffffff', '#d8ccec', '#8c78f4', '#5848c0'], semis: [['fleur', 1.4]], arbres: [['b_cypres', 6], ['b_olivier', 4], ['tree', 1]], pins: [['b_cypres', 6], ['pine', 1]], air: 'pollen_v', lum: [1.04, 1.0, 1.02] },
  { id: 'mirage', pierre: [1.25, 1.1, 1.7], nom: 'Prairie d\'opale', herbe: ['#3a6e90', '#7cc0cc', '#d8f8ee'], haute: ['#70449a', '#c48ce0', '#fad8fc'], chemin: ['#7c6c98', '#bcacd0', '#f0e8f8'], roche: 'lune', eau: ['#4a58c0', '#80b8f0', '#f0f0ff'],
    fleurs: ['#ff9cd8', '#c060a8', '#fff0a0', '#ffffff', '#d8e0ff', '#8cf0f0', '#50a8c8'], semis: [['etoile', 1.6], ['cristal', 0.2]], arbres: [['b_opale', 5], ['b_opale2', 4], ['b_cristal', 1]], pins: [['b_opale2', 5], ['b_cristal', 1]], air: 'etincelles', lum: [0.98, 1.0, 1.1] },
  { id: 'jungle', pierre: [0.8, 0.95, 0.7], nom: 'Jungle', herbe: ['#0c4c26', '#22903e', '#78d058'], haute: ['#083a20', '#1a7434', '#5cc04c'], chemin: ['#62261a', '#a45238', '#d88e62'], roche: 'terre', eau: ['#0c5a50', '#2ca084', '#c0ffe0'],
    fleurs: ['#ff4a5a', '#b01c3c', '#ffd030', '#fff0f0', '#f0c0d0', '#ff8c30', '#c05010'], sols: [['mousse', 0.34]], mousse: ['#0a3e20', '#1c7430', '#58b048'], semis: [['fougere', 2.2], ['fleur', 0.8]], arbres: [['b_fromager', 4], ['palm', 4], ['b_fougere', 4], ['tree2', 2]], pins: [['b_fromager', 3], ['palm', 3]], air: 'spores_v', lum: [0.95, 1.05, 0.92] },
  { id: 'gorge', pierre: [1.5, 1.02, 0.74], nom: 'Gorge fumante', herbe: ['#6c4c2c', '#a8844c', '#e0c486'], haute: ['#7a3c18', '#c87830', '#f8cc70'], tall: 'TA', chemin: ['#7a3426', '#b86a4c', '#e8ac88'], roche: 'ocre', eau: ['#0a6c74', '#1cc0ac', '#c8fff0'], berge: ['#c07818', '#f0bc38', '#fff2a4'],
    fleurs: ['#f07038', '#a84018', '#ffd24a', '#fff0d0', '#e0c090', '#f0a050', '#b06828'], sols: [['roche', 0.55]], semis: [['caillou', 1.3]], arbres: [['deadtree', 2], ['b_acacia', 3], ['cactus', 1]], pins: [['b_acacia', 2], ['deadtree', 1]], air: 'vapeur', lum: [1.06, 0.99, 0.92] },
  { id: 'taiga', nom: 'Taïga', herbe: ['#2a545c', '#5e9490', '#b4d8cc'], haute: ['#24485c', '#5c8ca0', '#c8e4ec'], chemin: ['#52585e', '#8a9298', '#c8d0d2'], roche: 'granit', eau: ['#2c6ca4', '#74bce0', '#f0fcff'],
    fleurs: ['#8cc8f0', '#5088b8', '#e8f4c0', '#ffffff', '#c8dcec', '#6c90f0', '#4460b8'], sols: [['neige', 0.4]], semis: [['caillou', 0.8]], arbres: [['pine', 4], ['snowpine', 4], ['b_bouleau', 2]], pins: [['pine', 3], ['snowpine', 5]], air: 'flocons', lum: [0.96, 1.0, 1.08] },
  { id: 'celeste', pierre: [1.7, 1.7, 1.75], nom: 'Jardins célestes', herbe: ['#7a90b8', '#b8d0e8', '#f6fcff'], haute: ['#a87c24', '#e8c458', '#fff6c0'], tall: 'TA', chemin: ['#8488a0', '#c4cade', '#ffffff'], voie: 'pave', pave: ['#6c708c', '#bcc2da', '#ffffff'], roche: 'granit', eau: ['#4a78d8', '#8cc4f8', '#ffffff'],
    fleurs: ['#ffd24a', '#c89020', '#fff4b0', '#ffffff', '#d8e0f4', '#8cb4ff', '#5c80d8'], semis: [['etoile', 1.8], ['fleur', 1.2]], arbres: [['b_or', 5], ['b_bouleau', 4]], pins: [['b_or', 3], ['b_bouleau', 2], ['pine', 1]], air: 'plumes', lum: [1.04, 1.03, 1.04] },
  { id: 'cote', pierre: [1.4, 1.3, 1.1], nom: 'Côte aux palmes', herbe: ['#4a8038', '#9cc058', '#e8e898'], haute: ['#6a7a28', '#b8b84c', '#f0e890'], chemin: ['#b08c54', '#e4cc94', '#fff4d4'], roche: 'mer', eau: ['#0a6c9c', '#1cb8d0', '#c0fff8'], berge: ['#d8b878', '#f0dca4', '#fff8dc'],
    fleurs: ['#ff6a5a', '#c03c38', '#ffd84c', '#ffffff', '#f0dcd0', '#ff9c50', '#c86828'], sols: [['sable', 0.36]], semis: [['coquille', 0.5], ['fleur', 0.6]], arbres: [['palm', 6], ['b_pin_parasol', 3], ['tree', 2], ['b_olivier', 2]], pins: [['b_pin_parasol', 2], ['palm', 3], ['tree', 3], ['b_olivier', 2]], air: 'embruns', lum: [1.05, 1.03, 0.98] },
  { id: 'verger', nom: 'Vergers', herbe: ['#386e2c', '#7cb84c', '#ccea88'], haute: ['#3c6a28', '#78b044', '#d4e880'], chemin: ['#8a5c38', '#cca470', '#f4dcb0'],
    fleurs: ['#ff8c9c', '#c84c60', '#ffe070', '#ffffff', '#ecd8dc', '#ffb0c8', '#d07890'], semis: [['fleur', 1.8], ['trefle', 1]], arbres: [['b_pommier', 5], ['b_oranger', 4], ['tree', 2]], pins: [['b_pommier', 2], ['b_peuplier', 4]], air: 'graines', lum: [1.04, 1.03, 0.98] },
  { id: 'riziere', nom: 'Rizières', herbe: ['#2e7034', '#78c050', '#d4f08c'], haute: ['#3c7c20', '#88cc3c', '#e4f890'], chemin: ['#6a5840', '#a89068', '#d8c498'], eau: ['#5c8090', '#98c0c0', '#eefaf0'], berge: ['#5c4c34', '#8c7650', '#b8a078'],
    fleurs: ['#f0d060', '#b09028', '#ffffff', '#f8ffe8', '#d0e0b8', '#a0d860', '#68a038'], semis: [['touffe', 1]], arbres: [['b_bambou', 3], ['b_saule', 3], ['tree', 3]], pins: [['b_bambou', 4], ['pine', 1]], air: 'libellules', lum: [1.02, 1.04, 0.98] },
  { id: 'marais', pierre: [0.75, 0.85, 0.62], nom: 'Marais', herbe: ['#2c3c28', '#5a6c40', '#949e60'], haute: ['#34401c', '#78782e', '#c0b060'], tall: 'TD', chemin: ['#3c2e22', '#70583c', '#a48a60'], roche: 'terre', eau: ['#18241e', '#34503c', '#8a9c60'], berge: ['#2c2c20', '#4a4a30', '#6c6c44'],
    fleurs: ['#c8e850', '#80a028', '#e8f8a0', '#e0f0d0', '#a8c090', '#a080c8', '#685090'], sols: [['mousse', 0.4]], mousse: ['#26381c', '#4c6c28', '#8ca84c'], semis: [['champi', 0.4], ['touffe', 1.4]], arbres: [['b_paletuvier', 5], ['b_saule_gris', 3], ['deadtree', 2]], pins: [['b_paletuvier', 3], ['b_saule_gris', 2]], air: 'bulles', lum: [0.92, 0.98, 0.9] },
  { id: 'desert', pierre: [1.55, 1.25, 0.9], nom: 'Mer de dunes', herbe: ['#a8743c', '#d8ac6c', '#f4dca4'], sable: ['#b87840', '#e6bc7c', '#ffeec0'], haute: ['#8a6428', '#c89c4c', '#f4dc94'], chemin: ['#9c6038', '#d09c68', '#f4d4a4'], roche: 'ocre', eau: ['#0a7088', '#24b8b8', '#c8fff0'], berge: ['#5c8c30', '#90b848', '#d0e080'],
    fleurs: ['#ff7a9c', '#c04468', '#ffd84c', '#fff8e0', '#e8d4b0', '#ff9c60', '#c86c30'], semis: [['os', 0.05], ['caillou', 0.3]], arbres: [['palm', 4], ['cactus', 3], ['cactus2', 3]], pins: [['cactus', 2], ['cactus2', 2]], air: 'sable', lum: [1.06, 1.0, 0.92] },
  { id: 'canyon', pierre: [1.5, 0.95, 0.7], nom: 'Canyon rouge', herbe: ['#8c4424', '#c46c3c', '#f0b078'], roche: 'ocre', rocher: ['#6a2818', '#b86038', '#f0a86c'], haute: ['#7a4c1c', '#c08c3c', '#f0d484'], chemin: ['#a8683c', '#dca470', '#ffdcac'],
    semis: [['caillou', 1.2], ['os', 0.06]], arbres: [['deadtree', 2], ['cactus', 3], ['b_acacia', 2]], pins: [['cactus2', 2], ['deadtree', 1]], air: 'sable', lum: [1.08, 0.97, 0.88] },
  { id: 'roseraie', pierre: [1.35, 1.15, 1.2], nom: 'Roseraie', herbe: ['#3c7050', '#84bc80', '#dcf4b8'], haute: ['#781c44', '#d84c80', '#ffb8d0'], chemin: ['#9c7c80', '#dcc0c0', '#fff0f0'], voie: 'pave', pave: ['#8c6c78', '#d8b8c0', '#fff4f4'],
    fleurs: ['#ff3c70', '#b01448', '#ffd0dc', '#ffffff', '#f4d0dc', '#ff80b0', '#c84c84'], semis: [['petale', 3], ['fleur', 1.6]], arbres: [['b_rosier', 6], ['cerisier', 3], ['tree', 1]], pins: [['b_cypres', 4], ['b_rosier', 2]], air: 'petales_r', lum: [1.05, 0.99, 1.01] },
  { id: 'hante', pierre: [0.7, 0.72, 1.0], nom: 'Forêt hantée', herbe: ['#1e2438', '#42506a', '#8494ac'], haute: ['#1c1838', '#403a70', '#8878c0'], tall: 'TD', chemin: ['#302c38', '#58525e', '#90888e'], voie: 'pave', pave: ['#2c2a38', '#5c5868', '#9c98a8'], roche: 'lune', eau: ['#141c34', '#304470', '#90a8d8'],
    fleurs: ['#b060ff', '#6c2cb0', '#d0ff80', '#e0e0ff', '#a0a0c8', '#60ffb8', '#289870'], sols: [['feuilles', 0.3]], feuilles: ['#241c34', '#463a58', '#7c6c8c'], semis: [['champi', 0.35], ['lueur', 0.5], ['feuille_m', 1.4]], arbres: [['b_mort', 5], ['b_hante', 4], ['deadtree', 2]], pins: [['b_hante', 3], ['b_mort', 2]], air: 'follets', lum: [0.92, 0.92, 1.12] },
  { id: 'vigne', nom: 'Coteaux d\'automne', herbe: ['#6c5c26', '#b09c42', '#ecd67c'], haute: ['#6a1c30', '#b0485a', '#f0a080'], chemin: ['#74482c', '#b8845a', '#ecc494'], roche: 'terre',
    fleurs: ['#e0582c', '#98301c', '#ffc840', '#fff0d0', '#e0c8a0', '#b058a8', '#743070'], sols: [['feuilles', 0.45]], semis: [['feuille_m', 2.4]], arbres: [['automne', 7], ['b_peuplier_or', 3]], pins: [['automne', 2], ['b_cypres', 3]], air: 'feuilles', lum: [1.08, 0.99, 0.88] },
  { id: 'orage', pierre: [0.62, 0.64, 0.82], nom: 'Terres d\'orage', herbe: ['#242c40', '#4e5a78', '#94a4c4'], haute: ['#281a50', '#6a48b0', '#d0a8ff'], chemin: ['#28262e', '#524e5c', '#908a9c'], roche: 'granit', eau: ['#1c2454', '#3c5ca4', '#b8d8ff'], cendre: ['#1e2030', '#44485c', '#7c84a0'],
    fleurs: ['#ffe84c', '#c0a010', '#fff8b0', '#ffffff', '#c8c8f0', '#8cc8ff', '#4c84d8'], sols: [['cendre', 0.4]], semis: [['caillou', 1.1], ['etincelle', 0.6]], arbres: [['deadtree', 3], ['b_pin_tordu', 4], ['b_foudroye', 3]], pins: [['b_pin_tordu', 4], ['b_foudroye', 2]], air: 'statique', lum: [0.88, 0.9, 1.08] },
  { id: 'bambou', nom: 'Bambouseraie', herbe: ['#3c701e', '#8cb838', '#e0f080'], haute: ['#1c6034', '#4ca44c', '#c0e878'], chemin: ['#a0907c', '#d8ccb4', '#faf4e4'], roche: 'granit', eau: ['#1c7080', '#48b4b0', '#d8fff0'],
    fleurs: ['#ff6a50', '#b83428', '#fff0a0', '#ffffff', '#e8e8d0', '#a0d860', '#609830'], sols: [['mousse', 0.35]], semis: [['feuille_b', 1.8]], arbres: [['b_bambou', 9], ['erable', 1]], pins: [['b_bambou', 7], ['pine', 2]], air: 'feuilles_b', lum: [0.99, 1.05, 0.9] },
  { id: 'braises', pierre: [0.62, 0.5, 0.48], nom: 'Terres de braise', herbe: ['#34241e', '#5e4438', '#967458'], haute: ['#5a140c', '#d04c18', '#ffc04c'], tall: 'TA', chemin: ['#241c1c', '#4e3e3a', '#86706a'], roche: 'magma', cendre: ['#2c1e1c', '#503a34', '#846458'], eau: ['#a01c08', '#f06010', '#fff090'], berge: ['#1c1210', '#3a2420', '#6c3c28'],
    fleurs: ['#ff7a30', '#b83c10', '#ffc840', '#fff0c8', '#d0a888', '#ff5040', '#a82418'], sols: [['cendre', 0.7]], semis: [['braise', 1.6], ['caillou', 0.8]], arbres: [['deadtree', 3], ['b_braise', 5]], pins: [['b_braise', 3], ['deadtree', 3]], air: 'braises', lum: [1.06, 0.92, 0.86] },
  { id: 'givre', nom: 'Pente givrée', herbe: ['#8fa4c0', '#d0dcec', '#ffffff'], roche: 'glace', eau: ['#3c7cb4', '#8ccce8', '#ffffff'], semis: [['cristal', 0.25]], arbres: [['snowpine', 8], ['b_givre', 3]], pins: [['snowpine', 8], ['b_givre', 2]], air: 'flocons', lum: [0.98, 1.0, 1.06] },
];
/** numéro d'un biome */
export const B = Object.fromEntries(BIOMES.map((b, i) => [b?.id || '', i]));
/** le biome de chaque route */
export const BIOME_ROUTE = {
  r1: 'campagne', r2: 'valfleuri', bois: 'murmure', r3: 'alpage', r3e: 'cerisaie', r4: 'lande', r5: 'savane', r6: 'lavande', r7: 'mirage', r9: 'taiga', r9b: 'celeste', r10: 'cote',
  r11: 'gorge', r12: 'jungle', r13: 'verger', r14: 'riziere', r15: 'marais', r16: 'desert', r17: 'canyon', r18: 'roseraie', r19: 'hante', r20: 'vigne',
  orage1: 'orage', orage2: 'orage', grue1: 'bambou', grue2: 'braises', givre1: 'givre', givre2: 'givre', pont: 'cote',
};

/** W.biomes, par case : le numéro du biome (5 bits), et MER là où l'eau est celle de la mer (elle garde ses bleus) */
export const MER = 32;
const EAU_LIBRE = new Set(['cote']);   // biomes dont la mer aussi prend la couleur
/** pose W.biomes d'après les zones des routes (les villes et les lieux à thème gardent le leur) ; mer : masque des cases de mer */
export function poserBiomes(W, mer = null) {
  const M = W.biomes = new Uint8Array(W.w * W.h);
  for (const z of W.zones) {
    const n = z.route && !z.town ? B[BIOME_ROUTE[z.route]] || 0 : 0;
    if (!n && !z.town && !z.theme && !z.sea && !z.route) continue;      // un lieu sans thème, au milieu d'une route : la route continue
    for (let y = Math.max(0, z.y0); y <= Math.min(W.h - 1, z.y1); y++) M.fill(n, y * W.w + Math.max(0, z.x0), y * W.w + Math.min(W.w - 1, z.x1) + 1);
  }
  if (mer) for (let i = 0; i < mer.length; i++) {
    if (!mer[i]) continue;
    const x = i % W.w, y = (i - x) / W.w;
    for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) { const u = x + a, v = y + b; if (u < 0 || v < 0 || u >= W.w || v >= W.h) continue; const j = v * W.w + u; if (M[j] && !EAU_LIBRE.has(BIOMES[M[j] & 31].id)) M[j] |= MER; }
  }
  return M;
}
/** la case d'eau est-elle de la lave (terres de braise) ? on n'y surfe pas, on n'y pêche pas */
export const estLave = (m, x, y) => !!m.outdoor && !!m.biomes && biomeBrut(m, x, y) === B.braises;
/** le biome d'une case avec le bit MER (teintes du sol) */
export function biomeBrut(m, x, y) {
  const b = m.base || m, M = b.biomes; if (!M) return 0;
  const X = x < 0 ? 0 : x >= b.w ? b.w - 1 : x, Y = y < 0 ? 0 : y >= b.h ? b.h - 1 : y;
  return M[Y * b.w + X];
}
/** le biome d'une case (numéro ; hors de la carte : celui du bord) */
export function biomeEn(m, x, y) {
  const b = m.base || m, M = b.biomes; if (!M) return 0;
  const X = x < 0 ? 0 : x >= b.w ? b.w - 1 : x, Y = y < 0 ? 0 : y >= b.h ? b.h - 1 : y;
  return M[Y * b.w + X] & 31;
}

const h2 = (x, y, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function lisse(x, y, p, s) {
  const gx = x / p, gy = y / p, i = Math.floor(gx), j = Math.floor(gy); let u = gx - i, v = gy - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  return (h2(i, j, s) * (1 - u) + h2(i + 1, j, s) * u) * (1 - v) + (h2(i, j + 1, s) * (1 - u) + h2(i + 1, j + 1, s) * u) * v;
}
/** hasard stable d'une case, dans [0, 1], et bruit doux */
export const hasardCase = h2, bruitBiome = lisse;
/** la matière mêlée à l'herbe d'une case ('neige', 'sable'… ou null), par plaques */
export function matiere(n, x, y) {
  const S = BIOMES[n]?.sols; if (!S) return null;
  for (let k = 0; k < S.length; k++) {
    // bruit à deux échelles ramené à peu près à une répartition uniforme
    const v = 0.65 * lisse(x, y, 7, 900 + k) + 0.35 * lisse(x, y, 2.6, 950 + k), u = Math.max(0, Math.min(1, (v - 0.2) / 0.6));
    if (u < S[k][1]) return S[k][0];
  }
  return null;
}
/** une essence tirée d'une liste pondérée, r dans [0, 1] */
export function essence(L, r) { let t = 0; for (const [, p] of L) t += p; r *= t; for (const [k, p] of L) { r -= p; if (r < 0) return k; } return L[L.length - 1][0]; }
