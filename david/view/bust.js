// Buste 3D (carte Chance « Sylvain Durif ») : maillage compact maison « DUR1 », sans chargeur glTF.
//   en-tête : 'DUR1', nb sommets, nb faces (uint32), bornes min/max (6 float32)
//   puis positions int16 ×3, normales int8 ×3, couleurs uint8 ×3 (blocs alignés sur 4 octets), indices uint16 ou uint32
// Fichier produit à partir du .glb d'origine (dédoublonné, simplifié à 60 000 triangles, couleurs des sommets conservées).
let cache = null;
export function loadBust(THREE, url) {
  if (!cache) cache = fetch(url).then((r) => { if (!r.ok) throw new Error('buste introuvable'); return r.arrayBuffer(); }).then((buf) => parse(THREE, buf));
  return cache.then((geo) => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  });
}

function parse(THREE, buf) {
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'DUR1') throw new Error('format de buste inconnu');
  const nv = dv.getUint32(4, true), nf = dv.getUint32(8, true);
  const lo = [0, 1, 2].map((k) => dv.getFloat32(12 + 4 * k, true)), hi = [0, 1, 2].map((k) => dv.getFloat32(24 + 4 * k, true));
  let o = 36;
  const pad = (n) => n + ((4 - (n % 4)) % 4);
  const P = new Int16Array(buf.slice(o, o + nv * 6)); o += pad(nv * 6);
  const N = new Int8Array(buf, o, nv * 3); o += pad(nv * 3);
  const C = new Uint8Array(buf, o, nv * 3); o += pad(nv * 3);
  const I = nv > 65535 ? new Uint32Array(buf, o, nf * 3) : new Uint16Array(buf, o, nf * 3);
  // positions remises à l'échelle : hauteur 1, base à y = 0, centré en x et z
  const size = [0, 1, 2].map((k) => hi[k] - lo[k]), H = size[1];
  const pos = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) {
    const x = lo[k] + ((P[v * 3 + k] + 32768) / 65535) * size[k];
    pos[v * 3 + k] = k === 1 ? (x - lo[1]) / H : (x - (lo[k] + hi[k]) / 2) / H;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(N), 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(C), 3, true));
  g.setIndex(new THREE.BufferAttribute(nv > 65535 ? new Uint32Array(I) : new Uint16Array(I), 1));
  g.computeBoundingSphere();
  return g;
}
