// Convoy Storm — icônes de l'interface : pictogrammes Kenney (CC0, convoy/img/icons) et quelques glyphes dessinés ici
// dans le même style (blancs, pleins) pour ce que les packs n'ont pas : fioul, loup, train, aiguillage, paysages…
const K = (f) => `<img class="ic" src="img/icons/${f}.png" alt="" draggable="false">`;
const S = (body) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const L = (d, w = 2) => `<path d="${d}" fill="none" stroke-width="${w}"/>`;

export const IC = {
  // Kenney
  fire: K('fire'), camp: K('campfire'), wood: K('resource_wood'), scrap: K('resource_iron'), hull: K('shield'), time: K('hourglass'),
  flag: K('flag_triangle'), cards: K('cards_fan'), card: K('card'), person: K('character'), skull: K('skull'), sword: K('sword'), gear: K('gear'),
  warn: K('warning'), target: K('target'), wrench: K('wrench'), trophy: K('trophy'), info: K('information'), star: K('star'), home: K('home'),
  menu: K('menuGrid'), audioOn: K('audioOn'), audioOff: K('audioOff'), compass: K('compass'), coin: K('coin'), key: K('key'), check: K('checkmark'),
  cross: K('cross'), pause: K('pause'), crown: K('crown_a'), house: K('structure_house'), tower: K('structure_watchtower'), hand: K('hand'),
  pouch: K('pouch'), boom: K('exploding'), medal: K('medal1'), pawns: K('pawns'), award: K('award'), lock: K('locked'),
  // dessinés ici
  fuel: S('<path d="M7 4h6l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2zm1 2v3h5V6z"/><path d="M17 5l2-2 1.5 1.5-2 2z"/>'),
  gauge: S(L('M4 17a8 8 0 1 1 16 0') + '<path d="M12 17l4.5-6 .8.6-4.2 6.4z"/><circle cx="12" cy="17" r="1.8"/>'),
  speed: S(L('M4 16a8 8 0 0 1 16 0') + '<path d="M12 16l-3-6.5 1-.4 3.6 6.2z"/><circle cx="12" cy="16" r="1.8"/>'),
  train: S('<path d="M5 6h9v4h4l2 3v4H4V8a2 2 0 0 1 1-2zm2 2v3h5V8z"/><rect x="15" y="3" width="2" height="4"/><circle cx="7" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="17.5" cy="19" r="2"/>'),
  wolf: S('<path d="M4 3l4 4h8l4-4v8l-2 4-3 2-3 4-3-4-3-2-2-4zm5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>'),
  snow: S(L('M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7') + L('M9 4l3 2 3-2M9 20l3-2 3 2M4.5 10.5l3.4.3 1.6 2.9M19.5 13.5l-3.4-.3-1.6-2.9M4.5 13.5l3.4-.3 1.6-2.9M19.5 10.5l-3.4.3-1.6 2.9', 1.6)),
  heat: S('<path d="M10 3a2 2 0 0 1 4 0v10.3a4.5 4.5 0 1 1-4 0z" fill="none" stroke-width="2"/><circle cx="12" cy="17" r="2.6"/><rect x="11" y="8" width="2" height="8"/>'),
  fork: S(L('M12 22v-8M12 14L6 4M12 14l6-10', 2.6) + '<path d="M3 5l3-3 3 3zM15 5l3-3 3 3z"/>'),
  storm: S('<path d="M3 10a5 5 0 0 1 9.6-2A4 4 0 1 1 17 16H6a3 3 0 0 1-3-6z"/><path d="M11 14l-2 5h3l-1 4 5-7h-3l2-2z" fill="#16181d"/>'),
  flare: S('<path d="M12 2l1.6 4.6L18 5l-2.4 4L20 11l-4.6 1.4L17 17l-4-2.6L12 19l-1-4.6L7 17l1.6-4.6L4 11l4.4-2L6 5l4.4 1.6z"/>'),
  crate: S('<path d="M4 7l8-4 8 4v10l-8 4-8-4z" fill="none" stroke-width="2"/><path d="M4 7l8 4 8-4M12 11v10" fill="none" stroke-width="2"/>'),
  ladder: S(L('M8 2v20M16 2v20M8 6h8M8 11h8M8 16h8', 2.2)),
  lever: S(L('M7 21h10M12 21l4-14', 2.6) + '<circle cx="16.5" cy="5" r="2.6"/>'),
  axe: S('<path d="M6 21L17 6l1.5 1L7.6 22z"/><path d="M13 4c3-2 6-1 8 1l-4.5 6c-1-2-2.5-3.5-4.5-4z"/>'),
  harpoon: S(L('M3 21L19 5', 2.4) + '<path d="M21 3l-1 6-5-5zM6 15l-3 1 2 2z"/>'),
  survivor: S('<circle cx="12" cy="5" r="3"/><path d="M8 9h8l1 7h-2.5l-.5 6h-4l-.5-6H7z"/>'),
  map: S('<path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z" fill="none" stroke-width="2"/><path d="M9 3v16M15 5v16" fill="none" stroke-width="2"/>'),
  // paysages
  plaine: S(L('M2 18c4-3 7-3 10-1s6 2 10-1', 2.2) + '<circle cx="17" cy="7" r="3"/>'),
  foret: S('<path d="M7 2l5 7H9l4 6H9v4H5v-4H1l4-6H2zM17 5l4 6h-2.5l3.5 5h-4v3h-2v-3h-4l3.5-5H13z"/>'),
  ville: S('<path d="M2 21V9h5v12zM8 21V3h7v18zM16 21v-9h6v9z"/><path d="M10 6h1v2h-1zM12.5 6h1v2h-1zM10 10h1v2h-1zM12.5 10h1v2h-1z" fill="#16181d"/>'),
  lac: S(L('M2 9c3 2 6 2 10 0s7-2 10 0M2 14c3 2 6 2 10 0s7-2 10 0M2 19c3 2 6 2 10 0s7-2 10 0', 2)),
  col: S('<path d="M1 21L9 6l4 6 3-4 7 13z"/><path d="M9 6l2 4-2-1-1.5 2-1-1z" fill="#dfe7f1"/>'),
  usine: S('<path d="M2 21V11l5 3V11l5 3V11l5 3V4h4v17z"/>'),
  toundra: S(L('M9 21v-7M15 21v-7M9 14h6M8 8V3M8 6L5 4M8 6l3-2M16 8V3M16 6l-3-2M16 6l3-2', 2) + '<ellipse cx="12" cy="11" rx="4" ry="3.2"/>'),
  // moments forts
  boss: S('<path d="M2 15V9h9l2-3h6l3 5v4z"/><circle cx="6" cy="17" r="2.4"/><circle cx="17" cy="17" r="2.4"/><path d="M0 15l2-4v4z"/>'),
  bridge: S(L('M2 9h20M2 9v12M22 9v12M6 9v6M10 9v6M14 9v6M18 9v6M2 15h20', 2)),
  wreck: S('<path d="M3 8h12v8H3z"/><path d="M16 10h5v6h-5z" transform="rotate(12 18 13)"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/>'),
  roar: S('<path d="M4 7c3-3 9-3 12 0M2 12c4-4 14-4 18 0M4 17c3-3 9-3 12 0" fill="none" stroke-width="2.4"/>'),
  tunnel: S('<path d="M2 21V11a10 10 0 0 1 20 0v10h-5v-9a5 5 0 0 0-10 0v9z"/>'),
  station: S('<path d="M3 9l9-6 9 6v2H3zM5 12h3v8H5zM10.5 12h3v8h-3zM16 12h3v8h-3zM3 20h18v2H3z"/>'),
  castle: S('<path d="M3 21V8h3v2h2V8h3v2h2V8h3v2h2V8h3v13h-7v-5a2 2 0 0 0-4 0v5z"/>'),
};
export const BIOME_IC = { plaine: 'plaine', foret: 'foret', ville: 'ville', lac: 'lac', col: 'col', usine: 'usine', toundra: 'toundra' };
export const ROLE_IC = ['wrench', 'compass', 'fire', 'target'];
// catégorie de chaque carte d'amélioration : couleur de la carte et pictogramme
export const CARD_CAT = {
  boiler: 'fire', tank: 'fuel', valve: 'gauge', warm: 'heat', coats: 'heat', pistons: 'train', breaker: 'storm', armor: 'hull',
  radar: 'compass', flares: 'flare', longflare: 'flare', net: 'crate', ladder: 'ladder', crampons: 'snow', harness: 'pouch',
  toolkit: 'wrench', crowbar: 'axe', salvage: 'scrap', turret: 'harpoon', workshop: 'gear', dorm: 'survivor',
};
export const ic = (k) => IC[k] || '';
