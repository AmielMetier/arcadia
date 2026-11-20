#!/usr/bin/env python3
"""tools/odyssee-pack-noirblanc.py — graphismes « Noir & Blanc » d'Odyssée (Options → Graphismes), tout tiré d'un seul kit.

Source : kit « Pokémon Essentials BW » v3.1.1 de KleinStudio (graphismes de Pokémon Noir & Blanc 2, tuiles de 32 px, soit
pile une case du jeu à l'écran). Les planches utiles sont gardées dans assets/graphics/noirblanc/ :
  kit_bw_set.png (PkmnBlackWhiteSet), mer.png et mer_profonde.png (autotiles Sea / Sea deep), grotte.png (Brown cave floor),
  volcan.png (lave, Phyromatical), persos/ (personnages du monde : trchar000, BW0xx…), objets (Object rock / tree).

Sortie dans odyssee/img/gfx/noirblanc/ :
  sol.png        une planche de tuiles de sol de 16 px (herbe, chemins et leurs bords, eau et rivages, hautes herbes, fleurs…)
  d_<nom>.png    décor (arbres, sapins, haies, lampadaires, pots, barrières…), 32 px par case : dessiné pixel pour pixel
  b_<nom>.png    bâtiments entiers (positions et portes : kit_bw_batiments.json)
  chars.png      planche des personnages du jeu (même disposition) avec les personnages de Noir & Blanc 2
et odyssee/js/data/gfx-noirblanc.js (liste des tuiles, du décor et des bâtiments), lu par odyssee/js/gfx.js.

Usage : python3 tools/odyssee-pack-noirblanc.py
"""
import json
import os

import numpy as np
from PIL import Image, ImageEnhance

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets', 'graphics', 'noirblanc')
OUT = os.path.join(ROOT, 'odyssee', 'img', 'gfx', 'noirblanc')
os.makedirs(OUT, exist_ok=True)
L = lambda n: Image.open(os.path.join(SRC, n)).convert('RGBA')
BW, MER, MERP, GROTTE, VOLC = L('kit_bw_set.png'), L('mer.png'), L('mer_profonde.png'), L('grotte.png'), L('volcan.png')
NEIGE, PONT_BW = L('neige.png'), L('pont_bw.png')

half = lambda im: im.resize((im.width // 2, im.height // 2), Image.NEAREST)   # le kit est du pixel art doublé : sans perte
cell = lambda cx, cy, im=BW: im.crop((cx * 32, cy * 32, cx * 32 + 32, cy * 32 + 32))
flip = lambda t: t.transpose(Image.FLIP_LEFT_RIGHT)


def tone(t, b=1.0, s=1.0):
    r, g, bl, a = t.split(); rgb = Image.merge('RGB', (r, g, bl))
    rgb = ImageEnhance.Brightness(ImageEnhance.Color(rgb).enhance(s)).enhance(b)
    return Image.merge('RGBA', (*rgb.split(), a))


def over(base, sp):
    o = base.copy(); o.alpha_composite(sp); return o


def sans(im, coul):
    """rend transparent tout pixel de la couleur donnée (l'herbe unie peinte autour des bords du kit)"""
    a = np.array(im); m = (a[..., :3] == np.array(coul[:3])).all(-1); a[m, 3] = 0
    return Image.fromarray(a, 'RGBA')


def net(im):
    """ne garde que les pixels pleins (les ombres à moitié transparentes du kit deviendraient des pâtés)"""
    a = np.array(im); a[a[..., 3] < 250, 3] = 0
    return Image.fromarray(a, 'RGBA')


def auto16(bloc, fond=None):
    """les 16 pièces d'un terrain selon ses voisins (haut 1, droite 2, bas 4, gauche 8 = même terrain), assemblées par
    quarts à partir d'un bloc 3 × 3 de tuiles de 32 px (coins, bords, plein)"""
    out = []
    for m in range(16):
        t = Image.new('RGBA', (32, 32))
        for qy in range(2):
            for qx in range(2):
                col = 1 if (m & (8 if qx == 0 else 2)) else (0 if qx == 0 else 2)
                row = 1 if (m & (1 if qy == 0 else 4)) else (0 if qy == 0 else 2)
                q = bloc.crop((col * 32 + qx * 16, row * 32 + qy * 16, col * 32 + qx * 16 + 16, row * 32 + qy * 16 + 16))
                t.paste(q, (qx * 16, qy * 16))
        out.append(over(fond, t) if fond else t)
    return out


# ------------------------------------------------------------------ sols
T = {}   # nom → tuile de 32 px (réduite à 16 px sur la planche sol.png)
herbe = [[cell(i, j) for j in range(2)] for i in range(3)]   # l'herbe de Noir & Blanc : un motif de 3 × 2 cases
for i in range(3):
    for j in range(2):
        T[f'pg_{i}_{j}'] = herbe[i][j]
G0 = herbe[0][0]
T['grass0'] = T['grass1'] = T['grass2'] = G0
T['forest0'] = T['forest1'] = G0


def pieces_eau(auto):
    """les cinq tuiles d'eau (autotile de 96 × 128 : coins rentrants en haut à droite, bloc 3 × 3 dessous)"""
    m = auto16(auto.crop((0, 32, 96, 128)))
    return {'0': m[0], 'v': m[5], 'h': m[10], 'f': m[15], 'i': auto.crop((64, 0, 96, 32))}


def pieces_chemin(src_auto):
    """les cinq tuiles d'un chemin ou du sable : la bordure du kit (16 px de large) est resserrée dans les 8 premiers
    pixels du bord pour que la moitié intérieure de chaque quart rejoigne exactement la teinte pleine « f » (sans couture
    entre les bords et le cœur du chemin, et sans frange verte sur la cendre ou la neige)."""
    f = np.array(src_auto.crop((32, 64, 64, 96)))
    bloc = np.array(src_auto.crop((0, 32, 96, 128)))
    op_vert = (bloc[..., 1].astype(int) > bloc[..., 0].astype(int) + 18) & (bloc[..., 3] > 0)
    bloc[op_vert, 3] = 0
    bloc[bloc[..., 3] < 180, 3] = 0
    # Réchauffe les pixels de bordure gris-olive (r ≈ g, r - b < 32) hérités du kit herbe pour qu'ils fondent proprement sur le sable du désert
    br, bg, bb, ba = bloc[..., 0].astype(int), bloc[..., 1].astype(int), bloc[..., 2].astype(int), bloc[..., 3]
    bord_gris = (ba > 0) & (np.abs(br - bg) <= 10) & ((br - bb) <= 30) & (br < 210)
    if np.any(bord_gris):
        lum = (br[bord_gris] / 180.0).clip(0.75, 1.12)
        bloc[bord_gris, 0] = np.clip(lum * 204, 0, 245).astype('uint8')
        bloc[bord_gris, 1] = np.clip(lum * 184, 0, 232).astype('uint8')
        bloc[bord_gris, 2] = np.clip(lum * 134, 0, 188).astype('uint8')
    out = {'f': Image.fromarray(f, 'RGBA')}
    for st in ['0', 'v', 'h', 'i']:
        tile = f.copy()
        for qy in range(2):
            for qx in range(2):
                for py in range(0, 16, 2):
                    for px in range(0, 16, 2):
                        dx = px if qx == 0 else (14 - px)
                        dy = py if qy == 0 else (14 - py)
                        y, x = qy * 16 + py, qx * 16 + px
                        if st == 'v':
                            d_src = min(24, dx * 2 + 2)
                            c = bloc[32 + y, d_src if qx == 0 else (94 - d_src)]
                        elif st == 'h':
                            d_src = min(24, dy * 2 + 2)
                            c = bloc[d_src if qy == 0 else (94 - d_src), 32 + x]
                        elif st == '0':
                            sx = min(24, dx * 2 + 2) if qx == 0 else (94 - min(24, dx * 2 + 2))
                            sy = min(24, dy * 2 + 2) if qy == 0 else (94 - min(24, dy * 2 + 2))
                            c = bloc[sy, sx]
                        elif st == 'i':
                            if dx == 0 and dy == 0:
                                c = [0, 0, 0, 0]
                            elif dx <= 4 and dy <= 4 and (dx + dy) <= 6:
                                d_in = 8 + (dx + dy) * 2
                                c = bloc[32 + y, d_in if qx == 0 else (94 - d_in)]
                            else:
                                c = f[y, x]
                        tile[y:y + 2, x:x + 2] = c
        out[st] = Image.fromarray(tile, 'RGBA')
    return out


def pieces_pave():
    """Pavés de pierre de Noir & Blanc (dalles carrées et bordures de pierre taillée du kit) : le centre plein f est
    utilisé partout à l'intérieur, encadré sur ses bords et ses coins par la bordure de pierre."""
    f = np.array(BW.crop((32, 20256, 64, 20288)))
    bloc = np.array(BW.crop((0, 704, 96, 800)))
    out = {'f': Image.fromarray(f, 'RGBA')}
    for st in ['0', 'v', 'h', 'i']:
        tile = f.copy()
        for qy in range(2):
            for qx in range(2):
                for py in range(0, 16, 2):
                    for px in range(0, 16, 2):
                        dx = px if qx == 0 else (14 - px)
                        dy = py if qy == 0 else (14 - py)
                        y, x = qy * 16 + py, qx * 16 + px
                        if st == 'v' and dx < 6:
                            tile[y:y + 2, x:x + 2] = bloc[32 + y, dx if qx == 0 else (94 - dx)]
                        elif st == 'h' and dy < 6:
                            tile[y:y + 2, x:x + 2] = bloc[dy if qy == 0 else (94 - dy), 32 + x]
                        elif st == '0' and (dx < 6 or dy < 6):
                            sx = (dx if qx == 0 else 94 - dx) if dx < 6 else (32 + px)
                            sy = (dy if qy == 0 else 94 - dy) if dy < 6 else (32 + py)
                            tile[y:y + 2, x:x + 2] = bloc[sy, sx]
                        elif st == 'i' and dx < 6 and dy < 6:
                            d_max = max(dx, dy)
                            tile[y:y + 2, x:x + 2] = bloc[32 + y, d_max if qx == 0 else (94 - d_max)]
        out[st] = Image.fromarray(tile, 'RGBA')
    return out


SABLE = L('auto_sable.png')
for nom, P in [('path', pieces_chemin(SABLE)), ('sand', pieces_chemin(tone(SABLE, 1.12, 0.55))), ('pave', pieces_pave())]:
    for k, t in P.items():
        T[f'q_{nom}_{k}'] = t
    T[nom + '0'] = P['f']
sable = T['sand0']
T['snow0'] = NEIGE; T['snow1'] = flip(NEIGE)
T['cave0'] = GROTTE.crop((32, 64, 64, 96)); T['cave1'] = flip(T['cave0'])
T['ash0'] = tone(T['cave0'], 0.72, 0.25); T['ash1'] = flip(T['ash0'])
T['bridgeEW'] = PONT_BW; T['bridgeNS'] = PONT_BW.transpose(Image.ROTATE_90)
T['stairs'] = BW.crop((0, 19712, 32, 19744))
T['cavestairs'] = tone(T['stairs'], 0.62, 1.15)
lave = lambda cx, cy: VOLC.crop((cx * 16, cy * 16, cx * 16 + 16, cy * 16 + 16)).resize((32, 32), Image.NEAREST)
T['lava0'], T['lava1'] = lave(5, 5), lave(4, 5)
# Chaussées d'asphalte de Métropole / Voltacité / Forge-Acier : grain de bitume BW2 + pointillés + passage piéton
asph_src = BW.crop((68, 26144, 84, 26160)).convert('RGBA')
asph_base = Image.new('RGBA', (32, 32))
for _iy in (0, 16):
    for _ix in (0, 16):
        asph_base.paste(asph_src, (_ix, _iy))


def asph_tuile(mode=''):
    t = asph_base.copy()
    from PIL import ImageDraw
    dr = ImageDraw.Draw(t)
    dash, sh = (224, 222, 214, 255), (118, 120, 126, 255)
    if mode == 'n':
        for x0 in (4, 20):
            dr.rectangle([x0, 0, x0 + 9, 1], fill=dash); dr.rectangle([x0, 2, x0 + 9, 2], fill=sh)
    elif mode == 's':
        for x0 in (4, 20):
            dr.rectangle([x0, 29, x0 + 9, 29], fill=sh); dr.rectangle([x0, 30, x0 + 9, 31], fill=dash)
    elif mode == 'w':
        for y0 in (4, 20):
            dr.rectangle([0, y0, 1, y0 + 9], fill=dash); dr.rectangle([2, y0, 2, y0 + 9], fill=sh)
    elif mode == 'e':
        for y0 in (4, 20):
            dr.rectangle([29, y0, 29, y0 + 9], fill=sh); dr.rectangle([30, y0, 31, y0 + 9], fill=dash)
    elif mode == 'x':
        for x0 in (2, 10, 18, 26):
            dr.rectangle([x0, 4, x0 + 3, 27], fill=dash); dr.rectangle([x0, 28, x0 + 3, 28], fill=sh); dr.rectangle([x0 + 4, 4, x0 + 4, 27], fill=sh)
    return t


T['asph'] = asph_tuile('')
for _dir in ('n', 's', 'w', 'e', 'x'):
    T['asph_' + _dir] = asph_tuile(_dir)
touffe, touffe_s = cell(4, 11), cell(5, 11)
# touffe enneigée : pointes givrées blanches/glace sur tiges bleu-ardoise pour s'accorder aux tuiles de neige
_tn = np.array(touffe_s.copy())
_ty = np.arange(_tn.shape[0])[:, None]
_tal = _tn[..., 3] > 0
_dark_tip = _tal & (_ty < 18) & ((_tn[..., 1].astype(int) >= 100) | (_ty < 12))
_tn[_tal & ~_dark_tip, :3] = np.clip(_tn[_tal & ~_dark_tip, :3] * [0.85, 0.85, 1.08], 0, 255).astype('uint8')
_tn[_dark_tip & (_ty < 10)] = [238, 246, 255, 255]
_tn[_dark_tip & (_ty >= 10) & (_ty < 14)] = [208, 228, 246, 255]
_tn[_dark_tip & (_ty >= 14)] = [156, 192, 224, 255]
touffe_neige = Image.fromarray(_tn, 'RGBA')
# hautes herbes : la touffe seule, posée par le jeu sur l'herbe de la case
T['q_tall0'], T['q_tall1'] = touffe, flip(touffe)
T['q_darktall0'], T['q_darktall1'] = touffe_s, flip(touffe_s)
T['tall0'] = over(G0, touffe); T['tall1'] = over(G0, flip(touffe))
T['darktall0'] = over(G0, touffe_s); T['darktall1'] = over(G0, flip(touffe_s))
T['snowtall0'] = over(T['snow0'], touffe_neige); T['snowtall1'] = over(T['snow1'], flip(touffe_neige))

# fleurs de Noir & Blanc (cell(6, 135) du kit : feuillage et trois fleurs, déclinées en 6 couleurs et 2 étapes d'animation)
fleur_bw = net(cell(6, 135))
FLEUR_COULS = [
    (240, 80, 95),    # 0 : rouge / rose vif
    (250, 215, 65),   # 1 : jaune
    (95, 165, 250),   # 2 : bleu
    (185, 115, 235),  # 3 : violet
    (250, 145, 65),   # 4 : orange
    (248, 248, 252),  # 5 : blanc
]
for k, (cr, cg, cb) in enumerate(FLEUR_COULS):
    a = np.array(fleur_bw).astype(float)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    # pétales roses d'origine (r > g + 25) : reteints dans la couleur choisie en gardant le cœur jaune et les feuilles vertes
    petale = (al > 0) & (r > g + 25)
    lum = (r[petale] / 235.0).clip(0.55, 1.15)
    a[..., 0][petale] = np.clip(lum * cr, 0, 255)
    a[..., 1][petale] = np.clip(lum * cg, 0, 255)
    a[..., 2][petale] = np.clip(lum * cb, 0, 255)
    fl0 = Image.fromarray(a.astype('uint8'), 'RGBA')
    # seconde image : les fleurs se balancent d'un cran (2 px) vers la droite
    fl1 = Image.new('RGBA', (32, 32))
    fl1.paste(fl0.crop((0, 0, 30, 32)), (2, 0))
    # fleurs transparentes : le jeu pose dessous l'herbe, le sable, la cendre ou la neige de la case
    T[f'q_flower{k}_f0'] = fl0
    T[f'q_flower{k}_f1'] = fl1

# mer : 4 images d'animation, rivage de rochers ; mêmes cinq tuiles que les chemins
for f in range(4):
    fr = MER.crop((f * 192, 0, f * 192 + 96, 128))
    for k, t in pieces_eau(fr).items():
        T[f'q_water_{k}_f{f}'] = t
    T[f'water{f}'] = fr.crop((32, 64, 64, 96))
    T[f'deep{f}'] = MERP.crop((f * 192 + 32, 64, f * 192 + 64, 96))
# rebords à sauter (sud, est, ouest) et intérieurs : sol du Centre Pokémon et de la Boutique, comptoirs aux couleurs du kit
ledge_s = BW.crop((112, 960, 144, 992))
T['ledge'] = over(G0, ledge_s)
T['ledgeE'] = over(G0, ledge_s.transpose(Image.ROTATE_90))
T['ledgeW'] = over(G0, ledge_s.transpose(Image.ROTATE_270))
# buttes d'herbe (plateaux du dehors) : le cadre « herbe sur roche » du kit (bord d'herbe tout autour, roche au pied et
# sur les flancs), découpé sur la grille décalée d'une demi-case où il est dessiné. Pièces posées par world3d.js
# (reliefDehors) sur les cases du bord du plateau (nbf_n, nbf_e…) et sur les cases de paroi (nbf_mur_*)
FAL = lambda x, y: net(BW.crop((x, y, x + 32, y + 32)))   # sans les ombres grises à demi transparentes du kit (elles faisaient des lignes en biais)
Y0 = 14844   # haut du cadre (la lèvre d'herbe) ; le plateau fait 3 × 3 cases de x = 32 à 128, la paroi en dessous
for nom, (fx, fy) in {'nw': (32, 0), 'n': (64, 0), 'ne': (96, 0), 'w': (32, 1), 'e': (96, 1),
                      'sw': (32, 2), 's': (64, 2), 'se': (96, 2), 'mur_w': (32, 3), 'mur_c': (64, 3), 'mur_e': (96, 3),
                      # flancs : la roche qui descend sur la case d'à côté (plus basse), à l'ouest et à l'est du plateau
                      'fl_w_t': (0, 0), 'fl_w_m': (0, 1), 'fl_w_b': (0, 2), 'fl_w_mur': (0, 3),
                      'fl_e_t': (128, 0), 'fl_e_m': (128, 1), 'fl_e_b': (128, 2), 'fl_e_mur': (128, 3)}.items():
    T['x_nbf_' + nom] = FAL(fx, Y0 + 32 * fy)
# montagnes du dehors (world3d.js, paroiCell) : le plateau de roche du kit, 3 × 3 cases (dessus, lèvre claire, paroi au
# sud), posé à la place des gradins façon HeartGold pour la roche brune (dehors et grottes de terre) ; la mer, la neige,
# le magma et la lune gardent les leurs
for bio in ('montagne', 'terre'):
    for R in range(3):
        for C in range(3):
            T[f'x_rp_{bio}_{R}{C}'] = FAL(160 + 32 * C, 14711 + 32 * R)
T['x_nbr'] = FAL(192, 14743)
for nom in ('mur_w', 'mur_c', 'mur_e'):   # la paroi d'une butte posée au-dessus d'une montagne : sur fond de roche
    T[f'x_nbf_{nom}_r'] = over(T['x_nbr'], T['x_nbf_' + nom])
CENTRE, BOUTIQUE = L('centre_interieur.png'), L('boutique_interieur.png')
T['floor_pink'] = cell(1, 10, CENTRE); T['floor_blue'] = cell(0, 5, BOUTIQUE)


def uni(haut, milieu, bas, h=4, b=6):
    t = Image.new('RGBA', (32, 32), milieu); t.paste(haut, (0, 0, 32, h)); t.paste(bas, (0, 32 - b, 32, 32)); return t


T['x_counter'] = uni((240, 248, 250, 255), (206, 224, 230, 255), (150, 176, 186, 255))
T['x_counterfront'] = uni((120, 178, 190, 255), (62, 128, 146, 255), (36, 84, 100, 255))
noms = sorted(T)
COLS = 32
planche = Image.new('RGBA', (COLS * 16, ((len(noms) + COLS - 1) // COLS) * 16))
for i, n in enumerate(noms):
    planche.paste(half(T[n]), ((i % COLS) * 16, (i // COLS) * 16))
planche.save(os.path.join(OUT, 'sol.png'))


# ------------------------------------------------------------------ décor (pixel pour pixel, ancré aux pieds)
def trim(im):
    bb = im.getbbox(); return im.crop(bb) if bb else im


def arbre(x0, y0, x1, y1, pas=64):
    """un arbre seul dans une pile de deux : la silhouette du haut (complète) sert à détourer celui du bas"""
    haut = np.array(BW.crop((x0, y0 - pas, x1, y1 - pas))); bas = np.array(BW.crop((x0, y0, x1, y1)))
    libre = np.arange(bas.shape[0])[:, None] >= pas   # sous l'arbre du haut, plus rien ne dépasse
    garde = (haut[..., 3] > 0) | libre
    bas[~garde, 3] = 0
    return trim(Image.fromarray(bas, 'RGBA'))


def sans_herbe_base(im, mode='tree'):
    """Retire la pastille d'herbe verte ou de terre beige au pied de l'arbre sans couper la base du feuillage."""
    a = np.array(im.convert('RGBA')).copy()
    h = a.shape[0]
    for y in range(max(0, h - 25), h):
        for x in range(a.shape[1]):
            r, g, b, al = [int(v) for v in a[y, x]]
            if al == 0:
                continue
            if mode == 'deadtree':
                if y >= h - 10 and not (r < 145 and (r - b) > 30):
                    a[y, x, 3] = 0
            else:
                est_fond_herbe = b >= 115 and g >= b - 10 and g > r + 45
                est_pied_bas = y >= h - 18 and ((g > r + 10 and b >= r - 6) or g > r + 3)
                if est_fond_herbe or est_pied_bas:
                    a[y, x, 3] = 0
    return trim(Image.fromarray(a, 'RGBA'))


feuillu = sans_herbe_base(arbre(96, 848, 160, 968).resize((52, 74), Image.NEAREST))
sapin = sans_herbe_base(arbre(136, 1836, 216, 1960).resize((54, 78), Image.NEAREST))


def feuilles(im, coul):
    """le feuillage (pixels verts) reteint en gardant le tronc intact"""
    a = np.array(im).astype(float); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    vert = (g > r * 1.25) & (g > b * 1.02) & (a[..., 3] > 0)
    vert[-10:] = False
    lum = g[vert] / 200.0
    for k in range(3):
        a[..., k][vert] = np.clip(lum * coul[k], 0, 255)
    return Image.fromarray(a.astype('uint8'), 'RGBA')


def extraire_ilot(im, seed_xy, diag=True):
    """Ne garde que la composante connexe contenant seed_xy (évite les pixels voisins collés dans la planche)."""
    a = np.array(im); h, w = a.shape[:2]
    vis = np.zeros((h, w), dtype=bool)
    sx, sy = seed_xy
    if a[sy, sx, 3] == 0:
        raise ValueError(f'seed transparente: {seed_xy}')
    q = [(sy, sx)]; vis[sy, sx] = True
    nbrs = [(-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-1, -1), (-1, 1), (1, -1), (1, 1)] if diag else [])
    for cy, cx in q:
        for dy, dx in nbrs:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not vis[ny, nx] and a[ny, nx, 3] > 0:
                vis[ny, nx] = True; q.append((ny, nx))
    a[~vis] = 0
    return trim(Image.fromarray(a, 'RGBA'))


deadtree_nb = sans_herbe_base(extraire_ilot(VOLC.crop((312, 0, 368, 70)), (32, 52)), 'deadtree')
caverock_nb = extraire_ilot(VOLC.crop((256, 30, 288, 56)), (15, 16))
stalag_nb = tone(trim(net(VOLC.crop((290, 0, 316, 30)))), 0.92, 0.55).resize((26, 40), Image.NEAREST)
rocher_grand_nb = extraire_ilot(net(VOLC.crop((282, 28, 316, 64))), (16, 16)).resize((38, 39), Image.NEAREST)
_m_src = net(VOLC.crop((274, 12, 287, 29)))
minerai_nb = tone(extraire_ilot(_m_src, (7, 9)), 0.85, 0.45).resize((30, 28), Image.NEAREST)
_ma = np.array(minerai_nb)
for mx, my, mc in ((8, 12, (240, 200, 72, 255)), (19, 10, (96, 208, 240, 255)), (14, 18, (240, 200, 72, 255)), (21, 17, (240, 200, 72, 255))):
    if mx + 2 < _ma.shape[1] and my + 2 < _ma.shape[0] and _ma[my, mx, 3] > 0:
        _ma[my:my + 2, mx:mx + 2] = mc
minerai_nb = Image.fromarray(_ma, 'RGBA')

caisses_nb = net(BW.crop((96, 1024, 128, 1080))).resize((30, 54), Image.NEAREST)
# Caisse carrée à mi-hauteur tirée du haut + du bas de la caisse BW
_c_top = net(BW.crop((96, 1024, 128, 1034)))
_c_bot = net(BW.crop((96, 1060, 128, 1080)))
_c_sq = Image.new('RGBA', (32, 30))
_c_sq.paste(_c_top, (0, 0)); _c_sq.paste(_c_bot, (0, 10))
caisse_nb = trim(_c_sq).resize((26, 26), Image.NEAREST)

# Colonne, borne et statue de dragon du kit BW
_col_a = np.array(net(BW.crop((12, 14228, 52, 14388))))
_crgb = _col_a[..., :3].astype(int)
_col_a[(np.abs(_crgb[..., 0] - _crgb[..., 1]) <= 3) & (np.abs(_crgb[..., 1] - _crgb[..., 2]) <= 3) & (_crgb[..., 0] < 160), 3] = 0
colonne_nb = extraire_ilot(Image.fromarray(_col_a, 'RGBA'), (18, 80)).resize((24, 78), Image.NEAREST)

_br_a = np.array(extraire_ilot(net(BW.crop((0, 27360, 48, 27430))), (20, 20)))
_brgb = _br_a[..., :3].astype(int)
_br_a[(np.abs(_brgb[..., 0] - _brgb[..., 1]) <= 3) & (np.abs(_brgb[..., 1] - _brgb[..., 2]) <= 3) & (_brgb[..., 0] >= 120), 3] = 0
borne_nb = trim(Image.fromarray(_br_a, 'RGBA'))
borne_nb = borne_nb.resize((22, round(borne_nb.height * 22 / borne_nb.width)), Image.NEAREST)

_dr_a = np.array(net(BW.crop((24, 27146, 140, 27344))))
_drgb = _dr_a[..., :3].astype(int)
_dr_a[(_dr_a[..., 3] > 0) & (_drgb[..., 1] > _drgb[..., 0] + 15), 3] = 0
_dr_clean = trim(Image.fromarray(_dr_a, 'RGBA'))
statue_dragon_nb = _dr_clean.resize((44, round(_dr_clean.height * 44 / _dr_clean.width)), Image.NEAREST)

EXT_IMG = L('ext_decors.png')
EXT_BOXES = json.load(open(os.path.join(SRC, 'ext_decors.json')))
EXT = {k: EXT_IMG.crop(tuple(b)) for k, b in EXT_BOXES.items()}

D = {
    'tree': feuillu, 'tree2': flip(feuillu), 'tree3': feuillu, 'pine': sapin,
    'snowpine': feuilles(sapin, (215, 235, 250)),
    'deadtree': deadtree_nb,
    'arbre_automne': feuilles(feuillu, (235, 150, 40)), 'erable': feuilles(feuillu, (220, 70, 45)), 'cerisier': feuilles(feuillu, (250, 165, 195)),
    'bush': trim(net(BW.crop((0, 632, 32, 672)))), 'lamp': EXT['lamp'],
    'rock': trim(L('objet_rocher.png').crop((0, 0, 32, 32))), 'caverock': caverock_nb, 'stalag': stalag_nb,
    'rocher_grand': rocher_grand_nb, 'minerai': minerai_nb, 'cuttree': trim(L('objet_arbuste.png').crop((0, 0, 32, 32))),
    'palm': EXT['palm'], 'cactus': EXT['cactus'], 'cactus2': EXT['cactus2'],
    'torii': EXT['torii'], 'lanterne': EXT['lanterne'], 'stele': EXT['stele'], 'gargouille': EXT['gargouille'],
    'bateau': EXT['bateau'], 'tonneau': EXT['tonneau'],
    'caisses': caisses_nb, 'caisse': caisse_nb, 'colonne': colonne_nb, 'borne': borne_nb, 'statue_dragon': statue_dragon_nb,
    'pot': trim(net(BW.crop((192, 21248, 224, 21310)))),
    'mailbox': trim(net(BW.crop((160, 5632, 192, 5696)))),
    'statue': trim(net(BW.crop((192, 21312, 224, 21376)))),
    'gymstatue': trim(net(BW.crop((192, 21312, 224, 21376)))),
    'banc': trim(net(BW.crop((0, 3200, 64, 3264)))),
    'parasol': trim(trim(net(BW.crop((144, 21056, 208, 21136)))).resize((48, 50), Image.NEAREST)),
    'fence': trim(net(BW.crop((32, 796, 64, 832)))),
    'barriere': trim(net(BW.crop((32, 796, 64, 832)))),
    'barriere_fin': trim(net(BW.crop((32, 796, 64, 832)))),
    'barriere_v': trim(net(BW.crop((12, 830, 20, 864)))),
    'barriere_v0': trim(net(BW.crop((12, 830, 20, 864)))),
}
# mobilier du Centre Pokémon et panneau de bois des routes
D['plant'] = trim(net(CENTRE.crop((192, 1096, 224, 1170)))); D['pc'] = trim(net(CENTRE.crop((192, 1010, 224, 1090))))
D['healer'] = trim(net(CENTRE.crop((160, 768, 224, 824)))); D['bench'] = trim(net(CENTRE.crop((64, 960, 160, 992))))
D['vase'] = trim(net(CENTRE.crop((192, 864, 224, 920))))
D['fontaine'] = trim(trim(net(BW.crop((8, 11356, 152, 11570)))).resize((48, 68), Image.NEAREST))
D['sign'] = trim(trim(net(BW.crop((176, 98 * 32, 256, 100 * 32)))).resize((32, 28), Image.NEAREST))
# devant les jambes de qui marche dans les hautes herbes : le bas de la touffe
bas = lambda t: t.crop((0, 16, 32, 32))
D['grassfront'], D['grassfront2'] = bas(touffe), bas(flip(touffe))
D['darkfront'], D['darkfront2'] = bas(touffe_s), bas(flip(touffe_s))
D['snowfront'], D['snowfront2'] = bas(touffe_neige), bas(flip(touffe_neige))
for i, c in enumerate([(235, 150, 40), (220, 70, 45), (240, 190, 50), (200, 95, 40), (225, 120, 50), (190, 60, 50)]):
    D[f'automne{i}'] = feuilles(feuillu, c)
for n, im in D.items():
    im.save(os.path.join(OUT, f'd_{n}.png'))

# ------------------------------------------------------------------ bâtiments entiers (sans ombre noire, complets)
def recolor_roi(im, mask_fn, y_max, mat_rgb):
    """Teinte une zone de toit ou façade en préservant les contrastes DS."""
    a = np.array(im.convert('RGBA')).copy()
    yy = np.arange(a.shape[0])[:, None]
    r, g, b, al = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float), a[..., 3]
    m = (al > 0) & (yy < y_max) & mask_fn(r, g, b)
    rm, gm, bm = r[m], g[m], b[m]
    (m00, m01, m02), (m10, m11, m12), (m20, m21, m22) = mat_rgb
    a[..., 0][m] = np.clip(rm * m00 + gm * m01 + bm * m02, 0, 255).astype('uint8')
    a[..., 1][m] = np.clip(rm * m10 + gm * m11 + bm * m12, 0, 255).astype('uint8')
    a[..., 2][m] = np.clip(rm * m20 + gm * m21 + bm * m22, 0, 255).astype('uint8')
    return Image.fromarray(a, 'RGBA')

def sauver_bat(nom, im, porte):
    by = np.where(np.array(im)[..., 3] > 0)[0]
    if len(by):
        im = im.crop((0, 0, im.width, int(by.max()) + 1))
    im.save(os.path.join(OUT, f'b_{nom}.png'))
    bat_dims[nom] = [im.width, porte]
    return im

BATS = json.load(open(os.path.join(SRC, 'kit_bw_batiments.json')))
bat_imgs, bat_dims = {}, {}
for nom, (x0, y0, x1, y1, porte) in BATS.items():
    if nom == 'arene':
        # l'aile droite de l'Arène (62 px) est rangée 320 px plus bas sur la planche du kit : recollée à droite
        im = Image.new('RGBA', (x1 - x0, y1 - y0))
        im.paste(BW.crop((34, 22698, 256, 22962)), (0, 0))
        im.paste(BW.crop((0, 23018, 62, 23282)), (222, 0))
        im = net(im)
    elif nom == 'maison_orange':
        # le débord droit du toit (4 px) est rangé 192 px plus bas à gauche de la planche : recollé à droite
        im = Image.new('RGBA', (x1 - x0, y1 - y0))
        im.paste(BW.crop((10, 5960, 256, 6192)), (0, 0))
        im.paste(BW.crop((0, 6152, 4, 6384)), (246, 0))
        im = net(im)
    elif nom == 'boutique':
        # boutique de 5 cases avec porte à droite (porte = 3) : store reteint en bleu Boutique Pokémon, toit raccourci
        a = np.array(net(BW.crop((x0, y0, x1, y1))))
        st = a[185:260, :, :]
        rouge = (st[..., 3] > 0) & (st[..., 0].astype(int) > st[..., 1].astype(int) * 2) & (st[..., 0].astype(int) > st[..., 2].astype(int) * 2)
        rv, gv = st[..., 0][rouge].astype(float), st[..., 1][rouge].astype(float)
        st[..., 0][rouge] = np.clip(gv * 0.85 + 16, 0, 255).astype('uint8')
        st[..., 1][rouge] = np.clip(rv * 0.55 + 24, 0, 255).astype('uint8')
        st[..., 2][rouge] = np.clip(rv * 1.05 + 32, 0, 255).astype('uint8')
        im = Image.fromarray(np.concatenate([a[0:22], a[126:300]], axis=0), 'RGBA')
    elif nom == 'boutique_p':
        # petite boutique de 4 cases avec porte à gauche (porte = 1) et faîtage complet
        im = flip(net(BW.crop((x0, y0, x1, y1))))
        a = np.array(im)
        a[0:4, 10:138] = a[88:92, 10:138]
        im = Image.fromarray(a, 'RGBA')
    elif nom in ('boutique_b', 'maison_d', 'maison_e'):
        # toit de tôle raccourci pour tenir dans les rangées de maisons sans déborder sur la rue du nord
        a = np.array(net(BW.crop((x0, y0, x1, y1))))
        im = Image.fromarray(np.concatenate([a[0:22], a[96:]], axis=0), 'RGBA')
    elif nom == 'maison_f':
        a = np.array(net(BW.crop((x0, y0, x1, y1))))
        im = Image.fromarray(np.concatenate([a[0:96], a[172:]], axis=0), 'RGBA')
    elif nom == 'maison_g':
        a = np.array(net(BW.crop((x0, y0, x1, y1))))
        im = Image.fromarray(np.concatenate([a[0:114], a[182:]], axis=0), 'RGBA')
    elif nom in ('maison_b', 'maison_c'):
        a = np.array(net(BW.crop((x0, y0, x1, y1))))
        im = Image.fromarray(np.concatenate([a[0:24], a[48:]], axis=0), 'RGBA')
    elif nom == 'maison_a_g':
        # maison à toit orange avec porte à gauche (porte = 48 px = 1,5 case) pour les maisons de 4 cases de large
        a = np.array(net(BW.crop((x0, y0, x1, y1))))
        w_g, p_m = a[104:156, 30:64].copy(), a[104:156, 64:98].copy()
        a[104:156, 30:64], a[104:156, 64:98] = p_m, w_g
        im = Image.fromarray(a, 'RGBA')
    elif nom == 'maison_ville_rg':
        # immeuble de briques européennes à 2 étages + mansarde (raccourci proprement d'un étage pour l'alignement des rues)
        a = np.array(net(BW.crop((x0, y0, x1, y1))))
        im = Image.fromarray(np.concatenate([a[0:124], a[172:]], axis=0), 'RGBA')
    elif nom in ('manoir', 'manoir_r'):
        mr = np.array(net(BW.crop((12, 12224, 196, 12508))))
        mb = np.array(net(BW.crop((12, 12512, 196, 12796))))
        src = mr if nom == 'manoir_r' else mb
        mr[:, 170:184] = mr[:, 13::-1]
        src[:, 170:184] = src[:, 13::-1]
        out_m = np.zeros((196, 184, 4), dtype='uint8')
        out_m[16:, :] = np.concatenate([mr[38:70], src[136:]], axis=0)
        peak = mb[0:56, 52:132]
        m_pk = peak[..., 3] > 0
        out_m[0:56, 52:132][m_pk] = peak[m_pk]
        im = Image.fromarray(out_m, 'RGBA')
    elif nom == 'fontaine':
        im = trim(net(BW.crop((x0, y0, x1, y1)))).resize((96, 136), Image.NEAREST)
    else:
        im = net(BW.crop((x0, y0, x1, y1)))
    bat_imgs[nom] = sauver_bat(nom, im, porte)

# Variantes de toits et façades DS pour diversifier les quartiers tout en gardant la géométrie exacte des portes
bleu_m = lambda r, g, b: (b > r + 24) & (b > g + 8)
rouge_m = lambda r, g, b: (r > b + 20) & (r > g + 14)
orange_m = lambda r, g, b: (r > b + 28) & (g >= b + 4)
MAT_SAGE = ((0.65, 0.20, 0.14), (0.15, 0.55, 0.34), (0.30, 0.40, 0.16))
MAT_TERRA = ((0.18, 0.22, 0.62), (0.35, 0.42, 0.12), (0.45, 0.28, 0.14))
MAT_OCRE = ((0.15, 0.25, 0.65), (0.20, 0.35, 0.42), (0.50, 0.32, 0.10))
MAT_BLEU = ((0.20, 0.35, 0.35), (0.22, 0.52, 0.28), (0.68, 0.18, 0.22))
MAT_TEAL = ((0.22, 0.52, 0.18), (0.48, 0.45, 0.18), (0.18, 0.45, 0.30))
MAT_O2BL = ((0.18, 0.22, 0.55), (0.16, 0.56, 0.32), (0.58, 0.28, 0.22))
BAT_VARIANTES = [
    ('maison_verte', 'maison_bleue', bleu_m, 144, MAT_SAGE),
    ('maison_rouge', 'maison_bleue', bleu_m, 144, MAT_TERRA),
    ('maison_jaune', 'maison_bleue', bleu_m, 144, MAT_OCRE),
    ('maison_a_bl', 'maison_a', orange_m, 110, MAT_O2BL),
    ('maison_a_g_bl', 'maison_a_g', orange_m, 110, MAT_O2BL),
    ('maison_f_bleue', 'maison_f', lambda r, g, b: (r > b + 35) & (r > g * 1.4), 170, MAT_BLEU),
    ('maison_g_ocre', 'maison_g', lambda r, g, b: (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b) > 10) | ((r < 120) & (g > r)), 184, ((0.35, 0.45, 0.25), (0.30, 0.45, 0.22), (0.22, 0.30, 0.28))),
    ('maison_brique_r', 'maison_brique', lambda r, g, b: (b > r + 20) & (b > g + 5), 115, MAT_TERRA),
    ('maison_c_ve', 'maison_c', orange_m, 120, MAT_TEAL),
    ('maison_e_bl', 'maison_e', lambda r, g, b: (np.abs(r - g) < 18) & (np.abs(g - b) < 18) & (r < 140), 95, ((0.55, 0.20, 0.25), (0.22, 0.55, 0.35), (0.25, 0.28, 0.65))),
    ('maison_ville_bl', 'maison_ville_rg', rouge_m, 145, MAT_BLEU),
    ('maison_ville_ve', 'maison_ville_rg', rouge_m, 145, MAT_TEAL),
    ('manoir_v', 'manoir', lambda r, g, b: (b > r + 18) & (b > g + 4), 115, ((0.45, 0.25, 0.22), (0.12, 0.48, 0.40), (0.28, 0.36, 0.26))),
]
for vnom, src_nom, mask_fn, ymax_r, mat_r in BAT_VARIANTES:
    bat_imgs[vnom] = sauver_bat(vnom, recolor_roi(bat_imgs[src_nom], mask_fn, ymax_r, mat_r), bat_dims[src_nom][1])

# ------------------------------------------------------------------ personnages
# planche du jeu : une rangée de 12 cases de 64 px par personnage (bas, gauche, droite, haut ; pas, arrêt, pas)
def cadrer_pose(fr):
    """Ancre une pose 64×64 ou 68×72 tout en bas de la case (y = 64) sans rogner la coiffure."""
    ys, xs = np.where(np.array(fr)[..., 3] > 0)
    if not len(ys):
        return Image.new('RGBA', (64, 64))
    fw = fr.width
    ymin_f, ymax_f = int(ys.min()), int(ys.max()) + 1
    xmin_f, xmax_f = int(xs.min()), int(xs.max()) + 1
    xc = max(0, min(xmin_f, min(fw - 64, (xmin_f + xmax_f - 64) // 2))) if fw > 64 else 0
    dx = 0 if fw > 64 else (64 - fw) // 2
    if ymax_f - ymin_f > 64:
        # cas unique où une pose dépasse 64 px (Célestine, 66 px) : on tasse 2 lignes unies au milieu de la robe
        a_fr = np.array(fr)[ymin_f:ymax_f, xc:xc + 64]
        keep = [i for i in range(a_fr.shape[0]) if i not in (44, 45)][:64]
        return Image.fromarray(a_fr[keep], 'RGBA')
    sub = fr.crop((xc, ymin_f, xc + min(64, fw), ymax_f))
    c = Image.new('RGBA', (64, 64))
    c.alpha_composite(sub, (dx, 64 - (ymax_f - ymin_f)))
    return c

PERSOS = json.load(open(os.path.join(SRC, 'persos.json')))
orig_chars = Image.open(os.path.join(ROOT, 'odyssee', 'img', 'chars.png')).convert('RGBA')
rows = json.load(open(os.path.join(SRC, 'rangees.json')))   # nom → rangée (odyssee/js/data/sprites.js, SPRITES.chars.rows)
extras = [nom for nom in PERSOS if nom not in rows]
nb_char_rows = {nom: orig_chars.height // 64 + i for i, nom in enumerate(extras)}
chars = Image.new('RGBA', (768, orig_chars.height + len(extras) * 64))
# Les rangées de secours (momie, goule, pharaon) gardent l'apparence d'origine mais avec les pieds collés au sol
for r in range(orig_chars.height // 64):
    for col in range(12):
        chars.alpha_composite(cadrer_pose(orig_chars.crop((col * 64, r * 64, (col + 1) * 64, (r + 1) * 64))), (col * 64, r * 64))

all_rows = {**rows, **nb_char_rows}
faits = 0
for nom, fichier in PERSOS.items():
    if nom not in all_rows:
        continue
    src = L(os.path.join('persos', fichier + '.png')); fw, fh = src.width // 4, src.height // 4
    y = all_rows[nom] * 64
    chars.paste((0, 0, 0, 0), (0, y, 768, y + 64))
    for d in range(4):
        for k, f in enumerate((1, 0, 3)):
            fr = src.crop((f * fw, d * fh, f * fw + fw, d * fh + fh))
            chars.alpha_composite(cadrer_pose(fr), ((d * 3 + k) * 64, y))
    faits += 1
chars.save(os.path.join(OUT, 'chars.png'))

# zones de la tenue du joueur (Options → apparence) sur les dresseurs de Noir 2 & Blanc 2 (rangées 0 et 1 de la planche) :
# une image 768 × 128 où chaque pixel vaut sa zone (0 rien, 1 visière, 2 haut, 3 bas, 4 chaussures, 5 sac / bandoulière),
# lue par render/tenue.js (setMasques) à la place de la détection automatique faite pour le dresseur de base
import colorsys


def _zone_tenue(genre, y, h, s, v):
    if genre == 'm':   # Ludvic : visière rouge, veste bleue, bandoulière blanche, short gris, baskets rouges
        rouge = (h < 0.085 or h > 0.95) and s >= 0.5
        if rouge and v >= 0.4 and y < 44: return 1
        if rouge and v >= 0.3 and y >= 53: return 4
        if s < 0.22 and v > 0.74 and 38 <= y <= 56: return 5
        if 0.55 <= h <= 0.72 and s >= 0.3 and v >= 0.2 and 38 <= y <= 56: return 2
        if s <= 0.16 and 0.5 <= v <= 0.74 and 46 <= y <= 60: return 3
        return 0
    # Ludvina : visière blanche et rose, haut blanc, short jaune, sac rose, bottines lilas
    rose = (h >= 0.88 or h < 0.015) and s >= 0.25
    clair = s < 0.2 and v > 0.7
    if 16 <= y < 37 and ((rose and v >= 0.4) or clair or (0.45 <= h <= 0.62 and s < 0.25 and v > 0.7)): return 1
    if rose and s >= 0.35 and v >= 0.35 and 37 <= y <= 57: return 5
    if 0.09 <= h <= 0.18 and s >= 0.35 and v >= 0.6 and y >= 44: return 3
    if clair and 37 <= y <= 54: return 2
    if 0.58 <= h <= 0.78 and 0.12 <= s <= 0.45 and v >= 0.5 and y >= 53: return 4
    return 0


tenue = Image.new('L', (chars.width, 128), 0); tq = tenue.load(); cp = chars.load()
for g, row in (('m', 0), ('f', 1)):
    for yy in range(64):
        for xx in range(chars.width):
            r, gg, b, a = cp[xx, row * 64 + yy]
            if a < 128: continue
            h, sat, val = colorsys.rgb_to_hsv(r / 255, gg / 255, b / 255)
            tq[xx, row * 64 + yy] = _zone_tenue(g, yy, h, sat, val)
tenue.save(os.path.join(OUT, 'tenue.png'))

from noirblanc_masterpiece import appliquer_masterpiece
appliquer_masterpiece(ROOT, OUT, COLS, noms, D, bat_dims)
from noirblanc_extras import ajouter_batiments_sup
ajouter_batiments_sup(OUT, BW, bat_imgs, bat_dims)
from noirblanc_critiques import appliquer_critiques
appliquer_critiques(ROOT, OUT, COLS, noms, D, bat_imgs, bat_dims)

# Variantes PNJ dédoublonnées : aucun Champion / Conseil 4 (Basalte, Frimas, Margot, Aurèle, Morgane, Ferdinand, Corbin)
# ni doublon exact de classe ne se retrouve parmi les passants génériques.
NB_CHAR_VARIANTS = {
    'habitant': ['habitant', 'nb_cheren', 'nb_voyageur_n', 'nb_fermier', 'nb_boulanger', 'nb_clerk', 'nb_sportif', 'nb_musicien', 'nb_majordome'],
    'habitante': ['habitante', 'nb_citadine', 'nb_servante', 'nb_tablier', 'nb_rockeuse', 'nb_demoiselle', 'nb_violette'],
    'gamin': ['gamin', 'nb_tate'],
    'fillette': ['fillette'],
    'vieil_homme': ['vieil_homme', 'nb_sage'],
    'dame': ['dame', 'nb_grandmere', 'nb_citadine'],
    'topdresseur': ['topdresseur', 'nb_ranger', 'nb_voyageur_n', 'nb_sportif'],
    'topdresseuse': ['topdresseuse', 'nb_cowgirl', 'nb_rockeuse'],
    'montagnard': ['montagnard', 'nb_cowboy', 'nb_linebacker'],
    'randonneuse': ['randonneuse', 'nb_cowgirl', 'nb_vet'],
    'scientifique': ['scientifique', 'nb_vet', 'nb_clerk'],
    'jardinier': ['jardinier', 'nb_fermier'],
    'garde': ['garde', 'nb_policier', 'nb_agent'],
    'vendeur': ['vendeur', 'nb_clerk', 'nb_boulanger'],
    'marin': ['marin', 'nb_amiral'],
    'karateka': ['karateka', 'nb_linebacker'],
    'voleur': ['voleur', 'nb_agent'],
}

# ------------------------------------------------------------------ liste pour le jeu
js = ("// odyssee/js/data/gfx-noirblanc.js — écrit par tools/odyssee-pack-noirblanc.py (ne pas modifier à la main)\n"
      f"export const NB_TUILES = {json.dumps(noms)};\nexport const NB_COLS = {COLS};\n"
      f"export const NB_DECOR = {json.dumps(sorted(D))};\n"
      "// bâtiments : nom → [largeur réelle en px, colonne du milieu de la porte (ou null)]\n"
      f"export const NB_BATIMENTS = {json.dumps(bat_dims)};\n"
      f"export const NB_CHAR_ROWS = {json.dumps(nb_char_rows)};\n"
      f"export const NB_CHAR_VARIANTS = {json.dumps(NB_CHAR_VARIANTS)};\n")
open(os.path.join(ROOT, 'odyssee', 'js', 'data', 'gfx-noirblanc.js'), 'w', encoding='utf-8').write(js)
print(len(noms), 'tuiles,', len(D), 'décors,', len(bat_dims), 'bâtiments,', faits, 'personnages →', os.path.normpath(OUT))
