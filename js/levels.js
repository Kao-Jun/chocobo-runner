/* =====================================================================
   Chocobo Runner — Module Levels
   Palettes ENV × 3, fonctions de dessin par niveau, registre et dispatchers.
   Pattern : setRenderCtx({ ctx, SC, airship, frame }) avant chaque frame.
   ===================================================================== */
var CR = CR || {};
CR.Levels = (function () {

  /* ---- render context (mis à jour chaque frame depuis game.js) ---- */
  let _ctx, _SC, _airship, _frame;
  function setRenderCtx(rc) { _ctx = rc.ctx; _SC = rc.SC; _airship = rc.airship; _frame = rc.frame; }

  /* ---- utilitaires canvas (locaux au module) ---- */
  function poly(pts) { _ctx.beginPath(); _ctx.moveTo(pts[0],pts[1]); for(let i=2;i<pts.length;i+=2) _ctx.lineTo(pts[i],pts[i+1]); _ctx.closePath(); }
  function stroke(c, lw) { _ctx.lineJoin='round'; _ctx.lineCap='round'; _ctx.strokeStyle=c; _ctx.lineWidth=lw; _ctx.stroke(); }
  function roundRect(x,y,w,h,r){ _ctx.beginPath(); _ctx.moveTo(x+r,y); _ctx.arcTo(x+w,y,x+w,y+h,r); _ctx.arcTo(x+w,y+h,x,y+h,r); _ctx.arcTo(x,y+h,x,y,r); _ctx.arcTo(x,y,x+w,y,r); _ctx.closePath(); }

  /* ============================================================
     PALETTES
     ============================================================ */
  const ENV = {
    out:'#2c2140',
    sky:['#241e4a','#5a3f8c','#b5638f','#f2a85f'],
    sun:'#fff1cc', sunGlow:'rgba(255,214,138,.45)',
    cloud:'#f7d9c4', cloudLit:'#fff0e2',
    mtnBack:'#6a5a9a', mtnBackSh:'#544a82', snow:'#e7def5', snowSh:'#bcb0dd',
    mtnFront:'#4f4880', mtnFrontSh:'#3c3666',
    castle:'#5b5374', castleSh:'#443d5b', roof:'#e3bb4d', roofSh:'#c0962c', glow:'#ffe7a4',
    crystal:'#bdf3ff', crystalMid:'#5fc6e6', crystalSh:'#2f93c2', crystalGlow:'rgba(150,235,255,.5)',
    hill:'#3f8a55', hillLit:'#5fae6f', hillSh:'#2f6b41', hillRim:'#9be0a6',
    ground:'#3f7a4a', groundTop:'#2c5e39', tuft:'#74bd84', dirt:'#6b4a2a',
    trunk:'#5a3a1c', leaf:'#3aa05a', leafLit:'#5fc078', leafSh:'#2c7d46',
  };

  const ENV_FOREST = {
    out:'#0f1a0f',
    sky:['#0b1f0e','#1a3d20','#2d6e3a','#4a8f52'],
    cloud:'#c8e8c8', cloudLit:'#e8f8e8',
    canopyFar:'#1a3a1a', canopyFarSh:'#0f2a0f',
    canopyMid:'#2a4a2a', canopyMidSh:'#1a341a',
    treeTrunk:'#2a1a0a', treeLeaf:'#2a6a1a', treeLeafLit:'#4a9a2a', treeLeafSh:'#1a4a0a',
    ground:'#2a1a08', groundTop:'#1a3a0a', tuft:'#3a7a1a',
    fern:'#1a5a1a', fernLit:'#3a8a2a',
  };

  const ENV_DESERT = {
    out:'#1a0f00',
    sky:['#1a0a2a','#6b2a0a','#e87030','#f5c060'],
    sun:'#ff9020', sunGlow:'rgba(255,160,40,.5)',
    cloud:'#f5d0a0', cloudLit:'#fff0d0',
    duneBack:'#c8903a', duneBackSh:'#8a5a14',
    duneFront:'#e0b050', duneFrontSh:'#b07820',
    palmTrunk:'#5a3a10', palmLeaf:'#2a7a1a', palmLeafLit:'#4aaa28', palmLeafSh:'#1a5010',
    ruin:'#8a7050', ruinSh:'#5a4830', ruinLit:'#c0a878',
    ground:'#c8903a', groundTop:'#b07828', ripple:'#a06820',
    sand:'#e0b850',
  };

  /* ============================================================
     NIVEAU 1 — TERRES DE CRISTAL
     ============================================================ */
  function toonCloud(x, y, s) {
    _ctx.fillStyle = ENV.cloud;
    _ctx.beginPath();
    _ctx.arc(x, y, s*0.5, 0, 7); _ctx.arc(x+s*0.5, y+s*0.08, s*0.42, 0, 7);
    _ctx.arc(x+s*0.95, y, s*0.36, 0, 7); _ctx.arc(x+s*0.45, y-s*0.18, s*0.34, 0, 7);
    _ctx.fill();
    _ctx.fillStyle = ENV.cloudLit;
    _ctx.beginPath(); _ctx.ellipse(x+s*0.4, y-s*0.18, s*0.5, s*0.16, 0, 0, 7); _ctx.fill();
  }

  function drawRange(scroll, gy, tw, th, base, shadow, snow, vw, outColor) {
    const oc = outColor || ENV.out;
    const off = scroll % tw;
    for (let i=-1; i*tw - off < vw + tw; i++) {
      const x = i*tw - off, peak = x + tw*0.5;
      _ctx.fillStyle = base; poly([x, gy, peak, gy-th, x+tw, gy]); _ctx.fill();
      _ctx.fillStyle = shadow; poly([peak, gy-th, x+tw, gy, peak, gy]); _ctx.fill();
      poly([x, gy, peak, gy-th, x+tw, gy]); stroke(oc, 2);
      if (snow) {
        const cap = th*0.26;
        _ctx.fillStyle = ENV.snow;
        poly([peak-cap*0.7, gy-th+cap, peak, gy-th, peak+cap*0.7, gy-th+cap, peak+cap*0.3, gy-th+cap*1.4, peak, gy-th+cap*0.9, peak-cap*0.3, gy-th+cap*1.4]); _ctx.fill();
        _ctx.fillStyle = ENV.snowSh;
        poly([peak, gy-th, peak+cap*0.7, gy-th+cap, peak+cap*0.3, gy-th+cap*1.4, peak, gy-th+cap*0.9]); _ctx.fill();
      }
    }
  }

  function drawCastle(x, gy, anim) {
    const u = _SC;
    _ctx.fillStyle = ENV.castle; _ctx.fillRect(x, gy-92*u, 94*u, 92*u);
    _ctx.fillStyle = ENV.castleSh; _ctx.fillRect(x+60*u, gy-92*u, 34*u, 92*u);
    roundRect(x, gy-92*u, 94*u, 92*u, 2); stroke(ENV.out, 2);
    for (const tx of [x-16*u, x+94*u]) {
      _ctx.fillStyle = ENV.castle; _ctx.fillRect(tx, gy-72*u, 16*u, 72*u);
      _ctx.fillStyle = ENV.castleSh; _ctx.fillRect(tx+10*u, gy-72*u, 6*u, 72*u);
      _ctx.fillStyle = ENV.roof; poly([tx-3*u, gy-72*u, tx+8*u, gy-92*u, tx+19*u, gy-72*u]); _ctx.fill(); stroke(ENV.out, 2);
    }
    _ctx.fillStyle = ENV.castle; _ctx.fillRect(x+32*u, gy-132*u, 30*u, 44*u);
    _ctx.fillStyle = ENV.castleSh; _ctx.fillRect(x+50*u, gy-132*u, 12*u, 44*u);
    _ctx.fillStyle = ENV.roof; poly([x+28*u, gy-132*u, x+47*u, gy-162*u, x+66*u, gy-132*u]); _ctx.fill();
    _ctx.fillStyle = ENV.roofSh; poly([x+47*u, gy-162*u, x+66*u, gy-132*u, x+47*u, gy-132*u]); _ctx.fill();
    poly([x+28*u, gy-132*u, x+47*u, gy-162*u, x+66*u, gy-132*u]); stroke(ENV.out, 2);
    _ctx.fillStyle = ENV.castle;
    for (let i=0;i<5;i++) _ctx.fillRect(x+6*u+i*18*u, gy-100*u, 10*u, 10*u);
    const glow = 0.6 + 0.4*Math.sin(anim*0.05);
    _ctx.fillStyle = `rgba(255,231,164,${glow})`;
    _ctx.fillRect(x+42*u, gy-118*u, 10*u, 16*u);
    _ctx.fillRect(x+18*u, gy-58*u, 9*u, 14*u);
    _ctx.fillRect(x+64*u, gy-58*u, 9*u, 14*u);
  }

  function drawCrystal(x, y, s, anim, idx) {
    const bob = Math.sin(anim*0.045 + idx*1.7) * 6 * _SC;
    y += bob;
    _ctx.save();
    _ctx.fillStyle = ENV.crystalGlow;
    _ctx.beginPath(); _ctx.arc(x, y, 30*s, 0, 7); _ctx.fill();
    const top=y-34*s, bot=y+32*s;
    _ctx.fillStyle = ENV.crystalMid;
    poly([x, top, x+17*s, y-6*s, x+11*s, bot, x-11*s, bot, x-17*s, y-6*s]); _ctx.fill();
    _ctx.fillStyle = ENV.crystalSh;
    poly([x, top, x+17*s, y-6*s, x+11*s, bot, x, y]); _ctx.fill();
    _ctx.fillStyle = ENV.crystal;
    poly([x, top, x-17*s, y-6*s, x-11*s, bot, x, y]); _ctx.fill();
    _ctx.fillStyle = 'rgba(255,255,255,.7)';
    poly([x, top, x-9*s, y-4*s, x-3*s, y]); _ctx.fill();
    poly([x, top, x+17*s, y-6*s, x+11*s, bot, x-11*s, bot, x-17*s, y-6*s]); stroke(ENV.out, 2);
    _ctx.restore();
  }

  function drawAirship(x, y, anim) {
    const u = _SC, bob = Math.sin(anim*0.04)*4*u; y += bob;
    _ctx.save(); _ctx.translate(x, y);
    _ctx.fillStyle = '#b3414f'; _ctx.beginPath(); _ctx.ellipse(64*u, 0, 64*u, 26*u, 0, 0, 7); _ctx.fill();
    _ctx.fillStyle = '#7e2c38'; _ctx.beginPath(); _ctx.ellipse(64*u, 8*u, 64*u, 18*u, 0, 0.15, Math.PI-0.15); _ctx.fill();
    _ctx.fillStyle = '#e8e2d2'; _ctx.beginPath(); _ctx.ellipse(64*u, -8*u, 60*u, 12*u, 0, 0, 7); _ctx.fill();
    _ctx.beginPath(); _ctx.ellipse(64*u,0,64*u,26*u,0,0,7); stroke('#2c2140', 2);
    _ctx.fillStyle = '#6b4a2a'; roundRect(34*u, 22*u, 64*u, 16*u, 4*u); _ctx.fill(); stroke('#2c2140',2);
    _ctx.fillStyle = '#d8b15a'; poly([42*u,22*u, 42*u,4*u, 60*u,22*u]); _ctx.fill(); stroke('#2c2140',2);
    _ctx.restore();
  }

  function drawHills(scroll, gy, vw, vh) {
    const tw = 260*_SC, off = scroll % tw;
    for (let i=-1; i*tw - off < vw + tw; i++) {
      const x = i*tw - off;
      _ctx.fillStyle = ENV.hill;
      _ctx.beginPath(); _ctx.ellipse(x + tw*0.5, gy + 36*_SC, tw*0.62, 64*_SC, 0, Math.PI, 0); _ctx.fill();
      _ctx.fillStyle = ENV.hillRim;
      _ctx.beginPath(); _ctx.ellipse(x + tw*0.5, gy + 36*_SC, tw*0.62, 64*_SC, 0, Math.PI*1.15, Math.PI*1.85); _ctx.fill();
      drawTree(x + tw*0.78, gy);
    }
  }

  function drawTree(x, gy) {
    const u = _SC;
    _ctx.fillStyle = ENV.trunk; _ctx.fillRect(x-4*u, gy-30*u, 8*u, 32*u);
    roundRect(x-4*u, gy-30*u, 8*u, 32*u, 2); stroke(ENV.out, 2);
    _ctx.fillStyle = ENV.leaf;
    _ctx.beginPath(); _ctx.arc(x, gy-40*u, 20*u, 0, 7); _ctx.arc(x-12*u, gy-34*u, 13*u, 0, 7); _ctx.arc(x+12*u, gy-36*u, 13*u, 0, 7); _ctx.fill();
    _ctx.fillStyle = ENV.leafSh;
    _ctx.beginPath(); _ctx.arc(x+7*u, gy-34*u, 14*u, 0, 7); _ctx.fill();
    _ctx.fillStyle = ENV.leafLit;
    _ctx.beginPath(); _ctx.arc(x-7*u, gy-46*u, 9*u, 0, 7); _ctx.fill();
    _ctx.beginPath(); _ctx.arc(x, gy-40*u, 20*u, 0, 7); _ctx.arc(x-12*u, gy-34*u, 13*u, 0, 7); _ctx.arc(x+12*u, gy-36*u, 13*u, 0, 7); stroke(ENV.out, 2);
  }

  function drawFeather(x, y, r, rot) {
    _ctx.save(); _ctx.translate(x, y); _ctx.rotate(Math.sin(rot)*0.6);
    _ctx.fillStyle = 'rgba(255,228,150,.55)';
    _ctx.beginPath(); _ctx.ellipse(0,0,r,r*0.42,0,0,7); _ctx.fill();
    _ctx.restore();
  }

  function drawBg1(vw, vh, gy, w) {
    const sky = _ctx.createLinearGradient(0,0,0,gy+20);
    sky.addColorStop(0, ENV.sky[0]); sky.addColorStop(0.42, ENV.sky[1]);
    sky.addColorStop(0.72, ENV.sky[2]); sky.addColorStop(1, ENV.sky[3]);
    _ctx.fillStyle = sky; _ctx.fillRect(0,0,vw,gy+20);

    const sx = vw*0.74, sy = vh*0.26;
    _ctx.fillStyle = ENV.sunGlow; _ctx.beginPath(); _ctx.arc(sx, sy, 58*_SC+18, 0, 7); _ctx.fill();
    _ctx.fillStyle = ENV.sun;     _ctx.beginPath(); _ctx.arc(sx, sy, 40*_SC+8, 0, 7); _ctx.fill();
    _ctx.strokeStyle = 'rgba(255,255,255,.4)'; _ctx.lineWidth = 2; _ctx.stroke();

    const co = (w.scroll*0.05) % (vw+260);
    for (let k=0;k<3;k++){
      const cx = ((k*340 - co) % (vw+260) + (vw+260)) % (vw+260) - 130;
      toonCloud(cx, vh*(0.16 + k*0.07), (70 + k*12)*_SC);
    }

    drawRange(w.scroll*0.10, gy, 300*_SC, 150*_SC, ENV.mtnBack, ENV.mtnBackSh, true, vw, ENV.out);
    drawRange(w.scroll*0.18, gy, 230*_SC, 118*_SC, ENV.mtnFront, ENV.mtnFrontSh, true, vw, ENV.out);

    const off2 = (w.scroll*0.34) % (520*_SC);
    for (let i=-1; i*520*_SC - off2 < vw + 520*_SC; i++) {
      const bx = i*520*_SC - off2;
      drawCastle(bx + 80*_SC, gy, w.anim);
      drawCrystal(bx + 360*_SC, gy - 150*_SC, 1.0*_SC, w.anim, i*2);
      drawCrystal(bx + 290*_SC, gy - 205*_SC, 0.7*_SC, w.anim, i*2+1);
    }

    drawAirship(_airship.x, vh*0.18 + (_airship.y-50)*0.4, w.anim);
    drawHills(w.scroll*0.55, gy, vw, vh);
    for (const f of w.feathers) drawFeather(f.x, f.y, f.r, f.sway);
  }

  function drawGround1(vw, vh, gy, w) {
    _ctx.fillStyle = ENV.ground; _ctx.fillRect(0, gy, vw, vh-gy);
    _ctx.fillStyle = ENV.groundTop; _ctx.fillRect(0, gy, vw, 7*_SC);
    _ctx.fillStyle = ENV.dirt;
    const off = w.scroll % (44*_SC);
    for (let x=-off; x<vw; x+=44*_SC) { roundRect(x, gy+18*_SC, 9*_SC, 5*_SC, 2); _ctx.fill(); }
    _ctx.strokeStyle = ENV.tuft; _ctx.lineWidth = 2*_SC; _ctx.lineCap='round';
    for (let x=-off; x<vw; x+=44*_SC) {
      _ctx.beginPath(); _ctx.moveTo(x+22*_SC, gy+8*_SC); _ctx.lineTo(x+22*_SC, gy+1*_SC);
      _ctx.moveTo(x+26*_SC, gy+8*_SC); _ctx.lineTo(x+28*_SC, gy+2*_SC); _ctx.stroke();
    }
  }

  /* ============================================================
     NIVEAU 2 — FORÊT
     ============================================================ */
  function toonCloudForest(x, y, s) {
    _ctx.fillStyle = ENV_FOREST.cloud;
    _ctx.beginPath();
    _ctx.arc(x, y, s*0.5, 0, 7); _ctx.arc(x+s*0.5, y+s*0.08, s*0.42, 0, 7);
    _ctx.arc(x+s*0.95, y, s*0.36, 0, 7); _ctx.arc(x+s*0.45, y-s*0.18, s*0.34, 0, 7);
    _ctx.fill();
    _ctx.fillStyle = ENV_FOREST.cloudLit;
    _ctx.beginPath(); _ctx.ellipse(x+s*0.4, y-s*0.18, s*0.5, s*0.16, 0, 0, 7); _ctx.fill();
  }

  function drawBigTree(x, gy) {
    const u = _SC;
    _ctx.fillStyle = ENV_FOREST.treeTrunk; _ctx.fillRect(x-7*u, gy-58*u, 14*u, 60*u);
    roundRect(x-7*u, gy-58*u, 14*u, 60*u, 2); stroke(ENV_FOREST.out, 2);
    _ctx.fillStyle = ENV_FOREST.treeLeaf;
    _ctx.beginPath();
    _ctx.arc(x, gy-74*u, 34*u, 0, 7); _ctx.arc(x-22*u, gy-62*u, 23*u, 0, 7); _ctx.arc(x+22*u, gy-64*u, 23*u, 0, 7);
    _ctx.fill();
    _ctx.fillStyle = ENV_FOREST.treeLeafSh;
    _ctx.beginPath(); _ctx.arc(x+13*u, gy-62*u, 24*u, 0, 7); _ctx.fill();
    _ctx.fillStyle = ENV_FOREST.treeLeafLit;
    _ctx.beginPath(); _ctx.arc(x-11*u, gy-82*u, 15*u, 0, 7); _ctx.fill();
    _ctx.beginPath();
    _ctx.arc(x, gy-74*u, 34*u, 0, 7); _ctx.arc(x-22*u, gy-62*u, 23*u, 0, 7); _ctx.arc(x+22*u, gy-64*u, 23*u, 0, 7);
    stroke(ENV_FOREST.out, 2);
  }

  function drawFernClump(x, gy) {
    const u = _SC;
    for (let i = -2; i <= 2; i++) {
      const angle = i * 0.4;
      _ctx.strokeStyle = i % 2 === 0 ? ENV_FOREST.fern : ENV_FOREST.fernLit;
      _ctx.lineWidth = 2*u; _ctx.lineCap = 'round';
      _ctx.beginPath();
      _ctx.moveTo(x, gy);
      _ctx.quadraticCurveTo(x + Math.sin(angle)*18*u, gy-18*u, x + Math.sin(angle)*30*u, gy-36*u);
      _ctx.stroke();
      _ctx.fillStyle = i % 2 === 0 ? ENV_FOREST.fern : ENV_FOREST.fernLit;
      for (let j = 1; j <= 3; j++) {
        const t = j / 4;
        const lx = x + Math.sin(angle)*30*u*t, ly = gy - 36*u*t;
        _ctx.save(); _ctx.translate(lx, ly); _ctx.rotate(angle - 0.5);
        _ctx.beginPath(); _ctx.ellipse(0, 0, 7*u, 3*u, 0, 0, 7); _ctx.fill();
        _ctx.restore();
      }
    }
  }

  function drawForestHills(scroll, gy, vw, vh) {
    const tw = 260*_SC, off = scroll % tw;
    for (let i=-1; i*tw - off < vw + tw; i++) {
      const x = i*tw - off;
      _ctx.fillStyle = ENV_FOREST.canopyMid;
      _ctx.beginPath(); _ctx.ellipse(x + tw*0.5, gy + 36*_SC, tw*0.62, 64*_SC, 0, Math.PI, 0); _ctx.fill();
      _ctx.fillStyle = ENV_FOREST.treeLeafLit;
      _ctx.beginPath(); _ctx.ellipse(x + tw*0.5, gy + 36*_SC, tw*0.62, 64*_SC, 0, Math.PI*1.15, Math.PI*1.85); _ctx.fill();
      drawBigTree(x + tw*0.78, gy);
    }
  }

  function drawBg2(vw, vh, gy, w) {
    const sky = _ctx.createLinearGradient(0,0,0,gy+20);
    sky.addColorStop(0, ENV_FOREST.sky[0]); sky.addColorStop(0.4, ENV_FOREST.sky[1]);
    sky.addColorStop(0.75, ENV_FOREST.sky[2]); sky.addColorStop(1, ENV_FOREST.sky[3]);
    _ctx.fillStyle = sky; _ctx.fillRect(0,0,vw,gy+20);

    _ctx.save();
    _ctx.globalAlpha = 0.06;
    _ctx.fillStyle = '#a0ff80';
    for (let i = 0; i < 7; i++) {
      const x0 = vw * 0.55 + (i * 68 - 170) * _SC;
      _ctx.beginPath();
      _ctx.moveTo(x0 - 18*_SC, 0); _ctx.lineTo(x0 + 18*_SC, 0);
      _ctx.lineTo(x0 + 55*_SC, gy); _ctx.lineTo(x0 + 15*_SC, gy);
      _ctx.closePath(); _ctx.fill();
    }
    _ctx.globalAlpha = 1; _ctx.restore();

    const co = (w.scroll*0.05) % (vw+260);
    for (let k=0;k<3;k++){
      const cx = ((k*340 - co) % (vw+260) + (vw+260)) % (vw+260) - 130;
      toonCloudForest(cx, vh*(0.16 + k*0.07), (70 + k*12)*_SC);
    }

    drawRange(w.scroll*0.10, gy, 300*_SC, 150*_SC, ENV_FOREST.canopyFar, ENV_FOREST.canopyFarSh, false, vw, ENV_FOREST.out);
    drawRange(w.scroll*0.18, gy, 230*_SC, 118*_SC, ENV_FOREST.canopyMid, ENV_FOREST.canopyMidSh, false, vw, ENV_FOREST.out);

    const off2 = (w.scroll*0.34) % (520*_SC);
    for (let i=-1; i*520*_SC - off2 < vw + 520*_SC; i++) {
      const bx = i*520*_SC - off2;
      drawBigTree(bx + 60*_SC, gy);
      drawBigTree(bx + 200*_SC, gy);
      drawFernClump(bx + 390*_SC, gy);
      drawBigTree(bx + 450*_SC, gy);
    }

    drawAirship(_airship.x, vh*0.18 + (_airship.y-50)*0.4, w.anim);
    drawForestHills(w.scroll*0.55, gy, vw, vh);
    for (const f of w.feathers) drawFeather(f.x, f.y, f.r, f.sway);
  }

  function drawGround2(vw, vh, gy, w) {
    _ctx.fillStyle = ENV_FOREST.ground; _ctx.fillRect(0, gy, vw, vh-gy);
    _ctx.fillStyle = ENV_FOREST.groundTop; _ctx.fillRect(0, gy, vw, 7*_SC);
    const off = w.scroll % (44*_SC);
    for (let x=-off; x<vw; x+=44*_SC) {
      _ctx.save(); _ctx.translate(x+22*_SC, gy+14*_SC); _ctx.rotate(0.4);
      _ctx.fillStyle = '#5a3010';
      _ctx.beginPath(); _ctx.ellipse(0, 0, 8*_SC, 4*_SC, 0, 0, 7); _ctx.fill();
      _ctx.restore();
      _ctx.save(); _ctx.translate(x+8*_SC, gy+20*_SC); _ctx.rotate(-0.6);
      _ctx.fillStyle = '#3a2008';
      _ctx.beginPath(); _ctx.ellipse(0, 0, 6*_SC, 3*_SC, 0, 0, 7); _ctx.fill();
      _ctx.restore();
    }
    _ctx.strokeStyle = ENV_FOREST.tuft; _ctx.lineWidth = 2*_SC; _ctx.lineCap='round';
    for (let x=-off; x<vw; x+=44*_SC) {
      _ctx.beginPath();
      _ctx.moveTo(x+22*_SC, gy+8*_SC); _ctx.lineTo(x+22*_SC, gy+1*_SC);
      _ctx.moveTo(x+26*_SC, gy+8*_SC); _ctx.lineTo(x+30*_SC, gy+1*_SC);
      _ctx.moveTo(x+18*_SC, gy+8*_SC); _ctx.lineTo(x+15*_SC, gy+2*_SC);
      _ctx.stroke();
    }
  }

  /* ============================================================
     NIVEAU 3 — DÉSERT
     ============================================================ */
  function toonCloudDesert(x, y, s) {
    _ctx.fillStyle = ENV_DESERT.cloud;
    _ctx.beginPath();
    _ctx.arc(x, y, s*0.5, 0, 7); _ctx.arc(x+s*0.5, y+s*0.08, s*0.42, 0, 7);
    _ctx.arc(x+s*0.95, y, s*0.36, 0, 7); _ctx.arc(x+s*0.45, y-s*0.18, s*0.34, 0, 7);
    _ctx.fill();
    _ctx.fillStyle = ENV_DESERT.cloudLit;
    _ctx.beginPath(); _ctx.ellipse(x+s*0.4, y-s*0.18, s*0.5, s*0.16, 0, 0, 7); _ctx.fill();
  }

  function drawPalm(x, gy) {
    const u = _SC;
    _ctx.fillStyle = ENV_DESERT.palmTrunk;
    _ctx.beginPath();
    _ctx.moveTo(x-3*u, gy);
    _ctx.quadraticCurveTo(x-9*u, gy-24*u, x-2*u, gy-48*u);
    _ctx.quadraticCurveTo(x+5*u, gy-24*u, x+7*u, gy);
    _ctx.closePath(); _ctx.fill();
    const leafBase = { x: x-2*u, y: gy-48*u };
    const leaves = [[-1,-1],[-.3,-1.2],[.5,-1.1],[1.1,-.5],[-.8,.2]];
    for (const [dx, dy] of leaves) {
      _ctx.fillStyle = ENV_DESERT.palmLeaf;
      _ctx.beginPath();
      _ctx.moveTo(leafBase.x, leafBase.y);
      _ctx.quadraticCurveTo(leafBase.x+dx*14*u, leafBase.y+dy*10*u, leafBase.x+dx*28*u, leafBase.y+dy*18*u);
      _ctx.quadraticCurveTo(leafBase.x+dx*14*u, leafBase.y+dy*14*u, leafBase.x, leafBase.y);
      _ctx.fill();
    }
    _ctx.fillStyle = ENV_DESERT.palmLeafLit;
    _ctx.beginPath();
    _ctx.moveTo(leafBase.x, leafBase.y);
    _ctx.quadraticCurveTo(leafBase.x-14*u, leafBase.y-10*u, leafBase.x-28*u, leafBase.y-18*u);
    _ctx.quadraticCurveTo(leafBase.x-10*u, leafBase.y-12*u, leafBase.x, leafBase.y);
    _ctx.fill();
  }

  function drawRuin(x, gy) {
    const u = _SC;
    const cols = [[0,72],[28,55],[54,80],[82,62]];
    for (const [ox, oh] of cols) {
      _ctx.fillStyle = ENV_DESERT.ruin;
      _ctx.fillRect(x+ox*u, gy-oh*u, 12*u, oh*u);
      _ctx.fillStyle = ENV_DESERT.ruinSh;
      _ctx.fillRect(x+ox*u+8*u, gy-oh*u, 4*u, oh*u);
      roundRect(x+ox*u, gy-oh*u, 12*u, oh*u, 1); stroke(ENV_DESERT.out, 2);
      _ctx.fillStyle = ENV_DESERT.ruinLit;
      _ctx.fillRect(x+ox*u-3*u, gy-oh*u, 18*u, 8*u);
      roundRect(x+ox*u-3*u, gy-oh*u, 18*u, 8*u, 1); stroke(ENV_DESERT.out, 2);
    }
  }

  function drawDesertHills(scroll, gy, vw) {
    const tw = 300*_SC, off = scroll % tw;
    for (let i=-1; i*tw - off < vw + tw; i++) {
      const x = i*tw - off;
      _ctx.fillStyle = ENV_DESERT.duneFront;
      _ctx.beginPath(); _ctx.ellipse(x + tw*0.5, gy + 30*_SC, tw*0.65, 55*_SC, 0, Math.PI, 0); _ctx.fill();
      _ctx.fillStyle = ENV_DESERT.sand;
      _ctx.beginPath(); _ctx.ellipse(x + tw*0.5, gy + 30*_SC, tw*0.65, 55*_SC, 0, Math.PI*1.1, Math.PI*1.9); _ctx.fill();
    }
  }

  function drawSandParticle(x, y, r, rot) {
    _ctx.save(); _ctx.translate(x, y); _ctx.rotate(Math.sin(rot)*0.6);
    _ctx.fillStyle = 'rgba(230,190,100,.42)';
    _ctx.beginPath(); _ctx.ellipse(0,0,r,r*0.38,0,0,7); _ctx.fill();
    _ctx.restore();
  }

  function drawBg3(vw, vh, gy, w) {
    const sky = _ctx.createLinearGradient(0,0,0,gy+20);
    sky.addColorStop(0, ENV_DESERT.sky[0]); sky.addColorStop(0.35, ENV_DESERT.sky[1]);
    sky.addColorStop(0.70, ENV_DESERT.sky[2]); sky.addColorStop(1, ENV_DESERT.sky[3]);
    _ctx.fillStyle = sky; _ctx.fillRect(0,0,vw,gy+20);

    // Soleil bas sur l'horizon
    const sx = vw*0.72, sy = gy - 55*_SC;
    _ctx.fillStyle = ENV_DESERT.sunGlow; _ctx.beginPath(); _ctx.arc(sx, sy, 70*_SC, 0, 7); _ctx.fill();
    _ctx.fillStyle = ENV_DESERT.sun; _ctx.beginPath(); _ctx.arc(sx, sy, 46*_SC, 0, 7); _ctx.fill();
    _ctx.strokeStyle = 'rgba(255,200,80,.35)'; _ctx.lineWidth = 2; _ctx.stroke();

    // Nuages rares
    const co = (w.scroll*0.05) % (vw+480);
    for (let k=0;k<2;k++){
      const cx = ((k*480 - co) % (vw+480) + (vw+480)) % (vw+480) - 130;
      toonCloudDesert(cx, vh*(0.13 + k*0.08), (58 + k*10)*_SC);
    }

    // Dunes lointaines (remplace montagnes)
    drawRange(w.scroll*0.10, gy, 320*_SC, 120*_SC, ENV_DESERT.duneBack, ENV_DESERT.duneBackSh, false, vw, ENV_DESERT.out);
    drawRange(w.scroll*0.18, gy, 240*_SC, 88*_SC, ENV_DESERT.duneFront, ENV_DESERT.duneFrontSh, false, vw, ENV_DESERT.out);

    // Ruines + palmiers (remplace château/cristaux)
    const off2 = (w.scroll*0.34) % (520*_SC);
    for (let i=-1; i*520*_SC - off2 < vw + 520*_SC; i++) {
      const bx = i*520*_SC - off2;
      drawRuin(bx + 60*_SC, gy);
      drawPalm(bx + 300*_SC, gy);
      drawPalm(bx + 380*_SC, gy);
    }

    drawAirship(_airship.x, vh*0.18 + (_airship.y-50)*0.4, w.anim);
    drawDesertHills(w.scroll*0.55, gy, vw);
    for (const f of w.feathers) drawSandParticle(f.x, f.y, f.r, f.sway);
  }

  function drawGround3(vw, vh, gy, w) {
    _ctx.fillStyle = ENV_DESERT.ground; _ctx.fillRect(0, gy, vw, vh-gy);
    _ctx.fillStyle = ENV_DESERT.groundTop; _ctx.fillRect(0, gy, vw, 7*_SC);
    const off = w.scroll % (36*_SC);
    _ctx.strokeStyle = ENV_DESERT.ripple; _ctx.lineWidth = 1; _ctx.lineCap = 'round';
    for (let x=-off; x<vw; x+=36*_SC) {
      _ctx.beginPath();
      _ctx.moveTo(x, gy+12*_SC); _ctx.lineTo(x+20*_SC, gy+12*_SC);
      _ctx.moveTo(x+8*_SC, gy+18*_SC); _ctx.lineTo(x+24*_SC, gy+18*_SC);
      _ctx.stroke();
    }
    _ctx.fillStyle = '#9a7840';
    for (let x=-off; x<vw; x+=36*_SC) {
      _ctx.beginPath(); _ctx.ellipse(x+10*_SC, gy+14*_SC, 4*_SC, 2.5*_SC, 0.3, 0, 7); _ctx.fill();
      _ctx.beginPath(); _ctx.ellipse(x+28*_SC, gy+20*_SC, 3*_SC, 2*_SC, -0.2, 0, 7); _ctx.fill();
    }
  }

  /* ============================================================
     REGISTRE & DISPATCHERS
     ============================================================ */
  const REGISTRY = {
    1: { name:'Terres de Cristal', drawBg:drawBg1, drawGround:drawGround1 },
    2: { name:'Forêt',            drawBg:drawBg2, drawGround:drawGround2 },
    3: { name:'Désert',           drawBg:drawBg3, drawGround:drawGround3 },
  };

  function getWorldLevel(w, gameMode, startLevel) {
    if (gameMode === 'level') return startLevel;
    if (w.score >= 1000) return 3;
    if (w.score >= 500)  return 2;
    return 1;
  }

  function drawBackground(vw, vh, gy, w, level) { REGISTRY[level].drawBg(vw, vh, gy, w); }
  function drawGround(vw, vh, gy, w, level)      { REGISTRY[level].drawGround(vw, vh, gy, w); }

  return { setRenderCtx, drawBackground, drawGround, getWorldLevel, REGISTRY };
})();
