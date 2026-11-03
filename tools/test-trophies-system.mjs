import assert from 'node:assert/strict';
import {
  TROPHIES_CATALOG,
  STREAK_RANKS,
  getStreakRank,
  ensurePvpState,
  recordPvpMatch,
  claimTrophyReward,
  getPvpSummary,
  getHeadToHeadStatus
} from '../odyssee/js/core/trophies.js';

console.log('Testing Odyssée Trophies & PvP System...');

// 1. Initial State
const state = {
  name: 'Red',
  bag: {},
};
const pvp = ensurePvpState(state);
assert.equal(pvp.totalWins, 0);
assert.equal(pvp.totalLosses, 0);
assert.equal(pvp.currentStreak, 0);
assert.equal(pvp.bestStreak, 0);
assert.deepEqual(pvp.players, {});
assert.deepEqual(pvp.trophies, {});

// Summary on new state
let summary = getPvpSummary(state);
assert.equal(summary.totalMatches, 0);
assert.equal(summary.winRate, '0.0%');
assert.equal(summary.unlockedCount, 0);
assert.equal(summary.rank.title, 'Challenger');

// 2. Win against Player 1 (Blue)
let res = recordPvpMatch(state, 'Blue', 'win');
assert.equal(res.currentStreak, 1);
assert.equal(res.bestStreak, 1);
assert.equal(state.pvp.totalWins, 1);
assert.equal(state.pvp.players['Blue'].wins, 1);
assert.equal(state.pvp.players['Blue'].losses, 0);

// "Premier Sang" unlocked!
assert(res.newlyUnlocked.some((t) => t.id === 'pvp_first_win'));
assert.equal(state.pvp.trophies['pvp_first_win'].unlocked, true);
assert.equal(state.pvp.trophies['pvp_first_win'].claimed, false);

// 3. Win against Player 2 (Leaf) -> "Premier Réseau" (battre 2 joueurs différents)
res = recordPvpMatch(state, 'Leaf', 'win');
assert.equal(res.currentStreak, 2);
assert.equal(res.bestStreak, 2);
assert(res.newlyUnlocked.some((t) => t.id === 'pvp_two_players'));
assert.equal(state.pvp.trophies['pvp_two_players'].unlocked, true);

// 4. Win streak reaches 3 -> "Étincelle Guerrière" (série de 3)
res = recordPvpMatch(state, 'Leaf', 'win');
assert.equal(res.currentStreak, 3);
assert.equal(res.bestStreak, 3);
assert(res.newlyUnlocked.some((t) => t.id === 'pvp_streak_3'));
assert.equal(res.rank.title, '🔥 En Série');

// 5. Lose against Silver -> streak resets, bestStreak preserved
res = recordPvpMatch(state, 'Silver', 'lose');
assert.equal(res.currentStreak, 0);
assert.equal(res.bestStreak, 3);
assert.equal(state.pvp.totalLosses, 1);
assert.equal(state.pvp.players['Silver'].losses, 1);
assert.equal(state.pvp.players['Silver'].wins, 0);
let h2hSilver = getHeadToHeadStatus(state.pvp.players['Silver']);
assert.equal(h2hSilver.cls, 'revenge');

// 6. Beat Blue 4 more times (total 5 times) -> "Rival Éternel" (5 fois le même joueur)
for (let i = 0; i < 4; i++) {
  res = recordPvpMatch(state, 'Blue', 'win');
}
assert.equal(state.pvp.players['Blue'].wins, 5);
assert(state.pvp.trophies['pvp_five_same_player']?.unlocked);
let h2hBlue = getHeadToHeadStatus(state.pvp.players['Blue']);
assert.equal(h2hBlue.cls, 'domination');

// 7. Streak reaches 5 -> "Flamme Ardente"
assert.equal(res.currentStreak, 4); // was 0, now +4
res = recordPvpMatch(state, 'Blue', 'win'); // 5th in a row
assert.equal(res.currentStreak, 5);
assert.equal(res.bestStreak, 5);
assert(state.pvp.trophies['pvp_streak_5']?.unlocked);
assert.equal(res.rank.title, '🔥🔥 Flamboyant');

// 8. Claim rewards
const initialCandy = state.bag['rare-candy'] || 0;
const claim1 = claimTrophyReward(state, 'pvp_first_win');
assert.equal(claim1.ok, true);
assert.equal(state.bag['rare-candy'], initialCandy + 2);
assert.equal(state.pvp.trophies['pvp_first_win'].claimed, true);

// Double claim prevention
const claim2 = claimTrophyReward(state, 'pvp_first_win');
assert.equal(claim2.ok, false);
assert.equal(state.bag['rare-candy'], initialCandy + 2); // unchanged

// Claim leftovers from "pvp_five_same_player"
const claimLeftovers = claimTrophyReward(state, 'pvp_five_same_player');
assert.equal(claimLeftovers.ok, true);
assert.equal(state.bag['leftovers'], 1);

// 9. Summary verification
summary = getPvpSummary(state);
assert.equal(summary.totalWins, 8);
assert.equal(summary.totalLosses, 1);
assert.equal(summary.totalMatches, 9);
assert.equal(summary.winRate, '88.9%');
assert.equal(summary.playersCount, 3);
assert(summary.unlockedCount >= 4);
assert.equal(summary.claimedCount, 2);

console.log('✔ All Trophies & PvP System tests PASSED successfully!');
