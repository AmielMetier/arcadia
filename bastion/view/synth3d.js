// Interface de Bastion Clash (navigateur uniquement).
// Modèles 3D de la Synthèse : graphite sombre, cristaux cyan lumineux, anneaux en lévitation, bandes à la couleur de l'équipe.
'use strict';

const SYNTH_CRYSTAL = '#3df2ff';

function synthMats(color, op = 1) {
  return {
    team: getMat3D(color, 0.3, 0.45, color, 0.18, op),
    graphite: getMat3D('#2a2f3a', 0.5, 0.6, 0x000000, 0, op),
    dark: getMat3D('#161a22', 0.6, 0.55, 0x000000, 0, op),
    pale: getMat3D('#9aa6bd', 0.3, 0.6, 0x000000, 0, op),
    crystal: getMat3D(SYNTH_CRYSTAL, 0.12, 0.3, SYNTH_CRYSTAL, 0.9, op),
    glow: getMat3D('#b6fbff', 0.1, 0.1, '#7af6ff', 1.2, op),
  };
}

// Prisme hexagonal (la forme de base de toute l'architecture de la Synthèse)
function hexPrism(rTop, rBot, h, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 6), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function crystalShard(size, mat, stretch = 1.6) {
  const c = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), mat);
  c.scale.set(0.75, stretch, 0.75);
  c.castShadow = true;
  return c;
}
function floatRing(radius, thick, mat) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thick, 6, 6), mat);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function buildSynthBuilding3D(kind, grp, body, r, h, color, op, isGhost) {
  const M = synthMats(color, op);
  const y0 = 6;
  const add = (m, x, y, z) => { m.position.set(x, y, z); if (isGhost) m.castShadow = false; body.add(m); return m; };

  if (kind === 'core') {
    // Noyau : socle hexagonal en gradins, colonne de cristal et deux anneaux qui tournent
    add(hexPrism(r * 0.95, r * 1.02, h * 0.22, M.graphite), 0, y0 + h * 0.11, 0);
    add(hexPrism(r * 0.72, r * 0.84, h * 0.2, M.team), 0, y0 + h * 0.31, 0);
    add(hexPrism(r * 0.5, r * 0.62, h * 0.18, M.graphite), 0, y0 + h * 0.5, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      add(crystalShard(r * 0.12, M.crystal, 2.2), Math.cos(a) * r * 0.82, y0 + h * 0.36, Math.sin(a) * r * 0.82);
    }
    add(crystalShard(r * 0.26, M.crystal, 2.6), 0, y0 + h * 0.86, 0);
    const spin = new THREE.Group();
    spin.position.y = y0 + h * 0.86;
    spin.add(floatRing(r * 0.55, 2.4, M.team));
    const r2 = floatRing(r * 0.42, 1.6, M.glow);
    r2.rotation.x = Math.PI / 2 + 0.5;
    spin.add(r2);
    body.add(spin);
    grp.userData.rotPart = spin;
  } else if (kind === 'condenser') {
    // Condensateur : trois lames autour d'une sphère d'énergie
    add(hexPrism(r * 0.7, r * 0.9, h * 0.25, M.graphite), 0, y0 + h * 0.12, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const blade = add(new THREE.Mesh(new THREE.BoxGeometry(5, h * 0.8, r * 0.5), M.team), Math.cos(a) * r * 0.48, y0 + h * 0.5, Math.sin(a) * r * 0.48);
      blade.rotation.y = -a;
      blade.rotation.z = Math.cos(a) * 0.12;
    }
    const orb = add(new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.32, 0), M.crystal), 0, y0 + h * 0.62, 0);
    grp.userData.rotPart = orb;
  } else if (kind === 'siphon') {
    // Siphon : cloche hexagonale posée sur le geyser, aspirée par un tube lumineux
    add(hexPrism(r * 0.78, r * 0.98, h * 0.5, M.graphite), 0, y0 + h * 0.25, 0);
    add(hexPrism(r * 0.82, r * 0.82, h * 0.14, M.team), 0, y0 + h * 0.42, 0);
    const tube = add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.22, h * 0.6, 12), M.crystal), 0, y0 + h * 0.75, 0);
    grp.userData.piston = tube;
  } else if (kind === 'forge' || kind === 'workshop' || kind === 'aerie' || kind === 'archive') {
    // Bâtiments de production : bloc hexagonal allongé, toit incliné, cristaux selon la fonction
    const big = kind === 'workshop' || kind === 'aerie';
    add(hexPrism(r * 0.92, r * 1.0, h * 0.55, M.graphite), 0, y0 + h * 0.27, 0);
    const roof = add(hexPrism(r * 0.55, r * 0.9, h * 0.25, M.team), 0, y0 + h * 0.67, 0);
    roof.rotation.y = Math.PI / 6;
    // Portail lumineux tourné vers l'extérieur
    add(new THREE.Mesh(new THREE.BoxGeometry(3, h * 0.36, r * 0.5), M.glow), r * 0.93, y0 + h * 0.22, 0);
    if (kind === 'forge') {
      for (const z of [-1, 1]) add(crystalShard(r * 0.14, M.crystal, 2), -r * 0.3, y0 + h * 0.95, z * r * 0.3);
    } else if (kind === 'workshop') {
      const arm = add(new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, 4, 4), M.pale), 0, y0 + h * 0.92, 0);
      grp.userData.rotPart = arm;
    } else if (kind === 'aerie') {
      const pad = add(hexPrism(r * 0.5, r * 0.5, 3, M.pale), 0, y0 + h * 0.82, 0);
      void pad;
      const ring = floatRing(r * 0.42, 1.6, M.glow);
      ring.position.y = y0 + h * 1.0;
      body.add(ring);
      grp.userData.rotPart = ring;
    } else {
      // Archives : trois cristaux flottants qui tournent au-dessus du toit
      const orbit = new THREE.Group();
      orbit.position.y = y0 + h * 1.05;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        const c = crystalShard(r * 0.12, M.crystal, 1.8);
        c.position.set(Math.cos(a) * r * 0.35, 0, Math.sin(a) * r * 0.35);
        orbit.add(c);
      }
      body.add(orbit);
      grp.userData.rotPart = orbit;
    }
    void big;
  } else if (kind === 'prism') {
    // Prisme défensif : pylône hexagonal surmonté d'un gros cristal qui pivote vers sa cible
    add(hexPrism(r * 0.55, r * 0.85, h * 0.55, M.graphite), 0, y0 + h * 0.27, 0);
    add(hexPrism(r * 0.6, r * 0.6, h * 0.08, M.team), 0, y0 + h * 0.5, 0);
    const head = new THREE.Group();
    head.position.y = y0 + h * 0.78;
    head.add(crystalShard(r * 0.36, M.crystal, 1.5));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, r * 0.7, 6), M.glow);
    lens.rotation.z = Math.PI / 2;
    lens.position.x = r * 0.35;
    head.add(lens);
    body.add(head);
    grp.userData.turret = head;
  } else if (kind === 'oculus') {
    // Oculus : flèche fine portant un œil de cristal, balise clignotante
    add(hexPrism(r * 0.4, r * 0.8, h * 0.7, M.graphite), 0, y0 + h * 0.35, 0);
    add(floatRing(r * 0.5, 1.4, M.team), 0, y0 + h * 0.55, 0);
    const eye = add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.42, 14, 10), M.crystal), 0, y0 + h * 0.85, 0);
    grp.userData.rotPart = eye;
    const beacon = add(new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), M.glow), 0, y0 + h * 1.08, 0);
    grp.userData.beacon = beacon;
  } else if (kind === 'barrier') {
    // Barrière : bloc de cristal trapu sur socle sombre
    add(hexPrism(r * 0.9, r * 1.0, h * 0.4, M.graphite), 0, y0 + h * 0.2, 0);
    add(crystalShard(r * 0.55, M.crystal, 1.2), 0, y0 + h * 0.65, 0);
  } else {
    add(hexPrism(r * 0.8, r * 0.95, h * 0.6, M.graphite), 0, y0 + h * 0.3, 0);
    add(crystalShard(r * 0.25, M.crystal, 2), 0, y0 + h * 0.8, 0);
  }
}

function buildSynthUnit3D(kind, grp, r, color) {
  const M = synthMats(color);
  const body = new THREE.Group();
  const add = (m, x, y, z, parent = body) => { m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

  // Spectre : matières propres (pas celles du cache) pour pouvoir le rendre translucide quand il est camouflé
  if (kind === 'spectre') {
    const mats = ['#2a2f3a', color, SYNTH_CRYSTAL].map((c, i) => new THREE.MeshStandardMaterial({
      color: new THREE.Color(c), roughness: 0.35, metalness: 0.5, transparent: true, opacity: 1,
      emissive: new THREE.Color(i === 2 ? c : '#000000'), emissiveIntensity: i === 2 ? 1 : 0,
    }));
    add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, r * 2.2, 6), mats[0]), 0, r * 1.1, 0);
    add(new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.38, 0), mats[1]), 0, r * 2.3, 0);
    for (const z of [-1, 1]) {
      const blade = add(new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, 1.5, 2.4), mats[2]), r * 0.5, r * 1.3, z * r * 0.55);
      blade.rotation.y = z * 0.35;
    }
    grp.userData.cloakMats = mats;
  } else if (kind === 'drone') {
    // Drone : coque plate en lévitation, deux pinces, cristal porté pendant la récolte
    const hull = add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 1.15, 5, 6), M.graphite), 0, 9, 0);
    void hull;
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.9, 3, 6), M.team), 0, 12.5, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), M.glow), r * 0.8, 10, 0);
    for (const z of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, 1.6, 1.6), M.pale), r * 0.9, 7, z * r * 0.45);
    const carry = add(crystalShard(3.4, M.crystal, 1.4), -r * 0.2, 17, 0);
    carry.visible = false;
    grp.userData.cargoMin = carry;
    grp.userData.cargoGas = carry;
  } else if (kind === 'lancer') {
    // Lancier : silhouette fine sur deux jambes, tête-cristal et long canon à rayon
    for (const z of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 11, 2.4), M.graphite), 0, 5.5, z * r * 0.35);
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.55, 10, 6), M.team), 0, 15, 0);
    add(crystalShard(r * 0.28, M.crystal, 1.6), 0, 23, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, 2.2, 2.2), M.pale), r * 0.7, 15, r * 0.45);
    add(new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6), M.glow), r * 1.5, 15, r * 0.45);
  } else if (kind === 'strider') {
    // Arpenteur : corps hexagonal porté par quatre pattes, émetteur d'arc en tourelle
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      const leg = add(new THREE.Mesh(new THREE.BoxGeometry(3, 16, 3), M.graphite), Math.cos(a) * r * 0.7, 8, Math.sin(a) * r * 0.7);
      leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.6, 8, 6), M.team), 0, 18, 0);
    const turret = new THREE.Group();
    turret.position.y = 25;
    const em = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.6, r * 1.3, 6), M.pale);
    em.rotation.z = Math.PI / 2; em.position.x = r * 0.5; em.castShadow = true;
    turret.add(em);
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(3.6, 0), M.crystal);
    tip.position.x = r * 1.2;
    turret.add(tip);
    body.add(turret);
    grp.userData.turret = turret;
  } else if (kind === 'monolith') {
    // Monolithe : bloc de cristal massif, plaques d'armure, halo de l'aura au sol
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.95, 14, 6), M.graphite), 0, 7, 0);
    add(crystalShard(r * 0.62, M.crystal, 1.45), 0, 30, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const plate = add(new THREE.Mesh(new THREE.BoxGeometry(5, 22, r * 0.7), M.team), Math.cos(a) * r * 0.62, 24, Math.sin(a) * r * 0.62);
      plate.rotation.y = -a;
    }
    const halo = new THREE.Mesh(new THREE.RingGeometry(r * 1.6, r * 1.75, 6), getMat3D(SYNTH_CRYSTAL, 0.2, 0.1, SYNTH_CRYSTAL, 0.8, 0.5));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 1.2;
    grp.add(halo);
  } else if (kind === 'dragonfly') {
    // Libellule : fuselage effilé, deux paires d'ailes de cristal
    const hull = add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, r * 2.2, 6), M.team), 0, 0, 0);
    hull.rotation.z = -Math.PI / 2;
    for (const [x, s] of [[r * 0.35, 1], [-r * 0.25, 0.8]]) {
      for (const z of [-1, 1]) {
        const wing = add(new THREE.Mesh(new THREE.BoxGeometry(r * 0.45 * s, 0.8, r * 1.4 * s), M.crystal), x, 1, z * r * 0.75 * s);
        wing.rotation.x = z * 0.12;
      }
    }
    add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), M.glow), r * 1.0, 0, 0);
    const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 16), getMat3D('#000000', 1, 0, 0x000000, 0, 0.3));
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.5;
    grp.add(shadowDisc);
    grp.userData.shadowDisc = shadowDisc;
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.95, r * 1.3, 18), getMat3D(SYNTH_CRYSTAL, 0.2, 0.1, SYNTH_CRYSTAL, 0.9));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1.5;
  ring.visible = false;
  grp.add(ring);
  grp.userData.stimRing = ring;
  grp.add(body);
  if (kind !== 'monolith' && kind !== 'strider') grp.userData.walkBody = body;
}
