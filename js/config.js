'use strict';
// ---- Global constants (world units ≈ screen pixels at the near touchline) ----
const VW = 480, VH = 270;                 // virtual (pixel-art) resolution

const FIELD = { W: 420, D: 180 };         // playable pitch: x 0..W (length), y 0..D (depth)
const MARGIN = { X: 14, Y: 10 };          // grass between lines and arena boards
const GOAL = { half: 26, H: 26, depth: 14 };  // goal mouth half-width, crossbar height, net depth
const GOAL_Y1 = FIELD.D / 2 - GOAL.half, GOAL_Y2 = FIELD.D / 2 + GOAL.half;

// 2.5D projection: far side is narrower (perspective), depth compressed.
const PROJ = { cx: VW / 2, top: 92, ky: 0.82, sFar: 0.78, sNear: 1.0 };

const PHYS = {
  gravity: 520,
  ballR: 3,
  bounce: 0.55,       // ground restitution
  wallBounce: 0.7,
  rollFriction: 1.1,  // per-second exponential decay on ground
  airDrag: 0.15,
  playerR: 6,
  runSpeed: 98,
  dribbleSpeed: 86,
  keeperSpeed: 74,
  shotMin: 170, shotMax: 370,
  chargeTime: 0.75,
  jumpV: 175,
  slideSpeed: 215, slideTime: 0.34, slideRecover: 0.32,
};

const TEAM_COLORS = [
  { name: 'RED', main: '#e04848', dark: '#8c2230', light: '#ff9a8a' },
  { name: 'BLU', main: '#3a78e8', dark: '#1d3c82', light: '#9cc4ff' },
];

const MATCH_LENGTHS = [60, 120, 180, 300];   // seconds

// ---- small math helpers ----
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const hypot = Math.hypot;
function norm(x, y) { const l = Math.hypot(x, y); return l > 1e-6 ? [x / l, y / l] : [0, 0]; }
