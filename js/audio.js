/* =====================================================================
   Chocobo Runner — Module Audio
   Web Audio API : musique de fond + effets sonores synthétisés.
   ===================================================================== */
var CR = CR || {};
CR.Audio = (function () {
  let actx = null;
  let muted = (localStorage.getItem('chocoboMuted') === '1');
  const clamp01 = v => (isNaN(v) ? 0.6 : Math.max(0, Math.min(1, v)));

  function audioInit() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === 'suspended') actx.resume();
    Music.ensureLoaded();
  }

  /* ---- effets sonores (oscillateurs Web Audio) ---- */
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
     Chemin 1 (HTTP) : fetch → decodeAudioData → AudioBufferSource (boucle gapless)
     Chemin 2 (file://) : élément <audio loop> (repli robuste) */
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
        s.buffer = this.buffer; s.loop = true;
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
      else { this.setVolume(this.volume); if (this.want) this.start(); }
    },
  };

  function getMuted() { return muted; }
  function setMuted(v) {
    muted = !!v;
    localStorage.setItem('chocoboMuted', muted ? '1' : '0');
    Music.applyMute();
  }

  return { audioInit, sfxJump, sfxGil, sfxDie, Music, getMuted, setMuted };
})();
