'use strict';
// Keyboard + gamepad input. Produces per-player controller state each sim step.
const Input = (() => {
  const down = new Set();
  const pressedQueue = [];   // raw key presses for menus
  const BIND = [
    { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
      shoot: ['KeyF', 'KeyC'], lob: ['KeyG', 'KeyV'] },
    { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
      shoot: ['KeyK', 'Period', 'Numpad1'], lob: ['KeyL', 'Slash', 'Numpad2'] },
  ];
  const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Period']);

  addEventListener('keydown', e => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressedQueue.push(e.code);
    down.add(e.code);
    Sound.init();
  });
  addEventListener('keyup', e => down.delete(e.code));
  addEventListener('blur', () => down.clear());
  addEventListener('pointerdown', () => Sound.init());

  const any = codes => codes.some(c => down.has(c));
  const prev = [{ shoot: false, lob: false, start: false }, { shoot: false, lob: false, start: false }];
  const state = [0, 1].map(() => ({ mx: 0, my: 0, shoot: false, lob: false,
    shootPressed: false, shootReleased: false, lobPressed: false, lobReleased: false }));

  function poll() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    for (let i = 0; i < 2; i++) {
      const b = BIND[i], s = state[i];
      let mx = (any(b.right) ? 1 : 0) - (any(b.left) ? 1 : 0);
      let my = (any(b.down) ? 1 : 0) - (any(b.up) ? 1 : 0);
      let shoot = any(b.shoot), lob = any(b.lob), start = false;
      const pad = pads[i];
      if (pad) {
        const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
        if (Math.hypot(ax, ay) > 0.3) { mx = ax; my = ay; }
        const btn = k => pad.buttons[k] && pad.buttons[k].pressed;
        if (btn(14)) mx = -1; if (btn(15)) mx = 1; if (btn(12)) my = -1; if (btn(13)) my = 1;
        shoot = shoot || btn(0) || btn(2);
        lob = lob || btn(1) || btn(3);
        start = btn(9);
      }
      const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
      s.mx = mx; s.my = my;
      s.shootPressed = shoot && !prev[i].shoot;
      s.shootReleased = !shoot && prev[i].shoot;
      s.lobPressed = lob && !prev[i].lob;
      s.lobReleased = !lob && prev[i].lob;
      s.shoot = shoot; s.lob = lob;
      if (start && !prev[i].start) pressedQueue.push('PadStart');
      prev[i].shoot = shoot; prev[i].lob = lob; prev[i].start = start;
    }
  }

  return {
    poll,
    player: i => state[i],
    takePresses() { const q = pressedQueue.slice(); pressedQueue.length = 0; return q; },
    isDown: code => down.has(code),
  };
})();
