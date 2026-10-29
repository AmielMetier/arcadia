# Sauvegardes en ligne (Odyssée)

Les parties d'Odyssée sont rangées dans ce dépôt, sur la branche **`saves`**, un fichier par compte du Hub :
`saves/odyssee/<CODE-AMI>.json`. C'est le serveur relais (Render) qui écrit, avec un jeton GitHub gardé dans ses
variables d'environnement. Le jeton n'est jamais envoyé aux navigateurs.

- **Qui peut écrire une partie ?** Seulement le navigateur qui a la clé secrète du compte Hub (celle des amis). Le serveur en
  tire le code ami et n'écrit que dans le fichier de ce code ami. Changer d'appareil : Hub → importer son compte (code de transfert).
- **Qui peut lire ?** Le dépôt est public : les parties le sont aussi (nom du dresseur, badges, équipe). Aucune clé ni adresse n'y est écrite.
- **Fréquence** : à chaque bouton « Sauver », et au plus toutes les 45 s pendant le jeu (changement de carte, onglet fermé).
  Le serveur regroupe les écritures d'un même compte (au plus une toutes les 20 s).

## Mise en route (une seule fois)

1. **Jeton GitHub** : github.com → Settings → Developer settings → Personal access tokens → *Fine-grained tokens* → *Generate new token*.
   - *Repository access* : **Only select repositories** → `AmielMetier/duo-drift`.
   - *Permissions* → *Repository permissions* → **Contents : Read and write** (rien d'autre).
   - Choisis une date d'expiration (il faudra le renouveler à cette date).
2. **Render** : service du relais (`duo-drift-relay`) → *Environment* → *Add Environment Variable* :
   - `GITHUB_TOKEN` = le jeton (`github_pat_…`) ;
   - facultatif : `SAVES_REPO` (par défaut `AmielMetier/duo-drift`), `SAVES_BRANCH` (par défaut `saves`).
3. Enregistre : Render redéploie le relais. Vérifie : `https://duo-drift-relay.onrender.com/save/status` doit répondre `{"ok":true,"on":true}`.

Tant que `GITHUB_TOKEN` n'est pas défini, le jeu garde la sauvegarde sur l'appareil (et le code de sauvegarde) comme avant.

## Routes du serveur

Corps en `text/plain` contenant du JSON (pas de requête préalable CORS) :

| Route | Corps | Réponse |
| --- | --- | --- |
| `GET /save/status` | — | `{ ok, on }` |
| `POST /save/odyssee/get` | `{ key }` | `{ ok, fid, save }` (`save` vaut `null` s'il n'y en a pas) |
| `POST /save/odyssee/put` | `{ key, code, meta }` | `{ ok, fid, updated, saved \| queued }` |

Test : `node tools/test-saves.mjs` (fausse API GitHub, aucun jeton réel).
