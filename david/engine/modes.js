// Paramètres de partie : règles du plateau + surcharges du mode choisi.
export const MODES = ['classic', 'express'];

// Règles maison (toutes désactivées par défaut = règles officielles)
export const HOUSE_DEFAULTS = { jackpot: false, doubleGo: false, auctions: true, cash: 1500 };
export const STARTING_CASH = [1000, 1500, 2000, 2500];

export function cleanHouse(h) {
  h = h || {};
  return {
    jackpot: !!h.jackpot,
    doubleGo: !!h.doubleGo,
    auctions: h.auctions !== false && h.auctions !== 'false' && h.auctions !== 0,
    cash: STARTING_CASH.includes(Number(h.cash)) ? Number(h.cash) : 1500,
  };
}

// teams : partie « 2 contre 2 » (4 joueurs, 2 équipes de 2), quel que soit le mode
export function makeConfig(board, mode = 'classic', house = null, { teams = false } = {}) {
  if (!MODES.includes(mode)) throw new Error(`Mode inconnu : ${mode}`);
  const m = board.modes[mode] || {};
  const cfg = { ...board.rules, ...(m.overrides || {}), mode };
  cfg.startingProperties = m.startingProperties || 0;
  cfg.startingPropertiesNoMonopoly = !!m.startingPropertiesNoMonopoly;
  cfg.timeLimitMs = m.timeLimitMinutes ? m.timeLimitMinutes * 60000 : 0;
  cfg.endOnFirstBankruptcy = !!m.endOnFirstBankruptcy;
  const h = cleanHouse(house);
  cfg.house = h;
  cfg.freeParkingJackpot = h.jackpot;
  cfg.doubleGoLanding = h.doubleGo;
  cfg.auctionWhenDeclined = h.auctions;
  cfg.startingCash = h.cash;
  cfg.teams = !!teams;
  if (cfg.teams) { cfg.minPlayers = 4; cfg.maxPlayers = 4; }
  return cfg;
}
