'use strict';
// Tiny WebAudio synth for all sound effects (no asset files).
const Sound = (() => {
  let ac = null, master = null, noiseBuf = null, crowdGain = null, muted = false;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // ambient crowd murmur
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.6;
    crowdGain = ac.createGain(); crowdGain.gain.value = 0.035;
    src.connect(bp); bp.connect(crowdGain); crowdGain.connect(master); src.start();
  }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type, f0, f1, dur, vol, delay = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, vol, dur); o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, type = 'lowpass', delay = 0, attack = 0.003) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ac.createGain(); env(g, t, attack, vol, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + attack + dur + 0.05);
  }

  return {
    init,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    kick(p = 0.5) { tone('sine', 150 + p * 60, 45, 0.12, 0.5 + p * 0.4); noise(0.06, 0.25 + p * 0.3, 2500); },
    bounce(v = 0.5) { tone('sine', 220, 90, 0.07, 0.12 * v); },
    post() { tone('triangle', 880, 860, 0.5, 0.35); tone('square', 1320, 1300, 0.25, 0.08); },
    tackle() { noise(0.18, 0.35, 900); tone('sine', 120, 60, 0.12, 0.3); },
    jump() { tone('square', 300, 520, 0.08, 0.06); },
    catchBall() { tone('sine', 300, 180, 0.08, 0.3); noise(0.05, 0.2, 1200); },
    blip(hi = false) { tone('square', hi ? 880 : 660, hi ? 880 : 660, 0.06, 0.08); },
    whistle(len = 0.35, times = 1) {
      if (!ac || muted) return;
      for (let i = 0; i < times; i++) {
        const t = ac.currentTime + i * (len + 0.12);
        const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = 2300; lfo.frequency.value = 28; lg.gain.value = 120;
        lfo.connect(lg); lg.connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        g.gain.setValueAtTime(0.18, t + len - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
      }
    },
    goal() {
      noise(2.6, 0.5, 900, 'bandpass', 0, 0.25);
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('square', f, f, 0.14, 0.1, 0.1 + i * 0.12));
      if (crowdGain && ac) {
        const t = ac.currentTime;
        crowdGain.gain.cancelScheduledValues(t);
        crowdGain.gain.setValueAtTime(0.16, t); crowdGain.gain.linearRampToValueAtTime(0.035, t + 4);
      }
    },
    oohh() { noise(1.0, 0.18, 500, 'bandpass', 0, 0.15); },
  };
})();
