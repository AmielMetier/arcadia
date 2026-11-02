/* Poké Duel : génère pokemon/engine/roster-gen.js (Pokémon des Gens 1 à 6, attaques, talents, Méga-Évolutions)
   à partir des tables de PokeAPI.   node tools/pokemon-roster.mjs [dossier de cache]
   - chaque évolution finale (légendaires compris) absente du roster fait main y entre, stats au niveau 50 ;
   - les attaques qu'il peut apprendre jusqu'en 6G et que le moteur sait jouer deviennent des attaques du jeu ;
   - 4 attaques choisies : les meilleures de son type, de la couverture, et une attaque de boost ou de soin s'il en a une ;
   - talent : le meilleur de ses talents que le moteur sait jouer ;
   - Méga-Évolutions : toutes celles des Pokémon du roster, avec leur Méga-Gemme. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = process.argv[2] || path.join(ROOT, '.cache-pokeapi');
const BASE = 'https://raw.githubusercontent.com/PokeAPI/api-data/master/data/api/v2/';
fs.mkdirSync(CACHE, { recursive: true });
async function get(p) {
  const f = path.join(CACHE, p.replace(/\//g, '_') + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let i = 0; ; i++) {
    try { const r = await fetch(BASE + p + '/index.json'); if (r.status === 404) return null; if (!r.ok) throw new Error(r.status); const j = await r.json(); fs.writeFileSync(f, JSON.stringify(j)); return j; }
    catch (e) { if (i === 3) throw e; await new Promise((r) => setTimeout(r, 600)); }
  }
}
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }
const idOf = (url) => Number(url.match(/(\d+)\/$/)[1]);
const fr = (o) => (o.names.find((n) => n.language.name === 'fr') || o.names.find((n) => n.language.name === 'en') || { name: o.name }).name;

// données faites main (elles restent prioritaires)
const writeGen = (txt) => fs.writeFileSync(path.join(ROOT, 'pokemon/engine/roster-gen.js'), txt);
writeGen('export const ROSTER_GEN = []; export const MOVES_GEN = {}; export const PICK_GEN = {}; export const MEGAS_GEN = {};\n');
const { POKEMON_ROSTER } = await import('../pokemon/engine/data.js');
const { MOVES } = await import('../pokemon/engine/moves.js');
const { ABILITIES, abilityOf } = await import('../pokemon/engine/abilities.js');
const { MEGAS } = await import('../pokemon/engine/megas.js');
const { getEffectiveness } = await import('../pokemon/engine/types.js');
const HAND = new Set(POKEMON_ROSTER.map((p) => p.id));

// ------------------------------------------------------------------ Pokémon retenus
const GEN = { 'generation-i': 1, 'generation-ii': 2, 'generation-iii': 3, 'generation-iv': 4, 'generation-v': 5, 'generation-vi': 6 };
const ids = Array.from({ length: 721 }, (_, i) => i + 1);
const species = await pool(ids, 24, (id) => get('pokemon-species/' + id));
const chainIds = [...new Set(species.map((s) => idOf(s.evolution_chain.url)))];
const chains = await pool(chainIds, 24, (c) => get('evolution-chain/' + c));
const final = new Set();
const walk = (n) => { const next = n.evolves_to.filter((e) => idOf(e.species.url) <= 721); if (!next.length) final.add(idOf(n.species.url)); next.forEach(walk); };
chains.forEach((c) => walk(c.chain));
const keep = species.filter((s) => final.has(s.id) && !HAND.has(s.id));

// ------------------------------------------------------------------ attaques
const VG6 = new Set(['red-blue', 'yellow', 'gold-silver', 'crystal', 'ruby-sapphire', 'emerald', 'firered-leafgreen', 'diamond-pearl', 'platinum',
  'heartgold-soulsilver', 'black-white', 'black-2-white-2', 'x-y', 'omega-ruby-alpha-sapphire']);
// attaques dont l'effet réel n'est pas joué par le moteur (puissance variable, charge, conditions…) : on les laisse de côté
const SKIP = new Set(('explosion self-destruct focus-punch fake-out sky-attack razor-wind skull-bash dig fly dive bounce phantom-force shadow-force ' +
  'dream-eater future-sight doom-desire last-resort belch synchronoise natural-gift fling trump-card punishment return frustration retaliate payback ' +
  'avalanche revenge pursuit assurance hex venoshock brine stored-power power-trip heavy-slam heat-crash low-kick grass-knot gyro-ball electro-ball ' +
  'eruption water-spout reversal flail crush-grip wring-out magnitude present spit-up beat-up round echoed-voice fusion-flare fusion-bolt relic-song ' +
  'techno-blast judgment hidden-power weather-ball struggle uproar rollout ice-ball fury-cutter bide counter mirror-coat metal-burst endeavor sonic-boom ' +
  'dragon-rage seismic-toss night-shade psywave super-fang final-gambit memento baton-pass circle-throw dragon-tail smack-down thousand-arrows ' +
  'freeze-shock ice-burn sky-drop secret-power false-swipe hold-back feint solar-beam focus-blast me-first snore sleep-talk steel-roller ' +
  'rage pay-day thief covet knock-off acrobatics facade foul-play psycho-shift spit-up shell-trap ' +
  'self-destruct burn-up rapid-spin poison-tail-x hyperspace-hole hyperspace-fury ion-deluge plasma-fists stomp water-shuriken').split(/\s+/));
const RECHARGE = new Set(['hyper-beam', 'giga-impact', 'blast-burn', 'hydro-cannon', 'frenzy-plant', 'rock-wrecker', 'roar-of-time']);
const RAMPAGE = new Set(['outrage', 'thrash', 'petal-dance']);
const AIL = { burn: 'burn', paralysis: 'paralysis', freeze: 'freeze', poison: 'poison', sleep: 'sleep' };
const STAT = { attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe' };
// attaques de statut que le moteur sait jouer
const STATUS_OK = {
  'swords-dance': { type: 'stat', target: 'self', stat: 'atk', val: 2 }, 'nasty-plot': { type: 'stat', target: 'self', stat: 'spa', val: 2 },
  'dragon-dance': { type: 'stat', target: 'self', stat: 'atk', val: 1, stats: { atk: 1, spe: 1 } }, 'calm-mind': { type: 'stat', target: 'self', stat: 'spa', val: 1, stats: { spa: 1, spd: 1 } },
  'quiver-dance': { type: 'stat', target: 'self', stat: 'spa', val: 1, stats: { spa: 1, spd: 1, spe: 1 } }, 'bulk-up': { type: 'stat', target: 'self', stat: 'atk', val: 1, stats: { atk: 1, def: 1 } },
  'shift-gear': { type: 'stat', target: 'self', stat: 'atk', val: 1, stats: { atk: 1, spe: 2 } }, 'coil': { type: 'stat', target: 'self', stat: 'atk', val: 1, stats: { atk: 1, def: 1 } },
  'hone-claws': { type: 'stat', target: 'self', stat: 'atk', val: 1 }, 'work-up': { type: 'stat', target: 'self', stat: 'atk', val: 1, stats: { atk: 1, spa: 1 } },
  'growth': { type: 'stat', target: 'self', stat: 'atk', val: 1, stats: { atk: 1, spa: 1 } }, 'agility': { type: 'stat', target: 'self', stat: 'spe', val: 2 },
  'rock-polish': { type: 'stat', target: 'self', stat: 'spe', val: 2 }, 'iron-defense': { type: 'stat', target: 'self', stat: 'def', val: 2 },
  'amnesia': { type: 'stat', target: 'self', stat: 'spd', val: 2 }, 'cosmic-power': { type: 'stat', target: 'self', stat: 'def', val: 1, stats: { def: 1, spd: 1 } },
  'tail-glow': { type: 'stat', target: 'self', stat: 'spa', val: 3 },
  'recover': { type: 'heal', val: 0.5 }, 'roost': { type: 'heal', val: 0.5 }, 'slack-off': { type: 'heal', val: 0.5 }, 'soft-boiled': { type: 'heal', val: 0.5 },
  'milk-drink': { type: 'heal', val: 0.5 }, 'synthesis': { type: 'heal', val: 0.5 }, 'moonlight': { type: 'heal', val: 0.5 }, 'morning-sun': { type: 'heal', val: 0.5 },
  'heal-order': { type: 'heal', val: 0.5 },
  'will-o-wisp': { type: 'status', status: 'burn', chance: 100 }, 'thunder-wave': { type: 'status', status: 'paralysis', chance: 100 },
  'toxic': { type: 'status', status: 'toxic', chance: 100 }, 'spore': { type: 'status', status: 'sleep', chance: 100 },
  'sleep-powder': { type: 'status', status: 'sleep', chance: 100 }, 'stun-spore': { type: 'status', status: 'paralysis', chance: 100 },
  'glare': { type: 'status', status: 'paralysis', chance: 100 }, 'hypnosis': { type: 'status', status: 'sleep', chance: 100 },
};
const SETUP_PHYS = ['dragon-dance', 'swords-dance', 'shift-gear', 'bulk-up', 'coil', 'hone-claws'];
const SETUP_SPEC = ['quiver-dance', 'nasty-plot', 'calm-mind', 'tail-glow', 'work-up', 'growth'];
const HEALS = ['recover', 'roost', 'slack-off', 'soft-boiled', 'milk-drink', 'synthesis', 'moonlight', 'morning-sun', 'heal-order'];
const STATUSES = ['spore', 'will-o-wisp', 'sleep-powder', 'thunder-wave', 'glare', 'toxic'];

const pokes = await pool(keep.map((s) => s.id), 16, (id) => get('pokemon/' + id));
const moveIds = [...new Set(pokes.flatMap((p) => p.moves.map((m) => idOf(m.move.url))))];
const moveData = new Map((await pool(moveIds, 24, (id) => get('move/' + id))).filter(Boolean).map((m) => [m.name, m]));

// clé des attaques faites main : retrouvée par le nom français
const handKeyByFr = new Map(Object.entries(MOVES).map(([k, m]) => [m.name.toLowerCase().replace(/[-\s']/g, ''), k]));
const norm = (s) => s.toLowerCase().replace(/[-\s'’]/g, '');
const MOVES_GEN = {};
function engineMove(slug) {
  const m = moveData.get(slug);
  if (!m || !GEN[m.generation.name]) return null;
  const hk = handKeyByFr.get(norm(fr(m)));
  if (hk) return hk;
  const key = slug.replace(/-/g, '_');
  if (MOVES[key]) return key;
  if (MOVES_GEN[key]) return key;
  const cls = m.damage_class.name;
  let mv;
  if (cls === 'status') {
    if (!STATUS_OK[slug]) return null;
    mv = { name: fr(m), type: m.type.name, cat: 'status', power: 0, acc: m.accuracy || 100, pp: m.pp || 10, effect: STATUS_OK[slug] };
  } else {
    const meta = m.meta || {};
    if (SKIP.has(slug) || !m.power || m.power < 40 || meta.min_hits || !['damage', 'damage+ailment', 'damage+lower', 'damage+raise', 'damage+heal'].includes(meta.category && meta.category.name)) return null;
    mv = { name: fr(m), type: m.type.name, cat: cls, power: m.power, acc: m.accuracy || 100, pp: m.pp || 10 };
    if (m.priority) mv.priority = m.priority;
    if (meta.crit_rate > 0) mv.crit = 2;
    if (meta.flinch_chance) mv.flinch = meta.flinch_chance;
    if (meta.drain > 0) mv.drain = meta.drain / 100;
    if (meta.drain < 0) mv.recoil = -meta.drain / 100;
    if (RECHARGE.has(slug)) mv.recharge = true;
    if (RAMPAGE.has(slug)) mv.rampage = true;
    const ail = meta.ailment && meta.ailment.name;
    if (AIL[ail]) mv.effect = { type: 'status', status: AIL[ail], chance: meta.ailment_chance || 100 };
    else if (ail === 'confusion') mv.confuse = meta.ailment_chance || 100;
    else if (m.stat_changes && m.stat_changes.length && STAT[m.stat_changes[0].stat.name]) {
      const self = meta.category.name === 'damage+raise';
      const stats = Object.fromEntries(m.stat_changes.filter((c) => STAT[c.stat.name]).map((c) => [STAT[c.stat.name], c.change]));
      const [s0, v0] = Object.entries(stats)[0];
      mv.effect = { type: 'stat', target: self ? 'self' : 'opponent', stat: s0, val: v0, ...(Object.keys(stats).length > 1 ? { stats } : {}) };
      const ch = meta.stat_chance || 0;
      if (ch && ch < 100) mv.effect.chance = ch;
      else if (!self) mv.effect.chance = 100;
    }
  }
  MOVES_GEN[key] = mv;
  return key;
}
const MV = (k) => MOVES[k] || MOVES_GEN[k];

// ------------------------------------------------------------------ choix des 4 attaques
const ALLTYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
function pickMoves(p, st, types) {
  const learn = [...new Set(p.moves.filter((m) => m.version_group_details.some((d) => VG6.has(d.version_group.name))).map((m) => m.move.name))];
  const keys = [...new Set(learn.map(engineMove).filter(Boolean))];
  const phys = st.atk >= st.spa * 1.1, spec = st.spa >= st.atk * 1.1;
  const score = (k) => {
    const m = MV(k); if (!m.power) return 0;
    let s = m.power * (m.acc || 100) / 100 * (types.includes(m.type) ? 1.5 : 1);
    s *= (m.cat === 'physical' ? st.atk : st.spa) / Math.max(st.atk, st.spa);
    if (m.recharge) s *= 0.55; if (m.charge) s *= 0.5; if (m.recoil) s *= 0.92; if (m.rampage) s *= 0.85;
    if (m.effect && m.effect.target === 'self' && m.effect.val < 0) s *= 0.9;
    if (m.drain) s *= 1.08; if (m.priority > 0) s *= 0.9;
    return s;
  };
  const dmg = keys.filter((k) => MV(k).power).sort((a, b) => score(b) - score(a));
  const pick = [];
  for (const t of types) { const b = dmg.find((k) => MV(k).type === t && !pick.includes(k)); if (b) pick.push(b); }
  // une attaque de boost ou de soin, si le Pokémon en a une
  const has = (list) => list.map((s) => engineMove(s) && learn.includes(s) ? engineMove(s) : null).find(Boolean);
  const setup = has(phys ? SETUP_PHYS : spec ? SETUP_SPEC : [...SETUP_PHYS, ...SETUP_SPEC]);
  const heal = has(HEALS);
  const bulky = st.hp + st.def + st.spd > 3 * st.spe + 120;
  const extra = bulky ? (heal || setup) : (setup || heal);
  const slots = extra ? 3 : 4;
  while (pick.length < slots && dmg.length) {
    const covered = (k) => ALLTYPES.filter((t) => [...pick, k].some((x) => getEffectiveness(MV(x).type, [t]) > 1)).length;
    let best = null, bs = -1;
    for (const k of dmg) { if (pick.includes(k) || pick.some((x) => MV(x).type === MV(k).type)) continue; const s = covered(k) * 30 + score(k); if (s > bs) { bs = s; best = k; } }
    if (!best) best = dmg.find((k) => !pick.includes(k));
    if (!best) break;
    pick.push(best);
  }
  if (extra) pick.push(extra);
  if (pick.length < 4) { const st2 = has(STATUSES); if (st2 && !pick.includes(st2)) pick.push(st2); }
  return pick.slice(0, 4);
}

// ------------------------------------------------------------------ talents
const PICK_GEN = {};
function pickAbility(p) {
  const cands = p.abilities.map((a) => a.ability.name).filter((a) => ABILITIES[a]);
  if (!cands.length) return null;
  return cands.sort((a, b) => (ABILITIES[b].score || 0) - (ABILITIES[a].score || 0))[0];
}

// ------------------------------------------------------------------ roster
const lv50 = (b) => ({ hp: Math.floor((2 * b.hp + 31) * 50 / 100) + 60, atk: Math.floor((2 * b.attack + 31) / 2) + 5, def: Math.floor((2 * b.defense + 31) / 2) + 5,
  spa: Math.floor((2 * b['special-attack'] + 31) / 2) + 5, spd: Math.floor((2 * b['special-defense'] + 31) / 2) + 5, spe: Math.floor((2 * b.speed + 31) / 2) + 5 });
const baseOf = (p) => Object.fromEntries(p.stats.map((s) => [s.stat.name, s.base_stat]));
const ROSTER_GEN = [], noAbility = [];
for (const s of keep) {
  const p = pokes.find((x) => x.id === s.id);
  if (!p) continue;
  const stats = lv50(baseOf(p)), types = p.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
  const moves = pickMoves(p, stats, types);
  if (moves.length < 4) { console.warn('moins de 4 attaques :', s.name, moves); if (moves.length < 2) continue; }
  const ab = pickAbility(p);
  if (!ab) { noAbility.push(s.name); continue; }
  PICK_GEN[s.id] = ab;
  ROSTER_GEN.push({ id: s.id, name: fr(s), en: s.name, gen: GEN[s.generation.name], extra: true, legendary: s.is_legendary || s.is_mythical || undefined, types, stats, moves: [...moves], cleanMoves: moves });
}

// ------------------------------------------------------------------ Méga-Évolutions
const MEGAS_GEN = {};
const STONE = { 'venusaur': 'venusaurite', 'charizard-mega-x': 'charizardite-x', 'charizard-mega-y': 'charizardite-y', 'mewtwo-mega-x': 'mewtwonite-x', 'mewtwo-mega-y': 'mewtwonite-y',
  'slowbro': 'slowbronite', 'houndoom': 'houndoominite', 'sableye': 'sablenite', 'altaria': 'altarianite', 'glalie': 'glalitite', 'abomasnow': 'abomasite',
  'lopunny': 'lopunnite', 'gallade': 'galladite', 'audino': 'audinite', 'diancie': 'diancite', 'beedrill': 'beedrillite', 'pidgeot': 'pidgeotite',
  'kangaskhan': 'kangaskhanite', 'pinsir': 'pinsirite', 'aerodactyl': 'aerodactylite', 'steelix': 'steelixite', 'sceptile': 'sceptilite', 'swampert': 'swampertite',
  'mawile': 'mawilite', 'medicham': 'medichamite', 'camerupt': 'cameruptite', 'banette': 'banettite', 'latias': 'latiasite', 'latios': 'latiosite',
  'gengar': 'gengarite', 'scizor': 'scizorite', 'heracross': 'heracronite', 'tyranitar': 'tyranitarite', 'gardevoir': 'gardevoirite', 'absol': 'absolite',
  'salamence': 'salamencite', 'metagross': 'metagrossite', 'garchomp': 'garchompite', 'lucario': 'lucarionite', 'manectric': 'manectite', 'sharpedo': 'sharpedonite',
  'aggron': 'aggronite', 'ampharos': 'ampharosite', 'alakazam': 'alakazite', 'gyarados': 'gyaradosite', 'blastoise': 'blastoisinite', 'blaziken': 'blazikenite' };
const allIds = [...HAND, ...ROSTER_GEN.map((p) => p.id)];
const iconDir = path.join(ROOT, 'pokemon/assets/items');
for (const dex of allIds) {
  const s = species[dex - 1];
  for (const v of s.varieties) {
    const vn = v.pokemon.name; if (!/-mega(-[xy])?$/.test(vn)) continue;
    const pid = idOf(v.pokemon.url);
    if ((MEGAS[dex] || []).some((f) => f.pid === pid)) continue;
    const p = await get('pokemon/' + pid); if (!p) continue;
    const stoneSlug = STONE[vn] || STONE[s.name];
    if (!stoneSlug) { console.warn('pas de Méga-Gemme pour', vn); continue; }
    const item = await get('item/' + stoneSlug);
    const iconFile = path.join(iconDir, stoneSlug + '.png');
    if (!fs.existsSync(iconFile)) {
      const r = await fetch(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${stoneSlug}.png`);
      if (r.ok) fs.writeFileSync(iconFile, Buffer.from(await r.arrayBuffer()));
    }
    const icon = fs.existsSync(iconFile) ? `assets/items/${stoneSlug}.png` : 'assets/items/charizardite-x.png';
    const pf = await get('pokemon-form/' + idOf(p.forms[0].url));
    const formName = pf && pf.names && pf.names.find((n) => n.language.name === 'fr') ? pf.names.find((n) => n.language.name === 'fr').name : `Méga-${fr(s)}`;
    const types = p.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
    const stats = lv50(baseOf(p)); stats.hp = lv50(baseOf(await get('pokemon/' + dex))).hp;
    (MEGAS_GEN[dex] = MEGAS_GEN[dex] || []).push({ pid, name: formName, stone: 'mega_' + pid, stoneName: item ? fr(item) : stoneSlug, icon, types, stats });
    PICK_GEN[pid] = pickAbility(p);
  }
}

// ------------------------------------------------------------------ écriture
// talent : on garde les choix faits main pour les Pokémon d'origine
for (const k of Object.keys(PICK_GEN)) if (abilityOf(Number(k)) !== null && abilityOf(Number(k)) !== undefined) delete PICK_GEN[k];
const out = `// pokemon/engine/roster-gen.js — FICHIER GÉNÉRÉ par tools/pokemon-roster.mjs (tables de PokeAPI), ne pas modifier à la main.
// Pokémon des Gens 1 à 6 ajoutés au roster fait main, leurs attaques, talents et Méga-Évolutions.
export const MOVES_GEN = ${JSON.stringify(MOVES_GEN)};
export const ROSTER_GEN = ${JSON.stringify(ROSTER_GEN)};
export const PICK_GEN = ${JSON.stringify(PICK_GEN)};
export const MEGAS_GEN = ${JSON.stringify(MEGAS_GEN)};
`;
writeGen(out);
console.log(`${ROSTER_GEN.length} Pokémon ajoutés (${HAND.size} faits main), ${Object.keys(MOVES_GEN).length} nouvelles attaques, ${Object.values(MEGAS_GEN).flat().length} nouvelles Méga.`);
if (noAbility.length) console.log('Sans talent jouable (laissés de côté) :', noAbility.join(', '));
