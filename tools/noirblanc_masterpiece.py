"""
Extension « chef-d'œuvre » du pack Noir & Blanc pour Arcadia Odyssée :
- Améliore sol.png (passages piétons continus asph_x, planches de pont chêne BW2,
  rivages volcaniques q_lava_* animés, rivages de plage/oasis q_swater_* animés)
- Nettoie les bases de tous les arbres d'éventuels pixels isolés au pied du tronc
- Déballe assets/graphics/noirblanc/ext_masterpiece.png (mobilier intérieur Gen 5,
  décors tardifs, bâtiments thématiques désert / neige / gothique / usines / tours)
  et met à jour NB_DECOR / NB_BATIMENTS / sol.png avant l'écriture de gfx-noirblanc.js.
"""
import json
import math
import os
from PIL import Image


def _snow_centre(im):
    """Couvre généreusement le dôme et les pans du toit rouge du Centre Pokémon de congères bleu-glace B2W2."""
    im = im.convert('RGBA').copy()
    px = im.load()
    w, h = im.size
    top_ys = [next((y for y in range(h) if px[x, y][3] > 200), None) for x in range(w)]
    for x in range(w):
        ty = top_ys[x]
        if ty is None or ty > 125:
            continue
        wave = round(3.0 * math.sin(x * 0.22) + 2.0 * math.cos(x * 0.47))
        depth = (24 if ty < 40 else 15) + wave
        for dy in range(depth):
            y = ty + dy
            if y >= h:
                break
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            est_bord = dy == 0 or (y < 60 and r < 80 and g < 80 and b < 90)
            est_toit_rouge = (r > 130 and r > g * 1.3 and r > b * 1.7) or (r > 180 and g > 190 and b > 200)
            if not (est_bord or est_toit_rouge):
                continue
            if dy == 0:
                px[x, y] = (54, 64, 88, a)
            elif dy == depth - 1:
                px[x, y] = (146, 174, 210, a)
            elif dy >= depth - 3:
                px[x, y] = (196, 218, 240, a)
            elif dy == 1:
                px[x, y] = (246, 250, 255, a)
            else:
                px[x, y] = (228, 240, 252, a)
    # Liseré de neige sur l'auvent d'entrée (y ~ 168..184, centre x ~ 64..136)
    for x in range(64, min(w, 136)):
        for y in range(166, min(h, 184)):
            r, g, b, a = px[x, y]
            if a > 128 and r > 140 and r > g * 1.3 and r > b * 1.8:
                px[x, y] = (232, 242, 252, a) if y < 176 else (188, 212, 236, a)
                if y + 1 < h and px[x, y + 1][0] > 140:
                    px[x, y + 1] = (152, 180, 214, a)
                break
    return im


def _make_snow_variant(im):
    im = im.convert('RGBA').copy()
    px = im.load()
    w, h = im.size
    top_ys = []
    for x in range(w):
        ty = None
        for y in range(h):
            if px[x, y][3] > 200:
                ty = y
                break
        top_ys.append(ty)
    roof_limit = min(h - 46, max(44, int(h * 0.34)))
    for x in range(w):
        top_y = top_ys[x]
        if top_y is None or top_y >= roof_limit:
            continue
        t_l = top_ys[max(0, x - 2)]
        t_r = top_ys[min(w - 1, x + 2)]
        if t_l is None or t_r is None or abs(t_r - t_l) > 2:
            continue
        if x < 6 or x > w - 7:
            continue
        depth = 4 + ((x * 7 + (x >> 2)) % 2)
        for dy in range(depth):
            y = top_y + dy
            if y >= roof_limit:
                break
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if dy == 0:
                px[x, y] = (54, 62, 82, a)
            elif dy == depth - 1:
                px[x, y] = (164, 188, 218, a)
            elif dy == depth - 2:
                px[x, y] = (208, 224, 242, a)
            else:
                px[x, y] = (232, 242, 252, a)
    return im


def _clean_tree_base(im):
    im = im.convert('RGBA').copy()
    w, h = im.size
    px = im.load()
    cx = w // 2
    for y in range(max(0, h - 10), h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if x < cx - 6 or x > cx + 6:
                px[x, y] = (0, 0, 0, 0)
            elif y >= h - 4 and (g > r + 4 or (y >= h - 2 and abs(x - cx) > 3)):
                px[x, y] = (0, 0, 0, 0)
    return im


def _make_lava_quarters(rock, lava_frame):
    """Construit les 5 quarts (0, v, h, f, i) 16x16 de rive basaltique autour d'une frame de lave."""
    rk = rock.convert('RGBA').load()
    lf = lava_frame.convert('RGBA')
    edge = (54, 42, 34, 255)
    edge_hi = (104, 82, 66, 255)

    def rim_mask(t, b, l, r):
        res = lf.copy()
        rp = res.load()
        for y in range(16):
            for x in range(16):
                dt = y if t else 99
                db = 15 - y if b else 99
                dl = x if l else 99
                dr = 15 - x if r else 99
                md = min(dt, db, dl, dr)
                if md <= 1:
                    rp[x, y] = rk[x, y]
                elif md == 2:
                    rp[x, y] = edge_hi if t else edge
                elif md == 3:
                    rp[x, y] = edge
        return res

    q_0 = rim_mask(True, True, True, True)
    # quarts() attend 'v' = rive verticale (G & D), 'h' = rive horizontale (H & B)
    q_v = rim_mask(False, False, True, True)
    q_h = rim_mask(True, True, False, False)
    q_f = lf.copy()
    q_i = lf.copy()
    qp = q_i.load()
    for qx in (0, 8):
        for qy in (0, 8):
            for dy in range(4):
                for dx in range(4):
                    if dx + dy > 4:
                        continue
                    x = dx if qx == 0 else 15 - dx
                    y = dy if qy == 0 else 15 - dy
                    if dx + dy <= 1:
                        qp[x, y] = rk[x, y]
                    elif dx + dy == 2:
                        qp[x, y] = edge_hi
                    else:
                        qp[x, y] = edge
    return {'0': q_0, 'v': q_v, 'h': q_h, 'f': q_f, 'i': q_i}


def _make_swater_quarters(water_frame):
    """Construit les 5 quarts 16x16 d'eau animée bordée de sable doré arrondi & écume BW2."""
    wf = water_frame.convert('RGBA')
    sand_col = (238, 220, 176, 255)
    sand_wet = (212, 190, 144, 255)
    foam = (216, 240, 252, 255)
    shal = (98, 168, 224, 255)

    def sw_mask(t, b, l, r):
        res = wf.copy()
        rp = res.load()
        for y in range(16):
            for x in range(16):
                dt = y if t else 99
                db = 15 - y if b else 99
                dl = x if l else 99
                dr = 15 - x if r else 99
                md = min(dt, db, dl, dr)
                if md == 0:
                    rp[x, y] = sand_col
                elif md == 1:
                    rp[x, y] = sand_wet
                elif md == 2:
                    rp[x, y] = foam
                elif md == 3:
                    rp[x, y] = shal
        if t and l:
            rp[2, 2] = sand_wet
        if t and r:
            rp[13, 2] = sand_wet
        if b and l:
            rp[2, 13] = sand_wet
        if b and r:
            rp[13, 13] = sand_wet
        return res

    q_0 = sw_mask(True, True, True, True)
    # quarts() attend 'v' = rive verticale (G & D), 'h' = rive horizontale (H & B)
    q_v = sw_mask(False, False, True, True)
    q_h = sw_mask(True, True, False, False)
    q_f = wf.copy()
    q_i = wf.copy()
    ip = q_i.load()
    for qx in (0, 8):
        for qy in (0, 8):
            for dy in range(4):
                for dx in range(4):
                    s = dx + dy
                    if s > 3:
                        continue
                    x = dx if qx == 0 else 15 - dx
                    y = dy if qy == 0 else 15 - dy
                    ip[x, y] = sand_col if s <= 1 else (sand_wet if s == 2 else (foam if s == 3 else shal))
    return {'0': q_0, 'v': q_v, 'h': q_h, 'f': q_f, 'i': q_i}


def _make_bridge_plank(ns=True):
    """Planches chêne BW2 sans rambarde intégrée (les garde-corps externes sont posés à part)."""
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    px = im.load()
    pal = [(178, 136, 88, 255), (164, 124, 78, 255), (192, 150, 102, 255), (134, 98, 60, 255)]
    for y in range(16):
        for x in range(16):
            a = y if ns else x
            b = x if ns else y
            seam = (a % 4 == 0)
            if seam:
                px[x, y] = pal[3]
            elif a % 4 == 1:
                px[x, y] = pal[2]
            else:
                px[x, y] = pal[((a // 4) + ((b + a) % 5 == 0)) % 2]
    return im


def appliquer_masterpiece(root, out_dir, cols, noms, decos, bat_dims):
    nb_dir = os.path.join(root, 'assets', 'graphics', 'noirblanc')
    sol_path = os.path.join(out_dir, 'sol.png')
    sol = Image.open(sol_path).convert('RGBA')
    idx_of = {n: i for i, n in enumerate(noms)}

    def get_cell(name):
        i = idx_of[name]
        return sol.crop(((i % cols) * 16, (i // cols) * 16, (i % cols) * 16 + 16, (i // cols) * 16 + 16))

    extra_tiles = {}
    # 1. asph_x continu de haut en bas (bandes blanches jointives entre dalles adjacentes)
    if 'asph' in idx_of and 'asph_x' in idx_of:
        ax = get_cell('asph').copy()
        ap = ax.load()
        for bx in (2, 6, 10, 14):
            for y in range(16):
                ap[bx, y] = (232, 232, 238, 255)
                ap[bx + 1, y] = (198, 198, 210, 255) if y % 4 == 0 else (212, 212, 222, 255)
        extra_tiles['asph_x'] = ax

    # 2. Tablier bois chêne chaud pour ponts
    if 'bridgeNS' in idx_of:
        extra_tiles['bridgeNS'] = _make_bridge_plank(True)
    if 'bridgeEW' in idx_of:
        extra_tiles['bridgeEW'] = _make_bridge_plank(False)

    # 3. Quarts de lave volcanique (q_lava_{0,v,h,f,i}_f0..f1)
    if 'lava0' in idx_of and 'ash0' in idx_of:
        rock = get_cell('ash0')
        lframes = [get_cell('lava0'), get_cell('lava1') if 'lava1' in idx_of else get_cell('lava0')]
        for f, lf in enumerate(lframes):
            for st, tile in _make_lava_quarters(rock, lf).items():
                extra_tiles[f'q_lava_{st}_f{f}'] = tile

    # 4. Quarts d'eau sur sable de plage/oasis (q_swater_{0,v,h,f,i}_f0..f3)
    if 'q_water_f_f0' in idx_of:
        for f in range(4):
            wf = get_cell(f'q_water_f_f{f}')
            for st, tile in _make_swater_quarters(wf).items():
                extra_tiles[f'q_swater_{st}_f{f}'] = tile

    # Mise à jour + extension de sol.png (noms gardant l'ordre canonique)
    for k in sorted(extra_tiles):
        if k not in idx_of:
            idx_of[k] = len(noms)
            noms.append(k)
    need_rows = math.ceil(len(noms) / cols)
    new_sol = Image.new('RGBA', (cols * 16, need_rows * 16), (0, 0, 0, 0))
    new_sol.paste(sol, (0, 0))
    for k, tile in extra_tiles.items():
        i = idx_of[k]
        new_sol.paste(tile, ((i % cols) * 16, (i // cols) * 16))
    new_sol.save(sol_path)

    # 5. Nettoyage strict des 10 lignes basses de tous les arbres
    for tn in ['tree', 'tree2', 'tree3', 'pine', 'snowpine', 'deadtree',
               'cerisier', 'erable', 'arbre_automne',
               'automne0', 'automne1', 'automne2', 'automne3', 'automne4', 'automne5']:
        p = os.path.join(out_dir, f'd_{tn}.png')
        if os.path.exists(p):
            _clean_tree_base(Image.open(p)).save(p)

    # 6. Variante boutique enneigée assortie à b_boutique_b (door 75 pour emprises 4x4)
    bout_b_path = os.path.join(out_dir, 'b_boutique_b.png')
    if os.path.exists(bout_b_path):
        sb = _make_snow_variant(Image.open(bout_b_path))
        sb.save(os.path.join(out_dir, 'b_boutique_neige_b.png'))
        bat_dims['boutique_neige_b'] = [sb.width, 75]

    # 7. Extraction depuis ext_masterpiece.png + ext_masterpiece.json
    ext_png = os.path.join(nb_dir, 'ext_masterpiece.png')
    ext_json = os.path.join(nb_dir, 'ext_masterpiece.json')
    if not (os.path.exists(ext_png) and os.path.exists(ext_json)):
        return
    atlas = Image.open(ext_png).convert('RGBA')
    coords = json.load(open(ext_json, encoding='utf-8'))['sprites']

    door_overrides = {
        'boutique_desert': 116, 'boutique_neige': 116,
        'centre_desert': 109, 'centre_neige': 100, 'centre_mirage': 99,
        'maison_desert_1': 67, 'maison_desert_2': 56, 'maison_desert_3': 83, 'maison_desert_4': 67,
        'maison_neige_bl': 48, 'maison_neige_rg': 48, 'maison_neige_b': 99, 'manoir_neige': 92,
        'maison_hiver': 77, 'manoir_ombre': 92, 'maison_ombre': 94, 'maison_ombre_2': 48, 'chapelle': 72,
        'maison_mirage_1': 54, 'maison_mirage_2': 62,
        'maison_forge_1': 88, 'maison_forge_2': 88,
        'fonderie': 88, 'fonderie_b': 88, 'atelier_brique': 105,
        'gare': 128, 'mairie': 125, 'bourse': 179, 'casino': 208,
        'centrale': 64, 'serre': None,
        'tour_brique': None, 'tour_jaune': None, 'tour_vitre': None,
    }

    for k, box in coords.items():
        x, y, w, h = box
        sub = atlas.crop((x, y, x + w, y + h))
        if k.startswith('d_'):
            name = k[2:]
            if name in ('vase', 'squelette'):
                continue
            sub.save(os.path.join(out_dir, f'{k}.png'))
            decos[name] = sub
        elif k.startswith('b_'):
            name = k[2:]
            if name == 'centre_neige':
                sub = _snow_centre(sub)
            sub.save(os.path.join(out_dir, f'{k}.png'))
            door_col = door_overrides[name] if name in door_overrides else (w // 2)
            bat_dims[name] = [w, door_col]

    dojo_path = os.path.join(out_dir, 'b_dojo.png')
    if os.path.exists(dojo_path):
        bat_dims['dojo'] = [192, 96]
