// Données du joueur dans ce navigateur, sous une seule clé. Rien ne part ailleurs.
import { defaults, parse, MAX_HISTORY } from '../engine/save.js';

const KEY = 'synapse_v1';
function load() {
  try {
    const text = localStorage.getItem(KEY);
    if (text) { const r = parse(text); if (r.ok) return r.data; console.warn('Synapse : données enregistrées illisibles, valeurs par défaut', r.error); }
  } catch (e) {}
  return defaults();
}

export const store = {
  data: load(),
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {} },
  addGame(g) {
    this.data.history.push(g);
    if (this.data.history.length > MAX_HISTORY) this.data.history.splice(0, this.data.history.length - MAX_HISTORY);
    this.save();
  },
  replace(d) { this.data = d; this.save(); },
  clear() { this.data = defaults(); this.save(); },
};
