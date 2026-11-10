// The Backrooms (Level 5, le Terror Hotel) - L'habillage de l'hôtel des années 1930 : portes de chambre numérotées,
// lits, armoires et bureaux, appliques Art déco du couloir, lustre et comptoir du hall, cadres aux murs, boîtes aux
// lettres (une par chambre), clavier à code et porte de l'escalier de secours, les lettres sur papier, et le code à 4
// chiffres qui s'allume au plafond du hall quand les 6 lettres sont postées.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE } from '../engine/map.js';
import { buildHotelRooms } from './hotelRooms.js';
import { buildHotelCorridor } from './hotelCorridor.js';
import { buildHotelLobby } from './hotelLobby.js';
import { buildHotelExit } from './hotelExit.js';

const C = CELL_SIZE;

// petite toile de texte (numéros, lettres, code)
function label(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildHotel({ map, group, baked, wallMat, CEIL }) {
  const lam = (o) => baked(new THREE.MeshLambertMaterial(o));
  const M = {
    wood: lam({ color: '#3b2314' }),
    darkWood: lam({ color: '#24150b' }),
    door: lam({ color: '#4a2c18' }),
    brass: lam({ color: '#a8823c', emissive: '#2a1c08', emissiveIntensity: 0.4 }),
    sheet: lam({ color: '#d9d0bd' }),
    blanket: lam({ color: '#6b1f1c' }),
    pillow: lam({ color: '#e6dccb' }),
    black: new THREE.MeshBasicMaterial({ color: '#050403' }),
  };
  const box = (w, h, d, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  // un repère tourné : +z local vers (dx, dz)
  const frame = (x, z, rot) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    group.add(g);
    return g;
  };

  // --- 1. Portes des chambres (view/hotelCorridor.js : embrasure, chambranle, battant, moulures, vie du couloir,
  // cage d'escalier), et ici la plaque de laiton numérotée ---
  buildHotelCorridor({ map, group, baked, wallMat, CEIL });
  for (const r of map.rooms) {
    const { x, z } = r.door;
    const [dx, dz] = r.dir; // de la chambre vers le couloir
    const g = frame((x + 0.5) * C, (z + 0.5) * C, Math.atan2(dx, dz)); // +z local : vers le couloir
    // la plaque du numéro
    const t = label(128, 64, (c, w, h) => {
      c.fillStyle = '#7a5a26';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e0c27a';
      c.lineWidth = 4;
      c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = '#f3e2b0';
      c.font = 'bold 40px Georgia, serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(r.num), w / 2, h / 2 + 2);
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), baked(new THREE.MeshLambertMaterial({ map: t, emissive: '#6a5230', emissiveMap: t, emissiveIntensity: 0.6 })));
    plate.position.set(map.doorW / 2 + 0.36, 1.55, C / 2 + 0.012);
    g.add(plate);
  }

  // --- 2. Meubles des chambres : lits, armoires, bureaux et leur lampe, tables de nuit, fenêtres, radiateurs,
  // plafonniers, tapis (view/hotelRooms.js) ---
  const lampShades = [];
  const rooms = buildHotelRooms({ map, group, baked, brass: M.brass, lampShades, CEIL });

  // --- 3. Appliques Art déco du couloir et lustre du hall ---
  // une platine de laiton à gradins, un bras en col de cygne, une coupelle, et une tulipe de verre dépoli ouverte vers
  // le haut (sa lueur plus vive au fond, là où est l'ampoule) ; allumée, un halo doux l'entoure
  const glowTex = label(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255, 214, 150, 1)');
    g.addColorStop(0.25, 'rgba(255, 170, 90, 0.45)');
    g.addColorStop(1, 'rgba(255, 140, 60, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const tulipTex = label(8, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, h, 0, 0); // v = 0 au fond de la tulipe, 1 au bord
    g.addColorStop(0, '#fff2d0');
    g.addColorStop(0.35, '#ffd08a');
    g.addColorStop(0.85, '#b8702c');
    g.addColorStop(1, '#f0c080');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const tulipGeo = new THREE.LatheGeometry(
    [[0.012, 0], [0.03, 0.006], [0.05, 0.022], [0.068, 0.05], [0.083, 0.088], [0.094, 0.126], [0.1, 0.15], [0.106, 0.162], [0.1, 0.166]].map(([r, y]) => new THREE.Vector2(r, y)),
    16,
  );  // la tulipe d'une applique morte : il n'en reste que le fond, au bord dentelé
  let brokenN = 0;
  const brokenTulip = () => {
    const g = tulipGeo.clone();
    const p = g.attributes.position;
    const seed = ++brokenN * 1.7;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const cut = 0.045 + 0.03 * Math.abs(Math.sin(a * 3 + seed)) + 0.02 * Math.abs(Math.sin(a * 7.3 + seed * 2.1));
      if (p.getY(i) > cut) {
        const k = cut / p.getY(i);
        p.setXYZ(i, p.getX(i) * (0.9 + 0.1 * k), cut, p.getZ(i) * (0.9 + 0.1 * k));
      }
    }
    g.computeVertexNormals();
    return g;
  };

  const plateGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.014, 20);
  plateGeo.rotateX(Math.PI / 2);
  const plate2Geo = new THREE.CylinderGeometry(0.035, 0.045, 0.012, 16);
  plate2Geo.rotateX(Math.PI / 2);
  const armGeo = new THREE.TubeGeometry(new THREE.CubicBezierCurve3(new THREE.Vector3(0, -0.07, 0.015), new THREE.Vector3(0, -0.1, 0.08), new THREE.Vector3(0, -0.06, 0.11), new THREE.Vector3(0, -0.012, 0.11)), 10, 0.007, 6);
  const cupGeo = new THREE.CylinderGeometry(0.022, 0.012, 0.018, 12);
  const bulbGeo = new THREE.SphereGeometry(0.022, 10, 8);
  for (const l of map.lights) {
    if (l.sconce) {
      const { dx, dz } = l.sconce;
      const g = frame(l.x + dx * 0.2, l.z + dz * 0.2, Math.atan2(-dx, -dz)); // +z local : vers le couloir
      const y = l.fy || 2.0;
      const a = new THREE.Group();
      a.position.y = y;
      g.add(a);
      const plate = new THREE.Mesh(plateGeo, M.brass);
      plate.position.set(0, -0.06, 0.007);
      a.add(plate);
      const plate2 = new THREE.Mesh(plate2Geo, M.brass);
      plate2.position.set(0, -0.06, 0.018);
      a.add(plate2);
      a.add(new THREE.Mesh(armGeo, M.brass));
      const cup = new THREE.Mesh(cupGeo, M.brass);
      cup.position.set(0, -0.006, 0.11);
      a.add(cup);
      const mat = new THREE.MeshLambertMaterial({ color: '#e8d2a8', emissive: '#ffffff', emissiveMap: tulipTex, emissiveIntensity: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.93 });
      const glass = new THREE.Mesh(l.state === 'off' ? brokenTulip() : tulipGeo, mat); // les mortes ont la tulipe cassée
      glass.position.set(0, 0, 0.11);
      a.add(glass);
      const bulbMat = new THREE.MeshBasicMaterial({ color: '#fff0c8' });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(0, 0.04, 0.11);
      if (l.state !== 'off') a.add(bulb);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.set(0.62, 0.62, 1);
      halo.position.set(0, 0.07, 0.13);
      a.add(halo);
      lampShades.push({ l, mat, k: 1.25, bulb, halo });
    }
    // les lustres du hall sont des modèles (Chandelier_01, dans map.props)
  }

  // --- 4. Cadres aux murs du couloir : des portraits sombres et des paysages délavés ---
  let fs = 99;
  const frnd = () => ((fs = (fs * 16807) % 2147483647) / 2147483647);
  const paint = [0, 1, 2, 3].map((k) =>
    label(64, 80, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, ['#2b3a2a', '#3a2a22', '#1e2430', '#40362a'][k]);
      g.addColorStop(1, '#0e0b08');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(200, 180, 140, 0.18)';
      if (k % 2) {
        c.beginPath();
        c.ellipse(w / 2, h * 0.42, 12, 16, 0, 0, Math.PI * 2);
        c.fill();
        c.fillRect(w / 2 - 18, h * 0.6, 36, h * 0.4);
      } else c.fillRect(0, h * 0.62, w, 3);
    }),
  );
  for (const c of map.corridorCells) {
    if (frnd() > 0.22) continue;
    const wall = [[0, -1], [0, 1], [-1, 0], [1, 0]].find(([dx, dz]) => map.isWall(c.x + dx, c.z + dz) && !map.lights.some((l) => l.sconce && l.gx === c.x && l.gz === c.z));
    if (!wall) continue;
    const [dx, dz] = wall;
    const g = frame((c.x + 0.5 + dx * 0.5) * C - dx * 0.03, (c.z + 0.5 + dz * 0.5) * C - dz * 0.03, Math.atan2(-dx, -dz));
    const w = 0.5 + frnd() * 0.3;
    box(w + 0.08, w * 1.25 + 0.08, 0.04, M.brass, 0, 1.65, 0, g);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 1.25), baked(new THREE.MeshLambertMaterial({ map: paint[Math.floor(frnd() * 4)] })));
    pic.position.set(0, 1.65, 0.025);
    g.add(pic);
  }

  // --- 5. Le hall : comptoir de la réception, boîtes aux lettres, clavier, porte de l'escalier de secours ---
  // (le sol de marbre, les tapis, les colonnes, le plafond à caissons, les portes vitrées, la trappe d'arrivée :
  // view/hotelLobby.js)
  buildHotelLobby({ map, group, baked, CEIL });
  const marble = lam({ color: '#d9d2c4' });
  for (const s of map.solids) {
    if (s.reception) {
      // le comptoir : façade à panneaux moulurés côté hall, plateau de marbre, plinthe, sonnette et registre
      box(s.hx * 2, 1.05, s.hz * 2, M.wood, s.x, 0.525, s.z);
      box(s.hx * 2 + 0.12, 0.06, s.hz * 2 + 0.12, marble, s.x, 1.08, s.z);
      box(s.hx * 2 + 0.04, 0.12, s.hz * 2 + 0.04, M.darkWood, s.x, 0.06, s.z);
      const n = 4;
      for (let i = 0; i < n; i++) {
        const z = s.z - s.hz + ((i + 0.5) * s.hz * 2) / n;
        box(0.03, 0.62, (s.hz * 2) / n - 0.22, M.darkWood, s.x - s.hx - 0.015, 0.55, z);
        box(0.035, 0.5, (s.hz * 2) / n - 0.34, M.door, s.x - s.hx - 0.02, 0.55, z);
      }
      box(0.04, 0.1, s.hz * 2 + 0.04, M.brass, s.x - s.hx - 0.02, 0.95, s.z); // la frise de laiton
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.brass);
      bell.position.set(s.x - 0.2, 1.11, s.z - 0.4);
      group.add(bell);
      box(0.12, 0.012, 0.012, M.brass, s.x - 0.2, 1.18, s.z - 0.4);
      // le registre ouvert
      for (const sz of [-1, 1]) {
        const page = box(0.26, 0.02, 0.18, M.sheet, s.x - 0.15, 1.12, s.z + 0.95 + sz * 0.1);
        page.rotation.x = sz * 0.06;
      }
      box(0.28, 0.015, 0.4, M.blanket, s.x - 0.15, 1.105, s.z + 0.95);
      // le tableau des clés, au mur de part et d'autre de la vitrine : des casiers, une clé de laiton pendue sous chacun
      for (const side of [-1, 1]) {
        const kz = s.z + side * 1.65;
        const kx = s.x + s.hx + 1.15 - 0.03; // contre le mur est
        box(0.05, 0.9, 0.9, M.darkWood, kx, 1.75, kz);
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            const y = 2.1 - r * 0.22;
            const z = kz - 0.33 + c * 0.22;
            box(0.02, 0.17, 0.17, M.black, kx - 0.03, y, z);
            if ((r * 4 + c + side) % 3) box(0.01, 0.07, 0.02, M.brass, kx - 0.05, y - 0.11, z);
          }
        }
      }
    } else if (s.banquette) {
      // banquette ronde de velours vert, dossier central, socle de bois et frise de laiton
      const velvet = lam({ color: '#23432f' });
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.25, 0.42, 32), velvet);
      seat.position.set(s.x, 0.26, s.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.26, 1.26, 0.06, 32), M.darkWood);
      base.position.set(s.x, 0.03, s.z);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 24), velvet);
      back.position.set(s.x, 0.72, s.z);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.025, 6, 40), M.brass);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(s.x, 0.47, s.z);
      const tuft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 24), M.darkWood);
      tuft.position.set(s.x, 0.97, s.z);
      group.add(seat, base, back, rim, tuft);
    } else if (s.column) {
      // (les colonnes : view/hotelLobby.js)
    } else if (s.cart) {
      // le chariot à bagages : plateau de moquette rouge, deux arceaux de laiton, quatre roues
      box(s.hx * 2, 0.06, s.hz * 2, M.blanket, s.x, 0.29, s.z);
      box(s.hx * 2 + 0.04, 0.04, s.hz * 2 + 0.04, M.brass, s.x, 0.25, s.z);
      for (const sz of [-1, 1]) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(s.hx, 0.022, 6, 24, Math.PI), M.brass);
        arch.position.set(s.x, 0.3, s.z + sz * (s.hz - 0.03));
        arch.scale.set(1, 3.4, 1);
        group.add(arch);
      }
      box(0.03, 0.03, s.hz * 2, M.brass, s.x, 0.3 + s.hx * 3.4, s.z);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12), M.black);
          w.rotation.z = Math.PI / 2;
          w.position.set(s.x + sx * (s.hx - 0.08), 0.09, s.z + sz * (s.hz - 0.1));
          group.add(w);
        }
      }
    }
  }
  // les tapis : vert bouteille bordé d'or, sous le salon et devant la réception
  const rugTex = label(256, 256, (c, w, h) => {
    c.fillStyle = '#1f3a2c';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#b08a3c';
    c.lineWidth = 10;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.lineWidth = 3;
    c.strokeRect(34, 34, w - 68, h - 68);
    c.strokeStyle = 'rgba(176, 138, 60, 0.6)';
    c.beginPath();
    c.moveTo(w / 2, 50);
    c.lineTo(w - 50, h / 2);
    c.lineTo(w / 2, h - 50);
    c.lineTo(50, h / 2);
    c.closePath();
    c.stroke();
    for (let i = 0; i < 4000; i++) {
      c.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  const L = map.lobby;
  for (const [x, z, w, d] of [
    [(L.x0 * C) + 5, (L.z1 + 1) * C - 2.6, 5.4, 3.8],
    [(L.x1 + 1) * C - 3.6, (L.z0 + 3.5) * C, 2.4, 5.4],
  ]) {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), baked(new THREE.MeshLambertMaterial({ map: rugTex, polygonOffset: true, polygonOffsetFactor: -2 })));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(x, 0.008, z);
    group.add(rug);
  }
  const mb = map.mailbox;
  const mg = frame(mb.x, 0, Math.PI / 2); // +z local : vers l'est (le hall), x local : vers -z monde
  mg.position.z = 0;
  const mbW = mb.z1 - mb.z0;
  // le meuble de casiers (le repère : x local = -z monde)
  const panel = box(mbW + 0.2, mb.y1 - mb.y0 + 0.25, 0.25, M.darkWood, -(mb.z0 + mb.z1) / 2, (mb.y0 + mb.y1) / 2, 0.125, mg);
  panel.userData.mail = true;
  const slots = [];
  for (const b of mb.boxes) {
    const t = label(96, 64, (c, w, h) => {
      c.fillStyle = '#5a3a1c';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#c9a050';
      c.lineWidth = 3;
      c.strokeRect(3, 3, w - 6, h - 6);
      c.fillStyle = '#111';
      c.fillRect(14, 10, w - 28, 8);
      c.fillStyle = '#e8cf8a';
      c.font = 'bold 22px Georgia, serif';
      c.textAlign = 'center';
      c.fillText(String(b.num), w / 2, 48);
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), baked(new THREE.MeshLambertMaterial({ map: t, emissive: '#5a4020', emissiveMap: t, emissiveIntensity: 0.5 })));
    face.position.set(-b.z, b.y, 0.252);
    mg.add(face);
    // la lettre postée dépasse du casier
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.16), new THREE.MeshLambertMaterial({ color: '#efe6d2', emissive: '#ffffff', emissiveIntensity: 0.3 }));
    paper.position.set(-b.z, b.y + 0.17, 0.262);
    paper.visible = false;
    mg.add(paper);
    slots.push({ b, paper, char: '' });
  }
  // la porte de secours et son clavier à code : view/hotelExit.js
  const exitView = buildHotelExit({ map, group, baked, CEIL });

  // --- 6. Le code au plafond du hall ---
  const codeTex = label(512, 192, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(20, 40, 60, 0.45)');
    g.addColorStop(1, 'rgba(20, 40, 60, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f2fbff';
    c.shadowColor = '#5fd0ff';
    c.shadowBlur = 24;
    c.font = 'bold 130px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(map.code.split('').join(' '), w / 2, h / 2 + 6);
  });
  const codeMat = new THREE.MeshBasicMaterial({ map: codeTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const codePlane = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), codeMat);
  codePlane.rotation.x = Math.PI / 2;
  // lisible en levant les yeux, face au nord (depuis le fond du hall)
  codePlane.position.set(map.lobbyCenter.x, (map.lobbyCeil || CEIL) - 0.02, map.lobbyCenter.z);
  group.add(codePlane);
  let codeK = 0;

  // --- 7. Les lettres sur papier : une feuille pliée, la lettre et le numéro de la chambre ---
  const papers = map.letters.map((L) => {
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.22 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.18), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = L.rot;
    m.position.set(L.x, L.y + 0.004, L.z);
    group.add(m);
    return { L, m, mat, char: null };
  });
  const paperTex = (ch, num) =>
    label(128, 96, (c, w, h) => {
      c.fillStyle = '#efe6d2';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(120, 100, 70, 0.35)';
      c.beginPath();
      c.moveTo(w / 2, 0);
      c.lineTo(w / 2, h);
      c.stroke();
      c.fillStyle = '#2a1a10';
      c.font = 'bold 64px Georgia, serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(ch, w / 2, h / 2 - 4);
      c.font = '14px Georgia, serif';
      c.fillText(`ROOM ${num}`, w / 2, h - 12);
    });

  let flickT = 0;
  return {
    update(sim, P, time, dt) {
      rooms.update(sim);
      // les lettres, une fois le mot connu (l'hôte l'envoie à ses invités)
      for (const p of papers) {
        const ch = sim.word[p.L.idx] || '?';
        if (p.char !== ch) {
          p.char = ch;
          if (p.mat.map) p.mat.map.dispose();
          p.mat.map = paperTex(ch, p.L.num);
          p.mat.emissiveMap = p.mat.map;
          p.mat.needsUpdate = true;
        }
        p.m.visible = !p.L.taken;
      }
      for (const s of slots) {
        const L = s.b.letter >= 0 ? map.letters[s.b.letter] : null;
        const show = !!(L && L.posted);
        s.paper.visible = show;
        const ch = L ? sim.word[L.idx] || '?' : '';
        if (show && s.char !== ch) {
          s.char = ch;
          s.paper.material.map = label(64, 48, (c, w, h) => {
            c.fillStyle = '#efe6d2';
            c.fillRect(0, 0, w, h);
            c.fillStyle = '#2a1a10';
            c.font = 'bold 36px Georgia, serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(ch, w / 2, h / 2 + 2);
          });
          s.paper.material.emissiveMap = s.paper.material.map;
          s.paper.material.needsUpdate = true;
        }
      }
      // les appliques et les lampes : allumées, mortes, ou qui grésillent
      flickT += dt;
      const tick = Math.floor(flickT * 12);
      for (const s of lampShades) {
        let on = s.l.state === 'on' ? 1 : 0;
        if (s.l.state === 'flicker') on = Math.sin(tick * 12.9898 + s.l.x * 78.233) * 43758.5453 % 1 > -0.2 ? 0.9 : 0.1;
        if (sim.blackout > 0) on = 0;
        s.mat.emissiveIntensity = on * s.k;
        if (s.bulb) s.bulb.visible = on > 0.5;
        if (s.halo) s.halo.material.opacity = on * 0.42;
      }
      // le code au plafond, quand les 6 lettres sont postées : il s'allume en grésillant
      codeK = Math.min(1, codeK + (sim.codeShown ? dt * 0.4 : -dt));
      codeMat.opacity = Math.max(0, codeK) * (0.75 + Math.random() * 0.25);
      codePlane.visible = codeK > 0;
      exitView.update(sim, dt);
    },
  };
}
