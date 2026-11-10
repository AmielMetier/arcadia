// Allège un modèle .glb sans toucher à sa forme : les attributs des sommets sont rangés plus serrés
// (KHR_mesh_quantization, lu par le GLTFLoader de three.js). Les positions restent en flottants (rien ne bouge).
//   - normales : 3 octets signés (+ 1 de bourrage) au lieu de 12
//   - coordonnées de texture : 2 entiers de 16 bits au lieu de 8 octets (si elles restent entre 0 et 1)
//   - poids des os : 4 octets au lieu de 16 (la somme fait toujours 1) ; numéros des os : 4 octets
//   - indices : 16 bits quand le maillage a moins de 65 536 sommets
// Le reste (images, matrices des os, animations) est recopié tel quel.
//
//   node tools/pack-glb.mjs <entrée.glb> [sortie.glb]
import fs from 'node:fs';

const [, , inPath, outPath = inPath] = process.argv;
if (!inPath) {
  console.error('usage : node tools/pack-glb.mjs <entrée.glb> [sortie.glb]');
  process.exit(1);
}

const FLOAT = 5126;
const BYTE = 5120;
const UBYTE = 5121;
const USHORT = 5123;
const UINT = 5125;
const SIZE = { [BYTE]: 1, [UBYTE]: 1, 5122: 2, [USHORT]: 2, [UINT]: 4, [FLOAT]: 4 };
const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

const glb = fs.readFileSync(inPath);
if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error('pas un fichier .glb');
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));

// lit un accesseur en tableau de nombres (une ligne par élément)
function read(acc) {
  const bv = json.bufferViews[acc.bufferView];
  const n = COMPS[acc.type];
  const sz = SIZE[acc.componentType];
  const stride = bv.byteStride || n * sz;
  const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const out = new Float64Array(acc.count * n);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < n; c++) {
      const o = base + i * stride + c * sz;
      let v;
      switch (acc.componentType) {
        case FLOAT: v = dv.getFloat32(o, true); break;
        case UINT: v = dv.getUint32(o, true); break;
        case USHORT: v = dv.getUint16(o, true); break;
        case 5122: v = dv.getInt16(o, true); break;
        case UBYTE: v = dv.getUint8(o); break;
        case BYTE: v = dv.getInt8(o); break;
        default: throw new Error('type inconnu ' + acc.componentType);
      }
      out[i * n + c] = v;
    }
  }
  return out;
}

// les données de chaque accesseur, telles qu'elles seront écrites : { bytes, stride? }
const chunks = [];
let off = 0;
const views = [];
function addView(bytes, stride = 0, target = undefined) {
  const pad = (4 - (off % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad)), (off += pad);
  const v = { buffer: 0, byteOffset: off, byteLength: bytes.length };
  if (stride) v.byteStride = stride;
  if (target) v.target = target;
  chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length));
  off += bytes.length;
  views.push(v);
  return views.length - 1;
}

// le rôle de chaque accesseur dans les maillages
const role = new Map();
let maxVerts = new Map();
for (const m of json.meshes || []) {
  for (const p of m.primitives) {
    for (const [k, a] of Object.entries(p.attributes)) role.set(a, k);
    if (p.indices !== undefined) {
      role.set(p.indices, 'INDICES');
      maxVerts.set(p.indices, json.accessors[p.attributes.POSITION].count);
    }
    for (const t of p.targets || []) for (const a of Object.values(t)) role.set(a, 'TARGET');
  }
}

let saved = 0;
json.accessors.forEach((acc, i) => {
  if (acc.sparse) throw new Error('accesseur clairsemé : non géré');
  if (acc.bufferView === undefined) return;
  const r = role.get(i);
  const n = COMPS[acc.type];
  const before = acc.count * n * SIZE[acc.componentType];
  const d = read(acc);
  if (r === 'NORMAL' && acc.componentType === FLOAT) {
    const out = new Int8Array(acc.count * 4);
    for (let k = 0; k < acc.count; k++) {
      const x = d[k * 3], y = d[k * 3 + 1], z = d[k * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      out[k * 4] = Math.round((x / l) * 127);
      out[k * 4 + 1] = Math.round((y / l) * 127);
      out[k * 4 + 2] = Math.round((z / l) * 127);
    }
    Object.assign(acc, { bufferView: addView(out, 4, 34962), byteOffset: 0, componentType: BYTE, normalized: true });
    delete acc.min;
    delete acc.max;
    saved += before - out.length;
    return;
  }
  if (/^TEXCOORD_/.test(r) && acc.componentType === FLOAT && d.every((v) => v >= 0 && v <= 1)) {
    const out = new Uint16Array(acc.count * 2);
    for (let k = 0; k < d.length; k++) out[k] = Math.round(d[k] * 65535);
    Object.assign(acc, { bufferView: addView(new Uint8Array(out.buffer), 0, 34962), byteOffset: 0, componentType: USHORT, normalized: true });
    delete acc.min;
    delete acc.max;
    saved += before - out.byteLength;
    return;
  }
  if (/^WEIGHTS_/.test(r) && acc.componentType === FLOAT) {
    const out = new Uint8Array(acc.count * 4);
    for (let k = 0; k < acc.count; k++) {
      const w = [d[k * 4], d[k * 4 + 1], d[k * 4 + 2], d[k * 4 + 3]];
      const s = w.reduce((a, b) => a + b, 0) || 1;
      const q = w.map((v) => Math.round((v / s) * 255));
      // la somme doit faire 255 tout juste : l'écart va au plus gros poids
      const big = q.indexOf(Math.max(...q));
      q[big] += 255 - q.reduce((a, b) => a + b, 0);
      out.set(q, k * 4);
    }
    Object.assign(acc, { bufferView: addView(out, 0, 34962), byteOffset: 0, componentType: UBYTE, normalized: true });
    delete acc.min;
    delete acc.max;
    saved += before - out.length;
    return;
  }
  if (/^JOINTS_/.test(r) && acc.componentType !== UBYTE && d.every((v) => v < 256)) {
    const out = Uint8Array.from(d);
    Object.assign(acc, { bufferView: addView(out, 0, 34962), byteOffset: 0, componentType: UBYTE });
    delete acc.normalized;
    saved += before - out.length;
    return;
  }
  if (r === 'INDICES' && acc.componentType === UINT && maxVerts.get(i) <= 65535) {
    const out = Uint16Array.from(d);
    Object.assign(acc, { bufferView: addView(new Uint8Array(out.buffer), 0, 34963), byteOffset: 0, componentType: USHORT });
    saved += before - out.byteLength;
    return;
  }
  // tel quel, bien rangé
  const bytes = new Uint8Array(before);
  const dv = new DataView(bytes.buffer);
  const sz = SIZE[acc.componentType];
  for (let k = 0; k < d.length; k++) {
    const o = k * sz;
    switch (acc.componentType) {
      case FLOAT: dv.setFloat32(o, d[k], true); break;
      case UINT: dv.setUint32(o, d[k], true); break;
      case USHORT: dv.setUint16(o, d[k], true); break;
      case 5122: dv.setInt16(o, d[k], true); break;
      case UBYTE: dv.setUint8(o, d[k]); break;
      case BYTE: dv.setInt8(o, d[k]); break;
    }
  }
  const tgt = r === 'INDICES' ? 34963 : r ? 34962 : undefined;
  Object.assign(acc, { bufferView: addView(bytes, 0, tgt), byteOffset: 0 });
});
// les images
for (const img of json.images || []) {
  if (img.bufferView === undefined) continue;
  const bv = json.bufferViews[img.bufferView];
  img.bufferView = addView(new Uint8Array(bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)));
}
json.bufferViews = views;
const pad = (4 - (off % 4)) % 4;
if (pad) chunks.push(Buffer.alloc(pad)), (off += pad);
const newBin = Buffer.concat(chunks);
json.buffers = [{ byteLength: newBin.length }];
for (const k of ['extensionsUsed', 'extensionsRequired']) {
  json[k] = [...new Set([...(json[k] || []), 'KHR_mesh_quantization'])];
}

let js = Buffer.from(JSON.stringify(json), 'utf8');
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(12 + 8 + js.length + 8 + newBin.length, 8);
const jh = Buffer.alloc(8);
jh.writeUInt32LE(js.length, 0);
jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(newBin.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
const out = Buffer.concat([head, jh, js, bh, newBin]);
fs.writeFileSync(outPath, out);
console.log(`${inPath} : ${(glb.length / 1e6).toFixed(2)} Mo → ${(out.length / 1e6).toFixed(2)} Mo (${(saved / 1e6).toFixed(2)} Mo de sommets en moins)`);
