'use strict';
// Game state machine, events, particles, render and main loop.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VW; canvas.height = VH;
ctx.imageSmoothingEnabled = false;

function fitCanvas() {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / VW, (innerHeight - 120) / VH) * 2) / 2);
  canvas.style.width = VW * s + 'px'; canvas.style.height = VH * s + 'px';
}
addEventListener('resize', fitCanvas); fitCanvas();

const Game = {
  state: 'title', stateT: 0, time: 0, paused: false, muted: false,
  lenIdx: 1, clock: 120, score: [0, 0], golden: false, lastScorer: -1, kickTeam: 0,
  shake: 0, fade: 0, hype: [0, 0], particles: [], popups: [], bounceCd: 0,
  pitch: buildPitch(),
  ball: new Ball(),
  players: [],

  init() {
    this.players = [
      new Player(0, false, 0, LOOKS[0]), new Player(1, false, 1, LOOKS[1]),
      new Player(0, true, null, LOOKS[2]), new Player(1, true, null, LOOKS[3]),
    ];
    this.toTitle();
  },

  toTitle() {
    this.state = 'title'; this.paused = false;
    this.placeKickoff(0); this.ball.vz = 160;
  },
  startMatch() {
    this.score = [0, 0]; this.clock = MATCH_LENGTHS[this.lenIdx]; this.golden = false;
    this.particles.length = 0; this.popups.length = 0;
    this.beginKickoff(Math.random() < 0.5 ? 0 : 1);
  },
  placeKickoff(team) {
    const cx = FIELD.W / 2, cy = FIELD.D / 2;
    this.ball.reset(cx, cy);
    for (const p of this.players) {
      let x, y = cy;
      if (p.keeper) x = p.team === 0 ? 6 : FIELD.W - 6;
      else x = cx - p.attack * (p.team === team ? 10 : 60);
      p.reset(x, y);
    }
  },
  beginKickoff(team) {
    this.kickTeam = team;
    this.placeKickoff(team);
    this.state = 'kickoff'; this.stateT = 1.6; this.fade = 1;
  },

  // ---------- events ----------
  sfx(name, arg) { Sound[name] && Sound[name](arg); },
  sfxBounce(v) { if (v > 0.15 && this.bounceCd <= 0) { Sound.bounce(v); this.bounceCd = 0.05; } },
  onGoal(side) {
    if (this.state !== 'play') return;
    const team = side === 0 ? 1 : 0;
    this.score[team]++; this.lastScorer = team;
    this.state = 'goal'; this.stateT = 3.2; this.shake = 10; this.hype[team] = 4;
    Sound.goal(); Sound.whistle(0.25);
    const gx = side === 0 ? 0 : FIELD.W;
    for (let i = 0; i < 90; i++) {
      const c = Math.random() < 0.7 ? TEAM_COLORS[team].main : ['#ffffff', '#ffe14a', TEAM_COLORS[team].light][i % 3];
      this.particles.push({ x: gx + rand(-10, 10), y: FIELD.D / 2 + rand(-40, 40), z: rand(30, 70),
        vx: rand(-80, 80), vy: rand(-60, 60), vz: rand(40, 160), life: rand(1.5, 3), max: 3, color: c, size: 1, grav: 120, confetti: true });
    }
    // celebration: scorer runs to the corner, others stop
    for (const p of this.players) {
      p.charging = null;
      if (p.team === team && !p.keeper) { p.tx = side === 0 ? 40 : FIELD.W - 40; p.ty = p.y < FIELD.D / 2 ? 0 : FIELD.D; }
      else { p.tx = p.x; p.ty = p.y; }
    }
    if (this.golden) this.stateT = 3.6;
  },
  onPost() { Sound.post(); this.shake = Math.max(this.shake, 3); if (this.state === 'play') { this.popup('POST!', '#ffe14a'); Sound.oohh(); } },
  onKick(p, power, header) {
    Sound.kick(power);
    if (power > 0.8) { this.shake = Math.max(this.shake, 3); this.popup(header ? 'HEADER!' : 'POWER!', '#ff8a5a', p); }
    else if (header) this.popup('HEADER!', '#ffffff', p);
    for (let i = 0; i < 4 + power * 8; i++) this.particles.push({ x: this.ball.x, y: this.ball.y, z: 1,
      vx: rand(-40, 40), vy: rand(-30, 30), vz: rand(30, 90), life: rand(0.3, 0.6), max: 0.6,
      color: Math.random() < 0.6 ? '#3c8a3c' : '#7ac060', size: 1, grav: 300 });
  },
  onTackle(p, won) { Sound.tackle(); this.shake = Math.max(this.shake, 2); if (won) this.popup('TACKLE!', '#ffffff', p); },
  keeperTouch(k) {
    const b = this.ball, towards = -b.vx * k.attack, sp = b.speed;
    if (towards > 60 && sp > 120) {
      const pCatch = clamp(1.32 - sp / 300, 0.12, 0.95) * (k.state === 'dive' ? 0.8 : 1);
      if (Math.random() > pCatch) {
        b.kick(k.attack * rand(80, 150), b.vy * 0.4 + rand(-90, 90), rand(60, 120), k);
        k.pickCd = 0.45; Sound.kick(0.4); Sound.oohh(); this.popup('SAVE!', '#9cffb0', k);
        return;
      }
      this.popup('CATCH!', '#9cffb0', k);
    }
    b.owner = k; b.lastTouch = k; b.vx = b.vy = b.vz = 0; k.holdT = 0;
    Sound.catchBall();
  },
  popup(text, color, p) {
    const src = p || this.ball;
    this.popups.push({ text, color, x: src.x, y: src.y, t: 0 });
  },
  dust(x, y, n) {
    for (let i = 0; i < n; i++) this.particles.push({ x: x + rand(-3, 3), y: y + rand(-2, 2), z: 0,
      vx: rand(-25, 25), vy: rand(-12, 12), vz: rand(15, 45), life: rand(0.25, 0.5), max: 0.5,
      color: '#d8e0b8', size: 1, grav: 120 });
  },

  // ---------- simulation ----------
  update(dt) {
    this.time += dt; this.bounceCd -= dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.fade = Math.max(0, this.fade - dt * 2.5);
    this.hype = this.hype.map(h => Math.max(0, h - dt));
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter(p => p.t < 1.1);

    if (this.state === 'title') { this.titleDemo(dt); this.updateParticles(dt); return; }
    if (this.paused) return;

    if (this.state === 'kickoff') {
      this.stateT -= dt;
      if (this.stateT <= 0) { this.state = 'play'; Sound.whistle(0.4); }
    } else if (this.state === 'play') {
      if (!this.golden) {
        this.clock -= dt;
        if (this.clock <= 0) {
          this.clock = 0;
          if (this.score[0] === this.score[1]) { this.golden = true; this.popups.push({ text: 'GOLDEN GOAL!', color: '#ffe14a', x: FIELD.W / 2, y: FIELD.D / 2, t: -1.2 }); Sound.whistle(0.3, 2); }
          else this.endMatch();
        }
      }
    } else if (this.state === 'goal') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        if (this.golden) this.endMatch(); else this.beginKickoff(this.lastScorer === 0 ? 1 : 0);
      }
    }

    for (const p of this.players) p.update(dt, this);
    this.collidePlayers();
    if (this.state !== 'kickoff') this.ball.update(dt, this);
    this.updateParticles(dt);
  },
  endMatch() {
    this.state = 'end'; this.stateT = 0; Sound.whistle(0.3, 3);
    const w = this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
    this.winner = w; if (w >= 0) this.hype[w] = 99;
    for (const p of this.players) { p.tx = p.x; p.ty = p.y; }
  },
  collidePlayers() {
    const ps = this.players, m = PHYS.playerR * 2;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      if (a.state === 'slide' || b.state === 'slide') continue;
      const dx = b.x - a.x, dy = (b.y - a.y) * 1.4, d = Math.hypot(dx, dy);
      if (d < m && d > 0.01) {
        const push = (m - d) / 2, nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push * 0.7; b.x += nx * push; b.y += ny * push * 0.7;
      }
    }
  },
  titleDemo(dt) {
    const b = this.ball;
    b.vx = 0; b.vy = 0;
    if (b.z <= 0 && b.vz <= 0) { b.vz = 170; }
    b.vz -= PHYS.gravity * dt; b.z = Math.max(0, b.z + b.vz * dt); b.roll += dt * 20;
    for (const p of this.players) { p.anim += dt; p.vx = p.vy = 0; }
  },
  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vz -= p.grav * dt;
      if (p.confetti) { p.vx *= 0.98; p.vy *= 0.98; if (p.vz < -30) p.vz = -30; p.x += Math.sin(this.time * 8 + p.life * 5) * 0.4; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; }
    }
    this.particles = this.particles.filter(p => p.life > 0);
  },

  // ---------- input handling for menus / pause ----------
  handleKeys() {
    const keys = Input.takePresses();
    const any = c => keys.includes(c);
    const confirm = any('Space') || any('Enter') || any('NumpadEnter') || any('PadStart');
    if (any('KeyM')) this.muted = Sound.toggleMute();
    if (this.state === 'title') {
      if (any('ArrowLeft') || any('KeyA')) { this.lenIdx = (this.lenIdx + MATCH_LENGTHS.length - 1) % MATCH_LENGTHS.length; Sound.blip(); }
      if (any('ArrowRight') || any('KeyD')) { this.lenIdx = (this.lenIdx + 1) % MATCH_LENGTHS.length; Sound.blip(); }
      if (confirm) { Sound.blip(true); this.startMatch(); }
    } else if (this.state === 'end') {
      if (confirm) { Sound.blip(true); this.startMatch(); }
      if (any('Escape')) this.toTitle();
    } else {
      if (any('KeyP') || any('Escape') || any('PadStart')) { this.paused = !this.paused; Sound.blip(); }
      else if (this.paused && any('KeyQ')) this.toTitle();
    }
  },
};
