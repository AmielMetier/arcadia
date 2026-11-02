// Règles graphiques d'Odyssée : la référence commune du jeu, de l'atelier (odyssee/atelier.html) et des outils
// (tools/odyssee-atelier.py lit le JSON ci-dessous). Expliquées dans docs/ODYSSEE-GRAPHISME.md.
// Le bloc entre les accolades doit rester du JSON pur (pas de commentaires, guillemets doubles).
export const REGLES = {
  "version": 1,
  "case": 32,
  "densite": 16,
  "echelle": 2,
  "lumiere": "haut-gauche",
  "contour": "1 pixel d'art, teinte sombre de la couleur voisine (jamais de noir pur)",
  "alpha": "tout ou rien : 0 ou 255, pas de demi-transparence",
  "palette": { "fichier": "atelier/palette.png", "couleurs": 64, "max_par_objet": 48, "tolerance": 24, "hors_palette_max": 0.08 },
  "familles": {
    "sol":     { "dossier": "img/sol32",    "densite": 32, "taille": [32, 32], "opaque": true,  "exception": "sols du tileset, gardés en densité fine" },
    "herbes":  { "dossier": "img/herbes",   "densite": 32, "taille": [32, 32], "opaque": false, "exception": "hautes herbes, gardées en densité fine" },
    "nature":  { "dossier": "img/nature",   "densite": 32, "opaque": false, "exception": "arbres « version 2 », gardés en densité fine" },
    "facades": { "dossier": "img/facades",  "densite": 16, "taille": [64, 64], "cellule": 16, "opaque": false },
    "deco":    { "dossier": "img/deco",     "densite": 16, "opaque": false },
    "hgss":    { "dossier": "img/hgss",     "densite": 16, "opaque": false, "exception": "animations HeartGold / SoulSilver (remplaçantes)" }
  },
  "batiments": {
    "maison":      { "w": 4, "d": 3, "h": 2, "porte": 1, "kit": "maison" },
    "maison2":     { "w": 5, "d": 3, "h": 2, "porte": 2, "kit": "maison" },
    "grande":      { "w": 6, "d": 4, "h": 3, "porte": 2, "kit": "maison" },
    "centre":      { "w": 5, "d": 4, "h": 3, "porte": 2, "kit": "centre" },
    "boutique":    { "w": 4, "d": 4, "h": 3, "porte": 1, "kit": "boutique" },
    "arene":       { "w": 7, "d": 5, "h": 3, "porte": 3, "kit": "arene" },
    "labo":        { "w": 6, "d": 4, "h": 3, "porte": 2, "kit": "labo" },
    "ligue":       { "w": 9, "d": 6, "h": 4, "porte": 4, "kit": "ligue" },
    "tour":        { "w": 4, "d": 4, "h": 3, "porte": 1, "kit": "maison" }
  },
  "kits": {
    "cellules": ["mur", "fenetre", "fenetre_nuit", "socle", "porte", "porte_nuit", "linteau", "cote", "toit", "rebord", "faite", "cheminee", "enseigne_g", "enseigne_d", "fleurs", "lampe"],
    "grille": [["mur", "fenetre", "fenetre_nuit", "socle"], ["porte", "porte_nuit", "linteau", "cote"], ["toit", "rebord", "faite", "cheminee"], ["enseigne_g", "enseigne_d", "fleurs", "lampe"]],
    "variantes": {
      "maison": { "faite":  "toit" },
      "chalet": { "faite":  "toit" },
      "pecheur": { "faite":  "toit" },
      "centre": { "faite":  "toit", "toit_plat":  true },
      "boutique": { "faite":  "toit", "toit_plat":  true },
      "arene": { "faite":  "toit", "toit_plat":  true },
      "ligue": { "faite":  "toit", "toit_plat":  true },
      "labo": { "faite":  "toit" },
      "musee": { "faite":  "toit" },
      "base": { "faite":  "toit" },
      "port": { "faite":  "toit" },
      "phare": { "faite":  "toit" },
      "pagode": { "faite":  "toit" },
      "mirage": { "faite":  "toit" },
      "grotte": { }
    }
  },
  "deco": {
    "erable":        { "largeur": 1.5 },
    "cerisier":      { "largeur": 1.5 },
    "arbre_automne": { "largeur": 1.5 },
    "panneau_bois":  { "largeur": 1 },
    "banc":          { "largeur": 1.5 },
    "fontaine":      { "largeur": 2.5, "cases": 2 },
    "gargouille":    { "largeur": 0.75 },
    "pilier_ball":   { "largeur": 0.75 },
    "caisse":        { "largeur": 0.875 },
    "tonneau":       { "largeur": 0.75 },
    "borne":         { "largeur": 0.75 },
    "bouee":         { "largeur": 0.75 },
    "parasol":       { "largeur": 1.5 },
    "bateau":        { "largeur": 3, "cases": 3 },
    "lanterne":      { "largeur": 0.75 },
    "torii":         { "largeur": 3, "cases": 3 },
    "stele":         { "largeur": 0.75 },
    "colonne":       { "largeur": 0.75 },
    "sanctuaire":    { "largeur": 2, "cases": 2 },
    "cristal":       { "largeur": 1 },
    "rocher_grand":  { "largeur": 1.25 },
    "butte":         { "largeur": 1 },
    "machine_labo":  { "largeur": 2, "cases": 2 },
    "table_balls":   { "largeur": 2, "cases": 2 },
    "livres":        { "largeur": 1 },
    "lampe_phare":   { "largeur": 1.5 },
    "telescope":     { "largeur": 1 },
    "corde":         { "largeur": 1 },
    "trone":         { "largeur": 2, "cases": 2 },
    "brasero":       { "largeur": 0.875 },
    "statue_dragon": { "largeur": 1.25 },
    "console":       { "largeur": 2, "cases": 2 },
    "ecran_carte":   { "largeur": 2, "cases": 2 },
    "cuve":          { "largeur": 1 },
    "caisses":       { "largeur": 1 },
    "cloche":        { "largeur": 2, "cases": 2 },
    "coussin":       { "largeur": 1 },
    "fossile":       { "largeur": 2, "cases": 2 },
    "squelette":     { "largeur": 4, "cases": 4 }
  }
};

/** cellule [colonne, ligne] d'un rôle dans un kit de façade (null si le kit ne l'a pas) */
export function kitCell(kit, role) {
  const v = REGLES.kits.variantes[kit] || {};
  let r = role in v ? v[role] : role, n = 0;
  while (typeof r === 'string' && n++ < 4) { if (r in v && v[r] !== r) { r = v[r]; continue; } break; }
  if (r === null || r === undefined) return null;
  if (Array.isArray(r)) return r;
  const g = REGLES.kits.grille;
  for (let j = 0; j < g.length; j++) { const i = g[j].indexOf(r); if (i >= 0) return [i, j]; }
  return null;
}
