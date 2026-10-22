// Interface de Bastion Clash (navigateur uniquement).
// Boucle de rendu du monde et minimap.
'use strict';

/* ============================================================================
   RENDU PRINCIPAL DU MONDE 3D VUE DU DESSUS & MINIMAP (60 FPS)
   ============================================================================ */
function renderWorld(dt, now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!state) {
    ctx.fillStyle = '#142818';
    ctx.fillRect(0, 0, W, H);
    return;
  }

  const panSpd = 720 / cam.z;
  let panX = 0, panY = 0;
  if (keys['arrowup'] || keys['z'] || keys['w']) panY -= 1;
  if (keys['arrowdown'] || keys['s']) panY += 1;
  if (keys['arrowleft'] || keys['q'] || keys['a']) panX -= 1;
  if (keys['arrowright'] || keys['d']) panX += 1;

  // Déplacement au bord / coins de l'écran avec la souris (Edge Scrolling)
  if (mouse.inside && !mouse.panning && !mouse.overUI && !miniDragging) {
    const edgeMargin = 26;
    const winW = window.innerWidth, winH = window.innerHeight;
    if (mouse.clientX <= edgeMargin) panX -= 1;
    if (mouse.clientX >= winW - edgeMargin) panX += 1;
    if (mouse.clientY <= edgeMargin) panY -= 1;
    if (mouse.clientY >= winH - edgeMargin) panY += 1;
  }

  if (panX !== 0 || panY !== 0) {
    const pLen = Math.hypot(panX, panY) || 1;
    cam.x += (panX / pLen) * panSpd * dt;
    cam.y += (panY / pLen) * panSpd * dt;
  }
  if (keys['pageup']) cam.pitch = clamp((cam.pitch || 70) + 38 * dt, 25, 82);
  if (keys['pagedown']) cam.pitch = clamp((cam.pitch || 70) - 38 * dt, 25, 82);
  cam.x = clamp(cam.x, 0, WORLD_SIZE);
  cam.y = clamp(cam.y, 0, WORLD_SIZE);

  let shX = 0, shY = 0;
  if (cam.shake > 0.2) {
    shX = (Math.random() - 0.5) * cam.shake * 2;
    shY = (Math.random() - 0.5) * cam.shake * 2;
    cam.shake *= Math.pow(0.04, dt);
  } else cam.shake = 0;

  updateFogCanvas(now);

  // 1. Rendu WebGL 3D (Three.js) vue isométrique + Surcouche tactique 2D projetée
  if (syncAndRenderThree3D(dt, now, shX, shY)) {
    ctx.clearRect(0, 0, W, H);
    const isoSin = Math.sin(((cam.pitch || 70) * Math.PI) / 180);

    // Points de Ralliement des bâtiments sélectionnés
    for (const b of state.buildings) {
      if (selectedBlds.has(b.id) && b.rallyX != null && b.rallyY != null && (BUILDINGS[b.kind]?.trains || []).length > 0) {
        const p1 = worldToScreen3D(b.x, b.y, 6);
        const p2 = worldToScreen3D(b.rallyX, b.rallyY, 4);
        ctx.save();
        ctx.strokeStyle = '#ffc531';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffc531';
        ctx.strokeStyle = '#16181d';
        ctx.beginPath(); ctx.arc(p2.x, p2.y, 6, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }

    // Surcouche tactique des Bâtiments 3D (Cercles de sélection, Barres de PV, % Chantier, Nom + Ping sur QG)
    for (const b of state.buildings) {
      if (b.hp <= 0) continue;
      if (b.owner !== myId && !isVisibleToMe(b.x, b.y)) continue;
      const def = BUILDINGS[b.kind] || BUILDINGS.pylon;
      const selected = selectedBlds.has(b.id);
      const basePt = worldToScreen3D(b.x, b.y, 2);
      const topPt = worldToScreen3D(b.x, b.y, (def.height || 36) + 12);
      const radPx = b.radius * cam.z;

      if (selected && (def.detector || def.range) && !b.constructing && b.owner === myId) {
        const R = def.detector ? def.sight : def.range;
        ctx.save();
        ctx.strokeStyle = def.detector ? 'rgba(255,197,49,.75)' : 'rgba(255,90,69,.6)';
        ctx.fillStyle = def.detector ? 'rgba(255,197,49,.06)' : 'rgba(255,90,69,.05)';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.ellipse(basePt.x, basePt.y, R * cam.z, R * cam.z * isoSin, 0, 0, TAU);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      if (selected) {
        ctx.save();
        ctx.strokeStyle = '#2fbf71';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.ellipse(basePt.x, basePt.y, radPx * 1.08, radPx * 1.08 * isoSin, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      if (b.constructing) {
        const pct = Math.floor((b.buildProg || 0) * 100);
        const hasBuilder = state.units.some((u) => u.kind === 'scv' && u.buildTargetId === b.id && u.onSite && u.hp > 0);
        ctx.save();
        ctx.font = '700 11px Bungee, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#16181d';
        ctx.fillRect(topPt.x - 36, topPt.y - 10, 72, 17);
        ctx.fillStyle = hasBuilder ? '#ffc531' : '#ff4b2b';
        ctx.fillText(hasBuilder ? `🔧 ${pct}%` : `⏸ ${pct}%`, topPt.x, topPt.y + 2);
        ctx.restore();
      }

      if (b.hp < b.maxHp || selected || b.constructing || GFX.bars === 'always') {
        const bw = Math.max(40, radPx * 1.55);
        const pct = clamp(b.hp / b.maxHp, 0, 1);
        ctx.fillStyle = '#16181d';
        ctx.fillRect(topPt.x - bw / 2 - 1, topPt.y - 22, bw + 2, 7);
        ctx.fillStyle = pct > 0.45 ? '#2fbf71' : '#ff4b2b';
        ctx.fillRect(topPt.x - bw / 2, topPt.y - 21, bw * pct, 5);
      }

      if (b.kind === 'hq' && !b.constructing) {
        const ownerPlayer = state.players.find((p) => Number(p.id) === Number(b.owner));
        if (ownerPlayer) {
          const pingTxt = ownerPlayer.bot ? 'IA' : `${getPlayerPing(ownerPlayer)}ms`;
          const tag = `${ownerPlayer.name} · ${pingTxt}`;
          ctx.save();
          ctx.font = '700 11px "Chakra Petch", sans-serif';
          const tw = ctx.measureText(tag).width + 14;
          const bx = topPt.x - tw / 2, by = topPt.y - 42;
          ctx.fillStyle = 'rgba(22, 24, 29, 0.88)';
          ctx.strokeStyle = pc(ownerPlayer) || '#ffc531';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bx, by, tw, 18, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fff8ea';
          ctx.textAlign = 'center';
          ctx.fillText(tag, topPt.x, by + 13);
          ctx.restore();
        }
      }
    }

    // Surcouche tactique des Unités 3D (Cercles de sélection & Barres de PV)
    for (const u of state.units) {
      if (u.hp <= 0 || u.boardedIn) continue;
      if (u.owner !== myId && !isVisibleToMe(u.x, u.y)) continue;
      const selected = selectedUnits.has(u.id);
      const isFly = !!u.flying;
      const baseAlt = isFly ? 42 : 2;
      const basePt = worldToScreen3D(u.x, u.y, baseAlt);
      const hUnit = isFly ? 58 : (u.kind === 'titan' ? 42 : (u.kind === 'tank' || u.kind === 'siege') ? 26 : 20);
      const topPt = worldToScreen3D(u.x, u.y, hUnit);
      const radPx = u.radius * cam.z;

      if (selected) {
        ctx.save();
        ctx.strokeStyle = '#2fbf71';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(basePt.x, basePt.y, radPx + 4, (radPx + 4) * isoSin, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      if (u.hp < u.maxHp || selected || GFX.bars === 'always') {
        const bw = Math.max(24, radPx * 2.1);
        const pct = clamp(u.hp / u.maxHp, 0, 1);
        ctx.fillStyle = '#16181d';
        ctx.fillRect(topPt.x - bw / 2 - 1, topPt.y - 10, bw + 2, 5);
        ctx.fillStyle = pct > 0.45 ? '#2fbf71' : '#ff4b2b';
        ctx.fillRect(topPt.x - bw / 2, topPt.y - 9, bw * pct, 3);
      }
    }

    // Limites de VCS sur les gisements de mes bases : 2 crans par cristal, compteur sur chaque Raffinerie
    if (cam.z >= 0.5) {
      const hs = getMyHarvestStats();
      ctx.save();
      for (const m of hs.baseMins) {
        const n = hs.minCnt.get(m.id) || 0;
        const p = worldToScreen3D(m.x, m.y, m.rich ? 40 : 34);
        if (p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) continue;
        const pw = 9, ph = 4, gap = 2, tot = pw * MAX_SCV_PER_MINERAL + gap * (MAX_SCV_PER_MINERAL - 1);
        ctx.fillStyle = 'rgba(5,8,11,.78)';
        ctx.beginPath(); ctx.roundRect(p.x - tot / 2 - 2, p.y - 3 - ph / 2, tot + 4, ph + 4, 3); ctx.fill();
        for (let k = 0; k < MAX_SCV_PER_MINERAL; k++) {
          ctx.fillStyle = k < n ? (n >= MAX_SCV_PER_MINERAL ? '#ffc531' : '#3fe0d8') : 'rgba(255,255,255,.16)';
          ctx.fillRect(p.x - tot / 2 + k * (pw + gap), p.y - 1 - ph / 2, pw, ph);
        }
      }
      ctx.font = '700 11px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      for (const r of hs.refs) {
        const n = hs.gasCnt.get(r.id) || 0;
        const p = worldToScreen3D(r.x, r.y, (BUILDINGS.extractor.height || 42) + 26);
        const txt = `${n}/${MAX_SCV_PER_GAS}`;
        const tw = ctx.measureText(txt).width + 18;
        ctx.fillStyle = 'rgba(5,8,11,.85)';
        ctx.strokeStyle = n >= MAX_SCV_PER_GAS ? '#ffc531' : '#3ddc84';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(p.x - tw / 2, p.y - 9, tw, 17, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3ddc84';
        ctx.beginPath(); ctx.arc(p.x - tw / 2 + 7, p.y - 0.5, 3, 0, TAU); ctx.fill();
        ctx.fillStyle = n >= MAX_SCV_PER_GAS ? '#ffc531' : '#e8eef4';
        ctx.fillText(txt, p.x + 4, p.y + 3.5);
      }
      ctx.restore();
    }

    // Marqueurs d'ordres au sol projetés en 3D
    for (let i = orderMarkers.length - 1; i >= 0; i--) {
      const om = orderMarkers[i];
      om.life -= dt;
      if (om.life <= 0) { orderMarkers.splice(i, 1); continue; }
      const f = clamp(om.life / om.maxLife, 0, 1);
      const r = (5 + f * 20) * cam.z;
      const pt = worldToScreen3D(om.x, om.y, 3);
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.strokeStyle = om.color;
      ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * isoSin, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // Cercles de portée de construction / Scan Radar
    if (buildMode) {
      const def = BUILDINGS[buildMode];
      const check = canPlaceBuilding(state, myId, buildMode, mouse.wx, mouse.wy);
      const gx = check.snapX ?? mouse.wx, gy = check.snapY ?? mouse.wy;
      const pt = worldToScreen3D(gx, gy, 3);
      ctx.save();
      ctx.strokeStyle = check.ok ? '#2fbf71' : '#ff4b2b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y, (def.radius + 4) * cam.z, (def.radius + 4) * cam.z * isoSin, 0, 0, TAU);
      ctx.stroke();
      if (def.range) {
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, def.range * cam.z, def.range * cam.z * isoSin, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    } else if (orderCursor === 'scan') {
      const pt = worldToScreen3D(mouse.wx, mouse.wy, 4);
      const scanR = Math.round(380 * ((MAP_DEFS[activeMapId] || MAP_DEFS.vallee).scanRadiusMult || 1.0));
      ctx.save();
      ctx.strokeStyle = '#1fc7c1';
      ctx.fillStyle = 'rgba(31, 199, 193, 0.14)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y, scanR * cam.z, scanR * cam.z * isoSin, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Rectangle de sélection (Box Selection StarCraft)
    if (mouse.down && mouse.dragStart) {
      ctx.save();
      ctx.strokeStyle = '#2fbf71';
      ctx.fillStyle = 'rgba(47, 191, 113, 0.16)';
      ctx.lineWidth = 2;
      const rx = Math.min(mouse.dragStart.sx, mouse.x);
      const ry = Math.min(mouse.dragStart.sy, mouse.y);
      const rw = Math.abs(mouse.x - mouse.dragStart.sx);
      const rh = Math.abs(mouse.y - mouse.dragStart.sy);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }

    renderMinimap();
    return;
  }

  ctx.fillStyle = '#142818';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2 + shX, H / 2 + shY);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cam.x, -cam.y);

  if (terrainCanvas) ctx.drawImage(terrainCanvas, 0, 0, WORLD_SIZE, WORLD_SIZE);

  for (const c of craters) {
    ctx.fillStyle = 'rgba(18, 20, 26, 0.34)';
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
  }

  const curMapDef = MAP_DEFS[activeMapId] || MAP_DEFS.vallee;

  // Geysers de Gaz Plasma 3D
  for (const gey of GAS_GEYSERS) {
    ctx.save();
    ctx.translate(gey.x, gey.y);
    const rimCol = curMapDef.theme === 'volcanique' ? '#332428' : curMapDef.theme === 'cryo' ? '#26485e' : '#38463d';
    const topCol = curMapDef.theme === 'volcanique' ? '#4d2d34' : curMapDef.theme === 'cryo' ? '#376885' : '#4d5e52';
    drawPrism3D(ctx, gey.x, gey.y, makeNGon(26, 8), 0, 14, rimCol, topCol, false, 0.78);
    const oTop = project3DOffset(gey.x, gey.y, 14, false);
    ctx.fillStyle = '#101518';
    ctx.beginPath(); ctx.arc(oTop.ox, oTop.oy, 13, 0, TAU); ctx.fill();
    const pulse = 9 + Math.sin(now * 0.006 + gey.x) * 3;
    let plasmaGlow = 'rgba(47, 191, 113, 0.75)';
    if (curMapDef.theme === 'volcanique') plasmaGlow = 'rgba(255, 85, 0, 0.85)';
    else if (curMapDef.theme === 'cryo') plasmaGlow = 'rgba(0, 240, 255, 0.85)';
    ctx.fillStyle = plasmaGlow;
    ctx.beginPath(); ctx.arc(oTop.ox, oTop.oy, pulse, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Gisements de Minéraux 3D (Pyramides cristallines à facettes)
  for (const m of MINERAL_NODES) {
    if (!mineralAlive(state, m)) continue;
    const r = m.rich ? 21 : 17;
    let col = m.rich ? '#ffc531' : '#1fc7c1';
    if (curMapDef.theme === 'volcanique') col = m.rich ? '#ffd700' : '#ff4b2b';
    else if (curMapDef.theme === 'cryo') col = m.rich ? '#c084fc' : '#38bdf8';
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = m.rich ? 'rgba(255, 197, 49, 0.22)' : 'rgba(31, 199, 193, 0.22)';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, TAU); ctx.fill();
    drawPyramid3D(ctx, m.x, m.y, makeNGon(r, 6, 0.2), 0, m.rich ? 34 : 28, col, false);
    ctx.restore();
  }

  // Rochers 3D
  for (const rk of ROCKS) {
    ctx.save();
    ctx.translate(rk.x, rk.y);
    const rkCol = rk.col || (curMapDef.theme === 'volcanique' ? '#251c20' : curMapDef.theme === 'cryo' ? '#2b506b' : '#59544b');
    drawPrism3D(ctx, rk.x, rk.y, makeNGon(rk.r, 7, rk.seed), 0, 26, rkCol, shade(rkCol, 0.35), false, 0.72);
    ctx.restore();
  }

  // Connexions 3D des Murs voisins
  const walls = state.buildings.filter((b) => b.kind === 'wall' && b.hp > 0 && isVisibleToMe(b.x, b.y));
  ctx.strokeStyle = '#16181d'; ctx.lineWidth = 22;
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      if (walls[i].team === walls[j].team && dist2(walls[i].x, walls[i].y, walls[j].x, walls[j].y) <= 58 * 58) {
        const o1 = project3DOffset(walls[i].x, walls[i].y, 16, false);
        const o2 = project3DOffset(walls[j].x, walls[j].y, 16, false);
        ctx.beginPath(); ctx.moveTo(walls[i].x + o1.ox, walls[i].y + o1.oy); ctx.lineTo(walls[j].x + o2.ox, walls[j].y + o2.oy); ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = '#c8ba9b'; ctx.lineWidth = 14;
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      if (walls[i].team === walls[j].team && dist2(walls[i].x, walls[i].y, walls[j].x, walls[j].y) <= 58 * 58) {
        const o1 = project3DOffset(walls[i].x, walls[i].y, 16, false);
        const o2 = project3DOffset(walls[j].x, walls[j].y, 16, false);
        ctx.beginPath(); ctx.moveTo(walls[i].x + o1.ox, walls[i].y + o1.oy); ctx.lineTo(walls[j].x + o2.ox, walls[j].y + o2.oy); ctx.stroke();
      }
    }
  }

  // Points de Ralliement des bâtiments sélectionnés
  for (const b of state.buildings) {
    if (selectedBlds.has(b.id) && b.rallyX != null && b.rallyY != null && (BUILDINGS[b.kind]?.trains || []).length > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffc531';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.rallyX, b.rallyY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffc531';
      ctx.strokeStyle = '#16181d';
      ctx.beginPath(); ctx.arc(b.rallyX, b.rallyY, 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // Tri de profondeur 3D (Painter's Algorithm : Arbres 3D, Unités 3D et Bâtiments 3D triés par Y et distance au centre caméra)
  const renderList = [];
  const viewW = (W / cam.z) * 0.65, viewH = (H / cam.z) * 0.65;
  for (const tr of TREES_3D) {
    if (Math.abs(tr.x - cam.x) <= viewW && Math.abs(tr.y - cam.y) <= viewH) {
      renderList.push({ k: 'tree', y: tr.y, obj: tr });
    }
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.boardedIn) continue;
    if (u.owner !== myId && !isVisibleToMe(u.x, u.y)) continue;
    let sortY = u.y;
    if (u.kind === 'scv' && u.onSite && u.buildTargetId) {
      const tb = state.buildings.find((b) => b.id === u.buildTargetId && b.constructing);
      if (tb) sortY = Math.max(u.y, tb.y + 1);
    }
    renderList.push({ k: 'unit', y: sortY, obj: u });
  }
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    if (b.owner !== myId && !isVisibleToMe(b.x, b.y)) continue;
    renderList.push({ k: 'bld', y: b.y, obj: b });
  }
  renderList.sort((a, b) => a.y - b.y);

  for (const item of renderList) {
    if (item.k === 'tree') {
      drawTree3D(ctx, item.obj);
    } else if (item.k === 'unit') {
      const u = item.obj;
      const owner = state.players.find((p) => p.id === u.owner);
      drawUnit(ctx, u, owner ? pc(owner) : '#888', selectedUnits.has(u.id), now, false);
    } else {
      const b = item.obj;
      const owner = state.players.find((p) => p.id === b.owner);
      drawBuilding(ctx, b, owner ? pc(owner) : '#888', selectedBlds.has(b.id), now, false);
    }
  }

  // Projectiles, Ondes de choc & Éclairs
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.prog += pr.speed * dt;
    if (pr.prog >= 1) { projectiles.splice(i, 1); continue; }
    const px = lerp(pr.x, pr.tx, pr.prog), py = lerp(pr.y, pr.ty, pr.prog);
    const bx = lerp(pr.x, pr.tx, Math.max(0, pr.prog - 0.18)), by = lerp(pr.y, pr.ty, Math.max(0, pr.prog - 0.18));
    ctx.strokeStyle = pr.color; ctx.lineWidth = pr.r * 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = '#fff8ea';
    ctx.beginPath(); ctx.arc(px, py, pr.r * 0.7, 0, TAU); ctx.fill();
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.life -= dt;
    if (sw.life <= 0) { shockwaves.splice(i, 1); continue; }
    const u = 1 - sw.life / sw.maxLife;
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = sw.color; ctx.lineWidth = 4 * (1 - u) + 1;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, lerp(sw.r, sw.maxR, u), 0, TAU); ctx.stroke();
  }
  for (let i = beams.length - 1; i >= 0; i--) {
    const bm = beams[i];
    bm.life -= dt;
    if (bm.life <= 0) { beams.splice(i, 1); continue; }
    ctx.globalAlpha = clamp(bm.life / bm.maxLife, 0, 1);
    ctx.strokeStyle = bm.color; ctx.lineWidth = bm.w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1);
    if (bm.tesla) {
      for (let s = 1; s <= 3; s++) {
        const f = s / 4;
        ctx.lineTo(lerp(bm.x1, bm.x2, f) + (Math.random() - 0.5) * 32, lerp(bm.y1, bm.y2, f) + (Math.random() - 0.5) * 32);
      }
    }
    ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
  }
  ctx.restore();

  // Marqueurs d'ordres au sol façon StarCraft (anneau + 4 flèches convergentes)
  for (let i = orderMarkers.length - 1; i >= 0; i--) {
    const om = orderMarkers[i];
    om.life -= dt;
    if (om.life <= 0) { orderMarkers.splice(i, 1); continue; }
    const f = clamp(om.life / om.maxLife, 0, 1);
    const r = 5 + f * 20;
    ctx.save();
    ctx.translate(om.x, om.y);
    ctx.strokeStyle = om.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(r + 8, -4);
      ctx.lineTo(r + 2, 0);
      ctx.lineTo(r + 8, 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.fillStyle = pc(p); ctx.strokeStyle = '#16181d'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.stroke();
  }

  // Brouillard de Guerre (Fog of War)
  ctx.drawImage(fogSmooth, 0, 0, WORLD_SIZE, WORLD_SIZE);

  for (const sc of state.scans) {
    ctx.save();
    ctx.strokeStyle = '#1fc7c1'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
    ctx.beginPath(); ctx.arc(sc.x, sc.y, sc.r, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  if (state.phase === 4) {
    ctx.save();
    ctx.strokeStyle = '#ff4b2b'; ctx.lineWidth = 10; ctx.setLineDash([24, 14]);
    ctx.beginPath(); ctx.arc(HALF_W, HALF_W, state.stormRadius, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // Aperçu fantôme 3D du bâtiment à poser (uniquement quand un VCS est sélectionné)
  if (buildMode) {
    const def = BUILDINGS[buildMode];
    const check = canPlaceBuilding(state, myId, buildMode, mouse.wx, mouse.wy);
    const me = state.players.find((p) => p.id === myId);
    const gx = check.snapX ?? mouse.wx, gy = check.snapY ?? mouse.wy;
    ctx.save();
    if (def.range) {
      ctx.strokeStyle = check.ok ? '#2fbf71' : '#ff4b2b';
      ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(gx, gy, def.range, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 0.74;
    drawBuilding(ctx, { kind: buildMode, x: gx, y: gy, radius: def.radius, hp: def.hp, maxHp: def.hp, aimA: 0 }, check.ok ? (me ? pc(me) : '#2fbf71') : '#ff4b2b', false, now, false);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = check.ok ? '#2fbf71' : '#ff4b2b';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(gx, gy, def.radius + 4, 0, TAU); ctx.stroke();
    ctx.restore();
  } else if (orderCursor === 'scan') {
    const scanR = Math.round(380 * ((MAP_DEFS[activeMapId] || MAP_DEFS.vallee).scanRadiusMult || 1.0));
    ctx.save();
    ctx.strokeStyle = '#1fc7c1'; ctx.fillStyle = 'rgba(31, 199, 193, 0.15)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mouse.wx, mouse.wy, scanR, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  if (mouse.down && mouse.dragStart) {
    ctx.save();
    ctx.strokeStyle = '#2fbf71';
    ctx.fillStyle = 'rgba(47, 191, 113, 0.16)';
    ctx.lineWidth = 2 / cam.z;
    const rx = Math.min(mouse.dragStart.wx, mouse.wx);
    const ry = Math.min(mouse.dragStart.wy, mouse.wy);
    const rw = Math.abs(mouse.wx - mouse.dragStart.wx);
    const rh = Math.abs(mouse.wy - mouse.dragStart.wy);
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  }

  ctx.restore();
  renderMinimap();
}

let lastMiniFrame = 0;
let miniBase = null;
function renderMinimap() {
  if (!state) return;
  const nowT = performance.now();
  const mdt = clamp((nowT - (lastMiniFrame || nowT)) / 1000, 0, 0.1);
  lastMiniFrame = nowT;
  const mw = miniCvs.width, mh = miniCvs.height;
  const sx = mw / WORLD_SIZE, sy = mh / WORLD_SIZE;
  const mc = miniCtx;
  mc.setTransform(1, 0, 0, 1, 0, 0);
  if (terrainCanvas && (!miniBase || miniBase.src !== terrainCanvas || miniBase.c.width !== mw)) {
    const c = document.createElement('canvas');
    c.width = mw; c.height = mh;
    c.getContext('2d').drawImage(terrainCanvas, 0, 0, mw, mh);
    miniBase = { src: terrainCanvas, c };
  }
  if (miniBase) mc.drawImage(miniBase.c, 0, 0);

  const curMapDef = MAP_DEFS[activeMapId] || MAP_DEFS.vallee;
  for (const m of MINERAL_NODES) {
    if (!mineralAlive(state, m)) continue;
    let col = m.rich ? '#ffc531' : '#1fc7c1';
    if (curMapDef.theme === 'volcanique') col = m.rich ? '#ffd700' : '#ff5522';
    else if (curMapDef.theme === 'cryo') col = m.rich ? '#c084fc' : '#38bdf8';
    mc.fillStyle = col;
    mc.fillRect(m.x * sx - 2, m.y * sy - 2, 4, 4);
  }
  // Brouillard : le relief reste deviné sous les zones inexplorées
  mc.globalAlpha = 0.82;
  mc.drawImage(fogSmooth || fogCanvas, 0, 0, mw, mh);
  mc.globalAlpha = 1;

  const me = state.players.find((p) => Number(p.id) === Number(myId));
  const colorOf = (owner) => {
    const pl = state.players.find((p) => p.id === owner);
    return pl ? pc(pl) : '#fff';
  };
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    if (b.owner !== myId && !isVisibleToMe(b.x, b.y)) continue;
    const sz = b.kind === 'hq' ? 13 : b.kind === 'wall' ? 5 : 8;
    mc.fillStyle = '#05080b';
    mc.fillRect(b.x * sx - sz / 2 - 1.5, b.y * sy - sz / 2 - 1.5, sz + 3, sz + 3);
    mc.fillStyle = colorOf(b.owner);
    mc.fillRect(b.x * sx - sz / 2, b.y * sy - sz / 2, sz, sz);
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.boardedIn) continue;
    if (u.owner !== myId && !isVisibleToMe(u.x, u.y)) continue;
    const sz = u.kind === 'scv' ? 4 : 5.5;
    mc.fillStyle = colorOf(u.owner);
    mc.fillRect(u.x * sx - sz / 2, u.y * sy - sz / 2, sz, sz);
    if (me && u.team !== me.team) {
      mc.strokeStyle = 'rgba(0,0,0,.7)'; mc.lineWidth = 1;
      mc.strokeRect(u.x * sx - sz / 2, u.y * sy - sz / 2, sz, sz);
    }
  }
  // Unités sélectionnées : surlignées en blanc
  for (const u of state.units) {
    if (!selectedUnits.has(u.id) || u.hp <= 0) continue;
    mc.strokeStyle = '#ffffff'; mc.lineWidth = 1.6;
    mc.strokeRect(u.x * sx - 4, u.y * sy - 4, 8, 8);
  }

  // Dernier ordre envoyé depuis la minimap : trait en pointillés de l'escouade vers la cible
  if (lastMiniOrder) {
    lastMiniOrder.life -= mdt;
    if (lastMiniOrder.life <= 0) lastMiniOrder = null;
    else {
      const f = clamp(lastMiniOrder.life / lastMiniOrder.maxLife, 0, 1);
      mc.save();
      mc.globalAlpha = Math.min(1, f * 1.6);
      mc.strokeStyle = lastMiniOrder.color;
      mc.lineWidth = 3;
      mc.setLineDash([9, 7]);
      mc.lineDashOffset = -nowT * 0.04;
      mc.beginPath();
      mc.moveTo(lastMiniOrder.fx * sx, lastMiniOrder.fy * sy);
      mc.lineTo(lastMiniOrder.x * sx, lastMiniOrder.y * sy);
      mc.stroke();
      mc.restore();
    }
  }
  // Signaux (ordres, alertes, détections) : anneaux qui se contractent + réticule
  for (let i = miniPings.length - 1; i >= 0; i--) {
    const pg = miniPings[i];
    pg.life -= mdt;
    if (pg.life <= 0) { miniPings.splice(i, 1); continue; }
    const f = clamp(pg.life / pg.maxLife, 0, 1);
    const x = pg.x * sx, y = pg.y * sy;
    const base = pg.big ? 10 : 7;
    mc.save();
    mc.strokeStyle = pg.color;
    mc.globalAlpha = Math.min(1, f * 1.8);
    mc.lineWidth = 3;
    mc.beginPath(); mc.arc(x, y, base + f * (pg.big ? 30 : 22), 0, TAU); mc.stroke();
    mc.lineWidth = 2.4;
    mc.beginPath(); mc.arc(x, y, base * 0.6, 0, TAU); mc.stroke();
    mc.beginPath();
    mc.moveTo(x - base * 1.4, y); mc.lineTo(x - base * 0.6, y);
    mc.moveTo(x + base * 0.6, y); mc.lineTo(x + base * 1.4, y);
    mc.moveTo(x, y - base * 1.4); mc.lineTo(x, y - base * 0.6);
    mc.moveTo(x, y + base * 0.6); mc.lineTo(x, y + base * 1.4);
    mc.stroke();
    mc.restore();
  }

  // Cadre de la caméra
  const isoSin = Math.sin(((cam.pitch || 70) * Math.PI) / 180);
  const vw = (W / cam.z) * sx, vh = ((H / cam.z) / isoSin) * sy;
  mc.strokeStyle = 'rgba(255,255,255,.9)';
  mc.lineWidth = 2;
  mc.strokeRect(cam.x * sx - vw / 2, cam.y * sy - vh / 2, vw, vh);
}
