// pokemon/net/host.js
// Hôte autoritaire du tournoi Poké Duel : enchaîne les phases (draft → arbre → aperçu → combat → résumé → podium),
// tient tous les chronos, fait jouer les bots et diffuse l'état à tous les joueurs.
// Les invités ne font qu'envoyer leurs choix ; seul l'hôte peut relancer un tournoi.

import {
  createTournament, submitDraft, draftComplete, closeDraft, resolveAutomatic, nextPlayableMatch,
  openPreview, setReady, buildBattle, recordGame, koCredits, markGone, isOver, currentMatch,
  getParticipant, sideOf, placeOf, isMulti, slotOf, allReady,
} from '../engine/tournament.js';
import { resolveTurn, resolveActions, forceSwitch, estimateTurnDuration, runEntry, sidesOf, teamKey, getActivePokemon } from '../engine/battle.js';
import { chooseBotAction, chooseBestSwitch, chooseDoublesAction, chooseDoublesSwitch } from '../engine/bot.js';

// Combat en double (VGC) : un joueur (A ou B) commande deux emplacements (A et C, ou B et D)
const slotsOf = (b, side) => sidesOf(b).filter((s) => teamKey(s) === side);
const aliveSlots = (b) => sidesOf(b).filter((s) => { const p = getActivePokemon(b, s); return p && !p.fainted; });

const DRAFT_SECS = 50;
const REVEAL_SECS = 8;     // premier affichage de l'arbre après le draft
const BRACKET_SECS = 6;    // arbre entre deux matchs
const PREVIEW_SECS = 25;   // aperçu des équipes et choix du Pokémon de tête
const SUMMARY_SECS = 9;    // résumé de manche
const AFTER_VICTORY_MS = 1200;
const SPLASH_MS = 2300;     // écran « VS » avant chaque manche

export function startHost({ bridge, solo, settings, me, onState, resume = null }) {
  const timerSecs = Number(settings.timer) || 25;
  const difficulty = settings.level || 'normal';

  let t = null;            // tournoi
  let battle = null;       // combat en cours
  let credits = [];        // K.O. de la manche en cours
  let pending = { A: null, B: null };
  let slotPending = {};    // combat en double : action de chaque emplacement (A, C, B, D)
  let leadPick = { A: null, B: null }; // choix de tête des humains, gardés secrets jusqu'à l'envoi
  let cont = { A: false, B: false };   // « Continuer » sur le résumé
  let deadline = 0;        // fin de la phase en cours (draft, arbre, aperçu, résumé)
  let turnEndsAt = 0;      // fin du choix en combat (attaque ou remplacement)
  let evSeq = 0;
  let intro = false;       // combat affiché, Pokémon pas encore envoyés
  let reported = false;
  let alive = true;

  let phaseTimer = null;
  let turnTimer = null;
  const later = [];        // délais liés au combat en cours, annulés en cas de forfait

  const same = (a, b) => String(a) === String(b);
  const clearPhase = () => { clearTimeout(phaseTimer); phaseTimer = null; };
  const clearTurn = () => { clearTimeout(turnTimer); turnTimer = null; turnEndsAt = 0; };
  const clearLater = () => { while (later.length) clearTimeout(later.pop()); };
  const after = (ms, fn) => { const id = setTimeout(() => { if (alive) fn(); }, ms); later.push(id); return id; };
  const setDeadline = (secs, fn) => {
    clearPhase();
    deadline = Date.now() + secs * 1000;
    phaseTimer = setTimeout(() => { if (alive) fn(); }, secs * 1000);
  };

  // ------------------------------------------------------------------ joueurs

  function humanPlayers() {
    if (solo) return [{ id: me.id, name: me.name, color: me.color }];
    const list = (bridge && Array.isArray(bridge.players) ? bridge.players : []).map((p) => ({
      id: p.id, name: p.name || 'Dresseur', color: p.color || '#ff4b2b',
    }));
    if (!list.some((p) => same(p.id, me.id))) list.unshift({ id: me.id, name: me.name, color: me.color });
    return list;
  }

  // ------------------------------------------------------------------ diffusion

  function broadcast(events = []) {
    if (!t || !alive) return;
    if (events.length) evSeq++;
    const m = currentMatch(t);
    const pub = {
      v: 2,
      phase: t.phase,
      t: { ...t, lead: { A: null, B: null } }, // les têtes restent secrètes jusqu'au combat
      battle: t.phase === 'battle' ? battle : null,
      deadline,
      turnEndsAt,
      timerSecs,
      submittedA: battle && battle.doubles ? slotsOf(battle, 'A').every((x) => slotPending[x] || !aliveSlots(battle).includes(x)) && Object.keys(slotPending).length > 0 : !!pending.A,
      submittedB: battle && battle.doubles ? slotsOf(battle, 'B').every((x) => slotPending[x] || !aliveSlots(battle).includes(x)) && Object.keys(slotPending).length > 0 : !!pending.B,
      submittedSlots: Object.fromEntries(Object.keys(slotPending).map((k) => [k, true])),
      cont,
      events,
      evSeq,
      hostId: me.id,
      isFinal: !!(m && m.r === t.rounds.length - 1),
      intro,
    };
    if (!solo && bridge) bridge.send('all', { t: 'st', s: pub, now: Date.now() });
    onState(pub, 0);
    if (t.phase === 'podium' && !reported) {
      reported = true;
      reportResults();
    }
  }

  function reportResults() {
    if (!bridge || !bridge.embedded || !bridge.report || !t || t.champion == null) return;
    bridge.report({
      id: `pokemon-${Date.now()}`,
      mode: 'Tournoi 3v3',
      players: t.participants.map((p) => ({
        id: p.bot ? null : p.id,
        name: p.name,
        color: p.color,
        bot: p.bot,
        rank: placeOf(t, p.id),
        score: p.stats.matchW,
      })),
    });
  }

  // ------------------------------------------------------------------ phases

  function newTournament() {
    clearPhase(); clearTurn(); clearLater();
    reported = false;
    battle = null;
    t = createTournament(humanPlayers(), {
      gen: settings.gen || 'all',
      bots: settings.bots !== undefined ? Number(settings.bots) : 1,
      finalBestOf: settings.final !== undefined ? Number(settings.final) : 3,
      format: settings.format || 'single',
    });
    setDeadline(DRAFT_SECS, endDraft);
    broadcast();
  }

  function endDraft() {
    if (t.phase !== 'draft') return;
    closeDraft(t, { difficulty });
    showBracket(REVEAL_SECS);
  }

  function showBracket(secs) {
    battle = null;
    t.phase = 'bracket';
    setDeadline(secs, nextMatch);
    broadcast();
    t.recent = [];
  }

  function nextMatch() {
    resolveAutomatic(t, { difficulty });
    if (isOver(t)) return podium();
    const m = nextPlayableMatch(t);
    if (!m) return podium();
    if (t.recent.length) return showBracket(BRACKET_SECS); // des matchs viennent de se régler tout seuls
    preview(m);
  }

  function preview(m) {
    battle = null;
    leadPick = { A: null, B: null };
    openPreview(t, m);
    setDeadline(PREVIEW_SECS, startGame);
    broadcast();
  }

  function startGame() {
    const m = currentMatch(t);
    if (!m || t.phase !== 'preview') return;
    clearPhase();
    deadline = 0;
    for (const k of Object.keys(leadPick)) if (leadPick[k] != null && k in t.lead) t.lead[k] = leadPick[k];
    battle = buildBattle(t, m);
    credits = [];
    pending = { A: null, B: null };
    const introEvents = sidesOf(battle).map((side) => {
      const p = battle.teamA && (teamKey(side) === 'A' ? battle.teamA : battle.teamB)[battle['active' + side]];
      const tr = teamKey(side) === 'A' ? battle.trainerA : battle.trainerB;
      return {
        type: 'switch', side, pokemonId: p.id, name: p.name, hp: p.hp, maxHp: p.maxHp,
        types: p.types, status: null, trainer: tr.name, msg: `${tr.name} envoie ${p.name} !`,
      };
    });
    // L'écran « VS » s'affiche d'abord, puis les deux dresseurs envoient leur Pokémon
    intro = true;
    broadcast();
    after(SPLASH_MS, () => {
      intro = false;
      introEvents.push(...runEntry(battle));   // Intimidation, météo… dès l'arrivée sur le terrain
      broadcast(introEvents);
      after(estimateTurnDuration(introEvents), startTurn);
    });
  }

  function startTurn() {
    if (!battle || battle.phase !== 'choose') return;
    clearTurn();
    pending = { A: null, B: null };
    turnEndsAt = Date.now() + timerSecs * 1000;
    const b = battle;
    if (b.doubles) {
      // chaque emplacement joue pour lui : les bots (et les joueurs partis) choisissent seuls
      slotPending = {};
      for (const slot of aliveSlots(b)) if (botSlot(b, slot)) after(900 + Math.random() * 1000, () => {
        if (battle === b && b.phase === 'choose' && !slotPending[slot]) setSlot(b, slot, chooseDoublesAction(b, slot, difficulty));
      });
      turnTimer = setTimeout(() => {
        if (!alive || battle !== b || b.phase !== 'choose') return;
        for (const slot of aliveSlots(b)) if (!slotPending[slot]) slotPending[slot] = chooseDoublesAction(b, slot, 'facile');
        resolve();
      }, timerSecs * 1000);
      broadcast();
      return;
    }
    for (const side of ['A', 'B']) {
      const tr = side === 'A' ? b.trainerA : b.trainerB;
      if (tr.bot) after(900 + Math.random() * 1000, () => {
        if (battle === b && b.phase === 'choose' && !pending[side]) submit(side, chooseBotAction(b, side, difficulty));
      });
    }
    turnTimer = setTimeout(() => {
      if (!alive || battle !== b || b.phase !== 'choose') return;
      for (const side of ['A', 'B']) if (!pending[side]) pending[side] = chooseBotAction(b, side, 'facile');
      resolve();
    }, timerSecs * 1000);
    broadcast();
  }

  /** Emplacement joué par l'ordinateur : dresseur bot, ou joueur parti (2 contre 2) */
  function botSlot(b, slot) {
    if (b.owners) { const P = getParticipant(t, b.owners[slot]); return !P || P.bot || P.gone; }
    return !!(teamKey(slot) === 'A' ? b.trainerA : b.trainerB).bot;
  }
  /** Emplacements qu'un joueur commande : les deux de son camp (VGC), ou le sien seul (2 contre 2) */
  function slotsFor(b, side, from) {
    if (b.owners) return sidesOf(b).filter((s) => same(b.owners[s], from));
    return slotsOf(b, side);
  }
  function setSlot(b, slot, act) {
    if (!act || slotPending[slot]) return;
    slotPending[slot] = act;
    broadcast();
    if (aliveSlots(b).every((s) => slotPending[s])) { clearTurn(); after(350, resolve); }
  }

  function submit(side, action, from = me.id) {
    const b = battle;
    if (!b || t.phase !== 'battle' || !action) return;

    // Double : remplacement d'un emplacement (action.slot) après un K.O. ou un Demi-Tour
    if (b.doubles && b.phase === 'switch_forced') {
      const mine = slotsFor(b, side, from).concat(b.owners ? [] : []);
      const slot = action.slot || (b.need || []).find((s) => mine.includes(s));
      const allowed = action.byHost ? teamKey(slot) === side : mine.includes(slot);
      if (action.type !== 'switch' || !slot || !allowed || !b.need.includes(slot)) return;
      const ev = forceSwitch(b, slot, action.targetIndex);
      if (!ev) return;
      if (b.phase === 'choose') { clearTurn(); const evs = [ev, ...runEntry(b)]; broadcast(evs); after(estimateTurnDuration(evs), startTurn); }
      else broadcast([ev]);
      return;
    }
    // Remplacement après un K.O.
    if (b.phase.startsWith('switch_forced')) {
      const needs = b.phase === 'switch_forced_both' || b.phase === `switch_forced_${side}`;
      if (!needs || action.type !== 'switch') return;
      const ev = forceSwitch(b, side, action.targetIndex);
      if (!ev) return;
      if (b.phase === 'choose') {
        clearTurn();
        const evs = [ev, ...runEntry(b)];
        broadcast(evs);
        after(estimateTurnDuration(evs), startTurn);
      } else {
        broadcast([ev]);
      }
      return;
    }

    if (b.doubles) {
      // une action par emplacement commandé par ce joueur ; ce qui manque est choisi pour lui
      if (b.phase !== 'choose' || action.type !== 'pair' || !action.acts) return;
      let added = false;
      for (const s of slotsFor(b, side, from)) {
        if (slotPending[s] || !aliveSlots(b).includes(s)) continue;
        const a = action.acts[s];
        slotPending[s] = a && (a.type === 'move' || a.type === 'switch') ? a : chooseDoublesAction(b, s, 'facile');
        added = true;
      }
      if (!added) return;   // déjà choisi : on ne relance pas le tour une deuxième fois
      broadcast();
      if (aliveSlots(b).every((s) => slotPending[s])) { clearTurn(); after(350, resolve); }
      return;
    }
    if (b.phase !== 'choose' || pending[side]) return;
    if (action.type !== 'move' && action.type !== 'switch') return;
    pending[side] = action;
    broadcast();
    if (pending.A && pending.B) {
      clearTurn();
      after(350, resolve);
    }
  }

  function resolve() {
    const b = battle;
    if (!b || b.phase !== 'choose') return;
    if (b.doubles && !Object.keys(slotPending).length) return;   // tour déjà joué
    const actA = pending.A;
    const actB = pending.B;
    pending = { A: null, B: null };
    clearTurn();
    const sp = slotPending; slotPending = {};
    const { state, events } = b.doubles ? resolveActions(b, sp) : resolveTurn(b, actA, actB);
    battle = state;
    credits.push(...koCredits(battle, events));
    broadcast(events);
    const anim = estimateTurnDuration(events);

    if (battle.phase === 'over') after(anim + AFTER_VICTORY_MS, endGame);
    else if (battle.phase.startsWith('switch_forced')) after(anim, forcedSwitches);
    else after(anim, startTurn);
  }

  // Après un K.O. : les bots choisissent leur remplaçant, les humains ont un chrono (sinon choix auto)
  function forcedSwitches() {
    const b = battle;
    if (!b || !b.phase.startsWith('switch_forced')) return;
    if (b.doubles) {
      // bots : remplaçants tout de suite ; humains : chrono, puis choix automatique
      let humanWaits = false;
      for (const slot of [...b.need]) {
        if (botSlot(b, slot)) after(700 + Math.random() * 500, () => { if (battle !== b || !b.need.includes(slot)) return; const sw = chooseDoublesSwitch(b, slot); if (sw) submit(teamKey(slot), { ...sw, slot, byHost: true }); });
        else humanWaits = true;
      }
      if (!humanWaits) return;
      clearTurn();
      turnEndsAt = Date.now() + timerSecs * 1000;
      turnTimer = setTimeout(() => {
        if (!alive || battle !== b || b.phase !== 'switch_forced') return;
        for (const slot of [...b.need]) { const sw = chooseDoublesSwitch(b, slot); if (sw) submit(teamKey(slot), { ...sw, slot, byHost: true }); }
      }, timerSecs * 1000);
      broadcast();
      return;
    }
    const sides = b.phase === 'switch_forced_both' ? ['A', 'B'] : [b.phase.slice(-1)];
    let humanWaits = false;
    for (const side of sides) {
      const tr = side === 'A' ? b.trainerA : b.trainerB;
      if (tr.bot) {
        after(700 + Math.random() * 500, () => {
          if (battle !== b) return;
          const sw = chooseBotAction(b, side, difficulty);
          if (sw && sw.type === 'switch') submit(side, sw);
        });
      } else {
        humanWaits = true;
      }
    }
    if (!humanWaits) return;
    clearTurn();
    turnEndsAt = Date.now() + timerSecs * 1000;
    turnTimer = setTimeout(() => {
      if (!alive || battle !== b) return;
      for (const side of ['A', 'B']) {
        if (b.phase === 'switch_forced_both' || b.phase === `switch_forced_${side}`) {
          const team = side === 'A' ? b.teamA : b.teamB;
          const cur = side === 'A' ? b.activeA : b.activeB;
          const opp = side === 'A' ? b.teamB[b.activeB] : b.teamA[b.activeA];
          const sw = chooseBestSwitch(team, cur, opp);
          if (sw) submit(side, sw);
        }
      }
    }, timerSecs * 1000);
    broadcast();
  }

  function endGame() {
    const m = currentMatch(t);
    if (!m || !battle) return;
    clearTurn();
    recordGame(t, m, battle, credits);
    summary();
  }

  function summary() {
    const m = currentMatch(t);
    t.phase = 'summary';
    const A = m && getParticipant(t, m.a);
    const B = m && getParticipant(t, m.b);
    cont = { A: !A || A.bot || A.gone, B: !B || B.bot || B.gone };
    setDeadline(SUMMARY_SECS, afterSummary);
    broadcast();
  }

  function afterSummary() {
    if (t.phase !== 'summary') return;
    clearPhase();
    const m = currentMatch(t);
    battle = null;
    if (m && m.status !== 'done') return preview(m); // manche suivante de la finale, ou manche nulle à rejouer
    resolveAutomatic(t, { difficulty });
    if (isOver(t)) return podium();
    showBracket(BRACKET_SECS);
  }

  function podium() {
    clearPhase(); clearTurn(); clearLater();
    battle = null;
    deadline = 0;
    t.phase = 'podium';
    broadcast();
  }

  // ------------------------------------------------------------------ actions des joueurs

  function handle(from, m) {
    if (!t || !m) return;
    const match = currentMatch(t);
    const side = sideOf(match, from);
    switch (m.t) {
      case 'draft':
        if (submitDraft(t, from, m.picks, m.items)) {
          broadcast();
          if (draftComplete(t)) { clearPhase(); setTimeout(() => alive && endDraft(), 600); }
        }
        break;
      case 'lead':
        { const key = isMulti(t) ? slotOf(match, from) : side;
          if (t.phase === 'preview' && key && !t.ready[key]) leadPick[key] = Array.isArray(m.idx) ? m.idx.map(Number) : Number(m.idx); }
        break;
      case 'ready':
        { const key = isMulti(t) ? slotOf(match, from) : side;
          if (t.phase === 'preview' && key && !t.ready[key]) {
            if (m.idx != null) leadPick[key] = Array.isArray(m.idx) ? m.idx.map(Number) : Number(m.idx);
            setReady(t, key, null);
            broadcast();
            if (allReady(t)) { clearPhase(); setTimeout(() => alive && startGame(), 700); }
          } }
        break;
      case 'action':
        if (side) submit(side, m.action, from);
        break;
      case 'continue':
        if (t.phase === 'summary' && side && !cont[side]) {
          cont[side] = true;
          broadcast();
          if (cont.A && cont.B) afterSummary();
        }
        break;
      case 'skip': // l'hôte écourte l'écran d'arbre
        if (same(from, me.id) && t.phase === 'bracket') { clearPhase(); nextMatch(); }
        break;
      case 'restart':
        if (same(from, me.id)) newTournament();
        break;
      case 'sync':
        broadcast();
        break;
      default:
    }
  }

  // ------------------------------------------------------------------ arrivées et départs

  function onRoster() {
    if (!t || solo || !alive) return;
    const ids = new Set(humanPlayers().map((p) => String(p.id)));
    const humans = t.participants.filter((p) => !p.bot);

    // Pendant le draft, tant que personne n'a validé, on refait le tournoi avec le nouveau salon
    const nobodyDrafted = humans.every((p) => !p.team);
    const changed = humans.length !== ids.size || humans.some((p) => !ids.has(String(p.id)));
    if (t.phase === 'draft' && nobodyDrafted && changed) return newTournament();

    for (const p of humans) {
      if (ids.has(String(p.id)) || p.gone) continue;
      const live = markGone(t, p.id);
      if (t.phase === 'draft') {
        broadcast();
        if (draftComplete(t)) { clearPhase(); endDraft(); }
      } else if (live) {
        // Forfait pendant le match : on coupe le combat et on montre le résultat
        clearTurn(); clearLater();
        battle = null;
        summary();
      } else {
        broadcast();
      }
    }
  }

  // ------------------------------------------------------------------ démarrage

  if (!solo && bridge) {
    bridge.on('roster', onRoster);
    bridge.on('msg', (from, m) => {
      if (!alive || !m || typeof m !== 'object') return;
      handle(from, m);
    });
  }

  // Reprise après changement d'hôte : on repart du dernier état diffusé par l'ancien hôte
  if (resume && resume.t && resume.v === 2) {
    t = resume.t;
    battle = resume.battle || null;
    evSeq = resume.evSeq || 0;
    const m = currentMatch(t);
    switch (t.phase) {
      case 'draft': setDeadline(30, endDraft); broadcast(); break;
      case 'bracket': showBracket(3); break;
      case 'preview': if (m) preview(m); else nextMatch(); break;
      case 'battle':
        if (!battle) { if (m) preview(m); else nextMatch(); }
        else if (battle.phase === 'choose') startTurn();
        else if (battle.phase.startsWith('switch_forced')) forcedSwitches();
        else endGame();
        break;
      case 'summary': summary(); break;
      default: broadcast();
    }
    onRoster();
  } else {
    newTournament();
  }

  const mine = (msg) => handle(me.id, msg);
  return {
    draft: (picks, items) => mine({ t: 'draft', picks, items }),
    lead: (idx) => mine({ t: 'lead', idx }),
    ready: (idx) => mine({ t: 'ready', idx }),
    submitAction: (action) => mine({ t: 'action', action }),
    cont: () => mine({ t: 'continue' }),
    skip: () => mine({ t: 'skip' }),
    restart: () => mine({ t: 'restart' }),
    isHost: true,
    destroy() {
      alive = false;
      clearPhase(); clearTurn(); clearLater();
    },
  };
}
