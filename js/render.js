'use strict';
// Rendering: world (depth-sorted), particles, HUD, menus. Also boots the main loop.
Object.assign(Game, {
  render() {
    const c = ctx;
    c.save();
    if (this.shake > 0.3) c.translate(Math.round(rand(-1, 1) * this.shake * 0.5), Math.round(rand(-1, 1) * this.shake * 0.5));
    drawStadium(c, this.time, this.hype);
    c.drawImage(this.pitch, 0, 0);
    drawEndBoards(c);

    // ground shadows
    for (const p of this.players) shadow(c, p.x, p.y, p.z, p.state === 'slide' || p.state === 'stun' ? 7 : 5);
    shadow(c, this.ball.x, this.ball.y, this.ball.z, 3);

    // depth-sorted drawables
    const list = [];
    for (const p of this.players) list.push([p.y, () => p.draw(c, this)]);
    list.push([this.ball.y + 0.1, () => this.ball.draw(c)]);
    for (const side of [0, 1]) {
      list.push([GOAL_Y1 - 0.5, () => drawGoalBack(c, side)]);
      list.push([GOAL_Y2 + 0.5, () => drawGoalFront(c, side)]);
    }
    list.sort((a, b) => a[0] - b[0]);
    for (const [, fn] of list) fn();

    for (const p of this.particles) {
      const [sx, sy] = proj(p.x, p.y, p.z);
      c.globalAlpha = Math.min(1, p.life / 0.3);
      c.fillStyle = p.color;
      c.fillRect(Math.round(sx), Math.round(sy), p.confetti && Math.sin(p.life * 20) > 0 ? 2 : 1, 1);
    }
    c.globalAlpha = 1;
    for (const p of this.popups) {
      if (p.t < 0) continue;
      const [sx, sy] = proj(p.x, p.y, 34 + p.t * 18);
      if (p.t < 0.9 || Math.floor(p.t * 20) % 2) drawText(c, p.text, sx, sy, 1, p.color, 'center');
    }
    c.restore();

    if (this.state !== 'title') this.drawHUD(c);
    if (this.state === 'title') this.drawTitle(c);
    else if (this.state === 'kickoff') this.drawBanner(c, this.stateT > 0.5 ? 'READY' : 'GO!', '#ffffff', 3);
    else if (this.state === 'goal') this.drawGoalBanner(c);
    else if (this.state === 'end') this.drawEnd(c);
    if (this.paused) this.drawPause(c);
    if (this.muted) drawText(c, 'MUTE', VW - 4, VH - 8, 1, '#888', 'right');
    if (this.fade > 0) { c.fillStyle = `rgba(0,0,0,${this.fade})`; c.fillRect(0, 0, VW, VH); }
  },

  drawHUD(c) {
    const cx = VW / 2, t0 = TEAM_COLORS[0], t1 = TEAM_COLORS[1];
    c.fillStyle = '#0b0d18'; c.fillRect(cx - 70, 2, 140, 26);
    c.fillStyle = '#3a4270'; c.fillRect(cx - 70, 2, 140, 1); c.fillRect(cx - 70, 27, 140, 1);
    c.fillStyle = t0.main; c.fillRect(cx - 70, 3, 34, 15);
    c.fillStyle = t1.main; c.fillRect(cx + 36, 3, 34, 15);
    drawText(c, 'P1 ' + t0.name, cx - 53, 8, 1, '#fff', 'center', t0.dark);
    drawText(c, t1.name + ' P2', cx + 53, 8, 1, '#fff', 'center', t1.dark);
    drawText(c, this.score[0], cx - 14, 5, 2, '#fff', 'center');
    drawText(c, this.score[1], cx + 15, 5, 2, '#fff', 'center');
    drawText(c, '-', cx, 7, 1, '#888', 'center', null);
    let clock;
    if (this.golden) clock = 'GOLDEN GOAL';
    else {
      const s = Math.ceil(this.clock);
      clock = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }
    const low = !this.golden && this.clock < 10 && this.state === 'play';
    drawText(c, clock, cx, 20, 1, this.golden ? '#ffe14a' : low && Math.floor(this.time * 4) % 2 ? '#ff5050' : '#cfd6ff', 'center', null);
  },

  drawBanner(c, text, color, scale) {
    const w = textWidth(text, scale);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, VH / 2 - 14 - scale * 2, VW, 20 + scale * 5);
    drawText(c, text, VW / 2, VH / 2 - 12, scale, color, 'center');
    return w;
  },
  drawGoalBanner(c) {
    const team = this.lastScorer, col = TEAM_COLORS[team];
    const age = 3.2 - this.stateT, sc = age < 0.25 ? Math.max(2, Math.round(8 - age * 16)) : 6;
    c.fillStyle = col.dark; c.fillRect(0, VH / 2 - 26, VW, 46);
    c.fillStyle = col.main; c.fillRect(0, VH / 2 - 24, VW, 42);
    const wob = Math.round(Math.sin(this.time * 12) * 1.5);
    drawText(c, 'GOAL!', VW / 2, VH / 2 - 20 + wob, sc, Math.floor(this.time * 8) % 2 ? '#ffffff' : '#ffe14a', 'center', '#000');
    drawText(c, 'P' + (team + 1) + ' ' + col.name + ' SCORES   ' + this.score[0] + ' - ' + this.score[1], VW / 2, VH / 2 + 22, 1, '#fff', 'center');
  },
  drawEnd(c) {
    c.fillStyle = 'rgba(8,10,20,0.72)'; c.fillRect(0, 60, VW, 130);
    const w = this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
    drawText(c, 'FULL TIME', VW / 2, 72, 2, '#cfd6ff', 'center');
    if (w < 0) drawText(c, 'DRAW', VW / 2, 92, 5, '#ffffff', 'center');
    else drawText(c, 'P' + (w + 1) + ' ' + TEAM_COLORS[w].name + ' WINS!', VW / 2, 92, 4, TEAM_COLORS[w].light, 'center');
    drawText(c, this.score[0] + ' - ' + this.score[1], VW / 2, 126, 3, '#fff', 'center');
    if (Math.floor(this.time * 2) % 2) drawText(c, 'SPACE: REMATCH', VW / 2, 156, 1, '#ffe14a', 'center');
    drawText(c, 'ESC: MENU', VW / 2, 168, 1, '#8890b8', 'center');
  },
  drawPause(c) {
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, VW, VH);
    drawText(c, 'PAUSED', VW / 2, 100, 4, '#fff', 'center');
    drawText(c, 'P / ESC: RESUME    Q: QUIT TO MENU', VW / 2, 136, 1, '#cfd6ff', 'center');
  },
  drawTitle(c) {
    c.fillStyle = 'rgba(8,10,24,0.55)'; c.fillRect(0, 0, VW, VH);
    const bob = Math.round(Math.sin(this.time * 3) * 2);
    drawText(c, 'PIXEL', VW / 2 - 2, 26 + bob, 6, TEAM_COLORS[0].main, 'center', '#000');
    drawText(c, 'KICK', VW / 2 + 2, 62 - bob, 6, TEAM_COLORS[1].main, 'center', '#000');
    drawText(c, '2.5D  PIXEL SOCCER  -  1 VS 1', VW / 2, 100, 1, '#ffe14a', 'center');
    const len = MATCH_LENGTHS[this.lenIdx] / 60;
    drawText(c, '<  MATCH: ' + len + ' MIN  >', VW / 2, 120, 2, '#ffffff', 'center');
    if (Math.floor(this.time * 2) % 2) drawText(c, 'PRESS SPACE TO KICK OFF', VW / 2, 146, 2, '#9cffb0', 'center');
    const y = 178;
    drawText(c, 'P1  RED', 110, y, 1, TEAM_COLORS[0].light, 'center');
    drawText(c, 'MOVE: W A S D', 110, y + 10, 1, '#cfd6ff', 'center');
    drawText(c, 'SHOOT/TACKLE: F', 110, y + 18, 1, '#cfd6ff', 'center');
    drawText(c, 'LOB/JUMP: G', 110, y + 26, 1, '#cfd6ff', 'center');
    drawText(c, 'P2  BLU', VW - 110, y, 1, TEAM_COLORS[1].light, 'center');
    drawText(c, 'MOVE: ARROWS', VW - 110, y + 10, 1, '#cfd6ff', 'center');
    drawText(c, 'SHOOT/TACKLE: K OR .', VW - 110, y + 18, 1, '#cfd6ff', 'center');
    drawText(c, 'LOB/JUMP: L OR /', VW - 110, y + 26, 1, '#cfd6ff', 'center');
    drawText(c, 'HOLD TO CHARGE - AIM WITH DIRECTION', VW / 2, y + 44, 1, '#8890b8', 'center');
  },
});

// ---------- main loop (fixed 60 Hz simulation) ----------
(function boot() {
  Game.init();
  const STEP = 1 / 60;
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    Game.handleKeys();
    let n = 0;
    while (acc >= STEP && n++ < 5) { Input.poll(); Game.update(STEP); acc -= STEP; }
    Game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
