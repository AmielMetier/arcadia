#!/usr/bin/env python3
"""Allège un modèle .glb : réencode ses textures en WebP (1024 px au plus) et déclare EXT_texture_webp.
La géométrie ne change pas. Usage : python3 tools/glb-webp.py modele.glb [qualite]
Prérequis : Pillow."""
import io, json, struct, sys
from PIL import Image

path = sys.argv[1]
quality = int(sys.argv[2]) if len(sys.argv) > 2 else 82
data = open(path, 'rb').read()
magic, version, _ = struct.unpack_from('<4sII', data, 0)
assert magic == b'glTF' and version == 2, 'pas un GLB 2.0'
jlen, jtype = struct.unpack_from('<I4s', data, 12)
assert jtype == b'JSON'
gltf = json.loads(data[20:20 + jlen])
blen, btype = struct.unpack_from('<I4s', data, 20 + jlen)
assert btype == b'BIN\0'
binary = data[28 + jlen:28 + jlen + blen]

images = gltf.get('images', [])
views = gltf['bufferViews']
image_views = {img['bufferView'] for img in images if 'bufferView' in img}

# Chaque tampon est recopié aligné sur 4 octets ; les images sont remplacées par leur version WebP
webp = {}
for img in images:
    view = views[img['bufferView']]
    raw = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
    pic = Image.open(io.BytesIO(raw))
    pic.load()
    if max(pic.size) > 1024:
        pic.thumbnail((1024, 1024), Image.LANCZOS)
    out = io.BytesIO()
    pic.save(out, 'WEBP', quality=quality, method=6)
    webp[img['bufferView']] = out.getvalue()
    img['mimeType'] = 'image/webp'

new = bytearray()
for i, view in enumerate(views):
    raw = webp.get(i)
    if raw is None:
        raw = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
    new += b'\0' * (-len(new) % 4)
    view['byteOffset'] = len(new)
    view['byteLength'] = len(raw)
    new += raw
new += b'\0' * (-len(new) % 4)
gltf['buffers'][0]['byteLength'] = len(new)

for tex in gltf.get('textures', []):
    if 'source' in tex:
        tex.setdefault('extensions', {})['EXT_texture_webp'] = {'source': tex.pop('source')}
gltf['extensionsUsed'] = sorted(set(gltf.get('extensionsUsed', [])) | {'EXT_texture_webp'})
gltf['extensionsRequired'] = sorted(set(gltf.get('extensionsRequired', [])) | {'EXT_texture_webp'})

js = json.dumps(gltf, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
js += b' ' * (-len(js) % 4)
total = 12 + 8 + len(js) + 8 + len(new)
with open(path, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, total))
    f.write(struct.pack('<I4s', len(js), b'JSON') + js)
    f.write(struct.pack('<I4s', len(new), b'BIN\0') + new)
print(f'{path} : {len(data) / 1e6:.2f} Mo -> {total / 1e6:.2f} Mo, {len(images)} textures')
