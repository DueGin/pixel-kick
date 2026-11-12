'use strict';
// 3x5 bitmap font. Each glyph = 5 rows, each row a 3-bit value (4=left,2=mid,1=right).
const FONT = {
  A:'25755',B:'65656',C:'34443',D:'65556',E:'74647',F:'74644',G:'34553',H:'55755',
  I:'72227',J:'11152',K:'55655',L:'44447',M:'57755',N:'65555',O:'25552',P:'65644',
  Q:'25563',R:'65655',S:'34216',T:'72222',U:'55557',V:'55552',W:'55775',X:'55255',
  Y:'55222',Z:'71247',
  0:'75557',1:'26227',2:'61247',3:'61216',4:'55711',5:'74616',6:'34652',7:'71222',
  8:'25252',9:'25316',
  '!':'22202','-':'00700',':':'02020','.':'00002','/':'11244','<':'12421','>':'42124',
  '?':'61202','+':'02720',' ':'00000',',':'00024','(':'12221',')':'42224','=':'07070',
  "'":'22000',
};

function textWidth(str, scale = 1) {
  return str.length ? (str.length * 4 - 1) * scale : 0;
}

// align: 'left' | 'center' | 'right'. shadow: color or null.
function drawText(ctx, str, x, y, scale = 1, color = '#fff', align = 'left', shadow = '#000') {
  str = String(str).toUpperCase();
  let w = textWidth(str, scale);
  let sx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  y = Math.round(y);
  const o = Math.min(scale, 2);
  if (shadow) drawTextRaw(ctx, str, sx + o, y + o, scale, shadow);
  drawTextRaw(ctx, str, sx, y, scale, color);
}

function drawTextRaw(ctx, str, x, y, s, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < str.length; i++) {
    const g = FONT[str[i]] || FONT['?'];
    for (let r = 0; r < 5; r++) {
      const bits = +g[r];
      if (!bits) continue;
      // merge horizontal runs into one rect
      let c = 0;
      while (c < 3) {
        if (bits & (4 >> c)) {
          let e = c;
          while (e + 1 < 3 && bits & (4 >> (e + 1))) e++;
          ctx.fillRect(x + (i * 4 + c) * s, y + r * s, (e - c + 1) * s, s);
          c = e + 1;
        } else c++;
      }
    }
  }
}
