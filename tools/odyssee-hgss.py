#!/usr/bin/env python3
# Odyssée — personnages provisoires repris de HeartGold / SoulSilver, en attendant les dessins définitifs.
#
#  * sur la carte : les modèles « mmodel » du jeu (textures NSBTX, 16 images de 32 × 32 par personnage),
#    lus dans un clone de pret/pokeheartgold ;
#  * en combat : les dessins de dresseurs HGSS / DP du dépôt smogon/sprites.
#
# Les images brutes sont gardées dans assets/graphics/hgss/ : une fois extraites, plus besoin des clones.
#
#   python3 tools/odyssee-hgss.py [chemin/pokeheartgold] [chemin/smogon-sprites]
#
# Écrit odyssee/img/chars.png (cases de 64 × 64, densité 2 : une image HGSS agrandie ×2), odyssee/img/dresseurs/*.png
# et met à jour odyssee/js/data/sprites.js (« chars » et « dresseurs »). Les portraits des boîtes de dialogue restent.
import os, re, sys, json, struct, subprocess
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'graphics', 'hgss')
OUT = os.path.join(ROOT, 'odyssee', 'img')

# personnage du jeu → modèle HGSS sur la carte (nom de MMODEL_*) et dessin de combat (fichier smogon/sprites)
CHARS = {
    'player_m': ('HERO', 'heartgold-soulsilver/Ethan'),
    'player_f': ('HEROINE', 'heartgold-soulsilver/Lyra'),
    'theo': ('GSRIVEL', 'heartgold-soulsilver/Silver'),
    'saule': ('OOKIDO', None),
    'maman': ('GSMAMA', None),
    'nurse': ('PCWOMAN1', None),
    'vendeur': ('SHOPM1_2', None),
    'garde': ('ROCKETM', 'heartgold-soulsilver/Rocket_Grunt'),
    'hector': ('GSLEADER2', 'heartgold-soulsilver/Bugsy'),
    'basalte': ('GSLEADER14', 'heartgold-soulsilver/Brock'),
    'marine': ('GSLEADER11', 'heartgold-soulsilver/Misty'),
    'volta': ('GSLEADER9', 'heartgold-soulsilver/Lt._Surge'),
    'flora': ('GSLEADER12', 'heartgold-soulsilver/Erika'),
    'sibylle': ('GSLEADER10', 'heartgold-soulsilver/Sabrina'),
    'pyros': ('GSLEADER15', 'heartgold-soulsilver/Blaine'),
    'drakos': ('WATARU', 'heartgold-soulsilver/Lance'),
    'celestine': ('CHAMPION', 'diamond-pearl/Cynthia'),
    'gamin': ('GSBOY2', 'heartgold-soulsilver/Youngster'),
    'fillette': ('GSGIRL1', 'heartgold-soulsilver/Lass'),
    'montagnard': ('MOUNT', 'diamond-pearl/Hiker'),
    'marin': ('SEAMAN', 'diamond-pearl/Sailor'),
    'topdresseur': ('MAN3', 'heartgold-soulsilver/Ace_Trainer'),
    'topdresseuse': ('WOMAN3', 'heartgold-soulsilver/Ace_Trainer~F'),
    'scientifique': ('ASSISTANTM', 'heartgold-soulsilver/Scientist'),
    'pecheur': ('FISHING', 'diamond-pearl/Fisherman'),
    'insectomane': ('BOY3', 'heartgold-soulsilver/Bug_Catcher'),
    'randonneuse': ('PICNICGIRL', 'diamond-pearl/Picnicker'),
    'medium': ('ITAKO', 'heartgold-soulsilver/Medium'),
    'karateka': ('FIGHTER', 'heartgold-soulsilver/Blackbelt'),
    'habitant': ('GSMAN1', 'heartgold-soulsilver/Gentleman'),
    'habitante': ('GSWOMAN1', 'heartgold-soulsilver/Beauty'),
    'vieil_homme': ('GSOLDMAN1', 'heartgold-soulsilver/Sage'),
    'enfant': ('GSBABYBOY1', 'heartgold-soulsilver/School_Kid'),
}

# ------------------------------------------------------------------ textures NSBTX (DS)
def u16(b, o): return struct.unpack_from('<H', b, o)[0]
def u32(b, o): return struct.unpack_from('<I', b, o)[0]

def _dict(b, o, esize):
    cnt = b[o + 1]; p = o + 4 + 8 + cnt * 4 + 4
    ents = [b[p + i * esize:p + (i + 1) * esize] for i in range(cnt)]; p += cnt * esize
    names = [b[p + i * 16:p + i * 16 + 16].split(b'\0')[0].decode('latin1') for i in range(cnt)]
    return list(zip(names, ents))

def _bgr(c): return ((c & 31) * 255 // 31, ((c >> 5) & 31) * 255 // 31, ((c >> 10) & 31) * 255 // 31)

def nsbtx_frames(path):
    """images d'un modèle HGSS, dans l'ordre du jeu : 1-4 de dos, 5-8 de face, 9-12 et 13-16 de profil (vers la gauche)"""
    b = open(path, 'rb').read(); assert b[:4] == b'BTX0'
    T = b[u32(b, 0x10):]
    texs = _dict(T, u16(T, 0x0E), 8); pals = _dict(T, u32(T, 0x34), 4); pdata = u32(T, 0x38); tdata = u32(T, 0x14)
    off = u16(pals[0][1], 0) << 3
    pal = [_bgr(u16(T, pdata + off + 2 * i)) for i in range(16)]
    out = []
    for name, e in sorted(texs, key=lambda ne: int(re.search(r'(\d+)$', ne[0]).group(1))):
        o = tdata + (u16(e, 0) << 3); p = u16(e, 2)
        w = 8 << ((p >> 4) & 7); h = 8 << ((p >> 7) & 7); fmt = (p >> 10) & 7
        if fmt != 3: raise ValueError(f'{path}: format {fmt}')
        im = Image.new('RGBA', (w, h)); px = im.load()
        for i in range(w * h):
            v = (T[o + i // 2] >> ((i & 1) * 4)) & 15
            px[i % w, i // w] = pal[v] + ((0,) if v == 0 else (255,))
        out.append(im)
    return out

def mmodel_index(pret):
    idx = {}
    for l in open(os.path.join(pret, 'include', 'constants', 'mmodel.h')):
        m = re.match(r'#define MMODEL_(\w+)\s+(\d+)', l)
        if m: idx.setdefault(m.group(1), int(m.group(2)))
    return idx

def extract(pret, smogon):
    os.makedirs(os.path.join(RAW, 'ow'), exist_ok=True); os.makedirs(os.path.join(RAW, 'dresseurs'), exist_ok=True)
    if pret:
        idx = mmodel_index(pret)
        for cid, (mm, _) in CHARS.items():
            fr = nsbtx_frames(os.path.join(pret, 'files', 'data', 'mmodel', 'mmodel', f'mmodel_{idx[mm]:08d}.NSBTX'))
            strip = Image.new('RGBA', (32 * len(fr), 32))
            for i, f in enumerate(fr): strip.alpha_composite(f, (32 * i, 0))
            strip.save(os.path.join(RAW, 'ow', cid + '.png'), optimize=True)
    if smogon:
        base = 'src/_uncategorized/canonical/trainers/gen4/'
        for cid, (_, tr) in CHARS.items():
            if not tr: continue
            data = subprocess.run(['git', '-C', smogon, 'show', 'HEAD:' + base + tr + '.png'], capture_output=True, check=True).stdout
            open(os.path.join(RAW, 'dresseurs', cid + '.png'), 'wb').write(data)

# ------------------------------------------------------------------ planches du jeu
CW = 64

def build():
    ids = [c for c in CHARS if os.path.exists(os.path.join(RAW, 'ow', c + '.png'))]
    atlas = Image.new('RGBA', (CW * 12, CW * len(ids)))
    for r, cid in enumerate(ids):
        strip = Image.open(os.path.join(RAW, 'ow', cid + '.png')).convert('RGBA')
        fr = [strip.crop((32 * i, 0, 32 * i + 32, 32)) for i in range(strip.width // 32)]
        if len(fr) < 16: fr = (fr * 16)[:16]
        up, down, left = fr[0:4], fr[4:8], fr[8:12]
        right = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in left]
        # pas, immobile, autre pas (ordre des colonnes de chars.png) ; directions : bas, gauche, droite, haut
        dirs = [[d[1], d[0], d[3]] for d in (down, left, right, up)]
        # tous les pieds sur la même ligne (l'avant-dernière rangée de la case)
        low = max(max(i for i in range(32) if any(f.getpixel((x, i))[3] for x in range(32))) for d in dirs for f in d)
        for d, cells in enumerate(dirs):
            for c, f in enumerate(cells):
                big = f.resize((64, 64), Image.NEAREST)
                atlas.alpha_composite(big, ((d * 3 + c) * CW, r * CW + (CW - 2) - (low * 2 + 1)))
    atlas.save(os.path.join(OUT, 'chars.png'), optimize=True)
    # dessins de combat : fond transparent, agrandis ×2 comme les Pokémon HGSS
    os.makedirs(os.path.join(OUT, 'dresseurs'), exist_ok=True)
    dres = []
    for cid in CHARS:
        p = os.path.join(RAW, 'dresseurs', cid + '.png')
        if not os.path.exists(p): continue
        im = Image.open(p).convert('RGBA')
        a = im.load(); bg = a[0, 0]
        if bg[3]:
            for y in range(im.height):
                for x in range(im.width):
                    if a[x, y][:3] == bg[:3]: a[x, y] = (0, 0, 0, 0)
        im.save(os.path.join(OUT, 'dresseurs', cid + '.png'), optimize=True)
        dres.append(cid)
    js = os.path.join(ROOT, 'odyssee', 'js', 'data', 'sprites.js')
    txt = open(js).read(); meta = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    meta['chars'] = {'w': CW, 'h': CW, 'd': 2, 'rows': {c: i for i, c in enumerate(ids)}}
    meta['dresseurs'] = dres
    with open(js, 'w') as f:
        f.write('// Généré par tools/odyssee-sprites.py — ne pas modifier à la main.\n')
        f.write('export const SPRITES = ' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'{len(ids)} personnages, {len(dres)} dessins de combat')

if __name__ == '__main__':
    pret = sys.argv[1] if len(sys.argv) > 1 else None
    smogon = sys.argv[2] if len(sys.argv) > 2 else None
    if pret or smogon: extract(pret, smogon)
    build()
