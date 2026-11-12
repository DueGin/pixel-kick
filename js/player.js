'use strict';
// Players: human-controlled strikers and AI goalkeepers.
const LOOKS = [
  { hair: '#4a2a18', skin: '#f0c090' }, { hair: '#e8c050', skin: '#c88a5a' },
  { hair: '#18141c', skin: '#d8a070' }, { hair: '#b04020', skin: '#f4d0a8' },
];

class Player {
  constructor(team, keeper, ctrl, look) {
    this.team = team; this.keeper = keeper; this.ctrl = ctrl;   // ctrl = input index or null (AI)
    this.spr = buildCharacterSprites(team, keeper, look);
    this.attack = team === 0 ? 1 : -1;                          // +x for red, -x for blue
    this.goalX = team === 0 ? 0 : FIELD.W;                      // own goal line
    this.reset(FIELD.W / 2, FIELD.D / 2);
  }
  reset(x, y) {
    this.x = x; this.y = y; this.z = 0; this.vx = this.vy = this.vz = 0;
    this.fx = this.attack; this.fy = 0;
    this.state = 'normal'; this.stateT = 0;
    this.charge = 0; this.charging = null; this.kickAnim = 0;
    this.pickCd = 0; this.stealCd = 0; this.holdT = 0; this.anim = 0; this.thinkT = 0;
    this.tx = x; this.ty = y;
  }
  hasBall(ball) { return ball.owner === this; }
  setState(s, t) { this.state = s; this.stateT = t; }
  stun(t) { this.setState('stun', t); this.charging = null; this.vz = 60; }

  update(dt, game) {
    const ball = game.ball;
    this.pickCd -= dt; this.stealCd -= dt; this.kickAnim -= dt; this.anim += dt;
    if (this.stateT > 0) {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        if (this.state === 'slide') this.setState('recover', PHYS.slideRecover);
        else if (this.state === 'dive') this.setState('recover', 0.45);
        else this.setState('normal', 0);
      }
    }

    if (game.state === 'play') {
      if (this.ctrl !== null) this.control(dt, game); else this.keeperAI(dt, game);
    } else {
      this.charging = null;
      this.cutsceneMove(dt, game);
    }

    // integrate
    if (this.z > 0 || this.vz > 0) {
      this.vz -= PHYS.gravity * dt; this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; if (this.state === 'normal') game.dust(this.x, this.y, 3); }
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.x = clamp(this.x, 2, FIELD.W - 2);
    this.y = clamp(this.y, -MARGIN.Y + 3, FIELD.D + MARGIN.Y - 3);

    if (game.state === 'play') this.interactBall(dt, game, ball);
    if (Math.abs(this.vx) > 8) this.fxSprite = this.vx > 0 ? 1 : -1;
  }

  approach(tvx, tvy, dt, k = 12) {
    const a = Math.min(1, dt * k);
    this.vx += (tvx - this.vx) * a; this.vy += (tvy - this.vy) * a;
  }

  // ---------------- human striker ----------------
  control(dt, game) {
    const inp = Input.player(this.ctrl), ball = game.ball, has = this.hasBall(ball);
    const st = this.state;
    if (st === 'stun' || st === 'recover') { this.approach(0, 0, dt, 6); return; }
    if (st === 'slide') { this.approach(0, 0, dt, 2.2); return; }

    const moving = Math.hypot(inp.mx, inp.my) > 0.2;
    if (moving) [this.fx, this.fy] = norm(inp.mx, inp.my);
    let speed = has ? PHYS.dribbleSpeed : PHYS.runSpeed;
    if (this.charging) speed *= 0.55;
    if (this.kickAnim > 0) speed *= 0.4;
    const air = this.z > 0 ? 0.5 : 1;
    this.approach(inp.mx * speed, inp.my * speed, dt, 12 * air);

    if (has) {
      if (inp.shootPressed && !this.charging) { this.charging = 'shot'; this.charge = 0; }
      if (inp.lobPressed && !this.charging) { this.charging = 'lob'; this.charge = 0; }
      if (this.charging) {
        this.charge = Math.min(1, this.charge + dt / PHYS.chargeTime);
        if ((this.charging === 'shot' && inp.shootReleased) || (this.charging === 'lob' && inp.lobReleased))
          this.kick(game, this.charging === 'lob');
      }
    } else {
      this.charging = null;
      if (inp.shootPressed && this.z === 0) {
        this.setState('slide', PHYS.slideTime);
        this.vx = this.fx * PHYS.slideSpeed; this.vy = this.fy * PHYS.slideSpeed;
        game.sfx('tackle'); game.dust(this.x, this.y, 6);
      } else if (inp.lobPressed && this.z === 0) {
        this.vz = PHYS.jumpV; game.sfx('jump');
      }
    }
  }

  kick(game, lob) {
    const ball = game.ball, p = this.charge;
    let vx, vy, vz;
    if (lob) {
      const h = lerp(110, 235, p);
      vx = this.fx * h; vy = this.fy * h * 0.85; vz = lerp(150, 235, p);
    } else {
      const sp = p < 0.12 ? 150 : lerp(PHYS.shotMin, PHYS.shotMax, p);
      vx = this.fx * sp; vy = this.fy * sp * 0.85; vz = p > 0.45 ? (p - 0.45) * 150 : 8;
    }
    ball.kick(vx + this.vx * 0.3, vy + this.vy * 0.3, vz, this);
    this.charging = null; this.kickAnim = 0.2;
    game.onKick(this, p);
  }

  interactBall(dt, game, ball) {
    const dx = ball.x - this.x, dy = ball.y - this.y, d = Math.hypot(dx, dy);
    const free = this.state === 'normal' || this.state === 'dive';

    if (this.hasBall(ball)) {
      if (this.keeper) { ball.x = this.x + this.attack * 3; ball.y = this.y + 1; ball.z = this.z + 9; return; }
      const sp = Math.hypot(this.vx, this.vy);
      let tx = this.x + this.fx * 7, ty = this.y + this.fy * 5;
      // walking the ball over the goal line: let it roll in
      const ltx = this.attack === 1 ? FIELD.W - tx : tx;
      if (ltx < 3 && Math.abs(ty - FIELD.D / 2) < GOAL.half - 3) { ball.kick(this.vx * 1.3 + this.attack * 40, this.vy, 0, this); return; }
      const a = Math.min(1, dt * 18);
      ball.x += (tx - ball.x) * a; ball.y += (ty - ball.y) * a;
      ball.z = this.z + (sp > 10 ? Math.abs(Math.sin(this.anim * 11)) * 2 : 0);
      ball.vx = this.vx; ball.vy = this.vy; ball.vz = 0;
      return;
    }

    // slide tackle
    if (this.state === 'slide') {
      if (d < 11 && ball.z < 10) {
        const o = ball.owner;
        if (o && o.team !== this.team && !(o.keeper && o.holdT >= 0)) {
          if (Math.hypot(o.x - this.x, o.y - this.y) < 14) o.stun(0.7);
          ball.kick(this.fx * 150 + rand(-30, 30), this.fy * 150 + rand(-30, 30), 50, this);
          game.onTackle(this, true);
        } else if (!o) {
          ball.kick(this.fx * 190, this.fy * 190, 30, this);
          game.sfx('kick', 0.4);
        }
      }
      for (const q of game.players) {
        if (q.team !== this.team && q.state !== 'stun' && !q.keeper &&
            Math.hypot(q.x - this.x, q.y - this.y) < 10) { q.stun(0.55); game.onTackle(this, false); }
      }
      return;
    }

    if (!free) return;

    // steal by contact
    const o = ball.owner;
    if (o && o.team !== this.team && !o.keeper && this.stealCd <= 0 && d < 7 && this.z < 4) {
      this.stealCd = 0.35;
      if (Math.random() < 0.42) {
        ball.owner = this; ball.lastTouch = this; o.pickCd = 0.5; o.stealCd = 0.5; o.charging = null;
        game.sfx('tackle');
      }
      return;
    }
    if (o || this.pickCd > 0) return;

    const reach = this.keeper ? (this.state === 'dive' ? 14 : 10) : 8;
    if (d > reach) return;
    const headZ = this.z + 14;
    if (this.keeper) {
      if (ball.z < this.z + 26) game.keeperTouch(this);
    } else if (ball.z < 7 + this.z * 0.5 && this.z < 4) {
      if (ball.speed > 290) {   // too hot to control: deflects
        ball.kick(-ball.vx * 0.3 + this.vx * 0.4, -ball.vy * 0.3 + this.vy * 0.4, 40, this);
        game.sfx('kick', 0.3);
      } else { ball.owner = this; ball.lastTouch = this; game.sfx('bounce', 0.6); }
    } else if (this.z > 3 && Math.abs(ball.z - headZ) < 8) {
      ball.kick(this.fx * 235, this.fy * 200, -30 + Math.random() * 60, this);
      game.onKick(this, 0.6, true);
    } else if (ball.z < 20 && this.z < 4) {   // chest control
      ball.vx *= 0.25; ball.vy *= 0.25; ball.vz = Math.min(ball.vz, 20); ball.lastTouch = this;
    }
  }

  // ---------------- AI goalkeeper ----------------
  keeperAI(dt, game) {
    const ball = game.ball, cy = FIELD.D / 2;
    const lx = x => (this.team === 0 ? x : FIELD.W - x);   // distance from own goal line
    const toX = l => (this.team === 0 ? l : FIELD.W - l);
    if (this.state === 'dive') {   // fly toward the predicted interception point, then stop
      const dy = this.diveY - this.y;
      this.vy = Math.sign(dy) * Math.min(Math.abs(dy) * 14, 190);
      this.vx *= 0.9;
      return;
    }
    if (this.state === 'recover' || this.state === 'stun') { this.approach(0, 0, dt, 8); return; }

    if (this.hasBall(ball)) {
      this.approach(0, 0, dt); this.holdT += dt;
      if (this.holdT > 0.9) {
        const [dx, dy] = norm(this.attack, rand(-0.6, 0.6));
        this.charge = 0.5; this.fx = dx; this.fy = dy;
        ball.kick(dx * rand(190, 240), dy * 200, rand(120, 170), this);
        this.pickCd = 0.7; this.kickAnim = 0.25; this.holdT = 0;
        game.onKick(this, 0.5);
      }
      return;
    }

    const blx = lx(ball.x), towards = -ball.vx * this.attack;   // >0 when ball heads to our goal
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.12;
      let tl = 6, ty = cy + (ball.y - cy) * 0.55;
      const opp = ball.owner && ball.owner.team !== this.team;
      if (opp && blx < 100) tl = 6 + (100 - blx) * 0.12;
      if (!ball.owner && towards > 60 && blx < 160) {
        const t = Math.max(0, (blx - tl) / towards);
        ty = ball.y + ball.vy * t;
        // dive if shot is fast and wide of the keeper
        if (towards > 150 && t < 0.42 && Math.abs(ty - this.y) > 9 && Math.abs(ty - cy) < GOAL.half + 6) {
          const dy = ty - this.y;
          this.setState('dive', 0.4);
          this.diveY = clamp(ty, GOAL_Y1 - 8, GOAL_Y2 + 8);
          this.vy = Math.sign(dy) * 190;
          this.vx = (toX(tl) - this.x) * 2; this.vz = 80;
          game.sfx('jump');
          return;
        }
      }
      // rush out for loose slow balls in the box if we're the closest
      if (!ball.owner && ball.speed < 120 && blx < 50 && Math.abs(ball.y - cy) < 56) {
        const me = Math.hypot(ball.x - this.x, ball.y - this.y);
        const rival = Math.min(...game.players.filter(p => p.team !== this.team)
          .map(p => Math.hypot(ball.x - p.x, ball.y - p.y)));
        if (me < rival + 10) { this.tx = ball.x; this.ty = ball.y; this.rush = true; return; }
      }
      this.rush = false;
      this.tx = toX(tl);
      this.ty = clamp(ty, GOAL_Y1 - 3, GOAL_Y2 + 3);
    }
    const [dx, dy] = norm(this.tx - this.x, this.ty - this.y);
    const dist = Math.hypot(this.tx - this.x, this.ty - this.y);
    const sp = Math.min(PHYS.keeperSpeed * (this.rush ? 1.25 : 1), dist * 6);
    this.approach(dx * sp, dy * sp, dt, 10);
    this.fx = this.attack; this.fy = 0;
  }

  // non-play movement (kickoff positioning & celebrations)
  cutsceneMove(dt, game) {
    const party = (game.state === 'goal' && game.lastScorer === this.team) || (game.state === 'end' && game.winner === this.team);
    if (party && this.z === 0 && Math.random() < dt * 3) {
      this.vz = 140;
    }
    const [dx, dy] = norm(this.tx - this.x, this.ty - this.y);
    const dist = Math.hypot(this.tx - this.x, this.ty - this.y);
    const sp = Math.min(PHYS.runSpeed * 1.4, dist * 5);
    this.approach(dx * sp, dy * sp, dt, 10);
    if (dist < 2 && game.state !== 'goal') { this.fx = this.attack; this.fy = 0; }
  }

  frameName() {
    if (this.state === 'stun' || (this.state === 'recover' && this.keeper)) return 'stun';
    if (this.state === 'slide' || this.state === 'recover') return 'slide';
    if (this.state === 'dive' || this.z > 1) return 'jump';
    if (this.kickAnim > 0) return 'kick';
    if (Math.hypot(this.vx, this.vy) > 12) return RUN_CYCLE[Math.floor(this.anim * 11) % 4];
    return 'idle';
  }

  draw(ctx, game) {
    const face = (this.keeper && Math.abs(this.vx) < 8) ? (this.attack > 0 ? 0 : 1)
      : (this.state === 'slide' || this.kickAnim > 0 || this.charging || Math.abs(this.vx) < 8)
        ? (this.fx >= 0 ? 0 : 1) : (this.vx > 0 ? 0 : 1);
    const spr = this.spr[this.frameName()][face];
    const [sx, sy] = proj(this.x, this.y, this.z);
    const X = Math.round(sx - spr.width / 2), Y = Math.round(sy - spr.height + 1);
    ctx.drawImage(spr, X, Y);
    if (this.state === 'stun') {   // dizzy stars
      for (let i = 0; i < 3; i++) {
        const a = game.time * 6 + i * 2.1;
        ctx.fillStyle = '#ffe14a';
        ctx.fillRect(Math.round(sx + Math.cos(a) * 6), Math.round(Y + 5 + Math.sin(a) * 2), 1, 1);
      }
    }
    if (this.ctrl !== null) {   // player marker
      const c = TEAM_COLORS[this.team];
      const my = Y - 7 + (Math.sin(game.time * 5) > 0 ? 0 : -1);
      ctx.fillStyle = c.main;
      ctx.fillRect(Math.round(sx) - 3, my, 7, 1); ctx.fillRect(Math.round(sx) - 2, my + 1, 5, 1);
      ctx.fillRect(Math.round(sx) - 1, my + 2, 3, 1); ctx.fillRect(Math.round(sx), my + 3, 1, 1);
      drawText(ctx, 'P' + (this.ctrl + 1), sx, my - 7, 1, c.light, 'center', '#000');
      if (this.charging) {   // power bar
        const w = 14, bx = Math.round(sx - w / 2), by = Y - 3;
        ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, w + 2, 4);
        ctx.fillStyle = '#333'; ctx.fillRect(bx, by, w, 2);
        ctx.fillStyle = this.charge > 0.85 ? '#ff4040' : this.charge > 0.5 ? '#ffc040' : '#60e060';
        ctx.fillRect(bx, by, Math.round(w * this.charge), 2);
        if (this.charging === 'lob') { ctx.fillStyle = '#9cc4ff'; ctx.fillRect(bx + w + 2, by - 1, 1, 4); }
      }
    }
  }
}
