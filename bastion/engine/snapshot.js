// Moteur de Bastion Clash (sans DOM) : chargé par la page et par les outils Node (tools/test-bastion.mjs, tools/bench-bastion.mjs).
// Instantanés réseau : l'hôte envoie à chaque joueur l'état du monde vu par son équipe, en format compact.
'use strict';

/* ============================================================================
   FORMAT COMPACT
   - Unités et bâtiments en tableaux de valeurs (l'ordre des champs fait foi) au lieu d'objets à clés :
     les noms de champs représentaient l'essentiel du volume.
   - Brouillard de guerre : un joueur ne reçoit que les unités et bâtiments que son équipe voit, et ne
     reçoit pas les ressources de ses adversaires. Les spectateurs et les joueurs éliminés voient tout.
   ============================================================================ */
const SNAP_VERSION = 2;
const q1 = (v) => (v == null ? null : Math.round(Number(v) * 10) / 10);
const q2 = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);
const qi = (v) => (v == null ? null : Math.round(Number(v)));
const qb = (v) => (v ? 1 : 0);
const raw = (v) => (v === undefined ? null : v);
const toBool = (v) => !!v;
const keep = (v) => v;

// [champ, encodage, décodage]
const UNIT_FIELDS = [
  ['id', raw, keep], ['kind', raw, keep], ['owner', raw, keep], ['team', raw, keep],
  ['x', q1, keep], ['y', q1, keep], ['vx', q1, keep], ['vy', q1, keep], ['a', q2, keep],
  ['hp', qi, keep], ['maxHp', raw, keep], ['radius', raw, keep], ['cd', q2, keep], ['mode', raw, keep],
  ['orderX', qi, keep], ['orderY', qi, keep], ['pathX', qi, keep], ['pathY', qi, keep],
  ['targetEntId', raw, keep], ['harvestId', raw, keep], ['gatherT', q2, keep],
  ['carryType', raw, keep], ['carryAmt', raw, keep], ['buildTargetId', raw, keep], ['onSite', qb, toBool],
  ['weldTimer', q2, keep], ['weldX', q1, keep], ['weldY', q1, keep], ['stimT', q2, keep],
  ['sieged', qb, toBool], ['flying', qb, toBool], ['cargo', (v) => (Array.isArray(v) && v.length ? [...v] : 0), (v) => (Array.isArray(v) ? v : [])],
  ['boardedIn', raw, keep], ['healingTargetId', raw, keep],
  ['energy', q1, keep], ['shield', qi, keep], ['maxShield', raw, keep], ['cloaked', qb, toBool], ['faction', raw, keep],
  ['boss', qb, toBool],
];
const BLD_FIELDS = [
  ['id', raw, keep], ['kind', raw, keep], ['owner', raw, keep], ['team', raw, keep],
  ['x', qi, keep], ['y', qi, keep], ['hp', qi, keep], ['maxHp', raw, keep], ['radius', raw, keep],
  ['cd', q2, keep], ['aimA', q2, keep], ['constructing', qb, toBool], ['buildStarted', qb, toBool],
  ['buildProg', q2, keep], ['buildTime', raw, keep], ['queue', (v) => (Array.isArray(v) && v.length ? [...v] : 0), (v) => (Array.isArray(v) ? v : [])],
  ['qTimer', q2, keep], ['qTotal', q2, keep], ['rallyX', qi, keep], ['rallyY', qi, keep], ['geyserId', raw, keep],
  ['energy', q1, keep], ['shield', qi, keep], ['maxShield', raw, keep], ['faction', raw, keep], ['remaining', qi, keep],
];
const encodeRow = (o, F) => F.map(([k, enc]) => enc(o[k]));
function decodeRow(a, F) {
  const o = {};
  for (let i = 0; i < F.length; i++) o[F[i][0]] = F[i][2](a[i] === undefined ? null : a[i]);
  return o;
}

// viewer : { team } d'un joueur en jeu, ou null (spectateur, éliminé, solo) pour tout voir
function packState(s, { viewer = null, ack = {}, pings = {} } = {}) {
  const sees = (team, x, y) => viewer == null || team === viewer.team || teamSees(viewer.team, x, y);
  const ships = new Map(s.units.map((u) => [u.id, u]));
  const visibleUnit = (u) => {
    if (viewer == null || u.team === viewer.team) return true;
    const at = u.boardedIn ? ships.get(u.boardedIn) || u : u;
    return (!u.cloaked || teamDetects(viewer.team, at.x, at.y)) && teamSees(viewer.team, at.x, at.y);
  };
  return {
    v: SNAP_VERSION,
    time: q2(s.time), blitz: s.blitz, map: s.map, mode: s.mode, is2v2: s.is2v2, coop: s.coop || null,
    level: s.level, factionRule: s.factionRule, phase: s.phase, stormRadius: Math.round(s.stormRadius), dmgMult: s.dmgMult,
    nextId: s.nextId, over: s.over, winnerTeam: s.winnerTeam, ranking: s.ranking, ack,
    waves: s.waves || null,
    players: s.players.map((p) => {
      const mine = viewer == null || p.team === viewer.team;
      return {
        id: p.id, name: p.name, color: p.color, bot: p.bot, afk: !!p.afk, horde: !!p.horde, team: p.team, faction: p.faction || 'terran',
        minerals: mine ? q1(p.minerals) : 0, gas: mine ? q1(p.gas) : 0, score: Math.round(p.score),
        dead: p.dead, spectator: !!p.spectator, spawnX: p.spawnX, spawnY: p.spawnY, nextUnitSeq: p.nextUnitSeq || 20,
        ping: p.bot ? 0 : (pings[p.id] || 0), upgrades: p.upgrades ? { ...p.upgrades } : {}, scanCd: q1(p.scanCd || 0),
        stats: p.stats ? { ...p.stats } : null,
      };
    }),
    B: s.buildings.filter((b) => sees(b.team, b.x, b.y)).map((b) => encodeRow(b, BLD_FIELDS)),
    U: s.units.filter(visibleUnit).map((u) => encodeRow(u, UNIT_FIELDS)),
    scans: s.scans.filter((sc) => viewer == null || sc.team === viewer.team)
      .map((sc) => ({ x: Math.round(sc.x), y: Math.round(sc.y), team: sc.team, r: sc.r, timer: q2(sc.timer) })),
    mineralLeft: s.mineralLeft ? Object.fromEntries(Object.entries(s.mineralLeft).map(([k, v]) => [k, Math.max(0, Math.round(v))])) : null,
    fog: viewer != null,
  };
}

function unpackState(pkt) {
  if (!pkt || pkt.v !== SNAP_VERSION) return null;
  const { B, U, v, fog, ...rest } = pkt;
  return {
    ...rest,
    scans: rest.scans || [],
    buildings: (B || []).map((a) => decodeRow(a, BLD_FIELDS)),
    units: (U || []).map((a) => decodeRow(a, UNIT_FIELDS)),
    partial: !!fog,
  };
}
