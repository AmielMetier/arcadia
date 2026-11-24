// odyssee/js/version.js — numéro de version d'Odyssée, à monter à chaque mise à jour du jeu (+0.1), puis
// `node tools/odyssee-preload.mjs` : il le recopie dans les adresses des modules, des feuilles de style et de la carte
// des imports de odyssee/index.html (et ASSETS l'ajoute aux images), pour que les navigateurs prennent tout de suite
// la nouvelle version au lieu de garder l'ancienne en cache.
export const VERSION_ODYSSEE = '3.0';
