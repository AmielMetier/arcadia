// odyssee/js/dojo-mamadou.js — Dojo de Mamadou (Port-Granit, dès le 6e Badge) :
// Donjon / Tour de combat exclusivement multijoueur en Duo Co-op (2 humains vs 2 bots) et Trio Co-op (3 humains vs 3 bots),
// avec 1 Pokémon actif sur le terrain par joueur, bots à IA hyperstratégique, Points du Dojo (PDj) et Boutique.

import { SPECIES } from './data/species.js';
import { MOVES } from './data/moves.js';
import { ITEMS, itemName } from './core/items.js';
import { createMon, monName, isFainted } from './core/mon.js';
import { Battle } from './core/battle.js';
import { battleCopy, validMon } from './core/pvp.js';
import { partyScreen } from './ui/screens.js';
import { seededRng, newId } from './net/link.js';
import { MEGA_RING } from './core/mega.js';
import { wait } from './ui/ui.js';

/** État persistant du Dojo sur la sauvegarde du joueur */
export function ensureDojo(st) {
  return (st.dojo ||= { pdj: 0, serie2: 0, record2: 0, serie3: 0, record3: 0, wins: 0 });
}

/** Boutique du Dojo de Mamadou : [idObjet, prix en PDj] */
export const DOJO_BOUTIQUE = [
  ['full-restore', 2],
  ['sitrus-berry', 3],
  ['lum-berry', 3],
  ['white-herb', 4],
  ['rare-candy', 4],
  ['focus-sash', 6],
  ['expert-belt', 6],
  ['rocky-helmet', 6],
  ['eviolite', 6],
  ['leftovers', 8],
  ['life-orb', 8],
  ['choice-band', 8],
  ['choice-specs', 8],
  ['choice-scarf', 8],
  ['assault-vest', 8],
  ['garchompite', 18],
  ['lucarionite', 18],
  ['metagrossite', 18],
  ['master-ball', 25],
].filter(([k]) => ITEMS[k]);

/**
 * 6 archétypes hyperstratégiques du Dojo (6e = Maître Mamadou en boss final).
 * Chaque entrée fournit 6 Pokémon [sp, item, ability, moves] :
 * en Duo (2v2), les 4 premiers sont utilisés (2 sur le terrain + 2 en réserve) ;
 * en Trio (3v3), les 6 entrent en jeu (3 sur le terrain + 3 en réserve).
 */
export const DOJO_ARCHETYPES = [
  {
    id: 'seismic',
    cls: 'Duo Sismique',
    name: 'Yanis & Maëlys',
    ow: 'montagnard',
    bs: 'montagnard',
    intro: 'Nos attaques de zone frappent les adversaires sans jamais blesser nos alliés volants !',
    lose: 'Quelle maîtrise du placement ! Même nos Séismes n\'ont pas suffi…',
    team: [
      [445, 'focus-sash', 'rough-skin', [89, 337, 157, 182]],        // Carchacrok : Séisme, Dracogriffe, Éboulement, Abri
      [330, 'choice-scarf', 'levitate', [89, 200, 157, 257]],         // Libégon (Lévitation)
      [468, 'leftovers', 'serene-grace', [403, 585, 113, 182]],       // Togekiss (Vol + Mur Lumière)
      [149, 'lum-berry', 'multiscale', [349, 337, 245, 89]],         // Dracolosse (Multécaille)
      [373, 'life-orb', 'intimidate', [200, 53, 89, 182]],           // Drattak (Intimidation)
      [479, 'sitrus-berry', 'levitate', [435, 247, 261, 182]],        // Motisma (Lévitation + Coup d'Jus)
    ],
  },
  {
    id: 'screens',
    cls: 'Maîtres des Écrans',
    name: 'Olympe & Basile',
    ow: 'medium',
    bs: 'medium',
    intro: 'Nos barrières psychiques et nos altérations d\'état vont étouffer votre offensive.',
    lose: 'Vous avez percé toutes nos défenses… Impressionnant travail d\'équipe.',
    team: [
      [196, 'leftovers', 'magic-bounce', [115, 113, 94, 247]],        // Mentali : Protection + Mur Lumière
      [197, 'rocky-helmet', 'inner-focus', [242, 92, 236, 182]],      // Noctali : Toxik + Rayon Lune + Abri
      [282, 'choice-specs', 'trace', [585, 473, 247, 85]],            // Gardevoir : Pouvoir Lunaire + Choc Psy
      [579, 'life-orb', 'magic-guard', [94, 411, 105, 182]],          // Symbios
      [143, 'assault-vest', 'thick-fat', [34, 89, 242, 7]],           // Ronflex
      [442, 'sitrus-berry', 'pressure', [261, 399, 425, 182]],        // Spiritomb
    ],
  },
  {
    id: 'storm',
    cls: 'Stratèges des Ondes',
    name: 'Dorian & Wendy',
    ow: 'topdresseur',
    bs: 'topdresseur',
    intro: 'Eau trouble et décharges synchronisées : la tempête balaie votre camp !',
    lose: 'Vos liens ont résisté à la houle et à la foudre. Chapeau !',
    team: [
      [260, 'leftovers', 'torrent', [330, 89, 58, 182]],              // Laggron (Sol -> immunisé Coup d'Jus)
      [350, 'sitrus-berry', 'marvel-scale', [503, 58, 105, 182]],     // Milobellus
      [462, 'assault-vest', 'sturdy', [435, 430, 521, 59]],           // Magnézone (Coup d'Jus + Blizzard)
      [131, 'leftovers', 'water-absorb', [56, 59, 85, 182]],          // Lokhlass (Absorb Eau)
      [658, 'life-orb', 'protean', [56, 399, 58, 453]],               // Amphinobi
      [1003, 'rocky-helmet', null, [503, 202, 196, 182]],             // Capysaule
    ],
  },
  {
    id: 'blaze',
    cls: 'Gardiens du Brasier',
    name: 'Kenza & Hugo',
    ow: 'topdresseuse',
    bs: 'topdresseuse',
    intro: 'Intimidation, Spore et Canicule croisée… Voyons si vous tenez la chaleur du Dojo !',
    lose: 'Même nos flammes les plus vives n\'ont pas brisé votre cohésion !',
    team: [
      [59, 'sitrus-berry', 'intimidate', [257, 245, 261, 182]],       // Arcanin
      [1022, 'rocky-helmet', null, [147, 202, 188, 182]],             // Champitron (Spore + Giga-Sangsue)
      [637, 'focus-sash', 'flame-body', [257, 202, 542, 182]],        // Pyrax
      [609, 'choice-specs', 'flash-fire', [257, 247, 412, 53]],       // Lugulabre (Torche -> immunisé Canicule/Ébullilave)
      [1006, 'life-orb', null, [53, 399, 417, 182]],                  // Lustrelle
      [467, 'assault-vest', 'flame-body', [53, 85, 411, 257]],        // Maganon
    ],
  },
  {
    id: 'bastion',
    cls: 'Forteresse d\'Acier',
    name: 'Valère & Céleste',
    ow: 'scientifique',
    bs: 'scientifique',
    intro: 'Priorités acérées, Contre-Attaque et pressions combinées : chaque erreur se paie cash.',
    lose: 'Une faille trouvée à force de solidarité… Respect !',
    team: [
      [212, 'life-orb', 'technician', [418, 404, 14, 182]],           // Cizayox (Pisto-Poing Technicien)
      [681, 'leftovers', null, [430, 247, 425, 197]],                 // Exagide
      [530, 'focus-sash', 'mold-breaker', [89, 442, 157, 182]],       // Minotaupe
      [248, 'assault-vest', 'sand-stream', [157, 242, 89, 8]],        // Tyranocif
      [598, 'rocky-helmet', 'iron-barbs', [438, 442, 86, 182]],       // Noacier
      [625, 'choice-band', 'inner-focus', [442, 400, 280, 157]],      // Scalproie
    ],
  },
  {
    id: 'mamadou',
    cls: 'Maître du Dojo',
    name: 'Mamadou',
    ow: 'karateka',
    bs: 'karateka',
    intro: 'Vous avez atteint le sommet de mon Dojo ! Montrez-moi l\'harmonie parfaite entre vos Pokémon et votre escouade !',
    lose: 'Magnifique ! Vous avez compris la vraie voie du combat en équipe !',
    team: [
      [448, 'lucarionite', 'inner-focus', [370, 418, 245, 182]],      // Méga-Lucario (Close Combat + Pisto-Poing + Vit. Extrême + Abri)
      [445, 'lum-berry', 'rough-skin', [89, 337, 157, 182]],          // Carchacrok (Séisme + Dracogriffe + Éboulement + Abri)
      [376, 'assault-vest', 'clear-body', [442, 428, 418, 89]],       // Métalosse (Tête de Fer + Psykoud'Boul + Pisto-Poing + Séisme)
      [1009, 'leftovers', null, [430, 503, 58, 182]],                 // Narvaillant
      [635, 'choice-specs', 'levitate', [399, 257, 430, 411]],        // Trioxhydre (Lévitation)
      [149, 'sitrus-berry', 'multiscale', [349, 337, 245, 89]],       // Dracolosse (Vol + Multécaille)
    ],
  },
];

/**
 * Construit le défi bot déterministe pour un palier `stage` (0..4 : 0..3 = pré-étages stratégiques, 4 = Boss Maître Mamadou).
 */
export function buildDojoBotChallenge(stage, format = 'double', lvl = 55, seed = 1) {
  const slots = format === 'triple' ? 3 : 2;
  const count = slots === 3 ? 6 : 4;
  const stageSeed = (seed ^ ((stage + 1) * 0x9e3779b9)) >>> 0;
  const r = seededRng(stageSeed);
  let arch;
  if (stage >= 4) {
    arch = DOJO_ARCHETYPES[5];
  } else {
    const poolIdx = [0, 1, 2, 3, 4];
    for (let k = poolIdx.length - 1; k > 0; k--) {
      const j = Math.floor(r() * (k + 1));
      [poolIdx[k], poolIdx[j]] = [poolIdx[j], poolIdx[k]];
    }
    arch = DOJO_ARCHETYPES[poolIdx[stage]];
  }
  const scaledLvl = Math.max(50, lvl + (stage >= 4 ? 2 : 0));
  const party = arch.team.slice(0, count).map(([sp, item, ability, mvIds]) => {
    const validMoves = mvIds.filter((id) => MOVES[id]);
    return createMon(sp, scaledLvl, {
      iv: [31, 31, 31, 31, 31, 31],
      nat: 0,
      moves: validMoves,
      item: item && ITEMS[item] ? item : null,
      ability: ability || null,
      shiny: false,
      rng: r,
    });
  });
  return {
    archId: arch.id,
    name: `${arch.cls} ${arch.name}`,
    party,
    trainer: {
      cls: arch.cls,
      name: arch.name,
      ow: arch.ow,
      bs: arch.bs,
      ai: 'smart',
      strategic: true,
      friendly: true,
      mega: stage >= 4,
      prize: 0,
      items: stage >= 3 ? { 'full-restore': 1 } : {},
      intro: arch.intro,
      lose: arch.lose,
    },
  };
}

/**
 * Assemble l'équipe combinée des joueurs dans l'ordre exact des slots actifs (`leads` puis `benches`)
 * afin que `initSide` place chaque joueur sur son propre emplacement (`0`, `1`, `2`).
 */
export function buildCoopSquadParty(rosters) {
  const party = [];
  const owners = [];
  const ownerNames = rosters.map((r) => String(r.name || 'Dresseur').slice(0, 12));
  const maxLen = Math.max(...rosters.map((r) => r.mons.length));
  for (let k = 0; k < maxLen; k++) {
    for (let p = 0; p < rosters.length; p++) {
      const m = rosters[p].mons[k];
      if (!m) continue;
      party.push(battleCopy([m])[0]);
      owners.push(p);
    }
  }
  return { party, owners, ownerNames };
}

/**
 * Moteur de combat Co-op du Dojo de Mamadou (2 ou 3 joueurs humains sur `side 0` vs bots hyperstratégiques sur `side 1`).
 * Chaque joueur ne contrôle que son emplacement (`mySlot`) et ne peut rappeler en combat que sa propre réserve.
 */
export class CoopDojoBattle extends Battle {
  constructor(o) {
    super({
      player: { name: o.squadName || 'Escouade Co-op', party: o.party, bag: {} },
      foe: { name: o.foe.name, party: o.foe.party, trainer: o.foe.trainer },
      rng: seededRng(o.seed >>> 0),
      format: o.format || (o.slots === 3 ? 'triple' : 'double'),
      slots: o.slots,
    });
    this.coop = true;
    this.pvp = true;
    this.owners = o.owners || [];
    this.ownerNames = o.ownerNames || [];
    this.rosterMega = o.rosterMega || [];
    this.mySlot = o.mySlot ?? 0;
    this.sides[0].mega = !!o.playerMega;
    this.sides[1].mega = !!o.foe.trainer?.mega;
    this.need = [false, false];
    this.needSlots = [[], []];
  }

  canMega(ref) {
    const r = this.norm(ref);
    if (r.side === 0 && this.rosterMega.length && !this.rosterMega[r.slot]) return false;
    return super.canMega(ref);
  }

  eotOrder() { return [0, 1]; }
  tie(p, q) {
    const ps = p.i ?? p.side, qs = q?.i ?? q?.side;
    if (qs != null && ps !== qs) return ps - qs;
    return (p.slot ?? 0) - (q.slot ?? 0);
  }

  canSwitchTo(idx, slot = this.mySlot) {
    const m = this.sides[0].party[idx];
    return !!m && m.hp > 0 && !this.sides[0].activeSlots.includes(idx) && this.owners[idx] === slot;
  }

  awardExp() { /* Combat de tournoi Co-op sans gain d'expérience */ }

  checkFaints(midTurn = false) {
    for (const i of [1, 0]) {
      for (let slot = 0; slot < this.slots; slot++) {
        const m = this.monAt(i, slot);
        if (m && isFainted(m) && !m._ko) {
          m._ko = true;
          this.ev.push({ t: 'faint', side: i, slot });
          this.say(`${i === 1 ? this.Nm({ side: 1, slot }) : monName(m)} est K.O. !`);
        }
      }
    }
    const left = (i) => this.sides[i].party.some((m) => m.hp > 0);
    if (!left(0) && !left(1)) { this.say('Plus personne n\'est en état de se battre !'); this.end('draw'); return true; }
    if (!left(0)) { this.loseBattle(); return true; }
    if (!left(1)) { this.winBattle(); return true; }

    if (midTurn) return false;

    const foeBench = [];
    this.sides[1].party.forEach((m, idx) => { if (m && m.hp > 0 && !this.sides[1].activeSlots.includes(idx)) foeBench.push(idx); });
    const pendingFoe = [];
    for (let sl = 0; sl < this.slots; sl++) {
      const m = this.monAt(1, sl);
      if (m && isFainted(m)) {
        if (foeBench.length) {
          const idx = this.foePickBestReplacement(sl, foeBench);
          const k = foeBench.indexOf(idx);
          if (k >= 0) foeBench.splice(k, 1); else foeBench.shift();
          this.doSwitchSlot(1, sl, idx, true, false);
          pendingFoe.push({ side: 1, slot: sl });
        } else {
          this.sides[1].activeSlots[sl] = -1;
        }
      }
    }

    const needMe = [];
    for (let sl = 0; sl < this.slots; sl++) {
      const m = this.monAt(0, sl);
      if (m && isFainted(m)) {
        const hasOwnBench = this.sides[0].party.some((bm, idx) => this.owners[idx] === sl && bm && bm.hp > 0 && !this.sides[0].activeSlots.includes(idx));
        if (hasOwnBench) needMe.push(sl);
        else this.sides[0].activeSlots[sl] = -1;
      }
    }

    if (needMe.length) {
      this.needPlayerSlots = needMe;
      this.needSlots = [needMe, []];
      this.need = [true, false];
      this.pendingFoeSlots = pendingFoe;
      this.state = 'switch';
      this.ev.push({ t: 'switch-prompt', slots: [...needMe] });
      return true;
    }

    if (pendingFoe.length) {
      for (const r of this.sortBySpeed(pendingFoe)) this.triggerEntry(r);
    }
    return false;
  }

  /** Remplacements simultanés des joueurs humains ayant besoin d'envoyer leur remplaçant */
  switchCoop(picksBySlot = {}) {
    if (this.state !== 'switch') return [];
    this.ev = [];
    const switched = [];
    const party = this.sides[0].party;
    for (const sl of this.needPlayerSlots) {
      let idx = picksBySlot[sl];
      if (idx == null || this.owners[idx] !== sl || !party[idx] || party[idx].hp <= 0 || this.sides[0].activeSlots.includes(idx)) {
        idx = party.findIndex((m, j) => this.owners[j] === sl && m && m.hp > 0 && !this.sides[0].activeSlots.includes(j));
      }
      if (idx >= 0) {
        this.doSwitchSlot(0, sl, idx, true, false);
        switched.push({ side: 0, slot: sl });
      } else {
        this.sides[0].activeSlots[sl] = -1;
      }
    }
    this.needPlayerSlots = [];
    this.need = [false, false];
    this.needSlots = [[], []];
    for (const p of this.pendingFoeSlots) switched.push(p);
    this.pendingFoeSlots = [];
    if (switched.length) {
      for (const r of this.sortBySpeed(switched)) this.triggerEntry(r);
    }
    this.state = 'choose';
    return this.flush();
  }

  winBattle() {
    const t = this.sides[1].trainer;
    this.ev.push({ t: 'trainer-back' });
    this.say(`Votre escouade a vaincu ${t?.name || this.sides[1].name} !`);
    if (t?.lose) for (const l of [].concat(t.lose)) this.ev.push({ t: 'msg', text: l, speaker: t.name });
    this.end('win');
  }

  loseBattle() {
    this.say('Votre escouade n\'a plus de Pokémon en forme !');
    this.say(`${this.sides[1].name} remporte ce défi du Dojo !`);
    this.end('lose');
  }

  stop(result, text) {
    this.ev = [];
    if (text) this.say(text);
    this.end(result);
    return this.flush();
  }

  checksum() {
    const parts = [];
    for (const s of this.sides) {
      parts.push(...s.activeSlots, ...s.party.map((m) => `${m.hp}${(m.status === 'tox' ? 'psn' : m.status) || ''}`), ...s.vs.map((v) => v.st.join('')));
    }
    parts.push(this.turn, this.state);
    let h = 0x811c9dc5;
    const str = parts.join('|');
    for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16);
  }
}

/* ======================================================================
   Boutique du Dojo (Points du Dojo · PDj)
   ====================================================================== */
export async function dojoBoutique(game, n) {
  const st = game.state, ui = game.ui, D = ensureDojo(st);
  const who = { speaker: 'Intendant Kaito', face: n?.sprite || 'vendeur' };
  await ui.say(`Bienvenue au comptoir des récompenses du Dojo ! Tu possèdes actuellement ${D.pdj} PDj.`, who);
  for (;;) {
    const i = await ui.list({
      title: `Boutique du Dojo (${D.pdj} PDj)`,
      items: DOJO_BOUTIQUE.map(([k, p]) => ({ label: itemName(k), right: `${p} PDj` })).concat([{ label: 'Quitter' }]),
      cancel: DOJO_BOUTIQUE.length,
    });
    if (i < 0 || i >= DOJO_BOUTIQUE.length) return;
    const [k, p] = DOJO_BOUTIQUE[i];
    if (D.pdj < p) { await ui.say(`Il te faut ${p} PDj pour obtenir ${itemName(k)}.`, who); continue; }
    if (!(await ui.yesNo(`Échanger ${p} PDj contre ${itemName(k)} ?`, who))) continue;
    D.pdj -= p;
    game.give(k, 1);
    game.sound.sfx('item');
    game.save(true);
    await ui.say(`Tu reçois ${itemName(k)} ! Il te reste ${D.pdj} PDj.`, who);
  }
}

/* ======================================================================
   Sélection des 2 Pokémon du joueur (1 Titulaire sur le terrain + 1 Réserve)
   ====================================================================== */
async function pickDojoPair(game, who) {
  const lead = await partyScreen(game, {
    mode: 'pick',
    prompt: 'Choisis ton Pokémon titulaire (sur le terrain) :',
    filter: (m) => (m.hp <= 0 ? 'K.O.' : null),
  });
  if (lead < 0) return null;
  const bench = await partyScreen(game, {
    mode: 'pick',
    prompt: 'Choisis ton Pokémon remplaçant (en réserve) :',
    filter: (m, idx) => (m.hp <= 0 ? 'K.O.' : idx === lead ? 'Titulaire' : null),
  });
  if (bench < 0) return null;
  const party = game.state.party;
  if (!party[lead] || !party[bench]) return null;
  await game.ui.say(`${monName(party[lead])} sera ton titulaire, soutenu par ${monName(party[bench])} en réserve.`, who);
  return battleCopy([party[lead], party[bench]]);
}

/* ======================================================================
   Attente multijoueur multi-pairs coordonnée par l'hôte (2 ou 3 joueurs)
   ====================================================================== */
async function hostWaitAll(game, peerIds, predFn, waitText, allowAbort = true) {
  const link = game.link, ui = game.ui;
  const box = ui.dialogBox();
  ui.typePage(box, `${waitText}${allowAbort ? ' (Échap : annuler)' : ''}`, { last: true });
  await wait(30);
  const pop = allowAbort ? game.input.push((k) => { if (k === 'b' || k === 'cancel') for (const pid of peerIds) link.abort(pid); }) : () => {};
  try {
    const res = await Promise.all(peerIds.map((pid) => link.wait(pid, predFn(pid), 180000).then((m) => ({ pid, m }))));
    return res;
  } finally {
    pop();
    ui.closeDialog();
  }
}

async function guestWaitHost(game, hostId, pred, waitText, allowAbort = true) {
  const link = game.link, ui = game.ui;
  const box = ui.dialogBox();
  ui.typePage(box, `${waitText}${allowAbort ? ' (Échap : annuler)' : ''}`, { last: true });
  await wait(30);
  const pop = allowAbort ? game.input.push((k) => { if (k === 'b' || k === 'cancel') link.abort(hostId); }) : () => {};
  try {
    return await link.wait(hostId, pred, 180000);
  } finally {
    pop();
    ui.closeDialog();
  }
}

/**
 * Exécute la série de 5 combats Co-op sur un client (hôte mySlot===0, ou invité mySlot===1|2)
 */
async function runDojoSeries(game, { rid, format, rosters, mySlot, hostId, peerIds, lvl, seedBase }) {
  const ui = game.ui, link = game.link, st = game.state, D = ensureDojo(st);
  const slots = format === 'triple' ? 3 : 2;
  const isHost = mySlot === 0;
  const who = { speaker: 'Maître Mamadou', face: 'karateka' };
  const playerMega = rosters.some((r) => !!r.hasMega);
  const rosterMega = rosters.map((r) => !!r.hasMega);
  const ownerNames = rosters.map((r) => String(r.name || 'Dresseur').slice(0, 12));

  const sendQuitToRoom = (why = 'quit') => {
    if (isHost) {
      for (const pid of peerIds) link.send(pid, { t: 'dojo', rid, step: 'quit', who: st.name, why });
    } else {
      link.send(hostId, { t: 'dojo', rid, step: 'quit', slot: mySlot, who: st.name, why });
    }
  };

  for (let stage = 0; stage < 5; stage++) {
    const { party: freshParty, owners: stageOwners, ownerNames: stageNames } = buildCoopSquadParty(rosters);
    const foeChallenge = buildDojoBotChallenge(stage, format, lvl, seedBase);
    const stageSeed = (seedBase ^ ((stage + 1) * 0x45d9f3b)) >>> 0;
    const floorLabel = stage === 4 ? 'Finale — Maître Mamadou' : `Palier ${stage + 1}/5`;
    await ui.say(`${floorLabel} (${slots === 3 ? 'Trio 3v3' : 'Duo 2v2'}) contre ${foeChallenge.name} !`, who);

    const battle = new CoopDojoBattle({
      squadName: ownerNames.join(' & '),
      party: freshParty,
      owners: stageOwners,
      ownerNames: stageNames,
      rosterMega,
      mySlot,
      playerMega,
      foe: foeChallenge,
      format,
      slots,
      seed: stageSeed,
    });

    const peerNameBySlot = (sl) => ownerNames[sl] || `Dresseur ${sl + 1}`;
    const waitTurnMsg = (box) => ui.typePage(box, 'En attente des choix de ton escouade…', { last: true });

    const coopNet = {
      foeName: foeChallenge.name,
      sendAct: async (n, action, sum) => {
        if (!isHost) link.send(hostId, { t: 'dojo', rid, step: 'act', n, slot: mySlot, action, sum });
      },
      waitAllActs: async (n, myAction, mySum, onWaitUi) => {
        if (isHost) {
          onWaitUi?.();
          const allActs = [{ ...myAction, slot: 0 }];
          let failed = null;
          const res = await Promise.all(peerIds.map((pid, idx) => link.wait(pid, (q) => q.t === 'dojo' && q.rid === rid && ((q.step === 'act' && q.n === n) || q.step === 'quit'), 300000).then((q) => ({ pid, sl: idx + 1, q }))));
          for (const { pid, sl, q } of res) {
            if (q.t !== 'dojo' || q.step === 'quit') {
              failed = { left: q.t === 'left', timeout: q.t === 'timeout', abort: q.t === 'abort', quit: q.step === 'quit', who: q.who || peerNameBySlot(sl) };
              break;
            }
            if (q.sum !== mySum) {
              failed = { desync: true };
              break;
            }
            allActs.push({ ...q.action, slot: sl });
          }
          if (failed) {
            for (const pid of peerIds) link.send(pid, { t: 'dojo', rid, step: 'turn-abort', n, ...failed });
            return failed;
          }
          allActs.sort((a, b) => a.slot - b.slot);
          for (const pid of peerIds) link.send(pid, { t: 'dojo', rid, step: 'turn', n, acts: allActs, sum: mySum });
          return { acts: allActs };
        }
        onWaitUi?.();
        const msg = await link.wait(hostId, (q) => q.t === 'dojo' && q.rid === rid && (((q.step === 'turn' || q.step === 'turn-abort') && q.n === n) || q.step === 'quit'), 300000);
        if (msg.t !== 'dojo') return { left: msg.t === 'left', timeout: msg.t === 'timeout', abort: msg.t === 'abort', who: ownerNames[0] };
        if (msg.step === 'quit' || msg.step === 'turn-abort') return { quit: true, desync: !!msg.desync, left: !!msg.left, who: msg.who || ownerNames[0] };
        if (msg.sum !== mySum) return { desync: true };
        return { acts: msg.acts };
      },
      sendSwitch: async (n, idxOrNull) => {
        if (!isHost) link.send(hostId, { t: 'dojo', rid, step: 'sw', n, slot: mySlot, idx: idxOrNull });
      },
      waitAllSwitches: async (n, neededSlots, myPickIdx, onWaitUi) => {
        if (isHost) {
          onWaitUi?.();
          const needGuests = [];
          peerIds.forEach((pid, idx) => {
            const sl = idx + 1;
            if (neededSlots.includes(sl)) needGuests.push({ pid, sl });
          });
          const picks = {};
          if (neededSlots.includes(0) && myPickIdx != null) picks[0] = myPickIdx;
          let failed = null;
          if (needGuests.length) {
            const res = await Promise.all(needGuests.map(({ pid, sl }) => link.wait(pid, (q) => q.t === 'dojo' && q.rid === rid && ((q.step === 'sw' && q.n === n) || q.step === 'quit'), 300000).then((q) => ({ sl, q }))));
            for (const { sl, q } of res) {
              if (q.t !== 'dojo' || q.step === 'quit') {
                failed = { left: q.t === 'left', timeout: q.t === 'timeout', abort: q.t === 'abort', quit: q.step === 'quit', who: q.who || peerNameBySlot(sl) };
                break;
              }
              picks[sl] = q.idx;
            }
          }
          if (failed) {
            for (const pid of peerIds) link.send(pid, { t: 'dojo', rid, step: 'sw-abort', n, ...failed });
            return failed;
          }
          for (const pid of peerIds) link.send(pid, { t: 'dojo', rid, step: 'sw-go', n, picks });
          return { picks };
        }
        onWaitUi?.();
        const msg = await link.wait(hostId, (q) => q.t === 'dojo' && q.rid === rid && (((q.step === 'sw-go' || q.step === 'sw-abort') && q.n === n) || q.step === 'quit'), 300000);
        if (msg.t !== 'dojo') return { left: msg.t === 'left', timeout: msg.t === 'timeout', abort: msg.t === 'abort', who: ownerNames[0] };
        if (msg.step === 'quit' || msg.step === 'sw-abort') return { quit: true, left: !!msg.left, who: msg.who || ownerNames[0] };
        return { picks: msg.picks };
      },
      sendQuit: () => sendQuitToRoom('forfeit'),
      abortAllWaiters: () => {
        if (isHost) for (const pid of peerIds) link.abort(pid);
        else link.abort(hostId);
      },
      waitUiHint: waitTurnMsg,
    };

    const realParty = st.party;
    const curtain = await game.encounterIntro('trainer');
    game.musicLock = true;
    game.sound.play(stage >= 4 ? 'champion' : 'leader');
    curtain.remove();
    game.bv.pvp = true;
    st.party = battle.sides[0].party;
    let res;
    try {
      res = await game.bv.runCoopDojo(battle, coopNet, { bg: 'gym', night: false });
    } finally {
      st.party = realParty;
      game.bv.pvp = false;
      game.bv.close();
      game.musicLock = false;
    }
    game.sound.stopMusic(0.1);
    game.sound.current = null;
    game.updateZone();

    if (res !== 'win') {
      if (slots === 3) D.serie3 = 0; else D.serie2 = 0;
      game.save(true);
      await ui.say('La série Co-op s\'arrête ici, mais vos Points du Dojo déjà gagnés restent acquis !', who);
      return;
    }

    D.wins++;
    if (slots === 3) { D.serie3++; D.record3 = Math.max(D.record3, D.serie3); }
    else { D.serie2++; D.record2 = Math.max(D.record2, D.serie2); }
    const stagePdj = (slots === 3 ? 3 : 2) + Math.floor(stage / 2);
    const finishBonus = stage === 4 ? (slots === 3 ? 8 : 5) : 0;
    const gained = stagePdj + finishBonus;
    D.pdj += gained;
    game.save(true);
    game.sound.sfx('item');
    await ui.say([
      stage === 4 ? `Victoire légendaire contre Maître Mamadou !` : `Palier ${stage + 1}/5 remporté !`,
      `Tu gagnes ${gained} PDj (total : ${D.pdj} PDj).`,
    ], who);

    if (stage < 4) {
      const wantContinue = await ui.yesNo('Passer au palier suivant avec l\'escouade ? (Non met fin à la série ici)', who);
      if (!isHost) {
        link.send(hostId, { t: 'dojo', rid, step: 'next', stage, ok: wantContinue, who: st.name });
        const sync = await guestWaitHost(game, hostId, (q) => q.t === 'dojo' && q.rid === rid && q.step === 'next-go' && q.stage === stage, 'Décision de l\'escouade…', false);
        if (sync.t !== 'dojo' || !sync.ok) {
          await ui.say('L\'escouade met fin à la série pour l\'instant. À bientôt !', who);
          return;
        }
      } else {
        const resNext = await hostWaitAll(game, peerIds, (pid) => (q) => q.t === 'dojo' && q.rid === rid && q.step === 'next' && q.stage === stage, 'En attente de la décision des alliés…', false);
        const allOk = wantContinue && resNext.every(({ m }) => m.t === 'dojo' && m.ok);
        for (const pid of peerIds) link.send(pid, { t: 'dojo', rid, step: 'next-go', stage, ok: allOk });
        if (!allOk) {
          await ui.say('La série s\'arrête sur un accord de l\'escouade. Revenez quand vous voulez !', who);
          return;
        }
      }
    }
  }
  await ui.say([
    'Extraordinaire coordination ! Vous avez triomphé des cinq paliers du Dojo de Mamadou !',
    'Va voir l\'Intendant Kaito pour dépenser tes PDj !',
  ], who);
}

/* ======================================================================
   PNJ Principal : Maître Mamadou (script 'dojoMamadou')
   ====================================================================== */
export async function dojoMamadou(game, n) {
  const st = game.state, ui = game.ui, D = ensureDojo(st);
  const who = { speaker: 'Maître Mamadou', face: n?.sprite || 'karateka' };
  await ui.say([
    `Bienvenue dans mon Dojo, ${st.name} ! Ici, la stratégie collective prime sur la force brute.`,
    `Tu as ${D.pdj} Point${D.pdj > 1 ? 's' : ''} du Dojo (PDj). Records — Duo 2v2 : ${D.record2} · Trio 3v3 : ${D.record3}.`,
  ], who);
  const choice = await ui.ask('Que souhaites-tu faire ?', ['Relever un défi Co-op (2v2 / 3v3)', 'Échanger des PDj', 'Règles du Dojo', 'Plus tard'], who);
  if (choice === 1) { await dojoBoutique(game, n); return; }
  if (choice === 2) {
    await ui.say([
      'Le Dojo de Mamadou propose des combats **exclusivement multijoueurs** à haute intensité stratégique !',
      'En Duo Co-op (2v2), 2 dresseurs humains s\'allient (1 Pokémon actif + 1 remplaçant chacun) face à 2 bots coordinateurs.',
      'En Trio Co-op (3v3), il faut 3 dresseurs humains (1 Pokémon actif + 1 remplaçant chacun) contre 3 bots experts.',
      'Chaque série compte 5 paliers avec soin complet entre les combats et un boss final : moi-même !',
    ], who);
    return;
  }
  if (choice !== 0) return;

  if (game.badgeCount() < 5) {
    await ui.say('Le Dojo accueille uniquement les dresseurs confirmés à partir du 6e Badge (au moins 5 badges en main) !', who);
    return;
  }

  const fmtPick = await ui.ask('Quel format Co-op multijoueur veux-tu lancer ?', ['Duo Co-op (2v2 · 2 joueurs vs 2 bots)', 'Trio Co-op (3v3 · 3 joueurs vs 3 bots)', 'Annuler'], who);
  if (fmtPick !== 0 && fmtPick !== 1) return;
  const format = fmtPick === 1 ? 'triple' : 'double';
  const neededPeers = format === 'triple' ? 2 : 1;

  const healthy = st.party.filter((m) => m && m.hp > 0).length;
  if (healthy < 2) {
    await ui.say('Il te faut au moins 2 Pokémon en forme (1 titulaire et 1 remplaçant) pour entrer sur le tatami !', who);
    return;
  }

  const allConnected = game.link?.enabled ? [...game.link.others.values()] : [];
  if (allConnected.length < neededPeers) {
    await ui.say(
      format === 'triple'
        ? ['Les combats du Dojo en Trio (3v3) sont strictement multijoueurs : il faut 3 dresseurs humains connectés !', 'Connecte 2 alliés via Amis / Connexion (F3) avant de lancer le défi.']
        : ['Les combats du Dojo de Mamadou sont exclusivement multijoueurs (2 joueurs contre 2 bots en 2v2, 3 contre 3 en 3v3) !', 'Rejoins d\'abord un allié dans Amis / Connexion (F3) puis viens me reparler.'],
      who
    );
    return;
  }

  const freePeers = allConnected.filter((p) => !p.busy && !p.pvp);
  if (freePeers.length < neededPeers) {
    await ui.say('Un ou plusieurs alliés connectés sont occupés ailleurs pour le moment. Réessayez dès qu\'ils sont libres !', who);
    return;
  }

  // Choix des coéquipiers si plusieurs dresseurs disponibles
  const selectedPeers = [];
  let remaining = [...freePeers];
  for (let k = 0; k < neededPeers; k++) {
    if (remaining.length === 1 && selectedPeers.length + remaining.length === neededPeers) {
      selectedPeers.push(remaining[0]);
      remaining = [];
      break;
    }
    const items = remaining.map((p) => ({ label: p.name || 'Dresseur', right: p.zone || '' })).concat([{ label: 'Annuler' }]);
    const idx = await ui.list({ title: `Choisir l'allié n°${k + 1}/${neededPeers}`, items, cancel: remaining.length });
    if (idx < 0 || idx >= remaining.length) return;
    selectedPeers.push(remaining[idx]);
    remaining.splice(idx, 1);
  }

  const link = game.link;
  const rid = newId();
  const lvl = Math.max(50, ...st.party.map((m) => m.lvl || 50));
  const peerIds = selectedPeers.map((p) => p.id);

  // Envoi des invitations simultanées
  for (const p of selectedPeers) {
    link.send(p.id, { t: 'req', rid, kind: 'dojo', format, name: st.name, gender: st.gender, lvl });
  }

  const repBox = ui.dialogBox();
  ui.typePage(repBox, `Invitation Co-op ${format === 'triple' ? '3v3' : '2v2'} envoyée à ${selectedPeers.map((p) => p.name).join(' et ')}… (Échap : annuler)`, { last: true });
  await wait(30);
  const popInv = game.input.push((k) => { if (k === 'b' || k === 'cancel') for (const pid of peerIds) link.abort(pid); });
  const reps = await Promise.all(selectedPeers.map((p) => link.wait(p.id, (m) => m.t === 'dojo-rep' && m.rid === rid, 30000).then((m) => ({ peer: p, m }))));
  popInv();
  ui.closeDialog();

  const everyoneOk = reps.every(({ m }) => m.t === 'dojo-rep' && m.ok);
  if (!everyoneOk) {
    for (const pid of peerIds) link.send(pid, { t: 'dojo-cancel', rid });
    const bad = reps.find(({ m }) => !(m.t === 'dojo-rep' && m.ok));
    if (bad) {
      if (bad.m.t === 'abort') await ui.say('Invitation annulée.', who);
      else if (bad.m.t === 'left') await ui.say(`${bad.peer.name} a quitté la partie.`, who);
      else if (bad.m.t === 'timeout') await ui.say(`${bad.peer.name} n'a pas répondu à temps.`, who);
      else {
        const whyMap = { busy: `${bad.peer.name} est occupé(e).`, nomon_multi: `${bad.peer.name} n'a pas 2 Pokémon en forme.` };
        await ui.say(whyMap[bad.m.why] || `${bad.peer.name} a refusé l'invitation.`, who);
      }
    }
    return;
  }

  game.busy = true;
  game.session = rid;
  try {
    const myMons = await pickDojoPair(game, who);
    if (!myMons) {
      for (const pid of peerIds) link.send(pid, { t: 'dojo-cancel', rid });
      await ui.say('Défi annulé.', who);
      return;
    }

    const peerRostersRes = await hostWaitAll(
      game,
      peerIds,
      (pid) => (q) => q.t === 'dojo' && q.rid === rid && (q.step === 'roster' || q.step === 'quit'),
      `En attente de la sélection de ${selectedPeers.map((p) => p.name).join(' et ')}…`
    );
    const badRoster = peerRostersRes.find(({ m }) => m.t !== 'dojo' || m.step !== 'roster' || !Array.isArray(m.mons) || m.mons.length < 2 || !m.mons.every(validMon));
    if (badRoster) {
      for (const pid of peerIds) link.send(pid, { t: 'dojo-cancel', rid });
      await ui.say('Un coéquipier a annulé ou s\'est déconnecté avant le début du combat.', who);
      return;
    }

    const peerMaxLvl = Math.max(...reps.map(({ m }) => m.lvl || 50));
    const finalLvl = Math.max(lvl, peerMaxLvl);
    const rosters = [
      { slot: 0, id: link.myId, name: st.name, hasMega: !!st.bag[MEGA_RING], mons: myMons },
      ...peerRostersRes.map(({ pid, m }, idx) => ({
        slot: idx + 1,
        id: pid,
        name: String(m.name || selectedPeers[idx].name).slice(0, 12),
        hasMega: !!m.hasMega,
        mons: m.mons.slice(0, 2),
      })),
    ];
    const seedBase = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;

    peerIds.forEach((pid, idx) => {
      link.send(pid, { t: 'dojo', rid, step: 'start', format, rosters, mySlot: idx + 1, peerIds, hostId: link.myId, lvl: finalLvl, seedBase });
    });

    await runDojoSeries(game, { rid, format, rosters, mySlot: 0, hostId: link.myId, peerIds, lvl: finalLvl, seedBase });
  } finally {
    game.busy = false;
    game.session = null;
  }
}

/* ======================================================================
   Réception d'invitation Co-op du Dojo chez un joueur invité (route via social.js)
   ====================================================================== */
export async function onDojoInvite(game, from, m) {
  const link = game.link, st = game.state, ui = game.ui;
  const free = st && game.player && !game.busy && game.input.free && !game.bv.alive && !game.session && !game.player.move;
  if (!free) { link.send(from, { t: 'dojo-rep', rid: m.rid, ok: false, why: 'busy' }); return; }
  const healthy = st.party.filter((p) => p && p.hp > 0).length;
  if (healthy < 2) { link.send(from, { t: 'dojo-rep', rid: m.rid, ok: false, why: 'nomon_multi' }); return; }

  const name = String(m.name || link.nameOf(from)).slice(0, 12);
  const fmt = m.format === 'triple' ? 'triple' : 'double';
  const myMaxLvl = Math.max(50, ...st.party.map((p) => p.lvl || 50));

  game.busy = true;
  game.session = m.rid;
  try {
    let gone = false;
    const cancel = link.wait(from, (q) => q.t === 'dojo-cancel' && q.rid === m.rid, 30000).then((r) => {
      gone = true;
      const open = ui.root.querySelector('.list.choice');
      if (open && open._close) open._close(1);
      return r;
    });
    ui.sound.sfx('bang');
    const yes = await ui.yesNo(`${name} t'invite au Dojo de Mamadou en ${fmt === 'triple' ? 'Trio Co-op (3v3 · 3 joueurs)' : 'Duo Co-op (2v2 · 2 joueurs)'} ! Accepter ?`, { speaker: name });
    if (gone) { ui.closeDialog(); await ui.say(`${name} a annulé l'invitation du Dojo.`); return; }
    link.abort(from);
    void cancel;
    link.send(from, { t: 'dojo-rep', rid: m.rid, ok: yes, why: yes ? null : 'no', lvl: myMaxLvl });
    if (!yes) return;

    const myMons = await pickDojoPair(game, { speaker: 'Maître Mamadou', face: 'karateka' });
    if (!myMons) {
      link.send(from, { t: 'dojo', rid: m.rid, step: 'quit', who: st.name });
      return;
    }
    link.send(from, { t: 'dojo', rid: m.rid, step: 'roster', name: st.name, hasMega: !!st.bag[MEGA_RING], mons: myMons });

    const startMsg = await guestWaitHost(
      game,
      from,
      (q) => (q.t === 'dojo' && q.rid === m.rid && q.step === 'start') || (q.t === 'dojo-cancel' && q.rid === m.rid),
      `En attente du lancement par ${name}…`
    );
    if (startMsg.t !== 'dojo' || startMsg.step !== 'start') {
      if (startMsg.t === 'abort') link.send(from, { t: 'dojo', rid: m.rid, step: 'quit', who: st.name });
      await ui.say('L\'escouade n\'a pas démarré le défi du Dojo.');
      return;
    }

    await runDojoSeries(game, {
      rid: m.rid,
      format: startMsg.format,
      rosters: startMsg.rosters,
      mySlot: startMsg.mySlot,
      hostId: from,
      peerIds: [],
      lvl: startMsg.lvl,
      seedBase: startMsg.seedBase,
    });
  } finally {
    game.busy = false;
    game.session = null;
  }
}
