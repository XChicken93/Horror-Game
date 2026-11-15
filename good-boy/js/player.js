// Biscuit: first-person dog controller.
import * as THREE from '../vendor/three.module.js';
import { ps1Mat } from './ps1.js';
import { collide, floorAt, isOutside, BASE_Y } from './house.js';
import { step, flop } from './audio.js';
import { T } from './textures.js';

export const keys = new Set();
export const input = { mdx: 0, mdy: 0, sniff: false, eDown: false, eStart: 0, cDown: false, cStart: 0, rDown: false, locked: false, enabled: false };

export const dog = {
  pos: new THREE.Vector3(1.5, 0, 8.9), yaw: 0, pitch: -0.05, y: 0,
  eye: 0.42, lying: 0, carrying: null, stepT: 0, bob: 0, moving: false, speed: 0,
  stumble: 0, roll: 0, barkKick: 0, frozen: false, radius: 0.21,
  act: null, actT: 0, actDur: 0, digging: false, lean: 0, pawsT: 0,
};

/** Play a visible body action: 'scratch', 'bite', 'tug', 'eat', 'pull', 'pickup', 'drop', 'whine', 'shake', 'nudge'. */
export function act(kind, dur) {
  const D = { scratch: 1.1, bite: 0.9, tug: 1.0, eat: 2.2, pull: 0.8, pickup: 0.45, drop: 0.4, whine: 1.3, shake: 1.5, nudge: 0.6 };
  dog.act = kind; dog.actT = 0; dog.actDur = dur ?? D[kind] ?? 0.6;
}

export function initInput(canvas, handlers) {
  addEventListener('keydown', (e) => {
    if (!input.enabled) { if (handlers.anyKey) handlers.anyKey(e); return; }
    const k = e.key.toLowerCase();
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    if (k === ' ') handlers.bark();
    if (k === 'q') handlers.whine();
    if (k === 'e') { input.eDown = true; input.eStart = performance.now(); input.eUsedHold = false; }
    if (k === 'c') { input.cDown = true; input.cStart = performance.now(); }
    if (k === 'f') input.sniff = true;
    if (k === 'r') input.rDown = true;
    if (k === 't' && handlers.track) handlers.track();
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (!input.enabled) return;
    if (k === 'e') {
      const held = performance.now() - input.eStart;
      input.eDown = false;
      if (!input.eUsedHold && held < 600) handlers.interact();
    }
    if (k === 'c') input.cDown = false;
    if (k === 'f') input.sniff = false;
    if (k === 'r') input.rDown = false;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (!input.enabled) return;
    if (e.button === 2) input.sniff = true;
    if (!input.locked && canvas.requestPointerLock) canvas.requestPointerLock();
    input.drag = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 2) input.sniff = false; input.drag = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; input.skipMove = 2; input.mdx = 0; input.mdy = 0; });
  addEventListener('mousemove', (e) => {
    if (!input.enabled) return;
    if (input.skipMove > 0) { input.skipMove--; return; }
    if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return; // browser glitch on lock
    if (input.locked || input.drag) { input.mdx += e.movementX; input.mdy += e.movementY; }
  });
  addEventListener('blur', () => { keys.clear(); input.sniff = false; input.eDown = false; input.cDown = false; input.rDown = false; });
}

export function makeSnout(camera) {
  const g = new THREE.Group();
  const fur = ps1Mat({ map: T.fur, color: 0xb89466, emissive: 0x1c140c });
  const dark = ps1Mat({ map: T.fur, color: 0x8a6036, emissive: 0x0e0905 });
  const lip = ps1Mat({ color: 0x2a1a14 });
  const tooth = ps1Mat({ color: 0xe8e0c8, emissive: 0x1a1810 });
  const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.1), fur); g.add(m1);
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.026, 0.05), dark); m2.position.set(0, -0.003, -0.06); g.add(m2);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.016, 0.016), ps1Mat({ color: 0x0a0806 })); nose.position.set(0, 0.006, -0.088); g.add(nose);
  // upper teeth and lip line along the underside of the muzzle
  const lipU = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, 0.075), lip); lipU.position.set(0, -0.019, -0.045); g.add(lipU);
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.005, i === 0 ? 0.014 : 0.007, 0.006), tooth);
    t.position.set(sx * (0.012 + i * 0.002), -0.024 - (i === 0 ? 0.003 : 0), -0.075 + i * 0.015); g.add(t);
  }
  // the jaw hinges at the back of the mouth
  const jaw = new THREE.Group(); jaw.position.set(0, -0.02, 0.0); g.add(jaw);
  const jb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.075), dark); jb.position.set(0, -0.004, -0.04); jaw.add(jb);
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.004, 0.06), ps1Mat({ color: 0xb04a5a, emissive: 0x200810 })); tongue.position.set(0, 0.004, -0.035); jaw.add(tongue);
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.005, i === 0 ? 0.012 : 0.006, 0.006), tooth);
    t.position.set(sx * (0.011 + i * 0.002), 0.006, -0.07 + i * 0.016); jaw.add(t);
  }
  g.position.set(0, -0.112, -0.2);
  g.rotation.x = 0.12;
  camera.add(g);
  dog.snout = g; dog.jaw = jaw; dog.nose = nose;
  const mouth = new THREE.Group(); mouth.position.set(0, -0.13, -0.42); camera.add(mouth);
  dog.mouth = mouth;
  return g;
}

// Biscuit's own body, so you can look down and see your chest and front legs, and watch
// your paws scratch, dig, stretch out when you lie down, and climb up onto the beds.
function limb(r0, r1, len, mat) {
  const geo = new THREE.CylinderGeometry(r0, r1, len, 6, 2);
  geo.scale(1, 1, 1.15);
  return new THREE.Mesh(geo, mat);
}
function makeLeg(side, fur, pawM, claw) {
  const sh = new THREE.Group(); sh.position.set(side * 0.082, 0.26, 0.075);
  const up = limb(0.037, 0.027, 0.16, fur); up.position.y = -0.075; sh.add(up);
  const el = new THREE.Group(); el.position.y = -0.15; sh.add(el);
  const fore = limb(0.026, 0.02, 0.14, fur); fore.position.y = -0.065; el.add(fore);
  const paw = new THREE.Group(); paw.position.y = -0.13; el.add(paw);
  const pg = new THREE.IcosahedronGeometry(1, 1); pg.scale(0.034, 0.02, 0.042);
  const pb = new THREE.Mesh(pg, pawM); pb.position.set(0, 0.002, -0.018); paw.add(pb);
  const tg = new THREE.IcosahedronGeometry(1, 0); tg.scale(0.012, 0.011, 0.014);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.016, zz = -0.05 + Math.abs(i - 1.5) * 0.008;
    const toe = new THREE.Mesh(tg, pawM); toe.position.set(x, -0.004, zz); paw.add(toe);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.006, 0.014), claw); c.position.set(x, -0.012, zz - 0.014); c.rotation.x = 0.5; paw.add(c);
  }
  return { sh, el, paw, side };
}
export function makeBody(scene) {
  const fur = ps1Mat({ map: T.fur, color: 0xc8a070, emissive: 0x2a1c10 });
  const pawM = ps1Mat({ map: T.fur, color: 0xb08a5a, emissive: 0x22160c });
  const claw = ps1Mat({ color: 0x1a1612 });
  const g = new THREE.Group();
  // the chest sits behind and below your head: you see it only at the bottom edge when you look down
  const cg = new THREE.IcosahedronGeometry(1, 1); cg.scale(0.11, 0.1, 0.24);
  const chest = new THREE.Mesh(cg, fur); chest.position.set(0, 0.23, 0.27); g.add(chest);
  const legs = [makeLeg(-1, fur, pawM, claw), makeLeg(1, fur, pawM, claw)];
  for (const l of legs) g.add(l.sh);
  scene.add(g);
  dog.body = g; dog.legs = legs; dog.chest = chest;
  return g;
}

function poseLegs(dt, t, mode) {
  const d = dog;
  for (const L of d.legs) {
    let sh = 0, el = 0, pw = 0;
    const s = L.side;
    if (mode === 'lie') { sh = 1.5; el = 0; pw = -1.48 + (s > 0 ? 0.04 : -0.02); }
    else if (mode === 'paws') { sh = 1.15; el = -0.25; pw = -0.7; }
    else if (mode === 'scratch') {
      const active = (Math.floor(t / 0.28) % 2 === 0) === (s < 0);
      const w = Math.sin(t * 22);
      if (active) { sh = 2.15 + 0.35 * w; el = -0.3 - 0.45 * Math.max(0, w); pw = -1.0 - 0.5 * Math.max(0, -w); }
      else { sh = 1.5; el = -1.2; pw = -0.6; }
    } else if (mode === 'dig') {
      const w = Math.sin(t * 19 + (s > 0 ? Math.PI : 0));
      sh = 0.65 + 0.55 * w; el = -0.25 - 1.0 * Math.max(0, Math.sin(t * 19 + (s > 0 ? Math.PI : 0) + 1.2)); pw = -0.5 * Math.max(0, w) + 0.3;
    } else if (mode === 'brace') { sh = -0.05; el = 0.05; pw = 0.0; }
    else if (mode === 'stand') { sh = 0.6; el = -0.1; pw = -0.5; }
    else if (mode === 'walk') {
      const ph = d.bob * 0.5 + (s > 0 ? Math.PI : 0);
      sh = 0.6 + 0.36 * Math.sin(ph); el = -0.1 - 0.8 * Math.max(0, Math.cos(ph)); pw = -0.5 - 0.5 * Math.max(0, Math.cos(ph));
    }
    const k = Math.min(1, dt * (mode === 'scratch' || mode === 'dig' ? 30 : 12));
    // the legs come together to scratch, and spread to lie down
    const wx = mode === 'scratch' ? 0.055 : mode === 'lie' ? 0.13 : 0.082;
    L.sh.position.x += (s * wx - L.sh.position.x) * Math.min(1, dt * 10);
    const wz = mode === 'scratch' ? -0.09 : mode === 'paws' ? -0.02 : 0.075;
    L.sh.position.z += (wz - L.sh.position.z) * Math.min(1, dt * 10);
    L.sh.rotation.x += (sh - L.sh.rotation.x) * k;
    L.el.rotation.x += (el - L.el.rotation.x) * k;
    L.paw.rotation.x += (pw - L.paw.rotation.x) * k;
  }
}

const fwd = new THREE.Vector3(), right = new THREE.Vector3();
// stand close to these and Biscuit puts his front paws up to see over them
const PAWS_UP = [
  [0.3, 2.62, 0.0, 2.6],   // parents' bed
  [6.45, 7.95, 0.1, 2.4],  // Lily's bed
  [4.75, 7.25, 7.75, 8.35],// couch seat
];
export function updateDog(dt, camera, co, t) {
  const d = dog;
  // look
  const sens = 0.0023;
  d.yaw -= input.mdx * sens; d.pitch -= input.mdy * sens;
  input.mdx = 0; input.mdy = 0;
  if (keys.has('arrowleft')) d.yaw += dt * 2.2;
  if (keys.has('arrowright')) d.yaw -= dt * 2.2;
  if (keys.has('arrowup')) d.pitch += dt * 1.5;
  if (keys.has('arrowdown')) d.pitch -= dt * 1.5;
  d.pitch = Math.max(-1.1, Math.min(1.25, d.pitch));
  // stumble / drift when poisoned
  if (co > 0.55) {
    d.stumble += dt * (0.6 + co);
    d.yaw += Math.sin(d.stumble * 0.9) * dt * (co - 0.55) * 0.5;
  }
  // move
  let mx = 0, mz = 0;
  if (!d.frozen) {
    if (keys.has('w')) mz += 1; if (keys.has('s')) mz -= 1;
    if (keys.has('a')) mx -= 1; if (keys.has('d')) mx += 1;
  }
  const lyingNow = input.cDown && !d.frozen && !d.digging;
  if (lyingNow && !d.wasLying) flop();
  d.wasLying = lyingNow;
  d.lying += ((lyingNow ? 1 : 0) - d.lying) * Math.min(1, dt * 4);
  if (lyingNow || d.digging) { mx = 0; mz = 0; }
  if (d.act) { d.actT += dt; if (d.actT >= d.actDur) d.act = null; }
  const A = d.act, at = d.actT, ap = d.act ? at / d.actDur : 0;
  if (A === 'bite' || A === 'tug' || A === 'eat' || A === 'shake' || A === 'scratch' || A === 'pull') { mx = 0; mz = 0; }
  const run = keys.has('shift');
  let sp = (run ? 3.9 : 1.9) * (1 - co * 0.5);
  if (input.sniff) sp *= 0.55;
  fwd.set(-Math.sin(d.yaw), 0, -Math.cos(d.yaw));
  right.set(Math.cos(d.yaw), 0, -Math.sin(d.yaw));
  const len = Math.hypot(mx, mz);
  d.moving = len > 0;
  if (len > 0) {
    const vx = (fwd.x * mz + right.x * mx) / len * sp, vz = (fwd.z * mz + right.z * mx) / len * sp;
    d.pos.x += vx * dt; d.pos.z += vz * dt;
    d.bob += dt * sp * 4.2;
    d.stepT -= dt;
    if (d.stepT <= 0) {
      d.stepT = run ? 0.13 : 0.2;
      const onStairs = d.pos.x > 12.5 && d.pos.z > 0.4 && d.pos.z < 3.0;
      const carpet = (d.pos.z < 3.5 && d.pos.x < 8) || (Math.abs(d.pos.z - 4.25) < 0.35);
      const out = isOutside(d.pos.x, d.pos.z, d.y);
      step(out ? 'snow' : onStairs ? 'stair' : carpet ? 'soft' : 'claw', undefined, undefined, undefined, onStairs ? 0.5 : 1);
      d.stepSide = -(d.stepSide || 1);
      if (out && d.onStep) d.onStep(d.pos.x, d.pos.z, d.yaw, d.stepSide);
    }
  }
  d.speed = len > 0 ? sp : 0;
  collide(d.pos, d.radius, d.y, 0.5);
  const fy = floorAt(d.pos.x, d.pos.z, d.y);
  d.y += (fy - d.y) * Math.min(1, dt * 14);
  d.pos.y = d.y;
  // paws up on beds and the couch
  let pawsUp = false;
  if (!lyingNow && d.y > -0.1) for (const [x0, x1, z0, z1] of PAWS_UP) if (d.pos.x > x0 && d.pos.x < x1 && d.pos.z > z0 && d.pos.z < z1) pawsUp = true;
  d.paws = (d.paws || 0) + ((pawsUp ? 1 : 0) - (d.paws || 0)) * Math.min(1, dt * 5);
  // ---- what the body is doing, layered on top of where you are looking ----
  const bell = (x) => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);
  let pitchOff = 0, eyeOff = 0, fwdOff = 0, rollOff = 0, yawOff = 0, jawOpen = d.barkKick * 0.55, lunge = 0;
  const scratching = A === 'scratch';
  if (A === 'scratch') { eyeOff += 0.08 * bell(ap * 1.2); pitchOff -= 0.1 * bell(ap); }
  if (A === 'bite') {
    const lu = ap < 0.35 ? ap / 0.35 : Math.max(0, 1 - (ap - 0.35) / 0.65);
    fwdOff += 0.22 * lu; lunge = lu; pitchOff += 0.18 * lu;
    jawOpen = ap < 0.3 ? 1.0 * (ap / 0.3) : ap < 0.38 ? 0.0 : 0.05;
    rollOff += ap > 0.38 && ap < 0.8 ? Math.sin(at * 45) * 0.12 : 0;
    yawOff += ap > 0.38 && ap < 0.8 ? Math.sin(at * 38) * 0.06 : 0;
  }
  if (A === 'tug') { pitchOff -= 0.2 * bell(ap); fwdOff -= 0.08 * bell(ap); rollOff += Math.sin(at * 26) * 0.16 * bell(ap); yawOff += Math.sin(at * 26 + 1) * 0.08 * bell(ap); jawOpen = ap < 0.15 ? 0.6 : 0.04; }
  if (A === 'pull') { fwdOff -= 0.12 * bell(ap); pitchOff -= 0.15 * bell(ap); rollOff += Math.sin(at * 20) * 0.08 * bell(ap); jawOpen = ap < 0.2 ? 0.6 : 0.03; }
  if (A === 'eat') { pitchOff -= 0.9 * bell(Math.min(1, ap * 4)) * (ap < 0.85 ? 1 : bell((1 - ap) * 3)); eyeOff -= 0.12 * bell(ap); jawOpen = 0.35 * Math.abs(Math.sin(at * 11)); fwdOff += 0.05; }
  if (A === 'pickup' || A === 'drop' || A === 'nudge') { pitchOff -= 0.75 * bell(ap); eyeOff -= 0.12 * bell(ap); fwdOff += 0.06 * bell(ap); jawOpen = A === 'drop' ? 0.5 * bell(ap) : A === 'pickup' ? 0.6 * bell(ap * 1.6) : 0; }
  if (A === 'whine') { rollOff += 0.16 * bell(ap); eyeOff -= 0.06 * bell(ap); pitchOff -= 0.15 * bell(ap); }
  if (A === 'shake') { const dec = 1 - ap; rollOff += Math.sin(at * 34) * 0.32 * dec; yawOff += Math.sin(at * 34 + 0.7) * 0.06 * dec; }
  if (d.digging) { d.digLook = Math.min(1, (d.digLook || 0) + dt * 4); } else d.digLook = Math.max(0, (d.digLook || 0) - dt * 4);
  if (d.digLook > 0) { eyeOff -= 0.08 * d.digLook; rollOff += Math.sin(t * 19) * 0.025 * d.digLook; }
  if (input.sniff) { eyeOff -= 0.05; pitchOff -= 0.08; if (d.nose) d.nose.scale.set(1 + Math.max(0, Math.sin(t * 22)) * 0.35, 1, 1); }
  else if (d.nose) d.nose.scale.set(1, 1, 1);
  if (d.pushing) { pitchOff -= 0.25; eyeOff -= 0.06; }
  d.lean += ((d.lying > 0.5 ? -0.42 : 0) - d.lean) * Math.min(1, dt * 3);
  pitchOff += d.lean;
  // camera
  const eye = d.eye - d.lying * 0.17 + d.paws * 0.42 + eyeOff;
  const bob = d.moving ? Math.sin(d.bob) * 0.018 : Math.sin(t * 1.6) * 0.004;
  const fx = -Math.sin(d.yaw), fz = -Math.cos(d.yaw);
  camera.position.set(d.pos.x + fx * fwdOff, d.y + eye + bob, d.pos.z + fz * fwdOff);
  const targetRoll = (d.moving ? Math.cos(d.bob * 0.5) * 0.012 : 0) + rollOff + (d.shiver ? Math.sin(t * 60) * 0.006 * d.shiver : 0);
  d.roll += (targetRoll - d.roll) * Math.min(1, dt * (A ? 18 : 3));
  // digging pulls your eyes down to your paws
  const pitch = d.digLook > 0 ? d.pitch + (-0.95 - d.pitch) * d.digLook * 0.85 : d.pitch;
  camera.rotation.set(Math.max(-1.35, pitch + d.barkKick * 0.08 + pitchOff), d.yaw + yawOff, d.roll, 'YXZ');
  d.barkKick = Math.max(0, d.barkKick - dt * 5);
  if (d.snout) {
    d.snout.position.y = -0.112 - d.barkKick * 0.03 + (d.moving ? Math.sin(d.bob) * 0.006 : 0);
    d.snout.position.z = -0.2 - lunge * 0.05;
    const jo = Math.max(jawOpen, d.panting ? 0.18 + Math.sin(t * 14) * 0.08 : 0);
    d.jaw.rotation.x += (-jo * 0.9 - d.jaw.rotation.x) * Math.min(1, dt * 30);
  }
  if (d.body) {
    const mode = d.lying > 0.5 ? 'lie' : d.digging ? 'dig' : scratching ? 'scratch' : d.paws > 0.5 ? 'paws' : (A === 'bite' || A === 'tug' || A === 'pull') ? 'brace' : d.moving ? 'walk' : 'stand';
    poseLegs(dt, t, mode);
    const by = -d.lying * 0.2 + (scratching ? 0.1 * bell(ap * 1.2) : 0) + d.paws * 0.36 - d.digLook * 0.04;
    d.body.position.set(d.pos.x + fx * fwdOff * 0.6, d.y + by, d.pos.z + fz * fwdOff * 0.6);
    d.body.rotation.set(scratching ? 0.35 * bell(ap * 1.2) : d.lying > 0.5 ? 0 : d.paws * 0.3, d.yaw, 0, 'YXZ');
    d.chest.position.y = 0.23 - d.lying * 0.1;
  }
  return d;
}

export function dogForward() { return new THREE.Vector3(-Math.sin(dog.yaw), 0, -Math.cos(dog.yaw)); }
export function inBasement() { return dog.y < -0.6; }
export { BASE_Y };
