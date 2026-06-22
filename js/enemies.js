/* =====================================================================
   Chocobo Runner — Module Enemies
   Génération, mise à jour et rendu de tous les ennemis + projectiles.
   Pattern : setRenderCtx({ ctx, SC, frame }) avant chaque frame.
   ===================================================================== */
var CR = CR || {};
CR.Enemies = (function () {

  /* ---- render context ---- */
  let _ctx, _SC, _frame;
  function setRenderCtx(rc) { _ctx = rc.ctx; _SC = rc.SC; _frame = rc.frame; }

  /* ---- utilitaires canvas (locaux) ---- */
  function stroke(c, lw) { _ctx.lineJoin='round'; _ctx.lineCap='round'; _ctx.strokeStyle=c; _ctx.lineWidth=lw; _ctx.stroke(); }
  function roundRect(x,y,w,h,r){ _ctx.beginPath(); _ctx.moveTo(x+r,y); _ctx.arcTo(x+w,y,x+w,y+h,r); _ctx.arcTo(x+w,y+h,x,y+h,r); _ctx.arcTo(x,y+h,x,y,r); _ctx.arcTo(x,y,x+w,y,r); _ctx.closePath(); }
  function poly(pts) { _ctx.beginPath(); _ctx.moveTo(pts[0],pts[1]); for(let i=2;i<pts.length;i+=2) _ctx.lineTo(pts[i],pts[i+1]); _ctx.closePath(); }

  /* ============================================================
     GÉNÉRATION
     ============================================================ */
  function genObstacle(level, VIEW_W, VIEW_GY) {
    if (level === 2 && CR.FEATURES.snake && Math.random() < 0.30)
      return { type:'snake', x:VIEW_W+24, y:VIEW_GY, w:44*_SC, h:14*_SC, phase:Math.random()*Math.PI*2 };
    if (level === 3 && CR.FEATURES.cactuar && Math.random() < 0.25)
      return { type:'cactuar', x:VIEW_W+24, y:VIEW_GY, w:48*_SC, h:64*_SC, fired:false, fireX:VIEW_W*0.65 };
    if (Math.random() < 0.66) {
      const h = (30 + Math.random()*32) * _SC;
      return { type:'ground', x:VIEW_W+24, y:VIEW_GY-h, w:(22+Math.random()*16)*_SC, h };
    }
    const y = VIEW_GY - (66 + Math.random()*26) * _SC;
    return { type:'fly', x:VIEW_W+24, y, w:46*_SC, h:28*_SC };
  }

  /* ============================================================
     MISE À JOUR (obstacles + projectiles en place)
     ============================================================ */
  function updateObstacles(obstacles, projectiles, speed, gy) {
    for (const o of obstacles) {
      o.x -= speed;
      if (o.type === 'snake') {
        o.phase += 0.055;
        const h = Math.max(14*_SC, 52*_SC * 0.5 * (1 + Math.sin(o.phase)));
        o.h = h; o.y = gy - h;
      }
      if (o.type === 'cactuar' && !o.fired && o.x < o.fireX) {
        // 3 épines : basse (à sauter), haute (à esquiver ducking), très haute (passe dessus)
        const spineHeights = [22*_SC, 80*_SC, 130*_SC];
        for (const sh of spineHeights) {
          projectiles.push({ x:o.x, y:gy-sh, w:28*_SC, h:6*_SC, spd:speed*2.2 });
        }
        o.fired = true;
      }
    }
    for (const p of projectiles) p.x -= p.spd;
  }

  /* ============================================================
     RENDU ENNEMIS
     ============================================================ */
  function drawSnake(o) {
    const u = _SC;
    const cx = o.x + o.w * 0.5;
    const segments = Math.max(2, Math.round(o.h / (10*u)));
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const sy = (o.y + o.h) - t * o.h;
      const r = Math.max(3*u, (8 - t*3) * u);
      _ctx.fillStyle = i % 2 === 0 ? '#2a8a1a' : '#3aaa24';
      _ctx.beginPath(); _ctx.ellipse(cx, sy, r, r*0.85, 0, 0, 7); _ctx.fill();
    }
    // tête
    _ctx.fillStyle = '#2a8a1a';
    _ctx.beginPath(); _ctx.ellipse(cx, o.y, 10*u, 8*u, 0, 0, 7); _ctx.fill();
    _ctx.fillStyle = '#4ac030';
    _ctx.beginPath(); _ctx.ellipse(cx-2*u, o.y-2*u, 5*u, 4*u, -0.3, 0, 7); _ctx.fill();
    // yeux
    _ctx.fillStyle = '#fff';
    _ctx.beginPath(); _ctx.arc(cx-4*u, o.y-2*u, 2.5*u, 0, 7); _ctx.arc(cx+4*u, o.y-2*u, 2.5*u, 0, 7); _ctx.fill();
    _ctx.fillStyle = '#111';
    _ctx.beginPath(); _ctx.arc(cx-3.5*u, o.y-2*u, 1.2*u, 0, 7); _ctx.arc(cx+4.5*u, o.y-2*u, 1.2*u, 0, 7); _ctx.fill();
    // langue bifide
    _ctx.strokeStyle = '#ff3030'; _ctx.lineWidth = 1.5*u; _ctx.lineCap = 'round';
    _ctx.beginPath();
    _ctx.moveTo(cx, o.y+5*u); _ctx.lineTo(cx, o.y+10*u);
    _ctx.lineTo(cx-3*u, o.y+14*u); _ctx.moveTo(cx, o.y+10*u); _ctx.lineTo(cx+3*u, o.y+14*u);
    _ctx.stroke();
    _ctx.beginPath(); _ctx.ellipse(cx, o.y, 10*u, 8*u, 0, 0, 7); stroke('#0f1a0f', 2);
  }

  function drawCactuar(o) {
    const u = _SC;
    const cx = o.x + o.w * 0.5;
    const by = o.y + o.h; // bas = sol

    // Corps
    _ctx.fillStyle = '#2a7020';
    roundRect(cx-14*u, by-56*u, 28*u, 40*u, 8*u); _ctx.fill();
    _ctx.fillStyle = '#4aaa30';
    roundRect(cx-12*u, by-54*u, 14*u, 36*u, 6*u); _ctx.fill();
    roundRect(cx-14*u, by-56*u, 28*u, 40*u, 8*u); stroke('#1a0f00', 2);

    // Jambes
    _ctx.fillStyle = '#2a7020';
    _ctx.fillRect(cx-12*u, by-18*u, 9*u, 18*u);
    _ctx.fillRect(cx+3*u, by-18*u, 9*u, 18*u);
    stroke('#1a0f00', 1.5);

    // Bras gauche (T)
    _ctx.fillStyle = '#2a7020';
    _ctx.fillRect(cx-28*u, by-50*u, 16*u, 8*u);
    _ctx.fillRect(cx-28*u, by-50*u, 8*u, 16*u);
    roundRect(cx-28*u, by-50*u, 16*u, 8*u, 3*u); stroke('#1a0f00', 1.5);
    // Bras droit (T)
    _ctx.fillStyle = '#2a7020';
    _ctx.fillRect(cx+12*u, by-50*u, 16*u, 8*u);
    _ctx.fillRect(cx+20*u, by-50*u, 8*u, 16*u);
    roundRect(cx+12*u, by-50*u, 16*u, 8*u, 3*u); stroke('#1a0f00', 1.5);

    // Tête
    _ctx.fillStyle = '#2a7020';
    _ctx.beginPath(); _ctx.ellipse(cx, by-64*u, 16*u, 14*u, 0, 0, 7); _ctx.fill();
    _ctx.fillStyle = '#4aaa30';
    _ctx.beginPath(); _ctx.ellipse(cx-3*u, by-66*u, 10*u, 10*u, 0, 0, 7); _ctx.fill();
    _ctx.beginPath(); _ctx.ellipse(cx, by-64*u, 16*u, 14*u, 0, 0, 7); stroke('#1a0f00', 2);

    // Grands yeux ronds (signature cactuar FF)
    _ctx.fillStyle = '#fff';
    _ctx.beginPath(); _ctx.ellipse(cx-6*u, by-65*u, 5*u, 6*u, 0, 0, 7); _ctx.fill();
    _ctx.beginPath(); _ctx.ellipse(cx+6*u, by-65*u, 5*u, 6*u, 0, 0, 7); _ctx.fill();
    _ctx.fillStyle = '#111';
    _ctx.beginPath(); _ctx.ellipse(cx-5*u, by-65*u, 2.5*u, 3*u, 0, 0, 7); _ctx.fill();
    _ctx.beginPath(); _ctx.ellipse(cx+7*u, by-65*u, 2.5*u, 3*u, 0, 0, 7); _ctx.fill();
    _ctx.fillStyle = '#fff';
    _ctx.beginPath(); _ctx.arc(cx-4*u, by-67*u, 1.2*u, 0, 7); _ctx.fill();
    _ctx.beginPath(); _ctx.arc(cx+8*u, by-67*u, 1.2*u, 0, 7); _ctx.fill();

    // Épines latérales (petits traits)
    _ctx.strokeStyle = '#e8e0b0'; _ctx.lineWidth = 1.5; _ctx.lineCap = 'round';
    const spines = [[-16,-42,-22,-42],[-16,-32,-22,-32],[-16,-22,-22,-22],[14,-42,20,-42],[14,-32,20,-32],[14,-22,20,-22],[0,-56,0,-62]];
    for (const [x1,y1,x2,y2] of spines) {
      _ctx.beginPath(); _ctx.moveTo(cx+x1*u, by+y1*u); _ctx.lineTo(cx+x2*u, by+y2*u); _ctx.stroke();
    }
  }

  function drawObstacle(o) {
    if (o.type === 'snake')   { drawSnake(o); return; }
    if (o.type === 'cactuar') { drawCactuar(o); return; }
    if (o.type === 'ground') {
      _ctx.fillStyle = '#7a5a86';
      roundRect(o.x, o.y, o.w, o.h, 5*_SC); _ctx.fill();
      _ctx.fillStyle = '#5e4068';
      roundRect(o.x + o.w*0.5, o.y, o.w*0.5, o.h, 5*_SC); _ctx.fill();
      roundRect(o.x, o.y, o.w, o.h, 5*_SC); stroke('#2c2140', 2);
      _ctx.fillStyle = '#bdf3ff';
      roundRect(o.x + o.w*0.32, o.y + o.h*0.18, o.w*0.18, o.h*0.5, 2); _ctx.fill();
      return;
    }
    // fly (bat)
    const u = _SC;
    _ctx.save(); _ctx.translate(o.x, o.y);
    const up = ((_frame >> 3) & 1) ? -11*u : 7*u;
    _ctx.fillStyle = '#9b86ff';
    poly([18*u,12*u, 2*u,up, 22*u,16*u]); _ctx.fill();
    poly([26*u,12*u, 42*u,up, 24*u,16*u]); _ctx.fill();
    _ctx.fillStyle = '#7a5cff';
    _ctx.beginPath(); _ctx.ellipse(22*u,15*u,15*u,9*u,0,0,7); _ctx.fill();
    _ctx.beginPath(); _ctx.ellipse(22*u,15*u,15*u,9*u,0,0,7); stroke('#2c2140', 2);
    _ctx.fillStyle = '#ff9b2e'; poly([35*u,13*u, 47*u,15*u, 35*u,17*u]); _ctx.fill();
    _ctx.fillStyle = '#fff';    _ctx.beginPath(); _ctx.arc(30*u,12*u,3*u,0,7); _ctx.fill();
    _ctx.fillStyle = '#161616'; _ctx.beginPath(); _ctx.arc(31*u,12*u,1.6*u,0,7); _ctx.fill();
    _ctx.restore();
  }

  /* ============================================================
     RENDU PROJECTILES (épines de cactuar)
     ============================================================ */
  function drawProjectile(p) {
    const u = _SC;
    // Corps de l'épine (beige)
    _ctx.fillStyle = '#e8e0b0';
    _ctx.fillRect(p.x + 5*u, p.y, p.w - 5*u, p.h);
    // Pointe sombre vers la gauche
    _ctx.fillStyle = '#1a0f00';
    _ctx.beginPath();
    _ctx.moveTo(p.x + 5*u, p.y);
    _ctx.lineTo(p.x, p.y + p.h * 0.5);
    _ctx.lineTo(p.x + 5*u, p.y + p.h);
    _ctx.closePath(); _ctx.fill();
  }

  return { setRenderCtx, genObstacle, updateObstacles, drawObstacle, drawProjectile };
})();
