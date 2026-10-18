// Paramètres de partie : règles du plateau + surcharges du mode choisi.
export const MODES = ['classic', 'express'];

export function makeConfig(board, mode = 'classic') {
  if (!MODES.includes(mode)) throw new Error(`Mode inconnu : ${mode}`);
  const m = board.modes[mode] || {};
  const cfg = { ...board.rules, ...(m.overrides || {}), mode };
  cfg.startingProperties = m.startingProperties || 0;
  cfg.startingPropertiesNoMonopoly = !!m.startingPropertiesNoMonopoly;
  cfg.timeLimitMs = m.timeLimitMinutes ? m.timeLimitMinutes * 60000 : 0;
  cfg.endOnFirstBankruptcy = !!m.endOnFirstBankruptcy;
  return cfg;
}
