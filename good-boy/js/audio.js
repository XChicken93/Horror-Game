// Fully procedural WebAudio sound design.
export const A = {
  ctx: null, master: null, muffle: null, reverb: null, wet: null, ready: false,
  listener: null, voices: {}, loops: {},
};

let noiseBuf, brownBuf;

function mkNoise(ctx, secs, brown) {
  const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}
function impulse(ctx, secs, decay) {
  const len = ctx.sampleRate * secs;
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

export function initAudio() {
  if (A.ctx) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  A.ctx = ctx;
  noiseBuf = mkNoise(ctx, 3, false);
  brownBuf = mkNoise(ctx, 4, true);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  comp.connect(ctx.destination);
  A.master = ctx.createGain(); A.master.gain.value = 0.9;
  A.muffle = ctx.createBiquadFilter(); A.muffle.type = 'lowpass'; A.muffle.frequency.value = 18000;
  A.master.connect(A.muffle); A.muffle.connect(comp);
  A.reverb = ctx.createConvolver(); A.reverb.buffer = impulse(ctx, 2.2, 2.6);
  A.wet = ctx.createGain(); A.wet.gain.value = 0.35;
  A.reverb.connect(A.wet); A.wet.connect(A.master);
  A.listener = ctx.listener;
  A.ready = true;
}

const now = () => A.ctx.currentTime;

function out(node, wet = 0.3) {
  node.connect(A.master);
  if (wet > 0) { const g = A.ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(A.reverb); }
}

export function panner(x, y, z, ref = 1.2, roll = 1.4) {
  const p = A.ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
  p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 60;
  setPos(p, x, y, z);
  return p;
}
export function setPos(p, x, y, z) {
  if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
  else p.setPosition(x, y, z);
}

export function setListener(pos, fwd) {
  if (!A.ready) return;
  const l = A.listener;
  if (l.positionX) {
    l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
    l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
    l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else {
    l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
  }
}

function noiseSrc(brown, loop = true) {
  const s = A.ctx.createBufferSource();
  s.buffer = brown ? brownBuf : noiseBuf; s.loop = loop;
  s.loopStart = Math.random(); s.start(now(), Math.random() * 2);
  return s;
}

// ---------------------------------------------------------------------------
// Ambient loops
export function startAmbience(pos) {
  const ctx = A.ctx;
  // storm wind
  {
    const s = noiseSrc(true);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.25;
    s.connect(f); f.connect(g); out(g, 0.1);
    const s2 = noiseSrc(false);
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 900; f2.Q.value = 6;
    const g2 = ctx.createGain(); g2.gain.value = 0.02;
    s2.connect(f2); f2.connect(g2); out(g2, 0.2);
    A.loops.wind = { g, f, g2, f2 };
  }
  // snow/sleet hiss on the windows
  {
    const s = noiseSrc(false);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4000;
    const g = ctx.createGain(); g.gain.value = 0.012;
    s.connect(f); f.connect(g); out(g, 0);
  }
  // furnace drone (positional, in the basement)
  {
    const p = panner(pos.furnace.x, pos.furnace.y + 1, pos.furnace.z, 2.0, 0.8);
    const g = ctx.createGain(); g.gain.value = 0.0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 46;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 49.5;
    const n = noiseSrc(true); const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 90; nf.Q.value = 1;
    const ng = ctx.createGain(); ng.gain.value = 1.4;
    o1.connect(lp); o2.connect(lp); n.connect(nf); nf.connect(ng); ng.connect(lp);
    lp.connect(g); g.connect(p); out(p, 0.4);
    o1.start(); o2.start();
    A.loops.furnace = { g, lp, o1, o2 };
  }
  // fridge hum
  {
    const p = panner(9.55, 1, 9.6, 0.6, 2.5);
    const o = ctx.createOscillator(); o.frequency.value = 59; const o2 = ctx.createOscillator(); o2.frequency.value = 118;
    const g = ctx.createGain(); g.gain.value = 0.05; const g2 = ctx.createGain(); g2.gain.value = 0.02;
    o.connect(g); o2.connect(g2); g.connect(p); g2.connect(p); out(p, 0.05); o.start(); o2.start();
    A.loops.fridge = { g };
  }
  // TV static
  {
    const p = panner(8.0, 0.8, 5.7, 0.8, 2);
    const s = noiseSrc(false);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.035;
    s.connect(f); f.connect(g); g.connect(p); out(p, 0.1);
    A.loops.tv = { g, p };
  }
  // laundry window draught
  {
    const p = panner(11.6, 1.7, 0.1, 0.5, 2.5);
    const s = noiseSrc(false);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0.08;
    s.connect(f); f.connect(g); g.connect(p); out(p, 0.1);
  }
  // heartbeat + tinnitus (non-positional)
  {
    const g = ctx.createGain(); g.gain.value = 0; const o = ctx.createOscillator(); o.frequency.value = 5800;
    o.connect(g); out(g, 0); o.start();
    A.loops.tinnitus = { g, o };
  }
}

export function updateAmbience(co, t, wind) {
  if (!A.ready) return;
  const L = A.loops;
  const k = now();
  if (L.wind) {
    const gust = 0.18 + 0.14 * Math.sin(t * 0.21) + 0.08 * Math.sin(t * 0.77 + 1) + wind;
    L.wind.g.gain.setTargetAtTime(Math.max(0.05, gust), k, 0.3);
    L.wind.f.frequency.setTargetAtTime(260 + 120 * Math.sin(t * 0.13), k, 0.5);
    L.wind.g2.gain.setTargetAtTime(Math.max(0, 0.03 * Math.sin(t * 0.31)) + wind * 0.05, k, 0.4);
    L.wind.f2.frequency.setTargetAtTime(800 + 400 * Math.sin(t * 0.17), k, 0.4);
  }
  if (L.furnace) {
    const on = co > 0.02 ? 1 : 0;
    const breath = 0.5 + 0.5 * Math.sin(t * (0.5 + co * 0.6));
    L.furnace.g.gain.setTargetAtTime(on * (0.35 + co * 0.7) * (0.6 + 0.4 * breath), k, 0.2);
    L.furnace.lp.frequency.setTargetAtTime(120 + co * 180 + breath * 60, k, 0.2);
  }
  if (L.tinnitus) {
    L.tinnitus.g.gain.setTargetAtTime(Math.max(0, co - 0.55) * 0.02, k, 1.0);
  }
  // the world gets muffled as the dog loses consciousness
  A.muffle.frequency.setTargetAtTime(18000 - Math.pow(Math.max(0, co - 0.5) * 2, 1.5) * 16500, k, 0.5);
}

export function setTV(on) { if (A.loops.tv) A.loops.tv.g.gain.setTargetAtTime(on ? 0.035 : 0, now(), 0.1); }
export function setFridge(on) { if (A.loops.fridge) A.loops.fridge.g.gain.setTargetAtTime(on ? 0.05 : 0, now(), 0.1); }

// ---------------------------------------------------------------------------
// One-shots
function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

export function thunder(dist = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now() + 0.3 * dist;
  const s = noiseSrc(true, false);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
  const g = ctx.createGain();
  env(g, t0, 0.05, 1.3 / dist, 4.5);
  f.frequency.setValueAtTime(900, t0); f.frequency.exponentialRampToValueAtTime(120, t0 + 3);
  s.connect(f); f.connect(g); out(g, 0.6);
  // crackle
  const c = noiseSrc(false, false); const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1800;
  const cg = ctx.createGain(); env(cg, t0, 0.01, 0.25 / dist, 0.5);
  c.connect(cf); cf.connect(cg); out(cg, 0.5);
}

export function bark(loud = 1) {
  if (!A.ready) return;
  const ctx = A.ctx;
  for (let i = 0; i < (loud > 0.8 ? 2 : 1); i++) {
    const t0 = now() + i * 0.16;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(520 + Math.random() * 60, t0);
    o.frequency.exponentialRampToValueAtTime(260, t0 + 0.14);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 2200; f2.gain.value = 8;
    const n = noiseSrc(false, false); const ng = ctx.createGain(); env(ng, t0, 0.005, 0.25 * loud, 0.08);
    const g = ctx.createGain(); env(g, t0, 0.01, 0.7 * loud, 0.15);
    o.connect(f); f.connect(f2); f2.connect(g); n.connect(ng); ng.connect(f);
    out(g, 0.7);
    o.start(t0); o.stop(t0 + 0.3); n.stop(t0 + 0.3);
  }
}

export function whine() {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(850, t0); o.frequency.linearRampToValueAtTime(1350, t0 + 0.35); o.frequency.linearRampToValueAtTime(780, t0 + 0.9);
  const v = ctx.createOscillator(); v.frequency.value = 7; const vg = ctx.createGain(); vg.gain.value = 25; v.connect(vg); vg.connect(o.frequency);
  const g = ctx.createGain(); env(g, t0, 0.08, 0.16, 0.85);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
  o.connect(f); f.connect(g); out(g, 0.5);
  o.start(t0); v.start(t0); o.stop(t0 + 1.1); v.stop(t0 + 1.1);
}

export function step(kind, x, y, z, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const s = noiseSrc(false, false);
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  if (kind === 'claw') { f.type = 'highpass'; f.frequency.value = 3500; env(g, t0, 0.002, 0.05 * vol, 0.03); }
  else if (kind === 'soft') { f.type = 'lowpass'; f.frequency.value = 500; env(g, t0, 0.005, 0.04 * vol, 0.06); }
  else if (kind === 'stair') { f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 2; env(g, t0, 0.003, 0.25 * vol, 0.12); }
  else { f.type = 'lowpass'; f.frequency.value = 220; env(g, t0, 0.005, 0.5 * vol, 0.12); }
  s.connect(f); f.connect(g);
  if (x !== undefined) { const p = panner(x, y, z, 1, 1.6); g.connect(p); out(p, 0.25); } else out(g, 0.15);
  s.stop(t0 + 0.3);
}

export function creak(x, y, z, len = 1.5, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(70, t0);
  for (let i = 1; i < 8; i++) o.frequency.linearRampToValueAtTime(60 + Math.random() * 90, t0 + (i / 8) * len);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 12;
  const am = ctx.createOscillator(); am.frequency.value = 23; const amg = ctx.createGain(); amg.gain.value = 0.5;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.25 * vol, t0 + 0.1); g.gain.linearRampToValueAtTime(0.0001, t0 + len);
  am.connect(amg); amg.connect(g.gain);
  o.connect(f); f.connect(g);
  const p = panner(x, y, z, 1, 1.2); g.connect(p); out(p, 0.5);
  o.start(t0); am.start(t0); o.stop(t0 + len + 0.1); am.stop(t0 + len + 0.1);
}

export function knock(x, y, z, n = 3, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx;
  for (let i = 0; i < n; i++) {
    const t0 = now() + i * 0.42;
    const s = noiseSrc(false, false);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 260; f.Q.value = 3;
    const o = ctx.createOscillator(); o.frequency.value = 110; const og = ctx.createGain(); env(og, t0, 0.002, 0.6 * vol, 0.12);
    const g = ctx.createGain(); env(g, t0, 0.002, 1.2 * vol, 0.08);
    s.connect(f); f.connect(g); o.connect(og);
    const p = panner(x, y, z, 1, 1); g.connect(p); og.connect(p); out(p, 0.6);
    o.start(t0); o.stop(t0 + 0.3); s.stop(t0 + 0.3);
  }
}

export function whoomp(x, y, z) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t0); o.frequency.exponentialRampToValueAtTime(30, t0 + 1.2);
  const g = ctx.createGain(); env(g, t0, 0.02, 1.0, 1.4);
  const s = noiseSrc(true, false); const sg = ctx.createGain(); env(sg, t0, 0.05, 0.8, 1.6);
  const p = panner(x, y, z, 3, 0.6);
  o.connect(g); s.connect(sg); g.connect(p); sg.connect(p); out(p, 0.6);
  o.start(t0); o.stop(t0 + 2);
}

export function stinger(intensity = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const freqs = [110, 116.5, 155.6, 233, 246.9, 349.2];
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(3500 * intensity, t0 + 0.4); f.frequency.exponentialRampToValueAtTime(200, t0 + 4);
  const g = ctx.createGain(); env(g, t0, 0.03, 0.22 * intensity, 4.0);
  f.connect(g); out(g, 0.8);
  for (const fr of freqs) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr * (1 + (Math.random() - 0.5) * 0.02);
    o.frequency.linearRampToValueAtTime(fr * 0.94, t0 + 4);
    o.connect(f); o.start(t0); o.stop(t0 + 4.2);
  }
}

export function scream() {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const g = ctx.createGain(); env(g, t0, 0.01, 0.9, 1.4);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 0.8;
  f.connect(g); out(g, 0.7);
  for (let i = 0; i < 5; i++) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(700 + i * 137, t0); o.frequency.exponentialRampToValueAtTime(180 + i * 40, t0 + 1.4);
    o.connect(f); o.start(t0); o.stop(t0 + 1.5);
  }
  const s = noiseSrc(false, false); const sg = ctx.createGain(); env(sg, t0, 0.005, 0.6, 1.0); s.connect(sg); sg.connect(f); s.stop(t0 + 1.5);
}

export function heartbeat(vol) {
  if (!A.ready || vol <= 0.01) return;
  const ctx = A.ctx;
  for (let i = 0; i < 2; i++) {
    const t0 = now() + i * 0.22;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(65, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.15);
    const g = ctx.createGain(); env(g, t0, 0.01, (i ? 0.5 : 0.8) * vol, 0.2);
    o.connect(g); out(g, 0); o.start(t0); o.stop(t0 + 0.3);
  }
}

export function clockTick(x, y, z, vol) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const s = noiseSrc(false, false);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 8;
  const g = ctx.createGain(); env(g, t0, 0.001, 0.25 * vol, 0.03);
  s.connect(f); f.connect(g); const p = panner(x, y, z, 0.6, 2); g.connect(p); out(p, 0.2);
  s.stop(t0 + 0.1);
}

export function pickup() {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const s = noiseSrc(false, false); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
  const g = ctx.createGain(); env(g, t0, 0.01, 0.12, 0.15); s.connect(f); f.connect(g); out(g, 0.1); s.stop(t0 + 0.3);
}

export function scratch() {
  if (!A.ready) return;
  const ctx = A.ctx;
  for (let i = 0; i < 4; i++) {
    const t0 = now() + i * 0.09;
    const s = noiseSrc(false, false); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500 + Math.random() * 1500; f.Q.value = 4;
    const g = ctx.createGain(); env(g, t0, 0.005, 0.2, 0.07); s.connect(f); f.connect(g); out(g, 0.3); s.stop(t0 + 0.2);
  }
}

// lullaby: an original little melody, hummed. Detunes as the night goes on.
const MEL = [64, 67, 69, 67, 64, 62, 60, 62, 64, 64, 62, 59, 60, 0, 64, 67, 72, 71, 69, 67, 64, 62, 60, 0];
export function lullaby(getPos, co, dur = 0.55, startDelay = 0) {
  if (!A.ready) return { stop() { } };
  const ctx = A.ctx;
  const p = panner(...getPos(), 1.0, 1.3);
  const master = ctx.createGain(); master.gain.value = 0.18;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  master.connect(lp); lp.connect(p); out(p, 0.6);
  const t0 = now() + startDelay;
  const nodes = [];
  MEL.forEach((m, i) => {
    if (!m) return;
    const t = t0 + i * dur;
    const fr = 440 * Math.pow(2, (m - 69) / 12) * (1 - co * 0.04 * Math.sin(i * 1.7));
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr * (co > 0.4 ? 0.5 : 1);
    o.frequency.linearRampToValueAtTime(fr * (1 - co * 0.05) * (co > 0.4 ? 0.5 : 1), t + dur);
    const vib = ctx.createOscillator(); vib.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = 3 + co * 12; vib.connect(vg); vg.connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + 0.08); g.gain.linearRampToValueAtTime(0.0001, t + dur * 0.98);
    o.connect(g); g.connect(master);
    o.start(t); vib.start(t); o.stop(t + dur); vib.stop(t + dur);
    nodes.push(o, vib);
  });
  const handle = {
    p, stopped: false, endTime: t0 + MEL.length * dur,
    update() { if (!this.stopped) setPos(p, ...getPos()); },
    stop() { this.stopped = true; master.gain.setTargetAtTime(0, now(), 0.2); },
  };
  return handle;
}

// ---------------------------------------------------------------------------
// Muffled human speech. Each syllable is a formant-filtered buzz through a lowpass.
const VOICES = {
  father: { f0: 98, formants: [600, 1100], lp: 900 },
  mother: { f0: 195, formants: [750, 1300], lp: 1100 },
  lily: { f0: 290, formants: [900, 1700], lp: 1400 },
  danny: { f0: 150, formants: [500, 900], lp: 600 },
};
export function speak(who, nSyl, tone, getPos) {
  if (!A.ready) return 0;
  const ctx = A.ctx, v = VOICES[who] || VOICES.father;
  const p = panner(...getPos(), 1.2, 1.1);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = v.lp;
  const master = ctx.createGain(); master.gain.value = tone === 'sharp' ? 0.5 : tone === 'whisper' ? 0.18 : 0.32;
  lp.connect(master); master.connect(p); out(p, tone === 'whisper' ? 0.6 : 0.3);
  let t = now() + 0.05;
  const rate = tone === 'sharp' ? 0.12 : tone === 'sad' ? 0.22 : tone === 'sleepy' ? 0.26 : tone === 'whisper' ? 0.17 : 0.16;
  for (let i = 0; i < nSyl; i++) {
    const d = rate * (0.6 + Math.random() * 0.8);
    let f0 = v.f0 * (tone === 'sharp' ? 1.25 : tone === 'sad' ? 0.92 : tone === 'sleepy' ? 0.85 : 1);
    const contour = tone === 'sad' || tone === 'sleepy' ? 1 - (i / nSyl) * 0.15 : 1 + Math.sin(i * 1.3) * 0.08;
    f0 *= contour * (0.95 + Math.random() * 0.1);
    let src;
    if (tone === 'whisper') { src = noiseSrc(false, false); src.stop(t + d + 0.05); }
    else { src = ctx.createOscillator(); src.type = 'sawtooth'; src.frequency.setValueAtTime(f0, t); src.frequency.linearRampToValueAtTime(f0 * (0.9 + Math.random() * 0.2), t + d); src.start(t); src.stop(t + d + 0.05); }
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.03); g.gain.linearRampToValueAtTime(0.0001, t + d);
    const vowel = Math.random();
    for (const [j, fm] of v.formants.entries()) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fm * (0.75 + vowel * 0.5) * (j ? 1 + vowel * 0.3 : 1); bp.Q.value = 5;
      src.connect(bp); bp.connect(g);
    }
    g.connect(lp);
    t += d + (Math.random() < 0.18 ? 0.12 : 0.02);
  }
  const total = t - now();
  return { total, p };
}
