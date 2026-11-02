#!/usr/bin/env python3
"""Personnages d'Odyssée (PixelLab, 32 × 32, 16 px d'art par case) → odyssee/img/chars.png.

Sources : assets/graphics/pixellab/persos/<nom>.png, 4 images de marche par rangée (bas, gauche, haut).
Dans la planche du jeu (cases de 64 × 64, d = 2) chaque personnage a une rangée de 12 cases : pour chaque direction
(bas, gauche, droite, haut) pas A, debout, pas B. Debout = image 0 de la marche, pas = images 1 et 3, droite = miroir
de la gauche (comme sur DS). Les nouveaux noms prennent une rangée à la fin et sont ajoutés à SPRITES.chars.rows.
"""
import json, os, re, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/graphics/pixellab/persos')
CH = os.path.join(ROOT, 'odyssee/img/chars.png')
SP = os.path.join(ROOT, 'odyssee/js/data/sprites.js')


def main(noms):
    js = open(SP).read()
    m = re.search(r'export const SPRITES = (\{.*\});', js, re.S); S = json.loads(m.group(1))
    rows = S['chars']['rows']
    sheet = Image.open(CH).convert('RGBA')
    for n in noms:
        a = Image.open(os.path.join(SRC, n + '.png')).convert('RGBA')
        fr = [[a.crop((i * 32, j * 32, i * 32 + 32, j * 32 + 32)) for i in range(4)] for j in range(3)]
        cols = {0: fr[0], 1: fr[1], 2: [f.transpose(Image.FLIP_LEFT_RIGHT) for f in fr[1]], 3: fr[2]}
        ys = np.nonzero(np.array(fr[0][0])[..., 3])[0]; dy = 31 - ys.max() if len(ys) else 0
        if n not in rows:
            rows[n] = max(rows.values()) + 1
        r = rows[n]
        if (r + 1) * 64 > sheet.height:
            big = Image.new('RGBA', (sheet.width, (r + 1) * 64)); big.paste(sheet, (0, 0)); sheet = big
        for d in range(4):
            for j, f in enumerate([cols[d][1], cols[d][0], cols[d][3]]):
                cell = Image.new('RGBA', (64, 64)); cell.alpha_composite(f.resize((64, 64), Image.NEAREST), (0, dy * 2))
                x, y = (d * 3 + j) * 64, r * 64
                sheet.paste(cell, (x, y))
    sheet.save(CH)
    js = js[:m.start(1)] + json.dumps(S, ensure_ascii=False, separators=(',', ':')) + js[m.end(1):]
    open(SP, 'w').write(js)
    print('personnages :', ', '.join(noms))


if __name__ == '__main__':
    main(sys.argv[1:] or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png')))
