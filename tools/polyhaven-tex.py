#!/usr/bin/env python3
"""Télécharge une matière scannée de Poly Haven (CC0) et la range pour The Backrooms : la couleur (1024 px, JPEG),
et, à la demande, son relief (la carte de hauteur, en gris, 512 px) et son poli (1 - rugosité, en gris, 512 px, ramené à 1 pour le plus lisse), que
le matériau cuit du jeu sait lire (bumpMap, specularMap). Les trois images se superposent : même cadrage.

Usage : python3 tools/polyhaven-tex.py <id Poly Haven> <nom> [couleur] [relief] [lisse]
        (sortie : backrooms/tex/<nom>.jpg, <nom>_relief.jpg, <nom>_lisse.jpg ; sans mot-clé : les trois)
Prérequis : Pillow. Créditer la matière dans backrooms/tex/LICENSE.txt."""
import io, json, sys, urllib.request
from PIL import Image, ImageOps

UA = {'User-Agent': 'arcadia-backrooms-asset-tool'}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
        return r.read()


aid, name = sys.argv[1], sys.argv[2]
want = set(sys.argv[3:]) or {'couleur', 'relief', 'lisse'}
files = json.loads(get('https://api.polyhaven.com/files/' + aid))


def image(kind):
    f = files[kind]['1k']
    url = (f.get('jpg') or f.get('png'))['url']
    return Image.open(io.BytesIO(get(url)))


out = 'backrooms/tex/' + name
if 'couleur' in want:
    image('Diffuse').convert('RGB').resize((1024, 1024), Image.LANCZOS).save(out + '.jpg', quality=84, optimize=True)
    print(out + '.jpg')
if 'relief' in want:
    # la hauteur, étalée sur toute la plage (les joints au noir, le plat des carreaux au blanc)
    im = image('Displacement')
    if im.mode not in ('L', 'RGB'):
        im = im.point(lambda v: v / 256).convert('L') if im.mode.startswith('I') else im.convert('L')
    im = ImageOps.autocontrast(im.convert('L'), cutoff=0.5).resize((512, 512), Image.LANCZOS)
    im.save(out + '_relief.jpg', quality=82, optimize=True)
    print(out + '_relief.jpg')
if 'lisse' in want:
    # le poli, ramené à 1 pour le plus lisse de la matière : le jeu règle la force du reflet matière par matière, la
    # carte ne dit que ce qui brille moins (les joints, les rayures, la crasse)
    im = ImageOps.invert(image('Rough').convert('L')).resize((512, 512), Image.LANCZOS)
    h = im.histogram()
    top, seen = 255, 0
    for v in range(255, -1, -1):
        seen += h[v]
        if seen >= 0.03 * 512 * 512:
            top = max(v, 1)
            break
    im = im.point(lambda v: min(255, round(v * 255 / top)))
    im.save(out + '_lisse.jpg', quality=82, optimize=True)
    print(out + '_lisse.jpg')
