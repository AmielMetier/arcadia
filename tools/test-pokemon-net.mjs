// tools/test-pokemon-net.mjs
// Tournoi Poké Duel en réseau simulé : un hôte et des invités reliés par un faux relais (comme le Hub).
// Vérifie un tournoi complet joué par des humains, le forfait d'un joueur qui quitte en plein combat
// et la reprise du tournoi quand l'hôte s'en va.
// node tools/test-pokemon-net.mjs

import { startHost } from '../pokemon/net/host.js';
import { startClient } from '../pokemon/net/client.js';
import { autoDraft, getParticipant, currentMatch, sideOf, teamSizeOf, isVgc, isMulti, slotOf } from '../pokemon/engine/tournament.js';
import { sidesOf, teamKey, getActivePokemon, foeSides } from '../pokemon/engine/battle.js';

// Le temps passe 40 fois plus vite (chronos, animations, réflexion des bots)
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms = 0, ...a) => realSetTimeout(fn, ms / 40, ...a);

const ok = (cond, msg) => { if (!cond) throw new Error('ÉCHEC : ' + msg); };
const wait = (ms) => new Promise((r) => realSetTimeout(r, ms));

// --- Faux relais : chaque joueur a un pont avec on/send/players, comme HubBridge ---
function makeRoom(players) {
  const bridges = new Map();
  const room = {
    players: [...players],
    hostId: players[0].id,
    bridge(id) {
      const h = { roster: [], msg: [] };
      const br = {
        embedded: true,
        info: { myId: id, hostId: room.hostId, role: id === room.hostId ? 'host' : 'guest' },
        get players() { return room.players; },
        on(k, fn) { (h[k] = h[k] || []).push(fn); },
        send(to, m) {
          const data = JSON.parse(JSON.stringify(m));
          const targets = to === 'all' ? room.players.map((p) => p.id).filter((x) => x !== id)
            : to === 'host' ? [room.hostId] : [to];
          for (const tid of targets) {
            const tb = bridges.get(tid);
            if (tb && room.players.some((p) => p.id === tid)) queueMicrotask(() => tb._emit('msg', id, data));
          }
        },
        report(r) { room.report = r; },
        _emit(k, ...a) { (h[k] || []).forEach((fn) => fn(...a)); },
      };
      bridges.set(id, br);
      return br;
    },
    leave(id) {
      room.players = room.players.filter((p) => p.id !== id);
      if (id === room.hostId) room.hostId = room.players[0].id;
      for (const p of room.players) {
        const br = bridges.get(p.id);
        br.info.hostId = room.hostId;
        br.info.role = p.id === room.hostId ? 'host' : 'guest';
        br._emit('roster', room.players);
      }
    },
  };
  return room;
}

// Joueur automatique : drafte, choisit sa tête, attaque, remplace, continue
function autoPlayer(me, session) {
  return (s) => {
    if (!s || !s.t) return;
    const t = s.t;
    const meP = getParticipant(t, me.id);
    const m = currentMatch(t);
    const side = sideOf(m, me.id);
    if (s.phase === 'draft' && meP && !meP.team && !meP._sent) {
      meP._sent = true;
      session().draft(autoDraft(meP.offer, teamSizeOf(t)));
    } else if (s.phase === 'preview' && isMulti(t) && slotOf(m, me.id) && !t.ready[slotOf(m, me.id)]) {
      session().ready(Math.floor(Math.random() * 3));
    } else if (s.phase === 'preview' && !isMulti(t) && side && !t.ready[side]) {
      session().ready(isVgc(t) ? [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 4) : Math.floor(Math.random() * 3));
    } else if (s.phase === 'battle' && side && s.battle && s.battle.doubles) {
      // double : un remplaçant par emplacement vide, sinon une attaque et une cible au hasard pour chacun de ses Pokémon
      const b = s.battle;
      const mine = b.owners ? sidesOf(b).filter((x) => String(b.owners[x]) === String(me.id)) : sidesOf(b).filter((y) => teamKey(y) === side);
      if (b.phase === 'switch_forced') {
        const slot = (b.need || []).find((x) => mine.includes(x));
        if (!slot) return;
        const team = side === 'A' ? b.teamA : b.teamB, on = sidesOf(b).filter((x) => teamKey(x) === side).map((x) => b['active' + x]);
        const pool = b.pools ? b.pools[slot] : team.map((_, i) => i);
        const idx = team.findIndex((p, i) => pool.includes(i) && !on.includes(i) && !p.fainted);
        if (idx >= 0) session().submitAction({ type: 'switch', targetIndex: idx, slot });
      } else if (b.phase === 'choose' && !mine.every((x) => (s.submittedSlots || {})[x])) {
        const acts = {};
        for (const x of mine) {
          const p = getActivePokemon(b, x);
          if (!p || p.fainted) continue;
          const foes = foeSides(b, x).filter((f) => { const q = getActivePokemon(b, f); return q && !q.fainted; });
          acts[x] = { type: 'move', moveId: p.moves[Math.floor(Math.random() * p.moves.length)], target: foes[Math.floor(Math.random() * foes.length)] };
        }
        session().submitAction({ type: 'pair', acts });
      }
    } else if (s.phase === 'battle' && side && s.battle) {
      const b = s.battle;
      const team = side === 'A' ? b.teamA : b.teamB;
      const act = side === 'A' ? b.activeA : b.activeB;
      if (b.phase === 'switch_forced_both' || b.phase === `switch_forced_${side}`) {
        const idx = team.findIndex((p, i) => i !== act && !p.fainted);
        if (idx >= 0) session().submitAction({ type: 'switch', targetIndex: idx });
      } else if (b.phase === 'choose' && !(side === 'A' ? s.submittedA : s.submittedB)) {
        const p = team[act];
        session().submitAction({ type: 'move', moveId: p.moves[Math.floor(Math.random() * p.moves.length)] });
      }
    } else if (s.phase === 'summary' && side && s.cont && !s.cont[side]) {
      session().cont();
    }
  };
}

function spawn(room, p, settings, { role, resume } = {}) {
  const br = room.bridge(p.id);
  const log = { states: [], last: null };
  let session;
  const play = autoPlayer(p, () => session);
  const onState = (s) => { log.states.push(s.phase); log.last = s; setTimeout(() => play(s), 50); };
  const handlers = { bridge: br, solo: false, settings, me: p, onState, onError: () => {} };
  session = (role || br.info.role) === 'host' ? startHost({ ...handlers, resume }) : startClient(handlers);
  return { br, log, get session() { return session; }, set session(v) { session = v; }, handlers };
}

async function until(cond, ms, label) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error(`ÉCHEC : délai dépassé (${label})`);
    await wait(20);
  }
}

const settings = { timer: 25, gen: 'all', bots: 1, level: 'normal', final: 3 };
const P = [
  { id: 1, name: 'Amiel', color: '#ff4b2b' },
  { id: 2, name: 'Nico', color: '#2b8cff' },
  { id: 3, name: 'Sam', color: '#2fbf71' },
];

// ---------------------------------------------------------------------------
console.log('--- Tournoi complet à 3 joueurs (hôte + 2 invités, 1 bot) ---');
{
  const room = makeRoom(P);
  const host = spawn(room, P[0], settings);
  const g1 = spawn(room, P[1], settings);
  const g2 = spawn(room, P[2], settings);
  await until(() => host.log.last && host.log.last.phase === 'podium', 60000, 'podium');
  await until(() => g1.log.last && g1.log.last.phase === 'podium' && g2.log.last.phase === 'podium', 3000, 'podium invités');
  const t = host.log.last.t;
  ok(t.participants.length === 4 && t.participants.filter((p) => p.bot).length === 1, 'composition du tournoi');
  ok(t.participants.filter((p) => !p.bot).every((p) => p.team && !p.autoDrafted), 'les équipes draftées par les joueurs sont gardées');
  ok(room.report && room.report.players.length === 4, 'résultat transmis au Hub');
  ok(['draft', 'bracket', 'preview', 'battle', 'summary', 'podium'].every((ph) => g1.log.states.includes(ph)), 'un invité voit toutes les phases');
  const champ = getParticipant(t, t.champion);
  console.log(`✓ ${champ.name} champion · finale ${t.rounds.at(-1)[0].scoreA}-${t.rounds.at(-1)[0].scoreB} · ${host.log.states.length} états diffusés`);

  // Un invité ne peut pas relancer le tournoi
  g1.br.send('host', { t: 'restart' });
  await wait(50);
  ok(host.log.last.phase === 'podium', 'un invité a relancé le tournoi');
  const n = host.log.states.length;
  host.session.restart();
  await wait(30);
  ok(host.log.states[n] === 'draft', 'l\'hôte relance le tournoi');
  host.session.destroy();
  console.log('✓ Seul l\'hôte peut relancer');
}

// ---------------------------------------------------------------------------
console.log('--- Forfait : un invité quitte en plein combat ---');
{
  const room = makeRoom(P.slice(0, 2));
  const host = spawn(room, P[0], { ...settings, bots: 0 });
  const g = spawn(room, P[1], { ...settings, bots: 0 });
  await until(() => host.log.last && host.log.last.phase === 'battle', 20000, 'premier combat');
  g.session.destroy();
  room.leave(P[1].id);
  await until(() => host.log.last.phase === 'summary', 3000, 'résumé du forfait');
  const t = host.log.last.t;
  ok(t.last && t.last.forfeit && t.last.winner, 'forfait non signalé');
  await until(() => host.log.last.phase === 'podium', 5000, 'podium après forfait');
  ok(String(host.log.last.t.champion) === String(P[0].id), 'le joueur resté doit gagner');
  host.session.destroy();
  console.log('✓ Le joueur parti perd par forfait, le tournoi se termine');
}

// ---------------------------------------------------------------------------
console.log('--- L\'hôte quitte : un invité reprend le tournoi ---');
{
  const room = makeRoom(P);
  const host = spawn(room, P[0], settings);
  const g1 = spawn(room, P[1], settings);
  const g2 = spawn(room, P[2], settings);
  await until(() => g1.log.last && ['preview', 'battle'].includes(g1.log.last.phase), 20000, 'premier match');
  const before = g1.log.last.t.participants.map((p) => `${p.id}:${(p.team || []).join('-')}`).join('|');
  host.session.destroy();
  room.leave(P[0].id);
  // Comme app.js : le nouvel hôte repart du dernier état reçu
  const last = g1.session.state;
  g1.session.destroy();
  g1.session = startHost({ ...g1.handlers, resume: last });
  await until(() => g1.log.last && g1.log.last.phase === 'podium', 60000, 'podium après changement d\'hôte');
  const t = g1.log.last.t;
  const after = t.participants.map((p) => `${p.id}:${(p.team || []).join('-')}`).join('|');
  ok(before === after, 'les équipes ont changé après la reprise');
  ok(getParticipant(t, P[0].id).gone, 'l\'ancien hôte doit être marqué parti');
  ok(g2.log.last.phase === 'podium', 'le second invité suit le nouvel hôte');
  g1.session.destroy();
  console.log(`✓ Tournoi repris et terminé · champion : ${getParticipant(t, t.champion).name}`);
}

// ---------------------------------------------------------------------------
console.log('--- Tournoi VGC (combat en double) à 3 joueurs ---');
{
  const room = makeRoom(P);
  const vgc = { ...settings, format: 'vgc' };
  const host = spawn(room, P[0], vgc);
  const g1 = spawn(room, P[1], vgc);
  const g2 = spawn(room, P[2], vgc);
  await until(() => host.log.last && host.log.last.phase === 'podium', 90000, 'podium VGC');
  await until(() => g1.log.last && g1.log.last.phase === 'podium' && g2.log.last.phase === 'podium', 3000, 'podium VGC invités');
  const t = host.log.last.t;
  ok(t.format === 'vgc' && t.participants.every((p) => p.team && p.team.length === 6), 'équipes de 6 en VGC');
  ok(t.rounds.flat().some((m) => m.games.some((g) => g.teamA.length === 4)), 'chaque manche se joue à 4 Pokémon');
  host.session.destroy(); g1.session.destroy(); g2.session.destroy();
  console.log(`✓ Tournoi VGC terminé · champion : ${getParticipant(t, t.champion).name}`);
}

// ---------------------------------------------------------------------------
console.log('--- 2 contre 2 entre joueurs (4 joueurs, puis 3 joueurs + 1 bot) ---');
for (const n of [4, 3]) {
  const P4 = [...P, { id: 4, name: 'Léa', color: '#a466c9' }].slice(0, n);
  const room = makeRoom(P4);
  const st = { ...settings, format: 'multi' };
  const host = spawn(room, P4[0], st);
  const guests = P4.slice(1).map((p) => spawn(room, p, st));
  await until(() => host.log.last && host.log.last.phase === 'podium', 90000, `podium 2 contre 2 (${n} joueurs)`);
  const t = host.log.last.t, m = t.rounds[0][0];
  ok(t.format === 'multi' && t.participants.length === 4 && m.aIds.length === 2 && m.bIds.length === 2, 'deux équipes de deux');
  ok(t.participants.filter((p) => p.bot).length === 4 - n, `${4 - n} bot pour compléter`);
  ok(m.games.length >= 2 && m.games.every((g) => g.teamA.length === 6), 'chaque joueur amène ses 3 Pokémon');
  ok(guests.every((g) => g.log.states.includes('battle')), 'tous les joueurs ont vu le combat');
  host.session.destroy(); guests.forEach((g) => g.session.destroy());
  console.log(`✓ 2 contre 2 à ${n} joueurs · ${m.scoreA}-${m.scoreB} · gagnants : ${(m.winner === m.a ? m.aIds : m.bIds).map((id) => getParticipant(t, id).name).join(' & ')}`);
}

console.log('\nRÉSEAU DU TOURNOI POKÉ DUEL : TOUS LES TESTS SONT AU VERT');
process.exit(0);
