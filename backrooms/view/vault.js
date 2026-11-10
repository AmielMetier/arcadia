// Les images des monstres (photos de l'équipe) ne sont pas rangées en clair dans le dépôt : brouillées octet par octet
// (XOR avec la clé ci-dessous) dans data/*.bin, remises en image au lancement du jeu (URL blob). Ça empêche de les
// voir ou de les télécharger en parcourant le dépôt ; ce n'est pas un vrai chiffrement (la clé est dans le jeu).
// Réencoder une image : python3 tools/backrooms-vault.py <image> <data/eN.bin>
const KEY = new Uint8Array([147,187,103,85,45,114,29,245,116,41,114,208,175,100,166,116,11,177,101,230,71,8,210,133,200,103,29,232,167,117,132,77]);
const FILES = {
  entite: ['../data/e1.bin', 'image/png'],
  bouc: ['../data/e2.bin', 'image/jpeg'],
  david: ['../data/e3.bin', 'image/webp'],
};
export const vault = {};
export const vaultReady = Promise.all(
  Object.entries(FILES).map(([name, [path, type]]) =>
    fetch(new URL(path, import.meta.url).href)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const b = new Uint8Array(buf);
        for (let i = 0; i < b.length; i++) b[i] ^= KEY[i & 31];
        vault[name] = URL.createObjectURL(new Blob([b], { type }));
      })
      .catch(() => {
        vault[name] = '';
      }),
  ),
);
