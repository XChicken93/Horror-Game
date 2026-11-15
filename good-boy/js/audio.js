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
    L.tinnitus.g.gain.setTargetAtTime(0, k, 1.0);
  }
  // the world gets muffled as the dog loses consciousness
  A.muffle.frequency.setTargetAtTime(18000 - Math.pow(Math.max(0, co - 0.5) * 2, 1.5) * 16500, k, 0.5);
}

export function setTV(on) { if (A.loops.tv) A.loops.tv.g.gain.setTargetAtTime(on ? 0.035 : 0, now(), 0.1); }
export function setFridge(on) { if (A.loops.fridge) A.loops.fridge.g.gain.setTargetAtTime(on ? 0.05 : 0, now(), 0.1); }

// ---------------------------------------------------------------------------
// One-shots. Everything is synthesised, but built the way the real sound works:
// barks are formant-filtered bursts with a chest thump, creaks are stick-slip
// impulse trains through wood resonances, knocks excite a resonant body.
function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function bp(f, q) { const n = A.ctx.createBiquadFilter(); n.type = 'bandpass'; n.frequency.value = f; n.Q.value = q; return n; }
function filt(type, f, q = 0.7) { const n = A.ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; }
let shaperCurve = null;
function shaper(amount = 3) {
  const s = A.ctx.createWaveShaper();
  if (!shaperCurve) { shaperCurve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; shaperCurve[i] = Math.tanh(x * amount); } }
  s.curve = shaperCurve; return s;
}
function at(node, x, y, z, ref = 1, roll = 1.4, wet = 0.35) {
  if (x === undefined) { out(node, wet); return; }
  const p = panner(x, y, z, ref, roll); node.connect(p); out(p, wet);
}
// a buffer of clicks whose rate wanders: the raw material of wood creaks and scratches
function impulseTrain(secs, rate0, rate1, jitter = 0.4) {
  const sr = A.ctx.sampleRate, len = Math.floor(sr * secs);
  const b = A.ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  let t = 0;
  while (t < len) {
    const f = t / len, rate = rate0 + (rate1 - rate0) * f + Math.sin(f * 17) * rate0 * 0.3;
    const amp = (0.4 + Math.random() * 0.6) * Math.sin(Math.PI * Math.min(1, f * 1.2));
    d[t] = amp; if (t + 1 < len) d[t + 1] = -amp * 0.5;
    t += Math.max(2, Math.floor((sr / Math.max(5, rate)) * (1 + (Math.random() - 0.5) * jitter)));
  }
  const s = A.ctx.createBufferSource(); s.buffer = b; return s;
}

export function thunder(dist = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now() + 0.3 * dist;
  const s = noiseSrc(true, false);
  const f = filt('lowpass', 300);
  const g = ctx.createGain();
  env(g, t0, 0.05, 1.3 / dist, 4.5);
  f.frequency.setValueAtTime(900, t0); f.frequency.exponentialRampToValueAtTime(110, t0 + 3);
  s.connect(f); f.connect(g); out(g, 0.6);
  const c = noiseSrc(false, false); const cf = bp(1800, 0.7);
  const cg = ctx.createGain(); env(cg, t0, 0.01, 0.22 / dist, 0.5);
  c.connect(cf); cf.connect(cg); out(cg, 0.5);
  // rolling aftershocks
  for (let i = 1; i < 4; i++) {
    const r = noiseSrc(true, false); const rf = filt('lowpass', 160); const rg = ctx.createGain();
    env(rg, t0 + i * (0.5 + Math.random() * 0.6), 0.1, 0.5 / dist / i, 1.5);
    r.connect(rf); rf.connect(rg); out(rg, 0.6);
  }
}

export function bark(loud = 1) {
  if (!A.ready) return;
  const ctx = A.ctx;
  const n = loud > 0.8 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const t0 = now() + i * (0.19 + Math.random() * 0.05);
    const f0 = 230 + Math.random() * 40;
    // voiced source: two detuned saws, slightly overdriven
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    for (const o of [o1, o2]) {
      o.frequency.setValueAtTime(f0 * 1.1, t0);
      o.frequency.linearRampToValueAtTime(f0 * 2.1, t0 + 0.035);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.15, t0 + 0.16);
    }
    o2.detune.value = 9;
    const mix = ctx.createGain(); mix.gain.value = 0.5;
    o1.connect(mix); o2.connect(mix);
    const sh = shaper(2.5); mix.connect(sh);
    const breath = noiseSrc(false, false); const bg = ctx.createGain(); env(bg, t0, 0.004, 0.5, 0.12); breath.connect(bg);
    // vocal tract: "wouf" formants
    const sum = ctx.createGain(); sum.gain.value = 1;
    for (const [fr, q, gn] of [[650, 5, 1], [1250, 6, 0.7], [2700, 8, 0.35]]) {
      const f = bp(fr, q); const fg = ctx.createGain(); fg.gain.value = gn;
      sh.connect(f); bg.connect(f); f.connect(fg); fg.connect(sum);
      f.frequency.setValueAtTime(fr * 0.75, t0); f.frequency.linearRampToValueAtTime(fr, t0 + 0.04); f.frequency.linearRampToValueAtTime(fr * 0.85, t0 + 0.17);
    }
    const g = ctx.createGain(); env(g, t0, 0.006, 0.9 * loud, 0.2);
    sum.connect(g);
    // chest thump
    const th = ctx.createOscillator(); th.frequency.setValueAtTime(150, t0); th.frequency.exponentialRampToValueAtTime(70, t0 + 0.08);
    const tg = ctx.createGain(); env(tg, t0, 0.004, 0.5 * loud, 0.09); th.connect(tg); tg.connect(g);
    out(g, 0.45);
    for (const o of [o1, o2, th]) { o.start(t0); o.stop(t0 + 0.3); }
    breath.stop(t0 + 0.3);
  }
}

export function whine() {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  const pts = [[0, 700], [0.15, 1150], [0.35, 1300], [0.55, 1050], [0.8, 1250], [1.05, 820]];
  o.frequency.setValueAtTime(pts[0][1], t0);
  for (const [t, f] of pts) o.frequency.linearRampToValueAtTime(f * (0.95 + Math.random() * 0.1), t0 + t);
  const v = ctx.createOscillator(); v.frequency.value = 6.5; const vg = ctx.createGain(); vg.gain.value = 30; v.connect(vg); vg.connect(o.frequency);
  const nose = bp(1300, 2.5), nose2 = bp(2600, 4);
  const air = noiseSrc(false, false); const ag = ctx.createGain(); ag.gain.value = 0.25; air.connect(ag); ag.connect(nose2);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.14, t0 + 0.1); g.gain.setValueAtTime(0.14, t0 + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
  o.connect(nose); o.connect(nose2); nose.connect(g); nose2.connect(g); out(g, 0.4);
  o.start(t0); v.start(t0); o.stop(t0 + 1.2); v.stop(t0 + 1.2); air.stop(t0 + 1.2);
}

export function step(kind, x, y, z, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  if (kind === 'snow') {
    // a paw pressing into deep snow: a soft compression squeak and a crunch
    const n = noiseSrc(false, false); const f = bp(1400 + Math.random() * 900, 1.1); const g = ctx.createGain();
    env(g, t0, 0.012, 0.22 * vol, 0.11); n.connect(f); f.connect(g); at(g, x, y, z, 1, 1.6, 0.05); n.stop(t0 + 0.25);
    const tr = impulseTrain(0.09, 900, 300, 0.9); const tf = bp(3200, 1.5); const tg = ctx.createGain();
    env(tg, t0 + 0.02, 0.004, 0.18 * vol, 0.08); tr.connect(tf); tf.connect(tg); at(tg, x, y, z, 1, 1.6, 0.05); tr.start(t0 + 0.02);
    return;
  }
  if (kind === 'claw' || kind === 'soft' || kind === 'stair') {
    // paw pad thump + nail clicks (no clicks on carpet)
    const pad = noiseSrc(true, false); const pf = filt('lowpass', kind === 'stair' ? 500 : 280); const pg = ctx.createGain();
    env(pg, t0, 0.004, (kind === 'stair' ? 0.35 : 0.12) * vol, 0.07); pad.connect(pf); pf.connect(pg); at(pg, x, y, z, 1, 1.6, 0.15); pad.stop(t0 + 0.2);
    if (kind !== 'soft') for (let i = 0; i < 2; i++) {
      const c = noiseSrc(false, false); const cf = bp(4200 + Math.random() * 1800, 3); const cg = ctx.createGain();
      env(cg, t0 + 0.01 + i * (0.012 + Math.random() * 0.01), 0.001, 0.07 * vol, 0.012); c.connect(cf); cf.connect(cg); at(cg, x, y, z, 1, 1.6, 0.15); c.stop(t0 + 0.1);
    }
    return;
  }
  // a person: heel, then toe, and sometimes the old floor complains
  const heel = ctx.createOscillator(); heel.frequency.setValueAtTime(95, t0); heel.frequency.exponentialRampToValueAtTime(45, t0 + 0.09);
  const hg = ctx.createGain(); env(hg, t0, 0.003, 0.55 * vol, 0.1); heel.connect(hg);
  const n = noiseSrc(true, false); const nf = filt('lowpass', 420); const ng = ctx.createGain(); env(ng, t0, 0.003, 0.5 * vol, 0.08); n.connect(nf); nf.connect(ng);
  const toe = noiseSrc(false, false); const tf = bp(900, 1.2); const tg = ctx.createGain(); env(tg, t0 + 0.07, 0.003, 0.08 * vol, 0.05); toe.connect(tf); tf.connect(tg);
  const sum = ctx.createGain(); hg.connect(sum); ng.connect(sum); tg.connect(sum);
  at(sum, x, y, z, 1, 1.5, 0.25);
  heel.start(t0); heel.stop(t0 + 0.2); n.stop(t0 + 0.2); toe.stop(t0 + 0.2);
  if (Math.random() < 0.12 && x !== undefined) creak(x, y, z, 0.25 + Math.random() * 0.3, 0.45);
}

export function creak(x, y, z, len = 1.5, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const src = impulseTrain(len, 35 + Math.random() * 25, 70 + Math.random() * 60, 0.35);
  const sum = ctx.createGain(); sum.gain.value = 1;
  for (const [f, q, gn] of [[340, 14, 1], [780, 16, 0.8], [1650, 18, 0.5], [2900, 12, 0.25]]) {
    const b = bp(f * (0.9 + Math.random() * 0.2), q); const g = ctx.createGain(); g.gain.value = gn; src.connect(b); b.connect(g); g.connect(sum);
  }
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(2.2 * vol, t0 + 0.05); g.gain.setValueAtTime(2.2 * vol, t0 + len * 0.8); g.gain.linearRampToValueAtTime(0.0001, t0 + len);
  sum.connect(g); at(g, x, y, z, 1, 1.2, 0.45);
  src.start(t0);
}

export function knock(x, y, z, n = 3, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx;
  for (let i = 0; i < n; i++) {
    const t0 = now() + i * (0.38 + Math.random() * 0.06);
    const s = noiseSrc(false, false); const sg = ctx.createGain(); env(sg, t0, 0.0008, 1, 0.012); s.connect(sg);
    const sum = ctx.createGain();
    for (const [f, q, gn] of [[115, 9, 1.2], [260, 10, 0.9], [540, 7, 0.4], [2400, 2, 0.15]]) { const b = bp(f, q); const g = ctx.createGain(); g.gain.value = gn; sg.connect(b); b.connect(g); g.connect(sum); }
    const out1 = ctx.createGain(); env(out1, t0, 0.001, 2.5 * vol, 0.25); sum.connect(out1);
    at(out1, x, y, z, 1, 1, 0.55); s.stop(t0 + 0.2);
  }
}

export function rattle(x, y, z, vol = 1) {
  // the basement door shaking against its hook
  if (!A.ready) return;
  const ctx = A.ctx;
  const n = 5 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const t0 = now() + i * (0.045 + Math.random() * 0.04);
    const s = noiseSrc(false, false); const sg = ctx.createGain(); env(sg, t0, 0.0008, 1, 0.01); s.connect(sg);
    const b = bp(320 + Math.random() * 80, 8), b2 = bp(2300 + Math.random() * 500, 25);
    const g = ctx.createGain(); env(g, t0, 0.001, (0.8 + Math.random() * 0.6) * vol, 0.12);
    sg.connect(b); sg.connect(b2); b.connect(g); b2.connect(g); at(g, x, y, z, 1, 1.2, 0.4); s.stop(t0 + 0.2);
  }
}

export function whoomp(x, y, z) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t0); o.frequency.exponentialRampToValueAtTime(28, t0 + 1.4);
  const g = ctx.createGain(); env(g, t0, 0.04, 1.0, 1.6);
  const s = noiseSrc(true, false); const sf = filt('lowpass', 500); const sg = ctx.createGain(); env(sg, t0, 0.08, 0.9, 2.2);
  sf.frequency.setValueAtTime(900, t0); sf.frequency.exponentialRampToValueAtTime(140, t0 + 2);
  const p = panner(x, y, z, 3, 0.6);
  o.connect(g); s.connect(sf); sf.connect(sg); g.connect(p); sg.connect(p); out(p, 0.6);
  o.start(t0); o.stop(t0 + 2.2); s.stop(t0 + 2.5);
  // the metal ducts tick as they heat
  for (let i = 0; i < 6; i++) setTimeout(() => knock(x + (Math.random() - 0.5) * 4, y + 1.5, z + (Math.random() - 0.5) * 4, 1, 0.25), 1500 + i * (300 + Math.random() * 700));
}

export function stinger(intensity = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const freqs = [110, 116.5, 155.6, 233, 246.9, 349.2];
  const f = filt('lowpass', 300); f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(3200 * intensity, t0 + 0.4); f.frequency.exponentialRampToValueAtTime(200, t0 + 4);
  const g = ctx.createGain(); env(g, t0, 0.03, 0.2 * intensity, 4.0);
  f.connect(g); out(g, 0.8);
  for (const fr of freqs) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr * (1 + (Math.random() - 0.5) * 0.02);
    o.frequency.linearRampToValueAtTime(fr * 0.94, t0 + 4);
    o.connect(f); o.start(t0); o.stop(t0 + 4.2);
  }
  // a bowed-metal scrape on top
  const sc = impulseTrain(2.5, 180, 90, 0.2); const sb = bp(1900, 20); const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t0); sg.gain.linearRampToValueAtTime(0.9 * intensity, t0 + 0.2); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.5);
  sc.connect(sb); sb.connect(sg); out(sg, 0.9); sc.start(t0);
}

export function scream() {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const g = ctx.createGain(); env(g, t0, 0.01, 0.9, 1.4);
  const sh = shaper(4); sh.connect(g); out(g, 0.7);
  const sum = ctx.createGain();
  for (const [fr, q] of [[900, 4], [1700, 5], [3100, 6]]) { const b = bp(fr, q); sum.connect(b); b.connect(sh); }
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(380 + i * 23, t0); o.frequency.linearRampToValueAtTime(520 + i * 31, t0 + 0.25); o.frequency.exponentialRampToValueAtTime(140 + i * 17, t0 + 1.4);
    const v = ctx.createOscillator(); v.frequency.value = 11 + i; const vg = ctx.createGain(); vg.gain.value = 25; v.connect(vg); vg.connect(o.frequency);
    o.connect(sum); o.start(t0); v.start(t0); o.stop(t0 + 1.5); v.stop(t0 + 1.5);
  }
  const s = noiseSrc(false, false); const sg = ctx.createGain(); env(sg, t0, 0.005, 0.5, 1.0); s.connect(sg); sg.connect(sum); s.stop(t0 + 1.5);
  // the furnace roar under it
  const r = noiseSrc(true, false); const rf = filt('lowpass', 220); const rg = ctx.createGain(); env(rg, t0, 0.02, 1.4, 1.8); r.connect(rf); rf.connect(rg); out(rg, 0.4); r.stop(t0 + 2);
}

export function heartbeat(vol) {
  if (!A.ready || vol <= 0.01) return;
  const ctx = A.ctx;
  for (let i = 0; i < 2; i++) {
    const t0 = now() + i * 0.24;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(58, t0); o.frequency.exponentialRampToValueAtTime(34, t0 + 0.16);
    const g = ctx.createGain(); env(g, t0, 0.012, (i ? 0.45 : 0.75) * vol, 0.22);
    const n = noiseSrc(true, false); const nf = filt('lowpass', 120); const ng = ctx.createGain(); env(ng, t0, 0.01, 0.3 * vol, 0.12); n.connect(nf); nf.connect(ng); ng.connect(g);
    o.connect(g); out(g, 0); o.start(t0); o.stop(t0 + 0.35); n.stop(t0 + 0.35);
  }
}

export function clockTick(x, y, z, vol) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const s = noiseSrc(false, false); const sg = ctx.createGain(); env(sg, t0, 0.0005, 1, 0.004); s.connect(sg);
  const b = bp(3200, 18), b2 = bp(1450, 12); const g = ctx.createGain(); env(g, t0, 0.001, 0.9 * vol, 0.05);
  sg.connect(b); sg.connect(b2); b.connect(g); b2.connect(g); at(g, x, y, z, 0.6, 2, 0.2); s.stop(t0 + 0.1);
}

export function pickup() {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  // a soft mouth-grab: breath and a little jaw click
  const s = noiseSrc(false, false); const f = bp(1100, 1.5); const g = ctx.createGain(); env(g, t0, 0.01, 0.14, 0.12); s.connect(f); f.connect(g); out(g, 0.1); s.stop(t0 + 0.3);
  knockSmall(t0 + 0.05, 0.12);
}
function knockSmall(t0, vol) {
  const ctx = A.ctx;
  const s = noiseSrc(false, false); const sg = ctx.createGain(); env(sg, t0, 0.0006, 1, 0.006); s.connect(sg);
  const b = bp(1800, 6); const g = ctx.createGain(); env(g, t0, 0.001, vol, 0.04); sg.connect(b); b.connect(g); out(g, 0.1); s.stop(t0 + 0.1);
}

export function scratch() {
  if (!A.ready) return;
  const ctx = A.ctx;
  for (let i = 0; i < 3; i++) {
    const t0 = now() + i * 0.14;
    const src = impulseTrain(0.11, 600, 300, 0.8);
    const b = bp(2600 + Math.random() * 1500, 2.5); const g = ctx.createGain(); env(g, t0, 0.005, 0.9, 0.1);
    src.connect(b); b.connect(g); out(g, 0.3); src.start(t0);
  }
}

export function eat() {
  if (!A.ready) return;
  const ctx = A.ctx;
  for (let i = 0; i < 9; i++) {
    const t0 = now() + i * (0.13 + Math.random() * 0.08);
    const s = noiseSrc(false, false); const f = bp(2200 + Math.random() * 1500, 1.4); const g = ctx.createGain(); env(g, t0, 0.002, 0.25, 0.05 + Math.random() * 0.04);
    s.connect(f); f.connect(g); out(g, 0.1); s.stop(t0 + 0.2);
    if (i % 3 === 0) knockSmall(t0 + 0.02, 0.15); // tags hitting the steel bowl
  }
}

export function drawer(x, y, z) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const src = impulseTrain(0.6, 120, 60, 0.6);
  const b = bp(700, 3); const g = ctx.createGain(); env(g, t0, 0.02, 1.5, 0.6);
  src.connect(b); b.connect(g); at(g, x, y, z, 1, 1.2, 0.4); src.start(t0);
  setTimeout(() => { knock(x, y - 0.5, z, 1, 0.9); paper(x, y - 0.8, z); }, 650);
}

export function paper(x, y, z) {
  if (!A.ready) return;
  const ctx = A.ctx;
  for (let i = 0; i < 5; i++) {
    const t0 = now() + i * (0.04 + Math.random() * 0.06);
    const s = noiseSrc(false, false); const f = filt('highpass', 2500 + Math.random() * 2000); const g = ctx.createGain(); env(g, t0, 0.004, 0.12, 0.05 + Math.random() * 0.08);
    s.connect(f); f.connect(g); at(g, x, y, z, 1, 1.5, 0.15); s.stop(t0 + 0.2);
  }
}

// the carbon monoxide alarm: piercing T4 pattern
let alarmTimer = null;
export function alarm(on, x, y, z) {
  if (!A.ready) return;
  clearInterval(alarmTimer); alarmTimer = null;
  if (!on) return;
  const beepSet = () => {
    for (let i = 0; i < 4; i++) {
      const t0 = now() + i * 0.2;
      const o = A.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 3150;
      const g = A.ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.16, t0 + 0.005); g.gain.setValueAtTime(0.16, t0 + 0.1); g.gain.linearRampToValueAtTime(0.0001, t0 + 0.11);
      const f = bp(3150, 2); o.connect(f); f.connect(g); at(g, x, y, z, 2.5, 0.6, 0.4);
      o.start(t0); o.stop(t0 + 0.12);
    }
  };
  beepSet(); alarmTimer = setInterval(beepSet, 5000 / 2);
}

// the furnace breathing through the heating vent, which sounds almost like a voice
export function ventVoice(x, y, z) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const syl = 4;
  const sum = ctx.createGain(); sum.gain.value = 0;
  for (let i = 0; i < syl; i++) {
    const ts = t0 + i * 0.42;
    const s = noiseSrc(true, false);
    const f1 = bp([500, 800, 600, 900][i], 7), f2 = bp([1100, 1300, 900, 1500][i], 9);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ts); g.gain.linearRampToValueAtTime(1.6, ts + 0.12); g.gain.linearRampToValueAtTime(0.0001, ts + 0.4);
    s.connect(f1); s.connect(f2); f1.connect(g); f2.connect(g); g.connect(sum); s.stop(ts + 0.5);
  }
  const rumble = noiseSrc(true, false); const rf = filt('lowpass', 120); const rg = ctx.createGain(); env(rg, t0, 0.3, 0.6, 2.2); rumble.connect(rf); rf.connect(rg); rg.connect(sum); rumble.stop(t0 + 3);
  sum.gain.setValueAtTime(0.5, t0);
  const metal = filt('peaking', 1800, 8); metal.gain.value = 9; sum.connect(metal);
  at(metal, x, y, z, 1, 1.6, 0.7);
}

export function rewindWhir(dur = 0.5) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(140, t0 + dur);
  const g = ctx.createGain(); env(g, t0, 0.02, 0.05, dur);
  const n = noiseSrc(false, false); const nf = bp(2400, 1); const ng = ctx.createGain(); env(ng, t0, 0.02, 0.05, dur);
  o.connect(g); n.connect(nf); nf.connect(ng); out(g, 0.3); out(ng, 0.3);
  o.start(t0); o.stop(t0 + dur + 0.1); n.stop(t0 + dur + 0.1);
}

export function chime() {
  // understanding: a soft two-note bell when Biscuit learns words
  if (!A.ready) return;
  const ctx = A.ctx;
  [[659.3, 0], [987.8, 0.18]].forEach(([f, d]) => {
    const t0 = now() + d;
    for (const [m, gn] of [[1, 0.12], [2.76, 0.03], [5.4, 0.015]]) {
      const o = ctx.createOscillator(); o.frequency.value = f * m; const g = ctx.createGain(); env(g, t0, 0.005, gn, 2.2);
      o.connect(g); out(g, 0.6); o.start(t0); o.stop(t0 + 2.4);
    }
  });
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
// Human speech heard by a dog: a glottal buzz shaped by three vowel formants, with
// consonant bursts between syllables. `clarity` (0..1) rises as Biscuit understands more.
const VOICES = {
  father: { f0: 104, scale: 1.0 },
  mother: { f0: 196, scale: 1.12 },
  lily: { f0: 285, scale: 1.25 },
  danny: { f0: 150, scale: 1.08 },
};
const VOWELS = [[730, 1090, 2440], [530, 1840, 2480], [270, 2290, 3010], [570, 840, 2410], [300, 870, 2240], [660, 1720, 2410], [490, 1350, 1690]];
export function speak(who, nSyl, tone, getPos, clarity = 0.3) {
  if (!A.ready) return 0;
  const ctx = A.ctx, v = VOICES[who] || VOICES.father;
  const p = panner(...getPos(), 1.2, 1.1);
  const muffle = filt('lowpass', 1100 + clarity * 2600, 0.5);
  const master = ctx.createGain();
  master.gain.value = tone === 'sharp' ? 0.55 : tone === 'whisper' ? 0.3 : 0.38;
  muffle.connect(master); master.connect(p); out(p, tone === 'whisper' ? 0.6 : 0.3);
  let t = now() + 0.05;
  const rate = tone === 'sharp' ? 0.13 : tone === 'sad' ? 0.21 : tone === 'sleepy' ? 0.24 : tone === 'whisper' ? 0.17 : 0.16;
  const base = v.f0 * (tone === 'sharp' ? 1.3 : tone === 'sad' ? 0.93 : tone === 'sleepy' ? 0.86 : 1);
  for (let i = 0; i < nSyl; i++) {
    const d = rate * (0.65 + Math.random() * 0.7);
    // declination + a rise at questions/phrase ends
    const contour = 1 - (i / Math.max(1, nSyl)) * (tone === 'sharp' ? 0.05 : 0.18) + (i === nSyl - 1 && tone !== 'sad' ? 0.06 : 0);
    const f0 = base * contour * (0.96 + Math.random() * 0.08);
    // consonant onset
    if (Math.random() < 0.65) {
      const c = noiseSrc(false, false); const cf = bp(2500 + Math.random() * 3500, 1.5); const cg = ctx.createGain();
      env(cg, t, 0.003, tone === 'whisper' ? 0.5 : 0.25, 0.03 + Math.random() * 0.03); c.connect(cf); cf.connect(cg); cg.connect(muffle); c.stop(t + 0.1);
      t += 0.025;
    }
    const vw = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    let src;
    if (tone === 'whisper') { src = noiseSrc(false, false); src.stop(t + d + 0.05); }
    else {
      src = ctx.createOscillator(); src.type = 'sawtooth';
      src.frequency.setValueAtTime(f0, t); src.frequency.linearRampToValueAtTime(f0 * (0.94 + Math.random() * 0.1), t + d);
      const jit = ctx.createOscillator(); jit.frequency.value = 5 + Math.random() * 2; const jg = ctx.createGain(); jg.gain.value = f0 * 0.012; jit.connect(jg); jg.connect(src.frequency); jit.start(t); jit.stop(t + d + 0.05);
      src.start(t); src.stop(t + d + 0.05);
    }
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.025); g.gain.setValueAtTime(1, t + d * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + d);
    vw.forEach((fm, j) => {
      const b = bp(fm * v.scale, [6, 9, 12][j]); const bg = ctx.createGain(); bg.gain.value = [1, 0.55, 0.25][j];
      src.connect(b); b.connect(bg); bg.connect(g);
    });
    g.connect(muffle);
    t += d + (Math.random() < 0.2 ? 0.14 : 0.015);
  }
  return { total: t - now(), p };
}

// ---------------------------------------------------------------------------
// Biscuit's body
export function flop() {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const n = noiseSrc(true, false); const f = filt('lowpass', 220); const g = ctx.createGain(); env(g, t0, 0.01, 0.5, 0.18);
  n.connect(f); f.connect(g); out(g, 0.15); n.stop(t0 + 0.4);
  // and the long sigh through the nose
  const b = noiseSrc(false, false); const bf = bp(700, 0.8); const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t0 + 0.25); bg.gain.linearRampToValueAtTime(0.05, t0 + 0.45); bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
  bf.frequency.setValueAtTime(900, t0 + 0.25); bf.frequency.linearRampToValueAtTime(450, t0 + 1.3);
  b.connect(bf); bf.connect(bg); out(bg, 0.2); b.stop(t0 + 1.4);
}
export function sniffSnd(outside = false) {
  if (!A.ready) return;
  const ctx = A.ctx;
  for (let i = 0; i < 3; i++) {
    const t0 = now() + i * 0.085;
    const n = noiseSrc(false, false); const f = bp(outside ? 2600 : 2200, 1.6); const g = ctx.createGain();
    env(g, t0, 0.012, 0.07, 0.05); f.frequency.setValueAtTime(1800, t0); f.frequency.linearRampToValueAtTime(3000, t0 + 0.06);
    n.connect(f); f.connect(g); out(g, 0.05); n.stop(t0 + 0.12);
  }
}
export function dig(snow = true) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  // claws raking through packed snow, then the spray landing behind you
  const tr = impulseTrain(0.16, 1400, 500, 0.9); const f = bp(snow ? 2400 : 1200, 1.2); const g = ctx.createGain();
  env(g, t0, 0.01, 0.35, 0.13); tr.connect(f); f.connect(g); out(g, 0.1); tr.start(t0);
  const n = noiseSrc(false, false); const nf = bp(snow ? 1800 : 700, 0.9); const ng = ctx.createGain();
  env(ng, t0 + 0.1, 0.02, 0.12, 0.18); n.connect(nf); nf.connect(ng); out(ng, 0.15); n.stop(t0 + 0.5);
}
export function thunk(x, y, z, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(60, t0 + 0.12);
  const g = ctx.createGain(); env(g, t0, 0.002, 0.5 * vol, 0.14); o.connect(g);
  const n = noiseSrc(false, false); const nf = bp(500, 1.0); const ng = ctx.createGain(); env(ng, t0, 0.002, 0.3 * vol, 0.06); n.connect(nf); nf.connect(ng);
  const sum = ctx.createGain(); g.connect(sum); ng.connect(sum); at(sum, x, y, z, 1, 1.4, 0.3);
  o.start(t0); o.stop(t0 + 0.3); n.stop(t0 + 0.2);
}
export function flap(x, y, z, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  // a stiff plastic flap slapping shut against its frame, twice
  for (let i = 0; i < 2; i++) {
    const tt = t0 + i * 0.16;
    const n = noiseSrc(false, false); const f = bp(1100 - i * 300, 2.5); const g = ctx.createGain();
    env(g, tt, 0.001, (0.45 - i * 0.25) * vol, 0.05); n.connect(f); f.connect(g); at(g, x, y, z, 1, 1.5, 0.25); n.stop(tt + 0.1);
  }
}
export function snap() {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  // teeth meeting
  const n = noiseSrc(false, false); const f = bp(3400, 3); const g = ctx.createGain(); env(g, t0, 0.001, 0.6, 0.03);
  n.connect(f); f.connect(g); out(g, 0.1); n.stop(t0 + 0.08);
  knockSmall(t0, 0.2);
}
export function growl(dur = 0.9, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const src = impulseTrain(dur, 70, 55, 0.5);
  const f1 = bp(450, 4), f2 = bp(1100, 5);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.5 * vol, t0 + 0.08); g.gain.setValueAtTime(0.5 * vol, t0 + dur - 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f1); src.connect(f2); f1.connect(g); f2.connect(g); out(g, 0.2); src.start(t0);
}
export function shakeSnd() {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  // ears and collar tags flapping as you shake the snow off
  for (let i = 0; i < 7; i++) { const tt = t0 + i * 0.075; const n = noiseSrc(false, false); const f = bp(900 + (i % 2) * 500, 1.3); const g = ctx.createGain(); env(g, tt, 0.004, 0.12, 0.05); n.connect(f); f.connect(g); out(g, 0.15); n.stop(tt + 0.1); if (i % 2) knockSmall(tt, 0.08); }
}

// ---------------------------------------------------------------------------
// Dread
export function breathing(x, y, z, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  // a slow, wet, too-deep breath: in, a catch, out
  for (const [st, len, f0, f1, amp] of [[0, 1.0, 380, 620, 0.5], [1.15, 1.3, 520, 300, 0.6]]) {
    const n = noiseSrc(false, false); const f = bp(f0, 1.4); const g = ctx.createGain();
    f.frequency.setValueAtTime(f0, t0 + st); f.frequency.linearRampToValueAtTime(f1, t0 + st + len);
    g.gain.setValueAtTime(0.0001, t0 + st); g.gain.linearRampToValueAtTime(amp * vol, t0 + st + len * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + st + len);
    n.connect(f); f.connect(g); at(g, x, y, z, 1, 1.3, 0.35); n.stop(t0 + st + len + 0.05);
  }
  const r = impulseTrain(0.5, 30, 22, 0.6); const rf = bp(260, 3); const rg = ctx.createGain(); env(rg, t0 + 1.2, 0.05, 0.25 * vol, 0.4);
  r.connect(rf); rf.connect(rg); at(rg, x, y, z, 1, 1.3, 0.35); r.start(t0 + 1.2);
}
export function groan(x, y, z, vol = 1) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  // pipes and joists, stressed: a long bowed-metal moan
  const src = impulseTrain(2.6, 45, 28, 0.25);
  const f1 = bp(180 + Math.random() * 80, 12), f2 = bp(430 + Math.random() * 120, 14), f3 = bp(1100, 10);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.7 * vol, t0 + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
  src.connect(f1); src.connect(f2); src.connect(f3); f1.connect(g); f2.connect(g); f3.connect(g);
  at(g, x, y, z, 2, 1.0, 0.6); src.start(t0);
}
export function phone(x, y, z, rings = 1) {
  if (!A.ready) return;
  const ctx = A.ctx;
  for (let r = 0; r < rings; r++) {
    const t0 = now() + r * 3;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 20;
    const b1 = ctx.createOscillator(); b1.frequency.value = 1100; const b2 = ctx.createOscillator(); b2.frequency.value = 1350;
    const am = ctx.createGain(); am.gain.value = 0; o.connect(am.gain);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.02); g.gain.setValueAtTime(0.18, t0 + 1.6); g.gain.linearRampToValueAtTime(0.0001, t0 + 1.7);
    b1.connect(am); b2.connect(am); am.connect(g); at(g, x, y, z, 1, 1.2, 0.4);
    for (const n of [o, b1, b2]) { n.start(t0); n.stop(t0 + 1.75); }
  }
}
export function ballBounce(x, y, z, n = 5) {
  if (!A.ready) return;
  for (let i = 0; i < n; i++) {
    const dt = 0.45 * Math.pow(0.72, i) * (i ? 1 : 0) ;
    const t0 = now() + [0, 0.45, 0.77, 1.0, 1.17, 1.29, 1.38][i];
    const ctx = A.ctx;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(220, t0); o.frequency.exponentialRampToValueAtTime(110, t0 + 0.05);
    const g = ctx.createGain(); env(g, t0, 0.002, 0.35 * Math.pow(0.75, i), 0.06); o.connect(g); at(g, x, y, z, 1, 1.4, 0.3); o.start(t0); o.stop(t0 + 0.1);
    void dt;
  }
}
export function startDrone() {
  if (!A.ready || A.loops.drone) return;
  const ctx = A.ctx;
  // something enormous and very low, always there, a little out of tune with itself
  const o1 = ctx.createOscillator(); o1.frequency.value = 41;
  const o2 = ctx.createOscillator(); o2.frequency.value = 41.7;
  const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 61.3;
  const n = noiseSrc(true, true); const nf = filt('lowpass', 90);
  const g = ctx.createGain(); g.gain.value = 0;
  const hi = ctx.createOscillator(); hi.frequency.value = 3170; const hg = ctx.createGain(); hg.gain.value = 0;
  o1.connect(g); o2.connect(g); o3.connect(g); n.connect(nf); nf.connect(g); hi.connect(hg);
  out(g, 0.2); out(hg, 0.6);
  for (const x of [o1, o2, o3, hi]) x.start();
  A.loops.drone = { g, hg, o3 };
}
export function setDrone(level, t) {
  const L = A.loops.drone; if (!L) return;
  const k = now();
  L.g.gain.setTargetAtTime(0.05 + level * 0.22 + 0.04 * Math.sin(t * 0.13), k, 1.5);
  L.hg.gain.setTargetAtTime(level > 0.5 ? (level - 0.5) * 0.012 * (0.5 + 0.5 * Math.sin(t * 0.37)) : 0, k, 2);
  L.o3.frequency.setTargetAtTime(61.3 - level * 4, k, 3);
}

export function tailThump(x, y, z) {
  if (!A.ready) return;
  const ctx = A.ctx, t0 = now();
  const n = noiseSrc(true, false); const f = filt('lowpass', 260); const g = ctx.createGain(); env(g, t0, 0.003, 0.22, 0.07);
  n.connect(f); f.connect(g); at(g, x, y, z, 1, 1.6, 0.1); n.stop(t0 + 0.15);
}
export function wagSwish() {
  if (!A.ready) return;
  const ctx = A.ctx;
  for (let i = 0; i < 6; i++) { const t0 = now() + i * 0.18; const n = noiseSrc(false, false); const f = bp(1500 + (i % 2) * 400, 0.9); const g = ctx.createGain(); env(g, t0, 0.03, 0.035, 0.08); n.connect(f); f.connect(g); out(g, 0.1); n.stop(t0 + 0.15); }
}
