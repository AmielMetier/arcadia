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
   - *Repository access* : **Only select repositories** → `AmielMetier/arcadia`.
   - *Permissions* → *Repository permissions* → **Contents : Read and write** (rien d'autre).
   - Choisis une date d'expiration (il faudra le renouveler à cette date).
2. **Render** : service du relais (`duo-drift-relay`) → *Environment* → *Add Environment Variable* :
   - `GITHUB_TOKEN` = le jeton (`github_pat_…`) ;
   - facultatif : `SAVES_REPO` (par défaut `AmielMetier/arcadia`), `SAVES_BRANCH` (par défaut `saves`).
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


## Comptes Arcadia (identifiant + mot de passe)

Le même jeton GitHub sert aux comptes (`server/accounts.js`) : rien de plus à configurer, il suffit que Render ait redéployé le relais.
Vérification : `https://duo-drift-relay.onrender.com/account/status` doit répondre `{"ok":true,"on":true}`.

- Les comptes sont rangés dans la branche `saves`, dossier `accounts/`, un fichier par compte dont le nom est une empreinte de l'identifiant.
- Le mot de passe ne quitte jamais le navigateur (`hub/account.js`) : il en tire une clé d'accès (dont le serveur ne garde qu'une empreinte scrypt)
  et une clé de chiffrement AES-GCM qui reste dans le navigateur. Le fichier ne contient que du chiffré : ni pseudo, ni amis, ni clé ami lisibles.
- 8 mauvais mots de passe en 10 minutes pour un même identifiant et une même adresse : on attend.
- Mot de passe oublié = compte perdu (personne ne peut déchiffrer). Test : `node tools/test-accounts.mjs`.

## Clé du coffre VIP des Backrooms

Les médias du mode VIP des Backrooms sont chiffrés dans le dépôt (`backrooms/data/`, voir `backrooms/data/LICENSE.txt`).
Le relais garde leur clé et la donne aux seuls comptes VIP connectés (`POST /account/vipkey { user, auth }`, liste de `hub/vip.js`) :
les VIP n'ont rien à taper. **Rien à régler sur Render** : le relais range la clé dans la branche `saves`
(`vip/backrooms.json`), enveloppée en AES-GCM par une clé tirée de son `GITHUB_TOKEN` (le fichier seul ne dit rien).

- **La première fois**, Amiel tape la phrase dans le jeu : tant que le relais n'a pas la clé, une partie VIP la demande à
  l'hôte. La bonne phrase ouvre le coffre et son navigateur apprend la clé au relais ; ensuite, plus aucun VIP n'a rien
  à taper. (Autre façon : `BACKROOMS_VIP='la phrase' node tools/backrooms-vault.mjs semer`, la clé ne s'affiche pas.)
- Le relais ne l'accepte (`POST /account/vipseed { key }`) que si elle ouvre le témoin du coffre (`backrooms/data/e0.bin`) ;
  une clé au hasard est refusée, et les ratés sont limités comme les mots de passe.
- **Si le jeton GitHub change**, l'ancienne enveloppe ne s'ouvre plus : le navigateur d'un hôte VIP qui a déjà la clé
  la réapprend tout seul au relais à sa prochaine partie VIP (sinon, la phrase est redemandée une fois).
- Vérifie : `https://duo-drift-relay.onrender.com/account/status` doit répondre `{"ok":true,"on":true,"vipkey":true}`.
- `BACKROOMS_VIP_KEY` (facultatif) donne la clé directement au relais, sans passer par la branche `saves`.

Tant que le relais n'a pas la clé, le mode VIP des Backrooms retombe sur les monstres classiques.
