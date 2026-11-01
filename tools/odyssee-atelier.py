#!/usr/bin/env python3
# Odyssée — atelier graphique : remet les dessins aux règles de docs/ODYSSEE-GRAPHISME.md (odyssee/js/data/regles.js).
#
#   python3 tools/odyssee-atelier.py kits        kits de façade du tileset → odyssee/img/facades/ (4 × 4 cellules de 16 px)
#   python3 tools/odyssee-atelier.py deco        objets du tileset → odyssee/img/deco/ (largeur fixée par REGLES.deco)
#   python3 tools/odyssee-atelier.py palette     palette commune → odyssee/atelier/palette.png (+ palette.json)
#   python3 tools/odyssee-atelier.py rapport     contrôle de toutes les images → odyssee/atelier/rapport.json
#   python3 tools/odyssee-atelier.py normaliser <image> (--tuile | --deco <nom> | --kit <nom>) [--sortie <fichier>] [--palette]
#
# Sans argument : kits, deco, palette, rapport.
# Prérequis : pip install pillow numpy scipy scikit-learn
import os, sys, json, importlib.util
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ODY = os.path.join(ROOT, 'odyssee')
IMG = os.path.join(ODY, 'img')
ATELIER = os.path.join(ODY, 'atelier')

def load_js_json(path, start):
    """objet JSON d'un module JS (« export const X = {…}; ») : du premier « { » après start à l'accolade qui le ferme"""
    txt = open(path, encoding='utf-8').read(); i = txt.index('{', txt.index(start)); depth = 0
    for j in range(i, len(txt)):
        c = txt[j]
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if not depth: return json.loads(txt[i:j + 1])
    raise ValueError('JSON non fermé dans ' + path)

REGLES = load_js_json(os.path.join(ODY, 'js', 'data', 'regles.js'), 'REGLES')
D = REGLES['densite']            # pixels d'art par case
SPRITES_JS = os.path.join(ODY, 'js', 'data', 'sprites.js')

def tileset_module():
    """tools/odyssee-tileset.py (boîtes des kits, points des objets, découpe du tileset)"""
    spec = importlib.util.spec_from_file_location('tileset', os.path.join(ROOT, 'tools', 'odyssee-tileset.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

def sprites_module():
    spec = importlib.util.spec_from_file_location('spr', os.path.join(ROOT, 'tools', 'odyssee-sprites.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

# ------------------------------------------------------------------ outils d'image

def rgba(img): return np.array(img.convert('RGBA'))

def is_bg(a):
    """fond à retirer : transparent, magenta ou violet du tileset (liserés compris)"""
    r, g, b, al = (a[..., i].astype(int) for i in range(4))
    magenta = (r > 150) & (b > 150) & (g < 120)
    liseré = (g < np.minimum(r, b) - 8) & (r > 60) & (b > 40)
    rose = (r > 170) & (b > 120) & (g < np.minimum(r, b) - 30)
    return (al < 128) | magenta | liseré | rose

def fill_transparent(a):
    """les pixels transparents prennent la couleur du pixel opaque le plus proche (pas de bord sombre en réduisant)"""
    a = a.copy(); op = a[..., 3] > 0
    if op.all() or not op.any(): return a
    _, (iy, ix) = ndimage.distance_transform_edt(~op, return_indices=True)
    a[..., :3][~op] = a[..., :3][iy[~op], ix[~op]]
    return a

def shrink(img, w, h):
    """réduction d'un dessin (souvent un faux pixel art lissé) à sa taille du jeu : couleurs par Lanczos sur un dessin
    dont le fond a été comblé, alpha par moyenne puis seuil (tout ou rien)"""
    a = rgba(img); al = Image.fromarray(a[..., 3])
    rgb = Image.fromarray(fill_transparent(a)[..., :3]).resize((w, h), Image.LANCZOS)
    alpha = np.array(al.resize((w, h), Image.BOX)) > 127
    out = np.dstack([np.array(rgb), np.where(alpha, 255, 0).astype(np.uint8)])
    return Image.fromarray(out)

def crop_opaque(img):
    a = rgba(img); ys, xs = np.nonzero(a[..., 3] > 0)
    if not len(ys): return img
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

def clean(img, strict=False):
    """fond retiré, alpha tout ou rien ; strict : seulement le transparent et le magenta pur (garde les roses et
    les violets d'un dessin, comme les fleurs du cerisier)"""
    a = rgba(img)
    if strict:
        r, g, b = (a[..., i].astype(int) for i in range(3))
        a[(a[..., 3] < 128) | ((r > 180) & (b > 180) & (g < 110)), 3] = 0
    else: a[is_bg(a), 3] = 0
    a[a[..., 3] > 0, 3] = 255; return Image.fromarray(a)

def palette_colors():
    p = os.path.join(ATELIER, 'palette.json')
    return np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in json.load(open(p))['couleurs']]) if os.path.exists(p) else None

def snap_palette(img, pal):
    """chaque pixel prend la couleur la plus proche de la palette commune"""
    a = rgba(img); op = a[..., 3] > 0; px = a[..., :3][op].astype(int)
    w = np.array([0.30, 0.59, 0.11]) * 3
    d = (((px[:, None, :] - pal[None, :, :]) ** 2) * w).sum(2)
    a[..., :3][op] = pal[d.argmin(1)]
    return Image.fromarray(a)

def limit_colors(img, n):
    """au plus n couleurs (k-moyennes sur les pixels opaques), sans tramage"""
    a = rgba(img); op = a[..., 3] > 0; px = a[..., :3][op].reshape(-1, 3)
    u = np.unique(px, axis=0)
    if len(u) <= n: return img
    from sklearn.cluster import KMeans
    km = KMeans(n_clusters=n, n_init=2, random_state=1).fit(px.astype(float))
    a[..., :3][op] = np.clip(np.round(km.cluster_centers_[km.labels_]), 0, 255).astype(np.uint8)
    return Image.fromarray(a)

def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True); img.save(path, optimize=True)

def update_meta(**entries):
    txt = open(SPRITES_JS, encoding='utf-8').read(); meta = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    meta.update(entries)
    with open(SPRITES_JS, 'w', encoding='utf-8') as f:
        f.write('// Généré par tools/odyssee-sprites.py — ne pas modifier à la main.\n')
        f.write('export const SPRITES = ' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';\n')

# ------------------------------------------------------------------ kits de façade

def runs(v, th=0.6):
    out, i = [], 0
    while i < len(v):
        if v[i] >= th:
            j = i
            while j < len(v) and v[j] >= th: j += 1
            out.append((i, j)); i = j
        else: i += 1
    return out

def grid_bounds(sep, n=4):
    """bornes des n cellules le long d'un axe : entre les lignes de séparation (vides, traits magenta ou fond), si on
    en trouve n de largeur régulière ; sinon None"""
    r = runs(sep); L = len(sep); exp = L / n
    gaps = [(a[1], b[0]) for a, b in zip([(0, 0)] + r, r + [(L, L)]) if b[0] - a[1] >= 0.6 * exp]
    if len(gaps) == n and max(g[1] - g[0] for g in gaps) <= 1.35 * min(g[1] - g[0] for g in gaps): return gaps
    return None

# kits dont les cellules ne sont pas alignées sur une grille : boîtes données à la main (dans la boîte du kit)
KIT_BOXES = {
    'chalet': [[(33, 19, 70, 59), (75, 19, 111, 59), (118, 19, 155, 59), (160, 19, 199, 59)],
               [(0, 62, 43, 110), (52, 62, 95, 110), (102, 62, 149, 110), (160, 62, 197, 101)],
               [(0, 112, 45, 162), (49, 112, 97, 162), (101, 112, 149, 162), (153, 112, 201, 162)],
               [(0, 167, 43, 214), (51, 167, 94, 214), (100, 167, 150, 213), (160, 167, 192, 210)]],
}

KIT_BG = {'pagode': [(138, 185, 122), (120, 156, 102)]}

def kit_cells(a, name=None):
    """les 16 cellules d'un kit (boîtes dans a) : lignes de séparation si elles existent, sinon la boîte opaque en 4 × 4.
    Renvoie les boîtes [ligne][colonne], le masque du fond et la taille commune d'une cellule."""
    bg = is_bg(a)
    r, g, b = (a[..., i].astype(int) for i in range(3))
    maroon = (abs(r - 0x5a) < 22) & (abs(g - 0x2a) < 22) & (abs(b - 0x3a) < 26)
    # le fond bordeaux de certaines planches : seulement si le kit est posé dessus (sinon c'est du bois sombre)
    edge = np.concatenate([maroon[:3].ravel(), maroon[-3:].ravel(), maroon[:, :3].ravel(), maroon[:, -3:].ravel()])
    sep = bg | maroon if edge.mean() > 0.3 else bg
    # fond coloré propre à une planche (vert pâle derrière les portes de la pagode)
    for col in KIT_BG.get(name, []):
        sep = sep | ((np.abs(a[..., :3].astype(int) - np.array(col)).max(2) < 18))
    if name in KIT_BOXES:
        boxes = KIT_BOXES[name]
        return boxes, sep, 48
    cols, rows = grid_bounds(sep.mean(0)), grid_bounds(sep.mean(1))
    if not cols or not rows:
        ys, xs = np.nonzero(~sep); X0, X1, Y0, Y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        cw, ch = (X1 - X0) / 4, (Y1 - Y0) / 4
        cols = cols or [(int(round(X0 + i * cw)), int(round(X0 + (i + 1) * cw))) for i in range(4)]
        rows = rows or [(int(round(Y0 + j * ch)), int(round(Y0 + (j + 1) * ch))) for j in range(4)]
    size = np.mean([c[1] - c[0] for c in cols] + [r[1] - r[0] for r in rows])
    return [[(x0, y0, x1, y1) for (x0, x1) in cols] for (y0, y1) in rows], sep, size

def kit_from(a, colors=None, name=None):
    """un kit (tableau RGBA du dessin d'origine) → image 64 × 64 : 16 cellules de 16 px"""
    boxes, sep, size = kit_cells(a, name)
    out = Image.new('RGBA', (4 * D, 4 * D))
    for j, row in enumerate(boxes):
        for i, (x0, y0, x1, y1) in enumerate(row):
            c = a[y0:y1, x0:x1].copy(); op = ~sep[y0:y1, x0:x1]
            if op.sum() < 0.04 * op.size: continue
            c[..., 3] = np.where(op, 255, 0)
            if op.mean() > 0.82:
                # cellule de mur : pleine, les trous (traits de grille) comblés
                c = fill_transparent(c); c[..., 3] = 255
                t = shrink(Image.fromarray(c), D, D)
                t = Image.fromarray(np.dstack([np.array(t)[..., :3], np.full((D, D), 255, np.uint8)]))
            else:
                # objet détouré (enseigne, lampe, jardinière) : même échelle que les murs, posé en bas, centré
                lab, n = ndimage.label(op)
                if n > 1:
                    sz = ndimage.sum(op, lab, range(1, n + 1)); op = np.isin(lab, [k + 1 for k in range(n) if sz[k] >= 0.12 * sz.max()])
                    c[..., 3] = np.where(op, 255, 0)
                obj = crop_opaque(Image.fromarray(c)); sc = D / size
                w, h = max(1, min(D, round(obj.width * sc))), max(1, min(D, round(obj.height * sc)))
                small = shrink(obj, w, h); t = Image.new('RGBA', (D, D)); t.alpha_composite(small, ((D - w) // 2, D - h))
            out.alpha_composite(t, (i * D, j * D))
    if colors: out = limit_colors(out, colors)
    return out

def do_kits():
    TS = tileset_module()
    names = []
    for name, (x0, y0, x1, y1) in TS.KITS.items():
        a = TS.A[y0:y1, x0:x1].copy()
        kit = kit_from(a, REGLES['palette']['max_par_objet'], name)
        save(kit, os.path.join(IMG, 'facades', name + '.png')); names.append(name)
    print('kits :', len(names), 'en', 4 * D, '×', 4 * D)

# ------------------------------------------------------------------ objets du décor

def deco_image(img, name):
    """objet détouré → largeur de REGLES.deco (en cases × 16 px), ancré en bas"""
    r = REGLES['deco'].get(name, {}); img = crop_opaque(clean(img, strict=True))
    w = max(2, round(r.get('largeur', img.width / D) * D)); h = max(2, round(img.height * w / img.width))
    return crop_opaque(shrink(img, w, h))

DECO_SEPARES = {'borne', 'bouee', 'caisse', 'tonneau'}

def do_deco():
    TS = tileset_module()
    lab2, _ = ndimage.label(ndimage.binary_closing(TS.OPAQUE, iterations=2)); objs2 = ndimage.find_objects(lab2)
    lab0, _ = ndimage.label(TS.OPAQUE); objs0 = ndimage.find_objects(lab0)
    meta = {}
    for k, (x, y) in TS.DECO.items():
        # objets serrés sur la planche : sans « fermeture » (sinon ils se collent à leur voisin)
        lab, objs = (lab0, objs0) if k in DECO_SEPARES else (lab2, objs2)
        best = None
        for r in range(0, 9):
            ys, xs = np.nonzero(lab[y - r:y + r + 1, x - r:x + r + 1])
            if len(ys): best = lab[y - r + ys[0], x - r + xs[0]]; break
        if not best: print('objet introuvable :', k); continue
        o = objs[best - 1]
        img = deco_image(TS.IM.crop((o[1].start, o[0].start, o[1].stop, o[0].stop)), k)
        img = limit_colors(img, REGLES['palette']['max_par_objet'])
        save(img, os.path.join(IMG, 'deco', k + '.png')); meta[k] = [img.width, img.height, 1]
    update_meta(deco=meta)
    print('objets :', len(meta))

# ------------------------------------------------------------------ palette commune

def do_palette():
    """64 couleurs représentatives des images du jeu qu'on garde (sols, herbes, arbres, eau et fleurs HGSS, kits)"""
    px = []
    for fam, sub in (('sol32', ''), ('herbes', ''), ('nature', ''), ('hgss', ''), ('facades', ''), ('deco', '')):
        d = os.path.join(IMG, fam)
        for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            if not f.endswith('.png'): continue
            a = rgba(Image.open(os.path.join(d, f))); p = a[..., :3][a[..., 3] > 0]
            if len(p): px.append(p[np.random.default_rng(len(px)).choice(len(p), min(len(p), 1500), replace=False)])
    px = np.concatenate(px).astype(float)
    from sklearn.cluster import KMeans
    n = REGLES['palette']['couleurs']
    km = KMeans(n_clusters=n, n_init=4, random_state=1).fit(px)
    c = np.clip(np.round(km.cluster_centers_), 0, 255).astype(int)
    c = c[np.lexsort((c.sum(1), np.round(np.degrees(np.arctan2(np.sqrt(3) * (c[:, 1] - c[:, 2]), 2 * c[:, 0] - c[:, 1] - c[:, 2])) / 30)))]
    os.makedirs(ATELIER, exist_ok=True)
    sw = Image.new('RGB', (8 * 8, ((n + 7) // 8) * 8))
    for i, col in enumerate(c): sw.paste(tuple(int(v) for v in col), ((i % 8) * 8, (i // 8) * 8, (i % 8) * 8 + 8, (i // 8) * 8 + 8))
    sw.save(os.path.join(ATELIER, 'palette.png'))
    json.dump({'couleurs': ['#%02x%02x%02x' % tuple(v) for v in c]}, open(os.path.join(ATELIER, 'palette.json'), 'w'), indent=0)
    print('palette :', n, 'couleurs')

# ------------------------------------------------------------------ rapport de contrôle

def check(img, fam, name, pal):
    """problèmes d'une image par rapport aux règles (liste de phrases) et mesures"""
    a = rgba(img); H, W = a.shape[:2]; al = a[..., 3]; op = al > 0
    rf = REGLES['familles'].get(fam, {}); pb = []; info = {'w': W, 'h': H}
    semi = int(((al > 0) & (al < 255)).sum())
    if semi: pb.append(f'{semi} pixels à demi transparents')
    if rf.get('taille') and [W, H] != rf['taille'] and not name.endswith(('_front', '_front2')): pb.append(f'taille {W} × {H} au lieu de {rf["taille"][0]} × {rf["taille"][1]}')
    if rf.get('opaque') and not op.all(): pb.append('trous transparents dans une tuile pleine')
    cols = np.unique(a[..., :3][op], axis=0) if op.any() else np.zeros((0, 3))
    info['couleurs'] = int(len(cols))
    if len(cols) > REGLES['palette']['max_par_objet'] and fam not in ('sol', 'herbes', 'nature'):
        pb.append(f'{len(cols)} couleurs (48 au plus)')
    if pal is not None and op.any():
        px = a[..., :3][op].astype(int); w = np.array([0.30, 0.59, 0.11]) * 3
        d = np.sqrt((((px[:, None, :] - pal[None]) ** 2) * w).min(1)) if len(px) < 40000 else np.zeros(1)
        far = float((d > REGLES['palette']['tolerance']).mean()); info['hors_palette'] = round(far, 3)
        if far > REGLES['palette']['hors_palette_max']: pb.append(f'{round(far * 100)} % des pixels loin de la palette')
    # pixels doublés : un dessin agrandi ×2 a presque tous ses blocs 2 × 2 unis
    if W >= 8 and H >= 8:
        b = a[:H // 2 * 2, :W // 2 * 2].reshape(H // 2, 2, W // 2, 2, 4)
        uni = (b == b[:, :1, :, :1]).all(axis=(1, 3, 4)); m = b[:, 0, :, 0, 3] > 0
        if m.any():
            u = float(uni[m].mean()); info['blocs_2x2'] = round(u, 2)
            if u > 0.9: pb.append('pixels doublés (dessin agrandi : densité deux fois trop faible)')
    if fam == 'deco':
        r = REGLES['deco'].get(name)
        if r:
            want = round(r['largeur'] * D)
            if abs(W - want) > 1: pb.append(f'largeur {W} px au lieu de {want} ({r["largeur"]} cases)')
        else: pb.append('absent de REGLES.deco (largeur inconnue)')
        if op.any():
            ys, xs = np.nonzero(op)
            if ys.max() < H - 1: pb.append('ne touche pas le bas de l\'image (ancrage aux pieds)')
            if abs(xs.min() - (W - 1 - xs.max())) > 2: pb.append('pas centré')
    if fam == 'facades' and W == 4 * D:
        # cellules de mur : raccord gauche / droite et haut / bas avec elles-mêmes
        bad = []
        for (i, j) in ((0, 0), (0, 2)):
            c = a[j * D:(j + 1) * D, i * D:(i + 1) * D, :3].astype(int)
            if c.size and np.abs(c[:, 0] - c[:, -1]).mean() > 40: bad.append('gauche/droite')
        if bad: pb.append('mur ou toit qui ne se raccordent pas (' + ', '.join(sorted(set(bad))) + ')')
        if (a[..., 3] > 0).mean() < 0.5: pb.append('kit à moitié vide')
    return pb, info

def do_rapport():
    pal = palette_colors(); rep = {}
    for fam, rf in REGLES['familles'].items():
        d = os.path.join(ODY, rf['dossier']); rep[fam] = {}
        for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            if not f.endswith('.png'): continue
            pb, info = check(Image.open(os.path.join(d, f)), fam, f[:-4], pal)
            rep[fam][f[:-4]] = {'problemes': pb, **info}
    os.makedirs(ATELIER, exist_ok=True)
    json.dump(rep, open(os.path.join(ATELIER, 'rapport.json'), 'w'), ensure_ascii=False, indent=1)
    n = sum(1 for f in rep.values() for v in f.values() if v['problemes'])
    print('rapport :', sum(len(f) for f in rep.values()), 'images,', n, 'avec des problèmes')

# ------------------------------------------------------------------ normaliser un nouveau dessin

def snap_fake(img):
    """faux pixel art (agrandi, lissé) : ramené à sa grille de « gros pixels » si on la trouve"""
    S = sprites_module(); a = rgba(img); fg = a[..., 3] > 0
    if min(img.size) < 48: return img
    p, phx, phy = S.pixel_grid(a[..., :3], fg, lo=1.8, hi=12.0)
    if p < 1.8: return img
    out, _ = S.snap(a[..., :3], fg, (p, phx, phy)); return out

def do_normaliser(args):
    src = args[0]; opt = {args[i]: (args[i + 1] if i + 1 < len(args) and not args[i + 1].startswith('--') else True) for i in range(1, len(args)) if args[i].startswith('--')}
    img = Image.open(src).convert('RGBA'); pal = palette_colors() if opt.get('--palette') else None
    if '--tuile' in opt:
        out = shrink(snap_fake(clean(img)) if img.width > 2 * D else img, D, D)
        out = Image.fromarray(np.dstack([np.array(out)[..., :3], np.full((D, D), 255, np.uint8)]))
        dest = opt.get('--sortie') or os.path.splitext(src)[0] + '_16.png'
    elif '--deco' in opt:
        name = opt['--deco']; out = deco_image(snap_fake(clean(img)), name)
        out = limit_colors(out, REGLES['palette']['max_par_objet'])
        dest = opt.get('--sortie') or os.path.join(IMG, 'deco', name + '.png')
        if dest.startswith(os.path.join(IMG, 'deco')):
            txt = open(SPRITES_JS).read(); meta = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
            dd = meta.get('deco', {}); dd[name] = [out.width, out.height, 1]; update_meta(deco=dd)
    elif '--kit' in opt:
        name = opt['--kit']; out = kit_from(rgba(img), REGLES['palette']['max_par_objet'])
        dest = opt.get('--sortie') or os.path.join(IMG, 'facades', name + '.png')
        if dest.startswith(os.path.join(IMG, 'facades')):
            txt = open(SPRITES_JS).read(); meta = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
            update_meta(facades=sorted(set(meta.get('facades', [])) | {name}))
    else:
        raise SystemExit('préciser --tuile, --deco <nom> ou --kit <nom>')
    if pal is not None: out = snap_palette(out, pal)
    save(out, dest)
    pb, info = check(out, 'deco' if '--deco' in opt else 'facades' if '--kit' in opt else 'sol', opt.get('--deco', ''), palette_colors())
    print(dest, f'{out.width} × {out.height}', '— conforme' if not pb else '— ' + ' ; '.join(pb))

if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'normaliser': do_normaliser(a[1:]); sys.exit()
    want = set(a) or {'kits', 'deco', 'palette', 'rapport'}
    if 'kits' in want: do_kits()
    if 'deco' in want: do_deco()
    if 'palette' in want: do_palette()
    if 'rapport' in want: do_rapport()
