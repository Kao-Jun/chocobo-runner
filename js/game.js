/* =====================================================================
   Chocobo Runner — Core (v2)
   Dépend de : CR.FEATURES, CR.Audio, CR.Levels, CR.Enemies
   ===================================================================== */
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const overlay   = document.getElementById('overlay');
  const ovmsg     = document.getElementById('ovmsg');
  const menuBtns  = document.getElementById('menuBtns');
  const levelBtns = document.getElementById('levelBtns');
  const overBtns  = document.getElementById('overBtns');
  const controls  = document.getElementById('controls');
  const muteEl    = document.getElementById('mute');
  const volEl     = document.getElementById('musicVol');

  let best = +(localStorage.getItem('chocoboBest') || 0);

  /* ---- init UI audio ---- */
  muteEl.textContent = CR.Audio.getMuted() ? '🔇' : '🔊';
  volEl.value = CR.Audio.Music.volume;
  muteEl.addEventListener('click', e => { e.stopPropagation(); CR.Audio.audioInit(); toggleMute(); });
  volEl.addEventListener('click', e => e.stopPropagation());
  volEl.addEventListener('input', e => {
    CR.Audio.audioInit();
    const v = +e.target.value;
    if (CR.Audio.getMuted() && v > 0) { CR.Audio.setMuted(false); muteEl.textContent = '🔊'; }
    CR.Audio.Music.setVolume(v);
    if (state === 'playing') CR.Audio.Music.start();
  });

  function toggleMute() {
    CR.Audio.setMuted(!CR.Audio.getMuted());
    muteEl.textContent = CR.Audio.getMuted() ? '🔇' : '🔊';
  }

  /* ====================== PIXEL-ART CHOCOBO ======================
     Sprite d'après assets/Chocobo.png.                            */
  const BODY = [
    "......H.H.H.......",
    ".....oHoHoHo......",
    ".....oYYYYYo......",
    "....oYYYYYYYo.....",
    "....oYYYHYYYYo....",
    "....oYYweekYbbbo..",
    "....oYpYeeYYbmmo..",
    "....oYYYYYYBbo....",
    ".....oYYYYYo......",
    "...sssssssss......",
    "..SsssssssssS.....",
    "..aSYYYYYYSa......",
    ".oaYYYYYYYYo......",
    "oaaYYYYYYYYo......",
    "oaaYYYHHYYYo......",
    "oaaYYYHHYYYo......",
    ".oaYYYYYYYYo......",
    "..oaaYYYYYoo......",
  ];
  const LEGS_A    = ["...oLLo.oLLo......","...oLo...oLo......","..CccC.CccC......."];
  const LEGS_B    = ["...oLLo.oLLo......","....oLo.oLo.......","...CccC.CccC......"];
  const LEGS_JUMP = ["..oLLo.oLLo.......","..CccC.CccC......."];
  const frameRun1 = BODY.concat(LEGS_A);
  const frameRun2 = BODY.concat(LEGS_B);
  const frameJump = BODY.concat(LEGS_JUMP);
  const SPR_COLS = 18, SPR_ROWS = 21;

  const PAL_YELLOW = {
    o:'#6b4a1e', O:'#4a3214', Y:'#f5c842', H:'#ffe79a', y:'#d9982f', a:'#bd7f24',
    b:'#e69a3a', B:'#c47a22', m:'#b33a2a', w:'#ffffff', e:'#3a7fc4', k:'#16243a',
    p:'#f0a3a3', s:'#86a83e', S:'#5e7d28', L:'#d98a3a', C:'#d8cfb8', c:'#8f856b',
  };
  const PAL_BLUE = {
    o:'#1e3a5e', O:'#142a44', Y:'#5fb0e8', H:'#c3e8ff', y:'#3585c4', a:'#256296',
    b:'#e69a3a', B:'#c47a22', m:'#b33a2a', w:'#ffffff', e:'#ffcf5a', k:'#2a1a08',
    p:'#f0a3a3', s:'#d8553f', S:'#9c2f22', L:'#e0883a', C:'#d8cfb8', c:'#8f856b',
  };

  function drawSprite(rows, dx, bottomY, px, pal) {
    const top = bottomY - rows.length * px;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const col = pal[row[c]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(dx + c*px), Math.round(top + r*px), Math.ceil(px), Math.ceil(px));
      }
    }
  }

  /* ========================= LAYOUT / STATE ========================= */
  let state = 'menu';       // menu | levelSelect | playing | over
  let numPlayers  = 1;
  let gameMode    = 'fullRun';   // 'level' | 'fullRun'
  let startLevel  = 1;           // 1 | 2 | 3 (ignoré en fullRun)
  let viewports = [], worlds = [];
  let SC = 1, PX = 3, SPR_W = 0, SPR_H = 0, BASE_SPEED = 6;
  let speed = 6, frame = 0;
  let spawnTimer = 0, gilTimer = 0, airship = { x: 0, y: 0 };
  const VIEW_W = W;
  let VIEW_GY = 0;

  function makeWorld(pal, label, col) {
    return {
      pal, label, col,
      chocobo: { x: 96, y: 0, vy: 0, onGround: true, ducking: false },
      obstacles: [], gils: [], sparkles: [], feathers: [], projectiles: [],
      scroll: 0, anim: 0, score: 0, gilCount: 0, alive: true,
      holdJump: false,
    };
  }

  function configure(n) {
    numPlayers = n;
    if (n === 1) {
      SC = 1; BASE_SPEED = 6.2;
      viewports = [{ x:0, y:0, w:W, h:H, gy: H - 74, label:'', col:'#ffd86b' }];
    } else {
      SC = 0.74; BASE_SPEED = 4.6;
      const hh = H/2;
      viewports = [
        { x:0, y:0,  w:W, h:hh, gy: hh - 42, label:'J1', col:'#ffd86b' },
        { x:0, y:hh, w:W, h:hh, gy: hh - 42, label:'J2', col:'#76b9ec' },
      ];
    }
    PX = 3.0 * SC;
    SPR_W = SPR_COLS * PX; SPR_H = SPR_ROWS * PX;
    VIEW_GY = viewports[0].gy;
  }

  function initFeathers(world, vw, vh) {
    world.feathers = [];
    for (let i = 0; i < 9; i++) world.feathers.push({
      x: Math.random()*vw, y: Math.random()*vh*0.6, vx: -(0.3+Math.random()*0.5),
      sway: Math.random()*6.28, r: (3+Math.random()*3)*SC
    });
  }

  function reset() {
    speed = BASE_SPEED; frame = 0;
    spawnTimer = 50; gilTimer = 80;
    airship = { x: W + 200, y: 60 };
    worlds = [ makeWorld(PAL_YELLOW, viewports[0].label, viewports[0].col) ];
    if (numPlayers === 2) worlds.push(makeWorld(PAL_BLUE, viewports[1].label, viewports[1].col));
    worlds.forEach((wd, i) => {
      wd.chocobo.y = viewports[i].gy;
      initFeathers(wd, viewports[i].w, viewports[i].h);
    });
  }

  /* =========================== INPUT =========================== */
  function jump(world) {
    if (!world || !world.alive) return;
    const ch = world.chocobo;
    if (ch.onGround) { ch.vy = -12.8 * SC; ch.onGround = false; world.holdJump = true; CR.Audio.sfxJump(); }
  }
  const endJump = world => { if (world) world.holdJump = false; };
  const duck = (world, on) => { if (world && world.alive) world.chocobo.ducking = on; };

  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') { CR.Audio.audioInit(); toggleMute(); return; }
    if (state === 'over') {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); startGame(numPlayers, gameMode, startLevel); }
      return;
    }
    if (state !== 'playing') return;
    if (numPlayers === 1) {
      if (['Space','ArrowUp','KeyW'].includes(e.code)) { e.preventDefault(); CR.Audio.audioInit(); jump(worlds[0]); }
      else if (['ArrowDown','KeyS'].includes(e.code)) { e.preventDefault(); duck(worlds[0], true); }
    } else {
      if (e.code === 'KeyW') { e.preventDefault(); jump(worlds[0]); }
      else if (e.code === 'KeyS') { e.preventDefault(); duck(worlds[0], true); }
      else if (e.code === 'ArrowUp') { e.preventDefault(); jump(worlds[1]); }
      else if (e.code === 'ArrowDown') { e.preventDefault(); duck(worlds[1], true); }
    }
  });
  window.addEventListener('keyup', e => {
    if (state !== 'playing') return;
    if (numPlayers === 1) {
      if (['Space','ArrowUp','KeyW'].includes(e.code)) endJump(worlds[0]);
      else if (['ArrowDown','KeyS'].includes(e.code)) duck(worlds[0], false);
    } else {
      if (e.code === 'KeyW') endJump(worlds[0]);
      else if (e.code === 'KeyS') duck(worlds[0], false);
      else if (e.code === 'ArrowUp') endJump(worlds[1]);
      else if (e.code === 'ArrowDown') duck(worlds[1], false);
    }
  });
  canvas.addEventListener('mousedown', e => { e.preventDefault(); CR.Audio.audioInit(); if(state==='playing') jump(worlds[0]); });
  window.addEventListener('mouseup', () => endJump(worlds[0]));
  canvas.addEventListener('touchstart', e => { e.preventDefault(); CR.Audio.audioInit(); if(state==='playing') jump(worlds[0]); }, {passive:false});
  window.addEventListener('touchend', () => endJump(worlds[0]));

  // devSkip buttons
  if (CR.FEATURES.devSkip) {
    document.getElementById('devSkip600').addEventListener('click', e => {
      e.stopPropagation();
      if (state === 'playing') worlds.forEach(w => { w.score = 600; });
    });
    document.getElementById('devSkip1000').addEventListener('click', e => {
      e.stopPropagation();
      if (state === 'playing') worlds.forEach(w => { w.score = 1000; });
    });
  } else {
    ['devSkip600','devSkip1000'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  // Menu principal → sélection niveau
  menuBtns.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', e => {
      e.stopPropagation(); CR.Audio.audioInit();
      numPlayers = +b.dataset.n;
      showLevelSelect();
    }));

  // Sélection niveau → partie
  levelBtns.querySelectorAll('button[data-mode]').forEach(b =>
    b.addEventListener('click', e => {
      e.stopPropagation();
      const mode = b.dataset.mode;
      const lv = b.dataset.lv ? +b.dataset.lv : 1;
      startGame(numPlayers, mode, lv);
    }));

  document.getElementById('backBtn').addEventListener('click', e => { e.stopPropagation(); showMenu(); });
  document.getElementById('againBtn').addEventListener('click', e => { e.stopPropagation(); startGame(numPlayers, gameMode, startLevel); });
  document.getElementById('menuBtn').addEventListener('click',  e => { e.stopPropagation(); showMenu(); });

  /* =========================== FLOW =========================== */
  function startGame(n, mode, lv) {
    numPlayers = n; gameMode = mode; startLevel = lv || 1;
    configure(n); reset();
    state = 'playing'; overlay.classList.add('hidden');
    CR.Audio.Music.start();
  }

  function showMenu() {
    state = 'menu'; CR.Audio.Music.stop();
    overlay.classList.remove('hidden');
    menuBtns.classList.remove('hidden');
    levelBtns.classList.add('hidden');
    overBtns.classList.add('hidden');
    document.querySelector('#overlay h1').textContent = '🐤 Chocobo Runner';
    ovmsg.textContent = 'Cours à travers les terres de cristal, saute les obstacles et ramasse les gils !';
    controls.innerHTML =
      '<span><b>1 Joueur</b> — <span class="key">Espace</span>/<span class="key">↑</span>/Clic sauter · <span class="key">↓</span> baisser</span>' +
      '<span><b>2 Joueurs</b> — J1 <span class="key">W</span>/<span class="key">S</span> · J2 <span class="key b">↑</span>/<span class="key b">↓</span></span>';
  }

  function showLevelSelect() {
    state = 'levelSelect';
    overlay.classList.remove('hidden');
    menuBtns.classList.add('hidden');
    levelBtns.classList.remove('hidden');
    overBtns.classList.add('hidden');
    document.querySelector('#overlay h1').textContent = numPlayers === 1 ? '1 Joueur' : '2 Joueurs';
    ovmsg.textContent = 'Choisis un niveau ou lance le Parcours Complet';
    controls.innerHTML = '';
    // Feature flags → griser les boutons désactivés
    const btn2 = levelBtns.querySelector('[data-lv="2"]');
    const btn3 = levelBtns.querySelector('[data-lv="3"]');
    const btnFull = levelBtns.querySelector('[data-mode="fullRun"]');
    if (btn2) btn2.disabled = !CR.FEATURES.level2;
    if (btn3) btn3.disabled = !CR.FEATURES.level3;
    if (btnFull) btnFull.disabled = !CR.FEATURES.fullRun;
  }

  function gameOver() {
    state = 'over'; CR.Audio.Music.stop(); CR.Audio.sfxDie();
    const top = Math.max(...worlds.map(w => Math.floor(w.score)));
    best = Math.max(best, top); localStorage.setItem('chocoboBest', best);
    overlay.classList.remove('hidden');
    menuBtns.classList.add('hidden'); levelBtns.classList.add('hidden'); overBtns.classList.remove('hidden');
    if (numPlayers === 1) {
      document.querySelector('#overlay h1').textContent = '💥 Perdu !';
      ovmsg.innerHTML = `Score : <b>${Math.floor(worlds[0].score)}</b> · Gils : <b>${worlds[0].gilCount}</b> · Record : <b>${best}</b>`;
    } else {
      const s0 = Math.floor(worlds[0].score), s1 = Math.floor(worlds[1].score);
      let title;
      if (s0 === s1) title = '🤝 Égalité !';
      else { const wn = s0 > s1 ? 'J1 (jaune)' : 'J2 (bleu)'; title = '🏆 ' + wn + ' gagne !'; }
      document.querySelector('#overlay h1').textContent = title;
      ovmsg.innerHTML = `J1 : <b>${s0}</b> (🪙${worlds[0].gilCount}) &nbsp;·&nbsp; J2 : <b>${s1}</b> (🪙${worlds[1].gilCount})`;
    }
    controls.innerHTML = '<span class="small"><span class="key">Espace</span> pour rejouer</span>';
  }

  /* ========================= DIRECTOR ========================= */
  function genGils() {
    const n = 3 + (Math.random()*3|0), arc = Math.random() < 0.5;
    const baseY = arc ? VIEW_GY - 95*SC : VIEW_GY - 34*SC, out = [];
    for (let i = 0; i < n; i++) {
      const y = arc ? baseY - Math.sin((i/(n-1||1))*Math.PI) * 52*SC : baseY;
      out.push({ x: VIEW_W+24 + i*36*SC, y, r: 11*SC, got:false, bob: Math.random()*6 });
    }
    return out;
  }
  const aliveWorlds = () => worlds.filter(w => w.alive);

  function update() {
    frame++;
    speed += 0.0022 * SC;

    spawnTimer--;
    if (spawnTimer <= 0) {
      aliveWorlds().forEach(w => {
        const lv = CR.Levels.getWorldLevel(w, gameMode, startLevel);
        w.obstacles.push(CR.Enemies.genObstacle(lv, VIEW_W, VIEW_GY));
      });
      spawnTimer = Math.max(42, 92 - speed*3/SC) + Math.random()*48;
    }
    gilTimer--;
    if (gilTimer <= 0) {
      const gs = genGils();
      aliveWorlds().forEach(w => {
        for (const g of gs) {
          if (!gilHitsObstacle(g, w.obstacles)) w.gils.push({ ...g });
        }
      });
      gilTimer = 120 + Math.random()*120;
    }

    airship.x -= speed * 0.22;
    if (airship.x < -200) { airship.x = W + 140; airship.y = 36 + Math.random()*40; }

    worlds.forEach((w, i) => { if (w.alive) updateWorld(w, viewports[i]); });
    if (aliveWorlds().length === 0) gameOver();
  }

  function hitbox(ch) {
    if (ch.ducking && ch.onGround)
      return { x: ch.x + 4*SC, y: ch.y - SPR_H*0.55, w: SPR_W*0.9, h: SPR_H*0.5 };
    return { x: ch.x + SPR_W*0.16, y: ch.y - SPR_H + 6*SC, w: SPR_W*0.56, h: SPR_H - 10*SC };
  }
  const overlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  const gilHitsObstacle = (g, obstacles) => {
    const gb = { x: g.x-g.r, y: g.y-g.r, w: g.r*2, h: g.r*2 };
    return obstacles.some(o => overlap(gb, o));
  };

  function updateWorld(w, view) {
    const ch = w.chocobo, gy = view.gy;
    w.scroll += speed; w.anim++;
    w.score += speed * 0.02;

    if (!ch.onGround) {
      const g = (w.holdJump && ch.vy < 0 ? 0.55 : 1) * 0.72 * SC;
      ch.vy += g; ch.y += ch.vy;
      if (ch.y >= gy) { ch.y = gy; ch.vy = 0; ch.onGround = true; }
    }

    CR.Enemies.updateObstacles(w.obstacles, w.projectiles, speed, gy);
    w.obstacles  = w.obstacles.filter(o => o.x + o.w > -12);
    w.projectiles = w.projectiles.filter(p => p.x + p.w > -12);

    for (const g of w.gils) if (!g.got) g.x -= speed;
    w.gils = w.gils.filter(g => g.x > -20 && !g.got);

    for (const s of w.sparkles) { s.x += s.vx; s.y += s.vy; s.vy += 0.15; s.life--; }
    w.sparkles = w.sparkles.filter(s => s.life > 0);

    for (const f of w.feathers) {
      f.x += f.vx; f.sway += 0.05; f.y += Math.sin(f.sway) * 0.25;
      if (f.x < -10) { f.x = view.w + 10; f.y = Math.random()*view.h*0.6; }
    }

    const hb = hitbox(ch);
    for (const o of w.obstacles) if (overlap(hb, o)) { w.alive = false; if (numPlayers===1) CR.Audio.sfxDie(); return; }
    for (const p of w.projectiles) if (overlap(hb, p)) { w.alive = false; if (numPlayers===1) CR.Audio.sfxDie(); return; }
    for (const g of w.gils) {
      if (!g.got && overlap(hb, { x:g.x-g.r, y:g.y-g.r, w:g.r*2, h:g.r*2 })) {
        g.got = true; w.gilCount++; w.score += 10; CR.Audio.sfxGil();
        for (let i=0;i<8;i++) w.sparkles.push({
          x:g.x, y:g.y, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.7)*4, life:24+Math.random()*10
        });
      }
    }
  }

  /* ========================= DRAW HELPERS ========================= */
  function drawGil(g, anim) {
    const bob = Math.sin(anim*0.12 + g.bob) * 3*SC, y = g.y + bob;
    const sx = Math.abs(Math.cos(anim*0.1 + g.bob));
    ctx.save(); ctx.translate(g.x, y); ctx.scale(0.35 + sx*0.65, 1);
    ctx.fillStyle = '#9c6a12'; ctx.beginPath(); ctx.arc(0,0,g.r,0,7); ctx.fill();
    ctx.fillStyle = '#e8b53a'; ctx.beginPath(); ctx.arc(0,0,g.r-1.5,0,7); ctx.fill();
    ctx.fillStyle = '#caa42a'; ctx.beginPath(); ctx.arc(0,0,g.r-3.5,0,7); ctx.fill();
    ctx.fillStyle = '#3a2a08'; ctx.font = `bold ${12*SC}px Georgia`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('G', 0, 1);
    ctx.fillStyle = 'rgba(255,250,220,.85)';
    ctx.beginPath(); ctx.ellipse(-g.r*0.35, -g.r*0.4, 2*SC, 3.4*SC, -0.5, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawChocobo(w, gy) {
    const ch = w.chocobo;
    const air = Math.max(0, (gy - ch.y));
    const shW = SPR_W*0.42 * (1 - Math.min(0.5, air/260));
    ctx.fillStyle = 'rgba(20,10,30,.28)';
    ctx.beginPath(); ctx.ellipse(ch.x + SPR_W*0.42, gy + 4*SC, shW, 6*SC, 0, 0, 7); ctx.fill();

    let rows = !ch.onGround ? frameJump : (((w.anim>>2)&1) ? frameRun1 : frameRun2);
    if (ch.ducking && ch.onGround) {
      ctx.save(); ctx.translate(ch.x, ch.y); ctx.scale(1.15, 0.62);
      drawSprite(rows, -2, 0, PX, w.pal); ctx.restore();
    } else {
      drawSprite(rows, ch.x, ch.y, PX, w.pal);
    }
  }

  function drawSparkles(w) {
    for (const s of w.sparkles) {
      ctx.globalAlpha = Math.max(0, s.life/30);
      ctx.fillStyle = '#ffe066'; ctx.fillRect(s.x-2*SC, s.y-2*SC, 4*SC, 4*SC);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD(w, view) {
    const pad = 14;
    ctx.font = `bold ${Math.round(20*Math.max(.8,SC))}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const label = (view.label ? view.label + '  ' : '') + Math.floor(w.score);
    const line = label + '   🪙 ' + w.gilCount;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.strokeText(line, pad, pad);
    ctx.fillStyle = view.col; ctx.fillText(line, pad, pad);
    if (view.label === '') {
      ctx.textAlign = 'right';
      ctx.strokeText('RECORD ' + best, view.w - pad, pad);
      ctx.fillStyle = '#fff'; ctx.fillText('RECORD ' + best, view.w - pad, pad);
    }
  }

  /* =========================== RENDER =========================== */
  function renderView(view, w) {
    ctx.save();
    ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
    ctx.translate(view.x, view.y);

    const lv = CR.Levels.getWorldLevel(w, gameMode, startLevel);
    CR.Levels.drawBackground(view.w, view.h, view.gy, w, lv);
    CR.Levels.drawGround(view.w, view.h, view.gy, w, lv);

    for (const g of w.gils) drawGil(g, w.anim);
    for (const o of w.obstacles)  CR.Enemies.drawObstacle(o);
    for (const p of w.projectiles) CR.Enemies.drawProjectile(p);
    drawChocobo(w, view.gy);
    drawSparkles(w);

    // vignette
    const vg = ctx.createRadialGradient(view.w/2, view.h/2, view.h*0.3, view.w/2, view.h/2, view.h*0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,16,.4)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, view.w, view.h);

    if (!w.alive) {
      ctx.fillStyle = 'rgba(10,6,18,.55)'; ctx.fillRect(0,0,view.w,view.h);
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(40*Math.max(.7,SC))}px 'Trebuchet MS'`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('K.O.', view.w/2, view.h/2);
    }

    drawHUD(w, view);
    ctx.restore();

    if (numPlayers === 2) {
      ctx.strokeStyle = view.col; ctx.lineWidth = 3;
      ctx.strokeRect(view.x+1.5, view.y+1.5, view.w-3, view.h-3);
    }
  }

  function render() {
    CR.Levels.setRenderCtx({ ctx, SC, airship, frame });
    CR.Enemies.setRenderCtx({ ctx, SC, frame });
    ctx.clearRect(0,0,W,H);
    viewports.forEach((v, i) => renderView(v, worlds[i] || worlds[0]));
    if (numPlayers === 2) { ctx.fillStyle = '#0c0913'; ctx.fillRect(0, H/2-2, W, 4); }
  }

  function loop() {
    if (state === 'playing') update();
    if (worlds.length) render();
    requestAnimationFrame(loop);
  }

  configure(1); reset();
  showMenu();
  loop();
})();
