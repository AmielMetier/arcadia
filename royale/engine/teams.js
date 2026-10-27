// Island Rush — qui joue avec qui (duos, trios). Sur l'écran d'accueil, chacun peut choisir une équipe (un numéro) ;
// ceux qui n'ont pas choisi rejoignent l'équipe de joueurs la moins remplie (ou une nouvelle). Les bots complètent
// d'abord les équipes des joueurs (des coéquipiers, même en jouant seul), puis forment leurs propres équipes.
// Moteur PUR (testé hors navigateur).

// humans : [{ id }] dans l'ordre du salon ; picks : Map id → numéro choisi ; places : joueurs sur l'île ; size : 1 à 3.
// Renvoie { humans: Map id → équipe, bots: [équipe du 1er bot, du 2e…] } ; les équipes sont numérotées à partir de 0,
// celles des joueurs d'abord.
export function makeTeams(humans, picks, places, size) {
  const nBots = Math.max(0, places - humans.length);
  if (size <= 1) {
    return { humans: new Map(humans.map((h, i) => [h.id, i])), bots: Array.from({ length: nBots }, (_, i) => humans.length + i) };
  }
  // équipes choisies (dans l'ordre de leur numéro), au plus `size` joueurs chacune
  const chosen = new Map(), rest = [];
  for (const h of humans) {
    const k = picks && picks.get(h.id);
    if (!Number.isInteger(k) || k < 0) { rest.push(h); continue; }
    const g = chosen.get(k) || [];
    if (g.length >= size) { rest.push(h); continue; }
    g.push(h); chosen.set(k, g);
  }
  const groups = [...chosen.keys()].sort((a, b) => a - b).map((k) => chosen.get(k));
  // les autres : dans l'équipe de joueurs la moins remplie qui a de la place, sinon une nouvelle
  for (const h of rest) {
    const open = groups.filter((g) => g.length < size).sort((a, b) => a.length - b.length)[0];
    if (open) open.push(h); else groups.push([h]);
  }
  const map = new Map();
  groups.forEach((g, k) => { for (const h of g) map.set(h.id, k); });
  // bots : d'abord les places libres des équipes de joueurs, puis des équipes de bots
  const bots = [];
  groups.forEach((g, k) => { for (let i = g.length; i < size && bots.length < nBots; i++) bots.push(k); });
  let k = groups.length, n = 0;
  while (bots.length < nBots) { bots.push(k); if (++n >= size) { n = 0; k++; } }
  return { humans: map, bots };
}

// nom d'une équipe à l'écran
export const TEAM_LABEL = { 1: 'Solo', 2: 'Duos', 3: 'Trios' };
