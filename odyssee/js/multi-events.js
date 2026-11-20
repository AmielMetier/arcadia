// odyssee/js/multi-events.js — Nouvelles fonctionnalités multijoueurs d'Odyssée :
// 1. Raids de Boss / Antres Légendaires Co-op (2 ou 3 joueurs humains vs 1 Boss géant à Bouclier Mystique & 2 actions/tour)
// 2. Vrai 2v2 à 4 joueurs humains (Équipe A [J0, J1] vs Équipe B [J2, J3], 1 actif + 1 réserve chacun)
// 4. Tournoi en direct dans le Salon / Colisée (arbre à 4 places avec Champions IA et mode Spectateur auto)

import { SPECIES } from './data/species.js';
import { MOVES } from './data/moves.js';
import { ITEMS } from './core/items.js';
import { createMon, monName, isFainted, healFull, refreshStats } from './core/mon.js';
import { tenueCode, tenueDecode, tenueValide, tenueOrigine, composer } from './render/tenue.js';
import { Battle } from './core/battle.js';
import { battleCopy, validMon } from './core/pvp.js';
import { MEGA_RING } from './core/mega.js';
import { seededRng, newId } from './net/link.js';
import { ASSETS } from './assets.js';
import { el, esc, wait } from './ui/ui.js';
import { partyScreen, TYPE_FR } from './ui/screens.js';
import { LEADERS } from './world/region.js';
import { playBossCinematic } from './ui/cinematic.js';
import {
  ensureDojo,
  CoopDojoBattle,
  buildCoopSquadParty,
  pickDojoPair,
  hostWaitAll,
  guestWaitHost,
  createCoopNet,
} from './dojo-mamadou.js';
import { bossParId, capacitesBoss, niveauBoss, rangDe, formatRaid, joueursDuFormat, RAID_ESSAIS, RAID_PORTEE, RAID_PV, RAID_MAX_JOUEURS } from './raid-monde.js';

/* ======================================================================
   1. RAIDS DE BOSS / ANTRES LÉGENDAIRES CO-OP (2 OU 3 JOUEURS VS BOSS)
   ====================================================================== */

export const RAID_BOSSES = [
  { id: 'tyranocif', sp: 248, title: 'Tyranocif Alpha', ability: 'sand-stream', moves: [444, 242, 89, 157], bg: 'cave', legend: false },
  { id: 'metalosse', sp: 376, title: 'Métalosse Titan', ability: 'clear-body', moves: [442, 428, 418, 89], bg: 'gym', legend: false },
  { id: 'carchacrok', sp: 445, title: 'Carchacrok Tempête', ability: 'rough-skin', moves: [337, 89, 157, 242], bg: 'cave', legend: false },
  { id: 'dracolosse', sp: 149, title: 'Dracolosse Ancien', ability: 'multiscale', moves: [337, 542, 245, 89], bg: 'volcanic', legend: false },
  { id: 'lugia', sp: 249, title: 'Lugia des Abysses', ability: 'pressure', moves: [94, 403, 56, 58], bg: 'water', legend: true },
  { id: 'mewtwo', sp: 150, title: 'Mewtwo Originel', ability: 'pressure', moves: [94, 247, 85, 58], bg: 'league', legend: true },
];

/** Construit un Boss de Raid géant avec PV x3 (Duo) ou x4 (Trio) */
// opts.monde : boss de raid de la région (raid-monde.js) : son niveau est déjà calculé (lvl), ses PV multipliés selon le nombre de joueurs (RAID_PV)
export function buildRaidBossChallenge(bossIdx = 0, slots = 2, lvl = 55, seed = 1, opts = {}) {
  const boss = opts.def || RAID_BOSSES[bossIdx % RAID_BOSSES.length] || RAID_BOSSES[0];
  const r = seededRng(seed >>> 0);
  const bossLvl = opts.monde ? Math.max(5, Math.min(100, lvl | 0)) : Math.max(55, Math.min(95, (lvl | 0) + 4));
  const validMoves = opts.def ? capacitesBoss(boss) : boss.moves.filter((id) => MOVES[id]);
  const mon = createMon(boss.sp, bossLvl, {
    iv: [31, 31, 31, 31, 31, 31],
    nat: 0,
    moves: validMoves,
    item: null,
    ability: boss.ability || null,
    shiny: false,
    rng: r,
  });
  const hpMult = opts.monde ? RAID_PV[Math.max(2, Math.min(4, slots))] : slots >= 3 ? 4 : 3;
  mon.stats[0] = Math.max(mon.stats[0], Math.round(mon.stats[0] * hpMult));
  mon.hp = mon.stats[0];
  return {
    boss,
    bossLvl,
    hpMult,
    monde: !!opts.monde,
    aura: opts.monde ? rangDe(boss).aura : null,
    name: boss.title,
    party: [mon],
    trainer: {
      cls: 'Boss Antre',
      name: boss.title,
      ow: 'drakos',
      bs: 'drakos',
      ai: 'smart',
      strategic: true,
      friendly: true,
      mega: false,
      prize: 0,
      items: {},
      intro: opts.monde ? `${boss.title} barre la route, plus fort que tout ce que vous avez vu !` : `${boss.title} émerge de la faille avec une aura monumentale !`,
      lose: `${boss.title} vacille et retrouve son calme sous vos assauts coordonnés !`,
    },
  };
}

/**
 * Moteur de Raid Co-op : 2 ou 3 joueurs sur `side 0` vs 1 Boss géant unique sur `side 1` (`slot 0`).
 * Le Boss agit deux fois par tour (trois fois face à quatre joueurs ; face à deux, sa seconde frappe ne vient qu'un tour
 * sur deux) et lève un Bouclier Mystique à <= 60% PV.
 */
export class RaidCoopBattle extends CoopDojoBattle {
  constructor(o) {
    super(o);
    this.isRaid = true;
    this.monde = !!o.foe?.monde;   // boss de raid de la région
    this.shieldMax = this.slots >= 4 ? 8 : this.slots >= 3 ? 6 : 4;
    this.aura = o.foe?.aura || null;   // couleur de l'aura du boss (vue de combat)
    this.shield = {
      active: false,
      triggered: false,
      hp: 0,
      max: this.shieldMax,
    };
    this.sides[1].activeSlots = Array(this.slots).fill(-1);
    this.sides[1].activeSlots[0] = 0;
  }

  hp(ref, delta, cause) {
    const r = this.norm(ref);
    if (r.side === 1 && delta < 0) {
      const boss = this.monAt(1, 0);
      if (boss && boss.hp > 0) {
        // Empêche un OHKO (ex: Glaciation) de liquider un Boss de Raid d'un coup
        if (-delta >= boss.hp && boss.hp > boss.stats[0] * 0.35) {
          delta = -Math.floor(boss.stats[0] * 0.30);
        }
        if (this.shield.active) {
          delta = Math.min(-1, Math.round(delta * 0.35));
        }
      }
      const dealt = super.hp(r, delta, cause);
      const after = this.monAt(1, 0);
      if (this.shield.active && !cause && after && after.hp > 0) {
        this.shield.hp = Math.max(0, this.shield.hp - 1);
        if (this.shield.hp === 0) {
          this.shield.active = false;
          const st = this.sides[1].vs[0].st;
          st[2] = Math.max(-6, st[2] - 2);
          st[4] = Math.max(-6, st[4] - 2);
          this.ev.push({ t: 'stat', side: 1, slot: 0, up: false, all: this.stages(), slots: this.allStages() });
          this.say(`💥 Le Bouclier Mystique de ${monName(after)} se brise ! Sa Défense s'effondre !`);
        } else {
          this.say(`🛡️ Le Bouclier Mystique fissure ! (${this.shield.hp}/${this.shield.max} restant${this.shield.hp > 1 ? 's' : ''})`);
        }
        this.ev.push({ t: 'raid-shield', active: this.shield.active, hp: this.shield.hp, max: this.shield.max });
      }
      if (!this.shield.triggered && after && after.hp > 0 && after.hp <= after.stats[0] * 0.6) {
        this.shield.triggered = true;
        this.shield.active = true;
        this.shield.hp = this.shield.max;
        this.ev.push({ t: 'stat', side: 1, slot: 0, up: true, all: this.stages(), slots: this.allStages() });
        this.ev.push({ t: 'raid-shield', active: true, hp: this.shield.hp, max: this.shield.max });
        this.say(`🛡️ ${monName(after)} libère un Bouclier Mystique (${this.shield.hp} charges) !`);
      }
      return dealt;
    }
    return super.hp(ref, delta, cause);
  }

  /** ouverture d'un boss de la région : pas de dresseur ; le boss est déjà là, puis chaque joueur envoie son Pokémon */
  start() {
    if (!this.monde) return super.start();
    const t = this.sides[1].trainer;
    const evs = super.start().filter((e) => !(e.t === 'send'
      || (e.t === 'msg' && (/lance un combat/.test(e.text) || e.text.startsWith(`${t.cls} ${t.name} envoie`) || e.text.startsWith('En avant !')))));
    const out = [{ t: 'msg', text: `${this.sides[1].name} surgit, entouré d'une aura ${{ bleu: 'bleue', rouge: 'rouge', or: 'dorée' }[this.aura] || 'mystérieuse'} !` }];
    for (const sl of this.aliveSlots(0)) {
      const idx = this.sides[0].activeSlots[sl];
      out.push({ t: 'msg', text: `${this.ownerNames[this.owners[idx]] || 'Un allié'} envoie ${monName(this.monAt(0, sl))} !` });
      out.push({ t: 'send', side: 0, slot: sl, idx });
    }
    return out.concat(evs);
  }

  /** un boss géant : tous les joueurs l'atteignent, et il les atteint tous (pas de distance en combat triple ou quadruple) */
  isAdjacent() { return true; }
  validFoeTargets(attRef) {
    const opp = 1 - attRef.side;
    return this.aliveSlots(opp).map((slot) => ({ side: opp, slot }));
  }

  /** Le Boss joue deux actions distinctes par tour (visant si possible deux alliés différents) */
  foeChooseAll() {
    const aliveFoe = this.aliveSlots(1);
    if (!aliveFoe.length) return [];
    const sl = aliveFoe[0];
    const boss = this.monAt(1, sl);
    if (!boss || isFainted(boss)) return [];
    const first = this.foeChooseSlot(sl);
    const out = [{ i: 1, side: 1, slot: sl, a: first }];

    const pAlive = this.aliveSlots(0);
    if (!pAlive.length) return out;
    const forced = this.forcedAction({ side: 1, slot: sl });
    if (forced) return out;
    // boss de la région face à deux joueurs : sa seconde frappe ne vient qu'un tour sur deux
    if (this.monde && this.slots < 3 && this.turn % 2 === 1) return out;

    // frappes en plus : une (deux face à quatre joueurs), chacune sur un joueur pas encore visé si possible
    const extra = this.monde && this.slots >= 4 ? 2 : 1;
    const vises = new Set([first?.targetSlot ?? pAlive[0]]);
    const usable = this.usableMoves({ side: 1, slot: sl });
    if (!usable.length) return out;
    for (let n = 0; n < extra; n++) {
      const libres = pAlive.filter((s) => !vises.has(s));
      const targetSlot = libres.length ? libres[0] : pAlive[n % pAlive.length];
      vises.add(targetSlot);
      // la meilleure capacité offensive contre ce joueur
      let bestMvIdx = usable[0];
      let bestScore = -1e9;
      const defMon = this.monAt(0, targetSlot);
      for (const k of usable) {
        const mId = boss.moves[k]?.id;
        const mv = MOVES[mId];
        if (!mv || mv.c === 'status') continue;
        let sc = (mv.p || 50) * (this.effOn({ side: 1, slot: sl }, { side: 0, slot: targetSlot }, mv.t) || 1);
        if (k !== first?.slot && first?.type === 'move') sc += 8;
        if (defMon && SPECIES[boss.sp]?.t?.includes(mv.t)) sc *= 1.35;
        if (sc > bestScore) { bestScore = sc; bestMvIdx = k; }
      }
      const chosenMove = boss.moves[bestMvIdx];
      out.push({ i: 1, side: 1, slot: sl, a: { type: 'move', id: chosenMove.id, slot: bestMvIdx, targetSide: 0, targetSlot } });
    }
    return out;
  }

  checksum() {
    const base = super.checksum();
    const sh = `${this.shield.active ? 1 : 0}:${this.shield.hp}:${this.shield.triggered ? 1 : 0}`;
    let h = 0x811c9dc5;
    const str = `${base}|${sh}`;
    for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16);
  }
}

async function selectPeersForRoom(ui, freePeers, neededPeers, labelPrefix) {
  const selected = [];
  let remaining = [...freePeers];
  for (let k = 0; k < neededPeers; k++) {
    if (remaining.length === 1 && selected.length + remaining.length === neededPeers) {
      selected.push(remaining[0]);
      break;
    }
    const items = remaining.map((p) => ({ label: p.name || 'Dresseur', right: p.zone || '' })).concat([{ label: 'Annuler' }]);
    const idx = await ui.list({ title: `${labelPrefix} (${k + 1}/${neededPeers})`, items, cancel: remaining.length });
    if (idx < 0 || idx >= remaining.length) return null;
    selected.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return selected;
}

/** après la victoire : chaque joueur tente sa chance une fois. Peu de chances (selon le rang du boss), au niveau max
 *  du joueur ; un légendaire capturé est bridé (stats d'un bon Pokémon classique, raid-monde.js). */
/** code de la tenue du joueur (vide s'il porte la tenue d'origine), pour que les autres la voient */
const codeTenue = (st) => (st.tenue && !tenueOrigine(tenueValide(st.tenue, st.gender)) ? tenueCode(tenueValide(st.tenue, st.gender)) : undefined);

/** portrait d'un joueur pour la présentation de l'escouade : son personnage de face, dans sa tenue (null : image par défaut) */
function portraitJoueur(game, genre, tn) {
  try {
    const v = game.view, T = tn ? tenueDecode(tn) : null, g = T?.genre || genre, b = v?.baseDe?.(g);
    if (!b) return null;
    const src = T ? composer(b.src, b.sx, b.sy, T) : b.src, sx = T ? 0 : b.sx, sy = T ? 0 : b.sy;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = false;
    x.drawImage(src, sx + 64, sy, 64, 64, 0, 0, 64, 64);   // de face, à l'arrêt
    // recadré sur le personnage
    const d = x.getImageData(0, 0, 64, 64).data; let x0 = 64, y0 = 64, x1 = -1, y1 = -1;
    for (let y = 0; y < 64; y++) for (let i = 0; i < 64; i++) if (d[(y * 64 + i) * 4 + 3] > 20) { x0 = Math.min(x0, i); y0 = Math.min(y0, y); x1 = Math.max(x1, i); y1 = Math.max(y1, y); }
    if (x1 < 0) return null;
    const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL();
  } catch (e) { return null; }
}

async function offerRaidCapture(game, bossData, def) {
  const st = game.state, ui = game.ui, rang = rangDe(def);
  const who = { speaker: 'Boss de raid', face: 'drakos' };
  if (st.party.length >= 6 && st.box.length >= 300) { await ui.say('Plus de place dans le PC : impossible de tenter la capture.', who); return; }
  const want = await ui.yesNo(`${bossData.boss.title} est à terre ! Lancer une Hyper Ball ? (une seule tentative, ${Math.round(rang.capture * 100)} % de chances)`, who);
  if (!want) { await ui.say(`${bossData.boss.title} se relève et disparaît.`, who); return; }
  game.sound.sfx('throw');
  if (Math.random() >= rang.capture) {
    await ui.say([`La Hyper Ball tremble… et ${bossData.boss.title} s'en échappe !`, 'Il prend la fuite. Ce sera pour une prochaine fois.'], who);
    return;
  }
  const lvl = Math.min(bossData.bossLvl, game.levelCap());
  const caught = createMon(bossData.boss.sp, lvl);
  caught.moves = bossData.party[0].moves.map((m) => m.id).filter((id) => MOVES[id]).map((id) => ({ id, pp: MOVES[id].pp, maxPp: MOVES[id].pp }));
  caught.ability = bossData.boss.ability || null;
  if (def.legend) { caught.bride = true; refreshStats(caught); }
  caught.ball = 'ultra-ball';
  caught.ot = st.name;
  caught.met = 'Boss de raid';
  healFull(caught);
  game.markCaught(caught.sp);
  game.sound.sfx('item');
  if (st.party.length < 6) {
    st.party.push(caught);
    await ui.say(`${monName(caught)} rejoint ton équipe !`, who);
  } else {
    st.box.push(caught);
    await ui.say(`${monName(caught)} a été transféré dans ton PC !`, who);
  }
  if (def.legend) await ui.say(`Loin de son monde, ${monName(caught)} a perdu une bonne part de sa puissance…`, who);
  game.save(true);
}

async function runRaidBattleSession(game, { rid, bossIdx, format, rosters, mySlot, hostId, peerIds, lvl, seed, monde, k, bossKey }) {
  const ui = game.ui, st = game.state, D = ensureDojo(st);
  const slots = monde ? joueursDuFormat(format) : format === 'triple' ? 3 : 2;
  const isHost = mySlot === 0;
  const ownerNames = rosters.map((r) => String(r.name || 'Dresseur').slice(0, 12));
  const { party, owners, ownerNames: sqNames } = buildCoopSquadParty(rosters);
  const def = monde ? bossParId(bossKey) : null;
  if (monde && !def) { await ui.say('Ce boss de raid est inconnu de ta version du jeu.'); return; }
  const bossData = buildRaidBossChallenge(bossIdx, slots, lvl, seed, monde ? { def, monde: true } : {});
  const who = { speaker: monde ? 'Boss de raid' : 'Raid Co-op', face: 'drakos' };
  const RM = game.raidMonde;
  if (monde && RM) { RM.compterEssai(k); game.save(true); }
  // le bandeau d'annonce ne doit pas rester par-dessus la rencontre
  document.querySelectorAll('.raid-monde-annonce').forEach((b) => b.remove());

  await ui.say(monde
    ? `${ownerNames.join(', ')} affrontent ${bossData.name} (N.${bossData.bossLvl} · PV ×${bossData.hpMult}) ! Essai ${RM ? RM.suivi(k).essais : 1} sur ${RAID_ESSAIS}.`
    : `Alerte Antre ! ${ownerNames.join(', ')} affrontent ${bossData.name} (N.${bossData.bossLvl} · PV ×${bossData.hpMult}) !`, who);

  const battle = new RaidCoopBattle({
    squadName: ownerNames.join(' & '),
    party,
    owners,
    ownerNames: sqNames,
    rosterMega: rosters.map((r) => !!r.hasMega),
    mySlot,
    playerMega: rosters.some((r) => !!r.hasMega),
    foe: bossData,
    format,
    slots,
    seed,
  });

  const coopNet = createCoopNet(game, {
    rid, isHost, hostId, peerIds, ownerNames, mySlot, foeName: bossData.name, msgTag: 'raid',
  });

  const realParty = st.party;
  await playBossCinematic(game, {
    sp: bossData.boss.sp,
    raid: true,
    preset: 'raid',
    title: bossData.boss.title,
    sub: monde ? `Boss de raid · N.${bossData.bossLvl}` : `Antre Dimensionnelle · N.${bossData.bossLvl}`,
    badge: `${monde ? 'BOSS DE RAID' : 'RAID CO-OP'} · PV ×${bossData.hpMult}`,
    duration: 5.6,
  });
  const curtain = await game.encounterIntro('raidBoss');
  game.musicLock = true;
  game.sound.play('raidBoss');
  curtain.remove();
  game.bv.pvp = true;
  st.party = battle.sides[0].party;
  let res;
  try {
    res = await game.bv.runCoopDojo(battle, coopNet, {
      bg: bossData.boss.bg || 'cave', night: true,
      // présentation de l'escouade avant que chacun envoie son Pokémon
      lineup: monde ? {
        joueurs: rosters.map((r) => ({ name: String(r.name || 'Dresseur').slice(0, 12), bs: r.bs === 'player_f' ? 'player_f' : 'player_m', portrait: portraitJoueur(game, r.bs === 'player_f' ? 'f' : 'm', r.tn), moi: r.slot === mySlot })),
        boss: { sp: bossData.boss.sp, title: bossData.boss.title, lvl: bossData.bossLvl, rang: rangDe(def).nom, aura: bossData.aura },
      } : null,
    });
  } finally {
    st.party = realParty;
    game.bv.pvp = false;
    game.bv.close();
    game.musicLock = false;
  }
  game.sound.stopMusic(0.1);
  game.sound.current = null;
  game.updateZone();

  if (res === 'win' && monde) {
    const rang = rangDe(def);
    RM?.marquerVaincu(k);
    D.pdj += rang.pdj;
    game.give('rare-candy', rang.bonbons);
    game.sound.sfx('item');
    game.save(true);
    await ui.say([
      `${bossData.name} est vaincu !`,
      `Tu remportes ${rang.pdj} Points du Dojo et ${rang.bonbons} Super Bonbons !`,
    ], who);
    await offerRaidCapture(game, bossData, def);
  } else if (monde) {
    const reste = RM ? RM.essaisRestants(k) : 0;
    await ui.say(reste > 0
      ? [`${bossData.name} tient bon…`, `Il te reste ${reste} essai${reste > 1 ? 's' : ''}. Soignez-vous et retentez votre chance avant qu'il reparte !`]
      : [`${bossData.name} tient bon…`, 'Tu as utilisé tes 5 essais pour ce boss. Il faudra attendre le prochain !'], who);
  } else if (res === 'win') {
    D.pdj += 5;
    game.give('rare-candy', 2);
    game.sound.sfx('item');
    game.save(true);
    await ui.say([
      `Victoire éclatante contre ${bossData.name} !`,
      `Tu remportes 5 PDj (total : ${D.pdj} PDj) et 2 Super Bonbons !`,
    ], who);
    await offerRaidCapture(game, bossData);
  } else {
    await ui.say(`${bossData.name} s'est échappé dans la faille… Revenez mieux préparés !`, who);
  }
}

/** Boss de raid de la région (raid-monde.js) : le joueur l'aborde ; tous les joueurs connectés doivent être là
 *  (trois autres au plus : le raid se joue en coop, de 2 à 4 joueurs, en combat double, triple ou quadruple).
 *  Niveau du boss : moyenne des niveaux max des participants, plus quelques niveaux selon son rang. */
export async function lancerRaidMonde(game, R) {
  const st = game.state, ui = game.ui, link = game.link, RM = game.raidMonde;
  const who = { speaker: 'Boss de raid', face: 'drakos' };
  const def = R.boss;
  const reste = RM.essaisRestants(R.k);
  const restant = Math.max(1, Math.round((R.fin - Date.now()) / 60e3));
  if (reste <= 0) { await ui.say([`${def.title} te toise.`, 'Tu as déjà utilisé tes 5 essais contre ce boss. Le prochain viendra !'], who); return; }
  if (st.party.filter((m) => m && m.hp > 0).length < 2) { await ui.say([`${def.title} te toise.`, 'Il te faut au moins 2 Pokémon en forme pour l\'affronter.'], who); return; }
  const tous = link?.enabled ? [...link.others.values()] : [];
  const besoin = Math.min(RAID_MAX_JOUEURS - 1, tous.length);
  if (besoin < 1) { await ui.say([`${def.title} te toise.`, 'Un boss de raid se combat à plusieurs : il faut au moins un autre joueur connecté.'], who); return; }
  const me = game.player;
  const proches = tous.filter((p) => p.map === 'monde' && Math.abs(p.x - me.x) + Math.abs(p.y - me.y) <= RAID_PORTEE && !p.busy && !p.pvp);
  if (proches.length < besoin) {
    const loin = tous.filter((p) => !proches.includes(p)).map((p) => p.name || 'Dresseur');
    await ui.say([
      `${def.title} te toise. (Il repart dans ${restant} min.)`,
      `Tout le monde doit être là pour lancer le raid : ${proches.length + 1}/${besoin + 1} joueurs près du boss.`,
      ...(loin.length ? [`Encore loin ou occupés : ${loin.join(', ')}.`] : []),
    ], who);
    return;
  }
  const ok = await ui.yesNo(`${def.title} (${R.nom}) · essais restants : ${reste}/${RAID_ESSAIS}. Lancer le raid ?`, who);
  if (!ok) return;
  const choisis = proches.length === besoin ? proches : await selectPeersForRoom(ui, proches, besoin, 'Avec qui lancer le raid');
  if (!choisis) return;
  const format = formatRaid(besoin + 1);
  const rid = newId();
  const peerIds = choisis.map((p) => p.id);
  for (const p of choisis) link.send(p.id, { t: 'req', rid, kind: 'raid', monde: true, k: R.k, bossKey: def.id, format, name: st.name, cap: game.levelCap() });

  const box = ui.dialogBox();
  ui.typePage(box, `Appel au raid envoyé à ${choisis.map((p) => p.name).join(' et ')}… (Échap : annuler)`, { last: true });
  await wait(30);
  const pop = game.input.push((key) => { if (key === 'b' || key === 'cancel') for (const pid of peerIds) link.abort(pid); });
  const reps = await Promise.all(choisis.map((p) => link.wait(p.id, (m) => m.t === 'raid-rep' && m.rid === rid, 30000).then((m) => ({ peer: p, m }))));
  pop();
  ui.closeDialog();
  const refus = reps.filter(({ m }) => !(m.t === 'raid-rep' && m.ok));
  if (refus.length) {
    for (const pid of peerIds) link.send(pid, { t: 'raid-cancel', rid });
    const pourquoi = { essais: 'n\'a plus d\'essai', vaincu: 'a déjà vaincu ce boss', nomon: 'n\'a pas 2 Pokémon en forme', busy: 'est occupé' };
    await ui.say(refus.map(({ peer, m }) => `${peer.name || 'Un allié'} ${pourquoi[m.why] || 'a refusé'}.`), who);
    return;
  }

  game.busy = true;
  game.session = rid;
  try {
    const myMons = await pickDojoPair(game, who);
    if (!myMons) { for (const pid of peerIds) link.send(pid, { t: 'raid-cancel', rid }); await ui.say('Raid annulé.', who); return; }
    const peerRes = await hostWaitAll(
      game, peerIds,
      (pid) => (q) => q.t === 'raid' && q.rid === rid && (q.step === 'roster' || q.step === 'quit'),
      `En attente de l'équipe de ${choisis.map((p) => p.name).join(' et ')}…`
    );
    if (peerRes.some(({ m }) => m.t !== 'raid' || m.step !== 'roster' || !Array.isArray(m.mons) || m.mons.length < 2 || !m.mons.every(validMon))) {
      for (const pid of peerIds) link.send(pid, { t: 'raid-cancel', rid });
      await ui.say('Le raid a été annulé avant le début.', who);
      return;
    }
    const lvl = niveauBoss([game.levelCap(), ...reps.map(({ m }) => Math.max(5, Math.min(100, m.cap | 0 || game.levelCap())))], def);
    const rosters = [
      { slot: 0, id: link.myId, name: st.name, bs: st.gender === 'f' ? 'player_f' : 'player_m', tn: codeTenue(st), hasMega: !!st.bag[MEGA_RING], mons: myMons },
      ...peerRes.map(({ pid, m }, idx) => ({ slot: idx + 1, id: pid, name: String(m.name || choisis[idx].name).slice(0, 12), bs: m.gender === 'f' ? 'player_f' : 'player_m', tn: typeof m.tn === 'string' ? m.tn.slice(0, 16) : undefined, hasMega: !!m.hasMega, mons: m.mons.slice(0, 2) })),
    ];
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    peerIds.forEach((pid, idx) => link.send(pid, { t: 'raid', rid, step: 'start', bossIdx: 0, format, rosters, mySlot: idx + 1, hostId: link.myId, lvl, seed, monde: true, k: R.k, bossKey: def.id }));
    await runRaidBattleSession(game, { rid, bossIdx: 0, format, rosters, mySlot: 0, hostId: link.myId, peerIds, lvl, seed, monde: true, k: R.k, bossKey: def.id });
  } finally {
    game.busy = false;
    game.session = null;
  }
}

export async function onRaidInvite(game, from, m) {
  const link = game.link, st = game.state, ui = game.ui;
  const free = st && game.player && !game.busy && game.input.free && !game.bv.alive && !game.session && !game.player.move;
  if (!free) { link.send(from, { t: 'raid-rep', rid: m.rid, ok: false, why: 'busy' }); return; }
  const healthy = st.party.filter((p) => p && p.hp > 0).length;
  if (healthy < 2) { link.send(from, { t: 'raid-rep', rid: m.rid, ok: false, why: 'nomon' }); return; }

  const name = String(m.name || link.nameOf(from)).slice(0, 12);
  // seuls les boss de raid de la région se lancent encore (plus de raid à la demande)
  if (!m.monde) { link.send(from, { t: 'raid-rep', rid: m.rid, ok: false, why: 'old' }); return; }
  const RM = game.raidMonde, boss = bossParId(m.bossKey);
  if (!boss || !RM) { link.send(from, { t: 'raid-rep', rid: m.rid, ok: false, why: 'old' }); return; }
  if (RM.suivi(m.k).vaincu) { link.send(from, { t: 'raid-rep', rid: m.rid, ok: false, why: 'vaincu' }); return; }
  if (RM.essaisRestants(m.k) <= 0) { link.send(from, { t: 'raid-rep', rid: m.rid, ok: false, why: 'essais' }); return; }
  game.busy = true;
  game.session = m.rid;
  try {
    let gone = false;
    void link.wait(from, (q) => q.t === 'raid-cancel' && q.rid === m.rid, 30000).then((r) => {
      gone = true;
      const open = ui.root.querySelector('.list.choice');
      if (open && open._close) open._close(1);
      return r;
    });
    ui.sound.sfx('bang');
    const yes = await ui.yesNo(`${name} lance le raid contre ${boss.title} (essais restants : ${RM.essaisRestants(m.k)}/${RAID_ESSAIS}) ! Y aller ?`, { speaker: name });
    if (gone) { ui.closeDialog(); await ui.say(`${name} a annulé le Raid.`); return; }
    link.abort(from);
    link.send(from, { t: 'raid-rep', rid: m.rid, ok: yes, cap: game.levelCap() });
    if (!yes) return;

    const myMons = await pickDojoPair(game, { speaker: 'Boss de raid', face: 'drakos' });
    if (!myMons) { link.send(from, { t: 'raid', rid: m.rid, step: 'quit', who: st.name }); return; }
    link.send(from, { t: 'raid', rid: m.rid, step: 'roster', name: st.name, gender: st.gender, tn: codeTenue(st), hasMega: !!st.bag[MEGA_RING], mons: myMons });

    const startMsg = await guestWaitHost(
      game, from,
      (q) => (q.t === 'raid' && q.rid === m.rid && q.step === 'start') || (q.t === 'raid-cancel' && q.rid === m.rid),
      `En attente du lancement du raid par ${name}…`
    );
    if (startMsg.t !== 'raid' || startMsg.step !== 'start') {
      if (startMsg.t === 'abort') link.send(from, { t: 'raid', rid: m.rid, step: 'quit', who: st.name });
      await ui.say('Le Raid Co-op n\'a pas démarré.');
      return;
    }
    await runRaidBattleSession(game, { ...startMsg, rid: m.rid, hostId: from, peerIds: [], monde: true, k: m.k, bossKey: m.bossKey });
  } finally {
    game.busy = false;
    game.session = null;
  }
}

/* ======================================================================
   2. VRAI 2V2 À 4 JOUEURS HUMAINS (ÉQUIPE A [J0,J1] VS ÉQUIPE B [J2,J3])
   ====================================================================== */

export class Multi4pBattle extends Battle {
  constructor(o) {
    super({
      player: { name: o.meTeam.name, party: o.meTeam.party, bag: {} },
      foe: {
        name: o.foeTeam.name,
        party: o.foeTeam.party,
        trainer: { cls: 'Duo adverse', name: o.foeTeam.name, bs: o.foeTeam.bs || 'calem', prize: 0 },
      },
      rng: seededRng(o.seed >>> 0),
      format: 'double',
      slots: 2,
    });
    this.coop = true;
    this.pvp = true;
    this.is4p = true;
    this.teamIdx = o.teamIdx | 0; // 0 = Équipe A, 1 = Équipe B
    this.canon = this.teamIdx;
    this.mySlot = o.mySlot | 0;   // 0 ou 1 dans son équipe
    this.owners = o.meTeam.owners;
    this.ownerNames = o.meTeam.ownerNames;
    this.sideOwners = [o.meTeam.owners, o.foeTeam.owners];
    this.sideOwnerNames = [o.meTeam.ownerNames, o.foeTeam.ownerNames];
    // Ordre canonique [Équipe A, Équipe B] pour canMega
    this.teamRosterMega = o.teamIdx === 0
      ? [o.meTeam.hasMega, o.foeTeam.hasMega]
      : [o.foeTeam.hasMega, o.meTeam.hasMega];
    this.sides[0].mega = o.meTeam.hasMega.some(Boolean);
    this.sides[1].mega = o.foeTeam.hasMega.some(Boolean);
    this.remote = null;
    this.need = [false, false];
    this.needSlots = [[], []];
  }

  eotOrder() { return [this.canon, 1 - this.canon]; }
  tie(p, q) {
    const ps = p.i ?? p.side, qs = q?.i ?? q?.side;
    if (qs != null && ps === qs) return (p.slot ?? 0) - (q.slot ?? 0);
    const first = this.rng() < 0.5 ? this.canon : 1 - this.canon;
    return ps === first ? -1 : 1;
  }
  awardExp() { /* combat amical à 4 joueurs */ }

  canMega(ref) {
    const r = this.norm(ref);
    const canonTeam = r.side === 0 ? this.teamIdx : 1 - this.teamIdx;
    if (this.teamRosterMega[canonTeam] && !this.teamRosterMega[canonTeam][r.slot]) return false;
    return super.canMega(r);
  }

  canSwitchTo(partyIdx, slot = this.mySlot) {
    const m = this.sides[0].party[partyIdx];
    return this.sideOwners[0][partyIdx] === slot && !!m && m.hp > 0 && !this.sides[0].activeSlots.includes(partyIdx);
  }

  _remoteFor(slot = 0) {
    if (Array.isArray(this.remote)) return this.remote.find((x) => x && x.slot === slot) ?? this.remote[slot] ?? { type: 'move', idx: 0 };
    return this.remote || { type: 'move', idx: 0 };
  }
  foeWantsMega(a, slot = 0) {
    const r = this._remoteFor(slot);
    return a?.type === 'move' && !!r?.mega && this.canMega({ side: 1, slot });
  }
  foeChooseAll() {
    return this.aliveSlots(1).map((sl) => ({ i: 1, side: 1, slot: sl, a: this.foeChooseSlot(sl) }));
  }
  foeChooseSlot(slot = 0) {
    const ref = { side: 1, slot };
    const forced = this.forcedAction(ref); if (forced) return forced;
    const a = this._remoteFor(slot);
    const m = this.act(ref);
    if (a.type === 'switch' && this.sideOwners[1][a.idx] === slot && this.sides[1].party[a.idx] && this.sides[1].party[a.idx].hp > 0 && !this.sides[1].activeSlots.includes(a.idx)) {
      return { type: 'switch', idx: a.idx };
    }
    if (!this.usableMoves(ref).length) return { type: 'move', id: 165 };
    const k = Number.isInteger(a.idx) && m.moves[a.idx]?.pp > 0 ? a.idx : this.usableMoves(ref)[0];
    const targetSide = a.targetSide != null ? (1 - a.targetSide) : 0;
    const targetSlot = Number.isInteger(a.targetSlot) ? a.targetSlot : 0;
    return { type: 'move', id: m.moves[k].id, slot: k, targetSide, targetSlot };
  }

  checkFaints(midTurn = false) {
    let stop = false;
    for (const i of [1 - this.canon, this.canon]) {
      for (let slot = 0; slot < this.slots; slot++) {
        const m = this.monAt(i, slot);
        if (m && isFainted(m) && !m._ko) {
          m._ko = true;
          this.ev.push({ t: 'faint', side: i, slot });
          this.say(`${i === 1 ? this.Nm({ side: 1, slot }) : monName(m)} est K.O. !`);
          stop = true;
        }
      }
    }
    const left = (i) => this.sides[i].party.some((m) => m && m.hp > 0);
    if (!left(0) && !left(1)) { this.say('Égalité parfaite entre les deux équipes !'); this.end('draw'); return true; }
    if (!left(0)) { this.loseBattle(); return true; }
    if (!left(1)) { this.winBattle(); return true; }
    if (midTurn) return false;

    const ns = [[], []];
    for (const i of [0, 1]) {
      const party = this.sides[i].party;
      const owners = this.sideOwners[i];
      for (let sl = 0; sl < this.slots; sl++) {
        const m = this.monAt(i, sl);
        if (m && isFainted(m)) {
          const hasOwnBench = party.some((bm, idx) => owners[idx] === sl && bm && bm.hp > 0 && !this.sides[i].activeSlots.includes(idx));
          if (hasOwnBench) ns[i].push(sl);
          else this.sides[i].activeSlots[sl] = -1;
        }
      }
    }
    if (!ns[0].length && !ns[1].length) return false;
    this.needSlots = ns;
    this.needPlayerSlots = ns[0];
    this.need = [ns[0].length > 0, ns[1].length > 0];
    this.state = 'switch';
    this.ev.push({ t: 'switch-prompt', slots: ns[0] });
    return true;
  }

  switchCoop(picksObj = {}) {
    if (this.state !== 'switch') return [];
    this.ev = [];
    const pick = picksObj.picks0 ? { 0: picksObj.picks0, 1: picksObj.picks1 || {} } : { 0: picksObj, 1: {} };
    const switched = [];
    for (const i of [this.canon, 1 - this.canon]) {
      const slotsNeed = this.needSlots[i] || [];
      if (!slotsNeed.length) continue;
      const party = this.sides[i].party;
      const owners = this.sideOwners[i];
      for (const sl of slotsNeed) {
        let idx = pick[i]?.[sl];
        if (idx == null || owners[idx] !== sl || !party[idx] || party[idx].hp <= 0 || this.sides[i].activeSlots.includes(idx)) {
          idx = party.findIndex((m, j) => owners[j] === sl && m && m.hp > 0 && !this.sides[i].activeSlots.includes(j));
        }
        if (idx >= 0) {
          this.doSwitchSlot(i, sl, idx, true, false);
          switched.push({ side: i, slot: sl });
        } else {
          this.sides[i].activeSlots[sl] = -1;
        }
      }
    }
    this.need = [false, false];
    this.needSlots = [[], []];
    this.needPlayerSlots = [];
    if (switched.length) {
      for (const r of this.sortBySpeed(switched)) this.triggerEntry(r);
    }
    this.state = 'choose';
    return this.flush();
  }

  winBattle() {
    this.ev.push({ t: 'trainer-back' });
    this.say(`Votre duo bat ${this.sides[1].name} !`);
    this.end('win');
  }
  loseBattle() {
    this.say('Votre équipe n\'a plus de Pokémon en forme !');
    this.say(`${this.sides[1].name} remporte ce 2v2 à 4 joueurs !`);
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
    for (const i of [this.canon, 1 - this.canon]) {
      const s = this.sides[i];
      parts.push(...s.activeSlots, ...s.party.map((m) => `${m.hp}${(m.status === 'tox' ? 'psn' : m.status) || ''}`), ...s.vs.map((v) => v.st.join('')));
    }
    parts.push(this.turn, this.state);
    let h = 0x811c9dc5;
    const str = parts.join('|');
    for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16);
  }
}

function create4pNet(game, { rid, isHost, hostId, peerIds, teamIdx, mySlot, allNames, foeName }) {
  const link = game.link, ui = game.ui, st = game.state;
  const myKey = `${teamIdx}:${mySlot}`;
  // Ordre fixe des invités chez l'hôte : [A:1 (allie), B:0 (adv1), B:1 (adv2)]
  const guestKeys = ['0:1', '1:0', '1:1'];
  const sendQuitToRoom = (why = 'quit') => {
    if (isHost) {
      for (const pid of peerIds) link.send(pid, { t: 'm4p', rid, step: 'quit', who: st.name, why });
    } else {
      link.send(hostId, { t: 'm4p', rid, step: 'quit', key: myKey, who: st.name, why });
    }
  };
  return {
    foeName,
    sendQuitToRoom,
    sendAct: async (n, action, sum) => {
      if (!isHost) link.send(hostId, { t: 'm4p', rid, step: 'act', n, key: myKey, action, sum });
    },
    waitAllActs: async (n, myAction, mySum, onWaitUi) => {
      if (isHost) {
        onWaitUi?.();
        const byKey = { [myKey]: { ...myAction, slot: mySlot } };
        let failed = null;
        const res = await Promise.all(peerIds.map((pid, idx) => link.wait(pid, (q) => q.t === 'm4p' && q.rid === rid && ((q.step === 'act' && q.n === n) || q.step === 'quit'), 300000).then((q) => ({ key: guestKeys[idx], q }))));
        for (const { key, q } of res) {
          if (q.t !== 'm4p' || q.step === 'quit') {
            failed = { left: q.t === 'left', timeout: q.t === 'timeout', abort: q.t === 'abort', quit: q.step === 'quit', who: q.who || allNames[key] || 'Dresseur' };
            break;
          }
          if (q.sum !== mySum) {
            failed = { desync: true };
            break;
          }
          byKey[key] = { ...q.action, slot: Number(key.split(':')[1]) };
        }
        if (failed) {
          for (const pid of peerIds) link.send(pid, { t: 'm4p', rid, step: 'turn-abort', n, ...failed });
          return failed;
        }
        for (const pid of peerIds) link.send(pid, { t: 'm4p', rid, step: 'turn', n, byKey, sum: mySum });
        return {
          acts: [byKey['0:0'], byKey['0:1']].filter(Boolean),
          foeActs: [byKey['1:0'], byKey['1:1']].filter(Boolean),
        };
      }
      onWaitUi?.();
      const msg = await link.wait(hostId, (q) => q.t === 'm4p' && q.rid === rid && (((q.step === 'turn' || q.step === 'turn-abort') && q.n === n) || q.step === 'quit'), 300000);
      if (msg.t !== 'm4p') return { left: msg.t === 'left', timeout: msg.t === 'timeout', abort: msg.t === 'abort', who: allNames['0:0'] };
      if (msg.step === 'quit' || msg.step === 'turn-abort') return { quit: true, desync: !!msg.desync, left: !!msg.left, who: msg.who || allNames['0:0'] };
      if (msg.sum !== mySum) return { desync: true };
      const byKey = msg.byKey || {};
      return {
        acts: [byKey[`${teamIdx}:0`], byKey[`${teamIdx}:1`]].filter(Boolean),
        foeActs: [byKey[`${1 - teamIdx}:0`], byKey[`${1 - teamIdx}:1`]].filter(Boolean),
      };
    },
    sendSwitch: async (n, idxOrNull) => {
      if (!isHost) link.send(hostId, { t: 'm4p', rid, step: 'sw', n, key: myKey, idx: idxOrNull });
    },
    waitAllSwitches: async (n, neededCanonKeys, myPickIdx, onWaitUi) => {
      if (isHost) {
        onWaitUi?.();
        const needGuests = [];
        peerIds.forEach((pid, idx) => {
          const gk = guestKeys[idx];
          if (neededCanonKeys.includes(gk)) needGuests.push({ pid, gk });
        });
        const byKey = {};
        if (neededCanonKeys.includes(myKey) && myPickIdx != null) byKey[myKey] = myPickIdx;
        let failed = null;
        if (needGuests.length) {
          const res = await Promise.all(needGuests.map(({ pid, gk }) => link.wait(pid, (q) => q.t === 'm4p' && q.rid === rid && ((q.step === 'sw' && q.n === n) || q.step === 'quit'), 300000).then((q) => ({ gk, q }))));
          for (const { gk, q } of res) {
            if (q.t !== 'm4p' || q.step === 'quit') {
              failed = { left: q.t === 'left', timeout: q.t === 'timeout', abort: q.t === 'abort', quit: q.step === 'quit', who: q.who || allNames[gk] };
              break;
            }
            byKey[gk] = q.idx;
          }
        }
        if (failed) {
          for (const pid of peerIds) link.send(pid, { t: 'm4p', rid, step: 'sw-abort', n, ...failed });
          return failed;
        }
        for (const pid of peerIds) link.send(pid, { t: 'm4p', rid, step: 'sw-go', n, byKey });
        return {
          picks: {
            picks0: { 0: byKey['0:0'], 1: byKey['0:1'] },
            picks1: { 0: byKey['1:0'], 1: byKey['1:1'] },
          },
        };
      }
      onWaitUi?.();
      const msg = await link.wait(hostId, (q) => q.t === 'm4p' && q.rid === rid && (((q.step === 'sw-go' || q.step === 'sw-abort') && q.n === n) || q.step === 'quit'), 300000);
      if (msg.t !== 'm4p') return { left: msg.t === 'left', timeout: msg.t === 'timeout', abort: msg.t === 'abort', who: allNames['0:0'] };
      if (msg.step === 'quit' || msg.step === 'sw-abort') return { quit: true, left: !!msg.left, who: msg.who || allNames['0:0'] };
      const byKey = msg.byKey || {};
      return {
        picks: {
          picks0: { 0: byKey[`${teamIdx}:0`], 1: byKey[`${teamIdx}:1`] },
          picks1: { 0: byKey[`${1 - teamIdx}:0`], 1: byKey[`${1 - teamIdx}:1`] },
        },
      };
    },
    sendQuit: () => sendQuitToRoom('forfeit'),
    abortAllWaiters: () => {
      if (isHost) for (const pid of peerIds) link.abort(pid);
      else link.abort(hostId);
    },
    waitUiHint: (box) => ui.typePage(box, 'En attente des 4 dresseurs…', { last: true }),
  };
}

async function runMulti4pSession(game, { rid, rosters, myKey, hostId, peerIds, seed }) {
  const ui = game.ui, st = game.state;
  const [teamStr, slotStr] = myKey.split(':');
  const teamIdx = Number(teamStr);
  const mySlot = Number(slotStr);
  const isHost = myKey === '0:0';

  const teamARosters = [rosters['0:0'], rosters['0:1']];
  const teamBRosters = [rosters['1:0'], rosters['1:1']];
  const sqA = buildCoopSquadParty(teamARosters);
  const sqB = buildCoopSquadParty(teamBRosters);
  const teamAData = {
    name: sqA.ownerNames.join(' & '),
    party: sqA.party,
    owners: sqA.owners,
    ownerNames: sqA.ownerNames,
    hasMega: teamARosters.map((r) => !!r.hasMega),
    bs: teamARosters[0].gender === 'f' ? 'serena' : 'calem',
  };
  const teamBData = {
    name: sqB.ownerNames.join(' & '),
    party: sqB.party,
    owners: sqB.owners,
    ownerNames: sqB.ownerNames,
    hasMega: teamBRosters.map((r) => !!r.hasMega),
    bs: teamBRosters[0].gender === 'f' ? 'serena' : 'calem',
  };
  const meTeam = teamIdx === 0 ? teamAData : teamBData;
  const foeTeam = teamIdx === 0 ? teamBData : teamAData;
  const allNames = {
    '0:0': rosters['0:0'].name,
    '0:1': rosters['0:1'].name,
    '1:0': rosters['1:0'].name,
    '1:1': rosters['1:1'].name,
  };

  const battle = new Multi4pBattle({ meTeam, foeTeam, teamIdx, mySlot, seed });
  const net4p = create4pNet(game, { rid, isHost, hostId, peerIds, teamIdx, mySlot, allNames, foeName: foeTeam.name });

  const realParty = st.party;
  const curtain = await game.encounterIntro('dojoBoss');
  game.musicLock = true;
  game.sound.play('dojoBoss');
  curtain.remove();
  game.bv.pvp = true;
  st.party = battle.sides[0].party;
  let res;
  try {
    res = await game.bv.runCoopDojo(battle, net4p, { bg: 'gym', night: false });
  } finally {
    st.party = realParty;
    game.bv.pvp = false;
    game.bv.close();
    game.musicLock = false;
  }
  game.sound.stopMusic(0.1);
  game.sound.current = null;
  game.updateZone();

  if (res === 'win') {
    await ui.say(`Victoire en 2v2 à 4 joueurs contre ${foeTeam.name} !`);
  } else {
    await ui.say(`${foeTeam.name} remporte ce duel 2v2 à 4 dresseurs !`);
  }
}

/** Lance un vrai combat 2v2 avec 4 joueurs humains connectés (Équipe A [J0,J1] vs Équipe B [J2,J3]) */
export async function lancerMulti4p(game, preOpp = null) {
  const st = game.state, ui = game.ui, link = game.link;
  const who = { speaker: 'Multi 2v2 (4j)', face: 'topdresseur' };
  const healthy = st.party.filter((m) => m && m.hp > 0).length;
  if (healthy < 2) {
    await ui.say('Il te faut au moins 2 Pokémon en forme (1 actif + 1 remplaçant) pour le Multi 2v2 !', who);
    return;
  }
  const allConnected = link?.enabled ? [...link.others.values()] : [];
  const freePeers = allConnected.filter((p) => !p.busy && !p.pvp);
  if (freePeers.length < 3) {
    await ui.say([
      'Le Multi 2v2 à 4 joueurs nécessite 4 dresseurs humains connectés (2 équipes de 2) !',
      `Connecte 3 autres dresseurs via Amis / Connexion (F3) (${freePeers.length} disponible${freePeers.length > 1 ? 's' : ''}).`,
    ], who);
    return;
  }

  let selected = [];
  if (preOpp && !preOpp.busy && !preOpp.pvp) {
    const others = freePeers.filter((p) => p.id !== preOpp.id);
    const partnerAndOne = await selectPeersForRoom(ui, others, 2, 'Choisir ton allié puis le 2e adversaire');
    if (!partnerAndOne) return;
    selected = [partnerAndOne[0], preOpp, partnerAndOne[1]];
  } else {
    const ally = await selectPeersForRoom(ui, freePeers, 1, 'Choisir TON ALLIÉ (Équipe A)');
    if (!ally) return;
    const opps = await selectPeersForRoom(ui, freePeers.filter((p) => p.id !== ally[0].id), 2, 'Choisir les 2 ADVERSAIRES (Équipe B)');
    if (!opps) return;
    selected = [ally[0], opps[0], opps[1]];
  }

  const rid = newId();
  const peerIds = selected.map((p) => p.id);
  const roles = ['Allié (Équipe A)', 'Adversaire 1 (Équipe B)', 'Adversaire 2 (Équipe B)'];
  const summaryNames = `${st.name} & ${selected[0].name} vs ${selected[1].name} & ${selected[2].name}`;
  selected.forEach((p, idx) => {
    link.send(p.id, { t: 'req', rid, kind: 'multi4p', name: st.name, role: roles[idx], summary: summaryNames });
  });

  const box = ui.dialogBox();
  ui.typePage(box, `Invitation Multi 2v2 envoyée aux 3 dresseurs… (Échap : annuler)`, { last: true });
  await wait(30);
  const pop = game.input.push((k) => { if (k === 'b' || k === 'cancel') for (const pid of peerIds) link.abort(pid); });
  const reps = await Promise.all(selected.map((p) => link.wait(p.id, (m) => m.t === 'm4p-rep' && m.rid === rid, 30000).then((m) => ({ peer: p, m }))));
  pop();
  ui.closeDialog();

  if (!reps.every(({ m }) => m.t === 'm4p-rep' && m.ok)) {
    for (const pid of peerIds) link.send(pid, { t: 'm4p-cancel', rid });
    await ui.say('Un des 4 dresseurs n\'a pas confirmé le combat.', who);
    return;
  }

  game.busy = true;
  game.session = rid;
  try {
    const myMons = await pickDojoPair(game, who);
    if (!myMons) {
      for (const pid of peerIds) link.send(pid, { t: 'm4p-cancel', rid });
      await ui.say('Combat 2v2 à 4 joueurs annulé.', who);
      return;
    }
    const peerRes = await hostWaitAll(
      game, peerIds,
      (pid) => (q) => q.t === 'm4p' && q.rid === rid && (q.step === 'roster' || q.step === 'quit'),
      'En attente de la sélection des 3 autres joueurs…'
    );
    if (peerRes.some(({ m }) => m.t !== 'm4p' || m.step !== 'roster' || !Array.isArray(m.mons) || m.mons.length < 2 || !m.mons.every(validMon))) {
      for (const pid of peerIds) link.send(pid, { t: 'm4p-cancel', rid });
      await ui.say('Le Multi 2v2 a été annulé avant le coup d\'envoi.', who);
      return;
    }
    const keys = ['0:1', '1:0', '1:1'];
    const rosters = {
      '0:0': { id: link.myId, name: st.name, gender: st.gender, hasMega: !!st.bag[MEGA_RING], mons: myMons },
    };
    peerRes.forEach(({ pid, m }, idx) => {
      rosters[keys[idx]] = {
        id: pid,
        name: String(m.name || selected[idx].name).slice(0, 12),
        gender: m.gender === 'f' ? 'f' : 'm',
        hasMega: !!m.hasMega,
        mons: m.mons.slice(0, 2),
      };
    });
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    peerIds.forEach((pid, idx) => {
      link.send(pid, { t: 'm4p', rid, step: 'start', rosters, myKey: keys[idx], hostId: link.myId, seed });
    });
    await runMulti4pSession(game, { rid, rosters, myKey: '0:0', hostId: link.myId, peerIds, seed });
  } finally {
    game.busy = false;
    game.session = null;
  }
}

export async function onMulti4pInvite(game, from, m) {
  const link = game.link, st = game.state, ui = game.ui;
  const free = st && game.player && !game.busy && game.input.free && !game.bv.alive && !game.session && !game.player.move;
  if (!free) { link.send(from, { t: 'm4p-rep', rid: m.rid, ok: false, why: 'busy' }); return; }
  if (st.party.filter((p) => p && p.hp > 0).length < 2) {
    link.send(from, { t: 'm4p-rep', rid: m.rid, ok: false, why: 'nomon' });
    return;
  }

  const name = String(m.name || link.nameOf(from)).slice(0, 12);
  game.busy = true;
  game.session = m.rid;
  try {
    let gone = false;
    void link.wait(from, (q) => q.t === 'm4p-cancel' && q.rid === m.rid, 30000).then((r) => {
      gone = true;
      const open = ui.root.querySelector('.list.choice');
      if (open && open._close) open._close(1);
      return r;
    });
    ui.sound.sfx('bang');
    const yes = await ui.yesNo(`${name} t'invite en Multi 2v2 (4 joueurs · ${m.summary || ''}) comme ${m.role || 'participant'} ! Accepter ?`, { speaker: name });
    if (gone) { ui.closeDialog(); await ui.say(`${name} a annulé le combat 2v2.`); return; }
    link.abort(from);
    link.send(from, { t: 'm4p-rep', rid: m.rid, ok: yes });
    if (!yes) return;

    const myMons = await pickDojoPair(game, { speaker: 'Multi 2v2 (4j)', face: 'topdresseur' });
    if (!myMons) { link.send(from, { t: 'm4p', rid: m.rid, step: 'quit', who: st.name }); return; }
    link.send(from, { t: 'm4p', rid: m.rid, step: 'roster', name: st.name, gender: st.gender, hasMega: !!st.bag[MEGA_RING], mons: myMons });

    const startMsg = await guestWaitHost(
      game, from,
      (q) => (q.t === 'm4p' && q.rid === m.rid && q.step === 'start') || (q.t === 'm4p-cancel' && q.rid === m.rid),
      `En attente du lancement du Multi 2v2 par ${name}…`
    );
    if (startMsg.t !== 'm4p' || startMsg.step !== 'start') {
      if (startMsg.t === 'abort') link.send(from, { t: 'm4p', rid: m.rid, step: 'quit', who: st.name });
      await ui.say('Le Multi 2v2 n\'a pas commencé.');
      return;
    }
    await runMulti4pSession(game, { ...startMsg, rid: m.rid, hostId: from, peerIds: [] });
  } finally {
    game.busy = false;
    game.session = null;
  }
}

/* ======================================================================
   4. TOURNOI EN DIRECT DANS LE SALON / COLISÉE (ARBRE À 4 PLACES)
   ====================================================================== */

export const TOURNOI_CHAMPIONS = [
  { id: 'bot:basalte', name: 'Basalte', ow: 'basalte', team: [[1026, 40], [111, 41], [1028, 42], [95, 42], [1027, 44]] },
  { id: 'bot:pyros', name: 'Pyros', ow: 'pyros', team: [[1041, 45], [78, 46], [1005, 46], [126, 47], [1042, 49]] },
  { id: 'bot:drakos', name: 'Drakos', ow: 'drakos', team: [[1049, 50], [1044, 52], [148, 52], [1050, 53], [149, 54], [1051, 56]] },
  { id: 'bot:celestine', name: 'Célestine', ow: 'celestine', team: [[1016, 77], [1046, 78], [1035, 78], [1040, 79], [248, 79], [149, 81]] },
];

/** Construit un arbre de tournoi à 4 places en complétant les places manquantes par des Champions IA */
export function buildTournoiBracket(humanSeats, championsPool = TOURNOI_CHAMPIONS, lvl = 55) {
  const seats = humanSeats.map((h) => ({ ...h, bot: false }));
  let cIdx = 0;
  while (seats.length < 4) {
    const ch = championsPool[cIdx % championsPool.length];
    const scaled = ch.team.slice(0, 4).map(([sp, baseLvl]) => [sp, Math.max(40, Math.min(85, Math.round((lvl + baseLvl) / 2)))]);
    seats.push({ id: `${ch.id}:${cIdx}`, name: ch.name, ow: ch.ow, bot: true, team: scaled });
    cIdx++;
  }
  return {
    seats: seats.slice(0, 4),
    matches: [
      { id: 'D1', label: 'Demi-finale 1', a: 0, b: 3, winner: null, loser: null },
      { id: 'D2', label: 'Demi-finale 2', a: 1, b: 2, winner: null, loser: null },
      { id: 'F', label: 'Finale', a: null, b: null, winner: null, loser: null },
    ],
  };
}

/** Affiche l'arbre visuel B2W2 du tournoi en surimpression (clic ou touche A/B/Entrée pour fermer) */
export async function showBracketModal(game, bracket, title = '🏆 TOURNOI DU COLISÉE', autoMs = 2600) {
  const ui = game.ui;
  const seatRow = (match, idx) => {
    const s = idx != null ? bracket.seats[idx] : null;
    if (!s) {
      return `<div class="tournoi-seat"><span class="tournoi-name" style="color:#64748b">À déterminer…</span></div>`;
    }
    const isWin = match.winner === idx;
    const isLose = match.loser === idx;
    const spr = ASSETS.trainer(s.ow || (s.gender === 'f' ? 'player_f' : 'player_m'));
    const tagCls = s.bot ? 'tournoi-tag bot' : 'tournoi-tag';
    const tagTxt = s.bot ? 'CHAMPION' : 'HUMAIN';
    return `<div class="tournoi-seat${isWin ? ' is-win' : isLose ? ' is-lose' : ''}">
      <img class="tournoi-avatar" src="${spr}" alt="" onerror="this.style.display='none'">
      <span class="tournoi-name">${isWin ? '👑 ' : ''}${esc(s.name)}</span>
      <span class="${tagCls}">${tagTxt}</span>
    </div>`;
  };
  const matchCard = (m, isFinal = false) => {
    const ready = m.a != null && m.b != null && m.winner == null;
    const stateTxt = m.winner != null ? '✓ TERMINÉ' : ready ? '⚔️ EN COURS' : 'EN ATTENTE';
    return `<div class="tournoi-match${isFinal ? ' is-final' : ''}${ready ? ' is-active' : ''}">
      <div class="tournoi-match-top"><span>${esc(m.label)}</span><span>${stateTxt}</span></div>
      ${seatRow(m, m.a)}
      ${seatRow(m, m.b)}
    </div>`;
  };
  const finalMatch = bracket.matches[2];
  const champ = finalMatch?.winner != null ? bracket.seats[finalMatch.winner] : null;
  const champBox = champ
    ? `<div class="tournoi-champ">🏆 Vainqueur : ${esc(champ.name)}</div>`
    : `<div class="tournoi-champ" style="opacity:.7">🥇 En attente du Champion</div>`;

  const s = el('div', 'screen tournoi-modal');
  s.innerHTML = `<div class="tournoi-casing">
    <div class="tournoi-hdr">
      <div class="tournoi-title">${esc(title)}</div>
      <div class="tournoi-sub">4 PARTICIPANTS · ÉLIMINATION DIRECTE</div>
    </div>
    <div class="tournoi-grid">
      <div class="tournoi-col">
        ${matchCard(bracket.matches[0])}
        ${matchCard(bracket.matches[1])}
      </div>
      <div class="tournoi-col">
        ${matchCard(finalMatch, true)}
        ${champBox}
      </div>
    </div>
    <div class="tournoi-foot"><button type="button" class="tournoi-ok">Continuer</button></div>
  </div>`;
  ui.root.appendChild(s);
  await new Promise((res) => {
    let done = false;
    const pop = game.input?.push ? game.input.push((k) => { if (k === 'a' || k === 'b' || k === 'start') finish(); }) : () => {};
    const finish = () => { if (done) return; done = true; clearTimeout(t); pop(); s.remove(); res(); };
    const t = autoMs > 0 ? setTimeout(finish, autoMs) : 0;
    s.querySelector('.tournoi-ok').onclick = finish;
  });
}

function buildTournoiBotParty(seat, lvl, seed) {
  const r = seededRng(seed >>> 0);
  const src = LEADERS.find((l) => l.name === seat.name)?.team || seat.team;
  return src.slice(0, 4).map(([sp]) => createMon(sp, Math.max(45, lvl), { iv: [24, 24, 24, 24, 24, 24], rng: r }));
}

function simBotMatch(seatA, seatB, lvl, format, seed) {
  const partyA = buildTournoiBotParty(seatA, lvl, seed ^ 0x1111);
  const partyB = buildTournoiBotParty(seatB, lvl, seed ^ 0x2222);
  const b = new Battle({
    player: { name: seatA.name, party: partyA, bag: {} },
    foe: { name: seatB.name, party: partyB, trainer: { cls: 'Champion', name: seatB.name, bs: seatB.ow, ai: 'smart', prize: 0 } },
    rng: seededRng(seed >>> 0),
    format,
  });
  // Simulation rapide en boucle IA
  let guard = 0;
  while (b.state !== 'over' && guard++ < 80) {
    if (b.state === 'switch') {
      const need = b.needPlayerSlots?.length ? b.needPlayerSlots : [0];
      const picks = need.map(() => partyA.findIndex((m, idx) => m && m.hp > 0 && !b.sides[0].activeSlots.includes(idx)));
      b.playerSwitch(picks);
      continue;
    }
    const acts = b.aliveSlots(0).map((sl) => {
      const usable = b.usableMoves({ side: 0, slot: sl });
      const mvIdx = usable.length ? usable[Math.floor(b.rng() * usable.length)] : 0;
      const foes = b.aliveSlots(1);
      return { slot: sl, type: 'move', idx: mvIdx, targetSide: 1, targetSlot: foes[0] ?? 0 };
    });
    b.playerAction(format === 'single' ? acts[0] : acts);
  }
  return b.result === 'win' ? 'A' : 'B';
}

/** Exécute un match Joueur vs Champion IA en diffusant les événements en direct aux spectateurs du tournoi */
async function playHumanVsBotTournoi(game, botSeat, lvl, format, seed, matchRid) {
  const st = game.state, link = game.link;
  const party = battleCopy(st.party);
  const botParty = buildTournoiBotParty(botSeat, lvl, seed);
  const battle = new Battle({
    player: { name: st.name, party, bag: {} },
    foe: { name: botSeat.name, party: botParty, trainer: { cls: 'Champion', name: botSeat.name, bs: botSeat.ow || 'drakos', ai: 'smart', prize: 0 } },
    rng: seededRng(seed >>> 0),
    format,
  });
  const spectators = new Set();
  const prevSpec = link.onSpectate;
  const exportSnap = () => ({
    turn: battle.turn, slots: battle.slots, weather: battle.weather, weatherTurns: battle.weatherTurns, bg: 'league', night: false,
    p0: { name: st.name, bs: st.gender === 'f' ? 'serena' : 'calem', active: battle.sides[0].active, activeSlots: [...battle.sides[0].activeSlots], st: [...battle.sides[0].v.st], party: battle.sides[0].party.map((m) => ({ sp: m.sp, lvl: m.lvl, hp: m.hp, stats: m.stats, status: m.status, shiny: !!m.shiny, shadow: !!m.shadow, nick: m.nick || null })) },
    p1: { name: botSeat.name, bs: botSeat.ow || 'drakos', active: battle.sides[1].active, activeSlots: [...battle.sides[1].activeSlots], st: [...battle.sides[1].v.st], party: battle.sides[1].party.map((m) => ({ sp: m.sp, lvl: m.lvl, hp: m.hp, stats: m.stats, status: m.status, shiny: !!m.shiny, shadow: !!m.shadow, nick: m.nick || null })) },
  });
  link.onSpectate = (fid, msg) => {
    if (msg.t === 'spec_join') { spectators.add(fid); link.send(fid, { t: 'spec_init', rid: msg.rid || matchRid, ...exportSnap() }); return true; }
    if (msg.t === 'spec_leave') { spectators.delete(fid); return true; }
    return false;
  };
  const { drainPendingSpecJoins } = await import('./net/social.js');
  drainPendingSpecJoins(link);
  const bcast = (events) => {
    if (!events?.length || !spectators.size) return;
    for (const sid of spectators) link.send(sid, { t: 'spec_ev', rid: matchRid, turn: battle.turn, events });
  };

  const realParty = st.party;
  const curtain = await game.encounterIntro('elite4');
  game.musicLock = true;
  game.sound.play('elite4');
  curtain.remove();
  st.party = battle.sides[0].party;
  try {
    const bv = game.bv;
    bv.battle = battle; bv.slots = battle.slots || 1; bv.kind = 'league'; bv.alive = true;
    bv.lastMove = 0; bv.lastMoveMon = null; bv.seenInBattle = new Set();
    bv.initState(); bv.buildDom();
    bv.root.style.setProperty('--bp', (innerHeight / 200) + 'px');
    bv.updateWeather(battle.weather);
    for (let sl = 0; sl < bv.slots; sl++) { bv.setHud(1, null, 0, sl); bv.setHud(0, null, 0, sl); }
    const jobs = [bv.loadBattleDecor('league', false)];
    for (let sl = 0; sl < bv.slots; sl++) jobs.push(bv.loadSide(1, sl), bv.loadSide(0, sl));
    await Promise.all(jobs);
    if (battle.sides[1].trainer) bv.st.trainer.img = await (await import('./assets.js')).loadImg((await import('./assets.js')).ASSETS.trainer(battle.sides[1].trainer.bs));
    requestAnimationFrame(bv.frame);
    bv.st.screenFlash = 0; bv.st.trainer.visible = true;
    await bv.tween(550, (u) => { const e = 1 - (1 - u) * (1 - u); bv.st.eSlide = -bv.W * (1 - e); bv.st.pSlide = bv.W * (1 - e); });
    const evStart = battle.start();
    bcast(evStart);
    await bv.play(evStart);
    while (battle.state !== 'over') {
      if (battle.state === 'switch') {
        const need = battle.needPlayerSlots?.length ? battle.needPlayerSlots : [0];
        const picks = bv.slots === 1
          ? await partyScreen(game, { mode: 'pick', pickLabel: 'Envoyer', prompt: 'Envoyer quelle créature ?', filter: (m, i) => (m.hp <= 0 ? 'K.O.' : i === battle.sides[0].active ? 'Au combat' : null) })
          : await bv.pickReplacementList(need);
        if (bv.slots === 1 && picks < 0) continue;
        const evSw = battle.playerSwitch(picks);
        bcast(evSw);
        await bv.play(evSw);
        continue;
      }
      const action = await bv.chooseAction();
      if (!action) continue;
      const evAct = battle.playerAction(action);
      bcast(evAct);
      await bv.play(evAct);
    }
    const winnerName = battle.result === 'win' ? st.name : botSeat.name;
    for (const sid of spectators) link.send(sid, { t: 'spec_end', rid: matchRid, winner: winnerName });
    await wait(400);
  } finally {
    st.party = realParty;
    game.bv.close();
    game.musicLock = false;
    link.onSpectate = prevSpec;
  }
  game.sound.stopMusic(0.1);
  game.sound.current = null;
  game.updateZone();
  return battle.result === 'win' ? 'win' : 'lose';
}

async function grantTournoiRewards(game, bracket, myId, isSingleHuman) {
  const ui = game.ui, st = game.state, D = ensureDojo(st);
  const f = bracket.matches[2];
  const winnerSeat = bracket.seats[f.winner];
  const finalistSeat = bracket.seats[f.loser];
  const won = winnerSeat?.id === myId;
  const second = !won && finalistSeat?.id === myId;

  if (won) {
    D.pdj += 10;
    st.money += 15000;
    game.sound.sfx('item');
    game.save(true);
    await ui.say(`🏆 Champion du Tournoi ${winnerSeat.name} ! Tu remportes 10 PDj et 15 000 ₽ !`);
  } else if (second) {
    D.pdj += 5;
    st.money += 5000;
    game.sound.sfx('item');
    game.save(true);
    await ui.say(`🥈 Beau parcours jusqu'en Finale ! Tu gagnes 5 PDj et 5 000 ₽ !`);
  } else {
    D.pdj += 2;
    game.save(true);
    await ui.say(`🥉 Merci pour ta participation au Tournoi ! Tu reçois 2 PDj.${isSingleHuman ? '' : ''}`);
  }
}

async function runGuestTournoiLoop(game, { rid, hostId, format, bracket, lvl }) {
  const st = game.state, ui = game.ui, link = game.link;
  const myId = link.myId;
  const { battleSession, spectateSession } = await import('./net/social.js');

  for (const mIdx of [0, 1, 2]) {
    const sync = await guestWaitHost(
      game, hostId,
      (q) => q.t === 'tournoi' && q.rid === rid && (q.step === 'match' || q.step === 'done' || q.step === 'cancel'),
      'En attente du prochain match du Tournoi…'
    );
    if (sync.t !== 'tournoi' || sync.step !== 'match') {
      if (sync.step === 'done' && sync.bracket) await showBracketModal(game, sync.bracket, '🏆 RÉSULTAT DU TOURNOI');
      return;
    }
    bracket = sync.bracket;
    const match = bracket.matches[sync.matchIdx];
    await showBracketModal(game, bracket, `${match.label} · ${format === 'double' ? '2v2' : '1v1'}`, 2200);
    const sA = bracket.seats[match.a];
    const sB = bracket.seats[match.b];

    if (sA.id === myId || sB.id === myId) {
      const opp = sA.id === myId ? sB : sA;
      let won = false;
      const mRid = `${rid}:m${sync.matchIdx}`;
      if (opp.bot) {
        const res = await playHumanVsBotTournoi(game, opp, lvl, format, sync.seed, mRid);
        won = res === 'win';
      } else {
        const amChallenger = sA.id === myId;
        const outcome = await battleSession(game, opp.id, opp.name, opp.gender || 'm', mRid, amChallenger, format);
        won = outcome === 'win';
      }
      link.send(hostId, { t: 'tournoi', rid, step: 'match-res', matchIdx: sync.matchIdx, winnerId: won ? myId : opp.id });
    } else if (!sA.bot || !sB.bot) {
      const hostSpec = !sA.bot ? sA : sB;
      const mRid = `${rid}:m${sync.matchIdx}`;
      ui.toast(`Match en direct : ${sA.name} vs ${sB.name} ! Ouverture du mode Spectateur…`, 2200);
      game.busy = false; game.session = null;
      try {
        await spectateSession(game, hostSpec.id, mRid, sA.name, sB.name);
      } finally {
        game.busy = true; game.session = rid;
      }
    } else {
      await ui.say(`Simulation de ${sA.name} vs ${sB.name}…`);
    }

    const upd = await guestWaitHost(
      game, hostId,
      (q) => q.t === 'tournoi' && q.rid === rid && q.step === 'match-upd' && q.matchIdx === sync.matchIdx,
      'Mise à jour du tableau du Tournoi…', false
    );
    if (upd.bracket) bracket = upd.bracket;
  }

  const endMsg = await guestWaitHost(
    game, hostId,
    (q) => q.t === 'tournoi' && q.rid === rid && q.step === 'done',
    'Clôture du Tournoi…', false
  );
  if (endMsg.bracket) {
    await showBracketModal(game, endMsg.bracket, '🏆 FIN DU TOURNOI', 3500);
    await grantTournoiRewards(game, endMsg.bracket, myId, false);
  }
}

/** Lance un Tournoi en direct à 4 places (humains connectés + Champions IA si < 4 humains) */
export async function lancerTournoiSalon(game) {
  const st = game.state, ui = game.ui, link = game.link;
  const who = { speaker: 'Arbitre du Colisée', face: 'celestine' };
  const healthy = st.party.filter((m) => m && m.hp > 0).length;
  if (healthy < 1) {
    await ui.say('Il te faut au moins 1 Pokémon en forme pour participer au Tournoi !', who);
    return;
  }

  const fmtPick = await ui.ask('Quel format pour le Tournoi à 4 places ?', ['Solo (1v1)', 'Duo (2v2)', 'Annuler'], who);
  if (fmtPick !== 0 && fmtPick !== 1) return;
  const format = fmtPick === 1 ? 'double' : 'single';
  if (format === 'double' && healthy < 2) {
    await ui.say('Il te faut au moins 2 Pokémon en forme pour un Tournoi Duo (2v2) !', who);
    return;
  }

  const freePeers = (link?.enabled ? [...link.others.values()] : []).filter((p) => !p.busy && !p.pvp);
  let invitedPeers = [];
  if (freePeers.length > 0) {
    const inviteMode = await ui.ask(`Inviter des amis connectés (${freePeers.length} dispo) ? Les places libres seront tenues par des Champions.`, ['Inviter tous les amis libres (max 3)', 'Choisir les amis', 'Tournoi solo vs 3 Champions', 'Annuler'], who);
    if (inviteMode === 3 || inviteMode < 0) return;
    if (inviteMode === 0) invitedPeers = freePeers.slice(0, 3);
    else if (inviteMode === 1) {
      const k = await ui.list({ title: 'Combien d\'amis inviter ?', items: freePeers.slice(0, 3).map((_, i) => ({ label: `${i + 1} ami${i > 0 ? 's' : ''}` })).concat([{ label: 'Annuler' }]), cancel: Math.min(3, freePeers.length) });
      if (k < 0 || k >= Math.min(3, freePeers.length)) return;
      invitedPeers = await selectPeersForRoom(ui, freePeers, k + 1, 'Inviter au Tournoi') || [];
      if (!invitedPeers.length) return;
    }
  } else {
    const goSolo = await ui.yesNo('Aucun ami connecté pour l\'instant : lancer un Tournoi à 4 places contre 3 Champions du Colisée ?', who);
    if (!goSolo) return;
  }

  const rid = newId();
  const lvl = Math.max(50, ...st.party.map((m) => m.lvl || 50));
  let confirmedPeers = [];
  if (invitedPeers.length) {
    for (const p of invitedPeers) {
      link.send(p.id, { t: 'req', rid, kind: 'tournoi', format, name: st.name, lvl });
    }
    const box = ui.dialogBox();
    ui.typePage(box, `Inscription au Tournoi envoyée à ${invitedPeers.map((p) => p.name).join(', ')}…`, { last: true });
    await wait(30);
    const reps = await Promise.all(invitedPeers.map((p) => link.wait(p.id, (m) => m.t === 'tournoi-rep' && m.rid === rid, 25000).then((m) => ({ peer: p, m }))));
    ui.closeDialog();
    confirmedPeers = reps.filter(({ m }) => m.t === 'tournoi-rep' && m.ok).map(({ peer, m }) => ({ peer, lvl: m.lvl || 50 }));
    for (const { peer, m } of reps) {
      if (!(m.t === 'tournoi-rep' && m.ok)) link.send(peer.id, { t: 'tournoi-cancel', rid });
    }
  }

  const peerIds = confirmedPeers.map(({ peer }) => peer.id);
  const humanSeats = [
    { id: link.myId, name: st.name, ow: st.gender === 'f' ? 'serena' : 'calem', gender: st.gender },
    ...confirmedPeers.map(({ peer }) => ({ id: peer.id, name: peer.name, ow: peer.gender === 'f' ? 'serena' : 'calem', gender: peer.gender })),
  ];
  const tourLvl = Math.max(lvl, ...confirmedPeers.map((c) => c.lvl));
  const bracket = buildTournoiBracket(humanSeats, TOURNOI_CHAMPIONS, tourLvl);

  const { battleSession, spectateSession } = await import('./net/social.js');
  game.busy = true;
  game.session = rid;
  try {
    for (const pid of peerIds) {
      link.send(pid, { t: 'tournoi', rid, step: 'start', format, bracket, lvl: tourLvl });
    }

    const humanIds = new Set(humanSeats.map((h) => h.id));
    for (const matchIdx of [0, 1, 2]) {
      const m = bracket.matches[matchIdx];
      const sA = bracket.seats[m.a];
      const sB = bracket.seats[m.b];
      const spectIds = [...humanIds].filter((id) => id !== sA.id && id !== sB.id && id !== link.myId);
      const seed = ((Date.now() ^ (matchIdx * 7919)) >>> 0);

      for (const pid of peerIds) {
        link.send(pid, { t: 'tournoi', rid, step: 'match', matchIdx, bracket, seed, spectators: spectIds });
      }
      await showBracketModal(game, bracket, `${m.label} · ${format === 'double' ? '2v2' : '1v1'}`, 2400);

      let winnerSeatIdx = m.a;
      if (sA.bot && sB.bot) {
        const res = simBotMatch(sA, sB, tourLvl, format, seed);
        winnerSeatIdx = res === 'A' ? m.a : m.b;
        await ui.say(`${m.label} : ${bracket.seats[winnerSeatIdx].name} bat ${bracket.seats[winnerSeatIdx === m.a ? m.b : m.a].name} !`, who);
      } else if (sA.id === link.myId || sB.id === link.myId) {
        const opp = sA.id === link.myId ? sB : sA;
        const mRid = `${rid}:m${matchIdx}`;
        let myWin = false;
        if (opp.bot) {
          myWin = (await playHumanVsBotTournoi(game, opp, tourLvl, format, seed, mRid)) === 'win';
        } else {
          const amChallenger = sA.id === link.myId;
          const outcome = await battleSession(game, opp.id, opp.name, opp.gender || 'm', mRid, amChallenger, format);
          myWin = outcome === 'win';
        }
        winnerSeatIdx = (myWin && sA.id === link.myId) || (!myWin && sB.id === link.myId) ? m.a : m.b;
      } else {
        // Ni l'hôte ni pure IA : un autre humain joue le match -> l'hôte regarde en spectateur et attend son rapport
        const driverSeat = !sA.bot ? sA : sB;
        const mRid = `${rid}:m${matchIdx}`;
        const waitProm = link.wait(driverSeat.id, (q) => q.t === 'tournoi' && q.rid === rid && q.step === 'match-res' && q.matchIdx === matchIdx, 300000);
        ui.toast(`Match en direct : ${sA.name} vs ${sB.name} ! Ouverture du mode Spectateur…`, 2200);
        game.busy = false; game.session = null;
        try {
          await spectateSession(game, driverSeat.id, mRid, sA.name, sB.name);
        } finally {
          game.busy = true; game.session = rid;
        }
        const rep = await waitProm;
        winnerSeatIdx = rep?.winnerId === sB.id ? m.b : m.a;
      }

      m.winner = winnerSeatIdx;
      m.loser = winnerSeatIdx === m.a ? m.b : m.a;
      if (matchIdx === 0) bracket.matches[2].a = m.winner;
      if (matchIdx === 1) bracket.matches[2].b = m.winner;
      for (const pid of peerIds) {
        link.send(pid, { t: 'tournoi', rid, step: 'match-upd', matchIdx, bracket });
      }
    }

    for (const pid of peerIds) link.send(pid, { t: 'tournoi', rid, step: 'done', bracket });
    await showBracketModal(game, bracket, '🏆 FIN DU TOURNOI', 3600);
    await grantTournoiRewards(game, bracket, link.myId, peerIds.length === 0);
  } finally {
    game.busy = false;
    game.session = null;
  }
}

export async function onTournoiInvite(game, from, m) {
  const link = game.link, st = game.state, ui = game.ui;
  const free = st && game.player && !game.busy && game.input.free && !game.bv.alive && !game.session && !game.player.move;
  if (!free) { link.send(from, { t: 'tournoi-rep', rid: m.rid, ok: false, why: 'busy' }); return; }
  const minMon = m.format === 'double' ? 2 : 1;
  if (st.party.filter((p) => p && p.hp > 0).length < minMon) {
    link.send(from, { t: 'tournoi-rep', rid: m.rid, ok: false, why: 'nomon' });
    return;
  }

  const name = String(m.name || link.nameOf(from)).slice(0, 12);
  game.busy = true;
  game.session = m.rid;
  try {
    let gone = false;
    void link.wait(from, (q) => q.t === 'tournoi-cancel' && q.rid === m.rid, 25000).then((r) => {
      gone = true;
      const open = ui.root.querySelector('.list.choice');
      if (open && open._close) open._close(1);
      return r;
    });
    ui.sound.sfx('bang');
    const yes = await ui.yesNo(`${name} t'invite au Tournoi en direct (${m.format === 'double' ? 'Duo 2v2' : 'Solo 1v1'}, 4 places) ! Participer ?`, { speaker: name });
    if (gone) { ui.closeDialog(); await ui.say(`${name} a lancé le Tournoi sans toi.`); return; }
    link.abort(from);
    const myLvl = Math.max(50, ...st.party.map((p) => p.lvl || 50));
    link.send(from, { t: 'tournoi-rep', rid: m.rid, ok: yes, lvl: myLvl });
    if (!yes) return;

    const startMsg = await guestWaitHost(
      game, from,
      (q) => (q.t === 'tournoi' && q.rid === m.rid && q.step === 'start') || (q.t === 'tournoi-cancel' && q.rid === m.rid),
      `En attente du tirage au sort du Tournoi par ${name}…`
    );
    if (startMsg.t !== 'tournoi' || startMsg.step !== 'start') {
      await ui.say('Le Tournoi n\'a pas démarré.');
      return;
    }
    await runGuestTournoiLoop(game, { rid: m.rid, hostId: from, format: startMsg.format, bracket: startMsg.bracket, lvl: startMsg.lvl });
  } finally {
    game.busy = false;
    game.session = null;
  }
}
