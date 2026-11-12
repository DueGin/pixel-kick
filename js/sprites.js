'use strict';
// Pixel-art sprites defined as strings, facing right. Outlines are generated automatically.
// h hair, s skin, e eye, j jersey, n number/trim, p shorts, k socks, b boots, g gloves
const FRAMES = {
  idle: [
    '...hhhh...', '..hhhhhh..', '..hhsses..', '..hsssss..', '...ssss...',
    '..jjjjjj..', '.gjjnjjjg.', '.gjjnjjjg.', '..jjjjjj..', '..pppppp..',
    '..pp..pp..', '..kk..kk..', '..bb..bbb.'],
  run1: [
    '...hhhh...', '..hhhhhh..', '..hhsses..', '..hsssss..', '...ssss...',
    '..jjjjjjg.', '.gjjnjjjg.', 'g.jjnjjj..', '..jjjjjj..', '..pppppp..',
    '.pp...pp..', 'kk.....kk.', 'bb.....bbb'],
  run2: [
    '...hhhh...', '..hhhhhh..', '..hhsses..', '..hsssss..', '...ssss...',
    '.gjjjjjj..', '.gjjnjjjg.', '..jjnjjj.g', '..jjjjjj..', '..pppppp..',
    '...pppp...', '...kkkk...', '...bbbbb..'],
  run3: [
    '...hhhh...', '..hhhhhh..', '..hhsses..', '..hsssss..', '...ssss...',
    '..jjjjjjg.', '.gjjnjjjg.', 'g.jjnjjj..', '..jjjjjj..', '..pppppp..',
    '..pp.pp...', '.kk...kk..', 'bbb...bbb.'],
  kick: [
    '..hhhh....', '.hhhhhh...', '.hhsses...', '.hsssss...', '..ssss....',
    '.jjjjjj...', 'gjjnjjjg..', 'gjjnjjj.g.', '.jjjjjj...', '.pppppp...',
    '.pp..pppkk', '.kk....bbb', '.bb.......'],
  slide: [
    '..........', '..........', '..........', '..........', '..........',
    '..........', 'hhh.......', 'hhse......', 'hssjjj....', '.gjjnjpp..',
    '..jjjjppkk', '...g..kbbb', '..........'],
  jump: [
    '...hhhh...', '..hhhhhh..', '..hhsses..', 'g.hsssss.g', 'g..ssss..g',
    'gjjjjjjjjg', '..jjnjjj..', '..jjnjjj..', '..jjjjjj..', '..pppppp..',
    '..pp..pp..', '...kk.kk..', '...bb..bb.'],
  stun: [
    '..........', '..........', '..........', '..........', '..........',
    '..........', '..........', '..........', 'bkkppjjjhh', 'bkkppjnjsh',
    '...pjjjjss', '....g..ge.', '..........'],
};
const RUN_CYCLE = ['run1', 'run2', 'run3', 'run2'];

const BALL_FRAMES = [
  ['.www.', 'wwdww', 'wdddw', 'wwdww', '.www.'],
  ['.wdw.', 'wwwww', 'dwwwd', 'wwwww', '.wdw.'],
  ['.www.', 'dwwwd', 'wwdww', 'dwwwd', '.www.'],
];

function makePalette(team, keeper, look) {
  const t = TEAM_COLORS[team];
  const pal = {
    h: look.hair, s: look.skin, e: '#1a1418', b: '#202028',
    j: t.main, n: team === 0 ? '#ffffff' : '#ffd84a', p: team === 0 ? '#f2f2f2' : '#1c2a5a', k: t.main,
    g: look.skin,
  };
  if (keeper) {
    pal.j = team === 0 ? '#3cbf4a' : '#f0a020';
    pal.n = '#1a1a1a'; pal.p = '#1a1a1a'; pal.k = pal.j; pal.g = '#f4f4f4';
  }
  return pal;
}

// Render a frame (array of strings) to a canvas with 1px dark outline. flip = mirror horizontally.
function renderPixels(rows, pal, flip, outline = '#14121c') {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w + 2; c.height = h + 2;
  const x = c.getContext('2d');
  const at = (cx, cy) => (cy >= 0 && cy < h && cx >= 0 && cx < w && rows[cy][flip ? w - 1 - cx : cx] !== '.');
  // outline pass
  x.fillStyle = outline;
  for (let cy = -1; cy <= h; cy++) for (let cx = -1; cx <= w; cx++) {
    if (at(cx, cy)) continue;
    if (at(cx - 1, cy) || at(cx + 1, cy) || at(cx, cy - 1) || at(cx, cy + 1)) x.fillRect(cx + 1, cy + 1, 1, 1);
  }
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    const ch = rows[cy][flip ? w - 1 - cx : cx];
    if (ch === '.') continue;
    x.fillStyle = pal[ch] || '#f0f';
    x.fillRect(cx + 1, cy + 1, 1, 1);
  }
  // subtle bottom shading on lower half of jersey/shorts for volume
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(0,0,0,0.18)';
  if (flip) x.fillRect(0, 0, 3, h + 2); else x.fillRect(w - 1, 0, 3, h + 2);
  x.globalCompositeOperation = 'source-over';
  return c;
}

// Builds {frameName: [rightCanvas, leftCanvas]} for one character.
function buildCharacterSprites(team, keeper, look) {
  const pal = makePalette(team, keeper, look), out = {};
  for (const k in FRAMES) out[k] = [renderPixels(FRAMES[k], pal, false), renderPixels(FRAMES[k], pal, true)];
  return out;
}

const BALL_SPRITES = BALL_FRAMES.map(f => renderPixels(f, { w: '#fafafa', d: '#2a2a33' }, false, '#1a1a22'));
