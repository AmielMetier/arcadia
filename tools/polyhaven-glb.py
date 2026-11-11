#!/usr/bin/env python3
"""Télécharge un modèle Poly Haven (CC0) et le range en .glb compact pour The Backrooms : la géométrie d'origine
(glTF 1k), la seule texture de couleur (réduite à 512 px : JPEG, ou PNG si elle a de la transparence : feuilles,
grillages). Les cartes de relief, de rugosité et d'occlusion sont laissées : les matières du jeu sont cuites par la
lumière de l'étage. Passer ensuite tools/pack-glb.mjs pour serrer les sommets.

Usage : python3 tools/polyhaven-glb.py <id Poly Haven> [dossier de sortie] [taille]
        (sortie : backrooms/models/<id>.glb ; taille : 512 par défaut)
Prérequis : Pillow."""
import io, json, struct, sys, urllib.request, os
from PIL import Image

UA = {'User-Agent': 'arcadia-backrooms-asset-tool'}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
        return r.read()


aid = sys.argv[1]
out_dir = sys.argv[2] if len(sys.argv) > 2 else 'backrooms/models'
size = int(sys.argv[3]) if len(sys.argv) > 3 else 512
files = json.loads(get('https://api.polyhaven.com/files/' + aid))
g1 = files['gltf']['1k']['gltf']
gltf = json.loads(get(g1['url']))
inc = g1.get('include', {})

# le tampon binaire (un seul, chez Poly Haven)
assert len(gltf['buffers']) == 1, 'plusieurs tampons'
binary = bytearray(get(inc[gltf['buffers'][0]['uri']]['url']))

# les textures de couleur seulement
keep_tex = set()
for m in gltf.get('materials', []):
    pbr = m.get('pbrMetallicRoughness', {})
    if 'baseColorTexture' in pbr:
        keep_tex.add(pbr['baseColorTexture']['index'])
    for k in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
        m.pop(k, None)
    pbr.pop('metallicRoughnessTexture', None)
    m.pop('extensions', None)

old_tex = gltf.get('textures', [])
old_img = gltf.get('images', [])
new_tex, new_img, tex_map, img_map = [], [], {}, {}
views = gltf['bufferViews']


def pad4(b):
    while len(b) % 4:
        b.append(0)


for ti in sorted(keep_tex):
    t = old_tex[ti]
    ii = t['source']
    if ii not in img_map:
        uri = old_img[ii]['uri']
        im = Image.open(io.BytesIO(get(inc[uri]['url'])))
        alpha = im.mode in ('RGBA', 'LA') and im.getchannel('A').getextrema()[0] < 250
        im = im.convert('RGBA' if alpha else 'RGB')
        if max(im.size) > size:
            k = size / max(im.size)
            im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
        buf = io.BytesIO()
        if alpha:
            im.save(buf, 'PNG', optimize=True)
            mime = 'image/png'
        else:
            im.save(buf, 'JPEG', quality=85, optimize=True)
            mime = 'image/jpeg'
        pad4(binary)
        views.append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(buf.getvalue())})
        binary += buf.getvalue()
        img_map[ii] = len(new_img)
        new_img.append({'bufferView': len(views) - 1, 'mimeType': mime})
    tex_map[ti] = len(new_tex)
    nt = {'source': img_map[ii]}
    if 'sampler' in t:
        nt['sampler'] = t['sampler']
    new_tex.append(nt)

for m in gltf.get('materials', []):
    pbr = m.get('pbrMetallicRoughness', {})
    if 'baseColorTexture' in pbr:
        pbr['baseColorTexture'] = {'index': tex_map[pbr['baseColorTexture']['index']]}
gltf['textures'] = new_tex
gltf['images'] = new_img
if not new_tex:
    gltf.pop('textures')
    gltf.pop('images')
    gltf.pop('samplers', None)
for k in ('extensionsUsed', 'extensionsRequired'):
    gltf.pop(k, None)
pad4(binary)
gltf['buffers'] = [{'byteLength': len(binary)}]

js = json.dumps(gltf, separators=(',', ':')).encode('utf8')
while len(js) % 4:
    js += b' '
total = 12 + 8 + len(js) + 8 + len(binary)
os.makedirs(out_dir, exist_ok=True)
path = os.path.join(out_dir, aid + '.glb')
with open(path, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, total))
    f.write(struct.pack('<I4s', len(js), b'JSON') + js)
    f.write(struct.pack('<I4s', len(binary), b'BIN\0') + bytes(binary))
roots = [gltf['nodes'][n].get('name', '?') for n in gltf['scenes'][gltf.get('scene', 0)]['nodes']]
print(path, total // 1024, 'ko', 'racines :', ', '.join(roots))
