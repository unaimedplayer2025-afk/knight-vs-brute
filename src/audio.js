// WebAudio SFX + John's tracks (OGG with MP3 fallback via canPlayType).
// First user gesture calls Snd.start() to unlock playback. M toggles mute.
//
// MUSIC: none shipped yet (sound effects only). To add a track later, drop
// audio/<name>.ogg + audio/<name>.mp3 into the repo and set the names below, e.g.
//   const MUSIC = { title: 'audio/title', fight: 'audio/fight' };
// The OGG/MP3 pick (canPlayType), first-key unlock, fades and M-to-mute are already wired.
const MUSIC = { title: null, fight: null };
const Snd = {
  ctx: null, muted: false, ready: false, unlocked: false,
  titleAud: null, gameAud: null, musicMode: 'title',
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } else {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    this.ready = !!this.ctx;
    this.unlocked = true;
    this._makeTracks();
    this._kickMusic();
  },
  _pick(base) {
    const a = document.createElement('audio');
    const ogg = a.canPlayType('audio/ogg; codecs="vorbis"') || a.canPlayType('audio/ogg; codecs="opus"');
    return ogg ? base + '.ogg' : base + '.mp3';
  },
  _makeTracks() {
    if (this._made) return; this._made = true;
    const make = (base) => {
      if (!base) return null;
      const a = new Audio(this._pick(base));
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      return a;
    };
    this.titleAud = make(MUSIC.title);
    this.gameAud = make(MUSIC.fight);
  },
  setScene(mode) {
    this.musicMode = (mode === 'title' || mode === 'end') ? 'title' : 'game';
  },
  _kickMusic() {
    if (!this.unlocked || this.muted) return;
    const a = this.musicMode === 'title' ? this.titleAud : this.gameAud;
    if (a && a.paused) {
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    }
  },
  update(dt) {
    if (!this.titleAud && !this.gameAud) return;
    const fade = 1.4;
    const tracks = [
      [this.titleAud, this.musicMode === 'title' ? 0.46 : 0],
      [this.gameAud, this.musicMode === 'game' ? 0.42 : 0],
    ];
    for (const [a, vol] of tracks) {
      if (!a) continue;
      const target = (!this.muted && this.unlocked) ? vol : 0;
      if (a.volume < target) a.volume = Math.min(target, a.volume + dt * fade * Math.max(target, 0.4));
      else if (a.volume > target) a.volume = Math.max(target, a.volume - dt * fade * 0.5);
      if (target > 0.01 && a.paused && this.unlocked && !this.muted) {
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
      }
      if (target <= 0 && a.volume < 0.02 && !a.paused) a.pause();
    }
  },
  setMuted(m) {
    this.muted = m;
    if (m) {
      if (this.titleAud) this.titleAud.pause();
      if (this.gameAud) this.gameAud.pause();
    } else {
      if (!this.unlocked) this.start();
      else this._kickMusic();
    }
  },
  toggleMute() { this.setMuted(!this.muted); return this.muted; },
  _out() { if (!this.ctx || this.muted) return null; if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
  tone(freq, dur, type = 'square', vol = 0.08, slide = 0) {
    const c = this._out(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
  },
  noise(dur, vol = 0.1, freq = 800, type = 'lowpass') {
    const c = this._out(); if (!c) return;
    const n = c.createBufferSource(), buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    n.connect(f); f.connect(g); g.connect(c.destination); n.start();
  },
  _master(vol) { return vol; },
  whoosh(p = 1) { this.noise(0.18, 0.13, 1600 * p, 'bandpass'); this.tone(520 * p, 0.14, 'sine', 0.035, 180 * p); },
  hit(big) { this.noise(big ? 0.22 : 0.12, big ? 0.3 : 0.2, 1100, 'lowpass'); this.tone(big ? 120 : 190, big ? 0.22 : 0.12, 'square', 0.08, 50); this.noise(0.06, 0.12, 3200, 'highpass'); },
  clang() { this.tone(1250, 0.25, 'triangle', 0.06, 900); this.tone(1870, 0.18, 'triangle', 0.04, 1500); this.noise(0.08, 0.12, 2600, 'highpass'); },
  hurt() { this.tone(240, 0.25, 'sawtooth', 0.09, 70); this.noise(0.14, 0.18, 700); },
  roll() { this.noise(0.22, 0.08, 500, 'lowpass'); },
  smash() { this.noise(0.6, 0.38, 260, 'lowpass'); this.tone(55, 0.6, 'sine', 0.3, 28); },
  step() { this.noise(0.09, 0.12, 160, 'lowpass'); },
  roar(long) { const d = long ? 2.6 : 1.1; this.noise(d, 0.26, 420, 'lowpass'); this.tone(78, d, 'sawtooth', 0.12, 38); this.tone(116, d * 0.9, 'sawtooth', 0.06, 60); },
  growl() { this.tone(70, 0.45, 'sawtooth', 0.07, 50); this.noise(0.4, 0.08, 300, 'lowpass'); },
  wave() { this.noise(0.5, 0.16, 2200, 'bandpass'); this.tone(330, 0.5, 'sawtooth', 0.06, 1200); this.tone(660, 0.45, 'sine', 0.05, 1800); },
  charge() { this.tone(160, 0.35, 'sawtooth', 0.05, 420); },
  stab() { this.tone(900, 0.12, 'triangle', 0.05, 300); this.noise(0.18, 0.22, 900, 'lowpass'); },
  magic() { this.tone(220, 2.2, 'sine', 0.06, 880); this.tone(330, 2.2, 'sine', 0.04, 1320); this.noise(2.0, 0.06, 2400, 'bandpass'); },
  win() { this.tone(392, 0.3, 'triangle', 0.08); setTimeout(() => this.tone(523, 0.3, 'triangle', 0.08), 220); setTimeout(() => this.tone(784, 0.7, 'triangle', 0.08), 440); },
  lose() { this.tone(220, 0.9, 'sawtooth', 0.07, 55); },
  ui() { this.tone(660, 0.08, 'square', 0.04, 990); },
  transform() { this.noise(1.4, 0.24, 300, 'lowpass'); this.tone(60, 1.4, 'sawtooth', 0.12, 120); },
};
export default Snd;
