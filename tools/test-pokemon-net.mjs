// tools/test-pokemon-net.mjs
// Tournoi Poké Duel en réseau simulé : un hôte et des invités reliés par un faux relais (comme le Hub).
// Vérifie un tournoi complet joué par des humains, le forfait d'un joueur qui quitte en plein combat
// et la reprise du tournoi quand l'hôte s'en va.
// node tools/test-pokemon-net.mjs

import { startHost } from '../pokemon/net/host.js';
import { startClient } from '../pokemon/net/client.js';
import { autoDraft, getParticipant, currentMatch, sideOf } from '../pokemon/engine/tournament.js';

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
      session().draft(autoDraft(meP.offer));
    } else if (s.phase === 'preview' && side && !t.ready[side]) {
      session().ready(Math.floor(Math.random() * 3));
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

console.log('\nRÉSEAU DU TOURNOI POKÉ DUEL : TOUS LES TESTS SONT AU VERT');
process.exit(0);
