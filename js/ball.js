'use strict';
// Ball physics: gravity, bounces, arena boards, goal posts/crossbar and nets.
class Ball {
  constructor() { this.reset(); }
  reset(x = FIELD.W / 2, y = FIELD.D / 2) {
    this.x = x; this.y = y; this.z = 0; this.vx = this.vy = this.vz = 0;
    this.owner = null; this.lastTouch = null; this.inNet = -1; this.roll = 0; this.trail = [];
    this.postCd = 0;
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
  kick(vx, vy, vz, by) {
    this.owner = null; this.vx = vx; this.vy = vy; this.vz = vz;
    this.lastTouch = by; if (by) by.pickCd = 0.28;
  }

  update(dt, game) {
    const r = PHYS.ballR;
    this.postCd -= dt;
    if (this.owner) {
      this.roll += Math.hypot(this.owner.vx, this.owner.vy) * dt;
      this.trail.length = 0;
      return;
    }
    const sp = this.speed;
    this.roll += sp * dt;
    // trail for fast shots
    if (sp > 230 || this.trail.length) {
      this.trail.unshift([this.x, this.y, this.z]);
      if (this.trail.length > 7 || sp < 230) this.trail.pop();
    }

    // integrate
    if (this.z > 0 || this.vz > 0) this.vz -= PHYS.gravity * dt;
    const px = this.x;
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    if (this.z <= 0) {
      this.z = 0;
      if (this.vz < -45) {
        game.sfxBounce(Math.min(1, -this.vz / 300));
        this.vz = -this.vz * PHYS.bounce;
        this.vx *= 0.92; this.vy *= 0.92;
      } else this.vz = 0;
    }
    if (this.z === 0 && this.vz === 0) {
      const k = Math.exp(-PHYS.rollFriction * dt);
      this.vx *= k; this.vy *= k;
      if (this.speed < 4) this.vx = this.vy = 0;
    } else {
      const k = Math.exp(-PHYS.airDrag * dt);
      this.vx *= k; this.vy *= k;
    }

    // side boards
    const yMin = -MARGIN.Y + r, yMax = FIELD.D + MARGIN.Y - r;
    if (this.y < yMin) { this.y = yMin; this.vy = Math.abs(this.vy) * PHYS.wallBounce; game.sfxBounce(0.4); }
    if (this.y > yMax) { this.y = yMax; this.vy = -Math.abs(this.vy) * PHYS.wallBounce; game.sfxBounce(0.4); }

    for (let side = 0; side < 2; side++) this.goalCollide(side, px, game);
  }

  // Work in "local" coordinates: lx = distance in front of this goal line (negative = behind it).
  goalCollide(side, prevX, game) {
    const r = PHYS.ballR, dir = side === 0 ? 1 : -1;
    const toL = x => (side === 0 ? x : FIELD.W - x);
    let lx = toL(this.x), lvx = this.vx * dir;
    const plx = toL(prevX), cy = FIELD.D / 2, H = GOAL.H;
    if (lx > 40 && this.inNet !== side) return;

    if (this.inNet === side) {
      if (lx < -GOAL.depth + r) { lx = -GOAL.depth + r; lvx = Math.abs(lvx) * 0.12; this.vy *= 0.5; this.vz *= 0.5; }
      if (lx > -r) { lx = -r; lvx = -Math.abs(lvx) * 0.2; }
      if (this.y < GOAL_Y1 + r) { this.y = GOAL_Y1 + r; this.vy = Math.abs(this.vy) * 0.2; }
      if (this.y > GOAL_Y2 - r) { this.y = GOAL_Y2 - r; this.vy = -Math.abs(this.vy) * 0.2; }
      if (this.z > H - r) { this.z = H - r; this.vz = -Math.abs(this.vz) * 0.2; }
    } else {
      // posts (vertical cylinders)
      for (const py of [GOAL_Y1, GOAL_Y2]) {
        if (this.z > H + r) continue;
        const dx = lx, dy = this.y - py, d = Math.hypot(dx, dy), m = r + 1.5;
        if (d < m && d > 0) {
          const nx = dx / d, ny = dy / d, vn = lvx * nx + this.vy * ny;
          lx = nx * m; this.y = py + ny * m;
          if (vn < 0) { lvx -= 1.6 * vn * nx; this.vy -= 1.6 * vn * ny; this.hitPost(game); }
        }
      }
      // crossbar (horizontal cylinder along y)
      if (Math.abs(this.y - cy) < GOAL.half) {
        const dz = this.z - H, d = Math.hypot(lx, dz), m = r + 1.5;
        if (d < m && d > 0) {
          const nx = lx / d, nz = dz / d, vn = lvx * nx + this.vz * nz;
          lx = nx * m; this.z = H + nz * m;
          if (vn < 0) { lvx -= 1.6 * vn * nx; this.vz -= 1.6 * vn * nz; this.hitPost(game); }
        }
      }
      // crossing the goal line inside the mouth = GOAL
      if (plx >= 0 && lx < 0 && Math.abs(this.y - cy) < GOAL.half && this.z < H) {
        this.inNet = side;
        game.onGoal(side);
      } else if (lx < 0) {
        // outside of the goal frame: side nets and roof are solid
        if (lx > -GOAL.depth - r && Math.abs(this.y - cy) < GOAL.half + r && this.z < H + r) {
          const pushY1 = this.y - (GOAL_Y1 - r), pushY2 = (GOAL_Y2 + r) - this.y, pushZ = (H + r) - this.z;
          const m = Math.min(pushY1, pushY2, pushZ);
          if (m === pushZ) { this.z = H + r; this.vz = Math.abs(this.vz) * 0.3; lvx *= 0.8; }
          else if (m === pushY1) { this.y = GOAL_Y1 - r; this.vy = -Math.abs(this.vy) * 0.3; }
          else { this.y = GOAL_Y2 + r; this.vy = Math.abs(this.vy) * 0.3; }
        }
      }
      // end boards
      if (lx < -MARGIN.X + r) { lx = -MARGIN.X + r; lvx = Math.abs(lvx) * PHYS.wallBounce; game.sfxBounce(0.4); }
    }
    this.x = side === 0 ? lx : FIELD.W - lx;
    this.vx = lvx * dir;
  }

  hitPost(game) {
    if (this.postCd > 0) return;
    this.postCd = 0.2;
    game.onPost();
  }

  draw(ctx) {
    // speed trail
    for (let i = 1; i < this.trail.length; i++) {
      const [tx, ty, tz] = this.trail[i], p = proj(tx, ty, tz + PHYS.ballR);
      ctx.fillStyle = `rgba(255,255,255,${0.5 - i * 0.07})`;
      const s = Math.max(1, 3 - (i >> 1));
      ctx.fillRect(Math.round(p[0] - s / 2), Math.round(p[1] - s / 2), s, s);
    }
    const p = proj(this.x, this.y, this.z + PHYS.ballR);
    const spr = BALL_SPRITES[Math.floor(this.roll / 5) % 3];
    ctx.drawImage(spr, Math.round(p[0] - spr.width / 2), Math.round(p[1] - spr.height / 2));
  }
}
