#!/usr/bin/env python3
"""Légendaires des boss de raid d'Odyssée : des légendaires des générations 7 et 8, absents du jeu de base.

  git clone --depth 1 --filter=blob:none --sparse https://github.com/PokeAPI/pokeapi /tmp/pokeapi
  (cd /tmp/pokeapi && git sparse-checkout set data/v2/csv)
  git clone --depth 1 --filter=blob:none --no-checkout https://github.com/smogon/sprites /tmp/smogon
  python3 tools/odyssee-raid-legendes.py /tmp/pokeapi/data/v2/csv /tmp/smogon

Écrit odyssee/js/data/raid-legendes.js (ne pas modifier à la main) et copie dans odyssee/ :
  - les sprites de face, de dos et chromatiques, au style Noir / Blanc du projet de sprites de Smogon (gen5),
    replacés sur une toile de 96 × 96 comme ceux de PokeAPI (pieds au même niveau) ;
  - les icônes (PokeAPI, génération 7 ; mini-sprites de Smogon réduits pour la génération 8) ;
  - les cris (PokeAPI/cries).
Les capacités et les talents sont choisis parmi ceux que le moteur connaît (les leurs n'y sont pas tous).
"""
import csv, json, os, subprocess, sys
from PIL import Image

if len(sys.argv) < 3:
    sys.exit(__doc__)
CSV, SMOGON = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'odyssee')
BW = os.path.join(ROOT, 'img/pokeapi/pokemon/versions/generation-v/black-white')
ICONES = os.path.join(ROOT, 'img/pokeapi/pokemon/versions/generation-vii/icons')
CRIS = os.path.join(ROOT, 'snd/cris')

# n° → (nom dans les sprites de Smogon, talent, capacités du boss dans l'ordre d'apprentissage)
LEGENDES = {
    785: ('tapu_koko', 'pressure', ['discharge', 'thunderbolt', 'moonblast', 'calm-mind']),
    788: ('tapu_fini', 'pressure', ['muddy-water', 'scald', 'moonblast', 'calm-mind']),
    791: ('solgaleo', 'clear-body', ['zen-headbutt', 'iron-head', 'flare-blitz', 'earthquake']),
    792: ('lunala', 'pressure', ['psyshock', 'shadow-ball', 'moonblast', 'calm-mind']),
    800: ('necrozma', 'filter', ['power-gem', 'psychic', 'earth-power', 'calm-mind']),        # Prisme-Armure ≈ Filtre
    888: ('zacian', 'pressure', ['iron-head', 'play-rough', 'close-combat', 'swords-dance']),
    889: ('zamazenta', 'pressure', ['crunch', 'iron-head', 'close-combat', 'bulk-up']),
    895: ('regidrago', 'pressure', ['dragon-claw', 'fire-fang', 'earthquake', 'dragon-dance']),
}
STAT = {'1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5}
FR, PIEDS_FACE, PIEDS_DOS = 5, 88, 93


def lire(nom):
    with open(os.path.join(CSV, nom + '.csv'), encoding='utf8') as f:
        return list(csv.DictReader(f))


types = {t['id']: t['identifier'] for t in lire('types')}
esp = {}
for s in lire('pokemon_species'):
    i = int(s['id'])
    if i in LEGENDES:
        esp[i] = {'k': s['identifier'], 'cr': int(s['capture_rate']), 'g': int(s['growth_rate_id']), 'gr': int(s['gender_rate']), 'b': [0] * 6, 't': []}
for p in lire('pokemon'):
    i = int(p['id'])
    if i in esp:
        esp[i].update(xp=int(p['base_experience'] or 300), h=int(p['height']), w=int(p['weight']))
for st in lire('pokemon_stats'):
    i = int(st['pokemon_id'])
    if i in esp and st['stat_id'] in STAT:
        esp[i]['b'][STAT[st['stat_id']]] = int(st['base_stat'])
ty = {}
for t in lire('pokemon_types'):
    i = int(t['pokemon_id'])
    if i in esp:
        ty.setdefault(i, {})[int(t['slot'])] = types[t['type_id']]
for i in esp:
    esp[i]['t'] = [ty[i][k] for k in sorted(ty[i])]
for n in lire('pokemon_species_names'):
    i = int(n['pokemon_species_id'])
    if i in esp and int(n['local_language_id']) == FR:
        esp[i]['n'], esp[i]['genus'] = n['name'], n['genus']
textes = {}
for f in lire('pokemon_species_flavor_text'):
    i = int(f['species_id'])
    if i in esp and int(f['language_id']) == FR:
        textes[i] = ' '.join(f['flavor_text'].replace('\xad', '').split())   # le plus récent l'emporte
for i in esp:
    esp[i]['dex'] = textes.get(i, '')

# capacités : leurs numéros dans les données du jeu
mv = subprocess.run(['node', '-e', "import('./odyssee/js/data/moves.js').then(m=>console.log(JSON.stringify(Object.fromEntries(Object.values(m.MOVES).map(x=>[x.key,x.id])))))"],
                    cwd=os.path.join(ROOT, '..'), capture_output=True, text=True, check=True)
PAR_CLE = json.loads(mv.stdout)
sortie = {}
for i, (nom, talent, capas) in LEGENDES.items():
    manque = [c for c in capas if c not in PAR_CLE]
    if manque:
        sys.exit(f'{i} : capacités inconnues du jeu : {manque}')
    e = esp[i]
    ls = [[1, PAR_CLE[capas[0]]], [1, PAR_CLE[capas[1]]], [30, PAR_CLE[capas[2]]], [50, PAR_CLE[capas[3]]]]
    sortie[i] = {'n': e['n'], 'k': e['k'], 't': e['t'], 'b': e['b'], 'cr': 3, 'xp': e['xp'], 'g': e['g'], 'gr': -1, 'ls': ls, 'leg': 1,
                 'genus': e['genus'], 'h': e['h'], 'w': e['w'], 'dex': e['dex'], 'raid': 1, 'ab': talent, 'moves': capas}

with open(os.path.join(ROOT, 'js/data/raid-legendes.js'), 'w', encoding='utf8') as f:
    f.write('// odyssee/js/data/raid-legendes.js — écrit par tools/odyssee-raid-legendes.py (ne pas modifier à la main).\n')
    f.write('// Légendaires des générations 7 et 8, absents du jeu de base : on ne les croise que comme boss de raid.\n')
    f.write('// ab : talent (parmi ceux que le moteur connaît) ; moves : capacités du boss.\n')
    f.write('export const RAID_LEGENDES = ' + json.dumps({str(k): v for k, v in sortie.items()}, ensure_ascii=False) + ';\n')


def git_fichier(chemin):
    subprocess.run(['git', 'checkout', '-q', 'HEAD', '--', chemin], cwd=SMOGON, check=True)
    return Image.open(os.path.join(SMOGON, chemin)).convert('RGBA')


def toile(im, pieds):
    bb = im.split()[3].getbbox()
    im = im.crop(bb)
    if im.width > 96 or im.height > 96:
        k = min(96 / im.width, 96 / im.height)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.NEAREST)
    c = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    c.alpha_composite(im, ((96 - im.width) // 2, max(0, min(96 - im.height, pieds - im.height))))
    return c


for i, (nom, _, _) in LEGENDES.items():
    for suffixe, dossier, pieds in (('', '', PIEDS_FACE), ('-s', 'shiny', PIEDS_FACE), ('-b', 'back', PIEDS_DOS), ('-b-s', 'back/shiny', PIEDS_DOS)):
        dest = os.path.join(BW, dossier, f'{i}.png')
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        toile(git_fichier(f'src/sprites/gen5/s{nom}{suffixe}.png'), pieds).save(dest, optimize=True)
    # icône du menu (40 × 30)
    ico = os.path.join(ICONES, f'{i}.png')
    if i < 810:
        subprocess.run(['curl', '-sfo', ico, f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-vii/icons/{i}.png'], check=True)
    else:
        mini = git_fichier(f'src/minisprites/pokemon/gen8/s{nom}.png')
        mini = mini.crop(mini.split()[3].getbbox())
        k = min(40 / mini.width, 28 / mini.height, 1)
        mini = mini.resize((max(1, round(mini.width * k)), max(1, round(mini.height * k))), Image.NEAREST)
        c = Image.new('RGBA', (40, 30), (0, 0, 0, 0))
        c.alpha_composite(mini, ((40 - mini.width) // 2, 30 - mini.height - 1))
        c.save(ico, optimize=True)
    subprocess.run(['curl', '-sfo', os.path.join(CRIS, f'{i}.ogg'), f'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/{i}.ogg'], check=True)
    print(i, sortie[i]['n'], sortie[i]['t'], sum(sortie[i]['b']))
