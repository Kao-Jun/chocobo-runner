/* =====================================================================
   Chocobo Runner — logique de jeu
   - Runner 16:9, solo ou 2 joueurs en écran partagé (chocobo jaune / bleu)
   - Décor Final Fantasy cell-shadé en parallaxe
   - Musique de fond : assets/ChocoboTheme.mp3 (boucle gapless)
   - Effets sonores synthétisés (saut / gil / mort)
   ===================================================================== */
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;     // 960 x 540 (16:9)

  const overlay  = document.getElementById('overlay');
  const ovmsg    = document.getElementById('ovmsg');
  const menuBtns = document.getElementById('menuBtns');
  const overBtns = document.getElementById('overBtns');
  const controls = document.getElementById('controls');
  const muteEl   = document.getElementById('mute');
  const volEl    = document.getElementById('musicVol');

  let best = +(localStorage.getItem('chocoboBest') || 0);

  /* ============================ AUDIO ============================ */
  let actx = null, muted = (localStorage.getItem('chocoboMuted') === '1');
  const clamp01 = v => (isNaN(v) ? 0.6 : Math.max(0, Math.min(1, v)));

  function audioInit() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === 'suspended') actx.resume();
    Music.ensureLoaded();
  }

  /* ---- effets sonores (oscillateurs Web Audio, inchangés) ---- */
  function tone(freq, dur, type, vol, slideTo) {
    if (!actx || muted) return;
    const t = actx.currentTime;
    const osc = actx.createOscillator(), g = actx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(actx.destination);
    osc.start(t); osc.stop(t + dur);
  }
  const sfxJump = () => tone(440, 0.16, 'square', 0.05, 880);
  const sfxGil  = () => { tone(880,0.08,'square',0.05); setTimeout(()=>tone(1318,0.12,'square',0.05),70); };
  const sfxDie  = () => { tone(330,0.18,'sawtooth',0.06,110); setTimeout(()=>tone(160,0.3,'sawtooth',0.06,60),120); };

  /* ---- musique de fond : ChocoboTheme.mp3 ----
     Chemin 1 (servi en HTTP) : fetch -> decodeAudioData -> AudioBufferSource
        avec loop = true  ⇒  bouclage échantillon-précis, sans coupure.
     Chemin 2 (ouverture file://, fetch bloqué) : élément <audio loop>,
        volume piloté directement (repli robuste qui garde le son). */
  const MUSIC_URL = 'assets/ChocoboTheme.mp3';
  const Music = {
    gain: null, buffer: null, src: null, el: null,
    mode: null, loaded: false, loading: false, want: false,
    volume: clamp01(+(localStorage.getItem('chocoboMusicVol') ?? 0.6)),

    ensureLoaded() {
      if (this.loaded || this.loading || !actx) return;
      this.loading = true;
      this.gain = actx.createGain();
      this.gain.gain.value = muted ? 0 : this.volume;
      this.gain.connect(actx.destination);
      fetch(MUSIC_URL)
        .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
        .then(ab => actx.decodeAudioData(ab))
        .then(buf => { this.buffer = buf; this.mode = 'buffer'; this._ready(); })
        .catch(() => this._loadElement());
    },
    _loadElement() {
      try {
        this.el = new Audio(MUSIC_URL);
        this.el.loop = true; this.el.preload = 'auto';
        this.el.volume = muted ? 0 : this.volume;
        this.mode = 'element';
        this._ready();
      } catch (e) { this.loading = false; }
    },
    _ready() { this.loaded = true; this.loading = false; if (this.want) this.start(); },

    start() {
      this.want = true;
      if (muted) return;
      if (!this.loaded) { this.ensureLoaded(); return; }
      if (this.mode === 'buffer') {
        if (this.src) return;
        const s = actx.createBufferSource();
        s.buffer = this.buffer; s.loop = true;     // boucle gapless
        s.connect(this.gain); s.start();
        this.src = s;
      } else if (this.el) {
        this.el.volume = muted ? 0 : this.volume;
        this.el.play().catch(() => {});
      }
    },
    stop() {
      this.want = false;
      if (this.src) { try { this.src.stop(); } catch (e) {} this.src = null; }
      if (this.el) this.el.pause();
    },
    setVolume(v) {
      this.volume = clamp01(v);
      localStorage.setItem('chocoboMusicVol', this.volume);
      const g = muted ? 0 : this.volume;
      if (this.gain) this.gain.gain.value = g;
      if (this.el) this.el.volume = g;
    },
    applyMute() {
      if (muted) this.stop();
      else { this.setVolume(this.volume); if (state === 'playing') this.start(); }
    },
  };
  const musicStart = () => Music.start();
  const musicStop  = () => Music.stop();

  function toggleMute() {
    muted = !muted;
    localStorage.setItem('chocoboMuted', muted ? '1' : '0');
    muteEl.textContent = muted ? '🔇' : '🔊';
    Music.applyMute();
  }

  // init UI audio
  muteEl.textContent = muted ? '🔇' : '🔊';
  volEl.value = Music.volume;
  muteEl.addEventListener('click', e => { e.stopPropagation(); audioInit(); toggleMute(); });
  volEl.addEventListener('click', e => e.stopPropagation());
  volEl.addEventListener('input', e => {
    audioInit();
    const v = +e.target.value;
    if (muted && v > 0) { muted = false; localStorage.setItem('chocoboMuted','0'); muteEl.textContent = '🔊'; }
    Music.setVolume(v);
    if (state === 'playing') Music.start();
  });

  /* ====================== PIXEL-ART CHOCOBO ======================
     Sprite d'après assets/Chocobo.png. La palette est "swappable"
     pour obtenir la version jaune (J1) et la version bleue (J2).   */
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
  const LEGS_A = ["...oLLo.oLLo......","...oLo...oLo......","..CccC.CccC......."];
  const LEGS_B = ["...oLLo.oLLo......","....oLo.oLo.......","...CccC.CccC......"];
  const LEGS_JUMP = ["..oLLo.oLLo.......","..CccC.CccC......."];
  const frameRun1 = BODY.concat(LEGS_A);
  const frameRun2 = BODY.concat(LEGS_B);
  const frameJump = BODY.concat(LEGS_JUMP);
  const SPR_COLS = 18, SPR_ROWS = 21;

  // Palette jaune (or chaud, yeux bleus, joues roses, bandana vert)
  const PAL_YELLOW = {
    o:'#6b4a1e', O:'#4a3214', Y:'#f5c842', H:'#ffe79a', y:'#d9982f', a:'#bd7f24',
    b:'#e69a3a', B:'#c47a22', m:'#b33a2a', w:'#ffffff', e:'#3a7fc4', k:'#16243a',
    p:'#f0a3a3', s:'#86a83e', S:'#5e7d28', L:'#d98a3a', C:'#d8cfb8', c:'#8f856b',
  };
  // Palette bleue (azur, yeux ambre, bandana rouge)
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

  /* ====================== ENVIRONMENT PALETTE ====================== */
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

  /* ========================= LAYOUT / STATE ========================= */
  let state = 'menu';          // menu | playing | over
  let numPlayers = 1;
  let viewports = [];          // {x,y,w,h,gy,label,col}
  let worlds = [];
  let SC = 1, PX = 3, SPR_W = 0, SPR_H = 0, BASE_SPEED = 6;
  let speed = 6, frame = 0;
  let spawnTimer = 0, gilTimer = 0, airship = { x: 0, y: 0 };
  const VIEW_W = W;            // chaque viewport occupe toute la largeur
  let VIEW_GY = 0;             // sol de référence pour le spawn (vues identiques en multi)

  function makeWorld(pal, label, col) {
    return {
      pal, label, col,
      chocobo: { x: 96, y: 0, vy: 0, onGround: true, ducking: false },
      obstacles: [], gils: [], sparkles: [], feathers: [],
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
    if (ch.onGround) { ch.vy = -12.8 * SC; ch.onGround = false; world.holdJump = true; sfxJump(); }
  }
  const endJump = world => { if (world) world.holdJump = false; };
  const duck = (world, on) => { if (world && world.alive) world.chocobo.ducking = on; };

  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') { audioInit(); toggleMute(); return; }
    if (state === 'over') {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); startGame(numPlayers); }
      return;
    }
    if (state !== 'playing') return;
    if (numPlayers === 1) {
      if (['Space','ArrowUp','KeyW'].includes(e.code)) { e.preventDefault(); audioInit(); jump(worlds[0]); }
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
  // souris/tactile : commande le J1 (ou le joueur unique)
  canvas.addEventListener('mousedown', e => { e.preventDefault(); audioInit(); if(state==='playing') jump(worlds[0]); });
  window.addEventListener('mouseup', () => endJump(worlds[0]));
  canvas.addEventListener('touchstart', e => { e.preventDefault(); audioInit(); if(state==='playing') jump(worlds[0]); }, {passive:false});
  window.addEventListener('touchend', () => endJump(worlds[0]));

  menuBtns.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', e => { e.stopPropagation(); audioInit(); startGame(+b.dataset.n); }));
  document.getElementById('againBtn').addEventListener('click', e => { e.stopPropagation(); startGame(numPlayers); });
  document.getElementById('menuBtn').addEventListener('click', e => { e.stopPropagation(); showMenu(); });

  /* =========================== FLOW =========================== */
  function startGame(n) {
    configure(n); reset();
    state = 'playing'; overlay.classList.add('hidden');
    musicStart();
  }
  function showMenu() {
    state = 'menu'; musicStop();
    overlay.classList.remove('hidden');
    menuBtns.classList.remove('hidden'); overBtns.classList.add('hidden');
    document.querySelector('#overlay h1').textContent = '🐤 Chocobo Runner';
    ovmsg.textContent = 'Cours à travers les terres de cristal, saute les obstacles et ramasse les gils !';
    controls.innerHTML =
      '<span><b>1 Joueur</b> — <span class="key">Espace</span>/<span class="key">↑</span>/Clic sauter · <span class="key">↓</span> baisser</span>' +
      '<span><b>2 Joueurs</b> — J1 <span class="key">W</span>/<span class="key">S</span> · J2 <span class="key b">↑</span>/<span class="key b">↓</span></span>';
  }
  function gameOver() {
    state = 'over'; musicStop(); sfxDie();
    const top = Math.max(...worlds.map(w => Math.floor(w.score)));
    best = Math.max(best, top); localStorage.setItem('chocoboBest', best);
    overlay.classList.remove('hidden');
    menuBtns.classList.add('hidden'); overBtns.classList.remove('hidden');
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
  function genObstacle() {
    if (Math.random() < 0.66) {
      const h = (30 + Math.random()*32) * SC;
      return { type:'ground', x: VIEW_W+24, y: VIEW_GY - h, w: (22 + Math.random()*16)*SC, h };
    }
    const y = VIEW_GY - (66 + Math.random()*26) * SC;
    return { type:'fly', x: VIEW_W+24, y, w: 46*SC, h: 28*SC };
  }
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
      const o = genObstacle();
      aliveWorlds().forEach(w => w.obstacles.push({ ...o }));
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
    const gb = { x: g.x - g.r, y: g.y - g.r, w: g.r * 2, h: g.r * 2 };
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

    for (const o of w.obstacles) o.x -= speed;
    w.obstacles = w.obstacles.filter(o => o.x + o.w > -12);
    for (const g of w.gils) if (!g.got) g.x -= speed;
    w.gils = w.gils.filter(g => g.x > -20 && !g.got);

    for (const s of w.sparkles) { s.x += s.vx; s.y += s.vy; s.vy += 0.15; s.life--; }
    w.sparkles = w.sparkles.filter(s => s.life > 0);

    for (const f of w.feathers) {
      f.x += f.vx; f.sway += 0.05; f.y += Math.sin(f.sway) * 0.25;
      if (f.x < -10) { f.x = view.w + 10; f.y = Math.random()*view.h*0.6; }
    }

    const hb = hitbox(ch);
    for (const o of w.obstacles) if (overlap(hb, o)) { w.alive = false; if (numPlayers===1) sfxDie(); return; }
    for (const g of w.gils) {
      if (!g.got && overlap(hb, { x:g.x-g.r, y:g.y-g.r, w:g.r*2, h:g.r*2 })) {
        g.got = true; w.gilCount++; w.score += 10; sfxGil();
        for (let i=0;i<8;i++) w.sparkles.push({
          x:g.x, y:g.y, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.7)*4, life:24+Math.random()*10
        });
      }
    }
  }

  /* ========================= DRAW HELPERS ========================= */
  function poly(pts) { ctx.beginPath(); ctx.moveTo(pts[0],pts[1]); for(let i=2;i<pts.length;i+=2) ctx.lineTo(pts[i],pts[i+1]); ctx.closePath(); }
  function stroke(c, lw) { ctx.lineJoin='round'; ctx.lineCap='round'; ctx.strokeStyle=c; ctx.lineWidth=lw; ctx.stroke(); }
  function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  /* ========================= BACKGROUND ========================= */
  function drawBackground(vw, vh, gy, w) {
    // ciel en bandes (cell shading)
    const sky = ctx.createLinearGradient(0,0,0,gy+20);
    sky.addColorStop(0, ENV.sky[0]); sky.addColorStop(0.42, ENV.sky[1]);
    sky.addColorStop(0.72, ENV.sky[2]); sky.addColorStop(1, ENV.sky[3]);
    ctx.fillStyle = sky; ctx.fillRect(0,0,vw,gy+20);

    // soleil
    const sx = vw*0.74, sy = vh*0.26;
    ctx.fillStyle = ENV.sunGlow; ctx.beginPath(); ctx.arc(sx, sy, 58*SC+18, 0, 7); ctx.fill();
    ctx.fillStyle = ENV.sun;     ctx.beginPath(); ctx.arc(sx, sy, 40*SC+8, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.stroke();

    // nuages plats
    const co = (w.scroll*0.05) % (vw+260);
    for (let k=0;k<3;k++){
      const cx = ((k*340 - co) % (vw+260) + (vw+260)) % (vw+260) - 130;
      const cy = vh*(0.16 + k*0.07);
      toonCloud(cx, cy, (70 + k*12)*SC);
    }

    // montagnes lointaines (range arrière)
    drawRange(w.scroll*0.10, gy, 300*SC, 150*SC, ENV.mtnBack, ENV.mtnBackSh, true, vw);
    // montagnes proches (range avant)
    drawRange(w.scroll*0.18, gy, 230*SC, 118*SC, ENV.mtnFront, ENV.mtnFrontSh, true, vw);

    // château + cristaux flottants (couche médiane)
    const off2 = (w.scroll*0.34) % (520*SC);
    for (let i=-1; i*520*SC - off2 < vw + 520*SC; i++) {
      const bx = i*520*SC - off2;
      drawCastle(bx + 80*SC, gy, w.anim);
      drawCrystal(bx + 360*SC, gy - 150*SC, 1.0*SC, w.anim, i*2);
      drawCrystal(bx + 290*SC, gy - 205*SC, 0.7*SC, w.anim, i*2+1);
    }

    // dirigeable
    drawAirship(airship.x, vh*0.18 + (airship.y-50)*0.4, w.anim);

    // collines proches
    drawHills(w.scroll*0.55, gy, vw, vh);

    // plumes flottantes (ambiance)
    for (const f of w.feathers) drawFeather(f.x, f.y, f.r, f.sway);
  }

  function toonCloud(x, y, s) {
    ctx.fillStyle = ENV.cloud;
    ctx.beginPath();
    ctx.arc(x, y, s*0.5, 0, 7); ctx.arc(x+s*0.5, y+s*0.08, s*0.42, 0, 7);
    ctx.arc(x+s*0.95, y, s*0.36, 0, 7); ctx.arc(x+s*0.45, y-s*0.18, s*0.34, 0, 7);
    ctx.fill();
    ctx.fillStyle = ENV.cloudLit;
    ctx.beginPath(); ctx.ellipse(x+s*0.4, y-s*0.18, s*0.5, s*0.16, 0, 0, 7); ctx.fill();
  }

  function drawRange(scroll, gy, tw, th, base, shadow, snow, vw) {
    const off = scroll % tw;
    for (let i=-1; i*tw - off < vw + tw; i++) {
      const x = i*tw - off, peak = x + tw*0.5;
      ctx.fillStyle = base; poly([x, gy, peak, gy-th, x+tw, gy]); ctx.fill();
      ctx.fillStyle = shadow; poly([peak, gy-th, x+tw, gy, peak, gy]); ctx.fill();
      poly([x, gy, peak, gy-th, x+tw, gy]); stroke(ENV.out, 2);
      if (snow) {
        const cap = th*0.26;
        ctx.fillStyle = ENV.snow;
        poly([peak - cap*0.7, gy-th+cap, peak, gy-th, peak + cap*0.7, gy-th+cap, peak+cap*0.3, gy-th+cap*1.4, peak, gy-th+cap*0.9, peak-cap*0.3, gy-th+cap*1.4]); ctx.fill();
        ctx.fillStyle = ENV.snowSh;
        poly([peak, gy-th, peak+cap*0.7, gy-th+cap, peak+cap*0.3, gy-th+cap*1.4, peak, gy-th+cap*0.9]); ctx.fill();
      }
    }
  }

  function drawCastle(x, gy, anim) {
    const u = SC;
    ctx.fillStyle = ENV.castle; ctx.fillRect(x, gy-92*u, 94*u, 92*u);
    ctx.fillStyle = ENV.castleSh; ctx.fillRect(x+60*u, gy-92*u, 34*u, 92*u);
    roundRect(x, gy-92*u, 94*u, 92*u, 2); stroke(ENV.out, 2);
    for (const tx of [x-16*u, x+94*u]) {
      ctx.fillStyle = ENV.castle; ctx.fillRect(tx, gy-72*u, 16*u, 72*u);
      ctx.fillStyle = ENV.castleSh; ctx.fillRect(tx+10*u, gy-72*u, 6*u, 72*u);
      ctx.fillStyle = ENV.roof; poly([tx-3*u, gy-72*u, tx+8*u, gy-92*u, tx+19*u, gy-72*u]); ctx.fill(); stroke(ENV.out,2);
    }
    ctx.fillStyle = ENV.castle; ctx.fillRect(x+32*u, gy-132*u, 30*u, 44*u);
    ctx.fillStyle = ENV.castleSh; ctx.fillRect(x+50*u, gy-132*u, 12*u, 44*u);
    ctx.fillStyle = ENV.roof; poly([x+28*u, gy-132*u, x+47*u, gy-162*u, x+66*u, gy-132*u]); ctx.fill();
    ctx.fillStyle = ENV.roofSh; poly([x+47*u, gy-162*u, x+66*u, gy-132*u, x+47*u, gy-132*u]); ctx.fill();
    poly([x+28*u, gy-132*u, x+47*u, gy-162*u, x+66*u, gy-132*u]); stroke(ENV.out, 2);
    ctx.fillStyle = ENV.castle;
    for (let i=0;i<5;i++) ctx.fillRect(x+6*u+i*18*u, gy-100*u, 10*u, 10*u);
    const glow = 0.6 + 0.4*Math.sin(anim*0.05);
    ctx.fillStyle = `rgba(255,231,164,${glow})`;
    ctx.fillRect(x+42*u, gy-118*u, 10*u, 16*u);
    ctx.fillRect(x+18*u, gy-58*u, 9*u, 14*u);
    ctx.fillRect(x+64*u, gy-58*u, 9*u, 14*u);
  }

  function drawCrystal(x, y, s, anim, idx) {
    // bob basé sur le temps d'animation (stable) + phase par cristal — pas de jitter
    const bob = Math.sin(anim*0.045 + idx*1.7) * 6 * SC;
    y += bob;
    ctx.save();
    ctx.fillStyle = ENV.crystalGlow;
    ctx.beginPath(); ctx.arc(x, y, 30*s, 0, 7); ctx.fill();
    const top=y-34*s, bot=y+32*s;
    ctx.fillStyle = ENV.crystalMid;
    poly([x, top, x+17*s, y-6*s, x+11*s, bot, x-11*s, bot, x-17*s, y-6*s]); ctx.fill();
    ctx.fillStyle = ENV.crystalSh;
    poly([x, top, x+17*s, y-6*s, x+11*s, bot, x, y]); ctx.fill();
    ctx.fillStyle = ENV.crystal;
    poly([x, top, x-17*s, y-6*s, x-11*s, bot, x, y]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    poly([x, top, x-9*s, y-4*s, x-3*s, y]); ctx.fill();
    poly([x, top, x+17*s, y-6*s, x+11*s, bot, x-11*s, bot, x-17*s, y-6*s]); stroke(ENV.out, 2);
    ctx.restore();
  }

  function drawAirship(x, y, anim) {
    const u = SC, bob = Math.sin(anim*0.04)*4*u; y += bob;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#b3414f'; ctx.beginPath(); ctx.ellipse(64*u, 0, 64*u, 26*u, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7e2c38'; ctx.beginPath(); ctx.ellipse(64*u, 8*u, 64*u, 18*u, 0, 0.15, Math.PI-0.15); ctx.fill();
    ctx.fillStyle = '#e8e2d2'; ctx.beginPath(); ctx.ellipse(64*u, -8*u, 60*u, 12*u, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(64*u,0,64*u,26*u,0,0,7); stroke(ENV.out, 2);
    ctx.fillStyle = '#6b4a2a'; roundRect(34*u, 22*u, 64*u, 16*u, 4*u); ctx.fill(); stroke(ENV.out,2);
    ctx.fillStyle = '#d8b15a'; poly([42*u,22*u, 42*u,4*u, 60*u,22*u]); ctx.fill(); stroke(ENV.out,2);
    ctx.restore();
  }

  function drawHills(scroll, gy, vw, vh) {
    const tw = 260*SC, off = scroll % tw;
    for (let i=-1; i*tw - off < vw + tw; i++) {
      const x = i*tw - off;
      ctx.fillStyle = ENV.hill;
      ctx.beginPath(); ctx.ellipse(x + tw*0.5, gy + 36*SC, tw*0.62, 64*SC, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = ENV.hillRim;
      ctx.beginPath(); ctx.ellipse(x + tw*0.5, gy + 36*SC, tw*0.62, 64*SC, 0, Math.PI*1.15, Math.PI*1.85); ctx.fill();
      drawTree(x + tw*0.78, gy);
    }
  }

  function drawTree(x, gy) {
    const u = SC;
    ctx.fillStyle = ENV.trunk; ctx.fillRect(x-4*u, gy-30*u, 8*u, 32*u);
    roundRect(x-4*u, gy-30*u, 8*u, 32*u, 2); stroke(ENV.out, 2);
    ctx.fillStyle = ENV.leaf;
    ctx.beginPath(); ctx.arc(x, gy-40*u, 20*u, 0, 7); ctx.arc(x-12*u, gy-34*u, 13*u, 0, 7); ctx.arc(x+12*u, gy-36*u, 13*u, 0, 7); ctx.fill();
    ctx.fillStyle = ENV.leafSh;
    ctx.beginPath(); ctx.arc(x+7*u, gy-34*u, 14*u, 0, 7); ctx.fill();
    ctx.fillStyle = ENV.leafLit;
    ctx.beginPath(); ctx.arc(x-7*u, gy-46*u, 9*u, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x, gy-40*u, 20*u, 0, 7); ctx.arc(x-12*u, gy-34*u, 13*u, 0, 7); ctx.arc(x+12*u, gy-36*u, 13*u, 0, 7); stroke(ENV.out, 2);
  }

  function drawFeather(x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(rot)*0.6);
    ctx.fillStyle = 'rgba(255,228,150,.55)';
    ctx.beginPath(); ctx.ellipse(0,0,r,r*0.42,0,0,7); ctx.fill();
    ctx.restore();
  }

  /* ========================= FOREGROUND ========================= */
  function drawGround(vw, vh, gy, w) {
    ctx.fillStyle = ENV.ground; ctx.fillRect(0, gy, vw, vh-gy);
    ctx.fillStyle = ENV.groundTop; ctx.fillRect(0, gy, vw, 7*SC);
    ctx.fillStyle = ENV.dirt;
    const off = w.scroll % (44*SC);
    for (let x=-off; x<vw; x+=44*SC) { roundRect(x, gy+18*SC, 9*SC, 5*SC, 2); ctx.fill(); }
    ctx.strokeStyle = ENV.tuft; ctx.lineWidth = 2*SC; ctx.lineCap='round';
    for (let x=-off; x<vw; x+=44*SC) {
      ctx.beginPath(); ctx.moveTo(x+22*SC, gy+8*SC); ctx.lineTo(x+22*SC, gy+1*SC);
      ctx.moveTo(x+26*SC, gy+8*SC); ctx.lineTo(x+28*SC, gy+2*SC); ctx.stroke();
    }
  }

  function drawObstacle(o) {
    if (o.type === 'ground') {
      ctx.fillStyle = '#7a5a86'; roundRect(o.x, o.y, o.w, o.h, 5*SC); ctx.fill();
      ctx.fillStyle = '#5e4068'; roundRect(o.x + o.w*0.5, o.y, o.w*0.5, o.h, 5*SC); ctx.fill();
      roundRect(o.x, o.y, o.w, o.h, 5*SC); stroke(ENV.out, 2);
      ctx.fillStyle = ENV.crystal;
      roundRect(o.x + o.w*0.32, o.y + o.h*0.18, o.w*0.18, o.h*0.5, 2); ctx.fill();
    } else {
      const u = SC;
      ctx.save(); ctx.translate(o.x, o.y);
      const up = ((frame>>3)&1) ? -11*u : 7*u;
      ctx.fillStyle = '#9b86ff';
      poly([18*u,12*u, 2*u,up, 22*u,16*u]); ctx.fill();
      poly([26*u,12*u, 42*u,up, 24*u,16*u]); ctx.fill();
      ctx.fillStyle = '#7a5cff'; ctx.beginPath(); ctx.ellipse(22*u,15*u,15*u,9*u,0,0,7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(22*u,15*u,15*u,9*u,0,0,7); stroke(ENV.out, 2);
      ctx.fillStyle = '#ff9b2e'; poly([35*u,13*u, 47*u,15*u, 35*u,17*u]); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(30*u,12*u,3*u,0,7); ctx.fill();
      ctx.fillStyle = '#161616'; ctx.beginPath(); ctx.arc(31*u,12*u,1.6*u,0,7); ctx.fill();
      ctx.restore();
    }
  }

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

    drawBackground(view.w, view.h, view.gy, w);
    drawGround(view.w, view.h, view.gy, w);
    for (const g of w.gils) drawGil(g, w.anim);
    for (const o of w.obstacles) drawObstacle(o);
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
    ctx.clearRect(0,0,W,H);
    viewports.forEach((v, i) => renderView(v, worlds[i] || worlds[0]));
    if (numPlayers === 2) { ctx.fillStyle = '#0c0913'; ctx.fillRect(0, H/2-2, W, 4); }
  }

  function loop() {
    if (state === 'playing') update();
    if (worlds.length) render();
    requestAnimationFrame(loop);
  }

  // démarrage : monde de fond pour l'écran de menu
  configure(1); reset();
  showMenu();
  loop();
})();
