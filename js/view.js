'use strict';
// Projection, crisp pixel primitives and static arena rendering.
function sAt(y) { return PROJ.sFar + (PROJ.sNear - PROJ.sFar) * (y / FIELD.D); }
function proj(x, y, z = 0) {
  const s = sAt(y);
  return [PROJ.cx + (x - FIELD.W / 2) * s, PROJ.top + y * PROJ.ky - z * s, s];
}

// ---------- crisp (non-antialiased) primitives ----------
function fillPoly(ctx, pts, color) {
  ctx.fillStyle = color;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const yc = y + 0.5; let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
        const x = a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]);
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
    }
    if (hi > lo) ctx.fillRect(Math.round(lo), y, Math.round(hi) - Math.round(lo), 1);
  }
}
function line(ctx, x0, y0, x1, y1, color, w = 1) {
  ctx.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 2000; n++) {
    ctx.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function line3(ctx, a, b, color, w = 1) {
  const p = proj(a[0], a[1], a[2]), q = proj(b[0], b[1], b[2]);
  line(ctx, p[0], p[1], q[0], q[1], color, w);
}
function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -Math.floor(ry); y <= Math.floor(ry); y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (w > 0) ctx.fillRect(Math.round(cx) - w, Math.round(cy) + y, w * 2, 1);
  }
}
function shadow(ctx, x, y, z, size) {
  const [sx, sy, s] = proj(x, y, 0);
  const k = Math.max(0.35, 1 - z / 90);
  ellipse(ctx, sx, sy, size * s * k, Math.max(1, size * 0.4 * s * k), 'rgba(10,30,10,0.35)');
}

// ---------- pre-rendered pitch (per-pixel inverse projection) ----------
function buildPitch() {
  const c = document.createElement('canvas'); c.width = VW; c.height = VH;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(VW, VH), d = img.data;
  const W = FIELD.W, D = FIELD.D, MX = MARGIN.X, MY = MARGIN.Y, cy = D / 2;
  const rowOf = y => Math.floor(PROJ.top + y * PROJ.ky);
  const hLines = [0, D].map(rowOf);
  const boxRows = [cy - 56, cy + 56, cy - 36, cy + 36].map(rowOf);
  const faceH = 9;
  for (let sy = 0; sy < VH; sy++) {
    let y = (sy + 0.5 - PROJ.top) / PROJ.ky;
    const isFace = y > D + MY && y < D + MY + faceH / PROJ.ky;
    const yy = isFace ? D + MY : y;
    if (yy < -MY || yy > D + MY) continue;
    const s = sAt(yy);
    const colOf = x => Math.floor(PROJ.cx + (x - W / 2) * s);
    const vCols = [0, W, W / 2].map(colOf), penCols = [52, W - 52].map(colOf), gaCols = [18, W - 18].map(colOf);
    for (let sx = 0; sx < VW; sx++) {
      const x = W / 2 + (sx + 0.5 - PROJ.cx) / s;
      if (x < -MX || x > W + MX) continue;
      const i = (sy * VW + sx) * 4;
      let r, g, b;
      if (isFace) {   // front face of the pitch slab (advert board)
        const seg = Math.floor((x + MX) / 48) % 4;
        const f = sy - rowOf(D + MY);
        [r, g, b] = f <= 1 ? [230, 230, 240] : seg === 0 ? [200, 60, 70] : seg === 2 ? [50, 100, 210] : [28, 32, 60];
      } else {
        const stripe = Math.floor((x + MX) / 30) % 2;
        [r, g, b] = stripe ? [88, 166, 74] : [76, 150, 64];
        const inside = x >= 0 && x <= W && y >= 0 && y <= D;
        if (!inside) { r *= 0.86; g *= 0.86; b *= 0.86; }
        const h = (sx * 73856093) ^ (sy * 19349663);
        if ((h & 15) === 0) { r += 10; g += 12; b += 6; } else if ((h & 31) === 1) { r -= 10; g -= 10; b -= 8; }
        // pitch markings
        let ln = false;
        const inX = x >= -0.5 && x <= W + 0.5, inY = y >= -0.5 && y <= D + 0.5;
        if (inX && hLines.includes(sy)) ln = true;
        if (inY && vCols.includes(sx)) ln = true;
        const inBigY = Math.abs(y - cy) <= 56, inSmY = Math.abs(y - cy) <= 36;
        if (inBigY && penCols.includes(sx)) ln = true;
        if (inSmY && gaCols.includes(sx)) ln = true;
        if ((sy === boxRows[0] || sy === boxRows[1]) && (x <= 52 || x >= W - 52) && inX) ln = true;
        if ((sy === boxRows[2] || sy === boxRows[3]) && (x <= 18 || x >= W - 18) && inX) ln = true;
        const dc = Math.hypot(x - W / 2, y - cy);
        if (Math.abs(dc - 28) < 0.7 || dc < 1.6) ln = true;
        if (Math.hypot(x - 38, y - cy) < 1.4 || Math.hypot(x - (W - 38), y - cy) < 1.4) ln = true;
        if (ln) { r = 236; g = 244; b = 236; }
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // front-face lettering
  const fy = rowOf(D + MY) + 3;
  drawText(ctx, 'PIXEL KICK', VW / 2, fy, 1, '#ffffff', 'center', null);
  return c;
}

// ---------- stadium background with animated crowd ----------
const CROWD = (() => {
  const people = [];
  for (let row = 0; row < 8; row++) {
    for (let x = -2 + (row % 2) * 3; x < VW; x += 6) {
      const leftSide = x < VW / 2;
      const fanTeam = Math.random() < 0.8 ? (leftSide ? 0 : 1) : (leftSide ? 1 : 0);
      const shirt = Math.random() < 0.7 ? TEAM_COLORS[fanTeam].main
        : ['#e8e8e8', '#30303a', '#c8a050', TEAM_COLORS[fanTeam].light][Math.floor(Math.random() * 4)];
      const skin = ['#f0c090', '#c88a5a', '#8a5a3a', '#f8d8b0'][Math.floor(Math.random() * 4)];
      people.push({ x, y: 14 + row * 8, shirt, skin, team: fanTeam, ph: Math.random() * 6.28, sp: rand(4, 9) });
    }
  }
  return people;
})();

function drawStadium(ctx, t, hype) {
  ctx.fillStyle = '#161a2e'; ctx.fillRect(0, 0, VW, VH);
  // roof + floodlights
  ctx.fillStyle = '#0b0d18'; ctx.fillRect(0, 0, VW, 11);
  for (let x = 12; x < VW; x += 40) {
    ctx.fillStyle = (Math.floor(t * 2 + x) % 7) ? '#fff6c8' : '#bfb68a';
    ctx.fillRect(x, 4, 6, 3);
  }
  // tiers
  for (let row = 0; row < 8; row++) {
    ctx.fillStyle = row % 2 ? '#262b48' : '#2c3254';
    ctx.fillRect(0, 12 + row * 8, VW, 8);
  }
  // crowd
  for (const p of CROWD) {
    const excited = hype[p.team] > 0;
    const amp = excited ? 3 : 1;
    const bob = Math.sin(t * p.sp + p.ph) > (excited ? 0 : 0.85) ? -amp * (excited ? Math.abs(Math.sin(t * p.sp + p.ph)) : 1) : 0;
    const y = Math.round(p.y + bob);
    ctx.fillStyle = p.shirt; ctx.fillRect(p.x, y + 3, 4, 4);
    ctx.fillStyle = p.skin; ctx.fillRect(p.x + 1, y, 2, 3);
    if (excited && bob < -1) { ctx.fillRect(p.x - 1, y - 1, 1, 3); ctx.fillRect(p.x + 4, y - 1, 1, 3); }
  }
  // concourse below stands
  ctx.fillStyle = '#1f2440'; ctx.fillRect(0, 76, VW, VH - 76);
  // far advertising board (wall at y = -MY)
  const a = proj(-MARGIN.X, -MARGIN.Y, 0), b = proj(FIELD.W + MARGIN.X, -MARGIN.Y, 0), hgt = Math.round(10 * a[2]);
  const bx0 = Math.round(a[0]), bx1 = Math.round(b[0]), by = Math.round(a[1]);
  ctx.fillStyle = '#e8e8f0'; ctx.fillRect(bx0, by - hgt - 1, bx1 - bx0, 1);
  const ads = ['GOAL!', 'PIXEL', '2.5D', 'KICK', 'SPORT', 'PLAY'];
  const segW = (bx1 - bx0) / 6;
  for (let i = 0; i < 6; i++) {
    const x0 = Math.round(bx0 + i * segW), x1 = Math.round(bx0 + (i + 1) * segW);
    ctx.fillStyle = ['#1e3a8a', '#b8323e', '#1c2240', '#e0a020', '#2f8a4a', '#6a2a9a'][i];
    ctx.fillRect(x0, by - hgt, x1 - x0, hgt);
    drawText(ctx, ads[i], (x0 + x1) / 2, by - hgt + 1, 1, '#ffffff', 'center', null);
  }
}

function drawEndBoards(ctx) {
  for (const x of [-MARGIN.X, FIELD.W + MARGIN.X]) {
    const y0 = -MARGIN.Y, y1 = FIELD.D + MARGIN.Y, h = 9;
    const p = [proj(x, y0, 0), proj(x, y1, 0), proj(x, y1, h), proj(x, y0, h)];
    fillPoly(ctx, p, '#1c2240');
    line3(ctx, [x, y0, h], [x, y1, h], '#e8e8f0');
  }
}

// ---------- goals (split into back / front parts for depth sorting) ----------
function goalGeom(side) {
  const x0 = side === 0 ? 0 : FIELD.W, xb = side === 0 ? -GOAL.depth : FIELD.W + GOAL.depth;
  return { x0, xb };
}
const NET = 'rgba(255,255,255,0.42)';
function drawGoalBack(ctx, side) {
  const { x0, xb } = goalGeom(side), H = GOAL.H, Y1 = GOAL_Y1, Y2 = GOAL_Y2;
  fillPoly(ctx, [proj(xb, Y1, 0), proj(xb, Y2, 0), proj(xb, Y2, H), proj(xb, Y1, H)], 'rgba(255,255,255,0.08)');
  for (let y = Y1; y <= Y2 + 0.01; y += 4) line3(ctx, [xb, y, 0], [xb, y, H], NET);
  for (let z = 0; z <= H; z += 4) line3(ctx, [xb, Y1, z], [xb, Y2, z], NET);
  for (let y = Y1; y <= Y2 + 0.01; y += 4) line3(ctx, [xb, y, H], [x0, y, H], NET);
  for (let k = 0; k <= 1; k += 0.34) { const x = lerp(xb, x0, k); line3(ctx, [x, Y1, H], [x, Y2, H], NET); }
  for (let k = 0; k <= 1; k += 0.25) { const x = lerp(xb, x0, k); line3(ctx, [x, Y1, 0], [x, Y1, H], NET); }
  for (let z = 0; z <= H; z += 4) line3(ctx, [xb, Y1, z], [x0, Y1, z], NET);
  post(ctx, x0, Y1);
  line3(ctx, [x0, Y1, H], [x0, Y2, H], '#f4f4f4', 2);
}
function drawGoalFront(ctx, side) {
  const { x0, xb } = goalGeom(side), H = GOAL.H, Y2 = GOAL_Y2;
  for (let k = 0; k <= 1; k += 0.25) { const x = lerp(xb, x0, k); line3(ctx, [x, Y2, 0], [x, Y2, H], NET); }
  for (let z = 0; z <= H; z += 4) line3(ctx, [xb, Y2, z], [x0, Y2, z], NET);
  post(ctx, x0, Y2);
  line3(ctx, [x0, GOAL_Y1, H], [x0, Y2, H], '#f4f4f4', 2);
}
function post(ctx, x, y) {
  const b = proj(x, y, 0), t = proj(x, y, GOAL.H);
  ctx.fillStyle = '#9aa0b0'; ctx.fillRect(Math.round(b[0]), Math.round(t[1]), 1, Math.round(b[1] - t[1]) + 1);
  ctx.fillStyle = '#f8f8f8'; ctx.fillRect(Math.round(b[0]) - 1, Math.round(t[1]), 1, Math.round(b[1] - t[1]) + 1);
}
