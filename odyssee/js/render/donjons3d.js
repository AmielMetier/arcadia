// odyssee/js/render/donjons3d.js — les bâtiments des donjons à plusieurs (odyssee/js/donjons/), même atelier que
// batiments3d.js : le palais du Donjon des Miroirs (11 × 7) et le Sanctuaire des Trois Voies (9 × 7). Repris du labo.
// Coordonnées comme les autres modèles : x de 0 à w, z de 0 à d (façade sud en z = d), y vers le haut.
import * as THREE from 'three';

export function batimentsDonjons({ B, TX, tex, hash, mix, S, D, boite, at, M, COL, LUM, cyl, reperePorte }) {
  const cylUV = (r1, r2, h, mat, n = 20) => {
    const g = new THREE.CylinderGeometry(r1, r2, h, n, 1), uv = g.attributes.uv, c = Math.PI * (r1 + r2);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * c, uv.getY(i) * h);
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
  };
  const coneUV = (r, h, mat, n = 20) => {
    const g = new THREE.ConeGeometry(r, h, n), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * r * 2, uv.getY(i) * Math.hypot(r, h));
    const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
  };
  const fronton = (G, x, y, z, w, h, e, mat) => {
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: e, bevelEnabled: false }), mat); m.castShadow = m.receiveShadow = true;
    G.add(at(m, x, y, z - e));
  };
  const marbre = (col) => tex('mb' + col, D, D, (g, px, w, h) => {
    const rh = 12 * S, l = 24 * S;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = Math.floor(y / rh), dec = (r % 2) * l / 2;
      let f = (hash(Math.floor((x + dec) / l), r, 75) - 0.5) * 0.05;
      const v = Math.sin((x * 0.7 + y * 0.3) * 0.18 / S + Math.sin(y * 0.11 / S) * 3);
      if (v > 0.995) f -= 0.08;
      if (y % rh < S) f -= 0.16; else if ((x + dec) % l < S) f -= 0.1;
      px(x, y, mix(col, f));
    }
  });

  /* ---------------------------------------------------------------- le Donjon des Miroirs (11 × 7) */
  // palais de marbre blanc sur la neige : colonnes de cristal, hauts miroirs entre elles, grand miroir rond au-dessus
  // de la porte, fronton au losange de miroir, toit enneigé, deux obélisques de glace devant
  const miroirTex = () => tex('miroirSalle', D, D * 2, (g, px, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = y / h, b = ((x + y * 0.55) / (w * 0.9)) % 1;
      let c = mix('#cfe6f4', -0.35 * t + 0.08);
      if (b > 0.18 && b < 0.26) c = mix('#ffffff', -0.05 * t);
      else if (b > 0.32 && b < 0.35) c = mix('#eaf6fc', -0.1 * t);
      px(x, y, c);
    }
  });
  B.templeMiroirs = () => {
    const G = new THREE.Group(), w = 11, cx = w / 2, zf = 5.2;
    const MB = M({ map: marbre('#eef0f4') }), MG = M({ map: marbre('#c4cad6') }), MC = M({ map: marbre('#dde1ea') });
    const NEIGE = COL('#f8fbff'), MIR = M({ map: miroirTex(), emissive: new THREE.Color('#1c2c3a') });
    const CRI = LUM('#bfe9ff', '#2a5a78');
    const ARG = COL('#aab2c4');
    // soubassement et marches enneigées
    G.add(at(boite(w - 0.4, 0.7, zf - 0.6, MG), cx, 0.35, (zf + 0.6) / 2));
    for (let k = 0; k < 3; k++) {
      G.add(at(boite(4.2 - k * 0.3, 0.7 - k * 0.22, 0.42, MG), cx, (0.7 - k * 0.22) / 2, zf + 0.2 + k * 0.42));
      G.add(at(boite(4.2 - k * 0.3, 0.05, 0.3, NEIGE), cx - 0.2, 0.7 - k * 0.22 + 0.02, zf + 0.18 + k * 0.42));
    }
    // le corps
    const y0 = 0.7, H = 4.0, zw = zf - 0.55;
    G.add(at(boite(w - 1.0, H, zf - 1.4, MB), cx, y0 + H / 2, (zf - 1.4) / 2 + 0.85));
    G.add(at(boite(w - 0.7, 0.3, zf - 1.1, MC), cx, y0 + H + 0.15, (zf - 1.4) / 2 + 0.85));
    G.add(at(boite(w - 0.6, 0.12, zf - 1.0, NEIGE), cx, y0 + H + 0.36, (zf - 1.4) / 2 + 0.85));
    // colonnes de cristal et hauts miroirs cintrés
    const xs = [1.1, 2.6, 4.0, 7.0, 8.4, 9.9];
    for (const x of xs) {
      G.add(at(boite(0.6, 0.25, 0.6, MC), x, y0 + 0.12, zw + 0.25));
      G.add(at(cylUV(0.22, 0.22, H - 0.5, CRI, 6), x, y0 + 0.25 + (H - 0.5) / 2, zw + 0.25));
      G.add(at(boite(0.6, 0.25, 0.6, MC), x, y0 + H - 0.12, zw + 0.25));
    }
    for (const x of [1.85, 3.3, 7.7, 9.15]) {
      G.add(at(boite(0.95, 2.4, 0.04, MIR), x, y0 + 1.6, zw + 0.03));
      G.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.475, 14, 0, Math.PI), MIR), x, y0 + 2.8, zw + 0.03));
      G.add(at(boite(1.1, 0.12, 0.12, ARG), x, y0 + 0.35, zw + 0.06));
    }
    // la porte d'argent, et le grand miroir rond au-dessus
    const pw = 1.6, ph = 2.2;
    reperePorte(G, cx, y0, zw, pw, ph);
    G.add(at(boite(pw, ph, 0.05, COL('#8a93a8')), cx, y0 + ph / 2, zw + 0.03));
    G.add(at(boite(0.05, ph, 0.07, COL('#3a4054')), cx, y0 + ph / 2, zw + 0.06));
    for (const sx of [-1, 1]) G.add(at(boite(0.5, 1.4, 0.04, MIR), cx + sx * 0.4, y0 + 1.4, zw + 0.07));
    for (const sx of [-1, 1]) G.add(at(boite(0.22, ph + 0.3, 0.2, MC), cx + sx * (pw / 2 + 0.11), y0 + (ph + 0.3) / 2, zw + 0.1));
    G.add(at(boite(pw + 0.6, 0.25, 0.22, MC), cx, y0 + ph + 0.4, zw + 0.1));
    const yc = y0 + ph + 1.2;
    const rond = new THREE.Mesh(new THREE.CircleGeometry(0.55, 28), MIR); G.add(at(rond, cx, yc, zw + 0.06));
    const cercle = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 6, 28), ARG); G.add(at(cercle, cx, yc, zw + 0.08));
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, r = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 4), CRI); r.rotation.z = a - Math.PI / 2; G.add(at(r, cx + Math.cos(a) * 0.82, yc + Math.sin(a) * 0.82, zw + 0.08)); }
    // fronton en pointe au-dessus du pavillon central
    fronton(G, cx, y0 + H + 0.42, zw + 0.3, 4.4, 1.6, 1.2, MB);
    const losange = boite(0.55, 0.55, 0.04, MIR); losange.rotation.z = Math.PI / 4; G.add(at(losange, cx, y0 + H + 0.95, zw + 0.32));
    for (const sx of [-1, 1]) { const n = boite(2.5, 0.12, 1.25, NEIGE); n.rotation.z = -sx * Math.atan2(1.6, 2.2); G.add(at(n, cx + sx * 1.1, y0 + H + 1.27, zw - 0.3)); }
    const cristal = (x, y, z, r, h, a) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), CRI); c.rotation.z = a; c.castShadow = true; G.add(at(c, x, y + h / 2, z)); };
    // deux obélisques de glace au pied des marches
    for (const sx of [-1, 1]) {
      const ox = cx + sx * 3.3, oz = zf + 1.2;
      G.add(at(boite(0.8, 0.5, 0.8, MG), ox, 0.25, oz));
      G.add(at(boite(0.8, 0.06, 0.8, NEIGE), ox, 0.52, oz));
      const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 2.4, 4), CRI); ob.rotation.y = Math.PI / 4; G.add(at(ob, ox, 0.55 + 1.2, oz));
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 4), CRI); p.rotation.y = Math.PI / 4; G.add(at(p, ox, 0.55 + 2.6, oz));
    }
    return G;
  };

  /* ---------------------------------------------------------------- le Sanctuaire des Trois Voies (9 × 7) */
  B.voiesSanctuaire = () => {
    const G = new THREE.Group(), w = 9, d = 7, cx = w / 2, zf = 5.0;
    const RC = COL('#7a746c'), TA = M({ map: marbre('#a8a29a') }), SOMBRE = COL('#141218');
    const rocher = (x, y, z, r, k, sy = 0.75) => {
      const g = new THREE.DodecahedronGeometry(r, 0), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i), f = 0.82 + hash(Math.round(X * 97 + Z * 31), Math.round(Y * 89), k + 80) * 0.3; p.setXYZ(i, X * f, Y * f * sy, Z * f); }
      g.computeVertexNormals(); const m = new THREE.Mesh(g, RC); m.castShadow = m.receiveShadow = true; m.rotation.y = hash(k, 0, 81) * 6; G.add(at(m, x, y, z));
    };
    // le rocher : une masse arrondie, la façade taillée en plat sur le devant
    // de gros blocs de roche entassés autour d'un noyau, plus hauts au milieu
    G.add(at(boite(w - 2.4, 4.0, zf - 2.0, RC), cx, 2.0, (zf + 1.6) / 2));
    for (let i = 0; i < 7; i++) {
      const x = 0.9 + i * (w - 1.8) / 6, hm = 4.6 - Math.abs(x - cx) * 0.35;
      rocher(x, hm - 0.4, 2.4 + hash(i, 2, 82) * 1.0, 1.25 + hash(i, 3, 82) * 0.35, i, 0.9);
      rocher(x + 0.4, hm * 0.45, 2.0 + hash(i, 4, 82), 1.3, i + 30, 1.0);
    }
    for (const [x, k] of [[0.8, 20], [w - 0.8, 21]]) { rocher(x, 1.1, zf - 0.6, 1.2, k, 1.0); rocher(x, 2.6, zf - 1.1, 1.0, k + 5, 0.9); }
    G.add(at(boite(5.2, 4.2, 0.3, TA), cx, 2.1, zf - 0.1));
    // la porte : encadrement, linteau, trois marches
    const pw = 1.3, ph = 2.2;
    reperePorte(G, cx, 0.45, zf, pw, ph);
    G.add(at(boite(pw, ph, 0.05, SOMBRE), cx, 0.45 + ph / 2, zf + 0.06));
    for (const s of [-1, 1]) G.add(at(boite(0.3, ph + 0.2, 0.3, TA), cx + s * (pw / 2 + 0.15), 0.45 + (ph + 0.2) / 2, zf + 0.12));
    G.add(at(boite(pw + 1.0, 0.35, 0.4, TA), cx, 0.45 + ph + 0.35, zf + 0.15));
    for (let k = 0; k < 3; k++) G.add(at(boite(2.4 + (2 - k) * 0.5, 0.15, 0.4, TA), cx, 0.075 + k * 0.15, zf + 1.1 - k * 0.35));
    // trois niches au-dessus de la porte, une flamme pâle dans chacune : les trois voies
    for (const [dx, c] of [[-1.3, '#f0a050'], [0, '#a0d0f0'], [1.3, '#b0e090']]) {
      G.add(at(boite(0.6, 0.8, 0.06, SOMBRE), cx + dx, 3.35, zf + 0.06));
      G.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.3, 10, 0, Math.PI), SOMBRE), cx + dx, 3.75, zf + 0.06));
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), LUM(c, c)); G.add(at(f, cx + dx, 3.25, zf + 0.12));
      G.add(at(boite(0.7, 0.08, 0.2, TA), cx + dx, 2.92, zf + 0.12));
    }
    // deux lanternes de pierre sur la dernière marche
    for (const s of [-1, 1]) {
      const lx = cx + s * 2.2, lz = zf + 1.0;
      G.add(at(boite(0.4, 0.9, 0.4, TA), lx, 0.45, lz));
      G.add(at(boite(0.5, 0.45, 0.5, LUM('#f4e0b0', '#806030')), lx, 1.12, lz));
      G.add(at(coneUV(0.45, 0.4, TA, 4), lx, 1.55, lz));
    }
    // de la mousse et quelques herbes sur le rocher
    for (let i = 0; i < 7; i++) { const x = 1.0 + i * 1.15, m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), COL(i % 2 ? '#4a7a3a' : '#5e8c44')); m.scale.y = 0.45; G.add(at(m, x, 4.6 - Math.abs(x - cx) * 0.35 + 0.55, 2.6 + hash(i, 5, 82) * 0.8)); }
    return G;
  };
}
